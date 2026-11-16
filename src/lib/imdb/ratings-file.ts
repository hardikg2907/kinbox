import "server-only";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeWebStream } from "node:stream/web";
import { createGunzip } from "node:zlib";
import { env } from "@/lib/env";
import { ImdbFileError } from "./file-error";

export { ImdbFileError, type ImdbFileFailure } from "./file-error";

const RATINGS_URL = "https://datasets.imdbws.com/title.ratings.tsv.gz";
const HEADER = "tconst\taverageRating\tnumVotes";
const ROW_PATTERN = /^tt\d{7,10}\t\d{1,2}\.\d\t\d{1,10}$/;
// Only a validator-shaped value is ever sent back as If-None-Match, so a stored value cannot add headers.
const ETAG_PATTERN = /^(?:W\/)?"[\x21\x23-\x7e]{1,200}"$/;

const DEFAULT_MIN_ROWS = 500_000;
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_COMPRESSED_BYTES = 64 * 1024 * 1024;
const MAX_DECOMPRESSED_BYTES = 256 * 1024 * 1024;
// A real line is under 40 bytes; a longer unfinished one is not this file.
const MAX_LINE_LENGTH = 1024;
// A few bad lines are tolerated, so one odd row does not block every refresh.
const MAX_MALFORMED_SHARE = 0.001;
const MAX_VOTES = 2_147_483_647;

export type ImdbRating = { ratingTenths: number; votes: number };

export type ImdbRatingsResult =
  | { kind: "unchanged" }
  | { kind: "read"; etag: string | null; ratings: Map<string, ImdbRating> };

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type ReadImdbRatingsOptions = {
  /** Sent as If-None-Match, so an unchanged file costs one small answer. */
  etag?: string | null;
  /** Replaces the global `fetch`; tests use it to avoid the network. */
  fetch?: FetchLike;
  /** The fewest valid rows a real file has; fewer means a truncated or wrong file. */
  minRows?: number;
  /** Covers the whole download and parse. */
  timeoutMs?: number;
  maxCompressedBytes?: number;
  maxDecompressedBytes?: number;
};

async function cancelBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

function asFileError(error: unknown, signal: AbortSignal): ImdbFileError {
  if (error instanceof ImdbFileError) return error;
  return new ImdbFileError(signal.aborted ? "timeout" : "bad_stream", error);
}

/**
 * Streams IMDb's daily ratings file and keeps the rows of the wanted ids. The file is never held
 * whole: it is unzipped and split into lines as it arrives.
 */
export async function readImdbRatings(
  wanted: ReadonlySet<string>,
  options: ReadImdbRatingsOptions = {},
): Promise<ImdbRatingsResult> {
  const {
    minRows = DEFAULT_MIN_ROWS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxCompressedBytes = MAX_COMPRESSED_BYTES,
    maxDecompressedBytes = MAX_DECOMPRESSED_BYTES,
  } = options;
  // A test that forgot to stand in for this module must fail instead of downloading the file.
  if (!options.fetch && env().NODE_ENV === "test") throw new ImdbFileError("test_environment");
  const send: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const signal = AbortSignal.timeout(timeoutMs);

  const headers: Record<string, string> = {
    // The file is already gzip; asking for no extra encoding keeps the body as the file itself.
    "Accept-Encoding": "identity",
  };
  if (options.etag && ETAG_PATTERN.test(options.etag)) headers["If-None-Match"] = options.etag;

  let response: Response;
  try {
    response = await send(RATINGS_URL, {
      method: "GET",
      headers,
      // The URL is fixed; a redirect would be a download from somewhere else.
      redirect: "error",
      credentials: "omit",
      signal,
    });
  } catch (error) {
    throw new ImdbFileError(signal.aborted ? "timeout" : "fetch_failed", error);
  }

  if (response.status === 304 && headers["If-None-Match"]) {
    await cancelBody(response);
    return { kind: "unchanged" };
  }
  if (response.status !== 200) {
    await cancelBody(response);
    throw new ImdbFileError("status");
  }
  const length = Number(response.headers.get("content-length"));
  if (length > maxCompressedBytes) {
    await cancelBody(response);
    throw new ImdbFileError("too_large");
  }
  if (!response.body) throw new ImdbFileError("bad_stream");
  const rawEtag = response.headers.get("etag");
  const etag = rawEtag !== null && ETAG_PATTERN.test(rawEtag) ? rawEtag : null;

  const source = Readable.fromWeb(response.body as unknown as NodeWebStream);
  let compressed = 0;
  const compressedCap = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      compressed += chunk.length;
      if (compressed > maxCompressedBytes) done(new ImdbFileError("too_large"));
      else done(null, chunk);
    },
  });
  const gunzip = createGunzip();
  // A failure anywhere destroys every stream with that error, so the loop below throws it.
  pipeline([source, compressedCap, gunzip], { signal }).catch(() => undefined);

  const ratings = new Map<string, ImdbRating>();
  let decompressed = 0;
  let valid = 0;
  let malformed = 0;
  let sawHeader = false;
  let rest = "";

  function takeLine(line: string): void {
    if (!sawHeader) {
      if (line !== HEADER) throw new ImdbFileError("bad_header");
      sawHeader = true;
      return;
    }
    if (!ROW_PATTERN.test(line)) {
      malformed += 1;
      return;
    }
    const firstTab = line.indexOf("\t");
    const secondTab = line.indexOf("\t", firstTab + 1);
    const ratingTenths = Math.round(Number(line.slice(firstTab + 1, secondTab)) * 10);
    const votes = Number(line.slice(secondTab + 1));
    if (ratingTenths < 10 || ratingTenths > 100 || votes > MAX_VOTES) {
      malformed += 1;
      return;
    }
    valid += 1;
    const id = line.slice(0, firstTab);
    if (wanted.has(id)) ratings.set(id, { ratingTenths, votes });
  }

  try {
    for await (const chunk of gunzip as AsyncIterable<Buffer>) {
      decompressed += chunk.length;
      if (decompressed > maxDecompressedBytes) throw new ImdbFileError("too_large");
      // The file is ASCII, so a chunk cut in the middle of a character cannot happen;
      // anything else fails the row pattern.
      const text = rest + chunk.toString("latin1");
      let start = 0;
      for (let end = text.indexOf("\n"); end !== -1; end = text.indexOf("\n", start)) {
        const stop = text.charCodeAt(end - 1) === 13 ? end - 1 : end;
        takeLine(text.slice(start, stop));
        start = end + 1;
      }
      rest = text.slice(start);
      if (rest.length > MAX_LINE_LENGTH) throw new ImdbFileError("bad_stream");
    }
    if (rest !== "") takeLine(rest.endsWith("\r") ? rest.slice(0, -1) : rest);
  } catch (error) {
    throw asFileError(error, signal);
  } finally {
    source.destroy();
  }

  if (signal.aborted) throw new ImdbFileError("timeout");
  if (!sawHeader) throw new ImdbFileError("bad_header");
  if (malformed > (valid + malformed) * MAX_MALFORMED_SHARE) {
    throw new ImdbFileError("too_many_malformed");
  }
  if (valid < minRows) throw new ImdbFileError("too_few_rows");
  return { kind: "read", etag, ratings };
}

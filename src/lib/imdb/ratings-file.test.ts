import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import {
  ImdbFileError,
  readImdbRatings,
  type FetchLike,
  type ImdbFileFailure,
} from "./ratings-file";

const HEADER = "tconst\taverageRating\tnumVotes";
const URL_OF_FILE = "https://datasets.imdbws.com/title.ratings.tsv.gz";
const MATRIX = "tt0133093";
const INCEPTION = "tt1375666";

function row(id: string, rating = "8.7", votes = "2213456"): string {
  return `${id}\t${rating}\t${votes}`;
}

function fileText(rows: string[], eol = "\n"): string {
  return [HEADER, ...rows].join(eol) + eol;
}

// Ids that are not wanted, enough of them to pass a small minRows.
function filler(count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    row(`tt${String(2_000_000 + index).padStart(7, "0")}`, "5.5", "100"),
  );
}

function bytesOf(text: string): Buffer {
  return gzipSync(Buffer.from(text, "latin1"));
}

function streamOf(chunks: Uint8Array[], onCancel?: () => void): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      const next = chunks[index];
      index += 1;
      if (next === undefined) controller.close();
      else controller.enqueue(next);
    },
    cancel: onCancel,
  });
}

function pieces(bytes: Buffer, size: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let start = 0; start < bytes.length; start += size) out.push(bytes.subarray(start, start + size));
  return out;
}

function respondWith(
  body: Buffer | Uint8Array[] | null,
  init: { status?: number; headers?: Record<string, string>; onCancel?: () => void } = {},
): Response {
  const stream = body === null ? null : streamOf(Array.isArray(body) ? body : [body], init.onCancel);
  return new Response(stream, { status: init.status ?? 200, headers: init.headers });
}

function fetchReturning(make: () => Response) {
  return vi.fn<FetchLike>(async () => make());
}

async function reasonOf(promise: Promise<unknown>): Promise<ImdbFileFailure> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ImdbFileError);
  return (error as ImdbFileError).reason;
}

const WANTED = new Set([MATRIX, INCEPTION, "tt9999999"]);

describe("readImdbRatings", () => {
  it("keeps only the wanted ids and returns the ETag", async () => {
    const text = fileText([...filler(5), row(MATRIX), row(INCEPTION, "10.0", "7")]);
    const fetchMock = fetchReturning(() => respondWith(bytesOf(text), { headers: { etag: '"abc-2"' } }));

    const result = await readImdbRatings(WANTED, { fetch: fetchMock, minRows: 5 });

    expect(result).toEqual({
      kind: "read",
      etag: '"abc-2"',
      ratings: new Map([
        [MATRIX, { ratingTenths: 87, votes: 2213456 }],
        [INCEPTION, { ratingTenths: 100, votes: 7 }],
      ]),
    });
  });

  it("asks for the fixed URL without following redirects or sending credentials", async () => {
    const fetchMock = fetchReturning(() => respondWith(bytesOf(fileText(filler(3)))));
    await readImdbRatings(WANTED, { fetch: fetchMock, minRows: 3 });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(URL_OF_FILE);
    expect(init.redirect).toBe("error");
    expect(init.credentials).toBe("omit");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(init.headers).has("if-none-match")).toBe(false);
  });

  it("sends If-None-Match and reports an unchanged file on 304", async () => {
    const fetchMock = fetchReturning(() => new Response(null, { status: 304 }));

    const result = await readImdbRatings(WANTED, { fetch: fetchMock, etag: '"abc-2"' });

    expect(result).toEqual({ kind: "unchanged" });
    expect(new Headers(fetchMock.mock.calls[0]![1].headers).get("if-none-match")).toBe('"abc-2"');
  });

  it("does not send an ETag that is not a validator", async () => {
    const fetchMock = fetchReturning(() => respondWith(bytesOf(fileText(filler(3)))));
    await readImdbRatings(WANTED, { fetch: fetchMock, minRows: 3, etag: '"a"\r\nX-Bad: 1' });
    expect(new Headers(fetchMock.mock.calls[0]![1].headers).has("if-none-match")).toBe(false);
  });

  it("treats a 304 nobody asked for as an error", async () => {
    const fetchMock = fetchReturning(() => respondWith(null, { status: 304 }));
    expect(await reasonOf(readImdbRatings(WANTED, { fetch: fetchMock }))).toBe("status");
  });

  it("rejects a header that is not the expected one", async () => {
    const text = `tconst\taverageRating\tvotes\n${filler(5).join("\n")}\n`;
    const fetchMock = fetchReturning(() => respondWith(bytesOf(text)));
    expect(await reasonOf(readImdbRatings(WANTED, { fetch: fetchMock, minRows: 1 }))).toBe("bad_header");
  });

  it("rejects an empty file", async () => {
    const fetchMock = fetchReturning(() => respondWith(bytesOf("")));
    expect(await reasonOf(readImdbRatings(WANTED, { fetch: fetchMock, minRows: 0 }))).toBe("bad_header");
  });

  it("rejects more than 0.1% malformed rows and tolerates fewer", async () => {
    const bad = ["tt1\t8.7\t5", "tt0000001\t8\t5", "tt0000001\t11.0\t5", "tt0000001\t0.5\t5", "x"];
    const tooMany = fileText([...filler(100), bad[0]!]);
    expect(
      await reasonOf(
        readImdbRatings(WANTED, { fetch: fetchReturning(() => respondWith(bytesOf(tooMany))), minRows: 1 }),
      ),
    ).toBe("too_many_malformed");

    const fine = fileText([...filler(2000), bad[0]!]);
    const result = await readImdbRatings(WANTED, {
      fetch: fetchReturning(() => respondWith(bytesOf(fine))),
      minRows: 1,
    });
    expect(result.kind).toBe("read");
  });

  it.each([
    ["a rating of 0", "tt0000001\t0.0\t5"],
    ["a rating above 10", "tt0000001\t10.1\t5"],
    ["too many votes", "tt0000001\t5.0\t2147483648"],
    ["a missing column", "tt0000001\t5.0"],
    ["a blank line", ""],
    ["an extra column", "tt0000001\t5.0\t5\t1"],
  ])("counts %s as malformed", async (_label, line) => {
    const text = fileText([...filler(10), line]);
    const fetchMock = fetchReturning(() => respondWith(bytesOf(text)));
    expect(await reasonOf(readImdbRatings(WANTED, { fetch: fetchMock, minRows: 1 }))).toBe(
      "too_many_malformed",
    );
  });

  it("joins rows that are split across decompressed chunks and compressed chunks", async () => {
    const text = fileText([row(MATRIX), ...filler(20), row(INCEPTION, "8.8", "2500000")]);
    const whole = Buffer.from(text, "latin1");
    // Separate gzip members cut the text at arbitrary offsets, so lines break between output chunks.
    const members = [0, 13, 40, 41, 77, 200].map((start, index, starts) =>
      gzipSync(whole.subarray(start, starts[index + 1] ?? whole.length)),
    );
    const joined = Buffer.concat(members);

    const result = await readImdbRatings(WANTED, {
      fetch: fetchReturning(() => respondWith(pieces(joined, 5))),
      minRows: 20,
    });

    expect(result).toMatchObject({ kind: "read" });
    if (result.kind !== "read") return;
    expect(result.ratings.get(MATRIX)).toEqual({ ratingTenths: 87, votes: 2213456 });
    expect(result.ratings.get(INCEPTION)).toEqual({ ratingTenths: 88, votes: 2500000 });
    expect(result.ratings.size).toBe(2);
  });

  it("reads CRLF lines, also when the CR and LF arrive in different chunks", async () => {
    const text = fileText([row(MATRIX), ...filler(5)], "\r\n");
    const whole = Buffer.from(text, "latin1");
    const cut = text.indexOf("\r\n") + 1;
    const joined = Buffer.concat([gzipSync(whole.subarray(0, cut)), gzipSync(whole.subarray(cut))]);

    const result = await readImdbRatings(WANTED, {
      fetch: fetchReturning(() => respondWith(joined)),
      minRows: 6,
    });

    expect(result).toMatchObject({ kind: "read" });
    if (result.kind === "read") expect(result.ratings.get(MATRIX)?.ratingTenths).toBe(87);
  });

  it("reads a last line that has no line break", async () => {
    const text = fileText([...filler(3), row(MATRIX)]).trimEnd();
    const result = await readImdbRatings(WANTED, {
      fetch: fetchReturning(() => respondWith(bytesOf(text))),
      minRows: 4,
    });
    if (result.kind !== "read") throw new Error("expected a read");
    expect(result.ratings.has(MATRIX)).toBe(true);
  });

  it("rejects a gzip stream that ends early", async () => {
    const whole = bytesOf(fileText(filler(2000)));
    const cut = whole.subarray(0, Math.floor(whole.length / 2));
    expect(
      await reasonOf(
        readImdbRatings(WANTED, { fetch: fetchReturning(() => respondWith(cut)), minRows: 1 }),
      ),
    ).toBe("bad_stream");
  });

  it("rejects a body that is not gzip", async () => {
    const fetchMock = fetchReturning(() => respondWith(Buffer.from("<html>nope</html>")));
    expect(await reasonOf(readImdbRatings(WANTED, { fetch: fetchMock, minRows: 1 }))).toBe("bad_stream");
  });

  it("rejects a file with too few rows", async () => {
    const fetchMock = fetchReturning(() => respondWith(bytesOf(fileText(filler(5)))));
    expect(await reasonOf(readImdbRatings(WANTED, { fetch: fetchMock, minRows: 6 }))).toBe("too_few_rows");
  });

  it("applies a default minimum that a small file does not meet", async () => {
    const fetchMock = fetchReturning(() => respondWith(bytesOf(fileText(filler(5)))));
    expect(await reasonOf(readImdbRatings(WANTED, { fetch: fetchMock }))).toBe("too_few_rows");
  });

  it.each([404, 403, 500, 503])("rejects status %i and cancels the body", async (status) => {
    let cancelled = false;
    const fetchMock = fetchReturning(() =>
      respondWith(bytesOf("x"), { status, onCancel: () => (cancelled = true) }),
    );
    expect(await reasonOf(readImdbRatings(WANTED, { fetch: fetchMock }))).toBe("status");
    expect(cancelled).toBe(true);
  });

  it("rejects a declared size over the cap before reading", async () => {
    let pulled = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull() {
          pulled = true;
        },
      },
      { highWaterMark: 0 },
    );
    const fetchMock = fetchReturning(
      () => new Response(body, { status: 200, headers: { "content-length": String(64 * 1024 * 1024 + 1) } }),
    );
    expect(await reasonOf(readImdbRatings(WANTED, { fetch: fetchMock }))).toBe("too_large");
    expect(pulled).toBe(false);
  });

  it("aborts when more compressed bytes arrive than the cap, whatever the headers say", async () => {
    const bytes = bytesOf(fileText(filler(2000)));
    const fetchMock = fetchReturning(() => respondWith(pieces(bytes, 50)));
    expect(
      await reasonOf(readImdbRatings(WANTED, { fetch: fetchMock, minRows: 1, maxCompressedBytes: 200 })),
    ).toBe("too_large");
  });

  it("aborts when the unzipped data passes the cap", async () => {
    const bytes = bytesOf(fileText(filler(2000)));
    const fetchMock = fetchReturning(() => respondWith(bytes));
    expect(
      await reasonOf(readImdbRatings(WANTED, { fetch: fetchMock, minRows: 1, maxDecompressedBytes: 1000 })),
    ).toBe("too_large");
  });

  it("rejects a line that never ends", async () => {
    const bytes = bytesOf(`${HEADER}\n${"a".repeat(5000)}`);
    const fetchMock = fetchReturning(() => respondWith(bytes));
    expect(await reasonOf(readImdbRatings(WANTED, { fetch: fetchMock, minRows: 0 }))).toBe("bad_stream");
  });

  it("gives up when the download stalls past the timeout", async () => {
    let cancelled = false;
    const stalled = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([0x1f, 0x8b]));
      },
      cancel() {
        cancelled = true;
      },
    });
    const fetchMock = fetchReturning(() => new Response(stalled, { status: 200 }));

    expect(await reasonOf(readImdbRatings(WANTED, { fetch: fetchMock, timeoutMs: 50 }))).toBe("timeout");
    expect(cancelled).toBe(true);
  });

  it("reports a timeout while waiting for the response", async () => {
    const fetchMock = vi.fn<FetchLike>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    expect(await reasonOf(readImdbRatings(WANTED, { fetch: fetchMock, timeoutMs: 30 }))).toBe("timeout");
  });

  it("wraps a failed fetch in a generic error", async () => {
    const secret = "do-not-leak";
    const fetchMock = vi.fn<FetchLike>(async () => {
      throw new Error(secret);
    });
    const error = await readImdbRatings(WANTED, { fetch: fetchMock }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ImdbFileError);
    expect((error as ImdbFileError).reason).toBe("fetch_failed");
    expect((error as ImdbFileError).message).not.toContain(secret);
  });

  it("refuses to use the global fetch in the test environment", async () => {
    const global = vi.spyOn(globalThis, "fetch");
    expect(await reasonOf(readImdbRatings(WANTED))).toBe("test_environment");
    expect(global).not.toHaveBeenCalled();
    global.mockRestore();
  });
});

import { errorResponse, jsonResponse, MESSAGES } from "@/data/errors";
import { importMatchInput, matchImportLines } from "@/data/import-match";
import { getOwner } from "@/data/session";

// Ten lines with two 100-character texts each fit several times over.
const MAX_BODY_BYTES = 16 * 1024;
const DIGITS = /^\d+$/;

type BodyRead = { ok: true; text: string } | { ok: false; status: 400 | 413 };

// Matching is a read, so it is a route handler rather than a Server Action: an action
// re-renders the page after every call, and one Import sends many of these.
export async function POST(request: Request): Promise<Response> {
  const sessionStart = performance.now();
  const owner = await getOwner();
  const session = performance.now() - sessionStart;
  if (!owner) return jsonResponse({ error: MESSAGES.signIn }, 401, { session });

  // A cross-site form cannot send this type, and the session cookie is not sent on a
  // cross-site POST either; checking the type keeps the route safe even if that changes.
  if (!isJsonType(request.headers.get("content-type"))) {
    return jsonResponse({ error: MESSAGES.invalid }, 415, { session });
  }

  const body = await readCappedBody(request, MAX_BODY_BYTES);
  if (!body.ok) return jsonResponse({ error: MESSAGES.invalid }, body.status, { session });

  let json: unknown;
  try {
    json = JSON.parse(body.text);
  } catch {
    return jsonResponse({ error: MESSAGES.invalid }, 400, { session });
  }
  const parsed = importMatchInput.safeParse(json);
  if (!parsed.success) return jsonResponse({ error: MESSAGES.invalid }, 400, { session });

  const matchStart = performance.now();
  try {
    const matches = await matchImportLines(owner, parsed.data.lines);
    return jsonResponse(matches, 200, { session, match: performance.now() - matchStart });
  } catch (error) {
    return errorResponse(error, "api/import/match", { session });
  }
}

function isJsonType(header: string | null): boolean {
  if (header === null) return false;
  return header.split(";")[0].trim().toLowerCase() === "application/json";
}

// The cap is checked while reading, so a body that lies about its length, or sends none,
// still never fills memory before it is refused.
async function readCappedBody(request: Request, maxBytes: number): Promise<BodyRead> {
  const declared = request.headers.get("content-length")?.trim();
  if (declared !== undefined && DIGITS.test(declared) && Number(declared) > maxBytes) {
    return { ok: false, status: 413 };
  }
  if (!request.body) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, status: 413 };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    // Bytes that are not UTF-8 are refused rather than read as replacement characters.
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, status: 400 };
  }
}

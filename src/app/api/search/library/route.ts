import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, jsonResponse, MESSAGES } from "@/data/errors";
import { searchLibraryFor } from "@/data/search";
import { getOwner } from "@/data/session";

const searchQuery = z.strictObject({ q: z.string().trim().min(1).max(100) });

export async function GET(request: NextRequest): Promise<Response> {
  // Reading the URL first marks the handler as per-request, so the build never prerenders it.
  const params = [...request.nextUrl.searchParams];

  const sessionStart = performance.now();
  const owner = await getOwner();
  const session = performance.now() - sessionStart;
  if (!owner) return jsonResponse({ error: MESSAGES.signIn }, 401, { session });

  const parsed = searchQuery.safeParse(Object.fromEntries(params));
  // A repeated key would be silently dropped by fromEntries, so it is rejected instead.
  if (!parsed.success || params.length !== 1) {
    return jsonResponse({ error: MESSAGES.invalid }, 400, { session });
  }

  try {
    const dbStart = performance.now();
    const results = await searchLibraryFor(owner, parsed.data.q);
    return jsonResponse({ results }, 200, { session, db: performance.now() - dbStart });
  } catch (error) {
    return errorResponse(error, "api/search/library", { session });
  }
}

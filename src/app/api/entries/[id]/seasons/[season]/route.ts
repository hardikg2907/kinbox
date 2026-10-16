import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, jsonResponse, MESSAGES } from "@/data/errors";
import { getSeasonFor } from "@/data/progress";
import { getOwner } from "@/data/session";

const seasonParams = z.strictObject({
  id: z.uuid(),
  // Digits only: Number() would read "", " 1" or "1e2" as numbers.
  season: z
    .string()
    .regex(/^\d{1,4}$/)
    .transform(Number)
    .pipe(z.int().min(0).max(1000)),
});

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/entries/[id]/seasons/[season]">,
): Promise<Response> {
  const owner = await getOwner();
  if (!owner) return jsonResponse({ error: MESSAGES.signIn }, 401);

  // A malformed id or Season behaves exactly like one the Owner does not have.
  const parsed = seasonParams.safeParse(await ctx.params);
  if (!parsed.success) return jsonResponse({ error: MESSAGES.entryNotFound }, 404);

  try {
    const season = await getSeasonFor(owner, parsed.data.id, parsed.data.season);
    if (!season) return jsonResponse({ error: MESSAGES.entryNotFound }, 404);
    return jsonResponse(season);
  } catch (error) {
    return errorResponse(error, "api/season");
  }
}

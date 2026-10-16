import "server-only";
import { refresh } from "next/cache";
import type { z } from "zod";
import type { ActionResult } from "@/data/dto";
import { MESSAGES, userMessage } from "@/data/errors";
import { requireOwner, type Owner } from "@/data/session";

/**
 * The one shape every Server Action follows: session, strict input parse, one
 * data call, then a re-render. Failures come back as a sentence, never a throw.
 */
export async function runAction<S extends z.ZodType, T>(
  tag: string,
  schema: S,
  input: unknown,
  write: (owner: Owner, input: z.output<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  // Outside the try: its redirect to sign-in must reach Next.js, not become an error toast.
  const owner = await requireOwner();

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: MESSAGES.invalid };

  let data: T;
  try {
    data = await write(owner, parsed.data);
  } catch (error) {
    return { ok: false, error: userMessage(error, tag) };
  }
  refresh();
  return { ok: true, data };
}

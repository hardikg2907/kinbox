const SQLSTATE = /^[0-9A-Z]{5}$/;

/**
 * An error reduced to what is safe to log: its name and, for a database error, the
 * SQLSTATE code. Messages are dropped because a failed query puts its parameters
 * (Owner ids, Note text) in them.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return "non-error thrown";
  const code = [error, error.cause]
    .map((e) => (typeof e === "object" && e !== null && "code" in e ? e.code : undefined))
    .find((c): c is string => typeof c === "string" && SQLSTATE.test(c));
  return code ? `${error.name} (SQLSTATE ${code})` : error.name;
}

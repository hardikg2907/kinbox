const SQLSTATE = /^[0-9A-Z]{5}$/;
// Node's system error codes (ECONNRESET, ETIMEDOUT, ENOTFOUND). No SQLSTATE class starts with E.
const SYSTEM_CODE = /^E[A-Z0-9_]{2,30}$/;
// Connection failures from pg carry no code. These exact texts hold no data, so they may be logged.
const SAFE_MESSAGES = new Set([
  "timeout exceeded when trying to connect",
  "Connection terminated unexpectedly",
  "Connection terminated due to connection timeout",
  "Connection terminated",
]);
// Deep enough for a query error wrapping a pool error wrapping a socket error.
const MAX_DEPTH = 4;

function causeChain(error: Error): Error[] {
  const chain: Error[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current instanceof Error && !seen.has(current) && chain.length < MAX_DEPTH) {
    seen.add(current);
    chain.push(current);
    // A failed connect to a host with several addresses throws one AggregateError holding each try.
    if (current instanceof AggregateError && current.errors[0] instanceof Error && current.cause === undefined) {
      current = current.errors[0];
    } else {
      current = current.cause;
    }
  }
  return chain;
}

function codeOf(error: Error): string | undefined {
  const code = "code" in error ? error.code : undefined;
  if (typeof code !== "string") return undefined;
  if (SYSTEM_CODE.test(code)) return code;
  return SQLSTATE.test(code) ? `SQLSTATE ${code}` : undefined;
}

/**
 * An error reduced to what is safe to log: the names along its cause chain, a SQLSTATE or
 * system error code, and a few fixed connection-failure texts. Other messages are dropped
 * because a failed query puts its parameters (Owner ids, Note text) in them.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return "non-error thrown";
  const chain = causeChain(error);
  // A plain "Error" cause says nothing the outer name does not.
  const names = chain
    .map((e) => e.name)
    .filter((name, index, all) => index === 0 || (name !== "Error" && name !== all[index - 1]));
  const code = chain.map(codeOf).find((c) => c !== undefined);
  const message = chain.map((e) => e.message).find((m) => SAFE_MESSAGES.has(m));
  const details = [code, message].filter((d) => d !== undefined).join(", ");
  return details ? `${names.join(" <- ")} (${details})` : names.join(" <- ");
}

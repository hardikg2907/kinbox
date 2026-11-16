// Apart from the reader so a test stand-in for the reader can share the same class.

export type ImdbFileFailure =
  | "test_environment"
  | "fetch_failed"
  | "status"
  | "too_large"
  | "timeout"
  | "bad_stream"
  | "bad_header"
  | "too_many_malformed"
  | "too_few_rows";

/** The ratings file could not be used. The message is generic; `reason` is for logs. */
export class ImdbFileError extends Error {
  readonly reason: ImdbFileFailure;

  constructor(reason: ImdbFileFailure, cause?: unknown) {
    super("IMDb ratings could not be read", { cause });
    this.name = "ImdbFileError";
    this.reason = reason;
  }
}

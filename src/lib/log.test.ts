import { describe, expect, it } from "vitest";
import { describeError } from "./log";

describe("describeError", () => {
  it("keeps the name and drops the message, which can hold query parameters", () => {
    const error = new Error('Failed query: update "entries" set "note" = $1 params: my private note');
    expect(describeError(error)).toBe("Error");
  });

  it("adds the SQLSTATE code a driver error carries on the error or its cause", () => {
    const driverError = Object.assign(new Error("duplicate key value"), { code: "23505" });
    const wrapped = new Error("Failed query", { cause: driverError });
    wrapped.name = "DrizzleQueryError";
    expect(describeError(wrapped)).toBe("DrizzleQueryError (SQLSTATE 23505)");
    expect(describeError(driverError)).toBe("Error (SQLSTATE 23505)");
  });

  it("ignores codes that are not SQLSTATE codes, so free text cannot slip through", () => {
    const error = Object.assign(new Error("x"), { code: "token=abc123 secret" });
    expect(describeError(error)).toBe("Error");
  });

  it("describes a thrown non-error without printing it", () => {
    expect(describeError("session-token-value")).toBe("non-error thrown");
  });
});

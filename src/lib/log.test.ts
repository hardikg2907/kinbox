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

  it("adds a system error code from deep in the cause chain", () => {
    const socket = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
    const wrapped = new Error("Failed query: select 1 params: owner-a", { cause: socket });
    expect(describeError(wrapped)).toBe("Error (ECONNRESET)");
  });

  it("reads the code of a failed connect to several addresses", () => {
    const tries = [Object.assign(new Error("connect ETIMEDOUT 10.0.0.1:5432"), { code: "ETIMEDOUT" })];
    const aggregate = Object.assign(new AggregateError(tries, ""), { code: "ETIMEDOUT" });
    const wrapped = new Error("Failed query", { cause: aggregate });
    expect(describeError(wrapped)).toBe("Error <- AggregateError (ETIMEDOUT)");
  });

  it("names a cause whose name differs, so a bare Error still points somewhere", () => {
    const wrapped = new Error("Failed query", { cause: new TypeError("x is not a function") });
    expect(describeError(wrapped)).toBe("Error <- TypeError");
  });

  it("keeps the fixed pool connection texts, which hold no data", () => {
    const wrapped = new Error("Failed query", { cause: new Error("timeout exceeded when trying to connect") });
    expect(describeError(wrapped)).toBe("Error (timeout exceeded when trying to connect)");
  });

  it("stops on a cause chain that loops", () => {
    const error = new Error("a");
    (error as { cause?: unknown }).cause = error;
    expect(describeError(error)).toBe("Error");
  });

  it("describes a thrown non-error without printing it", () => {
    expect(describeError("session-token-value")).toBe("non-error thrown");
  });
});

import { describe, expect, it } from "vitest";
import { codeFilesOnMain, isEnvFile, scanStagedDiff } from "./checks";

describe("codeFilesOnMain", () => {
  it("allows docs on main", () => {
    expect(codeFilesOnMain("main", ["docs/decisions-v0.1.md", "AGENTS.md", ".scratch/x/map.md"])).toEqual([]);
  });

  it("lists code files on main", () => {
    expect(codeFilesOnMain("main", ["docs/a.md", "src/app/page.tsx", "package.json"])).toEqual([
      "src/app/page.tsx",
      "package.json",
    ]);
  });

  it("allows anything on other branches and when detached", () => {
    expect(codeFilesOnMain("feat/x", ["src/app/page.tsx"])).toEqual([]);
    expect(codeFilesOnMain(null, ["src/app/page.tsx"])).toEqual([]);
  });
});

describe("isEnvFile", () => {
  it("flags env files in any folder", () => {
    expect(isEnvFile(".env")).toBe(true);
    expect(isEnvFile(".env.local")).toBe(true);
    expect(isEnvFile("apps/web/.env.production.local")).toBe(true);
  });

  it("allows the example file and look-alikes", () => {
    expect(isEnvFile(".env.example")).toBe(false);
    expect(isEnvFile("src/lib/env.ts")).toBe(false);
    expect(isEnvFile("docs/.envrc-notes.md")).toBe(false);
  });
});

// Fixtures are assembled from pieces so this file never holds a literal secret-looking line.
const DB = "postgresql://";
const KEY_HEADER = ["-----BEGIN OPENSSH PRIVATE", "KEY-----"].join(" ");
const AUTH_SECRET = ["BETTER_AUTH", "SECRET"].join("_");

function diff(file: string, start: number, added: string[]): string {
  return [
    `diff --git a/${file} b/${file}`,
    `+++ b/${file}`,
    `@@ -0,0 +${start},${added.length} @@`,
    ...added.map((text) => `+${text}`),
  ].join("\n");
}

describe("scanStagedDiff", () => {
  const jwt = `eyJ${"a".repeat(20)}.eyJ${"b".repeat(20)}.${"c".repeat(20)}`;

  it("finds a token with its file and line", () => {
    expect(scanStagedDiff(diff("src/x.ts", 10, ["const a = 1;", `const t = "${jwt}";`]))).toEqual([
      { file: "src/x.ts", line: 11, kind: "JWT-style token" },
    ]);
  });

  it("finds a database URL with a real password but not a placeholder", () => {
    const found = scanStagedDiff(
      diff("README.md", 1, [
        `${DB}kinbox:${"s3cret"}Value99@host/db`,
        `${DB}user:<password>@host/db`,
        `${DB}user:password@host/db`,
      ]),
    );
    expect(found).toEqual([{ file: "README.md", line: 1, kind: "database URL with a password" }]);
  });

  it("finds assigned secrets and private keys", () => {
    const found = scanStagedDiff(
      diff("notes.txt", 5, [`${AUTH_SECRET}=${"abcdefghijklm"}nopqrstuvwxyz`, KEY_HEADER]),
    );
    expect(found.map((f) => f.kind)).toEqual(["secret value assigned", "private key"]);
  });

  it("ignores empty assignments, removed lines and the lockfile", () => {
    const text = [
      diff(".env.example", 1, [`${AUTH_SECRET}=`, "DATABASE_URL="]),
      `diff --git a/a.ts b/a.ts\n+++ b/a.ts\n@@ -3 +2,0 @@\n-const t = "${jwt}";`,
      diff("pnpm-lock.yaml", 1, [jwt]),
    ].join("\n");
    expect(scanStagedDiff(text)).toEqual([]);
  });
});

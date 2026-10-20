export type Finding = { file: string; line: number; kind: string };

// Docs may go straight to main; code only arrives by merge.
export function isDocsPath(path: string): boolean {
  return path.startsWith("docs/") || path.startsWith(".scratch/") || path.endsWith(".md");
}

export function codeFilesOnMain(branch: string | null, staged: string[]): string[] {
  if (branch !== "main") return [];
  return staged.filter((path) => !isDocsPath(path));
}

export function isEnvFile(path: string): boolean {
  const name = path.split("/").pop() ?? "";
  return /^\.env(\..+)?$/.test(name) && name !== ".env.example";
}

const PLACEHOLDER = /^(<.*>|password|pass|secret|\*+|\$\{.*\})$/i;

const PATTERNS: { kind: string; test: (line: string) => boolean }[] = [
  {
    kind: "JWT-style token",
    test: (line) => /eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}/.test(line),
  },
  {
    kind: "database URL with a password",
    test: (line) => {
      const match = /postgres(?:ql)?:\/\/[^\s:@/]+:([^\s@/]+)@/i.exec(line);
      return match !== null && !PLACEHOLDER.test(match[1]);
    },
  },
  { kind: "private key", test: (line) => /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(line) },
  { kind: "AWS access key", test: (line) => /AKIA[0-9A-Z]{16}/.test(line) },
  {
    kind: "secret value assigned",
    test: (line) =>
      /(TMDB_API_READ_TOKEN|BETTER_AUTH_SECRET|DATABASE_URL(?:_UNPOOLED)?)\s*[=:]\s*["']?[^\s"'<>]{16,}/.test(
        line,
      ),
  },
];

// Long lines are cut before matching so a huge minified file cannot stall the hook.
const MAX_LINE = 4000;

// Reads `git diff --cached -U0` output and checks only the added lines.
export function scanStagedDiff(diff: string): Finding[] {
  const findings: Finding[] = [];
  let file = "";
  let line = 0;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("+++ ")) {
      file = raw.startsWith("+++ b/") ? raw.slice(6) : "";
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (!raw.startsWith("+") || raw.startsWith("+++")) continue;
    if (file && file !== "pnpm-lock.yaml") {
      const text = raw.slice(1, MAX_LINE + 1);
      for (const pattern of PATTERNS) {
        if (pattern.test(text)) findings.push({ file, line, kind: pattern.kind });
      }
    }
    line += 1;
  }
  return findings;
}

// lint-staged refuses to start on an older Node with an unhelpful error, so the hook checks first.
export function isNodeAtLeast(version: string, minimum: string): boolean {
  const parse = (v: string) => v.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const have = parse(version);
  const need = parse(minimum);
  for (let i = 0; i < 3; i++) {
    const a = have[i] ?? 0;
    const b = need[i] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

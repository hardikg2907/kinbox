import { execFileSync } from "node:child_process";
import { codeFilesOnMain, isEnvFile, scanStagedDiff } from "./checks";

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function fail(lines: string[]): never {
  process.stderr.write(`\n${lines.join("\n")}\n\n`);
  process.exit(1);
}

function currentBranch(): string | null {
  try {
    return git(["symbolic-ref", "--short", "-q", "HEAD"]).trim() || null;
  } catch {
    return null; // detached HEAD, for example during a rebase
  }
}

const branch = currentBranch();
const staged = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"])
  .split("\0")
  .filter(Boolean);

const onMain = codeFilesOnMain(branch, staged);
if (onMain.length > 0) {
  fail([
    "Code lands on main only by merge. These staged files are not docs:",
    ...onMain.map((path) => `  ${path}`),
    "Make a branch and worktree instead (see AGENTS.md, \"Branches and worktrees\"):",
    "  git worktree add ../kinbox-<slug> -b feat/<slug> main",
  ]);
}

const envFiles = staged.filter(isEnvFile);
if (envFiles.length > 0) {
  fail([
    "Env files must never be committed. Unstage them:",
    ...envFiles.map((path) => `  git restore --staged -- ${path}`),
  ]);
}

const findings = scanStagedDiff(git(["diff", "--cached", "--no-color", "-U0", "--diff-filter=ACMR"]));
if (findings.length > 0) {
  // Never echo the matched text: the point is to keep it out of logs too.
  fail([
    "This commit looks like it contains a secret:",
    ...findings.map((f) => `  ${f.file}:${f.line}  ${f.kind}`),
    "Move the value to an env file and reference it by name.",
  ]);
}

const lintable = staged.filter((path) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(path));
if (lintable.length > 0) {
  try {
    execFileSync("pnpm", ["exec", "eslint", "--max-warnings=0", "--", ...lintable], { stdio: "inherit" });
  } catch {
    fail(["ESLint found problems in staged files. `pnpm exec eslint --fix -- <file>` fixes many of them."]);
  }
}

if (staged.some((path) => /\.(ts|tsx)$/.test(path))) {
  try {
    execFileSync("pnpm", ["-s", "typecheck"], { stdio: "inherit" });
  } catch {
    fail(["Type errors. Fix them before you commit."]);
  }
}

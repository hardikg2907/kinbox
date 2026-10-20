import { execFileSync } from "node:child_process";
import { codeFilesOnMain, isEnvFile, isNodeAtLeast, scanStagedDiff } from "./checks";

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

const MIN_NODE = "22.22.1";
if (!isNodeAtLeast(process.versions.node, MIN_NODE)) {
  fail([
    `The commit hook needs Node ${MIN_NODE} or later. This shell runs ${process.versions.node}.`,
    "Open a new terminal (or run `source ~/.zshrc`) so it picks up the newer Node, then commit again.",
  ]);
}

try {
  execFileSync("pnpm", ["exec", "lint-staged"], { stdio: "inherit" });
} catch {
  fail(["Lint or type errors in staged files. Fix what is reported above, then commit again."]);
}

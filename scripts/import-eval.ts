// Runs paste import's reader and matcher over a real list against real TMDB, so the owner can
// confirm that no Found row is wrong before the scoring numbers ship:
//   pnpm import:eval [path]        (default: .local/import-sample.txt)
// The report is printed and also written to import-eval.txt in the list's folder. Keep lists
// and reports out of git: they are private.
import "./load-env";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { stdout } from "node:process";
import { readPastedList, type ImportLine, type SkippedLine } from "@/domain/import-lines";
import { matchLine, type LineMatch, type RankedCandidate } from "@/domain/import-match";
import { createLimit } from "@/lib/limit";
import { createRealTmdbClient, TmdbUnavailableError } from "@/lib/tmdb/real";
import type { SearchResult } from "@/lib/tmdb/types";

const DEFAULT_LIST = ".local/import-sample.txt";
const REPORT_NAME = "import-eval.txt";
// The same limit the match route uses, so TMDB sees the load an Import would send.
const MAX_PARALLEL_SEARCHES = 4;
const PASTED_WIDTH = 40;
const MATCH_WIDTH = 46;
const TMDB_DOWN =
  "TMDB could not be reached. On the home network this usually means the Mac is not using a public DNS.";

type Row = { line: ImportLine; match: LineMatch<SearchResult> | null };

async function main(): Promise<void> {
  const listPath = path.resolve(process.argv[2] ?? DEFAULT_LIST);
  const { lines, skipped } = readPastedList(await readFile(listPath, "utf8"));
  const client = createRealTmdbClient({ token: process.env.TMDB_API_READ_TOKEN ?? "" });

  const limit = createLimit(MAX_PARALLEL_SEARCHES);
  const searches = new Map<string, Promise<SearchResult[]>>();
  // Keyed and sent the way the cached search in the app sends it, so a repeated line costs one search.
  const search = (text: string): Promise<SearchResult[]> => {
    const key = text.trim().replace(/\s+/g, " ").toLowerCase();
    let pending = searches.get(key);
    if (!pending) {
      pending = limit(() => client.searchMulti(key));
      searches.set(key, pending);
    }
    return pending;
  };

  const rows = await Promise.all(
    lines.map(async (line): Promise<Row> => {
      try {
        return { line, match: await matchLine(line, search) };
      } catch (error) {
        if (error instanceof TmdbUnavailableError) return { line, match: null };
        throw error;
      }
    }),
  );

  if (rows.length > 0 && rows.every((row) => row.match === null)) {
    stdout.write(`${TMDB_DOWN}\n`);
    process.exitCode = 1;
    return;
  }

  const report = formatReport(listPath, rows, skipped);
  stdout.write(report);
  const reportPath = path.join(path.dirname(listPath), REPORT_NAME);
  await writeFile(reportPath, report);
  stdout.write(`\nReport written to ${reportPath}\n`);
}

function formatReport(listPath: string, rows: Row[], skipped: SkippedLine[]): string {
  const found = rows.filter((row) => row.match?.result === "found");
  const check = rows.filter((row) => row.match?.result === "check");
  const notFound = rows.filter((row) => row.match?.result === "not_found");
  const failed = rows.filter((row) => row.match === null);

  const out: string[] = [
    `Import evaluation of ${listPath}`,
    "",
    count("Found", found.length),
    count("Check", check.length),
    count("Not found", notFound.length),
    count("Error", failed.length),
    count("Skipped", skipped.length),
    "",
    `FOUND (${found.length}): every one of these is added without a question. Confirm that none is wrong.`,
    `  line  ${fit("pasted", PASTED_WIDTH)}  ${fit("Match", MATCH_WIDTH)}  name  popularity`,
  ];
  for (const row of found) {
    const best = row.match!.candidates[0];
    const via = row.match!.fromAltQuery ? `  via "${row.line.altQuery}"` : "";
    out.push(
      `  ${lineNumber(row.line.position)}  ${fit(row.line.original, PASTED_WIDTH)}  ${fit(describe(best.title), MATCH_WIDTH)}  ${score(best.nameScore)}  ${popularity(best.title)}${via}`,
    );
  }

  out.push("", `CHECK (${check.length}): the first candidate is added unless the Owner changes it.`);
  for (const row of check) {
    out.push(`  ${lineNumber(row.line.position)}  ${row.line.original}${hints(row.line)}`);
    row.match!.candidates.forEach((candidate, index) => out.push(candidateLine(index, candidate)));
  }

  out.push("", `NOT FOUND (${notFound.length}): nothing is added unless the Owner picks a Title.`);
  for (const row of notFound) {
    const best = row.match!.candidates[0];
    const nearest = best ? `  nearest: ${describe(best.title)}  name ${score(best.nameScore)}` : "  no results";
    out.push(`  ${lineNumber(row.line.position)}  ${row.line.original}${hints(row.line)}${nearest}`);
  }

  out.push("", `ERROR (${failed.length}): TMDB could not be searched for these lines.`);
  for (const row of failed) out.push(`  ${lineNumber(row.line.position)}  ${row.line.original}`);

  out.push("", `SKIPPED (${skipped.length})`);
  for (const line of skipped) {
    out.push(`  ${lineNumber(line.position)}  ${line.original}  (${line.reason === "too_long" ? "too long" : "not a title"})`);
  }
  return `${out.join("\n")}\n`;
}

function count(label: string, value: number): string {
  return `  ${label.padEnd(10)}${String(value).padStart(5)}`;
}

function lineNumber(position: number): string {
  return String(position + 1).padStart(4);
}

function score(value: number): string {
  return value.toFixed(2);
}

function describe(title: SearchResult): string {
  const original =
    title.originalName !== null && title.originalName !== title.name ? ` (${title.originalName})` : "";
  return `${title.name}${original} · ${title.year ?? "no year"} · ${title.kind}`;
}

function hints(line: ImportLine): string {
  const parts = [line.kind, line.year, line.several ? "several titles" : undefined, line.altQuery && `alt "${line.altQuery}"`];
  const shown = parts.filter((part) => part !== undefined && part !== "");
  return shown.length > 0 ? `   [${shown.join(", ")}]` : "";
}

function candidateLine(index: number, candidate: RankedCandidate<SearchResult>): string {
  const against = candidate.hintAgainst ? "  hint against" : "";
  return `          ${index + 1}. ${fit(describe(candidate.title), MATCH_WIDTH)}  name ${score(candidate.nameScore)}  score ${score(candidate.score)}  popularity ${popularity(candidate.title)}${against}`;
}

function popularity(title: SearchResult): string {
  return title.popularity.toFixed(1).padStart(10);
}

// Pads or cuts by code point, so an emoji or a mark is never split in half.
function fit(text: string, width: number): string {
  const characters = Array.from(text);
  if (characters.length > width) return `${characters.slice(0, width - 1).join("")}…`;
  return text + " ".repeat(width - characters.length);
}

main().catch((error: unknown) => {
  // Messages here come from reading the file or from the TMDB client, which never puts the token in one.
  process.stderr.write(`${error instanceof Error ? error.message : "Something went wrong."}\n`);
  process.exitCode = 1;
});

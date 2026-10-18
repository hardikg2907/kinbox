# Paste import

An Owner pastes a list they already keep somewhere else (a Google Keep note, a notes app, a chat message) and Kinbox turns it into Entries. It is the fastest way to move an existing list into Kinbox. File import (Letterboxd, IMDb, Trakt exports) stays in [future scope](future-scope.md).

Terms follow [CONTEXT.md](../CONTEXT.md) (Import, Import line, Watched mark, Match). Product decisions behind this spec are rows 20-28 in [decisions-v0.1.md](decisions-v0.1.md).

## The lists it is built for

The owner's real list is a Google Keep note copied as plain text. Its shape, which the reader and the tests copy (the note itself never goes into git):

- About 250 lines in two sections: a heading `Tv - ` with about 45 Series, then `Movies- ` with about 200 Movies, with blank lines between groups.
- No Keep checkboxes. A watched Title has a typed mark at the end: `✔` or `✔️`, with or without a space before it. Some lines have two marks or a mark inside brackets.
- No episode places (`S2E4`).
- Hints in brackets: a year (`Name(2002)`, `Name (1988)`), a kind (`Name (series)`), a language (`(malayalam)`), another name for the same Title (`Um Dia(One Day)`).
- Lines that name several Titles: `Name 1 and 2`, `Name 1/2`, `Name (all parts)`, `Name trilogy`, `Name, Name 2`, `Name/ Other name`, `All <franchise> movies`.
- Lines that are not Titles: a URL, `More <director> movies`.
- Short forms (`ZNMD`, `FF9`), typos and odd spacing (`West world`, `Old boy`, `Dont`), missing articles (`Simpsons`), a trailing comma.
- Repeats, sometimes with different marks (`Name✔` and later `Name`).
- Lines under the wrong heading (a Movie under `Tv -`), and names that exist as both a Movie and a Series.

## Flow

One page, `/import`, in three steps. It is reached from the account menu ("Import a list") and from an empty Library ("Have a list somewhere? Paste it").

### 1. Paste
- One large text box. Helper: "One title per line. Put ✔ after the ones you've watched."
- Below it, a live count: "248 titles", plus "3 lines skipped" when the reader skips any.
- The pasted text stays on the device (`localStorage`) until the import finishes or is undone, so a reload loses nothing. Choices made in the Check step are not kept; a reload checks the list again, which is fast because searches are cached.
- Limits: 500 Import lines and 50,000 characters per paste. A line longer than 200 characters is skipped as "Too long".
- Button: "Check list".

### 2. Check
- Kinbox finds a Match for every Import line, about 10 lines per request, and shows "Checking 120 of 248".
- Each line gets one result:
  - **Found**: one clear Match.
  - **Check this**: a weak Match, two Titles with the same name, or a line that names several Titles. Kinbox pre-selects its best guess, and the guess is added unless the Owner changes or skips it.
  - **Not found**: nothing good enough. Nothing is pre-selected; the line is not added unless the Owner picks a Title.
  - **Couldn't check**: TMDB failed for this line. "Try again" checks it again.
- Order on screen: "Check these" first, then "Not found", then "Couldn't check", then one folded line "198 look right" that opens to show the Found rows. Each group keeps the order of the paste.
- Each row shows the Match's poster, name, year and kind, the original line in small text under it, and what the Title will become ("To watch", "Watched"). For a Series marked as watched, the helper says "Ticks all aired episodes".
- Tapping a row's poster or name opens a sheet: the top 3 candidates, a search field to find another Title, and "Skip this line". One tap on a Title picks it and closes the sheet. A skipped row shows "Skipped" with "Include".
- Each row has two status pills, "To watch" and "Watched", in the save-button style; the chosen one is filled.
- A Match already in the Library shows "Already in your library" and is never added or changed.
- When two Import lines get the same Match, they merge into one row. The row is "Watched" if either line was marked.
- After checking ends, the bar at the bottom shows "Add 238 titles".

### 3. Add
- Kinbox adds about 5 Titles per request and shows "Adding 120 of 238". Each Title is added on its own, so one failure never blocks the rest.
- Titles are added from the bottom of the paste to the top. The Library shows the newest first, so the Library then shows them in the order of the note.
- Leaving the page while adding asks the browser to confirm. Titles already added stay.
- The result screen:
  - "Added 236 titles" and a breakdown: "180 to watch, 50 watched, 6 caught up".
  - "2 couldn't be added", with their names and "Try again".
  - "Copy the 14 lines not added": puts every line that was not added (Not found, skipped, failed, too long, not a title) on the clipboard, one per line, so the Owner can keep them in Keep.
  - "Undo this import", then "Go to library".
- **Undo this import** asks first: "Remove the 236 titles this import added?" with the body "Titles you've changed since stay in your library." and the buttons "Remove them" and "Cancel". Then: "Removed 234 titles. Kept 2 you changed."

## Reading the lines

`readPastedList(text)` in `src/domain/import-lines.ts` is a pure function. It runs in the browser, so the count is instant; the server never trusts its output beyond the strict request schema.

For each line, in this order:

1. Unicode NFC, then remove the emoji presentation selector (U+FE0F) and zero-width characters. Trim.
2. Blank line: ignored. A line over 200 characters: skipped as "Too long". A line that is a URL (`http://`, `https://`, `www.`): skipped as "Not a title".
3. **Heading**: after removing a trailing `:`, `-` or `–` and spaces, the whole line is one known heading word. It sets a hint for the lines under it, until the next heading.
   - Kind: `tv`, `tv shows`, `shows`, `series`, `web series`, `anime` → Series; `movies`, `movie`, `films`, `film` → Movie.
   - Status: `to watch`, `watchlist`, `want to watch` → To watch; `watching`, `currently watching` → Watching; `watched`, `seen`, `done` → Watched; `dropped` → Dropped.
   - A line ending in `:` that is not a known word is ignored. A line such as `Name- subtitle` is a Title, because the text before the dash is not a heading word.
4. **Watched marks**: any of `✔ ✓ ☑ ✅ [x] [X]` anywhere in the line makes it Watched. An empty box (`☐`, `[ ]`) makes it To watch. All marks and boxes, a stray `X` or `x` directly after a mark, and leading bullets or numbering (`-`, `*`, `•`, `1.`, `1)`) are removed.
5. **Bracket groups** (`(...)`, `[...]`) are removed from the search text:
   - A year from 1874 to the current year + 5 is the year hint.
   - `series`, `tv`, `show`, `movie`, `film` is the kind hint. It wins over the heading's kind.
   - Other text with a word of 3 or more letters, which is not itself a several-Titles pattern, becomes the alternate search text (the first such group only). `(One Day)` qualifies; `(1 and 2)` and `(all parts)` do not.
   - A year at the end without brackets (`Name 2010`) is also the year hint, unless the whole line is a year.
6. **Several Titles**: a line with ` and <digit>`, `<digit>/<digit>`, `/`, `, ` between words, `(all parts)` or `trilogy`, or that starts with `all ` or `more ` and ends with `movies`, `films`, `parts` or `series`, is flagged as several Titles. `All the old knives` stays one Title. It is never split; its result is at best "Check this".
7. Trailing `,`, `.` and `;` are removed. The search text is capped at 100 characters (the search cache's key limit).

The Status a line asks for: its own Watched mark or empty box, else the heading's Status, else To watch.

Output per Import line: `{ id, original, query, altQuery?, year?, kind?, intent, several }`, where `id` is the line's position in the paste and `intent` is `to_watch | watching | watched | dropped`. Skipped lines come back with their reason (`too_long | not_a_title`).

## Matching

### TMDB data it needs
`SearchResult` today has only kind, id, name, year and poster (`src/lib/tmdb/types.ts`). Matching adds three fields from the same `/search/multi` response, in `mapSearchResponse` (`src/lib/tmdb/schemas.ts`): `originalName` (`original_title` / `original_name`), `popularity`, and `releaseDate` (`release_date` / `first_air_date`, null when missing). `MovieDetails` and `SeriesDetails` get `releaseDate` too. Nothing new is stored in the database.

### Scoring
`rankMatches(line, results)` in `src/domain/import-match.ts` is a pure function. Names are compared after this normalising: NFKD without accents, lower case, `&` → `and`, apostrophes removed, other punctuation → space, spaces collapsed, a leading `the`, `a` or `an` removed. The compact form also removes the spaces (`West world` = `Westworld`).

For each search result, using the better of its name and original name:
- **Name score**: 1 when the normalised or compact forms are equal; otherwise the Dice coefficient of the compact forms' character pairs (0 to 1).
- **Kind hint**: +0.15 when it agrees, −0.15 when it does not. A hint never removes a result, so a Movie under `Tv -` can still match.
- **Year hint**: +0.1 within one year, −0.3 further off.
- **Popularity**: up to +0.05 (`0.05 × log10(1 + popularity) / 3`, capped). It only breaks ties; it never beats a better name.

Results:
- **Not found**: no result has a name score of at least 0.6.
- **Found**: the best result has name score 1, no hint against it, the line is not flagged as several Titles, and no other result with name score 1 and no hint against it has more than a third of its popularity.
- **Check this**: every other case. The 3 best results are the candidates.

When the main search text gives no Found result and the line has an alternate search text, that text is searched too. Its results are scored against the alternate text, and they replace the main results only when they reach Found. Otherwise the main results stand.

The numbers are starting values. The evaluation script (build step 3) tunes them against the owner's real note. The aim: no wrong Match among Found rows, and as few Check this rows as that allows.

### Requests
- `POST /api/import/match`, a route handler with the same shape as `src/app/api/search/route.ts`. Matching is a read, so it is not a Server Action: `runAction` calls `refresh()` after every call, and 25 match requests would re-render the page 25 times.
- Body (strict Zod): `{ lines: [{ id: 0..499, query: 1..100 chars, altQuery?: 1..100 chars, year?: int, kind?: "movie" | "series", several: boolean }] }`, 1 to 10 lines. The body is read with a 16 KB cap before parsing.
- `getOwner()`; no session gives 401. The handler calls `matchImportLines(owner, lines)` in `src/data/import.ts`.
- Searches go through the cached `searchTitles` (`src/lib/tmdb/cached.ts`), so a repeat or a re-check costs no TMDB call. At most 4 lines are searched at once. One database read per request marks which candidates are already in the Library.
- Response: `{ lines: [{ id, result: "found" | "check" | "not_found" | "error", candidates: [{ kind, tmdbId, name, year, posterPath, inLibrary }] }] }`, with at most 3 candidates, best first. A line whose TMDB search failed comes back as `error`; the other lines in the request still return.
- The browser sends one request at a time. After two requests in a row fail completely, it stops and shows the TMDB-down message with "Try again", which continues from the first unchecked line.

### TMDB limits
- TMDB allows about 40 requests per second per IP. One import sends at most 4 at once, well under that.
- A 429 is retried in the request helper in `src/lib/tmdb/real.ts`, inside the cached call: up to 2 retries, waiting `Retry-After` (at most 2 s) or 300 ms × 2ⁿ with jitter. Only the final result reaches `settle`, which caches a failure for seconds; a retry outside the cache would read that cached failure.
- A small concurrency limiter (`src/lib/limit.ts`, no dependency) caps the 4 parallel searches and the 4 parallel detail loads in adding.

### Time limits
Vercel Hobby functions with Fluid Compute run up to 300 s, which is also the default. The worst match request (10 lines, 4 at once, each search up to 3 tries of 8 s) stays under 100 s; a normal one takes 1-3 s. No `maxDuration` export is needed.

## Adding

### What gets saved
`statusOnImport(intent, title, today)` in `src/domain/status.ts` decides each Title:

| Intent | Title | Status | Watch | Ticks |
|---|---|---|---|---|
| any | not out yet | To watch | none | none |
| To watch | any | To watch | none | none |
| Watching | any | Watching | none | none |
| Dropped | any | Dropped | none | none |
| Watched | Movie | Watched | date unknown | none |
| Watched | finished Series | Watched | date unknown | all aired Episodes of the numbered Seasons |
| Watched | unfinished Series | Watching ("Caught up") | none | all aired Episodes of the numbered Seasons |
| Watched | Series with no aired Episode | To watch | none | none |

- "Finished" is TMDB status Ended or Canceled, as everywhere in Kinbox. Specials are never ticked (decision 7).
- "Not out yet" is `isOutYet(releaseDate, today)` in `src/domain/release.ts`: true when the release date is after today. A missing date counts as out. Saving one Title uses the same function when it adopts decision 15.
- The browser sends only the intent. The server loads the Title's details and decides the Status itself.

### Requests
Server Actions in `src/actions/import.ts`, each through `runAction` (session, strict schema, one `data/` call):

- `startImport()` → `{ importId }`. In one transaction it closes any open Import of this Owner and opens a new one, so one Import runs at a time per Owner.
- `addToImport({ importId, rows })`, with 1 to 5 rows of `{ kind, tmdbId, intent }`. It fails with "This import has finished. Start a new one." when the Import is closed or belongs to someone else.
- `finishImport({ importId })` closes the Import.
- `undoImport({ importId })` → `{ removed, kept }`.

`addToImport` calls `addImportRows(owner, importId, rows)` in `src/data/import.ts`. Per row:
1. Load the Title snapshot (`ensureTitle`, cached details). For a Series that needs ticks, load its Episodes (`loadSeriesEpisodes`). Up to 4 rows load at once.
2. In one `db().transaction` per Title, in the order given, insert the Entry with `import_id`, its Status, its Watch and its ticks. This is the insert half of `saveTitle`, moved into a shared `insertNewEntry(tx, …)` in `src/data/entries.ts` that both use.
3. Return `added` (with the final Status), `already` (the Entry existed; nothing changes) or `failed` (TMDB down, Title gone, any error). A failure is logged by error name only, never with the pasted text.

### Undo this import
Schema change (one migration):
- New table `imports`: `id uuid`, `user_id` (references `user`, cascade), `created_at`, `finished_at` (null while open). A partial unique index on `user_id` where `finished_at is null`.
- New column `entries.import_id` (nullable, references `imports`, on delete set null), with an index.

Postgres fixes `now()` for a whole transaction, so an Entry inserted by an import has `created_at = status_changed_at`, and `progress_moved_at` is null or the same value. Any later change happens in another transaction and moves a stamp. An imported Entry counts as **unchanged** when:
- `status_changed_at = created_at`,
- `progress_moved_at` is null or equals `created_at`,
- `rating_half_stars` and `note` are null,
- no Watch has `created_at` later than the Entry's.

`undoImport` deletes, in one transaction, the Owner's Entries with this `import_id` that are unchanged (Watches and ticks cascade), and closes the Import. Titles snapshots stay. When a later Undo of a Status move restores the old stamps, the Entry counts as unchanged again, which is correct.

## Screens

The import page sits outside the dock: a focused full page with a top bar (close button back to the Library, title "Import a list") and an action bar pinned at the bottom, in thumb reach. On desktop it is a centred column of about 640 px. Its look is set in `docs/design.md`, section "Import a list"; this spec owns the flow, rules and words.

| Part | Exists in the dock design | New |
|---|---|---|
| Glass sheet, Close, focus trap | yes | |
| Search field at the bottom of a sheet, result rows (w92 poster, name, year, kind) | yes, in the search sheet | a "pick" variant: one tap picks a Title instead of the three save buttons |
| Toasts | yes (`showActionToast`) | |
| Full page with a top bar and a bottom action bar | the action bar takes the dock's shape | yes |
| Match row: poster, name, year, kind, the original line, To watch and Watched pills | the pills are the save buttons | yes |
| Folded group "198 look right" | opens in place like a Season row | yes |
| Progress line with a thin bar | the progress line on the Title page is close | yes |

Entry points:
- Account menu: "Import a list", between About and Sign out.
- Empty Library (no Entries at all): under the To watch empty text, the link "Have a list somewhere? Paste it".

Words:

| Thing | Screen words |
|---|---|
| Page title | Import a list |
| Text box label | Paste your list |
| Text box helper | One title per line. Put ✔ after the ones you've watched. |
| Count | 248 titles / 3 lines skipped (second line, only when some are skipped) |
| Limit reached | Up to 500 lines at a time. Paste the rest after this import. |
| Check button | Check list |
| Progress | Checking 120 of 248 / Adding 120 of 238 |
| Groups | Check these / Not found / Couldn't check / 198 look right |
| Row helpers | Already in your library / Skipped / Too long / Not a title / Ticks all aired episodes |
| Pick sheet | Pick the right title / Search / Skip this line |
| Row buttons | Include / Try again |
| Add button | Add 238 titles |
| Result | Added 236 titles / 180 to watch, 50 watched, 6 caught up / 2 couldn't be added |
| Copy | Copy the 14 lines not added → toast "Copied" |
| Undo | Undo this import → dialog "Remove the 236 titles this import added?" body "Titles you've changed since stay in your library." buttons "Remove them" / "Cancel" → toast "Removed 234 titles. Kept 2 you changed." |
| Closed import | This import has finished. Start a new one. |
| TMDB down | Can't reach the movie database right now. Try again in a minute. |

## Security

- **Session and ownership.** The match route calls `getOwner()` and returns 401 without a session. Every action goes through `runAction`. Every query in `src/data/import.ts` filters by `owner.id`; an `importId` from the browser is only used together with `user_id = owner.id`.
- **Strict input.** Every body is a Zod `.strictObject`. Caps per request: 10 lines, 100 characters per search text, 5 rows, positive integer TMDB ids, a 16 KB body. The 500-line and 50,000-character limits are browser checks; the per-request caps bound what one request can cost.
- **Cross-site requests.** The match route accepts only `Content-Type: application/json`, so a cross-site form cannot send it, and Better Auth's `SameSite=Lax` cookie is not sent on a cross-site POST. Server Actions keep Next.js's origin check.
- **TMDB quota.** One Import searches at most 4 lines at once, and repeats come from the cache. Sign-up is closed, so per-Owner quotas stay in [future scope](future-scope.md) with the other abuse limits.
- **Private text.** Pasted text is never logged and never stored on the server; it lives only in the Owner's browser. The rendered lines are plain text (no links, no HTML). The device copy is cleared when the import finishes or is undone.

## Build steps

All work happens on the integration branch `feat/paste-import` (from `main`), in its own worktree, as `AGENTS.md` ("Branches and worktrees") describes. Each step is a branch off `feat/paste-import` with its own worktree, merged back after `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass. Steps 1-3 touch no screens and no file the design branch changes, so they can start before the design merge. Steps 4-6 wait until the design (with Undo for every Status move) is on `main`; then `feat/paste-import` rebases onto `main`. Merging `feat/paste-import` into `main` needs the owner's approval. The git hooks run lint and typecheck on every commit and the tests (under the test lock) on every push, so each step commits only green work.

```
before the design merge          after the design merge
1 reader ──┐
           ├─> 3 matching + eval ──┐
2 TMDB ────┤                       ├─> 6 screens ─> 7 owner check ─> merge to main
           └──────────────> 4 adding ─> 5 undo ─┘
```

1. **Line reader** (`feat/import-reader`). `src/domain/import-lines.ts` with `readPastedList`.
   - Tests: every rule above, with made-up lines in the shapes of "The lists it is built for": both heading styles, `✔` and `✔️` with and without spaces, two marks, a mark inside brackets, `Name(2002)`, `(series)` under a Movies heading, an alternate name in brackets, `(1 and 2)` giving no alternate text, each several-Titles pattern, a title that starts with `All the` and is not flagged, a URL, a 201-character line, `Name- subtitle`, blank lines, bullets, Keep checkboxes `☐`/`☑`.
   - Done when the tests pass and no real note text is in the repo.
2. **TMDB data and retries** (`feat/import-tmdb`). `originalName`, `popularity`, `releaseDate` on `SearchResult`; `releaseDate` on `MovieDetails` and `SeriesDetails`; the 429 retry in `real.ts`; `src/lib/limit.ts`; the fake client and fixtures updated.
   - Tests: mapping with nulls; a 429 then 200 succeeds; three 429s throw `TmdbUnavailableError` with status 429; `Retry-After` is capped; the limiter never runs more than its limit.
   - Done when existing search and save tests still pass unchanged.
3. **Matching and its evaluation** (`feat/import-match`). `rankMatches` in `src/domain/import-match.ts`, `matchImportLines` in `src/data/import.ts`, `POST /api/import/match`, and `scripts/import-eval.ts`.
   - Tests: scoring cases (exact, compact, article, typo, both kinds, year agreeing and against, two exact names with close and far popularity, several-Titles lines never Found, the 0.6 floor, alternate text); the route's 401, 400 on an extra key or 11 lines or a large body, a TMDB failure on one line only; candidates marked `inLibrary` only for the right Owner.
   - The eval script reads a note from `.local/import-sample.txt` (add `/.local/` to `.gitignore` in this step), runs the reader and matcher against real TMDB, and prints each line with its result and best candidate. TMDB calls fail on the owner's home network unless the Mac uses a public DNS (see `AGENTS.md`).
   - Done when the owner has run the script on their note and confirmed: no wrong Match among Found rows.
4. **Adding** (`feat/import-add`). It changes `saveTitle` in `src/data/entries.ts`, which the Undo work on `design/dock` also edits, so it starts after the design merge. The migration (`pnpm db:generate`, `pnpm db:migrate`), `statusOnImport` and `isOutYet`, `insertNewEntry` shared with `saveTitle`, `startImport`, `addImportRows`, `finishImport`, and the actions.
   - Tests: every row of the "What gets saved" table; `import_id` set; a Title already in the Library returns `already` and is unchanged; one failing row does not stop the others; rows insert in the given order; a second `startImport` closes the first and `addToImport` on it fails; another Owner's `importId` fails; all existing `saveTitle` tests pass unchanged.
5. **Undo this import** (`feat/import-undo`). `undoImport` data and action.
   - Tests: removes unchanged Entries with their Watches and ticks; keeps an Entry with a Status move, a tick, an untick, a Rating, a Note or a new Watch; counts are right; leaves Entries from other Imports and saved by hand; another Owner's `importId` removes nothing.
6. **Screens** (`feat/import-screens`, after the design merge). `/import` with the three steps, the device copy of the text, the pick sheet, the result screen, Copy, and the two entry points.
   - Checks: the flow at 375 px and on desktop in light and dark; every control reachable by keyboard and labelled; the pick sheet traps and returns focus; a reload in the Check step keeps the text; leaving while adding asks first.
   - Screenshots at 375 px come from headless Chrome over CDP, not Claude-in-Chrome.
7. **Owner check.** The owner imports their real note into the local database on `feat/paste-import`, then reviews the result. After that, `feat/paste-import` merges into `main` with the owner's approval, and the owner imports into production after creating their account.

## Open questions

- How should the Library show a Movie that is not out yet and was imported as To watch? Decision 15 sets the labels; they ship with the "not out yet" step, after paste import.

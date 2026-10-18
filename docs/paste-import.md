# Paste import

An Owner pastes a list they already keep somewhere else (a Google Keep note, a notes app, a chat message) and Kinbox turns it into Entries. It is the fastest way to move an existing list into Kinbox. File import (Letterboxd, IMDb, Trakt exports) stays in [future scope](future-scope.md).

Terms follow [CONTEXT.md](../CONTEXT.md). Screen words come from `ux-writing` and must make sense in 2 seconds.

## Flow

Three steps on one page, `/import`, reached from the account menu and from the empty Library ("Have a list somewhere? Paste it").

### 1. Paste
- One large text box: one Title per line.
- A choice for the whole paste: **To watch** (default) or **Watched**. Lines can override it (see Reading the lines).
- The pasted text is kept on the device until the import finishes, so a reload loses nothing.
- Limits: 500 lines and 50,000 characters per paste; a line longer than 200 characters is skipped as "Too long".

### 2. Check
- Kinbox finds a TMDB match for every line and shows a list: the original line, then the matched poster, name, year and Movie or Series, the Status it will get, and for a Series the place ("Next: S3 E3").
- Each row is marked **Found**, **Check this** (more than one good match, or a weak one) or **Not found**.
- For each row the Owner can pick another match (the top 3 are offered, plus a search), change the Status, change the Series place, or skip the row.
- A Title already in the Library shows "Already in your Library" and is skipped. An import never changes an existing Entry.
- Matching shows progress ("Checking 120 of 300") and works in small batches, so a long list never hits a server time limit.

### 3. Add
- One button: "Add 47 titles".
- Each Title is added on its own, so one failure never blocks the rest. The result says what happened: "Added 45. 2 couldn't be added", with the 2 listed and a retry.
- **Undo this import** stays on the result screen. It removes the Entries this import created that have not been changed since.

## Reading the lines

The reader is a pure function with tests built from real pasted notes.

- Blank lines and repeated lines are ignored.
- Bullets and numbering are removed: `-`, `*`, `•`, `1.`, `1)`.
- Checkboxes set the Status for that line: `☑ ✓ ✔ [x] - [x]` → Watched; `☐ [ ] - [ ]` → To watch.
- A year in brackets or at the end (`Inception (2010)`, `Inception 2010`) narrows the match. It is removed from the search text.
- A Series place (`S3E2`, `S03E02`, `S3 E2`, `s3 ep2`, `season 3 episode 2`, `3x02`) means **the last Episode watched**, the way people note "till which episode". The Title becomes Watching, and its Next is the Episode after it. Earlier Episodes of the numbered Seasons are ticked, never Specials (decision 7).
- A line ending in `:` is a heading. Headings that name a kind (movies, films, series, shows, tv, anime) or a Status (to watch, watchlist, watching, watched, seen, dropped) apply to the lines under them, until the next heading. Other headings are ignored.
- Text is not split on dashes: many titles contain them.

## What gets saved

The same rules as saving one Title (see [v0.1 scope](v0.1-scope.md)):
- Watched adds a Watch dated "date unknown". A Series marked Watched ticks all aired Episodes of the numbered Seasons.
- A Series with a place gets ticks up to that Episode and the Status Watching.
- A Title not out yet is saved as To watch, whatever the line says (decision 15).

## Limits and safety

- Signed-in Owners only. One import runs at a time per Owner.
- TMDB calls run a few at a time and reuse the search cache. A TMDB refusal (429) is retried with backoff; a row that still fails shows "Couldn't check. Try again."
- All input goes through a strict schema. Matching and adding are Server Actions that check the session and ownership, like every other action.

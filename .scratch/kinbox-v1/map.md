# Kinbox v1

Label: wayfinder:map

## Destination

Every decision `/to-spec` needs for Kinbox v1 is closed on this map: product behaviour, data model, sign-in, movie database, stack and hosting. `/to-spec` can then write the v1 spec with no interview, and `/to-tickets` can slice it.

## Notes

- **Product.** A free, public web app for fans who watch and log both movies and series. Today they split them across apps (Letterboxd for movies, which still has no Series; Serializd for series), use an all-in-one tracker (Trakt, Simkl) that is heavy and puts core parts behind a paid tier, or keep them in a notes app (the owner used Google Keep). TV Time shut down on 2026-07-15. Kinbox keeps both in one place, with a to-watch list you can filter for tonight. Clean and minimal design.
- **Main user.** A fan who logs everything they watch (Letterboxd-style). Pains, worst first: slow capture; can't choose what to watch tonight; lists in many places; losing your place in a series. "Forgetting why I saved it" is not a target pain.
- **Standing decisions.**
  - Mobile-first web. The phone browser is the main place to save; the desktop is a bigger view of the same thing.
  - v1 is a real log: a watched Title records a watch date, and a Title can be added straight as watched.
  - "Recommended by" stays as a small, optional touch with a filter. It is a nice moment, not a core pain fix.
  - A Title is anything the movie database lists as a movie or a TV show (incl. anime, miniseries, documentaries, specials).
  - Free in v1, money later is possible. Every third-party choice checks its commercial-use terms.
- **Plain words on screen.** Every label and action must make sense to a user in 2 seconds. Glossary terms (Entry, Watch, Status) are for planning and code, not screen copy. Prototype tickets pick the words, using `ux-writing`.
- **v0.1 ships first.** A usable single-Owner version is cut in [v0.1 scope](../../docs/v0.1-scope.md) and built now, while this map continues toward v1. Its stack is Next.js, Postgres (Neon), Drizzle, Better Auth and Vercel; the owner does not want Elixir for Kinbox.
- **Builder.** One developer. [Stack and hosting](issues/12-stack-and-hosting.md) confirms or changes the v0.1 stack for the public launch. Prototypes stay framework-free.
- **Skills.** By ticket type: grilling → `grilling` + `domain-modeling`; prototype → `prototype`; research → `research`. These stack-neutral skills join where they fit:
  - [Scope check after research](issues/15-scope-check-after-research.md): `feature-prioritization-assistant` (RICE), `opportunity-solution-trees`.
  - [Data model](issues/11-data-model.md): `codebase-design` (deep modules, seams), then `llm-council` to pressure-test it.
  - [Stack and hosting](issues/12-stack-and-hosting.md): `llm-council`.
  - UI prototypes ([Add-a-title flow](issues/08-add-a-title-flow.md), [Library view and filters](issues/09-library-view-and-filters.md), [Series progress screen](issues/20-series-progress-screen.md)): `frontend-design`, `ui-ux-pro-max`, `ux-writing`; `a11y-audit` and `design-review` on the result.
  - [Sign-up and sign-in](issues/10-sign-up-and-sign-in.md) and share links: `secure-coding-enforcer`.
  - Stack-specific skills (database, framework) join only after Stack and hosting decides; install any that are missing then. Until then, tickets stay product-level and are not bound by technical choices.
- **Future scope.** Every idea ruled out of v1 goes into `docs/future-scope.md` the moment it comes up, so nothing is lost.
- **Glossary.** `CONTEXT.md` at the project root. Use its terms in every ticket and answer.
- **Tracker.** Local markdown. One file per ticket in `issues/` with `Type:`, `Status:` (open / claimed / resolved) and `Blocked by:` lines. Research findings go in `research/<slug>.md` (no git repo yet, so no research branches).

## Decisions so far

<!-- one line per closed ticket: [title](link): gist -->

- [Competitor scan](issues/13-competitor-scan.md): no app leaves the middle empty: Trakt and Simkl track both, but they are heavy and paywall rewatch, filters, lists. Letterboxd may still add Series (a live risk). Gaps to own: a "tonight" filter, fast phone capture, no paywall on core logging, private by default.
- [Market voice research](issues/14-market-voice-research.md): "movies and series split across apps" is a strong pain; scattered lists, choosing tonight and losing your place are weaker. Top wishes: free with no forced account, both in one place, few-tap logging, reliable series progress, to-watch filters. Reddit was not reachable, so it is not covered.
- [Movie database API](issues/04-movie-database-api.md): TMDB (combined search, episode lists, posters; fallback TheTVDB for anime episode order). Free non-commercial; any revenue incl. ads needs a paid agreement (~$149/month quoted). Stored data may be kept 6 months at most. Posters are hot-linked, not copied. A TMDB logo and notice are required.
- [Sharing in v1](issues/01-sharing-in-v1.md): private by default, one Owner per Library. An optional Profile (off by default, with switches) and public Lists; any List can have a secret, read-only Share link. Notes and "recommended by" are never shown. Sharing needs an account; Guests are local-only.
- [Statuses and watches](issues/02-statuses-and-watches.md): one Entry per Title; Statuses To watch / Watching / Watched / Dropped for both kinds; each Watch is a separate dated record, so rewatches are free; Watched and Watches always agree; dates default quietly (today, or "date unknown" for back-logging).
- [Lists, tags and order](issues/03-lists-tags-and-order.md): Lists with no visible limits, a name and optional description, the Owner's own drag order; Pins put To watch Entries on top; no tags in v1.
- [Series progress](issues/05-series-progress.md): per-Episode ticks behind a one-tap "Next: S2 E4" line, with an "also mark earlier episodes?" offer and a whole-season tick. Caught up stays Watching; progress moves a Series to Watched only once the movie database says it ended (one-tap Watched always works). Specials never block finishing. Broadcast order only, no episode dates, Series-only ratings. A rewatch restarts progress.

## Not yet specified

- **The entry page.** The full view of one saved Title: poster, details, status, progress, note, rating. It builds on the Series progress screen. Graduates once notes/ratings close and that prototype is done.
- **Account basics.** Delete my account, export my data, privacy text. Waits for sharing and sign-in.
- **First run.** The empty Library and the first save. Waits for the add-a-title prototype.
- **Admin tools.** What v1 needs to handle reports and hide a Profile or a Share link. The owner wants this decided near the end, before the map review.

## Out of scope

- **Recommendations and discovery**, including a **voice mode** idea the owner wants to think about later.
- **Social feeds, stats dashboards, streaming availability.**
- **Importing existing lists**: bulk paste of titles and file import (Letterboxd, IMDb, Trakt). Planned as the first follow-up right after v1 ships.
- **Everything planned for later** lives in [future scope](../../docs/future-scope.md), including the users' wish list from the market research. The scope check decides whether any of it joins v1.
- **Never planned**: reading screenshots (OCR), native mobile apps, YouTube / books / games.

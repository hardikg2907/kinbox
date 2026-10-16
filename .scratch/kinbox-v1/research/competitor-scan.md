# Competitor scan

Date of research: 2026-10-08. Ticket: [13-competitor-scan](../issues/13-competitor-scan.md).

Terms follow `CONTEXT.md`: a **Title** is a **Movie** or a **Series**.

## How to read this

- "Not stated" means the product's own pages that I could read did not say. It does not mean the feature is missing.
- Source tags: **[P]** = the product's own page (site, help center, app-store listing, official forum post). **[S]** = secondary report (news, user review). Every [S] claim is marked.
- Blocked pages: `letterboxd.com/pro`, `trakt.tv/vip` and `serializd.com/faq` did not load in a plain fetch. Letterboxd's Pro page loaded at `/about/pro/`. Trakt's VIP page is a script shell. The Serializd FAQ sits behind a bot check, and I did not bypass it. The Serializd home page carries its own short FAQ, so I used that.

## Big finding first

**No app is "movies only" or "series only" in a way that leaves Kinbox alone in the middle.** Trakt and Simkl already track Movies and Series together, with a to-watch list and episode progress. So the positioning "nobody does both" is false. What holds is narrower: see "Does the positioning hold" at the end.

Two facts changed the field in 2025-2026:

- **TV Time shut down on 2026-07-15.** Its own site now shows only a thank-you note. Many TV Time users are looking for a new home.
- **Letterboxd still has no returning Series.** It said in July 2026 it is "still working on it".

## Comparison table

| | Letterboxd | Serializd | TV Time | Trakt | Simkl | Google Keep |
|---|---|---|---|---|---|---|
| Movies / Series | Movies only. No returning Series. Some limited series and TV movies exist. | Series only (the site talks only about TV). | Both, but **shut down 2026-07-15**. | Both | Both, plus anime | Anything (free text) |
| To-watch list | Yes: "watchlist". Leaves the list when you mark, log, rate or review. Can be private. | Yes: shows you "want to watch" (App Store text). | Closed | Yes: watchlist. Free cap 250 items, VIP 5K. | Yes: "Plan to Watch", one per type (Movies, TV, Anime). | Checklist or note, by hand |
| Log and diary | Yes: diary with watch date (optional). Rewatch = another diary entry. "Mark watched" without a date also exists. | Yes: "TV diary", tracks rewatches. | Closed | Yes: watch history. Full rewatch tools are VIP only. | Yes: watch history. Rewatch tracking is PRO/VIP only (and web-only beta). | No dates, by hand |
| Series progress (episodes) | n/a | Yes: log shows, seasons, episodes; "never lose your place". | Closed | Yes: progress, "Up Next". Reviews of Trakt on Google Play (Jul-Sep 2026) complain it does not offer to mark earlier episodes as watched. [S] | Yes: episodes missed, "what to watch next", mark whole seasons (user quote on Simkl's page). | No |
| Ratings and reviews | Half-star to 5 stars. Reviews, likes, tags. | Rate episodes, seasons, series. Scale not stated. Reviews yes. | Closed | 5 stars with half-steps ([S] forum threads); reviews and comments yes. Scale not stated in app listings. | Rating scale not stated. Full reviews and 140-character memos. | No |
| Private notes | Not stated for diary entries. Lists carry item notes (apps). | "Notes!" added in the iOS app (App Store, version 1.991). Privacy not stated. | Closed | Yes. 100 free, 2K VIP. Notes on media items are always private. | Not stated | The whole note is private |
| To-watch filters and sorting | Strong filters: watched, liked, rated, logged, reviewed, in watchlist, short films, documentaries, unreleased. Streaming and "own" filters are Pro. Sort includes your rating. No length or genre filter is stated in the FAQ. | Not stated | Closed | "Watch now" filter free. Advanced filters and saved filters are VIP only. | Sortable list columns. Quick Edit mode. Tier of each not clear. | Labels, colour, search filters |
| Custom lists / tags | Unlimited lists, private lists, nested tags (free). Bulk tag edit is Pro. | Lists of shows and episodes. | Closed | Free: 5 personal lists, 250 items each. VIP: 100 lists, 5K items each. | Custom lists need PRO/VIP. 15 default watchlists are free. | Up to 50 labels |
| Sharing and social | Follow, feed, comments. No private accounts. | Follow, discussions, profile. | Closed (it had a community) | Follow, comments, collaborative lists (free). | Follow, reviews, "watch with friends". | Share a note with collaborators |
| Import / export | Free CSV importer (IMDb exports work). Export zip of CSVs. | Import from TV Time and Trakt. Export not stated. | Closed. Export was by GDPR request before the shutdown. [S] | Import: IMDb, Plex, Letterboxd, TV Time. New JSON export (2026, [S] forum). | Import from 20+ services. Trakt/TV Time import is PRO/VIP. CSV/JSON/RSS export is VIP. | Not stated |
| Platforms | Web, iOS, Android, Apple TV | Web, iOS, Android | Closed | Web, iOS, Apple TV, Android | Web, iOS, Android, Windows, Chrome extensions, Kodi, Plex | Not stated here (Android and computer help pages exist) |
| Price | Free. Pro $18.99/yr, Patron $48.99/yr (US App Store). Yearly only. | Free (own site). | Was free. Owner said a paid version had too little demand. [S] | Free. VIP: price page not readable. $60/yr standard renewal [S]. | Free. PRO $34.99/yr. VIP $34.99 per 6 months. Lifetime VIP $249. | Not stated in the pages I read |
| What paid adds | No ads, stats, streaming filters and alerts, "own" filter, list cloning, pinning. Patron adds custom posters and backdrops. | Nothing (free) | n/a | No ads, unlimited-style lists, notes cap, advanced filters, rewatch, stats, beta access. | PRO: no ads, rewatch, custom lists, recommendations, private profile. VIP: exports, backups, iCal, month and year reviews. | n/a |

## Letterboxd

- **Movies only.** The help center says returning TV shows are not supported, but it is "working on this as a future platform extension". Limited series, miniseries and TV movies exist for historic reasons, and Letterboxd "reserve[s] the right to remove" them. [P] https://letterboxd.zendesk.com/hc/en-us/articles/15269096507407-Do-you-support-TV-shows
- **Logging.** The `+ Log` button writes a diary entry with a date and an optional review. Marking "watched" with the eye icon needs no date. You can rate, like and tag at the same moment. [P] https://letterboxd.com/about/faq/
- **Rewatch.** Each log is a new diary entry. Your film total counts the first watch of the year only. [P] same FAQ.
- **Watchlist.** One-click add. Films leave it when you mark, log, rate or review them. It can be public or private. [P] same FAQ.
- **Filters.** The FAQ lists account filters (watched, liked, rated, logged, reviewed, in watchlist, owned) and content filters (short films, TV shows, documentaries, unreleased). Streaming-service filters and alerts are paid. [P] same FAQ and https://letterboxd.com/about/pro/
- **Tags and lists.** Free tags (nested tags work). Lists have no size limit. Private lists exist. No collaboration. [P] same FAQ.
- **Social.** Follow, activity feed, comments. "Letterboxd does not have private accounts." [P] same FAQ.
- **Import / export.** Free importer (Letterboxd CSV format; IMDb exports are compatible; 1 MB file limit). Export bundle from Settings. [P] same FAQ (fetched summary of the page). I did not confirm the 1 MB limit on a second page.
- **Platforms.** Apps for iOS, Android and Apple TV. [P] same FAQ.
- **Price.** Free forever tier. Pro $18.99/yr, Patron $48.99/yr in the US App Store. All subscriptions are yearly, "no monthly option". [P] https://apps.apple.com/us/app/letterboxd/id1054271011 and the FAQ.
- **Pro adds.** No ads, stats pages, streaming-service filter, watchlist alerts, "own" filter, list cloning, pinning. [P] https://letterboxd.com/about/pro/
- **Recent changes.**
  - Dec 2025: Letterboxd Video Store (digital rentals). [P] FAQ.
  - Jan 2024: Letterboxd said Series would arrive "later this year". [S] https://www.joblo.com/letterboxd-to-add-tv-show-ratings-later-this-year/ It did not ship.
  - Jul 2026, after the TV Time shutdown: "we are still working on it". [S] https://www.resetera.com/threads/following-the-tv-time-shutdown-letterboxd-confirms-they-are-still-working-on-adding-tv-shows-to-their-platform.1567171/

## Serializd

- **Series only.** The home page describes itself as a TV tracker ("to TV what Letterboxd is to movies"). It never mentions Movies. [P] https://www.serializd.com/
- **Tracking.** Track shows, rewatches, a "TV diary", reviews and ratings, lists of shows and episodes. The iOS listing says you can rate and review each episode, season or series, and "never lose your place". [P] https://www.serializd.com/ and https://apps.apple.com/us/app/serializd/id1581244120
- **Notes.** The latest iOS release notes say "Notes!". The listing does not say whether notes are private. [P] App Store link above.
- **Social.** Follow friends, discussions, trending, member lists. [P] home page. A 2024 App Store review says there was no private-account option at that time. [S]
- **Import.** From TV Time and Trakt. Export: not stated. [P] home page.
- **Platforms and price.** Web, iOS, Android. "Completely free to use." Data comes from TMDB. [P] home page.
- **Quality signals.** App Store reviews mention crashes and episode counts that do not match the stats page. [S] same App Store link.

## TV Time

- **Closed.** The site now shows only a thank-you note. [P] https://www.tvtime.com/
- **Shutdown date and reason.** MacRumors reports the owner's support notice: shutdown on July 15, 2026; "no longer sustainable to continue operating the service as a free app"; "not enough demand for a paid app". The official notice is at https://whipmedia.freshdesk.com/support/solutions/articles/68000029988-tv-time-is-shutting-down but now asks for a login. [S] https://macrumors.com/2026/07/02/show-tracking-app-tv-time-shutting-down
- **Data.** Export through a GDPR self-service tool before the shutdown. Personal data deleted afterwards. [S] same MacRumors page.
- **Where users went.** Trakt, Simkl and Serializd all advertise a TV Time import (see their sections). A new app, Bingers, is listed on the App Store as "TV & Movie Tracker". A secondary report says a TV Time co-founder builds it. It is not an official TV Time relaunch. [S] https://mezha.net/eng/bukvy/7a86d979_tv_time_co-founder/
- **Lesson.** A free-only tracker with no income plan can close. Kinbox is free in v1 and plans money later, so this risk is real for Kinbox too.

## Trakt

- **Movies and Series.** "Track shows and movies you watch." Indexes over 1 million Titles. [P] https://apps.apple.com/us/app/trakt-tv-time-to-watch/id1514873602
- **Watchlist and progress.** Watchlist, "Up Next", detailed progress, calendar. [P] https://play.google.com/store/apps/details?id=tv.trakt.trakt
- **History and rewatch.** Full history of everything watched. Rewatch and "recalculate progress" are VIP only. [P] Google Play link.
- **Limits (free vs VIP), Feb 27 2026 post.** Watchlist 250 vs 5K. Per personal list 250 vs 5K. Personal lists 5 vs 100. Total list items 1K vs 100K. Notes 100 vs 2K. The post says the watchlist and per-list rises to 250 are live, and the rest "will roll out progressively". [P] https://forums.trakt.tv/t/updating-trakt-limits-for-2026/101592
- **Private notes.** Notes on media items are always private. Notes on history, ratings and list items can be private or public. [P-forum, via search summary] https://forums.trakt.tv/t/personal-notes/16308 (I did not open this thread myself; the 100 / 2K note limits come from the Feb 2026 post I did read.)
- **Filters.** "Watch now" filter free for everyone (Jan 2025). Advanced filters and saved filters are VIP only. Collaborative lists became free in Jan 2025. [P] https://forums.trakt.tv/t/freemium-experience-more-features-for-all-with-usage-limits/41641 and the Google Play link.
- **Ratings.** 5 stars with half-steps; users ask for the plain 10-star view back. [S] https://forums.trakt.tv/t/bring-back-the-usual-10-stars-rating-without-half-from-1-to-10/105766
- **Import / export.** Import from IMDb, Plex, Letterboxd, TV Time. [P] Google Play link. A one-off JSON export is mentioned by users in the mid-2026 update thread. [S] https://forums.trakt.tv/t/trakt-product-update-june-mid-july-2026/116109
- **Platforms.** Web, iOS, iPad, Apple TV, Android. [P] both store listings.
- **Price.** VIP renewals moved to one standard rate on June 12, 2025. The forum post confirms the move but I could not read the price on Trakt's VIP page. $60/yr is reported by [S] https://alternativeto.net/news/2025/5/trakt-announces-all-vip-renewals-will-switch-to-a-new-standard-rate-doubling-prices/ . A 2026 App Store reviewer mentions a $5.99 monthly fee [S].
- **Recent changes.** Jan 2025: free limits cut (2 lists, 100 items). May-Jun 2025: price standardised. Feb 2026: limits raised again. Mid-2026: web V3 move, with user complaints about missing features. [P] forum links above.
- **Weak spots (user reviews, after the TV Time shutdown).** Confusing navigation. No prompt to mark earlier episodes watched. No private reviews on Movies. [S] Google Play reviews, Jul-Sep 2026.

## Simkl

- **Movies, TV and anime.** About 1.2 million Movies and 141K TV shows in its catalogue. [P] https://simkl.com/vip/
- **Lists.** 15 default watchlists free: Watching, Plan to Watch, Completed, On Hold, Dropped, for TV, Anime and Movies. Custom lists need PRO or VIP and the V2 beta. [P] same page.
- **Rewatch tracking.** PRO and VIP only; web-only while in beta. [P] same page.
- **Progress.** "What to watch next", episodes missed, calendars, release countdowns. [P] same page.
- **Reviews.** Full-page reviews or 140-character memos for friends. Rating scale not stated. Private notes not stated. [P] same page.
- **Import / export.** Import from 20+ services including Letterboxd and IMDb. Trakt and TV Time imports are PRO/VIP only. CSV, JSON and RSS export are VIP. Auto JSON backup is VIP. [P] same page.
- **Platforms.** Web, iOS, Android, Windows, Chrome extensions, Kodi, Plex. [P] same page.
- **Price.** Free (with ads). PRO $2.91/mo billed $34.99/yr. VIP $5.83/mo billed $34.99 twice a year. Lifetime VIP $249. Students $2.99/mo. You can earn PRO free by visiting 20 days in a month. [P] same page.
- **Shape of the product.** Much of the page sells recommendations, stats, auto-tracking (Plex, Netflix), calendars and social. That is the opposite of "clean and minimal".

## Google Keep (the notes-app habit)

- **What it gives.** Checklists, up to 50 labels, reminders, sharing notes with collaborators, and search filters by label, colour, type and people. [P] https://support.google.com/keep/answer/6191044 (labels), https://support.google.com/keep/answer/6101196 (sharing), https://support.google.com/keep/answer/2888263 (search), https://support.google.com/keep/answer/6358550 (list settings)
- **What it lacks for this user.** No Title lookup, no poster, no watch date, no rating, no episode progress, no Movie-or-Series split. You type each Title by hand. Nothing in these help pages describes any of those.
- **Why people stay.** Capture is one tap, there is no sign-up friction beyond a Google account, and the notes are private. Price and export: not stated in the pages I read.

## Conclusions

### Does the positioning hold

Partly.

- **False part.** "No app keeps Movies and Series together." Trakt and Simkl do, with watchlists and episode progress.
- **True part.** The log experience this user likes (Letterboxd) has no returning Series. The two apps that do both are heavy: discovery, social, stats and scrobbling come first, and useful pieces sit behind paid tiers (Trakt filters, rewatch; Simkl rewatch, custom lists). Free Trakt caps lists at 5 and the watchlist at 250 items.
- **Opening in 2026.** TV Time left a crowd of displaced users. Post-shutdown reviews of Trakt complain about confusion and missing episode shortcuts.
- **Live risk.** Letterboxd has promised Series since Jan 2024 and said in Jul 2026 it is still working on it. If it ships, the "both in one place" pitch weakens fast. Kinbox's edge must then be the "tonight" filter and speed, not just coverage.

### (a) Table stakes Kinbox v1 must match for this user

Every item below is offered by at least one competitor, and the user would miss it.

1. One catalogue for Movies and Series, with posters and details from a movie database (Trakt, Simkl).
2. A to-watch list that a Title leaves, or changes status on, when you log it (Letterboxd).
3. A log with a watch date, "add straight as watched", and a rewatch as a separate entry. Free, not paid (Letterboxd free; Trakt and Simkl paywall rewatch).
4. Series progress by season and episode, with "mark all earlier episodes watched" (the most common complaint in post-TV-Time reviews of Trakt).
5. A rating on a familiar scale. Half-star steps up to 5 stars is the Letterboxd standard and Trakt matches it. A short written review is optional.
6. A private note per Title (Trakt has it; Google Keep users get it by default).
7. Sort and filter on the to-watch list. Minimum: Movie vs Series, watched state, sort by date added.
8. Some way to group Titles: simple lists or tags, free and not tightly capped.
9. Free to use, on a phone browser and a desktop browser.
10. Getting your data out (every serious competitor offers export). This belongs to the "Account basics" item on the map, not to this ticket.

### (b) Gaps Kinbox can own

1. **A "tonight" filter built for deciding.** Letterboxd's filters are about watched state, own and streaming. Trakt's advanced filters are VIP only. Simkl sells lists and recommendations. None of the official pages I read promise a quick cut by length, type (Movie or Series), mood or who recommended it. One search summary says Letterboxd sorts by film length, but I did not confirm that on a Letterboxd page, and it covers Movies only. (Streaming availability is out of scope for v1.)
2. **Fast capture on a phone browser.** The sources describe no one-step "save from a name" flow that rivals a Keep note. This matches the user's top pain.
3. **No caps and no paywall on core logging.** Free Trakt: 5 lists, 250 items. Simkl and Trakt gate rewatch. Kinbox v1 can make rewatch, lists and notes free. This has a cost: see the TV Time shutdown.
4. **Private by default, with no feed.** Letterboxd has no private accounts. Serializd reviewers asked for them. A quiet, personal log fits "clean and minimal".
5. **Series and Movies on equal terms.** Letterboxd is Movies-first and Serializd is Series-only. Trakt and Simkl treat both, but through heavy UIs.
6. **Losing your place in a Series.** Trakt reviews show friction here. A calm "where was I" view is open ground.

### Out of scope for v1 (seen at competitors, not recommended here)

- Recommendations and discovery (Simkl, Trakt, Serializd all lead with them).
- Social feeds, follows, comments, "watch with friends".
- Stats dashboards, year-in-review.
- Streaming availability filters and alerts (Letterboxd Pro, Trakt, Simkl).
- Importing lists (TV Time, Trakt, Letterboxd, IMDb importers exist at competitors). The map plans this as the first follow-up after v1. The TV Time shutdown makes it more urgent, but it stays out of v1.
- Auto-tracking (scrobbling) from Plex, Netflix and similar.

# Movie database API for Kinbox

Researched 2026-10-08. Ticket: [04 Movie database API](../issues/04-movie-database-api.md).

Terms: **Title** = Movie or Series (see `CONTEXT.md`).

## Source reliability notes (read first)

- **TMDB pages could not be fetched directly.** Every fetch of `themoviedb.org` and `developer.themoviedb.org` failed from this environment (about 12 tries, plus curl). The TMDB quotes below come from indexed excerpts of the official pages returned by search, restricted to the TMDB domains. The terms page shows no date in those excerpts ("date: not stated"). Re-read the live pages before launch.
- **Forum replies are not terms.** Some TMDB facts (price, image hot-linking) come only from TMDB staff replies in the TMDB forum. Those are labelled "staff forum reply".
- **TMDB response field names** (`number_of_seasons`, `number_of_episodes`, `episode_run_time`, episode `air_date` and `runtime`) are widely used but not confirmed from a primary page this session. Confirm them in the first integration spike.
- "Not stated" means the primary page does not say it.

## Comparison table

| | TMDB | OMDb | TVmaze | Trakt | TheTVDB | Simkl | IMDb official |
|---|---|---|---|---|---|---|---|
| Movies | Yes | Yes | No (TV only; API page documents shows, people, schedules) | Yes | Yes | Yes | Yes |
| Series, seasons, episodes | Yes (season details endpoint lists episodes) | Series yes; `Season` param returns episodes (change log only) | Yes, with air dates, specials | Yes | Yes, with several orders (aired, DVD, absolute) | Yes (`/tv/episodes/{id}`); air dates not confirmed | Yes (paid API); free TSV has `title.episode` |
| Anime | Yes; episode groups for anime orders | Not stated | Yes (Attack on Titan listed) | Not stated | Strong: absolute order | Dedicated anime catalog | Not stated |
| One combined movie + TV search | Yes: `/3/search/multi` (movie, tv, person) | Partly: `s` with no `type` | No (shows only) | No: per type (`/search/movie`, `/search/show`) | Yes: `/search` with optional `type` | No: one `type` per call | Not stated |
| Rate limit | About 40 req/s per IP (soft) | Free key 1,000/day | Free: 20 calls per 10 s per IP | 500 GET per 5 min | Not stated | 10 GET/s per client | Not stated |
| Poster images | Yes | Poster API for patrons only | Yes (own URLs) | No: uses TMDB/TVDB/Fanart ids | Yes | Yes (via wsrv.nl proxy) | Not stated |
| Free for non-commercial | Yes, with attribution | Yes (1,000/day) | Yes (CC BY-SA) | Yes | Yes (< $50k revenue, link-back) | Yes | Datasets only, personal use |
| Commercial use | Written agreement; staff quote $149/mo under $1M revenue | Content CC BY-NC 4.0; commercial not stated | Free tier allowed (ShareAlike); $250/mo for CC BY | Staff: no restriction, no licence | $1,000/yr ($50k-$250k revenue) | Free under $150/mo revenue; then licence, price not stated | Contract only, price not published |
| May store metadata | Yes, max 6 months cache | Not stated | Not stated | Cache allowed; mirroring banned | Not stated | Cache allowed | Datasets: local copies allowed |
| Poster rules | Staff: hot-link OK | n/a | Staff: link, do not host copies; API page says cache is safe | Cache; hot-linking blocked | Not stated | Cache forever; proxy | Not stated |

## Per-API findings

### TMDB (The Movie Database)

- **Coverage.** Community-built database. An older FAQ copy lists about 1.39M movies, 235k TV shows and 6.7M TV episodes (counts are dated). TMDB supports 39 languages. Source: https://www.themoviedb.org/faq/general and https://www.themoviedb.org/about (indexed excerpts).
- **Non-US spot-check.** TMDB has pages for Malayalam films Premalu (https://www.themoviedb.org/movie/1149791) and Manjummel Boys (https://www.themoviedb.org/movie/1069945-boys), the Hindi series Panchayat with seasons and episodes (https://www.themoviedb.org/tv/101352-panchayat), and the K-drama Squid Game with season pages (https://www.themoviedb.org/tv/93405/season/1). This is a spot-check, not a coverage claim.
- **Anime.** Attack on Titan has TMDB episode groups with "Intended Anime Order" and "logical order" (https://www.themoviedb.org/tv/1429/episode_group/685382dd5c6142bc005d88fa). TMDB's default is original broadcast order.
- **Search.** `GET https://api.themoviedb.org/3/search/multi` takes `query`, `include_adult`, `language`, `page` and returns movies, TV shows and people in one call. Source: https://developer.themoviedb.org/reference/search-multi. Latency: not stated.
- **Episodes.** `GET /3/tv/{series_id}/season/{season_number}` returns the season (https://developer.themoviedb.org/reference/tv-season-details). `append_to_response` combines sub-requests in one call (https://developer.themoviedb.org/docs/append-to-response). Change feeds exist for TV series, seasons and episodes (https://developer.themoviedb.org/reference/tv-series-changes). These feeds help the map item "Keeping Title data fresh".
- **Rate limit.** The old 40 requests per 10 seconds limit was removed on 2019-12-16. Upper limits remain, in the range of about 40 requests per second, and may change; handle HTTP 429. Source: https://developer.themoviedb.org/docs/rate-limiting. Staff forum replies say the limit is per IP, not per key, and that there is no daily cap.
- **Free vs commercial.** The FAQ says the API is free for non-commercial use if you attribute TMDB, and that a project is commercial if its primary purpose is to create revenue for the owner. Commercial licences go through the sales team by email. Source: https://developer.themoviedb.org/docs/faq. The API terms say deriving revenue "directly or indirectly" from TMDB content is commercial use and is allowed only under a separate written agreement that may involve fees. Source: https://www.themoviedb.org/api-terms-of-use. The terms also list running a revenue-generating website, including ad revenue, as a commercial use needing a written agreement (excerpt; confirm on the live page).
- **Price.** Staff forum reply: "If you do less than $1 million in revenue you can subscribe to our 'commercial' plan for $149/mo"; above $1M, a custom quote. Source: https://www.themoviedb.org/talk/68064474276bf64e41aace48 and https://www.themoviedb.org/talk/622b91d0d236e60045f62782. A published price page was not found. Forum users report sales emails going unanswered for weeks.
- **Attribution.** Use the TMDB logo, less prominent than your own branding, and show the notice "This product uses the TMDB API but is not endorsed or certified by TMDB." Source: https://developer.themoviedb.org/docs/faq and https://www.themoviedb.org/about/logos-attribution. A staff forum reply puts it in an About or Credits section.
- **Storing metadata.** The terms bar you from "Cache, for longer than 6 months, any information obtained through or from TMDB or the TMDB APIs." On termination you must purge all TMDB content, including cached copies. Source: https://www.themoviedb.org/api-terms-of-use (excerpt). Open question: whether a successful refresh restarts the six months. No answer found; TMDB's own forum has it unanswered (https://www.themoviedb.org/talk/684fccb6bac1f078e05c83a8).
- **Posters.** Staff forum reply: "You're free to use the images straight from tmdb.org. There are no limits and image requests do not count as API requests." (https://www.themoviedb.org/talk/556fbb0a92514140ca0005af). The terms bar using TMDB as an image host for ads or graphics. The terms page itself says nothing about image caching that this search surfaced ("not stated").
- **Other.** Training or validating AI systems on TMDB content counts as commercial use (terms excerpt). TMDB says it does not claim ownership of the images and data and extends no rights in them.

### OMDb

- Free key: 1,000 daily limit (https://www.omdbapi.com/apikey.aspx). Patron tiers and prices: not stated on that page.
- Search `s` takes `type` (movie, series, episode), `y`, `page` 1-100. `Season` returns all episodes (documented only in the change log). Response fields: not listed on the page. Source: https://www.omdbapi.com/.
- "All content licensed under CC BY-NC 4.0." The Poster API is "only available to patrons." Commercial use: not stated beyond the NC licence. Source: https://www.omdbapi.com/.
- Weak on episode lists, anime and regional titles (no evidence stated). Ruled out for terms and image reasons.

### TVmaze

- TV only. Shows, seasons ("A complete list of seasons"), episodes (specials always included in the season list), people, schedule. Source: https://www.tvmaze.com/api. No movie resource is documented.
- Search: `/search/shows?q=` is fuzzy and ranked by relevance. Free limit: "at least 20 calls every 10 seconds per IP address." Source: https://www.tvmaze.com/api.
- Licence: "Use of the TVmaze API is licensed by CC BY-SA", data "can freely be used for any purpose" with credit and ShareAlike. Caching: HTTP responses cached 60 minutes by TVmaze; images "can safely be cached indefinitely." Source: https://www.tvmaze.com/api.
- Plans: Startup $250/mo (CC BY), Small Business $500/mo (no attribution), Enterprise custom. Source: https://www.tvmaze.com/api/plans.
- Staff forum reply (about a year old, no exact date): data may be used commercially with credit; link to TVmaze image URLs rather than hosting copies. Source: https://www.tvmaze.com/threads/6552/using-posters-and-data-from-tvmaze-api-on-a-commercial-website. This conflicts with the API page's "cache images" line.
- Spot-check: has Panchayat and Squid Game (https://www.tvmaze.com/shows/47014/panchayat, https://www.tvmaze.com/shows/43687/squid-game).
- Does not cover Movies, so it cannot be primary.

### Trakt

- A tracking service. Its data can include images on `?extended=full`, but its own docs say to cache all images, and hot-linking is blocked. Posters come from TMDB, TVDB or Fanart via the `ids` object. Source: https://developer.trakt.tv/docs/images.
- Search is per type: `/search/movie`, `/search/show` (exact and broad). Source: https://developer.trakt.tv/docs/search. No combined endpoint is documented there.
- Limits: 500 GET per 5 minutes (authenticated user, or client id plus public IP); 1 write per second. Source: https://developer.trakt.tv/docs/rate-limiting.
- Policy: caching allowed for user-chosen features; bans scraping, mirroring Trakt data and selling access; follow branding guide. Source: https://developer.trakt.tv/docs/api-use-policy. App terms: https://developer.trakt.tv/docs/create-an-app.
- Commercial: staff forum reply, 2026-02-12: "There is no cost associated with using the Trakt Public API. The API is free and there is no specific commercial use license." Source: https://forums.trakt.tv/t/asking-about-api-commercial-uses-on-free-plan/99367. An unanswered 2026-08-22 post in the same thread says creating an API app now needs a VIP subscription. Unresolved.
- Use only as a later import source (the map plans Trakt import after v1), not as the metadata source.

### TheTVDB

- API v4. `GET /search` takes `query`, `type` (movie, series, person, company), `year`, `language`, `offset`, `limit`. `GET /series/{id}/episodes/{season-type}` supports `default`, `official`, `dvd`, `absolute`, `alternate`, `regional`. Source: https://thetvdb.github.io/v4-api/swagger.yml. Token valid for one month, obtained with `/login`.
- Rate limits and storage rules: not stated on the pages read.
- Licence tiers by parent-company revenue: under $50k free with attribution; $50k-$250k $1,000/yr; $250k-$1M $10,000/yr; above that, contact sales. Direct link to TheTVDB.com is required when showing metadata. Free and open source projects get large discounts. Source: https://thetvdb.com/api-information. How the tier applies to an individual: not stated.
- Anime: absolute order for Attack on Titan (89 episodes in one season) is listed (https://www.thetvdb.com/series/attack-on-titan). Spot-check of Indian regional films via search was inconclusive; do not rely on it.

### Simkl

- Search `/search/{type}` with type `movie`, `tv` or `anime`; combined types not documented (https://api.simkl.org/guides/search). Episode lists: `/tv/episodes/{id}`, `/anime/episodes/{id}` (https://api.simkl.org/all-endpoints).
- Rate limit: 10 GET/s and 1 POST/s; sustained overage can lead to client suspension "without warning, no appeal." Source: https://api.simkl.org/api-rules.
- Free for non-commercial use and for commercial apps under $150/month revenue; at $150/month or more a commercial licence is needed; price not stated. Source: https://api.simkl.org/api-rules.
- Rules that hurt Kinbox: a tracker app that syncs with another tracker may use the API only if it also offers Simkl login and sync; the rules say "For general metadata, use TVDB and TMDB from their original sources"; each shown item must link to its Simkl page. Source: https://api.simkl.org/api-rules.
- Images: cache forever, served through wsrv.nl. Source: https://api.simkl.org/conventions/images.

### IMDb official

- API exists only through AWS Data Exchange (GraphQL-backed). Pricing and eligibility: not stated; contract-based, with a free trial via AWS Marketplace. Sources: https://data.imdb.com/ and https://origin-help.imdb.com/article/imdb/general-information/introducing-the-imdb-api/G49M5Y59L5N4WABM. Contact: imdb-licensing@imdb.com.
- Free TSV datasets: "personal and non-commercial use", local copies allowed, seven files including `title.episode`. Source: https://data.imdb.com/non-commercial-datasets/. Not an app API and not licensed for money later.
- Not viable for a free app that may earn later.

## Recommendation

**Primary: TMDB.** Use `/search/multi` for type-ahead, season details for series progress, and `image.tmdb.org` for posters.

Facts that decided it:
1. It is the only candidate with all of: movies and series in one search, season and episode lists, posters, no daily cap, and spot-checked Hindi, Malayalam and Korean titles.
2. It is free for non-commercial use with a logo and notice.
3. It has a stated commercial path (a staff-quoted $149/month plan under $1M revenue) instead of "contact sales for a contract" (IMDb) or share-alike terms (TVmaze).
4. Trakt and Simkl both point to TMDB for raw metadata and posters.

**Fallback (series gaps only): TheTVDB.** It adds absolute episode order for anime. It is free below $50k revenue with a link-back and costs $1,000/yr above that. Add it only if TMDB episode groups prove too thin during the first integration spike. Not needed for v1 unless that spike fails.

Risks and costs:
- **6-month cache cap.** Stored Title data must be refreshed at least every six months. This shapes the map item "Keeping Title data fresh". The refresh-restarts-the-clock question is open; ask TMDB.
- **Commercial line is blurry.** The terms call any revenue, including ads, commercial. The moment Kinbox earns money, budget $149/month and get a written agreement first. Sales replies can take weeks, so start the request before launching paid features.
- **Mirroring.** Keep only Titles users saved, not a copy of the catalog. Do not mirror posters into Kinbox storage in v1; hot-link `image.tmdb.org`, and confirm image caching in writing if a local image cache is wanted later.
- **Even the free tier needs attribution.** Logo and the "not endorsed or certified" notice in an About or Credits view.
- **Unverified fields.** Confirm TMDB `number_of_seasons`, `number_of_episodes`, episode runtime and episode `air_date` fields on a sample call.
- **Coverage gaps.** Spot-checks cover only a handful of titles. TMDB is user-edited, so regional titles may be thin. That backs the map item "Titles the database lacks".

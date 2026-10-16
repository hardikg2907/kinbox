# Movie database API

Type: research
Status: resolved
Blocked by: none
Map: [Kinbox v1](../map.md)

## Question

Which movie database API should Kinbox use, and on what terms?

- Candidates at least: TMDB, OMDb, TVmaze, Trakt, TheTVDB, Simkl, IMDb's official data offering.
- Coverage: movies, series, seasons and episodes (episode lists, air dates), anime, non-US titles (Indian regional cinema, K-dramas).
- Search: a combined movie + TV search usable for type-ahead; latency and rate limits.
- Data: poster, year, runtime (episode runtime for series), cast, genres, season and episode counts.
- Terms: non-commercial vs commercial use and price; attribution rules; whether we may store metadata and cache or hot-link posters.
- Output: one recommended primary API (and a fallback if useful), with the facts that decided it.

## Answer

Use TMDB as the primary movie database. It has one combined movie + TV search (`/search/multi`), season and episode lists for series progress, posters, and no daily cap (soft limit about 40 requests/s per IP).
It is free for non-commercial use with a TMDB logo and a "not endorsed" notice. Once Kinbox earns money it needs a commercial agreement; a TMDB staff reply quotes $149/month under $1M revenue.
TMDB terms cap how long stored metadata may be cached at 6 months, so Title data needs a refresh cycle. Hot-linking `image.tmdb.org` posters is sanctioned by staff replies.
Fallback for series gaps (anime order): TheTVDB, free under $50k revenue with a link-back. TMDB pages could not be fetched live, so verify terms before launch.
[findings](../research/movie-database-api.md)

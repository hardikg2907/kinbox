# IMDb ratings: sources and terms

For: backlog item "IMDb rating on a Title's page". Gathered 2026-10-20. "Confirmed" means the primary page was read or the real file was fetched.

| Source | Cost | Commercial use | Freshness | Attribution | Fit for Kinbox |
|---|---|---|---|---|---|
| IMDb datasets, `title.ratings.tsv.gz` | Free | No: "personal and non-commercial use" only; IMDb "reserves the right to withdraw permission … at any time" (confirmed) | Daily (confirmed) | "Information courtesy of IMDb (https://www.imdb.com). Used with permission." (confirmed) | Best now: one 8.7 MB file, 1,722,889 rows, includes Series; many episodes and small Titles have no row |
| IMDb API (AWS Data Exchange) | Contracts of roughly $150,000-250,000 a year (unconfirmed listings) | Yes, licensed | Real time | Per contract | Not realistic |
| OMDb | Free 1,000 a day; paid from $1/month via Patreon | Content is CC BY-NC 4.0; no clear commercial terms; its own IMDb rights unclear | Not stated | Not stated | Easy, but no clear rights |
| MDBList | Free 1,000 a day; paid 1-5 EUR/month | No clause; passes IMDb data on without an IMDb licence | Not stated | Not stated | Easy, but no clear rights |
| Scraping imdb.com | – | Banned: "You may not use data mining, robots, screen scraping …" (confirmed, imdb.com/conditions) | – | – | Never |

Sources: https://developer.imdb.com/non-commercial-datasets/, https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX, https://www.imdb.com/conditions, https://www.omdbapi.com/, https://mdblist.com/api/, https://mdblist.com/terms/.

## Facts Kinbox relies on

- TMDB gives the IMDb id: `imdb_id` on movie details; for TV, `append_to_response=external_ids` (`external_ids.imdb_id`). It can be null.
- The licence bans republishing the data as a database of movie information, so ratings stay a per-Title value on its page: no export or API of ratings.
- Neon's free plan allows 1 GB per project (confirmed, neon.com/pricing). Storing all 1.72M rating rows would take roughly 100-150 MB; storing only the Titles Kinbox has costs almost nothing.
- TMDB's terms also need "a separate written agreement" before Kinbox charges users or earns revenue, and they ask for the attribution: "This [website] uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB." The About page should match that wording.

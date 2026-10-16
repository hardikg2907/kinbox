# Series progress screen

Type: prototype
Status: open
Blocked by: 05
Map: [Kinbox v1](../map.md)

## Question

On a phone, how does keeping your place in a Series look and behave, and does the per-Episode model with a "Next" line feel fast?

- The "Next: S2 E4" line with a one-tap "Watched it", and how the Seasons and Episode ticks open below it.
- The "also mark the earlier episodes?" offer, and the "mark whole season" tick on a long Series (One Piece: 23 Seasons, 1,181 Episodes).
- Specials, unaired Episodes (greyed, with air date) and the "caught up" marker.
- The marker on a Watched Series when a new Season is out, and words that say the new Season can be tracked here ("Continue" does not).
- The rewatch choice ("Rewatching now" / "Already rewatched") and the "Rewatch" label. If it confuses, record the fallback: "Watched again" only adds a Watch.
- The "check your place" message when the movie database changes Episodes.
- From [Series progress](05-series-progress.md): every behaviour above is decided there; this prototype tests it and picks the words, using `ux-writing`.
- Framework-free prototype. Real Episode data from TMDB if the TMDB key ticket is done; a saved sample otherwise.

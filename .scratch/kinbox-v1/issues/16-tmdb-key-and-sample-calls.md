# TMDB key and sample calls

Type: task
Status: open
Blocked by: none
Map: [Kinbox v1](../map.md)

## Question

Get a TMDB API key and make sample calls, so the add-a-title prototype can use live data and the data model uses real field names.

- HITL: the owner signs up at TMDB and creates a key for non-commercial use. Keep the key out of the project files that get shared (a local, git-ignored env file).
- AFK, once the key exists: call combined search, a Movie, a Series, a season. Record the real field names for runtime, episode runtime, season and episode counts, air dates, and how specials (season 0) appear.
- Spot-check coverage: a few Indian regional films and series, K-dramas, anime. Note thin or missing entries.
- Record where the key lives and the confirmed fields in the answer.
- From [Series progress](05-series-progress.md): confirm on live responses what [TMDB episode data](../research/tmdb-episode-data.md) took from archived pages: season 0 sits outside `number_of_episodes`; the `status` values (Ended, Canceled, Returning Series…); `next_episode_to_air` is null for an ended Series; listed upcoming Episodes can have a null `air_date`.

# Keeping Title data fresh

Type: grilling
Status: open
Blocked by: 05, 11
Map: [Kinbox v1](../map.md)

## Question

How does stored Title data stay fresh and inside TMDB's 6-month limit?

- Refresh when a person opens a Title, on a schedule, or both.
- How a new season reaches a person who had caught up on a Series.
- From [Series progress](05-series-progress.md): progress is never silently lost when the movie database recreates Episodes or merges Seasons. Keep the Owner's place as close as possible; when unsure, show "check your place". Facts: [TMDB episode data](../research/tmdb-episode-data.md) (Episodes can be deleted and re-added with a new id; One Piece Seasons will merge; a changes list covers the last 24 hours). Finished vs ongoing comes from the Series status, which can change (revivals).
- Open fact to ask TMDB: does a refresh restart the 6-month clock?
- What this needs from the stack (background jobs), for the stack and hosting ticket.

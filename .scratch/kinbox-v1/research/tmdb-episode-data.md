# TMDB episode data

For: [Series progress](../issues/05-series-progress.md). Gathered 2026-10-11.

TMDB pages were not reachable live. The facts below come from Wayback Machine copies (2025 and 2026) of the official TMDB docs, the TMDB TV Bible, and staff forum replies. "Confirmed" means the primary page text was read. "Unconfirmed" means a secondary source or an inference.

## Specials (season 0)

- The series `seasons` array lists "Specials" as `season_number: 0`. Confirmed ([tv-series-details](https://developer.themoviedb.org/reference/tv-series-details)).
- Season 0 is not in `number_of_episodes`. The docs example has 73 episodes in seasons 1-8, and Specials has 272 more. Confirmed for the example, inferred as the rule.
- Specials hold "Episode 0" or "0.5" releases, odd-numbered or unnumbered episodes, digital-only leftovers of cancelled seasons, and anime OVAs. Confirmed ([TV Bible](https://www.themoviedb.org/bible/tv/59f743289251416e71000037)).

## Series status

- `status` values (staff, July 2024): Returning Series, Planned, In Production, Ended, Canceled, Pilot. The docs do not define the list, and it may change. Confirmed ([staff thread](https://www.themoviedb.org/talk/6685c10585e1cbe90c4a5fe0)).
- `in_production` is a boolean on series details. Confirmed.

## Next and last episode

- Series details carry `last_episode_to_air` and `next_episode_to_air`. Each is a full episode object or null. A finished show has `next_episode_to_air: null`. Confirmed.

## Unaired episodes

- Editors may add the next upcoming episode with no title or description. An episode may have only a title or only an air date, so `air_date` can be null. Confirmed as policy, not seen in an API response.
- On early cancellation, editors remove air dates from unaired episodes or move them to Specials. Confirmed (TV Bible).
- Whether announced future seasons appear in `seasons`: not documented.

## Episode order and episode groups

- Main seasons and episodes follow the original broadcast order. Confirmed (TV Bible).
- Episode groups add other orders. There are 7 types: Original air date, Absolute, DVD, Digital, Story arc, Production, TV. They were built mainly for anime. Many shows have none. Confirmed ([episode group details](https://developer.themoviedb.org/reference/tv-episode-group-details), [staff 2018](https://www.themoviedb.org/talk/5ad606829251415dc301645d)).

## Stability of episodes

- Each episode has its own `id`, separate from its season and episode number. Confirmed.
- Staff: "Episodes can be deleted and re-added (which would be a new id)." An episode cannot be moved to another season. Editors recreate it and delete the old one. Confirmed ([2015](https://www.themoviedb.org/talk/552e997ac3a36804cd0013ab), [2023-2025](https://www.themoviedb.org/talk/64e48de8e894a6013bae7599)).
- Staff say One Piece seasons "will be merged in a single one at a later date". So season numbers can change for long anime. Confirmed.
- When a network reorganizes seasons, TMDB does not rearrange aired seasons. It adds the new season as the next one. Confirmed (TV Bible).
- Changes endpoints exist per show, season and episode. `GET /3/tv/changes` lists ids changed in the last 24 hours (ranges up to 14 days, 100 per page). Confirmed ([changes](https://developer.themoviedb.org/reference/changes-tv-list)).

## Size example: One Piece (TMDB 37854)

- A snapshot from 14 Sept 2026 shows Specials (39 episodes) plus seasons 1-23, with 1,181 episodes in seasons 1-23. Status: Returning Series.

## Episode fields

- Each episode in season details has `air_date`, `runtime`, `episode_number`, `episode_type`, `id`, `season_number`, `show_id`, `name`, `overview`, `still_path`. Confirmed. `runtime` and `air_date` can be null in real data (unconfirmed).

## What this means for Series progress

- Specials are separate from the main count and can be large. They do not fit a "you must watch all of it" rule.
- Episode identity is not fully stable. Episodes get recreated, and seasons can merge. Any progress kept per episode must survive a re-map. That re-map belongs to [Keeping Title data fresh](../issues/18-keeping-title-data-fresh.md).
- "Caught up" can be worked out from `status`, `next_episode_to_air` and the aired episodes.

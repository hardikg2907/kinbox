# Kinbox backlog

The build queue after paste import, most valuable first. An item is **Ready** when its behaviour is decided and a builder can start, **Needs a plan** when product questions are still open, and **Needs research** when it waits on outside facts. Ideas ruled out for now live in [future scope](future-scope.md); decisions live in [decisions-v0.1.md](decisions-v0.1.md).

## 1. Getting around a large Library — Needs a plan

With a few hundred imported Titles, moving between them is slow. The plan starts from what is hard today (finding one Title, browsing a tab, going from one Title to the next) and may cover sorting, a jump-to-letter index, a fuller search of the Library, and moving between Titles inside the drawer.

## 2. Open any Title's page — Needs a plan

A Title that is not in the Library opens on its own page too (from search, and later from other lists), with its details and the save buttons. A Title already in the Library keeps opening its Entry. Open questions: what the page shows, its address, and what happens when the Owner saves from it.

## 3. IMDb rating on a Title's page — Needs research

Show the IMDb rating, when one exists, on each Title's page. TMDB gives the IMDb id but not the rating, so the rating needs another source; its terms (non-commercial now, paid later) and freshness decide the design.

## 4. Bloom on every move to Watched — Ready

Today the poster-colour bloom plays only on "Watched it" (the next-Episode button), so a Movie never gets it. Add the same bloom (the poster's vivid colour, about 420 ms) to "Mark as watched" in the status sheet, to saving a Title as Watched from search, and to "Watched again". With Reduce Motion on, play a soft colour fade in place (opacity only) instead of skipping the feedback.

## 5. "Tonight" filters and Titles not out yet — Needs a plan

Filters for choosing what to watch tonight (length and genre, in the filter sheet, decision 16), and the not-out-yet behaviour (decision 15): the "Out 18 Dec" label and To watch as the only save choice. The Title snapshot stores no runtime or genre today.

## 6. Easier removal — Proposed

"Remove from library" sits at the bottom of the Title view, one Title at a time. Options: a "Remove" row in the status sheet, or selecting several Titles in the Library. Not agreed yet.

## 7. Bring the v1 map in line with what is built — Planning

Several tickets on the [v1 map](../.scratch/kinbox-v1/map.md) were overtaken by v0.1 and paste import (the three prototype tickets, the TMDB key task, parts of sign-in and stack). Close or rewrite them so the map shows what is really left before v1.

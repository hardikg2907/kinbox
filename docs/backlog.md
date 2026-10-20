# Kinbox backlog

The build queue after paste import, most valuable first. An item is **Ready** when its behaviour is decided and a builder can start, **Needs a plan** when product questions are still open, and **Needs research** when it waits on outside facts. Ideas ruled out for now live in [future scope](future-scope.md); decisions live in [decisions-v0.1.md](decisions-v0.1.md).

## 1. Getting around a large Library — Needs a plan

With a few hundred imported Titles, moving around is slow. The owner's pain points are **browsing a long tab** and **losing their place** (the wall jumps back to the top). Finding one known Title and moving from Title to Title are not the problem. Today: tabs have one fixed order each, no sort choice, no A–Z jump, and search shows at most 5 Library matches. Ideas to plan from: keeping each tab's scroll position, sort choices, an A–Z jump strip, and narrowing a tab by length and genre (which overlaps item 5).

## 2. Open any Title's page — Needs a plan

A Title that is not in the Library opens on its own preview page (the owner chose a page over a smaller sheet), with its details and the save buttons. A Title already in the Library keeps opening its Entry. Open questions: what the page shows, its address, and what happens when the Owner saves from it.

## 3. IMDb rating on a Title's page — Needs a plan

Show the IMDb rating, when one exists, on the Title page of Movies and Series (not on Library tiles). TMDB gives the IMDb id but not the rating. The research is done: [imdb-ratings.md](../.scratch/kinbox-v1/research/imdb-ratings.md). IMDb's free daily ratings file is the only source with clear terms, and it allows personal, non-commercial use only, with a credit line; OMDb and MDBList lack clear rights; scraping is banned. Open questions: the source, how ratings reach preview pages, and what happens if Kinbox earns money.

## 4. Bloom on every move to Watched — Ready

Today the poster-colour bloom plays only on "Watched it" (the next-Episode button), so a Movie never gets it. Add the same bloom (the poster's vivid colour, about 420 ms) to "Mark as watched" in the status sheet, to saving a Title as Watched from search, and to "Watched again". With Reduce Motion on, play a soft colour fade in place (opacity only) instead of skipping the feedback.

## 5. "Tonight" filters and Titles not out yet — Needs a plan

Filters for choosing what to watch tonight (length and genre, in the filter sheet, decision 16), and the not-out-yet behaviour (decision 15): the "Out 18 Dec" label and To watch as the only save choice. The Title snapshot stores no runtime or genre today.

## 6. Easier removal — Proposed

"Remove from library" sits at the bottom of the Title view, one Title at a time. Options: a "Remove" row in the status sheet, or selecting several Titles in the Library. Not agreed yet.

## 7. Bring the v1 map in line with what is built — Planning

Several tickets on the [v1 map](../.scratch/kinbox-v1/map.md) were overtaken by v0.1 and paste import (the three prototype tickets, the TMDB key task, parts of sign-in and stack). Close or rewrite them so the map shows what is really left before v1.

# Notes, ratings, reviews

Type: grilling
Status: open
Blocked by: 01, 02
Map: [Kinbox v1](../map.md)

## Question

What can a person attach to a saved Title, and when?

- Note vs review: is a note any-time text and a review the after-watch text? One per Title or one per watch?
- Private or public, given the sharing decision.
- Rating scale: 5 stars, half stars, 10 points, or like/dislike. Rating per watch or per Title.
- From [Series progress](05-series-progress.md): a Series gets one rating for the whole Series, like a Movie. Season and episode ratings are future scope.
- Add the resolved terms to CONTEXT.md.
- From [Sharing in v1](01-sharing-in-v1.md): ratings and reviews can be shown to others (Profile switches, a switch on each Share link); the private note is never shown. This ticket defines how a review differs from a note.

## Decided so far

- Two texts. A **Note** is private, on any Status, never shown. A **Review** is the Owner's opinion, shown only where Profile or Share link switches allow.
- One **Rating** per Entry (the current opinion), from ½ to 5 stars in half-star steps. It maps one-to-one onto 1-10 scales for import later.
- Only an Entry the Owner has started (Watching, Watched, Dropped) can be rated. After "mark watched", optional stars show inline and never block. A Series shows them only when it reaches Watched, never on Episode ticks.
- No separate "like" or favourite mark.

## Parked (not yet asked to the owner; recommendations only)

- Review: one per Entry, on started Entries only, independent of the Rating.
- Note: one per Entry, any Status, at save or later, shown only on the Entry.
- Text: plain text with line breaks, links not clickable; about 1,000 characters for a Note, 10,000 for a Review.
- Spoilers: no spoiler switch in v1.
- Back to To watch: Rating and Review stay and still show.

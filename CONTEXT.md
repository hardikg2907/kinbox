# Kinbox

Kinbox is a web app where movie and series fans keep the Titles they want to watch, and have watched, in one place.

## Language

### Catalogue

**Title**:
A Movie or a Series as the movie database lists it. Kinbox refers to Titles; it never creates them.
_Avoid_: film, show, media, content, item

**Movie**:
A Title the movie database lists as a film, including documentaries and stand-up specials.
_Avoid_: film

**Series**:
A Title the movie database lists as a TV show, made of seasons and episodes, including miniseries and anime.
_Avoid_: show, TV show, serial

**Season**:
One numbered part of a Series, as the movie database lists it, in broadcast order.
_Avoid_: series (for one part), part, volume

**Episode**:
One part of a Season, or a Special.
_Avoid_: ep, chapter

**Special**:
An Episode the movie database lists outside the numbered Seasons, such as a recap, a short or an OVA. An Owner can mark a Special watched, but Specials never count toward finishing a Series.
_Avoid_: extra, bonus, season 0

**Progress**:
Which Episodes of a Series an Owner has watched in the current Run. Gaps are possible, but Kinbox always shows the next Episode to watch.
_Avoid_: tracking, checklist, position

**Run**:
One pass through a Series, from the first Episode to finishing it. A rewatch starts a new Run with fresh Progress; earlier Runs keep only their Watches.
_Avoid_: playthrough, cycle

### People and Libraries

**Library**:
One person's whole collection of saved Titles, both to watch and watched. Private unless its Owner shares part of it.
_Avoid_: box, Kinbox (for the collection), collection, account

**Entry**:
An Owner's one record of one Title in their Library. It holds the Title's Status and the Owner's Watches. A Library has at most one Entry per Title.
_Avoid_: item, save, pick, card

**Status**:
Where an Entry stands: **To watch** (saved, not started), **Watching** (started, not finished), **Watched** (finished), or **Dropped** (started, will not finish). Movies and Series use the same Statuses.
_Avoid_: state, on hold, plan to watch, completed

**Watch**:
One time an Owner watched a Title, with its date or "date unknown". An Entry can have many Watches; a rewatch is another Watch. For a Series, a Watch means the Owner finished it.
_Avoid_: log, diary entry, view, play

**Rating**:
An Owner's score for a Title, from half a star to five stars in half-star steps. An Entry has at most one Rating, for the whole Title (a Series is rated as a whole). Only an Entry the Owner has started can get one.
_Avoid_: score, grade, like, stars (as a term)

**Note**:
An Owner's private text on an Entry. Never shown to anyone else.
_Avoid_: memo, comment, review

**Review**:
An Owner's written opinion of a Title, on its Entry. Others see it only where the Owner's Profile or Share link switches allow.
_Avoid_: note, comment, post

**Owner**:
The one person a Library belongs to. A Library has exactly one Owner. The Owner, not the Profile, holds the Library and its Lists.
_Avoid_: user, member, account

**Guest**:
An Owner with a local-only account: their Library lives only on their own device, and they cannot share it.
_Avoid_: anonymous user, trial user

**List**:
A named set of Titles an Owner picks from their Library. Every Title in a List is also in the Library; a Title can be in many Lists or none, and a List can mix statuses. A List keeps its Owner's own order and is private or public.
_Avoid_: collection, folder, playlist, shelf

**Pin**:
An Owner's mark on a To watch Entry that puts it at the top of To watch. It comes off when the Entry becomes Watched or Dropped.
_Avoid_: up next, favourite, star, priority

**Profile**:
An Owner's public page. Off by default; when on, it shows only the parts of the Library its Owner switches on, plus their public Lists. Turning it off never changes the Library.
_Avoid_: account, home, space

**Visitor**:
Someone who looks at an Owner's Profile or opens a Share link. A Visitor can only look, and may have no account.
_Avoid_: viewer, follower

**Share link**:
A secret, read-only address that shows one List, live, to anyone who has it. Its Owner can turn it off or reset it.
_Avoid_: public link, invite, profile

### Import

**Import**:
One paste of a list that Kinbox turns into Entries in one go. An Import remembers the Entries it created, so it can be undone; it never changes an Entry that was already in the Library.
_Avoid_: upload, sync, batch

**Import line**:
One line of pasted text that names a Title (or tries to). Headings, blank lines and URLs are not Import lines.
_Avoid_: row, item, entry

**Watched mark**:
A sign in an Import line, such as ✔, that says the Owner has watched that Title.
_Avoid_: tick (ticks are for Episodes), check, done mark

**Match**:
The Title Kinbox picks for an Import line from the movie database. The Owner can change or skip it before anything is added.
_Avoid_: result, hit, guess

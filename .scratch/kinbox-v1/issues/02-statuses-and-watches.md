# Statuses and watches

Type: grilling
Status: resolved
Blocked by: none
Map: [Kinbox v1](../map.md)

## Question

Which statuses does a saved Title have, how does it move between them, and what does a watch record?

- Statuses for a Movie and for a Series: to watch / watching / watched, plus maybe dropped, on hold, or "caught up, waiting for the next season".
- Adding a Title straight as watched (v1 is a real log).
- What a watch records: date (and whether a partial or unknown date is allowed); whether rewatches exist; whether a watch can be edited or deleted.
- Name the person's saved record of a Title and add it, with the statuses, to CONTEXT.md.

## Answer

- **Entry.** An Owner's one record of one Title in their Library. A Library has at most one Entry per Title.
- **Statuses.** One set for Movies and Series: **To watch**, **Watching**, **Watched**, **Dropped**. There is no "on hold" (that is Watching). "Caught up" is not a Status; Series progress works it out.
- **Watch.** A separate dated record of one time the Owner watched the Title. An Entry can have many Watches, and rewatches are free. For a Series, a Watch means finishing the series; Series progress may add season or episode detail under it.
- **Status and Watches always agree.** Moving an Entry to Watched always adds a Watch, and adding a Watch always sets Watched. Any Status can move to any other. Moving away from Watched keeps earlier Watches on the log. Deleting the last Watch sets the Status to To watch.
- **Watch dates stay in the background.** Marking watched is one tap and never asks for a date. Marking an Entry already in the Library as watched dates the Watch **today**; adding a new Title straight as watched dates it **"date unknown"**. The date shows small and the Owner can tap to change it, or set "date unknown". Partial dates are future scope.
- **Rewatch.** A "Watched again" action (working label) adds a Watch; the Status stays Watched. How a Series rewatch in progress shows belongs to Series progress.
- **Deleting.** The Owner can edit or delete a Watch. Deleting an Entry asks for confirmation, then removes the Title from the Library with its Watches, note, rating and List places.
- **Profile.** Dropped Entries show on the Profile only if the Owner turns on the **Dropped** switch (off by default). Watches logged before dropping stay on the watched log.

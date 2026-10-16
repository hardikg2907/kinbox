# Series progress

Type: grilling
Status: resolved
Blocked by: 02, 04
Map: [Kinbox v1](../map.md)

## Question

How does Kinbox keep a person's place in a Series?

- One "next episode" pointer (S2 E4) or a check per episode; marking a whole season at once.
- What happens when a new season airs after the person caught up.
- Specials / season 0, and episodes that air out of order.
- Whether a person can rate a season or an episode, or only the Series.
- Uses the episode data the chosen movie database provides.
- The owner wants to argue the case for and against a per-episode tracker here.
- From [Statuses and watches](02-statuses-and-watches.md): a Series Watch means finishing the series; "caught up" is worked out here, not a Status; decide how a rewatch in progress shows and whether season or episode records sit under a Watch.
- From [Sharing in v1](01-sharing-in-v1.md): series progress can show on the Profile under "Watching".

## Answer

- **Progress is per Episode, but the screen leads with one line.** Each Episode is watched or not, so gaps are possible (skipped filler). The screen shows "Next: S2 E4" with a one-tap "Watched it". Episode ticks show only when the Owner opens a Season. The [Series progress screen](20-series-progress-screen.md) prototype tests this.
- **Marking earlier Episodes.** When the Owner ticks an Episode with unticked Episodes before it, Kinbox ticks only that Episode, then offers "Also mark the 15 earlier episodes?" (working copy). One tap says yes; ignoring it says no. Each Season also has a "mark whole season" tick.
- **Finished vs ongoing.** A Series is finished when the movie database says it has ended or was cancelled. Any other state means more Episodes may come.
- **Caught up stays Watching.** When the Owner has watched every aired Episode of a Series that is not finished, the Entry stays Watching with a "caught up" marker (a working label, not a Status). The marker clears when new Episodes air.
- **Status moves from progress only go forward.**
  - Ticking any Episode of a To watch Entry moves it to Watching.
  - When every Episode of the numbered Seasons of a finished Series is ticked, the Entry moves to Watched and gets a Watch dated today. A gap (an unticked earlier Episode) keeps it in Watching.
  - Unticking an Episode never changes the Status or removes a Watch.
  - A Dropped Entry keeps its progress. Ticking an Episode moves it back to Watching.
- **One-tap Watched always works**, also on a Series that is not finished. It marks all aired Episodes.
- **New Episodes after Watched.** When a Watched Series gets a new Season (a revival, or a Series marked Watched while ongoing), the Entry stays Watched and shows a small marker that a new Season is out. One tap moves it to Watching; earlier Watches stay. Kinbox never changes the Status by itself. The prototype picks the words; "Continue" does not say that the new Season can be tracked here.
- **Specials** are listed and can be ticked. They never block "Next" or finishing.
- **Episode order** is the movie database's broadcast order. Other orders (anime intended or absolute order) are future scope.
- **Unaired Episodes** show greyed out with their air date. "Next" and "caught up" ignore them. The Owner can still tick one, because air dates follow the home country.
- **No Episode dates on screen.** A tick records no date the Owner sees or edits. Kinbox knows when progress last moved, so Watching can list the most recently watched Series first. An episode diary is future scope.
- **Rewatch.** On a Watched Series, "Watched again" (working label) asks: "Rewatching now" or "Already rewatched".
  - *Rewatching now*: after a confirm, the ticks clear, the Entry moves to Watching with a "Rewatch" label, and "Next" starts at S1 E1. Finishing adds a new Watch.
  - *Already rewatched*: adds a Watch, as for a Movie.
  - Progress is always the current run. Earlier runs keep their Watches, not their ticks.
  - If the prototype shows the two choices confuse people, fall back to "Watched again" adding a Watch only.
- **Ratings.** In v1, only the whole Series gets a rating, the same as a Movie. Season and episode ratings are future scope. The scale belongs to [Notes, ratings, reviews](06-notes-ratings-reviews.md).
- **Profile.** Under "Watching", a Visitor sees the exact place ("S2 E4").
- **Adding a Series already in progress.** Choosing Watching while adding a Series offers an optional "Where are you?" (Season and Episode). It is never required. The [Add-a-title flow](08-add-a-title-flow.md) decides the screen.
- **When the movie database changes Episodes** (recreated Episodes, merged Seasons): progress is never silently lost. Kinbox keeps the place as close as it can. When it cannot be sure, it tells the Owner to check their place, and one bulk mark fixes it. [Keeping Title data fresh](18-keeping-title-data-fresh.md) decides how.

Findings: [TMDB episode data](../research/tmdb-episode-data.md), [rating research](../research/rating-granularity.md).

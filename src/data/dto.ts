import type { EpisodeKey, IsoDate, Status, TitleKind } from "@/domain/types";

// The only shapes that cross from the server to the screens. Keep them small:
// never pass database rows or raw TMDB responses to the client.

export type EntryRef = { id: string; status: Status };

export type SearchItem = {
  kind: TitleKind;
  tmdbId: number;
  name: string;
  year: number | null;
  posterPath: string | null;
  /** The Owner's Entry for this Title, when it is already in the Library. */
  entry: EntryRef | null;
};

export type KindFilter = "all" | "movie" | "series";

export type NextEpisode = EpisodeKey & {
  name: string | null;
  /** "S2 E4" */
  label: string;
};

export type CardProgress = {
  next: NextEpisode | null;
  caughtUp: boolean;
  allNumberedWatched: boolean;
};

export type LibraryCard = {
  entryId: string;
  kind: TitleKind;
  name: string;
  year: number | null;
  posterPath: string | null;
  status: Status;
  /** Watching Series only. Null when TMDB could not be reached. */
  progress: CardProgress | null;
  /** Watched tab: the latest Watch date, or null for "date unknown". */
  latestWatchOn: IsoDate | null;
};

export type LibraryView = {
  tab: Status;
  kind: KindFilter;
  counts: Record<Status, number>;
  cards: LibraryCard[];
};

export type WatchView = { id: string; watchedOn: IsoDate | null };

export type SeasonSummaryView = {
  seasonNumber: number;
  name: string;
  isSpecials: boolean;
  episodeCount: number;
  watchedCount: number;
  airedCount: number;
};

export type SeriesProgressView = {
  finished: boolean;
  next: NextEpisode | null;
  caughtUp: boolean;
  allNumberedWatched: boolean;
  watchedCount: number;
  airedCount: number;
  totalCount: number;
  /** Numbered Seasons in order, then Specials last when TMDB lists any. */
  seasons: SeasonSummaryView[];
};

export type EntryView = {
  id: string;
  status: Status;
  ratingHalfStars: number | null;
  canRate: boolean;
  note: string | null;
  title: {
    kind: TitleKind;
    tmdbId: number;
    name: string;
    year: number | null;
    posterPath: string | null;
    overview: string | null;
    runtimeMinutes: number | null;
  };
  /** Newest date first; "date unknown" Watches last. */
  watches: WatchView[];
  /** Series only. Null for a Movie, or when TMDB could not be reached. */
  series: SeriesProgressView | null;
  /** True when the TMDB data on this page is the stored snapshot because TMDB failed. */
  tmdbUnavailable: boolean;
};

export type EpisodeView = EpisodeKey & {
  tmdbEpisodeId: number;
  name: string | null;
  airDate: IsoDate | null;
  aired: boolean;
  watched: boolean;
  /** "S2 E4", or "Special 3". */
  label: string;
};

export type SeasonView = {
  seasonNumber: number;
  name: string;
  episodes: EpisodeView[];
};

/** What "Watched it" changed, so "Undo" can put it back. The screen passes it back unchanged. */
export type WatchedNextUndo = EpisodeKey & {
  previousStatus: Status;
  /** The Watch the tap added (finishing a finished Series), or null. */
  addedWatchId: string | null;
  /** ISO timestamps from before the tap, so Undo also puts the card back in its place. */
  previousProgressMovedAt: string | null;
  previousStatusChangedAt: string;
};

/** What a tap on the Series progress path changed, so the screen can confirm it. */
export type ProgressChange = {
  status: Status;
  /** The Status moved because of this tap (To watch or Dropped → Watching, or → Watched). */
  statusChanged: boolean;
  /** A Watch was added (finishing a finished Series). Show the optional stars. */
  addedWatch: boolean;
  /** After ticking one Episode: unwatched numbered Episodes before it, for the "also mark" offer. */
  earlierUnwatchedCount: number;
  progress: SeriesProgressView;
  /** Filled only by "Watched it"; null after every other tap. */
  undo: WatchedNextUndo | null;
};

/**
 * What a Status move changed, so "Undo" can put it back. The screen passes it back unchanged.
 * Times are exact database stamps, to the microsecond.
 */
export type StatusMoveUndo = {
  entryId: string;
  /** Where the move left the Entry. */
  status: Status;
  previousStatus: Status;
  /** Times from before the move, so Undo also puts the card back in its place. */
  previousStatusChangedAt: string;
  previousProgressMovedAt: string | null;
  /** The database time of the move. The Watch and ticks it added carry it, which is how Undo finds them. */
  movedAt: string;
  addedWatchId: string | null;
  tickedCount: number;
  /** The Entry's Watches right after the move; another count means something changed since. */
  watchCount: number;
};

/** What a Status move did, so the screen can name it ("Now watching") and offer Undo. */
export type StatusMove = {
  status: Status;
  previousStatus: Status;
  /** "Mark as watched" or "Watched again" added a Watch dated today. */
  addedWatch: boolean;
  /** Episodes ticked by "Mark as watched" on a Series; 0 for every other move. */
  tickedCount: number;
  /** Null when the move changed nothing, so there is nothing to undo. */
  undo: StatusMoveUndo | null;
};

/** "Watched again" always adds a Watch, and the screen shows it at once. */
export type WatchAgainMove = StatusMove & { watch: WatchView };

export type SaveResult = {
  entryId: string;
  status: Status;
  /** False when the Title was already in the Library (a double tap, or two tabs). */
  created: boolean;
  /** A Series saved as Watching: its numbered Seasons, for the optional "next to watch" picker. */
  seasons: { seasonNumber: number; name: string; episodeCount: number }[] | null;
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

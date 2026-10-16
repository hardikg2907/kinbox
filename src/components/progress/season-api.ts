import type { EpisodeView, SeasonView } from "@/data/dto";

export const SEASON_ERROR = "Couldn't load these episodes. Try again.";

export class SeasonLoadError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEpisode(value: unknown): value is EpisodeView {
  return (
    isRecord(value) &&
    typeof value.seasonNumber === "number" &&
    typeof value.episodeNumber === "number" &&
    typeof value.label === "string" &&
    typeof value.watched === "boolean" &&
    typeof value.aired === "boolean" &&
    (value.name === null || typeof value.name === "string") &&
    (value.airDate === null || typeof value.airDate === "string")
  );
}

function isSeason(value: unknown): value is SeasonView {
  return (
    isRecord(value) &&
    typeof value.seasonNumber === "number" &&
    Array.isArray(value.episodes) &&
    value.episodes.every(isEpisode)
  );
}

/** Fetches the Episodes of one Season. Throws a SeasonLoadError whose message is safe to show. */
export async function fetchSeason(entryId: string, seasonNumber: number): Promise<SeasonView> {
  let response: Response;
  try {
    response = await fetch(`/api/entries/${encodeURIComponent(entryId)}/seasons/${seasonNumber}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new SeasonLoadError(SEASON_ERROR);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isRecord(body) && typeof body.error === "string" ? body.error : SEASON_ERROR;
    throw new SeasonLoadError(message);
  }
  if (!isSeason(body)) throw new SeasonLoadError(SEASON_ERROR);
  return body;
}

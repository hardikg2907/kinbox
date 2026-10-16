// Records the fixtures behind the fake TMDB client:
//   KINBOX_ENV_DIR=<folder with .env.local> pnpm tsx --conditions=react-server scripts/record-tmdb-fixtures.ts
// KINBOX_ENV_DIR is only needed when the working folder has no env files of its own (a git worktree).
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { Episode, IsoDate } from "@/domain/types";
import { createRealTmdbClient, TmdbUnavailableError } from "@/lib/tmdb/real";
import { movieDetailsSchema, seriesFixtureSchema, type SeriesFixture } from "@/lib/tmdb/schemas";
import type { MovieDetails, TmdbClient } from "@/lib/tmdb/types";

loadEnvConfig(process.env.KINBOX_ENV_DIR ?? process.cwd(), true);

const FIXTURES_DIR = path.resolve(process.cwd(), "src/lib/tmdb/fixtures");

const MOVIE_IDS = [27205, 603, 693134];
// Ended Series that has Specials (Season 0).
const ENDED_SERIES = { id: 1396, seasons: [0, 1, 2] };
const CANCELED_SERIES = { id: 63247, seasons: [1, 2] };
// Returning Series; its last Season is edited so it has unaired and undated Episodes.
const ONGOING_SERIES = { id: 250307, seasons: [1, 2] };
const ONGOING_FIRST_UNAIRED_EPISODE = 11;
// The edited Episodes air in 2030 so they stay unaired for as long as the fixture is useful.
const ONGOING_UNAIRED_START = Date.UTC(2030, 0, 4);
const DAY_MS = 24 * 60 * 60 * 1000;

function firstSentence(text: string | null): string | null {
  if (text === null) return null;
  const match = /^[\s\S]*?[.!?](?=\s|$)/.exec(text);
  const sentence = (match ? match[0] : text).trim();
  return sentence.length > 240 ? `${sentence.slice(0, 237).trimEnd()}...` : sentence;
}

function isoDate(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

function lastAiredEpisode(episodes: Episode[], today: IsoDate): Episode | null {
  const aired = episodes.filter((episode) => episode.airDate !== null && episode.airDate <= today);
  return aired.at(-1) ?? null;
}

async function recordMovie(client: TmdbClient, id: number): Promise<MovieDetails> {
  const movie = await client.getMovie(id);
  if (!movie) throw new Error(`Movie ${id} was not found`);
  return movieDetailsSchema.parse({ ...movie, overview: firstSentence(movie.overview) });
}

async function recordSeries(
  client: TmdbClient,
  target: { id: number; seasons: number[] },
): Promise<SeriesFixture> {
  const [details, seasons] = await Promise.all([
    client.getSeries(target.id),
    client.getSeasons(target.id, target.seasons),
  ]);
  if (!details) throw new Error(`Series ${target.id} was not found`);

  const keptSeasons = seasons.filter((season) => target.seasons.includes(season.seasonNumber));
  const lastAired = lastAiredEpisode(
    keptSeasons.filter((season) => season.seasonNumber > 0).flatMap((season) => season.episodes),
    isoDate(Date.now()),
  );

  return seriesFixtureSchema.parse({
    details: {
      ...details,
      overview: firstSentence(details.overview),
      // The shipped Seasons are a subset, so the Series pointers follow them.
      seasons: details.seasons.filter((season) => target.seasons.includes(season.seasonNumber)),
      lastEpisodeToAir: lastAired && {
        seasonNumber: lastAired.seasonNumber,
        episodeNumber: lastAired.episodeNumber,
        airDate: lastAired.airDate,
      },
      nextEpisodeToAir: null,
    },
    seasons: keptSeasons,
  });
}

function makeOngoing(recorded: SeriesFixture): SeriesFixture {
  const last = recorded.seasons.at(-1);
  if (!last || last.episodes.length < ONGOING_FIRST_UNAIRED_EPISODE + 1) {
    throw new Error("The ongoing Series needs a last Season with enough Episodes to edit");
  }

  const rescheduled: Episode[] = last.episodes.map((episode) =>
    episode.episodeNumber >= ONGOING_FIRST_UNAIRED_EPISODE
      ? {
          ...episode,
          airDate: isoDate(
            ONGOING_UNAIRED_START +
              (episode.episodeNumber - ONGOING_FIRST_UNAIRED_EPISODE) * 7 * DAY_MS,
          ),
        }
      : episode,
  );
  const lastEpisode = rescheduled.at(-1);
  if (!lastEpisode) throw new Error("The last Season has no Episodes");
  const undated: Episode = {
    tmdbEpisodeId: Math.max(...rescheduled.map((episode) => episode.tmdbEpisodeId)) + 1,
    seasonNumber: last.seasonNumber,
    episodeNumber: lastEpisode.episodeNumber + 1,
    name: null,
    airDate: null,
  };
  const episodes = [...rescheduled, undated];

  const lastAired = episodes.find((e) => e.episodeNumber === ONGOING_FIRST_UNAIRED_EPISODE - 1);
  const nextUp = episodes.find((e) => e.episodeNumber === ONGOING_FIRST_UNAIRED_EPISODE);
  if (!lastAired || !nextUp) throw new Error("Could not place the aired and unaired Episodes");

  return seriesFixtureSchema.parse({
    details: {
      ...recorded.details,
      name: `${recorded.details.name} (fixture)`,
      status: "Returning Series",
      seasons: recorded.details.seasons.map((season) =>
        season.seasonNumber === last.seasonNumber
          ? { ...season, episodeCount: episodes.length }
          : season,
      ),
      lastEpisodeToAir: {
        seasonNumber: lastAired.seasonNumber,
        episodeNumber: lastAired.episodeNumber,
        airDate: lastAired.airDate,
      },
      nextEpisodeToAir: {
        seasonNumber: nextUp.seasonNumber,
        episodeNumber: nextUp.episodeNumber,
        airDate: nextUp.airDate,
      },
    },
    seasons: [...recorded.seasons.slice(0, -1), { ...last, episodes }],
  });
}

async function writeFixture(fileName: string, value: unknown): Promise<void> {
  await writeFile(path.join(FIXTURES_DIR, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

async function main(): Promise<void> {
  const token = process.env.TMDB_API_READ_TOKEN;
  console.log(`token present: ${token ? "yes" : "no"}`);
  if (!token) {
    process.exitCode = 1;
    return;
  }

  const client = createRealTmdbClient({ token });
  await mkdir(FIXTURES_DIR, { recursive: true });

  for (const id of MOVIE_IDS) {
    const movie = await recordMovie(client, id);
    await writeFixture(`movie-${id}.json`, movie);
    console.log(`movie: ${movie.name}`);
  }

  for (const target of [ENDED_SERIES, CANCELED_SERIES, ONGOING_SERIES]) {
    const recorded = await recordSeries(client, target);
    const fixture = target === ONGOING_SERIES ? makeOngoing(recorded) : recorded;
    await writeFixture(`series-${target.id}.json`, fixture);
    console.log(
      `series: ${fixture.details.name} [${fixture.details.status}] seasons ${fixture.seasons
        .map((season) => season.seasonNumber)
        .join(",")}`,
    );
  }
}

main().catch((error: unknown) => {
  // Only the error type, status and path: a message could echo response text.
  const detail =
    error instanceof TmdbUnavailableError
      ? ` (status ${error.status ?? "none"}, path ${error.path ?? "none"})`
      : "";
  console.error(`Recording failed: ${error instanceof Error ? error.name : "unknown error"}${detail}`);
  process.exitCode = 1;
});

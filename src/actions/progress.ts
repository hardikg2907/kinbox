"use server";

import type { ActionResult, ProgressChange } from "@/data/dto";
import * as data from "@/data/progress";
import { runAction } from "./run";

export async function tickEpisode(
  input: data.TickEpisodeInput,
): Promise<ActionResult<ProgressChange>> {
  return runAction("tickEpisode", data.tickEpisodeInput, input, data.tickEpisode);
}

export async function markEarlier(input: data.EpisodeInput): Promise<ActionResult<ProgressChange>> {
  return runAction("markEarlier", data.episodeInput, input, data.markEarlier);
}

export async function markSeason(
  input: data.MarkSeasonInput,
): Promise<ActionResult<ProgressChange>> {
  return runAction("markSeason", data.markSeasonInput, input, data.markSeason);
}

export async function watchedNext(
  input: data.WatchedNextInput,
): Promise<ActionResult<ProgressChange>> {
  return runAction("watchedNext", data.watchedNextInput, input, data.watchedNext);
}

export async function undoWatchedNext(
  input: data.UndoWatchedNextInput,
): Promise<ActionResult<ProgressChange>> {
  return runAction("undoWatchedNext", data.undoWatchedNextInput, input, data.undoWatchedNext);
}

export async function setNextToWatch(
  input: data.EpisodeInput,
): Promise<ActionResult<ProgressChange>> {
  return runAction("setNextToWatch", data.episodeInput, input, data.setNextToWatch);
}

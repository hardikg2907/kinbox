"use server";

import type { Status } from "@/domain/types";
import type {
  ActionResult,
  SaveResult,
  StatusMove,
  WatchAgainMove,
  WatchView,
} from "@/data/dto";
import * as data from "@/data/entries";
import { runAction } from "./run";

export async function saveTitle(input: data.SaveTitleInput): Promise<ActionResult<SaveResult>> {
  return runAction("saveTitle", data.saveTitleInput, input, data.saveTitle);
}

export async function setStatus(input: data.SetStatusInput): Promise<ActionResult<StatusMove>> {
  return runAction("setStatus", data.setStatusInput, input, data.setStatus);
}

export async function watchAgain(input: data.EntryIdInput): Promise<ActionResult<WatchAgainMove>> {
  return runAction("watchAgain", data.entryIdInput, input, data.watchAgain);
}

export async function undoStatusMove(
  input: data.UndoStatusMoveInput,
): Promise<ActionResult<{ status: Status }>> {
  return runAction("undoStatusMove", data.undoStatusMoveInput, input, data.undoStatusMove);
}

export async function setWatchDate(
  input: data.SetWatchDateInput,
): Promise<ActionResult<{ watch: WatchView }>> {
  return runAction("setWatchDate", data.setWatchDateInput, input, data.setWatchDate);
}

export async function deleteWatch(
  input: data.WatchIdInput,
): Promise<ActionResult<{ status: Status }>> {
  return runAction("deleteWatch", data.watchIdInput, input, data.deleteWatch);
}

export async function setRating(
  input: data.SetRatingInput,
): Promise<ActionResult<{ ratingHalfStars: number | null }>> {
  return runAction("setRating", data.setRatingInput, input, data.setRating);
}

export async function setNote(
  input: data.SetNoteInput,
): Promise<ActionResult<{ note: string | null }>> {
  return runAction("setNote", data.setNoteInput, input, data.setNote);
}

export async function deleteEntry(input: data.EntryIdInput): Promise<ActionResult<null>> {
  return runAction("deleteEntry", data.entryIdInput, input, data.deleteEntry);
}

"use server";

import type { ActionResult, ImportRowResult } from "@/data/dto";
import * as data from "@/data/import";
import { runAction } from "./run";

export async function startImport(): Promise<ActionResult<{ importId: string }>> {
  return runAction("startImport", data.startImportInput, {}, (owner) => data.startImport(owner));
}

export async function addToImport(
  input: data.AddImportRowsInput,
): Promise<ActionResult<ImportRowResult[]>> {
  return runAction("addToImport", data.addImportRowsInput, input, data.addImportRows);
}

export async function finishImport(input: data.ImportIdInput): Promise<ActionResult<null>> {
  return runAction("finishImport", data.importIdInput, input, data.finishImport);
}

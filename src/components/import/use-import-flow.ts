"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { addToImport, finishImport, startImport, undoImport } from "@/actions/import";
import type { ActionResult, ImportCandidate, ImportLineMatch } from "@/data/dto";
import { readPastedList, type ImportLine } from "@/domain/import-lines";
import type { Status } from "@/domain/types";
import {
  addBatches,
  addInput,
  applyCheckReply,
  failedCompletely,
  failedRows,
  includeLines,
  matchRequest,
  nextCheckBatch,
  nextFailureCount,
  pasteCount,
  pickTitle,
  recordAddReply,
  rowsToAdd,
  setIntent,
  shouldStopChecking,
  skipLines,
  startCheck,
  TMDB_DOWN_MESSAGE,
  undoDoneMessage,
  type AddResults,
  type AddRow,
  type CheckState,
} from "./import-model";

export type Step = "paste" | "check" | "add" | "result";
/** "stopped": two requests in a row failed completely; "signed_out": the session is gone. */
export type CheckRun = "idle" | "running" | "done" | "stopped" | "signed_out";

const TEXT_KEY = "kinbox:import-text";
const SAVE_DELAY_MS = 400;
const GENERIC_ERROR = "Couldn't save that. Try again.";

// ---- The device copy of the pasted text -------------------------------------------------------
// Storage can be missing or refuse (private windows, blocked site data); the page works without it.

export function readStoredText(): string {
  try {
    return window.localStorage.getItem(TEXT_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeText(text: string): void {
  try {
    if (text === "") window.localStorage.removeItem(TEXT_KEY);
    else window.localStorage.setItem(TEXT_KEY, text);
  } catch {
    // Without storage a reload loses the text; nothing else depends on it.
  }
}

function clearStoredText(): void {
  storeText("");
}

// ---- Requests ---------------------------------------------------------------------------------

type MatchReply = { kind: "ok"; lines: ImportLineMatch[] } | { kind: "failed" } | { kind: "signed_out" };

async function postMatch(lines: readonly ImportLine[]): Promise<MatchReply> {
  try {
    const response = await fetch("/api/import/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(matchRequest(lines)),
    });
    if (response.status === 401) return { kind: "signed_out" };
    if (!response.ok) return { kind: "failed" };
    const body: unknown = await response.json();
    const replyLines = typeof body === "object" && body !== null && "lines" in body ? body.lines : null;
    return Array.isArray(replyLines) ? { kind: "ok", lines: replyLines as ImportLineMatch[] } : { kind: "failed" };
  } catch {
    return { kind: "failed" };
  }
}

// A Server Action that throws (the network dropped) reads as an ordinary failure.
async function call<T>(action: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return (await action()) ?? { ok: false, error: GENERIC_ERROR };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ---- The flow ---------------------------------------------------------------------------------

export type ImportFlow = ReturnType<typeof useImportFlow>;

/**
 * Drives the three steps: one match request at a time while checking, one batch at a time while
 * adding. Each run carries a token; anything that ends a run (Stop, leaving, a new run) changes
 * the token, and a reply for an older token is dropped. Runs are not cancelled when the page hides:
 * Next.js keeps a page it navigated away from, so a run that finishes there leaves the page right.
 */
export function useImportFlow(initialText: string) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [step, setStep] = useState<Step>("paste");
  const [check, setCheck] = useState<CheckState | null>(null);
  const [checkRun, setCheckRun] = useState<CheckRun>("idle");
  const [retrying, setRetrying] = useState<ReadonlySet<number>>(new Set());
  const [plan, setPlan] = useState<AddRow[]>([]);
  const [results, setResults] = useState<AddResults>({});
  // `from` is the step whose screen stays up, out of reach, while the rows go in.
  const [adding, setAdding] = useState<{ done: number; total: number; from: Step } | null>(null);
  const [leaving, setLeaving] = useState(false);

  const run = useRef(0);
  const importId = useRef<string | null>(null);
  // The latest Check state, for handlers that start a request from it.
  const latestCheck = useRef<CheckState | null>(null);
  useEffect(() => {
    latestCheck.current = check;
  }, [check]);

  // The text is kept on the device while it is being written, so a reload loses nothing.
  useEffect(() => {
    if (step !== "paste") return;
    const timer = window.setTimeout(() => storeText(text), SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [text, step]);

  // Leaving while Titles are being added asks the browser to confirm first.
  useEffect(() => {
    if (step !== "add") return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Older browsers show the prompt only when this is set.
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [step]);

  function reset(nextText: string) {
    run.current += 1;
    importId.current = null;
    setText(nextText);
    setStep("paste");
    setCheck(null);
    setCheckRun("idle");
    setRetrying(new Set());
    setPlan([]);
    setResults({});
    setAdding(null);
    setLeaving(false);
  }

  async function runChecks(from: CheckState, token: number) {
    let local = from;
    let failures = 0;
    setCheckRun("running");
    for (;;) {
      const batch = nextCheckBatch(local);
      if (batch.length === 0) break;
      const reply = await postMatch(batch);
      if (run.current !== token) return;
      if (reply.kind === "signed_out") {
        setCheckRun("signed_out");
        return;
      }
      const lines = reply.kind === "ok" ? reply.lines : null;
      const ids = batch.map((line) => line.id);
      failures = nextFailureCount(failures, lines);
      local = applyCheckReply(local, ids, lines);
      setCheck((current) => current && applyCheckReply(current, ids, lines));
      if (shouldStopChecking(failures)) {
        setCheckRun("stopped");
        return;
      }
    }
    setCheckRun("done");
  }

  function startChecking() {
    const list = readPastedList(text);
    if (!pasteCount(list).canCheck) return;
    storeText(text);
    const state = startCheck(list);
    const token = ++run.current;
    setCheck(state);
    setStep("check");
    void runChecks(state, token);
  }

  /** After a stop: carries on from the first line not checked yet. */
  function continueChecking() {
    const state = latestCheck.current;
    if (!state) return;
    void runChecks(state, ++run.current);
  }

  function retryLines(ids: readonly number[]) {
    const state = latestCheck.current;
    if (!state || ids.length === 0) return;
    const token = run.current;
    setRetrying((current) => new Set([...current, ...ids]));
    void postMatch(ids.map((id) => state.lines[id])).then((reply) => {
      if (run.current !== token) return;
      setRetrying((current) => new Set([...current].filter((id) => !ids.includes(id))));
      if (reply.kind === "signed_out") {
        setCheckRun("signed_out");
        return;
      }
      const lines = reply.kind === "ok" ? reply.lines : null;
      if (failedCompletely(lines)) toast.error(TMDB_DOWN_MESSAGE);
      setCheck((current) => current && applyCheckReply(current, ids, lines));
    });
  }

  function change(next: (state: CheckState) => CheckState) {
    setCheck((current) => current && next(current));
  }

  async function runAdds(rows: AddRow[], from: "check" | "result", token: number) {
    setStep("add");
    setAdding({ done: 0, total: rows.length, from });

    let id = importId.current;
    if (id === null) {
      const started = await call(startImport);
      if (run.current !== token) return;
      if (!started.ok) {
        toast.error(started.error);
        setAdding(null);
        setStep(from);
        return;
      }
      id = started.data.importId;
      importId.current = id;
    }

    let firstError: string | null = null;
    let done = 0;
    for (const batch of addBatches(rows)) {
      const openId = id;
      const reply = await call(() => addToImport({ importId: openId, rows: addInput(batch) }));
      if (run.current !== token) return;
      if (!reply.ok) firstError ??= reply.error;
      setResults((current) => recordAddReply(current, batch, reply.ok ? reply.data : null));
      done += batch.length;
      setAdding({ done, total: rows.length, from });
    }

    setAdding(null);
    setStep("result");
    clearStoredText();
    if (firstError) toast.error(firstError);
  }

  function startAdding() {
    const state = latestCheck.current;
    if (!state) return;
    const rows = rowsToAdd(state);
    if (rows.length === 0) return;
    setPlan(rows);
    setResults({});
    void runAdds(rows, "check", ++run.current);
  }

  /** From the result screen: sends the failed rows again, under the same Import. */
  function retryFailed() {
    const rows = failedRows(plan, results);
    if (rows.length === 0) return;
    void runAdds(rows, "result", ++run.current);
  }

  /** Stops adding and leaves; Titles already added stay, and the text stays on the device. */
  function stopAdding() {
    const id = importId.current;
    reset(text);
    router.push("/");
    // The next start closes it anyway if this call is lost.
    if (id !== null) void call(() => finishImport({ importId: id }));
  }

  /** Leaves the result screen: closes the Import and starts the next visit afresh. */
  async function leave() {
    if (leaving) return;
    setLeaving(true);
    const id = importId.current;
    if (id !== null) await call(() => finishImport({ importId: id }));
    reset("");
    router.replace("/");
  }

  /** Undo this import. Resolves false when it failed, so the dialog can stay open. */
  async function undo(): Promise<boolean> {
    const id = importId.current;
    if (id === null) return false;
    const result = await call(() => undoImport({ importId: id }));
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(undoDoneMessage(result.data.removed, result.data.kept));
    clearStoredText();
    reset("");
    router.replace("/");
    return true;
  }

  return {
    text,
    setText,
    step,
    check,
    checkRun,
    retrying,
    plan,
    results,
    adding,
    leaving,
    startChecking,
    continueChecking,
    retryLines,
    pick: (ids: readonly number[], title: ImportCandidate) => change((state) => pickTitle(state, ids, title)),
    skip: (ids: readonly number[]) => change((state) => skipLines(state, ids)),
    include: (ids: readonly number[]) => change((state) => includeLines(state, ids)),
    choose: (ids: readonly number[], intent: Status) => change((state) => setIntent(state, ids, intent)),
    startAdding,
    retryFailed,
    stopAdding,
    leave,
    undo,
  };
}

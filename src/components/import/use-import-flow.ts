"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
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

/** A call that threw: the network dropped, or the session is gone and Next.js is off to sign in. */
type Rejected = { ok: false; error: string; rejected: true };

// A Server Action that throws reads as a failure, marked so a loop knows to stop sending.
async function call<T>(action: () => Promise<ActionResult<T>>): Promise<ActionResult<T> | Rejected> {
  try {
    return (await action()) ?? { ok: false, error: GENERIC_ERROR };
  } catch {
    return { ok: false, error: GENERIC_ERROR, rejected: true };
  }
}

// ---- The flow ---------------------------------------------------------------------------------

export type ImportFlow = ReturnType<typeof useImportFlow>;

/**
 * Drives the three steps: one match request at a time while checking, one batch at a time while
 * adding. Each run carries a token; anything that ends a run (Stop, leaving, a new run) changes
 * the token, and a reply for an older token is dropped. Next.js keeps a page it navigated away
 * from, hidden, and shows it again as it was. A run carries on there, so the page is right when it
 * comes back; an ending (the result, a lost session) is wrapped up as the page hides instead. The
 * one exception is a result that a rejected call ended: it stays for the next visit.
 */
export function useImportFlow(initialText: string) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [step, setStep] = useState<Step>("paste");
  const [check, setCheck] = useState<CheckState | null>(null);
  const [checkRun, setCheckRun] = useState<CheckRun>("idle");
  // Each line being checked again, with the request checking it, so a late reply clears only its own.
  const [retrying, setRetrying] = useState<ReadonlyMap<number, number>>(new Map());
  const retryingIds = useMemo<ReadonlySet<number>>(() => new Set(retrying.keys()), [retrying]);
  const retryRequest = useRef(0);
  const [plan, setPlan] = useState<AddRow[]>([]);
  const [results, setResults] = useState<AddResults>({});
  // `from` is the step whose screen stays up, out of reach, while the rows go in.
  const [adding, setAdding] = useState<{ done: number; total: number; from: Step } | null>(null);
  const [leaving, setLeaving] = useState(false);

  const run = useRef(0);
  const importId = useRef<string | null>(null);
  // A rejected call can mean the session is gone and Next.js is off to the sign-in page, which hides
  // this one. The result it ended must outlive that, or the failed rows and "Undo" are lost.
  const endedByRejectedCall = useRef(false);
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
    endedByRejectedCall.current = false;
    setText(nextText);
    setStep("paste");
    setCheck(null);
    setCheckRun("idle");
    setRetrying(new Map());
    setPlan([]);
    setResults({});
    setAdding(null);
    setLeaving(false);
  }

  async function runChecks(from: CheckState, token: number) {
    let local = from;
    let failures = 0;
    setCheckRun("running");
    // The new token drops the reply of any row still being checked again, so its lines stop waiting now.
    setRetrying(new Map());
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
    if (!state || retrying.size > 0) return;
    void runChecks(state, ++run.current);
  }

  /** Checks "Couldn't check" lines again, only once the main check has ended: one request at a time. */
  function retryLines(ids: readonly number[]) {
    const state = latestCheck.current;
    if (!state || ids.length === 0 || checkRun === "running") return;
    const token = run.current;
    const request = ++retryRequest.current;
    setRetrying((current) => new Map([...current, ...ids.map((id): [number, number] => [id, request])]));
    void postMatch(ids.map((id) => state.lines[id])).then((reply) => {
      // Cleared even for a reply dropped below, or "Add" would wait for these lines for ever.
      setRetrying((current) => new Map([...current].filter(([, by]) => by !== request)));
      if (run.current !== token) return;
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
    endedByRejectedCall.current = false;
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
    const batches = addBatches(rows);
    for (const [index, batch] of batches.entries()) {
      const openId = id;
      const reply = await call(() => addToImport({ importId: openId, rows: addInput(batch) }));
      if (run.current !== token) return;
      if (!reply.ok && "rejected" in reply) {
        // Every later call would fail the same way, or, signed out, go on adding behind the sign-in
        // page. The rows left count as failed so "Try again" can send them. No toast: the result
        // lists them, and the Owner may be on the sign-in page by now.
        setResults((current) => recordAddReply(current, batches.slice(index).flat(), null));
        endedByRejectedCall.current = true;
        break;
      }
      if (!reply.ok) firstError ??= reply.error;
      setResults((current) => recordAddReply(current, batch, reply.ok ? reply.data : null));
      done += batch.length;
      setAdding({ done, total: rows.length, from });
    }

    setAdding(null);
    setStep("result");
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

  /** Closes the Import; its text leaves the device with it. */
  async function closeImport() {
    const id = importId.current;
    // Both before the call: a second way out while it runs must not close it again, and a paste
    // started meanwhile (the page can hide and come back) must keep its text.
    importId.current = null;
    clearStoredText();
    if (id !== null) await call(() => finishImport({ importId: id }));
  }

  /** Leaves the result screen: closes the Import and starts the next visit afresh. */
  async function leave() {
    if (leaving) return;
    setLeaving(true);
    await closeImport();
    reset("");
    router.replace("/");
  }

  // Runs as the page hides (Back, a link, the sign-in page), so the next visit never opens on an
  // old result or a lost session. A run still going is left alone; see the note above the hook.
  // In development, StrictMode and Fast Refresh also run this cleanup, so the wrap-up can run there
  // without the page hiding; production runs it only when the page hides.
  const onHide = useEffectEvent(() => {
    if (step === "result") {
      if (endedByRejectedCall.current) return;
      void closeImport();
      reset("");
    } else if (checkRun === "signed_out") {
      reset(text);
    }
  });
  useLayoutEffect(() => () => onHide(), []);

  /** Undo this import. Resolves false when it failed, so the Undo button can be pressed again. */
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
    retrying: retryingIds,
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

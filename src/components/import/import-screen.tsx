"use client";

import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ImportCandidate } from "@/data/dto";
import { MAX_PASTE_CHARACTERS, readPastedList } from "@/domain/import-lines";
import { CheckStep } from "./check-step";
import {
  ImportActionBar,
  ImportContent,
  ImportSkeleton,
  ImportTopBar,
  PASTE_HELP,
  PASTE_LABEL,
} from "./import-frame";
import {
  addedLabel,
  addingLabel,
  addLabel,
  buildRows,
  checkedCount,
  checkedLabel,
  checkingLabel,
  couldNotAddLabel,
  linesNotAdded,
  pasteCount,
  rowsToAdd,
  SIGN_IN_MESSAGE,
  summarizeImport,
  TMDB_DOWN_MESSAGE,
  type PasteCount,
  type Row,
} from "./import-model";
import { PickSheet, type PickTarget } from "./pick-sheet";
import { ResultStep } from "./result-step";
import { readStoredText, useImportFlow, type ImportFlow } from "./use-import-flow";

const LIMIT_MESSAGE = "Up to 500 lines at a time. Paste the rest after this import.";
/** Space kept between a focused control and the bars, in px. */
const FOCUS_CLEARANCE = 12;

const noop = () => () => {};

/** The /import page. It waits for the browser before it shows the saved text, so nothing flashes. */
export function ImportScreen() {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? <ImportFlowView /> : <ImportSkeleton />;
}

function ImportFlowView() {
  const [initialText] = useState(readStoredText);
  const flow = useImportFlow(initialText);
  const [stopOpen, setStopOpen] = useState(false);
  // Adding may finish while the question is up; then there is nothing left to stop.
  if (stopOpen && flow.step !== "add") setStopOpen(false);

  // Counting a long paste on every key would make typing lag; the count may trail a frame behind.
  const deferredText = useDeferredValue(flow.text);
  const count = useMemo(() => pasteCount(readPastedList(deferredText)), [deferredText]);
  const rows = useMemo(() => (flow.check ? buildRows(flow.check) : []), [flow.check]);
  const addCount = useMemo(() => (flow.check ? rowsToAdd(flow.check).length : 0), [flow.check]);
  const summary = useMemo(() => summarizeImport(flow.plan, flow.results), [flow.plan, flow.results]);
  const notAdded = useMemo(
    () => (flow.check && flow.plan.length > 0 ? linesNotAdded(flow.check, flow.results) : []),
    [flow.check, flow.plan, flow.results],
  );

  const pick = usePick(flow);
  const bar = useBarHeight();
  useFocusClearOfBars();

  function onClose(event: MouseEvent<HTMLAnchorElement>) {
    if (flow.step === "add") {
      event.preventDefault();
      setStopOpen(true);
    } else if (flow.step === "result") {
      event.preventDefault();
      void flow.leave();
    }
  }

  // The result goes out of reach while its rows go in again, which would drop focus to the page;
  // focus waits on the bar's button instead, beside the progress line.
  function retryFailed() {
    document.getElementById("import-primary")?.focus();
    flow.retryFailed();
  }

  // While adding, the step it started from stays on screen, out of reach.
  const shown = flow.step === "add" ? (flow.adding?.from ?? "check") : flow.step;
  const busy = flow.step === "add";

  return (
    <main id="main" className="min-h-dvh">
      <ImportTopBar onClose={onClose} />
      <ImportContent>
        {shown === "paste" ? <PasteStep text={flow.text} onText={flow.setText} count={count} /> : null}
        {shown === "check" ? (
          <div inert={busy}>
            <CheckStep
              rows={rows}
              retrying={flow.retrying}
              checking={flow.checkRun === "running"}
              onPick={pick.open}
              onChoose={flow.choose}
              onInclude={flow.include}
              onRetry={flow.retryLines}
            />
          </div>
        ) : null}
        {shown === "result" ? (
          <div inert={busy}>
            <ResultStep summary={summary} notAdded={notAdded} busy={busy} onRetry={retryFailed} onUndo={flow.undo} />
          </div>
        ) : null}
      </ImportContent>

      <p role="status" className="sr-only">
        {flow.step === "result"
          ? [
              addedLabel(summary.added),
              summary.breakdown,
              summary.failed.length > 0 ? couldNotAddLabel(summary.failed.length) : "",
            ]
              .filter((part) => part !== "")
              .join(". ")
          : ""}
      </p>

      <ImportActionBar innerRef={bar}>
        <ActionBarContent flow={flow} count={count} addCount={addCount} />
      </ImportActionBar>

      <PickSheet
        open={pick.isOpen}
        target={pick.target}
        origin={pick.origin}
        openerRef={pick.opener}
        onClose={pick.close}
        onPick={pick.choose}
        onSkip={pick.skip}
      />

      <AlertDialog open={stopOpen} onOpenChange={setStopOpen}>
        <AlertDialogContent id="import-stop-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Stop adding?</AlertDialogTitle>
            <AlertDialogDescription>Titles already added stay in your library.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep adding</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={flow.stopAdding}>
              Stop adding
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function PasteStep({ text, onText, count }: { text: string; onText: (text: string) => void; count: PasteCount }) {
  return (
    <div id="import-paste">
      <Label htmlFor="import-text" className="text-base leading-snug font-semibold">
        {PASTE_LABEL}
      </Label>
      <p id="import-help" className="mt-1 text-sm text-muted-foreground">
        {PASTE_HELP}
      </p>
      <Textarea
        id="import-text"
        value={text}
        onChange={(event) => onText(event.target.value)}
        maxLength={MAX_PASTE_CHARACTERS}
        aria-describedby="import-help import-count import-limit"
        aria-invalid={count.overLimit || undefined}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="mt-3 min-h-[max(16rem,45dvh)] text-base leading-relaxed"
      />
      <div id="import-count" className="tabular mt-3 text-sm text-muted-foreground">
        <p>{count.titles}</p>
        {count.skipped ? <p>{count.skipped}</p> : null}
      </div>
      <p id="import-limit" role="status" className={count.overLimit ? "mt-2 text-sm font-medium" : "sr-only"}>
        {count.overLimit ? LIMIT_MESSAGE : ""}
      </p>
    </div>
  );
}

type Primary = { label: string; enabled: boolean; onPress?: () => void };

function ActionBarContent({ flow, count, addCount }: { flow: ImportFlow; count: PasteCount; addCount: number }) {
  let progress: { label: string; done: number; total: number } | null = null;
  let message: ReactNode = null;
  // Read out only: the end of checking shows as a button turning on, which a screen reader misses.
  let announcement = "";
  let primary: Primary | "sign-in";

  switch (flow.step) {
    case "paste":
      primary = { label: "Check list", enabled: count.canCheck, onPress: flow.startChecking };
      break;
    case "check": {
      const check = flow.check;
      if (flow.checkRun === "stopped") {
        message = TMDB_DOWN_MESSAGE;
        primary = { label: "Try again", enabled: true, onPress: flow.continueChecking };
      } else if (flow.checkRun === "signed_out") {
        message = SIGN_IN_MESSAGE;
        primary = "sign-in";
      } else if (flow.checkRun === "running" && check) {
        const done = checkedCount(check);
        progress = { label: checkingLabel(done, check.lines.length), done, total: check.lines.length };
        primary = { label: addLabel(addCount), enabled: false };
      } else {
        if (flow.checkRun === "done" && check) announcement = checkedLabel(check.lines.length);
        primary = { label: addLabel(addCount), enabled: addCount > 0 && flow.retrying.size === 0, onPress: flow.startAdding };
      }
      break;
    }
    case "add": {
      const adding = flow.adding ?? { done: 0, total: 0, from: "check" };
      progress = { label: addingLabel(adding.done, adding.total), done: adding.done, total: adding.total };
      primary = { label: adding.from === "result" ? "Go to library" : addLabel(adding.total), enabled: false };
      break;
    }
    case "result":
      primary = { label: "Go to library", enabled: !flow.leaving, onPress: () => void flow.leave() };
      break;
  }

  return (
    <>
      {progress ? <ProgressLine {...progress} /> : null}
      <p role="status" className={message ? "px-3 pt-1.5 pb-2.5 text-sm text-pretty" : "sr-only"}>
        {message ?? announcement}
      </p>
      {primary === "sign-in" ? (
        <Button asChild size="lg" className="w-full">
          <Link id="import-sign-in" href="/sign-in">
            Sign in
          </Link>
        </Button>
      ) : (
        <PrimaryButton primary={primary} />
      )}
    </>
  );
}

// One button for every step, so focus stays on it while its words change. It is never `disabled`,
// which would drop keyboard focus to the page; `aria-disabled` keeps it in place.
function PrimaryButton({ primary }: { primary: Primary }) {
  return (
    <Button
      id="import-primary"
      type="button"
      size="lg"
      aria-disabled={!primary.enabled}
      onClick={() => {
        if (primary.enabled) primary.onPress?.();
      }}
      className="tabular w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-primary"
    >
      {primary.label}
    </Button>
  );
}

function ProgressLine({ label, done, total }: { label: string; done: number; total: number }) {
  const ratio = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <div className="px-3 pt-1.5 pb-3">
      <p id="import-progress-label" className="tabular text-sm text-muted-foreground">
        {label}
      </p>
      <div
        role="progressbar"
        aria-labelledby="import-progress-label"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={label}
        className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/15"
      >
        <div
          className="h-full origin-left rounded-full bg-primary transition-transform duration-300 ease-out"
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
    </div>
  );
}

/** The pick sheet's target, where it grows from, and where focus goes when it closes. */
function usePick(flow: ImportFlow) {
  const [isOpen, setOpen] = useState(false);
  const [target, setTarget] = useState<PickTarget | null>(null);
  const [origin, setOrigin] = useState("50% 50%");
  const opener = useRef<HTMLElement | null>(null);
  // Every line of the row the sheet was opened from.
  const openedRow = useRef<number[]>([]);

  // A pick can merge the row into another or split a line out of it, which removes the button that
  // opened the sheet. Focus then goes to the row that now holds the line. A split line can land in
  // the closed "look right" fold; then to the row it left, and failing that to the fold's toggle.
  useLayoutEffect(() => {
    if (!target || !opener.current || opener.current.isConnected) return;
    const ids = [...target.lineIds, ...openedRow.current.filter((id) => !target.lineIds.includes(id))];
    opener.current =
      ids
        .map((id) => document.querySelector<HTMLElement>(`#import-check [data-row-lines~="${id}"] [data-pick-button]`))
        .find((element) => element !== null) ?? document.getElementById("import-found-toggle");
  });

  // The page stays mounted, hidden, after the Owner leaves it. An open sheet would come back open,
  // and its open state would keep the Library's dock hidden meanwhile. With no opener, closing it
  // here hands focus to nothing.
  useLayoutEffect(
    () => () => {
      opener.current = null;
      setOpen(false);
    },
    [],
  );

  function open(row: Row, lineIds: number[], element: HTMLElement) {
    const lines = row.lines.filter((line) => lineIds.includes(line.id));
    opener.current = element;
    openedRow.current = row.lines.map((line) => line.id);
    setOrigin(originFrom(element));
    setTarget({
      lineIds,
      originals: lines.map((line) => line.original),
      // A single line picked out of a merged row is offered the row's candidates too; any of them may fit.
      candidates: row.candidates,
      query: row.query,
      current: row.title,
    });
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  return {
    isOpen,
    target,
    origin,
    opener,
    open,
    close,
    choose(title: ImportCandidate) {
      if (target) flow.pick(target.lineIds, title);
      setOpen(false);
    },
    skip() {
      if (target) flow.skip(target.lineIds);
      setOpen(false);
    },
  };
}

// The sheet grows out of what was tapped: the tap's spot, measured from the sheet's own box.
function originFrom(element: HTMLElement): string {
  const panel = document.getElementById("pick-title")?.closest<HTMLElement>("[data-sheet]");
  if (!panel) return "50% 50%";
  const rect = element.getBoundingClientRect();
  return `${Math.round(rect.left + rect.width / 2 - panel.offsetLeft)}px ${Math.round(rect.top + rect.height / 2 - panel.offsetTop)}px`;
}

// The top bar and the action bar float over the content. The browser scrolls a focused control into
// the viewport but not out from under them, so focus moved by the keyboard is nudged clear.
function useFocusClearOfBars() {
  useEffect(() => {
    function onFocusIn(event: FocusEvent) {
      const element = event.target;
      if (!(element instanceof HTMLElement) || !element.closest("#import-content")) return;
      requestAnimationFrame(() => {
        if (document.activeElement !== element || !element.matches(":focus-visible")) return;
        // A row's name button rings the whole Title block, so the block is what has to show.
        const box = (element.closest("[data-pick-block]") ?? element).getBoundingClientRect();
        const top = document.querySelector("#import-top-bar > div")?.getBoundingClientRect().bottom ?? 0;
        const bottom = document.querySelector("[data-import-bar] > div")?.getBoundingClientRect().top ?? window.innerHeight;
        if (box.bottom > bottom - FOCUS_CLEARANCE) window.scrollBy({ top: box.bottom - bottom + FOCUS_CLEARANCE });
        else if (box.top < top + FOCUS_CLEARANCE) window.scrollBy({ top: box.top - top - FOCUS_CLEARANCE });
      });
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);
}

/** Publishes the action bar's height, so the content and the toasts clear it as it grows. */
function useBarHeight() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = document.documentElement;
    root.dataset.importPage = "";
    const observer = new ResizeObserver(() => root.style.setProperty("--import-bar-height", `${element.offsetHeight}px`));
    observer.observe(element);
    return () => {
      observer.disconnect();
      delete root.dataset.importPage;
      root.style.removeProperty("--import-bar-height");
    };
  }, []);
  return ref;
}

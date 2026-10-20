"use client";

import { Copy, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { addedLabel, copyLabel, couldNotAddLabel, undoQuestion, type ImportSummary } from "./import-model";

const COPY_FAILED = "Couldn't copy the lines. Try again.";

type Props = {
  summary: ImportSummary;
  /** Every line not added, one per line, ready for the clipboard. */
  notAdded: string[];
  /** Adding is running again, so nothing here can be pressed. */
  busy: boolean;
  onRetry: () => void;
  onUndo: () => Promise<boolean>;
};

export function ResultStep({ summary, notAdded, busy, onRetry, onUndo }: Props) {
  const [undoing, setUndoing] = useState(false);

  async function copy(button: HTMLElement) {
    if (await copyText(notAdded.join("\n"), button)) toast.success("Copied");
    else toast.error(COPY_FAILED);
  }

  async function undo() {
    setUndoing(true);
    const done = await onUndo();
    if (!done) setUndoing(false);
  }

  return (
    <section id="import-result" aria-labelledby="import-result-title" className="flex flex-col">
      <h2 id="import-result-title" className="tabular font-display text-[44px] text-balance">
        {addedLabel(summary.added)}
      </h2>
      {summary.breakdown !== "" ? <p className="mt-3 text-lg text-muted-foreground">{summary.breakdown}</p> : null}

      {summary.failed.length > 0 ? (
        <div id="import-failed" className="glass mt-8 rounded-3xl border p-5">
          <h3 className="text-base font-semibold">{couldNotAddLabel(summary.failed.length)}</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
            {summary.failed.map((row) => (
              <li key={row.key} className="[overflow-wrap:anywhere]">
                {row.name}
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" aria-disabled={busy} onClick={() => !busy && onRetry()} className="mt-4 aria-disabled:opacity-50">
            Try again
          </Button>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col items-start gap-3">
        {notAdded.length > 0 ? (
          <Button id="import-copy" type="button" variant="outline" onClick={(event) => void copy(event.currentTarget)}>
            <Copy aria-hidden />
            {copyLabel(notAdded.length)}
          </Button>
        ) : null}
        {summary.added > 0 ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                id="import-undo"
                type="button"
                variant="ghost"
                aria-disabled={undoing || busy}
                // Kept focusable while it waits, so focus that the dialog hands back is not lost.
                onClick={(event) => {
                  if (undoing || busy) event.preventDefault();
                }}
                className="-ml-3 text-muted-foreground hover:text-foreground aria-disabled:opacity-50"
              >
                <Undo2 aria-hidden />
                Undo this import
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent id="import-undo-dialog">
              <AlertDialogHeader>
                <AlertDialogTitle>{undoQuestion(summary.added)}</AlertDialogTitle>
                <AlertDialogDescription>Titles you&apos;ve changed since stay in your library.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void undo()}>
                  Remove them
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </section>
  );
}

// The Clipboard API needs a secure page; a phone on the dev server's LAN address is not one, so the
// older copy command is the fallback. It moves focus, which goes back to the button afterwards.
async function copyText(text: string, button: HTMLElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Falls through to the copy command.
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  try {
    area.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
    button.focus({ preventScroll: true });
  }
}

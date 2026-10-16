"use client";

import { useRef, useState } from "react";
import { cn } from "cn";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WatchView } from "@/data/dto";
import { formatIsoDate, localToday } from "./dates";
import { isPendingWatch } from "./entry-model";
import { useEntry } from "./entry-state";

// The ticket cut-outs mask everything outside the border box, so focus rings sit inside it.
const STUB = "bg-stub text-stub-foreground stub-edge rounded-md px-5";

type Editing = { watch: WatchView; draft: string; today: string };

function WatchStub({ watch, onEdit }: { watch: WatchView; onEdit: (watch: WatchView) => void }) {
  const pending = isPendingWatch(watch);
  const date = watch.watchedOn ? formatIsoDate(watch.watchedOn) : "Date unknown";
  return (
    <li
      className={cn(pending && "animate-in fade-in-0 slide-in-from-top-2 duration-200 ease-out")}
    >
      {pending ? (
        <p className={cn(STUB, "tabular flex min-h-12 items-center text-sm font-medium")}>{date}</p>
      ) : (
        <button
          type="button"
          data-watch-id={watch.id}
          onClick={() => onEdit(watch)}
          aria-label={`Change watch date. ${date}`}
          className={cn(
            STUB,
            "tabular flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 text-left text-sm font-medium transition-[filter] hover:brightness-110 focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none",
          )}
        >
          <span>{date}</span>
          <span className="text-xs font-normal opacity-80">Change</span>
        </button>
      )}
    </li>
  );
}

export function WatchesSection() {
  const { model, addWatch, changeWatchDate, removeWatch } = useEntry();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirming, setConfirming] = useState<WatchView | null>(null);
  const section = useRef<HTMLElement>(null);
  // The stub that opened the dialog is not a Radix trigger, so Radix cannot hand focus back to it.
  const openedFrom = useRef<string | null>(null);

  const onlyWatchOfWatched = (watch: WatchView) =>
    model.status === "watched" && model.watches.length === 1 && model.watches[0]?.id === watch.id;

  function open(watch: WatchView) {
    openedFrom.current = watch.id;
    setEditing({ watch, draft: watch.watchedOn ?? "", today: localToday() });
  }

  // Back to the stub that was edited; when that stub is gone (the Watch was removed), to the
  // next control in the section, so focus never drops to the page body.
  function restoreFocus(event: Event) {
    if (confirming !== null) return;
    event.preventDefault();
    const root = section.current;
    if (!root) return;
    const stub = openedFrom.current
      ? root.querySelector<HTMLElement>(`[data-watch-id="${CSS.escape(openedFrom.current)}"]`)
      : null;
    (stub ?? root.querySelector<HTMLElement>("#watch-again-button") ?? root).focus();
  }

  function save(watchedOn: string | null) {
    if (!editing) return;
    changeWatchDate(editing.watch.id, watchedOn);
    setEditing(null);
  }

  const draftInFuture = editing !== null && editing.draft > editing.today;
  const canSave = editing !== null && editing.draft !== "" && !draftInFuture;

  return (
    <section
      ref={section}
      id="entry-watches"
      aria-labelledby="entry-watches-title"
      tabIndex={-1}
      className="outline-none"
    >
      <h2 id="entry-watches-title" className="text-base font-medium">
        Watches
      </h2>
      {model.watches.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">Watches show up here once you mark it watched.</p>
      ) : (
        <ul role="list" className="mt-2 flex flex-col gap-2">
          {model.watches.map((watch) => (
            <WatchStub key={watch.id} watch={watch} onEdit={open} />
          ))}
        </ul>
      )}
      {model.watches.length > 0 ? (
        <Button id="watch-again-button" variant="outline" className="mt-3" onClick={addWatch}>
          Watched again
        </Button>
      ) : null}

      <Dialog open={editing !== null} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent id="watch-date-dialog" aria-describedby={undefined} onCloseAutoFocus={restoreFocus}>
          <DialogHeader>
            <DialogTitle>When did you watch it?</DialogTitle>
          </DialogHeader>
          {editing ? (
            <form
              id="watch-date-form"
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (canSave) save(editing.draft);
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="watch-date-input">Date</Label>
                <Input
                  id="watch-date-input"
                  type="date"
                  max={editing.today}
                  value={editing.draft}
                  aria-invalid={draftInFuture}
                  aria-describedby={draftInFuture ? "watch-date-error" : undefined}
                  onChange={(event) => setEditing({ ...editing, draft: event.target.value })}
                />
                {draftInFuture ? (
                  <p id="watch-date-error" className="text-sm text-destructive">
                    Pick today or an earlier date.
                  </p>
                ) : null}
              </div>
              <Button id="watch-date-save" type="submit" disabled={!canSave}>
                Save
              </Button>
              <Button type="button" variant="outline" onClick={() => save(null)}>
                Date unknown
              </Button>
            </form>
          ) : null}
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!editing) return;
                const watch = editing.watch;
                setEditing(null);
                if (onlyWatchOfWatched(watch)) setConfirming(watch);
                else removeWatch(watch.id);
              }}
            >
              Remove this watch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirming !== null} onOpenChange={(next) => !next && setConfirming(null)}>
        <AlertDialogContent id="remove-watch-dialog" onCloseAutoFocus={restoreFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this watch?</AlertDialogTitle>
            <AlertDialogDescription>
              This is your only watch, so the status changes to To watch. Your rating and note stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirming) removeWatch(confirming.id);
                setConfirming(null);
              }}
            >
              Remove watch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

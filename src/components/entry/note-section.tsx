"use client";

import { Check } from "lucide-react";
import { startTransition, useEffect, useOptimistic, useState } from "react";
import { cn } from "cn";
import { toast } from "sonner";
import { setNote } from "@/actions/entries";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEntry } from "./entry-state";

const MAX_LENGTH = 1000;
const COUNTER_FROM = 900;
const SAVED_MS = 2000;

export function NoteSection({ note }: { note: string | null }) {
  const { entryId } = useEntry();
  // The draft lives here until it is saved, so leaving the field never loses it.
  const [saved, setSaved] = useState(note ?? "");
  const [seenNote, setSeenNote] = useState(note);
  const [draft, setDraft] = useState(note ?? "");
  const [shownSaved, setShownSaved] = useOptimistic(saved);
  const [justSaved, setJustSaved] = useState(false);

  if (seenNote !== note) {
    setSeenNote(note);
    if (draft === saved) setDraft(note ?? "");
    setSaved(note ?? "");
  }

  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), SAVED_MS);
    return () => clearTimeout(timer);
  }, [justSaved]);

  const dirty = draft !== shownSaved;

  function save() {
    if (!dirty) return;
    const submitted = draft;
    startTransition(async () => {
      setShownSaved(submitted);
      let result: Awaited<ReturnType<typeof setNote>>;
      try {
        result = await setNote({ entryId, note: submitted });
      } catch {
        result = { ok: false, error: "Couldn't save that. Try again." };
      }
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const stored = result.data.note ?? "";
      startTransition(() => {
        setSaved(stored);
        setDraft((current) => (current === submitted ? stored : current));
        setJustSaved(true);
      });
    });
  }

  return (
    <section id="entry-note" aria-labelledby="entry-note-label">
      <Label id="entry-note-label" htmlFor="entry-note-input" className="text-lg font-bold">
        Note
      </Label>
      <p id="entry-note-help" className="mt-1 text-sm text-muted-foreground">
        Only you see this
      </p>
      <Textarea
        id="entry-note-input"
        value={draft}
        maxLength={MAX_LENGTH}
        rows={3}
        onChange={(event) => {
          setDraft(event.target.value);
          setJustSaved(false);
        }}
        aria-describedby="entry-note-help entry-note-count"
        className="mt-3 min-h-24 whitespace-pre-wrap"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <Button
          id="entry-note-save"
          variant="outline"
          disabled={!dirty}
          onClick={save}
          className={cn("min-w-28", justSaved && "disabled:opacity-100")}
        >
          {justSaved && !dirty ? (
            <>
              <Check aria-hidden />
              Saved
            </>
          ) : (
            "Save note"
          )}
        </Button>
        <p
          id="entry-note-count"
          aria-live="polite"
          className="tabular text-sm text-muted-foreground"
        >
          {draft.length >= COUNTER_FROM ? `${draft.length} of ${MAX_LENGTH}` : null}
        </p>
      </div>
    </section>
  );
}

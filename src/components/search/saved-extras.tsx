"use client";

import { Check } from "lucide-react";
import { useId, useOptimistic, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RatingStars } from "@/components/rating-stars";
import { NativeSelect } from "@/components/search/native-select";
import { setNote, setRating } from "@/actions/entries";
import { setNextToWatch } from "@/actions/progress";
import type { SaveResult } from "@/data/dto";
import type { Status, TitleKind } from "@/domain/types";

type Props = {
  entryId: string;
  kind: TitleKind;
  status: Status;
  seasons: SaveResult["seasons"];
};

// Everything here is optional: ignoring it changes nothing, and none of it blocks the next search.
export function SavedExtras({ entryId, kind, status, seasons }: Props) {
  const showsPicker = kind === "series" && status === "watching" && seasons !== null && seasons.length > 0;
  return (
    <div className="mt-3 flex flex-col gap-4 border-t pt-3">
      {status === "watched" ? <InlineRating entryId={entryId} /> : null}
      {showsPicker ? <NextToWatchPicker entryId={entryId} seasons={seasons} /> : null}
      <NoteField entryId={entryId} />
    </div>
  );
}

function InlineRating({ entryId }: { entryId: string }) {
  const [rating, setConfirmed] = useState<number | null>(null);
  const [shown, setShown] = useOptimistic<number | null, number | null>(rating, (_current, next) => next);
  const [, startTransition] = useTransition();

  function onChange(next: number | null) {
    startTransition(async () => {
      setShown(next);
      const result = await setRating({ entryId, ratingHalfStars: next });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      startTransition(() => setConfirmed(result.data.ratingHalfStars));
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">Rate it (optional)</p>
      <RatingStars value={shown} onChange={onChange} label="Rating" className="-my-1" />
    </div>
  );
}

function NextToWatchPicker({ entryId, seasons }: { entryId: string; seasons: NonNullable<SaveResult["seasons"]> }) {
  const uid = useId();
  const [seasonNumber, setSeasonNumber] = useState(seasons[0].seasonNumber);
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const season = seasons.find((candidate) => candidate.seasonNumber === seasonNumber) ?? seasons[0];

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await setNextToWatch({ entryId, seasonNumber, episodeNumber });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      startTransition(() => setDone(`S${seasonNumber} E${episodeNumber}`));
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2" id={`next-to-watch-${entryId}`}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Next to watch (optional)</legend>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${uid}-season`} className="text-muted-foreground">
              Season
            </Label>
            <NativeSelect
              id={`${uid}-season`}
              value={seasonNumber}
              onChange={(event) => {
                setSeasonNumber(Number(event.target.value));
                setEpisodeNumber(1);
                setDone(null);
              }}
            >
              {seasons.map((option) => (
                <option key={option.seasonNumber} value={option.seasonNumber}>
                  Season {option.seasonNumber}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${uid}-episode`} className="text-muted-foreground">
              Episode
            </Label>
            <NativeSelect
              id={`${uid}-episode`}
              value={episodeNumber}
              onChange={(event) => {
                setEpisodeNumber(Number(event.target.value));
                setDone(null);
              }}
            >
              {Array.from({ length: season.episodeCount }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  Episode {index + 1}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          Set
        </Button>
        <p role="status" className="tabular flex items-center gap-1.5 text-sm text-muted-foreground">
          {done ? (
            <>
              <Check aria-hidden className="size-4 text-primary" />
              Next: {done}
            </>
          ) : null}
        </p>
      </div>
    </form>
  );
}

function NoteField({ entryId }: { entryId: string }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <div>
        <Button
          id={`add-note-${entryId}`}
          type="button"
          variant="ghost"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls={`${uid}-note-form`}
          className="-mx-3"
        >
          Add a note
        </Button>
      </div>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await setNote({ entryId, note: text });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      startTransition(() => setSaved(true));
    });
  }

  return (
    <form id={`${uid}-note-form`} onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${uid}-note`}>Note</Label>
        <Textarea
          id={`${uid}-note`}
          name="note"
          value={text}
          maxLength={1000}
          rows={3}
          autoFocus
          aria-describedby={`${uid}-note-help`}
          onChange={(event) => {
            setText(event.target.value);
            setSaved(false);
          }}
          className="min-h-20"
        />
        <p id={`${uid}-note-help`} className="text-xs text-muted-foreground">
          Only you see this
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending || text.trim() === ""}>
          Save note
        </Button>
        <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {saved ? (
            <>
              <Check aria-hidden className="size-4 text-primary" />
              Note saved
            </>
          ) : null}
        </p>
      </div>
    </form>
  );
}

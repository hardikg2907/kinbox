"use client";

import { useId, useState } from "react";
import { cn } from "cn";
import { Checkbox } from "@/components/ui/checkbox";
import { formatIsoDate } from "@/components/entry/dates";
import type { EpisodeView } from "@/data/dto";

type EpisodeRowProps = {
  episode: EpisodeView;
  onToggle: (episode: EpisodeView, watched: boolean) => void;
};

function airsText(episode: EpisodeView): string {
  return episode.airDate ? `Airs ${formatIsoDate(episode.airDate)}` : "Not aired yet";
}

// The whole row is the touch target; the box is only the visible state.
// After a tick, a flat cover on the box slides away to the right, so the
// check appears to be drawn in without animating anything but a transform.
export function EpisodeRow({ episode, onToggle }: EpisodeRowProps) {
  const id = useId();
  const [settling, setSettling] = useState(false);
  const unaired = !episode.aired;

  const accessibleName = [episode.label, episode.name, unaired ? airsText(episode).toLowerCase() : null]
    .filter(Boolean)
    .join(", ");

  return (
    <li
      className={cn("rounded-xl", settling && "animate-in zoom-in-95 duration-200 ease-out")}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setSettling(false);
      }}
    >
      <label
        htmlFor={id}
        className={cn(
          "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-1.5 transition-colors hover:bg-secondary",
          unaired && "text-muted-foreground",
        )}
      >
        <Checkbox
          id={id}
          checked={episode.watched}
          aria-label={accessibleName}
          data-settling={settling ? "" : undefined}
          className="size-6 overflow-hidden rounded-full data-settling:data-checked:before:absolute data-settling:data-checked:before:inset-0 data-settling:data-checked:before:animate-out data-settling:data-checked:before:bg-primary data-settling:data-checked:before:duration-200 data-settling:data-checked:before:ease-out data-settling:data-checked:before:slide-out-to-right-full data-settling:data-checked:before:fill-mode-forwards data-settling:data-checked:before:content-['']"
          onCheckedChange={(checked) => {
            const watched = checked === true;
            setSettling(watched);
            onToggle(episode, watched);
          }}
        />
        <span className="tabular min-w-16 shrink-0 text-sm font-medium">{episode.label}</span>
        <span className="min-w-0 flex-1 text-sm">
          {episode.name ? <span className="block wrap-break-word">{episode.name}</span> : null}
          {unaired ? (
            <span className="tabular block text-xs text-muted-foreground">{airsText(episode)}</span>
          ) : null}
        </span>
      </label>
    </li>
  );
}

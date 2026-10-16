"use client";

import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEntry } from "@/components/entry/entry-state";
import type { EpisodeView, SeasonSummaryView } from "@/data/dto";
import { EpisodeRow } from "./episode-row";

const itemValue = (seasonNumber: number) => `season-${seasonNumber}`;

const seasonTitle = (season: SeasonSummaryView) =>
  season.isSpecials ? "Specials" : `Season ${season.seasonNumber}`;

function SeasonSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-2 pb-2">
      <Skeleton className="h-11 w-44 rounded-lg" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-11 w-full rounded-lg" />
      ))}
    </div>
  );
}

function SeasonBody({ season }: { season: SeasonSummaryView }) {
  const { model, seasonLoad, loadSeason, tick, markWholeSeason } = useEntry();
  const opened = model.seasons[season.seasonNumber];
  const load = seasonLoad[season.seasonNumber];

  if (load?.state === "error") {
    return (
      <div className="flex flex-col items-start gap-2 pb-2" role="alert">
        <p className="text-sm text-muted-foreground">{load.message}</p>
        <Button variant="outline" onClick={() => loadSeason(season.seasonNumber, true)}>
          Try again
        </Button>
      </div>
    );
  }
  if (!opened) return <SeasonSkeleton rows={season.episodeCount} />;

  const aired = opened.episodes.filter((episode) => episode.aired);
  const allAiredWatched = aired.length > 0 && aired.every((episode) => episode.watched);

  return (
    <div className="flex flex-col gap-2 pb-2">
      {aired.length > 0 ? (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => markWholeSeason(season.seasonNumber, !allAiredWatched)}
        >
          {allAiredWatched ? "Unmark season" : "Mark season watched"}
        </Button>
      ) : null}
      <ul role="list" className="flex flex-col gap-2">
        {opened.episodes.map((episode) => (
          <EpisodeRow
            key={episode.episodeNumber}
            episode={episode}
            onToggle={(target: EpisodeView, watched) =>
              tick(target.seasonNumber, target.episodeNumber, watched)
            }
          />
        ))}
      </ul>
    </div>
  );
}

export function SeasonsPanel() {
  const { model, loadSeason } = useEntry();
  const [open, setOpen] = useState<string[]>([]);
  const series = model.series;
  if (!series || series.seasons.length === 0) return null;

  return (
    <section id="seasons" aria-labelledby="seasons-title">
      <h2 id="seasons-title" className="sr-only">
        Seasons
      </h2>
      <Accordion
        type="multiple"
        value={open}
        onValueChange={(next) => {
          setOpen(next);
          for (const value of next) {
            if (!open.includes(value)) loadSeason(Number(value.replace("season-", "")));
          }
        }}
        className="rounded-2xl bg-card px-4 ring-1 ring-foreground/10"
      >
        {series.seasons.map((season) => (
          <AccordionItem key={season.seasonNumber} value={itemValue(season.seasonNumber)}>
            <AccordionTrigger
              aria-label={`${seasonTitle(season)}, ${season.watchedCount} of ${season.episodeCount} watched`}
              className="min-h-14 items-center py-2 text-base hover:no-underline"
            >
              <span className="flex flex-1 items-baseline justify-between gap-3 pr-2">
                <span>{seasonTitle(season)}</span>
                <span className="tabular text-sm font-normal text-muted-foreground">
                  {season.watchedCount} of {season.episodeCount}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="h-auto">
              <SeasonBody season={season} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

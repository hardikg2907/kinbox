import type { EntryView } from "@/data/dto";
import { posterUrl } from "@/lib/tmdb/images";
import { TitleTint } from "@/components/poster-colour/title-tint";
import { ShowInDrawer } from "./drawer-hero";
import { TITLE_LAYOUT, type TitleContainer } from "./entry-layout";
import { EntryProvider } from "./entry-state";
import { NameBar } from "./name-bar";
import { StatusPillHost } from "./status-pill";
import { TitleHero } from "./title-hero";
import { TitleHead, TitleMore, type TitleFacts } from "./title-sections";

// The Title's sections, written once. The page and the drawer each wrap them in their own container.
export function EntryScreen({ entry, container }: { entry: EntryView; container: TitleContainer }) {
  const { title } = entry;
  const facts: TitleFacts = {
    name: title.name,
    year: title.year,
    kind: title.kind,
    runtimeMinutes: title.runtimeMinutes,
    overview: title.overview,
  };
  const layout = TITLE_LAYOUT[container];

  return (
    <EntryProvider
      entry={{
        id: entry.id,
        name: title.name,
        kind: title.kind,
        status: entry.status,
        ratingHalfStars: entry.ratingHalfStars,
        watches: entry.watches,
        series: entry.series,
        tmdbUnavailable: entry.tmdbUnavailable,
      }}
    >
      <StatusPillHost name={title.name} posterPath={title.posterPath}>
        {container === "page" ? (
          <>
            <TitleTint posterPath={title.posterPath} />
            <TitleHero
              entryId={entry.id}
              low={posterUrl(title.posterPath, "w342")}
              high={posterUrl(title.posterPath, "w500")}
              alt={title.name}
              container="page"
            />
          </>
        ) : (
          // The drawer draws the poster and its colour itself, from its first frame on.
          <ShowInDrawer entryId={entry.id} posterPath={title.posterPath} />
        )}
        <NameBar name={title.name} container={container} />
        <div id="entry-content" data-title-body className={layout.body}>
          <div aria-hidden className={layout.fade} />
          <TitleHead facts={facts} container={container} />
          <TitleMore facts={facts} note={entry.note} />
        </div>
      </StatusPillHost>
    </EntryProvider>
  );
}

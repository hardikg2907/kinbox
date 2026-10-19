import { preload } from "react-dom";
import type { EntryView } from "@/data/dto";
import { posterUrl } from "@/lib/tmdb/images";
import { paletteImageUrl } from "@/components/poster-colour/palette";
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
  // The page's colour is read from this small poster; fetched with the page, it is there by the time
  // the page's code asks for it.
  const palette = container === "page" ? paletteImageUrl(title.posterPath) : null;
  if (palette) preload(palette, { as: "image", crossOrigin: "anonymous", fetchPriority: "high" });

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
            <TitleTint posterPath={title.posterPath} revealsHero />
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

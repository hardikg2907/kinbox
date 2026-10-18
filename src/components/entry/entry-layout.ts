// Shared by the Title's two containers and their skeletons, so the boxes never drift apart.
//
// The markup is in reading order: hero, then the body (name, status, Next or overview, rating,
// then progress, overview, Seasons, Watches, Note, Remove). A phone, a keyboard and a screen
// reader all follow it. The body overlaps the hero's foot, which hides the poster's printed title,
// and a short scrim washes the poster into the page colour above it. In the drawer, transforms
// driven by --p, --gap and --lift shrink this same layout to the quick view; the page is the
// layout at rest.

export type TitleContainer = "page" | "drawer";

/** The full view's hero; the drawer's quick view shows only a strip of it. */
const HERO_HEIGHT = "h-[min(122vw,62svh)]";

/** The strip of the hero the drawer's quick view shows, in px; the drawer's geometry reads it. */
export const STRIP_PX = 176;

/** How far the body overlaps the hero's foot at the quick view, in px (`-mt-8`). The full view overlaps 160px (`-mt-[160px]`, and `--lift` in globals.css). */
export const BODY_OVERLAP_PX = 32;

type Layout = { hero: string; media: string; body: string; fade: string; name: string };

/** The drawer's wash over the poster's foot. The body carries it, and the poster's window a copy for view transitions. */
const DRAWER_FADE = "pointer-events-none absolute inset-x-0 h-16 title-fade-grow scrim-title";

/** The copy of the drawer's wash that sits at the foot of the poster's window, where the body's top meets it. */
export const DRAWER_WASH = `${DRAWER_FADE} bottom-0`;

export const TITLE_LAYOUT: Record<TitleContainer, Layout> = {
  // From `lg` the page is two columns beside the sidebar: a tall sticky poster and the sections.
  page: {
    hero: `relative ${HERO_HEIGHT} w-full overflow-hidden lg:sticky lg:top-0 lg:h-dvh`,
    media: "absolute inset-0",
    body: "relative z-[1] -mt-[160px] flex min-w-0 flex-col gap-8 bg-[var(--title-bg,var(--background))] px-5 pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-6 lg:mt-0 lg:px-10 lg:pt-20 lg:pb-12",
    fade: "pointer-events-none absolute inset-x-0 bottom-full h-26 scrim-title lg:hidden",
    name: "font-display text-[44px] text-balance wrap-break-word text-foreground",
  },
  drawer: {
    // The rounded top follows the panel's, so the poster's window carries it into a view transition.
    hero: `relative ${HERO_HEIGHT} w-full overflow-hidden rounded-t-[inherit] select-none [-webkit-touch-callout:none] lg:h-[250px]`,
    // As tall as the hero, not the window around it, so cutting the window never moves the poster.
    media: `absolute inset-x-0 top-0 ${HERO_HEIGHT} title-parallax lg:h-[250px]`,
    body: "title-follow relative z-[1] -mt-[160px] flex min-w-0 flex-col gap-8 bg-[var(--title-bg,var(--background))] px-5 pb-[max(5rem,env(safe-area-inset-bottom))] lg:-mt-8",
    fade: `${DRAWER_FADE} bottom-full`,
    name: "title-name-grow max-w-[80%] font-display text-[30px] text-balance wrap-break-word text-foreground",
  },
};

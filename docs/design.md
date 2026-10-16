# Kinbox design

How Kinbox looks, moves and speaks. Screens follow this file; `src/app/globals.css` holds the tokens.

## Idea: the late show

Kinbox is used in two moments: grabbing a Title on the phone before it is forgotten, and choosing what to watch tonight. The interface is a quiet cinema frame. Posters carry the colour; the chrome stays calm.

- **Posters are the hero.** Everything else is plum ink, silver and one accent.
- **One accent: velvet.** Primary actions, the active tab, focus rings, ticks. Never decoration.
- **Gold only for Rating stars.**
- **One bold element per screen.** On the Entry page it is the condensed "Next: S2 E4" line with "Watched it". Watches are drawn as ticket stubs.
- **Dark-first.** The app follows the phone's light or dark setting. Design and check dark first, then light.

## Tokens

All colours are CSS variables in `globals.css`, exposed as Tailwind colours (`bg-background`, `text-muted-foreground`, `bg-primary`, `text-gold`, `bg-stub`…). Never write raw hex in components.

| Token | Dark | Light | Use |
|---|---|---|---|
| background | #14111C | #F3F4F7 | Page |
| card | #1D1928 | #FFFFFF | Raised surfaces |
| foreground | #EEEAF4 | #1C1828 | Text |
| muted-foreground | #A79FBA | #5D5870 | Secondary text |
| primary | #E0566F | #A3213D | Accent; filled buttons |
| primary-foreground | #1A0A10 | #FFF7F8 | Text on primary |
| gold | #F2C14E | #B07A06 | Stars only |
| stub / stub-foreground | #2B2418 / #F1DFBD | #F7EFE1 / #4A3A1C | Watch ticket stubs |

Contrast (WCAG AA) is checked for every text pair above: lowest is primary text on a dark card, 4.69:1. Input borders are at least 3:1. White text on the dark-mode accent is 3.66:1 and is not allowed; use `text-primary-foreground`.

## Type

One family: **Archivo**, variable weight and width (`--font-archivo`).

- `font-display` (75 % width, weight 750): page titles, Title names on the Entry page, the "Next" line. It echoes a film poster's billing block.
- Body: normal width, 400 and 500. 16 px minimum for inputs (stops iOS zoom).
- `tabular` for episode numbers, counts and dates.
- Sentence case everywhere. No all-caps labels, no letter-spaced eyebrows, no middle-dot metadata strings.

## Layout

Mobile first at 375 px; desktop is a bigger view of the same screens (max width about 72 rem, centred). Respect safe areas (`env(safe-area-inset-*)`). Touch targets at least 44 px, with 8 px between them.

```
Library (/)                         Entry (/entry/[id])
+-------------------------------+   +-------------------------------+
| Kinbox                 (menu) |   | < Library                     |
| [ Search a movie or series  ] |   |  blurred poster scrim         |
| To watch  Watching  Watched  D|   | +------+ Name (display)       |
| All  Movies  Series           |   | |poster| 2019  Series         |
| +-----+ +-----+               |   | +------+ [Watching v]         |
| |     | |     |  poster grid  |   | Next: S2 E4   [Watched it]    |
| +-----+ +-----+  2 cols phone |   | 7 of 62 watched               |
| Name    Name     5-6 desktop  |   | Rating  ★★★½☆                 |
| Next: S2 E4                   |   | Watches  [stub 12 Oct 2026]   |
+-------------------------------+   | Note                          |
                                    | Season 1  10 of 10      (v)   |
                                    | Season 2   2 of 10      (v)   |
                                    | Specials                (v)   |
                                    | Remove from library           |
                                    +-------------------------------+
```

- **Library:** the search field sits at the top of the Library; typing replaces the grid with results. Tabs: To watch, Watching, Watched, Dropped, each with its count. Kind filter: All, Movies, Series. Poster grid, 2 columns on a phone. Watching Series cards show "Next: S2 E4" or "Caught up", plus a one-tap "Watched it".
- **Search results:** a list. Each row: poster (w92), name, year, a "Movie" or "Series" badge, and three one-tap buttons: To watch, Watching, Watched. A Title already in the Library shows its Status instead. After a save the row confirms in place (and offers the optional Note, the optional "next to watch" picker for a Series saved as Watching, and stars after Watched).
- **Entry page:** described in the sketch. Seasons open in place. Unaired Episodes are greyed with "Airs 12 Mar 2030". Specials sit last.

## Gradients

Only where they mean something:

- Entry page: the Title's own poster, blurred and darkened, runs edge to edge from behind the app header and fades into the page colour (a scrim), with no visible edge. Text over it must keep AA contrast: put a solid-to-transparent background gradient under text, never text straight on the image.
- Primary action and the active tab: a soft velvet glow (`box-shadow` with the primary colour at low opacity), not a gradient fill.
- Poster cards: a short bottom gradient on the poster only where a badge sits on it.
- Never gradient text, rainbow gradients or gradient page backgrounds.

## Motion

Feedback, not decoration. Animate only `transform` and `opacity`, 150-300 ms, `ease-out` for entering and `ease-in` for leaving. No layout shift. `prefers-reduced-motion` keeps the state change and drops the movement (globals.css already shortens all motion).

- **Optimistic taps.** Every capture tap (save, tick, "Watched it", Status change, Rating) updates the screen at once with `useOptimistic`, then the Server Action confirms. On failure, roll back and show a toast with the error.
- **Ticks:** the check draws in and the row settles (scale 0.96 → 1).
- **"Next" line:** on "Watched it", the old label slides up and out, the new one slides in from below.
- **Seasons:** expand with a height-free technique (grid-rows `0fr → 1fr`, or the shadcn Accordion animation).
- **"Also mark the 15 earlier episodes?":** a toast that slides up, with one action button, dismissed after about 8 s.
- **Navigation:** React `<ViewTransition>` (React 19.3, no config; see `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`). The poster morphs from the Library card into the Entry page header. Tabs crossfade.
- **Loading:** `Skeleton` shapes that match the final layout (poster ratio 2:3), with a gentle shimmer. Never a blank screen or a lone spinner.

## Words

Glossary terms (Entry, Watch, Status, Progress) are for code. Screens use these words:

| Thing | Screen words |
|---|---|
| Statuses | To watch, Watching, Watched, Dropped |
| Save buttons | To watch, Watching, Watched |
| Kind | Movie, Series |
| Next line | "Next: S2 E4", with the button "Watched it" |
| Caught up marker | Caught up (helper: "New episodes will show here") |
| Count line | "461 of 466 watched", plus ", 5 not out yet" when some numbered Episodes have not aired |
| Finished, all watched | All episodes watched |
| A Special | Special 3 |
| Unaired | Airs 12 Mar 2030, or "Not aired yet" with no date |
| Watch date unknown | Date unknown |
| Rewatch | Watched again |
| Picker at save | Next to watch (optional): Season, Episode |
| Earlier offer | "Also mark the 15 earlier episodes?", with the button "Mark them" |
| Whole Season | Mark season watched / Unmark season |
| Delete Entry | Remove from library → dialog "Remove Dune from your library?" body "Its watches, rating and note go too. This can't be undone." buttons "Remove" / "Cancel" |
| Delete Watch | Remove this watch |
| Note | Note (helper: "Only you see this") |
| Rating, not started | Rate it once you start watching |
| Empty To watch | "Nothing saved yet. Search for a movie or series to save it." |
| Empty other tabs | Say what lands there, e.g. "Series you're watching show up here." |
| No results | "No matches for “dnue”. Check the spelling or try the original title." |
| TMDB down | "Can't reach the movie database right now. Try again in a minute." |
| Generic failure | "Couldn't save that. Try again." |

Buttons start with a verb where they act ("Remove", "Mark them"); Status buttons use the Status name. Toasts are one line, past tense for success ("Saved to To watch", "Marked S2 E4 watched").

## Accessibility

- Every control is keyboard-reachable with a visible focus ring (`ring-ring`, at full strength: a faded ring fails 3:1).
- Icon-only buttons have an `aria-label`. Status is never shown by colour alone: pair with an icon and a word.
- Stars: a radio group of 10 half-steps with labels like "3.5 stars"; arrow keys move.
- Episode ticks are real checkboxes with labels like "S2 E4, Ozymandias".
- Toasts with actions are reachable by keyboard, have buttons at least 44 px tall, and stay 8 s. The timer waits while the toast is hovered or has keyboard focus.
- Images: posters have `alt` set to the Title name; decorative scrims have `alt=""` and `aria-hidden`.

## Performance

- Server Components by default. Client components are small leaves with narrow props.
- Posters: plain `<img>` (or `next/image` with `unoptimized`) from `image.tmdb.org` sized images: w92 in search rows, w342 on cards, w500 on the Entry page; `loading="lazy"` below the fold, `decoding="async"`, fixed 2:3 boxes so nothing shifts.
- Suspense boundaries around every per-Owner read, with skeletons, so the static shell paints at once.
- No animation library unless one interaction needs it; then lazy-load it.

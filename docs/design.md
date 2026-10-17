# Kinbox design

How Kinbox looks, moves and speaks. Screens follow this file; `src/app/globals.css` holds the tokens.

## Idea: the lobby

Kinbox is used in two moments: grabbing a Title on the phone before it is forgotten, and choosing what to watch tonight. The app is the lobby wall of a cinema you own.

- **The wall is the hero.** Posters run edge to edge in a tight wall, and their light spills into the room behind the glass. On a phone you see posters, not interface.
- **Posters are the only colour in the building.** Every token is a neutral. The one exception is the Rating stars. There is no brand hue.
- **Chrome is colourless frosted glass** that floats over the wall. Primary actions are solid white pills in the dark and solid ink pills in the light.
- **Hard edges for posters, soft edges for chrome.** Posters are square. Buttons, tabs, chips and fields are pills; sheets and panels are rounded 24 px.
- **One memorable thing: the wall.** Everything around it stays quiet. On the Entry page the poster is the full-bleed hero and the name sits on it.
- **Dark-first.** The app follows the phone's light or dark setting. Design and check dark first, then light.

## Tokens

All colours are CSS variables in `globals.css`, exposed as Tailwind colours (`bg-background`, `text-muted-foreground`, `bg-primary`, `text-stars`, `bg-glass-strong`…). Never write raw hex in components.

| Token | Dark | Light | Use |
|---|---|---|---|
| background | #0A0C12 | #E7EAF0 | Page, under the ambient glow |
| card | #161922 | #FFFFFF | Menus, dialogs, toasts, and the fallback for glass |
| glass | white 7 % | white 72 % | Sheets, panels, rows over the page colour |
| glass-strong | #161922 at 88 % | white at 86 % | Anything with text that can sit over a poster: the sticky bar, the search field, chips |
| glass edge (`border`) | white 12 % | ink 10 % | Hairline on glass |
| foreground | #F4F5F8 | #0E121A | Text |
| muted-foreground | #A7ADBB | #4D5565 | Secondary text |
| primary | #F4F5F8 | #0E121A | Filled buttons, the active tab, ticks |
| primary-foreground | #0A0C12 | #FFFFFF | Text on primary |
| secondary | white 9 % | ink 6 % | Flat tiles and quiet buttons inside a sheet |
| muted | #1B1F2A | #D9DDE6 | Poster placeholder, skeletons |
| input | #6E7483 | #7C8494 | Input borders (3:1) |
| ring | #F4F5F8 | #0E121A | Focus |
| stars | #F5C451 | #A86F00 | Rating stars only |
| destructive | #FF6B6B | #B42318 | Remove |

Contrast (WCAG AA), checked with the worst poster behind each pair (a white poster in the dark, a black one in the light):

- Text pairs: foreground and muted-foreground on background, card, glass-strong, the poster label scrim, the hero scrim and `secondary` tiles. The lowest is muted-foreground on glass-strong over a white poster at 5.45:1 in the dark, and on the poster label scrim over a black poster at 5.20:1 in the light.
- UI pairs: input borders on background and card (lowest 3.12:1, light), the ring, and the stars (lowest 3.53:1, light).
- Text over a poster never sits on bare glass. It sits on a scrim that is at least 92 % the page colour, or on `glass-strong`.
- Without `backdrop-filter`, glass falls back to the solid card colour, so no text depends on the blur.
- The ambient glow's opacity is a token (`--glow-opacity`, 0.35 dark, 0.25 light). No text with muted colour sits on bare glow: it sits on `glass-strong`.

## Type

One family: **Figtree** (`next/font/google`, variable weight, `--font-figtree`). Quiet and round, so the posters' own type does the shouting.

- `font-display` (weight 800, tracking -0.02 em, leading 1.05): the wordmark, page titles, Title names on the Entry page (36-48 px), the "Next" line.
- Body: 15-16 px at 400 and 500. Section headings 18 px at 700. Inputs are at least 16 px (stops iOS zoom).
- `tabular` for episode numbers, counts and dates.
- Sentence case everywhere. No all-caps labels, no letter-spaced eyebrows, no middle-dot metadata strings.

## Layout

Mobile first at 375 px; desktop is a bigger view of the same screens (content max width 80 rem). Respect safe areas (`env(safe-area-inset-*)`). Touch targets at least 44 px, with 8 px between them.

```
Library (375)                          Entry (375)
+-------------------------------+      +-------------------------------+
| Kinbox                  (o)   |      |  full-bleed poster (w500),     |
| [ Search a movie or series ]  |      |  68 % of the screen height     |
|###############################|glass |                               |
|# To watch  Watching  Watched #|sticky| Kinbox                  (o)   |
|###############################|bar   | < Library (glass pill)        |
|  All  Movies  Series          |      |                               |
|  (Under 2 h v)(Genre v)(Movie|Series)  |▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓| <- scrim
+---------------+---------------+      | Breaking Bad (display)        |
|               |               |      | 2008  Series  [Watching v]    |
|    poster     |    poster     |      +-------------------------------+
|               |               |      |  glass sheet, rounded top     |
|▓Name 2019 ▓▓▓▓|▓Name ▓▓▓▓▓▓▓▓▓|      |  Next: S2 E4   (Watched it)   |
+---------------+---------------+      |  10 of 62 watched             |
|    poster     |    poster     |      |  Overview / Seasons           |
|▓Next: S2 E4 ▓▓|               |      |  Rating ★★★½☆                 |
|▓(Watched it)▓▓|               |      |  Watches  [date tiles]        |
+---------------+---------------+      |  Note / Remove                |
                                       +-------------------------------+
```

- **Header:** the wordmark and the account menu sit above everything, not sticky. On an Entry page they float over the hero, on a top scrim.
- **Library:** the search field, then one sticky glass bar holding the Status tabs (the active one is a solid `primary` pill, each with its count). The wall slides under the bar. Below the bar: the kind filter (All, Movies, Series) and the tonight row. The glow behind them comes from the first four posters (see Ambient glow).
- **Tonight row (preview):** a row of glass chips for length, genre, and Movie or Series, with a "Preview" tag. It is inert and hidden from assistive tech. It shows where the choosing-tonight filters live; nothing behind it works yet.
- **The wall:** posters bleed past the page gutters to the screen edges. Gutters between posters are 3 px on a phone and 6 px from 640 px. 2 columns at 375 px, 3 at 640, 4 at 768, 5 at 1024, 6 at 1280.
- **Cards:** the poster fills the cell. A bottom scrim carries the name (two lines, one when there is a button), the year and a "Movie" or "Series" badge. A watching Series adds "Next: S2 E4" and a full-width glass "Watched it" button (44 px) inside the scrim. A watched card shows its date. A tap anywhere on the card opens the Entry; the button is a separate target above it. Hover and press scale the poster only.
- **Not out yet (preview):** a small outlined pill with a calendar icon and a date ("Out 18 Dec"; it also fits "Premieres 18 Dec"). It sits beside the year and kind on cards, search rows and the Entry page. It is hidden from assistive tech until it is real data.
- **Search results:** a glass panel (at most 42 rem wide) replaces the wall. Each row: poster (w92), name, year, kind badge, and three glass pill buttons: To watch, Watching, Watched. A Title already in the Library shows its Status as a solid pill instead. After a save the row confirms in place and offers the optional Note, the optional "next to watch" picker and, after Watched, the stars.
- **Entry page:** a full-bleed poster hero (the real image, top aligned, no blur) fades into the page colour. The name, year, kind and Status menu sit on the scrim at its foot. A glass sheet with rounded top corners (24 px) overlaps the hero and holds everything else in reading order: for a Series the Next block, then the overview, then Seasons; then Rating, Watches, Note, Remove from library.
- **Seasons:** glass rows that open in place. Episode rows sit inside on a solid card, with round ticks. Unaired Episodes are greyed with "Airs 12 Mar 2030". Specials sit last.
- **Watches:** small flat-glass tiles in a row, each with its date. No ticket stubs.
- **Desktop (1280):** the same wall at 6 columns. The Entry page puts the poster hero in a tall sticky left column (5/12) and the glass sheet in the right column.
- **Sign-in and About:** the wordmark large on the page colour, with one glass panel holding the form or the data-source text.

## Ambient glow

Behind the Library wall a fixed layer holds the first four posters as w92 images, scaled up and blurred (60 px), at the glow opacity token. It is the room's light. It is rendered on the server from the cards already loaded, is decorative (`alt=""`, `aria-hidden`), runs no script and has no animation. Glass bars never animate their blur: only opacity and transform move.

## Motion

Feedback, not decoration. Animate only `transform` and `opacity`, 150-300 ms, `ease-out` for entering and `ease-in` for leaving. No layout shift. `prefers-reduced-motion` keeps the state change and drops the movement (globals.css already shortens all motion). The wall gets no entrance animation. The one deliberate moment is the poster morphing from its card into the Entry hero.

- **Optimistic taps.** Every capture tap (save, tick, "Watched it", Status change, Rating) updates the screen at once with `useOptimistic`, then the Server Action confirms. On failure, roll back and show a toast with the error.
- **Ticks:** the check draws in and the row settles (scale 0.96 → 1).
- **"Next" line:** on "Watched it", the old label slides up and out, the new one slides in from below.
- **Seasons:** expand with a height-free technique (the shadcn Accordion animation).
- **Toasts:** solid card colour, never glass, because they float over posters. The action is a white (or ink) pill. A toast with stars puts its button under the stars. "Also mark the 15 earlier episodes?" slides up with one action button, dismissed after about 8 s.
- **Navigation:** React `<ViewTransition>` (React 19.3, no config; see `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`). The poster morphs from the Library card into the Entry hero. Tabs crossfade.
- **Loading:** `Skeleton` shapes that match the final layout (poster ratio 2:3, the tab bar, the hero and sheet), with a gentle pulse. Never a blank screen or a lone spinner.

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
| Tonight row (preview only) | "Preview" tag, "Under 2 h", "Genre", "Movie", "Series" |
| Not out yet (preview only) | "Out 18 Dec" for a Movie, "Premieres 18 Dec" for a Series |

Buttons start with a verb where they act ("Remove", "Mark them"); Status buttons use the Status name. Toasts are one line, past tense for success ("Saved to To watch", "Marked S2 E4 watched").

## Accessibility

- Every control is keyboard-reachable with a visible focus ring (`ring-ring`, at full strength: a faded ring fails 3:1).
- Icon-only buttons have an `aria-label`. Status is never shown by colour alone: pair with an icon and a word.
- Stars: a radio group of 10 half-steps with labels like "3.5 stars"; arrow keys move.
- Episode ticks are real checkboxes with labels like "S2 E4, Ozymandias".
- Toasts with actions are reachable by keyboard, have buttons at least 44 px tall, and stay 8 s. The timer waits while the toast is hovered or has keyboard focus.
- Images: posters have `alt` set to the Title name; decorative scrims have `alt=""` and `aria-hidden`.
- The tonight row and the not-out-yet label are previews of unbuilt features: both are `aria-hidden`, and the tonight row is also `inert`, so neither can take focus.

## Performance

- Server Components by default. Client components are small leaves with narrow props.
- Posters: plain `<img>` (or `next/image` with `unoptimized`) from `image.tmdb.org` sized images: w92 in search rows, w342 on cards, w500 on the Entry page; `loading="lazy"` below the fold, `decoding="async"`, fixed 2:3 boxes so nothing shifts.
- Suspense boundaries around every per-Owner read, with skeletons, so the static shell paints at once.
- No animation library unless one interaction needs it; then lazy-load it.

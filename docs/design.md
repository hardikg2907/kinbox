# Kinbox design

How Kinbox looks, moves and speaks. Screens follow this file; `src/app/globals.css` holds the tokens.

## Idea: the wall and the dock

Kinbox is used in two moments: grabbing a Title on the phone before it is forgotten, and choosing what to watch tonight, often from a long list. The screen belongs to the posters; everything you touch sits in one glass dock at the bottom, in thumb reach.

- **The wall is the content.** The poster wall starts at the top of the screen. There is no header stack: a small wordmark scrolls away with the wall.
- **The dock is the control.** Status tabs, search and filters live in a floating glass dock at the bottom. Search and filters grow up out of the dock as glass sheets.
- **Posters are the only colour.** Every token is a neutral. A Title's own poster colours tint its drawer and page, and bloom when you tap "Watched it". There is no brand hue; the only fixed colour is the Rating stars.
- **Dense on purpose.** Long lists are normal: switch between tiles and a compact list, and pinch the tiles to 2, 3 or 4 columns. No layout shows only one or two Titles per screen.
- **Filters are navigation; a status change is an action.** Tabs and chips filter what you see. Moving a Title to another status is a verb in an action sheet, never a tab.
- **Dark-first.** The app follows the phone's light or dark setting. Design and check dark first; light must look just as finished.

## Tokens

All colours are CSS variables in `globals.css`, exposed as Tailwind colours (`bg-background`, `text-muted-foreground`, `bg-primary`, `text-stars`, `bg-glass-strong`…). Never write raw hex in components.

| Token | Dark | Light | Use |
|---|---|---|---|
| background | #0A0C12 | #E7EAF0 | Page |
| card | #161922 | #FFFFFF | Menus, dialogs, toasts, and the fallback for glass |
| glass | white 7 % | white 72 % | Sheets and the dock over the page colour |
| glass-strong | #161922 at 88 % | white at 86 % | Anything with text that can sit over a poster: the dock, sheets over the wall, chips |
| glass edge (`border`) | white 12 % | ink 10 % | Hairline on glass |
| foreground | #F4F5F8 | #0E121A | Text |
| muted-foreground | #A7ADBB | #4D5565 | Secondary text |
| primary | #F4F5F8 | #0E121A | Filled buttons, the active tab pill, ticks |
| primary-foreground | #0A0C12 | #FFFFFF | Text on primary |
| secondary | white 9 % | ink 6 % | Quiet buttons and chips inside a sheet |
| muted | #1B1F2A | #D9DDE6 | Poster placeholder, skeletons |
| input | #6E7483 | #7C8494 | Input borders (3:1) |
| ring | #F4F5F8 | #0E121A | Focus |
| stars | #F5C451 | #A86F00 | Rating stars only |
| destructive | #FF6B6B | #A81F14 | Remove from library (4.79:1 on the darkest light tint) |

Shape and type scale. The radii are tokens in `globals.css`; the type sizes are plain Tailwind sizes, not tokens:

- Radius: 6 px (small posters at 4 columns, thumbnails), 10 px (posters), 18 px (cards inside sheets), 28 px (sheets, the drawer, the dock), pill (buttons, tabs, chips). The radius follows the size; one value never covers everything.
- Type: 12, 14, 16, 20, 30, 44 and 64 px.
- Easing: `--spring` (a CSS `linear()` spring with a small overshoot) for things that grow, settle or snap; `--ease-morph` (`cubic-bezier(0.22, 1, 0.36, 1)`) for poster morphs.

Contrast (WCAG AA), checked with the worst poster behind each pair (a white poster in the dark, a black one in the light):

- Text pairs: foreground and muted-foreground on background, card, glass-strong, the lead-tile scrim and the hero scrim. The lowest is muted-foreground (the episode name) on the lead-tile scrim over a black poster at 5.21:1 in the light; measured on the six Series posters in the Library it is 5.19:1, and the name and Next line stay above 12.9:1.
- UI pairs: input borders on background and card (lowest 3.12:1, light), the ring, and the stars (lowest 3.53:1, light).
- Text over a poster never sits on bare glass. It sits on a scrim that is at least 92 % the page colour at the text line, or on `glass-strong`. The scrim also hides the poster's own printed title under a Title name.
- A poster-tinted background (drawer, page) is the page colour mixed with at most 44 % of a poster colour; text on it is checked against the darkest and lightest tint the mix can produce.
- Without `backdrop-filter`, glass falls back to the solid card colour, so no text depends on the blur.

## Type

One family: **Figtree** (`next/font/google`, variable weight, `--font-figtree`). Quiet and round, so the posters' own type does the shouting.

- `font-display` (weight 800, tracking -0.02 em, leading 1.05): the wordmark, Title names in the drawer (30 px) and on the full view (44 px), the "Next" numerals (44 px).
- Body: 16 px at 400 and 500; captions 14 px; small labels 12 px. Inputs are at least 16 px (stops iOS zoom).
- `tabular` for episode numbers, counts and dates.
- Sentence case everywhere. No all-caps labels, no letter-spaced eyebrows, no middle-dot metadata strings.

## Layout

Mobile first at 375 px; desktop is a bigger view of the same screens. Respect safe areas (`env(safe-area-inset-*)`). Touch targets at least 44 px, with 8 px between them.

```
Library (375)                        Title drawer (375)                Full view (375)
+-------------------------------+    +-------------------------------+ +-------------------------------+
| Kinbox            [▦] [≡]  (o)|    |  wall, dimmed                 | | (x)    full-bleed poster      |
| +---------------------------+ |    |                               | |        (w500 over the w342)   |
| | wide lead tile (Watching) | |    +==========  ----  ===========+ |                               |
| | Andor  Next: S2 E5 [Watch]| |    | poster strip, tinted         | | Breaking Bad (44, display)    |
| +---------------------------+ |    | Breaking Bad (30)            | | [Watching v]                  |
| +-----------+ +-----------+   |    | [Watching v]                 | | Next: S2 E4   [Watched it]    |
| |  poster   | |  poster   |   |    | Next: S2 E4   [Watched it]   | | Down                          |
| +-----------+ +-----------+   |    | Down                         | | ★★★★☆  10 of 62 watched       |
| The Simpsons  Slow Horses     |    | ★★★★☆                        | | Overview                      |
| Caught up     Next: S2 E3     |    +-------------------------------+ | Seasons / Watches / Note      |
|               [Watched it]    |     pull up: grows in place  -->    | Remove from library           |
| (Q) [3 To watch|4 Watching|..] (≡2)                                  +-------------------------------+
+-------------------------------+
```

### Library

- **Top:** the wordmark on the left; on the right the Tiles and List buttons, then a round account button (it opens the account menu: About, Import a list, Sign out; the menu arrives with Import a list). All scroll away with the wall.
- **The wall:** a grid with the name under each poster, not on it. Under the name: for a watching Series "Next: S2 E4" and a compact "Watched it" button; "Caught up" with its helper; for Watched the date; the not-out-yet label when it applies. The default is 2 columns, 3 from 40 rem (640 px) and 4 from 64 rem (1024 px). At 375 px that is 2 columns.
- **Lead tile:** on the Watching tab only, the most recent Series gets a 4:3 crop of its poster, cut a quarter of the way down, where faces usually are, so they clear the text. On a phone it spans the whole row, at most about 40 % of the screen. On desktop it spans two columns and the height of its row, with the name at 30 px and the Next and episode lines at 16 px. The name, Next, the episode name and "Watched it" sit on a scrim that is solid (92 % page colour) only behind the text and eases out just above it, so the rest of the poster stays bright. Other tabs are a plain grid.
- **Layout:** a view setting, not a filter: Tiles or List. Two round icon buttons in the top bar, a grid and a list, switch it; the pressed one is filled. They are plain buttons, not tabs, so they never look like the dock. Tiles shows the default grid, or the size last pinched to. Tile size is a shortcut: pinch the wall to switch between 2 and 3 columns on a phone; Ctrl/⌘ + wheel over the wall steps through 2, 3 and 4 columns on desktop. The choice belongs to the device, not the account: it is saved in a cookie (`kb_layout`, like the time-zone cookie). The server renders the right grid, and a script in the document head copies the saved layout (and, on the Library's address, the tab and the kind filter) onto the page before the first paint, so the loading skeleton already has the final shape. At 3 columns and more, names drop to one line and the "Watched it" button becomes an icon button with the same accessible name.
- **List view:** one row per Title: 46 px thumbnail (w92), name, and the Next line or date, with the action at the right edge. Rows are separated by spacing and a hairline.
- **The dock:** floats at the bottom, inside the 16 px gutter, above the safe area, with 8 px between the round buttons and the tabs. On a phone the tab labels are 11 px, so each stays at least 6 px inside its pill. Left: a round search button. Middle: the four status tabs as a segmented glass control, each with its count; a solid pill slides to the active one. Right: a round filter button with a count badge when filters are set. On scroll down the dock shrinks to a slim pill showing the active status; on scroll up it grows back. While a sheet is open the dock steps back under it, and it returns as the sheet shrinks into it.
- **Active filters** show as removable chips above the wall, only when any are set.
- **Search sheet:** the search button grows up into a full-height glass sheet. The field sits at the bottom, in thumb reach; results fill the sheet above it. Before there are results or a no-match message, the empty space shows the quiet hint "Search for a movie or series to save it.", centred. Each result: poster (w92), name, year, kind badge, the not-out-yet label when it applies, and three save buttons: To watch, Watching, Watched. A Title already in the Library shows its status instead. After a save the row confirms in place and offers the optional Note, the "next to watch" picker and, after Watched, the stars.
- **Filter sheet:** the filter button grows up into a glass sheet titled "Filters". The "Show" section holds kind (All, Movies, Series); length and genre join it when the tonight filters are built. "Clear filters" (only when a filter is set) and "Done" close it.
- **Empty tabs** say what lands there, centred in the space above the dock. When the Library has no Titles at all, the To watch empty text adds the link "Have a list somewhere? Paste it", which opens Import a list. The link comes with Import a list.

### Title: one set of sections, two containers

The Title is built from sections written once: hero, status pill, Next block, rating, progress, overview, Seasons, Watches, Note, Remove from library. Two containers stack them:

- **The drawer** opens when you tap a Title in the Library (or any list). It rises over the dimmed wall to a quick view: the poster strip, the name, the status pill, the Next block with "Watched it" and the stars. A Title with no Next block (To watch, or a Movie) shows its two-line overview and the year, kind and runtime line in that space. **Pull the drawer up and it grows in place into the full view:** the strip widens into the full-bleed hero, the name grows, and every section follows below. Scrolling up inside the quick view also grows it. At full height the content scrolls; pulling down from the top shrinks it back to the quick view, and pulling down again closes it. The drag handle is a real button ("Show more" / "Show less"). Back closes the drawer. The address is the Title's own address while the drawer is open.
- **The page** is what a direct link (or a reload) to a Title opens: the same full view, standalone, with a close button that goes to the Library.
- **Full view:** a full-bleed poster hero (the w342 already on screen shows at once, the w500 fades in over it when decoded, so nothing flashes). The name, the status pill and the Next block sit on the scrim at its foot, so "Next: S2 E4" and "Watched it" are above the fold. As you scroll, the name and the status pill move into a slim sticky glass bar. Then: rating, the progress line ("10 of 62 watched" with a thin bar), the overview, Seasons, Watches, Note, and Remove from library last.
- **Seasons:** rows that open in place. Episode rows have round ticks. Unaired Episodes are greyed with "Airs 12 Mar 2030". Specials sit last.
- **Watches:** a short dated list.

### Status sheet

- The status pill shows the current status with its icon and a small chevron, in an outlined pill. Tapping it opens an action sheet: the Title's thumbnail and name, one line saying where it is now, then verb rows for the moves that make sense from here (see Words), the likely next step first, "Drop it" last, then Cancel. Rows with consequences carry one helper line. Nothing in it looks like the dock's tabs.
- Rows by status: To watch: Start watching, Mark as watched, Drop it. Watching: Mark as watched, Watch later, Drop it. Watched: Watched again, Start watching, Watch later, Drop it. Dropped: Start watching, Watch later, Mark as watched.
- A helper uses a number or a place only where the screen knows it. A Series with one aired Episode gets the short form ("Ticks all aired episodes"); a Series with none gets no "Mark as watched" helper.
- On a phone the sheet rises from the bottom; on desktop it is a 360 px popover below the pill, or beside the poster. Either way it grows out of what opened it. A tap or a click puts focus on the Title's name; the keyboard puts it on the first row. Escape, Cancel and the dimmed page close it, and focus goes back to what opened it.
- In the sticky bar the name sits at the left, after the close button, and a compact pill sits at the right edge.
- Press-and-hold a poster in the Library (right-click with a mouse) lifts it and opens the same sheet with an extra "Open" row on top. The hold takes about 450 ms; a move of more than 8 px, a scroll or a second finger cancels it. The lifted poster is a copy drawn over the dimmed page, a little larger; on a phone it moves up clear of the sheet. On touch screens only (`pointer: coarse`), a hint "Press and hold a poster for quick actions." shows once per device, as a toast with a Close button; it stays until it is closed or a poster is held, and it hides while a sheet or the drawer is open. The poster suppresses the browser's own long-press menu, image preview and drag (`-webkit-touch-callout: none`, `user-select: none`, `draggable="false"`); a normal tap still opens the Title, and a scroll never triggers the hold. The pill stays the keyboard and screen-reader path.
- A move from the wall reads as one sequence: the sheet goes and the lifted copy fades (about 0.2 s), then the card leaves its tab, the counts change and the cards behind it glide into its place. Focus goes to the card that takes its place. A failure puts the card and the counts back with the generic error toast.
- A status change applies at once and shows a toast with Undo. Undo reverses everything the move did: for "Mark as watched" on a Series, the ticks it added, the Watch it created and the timestamps that order the Library. After Undo the card is back in its tab and in its place. There is one toast per Title: a new move replaces the last one.

### Desktop (1280)

A left glass sidebar (about 296 px) replaces the dock: the wordmark, the search field, the four status tabs as a vertical list with counts, and the kind filter. The Tiles and List buttons and the account button sit in a row above the wall's right edge, level with the sidebar's top. The wall fills the rest, at 4 columns by default. Tab goes through the sidebar first, then that row, then the wall. The drawer opens from the right as a side panel; pulling up is not needed there, so the panel simply scrolls, and a direct link opens the page in the content area.

### Import a list

A focused full page (`/import`) outside the dock: nothing on it competes with the one job. The flow, rules and words are in `docs/paste-import.md`; this section is how it looks.

- **Top bar:** a round Close button on the left (back to the Library) and the title "Import a list". It stays put while the page scrolls, as slim glass.
- **Bottom action bar:** pinned at the bottom in thumb reach, in the dock's shape (inset glass, 28 px radius, above the safe area), holding the one main action as a full-width primary button: "Check list", then "Add 238 titles". A progress line can sit above the button.
- **Paste step:** one large text field on glass (16 px text) with its label and helper above it; the count ("248 titles") under it.
- **Match row:** the search result row layout (w92 poster, name, year, kind badge), with the original pasted line under the name in small muted text, so the Owner can see what it was read from. On the right, the To watch / Watched choice uses the save-button style (two status-name pills, the chosen one filled); it never looks like the dock's tabs. Row states replace the choice with a muted helper and, where there is one, a button: "Already in your library"; "Skipped" with "Include"; "Not found"; "Couldn't check" with "Try again". Tapping the poster or name opens the pick sheet.
- **Groups:** problem groups come first, each a heading with its rows ("Check these", "Not found", "Couldn't check"). The rows that look right fold into one row ("198 look right") that opens in place, like a Season.
- **Pick sheet:** the search sheet in a "pick" variant: title "Pick the right title", the top 3 candidates as result rows, the search field at the bottom, and "Skip this line" at the end. One tap on a result picks it and closes the sheet; there are no save buttons.
- **Progress line:** the Title page's progress line ("Checking 120 of 248" with a thin bar).
- **Result:** the summary lines, the rows that could not be added, "Copy the 14 lines not added", and "Undo this import" as a quiet button with its confirmation dialog.
- **Desktop:** a centred column of about 640 px on the page colour, with no sidebar; the top bar and the action bar span that column.

### Sign-in and About

The wordmark large on the page colour, with one glass panel holding the form or the data-source text and the TMDB logo.

## Gradients

Only from posters, only where they mean something:

- **Drawer and page:** the background is the page colour mixed with the Title's poster colour (read once from the w92 poster in a small canvas, with `crossOrigin="anonymous"`; TMDB allows it). The tint fades in when it is ready; until then the page colour shows.
- **"Watched it" bloom:** on tap, a soft burst of the poster's most vivid colour blooms from the button (radial gradient, scale and opacity, about 400 ms), then the Next label rolls on.
- **Scrims:** a solid-to-transparent gradient of the page colour under any text on a poster.
- Never gradient text, gradient page backgrounds for decoration, or an ambient glow behind the wall.

## Motion

Things grow out of the thing you touched. Animate only `transform` and `opacity` (and CSS variables that drive them). Never animate `backdrop-filter`, width, height or top. No layout shift. `prefers-reduced-motion` keeps every state change and drops the movement (globals.css shortens all motion; gesture physics check the setting too).

- **Optimistic taps.** Every capture tap (save, tick, "Watched it", status change, rating) updates the screen at once, then the Server Action confirms. On failure, roll back and show a toast with the error.
- **Dock:** shrinks and grows with `--spring`; the active-tab pill slides; search and filter sheets grow up out of the dock and shrink back into it.
- **Wall changes:** switching status or filters crossfades the wall once, with the dock and the toasts held above it; switching Tiles, List or tile size moves the cards to their new places (FLIP); removed cards fade and scale out. Posters fade in as they load, never pop.
- **Drawer:** follows the finger, then snaps with `--spring` using the release velocity; a fling down closes it. The hero strip grows into the full-bleed hero as the drawer rises.
- **Poster morph:** React `<ViewTransition>` morphs the poster from its tile into the drawer strip or the page hero (see `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`).
- **Ticks:** the check draws in and the row settles (scale 0.96 → 1).
- **"Next" line:** after the bloom, the old label slides up and out, the new one slides in from below.
- **Press-and-hold:** the poster lifts (scale and shadow) before the sheet opens.
- **Toasts:** solid card colour, never glass. They sit above the dock; while a drawer is open they sit just above its top edge; when it is at full height they sit at the top of the screen. "Also mark the 15 earlier episodes?" has one action button and is dismissed after about 8 s.
- **Loading:** skeletons that match the final layout (the saved layout, the lead tile on the Watching tab, the dock and the sidebar with their words in place, the drawer), with a gentle pulse, so nothing moves when the data arrives. Never a blank screen or a lone spinner.

## Words

Glossary terms (Entry, Watch, Status, Progress) are for code. Screens use these words:

| Thing | Screen words |
|---|---|
| Statuses (tabs, pill) | To watch, Watching, Watched, Dropped |
| Save buttons | To watch, Watching, Watched |
| Kind | Movie, Series |
| Next line | "Next: S2 E4", with the button "Watched it" |
| Caught up marker | Caught up (helper: "New episodes will show here") |
| Count line | "461 of 466 watched", plus ", 5 not out yet" when some numbered Episodes have not aired |
| Finished, all watched | All episodes watched |
| A Special | Special 3 |
| Unaired | Airs 12 Mar 2030, or "Not aired yet" with no date |
| Not out yet | "Out 18 Dec" for a Movie, "Premieres 18 Dec" for a Series |
| Watch date unknown | Date unknown |
| Rewatch | Watched again |
| Picker at save | Next to watch (optional): Season, Episode |
| Earlier offer | "Also mark the 15 earlier episodes?", with the button "Mark them" |
| Whole Season | Mark season watched / Unmark season |
| Status pill (accessible name) | Change from Watching |
| Status sheet line | On your To watch list / You're watching this / You've watched this / You dropped this |
| Move to To watch | Watch later (helper from a watching Series: "Keeps your progress"; from Watched: "Keeps when you watched it") |
| Move to Watching | Start watching (helper from a dropped Series: "Picks up at S2 E4", or "Picks up where you left off" where the next Episode is not known, such as a Library card; from a Watched Series: "Keeps your ticks") |
| Move to Watched | Mark as watched (Series helper: "Ticks all 62 aired episodes", or "Ticks all aired episodes" where the count is not known, such as a Library card); on a Watched Title, "Watched again" takes its place |
| Not out yet, in the sheet | "Start watching" and "Mark as watched" carry the helper "Not out yet" |
| Move to Dropped | Drop it (helper for a Series with progress: "Keeps your progress") |
| Status toasts | Saved to To watch / Now watching / Marked as watched / Watched again, today / Dropped (each with Undo) |
| Drawer handle | Show more / Show less |
| Dock buttons (accessible names) | Search / Filters (with a count when set: "Filters, 1 on") |
| Filter chips | The filter's own word ("Movies"); remove button "Remove Movies filter" |
| Filter sheet | Title "Filters"; section "Show" (All, Movies, Series); buttons "Clear filters" and "Done" |
| Layout buttons (accessible names) | Tiles / List |
| Empty search sheet | Search for a movie or series to save it. |
| Sheets and drawer | Close |
| Account button | Account |
| Press-and-hold | Row "Open"; touch-only hint "Press and hold a poster for quick actions." |
| Delete Entry | Remove from library → dialog "Remove Dune from your library?" body "Its watches, rating and note go too. This can't be undone." buttons "Remove" / "Cancel" |
| Delete Watch | Remove this watch |
| Note | Note (helper: "Only you see this") |
| Rating, not started | Rate it once you start watching |
| Empty To watch | "Nothing saved yet. Search for a movie or series to save it." |
| Empty other tabs | Say what lands there, e.g. "Series you're watching show up here." |
| No results | "No matches for “dnue”. Check the spelling or try the original title." |
| TMDB down | "Can't reach the movie database right now. Try again in a minute." |
| Generic failure | "Couldn't save that. Try again." |

Buttons start with a verb where they act ("Remove", "Mark them", "Start watching"); save buttons and tabs use the status name. "Watched it" (one Episode) lives only on the Next block; "Mark as watched" lives only in the status sheet. Toasts are one line, past tense for success.

## Accessibility

- Every control is keyboard-reachable with a visible focus ring (`ring-ring`, at full strength: a faded ring fails 3:1). Focus that a sheet hands back after a tap or a click shows no ring; the ring is for the keyboard.
- Icon-only buttons have an `aria-label`. Status is never shown by colour alone: pair with an icon and a word.
- Every gesture has a button or key path: the drawer handle is a button (Enter or Space toggles), the status pill opens the same sheet as press-and-hold, and Escape closes sheets and the drawer. Tiles and List are buttons with `aria-pressed`. Tile size (pinch, Ctrl/⌘ + wheel) has no button: it is a shortcut only, and every screen works at the default size.
- Sheets and the drawer trap focus while open and return it to what opened them.
- Stars: a radio group of 10 half-steps with labels like "3.5 stars"; arrow keys move.
- Episode ticks are real checkboxes with labels like "S2 E4, Ozymandias".
- Toasts with actions are reachable by keyboard, have buttons at least 44 px tall, and stay 8 s. The timer waits while the toast is hovered or has keyboard focus.
- Images: posters have `alt` set to the Title name; decorative strips and scrims have `alt=""` and `aria-hidden`.

## Performance

- Server Components by default. Client components are small leaves with narrow props: the dock, the sheets, the drawer gesture, the density control, the palette reader.
- Posters: plain `<img>` (or `next/image` with `unoptimized`) from `image.tmdb.org` sized images: w92 in lists, search rows and for the palette, w342 in the wall and the drawer strip, w500 for the full-view hero; `loading="lazy"` below the fold, `decoding="async"`, fixed 2:3 boxes so nothing shifts.
- Suspense boundaries around every per-Owner read, with skeletons, so the static shell (wordmark, dock frame) paints at once.
- No animation library: springs are CSS `linear()` easings and one small hand-written spring for drag release.

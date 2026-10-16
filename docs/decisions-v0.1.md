# Kinbox v0.1 decisions

Product decisions made while building v0.1, for questions the [v0.1 scope](v0.1-scope.md) did not answer. The scope is updated to match each one; this file records why.

## 2026-10-16

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | What does "Next" show when the Episode after the last watched one is unaired or missing, but an earlier aired Episode is unwatched? | The earliest unwatched aired Episode. "Caught up" shows only when no aired Episode is unwatched. | "Caught up" means every aired Episode is ticked, so a gap must still have a "Next". |
| 2 | Deleting the last Watch when the Status is Dropped or Watching. | The Status changes to To watch only when it was Watched. Otherwise it stays. | The rule exists so a Watched Entry always has a Watch. It must not undo a Dropped or Watching choice. |
| 3 | At save, does the picked Episode mean the next to watch or the last watched? | The next Episode to watch. The Episodes before it are ticked; the picked one is not. The screen says "next to watch". | The card then shows "Next: <picked>", which matches what the Owner just chose. |
| 4 | Episodes with no air date in TMDB. | Aired when any later Episode has aired; unaired otherwise. | Old and regional Series often lack dates for Episodes that aired long ago. Treating all of them as unaired would make "Next" skip them. |
| 5 | Which "today" dates a Watch? | The Owner's time zone, from the phone or browser. | A Watch logged late at night in India must not get the next or previous day from server time (UTC). |
| 6 | When does a Special with no air date count as aired? | When any Episode of the numbered Seasons has aired. | Specials sit outside the season order, so "a later Episode has aired" does not apply. This only decides whether it shows greyed. |
| 7 | Does one-tap Watched on a Series, or picking the next Episode at save, tick Specials? | No. Both tick aired Episodes of the numbered Seasons only. | Specials never count for "Next" or finishing, and ticking dozens of OVAs would be noise. |
| 8 | How should v0.1 look and feel? | A cinematic, calm, dark-first design (light mode supported) with posters as the hero. Gradients and motion are used with purpose: poster scrims, glow on primary actions, tick and "Next" animations, smooth season expand, View Transitions between screens, skeleton loading, optimistic UI on every capture tap. | The owner wants a polished product, not a side project. Motion animates only transform and opacity (about 150-300 ms), respects reduced motion, and keeps WCAG AA contrast, so speed and access do not suffer. |

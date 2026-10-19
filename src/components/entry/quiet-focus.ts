// A browser hides the focus ring on what a tap or a click focused, but not on what script focuses
// next. Safari on iOS never focuses a tapped link, so a drawer that moves focus to its Close button
// shows a ring right after the tap. Focus moved here for the keyboard's sake hides its ring until a
// key is pressed, when the browser's own rule takes over again.

let lastInput: "key" | "pointer" | null = null;
let listening = false;

/** Starts noting the last kind of input. Safe to call more than once. */
export function watchInput(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("keydown", () => (lastInput = "key"), { capture: true, passive: true });
  window.addEventListener("pointerdown", () => (lastInput = "pointer"), { capture: true, passive: true });
}

// The tap that opens a Title comes before the code that moves focus has loaded.
watchInput();

/** Hides the ring on `element` while it keeps the focus it is about to get, unless a key was pressed last. */
export function quietAfterPointer(element: HTMLElement | null | undefined): void {
  if (!element || lastInput === "key") return;
  element.dataset.quietFocus = "";
  const clear = () => {
    delete element.dataset.quietFocus;
    element.removeEventListener("blur", clear);
    window.removeEventListener("keydown", clear, { capture: true });
  };
  element.addEventListener("blur", clear);
  window.addEventListener("keydown", clear, { capture: true });
}

/** Focuses `element` with a ring for the keyboard and none after a tap or a click. */
export function focusAfterInput(element: HTMLElement | null | undefined): void {
  quietAfterPointer(element);
  element?.focus({ preventScroll: true });
}

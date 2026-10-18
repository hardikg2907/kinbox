const DURATION_MS = 420;

/** Reads the vivid colour the Title's tint left on a button's ancestors; null before it is ready. */
export function inheritedBloomColour(button: HTMLElement): string | null {
  return getComputedStyle(button).getPropertyValue("--bloom").trim() || null;
}

// A soft burst from the middle of the button, in the poster's vivid colour (the primary colour
// when the poster has none ready). It lives on <body> so a transformed drawer cannot offset it, and
// it never blocks the tap: callers start it and carry on.
export function playBloom(button: HTMLElement, colour: string | null) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const rect = button.getBoundingClientRect();
  const size = Math.max(260, rect.width * 2.8);
  const burst = document.createElement("span");
  const base = colour ?? "var(--primary)";
  burst.setAttribute("aria-hidden", "true");
  burst.style.cssText = [
    "position:fixed",
    "z-index:90",
    "pointer-events:none",
    "border-radius:50%",
    "will-change:transform,opacity",
    `left:${rect.left + rect.width / 2}px`,
    `top:${rect.top + rect.height / 2}px`,
    `width:${size}px`,
    `height:${size}px`,
    `background:radial-gradient(closest-side, color-mix(in oklab, ${base} 78%, white) 0%, ${base} 34%, color-mix(in oklab, ${base} 45%, transparent) 64%, transparent 100%)`,
  ].join(";");
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) burst.style.mixBlendMode = "screen";
  document.body.append(burst);
  const remove = () => burst.remove();
  burst
    .animate(
      [
        { transform: "translate(-50%,-50%) scale(0.15)", opacity: 1, easing: "cubic-bezier(.2,.8,.3,1)" },
        { transform: "translate(-50%,-50%) scale(0.95)", opacity: 0.85, offset: 0.55, easing: "ease-in" },
        { transform: "translate(-50%,-50%) scale(1.25)", opacity: 0 },
      ],
      { duration: DURATION_MS },
    )
    .finished.then(remove, remove);
}

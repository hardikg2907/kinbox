"use client";

import { createContext } from "react";

/** Set by the Title drawer for the sections inside it; null on the page. */
export const DrawerMotionContext = createContext<{ closing: boolean } | null>(null);

export type SpringOptions = {
  from: number;
  to: number;
  /** Starting speed in px per second, such as a finger's release speed. */
  velocity?: number;
  stiffness?: number;
  damping?: number;
  onUpdate: (value: number) => void;
  onDone?: () => void;
};

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A damped spring stepped once per frame. With reduced motion it lands at once, so every state
 * still changes; only the movement goes.
 */
export function spring({
  from,
  to,
  velocity = 0,
  stiffness = 400,
  damping = 0.86,
  onUpdate,
  onDone,
}: SpringOptions): { stop: () => void } {
  if (prefersReducedMotion()) {
    onUpdate(to);
    onDone?.();
    return { stop() {} };
  }
  const friction = 2 * damping * Math.sqrt(stiffness);
  let position = from;
  let speed = velocity;
  let last = performance.now();
  let frame = requestAnimationFrame(step);

  function step(now: number) {
    // Small fixed sub-steps keep a slow frame from overshooting wildly.
    const elapsed = Math.min(0.064, (now - last) / 1000);
    last = now;
    const steps = Math.max(1, Math.ceil(elapsed / 0.004));
    const h = elapsed / steps;
    for (let i = 0; i < steps; i++) {
      const acceleration = -stiffness * (position - to) - friction * speed;
      speed += acceleration * h;
      position += speed * h;
    }
    if (Math.abs(position - to) < 0.35 && Math.abs(speed) < 6) {
      onUpdate(to);
      onDone?.();
      return;
    }
    onUpdate(position);
    frame = requestAnimationFrame(step);
  }

  return { stop: () => cancelAnimationFrame(frame) };
}

/** Release speed in px per second from the last few (time, position) samples of a drag. */
export function releaseVelocity(samples: ReadonlyArray<readonly [number, number]>): number {
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last || first === last) return 0;
  const elapsed = last[0] - first[0];
  return elapsed > 0 ? ((last[1] - first[1]) / elapsed) * 1000 : 0;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

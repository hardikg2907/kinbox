"use client";

import { Star } from "lucide-react";
import { useId } from "react";
import { cn } from "cn";
import { ratingLabel } from "@/domain/rating";

type RatingStarsProps = {
  /** Half-star units, 1 to 10, or null for no Rating. */
  value: number | null;
  onChange: (halfStars: number | null) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
};

const STARS = [1, 2, 3, 4, 5] as const;

// Ten native radios (one per half star) give arrow-key support and a proper
// accessible name for every value without custom key handling. Each half is
// 24 px wide, the WCAG minimum target size.
/** The empty row of stars, for the eye only, where the Rating is not known yet. */
export function RatingStarsPreview({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex", className)}>
      {STARS.map((star) => (
        <span key={star} className="flex h-12 w-12 items-center justify-center">
          <Star className="size-8 text-muted-foreground" strokeWidth={1.5} />
        </span>
      ))}
    </div>
  );
}

export function RatingStars({ value, onChange, label = "Rating", disabled = false, className }: RatingStarsProps) {
  const name = useId();
  const current = value ?? 0;

  return (
    <fieldset className={cn("flex items-center gap-3", className)} disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      <div className="flex">
        {STARS.map((star) => {
          const fill = current >= star * 2 ? 1 : current === star * 2 - 1 ? 0.5 : 0;
          return (
            <span key={star} className="relative flex h-12 w-12 items-center justify-center">
              <Star aria-hidden className="size-8 text-muted-foreground" strokeWidth={1.5} />
              <span
                aria-hidden
                className="absolute inset-y-0 left-2 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - fill * 100}% 0 0)` }}
              >
                <span className="flex h-12 w-8 items-center">
                  <Star className="size-8 fill-stars text-stars" strokeWidth={1.5} />
                </span>
              </span>
              {[star * 2 - 1, star * 2].map((halfStars, half) => (
                <label
                  key={halfStars}
                  className={cn(
                    "absolute inset-y-0 w-6 cursor-pointer rounded-sm has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring",
                    half === 0 ? "left-0" : "right-0",
                    disabled && "cursor-default",
                  )}
                >
                  <input
                    type="radio"
                    name={name}
                    value={halfStars}
                    checked={value === halfStars}
                    onChange={() => onChange(halfStars)}
                    // The name sits on the radio, not in hidden text beside it: inside a toast, hidden
                    // text would be read out as well and every value would be announced twice.
                    aria-label={ratingLabel(halfStars)}
                    className="sr-only"
                  />
                </label>
              ))}
            </span>
          );
        })}
      </div>
      {value !== null && !disabled ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="min-h-11 cursor-pointer rounded-full px-3 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
        >
          Clear
        </button>
      ) : null}
    </fieldset>
  );
}

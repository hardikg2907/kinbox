"use client";

import { RatingStars } from "@/components/rating-stars";
import { canRate } from "@/domain/rating";
import { useEntry } from "./entry-state";

export function RatingSection() {
  const { model, rate } = useEntry();
  return (
    <section id="entry-rating" aria-labelledby="entry-rating-title">
      {/* The stars sit right under the Next block, so the row explains itself; the heading stays for screen readers. */}
      <h2 id="entry-rating-title" className="sr-only">
        Rating
      </h2>
      {canRate(model.status) ? (
        <RatingStars value={model.ratingHalfStars} onChange={rate} label="Rating" className="-ml-2" />
      ) : (
        <p className="flex min-h-12 items-center text-sm text-muted-foreground">Rate it once you start watching</p>
      )}
    </section>
  );
}

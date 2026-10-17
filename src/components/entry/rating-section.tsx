"use client";

import { RatingStars } from "@/components/rating-stars";
import { canRate } from "@/domain/rating";
import { useEntry } from "./entry-state";

export function RatingSection() {
  const { model, rate } = useEntry();
  return (
    <section id="entry-rating" aria-labelledby="entry-rating-title">
      <h2 id="entry-rating-title" className="text-lg font-bold">
        Rating
      </h2>
      {canRate(model.status) ? (
        <RatingStars
          value={model.ratingHalfStars}
          onChange={rate}
          label="Rating"
          className="-ml-1 mt-1"
        />
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Rate it once you start watching</p>
      )}
    </section>
  );
}

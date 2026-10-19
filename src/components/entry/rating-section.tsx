"use client";

import { RatingStars, RatingStarsPreview } from "@/components/rating-stars";
import type { Status } from "@/domain/types";
import { canRate } from "@/domain/rating";
import { useEntry } from "./entry-state";

const NOT_YET = "flex min-h-12 items-center text-sm text-muted-foreground";
const NOT_YET_TEXT = "Rate it once you start watching";

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
        <p className={NOT_YET}>{NOT_YET_TEXT}</p>
      )}
    </section>
  );
}

/** The stars' row while the Title loads: empty stars in their place; a Rating fills them in when it arrives. */
export function RatingPreview({ status }: { status: Status }) {
  if (!canRate(status)) return <p className={NOT_YET}>{NOT_YET_TEXT}</p>;
  return <RatingStarsPreview className="-ml-2" />;
}

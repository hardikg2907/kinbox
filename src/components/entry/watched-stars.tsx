"use client";

import { useState } from "react";
import { RatingStars } from "@/components/rating-stars";

type WatchedStarsProps = {
  initial: number | null;
  onRate: (halfStars: number | null) => void;
};

// Lives inside a toast, so it keeps its own copy of the value: the toast is
// not part of the page tree and cannot read the page's state.
export function WatchedStars({ initial, onRate }: WatchedStarsProps) {
  const [value, setValue] = useState(initial);
  return (
    <RatingStars
      label="Rate it"
      value={value}
      onChange={(next) => {
        setValue(next);
        onRate(next);
      }}
      className="-ml-1"
    />
  );
}

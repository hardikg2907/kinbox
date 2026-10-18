import { Film } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";
import { posterUrl } from "@/lib/tmdb/images";

type PosterSize = "w92" | "w185" | "w342" | "w500";

type PosterProps = {
  path: string | null;
  name: string;
  size: PosterSize;
  className?: string;
  /** Extra classes for the image itself, such as which part of the poster stays in view. */
  imageClassName?: string;
  /** Above the fold: load at once instead of lazily. */
  eager?: boolean;
  /** The poster sits inside a link that already names the Title, so a screen reader skips it. */
  decorative?: boolean;
  /** Drawn over the poster inside its box; it gets a copy of the poster's face. */
  overlay?: (face: ReactNode) => ReactNode;
};

// A fixed 2:3 box, so the layout never shifts while posters load.
export function Poster({
  path,
  name,
  size,
  className,
  imageClassName,
  eager = false,
  decorative = false,
  overlay,
}: PosterProps) {
  const src = posterUrl(path, size);
  const face = src ? (
    // TMDB serves sized posters, so next/image optimisation would only spend quota.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={decorative ? "" : name}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : "auto"}
      className={cn("absolute inset-0 size-full object-cover", imageClassName)}
    />
  ) : (
    <div
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative ? true : undefined}
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-muted-foreground"
    >
      <Film aria-hidden className="size-6" />
      <span className="line-clamp-3 font-display text-base">{name}</span>
    </div>
  );
  return (
    <div className={cn("relative aspect-[2/3] overflow-hidden rounded-md bg-muted", className)}>
      {face}
      {overlay?.(face)}
    </div>
  );
}

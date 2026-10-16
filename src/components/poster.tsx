import { Film } from "lucide-react";
import { cn } from "cn";
import { posterUrl } from "@/lib/tmdb/images";

type PosterSize = "w92" | "w185" | "w342" | "w500";

type PosterProps = {
  path: string | null;
  name: string;
  size: PosterSize;
  className?: string;
  /** Above the fold: load at once instead of lazily. */
  eager?: boolean;
};

// A fixed 2:3 box, so the layout never shifts while posters load.
export function Poster({ path, name, size, className, eager = false }: PosterProps) {
  const src = posterUrl(path, size);
  return (
    <div className={cn("relative aspect-[2/3] overflow-hidden rounded-md bg-muted", className)}>
      {src ? (
        // TMDB serves sized posters, so next/image optimisation would only spend quota.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={eager ? "high" : "auto"}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={name}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center text-muted-foreground"
        >
          <Film aria-hidden className="size-6 opacity-60" />
          <span className="line-clamp-3 font-display text-sm">{name}</span>
        </div>
      )}
    </div>
  );
}

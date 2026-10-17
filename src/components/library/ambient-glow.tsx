import { posterUrl } from "@/lib/tmdb/images";

type Props = {
  /** Poster paths of the first cards on screen. */
  posterPaths: (string | null)[];
};

const MAX_POSTERS = 4;

// The room's light: the first posters, small, scaled up and blurred, fixed behind the wall.
// It is decorative and static (no script, no animation), and its opacity is a token so a
// bright poster can never lift the page colour under text.
export function AmbientGlow({ posterPaths }: Props) {
  const sources = posterPaths
    .map((path) => posterUrl(path, "w92"))
    .filter((src): src is string => src !== null)
    .slice(0, MAX_POSTERS);
  if (sources.length === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[75svh] overflow-hidden opacity-(--glow-opacity) [mask-image:linear-gradient(to_bottom,black_35%,transparent_100%)]"
    >
      <div className="flex size-full scale-125 blur-[60px]">
        {sources.map((src, index) => (
          // TMDB serves sized posters, so next/image optimisation would only spend quota.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${src}-${index}`}
            src={src}
            alt=""
            decoding="async"
            fetchPriority="low"
            className="h-full min-w-0 flex-1 object-cover"
          />
        ))}
      </div>
    </div>
  );
}

import { ChevronDown, Clock } from "lucide-react";

type Props = {
  length: string;
  genre: string;
  /** Movie, then Series; the first segment is drawn as the chosen one. */
  kinds: readonly [string, string];
};

const CHIP =
  "glass-strong inline-flex h-11 items-center gap-1.5 border rounded-full px-3 text-sm font-medium whitespace-nowrap text-foreground";

// Three chips on one line even at 375 px: the clock only shows once there is room for it.
export function TonightFilters({ length, genre, kinds }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className={CHIP}>
        <Clock aria-hidden className="hidden size-4 sm:block" />
        {length}
        <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
      </span>
      <span className={CHIP}>
        {genre}
        <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
      </span>
      <span className="glass-strong inline-flex h-11 items-center rounded-full border p-1 text-sm whitespace-nowrap text-foreground">
        <span className="inline-flex h-9 items-center rounded-full bg-primary px-3 font-semibold text-primary-foreground">
          {kinds[0]}
        </span>
        <span className="px-3 font-medium">{kinds[1]}</span>
      </span>
    </div>
  );
}

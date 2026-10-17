import { CalendarClock } from "lucide-react";
import { cn } from "cn";

type Props = {
  text: string;
  className?: string;
};

// A small pill with an icon and a date, so it reads as "later" without colour.
// It stays as wide as its words ("Out 18 Dec", "Premieres 18 Dec") and clips only on a very narrow cell.
export function NotOutYetLabel({ text, className }: Props) {
  return (
    <span
      className={cn(
        "tabular inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border border-input bg-card px-2.5 text-xs font-semibold whitespace-nowrap text-foreground",
        className,
      )}
    >
      <CalendarClock aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">{text}</span>
    </span>
  );
}

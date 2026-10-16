import { Bookmark, CircleCheck, CircleSlash2, Play, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import type { Status, TitleKind } from "@/domain/types";

export const STATUS_LABEL: Record<Status, string> = {
  to_watch: "To watch",
  watching: "Watching",
  watched: "Watched",
  dropped: "Dropped",
};

export const STATUS_ICON: Record<Status, LucideIcon> = {
  to_watch: Bookmark,
  watching: Play,
  watched: CircleCheck,
  dropped: CircleSlash2,
};

export const KIND_LABEL: Record<TitleKind, string> = { movie: "Movie", series: "Series" };

/** A Status shown with its icon and word, never by colour alone. */
export function StatusLabel({ status, className }: { status: Status; className?: string }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", className)}>
      <Icon aria-hidden className="size-4 shrink-0" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function KindBadge({ kind, className }: { kind: TitleKind; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}

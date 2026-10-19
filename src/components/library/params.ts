import type { KindFilter } from "@/data/dto";
import { STATUSES, type Status } from "@/domain/types";

export const DEFAULT_TAB: Status = "to_watch";
export const DEFAULT_KIND: KindFilter = "all";

export const KINDS: readonly KindFilter[] = ["all", "movie", "series"];

// A URL is user input: anything that is not a known value falls back to the default.
export function parseTab(value: string | string[] | undefined): Status {
  return STATUSES.find((status) => status === value) ?? DEFAULT_TAB;
}

export function parseKind(value: string | string[] | undefined): KindFilter {
  return KINDS.find((kind) => kind === value) ?? DEFAULT_KIND;
}

/** Defaults stay out of the URL, so the plain Library address is just `/`. */
export function libraryHref(tab: Status, kind: KindFilter): string {
  const query = new URLSearchParams();
  if (tab !== DEFAULT_TAB) query.set("tab", tab);
  if (kind !== DEFAULT_KIND) query.set("kind", kind);
  const text = query.toString();
  return text ? `/?${text}` : "/";
}

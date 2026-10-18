"use client";

import { createContext, useContext } from "react";

type SearchSheet = {
  /** The opener gets focus back when the sheet closes. */
  open: (opener: HTMLElement) => void;
};

export const SearchSheetContext = createContext<SearchSheet | null>(null);

export function useSearchSheet(): SearchSheet {
  const value = useContext(SearchSheetContext);
  if (!value) throw new Error("useSearchSheet needs a LibrarySearch above it.");
  return value;
}

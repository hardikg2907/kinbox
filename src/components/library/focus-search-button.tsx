"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearchSheet } from "@/components/search/search-sheet-context";

export function FocusSearchButton() {
  const sheet = useSearchSheet();
  return (
    <Button id="empty-search-button" type="button" onClick={(event) => sheet.open(event.currentTarget)}>
      <Search aria-hidden />
      Search
    </Button>
  );
}

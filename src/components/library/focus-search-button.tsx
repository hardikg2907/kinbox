"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEARCH_INPUT_ID } from "@/components/search/search-ids";

export function FocusSearchButton() {
  return (
    <Button
      id="empty-search-button"
      type="button"
      onClick={() => document.getElementById(SEARCH_INPUT_ID)?.focus()}
    >
      <Search aria-hidden />
      Search now
    </Button>
  );
}

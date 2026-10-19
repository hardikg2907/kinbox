"use client";

import { LayoutGrid, List } from "lucide-react";
import { useLayoutEffect } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { changeLayout, markWall, showTiles, useSavedLayout } from "@/components/library/wall-layout";

// The pressed look comes from the layout mark on <html> (see globals.css), which the head script
// sets before the first paint; aria-pressed follows as soon as the page is interactive.
const ROUND = "glass-strong border hover:bg-secondary";

export function LayoutToggle({ idPrefix = "layout", className }: { idPrefix?: string; className?: string }) {
  const layout = useSavedLayout("auto");
  const list = layout === "list";

  useLayoutEffect(() => {
    markWall();
  }, []);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        id={`${idPrefix}-tiles`}
        data-layout-button="tiles"
        variant="ghost"
        size="icon"
        aria-label="Tiles"
        aria-pressed={!list}
        onClick={showTiles}
        className={ROUND}
      >
        <LayoutGrid aria-hidden className="size-5" />
      </Button>
      <Button
        id={`${idPrefix}-list`}
        data-layout-button="list"
        variant="ghost"
        size="icon"
        aria-label="List"
        aria-pressed={list}
        onClick={() => changeLayout("list")}
        className={ROUND}
      >
        <List aria-hidden className="size-5" />
      </Button>
    </div>
  );
}

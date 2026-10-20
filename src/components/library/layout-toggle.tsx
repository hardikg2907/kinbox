"use client";

import { LayoutGrid, List } from "lucide-react";
import { useLayoutEffect } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { changeLayout, markWall, showTiles, useSavedLayout } from "@/components/library/wall-layout";

// One pill holds both buttons, each a full 44 px target; the pressed one shows a filled disc set in
// from the pill's edge, and the focus ring stays inside the pill. That look comes from the layout
// mark on <html> (see globals.css), which the head script sets before the first paint; aria-pressed
// follows as soon as the page is interactive.
const SEGMENT =
  "relative text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-inset focus-visible:ring-offset-0 before:absolute before:inset-[5px] before:rounded-full before:transition-colors hover:before:bg-secondary [&_svg]:relative";

export function LayoutToggle({ idPrefix = "layout", className }: { idPrefix?: string; className?: string }) {
  const layout = useSavedLayout("auto");
  const list = layout === "list";

  useLayoutEffect(() => {
    markWall();
  }, []);

  return (
    <div className={cn("glass-strong flex h-11 items-center rounded-full border", className)}>
      <Button
        id={`${idPrefix}-tiles`}
        data-layout-button="tiles"
        variant="ghost"
        size="icon"
        aria-label="Tiles"
        aria-pressed={!list}
        onClick={showTiles}
        className={SEGMENT}
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
        className={SEGMENT}
      >
        <List aria-hidden className="size-5" />
      </Button>
    </div>
  );
}

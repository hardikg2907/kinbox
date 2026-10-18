import type { LibraryCard as LibraryCardData } from "@/data/dto";
import { LibraryCard } from "@/components/library/library-card";
import { WallFrame } from "@/components/library/wall-layout";

// Skeleton wall: the default layout, since the saved one is only known once the data streams in.
export const GRID_CLASS =
  "grid grid-cols-2 gap-x-2 gap-y-5 pr-[max(0.5rem,env(safe-area-inset-right))] pb-[calc(env(safe-area-inset-bottom)+8.5rem)] pl-[max(0.5rem,env(safe-area-inset-left))] sm:grid-cols-3 md:grid-cols-4 lg:px-3 lg:pb-8 xl:grid-cols-5 2xl:grid-cols-6";

export function LibraryGrid({ cards }: { cards: LibraryCardData[] }) {
  // On the Watching tab the most recent Series takes the whole first row in every grid layout;
  // List view shows it as an ordinary row.
  const leadIndex = cards[0]?.status === "watching" ? cards.findIndex((card) => card.kind === "series") : -1;
  const lead = leadIndex >= 0 ? cards[leadIndex] : null;
  const rest = lead ? cards.filter((card) => card !== lead) : cards;

  return (
    <WallFrame
      lead={lead ? <LibraryCard key={lead.entryId} card={lead} eager lead /> : null}
      leadAsRow={lead ? <LibraryCard key={lead.entryId} card={lead} eager /> : null}
    >
      {rest.map((card, index) => (
        <LibraryCard key={card.entryId} card={card} eager={index < 4} />
      ))}
    </WallFrame>
  );
}

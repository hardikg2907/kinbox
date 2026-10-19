import type { LibraryCard as LibraryCardData } from "@/data/dto";
import { LibraryCard } from "@/components/library/library-card";
import { WallFrame } from "@/components/library/wall-layout";

// Posters on the first screen load at once. A tab switch waits briefly for them before it crossfades,
// so they arrive inside the crossfade instead of popping in after it.
const EAGER = 8;

export function LibraryGrid({ cards }: { cards: LibraryCardData[] }) {
  // On the Watching tab the most recent Series takes the lead tile in every grid layout;
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
        <LibraryCard key={card.entryId} card={card} eager={index < EAGER} />
      ))}
    </WallFrame>
  );
}

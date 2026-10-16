import type { LibraryCard as LibraryCardData } from "@/data/dto";
import { LibraryCard } from "@/components/library/library-card";

// Two columns on a phone, up to six on a wide screen. Posters keep a fixed 2:3 box, so nothing shifts as they load.
export const GRID_CLASS =
  "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

export function LibraryGrid({ cards }: { cards: LibraryCardData[] }) {
  return (
    <ul id="library-grid" className={GRID_CLASS}>
      {cards.map((card, index) => (
        <LibraryCard key={card.entryId} card={card} eager={index < 4} />
      ))}
    </ul>
  );
}

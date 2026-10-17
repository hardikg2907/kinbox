import { TonightFilters } from "@/components/library/tonight-filters";

// A picture of the filter row for choosing what to watch tonight. It is inert and hidden from
// assistive tech because nothing behind it works yet; the tag says so for everyone else.
export function TonightFiltersMock() {
  return (
    <div inert aria-hidden="true" className="relative">
      <span className="absolute -top-2.5 right-1 z-10 inline-flex h-5 items-center rounded-full border border-input bg-card px-2 text-xs font-semibold text-foreground">
        Preview
      </span>
      <TonightFilters length="Under 2 h" genre="Genre" kinds={["Movie", "Series"]} />
    </div>
  );
}

import { cn } from "cn";
import { NotOutYetLabel } from "@/components/not-out-yet-label";

// Stand-in until release dates are real data: only the example Title shows a label.
const MOCK_UPCOMING: Record<string, string> = { "Dune: Part Three": "Out 18 Dec" };

type Props = {
  name: string;
  className?: string;
};

// Hidden from assistive tech because the date is not real data yet.
export function NotOutYetMock({ name, className }: Props) {
  const text = MOCK_UPCOMING[name];
  if (text === undefined) return null;
  return (
    <span aria-hidden="true" className={cn("inline-flex max-w-full", className)}>
      <NotOutYetLabel text={text} />
    </span>
  );
}

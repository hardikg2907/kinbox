import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function EntryNotFound() {
  return (
    <div id="entry-not-found" className="mx-auto w-full max-w-[72rem] px-4 py-16 sm:px-6">
      <div className="flex max-w-md flex-col items-start gap-3">
        <h1 className="font-display text-4xl">Not in your library</h1>
        <p className="text-base text-muted-foreground">
          We couldn&apos;t find that title in your library. It may have been removed.
        </p>
        <Link href="/" className={buttonVariants({ className: "mt-2" })}>
          Go to your library
        </Link>
      </div>
    </div>
  );
}

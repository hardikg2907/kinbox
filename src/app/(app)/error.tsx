"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

// `retry` fetches the segment again, which a passing TMDB or database failure needs; `reset` would only re-render.
export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div id="app-error" role="alert" className="mx-auto w-full max-w-[72rem] py-16">
      <div className="flex max-w-md flex-col items-start gap-5">
        <h1 className="font-display text-3xl">Something went wrong on our side. Try again.</h1>
        <div className="flex flex-wrap gap-2">
          <Button id="app-error-retry" type="button" onClick={() => retry()}>
            Try again
          </Button>
          <Link id="app-error-library" href="/" className={buttonVariants({ variant: "outline" })}>
            Go to your library
          </Link>
        </div>
      </div>
    </div>
  );
}

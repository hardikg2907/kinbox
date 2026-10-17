"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import "./globals.css";

// Replaces the root layout, so it brings its own document and styles.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <title>Kinbox</title>
        <main id="global-error" role="alert" className="mx-auto flex w-full max-w-md flex-col items-start gap-5 px-4 py-16">
          <h1 className="font-display text-3xl">Something went wrong on our side. Try again.</h1>
          <div className="flex flex-wrap gap-2">
            <Button id="global-error-retry" type="button" onClick={() => retry()}>
              Try again
            </Button>
            <Link id="global-error-library" href="/" className={buttonVariants({ variant: "outline" })}>
              Go to your library
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

// The form sits at the middle of the screen, with the wordmark above it (beside it on desktop) and
// About at the foot, so neither half of the screen is left empty.
export default function SignInPage() {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-sm grid-rows-[1fr_auto_1fr] px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:max-w-4xl lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-x-20 lg:px-10">
      <header className="self-end pb-10 lg:col-start-1 lg:row-start-2 lg:self-center lg:pb-0">
        <h1 className="font-display text-7xl text-foreground">Kinbox</h1>
        <p className="mt-3 text-lg text-muted-foreground">Your movies and series, in one place.</p>
      </header>
      <div className="lg:col-start-2 lg:row-start-2">
        <SignInForm />
      </div>
      <p className="self-end pt-8 text-sm text-muted-foreground lg:col-start-1 lg:row-start-3">
        <Link
          href="/about"
          className="inline-flex min-h-11 items-center rounded-full px-1 underline underline-offset-4 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
        >
          About Kinbox
        </Link>
      </p>
    </main>
  );
}

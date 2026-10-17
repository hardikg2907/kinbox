import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 pt-[env(safe-area-inset-top)] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <h1 className="font-display text-7xl text-foreground">Kinbox</h1>
      <p className="mt-3 text-lg text-muted-foreground">Your movies and series, in one place.</p>
      <SignInForm />
      <p className="mt-8 text-sm text-muted-foreground">
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

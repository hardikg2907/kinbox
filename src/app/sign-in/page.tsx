import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 pt-[env(safe-area-inset-top)] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <h1 className="font-display text-6xl text-foreground">Kinbox</h1>
      <p className="mt-3 text-base text-muted-foreground">Your movies and series, in one place.</p>
      <SignInForm />
      <p className="mt-10 text-sm text-muted-foreground">
        <Link href="/about" className="underline underline-offset-4 hover:text-foreground">
          About Kinbox
        </Link>
      </p>
    </main>
  );
}

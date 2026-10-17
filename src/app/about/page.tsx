import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <Link
        href="/"
        className="glass-strong inline-flex border min-h-11 items-center rounded-full px-5 text-sm font-medium text-foreground hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
      >
        Back to Kinbox
      </Link>
      <h1 className="mt-10 font-display text-6xl">About Kinbox</h1>
      <p className="mt-4 max-w-prose text-lg leading-relaxed text-muted-foreground">
        Kinbox keeps the movies and series you want to watch, and the ones you have watched, in one place.
      </p>

      <section aria-labelledby="data-source" className="glass mt-10 rounded-3xl border p-6">
        <h2 id="data-source" className="text-xl font-bold">
          Movie and series data
        </h2>
        <a
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-11 items-center rounded-lg focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
        >
          {/* A plain img: the logo is a tiny static SVG and needs no optimisation. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tmdb-logo.svg" alt="The Movie Database (TMDB)" width={180} height={23} />
        </a>
        <p className="mt-5 max-w-prose text-base leading-relaxed">
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Titles, posters and episode lists come from TMDB. Posters load straight from TMDB and are never copied.
        </p>
      </section>
    </main>
  );
}

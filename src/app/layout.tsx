import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TimeZoneCookie } from "@/components/time-zone-cookie";
import { WALL_MARKS_SCRIPT } from "@/components/library/wall-marks";
import { POSTER_FADE_SCRIPT } from "@/components/poster-fade";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Kinbox", template: "%s · Kinbox" },
  description: "Your movies and series, in one place.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e7eaf0" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0c12" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The head script adds the wall marks to <html> (and marks loaded posters) before React hydrates,
    // so React keeps them.
    <html lang="en" className={figtree.variable} suppressHydrationWarning>
      <head>
        {/* Constants built from allow-lists, so no request data reaches the page as script. */}
        <script dangerouslySetInnerHTML={{ __html: WALL_MARKS_SCRIPT + ";" + POSTER_FADE_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <Toaster position="bottom-center" />
        <TimeZoneCookie />
      </body>
    </html>
  );
}

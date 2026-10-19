import { RememberOpenedTile } from "@/components/entry/opened-tile";

// `drawer` holds a Title opened from the Library: the intercepted /entry/[id] route, rendered over
// the wall. A direct link or a reload of that address renders the Title page instead.
export default function LibraryLayout({ children, drawer }: LayoutProps<"/">) {
  return (
    <>
      <main id="main" className="relative min-h-dvh lg:pl-80">
        {children}
      </main>
      {drawer}
      <RememberOpenedTile />
    </>
  );
}

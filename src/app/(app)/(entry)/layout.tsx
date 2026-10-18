export default function EntryLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="main" className="min-h-dvh">
      {children}
    </main>
  );
}

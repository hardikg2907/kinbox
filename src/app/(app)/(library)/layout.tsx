export default function LibraryLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="main" className="min-h-dvh lg:pl-80">
      {children}
    </main>
  );
}

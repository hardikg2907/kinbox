import type { Metadata } from "next";
import { Suspense } from "react";
import { ImportSkeleton } from "@/components/import/import-frame";
import { ImportScreen } from "@/components/import/import-screen";
import { requireOwner } from "@/data/session";

export const metadata: Metadata = { title: "Import a list" };

// The frame and the Paste step's words are static; the session check streams in behind them.
export default function ImportPage() {
  return (
    <Suspense fallback={<ImportSkeleton />}>
      <ImportGate />
    </Suspense>
  );
}

// The flow needs nothing from the server up front but a signed-in Owner. Every request it makes
// checks the session again on its own.
async function ImportGate() {
  await requireOwner();
  return <ImportScreen />;
}

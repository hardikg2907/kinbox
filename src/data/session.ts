import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

export type Owner = { id: string; name: string };

// One session lookup per request, however many components ask.
export const getOwner = cache(async (): Promise<Owner | null> => {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session) return null;
  return { id: session.user.id, name: session.user.name };
});

export async function requireOwner(): Promise<Owner> {
  const owner = await getOwner();
  if (!owner) redirect("/sign-in");
  return owner;
}

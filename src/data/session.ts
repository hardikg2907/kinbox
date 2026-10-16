import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

export type Owner = { id: string; name: string };

// One session lookup per request, however many components ask.
export const getOwner = cache(async (): Promise<Owner | null> => {
  // Reading the request first marks the render as dynamic before auth() needs
  // secrets, so `next build` never builds Better Auth while prerendering.
  const requestHeaders = await headers();
  const session = await auth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  return { id: session.user.id, name: session.user.name };
});

export async function requireOwner(): Promise<Owner> {
  const owner = await getOwner();
  if (!owner) redirect("/sign-in");
  return owner;
}

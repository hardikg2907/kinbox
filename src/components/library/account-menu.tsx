"use client";

import { CircleUserRound, ClipboardPaste, Info, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clearSearchCache } from "@/components/search/search-cache";
import { authClient } from "@/lib/auth-client";

export function AccountMenu({ id = "account-menu-trigger" }: { id?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      const { error } = await authClient.signOut();
      if (error) {
        toast.error("Couldn't sign out. Try again.");
        return;
      }
      clearSearchCache();
      // Replace, so Back cannot return to a screen that needs a session.
      router.replace("/sign-in");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id={id}
          variant="ghost"
          size="icon"
          aria-label="Account"
          disabled={pending}
          className="glass-strong border hover:bg-secondary"
        >
          <CircleUserRound className="size-6" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild className="min-h-11 gap-2 px-3 text-base md:min-h-10 md:text-sm">
          <Link href="/about">
            <Info aria-hidden />
            About
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-11 gap-2 px-3 text-base md:min-h-10 md:text-sm">
          <Link href="/import">
            <ClipboardPaste aria-hidden />
            Import a list
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut} className="min-h-11 gap-2 px-3 text-base md:min-h-10 md:text-sm">
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

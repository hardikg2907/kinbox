"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteEntry } from "@/actions/entries";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useEntry } from "./entry-state";

export function RemoveEntry() {
  const { entryId, name } = useEntry();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof deleteEntry>>;
      try {
        result = await deleteEntry({ entryId });
      } catch {
        result = { ok: false, error: "Couldn't remove that. Try again." };
      }
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Removed ${name}`);
      router.replace("/");
    });
  }

  return (
    <div id="entry-remove" className="flex">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            id="remove-entry-button"
            variant="ghost"
            disabled={pending}
            className="-ml-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 aria-hidden />
            Remove from library
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent id="remove-entry-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {name} from your library?</AlertDialogTitle>
            <AlertDialogDescription>
              Its watches, rating and note go too. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

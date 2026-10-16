"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusLabel, STATUS_LABEL } from "@/components/status";
import { STATUSES, type Status } from "@/domain/types";
import { useEntry } from "./entry-state";

function isStatus(value: string): value is Status {
  return STATUSES.some((status) => status === value);
}

export function StatusMenu() {
  const { model, changeStatus } = useEntry();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id="entry-status-button"
          variant="outline"
          className="justify-between gap-2 self-start"
          aria-label={`Status: ${STATUS_LABEL[model.status]}. Change status`}
        >
          <StatusLabel status={model.status} />
          <ChevronDown aria-hidden className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuRadioGroup
          value={model.status}
          onValueChange={(value) => {
            if (isStatus(value)) changeStatus(value);
          }}
        >
          {STATUSES.map((status) => (
            <DropdownMenuRadioItem key={status} value={status} className="min-h-11 text-base md:min-h-9">
              <StatusLabel status={status} className="text-base md:text-sm" />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import type { ComponentProps } from "react";
import { cn } from "cn";

// A native select: the phone's own picker is faster to use than a custom menu, and always accessible.
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full min-w-0 cursor-pointer rounded-lg border border-input bg-card px-3 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:h-9 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

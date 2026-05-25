import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Native ``<select>`` styled to match the project's `Input` primitive.
 *
 * Deliberately uses the platform `<select>` rather than @radix-ui/react-select
 * — for our few-option dropdowns (PTM presets, ligand mode) browser-native
 * keyboard nav and accessibility are sufficient and we save the bundle weight.
 * Reach for a richer component only when we need multi-select, custom item
 * rendering, or search.
 */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none",
        "appearance-none bg-[length:1rem] bg-no-repeat bg-[right_0.5rem_center] pr-8",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        "md:text-sm dark:bg-input/30",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 24 24%22 stroke=%22currentColor%22 stroke-width=%221.5%22><path stroke-linecap=%22round%22 stroke-linejoin=%22round%22 d=%22M19 9l-7 7-7-7%22/></svg>')]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { Select };

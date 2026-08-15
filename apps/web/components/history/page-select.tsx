"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";

// A dropdown that jumps straight to any page is simpler than a "1 2 … 5"
// ellipsis-style page list — no need to work out where to collapse it or how,
// no matter how many pages there are it's just a scroll inside the dropdown.
// `appearance-none` removes the native arrow, replaced with a border/hover/
// focus style matching Button's outline variant, plus our own overlaid
// ChevronDown icon — otherwise a native select looks different across
// browsers and clashes visually with the rest of the page's controls.
export function PageSelect({ current, total }: { current: number; total: number }) {
  const router = useRouter();
  const t = useTranslations("History");

  return (
    <div className="relative inline-flex items-center">
      <select
        value={current}
        onChange={(event) => router.push(`/history?page=${event.target.value}`)}
        className="h-7 appearance-none rounded-md border border-border bg-background py-0.5 pr-6 pl-2 text-xs text-foreground outline-none transition-colors hover:bg-muted active:bg-muted focus-visible:border-ring focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
      >
        {Array.from({ length: total }, (_, i) => i + 1).map((page) => (
          <option key={page} value={page}>
            {t("pageOption", { page })}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 size-3 text-muted-foreground" />
    </div>
  );
}

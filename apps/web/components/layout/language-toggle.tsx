"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

import { setLocaleAction } from "@/i18n/actions";
import type { Locale } from "@/i18n/config";

// Switches next-intl's locale cookie (see i18n/actions.ts, i18n/request.ts)
// — this drives both site UI text and what language the LLM answers in
// (components read the same useLocale()/getLocale(), see chat-panel.tsx and
// analyze-workspace.tsx). router.refresh() re-runs Server Components against
// the new cookie; setting the cookie alone doesn't trigger that on its own.
export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSelect(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border p-0.5 text-xs">
      <button
        onClick={() => handleSelect("zh")}
        disabled={isPending}
        className={
          locale === "zh"
            ? "rounded-full bg-primary px-2.5 py-1 font-medium text-primary-foreground"
            : "rounded-full px-2.5 py-1 text-muted-foreground hover:text-foreground"
        }
      >
        中
      </button>
      <button
        onClick={() => handleSelect("en")}
        disabled={isPending}
        className={
          locale === "en"
            ? "rounded-full bg-primary px-2.5 py-1 font-medium text-primary-foreground"
            : "rounded-full px-2.5 py-1 text-muted-foreground hover:text-foreground"
        }
      >
        EN
      </button>
    </div>
  );
}

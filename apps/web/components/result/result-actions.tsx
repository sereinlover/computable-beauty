"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { AnalysisResult } from "@contracts/types";

import { Button } from "@/components/ui/button";

export function ResultActions({ result, title }: { result: AnalysisResult; title: string }) {
  const t = useTranslations("Result");
  const tHistory = useTranslations("History");
  const [copied, setCopied] = useState(false);

  function handleExportJson() {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={handleExportJson}>
        {t("exportJson")}
      </Button>
      <Button variant="outline" onClick={handleCopyLink}>
        {copied ? t("copied") : t("shareLink")}
      </Button>
      <Button variant="outline" asChild>
        <Link href="/analyze">{tHistory("backToAnalyze")}</Link>
      </Button>
    </div>
  );
}

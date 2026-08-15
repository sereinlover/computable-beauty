"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CircleHelp } from "lucide-react";

import type { ChatResponse } from "@contracts/types";
import type { GatewayEnvelope } from "@/lib/gateway";
import { Button } from "@/components/ui/button";

interface Exchange {
  question: string;
  answer: string;
}

export function ChatPanel({ jobId }: { jobId: string }) {
  const locale = useLocale();
  const t = useTranslations("Chat");
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);

  async function handleSend() {
    const q = question.trim();
    if (!q || submitting) return;

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/chat/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, language: locale }),
      });
      const body: GatewayEnvelope<ChatResponse> = await res.json();
      if (body.code !== 20000 || !body.data) {
        throw new Error(body.message || t("askFailed"));
      }
      setExchanges((prev) => [...prev, { question: q, answer: body.data!.answer }]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("askFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-6">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-primary">
        <CircleHelp className="size-4" strokeWidth={1.5} />
        {t("followUp")}
      </p>

      {exchanges.length > 0 && (
        <div className="mb-4 space-y-3">
          {exchanges.map((exchange, i) => (
            <div key={i} className="space-y-1 text-sm">
              <p className="font-medium text-foreground">{exchange.question}</p>
              <p className="text-muted-foreground">{exchange.answer}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSend();
          }}
          placeholder={t("placeholder")}
          disabled={submitting}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <Button onClick={handleSend} disabled={!question.trim() || submitting}>
          {submitting ? (
            <span className="flex items-center gap-1.5">
              <CircleHelp className="size-4 animate-pulse" strokeWidth={1.5} />
              {t("thinking")}
            </span>
          ) : (
            t("send")
          )}
        </Button>
      </div>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

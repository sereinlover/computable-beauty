"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TAB_ITEMS = [
  { value: "overview", key: "overview" },
  { value: "structure", key: "structure" },
  { value: "emotion-arc", key: "emotionArc" },
  { value: "aesthetic", key: "aesthetic" },
  { value: "ai-explain", key: "aiExplain" },
] as const;

export function ResultTabs({
  overview,
  emotionArc,
  structure,
  aesthetic,
  aiExplain,
}: {
  overview: ReactNode;
  emotionArc: ReactNode;
  structure: ReactNode;
  aesthetic: ReactNode;
  aiExplain: ReactNode;
}) {
  const t = useTranslations("Tabs");

  return (
    <Tabs defaultValue="overview">
      <TabsList variant="line">
        {TAB_ITEMS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {t(tab.key)}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="overview" className="pt-6">
        {overview}
      </TabsContent>
      <TabsContent value="emotion-arc" className="pt-6">
        {emotionArc}
      </TabsContent>
      <TabsContent value="structure" className="pt-6">
        {structure}
      </TabsContent>
      <TabsContent value="aesthetic" className="pt-6">
        {aesthetic}
      </TabsContent>
      <TabsContent value="ai-explain" className="pt-6">
        {aiExplain}
      </TabsContent>
    </Tabs>
  );
}

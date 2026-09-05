"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompareMiniRadar } from "@/components/history/compare-mini-radar";
import { CompareTrajectoryChart } from "@/components/history/compare-trajectory-chart";
import type { CompareSong } from "@/components/history/compare-types";

export function AestheticCompareModal({
  songs,
  onRemove,
  onClose,
}: {
  songs: CompareSong[];
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("Compare");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[88vh] w-[min(96vw,1100px)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <Tabs defaultValue="radar" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">{t("modalTitle")}</h2>
            <div className="flex items-center gap-3">
              <TabsList variant="line">
                <TabsTrigger value="radar">{t("radarTab")}</TabsTrigger>
                <TabsTrigger value="trajectory">{t("trajectoryTab")}</TabsTrigger>
              </TabsList>
              <Button size="sm" variant="outline" onClick={onClose}>
                {t("dismiss")}
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="mb-4 flex flex-wrap gap-2">
              {songs.map((song) => (
                <span
                  key={song.id}
                  onMouseEnter={() => setHoveredId(song.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`flex items-center gap-1.5 rounded-full border py-1 pr-2 pl-3 text-sm transition-colors ${
                    hoveredId === song.id ? "border-foreground" : "border-border"
                  }`}
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: song.color }} />
                  <span className="max-w-40 truncate font-medium text-foreground">{song.title}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(song.id)}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>

            <TabsContent value="radar" className="mt-0">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
                {songs.map((song) => (
                  <CompareMiniRadar key={song.id} song={song} />
                ))}
              </div>
            </TabsContent>
            <TabsContent value="trajectory" className="mt-0">
              <CompareTrajectoryChart songs={songs} hoveredId={hoveredId} onHoverChange={setHoveredId} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

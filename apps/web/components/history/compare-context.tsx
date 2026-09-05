"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import type { CompareSong } from "@/components/history/compare-types";

const MAX_COMPARE = 20;
// Only 10 distinct CVD-checked hues exist (globals.css) — beyond that, colors
// repeat rather than introducing new ones that wouldn't have been validated
// for distinguishability. Songs 11+ share a color with an earlier song; the
// legend chips/titles (not color alone) are what actually identifies each one.
const COMPARE_COLOR_VARS = Array.from({ length: MAX_COMPARE }, (_, i) => `var(--compare-${(i % 10) + 1})`);

interface CompareContextValue {
  compareMode: boolean;
  selectedSongs: CompareSong[];
  showModal: boolean;
  limitHit: boolean;
  startCompare: () => void;
  cancelCompare: () => void;
  toggleSong: (song: Omit<CompareSong, "color">) => void;
  removeSong: (id: string) => void;
  openModal: () => void;
  closeModal: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

// Lives in app/history/layout.tsx, above page.tsx, so state survives
// pagination (?page=N only re-renders the page segment). Selecting a song
// stores its full data (not just the id) at check time — the song's page
// may no longer be in `jobs` once the user pages forward, so resolving by
// id against whatever page happens to be showing would silently break.
export function CompareProvider({ children }: { children: ReactNode }) {
  const [compareMode, setCompareMode] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState<CompareSong[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [limitHit, setLimitHit] = useState(false);

  function toggleSong(song: Omit<CompareSong, "color">) {
    setSelectedSongs((prev) => {
      if (prev.some((s) => s.id === song.id)) return prev.filter((s) => s.id !== song.id);
      if (prev.length >= MAX_COMPARE) {
        setLimitHit(true);
        setTimeout(() => setLimitHit(false), 2000);
        return prev;
      }
      // Color is assigned once, at selection time, and stays fixed even if an
      // earlier song is later removed — otherwise removing song #2 would
      // reflow everyone else's color mid-comparison.
      return [...prev, { ...song, color: COMPARE_COLOR_VARS[prev.length] }];
    });
  }

  function removeSong(id: string) {
    setSelectedSongs((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) setShowModal(false);
      return next;
    });
  }

  function cancelCompare() {
    setCompareMode(false);
    setSelectedSongs([]);
    setLimitHit(false);
  }

  return (
    <CompareContext.Provider
      value={{
        compareMode,
        selectedSongs,
        showModal,
        limitHit,
        startCompare: () => setCompareMode(true),
        cancelCompare,
        toggleSong,
        removeSong,
        openModal: () => setShowModal(true),
        closeModal: () => setShowModal(false),
      }}
    >
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used within CompareProvider");
  return ctx;
}

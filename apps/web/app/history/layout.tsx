import type { ReactNode } from "react";

import { CompareProvider } from "@/components/history/compare-context";

// One level above page.tsx so CompareProvider's state survives ?page=N
// navigation — Next.js only re-renders the page segment on searchParams
// changes, not the layout wrapping it.
export default function HistoryLayout({ children }: { children: ReactNode }) {
  return <CompareProvider>{children}</CompareProvider>;
}

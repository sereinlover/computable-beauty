import type { ToolCallRecord } from "@contracts/types";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";

// English labels matching harness/orchestrator.py's DIMENSION_LABELS["en"] —
// this tooltip is a raw technical audit view, kept separate from the
// AestheticDimension.fullLabel messages used elsewhere on the page (those
// follow the current UI language; this one is always English by design).
const DIMENSION_LABELS_EN: Record<string, string> = {
  physical_precision: "Physical Precision",
  structural_logic: "Structural Logic",
  emotional_depth: "Emotional Depth",
  vital_tension: "Vital Tension",
};

// Hover target for the "N tool calls" badge — shows the explain_dimension
// tool-call records (score + the evidence object the LLM cited, per
// harness/tools/explain_dimension/TOOL.md's input schema) backing the
// "verified" claim, following the group-hover tooltip pattern from
// HistoryItem's title tooltip.
export async function ToolCallLog({ toolCallLog }: { toolCallLog: ToolCallRecord[] }) {
  if (toolCallLog.length === 0) return null;
  const t = await getTranslations("Result");

  return (
    <span className="group/toolcall relative inline-block">
      <Badge
        variant="outline"
        className="cursor-default transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
      >
        {t("toolCallCount", { count: toolCallLog.length })}
      </Badge>
      {/* No gap (top-full, no margin) and no pointer-events-none: either would let the
          cursor land on a "dead" pixel that belongs to neither the trigger nor this box,
          which drops :hover for a frame and immediately re-triggers it — visible as the
          whole page jittering while the mouse sits still. */}
      <div className="absolute left-0 top-full z-20 hidden w-80 space-y-2 rounded-md border border-neutral-200 bg-white p-3 text-xs whitespace-normal text-neutral-900 shadow-lg group-hover/toolcall:block">
        {toolCallLog.map((call, i) => {
          const dimension = typeof call.input.dimension === "string" ? call.input.dimension : "";
          const label = DIMENSION_LABELS_EN[dimension] ?? dimension;
          const score = typeof call.input.score === "number" ? call.input.score : String(call.input.score ?? "");
          const evidence =
            call.input.evidence && typeof call.input.evidence === "object"
              ? (call.input.evidence as Record<string, unknown>)
              : {};

          return (
            <div key={i} className={i > 0 ? "border-t border-neutral-200 pt-2" : ""}>
              <p className="font-medium">
                {label} · {score} · {call.duration_ms}ms
              </p>
              <ul className="mt-0.5 text-neutral-600">
                {Object.entries(evidence).map(([field, value]) => (
                  <li key={field}>
                    {field}: {String(value)}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </span>
  );
}

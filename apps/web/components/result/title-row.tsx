import type { Job } from "@contracts/types";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { formatAnalysisDuration, formatDuration } from "@/lib/format";

export async function TitleRow({ job }: { job: Job }) {
  if (!job.result) return null;
  const t = await getTranslations("Result");

  return (
    <div>
      <h1 className="text-3xl font-semibold text-foreground">{job.title}</h1>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-muted-foreground">
          {t("artist")} {job.artist || t("unknownArtist")}
        </Badge>
        <Badge variant="outline" className="text-muted-foreground">
          {t("duration")} {formatDuration(job.result.feature_summary.duration_sec)}
        </Badge>
        <Badge variant="outline" className="text-muted-foreground">
          {t("analysisDuration")} {formatAnalysisDuration(job.analysis_duration_sec)}s
        </Badge>
      </div>
    </div>
  );
}

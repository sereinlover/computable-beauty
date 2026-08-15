import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getTranslations } from "next-intl/server";

import { Navbar, MainNavLinks } from "@/components/layout/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TitleRow } from "@/components/result/title-row";
import { ResultTabs } from "@/components/result/result-tabs";
import { ResultActions } from "@/components/result/result-actions";
import { OverviewCards } from "@/components/result/overview-cards";
import { EmotionArcChart } from "@/components/result/emotion-arc-chart";
import { StructureSection } from "@/components/result/structure-section";
import { EmotionDimensions } from "@/components/result/emotion-dimensions";
import { AestheticDimensions } from "@/components/result/aesthetic-dimensions";
import { ChordList } from "@/components/result/chord-list";
import { AestheticDetail } from "@/components/result/aesthetic-detail";
import { EmotionDetail } from "@/components/result/emotion-detail";
import { ChatPanel } from "@/components/result/chat-panel";
import { ToolCallLog } from "@/components/result/tool-call-log";
import { ProcessingView } from "@/components/result/processing-view";
import { getTonicChord } from "@/lib/format";
import { fetchJob } from "@/lib/gateway";

export default async function ResultPage(props: PageProps<"/result/[id]">) {
  const { id } = await props.params;
  const job = await fetchJob(id);
  if (!job) notFound();

  if (job.status !== "done") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar right={<MainNavLinks active="/analyze" />} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
          <ProcessingView job={job} />
        </main>
      </div>
    );
  }

  if (!job.result) return null;
  const t = await getTranslations("Result");
  const {
    feature_summary,
    understanding,
    aesthetic,
    summary,
    explanation,
    explanation_skipped,
    tool_call_log,
    verified,
  } = job.result;
  const tonicChord = getTonicChord(feature_summary.key);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar right={<ResultActions result={job.result} title={job.title ?? "analysis"} />} />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-10">
        <TitleRow job={job} />

        <ResultTabs
          overview={
            <div className="space-y-6">
              <OverviewCards featureSummary={feature_summary} understanding={understanding} />
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <Card className="h-full">
                  <CardContent>
                    <StructureSection
                      structure={understanding.structure}
                      chords={understanding.chords}
                      durationSec={feature_summary.duration_sec}
                      tonicChord={tonicChord}
                    />
                  </CardContent>
                </Card>
                <Card className="h-full">
                  <CardContent>
                    <EmotionDimensions understanding={understanding} />
                  </CardContent>
                </Card>
                <Card className="h-full">
                  <CardContent>
                    <AestheticDimensions aesthetic={aesthetic} />
                  </CardContent>
                </Card>
              </div>
            </div>
          }
          emotionArc={
            <div className="space-y-8">
              <EmotionArcChart data={understanding.emotion_arc} />
              <EmotionDetail understanding={understanding} />
            </div>
          }
          structure={
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <StructureSection
                structure={understanding.structure}
                durationSec={feature_summary.duration_sec}
                variant="full"
              />
              <ChordList chords={understanding.chords} tonicChord={tonicChord} />
            </div>
          }
          aesthetic={<AestheticDetail aesthetic={aesthetic} />}
          aiExplain={
            explanation_skipped ? (
              <p className="text-sm text-muted-foreground">{t("aiNotConfigured")}</p>
            ) : (
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-primary">✦ {t("aiInterpretation")}</span>
                  <span className="text-muted-foreground">·</span>
                  <ToolCallLog toolCallLog={tool_call_log} />
                  {verified && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <Badge
                        variant="outline"
                        className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      >
                        ✓ {t("verified")}
                      </Badge>
                    </>
                  )}
                </div>

                <p className="font-medium text-foreground">{summary}</p>

                <div className="mt-4 space-y-3 text-sm leading-relaxed text-foreground [&_strong]:font-semibold">
                  <ReactMarkdown>{explanation}</ReactMarkdown>
                </div>

                <ChatPanel jobId={job.id} />
              </div>
            )
          }
        />
      </main>
    </div>
  );
}

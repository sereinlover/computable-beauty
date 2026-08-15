import { Navbar } from "@/components/layout/navbar";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { AnalyzeWorkspace } from "@/components/analyze/analyze-workspace";
import { fetchJobs, fetchActiveJobs } from "@/lib/gateway";

export default async function AnalyzePage() {
  // This page only shows the most recent 3; the full list is on /history
  const [{ items }, activeJobs] = await Promise.all([fetchJobs(3), fetchActiveJobs()]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar right={<LanguageToggle />} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <AnalyzeWorkspace initialRecentJobs={items} initialActiveJobs={activeJobs} />
      </main>
    </div>
  );
}

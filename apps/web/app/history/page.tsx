import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { HistoryComparePanel } from "@/components/history/history-compare-panel";
import { PageSelect } from "@/components/history/page-select";
import { fetchJobs } from "@/lib/gateway";

const PAGE_SIZE = 10;

export default async function HistoryPage(props: PageProps<"/history">) {
  const searchParams = await props.searchParams;
  const pageParam = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const page = Math.max(1, Number(pageParam) || 1);

  const { items, total } = await fetchJobs(PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const t = await getTranslations("History");
  const tRecent = await getTranslations("Recent");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar
        right={
          <Button variant="outline" asChild>
            <Link href="/analyze">{t("backToAnalyze")}</Link>
          </Button>
        }
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <HistoryComparePanel jobs={items} title={tRecent("historyTitle", { total })} />

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3 text-sm">
            <PageLink page={1} disabled={page <= 1}>
              {t("firstPage")}
            </PageLink>
            <PageSelect current={page} total={totalPages} />
            <PageLink page={totalPages} disabled={page >= totalPages}>
              {t("lastPage")}
            </PageLink>
          </div>
        )}
      </main>
    </div>
  );
}

function PageLink({ page, disabled, children }: { page: number; disabled: boolean; children: string }) {
  if (disabled) {
    return <span className="px-2 py-1 text-muted-foreground/40">{children}</span>;
  }
  return (
    <Link href={`/history?page=${page}`} className="rounded-md px-2.5 py-1 text-foreground hover:bg-muted">
      {children}
    </Link>
  );
}

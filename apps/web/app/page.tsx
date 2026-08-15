import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Navbar } from "@/components/layout/navbar";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { Button } from "@/components/ui/button";
import { AESTHETIC_DIMENSION_ORDER } from "@/lib/dimension-colors";

export default async function LandingPage() {
  const t = await getTranslations("LandingPage");
  const tDimension = await getTranslations("AestheticDimension");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar right={<LanguageToggle />} />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          <span className="text-primary">{t("heading1")}</span>
          <span className="text-foreground">{t("heading2")}</span>
        </h1>

        <div className="mt-5 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p className="text-balance">{t("intro1")}</p>
          <p className="text-balance">{t("intro2")}</p>
        </div>

        <Button asChild size="lg" className="group mt-6 rounded-full px-8 shadow-md hover:shadow-lg">
          <Link href="/analyze">
            {t("cta")}
            <ArrowRight className="transition-transform group-hover:translate-x-1" />
          </Link>
        </Button>

        <div className="mt-10 w-full text-left">
          <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground/50">{t("frameworkLabel")}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {AESTHETIC_DIMENSION_ORDER.map((key) => (
              <div key={key} className="rounded-xl bg-muted/50 p-4">
                <p className="text-sm font-medium text-foreground">{tDimension(`${key}.fullLabel`)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{tDimension(`${key}.description`)}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

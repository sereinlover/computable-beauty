import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

export function Logo() {
  return (
    <Link href="/" className="text-lg font-semibold tracking-tight">
      <span className="text-foreground">Computable</span>
      <span className="text-primary">Beauty</span>
    </Link>
  );
}

export function Navbar({ right }: { right: ReactNode }) {
  return (
    <header className="w-full border-b border-border">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Logo />
        {right}
      </div>
    </header>
  );
}

const MAIN_NAV_ITEMS = [
  { href: "/analyze", key: "analyze" },
  { href: "/history", key: "history" },
] as const;

// No default value: the landing page (`/`) isn't in MAIN_NAV_ITEMS, so when a
// caller doesn't pass `active`, nothing gets highlighted.
export async function MainNavLinks({ active }: { active?: string }) {
  const t = await getTranslations("Nav");
  return (
    <nav className="flex items-center gap-1 text-sm">
      {MAIN_NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={
            item.href === active
              ? "rounded-md bg-muted px-3 py-1.5 font-medium text-foreground"
              : "rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
          }
        >
          {t(item.key)}
        </Link>
      ))}
    </nav>
  );
}

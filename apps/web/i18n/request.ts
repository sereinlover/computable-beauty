import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

import { defaultLocale, LOCALE_COOKIE, locales, type Locale } from "@/i18n/config";

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;

  let locale: Locale;
  if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
    locale = cookieLocale as Locale;
  } else {
    // No cookie yet (first visit) — fall back to the browser's own
    // preference via Accept-Language instead of always defaulting, same
    // direction lib/language.ts's old navigator.language check used.
    const acceptLanguage = (await headers()).get("accept-language") ?? "";
    locale = acceptLanguage.toLowerCase().startsWith("zh") ? "zh" : defaultLocale;
  }

  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});

export const locales = ["zh", "en"] as const;
export type Locale = (typeof locales)[number];

// "en" unless the visitor's browser clearly prefers Chinese.
export const defaultLocale: Locale = "en";

export const LOCALE_COOKIE = "locale";

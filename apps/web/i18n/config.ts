export const locales = ["zh", "en"] as const;
export type Locale = (typeof locales)[number];

// Matches the direction lib/language.ts's old client-only detection used:
// "en" unless the visitor's browser clearly prefers Chinese.
export const defaultLocale: Locale = "en";

export const LOCALE_COOKIE = "locale";

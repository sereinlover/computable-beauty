"use server";

import { cookies } from "next/headers";

import { LOCALE_COOKIE, type Locale } from "@/i18n/config";

export async function setLocaleAction(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale);
}

// U-71, U-73: every user-visible string comes from en.json (and ja.json from M-06).
// S-03: the locale switch and browser-language default arrive in M-06; the
// `ja` slot exists so that milestone only adds the catalog and the switch.
import en from "./en.json";
import { flatten } from "./flatten";

type Messages = typeof en;

type Leaves<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;
export type Locale = "en" | "ja";
export type Params = Record<string, string | number>;

export const LOCALES = ["en", "ja"] as const satisfies readonly Locale[];

// `import.meta.env` exists under Vite and Vitest only; scripts run with tsx (P-09).
// oxlint-disable-next-line typescript/no-unnecessary-type-conversion -- undefined under tsx
const DEV = Boolean(import.meta.env?.DEV);

const catalogs: Record<Locale, Record<string, string>> = { en: flatten(en), ja: {} };
let current: Locale = "en";

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

export function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}

export function t(key: MessageKey, params?: Params): string {
  const text = catalogs[current][key] ?? catalogs.en[key];
  if (text === undefined) {
    if (DEV) console.warn(`i18n: unknown key "${key}"`);
    return key;
  }
  return interpolate(text, params);
}

/** U-70: the message of a diagnostic or runtime error. */
export function errorText(error: { code: string; params: Params }): string {
  return t(`error.${error.code}` as MessageKey, error.params);
}

/** A challenge-file text (C-01 `Localized`) in the current locale, falling back to `en`. */
export function localized(text: { en: string; ja?: string }): string {
  return text[current] ?? text.en;
}

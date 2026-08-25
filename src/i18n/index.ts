import { es } from "./dictionaries/es.ts";
import { en } from "./dictionaries/en.ts";
import { pt } from "./dictionaries/pt.ts";
import { loadLocale, saveLocale } from "../state/Persistence.ts";

export type Locale = "es" | "en" | "pt";
export const LOCALES: Locale[] = ["es", "en", "pt"];

// Every leaf in es.ts is a string literal (from `as const`); en/pt need the
// same nested shape but their own string content — this widens just the
// leaves back to `string` so en.ts/pt.ts can satisfy it while still getting
// a compile error for any missing, extra, or mis-typed key.
type DeepString<T> = T extends string ? string : { [K in keyof T]: DeepString<T[K]> };
export type Dictionary = DeepString<typeof es>;

const DICTS: Record<Locale, Dictionary> = { es, en, pt };

function detectLocale(): Locale {
  const lang = (typeof navigator !== "undefined" ? navigator.language : "es").toLowerCase();
  if (lang.startsWith("pt")) return "pt";
  if (lang.startsWith("en")) return "en";
  return "es";
}

let currentLocale: Locale = loadLocale() ?? detectLocale();

export function getLocale(): Locale {
  return currentLocale;
}

// Callers that need existing scene text to update should follow this with
// `this.scene.restart()` — Phaser text objects are baked at draw time, not
// reactive, so nothing redraws on its own.
export function setLocale(locale: Locale): void {
  currentLocale = locale;
  saveLocale(locale);
}

export function strings(): Dictionary {
  return DICTS[currentLocale];
}

// `{name}` placeholders only — matches the small set of dynamic values
// actually used across the dictionaries (level numbers, scores, player
// names). Falls back to leaving `{key}` in place if a param is missing,
// which is easier to spot in QA than a silently blank value.
export function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

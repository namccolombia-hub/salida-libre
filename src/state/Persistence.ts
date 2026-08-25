const MAX_LEVEL_KEY = "salida-libre:maxLevel";
const HINTS_ENABLED_KEY = "salida-libre:hintsEnabled";
const SEEN_TUTORIALS_KEY = "salida-libre:seenTutorials";
const MUSIC_ENABLED_KEY = "salida-libre:musicEnabled";
const SFX_ENABLED_KEY = "salida-libre:sfxEnabled";
const LOCALE_KEY = "salida-libre:locale";

export function loadMaxLevel(): number {
  try {
    const raw = localStorage.getItem(MAX_LEVEL_KEY);
    const n = raw ? parseInt(raw, 10) : 1;
    return Number.isFinite(n) && n >= 1 ? n : 1;
  } catch {
    return 1;
  }
}

export function saveMaxLevel(level: number): void {
  try {
    localStorage.setItem(MAX_LEVEL_KEY, String(level));
  } catch {
    // localStorage unavailable (private browsing, etc.) — progress just won't persist.
  }
}

export function loadHintsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(HINTS_ENABLED_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

export function saveHintsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(HINTS_ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    // localStorage unavailable — the toggle just won't persist across sessions.
  }
}

export function loadSeenTutorials(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_TUTORIALS_KEY);
    return new Set(raw ? raw.split(",").filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

export function saveSeenTutorial(id: string): void {
  try {
    const seen = loadSeenTutorials();
    seen.add(id);
    localStorage.setItem(SEEN_TUTORIALS_KEY, [...seen].join(","));
  } catch {
    // localStorage unavailable — the tutorial will just show again next time.
  }
}

export function loadMusicEnabled(): boolean {
  try {
    const raw = localStorage.getItem(MUSIC_ENABLED_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

export function saveMusicEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(MUSIC_ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    // localStorage unavailable — the toggle just won't persist across sessions.
  }
}

// Not "Locale" from src/i18n/index.ts — importing it here would create a
// circular dependency (i18n imports this module to read the saved
// preference). The union is duplicated instead; TS catches any drift since
// setLocale() in i18n/index.ts requires its own Locale type to be assignable
// to this one when calling saveLocale().
export function loadLocale(): "es" | "en" | "pt" | null {
  try {
    const raw = localStorage.getItem(LOCALE_KEY);
    return raw === "es" || raw === "en" || raw === "pt" ? raw : null;
  } catch {
    return null;
  }
}

export function saveLocale(locale: "es" | "en" | "pt"): void {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // localStorage unavailable — the choice just won't persist across sessions.
  }
}

export function loadSfxEnabled(): boolean {
  try {
    const raw = localStorage.getItem(SFX_ENABLED_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

export function saveSfxEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SFX_ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    // localStorage unavailable — the toggle just won't persist across sessions.
  }
}

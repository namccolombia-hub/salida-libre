import type { Dictionary } from "../i18n/index.ts";

// Title/identify/resolve text now lives in the i18n dictionaries
// (strings().tutorial[id]) so it translates with everything else — only the
// icon is invariant across languages, so it stays here.
export type TutorialId = keyof Dictionary["tutorial"];

export const TUTORIAL_ICONS: Record<TutorialId, string> = {
  movement: "🚗",
  chase: "🏎️",
  floors: "🏢",
  broken: "🔧",
  obstacles: "🚧",
  edgeClosures: "🚦",
  ambientTraffic: "🚗💨",
  timer: "⏱",
  vip: "👑",
  shortcut: "⚡",
  curvedRoad: "🌀",
  fogRain: "🌫",
  crossLaneSwitch: "↔",
};

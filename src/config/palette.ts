export const Palette = {
  bgAsphalt: 0x1c1f26,
  bgAsphaltLight: 0x262a33,
  laneGold: 0xf4c542,
  wallSolid: 0x3a3f4b,
  danger: 0xff4757,
  player: 0x4fd1ff,
  textLight: "#f4f4f4",
  textGold: "#f4c542",
  textDanger: "#ff4757",
  // Rounded, friendly display face for titles/HUD/big numbers — loaded via
  // Google Fonts in index.html, with BootScene waiting for it to be ready
  // before any scene draws text. Falls back to the old system bold stack.
  displayFont: '"Baloo 2", Arial Black, Arial',
  // Body/UI text face — same rounded family as the display font but built
  // for reading at small sizes, replacing the old plain Arial. Also loaded
  // and awaited in BootScene. `bodyFontBold` pairs with fontStyle "700".
  bodyFont: '"Nunito", Arial, sans-serif',
  bodyFontBold: '"Nunito", "Arial Black", Arial, sans-serif',
} as const;

// Car sprite art ships as these 5 pre-colored variants (recolored from a
// single reference image), so the puzzle's car color pool maps to sprite
// keys instead of runtime tinting.
export const CAR_COLOR_KEYS = ["black", "blue", "green", "red", "yellow"] as const;
export type CarColorKey = (typeof CAR_COLOR_KEYS)[number];
export const CarColorHex: Record<CarColorKey, number> = {
  black: 0x2b2f38,
  blue: 0x4fd1ff,
  green: 0x51cf66,
  red: 0xff6b6b,
  yellow: 0xffb454,
};

// Landmark buildings dotted along the level-select road — real generated
// art (not emoji), each shipping its own baked-in card frame, so
// LevelSelectScene just places the image without drawing a frame of its
// own. Texture key is `landmark-${key}`, source file `public/assets/
// landmarks/${key}.png`. Display labels live in the i18n dictionaries
// (strings().landmarks) — landmarkLabelKey below maps each kebab-case key
// here to its camelCase property over there.
export const LANDMARKS = [
  { key: "parking-lot" },
  { key: "mall" },
  { key: "casino" },
  { key: "gas-station" },
  { key: "supermarket" },
  { key: "hospital" },
  { key: "police-station" },
  { key: "park" },
  { key: "fast-food" },
  { key: "car-wash" },
] as const;
export const LANDMARK_KEYS = LANDMARKS.map((l) => l.key);
export type LandmarkKey = (typeof LANDMARK_KEYS)[number];

export const landmarkLabelKey: Record<LandmarkKey, "parkingLot" | "mall" | "casino" | "gasStation" | "supermarket" | "hospital" | "policeStation" | "park" | "fastFood" | "carWash"> = {
  "parking-lot": "parkingLot",
  mall: "mall",
  casino: "casino",
  "gas-station": "gasStation",
  supermarket: "supermarket",
  hospital: "hospital",
  "police-station": "policeStation",
  park: "park",
  "fast-food": "fastFood",
  "car-wash": "carWash",
};

// Same cycling LevelSelectScene uses to place landmark markers (every 4
// levels, wrapping every 10 landmarks) — reused here so ParkingScene can
// theme a level's background to match the "zone" it visually belongs to
// on the road. Levels 1-4 are the generic parking-lot zone, 5-8 are mall,
// 9-12 casino, etc.
export function landmarkForLevel(level: number): (typeof LANDMARKS)[number] {
  const zoneIndex = Math.floor((level - 1) / 4) % LANDMARKS.length;
  return LANDMARKS[zoneIndex];
}

// Boot/menu backdrop gradients — bright and light by day (better contrast
// against the colorful car silhouettes), warm and dark by night, matching
// the day/night split already used in-game (ParkingScene/ChaseScene check
// the same real-world hour range). One is picked at random per app launch
// (not per menu visit) so it's consistent for the whole session instead of
// flickering between visits.
const DAY_THEMES: { top: number; bottom: number }[] = [
  { top: 0x8ecdff, bottom: 0xfff2d6 }, // clear sky
  { top: 0xffe08a, bottom: 0xffc9a3 }, // morning sun
  { top: 0x9df0d8, bottom: 0xfff4d6 }, // mint morning
  { top: 0xffc2a8, bottom: 0xffe6c2 }, // soft coral
  { top: 0xc9d6ff, bottom: 0xfff0e0 }, // periwinkle dawn
];

const NIGHT_THEMES: { top: number; bottom: number }[] = [
  { top: 0xd9480f, bottom: 0x3d0f08 }, // ember
  { top: 0xe8590c, bottom: 0x4a0e1f }, // coral dusk
  { top: 0xd97706, bottom: 0x431407 }, // golden hour
  { top: 0xc2410c, bottom: 0x450a0a }, // cherry
  { top: 0xb45309, bottom: 0x422006 }, // terracotta
  { top: 0xbe123c, bottom: 0x3f0d12 }, // rosewood
];

const bootHour = new Date().getHours();
export const isNightTheme = bootHour >= 19 || bootHour < 5;
const themePool = isNightTheme ? NIGHT_THEMES : DAY_THEMES;
export const startTheme = themePool[Math.floor(Math.random() * themePool.length)];

export const GameConfig = {
  width: 480,
  height: 800,

  cellSize: 48,

  // Chase mode is never a random dice roll anymore — it's triggered by a
  // failed launch (a "mistake" chase) or by this small fixed fraction of
  // cars flagged at spawn to guarantee chase mode still shows up even on a
  // mistake-free playthrough (see LevelState.replenishFloor).
  forcesChaseChance: 0.05,
  chaseMinDuration: 28000,
  chaseMaxDuration: 32000,
  chaseMaxHits: 2,

  livesMax: 3,

  chaseSuccessBonus: 3,
  parkingExitScore: 1,
  levelClearBonus: 10,
} as const;

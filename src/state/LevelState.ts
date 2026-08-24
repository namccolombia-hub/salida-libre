import Phaser from "phaser";
import { CAR_COLOR_KEYS, CarColorHex, GameConfig } from "../config/palette.ts";
import type { CarColorKey } from "../config/palette.ts";
import { loadMaxLevel, saveMaxLevel } from "./Persistence.ts";

export type Orientation = "h" | "v";
export type Direction = 1 | -1;
export type CarLength = 2 | 3;

export interface CarInstance {
  id: number;
  row: number;
  col: number;
  length: CarLength;
  orientation: Orientation;
  dir: Direction;
  colorKey: CarColorKey;
  color: number;
  inChase: boolean;
  // Which parking level this car lives on. Almost every level is
  // single-floor (floor 0 only); floor 1 only exists when LevelState.floors === 2.
  floor: 0 | 1;
  // Broken cars can't be tapped/launched until partsHave reaches partsNeeded —
  // parts are collected in ChaseScene during a "delivery" run.
  broken: boolean;
  partsNeeded: number;
  partsHave: number;
  // VIP cars pay a score bonus if launched within vipTapsLeft other exits —
  // otherwise they just quietly stop being VIP, no penalty.
  vip: boolean;
  vipTapsLeft: number;
  // A small fixed fraction of cars are flagged at spawn to trigger chase
  // mode even on a correct, clear-path launch — guarantees chase mode (and
  // a chance to deliver repair parts) shows up in every level, not just
  // when the player makes a mistake.
  forcesChase: boolean;
}

export interface Cell {
  row: number;
  col: number;
}

interface LevelDimensions {
  cols: number;
  rows: number;
  visibleCap: number;
  totalQuota: number;
  floors: 1 | 2;
  brokenCount: number;
  decorativeCount: number;
  edgeClosures: boolean;
  ambientTraffic: boolean;
  hasTimer: boolean;
  vipEnabled: boolean;
  shortcutTollEnabled: boolean;
  curvedRoad: boolean;
  fogOrRain: boolean;
  crossLaneSwitch: boolean;
}

// The hand-authored dimensions only cover shape/quota — every modifier flag
// is filled in uniformly by computeLevelDimensions (see below).
type FixedDimensions = Pick<LevelDimensions, "cols" | "rows" | "visibleCap" | "totalQuota">;

// Hand-authored difficulty curve for the first 10 levels: easy start, a hard
// spike every 5th level, and a slightly harder baseline after each spike.
// Levels beyond this list keep growing/varying procedurally from level 10's
// baseline (see computeLevelDimensions / computeChaseSpeedMult below).
const FIXED_LEVELS: FixedDimensions[] = [
  { cols: 6, rows: 7, visibleCap: 8, totalQuota: 16 },
  { cols: 7, rows: 7, visibleCap: 9, totalQuota: 20 },
  { cols: 6, rows: 9, visibleCap: 10, totalQuota: 24 },
  { cols: 8, rows: 7, visibleCap: 11, totalQuota: 28 },
  { cols: 9, rows: 10, visibleCap: 14, totalQuota: 42 }, // level 5: difficulty spike
  { cols: 7, rows: 8, visibleCap: 10, totalQuota: 30 },
  { cols: 8, rows: 8, visibleCap: 11, totalQuota: 34 },
  { cols: 7, rows: 10, visibleCap: 12, totalQuota: 38 },
  { cols: 9, rows: 8, visibleCap: 13, totalQuota: 42 },
  { cols: 10, rows: 11, visibleCap: 16, totalQuota: 55 }, // level 10: bigger spike than level 5
];

const FIXED_CHASE_MULT = [1.0, 1.0, 1.05, 1.05, 1.35, 1.1, 1.1, 1.15, 1.15, 1.45];

// New difficulty mechanics only start after the hand-tuned levels 1-10, so
// that already-validated curve stays untouched. Onset levels and periods are
// staggered on purpose so different levels combine 1-3 modifiers at a time
// instead of everything landing on the same levels (or none at all).
export function hasSecondFloor(level: number): boolean {
  return level >= 11 && (level - 11) % 4 === 0; // 11, 15, 19, ...
}

export function brokenCarCount(level: number): number {
  if (level < 11) return 0;
  return Math.min(3, 1 + Math.floor((level - 11) / 5)); // 1 at level 11, grows slowly
}

export function decorativeObstacleCount(level: number): number {
  if (level < 13) return 0;
  return Math.min(3, 1 + Math.floor((level - 13) / 6));
}

export function hasEdgeClosures(level: number): boolean {
  return level >= 14 && (level - 14) % 3 === 0; // 14, 17, 20, 23...
}

export function hasAmbientTraffic(level: number): boolean {
  return level >= 16 && (level - 16) % 3 === 0; // 16, 19, 22, 25...
}

export function hasLevelTimer(level: number): boolean {
  return level >= 17 && (level - 17) % 5 === 0; // 17, 22, 27...
}

export function hasVipCar(level: number): boolean {
  return level >= 12 && (level - 12) % 3 === 0; // 12, 15, 18, 21...
}

export function hasShortcutToll(level: number): boolean {
  return level >= 18 && (level - 18) % 4 === 0; // 18, 22, 26...
}

export function hasCurvedRoad(level: number): boolean {
  return level >= 13 && (level - 13) % 3 === 0; // 13, 16, 19, 22...
}

export function hasFogOrRain(level: number): boolean {
  return level >= 14 && (level - 14) % 3 === 0; // 14, 17, 20, 23...
}

export function hasCrossLaneSwitch(level: number): boolean {
  return level >= 15 && (level - 15) % 3 === 0; // 15, 18, 21, 24...
}

/** Short icon strings for every active modifier on a level — used by the
 * level-picker screens (design-review and real) to show what to expect. */
export function difficultyBadges(level: number): string[] {
  const badges: string[] = [];
  if (hasSecondFloor(level)) badges.push("🏢2");
  if (brokenCarCount(level) > 0) badges.push("🔧");
  if (decorativeObstacleCount(level) > 0) badges.push("🚧");
  if (hasEdgeClosures(level)) badges.push("🚦");
  if (hasAmbientTraffic(level)) badges.push("🚗💨");
  if (hasLevelTimer(level)) badges.push("⏱");
  if (hasVipCar(level)) badges.push("👑");
  if (hasShortcutToll(level)) badges.push("⚡");
  if (hasCurvedRoad(level)) badges.push("🌀");
  if (hasFogOrRain(level)) badges.push("🌫");
  if (hasCrossLaneSwitch(level)) badges.push("↔");
  return badges;
}

function computeLevelDimensions(level: number): LevelDimensions {
  const modifiers = {
    floors: hasSecondFloor(level) ? (2 as const) : (1 as const),
    brokenCount: brokenCarCount(level),
    decorativeCount: decorativeObstacleCount(level),
    edgeClosures: hasEdgeClosures(level),
    ambientTraffic: hasAmbientTraffic(level),
    hasTimer: hasLevelTimer(level),
    vipEnabled: hasVipCar(level),
    shortcutTollEnabled: hasShortcutToll(level),
    curvedRoad: hasCurvedRoad(level),
    fogOrRain: hasFogOrRain(level),
    crossLaneSwitch: hasCrossLaneSwitch(level),
  };

  const fixed = FIXED_LEVELS[level - 1];
  if (fixed) {
    return {
      ...fixed,
      floors: 1,
      brokenCount: 0,
      decorativeCount: 0,
      edgeClosures: false,
      ambientTraffic: false,
      hasTimer: false,
      vipEnabled: false,
      shortcutTollEnabled: false,
      curvedRoad: false,
      fogOrRain: false,
      crossLaneSwitch: false,
    };
  }

  // Beyond the hand-authored levels, keep growing/varying shape from level
  // 10's baseline at the same pace, so there's no sudden jump at the seam.
  const last = FIXED_LEVELS[FIXED_LEVELS.length - 1];
  const stepsBeyond = level - FIXED_LEVELS.length;
  const totalExtra = Math.round(stepsBeyond * 1.8);
  const colBias = Phaser.Math.FloatBetween(0.3, 0.7);
  const extraCols = Math.round(totalExtra * colBias);
  const extraRows = totalExtra - extraCols;

  const cols = Math.min(14, last.cols + extraCols);
  const rows = Math.min(18, last.rows + extraRows);

  const area = cols * rows;
  // Larger procedural grids used to cap at 20 visible cars regardless of
  // area, which made big boards feel empty — the cap now scales with size.
  const visibleCap = Phaser.Math.Clamp(Math.round(area * 0.3), 6, 40);
  const totalQuota = visibleCap + 8 + (level - 1) * 10;
  return { cols, rows, visibleCap, totalQuota, ...modifiers };
}

// How much faster (chase-scene obstacle approach speed) this level's chase
// segments feel, following the same easy-start / spike-every-5th pattern.
function computeChaseSpeedMult(level: number): number {
  const fixed = FIXED_CHASE_MULT[level - 1];
  if (fixed !== undefined) return fixed;
  const last = FIXED_CHASE_MULT[FIXED_CHASE_MULT.length - 1];
  const stepsBeyond = level - FIXED_CHASE_MULT.length;
  return Math.min(2.2, last + stepsBeyond * 0.03);
}

export class LevelStateManager {
  level = 1;
  cols = 6;
  rows = 7;
  visibleCap = 6;
  totalQuota = 14;
  chaseSpeedMult: number = FIXED_CHASE_MULT[0];
  spawnedCount = 0;
  clearedCount = 0;
  cars: CarInstance[] = [];
  maxLevelUnlocked: number = loadMaxLevel();
  private nextId = 1;

  // --- Second floor ---
  floors: 1 | 2 = 1;
  floor2Cars: CarInstance[] = [];
  activeFloor: 0 | 1 = 0;

  // --- Broken cars / repair parts ---
  partsNeededTotal = 0;
  partsDelivered = 0;
  private brokenBudgetRemaining = 0;

  // --- Decorative obstacles (permanent, floor 1 only) ---
  obstacleCells: Cell[] = [];

  // --- Temporal/ambient modifiers (flags consumed by ParkingScene/ChaseScene) ---
  edgeClosures = false;
  ambientTraffic = false;
  hasTimer = false;
  timeLimitMs = 0;
  vipEnabled = false;
  shortcutTollEnabled = false;
  curvedRoad = false;
  fogOrRain = false;
  crossLaneSwitch = false;

  get activeCars(): CarInstance[] {
    return this.activeFloor === 0 ? this.cars : this.floor2Cars;
  }

  toggleFloor(): void {
    if (this.floors !== 2) return;
    this.activeFloor = this.activeFloor === 0 ? 1 : 0;
  }

  startLevel(level: number): void {
    this.level = level;
    const dims = computeLevelDimensions(level);
    this.cols = dims.cols;
    this.rows = dims.rows;
    this.visibleCap = dims.visibleCap;
    this.totalQuota = dims.totalQuota;
    this.floors = dims.floors;
    this.chaseSpeedMult = computeChaseSpeedMult(level);
    this.spawnedCount = 0;
    this.clearedCount = 0;
    this.cars = [];
    this.floor2Cars = [];
    this.activeFloor = 0;
    this.partsNeededTotal = 0;
    this.partsDelivered = 0;
    this.brokenBudgetRemaining = dims.brokenCount;

    this.edgeClosures = dims.edgeClosures;
    this.ambientTraffic = dims.ambientTraffic;
    this.hasTimer = dims.hasTimer;
    // A window of roughly 1.6s per visible car, clamped to a sane range —
    // not scaled to the whole level's quota (that would be minutes long).
    this.timeLimitMs = dims.hasTimer ? Phaser.Math.Clamp(Math.round(dims.visibleCap * 1600), 20000, 40000) : 0;
    this.vipEnabled = dims.vipEnabled;
    this.shortcutTollEnabled = dims.shortcutTollEnabled;
    this.curvedRoad = dims.curvedRoad;
    this.fogOrRain = dims.fogOrRain;
    this.crossLaneSwitch = dims.crossLaneSwitch;

    this.obstacleCells = [];
    for (let i = 0; i < dims.decorativeCount; i++) {
      const cell = this.pickEmptyObstacleCell();
      if (cell) this.obstacleCells.push(cell);
    }

    this.replenish();
  }

  /** Starts a brand-new run (fresh car-id counter) at the given level. */
  startNewRun(level: number): void {
    this.nextId = 1;
    this.startLevel(level);
  }

  /** Called when a level's quota is fully cleared — permanently unlocks the next one. */
  unlockUpTo(level: number): void {
    if (level > this.maxLevelUnlocked) {
      this.maxLevelUnlocked = level;
      saveMaxLevel(level);
    }
  }

  isLevelComplete(): boolean {
    return this.cars.length === 0 && this.floor2Cars.length === 0 && this.spawnedCount >= this.totalQuota;
  }

  footprint(car: CarInstance): Cell[] {
    const cells: Cell[] = [];
    for (let i = 0; i < car.length; i++) {
      if (car.orientation === "h") cells.push({ row: car.row, col: car.col + i });
      else cells.push({ row: car.row + i, col: car.col });
    }
    return cells;
  }

  // Floor 1 additionally carries the level's permanent decorative obstacles
  // (see obstacleCells) — floor 2 never has them, keeping that side simpler.
  private occupiedGrid(cars: CarInstance[], floor: 0 | 1): boolean[][] {
    const grid: boolean[][] = Array.from({ length: this.rows }, () => Array(this.cols).fill(false) as boolean[]);
    for (const car of cars) {
      for (const cell of this.footprint(car)) {
        grid[cell.row][cell.col] = true;
      }
    }
    if (floor === 0) {
      for (const cell of this.obstacleCells) {
        grid[cell.row][cell.col] = true;
      }
    }
    return grid;
  }

  private pickEmptyObstacleCell(): Cell | null {
    for (let attempts = 0; attempts < 200; attempts++) {
      const row = Phaser.Math.Between(0, this.rows - 1);
      const col = Phaser.Math.Between(0, this.cols - 1);
      if (this.obstacleCells.some((c) => c.row === row && c.col === col)) continue;
      return { row, col };
    }
    return null;
  }

  private canPlace(car: CarInstance, cars: CarInstance[], floor: 0 | 1): boolean {
    for (const cell of this.footprint(car)) {
      if (cell.row < 0 || cell.row >= this.rows || cell.col < 0 || cell.col >= this.cols) return false;
    }
    const grid = this.occupiedGrid(cars, floor);
    for (const cell of this.footprint(car)) {
      if (grid[cell.row][cell.col]) return false;
    }
    return true;
  }

  // Walks from the car's leading edge toward the boundary, counting empty
  // cells until either the edge of the grid (clear=true) or another car/
  // obstacle (clear=false) is reached. `distance` is how many empty cells
  // lie ahead — used both for the pass/fail check and to animate a bump
  // that actually travels up to whatever is blocking it, instead of a fixed
  // tiny nudge.
  private travelInfo(car: CarInstance, grid: boolean[][]): { distance: number; clear: boolean } {
    const cells = this.footprint(car);
    let distance = 0;

    if (car.orientation === "h") {
      const edgeCol = car.dir === 1 ? Math.max(...cells.map((c) => c.col)) : Math.min(...cells.map((c) => c.col));
      for (let c = edgeCol + car.dir; c >= 0 && c < this.cols; c += car.dir) {
        if (grid[car.row][c]) return { distance, clear: false };
        distance++;
      }
      return { distance, clear: true };
    }

    const edgeRow = car.dir === 1 ? Math.max(...cells.map((c) => c.row)) : Math.min(...cells.map((c) => c.row));
    for (let r = edgeRow + car.dir; r >= 0 && r < this.rows; r += car.dir) {
      if (grid[r][car.col]) return { distance, clear: false };
      distance++;
    }
    return { distance, clear: true };
  }

  private pathClearOnGrid(car: CarInstance, grid: boolean[][]): boolean {
    return this.travelInfo(car, grid).clear;
  }

  // Where a car lands on floor 1 after clearing floor 2 through this edge:
  // the mirrored edge cell (same row for horizontal cars, same column for
  // vertical), so "where it left floor 2 is where it arrives on floor 1".
  private landingCell(car: CarInstance): Cell {
    if (car.orientation === "h") {
      return { row: car.row, col: car.dir === 1 ? this.cols - car.length : 0 };
    }
    return { row: car.dir === 1 ? this.rows - car.length : 0, col: car.col };
  }

  /**
   * Repeatedly (a) removes any non-broken floor-1 car with a currently-clear
   * path, and (b) moves any non-broken floor-2 car with a clear path onto
   * floor 1 at the mirrored landing cell, if that cell is currently free.
   * Broken cars can't be tapped at all, so each real floor-1 removal also
   * feeds a "part" into a pool that gets applied (oldest-broken-first, same
   * order as deliverPart()) at the end of every pass — a broken car only
   * becomes removable once enough of those hypothetical parts have funded
   * it. Only floor-1 removals fund the pool: a floor-2→floor-1 transfer
   * never triggers chase mode in ParkingScene (only a real floor-1 exit
   * does), so it must not count as a delivery opportunity here either — a
   * transferred car only starts funding repairs once it's later tapped for
   * real from floor 1, exactly like any other floor-1 car. This mirrors the
   * real constraint that repairing anything requires first launching a
   * non-broken car off floor 1. Since freeing a cell (or funding a repair)
   * can never block another car, only ever help, the order doesn't matter:
   * if some sequence of taps/transfers/deliveries can empty both floors,
   * this greedy simulation finds one — and critically, if pass 1 can't make
   * any progress, no accepted state ever starts with every car
   * blocked-or-broken (which would be a real, un-recoverable dead end).
   * Decorative obstacles (obstacleCells) are baked into occupiedGrid for
   * floor 1, so they're automatically respected here with no extra code.
   */
  private isSolvable(floor1: CarInstance[], floor2: CarInstance[]): boolean {
    // Clone — this pass hypothetically "repairs" broken cars, and must never
    // mutate the real objects.
    let remaining1 = floor1.map((c) => ({ ...c }));
    let remaining2 = floor2.map((c) => ({ ...c }));
    let partsPool = 0;
    let changed = true;

    while (changed && (remaining1.length > 0 || remaining2.length > 0)) {
      changed = false;

      const grid1 = this.occupiedGrid(remaining1, 0);
      const stillBlocked1: CarInstance[] = [];
      for (const car of remaining1) {
        if (!car.broken && this.pathClearOnGrid(car, grid1)) {
          changed = true;
          partsPool++;
        } else {
          stillBlocked1.push(car);
        }
      }
      remaining1 = stillBlocked1;

      const grid2 = this.occupiedGrid(remaining2, 1);
      const stillBlocked2: CarInstance[] = [];
      for (const car of remaining2) {
        if (car.broken || !this.pathClearOnGrid(car, grid2)) {
          stillBlocked2.push(car);
          continue;
        }
        const landing = this.landingCell(car);
        const landingCar: CarInstance = { ...car, row: landing.row, col: landing.col, floor: 0 };
        if (this.canPlace(landingCar, remaining1, 0)) {
          // The transfer itself doesn't fund the parts pool — see the note
          // above the pool logic below.
          remaining1 = [...remaining1, landingCar];
          changed = true;
        } else {
          stillBlocked2.push(car);
        }
      }
      remaining2 = stillBlocked2;

      if (partsPool > 0) {
        const brokenSorted = [...remaining1, ...remaining2].filter((c) => c.broken).sort((a, b) => a.id - b.id);
        for (const car of brokenSorted) {
          while (partsPool > 0 && car.partsHave < car.partsNeeded) {
            car.partsHave++;
            partsPool--;
          }
          if (car.partsHave >= car.partsNeeded) {
            car.broken = false;
            changed = true;
          }
        }
      }
    }

    return remaining1.length === 0 && remaining2.length === 0;
  }

  private carsForFloor(floor: 0 | 1): CarInstance[] {
    return floor === 0 ? this.cars : this.floor2Cars;
  }

  private replenishFloor(floor: 0 | 1, cap: number): void {
    const list = this.carsForFloor(floor);
    let attempts = 0;
    while (list.length < cap && this.spawnedCount < this.totalQuota && attempts < 500) {
      attempts++;
      const length = (Math.random() < 0.6 ? 2 : 3) as CarLength;
      const orientation: Orientation = Math.random() < 0.5 ? "h" : "v";
      const dir = (Math.random() < 0.5 ? 1 : -1) as Direction;

      const row = orientation === "h" ? Phaser.Math.Between(0, this.rows - 1) : Phaser.Math.Between(0, this.rows - length);
      const col = orientation === "h" ? Phaser.Math.Between(0, this.cols - length) : Phaser.Math.Between(0, this.cols - 1);

      const colorKey = CAR_COLOR_KEYS[Phaser.Math.Between(0, CAR_COLOR_KEYS.length - 1)];
      const makeBroken = this.brokenBudgetRemaining > 0 && Math.random() < 0.4;
      const partsNeeded = makeBroken ? Phaser.Math.Between(1, 2) : 0;

      const alreadyHasVip = this.cars.some((c) => c.vip) || this.floor2Cars.some((c) => c.vip);
      const makeVip = this.vipEnabled && floor === 0 && !makeBroken && !alreadyHasVip && Math.random() < 0.15;
      // Floor 1 only, and never on a broken or VIP car — keeps each car's
      // "special" status unambiguous instead of stacking badges.
      const makeForcesChase = floor === 0 && !makeBroken && !makeVip && Math.random() < GameConfig.forcesChaseChance;

      const candidate: CarInstance = {
        id: this.nextId,
        row,
        col,
        length,
        orientation,
        dir,
        colorKey,
        color: CarColorHex[colorKey],
        inChase: false,
        floor,
        broken: makeBroken,
        partsNeeded,
        partsHave: 0,
        vip: makeVip,
        vipTapsLeft: makeVip ? 3 : 0,
        forcesChase: makeForcesChase,
      };

      if (!this.canPlace(candidate, list, floor)) continue;
      const solvableFloor1 = floor === 0 ? [...this.cars, candidate] : this.cars;
      const solvableFloor2 = floor === 1 ? [...this.floor2Cars, candidate] : this.floor2Cars;
      if (!this.isSolvable(solvableFloor1, solvableFloor2)) continue;

      list.push(candidate);
      this.nextId++;
      this.spawnedCount++;
      if (makeBroken) {
        this.brokenBudgetRemaining--;
        this.partsNeededTotal += partsNeeded;
      }
    }
  }

  replenish(): void {
    this.replenishFloor(0, this.visibleCap);
    if (this.floors === 2) {
      const floor2Cap = Math.max(2, Math.round(this.visibleCap * 0.35));
      this.replenishFloor(1, floor2Cap);
    }
  }

  pathClear(car: CarInstance): boolean {
    return this.pathClearOnGrid(car, this.occupiedGrid(this.carsForFloor(car.floor), car.floor));
  }

  /** How many empty cells lie ahead of the car before it's blocked (0 = already touching). */
  blockingDistance(car: CarInstance): number {
    return this.travelInfo(car, this.occupiedGrid(this.carsForFloor(car.floor), car.floor)).distance;
  }

  /**
   * Attempts to move a floor-2 car (already confirmed to have a clear path
   * to some edge via pathClear) down to floor 1. The mirrored edge cell
   * must be free for it to come down at all — but landing right there and
   * immediately being one more tap from a real exit made the whole floor-2
   * detour pointless, so once it's confirmed it can come down, it's
   * reshuffled to a random valid spot elsewhere on floor 1 (same
   * orientation/length/direction, same `relocateCar` guard as everywhere
   * else) instead of staying parked at the entry point. Returns the new
   * floor-1 car on success, or null if the entry cell is occupied — the
   * caller should treat that like a blocked launch.
   */
  tryTransferToFloor1(car: CarInstance): CarInstance | null {
    // Defensive — a broken car should never be launched/transferred no
    // matter what code path reaches here (the UI already blocks it earlier).
    if (car.broken) return null;
    const landing = this.landingCell(car);
    const candidate: CarInstance = { ...car, row: landing.row, col: landing.col, floor: 0 };
    if (!this.canPlace(candidate, this.cars, 0)) return null;
    this.floor2Cars = this.floor2Cars.filter((c) => c.id !== car.id);
    this.cars.push(candidate);
    this.relocateCar(candidate);
    return candidate;
  }

  removeCar(id: number): void {
    this.cars = this.cars.filter((c) => c.id !== id);
    this.floor2Cars = this.floor2Cars.filter((c) => c.id !== id);
  }

  getCar(id: number): CarInstance | undefined {
    return this.cars.find((c) => c.id === id) ?? this.floor2Cars.find((c) => c.id === id);
  }

  /**
   * Assigns one collected repair part to the oldest still-broken car that
   * still needs one. Returns that car if this delivery fully repairs it
   * (so the caller can refresh its sprite/interactivity), otherwise null.
   */
  deliverPart(): CarInstance | null {
    const candidates = [...this.cars, ...this.floor2Cars]
      .filter((c) => c.broken && c.partsHave < c.partsNeeded)
      .sort((a, b) => a.id - b.id);
    const target = candidates[0];
    if (!target) return null;

    target.partsHave++;
    this.partsDelivered++;
    if (target.partsHave >= target.partsNeeded) {
      target.broken = false;
      return target;
    }
    return null;
  }

  /**
   * True once the remaining launch opportunities in the level (totalQuota -
   * clearedCount) are down to roughly the number of parts still needed —
   * from here on, ParkingScene should force chase mode on every clear exit
   * instead of gambling on the normal probability, so the level never runs
   * out of chances to deliver the parts it needs to be completable.
   */
  shouldForceDeliveryChase(): boolean {
    if (this.partsDelivered >= this.partsNeededTotal) return false;
    const remainingOpportunities = this.totalQuota - this.clearedCount;
    const partsStillNeeded = this.partsNeededTotal - this.partsDelivered;
    return remainingOpportunities <= partsStillNeeded + 1;
  }

  /**
   * Ambient traffic (idea #3): nudges one random non-broken floor-1 car one
   * cell further along its own direction, if the destination is free and
   * the result stays solvable — reuses the exact same monotonic guard as
   * replenish(), so this can never create a deadlock either. Floor 2 never
   * drifts, keeping that side simpler. Returns the moved car so the scene
   * can animate it, or null if nothing could move this time.
   */
  driftTraffic(): { car: CarInstance } | null {
    const candidates = this.cars.filter((c) => !c.broken);
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    for (const car of shuffled) {
      const nextRow = car.row + (car.orientation === "v" ? car.dir : 0);
      const nextCol = car.col + (car.orientation === "h" ? car.dir : 0);
      const moved: CarInstance = { ...car, row: nextRow, col: nextCol };
      const others = this.cars.filter((c) => c.id !== car.id);
      if (!this.canPlace(moved, others, 0)) continue;
      if (!this.isSolvable([...others, moved], this.floor2Cars)) continue;

      car.row = nextRow;
      car.col = nextCol;
      return { car };
    }
    return null;
  }

  /**
   * Mistake-chase win: moves a car already on the board to a different
   * valid position on the same floor, same orientation/direction/length —
   * used when the player wins a chase that was triggered by a blocked
   * launch, so the car survives without costing a life but doesn't just
   * exit for free either. Same canPlace + isSolvable guard as every other
   * board mutation; if no valid spot turns up in the attempts available (a
   * very dense board), the car just stays put — that still counts as
   * "safe", it never costs a life either way.
   */
  relocateCar(car: CarInstance): boolean {
    const others = this.carsForFloor(car.floor).filter((c) => c.id !== car.id);
    for (let attempts = 0; attempts < 200; attempts++) {
      const row =
        car.orientation === "h" ? Phaser.Math.Between(0, this.rows - 1) : Phaser.Math.Between(0, this.rows - car.length);
      const col =
        car.orientation === "h" ? Phaser.Math.Between(0, this.cols - car.length) : Phaser.Math.Between(0, this.cols - 1);
      if (row === car.row && col === car.col) continue;

      const moved: CarInstance = { ...car, row, col };
      if (!this.canPlace(moved, others, car.floor)) continue;
      const floor1Check = car.floor === 0 ? [...others, moved] : this.cars;
      const floor2Check = car.floor === 1 ? [...others, moved] : this.floor2Cars;
      if (!this.isSolvable(floor1Check, floor2Check)) continue;

      car.row = row;
      car.col = col;
      return true;
    }
    return false;
  }

  /**
   * VIP countdown (idea #7): called after any OTHER car successfully exits
   * floor 1 for real. If a VIP car is currently active, its remaining
   * window ticks down; hitting 0 just quietly clears the flag (no penalty —
   * it becomes an ordinary car, only the bonus opportunity is lost).
   */
  tickVip(): void {
    const vipCar = this.cars.find((c) => c.vip) ?? this.floor2Cars.find((c) => c.vip);
    if (!vipCar) return;
    vipCar.vipTapsLeft--;
    if (vipCar.vipTapsLeft <= 0) vipCar.vip = false;
  }

  /**
   * Paid shortcut (idea #8): removes up to 3 randomly-chosen currently-
   * blocked, non-broken floor-1 cars, as if they'd exited normally. Costs a
   * life — the caller is responsible for that (see ParkingScene) so it can
   * bail out if that life was the last one instead of also granting the
   * shortcut. Removing cars can only ever help solvability, so no guard
   * is needed here (same monotonicity argument as everywhere else).
   */
  useShortcut(): CarInstance[] {
    const blocked = this.cars.filter((c) => !c.broken && !this.pathClear(c));
    const picked = [...blocked].sort(() => Math.random() - 0.5).slice(0, 3);
    for (const car of picked) {
      this.removeCar(car.id);
    }
    return picked;
  }
}

export const LevelState = new LevelStateManager();

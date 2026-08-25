import Phaser from "phaser";
import { CAR_COLOR_KEYS, GameConfig, Palette, isNightTheme, LANDMARKS, landmarkLabelKey } from "../config/palette.ts";
import { RunState } from "../state/RunState.ts";
import { LevelState, difficultyBadges } from "../state/LevelState.ts";
import { goTo, fadeIn } from "../fx/sceneTransition.ts";
import { drawVerticalGradient } from "../fx/gradient.ts";
import { strings } from "../i18n/index.ts";

// Bright, light city by day (better contrast against the car nodes); the
// same cool dark city from before, by night — matching the day/night split
// already used in-game (ParkingScene/ChaseScene).
const CITY_THEME_DAY = { top: 0x8ecdff, bottom: 0xdff1ff };
const CITY_THEME_NIGHT = { top: 0x241b3d, bottom: 0x0d0a17 };
const CITY_THEME = isNightTheme ? CITY_THEME_NIGHT : CITY_THEME_DAY;

// Road + skyline tones flip with the same day/night split.
const ROAD_SHOULDER = isNightTheme ? 0x140f1f : 0x4a4f5c;
const ROAD_SURFACE = isNightTheme ? 0x5c5670 : 0x9aa0a8;
const BUILDING_FILL = isNightTheme ? 0x1a1430 : 0xc7d3de;
const BUILDING_WINDOW = isNightTheme ? 0xffd98a : 0x4a5568;
const INK_COLOR = isNightTheme ? Palette.textLight : "#1c1f26";

type Positioned = Phaser.GameObjects.Image | Phaser.GameObjects.Text | Phaser.GameObjects.Graphics | Phaser.GameObjects.Arc;

export class LevelSelectScene extends Phaser.Scene {
  private readonly pathTop = 110;
  private readonly pathBottom = 780;
  private readonly centerX = GameConfig.width / 2;
  private readonly amplitude = 70;
  private readonly freq = (2 * Math.PI) / 6; // one full left-right cycle every 6 levels
  private readonly spacing = 112;
  private readonly nodeHeight = 46;

  private total = 0;
  private container!: Phaser.GameObjects.Container;
  private roadGraphics!: Phaser.GameObjects.Graphics;
  private dragging = false;
  private dragMoved = false;
  private dragStartY = 0;
  private containerStartY = 0;
  private minY = 0;

  constructor() {
    super("LevelSelectScene");
  }

  create(): void {
    fadeIn(this);
    this.dragging = false;
    this.dragMoved = false;

    drawVerticalGradient(this, GameConfig.width, GameConfig.height, CITY_THEME.top, CITY_THEME.bottom, -2);

    const back = this.add
      .text(20, 24, strings().levelSelect.back, {
        fontFamily: Palette.displayFont,
        fontSize: "16px",
        color: INK_COLOR,
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(10);
    back.on("pointerup", () => goTo(this, "MenuScene"));

    this.add
      .text(GameConfig.width / 2, 24, strings().levelSelect.title, {
        fontFamily: Palette.displayFont,
        fontSize: "20px",
        color: Palette.textGold,
      })
      .setOrigin(0.5, 0)
      .setDepth(10);

    this.buildRoad();
  }

  // Level 1 sits at the bottom of the road; higher levels climb toward the
  // top (y decreases as n grows) — so the freshest progress is what's on
  // screen when the scene opens, with no scroll needed.
  private pathPoint(n: number): { x: number; y: number } {
    return {
      x: this.centerX + this.amplitude * Math.sin(n * this.freq),
      y: this.pathTop + (this.total - n) * this.spacing,
    };
  }

  private buildRoad(): void {
    this.total = LevelState.maxLevelUnlocked;
    const total = this.total;
    this.container = this.add.container(0, 0);

    this.drawSkyline(total);
    this.drawRoadSurface(total);

    for (let n = 1; n <= total; n++) {
      this.addLevelNode(n, n === total);
      if (n % 4 === 0 && n < total) this.addLandmark(n);
    }

    const contentHeight = this.spacing * (total - 1) + 160;
    const visibleHeight = this.pathBottom - this.pathTop;
    this.minY = Math.min(0, visibleHeight - contentHeight);
    this.updateVisibility();

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.y < this.pathTop) return;
      this.dragging = true;
      this.dragMoved = false;
      this.dragStartY = p.y;
      this.containerStartY = this.container.y;
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      const delta = p.y - this.dragStartY;
      if (Math.abs(delta) > 8) this.dragMoved = true;
      this.container.y = Phaser.Math.Clamp(this.containerStartY + delta, this.minY, 0);
      this.updateVisibility();
    });
    this.input.on("pointerup", () => {
      this.dragging = false;
    });
    this.input.on("pointerupoutside", () => {
      this.dragging = false;
    });
  }

  // A handful of low-alpha building silhouettes scattered along the full
  // scroll range, hugging the screen edges outside the road/landmarks —
  // just enough to read as "city" without needing any building art.
  private drawSkyline(total: number): void {
    const contentHeight = this.spacing * Math.max(total - 1, 1) + 200;
    const buildingCount = Math.max(10, Math.round(contentHeight / 140));
    for (let i = 0; i < buildingCount; i++) {
      const onLeft = i % 2 === 0;
      const w = Phaser.Math.Between(34, 60);
      const h = Phaser.Math.Between(70, 170);
      const x = onLeft ? Phaser.Math.Between(4, 40) : GameConfig.width - Phaser.Math.Between(4, 40) - w;
      const y = Phaser.Math.FloatBetween(0, contentHeight);

      const g = this.add.graphics().setPosition(x, y).setDepth(-1).setAlpha(0.28);
      g.fillStyle(BUILDING_FILL, 1);
      g.fillRect(0, 0, w, h);
      g.fillStyle(BUILDING_WINDOW, 0.5);
      for (let wy = 8; wy < h - 8; wy += 16) {
        for (let wx = 6; wx < w - 8; wx += 14) {
          if ((wx + wy) % 3 !== 0) g.fillRect(wx, wy, 5, 6);
        }
      }
      this.container.add(g);
    }
  }

  private drawRoadSurface(total: number): void {
    if (total < 1) return;
    const substeps = 8;
    const points: { x: number; y: number }[] = [this.pathPoint(1)];
    for (let n = 1; n < total; n++) {
      for (let s = 1; s <= substeps; s++) points.push(this.pathPoint(n + s / substeps));
    }

    const road = this.add.graphics().setDepth(0);

    // Stamped overlapping circles instead of a stroked polyline — a fat
    // "tube" following the curve, built entirely from fillCircle (which
    // renders reliably here, unlike multi-segment strokePath in this
    // Phaser build). Darker shoulder first, lighter surface on top.
    road.fillStyle(ROAD_SHOULDER, 1);
    for (const p of points) road.fillCircle(p.x, p.y, 18);

    road.fillStyle(ROAD_SURFACE, 1);
    for (const p of points) road.fillCircle(p.x, p.y, 14);

    road.fillStyle(Palette.laneGold, 0.6);
    for (let i = 0; i < points.length; i += 6) road.fillCircle(points[i].x, points[i].y, 2.5);

    this.roadGraphics = road;
    this.container.add(road);
  }

  private addLevelNode(n: number, isLatest: boolean): void {
    const { x, y } = this.pathPoint(n);
    const items: Positioned[] = [];

    const colorKey = CAR_COLOR_KEYS[(n - 1) % CAR_COLOR_KEYS.length];
    const car = this.add.image(x, y, `vehicle-car-${colorKey}`).setDepth(2);
    car.setDisplaySize(car.width * (this.nodeHeight / car.height), this.nodeHeight);
    // Same night-contrast fix as the in-game grid: black cars are nearly
    // invisible against a dark background unless lightened.
    if (isNightTheme && colorKey === "black") car.setTint(0x9aa4b2);
    items.push(car);

    const badgeY = y - this.nodeHeight / 2 - 18;
    const badge = this.add.graphics().setPosition(x, badgeY).setDepth(3);
    const radius = 16;
    badge.fillStyle(0x14121a, 0.92);
    badge.fillCircle(0, 0, radius);
    badge.lineStyle(2, isLatest ? Palette.laneGold : Palette.wallSolid, 1);
    badge.strokeCircle(0, 0, radius);
    items.push(badge);

    const numberText = this.add
      .text(x, badgeY, `${n}`, {
        fontFamily: Palette.displayFont,
        fontSize: "15px",
        color: isLatest ? Palette.textGold : "#f4f4f4",
      })
      .setOrigin(0.5)
      .setDepth(4);
    items.push(numberText);

    const badgeParts = difficultyBadges(n);
    if (badgeParts.length > 0) {
      const diffText = this.add
        .text(x, y + this.nodeHeight / 2 + 12, badgeParts.join(""), {
          fontFamily: Palette.bodyFont,
          fontSize: "10px",
          color: INK_COLOR,
          wordWrap: { width: 100 },
          align: "center",
        })
        .setOrigin(0.5)
        .setDepth(4);
      items.push(diffText);
    }

    const hitZone = this.add
      .circle(x, y - 8, 34, 0x000000, 0)
      .setDepth(5)
      .setInteractive({ useHandCursor: true });
    hitZone.on("pointerup", () => {
      if (this.dragMoved) return;
      RunState.reset();
      LevelState.startNewRun(n);
      goTo(this, "ParkingScene");
    });
    items.push(hitZone);

    this.container.add(items);
  }

  private addLandmark(afterLevel: number): void {
    const a = this.pathPoint(afterLevel);
    const b = this.pathPoint(afterLevel + 1);
    const y = (a.y + b.y) / 2;
    const landmarkIndex = afterLevel / 4 - 1;
    const onLeft = landmarkIndex % 2 === 0;
    const x = onLeft ? 64 : GameConfig.width - 64;
    const spot = LANDMARKS[landmarkIndex % LANDMARKS.length];

    const items: Positioned[] = [];

    // The generated art already ships its own card frame/background, so no
    // Graphics plate is drawn here — just place it.
    const icon = this.add.image(x, y - 6, `landmark-${spot.key}`).setDepth(1);
    icon.setDisplaySize(84, 84);
    items.push(icon);

    const label = this.add
      .text(x, y + 40, strings().landmarks[landmarkLabelKey[spot.key]], {
        fontFamily: Palette.bodyFont,
        fontSize: "9px",
        color: INK_COLOR,
        align: "center",
        wordWrap: { width: 90 },
      })
      .setOrigin(0.5)
      .setDepth(1);
    items.push(label);

    this.container.add(items);
  }

  // Toggling visibility per-item instead of using a geometry mask on the
  // scrolling container (Phaser's container masks didn't clip reliably here).
  private updateVisibility(): void {
    const buffer = 80;
    for (const child of this.container.list) {
      // The road is one big Graphics object drawn at absolute coordinates
      // (not via .setPosition), so its own .y stays 0 regardless of scroll
      // — it can't be culled by the same per-node position check below.
      if (child === this.roadGraphics) continue;
      const obj = child as Positioned;
      const worldY = obj.y + this.container.y;
      obj.setVisible(worldY > this.pathTop - buffer && worldY < this.pathBottom + buffer);
    }
  }
}

import Phaser from "phaser";
import { CAR_COLOR_KEYS, GameConfig, Palette } from "../config/palette.ts";
import { playCrash, playPickup, playExit, playLoseLife } from "../audio/sfx.ts";
import { play as playMusic } from "../audio/music.ts";
import { RunState } from "../state/RunState.ts";
import { LevelState } from "../state/LevelState.ts";
import { burst, confetti, showFloatingText } from "../fx/effects.ts";
import { hapticImpact, hapticSuccess, hapticError } from "../fx/haptics.ts";
import { goTo, fadeIn } from "../fx/sceneTransition.ts";
import { showTutorialQueue } from "../ui/TutorialOverlay.ts";

type ObstacleKind = "car" | "bus" | "pedestrian" | "cone" | "pet" | "part";
type LaneIndex = 0 | 1 | 2;

const KIND_BASE_SCALE: Record<ObstacleKind, number> = {
  car: 0.24,
  bus: 0.27,
  pedestrian: 0.34,
  cone: 0.22,
  pet: 0.3,
  part: 0.5,
};

const PART_ICON_KEY = "repair-part-icon";

interface ChaseData {
  carId: number;
  // True when this run should guarantee a repair-part pickup, because some
  // broken car back in the parking lot is still waiting on one.
  isDeliveryChase?: boolean;
  // True when this chase was triggered by a failed launch (blocked path,
  // closed edge, or a full landing cell coming down from floor 2) instead
  // of a correct one — changes what winning/losing actually does, see
  // resolveChase().
  mistake?: boolean;
}

interface Obstacle {
  sprite: Phaser.GameObjects.Image;
  kind: ObstacleKind;
  // The TRUE lane used for hit-testing — starts equal to firstLaneIndex, and
  // flips once (to secondSwitchLaneIndex) only once that second crossing's
  // visual move has actually finished, so hit-testing always matches what's
  // on screen.
  laneIndex: LaneIndex;
  z: number;
  approachRate: number;
  wobbleAmp: number;
  wobbleSpeed: number;
  seed: number;
  resolved: boolean;
  baseScale: number;
  // Pedestrians/pets enter from off-road and walk to their landing lane
  // (firstLaneIndex) instead of already standing in it — crossStartLaneX is
  // where they start, crossFinishZ is the z at which that walk completes.
  crossing: boolean;
  crossStartLaneX: number;
  crossFinishZ: number;
  firstLaneIndex: LaneIndex;
  // Some crossing obstacles do a second lane change partway through instead
  // of just settling — same easing pattern as the first crossing, staged
  // after it, well before collisionZ so hit-testing is never ambiguous.
  secondSwitch: boolean;
  secondSwitchLaneIndex: LaneIndex | null;
  secondSwitchFinishZ: number;
  secondSwitchApplied: boolean;
}

interface Projected {
  x: number;
  y: number;
  scale: number;
}

export class ChaseScene extends Phaser.Scene {
  private carId = 0;

  private hits = 0;
  private duration = 30000;
  private elapsed = 0;
  private spawnTimer = 0;
  private readonly spawnIntervalStart = 750;
  private readonly spawnIntervalEnd = 300;
  private resolved = false;
  private tutorialActive = false;

  private pointerDown = false;
  private playerLaneIndex: LaneIndex = 1;
  private playerLaneX = 0;

  private obstacles: Obstacle[] = [];
  private readonly maxConcurrent = 2;

  private isDeliveryChase = false;
  private mistake = false;
  private partSpawned = false;
  private deliveryHudText?: Phaser.GameObjects.Text;
  private mistakeHudText?: Phaser.GameObjects.Text;

  // Fixed 3-lane positions in road space (-1..1). Both the player and every
  // obstacle always sit exactly on one of these, so "am I in the way" is a
  // simple index comparison instead of a fuzzy distance check.
  private readonly lanePositions: [number, number, number] = [-0.6, 0, 0.6];

  // Pseudo-3D projection constants (screen-space road driven from the car's viewpoint).
  private readonly horizonY = 250;
  private readonly bottomY = GameConfig.height - 150;
  private readonly centerX = GameConfig.width / 2;
  private readonly minHalfWidth = 100;
  private readonly maxHalfWidth = 230;
  private readonly minScale = 0.45;
  private readonly maxScale = 1.6;
  private readonly collisionZ = 0.1;

  private roadGraphics!: Phaser.GameObjects.Graphics;
  private wheelContainer!: Phaser.GameObjects.Container;
  private timeBar!: Phaser.GameObjects.Graphics;
  private hitDots: Phaser.GameObjects.Arc[] = [];
  private weatherGraphics?: Phaser.GameObjects.Graphics;
  private parallaxGraphics!: Phaser.GameObjects.Graphics;
  private stars: { x: number; y: number; r: number; phase: number }[] = [];
  private clouds: { x: number; y: number; w: number; h: number; speed: number }[] = [];

  // Real device clock decides the scene's look: night (7pm-5am) keeps the
  // original dark, headlit mood; daytime swaps in a blue sky, sun, colorful
  // buildings and gray asphalt. Re-read on every entry (not just once at
  // construction) so a session spanning the 5am/7pm boundary stays current.
  private isNight = true;
  private roadColor: number = Palette.bgAsphaltLight;

  constructor() {
    super("ChaseScene");
  }

  init(data: ChaseData): void {
    this.carId = data.carId;
    this.hits = 0;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.resolved = false;
    this.tutorialActive = false;
    this.pointerDown = false;
    this.playerLaneIndex = 1;
    this.playerLaneX = this.lanePositions[1];
    this.obstacles = [];
    this.duration = Phaser.Math.Between(GameConfig.chaseMinDuration, GameConfig.chaseMaxDuration);
    this.isDeliveryChase = data.isDeliveryChase ?? false;
    this.mistake = data.mistake ?? false;
    this.partSpawned = false;
  }

  create(): void {
    const hour = new Date().getHours();
    this.isNight = hour >= 19 || hour < 5;
    this.roadColor = this.isNight ? Palette.bgAsphaltLight : 0x8a8f96;

    this.cameras.main.setBackgroundColor(Palette.bgAsphalt);
    fadeIn(this);
    playMusic("chase");
    this.buildSky();
    this.buildParallax();
    this.ensurePartTexture();

    this.roadGraphics = this.add.graphics();
    if (this.isNight) this.buildHeadlights();
    this.buildWeatherOverlay();
    this.buildVignette();

    this.buildDashboard();
    this.buildHud();

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.pointerDown = true;
      this.playerLaneIndex = this.laneIndexFromScreen(p.x);
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.pointerDown) this.playerLaneIndex = this.laneIndexFromScreen(p.x);
    });
    this.input.on("pointerup", () => {
      this.pointerDown = false;
    });
    this.input.on("pointerupoutside", () => {
      this.pointerDown = false;
    });

    this.tutorialActive = true;
    showTutorialQueue(this, this.pendingTutorialIds(), () => {
      this.tutorialActive = false;
    });
  }

  private pendingTutorialIds(): string[] {
    const ids: string[] = ["chase"];
    if (LevelState.curvedRoad) ids.push("curvedRoad");
    if (LevelState.fogOrRain) ids.push("fogRain");
    if (LevelState.crossLaneSwitch) ids.push("crossLaneSwitch");
    return ids;
  }

  private laneIndexFromScreen(screenX: number): LaneIndex {
    const raw = Phaser.Math.Clamp((screenX - this.centerX) / this.maxHalfWidth, -1, 1);
    let best: LaneIndex = 0;
    let bestDist = Infinity;
    this.lanePositions.forEach((lx, i) => {
      const d = Math.abs(lx - raw);
      if (d < bestDist) {
        bestDist = d;
        best = i as LaneIndex;
      }
    });
    return best;
  }

  // Idea #5: a slow sine sway applied to everything (road, dividers,
  // obstacles) alike since they all go through this one projection — the
  // curve is strongest at the horizon (t=0) and fades to nothing right at
  // the player (t=1), like a road bending away into the distance.
  private roadCurveOffset(): number {
    if (!LevelState.curvedRoad) return 0;
    const periodMs = 7000;
    return Math.sin((this.elapsed / periodMs) * Math.PI * 2) * 0.35;
  }

  private project(laneX: number, z: number): Projected {
    const t = Phaser.Math.Clamp(1 - z, 0, 1);
    const y = this.horizonY + (this.bottomY - this.horizonY) * t;
    const halfWidth = this.minHalfWidth + (this.maxHalfWidth - this.minHalfWidth) * t;
    const curve = this.roadCurveOffset() * (1 - t);
    const x = this.centerX + (laneX - this.playerLaneX + curve) * halfWidth;
    const scale = this.minScale + (this.maxScale - this.minScale) * t;
    return { x, y, scale };
  }

  private buildSky(): void {
    const sky = this.add.graphics();

    if (this.isNight) {
      sky.fillGradientStyle(0x05060a, 0x05060a, 0x1c2236, 0x1c2236, 1);
      sky.fillRect(0, 0, GameConfig.width, this.horizonY);
    } else {
      sky.fillGradientStyle(0x1f6fd1, 0x1f6fd1, 0x9adcf0, 0x9adcf0, 1);
      sky.fillRect(0, 0, GameConfig.width, this.horizonY);

      const sunX = GameConfig.width * 0.74;
      const sunY = this.horizonY * 0.34;
      sky.fillStyle(0xfff4c2, 0.35);
      sky.fillCircle(sunX, sunY, 48);
      sky.fillStyle(0xffe98a, 1);
      sky.fillCircle(sunX, sunY, 28);
    }

    const buildingCount = 7;
    const slotW = GameConfig.width / buildingCount;
    const dayColors = [0x9fb4c9, 0xc9a876, 0xb0c39d, 0xa89bc7, 0xc78f8f, 0x8fb3a8, 0xb8ab8a];

    for (let i = 0; i < buildingCount; i++) {
      const bw = slotW + 6;
      const bx = i * slotW - 3;
      const bh = Phaser.Math.Between(28, 92);

      sky.fillStyle(this.isNight ? 0x11141c : dayColors[i % dayColors.length], 1);
      sky.fillRect(bx, this.horizonY - bh, bw, bh);

      // Night: warm lit windows. Day: subtle dark window glass, unlit.
      sky.fillStyle(this.isNight ? 0xffd873 : 0x2b3038, this.isNight ? 0.9 : 0.32);
      const winCols = 2;
      const winRows = Math.floor(bh / 16);
      for (let r = 0; r < winRows; r++) {
        for (let c = 0; c < winCols; c++) {
          if (Math.random() < (this.isNight ? 0.35 : 0.5)) continue;
          sky.fillRect(bx + 4 + c * (bw / winCols), this.horizonY - bh + 5 + r * 16, 4, 6);
        }
      }
    }
  }

  // Idea #9: a handful of twinkling stars (night) or slow-drifting clouds
  // (day) behind the buildings — pure ambience, redrawn each frame in
  // drawParallax() since stars twinkle and clouds scroll.
  private buildParallax(): void {
    this.parallaxGraphics = this.add.graphics().setDepth(0.5);
    if (this.isNight) {
      this.stars = Array.from({ length: 30 }, () => ({
        x: Phaser.Math.Between(0, GameConfig.width),
        y: Phaser.Math.Between(10, this.horizonY - 20),
        r: Phaser.Math.FloatBetween(0.8, 1.8),
        phase: Math.random() * Math.PI * 2,
      }));
    } else {
      this.clouds = Array.from({ length: 4 }, () => ({
        x: Phaser.Math.Between(0, GameConfig.width),
        y: Phaser.Math.Between(20, Math.round(this.horizonY * 0.55)),
        w: Phaser.Math.Between(60, 110),
        h: Phaser.Math.Between(16, 26),
        speed: Phaser.Math.FloatBetween(4, 9),
      }));
    }
  }

  private drawParallax(delta: number): void {
    this.parallaxGraphics.clear();
    if (this.isNight) {
      for (const s of this.stars) {
        const alpha = 0.4 + 0.6 * Math.abs(Math.sin(this.elapsed / 900 + s.phase));
        this.parallaxGraphics.fillStyle(0xffffff, alpha);
        this.parallaxGraphics.fillCircle(s.x, s.y, s.r);
      }
    } else {
      this.parallaxGraphics.fillStyle(0xffffff, 0.55);
      for (const c of this.clouds) {
        c.x -= (c.speed * delta) / 1000;
        if (c.x < -c.w) c.x = GameConfig.width + c.w;
        this.parallaxGraphics.fillEllipse(c.x, c.y, c.w, c.h);
        this.parallaxGraphics.fillEllipse(c.x - c.w * 0.3, c.y + c.h * 0.15, c.w * 0.6, c.h * 0.7);
        this.parallaxGraphics.fillEllipse(c.x + c.w * 0.3, c.y + c.h * 0.1, c.w * 0.5, c.h * 0.6);
      }
    }
  }

  // A soft vignette (4 edge gradients fading toward the center) to draw
  // focus toward the middle of the road — sits above the road/obstacles but
  // below the dashboard and HUD.
  private buildVignette(): void {
    const g = this.add.graphics().setDepth(12);
    const edge = 90;
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.45, 0.45, 0, 0);
    g.fillRect(0, 0, GameConfig.width, edge);
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.45, 0.45);
    g.fillRect(0, GameConfig.height - edge, GameConfig.width, edge);
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.4, 0, 0.4, 0);
    g.fillRect(0, 0, edge, GameConfig.height);
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.4, 0, 0.4);
    g.fillRect(GameConfig.width - edge, 0, edge, GameConfig.height);
  }

  // Static screen-space headlight glow (night only) — attached to the car,
  // so it doesn't shift with steering, just illuminates the road ahead.
  private buildHeadlights(): void {
    const g = this.add.graphics().setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
    const originY = this.bottomY - 10;
    const farY = this.horizonY + 170;

    for (const side of [-1, 1]) {
      const originX = this.centerX + side * 55;
      const farX = this.centerX + side * 30;

      g.fillStyle(0xfff3c4, 0.14);
      g.beginPath();
      g.moveTo(originX - 8, originY);
      g.lineTo(originX + 8, originY);
      g.lineTo(farX + 70, farY);
      g.lineTo(farX - 70, farY);
      g.closePath();
      g.fillPath();

      g.fillStyle(0xfff8e0, 0.3);
      g.fillCircle(originX, originY, 16);
    }
  }

  // Idea #6: night gets a static translucent fog band near the horizon; day
  // gets animated rain streaks (redrawn each frame in update()). Purely
  // visual — the only gameplay effect is obstacles fading in near the
  // horizon instead of appearing instantly (see updateObstacles), which
  // shortens the perceived reaction window without touching collisionZ.
  private buildWeatherOverlay(): void {
    if (!LevelState.fogOrRain) return;
    this.weatherGraphics = this.add.graphics().setDepth(7);
    if (this.isNight) {
      this.weatherGraphics.fillStyle(0xaab4c0, 0.3);
      this.weatherGraphics.fillRect(0, this.horizonY - 10, GameConfig.width, 150);
    }
  }

  private drawRain(): void {
    if (!this.weatherGraphics || this.isNight) return;
    this.weatherGraphics.clear();
    this.weatherGraphics.lineStyle(2, 0xd8e8f0, 0.35);
    const offset = (this.elapsed / 1000) * 400;
    for (let i = 0; i < 24; i++) {
      const x = ((i * 37 + offset * 0.3) % (GameConfig.width + 60)) - 30;
      const y = ((i * 53 + offset) % (GameConfig.height - this.horizonY)) + this.horizonY;
      this.weatherGraphics.lineBetween(x, y, x - 8, y + 22);
    }
  }

  // Idea #9: the fewer lives remain, the faster every chase feels — applied
  // as a live multiplier in updateObstacles' speedScale (not baked into
  // approachRate at spawn time), so losing a life mid-run speeds up
  // obstacles already on screen too, not just future ones.
  private livesSpeedFactor(): number {
    return 1 + (GameConfig.livesMax - RunState.lives) * 0.12;
  }

  // A simple drawn wrench-on-a-disc icon, generated once and cached in the
  // texture manager — avoids blocking this feature on a new AI-generated
  // asset, same placeholder philosophy already used for the audio SFX.
  private ensurePartTexture(): void {
    if (this.textures.exists(PART_ICON_KEY)) return;
    const size = 64;
    const g = this.add.graphics();
    g.fillStyle(0xffb454, 1);
    g.fillCircle(size / 2, size / 2, size / 2 - 4);
    g.lineStyle(3, 0x1c1f26, 1);
    g.strokeCircle(size / 2, size / 2, size / 2 - 4);
    g.lineStyle(6, 0x1c1f26, 1);
    g.lineBetween(size * 0.3, size * 0.7, size * 0.7, size * 0.3);
    g.fillStyle(0x1c1f26, 1);
    g.fillCircle(size * 0.28, size * 0.72, 7);
    g.fillCircle(size * 0.72, size * 0.28, 7);
    g.generateTexture(PART_ICON_KEY, size, size);
    g.destroy();
  }

  private buildDashboard(): void {
    // Regenerated art ships as a square 1024x1024 canvas with a genuinely
    // transparent windshield opening this time — cover-fit by height so the
    // mirror/dashboard reach the top/bottom edges; the extra width simply
    // falls outside the canvas, which is harmless.
    this.add.image(GameConfig.width / 2, GameConfig.height / 2, "cockpit-frame").setDepth(15).setDisplaySize(GameConfig.height, GameConfig.height);

    this.wheelContainer = this.add.container(GameConfig.width / 2, GameConfig.height - 24).setDepth(16);
    const wheel = this.add.image(0, 0, "steering-wheel").setDisplaySize(170, 170);
    this.wheelContainer.add(wheel);
  }

  update(_time: number, delta: number): void {
    if (this.resolved || this.tutorialActive) return;

    this.elapsed += delta;
    this.spawnTimer += delta;
    const progress = Phaser.Math.Clamp(this.elapsed / this.duration, 0, 1);

    this.playerLaneX = Phaser.Math.Linear(this.playerLaneX, this.lanePositions[this.playerLaneIndex], 0.3);
    this.wheelContainer.setAngle(this.playerLaneX * 30);

    const interval = Phaser.Math.Linear(this.spawnIntervalStart, this.spawnIntervalEnd, progress);
    if (this.spawnTimer >= interval) {
      if (this.obstacles.length < this.maxConcurrent) {
        this.spawnTimer = 0;
        if (this.isDeliveryChase && !this.partSpawned) {
          this.spawnPartObstacle();
        } else {
          this.spawnObstacle(progress);
        }
      } else {
        this.spawnTimer = interval;
      }
    }

    this.drawParallax(delta);
    this.drawRoad();
    this.drawRain();
    this.updateObstacles(delta, progress);
    this.drawTimeBar(progress);

    if (this.elapsed >= this.duration) {
      this.resolveChase(true);
    }
  }

  private drawRoad(): void {
    this.roadGraphics.clear();

    const farLeft = this.project(-1, 1);
    const farRight = this.project(1, 1);
    const nearLeft = this.project(-1, 0);
    const nearRight = this.project(1, 0);

    this.roadGraphics.fillStyle(this.roadColor, 1);
    this.roadGraphics.beginPath();
    this.roadGraphics.moveTo(farLeft.x, farLeft.y);
    this.roadGraphics.lineTo(farRight.x, farRight.y);
    this.roadGraphics.lineTo(nearRight.x, nearRight.y);
    this.roadGraphics.lineTo(nearLeft.x, nearLeft.y);
    this.roadGraphics.closePath();
    this.roadGraphics.fillPath();

    // Dashed dividers between adjacent lane centers, so 3 lanes actually read as 3 lanes.
    const dividerXs = [
      (this.lanePositions[0] + this.lanePositions[1]) / 2,
      (this.lanePositions[1] + this.lanePositions[2]) / 2,
    ];
    const dashCount = 8;
    const cycle = (this.elapsed % 700) / 700;
    this.roadGraphics.fillStyle(Palette.laneGold, 1);
    for (const dividerX of dividerXs) {
      for (let i = 0; i < dashCount; i++) {
        const z = 1 - ((i + cycle) / dashCount) * 1;
        if (z <= 0 || z >= 1) continue;
        const p = this.project(dividerX, z);
        const dashHalfW = 2 + p.scale * 3;
        const dashHalfH = 4 + p.scale * 10;
        this.roadGraphics.fillRect(p.x - dashHalfW, p.y - dashHalfH, dashHalfW * 2, dashHalfH * 2);
      }
    }

    this.roadGraphics.lineStyle(3, Palette.wallSolid, 1);
    this.roadGraphics.lineBetween(farLeft.x, farLeft.y, nearLeft.x, nearLeft.y);
    this.roadGraphics.lineBetween(farRight.x, farRight.y, nearRight.x, nearRight.y);
  }

  private spawnObstacle(progress: number): void {
    const roll = Math.random();
    let kind: ObstacleKind;
    let key: string;
    let wobbleAmp = 0;
    let wobbleSpeed = 0;

    if (roll < 0.3) {
      kind = "car";
      key = `vehicle-car-rear-${CAR_COLOR_KEYS[Phaser.Math.Between(0, CAR_COLOR_KEYS.length - 1)]}`;
    } else if (roll < 0.4) {
      kind = "bus";
      key = "vehicle-bus-rear";
    } else if (roll < 0.68) {
      kind = "pedestrian";
      key = Math.random() < 0.5 ? "pedestrian-1" : "pedestrian-2";
      wobbleAmp = 0.05;
      wobbleSpeed = 2.2;
    } else if (roll < 0.85) {
      kind = "cone";
      key = "cone";
    } else {
      kind = "pet";
      key = Math.random() < 0.5 ? "pet-dog" : "pet-cat";
      wobbleAmp = 0.1;
      wobbleSpeed = 4.5;
    }

    const occupiedLanes = new Set(this.obstacles.map((o) => o.laneIndex));
    const freeLanes = ([0, 1, 2] as LaneIndex[]).filter((l) => !occupiedLanes.has(l));
    if (freeLanes.length === 0) return;
    const laneIndex = freeLanes[Phaser.Math.Between(0, freeLanes.length - 1)];

    const sprite = this.add.image(this.centerX, this.horizonY, key).setDepth(8);
    const baseScale = KIND_BASE_SCALE[kind];

    // Slow, generous approach speed: obstacles take ~3.8s (early) to ~1.9s
    // (late) to travel from the horizon to the car, giving real reaction time.
    // Buses read as heavier/slower hazards. Scaled by the current level's
    // difficulty (see LevelState's fixed/procedural chase-speed curve).
    const approachRate =
      Phaser.Math.Linear(0.26, 0.53, progress) *
      Phaser.Math.FloatBetween(0.95, 1.05) *
      (kind === "bus" ? 0.85 : 1) *
      LevelState.chaseSpeedMult;

    // Pedestrians and pets walk in from the roadside and settle into their
    // landing lane instead of already standing in it, like they're actually
    // crossing the street. Which of the 3 lanes they land in is still just
    // laneIndex, picked above from whichever lanes are currently free.
    // Bugfix: crossing obstacles used to settle into their lane as late as
    // z=0.35 (and, with a second lane switch, as late as z=0.22 — barely
    // above collisionZ=0.1), leaving almost no real time to react once you
    // could actually tell which lane they'd land in. Both now finish well
    // before collisionZ, so the "which lane is this actually in" question is
    // always answered with a real reaction window left.
    const crossing = kind === "pedestrian" || kind === "pet";
    const crossStartLaneX = crossing ? (Math.random() < 0.5 ? -1.6 : 1.6) : this.lanePositions[laneIndex];
    const crossFinishZ = crossing ? Phaser.Math.FloatBetween(0.55, 0.75) : 1;

    // Idea #10: some crossing obstacles do a second lane change after
    // settling into their first lane, well before collisionZ.
    let secondSwitch = false;
    let secondSwitchLaneIndex: LaneIndex | null = null;
    let secondSwitchFinishZ = 0;
    if (crossing && LevelState.crossLaneSwitch && Math.random() < 0.4) {
      const otherLanes = ([0, 1, 2] as LaneIndex[]).filter((l) => l !== laneIndex);
      secondSwitchLaneIndex = otherLanes[Phaser.Math.Between(0, otherLanes.length - 1)];
      secondSwitch = true;
      secondSwitchFinishZ = Phaser.Math.FloatBetween(0.35, Math.min(0.45, crossFinishZ - 0.15));
    }

    this.obstacles.push({
      sprite,
      kind,
      laneIndex,
      z: 1,
      approachRate,
      wobbleAmp,
      wobbleSpeed,
      seed: Math.random() * Math.PI * 2,
      resolved: false,
      baseScale,
      crossing,
      crossStartLaneX,
      crossFinishZ,
      firstLaneIndex: laneIndex,
      secondSwitch,
      secondSwitchLaneIndex,
      secondSwitchFinishZ,
      secondSwitchApplied: false,
    });
  }

  // Guaranteed pickup for a delivery chase — spawned directly instead of
  // through spawnObstacle's random kind roll, in whatever lane is free.
  private spawnPartObstacle(): void {
    const occupiedLanes = new Set(this.obstacles.map((o) => o.laneIndex));
    const freeLanes = ([0, 1, 2] as LaneIndex[]).filter((l) => !occupiedLanes.has(l));
    if (freeLanes.length === 0) return;
    const laneIndex = freeLanes[Phaser.Math.Between(0, freeLanes.length - 1)];

    const sprite = this.add.image(this.centerX, this.horizonY, PART_ICON_KEY).setDepth(8);

    this.obstacles.push({
      sprite,
      kind: "part",
      laneIndex,
      z: 1,
      approachRate: 0.24 * LevelState.chaseSpeedMult,
      wobbleAmp: 0,
      wobbleSpeed: 0,
      seed: Math.random() * Math.PI * 2,
      resolved: false,
      baseScale: KIND_BASE_SCALE.part,
      crossing: false,
      crossStartLaneX: this.lanePositions[laneIndex],
      crossFinishZ: 1,
      firstLaneIndex: laneIndex,
      secondSwitch: false,
      secondSwitchLaneIndex: null,
      secondSwitchFinishZ: 0,
      secondSwitchApplied: false,
    });

    this.partSpawned = true;
  }

  private collectPart(ob: Obstacle): void {
    const x = ob.sprite.x;
    const y = ob.sprite.y;
    ob.sprite.destroy();
    this.obstacles = this.obstacles.filter((o) => o !== ob);
    const repaired = LevelState.deliverPart();
    this.cameras.main.flash(120, 244, 197, 66);
    playPickup();
    if (repaired) {
      // Fully repaired, not just one more part — a bigger celebration.
      confetti(this, x, y);
      this.deliveryHudText?.setText("🔧 ¡Auto reparado!");
    } else {
      this.deliveryHudText?.setText("🔧 ¡Pieza recogida!");
    }
  }

  private updateObstacles(delta: number, progress: number): void {
    const speedScale = (1 + progress * 0.25) * this.livesSpeedFactor();
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const ob = this.obstacles[i];
      ob.z -= (ob.approachRate * speedScale * delta) / 1000;

      // Idea #10, phase 2: once the first crossing has settled, some
      // obstacles switch to a second lane — the TRUE hit-test lane only
      // flips once that second visual move has actually finished.
      if (ob.secondSwitch && !ob.secondSwitchApplied && ob.z <= ob.secondSwitchFinishZ) {
        ob.laneIndex = ob.secondSwitchLaneIndex as LaneIndex;
        ob.secondSwitchApplied = true;
      }

      // Cosmetic sway only — stays well inside the lane, never affects the hit test below.
      const wobble = ob.wobbleAmp > 0 ? Math.sin((this.elapsed / 1000) * ob.wobbleSpeed + ob.seed) * ob.wobbleAmp : 0;
      let baseLaneX = this.lanePositions[ob.firstLaneIndex];
      if (ob.crossing) {
        const t1 = Phaser.Math.Clamp((1 - ob.z) / (1 - ob.crossFinishZ), 0, 1);
        const eased1 = t1 * t1 * (3 - 2 * t1);
        baseLaneX = Phaser.Math.Linear(ob.crossStartLaneX, this.lanePositions[ob.firstLaneIndex], eased1);
      }
      if (ob.secondSwitch && ob.z < ob.crossFinishZ) {
        const span = ob.crossFinishZ - ob.secondSwitchFinishZ;
        const t2 = span > 0 ? Phaser.Math.Clamp((ob.crossFinishZ - ob.z) / span, 0, 1) : 1;
        const eased2 = t2 * t2 * (3 - 2 * t2);
        baseLaneX = Phaser.Math.Linear(
          this.lanePositions[ob.firstLaneIndex],
          this.lanePositions[ob.secondSwitchLaneIndex as LaneIndex],
          eased2,
        );
      }
      const visualLaneX = baseLaneX + wobble;
      const p = this.project(visualLaneX, Math.max(ob.z, 0));
      ob.sprite.setPosition(p.x, p.y);
      ob.sprite.setScale(p.scale * ob.baseScale);
      ob.sprite.setDepth(8 + Math.round((1 - ob.z) * 10));
      // Idea #6: fog/rain shortens the perceived reaction window by fading
      // obstacles in near the horizon instead of showing them at full
      // strength immediately — the real collision distance never changes.
      ob.sprite.setAlpha(LevelState.fogOrRain ? Phaser.Math.Clamp((1 - ob.z) / 0.3, 0, 1) : 1);

      if (!ob.resolved && ob.z <= this.collisionZ) {
        ob.resolved = true;
        if (ob.kind === "part") {
          // Pickups never cost a life either way — missing one just means
          // the next delivery chase will try again.
          if (ob.laneIndex === this.playerLaneIndex) {
            this.collectPart(ob);
          } else {
            ob.sprite.destroy();
            this.obstacles.splice(i, 1);
          }
        } else if (ob.laneIndex === this.playerLaneIndex) {
          this.onHitObstacle(ob);
        } else {
          // Missed: remove it right at the collision point instead of letting
          // it keep sitting there — lingering past the point where it could
          // still hit you reads as "is this still dangerous?" confusion.
          ob.sprite.destroy();
          this.obstacles.splice(i, 1);
        }
        continue;
      }
    }
  }

  private onHitObstacle(ob: Obstacle): void {
    if (this.resolved) return;
    burst(this, ob.sprite.x, ob.sprite.y, Palette.danger);
    ob.sprite.destroy();
    this.obstacles = this.obstacles.filter((o) => o !== ob);
    this.hits++;
    this.updateHitDots();
    playCrash();
    hapticImpact();

    if (this.hits >= GameConfig.chaseMaxHits) {
      this.resolveChase(false);
      return;
    }
    this.cameras.main.flash(150, 255, 71, 87);
    this.cameras.main.shake(120, 0.006);
  }

  private resolveChase(success: boolean): void {
    if (this.resolved) return;
    this.resolved = true;
    this.pointerDown = false;

    const car = LevelState.getCar(this.carId);

    if (success && this.mistake) {
      // Won a mistake-chase: the car survives without costing a life, but
      // it doesn't just exit for free either — it lands somewhere else.
      if (car) {
        LevelState.relocateCar(car);
        car.inChase = false;
      }
      LevelState.replenish();
      hapticSuccess();
      this.cameras.main.flash(200, 79, 209, 255);
      this.time.delayedCall(220, () => goTo(this, "ParkingScene"));
    } else if (success) {
      playExit();
      hapticSuccess();
      if (car) LevelState.removeCar(this.carId);
      LevelState.clearedCount++;
      RunState.addScore(GameConfig.chaseSuccessBonus);
      showFloatingText(this, GameConfig.width / 2, GameConfig.height / 2 - 60, `+${GameConfig.chaseSuccessBonus}`, Palette.textGold);
      LevelState.replenish();
      this.cameras.main.flash(200, 79, 209, 255);
      this.time.delayedCall(220, () => goTo(this, "ParkingScene"));
    } else {
      if (car) car.inChase = false;
      playLoseLife();
      hapticError();
      const gameOver = RunState.loseLife();
      this.cameras.main.flash(200, 255, 71, 87);
      this.time.delayedCall(220, () => {
        goTo(this, gameOver ? "GameOverScene" : "ParkingScene");
      });
    }
  }

  private buildHud(): void {
    this.timeBar = this.add.graphics().setDepth(20);
    this.hitDots.forEach((d) => d.destroy());
    this.hitDots = [];
    for (let i = 0; i < GameConfig.chaseMaxHits; i++) {
      const dot = this.add.circle(GameConfig.width - 24 - i * 26, 46, 8, 0x3a3f4b).setDepth(20);
      this.hitDots.push(dot);
    }

    const exitButton = this.add
      .text(16, 38, "✕", {
        fontFamily: Palette.displayFont,
        fontSize: "20px",
        color: Palette.textLight,
      })
      .setDepth(20)
      .setInteractive({ useHandCursor: true });
    exitButton.on("pointerup", () => {
      this.resolved = true;
      goTo(this, "MenuScene");
    });

    this.mistakeHudText?.destroy();
    this.mistakeHudText = undefined;
    let bannerY = 40;
    if (this.mistake) {
      this.mistakeHudText = this.add
        .text(GameConfig.width / 2, bannerY, "😬 ¡Sálvalo! Si ganas, vuelve a la cuadrícula sin perder vida", {
          fontFamily: Palette.displayFont,
          fontSize: "12px",
          color: "#1c1f26",
          backgroundColor: "#ff8a3d",
          padding: { x: 8, y: 4 },
          align: "center",
          wordWrap: { width: 300 },
        })
        .setOrigin(0.5, 0)
        .setDepth(20);
      bannerY += this.mistakeHudText.height + 6;
    }

    this.deliveryHudText?.destroy();
    this.deliveryHudText = undefined;
    if (this.isDeliveryChase) {
      this.deliveryHudText = this.add
        .text(GameConfig.width / 2, bannerY, "🔧 Busca la pieza de repuesto", {
          fontFamily: Palette.displayFont,
          fontSize: "13px",
          color: "#1c1f26",
          backgroundColor: Palette.textGold,
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5, 0)
        .setDepth(20);
    }
  }

  private updateHitDots(): void {
    for (let i = 0; i < this.hitDots.length; i++) {
      this.hitDots[i].setFillStyle(i < this.hits ? Palette.danger : 0x3a3f4b);
    }
  }

  private drawTimeBar(progress: number): void {
    this.timeBar.clear();
    this.timeBar.fillStyle(0x000000, 0.35);
    this.timeBar.fillRect(16, 16, GameConfig.width - 32, 14);
    this.timeBar.fillStyle(Palette.laneGold, 1);
    this.timeBar.fillRect(16, 16, (GameConfig.width - 32) * progress, 14);
  }
}

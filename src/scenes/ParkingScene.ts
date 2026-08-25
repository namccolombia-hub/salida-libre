import Phaser from "phaser";
import { GameConfig, Palette, landmarkForLevel } from "../config/palette.ts";
import { RunState } from "../state/RunState.ts";
import { LevelState } from "../state/LevelState.ts";
import type { CarInstance } from "../state/LevelState.ts";
import { playCrash, playTap, playExit, playLevelComplete, playLoseLife } from "../audio/sfx.ts";
import { play as playMusic } from "../audio/music.ts";
import { showInterstitial } from "../ads/AdService.ts";
import { pushProgress } from "../cloud/CloudSave.ts";
import { loadHintsEnabled } from "../state/Persistence.ts";
import { burst, confetti, showFloatingText } from "../fx/effects.ts";
import { hapticImpact, hapticSuccess, hapticError } from "../fx/haptics.ts";
import { goTo, fadeIn } from "../fx/sceneTransition.ts";
import { createButton } from "../ui/Button.ts";
import { showTutorialQueue } from "../ui/TutorialOverlay.ts";

type Edge = "top" | "bottom" | "left" | "right";

export const OBSTACLE_ICON_KEY = "decorative-obstacle-icon";

// A simple drawn hazard-block icon for decorative obstacles (idea #1),
// generated once and cached — same placeholder approach already used for the
// repair-part icon in ChaseScene, avoids blocking on a new asset. Exported
// (not a class method) so GridPreviewScene can reuse the exact same texture.
export function ensureObstacleTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(OBSTACLE_ICON_KEY)) return;
  const size = 64;
  const g = scene.add.graphics();
  g.fillStyle(0x3a3f4b, 1);
  g.fillRoundedRect(4, 4, size - 8, size - 8, 10);
  g.lineStyle(3, 0xff8a3d, 1);
  g.strokeRoundedRect(4, 4, size - 8, size - 8, 10);
  g.fillStyle(0xffffff, 0.85);
  g.fillRect(4, size / 2 - 6, size - 8, 12);
  g.fillStyle(0xff8a3d, 1);
  g.fillRect(4, size / 2 - 6, (size - 8) / 3, 12);
  g.fillRect(4 + ((size - 8) * 2) / 3, size / 2 - 6, (size - 8) / 3, 12);
  g.generateTexture(OBSTACLE_ICON_KEY, size, size);
  g.destroy();
}

// Both the car and bus art are authored portrait (nose up), so the same
// facing math rotates either one to match its travel direction.
function angleForCar(car: CarInstance): number {
  if (car.orientation === "v") return car.dir === -1 ? 0 : 180;
  return car.dir === 1 ? 90 : -90;
}

function carExitEdge(car: CarInstance): Edge {
  if (car.orientation === "h") return car.dir === 1 ? "right" : "left";
  return car.dir === 1 ? "bottom" : "top";
}

export class ParkingScene extends Phaser.Scene {
  private offsetX = 0;
  private offsetY = 116;
  private readonly bottomMargin = 40;
  private cellSize: number = GameConfig.cellSize;
  private busy = false;
  private carSprites = new Map<number, Phaser.GameObjects.Image>();
  private obstacleSprites: Phaser.GameObjects.Image[] = [];
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private lampGraphics!: Phaser.GameObjects.Graphics;
  private shadowGraphics!: Phaser.GameObjects.Graphics;
  private modalLayer: Phaser.GameObjects.GameObject[] = [];

  // Same real-clock day/night check as the chase scene, so the two modes
  // read as the same place at the same time of day.
  private isNight = true;

  private heartIcons: Phaser.GameObjects.Text[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private floorButton?: ReturnType<typeof createButton>;
  private shortcutButton?: ReturnType<typeof createButton>;
  private badgeTexts: Phaser.GameObjects.Text[] = [];
  private toastText?: Phaser.GameObjects.Text;
  private toastTween?: Phaser.Tweens.Tween;

  // --- Edge closures (idea #2) ---
  private edgeClosureGraphics?: Phaser.GameObjects.Graphics;
  private edgeCycleElapsed = 0;
  private closedEdge: Edge | null = null;
  private readonly edgeOpenMs = 4000;
  private readonly edgeClosedMs = 2500;

  // --- Ambient traffic (idea #3) ---
  private trafficDriftElapsed = 0;
  private readonly trafficDriftIntervalMs = 3500;

  // --- Level timer (idea #4) ---
  private timerElapsed = 0;
  private timerGraphics?: Phaser.GameObjects.Graphics;
  private timerBarY?: number;

  // --- 15s idle hint (visual idea #4, "autos que respiran") ---
  private hintsEnabled = true;
  private idleElapsed = 0;
  private hintActive = false;
  private hintTweens = new Map<number, { tween: Phaser.Tweens.Tween; baseScale: number }>();
  private readonly hintIdleMs = 15000;

  private floorRowY?: number;
  private shortcutRowY?: number;

  constructor() {
    super("ParkingScene");
  }

  create(): void {
    const hour = new Date().getHours();
    this.isNight = hour >= 19 || hour < 5;

    this.cameras.main.setBackgroundColor(Palette.bgAsphalt);
    this.cameras.main.zoom = 1;
    this.drawThemedBackground();
    fadeIn(this);
    playMusic(this, "parking");
    this.busy = false;
    this.carSprites.clear();
    this.obstacleSprites = [];
    this.badgeTexts = [];
    this.modalLayer = [];
    this.edgeCycleElapsed = 0;
    this.closedEdge = null;
    this.trafficDriftElapsed = 0;
    this.timerElapsed = 0;
    this.hintsEnabled = loadHintsEnabled();
    this.idleElapsed = 0;
    this.hintActive = false;
    this.hintTweens.clear();

    this.assignHudRows();
    this.layoutGrid();
    this.shadowGraphics = this.add.graphics().setDepth(2);
    this.gridGraphics = this.add.graphics();
    // Normal blend, not ADD — with several lamps' glows overlapping on a
    // small grid, additive blending was clipping the warm tint out entirely
    // and washing the whole lot out into a flat gray haze.
    this.lampGraphics = this.add.graphics().setDepth(1);
    if (LevelState.edgeClosures) this.edgeClosureGraphics = this.add.graphics().setDepth(3);
    this.drawGrid();
    ensureObstacleTexture(this);
    this.syncObstacles();

    this.buildHud();
    this.syncSprites(false);

    this.busy = true;
    showTutorialQueue(this, this.pendingTutorialIds(), () => {
      this.busy = false;
      if (LevelState.isLevelComplete()) {
        this.showLevelCompleteModal();
      }
    });
  }

  // Which mechanic tutorials are relevant to the level just loaded — the
  // overlay itself filters out anything already seen, so it's fine to
  // always list every modifier this level has active.
  private pendingTutorialIds(): string[] {
    const ids: string[] = [];
    if (LevelState.level === 1) ids.push("movement");
    if (LevelState.floors === 2) ids.push("floors");
    if ([...LevelState.cars, ...LevelState.floor2Cars].some((c) => c.broken)) ids.push("broken");
    if (LevelState.obstacleCells.length > 0) ids.push("obstacles");
    if (LevelState.edgeClosures) ids.push("edgeClosures");
    if (LevelState.ambientTraffic) ids.push("ambientTraffic");
    if (LevelState.hasTimer) ids.push("timer");
    if (LevelState.vipEnabled) ids.push("vip");
    if (LevelState.shortcutTollEnabled) ids.push("shortcut");
    return ids;
  }

  // Extra HUD rows (floor toggle / timer bar / shortcut button) stack below
  // the level text, each only reserved when that level's modifier is on —
  // the grid's top offset shifts down to make room, same idea as the
  // existing dynamic cell-size fit.
  private assignHudRows(): void {
    const rowHeight = 26;
    let y = 78;
    this.floorRowY = LevelState.floors === 2 ? y : undefined;
    if (LevelState.floors === 2) y += rowHeight;
    this.timerBarY = LevelState.hasTimer ? y : undefined;
    if (LevelState.hasTimer) y += rowHeight;
    this.shortcutRowY = LevelState.shortcutTollEnabled ? y : undefined;
    if (LevelState.shortcutTollEnabled) y += rowHeight;
    this.offsetY = y + 8;
  }

  // Cell size fits the current level's grid (which grows and changes shape
  // over time) into the available screen space, capped at the original
  // baseline size so a level-1-sized grid still looks exactly as before.
  private computeCellSize(): number {
    const maxGridWidth = GameConfig.width - 24;
    const maxGridHeight = GameConfig.height - this.offsetY - this.bottomMargin;
    const fit = Math.min(maxGridWidth / LevelState.cols, maxGridHeight / LevelState.rows);
    return Phaser.Math.Clamp(Math.floor(fit), 22, GameConfig.cellSize);
  }

  private layoutGrid(): void {
    this.cellSize = this.computeCellSize();
    this.offsetX = (GameConfig.width - LevelState.cols * this.cellSize) / 2;
  }

  // Themes the empty asphalt around the board to whatever "zone" this level
  // belongs to on the level-select road (same cycling — see
  // landmarkForLevel). Purely cosmetic behind the fully-opaque board, so a
  // missing background image (art not generated yet) just leaves the plain
  // Palette.bgAsphalt camera background from create() untouched — no crash,
  // no layout shift, nothing else to gate on.
  private drawThemedBackground(): void {
    const { key } = landmarkForLevel(LevelState.level);
    const textureKey = `parking-bg-${key}`;
    if (!this.textures.exists(textureKey)) return;

    this.add.image(GameConfig.width / 2, GameConfig.height / 2, textureKey).setDepth(-2).setDisplaySize(GameConfig.width, GameConfig.height);

    // A constant dark scrim, not just a night-only one — every HUD/text
    // color in this scene was chosen assuming the old flat near-black
    // background, so the location art can only ever show through faintly
    // (enough to read as "you're at the hospital now", never enough to
    // fight the HUD for contrast).
    const scrimAlpha = this.isNight ? 0.78 : 0.62;
    this.add.rectangle(0, 0, GameConfig.width, GameConfig.height, 0x0b0d12, scrimAlpha).setOrigin(0).setDepth(-1);
  }

  private drawGrid(): void {
    this.gridGraphics.clear();
    const gridW = LevelState.cols * this.cellSize;
    const gridH = LevelState.rows * this.cellSize;

    const asphaltColor = this.isNight ? Palette.bgAsphalt : 0x9aa0a8;
    this.gridGraphics.fillStyle(asphaltColor, 1);
    this.gridGraphics.fillRect(this.offsetX, this.offsetY, gridW, gridH);

    this.gridGraphics.lineStyle(2, this.isNight ? Palette.wallSolid : 0x6b7178, 1);
    this.gridGraphics.strokeRect(this.offsetX, this.offsetY, gridW, gridH);

    this.drawStreetLamps(gridW, gridH);
  }

  // Night only: lamp posts ringing the lot, each casting a small warm pool
  // of light onto the pavement. Spaced wide and kept small on purpose —
  // packed tightly on a small grid, overlapping glows used to wash the
  // whole lot out into a muddy haze instead of reading as distinct lamps.
  private drawStreetLamps(gridW: number, gridH: number): void {
    this.lampGraphics.clear();
    if (!this.isNight) return;

    const spacing = this.cellSize * 4.5;
    const positions: { x: number; y: number }[] = [];
    for (let x = this.offsetX + this.cellSize; x < this.offsetX + gridW; x += spacing) {
      positions.push({ x, y: this.offsetY - 2 });
      positions.push({ x, y: this.offsetY + gridH + 2 });
    }
    for (let y = this.offsetY + this.cellSize; y < this.offsetY + gridH; y += spacing) {
      positions.push({ x: this.offsetX - 2, y });
      positions.push({ x: this.offsetX + gridW + 2, y });
    }

    for (const pos of positions) {
      this.lampGraphics.fillStyle(0xfff3c4, 0.14);
      this.lampGraphics.fillCircle(pos.x, pos.y, this.cellSize * 0.55);
      this.lampGraphics.fillStyle(0xfff8e0, 0.28);
      this.lampGraphics.fillCircle(pos.x, pos.y, this.cellSize * 0.22);
      this.lampGraphics.fillStyle(0xffffff, 0.9);
      this.lampGraphics.fillCircle(pos.x, pos.y, 2.5);
    }
  }

  // Decorative obstacles only ever live on floor 1, so they're only drawn
  // while that floor is the one being viewed.
  private syncObstacles(): void {
    this.obstacleSprites.forEach((s) => s.destroy());
    this.obstacleSprites = [];
    if (LevelState.activeFloor === 0) {
      for (const cell of LevelState.obstacleCells) {
        const x = this.offsetX + (cell.col + 0.5) * this.cellSize;
        const y = this.offsetY + (cell.row + 0.5) * this.cellSize;
        const sprite = this.add.image(x, y, OBSTACLE_ICON_KEY).setDepth(4);
        sprite.setDisplaySize(this.cellSize - 8, this.cellSize - 8);
        this.obstacleSprites.push(sprite);
      }
    }
    this.refreshShadows();
  }

  // Soft dark ellipses under every car and obstacle — cheap depth cue for
  // an otherwise flat top-down view (idea #1).
  private refreshShadows(): void {
    this.shadowGraphics.clear();
    this.shadowGraphics.fillStyle(0x000000, 0.28);
    for (const sprite of this.obstacleSprites) {
      this.shadowGraphics.fillEllipse(sprite.x, sprite.y + 3, this.cellSize * 0.8, this.cellSize * 0.5);
    }
    for (const [id, sprite] of this.carSprites) {
      const car = LevelState.getCar(id);
      const w = car && car.orientation === "h" ? car.length * this.cellSize - 14 : this.cellSize - 14;
      const h = car && car.orientation === "v" ? car.length * this.cellSize - 14 : this.cellSize - 14;
      this.shadowGraphics.fillEllipse(sprite.x, sprite.y + 4, Math.max(w * 0.85, 10), Math.max(h * 0.55, 8));
    }
  }

  private cellCenterX(car: CarInstance): number {
    if (car.orientation === "h") return this.offsetX + (car.col + car.length / 2) * this.cellSize;
    return this.offsetX + (car.col + 0.5) * this.cellSize;
  }

  private cellCenterY(car: CarInstance): number {
    if (car.orientation === "v") return this.offsetY + (car.row + car.length / 2) * this.cellSize;
    return this.offsetY + (car.row + 0.5) * this.cellSize;
  }

  private exitTarget(car: CarInstance): { x: number; y: number } {
    if (car.orientation === "h") {
      return { x: car.dir === 1 ? GameConfig.width + 60 : -60, y: this.cellCenterY(car) };
    }
    return { x: this.cellCenterX(car), y: car.dir === 1 ? GameConfig.height + 60 : this.offsetY - 60 };
  }

  private syncSprites(animateNew: boolean): void {
    for (const car of LevelState.activeCars) {
      if (car.inChase || this.carSprites.has(car.id)) continue;
      const isBus = car.length === 3;
      const key = isBus ? "vehicle-bus" : `vehicle-car-${car.colorKey}`;
      const sprite = this.add.image(this.cellCenterX(car), this.cellCenterY(car), key);

      // The art's native pixel size doesn't match our grid's pixel size, so
      // it's rescaled (preserving aspect ratio) to fit the piece's footprint.
      const targetLong = car.length * this.cellSize - 10;
      sprite.setDisplaySize(sprite.width * (targetLong / sprite.height), targetLong);
      sprite.setAngle(angleForCar(car));
      sprite.setDepth(5);
      // Black cars (0x2b2f38) sit almost exactly on top of the night asphalt
      // color (0x1c1f26) — nearly invisible, direction unreadable. Lighten
      // just this color, just at night; every other color already contrasts fine.
      if (this.isNight && car.colorKey === "black") {
        sprite.setTint(0x9aa4b2);
      }
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", () => {
        playTap();
        this.resetIdle();
        if (car.broken) {
          this.showToast("Repáralo primero: busca la refacción en la persecución");
          return;
        }
        this.tryLaunch(car);
      });
      this.carSprites.set(car.id, sprite);

      if (animateNew) {
        // Pop-in tween must animate toward the fitted scale above, not 1
        // (which would snap it to the art's full native pixel size).
        const targetScale = sprite.scale;
        sprite.setScale(targetScale * 0.3);
        sprite.setAlpha(0);
        this.tweens.add({ targets: sprite, scale: targetScale, alpha: 1, duration: 220, ease: "Back.easeOut" });
      }
    }
    this.refreshBadges();
    this.refreshShadows();
  }

  // Rebuilds every broken/VIP badge from current car state — cheap enough
  // to just redo wholesale after anything that could change one (a tick, a
  // repair, a drift move, a fresh sync) rather than tracking diffs.
  private refreshBadges(): void {
    this.badgeTexts.forEach((b) => b.destroy());
    this.badgeTexts = [];
    for (const car of LevelState.activeCars) {
      const sprite = this.carSprites.get(car.id);
      if (!sprite) continue;
      if (car.broken) this.addBrokenBadge(car, sprite);
      if (car.vip) this.addVipBadge(car, sprite);
    }
  }

  private addBrokenBadge(car: CarInstance, sprite: Phaser.GameObjects.Image): void {
    const badge = this.add
      .text(sprite.x, sprite.y - sprite.displayHeight / 2 - 4, `🔧 ${car.partsHave}/${car.partsNeeded}`, {
        fontFamily: Palette.displayFont,
        fontSize: "12px",
        color: "#1c1f26",
        backgroundColor: "#ffb454",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(6);
    this.badgeTexts.push(badge);
  }

  private addVipBadge(car: CarInstance, sprite: Phaser.GameObjects.Image): void {
    const badge = this.add
      .text(sprite.x, sprite.y - sprite.displayHeight / 2 - 4, `👑 ${car.vipTapsLeft}`, {
        fontFamily: Palette.displayFont,
        fontSize: "12px",
        color: "#1c1f26",
        backgroundColor: "#4fd1ff",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(6);
    this.badgeTexts.push(badge);
  }

  private showToast(message: string): void {
    this.toastTween?.stop();
    this.toastText?.destroy();
    this.toastText = this.add
      .text(GameConfig.width / 2, GameConfig.height - 70, message, {
        fontFamily: Palette.bodyFont,
        fontSize: "13px",
        color: Palette.textLight,
        backgroundColor: "#000000cc",
        padding: { x: 10, y: 6 },
        align: "center",
        wordWrap: { width: 320 },
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0);
    this.toastTween = this.tweens.add({
      targets: this.toastText,
      alpha: 1,
      duration: 150,
      yoyo: true,
      hold: 1200,
      onComplete: () => {
        this.toastText?.destroy();
        this.toastText = undefined;
      },
    });
  }

  // 15s idle hint (visual improvement #4): a gentle breathing pulse on
  // every currently-launchable car, only after 15s with no taps at all —
  // it's a stuck-player hint, not a permanent effect, and can be turned off
  // in Settings.
  private resetIdle(): void {
    this.idleElapsed = 0;
    this.deactivateHints();
  }

  private activateHints(): void {
    if (!this.hintsEnabled || this.hintActive) return;
    this.hintActive = true;
    for (const car of LevelState.activeCars) {
      if (car.broken || !LevelState.pathClear(car)) continue;
      const sprite = this.carSprites.get(car.id);
      if (!sprite) continue;
      const baseScale = sprite.scale;
      const tween = this.tweens.add({
        targets: sprite,
        scale: baseScale * 1.06,
        duration: 550,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.hintTweens.set(car.id, { tween, baseScale });
    }
  }

  private deactivateHints(): void {
    this.hintActive = false;
    for (const [id, entry] of this.hintTweens) {
      entry.tween.stop();
      const sprite = this.carSprites.get(id);
      if (sprite) sprite.setScale(entry.baseScale);
    }
    this.hintTweens.clear();
  }

  private tryLaunch(car: CarInstance): void {
    if (this.busy) return;
    // Defensive — the pointerdown handler already blocks broken cars before
    // ever calling this, but a broken car must never be launchable no
    // matter what code path reaches here.
    if (car.broken) return;
    const sprite = this.carSprites.get(car.id);
    if (!sprite) return;

    this.busy = true;

    if (this.closedEdge && carExitEdge(car) === this.closedEdge) {
      this.bounceCar(car, sprite);
      return;
    }

    const clear = LevelState.pathClear(car);

    if (!clear) {
      this.bounceCar(car, sprite);
      return;
    }

    if (car.floor === 1) {
      // Floor 2 cars never leave the game directly — they need a free
      // mirrored cell on floor 1 to come down to. If it's taken, this reads
      // exactly like a normal blocked launch (bounce at the edge, lose a life).
      const landed = LevelState.tryTransferToFloor1(car);
      if (!landed) {
        this.bounceCar(car, sprite);
        return;
      }
      const target = this.exitTarget(car);
      this.tweens.add({
        targets: sprite,
        x: target.x,
        y: target.y,
        duration: 300,
        ease: "Sine.easeIn",
        onComplete: () => {
          playExit();
          sprite.destroy();
          this.carSprites.delete(car.id);
          this.showToast("↓ Bajó al piso 1 — vuelve a tocarlo para sacarlo");
          LevelState.replenish();
          this.refreshHud();
          this.syncSprites(true);
          this.busy = false;
        },
      });
      return;
    }

    // No dice roll anymore — chase only happens for a reason the player can
    // learn: this specific car is one of the small fixed set flagged to
    // guarantee chase mode shows up, or the level is running low on chances
    // to deliver a pending repair part.
    const goesToChase = car.forcesChase || LevelState.shouldForceDeliveryChase();
    if (goesToChase) {
      const isDeliveryChase = LevelState.partsDelivered < LevelState.partsNeededTotal;
      const nudge = this.exitTarget(car);
      const midX = Phaser.Math.Linear(sprite.x, nudge.x, 0.18);
      const midY = Phaser.Math.Linear(sprite.y, nudge.y, 0.18);
      this.tweens.add({
        targets: sprite,
        x: midX,
        y: midY,
        duration: 200,
        onComplete: () => {
          car.inChase = true;
          goTo(this, "ChaseScene", { carId: car.id, isDeliveryChase, mistake: false });
        },
      });
      return;
    }

    const target = this.exitTarget(car);
    const wasVip = car.vip;
    const scoreX = sprite.x;
    const scoreY = sprite.y;
    this.tweens.add({
      targets: sprite,
      x: target.x,
      y: target.y,
      duration: 380,
      ease: "Sine.easeIn",
      onComplete: () => {
        playExit();
        sprite.destroy();
        this.carSprites.delete(car.id);
        LevelState.removeCar(car.id);
        LevelState.clearedCount++;
        this.timerElapsed = 0;
        if (wasVip) {
          const amount = GameConfig.parkingExitScore * 3;
          RunState.addScore(amount);
          showFloatingText(this, scoreX, scoreY, `+${amount} 👑`, "#4fd1ff");
        } else {
          RunState.addScore(GameConfig.parkingExitScore);
          showFloatingText(this, scoreX, scoreY, `+${GameConfig.parkingExitScore}`, Palette.textGold);
          LevelState.tickVip();
        }
        LevelState.replenish();
        this.refreshHud();
        this.syncSprites(true);
        if (LevelState.isLevelComplete()) {
          this.showLevelCompleteModal();
        } else {
          this.busy = false;
        }
      },
    });
  }

  // Travel all the way up to whatever is blocking it (open cells plus a
  // half-cell nose-in), not a fixed tiny nudge — otherwise the car never
  // visibly gets near the thing it supposedly hit. Also used when a floor-2
  // car reaches its edge but the mirrored floor-1 cell is occupied, and when
  // a closed edge (idea #2) rejects the launch outright — every one of
  // those is "you tried to launch this and it didn't work", so all three
  // fall through to the same mistake-chase consequence below.
  private bounceCar(car: CarInstance, sprite: Phaser.GameObjects.Image): void {
    const travelCells = LevelState.blockingDistance(car) + 0.5;
    const bx = this.cellCenterX(car) + (car.orientation === "h" ? car.dir * this.cellSize * travelCells : 0);
    const by = this.cellCenterY(car) + (car.orientation === "v" ? car.dir * this.cellSize * travelCells : 0);
    const travelDuration = Phaser.Math.Clamp(90 + travelCells * 45, 90, 320);
    this.cameras.main.flash(150, 255, 71, 87);
    this.cameras.main.shake(120, 0.006);
    this.tweens.add({
      targets: sprite,
      x: bx,
      y: by,
      duration: travelDuration,
      yoyo: true,
      ease: "Sine.easeIn",
      onYoyo: () => {
        playCrash();
        hapticImpact();
        burst(this, bx, by, Palette.danger);
        // Impact squash — compresses along the travel axis, bulges
        // perpendicular, then springs back. Sells the hit beyond the
        // flash/shake/particles alone.
        const baseScaleX = sprite.scaleX;
        const baseScaleY = sprite.scaleY;
        this.tweens.add({
          targets: sprite,
          scaleX: baseScaleX * (car.orientation === "h" ? 0.8 : 1.15),
          scaleY: baseScaleY * (car.orientation === "h" ? 1.15 : 0.8),
          duration: 80,
          yoyo: true,
          ease: "Quad.easeOut",
        });
      },
      onComplete: () => {
        // A mistake doesn't cost a life outright anymore — it's a chance to
        // recover in the chase: win and the car survives (just relocated),
        // lose and THEN the life is gone (see ChaseScene.resolveChase).
        const isDeliveryChase = LevelState.partsDelivered < LevelState.partsNeededTotal;
        car.inChase = true;
        goTo(this, "ChaseScene", { carId: car.id, isDeliveryChase, mistake: true });
      },
    });
  }

  // Advancing to the next level is the player's choice, not automatic: this
  // pauses play and offers "next level" or "stop here" once the current
  // level's quota is fully cleared.
  private showLevelCompleteModal(): void {
    this.busy = true;
    this.resetIdle();
    playLevelComplete();
    hapticSuccess();
    RunState.addScore(GameConfig.levelClearBonus);
    LevelState.unlockUpTo(LevelState.level + 1);
    void pushProgress();
    this.refreshHud();

    const overlay = this.add.rectangle(0, 0, GameConfig.width, GameConfig.height, 0x000000, 0.65).setOrigin(0).setDepth(40);

    const panelY = GameConfig.height / 2;
    const panel = this.add.rectangle(GameConfig.width / 2, panelY, 320, 260, Palette.bgAsphaltLight, 1).setDepth(41);
    panel.setStrokeStyle(2, Palette.wallSolid, 1);

    const title = this.add
      .text(GameConfig.width / 2, panelY - 90, `¡NIVEL ${LevelState.level} SUPERADO!`, {
        fontFamily: Palette.displayFont,
        fontSize: "22px",
        color: Palette.textGold,
        align: "center",
        wordWrap: { width: 280 },
      })
      .setOrigin(0.5)
      .setDepth(42);

    const subtitle = this.add
      .text(GameConfig.width / 2, panelY - 40, `Puntaje: ${RunState.score}`, {
        fontFamily: Palette.bodyFont,
        fontSize: "18px",
        color: Palette.textLight,
      })
      .setOrigin(0.5)
      .setDepth(42);

    const nextButton = createButton(this, GameConfig.width / 2, panelY + 20, 240, 56, "SIGUIENTE NIVEL", { fontSize: "17px" });
    nextButton.container.setDepth(42);

    const stopButton = createButton(this, GameConfig.width / 2, panelY + 88, 240, 48, "TERMINAR AQUÍ", {
      fillColor: Palette.bgAsphalt,
      textColor: Palette.textLight,
      strokeColor: Palette.wallSolid,
      fontSize: "15px",
    });
    stopButton.container.setDepth(42);

    this.modalLayer = [overlay, panel, title, subtitle, nextButton.container, stopButton.container];

    confetti(this, GameConfig.width / 2, panelY - 90);

    nextButton.on("pointerup", () => {
      this.modalLayer.forEach((o) => o.destroy());
      this.modalLayer = [];
      // Not on every level — an interstitial after every single win would be
      // exhausting; every 3rd keeps it from being invasive. No-op on web.
      if (LevelState.level % 3 === 0) void showInterstitial();
      LevelState.startLevel(LevelState.level + 1);
      goTo(this, "ParkingScene");
    });

    stopButton.on("pointerup", () => {
      goTo(this, "GameOverScene", { reason: "finished" });
    });
  }

  private buildHud(): void {
    const exitButton = this.add
      .text(16, 16, "✕", {
        fontFamily: Palette.displayFont,
        fontSize: "22px",
        color: Palette.textLight,
      })
      .setDepth(20)
      .setInteractive({ useHandCursor: true });
    exitButton.on("pointerup", () => goTo(this, "MenuScene"));

    this.heartIcons.forEach((h) => h.destroy());
    this.heartIcons = [];
    for (let i = 0; i < GameConfig.livesMax; i++) {
      const heart = this.add
        .text(52 + i * 30, 16, "♥", {
          fontFamily: Palette.bodyFont,
          fontSize: "26px",
          color: i < RunState.lives ? Palette.textDanger : "#3a3f4b",
        })
        .setDepth(20);
      this.heartIcons.push(heart);
    }

    this.scoreText = this.add
      .text(GameConfig.width - 16, 16, `${RunState.score}`, {
        fontFamily: Palette.bodyFont,
        fontSize: "26px",
        color: Palette.textGold,
      })
      .setOrigin(1, 0)
      .setDepth(20);

    this.levelText = this.add
      .text(GameConfig.width / 2, 54, "", {
        fontFamily: Palette.bodyFont,
        fontSize: "16px",
        color: Palette.textLight,
      })
      .setOrigin(0.5, 0)
      .setDepth(20);

    if (this.floorRowY !== undefined) {
      this.floorButton = createButton(this, GameConfig.width / 2, this.floorRowY + 13, 110, 26, "", {
        fontSize: "13px",
      });
      this.floorButton.container.setDepth(20);
      this.floorButton.on("pointerup", () => this.toggleFloorView());
    } else {
      this.floorButton = undefined;
    }

    if (this.timerBarY !== undefined) {
      this.timerGraphics = this.add.graphics().setDepth(20);
    }

    if (this.shortcutRowY !== undefined) {
      this.shortcutButton = createButton(this, GameConfig.width / 2, this.shortcutRowY + 13, 190, 26, "⚡ Atajo (–1 vida)", {
        fillColor: 0xff8a3d,
        fontSize: "12px",
      });
      this.shortcutButton.container.setDepth(20);
      this.shortcutButton.on("pointerup", () => this.useShortcut());
    } else {
      this.shortcutButton = undefined;
    }

    this.refreshHud();
  }

  private toggleFloorView(): void {
    this.resetIdle();
    this.carSprites.forEach((s) => s.destroy());
    this.carSprites.clear();
    this.badgeTexts.forEach((b) => b.destroy());
    this.badgeTexts = [];
    LevelState.toggleFloor();
    this.syncObstacles();
    this.syncSprites(false);
    this.refreshHud();
  }

  private useShortcut(): void {
    if (this.busy) return;
    this.resetIdle();
    if (LevelState.activeFloor !== 0) {
      this.showToast("El atajo solo funciona en el piso 1");
      return;
    }
    const blockedCount = LevelState.cars.filter((c) => !c.broken && !LevelState.pathClear(c)).length;
    if (blockedCount < 2) {
      this.showToast("No hay suficientes autos bloqueados todavía");
      return;
    }

    this.busy = true;
    playLoseLife();
    hapticError();
    const gameOver = RunState.loseLife();
    this.refreshHud();
    if (gameOver) {
      goTo(this, "GameOverScene", { reason: "lives" });
      return;
    }

    const freed = LevelState.useShortcut();
    if (freed.length > 0) playExit();
    for (const car of freed) {
      const sprite = this.carSprites.get(car.id);
      if (!sprite) continue;
      const target = this.exitTarget(car);
      this.tweens.add({
        targets: sprite,
        x: target.x,
        y: target.y,
        duration: 260,
        ease: "Sine.easeIn",
        onComplete: () => sprite.destroy(),
      });
      this.carSprites.delete(car.id);
    }
    LevelState.clearedCount += freed.length;
    const amount = GameConfig.parkingExitScore * freed.length;
    RunState.addScore(amount);
    if (freed.length > 0) showFloatingText(this, GameConfig.width / 2, GameConfig.height / 2, `+${amount}`, Palette.textGold);
    this.timerElapsed = 0;
    LevelState.replenish();
    this.refreshHud();
    this.syncSprites(true);
    if (LevelState.isLevelComplete()) {
      this.showLevelCompleteModal();
    } else {
      this.busy = false;
    }
  }

  private refreshHud(): void {
    for (let i = 0; i < this.heartIcons.length; i++) {
      this.heartIcons[i].setColor(i < RunState.lives ? Palette.textDanger : "#3a3f4b");
    }
    this.scoreText.setText(`${RunState.score}`);
    this.levelText.setText(`Nivel ${LevelState.level} · ${LevelState.clearedCount}/${LevelState.totalQuota}`);
    this.floorButton?.label.setText(LevelState.activeFloor === 0 ? "PISO 1 ▾" : "PISO 2 ▾");
  }

  private drawEdgeClosure(): void {
    if (!this.edgeClosureGraphics) return;
    this.edgeClosureGraphics.clear();
    if (!this.closedEdge) return;
    const gridW = LevelState.cols * this.cellSize;
    const gridH = LevelState.rows * this.cellSize;
    const thickness = 10;
    this.edgeClosureGraphics.fillStyle(Palette.danger, 0.55);
    if (this.closedEdge === "top") {
      this.edgeClosureGraphics.fillRect(this.offsetX, this.offsetY - thickness / 2, gridW, thickness);
    } else if (this.closedEdge === "bottom") {
      this.edgeClosureGraphics.fillRect(this.offsetX, this.offsetY + gridH - thickness / 2, gridW, thickness);
    } else if (this.closedEdge === "left") {
      this.edgeClosureGraphics.fillRect(this.offsetX - thickness / 2, this.offsetY, thickness, gridH);
    } else {
      this.edgeClosureGraphics.fillRect(this.offsetX + gridW - thickness / 2, this.offsetY, thickness, gridH);
    }
  }

  private drawTimerBar(progress: number): void {
    if (!this.timerGraphics || this.timerBarY === undefined) return;
    this.timerGraphics.clear();
    const barX = 40;
    const barW = GameConfig.width - 80;
    const barH = 10;
    this.timerGraphics.fillStyle(0x000000, 0.35);
    this.timerGraphics.fillRect(barX, this.timerBarY, barW, barH);
    this.timerGraphics.fillStyle(progress < 0.25 ? Palette.danger : Palette.laneGold, 1);
    this.timerGraphics.fillRect(barX, this.timerBarY, barW * Math.max(0, progress), barH);
  }

  update(_time: number, delta: number): void {
    // 15s idle hint (visual #4) — a stuck-player nudge, never a permanent effect.
    // Doesn't accumulate while busy (mid-animation or a tutorial is up) so
    // it can't fire behind a modal.
    if (!this.busy) {
      this.idleElapsed += delta;
      if (this.idleElapsed >= this.hintIdleMs && !this.hintActive) {
        this.activateHints();
      }
    }

    // Cycle a random edge open/closed (idea #2) — purely visual/gameplay
    // gate, never touches LevelState/solvability since it's always temporary.
    if (LevelState.edgeClosures && !this.busy) {
      this.edgeCycleElapsed += delta;
      const cycle = this.edgeOpenMs + this.edgeClosedMs;
      const phase = this.edgeCycleElapsed % cycle;
      const shouldBeClosed = phase >= this.edgeOpenMs;
      if (shouldBeClosed && this.closedEdge === null) {
        const edges: Edge[] = ["top", "bottom", "left", "right"];
        this.closedEdge = edges[Phaser.Math.Between(0, edges.length - 1)];
        this.drawEdgeClosure();
      } else if (!shouldBeClosed && this.closedEdge !== null) {
        this.closedEdge = null;
        this.drawEdgeClosure();
      }
    }

    // Ambient traffic drift (idea #3) — one random car creeps forward every
    // few seconds, only while nothing else is animating.
    if (LevelState.ambientTraffic && !this.busy) {
      this.trafficDriftElapsed += delta;
      if (this.trafficDriftElapsed >= this.trafficDriftIntervalMs) {
        this.trafficDriftElapsed = 0;
        const result = LevelState.driftTraffic();
        if (result && LevelState.activeFloor === 0) {
          const sprite = this.carSprites.get(result.car.id);
          if (sprite) {
            this.tweens.add({
              targets: sprite,
              x: this.cellCenterX(result.car),
              y: this.cellCenterY(result.car),
              duration: 150,
              ease: "Sine.easeOut",
              onComplete: () => {
                this.refreshBadges();
                this.refreshShadows();
              },
            });
          }
        }
      }
    }

    // Level timer (idea #4) — running out costs a life and resets, exactly
    // like any other collision; it never ends the run by itself.
    if (LevelState.hasTimer && !this.busy) {
      this.timerElapsed += delta;
      const remaining = Math.max(0, LevelState.timeLimitMs - this.timerElapsed);
      this.drawTimerBar(remaining / LevelState.timeLimitMs);
      if (remaining <= 0) {
        this.timerElapsed = 0;
        this.busy = true;
        this.cameras.main.flash(150, 255, 71, 87);
        playLoseLife();
        hapticError();
        const gameOver = RunState.loseLife();
        this.refreshHud();
        if (gameOver) {
          goTo(this, "GameOverScene", { reason: "lives" });
        } else {
          this.busy = false;
        }
      }
    }
  }
}

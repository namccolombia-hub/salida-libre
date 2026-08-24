import Phaser from "phaser";
import { GameConfig, Palette } from "../config/palette.ts";
import { LevelStateManager, difficultyBadges } from "../state/LevelState.ts";
import type { CarInstance } from "../state/LevelState.ts";
import { RunState } from "../state/RunState.ts";
import { LevelState } from "../state/LevelState.ts";
import { OBSTACLE_ICON_KEY, ensureObstacleTexture } from "./ParkingScene.ts";

interface PreviewData {
  level: number;
}

// Both the car and bus art are authored portrait (nose up), matching ParkingScene's convention.
function angleForCar(car: CarInstance): number {
  if (car.orientation === "v") return car.dir === -1 ? 0 : 180;
  return car.dir === 1 ? 90 : -90;
}

// Design-review tool: renders any level's grid (size, shape, car layout)
// using a throwaway LevelStateManager instance, so it never touches the
// real save/progress. Not interactive — cars don't launch, there's no HUD,
// no lives. Just "what does this level look like".
export class GridPreviewScene extends Phaser.Scene {
  private level = 1;
  private preview!: LevelStateManager;

  private readonly offsetY = 190;
  private readonly bottomMargin = 40;
  private cellSize: number = GameConfig.cellSize;
  private offsetX = 0;
  private isNight = true;

  private gridGraphics!: Phaser.GameObjects.Graphics;
  private lampGraphics!: Phaser.GameObjects.Graphics;
  private carSprites: Phaser.GameObjects.Image[] = [];
  private obstacleSprites: Phaser.GameObjects.Image[] = [];
  private badgeTexts: Phaser.GameObjects.Text[] = [];
  private infoText!: Phaser.GameObjects.Text;
  private floorButton?: Phaser.GameObjects.Text;

  constructor() {
    super("GridPreviewScene");
  }

  init(data: PreviewData): void {
    this.level = data.level;
  }

  create(): void {
    const hour = new Date().getHours();
    this.isNight = hour >= 19 || hour < 5;
    this.cameras.main.setBackgroundColor(Palette.bgAsphalt);

    const back = this.add
      .text(20, 20, "‹ VOLVER", {
        fontFamily: Palette.displayFont,
        fontSize: "16px",
        color: Palette.textLight,
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(20);
    back.on("pointerup", () => this.scene.start("LevelPreviewScene"));

    const next = this.add
      .text(GameConfig.width - 20, 20, "SIGUIENTE ›", {
        fontFamily: Palette.displayFont,
        fontSize: "16px",
        color: Palette.textLight,
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(20);
    next.on("pointerup", () => this.scene.start("GridPreviewScene", { level: this.level + 1 }));

    if (this.level > 1) {
      const prevBtn = this.add
        .text(20, 50, "‹ ANTERIOR", {
          fontFamily: Palette.bodyFont,
          fontSize: "14px",
          color: Palette.textLight,
        })
        .setInteractive({ useHandCursor: true })
        .setDepth(20);
      prevBtn.on("pointerup", () => this.scene.start("GridPreviewScene", { level: this.level - 1 }));
    }

    const regen = this.add
      .text(GameConfig.width - 20, 50, "🔀 Otra distribución", {
        fontFamily: Palette.bodyFont,
        fontSize: "14px",
        color: Palette.textLight,
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(20);
    regen.on("pointerup", () => {
      this.buildLevel();
      this.layoutGrid();
      this.drawGrid();
      this.spawnCars();
      this.refreshInfo();
    });

    this.infoText = this.add
      .text(GameConfig.width / 2, 84, "", {
        fontFamily: Palette.displayFont,
        fontSize: "15px",
        color: Palette.textGold,
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setDepth(20);

    this.floorButton = this.add
      .text(90, 148, "", {
        fontFamily: Palette.displayFont,
        fontSize: "13px",
        color: "#1c1f26",
        backgroundColor: Palette.textGold,
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(20)
      .setVisible(false);
    this.floorButton.on("pointerup", () => {
      this.preview.toggleFloor();
      this.spawnCars();
      this.refreshInfo();
    });

    const playButton = this.add
      .text(GameConfig.width - 90, 148, "▶ JUGAR ESTE NIVEL", {
        fontFamily: Palette.displayFont,
        fontSize: "12px",
        color: "#1c1f26",
        backgroundColor: "#4fd1ff",
        padding: { x: 8, y: 4 },
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(20);
    playButton.on("pointerup", () => {
      RunState.reset();
      LevelState.startNewRun(this.level);
      this.scene.start("ParkingScene");
    });

    this.gridGraphics = this.add.graphics();
    this.lampGraphics = this.add.graphics().setDepth(1);
    ensureObstacleTexture(this);

    this.buildLevel();
    this.layoutGrid();
    this.drawGrid();
    this.spawnCars();
    this.refreshInfo();
  }

  private buildLevel(): void {
    // A throwaway instance, never the real LevelState singleton — reviewing
    // a level here must never disturb an in-progress real run.
    this.preview = new LevelStateManager();
    this.preview.startLevel(this.level);
  }

  private computeCellSize(): number {
    const maxGridWidth = GameConfig.width - 24;
    const maxGridHeight = GameConfig.height - this.offsetY - this.bottomMargin;
    const fit = Math.min(maxGridWidth / this.preview.cols, maxGridHeight / this.preview.rows);
    return Phaser.Math.Clamp(Math.floor(fit), 22, GameConfig.cellSize);
  }

  private layoutGrid(): void {
    this.cellSize = this.computeCellSize();
    this.offsetX = (GameConfig.width - this.preview.cols * this.cellSize) / 2;
  }

  private drawGrid(): void {
    this.gridGraphics.clear();
    const gridW = this.preview.cols * this.cellSize;
    const gridH = this.preview.rows * this.cellSize;

    this.gridGraphics.fillStyle(this.isNight ? Palette.bgAsphalt : 0x9aa0a8, 1);
    this.gridGraphics.fillRect(this.offsetX, this.offsetY, gridW, gridH);
    this.gridGraphics.lineStyle(2, this.isNight ? Palette.wallSolid : 0x6b7178, 1);
    this.gridGraphics.strokeRect(this.offsetX, this.offsetY, gridW, gridH);

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

  private cellCenterX(car: CarInstance): number {
    if (car.orientation === "h") return this.offsetX + (car.col + car.length / 2) * this.cellSize;
    return this.offsetX + (car.col + 0.5) * this.cellSize;
  }

  private cellCenterY(car: CarInstance): number {
    if (car.orientation === "v") return this.offsetY + (car.row + car.length / 2) * this.cellSize;
    return this.offsetY + (car.row + 0.5) * this.cellSize;
  }

  private spawnCars(): void {
    this.carSprites.forEach((s) => s.destroy());
    this.carSprites = [];
    this.badgeTexts.forEach((b) => b.destroy());
    this.badgeTexts = [];
    this.obstacleSprites.forEach((s) => s.destroy());
    this.obstacleSprites = [];

    if (this.preview.activeFloor === 0) {
      for (const cell of this.preview.obstacleCells) {
        const x = this.offsetX + (cell.col + 0.5) * this.cellSize;
        const y = this.offsetY + (cell.row + 0.5) * this.cellSize;
        const sprite = this.add.image(x, y, OBSTACLE_ICON_KEY).setDepth(4);
        sprite.setDisplaySize(this.cellSize - 8, this.cellSize - 8);
        this.obstacleSprites.push(sprite);
      }
    }

    for (const car of this.preview.activeCars) {
      const isBus = car.length === 3;
      const key = isBus ? "vehicle-bus" : `vehicle-car-${car.colorKey}`;
      const sprite = this.add.image(this.cellCenterX(car), this.cellCenterY(car), key).setDepth(5);
      const targetLong = car.length * this.cellSize - 10;
      sprite.setDisplaySize(sprite.width * (targetLong / sprite.height), targetLong);
      sprite.setAngle(angleForCar(car));
      this.carSprites.push(sprite);

      if (car.broken) {
        const badge = this.add
          .text(sprite.x, sprite.y - sprite.displayHeight / 2 - 4, `🔧 ${car.partsHave}/${car.partsNeeded}`, {
            fontFamily: Palette.displayFont,
            fontSize: "11px",
            color: "#1c1f26",
            backgroundColor: "#ffb454",
            padding: { x: 3, y: 1 },
          })
          .setOrigin(0.5, 1)
          .setDepth(6);
        this.badgeTexts.push(badge);
      }
    }
  }

  private refreshInfo(): void {
    const floorLabel = this.preview.floors === 2 ? ` · Piso ${this.preview.activeFloor + 1}/2` : "";
    const partsLabel = this.preview.partsNeededTotal > 0 ? ` · 🔧 ${this.preview.partsNeededTotal} piezas` : "";
    const badges = difficultyBadges(this.level);
    const badgesLine = badges.length > 0 ? `\nModificadores: ${badges.join(" ")}` : "";
    this.infoText.setText(
      `Nivel ${this.level} · ${this.preview.cols}×${this.preview.rows}${floorLabel}\n` +
        `${this.preview.activeCars.length}/${this.preview.visibleCap} visibles · ${this.preview.totalQuota} total · ` +
        `${this.preview.chaseSpeedMult.toFixed(2)}×${partsLabel}${badgesLine}`,
    );
    this.floorButton?.setVisible(this.preview.floors === 2);
    this.floorButton?.setText(this.preview.activeFloor === 0 ? "PISO 1 ▾" : "PISO 2 ▾");
  }
}

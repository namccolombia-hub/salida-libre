import Phaser from "phaser";
import { GameConfig, Palette } from "../config/palette.ts";
import { difficultyBadges } from "../state/LevelState.ts";

// Design-review level picker: lists levels regardless of unlock progress and
// routes to GridPreviewScene (a read-only look, not a real playable attempt).
// Mirrors LevelSelectScene's scroll/tap pattern but never touches RunState
// or the real LevelState singleton.
export class LevelPreviewScene extends Phaser.Scene {
  private readonly gridTop = 110;
  private readonly gridBottom = 780;
  private readonly cols = 5;
  private readonly cellSize = 68;
  private readonly gap = 12;
  private readonly totalShown = 30;

  private container!: Phaser.GameObjects.Container;
  private dragging = false;
  private dragMoved = false;
  private dragStartY = 0;
  private containerStartY = 0;
  private minY = 0;

  constructor() {
    super("LevelPreviewScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(Palette.bgAsphalt);
    this.dragging = false;
    this.dragMoved = false;

    const back = this.add
      .text(20, 24, "‹ VOLVER", {
        fontFamily: Palette.displayFont,
        fontSize: "16px",
        color: Palette.textLight,
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(10);
    back.on("pointerup", () => this.scene.start("MenuScene"));

    this.add
      .text(GameConfig.width / 2, 24, "VISTA PREVIA DE NIVELES", {
        fontFamily: Palette.displayFont,
        fontSize: "16px",
        color: Palette.textGold,
      })
      .setOrigin(0.5, 0)
      .setDepth(10);

    this.add
      .text(GameConfig.width / 2, 46, "Solo para revisar el diseño — no cuenta como jugado", {
        fontFamily: Palette.bodyFont,
        fontSize: "11px",
        color: Palette.textLight,
      })
      .setOrigin(0.5, 0)
      .setDepth(10);

    this.buildGrid();
  }

  private buildGrid(): void {
    const total = this.totalShown;
    const rows = Math.ceil(total / this.cols);
    const gridW = this.cols * this.cellSize + (this.cols - 1) * this.gap;
    const startX = (GameConfig.width - gridW) / 2 + this.cellSize / 2;

    this.container = this.add.container(0, 0);

    for (let n = 1; n <= total; n++) {
      const idx = n - 1;
      const col = idx % this.cols;
      const row = Math.floor(idx / this.cols);
      const x = startX + col * (this.cellSize + this.gap);
      const y = this.gridTop + this.cellSize / 2 + row * (this.cellSize + this.gap);

      const box = this.add
        .rectangle(x, y, this.cellSize, this.cellSize, Palette.bgAsphaltLight, 1)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(2, Palette.wallSolid, 1);

      const label = this.add
        .text(x, y - 6, `${n}`, {
          fontFamily: Palette.displayFont,
          fontSize: "20px",
          color: Palette.textLight,
        })
        .setOrigin(0.5);

      const badgeParts = difficultyBadges(n);
      const items: Phaser.GameObjects.GameObject[] = [box, label];
      if (badgeParts.length > 0) {
        const badge = this.add
          .text(x, y + 17, badgeParts.join(""), {
            fontFamily: Palette.bodyFont,
            fontSize: "9px",
            color: Palette.textLight,
            wordWrap: { width: this.cellSize - 6 },
            align: "center",
          })
          .setOrigin(0.5);
        items.push(badge);
      }

      box.on("pointerup", () => {
        if (this.dragMoved) return;
        this.scene.start("GridPreviewScene", { level: n });
      });

      this.container.add(items);
    }

    const contentHeight = rows * (this.cellSize + this.gap) - this.gap;
    const visibleHeight = this.gridBottom - this.gridTop;
    this.minY = Math.min(0, visibleHeight - contentHeight);
    this.updateVisibility();

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.y < this.gridTop) return;
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

  private updateVisibility(): void {
    const buffer = this.cellSize / 2 + 4;
    for (const child of this.container.list) {
      const obj = child as Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text;
      const worldY = obj.y + this.container.y;
      obj.setVisible(worldY > this.gridTop - buffer && worldY < this.gridBottom + buffer);
    }
  }
}

import Phaser from "phaser";
import { CAR_COLOR_KEYS, GameConfig, Palette, startTheme, isNightTheme } from "../config/palette.ts";
import { RunState } from "../state/RunState.ts";
import { LevelState } from "../state/LevelState.ts";
import { createButton } from "../ui/Button.ts";
import { goTo, fadeIn } from "../fx/sceneTransition.ts";
import { play as playMusic } from "../audio/music.ts";
import { drawVerticalGradient } from "../fx/gradient.ts";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create(): void {
    fadeIn(this);
    playMusic(this, "menu");

    // Day backgrounds are light, so the white/gray text from the night
    // theme would wash out — swap to a dark ink for everything but the
    // gold title, which reads fine against either.
    const inkColor = isNightTheme ? Palette.textLight : "#1c1f26";
    const mutedColor = isNightTheme ? "#8a909c" : "#5a6068";

    drawVerticalGradient(this, GameConfig.width, GameConfig.height, startTheme.top, startTheme.bottom);

    this.buildBackdrop();

    this.add
      .text(GameConfig.width / 2, 190, "SALIDA\nLIBRE", {
        fontFamily: Palette.displayFont,
        fontSize: "56px",
        color: Palette.textGold,
        align: "center",
        lineSpacing: 6,
      })
      .setOrigin(0.5)
      .setDepth(5);

    this.add
      .text(GameConfig.width / 2, 310, "Toca un auto para sacarlo.\nVacía el parqueadero antes de quedarte sin vidas.", {
        fontFamily: Palette.bodyFont,
        fontSize: "18px",
        color: inkColor,
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(5);

    const resuming = LevelState.maxLevelUnlocked > 1;

    const button = createButton(
      this,
      GameConfig.width / 2,
      460,
      240,
      64,
      resuming ? `CONTINUAR · NIVEL ${LevelState.maxLevelUnlocked}` : "JUGAR",
      { fontSize: resuming ? "17px" : "24px" },
    );
    button.container.setDepth(5);

    button.on("pointerup", () => {
      RunState.reset();
      LevelState.startNewRun(LevelState.maxLevelUnlocked);
      goTo(this, "ParkingScene");
    });

    this.tweens.add({
      targets: button.container,
      scale: 1.05,
      duration: 550,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const pickButton = this.add
      .text(GameConfig.width / 2, 528, "Elegir nivel", {
        fontFamily: Palette.bodyFont,
        fontSize: "16px",
        color: inkColor,
      })
      .setOrigin(0.5)
      .setDepth(5)
      .setInteractive({ useHandCursor: true });
    pickButton.on("pointerup", () => goTo(this, "LevelSelectScene"));

    const settingsButton = this.add
      .text(GameConfig.width / 2, 556, "⚙ Configuración", {
        fontFamily: Palette.bodyFont,
        fontSize: "14px",
        color: inkColor,
      })
      .setOrigin(0.5)
      .setDepth(5)
      .setInteractive({ useHandCursor: true });
    settingsButton.on("pointerup", () => goTo(this, "SettingsScene"));

    const previewButton = this.add
      .text(GameConfig.width / 2, 582, "Modo desarrollador: niveles", {
        fontFamily: Palette.bodyFont,
        fontSize: "14px",
        color: mutedColor,
      })
      .setOrigin(0.5)
      .setDepth(5)
      .setInteractive({ useHandCursor: true });
    // Dev-tool navigation intentionally skips the fade — fast browsing matters more there.
    previewButton.on("pointerup", () => this.scene.start("LevelPreviewScene"));
  }

  // A handful of translucent cars drifting across, well behind the title —
  // just ambience, never blocks or competes with the foreground UI.
  private buildBackdrop(): void {
    const rows = [70, 130, 400, 620, 690];
    rows.forEach((y, i) => {
      const colorKey = CAR_COLOR_KEYS[i % CAR_COLOR_KEYS.length];
      const sprite = this.add.image(0, y, `vehicle-car-${colorKey}`).setDepth(0).setAlpha(0.22).setScale(0.16);
      // Same night-contrast fix as the in-game grid: black cars are nearly
      // invisible against a dark background unless lightened.
      if (isNightTheme && colorKey === "black") sprite.setTint(0x9aa4b2);

      const speed = Phaser.Math.FloatBetween(9000, 15000);
      const goingRight = i % 2 === 0;
      sprite.setAngle(goingRight ? 90 : -90);
      const fromX = goingRight ? -40 : GameConfig.width + 40;
      const toX = goingRight ? GameConfig.width + 40 : -40;
      sprite.x = Phaser.Math.Linear(fromX, toX, Math.random());

      this.tweens.add({
        targets: sprite,
        x: toX,
        duration: speed,
        repeat: -1,
        onRepeat: () => {
          sprite.x = fromX;
        },
      });
    });
  }
}

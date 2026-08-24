import Phaser from "phaser";
import { GameConfig, Palette } from "../config/palette.ts";
import { RunState } from "../state/RunState.ts";
import { LevelState } from "../state/LevelState.ts";
import { createButton } from "../ui/Button.ts";
import { goTo, fadeIn } from "../fx/sceneTransition.ts";
import { playGameOver, playLevelComplete } from "../audio/sfx.ts";
import { showRewardedAd } from "../ads/AdService.ts";
import { Capacitor } from "@capacitor/core";

interface GameOverData {
  reason?: "lives" | "finished";
}

export class GameOverScene extends Phaser.Scene {
  private reason: "lives" | "finished" = "lives";

  constructor() {
    super("GameOverScene");
  }

  init(data: GameOverData): void {
    this.reason = data?.reason ?? "lives";
  }

  create(): void {
    this.cameras.main.setBackgroundColor(Palette.bgAsphalt);
    fadeIn(this);

    const finished = this.reason === "finished";
    if (finished) {
      playLevelComplete();
    } else {
      playGameOver();
    }

    this.add
      .text(GameConfig.width / 2, 220, finished ? "¡BIEN HECHO!" : "SIN VIDAS", {
        fontFamily: Palette.displayFont,
        fontSize: "44px",
        color: finished ? Palette.textGold : Palette.textDanger,
      })
      .setOrigin(0.5);

    this.add
      .text(GameConfig.width / 2, 300, "Autos sacados", {
        fontFamily: Palette.bodyFont,
        fontSize: "20px",
        color: Palette.textLight,
      })
      .setOrigin(0.5);

    this.add
      .text(GameConfig.width / 2, 350, `${RunState.score}`, {
        fontFamily: Palette.displayFont,
        fontSize: "64px",
        color: Palette.textGold,
      })
      .setOrigin(0.5);

    const retryLevel = LevelState.level;
    const canRevive = !finished && Capacitor.isNativePlatform();

    if (canRevive) {
      const reviveButton = createButton(this, GameConfig.width / 2, 410, 280, 56, "▶ Ver anuncio por 1 vida extra", {
        fillColor: Palette.laneGold,
        fontSize: "14px",
      });
      reviveButton.on("pointerup", () => {
        void showRewardedAd(() => {
          RunState.lives = 1;
          goTo(this, "ParkingScene");
        });
      });
    }

    const retryY = canRevive ? 490 : 480;
    const button = createButton(this, GameConfig.width / 2, retryY, 240, 64, `REINTENTAR NIVEL ${retryLevel}`, { fontSize: "16px" });
    button.on("pointerup", () => {
      RunState.reset();
      LevelState.startNewRun(retryLevel);
      goTo(this, "ParkingScene");
    });

    const menuLink = this.add
      .text(GameConfig.width / 2, canRevive ? 558 : 548, "Menú / elegir nivel", {
        fontFamily: Palette.bodyFont,
        fontSize: "16px",
        color: Palette.textLight,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    menuLink.on("pointerup", () => goTo(this, "MenuScene"));
  }
}

import Phaser from "phaser";
import { CAR_COLOR_KEYS, GameConfig, startTheme, LANDMARK_KEYS } from "../config/palette.ts";
import { initAds } from "../ads/AdService.ts";
import { initCloudSave } from "../cloud/CloudSave.ts";
import { drawVerticalGradient } from "../fx/gradient.ts";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    CAR_COLOR_KEYS.forEach((c) => {
      this.load.image(`vehicle-car-${c}`, `/assets/vehicles/car_${c}.png`);
      this.load.image(`vehicle-car-rear-${c}`, `/assets/vehicles/car_rear_${c}.png`);
    });
    this.load.image("vehicle-bus", "/assets/vehicles/bus.png");
    this.load.image("vehicle-bus-rear", "/assets/vehicles/bus_rear.png");
    this.load.image("cone", "/assets/obstacles/cone.png");
    this.load.image("pet-dog", "/assets/obstacles/pet-dog.png");
    this.load.image("pet-cat", "/assets/obstacles/pet-cat.png");
    this.load.image("pedestrian-1", "/assets/obstacles/pedestrian-1.png");
    this.load.image("pedestrian-2", "/assets/obstacles/pedestrian-2.png");
    this.load.image("repair-part", "/assets/obstacles/repair-part.png");
    this.load.image("cockpit-frame", "/assets/cockpit/cockpit-frame.png");
    this.load.image("steering-wheel", "/assets/cockpit/steering-wheel.png");

    LANDMARK_KEYS.forEach((key) => {
      this.load.image(`landmark-${key}`, `/assets/landmarks/${key}.png`);
    });

    // Music — CC-BY 3.0 tracks from OpenGameArt.org (see CREDITS.md).
    this.load.audio("music-menu-tropics", "/assets/audio/menu/menu-tropics.mp3");
    this.load.audio("music-grid-puzzle-1a", "/assets/audio/grid/puzzle-1-a.mp3");
    this.load.audio("music-grid-puzzle-1b", "/assets/audio/grid/puzzle-1-b.mp3");
    this.load.audio("music-grid-su-turno", "/assets/audio/grid/su-turno.mp3");
    this.load.audio("music-grid-chill-jungle", "/assets/audio/grid/chill-jungle-ambient.mp3");
    this.load.audio("music-chase-bouncing-baal", "/assets/audio/chase/bouncing-baal.mp3");
    this.load.audio("music-chase-at-last", "/assets/audio/chase/at-last.mp3");
    this.load.audio("music-chase-space-chase", "/assets/audio/chase/space-chase.mp3");
  }

  create(): void {
    // Same warm gradient MenuScene draws — avoids a flat/black frame during
    // the brief font-load wait below.
    drawVerticalGradient(this, GameConfig.width, GameConfig.height, startTheme.top, startTheme.bottom);

    void initAds();
    void initCloudSave();

    // Canvas text is baked at draw time, not reactive like DOM text — if a
    // scene drew with these fonts before the browser finished fetching them,
    // it'd be stuck on the fallback forever. Wait for both here (with a
    // timeout so a slow/blocked font host never hangs the game).
    const fontsReady = Promise.all([document.fonts.load('800 32px "Baloo 2"'), document.fonts.load('600 16px "Nunito"')]).catch(() => undefined);
    const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
    Promise.race([fontsReady, timeout]).then(() => this.scene.start("MenuScene"));
  }
}

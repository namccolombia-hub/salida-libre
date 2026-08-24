import Phaser from "phaser";
import { CAR_COLOR_KEYS, GameConfig, startTheme } from "../config/palette.ts";
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
    this.load.image("cockpit-frame", "/assets/cockpit/cockpit-frame.png");
    this.load.image("steering-wheel", "/assets/cockpit/steering-wheel.png");
  }

  create(): void {
    // Same warm gradient MenuScene draws — avoids a flat/black frame during
    // the brief font-load wait below.
    drawVerticalGradient(this, GameConfig.width, GameConfig.height, startTheme.top, startTheme.bottom);

    void initAds();
    void initCloudSave();

    // Canvas text is baked at draw time, not reactive like DOM text — if a
    // scene drew with "Baloo 2" before the browser finished fetching it,
    // it'd be stuck on the Arial fallback forever. Wait for it here (with a
    // timeout so a slow/blocked font host never hangs the game).
    const fontReady = document.fonts.load('800 32px "Baloo 2"').catch(() => undefined);
    const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
    Promise.race([fontReady, timeout]).then(() => this.scene.start("MenuScene"));
  }
}

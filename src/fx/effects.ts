import Phaser from "phaser";

const SPARK_KEY = "fx-spark";

// A single small circle, generated once and cached — the base particle
// texture for every burst/confetti effect in the game (tinted per call).
export function ensureSparkTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(SPARK_KEY)) return;
  const size = 16;
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(size / 2, size / 2, size / 2 - 1);
  g.generateTexture(SPARK_KEY, size, size);
  g.destroy();
}

/** A short one-color particle burst — collisions, bounces, hits. */
export function burst(scene: Phaser.Scene, x: number, y: number, color: number, count = 12): void {
  ensureSparkTexture(scene);
  const emitter = scene.add.particles(x, y, SPARK_KEY, {
    speed: { min: 80, max: 180 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.9, end: 0 },
    lifespan: { min: 250, max: 420 },
    tint: color,
    blendMode: Phaser.BlendModes.ADD,
  });
  emitter.setDepth(50);
  emitter.explode(count, x, y);
  scene.time.delayedCall(500, () => emitter.destroy());
}

const CONFETTI_COLORS = [0xf4c542, 0x4fd1ff, 0x51cf66, 0xff6b6b, 0xffb454];

/** A bigger, multi-color burst — level complete, a car fully repaired. */
export function confetti(scene: Phaser.Scene, x: number, y: number): void {
  ensureSparkTexture(scene);
  const emitter = scene.add.particles(x, y, SPARK_KEY, {
    speed: { min: 120, max: 260 },
    angle: { min: 0, max: 360 },
    scale: { start: 1, end: 0 },
    lifespan: { min: 500, max: 800 },
    gravityY: 200,
    tint: CONFETTI_COLORS,
  });
  emitter.setDepth(50);
  emitter.explode(28, x, y);
  scene.time.delayedCall(900, () => emitter.destroy());
}

/** A small "+N" (or any short label) that floats up and fades — score feedback. */
export function showFloatingText(scene: Phaser.Scene, x: number, y: number, text: string, color: string): void {
  const label = scene.add
    .text(x, y, text, {
      fontFamily: "Arial Black, Arial",
      fontSize: "18px",
      color,
      stroke: "#1c1f26",
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(50);
  scene.tweens.add({
    targets: label,
    y: y - 42,
    alpha: 0,
    duration: 700,
    ease: "Cubic.easeOut",
    onComplete: () => label.destroy(),
  });
}

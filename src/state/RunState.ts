import { GameConfig } from "../config/palette.ts";

class RunStateManager {
  lives: number = GameConfig.livesMax;
  score = 0;

  reset(): void {
    this.lives = GameConfig.livesMax;
    this.score = 0;
  }

  /** Returns true if this loss brought lives to 0 (game over). */
  loseLife(): boolean {
    this.lives = Math.max(0, this.lives - 1);
    return this.lives <= 0;
  }

  addScore(amount: number): void {
    this.score += amount;
  }
}

export const RunState = new RunStateManager();

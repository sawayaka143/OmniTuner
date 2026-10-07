import { SILENCE_RMS } from './pitch-detection';

export const MIN_GATE_DB = -70;
export const MAX_GATE_DB = 20 * Math.log10(SILENCE_RMS);
export const GATE_MARGIN_DB = 6;
export const FLOOR_RISE_DB_PER_FRAME = 0.07;
export const FLOOR_FALL_RATE = 0.3;

const LEVEL_FLOOR_DB = -120;

export class AdaptiveNoiseGate {
  private floorDb: number | null = null;

  get noiseFloor(): number | null {
    return this.floorDb === null ? null : 10 ** (this.floorDb / 20);
  }

  get gate(): number {
    if (this.floorDb === null) return SILENCE_RMS;
    const gateDb = Math.min(MAX_GATE_DB, Math.max(MIN_GATE_DB, this.floorDb + GATE_MARGIN_DB));
    return 10 ** (gateDb / 20);
  }

  update(level: number, pitched: boolean): void {
    const levelDb = level > 0 ? Math.max(LEVEL_FLOOR_DB, 20 * Math.log10(level)) : LEVEL_FLOOR_DB;

    if (this.floorDb === null) {
      this.floorDb = levelDb;
    } else if (levelDb < this.floorDb) {
      this.floorDb += FLOOR_FALL_RATE * (levelDb - this.floorDb);
    } else if (!pitched) {
      this.floorDb = Math.min(levelDb, this.floorDb + FLOOR_RISE_DB_PER_FRAME);
    }
  }

  reset(): void {
    this.floorDb = null;
  }
}

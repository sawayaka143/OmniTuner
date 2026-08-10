import { Service, signal } from '@angular/core';
import { BASE_ERGONOMICS_WEIGHTS, ErgonomicsWeights } from '../utils/ergonomics';

/** Keys of the ErgonomicsWeights interface — used by the validation guard. */
const WEIGHT_KEYS = [
  'positionPerFret',
  'spanPerFret',
  'indexSpanPerFret',
  'stretchPerFret',
  'barrePerBarre',
  'barreWidthPerString',
  'barreHighFret',
  'openPerString',
  'doublingPerTone',
  'rootDoubleBonus',
  'bassNotRoot',
  'bassStringPerString',
  'stringSkip',
  'thumbFretting',
  'stretchExponent',
  'fretWidthRate',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Pure type guard: does an unknown value satisfy ErgonomicsWeights? */
export function isErgonomicsWeights(value: unknown): value is ErgonomicsWeights {
  if (!isRecord(value)) return false;
  for (const key of WEIGHT_KEYS) {
    const entry = value[key];
    if (typeof entry !== 'number' || !Number.isFinite(entry)) return false;
  }
  return true;
}

/** Shape of the payload produced by scripts/train_model.py. */
interface MlWeightsPayload {
  readonly version: number;
  readonly source: 'ml' | 'fallback';
  readonly weights: ErgonomicsWeights;
}

const isMlWeightsPayload = (value: unknown): value is MlWeightsPayload =>
  isRecord(value) &&
  value['version'] === 1 &&
  (value['source'] === 'ml' || value['source'] === 'fallback') &&
  isErgonomicsWeights(value['weights']);

/**
 * Loads the offline-ML weight payload (src/assets/ml_weights.json, produced by
 * scripts/train_model.py) and exposes it as a signal. Falls back to
 * BASE_ERGONOMICS_WEIGHTS when the fetch fails, the JSON is malformed, or the
 * payload fails validation — the app must never break because of bad weights.
 */
@Service()
export class MlWeightsService {
  private readonly weightsSignal = signal<ErgonomicsWeights>(BASE_ERGONOMICS_WEIGHTS);

  /** The active ergonomics weights (ML-trained when available). */
  readonly weights = this.weightsSignal.asReadonly();

  /** Whether a non-default (ML) payload was successfully loaded. */
  get isMl(): boolean {
    return this.weightsSignal() !== BASE_ERGONOMICS_WEIGHTS;
  }

  private static readonly URL = 'assets/ml_weights.json';

  /** Fetch + validate the payload once. Safe to call multiple times. */
  async load(): Promise<void> {
    if (this.isMl) return; // Already loaded a trained payload.
    try {
      const response = await fetch(MlWeightsService.URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload: unknown = await response.json();
      if (!isMlWeightsPayload(payload)) throw new Error('invalid ml_weights payload');
      this.weightsSignal.set(payload.weights);
      console.info(`[ml-weights] loaded ${payload.source} weights (v${payload.version})`);
    } catch (error) {
      console.warn('[ml-weights] falling back to BASE_ERGONOMICS_WEIGHTS', error);
      this.weightsSignal.set(BASE_ERGONOMICS_WEIGHTS);
    }
  }
}

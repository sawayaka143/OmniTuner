import { TestBed } from '@angular/core/testing';

import { BASE_ERGONOMICS_WEIGHTS } from '../utils/ergonomics';
import { isErgonomicsWeights, MlWeightsService } from './ml-weights-service';

const validWeights = {
  positionPerFret: 0.4,
  spanPerFret: 0.6,
  indexSpanPerFret: 0.8,
  stretchPerFret: 1.0,
  barrePerBarre: 2.0,
  barreWidthPerString: 0.5,
  barreHighFret: 3.0,
  openPerString: -1.0,
  doublingPerTone: -0.5,
  rootDoubleBonus: -0.75,
  bassNotRoot: 1.5,
  bassStringPerString: 0.25,
  stringSkip: 2.5,
  thumbFretting: 4.0,
  stretchExponent: 2.0,
  fretWidthRate: 0.05,
};

describe('isErgonomicsWeights', () => {
  it('accepts a complete, numeric weight set', () => {
    expect(isErgonomicsWeights(validWeights)).toBe(true);
  });

  it('rejects a payload missing a key', () => {
    const { stretchExponent, ...partial } = validWeights;
    expect(isErgonomicsWeights(partial)).toBe(false);
  });

  it('rejects non-numeric values', () => {
    expect(isErgonomicsWeights({ ...validWeights, stringSkip: 'high' })).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isErgonomicsWeights(null)).toBe(false);
    expect(isErgonomicsWeights(42)).toBe(false);
  });
});

describe('MlWeightsService', () => {
  let service: MlWeightsService;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const createService = (): MlWeightsService => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [MlWeightsService] });
    return TestBed.inject(MlWeightsService);
  };

  it('starts from the base weights', () => {
    service = createService();
    expect(service.weights()).toEqual(BASE_ERGONOMICS_WEIGHTS);
    expect(service.isMl).toBe(false);
  });

  it('loads and applies a valid ML payload', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: 1, source: 'ml', weights: validWeights }),
    }) as unknown as typeof fetch;

    service = createService();
    await service.load();
    expect(service.weights()).toEqual(validWeights);
    expect(service.isMl).toBe(true);
  });

  it('falls back to base weights when the payload is invalid', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: 1, source: 'ml', weights: { positionPerFret: 'nope' } }),
    }) as unknown as typeof fetch;

    service = createService();
    await service.load();
    expect(service.weights()).toEqual(BASE_ERGONOMICS_WEIGHTS);
    expect(service.isMl).toBe(false);
  });

  it('falls back to base weights when the fetch fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    service = createService();
    await service.load();
    expect(service.weights()).toEqual(BASE_ERGONOMICS_WEIGHTS);
    expect(service.isMl).toBe(false);
  });
});

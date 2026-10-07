let workspaceSize = 0;
let real = new Float64Array(0);
let imag = new Float64Array(0);
let cosTable = new Float64Array(0);
let sinTable = new Float64Array(0);
let bitReversed = new Uint32Array(0);
let prefixEnergy = new Float64Array(0);

export function differenceFunction(buffer: Float32Array, maxLag: number, out: Float64Array): void {
  const length = buffer.length;
  const window = length - maxLag;
  const size = nextPowerOfTwo(length);
  ensureWorkspace(size, length);

  real.fill(0);
  imag.fill(0);
  prefixEnergy[0] = 0;
  for (let i = 0; i < length; i++) {
    const sample = buffer[i];
    imag[i] = sample;
    prefixEnergy[i + 1] = prefixEnergy[i] + sample * sample;
  }
  for (let i = 0; i < window; i++) {
    real[i] = buffer[i];
  }

  transform(false);
  multiplyByConjugateSplit(size);
  transform(true);

  const windowEnergy = prefixEnergy[window];
  for (let lag = 0; lag <= maxLag; lag++) {
    const shiftedEnergy = prefixEnergy[lag + window] - prefixEnergy[lag];
    const correlation = real[lag] / size;
    out[lag] = Math.max(0, windowEnergy + shiftedEnergy - 2 * correlation);
  }
}

function multiplyByConjugateSplit(size: number): void {
  const half = size >> 1;
  for (let k = 0; k <= half; k++) {
    const mirror = (size - k) & (size - 1);
    const zr = real[k];
    const zi = imag[k];
    const wr = real[mirror];
    const wi = imag[mirror];

    const ar = (zr + wr) / 2;
    const ai = (zi - wi) / 2;
    const br = (zi + wi) / 2;
    const bi = (wr - zr) / 2;

    const pr = ar * br + ai * bi;
    const pi = ar * bi - ai * br;

    real[k] = pr;
    imag[k] = pi;
    real[mirror] = pr;
    imag[mirror] = -pi;
  }
}

function transform(inverse: boolean): void {
  const size = workspaceSize;
  for (let i = 0; i < size; i++) {
    const j = bitReversed[i];
    if (j > i) {
      const tr = real[i];
      real[i] = real[j];
      real[j] = tr;
      const ti = imag[i];
      imag[i] = imag[j];
      imag[j] = ti;
    }
  }

  const direction = inverse ? 1 : -1;
  for (let span = 2; span <= size; span <<= 1) {
    const half = span >> 1;
    const stride = size / span;
    for (let start = 0; start < size; start += span) {
      for (let k = 0; k < half; k++) {
        const wr = cosTable[k * stride];
        const wi = direction * sinTable[k * stride];
        const a = start + k;
        const b = a + half;
        const tr = real[b] * wr - imag[b] * wi;
        const ti = real[b] * wi + imag[b] * wr;
        real[b] = real[a] - tr;
        imag[b] = imag[a] - ti;
        real[a] += tr;
        imag[a] += ti;
      }
    }
  }
}

function ensureWorkspace(size: number, length: number): void {
  if (prefixEnergy.length < length + 1) {
    prefixEnergy = new Float64Array(length + 1);
  }
  if (workspaceSize === size) return;

  workspaceSize = size;
  real = new Float64Array(size);
  imag = new Float64Array(size);
  cosTable = new Float64Array(size >> 1);
  sinTable = new Float64Array(size >> 1);
  for (let k = 0; k < size >> 1; k++) {
    cosTable[k] = Math.cos((2 * Math.PI * k) / size);
    sinTable[k] = Math.sin((2 * Math.PI * k) / size);
  }

  const bits = Math.log2(size);
  bitReversed = new Uint32Array(size);
  for (let i = 0; i < size; i++) {
    let reversed = 0;
    for (let bit = 0; bit < bits; bit++) {
      reversed = (reversed << 1) | ((i >> bit) & 1);
    }
    bitReversed[i] = reversed;
  }
}

function nextPowerOfTwo(value: number): number {
  let size = 1;
  while (size < value) size <<= 1;
  return size;
}

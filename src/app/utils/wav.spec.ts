import { encodeFloatWav } from './wav';

const tagAt = (view: DataView, offset: number): string =>
  String.fromCharCode(...Array.from({ length: 4 }, (_, i) => view.getUint8(offset + i)));

describe('encodeFloatWav', () => {
  it('writes a mono 32-bit float WAV header and the exact samples', () => {
    const samples = Float32Array.from([0, 0.5, -0.25, 1e-6]);
    const view = new DataView(encodeFloatWav(samples, 48000));

    expect(tagAt(view, 0)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(view.byteLength - 8);
    expect(tagAt(view, 8)).toBe('WAVE');
    expect(tagAt(view, 12)).toBe('fmt ');
    expect(view.getUint16(20, true)).toBe(3);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint32(28, true)).toBe(192000);
    expect(view.getUint16(34, true)).toBe(32);
    expect(tagAt(view, 36)).toBe('data');
    expect(view.getUint32(40, true)).toBe(16);
    expect(Array.from({ length: 4 }, (_, i) => view.getFloat32(44 + i * 4, true))).toEqual(
      Array.from(samples),
    );
  });

  it('embeds a comment in a LIST/INFO chunk before the data', () => {
    const comment = '{"note":"E2"}';
    const view = new DataView(encodeFloatWav(Float32Array.from([0.1]), 44100, comment));

    expect(tagAt(view, 36)).toBe('LIST');
    const listSize = view.getUint32(40, true);
    expect(tagAt(view, 44)).toBe('INFO');
    expect(tagAt(view, 48)).toBe('ICMT');
    const textSize = view.getUint32(52, true);
    const text = new TextDecoder().decode(new Uint8Array(view.buffer, 56, textSize - 1));
    expect(text).toBe(comment);

    const dataOffset = 44 + listSize;
    expect(listSize % 2).toBe(0);
    expect(tagAt(view, dataOffset)).toBe('data');
    expect(view.getFloat32(dataOffset + 8, true)).toBeCloseTo(0.1, 6);
    expect(view.getUint32(4, true)).toBe(view.byteLength - 8);
  });
});

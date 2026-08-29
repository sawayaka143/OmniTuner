import { describe, expect, it } from 'vitest';
import { parseColorInput } from './color-input';

describe('parseColorInput', () => {
  it('parses long hex with or without the hash', () => {
    expect(parseColorInput('#ff0000')).toBe('#ff0000');
    expect(parseColorInput('FF0000')).toBe('#ff0000');
    expect(parseColorInput('#EDE8D0')).toBe('#ede8d0');
  });

  it('parses short hex and expands it', () => {
    expect(parseColorInput('#f00')).toBe('#ff0000');
    expect(parseColorInput('abc')).toBe('#aabbcc');
  });

  it('parses comma-separated RGB triplets', () => {
    expect(parseColorInput('255, 255, 0')).toBe('#ffff00');
    expect(parseColorInput('255,255,0')).toBe('#ffff00');
    expect(parseColorInput('0; 128; 255')).toBe('#0080ff');
  });

  it('parses rgb() notation', () => {
    expect(parseColorInput('rgb(255, 255, 0)')).toBe('#ffff00');
    expect(parseColorInput('rgb(255 255 0)')).toBe('#ffff00');
    expect(parseColorInput('RGB(0, 0, 0)')).toBe('#000000');
  });

  it('parses space-separated triplets', () => {
    expect(parseColorInput('255 255 0')).toBe('#ffff00');
  });

  it('rejects empty and malformed input', () => {
    expect(parseColorInput('')).toBeNull();
    expect(parseColorInput('   ')).toBeNull();
    expect(parseColorInput('ff')).toBeNull();
    expect(parseColorInput('#ff00')).toBeNull();
    expect(parseColorInput('#ff000')).toBeNull();
    expect(parseColorInput('red')).toBeNull();
  });

  it('rejects out-of-range channels', () => {
    expect(parseColorInput('256, 0, 0')).toBeNull();
    expect(parseColorInput('rgb(300, 0, 0)')).toBeNull();
    expect(parseColorInput('-1, 0, 0')).toBeNull();
  });
});

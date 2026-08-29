const HEX_SHORT = /^#?([0-9a-f]{3})$/i;
const HEX_LONG = /^#?([0-9a-f]{6})$/i;
const RGB_FUNCTION = /^rgb\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)$/i;
const RGB_TRIPLET = /^(\d{1,3})\s*[,;]\s*(\d{1,3})\s*[,;]\s*(\d{1,3})$/;
const RGB_SPACED = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/;

const MAX_CHANNEL = 255;

const hexToRgb = (hex: string): readonly [number, number, number] => {
  const value = Number.parseInt(hex, 16);
  if (hex.length === 3) {
    return [
      ((value >> 8) & 0xf) * 17,
      ((value >> 4) & 0xf) * 17,
      (value & 0xf) * 17,
    ];
  }
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
};

const channelsToHex = (channels: readonly number[]): string =>
  `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;

const parseRgb = (parts: readonly string[]): string | null => {
  const channels = parts.map((part) => Number.parseInt(part, 10));
  if (channels.some((channel) => !Number.isInteger(channel) || channel < 0 || channel > MAX_CHANNEL)) {
    return null;
  }
  return channelsToHex(channels);
};

export function parseColorInput(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const hexLong = HEX_LONG.exec(value);
  if (hexLong) return channelsToHex(hexToRgb(hexLong[1].toLowerCase()));

  const hexShort = HEX_SHORT.exec(value);
  if (hexShort) return channelsToHex(hexToRgb(hexShort[1].toLowerCase()));

  const rgbFunction = RGB_FUNCTION.exec(value);
  if (rgbFunction) return parseRgb([rgbFunction[1], rgbFunction[2], rgbFunction[3]]);

  const triplet = RGB_TRIPLET.exec(value);
  if (triplet) return parseRgb([triplet[1], triplet[2], triplet[3]]);

  const spaced = RGB_SPACED.exec(value);
  if (spaced) return parseRgb([spaced[1], spaced[2], spaced[3]]);

  return null;
}

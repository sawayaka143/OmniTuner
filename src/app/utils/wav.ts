const IEEE_FLOAT_FORMAT = 3;
const BYTES_PER_SAMPLE = 4;

export function encodeFloatWav(
  samples: Float32Array,
  sampleRate: number,
  comment = '',
): ArrayBuffer {
  const commentBytes = new TextEncoder().encode(comment);
  const commentSize = commentBytes.length + 1;
  const commentPadded = commentSize + (commentSize % 2);
  const infoSize = comment ? 4 + 8 + commentPadded : 0;
  const listChunkSize = comment ? 8 + infoSize : 0;
  const dataSize = samples.length * BYTES_PER_SAMPLE;
  const totalSize = 12 + 24 + listChunkSize + 8 + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  let offset = 0;

  const writeTag = (tag: string): void => {
    for (let i = 0; i < 4; i++) view.setUint8(offset + i, tag.charCodeAt(i));
    offset += 4;
  };
  const writeUint32 = (value: number): void => {
    view.setUint32(offset, value, true);
    offset += 4;
  };
  const writeUint16 = (value: number): void => {
    view.setUint16(offset, value, true);
    offset += 2;
  };

  writeTag('RIFF');
  writeUint32(totalSize - 8);
  writeTag('WAVE');

  writeTag('fmt ');
  writeUint32(16);
  writeUint16(IEEE_FLOAT_FORMAT);
  writeUint16(1);
  writeUint32(sampleRate);
  writeUint32(sampleRate * BYTES_PER_SAMPLE);
  writeUint16(BYTES_PER_SAMPLE);
  writeUint16(BYTES_PER_SAMPLE * 8);

  if (comment) {
    writeTag('LIST');
    writeUint32(infoSize);
    writeTag('INFO');
    writeTag('ICMT');
    writeUint32(commentSize);
    new Uint8Array(buffer, offset, commentBytes.length).set(commentBytes);
    offset += commentPadded;
  }

  writeTag('data');
  writeUint32(dataSize);
  for (let i = 0; i < samples.length; i++) {
    view.setFloat32(offset, samples[i], true);
    offset += BYTES_PER_SAMPLE;
  }

  return buffer;
}

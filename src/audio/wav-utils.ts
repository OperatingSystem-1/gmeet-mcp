/**
 * WAV file utilities for generating audio files compatible with
 * Chromium's --use-file-for-fake-audio-capture flag.
 *
 * Chrome expects: 16-bit PCM, mono, 48000 Hz WAV.
 */

const SAMPLE_RATE = 48000;
const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;

export function createWavHeader(dataLength: number): Buffer {
  const header = Buffer.alloc(44);

  // RIFF header
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);

  // fmt chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(NUM_CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * BYTES_PER_SAMPLE, 28); // byte rate
  header.writeUInt16LE(NUM_CHANNELS * BYTES_PER_SAMPLE, 32); // block align
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);

  // data chunk
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);

  return header;
}

export function createSilentWav(durationSeconds: number): Buffer {
  const numSamples = Math.floor(SAMPLE_RATE * durationSeconds);
  const dataLength = numSamples * BYTES_PER_SAMPLE;
  const header = createWavHeader(dataLength);
  const data = Buffer.alloc(dataLength); // zeros = silence

  return Buffer.concat([header, data]);
}

export function pcmToWav(pcmData: Buffer): Buffer {
  const header = createWavHeader(pcmData.length);
  return Buffer.concat([header, pcmData]);
}

export function estimateDuration(wavBuffer: Buffer): number {
  if (wavBuffer.length < 44) return 0;
  const dataLength = wavBuffer.length - 44;
  return dataLength / (SAMPLE_RATE * BYTES_PER_SAMPLE);
}

export { SAMPLE_RATE, BITS_PER_SAMPLE, NUM_CHANNELS };

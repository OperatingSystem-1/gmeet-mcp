import type { BrowserContext, Page } from "playwright-core";
import { logger } from "../utils/logger.js";

/**
 * The init script that monkey-patches getUserMedia BEFORE Meet loads.
 * It intercepts the mic stream request and returns a MediaStreamDestination
 * we control. When we want to "speak", we decode WAV audio and play it
 * through that destination — which flows into WebRTC → other participants.
 */
const AUDIO_INIT_SCRIPT = `
(function() {
  // Save original
  const _origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  // Lazy-init audio context (Chrome requires user gesture, but fake-ui flag bypasses)
  let _ctx = null;
  let _dest = null;
  let _gain = null;

  function ensureCtx() {
    if (!_ctx) {
      _ctx = new AudioContext({ sampleRate: 48000 });
      _dest = _ctx.createMediaStreamDestination();
      _gain = _ctx.createGain();
      _gain.gain.value = 1.0;
      _gain.connect(_dest);
    }
    if (_ctx.state === 'suspended') _ctx.resume();
    return { ctx: _ctx, dest: _dest, gain: _gain };
  }

  // Monkey-patch getUserMedia
  navigator.mediaDevices.getUserMedia = async function(constraints) {
    if (constraints && constraints.audio) {
      const { dest } = ensureCtx();
      const audioTracks = dest.stream.getAudioTracks();

      if (constraints.video) {
        // Get video from original, combine with our audio
        try {
          const vidStream = await _origGetUserMedia({ video: constraints.video });
          return new MediaStream([...audioTracks, ...vidStream.getVideoTracks()]);
        } catch(e) {
          return new MediaStream(audioTracks);
        }
      }
      return new MediaStream(audioTracks);
    }
    return _origGetUserMedia(constraints);
  };

  // Also patch enumerateDevices to report a fake mic so Meet shows mic controls
  const _origEnumDevices = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
  navigator.mediaDevices.enumerateDevices = async function() {
    const devices = await _origEnumDevices();
    // If no audio input, add a fake one
    const hasAudioInput = devices.some(d => d.kind === 'audioinput');
    if (!hasAudioInput) {
      devices.push({
        deviceId: 'gmeet-mcp-mic',
        groupId: 'gmeet-mcp',
        kind: 'audioinput',
        label: 'gmeet-mcp Virtual Microphone',
        toJSON() { return this; }
      });
    }
    return devices;
  };

  // Expose: play a base64-encoded WAV and return duration
  window.__gmeetPlayAudio = async function(base64Wav) {
    const { ctx, gain } = ensureCtx();

    // Decode base64 → ArrayBuffer
    const bin = atob(base64Wav);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    // Decode audio
    const audioBuf = await ctx.decodeAudioData(bytes.buffer.slice(0));

    // Play through gain → dest → MediaStream → WebRTC → participants
    return new Promise(function(resolve, reject) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = audioBuf;
        src.connect(gain);
        src.onended = function() { resolve(audioBuf.duration); };
        src.start();
      } catch(e) {
        reject(e);
      }
    });
  };

  // Expose: check readiness
  window.__gmeetAudioReady = function() {
    return {
      hasContext: !!_ctx,
      state: _ctx ? _ctx.state : 'none',
      tracks: _dest ? _dest.stream.getAudioTracks().length : 0
    };
  };
})();
`;

/**
 * Injects the audio stream monkey-patch into a browser context.
 * Must be called BEFORE navigating to Meet.
 */
export async function injectAudioStream(context: BrowserContext): Promise<void> {
  await context.addInitScript(AUDIO_INIT_SCRIPT);
  logger.info("Audio stream init script injected into context");
}

/**
 * Play a WAV buffer through the injected audio stream.
 * Returns the duration in seconds.
 */
export async function playAudioInPage(page: Page, wavBuffer: Buffer): Promise<number> {
  const base64 = wavBuffer.toString("base64");

  // Ensure AudioContext is running
  await page.evaluate(() => {
    const ready = (window as any).__gmeetAudioReady?.();
    if (ready?.state === "suspended") {
      // Try to resume
    }
  });

  const duration = await page.evaluate(async (b64: string) => {
    const playFn = (window as any).__gmeetPlayAudio;
    if (!playFn) throw new Error("Audio stream not initialized — __gmeetPlayAudio not found");
    return await playFn(b64);
  }, base64);

  return duration as number;
}

/**
 * Check if the audio stream is ready in the page.
 */
export async function isAudioReady(page: Page): Promise<boolean> {
  try {
    const result = await page.evaluate(() => {
      return (window as any).__gmeetAudioReady?.() ?? null;
    });
    return result?.hasContext && result?.tracks > 0;
  } catch {
    return false;
  }
}

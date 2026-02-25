import type { BrowserContext, Page } from "playwright-core";
import { logger } from "../utils/logger.js";

/**
 * Init script: tracks all RTCPeerConnection instances so we can
 * find and replace their audio tracks after joining a meeting.
 * Does NOT touch getUserMedia — lets Meet set up normally.
 */
const TRACK_RTC_SCRIPT = `
(function() {
  window.__rtcConnections = [];
  const _OrigRTC = window.RTCPeerConnection;

  window.RTCPeerConnection = function() {
    const pc = new _OrigRTC(...arguments);
    window.__rtcConnections.push(pc);
    return pc;
  };
  window.RTCPeerConnection.prototype = _OrigRTC.prototype;

  // Copy static properties
  Object.keys(_OrigRTC).forEach(function(k) {
    try { window.RTCPeerConnection[k] = _OrigRTC[k]; } catch(e) {}
  });
})();
`;

/**
 * Inject the RTC tracker before any page loads.
 */
export async function injectAudioStream(context: BrowserContext): Promise<void> {
  await context.addInitScript(TRACK_RTC_SCRIPT);
  logger.info("RTC tracker init script injected");
}

/**
 * After joining the meeting, take over the audio track on the
 * RTCPeerConnection by replacing it with a MediaStreamDestination
 * we control via Web Audio API.
 */
export async function takeOverAudioTrack(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const pcs = (window as any).__rtcConnections as RTCPeerConnection[] | undefined;
    if (!pcs || pcs.length === 0) return { error: "No RTCPeerConnections found" };

    // Find the connection that has an audio sender
    let audioSender: RTCRtpSender | null = null;
    let activePc: RTCPeerConnection | null = null;

    for (const pc of pcs) {
      if (pc.connectionState === "closed") continue;
      const senders = pc.getSenders();
      for (const s of senders) {
        if (s.track && s.track.kind === "audio") {
          audioSender = s;
          activePc = pc;
          break;
        }
      }
      if (audioSender) break;
    }

    if (!audioSender || !activePc) {
      return { error: "No audio sender found on any RTCPeerConnection" };
    }

    // Create our audio pipeline
    const ctx = new AudioContext({ sampleRate: 48000 });
    const dest = ctx.createMediaStreamDestination();
    const gain = ctx.createGain();
    gain.gain.value = 1.0;
    gain.connect(dest);

    // Replace the audio track on the sender
    const newTrack = dest.stream.getAudioTracks()[0];
    audioSender.replaceTrack(newTrack);

    // Store globally for playback
    (window as any).__gmeetAudioCtx = ctx;
    (window as any).__gmeetAudioGain = gain;
    (window as any).__gmeetAudioDest = dest;

    // Expose play function
    (window as any).__gmeetPlayAudio = async function (base64Wav: string): Promise<number> {
      const ctx = (window as any).__gmeetAudioCtx as AudioContext;
      const gain = (window as any).__gmeetAudioGain as GainNode;

      if (ctx.state === "suspended") await ctx.resume();

      // Decode base64 → ArrayBuffer
      const bin = atob(base64Wav);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

      const audioBuf = await ctx.decodeAudioData(bytes.buffer.slice(0));

      return new Promise<number>((resolve, reject) => {
        try {
          const src = ctx.createBufferSource();
          src.buffer = audioBuf;
          src.connect(gain);
          src.onended = () => resolve(audioBuf.duration);
          src.start();
        } catch (e: any) {
          reject(e);
        }
      });
    };

    // Expose readiness check
    (window as any).__gmeetAudioReady = function () {
      const ctx = (window as any).__gmeetAudioCtx as AudioContext;
      const dest = (window as any).__gmeetAudioDest as MediaStreamAudioDestinationNode;
      return {
        hasContext: !!ctx,
        state: ctx ? ctx.state : "none",
        tracks: dest ? dest.stream.getAudioTracks().length : 0,
        pcState: activePc!.connectionState,
      };
    };

    return {
      ok: true,
      pcState: activePc.connectionState,
      audioCtxState: ctx.state,
      trackId: newTrack.id,
    };
  });

  if ("error" in result) {
    logger.error("Failed to take over audio track", { error: result.error });
    throw new Error(result.error as string);
  }

  logger.info("Audio track replaced on RTCPeerConnection", result as Record<string, unknown>);
}

/**
 * Play a WAV buffer through the injected audio stream.
 * Returns the duration in seconds.
 */
export async function playAudioInPage(page: Page, wavBuffer: Buffer): Promise<number> {
  const base64 = wavBuffer.toString("base64");

  const duration = await page.evaluate(async (b64: string) => {
    const playFn = (window as any).__gmeetPlayAudio;
    if (!playFn) throw new Error("Audio not initialized — call takeOverAudioTrack first");
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

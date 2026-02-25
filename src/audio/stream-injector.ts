import type { BrowserContext, Page } from "playwright-core";
import { logger } from "../utils/logger.js";

/**
 * Init script: tracks all RTCPeerConnection instances so we can
 * find and replace their audio tracks after joining a meeting.
 * Uses Proxy for transparent wrapping that preserves instanceof checks.
 */
const TRACK_RTC_SCRIPT = `
(function() {
  window.__rtcConnections = [];
  const _OrigRTC = window.RTCPeerConnection;

  window.RTCPeerConnection = new Proxy(_OrigRTC, {
    construct(target, args) {
      const pc = new target(...args);
      window.__rtcConnections.push(pc);
      return pc;
    },
    apply(target, thisArg, args) {
      return target.apply(thisArg, args);
    }
  });

  // Preserve prototype chain for instanceof checks
  window.RTCPeerConnection.prototype = _OrigRTC.prototype;
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
 *
 * Uses async evaluate to properly await replaceTrack().
 */
export async function takeOverAudioTrack(page: Page): Promise<void> {
  // Wait a moment for WebRTC connections to stabilize
  await page.waitForTimeout(2000);

  const result = await page.evaluate(async () => {
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
      // Also try connections without filtering on track existence —
      // the sender might exist but have a null track (muted state)
      for (const pc of pcs) {
        if (pc.connectionState === "closed") continue;
        const senders = pc.getSenders();
        for (const s of senders) {
          if (s.track === null || (s.track && s.track.kind === "audio")) {
            audioSender = s;
            activePc = pc;
            break;
          }
        }
        if (audioSender) break;
      }
    }

    if (!audioSender || !activePc) {
      return {
        error: "No audio sender found on any RTCPeerConnection",
        pcCount: pcs.length,
        pcStates: pcs.map(pc => ({
          state: pc.connectionState,
          senderCount: pc.getSenders().length,
          senderKinds: pc.getSenders().map(s => s.track?.kind ?? "null"),
        })),
      };
    }

    // Create our audio pipeline
    const ctx = new AudioContext({ sampleRate: 48000 });
    // Resume context immediately (Chrome may start it suspended)
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const dest = ctx.createMediaStreamDestination();
    const gain = ctx.createGain();
    gain.gain.value = 1.0;
    gain.connect(dest);

    // Replace the audio track on the sender — MUST await this
    const newTrack = dest.stream.getAudioTracks()[0];
    await audioSender.replaceTrack(newTrack);

    // Store globally for playback
    (window as any).__gmeetAudioCtx = ctx;
    (window as any).__gmeetAudioGain = gain;
    (window as any).__gmeetAudioDest = dest;
    (window as any).__gmeetAudioSender = audioSender;

    // Function to ensure our track is still on the sender (Meet may swap it back)
    (window as any).__gmeetEnsureTrack = async function(): Promise<boolean> {
      const sender = (window as any).__gmeetAudioSender as RTCRtpSender;
      const dest = (window as any).__gmeetAudioDest as MediaStreamAudioDestinationNode;
      if (!sender || !dest) return false;

      const ourTrack = dest.stream.getAudioTracks()[0];
      if (!ourTrack) return false;

      // If sender's track isn't ours, re-inject
      if (sender.track !== ourTrack) {
        await sender.replaceTrack(ourTrack);
        console.log("[gmeet-mcp] Re-injected audio track onto sender");
        return true;
      }
      return false;
    };

    // Expose play function
    (window as any).__gmeetPlayAudio = async function (base64Wav: string): Promise<number> {
      const ctx = (window as any).__gmeetAudioCtx as AudioContext;
      const gain = (window as any).__gmeetAudioGain as GainNode;

      if (!ctx || !gain) throw new Error("Audio context not initialized");

      // Ensure AudioContext is running
      if (ctx.state === "suspended") await ctx.resume();

      // Ensure our track is still on the WebRTC sender
      await (window as any).__gmeetEnsureTrack();

      // Decode base64 → ArrayBuffer
      const bin = atob(base64Wav);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

      const audioBuf = await ctx.decodeAudioData(bytes.buffer.slice(0) as ArrayBuffer);

      return new Promise<number>((resolve, reject) => {
        try {
          const src = ctx.createBufferSource();
          src.buffer = audioBuf;
          src.connect(gain);
          src.onended = () => resolve(audioBuf.duration);
          src.start();
          console.log("[gmeet-mcp] Playing audio buffer", audioBuf.duration, "seconds");
        } catch (e: any) {
          reject(e);
        }
      });
    };

    // Expose readiness check
    (window as any).__gmeetAudioReady = function () {
      const ctx = (window as any).__gmeetAudioCtx as AudioContext;
      const dest = (window as any).__gmeetAudioDest as MediaStreamAudioDestinationNode;
      const sender = (window as any).__gmeetAudioSender as RTCRtpSender;
      return {
        hasContext: !!ctx,
        contextState: ctx ? ctx.state : "none",
        destTracks: dest ? dest.stream.getAudioTracks().length : 0,
        senderTrackId: sender?.track?.id ?? "none",
        destTrackId: dest?.stream.getAudioTracks()[0]?.id ?? "none",
        tracksMatch: sender?.track?.id === dest?.stream.getAudioTracks()[0]?.id,
        pcState: activePc!.connectionState,
      };
    };

    return {
      ok: true,
      pcState: activePc.connectionState,
      audioCtxState: ctx.state,
      trackId: newTrack.id,
      senderTrackBefore: audioSender.track?.id ?? "null",
      pcCount: pcs.length,
    };
  });

  if ("error" in result) {
    logger.error("Failed to take over audio track", result as Record<string, unknown>);
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

  // First check audio readiness
  const ready = await page.evaluate(() => {
    return (window as any).__gmeetAudioReady?.() ?? null;
  });

  if (ready) {
    logger.info("Audio state before playback", ready as Record<string, unknown>);
  }

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
    return result?.hasContext && result?.destTracks > 0 && result?.tracksMatch;
  } catch {
    return false;
  }
}

/**
 * Get detailed audio diagnostics from the page.
 */
export async function getAudioDiagnostics(page: Page): Promise<Record<string, unknown> | null> {
  try {
    return await page.evaluate(() => {
      const ready = (window as any).__gmeetAudioReady?.();
      const pcs = (window as any).__rtcConnections as RTCPeerConnection[] | undefined;

      return {
        ...(ready ?? {}),
        rtcConnectionCount: pcs?.length ?? 0,
        connections: pcs?.map(pc => ({
          state: pc.connectionState,
          iceState: pc.iceConnectionState,
          senders: pc.getSenders().map(s => ({
            kind: s.track?.kind ?? "null",
            enabled: s.track?.enabled ?? false,
            muted: s.track?.muted ?? false,
            readyState: s.track?.readyState ?? "none",
            trackId: s.track?.id ?? "null",
          })),
        })) ?? [],
      };
    });
  } catch {
    return null;
  }
}

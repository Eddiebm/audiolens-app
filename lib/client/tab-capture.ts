/** Shown when user picks window/monitor instead of a browser tab. */
export const TAB_ONLY_REJECT_MESSAGE =
  "Pick the YouTube TAB only — not Entire Screen or Window. Other sounds are included with screen share.";

export type DisplaySurface = "browser" | "window" | "monitor" | "unknown";

type DisplayMediaWithTabPrefs = DisplayMediaStreamOptions & {
  preferCurrentTab?: boolean;
  controller?: object;
};

export function getVideoDisplaySurface(stream: MediaStream): DisplaySurface {
  const video = stream.getVideoTracks()[0];
  if (!video) return "unknown";
  const settings = video.getSettings() as MediaTrackSettings & {
    displaySurface?: string;
  };
  const ds = settings.displaySurface;
  if (ds === "browser" || ds === "window" || ds === "monitor") {
    return ds;
  }
  return "unknown";
}

export function stopMediaStream(stream: MediaStream): void {
  stream.getTracks().forEach((t) => t.stop());
}

export function validateBrowserTabSurface(
  stream: MediaStream
): { ok: true } | { ok: false; surface: DisplaySurface } {
  const surface = getVideoDisplaySurface(stream);
  if (surface === "browser") return { ok: true };
  return { ok: false, surface };
}

function tabOnlyDisplayConstraints(): DisplayMediaWithTabPrefs {
  const constraints: DisplayMediaWithTabPrefs = {
    video: true,
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      sampleRate: 44100,
    },
  };

  if (typeof window !== "undefined" && "CaptureController" in window) {
    try {
      const CaptureControllerCtor = (
        window as Window & {
          CaptureController?: new () => object;
        }
      ).CaptureController;
      constraints.preferCurrentTab = true;
      if (CaptureControllerCtor) {
        constraints.controller = new CaptureControllerCtor();
      }
    } catch {
      constraints.preferCurrentTab = true;
    }
  } else {
    constraints.preferCurrentTab = true;
  }

  return constraints;
}

/** Tab-only getDisplayMedia — no silent fallback to screen/window. */
export async function requestTabDisplayMedia(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error(
      "Screen capture is not supported. Use Chrome or Edge on desktop."
    );
  }
  return navigator.mediaDevices.getDisplayMedia(tabOnlyDisplayConstraints());
}

export function multipleAudioTracksWarning(stream: MediaStream): string | null {
  const n = stream.getAudioTracks().length;
  if (n > 1) {
    return `Unusual: ${n} audio tracks in this capture. If transcription sounds wrong, re-share a single tab with tab audio only.`;
  }
  return null;
}

import {
  DEFAULT_SILENCE_AUTO_STOP_MS,
  DEFAULT_SILENCE_RMS_THRESHOLD,
} from "@/lib/capture-config";

export type SilenceMonitorOptions = {
  rmsThreshold?: number;
  silenceDurationMs?: number;
  onSilenceAutoStop: () => void;
};

/** Attach Web Audio RMS monitor; calls onSilenceAutoStop after sustained silence */
export function createSilenceMonitor(
  stream: MediaStream,
  options: SilenceMonitorOptions
): () => void {
  const threshold = options.rmsThreshold ?? DEFAULT_SILENCE_RMS_THRESHOLD;
  const silenceDurationMs =
    options.silenceDurationMs ?? DEFAULT_SILENCE_AUTO_STOP_MS;

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const data = new Float32Array(analyser.fftSize);
  let silentSince: number | null = null;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);

    if (rms < threshold) {
      if (silentSince === null) silentSince = Date.now();
      else if (Date.now() - silentSince >= silenceDurationMs) {
        stopped = true;
        options.onSilenceAutoStop();
        cleanup();
        return;
      }
    } else {
      silentSince = null;
    }
    requestAnimationFrame(tick);
  };

  const cleanup = () => {
    stopped = true;
    source.disconnect();
    void ctx.close();
  };

  requestAnimationFrame(tick);
  return cleanup;
}

/** Measure RMS over a short window for pre-flight */
export async function measureStreamRms(
  stream: MediaStream,
  durationMs: number
): Promise<number> {
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  const data = new Float32Array(analyser.fftSize);

  const samples: number[] = [];
  const end = Date.now() + durationMs;

  await new Promise<void>((resolve) => {
    const sample = () => {
      if (Date.now() >= end) {
        resolve();
        return;
      }
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      samples.push(Math.sqrt(sum / data.length));
      requestAnimationFrame(sample);
    };
    sample();
  });

  source.disconnect();
  await ctx.close();

  if (samples.length === 0) return 0;
  return Math.max(...samples);
}

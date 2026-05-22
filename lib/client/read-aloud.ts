"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ReadAloudRate = 1 | 1.25 | 1.5 | 1.75 | 2;

export type ReadAloudSegment = {
  label?: string;
  text: string;
};

function pickEnUsVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "en-US") ??
    voices.find((v) => v.lang.startsWith("en-US")) ??
    voices.find((v) => v.lang.startsWith("en")) ??
    voices[0] ??
    null
  );
}

function buildUtterance(
  text: string,
  voice: SpeechSynthesisVoice | null,
  rate: ReadAloudRate
): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "en-US";
  u.rate = rate;
  return u;
}

export function useReadAloud() {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState<ReadAloudRate>(1.25);
  const [voicesReady, setVoicesReady] = useState(false);
  const indexRef = useRef(0);
  const segmentsRef = useRef<ReadAloudSegment[]>([]);
  const rateRef = useRef(rate);

  rateRef.current = rate;

  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const onVoices = () => setVoicesReady(true);
    onVoices();
    synth.addEventListener("voiceschanged", onVoices);
    return () => synth.removeEventListener("voiceschanged", onVoices);
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    indexRef.current = 0;
    segmentsRef.current = [];
    setSpeaking(false);
    setPaused(false);
  }, [supported]);

  const speakNext = useCallback(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const idx = indexRef.current;
    const segments = segmentsRef.current;
    if (idx >= segments.length) {
      setSpeaking(false);
      setPaused(false);
      return;
    }
    const seg = segments[idx];
    const prefix = seg.label ? `${seg.label}. ` : "";
    const voice = pickEnUsVoice();
    const utterance = buildUtterance(
      `${prefix}${seg.text}`,
      voice,
      rateRef.current
    );
    utterance.onend = () => {
      indexRef.current += 1;
      speakNext();
    };
    utterance.onerror = () => {
      indexRef.current += 1;
      speakNext();
    };
    synth.speak(utterance);
  }, [supported]);

  const start = useCallback(
    (segments: ReadAloudSegment[]) => {
      if (!supported) return;
      const filtered = segments
        .map((s) => ({ ...s, text: s.text.trim() }))
        .filter((s) => s.text.length > 0);
      if (filtered.length === 0) return;
      stop();
      segmentsRef.current = filtered;
      indexRef.current = 0;
      setSpeaking(true);
      setPaused(false);
      speakNext();
    },
    [supported, speakNext, stop]
  );

  const togglePause = useCallback(() => {
    if (!supported || !speaking) return;
    const synth = window.speechSynthesis;
    if (paused) {
      synth.resume();
      setPaused(false);
    } else {
      synth.pause();
      setPaused(true);
    }
  }, [supported, speaking, paused]);

  useEffect(() => () => stop(), [stop]);

  return {
    supported,
    voicesReady,
    speaking,
    paused,
    rate,
    setRate,
    start,
    stop,
    togglePause,
  };
}

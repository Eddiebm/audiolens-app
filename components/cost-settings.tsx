"use client";

import { resetCostCounter } from "@/lib/cost-storage";
import { useState } from "react";

type CostSettingsProps = {
  onReset?: () => void;
};

export function CostSettings({ onReset }: CostSettingsProps) {
  const [confirming, setConfirming] = useState(false);

  const handleReset = () => {
    resetCostCounter();
    setConfirming(false);
    window.dispatchEvent(new Event("audiolens:cost-updated"));
    onReset?.();
  };

  return (
    <section className="rounded-xl border border-white/10 p-5 text-sm">
      <h2 className="font-semibold text-zinc-200">Cost counter</h2>
      <p className="mt-2 text-zinc-400">
        Running total and per-session log are stored in this browser only (
        <code className="text-cyan-300/80">localStorage</code>).
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 rounded-lg border border-rose-500/30 px-4 py-2 text-rose-200/90 hover:bg-rose-500/10"
        >
          Reset cost counter
        </button>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-zinc-400">Clear all-time total and session log?</span>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg bg-rose-600 px-4 py-2 font-medium text-white hover:bg-rose-500"
          >
            Yes, reset
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-lg px-4 py-2 text-zinc-500 hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}

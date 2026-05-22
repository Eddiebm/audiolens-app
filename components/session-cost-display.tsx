"use client";

import {
  formatCostUsd,
  type CostAccuracy,
  type SessionCostBreakdown,
} from "@/lib/cost";
import { getCostTotalUsd } from "@/lib/cost-storage";
import { useEffect, useState } from "react";

function accuracyLabel(accuracy: CostAccuracy): string {
  return accuracy === "actual" ? "Actual" : "Estimated";
}

type SessionCostDisplayProps = {
  cost: SessionCostBreakdown;
};

export function SessionCostDisplay({ cost }: SessionCostDisplayProps) {
  const [allTimeUsd, setAllTimeUsd] = useState(0);

  useEffect(() => {
    const refresh = () => setAllTimeUsd(getCostTotalUsd());
    refresh();
    window.addEventListener("audiolens:cost-updated", refresh);
    return () => window.removeEventListener("audiolens:cost-updated", refresh);
  }, []);

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-sm">
      <h3 className="font-semibold text-zinc-100">API cost</h3>
      <p className="mt-1 text-xs text-zinc-500">
        OpenRouter usage when returned; otherwise char-based estimates (~4 chars
        per token). Not a bill.
      </p>

      <dl className="mt-4 grid gap-2 text-zinc-300">
        <div className="flex justify-between gap-4">
          <dt>Transcript tokens (est.)</dt>
          <dd className="font-mono text-xs text-zinc-400">
            {cost.transcriptTokensEstimate.toLocaleString()}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>
            Transcribe ({accuracyLabel(cost.transcribeAccuracy).toLowerCase()})
          </dt>
          <dd className="font-mono text-zinc-200">
            {formatCostUsd(cost.transcribeCostUsd)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>
            Analysis ({accuracyLabel(cost.analysisAccuracy).toLowerCase()})
          </dt>
          <dd className="font-mono text-zinc-200">
            {formatCostUsd(cost.analysisCostUsd)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-white/10 pt-2 font-medium">
          <dt>
            Session total ({accuracyLabel(cost.sessionAccuracy).toLowerCase()})
          </dt>
          <dd className="font-mono text-zinc-200">
            {formatCostUsd(cost.sessionTotalUsd)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-400">
        <span>
          This session:{" "}
          <strong className="text-zinc-200">
            {formatCostUsd(cost.sessionTotalUsd)}
          </strong>
        </span>
        <span>
          All time (this browser):{" "}
          <strong className="text-zinc-200">{formatCostUsd(allTimeUsd)}</strong>
        </span>
      </div>
    </section>
  );
}

"use client";

import { formatCostUsd } from "@/lib/cost";
import {
  getCostTotalUsd,
  lastCostSessions,
  sumCostLastDays,
} from "@/lib/cost-storage";
import { useCallback, useEffect, useState } from "react";

export function CostDashboard() {
  const [total, setTotal] = useState(0);
  const [last30, setLast30] = useState(0);
  const [sessions, setSessions] = useState<
    ReturnType<typeof lastCostSessions>
  >([]);

  const refresh = useCallback(() => {
    setTotal(getCostTotalUsd());
    setLast30(sumCostLastDays(30));
    setSessions(lastCostSessions(10));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("audiolens:cost-updated", refresh);
    return () => window.removeEventListener("audiolens:cost-updated", refresh);
  }, [refresh]);

  if (total === 0 && sessions.length === 0) {
    return (
      <section className="rounded-xl border border-white/10 p-5 text-sm text-zinc-500">
        <h2 className="font-semibold text-zinc-300">Spend (this browser)</h2>
        <p className="mt-2">
          No costs recorded yet. Run analysis on{" "}
          <a href="/analyze" className="text-cyan-400 hover:underline">
            /analyze
          </a>{" "}
          to start tracking.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
      <h2 className="font-semibold text-cyan-100">Spend (this browser)</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            All time
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-100">
            {formatCostUsd(total)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Last 30 days
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-100">
            {formatCostUsd(last30)}
          </p>
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            Recent sessions (last 10)
          </h3>
          <ul className="mt-3 divide-y divide-white/10 rounded-lg border border-white/10">
            {sessions.map((entry, i) => (
              <li
                key={`${entry.date}-${i}`}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-zinc-200">{entry.label}</p>
                  <p className="text-xs text-zinc-500">
                    {new Date(entry.date).toLocaleString()}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-zinc-300">
                  {formatCostUsd(entry.amountUsd)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

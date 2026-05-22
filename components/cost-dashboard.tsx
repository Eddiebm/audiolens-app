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
      <section className="border border-white/[0.07] p-5 text-sm text-zinc-600">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Spend (this browser)</h2>
        <p className="mt-2">
          No costs recorded yet. Run analysis on{" "}
          <a href="/analyze" className="text-zinc-400 underline hover:text-zinc-200">/analyze</a>{" "}
          to start tracking.
        </p>
      </section>
    );
  }

  return (
    <section className="border border-white/[0.07] p-5">
      <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Spend (this browser)</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-zinc-600">All time</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-white">
            {formatCostUsd(total)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-600">Last 30 days</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-white">
            {formatCostUsd(last30)}
          </p>
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="mt-5">
          <ul className="divide-y divide-white/[0.05]">
            {sessions.map((entry, i) => (
              <li
                key={`${entry.date}-${i}`}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-zinc-400">{entry.label}</p>
                  <p className="text-xs text-zinc-700">
                    {new Date(entry.date).toLocaleString()}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs text-zinc-500">
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

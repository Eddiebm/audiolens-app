export const COST_TOTAL_KEY = "audiolens_cost_total_usd";
export const COST_LOG_KEY = "audiolens_cost_log";

export type CostLogEntry = {
  date: string;
  amountUsd: number;
  label: string;
};

function readLog(): CostLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(COST_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CostLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getCostTotalUsd(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(COST_TOTAL_KEY);
  const n = raw ? Number.parseFloat(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function getCostLog(): CostLogEntry[] {
  return readLog();
}

export function recordSessionCost(amountUsd: number, label: string): void {
  if (typeof window === "undefined" || amountUsd <= 0) return;
  const total = getCostTotalUsd() + amountUsd;
  localStorage.setItem(COST_TOTAL_KEY, String(total));
  const entry: CostLogEntry = {
    date: new Date().toISOString(),
    amountUsd,
    label: label.trim() || "Session",
  };
  const log = [entry, ...readLog()].slice(0, 200);
  localStorage.setItem(COST_LOG_KEY, JSON.stringify(log));
}

export function resetCostCounter(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(COST_TOTAL_KEY);
  localStorage.removeItem(COST_LOG_KEY);
}

export function sumCostLastDays(days: number): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return readLog()
    .filter((e) => new Date(e.date).getTime() >= cutoff)
    .reduce((sum, e) => sum + e.amountUsd, 0);
}

export function lastCostSessions(limit: number): CostLogEntry[] {
  return readLog().slice(0, limit);
}

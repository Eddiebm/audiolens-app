import { PIPELINE_STEPS, type PipelineStep } from "@/lib/pipeline";

const runtimeLabel: Record<PipelineStep["runtime"], string> = {
  macos: "macOS only",
  local: "On-device",
  cloud: "API",
  web: "Web",
};

const runtimeClass: Record<PipelineStep["runtime"], string> = {
  macos: "bg-amber-500/15 text-amber-200",
  local: "bg-emerald-500/15 text-emerald-200",
  cloud: "bg-violet-500/15 text-violet-200",
  web: "bg-cyan-500/15 text-cyan-200",
};

export function PipelineFlow({ compact = false }: { compact?: boolean }) {
  return (
    <ol className={compact ? "space-y-3" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
      {PIPELINE_STEPS.map((step, index) => (
        <li
          key={step.id}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-zinc-500">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${runtimeClass[step.runtime]}`}
            >
              {runtimeLabel[step.runtime]}
            </span>
          </div>
          <h3 className="font-semibold text-zinc-100">{step.title}</h3>
          <p className="mt-1 text-sm text-zinc-400">{step.summary}</p>
          {!compact && (
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">{step.detail}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

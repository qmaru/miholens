import { useEffect, useRef } from "react"

import { useI18n } from "../i18n/LanguageProvider"

import type { TraceEvent } from "../diagnostics/diagnose"

export type Phase = "running" | "done" | "failed"

interface Props {
  target: string
  phase: Phase
  events: TraceEvent[]
}

export function DiagnosisTrace({ target, phase, events }: Props) {
  const { t, tm } = useI18n()
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const body = bodyRef.current
    if (body) body.scrollTop = body.scrollHeight
  }, [events.length, phase])

  const statusClass = phase === "failed" ? "text-red-400" : "text-emerald-300"

  return (
    <section className="rise flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-term text-term-ink">
      <div className="flex items-center gap-2 bg-term-line px-4 py-2.5 font-mono text-xs text-term-dim">
        <span className="size-2.5 rounded-full bg-amber-700" />
        <span className="size-2.5 rounded-full bg-amber-600" />
        <span className="size-2.5 rounded-full bg-emerald-700" />
        <span className="ml-2 truncate">MihoLens — trace</span>
        <span className={`ml-auto shrink-0 ${phase === "running" ? "" : statusClass}`}>
          {t(`phase.${phase}`)}
        </span>
      </div>
      <div
        ref={bodyRef}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-6 font-mono text-[12.5px] leading-[1.85]"
      >
        <div className="trace-line break-all">
          <span className="text-emerald-300">$</span>{" "}
          <span className="text-term-dim">miholens trace</span> {target}
        </div>
        {events.map((event, index) => (
          <div key={index} className="trace-line mt-2 flex items-start gap-2">
            <span className="w-14 shrink-0 rounded bg-term-line px-1.5 text-center text-[11px] leading-[1.7] text-sky-300">
              {event.stage}
            </span>
            <span className="text-term-dim">▸</span>
            <span className="min-w-0 break-all">{tm(event.message)}</span>
            {event.ok ? (
              <span className="shrink-0 text-emerald-300">✓</span>
            ) : (
              <span className="shrink-0 text-amber-300">!</span>
            )}
          </div>
        ))}
        {phase === "running" ? (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-term-dim">▸</span>
            <span className="trace-cursor" />
          </div>
        ) : (
          <div className="trace-line mt-4 border-t border-dashed border-term-line pt-3 text-term-dim">
            {t(`phase.${phase}`)}
          </div>
        )}
      </div>
    </section>
  )
}

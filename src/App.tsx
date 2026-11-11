import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type SubmitEvent,
} from "react"

import { MihomoApiError, MihomoClient, type MihomoConfig } from "./api/client"
import { SingboxClient } from "./api/singbox/client"
import { ConnectionManager } from "./components/ConnectionManager"
import { DiagnosisTrace, type Phase } from "./components/DiagnosisTrace"
import { StableLabel } from "./components/StableLabel"
import { loadSavedConnections, saveConnections, type SavedConnections } from "./connections"
import { normalizeTarget, runDiagnosis, type TraceEvent } from "./diagnostics/diagnose"
import { runSingboxDiagnosis } from "./diagnostics/singboxDiagnose"
import { LanguageProvider, useI18n } from "./i18n/LanguageProvider"
import { translationsOf, type Message, type MessageKey } from "./i18n/messages"
import { applyServiceWorkerUpdate, registerServiceWorker } from "./serviceWorker"

import type { DiagnosisResult, Field, FieldSource, FieldStatus } from "./diagnostics/types"

const STATUS_KEY: Record<FieldStatus, MessageKey> = {
  observed: "status.observed",
  unavailable: "status.unavailable",
  "not-run": "status.not-run",
}

const STATUS_CLASS: Record<FieldStatus, string> = {
  observed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  unavailable: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  "not-run": "border border-line text-ink-muted",
}

type Tone = "dns" | "rule" | "proxy" | "link"

const TONE: Record<Tone, { bar: string; text: string; soft: string }> = {
  dns: {
    bar: "border-l-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    soft: "bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-900",
  },
  rule: {
    bar: "border-l-violet-500",
    text: "text-violet-700 dark:text-violet-300",
    soft: "bg-violet-50 border-violet-200 dark:bg-violet-950/40 dark:border-violet-900",
  },
  proxy: {
    bar: "border-l-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    soft: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900",
  },
  link: {
    bar: "border-l-fuchsia-500",
    text: "text-fuchsia-700 dark:text-fuchsia-300",
    soft: "bg-fuchsia-50 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:border-fuchsia-900",
  },
}

const DIAGNOSE_LABELS = [
  ...translationsOf("form.diagnose"),
  ...translationsOf("form.diagnosing"),
  ...translationsOf("phase.failed"),
]

const SOURCE_LABEL: Record<FieldSource, string> = {
  "dns-query-api": "/dns/query",
  "connections-api": "/connections",
  "proxies-api": "/proxies",
  "providers-api": "/providers/proxies",
  "logs-ws": "/logs",
  "connections-grpc": "SubscribeConnections",
  "proxies-grpc": "SubscribeOutbounds / SubscribeGroups",
  "logs-grpc": "SubscribeLog",
}

function Code({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[13px]">{children}</code>
}

function Section({ title, tone, children }: { title: string; tone: Tone; children: ReactNode }) {
  return (
    <section className={`rounded-xl border border-line border-l-4 bg-inset px-5 ${TONE[tone].bar}`}>
      <h2 className={`pt-4 text-base font-semibold ${TONE[tone].text}`}>{title}</h2>
      <div className="divide-y divide-line">{children}</div>
    </section>
  )
}

function Highlight<T>({
  label,
  tone,
  field,
  render,
}: {
  label: string
  tone: Tone
  field: Field<T>
  render: (value: T) => ReactNode
}) {
  const { t, tm } = useI18n()
  return (
    <div className={`min-w-0 rounded-xl border p-4 ${TONE[tone].soft}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-medium ${TONE[tone].text}`}>{label}</span>
        <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_CLASS[field.status]}`}>
          {t(STATUS_KEY[field.status])}
        </span>
      </div>
      <div className="mt-2 text-sm font-semibold break-words">
        {field.value === null ? (
          <span className="font-normal text-ink-muted">
            {field.reason ? tm(field.reason) : t("common.noData")}
          </span>
        ) : (
          render(field.value)
        )}
      </div>
    </div>
  )
}

function FieldView<T>({
  label,
  field,
  render,
}: {
  label: string
  field: Field<T>
  render: (value: T) => ReactNode
}) {
  const { t, tm } = useI18n()
  return (
    <div className="grid gap-1.5 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 whitespace-nowrap ${STATUS_CLASS[field.status]}`}
          >
            {t(STATUS_KEY[field.status])}
          </span>
          <span className="min-w-0 break-words">{SOURCE_LABEL[field.source]}</span>
        </div>
      </div>
      <div className="min-w-0 text-sm break-words">
        {field.value === null ? (
          <span className="text-ink-muted">
            {field.reason ? tm(field.reason) : t("common.noData")}
          </span>
        ) : (
          render(field.value)
        )}
      </div>
    </div>
  )
}

function ResultView({ result }: { result: DiagnosisResult }) {
  const { t, tm } = useI18n()
  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-4 shadow-md sm:p-5">
      <header className="flex flex-wrap items-baseline gap-3 border-b border-line pb-4">
        <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong">
          {t(result.targetKind === "domain" ? "target.domain" : "target.ip")}
        </span>
        <h2 className="min-w-0 font-mono text-lg font-semibold break-all">{result.target}</h2>
        <span className="text-xs text-ink-muted">{t("result.title")}</span>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Highlight
          label={t("highlight.upstream")}
          tone="dns"
          field={result.dns.upstream}
          render={(server) => <Code>{server}</Code>}
        />
        <Highlight
          label={t("highlight.kernelRule")}
          tone="rule"
          field={result.rules.kernelHit}
          render={(r) => (
            <Code>
              {r.type} {r.payload}
            </Code>
          )}
        />
        <Highlight
          label={t("highlight.rootGroup")}
          tone="proxy"
          field={result.proxy.rootGroup}
          render={(g) => <Code>{g}</Code>}
        />
      </div>

      <Section title={t("section.dns")} tone="dns">
        <FieldView
          label={t("field.answers")}
          field={result.dns.answers}
          render={(answers) =>
            answers.length === 0 ? (
              <span className="text-ink-muted">{t("common.noAnswer")}</span>
            ) : (
              <ul className="space-y-1 font-mono text-[13px]">
                {answers.map((a, i) => (
                  <li key={i}>
                    {a.type} {a.data} (TTL {a.ttl})
                  </li>
                ))}
              </ul>
            )
          }
        />
        <FieldView
          label={t("field.rcode")}
          field={result.dns.rcode}
          render={(code) => <Code>{code}</Code>}
        />
        <FieldView
          label={t("field.upstream")}
          field={result.dns.upstream}
          render={(server) => <Code>{server}</Code>}
        />
      </Section>

      <Section title={t("section.rules")} tone="rule">
        <FieldView
          label={t("field.kernelRule")}
          field={result.rules.kernelHit}
          render={(r) => (
            <Code>
              {r.type} {r.payload} → {r.proxy}
            </Code>
          )}
        />
      </Section>

      <Section title={t("section.proxy")} tone="proxy">
        <FieldView
          label={t("field.rootGroup")}
          field={result.proxy.rootGroup}
          render={(g) => <Code>{g}</Code>}
        />
        <FieldView
          label={t("field.chain")}
          field={result.proxy.chain}
          render={(chain) => <Code>{chain.join(" → ")}</Code>}
        />
        <FieldView
          label={t("field.leafType")}
          field={result.proxy.leafType}
          render={(leaf) => <Code>{leaf}</Code>}
        />
        <FieldView
          label={t("field.observedChain")}
          field={result.proxy.observedChain}
          render={(chain) => <Code>{chain.join(" → ")}</Code>}
        />
      </Section>

      <Section title={t("section.correlation")} tone="link">
        <FieldView
          label={t("field.probe")}
          field={result.probe}
          render={(c) => (
            <Code>
              {c.host || c.destinationIP}:{c.destinationPort} {c.rule} {c.rulePayload}
            </Code>
          )}
        />
        {result.notes.length > 0 && (
          <div className="py-3">
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
              {result.notes.map((n, i) => (
                <li key={i}>{tm(n)}</li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </div>
  )
}

type Tab = "trace" | "result"

function Inspector() {
  const { t, tm } = useI18n()
  const [saved, setSaved] = useState(() =>
    loadSavedConnections(t("connection.defaultName", { index: 1 })),
  )
  const active = saved.connections.find((c) => c.id === saved.activeId) ?? saved.connections[0]
  const [target, setTarget] = useState("")
  const [runTarget, setRunTarget] = useState("")
  const [phase, setPhase] = useState<Phase | null>(null)
  const [runKey, setRunKey] = useState(0)
  const [tab, setTab] = useState<Tab>("trace")
  const [result, setResult] = useState<DiagnosisResult | null>(null)
  const [error, setError] = useState<Message | null>(null)
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([])
  const [liveUpstream, setLiveUpstream] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    registerServiceWorker(() => {
      setUpdateReady(true)
    })
  }, [])

  useEffect(() => {
    saveConnections(saved)
  }, [saved])

  function onConnectionsChange(next: SavedConnections) {
    if (next.activeId !== saved.activeId) {
      setPhase(null)
      setTarget("")
      setRunTarget("")
      setResult(null)
      setError(null)
      setTraceEvents([])
      setTab("trace")
    }
    setSaved(next)
  }

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault()
    const config: MihomoConfig = { baseUrl: active.baseUrl, secret: active.secret }
    setRunTarget(target.trim())
    setRunKey((k) => k + 1)
    setPhase("running")
    setTab("trace")
    setResult(null)
    setError(null)
    setTraceEvents([])
    try {
      const normalized = normalizeTarget(target)
      const onTrace = (event: TraceEvent) => {
        setTraceEvents((events) => [...events, event])
      }
      setResult(
        active.backend === "singbox"
          ? await runSingboxDiagnosis(new SingboxClient(config), normalized, { onTrace })
          : await runDiagnosis(new MihomoClient(config), normalized, { liveUpstream, onTrace }),
      )
      setPhase("done")
    } catch (err) {
      setPhase("failed")
      setError(
        err instanceof MihomoApiError
          ? err.detail
          : {
              key: "error.generic",
              params: { message: err instanceof Error ? err.message : String(err) },
            },
      )
    }
  }

  const idle = phase === null

  const stageRef = useRef<HTMLDivElement>(null)
  const [idleShift, setIdleShift] = useState(0)

  useLayoutEffect(() => {
    const stage = stageRef.current
    const main = stage?.parentElement
    if (!stage || !main) return
    const measure = () => {
      setIdleShift((main.clientHeight - stage.offsetHeight) / 2 - stage.offsetTop)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(main)
    observer.observe(stage)
    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <main className="relative mx-auto flex h-dvh max-w-3xl flex-col overflow-hidden px-5 py-6 sm:py-8">
      <div
        ref={stageRef}
        className="relative z-10 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ transform: `translateY(${idle ? idleShift : 0}px)` }}
      >
        <header className="flex items-center justify-between gap-4">
          <ConnectionManager value={saved} onChange={onConnectionsChange} />
          <span className="shrink-0 text-xs text-ink-muted/70">mihomo / sing-box checker</span>
        </header>

        {updateReady && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm">
            <span>{t("update.ready")}</span>
            <button
              type="button"
              onClick={applyServiceWorkerUpdate}
              className="shrink-0 cursor-pointer rounded-lg bg-accent px-3 py-1.5 font-medium text-on-accent transition-colors hover:bg-accent-strong"
            >
              {t("update.apply")}
            </button>
          </div>
        )}

        <div className="mt-6">
          <form
            className="relative w-full"
            onSubmit={(event) => {
              void onSubmit(event)
            }}
          >
            <label htmlFor="target" className="sr-only">
              {t("form.target")}
            </label>
            <div className="flex items-center gap-2 rounded-2xl bg-surface p-2 shadow-md">
              <input
                id="target"
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base text-ink placeholder:text-ink-muted/70 focus:outline-none"
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value)
                }}
                placeholder="example.com"
                autoComplete="off"
                required
              />
              <button
                type="submit"
                disabled={phase === "running" || target.trim() === ""}
                title={error ? tm(error) : undefined}
                className={`shrink-0 cursor-pointer rounded-xl px-5 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  phase === "failed"
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-accent text-on-accent hover:bg-accent-strong"
                }`}
              >
                <StableLabel
                  options={DIAGNOSE_LABELS}
                  selected={
                    phase === "running"
                      ? t("form.diagnosing")
                      : phase === "failed"
                        ? t("phase.failed")
                        : t("form.diagnose")
                  }
                />
              </button>
            </div>
            <label
              className={`absolute left-0 top-full mt-2 flex h-5 w-fit items-center gap-2 px-1 text-xs text-ink-muted ${
                active.backend === "mihomo" ? "cursor-pointer" : "invisible"
              }`}
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-accent"
                checked={liveUpstream}
                onChange={(e) => {
                  setLiveUpstream(e.target.checked)
                }}
              />
              {t("form.liveUpstream")}
            </label>
          </form>
        </div>
      </div>

      {phase !== null && (
        <section className="mt-9 flex min-h-0 flex-1 flex-col">
          <div role="tablist" className="mb-3 flex w-fit gap-1 rounded-xl bg-inset p-1 text-sm">
            {(["trace", "result"] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                disabled={key === "result" && !result}
                onClick={() => {
                  setTab(key)
                }}
                className={`cursor-pointer rounded-lg px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  tab === key ? "bg-surface font-medium shadow-sm" : "text-ink-muted hover:text-ink"
                }`}
              >
                <StableLabel
                  options={[...translationsOf("tabs.trace"), ...translationsOf("tabs.result")]}
                  selected={t(key === "trace" ? "tabs.trace" : "tabs.result")}
                />
              </button>
            ))}
          </div>
          <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
            {tab === "trace" ? (
              <DiagnosisTrace key={runKey} target={runTarget} phase={phase} events={traceEvents} />
            ) : (
              result && <ResultView result={result} />
            )}
          </div>
        </section>
      )}
    </main>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <Inspector />
    </LanguageProvider>
  )
}

import { useEffect, useState, type ReactNode, type SubmitEvent } from "react"

import { MihomoApiError, MihomoClient, type MihomoConfig } from "./api/client"
import { LanguageSwitch } from "./components/LanguageSwitch"
import { StableLabel } from "./components/StableLabel"
import { ThemeSwitch } from "./components/ThemeSwitch"
import { normalizeTarget, runDiagnosis } from "./diagnostics/diagnose"
import { LanguageProvider, useI18n } from "./i18n/LanguageProvider"
import { translationsOf, type Message, type MessageKey } from "./i18n/messages"

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

const INPUT_CLASS =
  "w-full rounded-lg border border-line bg-inset px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"

const DIAGNOSE_LABELS = [...translationsOf("form.diagnose"), ...translationsOf("form.diagnosing")]

const SOURCE_LABEL: Record<FieldSource, string> = {
  "dns-query-api": "/dns/query",
  "connections-api": "/connections",
  "proxies-api": "/proxies",
  "providers-api": "/providers/proxies",
  "logs-ws": "/logs",
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
    <div className="grid gap-1.5 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
          <span className={`rounded px-1.5 py-0.5 ${STATUS_CLASS[field.status]}`}>
            {t(STATUS_KEY[field.status])}
          </span>
          <span>{SOURCE_LABEL[field.source]}</span>
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

const DEFAULT_BASE_URL = "http://127.0.0.1:9090"
const STORAGE_KEY = "connection"

function loadSavedConnection(): { baseUrl: string; secret: string } | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    return null
  }
  try {
    return JSON.parse(raw) as { baseUrl: string; secret: string }
  } catch {
    return null
  }
}

function Inspector() {
  const { t, tm } = useI18n()
  const [saved] = useState(loadSavedConnection)
  const [baseUrl, setBaseUrl] = useState(saved?.baseUrl ?? DEFAULT_BASE_URL)
  const [secret, setSecret] = useState(saved?.secret ?? "")
  const [remember, setRemember] = useState(saved !== null)
  const [target, setTarget] = useState("")
  const [result, setResult] = useState<DiagnosisResult | null>(null)
  const [error, setError] = useState<Message | null>(null)
  const [running, setRunning] = useState(false)
  const [liveUpstream, setLiveUpstream] = useState(false)

  useEffect(() => {
    if (remember) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ baseUrl, secret }))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [remember, baseUrl, secret])

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault()
    const config: MihomoConfig = { baseUrl, secret }
    setRunning(true)
    setError(null)
    try {
      setResult(
        await runDiagnosis(new MihomoClient(config), normalizeTarget(target), { liveUpstream }),
      )
    } catch (err) {
      setResult(null)
      setError(
        err instanceof MihomoApiError
          ? err.detail
          : {
              key: "error.generic",
              params: { message: err instanceof Error ? err.message : String(err) },
            },
      )
    } finally {
      setRunning(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">miholens</h1>
          <p className="mt-1 text-sm text-ink-muted">Mihomo Inspector</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
      </header>

      <details className="group mb-4 rounded-xl border border-line bg-surface shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-sm [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-baseline gap-3">
            <span className="shrink-0 font-medium">{t("connection.title")}</span>
            <span className="truncate text-xs text-ink-muted">
              {t("connection.summary", {
                baseUrl,
                state: secret ? "••••••" : t("connection.secretUnset"),
              })}
            </span>
          </span>
          <span className="shrink-0 text-ink-muted transition-transform group-[[open]]:rotate-180">
            ▾
          </span>
        </summary>
        <div className="grid gap-3 border-t border-line px-5 py-4 sm:grid-cols-2">
          <div>
            <label htmlFor="baseUrl" className="block text-sm font-medium">
              {t("connection.baseUrl")}
            </label>
            <input
              id="baseUrl"
              className={`${INPUT_CLASS} mt-1.5`}
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value)
              }}
            />
          </div>
          <div>
            <label htmlFor="secret" className="block text-sm font-medium">
              Secret
            </label>
            <input
              id="secret"
              type="password"
              autoComplete="off"
              className={`${INPUT_CLASS} mt-1.5`}
              value={secret}
              onChange={(e) => {
                setSecret(e.target.value)
              }}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted sm:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-accent"
              checked={remember}
              onChange={(e) => {
                setRemember(e.target.checked)
              }}
            />
            {t("connection.remember")}
          </label>
        </div>
      </details>

      <form
        className="rounded-xl border border-line bg-surface p-5 shadow-sm"
        onSubmit={(event) => {
          void onSubmit(event)
        }}
      >
        <div>
          <label htmlFor="target" className="block text-sm font-medium">
            {t("form.target")}
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="target"
              className={INPUT_CLASS}
              value={target}
              onChange={(e) => {
                setTarget(e.target.value)
              }}
              placeholder="example.com"
              required
            />
            <button
              type="submit"
              disabled={running || target.trim() === ""}
              className="shrink-0 cursor-pointer rounded-lg bg-accent px-4 text-sm font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              <StableLabel
                options={DIAGNOSE_LABELS}
                selected={running ? t("form.diagnosing") : t("form.diagnose")}
              />
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">{t("form.hint")}</p>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-ink-muted">
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
        </div>
      </form>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {tm(error)}
        </p>
      )}
      {result && (
        <div className="mt-6">
          <ResultView result={result} />
        </div>
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

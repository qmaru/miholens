import { useId, useRef, useState } from "react"

import { MihomoApiError, MihomoClient } from "../api/client"
import { SingboxClient } from "../api/singbox/client"
import {
  BACKEND_LABEL,
  DEFAULT_BASE_URL,
  connectionLabel,
  type Backend,
  type Connection,
  type SavedConnections,
} from "../connections"
import { useI18n } from "../i18n/LanguageProvider"
import { translationsOf } from "../i18n/messages"
import { LanguageSwitch } from "./LanguageSwitch"
import { StableLabel } from "./StableLabel"
import { ThemeSwitch } from "./ThemeSwitch"

const FIELD =
  "w-full rounded-xl bg-inset px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"

const BACKENDS: Backend[] = ["mihomo", "singbox"]

interface Props {
  value: SavedConnections
  onChange: (next: SavedConnections) => void
}

export function ConnectionManager({ value, onChange }: Props) {
  const { t, tm } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editId, setEditId] = useState(value.activeId)
  const [armed, setArmed] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)
  const titleId = useId()
  const menuId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const hideMenu = { commandfor: menuId, command: "hide-popover" } as object
  const toggleMenu = { commandfor: menuId, command: "toggle-popover" } as object

  const active = value.connections.find((c) => c.id === value.activeId) ?? value.connections[0]
  const editing = value.connections.find((c) => c.id === editId) ?? active

  function openPanel() {
    setEditId(value.activeId)
    dialogRef.current?.showModal()
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus()
  }

  function select(id: string) {
    setEditId(id)
    setArmed(false)
    setShowSecret(false)
    setTestResult(null)
  }

  function update(patch: Partial<Omit<Connection, "id">>) {
    onChange({
      ...value,
      connections: value.connections.map((c) => (c.id === editing.id ? { ...c, ...patch } : c)),
    })
  }

  function add() {
    const connection: Connection = {
      id: Date.now().toString(36),
      name: t("connection.defaultName", { index: value.connections.length + 1 }),
      backend: "mihomo",
      baseUrl: DEFAULT_BASE_URL,
      secret: "",
    }
    onChange({ ...value, connections: [...value.connections, connection] })
    select(connection.id)
  }

  function remove() {
    if (!armed) {
      setArmed(true)
      return
    }
    const rest = value.connections.filter((c) => c.id !== editing.id)
    onChange({
      ...value,
      connections: rest,
      activeId: editing.id === value.activeId ? rest[0].id : value.activeId,
    })
    select(rest[0].id)
  }

  const testLabel = testing
    ? t("connection.testing")
    : testResult === null
      ? t("connection.test")
      : testResult.ok
        ? t("connection.testReachable")
        : t("connection.testFailed")

  async function runTest() {
    const config = { baseUrl: editing.baseUrl, secret: editing.secret }
    setTesting(true)
    setTestResult(null)
    try {
      const connections =
        editing.backend === "singbox"
          ? await new SingboxClient(config).getConnections()
          : await new MihomoClient(config).getConnections()
      setTestResult({ ok: true, text: String(connections.length) })
    } catch (err) {
      const message =
        err instanceof MihomoApiError
          ? tm(err.detail)
          : err instanceof Error
            ? err.message
            : String(err)
      setTestResult({ ok: false, text: message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <>
      <div className="relative min-w-0 max-w-[60%]">
        <button
          type="button"
          {...toggleMenu}
          aria-expanded={menuOpen}
          className="connection-trigger inline-flex max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs shadow-sm ring-1 ring-line transition-shadow hover:ring-accent"
        >
          <span
            className="ring-pulse relative size-2 shrink-0 rounded-full bg-emerald-500"
            aria-hidden="true"
          />
          <span className="truncate font-medium">{connectionLabel(active)}</span>
        </button>

        <div
          id={menuId}
          popover="auto"
          onToggle={(event) => {
            setMenuOpen(event.newState === "open")
          }}
          className="connection-menu rise open:flex w-72 flex-col gap-0.5 rounded-2xl bg-surface p-1.5 shadow-xl ring-1 ring-line"
        >
          {value.connections.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-current={c.id === value.activeId}
              {...hideMenu}
              onClick={() => {
                onChange({ ...value, activeId: c.id })
              }}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-inset"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">{connectionLabel(c)}</span>
                <span className="truncate font-mono text-xs text-ink-muted">{c.baseUrl}</span>
              </span>
              {c.id === value.activeId && (
                <span
                  className="shrink-0 text-emerald-600 dark:text-emerald-300"
                  aria-hidden="true"
                >
                  ✓
                </span>
              )}
            </button>
          ))}
          <div className="my-1 h-px bg-line" />
          <button
            type="button"
            {...hideMenu}
            onClick={openPanel}
            className="cursor-pointer rounded-lg px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-inset hover:text-ink"
          >
            {t("connection.manage")}
          </button>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        closedby="any"
        className="rise m-auto open:flex max-h-[min(640px,100%)] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl ring-1 ring-line backdrop:bg-ink/20 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2 id={titleId} className="text-base font-semibold">
            {t("connection.title")}
          </h2>
          <button
            type="button"
            onClick={() => {
              dialogRef.current?.close()
            }}
            aria-label={t("connection.close")}
            className="cursor-pointer rounded-lg px-2 py-1 text-ink-muted transition-colors hover:bg-inset hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 sm:grid-cols-[220px_1fr]">
          <div className="flex min-h-0 flex-col gap-1 overflow-y-auto border-line bg-inset p-2 sm:border-r">
            {value.connections.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={c.id === editing.id}
                onClick={() => {
                  select(c.id)
                }}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors ${
                  c.id === editing.id ? "bg-surface shadow-sm" : "hover:bg-surface/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{connectionLabel(c)}</span>
                  {c.id === value.activeId && (
                    <em className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 text-[11px] text-emerald-700 not-italic dark:text-emerald-300">
                      {t("connection.current")}
                    </em>
                  )}
                </span>
                <span className="truncate font-mono text-xs text-ink-muted">{c.baseUrl}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={add}
              className="mt-1 cursor-pointer rounded-lg px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-surface/60 hover:text-ink"
            >
              + {t("connection.add")}
            </button>
          </div>

          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5">
            <div>
              <label htmlFor="connectionName" className="block text-sm font-medium">
                {t("connection.name")}
              </label>
              <input
                id="connectionName"
                className={`${FIELD} mt-1.5 font-sans`}
                value={editing.name}
                onChange={(e) => {
                  update({ name: e.target.value })
                }}
              />
            </div>

            <div>
              <span className="block text-sm font-medium">{t("backend.label")}</span>
              <div className="mt-1.5 inline-flex rounded-xl bg-inset p-1">
                {BACKENDS.map((backend) => (
                  <button
                    key={backend}
                    type="button"
                    aria-pressed={editing.backend === backend}
                    onClick={() => {
                      update({ backend })
                    }}
                    className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      editing.backend === backend
                        ? "bg-surface font-medium shadow-sm"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {t(BACKEND_LABEL[backend])}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="baseUrl" className="block text-sm font-medium">
                {t("connection.baseUrl")}
              </label>
              <input
                id="baseUrl"
                type="url"
                autoComplete="off"
                spellCheck={false}
                className={`${FIELD} mt-1.5`}
                value={editing.baseUrl}
                onChange={(e) => {
                  update({ baseUrl: e.target.value })
                }}
              />
            </div>

            <div>
              <label htmlFor="secret" className="block text-sm font-medium">
                {t("connection.secret")}
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="secret"
                  type={showSecret ? "text" : "password"}
                  autoComplete="off"
                  placeholder={t("connection.secretUnset")}
                  className={FIELD}
                  value={editing.secret}
                  onChange={(e) => {
                    update({ secret: e.target.value })
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowSecret(!showSecret)
                  }}
                  className="shrink-0 cursor-pointer rounded-xl bg-inset px-3 text-sm text-ink-muted transition-colors hover:text-ink"
                >
                  <StableLabel
                    options={[
                      ...translationsOf("connection.show"),
                      ...translationsOf("connection.hide"),
                    ]}
                    selected={showSecret ? t("connection.hide") : t("connection.show")}
                  />
                </button>
              </div>
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  void runTest()
                }}
                disabled={testing}
                title={testResult && !testResult.ok ? testResult.text : undefined}
                className={`cursor-pointer rounded-xl px-3.5 py-2 text-sm transition-colors disabled:cursor-wait disabled:opacity-60 ${
                  testResult?.ok === false
                    ? "bg-red-600/15 text-red-700 dark:text-red-300"
                    : testResult?.ok
                      ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-inset hover:bg-accent-soft"
                }`}
              >
                <StableLabel
                  options={[
                    ...translationsOf("connection.test"),
                    ...translationsOf("connection.testing"),
                    ...translationsOf("connection.testReachable"),
                    ...translationsOf("connection.testFailed"),
                  ]}
                  selected={testLabel}
                />
              </button>
              <div className="ml-auto flex gap-2">
                {editing.id !== value.activeId && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ ...value, activeId: editing.id })
                    }}
                    className="cursor-pointer rounded-xl bg-accent-strong px-3.5 py-2 text-sm font-medium text-on-accent transition-opacity hover:opacity-90"
                  >
                    {t("connection.setActive")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={remove}
                  disabled={value.connections.length === 1}
                  className={`cursor-pointer rounded-xl px-3.5 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    armed ? "bg-red-600 text-white" : "bg-inset hover:text-red-600"
                  }`}
                >
                  <StableLabel
                    options={[
                      ...translationsOf("connection.delete"),
                      ...translationsOf("connection.confirmDelete"),
                    ]}
                    selected={armed ? t("connection.confirmDelete") : t("connection.delete")}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-line px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-muted">
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 accent-accent"
              checked={value.remember}
              onChange={(e) => {
                onChange({ ...value, remember: e.target.checked })
              }}
            />
            <span className="whitespace-nowrap">{t("connection.remember")}</span>
          </label>
          <div className="flex shrink-0 items-center gap-4">
            <LanguageSwitch />
            <ThemeSwitch />
          </div>
        </div>
      </dialog>
    </>
  )
}

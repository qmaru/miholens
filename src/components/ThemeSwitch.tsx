import { useEffect, useState } from "react"

import { useI18n } from "../i18n/LanguageProvider"
import { translationsOf } from "../i18n/messages"
import { StableLabel } from "./StableLabel"

const DARK_QUERY = "(prefers-color-scheme: dark)"

export function ThemeSwitch() {
  const { t } = useI18n()
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"))

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])

  // Follow the system theme until the user picks one that differs from it.
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const onChange = () => {
      const saved = localStorage.getItem("theme")
      if (saved !== "light" && saved !== "dark") {
        setDark(media.matches)
      }
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === "theme") {
        setDark(event.newValue === null ? media.matches : event.newValue === "dark")
      }
    }
    media.addEventListener("change", onChange)
    window.addEventListener("storage", onStorage)
    return () => {
      media.removeEventListener("change", onChange)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const toggle = () => {
    const next = !dark
    if (next === window.matchMedia(DARK_QUERY).matches) {
      localStorage.removeItem("theme")
    } else {
      localStorage.setItem("theme", next ? "dark" : "light")
    }
    setDark(next)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={t("theme.label")}
      onClick={toggle}
      className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-xs whitespace-nowrap text-ink-muted transition-colors hover:text-ink"
    >
      <StableLabel
        options={[...translationsOf("theme.light"), ...translationsOf("theme.dark")]}
        selected={dark ? t("theme.dark") : t("theme.light")}
      />
      <span
        aria-hidden="true"
        className={`relative inline-block h-3.5 w-6 rounded-full transition-colors ${dark ? "bg-accent" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-2.5 rounded-full bg-surface transition-transform ${dark ? "translate-x-2.5" : ""}`}
        />
      </span>
    </button>
  )
}

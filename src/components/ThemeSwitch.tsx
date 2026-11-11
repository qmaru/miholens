import { useEffect, useState } from "react"

import { useI18n } from "../i18n/LanguageProvider"
const DARK_QUERY = "(prefers-color-scheme: dark)"

export function ThemeSwitch() {
  const { t } = useI18n()
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"))

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])

  // Follow the system theme until the user picks one explicitly.
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const onChange = () => {
      const saved = localStorage.getItem("theme")
      if (saved !== "light" && saved !== "dark") {
        setDark(media.matches)
      }
    }
    media.addEventListener("change", onChange)
    return () => {
      media.removeEventListener("change", onChange)
    }
  }, [])

  const toggle = () => {
    localStorage.setItem("theme", dark ? "light" : "dark")
    setDark(!dark)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={toggle}
      className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-xs whitespace-nowrap text-ink-muted transition-colors hover:text-ink"
    >
      <span>{dark ? t("theme.dark") : t("theme.light")}</span>
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

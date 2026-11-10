import { useI18n } from "../i18n/LanguageProvider"
import { StableLabel } from "./StableLabel"

const LANGUAGE_LABELS = ["中文", "English"]

export function LanguageSwitch() {
  const { lang, setLang } = useI18n()
  const english = lang === "en"

  return (
    <button
      type="button"
      role="switch"
      aria-checked={english}
      onClick={() => {
        setLang(english ? "zh" : "en")
      }}
      className="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-muted transition-colors hover:text-ink"
    >
      <StableLabel options={LANGUAGE_LABELS} selected={english ? "English" : "中文"} align="end" />
      <span
        aria-hidden="true"
        className={`relative inline-block h-3.5 w-6 rounded-full transition-colors ${english ? "bg-accent" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-2.5 rounded-full bg-surface transition-transform ${english ? "translate-x-2.5" : ""}`}
        />
      </span>
    </button>
  )
}

import { useI18n } from "../i18n/LanguageProvider"

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
      className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-xs whitespace-nowrap text-ink-muted transition-colors hover:text-ink"
    >
      <span>{english ? "English" : "中文"}</span>
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

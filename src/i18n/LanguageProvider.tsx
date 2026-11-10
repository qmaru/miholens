import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { translate, type Lang, type Message, type MessageKey } from "./messages"

const STORAGE_KEY = "lang"

interface I18n {
  lang: Lang
  setLang: (lang: Lang) => void
  /** Translate a catalog key with optional `{name}` params. */
  t: (key: MessageKey, params?: Message["params"]) => string
  /** Translate a message object, e.g. a reason produced by the diagnostics layer. */
  tm: (message: Message) => string
}

const I18nContext = createContext<I18n | null>(null)

/** Follow the browser: any Chinese locale maps to zh, everything else to en. */
function detectLang(): Lang {
  return navigator.languages.some((l) => l.toLowerCase().startsWith("zh")) ? "zh" : "en"
}

/** A manual choice is persisted; without one the language keeps following the browser. */
function readLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === "en" || saved === "zh" ? saved : detectLang()
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang)

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en"
  }, [lang])

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang: (next) => {
        localStorage.setItem(STORAGE_KEY, next)
        setLangState(next)
      },
      t: (key, params) => translate({ key, params }, lang),
      tm: (message) => translate(message, lang),
    }),
    [lang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (ctx === null) {
    throw new Error("useI18n must be used inside LanguageProvider")
  }
  return ctx
}

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import english from "@/lib/en.json";

type Language = "pt" | "en";
const catalog: Record<string, string> = english;
function translate(text: string, language: Language) {
  if (language === "pt") return text;
  const normalized = text.replace(/\s+/g, " ").trim();
  const translated = catalog[normalized];
  if (!translated) return text;
  return `${text.match(/^\s*/)?.[0] ?? ""}${translated}${text.match(/\s*$/)?.[0] ?? ""}`;
}
type I18nValue = { language: Language; locale: string; t: <T>(text: T, values?: unknown[]) => T; setLanguage: (value: Language) => void };
const I18nContext = createContext<I18nValue>({ language: "pt", locale: "pt-BR", t: text => text, setLanguage: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("pt");
  useEffect(() => {
    try {
      const value = new URLSearchParams(window.location.search).get("lang") ?? localStorage.getItem("artx-language") ?? (navigator.language.startsWith("pt") ? "pt" : "en");
      setLanguageState(value === "en" ? "en" : "pt");
    } catch { /* Language preference is optional. */ }
  }, []);
  const setLanguage = useCallback((value: Language) => {
    setLanguageState(value);
    try { localStorage.setItem("artx-language", value); } catch { /* Optional preference. */ }
  }, []);
  const t = useCallback(<T,>(text: T, values: unknown[] = []): T => {
    if (typeof text !== "string") return text;
    // Uma barra só: com duas, o regex procurava uma barra invertida antes da
    // chave, nunca achava "{0}", e todo texto com número dentro ficava sem valor.
    return translate(text, language).replace(/\{(\d+)\}/g, (match, index: string) => Number(index) < values.length ? String(values[Number(index)]) : match) as T;
  }, [language]);
  useEffect(() => { document.documentElement.lang = language === "en" ? "en" : "pt-BR"; }, [language]);
  const value = useMemo(() => ({ language, locale: language === "en" ? "en-GB" : "pt-BR", t, setLanguage }), [language, t, setLanguage]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n() { return useContext(I18nContext); }
export function LanguageSwitch() {
  const { language, setLanguage } = useI18n();
  // As cores vêm do CSS (`.idioma-troca`): escritas aqui, ignoravam o tema e o
  // seletor ficava verde-escuro até no tema claro.
  return (
    <div className="idioma-troca" role="group" aria-label="Language / Idioma">
      {(["pt", "en"] as const).map((value) => (
        <button key={value} type="button" onClick={() => setLanguage(value)} aria-pressed={language === value}>
          {value.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

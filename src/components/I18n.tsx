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
const I18nContext = createContext({ language: "pt" as Language, locale: "pt-BR", t: <T,>(text: T, _values?: unknown[]) => text, setLanguage: (_value: Language) => {} });

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
    return translate(text, language).replace(/\\{(\\d+)\\}/g, (match, index: string) => Number(index) < values.length ? String(values[Number(index)]) : match) as T;
  }, [language]);
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.source !== window.parent || event.origin !== "https://artx-hub.vercel.app" || event.data?.type !== "ARTX_HUB_LANGUAGE" || !["pt", "en"].includes(event.data.language)) return;
      setLanguage(event.data.language);
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [setLanguage]);
  useEffect(() => { document.documentElement.lang = language === "en" ? "en" : "pt-BR"; }, [language]);
  const value = useMemo(() => ({ language, locale: language === "en" ? "en-GB" : "pt-BR", t, setLanguage }), [language, t, setLanguage]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n() { return useContext(I18nContext); }
export function LanguageSwitch() {
  const { language, setLanguage } = useI18n();
  return <div style={{ display: "inline-flex", gap: 3, border: "1px solid #63837766", borderRadius: 8, padding: 3 }} role="group" aria-label="Language / Idioma">{(["pt", "en"] as const).map(value => <button key={value} type="button" onClick={() => setLanguage(value)} aria-pressed={language === value} style={{ border: 0, padding: "6px 9px", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer", color: language === value ? "#fff" : "inherit", background: language === value ? "#326d52" : "transparent" }}>{value.toUpperCase()}</button>)}</div>;
}

"use client";

import { LANGS } from "@/lib/i18n";
import { useMemos } from "./MemoProvider";

/** 첫 화면의 언어 선택 틀 */
export function LangSwitch() {
  const { lang, setLang, t } = useMemos();
  return (
    <div className="lang-switch" role="radiogroup" aria-label={t("lang.label")}>
      {LANGS.map((l) => (
        <button key={l.id} role="radio" aria-checked={lang === l.id} className={lang === l.id ? "on" : ""} onClick={() => setLang(l.id)} lang={l.id}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

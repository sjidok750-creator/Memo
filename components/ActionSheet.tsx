"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, categoryOf } from "@/lib/categories";
import { memoToMarkdown } from "@/lib/format";
import { memoHref } from "@/lib/demo";
import type { CategoryId, Memo } from "@/lib/types";
import { KindIcon } from "./MemoCard";
import { useMemos } from "./MemoProvider";
import { IconArrowRight, IconCopy, IconRefresh, IconTrash, IconX } from "./Icons";

/** 카드를 꾹 눌렀을 때 뜨는 메뉴: 열기 · 분야 · 다시 요약 · 복사 · 삭제 */
export function ActionSheet({ memo, onClose }: { memo: Memo; onClose: () => void }) {
  const router = useRouter();
  const { patch, remove, toast, lang, t, job, startJob } = useMemos();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const setCategory = async (id: CategoryId) => {
    if (id === memo.category) return;
    const ok = await patch(memo.id, { category: id });
    toast(ok ? t("detail.categoryChanged", { name: categoryOf(id).label[lang] }) : t("detail.saveFailed"));
  };
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(memoToMarkdown(memo, lang));
      toast(t("detail.copied"));
    } catch {
      toast(t("detail.copyFailed"));
    }
    onClose();
  };
  const onDelete = async () => {
    if (!window.confirm(t("detail.deleteConfirm"))) return;
    await remove(memo.id);
    toast(t("detail.deleted"));
    onClose();
  };
  const onRedo = () => {
    if (job) return;
    if (!window.confirm(t("detail.redoConfirm"))) return;
    startJob({ kind: memo.kind, replace: memo.id, lang }, memo.title);
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" aria-label={memo.title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <span className="kind">
            <KindIcon kind={memo.kind} size={14} />
          </span>
          <strong className="sheet-title">{memo.title}</strong>
          <button className="btn ghost sm" onClick={onClose} aria-label={t("capture.close")}>
            <IconX />
          </button>
        </div>

        <button
          className="sheet-item primary"
          onClick={() => {
            onClose();
            router.push(memoHref(memo.id));
          }}
        >
          <IconArrowRight size={16} /> {t("sheet.open")}
        </button>

        <div className="sheet-section">{t("sheet.category")}</div>
        <div className="sheet-cats">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`chip ${memo.category === c.id ? "on" : ""}`}
              style={{ "--c": `light-dark(${c.color}, ${c.dark})` } as React.CSSProperties}
              onClick={() => void setCategory(c.id)}
              aria-pressed={memo.category === c.id}
            >
              {c.label[lang]}
            </button>
          ))}
        </div>

        <div className="sheet-actions">
          {memo.kind !== "note" && (
            <button className="sheet-item" onClick={onRedo} disabled={Boolean(job)}>
              <IconRefresh size={16} /> {t("detail.redo")}
            </button>
          )}
          <button className="sheet-item" onClick={onCopy}>
            <IconCopy size={16} /> {t("detail.copy")}
          </button>
          <button className="sheet-item danger" onClick={onDelete}>
            <IconTrash size={16} /> {t("detail.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

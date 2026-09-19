"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { categoryOf } from "@/lib/categories";
import { formatDateShort, kindLabel } from "@/lib/format";
import type { Memo } from "@/lib/types";
import { imageSrc, memoHref } from "@/lib/demo";
import { IconBook, IconImage, IconMore, IconPlay, IconQuote } from "./Icons";
import { useMemos } from "./MemoProvider";
import { useMemoThumb } from "./useMemoThumb";

export function KindIcon({ kind, size = 13 }: { kind: Memo["kind"]; size?: number }) {
  if (kind === "youtube") return <IconPlay size={size} />;
  if (kind === "book") return <IconBook size={size} />;
  if (kind === "note") return <IconQuote size={size} />;
  return <IconImage size={size} />;
}

const HOLD_MS = 450;

/**
 * 메모 카드. 탭하면 열리고, 꾹 누르거나(모바일) 우클릭·⋯ 버튼(PC)으로 메뉴가 열린다.
 * 링크(<a>)가 아니라 div 인 이유: iOS 에서 링크를 길게 누르면 브라우저의 링크 미리보기가 떠서 우리 메뉴를 못 연다.
 */
export function MemoCard({ memo, index = 0, onMenu }: { memo: Memo; index?: number; onMenu: (memo: Memo) => void }) {
  const { lang, t } = useMemos();
  const router = useRouter();
  const thumb = useMemoThumb(memo, lang);
  const cat = categoryOf(memo.category);
  const c = { "--c": `light-dark(${cat.color}, ${cat.dark})` } as React.CSSProperties;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    fired.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    clear();
    timer.current = setTimeout(() => {
      fired.current = true;
      if (navigator.vibrate) navigator.vibrate(12);
      onMenu(memo);
    }, HOLD_MS);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear();
  };
  const onPointerEnd = () => {
    clear();
    start.current = null;
  };
  const onClick = () => {
    if (fired.current) {
      fired.current = false;
      return;
    }
    router.push(memoHref(memo.id));
  };

  return (
    <div
      className="card"
      role="link"
      tabIndex={0}
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onPointerLeave={onPointerEnd}
      onContextMenu={(e) => {
        e.preventDefault();
        clear();
        fired.current = true;
        onMenu(memo);
      }}
    >
      <button
        className="card-more"
        aria-label={t("sheet.more")}
        onClick={(e) => {
          e.stopPropagation();
          onMenu(memo);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <IconMore size={16} />
      </button>
      {memo.kind === "youtube" && memo.source.thumbnail && (
        <div className="card-media">
          <img src={imageSrc(memo.source.thumbnail)} alt="" loading="lazy" draggable={false} onError={(e) => e.currentTarget.classList.add("broken")} />
          <div className="play">
            <span>
              <IconPlay size={18} />
            </span>
          </div>
        </div>
      )}
      {memo.kind === "note" &&
        (memo.source.image ? (
          <div className="card-media">
            <img src={imageSrc(memo.source.image)} alt="" loading="lazy" draggable={false} />
          </div>
        ) : (
          <div className="card-media card-note" style={c}>
            <IconQuote size={18} />
            <p>{memo.summary}</p>
          </div>
        ))}
      {memo.kind === "photo" && memo.source.image && (
        <div className="card-media">
          <img src={imageSrc(memo.source.image)} alt="" loading="lazy" draggable={false} />
        </div>
      )}
      {memo.kind === "book" && (
        <div className="card-media card-book" style={c}>
          {/* 대표 이미지를 찾는 동안에도 빈 칸이 보이지 않게 글자 표지를 깔아 둔다 */}
          <div className="cover" style={c}>
            {memo.title}
          </div>
          {thumb && (
            <div className="thumb-real">
              <img className="thumb-blur" src={thumb.src} alt="" aria-hidden loading="lazy" draggable={false} />
              <img
                className="thumb-img"
                src={thumb.src}
                alt={t(thumb.source === "book" ? "card.cover" : "card.thumb")}
                loading="lazy"
                draggable={false}
                onLoad={(e) => {
                  e.currentTarget.parentElement?.classList.add("shown");
                  thumb.onLoad();
                }}
                onError={thumb.onError}
              />
            </div>
          )}
        </div>
      )}
      <div className="card-body">
        <div className="card-top">
          <span className="kind">
            <KindIcon kind={memo.kind} />
            {kindLabel(memo.kind, lang)}
          </span>
          <span className="chip" style={c}>
            {cat.label[lang]}
          </span>
        </div>
        {/* 글귀는 그림 칸에 글이 그대로 있으므로 제목을 또 쓰지 않는다 */}
        {memo.kind !== "note" && <h3 className="card-title">{memo.title}</h3>}
        {memo.kind === "note" ? (
          memo.oneLiner.trim() && <p className="card-line from">{memo.oneLiner}</p>
        ) : (
          <p className="card-line">{memo.oneLiner}</p>
        )}
        <div className="card-foot">
          <span className="tags">{memo.tags.slice(0, 3).map((x) => `#${x}`).join("  ")}</span>
          <time dateTime={memo.createdAt}>{formatDateShort(memo.createdAt, lang)}</time>
        </div>
      </div>
    </div>
  );
}

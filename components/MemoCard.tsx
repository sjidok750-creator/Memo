"use client";

import Link from "next/link";
import { categoryOf } from "@/lib/categories";
import { formatDateShort, kindLabel } from "@/lib/format";
import type { Memo } from "@/lib/types";
import { imageSrc, memoHref } from "@/lib/demo";
import { IconBook, IconImage, IconPlay } from "./Icons";
import { useMemos } from "./MemoProvider";

export function KindIcon({ kind, size = 13 }: { kind: Memo["kind"]; size?: number }) {
  if (kind === "youtube") return <IconPlay size={size} />;
  if (kind === "book") return <IconBook size={size} />;
  return <IconImage size={size} />;
}

export function MemoCard({ memo, index = 0 }: { memo: Memo; index?: number }) {
  const { lang } = useMemos();
  const cat = categoryOf(memo.category);
  const c = { "--c": `light-dark(${cat.color}, ${cat.dark})` } as React.CSSProperties;

  return (
    <Link href={memoHref(memo.id)} className="card" style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}>
      {memo.kind === "youtube" && memo.source.thumbnail && (
        <div className="card-media">
          <img src={imageSrc(memo.source.thumbnail)} alt="" loading="lazy" onError={(e) => e.currentTarget.classList.add("broken")} />
          <div className="play">
            <span>
              <IconPlay size={18} />
            </span>
          </div>
        </div>
      )}
      {memo.kind === "photo" && memo.source.image && (
        <div className="card-media">
          <img src={imageSrc(memo.source.image)} alt="" loading="lazy" />
        </div>
      )}
      {memo.kind === "book" && (
        <div className="card-media card-book" style={c}>
          <div className="cover" style={c}>
            {memo.title}
          </div>
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
        <h3 className="card-title">{memo.title}</h3>
        <p className="card-line">{memo.oneLiner}</p>
        <div className="card-foot">
          <span className="tags">{memo.tags.slice(0, 3).map((x) => `#${x}`).join("  ")}</span>
          <time dateTime={memo.createdAt}>{formatDateShort(memo.createdAt, lang)}</time>
        </div>
      </div>
    </Link>
  );
}

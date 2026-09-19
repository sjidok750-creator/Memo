"use client";

import Link from "next/link";
import { categoryOf } from "@/lib/categories";
import { formatDateShort, KIND_LABEL } from "@/lib/format";
import type { Memo } from "@/lib/types";
import { IconBook, IconImage, IconPlay } from "./Icons";

export function KindIcon({ kind, size = 13 }: { kind: Memo["kind"]; size?: number }) {
  if (kind === "youtube") return <IconPlay size={size} />;
  if (kind === "book") return <IconBook size={size} />;
  return <IconImage size={size} />;
}

export function MemoCard({ memo, index = 0 }: { memo: Memo; index?: number }) {
  const cat = categoryOf(memo.category);
  const c = { "--c": `light-dark(${cat.color}, ${cat.dark})` } as React.CSSProperties;

  return (
    <Link href={`/memo/${memo.id}`} className="card" style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}>
      {memo.kind === "youtube" && memo.source.thumbnail && (
        <div className="card-media">
          <img src={memo.source.thumbnail} alt="" loading="lazy" onError={(e) => e.currentTarget.classList.add("broken")} />
          <div className="play">
            <span>
              <IconPlay size={18} />
            </span>
          </div>
        </div>
      )}
      {memo.kind === "photo" && memo.source.image && (
        <div className="card-media">
          <img src={`/api/files/${memo.source.image}`} alt="" loading="lazy" />
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
            {KIND_LABEL[memo.kind]}
          </span>
          <span className="chip" style={c}>
            {cat.label}
          </span>
        </div>
        <h3 className="card-title">{memo.title}</h3>
        <p className="card-line">{memo.oneLiner}</p>
        <div className="card-foot">
          <span className="tags">{memo.tags.slice(0, 3).map((t) => `#${t}`).join("  ")}</span>
          <time dateTime={memo.createdAt}>{formatDateShort(memo.createdAt)}</time>
        </div>
      </div>
    </Link>
  );
}

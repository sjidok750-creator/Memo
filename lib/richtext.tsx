import type { ReactNode } from "react";

/**
 * Claude 가 돌려준 요약 텍스트를 화면에 그린다.
 * 지원 문법: 빈 줄 = 문단, `**구절**` = 핵심 강조(굵게+밑줄+강조색), 줄 첫머리 "- " 또는 "• " = 목록.
 * HTML 을 직접 넣지 않으므로 XSS 걱정이 없다.
 */
export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <strong className="hl" key={k++}>
        {m[1]}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function renderRich(text: string): ReactNode {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((block, i) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const isList = lines.length > 0 && lines.every((l) => /^([-•▪·]|\d+[.)])\s+/.test(l));
    if (isList) {
      return (
        <ul key={i}>
          {lines.map((l, j) => (
            <li key={j}>{renderInline(l.replace(/^([-•▪·]|\d+[.)])\s+/, ""))}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i}>
        {lines.map((l, j) => (
          <span key={j}>
            {j > 0 && <br />}
            {renderInline(l)}
          </span>
        ))}
      </p>
    );
  });
}

/** 강조 마크를 벗겨 순수 텍스트로 (카드 미리보기·복사용) */
export function stripMarks(text: string): string {
  return text.replace(/\*\*([^*]+?)\*\*/g, "$1");
}

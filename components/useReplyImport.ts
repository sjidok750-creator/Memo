"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { memoHref } from "@/lib/demo";
import { clearPendingImport, parseClaudeReply, readPendingImport } from "@/lib/claude-app";
import { parseYouTubeId } from "@/lib/youtube";
import type { MemoSource } from "@/lib/types";
import { useMemos } from "./MemoProvider";

/**
 * Claude 앱에서 받아온 답(JSON 텍스트)을 메모로 저장하고 상세로 이동한다.
 * 열 때 저장해 둔 입력(URL·사진·메모)을 합친다. 입력창, 클립보드 버튼, 공유 주소(#import=) 가 함께 쓴다.
 */
export function useReplyImport() {
  const { importMemo, toast, t } = useMemos();
  const router = useRouter();

  return useCallback(
    async (replyText: string, attached?: { image?: string; note?: string }): Promise<boolean> => {
      const parsed = parseClaudeReply(replyText);
      if ("error" in parsed) return false;
      const pending = readPendingImport();
      const kind = parsed.kind ?? pending?.kind ?? (parsed.content.meta.channel ? "youtube" : "book");
      const source: MemoSource = {};
      if (kind === "youtube") {
        const url = pending?.kind === "youtube" ? pending.input : undefined;
        const id = url ? parseYouTubeId(url) : null;
        if (url) source.url = url;
        if (id) {
          source.videoId = id;
          source.thumbnail = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
        }
        source.transcript = false;
      } else if (kind === "book") {
        source.query = pending?.kind === "book" ? pending.input : parsed.content.title;
      } else {
        const img = attached?.image ?? (pending?.kind === "photo" ? pending.image : undefined);
        if (img) source.image = img;
        const note = attached?.note ?? pending?.note;
        if (note) source.note = note;
      }
      try {
        const memo = await importMemo(parsed.content, kind, source);
        clearPendingImport();
        toast(t("app.saved"));
        router.push(memoHref(memo.id));
        return true;
      } catch {
        toast(t("detail.saveFailed"));
        return false;
      }
    },
    [importMemo, toast, t, router],
  );
}

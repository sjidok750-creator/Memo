import { hasApiKey, summarizeBook, summarizePhoto, summarizeYouTube } from "./claude";
import { createMemo, findByVideoId, newId, saveImage } from "./store";
import { fetchTranscript, fetchVideoInfo, parseYouTubeId } from "./youtube";
import type { CaptureEvent, CaptureRequest, Memo } from "./types";

export class CaptureError extends Error {}

/**
 * 입력 종류에 따라 원문을 모으고 Claude 로 요약해 메모를 저장한다.
 * 진행 상황은 emit 으로 흘려보낸다.
 */
export interface CaptureOutcome {
  memo: Memo;
  duplicate: boolean;
}

export async function runCapture(req: CaptureRequest, emit: (e: CaptureEvent) => void, signal?: AbortSignal): Promise<CaptureOutcome> {
  if (!hasApiKey()) {
    throw new CaptureError("ANTHROPIC_API_KEY 가 설정되지 않았습니다. .env.local 파일에 키를 넣고 서버를 다시 시작하세요.");
  }
  const now = new Date().toISOString();
  const base = { id: newId(), createdAt: now, updatedAt: now };

  if (req.kind === "youtube") {
    const input = (req.input ?? "").trim();
    const videoId = parseYouTubeId(input);
    if (!videoId) throw new CaptureError("유튜브 영상 주소를 알아볼 수 없습니다.");

    const dup = await findByVideoId(videoId);
    if (dup) return { memo: dup, duplicate: true };

    emit({ type: "stage", id: "source", label: "영상 정보 확인" });
    const info = await fetchVideoInfo(videoId);
    emit({ type: "stage", id: "transcript", label: "자막 수집" });
    const transcript = await fetchTranscript(videoId);
    emit({ type: "stage", id: "summarize", label: transcript ? "자막 읽고 요약 작성" : "자막이 없어 웹에서 조사 후 요약" });
    const { content, model } = await summarizeYouTube(info, transcript, signal);
    emit({ type: "stage", id: "save", label: "분야 분류 및 저장" });
    const memo = await createMemo({
      ...base,
      ...content,
      kind: "youtube",
      model,
      source: { url: info.url, videoId, thumbnail: info.thumbnail, transcript: Boolean(transcript) },
      meta: { ...content.meta, channel: content.meta.channel ?? info.author },
    });
    return { memo, duplicate: false };
  }

  if (req.kind === "book") {
    const query = (req.input ?? "").trim();
    if (!query) throw new CaptureError("책 제목을 입력하세요.");
    if (query.length > 200) throw new CaptureError("책 제목이 너무 깁니다.");
    emit({ type: "stage", id: "search", label: "책 정보 검색" });
    emit({ type: "stage", id: "summarize", label: "핵심 내용 요약 · 명문장 발췌" });
    const { content, model } = await summarizeBook(query, signal);
    emit({ type: "stage", id: "save", label: "분야 분류 및 저장" });
    return { memo: await createMemo({ ...base, ...content, kind: "book", model, source: { query } }), duplicate: false };
  }

  if (req.kind === "photo") {
    if (!req.image) throw new CaptureError("사진이 없습니다.");
    emit({ type: "stage", id: "upload", label: "사진 저장" });
    const saved = await saveImage(req.image);
    emit({ type: "stage", id: "summarize", label: "사진 읽고 요약 작성" });
    const note = req.note?.trim() || undefined;
    const { content, model } = await summarizePhoto(saved, note, signal);
    emit({ type: "stage", id: "save", label: "분야 분류 및 저장" });
    return { memo: await createMemo({ ...base, ...content, kind: "photo", model, source: { image: saved.file, note } }), duplicate: false };
  }

  throw new CaptureError("알 수 없는 입력 종류입니다.");
}

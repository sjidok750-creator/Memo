/**
 * 브라우저 모드 캡처: 서버 없이 이 기기에서 Claude 를 직접 불러 요약하고 localStorage 에 저장한다.
 * 유튜브 자막은 브라우저에서 가져올 수 없어(CORS) Claude 의 웹 검색·페이지 읽기로 조사한다.
 */
import { summarizeBook, summarizePhoto, summarizeYouTube } from "./claude";
import { clientStore } from "./store-client";
import { parseYouTubeId } from "./youtube";
import type { CaptureEvent, CaptureRequest, Memo } from "./types";
import type { Lang } from "./i18n";

export async function browserCapture(req: CaptureRequest, emit: (e: CaptureEvent) => void, signal?: AbortSignal): Promise<{ memo: Memo; duplicate: boolean }> {
  const now = new Date().toISOString();
  const lang = req.lang ?? "ko";

  if (req.replace) {
    const existing = await clientStore.get(req.replace, lang);
    if (!existing) throw new Error("다시 요약할 메모를 찾을 수 없습니다.");
    return { memo: await resummarize(existing, emit, signal, lang), duplicate: false };
  }

  const id = `m-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const base = { id, createdAt: now, updatedAt: now };

  if (req.kind === "youtube") {
    const input = (req.input ?? "").trim();
    const videoId = parseYouTubeId(input);
    if (!videoId) throw new Error("유튜브 영상 주소를 알아볼 수 없습니다.");
    const dup = (await clientStore.list(lang)).find((m) => m.kind === "youtube" && m.source.videoId === videoId);
    if (dup) return { memo: dup, duplicate: true };
    emit({ type: "stage", id: "source", label: "영상 정보 확인" });
    const info = { id: videoId, url: `https://www.youtube.com/watch?v=${videoId}`, title: null, author: null, thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` };
    emit({ type: "stage", id: "transcript-web", label: "브라우저에서는 자막을 못 읽어 웹에서 조사" });
    emit({ type: "stage", id: "summarize-web", label: "영상 내용 조사 후 요약 작성" });
    const { content, model } = await summarizeYouTube(info, null, signal, lang, (id) => emit({ type: "stage", id, label: id }));
    emit({ type: "stage", id: "save", label: "분야 분류 및 저장" });
    const memo: Memo = { ...base, ...content, kind: "youtube", model, source: { url: info.url, videoId, thumbnail: info.thumbnail, transcript: false } };
    return { memo: await clientStore.add(memo), duplicate: false };
  }

  if (req.kind === "book") {
    const query = (req.input ?? "").trim();
    if (!query) throw new Error("책 제목을 입력하세요.");
    emit({ type: "stage", id: "search", label: "책 정보 검색" });
    emit({ type: "stage", id: "summarize-book", label: "핵심 내용 요약 · 명문장 발췌" });
    const { content, model } = await summarizeBook(query, signal, lang, (id) => emit({ type: "stage", id, label: id }));
    emit({ type: "stage", id: "save", label: "분야 분류 및 저장" });
    const memo: Memo = { ...base, ...content, kind: "book", model, source: { query } };
    return { memo: await clientStore.add(memo), duplicate: false };
  }

  if (!req.image) throw new Error("사진이 없습니다.");
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s.exec(req.image);
  if (!m) throw new Error("지원하지 않는 이미지 형식입니다.");
  emit({ type: "stage", id: "upload", label: "사진 준비" });
  emit({ type: "stage", id: "summarize-photo", label: "사진 읽고 요약 작성" });
  const note = req.note?.trim() || undefined;
  const { content, model } = await summarizePhoto({ mediaType: m[1], base64: m[2] }, note, signal, lang);
  emit({ type: "stage", id: "save", label: "분야 분류 및 저장" });
  const memo: Memo = { ...base, ...content, kind: "photo", model, source: { image: req.image, note } };
  return { memo: await clientStore.add(memo), duplicate: false };
}

async function resummarize(memo: Memo, emit: (e: CaptureEvent) => void, signal: AbortSignal | undefined, lang: Lang): Promise<Memo> {
  if (memo.kind === "youtube") {
    const videoId = memo.source.videoId ?? parseYouTubeId(memo.source.url ?? "");
    if (!videoId) throw new Error("이 메모에는 영상 주소가 없습니다.");
    emit({ type: "stage", id: "summarize-web", label: "영상 내용 조사 후 요약 작성" });
    const info = { id: videoId, url: `https://www.youtube.com/watch?v=${videoId}`, title: null, author: null, thumbnail: memo.source.thumbnail ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` };
    const { content, model } = await summarizeYouTube(info, null, signal, lang, (id) => emit({ type: "stage", id, label: id }));
    return (await clientStore.patch(memo.id, { ...content, model }, lang))!;
  }
  if (memo.kind === "book") {
    emit({ type: "stage", id: "summarize-book", label: "핵심 내용 요약 · 명문장 발췌" });
    const { content, model } = await summarizeBook(memo.source.query || memo.title, signal, lang, (id) => emit({ type: "stage", id, label: id }));
    return (await clientStore.patch(memo.id, { ...content, model }, lang))!;
  }
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s.exec(memo.source.image ?? "");
  if (!m) throw new Error("이 메모의 사진은 다시 읽을 수 없습니다 (예시 메모이거나 파일이 없음).");
  emit({ type: "stage", id: "summarize-photo", label: "사진 읽고 요약 작성" });
  const { content, model } = await summarizePhoto({ mediaType: m[1], base64: m[2] }, memo.source.note, signal, lang);
  return (await clientStore.patch(memo.id, { ...content, model }, lang))!;
}

/**
 * 유튜브 영상 정보·자막 수집.
 * 외부 패키지 없이 (1) oEmbed, (2) watch 페이지의 플레이어 응답, (3) InnerTube player API 를 차례로 시도한다.
 */

export interface VideoInfo {
  id: string;
  url: string;
  title: string | null;
  author: string | null;
  thumbnail: string;
}

export interface Transcript {
  text: string;
  lang: string;
  /** 자동 생성 자막 여부 */
  auto: boolean;
  segments: number;
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** 다양한 형태의 유튜브 주소에서 11자리 영상 ID 를 뽑는다. 유튜브가 아니면 null. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (YT_ID.test(s)) return null; // 맨 ID 만 넣은 경우는 링크로 취급하지 않는다 (책 제목일 수 있음)
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\.|^music\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && YT_ID.test(id) ? id : null;
  }
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;
  const v = url.searchParams.get("v");
  if (v && YT_ID.test(v)) return v;
  const m = /^\/(?:shorts|live|embed|v)\/([A-Za-z0-9_-]{11})/.exec(url.pathname);
  return m ? m[1] : null;
}

export function isUrlLike(input: string): boolean {
  return /^(https?:\/\/|www\.)\S+$/i.test(input.trim()) || /^[\w.-]+\.(com|net|org|io|kr|be|tv)(\/\S*)?$/i.test(input.trim());
}

export async function fetchVideoInfo(id: string): Promise<VideoInfo> {
  const url = `https://www.youtube.com/watch?v=${id}`;
  const info: VideoInfo = { id, url, title: null, author: null, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
      headers: { "User-Agent": BROWSER_UA },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const j = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
      info.title = j.title ?? null;
      info.author = j.author_name ?? null;
      if (j.thumbnail_url) info.thumbnail = j.thumbnail_url;
    }
  } catch {
    /* oEmbed 실패는 치명적이지 않다 */
  }
  return info;
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string; // "asr" = 자동 생성
  name?: { simpleText?: string; runs?: { text: string }[] };
}

/** `ytInitialPlayerResponse = {...}` 처럼 소스에 박힌 JSON 객체를 중괄호 짝을 맞춰 잘라낸다 */
export function extractJsonObject(src: string, marker: string): unknown | null {
  const at = src.indexOf(marker);
  if (at < 0) return null;
  const start = src.indexOf("{", at);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(src.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function tracksFromPlayer(player: unknown): CaptionTrack[] {
  const p = player as { captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } } } | null;
  return p?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
}

async function tracksFromWatchPage(id: string): Promise<CaptionTrack[]> {
  const res = await fetch(`https://www.youtube.com/watch?v=${id}&hl=ko&bpctr=9999999999&has_verified=1`, {
    headers: {
      "User-Agent": BROWSER_UA,
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      Cookie: "CONSENT=YES+cb; SOCS=CAI",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  return tracksFromPlayer(extractJsonObject(html, "ytInitialPlayerResponse"));
}

async function tracksFromInnerTube(id: string): Promise<CaptionTrack[]> {
  const clientVersion = "20.10.38";
  const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": `com.google.android.youtube/${clientVersion} (Linux; U; Android 11) gzip`,
      "X-YouTube-Client-Name": "3",
      "X-YouTube-Client-Version": clientVersion,
    },
    body: JSON.stringify({
      context: { client: { clientName: "ANDROID", clientVersion, androidSdkVersion: 30, hl: "ko", gl: "KR" } },
      videoId: id,
      contentCheckOk: true,
      racyCheckOk: true,
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return [];
  return tracksFromPlayer(await res.json());
}

function pickTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (!tracks.length) return null;
  const score = (t: CaptionTrack) => {
    const lang = t.languageCode.toLowerCase();
    const manual = t.kind !== "asr";
    if (lang.startsWith("ko")) return manual ? 0 : 1;
    if (lang.startsWith("en")) return manual ? 2 : 3;
    return manual ? 4 : 5;
  };
  return tracks.slice().sort((a, b) => score(a) - score(b))[0];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

/** 유튜브 json3 자막 응답 → 줄 단위 텍스트 */
export function parseJson3(body: string): string[] {
  const j = JSON.parse(body) as { events?: { segs?: { utf8?: string }[] }[] };
  return (j.events ?? [])
    .map((e) => (e.segs ?? []).map((s) => s.utf8 ?? "").join(""))
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** 유튜브 기본 timedtext XML → 줄 단위 텍스트 */
export function parseTimedTextXml(xml: string): string[] {
  const lines: string[] = [];
  const re = /<(?:text|p)\b[^>]*>([\s\S]*?)<\/(?:text|p)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const t = decodeEntities(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    if (t) lines.push(t);
  }
  return lines;
}

async function downloadTrack(track: CaptionTrack): Promise<{ text: string; segments: number } | null> {
  const headers = { "User-Agent": BROWSER_UA, "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8" };
  // 1) json3
  try {
    const url = track.baseUrl.includes("fmt=") ? track.baseUrl.replace(/fmt=[^&]*/, "fmt=json3") : `${track.baseUrl}&fmt=json3`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
    if (res.ok) {
      const body = await res.text();
      if (body.trim().startsWith("{")) {
        const lines = parseJson3(body);
        if (lines.length) return { text: lines.join("\n"), segments: lines.length };
      }
    }
  } catch {
    /* fall through */
  }
  // 2) 기본 XML
  try {
    const res = await fetch(track.baseUrl, { headers, signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const lines = parseTimedTextXml(await res.text());
    if (lines.length) return { text: lines.join("\n"), segments: lines.length };
  } catch {
    /* ignore */
  }
  return null;
}

export async function fetchTranscript(id: string): Promise<Transcript | null> {
  const sources = [tracksFromWatchPage, tracksFromInnerTube];
  for (const source of sources) {
    let tracks: CaptionTrack[] = [];
    try {
      tracks = await source(id);
    } catch {
      continue;
    }
    const track = pickTrack(tracks);
    if (!track) continue;
    const got = await downloadTrack(track);
    if (got) return { text: got.text, lang: track.languageCode, auto: track.kind === "asr", segments: got.segments };
  }
  return null;
}

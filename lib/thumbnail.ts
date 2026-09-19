/**
 * 메모의 대표 이미지 찾기.
 *
 * 책이면 그 책의 표지를, 인물이면 그 사람의 사진을, 개념·사건·과학 주제면
 * 관련 그림을 찾는다. 주소 "후보"만 순서대로 모아 주고, 실제로 그 주소가
 * 열리는지는 <img> 가 판정한다 (fetch 로 확인하면 CORS 에 막히지만 <img> 는 안 막힌다).
 *
 * 찾는 곳
 * - 책: Open Library 표지(ISBN) → Google Books → Open Library 검색
 * - 그 밖: 위키백과 (UI 언어판 → 영어판), 제목으로 안 되면 첫 태그로
 *
 * 어느 하나가 막히거나 느려도 조용히 다음으로 넘어가고, 전부 실패하면 빈 목록이다
 * (그러면 화면은 지금까지 쓰던 글자 표지를 그대로 보여 준다).
 */
import type { Lang } from "./i18n";

/** 한 곳에 거는 시간 제한 */
const TIMEOUT_MS = 7000;
/** 화면에서 차례로 시도할 후보 최대 개수 */
const MAX_CANDIDATES = 4;
/** 위키백과에 거는 요청 수 상한 (제목·태그 × 언어판) */
const MAX_WIKI_CALLS = 3;

export type ThumbSource = "book" | "wikipedia";

export interface ThumbCandidate {
  url: string;
  source: ThumbSource;
}

export interface ThumbRef {
  title: string;
  author?: string | null;
  publisher?: string | null;
  year?: string | null;
  isbn?: string | null;
  tags?: string[];
  /** 위키백과를 어느 언어판부터 볼지 */
  lang?: Lang;
}

export interface ThumbLookup {
  /** 앞에서부터 시도할 이미지 주소 */
  candidates: ThumbCandidate[];
  /** 어느 곳에도 닿지 못했다 (네트워크 끊김·요청 한도 등). 이때의 "없음" 은 기억해 두면 안 된다 */
  unreachable: boolean;
}

/** 제목·저자 비교용 정규화 (공백·문장부호·대소문자 무시) */
export function norm(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　]+/g, "")
    .replace(/[-–—_.,:;!?'"“”‘’()[\]{}·・「」『』〈〉《》]/g, "");
}

/** 같은 것을 가리키는 메모인지 기기에 기억해 둘 때 쓰는 열쇠 */
export function thumbKey(ref: Pick<ThumbRef, "title" | "author">): string {
  return `${norm(ref.title)}|${norm(ref.author ?? "")}`;
}

function cleanIsbn(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.replace(/[^0-9Xx]/g, "").toUpperCase();
  return s.length === 10 || s.length === 13 ? s : null;
}

/** 두 이름이 같은 것을 가리키는지 (한쪽이 다른 쪽을 품어도 같은 것으로 본다) */
function titleMatches(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (x.length < 2 || y.length < 2) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/** 서지 정보가 붙어 있으면 책으로 본다 (인물·개념 메모에는 보통 없다) */
function looksLikeBook(ref: ThumbRef): boolean {
  return Boolean(ref.isbn || ref.publisher || (ref.author && ref.year));
}

/** 닿지 못했으면(네트워크 오류·한도 초과 등) reached=false — 이때는 "없음" 으로 기억하면 안 된다 */
interface Fetched<T> {
  data: T | null;
  reached: boolean;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<Fetched<T>> {
  try {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const s = signal && typeof AbortSignal.any === "function" ? AbortSignal.any([timeout, signal]) : timeout;
    const res = await fetch(url, { signal: s, headers: { Accept: "application/json" } });
    if (!res.ok) return { data: null, reached: false };
    return { data: (await res.json()) as T, reached: true };
  } catch {
    return { data: null, reached: false };
  }
}

const book = (url: string): ThumbCandidate => ({ url, source: "book" });
const wiki = (url: string): ThumbCandidate => ({ url, source: "wikipedia" });

/* ---------- 책 표지: Google Books ---------- */

interface GoogleVolume {
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    imageLinks?: Record<string, string>;
  };
}

/** 구글이 주는 표지 주소를 큰 것부터. http→https, 책장 모서리 효과 제거 */
function googleImages(links: Record<string, string> | undefined): string[] {
  if (!links) return [];
  const tidy = (u: string) => u.replace(/^http:/, "https:").replace(/&?edge=curl/, "");
  const out: string[] = [];
  for (const k of ["extraLarge", "large", "medium", "small", "thumbnail", "smallThumbnail"]) {
    const v = links[k];
    if (v) out.push(tidy(v));
  }
  // 작은 그림만 있으면 같은 주소의 확대판을 먼저 시도한다
  if (out.length && /zoom=\d/.test(out[0])) out.unshift(out[0].replace(/zoom=\d/, "zoom=2"));
  return out;
}

async function fromGoogle(ref: ThumbRef, isbn: string | null, signal?: AbortSignal): Promise<Fetched<string[]>> {
  const queries = isbn ? [`isbn:${isbn}`] : [[ref.title, ref.author].filter(Boolean).join(" "), `intitle:${ref.title}`];

  let reached = false;
  for (const q of queries) {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5&printType=books`;
    const got = await getJson<{ items?: GoogleVolume[] }>(url, signal);
    reached ||= got.reached;
    const items = got.data?.items ?? [];
    // ISBN 으로 찾았으면 그 책이 맞고, 제목으로 찾았으면 제목이 맞는 것만 쓴다
    const hit = items.find((it) => {
      const info = it.volumeInfo;
      if (!info?.imageLinks) return false;
      if (isbn) return true;
      return titleMatches(info.title ?? "", ref.title) || titleMatches(`${info.title ?? ""}${info.subtitle ?? ""}`, ref.title);
    });
    const urls = googleImages(hit?.volumeInfo?.imageLinks);
    if (urls.length) return { data: urls, reached: true };
  }
  return { data: [], reached };
}

/* ---------- 책 표지: Open Library ---------- */

interface OpenLibraryDoc {
  title?: string;
  author_name?: string[];
  cover_i?: number;
}

async function fromOpenLibrary(ref: ThumbRef, signal?: AbortSignal): Promise<Fetched<string[]>> {
  const q = [ref.title, ref.author].filter(Boolean).join(" ");
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=5&fields=title,author_name,cover_i`;
  const got = await getJson<{ docs?: OpenLibraryDoc[] }>(url, signal);
  const hit = (got.data?.docs ?? []).find((d) => d.cover_i && titleMatches(d.title ?? "", ref.title));
  return { data: hit?.cover_i ? [`https://covers.openlibrary.org/b/id/${hit.cover_i}-L.jpg`] : [], reached: got.reached };
}

async function fromBooks(ref: ThumbRef, isbn: string | null, signal?: AbortSignal): Promise<Fetched<ThumbCandidate[]>> {
  const out: string[] = [];
  // ISBN 을 알면 검색 없이 바로 열어 볼 수 있다 (표지가 없으면 404 라 <img> 가 다음으로 넘긴다)
  if (isbn) out.push(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`);

  const fail: Fetched<string[]> = { data: [], reached: false };
  const [google, openLibrary] = await Promise.all([
    fromGoogle(ref, isbn, signal).catch(() => fail),
    fromOpenLibrary(ref, signal).catch(() => fail),
  ]);
  for (const u of [...(google.data ?? []), ...(openLibrary.data ?? [])]) if (!out.includes(u)) out.push(u);

  return { data: out.map(book), reached: google.reached || openLibrary.reached || Boolean(isbn) };
}

/* ---------- 인물·개념·과학: 위키백과 ---------- */

interface WikiPage {
  title?: string;
  index?: number;
  thumbnail?: { source?: string };
  original?: { source?: string };
}

/** 동음이의·목록 문서는 대표 이미지로 쓸 만하지 않다 */
function skipPage(title: string | undefined): boolean {
  return !title || /\(동음이의\)|\(disambiguation\)|\(曖昧さ回避\)|^목록:|^List of |^一覧/.test(title);
}

async function fromWikipedia(ref: ThumbRef, signal?: AbortSignal): Promise<Fetched<ThumbCandidate[]>> {
  // 제목으로 먼저, 안 되면 가장 앞선 태그로 (태그는 보통 구체적인 명사다)
  const queries = [ref.title, ...(ref.tags ?? []).slice(0, 1)].map((q) => (q ?? "").trim()).filter((q) => q.length >= 2);
  const wikis = [...new Set([ref.lang ?? "ko", "en"])];

  let reached = false;
  let calls = 0;
  for (const q of queries) {
    for (const w of wikis) {
      if (calls >= MAX_WIKI_CALLS) return { data: [], reached };
      calls++;
      const url =
        `https://${w}.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
        `&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=3&gsrnamespace=0` +
        `&prop=pageimages&piprop=thumbnail|original&pithumbsize=800&pilimit=3`;
      const got = await getJson<{ query?: { pages?: Record<string, WikiPage> } }>(url, signal);
      reached ||= got.reached;
      const pages = Object.values(got.data?.query?.pages ?? {}).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
      const hit = pages.find((p) => (p.thumbnail?.source || p.original?.source) && !skipPage(p.title) && titleMatches(p.title ?? "", q));
      if (hit) {
        const urls: string[] = [];
        if (hit.thumbnail?.source) urls.push(hit.thumbnail.source);
        if (hit.original?.source && !urls.includes(hit.original.source)) urls.push(hit.original.source);
        return { data: urls.map(wiki), reached: true };
      }
    }
  }
  return { data: [], reached };
}

/* ---------- 합치기 ---------- */

/**
 * 대표 이미지 후보를 앞에서부터 시도할 순서로 돌려준다.
 * 책처럼 보이면 표지를 먼저 찾고, 아니면 인물·주제 그림을 먼저 찾는다.
 * 먼저 본 쪽에서 나오면 나머지는 부르지 않는다 (요청을 아낀다).
 */
export async function thumbnailCandidates(ref: ThumbRef, signal?: AbortSignal): Promise<ThumbLookup> {
  if (!ref.title.trim()) return { candidates: [], unreachable: false };
  const isbn = cleanIsbn(ref.isbn);

  const fail: Fetched<ThumbCandidate[]> = { data: [], reached: false };
  const books = () => fromBooks(ref, isbn, signal).catch(() => fail);
  const wikipedia = () => fromWikipedia(ref, signal).catch(() => fail);
  const [first, second] = looksLikeBook(ref) ? [books, wikipedia] : [wikipedia, books];

  const a = await first();
  if (a.data?.length) return { candidates: a.data.slice(0, MAX_CANDIDATES), unreachable: false };
  const b = await second();
  return {
    candidates: (b.data ?? []).slice(0, MAX_CANDIDATES),
    unreachable: !a.reached && !b.reached,
  };
}

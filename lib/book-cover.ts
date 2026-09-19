/**
 * 책 표지 찾기.
 *
 * 표지 "주소 후보"만 순서대로 모아 준다. 실제로 그 주소가 열리는지는 <img> 가 판정한다.
 * (fetch 로 확인하면 CORS 가 걸리지만 <img> 는 걸리지 않는다 — 그래서 확인을 화면에 맡긴다.)
 *
 * 찾는 곳: Open Library 표지(ISBN) → Google Books → Open Library 검색.
 * 어느 하나가 막히거나 느려도 조용히 다음으로 넘어가고, 전부 실패하면 빈 목록이다
 * (그러면 화면은 지금까지 쓰던 글자 표지를 그대로 보여 준다).
 */

/** 한 곳에 거는 시간 제한 */
const TIMEOUT_MS = 7000;
/** 화면에서 차례로 시도할 후보 최대 개수 */
const MAX_CANDIDATES = 4;

export interface BookRef {
  title: string;
  author?: string | null;
  isbn?: string | null;
}

/** 제목·저자 비교용 정규화 (공백·문장부호·대소문자 무시) */
export function norm(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　]+/g, "")
    .replace(/[-–—_.,:;!?'"“”‘’()[\]{}·・「」『』〈〉《》]/g, "");
}

/** 같은 책의 표지를 기기에 기억해 둘 때 쓰는 열쇠 */
export function coverKey(ref: BookRef): string {
  return `${norm(ref.title)}|${norm(ref.author ?? "")}`;
}

function cleanIsbn(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.replace(/[^0-9Xx]/g, "").toUpperCase();
  return s.length === 10 || s.length === 13 ? s : null;
}

/** 두 제목이 같은 책을 가리키는지 (한쪽이 다른 쪽을 품어도 같은 것으로 본다) */
function titleMatches(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (x.length < 2 || y.length < 2) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/** 닿지 못했으면(네트워크 오류·한도 초과 등) reached=false — 이때는 "표지 없음" 으로 기억하면 안 된다 */
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

/* ---------- Google Books ---------- */

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

async function fromGoogle(ref: BookRef, isbn: string | null, signal?: AbortSignal): Promise<Fetched<string[]>> {
  const queries = isbn
    ? [`isbn:${isbn}`]
    : [[ref.title, ref.author].filter(Boolean).join(" "), `intitle:${ref.title}`];

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

/* ---------- Open Library ---------- */

interface OpenLibraryDoc {
  title?: string;
  author_name?: string[];
  cover_i?: number;
}

async function fromOpenLibrary(ref: BookRef, signal?: AbortSignal): Promise<Fetched<string[]>> {
  const q = [ref.title, ref.author].filter(Boolean).join(" ");
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=5&fields=title,author_name,cover_i`;
  const got = await getJson<{ docs?: OpenLibraryDoc[] }>(url, signal);
  const hit = (got.data?.docs ?? []).find((d) => d.cover_i && titleMatches(d.title ?? "", ref.title));
  return { data: hit?.cover_i ? [`https://covers.openlibrary.org/b/id/${hit.cover_i}-L.jpg`] : [], reached: got.reached };
}

/* ---------- 합치기 ---------- */

export interface CoverLookup {
  /** 앞에서부터 시도할 표지 주소 */
  urls: string[];
  /** 어느 곳에도 닿지 못했다 (네트워크 끊김·요청 한도 등). 이때의 "없음" 은 기억해 두면 안 된다 */
  unreachable: boolean;
}

/**
 * 표지 주소 후보를 앞에서부터 시도할 순서로 돌려준다.
 * 한 곳이 실패해도 나머지는 계속 찾는다.
 */
export async function bookCoverCandidates(ref: BookRef, signal?: AbortSignal): Promise<CoverLookup> {
  if (!ref.title.trim()) return { urls: [], unreachable: false };
  const isbn = cleanIsbn(ref.isbn);

  const out: string[] = [];
  const push = (u: string) => {
    if (u && !out.includes(u)) out.push(u);
  };

  // ISBN 을 알면 검색 없이 바로 열어 볼 수 있다 (표지가 없으면 404 라 <img> 가 다음으로 넘긴다)
  if (isbn) push(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`);

  const fallback: Fetched<string[]> = { data: [], reached: false };
  const [google, openLibrary] = await Promise.all([
    fromGoogle(ref, isbn, signal).catch(() => fallback),
    fromOpenLibrary(ref, signal).catch(() => fallback),
  ]);
  for (const u of google.data ?? []) push(u);
  for (const u of openLibrary.data ?? []) push(u);

  return { urls: out.slice(0, MAX_CANDIDATES), unreachable: !google.reached && !openLibrary.reached };
}

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { MemoContentSchema } from "./schema";
import type { MemoContent } from "./types";
import type { Transcript, VideoInfo } from "./youtube";

export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";
const EFFORT = process.env.CLAUDE_EFFORT as "low" | "medium" | "high" | "xhigh" | "max" | undefined;
export const MOCK = process.env.MEMO_MOCK === "1";

export function hasApiKey(): boolean {
  return MOCK || Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ maxRetries: 2, timeout: 10 * 60 * 1000 });
  return _client;
}

const SYSTEM = `당신은 사용자의 개인 메모장에 들어갈 '읽기 노트'를 쓰는 편집자다. 모든 출력은 한국어, 간결한 문어체(~다)로 쓴다.

원칙
- 원문(자막·이미지·검색 결과)에 충실하게 정리한다. 원문에 없는 내용을 지어내지 않는다.
- summary 와 keyPoints 에서 가장 중요한 구절·문장은 **이렇게** 감싸 강조한다. 이 강조는 화면에서 굵은 글씨 + 밑줄 + 강조색으로 표시되므로 정말 핵심인 곳에만 쓴다: 문단당 1~2곳, 전체 글자 수의 20% 이하, 한 번의 강조는 짧은 구절에서 한 문장 사이.
- 강조 마크(**) 외의 마크다운 문법(#, -, >, 링크 등)은 쓰지 않는다. summary 의 문단은 빈 줄 하나로 나눈다.
- quotes 에는 실제로 존재한다고 확신하는 문장만 넣는다. 확신이 없으면 비운다. 외국어 원문이 있으면 note 에 원문을 적는다.
- oneLiner 는 강조 마크 없이 한 문장. title 은 간결하게.
- category 는 내용의 중심 주제에 맞춰 하나만 고른다.`;

type Tool = Anthropic.Beta.BetaToolUnion;

const WEB_TOOLS: Tool[] = [
  { type: "web_search_20260209", name: "web_search", max_uses: 6 },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3 },
];

export interface SummaryResult {
  content: MemoContent;
  model: string;
}

async function runSummary(userContent: Anthropic.Beta.BetaContentBlockParam[], tools: Tool[] = [], signal?: AbortSignal): Promise<SummaryResult> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: userContent }];
  const format = betaZodOutputFormat(MemoContentSchema);

  for (let turn = 0; turn < 6; turn++) {
    const stream = client().beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { format, ...(EFFORT ? { effort: EFFORT } : {}) },
        system: SYSTEM,
        messages,
        ...(tools.length ? { tools } : {}),
      },
      { signal },
    );
    const msg = await stream.finalMessage();

    if (msg.stop_reason === "refusal") {
      throw new Error("모델이 이 요청의 처리를 거절했습니다." + (msg.stop_details?.explanation ? ` (${msg.stop_details.explanation})` : ""));
    }
    if (msg.stop_reason === "pause_turn") {
      // 서버 도구(검색)가 길어져 잠시 멈춘 것 - 이어서 진행
      messages.push({ role: "assistant", content: msg.content });
      continue;
    }
    if (msg.stop_reason === "max_tokens") {
      throw new Error("요약이 너무 길어 잘렸습니다. 다시 시도해 주세요.");
    }

    const text = msg.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) throw new Error("모델이 빈 응답을 돌려주었습니다.");

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      // 구조화 출력이 깨진 드문 경우: 첫 { ... 마지막 } 만 잘라 재시도
      const s = text.indexOf("{");
      const e = text.lastIndexOf("}");
      if (s < 0 || e < 0) throw new Error("요약 결과를 해석할 수 없습니다.");
      json = JSON.parse(text.slice(s, e + 1));
    }
    const parsed = MemoContentSchema.safeParse(json);
    if (!parsed.success) throw new Error("요약 결과가 예상한 형식이 아닙니다: " + parsed.error.issues.map((i) => i.path.join(".")).join(", "));
    return { content: parsed.data, model: msg.model };
  }
  throw new Error("검색이 너무 오래 걸려 요약을 마치지 못했습니다.");
}

const MAX_TRANSCRIPT_CHARS = 300_000;

export async function summarizeYouTube(info: VideoInfo, transcript: Transcript | null, signal?: AbortSignal): Promise<SummaryResult> {
  if (MOCK) return mock("youtube", info.title ?? "유튜브 영상");
  const head = [
    "다음 유튜브 영상의 읽기 노트를 작성한다.",
    `URL: ${info.url}`,
    info.title ? `제목: ${info.title}` : null,
    info.author ? `채널: ${info.author}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (transcript) {
    let body = transcript.text;
    let cut = "";
    if (body.length > MAX_TRANSCRIPT_CHARS) {
      body = body.slice(0, MAX_TRANSCRIPT_CHARS);
      cut = "\n(자막이 매우 길어 뒷부분은 생략됨)";
    }
    const text = `${head}

아래는 영상 자막이다 (언어: ${transcript.lang}${transcript.auto ? ", 자동 생성" : ""}). 자동 생성 자막은 오타·구어체·문장 경계 오류가 섞여 있으니 의미 중심으로 읽는다.

<transcript>
${body}
</transcript>${cut}

지시
- summary: 영상이 말하는 핵심 주장과 흐름을 2~5문단으로. 핵심 문장은 **강조**.
- keyPoints: 4~8개.
- quotes: 영상 속 인상적인 발언 0~5개. 자막에 실제로 있는 말만, 구어체는 읽기 좋게 다듬되 뜻은 유지.
- meta.channel 에 채널명, meta.author 에 주요 발화자(알 수 있을 때).
- 자막을 직접 읽었으므로 confidence 는 high.
- 제목이 없거나 낚시성이면 내용을 담은 제목을 새로 짓는다.`;
    return runSummary([{ type: "text", text }], [], signal);
  }

  const text = `${head}

이 영상의 자막을 가져올 수 없었다. web_fetch 로 영상 페이지(${info.url})의 제목·설명·챕터를 읽고, web_search 로 이 영상을 다룬 글·요약·관련 기사를 찾아 내용을 최대한 정확히 파악한 뒤 노트를 작성한다.
- 확인되지 않는 내용은 쓰지 않는다. 검색 결과 기반이므로 confidence 는 medium 이하.
- summary 첫 문단에 "자막이 없어 영상 설명과 관련 자료를 바탕으로 정리했다"는 취지를 자연스럽게 한 문장 넣는다.
- quotes 는 출처가 확실한 발언만.`;
  return runSummary([{ type: "text", text }], WEB_TOOLS, signal);
}

export async function summarizeBook(query: string, signal?: AbortSignal): Promise<SummaryResult> {
  if (MOCK) return mock("book", query);
  const text = `다음 책의 읽기 노트를 작성한다: "${query}"

1) web_search 로 책을 정확히 특정한다 (정식 제목, 저자, 출판사, 출간 연도). 같은 제목의 책이 여럿이면 가장 널리 알려진 책을 고른다. 검색은 꼭 필요한 만큼만 (최대 6회).
2) 책의 핵심 주장·구조·중요 내용을 summary 로 2~5문단 정리하고, keyPoints 4~8개를 뽑는다. 핵심 문장은 **강조**.
3) 명대사·명문장을 quotes 로 5~10개 발췌한다. 검색 결과나 확실한 기억으로 확인되는 문장만. 번역서는 통용되는 한국어 번역을 우선하고, 원문을 알면 note 에 적는다. 인용문에는 강조 마크를 쓰지 않는다.
4) title 은 책의 정식 제목만 (저자는 meta.author 에).
5) 책을 특정하지 못했으면 title 에 입력값을 그대로 쓰고 summary 첫 문단에 그 사실을 밝힌 뒤 confidence 를 low 로 둔다.`;
  return runSummary([{ type: "text", text }], WEB_TOOLS, signal);
}

export async function summarizePhoto(
  image: { mediaType: string; base64: string },
  note: string | undefined,
  signal?: AbortSignal,
): Promise<SummaryResult> {
  if (MOCK) return mock("photo", note || "사진 메모");
  const text = `첨부한 사진의 읽기 노트를 작성한다.${note ? `\n\n사용자가 덧붙인 메모: "${note}"` : ""}

- 사진에 글이 있으면(책 페이지, 문서, 슬라이드, 화면 캡처, 안내문, 손글씨 등) 먼저 글을 정확히 읽고 그 내용을 summary 로 요약한다. 그대로 옮길 가치가 있는 문장은 quotes 에 넣는다 (사진 속 실제 문장만).
- 글이 없는 사진이면 무엇이 담겨 있는지, 장면의 맥락과 의미, 눈여겨볼 점을 정리한다. quotes 는 비운다.
- 사용자 메모가 있으면 그 관심사에 맞춰 정리한다.
- 사진을 직접 읽었으므로 confidence 는 high. 글자가 흐려 일부만 읽혔으면 medium.
- title 은 사진의 내용이 바로 떠오르게 짓는다.`;
  return runSummary(
    [
      { type: "image", source: { type: "base64", media_type: image.mediaType as "image/jpeg", data: image.base64 } },
      { type: "text", text },
    ],
    [],
    signal,
  );
}

/* ---------- 개발용 목업 (MEMO_MOCK=1) ---------- */
async function mock(kind: "youtube" | "book" | "photo", label: string): Promise<SummaryResult> {
  await new Promise((r) => setTimeout(r, 1800));
  const base = {
    tags: ["집중", "습관", "생산성", "주의력"],
    oneLiner: "산만함의 시대에 깊게 몰입하는 능력이야말로 가장 희소하고 가치 있는 기술이다.",
    summary:
      "저자는 현대 지식노동의 가장 큰 위기를 '얕은 일'의 범람으로 진단한다. 이메일, 메신저, 회의처럼 언제든 처리할 수 있는 일이 하루를 잘게 쪼개고, 그 사이에서 **진짜 가치를 만드는 깊은 몰입의 시간은 점점 사라진다.**\n\n딥 워크는 방해받지 않는 상태에서 인지 능력을 한계까지 밀어붙이는 활동이다. 이 능력은 타고나는 것이 아니라 훈련으로 길러지며, **주의력은 근육처럼 쓰는 방식에 따라 강해지기도 약해지기도 한다.**\n\n책의 후반부는 실천 전략을 다룬다. 몰입 시간을 달력에 먼저 박아 넣는 '리추얼', 지루함을 견디는 연습, 소셜미디어를 기본값에서 지우는 결단, 그리고 **하루의 끝에 일을 완전히 닫는 '셧다운 의식'**이 핵심이다.",
    keyPoints: [
      "**깊은 일은 희소하고, 희소하기 때문에 가치가 있다.** 경제는 이 능력을 가진 사람에게 보상한다.",
      "주의 잔여물: 작업을 전환할 때마다 이전 작업의 잔상이 남아 **다음 작업의 질을 떨어뜨린다.**",
      "몰입은 의지가 아니라 **환경과 의식(ritual)의 설계**로 만든다.",
      "지루함을 견디는 훈련이 곧 집중력 훈련이다. 스마트폰으로 매 순간을 채우면 뇌는 몰입을 잊는다.",
      "**셧다운 의식**으로 하루를 닫아야 다음 날의 깊은 일이 가능하다.",
    ],
    quotes: [
      { text: "깊이 있게 일하는 능력은 점점 희소해지는 동시에 점점 더 가치 있어지고 있다.", note: "1부, 원문: The ability to perform deep work is becoming increasingly rare at exactly the same time it is becoming increasingly valuable." },
      { text: "당신의 삶은 당신이 주의를 기울이는 것들의 합이다.", note: "위니프레드 갤러거를 인용한 대목" },
      { text: "얕은 일에 익숙해진 정신은 깊은 일을 낯설어한다.", note: null },
    ],
    meta: { author: "칼 뉴포트", publisher: "민음사", year: "2017", channel: null, duration: null },
    confidence: "high" as const,
  };
  const byKind = {
    youtube: { title: `${label} — 집중력을 되찾는 세 가지 방법`, category: "self" as const, meta: { ...base.meta, channel: "지식 채널", duration: "18:24" } },
    book: { title: label.replace(/\s*(칼 뉴포트|저자.*)$/, "") || "딥 워크", category: "self" as const, meta: base.meta },
    photo: { title: "책 페이지 — 주의력에 관한 단락", category: "self" as const, meta: { ...base.meta, publisher: null, year: null } },
  }[kind];
  return { content: { ...base, ...byKind }, model: "mock" };
}

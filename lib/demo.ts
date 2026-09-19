/**
 * 데모(정적 미리보기) 모드.
 * GitHub Pages 처럼 서버가 없는 곳에서 UI 를 보여주기 위해, API 대신 브라우저 안에서
 * 예시 메모를 다루고 요약 과정을 흉내낸다. `NEXT_PUBLIC_DEMO=1` 로 켜진다.
 */
import type { CaptureEvent, CaptureRequest, Memo, MemoKind } from "./types";
import { isBrowserConnected } from "./browser-key";
import type { Lang } from "./i18n";
import { remoteStore } from "./sync";

const remoteImageUrl = (ref: string) => remoteStore.imageUrl(ref);

export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** public/ 아래 정적 파일 주소 (basePath 반영) */
export function asset(path: string): string {
  return `${BASE_PATH}${path}`;
}

/** 상세 화면 주소. 정적 내보내기에서는 동적 경로를 못 쓰므로 쿼리로 넘긴다 */
export function memoHref(id: string): string {
  return DEMO ? `/memo/view?id=${encodeURIComponent(id)}` : `/memo/${id}`;
}

/** 사진 메모의 이미지 주소 */
export function imageSrc(image: string): string {
  if (image.startsWith("img:")) return remoteImageUrl(image);
  if (/^(data:|https?:|\/)/.test(image)) return image.startsWith("/") && !image.startsWith(BASE_PATH + "/") && BASE_PATH ? BASE_PATH + image : image;
  return `/api/files/${image}`;
}

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export const DEMO_MEMOS: Memo[] = [
  {
    id: "demo-little-prince",
    kind: "book",
    createdAt: day(1),
    updatedAt: day(1),
    source: { query: "어린 왕자" },
    model: "demo",
    title: "어린 왕자",
    category: "arts",
    tags: ["관계", "본질", "어른", "길들임"],
    oneLiner: "정말 중요한 것은 눈에 보이지 않으며, 관계는 서로에게 들인 시간으로 특별해진다.",
    summary:
      "사막에 불시착한 조종사가 작은 별에서 온 소년을 만난다. 소년은 자기 별의 장미와 다투고 떠나 여러 별을 여행하며 왕, 허영꾼, 술꾼, 사업가, 지리학자 같은 어른들을 만난다. **어른들은 숫자와 소유에 매달려 정작 중요한 것을 보지 못한다.**\n\n지구에서 만난 여우는 소년에게 '길들인다'는 말의 뜻을 가르친다. 길들인다는 것은 관계를 맺는 일이고, 그렇게 되면 세상에 하나뿐인 존재가 된다. **장미가 소중한 이유는 장미 자체가 아니라 소년이 장미에게 들인 시간 때문이다.**\n\n이야기는 작별로 끝나지만 슬픔만 남기지는 않는다. 별을 올려다볼 때마다 그중 하나에서 소년이 웃고 있다고 생각하면 모든 별이 웃는 것처럼 보인다는, **부재를 견디는 법에 대한 위로**로 마무리된다.",
    keyPoints: [
      "**어른들은 본질보다 숫자를 믿는다.** 새 친구를 소개하면 목소리나 좋아하는 놀이 대신 나이와 아버지의 수입을 묻는다.",
      "길들인다는 것은 **관계를 맺는 것**이며, 그 순간부터 상대는 세상에 하나뿐인 존재가 된다.",
      "**책임은 관계에서 나온다.** 네가 길들인 것에 대해 너는 언제까지나 책임이 있다.",
      "소년이 만난 어른들은 각자 하나의 집착(권력, 인정, 소유, 지식)에 갇혀 자기 별 밖을 보지 못한다.",
      "이별의 슬픔은 **함께한 시간이 남긴 것**으로 위로된다. 밀밭의 금빛이 여우에게 소년의 머리칼을 떠올리게 하듯이.",
    ],
    quotes: [
      { text: "가장 중요한 것은 눈에 보이지 않아.", note: "여우의 말. 원문: L'essentiel est invisible pour les yeux." },
      { text: "네가 네 장미꽃을 위해 소비한 시간 때문에 네 장미꽃이 그렇게 소중한 거야.", note: "21장" },
      { text: "길들인다는 건 관계를 맺는다는 뜻이야.", note: "여우" },
      { text: "어른들은 누구나 처음엔 어린이였다. 하지만 그것을 기억하는 어른은 별로 없다.", note: "헌사" },
    ],
    meta: { author: "앙투안 드 생텍쥐페리", publisher: null, year: "1943", channel: null, duration: null },
    confidence: "high",
  },
  {
    id: "demo-compound",
    kind: "youtube",
    createdAt: day(2),
    updatedAt: day(2),
    source: { videoId: "demo", thumbnail: "/demo/video-compound.svg", transcript: true },
    model: "demo",
    title: "복리는 왜 늦게 시작할수록 불리한가",
    category: "business",
    tags: ["복리", "장기투자", "시간", "저축"],
    oneLiner: "복리에서 가장 큰 변수는 수익률이 아니라 시간이며, 일찍 시작한 사람을 나중에 따라잡기는 거의 불가능하다.",
    summary:
      "영상은 두 사람의 가상 사례로 시작한다. 25살부터 10년만 매달 저축하고 멈춘 사람과, 35살부터 30년을 저축한 사람. 같은 수익률이라면 **10년만 저축한 첫 번째 사람이 은퇴 시점에 더 큰 돈을 갖는다.** 복리는 뒤로 갈수록 가속하기 때문이다.\n\n발화자는 복리 곡선의 앞부분이 지루하게 평평하다는 점을 강조한다. 처음 10년은 성과가 눈에 띄지 않아 대부분이 이 구간에서 포기한다. **복리의 보상은 '버틴 시간'에 거의 전적으로 비례한다.**\n\n실천 조언은 단순하다. 수익률을 높이려 애쓰기보다 자동이체로 저축을 습관화하고, 시장이 흔들려도 팔지 않으며, **가장 좋은 시작 시점은 언제나 '지금'**이라는 것이다.",
    keyPoints: [
      "**시간이 수익률보다 중요하다.** 10년 먼저 시작한 사람은 두 배 오래 저축한 사람보다 앞선다.",
      "복리 곡선은 앞부분이 평평해 **초기 10년이 가장 포기하기 쉬운 구간**이다.",
      "수익률 1% 차이보다 **중간에 팔지 않는 것**이 결과를 훨씬 크게 바꾼다.",
      "자동이체로 의지력이 개입할 틈을 없애는 것이 현실적인 전략이다.",
    ],
    quotes: [
      { text: "복리는 인내심에 주는 이자다.", note: "영상 12:40 부근" },
      { text: "두 번째로 좋은 시작 시점은 지금이다. 첫 번째는 이미 지나갔다.", note: null },
    ],
    meta: { author: null, publisher: null, year: "2026", channel: "돈의 문법", duration: "18:24" },
    confidence: "high",
  },
  {
    id: "demo-habit-page",
    kind: "photo",
    createdAt: day(3),
    updatedAt: day(3),
    source: { image: "/demo/photo-page.svg", note: "출근길에 읽은 부분" },
    model: "demo",
    title: "책 페이지 — 습관은 정체성의 투표다",
    category: "self",
    tags: ["습관", "정체성", "작은 변화"],
    oneLiner: "습관은 목표를 이루는 도구가 아니라, 내가 어떤 사람인지에 대한 투표다.",
    summary:
      "사진 속 페이지는 습관을 결과 중심이 아니라 정체성 중심으로 보라고 말한다. '책을 읽고 싶다'가 아니라 **'나는 읽는 사람이다'라는 정체성을 먼저 세우면 행동이 따라온다.**\n\n작은 행동 하나하나는 그 정체성에 던지는 표다. 한 번의 투표로 당선되지는 않지만, **표가 쌓이면 스스로를 믿게 되는 증거가 된다.** 그래서 완벽한 하루보다 '거르지 않는 것'이 중요하다.",
    keyPoints: [
      "목표(결과) → 과정 → **정체성** 순으로 갈수록 변화가 오래간다.",
      "**모든 행동은 정체성에 던지는 투표다.** 다수결이지 만장일치가 아니다.",
      "두 번 연속 거르지 않는다는 규칙이 완벽주의보다 실용적이다.",
    ],
    quotes: [{ text: "당신이 하는 모든 행동은 당신이 되고자 하는 사람에게 던지는 한 표다.", note: "사진 속 문장" }],
    meta: { author: null, publisher: null, year: null, channel: null, duration: null },
    confidence: "high",
  },
  {
    id: "demo-guns",
    kind: "book",
    createdAt: day(6),
    updatedAt: day(6),
    source: { query: "총 균 쇠" },
    model: "demo",
    title: "총, 균, 쇠",
    category: "history",
    tags: ["문명", "지리", "농업", "전염병"],
    oneLiner: "대륙 간 문명 격차는 민족의 우열이 아니라 지리와 환경이 만든 우연의 누적이다.",
    summary:
      "책은 뉴기니 정치가 얄리의 질문에서 출발한다. 왜 유럽인은 그토록 많은 '화물'을 만들었고 뉴기니인은 그러지 못했는가. 다이아몬드의 답은 **인종이 아니라 환경**이다.\n\n핵심 변수는 작물화·가축화할 수 있는 종의 분포다. 유라시아에는 밀, 보리, 소, 말처럼 유용한 종이 많았고, 동서로 긴 대륙 축 덕분에 같은 기후대를 따라 농업이 빠르게 퍼졌다. **식량 잉여가 인구 밀집, 전문 계층, 기술, 그리고 가축에서 옮은 전염병에 대한 면역을 낳았다.**\n\n그 결과가 총, 균, 쇠다. 정복은 무기와 문자뿐 아니라 **정복자가 무의식적으로 데려간 병원균**으로 완성되었고, 이 차이는 수천 년 전 어떤 대륙에 어떤 씨앗과 동물이 있었는지에서 비롯됐다.",
    keyPoints: [
      "**가축화 가능한 대형 포유류 14종 중 13종이 유라시아에 있었다.**",
      "대륙의 축이 동서(유라시아)인지 남북(아메리카·아프리카)인지가 농업 전파 속도를 갈랐다.",
      "가축과의 밀접한 생활이 **전염병과 그에 대한 면역**을 동시에 만들었다.",
      "식량 잉여 → 인구 밀집 → 전문가 계층 → 기술·문자·국가라는 연쇄.",
    ],
    quotes: [],
    meta: { author: "재레드 다이아몬드", publisher: "문학사상", year: "1997", channel: null, duration: null },
    confidence: "medium",
  },
  {
    id: "demo-protein",
    kind: "youtube",
    createdAt: day(9),
    updatedAt: day(9),
    source: { videoId: "demo2", thumbnail: "/demo/video-protein.svg", transcript: false },
    model: "demo",
    title: "AI는 어떻게 50년 묵은 단백질 접힘 문제를 풀었나",
    category: "science",
    tags: ["단백질", "AI", "생물학", "구조예측"],
    oneLiner: "아미노산 서열만으로 3차원 구조를 맞히는 문제가 풀리자, 신약과 효소 설계의 속도가 달라졌다.",
    summary:
      "자막이 없어 영상 설명과 관련 자료를 바탕으로 정리했다. 영상은 단백질이 왜 '접히는 방식'이 중요한지부터 설명한다. 같은 아미노산 사슬이라도 **접힌 모양이 기능을 결정**하며, 실험으로 구조 하나를 알아내는 데 수년이 걸리던 시절이 길었다.\n\n딥러닝 모델은 진화적으로 관련된 서열들의 공변이 패턴과 기하학적 제약을 함께 학습해, **실험 없이도 원자 수준에 가까운 정확도로 구조를 예측**하게 되었다. 영상 후반은 이 예측이 신약 후보 탐색과 플라스틱 분해 효소 설계에 어떻게 쓰이는지 사례로 보여준다.",
    keyPoints: [
      "**구조가 기능이다.** 접힘을 알면 무엇과 결합하는지 추론할 수 있다.",
      "모델은 서열 정렬에서 **함께 변하는 위치 쌍**을 단서로 삼는다.",
      "예측이 실험을 대체하기보다 **어떤 실험을 먼저 할지** 고르게 해 준다.",
    ],
    quotes: [],
    meta: { author: null, publisher: null, year: "2025", channel: "과학의 지도", duration: "24:10" },
    confidence: "medium",
  },
];

const DEMO_MEMOS_EN: Memo[] = [
  {
    ...DEMO_MEMOS[0],
    title: "The Little Prince",
    tags: ["relationships", "essence", "grown-ups", "taming"],
    oneLiner: "What is essential is invisible to the eye, and a bond becomes precious through the time you give it.",
    summary:
      "A pilot stranded in the desert meets a boy from a tiny planet. The boy has quarrelled with his rose and left, visiting planets ruled by a king, a vain man, a drunkard, a businessman and a geographer. **Grown-ups cling to numbers and possessions and miss what matters.**\n\nOn Earth a fox teaches him what it means to tame: to create ties, so that each becomes unique to the other. **The rose is precious not for what she is, but for the time the boy has given her.**\n\nThe story ends in parting, but not in grief alone. Look up at the stars, and if one of them holds a laughing boy, they all seem to laugh: **a way to bear absence.**",
    keyPoints: [
      "**Grown-ups trust numbers over essence.** Introduce a friend and they ask his age and his father's income, not what his voice is like.",
      "To tame is to **create ties**; from then on the other is one of a kind in all the world.",
      "**Responsibility grows out of ties.** You become responsible, forever, for what you have tamed.",
      "Each grown-up the boy meets is trapped in one obsession and never looks beyond his own planet.",
      "Grief is softened by **what shared time leaves behind**, as golden wheat reminds the fox of the boy's hair.",
    ],
    quotes: [
      { text: "What is essential is invisible to the eye.", note: "The fox. Original: L'essentiel est invisible pour les yeux." },
      { text: "It is the time you have wasted for your rose that makes your rose so important.", note: "Chapter 21" },
      { text: "To tame means to create ties.", note: "The fox" },
      { text: "All grown-ups were once children, but only few of them remember it.", note: "Dedication" },
    ],
    meta: { author: "Antoine de Saint-Exupéry", publisher: null, year: "1943", channel: null, duration: null },
  },
  {
    ...DEMO_MEMOS[1],
    title: "Why starting late is so costly with compound interest",
    tags: ["compounding", "long-term", "time", "saving"],
    oneLiner: "The biggest variable in compounding is time, not returns; catching up with an early starter is nearly impossible.",
    summary:
      "The video opens with two imaginary savers: one saves monthly from 25 for just ten years and stops; the other saves for thirty years starting at 35. At the same return, **the ten-year saver retires with more**, because compounding accelerates at the end.\n\nThe speaker stresses how flat the early curve is. The first decade shows little, and that is where most people give up. **The reward of compounding is almost entirely proportional to time endured.**\n\nThe advice is simple: automate saving instead of chasing returns, don't sell when markets wobble, and **the best time to start is always now.**",
    keyPoints: [
      "**Time beats returns.** Starting ten years earlier outperforms saving twice as long.",
      "The early curve is flat, so **the first decade is the easiest place to quit.**",
      "**Not selling midway** changes the outcome far more than a 1% difference in returns.",
      "Automatic transfers remove willpower from the equation.",
    ],
    quotes: [
      { text: "Compounding is interest paid on patience.", note: "around 12:40" },
      { text: "The second-best time to start is now. The best one has already passed.", note: null },
    ],
    meta: { author: null, publisher: null, year: "2026", channel: "Money Grammar", duration: "18:24" },
  },
  {
    ...DEMO_MEMOS[2],
    source: { image: "/demo/photo-page.svg", note: "read on the commute" },
    title: "Book page: habits are votes for an identity",
    tags: ["habits", "identity", "small changes"],
    oneLiner: "A habit is not a tool for reaching a goal; it is a vote for the kind of person you are.",
    summary:
      "The page argues for identity-based habits rather than outcome-based ones. Not 'I want to read more' but **'I am a reader'; set the identity first and the behaviour follows.**\n\nEvery small action is a vote for that identity. One vote doesn't win an election, but **as votes pile up they become evidence you can believe.** So an unbroken streak matters more than a perfect day.",
    keyPoints: [
      "Change lasts longer as you move from outcomes to processes to **identity**.",
      "**Every action is a vote for an identity.** It is a majority, not a unanimous vote.",
      "'Never miss twice' is more practical than perfectionism.",
    ],
    quotes: [{ text: "Every action you take is a vote for the type of person you wish to become.", note: "line in the photo" }],
  },
];

const DEMO_MEMOS_JA: Memo[] = [
  {
    ...DEMO_MEMOS[0],
    title: "星の王子さま",
    tags: ["関係", "本質", "大人", "なつく"],
    oneLiner: "本当に大切なものは目に見えず、関係は相手にかけた時間によって特別になる。",
    summary:
      "砂漠に不時着した飛行士が、小さな星から来た少年に出会う。少年は自分の星のバラとけんかして旅に出て、王様、うぬぼれ屋、酔っ払い、実業家、地理学者といった大人たちに会う。**大人たちは数字と所有に執着し、肝心なものを見ていない。**\n\n地球で出会ったキツネは「なつく」ということの意味を教える。それは絆を結ぶことであり、そうなれば互いに世界でただ一つの存在になる。**バラが大切なのはバラそのものではなく、少年がバラにかけた時間のためだ。**\n\n物語は別れで終わるが、悲しみだけを残しはしない。星を見上げてそのどれかで少年が笑っていると思えば、すべての星が笑って見える。**不在に耐える方法**についての慰めで締めくくられる。",
    keyPoints: [
      "**大人は本質より数字を信じる。** 新しい友だちを紹介すると、声や好きな遊びではなく年齢や父親の収入を尋ねる。",
      "なつくとは**絆を結ぶこと**であり、その瞬間から相手は世界にただ一人の存在になる。",
      "**責任は関係から生まれる。** なつかせたものには、いつまでも責任がある。",
      "少年が会った大人たちはそれぞれ一つの執着（権力、承認、所有、知識）に閉じ込められ、自分の星の外を見ない。",
      "別れの悲しみは**共に過ごした時間が残したもの**で慰められる。麦畑の金色がキツネに少年の髪を思い出させるように。",
    ],
    quotes: [
      { text: "大切なものは、目に見えない。", note: "キツネの言葉。原文: L'essentiel est invisible pour les yeux." },
      { text: "きみがバラのために費やした時間が、バラをそんなに大切なものにしたんだ。", note: "第21章" },
      { text: "なつくって、絆を結ぶってことだよ。", note: "キツネ" },
      { text: "大人はだれでも、はじめは子どもだった。でもそれを忘れずにいる大人はほとんどいない。", note: "献辞" },
    ],
    meta: { author: "アントワーヌ・ド・サン＝テグジュペリ", publisher: null, year: "1943", channel: null, duration: null },
  },
  {
    ...DEMO_MEMOS[1],
    title: "複利はなぜ遅く始めるほど不利なのか",
    tags: ["複利", "長期投資", "時間", "貯蓄"],
    oneLiner: "複利で最大の変数は利回りではなく時間であり、早く始めた人に後から追いつくのはほぼ不可能だ。",
    summary:
      "動画は二人の仮想の例から始まる。25歳から10年だけ毎月貯めてやめた人と、35歳から30年貯め続けた人。同じ利回りなら、**10年しか貯めなかった前者のほうが引退時に多くの資産を持つ。** 複利は後半ほど加速するからだ。\n\n話し手は複利曲線の前半が退屈なほど平らであることを強調する。最初の10年は成果が見えず、多くの人がここで諦める。**複利の報酬は「耐えた時間」にほぼ比例する。**\n\n実践の助言は単純だ。利回りを追うより自動積立で貯蓄を習慣にし、相場が揺れても売らず、**始めるのに最も良い時は常に「今」**だということ。",
    keyPoints: [
      "**時間は利回りより重要だ。** 10年早く始めた人は、2倍長く貯めた人より先を行く。",
      "複利曲線は前半が平らで、**最初の10年が最も諦めやすい区間**だ。",
      "利回り1%の差より**途中で売らないこと**のほうが結果をはるかに大きく変える。",
      "自動積立で意志力の入り込む余地をなくすのが現実的な戦略だ。",
    ],
    quotes: [
      { text: "複利とは、忍耐に支払われる利息だ。", note: "動画 12:40 付近" },
      { text: "二番目に良い始め時は今だ。一番良い時はもう過ぎた。", note: null },
    ],
    meta: { author: null, publisher: null, year: "2026", channel: "お金の文法", duration: "18:24" },
  },
  {
    ...DEMO_MEMOS[2],
    source: { image: "/demo/photo-page.svg", note: "通勤中に読んだ箇所" },
    title: "本のページ — 習慣はアイデンティティへの投票だ",
    tags: ["習慣", "アイデンティティ", "小さな変化"],
    oneLiner: "習慣は目標を達成する道具ではなく、自分がどんな人間かに対する投票だ。",
    summary:
      "写真のページは、習慣を結果中心ではなくアイデンティティ中心に捉えよと説く。「本を読みたい」ではなく**「自分は読む人間だ」というアイデンティティを先に立てれば、行動はついてくる。**\n\n小さな行動の一つひとつが、そのアイデンティティに投じる一票だ。一票で当選はしないが、**票が積み重なれば自分を信じる証拠になる。** だから完璧な一日より「途切れさせないこと」が大事だ。",
    keyPoints: [
      "目標（結果）→ 過程 → **アイデンティティ**の順に進むほど変化は長続きする。",
      "**すべての行動はアイデンティティへの投票だ。** 多数決であって全会一致ではない。",
      "「二度続けてサボらない」というルールは完璧主義より実用的だ。",
    ],
    quotes: [{ text: "あなたのすべての行動は、あなたがなりたい人物に投じる一票だ。", note: "写真の中の文" }],
  },
];

export function demoMemosFor(lang: Lang): Memo[] {
  return lang === "en" ? DEMO_MEMOS_EN : lang === "ja" ? DEMO_MEMOS_JA : DEMO_MEMOS;
}

/* ---------- 브라우저 저장소 ----------
 * saved  : 사용자가 만든(또는 고친) 메모. localStorage 에 저장.
 * 예시    : 언어별 세트를 그때그때 합친다. 지우면 hidden 에 id 가 기록된다 ("*" 는 전부).
 */
const SAVED_KEY = "memo-saved-v2";
const HIDDEN_KEY = "memo-demo-hidden";
const LEGACY_KEY = "memo-demo-v1";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 용량 초과 등은 무시 */
  }
}
function loadSaved(): Memo[] {
  const saved = readJson<Memo[] | null>(SAVED_KEY, null);
  if (saved) return saved;
  // 이전 버전 저장소: 예시가 아닌 것만 옮긴다
  const legacy = readJson<Memo[]>(LEGACY_KEY, []).filter((m) => m.model !== "demo");
  if (legacy.length) writeJson(SAVED_KEY, legacy);
  return legacy;
}
function loadHidden(): string[] | "*" {
  return readJson<string[] | "*">(HIDDEN_KEY, []);
}
function examples(lang: Lang): Memo[] {
  const hidden = loadHidden();
  if (hidden === "*") return [];
  return demoMemosFor(lang).filter((m) => !hidden.includes(m.id));
}
function all(lang: Lang): Memo[] {
  const saved = loadSaved();
  const ids = new Set(saved.map((m) => m.id));
  return [...saved, ...examples(lang).filter((m) => !ids.has(m.id))];
}

export const demoStore = {
  list: (lang: Lang): Memo[] => all(lang).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
  get: (id: string, lang: Lang): Memo | null => all(lang).find((m) => m.id === id) ?? null,
  add(memo: Memo) {
    const saved = loadSaved();
    saved.push(memo);
    writeJson(SAVED_KEY, saved);
  },
  patch(id: string, p: Partial<Memo>, lang: Lang): Memo | null {
    const saved = loadSaved();
    const i = saved.findIndex((m) => m.id === id);
    if (i >= 0) {
      saved[i] = { ...saved[i], ...p, id, updatedAt: new Date().toISOString() };
      writeJson(SAVED_KEY, saved);
      return saved[i];
    }
    const ex = examples(lang).find((m) => m.id === id);
    if (!ex) return null;
    const copy: Memo = { ...ex, ...p, id, updatedAt: new Date().toISOString() };
    saved.push(copy);
    writeJson(SAVED_KEY, saved);
    return copy;
  },
  remove(id: string, lang: Lang) {
    writeJson(SAVED_KEY, loadSaved().filter((m) => m.id !== id));
    if (demoMemosFor(lang).some((m) => m.id === id)) {
      const hidden = loadHidden();
      if (hidden !== "*") writeJson(HIDDEN_KEY, [...hidden, id]);
    }
  },
  /** 예시 메모만 지운다 (실제 요약한 메모는 남긴다) */
  clearExamples(lang: Lang): number {
    const n = examples(lang).length + loadSaved().filter((m) => m.model === "demo").length;
    writeJson(HIDDEN_KEY, "*");
    writeJson(SAVED_KEY, loadSaved().filter((m) => m.model !== "demo"));
    return n;
  },
  exportAll(lang: Lang): string {
    return JSON.stringify({ app: "memo", version: 1, exportedAt: new Date().toISOString(), memos: all(lang) }, null, 2);
  },
  importAll(incoming: Memo[], lang: Lang): { added: number; skipped: number } {
    const saved = loadSaved();
    const have = new Set(all(lang).map((m) => m.id));
    let added = 0;
    let skipped = 0;
    for (const m of incoming) {
      if (!m || typeof m.id !== "string" || have.has(m.id)) {
        skipped++;
        continue;
      }
      const src = { ...m.source } as Memo["source"] & { imageData?: string };
      if (src.imageData) {
        src.image = src.imageData;
        delete src.imageData;
      }
      saved.push({ ...m, source: src });
      have.add(m.id);
      added++;
    }
    writeJson(SAVED_KEY, saved);
    return { added, skipped };
  },
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    });
  });

/**
 * 정적 배포에서의 캡처. API 키가 연결돼 있으면 브라우저에서 Claude 를 직접 불러 실제로 요약하고,
 * 아니면 과정을 흉내내고 예시 메모를 하나 만든다.
 */
export async function demoCapture(req: CaptureRequest, emit: (e: CaptureEvent) => void, signal?: AbortSignal): Promise<Memo> {
  if (isBrowserConnected()) {
    const { browserCapture } = await import("./capture-browser");
    const { memo, duplicate } = await browserCapture(req, emit, signal);
    if (duplicate) emit({ type: "duplicate", memo });
    return memo;
  }
  const lang: Lang = req.lang ?? "ko";
  const stages: Record<MemoKind, string[]> = {
    youtube: ["source", "transcript", "summarize-transcript", "save"],
    book: ["search", "summarize-book", "save"],
    photo: ["upload", "summarize-photo", "save"],
    note: [],
  };
  for (const id of stages[req.kind]) {
    emit({ type: "stage", id, label: id });
    await sleep(id.startsWith("summarize") ? 1600 : 700, signal);
  }
  const set = demoMemosFor(lang);
  const template = set.find((m) => m.kind === req.kind) ?? set[0];
  const now = new Date().toISOString();
  const notice = { ko: "(데모 모드라 실제 요약이 아니라 예시 문장을 보여준다. Claude 를 연결하면 실제 내용이 들어온다.)", en: "(Demo mode: this is sample text, not a real summary. Connect Claude to get the real thing.)", ja: "(デモモードのため実際の要約ではなくサンプル文を表示している。Claudeを接続すると実際の内容になる。)" }[lang];
  if (req.replace) {
    const { clientStore } = await import("./store-client");
    const updated = await clientStore.patch(req.replace, { summary: `${notice}\n\n${template.summary}`, keyPoints: template.keyPoints, quotes: template.quotes }, lang);
    if (!updated) throw new Error("메모를 찾을 수 없습니다.");
    return updated;
  }
  const input = (req.input ?? "").trim();
  const memo: Memo = {
    ...template,
    id: `demo-${Date.now().toString(36)}`,
    createdAt: now,
    updatedAt: now,
    title: req.kind === "book" && input ? input : req.kind === "youtube" ? `${template.title} (demo)` : req.note?.trim() ? `${req.note.trim()} — ${template.title}` : template.title,
    source:
      req.kind === "photo"
        ? { image: req.image ?? template.source.image, note: req.note?.trim() || undefined }
        : req.kind === "youtube"
          ? { ...template.source, url: input }
          : { query: input },
    summary: `${notice}\n\n${template.summary}`,
    confidence: "low",
    model: "demo",
  };
  const { clientStore } = await import("./store-client");
  return clientStore.add(memo);
}

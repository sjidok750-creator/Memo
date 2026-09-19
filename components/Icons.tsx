import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size: number, props: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

export const IconPlay = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)} fill="currentColor" stroke="none">
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
);
export const IconBook = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
    <path d="M4 18.5V21h16" />
    <path d="M9 7h7M9 11h5" />
  </svg>
);
export const IconQuote = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)} fill="currentColor" stroke="none">
    <path d="M9.6 5.4C6.5 6.8 4.6 9.6 4.6 13v5.6h6.2v-6.2H7.7c0-2.2 1-3.8 3-4.8zM19.4 5.4c-3.1 1.4-5 4.2-5 7.6v5.6h6.2v-6.2h-3.1c0-2.2 1-3.8 3-4.8z" />
  </svg>
);
export const IconImage = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="M21 16l-5.5-5.5L7 19" />
  </svg>
);
export const IconSearch = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
export const IconArrowRight = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IconArrowLeft = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);
export const IconCheck = ({ size = 12, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={3}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);
export const IconX = ({ size = 14, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconTrash = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);
export const IconCopy = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
export const IconLink = ({ size = 14, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);
export const IconSpark = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)} fill="currentColor" stroke="none">
    <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />
  </svg>
);
export const IconEdit = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z" />
    <path d="M13.5 6.5l3 3" />
  </svg>
);
export const IconRefresh = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M20 12a8 8 0 1 1-2.3-5.7" />
    <path d="M20 4v5h-5" />
  </svg>
);
export const IconDownload = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12 4v11M7 10l5 5 5-5M4 20h16" />
  </svg>
);
export const IconUpload = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12 15V4M7 9l5-5 5 5M4 20h16" />
  </svg>
);
export const IconNote = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2.2}>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M15 3v4h4M9 12h6M9 16h4" />
  </svg>
);

/** 앱 심볼: 그라데이션 라운드 사각형 위에 강조된 줄 */
export const BrandMark = ({ size = 32, id = "bm" }: { size?: number; id?: string }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#F5A27C" />
        <stop offset="1" stopColor="#D2603A" />
      </linearGradient>
      <linearGradient id={`${id}-s`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="19" fill={`url(#${id}-g)`} />
    <rect width="64" height="32" rx="19" fill={`url(#${id}-s)`} />
    <rect x="15" y="17" width="34" height="6" rx="3" fill="#fff" opacity="0.5" />
    <rect x="15" y="29" width="26" height="7" rx="3.5" fill="#fff" />
    <rect x="15" y="39" width="26" height="2.4" rx="1.2" fill="#fff" opacity="0.95" />
    <rect x="15" y="46" width="18" height="6" rx="3" fill="#fff" opacity="0.5" />
  </svg>
);
export const IconClipboard = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <path d="M9 4.5V3h6v1.5M9 11h6M9 15h4" />
  </svg>
);
export const IconMore = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)} fill="currentColor" stroke="none">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
);

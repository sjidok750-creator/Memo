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
export const IconNote = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2.2}>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M15 3v4h4M9 12h6M9 16h4" />
  </svg>
);

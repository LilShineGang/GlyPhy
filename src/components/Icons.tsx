// Iconos SVG de trazo (estilo lucide), ligeros y sin dependencias.
import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 16, height: 16, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const, ...p,
});

export const I = {
  Search: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>),
  Note: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></svg>),
  Tasks: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M11 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6" /><path d="m9 11 3 3L22 4" /></svg>),
  Graph: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="5" cy="6" r="3" /><circle cx="19" cy="6" r="3" /><circle cx="12" cy="18" r="3" /><path d="M7.5 7.5 10.5 16M16.5 7.5 13.5 16M7.8 6h8.4" /></svg>),
  Star: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} fill="currentColor" stroke="none"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z" /></svg>),
  StarOutline: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z" /></svg>),
  Folder: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2z" /></svg>),
  Tag: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12.6 2.6a2 2 0 0 0-1.4-.6H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.8 8.8a2 2 0 0 0 2.8 0l6.4-6.4a2 2 0 0 0 0-2.8z" /><circle cx="7" cy="7" r="1.2" fill="currentColor" /></svg>),
  Clock: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>),
  Trash: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></svg>),
  Archive: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="2" y="4" width="20" height="5" rx="1" /><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9M10 13h4" /></svg>),
  Plus: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>),
  Check: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} strokeWidth={3}><path d="m20 6-11 11-5-5" /></svg>),
  ChevronUp: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="m18 15-6-6-6 6" /></svg>),
  ChevronDown: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>),
  X: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M18 6 6 18M6 6l12 12" /></svg>),
  Sidebar: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></svg>),
  Panel: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18" /></svg>),
  Home: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" /></svg>),
  Link: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>),
  History: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M3 3v5h5" /><path d="M3.05 13a9 9 0 1 0 2.6-7.4L3 8" /><path d="M12 7v5l3 2" /></svg>),
  Calendar: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>),
  List: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>),
  Board: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18" /></svg>),
  Cloud: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6-1.5A4 4 0 0 0 6.5 19z" /></svg>),
  Command: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M15 6a3 3 0 1 0 3 3v6a3 3 0 1 0-3-3H9a3 3 0 1 0 3-3V9a3 3 0 1 0-3 3h6" /></svg>),
};

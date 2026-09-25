import type { AppId } from "./apps";

/**
 * One hand-drawn SVG glyph per world for the share cards. Satori renders inline SVG shapes
 * (no text), so each is built from paths, rects, circles and lines only.
 */
export function worldArt(app: AppId, accent: string, ink: string, size = 300) {
  const common = { width: size, height: size, viewBox: "0 0 200 200", xmlns: "http://www.w3.org/2000/svg" } as const;
  const faint = 0.28;
  switch (app) {
    case "rookie-scout":
      return (
        <svg {...common}>
          <g stroke={ink} strokeOpacity={faint} strokeWidth={2}>
            <line x1={20} y1={0} x2={20} y2={200} />
            <line x1={60} y1={0} x2={60} y2={200} />
            <line x1={140} y1={0} x2={140} y2={200} />
            <line x1={180} y1={0} x2={180} y2={200} />
          </g>
          <rect x={52} y={22} width={96} height={156} rx={12} fill={ink} fillOpacity={0.92} />
          <rect x={64} y={34} width={72} height={64} rx={8} fill={accent} />
          <rect x={64} y={110} width={72} height={8} rx={4} fill={accent} fillOpacity={0.55} />
          <rect x={64} y={126} width={48} height={8} rx={4} fill={accent} fillOpacity={0.35} />
          <circle cx={122} cy={158} r={12} fill="none" stroke={accent} strokeWidth={4} />
          <rect x={94} y={52} width={12} height={30} rx={3} fill={ink} />
        </svg>
      );
    case "two-faced":
      return (
        <svg {...common}>
          <path d="M100 20 A80 80 0 0 0 100 180 Z" fill={ink} fillOpacity={0.9} />
          <path d="M100 20 A80 80 0 0 1 100 180 Z" fill={accent} />
          <ellipse cx={72} cy={82} rx={12} ry={8} fill={accent} />
          <ellipse cx={128} cy={82} rx={12} ry={8} fill={ink} />
          <path d="M52 118 Q76 142 96 122" fill="none" stroke={accent} strokeWidth={6} strokeLinecap="round" />
          <path d="M104 140 Q128 116 148 138" fill="none" stroke={ink} strokeWidth={6} strokeLinecap="round" />
          <line x1={100} y1={20} x2={100} y2={180} stroke={ink} strokeOpacity={0.4} strokeWidth={2} />
        </svg>
      );
    case "exit-clock":
      return (
        <svg {...common}>
          <circle cx={100} cy={100} r={84} fill="none" stroke={accent} strokeWidth={10} />
          <circle cx={100} cy={100} r={70} fill={ink} fillOpacity={0.08} />
          <g stroke={ink} strokeOpacity={0.7} strokeWidth={3} strokeLinecap="round">
            <line x1={100} y1={30} x2={100} y2={44} />
            <line x1={170} y1={100} x2={156} y2={100} />
            <line x1={100} y1={170} x2={100} y2={156} />
            <line x1={30} y1={100} x2={44} y2={100} />
          </g>
          <line x1={100} y1={100} x2={100} y2={48} stroke={ink} strokeWidth={5} strokeLinecap="round" />
          <line x1={100} y1={100} x2={142} y2={124} stroke={accent} strokeWidth={5} strokeLinecap="round" />
          <line x1={100} y1={100} x2={66} y2={134} stroke={accent} strokeWidth={3} strokeLinecap="round" strokeOpacity={0.7} />
          <circle cx={100} cy={100} r={6} fill={accent} />
        </svg>
      );
    case "odds-vs-flow":
      return (
        <svg {...common}>
          <path d="M10 96 C50 80 80 120 100 100 C120 80 150 120 190 104" fill="none" stroke={ink} strokeWidth={6} strokeLinecap="round" />
          <circle cx={100} cy={100} r={10} fill={accent} />
          <path d="M10 150 Q35 132 60 150 T110 150 T160 150 T210 150" fill="none" stroke={accent} strokeWidth={5} strokeOpacity={0.9} />
          <path d="M10 172 Q35 154 60 172 T110 172 T160 172 T210 172" fill="none" stroke={accent} strokeWidth={4} strokeOpacity={0.5} />
          <rect x={22} y={26} width={66} height={44} rx={4} fill={ink} fillOpacity={0.9} />
          <rect x={30} y={36} width={40} height={6} rx={3} fill={accent} />
          <rect x={30} y={50} width={26} height={6} rx={3} fill={accent} fillOpacity={0.6} />
        </svg>
      );
    case "last-ones-out":
      return (
        <svg {...common}>
          <rect x={16} y={90} width={34} height={100} fill={ink} fillOpacity={0.9} />
          <rect x={58} y={40} width={44} height={150} fill={ink} fillOpacity={0.95} />
          <rect x={110} y={70} width={30} height={120} fill={ink} fillOpacity={0.9} />
          <rect x={148} y={110} width={38} height={80} fill={ink} fillOpacity={0.85} />
          <g fill={accent}>
            <rect x={24} y={100} width={7} height={9} />
            <rect x={36} y={100} width={7} height={9} />
            <rect x={24} y={136} width={7} height={9} />
            <rect x={66} y={52} width={8} height={10} />
            <rect x={86} y={52} width={8} height={10} />
            <rect x={66} y={88} width={8} height={10} />
            <rect x={86} y={124} width={8} height={10} />
            <rect x={66} y={160} width={8} height={10} />
            <rect x={118} y={82} width={6} height={9} />
            <rect x={118} y={136} width={6} height={9} />
            <rect x={156} y={122} width={7} height={9} />
            <rect x={172} y={158} width={7} height={9} />
          </g>
          <circle cx={166} cy={36} r={14} fill={accent} fillOpacity={0.9} />
        </svg>
      );
    case "dynasties":
      return (
        <svg {...common}>
          <path d="M40 30 H160 V110 C160 150 130 172 100 184 C70 172 40 150 40 110 Z" fill={ink} fillOpacity={0.9} />
          <path d="M100 30 V184 C130 172 160 150 160 110 V30 Z" fill={accent} />
          <polygon points="100,62 108,84 132,84 113,98 120,120 100,106 80,120 87,98 68,84 92,84" fill={ink} />
          <path d="M40 30 H160" stroke={accent} strokeWidth={6} />
        </svg>
      );
    case "menagerie":
      return (
        <svg {...common}>
          <polygon points="100,44 132,14 140,72 160,110 138,150 100,168 62,150 40,110 60,72 68,14" fill={ink} fillOpacity={0.9} />
          <polygon points="78,92 92,104 78,110" fill={accent} />
          <polygon points="122,92 108,104 122,110" fill={accent} />
          <polygon points="94,126 106,126 100,136" fill={accent} />
          <path d="M20 180 Q60 160 100 180 T180 180" fill="none" stroke={accent} strokeWidth={4} strokeOpacity={0.7} />
        </svg>
      );
    case "rewind":
      return (
        <svg {...common}>
          <rect x={16} y={48} width={168} height={104} rx={10} fill={ink} fillOpacity={0.92} />
          <rect x={44} y={70} width={112} height={60} rx={8} fill={accent} fillOpacity={0.15} />
          <circle cx={68} cy={100} r={18} fill="none" stroke={accent} strokeWidth={6} />
          <circle cx={132} cy={100} r={18} fill="none" stroke={accent} strokeWidth={6} />
          <rect x={92} y={96} width={16} height={8} rx={2} fill={accent} />
          <rect x={16} y={152} width={168} height={6} fill={accent} fillOpacity={0.5} />
          <rect x={16} y={164} width={168} height={4} fill={accent} fillOpacity={0.25} />
        </svg>
      );
    case "wallet-obituaries":
      return (
        <svg {...common}>
          <rect x={26} y={20} width={148} height={160} rx={4} fill={ink} fillOpacity={0.92} />
          <rect x={38} y={32} width={124} height={16} fill={accent} />
          <g fill={ink} fillOpacity={0.35}>
            <rect x={38} y={60} width={56} height={5} />
            <rect x={38} y={71} width={56} height={5} />
            <rect x={38} y={82} width={56} height={5} />
            <rect x={38} y={93} width={44} height={5} />
            <rect x={104} y={60} width={58} height={5} />
            <rect x={104} y={71} width={58} height={5} />
            <rect x={104} y={82} width={58} height={5} />
            <rect x={104} y={93} width={40} height={5} />
            <rect x={38} y={116} width={124} height={5} />
            <rect x={38} y={127} width={124} height={5} />
            <rect x={38} y={138} width={124} height={5} />
            <rect x={38} y={149} width={80} height={5} />
          </g>
          <rect x={38} y={106} width={124} height={2} fill={accent} />
        </svg>
      );
    case "as-the-chain-turns":
      return (
        <svg {...common}>
          <rect x={22} y={52} width={156} height={112} rx={16} fill={ink} fillOpacity={0.92} />
          <rect x={38} y={66} width={124} height={84} rx={10} fill={accent} fillOpacity={0.22} />
          <line x1={80} y1={52} x2={60} y2={16} stroke={ink} strokeWidth={5} strokeLinecap="round" />
          <line x1={120} y1={52} x2={140} y2={16} stroke={ink} strokeWidth={5} strokeLinecap="round" />
          <path d="M100 132 C84 120 66 108 70 92 C74 78 92 80 100 92 C108 80 126 78 130 92 C134 108 116 120 100 132 Z" fill={accent} />
          <rect x={22} y={164} width={156} height={10} rx={5} fill={accent} fillOpacity={0.5} />
        </svg>
      );
  }
}

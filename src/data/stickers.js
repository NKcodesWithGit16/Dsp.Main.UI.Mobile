// Built-in sticker packs — inline SVG strings so the same content renders on
// web (img/svg tag) and mobile (react-native-svg SvgXml) without R2 round-trips.
// The sticker reference sent in a message is "<packId>/<stickerId>"; the receiver
// looks the SVG up from this map.

const truck1 = `
<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="28" width="68" height="44" rx="6" fill="#5b6cff"/>
  <rect x="74" y="40" width="36" height="32" rx="4" fill="#4f8dff"/>
  <rect x="82" y="46" width="20" height="14" rx="2" fill="#bdd5ff"/>
  <circle cx="28" cy="80" r="10" fill="#0f172a"/><circle cx="28" cy="80" r="4" fill="#e2e8f0"/>
  <circle cx="92" cy="80" r="10" fill="#0f172a"/><circle cx="92" cy="80" r="4" fill="#e2e8f0"/>
  <path d="M18 22 Q40 8 60 22" stroke="#facc15" stroke-width="3" fill="none" stroke-linecap="round"/>
  <text x="40" y="58" font-family="Arial Black" font-size="14" fill="#fff" text-anchor="middle">GO!</text>
</svg>`;

const truck2 = `
<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="32" width="72" height="40" rx="6" fill="#10b981"/>
  <rect x="78" y="44" width="34" height="28" rx="4" fill="#059669"/>
  <rect x="86" y="50" width="18" height="12" rx="2" fill="#bbf7d0"/>
  <circle cx="28" cy="80" r="10" fill="#0f172a"/><circle cx="28" cy="80" r="4" fill="#e2e8f0"/>
  <circle cx="94" cy="80" r="10" fill="#0f172a"/><circle cx="94" cy="80" r="4" fill="#e2e8f0"/>
  <path d="M30 56 l10 8 l16 -20" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const truck3 = `
<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="32" width="72" height="40" rx="6" fill="#ef4444"/>
  <rect x="78" y="44" width="34" height="28" rx="4" fill="#dc2626"/>
  <rect x="86" y="50" width="18" height="12" rx="2" fill="#fecaca"/>
  <circle cx="28" cy="80" r="10" fill="#0f172a"/><circle cx="28" cy="80" r="4" fill="#e2e8f0"/>
  <circle cx="94" cy="80" r="10" fill="#0f172a"/><circle cx="94" cy="80" r="4" fill="#e2e8f0"/>
  <text x="42" y="60" font-family="Arial Black" font-size="14" fill="#fff" text-anchor="middle">SOS</text>
</svg>`;

const truck4 = `
<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="32" width="72" height="40" rx="6" fill="#f59e0b"/>
  <rect x="78" y="44" width="34" height="28" rx="4" fill="#d97706"/>
  <rect x="86" y="50" width="18" height="12" rx="2" fill="#fde68a"/>
  <circle cx="28" cy="80" r="10" fill="#0f172a"/><circle cx="28" cy="80" r="4" fill="#e2e8f0"/>
  <circle cx="94" cy="80" r="10" fill="#0f172a"/><circle cx="94" cy="80" r="4" fill="#e2e8f0"/>
  <path d="M22 56 l50 0 M30 50 l12 -8 M62 50 l-12 -8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>`;

const truck5 = `
<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="30" width="74" height="42" rx="6" fill="#0ea5e9"/>
  <rect x="80" y="44" width="32" height="28" rx="4" fill="#0284c7"/>
  <circle cx="60" cy="50" r="10" fill="#fff"/>
  <path d="M60 44 l0 8 l5 5" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" fill="none"/>
  <circle cx="28" cy="80" r="10" fill="#0f172a"/><circle cx="28" cy="80" r="4" fill="#e2e8f0"/>
  <circle cx="94" cy="80" r="10" fill="#0f172a"/><circle cx="94" cy="80" r="4" fill="#e2e8f0"/>
</svg>`;

const truck6 = `
<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="32" width="74" height="40" rx="6" fill="#8b5cf6"/>
  <rect x="80" y="44" width="32" height="28" rx="4" fill="#7c3aed"/>
  <circle cx="28" cy="80" r="10" fill="#0f172a"/><circle cx="28" cy="80" r="4" fill="#e2e8f0"/>
  <circle cx="94" cy="80" r="10" fill="#0f172a"/><circle cx="94" cy="80" r="4" fill="#e2e8f0"/>
  <path d="M16 20 q24 -14 48 0" stroke="#fde047" stroke-width="3" stroke-linecap="round" fill="none"/>
  <circle cx="20" cy="20" r="4" fill="#fde047"/>
  <circle cx="60" cy="20" r="4" fill="#fde047"/>
</svg>`;

const stop = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <polygon points="30,8 70,8 92,30 92,70 70,92 30,92 8,70 8,30" fill="#dc2626" stroke="#fff" stroke-width="3"/>
  <text x="50" y="60" font-family="Arial Black" font-size="22" fill="#fff" text-anchor="middle" letter-spacing="1">STOP</text>
</svg>`;

const yield_ = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <polygon points="50,10 92,82 8,82" fill="#facc15" stroke="#dc2626" stroke-width="4"/>
  <text x="50" y="68" font-family="Arial Black" font-size="16" fill="#0f172a" text-anchor="middle">YIELD</text>
</svg>`;

const speed = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="14" y="14" width="72" height="72" rx="6" fill="#fff" stroke="#0f172a" stroke-width="4"/>
  <text x="50" y="40" font-family="Arial" font-size="11" fill="#0f172a" text-anchor="middle">SPEED LIMIT</text>
  <text x="50" y="74" font-family="Arial Black" font-size="36" fill="#0f172a" text-anchor="middle">70</text>
</svg>`;

const detour = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="30" width="88" height="40" fill="#f59e0b"/>
  <path d="M30 50 l30 0 m0 0 l-6 -6 m6 6 l-6 6" stroke="#0f172a" stroke-width="4" stroke-linecap="round" fill="none"/>
  <text x="50" y="26" font-family="Arial Black" font-size="12" fill="#0f172a" text-anchor="middle">DETOUR</text>
</svg>`;

const noEntry = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="#dc2626" stroke="#fff" stroke-width="4"/>
  <rect x="20" y="44" width="60" height="12" fill="#fff"/>
</svg>`;

const construction = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <polygon points="50,12 92,88 8,88" fill="#f59e0b" stroke="#0f172a" stroke-width="3"/>
  <circle cx="50" cy="68" r="14" fill="#0f172a"/>
  <rect x="45" y="50" width="10" height="20" fill="#0f172a"/>
  <rect x="35" y="60" width="30" height="6" fill="#f59e0b"/>
</svg>`;

const sun = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="20" fill="#fcd34d"/>
  <g stroke="#f59e0b" stroke-width="4" stroke-linecap="round">
    <line x1="50" y1="14" x2="50" y2="24"/><line x1="50" y1="76" x2="50" y2="86"/>
    <line x1="14" y1="50" x2="24" y2="50"/><line x1="76" y1="50" x2="86" y2="50"/>
    <line x1="24" y1="24" x2="32" y2="32"/><line x1="68" y1="68" x2="76" y2="76"/>
    <line x1="76" y1="24" x2="68" y2="32"/><line x1="32" y1="68" x2="24" y2="76"/>
  </g>
</svg>`;

const cloud = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M28 64 q-14 0 -14 -14 q0 -14 14 -14 q4 -16 22 -16 q18 0 22 18 q14 0 14 12 q0 14 -14 14 z" fill="#cbd5e1" stroke="#94a3b8" stroke-width="2"/>
</svg>`;

const rain = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M24 46 q-12 0 -12 -12 q0 -12 12 -12 q4 -12 20 -12 q16 0 20 14 q12 0 12 10 q0 12 -12 12 z" fill="#94a3b8"/>
  <g stroke="#0ea5e9" stroke-width="4" stroke-linecap="round">
    <line x1="32" y1="58" x2="28" y2="80"/>
    <line x1="48" y1="58" x2="44" y2="80"/>
    <line x1="64" y1="58" x2="60" y2="80"/>
  </g>
</svg>`;

const snow = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#0ea5e9" stroke-width="3" stroke-linecap="round" fill="none">
    <line x1="50" y1="10" x2="50" y2="90"/>
    <line x1="14" y1="50" x2="86" y2="50"/>
    <line x1="22" y1="22" x2="78" y2="78"/>
    <line x1="78" y1="22" x2="22" y2="78"/>
  </g>
  <g fill="#0ea5e9">
    <circle cx="50" cy="10" r="3"/><circle cx="50" cy="90" r="3"/>
    <circle cx="14" cy="50" r="3"/><circle cx="86" cy="50" r="3"/>
  </g>
</svg>`;

const fog = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#94a3b8" stroke-width="6" stroke-linecap="round">
    <line x1="14" y1="30" x2="86" y2="30"/>
    <line x1="22" y1="44" x2="80" y2="44"/>
    <line x1="14" y1="58" x2="86" y2="58"/>
    <line x1="22" y1="72" x2="80" y2="72"/>
  </g>
</svg>`;

const thunder = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M28 46 q-12 0 -12 -12 q0 -12 12 -12 q4 -12 20 -12 q16 0 20 14 q12 0 12 10 q0 12 -12 12 z" fill="#475569"/>
  <polygon points="48,48 64,48 54,64 64,64 44,88 50,68 40,68" fill="#fde047" stroke="#facc15" stroke-width="1.5"/>
</svg>`;

const checkmark = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="42" fill="#10b981"/>
  <path d="M30 52 l14 14 l28 -30" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const clockSticker = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="42" fill="#fff" stroke="#0f172a" stroke-width="4"/>
  <line x1="50" y1="50" x2="50" y2="22" stroke="#0f172a" stroke-width="5" stroke-linecap="round"/>
  <line x1="50" y1="50" x2="70" y2="60" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>
  <circle cx="50" cy="50" r="4" fill="#0f172a"/>
</svg>`;

const fire = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 8 q22 22 22 44 a22 22 0 1 1 -44 0 q0 -14 12 -22 q-4 14 4 18 q-4 -16 6 -40 z" fill="#ef4444"/>
  <path d="M50 32 q12 14 12 28 a12 12 0 1 1 -24 0 q0 -8 6 -14 q-2 12 6 12 q-4 -12 0 -26 z" fill="#fde047"/>
</svg>`;

const partyPop = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <polygon points="14,86 86,38 76,72" fill="#facc15" stroke="#f59e0b" stroke-width="2"/>
  <g fill="#5b6cff"><circle cx="56" cy="28" r="4"/></g>
  <g fill="#10b981"><circle cx="78" cy="20" r="4"/></g>
  <g fill="#ef4444"><circle cx="44" cy="14" r="4"/></g>
  <g fill="#f97316"><circle cx="86" cy="56" r="4"/></g>
</svg>`;

const thumbsUp = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M30 90 l0 -42 l24 -34 q8 0 6 14 l-4 14 l28 0 q8 0 6 10 l-8 32 q-2 6 -10 6 z" fill="#fbbf24" stroke="#92400e" stroke-width="2.5" stroke-linejoin="round"/>
  <rect x="14" y="48" width="16" height="42" rx="3" fill="#f59e0b"/>
</svg>`;

const arrived = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 12 q-22 0 -22 22 q0 18 22 50 q22 -32 22 -50 q0 -22 -22 -22 z" fill="#10b981"/>
  <circle cx="50" cy="36" r="10" fill="#fff"/>
</svg>`;

export const STICKER_PACKS = [
    {
        id: "trucks",
        name: "Trucks",
        cover: truck1,
        stickers: [
            { id: "go",     svg: truck1 },
            { id: "ok",     svg: truck2 },
            { id: "sos",    svg: truck3 },
            { id: "tight",  svg: truck4 },
            { id: "eta",    svg: truck5 },
            { id: "night",  svg: truck6 },
        ],
    },
    {
        id: "road",
        name: "Road",
        cover: stop,
        stickers: [
            { id: "stop",         svg: stop },
            { id: "yield",        svg: yield_ },
            { id: "speed",        svg: speed },
            { id: "detour",       svg: detour },
            { id: "no-entry",     svg: noEntry },
            { id: "construction", svg: construction },
        ],
    },
    {
        id: "weather",
        name: "Weather",
        cover: sun,
        stickers: [
            { id: "sun",     svg: sun },
            { id: "cloud",   svg: cloud },
            { id: "rain",    svg: rain },
            { id: "snow",    svg: snow },
            { id: "fog",     svg: fog },
            { id: "thunder", svg: thunder },
        ],
    },
    {
        id: "status",
        name: "Status",
        cover: checkmark,
        stickers: [
            { id: "check",   svg: checkmark },
            { id: "clock",   svg: clockSticker },
            { id: "fire",    svg: fire },
            { id: "party",   svg: partyPop },
            { id: "thumbs",  svg: thumbsUp },
            { id: "arrived", svg: arrived },
        ],
    },
];

// Lookup helper: "trucks/go" → SVG string.
export function getStickerSvg(ref) {
    if (!ref || typeof ref !== "string") return null;
    const [packId, stickerId] = ref.split("/");
    const pack = STICKER_PACKS.find(p => p.id === packId);
    return pack?.stickers.find(s => s.id === stickerId)?.svg ?? null;
}

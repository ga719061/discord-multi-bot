import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  escapeXml,
  imageFileToDataUri,
  svgToPngAttachment,
  trimText,
  wrapText,
} from './imageRendering.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKGROUND_PATH = path.join(__dirname, '..', '..', 'assets', 'announcement', 'scroll-background.png');
const WIDTH = 1080;
const HEIGHT = 1600;
const FILENAME = 'announcement-scroll.png';
const FONT = '"Noto Sans CJK TC", "Microsoft JhengHei", "Segoe UI", Arial, sans-serif';
const BODY_X = 292;
const BODY_MAX_CHARS = 14;
const BODY_LONG_MAX_CHARS = 16;
const MENTION_X = 540;
const MENTION_Y = 470;

export async function renderAnnouncementScrollImage({
  title,
  content,
  footer,
  mentionLabel,
  date = new Date(),
  backgroundPath = BACKGROUND_PATH,
} = {}) {
  const background = await imageFileToDataUri(backgroundPath, {
    width: WIDTH,
    height: HEIGHT,
    fit: 'cover',
    withoutEnlargement: false,
  });
  const svg = buildAnnouncementScrollSvg({
    title,
    content,
    footer,
    mentionLabel,
    dateLabel: formatTaiwanDate(date),
    background,
  });

  return svgToPngAttachment(svg, FILENAME);
}

function buildAnnouncementScrollSvg({ title, content, footer, mentionLabel, dateLabel, background }) {
  const titleLines = wrapText(title || '王國公告', 13, 2);
  const normalizedContent = normalizeAnnouncementText(content || '公告內容');
  const longContent = [...normalizedContent].length > 360;
  const bodyLines = wrapText(normalizedContent, longContent ? BODY_LONG_MAX_CHARS : BODY_MAX_CHARS, longContent ? 24 : 20);
  const bodySize = longContent ? 30 : 36;
  const lineHeight = longContent ? 42 : 50;
  const titleBaseY = 432;
  const footerText = trimText(footer || '吉吉國王 頒布', 42);
  const mentionText = mentionLabel ? trimText(mentionLabel, 34) : null;
  const bodyStart = longContent ? 540 : 566;
  const backdrop = background
    ? `<image href="${background}" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" preserveAspectRatio="xMidYMid slice"/>`
    : fallbackScrollBackdrop();
  const scrollBase = background ? bitmapReadabilityLayer() : fallbackScrollFrame();

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="pageGold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff1bd"/>
      <stop offset="45%" stop-color="#f2d184"/>
      <stop offset="100%" stop-color="#c6923a"/>
    </linearGradient>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff6d8"/>
      <stop offset="52%" stop-color="#f4d894"/>
      <stop offset="100%" stop-color="#dbad5a"/>
    </linearGradient>
    <linearGradient id="roller" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#51280c"/>
      <stop offset="18%" stop-color="#9a5820"/>
      <stop offset="50%" stop-color="#d18a35"/>
      <stop offset="82%" stop-color="#8a4317"/>
      <stop offset="100%" stop-color="#4b220a"/>
    </linearGradient>
    <radialGradient id="sealInk" cx="50%" cy="48%" r="54%">
      <stop offset="0%" stop-color="#d94b35"/>
      <stop offset="100%" stop-color="#8f1714"/>
    </radialGradient>
    <filter id="shadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#241006" flood-opacity="0.36"/>
    </filter>
    <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#2b1306" flood-opacity="0.24"/>
    </filter>
    <filter id="paperNoise" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.74" numOctaves="3" seed="13"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.13"/>
      </feComponentTransfer>
    </filter>
    <filter id="mottledInk" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="21"/>
      <feColorMatrix type="matrix" values="0.55 0 0 0 0.18  0 0.42 0 0 0.11  0 0 0.25 0 0.04  0 0 0 0.32 0"/>
    </filter>
    <style>
      .font { font-family: ${FONT}; letter-spacing: 0; }
      .eyebrow { font-size: 31px; font-weight: 900; }
      .title { font-size: 64px; font-weight: 900; }
      .body { font-size: ${bodySize}px; font-weight: 760; }
      .small { font-size: 27px; font-weight: 800; }
      .mention { font-size: 25px; font-weight: 900; }
      .footer { font-size: 30px; font-weight: 900; }
      .seal { font-size: 39px; font-weight: 900; }
      .date { font-size: 25px; font-weight: 850; }
    </style>
  </defs>
  <g class="font">
    ${backdrop}
    ${scrollBase}

    <g filter="url(#softShadow)">
      <rect x="278" y="226" width="524" height="118" rx="22" fill="#8e251f" stroke="#f1c36b" stroke-width="5"/>
      <text x="540" y="275" text-anchor="middle" class="eyebrow" fill="#ffe8a8">GIGI KINGDOM</text>
      <text x="540" y="322" text-anchor="middle" class="eyebrow" fill="#fff6d6">皇家公告</text>
    </g>
    ${mentionText ? `<text x="${MENTION_X}" y="${MENTION_Y}" text-anchor="middle" class="mention" fill="#87311d">召見：${escapeXml(mentionText)}</text>` : ''}

    <g>
      ${titleLines.map((line, index) => `<text x="540" y="${titleBaseY + index * 76}" text-anchor="middle" class="title" fill="#40200a">${escapeXml(line)}</text>`).join('')}
      ${bodyLines.map((line, index) => `<text x="${BODY_X}" y="${bodyStart + index * lineHeight}" class="body" fill="#3c210d">${escapeXml(line)}</text>`).join('')}
    </g>

    <g>
      <text x="292" y="1288" class="footer" fill="#5a2b0d">${escapeXml(footerText)}</text>
      <text x="292" y="1332" class="date" fill="#8b561f">${escapeXml(dateLabel)}</text>
      ${seal()}
    </g>
  </g>
</svg>`;
}

function normalizeAnnouncementText(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function fallbackScrollBackdrop() {
  return `
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#5a230f"/>
    <radialGradient id="fallbackGlow" cx="50%" cy="14%" r="82%">
      <stop offset="0%" stop-color="#f5c879"/>
      <stop offset="54%" stop-color="#9a431c"/>
      <stop offset="100%" stop-color="#321206"/>
    </radialGradient>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#fallbackGlow)"/>
    <path d="M60 120 C220 44, 374 86, 540 54 C706 22, 874 62, 1020 130" fill="none" stroke="#f3ca78" stroke-width="3" opacity="0.2"/>
    <path d="M64 1486 C232 1540, 372 1490, 542 1530 C702 1568, 874 1514, 1018 1462" fill="none" stroke="#2c0e04" stroke-width="5" opacity="0.24"/>`;
}

function bitmapReadabilityLayer() {
  return `
    <g>
      <path d="M210 218 C244 184, 836 184, 870 218 V1334 C836 1374, 244 1374, 210 1334 Z" fill="#fff5d2" opacity="0.16"/>
      <path d="M224 252 H856 V1322 H224 Z" fill="url(#mottledInk)" opacity="0.26"/>
    </g>`;
}

function fallbackScrollFrame() {
  return `
    <g filter="url(#shadow)">
      ${scrollRollers()}
      <path d="M170 172 C202 136, 878 136, 910 172 V1392 C878 1436, 202 1436, 170 1392 Z" fill="url(#paper)" stroke="#6b330d" stroke-width="8"/>
      <path d="M198 207 C228 176, 850 176, 880 207 V1357 C850 1396, 228 1396, 198 1357 Z" fill="#fff1c8" stroke="#c18626" stroke-width="4"/>
      <path d="M225 244 H855 V1321 H225 Z" fill="#fff4d5" opacity="0.62"/>
      <path d="M226 257 C312 234, 420 269, 533 248 C650 226, 756 258, 850 244" fill="none" stroke="#d7a84a" stroke-width="2" opacity="0.42"/>
      <path d="M226 1282 C316 1308, 420 1275, 534 1298 C654 1322, 758 1288, 850 1306" fill="none" stroke="#b77720" stroke-width="2" opacity="0.35"/>
      <rect x="225" y="244" width="630" height="1077" fill="url(#paperNoise)" opacity="0.5"/>
      ${cornerDecor()}
      ${faintCrests()}
    </g>`;
}

function scrollRollers() {
  return `
    <rect x="126" y="94" width="828" height="94" rx="47" fill="url(#roller)" stroke="#321505" stroke-width="8"/>
    <rect x="98" y="122" width="78" height="38" rx="19" fill="#2e1305"/>
    <rect x="904" y="122" width="78" height="38" rx="19" fill="#2e1305"/>
    <path d="M188 132 H892" stroke="#f0b45a" stroke-width="8" stroke-linecap="round" opacity="0.35"/>
    <rect x="126" y="1397" width="828" height="94" rx="47" fill="url(#roller)" stroke="#321505" stroke-width="8"/>
    <rect x="98" y="1425" width="78" height="38" rx="19" fill="#2e1305"/>
    <rect x="904" y="1425" width="78" height="38" rx="19" fill="#2e1305"/>
    <path d="M188 1435 H892" stroke="#f0b45a" stroke-width="8" stroke-linecap="round" opacity="0.35"/>`;
}

function cornerDecor() {
  const corners = [
    [246, 270, 1, 1],
    [834, 270, -1, 1],
    [246, 1294, 1, -1],
    [834, 1294, -1, -1],
  ];
  return corners.map(([x, y, sx, sy]) => `
    <g transform="translate(${x} ${y}) scale(${sx} ${sy})" opacity="0.78">
      <path d="M0 0 C54 6, 82 34, 88 88" fill="none" stroke="#9d5f1b" stroke-width="4"/>
      <path d="M18 10 C44 18, 62 38, 68 68" fill="none" stroke="#e8b957" stroke-width="2.5"/>
      <circle cx="95" cy="95" r="7" fill="#9d5f1b"/>
    </g>`).join('');
}

function faintCrests() {
  return `
    <g opacity="0.11">
      <path d="M414 928 H666 L690 760 L622 826 L540 706 L458 826 L390 760 Z" fill="none" stroke="#853017" stroke-width="14"/>
      <path d="M432 978 H648 M462 1028 H618" stroke="#853017" stroke-width="16" stroke-linecap="round"/>
      <circle cx="390" cy="760" r="21" fill="#853017"/>
      <circle cx="540" cy="706" r="21" fill="#853017"/>
      <circle cx="690" cy="760" r="21" fill="#853017"/>
    </g>`;
}

function seal() {
  return `
    <g transform="translate(744 1202)" filter="url(#softShadow)">
      <circle cx="88" cy="88" r="78" fill="url(#sealInk)" opacity="0.94"/>
      <circle cx="88" cy="88" r="61" fill="none" stroke="#ffd4c5" stroke-width="4" opacity="0.72"/>
      <text x="88" y="75" text-anchor="middle" class="seal" fill="#ffe2d3">國王</text>
      <text x="88" y="122" text-anchor="middle" class="seal" fill="#ffe2d3">御印</text>
    </g>`;
}

function formatTaiwanDate(date) {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    clampPercent,
    escapeXml,
    imageFileToDataUri,
    svgToPngAttachment,
    trimText,
    wrapText,
} from '../../../utils/imageRendering.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_AVATAR_PATH = path.join(__dirname, '..', '..', '..', '..', 'assets', 'king-chihuahua.png');
const DAILY_BACKGROUND_PATH = path.join(__dirname, '..', '..', '..', '..', 'assets', 'fun', 'daily-background.png');
const FORTUNE_BACKGROUND_PATH = path.join(__dirname, '..', '..', '..', '..', 'assets', 'fun', 'fortune-background.png');
const WIDTH = 1200;
const HEIGHT = 675;
const BADGE_SIZE = 154;
const DAILY_FILENAME = 'daily-card.png';
const FORTUNE_FILENAME = 'fortune-card.png';
const FONT = '"Noto Sans CJK TC", "Microsoft JhengHei", "Segoe UI", Arial, sans-serif';
const FONT_ATTR = 'Noto Sans CJK TC, Microsoft JhengHei, Segoe UI, Arial, sans-serif';

export async function renderDailyCardImage({
    displayName,
    quote,
    luckyNum,
    luckyLabel,
    luckyStars,
    date,
    avatarPath = DEFAULT_AVATAR_PATH,
} = {}) {
    const [badge, background] = await Promise.all([
        renderKingBadge(avatarPath, DAILY_THEME),
        loadBackgroundDataUri(DAILY_BACKGROUND_PATH),
    ]);
    const svg = buildDailyCardSvg({
        badge,
        background,
        displayName,
        quote,
        luckyNum,
        luckyLabel,
        luckyStars,
        date,
    });

    return svgToPngAttachment(svg, DAILY_FILENAME);
}

export async function renderFortuneCardImage({
    displayName,
    question,
    fortune,
    answer,
    answerLabel,
    aura,
    color,
    avatarPath = DEFAULT_AVATAR_PATH,
} = {}) {
    const [badge, background] = await Promise.all([
        renderKingBadge(avatarPath, FORTUNE_THEME),
        loadBackgroundDataUri(FORTUNE_BACKGROUND_PATH),
    ]);
    const svg = buildFortuneCardSvg({
        badge,
        background,
        displayName,
        question,
        fortune,
        answer,
        answerLabel,
        aura,
        color,
    });

    return svgToPngAttachment(svg, FORTUNE_FILENAME);
}

async function renderKingBadge(avatarPath, theme) {
    const x = 72;
    const y = 66;
    const cx = x + BADGE_SIZE / 2;
    const cy = y + BADGE_SIZE / 2;

    const avatarDataUri = await loadAvatarDataUri(avatarPath);
    const face = avatarDataUri
        ? `<image href="${avatarDataUri}" x="${x}" y="${y}" width="${BADGE_SIZE}" height="${BADGE_SIZE}" preserveAspectRatio="xMidYMid slice" clip-path="url(#kingBadgeClip)"/>`
        : `<circle cx="${cx}" cy="${cy}" r="${BADGE_SIZE / 2}" fill="${theme.badgeFallback}"/>
           <text x="${cx}" y="${cy + 17}" text-anchor="middle" font-size="48" font-weight="900" fill="${theme.badgeText}" font-family="${FONT_ATTR}">&#x1F415;&#x1F451;</text>`;

    return `
      <g filter="url(#softShadow)">
        <circle cx="${cx}" cy="${cy}" r="99" fill="${theme.badgeGlow}" opacity="0.45"/>
        <circle cx="${cx}" cy="${cy}" r="88" fill="none" stroke="${theme.badgeOuter}" stroke-width="8" opacity="0.72"/>
        <circle cx="${cx}" cy="${cy}" r="82" fill="#fff8df" stroke="${theme.gold}" stroke-width="7"/>
        ${face}
        <circle cx="${cx}" cy="${cy}" r="77" fill="none" stroke="#fff8d0" stroke-width="4" opacity="0.95"/>
        <circle cx="${cx}" cy="${cy}" r="91" fill="none" stroke="${theme.badgeSpark}" stroke-width="2" stroke-dasharray="10 10" opacity="0.55"/>
      </g>`;
}

async function loadAvatarDataUri(avatarPath) {
    return imageFileToDataUri(avatarPath, {
        width: BADGE_SIZE,
        height: BADGE_SIZE,
        fit: 'cover',
        withoutEnlargement: false,
    });
}

async function loadBackgroundDataUri(backgroundPath) {
    return imageFileToDataUri(backgroundPath, {
        width: WIDTH,
        height: HEIGHT,
        fit: 'cover',
        withoutEnlargement: false,
    });
}

function bitmapBackdrop(background, fallback) {
    return background
        ? `<image href="${background}" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" preserveAspectRatio="xMidYMid slice"/>`
        : fallback;
}

function buildDailyCardSvg({ badge, background, displayName, quote, luckyNum, luckyLabel, luckyStars, date }) {
    const luck = clampPercent(luckyNum);
    const label = luckyLabel || labelForLuck(luck);
    const stars = luckyStars || starsForLuck(luck);
    const quoteLines = wrapText(quote, 22, 3);
    const barWidth = Math.round(405 * (luck / 100));
    const backdrop = bitmapBackdrop(background, `
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#dailyBackdrop)"/>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#royalHallGlow)" opacity="0.9"/>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#royalCrestPattern)" opacity="0.13"/>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#paperNoise)" opacity="0.14"/>
      <rect x="38" y="30" width="1124" height="612" rx="34" fill="#f3c970" stroke="#6b3d08" stroke-width="7" filter="url(#cardShadow)"/>
      <rect x="54" y="46" width="1092" height="580" rx="27" fill="#fff0bd" stroke="#d79a23" stroke-width="4"/>
      <rect x="76" y="68" width="1048" height="536" rx="21" fill="#fff6df" stroke="#e8bd55" stroke-width="2"/>
      ${royalParchmentDecor()}
      ${royalCornerOrnaments()}`);

    return baseSvg(DAILY_THEME, `
      ${backdrop}
      <path d="M91 254 H1110" stroke="#b67a12" stroke-width="3" opacity="0.58"/>
      <path d="M91 260 H1110" stroke="#fff7d8" stroke-width="2" opacity="0.8"/>
      ${badge}

      <g filter="url(#softShadow)">
        <rect x="302" y="74" width="688" height="146" rx="24" fill="#fffaf0" stroke="#d8a13a" stroke-width="3"/>
        <rect x="322" y="94" width="648" height="106" rx="18" fill="#fff7df" stroke="#efd07b" stroke-width="2" opacity="0.9"/>
        <text x="646" y="119" text-anchor="middle" class="date-pill" fill="#8b621d">GIGI KINGDOM / ${escapeXml(date || formatDate())}</text>
        <text x="646" y="171" text-anchor="middle" class="title daily-title" fill="#3f2608">今日一汪</text>
        <path d="M396 187 H896" stroke="#e8c06a" stroke-width="2" opacity="0.58"/>
        <text x="646" y="211" text-anchor="middle" class="daily-recipient" fill="#765218">給 ${escapeXml(trimText(displayName || '皇家旅人', 22))}</text>
      </g>

      <g filter="url(#softShadow)">
        <rect x="104" y="278" width="992" height="196" rx="25" fill="#fffaf0" stroke="#d7a13a" stroke-width="3"/>
        <rect x="124" y="298" width="952" height="156" rx="19" fill="#fff6dc" stroke="#efd68a" stroke-width="2"/>
        <path d="M155 317 H1045" stroke="#e2b84f" stroke-width="2" opacity="0.55"/>
        <text x="154" y="351" class="label" fill="#a46b07">今日御言</text>
        ${quoteLines.map((line, index) => `<text x="154" y="${404 + index * 43}" class="body" fill="#3f2608">${escapeXml(line)}</text>`).join('')}
      </g>

      <g filter="url(#softShadow)">
        <rect x="104" y="502" width="992" height="84" rx="22" fill="#f4d27c" stroke="#9f6810" stroke-width="3"/>
        <rect x="121" y="517" width="958" height="54" rx="16" fill="#fff0b8" opacity="0.52"/>
        <text x="146" y="554" class="label" fill="#7a4b06">今日幸運值</text>
        <text x="320" y="556" class="metric" fill="#3f2608">${luck} / 100</text>
        <text x="514" y="554" class="small" fill="#765218">${escapeXml(label)}</text>
        <text x="846" y="523" text-anchor="middle" class="lucky-stars" fill="#8d5b08">${escapeXml(stars)}</text>
        <rect x="644" y="530" width="405" height="28" rx="14" fill="#8a5b10" opacity="0.72"/>
        <rect x="649" y="534" width="${Math.max(8, barWidth - 10)}" height="20" rx="10" fill="url(#goldBar)"/>
        <path d="M660 538 H${656 + Math.max(8, barWidth - 20)}" stroke="#fff7b6" stroke-width="3" stroke-linecap="round" opacity="0.66"/>
      </g>

      <rect x="78" y="604" width="1044" height="31" rx="15" fill="#8d2f18" opacity="0.92"/>
      <text x="600" y="626" text-anchor="middle" class="footer" fill="#ffe9a8">吉吉國王親自發放今日精神糧食</text>`);
}

function buildFortuneCardSvg({ badge, background, displayName, question, fortune, answer, answerLabel, aura, color }) {
    const auraValue = clampPercent(aura);
    const questionLines = wrapText(question || '今日整體運勢', 24, 2);
    const fortuneLines = wrapText(fortune || '平穩', 12, 1);
    const answerLines = wrapText(answer || '本王建議先深呼吸，再優雅出招。', 18, 3);
    const verdictLabel = answerLabel || '本王判決';
    const accentColor = colorToHex(color, '#f1c7ff');
    const backdrop = bitmapBackdrop(background, `
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#fortuneBackdrop)"/>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#oracleNebula)" opacity="0.92"/>
      ${oracleBackdrop()}
      <rect x="38" y="30" width="1124" height="612" rx="34" fill="#090d27" stroke="#d7b461" stroke-width="4" filter="url(#cardShadow)"/>
      <rect x="55" y="47" width="1090" height="578" rx="26" fill="#11163b" stroke="#7c68d8" stroke-width="3"/>
      <rect x="76" y="68" width="1048" height="536" rx="21" fill="none" stroke="#c59d4c" stroke-width="2" opacity="0.72"/>
      ${oracleCardDecor()}
      ${oracleCornerOrnaments()}`);

    return baseSvg(FORTUNE_THEME, `
      ${backdrop}
      ${badge}

      <g filter="url(#softShadow)">
        <text x="292" y="116" class="eyebrow" fill="#c7b8f4">GIGI KINGDOM / ROYAL ORACLE</text>
        <text x="292" y="184" class="title fortune-title" fill="#f7edff">皇家占卜所</text>
        <path d="M292 210 H890" stroke="#f3c96a" stroke-width="2" opacity="0.55"/>
        <text x="292" y="237" class="small" fill="#c7b8f4">給 ${escapeXml(trimText(displayName || '神秘旅人', 22))}</text>
      </g>

      <g filter="url(#softShadow)">
        <rect x="94" y="284" width="514" height="134" rx="22" fill="#1b2152" stroke="#6f5ed1" stroke-width="2"/>
        <rect x="115" y="304" width="64" height="64" rx="32" fill="#2b1f64" stroke="#9c75ff" stroke-width="2"/>
        <text x="147" y="350" text-anchor="middle" class="icon" fill="#d9c4ff">?</text>
        <text x="204" y="324" class="label" fill="#f3c96a">問題</text>
        ${questionLines.map((line, index) => `<text x="204" y="${369 + index * 36}" class="small fortune-text" fill="#fbf7ff">${escapeXml(line)}</text>`).join('')}
      </g>

      <g filter="url(#softShadow)">
        <rect x="94" y="438" width="514" height="140" rx="22" fill="#1b2152" stroke="${accentColor}" stroke-width="3"/>
        <rect x="115" y="458" width="64" height="64" rx="32" fill="#2b1f64" stroke="${accentColor}" stroke-width="2"/>
        <text x="147" y="504" text-anchor="middle" class="icon" fill="${accentColor}">*</text>
        <text x="204" y="482" class="label" fill="#f3c96a">運勢結果</text>
        ${fortuneLines.map((line, index) => `<text x="204" y="${539 + index * 36}" class="fortune-result" fill="${accentColor}">${escapeXml(line)}</text>`).join('')}
      </g>

      <g filter="url(#softShadow)">
        <rect x="636" y="284" width="472" height="294" rx="24" fill="#171b49" stroke="#6f5ed1" stroke-width="2"/>
        <path d="M662 352 H1082 M662 478 H1082" stroke="#7b68d8" stroke-width="2" opacity="0.55"/>
        <text x="672" y="328" class="label" fill="#f3c96a">${escapeXml(verdictLabel)}</text>
        ${answerLines.map((line, index) => `<text x="672" y="${386 + index * 34}" class="small fortune-text" fill="#fbf7ff">${escapeXml(line)}</text>`).join('')}
        <text x="672" y="524" class="label" fill="#f3c96a">Lucky Aura</text>
        <text x="1026" y="530" text-anchor="end" class="metric aura" fill="${accentColor}">${auraValue}%</text>
        <rect x="672" y="548" width="388" height="22" rx="11" fill="#403276"/>
        <rect x="676" y="552" width="${Math.max(8, Math.round(380 * (auraValue / 100)))}" height="14" rx="7" fill="${accentColor}"/>
        <path d="M682 555 H${676 + Math.max(8, Math.round(372 * (auraValue / 100)))}" stroke="#fff4ff" stroke-width="2" stroke-linecap="round" opacity="0.68"/>
      </g>

      <rect x="91" y="604" width="1018" height="31" rx="15" fill="#11163b" stroke="#6955c8" stroke-width="1"/>
      <text x="600" y="626" text-anchor="middle" class="footer" fill="#c7b8f4">吉吉國王的占卜僅供娛樂，真正的魔法仍在你手上</text>`);
}

function baseSvg(theme, content) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="dailyBackdrop" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#573006"/>
      <stop offset="46%" stop-color="#bd821d"/>
      <stop offset="100%" stop-color="#f8d98a"/>
    </linearGradient>
    <radialGradient id="royalHallGlow" cx="50%" cy="12%" r="72%">
      <stop offset="0%" stop-color="#fff1b2"/>
      <stop offset="46%" stop-color="#d39a2f"/>
      <stop offset="100%" stop-color="#5e3508"/>
    </radialGradient>
    <linearGradient id="fortuneBackdrop" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#030615"/>
      <stop offset="46%" stop-color="#111847"/>
      <stop offset="100%" stop-color="#2b1f64"/>
    </linearGradient>
    <linearGradient id="goldBar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffd052"/>
      <stop offset="52%" stop-color="#fff0a6"/>
      <stop offset="100%" stop-color="#c98108"/>
    </linearGradient>
    <linearGradient id="auraBar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#8c5cff"/>
      <stop offset="52%" stop-color="#f0a8ff"/>
      <stop offset="100%" stop-color="#fff1ff"/>
    </linearGradient>
    <radialGradient id="oracleNebula" cx="79%" cy="18%" r="72%">
      <stop offset="0%" stop-color="#6f55d9"/>
      <stop offset="34%" stop-color="#2a286c"/>
      <stop offset="100%" stop-color="#030615"/>
    </radialGradient>
    <pattern id="royalCrestPattern" width="150" height="150" patternUnits="userSpaceOnUse">
      <path d="M42 92 H108 L116 52 L94 68 L76 42 L56 68 L34 52 Z" fill="none" stroke="#7a4b06" stroke-width="3" opacity="0.38"/>
      <circle cx="34" cy="52" r="5" fill="#7a4b06" opacity="0.22"/>
      <circle cx="76" cy="42" r="5" fill="#7a4b06" opacity="0.22"/>
      <circle cx="116" cy="52" r="5" fill="#7a4b06" opacity="0.22"/>
      <path d="M50 104 H100 M58 116 H92" stroke="#7a4b06" stroke-width="3" opacity="0.34"/>
    </pattern>
    <pattern id="oracleStarPattern" width="180" height="150" patternUnits="userSpaceOnUse">
      <circle cx="32" cy="36" r="2.4" fill="#f3c96a" opacity="0.72"/>
      <circle cx="96" cy="28" r="1.8" fill="#d9c4ff" opacity="0.72"/>
      <circle cx="146" cy="82" r="2.2" fill="#f3c96a" opacity="0.62"/>
      <path d="M32 36 L96 28 L146 82" stroke="#d9c4ff" stroke-width="1.2" opacity="0.22"/>
      <circle cx="72" cy="118" r="1.6" fill="#fff4c7" opacity="0.6"/>
    </pattern>
    <filter id="paperNoise" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="8"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.22"/>
      </feComponentTransfer>
    </filter>
    <clipPath id="kingBadgeClip"><circle cx="149" cy="143" r="77"/></clipPath>
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
    <filter id="softShadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000000" flood-opacity="0.22"/>
    </filter>
    <style>
      .font { font-family: ${FONT}; }
      .eyebrow { font-size: 23px; font-weight: 800; letter-spacing: 0; }
      .date-pill { font-size: 22px; font-weight: 900; letter-spacing: 0; }
      .daily-recipient { font-size: 21px; font-weight: 800; letter-spacing: 0; }
      .title { font-size: 62px; font-weight: 900; letter-spacing: 0; }
      .daily-title { font-size: 54px; }
      .fortune-title { font-size: 60px; }
      .label { font-size: 25px; font-weight: 900; letter-spacing: 0; }
      .body { font-size: 34px; font-weight: 760; letter-spacing: 0; }
      .small { font-size: 23px; font-weight: 700; letter-spacing: 0; }
      .lucky-stars { font-size: 23px; font-weight: 900; letter-spacing: 0; }
      .footer { font-size: 21px; font-weight: 800; letter-spacing: 0; }
      .metric { font-size: 40px; font-weight: 900; letter-spacing: 0; }
      .aura { font-size: 44px; }
      .seal { font-size: 92px; font-weight: 900; letter-spacing: 0; }
      .icon { font-size: 40px; font-weight: 900; letter-spacing: 0; }
      .fortune-result { font-size: 48px; font-weight: 900; letter-spacing: 0; }
      .fortune-text { font-weight: 760; }
    </style>
  </defs>
  <g class="font">${content}</g>
</svg>`;
}

function cornerOrnaments(primary, secondary) {
    const corners = [
        [87, 81, 1, 1],
        [1113, 81, -1, 1],
        [87, 595, 1, -1],
        [1113, 595, -1, -1],
    ];
    return corners.map(([x, y, sx, sy]) => `
      <g transform="translate(${x} ${y}) scale(${sx} ${sy})" opacity="0.82">
        <path d="M0 0 C32 4, 48 20, 52 52" fill="none" stroke="${primary}" stroke-width="3"/>
        <path d="M12 7 C28 12, 35 21, 38 38" fill="none" stroke="${secondary}" stroke-width="2"/>
        <circle cx="58" cy="58" r="5" fill="${primary}"/>
      </g>`).join('');
}

function royalParchmentDecor() {
    return `
      <g opacity="0.5">
        <path d="M94 92 C220 56, 282 96, 430 70 C590 42, 695 82, 840 62 C962 46, 1040 62, 1110 96" fill="none" stroke="#e2b84f" stroke-width="2" opacity="0.42"/>
        <path d="M93 580 C220 615, 322 575, 454 604 C604 636, 744 583, 902 606 C1016 622, 1070 606, 1110 580" fill="none" stroke="#b87b19" stroke-width="2" opacity="0.38"/>
        <path d="M168 184 H284 L298 112 L258 140 L214 88 L174 140 L134 112 Z" fill="none" stroke="#b98318" stroke-width="4" opacity="0.13"/>
        <path d="M180 203 H270 M195 220 H255" stroke="#8d5b08" stroke-width="5" stroke-linecap="round" opacity="0.12"/>
        <path d="M900 420 L1012 532 M1012 420 L900 532" stroke="#b98318" stroke-width="8" stroke-linecap="round" opacity="0.1"/>
        <circle cx="900" cy="420" r="13" fill="none" stroke="#8d5b08" stroke-width="4" opacity="0.11"/>
        <circle cx="1012" cy="420" r="13" fill="none" stroke="#8d5b08" stroke-width="4" opacity="0.11"/>
        <path d="M875 116 C888 94, 902 94, 914 116 C926 94, 941 94, 954 116 L952 153 H877 Z" fill="#c7942b" opacity="0.12"/>
        <path d="M887 160 H942" stroke="#8d5b08" stroke-width="6" stroke-linecap="round" opacity="0.12"/>
        <path d="M126 566 C160 548, 184 548, 218 566 M982 566 C1016 548, 1040 548, 1074 566" fill="none" stroke="#8d5b08" stroke-width="3" opacity="0.28"/>
      </g>`;
}

function royalCornerOrnaments() {
    const corners = [
        [92, 86, 1, 1],
        [1108, 86, -1, 1],
        [92, 590, 1, -1],
        [1108, 590, -1, -1],
    ];
    return corners.map(([x, y, sx, sy]) => `
      <g transform="translate(${x} ${y}) scale(${sx} ${sy})" opacity="0.72">
        <path d="M0 0 C42 3, 66 27, 70 70" fill="none" stroke="#9c6612" stroke-width="3"/>
        <path d="M14 9 C35 15, 48 30, 52 52" fill="none" stroke="#e8bd55" stroke-width="2"/>
        <path d="M3 52 C24 44, 42 26, 50 3" fill="none" stroke="#c98f22" stroke-width="2" opacity="0.72"/>
        <circle cx="76" cy="76" r="5" fill="#9c6612"/>
      </g>`).join('');
}

function oracleBackdrop() {
    return `
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#oracleStarPattern)" opacity="0.72"/>
      <g opacity="0.64">
        <path d="M134 594 C246 514, 354 536, 476 454 C604 368, 720 402, 836 300 C952 198, 1032 216, 1134 126" fill="none" stroke="#7968d7" stroke-width="1.4" opacity="0.32"/>
        <circle cx="208" cy="545" r="3" fill="#f3c96a"/>
        <circle cx="358" cy="510" r="2.4" fill="#d9c4ff"/>
        <circle cx="520" cy="424" r="3" fill="#f3c96a"/>
        <circle cx="714" cy="374" r="2.4" fill="#d9c4ff"/>
        <circle cx="882" cy="260" r="3" fill="#f3c96a"/>
        <circle cx="1038" cy="198" r="2.4" fill="#d9c4ff"/>
      </g>
      <g transform="translate(916 116)" opacity="0.2">
        <circle cx="86" cy="86" r="82" fill="none" stroke="#f3c96a" stroke-width="2"/>
        <circle cx="86" cy="86" r="56" fill="none" stroke="#d9c4ff" stroke-width="2"/>
        <path d="M86 4 V168 M4 86 H168 M26 26 L146 146 M146 26 L26 146" stroke="#d9c4ff" stroke-width="1.5"/>
        <circle cx="86" cy="86" r="10" fill="#f3c96a" opacity="0.5"/>
      </g>`;
}

function oracleCardDecor() {
    return `
      <g opacity="0.42">
        <g transform="translate(884 98) rotate(-8)">
          <rect x="0" y="0" width="74" height="112" rx="10" fill="#1a1f55" stroke="#d9c4ff" stroke-width="2"/>
          <path d="M37 20 L45 45 L70 45 L50 60 L58 86 L37 70 L16 86 L24 60 L4 45 L29 45 Z" fill="none" stroke="#f3c96a" stroke-width="2"/>
        </g>
        <g transform="translate(972 92) rotate(10)">
          <rect x="0" y="0" width="74" height="112" rx="10" fill="#171b49" stroke="#f3c96a" stroke-width="2"/>
          <circle cx="37" cy="52" r="22" fill="none" stroke="#d9c4ff" stroke-width="2"/>
          <path d="M37 20 V84 M18 52 H56" stroke="#d9c4ff" stroke-width="1.6"/>
        </g>
        <path d="M846 240 C905 192, 984 193, 1040 242" fill="none" stroke="#fff4c7" stroke-width="4" stroke-linecap="round" opacity="0.3"/>
        <path d="M868 250 C914 220, 974 220, 1018 250" fill="none" stroke="#9c75ff" stroke-width="3" stroke-linecap="round" opacity="0.4"/>
      </g>
      <g opacity="0.34">
        <circle cx="180" cy="548" r="22" fill="none" stroke="#f3c96a" stroke-width="2"/>
        <path d="M205 548 A22 22 0 1 1 205 547.5" fill="none" stroke="#d9c4ff" stroke-width="6" stroke-linecap="round"/>
        <circle cx="245" cy="548" r="18" fill="none" stroke="#d9c4ff" stroke-width="2"/>
        <circle cx="304" cy="548" r="14" fill="#f3c96a" opacity="0.22"/>
      </g>`;
}

function oracleCornerOrnaments() {
    const corners = [
        [92, 84, 1, 1],
        [1108, 84, -1, 1],
        [92, 590, 1, -1],
        [1108, 590, -1, -1],
    ];
    return corners.map(([x, y, sx, sy]) => `
      <g transform="translate(${x} ${y}) scale(${sx} ${sy})" opacity="0.74">
        <path d="M0 0 C38 0, 62 24, 62 62" fill="none" stroke="#f3c96a" stroke-width="3"/>
        <path d="M13 8 C34 10, 48 25, 50 50" fill="none" stroke="#7c68d8" stroke-width="2"/>
        <circle cx="68" cy="68" r="5" fill="#f3c96a"/>
      </g>`).join('');
}

function crystalOrb() {
    return `
      <g filter="url(#softShadow)" opacity="0.92">
        <circle cx="1002" cy="210" r="82" fill="#7c55ff" opacity="0.24"/>
        <circle cx="1002" cy="210" r="58" fill="none" stroke="#decaff" stroke-width="3" opacity="0.55"/>
        <path d="M960 175 C986 145, 1030 149, 1046 184" fill="none" stroke="#fff7ff" stroke-width="5" stroke-linecap="round" opacity="0.55"/>
        <path d="M930 284 H1074 L1046 320 H958 Z" fill="#caa14a" opacity="0.8"/>
        <path d="M954 289 H1050" stroke="#ffe6a0" stroke-width="5" stroke-linecap="round"/>
      </g>`;
}

function starField() {
    const stars = [
        [176, 96, 3], [252, 246, 2], [424, 91, 4], [514, 228, 2],
        [734, 112, 3], [834, 224, 2], [1016, 92, 4], [1100, 252, 3],
        [220, 548, 2], [388, 508, 3], [562, 116, 2], [914, 414, 3],
    ];
    return stars
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#f3c96a" opacity="0.68"/>`)
        .join('');
}

function labelForLuck(luck) {
    if (luck <= 20) return '充電日';
    if (luck <= 40) return '慢慢來';
    if (luck <= 60) return '平穩日';
    if (luck <= 80) return '好運上升';
    return '皇家賜福';
}

function starsForLuck(luck) {
    const value = Math.max(1, Math.min(100, Number(luck) || 1));
    if (value <= 20) return '★';
    if (value <= 40) return '★★';
    if (value <= 60) return '★★★';
    if (value <= 80) return '★★★★';
    return '★★★★★';
}

function colorToHex(color, fallback) {
    if (typeof color === 'number' && Number.isFinite(color)) {
        return `#${Math.max(0, Math.min(0xFFFFFF, color)).toString(16).padStart(6, '0')}`;
    }
    if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) {
        return color;
    }
    return fallback;
}

function formatDate(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

const DAILY_THEME = {
    gold: '#f0bd3e',
    badgeGlow: '#fff0a6',
    badgeOuter: '#7b4708',
    badgeFallback: '#fff7df',
    badgeText: '#6b3f08',
    badgeSpark: '#fff2a4',
};

const FORTUNE_THEME = {
    gold: '#f3c96a',
    badgeGlow: '#8c6bff',
    badgeOuter: '#2f235c',
    badgeFallback: '#f1e9ff',
    badgeText: '#3f2a70',
    badgeSpark: '#d9c4ff',
};

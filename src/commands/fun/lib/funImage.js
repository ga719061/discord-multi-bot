import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AttachmentBuilder } from 'discord.js';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_AVATAR_PATH = path.join(__dirname, '..', '..', '..', '..', 'assets', 'king-chihuahua.png');
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
    date,
    avatarPath = DEFAULT_AVATAR_PATH,
} = {}) {
    const badge = await renderKingBadge(avatarPath, DAILY_THEME);
    const svg = buildDailyCardSvg({
        badge,
        displayName,
        quote,
        luckyNum,
        luckyLabel,
        date,
    });

    return pngAttachment(svg, DAILY_FILENAME);
}

export async function renderFortuneCardImage({
    displayName,
    question,
    fortune,
    answer,
    answerLabel,
    aura,
    avatarPath = DEFAULT_AVATAR_PATH,
} = {}) {
    const badge = await renderKingBadge(avatarPath, FORTUNE_THEME);
    const svg = buildFortuneCardSvg({
        badge,
        displayName,
        question,
        fortune,
        answer,
        answerLabel,
        aura,
    });

    return pngAttachment(svg, FORTUNE_FILENAME);
}

async function pngAttachment(svg, filename) {
    const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
    return {
        attachment: new AttachmentBuilder(buffer, { name: filename }),
        filename,
        buffer,
    };
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
    try {
        const image = await fs.readFile(avatarPath);
        const buffer = await sharp(image)
            .resize(BADGE_SIZE, BADGE_SIZE, { fit: 'cover' })
            .png({ compressionLevel: 9 })
            .toBuffer();
        return `data:image/png;base64,${buffer.toString('base64')}`;
    } catch {
        return null;
    }
}

function buildDailyCardSvg({ badge, displayName, quote, luckyNum, luckyLabel, date }) {
    const luck = clampPercent(luckyNum);
    const label = luckyLabel || labelForLuck(luck);
    const quoteLines = wrapText(quote, 22, 3);
    const barWidth = Math.round(405 * (luck / 100));

    return baseSvg(DAILY_THEME, `
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#dailyBackdrop)"/>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#paperNoise)" opacity="0.22"/>
      <rect x="38" y="30" width="1124" height="612" rx="34" fill="#f8d989" stroke="#70420a" stroke-width="7" filter="url(#cardShadow)"/>
      <rect x="54" y="46" width="1092" height="580" rx="27" fill="#fff2ca" stroke="#dfa839" stroke-width="4"/>
      <rect x="76" y="68" width="1048" height="536" rx="21" fill="#fff6dd" stroke="#efd07b" stroke-width="2"/>
      ${cornerOrnaments('#9c6612', '#f8d989')}
      <path d="M91 254 H1110" stroke="#d39a2c" stroke-width="3" opacity="0.58"/>
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
        <rect x="644" y="530" width="405" height="28" rx="14" fill="#8a5b10" opacity="0.72"/>
        <rect x="649" y="534" width="${Math.max(8, barWidth - 10)}" height="20" rx="10" fill="url(#goldBar)"/>
        <path d="M660 538 H${656 + Math.max(8, barWidth - 20)}" stroke="#fff7b6" stroke-width="3" stroke-linecap="round" opacity="0.66"/>
      </g>

      <rect x="78" y="604" width="1044" height="31" rx="15" fill="#8d2f18" opacity="0.92"/>
      <text x="600" y="626" text-anchor="middle" class="footer" fill="#ffe9a8">吉吉國王親自發放今日精神糧食</text>`);
}

function buildFortuneCardSvg({ badge, displayName, question, fortune, answer, answerLabel, aura }) {
    const auraValue = clampPercent(aura);
    const questionLines = wrapText(question || '今日整體運勢', 24, 2);
    const fortuneLines = wrapText(fortune || '平穩', 12, 1);
    const answerLines = wrapText(answer || '本王建議先深呼吸，再優雅出招。', 18, 3);
    const verdictLabel = answerLabel || '本王判決';
    const barWidth = Math.round(582 * (auraValue / 100));

    return baseSvg(FORTUNE_THEME, `
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#fortuneBackdrop)"/>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#starMist)" opacity="0.5"/>
      ${starField()}
      <circle cx="1007" cy="160" r="184" fill="#8f6dff" opacity="0.12"/>
      <circle cx="1007" cy="160" r="112" fill="none" stroke="#f3c96a" stroke-width="2" opacity="0.28"/>
      <rect x="38" y="30" width="1124" height="612" rx="34" fill="#090d27" stroke="#d7b461" stroke-width="4" filter="url(#cardShadow)"/>
      <rect x="55" y="47" width="1090" height="578" rx="26" fill="#11163b" stroke="#7c68d8" stroke-width="3"/>
      <rect x="76" y="68" width="1048" height="536" rx="21" fill="none" stroke="#c59d4c" stroke-width="2" opacity="0.72"/>
      ${cornerOrnaments('#f3c96a', '#7c68d8')}
      ${crystalOrb()}
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
        <rect x="94" y="438" width="514" height="140" rx="22" fill="#1b2152" stroke="#6f5ed1" stroke-width="2"/>
        <rect x="115" y="458" width="64" height="64" rx="32" fill="#2b1f64" stroke="#9c75ff" stroke-width="2"/>
        <text x="147" y="504" text-anchor="middle" class="icon" fill="#d9c4ff">*</text>
        <text x="204" y="482" class="label" fill="#f3c96a">運勢結果</text>
        ${fortuneLines.map((line, index) => `<text x="204" y="${539 + index * 36}" class="fortune-result" fill="#f1c7ff">${escapeXml(line)}</text>`).join('')}
      </g>

      <g filter="url(#softShadow)">
        <rect x="636" y="284" width="472" height="294" rx="24" fill="#171b49" stroke="#6f5ed1" stroke-width="2"/>
        <path d="M662 352 H1082 M662 478 H1082" stroke="#7b68d8" stroke-width="2" opacity="0.55"/>
        <text x="672" y="328" class="label" fill="#f3c96a">${escapeXml(verdictLabel)}</text>
        ${answerLines.map((line, index) => `<text x="672" y="${386 + index * 34}" class="small fortune-text" fill="#fbf7ff">${escapeXml(line)}</text>`).join('')}
        <text x="672" y="524" class="label" fill="#f3c96a">Lucky Aura</text>
        <text x="1026" y="530" text-anchor="end" class="metric aura" fill="#f1c7ff">${auraValue}%</text>
        <rect x="672" y="548" width="388" height="22" rx="11" fill="#403276"/>
        <rect x="676" y="552" width="${Math.max(8, Math.round(380 * (auraValue / 100)))}" height="14" rx="7" fill="url(#auraBar)"/>
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
      <stop offset="0%" stop-color="#4f2e0c"/>
      <stop offset="45%" stop-color="#c69027"/>
      <stop offset="100%" stop-color="#ffe8aa"/>
    </linearGradient>
    <linearGradient id="fortuneBackdrop" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#070b1f"/>
      <stop offset="50%" stop-color="#151848"/>
      <stop offset="100%" stop-color="#3b246f"/>
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
    <radialGradient id="starMist" cx="82%" cy="20%" r="68%">
      <stop offset="0%" stop-color="#8e65ff"/>
      <stop offset="46%" stop-color="#2b246e"/>
      <stop offset="100%" stop-color="#070b1f"/>
    </radialGradient>
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

function wrapText(text, maxChars, maxLines) {
    const chars = [...String(text || '-')];
    const lines = [];
    for (let index = 0; index < chars.length && lines.length < maxLines; index += maxChars) {
        lines.push(chars.slice(index, index + maxChars).join(''));
    }
    if (chars.length > maxChars * maxLines && lines.length > 0) {
        lines[lines.length - 1] = `${lines.at(-1).slice(0, Math.max(0, maxChars - 1))}...`;
    }
    return lines;
}

function trimText(text, maxLength) {
    const chars = [...String(text || '-')];
    return chars.length <= maxLength ? chars.join('') : `${chars.slice(0, Math.max(0, maxLength - 1)).join('')}...`;
}

function clampPercent(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
}

function labelForLuck(luck) {
    if (luck <= 20) return '充電日';
    if (luck <= 40) return '慢慢來';
    if (luck <= 60) return '平穩日';
    if (luck <= 80) return '好運上升';
    return '皇家賜福';
}

function formatDate(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function escapeXml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
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

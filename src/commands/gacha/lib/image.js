import {
  clampPercent,
  escapeXml,
  imageFileToDataUri,
  svgToPngAttachment,
  trimText,
} from '../../../utils/imageRendering.js';
import { maskWuwaUid } from './importer.js';
import { calculateWuwaPoolStats } from './statistics.js';
import { resolveWuwaItemImages } from './itemAssets.js';

const WIDTH = 1600;
const HEIGHT = 900;
const FONT = '"Noto Sans CJK TC", "Microsoft JhengHei", "Segoe UI", Arial, sans-serif';
const BACKGROUND_PATH = new URL('../../../../assets/wuwa/card-background-v3.png', import.meta.url);

export async function renderWuwaCard(account, poolId, options = {}) {
  const stats = calculateWuwaPoolStats(account.history, poolId);
  const recent = stats.fiveStars.slice(0, 5);
  const [images, backgroundImage] = await Promise.all([
    resolveWuwaItemImages(
      recent,
      account.languageCode,
      options.fetchImpl ?? fetch
    ).catch(() => new Map()),
    imageFileToDataUri(BACKGROUND_PATH, {
      width: WIDTH,
      height: HEIGHT,
      fit: 'cover',
      withoutEnlargement: false,
    }),
  ]);
  const svg = buildWuwaSvg(account, stats, images, { backgroundImage });
  return svgToPngAttachment(svg, `wuwa-${poolId}-card.png`);
}

export function buildWuwaSvg(account, stats, images = new Map(), assets = {}) {
  const updatedAt = formatUpdatedAt(account.updatedAt);
  const total = Math.max(1, stats.total);
  const rarity = [5, 4, 3].map((rank) => ({
    rank,
    count: stats.counts[rank],
    percent: stats.counts[rank] / total * 100,
  }));
  const recent = stats.fiveStars.slice(0, 5);
  const timeline = timelineLayout(recent.length);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="ocean" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#020b18"/>
      <stop offset="48%" stop-color="#073043"/>
      <stop offset="100%" stop-color="#041321"/>
    </linearGradient>
    <radialGradient id="tideGlow" cx="0.85" cy="0.12" r="0.72">
      <stop offset="0%" stop-color="#35e6dc" stop-opacity="0.28"/>
      <stop offset="62%" stop-color="#0a4d62" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#020914" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ad7a26"/>
      <stop offset="45%" stop-color="#f5d487"/>
      <stop offset="100%" stop-color="#9b671c"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#102a42" stop-opacity="0.82"/>
      <stop offset="100%" stop-color="#050d1c" stop-opacity="0.78"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="10"/></filter>
    <filter id="shadow"><feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#000814" flood-opacity="0.65"/></filter>
    ${timeline.map((position, index) =>
      `<clipPath id="timeline${index + 1}"><circle cx="${position.x}" cy="${position.y}" r="44"/></clipPath>`
    ).join('')}
    <style>
      .font { font-family: ${FONT}; }
      .label { font-size: 21px; font-weight: 650; fill: #91b8c1; }
      .value { font-size: 47px; font-weight: 900; fill: #f8fcff; }
      .panelTitle { font-size: 28px; font-weight: 850; fill: #effcff; }
      .small { font-size: 18px; font-weight: 600; fill: #8aaab2; }
    </style>
  </defs>
  ${background(assets.backgroundImage)}
  <g class="font">
    ${header(account, stats, updatedAt)}
    ${metricCards(stats)}
    ${pityPanel(stats)}
    ${rarityPanel(rarity)}
    ${timelinePanel(recent, images, timeline)}
    <text x="800" y="868" text-anchor="middle" class="small" fill="#b4cbd0">資料來源：鳴潮遊戲內喚取紀錄 · 非官方公開 API · 吉吉王國皇家喚取卷宗</text>
  </g>
</svg>`;
}

function background(backgroundImage) {
  if (backgroundImage) {
    return `
  <image data-role="wuwa-background" href="${backgroundImage}" x="0" y="0" width="1600" height="900" preserveAspectRatio="xMidYMid slice"/>
  <rect width="1600" height="900" fill="#010713" fill-opacity="0.08"/>
  <rect x="18" y="18" width="1564" height="864" rx="8" fill="none" stroke="#5eddd6" stroke-opacity="0.28" stroke-width="2"/>`;
  }
  return `
  <rect width="1600" height="900" fill="url(#ocean)"/>
  <rect width="1600" height="900" fill="url(#tideGlow)"/>
  <path d="M-80 690 C180 520 310 820 590 660 S1050 480 1680 690" fill="none" stroke="#25d6d0" stroke-opacity="0.14" stroke-width="42" filter="url(#glow)"/>
  <path d="M-40 732 C220 562 340 850 620 704 S1090 540 1650 730" fill="none" stroke="#70fff3" stroke-opacity="0.24" stroke-width="3"/>
  <path d="M1190 -50 C1420 80 1300 280 1620 340" fill="none" stroke="url(#gold)" stroke-opacity="0.55" stroke-width="3"/>
  <circle cx="1490" cy="115" r="128" fill="none" stroke="#e0b65c" stroke-opacity="0.18" stroke-width="2"/>
  <circle cx="1490" cy="115" r="92" fill="none" stroke="#58eee1" stroke-opacity="0.18" stroke-width="2" stroke-dasharray="8 18"/>
  <path d="M28 42 H420 L452 74 H760" fill="none" stroke="#ddba70" stroke-opacity="0.48" stroke-width="2"/>
  <path d="M1572 858 H1190 L1158 826 H890" fill="none" stroke="#38d9d2" stroke-opacity="0.38" stroke-width="2"/>
  <rect x="18" y="18" width="1564" height="864" rx="8" fill="none" stroke="#5eddd6" stroke-opacity="0.22" stroke-width="2"/>`;
}

function header(account, stats, updatedAt) {
  return `
  <g data-region="header">
    <text x="58" y="86" font-size="54" font-weight="900" fill="#f6fdff">皇家喚取卷宗</text>
    <rect x="58" y="108" width="330" height="4" fill="url(#gold)"/>
    <text x="430" y="86" font-size="38" font-weight="850" fill="#5bf1e5">${escapeXml(stats.pool.name)}</text>
    <text x="58" y="151" class="label">漂泊者 UID</text>
    <text x="205" y="151" font-size="25" font-weight="800" fill="#f3d58d">${escapeXml(maskWuwaUid(account.playerUid))}</text>
    <text x="1528" y="74" text-anchor="end" class="label">最後更新</text>
    <text x="1528" y="112" text-anchor="end" font-size="25" font-weight="800" fill="#f5fbff">${escapeXml(updatedAt)}</text>
    <text x="1528" y="148" text-anchor="end" class="small">${escapeXml(account.region ?? 'GLOBAL')} · ${escapeXml(account.languageCode ?? 'zh-Hant')}</text>
  </g>`;
}

function metricCards(stats) {
  const cards = [
    ['總抽數', stats.total, '#f5d487'],
    ['五星數量', stats.counts[5], '#ffd36b'],
    ['五星平均出貨', stats.averagePity == null ? '—' : stats.averagePity.toFixed(1), '#5bf1e5'],
    ['距離五星硬保底', stats.remaining5, '#f2f7fb'],
  ];
  return `<g data-region="metrics">${cards.map((card, index) => {
    const x = 58 + index * 382;
    return `
      <rect x="${x}" y="184" width="354" height="154" rx="22" fill="url(#panel)" stroke="#5bcfc9" stroke-opacity="0.22" filter="url(#shadow)"/>
      <text x="${x + 28}" y="229" class="label">${card[0]}</text>
      <text x="${x + 28}" y="302" class="value" fill="${card[2]}">${card[1]}</text>`;
  }).join('')}</g>`;
}

function pityPanel(stats) {
  return `
  <g data-region="pity">
    <rect x="58" y="370" width="700" height="438" rx="24" fill="url(#panel)" stroke="#d8b365" stroke-opacity="0.24" filter="url(#shadow)"/>
    <text x="94" y="424" class="panelTitle">保底進度</text>
    ${progressBar('五星保底', stats.pity5, stats.pool.hardPity, 94, 466, '#e8bb5b')}
    ${progressBar('四星保底', stats.pity4, 10, 94, 585, '#b084ff')}
    <path d="M94 694 H722" stroke="#4f7881" stroke-opacity="0.4"/>
    <text x="94" y="741" class="label">目前狀態</text>
    <text x="94" y="780" font-size="24" font-weight="800" fill="#e7fbff">${stats.total ? `已累積 ${stats.pity5} 抽未出五星` : '此卡池尚無紀錄'}</text>
  </g>`;
}

function progressBar(label, current, max, x, y, color) {
  const width = 620;
  const filled = width * clampPercent(current / max * 100) / 100;
  return `
    <text x="${x}" y="${y}" class="label">${label}</text>
    <text x="${x + width}" y="${y}" text-anchor="end" font-size="23" font-weight="850" fill="#f4fbff">${current} / ${max}</text>
    <rect x="${x}" y="${y + 24}" width="${width}" height="32" rx="16" fill="#03101b" stroke="#3d6770"/>
    <rect x="${x}" y="${y + 24}" width="${Math.max(0, filled)}" height="32" rx="16" fill="${color}" opacity="0.9"/>
    <circle cx="${x + Math.max(16, Math.min(width - 16, filled))}" cy="${y + 40}" r="9" fill="#fff" opacity="${current ? 0.9 : 0}"/>`;
}

function rarityPanel(rarity) {
  return `
  <g data-region="rarity">
    <rect x="790" y="370" width="752" height="174" rx="24" fill="url(#panel)" stroke="#5bcfc9" stroke-opacity="0.22" filter="url(#shadow)"/>
    <text x="826" y="421" class="panelTitle">稀有度分布</text>
    ${rarity.map((item, index) => {
      const x = 826 + index * 226;
      const color = item.rank === 5 ? '#f4c760' : item.rank === 4 ? '#b58aff' : '#74b9d3';
      return `
        <text x="${x}" y="469" font-size="25" font-weight="900" fill="${color}">${item.rank}★</text>
        <text x="${x + 58}" y="469" font-size="25" font-weight="850" fill="#f4fbff">${item.count}</text>
        <text x="${x}" y="508" class="small">${item.percent.toFixed(1)}%</text>`;
    }).join('')}
  </g>`;
}

function timelinePanel(records, images, layout) {
  return `
  <g data-region="five-star-timeline">
    <rect x="790" y="570" width="752" height="238" rx="24" fill="url(#panel)" stroke="#d8b365" stroke-opacity="0.24" filter="url(#shadow)"/>
    <text x="826" y="616" class="panelTitle">最近五星紀錄</text>
    <path d="M826 638 H1506" stroke="#55747b" stroke-opacity="0.34"/>
    ${records.length ? records.map((record, index) => timelineItem(record, index, images, layout[index])).join('') : `
      <text x="1166" y="724" text-anchor="middle" font-size="27" font-weight="750" fill="#89aeb7">此卡池尚未取得五星紀錄</text>`}
  </g>`;
}

function timelineItem(record, index, images, position) {
  const cx = position.x;
  const cy = position.y;
  const image = images.get(String(record.resourceId));
  const clipId = `timeline${index + 1}`;
  return `
    <g data-item="${index}">
      <circle cx="${cx}" cy="${cy}" r="48" fill="#102f3b" stroke="#e5bc63" stroke-width="3"/>
      ${image
        ? `<image href="${image}" x="${cx - 44}" y="${cy - 44}" width="88" height="88" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
        : `<text x="${cx}" y="${cy + 15}" text-anchor="middle" font-size="40" font-weight="900" fill="#f3cb72">5★</text>`}
      <text x="${cx}" y="${cy + 72}" text-anchor="middle" font-size="18" font-weight="800" fill="#f5fbff">${escapeXml(trimText(record.name, 9))}</text>
      <text x="${cx}" y="${cy + 100}" text-anchor="middle" class="small">${record.pulls} 抽 · ${escapeXml(record.time.slice(5, 10))}</text>
    </g>`;
}

function timelineLayout(count) {
  if (count <= 0) return [];
  const centerX = 1166;
  const gap = 126;
  const startX = centerX - ((count - 1) * gap) / 2;
  return Array.from({ length: count }, (_, index) => ({
    x: startX + index * gap,
    y: 692,
  }));
}

function formatUpdatedAt(value) {
  const date = new Date(Number(value) || Date.now());
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

import {
  cacheKeyFor,
  escapeXml,
  fetchWithTimeout,
  imageFileToDataUri,
  imageUrlToDataUri,
  svgToPngAttachment,
} from '../../../utils/imageRendering.js';

const WIDTH = 1600;
const HEIGHT = 900;
const CARD_FILENAME = 'stats-card.png';
const FONT = '"Noto Sans CJK TC", "Microsoft JhengHei", "Segoe UI", Arial, sans-serif';
const FONT_ATTR = 'Noto Sans CJK TC, Microsoft JhengHei, Segoe UI, Arial, sans-serif';
const IMAGE_TIMEOUT_MS = 3500;
const RIOT_CDN = 'https://ddragon.leagueoflegends.com';
const VALORANT_API = 'https://valorant-api.com/v1';
const VALORANT_LOCALE = 'zh-TW';
const LOL_DEFAULT_LOCALE = 'en_US';
const LOL_LOCALE = 'zh_TW';
const BACKGROUND_PATHS = {
  valorant: new URL('../../../../assets/esports/stats-card-valorant-background.png', import.meta.url),
  lol: new URL('../../../../assets/esports/stats-card-lol-background.png', import.meta.url),
};

const imageCache = new Map();
const jsonCache = new Map();

const THEMES = {
  valorant: {
    name: 'VALORANT',
    subtitle: '精準數據 · 制霸戰場',
    bg: '#05090d',
    bg2: '#0a1218',
    panel: '#071116',
    panel2: '#111820',
    primary: '#ff4655',
    secondary: '#66f0ef',
    accent: '#ffd166',
    muted: '#8b98a5',
    line: '#303b45',
    glow: '#ff465544',
  },
  lol: {
    name: 'LEAGUE OF LEGENDS',
    subtitle: '峽谷榮耀 · 賽季卷宗',
    bg: '#06111f',
    bg2: '#0a2032',
    panel: '#07192a',
    panel2: '#10273c',
    primary: '#0ac8b9',
    secondary: '#c89b3c',
    accent: '#f0d98c',
    muted: '#96a9bd',
    line: '#31506b',
    glow: '#0ac8b944',
  },
};

export async function renderStatsImage(result, options = {}) {
  const assets = await resolveStatsAssets(result, options);
  const svg = buildStatsSvg(result, assets);
  return svgToPngAttachment(svg, CARD_FILENAME);
}

export function buildStatsSvg(result, assets = {}) {
  const theme = THEMES[result.game] || THEMES.valorant;
  const stats = result.stats || {};
  const isValorant = result.game === 'valorant';
  const coreCards = isValorant ? valorantCoreCards(stats) : lolCoreCards(stats);
  const sections = isValorant ? valorantSections(stats, assets) : lolSections(stats, assets);
  const updatedAt = formatUpdatedAt(stats.updatedAt);
  const layout = layoutForGame(isValorant);
  const footer = `資料來源 ${result.source}${result.isFallback ? ' · ValoCheck fallback' : ''} | ${isValorant ? 'All Modes' : '目前賽季公開資料'}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.bg}"/>
      <stop offset="55%" stop-color="${theme.bg2}"/>
      <stop offset="100%" stop-color="${theme.bg}"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.panel2}" stop-opacity="0.96"/>
      <stop offset="100%" stop-color="${theme.panel}" stop-opacity="0.92"/>
    </linearGradient>
    <linearGradient id="glassPanel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.panel2}" stop-opacity="0.82"/>
      <stop offset="100%" stop-color="${theme.panel}" stop-opacity="0.7"/>
    </linearGradient>
    <linearGradient id="metricPanel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.panel2}" stop-opacity="0.88"/>
      <stop offset="100%" stop-color="#03080d" stop-opacity="0.74"/>
    </linearGradient>
    <clipPath id="avatarClip"><circle cx="134" cy="306" r="69"/></clipPath>
    <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="18" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <style>
      .font { font-family: ${FONT}; }
      .title { font-weight: 900; font-size: 62px; letter-spacing: 0; fill: #f7fbff; }
      .game { font-weight: 900; font-size: 62px; letter-spacing: 0; fill: ${theme.primary}; }
      .body { font-weight: 700; font-size: 28px; fill: #f5f8fb; }
      .small { font-weight: 600; font-size: 21px; fill: ${theme.muted}; }
      .panelTitle { font-weight: 900; font-size: 28px; fill: #fff; }
    </style>
  </defs>
  ${backgroundMarkup(theme, assets.background)}
  ${backgroundTexture(theme, isValorant)}
  <rect x="18" y="14" width="1564" height="872" fill="none" stroke="${theme.primary}" stroke-opacity="0.45" stroke-width="2"/>
  ${redesignedHeader(theme, updatedAt, layout.header)}
  ${redesignedPlayerBlock(theme, stats, isValorant, assets.avatar, layout.identity)}
  ${redesignedCoreCardsMarkup(theme, coreCards, layout.metrics)}
  ${redesignedSectionsMarkup(theme, sections, layout.sections)}
  ${footerMarkup(theme, footer)}
</svg>`;
}

export async function resolveStatsAssets(result, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const stats = result.stats || {};
  const backgroundPromise = loadStatsBackground(result.game);
  const avatarPromise = dataUriFromUrl(stats.avatarUrl, fetchImpl, { width: 160, height: 160 });
  const assets = {
    background: null,
    avatar: null,
    agents: new Map(),
    weapons: new Map(),
    maps: new Map(),
    champions: new Map(),
    labels: {
      agents: new Map(),
      weapons: new Map(),
      maps: new Map(),
      champions: new Map(),
    },
  };

  if (result.game === 'valorant') {
    const mapItems = stats.maps?.length ? stats.maps : stats.recentHighlights;
    const [agents, weapons, maps] = await Promise.all([
      stats.topAgents?.length ? valorantAssetIndex('agents', fetchImpl) : emptyAssetIndex(),
      stats.weapons?.length ? valorantAssetIndex('weapons', fetchImpl) : emptyAssetIndex(),
      mapItems?.length ? valorantAssetIndex('maps', fetchImpl) : emptyAssetIndex(),
    ]);
    assets.labels.agents = agents.labels;
    assets.labels.weapons = weapons.labels;
    assets.labels.maps = maps.labels;
    await Promise.all([
      attachRowAssets(stats.topAgents, assets.agents, agents.images, fetchImpl, { width: 96, height: 96 }),
      attachRowAssets(stats.weapons, assets.weapons, weapons.images, fetchImpl, { width: 192, height: 80 }),
      attachRowAssets(mapItems, assets.maps, maps.images, fetchImpl, { width: 120, height: 72 }),
    ]);
  } else if (result.game === 'lol') {
    const champions = stats.topChampions?.length ? await lolChampionIndex(fetchImpl) : emptyAssetIndex();
    assets.labels.champions = champions.labels;
    await attachRowAssets(stats.topChampions, assets.champions, champions.images, fetchImpl, { width: 96, height: 96 });
  }

  [assets.background, assets.avatar] = await Promise.all([backgroundPromise, avatarPromise]);
  return assets;
}

function layoutForGame(isValorant) {
  return {
    header: { x: 56, y: 36, w: 1488, h: 116, soft: isValorant ? 0 : 1 },
    identity: { x: 54, y: 184, w: 558, h: 212 },
    metrics: { x: 648, y: 184, w: 896, h: 212, gap: 10 },
    sections: [
      { x: 54, y: 430, w: 430, h: 394 },
      { x: 506, y: 430, w: 540, h: 394 },
      { x: 1068, y: 430, w: 476, h: 394 },
    ],
  };
}

async function loadStatsBackground(game) {
  const backgroundPath = BACKGROUND_PATHS[game] || BACKGROUND_PATHS.valorant;
  return imageFileToDataUri(backgroundPath, {
    width: WIDTH,
    height: HEIGHT,
    fit: 'cover',
    withoutEnlargement: false,
  });
}

function backgroundMarkup(theme, background) {
  if (!background) return `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>`;

  return `
  <image data-role="stats-background" href="${background}" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" preserveAspectRatio="xMidYMid slice"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#02070c" fill-opacity="0.34"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" opacity="0.18"/>`;
}

function redesignedHeader(theme, updatedAt, box) {
  return `
  <g class="font" data-region="card-header">
    <path d="M${box.x} ${box.y + 16} H${box.x + 430} L${box.x + 456} ${box.y + 46} H${box.x + 742}" fill="none" stroke="${theme.primary}" stroke-opacity="0.58" stroke-width="2"/>
    <path d="M${box.x + box.w - 324} ${box.y + 18} H${box.x + box.w - 16} L${box.x + box.w - 54} ${box.y + 96} H${box.x + box.w - 360} Z" fill="url(#metricPanel)" stroke="${theme.primary}" stroke-width="2.4" stroke-opacity="0.9"/>
    <path d="M${box.x + 96} ${box.y + 82} H${box.x + 468} L${box.x + 490} ${box.y + 104} H${box.x + 108} L${box.x + 82} ${box.y + 82} Z" fill="${theme.primary}" fill-opacity="0.12" stroke="${theme.primary}" stroke-opacity="0.62" stroke-width="1.5"/>
    ${icon('crown', box.x + 24, box.y + 22, 72, theme.accent)}
    <text x="${box.x + 126}" y="${box.y + 66}" class="title">皇家戰報</text>
    <rect x="${box.x + 414}" y="${box.y + 24}" width="6" height="62" fill="${theme.primary}" opacity="0.92"/>
    <text x="${box.x + 452}" y="${box.y + 66}" class="game">${escapeXml(theme.name)}</text>
    <circle cx="${box.x + 118}" cy="${box.y + 93}" r="7" fill="${theme.primary}"/>
    <text x="${box.x + 150}" y="${box.y + 101}" class="small" fill="#f3f5f7">${escapeXml(theme.subtitle)}</text>
    ${icon('calendar', box.x + box.w - 326, box.y + 44, 30, '#f8fbff')}
    <text x="${box.x + box.w - 48}" y="${box.y + 48}" text-anchor="end" class="small" fill="${theme.primary}">更新時間</text>
    <text x="${box.x + box.w - 48}" y="${box.y + 82}" text-anchor="end" font-weight="850" font-size="27" fill="#f8fbff">${escapeXml(updatedAt)}</text>
  </g>`;
}

function redesignedPlayerBlock(theme, stats, isValorant, avatarDataUri, box) {
  const playerId = value(stats.playerId);
  const rank = value(stats.rank);
  const sub = isValorant
    ? `最高段位 ${value(stats.peakRank)} · ${value(stats.server)}`
    : `${value(stats.region)} · 彈性 ${value(stats.flex?.rank)}`;
  const initials = initialsFor(playerId);
  const avatarCx = box.x + 88;
  const avatarCy = box.y + 104;
  const avatarSize = 132;
  const avatarX = avatarCx - avatarSize / 2;
  const avatarY = avatarCy - avatarSize / 2;
  const avatarClipId = `identityAvatarClip-${normalizeKey(theme.name)}`;
  const avatar = avatarDataUri
    ? `<image href="${avatarDataUri}" x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${avatarClipId})"/>`
    : `<text x="${avatarCx}" y="${avatarCy + 22}" text-anchor="middle" font-family="${FONT_ATTR}" font-weight="900" font-size="50" fill="${theme.accent}">${escapeXml(initials)}</text>`;

  return `
  <g class="font" data-region="identity-card">
    <clipPath id="${avatarClipId}"><circle cx="${avatarCx}" cy="${avatarCy}" r="66"/></clipPath>
    <path d="M${box.x} ${box.y + 16} H${box.x + box.w - 22} L${box.x + box.w} ${box.y + 38} V${box.y + box.h - 16} L${box.x + box.w - 22} ${box.y + box.h} H${box.x + 22} L${box.x} ${box.y + box.h - 22} Z" fill="url(#glassPanel)" stroke="${theme.primary}" stroke-opacity="0.78" stroke-width="2"/>
    <path d="M${box.x + 18} ${box.y + 32} H${box.x + box.w - 48}" stroke="${theme.secondary}" stroke-opacity="0.38" stroke-width="1.6"/>
    <circle cx="${avatarCx}" cy="${avatarCy}" r="78" fill="#02070c" fill-opacity="0.72" stroke="${theme.primary}" stroke-width="4"/>
    <circle cx="${avatarCx}" cy="${avatarCy}" r="66" fill="${theme.panel2}" stroke="${theme.secondary}" stroke-width="3" stroke-dasharray="112 34"/>
    ${avatar}
    <text x="${box.x + 184}" y="${box.y + 76}" font-weight="900" font-size="${playerFontSize(playerId)}" fill="#fff">${escapeXml(fitText(playerId, 330, playerFontSize(playerId)))}</text>
    <g transform="translate(${box.x + 184} ${box.y + 108})">
      ${icon(isValorant ? 'rank' : 'shield', 0, 0, 58, theme.accent)}
      <text x="76" y="37" font-weight="900" font-size="38" fill="${theme.accent}">${escapeXml(fitText(rank, 270, 38))}</text>
      <text x="76" y="72" class="small">${escapeXml(fitText(sub, 306, 21))}</text>
    </g>
  </g>`;
}

function redesignedCoreCardsMarkup(theme, cards, box) {
  const gap = box.gap || 10;
  const cardWidth = Math.floor((box.w - gap * (cards.length - 1)) / cards.length);
  return `
  <g class="font" data-region="metric-dock">
    <path d="M${box.x} ${box.y + 16} H${box.x + box.w - 24} L${box.x + box.w} ${box.y + 42} V${box.y + box.h - 16} L${box.x + box.w - 24} ${box.y + box.h} H${box.x + 24} L${box.x} ${box.y + box.h - 24} Z" fill="#02070c" fill-opacity="0.3" stroke="${theme.secondary}" stroke-opacity="0.22" stroke-width="1"/>
    ${cards.map((card, index) => redesignedMetricCard(theme, card, box.x + index * (cardWidth + gap), box.y, cardWidth, box.h)).join('')}
  </g>`;
}

function redesignedMetricCard(theme, card, x, y, width, height) {
  const fontSize = metricFontSize(card.value);
  const color = card.color || theme.secondary;
  return `
    <g data-card="${escapeXml(card.key)}">
      <path d="M${x} ${y + 24} H${x + width - 14} L${x + width} ${y + 40} V${y + height - 18} L${x + width - 18} ${y + height} H${x + 16} L${x} ${y + height - 18} Z" fill="url(#metricPanel)" stroke="${theme.line}" stroke-opacity="0.82" stroke-width="1.6"/>
      <path d="M${x + 12} ${y + 34} H${x + width - 26}" stroke="${color}" stroke-opacity="0.62" stroke-width="2"/>
      ${icon(card.icon, x + width / 2 - 20, y + 54, 40, color)}
      <text x="${x + width / 2}" y="${y + 126}" text-anchor="middle" class="body" font-size="25">${escapeXml(card.label)}</text>
      <text x="${x + width / 2}" y="${y + 184}" text-anchor="middle" font-weight="950" font-size="${fontSize}" fill="${color}">${escapeXml(metricText(card.value, fontSize))}</text>
    </g>`;
}

function redesignedSectionsMarkup(theme, sections, positions) {
  return `
  <g class="font" data-region="detail-sections">
    ${sections.map((section, index) => redesignedSectionPanel(theme, section, positions[index])).join('')}
  </g>`;
}

function redesignedSectionPanel(theme, section, box) {
  const rows = section.rows.length
    ? section.rows.map((row, rowIndex) => redesignedSectionRow(theme, row, box, rowIndex)).join('')
    : redesignedEmptySection(theme, box, section.emptyText || '暫無資料');
  return `
    <g data-panel="stats-section">
      <path d="M${box.x} ${box.y + 18} H${box.x + box.w - 20} L${box.x + box.w} ${box.y + 38} V${box.y + box.h - 22} L${box.x + box.w - 22} ${box.y + box.h} H${box.x + 20} L${box.x} ${box.y + box.h - 22} Z" fill="url(#glassPanel)" stroke="${theme.primary}" stroke-opacity="0.82" stroke-width="2"/>
      <path d="M${box.x + 12} ${box.y + 30} H${box.x + box.w - 44}" stroke="${theme.secondary}" stroke-opacity="0.24" stroke-width="1.4"/>
      <rect x="${box.x + 16}" y="${box.y + 28}" width="${box.w - 32}" height="48" fill="${theme.primary}" fill-opacity="0.16"/>
      ${icon(section.icon, box.x + 28, box.y + 40, 27, theme.primary)}
      <text x="${box.x + box.w / 2}" y="${box.y + 63}" text-anchor="middle" class="panelTitle">${escapeXml(section.title)}</text>
      ${rows}
    </g>`;
}

function redesignedSectionRow(theme, row, box, index) {
  const y = box.y + 112 + index * 76;
  const thumbX = box.x + 30;
  const thumbY = y - 27;
  const thumbWidth = row.imageWide ? 92 : 52;
  const thumbHeight = 52;
  const nameX = thumbX + thumbWidth + 18;
  const valueX = box.x + box.w - 28;
  const valueFont = row.value.length > 6 ? 22 : 27;
  const valueWidth = Math.min(140, Math.max(66, estimateTextWidth(row.value, valueFont) + 16));
  const metaX = valueX - valueWidth;
  const barX = Math.max(nameX + 110, box.x + box.w - 232);
  const barWidth = Math.max(116, box.x + box.w - barX - 62);
  const nameWidth = Math.max(78, metaX - nameX - 14);
  const filled = Math.max(10, Math.round(barWidth * row.ratio));
  const imageWidth = row.imageWide ? 88 : 44;
  const imageHeight = row.imageWide ? 40 : 44;
  const imageX = thumbX + (thumbWidth - imageWidth) / 2;
  const imageY = thumbY + (thumbHeight - imageHeight) / 2;
  const iconX = thumbX + (thumbWidth - 30) / 2;
  const iconY = thumbY + (thumbHeight - 30) / 2;
  const imageFit = row.imageFit || 'slice';
  const color = row.color || theme.secondary;
  const thumb = row.image
    ? `<image href="${row.image}" x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="xMidYMid ${imageFit}"/>`
    : icon(row.icon, iconX, iconY, 30, color);

  return `
      <g data-image-layout="${row.imageWide ? 'wide' : 'square'}">
        <line x1="${box.x + 22}" y1="${y - 34}" x2="${box.x + box.w - 22}" y2="${y - 34}" stroke="${theme.line}" stroke-opacity="0.66" stroke-width="1"/>
        <rect x="${thumbX}" y="${thumbY}" width="${thumbWidth}" height="${thumbHeight}" rx="7" fill="#02070c" fill-opacity="0.54" stroke="${theme.line}" stroke-opacity="0.82" stroke-width="1"/>
        ${thumb}
        <text x="${nameX}" y="${y + 2}" font-weight="900" font-size="28" fill="#f8fbff">${escapeXml(fitText(row.name, nameWidth, 28))}</text>
        <text x="${metaX}" y="${y - 8}" text-anchor="end" font-weight="700" font-size="20" fill="${theme.muted}">${escapeXml(fitText(row.meta, Math.max(70, metaX - barX + 74), 20))}</text>
        <text x="${valueX}" y="${y}" text-anchor="end" font-weight="950" font-size="${valueFont}" fill="${color}">${escapeXml(fitText(row.value, valueWidth, valueFont))}</text>
        <rect x="${barX}" y="${y + 20}" width="${barWidth}" height="8" fill="#24313c" fill-opacity="0.88"/>
        <rect x="${barX}" y="${y + 20}" width="${filled}" height="8" fill="${color}"/>
      </g>`;
}

function redesignedEmptySection(theme, box, text) {
  return `
      <g opacity="0.72">
        ${icon('spark', box.x + 48, box.y + 126, 34, theme.secondary)}
        <text x="${box.x + 96}" y="${box.y + 151}" class="body" font-size="25">${escapeXml(text)}</text>
      </g>`;
}

function header(theme, updatedAt) {
  return `
  <g class="font">
    ${icon('crown', 68, 58, 88, theme.accent)}
    <text x="178" y="102" class="title">皇家戰報</text>
    <rect x="470" y="54" width="6" height="68" fill="${theme.primary}"/>
    <text x="508" y="102" class="game">${escapeXml(theme.name)}</text>
    <path d="M206 132 H548 L568 156 L548 180 H206 L186 156 Z" fill="${theme.primary}" fill-opacity="0.14" stroke="${theme.primary}" stroke-width="2"/>
    <circle cx="228" cy="156" r="8" fill="${theme.primary}"/>
    <text x="262" y="165" class="small" fill="#f3f5f7">${escapeXml(theme.subtitle)}</text>
    <path d="M1276 62 H1570 L1532 148 H1238 Z" fill="${theme.panel}" stroke="${theme.primary}" stroke-width="3"/>
    ${icon('calendar', 1264, 84, 32, '#f8fbff')}
    <text x="1538" y="88" text-anchor="end" class="small" fill="${theme.primary}">更新時間</text>
    <text x="1538" y="122" text-anchor="end" font-weight="800" font-size="26" fill="#f8fbff">${escapeXml(updatedAt)}</text>
  </g>`;
}

function playerBlock(theme, stats, isValorant, avatarDataUri) {
  const playerId = value(stats.playerId);
  const rank = value(stats.rank);
  const sub = isValorant
    ? `最高段位 ${value(stats.peakRank)} · ${value(stats.server)}`
    : `${value(stats.region)} · 彈性 ${value(stats.flex?.rank)}`;
  const initials = initialsFor(playerId);
  const avatar = avatarDataUri
    ? `<image href="${avatarDataUri}" x="65" y="237" width="138" height="138" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>`
    : `<text x="134" y="326" text-anchor="middle" font-family="${FONT_ATTR}" font-weight="900" font-size="54" fill="${theme.accent}">${escapeXml(initials)}</text>`;

  return `
  <g class="font">
    <circle cx="134" cy="306" r="83" fill="${theme.primary}" fill-opacity="0.18" stroke="${theme.primary}" stroke-width="5"/>
    <circle cx="134" cy="306" r="69" fill="${theme.panel2}" stroke="${theme.secondary}" stroke-width="4" stroke-dasharray="95 28"/>
    ${avatar}
    <line x1="246" y1="220" x2="246" y2="390" stroke="${theme.line}" stroke-width="3"/>
    <text x="278" y="270" font-weight="900" font-size="${playerFontSize(playerId)}" fill="#fff">${escapeXml(fitText(playerId, 320, playerFontSize(playerId)))}</text>
    <g transform="translate(278 304)">
      ${icon(isValorant ? 'rank' : 'shield', 0, 0, 62, theme.accent)}
      <text x="82" y="38" font-weight="900" font-size="39" fill="${theme.accent}">${escapeXml(fitText(rank, 240, 39))}</text>
      <text x="82" y="72" class="small">${escapeXml(fitText(sub, 250, 21))}</text>
    </g>
  </g>`;
}

function coreCardsMarkup(theme, cards) {
  const cardWidth = 136;
  const gap = 10;
  const startX = 650;
  return cards.map((card, index) => {
    const x = startX + index * (cardWidth + gap);
    const fontSize = metricFontSize(card.value);
    return `
  <g class="font" data-card="${escapeXml(card.key)}">
    <path d="M${x} 214 H${x + cardWidth - 10} L${x + cardWidth} 226 V386 L${x + cardWidth - 13} 398 H${x + 10} L${x} 386 Z" fill="url(#panel)" stroke="${theme.line}" stroke-width="2"/>
    <path d="M${x + 6} 222 H${x + cardWidth - 16}" stroke="${theme.primary}" stroke-opacity="0.45" stroke-width="2"/>
    ${icon(card.icon, x + 46, 238, 46, card.color || theme.secondary)}
    <text x="${x + cardWidth / 2}" y="312" text-anchor="middle" class="body">${escapeXml(card.label)}</text>
    <text x="${x + cardWidth / 2}" y="372" text-anchor="middle" font-weight="900" font-size="${fontSize}" fill="${card.color || theme.secondary}">${escapeXml(metricText(card.value, fontSize))}</text>
  </g>`;
  }).join('');
}

function sectionsMarkup(theme, sections) {
  const positions = [
    { x: 38, y: 430, w: 425 },
    { x: 482, y: 430, w: 550 },
    { x: 1050, y: 430, w: 512 },
  ];
  return sections.map((section, index) => sectionPanel(theme, section, positions[index])).join('');
}

function sectionPanel(theme, section, box) {
  const rows = section.rows.length
    ? section.rows.map((row, rowIndex) => sectionRow(theme, row, box, rowIndex)).join('')
    : emptySection(theme, box, section.emptyText || '網站未呈報');
  return `
  <g class="font">
    <path d="M${box.x} ${box.y} H${box.x + box.w - 12} L${box.x + box.w} ${box.y + 12} V802 L${box.x + box.w - 16} 824 H${box.x + 16} L${box.x} 802 Z" fill="${theme.panel}" fill-opacity="0.9" stroke="${theme.primary}" stroke-width="2"/>
    <path d="M${box.x} ${box.y} H${box.x + box.w} V474 H${box.x} Z" fill="${theme.primary}" fill-opacity="0.22"/>
    <text x="${box.x + box.w / 2}" y="${box.y + 33}" text-anchor="middle" class="panelTitle">${escapeXml(section.title)}</text>
    ${icon(section.icon, box.x + 24, box.y + 12, 28, theme.primary)}
    ${rows}
  </g>`;
}

function sectionRow(theme, row, box, index) {
  const y = box.y + 82 + index * 82;
  const imageX = box.x + 28;
  const thumbWidth = row.imageWide ? 98 : 54;
  const thumbHeight = 54;
  const nameX = imageX + thumbWidth + 20;
  const valueX = box.x + box.w - 28;
  const valueFont = row.value.length > 6 ? 23 : 28;
  const valueWidth = Math.min(142, Math.max(64, estimateTextWidth(row.value, valueFont) + 16));
  const metaX = valueX - valueWidth;
  const barX = box.x + box.w - 232;
  const barWidth = 170;
  const nameWidth = Math.max(80, metaX - nameX - 14);
  const filled = Math.max(10, Math.round(barWidth * row.ratio));
  const imageWidth = row.imageWide ? 90 : 46;
  const imageHeight = row.imageWide ? 42 : 46;
  const imageOffsetX = row.imageWide ? 0 : 4;
  const imageOffsetY = row.imageWide ? -19 : -24;
  const imageFit = row.imageFit || 'slice';
  const thumb = row.image
    ? `<image href="${row.image}" x="${imageX + imageOffsetX}" y="${y + imageOffsetY}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="xMidYMid ${imageFit}"/>`
    : icon(row.icon, imageX + (thumbWidth - 30) / 2, y - 16, 30, row.color || theme.secondary);

  return `
    <g data-image-layout="${row.imageWide ? 'wide' : 'square'}">
      <line x1="${box.x + 18}" y1="${y - 36}" x2="${box.x + box.w - 18}" y2="${y - 36}" stroke="${theme.line}" stroke-width="1"/>
      <rect x="${imageX - 4}" y="${y - 28}" width="${thumbWidth}" height="${thumbHeight}" rx="8" fill="#071016" stroke="${theme.line}" stroke-width="1"/>
      ${thumb}
      <text x="${nameX}" y="${y + 3}" font-weight="900" font-size="28" fill="#f5f8fb">${escapeXml(fitText(row.name, nameWidth, 28))}</text>
      <text x="${metaX}" y="${y - 7}" text-anchor="end" font-weight="700" font-size="20" fill="${theme.muted}">${escapeXml(fitText(row.meta, Math.max(70, metaX - barX + 74), 20))}</text>
      <text x="${valueX}" y="${y}" text-anchor="end" font-weight="900" font-size="${valueFont}" fill="${row.color || theme.secondary}">${escapeXml(fitText(row.value, valueWidth, valueFont))}</text>
      <rect x="${barX}" y="${y + 20}" width="${barWidth}" height="8" fill="#26323c"/>
      <rect x="${barX}" y="${y + 20}" width="${filled}" height="8" fill="${row.color || theme.secondary}"/>
    </g>`;
}

function emptySection(theme, box, text) {
  return `
    <g opacity="0.72">
      ${icon('spark', box.x + 44, box.y + 116, 34, theme.secondary)}
      <text x="${box.x + 92}" y="${box.y + 140}" class="body" font-size="26">${escapeXml(text)}</text>
    </g>`;
}

function footerMarkup(theme, footer) {
  return `
  <g class="font">
    <line x1="130" y1="852" x2="1470" y2="852" stroke="${theme.primary}" stroke-opacity="0.65" stroke-width="2"/>
    ${icon('crown', 580, 836, 38, theme.accent)}
    <text x="812" y="868" text-anchor="middle" class="small" fill="#d7e2ea">${escapeXml(trimText(footer, 58))}</text>
  </g>`;
}

function backgroundTexture(theme, isValorant) {
  const texture = isValorant
    ? '<path d="M1040 74 L1220 74 L1220 170 L1160 204 L1040 156 Z" fill="none" stroke="' + theme.primary + '" stroke-opacity="0.35" stroke-width="2"/>'
    : '<circle cx="1150" cy="145" r="95" fill="' + theme.primary + '" fill-opacity="0.08"/><circle cx="1150" cy="145" r="55" fill="none" stroke="' + theme.secondary + '" stroke-opacity="0.35" stroke-width="2"/>';
  return `
  <g opacity="0.22">
    <circle cx="1280" cy="120" r="190" fill="${theme.glow}" filter="url(#softGlow)"/>
    <path d="M1080 -20 L1560 460" stroke="${theme.line}" stroke-width="2" stroke-opacity="0.22"/>
    <path d="M1120 -20 L1600 460" stroke="${theme.line}" stroke-width="2" stroke-opacity="0.16"/>
    <path d="M70 830 L350 520" stroke="${theme.line}" stroke-width="2" stroke-opacity="0.16"/>
    ${texture}
  </g>`;
}

function valorantCoreCards(stats) {
  return [
    { key: 'kd', icon: 'crosshair', label: 'KD', value: value(stats.kd), color: '#ff4655' },
    { key: 'kda', icon: 'trend', label: 'KDA', value: value(stats.kad), color: '#66f0ef' },
    { key: 'winrate', icon: 'trophy', label: '勝率', value: value(stats.winRate), color: '#ffd166' },
    { key: 'acs', icon: 'spark', label: 'ACS', value: value(stats.acs), color: '#66f0ef' },
    { key: 'hs', icon: 'target', label: 'HS', value: value(stats.headshot), color: '#ff4655' },
    { key: 'adr', icon: 'arrow', label: 'ADR', value: value(stats.adr), color: '#66f0ef' },
  ];
}

function lolCoreCards(stats) {
  return [
    { key: 'rank', icon: 'crown', label: '牌位', value: value(stats.rank), color: '#c89b3c' },
    { key: 'lp', icon: 'shield', label: 'LP', value: stats.lp ? `${stats.lp}` : '未呈報', color: '#f0d98c' },
    { key: 'winrate', icon: 'trophy', label: '勝率', value: value(stats.winRate), color: '#0ac8b9' },
    { key: 'games', icon: 'scroll', label: '場數', value: stats.seasonGames ? `${stats.seasonGames}` : '未呈報', color: '#f0d98c' },
    { key: 'kda', icon: 'swords', label: 'KDA', value: value(stats.kda), color: '#0ac8b9' },
    { key: 'avg', icon: 'crystal', label: '平均', value: compactKda(stats.averageKda), color: '#c89b3c' },
  ];
}

function valorantSections(stats, assets) {
  return [
    {
      title: '常用特務',
      icon: 'agent',
      rows: assetRows(stats.topAgents, assets.agents, (agent) => ({
        icon: 'agent',
        name: agent.name,
        meta: `${value(agent.games)} 場`,
        value: value(agent.winRate),
        ratio: percentRatio(agent.winRate),
      }), assets.labels?.agents),
    },
    {
      title: '武器表現',
      icon: 'weapon',
      rows: assetRows(stats.weapons, assets.weapons, (weapon) => ({
        icon: 'weapon',
        name: weapon.name,
        meta: `${value(weapon.kills)} 擊殺`,
        value: value(weapon.headshot),
        ratio: percentRatio(weapon.headshot),
        imageWide: true,
        imageFit: 'meet',
      }), assets.labels?.weapons),
    },
    {
      title: '地圖勝率',
      icon: 'map',
      rows: assetRows(stats.maps?.length ? stats.maps : stats.recentHighlights, assets.maps, (map) => ({
        icon: 'map',
        name: map.name || map.map,
        meta: trimText(map.record || map.score || '近期', 10),
        value: value(map.winRate || map.kda),
        ratio: percentRatio(map.winRate),
      }), assets.labels?.maps),
    },
  ];
}

function lolSections(stats, assets) {
  const wins = Number(stats.wins) || 0;
  const losses = Number(stats.losses) || 0;
  return [
    {
      title: '常用英雄',
      icon: 'champion',
      rows: assetRows(stats.topChampions, assets.champions, (champion) => ({
        icon: 'champion',
        name: champion.name,
        meta: `${value(champion.wins)}勝 ${value(champion.losses)}敗`,
        value: value(champion.winRate),
        ratio: percentRatio(champion.winRate),
      }), assets.labels?.champions),
    },
    {
      title: '單雙 / 彈性牌位',
      icon: 'rank',
      rows: [
        rankRow('單雙積分', stats.rank, stats.lp, stats.winRate),
        rankRow('彈性積分', stats.flex?.rank, stats.flex?.lp, stats.flex?.winRate),
        rankRow('區服', stats.region, null, stats.winRate),
      ],
    },
    {
      title: '賽季摘要',
      icon: 'scroll',
      rows: [
        { icon: 'trophy', name: '勝場', meta: 'Ranked', value: String(wins || '未呈報'), ratio: ratioFromRecord(wins, losses), color: '#0ac8b9' },
        { icon: 'target', name: '敗場', meta: 'Ranked', value: String(losses || '未呈報'), ratio: ratioFromRecord(losses, wins), color: '#c89b3c' },
        { icon: 'swords', name: '平均 KDA', meta: value(stats.kda), value: compactKda(stats.averageKda), ratio: 0.72, color: '#f0d98c', nameLimit: 10 },
      ],
    },
  ];
}

function rankRow(name, rank, lp, winRate) {
  return {
    icon: 'shield',
    name,
    meta: lp ? `${lp} LP` : '公開資料',
    value: trimText(rank || '未呈報', 9),
    ratio: percentRatio(winRate),
    color: '#f0d98c',
  };
}

function assetRows(items = [], assetMap = new Map(), mapper, labelMap = new Map()) {
  return items.slice(0, 4).map((item) => {
    const row = mapper(item);
    return {
      ...row,
      name: localizedNameFor(item, labelMap) || row.name,
      image: item.imageDataUri || indexedItemValue(assetMap, item),
    };
  });
}

async function attachRowAssets(items = [], target, index, fetchImpl, imageOptions = {}) {
  await Promise.all(items.slice(0, 4).map(async (item) => {
    const key = assetKey(item);
    const url = item.imageUrl || indexedItemValue(index, item);
    const dataUri = await dataUriFromUrl(url, fetchImpl, imageOptions);
    if (dataUri) target.set(key, dataUri);
  }));
}

async function valorantAssetIndex(type, fetchImpl) {
  const baseQuery = type === 'agents' ? '?isPlayableCharacter=true' : '';
  const localizedQuery = type === 'agents'
    ? `?isPlayableCharacter=true&language=${VALORANT_LOCALE}`
    : `?language=${VALORANT_LOCALE}`;
  const [payload, localizedPayload] = await Promise.all([
    jsonFromUrl(`${VALORANT_API}/${type}${baseQuery}`, fetchImpl),
    jsonFromUrl(`${VALORANT_API}/${type}${localizedQuery}`, fetchImpl),
  ]);
  const localizedNames = new Map((localizedPayload?.data || []).map((item) => [item.uuid, item.displayName]));
  const index = emptyAssetIndex();
  for (const item of payload?.data || []) {
    const imageUrl = type === 'maps'
      ? item.splash || item.displayIcon || item.listViewIcon
      : item.displayIcon || item.killStreamIcon || item.fullPortrait;
    const label = localizedNames.get(item.uuid);
    setAssetIndexValue(index.images, [item.displayName, item.uuid], imageUrl);
    setAssetIndexValue(index.labels, [item.displayName, item.uuid], label);
  }
  return index;
}

async function lolChampionIndex(fetchImpl) {
  const versions = await jsonFromUrl(`${RIOT_CDN}/api/versions.json`, fetchImpl);
  const version = Array.isArray(versions) ? versions[0] : null;
  const index = emptyAssetIndex();
  if (!version) return index;
  const [payload, localizedPayload] = await Promise.all([
    jsonFromUrl(`${RIOT_CDN}/cdn/${version}/data/${LOL_DEFAULT_LOCALE}/champion.json`, fetchImpl),
    jsonFromUrl(`${RIOT_CDN}/cdn/${version}/data/${LOL_LOCALE}/champion.json`, fetchImpl),
  ]);
  for (const champion of Object.values(payload?.data || {})) {
    const image = champion.image?.full;
    if (!image) continue;
    const url = `${RIOT_CDN}/cdn/${version}/img/champion/${image}`;
    const label = localizedPayload?.data?.[champion.id]?.name;
    setAssetIndexValue(index.images, [champion.name, champion.id], url);
    setAssetIndexValue(index.labels, [champion.name, champion.id], label);
  }
  return index;
}

function emptyAssetIndex() {
  return { images: new Map(), labels: new Map() };
}

function setAssetIndexValue(index, keys, value) {
  if (!value) return;
  for (const key of keys) {
    const normalized = normalizeKey(key);
    if (normalized) index.set(normalized, value);
  }
}

function indexedItemValue(index, item) {
  for (const key of itemKeys(item)) {
    const value = index.get(normalizeKey(key));
    if (value) return value;
  }
  return null;
}

function localizedNameFor(item, labels) {
  return indexedItemValue(labels, item);
}

async function jsonFromUrl(url, fetchImpl) {
  if (!url) return null;
  const cacheKey = cacheKeyFor(fetchImpl, url);
  if (!jsonCache.has(cacheKey)) {
    jsonCache.set(cacheKey, fetchWithTimeout(url, fetchImpl, IMAGE_TIMEOUT_MS)
      .then((response) => response?.ok ? response.json() : null)
      .catch(() => null));
  }
  return jsonCache.get(cacheKey);
}

async function dataUriFromUrl(url, fetchImpl, imageOptions = {}) {
  return imageUrlToDataUri(url, fetchImpl, {
    ...imageOptions,
    cache: imageCache,
    timeoutMs: IMAGE_TIMEOUT_MS,
  });
}

function icon(name, x, y, size, color) {
  const stroke = color || '#fff';
  const paths = {
    crosshair: '<circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
    trend: '<path d="M3 18h18"/><path d="M5 15l5-5 4 4 6-8"/><path d="M15 6h5v5"/>',
    trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a4 4 0 0 0 3 4M17 6h3v2a4 4 0 0 1-3 4"/><path d="M12 14v4M8 20h8"/>',
    spark: '<path d="M12 2l2.6 6.8L22 12l-7.4 3.2L12 22l-2.6-6.8L2 12l7.4-3.2z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
    arrow: '<path d="M4 17L17 4"/><path d="M9 4h8v8"/><path d="M4 21l4-1 11-11-3-3L5 17z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    crown: '<path d="M3 18h18l-2-11-5 5-2-7-2 7-5-5z"/><path d="M5 21h14"/>',
    rank: '<path d="M12 2l8 5v10l-8 5-8-5V7z"/><path d="M12 6l4 3v6l-4 3-4-3V9z"/>',
    shield: '<path d="M12 2l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z"/>',
    scroll: '<path d="M7 4h11a3 3 0 0 1 0 6H7a3 3 0 0 0 0-6z"/><path d="M7 4v16h10"/><path d="M9 12h7M9 16h5"/>',
    swords: '<path d="M4 20L20 4M14 4h6v6M20 20L4 4M4 10V4h6"/>',
    crystal: '<path d="M12 2l7 7-7 13L5 9z"/><path d="M5 9h14M12 2v20"/>',
    agent: '<circle cx="12" cy="7" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/><path d="M8 14l4 3 4-3"/>',
    weapon: '<path d="M3 11h13l5 3-5 3H3z"/><path d="M8 17l-2 4M13 17v4"/>',
    map: '<path d="M4 5l5-2 6 2 5-2v16l-5 2-6-2-5 2z"/><path d="M9 3v16M15 5v16"/>',
    champion: '<path d="M12 3l3 6 6 1-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 10l6-1z"/>',
  };
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" data-icon="${name}" fill="none" stroke="${stroke}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.spark}</svg>`;
}

function value(content) {
  return content ? String(content) : '未呈報';
}

function metricText(content, fontSize = 34) {
  const text = value(content);
  return fitText(text, 116, fontSize);
}

function metricFontSize(content) {
  const text = value(content);
  for (const size of [46, 42, 38, 34, 30, 27, 24]) {
    if (estimateTextWidth(text, size) <= 116) return size;
  }
  return 24;
}

function playerFontSize(playerId) {
  const width = visualWidth(value(playerId));
  if (width > 15) return 34;
  if (width > 12) return 39;
  return 44;
}

function formatUpdatedAt(content) {
  if (!content) return '未呈報';
  const text = String(content);
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) {
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  const normalized = text.replace('T', ' ').replace(/\.\d+Z?$/, '').replace(/Z$/, '');
  return trimText(normalized, 19);
}

function trimText(text, maxLength) {
  const content = value(text);
  return content.length <= maxLength ? content : `${content.slice(0, maxLength - 1)}…`;
}

function fitText(text, maxPx, fontSize) {
  const content = value(text);
  if (estimateTextWidth(content, fontSize) <= maxPx) return content;
  let output = '';
  for (const char of content) {
    const candidate = `${output}${char}…`;
    if (estimateTextWidth(candidate, fontSize) > maxPx) break;
    output += char;
  }
  return output ? `${output}…` : '…';
}

function estimateTextWidth(text, fontSize) {
  return visualWidth(value(text)) * fontSize * 0.56;
}

function visualWidth(text) {
  return [...value(text)].reduce((sum, char) => sum + (/[\u1100-\u11ff\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(char) ? 1.9 : 1), 0);
}

function compactKda(text) {
  return value(text).replace(/\s*\/\s*/g, '/');
}

function initialsFor(playerId) {
  return value(playerId)
    .replace(/#.*$/, '')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'RK';
}

function percentRatio(valueText) {
  const match = String(valueText || '').match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0.18;
  return Math.max(0.08, Math.min(1, Number(match[1]) / 100));
}

function ratioFromRecord(a, b) {
  const total = Number(a) + Number(b);
  if (!total) return 0.18;
  return Math.max(0.08, Math.min(1, Number(a) / total));
}

function assetKey(item = {}) {
  return normalizeKey(item.id || item.name || item.map || '');
}

function itemKeys(item = {}) {
  return [item.id, item.name, item.map, item.agent].filter(Boolean);
}

function normalizeKey(content) {
  return String(content || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

import { compactText, readableDocument, readableLines, fetchPublicHtml } from './common.js';

const OPGG_SOURCE = 'OP.GG';
const OPGG_BASE = 'https://op.gg';
const VALOCHECK_SOURCE = 'ValoCheck';
const VALOCHECK_BASE = 'https://www.valocheck.com';
const REQUEST_TIMEOUT_MS = 10000;

export function buildValorantProfileUrl(playerName, tag) {
  return `${OPGG_BASE}/valorant/profile/${encodeURIComponent(playerName.trim())}-${encodeURIComponent(tag.trim())}`;
}

export function buildValocheckProfileUrl(playerName, tag) {
  return `${VALOCHECK_BASE}/player/${encodeURIComponent(playerName.trim())}/${encodeURIComponent(tag.trim())}/?mode=all`;
}

export async function fetchValorantStats(playerName, tag, fetchImpl = fetch) {
  const sourceUrl = buildValorantProfileUrl(playerName, tag);
  const opgg = await fetchOpggStats(sourceUrl, playerName, tag, fetchImpl);

  if (opgg.status === 'ok') {
    return {
      game: 'valorant',
      status: 'ok',
      source: OPGG_SOURCE,
      sourceUrl,
      mode: 'All Modes',
      isFallback: false,
      stats: opgg.stats,
    };
  }

  const fallbackUrl = buildValocheckProfileUrl(playerName, tag);
  const fallbackPage = await fetchPublicHtml(fallbackUrl, fetchImpl);
  const fallbackStats = fallbackPage.status === 'ok'
    ? parseValocheckHtml(fallbackPage.html, playerName, tag)
    : null;

  if (fallbackStats) {
    return {
      game: 'valorant',
      status: 'ok',
      source: VALOCHECK_SOURCE,
      sourceUrl: fallbackUrl,
      mode: 'All Modes',
      isFallback: true,
      fallbackReason: opgg.status,
      stats: fallbackStats,
    };
  }

  const fallbackStatus = fallbackPage.status === 'ok'
    ? classifyValocheckFailure(fallbackPage.html)
    : fallbackPage.status;

  return {
    game: 'valorant',
    status: combineFailureStatuses(opgg.status, fallbackStatus),
    source: `${OPGG_SOURCE} / ${VALOCHECK_SOURCE}`,
    sourceUrl,
  };
}

async function fetchOpggStats(sourceUrl, playerName, tag, fetchImpl) {
  const page = await fetchPublicHtml(sourceUrl, fetchImpl);
  if (page.status !== 'ok') return page;

  const actions = await resolveOpggActions(page.html, sourceUrl, fetchImpl);
  if (!actions) return { status: 'parse_error' };

  const profileResponse = await fetchOpggAction(
    sourceUrl,
    actions.profile,
    [{ gameName: playerName.trim(), tagLine: tag.trim(), platform: 'pc' }],
    fetchImpl
  );
  if (profileResponse.status !== 'ok') return profileResponse;

  const profile = parseOpggActionPayload(profileResponse.text);
  if (!profile || profile.policy !== 'PUBLIC' || !profile.seasonId) return { status: 'not_found' };

  const statisticsResponse = await fetchOpggAction(
    sourceUrl,
    actions.statistics,
    [{
      gameName: profile.gameName,
      tagLine: profile.tagLine,
      seasonId: profile.seasonId,
      queueId: 'all',
    }],
    fetchImpl
  );
  if (statisticsResponse.status !== 'ok') return statisticsResponse;

  const statistics = parseOpggActionPayload(statisticsResponse.text);
  const stats = parseOpggValorantData(profile, statistics, page.html);
  return stats ? { status: 'ok', stats } : { status: 'parse_error' };
}

async function resolveOpggActions(html, sourceUrl, fetchImpl) {
  const scriptUrls = [...String(html).matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .map((src) => new URL(src, sourceUrl).href);
  const routeScript = scriptUrls.find((src) => /valorant\/profile/i.test(decodeURIComponent(src)));
  if (!routeScript) return null;

  const route = await fetchPublicText(routeScript, {}, fetchImpl);
  if (route.status !== 'ok') return null;

  const dependencyIds = route.text.match(/e\.O\(0,\[([^\]]+)\]/)?.[1]
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean) || [];
  const dependencies = dependencyIds
    .map((id) => scriptUrls.find((src) => src.includes(`/chunks/${id}-`)))
    .filter(Boolean);

  for (const scriptUrl of [routeScript, ...dependencies]) {
    const script = scriptUrl === routeScript ? route : await fetchPublicText(scriptUrl, {}, fetchImpl);
    if (script.status !== 'ok') continue;
    const profile = actionId(script.text, 'getPlayerProfile');
    const statistics = actionId(script.text, 'getPlayerStatistics');
    if (profile && statistics) return { profile, statistics };
  }
  return null;
}

function actionId(script, actionName) {
  const marker = script.indexOf(`"${actionName}"`);
  if (marker < 0) return null;
  const before = script.slice(Math.max(0, marker - 180), marker);
  return before.match(/createServerReference\)\("([^"]+)"/)?.[1] || null;
}

async function fetchOpggAction(url, actionIdValue, args, fetchImpl) {
  return fetchPublicText(url, {
    method: 'POST',
    headers: {
      accept: 'text/x-component',
      'content-type': 'text/plain;charset=UTF-8',
      'next-action': actionIdValue,
      origin: OPGG_BASE,
      referer: url,
    },
    body: JSON.stringify(args),
  }, fetchImpl);
}

async function fetchPublicText(url, options, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(url, {
      ...options,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; GigiKingdomBot/1.0; public stats preview)',
        'accept-language': 'en-US,en;q=0.9',
        ...options.headers,
      },
      signal: controller.signal,
    });

    if (response.status === 404) return { status: 'not_found' };
    if (response.status === 403 || response.status === 429) return { status: 'blocked' };
    if (!response.ok) return { status: 'unavailable' };
    return { status: 'ok', text: await response.text() };
  } catch (error) {
    return { status: error?.name === 'AbortError' ? 'unavailable' : 'unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}

export function parseOpggActionPayload(text) {
  const payloadLine = String(text || '').split(/\r?\n/).find((line) => line.startsWith('1:'));
  if (!payloadLine) return null;
  try {
    return JSON.parse(payloadLine.slice(2));
  } catch {
    return null;
  }
}

export function parseOpggValorantData(profile, statistics, html = '') {
  const summary = statistics?.playerStatistics;
  if (!profile || !summary || !summary.gameCount || !summary.rounds) return null;

  const labels = metadataLabels(html);
  const hitTotal = summary.headShots + summary.bodyShots + summary.legShots;
  const totalGames = summary.gameCount;
  const topAgents = topItems(statistics.playerCharacterStatistics).map((agent) => ({
    id: agent.characterId,
    name: labels.characters.get(agent.characterId) || agent.characterId.slice(0, 8),
    games: String(agent.gameCount),
    winRate: percentage(agent.wins, agent.gameCount),
    kda: ratio(agent.kills + agent.assists, agent.deaths),
    averageScore: decimal(agent.score / agent.rounds),
  }));

  return {
    playerId: `${profile.gameName}#${profile.tagLine}`,
    avatarUrl: profile.playerCardId
      ? `${OPGG_BASE.replace('op.gg', 'c-valorant-api.op.gg')}/Assets/PlayerCards/${profile.playerCardId.toUpperCase()}_small.png`
      : null,
    server: profile.region?.toUpperCase() || null,
    rank: tierName(profile.competitiveTier),
    rr: null,
    peakRank: null,
    matches: String(totalGames),
    wins: String(summary.wins),
    draws: String(summary.draws),
    losses: String(summary.defeats),
    updatedAt: profile.lastUpdatedAt || null,
    kd: ratio(summary.kills, summary.deaths),
    kad: ratio(summary.kills + summary.assists, summary.deaths),
    winRate: percentage(summary.wins, totalGames),
    acs: decimal(summary.score / summary.rounds),
    headshot: percentage(summary.headShots, hitTotal),
    adr: decimal(summary.damage / summary.rounds),
    kills: String(summary.kills),
    deaths: String(summary.deaths),
    assists: String(summary.assists),
    bodyshot: percentage(summary.bodyShots, hitTotal),
    legshot: percentage(summary.legShots, hitTotal),
    highestKills: String(summary.mostKills),
    timePlayed: formatDuration(summary.gameLengthSeconds),
    topAgent: topAgents[0]?.name || null,
    topAgents,
    weapons: topItems(statistics.playerWeaponStatistics).map((weapon) => ({
      id: weapon.weaponId,
      name: labels.weapons.get(weapon.weaponId) || weapon.weaponId.slice(0, 8),
      kills: String(weapon.kills),
      headshot: percentage(weapon.headShots, weapon.headShots + weapon.bodyShots + weapon.legShots),
    })),
    maps: topItems(statistics.playerMapStatistics).map((map) => ({
      id: map.mapId,
      name: labels.maps.get(map.mapId) || map.mapId.slice(0, 8),
      games: String(map.gameCount),
      record: `${map.wins}勝 ${map.draws}和 ${map.defeats}敗`,
      winRate: percentage(map.wins, map.gameCount),
    })),
    recentHighlights: [],
  };
}

// Kept as an exported alias so the existing fallback parser remains independently testable.
export const parseValorantHtml = parseValocheckHtml;

export function parseValocheckHtml(html, playerName = '', tag = '') {
  const $ = readableDocument(html);
  const lines = readableLines(html);
  const text = compactText(html);
  const requestedId = `${playerName}#${tag}`.toLowerCase();
  const idIndex = lines.findIndex((line) => line.toLowerCase() === requestedId);
  const playerId = idIndex >= 0
    ? lines[idIndex]
    : lines.find((line) => line.includes('#') && !line.includes('Try:'));

  const kd = lineAfter(lines, 'K/D Ratio');
  const winRate = lineAfter(lines, 'Win Rate');
  const acs = lineAfter(lines, 'ACS');
  const headshot = lineAfter(lines, 'Headshot %');
  const adr = lineAfter(lines, 'Damage / Round');
  const kad = lineAfter(lines, 'KAD Ratio');

  if (!playerId || (!kd && !winRate && !acs)) return null;

  const rrLine = lines.find((line) => /\bRR\b.*\bPeak\b/i.test(line)) || '';
  const serverLine = lines.find((line) => /Player Profile.*Server/i.test(line)) || '';
  const matchesLine = lines.find((line) => /^\d+\s+Matches$/i.test(line)) || '';
  const rank = findRank(lines, idIndex, rrLine);

  return {
    playerId,
    avatarUrl: findValocheckAvatar($, playerId),
    server: serverLine.match(/Player Profile\s*[·|]\s*(\w+)\s+Server/i)?.[1] || 'AP',
    rank,
    rr: rrLine.match(/(\d+)\s*RR/i)?.[1] || null,
    peakRank: rrLine.match(/Peak\s+(.+)$/i)?.[1] || null,
    matches: matchesLine.match(/\d+/)?.[0] || null,
    topAgent: lines.find((line) => /^Top:\s*/i.test(line))?.replace(/^Top:\s*/i, '') || null,
    updatedAt: lines.find((line) => /^Updated\s+/i.test(line))?.replace(/^Updated\s+/i, '') || null,
    kd,
    kad,
    winRate,
    acs,
    headshot,
    adr,
    kills: lines.find((line) => /^\d+K\s+\d+A$/i.test(line))?.match(/^(\d+)K/i)?.[1] || null,
    assists: lines.find((line) => /^\d+K\s+\d+A$/i.test(line))?.match(/(\d+)A$/i)?.[1] || null,
    bodyshot: text.match(/BODY\s*(\d+(?:\.\d+)?%)/i)?.[1] || null,
    legshot: text.match(/LEGS\s*(\d+(?:\.\d+)?%)/i)?.[1] || null,
    topAgents: parseTopAgents(text),
    recentHighlights: parseRecentHighlights(text),
  };
}

function metadataLabels(html) {
  const normalized = String(html).replace(/\\"/g, '"');
  return {
    characters: extractLabels(normalized, 'characterId'),
    weapons: extractLabels(normalized, 'weaponId'),
    maps: extractLabels(normalized, 'mapId'),
  };
}

function extractLabels(html, idKey) {
  const labels = new Map();
  const expression = new RegExp(
    `"${idKey}":"([^"]+)"[\\s\\S]{0,500}?"(?:localizedName|name)":"([^"]+)"`,
    'gi'
  );
  for (const match of html.matchAll(expression)) labels.set(match[1], match[2]);
  return labels;
}

function topItems(items = []) {
  return [...items].sort((left, right) => right.gameCount - left.gameCount || right.kills - left.kills).slice(0, 3);
}

function tierName(tier) {
  const tiers = {
    0: 'Unranked',
    3: 'Iron 1', 4: 'Iron 2', 5: 'Iron 3',
    6: 'Bronze 1', 7: 'Bronze 2', 8: 'Bronze 3',
    9: 'Silver 1', 10: 'Silver 2', 11: 'Silver 3',
    12: 'Gold 1', 13: 'Gold 2', 14: 'Gold 3',
    15: 'Platinum 1', 16: 'Platinum 2', 17: 'Platinum 3',
    18: 'Diamond 1', 19: 'Diamond 2', 20: 'Diamond 3',
    21: 'Ascendant 1', 22: 'Ascendant 2', 23: 'Ascendant 3',
    24: 'Immortal 1', 25: 'Immortal 2', 26: 'Immortal 3',
    27: 'Radiant',
  };
  return tiers[tier] || 'Unranked';
}

function ratio(numerator, denominator) {
  return denominator ? (numerator / denominator).toFixed(2) : '-';
}

function decimal(number) {
  return Number.isFinite(number) ? number.toFixed(1) : '-';
}

function percentage(part, whole) {
  return whole ? `${((part / whole) * 100).toFixed(1)}%` : '-';
}

function formatDuration(seconds) {
  if (!seconds) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} 小時 ${minutes} 分鐘` : `${minutes} 分鐘`;
}

function classifyValocheckFailure(html) {
  return /player not found|profile not found|no matches/i.test(html) ? 'not_found' : 'parse_error';
}

function combineFailureStatuses(opgg, valocheck) {
  if (opgg === 'blocked' || valocheck === 'blocked') return 'blocked';
  if (opgg === 'unavailable' || valocheck === 'unavailable') return 'unavailable';
  if (opgg === 'parse_error' || valocheck === 'parse_error') return 'parse_error';
  return 'not_found';
}

function findValocheckAvatar($, playerId) {
  const matchingImage = $('img').filter((_, element) =>
    ($(element).attr('alt') || '').toLowerCase() === playerId.replace(/#.*$/, '').toLowerCase()
  ).first().attr('src');
  const playerCard = $('img[src*="playercards"]').first().attr('src');
  return absoluteValocheckUrl(matchingImage || playerCard);
}

function lineAfter(lines, label) {
  const index = lines.indexOf(label);
  return index >= 0 ? lines[index + 1] || null : null;
}

function findRank(lines, idIndex, rrLine) {
  if (idIndex >= 0) {
    for (let index = Math.max(0, idIndex - 4); index < idIndex; index += 1) {
      if (/^[A-Za-z]+(?:\s+[A-Za-z]+)*\s+\d$/i.test(lines[index])) {
        return lines[index];
      }
    }
  }
  return rrLine.match(/Peak\s+(.+)$/i)?.[1] || 'Unranked';
}

function parseTopAgents(text) {
  const section = text.match(/Top Agents\s+View All\s*→?\s*(.+?)(?:VALOCHECK|$)/i)?.[1] || '';
  return [...section.matchAll(/([A-Za-z][A-Za-z ]+?)\s+(\d+)\s+GAMES\s+([\d.]+)%\s*WIN\s+([\d.]+)\s*K\/D/gi)]
    .slice(0, 3)
    .map((match) => ({
      name: match[1].trim(),
      games: match[2],
      winRate: `${match[3]}%`,
      kd: match[4],
    }));
}

function parseRecentHighlights(text) {
  const section = text.match(/Recent Highlights\s+View All Matches\s*→?\s*(.+?)(?:Top Agents|$)/i)?.[1] || '';
  return [...section.matchAll(/([A-Za-z][A-Za-z ]+?)\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+([\d—–-]+)\s+([A-Za-z][A-Za-z ]+?)\s*·\s*(\d+\/\d+\/\d+)\s+([+-]\d+)/gi)]
    .slice(0, 3)
    .map((match) => ({
      map: match[1].trim(),
      score: match[2],
      agent: match[3].trim(),
      kda: match[4],
      rrChange: match[5],
    }));
}

function absoluteValocheckUrl(url) {
  if (!url) return null;
  return url.startsWith('/') ? new URL(url, VALOCHECK_BASE).href : url;
}

import { compactText, readableDocument, readableLines, fetchPublicHtml } from './common.js';

const SOURCE_NAME = 'ValoCheck';
const SOURCE_BASE = 'https://www.valocheck.com';

export function buildValorantProfileUrl(playerName, tag) {
  return `${SOURCE_BASE}/player/${encodeURIComponent(playerName.trim())}/${encodeURIComponent(tag.trim())}/?mode=all`;
}

export async function fetchValorantStats(playerName, tag, fetchImpl = fetch) {
  const sourceUrl = buildValorantProfileUrl(playerName, tag);
  const page = await fetchPublicHtml(sourceUrl, fetchImpl);

  if (page.status !== 'ok') {
    return { game: 'valorant', status: page.status, source: SOURCE_NAME, sourceUrl };
  }

  const stats = parseValorantHtml(page.html, playerName, tag);
  if (!stats) {
    const missing = /player not found|profile not found|no matches/i.test(page.html);
    return {
      game: 'valorant',
      status: missing ? 'not_found' : 'parse_error',
      source: SOURCE_NAME,
      sourceUrl,
    };
  }

  return { game: 'valorant', status: 'ok', source: SOURCE_NAME, sourceUrl, stats };
}

export function parseValorantHtml(html, playerName = '', tag = '') {
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
    avatarUrl: findPlayerAvatar($, playerId),
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

function findPlayerAvatar($, playerId) {
  const matchingImage = $('img').filter((_, element) =>
    ($(element).attr('alt') || '').toLowerCase() === playerId.replace(/#.*$/, '').toLowerCase()
  ).first().attr('src');
  const playerCard = $('img[src*="playercards"]').first().attr('src');
  return absoluteUrl(matchingImage || playerCard);
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
  const section = text.match(/Top Agents\s+View All\s*→\s*(.+?)(?:VALOCHECK|$)/i)?.[1] || '';
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
  const section = text.match(/Recent Highlights\s+View All Matches\s*→\s*(.+?)(?:Top Agents|$)/i)?.[1] || '';
  return [...section.matchAll(/([A-Za-z][A-Za-z ]+?)\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+([\d—-]+)\s+([A-Za-z][A-Za-z ]+?)\s*·\s*(\d+\/\d+\/\d+)\s+([+-]\d+)/gi)]
    .slice(0, 3)
    .map((match) => ({
      map: match[1].trim(),
      score: match[2],
      agent: match[3].trim(),
      kda: match[4],
      rrChange: match[5],
    }));
}

function absoluteUrl(url) {
  if (!url) return null;
  return url.startsWith('/') ? new URL(url, SOURCE_BASE).href : url;
}

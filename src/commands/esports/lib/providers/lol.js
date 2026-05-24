import { compactText, fetchPublicHtml, readableDocument } from './common.js';

const SOURCE_NAME = 'OP.GG';
const SOURCE_BASE = 'https://op.gg/lol/summoners';

export function buildLolProfileUrl(region, playerName, tag, suffix = '') {
  const riotId = `${encodeURIComponent(playerName.trim())}-${encodeURIComponent(tag.trim())}`;
  return `${SOURCE_BASE}/${region}/${riotId}${suffix}`;
}

export async function fetchLolStats(playerName, tag, region = 'tw', fetchImpl = fetch) {
  const sourceUrl = buildLolProfileUrl(region, playerName, tag);
  const [summary, champions] = await Promise.all([
    fetchPublicHtml(sourceUrl, fetchImpl),
    fetchPublicHtml(buildLolProfileUrl(region, playerName, tag, '/champions'), fetchImpl),
  ]);

  if (summary.status !== 'ok') {
    return { game: 'lol', status: summary.status, source: SOURCE_NAME, sourceUrl };
  }

  const stats = parseLolHtml(summary.html, champions.status === 'ok' ? champions.html : '', region);
  if (!stats) {
    const missing = /summoner not found|player not found|not found/i.test(summary.html);
    return {
      game: 'lol',
      status: missing ? 'not_found' : 'parse_error',
      source: SOURCE_NAME,
      sourceUrl,
    };
  }

  return { game: 'lol', status: 'ok', source: SOURCE_NAME, sourceUrl, stats };
}

export function parseLolHtml(summaryHtml, championsHtml = '', region = 'tw') {
  const $ = readableDocument(summaryHtml);
  const playerId = $('h1').first().text().replace(/\s*#\s*/, '#').trim();
  const summaryText = compactText(summaryHtml);
  const championText = compactText(championsHtml);
  const ranked = parseRankedSolo(summaryText);
  const season = parseSeasonStats(championText);

  if (!playerId || (!ranked && !season)) return null;

  return {
    playerId,
    avatarUrl: findPlayerAvatar($, playerId),
    region: region.toUpperCase(),
    updatedAt: summaryText.match(/Last updated:\s*(.+?)(?=Summary|Champions|Ranked)/i)?.[1]?.trim() || null,
    rank: ranked?.rank || 'Unranked',
    lp: ranked?.lp || null,
    wins: ranked?.wins || season?.wins || null,
    losses: ranked?.losses || season?.losses || null,
    winRate: ranked?.winRate || season?.winRate || null,
    kda: season?.kda || null,
    averageKda: season?.averageKda || null,
    seasonGames: season?.games || null,
    topChampions: parseTopChampions(championText),
    flex: parseRankedFlex(summaryText),
  };
}

function findPlayerAvatar($, playerId) {
  const avatar = $('img').filter((_, element) =>
    ($(element).attr('alt') || '').replace(/\s*#\s*/, '#').trim().toLowerCase() === playerId.toLowerCase()
  ).first().attr('src');
  return avatar || null;
}

function parseRankedSolo(text) {
  const match = text.match(/Ranked Solo\/Duo\s*([a-z]+(?:\s+[a-z]+)*\s+\d)\s*(\d+)\s*LP\s*(\d+)W\s*(\d+)L\s*Win rate\s*(\d+)%/i);
  if (match) {
    return {
      rank: titleCase(match[1]),
      lp: match[2],
      wins: match[3],
      losses: match[4],
      winRate: `${match[5]}%`,
    };
  }

  if (/Ranked Solo\/DuoUnranked/i.test(text)) {
    return { rank: 'Unranked', lp: null, wins: null, losses: null, winRate: null };
  }

  return null;
}

function parseSeasonStats(text) {
  const match = text.match(/-All Champions\s*(\d+)W\s*(\d+)L\s*(\d+)%\s*([\d.]+):1\s*([\d.]+\s*\/\s*[\d.]+\s*\/\s*[\d.]+)/i);
  if (!match) return null;

  return {
    wins: match[1],
    losses: match[2],
    winRate: `${match[3]}%`,
    kda: `${match[4]}:1`,
    averageKda: match[5],
    games: String(Number(match[1]) + Number(match[2])),
  };
}

function parseTopChampions(text) {
  const section = text.replace(/^.*?-All Champions/i, '');
  return [...section.matchAll(/(?:Show more|-)(\d{1,2})\s*([A-Z][A-Za-z '&.-]+?)\s*(\d+)W\s*(\d+)L\s*(\d+)%\s*([\d.]+):1/gi)]
    .slice(0, 3)
    .map((match) => ({
      name: match[2].trim(),
      wins: match[3],
      losses: match[4],
      winRate: `${match[5]}%`,
      kda: `${match[6]}:1`,
    }));
}

function parseRankedFlex(text) {
  const flexIndex = text.lastIndexOf('Ranked Flex');
  const flexSection = flexIndex >= 0 ? text.slice(flexIndex + 'Ranked Flex'.length) : '';
  const ranked = flexSection.match(/([a-z]+(?:\s+[a-z]+)*\s+\d)\s*(\d+)\s*LP\s*(\d+)W\s*(\d+)L\s*Win rate\s*(\d+)%/i);
  if (ranked) {
    return {
      rank: titleCase(ranked[1]),
      lp: ranked[2],
      wins: ranked[3],
      losses: ranked[4],
      winRate: `${ranked[5]}%`,
    };
  }

  return /Unranked/i.test(flexSection) ? { rank: 'Unranked' } : null;
}

function titleCase(value) {
  return String(value)
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

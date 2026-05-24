import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fetchLolStats, parseLolHtml } from '../lib/providers/lol.js';
import { buildValorantProfileUrl, fetchValorantStats, parseValorantHtml } from '../lib/providers/valorant.js';

const fixture = (file) => readFile(new URL(`./fixtures/${file}`, import.meta.url), 'utf8');

test('Valorant uses the all modes public profile view', () => {
  assert.equal(
    buildValorantProfileUrl('SEN TenZ', '2906'),
    'https://www.valocheck.com/player/SEN%20TenZ/2906/?mode=all'
  );
});

test('parseValorantHtml extracts current Act all modes public stats', async () => {
  const stats = parseValorantHtml(await fixture('valorant.html'), 'SEN Tenz', '2906');

  assert.deepEqual(stats, {
    playerId: 'SEN Tenz#2906',
    avatarUrl: 'https://media.valorant-api.com/playercards/example/smallart.png',
    server: 'AP',
    rank: 'Platinum 1',
    rr: '66',
    peakRank: 'Platinum 1',
    matches: '4',
    topAgent: 'Breach',
    updatedAt: '2026-05-24 02:14 UTC',
    kd: '0.72',
    kad: '0.94',
    winRate: '50.0%',
    acs: '188',
    headshot: '34.1%',
    adr: '131.0',
    kills: '51',
    assists: '16',
    bodyshot: '63.8%',
    legshot: '2.2%',
    topAgents: [
      { name: 'Breach', games: '2', winRate: '0.0%', kd: '0.91' },
      { name: 'Phoenix', games: '1', winRate: '100.0%', kd: '0.39' },
    ],
    recentHighlights: [
      { map: 'Bind', score: '8—4', agent: 'Phoenix', kda: '23/6/1', rrChange: '+17' },
      { map: 'Haven', score: '6—1', agent: 'Phoenix', kda: '12/2/1', rrChange: '+10' },
    ],
  });
});

test('parseLolHtml extracts ranked and champion season summary', async () => {
  const stats = parseLolHtml(
    await fixture('lol-summary.html'),
    await fixture('lol-champions.html'),
    'kr'
  );

  assert.deepEqual(stats, {
    playerId: 'hide on bush#1401',
    avatarUrl: 'https://opgg-static.akamaized.net/meta/images/profile_icons/profileIcon1134.jpg',
    region: 'KR',
    updatedAt: '3 minutes ago',
    rank: 'Diamond 2',
    lp: '75',
    wins: '79',
    losses: '81',
    winRate: '49%',
    kda: '2.91:1',
    averageKda: '6 / 4.4 / 6.9',
    seasonGames: '437',
    topChampions: [
      { name: 'Aurora', wins: '29', losses: '22', winRate: '57%', kda: '2.99:1' },
      { name: 'Anivia', wins: '24', losses: '8', winRate: '75%', kda: '4.16:1' },
      { name: 'Ryze', wins: '17', losses: '12', winRate: '59%', kda: '3.29:1' },
    ],
    flex: { rank: 'Emerald 4', lp: '20', wins: '2', losses: '8', winRate: '20%' },
  });
});

test('parsers return null when a public page no longer contains stats', () => {
  assert.equal(parseValorantHtml('<html><body>Player not found</body></html>', 'Nope', '000'), null);
  assert.equal(parseLolHtml('<html><body><h1>Nope#000</h1></body></html>'), null);
});

test('providers surface blocked public sources as a fallback status', async () => {
  const blockedFetch = async () => new Response('', { status: 403 });
  const valorant = await fetchValorantStats('Nope', '000', blockedFetch);
  const lol = await fetchLolStats('Nope', '000', 'tw', blockedFetch);

  assert.equal(valorant.status, 'blocked');
  assert.equal(lol.status, 'blocked');
});

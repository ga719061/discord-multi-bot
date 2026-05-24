import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageFlags } from 'discord.js';
import { buildStatsReply } from '../lib/embed.js';

function serializedCard(payload) {
  return JSON.stringify(payload.components.map((component) => component.toJSON()));
}

test('buildStatsReply creates a serializable Valorant success card with a link button', () => {
  const payload = buildStatsReply({
    game: 'valorant',
    status: 'ok',
    source: 'ValoCheck',
    sourceUrl: 'https://www.valocheck.com/player/SEN%20TenZ/2906/?mode=all',
    stats: {
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
      topAgents: [{ name: 'Breach', games: '2', winRate: '0.0%', kd: '0.91' }],
      recentHighlights: [{ map: 'Bind', score: '8—4', agent: 'Phoenix', kda: '23/6/1', rrChange: '+17' }],
    },
  }, 'SEN Tenz', '2906');
  const card = serializedCard(payload);

  assert.match(card, /All Modes/);
  assert.match(card, /smallart\.png/);
  assert.match(card, /近期亮點/);
  assert.match(card, /特務表現/);
  assert.match(card, /www\.valocheck\.com/);
  assert.equal('embeds' in payload, false);
  assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
});

test('buildStatsReply creates a fallback card when a source is blocked', () => {
  const payload = buildStatsReply({
    game: 'lol',
    status: 'blocked',
    source: 'OP.GG',
    sourceUrl: 'https://op.gg/lol/summoners/tw/test-TW2',
  }, 'test', 'TW2');
  const card = serializedCard(payload);

  assert.match(card, /來源網站暫時拒絕查詢/);
  assert.equal(payload.components.length, 1);
});

test('buildStatsReply includes detailed League season and champion fields', () => {
  const payload = buildStatsReply({
    game: 'lol',
    status: 'ok',
    source: 'OP.GG',
    sourceUrl: 'https://op.gg/lol/summoners/kr/hide%20on%20bush-1401',
    stats: {
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
      topChampions: [{ name: 'Aurora', wins: '29', losses: '22', winRate: '57%', kda: '2.99:1' }],
      flex: { rank: 'Emerald 4', lp: '20', winRate: '20%' },
    },
  }, 'hide on bush', '1401');
  const card = serializedCard(payload);

  assert.match(card, /賽季場次/);
  assert.match(card, /profileIcon1134\.jpg/);
  assert.match(card, /常用英雄[\s\S]*Aurora/);
  assert.match(card, /彈性積分[\s\S]*Emerald 4/);
});

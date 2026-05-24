import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStatsReply } from '../lib/embed.js';

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
  const embed = payload.embeds[0].toJSON();

  assert.match(embed.footer.text, /All Modes/);
  assert.equal(embed.thumbnail.url, 'https://media.valorant-api.com/playercards/example/smallart.png');
  assert.equal(embed.fields.some((field) => field.name.includes('近期亮點')), true);
  assert.equal(embed.fields.some((field) => field.name.includes('特務表現')), true);
  assert.equal(payload.components[0].toJSON().components[0].url, 'https://www.valocheck.com/player/SEN%20TenZ/2906/?mode=all');
  assert.ok(embed.description.length < 4096);
});

test('buildStatsReply creates a fallback card when a source is blocked', () => {
  const payload = buildStatsReply({
    game: 'lol',
    status: 'blocked',
    source: 'OP.GG',
    sourceUrl: 'https://op.gg/lol/summoners/tw/test-TW2',
  }, 'test', 'TW2');
  const embed = payload.embeds[0].toJSON();

  assert.match(embed.title, /來源網站暫時拒絕查詢/);
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
  const embed = payload.embeds[0].toJSON();

  assert.equal(embed.fields.some((field) => field.name.includes('賽季場次')), true);
  assert.equal(embed.thumbnail.url, 'https://opgg-static.akamaized.net/meta/images/profile_icons/profileIcon1134.jpg');
  assert.match(embed.fields.find((field) => field.name.includes('常用英雄')).value, /Aurora/);
  assert.match(embed.fields.find((field) => field.name.includes('彈性積分')).value, /Emerald 4/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { ComponentType, MessageFlags } from 'discord.js';
import { buildStatsReply } from '../lib/embed.js';
import { buildStatsModal, data } from '../stats.js';

function serializedCard(payload) {
  return JSON.stringify(payload.components.map((component) => component.toJSON()));
}

test('buildStatsReply creates a serializable OP.GG Valorant All Modes card with detailed fields', () => {
  const payload = buildStatsReply({
    game: 'valorant',
    status: 'ok',
    source: 'OP.GG',
    sourceUrl: 'https://op.gg/valorant/profile/SEN%20TenZ-2906',
    isFallback: false,
    stats: {
      playerId: 'SEN Tenz#2906',
      avatarUrl: 'https://c-valorant-api.op.gg/Assets/PlayerCards/CARD_small.png',
      server: 'NA',
      rank: 'Radiant',
      matches: '10',
      wins: '7',
      draws: '1',
      losses: '2',
      topAgent: 'Jett',
      updatedAt: '2026-05-24 02:14 UTC',
      kd: '1.80',
      kad: '2.30',
      winRate: '70.0%',
      acs: '250.0',
      headshot: '25.0%',
      adr: '150.0',
      kills: '180',
      deaths: '100',
      assists: '50',
      bodyshot: '65.0%',
      legshot: '10.0%',
      highestKills: '41',
      timePlayed: '10 小時 20 分鐘',
      topAgents: [{ name: 'Jett', games: '5', winRate: '80.0%', kda: '2.50', averageScore: '233.3' }],
      weapons: [{ name: 'Vandal', kills: '98', headshot: '40.0%' }],
      maps: [{ name: 'Split', record: '3勝 0和 1敗', winRate: '75.0%' }],
    },
  }, 'SEN Tenz', '2906');
  const card = serializedCard(payload);

  assert.match(card, /OP\.GG All Modes/);
  assert.match(card, /PlayerCards\/CARD_small\.png/);
  assert.match(card, /武器表現[\s\S]*Vandal/);
  assert.match(card, /地圖表現[\s\S]*Split/);
  assert.match(card, /總 K \/ D \/ A[\s\S]*180 \/ 100 \/ 50/);
  assert.match(card, /op\.gg\/valorant/);
  assert.equal('embeds' in payload, false);
  assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
});

test('buildStatsReply labels a ValoCheck fallback and links the actual source', () => {
  const payload = buildStatsReply({
    game: 'valorant',
    status: 'ok',
    source: 'ValoCheck',
    sourceUrl: 'https://www.valocheck.com/player/SEN%20Tenz/2906/?mode=all',
    isFallback: true,
    stats: {
      playerId: 'SEN Tenz#2906',
      rank: 'Platinum 1',
      matches: '4',
      kd: '0.72',
      kad: '0.94',
      winRate: '50.0%',
      acs: '188',
      topAgents: [],
      recentHighlights: [],
    },
  }, 'SEN Tenz', '2906');
  const card = serializedCard(payload);

  assert.match(card, /ValoCheck All Modes/);
  assert.match(card, /皇家備援情報[\s\S]*OP\.GG 未呈上可顯示的公開資料/);
  assert.match(card, /www\.valocheck\.com/);
});

test('buildStatsReply creates a fallback card when a source is blocked', () => {
  const payload = buildStatsReply({
    game: 'lol',
    status: 'blocked',
    source: 'OP.GG',
    sourceUrl: 'https://op.gg/lol/summoners/tw/test-TW2',
  }, 'test', 'TW2');
  const card = serializedCard(payload);

  assert.match(card, /情報使者暫時被來源網站擋下/);
  assert.equal(payload.components.length, 1);
});

test('/戰績 opens one direct modal containing game selection and Riot ID fields', () => {
  const command = data.toJSON();
  const modalJson = buildStatsModal('query-session').toJSON();
  const modal = JSON.stringify(modalJson);
  const textDisplay = modalJson.components.find((component) => component.type === ComponentType.TextDisplay);
  const textInputs = modalJson.components
    .filter((component) => component.type === ComponentType.Label)
    .map((label) => label.component)
    .filter((component) => component?.type === ComponentType.TextInput);

  assert.equal(command.options?.length ?? 0, 0);
  assert.match(modal, /皇家戰報廳/);
  assert.match(modal, /功能說明/);
  assert.match(modal, /公開賽季戰績/);
  assert.match(modal, /一鍵發布/);
  assert.match(modal, /game/);
  assert.match(modal, /特戰英豪/);
  assert.match(modal, /英雄聯盟/);
  assert.match(modal, /player_name/);
  assert.match(modal, /region/);
  assert.match(modal, /台灣/);
  assert.match(modal, /特戰英豪會自動忽略/);
  assert.equal(modal.includes('feature_note'), false);
  assert.equal(textDisplay.content.includes('功能說明'), true);
  assert.equal(textInputs.length, 2);
  assert.deepEqual(textInputs.map((input) => input.custom_id), ['player_name', 'tag']);
});

test('private successful stats reply offers one-time publishing while public reply does not', () => {
  const result = {
    game: 'lol',
    status: 'ok',
    source: 'OP.GG',
    sourceUrl: 'https://op.gg/lol/summoners/tw/test-TW2',
    stats: { playerId: 'test#TW2', rank: 'Gold', region: 'TW', topChampions: [] },
  };
  const privatePayload = buildStatsReply(result, 'test', 'TW2', {
    ephemeral: true,
    publishCustomId: 'stats:query-session:publish',
  });
  const publishedPayload = buildStatsReply(result, 'test', 'TW2', {
    ephemeral: true,
    publishCustomId: 'stats:query-session:publish',
    published: true,
  });
  const publicPayload = buildStatsReply(result, 'test', 'TW2');
  const publicCard = serializedCard(publicPayload);

  assert.equal((privatePayload.flags & MessageFlags.Ephemeral) !== 0, true);
  assert.equal(publicCard.includes('](https://op.gg'), false);
  assert.match(publicCard, /"url":"https:\/\/op\.gg\/lol\/summoners\/tw\/test-TW2"/);
  assert.match(serializedCard(privatePayload), /頒布至目前頻道/);
  assert.match(serializedCard(publishedPayload), /戰報已頒布/);
  assert.equal(serializedCard(publicPayload).includes('頒布至目前頻道'), false);
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
  assert.match(card, /常用英雄表現[\s\S]*Aurora/);
  assert.match(card, /彈性積分[\s\S]*Emerald 4/);
});

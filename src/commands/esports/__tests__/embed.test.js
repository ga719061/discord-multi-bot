import test from 'node:test';
import assert from 'node:assert/strict';
import { ComponentType, MessageFlags } from 'discord.js';
import { buildStatsReply } from '../lib/embed.js';
import { buildStatsSvg, renderStatsImage, resolveStatsAssets } from '../lib/statsImage.js';
import { applyStatsSessionResult, buildStatsModal, data } from '../stats.js';
import { countV2Components } from '../../../utils/componentsV2.js';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4////fwAJ+wP9CNHoHgAAAABJRU5ErkJggg==',
  'base64'
);

function serializedCard(payload) {
  return JSON.stringify(payload.components.map((component) => component.toJSON()));
}

async function mockAssetFetch(url) {
  const href = String(url);
  if (href.includes('valorant-api.com/v1/agents')) {
    if (href.includes('language=zh-TW')) {
      return jsonResponse({ data: [{ uuid: 'agent-jett', displayName: '婕提' }] });
    }
    return jsonResponse({ data: [{ uuid: 'agent-jett', displayName: 'Jett', displayIcon: 'https://assets.test/jett.png' }] });
  }
  if (href.includes('valorant-api.com/v1/weapons')) {
    if (href.includes('language=zh-TW')) {
      return jsonResponse({ data: [{ uuid: 'weapon-vandal', displayName: '暴徒' }] });
    }
    return jsonResponse({ data: [{ uuid: 'weapon-vandal', displayName: 'Vandal', displayIcon: 'https://assets.test/vandal.png' }] });
  }
  if (href.includes('valorant-api.com/v1/maps')) {
    if (href.includes('language=zh-TW')) {
      return jsonResponse({ data: [{ uuid: 'map-split', displayName: '雙塔迷城' }] });
    }
    return jsonResponse({ data: [{ uuid: 'map-split', displayName: 'Split', splash: 'https://assets.test/split.png' }] });
  }
  if (href.includes('ddragon.leagueoflegends.com/api/versions.json')) {
    return jsonResponse(['15.1.1']);
  }
  if (href.includes('ddragon.leagueoflegends.com/cdn/15.1.1/data/en_US/champion.json')) {
    return jsonResponse({ data: { Aurora: { id: 'Aurora', name: 'Aurora', image: { full: 'Aurora.png' } } } });
  }
  if (href.includes('ddragon.leagueoflegends.com/cdn/15.1.1/data/zh_TW/champion.json')) {
    return jsonResponse({ data: { Aurora: { id: 'Aurora', name: '歐羅拉', image: { full: 'Aurora.png' } } } });
  }
  return new Response(tinyPng, { status: 200, headers: { 'content-type': 'image/png' } });
}

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('buildStatsReply creates a Valorant image card with attachment and source actions', async () => {
  const result = {
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
      topAgents: [{ id: 'agent-jett', name: 'Jett', games: '5', winRate: '80.0%', kda: '2.50', averageScore: '233.3' }],
      weapons: [{ id: 'weapon-vandal', name: 'Vandal', kills: '98', headshot: '40.0%' }],
      maps: [{ id: 'map-split', name: 'Split', record: '3勝 0和 1敗', winRate: '75.0%' }],
    },
  };
  const assets = await resolveStatsAssets(result, { fetchImpl: mockAssetFetch });
  const payload = await buildStatsReply(result, 'SEN Tenz', '2906', { fetchImpl: mockAssetFetch });
  const card = serializedCard(payload);
  const svg = buildStatsSvg(result, assets);

  assert.match(card, /attachment:\/\/stats-card\.png/);
  assert.match(card, /op\.gg\/valorant/);
  assert.equal(payload.files[0].name, 'stats-card.png');
  assert.equal((svg.match(/data-icon=/g) || []).length >= 6, true);
  assert.match(svg, /data-role="stats-background"/);
  assert.match(svg, /data-region="card-header"/);
  assert.match(svg, /data-region="identity-card"/);
  assert.match(svg, /data-region="metric-dock"/);
  assert.match(svg, /data-region="detail-sections"/);
  assert.match(svg, /data-panel="stats-section"/);
  assert.match(svg, /<image href="data:image\/png;base64/);
  assert.match(svg, /data-image-layout="wide"/);
  assert.match(svg, /clip-path="url\(#identityAvatarClip-valorant\)"/);
  assert.match(svg, /x="76" y="222" width="132" height="132" preserveAspectRatio="xMidYMid slice"/);
  assert.match(svg, /x="88" y="519" width="44" height="44" preserveAspectRatio="xMidYMid slice"/);
  assert.match(svg, /x="538" y="521" width="88" height="40" preserveAspectRatio="xMidYMid meet"/);
  assert.match(svg, /preserveAspectRatio="xMidYMid meet"/);
  assert.match(svg, /皇家戰報/);
  assert.match(svg, /VALORANT/);
  assert.match(svg, /婕提/);
  assert.match(svg, /暴徒/);
  assert.match(svg, /雙塔迷城/);
  assert.match(svg, /常用特務/);
  assert.match(svg, /武器表現/);
  assert.match(svg, /地圖勝率/);
  assert.equal(svg.includes('網站未呈報</text>'), false);
  assert.equal('embeds' in payload, false);
  assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
});

test('buildStatsReply labels a ValoCheck fallback and links the actual source', async () => {
  const result = {
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
  };
  const payload = await buildStatsReply(result, 'SEN Tenz', '2906', { fetchImpl: async () => new Response('', { status: 404 }) });
  const card = serializedCard(payload);
  const svg = buildStatsSvg(result);

  assert.match(card, /attachment:\/\/stats-card\.png/);
  assert.match(card, /www\.valocheck\.com/);
  assert.match(svg, /ValoCheck fallback/);
});

test('stats image keeps English row names when localized metadata is unavailable', async () => {
  const fetchImpl = async (url) => (
    String(url).includes('language=zh-TW')
      ? new Response('', { status: 404 })
      : mockAssetFetch(url)
  );
  const result = {
    game: 'valorant',
    status: 'ok',
    source: 'OP.GG',
    sourceUrl: 'https://op.gg/valorant/profile/test',
    stats: {
      playerId: 'test#TW2',
      rank: 'Unranked',
      topAgents: [{ id: 'agent-jett', name: 'Jett', games: '3', winRate: '66.7%' }],
      weapons: [{ id: 'weapon-vandal', name: 'Vandal', kills: '42', headshot: '25.0%' }],
      maps: [{ id: 'map-split', name: 'Split', record: '2勝 0和 1敗', winRate: '66.7%' }],
    },
  };
  const svg = buildStatsSvg(result, await resolveStatsAssets(result, { fetchImpl }));

  assert.match(svg, />Jett</);
  assert.match(svg, />Vandal</);
  assert.match(svg, />Split</);
});

test('buildStatsReply creates a fallback card when a source is blocked', async () => {
  const payload = await buildStatsReply({
    game: 'lol',
    status: 'blocked',
    source: 'OP.GG',
    sourceUrl: 'https://op.gg/lol/summoners/tw/test-TW2',
  }, 'test', 'TW2');
  const card = serializedCard(payload);

  assert.match(card, /情報使者暫時被來源網站擋下/);
  assert.equal(payload.components.length, 1);
  assert.equal('files' in payload, false);
});

test('failed stats replies keep an owner retry entry until timeout', async () => {
  for (const status of ['not_found', 'blocked', 'unavailable', 'parse_error']) {
    const result = {
      game: 'lol',
      status,
      source: 'OP.GG',
      sourceUrl: 'https://op.gg/lol/summoners/tw/test-TW2',
    };
    const active = await buildStatsReply(result, 'test', 'TW2', {
      ephemeral: true,
      retryCustomId: 'stats:query-session:retry',
    });
    const expired = await buildStatsReply(result, 'test', 'TW2', {
      ephemeral: true,
      retryCustomId: 'stats:query-session:retry',
      expired: true,
    });
    const activeJson = active.components.map((component) => component.toJSON());
    const expiredJson = expired.components.map((component) => component.toJSON());

    assert.match(serializedCard(active), status === 'not_found' ? /修正資料/ : /重新查詢/);
    assert.equal(findCustomId(activeJson, 'stats:query-session:retry').disabled, false);
    assert.equal(findCustomId(expiredJson, 'stats:query-session:retry').disabled, true);
    assert.ok(countV2Components(active.components) <= 40);
  }
});

test('stats retry modal pre-fills the original game, Riot ID, tag and region', () => {
  const modal = buildStatsModal('query-session', {
    game: 'lol',
    playerName: 'Hide on bush',
    tag: 'KR1',
    region: 'kr',
  }).toJSON();
  const game = findCustomId(modal, 'game');
  const playerName = findCustomId(modal, 'player_name');
  const tag = findCustomId(modal, 'tag');
  const region = findCustomId(modal, 'region');

  assert.equal(game.options.find((option) => option.value === 'lol').default, true);
  assert.equal(playerName.value, 'Hide on bush');
  assert.equal(tag.value, 'KR1');
  assert.equal(region.options.find((option) => option.value === 'kr').default, true);
});

test('stats retry state can transition from failure to success and resets publishing', () => {
  const state = { published: true };
  applyStatsSessionResult(state, {
    game: 'lol', playerName: 'test', tag: 'TW2', region: 'tw',
  }, { status: 'not_found' });
  assert.equal(state.result.status, 'not_found');
  assert.equal(state.published, false);

  state.published = true;
  applyStatsSessionResult(state, {
    game: 'valorant', playerName: 'SEN Tenz', tag: '2906', region: 'ap',
  }, { status: 'ok' });
  assert.equal(state.result.status, 'ok');
  assert.equal(state.game, 'valorant');
  assert.equal(state.playerName, 'SEN Tenz');
  assert.equal(state.tag, '2906');
  assert.equal(state.region, 'ap');
  assert.equal(state.published, false);
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

test('private successful stats reply offers one-time publishing while public reply does not', async () => {
  const result = {
    game: 'lol',
    status: 'ok',
    source: 'OP.GG',
    sourceUrl: 'https://op.gg/lol/summoners/tw/test-TW2',
    stats: { playerId: 'test#TW2', rank: 'Gold', region: 'TW', topChampions: [] },
  };
  const privatePayload = await buildStatsReply(result, 'test', 'TW2', {
    ephemeral: true,
    publishCustomId: 'stats:query-session:publish',
    fetchImpl: mockAssetFetch,
  });
  const publishedPayload = await buildStatsReply(result, 'test', 'TW2', {
    ephemeral: true,
    publishCustomId: 'stats:query-session:publish',
    published: true,
    fetchImpl: mockAssetFetch,
  });
  const publicPayload = await buildStatsReply(result, 'test', 'TW2', { fetchImpl: mockAssetFetch });
  const publicCard = serializedCard(publicPayload);

  assert.equal((privatePayload.flags & MessageFlags.Ephemeral) !== 0, true);
  assert.match(publicCard, /attachment:\/\/stats-card\.png/);
  assert.match(publicCard, /"url":"https:\/\/op\.gg\/lol\/summoners\/tw\/test-TW2"/);
  assert.match(serializedCard(privatePayload), /頒布至目前頻道/);
  assert.match(serializedCard(publishedPayload), /戰報已頒布/);
  assert.equal(serializedCard(publicPayload).includes('頒布至目前頻道'), false);
});

test('buildStatsReply includes League image theme and champion sections', async () => {
  const result = {
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
  };
  const assets = await resolveStatsAssets(result, { fetchImpl: mockAssetFetch });
  const payload = await buildStatsReply(result, 'hide on bush', '1401', { fetchImpl: mockAssetFetch });
  const card = serializedCard(payload);
  const svg = buildStatsSvg(result, assets);

  assert.match(card, /attachment:\/\/stats-card\.png/);
  assert.match(svg, /data-role="stats-background"/);
  assert.match(svg, /data-region="identity-card"/);
  assert.match(svg, /data-region="metric-dock"/);
  assert.match(svg, /data-panel="stats-section"/);
  assert.match(svg, /<image href="data:image\/png;base64/);
  assert.match(svg, /LEAGUE OF LEGENDS/);
  assert.match(svg, /歐羅拉/);
  assert.match(svg, /峽谷榮耀/);
  assert.match(svg, /常用英雄/);
  assert.match(svg, /單雙 \/ 彈性牌位/);
  assert.match(svg, /賽季摘要/);
  assert.match(svg, /data-icon="crown"/);
});

test('renderStatsImage returns a non-empty PNG buffer for missing optional fields', async () => {
  const { buffer, filename } = await renderStatsImage({
    game: 'lol',
    status: 'ok',
    source: 'OP.GG',
    sourceUrl: 'https://op.gg/lol/summoners/tw/test-TW2',
    stats: { playerId: 'test#TW2', rank: 'Unranked', region: 'TW' },
  }, {
    fetchImpl: async () => new Response('', { status: 404 }),
  });

  assert.equal(filename, 'stats-card.png');
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(buffer.length > 1000, true);
});

test('renderer keeps long Valorant values inside fixed metric and row columns', async () => {
  const result = {
    game: 'valorant',
    status: 'ok',
    source: 'OP.GG',
    sourceUrl: 'https://op.gg/valorant/profile/test',
    stats: {
      playerId: '爆漿起司豬#635',
      avatarUrl: 'https://assets.test/avatar.png',
      server: 'AP',
      rank: 'Unranked',
      updatedAt: '2026-05-24T13:48:05+00:00',
      kd: '1.13',
      kad: '1.65',
      winRate: '48.1%',
      acs: '227.0',
      headshot: '15.9%',
      adr: '118.4',
      topAgents: [{ name: 'Miks', games: '45', winRate: '44.4%' }],
      weapons: [{ name: 'Vandal', kills: '202', headshot: '15.7%' }],
      maps: [{ name: 'Lotus', record: '6勝 0和 8敗', winRate: '42.9%' }],
    },
  };
  const svg = buildStatsSvg(result, await resolveStatsAssets(result, { fetchImpl: mockAssetFetch }));

  assert.match(svg, /2026-05-24 21:48|2026-05-24 13:48/);
  assert.match(svg, /font-size="38"[^>]*>48\.1%/);
  assert.match(svg, />227\.0</);
  assert.match(svg, />118\.4</);
  assert.equal(svg.includes('網站未呈報</text>'), false);
});

test('renderer fetches only needed Valorant asset indexes and keeps weapon thumbnails contained', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    return mockAssetFetch(url);
  };
  const result = {
    game: 'valorant',
    status: 'ok',
    source: 'OP.GG',
    stats: {
      playerId: 'test#TW2',
      rank: 'Unranked',
      weapons: [{ name: 'Vandal', kills: '155', headshot: '15.6%' }],
      topAgents: [],
      maps: [],
    },
  };
  const svg = buildStatsSvg(result, await resolveStatsAssets(result, { fetchImpl }));

  assert.equal(calls.some((call) => call.includes('/v1/weapons')), true);
  assert.equal(calls.some((call) => call.includes('/v1/agents')), false);
  assert.equal(calls.some((call) => call.includes('/v1/maps')), false);
  assert.match(svg, /data-image-layout="wide"/);
  assert.match(svg, /x="538" y="521" width="88" height="40" preserveAspectRatio="xMidYMid meet"/);
});

test('renderer rejects untrusted asset hosts before fetching', async () => {
  let calls = 0;
  const assets = await resolveStatsAssets({
    game: 'lol',
    stats: {
      avatarUrl: 'http://127.0.0.1/private.png',
      topChampions: [],
    },
  }, {
    fetchImpl: async () => {
      calls += 1;
      return new Response(tinyPng);
    },
  });

  assert.equal(assets.avatar, null);
  assert.equal(calls, 0);
});

test('renderer limits external image downloads and disables redirects', async () => {
  let requestOptions;
  const assets = await resolveStatsAssets({
    game: 'lol',
    stats: {
      avatarUrl: 'https://opgg-static.akamaized.net/oversized.png',
      topChampions: [],
    },
  }, {
    fetchImpl: async (_url, options) => {
      requestOptions = options;
      return new Response(tinyPng, {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': String(6 * 1024 * 1024),
        },
      });
    },
  });

  assert.equal(assets.avatar, null);
  assert.equal(requestOptions.redirect, 'error');
});

test('renderer keeps long League names, ranks and KDA values from colliding', async () => {
  const result = {
    game: 'lol',
    status: 'ok',
    source: 'OP.GG',
    sourceUrl: 'https://op.gg/lol/summoners/tw/library-TW2',
    stats: {
      playerId: '蘭德索爾圖書館#tw2',
      avatarUrl: 'https://assets.test/avatar.png',
      region: 'TW',
      updatedAt: '19 hours ago',
      rank: 'Bronze 1',
      lp: '10',
      wins: '2',
      losses: '3',
      winRate: '40%',
      kda: '2.48:1',
      averageKda: '8.2 / 6.1 / 6.9',
      seasonGames: '9',
      topChampions: [
        { name: 'Xerath', wins: '1', losses: '0', winRate: '100%', kda: '8.1:1' },
        { name: 'Xin Zhao', wins: '1', losses: '0', winRate: '100%', kda: '3.2:1' },
        { name: 'Viktor', wins: '1', losses: '0', winRate: '100%', kda: '2.8:1' },
      ],
      flex: { rank: null, lp: null, winRate: null },
    },
  };
  const svg = buildStatsSvg(result, await resolveStatsAssets(result, { fetchImpl: mockAssetFetch }));

  assert.match(svg, /蘭德索爾圖書館#/);
  assert.match(svg, />Bronze 1</);
  assert.match(svg, />8\.2\/6\.1/);
  assert.doesNotMatch(svg, /Bronze\.\.\./);
  assert.doesNotMatch(svg, /8\.2 \/ \.\.\./);
});

function findCustomId(value, customId) {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findCustomId(item, customId);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== 'object') return null;
  if (value.custom_id === customId) return value;
  return findCustomId(Object.values(value), customId);
}

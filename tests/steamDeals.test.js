import test from 'node:test';
import assert from 'node:assert/strict';
import { ComponentType, MessageFlags } from 'discord.js';
import { countV2Components } from '../src/utils/componentsV2.js';
import {
  buildSteamDealDetailPayload,
  buildSteamDealsPayload,
  buildSteamFreeGamesPayload,
  clearSteamAppDetailsCacheForTests,
  fetchSteamAppDetails,
  fetchSteamJson,
  fetchSteamLimitedFreeGames,
  getSteamFailureMessage,
  isValidSteamDealTime,
} from '../src/utils/steamDeals.js';

test('isValidSteamDealTime accepts Taiwan daily push time format only', () => {
  assert.equal(isValidSteamDealTime('20:00'), true);
  assert.equal(isValidSteamDealTime('7:00'), false);
  assert.equal(isValidSteamDealTime('24:00'), false);
});

test('fetchSteamJson classifies unavailable and invalid responses', async () => {
  await assert.rejects(
    fetchSteamJson('https://steam.invalid', async () => ({ ok: false, status: 503 })),
    (error) => error.code === 'unavailable'
  );
  await assert.rejects(
    fetchSteamJson('https://steam.invalid', async () => ({ ok: true, json: async () => { throw new Error('bad json'); } })),
    (error) => error.code === 'invalid_data'
  );
});

test('getSteamFailureMessage gives distinct feedback for malformed data', () => {
  assert.match(getSteamFailureMessage({ code: 'invalid_data' }), /資料格式不完整/);
  assert.match(getSteamFailureMessage({ code: 'unavailable' }), /無法連線/);
});

test('buildSteamDealsPayload displays up to ten ranked deal rows with capsule images and detail selector', () => {
  const deals = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    name: `Game ${index + 1}`,
    discount_percent: 50,
    original_price: 50000,
    final_price: 25000,
    header_image: `https://cdn.example.test/header-${index + 1}.jpg`,
    large_capsule_image: `https://cdn.example.test/game-${index + 1}.jpg`,
  }));

  const payload = buildSteamDealsPayload(deals);
  const children = payload.components.flatMap((panel) => panel.toJSON().components);
  const galleries = children.filter((component) => component.type === ComponentType.MediaGallery);
  const actionRow = children.find((component) => component.type === ComponentType.ActionRow);
  const selector = actionRow.components[0];
  const text = JSON.stringify(payload.components.map((panel) => panel.toJSON()));

  assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
  assert.equal(payload.components.length, 1);
  assert.equal(galleries.length, 10);
  assert.equal(galleries[0].items[0].media.url, 'https://cdn.example.test/header-1.jpg');
  assert.equal(galleries[9].items[0].media.url, 'https://cdn.example.test/header-10.jpg');
  assert.match(text, /吉吉王國・御用特價情報/);
  assert.equal(text.includes('候選'), false);
  assert.equal(text.includes('更多特價'), false);
  assert.match(text, /挑選一款特價遊戲，覲見皇家情報/);
  assert.equal(text.includes('皇家採購'), false);
  assert.equal(selector.custom_id, 'steam_deal_detail');
  assert.equal(selector.options.length, 10);
  assert.equal(countV2Components(payload.components) <= 40, true);
});

test('fetchSteamAppDetails and detail payload provide private interactive game information', async () => {
  clearSteamAppDetailsCacheForTests();
  const details = await fetchSteamAppDetails(42, async () => ({
    ok: true,
    json: async () => ({
      42: {
        success: true,
        data: {
          name: 'Royal Game',
          short_description: 'A delightful discount.',
          header_image: 'https://cdn.example.test/detail.jpg',
          price_overview: {
            discount_percent: 60,
            initial_formatted: 'NT$ 500',
            final_formatted: 'NT$ 200',
          },
          release_date: { date: '2026 年 5 月 24 日' },
          metacritic: { score: 88 },
        },
      },
    }),
  }));
  const payload = buildSteamDealDetailPayload(42, details, { checkedAt: new Date('2026-05-24T09:00:00Z') });
  const components = payload.components[0].toJSON().components;
  const row = components.find((component) => component.type === ComponentType.ActionRow);

  assert.equal((payload.flags & MessageFlags.Ephemeral) !== 0, true);
  assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
  assert.match(JSON.stringify(components), /Royal Game/);
  assert.match(JSON.stringify(components), /NT\$ 200/);
  assert.equal(row.components[0].url, 'https://store.steampowered.com/app/42/');
});

test('fetchSteamAppDetails reuses fresh cached details for repeated lookups', async () => {
  clearSteamAppDetailsCacheForTests();

  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: true,
      json: async () => ({
        777: {
          success: true,
          data: { name: `Cached Game ${calls}` },
        },
      }),
    };
  };

  const first = await fetchSteamAppDetails(777, fetchImpl, { now: 1000 });
  const second = await fetchSteamAppDetails(777, fetchImpl, { now: 2000 });

  assert.equal(calls, 1);
  assert.equal(first, second);
  assert.equal(second.name, 'Cached Game 1');
});

test('fetchSteamLimitedFreeGames keeps only temporary 100 percent free discounts', async () => {
  const html = [
    '<a data-ds-appid="101" data-price-final="0" data-discount="100"><img src="https://cdn.example.test/free.jpg"><span class="title">Limited Free</span><div class="discount_original_price">NT$ 500</div></a>',
    '<a data-ds-appid="102" data-price-final="0" data-discount="0"><img src="https://cdn.example.test/f2p.jpg"><span class="title">Always Free</span></a>',
    '<a data-ds-appid="103" data-price-final="25000" data-discount="50"><img src="https://cdn.example.test/deal.jpg"><span class="title">Half Off</span><div class="discount_original_price">NT$ 500</div></a>',
    '<a data-ds-appid="104" data-price-final="0" data-discount="100"><img src="https://cdn.example.test/no-original.jpg"><span class="title">No Original Price</span></a>',
  ].join('');

  const games = await fetchSteamLimitedFreeGames(10, async () => ({
    ok: true,
    json: async () => ({ results_html: html }),
  }));

  assert.equal(games.length, 1);
  assert.equal(games[0].id, 101);
  assert.equal(games[0].name, 'Limited Free');
  assert.equal(games[0].final_price, 0);
  assert.equal(games[0].original_price, 50000);
});

test('buildSteamFreeGamesPayload displays up to ten ranked free-game rows with capsule images and detail selector', () => {
  const games = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    name: `Free Game ${index + 1}`,
    discount_percent: 100,
    original_price: 50000,
    final_price: 0,
    large_capsule_image: `https://cdn.example.test/free-${index + 1}.jpg`,
  }));

  const payload = buildSteamFreeGamesPayload(games);
  const children = payload.components.flatMap((panel) => panel.toJSON().components);
  const galleries = children.filter((component) => component.type === ComponentType.MediaGallery);
  const actionRow = children.find((component) => component.type === ComponentType.ActionRow);
  const selector = actionRow.components[0];
  const text = JSON.stringify(payload.components.map((panel) => panel.toJSON()));

  assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
  assert.equal(payload.components.length, 1);
  assert.equal(galleries.length, 10);
  assert.equal(galleries[0].items[0].media.url, 'https://cdn.example.test/free-1.jpg');
  assert.equal(galleries[9].items[0].media.url, 'https://cdn.example.test/free-10.jpg');
  assert.match(text, /限時免費/);
  assert.match(text, /https:\/\/store\.steampowered\.com\/app\/1/);
  assert.equal(text.includes('候選'), false);
  assert.equal(selector.custom_id, 'steam_deal_detail');
  assert.equal(selector.options.length, 10);
  assert.equal(countV2Components(payload.components) <= 40, true);
});

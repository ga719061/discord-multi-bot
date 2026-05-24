import test from 'node:test';
import assert from 'node:assert/strict';
import { ComponentType, MessageFlags } from 'discord.js';
import { countV2Components } from '../src/utils/componentsV2.js';
import {
  buildSteamDealDetailPayload,
  buildSteamDealsPayload,
  fetchSteamAppDetails,
  fetchSteamJson,
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

test('buildSteamDealsPayload displays a full media card and detail selector for all ten ranked deals', () => {
  const deals = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    name: `Game ${index + 1}`,
    discount_percent: 50,
    original_price: 50000,
    final_price: 25000,
    large_capsule_image: `https://cdn.example.test/game-${index + 1}.jpg`,
  }));

  const payload = buildSteamDealsPayload(deals);
  const children = payload.components.flatMap((panel) => panel.toJSON().components);
  const galleries = children.filter((component) => component.type === ComponentType.MediaGallery);
  const actionRow = children.find((component) => component.type === ComponentType.ActionRow);
  const selector = actionRow.components[0];

  assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
  assert.equal(payload.components.length, 3);
  assert.equal(galleries.length, 10);
  assert.equal(galleries[0].items[0].media.url, 'https://cdn.example.test/game-1.jpg');
  assert.equal(galleries[9].items[0].media.url, 'https://cdn.example.test/game-10.jpg');
  assert.equal(selector.custom_id, 'steam_deal_detail');
  assert.equal(selector.options.length, 10);
  assert.equal(countV2Components(payload.components) <= 40, true);
});

test('fetchSteamAppDetails and detail payload provide private interactive game information', async () => {
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

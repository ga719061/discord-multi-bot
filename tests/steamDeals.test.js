import test from 'node:test';
import assert from 'node:assert/strict';
import { ComponentType, MessageFlags } from 'discord.js';
import { buildSteamDealsPayload, fetchSteamJson, getSteamFailureMessage, isValidSteamDealTime } from '../src/utils/steamDeals.js';

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

test('buildSteamDealsPayload displays images for all ten ranked deals', () => {
  const deals = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    name: `Game ${index + 1}`,
    discount_percent: 50,
    original_price: 50000,
    final_price: 25000,
    large_capsule_image: `https://cdn.example.test/game-${index + 1}.jpg`,
  }));

  const payload = buildSteamDealsPayload(deals);
  const container = payload.components[0].toJSON();
  const gallery = container.components.find((component) => component.type === ComponentType.MediaGallery);

  assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
  assert.equal(gallery.items.length, 10);
  assert.equal(gallery.items[9].media.url, 'https://cdn.example.test/game-10.jpg');
});

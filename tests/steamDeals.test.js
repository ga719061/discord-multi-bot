import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchSteamJson, getSteamFailureMessage, isValidSteamDealTime } from '../src/utils/steamDeals.js';

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

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonArray, parseJsonObject, normalizePollVotes } from '../src/utils/jsonUtils.js';

test('parseJsonArray returns fallback for invalid JSON and non-array JSON', () => {
  assert.deepEqual(parseJsonArray('not-json', ['fallback']), ['fallback']);
  assert.deepEqual(parseJsonArray('{"value":1}', ['fallback']), ['fallback']);
  assert.deepEqual(parseJsonArray('["role-a"]'), ['role-a']);
});

test('parseJsonObject returns fallback for invalid JSON and non-object JSON', () => {
  assert.deepEqual(parseJsonObject('not-json', { enabled: 1 }), { enabled: 1 });
  assert.deepEqual(parseJsonObject('["value"]', { enabled: 1 }), { enabled: 1 });
  assert.deepEqual(parseJsonObject('{"message":1}'), { message: 1 });
});

test('normalizePollVotes creates arrays for every poll option', () => {
  assert.deepEqual(normalizePollVotes('{"0":["u1"],"2":"bad"}', 3), {
    0: ['u1'],
    1: [],
    2: [],
  });
});

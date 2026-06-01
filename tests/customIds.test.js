import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScopedCustomId, scopedCustomId } from '../src/utils/customIds.js';

test('scopedCustomId builds colon-delimited ids and parses matching owners only', () => {
    const id = scopedCustomId('help', 'viewer', 'detail', 'general', 2, 1);

    assert.equal(id, 'help:viewer:detail:general:2:1');
    assert.deepEqual(parseScopedCustomId(id, 'help', 'viewer'), ['detail', 'general', '2', '1']);
    assert.equal(parseScopedCustomId(id, 'settings', 'viewer'), null);
    assert.equal(parseScopedCustomId(id, 'help', 'other-user'), null);
});

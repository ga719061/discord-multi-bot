import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsViewTesting } from '../src/commands/admin/settings.js';

const { extractEmojiAndLabel } = settingsViewTesting;

test('extractEmojiAndLabel parses emoji + label combos correctly', () => {
    assert.deepEqual(extractEmojiAndLabel('🎮遊戲玩家'), { emoji: '🎮', label: '遊戲玩家' });
    assert.deepEqual(extractEmojiAndLabel('🎮 遊戲玩家'), { emoji: '🎮', label: '遊戲玩家' });
    assert.deepEqual(extractEmojiAndLabel('<:royal:123456789012345678> 戰士'), { emoji: '<:royal:123456789012345678>', label: '戰士' });
});

test('extractEmojiAndLabel parses pure text button labels correctly', () => {
    assert.deepEqual(extractEmojiAndLabel('遊戲玩家'), { emoji: null, label: '遊戲玩家' });
    assert.deepEqual(extractEmojiAndLabel('Movie Night'), { emoji: null, label: 'Movie Night' });
});

test('extractEmojiAndLabel parses pure emoji button labels correctly', () => {
    assert.deepEqual(extractEmojiAndLabel('🎮'), { emoji: '🎮', label: null });
    assert.deepEqual(extractEmojiAndLabel('<:royal:123456789012345678>'), { emoji: '<:royal:123456789012345678>', label: null });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageFlags } from 'discord.js';
import { buildLeaderboardPayload } from '../src/commands/leveling/leaderboard.js';
import { buildRankPayload } from '../src/commands/leveling/rank.js';
import { countV2Components } from '../src/utils/componentsV2.js';

function serialize(payload) {
  return JSON.stringify(payload.components.map((component) => component.toJSON()));
}

function stripAnsi(text) {
  return text
    .replace(/\\u001b\[[0-9;]*m/g, '')
    .replace(/\u001b\[[0-9;]*m/g, '');
}

test('rank card uses a thumbnail section and readable ANSI progress', () => {
  const payload = buildRankPayload({
    displayName: '皇家測試員',
    avatarUrl: 'https://cdn.example.test/avatar.png',
    levelData: {
      level: 7,
      xp: 375,
      total_messages: 128,
      total_voice_mins: 90,
    },
    xpNeeded: 500,
    rankTitle: '皇家騎士',
    isBooster: true,
  });
  const json = serialize(payload);

  assert.match(json, /皇家測試員 的皇家功勳/);
  assert.match(json, /```ansi/);
  assert.match(stripAnsi(json), /\[爵位\] 皇家騎士/);
  assert.match(stripAnsi(json), /\[等級\] 7/);
  assert.match(stripAnsi(json), /\[經驗\] 375 \/ 500 XP/);
  assert.match(stripAnsi(json), /\[進度\] ▰▰▰▰▰▰▰▰▱▱ 75%/);
  assert.match(json, /128/);
  assert.match(json, /90/);
  assert.match(json, /avatar\.png/);
  assert.equal('embeds' in payload, false);
  assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
  assert.ok(countV2Components(payload.components) <= 40);
});

test('leaderboard uses explicit ANSI podium ranks and keeps a complete readable ranking', () => {
  const entries = Array.from({ length: 5 }, (_, index) => ({
    displayName: `成員 ${index + 1}`,
    level: 10 - index,
    rankTitle: `爵位 ${index + 1}`,
  }));
  const payload = buildLeaderboardPayload(entries, 'https://cdn.example.test/guild.png');
  const json = serialize(payload);

  assert.match(json, /```ansi/);
  assert.match(stripAnsi(json), /\[第 1 名\] 成員 1 · Lv\.10 · 爵位 1/);
  assert.match(stripAnsi(json), /\[第 2 名\] 成員 2 · Lv\.9 · 爵位 2/);
  assert.match(stripAnsi(json), /\[第 3 名\] 成員 3 · Lv\.8 · 爵位 3/);
  assert.match(json, /完整功勳排行/);
  assert.match(json, /\*\*1\. 成員 1\*\* · Lv\.10 · 爵位 1/);
  assert.match(json, /\*\*4\. 成員 4\*\* · Lv\.7/);
  assert.match(json, /\*\*5\. 成員 5\*\* · Lv\.6/);
  assert.equal('embeds' in payload, false);
  assert.ok(countV2Components(payload.components) <= 40);
});

test('leaderboard preserves long podium names outside the truncated ANSI summary', () => {
  const longName = '超級無敵長的皇家成員暱稱'.repeat(4);
  const payload = buildLeaderboardPayload([{ displayName: longName, level: 99, rankTitle: '傳奇功勳大公爵' }]);
  const json = serialize(payload);

  assert.match(json, /```ansi/);
  assert.equal(stripAnsi(json).includes(`[第 1 名] ${longName}`), false);
  assert.equal(json.includes(`**1. ${longName}** · Lv.99 · 傳奇功勳大公爵`), true);
});

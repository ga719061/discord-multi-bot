import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommandManifest, validateCommandManifest } from '../scripts/command-manifest.js';
import { COMMAND_KNOWLEDGE } from '../src/knowledge/commands.js';
import { DEFAULT_AI_PROMPT } from '../src/utils/aiChat.js';
import { getServerKnowledge } from '../src/utils/serverKnowledge.js';
import { initDatabase, updateGuildSetting } from '../src/utils/database.js';

test('public server knowledge excludes admin-only control-center details', () => {
  initDatabase();
  const knowledge = getServerKnowledge(`knowledge-public-${process.pid}`, false);

  assert.match(knowledge, /公開功能/);
  assert.match(knowledge, /\/特價查詢/);
  assert.equal(knowledge.includes('/設定'), false);
  assert.equal(knowledge.includes('AI_ADMIN_PASSWORD'), false);
  assert.equal(knowledge.includes('管理員附註'), false);
  assert.equal(knowledge.includes('管理控制台'), false);
});

test('admin server knowledge includes admin notes and guild setting status', () => {
  initDatabase();
  const guildId = `knowledge-admin-${process.pid}`;
  updateGuildSetting(guildId, 'welcome_channel', 'welcome-channel');
  updateGuildSetting(guildId, 'log_channel', 'log-channel');

  const knowledge = getServerKnowledge(guildId, true);

  assert.match(knowledge, /管理員功能/);
  assert.match(knowledge, /\/設定/);
  assert.match(knowledge, /管理員附註/);
  assert.match(knowledge, /歡迎系統狀態: 已啟用/);
  assert.match(knowledge, /日誌頻道: 已就緒/);
});

test('knowledge command names match the deployed slash command manifest', async () => {
  const manifestNames = validateCommandManifest(await buildCommandManifest());
  const knowledgeNames = COMMAND_KNOWLEDGE
    .map((command) => command.name)
    .sort((a, b) => a.localeCompare(b));

  assert.deepEqual(knowledgeNames, manifestNames);
});

test('default AI prompt contains persona only, not server feature knowledge', () => {
  assert.match(DEFAULT_AI_PROMPT, /吉吉國王/);
  assert.match(DEFAULT_AI_PROMPT, /繁體中文/);
  assert.equal(DEFAULT_AI_PROMPT.includes('/設定'), false);
  assert.equal(DEFAULT_AI_PROMPT.includes('/特價查詢'), false);
  assert.equal(DEFAULT_AI_PROMPT.includes('Steam'), false);
  assert.equal(DEFAULT_AI_PROMPT.includes('白名單'), false);
  assert.equal(DEFAULT_AI_PROMPT.includes('Gemini'), false);
});

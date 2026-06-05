import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGuildDiagnostics } from '../src/utils/guildDiagnostics.js';

function createSettings(overrides = {}) {
  return {
    welcome_channel: 'welcome',
    log_channel: 'logs',
    selfrole_roles: '["games"]',
    level_up_announcement_enabled: 1,
    steam_deal_channel: 'deals',
    steam_deal_time: '20:00',
    steam_deal_enabled: 1,
    steam_free_channel: 'freebies',
    steam_free_time: '21:00',
    steam_free_enabled: 1,
    ...overrides,
  };
}

function byLabel(items, label) {
  return items.find((item) => item.label === label);
}

test('buildGuildDiagnostics reports healthy configured features', () => {
  const diagnostics = buildGuildDiagnostics({
    settings: createSettings(),
    aiSettings: { model: 'gemini-2.5-flash-lite' },
    reactionRoles: [{ channel_id: 'roles' }],
    availableChannelIds: new Set(['welcome', 'logs', 'deals', 'freebies', 'roles']),
    channelNames: new Map([['welcome', '迎賓大廳'], ['logs', '史官館'], ['deals', '皇家採購'], ['freebies', '免費情報'], ['roles', '身分領取']]),
    hasDiscordToken: true,
    hasGoogleAiKey: true,
    hasAiAdminPassword: true,
  });

  assert.equal(diagnostics.every((item) => item.status === '正常'), true);
  assert.match(byLabel(diagnostics, '日誌記錄').detail, /#史官館/);
  assert.match(byLabel(diagnostics, '歡迎訊息').detail, /#迎賓大廳/);
  assert.match(byLabel(diagnostics, 'Steam 特價推播').detail, /#皇家採購 每日 20:00/);
  assert.match(byLabel(diagnostics, 'Steam 限時免費推播').detail, /#免費情報 每日 21:00/);
  assert.equal(JSON.stringify(diagnostics).includes('<#'), false);
});

test('buildGuildDiagnostics identifies missing channels and AI environment settings', () => {
  const diagnostics = buildGuildDiagnostics({
    settings: createSettings({ steam_deal_time: 'tomorrow', steam_free_time: 'later' }),
    aiSettings: { model: 'gemini-2.5-flash-lite' },
    reactionRoles: [{ channel_id: 'deleted-role-channel' }],
    availableChannelIds: new Set(['welcome', 'deals']),
  });

  assert.equal(byLabel(diagnostics, 'AI 設定').status, '設定異常');
  assert.equal(byLabel(diagnostics, '日誌記錄').status, '設定異常');
  assert.equal(byLabel(diagnostics, '環境變數').status, '設定異常');
  assert.equal(byLabel(diagnostics, '按鈕身分組').status, '設定異常');
  assert.equal(byLabel(diagnostics, 'Steam 特價推播').status, '設定異常');
  assert.equal(byLabel(diagnostics, 'Steam 限時免費推播').status, '設定異常');
});

test('buildGuildDiagnostics distinguishes optional features that are not configured', () => {
  const diagnostics = buildGuildDiagnostics({
    settings: createSettings({
      welcome_channel: null,
      log_channel: null,
      selfrole_roles: '[]',
      steam_deal_channel: null,
      steam_deal_enabled: 0,
      steam_free_channel: null,
      steam_free_enabled: 0,
    }),
    aiSettings: { model: 'gemini-2.5-flash-lite' },
    hasDiscordToken: true,
    hasGoogleAiKey: true,
    hasAiAdminPassword: true,
  });

  assert.equal(byLabel(diagnostics, '日誌記錄').status, '未設定');
  assert.equal(byLabel(diagnostics, '歡迎訊息').status, '未設定');
  assert.equal(byLabel(diagnostics, '自助身分組').status, '未設定');
  assert.equal(byLabel(diagnostics, '按鈕身分組').status, '未設定');
  assert.equal(byLabel(diagnostics, 'Steam 特價推播').status, '未設定');
  assert.equal(byLabel(diagnostics, 'Steam 限時免費推播').status, '未設定');
});

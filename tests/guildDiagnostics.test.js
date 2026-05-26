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
    availableChannelIds: new Set(['welcome', 'logs', 'deals', 'roles']),
    hasDiscordToken: true,
    hasGoogleAiKey: true,
    hasAiAdminPassword: true,
  });

  assert.equal(diagnostics.every((item) => item.status === '正常'), true);
});

test('buildGuildDiagnostics identifies missing channels and AI environment settings', () => {
  const diagnostics = buildGuildDiagnostics({
    settings: createSettings({ steam_deal_time: 'tomorrow' }),
    aiSettings: { model: 'gemini-2.5-flash-lite' },
    reactionRoles: [{ channel_id: 'deleted-role-channel' }],
    availableChannelIds: new Set(['welcome', 'deals']),
  });

  assert.equal(byLabel(diagnostics, '國王智慧核心').status, '設定異常');
  assert.equal(byLabel(diagnostics, '史官日誌').status, '設定異常');
  assert.equal(byLabel(diagnostics, '大內環境配置').status, '設定異常');
  assert.equal(byLabel(diagnostics, '皇家反應身分站').status, '設定異常');
  assert.equal(byLabel(diagnostics, '皇家採購推播').status, '設定異常');
});

test('buildGuildDiagnostics distinguishes optional features that are not configured', () => {
  const diagnostics = buildGuildDiagnostics({
    settings: createSettings({
      welcome_channel: null,
      log_channel: null,
      selfrole_roles: '[]',
      steam_deal_channel: null,
      steam_deal_enabled: 0,
    }),
    aiSettings: { model: 'gemini-2.5-flash-lite' },
    hasDiscordToken: true,
    hasGoogleAiKey: true,
    hasAiAdminPassword: true,
  });

  assert.equal(byLabel(diagnostics, '史官日誌').status, '未設定');
  assert.equal(byLabel(diagnostics, '皇家迎賓佈告').status, '未設定');
  assert.equal(byLabel(diagnostics, '皇家自助身分領取').status, '未設定');
  assert.equal(byLabel(diagnostics, '皇家反應身分站').status, '未設定');
  assert.equal(byLabel(diagnostics, '皇家採購推播').status, '未設定');
});

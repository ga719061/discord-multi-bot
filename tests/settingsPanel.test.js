import test from 'node:test';
import assert from 'node:assert/strict';
import { ButtonStyle, ComponentType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { data, settingsViewTesting } from '../src/commands/admin/settings.js';
import { ephemeralV2Payload } from '../src/utils/componentsV2.js';
import { getAiSettings, initDatabase, updateAiSetting } from '../src/utils/database.js';
import { normalizeSelfRoleSettings } from '../src/utils/roleSettings.js';

test('/設定 is restricted to Administrator by command metadata', () => {
  const command = data.toJSON();
  assert.equal(command.name, '設定');
  assert.equal(command.default_member_permissions, String(PermissionFlagsBits.Administrator));
});

test('confirmation page is private Components V2 UI with confirm and cancel actions', () => {
  const context = { userId: 'admin', pending: { confirm: 'steam_publish' } };
  const view = settingsViewTesting.renderConfirm(context);
  const payload = ephemeralV2Payload(view.components);
  const panel = view.components[0].toJSON();
  const buttons = panel.components
    .filter((component) => component.type === ComponentType.ActionRow)
    .flatMap((row) => row.components);

  assert.equal((payload.flags & MessageFlags.Ephemeral) !== 0, true);
  assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
  assert.deepEqual(buttons.map((button) => button.label), ['確認執行', '取消']);
  assert.match(JSON.stringify(panel), /Steam/);
});

test('self-role settings normalize legacy string entries and preserve requirements', () => {
  assert.deepEqual(normalizeSelfRoleSettings('["role-a"]'), [{ id: 'role-a', requirement: null }]);
  assert.deepEqual(
    normalizeSelfRoleSettings('[{"id":"role-b","requirement":"role-required"}]'),
    [{ id: 'role-b', requirement: 'role-required' }]
  );
});

test('announcement page includes publishing target and mutually exclusive mention controls', () => {
  const context = {
    userId: 'admin',
    pending: {},
  };
  const view = settingsViewTesting.renderAnnouncement(context);
  const text = JSON.stringify(view.components[0].toJSON());

  assert.match(text, /發布公告/);
  assert.match(text, /提及模式/);
  assert.match(text, /announce_mention/);
  assert.match(text, /announce_role/);
  assert.match(text, /返回總覽/);
});

test('locked AI page provides control-center verification with a primary login action', () => {
  initDatabase();
  const guildId = `settings-ai-locked-${process.pid}`;
  updateAiSetting(guildId, 'admin_ids', '[]');
  const previousPassword = process.env.AI_ADMIN_PASSWORD;
  process.env.AI_ADMIN_PASSWORD = 'royal-secret';

  try {
    const context = { userId: 'admin', guild: { id: guildId }, view: 'ai', pending: {}, notice: null };
    const panel = settingsViewTesting.renderAi(context).components[0].toJSON();
    const buttons = panel.components
      .filter((component) => component.type === ComponentType.ActionRow)
      .flatMap((row) => row.components);
    const loginButton = buttons.find((button) => button.label === '輸入管理密碼');
    const modal = settingsViewTesting.buildModal(context, 'ai_unlock').toJSON();

    assert.match(JSON.stringify(panel), /AI 存取驗證/);
    assert.equal(JSON.stringify(panel).includes('智慧登入'), false);
    assert.equal(loginButton.style, ButtonStyle.Primary);
    assert.match(JSON.stringify(modal), /password/);
  } finally {
    if (previousPassword === undefined) delete process.env.AI_ADMIN_PASSWORD;
    else process.env.AI_ADMIN_PASSWORD = previousPassword;
  }
});

test('AI unlock modal grants persistent access and renders state-aware button colors', async () => {
  initDatabase();
  const guildId = `settings-ai-success-${process.pid}`;
  updateAiSetting(guildId, 'admin_ids', '[]');
  const previousPassword = process.env.AI_ADMIN_PASSWORD;
  process.env.AI_ADMIN_PASSWORD = 'royal-secret';
  let updated;

  const context = { userId: 'admin', guild: { id: guildId }, view: 'ai', pending: {}, notice: null };
  const submit = {
    user: { id: 'admin' },
    memberPermissions: { has: () => true },
    fields: { getTextInputValue: () => 'royal-secret' },
    update: async (payload) => { updated = payload; },
  };
  const component = {
    showModal: async () => {},
    awaitModalSubmit: async () => submit,
  };

  try {
    await settingsViewTesting.openModal(component, context, 'ai_unlock');
    const text = JSON.stringify(updated.components[0].toJSON());
    const buttons = updated.components[0].toJSON().components
      .filter((child) => child.type === ComponentType.ActionRow)
      .flatMap((row) => row.components);

    assert.equal(getAiSettings(guildId).admin_ids.includes('admin'), true);
    assert.match(text, /身分驗證成功/);
    assert.match(text, /AI 設定/);
    assert.equal(buttons.find((button) => button.label === '開啟聯網').style, ButtonStyle.Success);
    assert.equal(buttons.find((button) => button.label === '關閉記憶').style, ButtonStyle.Secondary);
    assert.equal(buttons.find((button) => button.label === '啟動派對').style, ButtonStyle.Danger);
  } finally {
    if (previousPassword === undefined) delete process.env.AI_ADMIN_PASSWORD;
    else process.env.AI_ADMIN_PASSWORD = previousPassword;
  }
});

test('AI unlock modal keeps invalid credentials locked and presents a denied status', async () => {
  initDatabase();
  const guildId = `settings-ai-denied-${process.pid}`;
  updateAiSetting(guildId, 'admin_ids', '[]');
  const previousPassword = process.env.AI_ADMIN_PASSWORD;
  process.env.AI_ADMIN_PASSWORD = 'royal-secret';
  let updated;

  const context = { userId: 'admin', guild: { id: guildId }, view: 'ai', pending: {}, notice: null };
  const submit = {
    user: { id: 'admin' },
    memberPermissions: { has: () => true },
    fields: { getTextInputValue: () => 'wrong-secret' },
    update: async (payload) => { updated = payload; },
  };

  try {
    await settingsViewTesting.openModal({
      showModal: async () => {},
      awaitModalSubmit: async () => submit,
    }, context, 'ai_unlock');
    const text = JSON.stringify(updated.components[0].toJSON());

    assert.equal(getAiSettings(guildId).admin_ids.includes('admin'), false);
    assert.match(text, /管理密碼錯誤/);
    assert.match(text, /AI 存取驗證/);
  } finally {
    if (previousPassword === undefined) delete process.env.AI_ADMIN_PASSWORD;
    else process.env.AI_ADMIN_PASSWORD = previousPassword;
  }
});

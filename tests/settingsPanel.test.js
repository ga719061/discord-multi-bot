import test from 'node:test';
import assert from 'node:assert/strict';
import { ButtonStyle, ComponentType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { data, settingsViewTesting } from '../src/commands/admin/settings.js';
import { ephemeralV2Payload } from '../src/utils/componentsV2.js';
import { getAiSettings, getDb, initDatabase, updateAiSetting } from '../src/utils/database.js';
import { AI_MODELS, DEFAULT_AI_MODEL } from '../src/utils/aiConfig.js';
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

test('settings custom ids preserve the existing wire format and owner checks', () => {
  const context = { userId: 'admin' };
  const viewId = settingsViewTesting.id(context, 'view:steam');

  assert.equal(settingsViewTesting.id(context, 'ai_model'), 'settings:admin:ai_model');
  assert.equal(viewId, 'settings:admin:view:steam');
  assert.deepEqual(settingsViewTesting.parseSettingsCustomId(viewId, context), ['view', 'steam']);
  assert.equal(settingsViewTesting.parseSettingsCustomId(viewId, { userId: 'other' }), null);
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

test('settings home health overview uses neutral admin wording', async () => {
  initDatabase();
  const guildId = `settings-home-neutral-${process.pid}`;
  const context = {
    userId: 'admin',
    guild: {
      id: guildId,
      name: 'Test Server',
      channels: { fetch: async () => null },
    },
    pending: {},
    notice: null,
  };

  const view = await settingsViewTesting.renderHome(context);
  const text = JSON.stringify(view.components[0].toJSON());

  assert.match(text, /Test Server 管理控制台/);
  assert.match(text, /伺服器健康總覽/);
  assert.match(text, /修正建議/);
  assert.match(text, /功能設定/);
  assert.match(text, /管理工具/);
  assert.equal(text.includes('本王'), false);
  assert.equal(text.includes('領地健康總覽'), false);
  assert.equal(text.includes('御前修正建議'), false);
});

test('Steam panel exposes independent limited-free push controls', () => {
  initDatabase();
  const guildId = `settings-steam-free-${process.pid}`;
  const context = { userId: 'admin', guild: { id: guildId }, view: 'steam', pending: {}, notice: null };
  const panel = settingsViewTesting.renderSteam(context).components[0].toJSON();
  const text = JSON.stringify(panel);
  const actionIds = panel.components
    .filter((component) => component.type === ComponentType.ActionRow)
    .flatMap((row) => row.components)
    .map((component) => component.custom_id)
    .filter(Boolean);
  const modal = settingsViewTesting.buildModal(context, 'steam_free_time').toJSON();

  assert.match(text, /Steam 限時免費/);
  assert.equal(actionIds.some((id) => id.includes('steam_channel')), true);
  assert.equal(actionIds.some((id) => id.includes('steam_free_channel')), true);
  assert.equal(actionIds.some((id) => id.includes('steam_free_toggle:on')), true);
  assert.equal(actionIds.some((id) => id.includes('prepare_confirm:steam_free_publish')), true);
  assert.match(JSON.stringify(modal), /steam_free_time/);
});

test('confirmation page describes limited-free Steam publish action', () => {
  const context = { userId: 'admin', pending: { confirm: 'steam_free_publish' } };
  const view = settingsViewTesting.renderConfirm(context);
  const text = JSON.stringify(view.components[0].toJSON());

  assert.match(text, /Steam 限時免費/);
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

test('AI model selector uses approved models and migrates previous preview choices', () => {
  initDatabase();
  const guildId = `settings-ai-models-${process.pid}`;
  updateAiSetting(guildId, 'admin_ids', JSON.stringify(['admin']));

  getDb().prepare('UPDATE ai_settings SET model = ? WHERE guild_id = ?').run('gemini-3-flash-preview', guildId);
  assert.equal(getAiSettings(guildId).model, DEFAULT_AI_MODEL);

  getDb().prepare('UPDATE ai_settings SET model = ? WHERE guild_id = ?').run('gemini-3.1-flash-lite-preview', guildId);
  assert.equal(getAiSettings(guildId).model, 'gemini-3.1-flash-lite');

  const context = { userId: 'admin', guild: { id: guildId }, view: 'ai', pending: {}, notice: null };
  const panelText = JSON.stringify(settingsViewTesting.renderAi(context).components[0].toJSON());

  for (const model of AI_MODELS) {
    assert.equal(panelText.includes(`"value":"${model}"`), true);
  }
  assert.equal(panelText.includes('"value":"gemini-3-flash-preview"'), false);
  assert.equal(panelText.includes('"value":"gemini-3.1-flash-lite-preview"'), false);
});

test('AI panel displays whitelist members beside its whitelist controls', () => {
  initDatabase();
  const guildId = `settings-ai-whitelist-${process.pid}`;
  const whitelist = [...Array.from({ length: 21 }, (_, index) => String(1000 + index)), '1000'];
  updateAiSetting(guildId, 'admin_ids', JSON.stringify(['admin']));
  updateAiSetting(guildId, 'whitelist', JSON.stringify(whitelist));

  const context = {
    userId: 'admin',
    guild: { id: guildId },
    view: 'ai',
    pending: { aiUser: '2000' },
    notice: null,
  };
  const panelText = JSON.stringify(settingsViewTesting.renderAi(context).components[0].toJSON());

  assert.match(panelText, /ACCESS LIST \| 御准白名單成員/);
  assert.match(panelText, /御准白名單：21 人/);
  assert.match(panelText, /<@1000>/);
  assert.match(panelText, /<@1019>/);
  assert.equal(panelText.includes('<@1020>'), false);
  assert.match(panelText, /另有 1 人未展開顯示/);
  assert.match(panelText, /目前選取：<@2000>/);
});

test('self-role panel presents a royal publishing flow for member-facing role selection', () => {
  initDatabase();
  const guildId = `settings-self-role-${process.pid}`;
  const guild = {
    id: guildId,
    roles: { cache: new Map([['games', { id: 'games' }]]) },
  };
  const context = { userId: 'admin', guild, view: 'selfrole', pending: {}, notice: null };
  const text = JSON.stringify(settingsViewTesting.renderSelfRole(context).components[0].toJSON());

  assert.match(text, /皇家自助身分領取/);
  assert.match(text, /可供子民領取/);
  assert.match(text, /張貼領取佈告/);
});

test('published self-role menu speaks to members as the royal receiving office', () => {
  const role = {
    id: 'games',
    name: '遊戲子民',
    managed: false,
    position: 1,
    permissions: { has: () => false },
  };
  const guild = {
    id: 'guild',
    roles: { cache: new Map([[role.id, role]]) },
    members: {
      me: {
        permissions: { has: () => true },
        roles: { highest: { position: 10 } },
      },
    },
  };
  const payload = settingsViewTesting.buildSelfRoleMenuPayload(guild, [{ id: role.id, requirement: null }], null);
  const text = JSON.stringify(payload.components[0].toJSON());

  assert.match(text, /皇家自助身分領取處/);
  assert.match(text, /子民請從下方選單挑選/);
  assert.match(text, /領取或交還 遊戲子民/);
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

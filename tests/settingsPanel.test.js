import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ButtonStyle, ChannelType, Collection, ComponentType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { data, settingsViewTesting } from '../src/commands/admin/settings.js';
import { countV2Components, ephemeralV2Payload } from '../src/utils/componentsV2.js';
import { getAiSettings, getDb, getGuildSettings, updateAiSetting, updateGuildSetting } from '../src/utils/database.js';
import { AI_MODELS, DEFAULT_AI_MODEL } from '../src/utils/aiConfig.js';
import { normalizeSelfRoleSettings } from '../src/utils/roleSettings.js';
import { cleanupTestDatabase, initTestDatabase } from './helpers/database.js';

afterEach(() => {
  cleanupTestDatabase();
});

function collectComponentText(component) {
  const texts = component.content ? [component.content] : [];
  for (const child of component.components || []) texts.push(...collectComponentText(child));
  if (component.accessory) texts.push(...collectComponentText(component.accessory));
  return texts;
}

function stripAnsi(text) {
  return String(text)
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/```ansi\n?|```/g, '');
}

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

test('welcome settings can be disabled without deleting the custom message', async () => {
  initTestDatabase();
  const guildId = `settings-welcome-disable-${process.pid}`;
  updateGuildSetting(guildId, 'welcome_channel', 'welcome-channel');
  updateGuildSetting(guildId, 'welcome_message', '歡迎 {user}');
  let edited;
  const context = {
    userId: 'admin',
    guild: { id: guildId },
    view: 'welcome',
    pending: {},
    notice: null,
    editResponse: async (payload) => { edited = payload; },
  };
  const before = settingsViewTesting.renderWelcome(context).components[0].toJSON();
  const beforeText = JSON.stringify(before);
  const component = {
    deferred: false,
    replied: false,
    async deferUpdate() { this.deferred = true; },
  };

  assert.match(beforeText, /停用歡迎訊息/);
  assert.ok(countV2Components(settingsViewTesting.renderWelcome(context).components) <= 40);
  await settingsViewTesting.handleButton(component, context, 'welcome_disable');

  const settings = getGuildSettings(guildId);
  assert.equal(settings.welcome_channel, null);
  assert.equal(settings.welcome_message, '歡迎 {user}');
  assert.match(JSON.stringify(edited), /尚未設定/);
  assert.doesNotMatch(JSON.stringify(edited), /停用歡迎訊息/);
});

test('settings custom ids preserve the existing wire format and owner checks', () => {
  const context = { userId: 'admin' };
  const viewId = settingsViewTesting.id(context, 'view:steam');

  assert.equal(settingsViewTesting.id(context, 'ai_model'), 'settings:admin:ai_model');
  assert.equal(viewId, 'settings:admin:view:steam');
  assert.deepEqual(settingsViewTesting.parseSettingsCustomId(viewId, context), ['view', 'steam']);
  assert.equal(settingsViewTesting.parseSettingsCustomId(viewId, { userId: 'other' }), null);
});

test('settings action ids expose their target value for modals and confirmations', () => {
  const context = { userId: 'admin' };
  const modalParts = settingsViewTesting.parseSettingsCustomId(settingsViewTesting.id(context, 'modal:reaction_create'), context);
  const confirmParts = settingsViewTesting.parseSettingsCustomId(settingsViewTesting.id(context, 'prepare_confirm:reaction_create'), context);

  assert.equal(settingsViewTesting.actionValue(modalParts), 'reaction_create');
  assert.equal(settingsViewTesting.actionValue(confirmParts), 'reaction_create');
  assert.equal(settingsViewTesting.confirmationReturnView(settingsViewTesting.actionValue(confirmParts)), 'reaction');
});

test('reaction role pairs accept role mentions, names, ids, commas, and new lines', () => {
  const roles = [
    { id: '111111111111111111', name: '遊戲玩家', managed: false, position: 1, permissions: { has: () => false } },
    { id: '222222222222222222', name: 'Movie Night', managed: false, position: 1, permissions: { has: () => false } },
    { id: '333333333333333333', name: '公告通知', managed: false, position: 1, permissions: { has: () => false } },
  ];
  const guild = {
    id: 'guild',
    roles: { cache: new Map(roles.map((role) => [role.id, role])) },
    members: {
      me: {
        permissions: { has: () => true },
        roles: { highest: { position: 10 } },
      },
    },
  };

  const result = settingsViewTesting.parseReactionPairs(
    guild,
    '🎮:@遊戲玩家\n🍿:Movie Night,📣:<@&333333333333333333>'
  );

  assert.equal(result.error, undefined);
  assert.deepEqual(result.pairs.map((pair) => [pair.emoji, pair.role.id]), [
    ['🎮', '111111111111111111'],
    ['🍿', '222222222222222222'],
    ['📣', '333333333333333333'],
  ]);
});

test('reaction role pairs reject external custom emoji and normalize guild emoji', () => {
  const role = { id: '111111111111111111', name: '遊戲玩家', managed: false, position: 1, permissions: { has: () => false } };
  const guildEmoji = { id: '444444444444444444', name: 'royal', identifier: 'royal:444444444444444444' };
  const emojisCache1 = new Map([[guildEmoji.id, guildEmoji]]);
  emojisCache1.find = (fn) => [...emojisCache1.values()].find(fn);
  const guild = {
    id: 'guild',
    roles: { cache: new Map([[role.id, role]]) },
    emojis: { cache: emojisCache1 },
    members: {
      me: {
        permissions: { has: () => true },
        roles: { highest: { position: 10 } },
      },
    },
  };

  const accepted = settingsViewTesting.parseReactionPairs(guild, '<:royal:444444444444444444>:@遊戲玩家');
  const rejected = settingsViewTesting.parseReactionPairs(guild, '<:other:555555555555555555>:@遊戲玩家');

  assert.equal(accepted.error, undefined);
  assert.equal(accepted.pairs[0].emoji, guildEmoji.identifier);
  assert.match(rejected.error, /不在這個伺服器/);
});

test('reaction-role panel supports selected role plus emoji pair building', async () => {
  initTestDatabase();
  const role = { id: '111111111111111111', name: '遊戲玩家', managed: false, position: 1, permissions: { has: () => false } };
  const emojisCache2 = new Map();
  emojisCache2.find = (fn) => [...emojisCache2.values()].find(fn);
  const guild = {
    id: `settings-reaction-builder-${process.pid}`,
    roles: { cache: new Map([[role.id, role]]) },
    emojis: { cache: emojisCache2 },
    members: {
      me: {
        permissions: { has: () => true },
        roles: { highest: { position: 10 } },
      },
    },
  };
  const context = {
    userId: 'admin',
    guild,
    view: 'reaction',
    pending: { reactionRole: role.id },
    notice: null,
  };
  const panelText = JSON.stringify(settingsViewTesting.renderReaction(context).components[0].toJSON());

  assert.match(panelText, /reaction_role/);
  assert.match(panelText, /reaction_pair_add/);

  await settingsViewTesting.openModal({
    showModal: async () => {},
    awaitModalSubmit: async () => ({
      user: { id: 'admin' },
      memberPermissions: { has: () => true },
      fields: { getTextInputValue: () => '🎮' },
      update: async () => {},
    }),
  }, context, 'reaction_pair_add');

  assert.deepEqual(context.pending.reactionPairs.map((pair) => [pair.emoji, pair.role.id]), [
    ['🎮', role.id],
  ]);
});

test('button-role station renders emoji-only, text-only, and emoji-with-text buttons', () => {
  const roles = [
    { id: '111111111111111111', name: '遊戲玩家' },
    { id: '222222222222222222', name: '公告通知' },
    { id: '333333333333333333', name: '活動通知' },
  ];
  const guild = {
    emojis: { cache: new Map() },
  };

  const payload = settingsViewTesting.buildButtonRoleStationPayload(guild, [
    { emoji: '🎮', label: null, role: roles[0] },
    { emoji: null, label: '公告通知', role: roles[1] },
    { emoji: '📣', label: '活動通知', role: roles[2] },
  ], '測試站');
  const buttons = payload.components
    .map((component) => component.toJSON?.() || component)
    .filter((component) => component.type === 1)
    .flatMap((row) => row.components);

  assert.equal(buttons[0].emoji.name, '🎮');
  assert.equal(buttons[0].label, undefined);
  assert.equal(buttons[1].label, '公告通知');
  assert.equal(buttons[1].emoji, undefined);
  assert.equal(buttons[2].emoji.name, '📣');
  assert.equal(buttons[2].label, '活動通知');
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

test('AI settings page exposes unlocked private draft center', () => {
  initTestDatabase();
  const guildId = `settings-ai-draft-${process.pid}`;
  updateAiSetting(guildId, 'admin_ids', JSON.stringify(['admin']));
  const context = {
    userId: 'admin',
    guild: { id: guildId },
    view: 'ai',
    pending: {},
    notice: null,
  };

  const panel = settingsViewTesting.renderAi(context).components[0].toJSON();
  const text = JSON.stringify(panel);
  const ids = panel.components
    .filter((component) => component.type === ComponentType.ActionRow)
    .flatMap((row) => row.components)
    .map((component) => component.custom_id);

  assert.match(text, /AI 草稿中心/);
  assert.equal(ids.includes('settings:admin:ai_draft_type'), true);
  assert.equal(ids.includes('settings:admin:ai_draft_tone'), true);
  assert.equal(ids.includes('settings:admin:modal:ai_draft'), true);
});

test('AI settings page exposes the core enable toggle and current status', () => {
  initTestDatabase();
  const guildId = `settings-ai-enabled-${process.pid}`;
  updateAiSetting(guildId, 'admin_ids', JSON.stringify(['admin']));
  const context = {
    userId: 'admin',
    guild: { id: guildId },
    view: 'ai',
    pending: {},
    notice: null,
  };

  const disabledPanel = settingsViewTesting.renderAi(context).components[0].toJSON();
  const disabledText = JSON.stringify(disabledPanel);
  const disabledButtons = disabledPanel.components
    .filter((component) => component.type === ComponentType.ActionRow)
    .flatMap((row) => row.components);

  assert.match(disabledText, /智慧核心.+停用/);
  assert.equal(disabledButtons.some((button) =>
    button.custom_id === 'settings:admin:ai_toggle:enabled' && button.label === '啟用 AI 核心'
  ), true);

  updateAiSetting(guildId, 'enabled', 1);
  const enabledView = settingsViewTesting.renderAi(context);
  const enabledPanel = enabledView.components[0].toJSON();
  const enabledText = JSON.stringify(enabledPanel);
  const enabledButtons = enabledPanel.components
    .filter((component) => component.type === ComponentType.ActionRow)
    .flatMap((row) => row.components);

  assert.match(enabledText, /智慧核心.+啟用/);
  assert.equal(enabledButtons.some((button) =>
    button.custom_id === 'settings:admin:ai_toggle:enabled' && button.label === '停用 AI 核心'
  ), true);
  assert.equal(countV2Components(enabledView.components) <= 40, true);
});

test('enabling the AI core clears an expired global deadline', () => {
  initTestDatabase();
  const guildId = `settings-ai-enable-action-${process.pid}`;
  updateAiSetting(guildId, 'enabled', 1);
  updateAiSetting(guildId, 'expires_at', 1);

  assert.equal(settingsViewTesting.toggleAiSetting(guildId, 'enabled'), 1);
  assert.equal(getAiSettings(guildId).enabled, 1);
  assert.equal(getAiSettings(guildId).expires_at, null);

  assert.equal(settingsViewTesting.toggleAiSetting(guildId, 'enabled'), 0);
  assert.equal(getAiSettings(guildId).enabled, 0);
});

test('AI reference sources are hidden by default and can be enabled independently', () => {
  initTestDatabase();
  const guildId = `settings-ai-citations-${process.pid}`;
  updateAiSetting(guildId, 'admin_ids', JSON.stringify(['admin']));
  const context = {
    userId: 'admin',
    guild: { id: guildId },
    view: 'ai',
    pending: {},
    notice: null,
  };

  assert.equal(getAiSettings(guildId).citations_enabled, false);
  const hiddenView = settingsViewTesting.renderAi(context);
  const hiddenPanel = hiddenView.components[0].toJSON();
  const hiddenText = JSON.stringify(hiddenPanel);
  const hiddenButtons = hiddenPanel.components
    .filter((component) => component.type === ComponentType.ActionRow)
    .flatMap((row) => row.components);
  assert.match(hiddenText, /顯示參考來源.+關閉/);
  assert.equal(hiddenButtons.some((button) =>
    button.custom_id === 'settings:admin:ai_toggle:citations_enabled'
      && button.label === '顯示來源'
  ), true);

  assert.equal(settingsViewTesting.toggleAiSetting(guildId, 'citations_enabled'), 1);
  assert.equal(getAiSettings(guildId).citations_enabled, true);
  const visibleView = settingsViewTesting.renderAi(context);
  const visiblePanel = visibleView.components[0].toJSON();
  const visibleButtons = visiblePanel.components
    .filter((component) => component.type === ComponentType.ActionRow)
    .flatMap((row) => row.components);
  assert.equal(visibleButtons.some((button) =>
    button.custom_id === 'settings:admin:ai_toggle:citations_enabled'
      && button.label === '隱藏來源'
  ), true);
  assert.equal(countV2Components(visibleView.components) <= 40, true);
});

test('AI action tools are disabled by default and have an independent bounded toggle', () => {
  initTestDatabase();
  const guildId = `settings-ai-action-tools-${process.pid}`;
  updateAiSetting(guildId, 'admin_ids', JSON.stringify(['admin']));
  const context = {
    userId: 'admin',
    guild: { id: guildId },
    view: 'ai',
    pending: {},
    notice: null,
  };

  assert.equal(getAiSettings(guildId).action_tools_enabled, false);
  const disabledView = settingsViewTesting.renderAi(context);
  const disabledPanel = disabledView.components[0].toJSON();
  const disabledRows = disabledPanel.components
    .filter((component) => component.type === ComponentType.ActionRow);
  const disabledButton = disabledRows
    .flatMap((row) => row.components)
    .find((button) => button.custom_id === 'settings:admin:ai_toggle:action_tools_enabled');

  assert.match(JSON.stringify(disabledPanel), /AI 操作工具.+停用/);
  assert.equal(disabledButton?.label, '啟用 AI 操作');
  assert.equal(disabledRows.every((row) => row.components.length <= 5), true);
  assert.equal(countV2Components(disabledView.components) <= 40, true);

  assert.equal(settingsViewTesting.toggleAiSetting(guildId, 'action_tools_enabled'), 1);
  assert.equal(getAiSettings(guildId).action_tools_enabled, true);
  const enabledView = settingsViewTesting.renderAi(context);
  const enabledPanel = enabledView.components[0].toJSON();
  const enabledRows = enabledPanel.components
    .filter((component) => component.type === ComponentType.ActionRow);
  const enabledButton = enabledRows
    .flatMap((row) => row.components)
    .find((button) => button.custom_id === 'settings:admin:ai_toggle:action_tools_enabled');

  assert.equal(enabledButton?.label, '停用 AI 操作');
  assert.equal(enabledRows.every((row) => row.components.length <= 5), true);
  assert.equal(countV2Components(enabledView.components) <= 40, true);
});

test('AI party activation restores previous settings when its public notice fails', async () => {
  initTestDatabase();
  const guildId = `settings-ai-party-compensation-${process.pid}`;
  updateAiSetting(guildId, 'enabled', 0);
  updateAiSetting(guildId, 'party_channel_id', 'previous-channel');
  updateAiSetting(guildId, 'party_expires_at', 123456789);
  const guild = {
    id: guildId,
    channels: {
      fetch: async () => ({
        isTextBased: () => true,
        send: async () => { throw new Error('Discord send failed'); },
      }),
    },
  };

  await assert.rejects(
    settingsViewTesting.startAiParty(guild, 'new-channel', 30),
    /Discord send failed/
  );

  const settings = getAiSettings(guildId);
  assert.equal(settings.enabled, 0);
  assert.equal(settings.party_channel_id, 'previous-channel');
  assert.equal(settings.party_expires_at, 123456789);
});

test('AI announcement draft panel offers preview controls only after a draft exists', () => {
  initTestDatabase();
  const guildId = `settings-ai-announcement-draft-${process.pid}`;
  updateAiSetting(guildId, 'admin_ids', JSON.stringify(['admin']));
  const context = {
    userId: 'admin',
    guild: { id: guildId },
    view: 'ai',
    pending: {
      aiDraft: {
        type: 'announcement',
        title: '維護通知',
        content: '今晚維護，請大家提前下線。',
        footer: '感謝配合',
        tone: 'formal',
        sourceBrief: '今晚維護',
        generatedAt: Date.now(),
      },
    },
    notice: null,
  };

  const panel = settingsViewTesting.renderAi(context).components[0].toJSON();
  const text = JSON.stringify(panel);
  const view = settingsViewTesting.renderAi(context);

  assert.match(text, /建立公告預覽/);
  assert.match(text, /ai_draft_channel/);
  assert.match(text, /ai_draft_mention/);
  assert.match(text, /尚未發布或寫入設定|建立預覽後仍需按/);
  assert.equal(countV2Components(view.components) <= 40, true);
});

test('welcome modal uses AI private draft as a prefilled setting draft', () => {
  initTestDatabase();
  const guildId = `settings-ai-welcome-draft-${process.pid}`;
  const context = {
    userId: 'admin',
    guild: { id: guildId },
    pending: { welcomeMessageDraft: '歡迎 {user} 來到伺服器！' },
  };

  const modal = settingsViewTesting.buildModal(context, 'welcome_message').toJSON();
  const field = modal.components[0];

  assert.match(JSON.stringify(modal), /歡迎 \{user\} 來到伺服器/);
  assert.equal(field.type, ComponentType.Label);
  assert.equal(field.label, '迎賓內容');
  assert.match(field.description, /留空會恢復預設/);
  assert.equal(field.component.type, ComponentType.TextInput);
  assert.equal(field.component.custom_id, 'value');
});

test('all settings text modals use descriptive label components', () => {
  initTestDatabase();
  const context = {
    userId: 'admin',
    guild: { id: `settings-modal-labels-${process.pid}` },
    pending: {},
  };
  const modalTypes = [
    'welcome_message', 'steam_time', 'steam_free_time', 'self_description',
    'reaction_create', 'reaction_pair_add', 'reaction_title', 'ai_unlock',
    'ai_prompt', 'ai_draft', 'ai_party',
  ];

  for (const type of modalTypes) {
    const modal = settingsViewTesting.buildModal(context, type).toJSON();
    assert.equal(modal.components.every((field) => field.type === ComponentType.Label), true, type);
    assert.equal(modal.components.every((field) => field.description?.length > 0), true, type);
    assert.equal(modal.components.every((field) => field.component?.type === ComponentType.TextInput), true, type);
  }
});

test('settings home health overview uses neutral admin wording', async () => {
  initTestDatabase();
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
  const panel = view.components[0].toJSON();
  const text = JSON.stringify(panel);
  const visibleText = collectComponentText(panel).join('\n');
  const rows = panel.components.filter((component) => component.type === ComponentType.ActionRow);
  const viewSelect = rows
    .flatMap((row) => row.components)
    .find((component) => component.custom_id === 'settings:admin:view_select');

  assert.match(text, /Test Server 管理控制台/);
  assert.match(text, /伺服器健康總覽/);
  assert.match(visibleText, /```ansi/);
  assert.equal(visibleText.includes('\u001b'), true);
  assert.match(stripAnsi(visibleText), /\[健康\] .+/);
  assert.match(stripAnsi(visibleText), /\[已設定\] \d+ 個模組運作正常/);
  assert.match(stripAnsi(visibleText), /\[未啟用\] \d+ 個模組尚未設定/);
  assert.match(stripAnsi(visibleText), /\[待處理\] \d+ 個模組設定異常/);
  assert.match(text, /修正建議/);
  assert.match(text, /功能設定/);
  assert.match(text, /管理工具/);
  assert.equal(viewSelect.type, ComponentType.StringSelect);
  assert.deepEqual(viewSelect.options.map((option) => option.value), [
    'welcome', 'logging', 'leveling', 'steam', 'selfrole', 'reaction', 'ai',
  ]);
  assert.equal(rows.flatMap((row) => row.components).some((component) => component.custom_id === 'settings:admin:view:welcome'), false);
  assert.equal(countV2Components(view.components) <= 40, true);
  assert.equal(text.includes('本王'), false);
  assert.equal(text.includes('領地健康總覽'), false);
  assert.equal(text.includes('御前修正建議'), false);
});

test('settings function selector routes to the selected existing view', async () => {
  initTestDatabase();
  const guildId = `settings-view-select-${process.pid}`;
  let edited;
  const context = {
    userId: 'admin',
    guild: { id: guildId },
    view: 'home',
    pending: { confirm: 'steam_publish' },
    notice: 'old notice',
    editResponse: async (payload) => { edited = payload; },
  };
  const component = {
    values: ['welcome'],
    deferred: false,
    replied: false,
    async deferUpdate() { this.deferred = true; },
  };

  await settingsViewTesting.handleStringSelect(component, context, 'view_select');

  assert.equal(context.view, 'welcome');
  assert.equal(context.pending.confirm, null);
  assert.equal(context.notice, null);
  assert.match(JSON.stringify(edited), /歡迎訊息/);
});

test('settings notices remain complete Markdown outside the compact ANSI summary', () => {
  initTestDatabase();
  const notice = 'AI 歡迎訊息草稿已帶入設定欄位，請檢查內容並確認後儲存。';
  const view = settingsViewTesting.renderWelcome({
    userId: 'admin',
    guild: { id: `settings-notice-${process.pid}` },
    pending: {},
    notice,
  });
  const panel = view.components[0].toJSON();
  const rawText = collectComponentText(panel).join('\n');

  assert.equal((rawText.match(/```ansi/g) || []).length, 1);
  assert.equal(stripAnsi(rawText).includes(`[已儲存] ${notice}`), false);
  assert.match(rawText, new RegExp(`> \\*\\*已儲存\\*\\* — ${notice}`));
});

test('settings pages stay within component and button-style limits', async () => {
  initTestDatabase();
  const guildId = `settings-component-limits-${process.pid}`;
  updateAiSetting(guildId, 'admin_ids', JSON.stringify(['admin']));
  const guild = {
    id: guildId,
    name: 'Test Server',
    channels: {
      cache: new Collection([
        ['text', { id: 'text', type: ChannelType.GuildText }],
        ['voice', { id: 'voice', type: ChannelType.GuildVoice }],
      ]),
      fetch: async () => null,
    },
    roles: { cache: new Collection() },
    emojis: { cache: new Collection() },
    members: { fetch: async () => null },
    fetchOwner: async () => null,
    iconURL: () => null,
    memberCount: 0,
    createdTimestamp: Date.now(),
    premiumTier: 0,
    premiumSubscriptionCount: 0,
    preferredLocale: 'zh-TW',
    features: [],
    verificationLevel: 0,
    explicitContentFilter: 0,
  };
  const client = { ws: { ping: 25 }, guilds: { cache: new Collection([[guildId, guild]]) } };
  const views = [
    'home', 'welcome', 'logging', 'leveling', 'steam', 'selfrole', 'reaction',
    'ai', 'serverinfo', 'botstatus', 'announcement', 'member', 'confirm',
  ];
  const summaryLabels = {
    home: '健康',
    welcome: '狀態',
    logging: '頻道',
    leveling: '晉升公告',
    steam: '特價榜',
    selfrole: '領取選項',
    reaction: '公開站點',
    ai: '智慧核心',
    serverinfo: '健康',
    botstatus: '系統',
    announcement: '發布頻道',
    member: '查詢狀態',
  };

  for (const viewName of views) {
    const context = {
      userId: 'admin', guild, client, view: viewName, pending: {}, notice: null,
    };
    if (viewName === 'confirm') context.pending.confirm = 'steam_publish';
    const view = await settingsViewTesting.renderView(context);
    const panel = view.components[0].toJSON();
    const rows = panel.components.filter((component) => component.type === ComponentType.ActionRow);

    assert.equal(countV2Components(view.components) <= 40, true, viewName);
    if (viewName !== 'confirm') {
      const rawText = collectComponentText(panel).join('\n');
      const readableText = stripAnsi(rawText);
      assert.equal((rawText.match(/```ansi/g) || []).length, 1, `${viewName} ANSI block count`);
      assert.equal(rawText.includes('\u001b'), true, `${viewName} ANSI escape`);
      assert.match(readableText, new RegExp(`\\[${summaryLabels[viewName]}\\] [^\\n]+`), viewName);
    }
    for (const row of rows) {
      const buttons = row.components.filter((component) => component.type === ComponentType.Button);
      assert.equal(buttons.filter((button) => button.style === ButtonStyle.Primary).length <= 1, true, viewName);
      for (const button of buttons.filter((item) => item.style === ButtonStyle.Danger)) {
        assert.equal(button.custom_id, 'settings:admin:confirm', viewName);
      }
    }
  }
});

test('Steam panel exposes independent limited-free push controls', () => {
  initTestDatabase();
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
  assert.match(text, /立即更新免費情報/);
  assert.equal(actionIds.some((id) => id.includes('steam_channel')), true);
  assert.equal(actionIds.some((id) => id.includes('steam_free_channel')), true);
  assert.equal(actionIds.some((id) => id.includes('steam_free_toggle:on')), true);
  assert.equal(actionIds.some((id) => id.includes('prepare_confirm:steam_free_publish')), true);
  assert.match(JSON.stringify(modal), /steam_free_time/);
});

test('disabling Steam free updates marks the managed board as paused', async () => {
  initTestDatabase();
  const guildId = `settings-steam-free-disable-${process.pid}`;
  updateGuildSetting(guildId, 'steam_free_enabled', 1);
  getDb().prepare(`
    INSERT INTO steam_free_boards (
      guild_id, channel_id, message_id, snapshot_json, last_refresh_date, last_checked_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    guildId,
    'free-channel',
    'board-message',
    JSON.stringify([{ id: 42, name: 'Free Game', discount_percent: 100, original_price: 50000, final_price: 0 }]),
    '2026-08-08',
    Date.now()
  );
  let boardEdit;
  let panelEdit;
  const message = { edit: async (payload) => { boardEdit = payload; } };
  const context = {
    userId: 'admin',
    guild: {
      id: guildId,
      channels: {
        fetch: async (channelId) => channelId === 'free-channel'
          ? { messages: { fetch: async () => message } }
          : null,
      },
    },
    view: 'steam',
    pending: {},
    notice: null,
    editResponse: async (payload) => { panelEdit = payload; },
  };
  const component = {
    deferred: false,
    replied: false,
    async deferUpdate() { this.deferred = true; },
  };

  await settingsViewTesting.handleButton(component, context, 'steam_free_toggle', 'off');

  assert.equal(getGuildSettings(guildId).steam_free_enabled, 0);
  assert.match(JSON.stringify(boardEdit), /自動更新已停用/);
  assert.match(JSON.stringify(panelEdit), /自動更新已停用/);
});

test('confirmation page describes limited-free Steam publish action', () => {
  const context = { userId: 'admin', pending: { confirm: 'steam_free_publish' } };
  const view = settingsViewTesting.renderConfirm(context);
  const text = JSON.stringify(view.components[0].toJSON());

  assert.match(text, /Steam 限時免費/);
  assert.match(text, /有新遊戲時建立新版並刪除舊帖/);
});

test('Steam free board notice reports an empty board moved to a new channel', () => {
  const notice = settingsViewTesting.steamFreeBoardNotice({ status: 'empty', action: 'moved' });

  assert.match(notice, /搬遷到新頻道/);
});

test('Steam free board notice warns when an old post could not be deleted', () => {
  const notice = settingsViewTesting.steamFreeBoardNotice({
    status: 'published',
    previousMessageDeleted: false,
  });

  assert.equal(notice.tone, 'warning');
  assert.match(notice.text, /無法刪除舊帖/);
});

test('locked AI page provides control-center verification with a primary login action', () => {
  initTestDatabase();
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
  initTestDatabase();
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
    assert.match(text, /聯網檢索可能執行多次計費查詢/);
    assert.equal(buttons.find((button) => button.label === '開啟聯網').style, ButtonStyle.Success);
    assert.equal(buttons.find((button) => button.label === '關閉記憶').style, ButtonStyle.Secondary);
    assert.equal(buttons.find((button) => button.label === '啟動派對').style, ButtonStyle.Secondary);
  } finally {
    if (previousPassword === undefined) delete process.env.AI_ADMIN_PASSWORD;
    else process.env.AI_ADMIN_PASSWORD = previousPassword;
  }
});

test('AI model selector uses the two approved models and migrates legacy choices by tier', () => {
  initTestDatabase();
  const guildId = `settings-ai-models-${process.pid}`;
  updateAiSetting(guildId, 'admin_ids', JSON.stringify(['admin']));

  assert.equal(DEFAULT_AI_MODEL, 'gemini-3.8-flash');
  assert.deepEqual(AI_MODELS, ['gemini-3.8-flash', 'gemini-3.5-flash-lite']);

  const migrations = [
    ['gemini-3.7-flash', 'gemini-3.8-flash'],
    ['gemini-3.6-flash', 'gemini-3.8-flash'],
    ['gemini-3.5-flash', 'gemini-3.8-flash'],
    ['gemini-3.1-pro-preview', 'gemini-3.8-flash'],
    ['gemini-2.5-flash', 'gemini-3.8-flash'],
    ['gemini-3-flash-preview', 'gemini-3.8-flash'],
    ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'],
    ['gemini-2.5-flash-lite', 'gemini-3.5-flash-lite'],
    ['gemini-3.1-flash-lite-preview', 'gemini-3.5-flash-lite'],
    [null, DEFAULT_AI_MODEL],
    ['gemini-unknown', DEFAULT_AI_MODEL],
  ];

  for (const [storedModel, expectedModel] of migrations) {
    getDb().prepare('UPDATE ai_settings SET model = ? WHERE guild_id = ?').run(storedModel, guildId);
    assert.equal(getAiSettings(guildId).model, expectedModel, String(storedModel));
    assert.equal(
      getDb().prepare('SELECT model FROM ai_settings WHERE guild_id = ?').get(guildId).model,
      expectedModel,
      `${storedModel} should be persisted`
    );
  }

  const context = { userId: 'admin', guild: { id: guildId }, view: 'ai', pending: {}, notice: null };
  const panelText = JSON.stringify(settingsViewTesting.renderAi(context).components[0].toJSON());

  for (const model of AI_MODELS) {
    assert.equal(panelText.includes(`"value":"${model}"`), true);
  }
  for (const [legacyModel] of migrations.filter(([model]) => model)) {
    assert.equal(panelText.includes(`"value":"${legacyModel}"`), false);
  }
});

test('AI panel displays whitelist members beside its whitelist controls', () => {
  initTestDatabase();
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
  initTestDatabase();
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
  initTestDatabase();
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

test('selfrole_select expectedRoleIds calculation and prerequisite check', () => {
  const allowedRoles = [
    { id: 'dependent-role', requirement: 'prereq-role' },
    { id: 'prereq-role', requirement: null }
  ];
  const allowedRoleIds = allowedRoles.map(entry => entry.id);

  // 當前成員擁有的角色，包含 prereq 和 dependent
  const currentRoleIds = ['prereq-role', 'dependent-role', 'some-other-role'];

  // 情況 1：使用者「同時取消勾選 prereq 但保留勾選依賴角色」
  // 也就是 values (roleIds) 只包含了 'dependent-role'
  const roleIds = ['dependent-role'];
  const expectedRoleIds = currentRoleIds.filter(id => !allowedRoleIds.includes(id)).concat(roleIds);

  assert.deepEqual(expectedRoleIds.sort(), ['dependent-role', 'some-other-role'].sort());

  // 驗證是否會被擋下來 (因為 expectedRoleIds 裡沒有 prereq-role)
  const selectedEntries = allowedRoles.filter(entry => roleIds.includes(entry.id));
  const blocked = selectedEntries.find(entry => entry.requirement && !expectedRoleIds.includes(entry.requirement));

  assert.equal(blocked.id, 'dependent-role');
  assert.equal(blocked.requirement, 'prereq-role');

  // 情況 2：使用者同時保留勾選 prereq 和依賴角色
  const roleIds2 = ['dependent-role', 'prereq-role'];
  const expectedRoleIds2 = currentRoleIds.filter(id => !allowedRoleIds.includes(id)).concat(roleIds2);

  const selectedEntries2 = allowedRoles.filter(entry => roleIds2.includes(entry.id));
  const blocked2 = selectedEntries2.find(entry => entry.requirement && !expectedRoleIds2.includes(entry.requirement));

  assert.equal(blocked2, undefined);
});

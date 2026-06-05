import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  SectionBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThumbnailBuilder,
  UserSelectMenuBuilder,
  version as discordJsVersion,
} from 'discord.js';
import os from 'node:os';
import {
  addReactionRole,
  deleteReactionRolesByMessage,
  getAiSettings,
  getGuildSettings,
  getReactionRolesByGuild,
  getRankTitle,
  getUserLevel,
  getXpForLevel,
  updateAiSetting,
  updateGuildSetting,
} from '../../utils/database.js';
import { openAnnouncementComposer } from '../../utils/announcementTools.js';
import { DEFAULT_AI_PROMPT } from '../../utils/aiChat.js';
import { AI_MODELS, DEFAULT_AI_MODEL } from '../../utils/aiConfig.js';
import { buildGuildDiagnostics } from '../../utils/guildDiagnostics.js';
import { parseJsonObject } from '../../utils/jsonUtils.js';
import { normalizeSelfRoleSettings, validateAssignableRole } from '../../utils/roleSettings.js';
import {
  buildSteamDealsPayload,
  buildSteamFreeGamesPayload,
  fetchSteamLimitedFreeGames,
  fetchSteamSpecialDeals,
  getSteamFailureMessage,
  isValidSteamDealTime,
} from '../../utils/steamDeals.js';
import { ansiBlock, COLORS, UI_COLORS } from '../../utils/style.js';
import { ephemeralV2Payload, v2Divider, v2EditPayload, v2Notice, v2Panel, v2Payload, v2Text } from '../../utils/componentsV2.js';
import { parseScopedCustomId, scopedCustomId } from '../../utils/customIds.js';

const PANEL_TIMEOUT = 10 * 60_000;
const CUSTOM_EMOJI_PATTERN = /^<a?:([A-Za-z0-9_]+):(\d{17,20})>$/;
const CUSTOM_EMOJI_IDENTIFIER_PATTERN = /^([A-Za-z0-9_]+):(\d{17,20})$/;
const DISCORD_ID_PATTERN = /^\d{17,20}$/;
const COMMON_REACTION_EMOJIS = [
  { char: '🎮', label: '遊戲' },
  { char: '🎵', label: '音樂' },
  { char: '🎨', label: '藝術' },
  { char: '📢', label: '公告' },
  { char: '⭐', label: '精選' },
  { char: '💬', label: '聊天' },
  { char: '🎬', label: '影音' },
  { char: '📸', label: '攝影' },
  { char: '⚽', label: '運動' },
  { char: '📚', label: '閱讀' },
  { char: '💻', label: '程式' },
  { char: '🔔', label: '通知' },
];
const LOG_TYPES = [
  { value: 'message', label: '訊息紀錄' },
  { value: 'member', label: '成員變動' },
  { value: 'server', label: '伺服器改動' },
  { value: 'voice', label: '語音狀態' },
  { value: 'thread', label: '討論串監控' },
];
const MODULE_STYLE = {
  '歡迎訊息': { section: 'CONFIGURATION / WELCOME', color: UI_COLORS.ROYAL },
  '紀錄設定': { section: 'CONFIGURATION / LOGGING', color: UI_COLORS.INFO },
  '等級系統': { section: 'CONFIGURATION / LEVELING', color: UI_COLORS.ROYAL },
  'Steam 推播': { section: 'CONFIGURATION / STEAM', color: UI_COLORS.STEAM },
  '自助身分組': { section: 'CONFIGURATION / SELF ROLES', color: UI_COLORS.ROYAL },
  '按鈕身分組': { section: 'CONFIGURATION / BUTTON ROLES', color: UI_COLORS.FUN },
  'AI 設定': { section: 'CONFIGURATION / AI', color: UI_COLORS.SPECIAL },
  'AI 存取驗證': { section: 'CONFIGURATION / AI ACCESS', color: UI_COLORS.MUTED },
  '伺服器資訊': { section: 'OPERATIONS / SERVER', color: UI_COLORS.INFO },
  '機器人狀態': { section: 'OPERATIONS / SYSTEM', color: UI_COLORS.SUCCESS },
  '發布公告': { section: 'OPERATIONS / ANNOUNCEMENT', color: UI_COLORS.ANNOUNCEMENT },
  '成員查詢': { section: 'OPERATIONS / MEMBER', color: UI_COLORS.INFO },
};
const MODULE_TITLES = {
  '歡迎訊息': '🎺 皇家迎賓佈告 | 歡迎訊息',
  '紀錄設定': '📜 皇家史官簿 | 紀錄設定',
  '等級系統': '🏅 爵位晉升公告 | 等級系統',
  'Steam 推播': '🛒 皇家採購推播 | Steam',
  '自助身分組': '🏷️ 皇家自助身分領取 | 自助身分組',
  '按鈕身分組': '🎭 皇家按鈕身分站 | 按鈕身分組',
  'AI 設定': '🧠 國王智慧核心 | AI 設定',
  'AI 存取驗證': '🔐 御前智慧驗證 | AI 存取驗證',
  '伺服器資訊': '🏰 領地視察 | 伺服器資訊',
  '機器人狀態': '🏥 大內健康報告 | 機器人狀態',
  '發布公告': '📜 頒布聖旨 | 發布公告',
  '成員查詢': '🔎 子民名冊 | 成員查詢',
};

export const data = new SlashCommandBuilder()
  .setName('設定')
  .setDescription('集中管理伺服器中的吉吉國王功能設定')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  if (!isAdministrator(interaction)) {
    return interaction.reply(v2Notice('🛡️ 御前通行證不足', '只有具有 Administrator 權限的管理員可以進入皇家管理控制台。', UI_COLORS.DANGER));
  }
  const context = createPanelContext(interaction);
  const home = await renderView(context);
  context.currentComponents = home.components;
  await interaction.reply(ephemeralV2Payload(home.components));
  const response = await interaction.fetchReply();
  context.message = response;
  context.editResponse = (payload) => interaction.editReply(payload);
  attachPanelCollector(response, context);
}

export async function openSettingsPanelFromHelp(interaction, onReturnToHelp) {
  if (!isAdministrator(interaction)) {
    return interaction.reply(v2Notice('🛡️ 御前通行證不足', '只有具有 Administrator 權限的管理員可以開啟皇家管理控制台。', UI_COLORS.DANGER));
  }
  const context = createPanelContext(interaction, { onReturnToHelp });
  const home = await renderView(context);
  context.currentComponents = home.components;
  context.message = interaction.message;
  context.editResponse = (payload) => interaction.editReply(payload);
  await interaction.update({ components: home.components });
  attachPanelCollector(interaction.message, context);
}

function createPanelContext(interaction, { onReturnToHelp = null } = {}) {
  return {
    guild: interaction.guild,
    client: interaction.client,
    userId: interaction.user.id,
    view: 'home',
    pending: {},
    currentComponents: [],
    message: null,
    editResponse: null,
    onReturnToHelp,
    stopPanel: null,
    notice: null,
  };
}

function attachPanelCollector(message, context) {
  const collector = message.createMessageComponentCollector({ time: PANEL_TIMEOUT });
  context.stopPanel = (reason) => collector.stop(reason);
  collector.on('collect', async (component) => {
    try {
      if (component.user.id !== context.userId) {
        await component.reply(v2Notice('🐕 這份御前面板不屬於你', '請使用 `/設定` 開啟自己的皇家管理控制台。', UI_COLORS.WARNING));
        return;
      }
      if (!isAdministrator(component)) {
        await component.reply(v2Notice('🛡️ 御前權限已失效', '你目前沒有 Administrator 權限，無法繼續修改皇家設定。', UI_COLORS.DANGER));
        return;
      }
      await routeComponent(component, context);
    } catch (error) {
      const payload = v2Notice('🐕💥 皇家設定操作失敗', `本王無法完成此次操作：${error.message}`, UI_COLORS.DANGER);
      if (component.replied || component.deferred) await component.followUp(payload).catch(() => {});
      else await component.reply(payload).catch(() => {});
    }
  });

  collector.on('end', (_, reason) => {
    if (reason === 'help') return;
    context.editResponse(v2EditPayload(ephemeralV2Payload(closePanel(context.currentComponents)))).catch(() => {});
  });
}

async function routeComponent(component, context) {
  const parts = parseSettingsCustomId(component.customId, context);
  if (!parts) return;
  const action = parts[0];

  if (action === 'help_home' && context.onReturnToHelp) {
    context.stopPanel?.('help');
    return context.onReturnToHelp(component);
  }
  if (action === 'view') {
    context.view = parts[1];
    context.pending.confirm = null;
    context.notice = null;
    return updateView(component, context);
  }
  if (action === 'back') {
    context.view = 'home';
    context.pending.confirm = null;
    context.notice = null;
    return updateView(component, context);
  }
  if (action === 'cancel') {
    context.view = context.pending.confirmReturnView || 'home';
    context.pending.confirm = null;
    context.pending.confirmReturnView = null;
    return updateView(component, context);
  }
  if (action === 'confirm') {
    return executeConfirmation(component, context);
  }
  if (action === 'modal') {
    return openModal(component, context, actionValue(parts));
  }

  if (component.isChannelSelectMenu()) {
    return handleChannelSelect(component, context, action);
  }
  if (component.isStringSelectMenu()) {
    return handleStringSelect(component, context, action);
  }
  if (component.isRoleSelectMenu()) {
    return handleRoleSelect(component, context, action);
  }
  if (component.isUserSelectMenu()) {
    return handleUserSelect(component, context, action);
  }
  if (component.isButton()) {
    return handleButton(component, context, action, actionValue(parts));
  }
}

function actionValue(parts) {
  return parts[1];
}

async function handleChannelSelect(component, context, action) {
  const channelId = component.values[0];
  if (action === 'welcome_channel') {
    updateGuildSetting(context.guild.id, 'welcome_channel', channelId);
    context.notice = '皇家迎賓頻道已更新。';
  }
  if (action === 'log_channel') {
    updateGuildSetting(context.guild.id, 'log_channel', channelId);
    context.notice = '史官日誌頻道已更新。';
  }
  if (action === 'steam_channel') {
    updateGuildSetting(context.guild.id, 'steam_deal_channel', channelId);
    context.notice = '皇家採購推播頻道已更新。';
  }
  if (action === 'steam_free_channel') {
    updateGuildSetting(context.guild.id, 'steam_free_channel', channelId);
    context.notice = 'Steam 限時免費推播頻道已更新。';
  }
  if (action === 'self_publish_channel') context.pending.selfPublishChannel = channelId;
  if (action === 'reaction_channel') context.pending.reactionChannel = channelId;
  if (action === 'ai_party_channel') context.pending.aiPartyChannel = channelId;
  if (action === 'announce_channel') context.pending.announceChannel = channelId;
  await updateView(component, context);
}

async function handleStringSelect(component, context, action) {
  if (action === 'log_types') {
    const toggles = Object.fromEntries(LOG_TYPES.map((type) => [type.value, component.values.includes(type.value) ? 1 : 0]));
    updateGuildSetting(context.guild.id, 'log_toggles', JSON.stringify(toggles));
    context.notice = '史官紀錄類別已更新。';
  }
  if (action === 'ai_model') {
    if (!requireAiUnlock(component, context)) return;
    updateAiSetting(context.guild.id, 'model', component.values[0]);
    context.notice = '國王智慧核心模型已更新。';
  }
  if (action === 'reaction_delete_target') context.pending.reactionDeleteMessage = component.values[0];
  if (action === 'reaction_emoji') {
    const value = component.values[0];
    let emojiInput;
    if (value.startsWith('guild:')) {
      const emojiId = value.slice(6);
      const guildEmoji = context.guild.emojis?.cache?.get(emojiId);
      if (!guildEmoji) return component.reply(v2Notice('🎭 emoji 已失效', '這個 emoji 可能已被移除，請重新選擇。', UI_COLORS.WARNING));
      emojiInput = guildEmoji.identifier;
    } else if (value.startsWith('common:')) {
      emojiInput = value.slice(7);
    } else {
      emojiInput = value;
    }
    const pairError = tryAddReactionPair(context, emojiInput);
    if (pairError) return component.reply(v2Notice(pairError.title, pairError.message, UI_COLORS.WARNING));
  }
  if (action === 'announce_mention') {
    context.pending.announceMention = component.values[0];
    if (context.pending.announceMention !== 'role') context.pending.announceRole = null;
  }
  await updateView(component, context);
}

async function handleRoleSelect(component, context, action) {
  const role = context.guild.roles.cache.get(component.values[0]);
  if (action === 'self_target') {
    const error = validateAssignableRole(context.guild, role);
    if (error) return component.reply(v2Notice('🏷️ 無法列入皇家領取名冊', error, UI_COLORS.WARNING));
    context.pending.selfTarget = role.id;
    context.pending.selfRequirement = null;
  }
  if (action === 'self_requirement') context.pending.selfRequirement = role?.id || null;
  if (action === 'self_remove') {
    const roles = getSelfRoles(context.guild.id).filter((entry) => entry.id !== role?.id);
    updateGuildSetting(context.guild.id, 'selfrole_roles', JSON.stringify(roles));
    context.notice = '皇家自助身分領取選項已移除。';
  }
  if (action === 'reaction_role') {
    const error = validateAssignableRole(context.guild, role);
    if (error) return component.reply(v2Notice('🎭 無法加入按鈕身分站', error, UI_COLORS.WARNING));
    context.pending.reactionRole = role.id;
  }
  if (action === 'announce_role') {
    context.pending.announceRole = role?.id || null;
    context.pending.announceMention = 'role';
  }
  await updateView(component, context);
}

async function handleUserSelect(component, context, action) {
  if (action === 'ai_user') {
    if (!requireAiUnlock(component, context)) return;
    context.pending.aiUser = component.values[0];
  }
  if (action === 'member_user') context.pending.memberUser = component.values[0];
  await updateView(component, context);
}

async function handleButton(component, context, action, value) {
  if (action === 'announce_compose') {
    if (!context.pending.announceChannel) {
      return component.reply(v2Notice('📜 尚未選擇頒旨頻道', '請先選擇公告要張貼到哪個文字頻道。', UI_COLORS.WARNING));
    }
    const mention = context.pending.announceMention || 'none';
    if (mention === 'role' && !context.pending.announceRole) {
      return component.reply(v2Notice('📜 尚未選擇召見身分組', '請先選擇公告要提及的身分組，或改選其他提及模式。', UI_COLORS.WARNING));
    }
    const mentionText = mention === 'role'
      ? `<@&${context.pending.announceRole}>`
      : mention === 'everyone' ? '@everyone' : mention === 'here' ? '@here' : null;
    const allowedMentions = mention === 'role'
      ? { parse: [], roles: [context.pending.announceRole] }
      : mention === 'everyone' || mention === 'here' ? { parse: ['everyone'] } : { parse: [] };
    return openAnnouncementComposer(component, { channelId: context.pending.announceChannel, mentionText, allowedMentions });
  }
  if (action === 'level') {
    updateGuildSetting(context.guild.id, 'level_up_announcement_enabled', value === 'on' ? 1 : 0);
    context.notice = '爵位晉升公告狀態已更新。';
  }
  if (action === 'steam_toggle') {
    updateGuildSetting(context.guild.id, 'steam_deal_enabled', value === 'on' ? 1 : 0);
    context.notice = '皇家採購推播狀態已更新。';
  }
  if (action === 'steam_free_toggle') {
    updateGuildSetting(context.guild.id, 'steam_free_enabled', value === 'on' ? 1 : 0);
    context.notice = 'Steam 限時免費推播狀態已更新。';
  }
  if (action === 'self_add') {
    if (!context.pending.selfTarget) {
      return component.reply(v2Notice('🏷️ 尚未挑選可領取身分', '請先從選單挑選要加入皇家自助領取頁的身分組。', UI_COLORS.WARNING));
    }
    const roles = getSelfRoles(context.guild.id);
    if (roles.some((entry) => entry.id === context.pending.selfTarget)) {
      return component.reply(v2Notice('🏷️ 名冊未變更', '選取的身分組已在皇家自助領取名冊中。', UI_COLORS.WARNING));
    }
    if (roles.length >= 25) {
      return component.reply(v2Notice('🏷️ 領取名冊已滿', '皇家自助身分領取頁最多只能提供 25 個選項。', UI_COLORS.WARNING));
    }
    roles.push({ id: context.pending.selfTarget, requirement: context.pending.selfRequirement || null });
    updateGuildSetting(context.guild.id, 'selfrole_roles', JSON.stringify(roles));
    context.notice = '皇家自助身分領取選項已新增。';
    context.pending.selfTarget = null;
    context.pending.selfRequirement = null;
  }
  if (action === 'self_clear_requirement') context.pending.selfRequirement = null;
  if (action === 'ai_toggle') {
    if (!requireAiUnlock(component, context)) return;
    updateAiSetting(context.guild.id, value, getAiSettings(context.guild.id)[value] ? 0 : 1);
    context.notice = '國王智慧核心開關已更新。';
  }
  if (action === 'ai_user_add' || action === 'ai_user_remove') {
    if (!requireAiUnlock(component, context)) return;
    if (!context.pending.aiUser) return component.reply(v2Notice('🧠 尚未選取子民', '請先選擇要調整的御准白名單成員。', UI_COLORS.WARNING));
    const settings = getAiSettings(context.guild.id);
    const whitelist = new Set(settings.whitelist);
    if (action === 'ai_user_add') whitelist.add(context.pending.aiUser);
    else whitelist.delete(context.pending.aiUser);
    updateAiSetting(context.guild.id, 'whitelist', JSON.stringify([...whitelist]));
    context.notice = 'AI 御准白名單已更新。';
  }
  if (action === 'reaction_clear_pairs') {
    context.pending.reactionPairs = [];
    context.pending.reactionRole = null;
    context.notice = '按鈕身分站暫存配對已清除。';
  }
  if (action === 'prepare_confirm') {
    context.pending.confirmReturnView = context.view;
    context.pending.confirm = value;
    context.view = 'confirm';
  }
  await updateView(component, context);
}

async function openModal(component, context, type) {
  if (!type) return component.reply(v2Notice('⚠️ 操作目標遺失', '請回到設定面板重新按一次操作按鈕。', UI_COLORS.WARNING));
  if (type.startsWith('ai_') && type !== 'ai_unlock' && !requireAiUnlock(component, context)) return;
  const modal = buildModal(context, type);
  await component.showModal(modal);
  const submit = await component.awaitModalSubmit({
    time: 2 * 60_000,
    filter: (candidate) => candidate.user.id === context.userId && candidate.customId === modal.data.custom_id,
  }).catch(() => null);
  if (!submit) return;
  if (!isAdministrator(submit)) {
    return submit.reply(v2Notice('🛡️ 御前權限已失效', '你目前沒有 Administrator 權限。', UI_COLORS.DANGER));
  }

  if (type === 'ai_unlock') {
    const configuredPassword = process.env.AI_ADMIN_PASSWORD;
    const suppliedPassword = submit.fields.getTextInputValue('password');
    if (!configuredPassword) {
      context.notice = { label: 'SETUP', color: COLORS.GOLD, text: '尚未配置御前 AI 管理密碼，請先設定環境變數。' };
    } else if (suppliedPassword !== configuredPassword) {
      context.notice = { label: 'DENIED', color: COLORS.RED, text: '御前管理密碼錯誤，AI 設定仍處於鎖定狀態。' };
    } else {
      const settings = getAiSettings(context.guild.id);
      const adminIds = new Set(settings.admin_ids);
      adminIds.add(context.userId);
      updateAiSetting(context.guild.id, 'admin_ids', JSON.stringify([...adminIds]));
      context.notice = { label: 'ACCESS', color: COLORS.GREEN, text: '御前身分驗證成功，AI 管理權限已解鎖。' };
    }
  }
  if (type === 'welcome_message') {
    updateGuildSetting(context.guild.id, 'welcome_message', submit.fields.getTextInputValue('value').trim() || null);
    context.notice = '皇家迎賓訊息已更新。';
  }
  if (type === 'steam_time') {
    const time = submit.fields.getTextInputValue('value').trim();
    if (!isValidSteamDealTime(time)) {
      return submit.reply(v2Notice('🛒 投放時辰格式錯誤', '請使用 `HH:mm` 格式，例如 `20:00`。', UI_COLORS.WARNING));
    }
    updateGuildSetting(context.guild.id, 'steam_deal_time', time);
    context.notice = '皇家每日採購推播時間已更新。';
  }
  if (type === 'steam_free_time') {
    const time = submit.fields.getTextInputValue('value').trim();
    if (!isValidSteamDealTime(time)) {
      return submit.reply(v2Notice('Steam 限時免費時間格式錯誤', '請使用 `HH:mm` 格式，例如 `21:00`。', UI_COLORS.WARNING));
    }
    updateGuildSetting(context.guild.id, 'steam_free_time', time);
    context.notice = 'Steam 限時免費每日推播時間已更新。';
  }
  if (type === 'self_description') context.pending.selfDescription = submit.fields.getTextInputValue('value').trim();
  if (type === 'reaction_create') {
    if (!context.pending.reactionChannel) {
      return submit.reply(v2Notice('🎭 尚未選擇發布頻道', '請先在皇家按鈕身分站頁面選擇發布頻道。', UI_COLORS.WARNING));
    }
    const result = parseReactionPairs(context.guild, submit.fields.getTextInputValue('pairs'));
    if (result.error) return submit.reply(v2Notice('🎭 皇家按鈕站設定無效', result.error, UI_COLORS.WARNING));
    context.pending.reactionPairs = result.pairs;
    context.pending.reactionTitle = submit.fields.getTextInputValue('title').trim();
  }
  if (type === 'reaction_pair_add') {
    const emoji = submit.fields.getTextInputValue('emoji').trim();
    const pairError = tryAddReactionPair(context, emoji);
    if (pairError) return submit.reply(v2Notice(pairError.title, pairError.message, UI_COLORS.WARNING));
  }
  if (type === 'reaction_title') {
    context.pending.reactionTitle = submit.fields.getTextInputValue('title').trim();
    context.notice = '皇家按鈕身分站標題已更新。';
  }
  if (type === 'ai_prompt') {
    updateAiSetting(context.guild.id, 'system_prompt', submit.fields.getTextInputValue('value').trim() || DEFAULT_AI_PROMPT);
    context.notice = '國王智慧人格設定已更新。';
  }
  if (type === 'ai_party') {
    if (!context.pending.aiPartyChannel) {
      return submit.reply(v2Notice('🎉 尚未選擇宴會廳', '請先選擇 AI 派對模式的目標頻道。', UI_COLORS.WARNING));
    }
    const minutes = Number.parseInt(submit.fields.getTextInputValue('minutes'), 10);
    if (!Number.isSafeInteger(minutes) || minutes < 1) {
      return submit.reply(v2Notice('持續時間無效', '請輸入至少 1 分鐘的整數時間。', UI_COLORS.WARNING));
    }
    context.pending.aiPartyMinutes = minutes;
  }
  await updateView(submit, context);
}

function buildModal(context, type) {
  const modal = new ModalBuilder().setCustomId(id(context, `modal_submit_${type}`));
  if (type === 'welcome_message') {
    const current = getGuildSettings(context.guild.id).welcome_message || '';
    return modal.setTitle('編輯皇家迎賓佈告').addComponents(textRow('value', '迎賓內容（可留空恢復預設）', current, TextInputStyle.Paragraph, false));
  }
  if (type === 'steam_time') {
    const current = getGuildSettings(context.guild.id).steam_deal_time || '20:00';
    return modal.setTitle('設定每日推播時間').addComponents(textRow('value', '台灣時間 HH:mm', current, TextInputStyle.Short));
  }
  if (type === 'steam_free_time') {
    const current = getGuildSettings(context.guild.id).steam_free_time || '21:00';
    return modal.setTitle('設定限時免費推播時間').addComponents(textRow('value', '台灣時間 HH:mm', current, TextInputStyle.Short));
  }
  if (type === 'self_description') {
    return modal.setTitle('皇家自助身分領取佈告').addComponents(textRow('value', '領取頁介紹', context.pending.selfDescription || '子民請從下方選單選擇想領取或取消的身分組。', TextInputStyle.Paragraph));
  }
  if (type === 'reaction_create') {
    return modal.setTitle('建立皇家按鈕身分站').addComponents(
      textRow('pairs', '自訂按鈕:身分組（如 🎮遊戲玩家:身分組 或 📣:身分組 或 遊戲玩家），一行一組', '', TextInputStyle.Paragraph),
      textRow('title', '標題（選填）', '', TextInputStyle.Short, false)
    );
  }
  if (type === 'reaction_pair_add') {
    return modal.setTitle('新增按鈕身分配對').addComponents(
      textRow('emoji', 'Emoji、文字或兩者（如 🎮遊戲玩家）', '', TextInputStyle.Short)
    );
  }
  if (type === 'reaction_title') {
    return modal.setTitle('設定皇家按鈕身分站標題').addComponents(
      textRow('title', '標題（選填）', context.pending.reactionTitle || '', TextInputStyle.Short, false)
    );
  }
  if (type === 'ai_unlock') {
    return modal.setTitle('御前 AI 管理身分驗證').addComponents(textRow('password', '御前管理密碼', '', TextInputStyle.Short));
  }
  if (type === 'ai_prompt') {
    return modal.setTitle('編輯國王智慧人格').addComponents(textRow('value', '提示詞（留空恢復預設）', '', TextInputStyle.Paragraph, false));
  }
  return modal.setTitle('啟動皇家 AI 宴會').addComponents(textRow('minutes', '持續分鐘', '30', TextInputStyle.Short));
}

async function executeConfirmation(component, context) {
  const type = context.pending.confirm;
  if (!type) return updateView(component, context);
  if (type === 'ai_party' && !aiUnlocked(context)) {
    return component.reply(v2Notice('🔐 國王智慧核心已鎖定', '請回到皇家管理控制台的 AI 頁完成御前身分驗證。', UI_COLORS.DANGER));
  }

  if (type === 'self_publish') {
    if (!context.pending.selfPublishChannel) return component.reply(v2Notice('🏷️ 尚未選擇張貼頻道', '請先選擇皇家領取佈告的發布頻道。', UI_COLORS.WARNING));
    const channel = await context.guild.channels.fetch(context.pending.selfPublishChannel).catch(() => null);
    if (!channel?.isTextBased()) return component.reply(v2Notice('🏷️ 張貼頻道無效', '選取的頻道無法發布皇家領取佈告。', UI_COLORS.WARNING));
    await component.deferUpdate();
    await publishSelfRoleMenu(context.guild, channel, getSelfRoles(context.guild.id), context.pending.selfDescription);
  }
  if (type === 'reaction_create') {
    if (!context.pending.reactionChannel || !Array.isArray(context.pending.reactionPairs) || context.pending.reactionPairs.length === 0) {
      return component.reply(v2Notice('🎭 皇家站點尚未完成', '請選擇頻道並新增按鈕配對。', UI_COLORS.WARNING));
    }
    const channel = await context.guild.channels.fetch(context.pending.reactionChannel).catch(() => null);
    if (!channel?.isTextBased()) return component.reply(v2Notice('🎭 站點頻道無效', '選取的頻道無法發布皇家按鈕身分站。', UI_COLORS.WARNING));
    const permissionError = validateReactionStationChannel(context.guild, channel);
    if (permissionError) return component.reply(v2Notice('🎭 無法在此頻道建立按鈕站', permissionError, UI_COLORS.WARNING));
    await component.deferUpdate();
    await createReactionStation(context.guild, channel, context.pending.reactionPairs, context.pending.reactionTitle);
    context.pending.reactionPairs = [];
    context.pending.reactionRole = null;
    context.pending.reactionTitle = null;
    context.notice = '皇家按鈕身分站已發布。';
  }
  if (type === 'reaction_delete') {
    if (!context.pending.reactionDeleteMessage) return component.reply(v2Notice('🎭 尚未選擇站點', '請先選取要撤除的皇家按鈕身分站。', UI_COLORS.WARNING));
    await component.deferUpdate();
    await deleteReactionStation(context.guild, context.pending.reactionDeleteMessage);
  }
  if (type === 'steam_publish') {
    await component.deferUpdate();
    try {
      await publishSteamDeals(context.guild);
    } catch (error) {
      await component.followUp(v2Notice('🛒 皇家採購榜投放失敗', getSteamFailureMessage(error), UI_COLORS.WARNING));
    }
    context.pending.confirm = null;
    context.view = 'steam';
    const page = await renderView(context);
    context.currentComponents = page.components;
    await context.editResponse(v2EditPayload(ephemeralV2Payload(page.components)));
    return;
  }
  if (type === 'steam_free_publish') {
    await component.deferUpdate();
    try {
      const count = await publishSteamFreeGames(context.guild);
      if (count === 0) {
        await component.followUp(v2Notice('Steam 限時免費目前沒有結果', '本王巡過 Steam 商店了，現在沒有符合 100% 折扣到免費的遊戲。', UI_COLORS.WARNING));
      }
    } catch (error) {
      await component.followUp(v2Notice('Steam 限時免費投放失敗', getSteamFailureMessage(error), UI_COLORS.WARNING));
    }
    context.pending.confirm = null;
    context.view = 'steam';
    const page = await renderView(context);
    context.currentComponents = page.components;
    await context.editResponse(v2EditPayload(ephemeralV2Payload(page.components)));
    return;
  }
  if (type === 'ai_party') {
    if (!context.pending.aiPartyChannel || !context.pending.aiPartyMinutes) {
      return component.reply(v2Notice('🎉 皇家宴會設定尚未完成', '請先選擇派對頻道與持續時間。', UI_COLORS.WARNING));
    }
    await component.deferUpdate();
    await startAiParty(context.guild, context.pending.aiPartyChannel, context.pending.aiPartyMinutes);
  }
  context.pending.confirm = null;
  context.pending.confirmReturnView = null;
  context.view = confirmationReturnView(type);
  await updateView(component, context);
}

function confirmationReturnView(type) {
  if (typeof type !== 'string') return 'home';
  if (type.startsWith('self_')) return 'selfrole';
  if (type.startsWith('reaction_')) return 'reaction';
  if (type.startsWith('ai_')) return 'ai';
  return 'steam';
}

async function updateView(component, context) {
  const view = await renderView(context);
  context.currentComponents = view.components;
  if (!component.deferred && !component.replied && typeof component.deferUpdate === 'function') {
    await component.deferUpdate();
  }
  if (typeof context.editResponse === 'function') {
    await context.editResponse(v2EditPayload(ephemeralV2Payload(view.components)));
    return;
  }
  if (component.deferred || component.replied) {
    await component.editReply(v2EditPayload(ephemeralV2Payload(view.components)));
    return;
  }
  await component.update({ components: view.components });
}

async function renderView(context) {
  if (context.view === 'welcome') return renderWelcome(context);
  if (context.view === 'logging') return renderLogging(context);
  if (context.view === 'leveling') return renderLeveling(context);
  if (context.view === 'steam') return renderSteam(context);
  if (context.view === 'selfrole') return renderSelfRole(context);
  if (context.view === 'reaction') return renderReaction(context);
  if (context.view === 'ai') return renderAi(context);
  if (context.view === 'serverinfo') return renderServerInfo(context);
  if (context.view === 'botstatus') return renderBotStatus(context);
  if (context.view === 'announcement') return renderAnnouncement(context);
  if (context.view === 'member') return renderMemberLookup(context);
  if (context.view === 'confirm') return renderConfirm(context);
  return renderHome(context);
}

async function renderHome(context) {
  const diagnostics = await getDiagnostics(context.guild);
  const accessDiagnostic = {
    label: 'AI 管理授權',
    status: aiUnlocked(context) ? '正常' : '未設定',
    detail: aiUnlocked(context) ? '已通過管理身分驗證' : '請進入 AI 頁完成管理身分驗證',
  };
  const statusItems = [...diagnostics, accessDiagnostic];
  const readyCount = statusItems.filter((item) => item.status === '正常').length;
  const pendingCount = statusItems.filter((item) => item.status === '未設定').length;
  const alertCount = statusItems.filter((item) => item.status === '設定異常').length;
  const overallLabel = alertCount ? '有設定異常需要處理' : pendingCount ? '有項目尚未完成設定' : '所有必要設定正常';
  const overview = ansiBlock([
    { color: alertCount ? COLORS.RED : pendingCount ? COLORS.GOLD : COLORS.GREEN, text: `[ CONTROL ] ${overallLabel}` },
    { color: COLORS.GREEN, text: `[ READY   ] ${readyCount} 個模組運作正常` },
    { color: COLORS.GOLD, text: `[ SETUP   ] ${pendingCount} 個模組等待設定` },
    { color: COLORS.RED, text: `[ ALERT   ] ${alertCount} 個模組需要修正` },
    ...statusItems.map(formatDiagnosticLine),
  ]);
  const fixes = diagnostics.filter((item) => item.fix).map((item) => `- **${item.label}**：${item.fix}`).join('\n');
  const panel = v2Panel(alertCount ? UI_COLORS.WARNING : UI_COLORS.ROYAL)
    .addTextDisplayComponents(v2Text(
      `-# ADMIN CONTROL CENTER  /  OVERVIEW\n# ${context.guild.name} 管理控制台\n` +
      '集中管理伺服器設定、公開發布與服務狀態。所有操作僅限 Administrator。'
    ))
    .addSeparatorComponents(v2Divider())
    .addTextDisplayComponents(v2Text(`## 伺服器健康總覽\n${overview}${fixes ? `\n### 修正建議\n${fixes}` : '\n> 所有必要設定均已就緒。'}`))
    .addSeparatorComponents(v2Divider())
    .addTextDisplayComponents(v2Text('## CONFIGURATION | 功能設定\n調整使用者體驗、自動化推播、身分領取與 AI 行為。'))
    .addActionRowComponents(
      buttonRow(context, [['welcome', '歡迎'], ['logging', '紀錄'], ['leveling', '等級'], ['steam', 'Steam']]),
      buttonRow(context, [['selfrole', '自助身分組'], ['reaction', '按鈕身分組'], ['ai', aiUnlocked(context) ? 'AI 設定' : 'AI 驗證', aiUnlocked(context) ? ButtonStyle.Secondary : ButtonStyle.Primary]])
    )
    .addSeparatorComponents(v2Divider())
    .addTextDisplayComponents(v2Text('## OPERATIONS | 管理工具\n查看伺服器與核心狀態，或執行會影響伺服器的公開管理工作。'))
    .addActionRowComponents(
      buttonRow(context, [['serverinfo', '伺服器資訊'], ['botstatus', '機器人狀態'], ['announcement', '發布公告'], ['member', '成員查詢']])
    );
  if (context.onReturnToHelp) {
    panel.addActionRowComponents(actionButtons(context, [['help_home', '返回 /幫助 首頁', ButtonStyle.Secondary]]));
  }
  return { components: [panel] };
}

function renderWelcome(context) {
  const settings = getGuildSettings(context.guild.id);
  const panel = modulePanel(context, '歡迎訊息', `迎賓頻道：${settings.welcome_channel ? `<#${settings.welcome_channel}>` : '尚未設定'}\n迎賓佈告：${settings.welcome_message || '使用皇家預設歡迎內容'}`)
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId(id(context, 'welcome_channel')).setPlaceholder('選擇歡迎頻道').addChannelTypes(ChannelType.GuildText)
    ))
    .addActionRowComponents(actionButtons(context, [['modal:welcome_message', '編輯訊息', ButtonStyle.Primary]]));
  return { components: [finishPanel(panel, context)] };
}

function renderLogging(context) {
  const settings = getGuildSettings(context.guild.id);
  const toggles = parseJsonObject(settings.log_toggles, {});
  const panel = modulePanel(context, '紀錄設定', `史官頻道：${settings.log_channel ? `<#${settings.log_channel}>` : '尚未設定'}\n選擇史官要記錄的事件類型。`)
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId(id(context, 'log_channel')).setPlaceholder('選擇日誌頻道').addChannelTypes(ChannelType.GuildText)
    ))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId(id(context, 'log_types')).setPlaceholder('啟用的紀錄類別').setMinValues(0).setMaxValues(LOG_TYPES.length)
        .addOptions(LOG_TYPES.map((type) => ({ label: type.label, value: type.value, default: toggles[type.value] === 1 })))
    ));
  return { components: [finishPanel(panel, context)] };
}

function renderLeveling(context) {
  const enabled = getGuildSettings(context.guild.id).level_up_announcement_enabled !== 0;
  const panel = modulePanel(context, '等級系統', `爵位晉升公告目前為：**${enabled ? '開啟' : '關閉'}**`)
    .addActionRowComponents(actionButtons(context, [
      ['level:on', '開啟公告', ButtonStyle.Success],
      ['level:off', '關閉公告', ButtonStyle.Secondary],
    ]));
  return { components: [finishPanel(panel, context)] };
}

function renderSteam(context) {
  const settings = getGuildSettings(context.guild.id);
  const dealStatus = settings.steam_deal_enabled === 1 ? '開啟' : '關閉';
  const freeStatus = settings.steam_free_enabled === 1 ? '開啟' : '關閉';
  const panel = modulePanel(context, 'Steam 推播', [
    `特價榜：**${dealStatus}** | 頻道：${settings.steam_deal_channel ? `<#${settings.steam_deal_channel}>` : '尚未設定'} | 時間：${settings.steam_deal_time || '尚未設定'} (Asia/Taipei)`,
    `限時免費：**${freeStatus}** | 頻道：${settings.steam_free_channel ? `<#${settings.steam_free_channel}>` : '尚未設定'} | 時間：${settings.steam_free_time || '尚未設定'} (Asia/Taipei)`,
  ].join('\n'))
    .addTextDisplayComponents(v2Text('## Steam 特價榜'))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId(id(context, 'steam_channel')).setPlaceholder('選擇特價榜推播頻道').addChannelTypes(ChannelType.GuildText)
    ))
    .addActionRowComponents(actionButtons(context, [
      ['modal:steam_time', '特價時間', ButtonStyle.Primary],
      ['steam_toggle:on', '啟用特價', ButtonStyle.Success],
      ['steam_toggle:off', '停用特價', ButtonStyle.Secondary],
      ['prepare_confirm:steam_publish', '立即投放特價', ButtonStyle.Danger],
    ]))
    .addSeparatorComponents(v2Divider())
    .addTextDisplayComponents(v2Text('## Steam 限時免費'))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId(id(context, 'steam_free_channel')).setPlaceholder('選擇限時免費推播頻道').addChannelTypes(ChannelType.GuildText)
    ))
    .addActionRowComponents(actionButtons(context, [
      ['modal:steam_free_time', '免費時間', ButtonStyle.Primary],
      ['steam_free_toggle:on', '啟用免費', ButtonStyle.Success],
      ['steam_free_toggle:off', '停用免費', ButtonStyle.Secondary],
      ['prepare_confirm:steam_free_publish', '立即投放免費', ButtonStyle.Danger],
    ]));
  return { components: [finishPanel(panel, context)] };
}

function renderSelfRole(context) {
  const entries = getSelfRoles(context.guild.id);
  const listing = entries.length ? entries.slice(0, 12).map((entry) => {
    const role = context.guild.roles.cache.get(entry.id);
    const required = entry.requirement ? context.guild.roles.cache.get(entry.requirement) : null;
    return `- ${role ? `<@&${role.id}>` : `已刪除 (${entry.id})`}${required ? `，需 <@&${required.id}>` : ''}`;
  }).join('\n') : '尚未建立可供子民領取的身分選項';
  const pending = context.pending.selfTarget
    ? `\n待新增：<@&${context.pending.selfTarget}>${context.pending.selfRequirement ? `，需 <@&${context.pending.selfRequirement}>` : '，無門檻'}`
    : '';
  const panel = modulePanel(context, '自助身分組', `管理子民可自行領取或取消的身分名冊。\n${listing}${pending}`)
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder().setCustomId(id(context, 'self_target')).setPlaceholder('挑選要開放領取的身分組')
    ))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder().setCustomId(id(context, 'self_requirement')).setPlaceholder('設定領取資格身分組（選填）')
    ))
    .addActionRowComponents(actionButtons(context, [
      ['self_add', '加入領取名冊', ButtonStyle.Success],
      ['self_clear_requirement', '清除領取門檻', ButtonStyle.Secondary],
      ['modal:self_description', '編輯領取佈告', ButtonStyle.Secondary],
    ]))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder().setCustomId(id(context, 'self_remove')).setPlaceholder('從領取名冊移除選項')
    ))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId(id(context, 'self_publish_channel')).setPlaceholder('選擇張貼領取佈告的頻道').addChannelTypes(ChannelType.GuildText)
    ))
    .addActionRowComponents(actionButtons(context, [['prepare_confirm:self_publish', '張貼領取佈告', ButtonStyle.Danger]]));
  return { components: [finishPanel(panel, context)] };
}

function renderReaction(context) {
  const roles = getReactionRolesByGuild(context.guild.id);
  const stationIds = [...new Set(roles.map((item) => item.message_id))];
  const summary = stationIds.length ? `王國目前共有 ${stationIds.length} 個按鈕站點、${roles.length} 組配對。` : '尚未建立皇家按鈕身分站。';
  const selectedRole = context.pending.reactionRole ? context.guild.roles.cache.get(context.pending.reactionRole) : null;
  const pendingPairs = Array.isArray(context.pending.reactionPairs) ? context.pending.reactionPairs : [];
  const pendingText = pendingPairs.length
    ? pendingPairs.map((pair) => {
        const emojiPart = pair.emoji ? pair.emoji : '';
        const labelPart = pair.label || pair.role.name;
        const display = emojiPart && labelPart ? `${emojiPart} ${labelPart}` : (emojiPart || labelPart);
        return `- [${display}] -> <@&${pair.role.id}>`;
      }).join('\n')
    : '尚未新增配對';
  const setupText = [
    summary,
    '建立站點需先選擇頻道，再選身分組並新增按鈕配對（支援 Emoji、文字或兩者）。',
    `選取身分組：${selectedRole ? `<@&${selectedRole.id}>` : '尚未選擇'}`,
    `站點標題：${context.pending.reactionTitle || '預設標題'}`,
    `暫存配對：\n${pendingText}`,
  ].join('\n');
  const panel = modulePanel(context, '按鈕身分組', setupText)
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId(id(context, 'reaction_channel')).setPlaceholder('選擇新站點頻道').addChannelTypes(ChannelType.GuildText)
    ))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder().setCustomId(id(context, 'reaction_role')).setPlaceholder('選擇要給予/移除的身分組')
    ))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(id(context, 'reaction_emoji'))
        .setPlaceholder('選擇 emoji（選取後自動新增配對）')
        .addOptions(buildReactionEmojiOptions(context.guild))
    ))
    .addActionRowComponents(actionButtons(context, [
      ['modal:reaction_pair_add', '手動輸入按鈕內容', ButtonStyle.Secondary],
      ['modal:reaction_title', '設定標題', ButtonStyle.Secondary],
      ['reaction_clear_pairs', '清除配對', ButtonStyle.Secondary],
      ['prepare_confirm:reaction_create', '發布新站點', ButtonStyle.Danger],
    ]));
  if (stationIds.length) {
    panel.addActionRowComponents(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId(id(context, 'reaction_delete_target')).setPlaceholder('選取要刪除的站點')
        .addOptions(stationIds.slice(0, 25).map((messageId) => ({ label: `訊息 ${messageId}`, value: messageId })))
    ));
    panel.addActionRowComponents(actionButtons(context, [['prepare_confirm:reaction_delete', '刪除選取站點', ButtonStyle.Danger]]));
  }
  return { components: [finishPanel(panel, context)] };
}

function renderAi(context) {
  if (!aiUnlocked(context)) {
    const passwordStatus = process.env.AI_ADMIN_PASSWORD
      ? { color: COLORS.GOLD, text: '[ LOCKED ] 尚未驗證管理身分' }
      : { color: COLORS.RED, text: '[ SETUP  ] 尚未配置 AI_ADMIN_PASSWORD' };
    const panel = modulePanel(context, 'AI 存取驗證', '國王智慧核心目前封存於御前鎖櫃。驗證成功後，此帳號將持續保有本伺服器的 AI 管理權限。')
      .addTextDisplayComponents(v2Text([
        '## ACCESS STATUS | 御前授權狀態',
        ansiBlock([
          passwordStatus,
          { color: COLORS.CYAN, text: '[ SCOPE  ] 模型 / 聯網 / 記憶 / 白名單 / 派對模式' },
        ]),
        '密碼僅用於本次驗證，不會顯示於面板或寫入資料庫。',
      ].join('\n')))
      .addActionRowComponents(actionButtons(context, [['modal:ai_unlock', '輸入管理密碼', ButtonStyle.Primary]]));
    return { components: [finishPanel(panel, context)] };
  }
  const settings = getAiSettings(context.guild.id);
  const whitelistCount = new Set(settings.whitelist.filter(Boolean).map(String)).size;
  const panel = modulePanel(context, 'AI 設定', `國王大腦：\`${settings.model || DEFAULT_AI_MODEL}\`\n天文地理聯網：**${settings.search_enabled ? '開啟' : '關閉'}** | 御前對話記憶：**${settings.context_enabled ? '開啟' : '關閉'}**\n御准白名單：${whitelistCount} 人`)
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId(id(context, 'ai_model')).setPlaceholder('選擇 AI 模型')
        .addOptions(AI_MODELS.map((model) => ({ label: model, value: model, default: model === settings.model })))
    ))
    .addActionRowComponents(actionButtons(context, [
      ['ai_toggle:search_enabled', settings.search_enabled ? '關閉聯網' : '開啟聯網', settings.search_enabled ? ButtonStyle.Secondary : ButtonStyle.Success],
      ['ai_toggle:context_enabled', settings.context_enabled ? '關閉記憶' : '開啟記憶', settings.context_enabled ? ButtonStyle.Secondary : ButtonStyle.Success],
      ['modal:ai_prompt', '編輯提示詞', ButtonStyle.Secondary],
    ]))
    .addTextDisplayComponents(v2Text(renderAiWhitelist(settings.whitelist, context.pending.aiUser)))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder().setCustomId(id(context, 'ai_user')).setPlaceholder('選擇白名單使用者')
    ))
    .addActionRowComponents(actionButtons(context, [
      ['ai_user_add', '加入白名單', ButtonStyle.Success],
      ['ai_user_remove', '移除白名單', ButtonStyle.Secondary],
    ]))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId(id(context, 'ai_party_channel')).setPlaceholder('選擇派對頻道').addChannelTypes(ChannelType.GuildText)
    ))
    .addActionRowComponents(actionButtons(context, [
      ['modal:ai_party', '設定派對時間', ButtonStyle.Secondary],
      ['prepare_confirm:ai_party', '啟動派對', ButtonStyle.Danger],
    ]));
  return { components: [finishPanel(panel, context)] };
}

function renderAiWhitelist(whitelist, selectedUserId = null) {
  const userIds = [...new Set(whitelist.filter(Boolean).map(String))];
  const visibleUsers = userIds.slice(0, 20).map((userId) => `<@${userId}>`).join('  ');
  const listing = visibleUsers || '尚未有子民列入御准白名單。';
  const remaining = userIds.length > 20 ? `\n-# 另有 ${userIds.length - 20} 人未展開顯示。` : '';
  const selected = selectedUserId ? `\n-# 目前選取：<@${selectedUserId}>` : '';
  return `## ACCESS LIST | 御准白名單成員\n${listing}${remaining}${selected}`;
}

async function renderServerInfo(context) {
  const guild = context.guild;
  const owner = await guild.fetchOwner().catch(() => null);
  const aiSettings = getAiSettings(guild.id);
  const diagnostics = await getDiagnostics(guild);
  const readyCount = diagnostics.filter((item) => item.status === '正常').length;
  const pendingCount = diagnostics.filter((item) => item.status === '未設定').length;
  const alertCount = diagnostics.filter((item) => item.status === '設定異常').length;
  const textChannels = guild.channels.cache.filter((channel) => channel.type === ChannelType.GuildText).size;
  const voiceChannels = guild.channels.cache.filter((channel) => channel.type === ChannelType.GuildVoice).size;
  const categories = guild.channels.cache.filter((channel) => channel.type === ChannelType.GuildCategory).size;
  const verificationLevels = ['無', '低', '中', '高', '最高'];
  const filters = ['關閉', '無身分組成員', '全部成員'];
  const panel = modulePanel(
    context,
    '伺服器資訊',
    `本王巡視 **${guild.name}** 後呈上的領地摘要、安全狀態與設定覆蓋情形。`,
    { thumbnail: guild.iconURL?.({ size: 256, extension: 'png' }) }
  )
    .addTextDisplayComponents(v2Text([
      '## SERVER HEALTH | 領地健康度',
      ansiBlock([
        { color: alertCount ? COLORS.RED : pendingCount ? COLORS.GOLD : COLORS.GREEN, text: `[ STATUS ] ${alertCount ? '需要處理異常' : pendingCount ? '尚有功能待設定' : '所有設定正常'}` },
        { color: COLORS.GREEN, text: `[ READY  ] ${readyCount} 個模組正常` },
        { color: COLORS.GOLD, text: `[ SETUP  ] ${pendingCount} 個模組待設定` },
        { color: COLORS.RED, text: `[ ALERT  ] ${alertCount} 個模組異常` },
      ]),
      '## SERVER PROFILE | 領地基本資料',
      ansiBlock([
        { color: COLORS.GOLD, text: `[ MEMBERS  ] ${guild.memberCount} 位成員` },
        { color: COLORS.CYAN, text: `[ CHANNELS ] ${textChannels} 文字 / ${voiceChannels} 語音 / ${categories} 分類` },
        { color: COLORS.WHITE, text: `[ ASSETS   ] ${guild.roles.cache.size} 身分組 / ${guild.emojis.cache.size} 表情` },
      ]),
      `伺服器 ID：\`${guild.id}\``,
      `領主：${owner ? `**${owner.user.tag}**` : '未知'} | 建立日期：<t:${Math.floor(guild.createdTimestamp / 1000)}:d>`,
      `加成等級：**Lv.${guild.premiumTier}** (${guild.premiumSubscriptionCount || 0} 次加成)`,
      `偏好語系：\`${guild.preferredLocale || '未知'}\` | 社群功能：**${guild.features?.length || 0}** 項`,
    ].join('\n')))
    .addSeparatorComponents(v2Divider())
    .addTextDisplayComponents(v2Text([
      '## SECURITY & AI | 城防與國王智慧',
      `驗證層級：**${verificationLevels[guild.verificationLevel] || '未知'}** | 內容過濾：**${filters[guild.explicitContentFilter] || '未知'}**`,
      `AI 模型：\`${aiSettings.model || DEFAULT_AI_MODEL}\` | 聯網檢索：**${aiSettings.search_enabled ? '開啟' : '關閉'}**`,
      `派對模式：**${aiSettings.party_channel_id && aiSettings.party_expires_at > Date.now() ? '進行中' : '未啟用'}**`,
    ].join('\n')))
    .addSeparatorComponents(v2Divider())
      .addTextDisplayComponents(v2Text(`## CONFIG SNAPSHOT | 皇家設定摘要\n${diagnostics.map((item) => `${statusMarker(item.status)} **${item.label}**：${item.detail}`).join('\n')}`));
  return { components: [finishPanel(panel, context)] };
}

function renderBotStatus(context) {
  const ping = context.client?.ws?.ping;
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const memory = process.memoryUsage();
  const heapUsed = (memory.heapUsed / 1024 / 1024).toFixed(1);
  const heapTotal = (memory.heapTotal / 1024 / 1024).toFixed(1);
  const load = os.loadavg().map((amount) => amount.toFixed(2)).join(', ');
  const guildCount = context.client?.guilds?.cache?.size ?? 0;
  const memberCount = context.client?.guilds?.cache?.reduce?.((total, guild) => total + guild.memberCount, 0) ?? 0;
  const panel = modulePanel(context, '機器人狀態', '本王的大內健康報告：檢視目前程序、主機與連線狀況。')
    .addTextDisplayComponents(v2Text([
      '## SERVICE CORE | 國王核心服務',
      ansiBlock([
        { color: COLORS.CYAN, text: `[系統] Node ${process.version} | discord.js v${discordJsVersion}` },
        { color: COLORS.WHITE, text: `[運行] ${days}d ${hours}h ${minutes}m` },
        { color: Number.isFinite(ping) && ping < 150 ? COLORS.GREEN : COLORS.GOLD, text: `[延遲] ${Number.isFinite(ping) ? `${ping} ms` : '讀取中'}` },
      ]),
    ].join('\n')))
    .addSeparatorComponents(v2Divider())
    .addTextDisplayComponents(v2Text([
      '## HOST LOAD | 大內主機負載',
      ansiBlock([
        { color: COLORS.GREEN, text: `[ MEMORY ] ${heapUsed} / ${heapTotal} MB` },
        { color: COLORS.CYAN, text: `[ LOAD   ] ${load}` },
        { color: COLORS.GOLD, text: `[ SCOPE  ] ${guildCount} 個伺服器 / ${memberCount} 位成員` },
      ]),
      `處理器：\`${os.cpus()[0]?.model?.trim() || '未知'}\``,
      `執行環境：\`${os.type()} ${os.release()} (${os.arch()})\``,
    ].join('\n')));
  return { components: [finishPanel(panel, context)] };
}

function renderAnnouncement(context) {
  const mode = context.pending.announceMention || 'none';
  const modeText = {
    none: '不提及任何人',
    here: '提及 @here',
    everyone: '提及 @everyone',
    role: context.pending.announceRole ? `提及 <@&${context.pending.announceRole}>` : '提及指定身分組 (尚未選擇)',
  }[mode];
  const panel = modulePanel(context, '發布公告', [
    '聖旨在御前預覽確認前不會公開頒布；附件僅接受圖片，最多 3 張。',
    ansiBlock([
      { color: context.pending.announceChannel ? COLORS.GREEN : COLORS.GOLD, text: `[ CHANNEL ] ${context.pending.announceChannel ? `#${context.pending.announceChannel}` : '尚未選擇目標頻道'}` },
      { color: mode === 'everyone' ? COLORS.RED : mode === 'none' ? COLORS.CYAN : COLORS.GOLD, text: `[ MENTION ] ${modeText}` },
      { color: COLORS.WHITE, text: '[ STATUS  ] 等待撰寫與預覽確認' },
    ]),
    `目前目標：${context.pending.announceChannel ? `<#${context.pending.announceChannel}>` : '**尚未選擇**'}`,
  ].join('\n'))
    .addTextDisplayComponents(v2Text('## COMPOSER | 頒旨目標\n先選擇頻道與互斥的召見模式，再開啟聖旨編輯器。'))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId(id(context, 'announce_channel')).setPlaceholder('選擇公告發布頻道').addChannelTypes(ChannelType.GuildText)
    ))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId(id(context, 'announce_mention')).setPlaceholder('選擇提及模式').addOptions(
        { label: '不提及任何人', value: 'none', default: mode === 'none' },
        { label: '提及 @here', value: 'here', default: mode === 'here' },
        { label: '提及 @everyone', value: 'everyone', default: mode === 'everyone' },
        { label: '提及指定身分組', value: 'role', default: mode === 'role' }
      )
    ))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder().setCustomId(id(context, 'announce_role')).setPlaceholder('指定要提及的身分組 (選填)')
    ))
    .addActionRowComponents(actionButtons(context, [['announce_compose', '撰寫並預覽公告', ButtonStyle.Primary]]));
  return { components: [finishPanel(panel, context)] };
}

async function renderMemberLookup(context) {
  const member = context.pending.memberUser
    ? await context.guild.members.fetch(context.pending.memberUser).catch(() => null)
    : null;
  const user = member
    ? (typeof member.user.fetch === 'function' ? await member.user.fetch().catch(() => member.user) : member.user)
    : null;
  const avatar = member?.displayAvatarURL?.({ size: 256, extension: 'png' })
    || user?.displayAvatarURL?.({ size: 256, extension: 'png' });
  const panel = modulePanel(
    context,
    '成員查詢',
    member
      ? `已從皇家名冊調閱 **${member.displayName}** 的私人管理檔案。`
      : '選擇子民後查看帳號、活動、權限與爵位紀錄。查詢內容僅顯示於此私人面板。',
    { thumbnail: avatar }
  )
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder().setCustomId(id(context, 'member_user')).setPlaceholder('選擇要查詢的成員')
    ));
  if (!context.pending.memberUser) {
    panel.addTextDisplayComponents(v2Text(ansiBlock([{ color: COLORS.GRAY, text: '[ WAITING ] 尚未選擇成員' }])));
    return { components: [finishPanel(panel, context)] };
  }
  if (!member) {
    panel.addTextDisplayComponents(v2Text('找不到選取的成員，請重新選擇。'));
    return { components: [finishPanel(panel, context)] };
  }
  const level = getUserLevel(context.guild.id, member.id);
  const xpNeeded = getXpForLevel(level.level + 1);
  const progress = Math.min(100, Math.floor((level.xp / Math.max(1, xpNeeded)) * 100));
  const memberRoles = member.roles.cache
    .filter((role) => role.id !== context.guild.id)
    .sort((a, b) => b.position - a.position);
  const roles = memberRoles
    .map((role) => role.toString())
    .slice(0, 12)
    .join(', ') || '無';
  const permissionNames = [
    [PermissionFlagsBits.Administrator, 'Administrator'],
    [PermissionFlagsBits.ManageGuild, '管理伺服器'],
    [PermissionFlagsBits.ManageRoles, '管理身分組'],
    [PermissionFlagsBits.ManageMessages, '管理訊息'],
    [PermissionFlagsBits.KickMembers, '踢除成員'],
    [PermissionFlagsBits.BanMembers, '封鎖成員'],
  ].filter(([permission]) => member.permissions?.has?.(permission)).map(([, label]) => label);
  const statusLabels = { online: '線上', idle: '閒置', dnd: '請勿打擾', offline: '離線' };
  const presence = statusLabels[member.presence?.status] || '未提供';
  const activities = member.presence?.activities?.map((activity) => activity.name).filter(Boolean).join('、') || '無';
  const badges = user.flags?.toArray?.().join('、') || '無';
  const timeout = member.communicationDisabledUntilTimestamp > Date.now()
    ? `<t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:R> 結束`
    : '無';
  panel
    .addSeparatorComponents(v2Divider())
    .addTextDisplayComponents(v2Text([
      `## MEMBER PROFILE | ${member.displayName}`,
      ansiBlock([
        { color: COLORS.GOLD, text: `[ LEVEL  ] Lv.${level.level} / ${getRankTitle(level.level)}` },
        { color: COLORS.CYAN, text: `[ XP     ] ${level.xp} / ${xpNeeded} (${progress}%)` },
        { color: COLORS.GREEN, text: `[ ACTIVE ] ${level.total_messages} 則訊息 / ${level.total_voice_mins || 0} 分鐘語音` },
      ]),
      `帳號：**${user.tag}** | ID：\`${member.id}\` | 類型：**${user.bot ? '機器人' : '使用者'}**`,
      `暱稱：**${member.nickname || '未設定'}** | 狀態：**${presence}** | 活動：**${activities}**`,
      `建立帳號：<t:${Math.floor(user.createdTimestamp / 1000)}:F> (<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`,
      `加入伺服器：${member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)` : '未知'}`,
    ].join('\n')))
    .addSeparatorComponents(v2Divider())
    .addTextDisplayComponents(v2Text([
      '## MODERATION & ROLES | 管理與身分',
      `伺服器加成：**${member.premiumSinceTimestamp ? `自 <t:${Math.floor(member.premiumSinceTimestamp / 1000)}:d> 起加成` : '無'}** | 禁言狀態：**${timeout}**`,
      `帳號徽章：${badges}`,
      `管理權限：${permissionNames.length ? permissionNames.map((name) => `\`${name}\``).join(' ') : '無特殊管理權限'}`,
      `身分組數量：**${memberRoles.size}** | 最高身分組：${memberRoles.first()?.toString() || '無'}`,
      `主要身分組：${roles}`,
    ].join('\n')));
  return { components: [finishPanel(panel, context)] };
}

function renderConfirm(context) {
  const labels = {
    self_publish: `將在 ${context.pending.selfPublishChannel ? `<#${context.pending.selfPublishChannel}>` : '選取的頻道'} 張貼新的皇家自助身分領取佈告。`,
    reaction_create: `將在 ${context.pending.reactionChannel ? `<#${context.pending.reactionChannel}>` : '選取的頻道'} 建立新的皇家按鈕身分站。`,
    reaction_delete: `將撤除皇家按鈕身分站公開訊息 \`${context.pending.reactionDeleteMessage || '尚未選取'}\` 與其設定。`,
    steam_publish: '將立即在已設定的推播頻道頒布 Steam 皇家特價榜聖旨。',
    steam_free_publish: '將立即在已設定的限時免費頻道頒布 Steam 限時免費御賜聖旨。',
    ai_party: `將在 ${context.pending.aiPartyChannel ? `<#${context.pending.aiPartyChannel}>` : '選取頻道'} 啟動 AI 派對模式並公開發送通知。`,
  };
  const message = labels[context.pending.confirm] || '此操作會產生公開變更。';
  const panel = v2Panel(UI_COLORS.DANGER)
    .addTextDisplayComponents(v2Text(
      '-# ROYAL ADMINISTRATOR CONTROL CENTER  /  CONFIRMATION\n# 📜 確認御前公開操作\n這項動作會對領地產生公開影響，請再次核對。'
    ))
    .addSeparatorComponents(v2Divider())
    .addTextDisplayComponents(v2Text(`## 頒令影響\n${message}\n\n> 按下確認後會立即執行，無法由此面板復原。`))
    .addActionRowComponents(actionButtons(context, [
      ['confirm', '確認執行', ButtonStyle.Danger],
      ['cancel', '取消', ButtonStyle.Secondary],
    ]));
  return { components: [panel] };
}

function modulePanel(context, title, description, { thumbnail = null } = {}) {
  const meta = MODULE_STYLE[title] || { section: 'CONTROL PANEL', color: UI_COLORS.ROYAL };
  const notice = typeof context.notice === 'string'
    ? { label: 'SAVED', color: COLORS.GREEN, text: context.notice }
    : context.notice;
  const feedback = context.notice
    ? `\n\n${ansiBlock([{ color: notice.color, text: `[ ${notice.label} ] ${notice.text}` }])}`
    : '';
  const heading = `-# ROYAL ADMINISTRATOR CONTROL CENTER  /  ${meta.section}\n# ${MODULE_TITLES[title] || title}\n${description}${feedback}`;
  const panel = v2Panel(meta.color);
  if (thumbnail) {
    panel.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(v2Text(heading))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail).setDescription(`${title} 圖示`))
    );
  } else {
    panel.addTextDisplayComponents(v2Text(heading));
  }
  return panel.addSeparatorComponents(v2Divider());
}

function finishPanel(panel, context) {
  return panel
    .addSeparatorComponents(v2Divider())
    .addActionRowComponents(actionButtons(context, [['back', '返回總覽', ButtonStyle.Secondary]]));
}

function basePanel(title, description) {
  return v2Panel(UI_COLORS.ROYAL).addTextDisplayComponents(v2Text(`# 🐕👑 ${title}\n${description}`));
}

function buttonRow(context, pages) {
  return new ActionRowBuilder().addComponents(pages.map(([view, label, style = ButtonStyle.Secondary]) =>
    new ButtonBuilder().setCustomId(id(context, `view:${view}`)).setLabel(label).setStyle(style)
  ));
}

function actionButtons(context, definitions) {
  return new ActionRowBuilder().addComponents(definitions.map(([action, label, style]) =>
    new ButtonBuilder().setCustomId(id(context, action)).setLabel(label).setStyle(style)
  ));
}

function textRow(customId, label, value, style, required = true) {
  const input = new TextInputBuilder().setCustomId(customId).setLabel(label).setStyle(style).setRequired(required);
  if (value) input.setValue(String(value).slice(0, style === TextInputStyle.Short ? 400 : 4000));
  return new ActionRowBuilder().addComponents(input);
}

function id(context, action) {
  return scopedCustomId('settings', context.userId, ...String(action).split(':'));
}

function parseSettingsCustomId(customId, context) {
  return parseScopedCustomId(customId, 'settings', context.userId);
}

function isAdministrator(interaction) {
  return Boolean(interaction.memberPermissions?.has?.(PermissionFlagsBits.Administrator)
    || interaction.member?.permissions?.has?.(PermissionFlagsBits.Administrator));
}

function aiUnlocked(context) {
  return getAiSettings(context.guild.id).admin_ids.includes(context.userId);
}

function requireAiUnlock(component, context) {
  if (aiUnlocked(context)) return true;
  component.reply(v2Notice('🔐 國王智慧核心已鎖定', '請回到皇家管理控制台的 AI 頁完成御前身分驗證。', UI_COLORS.DANGER)).catch(() => {});
  return false;
}

async function getDiagnostics(guild) {
  const settings = getGuildSettings(guild.id);
  const aiSettings = getAiSettings(guild.id);
  const reactionRoles = getReactionRolesByGuild(guild.id);
  const channelIds = [
    settings.welcome_channel,
    settings.log_channel,
    settings.steam_deal_channel,
    settings.steam_free_channel,
    ...reactionRoles.map((entry) => entry.channel_id),
  ].filter(Boolean);
  const availableChannelIds = new Set();
  const channelNames = new Map();
  await Promise.all(channelIds.map(async (channelId) => {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (channel) {
      availableChannelIds.add(channelId);
      channelNames.set(channelId, channel.name || '未命名頻道');
    }
  }));
  return buildGuildDiagnostics({
    settings,
    aiSettings: { ...aiSettings, model: aiSettings.model || DEFAULT_AI_MODEL },
    reactionRoles,
    availableChannelIds,
    channelNames,
    hasDiscordToken: !!process.env.DISCORD_TOKEN,
    hasGoogleAiKey: !!process.env.GOOGLE_AI_KEY,
    hasAiAdminPassword: !!process.env.AI_ADMIN_PASSWORD,
  });
}

function statusMarker(status) {
  if (status === '正常') return '[OK]';
  if (status === '未設定') return '[--]';
  return '[!!]';
}

function formatDiagnosticLine(item) {
  return {
    color: item.status === '正常' ? COLORS.GREEN : item.status === '未設定' ? COLORS.GOLD : COLORS.RED,
    text: `${statusMarker(item.status)} ${item.label}: ${item.detail}`,
  };
}

function getSelfRoles(guildId) {
  return normalizeSelfRoleSettings(getGuildSettings(guildId).selfrole_roles);
}

function extractEmojiAndLabel(text) {
  text = String(text ?? '').trim();
  if (!text) return { emoji: null, label: null };

  // 1. Custom emoji mention: <:royal:123456789012345678> or <a:royal:123456789012345678>
  const customMentionMatch = text.match(/^(<a?:[A-Za-z0-9_]+:\d{17,20}>)(.*)$/);
  if (customMentionMatch) {
    return { emoji: customMentionMatch[1], label: customMentionMatch[2].trim() || null };
  }

  // 2. Custom emoji identifier: a:royal:123456789012345678 or royal:123456789012345678
  const customIdentifierMatch = text.match(/^(a?:?[A-Za-z0-9_]+:\d{17,20})(.*)$/);
  if (customIdentifierMatch) {
    return { emoji: customIdentifierMatch[1], label: customIdentifierMatch[2].trim() || null };
  }

  // 3. Custom emoji ID: 123456789012345678
  const customIdMatch = text.match(/^(\d{17,20})(.*)$/);
  if (customIdMatch) {
    return { emoji: customIdMatch[1], label: customIdMatch[2].trim() || null };
  }

  // 4. Unicode emoji at the start (using \p{Extended_Pictographic} to match only pictographic emojis)
  const unicodeEmojiMatch = text.match(/^(\p{Extended_Pictographic})(.*)$/u);
  if (unicodeEmojiMatch) {
    return { emoji: unicodeEmojiMatch[1], label: unicodeEmojiMatch[2].trim() || null };
  }

  // 5. No emoji found, the entire text is the label
  return { emoji: null, label: text };
}

function parseReactionPairs(guild, source) {
  const pairs = [];
  for (const entry of splitReactionPairEntries(source)) {
    const parsed = parseReactionPairEntry(entry);
    if (parsed.error) return parsed;
    const { buttonSpec, roleRef } = parsed;
    const { emoji, label } = extractEmojiAndLabel(buttonSpec);

    let normalizedEmoji = null;
    if (emoji) {
      const emojiValidation = normalizeReactionEmojiInput(guild, emoji);
      if (emojiValidation.error) return { error: emojiValidation.error };
      normalizedEmoji = emojiValidation.emoji;
    }

    const role = resolveRoleReference(guild, roleRef);
    if (!role) return { error: `找不到身分組：\`${roleRef}\`。可以貼上 @身分組、身分組名稱或 ID。` };
    const invalid = validateAssignableRole(guild, role);
    if (invalid) return { error: `${role.name}：${invalid}` };

    const finalLabel = label || null;
    pairs.push({ emoji: normalizedEmoji, label: finalLabel, role });
  }
  if (!pairs.length) return { error: '至少需要一組按鈕設定與身分組配對。' };
  if (pairs.length > 20) return { error: '皇家按鈕身分站最多只能建立 20 組配對。' };
  return { pairs };
}

function addPendingReactionPair(currentPairs, pair) {
  const pairs = Array.isArray(currentPairs) ? currentPairs : [];
  const nextPairs = pairs.filter((item) => item.role.id !== pair.role.id);
  if (nextPairs.length >= 20) throw new Error('皇家按鈕身分站最多只能建立 20 組配對。');
  return [...nextPairs, pair];
}

function tryAddReactionPair(context, emojiInput) {
  if (!context.pending.reactionRole) {
    return { title: '🎭 尚未選擇身分組', message: '請先從按鈕身分組頁面的選單挑選要綁定的身分組。' };
  }
  const role = context.guild.roles.cache.get(context.pending.reactionRole);
  const invalid = validateAssignableRole(context.guild, role);
  if (invalid) return { title: '🎭 無法加入按鈕配對', message: invalid };
  if (!emojiInput) return { title: '🎭 尚未填寫內容', message: '請填入按鈕的 emoji 或文字。' };

  const { emoji, label } = extractEmojiAndLabel(emojiInput);

  let normalizedEmoji = null;
  if (emoji) {
    const emojiValidation = normalizeReactionEmojiInput(context.guild, emoji);
    if (emojiValidation.error) return { title: '🎭 emoji 無法使用', message: emojiValidation.error };
    normalizedEmoji = emojiValidation.emoji;
  }

  const finalLabel = label || null;
  const currentPairs = Array.isArray(context.pending.reactionPairs) ? context.pending.reactionPairs : [];
  const willReplace = currentPairs.some(
    (item) => item.role.id === role.id || (item.emoji === normalizedEmoji && item.label === finalLabel)
  );
  if (!willReplace && currentPairs.length >= 20) {
    return { title: '🎭 配對數量已滿', message: '皇家按鈕身分站最多只能建立 20 組配對。' };
  }

  context.pending.reactionPairs = addPendingReactionPair(context.pending.reactionPairs, {
    emoji: normalizedEmoji,
    label: finalLabel,
    role
  });

  const emojiPart = normalizedEmoji ? normalizedEmoji : '';
  const labelPart = finalLabel || role.name;
  const display = emojiPart && labelPart ? `${emojiPart} ${labelPart}` : (emojiPart || labelPart);
  context.notice = `按鈕配對已新增：[${display}] -> ${role.name}`;
  return null;
}

function buildReactionEmojiOptions(guild) {
  const guildEmojis = [...guild.emojis.cache.values()].slice(0, 20).map((e) => ({
    label: e.name,
    value: `guild:${e.id}`,
    emoji: { id: e.id, name: e.name, animated: e.animated },
  }));
  const remaining = 25 - guildEmojis.length;
  const common = COMMON_REACTION_EMOJIS.slice(0, Math.max(remaining, 2)).map((e) => ({
    label: e.label,
    value: `common:${e.char}`,
    emoji: { name: e.char },
  }));
  return [...guildEmojis, ...common].slice(0, 25);
}

function normalizeReactionEmojiInput(guild, rawEmoji) {
  const emoji = String(rawEmoji ?? '').trim();
  const custom = parseCustomEmojiReference(emoji);
  if (!custom) {
    // 純文字輸入：嘗試從伺服器自訂 emoji 名稱查找（不區分大小寫）
    const byName = findInCache(guild.emojis?.cache, (e) => e.name?.toLowerCase() === emoji.toLowerCase());
    if (byName) {
      return { emoji: byName.identifier || `${byName.name}:${byName.id}` };
    }
    return { emoji };
  }

  const guildEmoji = guild.emojis?.cache?.get(custom.id);
  if (!guildEmoji) {
    return {
      error: `自訂 emoji \`${emoji}\` 不在這個伺服器，機器人無法把它放到按鈕上。請改用本伺服器的自訂 emoji、一般 Unicode emoji（如 🎮），或直接輸入伺服器 emoji 名稱（如 \`sword\`）。`,
    };
  }

  return { emoji: guildEmoji.identifier || `${guildEmoji.name}:${guildEmoji.id}` };
}

function parseCustomEmojiReference(value) {
  const text = String(value ?? '').trim();
  const mention = text.match(CUSTOM_EMOJI_PATTERN);
  if (mention) return { name: mention[1], id: mention[2] };

  // 動畫 emoji identifier: a:name:id
  const animated = text.match(/^a:([A-Za-z0-9_]+):(\d{17,20})$/);
  if (animated) return { name: animated[1], id: animated[2] };

  const identifier = text.match(CUSTOM_EMOJI_IDENTIFIER_PATTERN);
  if (identifier) return { name: identifier[1], id: identifier[2] };

  if (DISCORD_ID_PATTERN.test(text)) return { id: text };
  return null;
}

function splitReactionPairEntries(source) {
  return String(source)
    .split(/[,\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseReactionPairEntry(entry) {
  entry = String(entry ?? '').trim();
  const separator = Math.max(entry.lastIndexOf(':'), entry.lastIndexOf('：'));
  if (separator > 0) {
    const buttonSpec = entry.slice(0, separator).trim();
    const roleRef = entry.slice(separator + 1).trim();
    if (buttonSpec && roleRef) return { buttonSpec, roleRef };
  }

  // No colon: try to extract emoji and label/roleRef
  const { emoji, label } = extractEmojiAndLabel(entry);
  if (emoji && label) {
    return { buttonSpec: emoji, roleRef: label };
  }

  return { buttonSpec: entry, roleRef: entry };
}

function resolveRoleReference(guild, roleRef) {
  const reference = String(roleRef ?? '').trim();
  const id = reference.match(/^<@&(\d{17,20})>$/)?.[1] || (/^\d{17,20}$/.test(reference) ? reference : null);
  if (id) return guild.roles.cache.get(id);

  const roleName = reference.replace(/^@/, '').trim().toLocaleLowerCase('zh-TW');
  return [...guild.roles.cache.values()]
    .find((role) => role.name?.toLocaleLowerCase('zh-TW') === roleName);
}

function validateReactionStationChannel(guild, channel) {
  const permissions = channel.permissionsFor?.(guild.members.me);
  if (!permissions) return '本王無法檢查此頻道權限，請確認機器人看得到該頻道。';

  const missing = [
    [PermissionFlagsBits.ViewChannel, '查看頻道'],
    [PermissionFlagsBits.SendMessages, '傳送訊息'],
  ].filter(([permission]) => !permissions.has(permission)).map(([, label]) => label);

  return missing.length ? `請在該頻道補上機器人權限：${missing.join('、')}。` : null;
}

function buildSelfRoleMenuPayload(guild, roles, description) {
  const valid = roles
    .map((entry) => ({ entry, role: guild.roles.cache.get(entry.id) }))
    .filter(({ role }) => role && !validateAssignableRole(guild, role));
  if (!valid.length) throw new Error('沒有可張貼的皇家自助身分領取選項。');
  const select = new StringSelectMenuBuilder().setCustomId('selfrole_select').setPlaceholder('挑選你要領取或取消的皇家身分').setMinValues(0).setMaxValues(valid.length)
    .addOptions(valid.map(({ entry, role }) => ({
      label: role.name,
      value: role.id,
      description: entry.requirement ? `需先擁有 ${guild.roles.cache.get(entry.requirement)?.name || '指定身分組'}` : `領取或交還 ${role.name}`,
    })));
  const panel = basePanel('皇家自助身分領取處', description || '子民請從下方選單挑選要領取或交還的身分組。')
    .addActionRowComponents(new ActionRowBuilder().addComponents(select));
  return v2Payload([panel]);
}

async function publishSelfRoleMenu(guild, channel, roles, description) {
  await channel.send(buildSelfRoleMenuPayload(guild, roles, description));
}

async function createReactionStation(guild, channel, pairs, title) {
  const payload = buildButtonRoleStationPayload(guild, pairs, title);
  const message = await channel.send(payload);

  try {
    for (const { emoji, label, role } of pairs) {
      addReactionRole(guild.id, channel.id, message.id, emoji || null, label || null, role.id);
    }
  } catch (error) {
    deleteReactionRolesByMessage(message.id);
    await message.delete().catch(() => {});
    throw error;
  }
}

function buildButtonRoleStationPayload(guild, pairs, title) {
  const rows = [];
  let currentRow = new ActionRowBuilder();

  for (let i = 0; i < pairs.length; i++) {
    const { emoji, label, role } = pairs[i];
    const button = new ButtonBuilder()
      .setCustomId(`buttonrole:${role.id}`)
      .setStyle(ButtonStyle.Secondary);

    if (label) {
      button.setLabel(label);
    } else if (!emoji) {
      button.setLabel(role.name);
    }

    if (emoji) {
      button.setEmoji(resolveReactableEmoji(guild, emoji));
    }

    currentRow.addComponents(button);

    if ((i + 1) % 5 === 0 || i === pairs.length - 1) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
  }

  const payload = v2Payload([
    basePanel(title || '皇家按鈕身分站', '子民點擊下方按鈕即可領取或交還對應的身分組。')
  ]);
  payload.components.push(...rows);
  return payload;
}

function resolveReactableEmoji(guild, emoji) {
  const custom = parseCustomEmojiReference(emoji);
  if (custom) {
    const cached = guild.emojis?.cache?.get(custom.id);
    if (cached) return cached;
  }
  // Fallback：用 identifier 全文比對搜尋（處理邊緣情況）
  const byIdentifier = findInCache(guild.emojis?.cache, (e) => e.identifier === emoji);
  if (byIdentifier) return byIdentifier;
  return emoji;
}

function findInCache(cache, predicate) {
  if (!cache) return null;
  if (typeof cache.find === 'function') return cache.find(predicate);
  return [...cache.values()].find(predicate) || null;
}

function getReactionEmojiFailureMessage(emoji, error) {
  const reason = error?.rawError?.message || error?.message || 'Discord 拒絕使用此 emoji';
  return `本王無法把 \`${emoji}\` 放到按鈕上：${reason}。請確認這是本伺服器可用的 emoji。`;
}

async function deleteReactionStation(guild, messageId) {
  const entry = getReactionRolesByGuild(guild.id).find((item) => item.message_id === messageId);
  if (!entry) throw new Error('找不到選取的皇家按鈕身分站。');
  const channel = await guild.channels.fetch(entry.channel_id).catch(() => null);
  if (channel?.isTextBased()) {
    const message = await channel.messages.fetch(messageId).catch(() => null);
    await message?.delete().catch(() => {});
  }
  deleteReactionRolesByMessage(messageId);
}

async function publishSteamDeals(guild) {
  const settings = getGuildSettings(guild.id);
  const channel = await guild.channels.fetch(settings.steam_deal_channel).catch(() => null);
  if (!channel?.isTextBased()) throw new Error('尚未設定可用的 Steam 推播頻道。');
  const deals = await fetchSteamSpecialDeals(10);
  await channel.send(buildSteamDealsPayload(deals));
}

async function publishSteamFreeGames(guild) {
  const settings = getGuildSettings(guild.id);
  const channel = await guild.channels.fetch(settings.steam_free_channel).catch(() => null);
  if (!channel?.isTextBased()) throw new Error('尚未設定可用的 Steam 限時免費推播頻道。');
  const games = await fetchSteamLimitedFreeGames(10);
  if (games.length === 0) return 0;
  await channel.send(buildSteamFreeGamesPayload(games));
  return games.length;
}

async function startAiParty(guild, channelId, minutes) {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) throw new Error('派對頻道不存在或無法發送訊息。');
  updateAiSetting(guild.id, 'party_channel_id', channelId);
  updateAiSetting(guild.id, 'party_expires_at', Date.now() + minutes * 60_000);
  updateAiSetting(guild.id, 'enabled', 1);
  await channel.send(v2Notice('🎉 皇家 AI 宴會開席', `接下來 ${minutes} 分鐘內，任何子民都可在此頻道提及本王進行聊天。`, UI_COLORS.ROYAL, { ephemeral: false }));
}

function closePanel(components) {
  const panel = components[0];
  for (const child of panel.components ?? []) {
    if (child.components) child.components.forEach((component) => component.setDisabled?.(true));
  }
  panel.addSeparatorComponents(v2Divider()).addTextDisplayComponents(v2Text('## ⌛ 御前面板已闔上\n皇家設定面板已逾時，請重新使用 `/設定`。'));
  return components;
}

export const settingsViewTesting = {
  renderHome,
  renderWelcome,
  renderSteam,
  renderSelfRole,
  renderReaction,
  renderAi,
  renderServerInfo,
  renderBotStatus,
  renderAnnouncement,
  renderMemberLookup,
  renderConfirm,
  id,
  parseSettingsCustomId,
  actionValue,
  confirmationReturnView,
  buildModal,
  openModal,
  parseReactionPairs,
  buildButtonRoleStationPayload,
  closePanel,
  buildSelfRoleMenuPayload,
  extractEmojiAndLabel,
};

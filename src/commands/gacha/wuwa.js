import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  FileUploadBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import {
  bindWuwaAccount,
  deleteWuwaAccount,
  getWuwaAccount,
  updateWuwaAccount,
} from '../../utils/database.js';
import {
  ephemeralV2Payload,
  v2Divider,
  v2EditPayload,
  v2Notice,
  v2Panel,
  v2Text,
} from '../../utils/componentsV2.js';
import { UI_COLORS } from '../../utils/style.js';
import { logger } from '../../utils/logger.js';
import { WUWA_POOL_TYPES } from './lib/constants.js';
import { mergeWuwaHistories, normalizeHistory } from './lib/history.js';
import { maskWuwaUid, readWuwaImport } from './lib/importer.js';
import { fetchWuwaHistory } from './lib/provider.js';
import { renderWuwaCard } from './lib/image.js';
import { buildWuwaCardPayload } from './lib/reply.js';

const SESSION_TIMEOUT = 10 * 60_000;
const WUWA_IMPORT_SCRIPT_URL = 'https://raw.githubusercontent.com/wuwatracker/wuwatracker/c46dbadc006ed0d2c3f3a20b06b448a45475d32b/import.ps1';
const WUWA_IMPORT_COMMAND = `iwr -UseBasicParsing -Headers @{"User-Agent"="Mozilla/5.0"} ${WUWA_IMPORT_SCRIPT_URL} | iex`;

export const data = new SlashCommandBuilder()
  .setName('鳴潮抽卡')
  .setDescription('🌊 查詢、綁定與更新鳴潮喚取紀錄');

export async function execute(interaction) {
  const sessionId = interaction.id;
  const ownerId = interaction.user.id;
  let sessionActive = true;
  let homeRefresh = Promise.resolve(false);
  const refreshHome = () => {
    homeRefresh = homeRefresh
      .catch(() => false)
      .then(() => refreshWuwaHome(interaction, ownerId, () => sessionActive));
    return homeRefresh;
  };
  await interaction.reply(buildHomePayload(ownerId, getAccount(ownerId)));
  const response = await interaction.fetchReply();
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: SESSION_TIMEOUT,
  });

  collector.on('collect', async (component) => {
    if (component.user.id !== ownerId) {
      return component.reply(v2Notice('🌊 這份喚取卷宗不屬於你', '請自行使用 `/鳴潮抽卡` 開啟私人卷宗。', UI_COLORS.WARNING));
    }
    try {
      const action = parseAction(component.customId, sessionId);
      if (!action) return;
      if (action === 'bind') return await openImportFlow(component, sessionId, false, refreshHome);
      if (action === 'update') return await openImportFlow(component, sessionId, true, refreshHome);
      if (action === 'query') return openPoolSelector(component, sessionId);
      if (action === 'unbind') return await openUnbindConfirm(component, sessionId, refreshHome);
    } catch (error) {
      logger.warn(`[Wuwa] action failed user=${ownerId} code=${safeCode(error)}: ${error.message}`);
      const notice = v2Notice('🌊 皇家喚取卷宗處理失敗', userErrorMessage(error), UI_COLORS.WARNING);
      if (component.replied || component.deferred) await component.followUp(notice).catch(() => {});
      else await component.reply(notice).catch(() => {});
    }
  });

  collector.on('end', async () => {
    sessionActive = false;
    await homeRefresh.catch(() => false);
    await interaction.editReply(v2EditPayload(buildHomePayload(ownerId, getAccount(ownerId), true))).catch(() => {});
  });
}

export async function refreshWuwaHome(interaction, userId, isSessionActive = () => true) {
  if (!isSessionActive()) return false;
  await interaction.editReply(v2EditPayload(buildHomePayload(userId, getAccount(userId))));
  return true;
}

export function buildHomePayload(userId, account, expired = false) {
  const panel = v2Panel(UI_COLORS.WUWA)
    .addTextDisplayComponents(v2Text([
      '# 🌊 皇家鳴潮喚取卷宗',
      account
        ? `已綁定漂泊者 UID：**${maskWuwaUid(account.playerUid)}**`
        : '尚未綁定鳴潮帳號。首次使用請提供遊戲內喚取紀錄 URL 或匯出 JSON。',
      account ? `最後更新：<t:${Math.floor(account.updatedAt / 1000)}:R>` : null,
      '-# 每個 Discord 使用者限綁一個 UID；臨時授權完成查詢後立即丟棄。',
    ].filter(Boolean).join('\n')))
    .addSeparatorComponents(v2Divider())
    .addTextDisplayComponents(v2Text([
      '## 1　首先，啟動遊戲並打開你的遊戲內喚取歷史紀錄',
      '之後，打開 Windows PowerShell 並貼上以下指令。',
      '',
      '```powershell',
      WUWA_IMPORT_COMMAND,
      '```',
      `注意：此指令會從 WuWa Tracker 官方 GitHub 下載並執行固定版本腳本，只用來從遊戲日誌提取喚取歷史 URL。你可以先[查看腳本](${WUWA_IMPORT_SCRIPT_URL})。`,
      '',
      '## 2　貼上取得的 URL',
      '腳本完成後會把 URL 複製到剪貼簿。按下方「綁定帳號」或「更新紀錄」，貼入 URL 欄位。',
      '-# URL 含臨時授權資訊，請勿張貼到公開頻道。',
    ].join('\n')))
    .addSeparatorComponents(v2Divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(wuwaId(userId, 'bind'))
          .setLabel('綁定帳號')
          .setStyle(ButtonStyle.Success)
          .setDisabled(Boolean(account || expired)),
        new ButtonBuilder()
          .setCustomId(wuwaId(userId, 'query'))
          .setLabel('查詢抽卡')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(Boolean(!account || expired)),
        new ButtonBuilder()
          .setCustomId(wuwaId(userId, 'update'))
          .setLabel('更新紀錄')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(Boolean(!account || expired)),
        new ButtonBuilder()
          .setCustomId(wuwaId(userId, 'unbind'))
          .setLabel('解除綁定')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(Boolean(!account || expired)),
        new ButtonBuilder()
          .setLabel('查看 PowerShell 腳本')
          .setStyle(ButtonStyle.Link)
          .setURL(WUWA_IMPORT_SCRIPT_URL)
      )
    );
  if (expired) panel.addTextDisplayComponents(v2Text('## ⌛ 操作頁已逾時\n請重新使用 `/鳴潮抽卡`。'));
  return ephemeralV2Payload([panel]);
}

export function buildImportModal(sessionId, updating = false) {
  return new ModalBuilder()
    .setCustomId(`wuwa_import:${sessionId}:${updating ? 'update' : 'bind'}`)
    .setTitle(updating ? '更新鳴潮喚取紀錄' : '綁定鳴潮帳號')
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent([
        '**匯入方式**',
        '請先在遊戲內開啟喚取紀錄，再從 `/鳴潮抽卡` 首頁複製 PowerShell 指令取得 URL。',
        '貼上喚取紀錄 URL，或上傳支援的 JSON；兩者皆有時優先使用 JSON。',
      ].join('\n'))
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('喚取紀錄 URL（選填）')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('wuwa_url')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(4000)
            .setPlaceholder('https://aki-gm-resources-oversea.aki-game.net/...')
        ),
      new LabelBuilder()
        .setLabel('抽卡紀錄 JSON（選填，最大 2 MB）')
        .setFileUploadComponent(
          new FileUploadBuilder()
            .setCustomId('wuwa_json')
            .setMinValues(0)
            .setMaxValues(1)
            .setRequired(false)
        )
    );
}

export function buildPoolSelectionPayload(sessionId, expired = false) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`wuwa_pool:${sessionId}`)
    .setPlaceholder('選擇要生成詳細圖片的卡池')
    .setMinValues(1)
    .setMaxValues(1)
    .setDisabled(expired)
    .addOptions(WUWA_POOL_TYPES.map((pool) => ({
      label: pool.name,
      value: pool.id,
      description: `五星硬保底 ${pool.hardPity} 抽`,
    })));
  const panel = v2Panel(UI_COLORS.WUWA)
    .addTextDisplayComponents(v2Text('# 🌊 選擇喚取卡池\n選定後會生成 1600×900 的私人詳細卷宗。'))
    .addActionRowComponents(new ActionRowBuilder().addComponents(select));
  if (expired) panel.addTextDisplayComponents(v2Text('## ⌛ 卡池選擇已逾時'));
  return ephemeralV2Payload([panel]);
}

async function openImportFlow(component, sessionId, updating, onAccountChanged = async () => {}) {
  const existing = getAccount(component.user.id);
  if (updating && !existing) return component.reply(v2Notice('尚未綁定帳號', '請先完成鳴潮帳號綁定。', UI_COLORS.WARNING));
  if (!updating && existing) return component.reply(v2Notice('已綁定帳號', '每位使用者限綁一個 UID；如需更換請先解除綁定。', UI_COLORS.WARNING));

  const modal = buildImportModal(sessionId, updating);
  await component.showModal(modal);
  const submit = await component.awaitModalSubmit({
    time: 3 * 60_000,
    filter: (candidate) => candidate.user.id === component.user.id && candidate.customId === modal.data.custom_id,
  }).catch(() => null);
  if (!submit) return;

  await submit.deferReply({ flags: MessageFlags.Ephemeral });
  const attachment = [...(submit.fields.getUploadedFiles('wuwa_json', false)?.values() ?? [])][0] ?? null;
  const urlText = submit.fields.getTextInputValue('wuwa_url').trim();
  if (!attachment && !urlText) {
    return submit.editReply(v2EditPayload(v2Notice('缺少匯入資料', '請貼上喚取紀錄 URL 或上傳 JSON。', UI_COLORS.WARNING)));
  }

  const imported = await readWuwaImport({ urlText, attachment });
  const result = imported.type === 'credential'
    ? await importFromCredential(imported)
    : imported;

  if (updating && result.playerUid !== existing.playerUid) {
    return submit.editReply(v2EditPayload(v2Notice(
      'UID 不一致',
      `這份資料屬於 ${maskWuwaUid(result.playerUid)}，與已綁定帳號不同。`,
      UI_COLORS.WARNING
    )));
  }

  const confirmation = buildImportConfirmation(sessionId, result, updating);
  await submit.editReply(v2EditPayload(confirmation));
  const confirmationMessage = await submit.fetchReply();
  const choice = await confirmationMessage.awaitMessageComponent({
    componentType: ComponentType.Button,
    time: 2 * 60_000,
    filter: (candidate) => candidate.user.id === component.user.id,
  }).catch(() => null);
  if (!choice) return;
  if (choice.customId === `wuwa_confirm:${sessionId}:cancel`) {
    return choice.update(v2EditPayload(v2Notice('已取消', '未寫入任何鳴潮帳號資料。', UI_COLORS.MUTED)));
  }
  if (choice.customId !== `wuwa_confirm:${sessionId}:save`) return;

  const now = Date.now();
  if (updating) {
    const merged = mergeWuwaHistories(existing.history, result.history);
    updateWuwaAccount(component.user.id, {
      playerUid: existing.playerUid,
      region: result.region,
      languageCode: result.languageCode,
      history: merged.history,
      updatedAt: now,
    });
    await choice.update(v2EditPayload(v2Notice(
      '🌊 喚取紀錄已更新',
      `已合併 **${merged.added}** 筆新紀錄；${partialFailureText(result.failedPools)}`,
      UI_COLORS.SUCCESS
    )));
    await refreshAfterAccountChange(onAccountChanged, component.user.id);
    return;
  }

  try {
    bindWuwaAccount(component.user.id, {
      playerUid: result.playerUid,
      region: result.region,
      languageCode: result.languageCode,
      history: result.history,
      updatedAt: now,
    });
  } catch (error) {
    if (String(error.code).includes('SQLITE_CONSTRAINT')) {
      return choice.update(v2EditPayload(v2Notice('綁定失敗', '此 UID 已由其他 Discord 使用者綁定。', UI_COLORS.WARNING)));
    }
    throw error;
  }
  await choice.update(v2EditPayload(v2Notice(
    '🌊 鳴潮帳號綁定完成',
    `已綁定 UID **${maskWuwaUid(result.playerUid)}**；${partialFailureText(result.failedPools)}`,
    UI_COLORS.SUCCESS
  )));
  await refreshAfterAccountChange(onAccountChanged, component.user.id);
}

async function openPoolSelector(component, sessionId) {
  const account = getAccount(component.user.id);
  if (!account) return component.reply(v2Notice('尚未綁定帳號', '請先完成鳴潮帳號綁定。', UI_COLORS.WARNING));
  await component.reply(buildPoolSelectionPayload(sessionId));
  const message = await component.fetchReply();
  const select = await message.awaitMessageComponent({
    componentType: ComponentType.StringSelect,
    time: 3 * 60_000,
    filter: (candidate) => candidate.user.id === component.user.id && candidate.customId === `wuwa_pool:${sessionId}`,
  }).catch(() => null);
  if (!select) return component.editReply(v2EditPayload(buildPoolSelectionPayload(sessionId, true))).catch(() => {});

  await select.deferReply({ flags: MessageFlags.Ephemeral });
  const poolId = select.values[0];
  const rendered = await renderWuwaCard(account, poolId);
  let published = false;
  await select.editReply(v2EditPayload(buildWuwaCardPayload(rendered, {
    ephemeral: true,
    publishCustomId: `wuwa_publish:${sessionId}:${poolId}`,
  })));
  const preview = await select.fetchReply();
  const collector = preview.createMessageComponentCollector({ time: SESSION_TIMEOUT });
  collector.on('collect', async (publish) => {
    try {
      if (publish.user.id !== component.user.id) {
        return publish.reply(v2Notice('這份卷宗不屬於你', '請自行使用 `/鳴潮抽卡` 查詢。', UI_COLORS.WARNING));
      }
      if (published) return publish.reply(v2Notice('卷宗已發布', '不會重複發布相同圖片。', UI_COLORS.WARNING));
      if (!component.channel?.send) {
        return publish.reply(v2Notice('無法公開發布', '目前位置不支援張貼公開圖片。', UI_COLORS.WARNING));
      }
      await publish.deferUpdate();
      await component.channel.send(buildWuwaCardPayload(rendered));
      published = true;
      const payload = buildWuwaCardPayload(rendered, {
        ephemeral: true,
        publishCustomId: `wuwa_publish:${sessionId}:${poolId}`,
        published: true,
      });
      delete payload.files;
      await publish.editReply(v2EditPayload(payload));
      collector.stop('published');
    } catch (error) {
      logger.warn(`[Wuwa] publish failed user=${component.user.id} code=${safeCode(error)}: ${error.message}`);
      const notice = v2Notice('卷宗發布失敗', '目前無法將圖片張貼到頻道，私人預覽仍可使用。', UI_COLORS.DANGER);
      if (publish.replied || publish.deferred) await publish.followUp(notice).catch(() => {});
      else await publish.reply(notice).catch(() => {});
    }
  });
  collector.on('end', () => {
    if (published) return;
    const payload = buildWuwaCardPayload(rendered, {
      ephemeral: true,
      publishCustomId: `wuwa_publish:${sessionId}:${poolId}`,
      expired: true,
    });
    delete payload.files;
    select.editReply(v2EditPayload(payload)).catch(() => {});
  });
}

async function openUnbindConfirm(component, sessionId, onAccountChanged = async () => {}) {
  const account = getAccount(component.user.id);
  if (!account) return component.reply(v2Notice('尚未綁定帳號', '目前沒有可解除的鳴潮帳號。', UI_COLORS.WARNING));
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`wuwa_unbind:${sessionId}:confirm`).setLabel('確認刪除全部紀錄').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`wuwa_unbind:${sessionId}:cancel`).setLabel('取消').setStyle(ButtonStyle.Secondary)
  );
  await component.reply(ephemeralV2Payload([
    v2Panel(UI_COLORS.DANGER)
      .addTextDisplayComponents(v2Text(`## 確認解除 ${maskWuwaUid(account.playerUid)}\n此操作會永久刪除已保存的全部抽卡歷史。`))
      .addActionRowComponents(row),
  ]));
  const message = await component.fetchReply();
  const choice = await message.awaitMessageComponent({
    componentType: ComponentType.Button,
    time: 2 * 60_000,
    filter: (candidate) => candidate.user.id === component.user.id,
  }).catch(() => null);
  if (!choice) return;
  if (choice.customId.endsWith(':cancel')) {
    return choice.update(v2EditPayload(v2Notice('已取消', '鳴潮帳號與歷史紀錄保持不變。', UI_COLORS.MUTED)));
  }
  deleteWuwaAccount(component.user.id);
  await choice.update(v2EditPayload(v2Notice('已解除綁定', '鳴潮 UID 與全部抽卡歷史已永久刪除。', UI_COLORS.SUCCESS)));
  await refreshAfterAccountChange(onAccountChanged, component.user.id);
}

async function importFromCredential(imported) {
  const fetched = await fetchWuwaHistory(imported.credential);
  return {
    type: 'history',
    playerUid: imported.credential.playerId,
    region: imported.region,
    languageCode: imported.credential.languageCode,
    history: fetched.history,
    failedPools: fetched.failedPools,
  };
}

function buildImportConfirmation(sessionId, result, updating) {
  const total = Object.values(result.history.pools).reduce((sum, records) => sum + records.length, 0);
  const panel = v2Panel(UI_COLORS.WUWA)
    .addTextDisplayComponents(v2Text([
      `# ${updating ? '確認更新紀錄' : '確認綁定帳號'}`,
      `UID：**${maskWuwaUid(result.playerUid)}**`,
      `已讀取紀錄：**${total}** 筆`,
      partialFailureText(result.failedPools),
    ].join('\n')))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`wuwa_confirm:${sessionId}:save`).setLabel(updating ? '確認更新' : '確認綁定').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`wuwa_confirm:${sessionId}:cancel`).setLabel('取消').setStyle(ButtonStyle.Secondary)
    ));
  return ephemeralV2Payload([panel]);
}

function getAccount(userId) {
  const row = getWuwaAccount(userId);
  if (!row) return null;
  try {
    return {
      playerUid: row.player_uid,
      region: row.region,
      languageCode: row.language_code,
      history: normalizeHistory(JSON.parse(row.history_json)),
      boundAt: row.bound_at,
      updatedAt: row.updated_at,
    };
  } catch {
    return null;
  }
}

function wuwaId(userId, action) {
  return `wuwa:${userId}:${action}`;
}

function parseAction(customId, sessionId) {
  const parts = String(customId).split(':');
  if (parts[0] !== 'wuwa') return null;
  return parts[2] ?? sessionId;
}

async function refreshAfterAccountChange(refresh, userId) {
  try {
    await refresh();
  } catch (error) {
    logger.warn(`[Wuwa] home refresh failed user=${userId} code=${safeCode(error)}: ${error.message}`);
  }
}

function partialFailureText(failedPools = []) {
  return failedPools?.length
    ? `另有 ${failedPools.length} 個卡池暫時無法更新，已保留既有資料。`
    : '所有支援卡池皆已處理。';
}

function safeCode(error) {
  return String(error?.code ?? 'unavailable').replace(/[^a-z0-9_-]/gi, '').slice(0, 32);
}

function userErrorMessage(error) {
  if (error?.code === 'credential_expired') return '授權可能已過期，請重新開啟遊戲內喚取紀錄並取得新 URL。';
  return error?.message || '請稍後重新操作。';
}

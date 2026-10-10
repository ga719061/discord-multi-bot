import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { UI_COLORS } from '../../../utils/style.js';
import { ephemeralV2Payload, v2Card, v2Payload } from '../../../utils/componentsV2.js';
import { renderStatsImage } from './statsImage.js';

export async function buildStatsReply(result, playerName, tag, options = {}) {
  const playerId = `${playerName}#${tag}`;
  const buttons = [new ButtonBuilder()
    .setLabel(`前往 ${result.source} 查看完整戰報`)
    .setStyle(ButtonStyle.Link)
    .setURL(result.sourceUrl)];
  if (result.status === 'ok' && options.publishCustomId) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(options.publishCustomId)
        .setLabel(options.published ? '戰報已頒布' : options.expired ? '頒布期限已過' : '頒布至目前頻道')
        .setStyle(options.published ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(Boolean(options.published || options.expired))
    );
  }
  if (result.status !== 'ok' && options.retryCustomId) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(options.retryCustomId)
        .setLabel(result.status === 'not_found' ? '修正資料' : '重新查詢')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(Boolean(options.expired))
    );
  }

  if (result.status === 'ok') {
    const { attachment, filename } = await renderStatsImage(result, { fetchImpl: options.fetchImpl });
    const gameName = result.game === 'lol' ? '英雄聯盟' : '特戰英豪';
    const panel = v2Card({
      title: `${gameName}皇家戰報`,
      description: '公開戰績摘要與詳細圖片。',
      accentColor: result.game === 'lol' ? UI_COLORS.LEAGUE : UI_COLORS.VALORANT,
      statusRows: [
        { label: '遊戲', value: gameName, tone: 'info' },
        { label: '玩家', value: playerId, tone: 'royal' },
        { label: '來源', value: result.source, tone: 'neutral' },
        { label: '狀態', value: '查詢成功', tone: 'success' },
      ],
      images: [{
        url: `attachment://${filename}`,
        description: `${playerId} 的${gameName}戰績圖片，資料來源 ${result.source}`,
      }],
      actionRows: [new ActionRowBuilder().addComponents(buttons)],
    });
    const payloadOptions = {
      files: [attachment],
      allowedMentions: { parse: [] },
    };
    return options.ephemeral === true
      ? ephemeralV2Payload([panel], payloadOptions)
      : v2Payload([panel], payloadOptions);
  }

  const failure = failureCopy(result.status);
  const gameName = result.game === 'lol' ? '英雄聯盟' : '特戰英豪';
  const panel = v2Card({
    title: failure.title,
    description: failure.description,
    accentColor: failure.color,
    statusRows: [
      { label: '遊戲', value: gameName, tone: 'info' },
      { label: '玩家', value: playerId, tone: 'royal' },
      { label: '來源', value: result.source, tone: 'neutral' },
      { label: '狀態', value: failure.statusLabel, tone: failure.tone },
    ],
    footer: '戰績資料取自公開來源，不需要提供 Riot API Key。',
    actionRows: [new ActionRowBuilder().addComponents(buttons)],
  });
  return options.ephemeral === true ? ephemeralV2Payload([panel]) : v2Payload([panel]);
}

function failureCopy(status) {
  const copy = {
    not_found: {
      title: '皇家史冊找不到公開戰績',
      color: UI_COLORS.MUTED,
      statusLabel: '找不到公開資料',
      tone: 'warning',
      description: '可能是 Riot ID 輸入錯誤、帳號未公開，或情報來源尚未收錄資料。',
    },
    blocked: {
      title: '情報使者暫時被來源網站擋下',
      color: UI_COLORS.WARNING,
      statusLabel: '來源限制查詢',
      tone: 'warning',
      description: '公開戰績來源目前限制自動查詢，仍可使用下方按鈕親自前往查看。',
    },
    unavailable: {
      title: '皇家戰報線路暫時不通',
      color: UI_COLORS.WARNING,
      statusLabel: '服務暫時無法使用',
      tone: 'danger',
      description: '來源網站可能維護中或連線逾時，請稍後再向本王查詢。',
    },
    parse_error: {
      title: '公開戰報卷宗格式已變更',
      color: UI_COLORS.WARNING,
      statusLabel: '資料格式已變更',
      tone: 'danger',
      description: '本王暫時讀不懂網站的新排版，但仍可由下方按鈕前往查看。',
    },
  };
  return copy[status] || copy.unavailable;
}


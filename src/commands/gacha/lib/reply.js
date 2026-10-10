import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { ephemeralV2Payload, v2Card, v2Payload } from '../../../utils/componentsV2.js';
import { UI_COLORS } from '../../../utils/style.js';
import { maskWuwaUid } from './importer.js';
import { calculateWuwaPoolStats } from './statistics.js';

export function buildWuwaCardPayload(rendered, account, poolId, options = {}) {
  const poolStats = calculateWuwaPoolStats(account.history, poolId);
  const buttons = [];
  if (options.publishCustomId) {
    buttons.push(new ButtonBuilder()
      .setCustomId(options.publishCustomId)
      .setLabel(options.published ? '卷宗已發布' : options.expired ? '發布期限已過' : '發布至目前頻道')
      .setStyle(options.published ? ButtonStyle.Success : ButtonStyle.Primary)
      .setDisabled(Boolean(options.published || options.expired)));
  }
  const panel = v2Card({
    title: '🌊 皇家喚取卷宗',
    description: `資料更新：<t:${Math.floor(account.updatedAt / 1000)}:R>`,
    accentColor: UI_COLORS.WUWA,
    statusRows: [
      { label: '帳號', value: '已綁定', tone: 'success' },
      { label: 'UID', value: maskWuwaUid(account.playerUid), tone: 'royal' },
      { label: '卡池', value: poolStats.pool.name, tone: 'info' },
      { label: '紀錄', value: `${poolStats.total} 筆`, tone: 'special' },
    ],
    images: [{
      url: `attachment://${rendered.filename}`,
      description: `${maskWuwaUid(account.playerUid)} 的${poolStats.pool.name}喚取統計圖片，共 ${poolStats.total} 筆紀錄`,
    }],
    footer: '圖片中的 UID 已遮罩；臨時喚取授權不會永久保存。',
    actionRows: buttons.length ? [new ActionRowBuilder().addComponents(buttons)] : [],
  });
  const payloadOptions = {
    files: [rendered.attachment],
    allowedMentions: { parse: [] },
  };
  return options.ephemeral === true
    ? ephemeralV2Payload([panel], payloadOptions)
    : v2Payload([panel], payloadOptions);
}

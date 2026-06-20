import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { ephemeralV2Payload, v2Card, v2Payload } from '../../../utils/componentsV2.js';
import { UI_COLORS } from '../../../utils/style.js';

export function buildWuwaCardPayload(rendered, options = {}) {
  const buttons = [];
  if (options.publishCustomId) {
    buttons.push(new ButtonBuilder()
      .setCustomId(options.publishCustomId)
      .setLabel(options.published ? '卷宗已發布' : options.expired ? '發布期限已過' : '發布至目前頻道')
      .setStyle(options.published ? ButtonStyle.Success : ButtonStyle.Primary)
      .setDisabled(Boolean(options.published || options.expired)));
  }
  const panel = v2Card({
    accentColor: UI_COLORS.WUWA,
    images: [`attachment://${rendered.filename}`],
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

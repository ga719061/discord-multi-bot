import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { UI_COLORS } from '../../../utils/style.js';
import { embedsToV2Payload, ephemeralV2Payload, v2Card, v2Payload } from '../../../utils/componentsV2.js';
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

  if (result.status === 'ok') {
    const { attachment, filename } = await renderStatsImage(result, { fetchImpl: options.fetchImpl });
    const panel = v2Card({
      accentColor: result.game === 'lol' ? UI_COLORS.LEAGUE : UI_COLORS.VALORANT,
      images: [`attachment://${filename}`],
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

  const embed = buildFailureEmbed(result, playerId);
  return embedsToV2Payload([embed], {
    actionRows: [new ActionRowBuilder().addComponents(buttons)],
    ephemeral: options.ephemeral === true,
    linkTitle: false,
  });
}

function buildFailureEmbed(result, playerId) {
  const copy = {
    not_found: {
      title: '皇家史冊找不到公開戰績',
      color: UI_COLORS.MUTED,
      description: '可能是 Riot ID 輸入錯誤、帳號未公開，或情報來源尚未收錄資料。',
    },
    blocked: {
      title: '情報使者暫時被來源網站擋下',
      color: UI_COLORS.WARNING,
      description: '公開戰績來源目前限制自動查詢，仍可使用下方按鈕親自前往查看。',
    },
    unavailable: {
      title: '皇家戰報線路暫時不通',
      color: UI_COLORS.WARNING,
      description: '來源網站可能維護中或連線逾時，請稍後再向本王查詢。',
    },
    parse_error: {
      title: '公開戰報卷宗格式已變更',
      color: UI_COLORS.WARNING,
      description: '本王暫時讀不懂網站的新排版，但仍可由下方按鈕前往查看。',
    },
  };
  const state = copy[result.status] || copy.unavailable;

  return new EmbedBuilder()
    .setColor(state.color)
    .setTitle(`🐕 ${state.title}`)
    .setDescription(`**${playerId}**\n${state.description}`)
    .addFields({ name: '資料來源', value: result.source, inline: true })
    .setFooter({ text: '🐕 本王只閱覽第三方網站公開資料，不使用 API Key。' });
}


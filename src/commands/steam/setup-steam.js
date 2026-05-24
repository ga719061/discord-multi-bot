import { ChannelType, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getGuildSettings, updateGuildSetting } from '../../utils/database.js';
import { buildSteamDealsPayload, fetchSteamSpecialDeals, getSteamFailureMessage, isValidSteamDealTime } from '../../utils/steamDeals.js';
import { logger } from '../../utils/logger.js';
import { embedsToV2Payload, v2EditPayload, v2Notice } from '../../utils/componentsV2.js';
import { UI_COLORS } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
  .setName('設定特價推播')
  .setDescription('設定 Steam 每日熱門特價自動推播')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName('設定頻道')
      .setDescription('啟用每日特價推播，並設定投放頻道與台灣時間')
      .addChannelOption((opt) =>
        opt
          .setName('目標頻道')
          .setDescription('要投放 Steam 特價資訊的文字頻道')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('時間')
          .setDescription('每日投放時間，格式 HH:mm，例如 20:00')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('狀態')
      .setDescription('查看 Steam 每日特價推播設定')
  )
  .addSubcommand((sub) =>
    sub
      .setName('關閉')
      .setDescription('關閉 Steam 每日特價自動推播')
  )
  .addSubcommand((sub) =>
    sub
      .setName('特價列表')
      .setDescription('立刻在設定頻道投放目前 Steam 熱門特價榜單')
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === '設定頻道') return handleChannel(interaction);
  if (sub === '狀態') return handleStatus(interaction);
  if (sub === '關閉') return handleDisable(interaction);
  if (sub === '特價列表') return handleDealList(interaction);
}

async function handleChannel(interaction) {
  const channel = interaction.options.getChannel('目標頻道');
  const time = interaction.options.getString('時間');

  if (!isValidSteamDealTime(time)) {
    return interaction.reply(v2Notice('🛒 時間格式不正確', '請使用 `HH:mm`，例如 `20:00`。', UI_COLORS.WARNING));
  }

  updateGuildSetting(interaction.guildId, 'steam_deal_channel', channel.id);
  updateGuildSetting(interaction.guildId, 'steam_deal_time', time);
  updateGuildSetting(interaction.guildId, 'steam_deal_enabled', 1);

  await interaction.reply(v2Notice('🛒 Steam 特價推播已啟用', `每天台灣時間 **${time}** 會投放到 ${channel}。`, UI_COLORS.SUCCESS));
}

async function handleStatus(interaction) {
  const settings = getGuildSettings(interaction.guildId);
  const enabled = settings.steam_deal_enabled === 1;
  const channelText = settings.steam_deal_channel ? `<#${settings.steam_deal_channel}>` : '尚未設定';
  const timeText = settings.steam_deal_time || '尚未設定';
  const lastPostDate = settings.steam_deal_last_post_date || '尚未投放';

  const embed = new EmbedBuilder()
    .setColor(enabled ? 0x00AA55 : 0x99AAB5)
    .setTitle('Steam 每日特價推播設定')
    .addFields(
      { name: '狀態', value: enabled ? '已啟用' : '已關閉', inline: true },
      { name: '投放頻道', value: channelText, inline: true },
      { name: '投放時間', value: `${timeText}（台灣時間）`, inline: true },
      { name: '上次投放日期', value: lastPostDate, inline: true },
    )
    .setFooter({ text: '使用 /設定特價推播 設定頻道 目標頻道:#頻道 時間:20:00 可更新設定' });

  await interaction.reply(embedsToV2Payload([embed], { ephemeral: true }));
}

async function handleDisable(interaction) {
  const settings = getGuildSettings(interaction.guildId);
  if (!settings.steam_deal_channel && settings.steam_deal_enabled !== 1) {
    return interaction.reply(v2Notice('🛒 尚未設定推播', '目前尚未設定 Steam 每日特價推播。', UI_COLORS.MUTED));
  }

  updateGuildSetting(interaction.guildId, 'steam_deal_enabled', 0);

  await interaction.reply(v2Notice('🛒 Steam 推播已關閉', 'Steam 每日熱門特價自動推播已關閉。', UI_COLORS.MUTED));
}

async function handleDealList(interaction) {
  const settings = getGuildSettings(interaction.guildId);
  if (!settings.steam_deal_channel) {
    return interaction.reply(v2Notice('🛒 尚未設定投放頻道', '請先使用 `/設定特價推播 設定頻道 目標頻道:#頻道 時間:20:00`。', UI_COLORS.WARNING));
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channel = await interaction.guild.channels.fetch(settings.steam_deal_channel).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    return interaction.editReply(v2EditPayload(v2Notice('🛒 找不到投放頻道', '請重新使用 `/設定特價推播 設定頻道` 設定。', UI_COLORS.WARNING)));
  }

  try {
    const deals = await fetchSteamSpecialDeals(10);
    const payload = buildSteamDealsPayload(deals, {
      title: '🐕👑 吉吉王國 Steam 熱門特價榜單',
      intro: `汪！皇家採購廳立即呈上 ${deals.length} 款不重複熱門特價，這份榜單不會更新每日投放紀錄。`,
      footer: '🐕 手動特價列表 | 不會更新每日投放紀錄',
    });

    await channel.send(payload);
    await interaction.editReply(v2EditPayload(v2Notice('🛒 特價榜單已送出', `已將 ${deals.length} 款 Steam 熱門特價送出到 ${channel}，成員可從榜單查看即時詳情。`, UI_COLORS.SUCCESS)));
  } catch (err) {
    logger.warn(`[SteamDeals] 手動投放失敗 guild=${interaction.guildId} code=${err.code || 'unavailable'}: ${err.message}`);
    await interaction.editReply(v2EditPayload(v2Notice('🛒 Steam 推播失敗', getSteamFailureMessage(err), UI_COLORS.WARNING)));
  }
}

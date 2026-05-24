import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { updateGuildSetting } from '../../utils/database.js';
import { fmt, COLORS } from '../../utils/style.js';
import { v2Notice } from '../../utils/componentsV2.js';
import { UI_COLORS } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('設定歡迎')
    .setDescription('🎺 迎賓大廳：設定當新子民加入時的專屬通報頻道與入城詞')
    .setDescriptionLocalizations({ 'zh-TW': '🎺 迎賓大廳：設定當新子民加入時的專屬通報頻道與入城詞' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((opt) =>
        opt.setName('頻道')
            .setDescription('歡迎訊息傳送的頻道')
            .setDescriptionLocalizations({ 'zh-TW': '歡迎訊息傳送的頻道' })
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
    )
    .addStringOption((opt) =>
        opt.setName('訊息')
            .setDescription('自訂歡迎訊息 (可用 {user} {server} {count})')
            .setDescriptionLocalizations({ 'zh-TW': '自訂歡迎訊息 (可用 {user} {server} {count})' })
            .setRequired(false)
    );

export async function execute(interaction) {
    const channel = interaction.options.getChannel('頻道');
    const message = interaction.options.getString('訊息');

    updateGuildSetting(interaction.guildId, 'welcome_channel', channel.id);
    if (message) {
        updateGuildSetting(interaction.guildId, 'welcome_message', message);
    }

    await interaction.reply(v2Notice('🎺 迎賓大廳已設定', `🐕✅ **本王已接收旨意！**\n` +
            '```ansi\n' +
            `目標頻道: ${fmt(COLORS.GREEN, '#' + channel.name)}\n` +
            `歡迎模式: ${message ? fmt(COLORS.GOLD, '自訂聖旨') : fmt(COLORS.CYAN, '預設歡呼')}\n` +
            '```', UI_COLORS.SUCCESS));
}

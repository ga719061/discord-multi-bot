import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { updateGuildSetting } from '../../utils/database.js';
import { fmt, COLORS } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('setup-log')
    .setNameLocalizations({ 'zh-TW': '設定紀錄' })
    .setDescription('📝史官紀錄：設定用於監控領地內所有成員動靜的日誌頻道')
    .setDescriptionLocalizations({ 'zh-TW': '📝 史官紀錄：設定用於監控領地內所有成員動靜的日誌頻道' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((opt) =>
        opt.setName('channel')
            .setNameLocalizations({ 'zh-TW': '頻道' })
            .setDescription('日誌記錄的目標頻道')
            .setDescriptionLocalizations({ 'zh-TW': '日誌記錄的目標頻道' })
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
    );

export async function execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    updateGuildSetting(interaction.guildId, 'log_channel', channel.id);
    await interaction.reply({
        content: `🐕✅ **本王已設定完成！**\n` + '```ansi\n' + `目標頻道: ${fmt(COLORS.GREEN, '#' + channel.name)}\n` + fmt(COLORS.CYAN, '本王會盯緊每一個子民的！汪！') + '\n```',
        flags: ['Ephemeral']
    });
}

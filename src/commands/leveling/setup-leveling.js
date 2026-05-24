import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { updateGuildSetting, getGuildSettings } from '../../utils/database.js';
import { v2Notice } from '../../utils/componentsV2.js';
import { UI_COLORS } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('設定等級系統')
    .setDescription('📈 皇家晉升：設定伺服器階級系統的各項公告設定')
    .setDescriptionLocalizations({ 'zh-TW': '📈 皇家晉升：設定伺服器階級系統的各項公告設定' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
        opt.setName('狀態')
            .setDescription('是否在成員升級時發送公告訊息')
            .setDescriptionLocalizations({ 'zh-TW': '是否在成員升級時發送公告訊息' })
            .setRequired(true)
            .addChoices(
                { name: '✅ 開啟', value: 'on' },
                { name: '❌ 關閉', value: 'off' }
            )
    );

export async function execute(interaction) {
    const status = interaction.options.getString('狀態');
    const enabled = status === 'on';

    updateGuildSetting(interaction.guildId, 'level_up_announcement_enabled', enabled ? 1 : 0);

    await interaction.reply(v2Notice(
        '📈 皇家晉升公告已更新',
        `本王已將等級升遷公告設定為：**${enabled ? '開啟' : '關閉'}** 汪！`,
        enabled ? UI_COLORS.SUCCESS : UI_COLORS.MUTED
    ));
}

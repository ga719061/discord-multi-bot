import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getAiSettings, updateAiSetting } from '../../utils/database.js';

export const data = new SlashCommandBuilder()
    .setName('智慧登入')
    .setDescription('🔐 皇室大內密碼：通往管理 AI 核心的入口')
    .setDescriptionLocalizations({ 'zh-TW': '🔐 皇室大內密碼：通往管理 AI 核心的入口' })
    .addStringOption(option =>
        option.setName('密碼')
            .setDescription('請輸入管理密碼')
            .setDescriptionLocalizations({ 'zh-TW': '請輸入管理密碼' })
            .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
    const password = interaction.options.getString('密碼');

    // 從環境變數讀取密碼，增加安全性
    const CORRECT_PASSWORD = process.env.AI_ADMIN_PASSWORD;

    if (!CORRECT_PASSWORD) {
        return interaction.reply({
            content: '❌ **系統錯誤**：管理員未在 `.env` 設定 `AI_ADMIN_PASSWORD`，無法登入！',
            flags: ['Ephemeral']
        });
    }

    if (password !== CORRECT_PASSWORD) {
        return interaction.reply({
            content: '❌ 密碼錯誤！拒絕存取。',
            flags: ['Ephemeral']
        });
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const settings = getAiSettings(guildId);
    let adminIds = settings.admin_ids || [];

    if (!adminIds.includes(userId)) {
        adminIds.push(userId);
        updateAiSetting(guildId, 'admin_ids', JSON.stringify(adminIds));
    }

    await interaction.reply({
        embeds: [new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🔐 登入成功！')
            .setDescription('您已成功驗證身份。現在可以使用 `/智慧設定` 指令了。')
        ],
        flags: ['Ephemeral']
    });
}

import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getUserLevel, getRankTitle } from '../../utils/database.js';

export const data = new SlashCommandBuilder()
    .setName('查身家')
    .setDescription('🔍 身分調查：查看特定子民的詳細背景資料與入國註冊時間')
    .setDescriptionLocalizations({ 'zh-TW': '🔍 身分調查：查看特定子民的詳細背景資料與入國註冊時間' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((opt) => 
        opt.setName('使用者')
            .setDescription('要調查的子民')
            .setDescriptionLocalizations({ 'zh-TW': '要調查的子民' })
            .setRequired(false)
    );

export async function execute(interaction) {
    const target = interaction.options.getUser('使用者') || interaction.user;
    const member = await interaction.guild.members.fetch(target.id);
    const guildId = interaction.guildId;

    // 1. 取得等級系統資料
    const levelData = getUserLevel(guildId, target.id);
    const rankTitle = getRankTitle(levelData.level);

    const roles = member.roles.cache
        .filter((r) => r.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => r.toString())
        .slice(0, 10)
        .join(', ') || '無';

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`🐕👑 子民調查報告：${target.displayName}`)
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .addFields(
            { name: '👤 基礎資訊', value: [
                `> **標籤**: ${target.tag}`,
                `> **ID**: \`${target.id}\``,
                `> **帳號建立**: <t:${Math.floor(target.createdTimestamp / 1000)}:R>`,
                `> **加入領地**: ${member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : '未知'}`
            ].join('\n'), inline: false },
            { name: '🏰 皇家功勳 (Leveling)', value: [
                `> **目前爵位**: ${rankTitle}`,
                `> **等級**: Lv.${levelData.level}`,
                `> **發言量**: ${levelData.total_messages} 次`,
                `> **語音時數**: ${levelData.total_voice_mins || 0} 分鐘`
            ].join('\n'), inline: true }
        );

    embed.addFields(
        { name: '🏷️ 身分組', value: roles.length > 1024 ? roles.slice(0, 1020) + '...' : roles, inline: false }
    );

    embed.setFooter({ text: '🐕 本王對每位子民都瞭若指掌！' });

    await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
}

import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getUserLevel, getRankTitle } from '../../utils/database.js';
import { getCharacter } from '../../rpg/rpgDatabase.js';
import { fmt, COLORS, getJobTitle } from '../../rpg/rpgHelpers.js';

export const data = new SlashCommandBuilder()
    .setName('userinfo')
    .setNameLocalizations({ 'zh-TW': '查身家' })
    .setDescription('🔍 身分調查：查看特定子民的詳細背景資料與入國註冊時間')
    .setDescriptionLocalizations({ 'zh-TW': '🔍 身分調查：查看特定子民的詳細背景資料與入國註冊時間' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((opt) => 
        opt.setName('user')
            .setNameLocalizations({ 'zh-TW': '使用者' })
            .setDescription('要調查的子民')
            .setDescriptionLocalizations({ 'zh-TW': '要調查的子民' })
            .setRequired(false)
    );

export async function execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(target.id);
    const guildId = interaction.guildId;

    // 1. 取得等級系統資料
    const levelData = getUserLevel(guildId, target.id);
    const rankTitle = getRankTitle(levelData.level);

    // 2. 取得 RPG 系統資料
    const rpgData = getCharacter(guildId, target.id);

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

    // 如果有 RPG 角色，則顯示 RPG 資料
    if (rpgData) {
        embed.addFields(
            { name: '⚔️ 冒險生涯 (RPG)', value: [
                `> **職業**: ${getJobTitle(rpgData)}`,
                `> **等級**: Lv.${rpgData.level}`,
                `> **資產**: ${rpgData.gold} 💰 / ${rpgData.gems} 💎`,
                `> **擊殺首領**: ${rpgData.boss_kills || 0} 隻`
            ].join('\n'), inline: true }
        );
    }

    embed.addFields(
        { name: '🏷️ 身分組', value: roles.length > 1024 ? roles.slice(0, 1020) + '...' : roles, inline: false }
    );

    embed.setFooter({ text: '🐕 本王對每位子民都瞭若指掌！' });

    await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
}

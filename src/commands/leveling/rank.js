import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUserLevel, getXpForLevel, getRankTitle } from '../../utils/database.js';
import { fmt, COLORS, ansiBar, ansiBlock } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('rank')
    .setNameLocalizations({ 'zh-TW': '等級' })
    .setDescription('🏅 爵位查詢：檢視自己目前的皇家頭銜與累積的貢獻度')
    .addUserOption((opt) => 
        opt.setName('user')
            .setNameLocalizations({ 'zh-TW': '使用者' })
            .setDescription('查看誰的等級')
            .setRequired(false)
    );

export async function execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const data = getUserLevel(interaction.guildId, target.id);
    const xpNeeded = getXpForLevel(data.level + 1);
    const bar = ansiBar(data.xp, xpNeeded, COLORS.CYAN, 20);

    const rankTitle = getRankTitle(data.level);

    const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
    const isBooster = targetMember && targetMember.premiumSince;

    // 整合所有數據到一個 ANSI 區塊中
    const mainBlock = ansiBlock([
        { color: COLORS.GOLD, text: `👑 目前爵位: ${rankTitle}` },
        { color: COLORS.BLUE, text: `⭐ 當前等級: Lv.${data.level}` },
        { color: COLORS.WHITE, text: `💬 累計發言: ${data.total_messages} 次` },
        '', // 分隔線
        { color: COLORS.GRAY, text: `進度: ${data.xp} / ${xpNeeded} XP (${Math.round((data.xp / xpNeeded) * 100)}%)` },
        { color: COLORS.CYAN, text: bar },
        { color: isBooster ? COLORS.MAGENTA : COLORS.GRAY, text: isBooster ? '🚀 皇家贊助者 (1.5x 加成中)' : '📜 常規子民倍率' }
    ]);

    const embed = new EmbedBuilder()
        .setColor(isBooster ? 0xF47FFF : 0xFFD700)
        .setAuthor({ name: `👑 ${targetMember?.displayName || target.username} 的皇家功勳紀錄`, iconURL: target.displayAvatarURL() })
        .setThumbnail(target.displayAvatarURL({ size: 128 }))
        .setDescription(
            `汪！本王翻閱了領地史冊，以下是你的功勳資料：\n\n` +
            mainBlock
        )
        .setFooter({ text: '🐕 繼續在王國內活躍，本王會賜予你更高的頭銜喔！汪！' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

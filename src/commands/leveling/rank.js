import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUserLevel, getXpForLevel, getRankTitle } from '../../utils/database.js';
import * as StyleUtils from '../../utils/style.js';
const { fmt, COLORS, ansiBar } = StyleUtils;

export const data = new SlashCommandBuilder()
    .setName('rank')
    .setNameLocalizations({ 'zh-TW': '等級' })
    .setDescription('🏅 爵位查詢：檢視自己目前的皇家頭銜與累積的貢獻度')
    .setDescriptionLocalizations({ 'zh-TW': '🏅 爵位查詢：檢視自己目前的皇家頭銜與累積的貢獻度' })
    .addUserOption((opt) => 
        opt.setName('user')
            .setNameLocalizations({ 'zh-TW': '使用者' })
            .setDescription('查看誰的等級')
            .setDescriptionLocalizations({ 'zh-TW': '查看誰的等級' })
            .setRequired(false)
    );

export async function execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const data = getUserLevel(interaction.guildId, target.id);
    const xpNeeded = getXpForLevel(data.level + 1);
    const bar = ansiBar(data.xp, xpNeeded, COLORS.GREEN, 20);

    const rankTitle = getRankTitle(data.level);

    const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
    const isBooster = targetMember && targetMember.premiumSince;
    const titleBadge = isBooster ? '🚀 皇家贊助者' : '';

    const embed = new EmbedBuilder()
        .setColor(isBooster ? 0xF47FFF : 0xFFD700) // Booster pinkish-purple or default gold
        .setThumbnail(target.displayAvatarURL({ size: 128 }))
        .addFields(
            {
                name: '👑 等級與頭銜',
                value: '```ansi\n' + `等級 ${data.level}\n` + fmt(COLORS.CYAN, rankTitle) + '\n```',
                inline: true
            },
            {
                name: '⭐ 經驗值',
                value: '```ansi\n' + `${data.xp} / ${xpNeeded}\n` + (isBooster ? fmt(COLORS.MAGENTA, '🚀 1.5x') : fmt(COLORS.GRAY, '常規倍率')) + '\n```',
                inline: true
            },
            {
                name: '💬 總發言數',
                value: '```ansi\n' + fmt(COLORS.WHITE, String(data.total_messages)) + '\n```',
                inline: true
            },
            {
                name: '📊 晉爵進度',
                value: '```ansi\n' + bar + ' ' + Math.round((data.xp / xpNeeded) * 100) + '%\n```'
            }
        )
        .setFooter({ text: '🐕 繼續發言就能獲得本王的賞識喔～' });

    await interaction.reply({ embeds: [embed] });
}

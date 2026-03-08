import { getRpgLeaderboard } from '../rpgDatabase.js';
import { rpgEmbed, backButton, charSummary, ansiText, safeReply, getJobTitle, widePad } from '../rpgHelpers.js';
import { RACES, CLASSES } from '../data/gameData.js';
import { fmt, COLORS } from '../../utils/style.js';

export async function showRanking(interaction) {
    await interaction.deferUpdate().catch(() => { });

    const leaderboard = getRpgLeaderboard(interaction.guildId, 10);

    if (leaderboard.length === 0) {
        const embed = rpgEmbed('🏆 騎士排行榜', '還沒有人成為騎士呢！\n快使用 `/rpg` 開始你的遠征吧！');
        embed.setFooter({ text: `🐕👑 吉吉王國騎士團 | uid:${interaction.user.id}` });
        return interaction.editReply({ embeds: [embed], components: [backButton()] });
    }

    const medals = ['🥇', '🥈', '🥉'];

    // 批量抓取使用者資料以提升效能
    const userIds = leaderboard.map(e => e.user_id);
    const users = await Promise.all(userIds.map(id => interaction.client.users.fetch(id).catch(() => ({ displayName: `User#${id.slice(-4)}` }))));

    const lines = leaderboard.map((entry, i) => {
        const medal = medals[i] || `${i + 1}. `;
        const race = RACES[entry.race] || { name: '未知', emoji: '❓' };
        const level = entry.level;
        const cls = CLASSES[entry.class] || { name: '騎士', emoji: '⚔️' };
        const title = getJobTitle(entry, false);
        const username = users[i]?.displayName || `User#${entry.user_id.slice(-4)}`;
        
        const rankPart = `${medal}`;
        const namePart = widePad(username, 16);
        const jobPart = `${race.emoji}${cls.emoji} ${widePad(title, 10)}`;
        const statPart = `Lv.${widePad(entry.level.toString(), 3)} | 💰${widePad(entry.gold.toLocaleString(), 8)} | ⚔️${entry.wins}`;

        const color = i === 0 ? COLORS.GOLD : (i < 3 ? COLORS.CYAN : COLORS.WHITE);
        return fmt(color, `${rankPart}${namePart} ${jobPart} ${statPart}`);
    });

    const embed = rpgEmbed(
        '🏆 騎士排行榜',
        '```ansi\n' + lines.join('\n') + '\n```',
        0xF1C40F
    );
    embed.setFooter({ text: `🐕👑 吉吉王國騎士團 | uid:${interaction.user.id}` });

    await interaction.editReply({ embeds: [embed], components: [backButton()] });
}

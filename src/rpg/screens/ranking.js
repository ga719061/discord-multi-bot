import { getRpgLeaderboard } from '../rpgDatabase.js';
import { rpgEmbed, backButton, charSummary, ansiText, safeReply, getJobTitle, widePad } from '../rpgHelpers.js';
import { RACES, CLASSES } from '../data/gameData.js';
import { fmt, COLORS } from '../../utils/style.js';

export async function showRanking(interaction) {
    await interaction.deferUpdate().catch(() => { });

    const leaderboard = getRpgLeaderboard(interaction.guildId, 10);

    if (leaderboard.length === 0) {
        const embed = rpgEmbed('🏆 冒險者排行榜', '還沒有人成為冒險者呢！\n快使用 `/rpg` 開始你的冒險吧！');
        embed.setFooter({ text: `🐕👑 吉吉王國冒險者公會 | uid:${interaction.user.id}` });
        return interaction.editReply({ embeds: [embed], components: [backButton()] });
    }

    const medals = ['🥇', '🥈', '🥉'];

    // 批量抓取使用者資料以提升效能
    const userIds = leaderboard.map(e => e.user_id);
    const users = await Promise.all(userIds.map(id => interaction.client.users.fetch(id).catch(() => ({ displayName: `User#${id.slice(-4)}` }))));

    const lines = leaderboard.map((entry, i) => {
        const medal = medals[i] || `${i + 1}. `;
        const race = RACES[entry.race];
        const cls = CLASSES[entry.class];
        const title = getJobTitle(entry, false);
        const username = users[i].displayName;
        
        const rankPart = `${medal}`;
        const namePart = widePad(username, 16);
        const jobPart = `${race.emoji}${cls.emoji} ${widePad(title, 10)}`;
        const statPart = `Lv.${widePad(entry.level.toString(), 3)} | 💰${widePad(entry.gold.toLocaleString(), 8)} | ⚔️${entry.wins}`;

        const color = i === 0 ? COLORS.GOLD : (i < 3 ? COLORS.CYAN : COLORS.WHITE);
        return fmt(color, `${rankPart}${namePart} ${jobPart} ${statPart}`);
    });

    const embed = rpgEmbed(
        '🏆 冒險者排行榜',
        [
            ansiText('2;33', '誰才是大陸實力最強、財富最多的霸主？名字將寫在歷史中！'),
            '```ansi',
            ...lines,
            '```'
        ].join('\n')
    );
    embed.setFooter({ text: `🐕👑 吉吉王國冒險者公會 | uid:${interaction.user.id}` });

    await interaction.editReply({ embeds: [embed], components: [backButton()] });
}

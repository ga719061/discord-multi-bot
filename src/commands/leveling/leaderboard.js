import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getLeaderboard, getRankTitle } from '../../utils/database.js';
import { fmt, COLORS, ansiBlock } from '../../utils/style.js';
import { embedsToV2Payload, v2EditPayload, v2Notice } from '../../utils/componentsV2.js';
import { UI_COLORS } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('排行榜')
    .setDescription('🏆 皇家封神榜：查看王國內貢獻度最高的十大傑出子民')

export async function execute(interaction) {
    await interaction.deferReply();
    const top = getLeaderboard(interaction.guildId, 10);

    if (top.length === 0) {
        return interaction.editReply(v2EditPayload(v2Notice('📜 史冊尚未開卷', '汪...多聊天來留下你的痕跡吧！', UI_COLORS.MUTED, { ephemeral: false })));
    }

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🏆 吉吉王國・皇家封神榜')
        .setDescription('汪！這些是受到本王最高恩寵的子民們！')
        .setThumbnail(interaction.guild.iconURL())
        .setTimestamp();

    // 批量抓取成員以獲取暱稱
    const userIds = top.map(u => u.user_id);
    const members = await interaction.guild.members.fetch({ user: userIds }).catch(() => new Map());

    const list = top.map((u, i) => {
        const medals = ['🥇', '🥈', '🥉'];
        const medal = medals[i] || `**${i + 1}.**`;
        const title = getRankTitle(u.level);
        const color = i === 0 ? COLORS.GOLD : i < 3 ? COLORS.WHITE : COLORS.GRAY;
        
        const member = members.get(u.user_id);
        const displayName = member?.displayName || `User#${u.user_id.slice(-4)}`;

        // 統一所有名次的樣式
        return `${medal} **${displayName}**\n` + ansiBlock([
            { color: color, text: `└─ 等級 ${u.level} | ${title}` }
        ]);
    }).join('\n');

    embed.addFields({ name: '📜 功勳排行', value: list });
    embed.setFooter({ text: '🐕 排位越高，代表你對王國的忠誠度越高喔！汪！' });

    await interaction.editReply(v2EditPayload(embedsToV2Payload([embed])));
}

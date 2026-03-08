import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getLeaderboard, getRankTitle } from '../../utils/database.js';
import { fmt, COLORS, ansiBlock } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('leaderboard')
    .setNameLocalizations({ 'zh-TW': '排行榜' })
    .setDescription('🏆 皇家封神榜：查看王國內貢獻度最高的十大傑出子民')

export async function execute(interaction) {
    await interaction.deferReply();
    const top = getLeaderboard(interaction.guildId, 10);

    if (top.length === 0) {
        return interaction.editReply({ content: '🐕 汪...史冊上還空空如也，多聊天來留下你的痕跡吧！' });
    }

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🏆 吉吉王國・皇家封神榜')
        .setDescription('汪！這些是受到本王最高恩寵的子民們！')
        .setThumbnail(interaction.guild.iconURL())
        .setTimestamp();

    const list = top.map((u, i) => {
        const medals = ['🥇', '🥈', '🥉'];
        const medal = medals[i] || `**${i + 1}.**`;
        const title = getRankTitle(u.level);
        const color = i === 0 ? COLORS.GOLD : i < 3 ? COLORS.WHITE : COLORS.GRAY;
        
        // 為前三名建立精美的 ANSI 區塊
        if (i < 3) {
            return `${medal} <@${u.user_id}>\n` + ansiBlock([
                { color: color, text: `└─ 等級 ${u.level} | ${title}` }
            ]);
        }
        
        return `${medal} <@${u.user_id}> \`Lv.${u.level} ${title}\``;
    }).join('\n\n');

    embed.addFields({ name: '📜 功勳排行', value: list });
    embed.setFooter({ text: '🐕 排位越高，代表你對王國的忠誠度越高喔！汪！' });

    await interaction.editReply({ embeds: [embed] });
}

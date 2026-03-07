import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getLeaderboard, getRankTitle } from '../../utils/database.js';
import { fmt, COLORS } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('leaderboard')
    .setNameLocalizations({ 'zh-TW': '排行榜' })
    .setDescription('🏆 風雲榜：查看王國內經驗值與等級最高的十大傑出子民')
    .setDescriptionLocalizations({ 'zh-TW': '🏆 風雲榜：查看王國內經驗值與等級最高的十大傑出子民' });

export async function execute(interaction) {
    await interaction.deferReply();
    const top = getLeaderboard(interaction.guildId, 10);

    if (top.length === 0) {
        return interaction.editReply({ content: '🐕 汪...還沒有任何子民有等級資料，多聊天吧！' });
    }

    const list = top
        .map((u, i) => {
            const medal = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
            const title = getRankTitle(u.level);
            const color = i === 0 ? COLORS.GOLD : i < 3 ? COLORS.WHITE : COLORS.GRAY;
            const content = `Lv.${u.level} | ${title}`;
            return `${medal} <@${u.user_id}>\n` + '```ansi\n' + fmt(color, content) + '\n```';
        })
        .join('\n');

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🐕👑 本王的忠臣排行榜')
        .setDescription(list)
        .setFooter({ text: '🐕 排名越高越受本王寵愛喔～汪！' });

    await interaction.editReply({ embeds: [embed] });
}

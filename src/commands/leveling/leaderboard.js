import { SlashCommandBuilder } from 'discord.js';
import { getLeaderboard, getRankTitle } from '../../utils/database.js';
import { v2Card, v2EditPayload, v2Notice, v2Payload } from '../../utils/componentsV2.js';
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

    // 批量抓取成員以獲取暱稱
    const userIds = top.map(u => u.user_id);
    const members = await interaction.guild.members.fetch({ user: userIds }).catch(() => new Map());

    const entries = top.map((u) => {
        const member = members.get(u.user_id);
        return {
            displayName: member?.displayName || `User#${u.user_id.slice(-4)}`,
            level: u.level,
            rankTitle: getRankTitle(u.level),
        };
    });

    await interaction.editReply(v2EditPayload(buildLeaderboardPayload(entries, interaction.guild.iconURL())));
}

export function buildLeaderboardPayload(entries, guildIconUrl = null) {
    const fullRanking = entries.map((entry, index) =>
        `**${index + 1}. ${entry.displayName}** · Lv.${entry.level} · ${entry.rankTitle}`
    ).join('\n');
    const fields = fullRanking ? [{ name: '完整功勳排行', value: fullRanking }] : [];
    return v2Payload([v2Card({
        title: '🏆 吉吉王國・皇家封神榜',
        description: '王國內累積貢獻度最高的十大成員。',
        accentColor: UI_COLORS.ROYAL,
        thumbnail: guildIconUrl,
        statusRows: entries.slice(0, 3).map((entry, index) => ({
            label: `第 ${index + 1} 名`,
            value: `${entry.displayName} · Lv.${entry.level} · ${entry.rankTitle}`,
            tone: ['royal', 'special', 'success'][index],
        })),
        fields,
        footer: '持續參與文字與語音活動，即可提升名次。',
    })]);
}

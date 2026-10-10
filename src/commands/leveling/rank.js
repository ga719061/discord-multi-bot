import { SlashCommandBuilder } from 'discord.js';
import { getUserLevel, getXpForLevel, getRankTitle } from '../../utils/database.js';
import { UI_COLORS } from '../../utils/style.js';
import { v2Card, v2Payload } from '../../utils/componentsV2.js';

export const data = new SlashCommandBuilder()
    .setName('等級')
    .setDescription('🏅 爵位查詢：檢視自己目前的皇家頭銜與累積的貢獻度')
    .addUserOption((opt) => 
        opt.setName('使用者')
            .setDescription('查看誰的等級')
            .setRequired(false)
    );

export async function execute(interaction) {
    const target = interaction.options.getUser('使用者') || interaction.user;
    const data = getUserLevel(interaction.guildId, target.id);
    const xpNeeded = getXpForLevel(data.level + 1);
    const rankTitle = getRankTitle(data.level);

    const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
    const isBooster = targetMember && targetMember.premiumSince;

    await interaction.reply(buildRankPayload({
        displayName: targetMember?.displayName || target.username,
        avatarUrl: target.displayAvatarURL({ size: 128 }),
        levelData: data,
        xpNeeded,
        rankTitle,
        isBooster,
    }));
}

export function buildRankPayload({ displayName, avatarUrl, levelData, xpNeeded, rankTitle, isBooster }) {
    const safeNeeded = Math.max(1, xpNeeded);
    const percent = Math.max(0, Math.min(100, Math.round((levelData.xp / safeNeeded) * 100)));
    const filled = Math.round(percent / 10);
    const progressBar = `${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)}`;
    const panel = v2Card({
        title: `${displayName} 的皇家功勳`,
        description: '累積文字與語音貢獻的晉升狀態。',
        accentColor: isBooster ? UI_COLORS.BOOST : UI_COLORS.ROYAL,
        thumbnail: avatarUrl,
        statusRows: [
            { label: '爵位', value: rankTitle, tone: 'royal' },
            { label: '等級', value: levelData.level, tone: 'special' },
            { label: '經驗', value: `${levelData.xp} / ${xpNeeded} XP`, tone: 'info' },
            { label: '進度', value: `${progressBar} ${percent}%`, tone: 'success' },
        ],
        fields: [
            {
                name: '王國貢獻',
                value: `文字訊息：**${levelData.total_messages}** 則\n語音時間：**${levelData.total_voice_mins || 0}** 分鐘`,
            },
        ],
        footer: isBooster ? '皇家贊助者 · 目前享有 1.5× 經驗加成' : '持續參與王國活動即可累積經驗。',
    });
    return v2Payload([panel]);
}

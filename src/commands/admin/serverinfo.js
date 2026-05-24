import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getGuildSettings, getReactionRolesByGuild, getAiSettings } from '../../utils/database.js';
import { fmt, COLORS, ansiBlock } from '../../utils/style.js';
import { DEFAULT_AI_MODEL } from '../../utils/aiConfig.js';
import { buildGuildDiagnostics } from '../../utils/guildDiagnostics.js';

export const data = new SlashCommandBuilder()
    .setName('伺服器資訊')
    .setDescription('🏰 領地視察：調閱本伺服器的詳細發展報告與統計資料')
    .setDescriptionLocalizations({ 'zh-TW': '🏰 領地視察：調閱本伺服器的詳細發展報告與統計資料' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
    const guild = interaction.guild;
    const owner = await guild.fetchOwner().catch(() => null);
    const settings = getGuildSettings(guild.id);
    const aiSettings = getAiSettings(guild.id);
    const reactionRoles = getReactionRolesByGuild(guild.id);

    const rewardChannels = [...new Set(reactionRoles.map(r => r.channel_id))];
    const configuredChannelIds = new Set([
        settings.welcome_channel,
        settings.log_channel,
        settings.steam_deal_channel,
        ...rewardChannels,
    ].filter(Boolean));
    const availableChannelIds = new Set();
    await Promise.all([...configuredChannelIds].map(async (channelId) => {
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (channel) availableChannelIds.add(channelId);
    }));

    const diagnostics = buildGuildDiagnostics({
        settings,
        aiSettings: { ...aiSettings, model: aiSettings.model || DEFAULT_AI_MODEL },
        reactionRoles,
        availableChannelIds,
        hasGoogleAiKey: !!process.env.GOOGLE_AI_KEY,
        hasAiAdminPassword: !!process.env.AI_ADMIN_PASSWORD,
    });
    const repairTips = diagnostics.filter(item => item.fix);

    // Channel Counts
    const textChannels = guild.channels.cache.filter(c => c.type === 0).size; // GuildText
    const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size; // GuildVoice
    const categoryChannels = guild.channels.cache.filter(c => c.type === 4).size; // GuildCategory
    const totalChannels = guild.channels.cache.size;

    // Safety / Filter mappings
    const verificationLevels = ['None (無)', 'Low (低)', 'Medium (中)', 'High (高)', 'Highest (最高)'];
    const explicitContentFilters = ['Disabled (關閉)', 'Members Without Roles (無身分組)', 'All Members (全部成員)'];

    // 格式化顯示 (合併為一個緊湊的大區塊，避免排版跑掉)
    const onlineCount = guild.members.cache.filter(m => m.presence?.status && m.presence.status !== 'offline').size;
    const developmentReport = ansiBlock([
        { color: COLORS.GOLD, text: `[ 子民統計 ] 🛡️ 總數: ${guild.memberCount.toString().padEnd(5)} | 👥 線上: ${onlineCount || '活動中'}` },
        { color: COLORS.BLUE, text: `[ 頻道規劃 ] 💬 文字: ${textChannels.toString().padEnd(5)} | 🔊 語音: ${voiceChannels.toString().padEnd(5)} | 📂 目錄: ${categoryChannels}` },
        { color: COLORS.MAGENTA, text: `[ 皇家資產 ] 🎭 身分組: ${guild.roles.cache.size.toString().padEnd(5)} | ✨ 表情: ${guild.emojis.cache.size}` }
    ]);

    // 輔助：格式化開關字串
    const getToggle = (val) => val ? '`● 開啟`' : '`○ 關閉`';

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`🐕👑 領地視察：${guild.name} 發展報告`)
        .setThumbnail(guild.iconURL({ size: 256, dynamic: true }))
        .addFields(
            { name: '👤 領主 (Owner)', value: owner ? `**${owner.user.tag}**` : '未知', inline: true },
            { name: '📅 建國日期', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:d>`, inline: true },
            { name: '🚀 經濟加成', value: `Lv.${guild.premiumTier} (${guild.premiumSubscriptionCount || 0} 加成)`, inline: true },

            { name: '📊 領地發展度統計摘要', value: developmentReport, inline: false },

            {
                name: '🧠 AI 核心意識', value: [
                    `🎉 **派對狀態**: ${getToggle(aiSettings.party_channel_id && aiSettings.party_expires_at > Date.now())}`,
                    `🤖 **當前機型**: \`${aiSettings.model || DEFAULT_AI_MODEL}\``,
                    `🔎 **聯網檢索**: ${getToggle(aiSettings.search_enabled)}`
                ].join('\n'), inline: true
            },

            { name: '🛡️ 安全級別', value: `\`\`\`ansi\n${fmt(COLORS.CYAN, '驗證層級:')} ${verificationLevels[guild.verificationLevel]}\n${fmt(COLORS.CYAN, '內容過濾:')} ${explicitContentFilters[guild.explicitContentFilter]}\n\`\`\``, inline: false },

            {
                name: '🏛️ 功能設定健康檢查',
                value: diagnostics.map(formatDiagnostic).join('\n'),
                inline: false
            },
            {
                name: '🛠️ 建議修正',
                value: repairTips.length > 0
                    ? repairTips.map(item => `**${item.label}**：${item.fix}`).join('\n')
                    : '目前沒有需要處理的設定項目。',
                inline: false
            }
        )
        .setFooter({ text: '🐕👑 本王對自己的領地非常驕傲！汪！' });

    await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
}

function formatDiagnostic(item) {
    const statusIcons = { '正常': '✅', '未設定': '⚪', '設定異常': '⚠️' };
    return `${statusIcons[item.status] || '•'} **${item.label}** [${item.status}] ${item.detail}`;
}

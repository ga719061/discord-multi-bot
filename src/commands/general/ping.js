import { SlashCommandBuilder } from 'discord.js';
import { ansi, COLORS, fmt } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('ping')
    .setNameLocalizations({ 'zh-TW': '延遲' })
    .setDescription('🏓 丟接球：與國王玩丟接球，測試伺服器連線與大腦反應速度')
    .setDescriptionLocalizations({ 'zh-TW': '🏓 丟接球：與國王玩丟接球，測試伺服器連線與大腦反應速度' });

export async function execute(interaction) {
    const sent = await interaction.reply({ content: '🐕 本王正在測量...', withResponse: true });
    const replyMessage = sent.resource ? sent.resource.message : sent;
    const latency = replyMessage.createdTimestamp - interaction.createdTimestamp;
    const apiPing = interaction.client.ws.ping;

    const latencyColor = latency < 200 ? COLORS.GREEN : latency < 500 ? COLORS.GOLD : COLORS.RED;
    const apiColor = apiPing < 100 ? COLORS.GREEN : COLORS.GOLD;

    const statusText = latency < 200 ? '⚡ 本王快如閃電！' : '🐌 本王今天有點懶...';

    await interaction.editReply(
        `🐕👑 汪！本王的反應速度：\n` +
        '```ansi\n' +
        `延遲: ${fmt(latencyColor, latency + 'ms')}\n` +
        `API: ${fmt(apiColor, apiPing + 'ms')}\n` +
        '```\n' + statusText
    );
}

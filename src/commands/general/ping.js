import { SlashCommandBuilder } from 'discord.js';
import { ansi, COLORS, fmt } from '../../utils/style.js';
import { v2EditPayload, v2Notice } from '../../utils/componentsV2.js';
import { UI_COLORS } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('延遲')
    .setDescription('🏓 丟接球：與國王玩丟接球，測試伺服器連線與大腦反應速度')
    .setDescriptionLocalizations({ 'zh-TW': '🏓 丟接球：與國王玩丟接球，測試伺服器連線與大腦反應速度' });

export async function execute(interaction) {
    const sent = await interaction.reply(v2Notice(
        '🏓 丟接球測速中',
        '🐕 本王正在測量反應速度...',
        UI_COLORS.INFO,
        { ephemeral: false, withResponse: true }
    ));
    const replyMessage = sent.resource ? sent.resource.message : sent;
    const latency = replyMessage.createdTimestamp - interaction.createdTimestamp;
    const apiPing = interaction.client.ws.ping;

    const latencyColor = latency < 200 ? COLORS.GREEN : latency < 500 ? COLORS.GOLD : COLORS.RED;
    const apiColor = apiPing < 100 ? COLORS.GREEN : COLORS.GOLD;

    const statusText = latency < 200 ? '⚡ 本王快如閃電！' : '🐌 本王今天有點懶...';

    await interaction.editReply(v2EditPayload(v2Notice(
        '🏓 反應速度報告',
        `🐕👑 汪！本王的反應速度：\n` +
        '```ansi\n' +
        `延遲: ${fmt(latencyColor, latency + 'ms')}\n` +
        `API: ${fmt(apiColor, apiPing + 'ms')}\n` +
        '```\n' + statusText,
        latency < 200 ? UI_COLORS.SUCCESS : UI_COLORS.WARNING,
        { ephemeral: false }
    )));
}

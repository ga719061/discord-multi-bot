import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, version as djsVersion } from 'discord.js';
import os from 'os';
import { fmt, COLORS, ansiBlock } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('botstatus')
    .setNameLocalizations({ 'zh-TW': '機器人狀態' })
    .setDescription('🏥 健康檢查：檢視吉吉國王目前的身體狀況與主機系統負載')
    .setDescriptionLocalizations({ 'zh-TW': '🏥 健康檢查：檢視吉吉國王目前的身體狀況與主機系統負載' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
    // 延遲 (Ping) 語意化顏色
    const ping = interaction.client.ws.ping;
    const pingColor = ping < 150 ? COLORS.CYAN : (ping < 300 ? COLORS.GOLD : COLORS.RED);

    // 運行時間計算
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    // 記憶體使用量
    const memUsage = process.memoryUsage();
    const heapUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(1);
    const heapTotalMB = (memUsage.heapTotal / 1024 / 1024).toFixed(1);
    const memPercent = ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(1);
    const memColor = memPercent < 70 ? COLORS.CYAN : (memPercent < 90 ? COLORS.GOLD : COLORS.RED);

    // 系統資訊
    const loadAvg = os.loadavg().map(l => l.toFixed(2)).join(', ');
    const platform = `${os.type()} ${os.release()} (${os.arch()})`;
    const cpuModel = os.cpus()[0]?.model.split('@')[0].trim() || '隱藏型 CPU';

    // 伺服器與成員統計
    const guildsCount = interaction.client.guilds.cache.size;
    const membersCount = interaction.client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);

    const coreAnsi = [
        { color: COLORS.CYAN, text: `[系統] Node ${process.version} | DJS v${djsVersion}` },
        { color: COLORS.WHITE, text: `[在位] ${days}d ${hours}h ${minutes}m` },
        { color: pingColor, text: `[延遲] ${ping}ms (${ping < 150 ? '優良' : '略慢'})` }
    ];

    const loadAnsi = [
        { color: memColor, text: `[記憶體] ${heapUsedMB} / ${heapTotalMB} MB (${memPercent}%)` },
        { color: COLORS.GRAY, text: `[處理器] ${cpuModel}` },
        { color: COLORS.GRAY, text: `[負載] ${loadAvg}` }
    ];

    const empireAnsi = [
        { color: COLORS.GOLD, text: `[領地] ${guildsCount} 個伺服器` },
        { color: COLORS.GOLD, text: `[子民] ${membersCount} 位使用者` }
    ];

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🐕👑 吉吉國王的大內健康報告')
        .setDescription('報告管理者，這是本王目前的腦力與駐紮城堡的運作概況：')
        .addFields(
            { name: '⚙️ 核心系統', value: ansiBlock(coreAnsi), inline: false },
            { name: '🖥️ 硬體與負載', value: ansiBlock(loadAnsi), inline: false },
            { name: '🏰 統治版圖', value: ansiBlock(empireAnsi), inline: true },
            { name: '🌐 運行環境', value: `\`\`\`fix\n${platform}\n\`\`\``, inline: true }
        )
        .setFooter({ text: '🐕 本王元氣滿滿！隨時待命！汪！' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
}


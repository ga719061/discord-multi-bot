import { EmbedBuilder } from 'discord.js';
import { getGuildSettings } from '../../utils/database.js';
import { fmt, COLORS } from '../../utils/style.js';

export function register(client) {
    client.on('voiceStateUpdate', (oldState, newState) => {
        const guild = newState.guild;
        const settings = getGuildSettings(guild.id);
        if (!settings?.log_channel) return;
        const channel = guild.channels.cache.get(settings.log_channel);
        if (!channel) return;

        const member = newState.member;
        if (!member) return;

        // 加入語音
        if (!oldState.channelId && newState.channelId) {
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🐕🎤 汪！有人來開派對了！')
                .setThumbnail(member.user.displayAvatarURL())
                .setDescription(`**${member.displayName}** 跑進了 **${newState.channel.name}**！\n` + '```ansi\n' + fmt(COLORS.GREEN, '本王也要一起玩！汪！') + '\n```')
                .setTimestamp();
            channel.send({ embeds: [embed] }).catch(() => { });
        }

        // 離開語音
        else if (oldState.channelId && !newState.channelId) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🐕🚪 派對結束了嗎？')
                .setThumbnail(member.user.displayAvatarURL())
                .setDescription(`**${member.displayName}** 離開了 **${oldState.channel.name}**... \n` + '```ansi\n' + fmt(COLORS.RED, '汪... 寂寞...') + '\n```')
                .setTimestamp();
            channel.send({ embeds: [embed] }).catch(() => { });
        }

        // 切換頻道
        else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🐕🔄 跳來跳去的！')
                .setThumbnail(member.user.displayAvatarURL())
                .setDescription(
                    `**${member.displayName}** 的行蹤：\n` +
                    '```ansi\n' +
                    fmt(COLORS.GRAY, oldState.channel.name) + ' ➔ ' + fmt(COLORS.BLUE, newState.channel.name) +
                    '\n```'
                )
                .setTimestamp();
            channel.send({ embeds: [embed] }).catch(() => { });
        }
    });
}

import { EmbedBuilder } from 'discord.js';
import { getGuildSettings } from '../../utils/database.js';
import { fmt, COLORS } from '../../utils/style.js';

export function register(client) {
    // 頻道變更
    client.on('channelCreate', (channel) => {
        if (!channel.guild) return;
        const settings = getGuildSettings(channel.guild.id);
        const logChannel = channel.guild.channels.cache.get(settings?.log_channel);
        if (logChannel) {
            logChannel.send({
                embeds: [new EmbedBuilder().setTitle('🐕🏗️ 本王批准新領地建設！').setDescription(`**名稱:** ${channel.name}\n**類型:** ${channel.type}\n汪！這裡要蓋什麼呢？`).setColor(0x00FF00).setTimestamp()]
            }).catch(() => { });
        }
    });

    client.on('channelDelete', (channel) => {
        if (!channel.guild) return;
        const settings = getGuildSettings(channel.guild.id);
        const logChannel = channel.guild.channels.cache.get(settings?.log_channel);
        if (logChannel) {
            logChannel.send({
                embeds: [new EmbedBuilder().setTitle('🐕🏚️ 這裡是違建嗎？拆掉！').setDescription(`**名稱:** ${channel.name}\n本王還沒玩夠呢... 汪...`).setColor(0xFF0000).setTimestamp()]
            }).catch(() => { });
        }
    });

    client.on('channelUpdate', (oldChannel, newChannel) => {
        if (!newChannel.guild) return;
        if (oldChannel.name === newChannel.name) return;
        const settings = getGuildSettings(newChannel.guild.id);
        const logChannel = newChannel.guild.channels.cache.get(settings?.log_channel);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('🐕📺 改頭換面！')
                .addFields(
                    { name: '舊招牌', value: '```ansi\n' + fmt(COLORS.GRAY, oldChannel.name) + '\n```', inline: true },
                    { name: '新招牌', value: '```ansi\n' + fmt(COLORS.BLUE, newChannel.name) + '\n```', inline: true }
                )
                .setDescription('汪！本王喜歡這個新名字嗎？')
                .setColor(0x0099FF).setTimestamp();
            logChannel.send({ embeds: [embed] }).catch(() => { });
        }
    });

    // 身分組變更
    client.on('roleCreate', (role) => {
        const settings = getGuildSettings(role.guild.id);
        const logChannel = role.guild.channels.cache.get(settings?.log_channel);
        if (logChannel) {
            logChannel.send({
                embeds: [new EmbedBuilder().setTitle('🐕🏷️ 頒發新頭銜！').setDescription(`**名稱:** ${role.name}\n看起來很厲害的樣子！汪！`).setColor(0x00FF00).setTimestamp()]
            }).catch(() => { });
        }
    });
    client.on('roleDelete', (role) => {
        const settings = getGuildSettings(role.guild.id);
        const logChannel = role.guild.channels.cache.get(settings?.log_channel);
        if (logChannel) {
            logChannel.send({
                embeds: [new EmbedBuilder().setTitle('🐕✂️ 頭銜被收回了！').setDescription(`**名稱:** ${role.name}\n再見了... 榮耀...`).setColor(0xFF0000).setTimestamp()]
            }).catch(() => { });
        }
    });
    client.on('roleUpdate', (oldRole, newRole) => {
        if (oldRole.name === newRole.name) return;
        const settings = getGuildSettings(newRole.guild.id);
        const logChannel = newRole.guild.channels.cache.get(settings?.log_channel);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('🐕🏷️ 頭銜改名了！')
                .addFields(
                    { name: '舊的', value: '```ansi\n' + fmt(COLORS.GRAY, oldRole.name) + '\n```', inline: true },
                    { name: '新的', value: '```ansi\n' + fmt(COLORS.BLUE, newRole.name) + '\n```', inline: true }
                )
                .setColor(0x0099FF).setTimestamp();
            logChannel.send({ embeds: [embed] }).catch(() => { });
        }
    });

    // Emoji 變更
    client.on('emojiCreate', (emoji) => {
        const settings = getGuildSettings(emoji.guild.id);
        const logChannel = emoji.guild.channels.cache.get(settings?.log_channel);
        if (logChannel) {
            logChannel.send({
                embeds: [new EmbedBuilder().setTitle('🐕😀 新的表情包！').setDescription(`**名稱:** ${emoji.name}\n快用它來讚美本王！汪！\n${emoji}`).setThumbnail(emoji.url).setColor(0x00FF00).setTimestamp()]
            }).catch(() => { });
        }
    });
    client.on('emojiDelete', (emoji) => {
        const settings = getGuildSettings(emoji.guild.id);
        const logChannel = emoji.guild.channels.cache.get(settings?.log_channel);
        if (logChannel) {
            logChannel.send({
                embeds: [new EmbedBuilder().setTitle('🐕😢 表情包少了一個...').setDescription(`**名稱:** ${emoji.name}`).setThumbnail(emoji.url).setColor(0xFF0000).setTimestamp()]
            }).catch(() => { });
        }
    });

    // 伺服器變更
    client.on('guildUpdate', (oldGuild, newGuild) => {
        const settings = getGuildSettings(newGuild.id);
        const logChannel = newGuild.channels.cache.get(settings?.log_channel);
        if (!logChannel) return;

        if (oldGuild.name !== newGuild.name) {
            logChannel.send({
                embeds: [new EmbedBuilder().setTitle('🐕🏰 我們搬家了嗎？')
                    .addFields(
                        { name: '原本是', value: '```ansi\n' + fmt(COLORS.GRAY, oldGuild.name) + '\n```' },
                        { name: '現在是', value: '```ansi\n' + fmt(COLORS.BLUE, newGuild.name) + '\n```' }
                    )
                    .setDescription('喔！原來只是改名啊！嚇死本王了！').setColor(0x0099FF).setTimestamp()]
            }).catch(() => { });
        }
        if (oldGuild.icon !== newGuild.icon) {
            logChannel.send({
                embeds: [new EmbedBuilder().setTitle('🐕🖼️ 城堡掛上了新畫像！').setDescription('本王喜歡這個新風格！汪！').setThumbnail(newGuild.iconURL()).setColor(0x0099FF).setTimestamp()]
            }).catch(() => { });
        }
    });
}

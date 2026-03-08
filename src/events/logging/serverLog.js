import { EmbedBuilder, AuditLogEvent } from 'discord.js';
import { sendLog, getAuditLogExecutor } from '../../utils/logUtils.js';
import { fmt, COLORS } from '../../utils/style.js';

export function register(client) {
    // 頻道變更
    client.on('channelCreate', async (channel) => {
        if (!channel.guild) return;
        const executor = await getAuditLogExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
        
        const embed = new EmbedBuilder()
            .setTitle('🐕🏗️ 本王批准新領地建設！')
            .setDescription(`**名稱:** ${channel.name}\n**類型:** ${channel.type}\n**執行者:** ${executor ? executor.tag : '未知'}\n汪！這裡要蓋什麼呢？`)
            .setColor(0x00FF00)
            .setTimestamp();
        
        sendLog(channel.guild, embed, 'server');
    });

    client.on('channelDelete', async (channel) => {
        if (!channel.guild) return;
        const executor = await getAuditLogExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);

        const embed = new EmbedBuilder()
            .setTitle('🐕🏚️ 這裡是違建嗎？拆掉！')
            .setDescription(`**名稱:** ${channel.name}\n**執行者:** ${executor ? executor.tag : '未知'}\n本王還沒玩夠呢... 汪...`)
            .setColor(0xFF0000)
            .setTimestamp();
        
        sendLog(channel.guild, embed, 'server');
    });

    client.on('channelUpdate', async (oldChannel, newChannel) => {
        if (!newChannel.guild) return;
        if (oldChannel.name === newChannel.name) return;
        
        const executor = await getAuditLogExecutor(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);

        const embed = new EmbedBuilder()
            .setTitle('🐕📺 改頭換面！')
            .addFields(
                { name: '舊招牌', value: '```ansi\n' + fmt(COLORS.GRAY, oldChannel.name) + '\n```', inline: true },
                { name: '新招牌', value: '```ansi\n' + fmt(COLORS.BLUE, newChannel.name) + '\n```', inline: true },
                { name: '負責人', value: executor ? executor.tag : '未知', inline: false }
            )
            .setDescription('汪！本王喜歡這個新名字嗎？')
            .setColor(0x0099FF).setTimestamp();
        
        sendLog(newChannel.guild, embed, 'server');
    });

    // 身分組變更
    client.on('roleCreate', async (role) => {
        const executor = await getAuditLogExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
        const embed = new EmbedBuilder()
            .setTitle('🐕🏷️ 頒發新頭銜！')
            .setDescription(`**名稱:** ${role.name}\n**頒發者:** ${executor ? executor.tag : '未知'}\n看起來很厲害的樣子！汪！`)
            .setColor(0x00FF00).setTimestamp();
        
        sendLog(role.guild, embed, 'server');
    });

    client.on('roleDelete', async (role) => {
        const executor = await getAuditLogExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
        const embed = new EmbedBuilder()
            .setTitle('🐕✂️ 頭銜被收回了！')
            .setDescription(`**名稱:** ${role.name}\n**執行者:** ${executor ? executor.tag : '未知'}\n再見了... 榮耀...`)
            .setColor(0xFF0000).setTimestamp();
        
        sendLog(role.guild, embed, 'server');
    });

    client.on('roleUpdate', async (oldRole, newRole) => {
        if (oldRole.name === newRole.name) return;
        const executor = await getAuditLogExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);

        const embed = new EmbedBuilder()
            .setTitle('🐕🏷️ 頭銜改名了！')
            .addFields(
                { name: '舊的', value: '```ansi\n' + fmt(COLORS.GRAY, oldRole.name) + '\n```', inline: true },
                { name: '新的', value: '```ansi\n' + fmt(COLORS.BLUE, newRole.name) + '\n```', inline: true },
                { name: '執行者', value: executor ? executor.tag : '未知', inline: false }
            )
            .setColor(0x0099FF).setTimestamp();
        
        sendLog(newRole.guild, embed, 'server');
    });

    // Emoji 變更
    client.on('emojiCreate', async (emoji) => {
        const executor = await getAuditLogExecutor(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id);
        const embed = new EmbedBuilder()
            .setTitle('🐕😀 新的表情包！')
            .setDescription(`**名稱:** ${emoji.name}\n**上傳者:** ${executor ? executor.tag : '未知'}\n快用它來讚美本王！汪！\n${emoji}`)
            .setThumbnail(emoji.url)
            .setColor(0x00FF00)
            .setTimestamp();
        
        sendLog(emoji.guild, embed, 'server');
    });

    client.on('emojiDelete', async (emoji) => {
        const executor = await getAuditLogExecutor(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);
        const embed = new EmbedBuilder()
            .setTitle('🐕😢 表情包少了一個...')
            .setDescription(`**名稱:** ${emoji.name}\n**執行者:** ${executor ? executor.tag : '未知'}`)
            .setThumbnail(emoji.url)
            .setColor(0xFF0000)
            .setTimestamp();
        
        sendLog(emoji.guild, embed, 'server');
    });

    // 伺服器變更
    client.on('guildUpdate', async (oldGuild, newGuild) => {
        const executor = await getAuditLogExecutor(newGuild, AuditLogEvent.GuildUpdate, newGuild.id);

        if (oldGuild.name !== newGuild.name) {
            const embed = new EmbedBuilder()
                .setTitle('🐕🏰 我們搬家了嗎？')
                .addFields(
                    { name: '原本是', value: '```ansi\n' + fmt(COLORS.GRAY, oldGuild.name) + '\n```' },
                    { name: '現在是', value: '```ansi\n' + fmt(COLORS.BLUE, newGuild.name) + '\n```' },
                    { name: '誰改的', value: executor ? executor.tag : '未知', inline: false }
                )
                .setDescription('喔！原來只是改名啊！嚇死本王了！').setColor(0x0099FF).setTimestamp();
            sendLog(newGuild, embed, 'server');
        }
        if (oldGuild.icon !== newGuild.icon) {
            const embed = new EmbedBuilder()
                .setTitle('🐕🖼️ 城堡掛上了新畫像！')
                .setDescription(`本王喜歡這個新風格！汪！\n**執行者:** ${executor ? executor.tag : '未知'}`)
                .setThumbnail(newGuild.iconURL())
                .setColor(0x0099FF).setTimestamp();
            sendLog(newGuild, embed, 'server');
        }
    });
}

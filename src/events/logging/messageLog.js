import { EmbedBuilder, AuditLogEvent } from 'discord.js';
import { sendLog, getAuditLogExecutor } from '../../utils/logUtils.js';
import { fmt, COLORS } from '../../utils/style.js';

export function register(client) {
    client.on('messageDelete', async (message) => {
        if (!message.guild || message.author?.bot) return;

        // 嘗試偵測刪除者 (如果是管理員刪除，Audit Log 會有紀錄)
        const executor = await getAuditLogExecutor(message.guild, AuditLogEvent.MessageDelete, message.author.id);

        const content = message.content || '';
        const hasEmoji = content.match(/<a?:\w+:\d+>/) || content.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u);
        const isPureEmoji = content.length > 0 && content.replace(/<a?:\w+:\d+>/g, '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/gu, '').trim().length === 0;

        let displayContent;
        if (content) {
            if (isPureEmoji) {
                displayContent = content;
            } else if (hasEmoji) {
                displayContent = '```ansi\n' + content.replace(/`/g, '`\u200b') + '\n```';
            } else {
                const safeContent = content.length > 1000 ? content.slice(0, 990) + '...' : content;
                displayContent = '```ansi\n' + fmt(COLORS.RED, safeContent.replace(/`/g, '`\u200b')) + '\n```';
            }
        } else if (message.stickers?.size > 0) {
            displayContent = `（貼圖: ${message.stickers.first().name}）`;
        } else {
            displayContent = '（只有圖片或附件）';
        }

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🐕🗑️ 本王發現訊息被吃掉了！')
            .setDescription(
                `**原有者:** ${message.member?.displayName || message.author.tag} (<@${message.author.id}>)\n` +
                `**執行者:** ${executor ? `${executor.tag} (管理員)` : '用戶本人'}\n` +
                `**在哪裡:** ${message.channel}\n` +
                `**內容:**\n${displayContent}`
            )
            .setFooter({ text: `ID: ${message.id}` })
            .setTimestamp();

        if (message.attachments.size > 0) {
            embed.setImage(message.attachments.first().url);
        }

        sendLog(message.guild, embed, 'message');
    });

    client.on('messageUpdate', async (oldMessage, newMessage) => {
        if (!oldMessage.guild || oldMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return;

        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('🐕✏️ 本王看到訊息被偷改了！')
            .setDescription(`**作者:** ${oldMessage.member?.displayName || oldMessage.author.tag} (<@${oldMessage.author.id}>)\n**頻道:** ${oldMessage.channel}\n[👉 跳過去看看](${newMessage.url})`)
            .addFields(
                { name: '原本的樣子', value: '```ansi\n' + fmt(COLORS.GRAY, (oldMessage.content || '無內容')) + '\n```' },
                { name: '現在的樣子', value: '```ansi\n' + fmt(COLORS.GOLD, (newMessage.content || '無內容')) + '\n```' }
            )
            .setFooter({ text: `ID: ${newMessage.id}` })
            .setTimestamp();

        sendLog(oldMessage.guild, embed, 'message');
    });
}

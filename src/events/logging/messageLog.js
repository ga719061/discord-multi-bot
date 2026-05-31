import { EmbedBuilder, AuditLogEvent } from 'discord.js';
import { sendLog, getAuditLogExecutor, resolveMentions } from '../../utils/logUtils.js';
import { fmt, COLORS, UI_COLORS } from '../../utils/style.js';
import { embedsToV2Payload } from '../../utils/componentsV2.js';

export function register(client) {
    client.on('messageDelete', async (message) => {
        // Partial 訊息沒有作者/內容資訊，記錄下來只是噪音，直接跳過
        if (message.partial) return;
        if (!message.guild || !message.author || message.author.bot) return;

        // 嘗試偵測刪除者 (如果是管理員刪除，Audit Log 會有紀錄)
        const executor = await getAuditLogExecutor(message.guild, AuditLogEvent.MessageDelete, message.author.id);

        let content = message.content || '';
        content = await resolveMentions(message.guild, content); // 解析標記為名稱

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
        } else if (message.attachments.size > 0) {
            const count = message.attachments.size;
            displayContent = `（本王抓到了 ${count} 個附件，正在嘗試還原圖片...）`;
        } else {
            displayContent = '（查無內容）';
        }

        const embed = new EmbedBuilder()
            .setColor(UI_COLORS.DANGER)
            .setTitle('🐕🗑️ 本王發現訊息被吃掉了！')
            .setDescription(
                `**原有者:** ${message.member?.displayName || message.author.tag} (${message.author.tag})\n` +
                `**執行者:** ${executor ? `${executor.tag} (管理員)` : '用戶本人'}\n` +
                `**在哪裡:** ${message.channel}\n` +
                `**內容:**\n${displayContent}`
            )
            .setFooter({ text: `ID: ${message.id}` })
            .setTimestamp();

        const embeds = [embed];

        if (message.attachments.size > 0) {
            const attachments = Array.from(message.attachments.values());
            // 第一張圖放主 Embed
            const first = attachments[0];
            if (first.contentType?.startsWith('image/')) {
                embed.setImage(first.proxyURL || first.url);
            }

            // 其他圖片如果是多張，可以加副 Embed (Discord 最多支援 10 個 Embeds 顯示連圖)
            for (let i = 1; i < attachments.length; i++) {
                const att = attachments[i];
                if (att.contentType?.startsWith('image/')) {
                    embeds.push(new EmbedBuilder().setURL(embed.data.url || 'https://discord.com').setImage(att.proxyURL || att.url));
                }
            }
        }

        await sendLog(message.guild, embedsToV2Payload(embeds), 'message');
    });

    client.on('messageUpdate', async (oldMessage, newMessage) => {
        if (oldMessage.partial) return;
        if (!oldMessage.guild || !oldMessage.author || oldMessage.author.bot) return;
        if (oldMessage.content === newMessage.content) return;

        let oldContent = oldMessage.content || '';
        let newContent = newMessage.content || '';

        // 解析標記
        oldContent = await resolveMentions(oldMessage.guild, oldContent);
        newContent = await resolveMentions(newMessage.guild, newContent);

        const embed = new EmbedBuilder()
            .setColor(UI_COLORS.WARNING)
            .setTitle('🐕✏️ 本王看到訊息被偷改了！')
            .setDescription(`**作者:** ${oldMessage.member?.displayName || oldMessage.author.tag} (${oldMessage.author.tag})\n**頻道:** ${oldMessage.channel}\n[👉 跳過去看看](${newMessage.url})`)
            .addFields(
                { name: '原本的樣子', value: '```ansi\n' + fmt(COLORS.GRAY, (oldContent || '無內容')) + '\n```' },
                { name: '現在的樣子', value: '```ansi\n' + fmt(COLORS.GOLD, (newContent || '無內容')) + '\n```' }
            )
            .setFooter({ text: `ID: ${newMessage.id}` })
            .setTimestamp();

        sendLog(oldMessage.guild, embed, 'message');
    });
}

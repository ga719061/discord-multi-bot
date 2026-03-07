import { EmbedBuilder } from 'discord.js';
import { getGuildSettings } from '../../utils/database.js';
import { fmt, COLORS } from '../../utils/style.js';

export function register(client) {
    client.on('messageDelete', async (message) => {
        if (!message.guild || message.author?.bot) return;

        const settings = getGuildSettings(message.guild.id);
        if (!settings?.log_channel) return;
        const logChannel = message.guild.channels.cache.get(settings.log_channel);
        if (!logChannel) return;

        // 偵測是否包含表情符號 (Emoji/Stickers 偵測優化)
        const content = message.content || '';
        const hasEmoji = content.match(/<a?:\w+:\d+>/) || content.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u);
        const isPureEmoji = content.length > 0 && content.replace(/<a?:\w+:\d+>/g, '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/gu, '').trim().length === 0;

        let displayContent;
        if (content) {
            if (isPureEmoji) {
                // 純表情不進 ansi block 才能正常渲染
                displayContent = content;
            } else if (hasEmoji) {
                // 包含表情時，若進 ansi block 會有部分 Discord 用戶端看到黑白符號
                // 因此直接給代碼塊，但不加顏色碼
                displayContent = '```ansi\n' + content.replace(/`/g, '`\u200b') + '\n```';
            } else {
                // 純文字進 ansi block 紅色加成，fmt 內部已處理多行
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
                `**是誰丟的？:** ${message.member?.displayName || message.author.displayName || message.author.username} (<@${message.author.id}>)\n` +
                `**在哪裡丟的？:** ${message.channel}\n` +
                `**內容是什麼？:**\n${displayContent}`
            )
            .setFooter({ text: `ID: ${message.id} | 汪！ 撿回來給你看了！` })
            .setTimestamp();

        if (message.attachments.size > 0) {
            embed.setImage(message.attachments.first().url);
        }

        logChannel.send({ embeds: [embed] }).catch(() => { });
    });

    client.on('messageUpdate', async (oldMessage, newMessage) => {
        if (!oldMessage.guild || oldMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return; // 忽略 embed 更新

        const settings = getGuildSettings(oldMessage.guild.id);
        if (!settings?.log_channel) return;
        const logChannel = oldMessage.guild.channels.cache.get(settings.log_channel);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('🐕✏️ 本王看到訊息被偷改了！')
            .setDescription(`**兇手是誰？:** ${oldMessage.member?.displayName || oldMessage.author.displayName || oldMessage.author.username} (<@${oldMessage.author.id}>)\n**在哪裡改的？:** ${oldMessage.channel}\n[👉 跳過去看看](${newMessage.url})`)
            .addFields(
                { name: '原本的樣子', value: '```ansi\n' + fmt(COLORS.GRAY, oldMessage.content || '（無內容）') + '\n```' },
                { name: '現在的樣子', value: '```ansi\n' + fmt(COLORS.GOLD, newMessage.content || '（無內容）') + '\n```' }
            )
            .setFooter({ text: `ID: ${newMessage.id} | 汪！逃不過本王的法眼！` })
            .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(() => { });
    });
}

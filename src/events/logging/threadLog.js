import { EmbedBuilder, AuditLogEvent } from 'discord.js';
import { sendLog, getAuditLogExecutor } from '../../utils/logUtils.js';

export function register(client) {
    client.on('threadCreate', async (thread) => {
        const executor = await getAuditLogExecutor(thread.guild, AuditLogEvent.ThreadCreate, thread.id);
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🐕🧵 新的討論串！')
            .setDescription(`**名稱:** ${thread.name}\n**位置:** ${thread.parent}\n**發起者:** ${executor ? executor.tag : '未知'}`)
            .setTimestamp();
        
        sendLog(thread.guild, embed, 'thread');
    });

    client.on('threadDelete', async (thread) => {
        const executor = await getAuditLogExecutor(thread.guild, AuditLogEvent.ThreadDelete, thread.id);
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🐕✂️ 討論串被砍了！')
            .setDescription(`**名稱:** ${thread.name}\n**執行者:** ${executor ? executor.tag : '未知'}`)
            .setTimestamp();
        
        sendLog(thread.guild, embed, 'thread');
    });

    client.on('threadUpdate', async (oldThread, newThread) => {
        if (oldThread.archived && !newThread.archived) {
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🐕🔓 討論串解封！')
                .setDescription(`**名稱:** ${newThread.name}\n又可以繼續汪汪叫了！`)
                .setTimestamp();
            sendLog(newThread.guild, embed, 'thread');
        } else if (!oldThread.archived && newThread.archived) {
            const embed = new EmbedBuilder()
                .setColor(0x99AAB5)
                .setTitle('🐕🔒 討論串已封存')
                .setDescription(`**名稱:** ${newThread.name}\n安靜... 本王要睡覺了。`)
                .setTimestamp();
            sendLog(newThread.guild, embed, 'thread');
        }
    });
}

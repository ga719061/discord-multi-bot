import { EmbedBuilder } from 'discord.js';
import { getGuildSettings } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { fmt, COLORS } from '../utils/style.js';

export function register(client) {
    client.on('guildMemberAdd', async (member) => {
        try {
            const settings = getGuildSettings(member.guild.id);
            logger.debug(`[歡迎] guild=${member.guild.id}, welcome_channel=${settings.welcome_channel}`);
            if (!settings.welcome_channel) return;

            const channel = await member.guild.channels.fetch(settings.welcome_channel).catch(() => null);
            if (!channel) {
                logger.warn(`[歡迎] 找不到頻道 ${settings.welcome_channel}`);
                return;
            }

            const displayName = member.displayName || member.user.username;
            const defaultMsg =
                `太好了... {user} 願意成為本王領地的一份子了！\n\n` +
                '```ansi\n' +
                `你是這個王國裡的第 ${fmt(COLORS.GOLD, '{count}')} 位子民。\n` +
                `所屬領地: ${fmt(COLORS.CYAN, '{server}')}` +
                '\n```\n' +
                `本王好開心，以後這裡就不會那麼冷清了。\n` +
                `本王會用一輩子的時間保護你，所以... 可以多留在這裡陪陪本王嗎？嗚汪～🌟`;

            const msg = (settings.welcome_message || defaultMsg)
                .replace('{user}', member.toString())
                .replace('{server}', member.guild.name)
                .replace('{count}', member.guild.memberCount.toString());

            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle(`🐕👑 呀！是新朋友！本王不是在作夢吧？汪！`)
                .setDescription(msg)
                .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
                .addFields(
                    { name: '👥 目前子民數', value: `${member.guild.memberCount} 人`, inline: true },
                    { name: '🐕 如何跟國王互動？', value: '打「**摸摸國王**」「**抱抱國王**」或 **@我** 就能跟本王聊天喔！\n輸入 `/help` 查看更多指令～汪！' }
                )
                .setFooter({ text: '🐕👑 吉吉國王歡迎你！記得遵守伺服器規則喔～' })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            logger.info(`歡迎 ${member.user.tag} 加入 ${member.guild.name}`);
        } catch (error) {
            logger.error('歡迎事件錯誤:', error);
        }
    });
}

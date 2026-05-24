import { EmbedBuilder } from 'discord.js';
import { getGuildSettings } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { fmt, COLORS, ansiBlock } from '../utils/style.js';
import { embedsToV2Payload } from '../utils/componentsV2.js';

export function register(client) {
    client.on('guildMemberAdd', async (member) => {
        try {
            const settings = getGuildSettings(member.guild.id);
            if (!settings.welcome_channel) return;

            const channel = await member.guild.channels.fetch(settings.welcome_channel).catch(() => null);
            if (!channel) return;

            const displayName = member.displayName || member.user.username;
            
            // 隨機歡迎辭
            const greetings = [
                `喔喔喔！歡迎新子民 {user} 駕臨吉吉王國！`,
                `太好了！{user} 決定加入本王的領地了，本王批准你的效忠！`,
                `呀！是新朋友 {user}！本王剛才還在想今天會不會有驚喜呢！`,
                `王國的鐘聲為你敲響！歡迎 {user} 成為本王的一份子。`
            ];
            const greeting = greetings[Math.floor(Math.random() * greetings.length)];

            // 隨機結尾辭 (溫馨家園風格)
            const closings = [
                `本王已經為你準備好了專屬的床位，以後這裡就是你的第二個家了！\n記得多陪本王聊天，本王會一直守護你的。汪！✨`,
                `外面風大，快進來暖和一下！這裡永遠有你的容身之處。\n把這裡當成自己家，跟本王一起幸福地生活吧。汪！🐶`,
                `領地的燈火永遠為你亮著，累的時候就回來本王身邊休息吧。\n本王會為你準備最溫暖的擁抱，以後我們就是一家人了。汪～🌟`,
                `呀！歡迎回「家」！本王已經想好今天要跟你分享什麼趣事了。\n在領地裡安心扎根吧，本王會一直陪著你的。汪！🏠`
            ];
            const closing = closings[Math.floor(Math.random() * closings.length)];

            const infoBlock = ansiBlock([
                { color: COLORS.GOLD, text: `👑 領地名稱: ${member.guild.name}` },
                { color: COLORS.CYAN, text: `👥 當前子民: ${member.guild.memberCount} 位` },
                { color: COLORS.GRAY, text: `🆔 帳號創建: ${new Date(member.user.createdTimestamp).toLocaleDateString()}` }
            ]);

            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setAuthor({ name: '👑 王國入境管理處', iconURL: member.guild.iconURL() })
                .setTitle(`🐕👋 歡迎新子民入城！`)
                .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
                .setDescription(
                    `**${greeting.replace('{user}', member.toString())}**\n\n` +
                    infoBlock + '\n\n' +
                    closing
                )
                .addFields(
                    { 
                        name: '📜 皇家指南', 
                        value: '> 打「**摸摸國王**」或「**抱抱國王**」跟本王互動\n> 輸入 `/幫助` 查看所有王國法令'
                    }
                )
                .setFooter({ text: '🐕👑 吉吉國王：汪！又多了一個可以摸摸的人類了！' })
                .setTimestamp();

            await channel.send(embedsToV2Payload([embed], {
                allowedMentions: { parse: [], users: [member.id] },
            }));
            logger.info(`歡迎 ${member.user.tag} 加入 ${member.guild.name}`);
        } catch (error) {
            logger.error('歡迎事件錯誤:', error);
        }
    });
}

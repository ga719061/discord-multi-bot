import { EmbedBuilder, AuditLogEvent } from 'discord.js';
import { getGuildSettings } from '../../utils/database.js';
import { fmt, COLORS } from '../../utils/style.js';

export function register(client) {
    // 成員加入 (System Log)
    client.on('guildMemberAdd', (member) => {
        const settings = getGuildSettings(member.guild.id);
        if (!settings?.log_channel) return;
        const channel = member.guild.channels.cache.get(settings.log_channel);
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🐕👋 新子民加入領地！')
                .setThumbnail(member.user.displayAvatarURL())
                .setDescription(`**${member.displayName}** 加入了本王的領地！汪！\n\nID: \`${member.id}\`\n帳號創建於: <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`)
                .setTimestamp()
                .setFooter({ text: '🐕 國王正在觀察這位新子民...' });
            channel.send({ embeds: [embed] }).catch(() => { });
        }
    });

    // 成員離開 (System Log)
    client.on('guildMemberRemove', (member) => {
        const settings = getGuildSettings(member.guild.id);
        if (!settings?.log_channel) return;
        const channel = member.guild.channels.cache.get(settings.log_channel);
        if (channel) {
            // 嘗試取得身分組資訊
            let roles = '無法取得';
            try {
                roles = member.roles.cache
                    .filter((r) => r.id !== member.guild.id)
                    .map((r) => r.name)
                    .join(', ') || '無';
            } catch {
                roles = '（資料不完整）';
            }

            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🐕💔 子民離開了本王的領地...')
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: '👤 離開者', value: `${member.displayName} (\`${member.id}\`)` },
                    { name: '📅 加入日期', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : '未知', inline: true },
                    { name: '👥 剩餘子民', value: `${member.guild.memberCount} 人`, inline: true },
                    { name: '🏷️ 曾擁有身分組', value: '```ansi\n' + fmt(COLORS.GRAY, roles.length > 1000 ? roles.slice(0, 990) + '...' : roles) + '\n```' }
                )
                .setTimestamp()
                .setFooter({ text: '🐕 本王會想念你的... 嗚嗚...' });
            channel.send({ embeds: [embed] }).catch(() => { });
        }
    });

    // 使用 Map 暫存最近處理過的狀態，避免重複發送
    const memberUpdateCache = new Map();
    const nicknameUpdateCache = new Map();

    // 成員更新 (暱稱/身分組/禁言)
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        // 如果 oldMember 是 Partial (未快取)，則不進行細部比較 (避免因為快取重建而誤判所有變動)
        if (oldMember.partial) return;

        const settings = getGuildSettings(newMember.guild.id);
        if (!settings?.log_channel) return;
        const channel = newMember.guild.channels.cache.get(settings.log_channel);
        if (!channel) return;

        // 暱稱變更 - 嚴謹比對 null/undefined 並加入暫存去重
        const oldNick = oldMember.nickname ?? null;
        const newNick = newMember.nickname ?? null;

        if (oldNick !== newNick) {
            const nickCacheKey = `${newMember.id}_nick_${newNick}`;
            if (nicknameUpdateCache.get(nickCacheKey)) return;
            nicknameUpdateCache.set(nickCacheKey, Date.now());
            setTimeout(() => nicknameUpdateCache.delete(nickCacheKey), 5000);

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🐕📛 子民改名了！')
                .setDescription(`**${newMember.displayName}** 換了新名字！汪！`)
                .addFields(
                    { name: '原本的名字', value: '```ansi\n' + fmt(COLORS.GRAY, oldNick || '（原本沒綽號）') + '\n```', inline: true },
                    { name: '現在的名字', value: '```ansi\n' + fmt(COLORS.BLUE, newNick || '（移除綽號）') + '\n```', inline: true }
                )
                .setTimestamp();
            channel.send({ embeds: [embed] }).catch(() => { });
        }

        // 身分組變更 - 使用 ID 集合比較，比 size 更準確，並防止重複
        const oldRoleIds = [...oldMember.roles.cache.keys()].sort().join(',');
        const newRoleIds = [...newMember.roles.cache.keys()].sort().join(',');

        if (oldRoleIds !== newRoleIds) {
            // 檢查重複 (避免 Discord 亂噴多次相同事件)
            const cacheKey = `${newMember.id}_roles_${newRoleIds}`;
            if (memberUpdateCache.get(cacheKey)) return;
            memberUpdateCache.set(cacheKey, Date.now());
            setTimeout(() => memberUpdateCache.delete(cacheKey), 5000);

            const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id)).map(r => r.name).join(', ');
            const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id)).map(r => r.name).join(', ');

            // 如果沒有實際增加或刪除角色 (例如緩存變動)，則不發送
            if (!added && !removed) return;

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🐕🏷️ 身分組變動！')
                .setDescription(`**${newMember.displayName}** 的身分有所改變！汪！`)
                .setTimestamp();

            if (added) embed.addFields({ name: '⬇️ 獲得身分', value: '```ansi\n' + fmt(COLORS.GREEN, added) + '\n```' });
            if (removed) embed.addFields({ name: '⬆️ 失去身分', value: '```ansi\n' + fmt(COLORS.RED, removed) + '\n```' });

            channel.send({ embeds: [embed] }).catch(() => { });
        }

        // 禁言 (Timeout)
        if (!oldMember.isCommunicationDisabled() && newMember.isCommunicationDisabled()) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🐕🔇 壞狗狗！被禁言了！')
                .setDescription(`**${newMember.displayName}** 被關進反省室了！汪！\n` + '```ansi\n' + `解除時間: ${fmt(COLORS.RED, new Date(newMember.communicationDisabledUntilTimestamp).toLocaleString())}` + '\n```')
                .setTimestamp();
            channel.send({ embeds: [embed] }).catch(() => { });
        }
        // 解除禁言
        if (oldMember.isCommunicationDisabled() && !newMember.isCommunicationDisabled()) {
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🐕🔊 解除禁言！')
                .setDescription(`**${newMember.displayName}** 反省結束，可以說話了！汪！`)
                .setTimestamp();
            channel.send({ embeds: [embed] }).catch(() => { });
        }
    });

    // 封鎖
    client.on('guildBanAdd', async (ban) => {
        const settings = getGuildSettings(ban.guild.id);
        if (!settings?.log_channel) return;
        const channel = ban.guild.channels.cache.get(settings.log_channel);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🐕🔨 驅逐出境！ (Ban)')
            .setThumbnail(ban.user.displayAvatarURL())
            .setDescription(`**${ban.user.displayName || ban.user.username}** 嚴重違反國法，已被本王驅逐！汪！\n` + '```ansi\n' + `ID: ${fmt(COLORS.RED, ban.user.id)}` + '\n```')
            .setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => { });
    });

    // 解封
    client.on('guildBanRemove', async (ban) => {
        const settings = getGuildSettings(ban.guild.id);
        if (!settings?.log_channel) return;
        const channel = ban.guild.channels.cache.get(settings.log_channel);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🐕🔓 獲得赦免！ (Unban)')
            .setThumbnail(ban.user.displayAvatarURL())
            .setDescription(`**${ban.user.displayName || ban.user.username}** 獲得本王赦免，解除了封鎖！汪！\nID: ${ban.user.id}`)
            .setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => { });
    });
}

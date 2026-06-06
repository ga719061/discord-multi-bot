import { EmbedBuilder, AuditLogEvent } from 'discord.js';
import { sendLog, getAuditLogExecutor } from '../../utils/logUtils.js';
import { fmt, COLORS, UI_COLORS } from '../../utils/style.js';
import { inviteCache } from '../../utils/inviteCache.js';
import { logger } from '../../utils/logger.js';

export function register(client) {
    // 成員加入 (System Log)
    client.on('guildMemberAdd', async (member) => {
        // 追蹤邀請者
        let inviteInfo = '未知領域';
        try {
            const cachedInvites = inviteCache.get(member.guild.id);
            const currentInvites = await member.guild.invites.fetch();
            
            const usedInvite = currentInvites.find(inv => {
                const prevUses = cachedInvites?.get(inv.code) || 0;
                return inv.uses > prevUses;
            });

            if (usedInvite) {
                inviteInfo = `${usedInvite.inviter?.tag || '未知'} (連結: \`${usedInvite.code}\`)`;
                // 更新快取
                cachedInvites.set(usedInvite.code, usedInvite.uses);
            }
        } catch (e) {
            logger.warn(`[InviteLog] 抓取失敗 guild=${member.guild.id}: ${e.message}`);
        }

        const embed = new EmbedBuilder()
            .setColor(UI_COLORS.SUCCESS)
            .setTitle('🐕👋 新子民加入領地！')
            .setThumbnail(member.user.displayAvatarURL())
            .setDescription(`**${member.displayName}** 加入了本王的領地！汪！`)
            .addFields(
                { name: '👤 帳號', value: `<@${member.id}> (\`${member.id}\`)`, inline: true },
                { name: '📅 創建於', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '🔗 推薦人', value: inviteInfo }
            )
            .setTimestamp()
            .setFooter({ text: '🐕 國王正在觀察這位新子民...' });
        
        sendLog(member.guild, embed, 'member');
    });

    // 成員離開 (System Log)
    client.on('guildMemberRemove', (member) => {
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
            .setColor(UI_COLORS.DANGER)
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
        
        sendLog(member.guild, embed, 'member');
    });

    // 使用 Map 暫存最近處理過的狀態，避免重複發送
    const memberUpdateCache = new Map();
    const nicknameUpdateCache = new Map();

    // 成員更新 (暱稱/身分組/禁言)
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        // 如果 oldMember 是 Partial (未快取)，則不進行細部比較
        if (oldMember.partial) return;

        // 暱稱變更
        const oldNick = oldMember.nickname ?? null;
        const newNick = newMember.nickname ?? null;

        if (oldNick !== newNick) {
            const nickCacheKey = `${newMember.id}_nick_${newNick}`;
            if (nicknameUpdateCache.get(nickCacheKey)) return;
            nicknameUpdateCache.set(nickCacheKey, Date.now());
            setTimeout(() => nicknameUpdateCache.delete(nickCacheKey), 5000);

            const embed = new EmbedBuilder()
                .setColor(UI_COLORS.INFO)
                .setTitle('🐕📛 子民改名了！')
                .setDescription(`**${newMember.displayName}** 換了新名字！汪！`)
                .addFields(
                    { name: '原本的名字', value: '```ansi\n' + fmt(COLORS.GRAY, oldNick || '（原本沒綽號）') + '\n```', inline: true },
                    { name: '現在的名字', value: '```ansi\n' + fmt(COLORS.BLUE, newNick || '（移除綽號）') + '\n```', inline: true }
                )
                .setTimestamp();
            sendLog(newMember.guild, embed, 'member');
        }

        // 身分組變更
        const oldRoleIds = [...oldMember.roles.cache.keys()].sort().join(',');
        const newRoleIds = [...newMember.roles.cache.keys()].sort().join(',');

        if (oldRoleIds !== newRoleIds) {
            const cacheKey = `${newMember.id}_roles_${newRoleIds}`;
            if (memberUpdateCache.get(cacheKey)) return;
            memberUpdateCache.set(cacheKey, Date.now());
            setTimeout(() => memberUpdateCache.delete(cacheKey), 5000);

            const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id)).map(r => r.name).join(', ');
            const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id)).map(r => r.name).join(', ');

            if (!added && !removed) return;

            const embed = new EmbedBuilder()
                .setColor(UI_COLORS.INFO)
                .setTitle('🐕🏷️ 身分組變動！')
                .setDescription(`**${newMember.displayName}** 的身分有所改變！汪！`)
                .setTimestamp();

            if (added) embed.addFields({ name: '⬇️ 獲得身分', value: '```ansi\n' + fmt(COLORS.GREEN, added) + '\n```' });
            if (removed) embed.addFields({ name: '⬆️ 失去身分', value: '```ansi\n' + fmt(COLORS.RED, removed) + '\n```' });

            sendLog(newMember.guild, embed, 'member');
        }

        // 禁言 (Timeout)
        if (!oldMember.isCommunicationDisabled() && newMember.isCommunicationDisabled()) {
            const executor = await getAuditLogExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
            const embed = new EmbedBuilder()
                .setColor(UI_COLORS.DANGER)
                .setTitle('🐕🔇 壞狗狗！被禁言了！')
                .setDescription(`**${newMember.displayName}** 被關進反省室了！汪！`)
                .addFields(
                    { name: '👤 執行者', value: executor ? `${executor.tag}` : '未知', inline: true },
                    { name: '⏰ 解除時間', value: `<t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:F>`, inline: true }
                )
                .setTimestamp();
            sendLog(newMember.guild, embed, 'member');
        }
        // 解除禁言
        if (oldMember.isCommunicationDisabled() && !newMember.isCommunicationDisabled()) {
            const embed = new EmbedBuilder()
                .setColor(UI_COLORS.SUCCESS)
                .setTitle('🐕🔊 解除禁言！')
                .setDescription(`**${newMember.displayName}** 反省結束，可以說話了！汪！`)
                .setTimestamp();
            sendLog(newMember.guild, embed, 'member');
        }
    });

    // 封鎖
    client.on('guildBanAdd', async (ban) => {
        const executor = await getAuditLogExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
        const embed = new EmbedBuilder()
            .setColor(UI_COLORS.DANGER)
            .setTitle('🐕🔨 驅逐出境！ (Ban)')
            .setThumbnail(ban.user.displayAvatarURL())
            .setDescription(`**${ban.user.displayName || ban.user.username}** 嚴重違反國法，已被本王驅逐！汪！`)
            .addFields(
                { name: '👤 執行者', value: executor ? `${executor.tag}` : '未知', inline: true },
                { name: '🆔 用戶 ID', value: ban.user.id, inline: true }
            )
            .setTimestamp();
        sendLog(ban.guild, embed, 'member');
    });

    // 解封
    client.on('guildBanRemove', async (ban) => {
        const executor = await getAuditLogExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
        const embed = new EmbedBuilder()
            .setColor(UI_COLORS.SUCCESS)
            .setTitle('🐕🔓 獲得赦免！ (Unban)')
            .setThumbnail(ban.user.displayAvatarURL())
            .setDescription(`**${ban.user.displayName || ban.user.username}** 獲得本王赦免，解除了封鎖！汪！`)
            .addFields(
                { name: '👤 執行者', value: executor ? `${executor.tag}` : '未知', inline: true },
                { name: '🆔 用戶 ID', value: ban.user.id, inline: true }
            )
            .setTimestamp();
        sendLog(ban.guild, embed, 'member');
    });
}

import { getReactionRoleByMessage, isReactionRoleMessage } from '../utils/database.js';
import { logger } from '../utils/logger.js';

export function register(client) {
    // 加反應 → 給身分組
    client.on('messageReactionAdd', async (reaction, user) => {
        try {
            if (user.bot) return;

            // 處理 partial reaction
            if (reaction.partial) {
                try {
                    await reaction.fetch();
                } catch (error) {
                    logger.error('[反應身分組] 無法 fetch reaction:', error);
                    return;
                }
            }

            if (reaction.message.partial) {
                try {
                    await reaction.message.fetch();
                } catch (error) {
                    logger.error('[反應身分組] 無法 fetch message:', error);
                    return;
                }
            }

            const messageId = reaction.message.id;
            if (!isReactionRoleMessage(messageId)) return;

            // 使用 toString() 確保格式一致 (<:name:id> 或 Unicode)
            const emoji = reaction.emoji.toString();

            const rr = getReactionRoleByMessage(messageId, emoji);
            if (!rr) {
                // 有時候 Unicode emoji 會有變體差異，這裡做個簡單的 fallback 檢查
                // 但通常 toString() 應該要能對應
                logger.debug(`[反應身分組] 找不到對應設定: Msg=${messageId}, Emoji=${emoji}`);
                return;
            }

            const guild = reaction.message.guild;
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) return;

            const role = guild.roles.cache.get(rr.role_id);
            if (!role) {
                logger.warn(`[反應身分組] 身分組已不存在: ${rr.role_id}`);
                return;
            }

            // 檢查 Bot 權限
            const botMember = guild.members.me;
            if (!botMember.permissions.has('ManageRoles')) {
                logger.error(`[反應身分組] 缺少 ManageRoles 權限，無法給予身分組`);
                return; // 避免崩潰，靜默失敗 (或可考慮 DM 通知管理員)
            }

            if (botMember.roles.highest.position <= role.position) {
                logger.error(`[反應身分組] 階級過低，無法給予身分組 ${role.name} (Bot身分組必須比目標身分組高)`);
                return;
            }

            await member.roles.add(role);
            logger.info(`[反應身分組] ${user.tag} 獲得 ${role.name} (${guild.name})`);
        } catch (error) {
            logger.error('[反應身分組] 加反應嚴重錯誤:', error);
        }
    });

    // 移除反應 → 移除身分組
    client.on('messageReactionRemove', async (reaction, user) => {
        try {
            if (user.bot) return;

            if (reaction.partial) await reaction.fetch().catch(() => { });
            if (reaction.message.partial) await reaction.message.fetch().catch(() => { });

            const messageId = reaction.message.id;
            if (!isReactionRoleMessage(messageId)) return;

            const emoji = reaction.emoji.toString();

            const rr = getReactionRoleByMessage(messageId, emoji);
            if (!rr) return;

            const guild = reaction.message.guild;
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) return;

            const role = guild.roles.cache.get(rr.role_id);
            if (!role) return;

            // 權限檢查
            const botMember = guild.members.me;
            if (botMember.roles.highest.position <= role.position) return; // 靜默失敗

            await member.roles.remove(role);
            logger.info(`[反應身分組] ${user.tag} 移除 ${role.name} (${guild.name})`);
        } catch (error) {
            logger.error('[反應身分組] 移除反應錯誤:', error);
        }
    });

    logger.info('🏷️ 反應身分組事件已註冊');
}

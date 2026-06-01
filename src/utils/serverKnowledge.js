import { getGuildSettings } from './database.js';
import { RESPONSE_GUIDE } from '../knowledge/persona.js';
import { LORE } from '../knowledge/lore.js';
import { ADMIN_FEATURES, MODEL_NOTES, PUBLIC_FEATURES } from '../knowledge/features.js';
import { getKnowledgeCommands } from '../knowledge/commands.js';
import { ADMIN_PERMISSION_GUIDE, PUBLIC_PERMISSION_GUIDE, SAFETY_BOUNDARIES } from '../knowledge/permissions.js';

/**
 * 伺服器功能與指令知識庫
 * 用於注入 AI 提示詞，使其了解伺服器運作方式與王國律法
 */

export function getServerKnowledge(guildId, isAdmin = false) {
    const settings = getGuildSettings(guildId);

    const sections = [
        '【吉吉王國 AI 知識庫】',
        formatListSection('回答原則', RESPONSE_GUIDE),
        formatFeatureSection('公開功能', PUBLIC_FEATURES),
        formatCommandSection('可用指令', getKnowledgeCommands(false)),
        formatListSection('角色設定', LORE),
        formatListSection('一般權限與安全', [...PUBLIC_PERMISSION_GUIDE, ...SAFETY_BOUNDARIES]),
    ];

    if (isAdmin) {
        sections.push(
            formatFeatureSection('管理員功能', ADMIN_FEATURES),
            formatCommandSection('管理員指令', getKnowledgeCommands(true).filter((command) => command.visibility === 'admin')),
            formatListSection('AI 模型備註', MODEL_NOTES),
            formatListSection('管理員權限與安全', ADMIN_PERMISSION_GUIDE),
            formatAdminStatus(settings)
        );
    }

    return sections.filter(Boolean).join('\n\n').trim();
}

function formatFeatureSection(title, features) {
    return [
        `[${title}]`,
        ...features.flatMap((feature) => [
            `- ${feature.title}:`,
            ...feature.details.map((detail) => `  - ${detail}`),
        ]),
    ].join('\n');
}

function formatCommandSection(title, commands) {
    if (commands.length === 0) return null;
    return [
        `[${title}]`,
        ...commands.map((command) => `- /${command.name}: ${command.summary}`),
    ].join('\n');
}

function formatListSection(title, items) {
    return [
        `[${title}]`,
        ...items.map((item) => `- ${item}`),
    ].join('\n');
}

function formatAdminStatus(settings) {
    return [
        '[管理員附註]',
        `- 歡迎系統狀態: ${settings.welcome_channel ? '已啟用' : '未配置'}`,
        `- 日誌頻道: ${settings.log_channel ? '已就緒' : '未安置史官'}`,
        `- 等級公告: ${settings.level_up_announcement_enabled !== 0 ? '開啟' : '關閉'}`,
        `- Steam 特價推播: ${settings.steam_deal_enabled ? '開啟' : '關閉'}`,
        `- Steam 限時免費推播: ${settings.steam_free_enabled ? '開啟' : '關閉'}`,
    ].join('\n');
}

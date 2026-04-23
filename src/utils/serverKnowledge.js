import { getGuildSettings } from './database.js';

/**
 * 伺服器功能與指令知識庫
 * 用於注入 AI 提示詞，使其了解伺服器運作方式
 */

export function getServerKnowledge(guildId, isAdmin = false) {
    const settings = getGuildSettings(guildId);
    let selfroleList = '暫未設定';
    try {
        const roles = JSON.parse(settings.selfrole_roles || '[]');
        if (roles.length > 0) {
            selfroleList = roles.map(r => typeof r === 'string' ? r : r.id).join(', ');
        }
    } catch (e) {}

    // --- 1. 王國基礎設施 ---
    let knowledge = `
【吉吉王國 皇家大典 - 核心系統指南】

I. 社交與日常 (互動指令)
- 撫摸/擁抱: 關鍵字「摸摸國王」、「抱抱國王」。國王具有隨機情緒反應 (/hug, /pat)。
- 運勢/占卜: /fortune。獲取今日吉凶與國王的建議。
- 餵食國王: /feed。
- 聊天: 直接 @吉吉王國 或提及其名。

II. AI 核心與設定 (/ai-setup, /ai-login)
- 模型切換: 支援 Gemini 2.5 Flash, Flash-Lite, 3.0/3.1 Preview。
- 聯網檢索: 可開啟 Google 搜索能力，獲取即時資訊。
- 對話記憶: 控制 AI 是否記得先前的對話脈絡。
- 派對模式: 管理員可指定頻道開啟限時免點名模式。
- 白名單: 僅有受寵子民或在派對頻道中能與 AI 自由對話。

III. 等級與爵位系統 (非 RPG XP 機制)
- 聊天 XP: 每分鐘活躍發言可獲 15-25 XP（皇家贊助者 1.5 倍）。
- 語音掛機 XP: 每分鐘在語音頻道可獲 XP（禁止 AFK 頻道或靜音）。
- 爵位: 從「平民」到「大公」、「親王」，每 25 級左右晉升。指令: /rank, /leaderboard。

IV. 王國事務與社群
- 國是會議 (投票): /poll (最多 5 個選項)。
- 皇家大抽獎: /giveaway (點擊 🎉 參加)。
- 皇家採購 (Steam): /steam search (搜尋遊戲價格/評價), /steam sales (查看特價)。
- 皇家時鐘: /remind set (設定提醒)。

V. 管理與自動化 (管理員專用)
- 皇家聖旨 (@everyone): /announce。
- 自助身分組: /selfrole (下拉選單領取)。
- 歡迎與日誌: /setup-welcome, /setup-log。
`;

    if (isAdmin) {
        knowledge += `\n\n[管理員附註]: 歡迎系統狀態: ${settings.welcome_channel ? '已啟用' : '未配置'}。`;
    }

    return knowledge.trim();
}

import { MONSTERS, AREAS, RACES, CLASSES, ITEM_NAMES, EQUIPMENT, STAT_LABELS, AFFIX_REGISTRY } from '../rpg/data/gameData.js';
import { getRankTitle, getXpForLevel, getGuildSettings } from './database.js';
import { ENHANCEMENT_CONFIG } from '../rpg/rpgHelpers.js';

/**
 * 伺服器功能與指令知識庫
 * 用於注入 AI 提示詞，使其了解伺服器運作方式與深層數據
 */

export function getServerKnowledge(guildId, isAdmin = false) {
    // 獲取伺服器特定設定
    const settings = getGuildSettings(guildId);
    let selfroleList = '暫未設定';
    try {
        const roles = JSON.parse(settings.selfrole_roles || '[]');
        if (roles.length > 0) {
            selfroleList = roles.map(r => typeof r === 'string' ? r : r.id).join(', ');
        }
    } catch (e) {}

    // 1. 基本功能介紹與分類
    let baseInfo = `
[吉吉王國 伺服器功能手冊]

1. 社交互動 (不需要斜線指令)
   - 撫摸: 「摸摸國王」、「摸摸吉吉」。國王心情隨機，可能大喜也可能傲嬌。
   - 擁抱: 「抱抱國王」、「抱抱本王」。國王最喜歡溫鳴的懷抱。
   - 運勢: 「占卜」、「運勢」。國王會預測你的今日吉凶。
   - 金句: 「每日一汪」、「每日金句」。國王每天賜予智慧語錄。
   - 聊天: 直接 @吉吉王國 或在文中提到「國王」。

2. 等級與皇家頭銜 (聊天獲得 XP)
   - 經驗機制: 每分鐘聊天可獲得 15-25 XP (伺服器加成者 1.5 倍)。
   - 頭銜進度:`;
    
    // 動態列出頭銜階級
    const rankCheckpoints = [0, 6, 16, 31, 51, 76, 100];
    for (const lv of rankCheckpoints) {
        baseInfo += `\n     - Lv.${lv}+: ${getRankTitle(lv)}`;
    }
    baseInfo += `\n   - 指令: /rank (個人), /leaderboard (排行)。

3. 伺服器實用功能
   - 投票系統: /poll (支援最多 5 個選項，具備實時進度條)。
   - Steam 助手: /steam <遊戲名>。可查詢全球價格、評價、歷史低價。
   - 自助身分組: /selfrole (選單式), /reactionrole (按鈕/表情式)。
     * 當前可用身分組 ID: ${selfroleList}

4. 定時提醒系統
   - 指令: /remind set, /remind list, /remind delete
   - 時間格式: 支援相對時間 (如 10m、1h) 與絕對時間 (如 16:00)。
   - 功能: 國王會準時在設定的頻道標記並提醒你。
`;

    // 只有管理員才看的到管理資訊
    if (isAdmin) {
        baseInfo += `
4. 管理員專屬功能
   - 皇家公告: /announce。可建立帶有國王御印的華麗聖旨。
   - 抽獎系統: /giveaway。
   - 歡迎與日誌設定: /setup-welcome, /setup-log。
   - 系統狀態: ${settings.welcome_channel ? '歡迎系統已啟用' : '歡迎系統未設定'}。
`;
    }

    // 5. RPG 深層數據: 種族與職業
    let rpgStats = `\n[RPG 數據庫 - 種族與職業]\n`;
    for (const [id, r] of Object.entries(RACES)) {
        rpgStats += `- ${r.name} (${r.emoji}): ${Object.entries(r.bonus).map(([k, v]) => `${STAT_LABELS[k] || k}${v >= 0 ? '+' : ''}${v}`).join(', ')}\n`;
    }
    for (const [id, c] of Object.entries(CLASSES)) {
        rpgStats += `- ${c.name} (${c.emoji}): 每級成長 ${Object.entries(c.growth).map(([k, v]) => `${STAT_LABELS[k] || k}+${v}`).join(', ')}\n`;
    }

    // 6. RPG 深層數據: 裝備隨機詞條 (Affixes)
    let rpgAffixes = `\n[RPG 數據庫 - 隨機詞條 (前綴與後綴)]\n`;
    const prefixes = Object.values(AFFIX_REGISTRY).filter(a => a.type === 'prefix');
    const suffixes = Object.values(AFFIX_REGISTRY).filter(a => a.type === 'suffix');
    
    rpgAffixes += `前綴 (Prefix):\n`;
    for (const a of prefixes) {
        const stats = Object.entries(a.stats).map(([k, v]) => `${STAT_LABELS[k] || k}${v >= 0 ? '+' : ''}${v}`).join(', ');
        rpgAffixes += `  - ${a.name}: ${stats} (Lv.${a.minLevel}+, 適用: ${a.applyTo.join('/')})\n`;
    }
    rpgAffixes += `後綴 (Suffix):\n`;
    for (const a of suffixes) {
        const stats = Object.entries(a.stats).map(([k, v]) => `${STAT_LABELS[k] || k}${v >= 0 ? '+' : ''}${v}`).join(', ');
        rpgAffixes += `  - ${a.name}: ${stats} (Lv.${a.minLevel}+, 適用: ${a.applyTo.join('/')})\n`;
    }

    // 7. RPG 深層數據: 強化系統 (Enhancement)
    let rpgEnhance = `\n[RPG 數據庫 - 裝備強化系統]\n`;
    for (const [type, config] of Object.entries(ENHANCEMENT_CONFIG)) {
        const typeLabel = type === 'weapon' ? '武器' : type === 'armor' ? '防具(頭部/身體/手部/腿部/足部/盾牌)' : '飾品';
        rpgEnhance += `🛡️ ${typeLabel}:\n`;
        rpgEnhance += `  - 安全等級: +${config.safeZone} (此等級前強化 100% 成功)\n`;
        rpgEnhance += `  - 強化加成: 每級提升基礎屬性的 ${config.bonus * 100}%\n`;
        
        const failRates = Object.entries(config.failRates).map(([lv, rate]) => `+${lv}(${rate}%)`).join(', ');
        const breakRates = Object.entries(config.breakRates).map(([lv, rate]) => `+${lv}(${rate}%)`).join(', ');
        
        rpgEnhance += `  - 失敗機率: ${failRates}\n`;
        rpgEnhance += `  - 失敗消失機率: ${breakRates}\n`;
    }

    // 8. RPG 深層數據: 區域與怪物掉落表
    let rpgDrops = `\n[RPG 數據庫 - 區域與怪物掉落率]\n`;
    for (const area of AREAS) {
        rpgDrops += `📍 ${area.name} (Lv.${area.levelReq}+):\n`;
        const monsters = MONSTERS[area.id] || [];
        for (const m of monsters) {
            const dropList = m.drops.map(d => {
                const nameInfo = ITEM_NAMES[d.id] || EQUIPMENT[d.id];
                const name = nameInfo ? nameInfo.name : d.id;
                return `${name}(${d.chance}%)`;
            }).join(', ');
            rpgDrops += `  - ${m.emoji}${m.name}: ${dropList}\n`;
        }
    }

    return (baseInfo + rpgStats + rpgAffixes + rpgEnhance + rpgDrops).trim();
}

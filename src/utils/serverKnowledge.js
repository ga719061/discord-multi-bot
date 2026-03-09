import { MONSTERS, AREAS, RACES, CLASSES, ITEM_NAMES, EQUIPMENT, STAT_LABELS, AFFIX_REGISTRY, BOSSES, SKILLS } from '../rpg/data/gameData.js';
import { LORE_RUMORS } from '../rpg/data/loreData.js';
import { getRankTitle, getGuildSettings } from './database.js';
import { ENHANCEMENT_CONFIG } from '../rpg/rpgHelpers.js';

/**
 * 伺服器功能與指令知識庫
 * 用於注入 AI 提示詞，使其了解伺服器運作方式與深層 RPG 數據
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
- 撫摸/擁抱: 關鍵字「摸摸國王」、「抱抱國王」。國王具有隨機情緒反應。
- 運勢/占卜: 獲取今日吉凶預測。
- 金句/每日一汪: 每日智慧語錄。
- 聊天: 直接 @吉吉王國 或提及其名。

II. 等級與爵位系統 (XP 機制)
- 每分鐘聊天可獲 15-25 XP。皇家贊助者 1.5 倍。
- 核心爵位:`;
    
    [0, 6, 16, 31, 51, 76, 100].forEach(lv => {
        knowledge += `\n  - Lv.${lv}+: ${getRankTitle(lv)}`;
    });

    knowledge += `
- 指令: /rank, /leaderboard。

III. 王國事務助手
- 議會投票: /poll (具備動態進度條樣式)。
- 皇家採購 (Steam): /steam search/sales。
- 自助身分組: /selfrole, /reactionrole。目前可用: ${selfroleList}
- 皇家時鐘: /remind set/list (支援相對時間如 10m 與絕對時間)。

IV. 國王特權 (管理用)
- 皇家聖旨 (@everyone): /announce。
- 王國抽獎: /giveaway。
- 史官日誌: /setup-welcome, /setup-log。

V. RPG 核心冒險系統 (核心數據)
1. 冒險區域與怪物：`;

    for (const area of AREAS) {
        knowledge += `\n- 📍 ${area.name} (Lv.${area.levelReq}+): ${area.desc}`;
        const areaBoss = BOSSES[area.id];
        if (areaBoss) {
            knowledge += ` [區域領主: ${areaBoss.emoji}${areaBoss.name}]`;
        }
    }

    knowledge += `\n\n2. 種族與屬性：`;
    for (const r of Object.values(RACES)) {
        const bonusStr = Object.entries(r.bonus).map(([k, v]) => `${STAT_LABELS[k] || k}${v >= 0 ? '+' : ''}${v}`).join(', ');
        knowledge += `\n- ${r.emoji}${r.name}: ${bonusStr}`;
    }

    knowledge += `\n\n3. 職業體系：`;
    for (const c of Object.values(CLASSES)) {
        const growthStr = Object.entries(c.growth).map(([k, v]) => `${STAT_LABELS[k] || k}+${v}`).join(',');
        knowledge += `\n- ${c.emoji}${c.name}: ${c.desc} (成長: ${growthStr})`;
    }

    knowledge += `\n\n4. 皇家旅館 (Gigi Inn)：
- 功能: 補給、休息、寄存物品、洗點重練。
- NPC: 旅館老闆老狄恩 (Dean)、退役騎士亞伯 (Abel)、流浪學者賽恩 (Sion)。
- 傳聞系統: 包含史萊姆之戒、巴風特威脅、甚至是禁忌的「三合一史詩鑑定」等。

5. 戰鬥系統細節：
- 裝備強化: 安全等級 +${ENHANCEMENT_CONFIG.weapon.safeZone}。超過後有損毀機率。
- 隨機詞條: `;
    Object.values(AFFIX_REGISTRY).slice(0, 10).forEach(a => {
        knowledge += `${a.name}(${a.type}), `;
    });
    knowledge += `等。
- 技能系統: 領主技能 (Boss drops) 與職業起始技能。

VI. 王國秘辛 (Rumors)：
- ${LORE_RUMORS.secrets.slice(0, 3).join('\n- ')}

VII. 最近修正：
- 角色面板屬性排版已優化，支援 Emoji 對齊。
- 裝備生命值/魔力值重複加總修正完畢。
- 初階道具名稱 ID 顯示 Bug 已修復。
- 主線第二章任務資料缺失導致的崩潰已修正。

VIII. 皇家百科：全怪物掉落清單 (機率參考)：\n`;

    for (const area of AREAS) {
        knowledge += `\n【${area.name}】:`;
        const monsters = MONSTERS[area.id] || [];
        for (const m of monsters) {
            const dropsStr = m.drops.map(d => {
                const item = ITEM_NAMES[d.id] || EQUIPMENT[d.id];
                return `${item ? item.name : d.id}(${d.chance}%)`;
            }).join(', ');
            knowledge += `\n  - ${m.emoji}${m.name}: ${dropsStr}`;
        }
        const boss = BOSSES[area.id];
        if (boss) {
            const bossDrops = boss.drops.map(d => {
                const item = ITEM_NAMES[d.id] || EQUIPMENT[d.id];
                return `${item ? item.name : d.id}(${d.chance}%)`;
            }).join(', ');
            knowledge += `\n  - 🌟 ${boss.name} (領主): ${bossDrops}`;
        }
    }

    if (isAdmin) {
        knowledge += `\n\n[管理員附註]: 歡迎系統狀態: ${settings.welcome_channel ? '已啟用' : '未配置'}。`;
    }

    return knowledge.trim();
}

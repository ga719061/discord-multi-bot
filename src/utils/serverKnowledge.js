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


V. RPG 核心冒險系統 (核心數據)
1. 冒險區域與怪物：`;

    for (const area of AREAS) {
        knowledge += `\n- 📍 ${area.name} (Lv.${area.levelReq}+): ${area.desc}`;
        const areaBoss = BOSSES[area.id];
        if (areaBoss) {
            knowledge += ` [區域領主: ${areaBoss.emoji}${areaBoss.name}]`;
        }
    }

    knowledge += `\n\n2. 種族與屬性：
- 力量 (STR): +0.5 ATK, +1 HP (所有職業通用，物理系加成更高)。
- 智力 (INT): +0.5 MATK, +2 MP (所有職業通用，法系加成更高)。
- 體質 (VIT): +4 HP, +0.3 DEF (所有職業通用，坦克系加成更高)。
- 敏捷 (AGI): +0.2 SPD (所有職業通用，遊俠加成更高)。
- 幸運 (LUK): +0.02% 暴擊, +0.1% 暴傷 (所有職業通用)。
- 種族初始加成：`;
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

5. 戰鬥與成長系統：
- 裝備強化: 可至「鐵匠鋪」強化至 +9。超過安定值有機率損毀。
- 裝備拆解: 分解裝備獲得「魔力碎片」與「混沌精華」。
- 屬性洗煉: 消耗素材重新抽取裝備詞條。
- 拍賣場: 使用 /rpg auction 買賣裝備、道具、技能書。
- 傭兵小隊: 最多招募 3 名隊友助戰。僱用他人可獲得分紅回饋。
- 隨機詞條範例: 
`;
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

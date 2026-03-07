import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { RACES, CLASSES, SKILLS, AREAS, QUALITY_MULTIPLIER, EQUIPMENT, SHOP_ITEMS, getXpForLevel, AFFIX_REGISTRY, SET_REGISTRY, SKILL_BOOKS } from './data/gameData.js';
import { getGuildSettings } from '../utils/database.js';
import * as StyleUtils from '../utils/style.js';
const { fmt, COLORS, ansiBar } = StyleUtils;

// ---------- HP / MP / XP 長條圖 ----------
export function makeBar(current, max, length = 10) {
    const filled = Math.round((current / max) * length);
    return '▰'.repeat(Math.max(0, filled)) + '▱'.repeat(Math.max(0, length - filled));
}

export function hpBar(current, max) {
    return '```ansi\n' + `❤️ HP ${ansiBar(current, max, COLORS.RED, 15)} ${current}/${max}` + '\n```';
}

export function mpBar(current, max) {
    return '```ansi\n' + `💙 MP ${ansiBar(current, max, COLORS.BLUE, 15)} ${current}/${max}` + '\n```';
}

export function xpBar(current, max, length = 15) {
    return '```ansi\n' + `✨ XP ${ansiBar(current, max, COLORS.GOLD || '0;33', length)} ${current}/${max}` + '\n```';
}

// ---------- ANSI 顏色文字 ----------
export function ansiText(colorId, text) {
    const esc = String.fromCharCode(27);
    return '```ansi\n' + esc + '[' + colorId + 'm' + text + esc + '[0m\n```';
}

// ---------- 戰鬥公式 ----------
export function calcDamage(atk, def, multiplier = 1, penetration = 0) {
    // 穿透處理 (確保數值為有效數字)
    const pen = Number(penetration) || 0;
    const effectiveDef = (def || 0) * (1 - (pen / 100));
    // 基礎傷害公式 (最少扣 1 滴血)
    const baseDamage = Math.max(1, (atk || 0) - (effectiveDef * 0.5));
    // 加上浮動值 0.9 ~ 1.1
    const variance = 0.9 + (Math.random() * 0.2);
    return Math.floor(baseDamage * (multiplier || 1) * variance);
}

export function isCrit(entity, bonus = 0) {
    const base = entity.crit !== undefined ? entity.crit : Math.min(50, 5 + (entity.spd || 0) / 10);
    const chance = base + bonus;
    return (Math.random() * 100) < chance;
}

export function isDodge(entity, bonus = 0) {
    const base = entity.dodge !== undefined ? entity.dodge : Math.min(50, 5 + (entity.spd || 0) / 10);
    const chance = base + bonus;
    return (Math.random() * 100) < chance;
}

// ---------- 職業晉升與職稱 ----------
export function getJobAdvancement(char) {
    const cls = CLASSES[char.class];
    if (!cls || !cls.advancements) return null;
    let current = cls.advancements[0];
    for (const adv of cls.advancements) {
        if (char.level >= adv.level) current = adv;
    }
    return current;
}

export function getJobTitle(char, useAnsi = false) {
    const adv = getJobAdvancement(char);
    const className = CLASSES[char.class]?.name || char.class;
    if (!adv) return className;
    if (!useAnsi) return adv.name;
    let colorKey = adv.color || 'WHITE';
    return fmt(COLORS[colorKey] || COLORS.WHITE, adv.name);
}

// ---------- 角色摘要文字 ----------
export function charSummary(char) {
    if (!char) return '🐕 未知勇者';
    const race = RACES[char.race] || { name: '未知', emoji: '❓' };
    const cls = CLASSES[char.class] || { name: '冒險者', emoji: '⚔️' };
    const title = getJobTitle(char, false);
    return `${race.emoji}${cls.emoji} ${race.name}${title} — Lv.${char.level || 1}`;
}

// ---------- 核心屬性計算 ----------
export function calculateTotalStats(char, equipList = []) {
    const cls = CLASSES[char.class];
    if (!cls) return { ...char };

    const level = Math.max(1, char.level || 1);
    const growthCount = level - 1;

    // 1. 基礎數值管線 (Stat Pipeline)
    const pipeline = {
        max_hp: (cls.baseStats.hp || 0) + (cls.growth.hp || 0) * growthCount,
        max_mp: (cls.baseStats.mp || 0) + (cls.growth.mp || 0) * growthCount,
        atk: (cls.baseStats.atk || 0) + (cls.growth.atk || 0) * growthCount,
        matk: (cls.baseStats.matk || 0) + (cls.growth.matk || 0) * growthCount,
        def: (cls.baseStats.def || 0) + (cls.growth.def || 0) * growthCount,
        mdef: (cls.baseStats.mdef || 0) + (cls.growth.mdef || 0) * growthCount,
        spd: (cls.baseStats.spd || 0) + (cls.growth.spd || 0) * growthCount,
        crit: 5,           // 基礎暴擊率 5%
        crit_dmg: 150,     // 基礎暴擊傷害 150%
        dodge: 5,          // 基礎閃避率 5%
        lifesteal: 0,      // 吸血 %
        penetration_pct: 0,// 穿透 %
        echo_chance: 0,    // 迴響(二連擊) %
        hp_pct: 0, mp_pct: 0, atk_pct: 0, matk_pct: 0, def_pct: 0, mdef_pct: 0, spd_pct: 0
    };

    // 2. 屬性轉換 (STR, INT, VIT, AGI, LUK)
    const conversion = cls.statConversion || {};
    for (const [attr, bonus] of Object.entries(conversion)) {
        const attrVal = char[attr] || 0;
        for (const [stat, mult] of Object.entries(bonus)) {
            const extra = Math.floor(attrVal * mult);
            const targetStat = (stat === 'hp' || stat === 'max_hp') ? 'max_hp' : (stat === 'mp' || stat === 'max_mp') ? 'max_mp' : stat;
            pipeline[targetStat] = (pipeline[targetStat] || 0) + extra;
        }
    }

    // 3. 晉升倍率修正
    let advBonus = level >= 99 ? 1.35 : (level >= 60 ? 1.2 : (level >= 30 ? 1.1 : 1.0));
    const baseStats = ['max_hp', 'max_mp', 'atk', 'matk', 'def', 'mdef', 'spd'];
    baseStats.forEach(s => pipeline[s] = Math.floor(pipeline[s] * advBonus));

    // 4. 裝備處理 (基礎、詞條、套裝)
    const equippedIds = [
        char.head_id, char.body_id, char.hands_id, char.legs_id, char.feet_id,
        char.main_hand_id, char.off_hand_id,
        char.acc1_id, char.acc2_id, char.acc3_id, char.acc4_id
    ].filter(id => id != null).map(id => Number(id));

    const equippedItems = equipList.filter(e => equippedIds.includes(e.id));
    const setCounts = {}; // 用於追蹤套裝件數

    for (const eq of equippedItems) {
        const itemDef = EQUIPMENT[eq.item_id];
        if (!itemDef) continue;

        // 追蹤套裝
        if (itemDef.set_id) {
            setCounts[itemDef.set_id] = (setCounts[itemDef.set_id] || 0) + 1;
        }

        // 取得基礎屬性 (含強化補正)
        const bonusData = typeof eq.bonus_stats === 'string' ? JSON.parse(eq.bonus_stats || '{}') : (eq.bonus_stats || {});
        const actual = getActualStats(eq.item_id, eq.quality, eq.enhancement || 0, bonusData);

        for (const [s, val] of Object.entries(actual)) {
            const target = (s === 'hp' || s === 'max_hp') ? 'max_hp' : (s === 'mp' || s === 'max_mp') ? 'max_mp' : s;
            pipeline[target] = (pipeline[target] || 0) + val;
        }
    }

    // 5. 套裝效果偵測
    const setHooksObj = {};
    for (const [setId, count] of Object.entries(setCounts)) {
        const setDef = SET_REGISTRY[setId];
        if (!setDef) continue;
        for (const [req, bonus] of Object.entries(setDef.bonuses)) {
            if (count >= Number(req)) {
                if (bonus.stats) {
                    for (const [bs, bv] of Object.entries(bonus.stats)) {
                        pipeline[bs] = (pipeline[bs] || 0) + bv;
                    }
                }
                if (bonus.hooks) {
                    for (const [evt, hookStr] of Object.entries(bonus.hooks)) {
                        if (!setHooksObj[evt]) setHooksObj[evt] = [];
                        if (!setHooksObj[evt].includes(hookStr)) setHooksObj[evt].push(hookStr);
                    }
                }
            }
        }
    }

    // 6. 百分比加成套用
    const final = { ...char };
    baseStats.forEach(s => {
        const pctKey = `${s.replace('max_', '')}_pct`;
        const pct = 1 + (pipeline[pctKey] || 0) / 100;
        final[s] = Math.floor(pipeline[s] * pct);
    });
    final.crit = Math.min(80, pipeline.crit + (final.spd / 10)); // 速度加成暴擊
    final.crit_dmg = pipeline.crit_dmg;
    final.dodge = Math.min(50, pipeline.dodge + (final.spd / 15)); // 速度加成閃避
    final.lifesteal = pipeline.lifesteal;
    final.penetration_pct = pipeline.penetration_pct;
    final.echo_chance = pipeline.echo_chance;
    final.setHooks = setHooksObj; // 套裝 Hooks 附加
    final.spd = Math.floor(pipeline.spd * (1 + (pipeline.spd_pct || 0) / 100));

    // 6.5 飾品能量共鳴 (Standalone Accessory Resonance)
    // 這是獨立於裝備套裝外的系統：只要飾品欄位填滿即有額外加成
    const accSlots = ['acc1_id', 'acc2_id', 'acc3_id', 'acc4_id'];
    const accCount = accSlots.filter(s => char[s] != null).length;
    if (accCount >= 2) {
        final.max_hp = Math.floor(final.max_hp * 1.05);
        final.max_mp = Math.floor(final.max_mp * 1.05);
    }
    if (accCount >= 4) {
        final.atk = Math.floor(final.atk * 1.08);
        final.matk = Math.floor(final.matk * 1.08);
        final.spd = Math.floor(final.spd * 1.05);
    }

    // 修正當前 HP/MP
    final.hp = Math.min(char.hp || 0, final.max_hp);
    final.mp = Math.min(char.mp || 0, final.max_mp);

    return final;
}


// ---------- 取得已學技能 ----------
// learnedIds: 從 DB 取得的已學技能 ID 陣列 (可選)
export function getUnlockedSkills(classId, level, learnedIds = []) {
    const clsDef = CLASSES[classId];
    const initialSkillId = clsDef?.initialSkill;
    const allSkills = [];

    // 彙整所有已學技能
    const skillPool = [];
    for (const group of Object.values(SKILLS)) skillPool.push(...group);

    if (learnedIds && learnedIds.length > 0) {
        for (const s of skillPool) {
            if (learnedIds.includes(s.id)) allSkills.push(s);
        }
    }

    // 確保初始技能一定存在 (相容舊角色)
    if (initialSkillId && !allSkills.some(s => s.id === initialSkillId)) {
        const s = skillPool.find(sk => sk.id === initialSkillId);
        if (s) allSkills.push(s);
    }

    // 輔助函式：取得技能對應的等級需求 (從 SKILL_BOOKS 找)
    const getLevelReq = (sid) => {
        const bookEntry = Object.entries(SKILL_BOOKS).find(([, b]) => b.skillId === sid);
        return bookEntry ? bookEntry[1].levelReq : 0;
    };

    // 由等級低到高排序
    allSkills.sort((a, b) => getLevelReq(a.id) - getLevelReq(b.id));

    return allSkills;
}

// ---------- 裝備品質標籤 ----------
export function qualityLabel(quality) {
    return QUALITY_MULTIPLIER[quality]?.label || '⬜ 普通';
}

/**
 * 取得品質對應的 ANSI 顏色代碼
 * @param {string} quality 
 */
export function getQualityColor(quality) {
    return QUALITY_MULTIPLIER[quality]?.ansi || '0;37';
}

/**
 * 取得裝備的完整名稱 (含前後綴)
 * @param {object} eq 裝備資料 (DB record)
 * @param {object} def 裝備定義 (Static data)
 */
export function getEquipFullName(eq, def) {
    if (!def) return '未知裝備';
    let name = def.name;
    const bonusData = typeof eq.bonus_stats === 'string' ? JSON.parse(eq.bonus_stats || '{}') : (eq.bonus_stats || {});

    if (bonusData.affixes && bonusData.affixes.length > 0) {
        let prefix = '';
        let suffix = '';
        for (const a of bonusData.affixes) {
            const reg = AFFIX_REGISTRY[a.id];
            if (reg) {
                if (reg.type === 'prefix') prefix += reg.name;
                else if (reg.type === 'suffix') suffix += reg.name;
            }
        }
        name = `${prefix}${name}${suffix}`;
    }
    return name;
}

/**
 * 依照品質將物品名稱染色的 ANSI 字串 (需在 ansi 代碼塊內使用)
 * @param {string} name 物品名稱
 * @param {string} quality 物品品質
 */
export function formatItemName(name, quality) {
    const esc = String.fromCharCode(27);
    const color = getQualityColor(quality);
    return `${esc}[${color}m${name}${esc}[0m`;
}

// ---------- 通用 RPG Embed ----------
export function rpgEmbed(title, description, color = 0xF1C40F) {
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(String(title || '吉吉王國訊息'))
        .setFooter({ text: '🐕👑 吉吉王國冒險者公會' });

    if (description && typeof description === 'string' && description.trim().length > 0) {
        embed.setDescription(description);
    }

    return embed;
}

// ---------- 統一安全的互動回應 ----------
export async function safeReply(interaction, options) {
    try {
        // 如果是按鈕或選單，優先使用 update (更新原訊息)
        if (interaction.isButton() || interaction.isStringSelectMenu()) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.update(options);
            } else {
                await interaction.editReply(options);
            }
            return;
        }

        // 一般 Slash Command 或已回覆的互動
        if (!interaction.replied && !interaction.deferred) {
            if (typeof options === 'object' && !Array.isArray(options)) {
                options.ephemeral = true;
            } else if (typeof options === 'string') {
                options = { content: options, ephemeral: true };
            }
            await interaction.reply(options);
        } else {
            await interaction.editReply(options);
        }
    } catch (e) {
        try {
            await interaction.editReply(options);
        } catch (err) {
            console.error('safeReply 最終失敗:', err.message);
        }
    }
}

// ---------- 按鈕工廠 ----------
export function rpgButton(customId, label, style = ButtonStyle.Secondary, emoji = null, disabled = false) {
    const btn = new ButtonBuilder()
        .setCustomId(String(customId))
        .setLabel(String(label || '按鈕'))
        .setStyle(style)
        .setDisabled(!!disabled);
    if (emoji) btn.setEmoji(emoji);
    return btn;
}

// ---------- 主選單按鈕列 ----------
export function mainMenuRows(disabled = false) {
    return [
        new ActionRowBuilder().addComponents(
            rpgButton('rpg_adventure', '冒險', ButtonStyle.Primary, '⚔️', disabled),
            rpgButton('rpg_profile', '角色', ButtonStyle.Secondary, '📋', disabled),
            rpgButton('rpg_inventory', '背包', ButtonStyle.Secondary, '📦', disabled),
            rpgButton('rpg_shop', '商店', ButtonStyle.Secondary, '🏪', disabled),
            rpgButton('rpg_quest', '任務', ButtonStyle.Secondary, '📜', disabled),
        ),
        new ActionRowBuilder().addComponents(
            rpgButton('rpg_daily', '簽到', ButtonStyle.Success, '🎁', disabled),
            rpgButton('rpg_ranking', '排行', ButtonStyle.Secondary, '🏆', disabled),
            rpgButton('rpg_lore', '王國酒館', ButtonStyle.Secondary, '🏰', disabled),
            rpgButton('rpg_auction', '拍賣', ButtonStyle.Secondary, '⚖️', disabled),
            rpgButton('rpg_merc', '傭兵', ButtonStyle.Secondary, '🛡️', disabled)
        ),
    ];
}

// ---------- 返回主選單按鈕 ----------
export function backButton(disabled = false) {
    return new ActionRowBuilder().addComponents(
        rpgButton('rpg_menu', '返回主選單', ButtonStyle.Secondary, '🔙', disabled),
    );
}

// ---------- 戰鬥行動按鈕列 ----------
export function battleActionRows(battleId, disabled = false) {
    return [
        new ActionRowBuilder().addComponents(
            rpgButton(`rpg_battle_attack_${battleId}`, '攻擊', ButtonStyle.Danger, '⚔️', disabled),
            rpgButton(`rpg_battle_skill_${battleId}`, '技能', ButtonStyle.Primary, '🔥', disabled),
            rpgButton(`rpg_battle_item_${battleId}`, '道具', ButtonStyle.Secondary, '🧪', disabled),
            rpgButton(`rpg_battle_flee_${battleId}`, '逃跑', ButtonStyle.Secondary, '🏃', disabled),
        ),
    ];
}

// ---------- 區域選擇按鈕列 ----------
export function areaSelectRows(charLevel, disabled = false) {
    const rows = [];
    let currentRow = [];

    for (const area of AREAS) {
        const canEnter = charLevel >= area.levelReq;
        const btn = rpgButton(
            `rpg_area_${area.id}`,
            `${area.name} (Lv${area.levelReq}+)`,
            canEnter ? ButtonStyle.Primary : ButtonStyle.Secondary,
            area.emoji,
            disabled || !canEnter
        );
        currentRow.push(btn);
        if (currentRow.length === 4) {
            rows.push(new ActionRowBuilder().addComponents(currentRow));
            currentRow = [];
        }
    }
    if (currentRow.length > 0) {
        rows.push(new ActionRowBuilder().addComponents(currentRow));
    }
    rows.push(backButton(disabled));
    return rows;
}

// ---------- 權限驗證 (只有訊息擁有者能操作) ----------
export function isOwner(interaction, ownerId) {
    return interaction.user.id === ownerId;
}

export function notOwnerReply(interaction) {
    return interaction.reply({ content: '🐕 汪！這不是你的冒險面板喔！請自己用 `/rpg` 開始冒險～', flags: ['Ephemeral'] });
}

// ---------- 強化系統設定 ----------
export const ENHANCEMENT_CONFIG = {
    weapon: {
        safeZone: 6,
        failRates: { 7: 30, 8: 50, 9: 70 },
        breakRates: { 7: 30, 8: 30, 9: 30 }, // 失敗後消失機率
        bonus: 0.12, // 每 +1 = 12% of base stat
    },
    armor: {
        safeZone: 4,
        failRates: { 5: 10, 6: 18, 7: 28, 8: 40, 9: 55 },
        breakRates: { 5: 40, 6: 40, 7: 40, 8: 40, 9: 40 },
        bonus: 0.10,
    },
    accessory: {
        safeZone: 0,
        failRates: { 1: 15, 2: 20, 3: 25, 4: 30, 5: 40, 6: 50, 7: 60, 8: 70, 9: 80 },
        breakRates: { 1: 50, 2: 50, 3: 50, 4: 50, 5: 50, 6: 50, 7: 50, 8: 50, 9: 50 },
        bonus: 0.08,
    },
};

// 判斷裝備類型 (for ENHANCEMENT_CONFIG)
export function getEquipCategory(itemType) {
    if (['weapon_1h', 'weapon_2h'].includes(itemType)) return 'weapon';
    if (['head', 'body', 'hands', 'legs', 'feet', 'shield'].includes(itemType)) return 'armor';
    if (itemType === 'accessory') return 'accessory';
    return null;
}

export function getScrollForCategory(category) {
    return { weapon: 'scroll_weapon', armor: 'scroll_armor', accessory: 'scroll_accessory' }[category] || null;
}

export function getActualStats(itemId, quality, enhancement = 0, bonusData = {}) {
    const def = EQUIPMENT[itemId];
    if (!def) return {};
    const qualityMult = 1 + (QUALITY_MULTIPLIER[quality]?.bonus || 0);
    const category = getEquipCategory(def.type);
    const enhMult = category ? (1 + (ENHANCEMENT_CONFIG[category]?.bonus || 0) * enhancement) : 1;
    const actual = {};

    // 基礎屬性計算
    for (const [k, v] of Object.entries(def.stats)) {
        if (k === 'hp' || k === 'mp') {
            actual[`max_${k}`] = Math.floor(v * qualityMult * enhMult);
            actual[k] = actual[`max_${k}`];
        } else {
            actual[k] = Math.floor(v * qualityMult * enhMult);
        }
    }

    // 隨機詞條處理
    if (bonusData.affixes && Array.isArray(bonusData.affixes)) {
        for (const aff of bonusData.affixes) {
            const registry = AFFIX_REGISTRY[aff.id];
            if (!registry) continue;

            // 強化聯動：每級強化額外提升詞條 5% (規劃中的 Enhancement Scaling)
            const affEnhScale = 1 + (enhancement * 0.05);

            // 強化解鎖：檢查是否達到激活門檻 (規劃中的 Enhancement Activation)
            const isActivated = !registry.activationLevel || enhancement >= registry.activationLevel;

            if (isActivated) {
                for (const [stat, val] of Object.entries(registry.stats)) {
                    // 統一屬性對齊 (如 hp -> max_hp)
                    let targetStat = stat;
                    if (stat === 'hp') targetStat = 'max_hp';
                    if (stat === 'mp') targetStat = 'max_mp';

                    const finalVal = Math.floor(val * (aff.roll || 1.0) * affEnhScale);
                    actual[targetStat] = (actual[targetStat] || 0) + finalVal;
                }
            }
        }
    }

    // 處理 hp/mp 對等 (同步到當前數值)
    if (actual.max_hp !== undefined) actual.hp = actual.max_hp;
    if (actual.max_mp !== undefined) actual.mp = actual.max_mp;

    return actual;
}

// ---------- 隨機詞條生成器 (NEW) ----------
export function generateRandomAffixes(itemId, quality, charLevel = 1) {
    const itemDef = EQUIPMENT[itemId];
    if (!itemDef) return {};

    const category = getEquipCategory(itemDef.type);
    const affPool = Object.values(AFFIX_REGISTRY).filter(a => {
        // 1. 標籤過濾：檢查詞條是否適用於該裝備類型或其所屬的大類
        // 例如：a.applyTo 包含 'armor'，而 itemDef.type 是 'body' (其 category 也是 'armor') -> 匹配成功
        const typeMatch = a.applyTo.some(tag =>
            itemDef.type === tag ||
            itemDef.type.includes(tag) ||
            (category && category === tag)
        );
        // 2. 等級過濾：初期裝備不出現進階詞條
        const levelMatch = charLevel >= (a.minLevel || 1);
        return typeMatch && levelMatch;
    });

    if (affPool.length === 0) return {};

    // 品質決定詞條數量
    const countMap = { common: 0, fine: 1, rare: 2, epic: 3, legendary: 4 };
    const count = countMap[quality] || 0;
    if (count === 0) return {};

    // 權重隨機抽取
    const affixes = [];
    const pool = [...affPool];
    for (let i = 0; i < count && pool.length > 0; i++) {
        const totalWeight = pool.reduce((sum, a) => sum + a.weight, 0);
        let rand = Math.random() * totalWeight;
        let selectedIdx = -1;
        for (let j = 0; j < pool.length; j++) {
            rand -= pool[j].weight;
            if (rand <= 0) {
                selectedIdx = j;
                break;
            }
        }

        if (selectedIdx !== -1) {
            const selected = pool.splice(selectedIdx, 1)[0];
            // 決定 Roll 值 (0.7 ~ 1.2 浮動)
            const roll = 0.7 + (Math.random() * 0.5);
            affixes.push({ id: selected.id, roll: Number(roll.toFixed(2)) });
        }
    }

    return { affixes };
}

// ---------- 王國歷代記廣播 ----------
/**
 * 發送全局 RPG 事件廣播
 * @param {object} client - Discord Client 物件 (可用 interaction.client 取得)
 * @param {string} guildId - 伺服器 ID
 * @param {object} embedData - 廣播內容 { title, description, color, thumbnail }
 */
export async function broadcastRpgEvent(client, guildId, embedData) {
    try {
        const settings = getGuildSettings(guildId);
        if (!settings.rpg_broadcast_channel) return;

        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return;

        const channel = await guild.channels.fetch(settings.rpg_broadcast_channel).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        // 支援 ANSI 格式化的描述
        const description = embedData.useAnsi !== false
            ? '```ansi\n' + embedData.description + '\n```'
            : embedData.description;

        const embed = new EmbedBuilder()
            .setColor(embedData.color || 0xFFD700)
            .setTitle(`📜 【王國歷代記】 ${embedData.title}`)
            .setDescription(description)
            .setTimestamp()
            .setFooter({ text: '🐕 吉吉王國冒險者公會' });

        if (embedData.thumbnail) {
            embed.setThumbnail(embedData.thumbnail);
        }

        await channel.send({ embeds: [embed] });
    } catch (e) {
        console.error('[RPG Broadcast Error]', e);
    }
}

// ---------- 狀態與 Buff 系統 ----------
export function applyBuffsAndStates(entity) {
    if (!entity) return;

    entity.buffs = entity.buffs || [];
    entity.debuffs = entity.debuffs || [];

    // reset to base stats
    entity.atk = Number(entity.b_atk || entity.atk) || 0;
    entity.matk = Number(entity.b_matk || entity.matk) || 0;
    entity.def = Number(entity.b_def || entity.def) || 0;
    entity.mdef = Number(entity.b_mdef || entity.mdef) || 0;
    entity.spd = Number(entity.b_spd || entity.spd) || 0;

    let pct = { atk: 0, matk: 0, def: 0, mdef: 0, spd: 0 };

    // effect from buffs
    for (const b of entity.buffs) {
        if (b.stat && typeof pct[b.stat] !== 'undefined') {
            pct[b.stat] += b.percent || 0;
        }
    }
    // effect from debuffs
    for (const d of entity.debuffs) {
        if (d.stat && typeof pct[d.stat] !== 'undefined') {
            pct[d.stat] += d.percent || 0; // Debuff percent is usually negative in definitions
        }
    }

    entity.atk = Math.max(1, Math.floor(entity.atk * (1 + (pct.atk / 100))));
    entity.matk = Math.max(1, Math.floor(entity.matk * (1 + (pct.matk / 100))));
    entity.def = Math.max(0, Math.floor(entity.def * (1 + (pct.def / 100))));
    entity.mdef = Math.max(0, Math.floor(entity.mdef * (1 + (pct.mdef / 100))));
    entity.spd = Math.max(1, Math.floor(entity.spd * (1 + (pct.spd / 100))));
}

export function processTurnEndStates(entity, isPlayer = false) {
    let log = '';
    if (!entity) return log;

    entity.buffs = entity.buffs || [];
    entity.debuffs = entity.debuffs || [];

    const remainingDebuffs = [];
    for (const d of entity.debuffs) {
        // Dot processing
        if (d.dot) {
            const maxHp = entity.max_hp || entity.hp;
            let currentHp = isPlayer ? entity.hp : entity.currentHp;

            if (currentHp > 0) {
                const dmg = Math.max(1, Math.floor(maxHp * (d.dot.percent / 100)));
                currentHp -= dmg;
                // Can't die from poison directly, keep at least 1 HP? No, poison can kill.
                if (currentHp <= 0) currentHp = 0;

                if (isPlayer) {
                    entity.hp = currentHp;
                    log += `\n☠️ <@${entity.id}> 受到持續傷害，損失了 ${dmg} HP！`;
                } else {
                    entity.currentHp = currentHp;
                    log += `\n☠️ ${entity.name} 受到持續傷害，損失了 ${dmg} HP！`;
                }
            }
        }

        d.turns--;
        if (d.turns > 0 || d.turns === -1) {
            remainingDebuffs.push(d);
        }
    }
    entity.debuffs = remainingDebuffs;

    const remainingBuffs = [];
    for (const b of entity.buffs) {
        b.turns--;
        if (b.turns > 0 || b.turns === -1) { // -1 means infinite until battle ends
            remainingBuffs.push(b);
        }
    }
    entity.buffs = remainingBuffs;

    // Handle Shield and Invulnerable decrement
    if (entity.invulnerableTurns > 0) entity.invulnerableTurns--;
    if (entity.shield > 0) {
        // 護盾每回合自然衰減 10% 或至少 20 點，避免低層區永久護盾
        const decay = Math.max(20, Math.floor(entity.shield * 0.1));
        entity.shield = Math.max(0, entity.shield - decay);
    }

    return log;
}

export function hasState(entity, stateKey) { // stateKey: 'taunt', 'stun', 'immunity'
    const buffs = entity.buffs || [];
    const debuffs = entity.debuffs || [];
    // Immunity, Taunt are usually buffs. Stun is usually a debuff, but let's check both
    if (buffs.some(b => b[stateKey])) return true;
    if (debuffs.some(d => d[stateKey])) return true;
    return false;
}

export function consumeShield(entity, amount) {
    if (entity.invulnerableTurns > 0) return 0;
    if (!entity.shield || entity.shield <= 0) return amount;
    if (entity.shield >= amount) {
        entity.shield -= amount;
        return 0; // all absorbed
    } else {
        const remainingDmg = amount - entity.shield;
        entity.shield = 0;
        return remainingDmg;
    }
}

// ---------- 套裝 Hooks 發動器 ----------
/**
 * 執行套裝掛載的觸發器 (Hooks)
 * @param {string} trigger - 觸發時機 ('onTurnStart', 'onSkill', 'onHit', 'onDamaged', 'onKill')
 * @param {object} actor - 觸發者 (通常是身上有 setHooks 的 entity)
 * @param {object} target - 受擊者或目標 (可能為 null)
 * @param {object} context - 其他戰鬥參數，如 { totalDmg, skillId, originalDamage, encounterMonsters, total } 等
 * @returns {string} - 回傳要附加在戰鬥日誌上的字串，若無則為空
 */
export function executeSetHooks(trigger, actor, target, context = {}) {
    let logAdd = '';
    if (!actor || !actor.setHooks || !actor.setHooks[trigger]) return logAdd;

    for (const hook of actor.setHooks[trigger]) {
        switch (hook) {
            // -- 回合開始 (onTurnStart) --
            case 'slime_regen_2': {
                const heal = Math.floor((actor.max_hp || actor.hp) * 0.02);
                const oldHp = actor.hp;
                actor.hp = Math.min(actor.max_hp || actor.hp, actor.hp + heal);
                if (actor.hp > oldHp) {
                    const actualHeal = actor.hp - oldHp;
                    logAdd += `\n> 💚 [史萊姆復甦] ${actor.name || '你'} 回復了 ${actualHeal} 點生命！`;
                }
                break;
            }
            case 'aegis_guard_5': {
                if (Math.random() < 0.05) {
                    // 全隊無敵：需由外層處理或直接遍歷 actor.party
                    // 這裡先標記 context 讓外層知道要給全員 Buff
                    context.all_invulnerable = 1;
                    logAdd += `\n> 🔱 [神聖守護] 眾神降下恩澤，全隊獲得 1 回合無敵！`;
                }
                break;
            }

            // -- 施放技能前 (onSkill) --
            case 'mp_reduce_50': {
                if (Math.random() < 0.5 && context.skill) {
                    context.skill.mp = 0;
                    logAdd += `\n> ✨ [遠古智慧] 觸發！本次技能不消耗魔力！`;
                }
                break;
            }
            case 'arcane_echo_20': {
                if (Math.random() < 0.20 && context.skill) {
                    context.skill.mp = 0;
                    logAdd += `\n> 🧙 [秘法回響] 魔力共鳴！本次技能不消耗魔力！`;
                }
                break;
            }

            // -- 造成傷害後 (onHit) --
            case 'goblin_thievery_5': {
                if (Math.random() < 0.05) {
                    // 只做紀錄或加錢標記（實際加錢在 autoBattle 或掉落處結算，這裡給個 Buff 或印日誌）
                    logAdd += `\n> 💰 [哥布林貪婪] 攻擊時順手牽羊了！`;
                    if (context.actorIsPlayer) {
                        context.earnedGold = (context.earnedGold || 0) + 15;
                    }
                }
                break;
            }
            case 'double_strike_20': {
                if (Math.random() < 0.20 && target && target.currentHp > 0 && !context.isDoubleStrike) {
                    logAdd += `\n> ☄️ [天空翱翔] 觸發二連擊！`;
                    context.doDoubleStrike = true; // 讓外層再跑一次攻擊邏輯
                }
                break;
            }
            case 'abyss_true_damage_3': {
                if (target && target.currentHp > 0) {
                    const trueDmg = Math.max(1, Math.floor((target.hp || target.max_hp) * 0.03));
                    target.currentHp -= trueDmg;
                    logAdd += `\n> 🌑 [深淵侵蝕] 造成了 ${trueDmg} 點額外真實傷害！`;
                }
                break;
            }
            case 'void_weaken_10': {
                if (Math.random() < 0.10 && target && target.currentHp > 0) {
                    target.debuffs = target.debuffs || [];
                    target.debuffs.push({ stat: 'def', percent: -20, turns: 2 }, { stat: 'atk', percent: -20, turns: 2 });
                    logAdd += `\n> 🌀 [虛空凋零] 目標被虛弱了！（攻防下降）`;
                }
                break;
            }
            case 'chaos_strike_5': {
                if (Math.random() < 0.05 && target && target.currentHp > 0) {
                    const extraDmg = Math.floor((actor.atk || 10) * (1.5 + Math.random()));
                    target.currentHp -= extraDmg;
                    logAdd += `\n> 💥 [混沌打擊] 混亂的能量爆發！額外造成 ${extraDmg} 傷害！`;
                }
                break;
            }
            case 'ares_fury_10': {
                if (Math.random() < 0.10) {
                    actor.buffs = actor.buffs || [];
                    actor.buffs.push({ stat: 'atk', percent: 30, turns: 2 });
                    logAdd += `\n> ⚔️ [戰神之怒] 鬥志燃燒！物理屬性大幅提升！`;
                }
                break;
            }
            case 'overlord_execute_15': {
                if (Math.random() < 0.15 && target && target.currentHp > 0) {
                    const hpPct = target.currentHp / (target.hp || target.max_hp);
                    if (hpPct < 0.3) {
                        const trueDmg = Math.floor((target.hp || target.max_hp) * 0.1);
                        target.currentHp -= trueDmg;
                        logAdd += `\n> 🩸 [霸王斬首] 對瀕死目標造成 ${trueDmg} 點致命真實傷害！`;
                    }
                }
                break;
            }
            case 'wind_combo_25': {
                if (Math.random() < 0.25 && target && target.currentHp > 0 && !context.isDoubleStrike) {
                    logAdd += `\n> 🏹 [疾風連攜] 迅速射出第二箭！`;
                    context.doDoubleStrike = true;
                }
                break;
            }
            case 'star_pierce_15': {
                if (Math.random() < 0.15 && target && target.currentHp > 0) {
                    logAdd += `\n> 🎯 [星辰貫穿] 無視目標防禦並造成流血！`;
                    context.ignoreDef = true;
                    target.debuffs = target.debuffs || [];
                    target.debuffs.push({ dot: { percent: 10, type: 'bleed' }, turns: 3 });
                }
                break;
            }
            case 'elemental_burst_10': {
                if (Math.random() < 0.10 && context.encounterMonsters) {
                    const burstDmg = Math.floor((actor.matk || 10) * 1.5);
                    let hitCount = 0;
                    context.encounterMonsters.forEach(m => {
                        if (m.currentHp > 0) {
                            m.currentHp -= burstDmg;
                            hitCount++;
                        }
                    });
                    if (hitCount > 0) logAdd += `\n> 🎆 [元素爆發] 引發法力爆炸，對全場敵人造成 ${burstDmg} 額外傷害！`;
                }
                break;
            }
            case 'phantom_strike_15': {
                if (Math.random() < 0.15 && target && target.currentHp > 0) {
                    target.debuffs = target.debuffs || [];
                    target.debuffs.push({ stat: 'def', percent: -10, turns: 2 }, { stat: 'mdef', percent: -10, turns: 2 });
                    logAdd += `\n> ✨ [幻影削弱] 虛幻之劍削弱了目標的攻防！`;
                }
                break;
            }
            case 'chaos_resonance_10': {
                if (Math.random() < 0.10 && target && target.currentHp > 0) {
                    const hpSteal = Math.floor((context.originalDamage || 100) * 0.15);
                    const mpSteal = Math.floor((context.originalDamage || 100) * 0.15 / 2);
                    actor.hp = Math.min(actor.max_hp || actor.hp, actor.hp + hpSteal);
                    actor.mp = Math.min(actor.max_mp || actor.mp, actor.mp + mpSteal);

                    const debuffs = ['burn', 'poison', 'stun'];
                    const type = debuffs[Math.floor(Math.random() * debuffs.length)];
                    target.debuffs = target.debuffs || [];
                    if (type === 'stun') target.debuffs.push({ stunned: true, turns: 1 });
                    else target.debuffs.push({ dot: { percent: 10, type }, turns: 2 });

                    logAdd += `\n> 🧿 [混沌共鳴] 吸取生命魔力並賦予異常狀態！`;
                }
                break;
            }

            // -- 受到傷害前/後 (onDamaged) --
            case 'dragon_retribution_10': {
                if (Math.random() < 0.10 && target && target.currentHp > 0) {
                    const retDmg = Math.floor((actor.atk + (actor.def || 0)) * 0.5);
                    const finalRet = consumeShield(target, retDmg);
                    target.currentHp -= finalRet;
                    logAdd += `\n> 🐉 [龍鱗逆鱗] 發動反擊！對攻擊者造成 ${finalRet} 傷害！`;
                }
                break;
            }
            case 'crystal_reflect_20': {
                // target 這裡是攻擊者
                if (Math.random() < 0.20 && target && target.currentHp > 0 && context.originalDamage) {
                    const reflect = context.originalDamage;
                    target.currentHp -= reflect;
                    logAdd += `\n> 💎 [水晶折射] 將受到的 ${reflect} 點傷害完全反彈！`;
                    context.mitigated = true; // 可由外層決定是否免傷，這裡假定不免傷，只是彈回去。若要免傷可以設防
                }
                break;
            }
            case 'mana_shield_20': {
                if (Math.random() < 0.20) {
                    const shieldAmt = Math.floor((actor.max_mp || actor.mp) * 0.5);
                    actor.shield = (actor.shield || 0) + shieldAmt;
                    logAdd += `\n> 🔮 [魔力結晶] 產生了吸收 ${shieldAmt} 點傷害的護盾！`;
                }
                break;
            }
            case 'stone_skin_5': {
                if (Math.random() < 0.05) {
                    logAdd += `\n> 🪨 [堅石皮膚] 身體瞬間硬化，傷害被完全吸收！`;
                    context.mitigatedDamage = context.originalDamage; // 外層可以把傷害減回來
                }
                break;
            }
            case 'radiant_heal_15': {
                if (Math.random() < 0.15 && context.allies) {
                    const heal = Math.floor((actor.max_hp || actor.hp) * 0.05);
                    context.allies.forEach(ally => {
                        if (ally.hp > 0) {
                            ally.hp = Math.min(ally.max_hp || ally.hp, ally.hp + heal);
                        }
                    });
                    logAdd += `\n> ⛪ [光輝迴響] 受到攻擊激發了聖光，治療全隊 ${heal} 點 HP！`;
                }
                break;
            }

            // -- 擊殺敵人後 (onKill) --
            case 'soul_reap_10': {
                if (Math.random() < 0.10) {
                    const hpRec = Math.floor((actor.max_hp || actor.hp) * 0.1);
                    const mpRec = Math.floor((actor.max_mp || actor.mp) * 0.1);
                    actor.hp = Math.min(actor.max_hp || actor.hp, actor.hp + hpRec);
                    actor.mp = Math.min(actor.max_mp || actor.mp, actor.mp + mpRec);
                    logAdd += `\n> 💀 [白骨收割] 抽取死者靈魂，回復 ${hpRec} HP 與 ${mpRec} MP！`;
                }
                break;
            }
        }
    }
    return logAdd;
}

// ---------- 統一狀態欄位組件 (橫向優化) ----------
/**
 * 產生用於 Embed 的橫向狀態欄位組
 * @param {object} char - 角色資料
 * @param {object} total - 含加成後的總體數值
 * @param {object} options - 顯示選項
 */
export function getStatusFields(char, total, options = { showResources: true, showCombat: true, xpNeeded: 0 }) {
    const fields = [];
    const race = RACES[char.race]?.name || '未知';
    const cls = CLASSES[char.class]?.name || '冒險者';
    const title = getJobTitle(char, false);

    // 1. 基礎身份 (Inline) - 整合縮小 XP 條
    let identityValue = [
        `**稱號:** \`${title}\``,
        `**等級:** Lv.${char.level} | **種族:** ${race}`,
        `**職業:** ${cls}`
    ];

    if (options.xpNeeded > 0) {
        identityValue.push(`\`\`\`ansi\n${ansiBar(char.xp, options.xpNeeded, COLORS.GOLD || '0;33', 10)} ${char.xp}/${options.xpNeeded}\n\`\`\``);
    }

    fields.push({
        name: '👤 冒險者身份',
        value: identityValue.join('\n'),
        inline: true
    });

    // 2. 資源狀態 (Inline)
    if (options.showResources) {
        fields.push({
            name: '🎒 資源庫存',
            value: [
                `💰 **${(char.gold || 0).toLocaleString()}** 金幣`,
                `💎 **${(char.gems || 0).toLocaleString()}** 寶石`,
                `🎯 **${char.free_points || 0}** 屬性點`
            ].join('\n'),
            inline: true
        });
    }

    // 3. 戰鬥核心
    if (options.showCombat) {
        fields.push({
            name: '⚔️ 核心戰力',
            value: [
                `**攻擊:** ${total.atk} | **魔攻:** ${total.matk}`,
                `**防禦:** ${total.def} | **魔防:** ${total.mdef}`,
                `**暴擊:** ${total.crit}% | **暴傷:** ${total.crit_dmg}%`
            ].join('\n'),
            inline: true
        });
    }

    return fields;
}

// ===== 吉吉王國 RPG — 遊戲主資料中心 =====

// ---------- 技能與道具 (外部模組) ----------
import { SKILLS as _SKILLS, SKILL_BOOKS as _SKILL_BOOKS, SKILL_BOOK_DROP_POOLS as _POOLS, getSkillDef as _getSkillDef } from './skills.js';
import { EQUIPMENT as _EQUIPMENT, SHOP_ITEMS as _SHOP, ITEM_NAMES as _NAMES, getItemDisplayName as _getName, QUALITY_MULTIPLIER as _QM, EQUIP_SELL_PRICES as _ESP } from './items.js';
import { BOSSES as _BOSSES } from './bosses.js';

export const SKILLS = _SKILLS;
export const SKILL_BOOKS = _SKILL_BOOKS;
export const SKILL_BOOK_DROP_POOLS = _POOLS;
export const getSkillDef = _getSkillDef;
export const EQUIPMENT = _EQUIPMENT;
export const SHOP_ITEMS = _SHOP;
export const ITEM_NAMES = _NAMES;
export const getItemDisplayName = _getName;
export const QUALITY_MULTIPLIER = _QM;
export const EQUIP_SELL_PRICES = _ESP;
export const BOSSES = _BOSSES;

export const STAT_LABELS = {
    hp: '生命', mp: '魔力', atk: '攻擊', matk: '魔攻', def: '防禦', mdef: '魔防', spd: '速度',
    crit: '暴擊', crit_dmg: '暴傷', lifesteal: '吸血', penetration_pct: '穿透',
    dodge: '閃避', echo_chance: '迴響',
    atk_pct: '攻擊%', matk_pct: '魔攻%', def_pct: '防禦%', mdef_pct: '魔防%',
    spd_pct: '速度%', hp_pct: '生命%', mp_pct: '魔力%'
};

// ---------- 屬性轉換定義 (Stat Conversion) ----------
// 全域基礎收益 (所有職業通用)
export const GLOBAL_STAT_CONVERSION = {
    str: { atk: 0.5, hp: 1 },
    int: { matk: 0.5, mp: 2 },
    vit: { hp: 4, def: 0.3 },
    agi: { spd: 0.2 },
    luk: { crit: 0.02, crit_dmg: 0.1 }
};

// ---------- 職業 (Classes) ----------
export const CLASSES = {
    warrior: {
        id: 'warrior', name: '劍士', emoji: '⚔️', desc: '貫徹力量與信念的武藝大師，擅長近身交鋒，是戰場上的核心。',
        baseStats: { hp: 150, mp: 30, atk: 25, matk: 10, def: 20, mdef: 15, spd: 15 },
        growth: { hp: 25, mp: 5, atk: 5, matk: 2, def: 4, mdef: 3, spd: 3 },
        statConversion: { str: { atk: 1.0, hp: 1 }, vit: { hp: 4, def: 0.9 } },
        advancements: [
            { level: 30, name: '精英騎士', color: 'WHITE' },
            { level: 60, name: '死亡騎士', color: 'GOLD' },
            { level: 99, name: '不朽至尊', color: 'RED' }
        ],
        weapon: 'rusty_sword', initialSkill: 'power_slash'
    },
    ranger: {
        id: 'ranger', name: '遊俠', emoji: '🏹', desc: '穿梭於綠蔭與陰影間的精準狙擊者，以靈動的身法戲弄敵人。',
        baseStats: { hp: 120, mp: 40, atk: 28, matk: 10, def: 12, mdef: 12, spd: 25 },
        growth: { hp: 18, mp: 6, atk: 6, matk: 2, def: 2, mdef: 2, spd: 5 },
        statConversion: { agi: { spd: 1.0, atk: 1.0, crit: 0.1 }, luk: { crit: 0.18, crit_dmg: 0.4 } },
        advancements: [
            { level: 30, name: '巡林客', color: 'WHITE' },
            { level: 60, name: '幽暗執行者', color: 'GOLD' },
            { level: 99, name: '追風主宰', color: 'CYAN' }
        ],
        weapon: 'short_bow', initialSkill: 'precise_shot'
    },
    mage: {
        id: 'mage', name: '法師', emoji: '🔮', desc: '與四大元素簽署古老契約的智者，揮手間足以毀天滅地。',
        baseStats: { hp: 100, mp: 100, atk: 10, matk: 30, def: 10, mdef: 25, spd: 12 },
        growth: { hp: 15, mp: 15, atk: 1, matk: 8, def: 2, mdef: 5, spd: 2 },
        statConversion: { int: { matk: 1.3, mp: 8 }, luk: { crit: 0.08, echo_chance: 0.1 } },
        advancements: [
            { level: 30, name: '元素術士', color: 'WHITE' },
            { level: 60, name: '大魔導師', color: 'GOLD' },
            { level: 99, name: '奧術主宰', color: 'PURPLE' }
        ],
        weapon: 'apprentice_staff', initialSkill: 'fireball'
    },
    paladin: {
        id: 'paladin', name: '聖騎士', emoji: '🛡️', desc: '神的代理者，誓言守護弱小並降下神聖的審判。',
        baseStats: { hp: 180, mp: 50, atk: 18, matk: 18, def: 25, mdef: 20, spd: 10 },
        growth: { hp: 35, mp: 8, atk: 3, matk: 3, def: 6, mdef: 5, spd: 1 },
        statConversion: { vit: { hp: 8, def: 1.2 }, int: { mdef: 1.0, matk: 0.3 } },
        advancements: [
            { level: 30, name: '守誓者', color: 'WHITE' },
            { level: 60, name: '聖教軍', color: 'GOLD' },
            { level: 99, name: '大天使長', color: 'GOLD' }
        ],
        weapon: 'wooden_hammer', initialSkill: 'holy_strike'
    },
    magic_swordsman: {
        id: 'magic_swordsman', name: '魔劍士', emoji: '✨', desc: '劍與魔法的完美交織，在刀光劍影中釋放混亂的奧術能量。',
        baseStats: { hp: 130, mp: 60, atk: 22, matk: 22, def: 15, mdef: 15, spd: 18 },
        growth: { hp: 20, mp: 10, atk: 4.5, matk: 4.5, def: 3, mdef: 3, spd: 4 },
        statConversion: { str: { atk: 0.5, spd: 0.2 }, int: { matk: 0.5, mp: 3 }, agi: { spd: 0.3, atk: 0.5 } },
        advancements: [
            { level: 30, name: '符文戰士', color: 'WHITE' },
            { level: 60, name: '法術熔爐', color: 'GOLD' },
            { level: 99, name: '永恆魔導', color: 'BLUE' }
        ],
        weapon: 'apprentice_sword', initialSkill: 'magic_blade'
    }
};

// ---------- 種族 (Races) ----------
export const RACES = {
    chihuahua: { id: 'chihuahua', name: '吉娃娃族', emoji: '🐕', desc: '吉吉三世王所在的皇室族裔，擁有不可思議的神聖加護與生命力。', bonus: { vit: 15 } },
    human: { id: 'human', name: '人類', emoji: '🧑', desc: '大陸上人數最多的種族，擁有極強的適應力與平衡能力。', bonus: { all: 2 } },
    elf: { id: 'elf', name: '精靈', emoji: '🧝', desc: '在密林中成長，是自然的寵兒，精通奧術與箭步。', bonus: { int: 5, agi: 5 } },
    dark_elf: { id: 'dark_elf', name: '黑妖', emoji: '👤', desc: '為了追求極致的力量，與陰影簽下契約的冷酷種族。', bonus: { str: 5, agi: 5 } },
    orc: { id: 'orc', name: '獸人', emoji: '👺', desc: '咆哮的戰士族，天生擁有野獸般的怪力。', bonus: { str: 10 } }
};

// ---------- 套裝註冊 (Set Registry) ----------
export const SET_REGISTRY = {
    // T1 Sets
    slime_set: { name: '史萊姆套裝', bonuses: { '3': { stats: { hp: 50, def: 5 } }, '5': { stats: { hp: 100, def: 10 } } } },
    boar_hide: { name: '野豬皮革套裝', bonuses: { '3': { stats: { def: 8, hp: 80 } }, '5': { stats: { def: 15, hp: 150 } } } },
    bandit_set: { name: '強盜套裝', bonuses: { '3': { stats: { atk: 10, spd: 5 } }, '5': { stats: { atk: 20, spd: 10 } } } },

    // T2 Sets
    orcish_set: { name: '歐西斯套裝', bonuses: { '3': { stats: { atk: 15, def: 10 } }, '5': { stats: { atk: 30, def: 20 } } } },
    spider_silk: { name: '蛛絲套裝', bonuses: { '3': { stats: { mdef: 15, spd: 10 } }, '5': { stats: { mdef: 30, spd: 20 } } } },
    bark_set: { name: '樹皮套裝', bonuses: { '3': { stats: { def: 20, hp: 150 } }, '5': { stats: { def: 40, hp: 300 } } } },
    forest_set: { name: '精靈森林套裝', bonuses: { '3': { stats: { matk: 20, spd: 10 } }, '5': { stats: { matk: 40, spd: 20 } } } },
    stone_set: { name: '堅石套裝', bonuses: { '3': { stats: { def: 30, hp: 250 } }, '5': { stats: { def: 60, hp: 500 } } } },
    dragon_set: { name: '龍鱗套裝', bonuses: { '3': { stats: { def: 40, mdef: 30 } }, '5': { stats: { def: 80, mdef: 60 }, hooks: { onDamaged: 'dragon_retribution_10' } } } },

    // T3 Sets
    bone_set: { name: '白骨套裝', bonuses: { '3': { stats: { atk: 50, lifesteal: 5 } }, '5': { stats: { atk: 100, lifesteal: 10 }, hooks: { onKill: 'soul_reap_15' } } } },
    abyss_master_set: { name: '深淵主宰套裝', bonuses: { '3': { stats: { matk: 60, spd: 15 } }, '5': { stats: { matk: 120, spd: 30 }, hooks: { onAttack: 'abyss_touch_20' } } } },
    baphomet_set: { name: '巴風特套裝', bonuses: { '2': { stats: { matk: 80, def: 30, mdef: 30 }, hooks: { onDamaged: 'baphomet_curse_10' } } } },
    fire_lord_set: { name: '火領主套裝', bonuses: { '3': { stats: { matk: 80, matk_pct: 10 } }, '5': { stats: { matk: 150, matk_pct: 20 }, hooks: { onAttack: 'firelord_blaze' } } } },
    void_set: { name: '虛空套裝', bonuses: { '3': { stats: { mdef: 100, spd: 20 } }, '5': { stats: { mdef: 200, spd: 40 }, hooks: { onDamaged: 'void_shift_15' } } } },
    chaos_set: { name: '混沌套裝', bonuses: { '3': { stats: { atk: 80, matk: 80 } }, '5': { stats: { atk: 160, matk: 160 }, hooks: { onAttack: 'chaos_resonance_15' } } } },

    // T4 Sets
    dk_set: { name: '死亡騎士套裝', bonuses: { '3': { stats: { atk: 150, def: 50 } }, '5': { stats: { atk: 300, def: 100, hp: 1000 }, hooks: { onAttack: 'dk_hellfire_20' } } } },
    overlord_plate: { name: '霸王重鎧套裝', bonuses: { '3': { stats: { def: 150, hp: 1500 } }, '4': { stats: { def: 300, hp: 3000 }, hooks: { onDamaged: 'overlord_immortality' } } } },
    starborn_hunter: { name: '星辰獵手套裝', bonuses: { '3': { stats: { atk: 150, spd: 50 } }, '4': { stats: { atk: 300, spd: 100, crit: 20 } } } },
    elemental_sage: { name: '元素賢者套裝', bonuses: { '3': { stats: { matk: 200, mp: 500 } }, '4': { stats: { matk: 400, mp: 1000 }, hooks: { onAttack: 'sage_elemental_storm' } } } },
    aegis_divine: { name: '神聖壁壘套裝', bonuses: { '3': { stats: { def: 200, mdef: 200 } }, '4': { stats: { def: 400, mdef: 400, hp: 2000 }, hooks: { onDamaged: 'aegis_divine_shield' } } } },
    lord_of_chaos: { name: '混沌劍主套裝', bonuses: { '3': { stats: { atk: 200, matk: 200 } }, '4': { stats: { atk: 400, matk: 400, lifesteal: 15 } } } }
};

// ---------- 經驗值與初始化 ----------
export function getXpForLevel(level) {
    if (level <= 1) return 100;
    return Math.floor(100 * Math.pow(level, 1.8));
}

export function calculateInitialStats(raceId, classId) {
    const race = RACES[raceId];
    const base = { str: 10, int: 10, vit: 10, agi: 10, luk: 10 };
    if (race?.bonus) {
        Object.entries(race.bonus).forEach(([k, v]) => {
            if (k === 'all') Object.keys(base).forEach(sk => base[sk] += v);
            else base[k] += v;
        });
    }
    return base;
}

// ---------- 裝備隨機詞綴 (Modular Affixes) ----------
export const AFFIX_REGISTRY = {
    // 前綴 (Prefixes)
    brutal: { id: 'brutal', name: '殘暴的', type: 'prefix', stats: { atk_pct: 12 }, applyTo: ['weapon', 'accessory'], weight: 100, minLevel: 1 },
    calamity: { id: 'calamity', name: '災厄的', type: 'prefix', stats: { atk_pct: 15, matk_pct: 15 }, applyTo: ['weapon', 'accessory'], weight: 30, minLevel: 60 },
    fortune: { id: 'fortune', name: '幸運的', type: 'prefix', stats: { luk: 40 }, applyTo: ['accessory', 'head'], weight: 40, minLevel: 40 },
    intelligent: { id: 'intelligent', name: '睿智的', type: 'prefix', stats: { matk_pct: 12 }, applyTo: ['weapon', 'accessory'], weight: 100, minLevel: 1 },
    sturdy: { id: 'sturdy', name: '堅固的', type: 'prefix', stats: { hp_pct: 15 }, applyTo: ['armor', 'shield'], weight: 100, minLevel: 1 },
    nimble: { id: 'nimble', name: '敏捷的', type: 'prefix', stats: { spd_pct: 10 }, applyTo: ['armor', 'feet'], weight: 80, minLevel: 1 },
    mystic: { id: 'mystic', name: '神秘的', type: 'prefix', stats: { mp_pct: 15 }, applyTo: ['accessory', 'head'], weight: 100, minLevel: 1 },
    // 後綴 (Suffixes)
    of_power: { id: 'of_power', name: '之力量', type: 'suffix', stats: { atk: 15 }, applyTo: ['weapon', 'accessory', 'hands'], weight: 100, minLevel: 1 },
    of_wisdom: { id: 'of_wisdom', name: '之智慧', type: 'suffix', stats: { matk: 15 }, applyTo: ['weapon', 'accessory', 'head'], weight: 100, minLevel: 1 },
    of_wind: { id: 'of_wind', name: '之疾風', type: 'suffix', stats: { spd: 8 }, applyTo: ['feet', 'accessory'], weight: 80, minLevel: 1 },
    of_protection: { id: 'of_protection', name: '之防護', type: 'suffix', stats: { def: 10, mdef: 10 }, applyTo: ['armor', 'shield', 'legs'], weight: 100, minLevel: 1 },
    of_the_ogre: { id: 'of_the_ogre', name: '之食人魔', type: 'suffix', stats: { hp: 100 }, applyTo: ['armor', 'accessory'], weight: 60, minLevel: 1 },
    // 進階後綴
    of_carnage: { id: 'of_carnage', name: '之殺戮', type: 'suffix', stats: { atk: 40 }, applyTo: ['weapon', 'accessory'], weight: 50, minLevel: 30 },
    of_enlightenment: { id: 'of_enlightenment', name: '之啟蒙', type: 'suffix', stats: { matk: 40 }, applyTo: ['weapon', 'accessory'], weight: 50, minLevel: 30 },
    of_the_fortress: { id: 'of_the_fortress', name: '之要塞', type: 'suffix', stats: { def: 30, mdef: 30 }, applyTo: ['armor', 'shield', 'legs'], weight: 50, minLevel: 30 },
    of_the_colossus: { id: 'of_the_colossus', name: '之巨像', type: 'suffix', stats: { hp: 350 }, applyTo: ['armor', 'accessory', 'body'], weight: 40, minLevel: 40 },
    of_slaughter: { id: 'of_slaughter', name: '之屠殺', type: 'suffix', stats: { crit: 10 }, applyTo: ['weapon', 'accessory', 'hands'], weight: 50, minLevel: 40 },
    of_the_phantom: { id: 'of_the_phantom', name: '之幻影', type: 'suffix', stats: { dodge: 10 }, applyTo: ['feet', 'accessory', 'hands'], weight: 50, minLevel: 40 },
    of_eternity: { id: 'of_eternity', name: '之永恆', type: 'suffix', stats: { hp: 200, mp: 100, def: 15, mdef: 15 }, applyTo: ['accessory', 'body', 'head'], weight: 30, minLevel: 50 },
    // 稀有前綴
    vampiric: { id: 'vampiric', name: '吸血的', type: 'prefix', stats: { lifesteal: 10 }, applyTo: ['weapon', 'accessory'], weight: 30, minLevel: 45 },
    penetration: { id: 'penetration', name: '貫通的', type: 'prefix', stats: { penetration_pct: 15 }, applyTo: ['weapon'], weight: 40, minLevel: 35 },
    crit_dmg_boost: { id: 'crit_dmg_boost', name: '狂暴的', type: 'prefix', stats: { crit_dmg: 30 }, applyTo: ['weapon', 'accessory'], weight: 40, minLevel: 45 },
    echoing: { id: 'echoing', name: '迴響的', type: 'prefix', stats: { echo_chance: 10 }, applyTo: ['weapon', 'accessory'], weight: 30, minLevel: 50 },
    of_deicide: { id: 'of_deicide', name: '之弒神', type: 'suffix', stats: { atk: 80, matk: 80 }, applyTo: ['weapon', 'accessory'], weight: 15, minLevel: 80, activationLevel: 7 },
    of_archmage: { id: 'of_archmage', name: '之大法師', type: 'suffix', stats: { matk_pct: 15, mp_pct: 20 }, applyTo: ['accessory', 'weapon', 'head'], weight: 20, minLevel: 70 },
};

// ---------- 區域 ----------
export const AREAS = [
    { id: 'talking_island', name: '說話之島', emoji: '🏝️', levelReq: 1, desc: '冒險者的起點，雖然表面平和，但妖魔們正暗中集結。' },
    { id: 'elven_forest', name: '妖精之森', emoji: '🌿', levelReq: 15, desc: '精靈與自然的領地，守護著世界樹的純淨。' },
    { id: 'gludio_dungeon_low', name: '古魯丁地監 (淺層)', emoji: '💀', levelReq: 30, desc: '通往地底的古老通道，卡司柏家族在此研發禁忌魔法。' },
    { id: 'dragon_valley', name: '龍之谷', emoji: '🦴', levelReq: 45, desc: '遍佈巨龍骸骨的荒野，黑長者的落雷聲迴盪在谷間。' },
    { id: 'talking_island_dungeon', name: '說話之島地監 (深層)', emoji: '🐐', levelReq: 60, desc: '被邪惡詛咒的極深地底，巴風特在此守護著遠古邪惡。' },
    { id: 'gludio_dungeon_deep', name: '古魯丁地監 (終層)', emoji: '⚔️', levelReq: 75, desc: '大陸最深的黑暗之處，死亡騎士正進行著永恆的守望。' },
    { id: 'fire_dragon_cave', name: '火龍窟', emoji: '🔥', levelReq: 85, desc: '熾熱的火山地帶，由伊弗利特統治的元素領地。' },
    { id: 'antharas_lair', name: '安塔瑞斯棲息地', emoji: '🐉', levelReq: 95, desc: '傳說中地龍的長眠之地，迎接最終的挑戰。' },
];

// ---------- 區域品質權重 (用於遠征掉落) ----------
// 每個區域對應的品質權重，數值為累積百分比閾值
export const AREA_QUALITY_WEIGHTS = {
    // T1 區域 (Lv 1-25): 主要掉落 Common / Fine
    talking_island:    { legendary: 0.2, mythic: 0.5, epic: 3,  rare: 15, fine: 55 },
    elven_forest:      { legendary: 0.5, mythic: 1,   epic: 5,  rare: 20, fine: 60 },
    // T2 區域 (Lv 26-50): 主要掉落 Fine / Rare
    gludio_dungeon_low:{ legendary: 1,   mythic: 3,   epic: 10, rare: 40, fine: 75 },
    dragon_valley:     { legendary: 1.5, mythic: 4,   epic: 15, rare: 50, fine: 80 },
    // T3 區域 (Lv 51-75): 主要掉落 Rare / Epic
    talking_island_dungeon: { legendary: 2, mythic: 6, epic: 25, rare: 65, fine: 90 },
    gludio_dungeon_deep:    { legendary: 3, mythic: 8, epic: 35, rare: 75, fine: 95 },
    // T4 區域 (Lv 76-99): 主要掉落 Epic / Mythic / Legendary
    fire_dragon_cave:  { legendary: 5,  mythic: 15, epic: 50, rare: 85, fine: 98 },
    antharas_lair:     { legendary: 8,  mythic: 20, epic: 60, rare: 90, fine: 99 },
};

export const MONSTERS = {
    // ==================== T1: 說話之島 (Lv 1-25) ====================
    talking_island: [
        { id: 'slime', name: '史萊姆', emoji: '🟢', hp: 80, atk: 15, def: 5, mdef: 5, spd: 3, xp: 20, gold: 15, skills: [{ name: '溶解食人', type: 'magical', multiplier: 1.2, dot: { type: 'dissolve', percent: 5, turns: 2 }, chance: 20 }], drops: [
            { id: 'slime_gel', chance: 12 },
            { id: 'slime_hat', chance: 0.8, isEquip: true },
            { id: 'slime_gloves', chance: 0.8, isEquip: true },
            { id: 'slime_legs', chance: 0.7, isEquip: true },
            { id: 'slime_feet', chance: 0.8, isEquip: true },
            { id: 'slime_body', chance: 0.4, isEquip: true },
            { id: 'slime_shield', chance: 0.5, isEquip: true },
            { id: 'slime_ring', chance: 0.3, isEquip: true },
            { id: 'health_charm', chance: 0.3, isEquip: true },
            { id: 'hp_potion_s', chance: 5 },
        ] },
        { id: 'orc', name: '妖魔', emoji: '👺', hp: 120, atk: 25, def: 10, mdef: 10, spd: 5, xp: 35, gold: 20, skills: [{ name: '狂暴打擊', type: 'physical', multiplier: 1.3, chance: 15 }], drops: [
            { id: 'stolen_pouch', chance: 10 },
            { id: 'orcish_helm', chance: 0.8, isEquip: true },
            { id: 'orcish_hands', chance: 0.8, isEquip: true },
            { id: 'orcish_feet', chance: 0.8, isEquip: true },
            { id: 'orcish_mail', chance: 0.4, isEquip: true },
            { id: 'orcish_shield', chance: 0.4, isEquip: true },
            { id: 'hp_potion_s', chance: 3 },
            { id: 'brave_potion', chance: 0.1 },
        ] },
        { id: 'werewolf', name: '狼人', emoji: '🐺', hp: 180, atk: 40, def: 15, mdef: 15, spd: 15, xp: 55, gold: 40, skills: [{ name: '滿月嚎叫', type: 'buff', stat: 'atk', percent: 30, turns: 3, chance: 15 }], drops: [
            { id: 'werewolf_paw', chance: 15 },
            { id: 'brave_potion', chance: 2 },
            { id: 'boar_king_helm', chance: 0.6, isEquip: true },
            { id: 'leather_belt', chance: 1, isEquip: true },
            { id: 'bandit_hands', chance: 0.8, isEquip: true },
            { id: 'boar_hide_feet', chance: 0.8, isEquip: true },
            { id: 'boar_hide_body', chance: 0.4, isEquip: true },
        ] }
    ],
    // ==================== T1: 妖精之森 (Lv 15-30) ====================
    elven_forest: [
        { id: 'fungus', name: '蘑菇', emoji: '🍄', hp: 450, atk: 70, def: 35, mdef: 50, spd: 5, xp: 120, gold: 80, skills: [{ name: '混亂孢子', type: 'debuff', stat: 'spd', percent: -40, turns: 2, chance: 20 }], drops: [
            { id: 'fungus_spore', chance: 12 },
            { id: 'spirit_wood', chance: 2 },
            { id: 'hp_potion_s', chance: 5 },
            { id: 'mp_potion', chance: 2 },
            { id: 'bark_body', chance: 0.6, isEquip: true },
            { id: 'bark_shield', chance: 0.8, isEquip: true },
        ] },
        { id: 'arachne', name: '芮克妮', emoji: '🕸️', hp: 800, atk: 130, def: 60, mdef: 80, spd: 35, xp: 250, gold: 200, skills: [{ name: '劇毒噴吐', type: 'magical', multiplier: 1.2, dot: { type: 'poison', percent: 5, turns: 3 }, chance: 20 }], drops: [
            { id: 'arachne_web', chance: 12 },
            { id: 'spirit_wood', chance: 2 },
            { id: 'spider_silk_hands', chance: 0.8, isEquip: true },
            { id: 'spirit_ring', chance: 0.5, isEquip: true },
            { id: 'spider_silk_body', chance: 0.4, isEquip: true },
            { id: 'forest_body', chance: 0.4, isEquip: true },
            { id: 'bark_body', chance: 0.4, isEquip: true },
            { id: 'bark_shield', chance: 0.4, isEquip: true },
            { id: 'wisdom_potion', chance: 0.1 },
            { id: 'scroll_armor', chance: 0.15 },
        ] },
        { id: 'ent', name: '妖精之樹', emoji: '🌳', hp: 1200, atk: 120, def: 100, mdef: 150, spd: 10, xp: 350, gold: 250, skills: [{ name: '根鬚纏繞', type: 'debuff', stat: 'spd', percent: -50, turns: 3, chance: 15 }], drops: [
            { id: 'spirit_pouch', chance: 15 },
            { id: 'spirit_wood', chance: 5 },
            { id: 'bark_helm', chance: 0.8, isEquip: true },
            { id: 'bark_hands', chance: 0.8, isEquip: true },
            { id: 'bark_feet', chance: 0.8, isEquip: true },
            { id: 'spirit_ring', chance: 0.4, isEquip: true },
            { id: 'mp_potion', chance: 3 },
            { id: 'wisdom_potion', chance: 0.1 },
        ] }
    ],
    // ==================== T2: 古魯丁地監 淺層 (Lv 30-45) ====================
    gludio_dungeon_low: [
        { id: 'skeleton', name: '骷髏', emoji: '💀', hp: 1500, atk: 220, def: 120, mdef: 100, spd: 15, xp: 600, gold: 400, skills: [{ name: '裂骨重擊', type: 'physical', multiplier: 1.5, stunChance: 15, chance: 15 }], drops: [
            { id: 'ancient_bone', chance: 15 },
            { id: 'bone_head', chance: 0.8, isEquip: true },
            { id: 'bone_hands', chance: 0.8, isEquip: true },
            { id: 'bone_legs', chance: 0.8, isEquip: true },
            { id: 'bone_feet', chance: 0.8, isEquip: true },
            { id: 'bone_shield', chance: 0.4, isEquip: true },
            { id: 'stone_helm', chance: 0.25, isEquip: true },
            { id: 'stone_shield', chance: 0.2, isEquip: true },
            { id: 'hp_potion_m', chance: 2 },
            { id: 'defense_potion', chance: 0.1 },
            { id: 'scroll_armor', chance: 0.2 },
        ] },
        { id: ' ghoul', name: '食屍鬼', emoji: '🧟', hp: 2000, atk: 280, def: 150, mdef: 120, spd: 10, xp: 800, gold: 500, skills: [{ name: '腐爛抓擊', type: 'physical', multiplier: 1.4, dot: { type: 'rot', percent: 8, turns: 2 }, chance: 20 }], drops: [
            { id: 'ancient_bone', chance: 15 },
            { id: 'earring_wisdom', chance: 0.5, isEquip: true },
            { id: 'bone_body', chance: 0.4, isEquip: true },
            { id: 'stone_body', chance: 0.25, isEquip: true },
            { id: 'stone_plate', chance: 0.2, isEquip: true },
            { id: 'stone_sword', chance: 0.2, isEquip: true },
            { id: 'hp_potion_m', chance: 2 },
            { id: 'defense_potion', chance: 0.1 },
            { id: 'scroll_weapon', chance: 0.15 },
        ] },
        { id: 'sparta', name: '斯巴托', emoji: '⚔️💀', hp: 2500, atk: 350, def: 200, mdef: 150, spd: 25, xp: 1000, gold: 800, skills: [{ name: '致命突刺', type: 'physical', multiplier: 1.7, chance: 20 }], drops: [
            { id: 'ancient_bone', chance: 15 },
            { id: 'bone_mask', chance: 0.4, isEquip: true },
            { id: 'bone_shield', chance: 0.4, isEquip: true },
            { id: 'bone_great_sword', chance: 0.15, isEquip: true },
            { id: 'defense_potion', chance: 0.1 },
            { id: 'scroll_armor', chance: 0.25 },
        ] }
    ],
    // ==================== T2: 龍之谷 (Lv 45-60) ====================
    dragon_valley: [
        { id: 'skeleton_knight_dv', name: '骷髏騎士', emoji: '🛡️💀', hp: 4500, atk: 450, def: 350, mdef: 300, spd: 25, xp: 1500, gold: 1000, skills: [{ name: '烈焰斬', type: 'physical', multiplier: 1.6, chance: 15 }], drops: [
            { id: 'ancient_bone', chance: 12 },
            { id: 'dragon_scale_boots', chance: 0.6, isEquip: true },
            { id: 'dragon_hands', chance: 0.5, isEquip: true },
            { id: 'dragon_scale_greaves', chance: 0.5, isEquip: true },
            { id: 'dragon_head', chance: 0.4, isEquip: true },
            { id: 'ogre_belt', chance: 0.5, isEquip: true },
            { id: 'hp_potion_l', chance: 1 },
            { id: 'focus_potion', chance: 0.05 },
            { id: 'scroll_weapon', chance: 0.25 },
        ] },
        { id: 'wyvern_dv', name: '幼龍', emoji: '🐲', hp: 6000, atk: 600, def: 450, mdef: 500, spd: 50, xp: 2500, gold: 2000, skills: [{ name: '龍之氣息', type: 'magical', multiplier: 2.0, chance: 20 }], drops: [
            { id: 'dragon_scale_mat', chance: 10 },
            { id: 'dragon_scale_vest', chance: 0.4, isEquip: true },
            { id: 'dragon_fang_blade', chance: 0.25, isEquip: true },
            { id: 'dragon_body', chance: 0.1, isEquip: true },
            { id: 'mp_potion', chance: 2 },
            { id: 'focus_potion', chance: 0.05 },
            { id: 'scroll_armor', chance: 0.3 },
        ] },
        { id: 'cockatrice', name: '考庫雷斯', emoji: '🐔🐍', hp: 5500, atk: 550, def: 300, mdef: 450, spd: 70, xp: 2200, gold: 1800, skills: [{ name: '石化啄擊', type: 'debuff', stat: 'spd', percent: -50, turns: 2, chance: 20 }], drops: [
            { id: 'dragon_scale_mat', chance: 12 },
            { id: 'necklace_dex', chance: 0.4, isEquip: true },
            { id: 'focus_potion', chance: 0.05 },
            { id: 'scroll_weapon', chance: 0.35 },
        ] }
    ],
    // ==================== T3: 說話之島地監 深層 (Lv 60-75) ====================
    talking_island_dungeon: [
        { id: 'lycanthrope', name: '萊肯', emoji: '🐺🗡️', hp: 12000, atk: 1200, def: 800, mdef: 700, spd: 65, xp: 8000, gold: 5000, skills: [{ name: '迅捷撕裂', type: 'physical', multiplier: 1.3, hits: 2, chance: 25 }], drops: [
            { id: 'werewolf_paw', chance: 15 },
            { id: 'brave_potion', chance: 3 },
            { id: 'abyss_boots', chance: 0.4, isEquip: true },
            { id: 'abyss_gloves', chance: 0.3, isEquip: true },
            { id: 'speed_boots', chance: 0.2, isEquip: true },
            { id: 'abyss_ring', chance: 0.1, isEquip: true },
            { id: 'necklace_str', chance: 0.05, isEquip: true },
            { id: 'necklace_dex', chance: 0.05, isEquip: true },
            { id: 'abyss_robe', chance: 0.03, isEquip: true },
            { id: 'abyss_dagger', chance: 0.03, isEquip: true },
            { id: 'scroll_weapon', chance: 0.4 },
        ] },
        { id: 'cerberus_minion', name: '地獄犬', emoji: '🐕🔥', hp: 10000, atk: 1000, matk: 900, def: 600, mdef: 900, spd: 60, xp: 7500, gold: 4500, skills: [{ name: '三連噴火', type: 'magical', multiplier: 0.9, hits: 3, chance: 20 }], drops: [
            { id: 'fire_core', chance: 10 },
            { id: 'brave_potion', chance: 4 },
            { id: 'fire_lord_weapon_2h', chance: 0.02, isEquip: true },
        ] },
        { id: 'bugbear', name: '食人妖精', emoji: '👹', hp: 15000, atk: 1500, def: 1000, mdef: 600, spd: 40, xp: 9500, gold: 6000, skills: [{ name: '巨力擊碎', type: 'physical', multiplier: 1.8, stunChance: 15, chance: 15 }], drops: [
            { id: 'stolen_pouch', chance: 15 },
            { id: 'stone_great_sword', chance: 0.3, isEquip: true },
            { id: 'ogre_belt', chance: 0.6, isEquip: true },
            { id: 'scroll_weapon', chance: 0.4 },
        ] }
    ],
    // ==================== T3: 古魯丁地監 終層 (Lv 75-85) ====================
    gludio_dungeon_deep: [
        { id: 'death_soldier', name: '死亡士兵', emoji: '👻', hp: 35000, atk: 2500, def: 2500, mdef: 2200, spd: 70, xp: 25000, gold: 15000, skills: [{ name: '死亡之影', type: 'physical', multiplier: 1.5, armorPen: 30, chance: 15 }], drops: [
            { id: 'ancient_bone', chance: 15 },
            { id: 'chaos_helm', chance: 0.2, isEquip: true },
            { id: 'chaos_mail', chance: 0.08, isEquip: true },
            { id: 'chaos_blade', chance: 0.05, isEquip: true },
            { id: 'chaos_great_sword', chance: 0.05, isEquip: true },
            { id: 'scroll_armor', chance: 0.6 },
        ] },
        { id: 'succubus_deep', name: '地獄思克巴', emoji: '👿', hp: 30000, matk: 3000, def: 1800, mdef: 3500, spd: 90, xp: 28000, gold: 18000, skills: [{ name: '奪魂之吻', type: 'magical', multiplier: 2.2, lifesteal: 30, chance: 20 }, { id: 'mana_drain', name: '法力抽取', type: 'magical', multiplier: 1.0, drainMp: true, chance: 15 }], drops: [
            { id: 'mp_potion', chance: 8 },
            { id: 'wisdom_potion', chance: 0.5 },
            { id: 'necklace_int', chance: 0.3, isEquip: true },
            { id: 'belt_of_mind', chance: 0.2, isEquip: true },
            { id: 'void_boots', chance: 0.1, isEquip: true },
            { id: 'void_robe', chance: 0.03, isEquip: true },
            { id: 'void_emperor_blade', chance: 0.01, isEquip: true },
            { id: 'scroll_weapon', chance: 0.5 },
        ] },
        { id: 'horrid_ghoul', name: '負面食屍鬼', emoji: '🧟‍♂️', hp: 40000, atk: 3200, matk: 2500, def: 2000, mdef: 3000, spd: 50, xp: 32000, gold: 20000, skills: [{ name: '麻痺毒素', type: 'debuff', stat: 'spd', percent: -70, turns: 3, chance: 20 }], drops: [
            { id: 'ancient_bone', chance: 18 },
            { id: 'earring_wisdom', chance: 0.4, isEquip: true },
            { id: 'belt_of_mind', chance: 0.2, isEquip: true },
            { id: 'scroll_weapon', chance: 0.6 },
        ] }
    ],
    // ==================== T4: 火龍窟 (Lv 85-95) ====================
    fire_dragon_cave: [
        { id: 'lava_golem_foc', name: '熔岩巨靈', emoji: '🌋', hp: 80000, atk: 5500, def: 8000, mdef: 5000, spd: 30, xp: 80000, gold: 50000, skills: [{ name: '大地粉碎', type: 'physical', multiplier: 2.0, stunChance: 20, chance: 15 }], drops: [
            { id: 'lava_heart', chance: 12 },
            { id: 'overlord_armor', chance: 0.02, isEquip: true },
            { id: 'scroll_armor', chance: 0.8 },
        ] },
        { id: 'fire_elemental_foc', name: '火之大精靈', emoji: '🔥', hp: 65000, matk: 6000, def: 4000, mdef: 9000, spd: 85, xp: 90000, gold: 60000, skills: [{ name: '地獄烈焰', type: 'magical', multiplier: 2.5, chance: 20 }], drops: [
            { id: 'fire_core', chance: 15 },
            { id: 'sage_cosmic_robe', chance: 0.02, isEquip: true },
            { id: 'scroll_weapon', chance: 0.8 },
        ] },
        { id: 'salamander', name: '火蜥蜴', emoji: '🦎🔥', hp: 70000, atk: 4500, matk: 4000, def: 5000, mdef: 6000, spd: 100, xp: 85000, gold: 55000, skills: [{ name: '火焰噴流', type: 'magical', multiplier: 1.5, dot: { type: 'burn', percent: 10, turns: 3 }, chance: 20 }], drops: [
            { id: 'fire_core', chance: 12 },
            { id: 'spirit_ring', chance: 0.5, isEquip: true },
            { id: 'leather_belt', chance: 0.8, isEquip: true },
            { id: 'scroll_accessory', chance: 0.5 },
        ] }
    ],
    // ==================== T4: 安塔瑞斯棲息地 (Lv 95-99) ====================
    antharas_lair: [
        { id: 'dragon_guardian', name: '地龍守護者', emoji: '🐲🛡️', hp: 250000, atk: 8500, def: 25000, mdef: 20000, spd: 100, xp: 250000, gold: 200000, skills: [{ name: '守護領域', type: 'shield', shieldMultiplier: 0.5, chance: 15 }], drops: [
            { id: 'earth_dragon_scale', chance: 10 },
            { id: 'dragonslayer', chance: 0.01, isEquip: true },
            { id: 'scroll_weapon', chance: 1.5 },
        ] },
        { id: 'cave_beast', name: '洞穴巨人', emoji: '🐘', hp: 300000, atk: 12000, def: 35000, mdef: 15000, spd: 60, xp: 300000, gold: 250000, skills: [{ name: '岩石投擲', type: 'physical', multiplier: 2.2, chance: 15 }], drops: [
            { id: 'earth_dragon_scale', chance: 12 },
            { id: 'overlord_armor', chance: 0.01, isEquip: true },
            { id: 'scroll_armor', chance: 1.5 },
        ] },
        { id: 'teralin', name: '地龍之眼', emoji: '👁️', hp: 180000, matk: 15000, def: 15000, mdef: 45000, spd: 120, xp: 350000, gold: 300000, skills: [{ name: '麻痺凝視', type: 'debuff', stat: 'spd', percent: -90, turns: 2, chance: 25 }], drops: [
            { id: 'earth_dragon_scale', chance: 12 },
            { id: 'invisi_cloak', chance: 0.01, isEquip: true },
            { id: 'invis_cloak_frag', chance: 0.4, isEquip: true },
            { id: 'scroll_weapon', chance: 1.5 },
        ] }
    ]
};


// ---------- 召喚配方 (Summon Recipes) ----------
export const SUMMON_RECIPES = {
    talking_island: {
        ingredients: [
            { id: 'stolen_pouch', count: 10 },
            { id: 'slime_gel', count: 10 }
        ]
    },
    elven_forest: {
        ingredients: [
            { id: 'spirit_wood', count: 15 },
            { id: 'fungus_spore', count: 10 }
        ]
    },
    gludio_dungeon_low: {
        ingredients: [
            { id: 'ancient_bone', count: 20 },
            { id: 'arachne_web', count: 15 }
        ]
    },
    dragon_valley: {
        ingredients: [
            { id: 'dragon_scale_mat', count: 25 },
            { id: 'ancient_bone', count: 25 }
        ]
    },
    talking_island_dungeon: {
        ingredients: [
            { id: 'werewolf_paw', count: 30 },
            { id: 'ancient_bone', count: 40 }
        ]
    },
    gludio_dungeon_deep: {
        ingredients: [
            { id: 'ancient_bone', count: 100 }
        ]
    },
    fire_dragon_cave: {
        ingredients: [
            { id: 'lava_heart', count: 40 },
            { id: 'fire_core', count: 40 }
        ]
    },
    antharas_lair: {
        ingredients: [
            { id: 'earth_dragon_scale', count: 5 },
            { id: 'dragon_scale_mat', count: 50 }
        ]
    }
};


// ---------- 任務系統 (Quests) ----------
export const MAIN_QUESTS = [
    {
        id: 'prologue',
        chapter: '序章',
        name: '啟程：說話之島',
        objectives: [
            { type: 'create_character', count: 1, desc: '踏入吉吉王國' }
        ],
        rewards: { gold: 100, xp: 50 }
    },
    {
        id: 'island_exploration',
        chapter: '第一章',
        name: '海島的試煉',
        objectives: [
            { type: 'kill_monster', monsterId: 'slime', count: 5, desc: '獵殺 5 隻史萊姆' },
            { type: 'kill_monster', monsterId: 'werewolf', count: 3, desc: '擊敗 3 隻狼人' }
        ],
        rewards: { gold: 300, xp: 200, gems: 5 }
    },
    {
        id: 'forest_cleaning',
        chapter: '第二章',
        name: '森林的淨化',
        objectives: [
            { type: 'kill_monster', monsterId: 'fungus', count: 10, desc: '採摘 10 朵受污染的蘑菇' },
            { type: 'kill_monster', monsterId: 'pan', count: 5, desc: '安撫 5 隻發狂的潘' }
        ],
        rewards: { gold: 600, xp: 500, gems: 10, equipment: 'spirit_staff' }
    },
    {
        id: 'dark_forest_depths',
        chapter: '第三章',
        name: '深入深淵之林',
        objectives: [
            { type: 'kill_monster', monsterId: 'orc', count: 15, desc: '驅逐 15 名妖魔' },
            { type: 'kill_monster', monsterId: 'arachne', count: 5, desc: '擊斃 5 隻芮克妮' }
        ],
        rewards: { gold: 1200, xp: 1200, gems: 20 }
    },
    {
        id: 'mountain_ascent',
        chapter: '第四章',
        name: '攀登龍脊之巔',
        objectives: [
            { type: 'kill_monster', monsterId: 'skeleton', count: 8, desc: '討伐 8 隻骷髏' },
            { type: 'kill_monster', monsterId: 'skeleton_knight_dv', count: 5, desc: '粉碎 5 具骷髏騎士之魂' }
        ],
        rewards: { gold: 2500, xp: 3000, gems: 50 }
    },
    {
        id: 'swamp_menace',
        chapter: '第三章',
        title: '地監掃蕩',
        description: '清理古魯丁地監中的不死生物。',
        objectives: [
            { type: 'kill_monster', monsterId: 'skeleton', count: 10 },
            { type: 'kill_monster', monsterId: 'ghoul', count: 5 }
        ],
        rewards: { gold: 1500, xp: 1200, gems: 20 }
    }
];

export const DAILY_QUEST_POOL = [
    { id: 'daily_kill_slime', type: 'kill_monster', monsterId: 'slime', count: 10, name: '清掃啫喱', rewards: { gold: 200, xp: 150 } },
    { id: 'daily_kill_goblin', type: 'kill_monster', monsterId: 'goblin', count: 8, name: '獵捕小惡魔', rewards: { gold: 400, xp: 300 } },
    { id: 'daily_win_battles', type: 'win_battle', count: 5, name: '戰之磨練', rewards: { gold: 500, xp: 400, gems: 2 } },
];
// ===== 吉吉王國 RPG — 遊戲主資料中心 =====

// ---------- 技能與道具 (外部模組) ----------
import { SKILLS as _SKILLS, SKILL_BOOKS as _SKILL_BOOKS, SKILL_BOOK_DROP_POOLS as _POOLS, getSkillDef as _getSkillDef } from './skills.js';
import { EQUIPMENT as _EQUIPMENT, SHOP_ITEMS as _SHOP, ITEM_NAMES as _NAMES, getItemDisplayName as _getName, QUALITY_MULTIPLIER as _QM, EQUIP_SELL_PRICES as _ESP } from './items.js';

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

export const STAT_LABELS = {
    hp: '生命', mp: '魔力', atk: '攻擊', matk: '魔攻', def: '防禦', mdef: '魔防', spd: '速度',
    crit: '暴擊', crit_dmg: '暴傷', lifesteal: '吸血', penetration_pct: '穿透',
    dodge: '閃避', echo_chance: '迴響',
    atk_pct: '攻擊%', matk_pct: '魔攻%', def_pct: '防禦%', mdef_pct: '魔防%',
    spd_pct: '速度%', hp_pct: '生命%', mp_pct: '魔力%'
};

// ---------- 職業 (Classes) ----------
export const CLASSES = {
    warrior: {
        id: 'warrior', name: '劍士', emoji: '⚔️', desc: '貫徹力量與信念的武藝大師，擅長近身交鋒，是戰場上的核心。',
        baseStats: { hp: 150, mp: 30, atk: 25, matk: 10, def: 20, mdef: 15, spd: 15 },
        growth: { hp: 25, mp: 5, atk: 5, matk: 2, def: 4, mdef: 3, spd: 3 },
        statConversion: { str: { atk: 1.5, hp: 2 }, vit: { hp: 8, def: 1.2 } },
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
        statConversion: { agi: { spd: 1.2, atk: 1.0, crit: 0.1 }, luk: { crit: 0.2, crit_dmg: 0.5 } },
        advancements: [
            { level: 30, name: '巡林客', color: 'WHITE' },
            { level: 60, name: '幽暗執行者', color: 'GOLD' },
            { level: 99, name: '追風主宰', color: 'CYAN' }
        ],
        weapon: 'novice_bow', initialSkill: 'precise_shot'
    },
    mage: {
        id: 'mage', name: '法師', emoji: '🔮', desc: '與四大元素簽署古老契約的智者，揮手間足以毀天滅地。',
        baseStats: { hp: 100, mp: 100, atk: 10, matk: 30, def: 10, mdef: 25, spd: 12 },
        growth: { hp: 15, mp: 15, atk: 1, matk: 8, def: 2, mdef: 5, spd: 2 },
        statConversion: { int: { matk: 1.8, mp: 10 }, luk: { crit: 0.1, echo_chance: 0.1 } },
        advancements: [
            { level: 30, name: '元素術士', color: 'WHITE' },
            { level: 60, name: '大魔導師', color: 'GOLD' },
            { level: 99, name: '奧術主宰', color: 'PURPLE' }
        ],
        weapon: 'novice_staff', initialSkill: 'fireball'
    },
    paladin: {
        id: 'paladin', name: '聖騎士', emoji: '🛡️', desc: '神的代理者，誓言守護弱小並降下神聖的審判。',
        baseStats: { hp: 180, mp: 50, atk: 18, matk: 18, def: 25, mdef: 20, spd: 10 },
        growth: { hp: 35, mp: 8, atk: 3, matk: 3, def: 6, mdef: 5, spd: 1 },
        statConversion: { vit: { hp: 12, def: 1.5 }, int: { mdef: 1.0, matk: 0.8 } },
        advancements: [
            { level: 30, name: '守誓者', color: 'WHITE' },
            { level: 60, name: '聖教軍', color: 'GOLD' },
            { level: 99, name: '大天使長', color: 'GOLD' }
        ],
        weapon: 'rusty_mace', initialSkill: 'holy_strike'
    },
    magic_swordsman: {
        id: 'magic_swordsman', name: '魔劍士', emoji: '✨', desc: '劍與魔法的完美交織，在刀光劍影中釋放混亂的奧術能量。',
        baseStats: { hp: 130, mp: 60, atk: 22, matk: 22, def: 15, mdef: 15, spd: 18 },
        growth: { hp: 20, mp: 10, atk: 4.5, matk: 4.5, def: 3, mdef: 3, spd: 4 },
        statConversion: { str: { atk: 1.0, spd: 0.2 }, int: { matk: 1.0, mp: 5 }, agi: { spd: 0.5, atk: 0.5 } },
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
    slime_set: {
        name: '史萊姆套裝',
        bonuses: { '3': { stats: { def: 10, hp: 100 } } }
    },
    goblin_set: {
        name: '哥布林套裝',
        bonuses: { '3': { stats: { atk: 20, spd: 10 } } }
    },
    dragon_set: {
        name: '龍鱗套裝',
        bonuses: { '3': { stats: { atk: 30, def: 20 } }, '5': { hooks: { onDamaged: 'dragon_retribution_10' } } }
    },
    crystal_set: {
        name: '水晶套裝',
        bonuses: { '3': { stats: { matk: 30, mdef: 20 } }, '5': { hooks: { onDamaged: 'crystal_reflect_20' } } }
    },
    mana_set: {
        name: '魔力結晶套裝',
        bonuses: { '3': { stats: { matk: 40, mp: 200 } }, '5': { hooks: { onDamaged: 'mana_shield_20' } } }
    },
    stone_set: {
        name: '堅石套裝',
        bonuses: { '3': { stats: { def: 40, hp: 300 } }, '5': { hooks: { onDamaged: 'stone_skin_5' } } }
    },
    bone_set: {
        name: '白骨套裝',
        bonuses: { '3': { stats: { atk: 40, lifesteal: 10 } }, '5': { hooks: { onKill: 'soul_reap_10' } } }
    },
    radiant_cross: {
        name: '光輝十字套裝',
        bonuses: { '3': { stats: { atk: 50, matk: 50 } }, '5': { hooks: { onDamaged: 'radiant_heal_15' } } }
    },
    chaos_set: {
        name: '混沌套裝',
        bonuses: { '3': { stats: { atk: 60, matk: 60, all_pct: 10 } }, '5': { hooks: { onAttack: 'chaos_resonance_10' } } }
    }
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
    of_the_torrent: { id: 'of_the_torrent', name: '之激流', type: 'suffix', stats: { echo_chance: 15 }, applyTo: ['weapon', 'accessory'], weight: 25, minLevel: 65 },
    of_extinction: { id: 'of_extinction', name: '之毀滅', type: 'suffix', stats: { penetration_pct: 20 }, applyTo: ['weapon', 'accessory'], weight: 20, minLevel: 75, activationLevel: 7 },
};

// ---------- 區域 ----------
export const AREAS = [
    { id: 'talking_island', name: '說話之島', emoji: '🏝️', levelReq: 1, desc: '騎士們冒險的起點，平靜的海島上隱藏著古老的冒險地監。' },
    { id: 'elven_forest', name: '妖精之森', emoji: '🌿', levelReq: 10, desc: '精靈族的故鄉，茂密的森林中隱藏著被汙染的邪惡精靈。' },
    { id: 'dragon_valley', name: '龍之谷', emoji: '🦴', levelReq: 25, desc: '遍山遍野都是龍族殘骸的地帶，強大的黑長者守護著通往深處的路。' },
    { id: 'giran_swamp', name: '奇岩沼澤', emoji: '🐊', levelReq: 40, desc: '泥濘不堪且劇毒瀰漫的沼澤地，據說這裡出沒著巨大的變種鱷魚。' },
    { id: 'fire_dragon_cave', name: '火龍窟', emoji: '🔥', levelReq: 55, desc: '地底岩漿沸騰的熾熱之地，伊弗利特率領著火元素軍團鎮守於此。' },
    { id: 'crystal_cave', name: '水晶地監', emoji: '🧊', levelReq: 65, desc: '寒冷徹骨的水晶迷宮，惡魔巴風特在深處等待著迷途的靈魂。' },
    { id: 'ivory_tower', name: '象牙塔', emoji: '🏰', levelReq: 75, desc: '鑽研魔法奧祕的至高之塔，由墮落的惡魔佔據了頂層。' },
    { id: 'tower_of_insolence', name: '傲慢之塔', emoji: '🗼', levelReq: 85, desc: '挑戰神之權威的通天巨塔，每一層都由強大的死靈元帥鎮守。' },
    { id: 'forgotten_island', name: '遺忘之島', emoji: '🌑', levelReq: 90, desc: '世界邊緣的禁忌孤島，傳說中沉睡著遠古巨人的諸神遺蹟。' },
    { id: 'antharas_lair', name: '安塔瑞斯棲息地', emoji: '🐉', levelReq: 95, desc: '世界的最深處，地龍安塔瑞斯的長眠之處。' },
];

// ---------- 怪物 ----------
export const MONSTERS = {
    talking_island: [
        {
            id: 'keroso', name: '史萊姆', emoji: '🟢', hp: 50, atk: 12, def: 5, mdef: 5, spd: 3, xp: 15, gold: 12, drops: [
                { id: 'slime_gel', chance: 50 },
                { id: 'slime_shield', chance: 5, isEquip: true },
                { id: 'scroll_weapon', chance: 0.1 }, { id: 'scroll_armor', chance: 0.1 }
            ]
        },
        {
            id: 'wolf', name: '狼', emoji: '🐺', hp: 85, atk: 20, def: 10, mdef: 8, spd: 8, xp: 25, gold: 20, drops: [
                { id: 'boar_meat', chance: 50 },
                { id: 'boar_hide_vest', chance: 5, isEquip: true }
            ]
        },
        {
            id: 'orc_fighter', name: '妖魔戰士', emoji: '👺', hp: 120, atk: 28, def: 15, mdef: 10, spd: 6, xp: 35, gold: 30, drops: [
                { id: 'goblin_ear', chance: 40 },
                { id: 'goblin_sword', chance: 5, isEquip: true }
            ]
        }
    ],
    elven_forest: [
        {
            id: 'dirty_elf', name: '汙濁精靈', emoji: '🧝', hp: 250, atk: 45, def: 20, mdef: 30, spd: 15, xp: 60, gold: 50,
            skills: [{ name: '元素箭', type: 'magical', multiplier: 1.3, chance: 20 }],
            drops: [{ id: 'spirit_staff', chance: 4, isEquip: true }]
        },
        {
            id: 'orc_archer', name: '妖魔弓箭手', emoji: '🏹', hp: 180, atk: 52, def: 15, mdef: 15, spd: 22, xp: 55, gold: 45,
            skills: [{ name: '二連矢', type: 'physical', multiplier: 1.1, count: 2, chance: 25 }],
            drops: [{ id: 'novice_bow', chance: 5, isEquip: true }]
        }
    ],
    dragon_valley: [
        {
            id: 'wyvern', name: '飛龍', emoji: '🐲', hp: 600, atk: 85, def: 45, mdef: 40, spd: 25, xp: 150, gold: 120,
            skills: [{ name: '劇毒龍息', type: 'magical', multiplier: 1.2, dot: { percent: 5, turns: 3 }, chance: 20 }],
            drops: [{ id: 'dragon_fang_blade', chance: 2, isEquip: true }]
        },
        {
            id: 'skeleton_knight', name: '骷髏騎士', emoji: '💀', hp: 550, atk: 78, def: 60, mdef: 25, spd: 12, xp: 140, gold: 110,
            skills: [{ name: '破碎斬', type: 'physical', multiplier: 1.5, chance: 25 }],
            drops: [{ id: 'bone_blade', chance: 3, isEquip: true }]
        }
    ],
    giran_swamp: [
        {
            id: 'medusa', name: '蛇女', emoji: '🐍', hp: 1200, atk: 110, def: 70, mdef: 80, spd: 20, xp: 350, gold: 250,
            skills: [{ name: '石化凝視', type: 'debuff', stat: 'spd', percent: -50, turns: 3, chance: 25 }],
            drops: [{ id: 'dragon_eye_amulet', chance: 1, isEquip: true }]
        },
        {
            id: 'croc', name: '巨鱷', emoji: '🐊', hp: 1500, atk: 135, def: 90, mdef: 50, spd: 10, xp: 400, gold: 300,
            skills: [{ name: '死亡翻滾', type: 'physical', multiplier: 1.8, chance: 20 }],
            drops: [{ id: 'dragon_scale_vest', chance: 2, isEquip: true }]
        }
    ],
    fire_dragon_cave: [
        {
            id: 'fire_elemental', name: '火元素', emoji: '🔥', hp: 2500, atk: 220, def: 110, mdef: 180, spd: 30, xp: 1200, gold: 800,
            skills: [{ name: '烈焰噴湧', type: 'magical', multiplier: 1.6, chance: 30 }],
            drops: [{ id: 'scroll_weapon', chance: 2 }]
        },
        {
            id: 'lava_golem', name: '熔岩巨靈', emoji: '🌋', hp: 3500, atk: 190, def: 250, mdef: 120, spd: 15, xp: 1500, gold: 1000,
            skills: [{ name: '大地重擊', type: 'physical', multiplier: 1.4, stun: true, chance: 20 }],
            drops: [{ id: 'stone_plate', chance: 3, isEquip: true }]
        }
    ],
    crystal_cave: [
        {
            id: 'crystal_golem', name: '水晶巨靈', emoji: '💎', hp: 5000, atk: 280, def: 350, mdef: 250, spd: 20, xp: 3000, gold: 2000,
            skills: [{ name: '水晶反射', type: 'buff', stat: 'def', percent: 50, turns: 3, chance: 25 }],
            drops: [{ id: 'earth_core_ring', chance: 2, isEquip: true }]
        }
    ],
    ivory_tower: [
        {
            id: 'fallen_mage', name: '墮落法師', emoji: '🧙', hp: 6500, atk: 150, matk: 450, def: 120, mdef: 400, spd: 40, xp: 6000, gold: 4000,
            skills: [{ name: '流星雨', type: 'magical', multiplier: 2.5, chance: 15 }],
            drops: [{ id: 'book_meteor_cluster', chance: 1 }]
        }
    ],
    tower_of_insolence: [
        {
            id: 'grim_reaper_guard', name: '死神守衛', emoji: '🕴️', hp: 12000, atk: 650, def: 500, mdef: 450, spd: 60, xp: 15000, gold: 10000,
            skills: [{ name: '靈魂收割', type: 'physical', multiplier: 2.0, lifesteal: 30, chance: 25 }],
            drops: [{ id: 'scroll_weapon', chance: 5 }]
        }
    ],
    forgotten_island: [
        {
            id: 'ancient_warrior', name: '古代戰士', emoji: '🛡️', hp: 25000, atk: 1200, def: 800, mdef: 600, spd: 50, xp: 40000, gold: 25000,
            skills: [{ name: '諸神黃昏', type: 'physical', multiplier: 2.5, stun: true, chance: 15 }],
            drops: [{ id: 'chaos_set', chance: 1, isEquip: true }]
        }
    ],
    antharas_lair: [
        {
            id: 'dragon_general', name: '地龍禁衛軍', emoji: '🐲', hp: 50000, atk: 2500, def: 1500, mdef: 1200, spd: 80, xp: 100000, gold: 50000,
            skills: [{ name: '裂地打擊', type: 'physical', multiplier: 2.2, chance: 20 }],
            drops: [{ id: 'scroll_weapon', chance: 10 }]
        }
    ]
};
// 由於檔案過長，後續怪物與 BOSS 暫略或後續補齊，此處優先恢復結構。

// ---------- BOSSES ----------
export const BOSSES = {
    talking_island: {
        id: 'wild_boar_king', name: '巨大野豬', emoji: '🐗👑', hp: 800, atk: 80, def: 40, mdef: 30, spd: 15, xp: 800, gold: 1500,
        skills: [{ name: '瘋狂衝擊', type: 'physical', multiplier: 1.5, chance: 25 }],
        drops: [{ id: 'scroll_weapon', chance: 10 }, { id: 'scroll_armor', chance: 10 }]
    },
    elven_forest: {
        id: 'dirty_elf_chief', name: '汙濁精靈長', emoji: '🧝👑', hp: 2000, atk: 150, def: 80, mdef: 100, spd: 25, xp: 3000, gold: 5000,
        skills: [{ name: '地裂術', type: 'magical', multiplier: 1.8, chance: 20 }],
        drops: [{ id: 'spirit_staff', chance: 20, isEquip: true }]
    },
    dragon_valley: {
        id: 'black_elder', name: '黑長者', emoji: '🧙‍♂️', hp: 8000, atk: 450, def: 200, mdef: 350, spd: 35, xp: 15000, gold: 25000,
        skills: [{ name: '極道落雷', type: 'magical', multiplier: 2.2, chance: 25 }],
        drops: [{ id: 'dragon_fang_blade', chance: 15, isEquip: true }]
    },
    giran_swamp: {
        id: 'giant_crocodile', name: '巨大鱷魚', emoji: '🐊👑', hp: 15000, atk: 850, def: 500, mdef: 300, spd: 40, xp: 35000, gold: 60000,
        skills: [{ name: '巨浪吞噬', type: 'physical', multiplier: 2.5, chance: 20 }],
        drops: [{ id: 'dragon_scale_vest', chance: 10, isEquip: true }]
    },
    fire_dragon_cave: {
        id: 'ifrit', name: '伊弗利特', emoji: '🌋', hp: 35000, atk: 1800, def: 1200, mdef: 1500, spd: 50, xp: 80000, gold: 150000,
        skills: [{ name: '火風暴', type: 'magical', multiplier: 2.8, chance: 25 }],
        drops: [{ id: 'scroll_weapon', chance: 30 }]
    },
    crystal_cave: {
        id: 'baphomet', name: '巴風特', emoji: '🐐', hp: 75000, atk: 3500, def: 2500, mdef: 3000, spd: 65, xp: 200000, gold: 400000,
        skills: [
            { name: '深淵之握', type: 'magical', multiplier: 2.5, chance: 20 },
            { name: '召喚骷髏部隊', type: 'buff', stat: 'atk', percent: 20, turns: 5, chance: 15 }
        ],
        drops: [{ id: 'bone_blade', chance: 20, isEquip: true }]
    },
    antharas_lair: {
        id: 'antharas', name: '地龍 安塔瑞斯', emoji: '🐉', hp: 500000, atk: 15000, def: 10000, mdef: 12000, spd: 90, xp: 1500000, gold: 5000000,
        skills: [
            { name: '毒霧噴息', type: 'magical', multiplier: 3.5, dot: { percent: 10, turns: 5 }, chance: 30 },
            { name: '巨龍甩尾', type: 'physical', multiplier: 4.0, stun: true, chance: 20 }
        ],
        drops: [{ id: 'dragon_set', chance: 100, isEquip: true }]
    }
};

// ---------- 召喚配方 (Summon Recipes) ----------
export const SUMMON_RECIPES = {
    crystal_cave: {
        ingredients: [
            { id: 'slime_gel', count: 50 },
            { id: 'goblin_ear', count: 30 }
        ]
    },
    antharas_lair: {
        ingredients: [
            { id: 'scroll_weapon', count: 5 },
            { id: 'scroll_armor', count: 10 }
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
            { type: 'kill_monster', monsterId: 'keroso', count: 5, desc: '獵殺 5 隻史萊姆' },
            { type: 'kill_monster', monsterId: 'wolf', count: 3, desc: '擊敗 3 隻狼' }
        ],
        rewards: { gold: 300, xp: 200, gems: 5 }
    },
    {
        id: 'forest_cleaning',
        chapter: '第二章',
        rewards: { gold: 600, xp: 500, gems: 10, equipment: 'bandit_cloak' }
    },
    {
        id: 'dark_forest_depths',
        chapter: '第三章',
        name: '深入深淵之林',
        objectives: [
            { type: 'kill_monster', monsterId: 'goblin', count: 15, desc: '驅逐 15 名小惡魔' },
            { type: 'kill_monster', monsterId: 'giant_spider', count: 5, desc: '擊斃 5 隻荒野狼' }
        ],
        rewards: { gold: 1200, xp: 1200, gems: 20 }
    },
    {
        id: 'mountain_ascent',
        chapter: '第四章',
        name: '攀登龍脊之巔',
        objectives: [
            { type: 'kill_monster', monsterId: 'mountain_troll', count: 8, desc: '討伐 8 隻地底巨魔' },
            { type: 'kill_monster', monsterId: 'rock_golem', count: 5, desc: '粉碎 5 具石巨人之魂' }
        ],
        rewards: { gold: 2500, xp: 3000, gems: 50 }
    },
    {
        id: 'swamp_menace',
        chapter: '第五章',
        name: '墮落之影',
        objectives: [
            { type: 'kill_monster', monsterId: 'swamp_hydra', count: 3, desc: '斬殺 3 隻墮落的九頭龍' },
            { type: 'kill_monster', monsterId: 'undead_knight', count: 10, desc: '淨化 10 名冥界騎士' }
        ],
        rewards: { gold: 5000, xp: 8000, gems: 100 }
    }
];

export const DAILY_QUEST_POOL = [
    { id: 'daily_kill_slime', type: 'kill_monster', monsterId: 'slime', count: 10, name: '清掃啫喱', rewards: { gold: 200, xp: 150 } },
    { id: 'daily_kill_goblin', type: 'kill_monster', monsterId: 'goblin', count: 8, name: '獵捕小惡魔', rewards: { gold: 400, xp: 300 } },
    { id: 'daily_win_battles', type: 'win_battle', count: 5, name: '戰之磨練', rewards: { gold: 500, xp: 400, gems: 2 } },
];
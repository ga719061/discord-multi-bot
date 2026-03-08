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
        id: 'warrior', name: '戰士', emoji: '⚔️', desc: '攻守兼備的近戰大師。',
        baseStats: { hp: 150, mp: 30, atk: 25, matk: 10, def: 20, mdef: 15, spd: 15 },
        growth: { hp: 25, mp: 5, atk: 5, matk: 2, def: 4, mdef: 3, spd: 3 },
        statConversion: { str: { atk: 1.5, hp: 2 }, vit: { hp: 8, def: 1.2 } },
        advancements: [
            { level: 30, name: '精英戰士', color: 'WHITE' },
            { level: 60, name: '戰爭大師', color: 'GOLD' },
            { level: 99, name: '不朽戰神', color: 'RED' }
        ],
        weapon: 'rusty_sword', initialSkill: 'power_slash'
    },
    ranger: {
        id: 'ranger', name: '遊俠', emoji: '🏹', desc: '遠程打擊與速度的化身。',
        baseStats: { hp: 120, mp: 40, atk: 28, matk: 10, def: 12, mdef: 12, spd: 25 },
        growth: { hp: 18, mp: 6, atk: 6, matk: 2, def: 2, mdef: 2, spd: 5 },
        statConversion: { agi: { spd: 1.2, atk: 1.0, crit: 0.1 }, luk: { crit: 0.2, crit_dmg: 0.5 } },
        advancements: [
            { level: 30, name: '巡林客', color: 'WHITE' },
            { level: 60, name: '神射手', color: 'GOLD' },
            { level: 99, name: '追風者', color: 'CYAN' }
        ],
        weapon: 'novice_bow', initialSkill: 'precise_shot'
    },
    mage: {
        id: 'mage', name: '法師', emoji: '🔮', desc: '操縱元素與奧術的高塔主人。',
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
        id: 'paladin', name: '聖騎士', emoji: '🛡️', desc: '神聖的護盾與救贖的福音。',
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
        id: 'magic_swordsman', name: '魔劍士', emoji: '✨', desc: '結合劍術與魔法的精英。',
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
    human: { id: 'human', name: '人類', emoji: '🧑', desc: '適應力極強，潛力無窮。', bonus: { all: 2 } },
    elf: { id: 'elf', name: '精靈', emoji: '🧝', desc: '自然的寵兒，精通奧術。', bonus: { int: 5, agi: 5 } },
    dwarf: { id: 'dwarf', name: '矮人', emoji: '🧔', desc: '地底的堅毅守護者。', bonus: { vit: 5, str: 5 } },
    orc: { id: 'orc', name: '獸人', emoji: '👹', desc: '咆哮的戰士，力量至上。', bonus: { str: 10 } },
    undead: { id: 'undead', name: '不死者', emoji: '💀', desc: '死亡亦非終結。', bonus: { vit: 15 } }
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
    { id: 'outskirts', name: '王國近郊', emoji: '🌲', levelReq: 1, desc: '平靜的森林邊緣，住著一些弱小的生物，適合作為新手冒險者的起點。' },
    { id: 'dark_forest', name: '黑霧森林', emoji: '🌳', levelReq: 10, desc: '被邪惡氣息籠罩的古老森林，光線陰暗，隱藏著兇猛的哥布林與巨蜘蛛。' },
    { id: 'dragon_ridge', name: '龍脊山脈', emoji: '🏔️', levelReq: 25, desc: '地勢險要的山峰，終年積雪。傳說山巔曾有巨龍棲息，怪物體格極其強壯。' },
    { id: 'dull_swamp', name: '幽暗沼澤', emoji: '🦎', levelReq: 40, desc: '毒氣瀰漫的濕地，步步危機。劇毒生物與死靈在此徘徊，令人不寒而慄。' },
    { id: 'lava_field', name: '熔岩荒原', emoji: '🌋', levelReq: 55, desc: '充滿地熱與岩漿的地獄之地，火元素與熔岩魔神佔據著這片赤紅大地。' },
    { id: 'void_rift', name: '虛空裂隙', emoji: '🌌', levelReq: 75, desc: '時間與空間交織的混亂地帶，虛空生物正虎視眈眈準備入侵。' },
    { id: 'crystal_caves', name: '水晶洞窟', emoji: '💎', levelReq: 60, desc: '奇幻的水晶礦脈，閃爍著迷人的光芒，但也隱藏著強大的元素能量。' },
    { id: 'celestial_isles', name: '天空群島', emoji: '☁️', levelReq: 70, desc: '漂浮於雲端的迷蹤群島，居住著高傲的翼人與元素生物。' },
    { id: 'ancient_sanctuary', name: '遠古神殿', emoji: '🛡️', levelReq: 85, desc: '失落的諸神遺蹟，由永恆的守護者與光之聖靈鎮守。' },
    { id: 'abyssal_core', name: '深淵核心', emoji: '👹', levelReq: 95, desc: '世界的最深處，混沌與黑暗的源頭，最終魔王所在地。' },
];

// ---------- 怪物 ----------
export const MONSTERS = {
    outskirts: [
        {
            id: 'slime', name: '史萊姆', emoji: '🟢', hp: 40, atk: 10, def: 3, mdef: 3, spd: 2, xp: 12, gold: 10, drops: [
                { id: 'slime_gel', chance: 50 },
                { id: 'slime_shield', chance: 5, isEquip: true },
                { id: 'slime_ring', chance: 2, isEquip: true },
                { id: 'swift_anklet', chance: 2, isEquip: true },
                { id: 'scroll_weapon', chance: 0.2 }, { id: 'scroll_armor', chance: 0.2 }, { id: 'scroll_accessory', chance: 0.2 },
                { id: 'slime_hat', chance: 3, isEquip: true },
                { id: 'slime_gloves', chance: 3, isEquip: true },
                { id: 'slime_weapon_1h', chance: 3, isEquip: true },
                { id: 'slime_weapon_2h', chance: 3, isEquip: true },
                { id: 'slime_body', chance: 3, isEquip: true },
                { id: 'slime_legs', chance: 3, isEquip: true },
                { id: 'slime_feet', chance: 3, isEquip: true },
            ]
        },
        {
            id: 'wild_boar', name: '野豬', emoji: '🐗', hp: 70, atk: 18, def: 8, mdef: 4, spd: 5, xp: 20, gold: 18, drops: [
                { id: 'boar_meat', chance: 50 },
                { id: 'boar_hide_vest', chance: 5, isEquip: true },
                { id: 'boar_tusk_dagger', chance: 3, isEquip: true },
                { id: 'scroll_weapon', chance: 0.2 }, { id: 'scroll_armor', chance: 0.2 }, { id: 'scroll_accessory', chance: 0.2 },
            ]
        },
        {
            id: 'bandit', name: '盜賊', emoji: '🥷', hp: 60, atk: 15, def: 6, mdef: 5, spd: 10, xp: 25, gold: 28, drops: [
                { id: 'stolen_pouch', chance: 40 },
                { id: 'bandit_cloak', chance: 4, isEquip: true },
                { id: 'thieves_dagger', chance: 3, isEquip: true },
                { id: 'forest_amulet', chance: 2, isEquip: true },
                { id: 'scroll_weapon', chance: 0.2 }, { id: 'scroll_armor', chance: 0.2 }, { id: 'scroll_accessory', chance: 0.2 },
            ]
        },
    ],
    dark_forest: [
        {
            id: 'goblin', name: '哥布林', emoji: '👺', hp: 150, atk: 32, def: 15, mdef: 8, spd: 10, xp: 38, gold: 35,
            skills: [
                { name: '重擊', type: 'physical', multiplier: 1.4, chance: 25 },
                { name: '磨刀', type: 'buff', stat: 'atk', percent: 20, turns: 2, chance: 15 }
            ],
            drops: [
                { id: 'goblin_ear', chance: 50 },
                { id: 'goblin_sword', chance: 6, isEquip: true },
                { id: 'goblin_mail', chance: 3, isEquip: true },
                { id: 'goblin_amulet', chance: 1, isEquip: true },
                { id: 'goblin_boots', chance: 3, isEquip: true },
                { id: 'book_agility_boost', chance: 0.5 },
                { id: 'scroll_weapon', chance: 0.4 }, { id: 'scroll_armor', chance: 0.4 }, { id: 'scroll_accessory', chance: 0.4 },
                { id: 'goblin_greatsword', chance: 1.5, isEquip: true },
                { id: 'goblin_helm', chance: 1.5, isEquip: true },
                { id: 'goblin_shield', chance: 1.5, isEquip: true },
                { id: 'goblin_hands', chance: 1.5, isEquip: true },
                { id: 'goblin_legs', chance: 1.5, isEquip: true },
                { id: 'goblin_feet', chance: 1.5, isEquip: true },
            ]
        },
        {
            id: 'giant_spider', name: '巨蜘蛛', emoji: '🕷️', hp: 220, atk: 45, def: 12, mdef: 12, spd: 18, xp: 52, gold: 40,
            skills: [
                { name: '毒液噴射', type: 'physical', multiplier: 1.1, dot: { percent: 5, turns: 3 }, chance: 30 },
                { name: '蜘蛛絲', type: 'debuff', stat: 'spd', percent: -30, turns: 2, chance: 20 }
            ],
            drops: [
                { id: 'spider_fang', chance: 45 },
                { id: 'spider_silk_robe', chance: 5, isEquip: true },
                { id: 'venom_dagger', chance: 2, isEquip: true },
                { id: 'spider_eye_ring', chance: 1, isEquip: true },
                { id: 'spider_amulet', chance: 2, isEquip: true },
                { id: 'scroll_weapon', chance: 0.4 }, { id: 'scroll_armor', chance: 0.4 }, { id: 'scroll_accessory', chance: 0.4 },
            ]
        }
    ],
    dragon_ridge: [
        {
            id: 'mountain_troll', name: '山丘巨魔', emoji: '👹', hp: 450, atk: 65, def: 35, mdef: 15, spd: 8, xp: 85, gold: 60,
            skills: [
                { name: '大地粉碎', type: 'physical', multiplier: 1.6, chance: 20 },
                { name: '咆哮', type: 'debuff', stat: 'atk', percent: -20, turns: 2, chance: 15 }
            ],
            drops: [
                { id: 'troll_hide', chance: 40 },
                { id: 'troll_club', chance: 4, isEquip: true },
                { id: 'spirit_staff', chance: 4, isEquip: true },
                { id: 'bark_armor', chance: 3, isEquip: true },
                { id: 'forest_pendant', chance: 1, isEquip: true },
                { id: 'bark_gloves', chance: 2, isEquip: true },
                { id: 'book_iron_skin', chance: 0.5 },
                { id: 'scroll_weapon', chance: 0.4 }, { id: 'scroll_armor', chance: 0.4 }, { id: 'scroll_accessory', chance: 0.4 },
            ]
        },
        {
            id: 'rock_golem', name: '石巨人', emoji: '🗿', hp: 600, atk: 55, def: 60, mdef: 30, spd: 5, xp: 110, gold: 75,
            skills: [
                { name: '岩石投擲', type: 'physical', multiplier: 1.3, chance: 30 },
                { name: '堅毅', type: 'buff', stat: 'def', percent: 40, turns: 3, chance: 20 }
            ],
            drops: [
                { id: 'rock_shard', chance: 45 },
                { id: 'stone_great_sword', chance: 4, isEquip: true },
                { id: 'stone_plate', chance: 3, isEquip: true },
                { id: 'earth_core_ring', chance: 0.8, isEquip: true },
                { id: 'stone_helm', chance: 2, isEquip: true },
                { id: 'stone_gauntlets', chance: 2, isEquip: true },
                { id: 'book_frost_slash', chance: 0.4 },
                { id: 'scroll_weapon', chance: 0.8 }, { id: 'scroll_armor', chance: 0.8 },
            ]
        }
    ],
    dull_swamp: [
        {
            id: 'swamp_hydra', name: '沼澤九頭蛇', emoji: '🐍', hp: 850, atk: 85, def: 45, mdef: 45, spd: 15, xp: 180, gold: 120,
            skills: [
                { name: '多重咬碎', type: 'physical', multiplier: 1.8, chance: 20 },
                { name: '腐蝕毒霧', type: 'debuff', stat: 'def', percent: -30, turns: 3, chance: 25 }
            ],
            drops: [
                { id: 'hydra_fang', chance: 30 },
                { id: 'dragon_fang_blade', chance: 3, isEquip: true },
                { id: 'dragon_scale_vest', chance: 2, isEquip: true },
                { id: 'dragon_eye_amulet', chance: 0.8, isEquip: true },
                { id: 'dragon_scale_greaves', chance: 1.5, isEquip: true },
                { id: 'book_vanguard_charge', chance: 0.4 },
                { id: 'scroll_accessory', chance: 0.8 },
                { id: 'scroll_weapon', chance: 0.6 }, { id: 'scroll_armor', chance: 0.6 },
            ]
        },
        {
            id: 'undead_knight', name: '不死騎士', emoji: '🏇', hp: 750, atk: 95, def: 55, mdef: 25, spd: 12, xp: 210, gold: 150,
            skills: [
                { name: '幽冥突刺', type: 'physical', multiplier: 1.5, lifesteal: 20, chance: 25 },
                { name: '死亡寒氣', type: 'debuff', stat: 'spd', percent: -40, turns: 2, chance: 20 }
            ],
            drops: [
                { id: 'ancient_bone', chance: 45 },
                { id: 'bone_blade', chance: 3, isEquip: true },
                { id: 'bone_shield_eq', chance: 2, isEquip: true },
                { id: 'death_ring', chance: 0.5, isEquip: true },
                { id: 'book_armor_break', chance: 0.3 },
                { id: 'book_meteor_cluster', chance: 0.4 },
                { id: 'scroll_weapon', chance: 0.8 }, { id: 'scroll_armor', chance: 0.8 },
            ]
        }
    ]
};
// 由於檔案過長，後續怪物與 BOSS 暫略或後續補齊，此處優先恢復結構。

// ---------- BOSSES ----------
export const BOSSES = {
    outskirts: { id: 'wild_boar_king', name: '野豬王', emoji: '🐗👑', hp: 500, atk: 60, def: 30, mdef: 20, spd: 15, xp: 500, gold: 1000 },
    dark_forest: { id: 'goblin_chief', name: '哥布林酋長', emoji: '👺👑', hp: 1500, atk: 120, def: 60, mdef: 40, spd: 25, xp: 2000, gold: 4000 },
    dragon_ridge: { id: 'young_dragon', name: '幼龍', emoji: '🐉', hp: 5000, atk: 300, def: 150, mdef: 150, spd: 40, xp: 10000, gold: 20000 },
};

// ---------- 召喚配方 (Summon Recipes) ----------
export const SUMMON_RECIPES = [
    { id: 'mage_summon_1', name: '召喚龍魂', cost: { mp: 50 }, result: 'dragon_spirit' }
];


// ---------- 任務系統 (Quests) ----------
export const MAIN_QUESTS = [
    {
        id: 'prologue',
        chapter: '序章',
        name: '冒險的起點',
        objectives: [
            { type: 'create_character', count: 1, desc: '踏入吉吉王國' }
        ],
        rewards: { gold: 100, xp: 50 }
    },
    {
        id: 'outskirts_exploration',
        chapter: '第一章',
        name: '森林的騷動',
        objectives: [
            { type: 'kill_monster', monsterId: 'slime', count: 5, desc: '擊敗 5 隻史萊姆' },
            { type: 'kill_monster', monsterId: 'wild_boar', count: 3, desc: '擊敗 3 隻野豬' }
        ],
        rewards: { gold: 300, xp: 200, gems: 5 }
    },
    {
        id: 'bandit_threat',
        chapter: '第二章',
        name: '平定盜賊',
        objectives: [
            { type: 'kill_monster', monsterId: 'bandit', count: 10, desc: '擊敗 10 名盜賊' }
        ],
        rewards: { gold: 600, xp: 500, gems: 10, equipment: 'bandit_cloak' }
    },
    {
        id: 'dark_forest_depths',
        chapter: '第三章',
        name: '深入黑霧',
        objectives: [
            { type: 'kill_monster', monsterId: 'goblin', count: 15, desc: '擊敗 15 隻哥布林' },
            { type: 'kill_monster', monsterId: 'giant_spider', count: 5, desc: '擊敗 5 隻巨蜘蛛' }
        ],
        rewards: { gold: 1200, xp: 1200, gems: 20 }
    },
    {
        id: 'mountain_ascent',
        chapter: '第四章',
        name: '攀登龍脊',
        objectives: [
            { type: 'kill_monster', monsterId: 'mountain_troll', count: 8, desc: '擊敗 8 隻山丘巨魔' },
            { type: 'kill_monster', monsterId: 'rock_golem', count: 5, desc: '擊敗 5 隻石巨人' }
        ],
        rewards: { gold: 2500, xp: 3000, gems: 50 }
    },
    {
        id: 'swamp_menace',
        chapter: '第五章',
        name: '沼澤之影',
        objectives: [
            { type: 'kill_monster', monsterId: 'swamp_hydra', count: 3, desc: '擊潰 3 隻沼澤九頭蛇' },
            { type: 'kill_monster', monsterId: 'undead_knight', count: 10, desc: '驅逐 10 名不死騎士' }
        ],
        rewards: { gold: 5000, xp: 8000, gems: 100 }
    }
];

export const DAILY_QUEST_POOL = [
    { id: 'daily_kill_slime', type: 'kill_monster', monsterId: 'slime', count: 10, name: '史萊姆清理', rewards: { gold: 200, xp: 150 } },
    { id: 'daily_kill_goblin', type: 'kill_monster', monsterId: 'goblin', count: 8, name: '哥布林獵人', rewards: { gold: 400, xp: 300 } },
    { id: 'daily_win_battles', type: 'win_battle', count: 5, name: '戰鬥磨練', rewards: { gold: 500, xp: 400, gems: 2 } },
];
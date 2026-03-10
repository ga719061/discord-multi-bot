// ===== RPG 道具與裝備資料 =====
import { SKILL_BOOKS, getSkillDef } from './skills.js';

export const QUALITY_MULTIPLIER = {
    common: { label: '⬜ 普通', bonus: 0, ansi: '0;37' },
    fine: { label: '🟢 精良', bonus: 0.10, ansi: '1;32' },
    rare: { label: '🔵 稀有', bonus: 0.25, ansi: '1;34' },
    epic: { label: '🟣 史詩', bonus: 0.50, ansi: '1;35' },
    mythic: { label: '🔴 神話', bonus: 0.75, ansi: '1;31' },
    legendary: { label: '🟠 傳說', bonus: 1.00, ansi: '1;33' },
};

export const EQUIP_SELL_PRICES = { common: 30, fine: 80, rare: 200, epic: 500, mythic: 1000, legendary: 1500 };

export const EQUIPMENT = {
    // ===== 起始裝備 =====
    rusty_sword: { name: '新手短劍', emoji: '🗡️', type: 'weapon_1h', quality: 'common', stats: { atk: 5 }, forClass: 'warrior' },
    short_bow: { name: '新手長弓', emoji: '🏹', type: 'weapon_2h', quality: 'common', stats: { atk: 8, spd: 4 }, forClass: 'ranger' },
    apprentice_staff: { name: '新手魔杖', emoji: '🔮', type: 'weapon_2h', quality: 'common', stats: { matk: 10 }, forClass: 'mage' },
    wooden_hammer: { name: '新手戰鎚', emoji: '🔨', type: 'weapon_1h', quality: 'common', stats: { atk: 4, def: 2 }, forClass: 'paladin' },
    // 兼容性別名 (相容舊版角色資料)
    novice_bow: { name: '新手長弓', emoji: '🏹', type: 'weapon_2h', quality: 'common', stats: { atk: 8, spd: 4 }, forClass: 'ranger' },
    novice_staff: { name: '新手魔杖', emoji: '🔮', type: 'weapon_2h', quality: 'common', stats: { matk: 10 }, forClass: 'mage' },
    rusty_mace: { name: '新手戰鎚', emoji: '🔨', type: 'weapon_1h', quality: 'common', stats: { atk: 4, def: 2 }, forClass: 'paladin' },
    apprentice_sword: { name: '新手短劍', emoji: '🗡️', type: 'weapon_1h', quality: 'common', stats: { atk: 5 }, forClass: 'magic_swordsman' },

    // ===== 王國近郊與地監淺層 (T1: 🟢精良) =====
    slime_hat: { name: '史萊姆黏液帽', emoji: '🧢', type: 'head', quality: 'common', stats: { def: 3, mdef: 2, hp: 20 }, set_id: 'slime_set' },
    slime_body: { name: '史萊姆重甲', emoji: '🥋', type: 'body', quality: 'common', stats: { def: 8, mdef: 4, hp: 40 }, set_id: 'slime_set' },
    slime_gloves: { name: '黏液手套', emoji: '🧤', type: 'hands', quality: 'common', stats: { def: 2, hp: 15 }, set_id: 'slime_set' },
    slime_legs: { name: '史萊姆腿甲', emoji: '👖', type: 'legs', quality: 'common', stats: { def: 5, spd: 2 }, set_id: 'slime_set' },
    slime_feet: { name: '史萊姆戰靴', emoji: '👢', type: 'feet', quality: 'common', stats: { def: 3, spd: 4 }, set_id: 'slime_set' },
    slime_shield: { name: '史萊姆護盾', emoji: '🛡️', type: 'shield', quality: 'common', stats: { def: 6, mdef: 2 }, set_id: 'slime_set' },
    slime_ring: { name: '黏液之戒', emoji: '💍', type: 'accessory', quality: 'fine', stats: { def: 5, hp: 30 }, set_id: 'slime_set' },
    
    boar_hide_body: { name: '野豬皮革護甲', emoji: '🥋', type: 'body', quality: 'fine', stats: { def: 12, hp: 50 }, set_id: 'boar_hide' },
    boar_hide_feet: { name: '野豬皮革靴', emoji: '👢', type: 'feet', quality: 'fine', stats: { def: 5, spd: 8 }, set_id: 'boar_hide' },
    bandit_hands: { name: '強盜護手', emoji: '🧤', type: 'hands', quality: 'fine', stats: { def: 5, atk: 8 }, set_id: 'bandit_set' },

    orcish_sword: { name: '歐西斯彎刀', emoji: '🗡️', type: 'weapon_1h', quality: 'fine', stats: { atk: 18, spd: 3 }, set_id: 'orcish_set' },
    orcish_greatsword: { name: '歐西斯大劍', emoji: '⚔️', type: 'weapon_2h', quality: 'fine', stats: { atk: 35, spd: -1 }, set_id: 'orcish_set' },
    orcish_mail: { name: '歐西斯鏈甲', emoji: '⛓️', type: 'body', quality: 'fine', stats: { def: 22, mdef: 8 }, set_id: 'orcish_set' },
    orcish_helm: { name: '歐西斯頭盔', emoji: '⛑️', type: 'head', quality: 'fine', stats: { def: 8, hp: 25 }, set_id: 'orcish_set' },
    orcish_hands: { name: '歐西斯護手', emoji: '🧤', type: 'hands', quality: 'fine', stats: { def: 6, atk: 5 }, set_id: 'orcish_set' },
    orcish_feet: { name: '歐西斯戰靴', emoji: '👢', type: 'feet', quality: 'fine', stats: { def: 6, spd: 5 }, set_id: 'orcish_set' },
    orcish_shield: { name: '歐西斯之盾', emoji: '🛡️', type: 'shield', quality: 'fine', stats: { def: 15, mdef: 5 }, set_id: 'orcish_set' },
    orcish_amulet: { name: '歐西斯護符', emoji: '📿', type: 'accessory', quality: 'rare', stats: { def: 10, mdef: 10, hp: 60 }, set_id: 'orcish_set' },

    // ===== 荒野與中層區域 (T2: 🔵稀有) =====
    bark_body: { name: '樹皮護甲', emoji: '🧥', type: 'body', quality: 'fine', stats: { def: 25, mdef: 15 }, set_id: 'bark_set' },
    bark_shield: { name: '樹皮大盾', emoji: '🛡️', type: 'shield', quality: 'fine', stats: { def: 20, mdef: 10 }, set_id: 'bark_set' },
    forest_weapon_2h: { name: '精靈森林之弓', emoji: '🏹', type: 'weapon_2h', quality: 'fine', stats: { atk: 45, spd: 8 }, set_id: 'forest_set' },
    forest_body: { name: '精靈森林長袍', emoji: '🧥', type: 'body', quality: 'fine', stats: { def: 15, mdef: 35 }, set_id: 'forest_set' },
    spider_silk_body: { name: '蛛絲長袍', emoji: '🧥', type: 'body', quality: 'fine', stats: { def: 20, mdef: 40 }, set_id: 'spider_silk' },
    spider_silk_hands: { name: '蛛絲手套', emoji: '🧤', type: 'hands', quality: 'fine', stats: { def: 8, matk: 15 }, set_id: 'spider_silk' },

    stone_sword: { name: '堅石單手劍', emoji: '🗡️', type: 'weapon_1h', quality: 'fine', stats: { atk: 35, def: 10 }, set_id: 'stone_set' },
    stone_great_sword: { name: '巨岩大劍', emoji: '⚔️', type: 'weapon_2h', quality: 'rare', stats: { atk: 65, def: 20 }, set_id: 'stone_set' },
    stone_plate: { name: '岩石板甲', emoji: '🛡️', type: 'body', quality: 'rare', stats: { def: 65, mdef: 25, hp: 200 }, set_id: 'stone_set' },
    stone_body: { name: '堅石鎧甲', emoji: '🛡️', type: 'body', quality: 'fine', stats: { def: 55, hp: 150 }, set_id: 'stone_set' },
    stone_helm: { name: '堅石頭盔', emoji: '⛑️', type: 'head', quality: 'fine', stats: { def: 25, hp: 100 }, set_id: 'stone_set' },
    stone_shield: { name: '巨岩大盾', emoji: '🛡️', type: 'shield', quality: 'rare', stats: { def: 55, mdef: 30 }, set_id: 'stone_set' },
    
    spirit_staff: { name: '精靈之杖', emoji: '🔮', type: 'weapon_2h', quality: 'fine', stats: { matk: 45, mp: 60 } },
    wisdom_boots: { name: '智力長靴', emoji: '獲得', type: 'feet', quality: 'fine', stats: { mdef: 15, spd: 10, mp: 30 } },
    caspa_cap: { name: '卡司柏帽子', emoji: '🎩', type: 'head', quality: 'fine', stats: { matk: 25, mp: 80 } },
    
    dragon_head: { name: '龍鱗頭盔', emoji: '⛑️', type: 'head', quality: 'rare', stats: { def: 35, hp: 120 }, set_id: 'dragon_set' },
    dragon_body: { name: '龍鱗鎧甲', emoji: '🛡️', type: 'body', quality: 'rare', stats: { def: 85, mdef: 45, hp: 300 }, set_id: 'dragon_set' },
    dragon_hands: { name: '龍鱗護手', emoji: '🧤', type: 'hands', quality: 'rare', stats: { def: 25, atk: 20 }, set_id: 'dragon_set' },
    dragon_scale_vest: { name: '龍鱗輕甲', emoji: '🥋', type: 'body', quality: 'rare', stats: { def: 45, mdef: 35, spd: 12 }, set_id: 'dragon_set' },
    dragon_scale_greaves: { name: '龍鱗護腿', emoji: '👖', type: 'legs', quality: 'rare', stats: { def: 30, mdef: 25 }, set_id: 'dragon_set' },
    dragon_scale_boots: { name: '龍鱗戰靴', emoji: '👢', type: 'feet', quality: 'rare', stats: { def: 25, mdef: 20, spd: 15 }, set_id: 'dragon_set' },
    dragon_fang_blade: { name: '龍牙單刃', emoji: '🗡️', type: 'weapon_1h', quality: 'rare', stats: { atk: 68, spd: 12 }, set_id: 'dragon_set' },
    dragon_eye_amulet: { name: '龍眼護符', emoji: '📿', type: 'accessory', quality: 'epic', stats: { atk: 35, matk: 35, spd: 15, hp: 150 }, set_id: 'dragon_set' },

    // ===== 幽暗沼澤 & 地監深層 (T3: 🔵稀有 ~ 🟣史詩) =====
    bone_head: { name: '骸骨頭盔', emoji: '💀', type: 'head', quality: 'rare', stats: { def: 25, spd: 5 }, set_id: 'bone_set' },
    bone_body: { name: '骸骨胸甲', emoji: '🦴', type: 'body', quality: 'rare', stats: { def: 75, hp: 200 }, set_id: 'bone_set' },
    bone_hands: { name: '骸骨護手', emoji: '🧤', type: 'hands', quality: 'rare', stats: { def: 15, atk: 15 }, set_id: 'bone_set' },
    bone_legs: { name: '骸骨護腿', emoji: '👖', type: 'legs', quality: 'rare', stats: { def: 35, hp: 100 }, set_id: 'bone_set' },
    bone_feet: { name: '骸骨戰靴', emoji: '👢', type: 'feet', quality: 'rare', stats: { def: 20, spd: 10 }, set_id: 'bone_set' },
    bone_great_sword: { name: '骸骨大劍', emoji: '⚔️', type: 'weapon_2h', quality: 'rare', stats: { atk: 110, lifesteal: 5 }, set_id: 'bone_set' },
    bone_mask: { name: '骸骨面具', emoji: '💀', type: 'head', quality: 'rare', stats: { def: 25, spd: 8 }, set_id: 'bone_set' },
    bone_chest: { name: '骸骨胸甲', emoji: '🦴', type: 'body', quality: 'rare', stats: { def: 75, hp: 200 }, set_id: 'bone_set' },
    bone_shield: { name: '骸骨之盾', emoji: '🛡️', type: 'shield', quality: 'rare', stats: { def: 55, mdef: 15 }, set_id: 'bone_set' },
    
    abyss_dagger: { name: '深淵匕首', emoji: '🗡️', type: 'weapon_1h', quality: 'rare', stats: { atk: 85, spd: 20 }, set_id: 'abyss_master_set' },
    abyss_robe: { name: '深淵長袍', emoji: '🧥', type: 'body', quality: 'rare', stats: { def: 45, mdef: 85, mp: 300 }, set_id: 'abyss_master_set' },
    abyss_gloves: { name: '深淵絲絨手套', emoji: '🧤', type: 'hands', quality: 'rare', stats: { def: 20, matk: 45, mp: 150 }, set_id: 'abyss_master_set' },
    abyss_boots: { name: '深淵行者編織靴', emoji: '👢', type: 'feet', quality: 'rare', stats: { def: 22, spd: 30, mp: 80 }, set_id: 'abyss_master_set' },
    abyss_ring: { name: '深淵印戒', emoji: '💍', type: 'accessory', quality: 'epic', stats: { matk: 65, spd: 15, mp: 200 }, set_id: 'abyss_master_set' },
    
    baphomet_staff: { name: '巴風特魔杖', emoji: '👿', type: 'weapon_2h', quality: 'epic', stats: { matk: 155, mp: 250 }, set_id: 'baphomet_set' },
    baphomet_armor: { name: '巴風特板甲', emoji: '🛡️', type: 'body', quality: 'epic', stats: { def: 115, mdef: 65, hp: 600 }, set_id: 'baphomet_set' },
    baphomet_amulet: { name: '巴風特之眼', emoji: '📿', type: 'accessory', quality: 'epic', stats: { matk: 75, mp: 150, hp: 200 }, set_id: 'baphomet_set' },

    void_robe: { name: '虛空長袍', emoji: '🧥', type: 'body', quality: 'rare', stats: { def: 50, mdef: 100, mp: 400 }, set_id: 'void_set' },
    void_boots: { name: '虛空戰靴', emoji: '👢', type: 'feet', quality: 'rare', stats: { def: 30, spd: 40 }, set_id: 'void_set' },

    fire_lord_weapon_2h: { name: '火焰領主巨劍', emoji: '🔥', type: 'weapon_2h', quality: 'epic', stats: { atk: 150, matk: 100 }, set_id: 'fire_lord_set' },
    // ===== 最終傳說區域 (T4: 🟣史詩 ~ 🟠傳說) =====
    chaos_blade: { name: '混沌單刃', emoji: '🔪', type: 'weapon_1h', quality: 'epic', stats: { atk: 145, matk: 145 }, set_id: 'chaos_set' },
    chaos_great_sword: { name: '混沌大劍', emoji: '🗡️', type: 'weapon_2h', quality: 'epic', stats: { atk: 280 }, set_id: 'chaos_set' },
    chaos_mail: { name: '混沌鏈甲', emoji: '⛓️', type: 'body', quality: 'epic', stats: { def: 135, mdef: 85, hp: 800 }, set_id: 'chaos_set' },
    chaos_helm: { name: '混沌之容', emoji: '🎭', type: 'head', quality: 'epic', stats: { def: 65, hp: 300 }, set_id: 'chaos_set' },
    chaos_ring: { name: '混沌印記', emoji: '💍', type: 'accessory', quality: 'legendary', stats: { atk: 100, matk: 100, hp: 500, spd: 30 }, set_id: 'chaos_set' },

    dk_flame_blade: { name: '死亡騎士之焚身劍', emoji: '🔥', type: 'weapon_2h', quality: 'legendary', stats: { atk: 350, hp: 800 }, set_id: 'dk_set' },
    dk_helmet: { name: '死亡騎士頭盔', emoji: '💀', type: 'head', quality: 'legendary', stats: { def: 85, mdef: 65, hp: 500 }, set_id: 'dk_set' },
    dk_armor: { name: '死亡騎士鎧甲', emoji: '🛡️', type: 'body', quality: 'legendary', stats: { def: 220, mdef: 120, hp: 2000 }, set_id: 'dk_set' },
    dk_gloves: { name: '死亡騎士護手', emoji: '🧤', type: 'hands', quality: 'legendary', stats: { def: 75, atk: 75, hp: 500 }, set_id: 'dk_set' },
    dk_boots: { name: '死亡騎士長靴', emoji: '👢', type: 'feet', quality: 'legendary', stats: { def: 75, spd: 45, hp: 500 }, set_id: 'dk_set' },
    
    overlord_armor: { name: '霸王重鎧', emoji: '🛡️', type: 'body', quality: 'legendary', stats: { def: 280, hp: 3000 }, set_id: 'overlord_plate' },
    sage_cosmic_robe: { name: '星辰宇宙長袍', emoji: '🧥', type: 'body', quality: 'legendary', stats: { mdef: 250, mp: 1000, matk: 150 }, set_id: 'elemental_sage' },

    dragonslayer: { name: '屠龍者巨劍', emoji: '🗡️', type: 'weapon_2h', quality: 'legendary', stats: { atk: 550, penetration_pct: 50, hp: 2500 } },
    antharas_plate: { name: '地龍之鱗甲', emoji: '🐉', type: 'body', quality: 'legendary', stats: { def: 380, mdef: 250, hp: 5000 } },
    invisi_cloak: { name: '隱身斗篷', emoji: '🧥', type: 'body', quality: 'legendary', stats: { def: 80, mdef: 400, spd: 100 } },

    // ===== Boss 掉落 (🟣史詩 ~ 🟠傳說) =====
    boar_king_helm: { name: '野豬王頭盔', emoji: '⛑️', type: 'head', quality: 'rare', stats: { def: 20, hp: 50 } },
    orcish_crown: { name: '歐西斯王冠', emoji: '👑', type: 'head', quality: 'epic', stats: { atk: 25, matk: 25, spd: 8 } },
    dragon_scale_armor: { name: '龍鱗甲', emoji: '🛡️', type: 'body', quality: 'epic', stats: { def: 85, mdef: 65, hp: 250 }, set_id: 'dragon_set' },
    bone_lord_staff: { name: '骸骨領主法杖', emoji: '🦴', type: 'weapon_2h', quality: 'epic', stats: { matk: 110, mp: 120 } },
    lava_dragon_core: { name: '熔岩龍核', emoji: '🌋', type: 'accessory', quality: 'legendary', stats: { atk: 60, matk: 60, hp: 400 } },
    void_lord_mantle: { name: '虛空之主披風', emoji: '🌌', type: 'body', quality: 'legendary', stats: { def: 110, mdef: 180, spd: 40, mp: 500, matk: 80 } },
    jiji_crown: { name: '吉吉王冠', emoji: '👑', type: 'head', quality: 'legendary', stats: { atk: 50, matk: 50, def: 50, mdef: 50, hp: 400, mp: 400 } },

    // ===== 🟠 傳說 Boss 限定掉落 (超低機率夢幻逸品) =====
    boar_king_axe: { name: '野豬王裂地巨斧', emoji: '🪓', type: 'weapon_2h', quality: 'legendary', stats: { atk: 220, def: 50, hp: 400 } },
    orcish_king_blade: { name: '歐西斯王死牙', emoji: '🗡️', type: 'weapon_1h', quality: 'legendary', stats: { atk: 180, spd: 30, hp: 200 } },
    volcanic_greatsword: { name: '火山大劍', emoji: '🔥', type: 'weapon_2h', quality: 'legendary', stats: { atk: 450, def: 50, hp: 1000 } },
    void_emperor_blade: { name: '虛空帝王單刃', emoji: '🌀', type: 'weapon_1h', quality: 'legendary', stats: { atk: 220, matk: 150, spd: 40 } },
    emperor_crown: { name: '水晶帝冠', emoji: '👑', type: 'head', quality: 'legendary', stats: { matk: 110, def: 60, mdef: 100, hp: 500, mp: 500 } },
    jiji_chaos_crown: { name: '「混沌」吉吉王冠', emoji: '👑', type: 'head', quality: 'legendary', stats: { atk: 888, matk: 888, def: 888, mdef: 888, hp: 8888, mp: 8888 } },
    
    // ===== 商店基本裝備 =====
    steel_sword: { name: '鋼鐵單手劍', emoji: '🗡️', type: 'weapon_1h', quality: 'common', stats: { atk: 10 } },
    hunter_bow: { name: '獵人之弓', emoji: '🏹', type: 'weapon_2h', quality: 'common', stats: { atk: 15, spd: 3 } },
    magic_staff: { name: '魔導法杖', emoji: '🔮', type: 'weapon_2h', quality: 'common', stats: { matk: 22 } },
    war_hammer: { name: '戰錘', emoji: '🗡️', type: 'weapon_1h', quality: 'common', stats: { atk: 8, def: 5 } },
    knight_sword: { name: '騎士單手劍', emoji: '🗡️', type: 'weapon_1h', quality: 'common', stats: { atk: 16, def: 3 } },
    composite_bow: { name: '複合大弓', emoji: '🏹', type: 'weapon_2h', quality: 'common', stats: { atk: 28, spd: 5 } },

    // 防具
    leather_armor: { name: '皮革護甲', emoji: '🥋', type: 'body', quality: 'common', stats: { def: 6, mdef: 2 } },
    iron_helm: { name: '鐵製頭盔', emoji: '⛑️', type: 'head', quality: 'common', stats: { def: 4 } },
    chain_mail: { name: '鎖子甲', emoji: '⛓️', type: 'body', quality: 'common', stats: { def: 12, mdef: 3, spd: -1 } },
    mage_robe: { name: '法師長袍', emoji: '🧥', type: 'body', quality: 'common', stats: { def: 3, mdef: 10, mp: 15 } },
    iron_plate: { name: '鐵板甲', emoji: '🛡️', type: 'body', quality: 'common', stats: { def: 16, mdef: 4, spd: -2 } },
    
    // ===== 飾品與腰帶 (Accessories & Belts) =====
    // 戒指
    copper_ring: { name: '銅戒指', emoji: '💍', type: 'accessory', quality: 'common', stats: { atk: 2, def: 2 } },
    spirit_ring: { name: '抗魔戒指', emoji: '💍', type: 'accessory', quality: 'fine', stats: { mdef: 25 } },

    // 項鍊
    necklace_str: { name: '力量項鍊', emoji: '📿', type: 'accessory', quality: 'rare', stats: { atk: 15 } },
    necklace_dex: { name: '敏捷項鍊', emoji: '📿', type: 'accessory', quality: 'rare', stats: { spd: 12 } },
    necklace_int: { name: '智力項鍊', emoji: '📿', type: 'accessory', quality: 'rare', stats: { matk: 15 } },
    health_charm: { name: '生命符咒', emoji: '📿', type: 'accessory', quality: 'common', stats: { hp: 25 } },

    // 耳環
    earring_protection: { name: '守護耳環', emoji: '💎', type: 'accessory', quality: 'fine', stats: { def: 10 } },
    earring_wisdom: { name: '睿智耳環', emoji: '💎', type: 'accessory', quality: 'fine', stats: { mp: 50 } },

    // 腰帶
    leather_belt: { name: '皮革腰帶', emoji: 'ベルト', type: 'accessory', quality: 'common', stats: { def: 3 } },
    ogre_belt: { name: '食人魔腰帶', emoji: 'ベルト', type: 'accessory', quality: 'rare', stats: { hp: 150, atk: 8 } },
    belt_of_mind: { name: '靈魂腰帶', emoji: 'ベルト', type: 'accessory', quality: 'rare', stats: { mp: 100, matk: 8 } },

    // 其他
    speed_boots: { name: '疾風靴', emoji: '👢', type: 'feet', quality: 'common', stats: { spd: 5 } },
};

export const SHOP_ITEMS = {
    consumables: [
        { id: 'hp_potion_s', name: '紅色藥水', emoji: '🧪', price: 30, effect: { type: 'heal_hp', percent: 30 }, desc: '回復 30% HP' },
        { id: 'hp_potion_m', name: '橙色藥水', emoji: '🧪', price: 100, effect: { type: 'heal_hp', percent: 60 }, desc: '回復 60% HP' },
        { id: 'hp_potion_l', name: '白色藥水', emoji: '🧪', price: 280, effect: { type: 'heal_hp', percent: 100 }, desc: '回復 100% HP' },
        { id: 'mp_potion', name: '藍色藥水', emoji: '💙', price: 60, effect: { type: 'heal_mp', percent: 50 }, desc: '回復 50% MP' },
        { id: 'smoke_bomb', name: '歸還卷軸', emoji: '🪶', price: 80, effect: { type: 'escape' }, desc: '戰鬥中 100% 傳送回安全區' },
        { id: 'teleport_scroll', name: '傳送符印', emoji: '📜', price: 150, effect: { type: 'teleport' }, desc: '標記並傳送回王都' },
        { id: 'revive_scroll', name: '復活卷軸', emoji: '💀', price: 400, effect: { type: 'revive', percent: 30 }, desc: '復活隊友至 30% HP' },
    ],
    weapons: [
        { id: 'steel_sword', name: '鋼鐵單手劍', emoji: '🗡️', price: 200, type: 'weapon_1h', quality: 'common', stats: { atk: 10 }, desc: '單手 ATK+10' },
        { id: 'hunter_bow', name: '獵人之弓', emoji: '🏹', price: 200, type: 'weapon_2h', quality: 'common', stats: { atk: 15, spd: 3 }, desc: '雙手 ATK+15 SPD+3' },
        { id: 'magic_staff', name: '魔導法杖', emoji: '🔮', price: 200, type: 'weapon_2h', quality: 'common', stats: { matk: 22 }, desc: '雙手 MATK+22' },
        { id: 'war_hammer', name: '戰錘', emoji: '🗡️', price: 200, type: 'weapon_1h', quality: 'common', stats: { atk: 8, def: 5 }, desc: '單手 ATK+8 DEF+5' },
        { id: 'knight_sword', name: '騎士單手劍', emoji: '🗡️', price: 550, type: 'weapon_1h', quality: 'common', stats: { atk: 16, def: 3 }, desc: '單手 ATK+16 DEF+3' },
        { id: 'composite_bow', name: '複合大弓', emoji: '🏹', price: 550, type: 'weapon_2h', quality: 'common', stats: { atk: 28, spd: 5 }, desc: '雙手 ATK+28 SPD+5' },
    ],
    armors: [
        { id: 'leather_armor', name: '皮革護甲', emoji: '🥋', price: 180, type: 'body', quality: 'common', stats: { def: 6, mdef: 2 }, desc: '身體 DEF+6 MDEF+2' },
        { id: 'iron_helm', name: '鐵製頭盔', emoji: '⛑️', price: 180, type: 'head', quality: 'common', stats: { def: 4 }, desc: '頭部 DEF+4' },
        { id: 'chain_mail', name: '鎖子甲', emoji: '⛓️', price: 450, type: 'body', quality: 'common', stats: { def: 12, mdef: 3, spd: -1 }, desc: '身體 DEF+12 MDEF+3 SPD-1' },
        { id: 'mage_robe', name: '法師長袍', emoji: '🧥', price: 300, type: 'body', quality: 'common', stats: { def: 3, mdef: 10, mp: 15 }, desc: '身體 DEF+3 MDEF+10 MP+15' },
        { id: 'iron_plate', name: '鐵板甲', emoji: '🛡️', price: 650, type: 'body', quality: 'common', stats: { def: 16, mdef: 4, spd: -2 }, desc: '身體 DEF+16 MDEF+4 SPD-2' },
    ],
    accessories: [
        { id: 'copper_ring', name: '銅戒指', emoji: '💍', price: 150, type: 'accessory', quality: 'common', stats: { atk: 2, def: 2 }, desc: '飾品 ATK+2 DEF+2' },
        { id: 'health_charm', name: '生命符咒', emoji: '📿', price: 250, type: 'accessory', quality: 'common', stats: { hp: 25 }, desc: '飾品 HP+25' },
        { id: 'speed_boots', name: '疾風靴', emoji: '👢', price: 350, type: 'feet', quality: 'common', stats: { spd: 5 }, desc: '足部 SPD+5' },
    ],
    skillbooks: [
        { id: 'book_power_slash', name: '強力斬擊 技能書', emoji: '📖', price: 300, type: 'book', quality: 'common', desc: '戰士基礎技能：強力斬擊' },
        { id: 'book_iron_skin', name: '鋼鐵護體 技能書', emoji: '📖', price: 600, type: 'book', quality: 'fine', desc: '戰士防禦技能：鋼鐵護體' },
        { id: 'book_precise_shot', name: '精準目標 技能書', emoji: '📖', price: 300, type: 'book', quality: 'common', desc: '遊俠基礎技能：精準目標' },
        { id: 'book_agility_boost', name: '風之疾走 技能書', emoji: '📖', price: 600, type: 'book', quality: 'fine', desc: '遊俠加速技能：風之疾走' },
        { id: 'book_fireball', name: '火球 技能書', emoji: '📖', price: 300, type: 'book', quality: 'common', desc: '法師基礎技能：火球' },
        { id: 'book_mana_surge', name: '魔力增幅 技能書', emoji: '📖', price: 600, type: 'book', quality: 'fine', desc: '法師增益技能：魔力增幅' },
        { id: 'book_holy_strike', name: '聖威一擊 技能書', emoji: '📖', price: 300, type: 'book', quality: 'common', desc: '聖騎士基礎技能：聖威一擊' },
        { id: 'book_divine_heal', name: '神聖治癒 技能書', emoji: '📖', price: 600, type: 'book', quality: 'fine', desc: '聖騎士回血技能：神聖治癒' },
        { id: 'book_magic_blade', name: '魔力奪取 技能書', emoji: '📖', price: 300, type: 'book', quality: 'common', desc: '魔劍士基礎技能：魔力奪取' },
        { id: 'book_flame_enchant', name: '燃燒鬥志 技能書', emoji: '📖', price: 600, type: 'book', quality: 'fine', desc: '魔劍士屬性技能：燃燒鬥志' },
    ],
};

export const ITEM_NAMES = {
    // ===== BOSS 稀有素材 =====
    orc_king_heart: { name: '妖魔王之心', emoji: '❤️', sellPrice: 150 },
    baphomet_soul: { name: '巴風特靈魂石', emoji: '💎', sellPrice: 1500 },
    dk_heart: { name: '死亡騎士之心', emoji: '🖤', sellPrice: 2000 },
    caspa_cap_shard: { name: '卡司柏的紅寶石碎片', emoji: '🔻', sellPrice: 500 },
    golden_key: { name: '黃金鑰匙', emoji: '🔑', sellPrice: 3000 },
    invis_cloak_frag: { name: '隱身斗篷碎片', emoji: '🧥', sellPrice: 5000 },

    // ===== 區域通用素材 =====
    slime_gel: { name: '黏液凝膠', emoji: '🟢', sellPrice: 4 },
    werewolf_paw: { name: '狼人的腳爪', emoji: '🐾', sellPrice: 10 },
    stolen_pouch: { name: '戰敗者的包裹', emoji: '💰', sellPrice: 12 },
    spirit_wood: { name: '精靈木', emoji: '🌳', sellPrice: 16 },
    arachne_web: { name: '芮克妮的網', emoji: '🕸️', sellPrice: 20 },
    fungus_spore: { name: '蘑菇孢子', emoji: '🍄', sellPrice: 15 },
    ancient_bone: { name: '冥界骨骸', emoji: '🦴', sellPrice: 42 },
    dragon_scale_mat: { name: '龍鱗素材', emoji: '🐲', sellPrice: 150 },
    black_elder_bead: { name: '黑長者的念珠', emoji: '📿', sellPrice: 300 },
    fire_core: { name: '火焰核心', emoji: '🔥', sellPrice: 200 },
    lava_heart: { name: '熔岩之心', emoji: '❤️‍🔥', sellPrice: 350 },
    earth_dragon_scale: { name: '地龍之鱗', emoji: '🐉', sellPrice: 1000 },

    // ===== 強化卷軸 (Lineage Style) =====
    scroll_weapon: { name: '對武器施法的卷軸', emoji: '📜', sellPrice: 500 },
    scroll_armor: { name: '對防具施法的卷軸', emoji: '📜', sellPrice: 300 },
    scroll_accessory: { name: '對飾品施法的卷軸', emoji: '📜', sellPrice: 200 },

    // ===== 消耗品與其他 =====
    hp_potion_s: { name: '紅色藥水', emoji: '🧪', sellPrice: 15 },
    hp_potion_m: { name: '橙色藥水', emoji: '🧪', sellPrice: 50 },
    hp_potion_l: { name: '白色藥水', emoji: '🧪', sellPrice: 140 },
    mp_potion: { name: '藍色藥水', emoji: '💙', sellPrice: 80 },
    brave_potion: { name: '勇敢藥水', emoji: '🍺', sellPrice: 200 },
    smoke_bomb: { name: '歸還卷軸', emoji: '🪶', sellPrice: 40 },
    teleport_scroll: { name: '傳送符印', emoji: '📜', sellPrice: 75 },
    revive_scroll: { name: '復活卷軸', emoji: '💀', sellPrice: 200 },

    // ===== 技能書 (全 55 種) =====
    // Warrior
    book_power_slash: { name: '強力斬擊 技能書', emoji: '📖', sellPrice: 150 },
    book_iron_skin: { name: '鋼鐵護體 技能書', emoji: '📖', sellPrice: 200 },
    book_sweep: { name: '衝擊波 技能書', emoji: '📖', sellPrice: 200 },
    book_whirlwind: { name: '旋風斬 技能書', emoji: '📖', sellPrice: 300 },
    book_vanguard_charge: { name: '衝鋒 技能書', emoji: '📖', sellPrice: 300 },
    book_unyielding: { name: '不屈 技能書', emoji: '📖', sellPrice: 400 },
    book_armor_break: { name: '破甲 技能書', emoji: '📖', sellPrice: 500 },
    book_tyrant_slash: { name: '致命打擊 技能書', emoji: '📖', sellPrice: 800 },
    book_war_god_roar: { name: '戰神咆哮 技能書', emoji: '📖', sellPrice: 800 },
    book_earth_shatter: { name: '大地屏障 技能書', emoji: '📖', sellPrice: 1200 },
    book_world_slash: { name: '審判之光 技能書', emoji: '📖', sellPrice: 2500 },

    // Ranger
    book_precise_shot: { name: '精準目標 技能書', emoji: '📖', sellPrice: 150 },
    book_agility_boost: { name: '風之疾走 技能書', emoji: '📖', sellPrice: 200 },
    book_trap_set: { name: '束縛術 技能書', emoji: '📖', sellPrice: 200 },
    book_rapid_fire: { name: '三重矢 技能書', emoji: '📖', sellPrice: 300 },
    book_toxic_arrow: { name: '劇毒之箭 技能書', emoji: '📖', sellPrice: 300 },
    book_weakness_scan: { name: '暴擊率提升 技能書', emoji: '📖', sellPrice: 400 },
    book_shadow_step: { name: '暗影腳步 技能書', emoji: '📖', sellPrice: 500 },
    book_heart_pierce: { name: '貫穿勇氣 技能書', emoji: '📖', sellPrice: 800 },
    book_spirit_eye: { name: '精靈之眼 技能書', emoji: '📖', sellPrice: 800 },
    book_arrow_storm: { name: '亂箭陣 技能書', emoji: '📖', sellPrice: 1200 },
    book_pierce_realm: { name: '破天一箭 技能書', emoji: '📖', sellPrice: 2500 },

    // Mage
    book_fireball: { name: '火球 技能書', emoji: '📖', sellPrice: 150 },
    book_mana_surge: { name: '魔力增幅 技能書', emoji: '📖', sellPrice: 200 },
    book_frost_nova: { name: '極道落雷 技能書', emoji: '📖', sellPrice: 200 },
    book_summon_contract: { name: '召喚：巨龍契約 技能書', emoji: '📖', sellPrice: 300 },
    book_meteor_cluster: { name: '落星 技能書', emoji: '📖', sellPrice: 400 },
    book_chain_lightning: { name: '雷鳴連鎖 技能書', emoji: '📖', sellPrice: 400 },
    book_arcane_shield: { name: '魔法防禦 技能書', emoji: '📖', sellPrice: 500 },
    book_void_collapse: { name: '虛空風暴 技能書', emoji: '📖', sellPrice: 800 },
    book_space_rhythm: { name: '時光加速 技能書', emoji: '📖', sellPrice: 800 },
    book_starfall: { name: '流星雨 技能書', emoji: '📖', sellPrice: 1200 },
    book_dimension_annihilation: { name: '究極毀滅 技能書', emoji: '📖', sellPrice: 2500 },

    // Paladin
    book_holy_strike: { name: '聖威一擊 技能書', emoji: '📖', sellPrice: 150 },
    book_divine_heal: { name: '神聖治癒 技能書', emoji: '📖', sellPrice: 150 },
    book_guardian_vow: { name: '守護誓約 技能書', emoji: '📖', sellPrice: 300 },
    book_retribution: { name: '審判之盾 技能書', emoji: '📖', sellPrice: 500 },
    book_divine_barrier: { name: '聖光加持 技能書', emoji: '📖', sellPrice: 300 },
    book_life_guard: { name: '大地的祝福 技能書', emoji: '📖', sellPrice: 800 },
    book_consecration: { name: '靈魂昇華 技能書', emoji: '📖', sellPrice: 250 },
    book_condemnation: { name: '定罪 技能書', emoji: '📖', sellPrice: 500 },
    book_absolute_guard: { name: '絕對防禦 技能書', emoji: '📖', sellPrice: 800 },
    book_divine_field: { name: '至高神域 技能書', emoji: '📖', sellPrice: 1200 },
    book_divine_dawn: { name: '究極治癒 技能書', emoji: '📖', sellPrice: 2500 },

    // Magic Swordsman
    book_magic_blade: { name: '魔力奪取 技能書', emoji: '📖', sellPrice: 150 },
    book_flame_enchant: { name: '燃燒鬥志 技能書', emoji: '📖', sellPrice: 150 },
    book_frost_slash: { name: '極道落雷 技能書', emoji: '📖', sellPrice: 300 },
    book_thunder_strike: { name: '雷廷一擊 技能書', emoji: '📖', sellPrice: 500 },
    book_elemental_burst: { name: '元素迸發 技能書', emoji: '📖', sellPrice: 300 },
    book_aether_flare: { name: '乙太閃耀 技能書', emoji: '📖', sellPrice: 800 },
    book_void_crack: { name: '時空裂痕 技能書', emoji: '📖', sellPrice: 250 },
    book_elemental_overload: { name: '元素超載 技能書', emoji: '📖', sellPrice: 500 },
    book_elem_enchant: { name: '屬性附體 技能書', emoji: '📖', sellPrice: 800 },
    book_mana_storm: { name: '魔力風暴 技能書', emoji: '📖', sellPrice: 1200 },
    book_chaos_unison: { name: '萬象無間 技能書', emoji: '📖', sellPrice: 2500 },
};

export const EQUIP_SELL_PRICES_QUALITY = { common: 30, fine: 80, rare: 200, epic: 500, mythic: 1000, legendary: 1500 };

export function getItemDisplayName(itemId) {
    if (ITEM_NAMES[itemId]) return `${ITEM_NAMES[itemId].emoji} ${ITEM_NAMES[itemId].name}`;
    if (EQUIPMENT[itemId]) return `${EQUIPMENT[itemId].emoji} ${EQUIPMENT[itemId].name}`;
    
    // Check shop items
    for (const category in SHOP_ITEMS) {
        const item = SHOP_ITEMS[category].find(i => i.id === itemId);
        if (item) return `${item.emoji} ${item.name}`;
    }

    if (itemId.startsWith('book_')) {
        const book = SKILL_BOOKS[itemId];
        if (book) {
            const skill = getSkillDef(book.skillId);
            return `📖 ${skill ? skill.name : itemId} 技能書`;
        }
    }
    return `📦 ${itemId}`;
}

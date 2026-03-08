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
    wooden_shield: { name: '新手木盾', emoji: '🛡️', type: 'shield', quality: 'common', stats: { def: 3, mdef: 1 }, forClass: 'paladin' },

    // ===== 王國近郊掉落 (⬜普通 ~ 🟢精良) =====
    slime_hat: { name: '史萊姆黏液帽', emoji: '🧢', type: 'head', quality: 'common', stats: { def: 2, mdef: 1, hp: 10 }, set_id: 'slime_set' },
    boar_hide_vest: { name: '野豬皮背心', emoji: '🥋', type: 'body', quality: 'common', stats: { def: 5, spd: 1 } },
    slime_gloves: { name: '黏液手套', emoji: '🧤', type: 'hands', quality: 'common', stats: { def: 1, hp: 5 }, set_id: 'slime_set' },
    boar_hide_pants: { name: '皮靴', emoji: '👖', type: 'legs', quality: 'common', stats: { def: 3, spd: 1 } },
    bandit_boots: { name: '盜賊皮靴', emoji: '👢', type: 'feet', quality: 'common', stats: { def: 2, spd: 3 } },
    slime_shield: { name: '史萊姆護盾', emoji: '🛡️', type: 'shield', quality: 'common', stats: { def: 4, mdef: 2 }, set_id: 'slime_set' },
    slime_ring: { name: '黏液之戒', emoji: '💍', type: 'accessory', quality: 'fine', stats: { def: 3, hp: 15 }, set_id: 'slime_set' },
    forest_amulet: { name: '森林護符', emoji: '🌿', type: 'accessory', quality: 'fine', stats: { mdef: 5, mp: 20 } },
    swift_anklet: { name: '疾風足環', emoji: '📿', type: 'accessory', quality: 'fine', stats: { spd: 8, hp: 10 } },
    boar_tusk_dagger: { name: '獠牙短刀', emoji: '🗡️', type: 'weapon_1h', quality: 'common', stats: { atk: 8, spd: 3 } },
    great_boar_axe: { name: '野豬雙手斧', emoji: '🪓', type: 'weapon_2h', quality: 'fine', stats: { atk: 18, spd: -2 } },
    bandit_cloak: { name: '盜賊斗篷', emoji: '🧥', type: 'body', quality: 'common', stats: { def: 3, spd: 4 } },
    thieves_dagger: { name: '竊賊匕首', emoji: '🗡️', type: 'weapon_1h', quality: 'fine', stats: { atk: 10, spd: 5 } },
    goblin_boots: { name: '哥布林皮靴', emoji: '👢', type: 'feet', quality: 'common', stats: { def: 2, spd: 2 } },
    spider_amulet: { name: '蛛絲項鍊', emoji: '📿', type: 'accessory', quality: 'fine', stats: { matk: 3, mp: 10 } },
    bark_gloves: { name: '樹皮護手', emoji: '🧤', type: 'hands', quality: 'fine', stats: { def: 3, hp: 10 } },

    // ===== 黑霧森林掉落 (🟢精良 ~ 🔵稀有) =====
    goblin_sword: { name: '哥布林彎刀', emoji: '🗡️', type: 'weapon_1h', quality: 'fine', stats: { atk: 14, spd: 2 }, set_id: 'goblin_set' },
    goblin_greatsword: { name: '哥布林大劍', emoji: '⚔️', type: 'weapon_2h', quality: 'fine', stats: { atk: 25, spd: -3 }, set_id: 'goblin_set' },
    goblin_mail: { name: '哥布林鎖甲', emoji: '⛓️', type: 'body', quality: 'fine', stats: { def: 12, mdef: 3 }, set_id: 'goblin_set' },
    goblin_helm: { name: '哥布林鐵盔', emoji: '⛑️', type: 'head', quality: 'fine', stats: { def: 6, hp: 10 }, set_id: 'goblin_set' },
    goblin_amulet: { name: '哥布林護符', emoji: '📿', type: 'accessory', quality: 'rare', stats: { def: 5, mdef: 5, hp: 20 }, set_id: 'goblin_set' },
    spider_silk_robe: { name: '蛛絲法袍', emoji: '🧥', type: 'body', quality: 'fine', stats: { def: 6, mdef: 12, mp: 10 } },
    spider_silk_gloves: { name: '蛛絲手套', emoji: '🧤', type: 'hands', quality: 'fine', stats: { def: 3, mdef: 5, spd: 2 } },
    venom_dagger: { name: '毒牙匕首', emoji: '🗡️', type: 'weapon_1h', quality: 'fine', stats: { atk: 12, spd: 6 } },
    spider_eye_ring: { name: '蛛眼指環', emoji: '💍', type: 'accessory', quality: 'rare', stats: { matk: 6, spd: 5, mp: 15 } },
    spirit_staff: { name: '精靈之杖', emoji: '🔮', type: 'weapon_2h', quality: 'fine', stats: { matk: 22, mp: 10 } },
    bark_armor: { name: '樹皮鎧甲', emoji: '🛡️', type: 'body', quality: 'fine', stats: { def: 14, mdef: 8 } },
    bark_leggings: { name: '樹皮護腿', emoji: '👖', type: 'legs', quality: 'fine', stats: { def: 8, hp: 20 } },
    forest_pendant: { name: '森林吊墜', emoji: '📿', type: 'accessory', quality: 'rare', stats: { hp: 30, mp: 20, mdef: 4 }, set_id: 'nature_relics' },
    stone_helm: { name: '堅石頭盔', emoji: '⛑️', type: 'head', quality: 'fine', stats: { def: 8, hp: 20 }, set_id: 'stone_set' },
    stone_gauntlets: { name: '堅石護手', emoji: '🧤', type: 'hands', quality: 'fine', stats: { def: 6, hp: 15 }, set_id: 'stone_set' },
    dragon_scale_greaves: { name: '龍鱗護腿', emoji: '👖', type: 'legs', quality: 'rare', stats: { def: 15, mdef: 8 }, set_id: 'dragon_set' },

    // ===== 龍脊山脈掉落 (🟢精良 ~ 🟣史詩) =====
    stone_sword: { name: '堅石單手劍', emoji: '🗡️', type: 'weapon_1h', quality: 'fine', stats: { atk: 18, def: 2 }, set_id: 'stone_set' },
    stone_great_sword: { name: '巨岩大劍', emoji: '⚔️', type: 'weapon_2h', quality: 'fine', stats: { atk: 35, def: 8 }, set_id: 'stone_set' },
    stone_plate: { name: '岩石板甲', emoji: '🛡️', type: 'body', quality: 'fine', stats: { def: 24, mdef: 6, spd: -3 }, set_id: 'stone_set' },
    stone_shield: { name: '巨岩大盾', emoji: '🛡️', type: 'shield', quality: 'fine', stats: { def: 15, mdef: 5 }, set_id: 'stone_set' },
    earth_core_ring: { name: '大地核心之戒', emoji: '💍', type: 'accessory', quality: 'rare', stats: { def: 10, hp: 50 }, set_id: 'nature_relics' },
    dragon_fang_blade: { name: '龍牙單刃', emoji: '🗡️', type: 'weapon_1h', quality: 'rare', stats: { atk: 25, spd: 3 }, set_id: 'dragon_set' },
    dragon_scale_vest: { name: '龍鱗輕甲', emoji: '🛡️', type: 'body', quality: 'rare', stats: { def: 20, mdef: 14, hp: 20 }, set_id: 'dragon_set' },
    dragon_scale_boots: { name: '龍鱗戰靴', emoji: '👢', type: 'feet', quality: 'rare', stats: { def: 10, mdef: 8, spd: 5 }, set_id: 'dragon_set' },
    dragon_eye_amulet: { name: '龍眼護符', emoji: '📿', type: 'accessory', quality: 'epic', stats: { atk: 8, matk: 8, spd: 5, hp: 30 }, set_id: 'dragon_set' },

    // ===== 幽暗沼澤掉落 (🔵稀有 ~ 🟣史詩) =====
    bone_blade: { name: '白骨單手劍', emoji: '🗡️', type: 'weapon_1h', quality: 'rare', stats: { atk: 30, matk: 10 }, set_id: 'bone_set' },
    bone_scythe: { name: '白骨巨鐮', emoji: '⚔️', type: 'weapon_2h', quality: 'rare', stats: { atk: 55, matk: 15, spd: -2 }, set_id: 'bone_set' },
    bone_shield_eq: { name: '骨盾', emoji: '🛡️', type: 'shield', quality: 'rare', stats: { def: 22, mdef: 10 }, set_id: 'bone_set' },
    death_ring: { name: '死亡指環', emoji: '💍', type: 'accessory', quality: 'epic', stats: { atk: 12, matk: 12, hp: 40 } },
    toad_skin_armor: { name: '蟾皮護甲', emoji: '🥋', type: 'body', quality: 'rare', stats: { def: 18, mdef: 15, hp: 25 } },
    toad_skin_gloves: { name: '蟾皮護手', emoji: '🧤', type: 'hands', quality: 'rare', stats: { def: 8, mdef: 5, spd: 2 } },
    venom_ring: { name: '劇毒之戒', emoji: '💍', type: 'accessory', quality: 'rare', stats: { atk: 8, matk: 8, spd: 4 } },
    necro_staff: { name: '死靈法杖', emoji: '🔮', type: 'weapon_2h', quality: 'rare', stats: { matk: 45, mp: 25 } },
    shadow_robe: { name: '暗影法袍', emoji: '🧥', type: 'body', quality: 'rare', stats: { def: 10, mdef: 22, mp: 30 } },
    soul_pendant: { name: '靈魂吊墜', emoji: '📿', type: 'accessory', quality: 'epic', stats: { matk: 15, mdef: 10, mp: 40 } },
    bone_mask: { name: '骸骨面具', emoji: '🎭', type: 'head', quality: 'rare', stats: { matk: 10, mdef: 5 }, set_id: 'bone_set' },
    withered_gloves: { name: '枯萎手套', emoji: '🧤', type: 'hands', quality: 'rare', stats: { matk: 8, mp: 15 } },
    skeleton_leggings: { name: '骷髏腿甲', emoji: '👖', type: 'legs', quality: 'rare', stats: { def: 12, spd: 2 }, set_id: 'bone_set' },
    swamp_boots: { name: '沼澤長靴', emoji: '👢', type: 'feet', quality: 'rare', stats: { def: 8, mdef: 8, spd: 3 } },
    magma_gauntlets: { name: '熔岩護手', emoji: '🧤', type: 'hands', quality: 'rare', stats: { atk: 5, def: 10 } },
    inferno_leggings: { name: '煉獄腿甲', emoji: '👖', type: 'legs', quality: 'rare', stats: { def: 18, mdef: 10 } },
    hellfire_boots: { name: '冥火戰靴', emoji: '👢', type: 'feet', quality: 'epic', stats: { def: 12, spd: 10 } },

    // ===== 熔岩荒原掉落 (🔵稀有 ~ 🟣史詩) =====
    flame_staff: { name: '烈焰法杖', emoji: '🔮', type: 'weapon_2h', quality: 'rare', stats: { matk: 55, mp: 20 } },
    ember_robe: { name: '餘燼法袍', emoji: '🧥', type: 'body', quality: 'rare', stats: { def: 12, mdef: 25, mp: 25 } },
    fire_heart_ring: { name: '火之心戒指', emoji: '💍', type: 'accessory', quality: 'epic', stats: { atk: 15, matk: 15, hp: 50 }, set_id: 'lava_jewelry' },
    hell_fang_blade: { name: '地獄牙刃', emoji: '🗡️', type: 'weapon_1h', quality: 'rare', stats: { atk: 35, spd: 8 } },
    hell_hide_armor: { name: '地獄犬皮甲', emoji: '🥋', type: 'body', quality: 'rare', stats: { def: 22, mdef: 12, spd: 5 } },
    inferno_collar: { name: '煉獄項圈', emoji: '📿', type: 'accessory', quality: 'epic', stats: { atk: 12, spd: 8, hp: 60 } },
    magma_hammer: { name: '熔岩巨錘', emoji: '🔨', type: 'weapon_2h', quality: 'rare', stats: { atk: 65, def: 8 } },
    lava_plate: { name: '熔岩重甲', emoji: '🛡️', type: 'body', quality: 'rare', stats: { def: 30, mdef: 10, hp: 40, spd: -5 } },
    lava_helm: { name: '熔岩頭盔', emoji: '⛑️', type: 'head', quality: 'rare', stats: { def: 15, hp: 30 } },
    molten_core_ring: { name: '熔核指環', emoji: '💍', type: 'accessory', quality: 'epic', stats: { atk: 18, matk: 18, hp: 80 }, set_id: 'lava_jewelry' },

    // ===== 虛空裂隙掉落 (🟣史詩 ~ 🟠傳說) =====
    void_blade: { name: '虛空單刃', emoji: '🗡️', type: 'weapon_1h', quality: 'epic', stats: { atk: 45, matk: 10, spd: 5 }, set_id: 'void_set' },
    void_greatsword: { name: '虛空巨刃', emoji: '⚔️', type: 'weapon_2h', quality: 'epic', stats: { atk: 85, matk: 20, spd: 0 }, set_id: 'void_set' },
    chaos_sword: { name: '混沌大劍', emoji: '⚔️', type: 'weapon_2h', quality: 'epic', stats: { atk: 65, spd: -2 }, set_id: 'chaos_set' },
    void_cloak: { name: '虛空斗篷', emoji: '🧥', type: 'body', quality: 'epic', stats: { def: 20, mdef: 25, spd: 8 }, set_id: 'void_set' },
    void_eye_pendant: { name: '虛空之眼', emoji: '📿', type: 'accessory', quality: 'legendary', stats: { matk: 20, mdef: 15, spd: 10, mp: 50 } },
    chaos_plate: { name: '混沌板甲', emoji: '🛡️', type: 'body', quality: 'epic', stats: { def: 35, mdef: 15, hp: 60 }, set_id: 'chaos_set' },
    chaos_crown: { name: '混沌王冠', emoji: '👑', type: 'head', quality: 'legendary', stats: { atk: 15, matk: 15, def: 8, mdef: 8, spd: 5 }, set_id: 'chaos_set' },
    abyss_staff: { name: '深淵法杖', emoji: '🔮', type: 'weapon_2h', quality: 'epic', stats: { matk: 70, mp: 40 } },
    abyss_robe: { name: '深淵法袍', emoji: '🧥', type: 'body', quality: 'epic', stats: { def: 15, mdef: 30, mp: 50, matk: 10 } },
    abyss_crown: { name: '深淵之眼', emoji: '👑', type: 'accessory', quality: 'legendary', stats: { matk: 25, mdef: 15, mp: 60 } },
    void_gloves: { name: '虛空手套', emoji: '🧤', type: 'hands', quality: 'epic', stats: { matk: 15, spd: 5 }, set_id: 'void_set' },
    chaos_greaves: { name: '混沌腿甲', emoji: '👖', type: 'legs', quality: 'epic', stats: { def: 25, hp: 50 }, set_id: 'chaos_set' },
    void_walker_boots: { name: '虛空行者之靴', emoji: '👢', type: 'feet', quality: 'epic', stats: { spd: 15, mdef: 15 }, set_id: 'void_set' },
    mana_circlet: { name: '魔力髮圈', emoji: '👑', type: 'head', quality: 'epic', stats: { matk: 20, mp: 100 }, set_id: 'mana_set' },
    crystal_gauntlets: { name: '水晶護手', emoji: '🧤', type: 'hands', quality: 'epic', stats: { def: 20, matk: 10 }, set_id: 'crystal_set' },
    mana_leggings: { name: '結晶護腿', emoji: '👖', type: 'legs', quality: 'epic', stats: { def: 30, mdef: 30 }, set_id: 'mana_set' },
    crystal_boots: { name: '水晶戰靴', emoji: '👢', type: 'feet', quality: 'epic', stats: { def: 20, spd: 12 }, set_id: 'crystal_set' },

    // ===== 水晶洞窟掉落 (🟣史詩 ~ 🟠傳說) =====
    crystal_blade: { name: '水晶魔劍', emoji: '🗡️', type: 'weapon_1h', quality: 'epic', stats: { atk: 55, matk: 20, spd: 5 }, set_id: 'crystal_set' },
    crystal_greatsword: { name: '水晶魔焰巨劍', emoji: '⚔️', type: 'weapon_2h', quality: 'epic', stats: { atk: 105, matk: 35 }, set_id: 'crystal_set' },
    crystal_plate: { name: '水晶重甲', emoji: '🛡️', type: 'body', quality: 'epic', stats: { def: 45, mdef: 30, hp: 80 }, set_id: 'crystal_set' },
    crystal_shield: { name: '水晶巨盾', emoji: '🛡️', type: 'shield', quality: 'epic', stats: { def: 40, mdef: 25, hp: 50 }, set_id: 'crystal_set' },
    crystal_ring: { name: '水晶戒指', emoji: '💍', type: 'accessory', quality: 'epic', stats: { atk: 15, def: 15, hp: 50, spd: 5 }, set_id: 'crystal_set' },
    mana_staff: { name: '魔力權杖', emoji: '🔮', type: 'weapon_2h', quality: 'epic', stats: { matk: 95, mp: 60 }, set_id: 'mana_set' },
    mana_robe: { name: '魔力結晶袍', emoji: '🧥', type: 'body', quality: 'epic', stats: { def: 20, mdef: 45, mp: 80 }, set_id: 'mana_set' },
    mana_pendant: { name: '魔力吊墜', emoji: '📿', type: 'accessory', quality: 'epic', stats: { matk: 25, mdef: 20, mp: 100 }, set_id: 'mana_set' },
    woven_crystal_bow: { name: '晶絲長弓', emoji: '🏹', type: 'weapon_2h', quality: 'epic', stats: { atk: 90, spd: 15 } },
    woven_crystal_vest: { name: '晶絲輕甲', emoji: '🥋', type: 'body', quality: 'epic', stats: { def: 35, mdef: 25, spd: 10 } },
    woven_crystal_ring: { name: '晶絲戒指', emoji: '💍', type: 'accessory', quality: 'epic', stats: { atk: 20, spd: 12, hp: 60 }, set_id: 'crystal_set' },

    // ===== 天空群島掉落 (🟠傳說) =====
    sky_sword: { name: '天空之刃', emoji: '🗡️', type: 'weapon_1h', quality: 'legendary', stats: { atk: 65, spd: 15 }, set_id: 'skywalker_set' },
    sky_armor: { name: '天空羽甲', emoji: '🛡️', type: 'body', quality: 'legendary', stats: { def: 40, mdef: 40, spd: 20 }, set_id: 'skywalker_set' },
    sky_boots: { name: '天空戰靴', emoji: '👢', type: 'feet', quality: 'legendary', stats: { def: 20, spd: 30 }, set_id: 'skywalker_set' },
    sky_necklace: { name: '天空護符', emoji: '📿', type: 'accessory', quality: 'legendary', stats: { spd: 15, mp: 50 }, set_id: 'skywalker_set' },
    sky_ring: { name: '天空戒指', emoji: '💍', type: 'accessory', quality: 'legendary', stats: { spd: 10, hp: 50 }, set_id: 'skywalker_set' },

    // ===== 遠古神殿掉落 (🟠傳說) =====
    ancient_sword: { name: '遠古聖劍', emoji: '🗡️', type: 'weapon_1h', quality: 'legendary', stats: { atk: 85, matk: 85 }, set_id: 'ancient_gods_set' },
    ancient_robe: { name: '遠古神袍', emoji: '🧥', type: 'body', quality: 'legendary', stats: { def: 55, mdef: 85, mp: 100 }, set_id: 'ancient_gods_set' },
    ancient_shield: { name: '遠古神盾', emoji: '🛡️', type: 'shield', quality: 'legendary', stats: { def: 60, mdef: 60 }, set_id: 'ancient_gods_set' },
    ancient_ring: { name: '遠古神戒', emoji: '💍', type: 'accessory', quality: 'legendary', stats: { atk: 25, matk: 25 }, set_id: 'ancient_gods_set' },
    ancient_necklace: { name: '遠古項鍊', emoji: '📿', type: 'accessory', quality: 'legendary', stats: { hp: 100, mp: 100 }, set_id: 'ancient_gods_set' },

    // ===== 職業專屬史詩 (Epic) 套裝 =====
    // 劍士 - 戰神之怒 (Ares' Wrath)
    ares_greatsword: { name: '戰神大劍', emoji: '⚔️', type: 'weapon_2h', quality: 'epic', stats: { atk: 90, hp: 50, spd: -2 }, set_id: 'ares_wrath' },
    ares_plate: { name: '戰神重甲', emoji: '🛡️', type: 'body', quality: 'epic', stats: { def: 40, mdef: 20, hp: 100 }, set_id: 'ares_wrath' },
    ares_helm: { name: '戰神霸盔', emoji: '⛑️', type: 'head', quality: 'epic', stats: { def: 20, mdef: 10, hp: 50 }, set_id: 'ares_wrath' },
    ares_gauntlets: { name: '戰神護手', emoji: '🧤', type: 'hands', quality: 'epic', stats: { atk: 15, def: 15 }, set_id: 'ares_wrath' },

    // 遊俠 - 疾風行者 (Windwalker)
    wind_longbow: { name: '疾風長弓', emoji: '🏹', type: 'weapon_2h', quality: 'epic', stats: { atk: 80, spd: 20 }, set_id: 'windwalker' },
    wind_leather_vest: { name: '疾風皮甲', emoji: '🥋', type: 'body', quality: 'epic', stats: { def: 25, mdef: 25, spd: 15 }, set_id: 'windwalker' },
    wind_strider_boots: { name: '疾風行者靴', emoji: '👢', type: 'feet', quality: 'epic', stats: { def: 15, spd: 25 }, set_id: 'windwalker' },
    wind_ring: { name: '疾風指環', emoji: '💍', type: 'accessory', quality: 'epic', stats: { atk: 15, spd: 10, crit_dmg: 15 }, set_id: 'windwalker' },

    // 法師 - 秘法學徒 (Arcane Scholar)
    arcane_staff: { name: '秘法手杖', emoji: '🔮', type: 'weapon_2h', quality: 'epic', stats: { matk: 90, mp: 60 }, set_id: 'arcane_scholar' },
    arcane_robe: { name: '秘法長袍', emoji: '🧥', type: 'body', quality: 'epic', stats: { def: 15, mdef: 40, mp: 80 }, set_id: 'arcane_scholar' },
    arcane_hood: { name: '秘法兜帽', emoji: '🎩', type: 'head', quality: 'epic', stats: { mdef: 25, mp: 40 }, set_id: 'arcane_scholar' },
    arcane_amulet: { name: '秘法護符', emoji: '📿', type: 'accessory', quality: 'epic', stats: { matk: 20, mp: 50 }, set_id: 'arcane_scholar' },

    // 聖騎士 - 光輝十字 (Radiant Cross)
    radiant_mace: { name: '光輝十字錘', emoji: '🔨', type: 'weapon_1h', quality: 'epic', stats: { atk: 60, def: 20, mdef: 15 }, set_id: 'radiant_cross' },
    radiant_shield: { name: '光輝大盾', emoji: '🛡️', type: 'shield', quality: 'epic', stats: { def: 45, mdef: 40, hp: 50 }, set_id: 'radiant_cross' },
    radiant_armor: { name: '光輝聖甲', emoji: '🛡️', type: 'body', quality: 'epic', stats: { def: 50, mdef: 45, hp: 100 }, set_id: 'radiant_cross' },
    radiant_ring: { name: '光輝聖戒', emoji: '💍', type: 'accessory', quality: 'epic', stats: { def: 15, mdef: 15, hp: 60 }, set_id: 'radiant_cross' },

    // 魔劍士 - 幻影魔劍 (Phantom Blade)
    phantom_longsword: { name: '幻影長劍', emoji: '🗡️', type: 'weapon_1h', quality: 'epic', stats: { atk: 55, matk: 55, spd: 8 }, set_id: 'phantom_blade' },
    phantom_cloak: { name: '幻影魔披', emoji: '🧥', type: 'body', quality: 'epic', stats: { def: 30, mdef: 30, spd: 10 }, set_id: 'phantom_blade' },
    phantom_boots: { name: '幻影魔靴', emoji: '👢', type: 'feet', quality: 'epic', stats: { atk: 10, matk: 10, spd: 15 }, set_id: 'phantom_blade' },
    phantom_pendant: { name: '幻影墜飾', emoji: '📿', type: 'accessory', quality: 'epic', stats: { atk: 15, matk: 15, hp: 40 }, set_id: 'phantom_blade' },

    // ===== 深淵核心掉落 (🟠傳說) =====
    abyss_blade: { name: '深淵魔刃', emoji: '🗡️', type: 'weapon_1h', quality: 'legendary', stats: { atk: 120, spd: 10 }, set_id: 'abyss_master_set' },
    abyss_armor: { name: '深淵冥甲', emoji: '🛡️', type: 'body', quality: 'legendary', stats: { def: 100, mdef: 100, hp: 200 }, set_id: 'abyss_master_set' },
    abyss_pendant: { name: '深淵墜飾', emoji: '📿', type: 'accessory', quality: 'legendary', stats: { atk: 40, lifesteal: 10 }, set_id: 'abyss_master_set' },
    abyss_ring: { name: '深淵之戒', emoji: '💍', type: 'accessory', quality: 'legendary', stats: { hp_pct: 10, lifesteal: 5 }, set_id: 'abyss_master_set' },

    // ===== 職業專屬傳說 (Legendary) 套裝 =====
    // 劍士 - 霸王重鎧 (Overlord's Plate)
    overlord_slayer: { name: '霸王斬首大劍', emoji: '⚔️', type: 'weapon_2h', quality: 'legendary', stats: { atk: 150, hp: 200, def: 50 }, set_id: 'overlord_plate' },
    overlord_armor: { name: '霸王絕境重鎧', emoji: '🛡️', type: 'body', quality: 'legendary', stats: { def: 120, mdef: 60, hp: 500 }, set_id: 'overlord_plate' },
    overlord_helm: { name: '霸王征服者盔', emoji: '👑', type: 'head', quality: 'legendary', stats: { def: 60, hp: 200, atk: 30 }, set_id: 'overlord_plate' },
    overlord_ring: { name: '霸王璽戒', emoji: '💍', type: 'accessory', quality: 'legendary', stats: { atk: 50, def: 50, hp: 100 }, set_id: 'overlord_plate' },

    // 遊俠 - 星辰獵手 (Starborn Hunter)
    starborn_bow: { name: '星辰隕落長弓', emoji: '🏹', type: 'weapon_2h', quality: 'legendary', stats: { atk: 130, spd: 40, crit_dmg: 50 }, set_id: 'starborn_hunter' },
    starborn_cloak: { name: '星辰編織斗篷', emoji: '🧥', type: 'body', quality: 'legendary', stats: { def: 70, mdef: 70, spd: 30 }, set_id: 'starborn_hunter' },
    starborn_boots: { name: '星辰漫步靴', emoji: '👢', type: 'feet', quality: 'legendary', stats: { def: 40, spd: 50, crit: 10 }, set_id: 'starborn_hunter' },
    starborn_quiver: { name: '星辰無盡箭筒', emoji: '🎯', type: 'accessory', quality: 'legendary', stats: { atk: 40, spd: 20, crit: 15 }, set_id: 'starborn_hunter' },

    // 法師 - 元素賢者 (Elemental Sage)
    sage_eternity_staff: { name: '恆星元素權杖', emoji: '🪄', type: 'weapon_2h', quality: 'legendary', stats: { matk: 160, mp: 200, matk_pct: 15 }, set_id: 'elemental_sage' },
    sage_cosmic_robe: { name: '宇宙元素長袍', emoji: '🧥', type: 'body', quality: 'legendary', stats: { def: 50, mdef: 120, mp: 300 }, set_id: 'elemental_sage' },
    sage_wisdom_crown: { name: '賢者真理之冠', emoji: '👑', type: 'head', quality: 'legendary', stats: { matk: 50, mdef: 60, mp: 150 }, set_id: 'elemental_sage' },
    sage_orb: { name: '無限元素法球', emoji: '🔮', type: 'accessory', quality: 'legendary', stats: { matk: 60, matk_pct: 10, spd: 15 }, set_id: 'elemental_sage' },

    // 聖騎士 - 神聖壁壘 (Aegis of the Divine)
    aegis_god_hammer: { name: '神之裁決戰鎚', emoji: '⚡', type: 'weapon_1h', quality: 'legendary', stats: { atk: 100, def: 50, mdef: 50 }, set_id: 'aegis_divine' },
    aegis_divine_shield: { name: '神聖真理之盾', emoji: '🔱', type: 'shield', quality: 'legendary', stats: { def: 100, mdef: 100, hp: 300 }, set_id: 'aegis_divine' },
    aegis_eternal_armor: { name: '永恆神聖戰鎧', emoji: '🛡️', type: 'body', quality: 'legendary', stats: { def: 150, mdef: 150, hp: 800 }, set_id: 'aegis_divine' },
    aegis_holy_pendant: { name: '神聖生命項鍊', emoji: '📿', type: 'accessory', quality: 'legendary', stats: { def: 40, mdef: 40, hp: 400 }, set_id: 'aegis_divine' },

    // 魔劍士 - 混沌劍主 (Lord of Chaos)
    chaos_emperor_blade: { name: '混沌君王魔刃', emoji: '✨', type: 'weapon_1h', quality: 'legendary', stats: { atk: 100, matk: 100, spd: 20, lifesteal: 5 }, set_id: 'lord_of_chaos' },
    chaos_shadow_plate: { name: '混沌虛影重甲', emoji: '⛓️', type: 'body', quality: 'legendary', stats: { def: 90, mdef: 90, hp: 400, lifesteal: 5 }, set_id: 'lord_of_chaos' },
    chaos_void_gloves: { name: '混沌虛空護手', emoji: '🧤', type: 'hands', quality: 'legendary', stats: { atk: 40, matk: 40, spd: 10 }, set_id: 'lord_of_chaos' },
    chaos_abyss_ring: { name: '混沌深淵魔戒', emoji: '💍', type: 'accessory', quality: 'legendary', stats: { atk: 30, matk: 30, hp: 150, mp: 100 }, set_id: 'lord_of_chaos' },

    // ===== Boss 掉落 (🟣史詩 ~ 🟠傳說) =====
    boar_king_helm: { name: '野豬王頭盔', emoji: '⛑️', type: 'head', quality: 'rare', stats: { def: 15, hp: 30 } },
    goblin_crown: { name: '哥布林王冠', emoji: '👑', type: 'head', quality: 'epic', stats: { atk: 10, matk: 10, spd: 5 } },
    dragon_scale_armor: { name: '龍鱗甲', emoji: '🛡️', type: 'body', quality: 'epic', stats: { def: 25, mdef: 15, hp: 50 }, set_id: 'dragon_set' },
    bone_lord_staff: { name: '骸骨領主法杖', emoji: '🦴', type: 'weapon_2h', quality: 'epic', stats: { matk: 60, mp: 35 } },
    lava_dragon_core: { name: '熔岩龍核', emoji: '🌋', type: 'accessory', quality: 'legendary', stats: { atk: 20, matk: 20, hp: 100 } },
    void_lord_mantle: { name: '虛空之主斷罩', emoji: '🌌', type: 'body', quality: 'legendary', stats: { def: 55, mdef: 55, spd: 15, mp: 100, matk: 30 } },
    jiji_crown: { name: '吉吉王冠', emoji: '👑', type: 'head', quality: 'legendary', stats: { atk: 15, matk: 15, def: 15, mdef: 15, hp: 100, mp: 100 } },

    // ===== 🟠 傳說 Boss 限定掉落 (0.5%) =====
    boar_king_axe: { name: '野豬王裂地巨斧', emoji: '🪓', type: 'weapon_2h', quality: 'legendary', stats: { atk: 110, def: 15, hp: 80 } },
    goblin_king_blade: { name: '哥布林王死牙', emoji: '🗡️', type: 'weapon_1h', quality: 'legendary', stats: { atk: 95, spd: 20, hp: 60 } },
    dragonslayer: { name: '屠龍者巨劍', emoji: '⚔️', type: 'weapon_2h', quality: 'legendary', stats: { atk: 140, matk: 30, hp: 100 } },
    death_sovereign_robe: { name: '死亡君主法袍', emoji: '🧥', type: 'body', quality: 'legendary', stats: { def: 25, mdef: 40, matk: 20, mp: 80, hp: 60 } },
    volcanic_greatsword: { name: '火山大劍', emoji: '🔥', type: 'weapon_2h', quality: 'legendary', stats: { atk: 160, def: 10, hp: 150 } },
    void_emperor_blade: { name: '虛空帝王單刃', emoji: '🌀', type: 'weapon_1h', quality: 'legendary', stats: { atk: 85, matk: 40, spd: 15, hp: 80, mp: 40 } },
    emperor_crown: { name: '水晶帝冠', emoji: '👑', type: 'head', quality: 'legendary', stats: { matk: 25, def: 15, mdef: 25, hp: 120, mp: 80 } },
    jiji_chaos_crown: { name: '「混沌」吉吉王冠', emoji: '👑', type: 'head', quality: 'legendary', stats: { atk: 150, matk: 150, def: 150, mdef: 150, hp: 1000, mp: 1000 } },

    // ===== 自動補齊的新增套裝部件 =====
    slime_weapon_1h: { name: '史萊姆單手劍', emoji: '🟢', type: 'weapon_1h', quality: 'common', stats: {  }, set_id: 'slime_set' },
    slime_weapon_2h: { name: '史萊姆雙手巨刃', emoji: '🟢', type: 'weapon_2h', quality: 'common', stats: { spd: -2 }, set_id: 'slime_set' },
    slime_body: { name: '史萊姆重甲', emoji: '🟢', type: 'body', quality: 'common', stats: { def: 6, mdef: 6, hp: 23 }, set_id: 'slime_set' },
    slime_legs: { name: '史萊姆腿甲', emoji: '🟢', type: 'legs', quality: 'common', stats: { def: 3, mdef: 3, hp: 12 }, set_id: 'slime_set' },
    slime_feet: { name: '史萊姆戰靴', emoji: '🟢', type: 'feet', quality: 'common', stats: { def: 2, mdef: 2, spd: 5 }, set_id: 'slime_set' },
    goblin_shield: { name: '哥布林大盾', emoji: '👺', type: 'shield', quality: 'fine', stats: { def: 13, hp: 25 }, set_id: 'goblin_set' },
    goblin_hands: { name: '哥布林護手', emoji: '👺', type: 'hands', quality: 'fine', stats: { atk: 3, def: 4 }, set_id: 'goblin_set' },
    goblin_legs: { name: '哥布林腿甲', emoji: '👺', type: 'legs', quality: 'fine', stats: { def: 8, hp: 20 }, set_id: 'goblin_set' },
    goblin_feet: { name: '哥布林戰靴', emoji: '👺', type: 'feet', quality: 'fine', stats: { def: 5, spd: 5 }, set_id: 'goblin_set' },
    dragon_weapon_2h: { name: '龍鱗雙手巨刃', emoji: '🐉', type: 'weapon_2h', quality: 'rare', stats: { atk: 45, spd: -2 }, set_id: 'dragon_set' },
    dragon_shield: { name: '龍鱗大盾', emoji: '🐉', type: 'shield', quality: 'rare', stats: { def: 26, mdef: 20, hp: 40 }, set_id: 'dragon_set' },
    dragon_head: { name: '龍鱗頭盔', emoji: '🐉', type: 'head', quality: 'rare', stats: { def: 12, mdef: 9, hp: 24 }, set_id: 'dragon_set' },
    dragon_hands: { name: '龍鱗護手', emoji: '🐉', type: 'hands', quality: 'rare', stats: { atk: 5, def: 8, mdef: 6 }, set_id: 'dragon_set' },
    skywalker_weapon_2h: { name: '天空雙手巨刃', emoji: '☁️', type: 'weapon_2h', quality: 'legendary', stats: { atk: 144, spd: 1 }, set_id: 'skywalker_set' },
    skywalker_shield: { name: '天空大盾', emoji: '☁️', type: 'shield', quality: 'legendary', stats: { def: 65, mdef: 65 }, set_id: 'skywalker_set' },
    skywalker_head: { name: '天空頭盔', emoji: '☁️', type: 'head', quality: 'legendary', stats: { def: 30, mdef: 30 }, set_id: 'skywalker_set' },
    skywalker_hands: { name: '天空護手', emoji: '☁️', type: 'hands', quality: 'legendary', stats: { atk: 16, def: 20, mdef: 20 }, set_id: 'skywalker_set' },
    skywalker_legs: { name: '天空腿甲', emoji: '☁️', type: 'legs', quality: 'legendary', stats: { def: 40, mdef: 40 }, set_id: 'skywalker_set' },
    ancient_gods_weapon_2h: { name: '遠古雙手巨刃', emoji: '🛡️', type: 'weapon_2h', quality: 'legendary', stats: { atk: 162, matk: 162, spd: -2 }, set_id: 'ancient_gods_set' },
    ancient_gods_head: { name: '遠古頭盔', emoji: '🛡️', type: 'head', quality: 'legendary', stats: { def: 39, mdef: 39, hp: 72 }, set_id: 'ancient_gods_set' },
    ancient_gods_hands: { name: '遠古護手', emoji: '🛡️', type: 'hands', quality: 'legendary', stats: { atk: 18, matk: 18, def: 26, mdef: 26 }, set_id: 'ancient_gods_set' },
    ancient_gods_legs: { name: '遠古腿甲', emoji: '🛡️', type: 'legs', quality: 'legendary', stats: { def: 52, mdef: 52, hp: 96 }, set_id: 'ancient_gods_set' },
    ancient_gods_feet: { name: '遠古戰靴', emoji: '🛡️', type: 'feet', quality: 'legendary', stats: { def: 33, mdef: 33, spd: 5 }, set_id: 'ancient_gods_set' },
    abyss_master_weapon_2h: { name: '深淵雙手巨刃', emoji: '👹', type: 'weapon_2h', quality: 'legendary', stats: { atk: 198, spd: -2 }, set_id: 'abyss_master_set' },
    abyss_master_shield: { name: '深淵大盾', emoji: '👹', type: 'shield', quality: 'legendary', stats: { def: 104, mdef: 104, hp: 150 }, set_id: 'abyss_master_set' },
    abyss_master_head: { name: '深淵頭盔', emoji: '👹', type: 'head', quality: 'legendary', stats: { def: 48, mdef: 48, hp: 90 }, set_id: 'abyss_master_set' },
    abyss_master_hands: { name: '深淵護手', emoji: '👹', type: 'hands', quality: 'legendary', stats: { atk: 22, def: 32, mdef: 32 }, set_id: 'abyss_master_set' },
    abyss_master_legs: { name: '深淵腿甲', emoji: '👹', type: 'legs', quality: 'legendary', stats: { def: 64, mdef: 64, hp: 120 }, set_id: 'abyss_master_set' },
    abyss_master_feet: { name: '深淵戰靴', emoji: '👹', type: 'feet', quality: 'legendary', stats: { def: 40, mdef: 40, spd: 5 }, set_id: 'abyss_master_set' },
    void_shield: { name: '虛空大盾', emoji: '🌀', type: 'shield', quality: 'epic', stats: { def: 39, mdef: 39 }, set_id: 'void_set' },
    void_head: { name: '虛空頭盔', emoji: '🌀', type: 'head', quality: 'epic', stats: { def: 18, mdef: 18 }, set_id: 'void_set' },
    void_legs: { name: '虛空腿甲', emoji: '🌀', type: 'legs', quality: 'epic', stats: { def: 24, mdef: 24 }, set_id: 'void_set' },
    void_accessory: { name: '虛空戒指', emoji: '🌀', type: 'accessory', quality: 'epic', stats: { atk: 15, matk: 15, def: 9, mdef: 9 }, set_id: 'void_set' },
    chaos_weapon_1h: { name: '混沌單手劍', emoji: '⚔️', type: 'weapon_1h', quality: 'epic', stats: { atk: 55, matk: 55 }, set_id: 'chaos_set' },
    chaos_shield: { name: '混沌大盾', emoji: '⚔️', type: 'shield', quality: 'epic', stats: { def: 46, mdef: 33 }, set_id: 'chaos_set' },
    chaos_hands: { name: '混沌護手', emoji: '⚔️', type: 'hands', quality: 'epic', stats: { atk: 11, matk: 11, def: 14, mdef: 10 }, set_id: 'chaos_set' },
    chaos_feet: { name: '混沌戰靴', emoji: '⚔️', type: 'feet', quality: 'epic', stats: { def: 18, mdef: 13, spd: 5 }, set_id: 'chaos_set' },
    chaos_accessory: { name: '混沌戒指', emoji: '⚔️', type: 'accessory', quality: 'epic', stats: { atk: 17, matk: 17, def: 11, mdef: 8 }, set_id: 'chaos_set' },
    crystal_head: { name: '水晶頭盔', emoji: '💎', type: 'head', quality: 'epic', stats: { def: 24, mdef: 21 }, set_id: 'crystal_set' },
    crystal_legs: { name: '水晶腿甲', emoji: '💎', type: 'legs', quality: 'epic', stats: { def: 32, mdef: 28 }, set_id: 'crystal_set' },
    mana_weapon_1h: { name: '魔力結晶單手劍', emoji: '🎇', type: 'weapon_1h', quality: 'epic', stats: { matk: 60 }, set_id: 'mana_set' },
    mana_shield: { name: '魔力結晶大盾', emoji: '🎇', type: 'shield', quality: 'epic', stats: { def: 33, mdef: 59 }, set_id: 'mana_set' },
    mana_hands: { name: '魔力結晶護手', emoji: '🎇', type: 'hands', quality: 'epic', stats: { matk: 12, def: 10, mdef: 18 }, set_id: 'mana_set' },
    mana_feet: { name: '魔力結晶戰靴', emoji: '🎇', type: 'feet', quality: 'epic', stats: { def: 13, mdef: 23, spd: 5 }, set_id: 'mana_set' },
    stone_legs: { name: '堅石腿甲', emoji: '🪨', type: 'legs', quality: 'fine', stats: { def: 18, mdef: 8 }, set_id: 'stone_set' },
    stone_feet: { name: '堅石戰靴', emoji: '🪨', type: 'feet', quality: 'fine', stats: { def: 11, mdef: 5, spd: 5 }, set_id: 'stone_set' },
    stone_accessory: { name: '堅石戒指', emoji: '🪨', type: 'accessory', quality: 'fine', stats: { atk: 5, def: 7, mdef: 3 }, set_id: 'stone_set' },
    bone_body: { name: '白骨重甲', emoji: '🦴', type: 'body', quality: 'rare', stats: { def: 27, mdef: 27 }, set_id: 'bone_set' },
    bone_hands: { name: '白骨護手', emoji: '🦴', type: 'hands', quality: 'rare', stats: { atk: 6, matk: 5, def: 7, mdef: 7 }, set_id: 'bone_set' },
    bone_feet: { name: '白骨戰靴', emoji: '🦴', type: 'feet', quality: 'rare', stats: { def: 9, mdef: 9, spd: 5 }, set_id: 'bone_set' },
    bone_accessory: { name: '白骨戒指', emoji: '🦴', type: 'accessory', quality: 'rare', stats: { atk: 9, matk: 8, def: 5, mdef: 5 }, set_id: 'bone_set' },
    nature_relics_weapon_1h: { name: '自然單手劍', emoji: '🌿', type: 'weapon_1h', quality: 'rare', stats: { matk: 30 }, set_id: 'nature_relics' },
    nature_relics_weapon_2h: { name: '自然雙手巨刃', emoji: '🌿', type: 'weapon_2h', quality: 'rare', stats: { matk: 54, spd: -2 }, set_id: 'nature_relics' },
    nature_relics_shield: { name: '自然大盾', emoji: '🌿', type: 'shield', quality: 'rare', stats: { def: 23, mdef: 29, hp: 20 }, set_id: 'nature_relics' },
    nature_relics_head: { name: '自然頭盔', emoji: '🌿', type: 'head', quality: 'rare', stats: { def: 11, mdef: 13, hp: 12 }, set_id: 'nature_relics' },
    nature_relics_body: { name: '自然重甲', emoji: '🌿', type: 'body', quality: 'rare', stats: { def: 27, mdef: 33, hp: 30 }, set_id: 'nature_relics' },
    nature_relics_hands: { name: '自然護手', emoji: '🌿', type: 'hands', quality: 'rare', stats: { matk: 6, def: 7, mdef: 9 }, set_id: 'nature_relics' },
    nature_relics_legs: { name: '自然腿甲', emoji: '🌿', type: 'legs', quality: 'rare', stats: { def: 14, mdef: 18, hp: 16 }, set_id: 'nature_relics' },
    nature_relics_feet: { name: '自然戰靴', emoji: '🌿', type: 'feet', quality: 'rare', stats: { def: 9, mdef: 11, spd: 5 }, set_id: 'nature_relics' },
    ares_wrath_weapon_1h: { name: '戰神單手劍', emoji: '⚔️', type: 'weapon_1h', quality: 'epic', stats: { atk: 70 }, set_id: 'ares_wrath' },
    ares_wrath_shield: { name: '戰神大盾', emoji: '⚔️', type: 'shield', quality: 'epic', stats: { def: 59, mdef: 39, hp: 80 }, set_id: 'ares_wrath' },
    ares_wrath_legs: { name: '戰神腿甲', emoji: '⚔️', type: 'legs', quality: 'epic', stats: { def: 36, mdef: 24, hp: 64 }, set_id: 'ares_wrath' },
    ares_wrath_feet: { name: '戰神戰靴', emoji: '⚔️', type: 'feet', quality: 'epic', stats: { def: 23, mdef: 15, spd: 5 }, set_id: 'ares_wrath' },
    ares_wrath_accessory: { name: '戰神戒指', emoji: '⚔️', type: 'accessory', quality: 'epic', stats: { atk: 21, def: 14, mdef: 9, hp: 40 }, set_id: 'ares_wrath' },
    windwalker_weapon_1h: { name: '疾風單手劍', emoji: '🏹', type: 'weapon_1h', quality: 'epic', stats: { atk: 65, spd: 18 }, set_id: 'windwalker' },
    windwalker_shield: { name: '疾風大盾', emoji: '🏹', type: 'shield', quality: 'epic', stats: { def: 46, mdef: 46 }, set_id: 'windwalker' },
    windwalker_head: { name: '疾風頭盔', emoji: '🏹', type: 'head', quality: 'epic', stats: { def: 21, mdef: 21 }, set_id: 'windwalker' },
    windwalker_hands: { name: '疾風護手', emoji: '🏹', type: 'hands', quality: 'epic', stats: { atk: 13, def: 14, mdef: 14 }, set_id: 'windwalker' },
    windwalker_legs: { name: '疾風腿甲', emoji: '🏹', type: 'legs', quality: 'epic', stats: { def: 28, mdef: 28 }, set_id: 'windwalker' },
    arcane_scholar_weapon_1h: { name: '秘法單手劍', emoji: '🔮', type: 'weapon_1h', quality: 'epic', stats: { matk: 70 }, set_id: 'arcane_scholar' },
    arcane_scholar_shield: { name: '秘法大盾', emoji: '🔮', type: 'shield', quality: 'epic', stats: { def: 33, mdef: 59 }, set_id: 'arcane_scholar' },
    arcane_scholar_hands: { name: '秘法護手', emoji: '🔮', type: 'hands', quality: 'epic', stats: { matk: 14, def: 10, mdef: 18 }, set_id: 'arcane_scholar' },
    arcane_scholar_legs: { name: '秘法腿甲', emoji: '🔮', type: 'legs', quality: 'epic', stats: { def: 20, mdef: 36 }, set_id: 'arcane_scholar' },
    arcane_scholar_feet: { name: '秘法戰靴', emoji: '🔮', type: 'feet', quality: 'epic', stats: { def: 13, mdef: 23, spd: 5 }, set_id: 'arcane_scholar' },
    radiant_cross_weapon_2h: { name: '光輝雙手巨刃', emoji: '🛡️', type: 'weapon_2h', quality: 'epic', stats: { atk: 99, matk: 99, spd: -2 }, set_id: 'radiant_cross' },
    radiant_cross_head: { name: '光輝頭盔', emoji: '🛡️', type: 'head', quality: 'epic', stats: { def: 30, mdef: 30 }, set_id: 'radiant_cross' },
    radiant_cross_hands: { name: '光輝護手', emoji: '🛡️', type: 'hands', quality: 'epic', stats: { atk: 11, matk: 11, def: 20, mdef: 20 }, set_id: 'radiant_cross' },
    radiant_cross_legs: { name: '光輝腿甲', emoji: '🛡️', type: 'legs', quality: 'epic', stats: { def: 40, mdef: 40 }, set_id: 'radiant_cross' },
    radiant_cross_feet: { name: '光輝戰靴', emoji: '🛡️', type: 'feet', quality: 'epic', stats: { def: 25, mdef: 25, spd: 5 }, set_id: 'radiant_cross' },
    phantom_blade_weapon_2h: { name: '幻影雙手巨刃', emoji: '✨', type: 'weapon_2h', quality: 'epic', stats: { atk: 108, matk: 108, spd: -2 }, set_id: 'phantom_blade' },
    phantom_blade_shield: { name: '幻影大盾', emoji: '✨', type: 'shield', quality: 'epic', stats: { def: 46, mdef: 46 }, set_id: 'phantom_blade' },
    phantom_blade_head: { name: '幻影頭盔', emoji: '✨', type: 'head', quality: 'epic', stats: { def: 21, mdef: 21 }, set_id: 'phantom_blade' },
    phantom_blade_hands: { name: '幻影護手', emoji: '✨', type: 'hands', quality: 'epic', stats: { atk: 12, matk: 12, def: 14, mdef: 14 }, set_id: 'phantom_blade' },
    phantom_blade_legs: { name: '幻影腿甲', emoji: '✨', type: 'legs', quality: 'epic', stats: { def: 28, mdef: 28 }, set_id: 'phantom_blade' },
    overlord_plate_weapon_1h: { name: '霸王單手劍', emoji: '🪖', type: 'weapon_1h', quality: 'legendary', stats: { atk: 120 }, set_id: 'overlord_plate' },
    overlord_plate_shield: { name: '霸王大盾', emoji: '🪖', type: 'shield', quality: 'legendary', stats: { def: 104, mdef: 65, hp: 150 }, set_id: 'overlord_plate' },
    overlord_plate_hands: { name: '霸王護手', emoji: '🪖', type: 'hands', quality: 'legendary', stats: { atk: 24, def: 32, mdef: 20 }, set_id: 'overlord_plate' },
    overlord_plate_legs: { name: '霸王腿甲', emoji: '🪖', type: 'legs', quality: 'legendary', stats: { def: 64, mdef: 40, hp: 120 }, set_id: 'overlord_plate' },
    overlord_plate_feet: { name: '霸王戰靴', emoji: '🪖', type: 'feet', quality: 'legendary', stats: { def: 40, mdef: 25, spd: 5 }, set_id: 'overlord_plate' },
    starborn_hunter_weapon_1h: { name: '星辰單手劍', emoji: '🌌', type: 'weapon_1h', quality: 'legendary', stats: { atk: 110, spd: 30 }, set_id: 'starborn_hunter' },
    starborn_hunter_shield: { name: '星辰大盾', emoji: '🌌', type: 'shield', quality: 'legendary', stats: { def: 78, mdef: 78 }, set_id: 'starborn_hunter' },
    starborn_hunter_head: { name: '星辰頭盔', emoji: '🌌', type: 'head', quality: 'legendary', stats: { def: 36, mdef: 36 }, set_id: 'starborn_hunter' },
    starborn_hunter_hands: { name: '星辰護手', emoji: '🌌', type: 'hands', quality: 'legendary', stats: { atk: 22, def: 24, mdef: 24 }, set_id: 'starborn_hunter' },
    starborn_hunter_legs: { name: '星辰腿甲', emoji: '🌌', type: 'legs', quality: 'legendary', stats: { def: 48, mdef: 48 }, set_id: 'starborn_hunter' },
    elemental_sage_weapon_1h: { name: '元素單手劍', emoji: '🪄', type: 'weapon_1h', quality: 'legendary', stats: { matk: 130 }, set_id: 'elemental_sage' },
    elemental_sage_shield: { name: '元素大盾', emoji: '🪄', type: 'shield', quality: 'legendary', stats: { def: 59, mdef: 104 }, set_id: 'elemental_sage' },
    elemental_sage_hands: { name: '元素護手', emoji: '🪄', type: 'hands', quality: 'legendary', stats: { matk: 26, def: 18, mdef: 32 }, set_id: 'elemental_sage' },
    elemental_sage_legs: { name: '元素腿甲', emoji: '🪄', type: 'legs', quality: 'legendary', stats: { def: 36, mdef: 64 }, set_id: 'elemental_sage' },
    elemental_sage_feet: { name: '元素戰靴', emoji: '🪄', type: 'feet', quality: 'legendary', stats: { def: 23, mdef: 40, spd: 5 }, set_id: 'elemental_sage' },
    aegis_divine_weapon_2h: { name: '神聖雙手巨刃', emoji: '🔱', type: 'weapon_2h', quality: 'legendary', stats: { atk: 162, matk: 162, spd: -2 }, set_id: 'aegis_divine' },
    aegis_divine_head: { name: '神聖頭盔', emoji: '🔱', type: 'head', quality: 'legendary', stats: { def: 60, mdef: 60, hp: 120 }, set_id: 'aegis_divine' },
    aegis_divine_hands: { name: '神聖護手', emoji: '🔱', type: 'hands', quality: 'legendary', stats: { atk: 18, matk: 18, def: 40, mdef: 40 }, set_id: 'aegis_divine' },
    aegis_divine_legs: { name: '神聖腿甲', emoji: '🔱', type: 'legs', quality: 'legendary', stats: { def: 80, mdef: 80, hp: 160 }, set_id: 'aegis_divine' },
    aegis_divine_feet: { name: '神聖戰靴', emoji: '🔱', type: 'feet', quality: 'legendary', stats: { def: 50, mdef: 50, spd: 5 }, set_id: 'aegis_divine' },
    lord_of_chaos_weapon_2h: { name: '混沌君王雙手巨刃', emoji: '✨', type: 'weapon_2h', quality: 'legendary', stats: { atk: 198, matk: 198, spd: -2 }, set_id: 'lord_of_chaos' },
    lord_of_chaos_shield: { name: '混沌君王大盾', emoji: '✨', type: 'shield', quality: 'legendary', stats: { def: 91, mdef: 91 }, set_id: 'lord_of_chaos' },
    lord_of_chaos_head: { name: '混沌君王頭盔', emoji: '✨', type: 'head', quality: 'legendary', stats: { def: 42, mdef: 42 }, set_id: 'lord_of_chaos' },
    lord_of_chaos_legs: { name: '混沌君王腿甲', emoji: '✨', type: 'legs', quality: 'legendary', stats: { def: 56, mdef: 56 }, set_id: 'lord_of_chaos' },
    lord_of_chaos_feet: { name: '混沌君王戰靴', emoji: '✨', type: 'feet', quality: 'legendary', stats: { def: 35, mdef: 35, spd: 5 }, set_id: 'lord_of_chaos' },
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

    // 飾品與其他
    copper_ring: { name: '銅戒指', emoji: '💍', type: 'accessory', quality: 'common', stats: { atk: 2, def: 2 } },
    health_charm: { name: '生命符咒', emoji: '📿', type: 'accessory', quality: 'common', stats: { hp: 25 } },
    speed_boots: { name: '疾風靴', emoji: '👢', type: 'feet', quality: 'common', stats: { spd: 5 } },
};

export const SHOP_ITEMS = {
    consumables: [
        { id: 'hp_potion_s', name: '輕型治癒藥水', emoji: '🧪', price: 30, effect: { type: 'heal_hp', percent: 30 }, desc: '回復 30% HP' },
        { id: 'hp_potion_m', name: '中型治癒藥水', emoji: '🧪', price: 100, effect: { type: 'heal_hp', percent: 60 }, desc: '回復 60% HP' },
        { id: 'hp_potion_l', name: '強力治癒藥水', emoji: '🧪', price: 280, effect: { type: 'heal_hp', percent: 100 }, desc: '回復 100% HP' },
        { id: 'mp_potion', name: '魔力恢復藥水', emoji: '💙', price: 60, effect: { type: 'heal_mp', percent: 50 }, desc: '回復 50% MP' },
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
        { id: 'book_power_slash', name: '強力斬擊 技能書', emoji: '📖', price: 300, type: 'book', quality: 'common', desc: '學習戰士技能：強力斬擊' },
        { id: 'book_precise_shot', name: '精準目標 技能書', emoji: '📖', price: 300, type: 'book', quality: 'common', desc: '學習遊俠技能：精準目標' },
        { id: 'book_fireball', name: '火球 技能書', emoji: '📖', price: 300, type: 'book', quality: 'common', desc: '學習法師技能：火球' },
        { id: 'book_holy_strike', name: '聖威一擊 技能書', emoji: '📖', price: 300, type: 'book', quality: 'common', desc: '學習聖騎士技能：聖威一擊' },
        { id: 'book_war_guard', name: '防禦架勢 技能書', emoji: '📖', price: 600, type: 'book', quality: 'common', desc: '學習戰士技能：防禦架勢' },
        { id: 'book_agility', name: '風之疾走 技能書', emoji: '📖', price: 600, type: 'book', quality: 'common', desc: '學習遊俠技能：風之疾走' },
        { id: 'book_mana_surge', name: '魔力增幅 技能書', emoji: '📖', price: 600, type: 'book', quality: 'common', desc: '學習法師技能：魔力增幅' },
        { id: 'book_pal_protection', name: '聖光加持 技能書', emoji: '📖', price: 600, type: 'book', quality: 'common', desc: '學習聖騎士技能：聖光加持' },
        { id: 'book_war_bash', name: '盾擊 技能書', emoji: '📖', price: 1000, type: 'book', quality: 'common', desc: '學習戰士技能：盾擊' },
        { id: 'book_pal_bash', name: '制裁之錘 技能書', emoji: '📖', price: 1000, type: 'book', quality: 'common', desc: '學習聖騎士技能：制裁之錘' },
    ],
};

export const ITEM_NAMES = {
    // 近郊
    slime_gel: { name: '黏液凝膠', emoji: '🟢', sellPrice: 4 },
    boar_meat: { name: '狂暴野豬肉', emoji: '🥩', sellPrice: 7 },
    stolen_pouch: { name: '戰敗者的包裹', emoji: '💰', sellPrice: 12 },
    // 迷霧森林
    goblin_ear: { name: '惡魔之角', emoji: '👺', sellPrice: 14 },
    spider_fang: { name: '荒野狼獠牙', emoji: '🕷️', sellPrice: 18 },
    spirit_wood: { name: '精靈木', emoji: '🌳', sellPrice: 16 },
    // 龍之谷
    rock_shard: { name: '巨石碎片', emoji: '🪨', sellPrice: 40 },
    dragon_scale_mat: { name: '龍鱗素材', emoji: '🐲', sellPrice: 55 },
    chief_amulet: { name: '巴風特護符', emoji: '📿', sellPrice: 45 },
    // 海音低地
    ancient_bone: { name: '冥界骨骸', emoji: '🦴', sellPrice: 42 },
    toad_poison: { name: '腐蝕毒液', emoji: '🧪', sellPrice: 38 },
    dark_staff_frag: { name: '闇杖碎片', emoji: '🔮', sellPrice: 50 },
    // 火龍窟
    fire_core: { name: '火焰核心', emoji: '🔥', sellPrice: 90 },
    hell_fang: { name: '地獄犬牙', emoji: '🦷', sellPrice: 80 },
    lava_heart: { name: '熔岩之心', emoji: '❤️‍🔥', sellPrice: 100 },
    // 歐瑞裂隙
    void_shard: { name: '時空碎片', emoji: '💜', sellPrice: 160 },
    chaos_blade_frag: { name: '混亂之刃碎片', emoji: '⚔️', sellPrice: 200 },
    void_essence: { name: '裂隙精華', emoji: '🌀', sellPrice: 240 },
    // Boss 掉落物
    boar_king_tusk: { name: '野豬王獠牙', emoji: '🐗', sellPrice: 100 },
    // 奇岩地監
    crystal_shard: { name: '水晶碎片', emoji: '💎', sellPrice: 280 },
    mana_crystal: { name: '魔力結晶', emoji: '🎇', sellPrice: 320 },
    crystal_silk: { name: '水晶絲線', emoji: '🖧️', sellPrice: 300 },
    perfect_crystal: { name: '完美水晶心', emoji: '🤍', sellPrice: 800 },
    // 新增
    sky_shard: { name: '天空碎片', emoji: '☁️', sellPrice: 400 },
    ancient_shard: { name: '遠古能量塊', emoji: '🛡️', sellPrice: 600 },
    abyss_core_shard: { name: '深淵核心碎片', emoji: '👹', sellPrice: 1000 },
    ultimate_scroll: { name: '終極強化密卷', emoji: '📜', sellPrice: 5000 },
    // 強化卷軸
    scroll_weapon: { name: '對武器施法的卷軸', emoji: '📜', sellPrice: 200 },
    scroll_armor: { name: '對防具施法的卷軸', emoji: '📜', sellPrice: 160 },
    scroll_accessory: { name: '對飾品施法的卷軸', emoji: '📜', sellPrice: 120 },

    // 商店消耗品
    hp_potion_s: { name: '輕型治癒藥水', emoji: '🧪', sellPrice: 15 },
    hp_potion_m: { name: '中型治癒藥水', emoji: '🧪', sellPrice: 50 },
    hp_potion_l: { name: '強力治癒藥水', emoji: '🧪', sellPrice: 140 },
    mp_potion: { name: '魔力藥水', emoji: '💙', sellPrice: 30 },
    smoke_bomb: { name: '歸還卷軸', emoji: '🪶', sellPrice: 40 },
    boss_lure: { name: '精銳誘餌', emoji: '🍖', sellPrice: 200 },
    teleport_scroll: { name: '傳送符印', emoji: '📜', sellPrice: 75 },
    revive_scroll: { name: '復活卷軸', emoji: '💀', sellPrice: 200 },
    magic_shard: { name: '魔力碎片', emoji: '✨', sellPrice: 50 },
    chaos_essence: { name: '混沌精華', emoji: '🌀', sellPrice: 500 },
};


export function getItemDisplayName(itemId) {
    if (ITEM_NAMES[itemId]) return `${ITEM_NAMES[itemId].emoji} ${ITEM_NAMES[itemId].name}`;
    if (EQUIPMENT[itemId]) return `${EQUIPMENT[itemId].emoji} ${EQUIPMENT[itemId].name}`;
    const shopItem = SHOP_ITEMS.consumables.find(s => s.id === itemId)
        || SHOP_ITEMS.weapons?.find(s => s.id === itemId)
        || SHOP_ITEMS.armors?.find(s => s.id === itemId)
        || SHOP_ITEMS.accessories?.find(s => s.id === itemId)
        || SHOP_ITEMS.skillbooks?.find(s => s.id === itemId);
    if (shopItem) return `${shopItem.emoji} ${shopItem.name}`;
    if (itemId.startsWith('book_')) {
        const book = SKILL_BOOKS[itemId];
        if (book) {
            const skill = getSkillDef(book.skillId);
            return `📖 ${skill ? skill.name : itemId} 技能書`;
        }
    }
    return `📦 ${itemId}`;
}

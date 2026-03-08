// ===== RPG 技能資料 =====

export const SKILLS = {
    warrior: [
        { id: 'power_slash', name: '物理斬擊', emoji: '⚔️', mp: 4, type: 'physical', target: 'single', multiplier: 1.5, desc: 'ATK×1.5 單體物理傷害' },
        { id: 'iron_skin', name: '鋼鐵之軀', emoji: '🛡️', mp: 12, type: 'buff', target: 'self', effect: { defPercent: 30, mdefPercent: 15, turns: 3 }, desc: '自身 DEF +30%, MDEF +15% 持續 3 回合' },
        { id: 'sweep', name: '橫掃千軍', emoji: '🧹', mp: 15, type: 'physical', target: 'all', multiplier: 1.4, desc: 'ATK×1.4 全體物理傷害 (Lv.15)' },
        { id: 'whirlwind', name: '旋風斬', emoji: '🌪️', mp: 18, type: 'physical', target: 'all', multiplier: 1.2, debuff: { stat: 'spd', percent: -20, turns: 2 }, cd: 1, desc: 'ATK×1.2 全體傷害 + 減速 20% CD:1' },
        { id: 'vanguard_charge', name: '先鋒衝鋒', emoji: '🐗', mp: 20, type: 'physical', target: 'all', multiplier: 1.2, effect: { taunt: true, turns: 2 }, desc: 'ATK×1.2 全體傷害 + 嘲諷 2 回合' },
        { id: 'unyielding', name: '不屈意志', emoji: '🩸', mp: 20, type: 'buff', target: 'self', effect: { defPercent: 50, hpRegen: 10, turns: 3 }, cd: 5, desc: '自身 DEF+50% + 回血 (Lv.40) CD:5' },
        { id: 'armor_break', name: '破甲擊', emoji: '💥', mp: 15, type: 'physical', target: 'single', multiplier: 1.8, debuff: { stat: 'def', percent: -40, turns: 2 }, cd: 2, desc: 'ATK×1.8 + 目標 DEF -40% (2回合) CD:2' },
        { id: 'tyrant_slash', name: '霸王斬', emoji: '👑', mp: 50, type: 'physical', target: 'single', multiplier: 5.0, cd: 4, desc: 'ATK×5.0 極致單體毀滅 (Lv.60) CD:4' },
        { id: 'war_god_roar', name: '戰神咆哮', emoji: '🦁', mp: 40, type: 'buff', target: 'party', effect: { atkPercent: 40, turns: 3 }, cd: 5, desc: '全隊 ATK+40% (Lv.70) CD:5' },
        { id: 'earth_shatter', name: '震地碎裂', emoji: '🌍', mp: 60, type: 'physical', target: 'all', multiplier: 2.5, stunChance: 50, cd: 3, desc: 'ATK×2.5 全體傷害+暈眩 (Lv.85) CD:3' },
        { id: 'world_slash', name: '滅世斬', emoji: '⚔️', mp: 100, type: 'physical', target: 'single', multiplier: 8.5, debuff: { stat: 'all', percent: -30, turns: 3 }, cd: 6, desc: 'ATK×8.5 打擊+全削弱 (Lv.99) CD:6' },
    ],
    ranger: [
        { id: 'precise_shot', name: '精準射擊', emoji: '🎯', mp: 4, type: 'physical', target: 'single', multiplier: 1.2, spdMultiplier: 1.0, desc: 'ATK×1.2 + SPD×1.0 單體物理傷害' },
        { id: 'agility_boost', name: '靈動爆發', emoji: '💨', mp: 15, type: 'buff', target: 'self', effect: { spdPercent: 50, turns: 3 }, desc: '自身 SPD +50% 3 回合' },
        { id: 'trap_set', name: '陷阱布置', emoji: '🪤', mp: 12, type: 'debuff', target: 'all', stat: 'spd', percent: -40, turns: 2, desc: '全體 SPD-40% (Lv.15)' },
        { id: 'rapid_fire', name: '急速連射', emoji: '⚡', mp: 25, type: 'physical', target: 'single', hits: 4, multiplier: 0.7, desc: 'ATK×0.7 連擊 4 次' },
        { id: 'toxic_arrow', name: '劇毒箭', emoji: '☠️', mp: 12, type: 'physical', target: 'single', multiplier: 1.0, dot: { type: 'poison', percent: 10, turns: 2 }, desc: 'ATK×1.0 + 每回合 10% 速度倍率中毒' },
        { id: 'weakness_scan', name: '弱點偵查', emoji: '🔍', mp: 15, type: 'buff', target: 'self', effect: { critPercent: 30, critDmgPercent: 75, turns: 2 }, cd: 3, desc: '自身暴擊率+30%, 爆傷+75% CD:3' },
        { id: 'shadow_step', name: '影步', emoji: '👤', mp: 25, type: 'buff', target: 'self', effect: { dodge: 20, spdPercent: 30, turns: 2 }, cd: 3, desc: '自身閃避 +20%, SPD +30% CD:3' },
        { id: 'heart_pierce', name: '貫穿全境', emoji: '💘', mp: 55, type: 'physical', target: 'single', multiplier: 4.0, ignoreDodge: true, cd: 4, desc: 'ATK×4.0 無視閃避 (Lv.60) CD:4' },
        { id: 'spirit_eye', name: '精靈之眼', emoji: '👁️', mp: 35, type: 'buff', target: 'self', effect: { hit: 100, critPercent: 50, turns: 3 }, cd: 5, desc: '攻擊必中+暴擊率+50% CD:5' },
        { id: 'arrow_storm', name: '萬箭齊發', emoji: '🏹', mp: 65, type: 'physical', target: 'random', hits: 8, multiplier: 0.8, cd: 5, desc: '隨機 8 次 ATK×0.8 亂射 CD:5' },
        { id: 'pierce_realm', name: '貫穿全境·終', emoji: '💘', mp: 110, type: 'physical', target: 'single', multiplier: 7.0, ignoreDef: true, cd: 6, desc: 'ATK×7.0 絕對無視防禦 (Lv.99) CD:6' },
    ],
    mage: [
        { id: 'fireball', name: '火球術', emoji: '🔥', mp: 12, type: 'magical', target: 'single', multiplier: 1.2, dot: { type: 'burn', percent: 10, turns: 2 }, desc: 'MATK×1.2 + 10% 燃燒 (Lv.1)' },
        { id: 'mana_surge', name: '魔力湧動', emoji: '✨', mp: 0, type: 'buff', target: 'self', recoverMp: 40, effect: { nextDamageBoost: 2.0 }, desc: '回復 40 MP + 下次魔法傷害 2.0x (Lv.10)' },
        { id: 'frost_nova', name: '霜凍新星', emoji: '❄️', mp: 20, type: 'magical', target: 'all', multiplier: 1.0, stunChance: 40, desc: 'MATK×1.0 全體 + 40% 凍結 (減速) (Lv.15)' },
        { id: 'summon_contract', name: '召喚：龍魂契約', emoji: '🐲', mp: 30, type: 'summon', special: 'mage_summon', cd: 3, desc: '召喚龍類生物 CD:3 (Lv.15)' },
        { id: 'meteor_cluster', name: '隕石群', emoji: '☄️', mp: 40, type: 'magical', target: 'random', hits: 3, multiplier: 1.2, desc: '隨機 3 次 MATK×1.2 隕石打擊 (Lv.30)' },
        { id: 'chain_lightning', name: '雷鳴連鎖', emoji: '⚡', mp: 25, type: 'magical', target: 'all', multiplier: 1.8, desc: 'MATK×1.8 全體連鎖閃電 (Lv.35)' },
        { id: 'arcane_shield', name: '奧術護盾', emoji: '🔮', mp: 25, type: 'shield', target: 'self', shieldMultiplier: 3.0, cd: 4, desc: '獲得 MATK×3.0 的魔法護盾 CD:4 (Lv.45)' },
        { id: 'void_collapse', name: '虛空坍縮', emoji: '🌀', mp: 70, type: 'magical', target: 'all', multiplier: 5.0, cd: 5, desc: 'MATK×5.0 全體次元毀滅 (Lv.60) CD:5' },
        { id: 'space_rhythm', name: '空間律動', emoji: '🌀', mp: 45, type: 'buff', target: 'self', effect: { extraTurn: true }, cd: 5, desc: '有機率獲得額外回合 CD:5 (Lv.70)' },
        { id: 'starfall', name: '星辰崩落', emoji: '🌠', mp: 80, type: 'magical', target: 'all', multiplier: 4.5, cd: 5, desc: 'MATK×4.5 全屏隕石轟擊 (Lv.85) CD:5' },
        { id: 'dimension_annihilation', name: '次元湮滅', emoji: '🌌', mp: 130, type: 'magical', target: 'all', multiplier: 9.0, cd: 7, desc: 'MATK×9.0 終極全屏粉碎 (Lv.99) CD:7' },
    ],
    paladin: [
        { id: 'holy_strike', name: '聖光打擊', emoji: '✨', mp: 10, type: 'mixed', target: 'single', multiplier: 1.1, matkMultiplier: 1.1, undeadBonus: 2.0, desc: '1.1x 混合傷害 (對不死者 2.0x)' },
        { id: 'divine_heal', name: '神聖治癒', emoji: '💚', mp: 20, type: 'heal', target: 'single_ally', healPercent: 25, effect: { cleanse: true }, desc: '回復 25% HP 並清除負面狀態' },
        { id: 'guardian_vow', name: '守護誓約', emoji: '🛡️', mp: 30, type: 'buff', target: 'party', effect: { defPercent: 25, mdefPercent: 25, turns: 3 }, desc: '全隊雙防 +25% 3 回合' },
        { id: 'retribution', name: '制裁反擊', emoji: '⚖️', mp: 25, type: 'buff', target: 'self', effect: { reflect: 30, turns: 2 }, desc: '受物理傷害時反彈 30% 2 回合' },
        { id: 'divine_barrier', name: '神聖領域', emoji: '🕊️', mp: 40, type: 'buff', target: 'party', effect: { debuffImmunity: 1 }, desc: '全隊免疫下一次負面狀態' },
        { id: 'life_guard', name: '天啟曙光', emoji: '🌟', mp: 60, type: 'special', target: 'party', special: 'life_guard', desc: '全隊復活守護 (Lv.60)' },
        // 新增技能
        { id: 'consecration', name: '奉獻之路', emoji: '⛪', mp: 18, type: 'buff', target: 'party', effect: { hpRegen: 5, turns: 3 }, desc: '全隊每回合回 5% HP (Lv.20)' },
        { id: 'condemnation', name: '定罪一擊', emoji: '⚖️', mp: 22, type: 'mixed', target: 'single', multiplier: 1.8, matkMultiplier: 1.2, healPercent: 10, desc: '1.8x 傷害並為最低 HP 隊友回血 (Lv.45)' },
        { id: 'absolute_guard', name: '絕對防禦', emoji: '🛡️', mp: 50, type: 'buff', target: 'single_ally', effect: { invulnerable: 1 }, desc: '指定單體 1 次完全無敵 (Lv.70)' },
        { id: 'divine_field', name: '神聖領域·極', emoji: '🕊️', mp: 85, type: 'buff', target: 'party', effect: { shieldMultiplier: 5.0, hpRegen: 15, turns: 3 }, desc: '全隊超強護盾+大量回血 (Lv.85)' },
        { id: 'divine_dawn', name: '天啟聖光', emoji: '☀️', mp: 120, type: 'special', target: 'party', special: 'full_revive_guard', desc: '全隊完全復活+全能守護 (Lv.99)' },
    ],
    magic_swordsman: [
        { id: 'magic_blade', name: '魔力劍', emoji: '✨', mp: 10, type: 'mixed', target: 'single', multiplier: 1.1, matkMultiplier: 1.1, desc: '1.1x 混合傷害攻擊 (魔劍士專長提升速度)' },
        { id: 'flame_enchant', name: '火焰附魔', emoji: '🔥', mp: 20, type: 'buff', target: 'self', effect: { enchantType: 'burn', chance: 100, turns: 3 }, desc: '3 回合內普通攻擊附加灼燒' },
        { id: 'frost_slash', name: '霜凍斬', emoji: '❄️', mp: 22, type: 'mixed', target: 'single', multiplier: 1.6, matkMultiplier: 1.6, debuff: { stat: 'spd', percent: -20, turns: 2 }, desc: '1.6x 混合傷害 + 減速 20% (Lv.25)' },
        { id: 'thunder_strike', name: '雷廷一擊', emoji: '⚡', mp: 25, type: 'mixed', target: 'single', multiplier: 2.2, matkMultiplier: 2.2, stunChance: 40, desc: '2.2x 混合傷害 + 40% 麻痺 (Lv.45)' },
        { id: 'elemental_burst', name: '元素迸發', emoji: '🌈', mp: 45, type: 'magical', target: 'all', multiplier: 1.5, effect: { randomStatus: ['burn', 'poison', 'freeze'] }, desc: '1.5x 全體並隨機狀態' },
        { id: 'aether_flare', name: '乙太閃耀', emoji: '☄️', mp: 80, type: 'mixed', target: 'all', multiplier: 3.0, matkMultiplier: 3.0, cd: 4, desc: 'ATK/MATK 3.0x 全域肅清 CD:4' },
        // 新增技能
        { id: 'void_crack', name: '虛空裂痕', emoji: '🕳️', mp: 20, type: 'magical', target: 'all', multiplier: 1.2, desc: 'MATK×1.2 穿透屬性傷害 (Lv.25)' },
        { id: 'elemental_overload', name: '元素超載', emoji: '💥', mp: 30, type: 'buff', target: 'self', effect: { atkPercent: 50, matkPercent: 50, spdPercent: 50, turns: 2 }, cd: 5, desc: '自身所有攻擊大幅激增 CD:5' },
        { id: 'elem_enchant', name: '元素附魔·極', emoji: '🌈', mp: 40, type: 'buff', target: 'self', effect: { randomEnchant: true, turns: 5 }, cd: 4, desc: '隨機獲得強力屬性附體 CD:4' },
        { id: 'mana_storm', name: '魔力風暴', emoji: '🌀', mp: 90, type: 'mixed', target: 'all', multiplier: 2.5, matkMultiplier: 2.5, cd: 5, desc: 'ATK/MATK 2.5x 混合全體打擊 CD:5' },
        { id: 'chaos_unison', name: '萬象無間·終', emoji: '♾️', mp: 150, type: 'special', special: 'chaos_unity', cd: 8, desc: '所有元素最終大融合 CD:8' },
    ],
};

// ---------- 技能書（掉落學習用）----------
export const SKILL_BOOKS = {
    // Warrior
    book_power_slash: { skillId: 'power_slash', forClass: 'warrior', quality: 'common', levelReq: 1 },
    book_iron_skin: { skillId: 'iron_skin', forClass: 'warrior', quality: 'fine', levelReq: 10 },
    book_sweep: { skillId: 'sweep', forClass: 'warrior', quality: 'common', levelReq: 15 },
    book_whirlwind: { skillId: 'whirlwind', forClass: 'warrior', quality: 'rare', levelReq: 20 },
    book_vanguard_charge: { skillId: 'vanguard_charge', forClass: 'warrior', quality: 'rare', levelReq: 25 },
    book_unyielding: { skillId: 'unyielding', forClass: 'warrior', quality: 'rare', levelReq: 40 },
    book_armor_break: { skillId: 'armor_break', forClass: 'warrior', quality: 'epic', levelReq: 45 },
    book_tyrant_slash: { skillId: 'tyrant_slash', forClass: 'warrior', quality: 'mythic', levelReq: 60 },
    book_war_god_roar: { skillId: 'war_god_roar', forClass: 'warrior', quality: 'epic', levelReq: 70 },
    book_earth_shatter: { skillId: 'earth_shatter', forClass: 'warrior', quality: 'mythic', levelReq: 85 },
    book_world_slash: { skillId: 'world_slash', forClass: 'warrior', quality: 'legendary', levelReq: 99 },

    // Ranger
    book_precise_shot: { skillId: 'precise_shot', forClass: 'ranger', quality: 'common', levelReq: 1 },
    book_agility_boost: { skillId: 'agility_boost', forClass: 'ranger', quality: 'fine', levelReq: 10 },
    book_trap_set: { skillId: 'trap_set', forClass: 'ranger', quality: 'common', levelReq: 15 },
    book_rapid_fire: { skillId: 'rapid_fire', forClass: 'ranger', quality: 'rare', levelReq: 20 },
    book_toxic_arrow: { skillId: 'toxic_arrow', forClass: 'ranger', quality: 'rare', levelReq: 25 },
    book_weakness_scan: { skillId: 'weakness_scan', forClass: 'ranger', quality: 'rare', levelReq: 40 },
    book_shadow_step: { skillId: 'shadow_step', forClass: 'ranger', quality: 'epic', levelReq: 45 },
    book_heart_pierce: { skillId: 'heart_pierce', forClass: 'ranger', quality: 'mythic', levelReq: 60 },
    book_spirit_eye: { skillId: 'spirit_eye', forClass: 'ranger', quality: 'epic', levelReq: 70 },
    book_arrow_storm: { skillId: 'arrow_storm', forClass: 'ranger', quality: 'mythic', levelReq: 85 },
    book_pierce_realm: { skillId: 'pierce_realm', forClass: 'ranger', quality: 'legendary', levelReq: 99 },

    // Mage
    book_fireball: { skillId: 'fireball', forClass: 'mage', quality: 'common', levelReq: 1 },
    book_mana_surge: { skillId: 'mana_surge', forClass: 'mage', quality: 'fine', levelReq: 10 },
    book_frost_nova: { skillId: 'frost_nova', forClass: 'mage', quality: 'rare', levelReq: 15 },
    book_summon_contract: { skillId: 'summon_contract', forClass: 'mage', quality: 'fine', levelReq: 15 },
    book_meteor_cluster: { skillId: 'meteor_cluster', forClass: 'mage', quality: 'rare', levelReq: 30 },
    book_chain_lightning: { skillId: 'chain_lightning', forClass: 'mage', quality: 'rare', levelReq: 35 },
    book_arcane_shield: { skillId: 'arcane_shield', forClass: 'mage', quality: 'epic', levelReq: 45 },
    book_void_collapse: { skillId: 'void_collapse', forClass: 'mage', quality: 'mythic', levelReq: 60 },
    book_space_rhythm: { skillId: 'space_rhythm', forClass: 'mage', quality: 'epic', levelReq: 70 },
    book_starfall: { skillId: 'starfall', forClass: 'mage', quality: 'mythic', levelReq: 85 },
    book_dimension_annihilation: { skillId: 'dimension_annihilation', forClass: 'mage', quality: 'legendary', levelReq: 99 },

    // Paladin
    book_holy_strike: { skillId: 'holy_strike', forClass: 'paladin', quality: 'common', levelReq: 1 },
    book_divine_heal: { skillId: 'divine_heal', forClass: 'paladin', quality: 'fine', levelReq: 10 },
    book_guardian_vow: { skillId: 'guardian_vow', forClass: 'paladin', quality: 'rare', levelReq: 25 },
    book_retribution: { skillId: 'retribution', forClass: 'paladin', quality: 'epic', levelReq: 45 },
    book_divine_barrier: { skillId: 'divine_barrier', forClass: 'paladin', quality: 'rare', levelReq: 25 },
    book_life_guard: { skillId: 'life_guard', forClass: 'paladin', quality: 'mythic', levelReq: 60 },
    book_consecration: { skillId: 'consecration', forClass: 'paladin', quality: 'common', levelReq: 20 },
    book_condemnation: { skillId: 'condemnation', forClass: 'paladin', quality: 'rare', levelReq: 45 },
    book_absolute_guard: { skillId: 'absolute_guard', forClass: 'paladin', quality: 'epic', levelReq: 70 },
    book_divine_field: { skillId: 'divine_field', forClass: 'paladin', quality: 'mythic', levelReq: 85 },
    book_divine_dawn: { skillId: 'divine_dawn', forClass: 'paladin', quality: 'legendary', levelReq: 99 },

    // Magic Swordsman
    book_magic_blade: { skillId: 'magic_blade', forClass: 'magic_swordsman', quality: 'common', levelReq: 1 },
    book_flame_enchant: { skillId: 'flame_enchant', forClass: 'magic_swordsman', quality: 'fine', levelReq: 10 },
    book_frost_slash: { skillId: 'frost_slash', forClass: 'magic_swordsman', quality: 'rare', levelReq: 25 },
    book_thunder_strike: { skillId: 'thunder_strike', forClass: 'magic_swordsman', quality: 'epic', levelReq: 45 },
    book_elemental_burst: { skillId: 'elemental_burst', forClass: 'magic_swordsman', quality: 'rare', levelReq: 25 },
    book_aether_flare: { skillId: 'aether_flare', forClass: 'magic_swordsman', quality: 'mythic', levelReq: 60 },
    book_void_crack: { skillId: 'void_crack', forClass: 'magic_swordsman', quality: 'common', levelReq: 25 },
    book_elemental_overload: { skillId: 'elemental_overload', forClass: 'magic_swordsman', quality: 'rare', levelReq: 45 },
    book_elem_enchant: { skillId: 'elem_enchant', forClass: 'magic_swordsman', quality: 'epic', levelReq: 70 },
    book_mana_storm: { skillId: 'mana_storm', forClass: 'magic_swordsman', quality: 'mythic', levelReq: 85 },
    book_chaos_unison: { skillId: 'chaos_unison', forClass: 'magic_swordsman', quality: 'legendary', levelReq: 99 },
};

export const SKILL_BOOK_DROP_POOLS = {
    outskirts: {
        books: ['book_power_slash', 'book_precise_shot', 'book_fireball', 'book_holy_strike', 'book_magic_blade'],
        chance: 20
    },
    dark_forest: {
        books: ['book_iron_skin', 'book_agility_boost', 'book_mana_surge', 'book_divine_heal', 'book_flame_enchant', 'book_sweep', 'book_trap_set', 'book_summon_contract', 'book_consecration', 'book_void_crack'],
        chance: 18
    },
    dragon_ridge: {
        books: ['book_vanguard_charge', 'book_toxic_arrow', 'book_frost_nova', 'book_guardian_vow', 'book_frost_slash', 'book_chain_lightning'],
        chance: 12
    },
    dark_swamp: {
        books: ['book_whirlwind', 'book_rapid_fire', 'book_meteor_cluster', 'book_divine_barrier', 'book_elemental_burst'],
        chance: 10
    },
    lava_waste: {
        books: ['book_armor_break', 'book_shadow_step', 'book_arcane_shield', 'book_retribution', 'book_thunder_strike', 'book_unyielding', 'book_weakness_scan', 'book_condemnation', 'book_elemental_overload'],
        chance: 7
    },
    void_rift: {
        books: ['book_tyrant_slash', 'book_heart_pierce', 'book_void_collapse', 'book_life_guard', 'book_aether_flare', 'book_war_god_roar', 'book_spirit_eye', 'book_space_rhythm', 'book_absolute_guard', 'book_elem_enchant'],
        chance: 6
    },
    crystal_cave: {
        books: ['book_earth_shatter', 'book_arrow_storm', 'book_starfall', 'book_divine_field', 'book_mana_storm'],
        chance: 8
    },
    celestial_isles: {
        books: ['book_war_god_roar', 'book_spirit_eye', 'book_space_rhythm', 'book_absolute_guard', 'book_elem_enchant'],
        chance: 13
    },
    ancient_sanctuary: {
        books: ['book_earth_shatter', 'book_arrow_storm', 'book_starfall', 'book_divine_field', 'book_mana_storm'],
        chance: 11
    },
    abyssal_core: {
        books: ['book_world_slash', 'book_pierce_realm', 'book_dimension_annihilation', 'book_divine_dawn', 'book_chaos_unison'],
        chance: 8
    }
};

export function getSkillDef(skillId) {
    for (const cls of Object.values(SKILLS)) {
        const s = cls.find(sk => sk.id === skillId);
        if (s) return s;
    }
    return null;
}

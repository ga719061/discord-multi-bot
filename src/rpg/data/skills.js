// ===== RPG 技能資料 =====

export const SKILLS = {
    warrior: [
        { id: 'power_slash', name: '強力斬擊', emoji: '⚔️', mp: 4, type: 'physical', target: 'single', multiplier: 1.8, desc: 'ATK×1.8 單體物理重擊' },
        { id: 'iron_skin', name: '鋼鐵護體', emoji: '🛡️', mp: 12, type: 'buff', target: 'self', effect: { defPercent: 40, mdefPercent: 20, turns: 3 }, desc: '自身 DEF +40%, MDEF +20% 持續 3 回合' },
        { id: 'sweep', name: '衝擊波', emoji: '🧹', mp: 15, type: 'physical', target: 'all', multiplier: 1.2, debuff: { stat: 'spd', percent: -30, turns: 2 }, desc: 'ATK×1.2 全體傷害 + 減速 30%' },
        { id: 'whirlwind', name: '旋風斬', emoji: '🌪️', mp: 18, type: 'physical', target: 'all', multiplier: 1.3, hits: 2, cd: 1, desc: 'ATK×1.3 旋風兩連擊 CD:1' },
        { id: 'vanguard_charge', name: '衝鋒', emoji: '🐗', mp: 20, type: 'physical', target: 'single', multiplier: 2.0, stunChance: 40, effect: { taunt: true, turns: 2 }, desc: 'ATK×2.0 衝擊傷害 + 40% 眩暈 + 嘲諷' },
        { id: 'unyielding', name: '不屈', emoji: '🩸', mp: 20, type: 'buff', target: 'self', effect: { defPercent: 50, hpRegen: 15, turns: 3 }, cd: 5, desc: '自身防禦大幅提升並持續回血 CD:5' },
        { id: 'armor_break', name: '破甲', emoji: '💥', mp: 15, type: 'physical', target: 'single', multiplier: 1.8, armorPen: 50, debuff: { stat: 'def', percent: -50, turns: 3 }, cd: 2, desc: '無視 50% 防禦並大幅削弱其 DEF CD:2' },
        { id: 'tyrant_slash', name: '致命打擊', emoji: '👑', mp: 50, type: 'physical', target: 'single', multiplier: 5.5, ignoreDodge: true, cd: 4, desc: 'ATK×5.5 必中單體毀滅打擊 CD:4' },
        { id: 'war_god_roar', name: '戰神咆哮', emoji: '🦁', mp: 40, type: 'buff', target: 'party', effect: { atkPercent: 40, matkPercent: 40, turns: 3 }, cd: 5, desc: '全隊攻擊與魔攻 +40% (3回合) CD:5' },
        { id: 'earth_shatter', name: '大地屏障', emoji: '🌍', mp: 60, type: 'physical', target: 'all', multiplier: 2.8, stunChance: 60, cd: 3, desc: 'ATK×2.8 全體裂地傷害與高機率眩暈 CD:3' },
        { id: 'world_slash', name: '審判之光', emoji: '⚔️', mp: 100, type: 'physical', target: 'single', multiplier: 9.0, ignoreDef: true, debuff: { stat: 'all', percent: -40, turns: 3 }, cd: 6, desc: 'ATK×9.0 無視防禦絕對審判 CD:6' },
    ],
    ranger: [
        { id: 'precise_shot', name: '精準目標', emoji: '🎯', mp: 4, type: 'physical', target: 'single', multiplier: 1.5, critBonus: 50, ignoreDodge: true, desc: '必中且暴擊率提升 50% 的精準狙擊' },
        { id: 'agility_boost', name: '風之疾走', emoji: '💨', mp: 15, type: 'buff', target: 'self', effect: { spdPercent: 60, turns: 3, dodge: 15 }, desc: '大幅提升 SPD 與閃避率' },
        { id: 'trap_set', name: '束縛術', emoji: '🪤', mp: 12, type: 'debuff', target: 'all', debuff: { stat: 'spd', percent: -50, turns: 3 }, desc: '全體 SPD-50% 持續 3 回合' },
        { id: 'rapid_fire', name: '三重矢', emoji: '⚡', mp: 25, type: 'physical', target: 'single', hits: 3, multiplier: 1.1, desc: 'ATK×1.1 快速三連射' },
        { id: 'toxic_arrow', name: '劇毒之箭', emoji: '☠️', mp: 12, type: 'physical', target: 'single', multiplier: 1.0, dot: { type: 'poison', percent: 10, turns: 5 }, desc: 'ATK×1.0 + 極長效中毒傷害 (5回合)' },
        { id: 'weakness_scan', name: '弱點偵測', emoji: '🔍', mp: 15, type: 'buff', target: 'self', effect: { critPercent: 40, critDmgPercent: 100, turns: 2 }, cd: 3, desc: '大幅提升暴擊率與爆傷 CD:3' },
        { id: 'shadow_step', name: '暗影腳步', emoji: '👤', mp: 25, type: 'buff', target: 'self', effect: { dodge: 30, spdPercent: 40, turns: 3 }, cd: 3, desc: '進入虛實難辨的暗影狀態 CD:3' },
        { id: 'heart_pierce', name: '貫穿勇氣', emoji: '💘', mp: 55, type: 'physical', target: 'single', multiplier: 4.5, ignoreDef: true, cd: 4, desc: '無視防禦的致命穿心弩 CD:4' },
        { id: 'spirit_eye', name: '精靈之眼', emoji: '👁️', mp: 35, type: 'buff', target: 'self', effect: { critPercent: 50, atkPercent: 20, turns: 3 }, ignoreDodge: true, cd: 5, desc: '精靈守護：攻擊必中且威力提升 CD:5' },
        { id: 'arrow_storm', name: '亂箭陣', emoji: '🏹', mp: 65, type: 'physical', target: 'random', hits: 10, multiplier: 0.8, cd: 5, desc: '隨機 10 次 ATK×0.8 散射 CD:5' },
        { id: 'pierce_realm', name: '破天一箭', emoji: '🏹', mp: 110, type: 'physical', target: 'single', multiplier: 10.0, ignoreDef: true, ignoreDodge: true, cd: 6, desc: 'ATK×10.0 弒神般的貫穿一擊 CD:6' },
    ],
    mage: [
        { id: 'fireball', name: '火球', emoji: '🔥', mp: 12, type: 'magical', target: 'single', multiplier: 1.4, dot: { type: 'burn', percent: 12, turns: 3 }, desc: 'MATK×1.4 + 持續三回合燃燒损伤' },
        { id: 'mana_surge', name: '魔力增幅', emoji: '✨', mp: 0, type: 'buff', target: 'self', recoverMp: 50, effect: { matkPercent: 50, turns: 2 }, desc: '回復 50 MP 並大幅提升魔攻 CD:2' },
        { id: 'frost_nova', name: '極道落雷', emoji: '⚡', mp: 20, type: 'magical', target: 'all', multiplier: 1.5, stunChance: 45, desc: '全體強效雷擊並有機率造成眩暈' },
        { id: 'summon_contract', name: '召喚：巨龍契約', emoji: '🐲', mp: 30, type: 'summon', special: 'mage_summon', cd: 3, desc: '呼喚古代龍族助戰 CD:3' },
        { id: 'meteor_cluster', name: '落星', emoji: '☄️', mp: 40, type: 'magical', target: 'random', hits: 4, multiplier: 1.3, desc: '召喚隕石隨機轟炸 4 次' },
        { id: 'chain_lightning', name: '雷鳴連鎖', emoji: '⚡', mp: 25, type: 'magical', target: 'all', multiplier: 2.2, desc: 'MATK×2.2 強效集體閃電打擊' },
        { id: 'arcane_shield', name: '魔法屏障', emoji: '🔮', mp: 25, type: 'shield', target: 'self', shieldMultiplier: 4.0, cd: 4, desc: '構築 MATK×4.0 的強力魔力護盾 CD:4' },
        { id: 'void_collapse', name: '虛空風暴', emoji: '🌀', mp: 70, type: 'magical', target: 'all', multiplier: 6.0, cd: 5, desc: 'MATK×6.0 空間毀滅級打擊 CD:5' },
        { id: 'space_rhythm', name: '時光加速', emoji: '🌀', mp: 45, type: 'buff', target: 'self', effect: { extraTurn: true }, cd: 5, desc: '使自身時光加速，有機率獲得連攻 CD:5' },
        { id: 'starfall', name: '流星雨', emoji: '🌠', mp: 80, type: 'magical', target: 'all', multiplier: 5.5, cd: 5, desc: 'MATK×5.5 毀天滅地的流星打擊 CD:5' },
        { id: 'dimension_annihilation', name: '究極毀滅', emoji: '🌌', mp: 130, type: 'magical', target: 'all', multiplier: 12.0, cd: 7, desc: 'MATK×12.0 終結一切的座標湮滅 CD:7' },
    ],
    paladin: [
        { id: 'holy_strike', name: '聖威一擊', emoji: '✨', mp: 10, type: 'mixed', target: 'single', multiplier: 1.2, matkMultiplier: 1.2, stunChance: 25, undeadBonus: 2.0, desc: '威嚴的神聖混傷，高機率眩暈邪惡之輩' },
        { id: 'divine_heal', name: '神聖治癒', emoji: '💚', mp: 20, type: 'heal', target: 'single_ally', healPercent: 35, effect: { cleanse: true }, desc: '恢復單體 35% HP 並淨化所有負面狀態' },
        { id: 'guardian_vow', name: '守護誓約', emoji: '🛡️', mp: 30, type: 'buff', target: 'party', effect: { defPercent: 30, mdefPercent: 30, turns: 4 }, desc: '全隊防禦力大幅提升 (4回合)' },
        { id: 'retribution', name: '審判之盾', emoji: '⚖️', mp: 25, type: 'buff', target: 'self', effect: { reflect: 50, turns: 3 }, desc: '反彈 50% 受到的物理傷害 (3回合)' },
        { id: 'divine_barrier', name: '聖光加持', emoji: '🕊️', mp: 40, type: 'buff', target: 'party', effect: { debuffImmunity: 2, reduction: 20 }, desc: '全隊免疫兩次負面狀態，並獲得傷害減免' },
        { id: 'life_guard', name: '聖光救贖', emoji: '🌟', mp: 60, type: 'special', target: 'party', special: 'life_guard', desc: '古代英雄的奇蹟：全隊復活或生命保底' },
        { id: 'consecration', name: '靈魂昇華', emoji: '⛪', mp: 18, type: 'buff', target: 'party', effect: { hpRegen: 8, mpRegen: 5, turns: 3 }, desc: '全隊每回合持續回血與回魔' },
        { id: 'condemnation', name: '定罪', emoji: '⚖️', mp: 22, type: 'mixed', target: 'single', multiplier: 2.2, matkMultiplier: 1.5, healPercent: 15, desc: '懲戒打擊並將傷害轉化為群體治療' },
        { id: 'absolute_guard', name: '不壞金身', emoji: '🛡️', mp: 50, type: 'buff', target: 'single_ally', effect: { invulnerable: 1 }, desc: '使隊友進入 1 回合絕對無敵狀態 CD:5' },
        { id: 'divine_field', name: '至高神域', emoji: '🕊️', mp: 85, type: 'buff', target: 'party', effect: { shieldMultiplier: 6.0, hpRegen: 20, turns: 3 }, desc: '召喚至高境界，構築極限護盾與重生' },
        { id: 'divine_dawn', name: '究極聖療', emoji: '☀️', mp: 120, type: 'special', target: 'party', special: 'full_revive_guard', desc: '全隊完全復活並獲得神之守護' },
    ],
    magic_swordsman: [
        { id: 'magic_blade', name: '魔力奪取', emoji: '✨', mp: 10, type: 'mixed', target: 'single', drainMp: true, multiplier: 1.3, matkMultiplier: 1.3, desc: '混傷打擊目標並汲取其魔力' },
        { id: 'flame_enchant', name: '燃燒鬥志', emoji: '🔥', mp: 20, type: 'buff', target: 'self', effect: { enchantType: 'burn', chance: 100, turns: 4 }, desc: '刀刃纏繞魔焰，普攻附加持久燃燒' },
        { id: 'frost_slash', name: '極寒冰裂', emoji: '❄️', mp: 22, type: 'mixed', target: 'single', multiplier: 2.0, matkMultiplier: 2.0, debuff: { stat: 'spd', percent: -40, turns: 2 }, desc: '凍結敵人血液的混傷重擊 CD:1' },
        { id: 'thunder_strike', name: '雷霆劍氣', emoji: '⚡', mp: 25, type: 'mixed', target: 'single', multiplier: 2.5, matkMultiplier: 2.5, stunChance: 50, desc: '雷鳴閃耀的強效混傷與長效眩暈 CD:2' },
        { id: 'elemental_burst', name: '元素迸發', emoji: '🌈', mp: 45, type: 'magical', target: 'all', multiplier: 2.0, effect: { randomStatus: ['burn', 'poison', 'freeze'] }, desc: '規模混沌元素爆裂，隨機施加狀態' },
        { id: 'aether_flare', name: '乙太閃耀', emoji: '☄️', mp: 80, type: 'mixed', target: 'all', multiplier: 3.5, matkMultiplier: 3.5, cd: 4, desc: '乙太能量全場掃蕩，無視閃避 CD:4' },
        { id: 'void_crack', name: '時空裂痕', emoji: '🕳️', mp: 20, type: 'magical', target: 'all', multiplier: 1.8, ignoreDef: true, desc: '撕裂空間的絕對魔力傷害' },
        { id: 'elemental_overload', name: '元素超載', emoji: '💥', mp: 30, type: 'buff', target: 'self', effect: { atkPercent: 60, matkPercent: 60, spdPercent: 60, turns: 2 }, cd: 5, desc: '進入兩回合的極限超載狀態 CD:5' },
        { id: 'elem_enchant', name: '全元素附體', emoji: '🌈', mp: 40, type: 'buff', target: 'self', effect: { randomEnchant: true, turns: 5 }, cd: 4, desc: '獲得隨機屬性的強效魔力附魔 CD:4' },
        { id: 'mana_storm', name: '魔力風暴', emoji: '🌀', mp: 90, type: 'mixed', target: 'all', multiplier: 3.5, matkMultiplier: 3.5, cd: 5, desc: '毀滅性的元素魔力旋風 CD:5' },
        { id: 'chaos_unison', name: '萬象無間', emoji: '♾️', mp: 150, type: 'special', special: 'chaos_unity', cd: 8, desc: '混亂與秩序的終極統一 CD:8' },
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
    talking_island: {
        books: ['book_power_slash', 'book_precise_shot', 'book_fireball', 'book_holy_strike', 'book_magic_blade'],
        chance: 20
    },
    elven_forest: {
        books: ['book_iron_skin', 'book_agility_boost', 'book_mana_surge', 'book_divine_heal', 'book_flame_enchant', 'book_sweep', 'book_trap_set', 'book_summon_contract', 'book_consecration', 'book_void_crack'],
        chance: 18
    },
    gludio_dungeon_low: {
        books: ['book_whirlwind', 'book_rapid_fire', 'book_frost_nova', 'book_guardian_vow', 'book_frost_slash', 'book_chain_lightning', 'book_vanguard_charge', 'book_toxic_arrow', 'book_meteor_cluster', 'book_divine_barrier'],
        chance: 15
    },
    dragon_valley: {
        books: ['book_elemental_burst', 'book_armor_break', 'book_shadow_step', 'book_arcane_shield', 'book_retribution'],
        chance: 12
    },
    talking_island_dungeon: {
        books: ['book_thunder_strike', 'book_unyielding', 'book_weakness_scan', 'book_condemnation', 'book_elemental_overload', 'book_tyrant_slash', 'book_heart_pierce', 'book_void_collapse', 'book_life_guard'],
        chance: 10
    },
    gludio_dungeon_deep: {
        books: ['book_aether_flare', 'book_war_god_roar', 'book_spirit_eye', 'book_space_rhythm', 'book_absolute_guard', 'book_elem_enchant'],
        chance: 8
    },
    fire_dragon_cave: {
        books: ['book_earth_shatter', 'book_arrow_storm', 'book_starfall', 'book_divine_field', 'book_mana_storm'],
        chance: 10
    },
    antharas_lair: {
        books: ['book_world_slash', 'book_pierce_realm', 'book_dimension_annihilation', 'book_divine_dawn', 'book_chaos_unison'],
        chance: 12
    }
};

export function getSkillDef(skillId) {
    for (const cls of Object.values(SKILLS)) {
        const s = cls.find(sk => sk.id === skillId);
        if (s) return s;
    }
    return null;
}

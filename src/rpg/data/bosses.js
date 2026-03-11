// ===== BOSS 資料定義 =====
// 本檔案定義了所有區域 BOSS 的數值、技能與進階機制。
// 技能中的 trigger / cooldown / once 等屬性由 bossSystem.js 引擎驅動。

export const BOSSES = {

    // ========== 說話之島 ==========
    talking_island: {
        id: 'orc_king', name: '妖魔王', emoji: '👑👺',
        hp: 1200, atk: 120, def: 45, mdef: 40, spd: 20,
        xp: 500, gold: 1000,
        skills: [
            // 常規技能
            { name: '重斬', type: 'physical', multiplier: 1.8, chance: 25 },
            { name: '王之怒吼', type: 'buff', stat: 'atk', percent: 30, turns: 3, chance: 15 },
            // HP 觸發：半血狂暴
            {
                name: '妖魔王之怒', type: 'buff', trigger: 'hp_low', hpThreshold: 50, once: true,
                buffs: [{ stat: 'atk', percent: 50, turns: 99 }],
                announce: '💢 **妖魔王**的雙眼變得血紅！進入了狂暴狀態！ATK 大幅提升！'
            },
        ],
        drops: [
            { id: 'orc_king_heart', chance: 100 },
            { id: 'orcish_sword', chance: 5, isEquip: true },
            { id: 'orcish_greatsword', chance: 3, isEquip: true },
            { id: 'orcish_amulet', chance: 20, isEquip: true },
            { id: 'earring_protection', chance: 15, isEquip: true },
            { id: 'orcish_king_blade', chance: 1, isEquip: true },
            { id: 'orcish_crown', chance: 15, isEquip: true },
        ]
    },

    // ========== 精靈森林 ==========
    elven_forest: {
        id: 'corrupt_spirit', name: '汙濁精靈長', emoji: '🧚‍♂️💀',
        hp: 5000, atk: 450, matk: 550, def: 180, mdef: 300, spd: 40,
        xp: 2500, gold: 3000,
        skills: [
            { name: '精靈射擊', type: 'physical', multiplier: 1.5, hits: 2, chance: 25 },
            { name: '生命汲取', type: 'magical', multiplier: 1.8, drainHp: 0.5, chance: 20 },
            // HP 觸發：瀕死狂亂
            {
                name: '汙濁暴走', type: 'physical', trigger: 'hp_low', hpThreshold: 30, once: true,
                multiplier: 2.0, hits: 3, target: 'random',
                announce: '🌿💀 **汙濁精靈長**失去理智般地瘋狂攻擊！'
            },
        ],
        drops: [
            { id: 'spirit_wood', chance: 100 },
            { id: 'spirit_staff', chance: 20, isEquip: true },
            { id: 'forest_weapon_2h', chance: 15, isEquip: true },
        ]
    },

    // ========== 古魯丁地監 淺層 ==========
    gludio_dungeon_low: {
        id: 'caspa_family', name: '卡司柏家族', emoji: '🕵️🕵️🕵️🕵️',
        hp: 15000, atk: 800, matk: 1100, def: 500, mdef: 800, spd: 45,
        xp: 8000, gold: 12000,
        skills: [
            { name: '集體火球術', type: 'magical', multiplier: 1.5, chance: 25 },
            { name: '魔法屏障', type: 'shield', shieldMultiplier: 2.5, cooldown: 4, chance: 15 },
            // HP 觸發：合體魔法
            {
                name: '四重火焰風暴', type: 'magical', trigger: 'hp_low', hpThreshold: 40, once: true,
                multiplier: 2.5, target: 'all',
                announce: '🔥🔥🔥🔥 **卡司柏家族**集結全員魔力！釋放毀滅性的合體魔法！'
            },
        ],
        drops: [
            { id: 'caspa_cap_shard', chance: 100 },
            { id: 'caspa_cap', chance: 25, isEquip: true },
            { id: 'bone_lord_staff', chance: 15, isEquip: true },
            { id: 'wisdom_boots', chance: 20, isEquip: true },
        ]
    },

    // ========== 龍之谷 ==========
    dragon_valley: {
        id: 'black_elder', name: '黑長者', emoji: '🧙‍♂️⚡',
        hp: 55000, atk: 1800, matk: 2200, def: 2200, mdef: 4000, spd: 60,
        xp: 40000, gold: 60000,
        skills: [
            { name: '極道落雷', type: 'magical', multiplier: 2.8, chance: 30 },
            // 冷卻技：連鎖閃電
            { name: '連鎖閃電', type: 'magical', multiplier: 2.0, target: 'all', cooldown: 3, chance: 20 },
            // HP 觸發：雷牢
            {
                name: '雷牢', type: 'magical', trigger: 'hp_low', hpThreshold: 60, once: true,
                multiplier: 1.5, target: 'all',
                states: [{ stat: 'spd', percent: -60, turns: 2 }, { stunned: true, turns: 1 }],
                announce: '⚡⚡ **黑長者**展開了禁忌的雷牢結界！所有人被雷電束縛！'
            },
        ],
        drops: [
            { id: 'black_elder_bead', chance: 100 },
            { id: 'dragon_eye_amulet', chance: 15, isEquip: true },
            { id: 'dragon_scale_armor', chance: 10, isEquip: true },
            { id: 'scroll_weapon', chance: 30 },
        ]
    },

    // ========== 說話之島地監 ==========
    talking_island_dungeon: {
        id: 'baphomet', name: '巴風特', emoji: '🐐😈',
        hp: 200000, atk: 4500, matk: 5500, def: 8000, mdef: 12000, spd: 80,
        xp: 150000, gold: 200000,
        skills: [
            { name: '地裂術', type: 'magical', multiplier: 2.5, chance: 30 },
            { name: '暗影衝擊', type: 'physical', multiplier: 3.0, cooldown: 3, chance: 20 },
            // HP 觸發：石化凝視
            {
                name: '石化凝視', type: 'debuff', trigger: 'hp_low', hpThreshold: 50, once: true,
                target: 'all',
                states: [{ stat: 'spd', percent: -90, turns: 3 }],
                announce: '👁️ **巴風特**的石化魔眼睜開了！所有人被恐懼侵蝕，動彈不得！'
            },
            // 冷卻技：地獄裂縫
            {
                name: '地獄裂縫', type: 'magical', multiplier: 3.5, target: 'all', cooldown: 5, chance: 15,
                dot: { type: 'hellfire', percent: 8, turns: 3 },
            },
        ],
        drops: [
            { id: 'baphomet_soul', chance: 100 },
            { id: 'baphomet_amulet', chance: 20, isEquip: true },
            { id: 'baphomet_staff', chance: 10, isEquip: true },
            { id: 'baphomet_armor', chance: 10, isEquip: true },
        ]
    },

    // ========== 古魯丁地監 深層 ==========
    gludio_dungeon_deep: {
        id: 'death_knight', name: '死亡騎士', emoji: '🔥💀⚔️',
        hp: 650000, atk: 7500, def: 25000, mdef: 22000, spd: 100,
        xp: 800000, gold: 1200000,
        skills: [
            { name: '獄火焚身', type: 'magical', multiplier: 3.5, dot: { percent: 12, turns: 5 }, chance: 30 },
            { name: '無視防禦重擊', type: 'physical', multiplier: 4.5, ignore_def: 50, chance: 20 },
            // 冷卻技：靈魂收割
            {
                name: '靈魂收割', type: 'physical', multiplier: 3.0, drainHp: 0.3, cooldown: 4, chance: 25,
            },
            // HP 觸發：不死覺醒
            {
                name: '不死覺醒', type: 'buff', trigger: 'hp_low', hpThreshold: 50, once: true,
                buffs: [{ stat: 'atk', percent: 80, turns: 99 }, { stat: 'def', percent: -30, turns: 99 }],
                announce: '💀🔥 **死亡騎士**的盔甲崩裂了！一股不死的力量從裂縫中噴湧而出！ATK 暴增但 DEF 下降！'
            },
            // HP 觸發：獄焰領域
            {
                name: '獄焰領域', type: 'magical', trigger: 'hp_low', hpThreshold: 20, once: true,
                multiplier: 5.0, target: 'all',
                dot: { type: 'hellfire', percent: 15, turns: 3 },
                announce: '🔥🔥🔥 **死亡騎士**釋放了禁忌的終極獄焰！整個戰場陷入了火海！'
            },
        ],
        drops: [
            { id: 'dk_heart', chance: 100 },
            { id: 'chaos_ring', chance: 10, isEquip: true },
            { id: 'dk_flame_blade', chance: 5, isEquip: true },
            { id: 'dk_helmet', chance: 8, isEquip: true },
            { id: 'dk_armor', chance: 10, isEquip: true },
            { id: 'dk_gloves', chance: 8, isEquip: true },
            { id: 'dk_boots', chance: 8, isEquip: true },
        ]
    },

    // ========== 火龍窟 ==========
    fire_dragon_cave: {
        id: 'ifrit', name: '伊弗利特', emoji: '🌋🔥',
        hp: 1500000, atk: 9500, def: 80000, mdef: 90000, spd: 120,
        xp: 3000000, gold: 5000000,
        skills: [
            { name: '火焰噴射', type: 'magical', multiplier: 3.0, chance: 25 },
            // 冷卻技：烈焰結界
            { name: '烈焰結界', type: 'shield', shieldMultiplier: 3.0, cooldown: 5, chance: 20 },
            // 冷卻技：火山爆發
            {
                name: '火山爆發', type: 'magical', multiplier: 3.5, target: 'all', cooldown: 4, chance: 20,
                dot: { type: 'burn', percent: 10, turns: 3 },
            },
            // HP 觸發：滅世爆炎
            {
                name: '滅世爆炎', type: 'magical', trigger: 'hp_low', hpThreshold: 30, once: true,
                multiplier: 4.5, target: 'all',
                dot: { type: 'burn', percent: 15, turns: 5 },
                announce: '🌋💥 **伊弗利特**全身燃起了灼白色的火焰！空氣中的一切都在融化！'
            },
        ],
        drops: [
            { id: 'lava_heart', chance: 100 },
            { id: 'emperor_crown', chance: 1, isEquip: true },
            { id: 'lava_dragon_core', chance: 15, isEquip: true },
            { id: 'volcanic_greatsword', chance: 2, isEquip: true },
        ]
    },

    // ========== 安塔瑞斯棲息地 ==========
    antharas_lair: {
        id: 'antharas', name: '地龍 安塔瑞斯', emoji: '🐉',
        hp: 8000000, atk: 12500, def: 300000, mdef: 400000, spd: 160,
        xp: 20000000, gold: 50000000,
        skills: [
            { name: '毒霧噴息', type: 'magical', multiplier: 4.5, target: 'all', dot: { type: 'poison', percent: 15, turns: 5 }, chance: 30 },
            { name: '地裂巨震', type: 'physical', multiplier: 5.5, target: 'all', chance: 25 },
            // 冷卻技：龍之威壓
            {
                name: '龍之威壓', type: 'debuff', target: 'all', cooldown: 8, chance: 15,
                states: [{ stat: 'def', percent: -20, turns: 5 }, { stat: 'mdef', percent: -20, turns: 5 }],
                announce: '🐉 **安塔瑞斯**張開了龐大的雙翼！壓倒性的威壓令全場防禦崩塌！'
            },
            // HP 觸發：滅世巨震
            {
                name: '滅世巨震', type: 'physical', trigger: 'hp_low', hpThreshold: 25, once: true,
                multiplier: 7.0, target: 'all',
                states: [{ stunned: true, turns: 2 }],
                announce: '🌍💥 **安塔瑞斯**以全身之力踐踏大地！空間扭曲了——滅世巨震！'
            },
            // 復活機制：不死龍魂
            {
                name: '不死龍魂', type: 'revive', hpPercent: 30,
                buff: { stat: 'atk', percent: 100, turns: 99 },
                announce: '🐉💀 **安塔瑞斯**的龍核閃爍著詭異的光芒... 地龍從死亡中甦醒了！'
            },
        ],
        drops: [
            { id: 'earth_dragon_scale', chance: 100 },
            { id: 'dragonslayer', chance: 5, isEquip: true },
            { id: 'antharas_plate', chance: 10, isEquip: true },
            { id: 'invisi_cloak', chance: 5, isEquip: true },
            { id: 'jiji_crown', chance: 1, isEquip: true },
            { id: 'jiji_chaos_crown', chance: 0.1, isEquip: true },
        ]
    },
};


const fs = require('fs');
const filePath = 'w:\\dc\\src\\rpg\\data\\items.js';
let content = fs.readFileSync(filePath, 'utf8');

// The parts we want to restore
const SHOP_EQUIPMENT = `    // ===== 商店基本裝備 =====
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
        { id: 'hp_potion_s', name: '小型回復藥水', emoji: '🧪', price: 30, effect: { type: 'heal_hp', percent: 30 }, desc: '回復 30% HP' },
        { id: 'hp_potion_m', name: '中型回復藥水', emoji: '🧪', price: 100, effect: { type: 'heal_hp', percent: 60 }, desc: '回復 60% HP' },
        { id: 'hp_potion_l', name: '大型回復藥水', emoji: '🧪', price: 280, effect: { type: 'heal_hp', percent: 100 }, desc: '回復 100% HP' },
        { id: 'mp_potion', name: '魔力藥水', emoji: '💙', price: 60, effect: { type: 'heal_mp', percent: 50 }, desc: '回復 50% MP' },
        { id: 'smoke_bomb', name: '逃脫煙霧彈', emoji: '🪶', price: 80, effect: { type: 'escape' }, desc: '戰鬥中 100% 逃跑成功' },
        { id: 'teleport_scroll', name: '傳送卷軸', emoji: '📜', price: 150, effect: { type: 'teleport' }, desc: '傳送回王國' },
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
        { id: 'book_power_slash', name: '猛力斬擊 技能書', emoji: '📖', price: 300, type: 'book', quality: 'common', desc: '學習戰士技能：猛力斬擊' },
        { id: 'book_precise_shot', name: '精準射擊 技能書', emoji: '📖', price: 300, type: 'book', quality: 'common', desc: '學習遊俠技能：精準射擊' },
        { id: 'book_fireball', name: '火球術 技能書', emoji: '📖', price: 300, type: 'book', quality: 'common', desc: '學習法師技能：火球術' },
        { id: 'book_holy_strike', name: '聖光打擊 技能書', emoji: '📖', price: 300, type: 'book', quality: 'common', desc: '學習聖騎士技能：聖光打擊' },
        { id: 'book_war_guard', name: '防禦架勢 技能書', emoji: '📖', price: 600, type: 'book', quality: 'common', desc: '學習戰士技能：防禦架勢' },
        { id: 'book_agility', name: '靈動 技能書', emoji: '📖', price: 600, type: 'book', quality: 'common', desc: '學習遊俠技能：靈動' },
        { id: 'book_mana_surge', name: '魔力湧動 技能書', emoji: '📖', price: 600, type: 'book', quality: 'common', desc: '學習法師技能：魔力湧動' },
        { id: 'book_pal_protection', name: '聖光加持 技能書', emoji: '📖', price: 600, type: 'book', quality: 'common', desc: '學習聖騎士技能：聖光加持' },
        { id: 'book_war_bash', name: '盾擊 技能書', emoji: '📖', price: 1000, type: 'book', quality: 'common', desc: '學習戰士技能：盾擊' },
        { id: 'book_pal_bash', name: '制裁之錘 技能書', emoji: '📖', price: 1000, type: 'book', quality: 'common', desc: '學習聖騎士技能：制裁之錘' },
    ],
};`;

const DISP_NAME_FUNC = `export function getItemDisplayName(itemId) {
    if (ITEM_NAMES[itemId]) return \`\${ITEM_NAMES[itemId].emoji} \${ITEM_NAMES[itemId].name}\`;
    if (EQUIPMENT[itemId]) return \`\${EQUIPMENT[itemId].emoji} \${EQUIPMENT[itemId].name}\`;
    const shopItem = SHOP_ITEMS.consumables.find(s => s.id === itemId)
        || SHOP_ITEMS.weapons?.find(s => s.id === itemId)
        || SHOP_ITEMS.armors?.find(s => s.id === itemId)
        || SHOP_ITEMS.accessories?.find(s => s.id === itemId)
        || SHOP_ITEMS.skillbooks?.find(s => s.id === itemId);
    if (shopItem) return \`\${shopItem.emoji} \${shopItem.name}\`;
    if (itemId.startsWith('book_')) {
        const book = SKILL_BOOKS[itemId];
        if (book) {
            const skill = getSkillDef(book.skillId);
            return \`📖 \${skill ? skill.name : itemId} 技能書\`;
        }
    }
    return \`📦 \${itemId}\`;
}`;

// 1. Restore equipment and SHOP_ITEMS
const equipmentEnd = 'lord_of_chaos_feet: { name: \'混沌君王戰靴\', emoji: \'✨\', type: \'feet\', quality: \'legendary\', stats: { def: 35, mdef: 35, spd: 5 }, set_id: \'lord_of_chaos\' },';
const itemNamesStart = 'export const ITEM_NAMES = {';

// Find the last good equipment
let newContent = content.substring(0, content.indexOf(equipmentEnd) + equipmentEnd.length) + "\n" + SHOP_EQUIPMENT + "\n";

// Find ITEM_NAMES start
let itemNamesPartIndex = content.indexOf(itemNamesStart);
let itemNamesPart = content.substring(itemNamesPartIndex);
// Fix ITEM_NAMES content - remove corrupted part at the end
let endMark = 'mp_potion: { name: \'魔力藥水\', emoji: \'💙\', sellPrice: 30 },';
let itemNamesCore = itemNamesPart.substring(0, itemNamesPart.indexOf(endMark) + endMark.length);

itemNamesCore += `
    smoke_bomb: { name: '逃脫煙霧彈', emoji: '🪶', sellPrice: 40 },
    boss_lure: { name: '首領誘餌', emoji: '🍖', sellPrice: 200 },
    teleport_scroll: { name: '傳送卷軸', emoji: '📜', sellPrice: 75 },
    revive_scroll: { name: '復活卷軸', emoji: '💀', sellPrice: 200 },
    magic_shard: { name: '魔力碎片', emoji: '✨', sellPrice: 50 },
    chaos_essence: { name: '混沌精華', emoji: '🌀', sellPrice: 500 },
};`;

newContent += itemNamesCore + "\n\n" + DISP_NAME_FUNC + "\n";

fs.writeFileSync(filePath, newContent);
console.log('Successfully repaired items.js');

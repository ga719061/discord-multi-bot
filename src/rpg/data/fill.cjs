const fs = require('fs');

const itemsPath = 'w:/dc/src/rpg/data/items.js';
const gameDataPath = 'w:/dc/src/rpg/data/gameData.js';

let itemsContent = fs.readFileSync(itemsPath, 'utf8');
let gameDataContent = fs.readFileSync(gameDataPath, 'utf8');

const SETS = {
    slime_set: { quality: 'common', prefix: '史萊姆', emoji: '🟢', base: { def: 4, mdef: 4, hp: 15 }, monster: 'slime' },
    goblin_set: { quality: 'fine', prefix: '哥布林', emoji: '👺', base: { atk: 15, def: 10, hp: 25 }, monster: 'goblin' },
    dragon_set: { quality: 'rare', prefix: '龍鱗', emoji: '🐉', base: { atk: 25, def: 20, mdef: 15, hp: 40 }, monster: 'young_dragon' },
    skywalker_set: { quality: 'legendary', prefix: '天空', emoji: '☁️', base: { atk: 80, def: 50, mdef: 50, spd: 40 }, monster: 'cloud_spirit' },
    ancient_gods_set: { quality: 'legendary', prefix: '遠古', emoji: '🛡️', base: { atk: 90, matk: 90, def: 65, mdef: 65, hp: 120 }, monster: 'temple_guardian' },
    abyss_master_set: { quality: 'legendary', prefix: '深淵', emoji: '👹', base: { atk: 110, def: 80, mdef: 80, hp: 150 }, monster: 'abyss_beast' },
    void_set: { quality: 'epic', prefix: '虛空', emoji: '🌀', base: { atk: 50, matk: 50, def: 30, mdef: 30 }, monster: 'void_walker' },
    chaos_set: { quality: 'epic', prefix: '混沌', emoji: '⚔️', base: { atk: 55, matk: 55, def: 35, mdef: 25 }, monster: 'chaos_knight' },
    crystal_set: { quality: 'epic', prefix: '水晶', emoji: '💎', base: { atk: 50, matk: 40, def: 40, mdef: 35 }, monster: 'crystal_golem' },
    mana_set: { quality: 'epic', prefix: '魔力結晶', emoji: '🎇', base: { matk: 60, def: 25, mdef: 45, mp: 60 }, monster: 'crystal_golem' },
    stone_set: { quality: 'fine', prefix: '堅石', emoji: '🪨', base: { atk: 18, def: 22, mdef: 10 }, monster: 'stone_giant' },
    bone_set: { quality: 'rare', prefix: '白骨', emoji: '🦴', base: { atk: 30, matk: 25, def: 18, mdef: 18 }, monster: 'skeleton' },
    nature_relics: { quality: 'rare', prefix: '自然', emoji: '🌿', base: { matk: 30, def: 18, mdef: 22, hp: 20 }, monster: 'tree_spirit' },

    ares_wrath: { quality: 'epic', prefix: '戰神', emoji: '⚔️', base: { atk: 70, def: 45, mdef: 30, hp: 80 }, monster: 'crystal_emperor', isBoss: true },
    windwalker: { quality: 'epic', prefix: '疾風', emoji: '🏹', base: { atk: 65, def: 35, mdef: 35, spd: 18 }, monster: 'crystal_emperor', isBoss: true },
    arcane_scholar: { quality: 'epic', prefix: '秘法', emoji: '🔮', base: { matk: 70, def: 25, mdef: 45, mp: 80 }, monster: 'crystal_emperor', isBoss: true },
    radiant_cross: { quality: 'epic', prefix: '光輝', emoji: '🛡️', base: { atk: 55, matk: 55, def: 50, mdef: 50 }, monster: 'crystal_emperor', isBoss: true },
    phantom_blade: { quality: 'epic', prefix: '幻影', emoji: '✨', base: { atk: 60, matk: 60, def: 35, mdef: 35 }, monster: 'crystal_emperor', isBoss: true },

    overlord_plate: { quality: 'legendary', prefix: '霸王', emoji: '🪖', base: { atk: 120, def: 80, mdef: 50, hp: 150 }, monster: 'temple_guardian' },
    starborn_hunter: { quality: 'legendary', prefix: '星辰', emoji: '🌌', base: { atk: 110, def: 60, mdef: 60, spd: 30 }, monster: 'cloud_spirit'},
    elemental_sage: { quality: 'legendary', prefix: '元素', emoji: '🪄', base: { matk: 130, def: 45, mdef: 80, mp: 120 }, monster: 'temple_guardian' },
    aegis_divine: { quality: 'legendary', prefix: '神聖', emoji: '🔱', base: { atk: 90, matk: 90, def: 100, mdef: 100, hp: 200 }, monster: 'temple_guardian' },
    lord_of_chaos: { quality: 'legendary', prefix: '混沌君王', emoji: '✨', base: { atk: 110, matk: 110, def: 70, mdef: 70 }, monster: 'chaos_knight' },
};

const TYPES_DEF = [
    { id: 'weapon_1h', t: 'weapon_1h', n: '單手劍', m: { atk: 1.0, matk: 1.0, spd: 1.0 } },
    { id: 'weapon_2h', t: 'weapon_2h', n: '雙手巨刃', m: { atk: 1.8, matk: 1.8, spd: -2 } },
    { id: 'shield', t: 'shield', n: '大盾', m: { def: 1.3, mdef: 1.3, hp: 1.0 } },
    { id: 'head', t: 'head', n: '頭盔', m: { def: 0.6, mdef: 0.6, hp: 0.6 } },
    { id: 'body', t: 'body', n: '重甲', m: { def: 1.5, mdef: 1.5, hp: 1.5 } },
    { id: 'hands', t: 'hands', n: '護手', m: { def: 0.4, mdef: 0.4, atk: 0.2, matk: 0.2 } },
    { id: 'legs', t: 'legs', n: '腿甲', m: { def: 0.8, mdef: 0.8, hp: 0.8 } },
    { id: 'feet', t: 'feet', n: '戰靴', m: { def: 0.5, mdef: 0.5, spd: 5 } },
    { id: 'accessory', t: 'accessory', n: '戒指', m: { atk: 0.3, matk: 0.3, def: 0.3, mdef: 0.3, hp: 0.5, mp: 0.5 } }
];

let itemsLines = itemsContent.split('\n');
let itemsEndIdx = itemsLines.findIndex(l => l.includes('// ===== 商店基本裝備 =====')); 

let newItemsLines = [];
let dropsToAdd = {}; 

for (const [setId, setInfo] of Object.entries(SETS)) {
    let existingParts = {};
    for (const line of itemsLines) {
        if (line.includes(`set_id: '${setId}'`)) {
            let matchType = line.match(/type:\s*'([^']+)'/);
            if (matchType) {
                existingParts[matchType[1]] = true;
                let matchId = line.match(/^\s*([a-zA-Z0-9_]+):/);
                if (matchId) {
                    if (!dropsToAdd[setInfo.monster]) dropsToAdd[setInfo.monster] = [];
                    dropsToAdd[setInfo.monster].push(matchId[1]);
                }
            }
        }
    }

    for (const tDef of TYPES_DEF) {
        if (!existingParts[tDef.id]) {
            let genId = `${setId.replace('_set', '')}_${tDef.id}`;
            let name = `${setInfo.prefix}${tDef.n}`;
            
            let stats = {};
            for (const [sKey, sVal] of Object.entries(setInfo.base)) {
                if (tDef.m[sKey] !== undefined) {
                    stats[sKey] = Math.max(1, Math.round(sVal * tDef.m[sKey]));
                }
            }
            if (tDef.id === 'weapon_2h' && stats.spd === undefined) stats.spd = -2;
            else if (tDef.id === 'feet') stats.spd = Math.max(2, (setInfo.base.spd || 0) + 5);

            let statsStr = Object.entries(stats).map(([k, v]) => `${k}: ${v}`).join(', ');
            let line = `    ${genId}: { name: '${name}', emoji: '${setInfo.emoji}', type: '${tDef.t}', quality: '${setInfo.quality}', stats: { ${statsStr} }, set_id: '${setId}' },`;
            newItemsLines.push(line);
            
            if (!dropsToAdd[setInfo.monster]) dropsToAdd[setInfo.monster] = [];
            dropsToAdd[setInfo.monster].push(genId);
        }
    }
}

itemsLines.splice(itemsEndIdx, 0, '    // ===== 自動補齊的新增套裝部件 =====', ...newItemsLines, '');
fs.writeFileSync(itemsPath, itemsLines.join('\n'));

for (const monsterId of Object.keys(dropsToAdd)) {
    let itemsForMonster = [...new Set(dropsToAdd[monsterId])];
    
    let isBoss = false;
    for (const s of Object.values(SETS)) {
        if (s.monster === monsterId && s.isBoss) {
            isBoss = true;
        }
    }

    let mRegex = new RegExp(`id:\\s*'${monsterId}'[^]*?drops:\\s*\\[([^\\]]*)\\]`);
    let match = gameDataContent.match(mRegex);
    if (!match) {
        console.log("Could not find drop pool for " + monsterId);
        continue;
    }

    let existingDropsText = match[1];
    
    let addedText = '';
    for (let itemId of itemsForMonster) {
        if (!existingDropsText.includes(`id: '${itemId}'`)) {
            let quality = 'common';
            // find quality
            let itemLine = itemsLines.find(l => l.includes(` ${itemId}: `));
            if (!itemLine) itemLine = newItemsLines.find(l => l.includes(` ${itemId}: `));
            
            if (itemLine) {
                let qMatch = itemLine.match(/quality:\s*'([^']+)'/);
                if (qMatch) quality = qMatch[1];
            }
            
            let baseChance = 2;
            if (isBoss) {
                baseChance = quality === 'legendary' ? 1.0 : (quality === 'epic' ? 3.0 : 5.0);
            } else {
                if (quality === 'legendary') baseChance = 0.5;
                if (quality === 'epic') baseChance = 1.0;
                if (quality === 'rare') baseChance = 2.0;
                if (quality === 'fine') baseChance = 4.0;
                if (quality === 'common') baseChance = 8.0;
            }

            addedText += `\n                { id: '${itemId}', chance: ${baseChance}, isEquip: true },`;
        }
    }
    
    if (addedText) {
        let newDropsText = existingDropsText.replace(/\s+$/, '') + addedText + '\n            ';
        let newMonsterText = match[0].replace(existingDropsText, newDropsText);
        gameDataContent = gameDataContent.replace(match[0], newMonsterText);
    }
}

fs.writeFileSync(gameDataPath, gameDataContent);
console.log('Script completed.');

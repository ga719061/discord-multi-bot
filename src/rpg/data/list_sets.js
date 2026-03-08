import { EQUIPMENT } from './items.js';
import { SET_REGISTRY } from './gameData.js';

let output = [];
for (let [setId, set] of Object.entries(SET_REGISTRY)) {
    let parts = [];
    for (let [id, eq] of Object.entries(EQUIPMENT)) {
        if (eq.set_id === setId) {
            parts.push(`${eq.emoji}${eq.name} (${getTypeName(eq.type)})`);
        }
    }
    if (parts.length > 0) {
        output.push(`**${set.name}**\n> ${parts.join(', ')}`);
    }
}

function getTypeName(type) {
    const map = {
        'weapon_1h': '單手武器', 'weapon_2h': '雙手武器', 'shield': '盾牌',
        'head': '頭部', 'body': '身體', 'hands': '手部', 'legs': '腿部', 'feet': '腳部', 'accessory': '飾品'
    };
    return map[type] || type;
}

console.log(output.join('\n\n'));

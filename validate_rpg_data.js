import { EQUIPMENT, ITEM_NAMES as ITEMS, AREAS, MONSTERS, SET_REGISTRY, SHOP_ITEMS, SUMMON_RECIPES } from './src/rpg/data/gameData.js';

console.log('--- RPG Data Integrity Check ---');
let errors = 0;

function check(cond, msg) {
    if (!cond) {
        console.error('❌ ' + msg);
        errors++;
    }
}

// 1. Check Monster Drops
for (const area of Object.keys(MONSTERS)) {
    for (const mob of MONSTERS[area]) {
        if (mob.drops) {
            for (const drop of mob.drops) {
                const item = EQUIPMENT[drop.id] || ITEMS[drop.id];
                check(item, `Mob "${mob.id}" drops unknown item "${drop.id}"`);
            }
        }
    }
}

// 2. Check Set Consistency
for (const [id, def] of Object.entries(EQUIPMENT)) {
    if (def.set_id) {
        check(SET_REGISTRY[def.set_id], `Item "${id}" references unknown set_id "${def.set_id}"`);
    }
}

// 3. Check Quest/Summon targets
for (const [id, recipe] of Object.entries(SUMMON_RECIPES || {})) {
    if (recipe.ingredients) {
        recipe.ingredients.forEach(m => {
            const item = EQUIPMENT[m.id] || ITEMS[m.id];
            check(item, `Summon recipe for "${id}" needs unknown item "${m.id}"`);
        });
    }
}

if (errors === 0) {
    console.log('✅ ALL CHECKS PASSED');
    process.exit(0);
} else {
    console.log(`\n❌ FOUND ${errors} ERRORS`);
    process.exit(1);
}

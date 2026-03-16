const { EQUIPMENT } = require('./src/rpg/data/items.js');

function verifyBuffs() {
    const items = ['caspa_cap', 'wisdom_boots'];
    
    console.log('--- Verifying Boss Item Buffs ---');
    items.forEach(id => {
        const item = EQUIPMENT[id];
        if (!item) {
            console.error(`❌ Item ${id} not found!`);
            return;
        }
        console.log(`\nItem ID: ${id}`);
        console.log(`Name: ${item.name}`);
        console.log(`Quality: ${item.quality}`);
        console.log(`Stats: ${JSON.stringify(item.stats)}`);
        console.log(`Desc: ${item.desc}`);
    });
}

try {
    verifyBuffs();
} catch (e) {
    console.error(e);
}

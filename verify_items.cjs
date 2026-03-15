const { SHOP_ITEMS, ITEM_NAMES } = require('./src/rpg/data/gameData.js');

console.log('Verifying consumable items effects...');

let errors = 0;
SHOP_ITEMS.consumables.forEach(item => {
    const effect = item.effect || ITEM_NAMES[item.id]?.effect;
    if (!effect) {
        console.error(`❌ Item ${item.id} (${item.name}) is missing an effect!`);
        errors++;
    } else {
        console.log(`✅ Item ${item.id} (${item.name}) has effect: ${JSON.stringify(effect)}`);
    }
});

if (errors === 0) {
    console.log('\nAll consumable items verified successfully!');
} else {
    console.error(`\nFound ${errors} items with missing effects.`);
    process.exit(1);
}

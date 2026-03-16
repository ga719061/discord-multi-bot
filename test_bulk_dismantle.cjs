const { addEquipment, getEquipmentList, getInventory, addToInventory, removeMultipleEquipment, initRpgTables, getDb, createCharacter } = require('./src/rpg/rpgDatabase.js');
const { initDatabase } = require('./src/utils/database.js');
const { handleBulkDismantle } = require('./src/rpg/screens/blacksmith.js');

// Mock interaction
const interaction = {
    user: { id: 'test_user', displayName: 'Tester' },
    guildId: 'test_guild',
    reply: async (payload) => console.log('Reply:', JSON.stringify(payload, null, 2)),
    update: async (payload) => console.log('Update:', JSON.stringify(payload, null, 2)),
    editReply: async (payload) => console.log('EditReply:', JSON.stringify(payload, null, 2)),
    isButton: () => true,
    isStringSelectMenu: () => false,
    replied: false,
    deferred: false
};

async function runTest() {
    console.log('Initializing Database...');
    initDatabase();
    initRpgTables();

    console.log('Testing Bulk Dismantle...');
    
    const guildId = 'test_guild';
    const userId = 'test_user';

    // Create dummy character if not exists
    try {
        createCharacter(guildId, userId, { race: 'Human', class: 'Warrior' });
    } catch (e) {
        // Ignore if already exists
    }

    // 1. Create dummy items
    console.log('Creating dummy items...');
    for (let i = 0; i < 5; i++) {
        addEquipment(guildId, userId, 'rusty_sword', 'common', 1);
    }
    
    let eqList = getEquipmentList(guildId, userId).filter(eq => eq.quality === 'common');
    console.log(`Found ${eqList.length} common items.`);

    // 2. Call handleBulkDismantle
    console.log('Invoking handleBulkDismantle for "common"...');
    await handleBulkDismantle(interaction, 'common');

    // 3. Verify
    eqList = getEquipmentList(guildId, userId).filter(eq => eq.quality === 'common');
    console.log(`Remaining common items: ${eqList.length}`);
    
    if (eqList.length === 0) {
        console.log('✅ Bulk deletion successful!');
    } else {
        console.error('❌ Bulk deletion failed!');
    }

    const inv = getInventory(guildId, userId);
    const shards = inv.find(i => i.item_id === 'magic_shard');
    console.log(`Inventory Shards: ${shards ? shards.quantity : 0}`);
    
    if (shards && shards.quantity > 0) {
        console.log('✅ Rewards added successfully!');
    } else {
        console.error('❌ Rewards missing!');
    }
}

runTest().catch(console.error);

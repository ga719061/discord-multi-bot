import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../data/bot.db');
console.log(`🔍 Checking database at: ${dbPath}`);

try {
    const db = new Database(dbPath);

    const tables = ['rpg_inventory', 'rpg_equipment', 'rpg_battles'];

    tables.forEach(table => {
        console.log(`\n--- Table: ${table} ---`);
        const info = db.pragma(`table_info(${table})`);
        const columns = info.map(c => c.name);
        console.log(`Columns: ${columns.join(', ')}`);

        if (table === 'rpg_inventory' || table === 'rpg_equipment') {
            if (columns.includes('stashed')) {
                console.log('✅ "stashed" column exists.');
            } else {
                console.log('❌ "stashed" column MISSING!');
            }
        }

        if (table === 'rpg_battles') {
            if (columns.includes('ally_summons')) {
                console.log('✅ "ally_summons" column exists.');
            } else {
                console.log('❌ "ally_summons" column MISSING!');
            }
        }

        if (table === 'rpg_inventory') {
            const indexes = db.pragma(`index_list(${table})`);
            console.log(`Indexes: ${indexes.map(i => i.name).join(', ')}`);

            const hasCorrectUnique = indexes.some(idx => {
                const idxInfo = db.pragma(`index_info(${idx.name})`);
                const cols = idxInfo.map(c => c.name);
                return cols.includes('guild_id') && cols.includes('user_id') && cols.includes('item_id') && cols.includes('stashed');
            });

            if (hasCorrectUnique) {
                console.log('✅ Unique constraint (guild_id, user_id, item_id, stashed) exists.');
            } else {
                console.log('❌ Correct Unique constraint MISSING!');
            }
        }
    });

    db.close();
} catch (err) {
    console.error('❌ Error reading database:', err.message);
}

const { EQUIPMENT, MONSTERS } = require('./src/rpg/data/gameData.js');
const { BOSSES } = require('./src/rpg/data/bosses.js');

const newWeapons = [
    'elf_dagger', 'katana', 'chain_mail_breaker', 'crossbow', 
    'yumi_bow', 'power_staff', 'crystal_staff', 'mana_staff', 
    'damascus_sword', 'thunder_sword'
];

console.log('--- Verifying Lineage Weapons Existence ---');
newWeapons.forEach(id => {
    if (EQUIPMENT[id]) {
        console.log(`✅ [EQUIPMENT] Found: ${id} (${EQUIPMENT[id].name})`);
    } else {
        console.error(`❌ [EQUIPMENT] Missing: ${id}`);
        process.exit(1);
    }
});

console.log('\n--- Verifying Drop Pool References ---');
let foundInDrops = new Set();

Object.values(MONSTERS).forEach(areaMonsters => {
    areaMonsters.forEach(m => {
        if (m.drops) {
            m.drops.forEach(d => {
                if (newWeapons.includes(d.id)) {
                    foundInDrops.add(d.id);
                    console.log(`✅ [MONSTER] ${m.name} drops ${d.id}`);
                }
            });
        }
    });
});

Object.values(BOSSES).forEach(b => {
    if (b.drops) {
        b.drops.forEach(d => {
            if (newWeapons.includes(d.id)) {
                foundInDrops.add(d.id);
                console.log(`✅ [BOSS] ${b.name} drops ${d.id}`);
            }
        });
    }
});

newWeapons.forEach(id => {
    if (!foundInDrops.has(id)) {
        console.warn(`⚠️ [WARNING] Weapon ${id} is defined but not found in any drop pool.`);
    }
});

console.log('\nVerification complete!');

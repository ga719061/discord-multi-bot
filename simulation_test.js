import { EQUIPMENT, ITEM_NAMES, MONSTERS, AREAS, SET_REGISTRY, SHOP_ITEMS, SUMMON_RECIPES, SKILL_BOOK_DROP_POOLS, BOSSES } from './src/rpg/data/gameData.js';
import { testCombatLogs } from './log_test_helper.js';

console.log('🚀 --- RPG Simulation & Stress Test --- 🚀\n');

let totalErrors = 0;
function logError(msg) {
    console.error(`❌ [ERROR] ${msg}`);
    totalErrors++;
}

// 1. 商店與名稱系統自動化校驗
console.log('--- [1/5] 商店與名稱一致性檢查 ---');
for (const category in SHOP_ITEMS) {
    SHOP_ITEMS[category].forEach(item => {
        const source = EQUIPMENT[item.id] || ITEM_NAMES[item.id];
        if (!source) logError(`商店物品 "${item.id}" (類別: ${category}) 在 EQUIPMENT 或 ITEM_NAMES 中找不到原始定義！`);
    });
}
console.log('✅ 商店校驗完成\n');

// 2. 掉落池模擬測試 (每個怪物模擬 500 次掉落)
console.log('--- [2/5] 掉落池動態模擬 (500 次/怪) ---');
const dropStats = {};

for (const area of Object.keys(MONSTERS)) {
    MONSTERS[area].forEach(mob => {
        if (!mob.drops) return;
        
        for (let i = 0; i < 500; i++) {
            mob.drops.forEach(drop => {
                if (Math.random() * 100 < drop.chance) {
                    const itemId = drop.id;
                    const exists = EQUIPMENT[itemId] || ITEM_NAMES[itemId];
                    if (!exists) {
                        logError(`怪物 "${mob.name}" (${mob.id}) 掉落無效 ID: "${itemId}"`);
                    }
                    dropStats[itemId] = (dropStats[itemId] || 0) + 1;
                }
            });
        }
    });
}
console.log(`✅ 掉落模擬完成 (共模擬產出 ${Object.keys(dropStats).length} 種不同物品)\n`);

// 3. 召喚配方與技能書掉落池校驗
console.log('--- [3/5] 召喚配方與技能書掉落池校驗 ---');
for (const [areaId, recipe] of Object.entries(SUMMON_RECIPES)) {
    recipe.ingredients.forEach(ing => {
        if (!ITEM_NAMES[ing.id]) {
            logError(`祭壇召喚 (${areaId}) 需求素材 "${ing.id}" 不存在於 ITEM_NAMES 中！`);
        }
    });
}
for (const areaId of Object.keys(MONSTERS)) {
    if (!SKILL_BOOK_DROP_POOLS[areaId]) {
        logError(`區域 "${areaId}" 缺失 SKILL_BOOK_DROP_POOLS 定義！`);
    } else {
        SKILL_BOOK_DROP_POOLS[areaId].books.forEach(bookId => {
            if (!ITEM_NAMES[bookId]) logError(`技能書池 (${areaId}) 包含無效 ID: "${bookId}"`);
        });
    }
}
console.log('✅ 召喚與技能書池校驗完成\n');

// 4. 套裝註冊校驗
console.log('--- [4/5] 套裝屬性連結校驗 ---');
for (const [itemId, info] of Object.entries(EQUIPMENT)) {
    if (info.set_id && !SET_REGISTRY[info.set_id]) {
        logError(`裝備 "${itemId}" 引用的套裝 ID "${info.set_id}" 不存在於 SET_REGISTRY 中！`);
    }
}
console.log('✅ 套裝連結校驗完成\n');

// 5. 數值平衡度分析 (統計匯總)
console.log('--- [5/5] 區域數值平衡度分析 ---');
for (const [areaId, mobs] of Object.entries(MONSTERS)) {
    const boss = BOSSES[areaId];
    const avgAtk = Math.floor(mobs.reduce((s, m) => s + (m.atk || m.matk || 0), 0) / mobs.length);
    const avgHp = Math.floor(mobs.reduce((s, m) => s + m.hp, 0) / mobs.length);
    console.log(`📍 區域 [${areaId}]:`);
    console.log(`   - 一般怪平均: ATK ${avgAtk.toString().padEnd(6)} | HP ${avgHp.toString().padEnd(8)}`);
    if (boss) {
        console.log(`   - 區域首領:   ATK ${(boss.atk || boss.matk).toString().padEnd(6)} | HP ${boss.hp.toString().padEnd(8)}`);
    }
}
console.log('\n');

// 6. 戰鬥日誌渲染測試
totalErrors += testCombatLogs();

console.log('--- 測試結果總結 ---');
if (totalErrors === 0) {
    console.log('🏆 恭喜！所有自動化模擬測試均平衡且正確。');
} else {
    console.log(`⚠️ 測試完成，但發現了 ${totalErrors} 個錯誤，請務必修復。`);
}

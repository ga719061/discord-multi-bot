// Minimal verification for syntax and logic check
const fs = require('fs');
const path = require('path');

const battlePath = path.join(__dirname, 'src', 'rpg', 'screens', 'battle.js');
const autoBattlePath = path.join(__dirname, 'src', 'rpg', 'engine', 'autoBattle.js');

function checkFile(filePath) {
    console.log(`Checking ${filePath}...`);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for "drop.isEquip && Math.random() < 0.05"
    if (content.includes('drop.isEquip && Math.random() < 0.05')) {
        console.log('✅ Found restriction: drop.isEquip && Math.random() < 0.05');
    } else {
        console.error('❌ Could NOT find restriction logic!');
    }
}

try {
    checkFile(battlePath);
    checkFile(autoBattlePath);
} catch (e) {
    console.error(e);
}

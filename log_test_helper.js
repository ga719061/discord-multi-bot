
import { formatBattleLog, ansiText } from './src/rpg/rpgHelpers.js';
import { COLORS, DAMAGE_COLORS } from './src/utils/style.js';

/**
 * 戰鬥日誌渲染測試日誌區
 */
export function testCombatLogs() {
    console.log('--- [6/5] 戰鬥日誌渲染過濾測試 ---');
    let logErrors = 0;

    const testCases = [
        { 
            input: '凱龍 對 史萊姆 造成 50 傷害', 
            options: { type: 'physical' },
            expected: '傷害', // 基本檢查
            checkFn: (res) => res.includes('\u001b[') && res.includes('傷害')
        },
        { 
            input: '凱龍 獲得了 100 HP 回復', 
            options: { type: 'heal' },
            checkFn: (res) => res.includes('\u001b[32m') // GREEN
        },
        {
            input: '致命一擊！',
            options: { crit: true },
            checkFn: (res) => res.includes('\u001b[43;1;37m') // BG_GOLD + White Bold
        }
    ];

    testCases.forEach((tc, idx) => {
        const result = formatBattleLog(tc.input, tc.options);
        if (tc.checkFn && !tc.checkFn(result)) {
            console.error(`❌ [LOG_ERROR] 測試案例 ${idx + 1} 失敗: "${tc.input}"`);
            logErrors++;
        }
    });

    if (logErrors === 0) console.log('✅ 戰鬥日誌渲染過濾測試通過\n');
    return logErrors;
}

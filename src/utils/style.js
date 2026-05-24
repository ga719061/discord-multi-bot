/**
 * 通用系統樣式工具 (ANSI 格式)
 * 提供語意化的顏色封裝
 */

const ESC = '\u001b';

export const COLORS = {
    RESET: '0',
    BOLD: '1',
    UNDERLINE: '4',

    // 前景色
    GRAY: '30',
    RED: '31',      // Error / High Danger
    GREEN: '32',    // Success
    GOLD: '33',     // Warning / Gold / Premium
    YELLOW: '33',   // Alias for GOLD
    BLUE: '34',     // Info
    MAGENTA: '35',  // Rare / Special
    PURPLE: '35',   // Alias for MAGENTA
    CYAN: '36',     // System / Quiet Info
    WHITE: '37',

    // 背景色 (選用)
    BG_FIRE: '41',
    BG_NATURE: '42',
    BG_GOLD: '43',      // 黃色背景 (Critical Hit)
    BG_SEA: '44',
};

// Discord card accents, kept semantic so V2 panels do not scatter raw colors.
export const UI_COLORS = {
    ROYAL: 0xD6A33D,
    INFO: 0x3498DB,
    SUCCESS: 0x2ECC71,
    WARNING: 0xF1C40F,
    DANGER: 0xE74C3C,
    SPECIAL: 0x9B59B6,
    MUTED: 0x95A5A6,
};

// 戰鬥傷害類型顏色對應
export const DAMAGE_COLORS = {
    physical: COLORS.RED,
    magical: COLORS.BLUE,
    holy: COLORS.GOLD,
    poison: COLORS.GREEN
};

/**
 * 取得 ANSI 轉義字串 (不含代碼塊包裹)
 * @param {string} colorId 
 * @param {string} text 
 */
export function fmt(colorId, text) {
    if (!text) return '';
    const str = String(text);
    if (str.includes('\n')) {
        return str.split('\n').map(line => fmt(colorId, line)).join('\n');
    }
    return ESC + '[' + colorId + 'm' + str + ESC + '[0m';
}

/**
 * 基本 ANSI 封裝器 (含代碼塊包裹)
 */
export function ansi(colorId, text) {
    return '```ansi\n' + fmt(colorId, text) + '\n```';
}

/**
 * 組合多個 ANSI 區塊 (在同一個代碼塊中)
 * @param {Array<{color: string, text: string}>|string} lines 
 * @returns {string}
 */
export function ansiBlock(lines) {
    let content = '';
    if (Array.isArray(lines)) {
        content = lines.map(line => {
            if (typeof line === 'string') return line;
            return `${ESC}[${line.color}m${line.text}${ESC}[0m`;
        }).join('\n');
    } else {
        content = String(lines);
    }
    return '```ansi\n' + content + '\n```';
}

/**
 * 簡易進度條 (ANSI 版)
 * @param {number} current 
 * @param {number} max 
 * @param {string} color - ANSI 顏色代碼
 * @param {number} length 
 */
export function ansiBar(current, max, color = COLORS.GREEN, length = 10) {
    const safeCurrent = Number(current) || 0;
    const safeMax = Math.max(1, Number(max) || 1);
    const ratio = Math.min(1, Math.max(0, safeCurrent / safeMax));
    const filled = Math.round(ratio * length);
    const empty = length - filled;
    const bar = '▰'.repeat(Math.max(0, filled)) + '▱'.repeat(Math.max(0, empty));
    return fmt(color, bar);
}

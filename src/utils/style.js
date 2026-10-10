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

export const ANSI_TONES = Object.freeze({
    royal: `${COLORS.GOLD};${COLORS.BOLD}`,
    info: COLORS.CYAN,
    success: COLORS.GREEN,
    warning: COLORS.GOLD,
    danger: `${COLORS.RED};${COLORS.BOLD}`,
    special: COLORS.MAGENTA,
    neutral: COLORS.WHITE,
});

// Discord card accents, kept semantic so V2 panels do not scatter raw colors.
export const UI_COLORS = {
    ROYAL: 0xD6A33D,
    INFO: 0x3498DB,
    SUCCESS: 0x2ECC71,
    WARNING: 0xF1C40F,
    DANGER: 0xE74C3C,
    SPECIAL: 0x9B59B6,
    MUTED: 0x95A5A6,
    STEAM: 0x1B75D0,
    VALORANT: 0xFA4454,
    LEAGUE: 0x0AC8B9,
    WUWA: 0x29CFC7,
    BOOST: 0xF47FFF,
    FUN: 0xFF69B4,
    FOOD: 0xFF9F43,
    ANNOUNCEMENT: 0xC0392B,
    ROYAL_SOFT: 0xF0C66A,
    BRONZE: 0xCD7F32,
    SILVER: 0xC0C0C0,
};

export const ROYAL_COPY = {
    brand: '🐕👑 吉吉國王',
    seal: '🐕👑 吉吉國王御用印記',
    private: '🐕 這份御前情報只給你看，汪！',
    timeout: '請重新召喚本王開啟新的操作頁。',
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
    if (text === null || text === undefined || text === '') return '';
    const str = String(text);
    if (str.includes('\n')) {
        return str.split('\n').map(line => fmt(colorId, line)).join('\n');
    }
    return ESC + '[' + colorId + 'm' + str + ESC + '[0m';
}

/**
 * 建立跨客戶端可讀的 ANSI 摘要列。
 * 即使客戶端未呈現顏色，仍會保留「[標籤] 值」文字。
 * @param {Array<{label: unknown, value: unknown, tone?: keyof typeof ANSI_TONES, labelTone?: keyof typeof ANSI_TONES}>} rows
 * @param {{maxWidth?: number}} options
 * @returns {string}
 */
export function ansiRows(rows, { maxWidth = 56 } = {}) {
    const safeMaxWidth = Math.max(16, Math.min(120, Number(maxWidth) || 56));
    const entries = Array.isArray(rows) ? rows.filter(Boolean) : [];
    const lines = entries.map((row) => {
        const label = truncateAnsiCell(row.label ?? '資訊', 12);
        const prefix = `[${label}]`;
        const valueWidth = Math.max(1, safeMaxWidth - displayWidth(prefix) - 1);
        const value = truncateAnsiCell(row.value, valueWidth);
        const color = ansiTone(row.tone);
        if (row.labelTone !== undefined) {
            return `${ESC}[${ansiTone(row.labelTone)}m${prefix}${ESC}[0m ${ESC}[${color}m${value}${ESC}[0m`;
        }
        return `${ESC}[${color}m${prefix} ${value}${ESC}[0m`;
    });

    if (lines.length === 0) {
        lines.push(`${ESC}[${ANSI_TONES.neutral}m[資訊] -${ESC}[0m`);
    }
    return '```ansi\n' + lines.join('\n') + '\n```';
}

function ansiTone(tone) {
    return Object.hasOwn(ANSI_TONES, tone) ? ANSI_TONES[tone] : ANSI_TONES.neutral;
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

function truncateAnsiCell(value, maxWidth) {
    const text = sanitizeAnsiCell(value);
    if (displayWidth(text) <= maxWidth) return text;

    let result = '';
    let width = 0;
    const contentWidth = Math.max(0, maxWidth - 1);
    for (const character of text) {
        const nextWidth = characterWidth(character);
        if (width + nextWidth > contentWidth) break;
        result += character;
        width += nextWidth;
    }
    return `${result}…`;
}

function sanitizeAnsiCell(value) {
    const text = value === null || value === undefined || value === '' ? '-' : String(value);
    return text
        .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
        .replace(/\u001b/g, '')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '')
        .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/`/g, "'")
        .replace(/\s+/g, ' ')
        .trim() || '-';
}

function displayWidth(value) {
    return [...String(value)].reduce((total, character) => total + characterWidth(character), 0);
}

function characterWidth(character) {
    const codePoint = character.codePointAt(0);
    return codePoint >= 0x1100 && (
        codePoint <= 0x115f
        || codePoint === 0x2329
        || codePoint === 0x232a
        || (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f)
        || (codePoint >= 0xac00 && codePoint <= 0xd7a3)
        || (codePoint >= 0xf900 && codePoint <= 0xfaff)
        || (codePoint >= 0xfe10 && codePoint <= 0xfe19)
        || (codePoint >= 0xfe30 && codePoint <= 0xfe6f)
        || (codePoint >= 0xff00 && codePoint <= 0xff60)
        || (codePoint >= 0xffe0 && codePoint <= 0xffe6)
        || (codePoint >= 0x1f300 && codePoint <= 0x1faff)
        || (codePoint >= 0x20000 && codePoint <= 0x3fffd)
    ) ? 2 : 1;
}

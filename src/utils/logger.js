import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '..', '..', 'logs');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

function timestamp() {
    return new Date().toLocaleString('zh-TW', { hour12: false });
}

function writeToFile(level, message) {
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(LOG_DIR, `${date}.log`);
    const line = `[${timestamp()}] [${level}] ${message}\n`;
    fs.appendFile(logFile, line, (err) => {
        if (err) console.error('日誌寫入失敗:', err);
    });
}

export const logger = {
    info(msg, ...args) {
        const message = args.length ? `${msg} ${args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')}` : msg;
        console.log(`${COLORS.cyan}[INFO]${COLORS.reset} ${COLORS.gray}${timestamp()}${COLORS.reset} ${message}`);
        writeToFile('INFO', message);
    },
    warn(msg, ...args) {
        const message = args.length ? `${msg} ${args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')}` : msg;
        console.log(`${COLORS.yellow}[WARN]${COLORS.reset} ${COLORS.gray}${timestamp()}${COLORS.reset} ${message}`);
        writeToFile('WARN', message);
    },
    error(msg, ...args) {
        const message = args.length ? `${msg} ${args.map(a => (a instanceof Error ? a.stack : typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')}` : msg;
        console.log(`${COLORS.red}[ERROR]${COLORS.reset} ${COLORS.gray}${timestamp()}${COLORS.reset} ${message}`);
        writeToFile('ERROR', message);
    },
    debug(msg, ...args) {
        const message = args.length ? `${msg} ${args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')}` : msg;
        console.log(`${COLORS.magenta}[DEBUG]${COLORS.reset} ${COLORS.gray}${timestamp()}${COLORS.reset} ${message}`);
        writeToFile('DEBUG', message);
    },
};

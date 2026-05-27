import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_COMMANDS_DIR = path.join(__dirname, '..', 'src', 'commands');
const ALLOWED_ENGLISH_COMMANDS = new Set(['help']);
const BLOCKED_STALE_COMMANDS = new Set(['volume', 'stop', 'shuffle']);

export function listCommandFiles(commandsDir = DEFAULT_COMMANDS_DIR) {
    return fs.readdirSync(commandsDir)
        .filter((category) => fs.statSync(path.join(commandsDir, category)).isDirectory())
        .sort((a, b) => a.localeCompare(b))
        .flatMap((category) => fs.readdirSync(path.join(commandsDir, category))
            .filter((file) => file.endsWith('.js'))
            .sort((a, b) => a.localeCompare(b))
            .map((file) => path.join(commandsDir, category, file)));
}

export async function buildCommandManifest(commandsDir = DEFAULT_COMMANDS_DIR) {
    const commands = [];

    for (const commandPath of listCommandFiles(commandsDir)) {
        const command = await import(pathToFileURL(commandPath).href);
        if (!command.data || command.helpOnly) continue;

        commands.push(command.data.toJSON());
        for (const aliasData of command.aliases ?? []) {
            commands.push(aliasData.toJSON());
        }
    }

    return commands;
}

export function validateCommandManifest(commands) {
    const names = commands.map((command) => command.name);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicates.length > 0) {
        throw new Error(`指令名稱重複: ${[...new Set(duplicates)].join(', ')}`);
    }

    const blocked = names.filter((name) => BLOCKED_STALE_COMMANDS.has(name));
    if (blocked.length > 0) {
        throw new Error(`偵測到已停用指令: ${blocked.join(', ')}`);
    }

    const unsupportedEnglish = names.filter((name) =>
        /^[a-z0-9_-]+$/i.test(name) && !ALLOWED_ENGLISH_COMMANDS.has(name)
    );
    if (unsupportedEnglish.length > 0) {
        throw new Error(`英文指令入口僅允許 /help: ${unsupportedEnglish.join(', ')}`);
    }

    return names.sort((a, b) => a.localeCompare(b));
}

export function assertSameCommandNames(actualCommands, desiredCommands, scopeName) {
    const actual = actualCommands.map((command) => command.name).sort((a, b) => a.localeCompare(b));
    const desired = desiredCommands.map((command) => command.name).sort((a, b) => a.localeCompare(b));

    if (JSON.stringify(actual) !== JSON.stringify(desired)) {
        throw new Error(`${scopeName} 同步驗證失敗；預期 ${desired.join(', ')}，實際 ${actual.join(', ')}`);
    }
}

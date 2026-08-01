import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadCommands(client, options = {}) {
    const commandsDir = options.commandsDir ?? path.join(__dirname, '..', 'commands');
    const importModule = options.importModule ?? ((filePath) => import(filePath));
    const failures = [];
    let loaded = 0;
    let skipped = 0;
    const categories = fs.readdirSync(commandsDir).filter((entry) =>
        fs.statSync(path.join(commandsDir, entry)).isDirectory()
    );

    for (const category of categories) {
        const categoryDir = path.join(commandsDir, category);
        const files = fs.readdirSync(categoryDir).filter((file) => file.endsWith('.js'));

        logger.debug(`[CommandLoader] 掃描分類 ${category}: 找到 ${files.length} 個檔案`);

        for (const file of files) {
            const filePath = `file://${path.join(categoryDir, file).replace(/\\/g, '/')}`;
            try {
                const command = await importModule(filePath);

                if (command.data && command.execute && !command.helpOnly) {
                    client.commands.set(command.data.name, command);
                    for (const aliasData of command.aliases ?? []) {
                        client.commands.set(aliasData.name, command);
                    }
                    loaded += 1;
                    logger.debug(`  指令載入: /${command.data.name} [${category}]`);
                } else if (command.helpOnly) {
                    skipped += 1;
                    logger.debug(`  純說明載入: ${file} [${category}]`);
                } else {
                    skipped += 1;
                    logger.warn(`  ⚠️ 指令略過: ${file} (缺少 data 或 execute)`);
                }
            } catch (error) {
                failures.push(new Error(`指令載入失敗: ${category}/${file}`, { cause: error }));
                logger.error(`  ❌ 指令載入失敗: ${file}`, error);
            }
        }
    }

    const summary = { loaded, skipped, failed: failures.length };
    if (failures.length > 0) {
        throw new AggregateError(failures, `${failures.length} 個指令模組載入失敗。`);
    }
    return summary;
}

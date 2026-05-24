import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadCommands(client) {
    const commandsDir = path.join(__dirname, '..', 'commands');
    const categories = fs.readdirSync(commandsDir).filter((f) =>
        fs.statSync(path.join(commandsDir, f)).isDirectory()
    );

    for (const category of categories) {
        const categoryDir = path.join(commandsDir, category);
        const files = fs.readdirSync(categoryDir).filter((f) => f.endsWith('.js'));

        logger.debug(`[CommandLoader] 掃描類別 ${category}: 找到 ${files.length} 個檔案`);

        for (const file of files) {
            const filePath = `file://${path.join(categoryDir, file).replace(/\\/g, '/')}`;
            try {
                const command = await import(filePath);

                if (command.data && command.execute) {
                    client.commands.set(command.data.name, command);
                    for (const aliasData of command.aliases ?? []) {
                        client.commands.set(aliasData.name, command);
                    }
                    logger.debug(`  ✅ 指令載入: /${command.data.name} [${category}]`);
                } else {
                    logger.warn(`  ⚠️ 指令跳過: ${file} (缺少 data 或 execute)`);
                }
            } catch (error) {
                logger.error(`  ❌ 指令載入失敗: ${file}`, error);
            }
        }
    }
}

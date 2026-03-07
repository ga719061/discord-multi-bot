import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadEvents(client) {
    const eventsDir = path.join(__dirname, '..', 'events');

    async function loadEventsRecursive(dir) {
        const files = fs.readdirSync(dir);

        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                await loadEventsRecursive(fullPath);
            } else if (file.endsWith('.js')) {
                const filePath = `file://${fullPath.replace(/\\/g, '/')}`;
                try {
                    const event = await import(filePath);
                    if (event.register) {
                        event.register(client);
                        logger.debug(`  事件載入: ${file}`);
                    }
                } catch (err) {
                    logger.error(`  ❌ 事件載入失敗: ${file}`, err);
                }
            }
        }
    }

    await loadEventsRecursive(eventsDir);
}


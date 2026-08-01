import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loadedEventCleanups = [];

export async function stopLoadedEvents() {
    let stopped = 0;
    for (const cleanup of loadedEventCleanups.splice(0).reverse()) {
        try {
            await cleanup();
            stopped += 1;
        } catch (err) {
            logger.error('  ❌ 事件清理失敗:', err);
        }
    }
    return stopped;
}

export async function loadEvents(client, options = {}) {
    const eventsDir = options.eventsDir ?? path.join(__dirname, '..', 'events');
    const importModule = options.importModule ?? ((filePath) => import(filePath));
    const failures = [];
    let loaded = 0;
    let skipped = 0;

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
                    const event = await importModule(filePath);
                    if (event.register) {
                        await event.register(client);
                        if (typeof event.stop === 'function') loadedEventCleanups.push(event.stop);
                        loaded += 1;
                        logger.debug(`  事件載入: ${file}`);
                    } else {
                        skipped += 1;
                        logger.warn(`  ⚠️ 事件略過: ${file} (缺少 register)`);
                    }
                } catch (err) {
                    const relativePath = path.relative(eventsDir, fullPath);
                    failures.push(new Error(`事件載入失敗: ${relativePath}`, { cause: err }));
                    logger.error(`  ❌ 事件載入失敗: ${file}`, err);
                }
            }
        }
    }

    await loadEventsRecursive(eventsDir);

    const summary = { loaded, skipped, failed: failures.length };
    if (failures.length > 0) {
        throw new AggregateError(failures, `${failures.length} 個事件模組載入失敗。`);
    }
    return summary;
}

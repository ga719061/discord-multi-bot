import path from 'path';
import { pathToFileURL } from 'url';
import { buildCommandManifest, listCommandFiles, validateCommandManifest } from './command-manifest.js';

const commandsDir = path.resolve('src', 'commands');
const commandFiles = listCommandFiles(commandsDir);

let failures = 0;

for (const commandPath of commandFiles) {
    try {
        const command = await import(pathToFileURL(commandPath).href);
        if (!command.data || !command.execute) {
            throw new Error('缺少 data 或 execute export');
        }
    } catch (error) {
        failures += 1;
        console.error(`指令載入失敗: ${path.relative(commandsDir, commandPath)} - ${error.message}`);
    }
}

if (failures > 0) {
    process.exitCode = 1;
} else {
    try {
        const manifest = await buildCommandManifest(commandsDir);
        const names = validateCommandManifest(manifest);
        console.log(`指令載入驗證完成：${commandFiles.length} 個模組、${manifest.length} 個註冊入口可正常載入。`);
        console.log(`允許註冊的入口：${names.map((name) => `/${name}`).join(', ')}`);
    } catch (error) {
        console.error(`指令清單驗證失敗: ${error.message}`);
        process.exitCode = 1;
    }
}

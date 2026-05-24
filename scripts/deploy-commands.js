import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const commands = [];
const commandsDir = path.join(__dirname, '..', 'src', 'commands');
const categories = fs.readdirSync(commandsDir).filter((f) =>
    fs.statSync(path.join(commandsDir, f)).isDirectory()
);

for (const category of categories) {
    const categoryDir = path.join(commandsDir, category);
    const files = fs.readdirSync(categoryDir).filter((f) => f.endsWith('.js'));

    for (const file of files) {
        const filePath = `file://${path.join(categoryDir, file).replace(/\\/g, '/')}`;
        const command = await import(filePath);
        if (command.data) {
            commands.push(command.data.toJSON());
            for (const aliasData of command.aliases ?? []) {
                commands.push(aliasData.toJSON());
                console.log(`📦載入指令別名: /${aliasData.name} -> /${command.data.name}`);
            }
            console.log(`✅ 載入指令: /${command.data.name}`);
        }
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        let clientId = process.env.CLIENT_ID;

        // 如果沒有 CLIENT_ID，嘗試用 Token 抓取
        if (!clientId) {
            console.log('⚠️ 未偵測到 CLIENT_ID，嘗試使用 Token 獲取...');
            const { Client, GatewayIntentBits } = await import('discord.js');
            const client = new Client({ intents: [] });
            await client.login(process.env.DISCORD_TOKEN);
            clientId = client.user.id;
            console.log(`✅以此 Token 獲取 Client ID: ${clientId}`);
            await client.destroy();
        }

        console.log(`\n🔄 正在註冊 ${commands.length} 個斜線指令 (Client ID: ${clientId})...`);

        if (process.env.GUILD_ID) {
            // 開發模式：只註冊到指定伺服器 (即時生效)
            await rest.put(
                Routes.applicationGuildCommands(clientId, process.env.GUILD_ID),
                { body: commands }
            );
            console.log(`✅ 已註冊到伺服器 ${process.env.GUILD_ID} (即時生效)`);
        } else {
            // 正式模式：全域註冊 (需約1小時生效)
            await rest.put(Routes.applicationCommands(clientId), { body: commands });
            console.log('✅ 已全域註冊 (需約1小時生效)');
        }
    } catch (error) {
        console.error('❌ 註冊失敗:', error);
        // 不拋出錯誤，讓 CI/CD 流程可能繼續（但最好是讓使用者知道）
        // 在 Docker 裡如果這裡失敗，Bot 也不會跑，所以還是 process.exit(1) 比較好
        process.exit(1);
    }
})();

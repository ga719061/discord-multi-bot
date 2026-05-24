import 'dotenv/config';
import { Client, GatewayIntentBits, REST } from 'discord.js';
import {
    buildCommandManifest,
    validateCommandManifest,
} from './command-manifest.js';
import { syncDevelopmentGuild, syncProduction } from './command-sync.js';

const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error('❌ 未設定 DISCORD_TOKEN，無法同步指令。');
    process.exit(1);
}

const commands = await buildCommandManifest();
const desiredNames = validateCommandManifest(commands);
const rest = new REST({ version: '10' }).setToken(token);

try {
    const clientId = await resolveClientId(token);
    console.log(`📋 本次正式清單 (${commands.length}): ${desiredNames.map((name) => `/${name}`).join(', ')}`);

    if (process.env.GUILD_ID) {
        await syncDevelopmentGuild(rest, clientId, process.env.GUILD_ID, commands);
    } else {
        await syncProduction(rest, clientId, commands, () => getJoinedGuildIds(token));
    }
} catch (error) {
    console.error('❌ 指令同步失敗:', error);
    process.exitCode = 1;
}

async function resolveClientId(discordToken) {
    if (process.env.CLIENT_ID) return process.env.CLIENT_ID;

    console.log('⚠️ 未偵測到 CLIENT_ID，嘗試使用 Token 獲取...');
    const client = new Client({ intents: [] });
    try {
        await client.login(discordToken);
        console.log(`✅ 已取得 Client ID: ${client.user.id}`);
        return client.user.id;
    } finally {
        client.destroy();
    }
}

async function getJoinedGuildIds(discordToken) {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    try {
        await client.login(discordToken);
        return [...client.guilds.cache.keys()];
    } finally {
        client.destroy();
    }
}

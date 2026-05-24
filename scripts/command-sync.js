import { Routes } from 'discord.js';
import { assertSameCommandNames } from './command-manifest.js';

export async function syncDevelopmentGuild(rest, clientId, guildId, desiredCommands, log = console.log) {
    const route = Routes.applicationGuildCommands(clientId, guildId);
    const before = await rest.get(route);
    log(`🧪 開發模式：伺服器 ${guildId} 原有指令 (${before.length}): ${formatNames(before)}`);

    await rest.put(route, { body: desiredCommands });
    const after = await rest.get(route);
    assertSameCommandNames(after, desiredCommands, `伺服器 ${guildId}`);
    log(`✅ 已同步伺服器 ${guildId} 指令 (${after.length}): ${formatNames(after)}`);
}

export async function syncProduction(rest, clientId, desiredCommands, getGuildIds, log = console.log) {
    const globalRoute = Routes.applicationCommands(clientId);
    const before = await rest.get(globalRoute);
    log(`🌐 正式模式：全域原有指令 (${before.length}): ${formatNames(before)}`);

    await rest.put(globalRoute, { body: desiredCommands });
    const after = await rest.get(globalRoute);
    assertSameCommandNames(after, desiredCommands, '全域指令');
    log(`✅ 已同步全域指令 (${after.length}): ${formatNames(after)}`);

    const guildIds = await getGuildIds();
    const failures = [];
    let clearedScopes = 0;

    for (const guildId of guildIds) {
        try {
            const route = Routes.applicationGuildCommands(clientId, guildId);
            const guildCommands = await rest.get(route);
            if (guildCommands.length === 0) continue;

            await rest.put(route, { body: [] });
            const remaining = await rest.get(route);
            if (remaining.length > 0) {
                throw new Error(`仍存在指令: ${formatNames(remaining)}`);
            }

            clearedScopes += 1;
            log(`🧹 已清除伺服器 ${guildId} 的舊指令 (${guildCommands.length}): ${formatNames(guildCommands)}`);
        } catch (error) {
            failures.push(`${guildId}: ${error.message}`);
        }
    }

    if (failures.length > 0) {
        throw new Error(`部分伺服器指令未能清除:\n${failures.join('\n')}`);
    }

    log(`✅ guild-scope 清理完成：檢查 ${guildIds.length} 個伺服器，清除 ${clearedScopes} 個含舊指令的 scope。`);
    return { inspectedGuilds: guildIds.length, clearedScopes };
}

export function formatNames(commands) {
    if (!commands.length) return '無';
    return commands
        .map((command) => `/${command.name}`)
        .sort((a, b) => a.localeCompare(b))
        .join(', ');
}

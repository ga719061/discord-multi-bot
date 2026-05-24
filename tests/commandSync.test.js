import test from 'node:test';
import assert from 'node:assert/strict';
import { Routes } from 'discord.js';
import { syncDevelopmentGuild, syncProduction } from '../scripts/command-sync.js';

function createRest(initialRoutes = {}) {
    const values = new Map(Object.entries(initialRoutes));
    const writes = [];
    return {
        writes,
        async get(route) {
            return values.get(route) ?? [];
        },
        async put(route, { body }) {
            writes.push({ route, body });
            values.set(route, body);
            return body;
        },
    };
}

const desired = [{ name: '幫助' }, { name: 'help' }];
const appId = 'app-id';

test('development sync writes only the requested guild scope', async () => {
    const globalRoute = Routes.applicationCommands(appId);
    const guildRoute = Routes.applicationGuildCommands(appId, 'preview-guild');
    const rest = createRest({
        [globalRoute]: [{ name: 'volume' }],
        [guildRoute]: [{ name: 'stop' }],
    });

    await syncDevelopmentGuild(rest, appId, 'preview-guild', desired, () => {});

    assert.deepEqual(rest.writes, [{ route: guildRoute, body: desired }]);
    assert.deepEqual(await rest.get(globalRoute), [{ name: 'volume' }]);
});

test('production sync replaces global commands and removes guild-scoped stale commands', async () => {
    const globalRoute = Routes.applicationCommands(appId);
    const staleGuildRoute = Routes.applicationGuildCommands(appId, 'stale-guild');
    const cleanGuildRoute = Routes.applicationGuildCommands(appId, 'clean-guild');
    const rest = createRest({
        [globalRoute]: [{ name: 'shuffle' }],
        [staleGuildRoute]: [{ name: 'volume' }],
        [cleanGuildRoute]: [],
    });

    const result = await syncProduction(
        rest,
        appId,
        desired,
        async () => ['stale-guild', 'clean-guild'],
        () => {}
    );

    assert.deepEqual(await rest.get(globalRoute), desired);
    assert.deepEqual(await rest.get(staleGuildRoute), []);
    assert.deepEqual(result, { inspectedGuilds: 2, clearedScopes: 1 });
});

test('production sync rejects incomplete guild cleanup', async () => {
    const guildRoute = Routes.applicationGuildCommands(appId, 'blocked-guild');
    const rest = {
        async get(route) {
            return route === guildRoute ? [{ name: 'stop' }] : desired;
        },
        async put() {},
    };

    await assert.rejects(
        syncProduction(rest, appId, desired, async () => ['blocked-guild'], () => {}),
        /部分伺服器指令未能清除/
    );
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { cleanupTestDatabase, initTestDatabase } from './helpers/database.js';
import { closeDatabaseForTests, getAiSettings, getDb, initDatabase, updateAiSetting } from '../src/utils/database.js';
import { hasNasMusicAccess, hasNasMusicInteractionAccess, resolveNasMusicAccess, resolveNasMusicAdministrator } from '../src/utils/musicAccess.js';

test('NAS access is independent of AI enablement and AI whitelist', () => {
    const settings = {
        guild_id: 'guild', enabled: 0, whitelist: ['ai-user'],
        admin_ids: ['admin'], nas_music_whitelist: ['nas-user'],
    };
    const access = (userId, isAdministrator = false, guildId = 'guild') =>
        hasNasMusicAccess({ guildId, userId, isAdministrator }, settings);
    assert.equal(access('nas-user'), true);
    assert.equal(access('ai-user'), false);
    assert.equal(access('admin'), false);
    assert.equal(access('admin', true), true);
    assert.equal(access('other-admin', true), false);
    assert.equal(access('nas-user', false, 'other-guild'), false);
    assert.equal(access(''), false);
    assert.equal(hasNasMusicAccess({ guildId: 'guild', userId: 'nas-user' }, {
        admin_ids: 'nas-user', nas_music_whitelist: 'nas-user',
    }), false);
});

test('interaction NAS access uses current Discord permissions and fails closed on malformed permissions', () => {
    const settings = { guild_id: 'guild', admin_ids: ['admin'], nas_music_whitelist: ['member'] };
    const interaction = { guildId: 'guild', user: { id: 'admin' } };
    assert.equal(hasNasMusicInteractionAccess({ ...interaction, memberPermissions: new PermissionsBitField(PermissionFlagsBits.Administrator) }, settings), true);
    assert.equal(hasNasMusicInteractionAccess({ ...interaction, member: { permissions: PermissionFlagsBits.Administrator.toString() } }, settings), true);
    assert.equal(hasNasMusicInteractionAccess({ ...interaction, memberPermissions: 0n }, settings), false);
    assert.equal(hasNasMusicInteractionAccess({ ...interaction, memberPermissions: 'bad-permission' }, settings), false);
    assert.equal(hasNasMusicInteractionAccess({ ...interaction, user: { id: 'member' } }, settings), true);
    assert.equal(hasNasMusicInteractionAccess({ user: { id: 'member' } }, settings), false);
});

test('fresh database defaults to a separate empty NAS whitelist and parses only arrays', () => {
    initTestDatabase('music-access-fresh');
    try {
        const column = getDb().pragma('table_info(ai_settings)').find(({ name }) => name === 'nas_music_whitelist');
        assert.equal(column.type, 'TEXT');
        assert.equal(column.dflt_value, "'[]'");
        updateAiSetting('guild', 'whitelist', JSON.stringify(['ai-user']));
        assert.deepEqual(getAiSettings('guild').nas_music_whitelist, []);
        updateAiSetting('guild', 'nas_music_whitelist', JSON.stringify(['nas-user']));
        assert.deepEqual(getAiSettings('guild').nas_music_whitelist, ['nas-user']);
        assert.deepEqual(getAiSettings('guild').whitelist, ['ai-user']);
        assert.deepEqual(getAiSettings('other-guild').nas_music_whitelist, []);
        for (const malformed of ['invalid-json', '{"user":"nas-user"}', 'null']) {
            updateAiSetting('guild', 'nas_music_whitelist', malformed);
            assert.deepEqual(getAiSettings('guild').nas_music_whitelist, []);
        }
        assert.throws(() => updateAiSetting('guild', 'nas_music_whitelist; DROP TABLE ai_settings', '[]'), /不允許/);
    } finally {
        cleanupTestDatabase();
    }
});

test('legacy AI settings migration preserves all existing data and never copies the AI whitelist', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gigi-music-access-legacy-'));
    const dbPath = path.join(dir, 'legacy.db');
    const legacy = new Database(dbPath);
    legacy.exec(`
        CREATE TABLE ai_settings (
            guild_id TEXT PRIMARY KEY,
            enabled INTEGER DEFAULT 0,
            expires_at INTEGER DEFAULT NULL,
            system_prompt TEXT DEFAULT NULL,
            whitelist TEXT DEFAULT '[]',
            model TEXT,
            admin_ids TEXT DEFAULT '[]',
            search_enabled INTEGER DEFAULT 0,
            citations_enabled INTEGER DEFAULT 0,
            action_tools_enabled INTEGER DEFAULT 0,
            context_enabled INTEGER DEFAULT 1,
            party_channel_id TEXT DEFAULT NULL,
            party_expires_at INTEGER DEFAULT NULL
        );
    `);
    legacy.prepare(`INSERT INTO ai_settings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        'guild', 1, 123_456, '合成提示詞', '["ai-user"]', 'gemini-3.8-flash',
        '["admin"]', 1, 1, 1, 0, 'party-channel', 987_654,
    );
    const original = legacy.prepare('SELECT * FROM ai_settings WHERE guild_id = ?').get('guild');
    legacy.close();
    try {
        for (let run = 0; run < 2; run++) {
            const db = initDatabase({ dbPath });
            assert.deepEqual(db.prepare('SELECT * FROM ai_settings WHERE guild_id = ?').get('guild'), {
                ...original, nas_music_whitelist: '[]',
            });
            assert.deepEqual(getAiSettings('guild').nas_music_whitelist, []);
            assert.deepEqual(getAiSettings('guild').whitelist, ['ai-user']);
            assert.deepEqual(getAiSettings('guild').admin_ids, ['admin']);
        }
    } finally {
        closeDatabaseForTests();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('playback NAS authorization fetches administrator permissions freshly and isolates guilds', async () => {
    initTestDatabase('music-access-playback');
    try {
        updateAiSetting('guild', 'admin_ids', '["admin"]');
        updateAiSetting('guild', 'nas_music_whitelist', '["member"]');
        const calls = [];
        const guild = { id: 'guild', members: { fetch: async options => {
            calls.push(options);
            return { permissions: new PermissionsBitField(PermissionFlagsBits.Administrator) };
        } } };
        assert.equal(await resolveNasMusicAccess(guild, 'member'), true);
        assert.equal(await resolveNasMusicAccess(guild, 'other'), false);
        assert.deepEqual(calls, []);
        assert.equal(await resolveNasMusicAccess(guild, 'admin'), true);
        assert.deepEqual(calls, [{ user: 'admin', force: true }]);
        assert.equal(await resolveNasMusicAccess({ ...guild, id: 'other-guild' }, 'admin'), false);
        guild.members.fetch = async () => ({ permissions: new PermissionsBitField() });
        assert.equal(await resolveNasMusicAccess(guild, 'admin'), false);
        guild.members.fetch = async () => { throw new Error('synthetic lookup failure'); };
        assert.equal(await resolveNasMusicAccess(guild, 'admin'), false);
    } finally {
        cleanupTestDatabase();
    }
});

test('administrator authorization is rechecked after a delayed member lookup', async () => {
    initTestDatabase('music-access-late');
    try {
        updateAiSetting('guild', 'admin_ids', '["admin"]');
        let resolveMember;
        const guild = { id: 'guild', members: { fetch: () => new Promise(resolve => { resolveMember = resolve; }) } };
        const pending = resolveNasMusicAccess(guild, 'admin');
        updateAiSetting('guild', 'admin_ids', '[]');
        resolveMember({ permissions: PermissionFlagsBits.Administrator });
        assert.equal(await pending, false);
    } finally {
        cleanupTestDatabase();
    }
});

test('a NAS whitelist grant during lookup does not prove Discord Administrator permissions', async () => {
    initTestDatabase('music-access-role-identity');
    try {
        updateAiSetting('guild', 'admin_ids', '["admin"]');
        let resolveMember;
        const guild = { id: 'guild', members: { fetch: () => new Promise(resolve => { resolveMember = resolve; }) } };
        const role = resolveNasMusicAdministrator(guild, 'admin');
        updateAiSetting('guild', 'nas_music_whitelist', '["admin"]');
        resolveMember({ permissions: new PermissionsBitField() });
        const isAdministrator = await role;
        assert.equal(isAdministrator, false);
        assert.equal(hasNasMusicAccess({ guildId: 'guild', userId: 'admin', isAdministrator }), true);
        updateAiSetting('guild', 'nas_music_whitelist', '[]');
        assert.equal(hasNasMusicAccess({ guildId: 'guild', userId: 'admin', isAdministrator }), false);
    } finally {
        cleanupTestDatabase();
    }
});

test('administrator role lookup is independent of settings and denies invalid guilds', async () => {
    cleanupTestDatabase();
    const calls = [];
    const guild = { id: 'guild', members: { fetch: async options => {
        calls.push(options);
        return { permissions: PermissionFlagsBits.Administrator };
    } } };
    assert.equal(await resolveNasMusicAdministrator(guild, 'member'), true);
    assert.deepEqual(calls, [{ user: 'member', force: true }]);
    assert.equal(await resolveNasMusicAdministrator(null, 'member'), false);
    assert.equal(await resolveNasMusicAdministrator({ members: guild.members }, 'member'), false);
    assert.equal(await resolveNasMusicAdministrator(guild, ''), false);
    assert.equal(await resolveNasMusicAdministrator({ id: 'guild' }, 'member'), false);
});

test('member lookup deadline denies access and ignores late results', async context => {
    initTestDatabase('music-access-deadline');
    context.mock.timers.enable({ apis: ['setTimeout'] });
    try {
        updateAiSetting('guild', 'admin_ids', '["admin"]');
        let resolveMember;
        const guild = { id: 'guild', members: { fetch: () => new Promise(resolve => { resolveMember = resolve; }) } };
        const pending = resolveNasMusicAccess(guild, 'admin');
        context.mock.timers.tick(8_000);
        assert.equal(await pending, false);
        resolveMember({ permissions: PermissionFlagsBits.Administrator });
        await Promise.resolve();
    } finally {
        context.mock.timers.reset();
        cleanupTestDatabase();
    }
});

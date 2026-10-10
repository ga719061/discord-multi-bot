import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { cleanupTestDatabase, initTestDatabase } from './helpers/database.js';
import { closeDatabaseForTests, getDb, initDatabase } from '../src/utils/database.js';

test('fresh database creates steam free board state with safe defaults', () => {
  initTestDatabase('steam-free-board');

  try {
    const db = getDb();
    const columns = db.pragma('table_info(steam_free_boards)');

    assert.deepEqual(
      columns.map(({ name, type, notnull, dflt_value, pk }) => ({ name, type, notnull, dflt_value, pk })),
      [
        { name: 'guild_id', type: 'TEXT', notnull: 0, dflt_value: null, pk: 1 },
        { name: 'channel_id', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
        { name: 'message_id', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
        { name: 'snapshot_json', type: 'TEXT', notnull: 1, dflt_value: "'[]'", pk: 0 },
        { name: 'last_refresh_date', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
        { name: 'last_checked_at', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 0 },
      ]
    );

    db.prepare('INSERT INTO steam_free_boards (guild_id) VALUES (?)').run('guild-fresh');
    assert.deepEqual(
      db.prepare('SELECT * FROM steam_free_boards WHERE guild_id = ?').get('guild-fresh'),
      {
        guild_id: 'guild-fresh',
        channel_id: null,
        message_id: null,
        snapshot_json: '[]',
        last_refresh_date: null,
        last_checked_at: null,
      }
    );
  } finally {
    cleanupTestDatabase();
  }
});

test('legacy database gains steam free board table without changing guild settings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gigi-steam-free-board-legacy-'));
  const dbPath = path.join(dir, 'legacy.db');
  const legacy = new Database(dbPath);
  legacy.exec(`
    CREATE TABLE guild_settings (
      guild_id TEXT PRIMARY KEY,
      steam_free_last_post_date TEXT DEFAULT NULL
    );
    INSERT INTO guild_settings (guild_id, steam_free_last_post_date)
    VALUES ('guild-legacy', '2026-08-08');
  `);
  legacy.close();

  try {
    let migrated = initDatabase({ dbPath });

    assert.ok(
      migrated.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'steam_free_boards'"
      ).get()
    );
    assert.deepEqual(
      migrated.prepare(
        'SELECT guild_id, steam_free_last_post_date FROM guild_settings WHERE guild_id = ?'
      ).get('guild-legacy'),
      { guild_id: 'guild-legacy', steam_free_last_post_date: '2026-08-08' }
    );

    migrated = initDatabase({ dbPath });
    assert.deepEqual(
      migrated.prepare(
        'SELECT guild_id, steam_free_last_post_date FROM guild_settings WHERE guild_id = ?'
      ).get('guild-legacy'),
      { guild_id: 'guild-legacy', steam_free_last_post_date: '2026-08-08' }
    );
  } finally {
    closeDatabaseForTests();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

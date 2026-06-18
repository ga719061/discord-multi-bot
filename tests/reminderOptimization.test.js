import assert from 'node:assert';
import test from 'node:test';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initTestDatabase, cleanupTestDatabase } from './helpers/database.js';
import { addReminder, closeDatabaseForTests, deleteReminder, initDatabase } from '../src/utils/database.js';

test('Reminder ID Optimization', async (t) => {
  t.beforeEach(() => {
    initTestDatabase('reminder-opt');
  });

  t.afterEach(() => {
    cleanupTestDatabase();
  });

  await t.test('reminders ID should not be reused after deletion and tables clear', () => {
    const r1 = addReminder('guild_1', 'channel_1', 'user_1', 'hello', Date.now() + 1000);
    // better-sqlite3 rowid returns number
    assert.strictEqual(Number(r1.lastInsertRowid), 1);

    // 刪除第一個提醒 (表變空)
    deleteReminder(1, 'user_1');

    // 新增第二個提醒，由於 sequence 不會重置，ID 應為 2
    const r2 = addReminder('guild_1', 'channel_1', 'user_1', 'world', Date.now() + 2000);
    assert.strictEqual(Number(r2.lastInsertRowid), 2);
  });
});

test('test database helper uses a temp db without touching the real bot database', () => {
  const realDbPath = path.join(process.cwd(), 'data', 'bot.db');
  const before = fs.existsSync(realDbPath) ? fs.statSync(realDbPath).mtimeMs : null;
  const tempDb = initTestDatabase('temp-path');

  assert.equal(fs.existsSync(tempDb.dbPath), true);
  const after = fs.existsSync(realDbPath) ? fs.statSync(realDbPath).mtimeMs : null;
  assert.equal(after, before);

  cleanupTestDatabase();
});

test('legacy giveaway and reminder schemas migrate before indexes are created', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-legacy-db-'));
  const dbPath = path.join(dir, 'legacy.db');
  const legacy = new Database(dbPath);
  legacy.exec(`
    CREATE TABLE giveaways (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT,
      channel_id TEXT,
      message_id TEXT,
      prize TEXT,
      winners INTEGER DEFAULT 1,
      end_time INTEGER,
      ended INTEGER DEFAULT 0,
      participants TEXT DEFAULT '[]'
    );
    CREATE TABLE reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT,
      channel_id TEXT,
      user_id TEXT,
      content TEXT,
      target_time INTEGER,
      status TEXT DEFAULT 'pending',
      created_at INTEGER
    );
  `);
  legacy.close();

  try {
    const migrated = initDatabase({ dbPath });
    assert.ok(migrated.pragma('table_info(giveaways)').some((column) => column.name === 'status'));
    assert.ok(migrated.pragma('table_info(reminders)').some((column) => column.name === 'next_retry_at'));
    assert.ok(migrated.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_giveaways_ended_status_time'").get());
  } finally {
    closeDatabaseForTests();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('new AI settings schema does not include the removed action button setting', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-new-ai-db-'));
  const dbPath = path.join(dir, 'new-ai.db');

  try {
    const fresh = initDatabase({ dbPath });
    assert.equal(fresh.pragma('table_info(ai_settings)').some((column) => column.name === 'action_buttons_enabled'), false);
  } finally {
    closeDatabaseForTests();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('legacy AI action button setting is removed without changing other AI settings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-legacy-ai-db-'));
  const dbPath = path.join(dir, 'legacy-ai.db');
  const legacy = new Database(dbPath);
  legacy.exec(`
    CREATE TABLE ai_settings (
      guild_id TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 0,
      expires_at INTEGER DEFAULT NULL,
      system_prompt TEXT DEFAULT NULL,
      whitelist TEXT DEFAULT '[]',
      model TEXT DEFAULT 'gemini-2.5-flash',
      admin_ids TEXT DEFAULT '[]',
      search_enabled INTEGER DEFAULT 0,
      context_enabled INTEGER DEFAULT 1,
      action_buttons_enabled INTEGER DEFAULT 1,
      party_channel_id TEXT DEFAULT NULL,
      party_expires_at INTEGER DEFAULT NULL
    );
    INSERT INTO ai_settings (
      guild_id, enabled, system_prompt, whitelist, model, admin_ids,
      search_enabled, context_enabled, action_buttons_enabled,
      party_channel_id, party_expires_at
    ) VALUES (
      'guild', 1, 'custom prompt', '["user"]', 'gemini-2.5-flash', '["admin"]',
      1, 0, 0, 'party', 123456789
    );
  `);
  legacy.close();

  try {
    let migrated = initDatabase({ dbPath });
    assert.equal(migrated.pragma('table_info(ai_settings)').some((column) => column.name === 'action_buttons_enabled'), false);
    assert.deepEqual(
      migrated.prepare(`
        SELECT guild_id, enabled, system_prompt, whitelist, model, admin_ids,
               search_enabled, context_enabled, party_channel_id, party_expires_at
        FROM ai_settings WHERE guild_id = 'guild'
      `).get(),
      {
        guild_id: 'guild',
        enabled: 1,
        system_prompt: 'custom prompt',
        whitelist: '["user"]',
        model: 'gemini-2.5-flash',
        admin_ids: '["admin"]',
        search_enabled: 1,
        context_enabled: 0,
        party_channel_id: 'party',
        party_expires_at: 123456789,
      }
    );

    migrated = initDatabase({ dbPath });
    assert.equal(migrated.pragma('table_info(ai_settings)').some((column) => column.name === 'action_buttons_enabled'), false);
  } finally {
    closeDatabaseForTests();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

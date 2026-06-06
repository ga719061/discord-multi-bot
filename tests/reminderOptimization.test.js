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

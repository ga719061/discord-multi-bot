import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { parseJsonArray } from './jsonUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

let db;

export function initDatabase() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  db = new Database(path.join(DATA_DIR, 'bot.db'));
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      welcome_channel TEXT,
      welcome_message TEXT,
      log_channel TEXT,
      log_toggles TEXT DEFAULT '{"message":1,"member":1,"server":1,"voice":1,"thread":1}',
      selfrole_roles TEXT DEFAULT '[]',
      level_up_announcement_enabled INTEGER DEFAULT 1,
      steam_deal_channel TEXT DEFAULT NULL,
      steam_deal_time TEXT DEFAULT NULL,
      steam_deal_enabled INTEGER DEFAULT 0,
      steam_deal_last_post_date TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS user_levels (
      guild_id TEXT,
      user_id TEXT,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 0,
      total_messages INTEGER DEFAULT 0,
      total_voice_mins INTEGER DEFAULT 0,
      last_xp_time INTEGER DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS giveaways (
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

    CREATE TABLE IF NOT EXISTS polls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT,
      channel_id TEXT,
      message_id TEXT,
      question TEXT,
      options TEXT,
      votes TEXT DEFAULT '{}',
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS reaction_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT,
      channel_id TEXT,
      message_id TEXT,
      emoji TEXT,
      role_id TEXT
    );

    CREATE TABLE IF NOT EXISTS ai_settings (
      guild_id TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 0,
      expires_at INTEGER DEFAULT NULL,
      system_prompt TEXT DEFAULT NULL,
      whitelist TEXT DEFAULT '[]',
      model TEXT DEFAULT 'gemini-2.0-flash',
      admin_ids TEXT DEFAULT '[]',
      search_enabled INTEGER DEFAULT 0,
      context_enabled INTEGER DEFAULT 1,
      party_channel_id TEXT DEFAULT NULL,
      party_expires_at INTEGER DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS reminders (
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

  // === 索引 (加速 leaderboard 等查詢) ===
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_levels_guild_rank
    ON user_levels(guild_id, level DESC, xp DESC);
  `);

  const guildSettingsInfo = db.pragma('table_info(guild_settings)');
  const guildColumns = guildSettingsInfo.map(c => c.name);

  if (!guildColumns.includes('log_toggles')) {
    db.prepare('ALTER TABLE guild_settings ADD COLUMN log_toggles TEXT DEFAULT \'{"message":1,"member":1,"server":1,"voice":1,"thread":1}\'').run();
    db.prepare('UPDATE guild_settings SET log_toggles = \'{"message":1,"member":1,"server":1,"voice":1,"thread":1}\' WHERE log_toggles IS NULL').run();
  }
  if (!guildColumns.includes('steam_deal_channel')) {
    db.prepare('ALTER TABLE guild_settings ADD COLUMN steam_deal_channel TEXT DEFAULT NULL').run();
  }
  if (!guildColumns.includes('steam_deal_time')) {
    db.prepare('ALTER TABLE guild_settings ADD COLUMN steam_deal_time TEXT DEFAULT NULL').run();
  }
  if (!guildColumns.includes('steam_deal_enabled')) {
    db.prepare('ALTER TABLE guild_settings ADD COLUMN steam_deal_enabled INTEGER DEFAULT 0').run();
  }
  if (!guildColumns.includes('steam_deal_last_post_date')) {
    db.prepare('ALTER TABLE guild_settings ADD COLUMN steam_deal_last_post_date TEXT DEFAULT NULL').run();
  }

  const aiSettingsInfo = db.pragma('table_info(ai_settings)');
  const aiColumns = aiSettingsInfo.map(c => c.name);

  if (!aiColumns.includes('model')) {
    db.prepare("ALTER TABLE ai_settings ADD COLUMN model TEXT DEFAULT 'gemini-2.0-flash'").run();
  }
  if (!aiColumns.includes('admin_ids')) {
    db.prepare("ALTER TABLE ai_settings ADD COLUMN admin_ids TEXT DEFAULT '[]'").run();
  }
  if (!aiColumns.includes('search_enabled')) {
    db.prepare("ALTER TABLE ai_settings ADD COLUMN search_enabled INTEGER DEFAULT 0").run();
  }
  if (!aiColumns.includes('context_enabled')) {
    db.prepare("ALTER TABLE ai_settings ADD COLUMN context_enabled INTEGER DEFAULT 1").run();
  }
  if (!aiColumns.includes('party_channel_id')) {
    db.prepare("ALTER TABLE ai_settings ADD COLUMN party_channel_id TEXT DEFAULT NULL").run();
  }
  if (!aiColumns.includes('party_expires_at')) {
    db.prepare("ALTER TABLE ai_settings ADD COLUMN party_expires_at INTEGER DEFAULT NULL").run();
  }
  const userLevelInfo = db.pragma('table_info(user_levels)');
  const userLevelColumns = userLevelInfo.map(c => c.name);
  if (!userLevelColumns.includes('total_voice_mins')) {
    db.prepare("ALTER TABLE user_levels ADD COLUMN total_voice_mins INTEGER DEFAULT 0").run();
  }

  return db;
}

export function getDb() {
  if (!db) throw new Error('資料庫尚未初始化。');
  return db;
}

// 伺服器設定
export function getGuildSettings(guildId) {
  const db = getDb();
  let row = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  if (!row) {
    db.prepare('INSERT INTO guild_settings (guild_id) VALUES (?)').run(guildId);
    row = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  }
  return row;
}

const ALLOWED_GUILD_KEYS = [
  'welcome_channel',
  'welcome_message',
  'log_channel',
  'log_toggles',
  'selfrole_roles',
  'level_up_announcement_enabled',
  'steam_deal_channel',
  'steam_deal_time',
  'steam_deal_enabled',
  'steam_deal_last_post_date',
];

export function updateGuildSetting(guildId, key, value) {
  if (!ALLOWED_GUILD_KEYS.includes(key)) throw new Error(`不可許的欄位名稱: ${key}`);
  const db = getDb();
  getGuildSettings(guildId);
  db.prepare(`UPDATE guild_settings SET ${key} = ? WHERE guild_id = ?`).run(value, guildId);
}

// 等級系統
export function getUserLevel(guildId, userId) {
  const db = getDb();
  let row = db.prepare('SELECT * FROM user_levels WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
  if (!row) {
    db.prepare('INSERT INTO user_levels (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
    row = db.prepare('SELECT * FROM user_levels WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
  }
  return row;
}

export function addXp(guildId, userId, amount, options = { source: 'message' }) {
  const db = getDb();
  const user = getUserLevel(guildId, userId);
  const newXp = user.xp + amount;
  const xpNeeded = getXpForLevel(user.level + 1);
  let leveledUp = false;

  const countColumn = options.source === 'voice' ? 'total_voice_mins' : 'total_messages';
  const increment = options.source === 'voice' ? 10 : 1; // 假設語音為每 10 分鐘檢查一次

  if (newXp >= xpNeeded) {
    db.prepare(`
      UPDATE user_levels SET xp = ?, level = level + 1, ${countColumn} = ${countColumn} + ?, last_xp_time = ?
      WHERE guild_id = ? AND user_id = ?
    `).run(newXp - xpNeeded, increment, Date.now(), guildId, userId);
    leveledUp = true;
  } else {
    db.prepare(`
      UPDATE user_levels SET xp = ?, ${countColumn} = ${countColumn} + ?, last_xp_time = ?
      WHERE guild_id = ? AND user_id = ?
    `).run(newXp, increment, Date.now(), guildId, userId);
  }

  return { leveledUp, newLevel: user.level + (leveledUp ? 1 : 0) };
}

export function getXpForLevel(level) {
  return 5 * (level * level) + 50 * level + 100;
}

export function getRankTitle(level) {
  if (level >= 100) return '🏰 守護神';
  if (level >= 76) return '👑 大公';
  if (level >= 51) return '💎 貴族';
  if (level >= 31) return '⚔️ 御前騎士';
  if (level >= 16) return '🛡️ 皇家侍衛';
  if (level >= 6) return '📜 忠誠子民';
  return '🏕️ 流浪客';
}

export function getLeaderboard(guildId, limit = 10) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM user_levels WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT ?'
  ).all(guildId, limit);
}

// 反應身份組
export function addReactionRole(guildId, channelId, messageId, emoji, roleId) {
  const db = getDb();
  db.prepare(
    'INSERT INTO reaction_roles (guild_id, channel_id, message_id, emoji, role_id) VALUES (?, ?, ?, ?, ?)'
  ).run(guildId, channelId, messageId, emoji, roleId);
}

export function getReactionRoleByMessage(messageId, emoji) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM reaction_roles WHERE message_id = ? AND emoji = ?'
  ).get(messageId, emoji);
}

export function getReactionRolesByGuild(guildId) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM reaction_roles WHERE guild_id = ? ORDER BY message_id'
  ).all(guildId);
}

export function deleteReactionRolesByMessage(messageId) {
  const db = getDb();
  db.prepare('DELETE FROM reaction_roles WHERE message_id = ?').run(messageId);
}

export function isReactionRoleMessage(messageId) {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM reaction_roles WHERE message_id = ?').get(messageId);
  return row.count > 0;
}

// ===== AI 設定 =====

export function getAiSettings(guildId) {
  const db = getDb();
  let row = db.prepare('SELECT * FROM ai_settings WHERE guild_id = ?').get(guildId);
  if (!row) {
    db.prepare('INSERT INTO ai_settings (guild_id) VALUES (?)').run(guildId);
    row = db.prepare('SELECT * FROM ai_settings WHERE guild_id = ?').get(guildId);
  }
  return {
    ...row,
    whitelist: parseJsonArray(row.whitelist, []),
    admin_ids: parseJsonArray(row.admin_ids, []),
    search_enabled: !!row.search_enabled,
    context_enabled: row.context_enabled !== 0,
  };
}

const ALLOWED_AI_KEYS = ['enabled', 'expires_at', 'system_prompt', 'whitelist', 'model', 'admin_ids', 'search_enabled', 'context_enabled', 'party_channel_id', 'party_expires_at'];

export function updateAiSetting(guildId, key, value) {
  if (!ALLOWED_AI_KEYS.includes(key)) throw new Error(`不可許的欄位名稱: ${key}`);
  const db = getDb();
  getAiSettings(guildId);
  db.prepare(`UPDATE ai_settings SET ${key} = ? WHERE guild_id = ?`).run(value, guildId);
}

export function isAiEnabled(guildId) {
  const db = getDb();
  const row = db.prepare('SELECT enabled, expires_at FROM ai_settings WHERE guild_id = ?').get(guildId);
  if (!row || !row.enabled) return false;
  if (row.expires_at && Date.now() > row.expires_at) {
    db.prepare('UPDATE ai_settings SET enabled = 0, expires_at = NULL WHERE guild_id = ?').run(guildId);
    return false;
  }
  return true;
}

// ===== 提醒系統 =====

export function addReminder(guildId, channelId, userId, content, targetTime) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO reminders (guild_id, channel_id, user_id, content, target_time, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(guildId, channelId, userId, content, targetTime, Date.now());
}

export function getUserReminders(userId, limit = 10) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM reminders 
    WHERE user_id = ? AND status = 'pending' 
    ORDER BY target_time ASC 
    LIMIT ?
  `).all(userId, limit);
}

export function deleteReminder(reminderId, userId) {
  const db = getDb();
  const result = db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?').run(reminderId, userId);
  if (result.changes > 0) {
    maybeResetReminderSequence();
  }
  return result;
}

export function getDueReminders() {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM reminders 
    WHERE status = 'pending' AND target_time <= ?
  `).all(Date.now());
}

export function updateReminderStatus(reminderId, status) {
  const db = getDb();
  db.prepare('UPDATE reminders SET status = ? WHERE id = ?').run(status, reminderId);
  if (status === 'completed') {
    maybeResetReminderSequence();
  }
}

// ===== 抽獎系統 =====

export function addGiveaway(guildId, channelId, messageId, prize, winners, endTime) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO giveaways (guild_id, channel_id, message_id, prize, winners, end_time)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(guildId, channelId, messageId, prize, winners, endTime);
}

export function markGiveawayEnded(id) {
  const db = getDb();
  db.prepare('UPDATE giveaways SET ended = 1 WHERE id = ?').run(id);
}

export function getActiveGiveaways() {
  const db = getDb();
  return db.prepare('SELECT * FROM giveaways WHERE ended = 0').all();
}

function maybeResetReminderSequence() {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as count FROM reminders').get().count;
  if (count === 0) {
    try {
      db.prepare("DELETE FROM sqlite_sequence WHERE name = 'reminders'").run();
    } catch (e) {}
  }
}

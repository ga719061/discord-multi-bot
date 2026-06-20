import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { parseJsonArray } from './jsonUtils.js';
import { DEFAULT_AI_MODEL, normalizeAiModel } from './aiConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

let db;

export function initDatabase(options = {}) {
  const dbPath = options.dbPath || path.join(DATA_DIR, 'bot.db');
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  if (db) db.close();

  db = new Database(dbPath);
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
      steam_deal_last_post_date TEXT DEFAULT NULL,
      steam_free_channel TEXT DEFAULT NULL,
      steam_free_time TEXT DEFAULT NULL,
      steam_free_enabled INTEGER DEFAULT 0,
      steam_free_last_post_date TEXT DEFAULT NULL
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
      participants TEXT DEFAULT '[]',
      status TEXT DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      last_error TEXT DEFAULT NULL,
      winner_ids TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS polls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT,
      channel_id TEXT,
      message_id TEXT,
      creator_id TEXT DEFAULT NULL,
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
      label TEXT,
      role_id TEXT
    );

    CREATE TABLE IF NOT EXISTS ai_settings (
      guild_id TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 0,
      expires_at INTEGER DEFAULT NULL,
      system_prompt TEXT DEFAULT NULL,
      whitelist TEXT DEFAULT '[]',
      model TEXT DEFAULT '${DEFAULT_AI_MODEL}',
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
      created_at INTEGER,
      attempts INTEGER DEFAULT 0,
      next_retry_at INTEGER DEFAULT NULL,
      last_error TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS wuwa_accounts (
      discord_user_id TEXT PRIMARY KEY,
      player_uid TEXT UNIQUE NOT NULL,
      region TEXT,
      language_code TEXT,
      history_json TEXT NOT NULL,
      bound_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  try {
    db.prepare('ALTER TABLE reaction_roles ADD COLUMN label TEXT').run();
  } catch (err) {
    // Ignore error if column already exists
  }

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
  if (!guildColumns.includes('steam_free_channel')) {
    db.prepare('ALTER TABLE guild_settings ADD COLUMN steam_free_channel TEXT DEFAULT NULL').run();
  }
  if (!guildColumns.includes('steam_free_time')) {
    db.prepare('ALTER TABLE guild_settings ADD COLUMN steam_free_time TEXT DEFAULT NULL').run();
  }
  if (!guildColumns.includes('steam_free_enabled')) {
    db.prepare('ALTER TABLE guild_settings ADD COLUMN steam_free_enabled INTEGER DEFAULT 0').run();
  }
  if (!guildColumns.includes('steam_free_last_post_date')) {
    db.prepare('ALTER TABLE guild_settings ADD COLUMN steam_free_last_post_date TEXT DEFAULT NULL').run();
  }

  const aiSettingsInfo = db.pragma('table_info(ai_settings)');
  const aiColumns = aiSettingsInfo.map(c => c.name);

  if (!aiColumns.includes('model')) {
    db.prepare(`ALTER TABLE ai_settings ADD COLUMN model TEXT DEFAULT '${DEFAULT_AI_MODEL}'`).run();
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
  if (aiColumns.includes('action_buttons_enabled')) {
    db.transaction(() => {
      db.prepare('ALTER TABLE ai_settings DROP COLUMN action_buttons_enabled').run();
    })();
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
  const pollInfo = db.pragma('table_info(polls)');
  if (!pollInfo.map(c => c.name).includes('creator_id')) {
    db.prepare('ALTER TABLE polls ADD COLUMN creator_id TEXT DEFAULT NULL').run();
  }

  const giveawayInfo = db.pragma('table_info(giveaways)');
  const giveawayColumns = giveawayInfo.map(c => c.name);
  if (!giveawayColumns.includes('status')) {
    db.prepare("ALTER TABLE giveaways ADD COLUMN status TEXT DEFAULT 'pending'").run();
    db.prepare("UPDATE giveaways SET status = 'completed' WHERE ended = 1").run();
  }
  if (!giveawayColumns.includes('attempts')) {
    db.prepare("ALTER TABLE giveaways ADD COLUMN attempts INTEGER DEFAULT 0").run();
  }
  if (!giveawayColumns.includes('last_error')) {
    db.prepare("ALTER TABLE giveaways ADD COLUMN last_error TEXT DEFAULT NULL").run();
  }
  if (!giveawayColumns.includes('winner_ids')) {
    db.prepare("ALTER TABLE giveaways ADD COLUMN winner_ids TEXT DEFAULT NULL").run();
  }

  const reminderInfo = db.pragma('table_info(reminders)');
  const reminderColumns = reminderInfo.map(c => c.name);
  if (!reminderColumns.includes('attempts')) {
    db.prepare("ALTER TABLE reminders ADD COLUMN attempts INTEGER DEFAULT 0").run();
  }
  if (!reminderColumns.includes('next_retry_at')) {
    db.prepare("ALTER TABLE reminders ADD COLUMN next_retry_at INTEGER DEFAULT NULL").run();
  }
  if (!reminderColumns.includes('last_error')) {
    db.prepare("ALTER TABLE reminders ADD COLUMN last_error TEXT DEFAULT NULL").run();
  }

  // 索引必須在既有資料庫完成欄位遷移後建立。
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_levels_guild_rank ON user_levels(guild_id, level DESC, xp DESC);
    CREATE INDEX IF NOT EXISTS idx_reminders_status_time ON reminders (status, target_time);
    CREATE INDEX IF NOT EXISTS idx_giveaways_ended_status_time ON giveaways (ended, status, end_time);
    CREATE INDEX IF NOT EXISTS idx_polls_message_id ON polls (message_id);
    CREATE INDEX IF NOT EXISTS idx_reaction_roles_message_role ON reaction_roles (message_id, role_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_wuwa_accounts_player_uid ON wuwa_accounts (player_uid);
  `);

  return db;
}

export function closeDatabaseForTests() {
  if (db) db.close();
  db = null;
}

export function getDb() {
  if (!db) throw new Error('資料庫尚未初始化。');
  return db;
}

export function getWuwaAccount(discordUserId) {
  return getDb().prepare('SELECT * FROM wuwa_accounts WHERE discord_user_id = ?').get(discordUserId) ?? null;
}

export function bindWuwaAccount(discordUserId, account) {
  const now = account.updatedAt ?? Date.now();
  return getDb().prepare(`
    INSERT INTO wuwa_accounts (
      discord_user_id, player_uid, region, language_code, history_json, bound_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    discordUserId,
    account.playerUid,
    account.region ?? null,
    account.languageCode ?? null,
    JSON.stringify(account.history),
    now,
    now
  );
}

export function updateWuwaAccount(discordUserId, account) {
  return getDb().transaction(() => {
    const existing = getWuwaAccount(discordUserId);
    if (!existing) return { changes: 0 };
    return getDb().prepare(`
      UPDATE wuwa_accounts
      SET region = ?, language_code = ?, history_json = ?, updated_at = ?
      WHERE discord_user_id = ? AND player_uid = ?
    `).run(
      account.region ?? existing.region,
      account.languageCode ?? existing.language_code,
      JSON.stringify(account.history),
      account.updatedAt ?? Date.now(),
      discordUserId,
      account.playerUid
    );
  })();
}

export function deleteWuwaAccount(discordUserId) {
  return getDb().transaction(() =>
    getDb().prepare('DELETE FROM wuwa_accounts WHERE discord_user_id = ?').run(discordUserId)
  )();
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
  'steam_free_channel',
  'steam_free_time',
  'steam_free_enabled',
  'steam_free_last_post_date',
];

export function updateGuildSetting(guildId, key, value) {
  if (!ALLOWED_GUILD_KEYS.includes(key)) throw new Error(`不允許的欄位名稱: ${key}`);
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
  const increment = options.source === 'voice' ? 10 : 1; // 語音經驗值每 10 分鐘檢查一次
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

// 按鈕身份組
export function addReactionRole(guildId, channelId, messageId, emoji, label, roleId) {
  const db = getDb();
  db.prepare(
    'INSERT INTO reaction_roles (guild_id, channel_id, message_id, emoji, label, role_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(guildId, channelId, messageId, emoji, label, roleId);
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

export function getButtonRoleByMessageAndRole(messageId, roleId) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM reaction_roles WHERE message_id = ? AND role_id = ?'
  ).get(messageId, roleId);
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
    db.prepare('INSERT INTO ai_settings (guild_id, model) VALUES (?, ?)').run(guildId, DEFAULT_AI_MODEL);
    row = db.prepare('SELECT * FROM ai_settings WHERE guild_id = ?').get(guildId);
  }
  const model = normalizeAiModel(row.model);
  if (model !== row.model) {
    db.prepare('UPDATE ai_settings SET model = ? WHERE guild_id = ?').run(model, guildId);
  }
  return {
    ...row,
    model,
    whitelist: parseJsonArray(row.whitelist, []),
    admin_ids: parseJsonArray(row.admin_ids, []),
    search_enabled: !!row.search_enabled,
    context_enabled: row.context_enabled !== 0,
  };
}

const ALLOWED_AI_KEYS = ['enabled', 'expires_at', 'system_prompt', 'whitelist', 'model', 'admin_ids', 'search_enabled', 'context_enabled', 'party_channel_id', 'party_expires_at'];

export function updateAiSetting(guildId, key, value) {
  if (!ALLOWED_AI_KEYS.includes(key)) throw new Error(`不允許的欄位名稱: ${key}`);
  const db = getDb();
  getAiSettings(guildId);
  const normalizedValue = key === 'model' ? normalizeAiModel(value) : value;
  db.prepare(`UPDATE ai_settings SET ${key} = ? WHERE guild_id = ?`).run(normalizedValue, guildId);
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

export function getUserReminders(userId, guildId = null, limit = 10) {
  let actualGuildId = guildId;
  let actualLimit = limit;
  if (typeof guildId === 'number') {
    actualLimit = guildId;
    actualGuildId = null;
  }

  const db = getDb();
  if (actualGuildId) {
    return db.prepare(`
      SELECT * FROM reminders
      WHERE user_id = ? AND guild_id = ? AND status = 'pending'
      ORDER BY target_time ASC
      LIMIT ?
    `).all(userId, actualGuildId, actualLimit);
  } else {
    return db.prepare(`
      SELECT * FROM reminders
      WHERE user_id = ? AND status = 'pending'
      ORDER BY target_time ASC
      LIMIT ?
    `).all(userId, actualLimit);
  }
}

export function deleteReminder(reminderId, userId, guildId = null) {
  const db = getDb();
  if (guildId) {
    return db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ? AND guild_id = ?').run(reminderId, userId, guildId);
  } else {
    return db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?').run(reminderId, userId);
  }
}

export function getDueReminders(nowTime = Date.now()) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM reminders
    WHERE status = 'pending'
      AND target_time <= ?
      AND (next_retry_at IS NULL OR next_retry_at <= ?)
  `).all(nowTime, nowTime);
}

export function updateReminderStatus(reminderId, status) {
  const db = getDb();
  db.prepare('UPDATE reminders SET status = ? WHERE id = ?').run(status, reminderId);
}

export function updateReminderError(id, errorMsg, nextRetryAt) {
  const db = getDb();
  return db.prepare(`
    UPDATE reminders
    SET status = 'pending', attempts = attempts + 1, last_error = ?, next_retry_at = ?
    WHERE id = ?
  `).run(errorMsg, nextRetryAt, id);
}

// ===== 抽獎系統 =====

export function addGiveaway(guildId, channelId, messageId, prize, winners, endTime) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO giveaways (guild_id, channel_id, message_id, prize, winners, end_time)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(guildId, channelId, messageId, prize, winners, endTime);
}

export function updateGiveawayState(id, { ended = 0, status, winnerIds } = {}) {
  const db = getDb();
  const fields = ['ended = ?'];
  const values = [ended];
  if (status !== undefined) {
    fields.push('status = ?');
    values.push(status);
  }
  if (winnerIds !== undefined) {
    fields.push('winner_ids = ?');
    values.push(winnerIds);
  }
  values.push(id);
  return db.prepare(`UPDATE giveaways SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function markGiveawayEnded(id, status = 'completed') {
  return updateGiveawayState(id, { ended: 1, status });
}

export function updateGiveawayError(id, errorMsg) {
  const db = getDb();
  db.prepare(`
    UPDATE giveaways
    SET attempts = attempts + 1, last_error = ?
    WHERE id = ?
  `).run(errorMsg, id);
}

export function getActiveGiveaways() {
  const db = getDb();
  return db.prepare('SELECT * FROM giveaways WHERE ended = 0').all();
}

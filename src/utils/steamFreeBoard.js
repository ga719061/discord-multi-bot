import { getDb } from './database.js';
import { v2EditPayload } from './componentsV2.js';
import { logger as defaultLogger } from './logger.js';
import * as steamDeals from './steamDeals.js';

const guildRefreshes = new Map();

export async function refreshDueSteamFreeBoards(client, options = {}) {
  const db = options.db || getDb();
  const log = options.logger || defaultLogger;
  const now = resolveNow(options.now);
  const taipei = steamDeals.getTaipeiDateTime(now);
  const rows = db.prepare(`
    SELECT settings.guild_id, settings.steam_free_channel, settings.steam_free_time,
           COALESCE(board.last_refresh_date, settings.steam_free_last_post_date) AS last_refresh_date
    FROM guild_settings AS settings
    LEFT JOIN steam_free_boards AS board ON board.guild_id = settings.guild_id
    WHERE settings.steam_free_enabled = 1
      AND settings.steam_free_channel IS NOT NULL
      AND settings.steam_free_time IS NOT NULL
  `).all();
  const dueRows = rows.filter((row) => (
    steamDeals.isValidSteamDealTime(row.steam_free_time)
    && row.last_refresh_date !== taipei.date
    && taipei.time >= row.steam_free_time
  ));

  for (const row of rows) {
    if (!steamDeals.isValidSteamDealTime(row.steam_free_time)) {
      log.warn?.(`[SteamFreeBoard] Invalid refresh time guild=${row.guild_id} time=${row.steam_free_time}`);
    }
  }
  if (dueRows.length === 0) return [];

  let games;
  try {
    games = await fetchSnapshot(options, now, log);
  } catch (error) {
    log.error?.('[SteamFreeBoard] Steam snapshot fetch failed:', error);
    return dueRows.map((row) => ({ guildId: row.guild_id, status: 'failed', error }));
  }

  const results = [];
  for (const row of dueRows) {
    let guild;
    try {
      guild = await fetchGuild(client, row.guild_id);
    } catch (error) {
      log.error?.(`[SteamFreeBoard] Guild fetch failed guild=${row.guild_id}:`, error);
      results.push({ guildId: row.guild_id, status: 'failed', error });
      continue;
    }
    if (!guild) {
      results.push({ guildId: row.guild_id, status: 'not_found' });
      continue;
    }

    const result = await serializeGuild(row.guild_id, () => refreshGuild(guild, row, games, {
      db,
      logger: log,
      now,
    }));
    results.push(result);
  }
  return results;
}

export async function refreshSteamFreeBoardNow(guild, options = {}) {
  const db = options.db || getDb();
  const log = options.logger || defaultLogger;
  const now = resolveNow(options.now);

  return serializeGuild(guild.id, async () => {
    const board = getBoard(db, guild.id);
    if (options.disabled === true) {
      return markBoardDisabled(guild, board, { logger: log, now });
    }

    const settings = db.prepare(`
      SELECT guild_id, steam_free_channel, steam_free_time
      FROM guild_settings
      WHERE guild_id = ?
    `).get(guild.id);
    if (!settings?.steam_free_channel) {
      return { guildId: String(guild.id), status: 'not_configured' };
    }

    let games;
    try {
      games = await fetchSnapshot(options, now, log);
    } catch (error) {
      log.error?.(`[SteamFreeBoard] Steam snapshot fetch failed guild=${guild.id}:`, error);
      return { guildId: guild.id, status: 'failed', error };
    }

    return refreshGuild(guild, settings, games, { db, logger: log, now, board });
  });
}

async function refreshGuild(guild, settings, games, context) {
  const { db, logger, now } = context;
  const guildId = String(guild.id);
  const channelId = String(settings.steam_free_channel);
  const board = context.board === undefined ? getBoard(db, guildId) : context.board;

  try {
    const previousGames = parseSnapshot(board?.snapshot_json);
    const addedIds = findAddedIds(previousGames, games);
    const checkedAt = now.getTime();
    const refreshDate = steamDeals.getTaipeiDateTime(now).date;
    const channel = await fetchTextChannel(guild, channelId);
    if (!channel) return { guildId, status: 'not_found' };

    const channelChanged = Boolean(board?.message_id && board.channel_id !== channelId);
    const shouldPublish = !board?.message_id || channelChanged || addedIds.length > 0;
    if (shouldPublish) {
      const message = await channel.send(buildPayload(games, { checkedAt: now }));
      try {
        persistBoard(db, {
          guildId,
          channelId,
          messageId: message.id,
          games,
          refreshDate,
          checkedAt,
        });
      } catch (error) {
        await bestEffortDeletePublishedMessage(message, guildId, logger);
        throw error;
      }

      let previousMessageDeleted = null;
      if (board?.message_id) {
        previousMessageDeleted = await bestEffortDeleteOldMessage(guild, board, {
          logger,
        });
      }

      const action = channelChanged ? 'moved' : board?.message_id ? 'published' : 'created';
      return {
        guildId,
        status: games.length === 0 ? 'empty' : action,
        action,
        count: games.length,
        addedIds,
        messageId: String(message.id),
        previousMessageDeleted,
      };
    }

    const currentMessage = await fetchMessage(guild, board.channel_id, board.message_id);
    if (!currentMessage) {
      const replacement = await channel.send(buildPayload(games, { checkedAt: now }));
      persistBoard(db, {
        guildId,
        channelId,
        messageId: replacement.id,
        games,
        refreshDate,
        checkedAt,
      });
      return {
        guildId,
        status: games.length === 0 ? 'empty' : 'created',
        action: 'created',
        replacedMissing: true,
        count: games.length,
        addedIds,
        messageId: String(replacement.id),
      };
    }

    await currentMessage.edit(buildEditPayload(games, { checkedAt: now }));
    persistBoard(db, {
      guildId,
      channelId,
      messageId: board.message_id,
      games,
      refreshDate,
      checkedAt,
    });
    return {
      guildId,
      status: games.length === 0 ? 'empty' : 'updated',
      action: 'updated',
      count: games.length,
      addedIds,
      messageId: String(board.message_id),
    };
  } catch (error) {
    logger.error?.(`[SteamFreeBoard] Refresh failed guild=${guildId}:`, error);
    return { guildId, status: 'failed', error };
  }
}

async function markBoardDisabled(guild, board, context) {
  const guildId = String(guild.id);
  if (!board?.message_id) return { guildId, status: 'not_found' };

  try {
    const message = await fetchMessage(guild, board.channel_id, board.message_id);
    if (!message) return { guildId, status: 'not_found' };
    const games = parseSnapshot(board.snapshot_json);
    await message.edit(buildEditPayload(games, { checkedAt: context.now, disabled: true }));
    return { guildId, status: 'disabled', count: games.length, messageId: String(board.message_id) };
  } catch (error) {
    context.logger.error?.(`[SteamFreeBoard] Disable marker failed guild=${guild.id}:`, error);
    return { guildId, status: 'failed', error };
  }
}

async function bestEffortDeleteOldMessage(guild, board, context) {
  try {
    const message = await fetchMessage(guild, board.channel_id, board.message_id);
    if (!message) return true;
    await message.delete();
    return true;
  } catch (error) {
    context.logger.warn?.(`[SteamFreeBoard] Could not delete previous board guild=${guild.id}:`, error);
    return false;
  }
}

async function bestEffortDeletePublishedMessage(message, guildId, logger) {
  try {
    await message.delete();
  } catch (error) {
    logger.warn?.(`[SteamFreeBoard] Could not roll back unpublished board guild=${guildId}:`, error);
  }
}

async function fetchGuild(client, guildId) {
  try {
    return await client.guilds.fetch(guildId);
  } catch (error) {
    if (discordErrorCode(error) === 10004) return null;
    throw error;
  }
}

async function fetchTextChannel(guild, channelId) {
  let channel;
  try {
    channel = await guild.channels.fetch(channelId);
  } catch (error) {
    if (discordErrorCode(error) === 10003) return null;
    throw error;
  }
  if (!channel) return null;
  if (typeof channel.isTextBased === 'function' && !channel.isTextBased()) return null;
  if (typeof channel.send !== 'function') return null;
  return channel;
}

async function fetchMessage(guild, channelId, messageId) {
  const channel = await guild.channels.fetch(channelId);
  if (!channel?.messages?.fetch) return null;
  try {
    return await channel.messages.fetch(messageId);
  } catch (error) {
    if (discordErrorCode(error) === 10008) return null;
    throw error;
  }
}

function discordErrorCode(error) {
  return Number(error?.code ?? error?.rawError?.code);
}

function persistBoard(db, state) {
  db.prepare(`
    INSERT INTO steam_free_boards (
      guild_id, channel_id, message_id, snapshot_json, last_refresh_date, last_checked_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      channel_id = excluded.channel_id,
      message_id = excluded.message_id,
      snapshot_json = excluded.snapshot_json,
      last_refresh_date = excluded.last_refresh_date,
      last_checked_at = excluded.last_checked_at
  `).run(
    state.guildId,
    state.channelId,
    String(state.messageId),
    JSON.stringify(state.games),
    state.refreshDate,
    state.checkedAt
  );
}

function getBoard(db, guildId) {
  return db.prepare('SELECT * FROM steam_free_boards WHERE guild_id = ?').get(guildId) || null;
}

function parseSnapshot(value) {
  if (value == null || value === '') return [];
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((game) => !game || typeof game !== 'object' || game.id == null)) {
    throw new Error('Invalid Steam free board snapshot');
  }
  return parsed;
}

function findAddedIds(previousGames, currentGames) {
  const previousIds = new Set(previousGames.map((game) => String(game.id)));
  return currentGames
    .map((game) => String(game.id))
    .filter((id) => !previousIds.has(id));
}

function buildPayload(games, options) {
  return steamDeals.buildSteamFreeGamesPayload(games, options);
}

function buildEditPayload(games, options) {
  return v2EditPayload(buildPayload(games, options));
}

function resolveNow(value) {
  const resolved = typeof value === 'function' ? value() : value;
  return resolved instanceof Date ? resolved : new Date(resolved ?? Date.now());
}

async function fetchSnapshot(options, now, logger) {
  if (options.fetchGames) return options.fetchGames();
  if (typeof steamDeals.fetchSteamLimitedFreeGamesSnapshot !== 'function') {
    throw new Error('fetchSteamLimitedFreeGamesSnapshot is unavailable');
  }
  return steamDeals.fetchSteamLimitedFreeGamesSnapshot(options.fetchImpl, { now, logger });
}

function serializeGuild(guildId, task) {
  const key = String(guildId);
  const previous = guildRefreshes.get(key) || Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  guildRefreshes.set(key, current);
  return current.finally(() => {
    if (guildRefreshes.get(key) === current) guildRefreshes.delete(key);
  });
}

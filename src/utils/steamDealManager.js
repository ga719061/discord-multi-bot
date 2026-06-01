import { getDb } from './database.js';
import { logger } from './logger.js';
import {
  buildSteamDealsPayload,
  buildSteamFreeGamesPayload,
  fetchSteamLimitedFreeGames,
  fetchSteamSpecialDeals,
  getTaipeiDateTime,
  isValidSteamDealTime,
} from './steamDeals.js';

let checkInterval = null;

export function initSteamDealManager(client) {
  if (checkInterval) return;

  checkInterval = setInterval(() => {
    checkSteamDeals(client);
  }, 60_000);

  checkSteamDeals(client);
  logger.info('[SteamDealManager] Steam 每日特價推播已啟動');
}

async function checkSteamDeals(client) {
  try {
    const db = getDb();
    const now = getTaipeiDateTime();
    const settings = db.prepare(`
      SELECT guild_id, steam_deal_channel, steam_deal_time, steam_deal_last_post_date
      FROM guild_settings
      WHERE steam_deal_enabled = 1
        AND steam_deal_channel IS NOT NULL
        AND steam_deal_time IS NOT NULL
    `).all();

    for (const row of settings) {
      if (!isValidSteamDealTime(row.steam_deal_time)) {
        logger.warn(`[SteamDealManager] 推播時間無效 guild=${row.guild_id} time=${row.steam_deal_time}`);
        continue;
      }
      if (row.steam_deal_last_post_date === now.date) continue;
      if (now.time < row.steam_deal_time) continue;

      await postSteamDealsForGuild(client, row, now.date, db);
    }

    const freeSettings = db.prepare(`
      SELECT guild_id, steam_free_channel, steam_free_time, steam_free_last_post_date
      FROM guild_settings
      WHERE steam_free_enabled = 1
        AND steam_free_channel IS NOT NULL
        AND steam_free_time IS NOT NULL
    `).all();

    for (const row of freeSettings) {
      if (!isValidSteamDealTime(row.steam_free_time)) {
        logger.warn(`[SteamDealManager] Steam limited free time invalid guild=${row.guild_id} time=${row.steam_free_time}`);
        continue;
      }
      if (row.steam_free_last_post_date === now.date) continue;
      if (now.time < row.steam_free_time) continue;

      await postSteamFreeGamesForGuild(client, row, now.date, db);
    }
  } catch (err) {
    logger.error('[SteamDealManager] 檢查 Steam 特價推播失敗:', err);
  }
}

async function postSteamDealsForGuild(client, row, today, db) {
  try {
    const guild = await client.guilds.fetch(row.guild_id).catch(() => null);
    if (!guild) return;

    const channel = await guild.channels.fetch(row.steam_deal_channel).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      logger.warn(`[SteamDealManager] 找不到可用頻道 guild=${row.guild_id} channel=${row.steam_deal_channel}`);
      return;
    }

    const deals = await fetchSteamSpecialDeals(10);
    const payload = buildSteamDealsPayload(deals, {
      title: '🐕👑 吉吉王國・御用特價情報',
      intro: `汪！本王巡視 Steam 領地，為子民帶來今日的 ${deals.length} 款熱門特價清單！價格與折扣可能會隨商店更新而變動，欲購從速！`,
      footer: `每日 ${row.steam_deal_time} 聖旨推播 | 吉吉王國皇家特價`,
    });

    await channel.send(payload);
    db.prepare('UPDATE guild_settings SET steam_deal_last_post_date = ? WHERE guild_id = ?').run(today, row.guild_id);
    logger.info(`[SteamDealManager] 已推播 Steam 特價 guild=${row.guild_id}`);
  } catch (err) {
    logger.error(`[SteamDealManager] 推播失敗 guild=${row.guild_id} code=${err.code || 'unavailable'}:`, err);
  }
}

async function postSteamFreeGamesForGuild(client, row, today, db) {
  try {
    const guild = await client.guilds.fetch(row.guild_id).catch(() => null);
    if (!guild) return;

    const channel = await guild.channels.fetch(row.steam_free_channel).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      logger.warn(`[SteamDealManager] Steam limited free channel unavailable guild=${row.guild_id} channel=${row.steam_free_channel}`);
      return;
    }

    const games = await fetchSteamLimitedFreeGames(10);
    if (games.length > 0) {
      const payload = buildSteamFreeGamesPayload(games, {
        title: '🐕👑 吉吉王國・限時免費御賜情報',
        intro: `本王發現 Steam 商店正開放免費進貢！皇家採購廳已巡獲 ${games.length} 款限時免費遊戲，子民們速速領取領賞！汪！`,
        footer: `每日 ${row.steam_free_time} 聖旨推播 | 吉吉王國限時免費`,
      });
      await channel.send(payload);
      logger.info(`[SteamDealManager] Posted Steam limited free games guild=${row.guild_id}`);
    } else {
      logger.info(`[SteamDealManager] No Steam limited free games today guild=${row.guild_id}`);
    }

    db.prepare('UPDATE guild_settings SET steam_free_last_post_date = ? WHERE guild_id = ?').run(today, row.guild_id);
  } catch (err) {
    logger.error(`[SteamDealManager] Steam limited free push failed guild=${row.guild_id} code=${err.code || 'unavailable'}:`, err);
  }
}

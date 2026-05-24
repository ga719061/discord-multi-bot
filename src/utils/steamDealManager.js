import { getDb } from './database.js';
import { logger } from './logger.js';
import { buildSteamDealsEmbeds, fetchSteamSpecialDeals, getTaipeiDateTime, isValidSteamDealTime } from './steamDeals.js';

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
    const embeds = buildSteamDealsEmbeds(deals, {
      title: '🐕👑 吉吉王國每日 Steam 特價聖旨',
      intro: `汪汪！今日的皇家採購清單送達。本王親自批准這 ${deals.length} 款熱門特價，子民們可以開始盤算荷包了！`,
      footer: `🐕 每日 ${row.steam_deal_time} 御前推播 | Steam 台灣區價格`,
    });

    await channel.send({ embeds });
    db.prepare('UPDATE guild_settings SET steam_deal_last_post_date = ? WHERE guild_id = ?').run(today, row.guild_id);
    logger.info(`[SteamDealManager] 已推播 Steam 特價 guild=${row.guild_id}`);
  } catch (err) {
    logger.error(`[SteamDealManager] 推播失敗 guild=${row.guild_id} code=${err.code || 'unavailable'}:`, err);
  }
}

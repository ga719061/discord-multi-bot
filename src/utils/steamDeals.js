import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MediaGalleryBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { ansiBlock, COLORS, fmt } from './style.js';
import { ephemeralV2Payload, v2Card, v2Divider, v2Panel, v2Payload, v2Text } from './componentsV2.js';
import { UI_COLORS } from './style.js';

const STEAM_FEATURED_URL = 'https://store.steampowered.com/api/featuredcategories?l=tchinese&cc=tw';
const STEAM_SEARCH_SPECIALS_URL = 'https://store.steampowered.com/search/results/?query&start=0&count=50&dynamic_data=&sort_by=_ASC&specials=1&cc=tw&l=tchinese&infinite=1';
const STEAM_SEARCH_LIMITED_FREE_URL = 'https://store.steampowered.com/search/results/?query&start=0&count=50&dynamic_data=&sort_by=_ASC&specials=1&maxprice=free&cc=tw&l=tchinese&infinite=1';
const STEAM_STORE_BROWSE_ITEMS_URL = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/';
const TAIPEI_TIME_ZONE = 'Asia/Taipei';
const REQUEST_TIMEOUT_MS = 10_000;
const STEAM_SEARCH_PAGE_SIZE = 50;
const STEAM_BROWSE_BATCH_SIZE = 50;
const STEAM_APP_DETAILS_CACHE_TTL_MS = 10 * 60_000;
const steamAppDetailsCache = new Map();

export class SteamServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SteamServiceError';
    this.code = code;
  }
}

export async function fetchSteamJson(url, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) {
      throw new SteamServiceError('unavailable', `Steam returned HTTP ${response.status}`);
    }

    try {
      return await response.json();
    } catch {
      throw new SteamServiceError('invalid_data', 'Steam returned invalid JSON');
    }
  } catch (error) {
    if (error instanceof SteamServiceError) throw error;
    if (error?.name === 'AbortError') {
      throw new SteamServiceError('unavailable', 'Steam request timed out');
    }
    throw new SteamServiceError('unavailable', error?.message || 'Steam request failed');
  } finally {
    clearTimeout(timeout);
  }
}

export function getSteamFailureMessage(error) {
  if (error?.code === 'invalid_data') {
    return '🐕📜 汪... Steam 傳來的資料格式不完整，本王暫時讀不懂，請子民稍後再試。';
  }
  return '🐕💥 汪！Steam 領地目前無法連線或回應過慢，請子民稍後再試。';
}

export function isValidSteamDealTime(time) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function getTaipeiDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TAIPEI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

export async function fetchSteamSpecialDeals(limit = 10) {
  const data = await fetchSteamJson(STEAM_FEATURED_URL);
  const items = data?.specials?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new SteamServiceError('invalid_data', 'Steam returned no special deals');
  }

  const unique = uniqueSteamDeals(items, limit);
  if (unique.length >= limit) return hydrateSteamDealImages(unique);

  const fallbackItems = await fetchSteamSearchSpecialDeals();
  const filledDeals = uniqueSteamDeals([...unique, ...fallbackItems], limit);
  return hydrateSteamDealImages(filledDeals);
}

export async function fetchSteamLimitedFreeGames(limit = 10, fetchImpl = fetch) {
  const data = await fetchSteamJson(STEAM_SEARCH_LIMITED_FREE_URL, fetchImpl);
  if (typeof data?.results_html !== 'string') {
    throw new SteamServiceError('invalid_data', 'Steam returned no limited free results');
  }

  const games = parseSteamSearchDeals(data.results_html).filter(isLimitedFreeSteamGame);
  return uniqueSteamDeals(games, limit).map(cleanDeal);
}

export async function fetchSteamLimitedFreeGamesSnapshot(fetchImpl = fetch, options = {}) {
  const candidates = await fetchAllSteamLimitedFreeCandidates(fetchImpl);
  if (candidates.length === 0) return [];

  const storeItems = new Map();
  const failedCandidateIds = new Set();
  for (let start = 0; start < candidates.length; start += STEAM_BROWSE_BATCH_SIZE) {
    const batch = candidates.slice(start, start + STEAM_BROWSE_BATCH_SIZE);
    try {
      const data = await fetchSteamJson(buildSteamBrowseItemsUrl(batch), fetchImpl);
      const items = data?.response?.store_items;
      if (!Array.isArray(items)) {
        throw new SteamServiceError('invalid_data', 'Steam returned invalid store browse data');
      }

      for (const item of items) {
        const appId = Number(item?.appid);
        if (appId) storeItems.set(appId, item);
      }
    } catch (error) {
      options.logger?.warn?.(
        `[SteamDeals] Store Browse enrichment failed for ${batch.length} free-game candidates; using search data:`,
        error
      );
      for (const candidate of batch) failedCandidateIds.add(candidate.id);
    }
  }

  const omittedCount = candidates.filter((candidate) => (
    !storeItems.has(candidate.id) && !failedCandidateIds.has(candidate.id)
  )).length;
  if (omittedCount > 0) {
    options.logger?.warn?.(
      `[SteamDeals] Store Browse omitted ${omittedCount} free-game candidates; using search data.`
    );
  }

  const nowEpoch = toSteamEpochSeconds(options.now ?? Date.now());
  const games = [];
  let incompleteCount = 0;
  for (const candidate of candidates) {
    const item = storeItems.get(candidate.id);
    if (!item) {
      games.push(fallbackSteamFreeGame(candidate));
      continue;
    }

    const purchase = item?.best_purchase_option;
    if (item.is_free_temporarily === false || purchase?.is_free_to_keep === false) continue;
    if (item.is_free_temporarily !== true || purchase?.is_free_to_keep !== true) {
      games.push(fallbackSteamFreeGame(candidate));
      incompleteCount += 1;
      continue;
    }

    const freeUntil = toSteamEpochSeconds(purchase.free_to_keep_ends ?? item.free_to_keep_ends);
    if (freeUntil !== null && freeUntil <= nowEpoch) continue;

    games.push(cleanDeal({
      ...candidate,
      name: item.name || candidate.name,
      discount_percent: 100,
      original_price: finiteNumberOr(purchase.original_price_in_cents, candidate.original_price),
      final_price: finiteNumberOr(purchase.final_price_in_cents, candidate.final_price),
      large_capsule_image: candidate.large_capsule_image || candidate.header_image,
      free_until: freeUntil,
    }));
  }

  if (incompleteCount > 0) {
    options.logger?.warn?.(
      `[SteamDeals] Store Browse returned incomplete verification for ${incompleteCount} free-game candidates; using search data.`
    );
  }
  return games;
}

function fallbackSteamFreeGame(candidate) {
  return cleanDeal({ ...candidate, free_until: null, browse_verified: false });
}

export function buildSteamDealsEmbeds(deals, options = {}) {
  const title = options.title || '🐕👑 吉吉王國・御用百視達特價榜';
  const intro = options.intro || '汪！皇家採購廳已巡完 Steam 商店，以下是本王替子民挑出的熱門特價清單：';
  const footer = options.footer || '🐕 吉吉國王每日採購聖旨 | 台灣區價格';
  const dealCount = Math.min(deals.length, 10);

  return deals.slice(0, 10).map((game, index) => {
    const discount = Number(game.discount_percent) || 0;
    const original = formatSteamPrice(game.original_price);
    const final = formatSteamPrice(game.final_price);

    const priceLines = [
      `${fmt(COLORS.GOLD, `📉 -${discount}%`)}  ➔  ${fmt(COLORS.GREEN, final)}`,
    ];

    if (original && original !== final) {
      priceLines.push({ color: COLORS.GRAY, text: `原價 ${original}` });
    }

    const description = [
      index === 0 ? `${intro}\n` : null,
      ansiBlock(priceLines),
      '🐾 本王提醒：特價會隨 Steam 商店更新而變動，想買就快點覲見商店！',
    ].filter(Boolean).join('\n');

    const embed = new EmbedBuilder()
      .setColor(getDealColor(index))
      .setAuthor({ name: index === 0 ? '吉吉國王皇家採購廳' : `皇家採購榜第 ${index + 1} 名` })
      .setTitle(`${getRankMedal(index)} ${game.name}`)
      .setURL(`https://store.steampowered.com/app/${game.id}`)
      .setDescription(description)
      .setTimestamp()
      .setFooter({ text: index === 0 ? footer : '🐕 點標題即可前往 Steam 商店覲見' });

    const image = game.large_capsule_image || game.header_image;
    if (image) embed.setImage(image);

    if (index === 0) {
      embed.addFields({
        name: '📜 今日聖旨',
        value: `${title}\n本王已核准今日 ${dealCount} 款熱門特價，子民們量力而買，汪！`,
      });
    }

    return embed;
  });
}

export function buildSteamDealsPayload(deals, options = {}) {
  const title = options.title || '🐕👑 吉吉王國・御用特價情報';
  const intro = options.intro || '汪！本王巡視 Steam 領地，為子民帶來今日的熱門特價清單！價格與折扣可能會隨商店更新而變動，欲購從速！';
  const footer = options.footer || '吉吉王國皇家特價推播';
  const rankedDeals = deals.slice(0, 10);
  const publishedAt = getTaipeiDateTime(options.publishedAt || new Date());
  const panel = v2Panel(UI_COLORS.STEAM)
    .addTextDisplayComponents(v2Text(
      `# ${title}\n${intro}\n-# 最多顯示 10 款遊戲，名次沿用 Steam 目前顯示順序，實際價格以商店頁面為準。`
    ))
    .addSeparatorComponents(v2Divider());

  rankedDeals.forEach((game, index) => {
    addSteamListItem(panel, game, index, buildRankedDealText(game, index));
  });

  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('steam_deal_detail')
      .setPlaceholder('挑選一款特價遊戲，覲見皇家情報')
      .addOptions(
        rankedDeals.map((game, index) => ({
          label: truncateMenuText(`${getRankMedal(index)} ${game.name}`, 100),
          description: truncateMenuText(buildMenuDescription(game), 100),
          value: String(game.id),
        }))
      )
  );

  panel
    .addSeparatorComponents(v2Divider())
    .addTextDisplayComponents(v2Text('## 覲見詳細情報\n挑選一款遊戲，本王將私下恩賜該遊戲的詳細情報與傳送門。'))
    .addActionRowComponents(selectRow)
    .addTextDisplayComponents(v2Text(`-# ${footer} | 發布 ${publishedAt.date} ${publishedAt.time} | 特價活動會隨 Steam 商店更新而變動`));

  return v2Payload([panel]);
}

export function buildSteamFreeGamesPayload(games, options = {}) {
  const title = options.title || '🐕👑 吉吉王國・限時免費御賜情報';
  const intro = options.intro || '本王發現 Steam 商店正開放免費進貢！以下是 100% 折扣的限時免費遊戲，子民們速速領取領賞！汪！';
  const footer = options.footer || '吉吉王國限時免費聖旨';
  const rankedGames = games
    .map((game, index) => ({ game, index, freeUntil: toSteamEpochSeconds(game.free_until) }))
    .sort((left, right) => compareSteamFreeGames(left, right))
    .slice(0, 10)
    .map(({ game }) => game);
  const checkedAt = getTaipeiDateTime(options.checkedAt || options.publishedAt || new Date());
  const notices = buildSteamFreeBoardNotices(options);
  const panel = v2Panel(UI_COLORS.STEAM)
    .addTextDisplayComponents(v2Text(
      `${notices.length ? `${notices.join('\n')}\n` : ''}# ${title}\n${intro}\n-# 最多顯示 10 款遊戲；只列入原價遊戲目前折扣到免費的項目，不包含永久免費遊玩。`
    ))
    .addSeparatorComponents(v2Divider());

  if (rankedGames.length === 0) {
    panel.addTextDisplayComponents(v2Text('## 目前沒有 Steam 限時免費活動\n本王會在下次排程繼續巡視 Steam 商店。'));
  } else {
    rankedGames.forEach((game, index) => {
      addSteamListItem(panel, game, index, buildRankedFreeGameText(game, index));
    });

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('steam_deal_detail')
        .setPlaceholder('挑選一款限時免費遊戲查看皇家情報')
        .addOptions(
          rankedGames.map((game, index) => ({
            label: truncateMenuText(`${getRankMedal(index)} ${game.name}`, 100),
            description: truncateMenuText(buildFreeMenuDescription(game), 100),
            value: String(game.id),
          }))
        )
    );

    panel
      .addSeparatorComponents(v2Divider())
      .addTextDisplayComponents(v2Text('## 覲見詳細情報\n挑選一款遊戲，本王將私下恩賜該遊戲的詳細情報與傳送門。'))
      .addActionRowComponents(selectRow);
  }

  panel.addTextDisplayComponents(v2Text(
    `-# ${footer} | 最後檢查 ${checkedAt.date} ${checkedAt.time} | 免費活動會隨 Steam 商店更新而變動`
  ));

  return v2Payload([panel]);
}

export async function fetchSteamAppDetails(appId, fetchImpl = fetch, options = {}) {
  const cacheKey = String(appId);
  const now = options.now || Date.now();

  // Prune expired entries
  for (const [k, item] of steamAppDetailsCache.entries()) {
    if (item.expiresAt <= now) {
      steamAppDetailsCache.delete(k);
    }
  }

  const cached = steamAppDetailsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.details;
  if (cached) steamAppDetailsCache.delete(cacheKey);

  const data = await fetchSteamJson(
    `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=tw&l=tchinese`,
    fetchImpl
  );
  const details = data?.[appId]?.success ? data[appId].data : null;
  if (details) {
    if (steamAppDetailsCache.size >= 100 && !steamAppDetailsCache.has(cacheKey)) {
      const oldestKey = steamAppDetailsCache.keys().next().value;
      if (oldestKey !== undefined) steamAppDetailsCache.delete(oldestKey);
    }
    steamAppDetailsCache.set(cacheKey, {
      details,
      expiresAt: now + STEAM_APP_DETAILS_CACHE_TTL_MS,
    });
  }
  return details;
}

export function clearSteamAppDetailsCacheForTests() {
  steamAppDetailsCache.clear();
}

export function buildSteamDealDetailPayload(appId, details, options = {}) {
  const checkedAt = getTaipeiDateTime(options.checkedAt || new Date());
  const storeUrl = `https://store.steampowered.com/app/${appId}/`;
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('前往 Steam 商店覲見')
      .setStyle(ButtonStyle.Link)
      .setURL(storeUrl)
  );
  const price = details.price_overview;
  let priceLine = '價格資料暫未呈報';
  if (details.is_free) {
    priceLine = '**免費進貢**';
  } else if (price) {
    const discount = Number(price.discount_percent) || 0;
    const original = price.initial_formatted && price.initial_formatted !== price.final_formatted
      ? ` ~~${price.initial_formatted}~~`
      : '';
    priceLine = discount > 0
      ? `📉 **-${discount}%**${original} → **${price.final_formatted}**`
      : `💰 **${price.final_formatted}**（目前無特價，子民再等等）`;
  }
  const fields = [{
    name: '即時價格呈報',
    value: `${priceLine}\n` +
      `📅 發行日期：${details.release_date?.date || '尚未面世'}\n` +
      `🏅 Metacritic 評價：${details.metacritic?.score ?? '尚無評價'}`,
  }];

  return ephemeralV2Payload([
    v2Card({
      title: `🎮 ${escapeMarkdown(details.name || 'Steam 遊戲情報覲見')}`,
      description: escapeMarkdown(details.short_description || 'Steam 暫未呈報遊戲簡介。'),
      accentColor: UI_COLORS.STEAM,
      fields,
      images: details.header_image ? [details.header_image] : [],
      footer: `🐕 皇家即時查詢 ${checkedAt.date} ${checkedAt.time} | Steam 台灣區價格`,
      actionRows: [actionRow],
    }),
  ]);
}

function uniqueSteamDeals(items, limit) {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    const key = item?.id ? `id:${item.id}` : `name:${normalizeSteamTitle(item?.name)}`;
    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(item);

    if (unique.length >= limit) break;
  }

  return unique;
}

async function fetchAllSteamLimitedFreeCandidates(fetchImpl) {
  const candidates = [];
  let start = 0;
  let totalCount = null;

  do {
    const data = await fetchSteamJson(buildSteamLimitedFreeSearchUrl(start), fetchImpl);
    if (typeof data?.results_html !== 'string') {
      throw new SteamServiceError('invalid_data', 'Steam returned no limited free results');
    }

    const parsedDeals = parseSteamSearchDeals(data.results_html);
    const reportedTotal = Number(data.total_count);
    const pageShouldContainRows = Number.isFinite(reportedTotal) && reportedTotal > start;
    if ((pageShouldContainRows || /<a\b/i.test(data.results_html)) && parsedDeals.length === 0) {
      throw new SteamServiceError('invalid_data', 'Steam limited free results could not be parsed');
    }

    candidates.push(...parsedDeals.filter(isLimitedFreeSteamGame));
    if (totalCount === null) {
      totalCount = Number.isFinite(reportedTotal) && reportedTotal >= 0
        ? reportedTotal
        : start + STEAM_SEARCH_PAGE_SIZE;
    }
    start += STEAM_SEARCH_PAGE_SIZE;
  } while (start < totalCount);

  return uniqueSteamDeals(candidates, Number.POSITIVE_INFINITY);
}

function buildSteamLimitedFreeSearchUrl(start) {
  const url = new URL(STEAM_SEARCH_LIMITED_FREE_URL);
  url.searchParams.set('start', String(start));
  url.searchParams.set('count', String(STEAM_SEARCH_PAGE_SIZE));
  return url.toString();
}

function buildSteamBrowseItemsUrl(games) {
  const input = {
    ids: games.map((game) => ({ appid: game.id })),
    context: { language: 'tchinese', country_code: 'TW' },
    data_request: { include_all_purchase_options: true },
  };
  const url = new URL(STEAM_STORE_BROWSE_ITEMS_URL);
  url.searchParams.set('input_json', JSON.stringify(input));
  return url.toString();
}

async function fetchSteamSearchSpecialDeals() {
  const data = await fetchSteamJson(STEAM_SEARCH_SPECIALS_URL);
  return parseSteamSearchDeals(data?.results_html || '');
}

function parseSteamSearchDeals(html) {
  return [...String(html).matchAll(/<a[\s\S]*?<\/a>/g)]
    .map((match) => parseSteamSearchDeal(match[0]))
    .filter(Boolean);
}

function parseSteamSearchDeal(itemHtml) {
  const id = Number(matchAttr(itemHtml, 'data-ds-appid'));
  const name = decodeHtml(matchTag(itemHtml, 'span', 'title'));
  const image = matchAttr(itemHtml, 'src');
  const finalPrice = Number(matchAttr(itemHtml, 'data-price-final'));
  const discount = Number(matchAttr(itemHtml, 'data-discount'));
  const originalPrice = parseSteamPriceText(matchClass(itemHtml, 'discount_original_price'));

  if (!id || !name || !Number.isFinite(finalPrice) || !Number.isFinite(discount) || discount <= 0) {
    return null;
  }

  return {
    id,
    name,
    discount_percent: discount,
    final_price: finalPrice,
    original_price: originalPrice || estimateOriginalPrice(finalPrice, discount),
    header_image: image,
    large_capsule_image: image,
    needs_image_details: true,
  };
}

async function hydrateSteamDealImages(deals) {
  return Promise.all(deals.map(async (deal) => {
    if (!deal.needs_image_details && deal.header_image) return deal;

    const details = await fetchSteamAppDetails(deal.id).catch(() => null);
    return cleanDeal({
      ...deal,
      header_image: details?.header_image || deal.header_image,
      large_capsule_image: details?.header_image || deal.large_capsule_image || deal.header_image,
    });
  }));
}

function cleanDeal(deal) {
  const { needs_image_details, ...cleaned } = deal;
  return cleaned;
}

function addSteamListItem(panel, game, index, rowText) {
  const image = game.header_image || game.large_capsule_image;
  if (!image) {
    panel.addTextDisplayComponents(v2Text(rowText));
    return;
  }

  panel
    .addTextDisplayComponents(v2Text(rowText))
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems({
        media: { url: image },
        description: `${getRankMedal(index)} ${game.name}`,
      })
  );
}

function matchAttr(html, attr) {
  const match = String(html).match(new RegExp(`${attr}="([^"]+)"`));
  return match?.[1] || '';
}

function matchTag(html, tag, className) {
  const match = String(html).match(new RegExp(`<${tag}[^>]*class="${className}"[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match?.[1] || '';
}

function matchClass(html, className) {
  const match = String(html).match(new RegExp(`<[^>]*class="${className}"[^>]*>([\\s\\S]*?)<\\/[^>]+>`));
  return match?.[1] || '';
}

function parseSteamPriceText(text) {
  const normalized = String(text).replace(/,/g, '');
  const decimalMatch = normalized.match(/(\d+)\.(\d{2})/);
  if (decimalMatch) return Number(decimalMatch[1]) * 100 + Number(decimalMatch[2]);
  const digits = normalized.replace(/[^\d]/g, '');
  if (!digits) return null;
  return Number(digits) * 100;
}

function estimateOriginalPrice(finalPrice, discount) {
  if (!discount || discount >= 100) return finalPrice;
  return Math.round(finalPrice / (1 - discount / 100));
}

function decodeHtml(text) {
  return String(text || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function normalizeSteamTitle(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getRankMedal(index) {
  if (index === 0) return '🥇';
  if (index === 1) return '🥈';
  if (index === 2) return '🥉';
  return `#${index + 1}`;
}

function getDealColor(index) {
  if (index === 0) return UI_COLORS.ROYAL;
  if (index === 1) return UI_COLORS.SILVER;
  if (index === 2) return UI_COLORS.BRONZE;
  return UI_COLORS.STEAM;
}

function isLimitedFreeSteamGame(game) {
  return Number(game.discount_percent) >= 100
    && Number(game.final_price) === 0
    && Number(game.original_price) > 0;
}

function formatSteamPrice(value) {
  const cents = Number(value);
  if (!Number.isFinite(cents)) return '尚未呈報';
  if (cents === 0) return '免費進貢';
  return `NT$${Math.round(cents / 100).toLocaleString('zh-TW')}`;
}

function escapeMarkdown(text) {
  return String(text || 'Unknown Game').replace(/([\\`*_{}\[\]()#+\-.!|>])/g, '\\$1');
}

function buildRankedDealText(game, index) {
  const discount = Number(game.discount_percent) || 0;
  const final = formatSteamPrice(game.final_price);
  const original = formatSteamPrice(game.original_price);
  const originalText = original && original !== final ? ` ~~${original}~~` : '';
  return `## ${getRankMedal(index)} [${escapeMarkdown(game.name)}](https://store.steampowered.com/app/${game.id})\n` +
    `📉 **-${discount}%**${originalText} → **${final}**`;
}

function buildRankedFreeGameText(game, index) {
  const original = formatSteamPrice(game.original_price);
  if (game.browse_verified === false) {
    return `## ${getRankMedal(index)} [${escapeMarkdown(game.name)}](https://store.steampowered.com/app/${game.id})\n` +
      `Steam 搜尋顯示 **100% 折扣** ~~${original}~~ -> **免費進貢**\n` +
      '⚠️ 永久入庫狀態與截止時間暫時無法由 Steam 複核';
  }
  return `## ${getRankMedal(index)} [${escapeMarkdown(game.name)}](https://store.steampowered.com/app/${game.id})\n` +
    `限時免費 **-${Number(game.discount_percent) || 100}%** ~~${original}~~ -> **免費進貢**\n` +
    formatSteamFreeUntil(game.free_until);
}

function buildMenuDescription(game) {
  const discount = Number(game.discount_percent) || 0;
  return `折扣 -${discount}% | 皇家特價 ${formatSteamPrice(game.final_price)}`;
}

function buildFreeMenuDescription(game) {
  if (game.browse_verified === false) return '100% 折扣 | 永久入庫狀態待 Steam 複核';
  const freeUntil = toSteamEpochSeconds(game.free_until);
  const taipeiDeadline = freeUntil === null ? null : formatTaipeiDateTime(freeUntil);
  const deadline = taipeiDeadline === null
    ? '截止時間未提供'
    : `截止 ${taipeiDeadline.date} ${taipeiDeadline.time}`;
  return `限時免費 | ${deadline}`;
}

function buildSteamFreeBoardNotices(options) {
  const notices = [];
  if (options.disabled) {
    notices.push('## ⏸️ 自動更新已停用\n此貼文內容可能已過期。');
  }
  return notices;
}

function compareSteamFreeGames(left, right) {
  if (left.freeUntil === null && right.freeUntil !== null) return 1;
  if (left.freeUntil !== null && right.freeUntil === null) return -1;
  if (left.freeUntil !== null && right.freeUntil !== null && left.freeUntil !== right.freeUntil) {
    return left.freeUntil - right.freeUntil;
  }
  return left.index - right.index;
}

function formatSteamFreeUntil(value) {
  const epoch = toSteamEpochSeconds(value);
  if (epoch === null) return '📅 免費截止：Steam 未提供截止時間';
  const { date, time } = formatTaipeiDateTime(epoch);
  return `📅 免費截止：${date} ${time}（台灣時間，<t:${epoch}:R>）`;
}

function formatTaipeiDateTime(epochSeconds) {
  const dateTime = getTaipeiDateTime(new Date(epochSeconds * 1000));
  return { ...dateTime, date: dateTime.date.replaceAll('-', '/') };
}

function toSteamEpochSeconds(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.floor(numeric > 10_000_000_000 ? numeric / 1000 : numeric);
}

function finiteNumberOr(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
function truncateMenuText(text, maxLength) {
  const value = String(text || '-');
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

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
const TAIPEI_TIME_ZONE = 'Asia/Taipei';
const REQUEST_TIMEOUT_MS = 10_000;

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
    return '🐕📜 汪... Steam 傳來的資料格式不完整，本王暫時讀不懂，請稍後再試。';
  }
  return '🐕💥 汪！Steam 目前無法連線或回應過慢，請稍後再試。';
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
  const title = options.title || '🐕👑 吉吉王國・御用百視達特價榜';
  const intro = options.intro || '汪！皇家採購廳已巡完 Steam 商店，以下是本王替子民挑出的熱門特價清單：';
  const footer = options.footer || '🐕 吉吉國王每日採購聖旨 | 台灣區價格';
  const rankedDeals = deals.slice(0, 10);
  const publishedAt = getTaipeiDateTime(options.publishedAt || new Date());
  const firstPanel = v2Panel(UI_COLORS.ROYAL)
    .addTextDisplayComponents(v2Text(
      `# ${title}\n${intro}\n-# Steam 台灣區熱門排行 | 名次沿用 Steam 顯示順序`
    ))
    .addSeparatorComponents(v2Divider());
  const secondPanel = v2Panel(UI_COLORS.ROYAL)
    .addTextDisplayComponents(v2Text('## 📜 皇家採購續榜'));
  const thirdPanel = v2Panel(UI_COLORS.ROYAL)
    .addTextDisplayComponents(v2Text('## 📜 皇家採購末卷'));

  rankedDeals.forEach((game, index) => {
    const targetPanel = index < 4 ? firstPanel : (index < 8 ? secondPanel : thirdPanel);
    const rowText = buildRankedDealText(game, index);
    const image = game.large_capsule_image || game.header_image;
    targetPanel.addTextDisplayComponents(v2Text(rowText));
    if (image) {
      targetPanel.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems({
          media: { url: image },
          description: `${getRankMedal(index)} ${game.name}`,
        })
      );
    }
  });

  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('steam_deal_detail')
      .setPlaceholder('選擇遊戲，查看目前價格與詳細情報')
      .addOptions(
        rankedDeals.map((game, index) => ({
          label: truncateMenuText(`${getRankMedal(index)} ${game.name}`, 100),
          description: truncateMenuText(buildMenuDescription(game), 100),
          value: String(game.id),
        }))
      )
  );

  thirdPanel
    .addSeparatorComponents(v2Divider())
    .addTextDisplayComponents(v2Text('## 🔎 查看目前情報\n選取一款遊戲，本王會私下呈上 Steam 目前價格與商店入口。'))
    .addActionRowComponents(selectRow)
    .addTextDisplayComponents(v2Text(`-# ${footer} | 發布 ${publishedAt.date} ${publishedAt.time} | 特價可能隨時變動`));

  return v2Payload([firstPanel, secondPanel, thirdPanel]);
}

export async function fetchSteamAppDetails(appId, fetchImpl = fetch) {
  const data = await fetchSteamJson(
    `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=tw&l=tchinese`,
    fetchImpl
  );
  return data?.[appId]?.success ? data[appId].data : null;
}

export function buildSteamDealDetailPayload(appId, details, options = {}) {
  const checkedAt = getTaipeiDateTime(options.checkedAt || new Date());
  const storeUrl = `https://store.steampowered.com/app/${appId}/`;
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('前往 Steam 商店')
      .setStyle(ButtonStyle.Link)
      .setURL(storeUrl)
  );
  const price = details.price_overview;
  let priceLine = '價格資料暫未提供';
  if (details.is_free) {
    priceLine = '**免費遊玩**';
  } else if (price) {
    const discount = Number(price.discount_percent) || 0;
    const original = price.initial_formatted && price.initial_formatted !== price.final_formatted
      ? ` ~~${price.initial_formatted}~~`
      : '';
    priceLine = discount > 0
      ? `📉 **-${discount}%**${original} → **${price.final_formatted}**`
      : `💰 **${price.final_formatted}**（目前無特價）`;
  }
  const fields = [{
    name: '即時價格',
    value: `${priceLine}\n` +
      `📅 發售日期：${details.release_date?.date || '尚未公布'}\n` +
      `🏅 Metacritic：${details.metacritic?.score ?? '尚無資料'}`,
  }];

  return ephemeralV2Payload([
    v2Card({
      title: `🎮 ${escapeMarkdown(details.name || 'Steam 遊戲情報')}`,
      description: escapeMarkdown(details.short_description || 'Steam 暫未提供遊戲簡介。'),
      accentColor: UI_COLORS.INFO,
      fields,
      images: details.header_image ? [details.header_image] : [],
      footer: `🐕 即時查詢 ${checkedAt.date} ${checkedAt.time} | Steam 台灣區價格`,
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
    if (!deal.needs_image_details && (deal.large_capsule_image || deal.header_image)) return deal;

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
  const digits = String(text).replace(/[^\d]/g, '');
  if (!digits) return null;
  return Number(digits);
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
  if (index === 0) return 0xFFD700;
  if (index === 1) return 0xC0C0C0;
  if (index === 2) return 0xCD7F32;
  return 0x3498DB;
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

function buildMenuDescription(game) {
  const discount = Number(game.discount_percent) || 0;
  return `折扣 -${discount}% | 現價 ${formatSteamPrice(game.final_price)}`;
}

function truncateMenuText(text, maxLength) {
  const value = String(text || '-');
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

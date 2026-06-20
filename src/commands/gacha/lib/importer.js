import { fetchWithLimit } from '../../../utils/imageRendering.js';
import { emptyWuwaHistory, WUWA_POOL_BY_ID, WUWA_URL_HOSTS } from './constants.js';
import { normalizeHistory } from './history.js';

const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_URL_LENGTH = 4000;

export function parseWuwaConveneUrl(rawUrl) {
  const input = String(rawUrl ?? '').trim();
  if (!input || input.length > MAX_URL_LENGTH) throw new Error('喚取紀錄 URL 長度無效。');

  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error('喚取紀錄 URL 格式無效。');
  }
  if (url.protocol !== 'https:' || !WUWA_URL_HOSTS.has(url.hostname)) {
    throw new Error('僅支援鳴潮國際服官方喚取紀錄 URL。');
  }

  const fragmentQuery = url.hash.split('?')[1] ?? '';
  const params = new URLSearchParams(fragmentQuery);
  const credential = {
    playerId: params.get('player_id') ?? '',
    cardPoolId: params.get('resources_id') ?? '',
    serverId: params.get('svr_id') ?? '',
    recordId: params.get('record_id') ?? '',
    languageCode: params.get('lang') ?? 'zh-Hant',
  };
  if (Object.values(credential).some((value) => !value)) {
    throw new Error('喚取紀錄 URL 缺少必要授權欄位，請重新開啟遊戲內喚取紀錄。');
  }
  return {
    credential,
    region: regionFromUid(credential.playerId),
  };
}

export async function readWuwaImport({ urlText = '', attachment = null, fetchImpl = fetch } = {}) {
  if (attachment) {
    const contentType = String(attachment.contentType ?? '').toLowerCase();
    if (attachment.size > MAX_INPUT_BYTES) throw new Error('JSON 檔案不可超過 2 MB。');
    if (contentType && !contentType.includes('json') && !String(attachment.name).toLowerCase().endsWith('.json')) {
      throw new Error('附件必須是 JSON 檔案。');
    }
    const response = await fetchWithLimit(attachment.url, fetchImpl, {
      maxBytes: MAX_INPUT_BYTES,
      timeoutMs: 8000,
    });
    if (!response.ok) throw new Error('無法下載 JSON 附件。');
    return parseWuwaJson(await response.text());
  }
  const parsed = parseWuwaConveneUrl(urlText);
  return { type: 'credential', ...parsed };
}

export function parseWuwaJson(rawJson) {
  let raw;
  try {
    raw = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
  } catch {
    throw new Error('JSON 內容無法解析。');
  }

  if (raw?.version === 1 && raw?.pools) {
    const playerUid = String(raw.playerUid ?? raw.player_uid ?? '').trim();
    if (!playerUid) throw new Error('JSON 缺少玩家 UID。');
    return {
      type: 'history',
      playerUid,
      region: raw.region ?? regionFromUid(playerUid),
      languageCode: raw.languageCode ?? raw.language_code ?? 'zh-Hant',
      history: normalizeHistory(raw),
    };
  }

  if (raw?.playerId && Array.isArray(raw.pulls)) {
    const history = emptyWuwaHistory();
    for (const pull of raw.pulls) {
      const poolId = String(pull.cardPoolType ?? '');
      if (!WUWA_POOL_BY_ID.has(poolId)) continue;
      history.pools[poolId].push(pull);
    }
    return {
      type: 'history',
      playerUid: String(raw.playerId),
      region: regionFromUid(String(raw.playerId)),
      languageCode: raw.languageCode ?? 'en',
      history: normalizeHistory(history),
    };
  }

  if ((raw?.player_id || raw?.playerId) && raw?.banners) {
    const playerUid = String(raw.player_id ?? raw.playerId);
    return {
      type: 'history',
      playerUid,
      region: raw.region ?? regionFromUid(playerUid),
      languageCode: raw.language_code ?? raw.languageCode ?? 'zh-Hant',
      history: normalizeHistory({ banners: raw.banners }),
    };
  }

  throw new Error('不支援的鳴潮抽卡 JSON 格式。');
}

export function maskWuwaUid(uid) {
  const value = String(uid ?? '');
  if (value.length <= 6) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 3)}${'*'.repeat(Math.min(5, value.length - 5))}${value.slice(-2)}`;
}

function regionFromUid(uid) {
  return String(uid).startsWith('9') ? 'SEA' : 'GLOBAL';
}

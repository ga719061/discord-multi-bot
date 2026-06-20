import { WUWA_API_ENDPOINT, WUWA_POOL_TYPES, emptyWuwaHistory } from './constants.js';

const REQUEST_TIMEOUT_MS = 15_000;
const REQUEST_DELAY_MS = 600;

export async function fetchWuwaHistory(credential, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const history = emptyWuwaHistory();
  const failedPools = [];

  for (const [index, pool] of WUWA_POOL_TYPES.entries()) {
    if (index > 0) await sleep(REQUEST_DELAY_MS);
    try {
      history.pools[pool.id] = await fetchPool(credential, pool.id, fetchImpl);
    } catch (error) {
      failedPools.push({ poolId: pool.id, code: safeErrorCode(error) });
    }
  }

  if (failedPools.length === WUWA_POOL_TYPES.length) {
    const error = new Error('所有卡池查詢皆失敗，授權可能已過期。');
    error.code = 'credential_expired';
    throw error;
  }
  return { history, failedPools };
}

async function fetchPool(credential, poolId, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(WUWA_API_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cardPoolId: credential.cardPoolId,
        cardPoolType: Number(poolId),
        languageCode: credential.languageCode,
        playerId: credential.playerId,
        recordId: credential.recordId,
        serverId: credential.serverId,
      }),
      signal: controller.signal,
    });
    if (!response?.ok) throw Object.assign(new Error('API unavailable'), { code: response?.status ?? 'network' });
    const body = await response.json();
    if (body?.code !== 0) throw Object.assign(new Error('API rejected credential'), { code: body?.code ?? 'api' });
    return (Array.isArray(body.data) ? body.data : []).map((record) => ({
      resourceId: String(record.resourceId ?? ''),
      qualityLevel: Number(record.qualityLevel),
      resourceType: String(record.resourceType ?? '未知'),
      cardPoolType: poolId,
      name: String(record.name ?? ''),
      count: Number(record.count ?? 1),
      time: String(record.time ?? ''),
      languageCode: credential.languageCode,
    }));
  } catch (error) {
    if (error?.name === 'AbortError') throw Object.assign(new Error('API timeout'), { code: 'timeout' });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function safeErrorCode(error) {
  const code = String(error?.code ?? 'unavailable');
  return code.slice(0, 32);
}

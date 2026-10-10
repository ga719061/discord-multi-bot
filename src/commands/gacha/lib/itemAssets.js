import { cacheKeyFor, fetchWithLimit, imageUrlToDataUri } from '../../../utils/imageRendering.js';

const ENCORE_API = 'https://api-v2.encore.moe/api';
const CACHE_LIMIT = 100;
const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
const IMAGE_TIMEOUT_MS = 8000;
const ALLOWED_IMAGE_HOSTS = new Set(['api.encore.moe']);

class LimitedMap extends Map {
  set(key, value) {
    if (this.size >= CACHE_LIMIT && !this.has(key)) this.delete(this.keys().next().value);
    return super.set(key, value);
  }
}

const catalogCache = new LimitedMap();
const imageCache = new LimitedMap();

export async function resolveWuwaItemImages(records, languageCode, fetchImpl = fetch) {
  const lang = supportedLanguage(languageCode);
  const [characters, weapons] = await Promise.all([
    fetchCatalog(lang, 'character', fetchImpl),
    fetchCatalog(lang, 'weapon', fetchImpl),
  ]);
  const images = new Map();
  await Promise.all(records.map(async (record) => {
    const id = String(record.resourceId ?? '').trim();
    const nameKey = `name:${String(record.name ?? '').trim()}`;
    const lookupKeys = [id, nameKey].filter((key) => key && key !== 'name:');
    const type = String(record.resourceType).toLowerCase();
    const prefersWeapon = type.includes('weapon') || type.includes('武器');
    const catalogs = prefersWeapon ? [weapons, characters] : [characters, weapons];
    const url = catalogs
      .flatMap((catalog) => lookupKeys.map((key) => catalog.get(key)))
      .find(Boolean);
    if (!url || !isAllowedImageUrl(url)) return;
    const dataUri = await imageUrlToDataUri(url, fetchImpl, {
      width: 112,
      height: 112,
      fit: 'cover',
      timeoutMs: IMAGE_TIMEOUT_MS,
      maxBytes: 1024 * 1024,
      cache: imageCache,
      redirect: 'error',
    });
    if (dataUri) images.set(id || String(record.name ?? '').trim(), dataUri);
  }));
  return images;
}

async function fetchCatalog(lang, segment, fetchImpl) {
  const key = cacheKeyFor(fetchImpl, `${lang}:${segment}`);
  const cached = catalogCache.get(key);
  if (cached?.expiresAt > Date.now()) return cached.value;
  if (cached) catalogCache.delete(key);
  try {
    const response = await fetchWithLimit(`${ENCORE_API}/${lang}/${segment}`, fetchImpl, {
      maxBytes: 2 * 1024 * 1024,
      timeoutMs: 5000,
    });
    if (!response.ok) return new Map();
    const body = await response.json();
    const list = segment === 'character' ? body.roleList : body.weapons;
    const iconKey = segment === 'character' ? 'RoleHeadIcon' : 'Icon';
    const catalog = new Map();
    for (const item of Array.isArray(list) ? list : []) {
      if (item?.Id == null || !item?.[iconKey]) continue;
      catalog.set(String(item.Id), item[iconKey]);
      if (item.Name) catalog.set(`name:${String(item.Name).trim()}`, item[iconKey]);
    }
    if (catalog.size > 0) {
      catalogCache.set(key, { value: catalog, expiresAt: Date.now() + CATALOG_TTL_MS });
    }
    return catalog;
  } catch {
    return new Map();
  }
}

function isAllowedImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ALLOWED_IMAGE_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function supportedLanguage(value) {
  const lang = String(value ?? '');
  return new Set(['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'de', 'es', 'fr', 'id', 'pt', 'ru', 'th', 'vi']).has(lang)
    ? lang
    : 'en';
}

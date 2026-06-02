import fs from 'node:fs/promises';
import { AttachmentBuilder } from 'discord.js';
import sharp from 'sharp';

const fetchIds = new WeakMap();
let nextFetchId = 1;

export async function svgToPngAttachment(svg, filename) {
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return {
    attachment: new AttachmentBuilder(buffer, { name: filename }),
    filename,
    buffer,
  };
}

export async function imageFileToDataUri(filePath, options = {}) {
  try {
    const image = await fs.readFile(filePath);
    const buffer = await resizeImage(image, options);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function imageUrlToDataUri(url, fetchImpl = fetch, options = {}) {
  if (!url) return null;
  if (String(url).startsWith('data:')) return url;

  const cache = options.cache;
  const cacheKey = cache ? cacheKeyFor(fetchImpl, `${url}|${sizeKey(options)}`) : null;
  if (cache?.has(cacheKey)) return cache.get(cacheKey);

  const promise = fetchWithTimeout(url, fetchImpl, options.timeoutMs)
    .then(async (response) => {
      if (!response?.ok) return null;
      const original = Buffer.from(await response.arrayBuffer());
      const shouldResize = options.width || options.height;
      const buffer = shouldResize ? await resizeImage(original, options) : original;
      const contentType = shouldResize
        ? 'image/png'
        : response.headers?.get?.('content-type') || mimeFromUrl(url);
      return `data:${contentType};base64,${buffer.toString('base64')}`;
    })
    .catch(() => null);

  if (cache) cache.set(cacheKey, promise);
  return promise;
}

export async function fetchWithTimeout(url, fetchImpl = fetch, timeoutMs = 3500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function cacheKeyFor(fetchImpl, value) {
  if (fetchImpl === globalThis.fetch) return `global:${value}`;
  if (!fetchIds.has(fetchImpl)) fetchIds.set(fetchImpl, nextFetchId++);
  return `custom:${fetchIds.get(fetchImpl)}:${value}`;
}

export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function wrapText(text, maxChars, maxLines) {
  const chars = [...String(text || '-')];
  const lines = [];
  for (let index = 0; index < chars.length && lines.length < maxLines; index += maxChars) {
    lines.push(chars.slice(index, index + maxChars).join(''));
  }
  if (chars.length > maxChars * maxLines && lines.length > 0) {
    lines[lines.length - 1] = `${lines.at(-1).slice(0, Math.max(0, maxChars - 1))}...`;
  }
  return lines;
}

export function trimText(text, maxLength) {
  const chars = [...String(text || '-')];
  return chars.length <= maxLength ? chars.join('') : `${chars.slice(0, Math.max(0, maxLength - 1)).join('')}...`;
}

export function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

async function resizeImage(image, options = {}) {
  const hasSize = options.width || options.height;
  const pipeline = hasSize
    ? sharp(image).resize({
      width: options.width,
      height: options.height,
      fit: options.fit || 'inside',
      withoutEnlargement: options.withoutEnlargement ?? true,
    })
    : sharp(image);
  return pipeline.png({ compressionLevel: options.compressionLevel ?? 9 }).toBuffer();
}

function sizeKey(options = {}) {
  return `${options.width || 0}x${options.height || 0}:${options.fit || 'inside'}:${options.withoutEnlargement ?? true}`;
}

function mimeFromUrl(url) {
  const path = String(url).split('?')[0].toLowerCase();
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  return 'image/png';
}

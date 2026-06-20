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

  const request = options.maxBytes
    ? fetchWithLimit(url, fetchImpl, { timeoutMs: options.timeoutMs, maxBytes: options.maxBytes })
    : fetchWithTimeout(url, fetchImpl, options.timeoutMs);
  const promise = request
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

export async function fetchWithLimit(url, fetchImpl = fetch, options = {}) {
  const timeoutMs = options.timeoutMs ?? 3500;
  const maxBytes = options.maxBytes;

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', () => controller.abort());
    }
  }

  try {
    const fetchOptions = {
      ...options,
      signal: controller.signal
    };
    delete fetchOptions.timeoutMs;
    delete fetchOptions.maxBytes;

    const response = await fetchImpl(url, fetchOptions);
    if (controller.signal.aborted) {
      const abortError = new Error('The user aborted a request.');
      abortError.name = 'AbortError';
      throw abortError;
    }
    if (!response) {
      throw new Error('No response returned');
    }
    if (!response.ok) {
      return response;
    }

    if (maxBytes !== undefined && maxBytes !== null) {
      const contentLengthStr = response.headers?.get?.('content-length');
      if (contentLengthStr) {
        const contentLength = parseInt(contentLengthStr, 10);
        if (!isNaN(contentLength) && contentLength > maxBytes) {
          throw new Error(`File size limit exceeded (Content-Length: ${contentLength} bytes, max: ${maxBytes} bytes)`);
        }
      }
    }

    const reader = response.body?.getReader ? response.body.getReader() : null;
    let finalBuffer;

    if (reader) {
      const chunks = [];
      let totalBytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.length;
            if (maxBytes !== undefined && maxBytes !== null && totalBytes > maxBytes) {
              controller.abort();
              throw new Error(`File size limit exceeded during stream download (max: ${maxBytes} bytes)`);
            }
            chunks.push(value);
          }
        }
      } finally {
        reader.releaseLock();
      }
      finalBuffer = Buffer.concat(chunks);
    } else {
      const arrayBuffer = await response.arrayBuffer();
      if (maxBytes !== undefined && maxBytes !== null && arrayBuffer.byteLength > maxBytes) {
        throw new Error(`File size limit exceeded after arrayBuffer download (max: ${maxBytes} bytes)`);
      }
      finalBuffer = Buffer.from(arrayBuffer);
    }

    const newResponse = new Response(finalBuffer, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    return newResponse;

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Download timed out or aborted (timeout: ${timeoutMs}ms)`);
    }
    throw error;
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

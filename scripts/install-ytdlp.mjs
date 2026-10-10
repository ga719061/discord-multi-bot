import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { chmod, rename, rm } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export const YTDLP_ARTIFACT = Object.freeze({
  version: '2026.08.19',
  url: 'https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/yt-dlp_linux',
  sha256: '58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a',
});

class DownloadError extends Error {
  constructor(code, retryable = false) { super(code); this.code = code; this.retryable = retryable; }
}

export async function installYtdlp({
  artifact = YTDLP_ARTIFACT, destination = '/usr/local/bin/yt-dlp', fetchImpl = fetch, log = console.log,
  attempts = 3, timeoutMs = 900_000, connectTimeoutMs = 30_000, idleTimeoutMs = 30_000,
  progressIntervalMs = 5000, retryDelayMs = 2000, maxBytes = 64 * 1024 * 1024,
} = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const signal = controller.signal;
    const temporaryPath = `${destination}.download-${randomUUID()}`;
    const started = Date.now();
    let bytes = 0;
    let length = 0;
    let response;
    let failure;
    let abort;
    let complete = false;
    let idleTimeout;
    const prefix = `[yt-dlp ${artifact.version}]`;
    log(`${prefix} attempt ${attempt}/${attempts}: connecting to GitHub`);
    const timeout = setTimeout(() => controller.abort(new DownloadError('DOWNLOAD_TIMEOUT', true)), timeoutMs);
    const connectionTimeout = setTimeout(() => controller.abort(new DownloadError('CONNECT_TIMEOUT', true)), connectTimeoutMs);
    const progress = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      log(response
        ? `${prefix} downloading ${(bytes / 1048576).toFixed(1)} MiB${length ? ` / ${(length / 1048576).toFixed(1)} MiB (${Math.floor(bytes / length * 100)}%)` : ''}, ${elapsed}s elapsed`
        : `${prefix} connecting, ${elapsed}s elapsed`);
    }, progressIntervalMs);
    const cancelled = new Promise((_, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
    });
    try {
      const request = Promise.resolve().then(() => fetchImpl(artifact.url, { signal, redirect: 'follow' })).then(async value => {
        if (signal.aborted) { await value.body?.cancel(); throw signal.reason; }
        return value;
      });
      response = await Promise.race([request, cancelled]);
      clearTimeout(connectionTimeout);
      if (!response.ok) throw new DownloadError(`HTTP_${response.status}`, response.status === 429 || response.status >= 500);
      if (!response.body) throw new DownloadError('EMPTY_RESPONSE', true);
      length = Number(response.headers.get('content-length')) || 0;
      if (length > maxBytes) throw new DownloadError('SIZE_LIMIT');
      log(`${prefix} download started${length ? `: ${(length / 1048576).toFixed(1)} MiB` : ''}`);
      const resetIdleTimeout = () => {
        clearTimeout(idleTimeout);
        idleTimeout = setTimeout(() => controller.abort(new DownloadError('DOWNLOAD_STALLED', true)), idleTimeoutMs);
      };
      resetIdleTimeout();
      const hash = createHash('sha256');
      const checked = new Transform({ transform(chunk, encoding, callback) {
        resetIdleTimeout();
        bytes += chunk.length;
        if (bytes > maxBytes) { callback(new DownloadError('SIZE_LIMIT')); return; }
        hash.update(chunk);
        callback(null, chunk);
      } });
      await pipeline(Readable.fromWeb(response.body), checked, createWriteStream(temporaryPath, { mode: 0o755 }), { signal });
      clearTimeout(idleTimeout);
      if (hash.digest('hex') !== artifact.sha256) throw new DownloadError('CHECKSUM_MISMATCH');
      await chmod(temporaryPath, 0o755);
      await rename(temporaryPath, destination);
      complete = true;
      log(`${prefix} SHA256 verified; installed ${(bytes / 1048576).toFixed(1)} MiB`);
      return bytes;
    } catch (error) {
      const networkCode = error?.cause?.code || error?.code;
      failure = signal.aborted ? signal.reason : error instanceof DownloadError ? error
        : new DownloadError(['ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT'].includes(networkCode) ? networkCode : 'DOWNLOAD_FAILED', true);
      log(`${prefix} attempt ${attempt}/${attempts} failed: ${failure.code}`);
    } finally {
      clearTimeout(timeout);
      clearTimeout(connectionTimeout);
      clearTimeout(idleTimeout);
      clearInterval(progress);
      signal.removeEventListener('abort', abort);
      controller.abort();
      if (!complete && response?.body && !response.body.locked) {
        try { await response.body.cancel(); } catch { log(`${prefix} response cleanup failed`); }
      }
      await rm(temporaryPath, { force: true });
    }
    if (!failure.retryable || attempt === attempts) throw new Error(`yt-dlp installation failed (${failure.code}); check the NAS connection to GitHub release assets and retry the build.`);
    log(`${prefix} retrying in ${retryDelayMs * attempt / 1000}s`);
    await delay(retryDelayMs * attempt);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await installYtdlp(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

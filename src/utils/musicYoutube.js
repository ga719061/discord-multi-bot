import { spawn } from 'node:child_process';
import { Transform } from 'node:stream';
import {
  MusicError, MUSIC_STREAM_MAX_BYTES, MUSIC_COVER_TIMEOUT_MS, MUSIC_COVER_MAX_BYTES, normalizeMusicCover,
} from './musicLibrary.js';
import { fetchBufferWithLimit } from './imageRendering.js';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be']);
const SELECTOR = 'bestaudio[ext=webm]/bestaudio';
let metadataInFlight = 0;

export function extractYouTubeVideoId(input) {
  try {
    if (typeof input !== 'string' || input.length > 2048 || /[\u0000-\u0020\u007f]/.test(input)) throw new Error();
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !HOSTS.has(url.hostname)) throw new Error();
    let id;
    if (['youtu.be', 'www.youtu.be'].includes(url.hostname)) id = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
    else if (url.pathname === '/watch') {
      if (url.searchParams.getAll('v').length !== 1) throw new Error();
      id = url.searchParams.get('v');
    } else id = url.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
    if (!VIDEO_ID.test(id || '')) throw new Error();
    return id;
  } catch { throw new MusicError('MUSIC_YOUTUBE_URL'); }
}

function canonical(id) {
  if (!VIDEO_ID.test(id || '')) throw new MusicError('MUSIC_YOUTUBE_URL');
  return `https://www.youtube.com/watch?v=${id}`;
}

function metadataTrack(data, id) {
  if (!data || data.id !== id || data._type === 'playlist' || Array.isArray(data.entries)) throw new MusicError('MUSIC_YOUTUBE_RESPONSE');
  if (data.is_live || data.is_upcoming || ['is_live', 'is_upcoming', 'post_live'].includes(data.live_status)) throw new MusicError('MUSIC_YOUTUBE_LIVE');
  const duration = Number(data.duration);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 7200) throw new MusicError('MUSIC_YOUTUBE_DURATION');
  const format = data.requested_downloads?.[0] || data;
  if (format.vcodec !== 'none' || !format.acodec || format.acodec === 'none'
    || !/^[A-Za-z0-9_.-]{1,80}$/.test(String(format.format_id || ''))) throw new MusicError('MUSIC_YOUTUBE_RESPONSE');
  const mime = ({ webm: 'audio/webm', m4a: 'audio/mp4', mp4: 'audio/mp4', ogg: 'audio/ogg', opus: 'audio/ogg', mp3: 'audio/mpeg', aac: 'audio/aac', flac: 'audio/flac', wav: 'audio/wav' })[format.ext];
  if (!mime) throw new MusicError('MUSIC_YOUTUBE_RESPONSE');
  const text = (value, fallback) => String(value || fallback).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 300);
  return {
    track: { source: 'youtube', id, title: text(data.title, 'YouTube 曲目'), artist: text(data.channel || data.uploader, '未知頻道'), album: 'YouTube', duration, mime },
    formatId: String(format.format_id),
  };
}

async function terminateTree(child, platform) {
  if (!child.pid) { child.kill?.('SIGKILL'); return; }
  if (platform === 'win32') {
    await new Promise(resolve => {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' });
      killer.once('error', () => { child.kill('SIGKILL'); resolve(); });
      killer.once('close', resolve);
    });
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch (error) {
      if (error.code !== 'ESRCH') child.kill('SIGKILL');
    }
  }
}

export class MusicYouTubeClient {
  constructor({ ytdlpPath = 'yt-dlp', spawnImpl = spawn, fetchImpl = fetch, requestTimeoutMs = 30_000,
    firstAudioTimeoutMs = 30_000, maxBytes = MUSIC_STREAM_MAX_BYTES, jsonMaxBytes = 1024 * 1024,
    platform = process.platform, killTreeImpl = terminateTree } = {}) {
    if (![requestTimeoutMs, firstAudioTimeoutMs].every(value => Number.isInteger(value) && value > 0 && value <= 30_000)
      || !Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > MUSIC_STREAM_MAX_BYTES
      || !Number.isSafeInteger(jsonMaxBytes) || jsonMaxBytes <= 0 || jsonMaxBytes > 1024 * 1024) throw new MusicError('MUSIC_CONFIG');
    Object.assign(this, { ytdlpPath, spawnImpl, fetchImpl, requestTimeoutMs, firstAudioTimeoutMs, maxBytes, jsonMaxBytes, platform, killTreeImpl });
    this.controller = new AbortController();
    this.children = new Set();
  }

  args() {
    return ['--ignore-config', '--no-config-locations', '--no-plugin-dirs', '--no-remote-components',
      '--no-js-runtimes', '--js-runtimes', `node:${process.execPath}`, '--no-playlist', '--no-warnings',
      '--no-progress', '--no-cache-dir', '--no-wait-for-video', '--no-mark-watched', '--socket-timeout', '15',
      '--retries', '1', '--fragment-retries', '1'];
  }

  start(args) {
    if (this.controller.signal.aborted) throw new MusicError('MUSIC_ABORTED');
    let child;
    try { child = this.spawnImpl(this.ytdlpPath, [...this.args(), ...args], {
      shell: false, windowsHide: true, detached: this.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
    }); } catch { throw new MusicError('MUSIC_YOUTUBE_TOOL'); }
    const record = { child, ended: false, stopping: null };
    record.closed = new Promise(resolve => {
      child.once('error', error => {
        record.error = new MusicError(error.code === 'ENOENT' ? 'MUSIC_YOUTUBE_TOOL' : 'MUSIC_YOUTUBE_UNAVAILABLE');
        if (!child.pid) { record.ended = true; this.children.delete(record); resolve(); }
      });
      child.once('close', (code, signal) => {
        record.ended = true;
        record.code = code;
        record.signal = signal;
        this.children.delete(record);
        resolve();
      });
    });
    child.stderr?.resume();
    this.children.add(record);
    return record;
  }

  async stop(record) {
    if (!record.stopping) record.stopping = (async () => {
      if (!record.ended) await this.killTreeImpl(record.child, this.platform);
      await record.closed;
    })();
    return record.stopping;
  }

  async read(args, { signal, maxBytes = this.jsonMaxBytes, timeoutMs = this.requestTimeoutMs } = {}) {
    const combined = AbortSignal.any([this.controller.signal, ...(signal ? [signal] : [])]);
    if (combined.aborted) throw new MusicError('MUSIC_ABORTED');
    const record = this.start(args);
    let error;
    let bytes = 0;
    const chunks = [];
    let rejectFailure;
    const failed = new Promise((_, reject) => { rejectFailure = reject; });
    const stdoutEnded = new Promise(resolve => record.child.stdout.once('end', resolve));
    const fail = reason => {
      error ||= reason;
      rejectFailure(error);
      this.stop(record).catch(() => { record.error ||= new MusicError('MUSIC_YOUTUBE_UNAVAILABLE'); });
    };
    const abort = () => fail(new MusicError('MUSIC_ABORTED'));
    combined.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => fail(new MusicError('MUSIC_YOUTUBE_TIMEOUT')), timeoutMs);
    record.child.stdout.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) fail(new MusicError('MUSIC_YOUTUBE_RESPONSE'));
      else if (!error) chunks.push(chunk);
    });
    record.child.stdout.on('error', () => fail(new MusicError('MUSIC_YOUTUBE_UNAVAILABLE')));
    try {
      if (combined.aborted) abort();
      await Promise.race([record.closed.then(async () => {
        if (!record.error && record.code === 0 && !record.signal) await stdoutEnded;
      }), failed]);
      if (record.stopping) await record.stopping;
      if (error || record.error) throw error || record.error;
      if (record.code !== 0 || record.signal) throw new MusicError('MUSIC_YOUTUBE_UNAVAILABLE');
      return Buffer.concat(chunks).toString('utf8');
    } catch (error) {
      await this.stop(record);
      throw error;
    } finally {
      clearTimeout(timer);
      combined.removeEventListener('abort', abort);
    }
  }

  async available() {
    if (this.controller.signal.aborted) return false;
    this.availability ||= (async () => {
      try { return /^\d{4}\.\d{2}\.\d{2}/.test((await this.read(['--version'], {
        maxBytes: 1024, timeoutMs: Math.min(this.requestTimeoutMs, 2000),
      })).trim()); } catch { return false; }
    })();
    return this.availability;
  }

  async resolve(id, { signal } = {}) {
    const url = canonical(id);
    if (metadataInFlight >= 2) throw new MusicError('MUSIC_CAPACITY');
    metadataInFlight++;
    try {
      const result = await this.read(['--skip-download', '--dump-single-json', '-f', SELECTOR, '--', url], { signal });
      let data;
      try { data = JSON.parse(result); } catch { throw new MusicError('MUSIC_YOUTUBE_RESPONSE'); }
      return metadataTrack(data, id);
    } finally { metadataInFlight--; }
  }

  async getTrack(input, options = {}) {
    return (await this.resolve(extractYouTubeVideoId(input), options)).track;
  }

  async openAudio(track, { signal } = {}) {
    const { track: fresh, formatId } = await this.resolve(track.id, { signal });
    const combined = AbortSignal.any([this.controller.signal, ...(signal ? [signal] : [])]);
    if (combined.aborted) throw new MusicError('MUSIC_ABORTED');
    const record = this.start(['--no-part', '--no-continue', '--fixup', 'never', '-f', formatId, '-o', '-', '--', canonical(track.id)]);
    let bytes = 0;
    let firstResolve;
    let firstReject;
    let timer;
    let disposed = false;
    const first = new Promise((resolve, reject) => { firstResolve = resolve; firstReject = reject; });
    const source = new Transform({ transform: (chunk, encoding, callback) => {
      bytes += chunk.length;
      if (bytes > this.maxBytes) { callback(new MusicError('MUSIC_SIZE')); return; }
      clearTimeout(timer);
      firstResolve();
      callback(null, chunk);
    } });
    // Keep startup failures observable through first; consumers own stream errors after return.
    const streamError = error => {
      firstReject(error);
      this.stop(record).catch(() => { record.error ||= new MusicError('MUSIC_YOUTUBE_UNAVAILABLE'); });
    };
    source.on('error', streamError);
    const fail = error => { firstReject(error); source.destroy(error); };
    const abort = () => fail(new MusicError('MUSIC_ABORTED'));
    combined.addEventListener('abort', abort, { once: true });
    const dispose = async () => {
      if (!disposed) {
        disposed = true;
        clearTimeout(timer);
        combined.removeEventListener('abort', abort);
        record.child.stdout.unpipe(source);
        source.destroy();
      }
      await this.stop(record);
    };
    source.once('close', () => {
      clearTimeout(timer);
      combined.removeEventListener('abort', abort);
      this.stop(record).catch(() => { record.error ||= new MusicError('MUSIC_YOUTUBE_UNAVAILABLE'); });
    });
    record.child.stdout.on('error', () => fail(new MusicError('MUSIC_YOUTUBE_UNAVAILABLE')));
    const stdoutEnded = new Promise(resolve => record.child.stdout.once('end', resolve));
    record.closed.then(() => {
      if (disposed) return;
      if (record.error || record.code !== 0 || record.signal) fail(record.error || new MusicError('MUSIC_YOUTUBE_UNAVAILABLE'));
      else stdoutEnded.then(() => {
        if (!bytes) fail(new MusicError('MUSIC_YOUTUBE_RESPONSE'));
        else if (!disposed && !source.destroyed) source.end();
      });
    });
    timer = setTimeout(() => fail(new MusicError('MUSIC_YOUTUBE_TIMEOUT')), this.firstAudioTimeoutMs);
    record.child.stdout.pipe(source, { end: false });
    try {
      if (combined.aborted) abort();
      await first;
      if (source.destroyed) throw new MusicError('MUSIC_YOUTUBE_UNAVAILABLE');
      return { source, mime: fresh.mime, dispose };
    } catch (error) { await dispose(); throw error; }
  }

  async getCover(id, { signal } = {}) {
    canonical(id);
    const deadline = new AbortController();
    const combined = AbortSignal.any([this.controller.signal, deadline.signal, ...(signal ? [signal] : [])]);
    const timer = setTimeout(() => deadline.abort(), MUSIC_COVER_TIMEOUT_MS);
    let abort;
    const cancelled = new Promise((_, reject) => {
      abort = () => reject(new MusicError('MUSIC_ABORTED'));
      combined.addEventListener('abort', abort, { once: true });
    });
    try {
      if (combined.aborted) throw new MusicError('MUSIC_ABORTED');
      return await Promise.race([(async () => {
        const { response, buffer } = await fetchBufferWithLimit(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`, this.fetchImpl, {
          signal: combined, redirect: 'error', maxBytes: MUSIC_COVER_MAX_BYTES, timeoutMs: MUSIC_COVER_TIMEOUT_MS,
        });
        if (response.status === 404) { await response.body?.cancel?.(); return null; }
        if (!response.ok) { await response.body?.cancel?.(); throw new MusicError('MUSIC_YOUTUBE_UNAVAILABLE'); }
        const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        return await normalizeMusicCover(buffer, mime, { signal: combined });
      })(), cancelled]);
    } catch (error) {
      if (this.controller.signal.aborted || signal?.aborted) throw new MusicError('MUSIC_ABORTED');
      if (deadline.signal.aborted) throw new MusicError('MUSIC_YOUTUBE_TIMEOUT');
      if (error instanceof MusicError) throw error;
      throw new MusicError(error.code === 'DOWNLOAD_SIZE_LIMIT' ? 'MUSIC_SIZE' : 'MUSIC_YOUTUBE_UNAVAILABLE');
    } finally {
      clearTimeout(timer);
      combined.removeEventListener('abort', abort);
    }
  }

  async close() {
    this.controller.abort();
    await Promise.all([...this.children].map(record => this.stop(record)));
  }
}

import { randomUUID } from 'node:crypto';
import { MusicError, MusicLibraryClient } from './musicLibrary.js';

export class MusicAccounts {
  constructor({
    baseUrl, createLibrary = credentials => new MusicLibraryClient({ baseUrl, ...credentials }),
    onLogout = async () => {}, onCleanupError = () => console.warn('[Music] account cleanup failed'),
    now = Date.now, ttlMs = 30 * 60_000, maxAccounts = 100, maxLogins = 6, cooldownMs = 8000,
  }) {
    this.createLibrary = createLibrary;
    this.onLogout = onLogout;
    this.onCleanupError = onCleanupError;
    this.now = now;
    this.ttlMs = ttlMs;
    this.maxAccounts = maxAccounts;
    this.maxLogins = maxLogins;
    this.cooldownMs = cooldownMs;
    this.entries = new Map();
    this.pending = new Map();
    this.attempts = new Map();
    this.cleanups = new Set();
    this.requests = new Set();
    this.closed = false;
  }

  key(guildId, userId) { return `${guildId}:${userId}`; }

  get(guildId, userId) {
    const entry = this.entries.get(this.key(guildId, userId));
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.logout(guildId, userId).catch(this.onCleanupError);
      return null;
    }
    this.touch(entry);
    return entry;
  }

  touch(entry) {
    clearTimeout(entry.timer);
    entry.expiresAt = this.now() + this.ttlMs;
    entry.timer = setTimeout(() => {
      this.logout(entry.guildId, entry.userId).catch(this.onCleanupError);
    }, this.ttlMs);
    entry.timer.unref?.();
  }

  async login(guildId, userId, credentials) {
    if (this.closed) throw new MusicError('MUSIC_ABORTED');
    if (!guildId || !userId) throw new MusicError('MUSIC_CHANNEL');
    const key = this.key(guildId, userId);
    const email = String(credentials.email || '').trim();
    const password = String(credentials.password || '');
    if (!email || email.length > 254 || !password || password.length > 256) throw new MusicError('MUSIC_AUTH');
    if (this.get(guildId, userId) || this.pending.has(key)
      || this.pending.size >= this.maxLogins
      || (this.attempts.has(key) && this.now() - this.attempts.get(key) < this.cooldownMs)) {
      throw new MusicError('MUSIC_BUSY');
    }
    if (this.entries.size + this.pending.size >= this.maxAccounts) throw new MusicError('MUSIC_CAPACITY');
    if (this.attempts.size >= this.maxAccounts) this.attempts.delete(this.attempts.keys().next().value);
    this.attempts.set(key, this.now());
    const candidate = { id: randomUUID(), guildId, userId, library: this.createLibrary({ email, password }) };
    this.pending.set(key, candidate);
    try {
      const request = candidate.library.login();
      this.requests.add(request);
      request.then(() => this.requests.delete(request), () => this.requests.delete(request));
      await request;
      if (this.closed || this.pending.get(key) !== candidate) throw new MusicError('MUSIC_ABORTED');
      this.entries.set(key, candidate);
      this.touch(candidate);
      return candidate;
    } catch (error) {
      candidate.library.close();
      throw error;
    } finally {
      if (this.pending.get(key) === candidate) this.pending.delete(key);
    }
  }

  logout(guildId, userId) {
    const key = this.key(guildId, userId);
    const pending = this.pending.get(key);
    this.pending.delete(key);
    pending?.library.close();
    const entry = this.entries.get(key);
    this.entries.delete(key);
    if (entry) {
      clearTimeout(entry.timer);
      entry.library.close();
    }
    const cleanup = (async () => this.onLogout(guildId, userId))();
    this.cleanups.add(cleanup);
    cleanup.then(() => this.cleanups.delete(cleanup), () => this.cleanups.delete(cleanup));
    return cleanup;
  }

  async close() {
    this.closed = true;
    const owners = new Map([...this.entries, ...this.pending]);
    await Promise.all([...owners.values()].map(entry => this.logout(entry.guildId, entry.userId)));
    await Promise.allSettled([...this.requests]);
    await Promise.all([...this.cleanups]);
    this.attempts.clear();
  }
}

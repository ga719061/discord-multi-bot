import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicAccounts } from '../src/utils/musicAccounts.js';

const credentials = { email: 'listener@example.test', password: ' synthetic-password ' };

function fixture(t, options = {}) {
  const libraries = [];
  const removals = [];
  const store = new MusicAccounts({
    createLibrary(input) {
      const library = {
        input, closed: false, async login() {},
        close() { this.closed = true; this.input = null; },
      };
      libraries.push(library);
      return library;
    },
    async onLogout(...args) { removals.push(args); },
    ...options,
  });
  t.after(() => store.close());
  return { store, libraries, removals };
}

test('music accounts isolate users and guilds and retain password whitespace only in the private client', async t => {
  const { store, libraries } = fixture(t);
  const first = await store.login('guild-a', 'user-a', credentials);
  const second = await store.login('guild-a', 'user-b', credentials);
  const third = await store.login('guild-b', 'user-a', credentials);
  assert.equal(store.get('guild-a', 'user-a'), first);
  assert.equal(store.get('guild-a', 'user-b'), second);
  assert.equal(store.get('guild-b', 'user-a'), third);
  assert.equal(store.get('guild-b', 'user-b'), null);
  assert.equal(new Set([first.id, second.id, third.id]).size, 3);
  assert.equal(libraries[0].input.password, credentials.password);
  assert.equal('password' in first, false);
});

test('logout closes only its own client and invokes scoped track removal', async t => {
  const { store, libraries, removals } = fixture(t);
  await store.login('guild', 'first', credentials);
  await store.login('guild', 'second', credentials);
  await store.logout('guild', 'first');
  assert.equal(store.get('guild', 'first'), null);
  assert.ok(store.get('guild', 'second'));
  assert.equal(libraries[0].closed, true);
  assert.equal(libraries[0].input, null);
  assert.equal(libraries[1].closed, false);
  assert.deepEqual(removals, [['guild', 'first']]);
});

test('failed login closes credentials and enforces retry cooldown without authenticating', async t => {
  let time = 0;
  const { store, libraries } = fixture(t, { now: () => time });
  const create = store.createLibrary;
  store.createLibrary = input => {
    const library = create(input);
    library.login = async () => { throw new Error('synthetic failure'); };
    return library;
  };
  await assert.rejects(store.login('guild', 'user', credentials), /synthetic failure/);
  assert.equal(libraries[0].closed, true);
  assert.equal(store.get('guild', 'user'), null);
  await assert.rejects(store.login('guild', 'user', credentials), { code: 'MUSIC_BUSY' });
  time = 8000;
  store.createLibrary = create;
  assert.ok(await store.login('guild', 'user', credentials));
});

test('expired accounts close and remove owned tracks instead of silently retaining credentials', async t => {
  let time = 0;
  const { store, libraries, removals } = fixture(t, { now: () => time, ttlMs: 10000 });
  await store.login('guild', 'user', credentials);
  time = 9999;
  assert.ok(store.get('guild', 'user'));
  time = 20000;
  assert.equal(store.get('guild', 'user'), null);
  await Promise.all([...store.cleanups]);
  assert.equal(libraries[0].closed, true);
  assert.deepEqual(removals, [['guild', 'user']]);
});

test('idle expiry timer clears credentials even when the user never opens the UI again', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { store, libraries, removals } = fixture(t, { ttlMs: 10000 });
  await store.login('guild', 'user', credentials);
  t.mock.timers.tick(10000);
  await Promise.all([...store.cleanups]);
  assert.equal(store.entries.size, 0);
  assert.equal(libraries[0].closed, true);
  assert.deepEqual(removals, [['guild', 'user']]);
});

test('capacity rejects extra accounts without evicting another user credentials', async t => {
  const { store, libraries } = fixture(t, { maxAccounts: 1 });
  const first = await store.login('guild', 'first', credentials);
  await assert.rejects(store.login('guild', 'second', credentials), { code: 'MUSIC_CAPACITY' });
  assert.equal(store.get('guild', 'first'), first);
  assert.equal(libraries.length, 1);
});

test('pending login cannot resurrect a logged out account and simultaneous attempts are bounded', async t => {
  let finish;
  const gate = new Promise(resolve => { finish = resolve; });
  const { store, libraries } = fixture(t, { maxLogins: 1 });
  const create = store.createLibrary;
  store.createLibrary = input => {
    const library = create(input);
    library.login = () => gate;
    return library;
  };
  const pending = store.login('guild', 'user', credentials);
  const rejected = assert.rejects(pending, { code: 'MUSIC_ABORTED' });
  await assert.rejects(store.login('guild', 'user', credentials), { code: 'MUSIC_BUSY' });
  await assert.rejects(store.login('other', 'user', credentials), { code: 'MUSIC_BUSY' });
  await store.logout('guild', 'user');
  assert.equal(libraries[0].closed, true);
  finish();
  await rejected;
  assert.equal(store.get('guild', 'user'), null);
});

test('shutdown aborts pending clients and waits for login and logout cleanup', async t => {
  let finish;
  const gate = new Promise(resolve => { finish = resolve; });
  const { store } = fixture(t);
  const create = store.createLibrary;
  store.createLibrary = input => {
    const library = create(input);
    library.login = () => gate;
    return library;
  };
  const pending = store.login('guild', 'user', credentials);
  const rejected = assert.rejects(pending, { code: 'MUSIC_ABORTED' });
  let closed = false;
  const closing = store.close().then(() => { closed = true; });
  await Promise.resolve();
  assert.equal(closed, false);
  finish();
  await Promise.all([closing, rejected]);
  assert.equal(store.entries.size, 0);
  assert.equal(store.pending.size, 0);
  assert.equal(store.requests.size, 0);
  await assert.rejects(store.login('guild', 'user', credentials), { code: 'MUSIC_ABORTED' });
});

test('missing and oversized modal credentials never create a client', async t => {
  const { store, libraries } = fixture(t);
  for (const input of [
    { email: '', password: 'x' }, { email: 'x', password: '' },
    { email: 'x'.repeat(255), password: 'x' }, { email: 'x', password: 'x'.repeat(257) },
  ]) {
    await assert.rejects(store.login('guild', 'user', input), { code: 'MUSIC_AUTH' });
  }
  assert.equal(libraries.length, 0);
});

import test, { afterEach, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType, Client, Collection, ComponentType, Message, MessageFlags, MessagePayload, PermissionFlagsBits } from 'discord.js';
import {
  assertMusicAccess,
  execute,
  openPrivateNasMusic,
  revokeNasMusicAccess,
  handleMusicInteraction,
  handleMusicVoiceState,
  stopMusicPlayback,
} from '../src/commands/music/music.js';
import { logger } from '../src/utils/logger.js';
import { MusicError } from '../src/utils/musicLibrary.js';
import { MusicPlaybackManager } from '../src/utils/musicPlayback.js';
import { MusicYouTubeClient } from '../src/utils/musicYoutube.js';
import { MusicAccounts } from '../src/utils/musicAccounts.js';
import { MusicPanelPresenter } from '../src/commands/music/lib/panel.js';
import { cleanupTestDatabase, initTestDatabase } from './helpers/database.js';
import { updateAiSetting } from '../src/utils/database.js';

beforeEach(() => { initTestDatabase('music-command'); mock.method(logger, 'warn', () => {}); });
afterEach(async () => {
  await stopMusicPlayback();
  cleanupTestDatabase();
  mock.restoreAll();
});

const GUILD_ID = '123456789012345678';
const VOICE_ID = '223456789012345678';
const USER_ID = '323456789012345678';

function track(index = 1, extra = {}) {
  return { id: index.toString(16).padStart(32, '0'), title: `歌曲 ${index}`, artist: '歌手', album: '專輯', duration: 180, ...extra };
}

function makeFixture({ withSession = true, tracks = [track()], loggedIn = true } = {}) {
  const calls = { login: [], search: [], getTrack: [], getSession: [], connect: [], snapshot: [], enqueue: [], control: [], stop: [], send: [], logout: [], removeUserTracks: [] };
  const order = [];
  const botMember = { id: 'bot' };
  const member = { id: USER_ID, voice: { channel: null } };
  const memberPermissions = new Set([PermissionFlagsBits.Connect]);
  const botPermissions = new Set([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]);
  const voiceChannel = {
    id: VOICE_ID,
    type: ChannelType.GuildVoice,
    permissionsFor(subject) {
      const permissions = subject === botMember ? botPermissions : memberPermissions;
      return { has: (flags) => (Array.isArray(flags) ? flags : [flags]).every((flag) => permissions.has(flag)) };
    },
  };
  member.voice.channel = voiceChannel;
  const guild = { id: GUILD_ID, members: { me: botMember } };
  const musicSession = {
    id: 'session', guildId: GUILD_ID, voiceChannelId: VOICE_ID, status: 'idle', current: null,
    positionSeconds: 0, loop: 'off', queue: [], message: null,
  };
  const fixture = { calls, order, guild, member, voiceChannel, memberPermissions, botPermissions, musicSession, session: withSession ? musicSession : null, searchResult: tracks };
  fixture.services = {
    canUseNas: () => true,
    config: {},
    library: {
      async login() { calls.login.push(true); order.push('login'); },
      async search(query = '') { calls.search.push(query); order.push('search'); return fixture.searchResult; },
      async getTrack(id) { calls.getTrack.push(id); return track(1, { id, title: '重新查核的歌曲' }); },
    },
    manager: {
      getSession(guildId) { calls.getSession.push(guildId); return fixture.session; },
      async connect(targetGuild, channel) { calls.connect.push([targetGuild, channel]); order.push('connect'); musicSession.voiceChannelId = channel.id; fixture.session = musicSession; return musicSession; },
      snapshot(session) { calls.snapshot.push(session); return { ...session, queue: [...session.queue] }; },
      async enqueue(...args) { calls.enqueue.push(args); },
      async control(...args) { calls.control.push(args); },
      async stop(session) { calls.stop.push(session); },
      async removeUserTracks(...args) { calls.removeUserTracks.push(args); },
    },
  };
  fixture.accounts = new Map();
  if (loggedIn) fixture.accounts.set(`${GUILD_ID}:${USER_ID}`, { id: 'account', library: fixture.services.library });
  fixture.services.accounts = {
    get(guildId, userId) { return fixture.accounts.get(`${guildId}:${userId}`) || null; },
    async login(guildId, userId, credentials) {
      fixture.credentials = credentials;
      await fixture.services.library.login();
      const account = { id: 'new-account', library: fixture.services.library };
      fixture.accounts.set(`${guildId}:${userId}`, account);
      return account;
    },
    async logout(guildId, userId) {
      calls.logout.push([guildId, userId]);
      fixture.accounts.delete(`${guildId}:${userId}`);
      await fixture.services.manager.removeUserTracks(fixture.session, userId);
    },
  };
  fixture.interaction = ({ kind = 'button', customId = '', userId = USER_ID, values = [], fields = {} } = {}) => {
    const acknowledgements = [];
    const interaction = {
      guildId: GUILD_ID, guild, member, channelId: 'text-channel', user: { id: userId },
      customId, values, deferred: false, replied: false, ephemeral: false, acknowledgements,
      fields: { getTextInputValue: (name) => fields[name] ?? '' },
      channel: {
        async send(payload) { calls.send.push(payload); order.push('panel'); return { id: 'panel', async edit() {} }; },
      },
      isButton: () => kind === 'button',
      isStringSelectMenu: () => kind === 'select',
      isModalSubmit: () => kind === 'modal',
      isChatInputCommand: () => kind === 'command',
      async deferReply(payload) { interaction.deferred = true; interaction.ephemeral = Boolean(payload?.flags & MessageFlags.Ephemeral); acknowledgements.push({ kind: 'deferReply', payload }); },
      async deferUpdate() { interaction.deferred = true; acknowledgements.push({ kind: 'deferUpdate' }); },
      async reply(payload) { interaction.replied = true; interaction.ephemeral = Boolean(payload?.flags & MessageFlags.Ephemeral); acknowledgements.push({ kind: 'reply', payload }); },
      async editReply(payload) { acknowledgements.push({ kind: 'editReply', payload }); },
      async update(payload) { interaction.replied = true; acknowledgements.push({ kind: 'update', payload }); },
      async followUp(payload) {
        const id = `notice-${acknowledgements.length}`;
        acknowledgements.push({ kind: 'followUp', payload, id });
        return { id };
      },
      async deleteReply(id = '@original') { acknowledgements.push({ kind: 'deleteReply', id }); },
      async showModal(payload) { interaction.replied = true; acknowledgements.push({ kind: 'showModal', payload }); },
    };
    return interaction;
  };
  return fixture;
}

function flatten(component) {
  return [component, ...(component.components ?? []).flatMap(flatten)];
}

function components(payload) {
  return payload.components.flatMap((component) => flatten(component.toJSON?.() ?? component));
}

function lastPayload(interaction) {
  return interaction.acknowledgements.filter((ack) => ack.payload?.components).at(-1)?.payload;
}

function noticeText(interaction) {
  return interaction.acknowledgements.filter(ack => ack.payload?.components)
    .flatMap(ack => components(ack.payload)).map(component => component.content ?? '').join('\n')
    .replace(/\u001b\[[0-9;]+m/g, '');
}

function assertNoSideEffects(fixture) {
  for (const operation of ['login', 'search', 'getTrack', 'connect', 'enqueue', 'control', 'stop', 'send']) {
    assert.equal(fixture.calls[operation].length, 0, `${operation} must not run for a rejected request`);
  }
}

async function browse(fixture, userId = USER_ID) {
  const interaction = fixture.interaction({ customId: 'music:session:browse', userId });
  assert.equal(await handleMusicInteraction(interaction, fixture.services), true);
  const customId = components(lastPayload(interaction)).find((component) => component.custom_id?.startsWith('musiclib:'))?.custom_id;
  assert.ok(customId, 'browsing must expose scoped private library controls');
  return { id: customId.split(':')[1], interaction };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

test('ordinary music entry hides NAS while independently whitelisted members get a private entrance', async () => {
  const fixture = makeFixture({ loggedIn: false, withSession: false });
  delete fixture.services.canUseNas;
  fixture.services.youtubeAvailable = true;
  updateAiSetting(GUILD_ID, 'whitelist', JSON.stringify([USER_ID]));
  const ordinary = fixture.interaction({ kind: 'command' });
  await execute(ordinary, fixture.services);
  assert.doesNotMatch(noticeText(ordinary), /NAS|私人音樂庫|登入|MUSIC_API_BASE_URL/);
  assert.ok(components(lastPayload(ordinary)).some(item => item.custom_id?.endsWith(':youtube')));
  assertNoSideEffects(fixture);
  updateAiSetting(GUILD_ID, 'nas_music_whitelist', JSON.stringify([USER_ID]));
  const allowed = fixture.interaction({ kind: 'command' });
  await execute(allowed, fixture.services);
  const nasId = components(lastPayload(allowed)).find(item => item.custom_id?.endsWith(':nas')).custom_id;
  const entrance = fixture.interaction({ customId: nasId });
  await handleMusicInteraction(entrance, fixture.services);
  assert.match(noticeText(entrance), /登入/);
  assertNoSideEffects(fixture);
  assert.equal(entrance.ephemeral, true);
});

test('a valid old NAS login nonce cannot bypass revoked permission or grant access from AI whitelist', async () => {
  const fixture = makeFixture({ loggedIn: false });
  const { id } = await loginView(fixture);
  delete fixture.services.canUseNas;
  updateAiSetting(GUILD_ID, 'whitelist', JSON.stringify([USER_ID]));
  const submit = fixture.interaction({ kind: 'modal', customId: `musicauth:${id}:login_submit`, fields: { email: 'x', password: 'x' } });
  await handleMusicInteraction(submit, fixture.services);
  assert.equal(fixture.calls.login.length, 0);
  assert.equal(fixture.calls.connect.length, 0);
  assert.match(noticeText(submit), /沒有私人音樂庫的使用資格/);
  assert.equal(components(lastPayload(submit)).some(item => item.custom_id?.endsWith(':login')), false);
});

test('NAS authorization is rechecked after a delayed lookup and revoked results never enqueue', async () => {
  const fixture = makeFixture();
  delete fixture.services.canUseNas;
  updateAiSetting(GUILD_ID, 'nas_music_whitelist', JSON.stringify([USER_ID]));
  const browser = await browse(fixture);
  const entered = deferred();
  const gate = deferred();
  fixture.services.library.getTrack = async () => { entered.resolve(); await gate.promise; return track(); };
  const select = fixture.interaction({ kind: 'select', customId: `musiclib:${browser.id}:enqueue`, values: [track().id] });
  const pending = handleMusicInteraction(select, fixture.services);
  await entered.promise;
  updateAiSetting(GUILD_ID, 'nas_music_whitelist', '[]');
  gate.resolve();
  await pending;
  assert.equal(fixture.calls.enqueue.length, 0);
  assert.equal(fixture.accounts.size, 0);
  assert.match(noticeText(select), /沒有私人音樂庫的使用資格/);
});

test('NAS revocation cleanup blocks replacement login until the old cleanup has completed', async () => {
  const fixture = makeFixture();
  const old = await browse(fixture);
  const entered = deferred();
  const cleanupGate = deferred();
  fixture.services.accounts.logout = async () => {
    fixture.accounts.clear();
    entered.resolve();
    await cleanupGate.promise;
  };
  const cleanup = revokeNasMusicAccess(GUILD_ID, USER_ID, fixture.services);
  await entered.promise;
  const entry = fixture.interaction({ kind: 'command' });
  const reopening = openPrivateNasMusic(entry, fixture.services);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(entry.acknowledgements.length, 1, 'only the private defer can happen during cleanup');
  assert.equal(fixture.calls.login.length, 0);
  cleanupGate.resolve();
  await cleanup;
  await reopening;
  assert.ok(components(lastPayload(entry)).some(item => item.custom_id?.endsWith(':login')));
  const stale = fixture.interaction({ customId: `musiclib:${old.id}:search` });
  await handleMusicInteraction(stale, fixture.services);
  assert.match(noticeText(stale), /面板已失效/);
});

test('unauthorized legacy browse opens only YouTube and does not access an old NAS account', async () => {
  const fixture = makeFixture();
  fixture.services.canUseNas = () => false;
  fixture.services.youtubeAvailable = true;
  const button = fixture.interaction({ customId: 'music:session:browse' });
  await handleMusicInteraction(button, fixture.services);
  assert.doesNotMatch(noticeText(button), /NAS|私人音樂庫|登入/);
  assert.equal(fixture.calls.search.length, 0);
});

test('a NAS login submitted before revocation cannot resurrect after a delayed acknowledgement and regrant', async () => {
  const fixture = makeFixture({ loggedIn: false });
  const { id } = await loginView(fixture);
  const acknowledged = deferred();
  const release = deferred();
  const submit = fixture.interaction({ kind: 'modal', customId: `musicauth:${id}:login_submit`, fields: { email: 'x', password: 'x' } });
  const originalDefer = submit.deferReply;
  submit.deferReply = async (...args) => { await originalDefer(...args); acknowledged.resolve(); await release.promise; };
  const pending = handleMusicInteraction(submit, fixture.services);
  await acknowledged.promise;
  await revokeNasMusicAccess(GUILD_ID, USER_ID, fixture.services);
  release.resolve();
  await pending;
  assert.equal(fixture.calls.login.length, 0);
  assert.equal(fixture.accounts.size, 0);
  assert.match(noticeText(submit), /已取消/);
});

test('runtime playback resolver rechecks the requester NAS grant on every play while YouTube remains independent', async () => {
  const fixture = makeFixture({ withSession: false, loggedIn: false });
  const client = { guilds: { cache: new Collection([[GUILD_ID, fixture.guild]]) } };
  const nasLibrary = { marker: 'private-library' };
  const entry = fixture.interaction({ kind: 'command' });
  entry.client = client;
  let manager;
  mock.method(MusicYouTubeClient.prototype, 'available', async () => true);
  mock.method(MusicPlaybackManager.prototype, 'getSession', function () { manager = this; return null; });
  mock.method(MusicAccounts.prototype, 'get', (guildId, userId) => userId === USER_ID ? { id: 'account', library: nasLibrary } : null);
  updateAiSetting(GUILD_ID, 'nas_music_whitelist', JSON.stringify([USER_ID]));
  await execute(entry);
  const youtubeId = components(lastPayload(entry)).find(item => item.custom_id?.endsWith(':youtube')).custom_id;
  await handleMusicInteraction(fixture.interaction({ customId: youtubeId }));
  const queued = { ...track(), requestedBy: USER_ID };
  assert.equal(await manager.resolveLibrary({ guildId: GUILD_ID }, queued), nasLibrary);
  updateAiSetting(GUILD_ID, 'nas_music_whitelist', '[]');
  await assert.rejects(manager.resolveLibrary({ guildId: GUILD_ID }, queued), { code: 'MUSIC_FORBIDDEN' });
  assert.ok(await manager.resolveLibrary({ guildId: GUILD_ID }, { ...queued, source: 'youtube' }) instanceof MusicYouTubeClient);
  await assert.rejects(manager.resolveLibrary({ guildId: GUILD_ID }, { ...queued, requestedBy: 'other' }), { code: 'MUSIC_FORBIDDEN' });
});

test('shutdown cancels delayed NAS modal acknowledgement without recreating an account or private login nonce', async () => {
  const fixture = makeFixture({ loggedIn: false });
  const { id } = await loginView(fixture);
  const entered = deferred();
  const gate = deferred();
  const submit = fixture.interaction({ kind: 'modal', customId: `musicauth:${id}:login_submit`, fields: { email: 'x', password: 'x' } });
  const acknowledge = submit.deferReply;
  submit.deferReply = async (...args) => { await acknowledge(...args); entered.resolve(); await gate.promise; };
  const pending = handleMusicInteraction(submit, fixture.services);
  await entered.promise;
  await stopMusicPlayback();
  gate.resolve();
  await pending;
  assert.equal(fixture.calls.login.length, 0);
  assert.equal(fixture.accounts.size, 0);
  assert.match(noticeText(submit), /已取消/);
  for (const ack of submit.acknowledgements) {
    if (ack.payload?.components) assert.equal(components(ack.payload).some(item => item.custom_id?.startsWith('musicauth:')), false);
  }
});

async function loginView(fixture, userId = USER_ID) {
  const interaction = fixture.interaction({ kind: 'command', userId });
  await openPrivateNasMusic(interaction, fixture.services);
  const id = components(lastPayload(interaction)).find(component => component.custom_id?.startsWith('musicauth:'))?.custom_id.split(':')[1];
  assert.ok(id, 'private entry must expose a scoped login action');
  return { id, interaction };
}

test('unregistered guilds open a private login card without credentials, voice connection or library access', async () => {
  const fixture = makeFixture({ withSession: false, loggedIn: false });
  fixture.member.voice.channel = null;
  const { interaction } = await loginView(fixture);
  assertNoSideEffects(fixture);
  assert.equal(interaction.ephemeral, true);
  assert.match(noticeText(interaction), /登入/);
});

test('login modal is private scoped and its submit acknowledges before authentication then opens the player', async () => {
  const fixture = makeFixture({ withSession: false, loggedIn: false });
  const { id } = await loginView(fixture);
  const button = fixture.interaction({ customId: `musicauth:${id}:login` });
  await handleMusicInteraction(button, fixture.services);
  assert.deepEqual(button.acknowledgements.map(ack => ack.kind), ['showModal']);
  assertNoSideEffects(fixture);
  const submit = fixture.interaction({ kind: 'modal', customId: `musicauth:${id}:login_submit`, fields: {
    email: 'listener@example.test', password: 'synthetic-password-never-display',
  } });
  const originalLogin = fixture.services.library.login;
  fixture.services.library.login = async () => {
    assert.equal(submit.acknowledgements[0].kind, 'deferReply');
    assert.equal(submit.acknowledgements[0].payload.flags, MessageFlags.Ephemeral);
    await originalLogin();
  };
  await handleMusicInteraction(submit, fixture.services);
  assert.deepEqual(fixture.order, ['login', 'connect', 'panel', 'search']);
  assert.deepEqual(fixture.credentials, { email: 'listener@example.test', password: 'synthetic-password-never-display' });
  assert.ok(components(lastPayload(submit)).some(component => component.custom_id?.startsWith('musiclib:')));
  assert.doesNotMatch(JSON.stringify([...submit.acknowledgements, ...fixture.calls.send]), /listener@example\.test|synthetic-password-never-display/);
  const replay = fixture.interaction({ kind: 'modal', customId: `musicauth:${id}:login_submit` });
  await handleMusicInteraction(replay, fixture.services);
  assert.equal(fixture.calls.login.length, 1);
  assert.match(noticeText(replay), /面板已失效/);
});

test('foreign owner, foreign guild and forged authentication controls never authenticate', async () => {
  for (const scenario of ['owner', 'guild', 'forged']) {
    const fixture = makeFixture({ withSession: false, loggedIn: false });
    const { id } = await loginView(fixture);
    const submit = fixture.interaction({ kind: 'modal', customId: `musicauth:${id}:login_submit`, fields: { email: 'x', password: 'x' } });
    if (scenario === 'owner') submit.user.id = 'other';
    if (scenario === 'guild') submit.guildId = 'other-guild';
    if (scenario === 'forged') submit.customId = 'musicauth:forged:login_submit';
    await handleMusicInteraction(submit, fixture.services);
    assertNoSideEffects(fixture);
    assert.equal(fixture.credentials, undefined);
    assert.match(noticeText(submit), /面板已失效/);
    mock.restoreAll();
  }
});

test('login card and pending modal remain usable after a day without permitting submit replay', async () => {
  const fixture = makeFixture({ withSession: false, loggedIn: false });
  const { id } = await loginView(fixture);
  let now = Date.now() + 24 * 60 * 60_000;
  mock.method(Date, 'now', () => now);
  const button = fixture.interaction({ customId: `musicauth:${id}:login` });
  await handleMusicInteraction(button, fixture.services);
  assert.deepEqual(button.acknowledgements.map(ack => ack.kind), ['showModal']);
  now += 24 * 60 * 60_000;
  const submit = fixture.interaction({ kind: 'modal', customId: `musicauth:${id}:login_submit`, fields: {
    email: 'listener@example.test', password: 'synthetic-password',
  } });
  await handleMusicInteraction(submit, fixture.services);
  assert.deepEqual(fixture.order, ['login', 'connect', 'panel', 'search']);
  assert.ok(components(lastPayload(submit)).some(component => component.custom_id?.startsWith('musiclib:')));
  const replay = fixture.interaction({ kind: 'modal', customId: `musicauth:${id}:login_submit` });
  await handleMusicInteraction(replay, fixture.services);
  assert.equal(fixture.calls.login.length, 1);
  assert.match(noticeText(replay), /面板已失效/);
});

test('opening another viewer login card does not expire an earlier card by age', async () => {
  const fixture = makeFixture({ withSession: false, loggedIn: false });
  const first = await loginView(fixture);
  const later = Date.now() + 24 * 60 * 60_000;
  mock.method(Date, 'now', () => later);
  await loginView(fixture, 'other-viewer');
  const button = fixture.interaction({ customId: `musicauth:${first.id}:login` });
  await handleMusicInteraction(button, fixture.services);
  assert.deepEqual(button.acknowledgements.map(ack => ack.kind), ['showModal']);
  assertNoSideEffects(fixture);
});

test('active library pagination, search, enqueue and account logout remain usable after a day', async () => {
  const fixture = makeFixture({ tracks: Array.from({ length: 12 }, (_, index) => track(index + 1)) });
  const browser = await browse(fixture);
  const later = Date.now() + 24 * 60 * 60_000;
  mock.method(Date, 'now', () => later);
  await browse(fixture);
  const next = fixture.interaction({ customId: `musiclib:${browser.id}:next` });
  await handleMusicInteraction(next, fixture.services);
  assert.deepEqual(next.acknowledgements.map(ack => ack.kind), ['update']);
  assert.match(noticeText(next), /第 2 \/ 2 頁/);
  const searchButton = fixture.interaction({ customId: `musiclib:${browser.id}:search` });
  await handleMusicInteraction(searchButton, fixture.services);
  assert.deepEqual(searchButton.acknowledgements.map(ack => ack.kind), ['showModal']);
  const search = fixture.interaction({ kind: 'modal', customId: `musiclib:${browser.id}:search_submit`, fields: { query: '歌曲' } });
  await handleMusicInteraction(search, fixture.services);
  assert.equal(fixture.calls.search.at(-1), '歌曲');
  assert.ok(components(lastPayload(search)).some(component => component.custom_id === `musiclib:${browser.id}:enqueue`));
  const enqueue = fixture.interaction({ kind: 'select', customId: `musiclib:${browser.id}:enqueue`, values: [track().id] });
  await handleMusicInteraction(enqueue, fixture.services);
  assert.equal(fixture.calls.enqueue.length, 1);
  const card = fixture.interaction({ customId: `musiclib:${browser.id}:account` });
  await handleMusicInteraction(card, fixture.services);
  const logoutId = components(lastPayload(card)).find(component => component.custom_id?.endsWith(':logout')).custom_id;
  mock.method(Date, 'now', () => later + 24 * 60 * 60_000);
  const logout = fixture.interaction({ customId: logoutId });
  await handleMusicInteraction(logout, fixture.services);
  assert.deepEqual(fixture.calls.logout, [[GUILD_ID, USER_ID]]);
  const stale = fixture.interaction({ customId: `musiclib:${browser.id}:search` });
  await handleMusicInteraction(stale, fixture.services);
  assert.match(noticeText(stale), /面板已失效/);
});

test('manually stopping a player still rejects its old library and public controls', async () => {
  const fixture = makeFixture();
  const browser = await browse(fixture);
  fixture.services.manager.control = async (session, action) => {
    fixture.calls.control.push([session, action]);
    if (action === 'stop') { session.status = 'stopped'; fixture.session = null; }
  };
  const stop = fixture.interaction({ customId: 'music:session:stop' });
  await handleMusicInteraction(stop, fixture.services);
  const later = Date.now() + 24 * 60 * 60_000;
  mock.method(Date, 'now', () => later);
  for (const customId of [`musiclib:${browser.id}:search`, 'music:session:resume']) {
    const stale = fixture.interaction({ customId });
    await handleMusicInteraction(stale, fixture.services);
    assert.match(noticeText(stale), /面板已失效/);
  }
  assert.deepEqual(fixture.calls.control, [[fixture.musicSession, 'stop']]);
  assert.equal(fixture.calls.search.length, 1);
});

test('timeless library views retain a bounded capacity of 100', async () => {
  const fixture = makeFixture();
  const first = await browse(fixture);
  const second = await browse(fixture);
  for (let index = 2; index <= 100; index++) await browse(fixture);
  const evicted = fixture.interaction({ customId: `musiclib:${first.id}:search` });
  await handleMusicInteraction(evicted, fixture.services);
  assert.match(noticeText(evicted), /面板已失效/);
  const retained = fixture.interaction({ customId: `musiclib:${second.id}:search` });
  await handleMusicInteraction(retained, fixture.services);
  assert.deepEqual(retained.acknowledgements.map(ack => ack.kind), ['showModal']);
  assert.equal(fixture.calls.search.length, 101);
  assert.equal(fixture.calls.enqueue.length, 0);
});

test('timeless login views retain a bounded capacity of 100', async () => {
  const fixture = makeFixture({ withSession: false, loggedIn: false });
  const first = await loginView(fixture);
  const second = await loginView(fixture, 'viewer-1');
  for (let index = 2; index <= 100; index++) await loginView(fixture, `viewer-${index}`);
  const evicted = fixture.interaction({ customId: `musicauth:${first.id}:login` });
  await handleMusicInteraction(evicted, fixture.services);
  assert.match(noticeText(evicted), /面板已失效/);
  const retained = fixture.interaction({ customId: `musicauth:${second.id}:login`, userId: 'viewer-1' });
  await handleMusicInteraction(retained, fixture.services);
  assert.deepEqual(retained.acknowledgements.map(ack => ack.kind), ['showModal']);
  assertNoSideEffects(fixture);
});

test('login failure offers a new private retry ticket without publishing or revealing input', async () => {
  const fixture = makeFixture({ withSession: false, loggedIn: false });
  const { id } = await loginView(fixture);
  fixture.services.library.login = async () => { throw new Error('provider private detail'); };
  const submit = fixture.interaction({ kind: 'modal', customId: `musicauth:${id}:login_submit`, fields: {
    email: 'private@example.test', password: 'private-password',
  } });
  await handleMusicInteraction(submit, fixture.services);
  assert.equal(fixture.calls.connect.length, 0);
  assert.equal(fixture.calls.send.length, 0);
  assert.equal(fixture.accounts.size, 0);
  const retry = components(lastPayload(submit)).find(component => component.custom_id?.startsWith('musicauth:'));
  assert.ok(retry);
  assert.notEqual(retry.custom_id.split(':')[1], id);
  assert.equal(submit.acknowledgements.at(-1).payload.flags & MessageFlags.Ephemeral, MessageFlags.Ephemeral);
  assert.doesNotMatch(JSON.stringify(submit.acknowledgements), /private@example|private-password|provider private detail/);
});

test('login without voice retains the account and offers open and logout, then opens after joining voice', async () => {
  const fixture = makeFixture({ withSession: false, loggedIn: false });
  const { id } = await loginView(fixture);
  fixture.member.voice.channel = null;
  const submit = fixture.interaction({ kind: 'modal', customId: `musicauth:${id}:login_submit`, fields: { email: 'x', password: 'x' } });
  await handleMusicInteraction(submit, fixture.services);
  assert.equal(fixture.accounts.size, 1);
  assert.equal(fixture.calls.connect.length, 0);
  assert.match(noticeText(submit), /一般語音頻道/);
  const openId = components(lastPayload(submit)).find(component => component.custom_id?.endsWith(':open')).custom_id;
  assert.ok(components(lastPayload(submit)).some(component => component.custom_id?.endsWith(':logout')));
  fixture.member.voice.channel = fixture.voiceChannel;
  const open = fixture.interaction({ customId: openId });
  await handleMusicInteraction(open, fixture.services);
  assert.equal(fixture.calls.connect.length, 1);
  assert.ok(components(lastPayload(open)).some(component => component.custom_id?.startsWith('musiclib:')));
});

test('a logged-in viewer can reach private logout even after leaving voice', async () => {
  const fixture = makeFixture();
  fixture.member.voice.channel = null;
  const interaction = fixture.interaction({ kind: 'command' });
  await openPrivateNasMusic(interaction, fixture.services);
  assertNoSideEffects(fixture);
  assert.match(noticeText(interaction), /一般語音頻道/);
  assert.ok(components(lastPayload(interaction)).some(component => component.custom_id?.endsWith(':logout')));
});

test('each viewer browses and looks up tracks using only their own scoped account', async () => {
  const fixture = makeFixture();
  const secondUser = '423456789012345678';
  const secondCalls = [];
  fixture.accounts.set(`${GUILD_ID}:${secondUser}`, { id: 'second-account', library: {
    async search() { secondCalls.push('search'); return [track(2)]; },
    async getTrack(id) { secondCalls.push(id); return track(2); },
  } });
  const first = await browse(fixture);
  const second = await browse(fixture, secondUser);
  const select = fixture.interaction({ kind: 'select', userId: secondUser, customId: `musiclib:${second.id}:enqueue`, values: [track(2).id] });
  await handleMusicInteraction(select, fixture.services);
  assert.deepEqual(secondCalls, ['search', track(2).id]);
  assert.equal(fixture.calls.getTrack.length, 0);
  assert.equal(fixture.calls.enqueue[0][2], secondUser);
  const stolen = fixture.interaction({ kind: 'select', userId: secondUser, customId: `musiclib:${first.id}:enqueue`, values: [track().id] });
  await handleMusicInteraction(stolen, fixture.services);
  assert.equal(fixture.calls.enqueue.length, 1);
});

test('account card logout invalidates old browser and cannot log out another viewer', async () => {
  const fixture = makeFixture();
  const browser = await browse(fixture);
  const account = fixture.interaction({ customId: `musiclib:${browser.id}:account` });
  await handleMusicInteraction(account, fixture.services);
  const id = components(lastPayload(account)).find(component => component.custom_id?.endsWith(':logout')).custom_id.split(':')[1];
  const foreign = fixture.interaction({ customId: `musicauth:${id}:logout`, userId: 'other' });
  await handleMusicInteraction(foreign, fixture.services);
  assert.equal(fixture.calls.logout.length, 0);
  const logout = fixture.interaction({ customId: `musicauth:${id}:logout` });
  await handleMusicInteraction(logout, fixture.services);
  assert.deepEqual(fixture.calls.logout, [[GUILD_ID, USER_ID]]);
  assert.equal(fixture.calls.removeUserTracks.length, 1);
  assert.equal(fixture.accounts.size, 0);
  const stale = fixture.interaction({ kind: 'select', customId: `musiclib:${browser.id}:enqueue`, values: [track().id] });
  await handleMusicInteraction(stale, fixture.services);
  assert.equal(fixture.calls.getTrack.length, 0);
  assert.equal(fixture.calls.enqueue.length, 0);
  assert.match(noticeText(stale), /面板已失效/);
});

test('a stale logout cannot revoke a replacement login created during its acknowledgement', async () => {
  const fixture = makeFixture();
  const browser = await browse(fixture);
  const card = fixture.interaction({ customId: `musiclib:${browser.id}:account` });
  await handleMusicInteraction(card, fixture.services);
  const id = components(lastPayload(card)).find(component => component.custom_id?.endsWith(':logout')).custom_id.split(':')[1];
  const logout = fixture.interaction({ customId: `musicauth:${id}:logout` });
  const acknowledge = logout.deferReply;
  const replacement = { id: 'replacement', library: fixture.services.library };
  logout.deferReply = async (...args) => {
    await acknowledge(...args);
    fixture.accounts.set(`${GUILD_ID}:${USER_ID}`, replacement);
  };
  await handleMusicInteraction(logout, fixture.services);
  assert.equal(fixture.accounts.get(`${GUILD_ID}:${USER_ID}`), replacement);
  assert.equal(fixture.calls.logout.length, 0);
  assert.match(noticeText(logout), /面板已失效/);
});

test('a late track lookup cannot enqueue after logout or after replacement with a different account', async () => {
  for (const replace of [false, true]) {
    const fixture = makeFixture();
    const browser = await browse(fixture);
    const started = deferred();
    const finish = deferred();
    fixture.services.library.getTrack = async () => { started.resolve(); await finish.promise; return track(); };
    const select = fixture.interaction({ kind: 'select', customId: `musiclib:${browser.id}:enqueue`, values: [track().id] });
    const operation = handleMusicInteraction(select, fixture.services);
    await started.promise;
    await fixture.services.accounts.logout(GUILD_ID, USER_ID);
    if (replace) fixture.accounts.set(`${GUILD_ID}:${USER_ID}`, { id: 'replacement', library: fixture.services.library });
    finish.resolve();
    await operation;
    assert.equal(fixture.calls.enqueue.length, 0);
  }
});

test('a revoked NAS session clears only its own login and offers private re-login', async () => {
  const fixture = makeFixture();
  const browser = await browse(fixture);
  fixture.services.library.search = async () => { throw new MusicError('MUSIC_AUTH'); };
  const search = fixture.interaction({ kind: 'modal', customId: `musiclib:${browser.id}:search_submit`, fields: { query: '歌曲' } });
  await handleMusicInteraction(search, fixture.services);
  assert.deepEqual(fixture.calls.logout, [[GUILD_ID, USER_ID]]);
  assert.equal(fixture.accounts.size, 0);
  assert.ok(components(lastPayload(search)).some(component => component.custom_id?.endsWith(':login')));
});

test('a late revoked-session response cannot log out a replacement account or publish stale search results', async () => {
  const fixture = makeFixture();
  const browser = await browse(fixture);
  const started = deferred();
  const finish = deferred();
  fixture.services.library.search = async () => {
    started.resolve(); await finish.promise; throw new MusicError('MUSIC_AUTH');
  };
  const search = fixture.interaction({ kind: 'modal', customId: `musiclib:${browser.id}:search_submit`, fields: { query: 'old-query' } });
  const operation = handleMusicInteraction(search, fixture.services);
  await started.promise;
  const replacement = { id: 'replacement', library: fixture.services.library };
  fixture.accounts.set(`${GUILD_ID}:${USER_ID}`, replacement);
  finish.resolve();
  await operation;
  assert.equal(fixture.accounts.get(`${GUILD_ID}:${USER_ID}`), replacement);
  assert.equal(fixture.calls.logout.length, 0);
  assert.equal(search.acknowledgements.some(ack => ack.kind === 'editReply' && JSON.stringify(ack.payload).includes('old-query')), false);
});

test('music access rejects DM, missing or different voice, Stage and missing member or bot permissions without a guild allowlist', async () => {
  const scenarios = [
    { change: (f) => { f.member.voice.channel = null; }, code: 'MUSIC_CHANNEL', notice: /請先加入一般語音頻道/ },
    { change: (f) => { f.member.voice.channel = { ...f.voiceChannel, id: 'other-voice' }; }, code: 'MUSIC_CHANNEL', notice: /播放器所在的語音頻道/ },
    { change: (f) => { f.voiceChannel.type = ChannelType.GuildStageVoice; }, code: 'MUSIC_CHANNEL', notice: /一般語音頻道/ },
    { change: (f) => f.memberPermissions.delete(PermissionFlagsBits.Connect), code: 'MUSIC_CHANNEL', notice: /一般語音頻道/ },
    { change: (f) => f.botPermissions.delete(PermissionFlagsBits.Connect), code: 'MUSIC_VOICE', notice: /機器人具有檢視、連線及說話權限/ },
    { change: (f) => f.botPermissions.delete(PermissionFlagsBits.Speak), code: 'MUSIC_VOICE', notice: /機器人具有檢視、連線及說話權限/ },
    { change: (f) => f.botPermissions.delete(PermissionFlagsBits.ViewChannel), code: 'MUSIC_VOICE', notice: /機器人具有檢視、連線及說話權限/ },
  ];
  for (const scenario of scenarios) {
    const fixture = makeFixture();
    scenario.change(fixture);
    const interaction = fixture.interaction({ kind: 'command' });
    assert.throws(() => assertMusicAccess(interaction, fixture.services.config, fixture.session), { code: scenario.code });
    await openPrivateNasMusic(interaction, fixture.services);
    assertNoSideEffects(fixture);
    assert.match(noticeText(interaction), scenario.notice);
    assert.equal(interaction.acknowledgements[0].payload.flags, MessageFlags.Ephemeral);
  }
  const fixture = makeFixture();
  const dm = fixture.interaction({ kind: 'command' });
  dm.guildId = null;
  assert.throws(() => assertMusicAccess(dm, fixture.services.config), { code: 'MUSIC_CHANNEL' });
  await execute(dm, fixture.services);
  assertNoSideEffects(fixture);
  assert.match(noticeText(dm), /一般語音頻道/);
});

test('first execute authenticates before connecting, publishes one player and returns the private library', async () => {
  const fixture = makeFixture({ withSession: false, tracks: Array.from({ length: 15 }, (_, index) => track(index + 1)) });
  const interaction = fixture.interaction({ kind: 'command' });
  await openPrivateNasMusic(interaction, fixture.services);
  assert.deepEqual(fixture.order, ['login', 'connect', 'panel', 'search']);
  assert.equal(fixture.calls.connect[0][0], fixture.guild);
  assert.equal(fixture.calls.connect[0][1], fixture.voiceChannel);
  assert.equal(fixture.calls.send.length, 1);
  assert.equal(Boolean(fixture.calls.send[0].flags & MessageFlags.Ephemeral), false);
  assert.ok(fixture.calls.send[0].flags & MessageFlags.IsComponentsV2);
  assert.equal(fixture.musicSession.message.id, 'panel');
  assert.equal(interaction.ephemeral, true);
  const privatePayload = lastPayload(interaction);
  assert.ok(privatePayload.flags & MessageFlags.IsComponentsV2);
  assert.equal(components(privatePayload).find((component) => component.type === ComponentType.StringSelect).options.length, 10);
  await openPrivateNasMusic(fixture.interaction({ kind: 'command' }), fixture.services);
  assert.equal(fixture.calls.send.length, 1, 'reopening must reuse the public player message');
});

test('library authentication failure does not connect or publish an idle player', async () => {
  const fixture = makeFixture({ withSession: false });
  fixture.services.library.login = async () => { fixture.calls.login.push(true); throw new Error('login rejected'); };
  const interaction = fixture.interaction({ kind: 'command' });
  await openPrivateNasMusic(interaction, fixture.services);
  assert.equal(fixture.calls.connect.length, 0);
  assert.equal(fixture.calls.send.length, 0);
  assert.equal(fixture.calls.search.length, 0);
  assert.match(noticeText(interaction), /暫時無法連線/);
  assert.doesNotMatch(noticeText(interaction), /login rejected/);
});

test('execute rechecks voice after login and uses the new channel or rejects a caller who left voice', async () => {
  for (const leaveVoice of [false, true]) {
    const fixture = makeFixture({ withSession: false });
    const loginStarted = deferred();
    const loginFinished = deferred();
    fixture.services.library.login = async () => {
      fixture.calls.login.push(true);
      fixture.order.push('login');
      loginStarted.resolve();
      await loginFinished.promise;
    };
    const interaction = fixture.interaction({ kind: 'command' });
    const operation = openPrivateNasMusic(interaction, fixture.services);
    await loginStarted.promise;
    assert.equal(fixture.calls.connect.length, 0);
    const newChannel = { ...fixture.voiceChannel, id: '523456789012345678' };
    fixture.member.voice.channel = leaveVoice ? null : newChannel;
    loginFinished.resolve();
    await operation;
    if (leaveVoice) {
      assert.equal(fixture.calls.connect.length, 0);
      assert.equal(fixture.calls.send.length, 0);
      assert.equal(fixture.calls.search.length, 0);
      assert.match(noticeText(interaction), /請先加入一般語音頻道/);
    } else {
      assert.equal(fixture.calls.connect.length, 1);
      assert.equal(fixture.calls.connect[0][1], newChannel);
      assert.equal(fixture.calls.send.length, 1);
      assert.equal(fixture.calls.search.length, 1);
      const publicText = components(fixture.calls.send[0]).map((component) => component.content ?? '').join('\n');
      assert.match(publicText, /<#523456789012345678>/);
      assert.doesNotMatch(publicText, /<#223456789012345678>/);
    }
  }
});

test('late public panel delivery after session stop disables that message and does not open a browser', async () => {
  const fixture = makeFixture({ withSession: false });
  const sendStarted = deferred();
  const sendFinished = deferred();
  const panelEdits = [];
  const message = { id: 'late-panel', async edit(payload) { panelEdits.push(payload); } };
  const interaction = fixture.interaction({ kind: 'command' });
  interaction.channel.send = async (payload) => {
    fixture.calls.send.push(payload);
    fixture.order.push('panel');
    sendStarted.resolve();
    return sendFinished.promise;
  };
  const operation = openPrivateNasMusic(interaction, fixture.services);
  await sendStarted.promise;
  fixture.musicSession.status = 'stopped';
  fixture.session = null;
  sendFinished.resolve(message);
  await operation;
  assert.equal(fixture.calls.send.length, 1);
  assert.equal(panelEdits.length, 1);
  const edited = components(panelEdits[0]);
  assert.match(edited.map((component) => component.content ?? '').join('\n'), /已停止/);
  assert.ok(edited.filter((component) => component.custom_id).every((component) => component.disabled));
  assert.equal(fixture.calls.search.length, 0, 'a stopped session must not query or open its library');
  assert.match(noticeText(interaction), /面板已失效/);
  assert.equal(components(lastPayload(interaction)).some((component) => component.custom_id?.startsWith('musiclib:')), false);
});

test('public controls delegate only matching live session and permitted same-channel callers', async () => {
  for (const action of ['pause', 'resume', 'skip', 'loop', 'shuffle', 'stop']) {
    const fixture = makeFixture();
    const interaction = fixture.interaction({ customId: `music:session:${action}` });
    assert.equal(await handleMusicInteraction(interaction, fixture.services), true);
    assert.deepEqual(fixture.calls.control, [[fixture.session, action]]);
    assert.equal(fixture.calls.login.length, 0);
    assert.equal(fixture.calls.search.length, 0);
    assert.equal(interaction.acknowledgements[0].kind, 'deferUpdate');
  }
  const fixture = makeFixture();
  fixture.member.voice.channel = { ...fixture.voiceChannel, id: 'other-voice' };
  const rejected = fixture.interaction({ customId: 'music:session:skip' });
  assert.equal(await handleMusicInteraction(rejected, fixture.services), true);
  assertNoSideEffects(fixture);
  assert.match(noticeText(rejected), /播放器所在的語音頻道/);
});

test('leaving voice during the interaction acknowledgement prevents playback controls', async () => {
  for (const action of ['pause']) {
    const fixture = makeFixture();
    const interaction = fixture.interaction({
      kind: 'button', customId: `music:session:${action}`,
    });
    const method = 'deferUpdate';
    const acknowledge = interaction[method];
    interaction[method] = async (...args) => {
      await acknowledge(...args);
      fixture.member.voice.channel = null;
    };
    await handleMusicInteraction(interaction, fixture.services);
    assert.equal(fixture.calls.control.length, 0);
    assert.match(noticeText(interaction), /一般語音頻道/);
  }
});

test('listeners leaving never stop the player, while manually disconnecting or moving the bot does', () => {
  const fixture = makeFixture();
  const client = { user: { id: 'bot' } };
  const oldState = { channelId: VOICE_ID };
  for (const [id, channelId] of [[USER_ID, null], [USER_ID, 'another-channel'], ['bot', VOICE_ID]]) {
    handleMusicVoiceState(oldState, { id, channelId, guild: fixture.guild, client }, fixture.services);
    assert.equal(fixture.calls.stop.length, 0);
  }
  for (const channelId of [null, 'another-channel']) {
    handleMusicVoiceState(oldState, { id: 'bot', channelId, guild: fixture.guild, client }, fixture.services);
  }
  assert.deepEqual(fixture.calls.stop, [fixture.musicSession, fixture.musicSession]);
});

test('old session id, absent session and unsupported action are acknowledged without side effects', async () => {
  for (const [withSession, customId, expected] of [
    [true, 'music:old-session:skip', /面板已失效/],
    [false, 'music:session:browse', /面板已失效/],
    [true, 'music:session:unsupported', /資料無法辨識/],
  ]) {
    const fixture = makeFixture({ withSession });
    const interaction = fixture.interaction({ customId });
    assert.equal(await handleMusicInteraction(interaction, fixture.services), true);
    assertNoSideEffects(fixture);
    assert.match(noticeText(interaction), expected);
  }
});

test('another member cannot use the owner library or reuse it after session replacement', async () => {
  const fixture = makeFixture();
  const browser = await browse(fixture);
  const stranger = fixture.interaction({ customId: `musiclib:${browser.id}:enqueue`, kind: 'select', userId: '423456789012345678', values: [track().id] });
  await handleMusicInteraction(stranger, fixture.services);
  assert.equal(fixture.calls.getTrack.length, 0);
  assert.equal(fixture.calls.enqueue.length, 0);
  assert.match(noticeText(stranger), /面板已失效/);
  fixture.session = { ...fixture.musicSession, id: 'replacement-session' };
  const outdated = fixture.interaction({ customId: `musiclib:${browser.id}:search` });
  await handleMusicInteraction(outdated, fixture.services);
  assert.equal(fixture.calls.search.length, 1);
  assert.match(noticeText(outdated), /面板已失效/);
});

test('library search opens scoped modal and submission resets ten-track pagination with safe boundaries', async () => {
  const fixture = makeFixture();
  const browser = await browse(fixture);
  const open = fixture.interaction({ customId: `musiclib:${browser.id}:search` });
  await handleMusicInteraction(open, fixture.services);
  const modal = open.acknowledgements[0].payload.toJSON();
  assert.equal(modal.custom_id, `musiclib:${browser.id}:search_submit`);
  fixture.searchResult = Array.from({ length: 21 }, (_, index) => track(index + 10));
  const submit = fixture.interaction({ kind: 'modal', customId: modal.custom_id, fields: { query: '  歌手  ' } });
  await handleMusicInteraction(submit, fixture.services);
  assert.deepEqual(fixture.calls.search, ['', '歌手']);
  assert.equal(submit.acknowledgements[0].kind, 'deferUpdate');
  const selection = (interaction) => components(lastPayload(interaction)).find((component) => component.type === ComponentType.StringSelect);
  assert.deepEqual(selection(submit).options.map((option) => option.value), fixture.searchResult.slice(0, 10).map((item) => item.id));
  for (const [action, start, end] of [['next', 10, 20], ['next', 20, 21], ['next', 20, 21], ['prev', 10, 20], ['prev', 0, 10], ['prev', 0, 10]]) {
    const page = fixture.interaction({ customId: `musiclib:${browser.id}:${action}` });
    await handleMusicInteraction(page, fixture.services);
    assert.deepEqual(selection(page).options.map((option) => option.value), fixture.searchResult.slice(start, end).map((item) => item.id));
  }
  const longSearch = fixture.interaction({ kind: 'modal', customId: modal.custom_id, fields: { query: '歌'.repeat(150) } });
  await handleMusicInteraction(longSearch, fixture.services);
  assert.equal(fixture.calls.search.at(-1).length, 120);
  assert.equal(selection(longSearch).options[0].value, fixture.searchResult[0].id);
});

test('selected song must belong to that browser and fresh metadata is checked before enqueue', async () => {
  const fixture = makeFixture();
  const browser = await browse(fixture);
  const forged = fixture.interaction({ kind: 'select', customId: `musiclib:${browser.id}:enqueue`, values: [track(999).id] });
  await handleMusicInteraction(forged, fixture.services);
  assert.equal(fixture.calls.getTrack.length, 0);
  assert.equal(fixture.calls.enqueue.length, 0);
  assert.match(noticeText(forged), /資料無法辨識/);
  const valid = fixture.interaction({ kind: 'select', customId: `musiclib:${browser.id}:enqueue`, values: [track().id] });
  await handleMusicInteraction(valid, fixture.services);
  assert.deepEqual(fixture.calls.getTrack, [track().id]);
  assert.equal(fixture.calls.enqueue[0][0], fixture.session);
  assert.equal(fixture.calls.enqueue[0][1].title, '重新查核的歌曲');
  assert.equal(fixture.calls.enqueue[0][2], USER_ID);
  assert.equal(valid.acknowledgements[0].kind, 'deferUpdate');
  assert.match(noticeText(valid), /已加入點播/);
});

test('leaving voice while getTrack is pending prevents enqueue after the fresh lookup', async () => {
  const fixture = makeFixture();
  const browser = await browse(fixture);
  const started = deferred();
  const finish = deferred();
  fixture.services.library.getTrack = async (id) => { fixture.calls.getTrack.push(id); started.resolve(); return finish.promise; };
  const interaction = fixture.interaction({ kind: 'select', customId: `musiclib:${browser.id}:enqueue`, values: [track().id] });
  const operation = handleMusicInteraction(interaction, fixture.services);
  await started.promise;
  fixture.member.voice.channel = null;
  finish.resolve(track());
  await operation;
  assert.equal(fixture.calls.enqueue.length, 0);
  assert.match(noticeText(interaction), /請先加入一般語音頻道/);
  assert.equal(interaction.acknowledgements.at(-1).kind, 'followUp');
});

test('concurrent enqueue clicks are rejected while one lookup is pending and busy is released afterwards', async () => {
  const fixture = makeFixture();
  const browser = await browse(fixture);
  const started = deferred();
  const finish = deferred();
  fixture.services.library.getTrack = async (id) => { fixture.calls.getTrack.push(id); started.resolve(); return finish.promise; };
  const click = () => fixture.interaction({ kind: 'select', customId: `musiclib:${browser.id}:enqueue`, values: [track().id] });
  const first = click();
  const pending = handleMusicInteraction(first, fixture.services);
  await started.promise;
  const second = click();
  await handleMusicInteraction(second, fixture.services);
  assert.equal(fixture.calls.getTrack.length, 1);
  assert.equal(fixture.calls.enqueue.length, 0);
  assert.match(noticeText(second), /正在處理操作/);
  finish.resolve(track());
  await pending;
  assert.equal(fixture.calls.enqueue.length, 1);
  const third = click();
  await handleMusicInteraction(third, fixture.services);
  assert.equal(fixture.calls.getTrack.length, 2);
  assert.equal(fixture.calls.enqueue.length, 2);
});

test('failed fresh track lookup releases browser busy without enqueueing or exposing raw errors', async () => {
  const fixture = makeFixture();
  const browser = await browse(fixture);
  fixture.services.library.getTrack = async (id) => { fixture.calls.getTrack.push(id); throw new Error('private backend path'); };
  const click = () => fixture.interaction({ kind: 'select', customId: `musiclib:${browser.id}:enqueue`, values: [track().id] });
  const first = click();
  await handleMusicInteraction(first, fixture.services);
  assert.equal(fixture.calls.enqueue.length, 0);
  assert.doesNotMatch(noticeText(first), /private backend path/);
  const second = click();
  await handleMusicInteraction(second, fixture.services);
  assert.equal(fixture.calls.getTrack.length, 2);
  assert.doesNotMatch(noticeText(second), /正在處理操作/);
});

test('legacy volume controls give a private Discord volume hint without changing playback', async () => {
  const fixture = makeFixture();
  for (const interaction of [
    fixture.interaction({ customId: 'music:session:volume' }),
    fixture.interaction({ kind: 'modal', customId: 'music:session:volume_submit' }),
  ]) {
    await handleMusicInteraction(interaction, fixture.services);
    assert.equal(interaction.acknowledgements[0].kind, 'reply');
    assert.equal(interaction.ephemeral, true);
    assert.match(noticeText(interaction), /Discord.*個人音量/);
  }
  assert.equal(fixture.calls.control.length, 0);
});

test('queue controls return private queue and use target page ids without mutating playback', async () => {
  const fixture = makeFixture();
  fixture.session.queue = Array.from({ length: 20 }, (_, index) => track(index + 1));
  const open = fixture.interaction({ customId: 'music:session:queue' });
  await handleMusicInteraction(open, fixture.services);
  assert.equal(open.acknowledgements[0].kind, 'reply');
  assert.ok(lastPayload(open).flags & MessageFlags.Ephemeral);
  const next = fixture.interaction({ customId: 'music:session:qnext:1' });
  await handleMusicInteraction(next, fixture.services);
  assert.equal(next.acknowledgements[0].kind, 'update');
  assert.match(noticeText(next), /\*\*11\. 歌曲 11\*\* {2}\n歌手 · 3:00/);
  assert.doesNotMatch(noticeText(next), /NAS/);
  assert.match(noticeText(next), /\*\*20\. 歌曲 20\*\*/);
  assert.equal(fixture.calls.control.length, 0);
  assert.equal(fixture.calls.search.length, 0);
});

test('unknown custom id prefix returns false without accessing services or acknowledging', async () => {
  const fixture = makeFixture();
  for (const customId of ['settings:member', 'musiclib-other:session:search', '', 'poll:session:vote']) {
    const interaction = fixture.interaction({ customId });
    assert.equal(await handleMusicInteraction(interaction, fixture.services), false);
    assert.equal(interaction.acknowledgements.length, 0);
  }
  assertNoSideEffects(fixture);
  assert.equal(fixture.calls.getSession.length, 0);
});

function panelFixture() {
  const requests = [];
  const edits = [];
  const warnings = [];
  const failures = [];
  const accounts = new Map();
  const account = {
    id: 'account-one', library: {
      getCover(id, { signal }) {
        const pending = deferred();
        requests.push({ id, signal, ...pending });
        return pending.promise;
      },
    },
  };
  accounts.set(USER_ID, account);
  const session = {
    id: 'session', guildId: GUILD_ID, voiceChannelId: VOICE_ID, generation: 1,
    current: track(1, { requestedBy: USER_ID }), queue: [], loop: 'off', status: 'playing',
    controller: new AbortController(), trackController: new AbortController(),
    message: {
      async edit(payload) {
        edits.push(payload);
        return { attachments: new Collection((payload.files || []).map((file, index) => [
          String(index + 1), { id: '523456789012345678', name: file.name,
            url: `https://cdn.discordapp.com/attachments/${GUILD_ID}/523456789012345678/${file.name}` },
        ])) };
      },
    },
  };
  const presenter = new MusicPanelPresenter({
    manager: { snapshot: target => ({ ...target, positionSeconds: target.positionSeconds ?? 24 }) },
    accounts: { get: (_guildId, userId) => accounts.get(userId) || null },
    onCoverError: (error, stage) => warnings.push({ error, stage }), onPanelError: target => failures.push(target),
  });
  return { presenter, session, accounts, account, requests, edits, warnings, failures };
}

async function settleCover(fixture, request, buffer = Buffer.from('synthetic cover')) {
  request.resolve(buffer ? { buffer, name: 'cover.webp' } : null);
  await new Promise(resolve => setImmediate(resolve));
  await fixture.presenter.update(fixture.session);
}

test('panel removal drains the active edit, drops queued updates and aborts late cover uploads', async () => {
  const { presenter, session, requests } = panelFixture();
  const editing = deferred();
  const entered = deferred();
  const events = [];
  session.message = {
    async edit() { events.push('edit'); entered.resolve(); await editing.promise; },
    async delete() { events.push('delete'); },
  };
  const first = presenter.update(session);
  await entered.promise;
  const queued = presenter.update(session);
  const removal = presenter.remove(session);
  assert.equal(presenter.remove(session), removal);
  assert.equal(requests[0].signal.aborted, true);
  requests[0].resolve({ buffer: Buffer.from('late cover') });
  await presenter.update(session);
  assert.deepEqual(events, ['edit']);
  editing.resolve();
  await Promise.all([first, queued, removal]);
  await presenter.close();
  assert.deepEqual(events, ['edit', 'delete']);
  assert.equal(session.message, null);
});

test('already deleted panel is a successful removal but other Discord errors remain failures', async () => {
  for (const code of [10008, '10008', 50013]) {
    const { presenter, session } = panelFixture();
    let deletes = 0;
    session.message = { async delete() { deletes++; throw Object.assign(new Error('upstream'), { code }); } };
    if (code === 50013) {
      await assert.rejects(presenter.remove(session), error => error instanceof MusicError && error.code === 'MUSIC_PANEL_DELETE');
      await assert.rejects(presenter.remove(session), { code: 'MUSIC_PANEL_DELETE' });
      assert.ok(session.message);
    } else {
      await presenter.remove(session);
      assert.equal(session.message, null);
    }
    assert.equal(deletes, 1);
    await presenter.close();
  }
});

test('slow covers do not delay text updates and progress edits retain the uploaded attachment', async () => {
  const fixture = panelFixture();
  const { presenter, session, requests, edits } = fixture;
  await presenter.update(session);
  assert.equal(edits.length, 1);
  assert.equal(edits[0].files, undefined);
  assert.deepEqual(edits[0].attachments, []);
  assert.equal(requests[0].id, session.current.id);
  await settleCover(fixture, requests[0]);
  const uploads = edits.filter(payload => payload.files);
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].files[0].name, 'cover-1.webp');
  assert.deepEqual(edits.at(-1).attachments, [{ id: '523456789012345678' }]);
  assert.match(JSON.stringify(edits.at(-1).components), /https:\/\/cdn.discordapp.com\/attachments\/\d+\/523456789012345678\/cover-1.webp/);
  session.status = 'paused';
  await presenter.update(session);
  assert.equal(requests.length, 1);
  assert.equal(edits.filter(payload => payload.files).length, 1);
  assert.deepEqual(edits.at(-1).attachments, [{ id: '523456789012345678' }]);
  await presenter.close();
});

test('component-referenced covers are retained when Discord omits them from message attachments', async () => {
  for (const mediaUrl of ['attachment://cover-1.webp',
    'https://cdn.discordapp.com/attachments/123456789012345678/523456789012345678/cover-1.webp']) {
    const fixture = panelFixture();
    const { presenter, session, requests, edits, warnings, failures } = fixture;
    const client = new Client({ intents: [] });
    session.message.edit = async payload => {
      edits.push(payload);
      const returnedComponents = payload.components.map(component => component.toJSON());
      const section = returnedComponents[0].components.find(component => component.type === ComponentType.Section);
      if (section) section.accessory.media = {
        url: mediaUrl, attachment_id: '523456789012345678', content_type: 'image/webp', width: 512, height: 256,
        proxy_url: 'https://media.discordapp.net/attachments/123456789012345678/523456789012345678/cover-1.webp?ex=123&hm=signature',
      };
      // Discord excludes attachments referenced by Components V2 from this array.
      return new Message(client, {
        id: '623456789012345678', channel_id: '123456789012345678',
        author: { id: '723456789012345678', username: 'MusicBot', discriminator: '0000', bot: true },
        timestamp: '2026-10-10T00:00:00.000Z', flags: MessageFlags.IsComponentsV2,
        attachments: [], components: returnedComponents,
      });
    };
    try {
      await presenter.update(session);
      await settleCover(fixture, requests[0]);
      assert.equal(warnings.length, 0, 'a component attachment must not trigger text fallback');
      assert.equal(failures.length, 0);
      assert.match(JSON.stringify(edits.at(-1).components), /https:\/\/(cdn.discordapp.com|media.discordapp.net)\/attachments\/\d+\/523456789012345678\/cover-1.webp/);
      assert.deepEqual(edits.at(-1).attachments, [{ id: '523456789012345678' }]);
      assert.equal(edits.filter(payload => payload.files).length, 1);
    } finally {
      await presenter.close();
      await client.destroy();
    }
  }
});

test('progress refresh preserves the cover when Discord rejects retained attachment filename references', async () => {
  const fixture = panelFixture();
  const { presenter, session, requests, warnings, failures } = fixture;
  const client = new Client({ intents: [] });
  const attachmentId = '523456789012345678';
  const cdnUrl = `https://cdn.discordapp.com/attachments/${GUILD_ID}/${attachmentId}/cover-1.webp`;
  const responses = [];
  const bodies = [];
  function response(components = []) {
    return new Message(client, {
      id: '623456789012345678', channel_id: GUILD_ID,
      author: { id: '723456789012345678', username: 'MusicBot', discriminator: '0000', bot: true },
      timestamp: '2026-10-10T00:00:00.000Z', flags: MessageFlags.IsComponentsV2,
      attachments: [], components,
    });
  }
  session.message = response();
  client.user = session.message.author;
  session.message.edit = async payload => {
    const serialized = MessagePayload.create(session.message, {
      ...payload, attachments: payload.attachments.map(item => ({ ...item })),
    }).resolveBody();
    await serialized.resolveFiles();
    const body = serialized.body;
    bodies.push({ body: structuredClone(body), files: serialized.files });
    const section = body.components[0].components.find(item => item.type === ComponentType.Section);
    if (section) {
      // Captured failure mode: the initial upload succeeds, a filename-only reuse gets 50035.
      if (!serialized.files.length && section.accessory.media.url.startsWith('attachment://')) {
        const error = new Error('Invalid Form Body');
        error.code = 50035;
        throw error;
      }
      if (!serialized.files.length) {
        assert.deepEqual(body.attachments, [{ id: attachmentId }]);
        assert.equal(section.accessory.media.url, cdnUrl, 'reuse the uploaded CDN image without expired signatures');
      }
      section.accessory.media = {
        url: `${cdnUrl}?ex=123&is=456&hm=signature`, attachment_id: attachmentId,
        content_type: 'image/webp', width: 512, height: 256,
      };
    }
    const message = response(body.components);
    responses.push(message);
    return message;
  };
  try {
    await presenter.update(session);
    await settleCover(fixture, requests[0]);
    assert.equal(responses.some(message => message.components[0].components.some(item => item.type === ComponentType.Section)), true,
      'the cover appears on the initial upload');
    for (const [positionSeconds, status] of [[30, 'playing'], [45, 'paused'], [60, 'playing']]) {
      session.positionSeconds = positionSeconds;
      session.status = status;
      await presenter.update(session);
      assert.ok(responses.at(-1).components[0].components.some(item => item.type === ComponentType.Section),
        'the cover stays visible after each progress or pause update');
    }
    assert.equal(warnings.length, 0);
    assert.equal(failures.length, 0);
    assert.equal(bodies.filter(({ files }) => files.length).length, 1);
    assert.equal(bodies.find(({ files }) => files.length).body.components[0].components
      .find(item => item.type === ComponentType.Section).accessory.media.url, 'attachment://cover-1.webp');
    assert.match(JSON.stringify(bodies.at(-1).body.components), /1:00 \/ 3:00/);
    assert.equal(requests.length, 1);
    session.status = 'stopped';
    session.current = null;
    session.controller.abort();
    await presenter.update(session);
    assert.deepEqual(bodies.at(-1).body.attachments, []);
    assert.equal(responses.at(-1).components[0].components.some(item => item.type === ComponentType.Section), false);
  } finally {
    for (const request of requests) request.resolve(null);
    await presenter.close();
    await client.destroy();
  }
});

test('skipping aborts the old cover and a late old response cannot overwrite the new song', async () => {
  const fixture = panelFixture();
  const { presenter, session, requests, edits } = fixture;
  await presenter.update(session);
  session.trackController.abort();
  session.trackController = new AbortController();
  session.current = track(2, { requestedBy: USER_ID });
  session.generation++;
  await presenter.update(session);
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(requests.length, 2);
  await settleCover(fixture, requests[1], Buffer.from('new song cover'));
  await settleCover(fixture, requests[0], Buffer.from('stale cover'));
  const uploads = edits.filter(payload => payload.files);
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].files[0].attachment.toString(), 'new song cover');
  assert.match(JSON.stringify(edits.at(-1).components), /歌曲 2/);
  assert.doesNotMatch(JSON.stringify(edits.at(-1).components), /cover-1.webp/);
  await presenter.close();
});

test('a skip during an in-flight Discord upload ends with the new text and no old attachment', async () => {
  const fixture = panelFixture();
  const { presenter, session, requests, edits } = fixture;
  const uploading = deferred();
  const uploaded = deferred();
  const originalEdit = session.message.edit;
  session.message.edit = async payload => {
    if (payload.files) { uploading.resolve(); await uploaded.promise; }
    return originalEdit(payload);
  };
  await presenter.update(session);
  requests[0].resolve({ buffer: Buffer.from('first cover'), name: 'cover.webp' });
  await uploading.promise;
  session.trackController.abort();
  session.trackController = new AbortController();
  session.current = track(2, { requestedBy: USER_ID });
  session.generation++;
  const refreshing = presenter.update(session);
  uploaded.resolve();
  await refreshing;
  assert.match(JSON.stringify(edits.at(-1).components), /歌曲 2/);
  assert.doesNotMatch(JSON.stringify(edits.at(-1).components), /cover-1.webp/);
  assert.deepEqual(edits.at(-1).attachments, []);
  await settleCover(fixture, requests[1], null);
  await presenter.close();
});

test('each requester uses their own account and logout discards any late cover', async () => {
  const fixture = panelFixture();
  const { presenter, session, requests, edits, accounts } = fixture;
  await presenter.update(session);
  const secondRequests = [];
  const secondUser = '423456789012345678';
  accounts.set(secondUser, { id: 'account-two', library: {
    getCover(id, { signal }) {
      const pending = deferred();
      secondRequests.push({ id, signal, ...pending });
      return pending.promise;
    },
  } });
  session.current = track(1, { requestedBy: secondUser });
  session.generation++;
  await presenter.update(session);
  assert.equal(requests.length, 1);
  assert.equal(secondRequests.length, 1);
  accounts.delete(secondUser);
  presenter.invalidateOwner(session, secondUser);
  assert.equal(secondRequests[0].signal.aborted, true);
  await settleCover(fixture, secondRequests[0]);
  await settleCover(fixture, requests[0]);
  assert.equal(edits.some(payload => payload.files), false);
  assert.deepEqual(edits.at(-1).attachments, []);
  assert.equal(requests.length, 1, 'must not fall back to another listener account');
  await presenter.close();
});

test('stop and shutdown cancel covers and prevent any subsequent cover upload', async () => {
  for (const action of ['stop', 'close']) {
    const fixture = panelFixture();
    const { presenter, session, requests, edits } = fixture;
    await presenter.update(session);
    let closing;
    if (action === 'stop') {
      session.controller.abort();
      session.status = 'stopped';
      session.current = null;
      await presenter.update(session);
    } else closing = presenter.close();
    assert.equal(requests[0].signal.aborted, true);
    await settleCover(fixture, requests[0]);
    await closing;
    assert.equal(edits.some(payload => payload.files), false);
    if (action === 'stop') assert.deepEqual(edits.at(-1).attachments, []);
    await presenter.close();
  }
});

test('skip, logout and stop remove a previously uploaded cover and its retained attachment', async () => {
  for (const action of ['skip', 'logout', 'stop']) {
    const fixture = panelFixture();
    const { presenter, session, requests, accounts, edits } = fixture;
    try {
      await presenter.update(session);
      await settleCover(fixture, requests[0]);
      assert.deepEqual(edits.at(-1).attachments, [{ id: '523456789012345678' }]);
      if (action === 'skip') {
        session.trackController.abort();
        session.trackController = new AbortController();
        session.current = track(2, { requestedBy: USER_ID });
        session.generation++;
      } else if (action === 'logout') {
        accounts.delete(USER_ID);
        presenter.invalidateOwner(session, USER_ID);
      } else {
        session.controller.abort();
        session.status = 'stopped';
        session.current = null;
      }
      await presenter.update(session);
      assert.deepEqual(edits.at(-1).attachments, []);
      assert.equal(edits.at(-1).files, undefined);
      assert.doesNotMatch(JSON.stringify(edits.at(-1).components), /cover-1.webp|cdn.discordapp.com/);
    } finally {
      for (const request of requests) request.resolve(null);
      await presenter.close();
    }
  }
});

test('a missing or rejected cover leaves a working text panel without retrying on every tick', async () => {
  for (const rejected of [false, true]) {
    const fixture = panelFixture();
    const { presenter, session, requests, edits, warnings, failures } = fixture;
    await presenter.update(session);
    if (rejected) {
      requests[0].reject(new MusicError('MUSIC_UNAVAILABLE'));
      await new Promise(resolve => setImmediate(resolve));
    } else await settleCover(fixture, requests[0], null);
    await presenter.update(session);
    assert.equal(edits.some(payload => payload.files), false);
    assert.equal(failures.length, 0);
    assert.equal(requests.length, 1);
    assert.equal(warnings.length, rejected ? 1 : 0);
    if (rejected) assert.equal(warnings[0].stage, 'download');
    await presenter.close();
  }
});

test('a failed attachment upload falls back to text and preserves playback controls', async () => {
  const fixture = panelFixture();
  const { presenter, session, requests, edits, warnings, failures } = fixture;
  const originalEdit = session.message.edit;
  session.message.edit = async payload => {
    if (payload.files) { edits.push(payload); throw new Error('synthetic attachment failure'); }
    return originalEdit(payload);
  };
  await presenter.update(session);
  await settleCover(fixture, requests[0]);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].stage, 'upload');
  assert.equal(failures.length, 0);
  assert.deepEqual(edits.at(-1).attachments, []);
  assert.doesNotMatch(JSON.stringify(edits.at(-1).components), /attachment:\/\//);
  assert.equal(session.status, 'playing');
  assert.equal(requests.length, 1);
  assert.equal(edits.filter(payload => payload.files).length, 1);
  await presenter.close();
});

test('a response without any uploaded cover ID records upload diagnostics and keeps text controls', async () => {
  const fixture = panelFixture();
  const { presenter, session, requests, edits, warnings, failures } = fixture;
  session.message.edit = async payload => {
    edits.push(payload);
    return { attachments: new Collection(), components: [] };
  };
  await presenter.update(session);
  await settleCover(fixture, requests[0]);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].stage, 'upload');
  assert.equal(warnings[0].error.code, 'MUSIC_COVER_ATTACHMENT');
  assert.equal(failures.length, 0);
  assert.equal(edits.at(-1).files, undefined);
  assert.deepEqual(edits.at(-1).attachments, []);
  assert.equal(session.status, 'playing');
  await presenter.close();
});

test('point requests privately report the current queue position', async () => {
  const fixture = makeFixture();
  fixture.session.current = track(9);
  fixture.session.queue = [track(8)];
  fixture.services.manager.enqueue = async (session, item, requestedBy) => {
    session.queue.push({ ...item, requestedBy });
  };
  const browser = await browse(fixture);
  const select = fixture.interaction({ kind: 'select', customId: `musiclib:${browser.id}:enqueue`, values: [track().id] });
  await handleMusicInteraction(select, fixture.services);
  assert.match(noticeText(select), /目前排在第 2 首/);
  assert.ok(lastPayload(select).flags & MessageFlags.Ephemeral);
});

function enableYouTube(fixture, resolve) {
  fixture.youtubeCalls = [];
  fixture.services.youtube = {
    async available() { return true; },
    async getTrack(url, options) {
      fixture.youtubeCalls.push({ url, ...options });
      return resolve ? resolve(url, options) : youtubeItem();
    },
  };
  return fixture;
}

function youtubeItem() {
  return { source: 'youtube', id: 'video000001', title: '影片曲目', artist: '影片頻道', album: 'YouTube', duration: 180, mime: 'audio/webm' };
}

async function youtubeModal(fixture, { customId = 'music:session:youtube', userId = USER_ID } = {}) {
  const button = fixture.interaction({ customId, userId });
  await handleMusicInteraction(button, fixture.services);
  const modal = button.acknowledgements.find(ack => ack.kind === 'showModal')?.payload.toJSON();
  assert.ok(modal, noticeText(button));
  return modal.custom_id;
}

function youtubeSubmit(fixture, customId, userId = USER_ID) {
  return fixture.interaction({ kind: 'modal', customId, userId, fields: { url: 'https://youtu.be/video000001?list=ignored&t=60' } });
}

test('YouTube processing remains visible until completion, then success disappears after five seconds', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const gate = deferred();
  const entered = deferred();
  const fixture = enableYouTube(makeFixture({ loggedIn: false }), () => { entered.resolve(); return gate.promise; });
  const submit = youtubeSubmit(fixture, await youtubeModal(fixture));
  const pending = handleMusicInteraction(submit, fixture.services);
  await entered.promise;
  t.mock.timers.tick(30_000);
  await Promise.resolve();
  assert.equal(submit.acknowledgements.filter(ack => ack.kind === 'deleteReply').length, 0);
  gate.resolve(youtubeItem());
  await pending;
  assert.match(noticeText(submit), /影片曲目.*已交給播放器/);
  t.mock.timers.tick(4999);
  await Promise.resolve();
  assert.equal(submit.acknowledgements.filter(ack => ack.kind === 'deleteReply').length, 0);
  t.mock.timers.tick(1);
  await Promise.resolve();
  assert.deepEqual(submit.acknowledgements.filter(ack => ack.kind === 'deleteReply'), [{ kind: 'deleteReply', id: '@original' }]);
});

test('YouTube failure edits the processing reply instead of adding a message and expires after thirty seconds', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fixture = enableYouTube(makeFixture({ loggedIn: false }), () => { throw new MusicError('MUSIC_YOUTUBE_UNAVAILABLE'); });
  const submit = youtubeSubmit(fixture, await youtubeModal(fixture));
  const editReply = submit.editReply;
  submit.editReply = async payload => { await editReply(payload); submit.replied = true; };
  await handleMusicInteraction(submit, fixture.services);
  assert.equal(submit.acknowledgements.filter(ack => ack.kind === 'followUp').length, 0);
  assert.match(noticeText(submit), /音樂操作未完成/);
  t.mock.timers.tick(29_999);
  await Promise.resolve();
  assert.equal(submit.acknowledgements.filter(ack => ack.kind === 'deleteReply').length, 0);
  t.mock.timers.tick(1);
  await Promise.resolve();
  assert.deepEqual(submit.acknowledgements.at(-1), { kind: 'deleteReply', id: '@original' });
});

test('NAS success and failure delete only their private followup while keeping the library panel', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const failed of [false, true]) {
    const fixture = makeFixture();
    const browser = await browse(fixture);
    if (failed) fixture.services.library.getTrack = async () => { throw new MusicError('MUSIC_NOT_FOUND'); };
    const select = fixture.interaction({ kind: 'select', customId: `musiclib:${browser.id}:enqueue`, values: [track().id] });
    await handleMusicInteraction(select, fixture.services);
    const notice = select.acknowledgements.find(ack => ack.kind === 'followUp');
    assert.ok(notice.payload.flags & MessageFlags.Ephemeral);
    const delay = failed ? 30_000 : 5000;
    t.mock.timers.tick(delay - 1);
    await Promise.resolve();
    assert.equal(select.acknowledgements.filter(ack => ack.kind === 'deleteReply').length, 0);
    t.mock.timers.tick(1);
    await Promise.resolve();
    assert.deepEqual(select.acknowledgements.at(-1), { kind: 'deleteReply', id: notice.id });
    assert.notEqual(notice.id, '@original');
    assert.equal(browser.interaction.acknowledgements.filter(ack => ack.kind === 'deleteReply').length, 0);
  }
});

test('notice cleanup tolerates manual dismissal and safely logs other deletion failures', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const code of [10008, 50013]) {
    const fixture = enableYouTube(makeFixture({ loggedIn: false }));
    const submit = youtubeSubmit(fixture, await youtubeModal(fixture));
    submit.deleteReply = async () => { throw Object.assign(new Error('secret upstream URL'), { code }); };
    await handleMusicInteraction(submit, fixture.services);
    t.mock.timers.tick(5000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await stopMusicPlayback();
  }
  assert.deepEqual(logger.warn.mock.calls.map(call => call.arguments), [['[Music] point notice cleanup failed']]);
});

test('shutdown cancels notice timers and waits for an already running deletion', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fixture = enableYouTube(makeFixture({ loggedIn: false }));
  const submit = youtubeSubmit(fixture, await youtubeModal(fixture));
  const gate = deferred();
  submit.deleteReply = () => gate.promise;
  await handleMusicInteraction(submit, fixture.services);
  t.mock.timers.tick(5000);
  await Promise.resolve();
  let stopped = false;
  const stopping = stopMusicPlayback().then(() => { stopped = true; });
  await Promise.resolve();
  assert.equal(stopped, false);
  gate.resolve();
  await stopping;
  const another = enableYouTube(makeFixture({ loggedIn: false }));
  const queued = youtubeSubmit(another, await youtubeModal(another));
  await handleMusicInteraction(queued, another.services);
  await stopMusicPlayback();
  t.mock.timers.tick(30_000);
  await Promise.resolve();
  assert.equal(queued.acknowledgements.filter(ack => ack.kind === 'deleteReply').length, 0);
});

test('notice timer capacity clears the oldest confirmation early without touching panels', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fixture = makeFixture();
  const browser = await browse(fixture);
  const requests = [];
  for (let index = 0; index < 101; index++) {
    const select = fixture.interaction({ kind: 'select', customId: `musiclib:${browser.id}:enqueue`, values: [track().id] });
    await handleMusicInteraction(select, fixture.services);
    requests.push(select);
  }
  assert.equal(requests[0].acknowledgements.filter(ack => ack.kind === 'deleteReply').length, 1);
  assert.equal(requests.slice(1).flatMap(request => request.acknowledgements.filter(ack => ack.kind === 'deleteReply')).length, 0);
  t.mock.timers.tick(5000);
  await Promise.resolve();
  assert.equal(requests.flatMap(request => request.acknowledgements.filter(ack => ack.kind === 'deleteReply')).length, 101);
  assert.equal(browser.interaction.acknowledgements.filter(ack => ack.kind === 'deleteReply').length, 0);
});

test('YouTube-only entry privately resolves without NAS login, then creates the shared player', async () => {
  const fixture = enableYouTube(makeFixture({ withSession: false, loggedIn: false }));
  fixture.services.config.nasConfigured = false;
  const view = await loginView(fixture);
  const actions = components(lastPayload(view.interaction));
  assert.equal(actions.find(item => item.custom_id?.endsWith(':login')).disabled, true);
  assert.equal(actions.find(item => item.custom_id?.endsWith(':youtube')).disabled, false);
  const modal = await youtubeModal(fixture, { customId: `musicauth:${view.id}:youtube` });
  const submit = youtubeSubmit(fixture, modal);
  fixture.services.youtube.getTrack = async (url, options) => {
    fixture.youtubeCalls.push({ url, ...options });
    assert.equal(submit.ephemeral, true);
    assert.match(noticeText(submit), /正在解析/);
    assert.equal(fixture.calls.connect.length, 0);
    return youtubeItem();
  };
  await handleMusicInteraction(submit, fixture.services);
  assert.equal(fixture.youtubeCalls.length, 1);
  assert.equal(fixture.calls.login.length + fixture.calls.search.length + fixture.calls.getTrack.length, 0);
  assert.equal(fixture.calls.connect.length, 1);
  assert.equal(fixture.calls.send.length, 1);
  assert.deepEqual(fixture.calls.enqueue[0], [fixture.session, youtubeItem(), USER_ID]);
  assert.match(noticeText(submit), /已加入 YouTube/);
  assert.doesNotMatch(JSON.stringify(fixture.calls.send), /youtu\.be|list=ignored/);
});

test('public and private library YouTube entrances preserve NAS and report mixed queue positions', async () => {
  const fixture = enableYouTube(makeFixture());
  const browser = await browse(fixture);
  const modal = await youtubeModal(fixture, { customId: `musiclib:${browser.id}:youtube` });
  fixture.session.current = track();
  fixture.session.queue = [track(2)];
  fixture.services.manager.enqueue = async (session, item, requestedBy) => session.queue.push({ ...item, requestedBy });
  const submit = youtubeSubmit(fixture, modal);
  await handleMusicInteraction(submit, fixture.services);
  assert.deepEqual(fixture.session.queue.map(item => item.source || 'nas'), ['nas', 'youtube']);
  assert.match(noticeText(submit), /第 2 首/);
  assert.equal(fixture.calls.getTrack.length, 0);
});

test('missing YouTube tool offers a safe private notice and leaves NAS working', async () => {
  const fixture = makeFixture({ loggedIn: false });
  fixture.services.youtube = { async available() { return false; }, async getTrack() { assert.fail('missing tool must not parse'); } };
  const view = await loginView(fixture);
  const button = fixture.interaction({ customId: `musicauth:${view.id}:youtube` });
  await handleMusicInteraction(button, fixture.services);
  assert.match(noticeText(button), /工具尚未安裝/);
  assertNoSideEffects(fixture);
  assert.equal(components(lastPayload(view.interaction)).find(item => item.custom_id?.endsWith(':login')).disabled, false);
});

test('YouTube modal owner, guild and nonce guards reject forgery and duplicate submission', async () => {
  const fixture = enableYouTube(makeFixture({ loggedIn: false }));
  const modal = await youtubeModal(fixture);
  for (const scenario of ['owner', 'guild', 'nonce']) {
    const submit = youtubeSubmit(fixture, modal);
    if (scenario === 'owner') submit.user.id = 'other';
    if (scenario === 'guild') submit.guildId = 'other-guild';
    if (scenario === 'nonce') submit.customId = 'musicyoutube:forged:submit';
    await handleMusicInteraction(submit, fixture.services);
    assert.match(noticeText(submit), /面板已失效/);
  }
  assert.equal(fixture.youtubeCalls.length, 0);
  const first = youtubeSubmit(fixture, modal);
  await handleMusicInteraction(first, fixture.services);
  const replay = youtubeSubmit(fixture, modal);
  await handleMusicInteraction(replay, fixture.services);
  assert.equal(fixture.youtubeCalls.length, 1);
  assert.equal(fixture.calls.enqueue.length, 1);
  assert.match(noticeText(replay), /面板已失效/);
});

test('YouTube requests enforce one in-flight per user, two global operations and eight-second cooldown', async () => {
  const gate = deferred();
  const fixture = enableYouTube(makeFixture({ loggedIn: false }), () => gate.promise);
  const firstModal = await youtubeModal(fixture);
  const secondModal = await youtubeModal(fixture, { userId: 'second' });
  const thirdModal = await youtubeModal(fixture, { userId: 'third' });
  const first = handleMusicInteraction(youtubeSubmit(fixture, firstModal), fixture.services);
  const second = handleMusicInteraction(youtubeSubmit(fixture, secondModal, 'second'), fixture.services);
  const third = youtubeSubmit(fixture, thirdModal, 'third');
  await handleMusicInteraction(third, fixture.services);
  assert.match(noticeText(third), /使用上限/);
  const busy = fixture.interaction({ customId: 'music:session:youtube' });
  await handleMusicInteraction(busy, fixture.services);
  assert.match(noticeText(busy), /正在處理/);
  gate.resolve(youtubeItem());
  await Promise.all([first, second]);
  const freshModal = await youtubeModal(fixture);
  const cooldown = youtubeSubmit(fixture, freshModal);
  await handleMusicInteraction(cooldown, fixture.services);
  assert.match(noticeText(cooldown), /正在處理/);
  assert.equal(fixture.youtubeCalls.length, 2);
});

test('manual stop consumes pending YouTube work and late metadata cannot recreate or enqueue', async () => {
  const gate = deferred();
  const entered = deferred();
  const fixture = enableYouTube(makeFixture({ loggedIn: false }), (_url, options) => { entered.resolve(options); return gate.promise; });
  const modal = await youtubeModal(fixture);
  const submit = youtubeSubmit(fixture, modal);
  const pending = handleMusicInteraction(submit, fixture.services);
  const { signal } = await entered.promise;
  fixture.services.manager.control = async (session, action) => {
    assert.equal(action, 'stop');
    assert.equal(signal.aborted, true);
    session.status = 'stopped';
    fixture.session = null;
  };
  await handleMusicInteraction(fixture.interaction({ customId: 'music:session:stop' }), fixture.services);
  gate.resolve(youtubeItem());
  await pending;
  assert.equal(fixture.calls.enqueue.length + fixture.calls.connect.length + fixture.calls.send.length, 0);
  assert.match(noticeText(submit), /已取消/);
});

test('shutdown waits for pending YouTube work and blocks late first-player creation', async () => {
  const gate = deferred();
  const entered = deferred();
  const fixture = enableYouTube(makeFixture({ withSession: false, loggedIn: false }), (_url, options) => { entered.resolve(options); return gate.promise; });
  const view = await loginView(fixture);
  const modal = await youtubeModal(fixture, { customId: `musicauth:${view.id}:youtube` });
  const pending = handleMusicInteraction(youtubeSubmit(fixture, modal), fixture.services);
  const { signal } = await entered.promise;
  let closed = false;
  const shutdown = stopMusicPlayback().then(() => { closed = true; });
  assert.equal(signal.aborted, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closed, false);
  gate.resolve(youtubeItem());
  await Promise.all([pending, shutdown]);
  assert.equal(fixture.calls.enqueue.length + fixture.calls.connect.length + fixture.calls.send.length, 0);
});

test('voice changes during YouTube parsing reject late enqueue and keep NAS queue intact', async () => {
  const gate = deferred();
  const entered = deferred();
  const fixture = enableYouTube(makeFixture(), () => { entered.resolve(); return gate.promise; });
  fixture.session.queue = [track(2)];
  const modal = await youtubeModal(fixture);
  const submit = youtubeSubmit(fixture, modal);
  const pending = handleMusicInteraction(submit, fixture.services);
  await entered.promise;
  fixture.member.voice.channel = { ...fixture.voiceChannel, id: 'another-channel' };
  gate.resolve(youtubeItem());
  await pending;
  assert.equal(fixture.calls.enqueue.length, 0);
  assert.deepEqual(fixture.session.queue, [track(2)]);
  assert.match(noticeText(submit), /語音頻道/);
  assert.equal(submit.acknowledgements.filter(ack => ack.kind === 'followUp').length, 0);
});

test('NAS logout does not invalidate an independent pending YouTube modal or account-free parse', async () => {
  const fixture = enableYouTube(makeFixture());
  const browser = await browse(fixture);
  const accountButton = fixture.interaction({ customId: `musiclib:${browser.id}:account` });
  await handleMusicInteraction(accountButton, fixture.services);
  const authId = components(lastPayload(accountButton)).find(item => item.custom_id?.startsWith('musicauth:')).custom_id.split(':')[1];
  const modal = await youtubeModal(fixture);
  await handleMusicInteraction(fixture.interaction({ customId: `musicauth:${authId}:logout` }), fixture.services);
  const submit = youtubeSubmit(fixture, modal);
  await handleMusicInteraction(submit, fixture.services);
  assert.equal(fixture.calls.logout.length, 1);
  assert.equal(fixture.youtubeCalls.length, 1);
  assert.equal(fixture.calls.enqueue[0][1].source, 'youtube');
});

test('YouTube provider failures preserve the remaining queue and reveal only safe errors', async () => {
  const fixture = enableYouTube(makeFixture({ loggedIn: false }), () => {
    throw new Error('upstream stderr https://secret.invalid/?token=private');
  });
  fixture.session.queue = [track(2)];
  const modal = await youtubeModal(fixture);
  const submit = youtubeSubmit(fixture, modal);
  await handleMusicInteraction(submit, fixture.services);
  assert.equal(fixture.calls.enqueue.length, 0);
  assert.deepEqual(fixture.session.queue, [track(2)]);
  assert.doesNotMatch(noticeText(submit), /secret|stderr|token|private/);
});

test('two first YouTube requests wait for the same voice initialization before publishing or enqueueing', async () => {
  const ready = deferred();
  const entered = deferred();
  const fixture = enableYouTube(makeFixture({ withSession: false, loggedIn: false }));
  const firstView = await loginView(fixture);
  const secondView = await loginView(fixture, 'second');
  const firstModal = await youtubeModal(fixture, { customId: `musicauth:${firstView.id}:youtube` });
  const secondModal = await youtubeModal(fixture, { customId: `musicauth:${secondView.id}:youtube`, userId: 'second' });
  let connections = 0;
  fixture.services.manager.connect = async () => {
    connections++;
    fixture.session = fixture.musicSession;
    fixture.session.status = 'connecting';
    if (connections === 2) entered.resolve();
    await ready.promise;
    fixture.session.status = 'idle';
    return fixture.session;
  };
  const first = handleMusicInteraction(youtubeSubmit(fixture, firstModal), fixture.services);
  const second = handleMusicInteraction(youtubeSubmit(fixture, secondModal, 'second'), fixture.services);
  await entered.promise;
  assert.equal(fixture.calls.send.length + fixture.calls.enqueue.length, 0);
  ready.resolve();
  await Promise.all([first, second]);
  assert.equal(connections, 2);
  assert.equal(fixture.calls.send.length, 1);
  assert.equal(fixture.calls.enqueue.length, 2);
});

test('leaving voice during first connection cleans the unexposed empty player', async () => {
  const ready = deferred();
  const entered = deferred();
  const fixture = enableYouTube(makeFixture({ withSession: false, loggedIn: false }));
  const view = await loginView(fixture);
  const modal = await youtubeModal(fixture, { customId: `musicauth:${view.id}:youtube` });
  fixture.services.manager.connect = async () => {
    fixture.session = fixture.musicSession;
    entered.resolve();
    await ready.promise;
    return fixture.session;
  };
  const submit = youtubeSubmit(fixture, modal);
  const pending = handleMusicInteraction(submit, fixture.services);
  await entered.promise;
  fixture.member.voice.channel = null;
  ready.resolve();
  await pending;
  assert.deepEqual(fixture.calls.stop, [fixture.musicSession]);
  assert.equal(fixture.calls.send.length + fixture.calls.enqueue.length, 0);
  assert.match(noticeText(submit), /語音頻道/);
});

test('stopping during first panel publication deletes the late panel and rejects enqueue', async () => {
  const publication = deferred();
  const entered = deferred();
  const fixture = enableYouTube(makeFixture({ withSession: false, loggedIn: false }));
  fixture.services.panels = new MusicPanelPresenter({ manager: fixture.services.manager, accounts: fixture.services.accounts });
  const view = await loginView(fixture);
  const modal = await youtubeModal(fixture, { customId: `musicauth:${view.id}:youtube` });
  const submit = youtubeSubmit(fixture, modal);
  submit.channel.send = () => { entered.resolve(); return publication.promise; };
  const pending = handleMusicInteraction(submit, fixture.services);
  await entered.promise;
  fixture.services.manager.control = async session => { session.status = 'stopped'; fixture.session = null; };
  await handleMusicInteraction(fixture.interaction({ customId: 'music:session:stop' }), fixture.services);
  const edits = [];
  let deletes = 0;
  publication.resolve({ async edit(payload) { edits.push(payload); }, async delete() { deletes++; } });
  await pending;
  assert.equal(fixture.calls.enqueue.length, 0);
  assert.equal(edits.length, 0);
  assert.equal(deletes, 1);
  assert.equal(fixture.musicSession.message, null);
});

test('manual stop waits for playback cleanup before deleting only its own panel', async () => {
  const fixture = makeFixture();
  const cleanup = deferred();
  const entered = deferred();
  let deletes = 0;
  fixture.musicSession.message = { async delete() { deletes++; } };
  fixture.services.panels = new MusicPanelPresenter({ manager: fixture.services.manager, accounts: fixture.services.accounts });
  fixture.services.manager.control = async (session, action) => {
    assert.equal(action, 'stop');
    session.status = 'stopped';
    fixture.session = null;
    entered.resolve();
    await cleanup.promise;
  };
  const stop = fixture.interaction({ customId: 'music:session:stop' });
  const pending = handleMusicInteraction(stop, fixture.services);
  await entered.promise;
  assert.equal(deletes, 0);
  cleanup.resolve();
  await pending;
  assert.equal(deletes, 1);
  assert.equal(fixture.musicSession.message, null);
  assert.deepEqual(stop.acknowledgements.map(ack => ack.kind), ['deferUpdate']);
  const repeated = fixture.interaction({ customId: 'music:session:stop' });
  await handleMusicInteraction(repeated, fixture.services);
  assert.equal(deletes, 1);
  assert.match(noticeText(repeated), /失效/);
});

test('panel deletion failure reports a private safe notice after stopping playback', async () => {
  const fixture = makeFixture();
  fixture.musicSession.message = { async delete() { throw new Error('sensitive upstream details'); } };
  fixture.services.panels = new MusicPanelPresenter({ manager: fixture.services.manager, accounts: fixture.services.accounts });
  fixture.services.manager.control = async session => { session.status = 'stopped'; fixture.session = null; };
  const stop = fixture.interaction({ customId: 'music:session:stop' });
  await handleMusicInteraction(stop, fixture.services);
  assert.equal(fixture.session, null);
  assert.match(noticeText(stop), /已停止並離開.*無法刪除/);
  assert.doesNotMatch(noticeText(stop), /sensitive/);
  assert.ok(lastPayload(stop).flags & MessageFlags.Ephemeral);
  assert.ok(logger.warn.mock.calls.some(call => call.arguments[0].includes('MUSIC_PANEL_DELETE')));
});

test('a voice session abort cancels pending metadata immediately before its delayed final panel update', async () => {
  const entered = deferred();
  const fixture = enableYouTube(makeFixture({ loggedIn: false }), (_url, { signal }) => {
    entered.resolve(signal);
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new MusicError('MUSIC_ABORTED')), { once: true }));
  });
  fixture.session.controller = new AbortController();
  const modal = await youtubeModal(fixture);
  const submit = youtubeSubmit(fixture, modal);
  const pending = handleMusicInteraction(submit, fixture.services);
  const signal = await entered.promise;
  fixture.session.controller.abort();
  await pending;
  assert.equal(signal.aborted, true);
  assert.equal(fixture.calls.enqueue.length, 0);
  assert.match(noticeText(submit), /已取消/);
});

test('a stopped player final update cannot cancel a replacement player YouTube request', async () => {
  const fixture = makeFixture({ withSession: false, loggedIn: false });
  let manager;
  let index = 0;
  mock.method(MusicYouTubeClient.prototype, 'available', async () => true);
  mock.method(MusicYouTubeClient.prototype, 'getCover', async () => null);
  mock.method(MusicYouTubeClient.prototype, 'getTrack', async () => youtubeItem());
  mock.method(MusicPlaybackManager.prototype, 'connect', async function () {
    manager = this;
    let session = this.getSession(GUILD_ID);
    if (!session) {
      session = { ...fixture.musicSession, id: `runtime-${++index}`, queue: [], generation: 0,
        controller: new AbortController(), message: null, publishPromise: null };
      this.sessions.set(GUILD_ID, session);
    }
    return session;
  });
  const enqueue = mock.method(MusicPlaybackManager.prototype, 'enqueue', async () => {});
  const entry = fixture.interaction({ kind: 'command' });
  await execute(entry);
  const authId = components(lastPayload(entry)).find(item => item.custom_id?.startsWith('musicauth:')).custom_id.split(':')[1];
  async function modal(userId) {
    const button = fixture.interaction({ customId: `musicauth:${authId}:youtube`, userId });
    await handleMusicInteraction(button);
    return button.acknowledgements.find(ack => ack.kind === 'showModal').payload.toJSON().custom_id;
  }
  await handleMusicInteraction(youtubeSubmit(fixture, await modal(USER_ID)));
  const old = manager.getSession(GUILD_ID);
  const oldCleanup = deferred();
  old.cleanupPromise = oldCleanup.promise;
  const stopping = manager.stop(old);
  // A new scoped card belongs to a different user, unaffected by the first cooldown.
  const replacement = fixture.interaction({ kind: 'command', userId: 'replacement' });
  await execute(replacement);
  const replacementId = components(lastPayload(replacement)).find(item => item.custom_id?.startsWith('musicauth:')).custom_id.split(':')[1];
  const button = fixture.interaction({ customId: `musicauth:${replacementId}:youtube`, userId: 'replacement' });
  await handleMusicInteraction(button);
  const newModal = button.acknowledgements.find(ack => ack.kind === 'showModal').payload.toJSON().custom_id;
  const gate = deferred();
  const entered = deferred();
  mock.method(MusicYouTubeClient.prototype, 'getTrack', async (_url, { signal }) => { entered.resolve(signal); return gate.promise; });
  const pending = handleMusicInteraction(youtubeSubmit(fixture, newModal, 'replacement'));
  const signal = await entered.promise;
  oldCleanup.resolve();
  await stopping;
  assert.equal(signal.aborted, false);
  gate.resolve(youtubeItem());
  await pending;
  assert.equal(enqueue.mock.callCount(), 2);
  assert.equal(manager.getSession(GUILD_ID).id, 'runtime-2');
});

test('a modal opened before the player exists binds to the player present at submission', async () => {
  const entered = deferred();
  const fixture = enableYouTube(makeFixture({ withSession: false, loggedIn: false }), (_url, { signal }) => {
    entered.resolve(signal);
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new MusicError('MUSIC_ABORTED')), { once: true }));
  });
  const view = await loginView(fixture);
  const modal = await youtubeModal(fixture, { customId: `musicauth:${view.id}:youtube` });
  fixture.session = fixture.musicSession;
  fixture.session.controller = new AbortController();
  const submit = youtubeSubmit(fixture, modal);
  const pending = handleMusicInteraction(submit, fixture.services);
  const signal = await entered.promise;
  fixture.session.controller.abort();
  await pending;
  assert.equal(signal.aborted, true);
  assert.equal(fixture.calls.enqueue.length + fixture.calls.connect.length, 0);
  assert.match(noticeText(submit), /已取消/);
});

test('YouTube modal storage evicts the oldest of more than one hundred users', async () => {
  const fixture = enableYouTube(makeFixture({ loggedIn: false }));
  const old = await youtubeModal(fixture, { userId: 'listener-0' });
  let newest;
  for (let index = 1; index <= 100; index++) newest = await youtubeModal(fixture, { userId: `listener-${index}` });
  const expired = youtubeSubmit(fixture, old, 'listener-0');
  await handleMusicInteraction(expired, fixture.services);
  assert.match(noticeText(expired), /面板已失效/);
  assert.equal(fixture.youtubeCalls.length, 0);
  await handleMusicInteraction(youtubeSubmit(fixture, newest, 'listener-100'), fixture.services);
  assert.equal(fixture.youtubeCalls.length, 1);
});

test('a user cannot run a second YouTube parse in another guild while the first is in flight', async () => {
  const gate = deferred();
  const entered = deferred();
  const fixture = enableYouTube(makeFixture({ loggedIn: false }), () => { entered.resolve(); return gate.promise; });
  const modal = await youtubeModal(fixture);
  const pending = handleMusicInteraction(youtubeSubmit(fixture, modal), fixture.services);
  await entered.promise;
  const other = fixture.interaction({ customId: 'music:session:youtube' });
  other.guildId = 'other-guild';
  await handleMusicInteraction(other, fixture.services);
  assert.match(noticeText(other), /正在處理/);
  assert.equal(other.acknowledgements.some(ack => ack.kind === 'showModal'), false);
  gate.resolve(youtubeItem());
  await pending;
  assert.equal(fixture.youtubeCalls.length, 1);
});

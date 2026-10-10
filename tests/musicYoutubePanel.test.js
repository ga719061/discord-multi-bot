import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client, ComponentType, Message, MessageFlags, MessagePayload } from 'discord.js';
import { MusicPanelPresenter } from '../src/commands/music/lib/panel.js';

const USER = '123456789012345678';
const GUILD = '223456789012345678';
const ATTACHMENT = '523456789012345678';

function track(source = 'youtube', extra = {}) {
  return { id: source === 'youtube' ? 'abcdefghijk' : '123456781234123412341234567890ab',
    source, title: '合成曲目', artist: '合成作者', album: '合成專輯', duration: 120, requestedBy: USER, ...extra };
}

function fixture() {
  const client = new Client({ intents: [] });
  const requests = [];
  const bodies = [];
  const accountReads = [];
  const warnings = [];
  const failures = [];
  const provider = source => ({ getCover(id, { signal }) {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    requests.push({ source, id, signal, resolve, reject });
    return promise;
  } });
  const account = { id: 'nas-account', library: provider('nas') };
  let loggedIn = true;
  const response = components => new Message(client, {
    id: '623456789012345678', channel_id: GUILD,
    author: { id: '723456789012345678', username: 'MusicBot', discriminator: '0000', bot: true },
    timestamp: '2026-10-10T00:00:00.000Z', flags: MessageFlags.IsComponentsV2, attachments: [], components,
  });
  const message = response([]);
  client.user = message.author;
  message.edit = async payload => {
    const serialized = MessagePayload.create(message, {
      ...payload, attachments: payload.attachments.map(item => ({ ...item })),
    }).resolveBody();
    await serialized.resolveFiles();
    const body = structuredClone(serialized.body);
    bodies.push({ body, files: serialized.files });
    const section = body.components[0].components.find(component => component.type === ComponentType.Section);
    if (section) {
      if (!serialized.files.length) {
        assert.deepEqual(body.attachments, [{ id: ATTACHMENT }]);
        assert.ok(section.accessory.media.url.startsWith('https://cdn.discordapp.com/attachments/'));
      }
      const filename = serialized.files[0]?.name || section.accessory.media.url.split('/').at(-1);
      section.accessory.media = {
        url: `https://cdn.discordapp.com/attachments/${GUILD}/${ATTACHMENT}/${filename}?ex=123&hm=signature`,
        attachment_id: ATTACHMENT, content_type: 'image/webp', width: 512, height: 256,
      };
    }
    return response(body.components);
  };
  const session = { id: 'session', guildId: GUILD, voiceChannelId: USER, generation: 1,
    current: track(), queue: [], loop: 'off', status: 'playing', positionSeconds: 0,
    controller: new AbortController(), trackController: new AbortController(), message };
  const presenter = new MusicPanelPresenter({
    manager: { snapshot: value => ({ ...value }) }, youtube: provider('youtube'),
    accounts: { get: (guildId, userId) => { accountReads.push({ guildId, userId }); return loggedIn ? account : null; } },
    onCoverError: (error, stage) => warnings.push({ error, stage }), onPanelError: value => failures.push(value),
  });
  return { presenter, session, requests, bodies, accountReads, warnings, failures,
    logout() { loggedIn = false; presenter.invalidateOwner(session, USER); },
    async close() { for (const request of requests) request.resolve(null); await presenter.close(); await client.destroy(); } };
}

async function settle(value, request, buffer = Buffer.from('synthetic thumbnail')) {
  request.resolve(buffer ? { buffer, name: 'cover.webp' } : null);
  await new Promise(resolve => setImmediate(resolve));
  await value.presenter.update(value.session);
}

test('YouTube covers work without NAS login and retain the uploaded component attachment after logout', async () => {
  const value = fixture();
  try {
    value.logout();
    await value.presenter.update(value.session);
    assert.equal(value.requests[0].source, 'youtube');
    assert.equal(value.accountReads.length, 0);
    await settle(value, value.requests[0]);
    value.logout();
    for (const position of [15, 30]) {
      value.session.positionSeconds = position;
      await value.presenter.update(value.session);
      assert.deepEqual(value.bodies.at(-1).body.attachments, [{ id: ATTACHMENT }]);
    }
    assert.equal(value.requests[0].signal.aborted, false);
    assert.equal(value.requests.length, 1);
    assert.equal(value.bodies.filter(body => body.files.length).length, 1);
    assert.equal(value.accountReads.length, 0);
    assert.equal(value.warnings.length, 0);
  } finally { await value.close(); }
});

test('mixed-source queues keep only NAS requesters accounts active', async () => {
  const value = fixture();
  try {
    const nasUser = '323456789012345678';
    value.session.queue = [track(), track('nas', { requestedBy: nasUser }), track('nas', { requestedBy: nasUser })];
    await value.presenter.update(value.session);
    assert.deepEqual(value.accountReads, [{ guildId: GUILD, userId: nasUser }]);
    assert.deepEqual(value.requests.map(request => request.source), ['youtube']);
  } finally { await value.close(); }
});

test('source switches cancel old cover requests and reject late YouTube and NAS results', async () => {
  const value = fixture();
  try {
    await value.presenter.update(value.session);
    const youtube = value.requests[0];
    value.session.current = track('nas');
    value.session.generation++;
    await value.presenter.update(value.session);
    assert.equal(youtube.signal.aborted, true);
    const nas = value.requests[1];
    assert.equal(nas.source, 'nas');
    await settle(value, youtube);
    assert.equal(value.bodies.filter(body => body.files.length).length, 0);
    value.session.current = track('youtube', { id: 'lmnopqrstuv' });
    value.session.generation++;
    await value.presenter.update(value.session);
    assert.equal(nas.signal.aborted, true);
    await settle(value, nas);
    assert.equal(value.bodies.filter(body => body.files.length).length, 0);
    await settle(value, value.requests[2]);
    assert.equal(value.bodies.filter(body => body.files.length).length, 1);
    assert.equal(value.bodies.find(body => body.files.length).files[0].name, 'cover-3.webp');
  } finally { await value.close(); }
});

test('NAS logout removes its cover while stopping cancels YouTube cover and removes its attachment', async () => {
  const value = fixture();
  try {
    value.session.current = track('nas');
    await value.presenter.update(value.session);
    await settle(value, value.requests[0]);
    value.logout();
    await value.presenter.update(value.session);
    assert.equal(value.requests[0].signal.aborted, true);
    assert.deepEqual(value.bodies.at(-1).body.attachments, []);
    value.session.current = track();
    value.session.generation++;
    await value.presenter.update(value.session);
    await settle(value, value.requests[1]);
    value.session.status = 'stopped';
    value.session.current = null;
    value.session.controller.abort();
    await value.presenter.update(value.session);
    assert.deepEqual(value.bodies.at(-1).body.attachments, []);
    assert.equal(value.requests[1].signal.aborted, true);
  } finally { await value.close(); }
});

test('YouTube thumbnail failure retains a functional text player and reports download stage', async () => {
  const value = fixture();
  try {
    await value.presenter.update(value.session);
    value.requests[0].reject(new Error('synthetic cover failure'));
    await new Promise(resolve => setImmediate(resolve));
    await value.presenter.update(value.session);
    assert.equal(value.warnings.length, 1);
    assert.equal(value.warnings[0].stage, 'download');
    assert.equal(value.failures.length, 0);
    assert.deepEqual(value.bodies.at(-1).body.attachments, []);
    assert.equal(value.bodies.at(-1).body.components[0].components.some(component => component.type === ComponentType.Section), false);
  } finally { await value.close(); }
});

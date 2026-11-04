import { randomUUID } from 'node:crypto';
import { ChannelType, InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getMusicConfiguration, MusicError } from '../../utils/musicLibrary.js';
import { MusicAccounts } from '../../utils/musicAccounts.js';
import { MusicPlaybackManager } from '../../utils/musicPlayback.js';
import { MusicYouTubeClient } from '../../utils/musicYoutube.js';
import { hasNasMusicInteractionAccess, resolveNasMusicAccess } from '../../utils/musicAccess.js';
import { v2EditPayload, v2Notice } from '../../utils/componentsV2.js';
import { UI_COLORS } from '../../utils/style.js';
import { logger } from '../../utils/logger.js';
import { MusicPanelPresenter } from './lib/panel.js';
import {
  buildMusicLibraryPayload, buildMusicPlayerPayload, buildMusicQueuePayload,
  buildMusicSearchModal, buildMusicLoginPayload, buildMusicLoginModal, buildMusicYouTubeModal,
  buildMusicLauncherPayload,
  buildMusicPointNotice,
} from './lib/ui.js';

export const data = new SlashCommandBuilder()
  .setName('音樂')
  .setDescription('🎵 開啟 YouTube 語音頻道音樂播放器')
  .setContexts(InteractionContextType.Guild);

const browsers = new Map();
const authViews = new Map();
const youtubeViews = new Map();
const youtubeRequests = new Map();
const youtubeAttempts = new Map();
const nasCleanups = new Map();
const pendingNasLogins = new Map();
const noticeTimers = new Map();
const noticeTasks = new Set();
const privateViews = new Map();
const privateTasks = new Set();
let runtime = null;

function rememberPrivateView(view, interaction) {
  const sameKind = [...privateViews.values()].filter(candidate => candidate.kind === view.kind);
  if (sameKind.length >= 100) closePrivateView(sameKind[0]);
  Object.assign(view, { interaction, writes: new Set(), closed: false });
  privateViews.set(view.id, view);
  return view;
}

function refreshPrivateView(view, interaction) {
  if (interaction.message?.id === view.messageId && (interaction.deferred || interaction.replied)) {
    view.interaction = interaction;
  }
}

function writePrivateView(view, interaction, operation) {
  if (view.closed) return Promise.reject(new MusicError('MUSIC_EXPIRED'));
  const task = Promise.resolve().then(operation).then(response => {
    view.messageId ||= response?.resource?.message?.id || response?.id;
    refreshPrivateView(view, interaction);
    return response;
  });
  view.writes.add(task);
  task.then(() => view.writes.delete(task), () => view.writes.delete(task));
  return task;
}

function closePrivateView(view) {
  if (view.closed) return view.cleanup;
  view.closed = true;
  privateViews.delete(view.id);
  if (browsers.get(view.id) === view) browsers.delete(view.id);
  // A reply already being published must settle before deleting it.
  const task = Promise.allSettled([...view.writes]).then(async () => {
    try { await view.interaction.deleteReply(view.messageId || '@original'); }
    catch (error) {
      if (![10008, 10015, 50027].includes(Number(error?.code))) logger.warn('[Music] private view cleanup failed');
    }
  });
  view.cleanup = task;
  privateTasks.add(task);
  task.then(() => privateTasks.delete(task), () => privateTasks.delete(task));
  return task;
}

function closeSessionViews(session) {
  cancelYouTubeRequests(session.guildId, session.id);
  const tasks = [];
  for (const view of privateViews.values()) {
    if (view.guildId === session.guildId && view.sessionId === session.id) tasks.push(closePrivateView(view));
  }
  if (tasks.length) session.privateCleanup = Promise.all([session.privateCleanup, ...tasks]);
  return session.privateCleanup || Promise.resolve();
}

function isPrivateControlMessage(interaction) {
  const flags = interaction.message?.flags;
  const ephemeral = flags?.has ? flags.has(MessageFlags.Ephemeral) : Boolean(Number(flags) & MessageFlags.Ephemeral);
  const [scope, id, action] = interaction.customId.split(':');
  if (!ephemeral || (scope !== 'musiclib' && !(scope === 'music' && ['qprev', 'qnext'].includes(action)))) return false;
  const controlId = scope === 'musiclib' && action === 'search_submit' && interaction.isModalSubmit()
    ? `musiclib:${id}:search` : interaction.customId;
  const matches = component => {
    const data = component.toJSON?.() || component;
    return data.custom_id === controlId || (data.components || []).some(matches);
  };
  return (interaction.message.components || []).some(matches);
}

async function closeExpiredPrivateReply(interaction) {
  const [, id] = interaction.customId.split(':');
  const owner = browsers.get(id)?.ownerId;
  if ((owner && owner !== interaction.user.id) || !isPrivateControlMessage(interaction)) return false;
  if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
  try { await interaction.deleteReply(); }
  catch (error) { if (Number(error?.code) !== 10008) throw error; }
  return true;
}

function scheduleNoticeDeletion(interaction, messageId, delay) {
  const remove = () => {
    clearTimeout(timer);
    noticeTimers.delete(timer);
    const task = Promise.resolve().then(() => interaction.deleteReply(messageId)).catch(error => {
      if (error?.code !== 10008 && error?.code !== '10008') logger.warn('[Music] point notice cleanup failed');
    });
    noticeTasks.add(task);
    task.then(() => noticeTasks.delete(task), () => noticeTasks.delete(task));
  };
  if (noticeTimers.size >= 100) noticeTimers.values().next().value();
  const timer = setTimeout(remove, delay);
  timer.unref?.();
  noticeTimers.set(timer, remove);
}

function isPointSubmission(interaction) {
  return (interaction.commandName === '點播' && Boolean(interaction.options?.getString('連結')?.trim()))
    || /^(?:musicyoutube:[^:]+:submit|musiclib:[^:]+:enqueue)$/.test(interaction.customId || '');
}

function getRuntime(client) {
  if (!runtime) {
    const config = getMusicConfiguration();
    const youtube = new MusicYouTubeClient({
      ytdlpPath: config.ytdlpPath,
      onFailure: ({ stage, origin, exitCode, signal, systemCode, bytes, httpStatus, stderrTags }) => logger.warn(
        `[Music] youtube failed stage=${stage} origin=${origin} exitCode=${exitCode ?? 'NONE'} signal=${signal}`
        + ` systemCode=${systemCode} bytes=${bytes} httpStatus=${httpStatus ?? 'NONE'} stderrTags=${stderrTags}`,
      ),
    });
    let manager;
    let panels;
    const accounts = new MusicAccounts({
      baseUrl: config.baseUrl,
      onCleanupError: () => logger.warn('[Music] account cleanup failed'),
      onLogout(guildId, userId) {
        invalidatePrivateViews(guildId, userId);
        const session = manager.getSession(guildId);
        if (session) panels.invalidateOwner(session, userId);
        return session ? manager.removeUserTracks(session, userId) : Promise.resolve();
      },
    });
    manager = new MusicPlaybackManager({
      ffmpegPath: config.ffmpegPath, onUpdate: updatePanel,
      onStop: session => {
        cancelYouTubeRequests(session.guildId);
        closeSessionViews(session);
      },
      onPlaybackError: ({ stage, code, playedSeconds }) => logger.warn(
        `[Music] playback failed stage=${stage} code=${code} playedSeconds=${playedSeconds.toFixed(2)}`,
      ),
      async resolveLibrary(session, track) {
        if (track.source === 'youtube' || track.source === 'bilibili') return youtube;
        if (nasCleanups.has(`${session.guildId}:${track.requestedBy}`)
          || !await resolveNasMusicAccess(client?.guilds?.cache.get(session.guildId), track.requestedBy)) {
          throw new MusicError('MUSIC_FORBIDDEN');
        }
        const account = accounts.get(session.guildId, track.requestedBy);
        if (!account) throw new MusicError('MUSIC_LOGIN');
        return account.library;
      },
    });
    panels = new MusicPanelPresenter({
      manager, accounts, youtube,
      onCoverError: logCoverFailure,
      onPanelError: session => manager.stop(session),
    });
    runtime = { config, accounts, manager, panels, youtube };
  }
  return runtime;
}

function logCoverFailure(error, stage) {
  const knownCodes = {
    50013: 'DISCORD_MISSING_PERMISSIONS',
    50035: 'DISCORD_INVALID_FORM_BODY',
    MUSIC_COVER_ATTACHMENT: 'MUSIC_COVER_ATTACHMENT',
  };
  const code = error instanceof MusicError ? error.code
    : Object.hasOwn(knownCodes, error?.code ?? '') ? knownCodes[error.code] : 'UNKNOWN';
  logger.warn(`[Music] cover unavailable stage=${stage} code=${code}; using text panel`);
}

export function assertMusicAccess(interaction, config, session = null) {
  if (!interaction.guildId) throw new MusicError('MUSIC_CHANNEL');
  const channel = interaction.member?.voice?.channel;
  if (!channel || channel.type !== ChannelType.GuildVoice
    || (session && channel.id !== session.voiceChannelId)) throw new MusicError('MUSIC_CHANNEL');
  if (!channel.permissionsFor(interaction.member)?.has(PermissionFlagsBits.Connect)) throw new MusicError('MUSIC_CHANNEL');
  if (!channel.permissionsFor(interaction.guild.members.me)?.has([
    PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak,
  ])) throw new MusicError('MUSIC_VOICE');
  return channel;
}

async function updatePanel(session) {
  if (session.status === 'stopped') {
    await closeSessionViews(session);
  }
  if (!session.message || !runtime) return;
  if (session.status === 'stopped' && session.deletePanelOnStop) await runtime.panels.remove(session);
  else await runtime.panels.update(session);
}

async function ensurePanel(interaction, services, session) {
  const { manager } = services;
  session.youtubeAvailable = services.youtubeAvailable === true;
  if (session.message) return;
  if (!session.publishPromise) {
    session.publishPromise = interaction.channel.send(buildMusicPlayerPayload(manager.snapshot(session))).then(async message => {
      session.message = message;
      session.textChannelId = interaction.channelId;
      if (session.status === 'stopped') {
        if (session.deletePanelOnStop) await services.panels.remove(session);
        else await message.edit(v2EditPayload(buildMusicPlayerPayload(manager.snapshot(session))));
      }
    });
  }
  try { await session.publishPromise; }
  catch (error) {
    await manager.stop(session);
    if (error instanceof MusicError && error.code === 'MUSIC_PANEL_DELETE') throw error;
    throw new MusicError('MUSIC_VOICE');
  }
  if (session.status === 'stopped') throw new MusicError('MUSIC_EXPIRED');
  await services.panels?.update(session);
}

function invalidatePrivateViews(guildId, userId) {
  for (const view of pendingNasLogins.values()) {
    if (view.guildId === guildId && view.ownerId === userId) view.cancelled = true;
  }
  for (const views of [browsers, authViews]) {
    for (const [id, view] of views) {
      if (view.guildId === guildId && view.ownerId === userId) views.delete(id);
    }
  }
  for (const view of privateViews.values()) {
    if (view.guildId === guildId && view.ownerId === userId && view.accountId) closePrivateView(view);
  }
}

function accountFor(services, interaction, expectedId) {
  if (!canUseNas(interaction, services) || nasCleanups.has(`${interaction.guildId}:${interaction.user.id}`)) {
    throw new MusicError('MUSIC_FORBIDDEN');
  }
  const account = services.accounts.get(interaction.guildId, interaction.user.id);
  if (!account || (expectedId && account.id !== expectedId)) throw new MusicError('MUSIC_LOGIN');
  return account;
}

function canUseNas(interaction, services) {
  return services.canUseNas ? services.canUseNas(interaction) === true : hasNasMusicInteractionAccess(interaction);
}

async function assertNasAccess(interaction, services, fresh = false) {
  if (services.accounts.closed || services.manager.closed) throw new MusicError('MUSIC_ABORTED');
  if (nasCleanups.has(`${interaction.guildId}:${interaction.user.id}`)) throw new MusicError('MUSIC_BUSY');
  const allowed = services.canUseNas || !fresh
    ? canUseNas(interaction, services)
    : await resolveNasMusicAccess(interaction.guild, interaction.user.id);
  if (!allowed) throw new MusicError('MUSIC_FORBIDDEN');
}

export function getNasMusicAccountStatus(guildId, userId, services = runtime) {
  return Boolean(services?.accounts.get(guildId, userId));
}

export function revokeNasMusicAccess(guildId, userId, services = runtime) {
  if (!services) return Promise.resolve();
  const key = `${guildId}:${userId}`;
  if (nasCleanups.has(key)) return nasCleanups.get(key);
  if (nasCleanups.size >= 100) return Promise.reject(new MusicError('MUSIC_BUSY'));
  invalidatePrivateViews(guildId, userId);
  // Install the barrier before logout invokes synchronous cancellation callbacks.
  const cleanup = Promise.resolve().then(() => services.accounts.logout(guildId, userId));
  nasCleanups.set(key, cleanup);
  cleanup.then(() => nasCleanups.delete(key), () => nasCleanups.delete(key));
  return cleanup;
}

function launcherPayload(interaction, services, playerUrl) {
  const login = loginPayload(interaction, services, false);
  return buildMusicLauncherPayload({ id: login.id, nasAllowed: canUseNas(interaction, services),
    youtubeAvailable: services.youtubeAvailable === true, playerUrl });
}

function sharedPlayerUrl(session) {
  return `https://discord.com/channels/${session.guildId}/${session.textChannelId}/${session.message.id}`;
}

async function openSharedPlayer(interaction, services) {
  const { manager, config } = services;
  const existing = manager.getSession(interaction.guildId);
  const channel = assertMusicAccess(interaction, config, existing);
  const session = await manager.connect(interaction.guild, channel);
  try {
    if (manager.getSession(interaction.guildId) !== session || session.status === 'stopped') throw new MusicError('MUSIC_EXPIRED');
    assertMusicAccess(interaction, config, session);
    await ensurePanel(interaction, services, session);
    if (manager.getSession(interaction.guildId) !== session || session.status === 'stopped') throw new MusicError('MUSIC_EXPIRED');
    assertMusicAccess(interaction, config, session);
    return session;
  } catch (error) {
    // A failed opening must not leave a new voice session without a public control panel.
    if (!existing && !session.message && manager.getSession(interaction.guildId) === session) await manager.stop(session);
    throw error;
  }
}

function loginPayload(interaction, services, render = true) {
  if (!interaction.guildId) throw new MusicError('MUSIC_CHANNEL');
  for (const [id, view] of authViews) {
    if (view.guildId === interaction.guildId && view.ownerId === interaction.user.id) authViews.delete(id);
  }
  if (authViews.size >= 100) authViews.delete(authViews.keys().next().value);
  const account = render || canUseNas(interaction, services)
    ? services.accounts.get(interaction.guildId, interaction.user.id) : null;
  const view = {
    id: randomUUID(), ownerId: interaction.user.id, guildId: interaction.guildId,
    accountId: account?.id || null,
  };
  authViews.set(view.id, view);
  if (!render) return view;
  return buildMusicLoginPayload({ id: view.id, loggedIn: Boolean(account),
    nasConfigured: services.config.nasConfigured !== false, youtubeAvailable: services.youtubeAvailable === true });
}

async function newBrowser(interaction, session, account, services) {
  accountFor(services, interaction, account.id);
  const tracks = await account.library.search();
  await assertNasAccess(interaction, services, true);
  accountFor(services, interaction, account.id);
  if (session.status === 'stopped') throw new MusicError('MUSIC_EXPIRED');
  for (const browser of browsers.values()) {
    const active = services.manager.getSession(browser.guildId);
    if (!active || active.id !== browser.sessionId || active.status === 'stopped') closePrivateView(browser);
  }
  const browser = {
    id: randomUUID(), kind: 'library', ownerId: interaction.user.id, guildId: interaction.guildId,
    sessionId: session.id, accountId: account.id, query: '', tracks, page: 0, busy: false,
    youtubeAvailable: services.youtubeAvailable === true,
  };
  browsers.set(browser.id, browser);
  return rememberPrivateView(browser, interaction);
}

export async function execute(interaction, services) {
  try {
    services ||= getRuntime(interaction.client);
    if (!interaction.guildId) throw new MusicError('MUSIC_CHANNEL');
    const shared = interaction.isChatInputCommand() && interaction.commandName === data.name;
    const initial = shared ? services.manager.getSession(interaction.guildId) : null;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await youtubeAvailable(services);
    if (services.manager.closed || services.accounts.closed) throw new MusicError('MUSIC_ABORTED');
    if (shared && services.manager.getSession(interaction.guildId) !== initial) throw new MusicError('MUSIC_EXPIRED');
    // Help buttons retain their scoped private entry; the slash command opens the shared player immediately.
    const session = shared ? await openSharedPlayer(interaction, services) : null;
    await interaction.editReply(v2EditPayload(launcherPayload(interaction, services, session ? sharedPlayerUrl(session) : undefined)));
  } catch (error) { await replyError(interaction, error); }
}

export async function openPrivateNasMusic(interaction, services) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  let accountId;
  try {
    services ||= getRuntime(interaction.client);
    if (!interaction.guildId) throw new MusicError('MUSIC_CHANNEL');
    await nasCleanups.get(`${interaction.guildId}:${interaction.user.id}`);
    await assertNasAccess(interaction, services, true);
    await youtubeAvailable(services);
    const account = services.accounts.get(interaction.guildId, interaction.user.id);
    if (!account) {
      await interaction.editReply(v2EditPayload(loginPayload(interaction, services)));
      return;
    }
    accountId = account.id;
    await openPlayer(interaction, services);
  } catch (error) { await recoverAccountError(interaction, services, error, accountId); }
}

async function openPlayer(interaction, services, authenticated = false) {
    const { config, manager } = services;
    await assertNasAccess(interaction, services, true);
    const account = accountFor(services, interaction);
    assertMusicAccess(interaction, config, manager.getSession(interaction.guildId));
    if (!authenticated) await account.library.login();
    await assertNasAccess(interaction, services, true);
    accountFor(services, interaction, account.id);
    const channel = assertMusicAccess(interaction, config, manager.getSession(interaction.guildId));
    const session = await manager.connect(interaction.guild, channel);
    await assertNasAccess(interaction, services, true);
    accountFor(services, interaction, account.id);
    assertMusicAccess(interaction, config, session);
    await ensurePanel(interaction, services, session);
    const browser = await newBrowser(interaction, session, account, services);
    await writePrivateView(browser, interaction, () => interaction.editReply(v2EditPayload(buildMusicLibraryPayload(browser))));
}

async function youtubeAvailable(services) {
  if (services.youtubeAvailable === undefined) {
    services.youtubeAvailable = Boolean(await services.youtube?.available());
  }
  return services.youtubeAvailable;
}

function boundedSet(map, key, value) {
  if (!map.has(key) && map.size >= 100) map.delete(map.keys().next().value);
  map.set(key, value);
}

function cancelYouTubeRequests(guildId, sessionId) {
  const matches = view => (!guildId || view.guildId === guildId) && (!sessionId || view.sessionId === sessionId);
  for (const [id, view] of youtubeViews) {
    if (matches(view)) youtubeViews.delete(id);
  }
  for (const request of youtubeRequests.values()) {
    if (matches(request.view)) request.controller.abort();
  }
}

async function createYouTubeView(interaction, services, session = null) {
  const initial = services.manager.getSession(interaction.guildId);
  if (!await youtubeAvailable(services)) throw new MusicError('MUSIC_YOUTUBE_TOOL');
  if (services.manager.closed) throw new MusicError('MUSIC_ABORTED');
  const current = services.manager.getSession(interaction.guildId);
  if (current !== initial || (session && current !== session)) throw new MusicError('MUSIC_EXPIRED');
  const channel = assertMusicAccess(interaction, services.config, current);
  const key = interaction.user.id;
  if (youtubeRequests.has(key)) throw new MusicError('MUSIC_BUSY');
  for (const [id, view] of youtubeViews) {
    if (view.guildId === interaction.guildId && view.ownerId === interaction.user.id) youtubeViews.delete(id);
  }
  const view = { id: randomUUID(), guildId: interaction.guildId, ownerId: interaction.user.id,
    sessionId: current?.id || null, sessionSignal: current?.controller?.signal, voiceChannelId: channel.id };
  return view;
}

async function showYouTubeModal(interaction, services, session = null) {
  const view = await createYouTubeView(interaction, services, session);
  boundedSet(youtubeViews, view.id, view);
  await interaction.showModal(buildMusicYouTubeModal(view.id));
}

function assertYouTubeRequest(request, interaction, services) {
  if (request.signal.aborted) throw new MusicError('MUSIC_ABORTED');
  const session = services.manager.getSession(interaction.guildId);
  if (request.view.sessionId && (!session || session.id !== request.view.sessionId || session.status === 'stopped')) {
    throw new MusicError('MUSIC_EXPIRED');
  }
  const channel = assertMusicAccess(interaction, services.config, session);
  if (channel.id !== request.view.voiceChannelId) throw new MusicError('MUSIC_CHANNEL');
  return { session, channel };
}

async function submitYouTube(interaction, services, id) {
  const view = youtubeViews.get(id);
  if (!view || view.ownerId !== interaction.user.id || view.guildId !== interaction.guildId) throw new MusicError('MUSIC_EXPIRED');
  // Claim before acknowledging or resolving so duplicate submits cannot share a nonce.
  youtubeViews.delete(id);
  await enqueueYouTube(interaction, services, view, interaction.fields.getTextInputValue('url').trim());
}

async function enqueueYouTube(interaction, services, view, url) {
  if (services.youtubeAvailable !== true || !services.youtube) throw new MusicError('MUSIC_YOUTUBE_TOOL');
  const key = view.ownerId;
  if (youtubeRequests.has(key) || Date.now() - (youtubeAttempts.get(key) || 0) < 8000) throw new MusicError('MUSIC_BUSY');
  if (youtubeRequests.size >= 2) throw new MusicError('MUSIC_CAPACITY');
  boundedSet(youtubeAttempts, key, Date.now());
  let finish;
  const request = { view, controller: new AbortController(), done: new Promise(resolve => { finish = resolve; }) };
  request.signal = AbortSignal.any([request.controller.signal, ...(view.sessionSignal ? [view.sessionSignal] : [])]);
  youtubeRequests.set(key, request);
  let createdSession;
  try {
    const initial = assertYouTubeRequest(request, interaction, services).session;
    if (initial) {
      request.view.sessionId = initial.id;
      request.signal = AbortSignal.any([request.signal, ...(initial.controller ? [initial.controller.signal] : [])]);
    }
    if (!interaction.deferred) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply(v2EditPayload(v2Notice('🎵 影片點播', '正在解析影片，請稍候。')));
    assertYouTubeRequest(request, interaction, services);
    const track = await services.youtube.getTrack(url, {
      signal: request.signal,
    });
    let { session, channel } = assertYouTubeRequest(request, interaction, services);
    const existing = session;
    const connecting = services.manager.connect(interaction.guild, channel);
    const selected = services.manager.getSession(interaction.guildId);
    if (!existing) createdSession = selected;
    // Existing connecting sessions also need to finish voice initialization.
    request.view.sessionId ||= selected?.id || null;
    session = await connecting;
    if (!existing) createdSession ||= session;
    request.view.sessionId ||= session.id;
    request.signal = AbortSignal.any([request.signal, ...(session.controller ? [session.controller.signal] : [])]);
    assertYouTubeRequest(request, interaction, services);
    if (session.status === 'stopped' || services.manager.getSession(interaction.guildId) !== session) throw new MusicError('MUSIC_EXPIRED');
    await ensurePanel(interaction, services, session);
    assertYouTubeRequest(request, interaction, services);
    await services.manager.enqueue(session, track, interaction.user.id);
    assertYouTubeRequest(request, interaction, services);
    const position = session.queue.findLastIndex(entry => entry.source === track.source && entry.id === track.id
      && entry.requestedBy === interaction.user.id);
    await interaction.editReply(v2EditPayload(buildMusicPointNotice(track, position)));
    scheduleNoticeDeletion(interaction, '@original', 5000);
  } catch (error) {
    if (createdSession && createdSession.status !== 'stopped'
      && services.manager.getSession(interaction.guildId) === createdSession
      && (request.signal.aborted || (!createdSession.message && !createdSession.current && !createdSession.queue.length))) {
      await services.manager.stop(createdSession);
    }
    throw error instanceof MusicError ? error : new MusicError('MUSIC_YOUTUBE_UNAVAILABLE');
  } finally {
    if (youtubeRequests.get(key) === request) youtubeRequests.delete(key);
    finish();
  }
}

export async function executeYouTubePoint(interaction, services) {
  try {
    services ||= getRuntime(interaction.client);
    const url = interaction.options.getString('連結')?.trim();
    if (!url) {
      await showYouTubeModal(interaction, services);
      return;
    }
    const view = await createYouTubeView(interaction, services);
    await enqueueYouTube(interaction, services, view, url);
  } catch (error) { await replyError(interaction, error); }
}

async function showMusicQueue(interaction, services, session) {
  const payload = buildMusicQueuePayload(services.manager.snapshot(session), 0);
  const view = rememberPrivateView({ id: randomUUID(), kind: 'queue', ownerId: interaction.user.id,
    guildId: session.guildId, sessionId: session.id }, interaction);
  await writePrivateView(view, interaction, () => interaction.deferred
    ? interaction.editReply(v2EditPayload(payload)) : interaction.reply({ ...payload, withResponse: true }));
}

async function controlPlayer(interaction, services, session, action, loopMode) {
  assertMusicAccess(interaction, services.config, session);
  if (services.manager.getSession(interaction.guildId) !== session || session.status === 'stopped') throw new MusicError('MUSIC_EXPIRED');
  if (action === 'stop') cancelYouTubeRequests(interaction.guildId);
  const youtubeCleanup = action === 'stop'
    ? Promise.all([...youtubeRequests.values()].filter(request => request.view.guildId === session.guildId).map(request => request.done))
    : Promise.resolve();
  const privateCleanup = action === 'stop' ? closeSessionViews(session) : Promise.resolve();
  if (action === 'stop') session.deletePanelOnStop = true;
  if (loopMode === undefined) await services.manager.control(session, action);
  else await services.manager.control(session, action, loopMode);
  await Promise.all([privateCleanup, youtubeCleanup]);
  if (action === 'stop' && session.message) await services.panels.remove(session);
}

export async function executePlayerControl(interaction, services) {
  try {
    services ||= getRuntime(interaction.client);
    const session = services.manager.getSession(interaction.guildId);
    if (!session || session.status === 'stopped') throw new MusicError('MUSIC_EXPIRED');
    assertMusicAccess(interaction, services.config, session);
    const command = interaction.options.getSubcommand();
    if (command === '停止') cancelYouTubeRequests(interaction.guildId);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (services.manager.getSession(interaction.guildId) !== session || session.status === 'stopped') throw new MusicError('MUSIC_EXPIRED');
    assertMusicAccess(interaction, services.config, session);
    if (command === '佇列') {
      await showMusicQueue(interaction, services, session);
      return;
    }
    if (command === '現在播放') {
      await youtubeAvailable(services);
      if (services.manager.getSession(interaction.guildId) !== session || session.status === 'stopped') throw new MusicError('MUSIC_EXPIRED');
      assertMusicAccess(interaction, services.config, session);
      await ensurePanel(interaction, services, session);
      if (services.manager.getSession(interaction.guildId) !== session || session.status === 'stopped') throw new MusicError('MUSIC_EXPIRED');
      assertMusicAccess(interaction, services.config, session);
      const view = rememberPrivateView({ id: randomUUID(), kind: 'now', ownerId: interaction.user.id,
        guildId: session.guildId, sessionId: session.id }, interaction);
      await writePrivateView(view, interaction, () => interaction.editReply(v2EditPayload(v2Notice('🎵 共用播放器',
        `[前往共用控制面板](${sharedPlayerUrl(session)})\n同一語音頻道的成員都可以操作，進度會自動更新。`, UI_COLORS.SUCCESS))));
      return;
    }
    const action = { 暫停: 'pause', 繼續: 'resume', 下一首: 'skip', 循環: 'loop', 隨機: 'shuffle', 停止: 'stop' }[command];
    if (!action) throw new MusicError('MUSIC_RESPONSE');
    await controlPlayer(interaction, services, session, action, action === 'loop' ? interaction.options.getString('模式', true) : undefined);
    await interaction.editReply(v2EditPayload(v2Notice('🎵 播放器', `${command}操作已完成。`, UI_COLORS.SUCCESS)));
  } catch (error) { await replyError(interaction, error); }
}

async function handleAuthentication(interaction, services, id, action) {
  const view = authViews.get(id);
  if (!view || view.ownerId !== interaction.user.id || view.guildId !== interaction.guildId) throw new MusicError('MUSIC_EXPIRED');
  if (action === 'youtube' && interaction.isButton()) {
    await showYouTubeModal(interaction, services);
    return;
  }
  if (action === 'nas' && interaction.isButton()) {
    await openPrivateNasMusic(interaction, services);
    return;
  }
  await assertNasAccess(interaction, services);
  if (services.config.nasConfigured === false) throw new MusicError('MUSIC_CONFIG');
  const account = services.accounts.get(interaction.guildId, interaction.user.id);
  if ((account?.id || null) !== view.accountId) throw new MusicError('MUSIC_EXPIRED');
  if (action === 'login' && interaction.isButton() && !account) {
    await interaction.showModal(buildMusicLoginModal(id));
  } else if (action === 'open' && interaction.isButton() && account) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    accountFor(services, interaction, view.accountId);
    await openPlayer(interaction, services);
  } else if (action === 'login_submit' && interaction.isModalSubmit() && !account) {
    authViews.delete(id);
    if (pendingNasLogins.size >= 100) throw new MusicError('MUSIC_CAPACITY');
    pendingNasLogins.set(id, view);
    let accountId;
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (view.cancelled) throw new MusicError('MUSIC_ABORTED');
      await assertNasAccess(interaction, services, true);
      if (view.cancelled) throw new MusicError('MUSIC_ABORTED');
      const loggedIn = await services.accounts.login(interaction.guildId, interaction.user.id, {
        email: interaction.fields.getTextInputValue('email'),
        password: interaction.fields.getTextInputValue('password'),
      });
      accountId = loggedIn.id;
      await assertNasAccess(interaction, services, true);
      await openPlayer(interaction, services, true);
    } catch (error) {
      await recoverAccountError(interaction, services, error, accountId, false);
      if (!view.cancelled && !services.accounts.closed && !services.manager.closed && canUseNas(interaction, services)) {
        await interaction.followUp(loginPayload(interaction, services));
      }
    } finally { pendingNasLogins.delete(id); }
  } else if (action === 'logout' && interaction.isButton()) {
    authViews.delete(id);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if ((services.accounts.get(interaction.guildId, interaction.user.id)?.id || null) !== view.accountId) {
      throw new MusicError('MUSIC_EXPIRED');
    }
    invalidatePrivateViews(interaction.guildId, interaction.user.id);
    await services.accounts.logout(interaction.guildId, interaction.user.id);
    await interaction.editReply(v2EditPayload(loginPayload(interaction, services)));
  } else throw new MusicError('MUSIC_RESPONSE');
}

export async function handleMusicInteraction(interaction, services) {
  const customId = interaction.customId || '';
  if (!['music:', 'musiclib:', 'musicauth:', 'musicyoutube:'].some(prefix => customId.startsWith(prefix))) return false;
  let accountId;
  try {
    services ||= getRuntime(interaction.client);
    const { config, manager } = services;
    const [scope, id, action, page] = customId.split(':');
    if (scope === 'musicyoutube') {
      if (action !== 'submit' || !interaction.isModalSubmit()) throw new MusicError('MUSIC_RESPONSE');
      await submitYouTube(interaction, services, id);
      return true;
    }
    if (scope === 'musicauth') {
      if (action !== 'youtube') accountId = authViews.get(id)?.accountId;
      await handleAuthentication(interaction, services, id, action);
      return true;
    }
    const session = manager.getSession(interaction.guildId);
    if (!session || session.status === 'stopped') throw new MusicError('MUSIC_EXPIRED');
    assertMusicAccess(interaction, config, session);
    if (scope === 'musiclib') {
      const browser = browsers.get(id);
      if (!browser || browser.ownerId !== interaction.user.id || browser.guildId !== interaction.guildId
        || browser.sessionId !== session.id) throw new MusicError('MUSIC_EXPIRED');
      if (action === 'youtube' && interaction.isButton()) {
        await showYouTubeModal(interaction, services, session);
        return true;
      }
      await assertNasAccess(interaction, services);
      const account = accountFor(services, interaction, browser.accountId);
      accountId = account.id;
      if (browser.busy) throw new MusicError('MUSIC_BUSY');
      if (action === 'account' && interaction.isButton()) {
        await interaction.reply(loginPayload(interaction, services));
      } else if (action === 'search' && interaction.isButton()) {
        await interaction.showModal(buildMusicSearchModal(id, browser.query));
      } else if ((action === 'search_submit' && interaction.isModalSubmit())
        || (action === 'latest' && interaction.isButton())) {
        browser.busy = true;
        try {
          await interaction.deferUpdate();
          refreshPrivateView(browser, interaction);
          const query = action === 'latest' ? '' : interaction.fields.getTextInputValue('query').trim().slice(0, 120);
          const tracks = await account.library.search(query);
          await assertNasAccess(interaction, services, true);
          accountFor(services, interaction, browser.accountId);
          if (manager.getSession(interaction.guildId) !== session || session.status === 'stopped'
            || browsers.get(id) !== browser) throw new MusicError('MUSIC_EXPIRED');
          assertMusicAccess(interaction, config, session);
          browser.query = query;
          browser.tracks = tracks;
          browser.page = 0;
          await writePrivateView(browser, interaction, () => interaction.editReply(v2EditPayload(buildMusicLibraryPayload(browser))));
        } finally { browser.busy = false; }
      } else if (['prev', 'next'].includes(action) && interaction.isButton()) {
        browser.page = Math.max(0, Math.min(Math.max(0, Math.ceil(browser.tracks.length / 10) - 1),
          browser.page + (action === 'prev' ? -1 : 1)));
        await writePrivateView(browser, interaction, () => interaction.update({ components: buildMusicLibraryPayload(browser).components }));
      } else if (action === 'enqueue' && interaction.isStringSelectMenu()) {
        const track = browser.tracks.find(entry => entry.id === interaction.values[0]);
        if (!track) throw new MusicError('MUSIC_RESPONSE');
        browser.busy = true;
        try {
          await interaction.deferUpdate();
          refreshPrivateView(browser, interaction);
          const freshTrack = await account.library.getTrack(track.id);
          await assertNasAccess(interaction, services, true);
          accountFor(services, interaction, browser.accountId);
          if (manager.getSession(interaction.guildId) !== session || session.status === 'stopped'
            || browsers.get(id) !== browser) throw new MusicError('MUSIC_EXPIRED');
          assertMusicAccess(interaction, config, session);
          await manager.enqueue(session, freshTrack, interaction.user.id);
          const position = session.queue.findLastIndex(entry => entry.id === freshTrack.id
            && entry.requestedBy === interaction.user.id);
          const notice = await interaction.followUp(buildMusicPointNotice(freshTrack, position));
          scheduleNoticeDeletion(interaction, notice.id, 5000);
        } finally { browser.busy = false; }
      } else throw new MusicError('MUSIC_RESPONSE');
    } else {
      if (session.id !== id) throw new MusicError('MUSIC_EXPIRED');
      if (action === 'youtube' && interaction.isButton()) {
        await showYouTubeModal(interaction, services, session);
      } else if (action === 'browse' && interaction.isButton()) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await youtubeAvailable(services);
        if (canUseNas(interaction, services) && services.accounts.get(interaction.guildId, interaction.user.id)) {
          await assertNasAccess(interaction, services, true);
          const account = accountFor(services, interaction);
          accountId = account.id;
          const browser = await newBrowser(interaction, session, account, services);
          await writePrivateView(browser, interaction, () => interaction.editReply(v2EditPayload(buildMusicLibraryPayload(browser))));
        } else await interaction.editReply(v2EditPayload(launcherPayload(interaction, services)));
      } else if (['volume', 'volume_submit'].includes(action)) {
        await interaction.reply(v2Notice('🔊 音量由你控制', '請使用 Discord 的個人音量設定調整自己聽到的音量。'));
      } else if (['queue', 'qprev', 'qnext'].includes(action) && interaction.isButton()) {
        if (action === 'queue') {
          await showMusicQueue(interaction, services, session);
        } else {
          const payload = buildMusicQueuePayload(manager.snapshot(session), Number(page) || 0);
          let view = [...privateViews.values()].find(candidate => candidate.sessionId === session.id
            && candidate.guildId === session.guildId && candidate.ownerId === interaction.user.id
            && candidate.messageId === interaction.message?.id && candidate.kind === 'queue');
          if (!view && isPrivateControlMessage(interaction)) {
            view = rememberPrivateView({ id: randomUUID(), kind: 'queue', ownerId: interaction.user.id,
              guildId: session.guildId, sessionId: session.id, messageId: interaction.message.id }, interaction);
          }
          if (view) await writePrivateView(view, interaction, () => interaction.update({ components: payload.components }));
          else await interaction.update({ components: payload.components });
        }
      } else if (['pause', 'resume', 'skip', 'loop', 'shuffle', 'stop'].includes(action) && interaction.isButton()) {
        if (action === 'stop') cancelYouTubeRequests(interaction.guildId);
        await interaction.deferUpdate();
        await controlPlayer(interaction, services, session, action);
      } else throw new MusicError('MUSIC_RESPONSE');
    }
  } catch (error) {
    if (error instanceof MusicError && error.code === 'MUSIC_EXPIRED') {
      try { if (await closeExpiredPrivateReply(interaction)) return true; }
      catch { logger.warn('[Music] expired private view cleanup failed'); }
    }
    await recoverAccountError(interaction, services, error, accountId);
  }
  return true;
}

async function recoverAccountError(interaction, services, error, accountId, offerLogin = true) {
  if (services && error instanceof MusicError && error.code === 'MUSIC_FORBIDDEN') {
    try { await revokeNasMusicAccess(interaction.guildId, interaction.user.id, services); }
    catch { logger.warn('[Music] NAS access cleanup failed'); }
  }
  if (error instanceof MusicError && error.code === 'MUSIC_AUTH' && accountId
    && services.accounts.get(interaction.guildId, interaction.user.id)?.id === accountId) {
    invalidatePrivateViews(interaction.guildId, interaction.user.id);
    await services.accounts.logout(interaction.guildId, interaction.user.id);
  }
  await replyError(interaction, error);
  if (offerLogin && services && interaction.guildId && canUseNas(interaction, services) && error instanceof MusicError
    && (['MUSIC_AUTH', 'MUSIC_LOGIN'].includes(error.code)
      || (accountId && ['MUSIC_CHANNEL', 'MUSIC_VOICE'].includes(error.code)))) {
    await interaction.followUp(loginPayload(interaction, services));
  }
}

async function replyError(interaction, error) {
  const safeError = error instanceof MusicError ? error : new MusicError('MUSIC_UNAVAILABLE');
  logger.warn(`[Music] operation failed code=${safeError.code}`);
  const notice = v2Notice('🎵 音樂操作未完成', safeError.message, UI_COLORS.WARNING);
  try {
    let messageId = '@original';
    if ((interaction.customId?.startsWith('musicyoutube:') || interaction.commandName === '點播') && (interaction.replied || interaction.deferred)) {
      await interaction.editReply(v2EditPayload(notice));
    } else if (interaction.replied || (interaction.deferred && !interaction.isChatInputCommand() && !interaction.ephemeral)) {
      const message = await interaction.followUp(notice);
      messageId = message?.id;
    } else if (interaction.deferred) await interaction.editReply(v2EditPayload(notice));
    else await interaction.reply(notice);
    if (isPointSubmission(interaction) && messageId) scheduleNoticeDeletion(interaction, messageId, 30000);
  } catch { logger.warn('[Music] acknowledgement failed'); }
}

export function handleMusicVoiceState(_oldState, newState, services = runtime) {
  if (!services) return;
  const session = services.manager.getSession(newState.guild.id);
  if (!session) return;
  if (newState.id === newState.client.user.id && newState.channelId !== session.voiceChannelId) {
    cancelYouTubeRequests(session.guildId);
    const cleanup = closeSessionViews(session);
    return Promise.all([services.manager.stop(session), cleanup]);
  }
}

export async function handleMusicMessageDelete(message, services = runtime) {
  if (!services || !message.guildId) return;
  const session = services.manager.getSession(message.guildId);
  if (!session?.message || session.guildId !== message.guildId
    || session.message.id !== message.id || session.textChannelId !== message.channelId) return;
  session.deletePanelOnStop = true;
  cancelYouTubeRequests(session.guildId);
  const cleanup = closeSessionViews(session);
  try { await services.manager.stop(session); await services.panels.remove(session); }
  catch { logger.warn('[Music] deleted player cleanup failed'); }
  finally { await cleanup; }
}

export async function handleMusicMessageDeleteBulk(messages, _channel, services = runtime) {
  await Promise.all([...messages.values()].map(message => handleMusicMessageDelete(message, services)));
}

export async function stopMusicPlayback() {
  for (const view of pendingNasLogins.values()) view.cancelled = true;
  cancelYouTubeRequests();
  for (const view of privateViews.values()) closePrivateView(view);
  const pending = [...youtubeRequests.values()].map(request => request.done);
  try {
    if (runtime) {
      try { await runtime.manager.close(); }
      finally {
        try { await runtime.panels.close(); }
        finally {
          try { await runtime.accounts.close(); }
          finally { await runtime.youtube.close(); }
        }
      }
    }
  } finally {
    await Promise.all(pending);
    await Promise.allSettled([...nasCleanups.values()]);
    for (const timer of noticeTimers.keys()) clearTimeout(timer);
    noticeTimers.clear();
    await Promise.allSettled([...noticeTasks]);
    await Promise.allSettled([...privateTasks]);
    runtime = null;
    browsers.clear();
    authViews.clear();
    youtubeViews.clear();
    youtubeAttempts.clear();
    pendingNasLogins.clear();
  }
}

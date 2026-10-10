import { randomUUID } from 'node:crypto';
import { ChannelType, InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getMusicConfiguration, MusicError } from '../../utils/musicLibrary.js';
import { MusicAccounts } from '../../utils/musicAccounts.js';
import { MusicPlaybackManager } from '../../utils/musicPlayback.js';
import { MusicYouTubeClient } from '../../utils/musicYoutube.js';
import { v2EditPayload, v2Notice } from '../../utils/componentsV2.js';
import { UI_COLORS } from '../../utils/style.js';
import { logger } from '../../utils/logger.js';
import { MusicPanelPresenter } from './lib/panel.js';
import {
  buildMusicLibraryPayload, buildMusicPlayerPayload, buildMusicQueuePayload,
  buildMusicSearchModal, buildMusicLoginPayload, buildMusicLoginModal, buildMusicYouTubeModal,
} from './lib/ui.js';

export const data = new SlashCommandBuilder()
  .setName('音樂')
  .setDescription('🎵 開啟 NAS／YouTube 語音頻道音樂播放器')
  .setContexts(InteractionContextType.Guild);

const browsers = new Map();
const authViews = new Map();
const youtubeViews = new Map();
const youtubeRequests = new Map();
const youtubeAttempts = new Map();
let runtime = null;

function getRuntime() {
  if (!runtime) {
    const config = getMusicConfiguration();
    const youtube = new MusicYouTubeClient({ ytdlpPath: config.ytdlpPath });
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
      onStop: session => cancelYouTubeRequests(session.guildId),
      onPlaybackError: ({ stage, code, playedSeconds }) => logger.warn(
        `[Music] playback failed stage=${stage} code=${code} playedSeconds=${playedSeconds.toFixed(2)}`,
      ),
      resolveLibrary(session, track) {
        if (track.source === 'youtube') return youtube;
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
    cancelYouTubeRequests(session.guildId, session.id);
    for (const [id, browser] of browsers) {
      if (browser.guildId === session.guildId && browser.sessionId === session.id) browsers.delete(id);
    }
  }
  if (!session.message || !runtime) return;
  await runtime.panels.update(session);
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
        await message.edit(v2EditPayload(buildMusicPlayerPayload(manager.snapshot(session))));
      }
    });
  }
  try { await session.publishPromise; }
  catch { await manager.stop(session); throw new MusicError('MUSIC_VOICE'); }
  if (session.status === 'stopped') throw new MusicError('MUSIC_EXPIRED');
  await services.panels?.update(session);
}

function invalidatePrivateViews(guildId, userId) {
  for (const views of [browsers, authViews]) {
    for (const [id, view] of views) {
      if (view.guildId === guildId && view.ownerId === userId) views.delete(id);
    }
  }
}

function accountFor(services, interaction, expectedId) {
  const account = services.accounts.get(interaction.guildId, interaction.user.id);
  if (!account || (expectedId && account.id !== expectedId)) throw new MusicError('MUSIC_LOGIN');
  return account;
}

function loginPayload(interaction, services) {
  if (!interaction.guildId) throw new MusicError('MUSIC_CHANNEL');
  for (const [id, view] of authViews) {
    if (view.guildId === interaction.guildId && view.ownerId === interaction.user.id) authViews.delete(id);
  }
  if (authViews.size >= 100) authViews.delete(authViews.keys().next().value);
  const account = services.accounts.get(interaction.guildId, interaction.user.id);
  const view = {
    id: randomUUID(), ownerId: interaction.user.id, guildId: interaction.guildId,
    accountId: account?.id || null,
  };
  authViews.set(view.id, view);
  return buildMusicLoginPayload({ id: view.id, loggedIn: Boolean(account),
    nasConfigured: services.config.nasConfigured !== false, youtubeAvailable: services.youtubeAvailable === true });
}

async function newBrowser(interaction, session, account, services) {
  accountFor(services, interaction, account.id);
  const tracks = await account.library.search();
  accountFor(services, interaction, account.id);
  if (session.status === 'stopped') throw new MusicError('MUSIC_EXPIRED');
  for (const [id, browser] of browsers) {
    const active = services.manager.getSession(browser.guildId);
    if (!active || active.id !== browser.sessionId || active.status === 'stopped') browsers.delete(id);
  }
  if (browsers.size >= 100) browsers.delete(browsers.keys().next().value);
  const browser = {
    id: randomUUID(), ownerId: interaction.user.id, guildId: interaction.guildId,
    sessionId: session.id, accountId: account.id, query: '', tracks, page: 0, busy: false,
    youtubeAvailable: services.youtubeAvailable === true,
  };
  browsers.set(browser.id, browser);
  return browser;
}

export async function execute(interaction, services) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  let accountId;
  try {
    services ||= getRuntime();
    if (!interaction.guildId) throw new MusicError('MUSIC_CHANNEL');
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
    const account = accountFor(services, interaction);
    assertMusicAccess(interaction, config, manager.getSession(interaction.guildId));
    if (!authenticated) await account.library.login();
    accountFor(services, interaction, account.id);
    const channel = assertMusicAccess(interaction, config, manager.getSession(interaction.guildId));
    const session = await manager.connect(interaction.guild, channel);
    accountFor(services, interaction, account.id);
    assertMusicAccess(interaction, config, session);
    await ensurePanel(interaction, services, session);
    const browser = await newBrowser(interaction, session, account, services);
    await interaction.editReply(v2EditPayload(buildMusicLibraryPayload(browser)));
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

async function showYouTubeModal(interaction, services, session = null) {
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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply(v2EditPayload(v2Notice('🎵 YouTube 點播', '正在解析影片，請稍候。')));
    assertYouTubeRequest(request, interaction, services);
    const track = await services.youtube.getTrack(interaction.fields.getTextInputValue('url').trim(), {
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
    const position = session.queue.findLastIndex(entry => entry.source === 'youtube' && entry.id === track.id
      && entry.requestedBy === interaction.user.id);
    const title = String(track.title).replace(/([\\`*_~|<>])/g, '\\$1').slice(0, 300);
    await interaction.editReply(v2EditPayload(v2Notice('🎵 已加入 YouTube 點播',
      `**${title}**\n${position >= 0 ? `目前排在第 ${position + 1} 首。` : '已交給播放器。'}`, UI_COLORS.SUCCESS)));
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

async function handleAuthentication(interaction, services, id, action) {
  const view = authViews.get(id);
  if (!view || view.ownerId !== interaction.user.id || view.guildId !== interaction.guildId) throw new MusicError('MUSIC_EXPIRED');
  if (action === 'youtube' && interaction.isButton()) {
    await showYouTubeModal(interaction, services);
    return;
  }
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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    let accountId;
    try {
      const loggedIn = await services.accounts.login(interaction.guildId, interaction.user.id, {
        email: interaction.fields.getTextInputValue('email'),
        password: interaction.fields.getTextInputValue('password'),
      });
      accountId = loggedIn.id;
      await openPlayer(interaction, services, true);
    } catch (error) {
      await recoverAccountError(interaction, services, error, accountId, false);
      await interaction.followUp(loginPayload(interaction, services));
    }
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
    services ||= getRuntime();
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
      const account = accountFor(services, interaction, browser.accountId);
      accountId = account.id;
      if (browser.busy) throw new MusicError('MUSIC_BUSY');
      if (action === 'account' && interaction.isButton()) {
        await interaction.reply(loginPayload(interaction, services));
      } else if (action === 'search' && interaction.isButton()) {
        await interaction.showModal(buildMusicSearchModal(id));
      } else if (action === 'search_submit' && interaction.isModalSubmit()) {
        browser.busy = true;
        try {
          await interaction.deferUpdate();
          browser.query = interaction.fields.getTextInputValue('query').trim().slice(0, 120);
          const tracks = await account.library.search(browser.query);
          accountFor(services, interaction, browser.accountId);
          assertMusicAccess(interaction, config, session);
          browser.tracks = tracks;
          browser.page = 0;
          await interaction.editReply(v2EditPayload(buildMusicLibraryPayload(browser)));
        } finally { browser.busy = false; }
      } else if (['prev', 'next'].includes(action) && interaction.isButton()) {
        browser.page = Math.max(0, Math.min(Math.max(0, Math.ceil(browser.tracks.length / 10) - 1),
          browser.page + (action === 'prev' ? -1 : 1)));
        await interaction.update({ components: buildMusicLibraryPayload(browser).components });
      } else if (action === 'enqueue' && interaction.isStringSelectMenu()) {
        const track = browser.tracks.find(entry => entry.id === interaction.values[0]);
        if (!track) throw new MusicError('MUSIC_RESPONSE');
        browser.busy = true;
        try {
          await interaction.deferUpdate();
          const freshTrack = await account.library.getTrack(track.id);
          accountFor(services, interaction, browser.accountId);
          assertMusicAccess(interaction, config, session);
          await manager.enqueue(session, freshTrack, interaction.user.id);
          const position = session.queue.findLastIndex(entry => entry.id === freshTrack.id
            && entry.requestedBy === interaction.user.id);
          await interaction.followUp(v2Notice('🎵 已加入點播', position >= 0
            ? `已加入待播佇列，目前排在第 ${position + 1} 首。播放狀態請看頻道內的音樂面板。`
            : '已交給播放器，播放狀態請看頻道內的音樂面板。', UI_COLORS.SUCCESS));
        } finally { browser.busy = false; }
      } else throw new MusicError('MUSIC_RESPONSE');
    } else {
      if (session.id !== id) throw new MusicError('MUSIC_EXPIRED');
      if (action === 'youtube' && interaction.isButton()) {
        await showYouTubeModal(interaction, services, session);
      } else if (action === 'browse' && interaction.isButton()) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const account = services.accounts.get(interaction.guildId, interaction.user.id);
        if (!account) {
          await interaction.editReply(v2EditPayload(loginPayload(interaction, services)));
          return true;
        }
        accountId = account.id;
        const browser = await newBrowser(interaction, session, account, services);
        await interaction.editReply(v2EditPayload(buildMusicLibraryPayload(browser)));
      } else if (['volume', 'volume_submit'].includes(action)) {
        await interaction.reply(v2Notice('🔊 音量由你控制', '請使用 Discord 的個人音量設定調整自己聽到的音量。'));
      } else if (['queue', 'qprev', 'qnext'].includes(action) && interaction.isButton()) {
        const payload = buildMusicQueuePayload(manager.snapshot(session), Number(page) || 0);
        if (action === 'queue') await interaction.reply(payload);
        else await interaction.update({ components: payload.components });
      } else if (['pause', 'resume', 'skip', 'loop', 'shuffle', 'stop'].includes(action) && interaction.isButton()) {
        if (action === 'stop') cancelYouTubeRequests(interaction.guildId);
        await interaction.deferUpdate();
        assertMusicAccess(interaction, config, session);
        await manager.control(session, action);
      } else throw new MusicError('MUSIC_RESPONSE');
    }
  } catch (error) { await recoverAccountError(interaction, services, error, accountId); }
  return true;
}

async function recoverAccountError(interaction, services, error, accountId, offerLogin = true) {
  if (error instanceof MusicError && error.code === 'MUSIC_AUTH' && accountId
    && services.accounts.get(interaction.guildId, interaction.user.id)?.id === accountId) {
    invalidatePrivateViews(interaction.guildId, interaction.user.id);
    await services.accounts.logout(interaction.guildId, interaction.user.id);
  }
  await replyError(interaction, error);
  if (offerLogin && services && interaction.guildId && error instanceof MusicError
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
    if (interaction.replied) await interaction.followUp(notice);
    else if (interaction.deferred && (interaction.isChatInputCommand() || interaction.ephemeral)) await interaction.editReply(v2EditPayload(notice));
    else if (interaction.deferred) await interaction.followUp(notice);
    else await interaction.reply(notice);
  } catch { logger.warn('[Music] acknowledgement failed'); }
}

export function handleMusicVoiceState(_oldState, newState, services = runtime) {
  if (!services) return;
  const session = services.manager.getSession(newState.guild.id);
  if (!session) return;
  if (newState.id === newState.client.user.id && newState.channelId !== session.voiceChannelId) {
    cancelYouTubeRequests(newState.guild.id);
    services.manager.stop(session);
  }
}

export async function stopMusicPlayback() {
  cancelYouTubeRequests();
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
    runtime = null;
    browsers.clear();
    authViews.clear();
    youtubeViews.clear();
    youtubeAttempts.clear();
  }
}

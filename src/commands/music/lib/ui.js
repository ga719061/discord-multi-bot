import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  SectionBuilder,
  StringSelectMenuBuilder,
  ThumbnailBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { ephemeralV2Payload, v2Divider, v2Panel, v2Payload, v2Text } from '../../../utils/componentsV2.js';
import { ansiRows, UI_COLORS } from '../../../utils/style.js';

const PAGE_SIZE = 10;
const LIBRARY_LIMIT = 100;
const STATUS_LABELS = {
  connecting: '連線中',
  loading: '載入中',
  playing: '播放中',
  paused: '已暫停',
  idle: '等待點歌',
  stopped: '已停止',
};
const LOOP_LABELS = { off: '關閉', track: '單曲循環', queue: '佇列循環' };

export function normalizeMusicCoverUrl(value) {
  if (typeof value !== 'string') return null;
  if (/^attachment:\/\/[A-Za-z0-9_.-]{1,128}$/.test(value)) return value;
  const cdn = value.match(/^https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/attachments\/\d{17,20}\/\d{17,20}\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}(?:\?[^#\s]*)?$/);
  // Discord refreshes unsigned attachment CDN URLs supplied to message components.
  return cdn ? value.split('?')[0] : null;
}

export function buildMusicLoginPayload({ id, loggedIn = false, nasConfigured = true, youtubeAvailable = true }) {
  const panel = v2Panel(UI_COLORS.ROYAL)
    .addTextDisplayComponents(v2Text([
      '### 🎵 吉吉王國・音樂帳號',
      '-# 私人畫面',
    ].join('\n')))
    .addSeparatorComponents(v2Divider())
    .addTextDisplayComponents(v2Text(musicSummary([
      { label: '帳號', value: loggedIn ? '已登入' : '尚未登入', tone: loggedIn ? 'success' : 'warning' },
      { label: 'NAS', value: nasConfigured ? '可用' : '未設定', tone: nasConfigured ? 'success' : 'warning' },
      { label: 'YouTube', value: youtubeAvailable ? '可用' : '無法使用', tone: youtubeAvailable ? 'success' : 'warning' },
    ])))
    .addTextDisplayComponents(v2Text([
      loggedIn ? '使用自己的帳號搜尋與點播 NAS 歌曲。' : '請使用自己的 NAS 音樂庫帳號登入；每位成員各自登入。',
      loggedIn ? '請先加入一般語音頻道，再點「開啟音樂播放器」。' : '請先加入一般語音頻道，再選擇點播來源。',
      'YouTube 點播不需要 NAS 登入。',
      !nasConfigured ? 'NAS 曲庫尚未設定，請管理員設定 MUSIC_API_BASE_URL。' : '',
      !youtubeAvailable ? 'YouTube 工具尚未安裝或無法使用；NAS 曲庫仍可使用。' : '',
    ].filter(Boolean).join('\n')))
    .addTextDisplayComponents(v2Text([
      '-# 帳密與登入狀態只留在 bot 記憶體，不寫入資料庫；bot 重啟後需重新登入。',
      '-# Discord 密碼輸入框不支援遮罩，輸入時請留意螢幕分享與截圖。',
    ].filter(Boolean).join('\n')));
  const actions = new ActionRowBuilder();
  if (loggedIn) actions.addComponents(
    button(`musicauth:${id}:open`, '開啟音樂播放器', ButtonStyle.Primary, !nasConfigured, '📻'),
  );
  actions.addComponents(button(`musicauth:${id}:${loggedIn ? 'logout' : 'login'}`,
    loggedIn ? '登出音樂帳號' : '登入音樂庫', loggedIn ? ButtonStyle.Secondary : ButtonStyle.Primary, !loggedIn && !nasConfigured, loggedIn ? '🚪' : '🔑'));
  panel.addActionRowComponents(
    actions,
    new ActionRowBuilder().addComponents(button(`musicauth:${id}:youtube`, 'YouTube 點播', ButtonStyle.Secondary, !youtubeAvailable, '📺')),
  );
  return ephemeralV2Payload([panel]);
}

export function buildMusicYouTubeModal(id) {
  return new ModalBuilder()
    .setCustomId(`musicyoutube:${id}:submit`)
    .setTitle('YouTube 點播')
    .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder()
      .setCustomId('url')
      .setLabel('YouTube 影片或單曲連結')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('貼上影片、Shorts 或 YouTube Music 單曲連結')
      .setMinLength(1)
      .setMaxLength(2048)
      .setRequired(true)));
}

export function buildMusicLoginModal(id) {
  return new ModalBuilder()
    .setCustomId(`musicauth:${id}:login_submit`)
    .setTitle('登入私人 NAS 音樂庫')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder()
        .setCustomId('email')
        .setLabel('音樂庫帳號（Email）')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('請輸入自己的音樂庫帳號')
        .setMinLength(1)
        .setMaxLength(254)
        .setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder()
        .setCustomId('password')
        .setLabel('音樂庫密碼（不支援遮罩）')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('輸入時請留意螢幕分享與截圖')
        .setMinLength(1)
        .setMaxLength(256)
        .setRequired(true)),
    );
}

export function buildMusicPlayerPayload(state, { thumbnail } = {}) {
  const coverUrl = normalizeMusicCoverUrl(thumbnail);
  const stopped = state.status === 'stopped';
  const queue = Array.isArray(state.queue) ? state.queue : [];
  const current = state.current;
  const duration = positiveSeconds(current?.duration);
  const position = duration
    ? Math.min(duration, positiveSeconds(state.positionSeconds))
    : positiveSeconds(state.positionSeconds);
  const channel = /^\d{17,20}$/.test(String(state.voiceChannelId ?? ''))
    ? `<#${state.voiceChannelId}>`
    : '尚未連線';
  const details = current
    ? [
      `## ${displayText(current.title, 120, '未命名歌曲')}`,
      current.source === 'youtube'
        ? `${displayText(current.artist, 80, '未知頻道')} · YouTube`
        : `${displayText(current.artist, 80, '未知歌手')} · ${displayText(current.album, 80, '未知專輯')}`,
      current.source === 'youtube' ? '' : '-# 來源：NAS',
      cueLabel(current) ? `-# ${cueLabel(current)}` : '',
    ].filter(Boolean).join('\n')
    : stopped ? '播放器已結束，請從 /幫助重新開啟音樂播放器。'
      : state.errorText ? '目前沒有播放中的歌曲。'
      : state.status === 'connecting' ? '正在加入語音頻道，請稍候。'
      : state.status === 'loading' ? '正在準備音訊，請稍候。'
      : '目前沒有播放中的歌曲，按「點歌」開啟自己的曲庫，或按「YouTube 點播」貼上連結。\n播放器會持續待命；使用「停止並離開」或手動中斷 bot 語音連線結束。';
  const accentColor = stopped ? UI_COLORS.MUTED
    : state.errorText ? UI_COLORS.DANGER
    : state.status === 'paused' ? UI_COLORS.ROYAL_SOFT
    : ['connecting', 'loading'].includes(state.status) ? UI_COLORS.INFO
    : UI_COLORS.ROYAL;
  const panel = v2Panel(accentColor)
    .addTextDisplayComponents(v2Text([
      '### 🎵 吉吉王國・音樂播放器',
      `語音頻道：${channel}`,
    ].join('\n')));
  if (current && !stopped && coverUrl) {
    panel.addSectionComponents(new SectionBuilder()
      .addTextDisplayComponents(v2Text(details))
      .setThumbnailAccessory(new ThumbnailBuilder()
        .setURL(coverUrl)
        .setDescription(current.source === 'youtube'
          ? `YouTube 影片縮圖 · ${plainText(current.title, 120, '未命名歌曲')}`
          : `${plainText(current.album, 80, '未知專輯')}的專輯封面 · ${plainText(current.title, 120, '未命名歌曲')}`)));
  } else {
    panel.addTextDisplayComponents(v2Text(details));
  }
  if (!stopped) {
    const statusTone = state.errorText ? 'danger'
      : state.status === 'paused' ? 'warning'
      : ['connecting', 'loading'].includes(state.status) ? 'info'
      : 'royal';
    const hudRows = [
      { label: '狀態', value: state.errorText ? '播放失敗' : STATUS_LABELS[state.status] ?? '等待點歌', tone: statusTone },
      current ? { label: '進度', value: `${duration ? `${progressBar(position, duration)} ` : ''}${formatTime(position)} / ${duration ? formatTime(duration) : '未知時長'}`, tone: 'info' } : null,
      { label: '模式', value: `循環：${LOOP_LABELS[state.loop] ?? LOOP_LABELS.off}`, tone: ['track', 'queue'].includes(state.loop) ? 'special' : 'neutral' },
    ];
    panel.addTextDisplayComponents(v2Text(musicSummary(hudRows.filter(Boolean))));
  } else {
    panel.addTextDisplayComponents(v2Text(`已停止 · 循環：${LOOP_LABELS[state.loop] ?? LOOP_LABELS.off}`));
  }
  panel
    .addSeparatorComponents(v2Divider())
    .addTextDisplayComponents(v2Text([
      `### 接下來 · ${queue.length} 首待播`,
      queue.length ? queue.slice(0, 3).map((track, index) => trackLine(track, index + 1)).join('\n')
        : stopped ? '佇列目前是空的。' : '佇列目前是空的，按「點歌」加入歌曲。',
      queue.length > 3 ? `-# 尚有 ${queue.length - 3} 首，按「查看佇列」瀏覽全部歌曲。` : '',
      !stopped && state.errorText ? queue.length
        ? '⚠️ 播放失敗，待播歌曲已保留；按「下一首」繼續。'
        : '⚠️ 播放失敗，請重新點播歌曲。' : '',
    ].filter(Boolean).join('\n')))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        button(
          musicId(state.id, state.status === 'paused' ? 'resume' : 'pause'),
          state.status === 'paused' ? '繼續播放' : '暫停',
          ButtonStyle.Secondary,
          stopped || !current,
          state.status === 'paused' ? '▶️' : '⏸️',
        ),
        button(musicId(state.id, 'skip'), '下一首', ButtonStyle.Secondary, stopped || (!current && !queue.length), '⏭️'),
      ),
      new ActionRowBuilder().addComponents(
        button(musicId(state.id, 'browse'), '點歌', ButtonStyle.Primary, stopped, '🎵'),
        button(musicId(state.id, 'youtube'), 'YouTube 點播', ButtonStyle.Secondary, stopped || state.youtubeAvailable === false, '📺'),
        button(musicId(state.id, 'queue'), '查看佇列', ButtonStyle.Secondary, stopped, '📜'),
      ),
      new ActionRowBuilder().addComponents(
        button(
          musicId(state.id, 'loop'),
          `循環：${LOOP_LABELS[state.loop] ?? LOOP_LABELS.off}`,
          ButtonStyle.Secondary,
          stopped,
          state.loop === 'track' ? '🔂' : '🔁',
        ),
        button(musicId(state.id, 'shuffle'), '隨機排序', ButtonStyle.Secondary, stopped || queue.length < 2, '🔀'),
        button(musicId(state.id, 'stop'), '停止並離開', ButtonStyle.Secondary, stopped, '⏹️'),
      ),
    )
    .addTextDisplayComponents(v2Text('-# 音量請使用 Discord 個人音量調整 · 進度約每 15 秒更新，無法拖曳跳轉。'));
  return v2Payload([panel]);
}

export function buildMusicLibraryPayload(browser) {
  // The library service supplies newest-first order; this view preserves it.
  const allTracks = Array.isArray(browser.tracks) ? browser.tracks : [];
  const tracks = allTracks.slice(0, LIBRARY_LIMIT);
  const { page, lastPage, items } = paginate(tracks, browser.page);
  const disabled = Boolean(browser.disabled);
  const panel = v2Panel(UI_COLORS.ROYAL)
    .addTextDisplayComponents(v2Text([
      '### 🎼 吉吉王國・私人曲庫',
      browser.query ? `**搜尋：** ${displayText(browser.query, 120, '搜尋內容已隱去')}` : '依曲庫最新順序瀏覽歌曲，選取一首加入待播佇列。',
    ].join('\n')))
    .addTextDisplayComponents(v2Text(musicSummary([
      { label: '頁碼', value: `第 ${page + 1} / ${lastPage + 1} 頁`, tone: 'info' },
      { label: '結果', value: `${tracks.length} 首${browser.query ? '搜尋結果' : '曲目'}`, tone: 'royal' },
    ])))
    .addSeparatorComponents(v2Divider())
    .addTextDisplayComponents(v2Text(items.length
      ? items.map((track, index) => trackListItem(track, page * PAGE_SIZE + index + 1, true)).join('\n\n')
      : '找不到歌曲，請使用「搜尋曲庫」嘗試其他歌名、歌手或專輯。'));
  if (items.length) {
    panel.addActionRowComponents(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(libraryId(browser.id, 'enqueue'))
        .setPlaceholder('選擇歌曲加入待播佇列')
        .setMinValues(1)
        .setMaxValues(1)
        .setDisabled(disabled)
        .addOptions(items.map((track) => ({
          label: plainText(track.title, 100, '未命名歌曲'),
          description: plainText([plainText(track.artist, 48, '未知歌手'), cueLabel(track), trackDuration(track)].filter(Boolean).join(' · '), 100, '未知歌手'),
          value: String(track.id),
          emoji: { name: track.source === 'youtube' ? '📺' : '🎵' },
        }))),
    ));
  }
  panel
    .addTextDisplayComponents(v2Text([
      '-# 最多顯示最新 100 首；使用搜尋可找到其他曲目。只有你能操作此曲庫。',
      disabled ? '⌛ 曲庫操作已結束，請從播放器重新開啟。' : '',
    ].filter(Boolean).join('\n')))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      button(libraryId(browser.id, 'search'), '搜尋曲庫', ButtonStyle.Primary, disabled, '🔍'),
      button(libraryId(browser.id, 'prev'), '上一頁', ButtonStyle.Secondary, disabled || page === 0, '◀️'),
      button(libraryId(browser.id, 'next'), '下一頁', ButtonStyle.Secondary, disabled || page === lastPage, '▶️'),
    ))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      button(libraryId(browser.id, 'account'), '帳號／登出', ButtonStyle.Secondary, disabled, '👤'),
      button(libraryId(browser.id, 'youtube'), 'YouTube 點播', ButtonStyle.Secondary, disabled || browser.youtubeAvailable === false, '📺'),
    ));
  return ephemeralV2Payload([panel]);
}

export function buildMusicSearchModal(browserId) {
  return new ModalBuilder()
    .setCustomId(libraryId(browserId, 'search_submit'))
    .setTitle('搜尋 NAS 曲庫')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('query')
        .setLabel('歌名、歌手或專輯')
        .setPlaceholder('輸入關鍵字；留空可返回最新曲目')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(120)
        .setRequired(false),
    ));
}

export function buildMusicQueuePayload(state, requestedPage = 0) {
  const queue = Array.isArray(state.queue) ? state.queue : [];
  const { page, lastPage, items } = paginate(queue, requestedPage);
  const disabled = state.status === 'stopped';
  const panel = v2Panel(UI_COLORS.ROYAL)
    .addTextDisplayComponents(v2Text([
      '### 🎶 吉吉王國・待播佇列',
      state.current ? `**目前歌曲：** ${displayText(state.current.title, 80, '未命名歌曲')}` : '目前沒有播放中的歌曲。',
    ].join('\n')))
    .addTextDisplayComponents(v2Text(musicSummary([
      { label: '頁碼', value: `第 ${page + 1} / ${lastPage + 1} 頁`, tone: 'info' },
      { label: '待播', value: `${queue.length} 首`, tone: 'royal' },
    ])))
    .addSeparatorComponents(v2Divider())
    .addTextDisplayComponents(v2Text(items.length
      ? items.map((track, index) => trackListItem(track, page * PAGE_SIZE + index + 1)).join('\n\n')
      : '佇列目前是空的，請從播放器按「點歌」加入歌曲。'))
    .addTextDisplayComponents(v2Text('-# 此畫面只有你能看見；待播佇列由同一語音頻道的成員共用。'))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      button(musicId(state.id, `qprev:${Math.max(0, page - 1)}`), '上一頁', ButtonStyle.Secondary, disabled || page === 0, '◀️'),
      button(musicId(state.id, `qnext:${Math.min(lastPage, page + 1)}`), '下一頁', ButtonStyle.Secondary, disabled || page === lastPage, '▶️'),
    ));
  return ephemeralV2Payload([panel]);
}

function musicSummary(rows) {
  return ansiRows(rows.map((row) => ({ ...row, labelTone: 'neutral' })), { maxWidth: 40 });
}

function trackLine(track, number) {
  return `${number}. **${displayText(track.title, 80, '未命名歌曲')}** · ${displayText(track.artist, 40, '未知歌手')} · ${[track.source === 'youtube' ? 'YouTube' : 'NAS', cueLabel(track), trackDuration(track)].filter(Boolean).join(' · ')}`;
}

function trackListItem(track, number, includeAlbum = false) {
  const metadata = [
    displayText(track.artist, includeAlbum ? 32 : 40, track.source === 'youtube' ? '未知頻道' : '未知歌手'),
    includeAlbum && track.source !== 'youtube' ? displayText(track.album, 32, '未知專輯') : '',
    track.source === 'youtube' ? 'YouTube' : 'NAS',
    trackDuration(track),
    cueLabel(track),
  ];
  return `**${number}. ${displayText(track.title, includeAlbum ? 64 : 80, '未命名歌曲')}**  \n${metadata.filter(Boolean).join(' · ')}`;
}

function cueLabel(track) {
  if (track.isCueTrack !== true) return '';
  return Number.isInteger(track.trackNumber) && track.trackNumber >= 1 && track.trackNumber <= 99
    ? `CUE 分軌 ${String(track.trackNumber).padStart(2, '0')}`
    : 'CUE 分軌';
}

function trackDuration(track) {
  return positiveSeconds(track.duration) ? formatTime(track.duration) : '未知時長';
}

function progressBar(position, duration) {
  const filled = Math.min(12, Math.floor(position / duration * 12));
  return `${'━'.repeat(filled)}●${'─'.repeat(12 - filled)}`;
}

function button(customId, label, style, disabled, emoji = null) {
  const item = new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style).setDisabled(Boolean(disabled));
  if (emoji) item.setEmoji(emoji);
  return item;
}

function musicId(id, action) {
  return `music:${id}:${action}`;
}

function libraryId(id, action) {
  return `musiclib:${id}:${action}`;
}

function paginate(tracks, requestedPage) {
  const lastPage = Math.max(0, Math.ceil(tracks.length / PAGE_SIZE) - 1);
  const number = Number(requestedPage);
  const page = Math.max(0, Math.min(lastPage, Number.isFinite(number) ? Math.floor(number) : 0));
  return { page, lastPage, items: tracks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) };
}

function positiveSeconds(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function formatTime(value) {
  const seconds = positiveSeconds(value);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function displayText(value, maxLength, fallback) {
  return plainText(value, maxLength, fallback).replace(/[\\`*_{}\[\]()#+\-.!|~]/g, '\\$&');
}

function plainText(value, maxLength, fallback) {
  const text = String(value ?? '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || /\b[a-z][a-z\d+.-]*:\/\/|\bwww\.|\b[a-z]:[\\/]|\\\\|(?:^|[\s("'=])\/\S|\b(?:cookie|set-cookie|authorization)\b|\b(?:token|password|secret)\s*[:=]/i.test(text)) {
    return fallback;
  }
  const neutralized = text.replace(/@/g, '@\u200b').replace(/</g, '＜').replace(/>/g, '＞');
  if (neutralized.length <= maxLength) return neutralized;
  let result = '';
  for (const character of neutralized) {
    if (result.length + character.length > maxLength - 1) break;
    result += character;
  }
  return `${result}…`;
}

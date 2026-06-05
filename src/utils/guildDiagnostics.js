import { parseJsonArray, parseJsonObject } from './jsonUtils.js';
import { isValidSteamDealTime } from './steamDeals.js';

export function buildGuildDiagnostics({
  settings,
  aiSettings,
  reactionRoles = [],
  availableChannelIds = new Set(),
  channelNames = new Map(),
  hasDiscordToken = false,
  hasGoogleAiKey = false,
  hasAiAdminPassword = false,
}) {
  const diagnostics = [];
  const environment = [
    ['DISCORD_TOKEN', hasDiscordToken],
    ['GOOGLE_AI_KEY', hasGoogleAiKey],
    ['AI_ADMIN_PASSWORD', hasAiAdminPassword],
  ];
  const missingEnvironment = environment.filter(([, configured]) => !configured).map(([name]) => name);
  const missingAiEnv = [
    !hasGoogleAiKey ? 'GOOGLE_AI_KEY' : null,
    !hasAiAdminPassword ? 'AI_ADMIN_PASSWORD' : null,
  ].filter(Boolean);

  diagnostics.push({
    label: '環境變數',
    status: missingEnvironment.length ? '設定異常' : '正常',
    detail: environment.map(([name, configured]) => `${name} ${configured ? '已配置' : '未配置'}`).join(' | '),
    fix: missingEnvironment.length ? '在 `.env` 補齊未配置的必要環境變數後重新啟動。' : null,
  });

  diagnostics.push({
    label: 'AI 設定',
    status: missingAiEnv.length ? '設定異常' : '正常',
    detail: missingAiEnv.length
      ? `缺少 ${missingAiEnv.join('、')}`
      : `模型 ${aiSettings.model}`,
    fix: missingAiEnv.length ? '在 `.env` 補齊 AI 必要環境變數後重新啟動。' : null,
  });

  const logDiagnostic = channelDiagnostic(
    '日誌記錄',
    settings.log_channel,
    availableChannelIds,
    channelNames,
    '在 `/設定` 的「紀錄」頁選擇日誌頻道'
  );
  if (logDiagnostic.status === '正常') {
    const labels = { message: '訊息', member: '成員', server: '伺服器', voice: '語音', thread: '討論串' };
    const toggles = parseJsonObject(settings.log_toggles, {});
    const enabled = Object.entries(labels).filter(([key]) => toggles[key] === 1).map(([, label]) => label);
    logDiagnostic.detail += ` | 類別 ${enabled.length ? enabled.join('、') : '全數關閉'}`;
  }
  diagnostics.push(logDiagnostic);
  const welcomeDiagnostic = channelDiagnostic(
    '歡迎訊息',
    settings.welcome_channel,
    availableChannelIds,
    channelNames,
    '在 `/設定` 的「歡迎」頁選擇歡迎頻道'
  );
  if (welcomeDiagnostic.status === '正常') {
    welcomeDiagnostic.detail += settings.welcome_message ? ' | 自訂內容' : ' | 預設內容';
  }
  diagnostics.push(welcomeDiagnostic);

  diagnostics.push({
    label: '等級升級公告',
    status: '正常',
    detail: settings.level_up_announcement_enabled !== 0 ? '升級時會發送公告' : '已由管理員關閉公告',
    fix: null,
  });

  const selfRoleCount = parseJsonArray(settings.selfrole_roles, []).length;
  diagnostics.push({
    label: '自助身分組',
    status: selfRoleCount > 0 ? '正常' : '未設定',
    detail: selfRoleCount > 0 ? `已建立 ${selfRoleCount} 個領取選項` : '尚未建立領取選項',
    fix: selfRoleCount > 0 ? null : '在 `/設定` 的「自助身分組」頁建立可領取的身分組選項。',
  });

  const reactionChannelIds = [...new Set(reactionRoles.map((item) => item.channel_id))];
  const missingReactionChannel = reactionChannelIds.some((id) => !availableChannelIds.has(id));
  if (missingReactionChannel) {
    diagnostics.push({
      label: '按鈕身分組',
      status: '設定異常',
      detail: '按鈕身分組使用的頻道已不存在',
      fix: '在 `/設定` 的「按鈕身分組」頁檢查並刪除失效設定。',
    });
  } else if (reactionRoles.length === 0) {
    diagnostics.push({
      label: '按鈕身分組',
      status: '未設定',
      detail: '尚未建立按鈕站',
      fix: '在 `/設定` 的「按鈕身分組」頁建立站點。',
    });
  } else {
    diagnostics.push({
      label: '按鈕身分組',
      status: '正常',
      detail: `已建立 ${reactionRoles.length} 組配對`,
      fix: null,
    });
  }

  diagnostics.push(steamDiagnostic(settings, availableChannelIds, channelNames));
  diagnostics.push(steamFreeDiagnostic(settings, availableChannelIds, channelNames));
  return diagnostics;
}

function channelDiagnostic(label, channelId, channelIds, channelNames, command) {
  if (!channelId) {
    return {
      label,
      status: '未設定',
      detail: '尚未指定頻道',
      fix: `${command}。`,
    };
  }
  if (!channelIds.has(channelId)) {
    return {
      label,
      status: '設定異常',
      detail: '已設定的頻道不存在或無法存取',
      fix: `重新${command}。`,
    };
  }
  return { label, status: '正常', detail: displayChannelName(channelId, channelNames), fix: null };
}

function steamDiagnostic(settings, channelIds, channelNames) {
  if (settings.steam_deal_enabled !== 1) {
    return {
      label: 'Steam 特價推播',
      status: '未設定',
      detail: settings.steam_deal_channel ? '目前已關閉' : '尚未啟用',
      fix: '在 `/設定` 的「Steam」頁啟用每日推播。',
    };
  }
  if (!settings.steam_deal_channel || !channelIds.has(settings.steam_deal_channel)) {
    return {
      label: 'Steam 特價推播',
      status: '設定異常',
      detail: '推播頻道不存在或無法存取',
      fix: '在 `/設定` 的「Steam」頁重新選擇推播頻道。',
    };
  }
  if (!isValidSteamDealTime(settings.steam_deal_time)) {
    return {
      label: 'Steam 特價推播',
      status: '設定異常',
      detail: '每日投放時間格式無效',
      fix: '在 `/設定` 的「Steam」頁將時間設為 `HH:mm` 格式。',
    };
  }
  return {
    label: 'Steam 特價推播',
    status: '正常',
    detail: `${displayChannelName(settings.steam_deal_channel, channelNames)} 每日 ${settings.steam_deal_time}`,
    fix: null,
  };
}

function steamFreeDiagnostic(settings, channelIds, channelNames) {
  if (settings.steam_free_enabled !== 1) {
    return {
      label: 'Steam 限時免費推播',
      status: '未設定',
      detail: settings.steam_free_channel ? '目前已關閉' : '尚未啟用',
      fix: '在 `/設定` 的 Steam 頁啟用限時免費推播。',
    };
  }
  if (!settings.steam_free_channel || !channelIds.has(settings.steam_free_channel)) {
    return {
      label: 'Steam 限時免費推播',
      status: '設定異常',
      detail: '推播頻道不存在或無法存取',
      fix: '在 `/設定` 的 Steam 頁重新選擇限時免費推播頻道。',
    };
  }
  if (!isValidSteamDealTime(settings.steam_free_time)) {
    return {
      label: 'Steam 限時免費推播',
      status: '設定異常',
      detail: '每日推播時間格式錯誤',
      fix: '在 `/設定` 的 Steam 頁將限時免費時間設為 `HH:mm` 格式。',
    };
  }
  return {
    label: 'Steam 限時免費推播',
    status: '正常',
    detail: `${displayChannelName(settings.steam_free_channel, channelNames)} 每日 ${settings.steam_free_time}`,
    fix: null,
  };
}

function displayChannelName(channelId, channelNames) {
  const name = channelNames.get(channelId);
  if (!name) return '#已設定頻道';
  return `#${String(name).replace(/[\r\n\u001b]/g, '').slice(0, 100)}`;
}

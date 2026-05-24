import { parseJsonArray } from './jsonUtils.js';
import { isValidSteamDealTime } from './steamDeals.js';

export function buildGuildDiagnostics({
  settings,
  aiSettings,
  reactionRoles = [],
  availableChannelIds = new Set(),
  hasGoogleAiKey = false,
  hasAiAdminPassword = false,
}) {
  const diagnostics = [];
  const missingAiEnv = [
    !hasGoogleAiKey ? 'GOOGLE_AI_KEY' : null,
    !hasAiAdminPassword ? 'AI_ADMIN_PASSWORD' : null,
  ].filter(Boolean);

  diagnostics.push({
    label: 'AI 核心',
    status: missingAiEnv.length ? '設定異常' : '正常',
    detail: missingAiEnv.length
      ? `缺少 ${missingAiEnv.join('、')}`
      : `模型 ${aiSettings.model}`,
    fix: missingAiEnv.length ? '在 `.env` 補齊 AI 必要環境變數後重新啟動。' : null,
  });

  diagnostics.push(channelDiagnostic(
    '史官日誌',
    settings.log_channel,
    availableChannelIds,
    '/設定紀錄 頻道:#伺服器日誌'
  ));
  diagnostics.push(channelDiagnostic(
    '歡迎訊息',
    settings.welcome_channel,
    availableChannelIds,
    '/設定歡迎 頻道:#歡迎'
  ));

  diagnostics.push({
    label: '等級公告',
    status: '正常',
    detail: settings.level_up_announcement_enabled !== 0 ? '升級時會發送公告' : '已由管理員關閉公告',
    fix: null,
  });

  const selfRoleCount = parseJsonArray(settings.selfrole_roles, []).length;
  const reactionChannelIds = [...new Set(reactionRoles.map((item) => item.channel_id))];
  const missingReactionChannel = reactionChannelIds.some((id) => !availableChannelIds.has(id));
  if (missingReactionChannel) {
    diagnostics.push({
      label: '自助身分組',
      status: '設定異常',
      detail: '反應身分組使用的頻道已不存在',
      fix: '使用 `/反應身分組 列表清單` 檢查並刪除失效設定。',
    });
  } else if (selfRoleCount === 0 && reactionRoles.length === 0) {
    diagnostics.push({
      label: '自助身分組',
      status: '未設定',
      detail: '尚未建立領取選項',
      fix: '使用 `/自助身分組 新增選項` 或 `/反應身分組 建立設定`。',
    });
  } else {
    diagnostics.push({
      label: '自助身分組',
      status: '正常',
      detail: `下拉選項 ${selfRoleCount} 個，按鈕配對 ${reactionRoles.length} 個`,
      fix: null,
    });
  }

  diagnostics.push(steamDiagnostic(settings, availableChannelIds));
  return diagnostics;
}

function channelDiagnostic(label, channelId, channelIds, command) {
  if (!channelId) {
    return {
      label,
      status: '未設定',
      detail: '尚未指定頻道',
      fix: `使用 \`${command}\` 設定。`,
    };
  }
  if (!channelIds.has(channelId)) {
    return {
      label,
      status: '設定異常',
      detail: '已設定的頻道不存在或無法存取',
      fix: `重新使用 \`${command}\` 設定。`,
    };
  }
  return { label, status: '正常', detail: `<#${channelId}>`, fix: null };
}

function steamDiagnostic(settings, channelIds) {
  if (settings.steam_deal_enabled !== 1) {
    return {
      label: 'Steam 推播',
      status: '未設定',
      detail: settings.steam_deal_channel ? '目前已關閉' : '尚未啟用',
      fix: '使用 `/設定特價推播 設定頻道` 啟用每日推播。',
    };
  }
  if (!settings.steam_deal_channel || !channelIds.has(settings.steam_deal_channel)) {
    return {
      label: 'Steam 推播',
      status: '設定異常',
      detail: '推播頻道不存在或無法存取',
      fix: '重新使用 `/設定特價推播 設定頻道` 設定。',
    };
  }
  if (!isValidSteamDealTime(settings.steam_deal_time)) {
    return {
      label: 'Steam 推播',
      status: '設定異常',
      detail: '每日投放時間格式無效',
      fix: '使用 `/設定特價推播 設定頻道` 設為 `HH:mm` 格式。',
    };
  }
  return {
    label: 'Steam 推播',
    status: '正常',
    detail: `<#${settings.steam_deal_channel}> 每日 ${settings.steam_deal_time}`,
    fix: null,
  };
}

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { execute as openSettingsPanel } from '../commands/admin/settings.js';
import { execute as openStatsSearch } from '../commands/esports/stats.js';
import { openGiveawayComposer } from '../commands/fun/giveaway.js';
import { openPollComposer } from '../commands/fun/poll.js';
import { execute as openHelpPanel } from '../commands/general/help.js';
import { openReminderComposer } from '../commands/general/remind.js';
import { execute as openSteamSearch } from '../commands/steam/steam.js';
import { ephemeralV2Payload, v2Panel, v2Text } from './componentsV2.js';
import { parseScopedCustomId, scopedCustomId } from './customIds.js';
import { UI_COLORS } from './style.js';

export const AI_QA_SCOPE = 'aiqa';

const ACTIONS = {
  help: {
    label: '開啟幫助',
    style: ButtonStyle.Primary,
    keywords: ['幫助', 'help', '指令', '功能', '怎麼', '如何', '使用', '入口'],
  },
  steam: {
    label: 'Steam 查詢',
    style: ButtonStyle.Secondary,
    keywords: ['steam', '特價', '折扣', '遊戲', '價格', '免費遊戲', '限時免費'],
  },
  stats: {
    label: '戰績查詢',
    style: ButtonStyle.Secondary,
    keywords: ['戰績', 'valorant', 'valo', 'lol', '英雄聯盟', 'riot', '牌位', '排位'],
  },
  reminder: {
    label: '新增提醒',
    style: ButtonStyle.Secondary,
    keywords: ['提醒', '鬧鐘', '待辦', '記得', '時間到'],
  },
  poll: {
    label: '建立投票',
    style: ButtonStyle.Secondary,
    keywords: ['投票', '表決', '票選', '選項', '問卷'],
  },
  giveaway: {
    label: '建立抽獎',
    style: ButtonStyle.Secondary,
    keywords: ['抽獎', '贈品', 'giveaway', '獎品', '開獎'],
  },
  settings: {
    label: '管理設定',
    style: ButtonStyle.Secondary,
    adminOnly: true,
    keywords: ['設定', '/設定', '管理', '控制台', '後台', '權限', '白名單', '歡迎', '日誌', '身分組'],
  },
  announcementDraft: {
    label: '公告草稿',
    style: ButtonStyle.Success,
    adminOnly: true,
    keywords: ['公告', '發布', '通知', '草稿', '聖旨', 'announcement'],
  },
};

export function buildAiQaActionRows({ userId, isAdmin, userText = '', aiReply = '' }) {
  const source = normalize(`${userText}\n${aiReply}`);
  const detected = [];

  for (const [name, config] of Object.entries(ACTIONS)) {
    if (config.adminOnly && !isAdmin) continue;
    if (matchesAny(source, config.keywords)) detected.push(name);
  }

  if (detected.length > 0 && !detected.includes('help')) detected.unshift('help');
  const uniqueActions = [...new Set(detected)].slice(0, 10);
  const rows = [];

  for (let i = 0; i < uniqueActions.length; i += 5) {
    const row = new ActionRowBuilder();
    for (const action of uniqueActions.slice(i, i + 5)) {
      const config = ACTIONS[action];
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(scopedCustomId(AI_QA_SCOPE, userId, action))
          .setLabel(config.label)
          .setStyle(config.style)
      );
    }
    rows.push(row);
  }

  return rows;
}

export function parseAiQaAction(customId, userId) {
  const parts = parseScopedCustomId(customId, AI_QA_SCOPE, userId);
  return parts?.[0] || null;
}

export async function handleAiQaAction(interaction, action) {
  if (action === 'help') return openHelpPanel(interaction);
  if (action === 'steam') return openSteamSearch(interaction);
  if (action === 'stats') return openStatsSearch(interaction);
  if (action === 'reminder') return openReminderComposer(interaction);
  if (action === 'poll') return openPollComposer(interaction);
  if (action === 'giveaway') return openGiveawayComposer(interaction);
  if (action === 'settings') return openSettingsPanel(interaction);
  if (action === 'announcementDraft') {
    return openSettingsPanel(interaction, { initialView: 'ai' });
  }

  return interaction.reply(ephemeralV2Payload([
    v2Panel(UI_COLORS.WARNING).addTextDisplayComponents(v2Text([
      '## 操作入口已失效',
      '請重新提問或使用 `/幫助` 開啟最新功能入口。',
    ].join('\n'))),
  ]));
}

function matchesAny(source, keywords) {
  return keywords.some((keyword) => source.includes(normalize(keyword)));
}

function normalize(value) {
  return String(value || '').toLowerCase();
}

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  LabelBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { cachedStats, buildCacheKey } from './lib/cache.js';
import { buildStatsReply } from './lib/embed.js';
import { ephemeralV2Payload, v2Divider, v2EditPayload, v2Notice, v2Panel, v2Text } from '../../utils/componentsV2.js';
import { UI_COLORS } from '../../utils/style.js';
import { fetchLolStats } from './lib/providers/lol.js';
import { fetchValorantStats } from './lib/providers/valorant.js';

const QUERY_TIMEOUT = 10 * 60_000;
const LOL_REGIONS = [
  { label: '台灣 (TW)', value: 'tw', default: true },
  { label: '韓國 (KR)', value: 'kr' },
  { label: '日本 (JP)', value: 'jp' },
  { label: '北美 (NA)', value: 'na' },
  { label: '西歐 (EUW)', value: 'euw' },
];

export const data = new SlashCommandBuilder()
  .setName('戰績')
  .setDescription('🐕📜 進入皇家戰報廳，查詢公開賽季戰績');

export async function execute(interaction) {
  const sessionId = interaction.id;
  const ownerId = interaction.user.id;
  const state = { result: null, playerName: '', tag: '', published: false };

  const launcher = buildStatsLauncher(sessionId);
  await interaction.reply(ephemeralV2Payload(launcher.components));
  const response = await interaction.fetchReply();
  const collector = response.createMessageComponentCollector({ time: QUERY_TIMEOUT });

  collector.on('collect', async (component) => {
    try {
      if (component.user.id !== ownerId) {
        return component.reply(v2Notice(
          '🐕📜 這份戰報委託不屬於你',
          '請使用 `/戰績` 開啟自己的皇家戰報廳。',
          UI_COLORS.WARNING
        ));
      }

      const [scope, id, action] = component.customId.split(':');
      if (scope !== 'stats' || id !== sessionId) return;

      if (action === 'valorant' || action === 'lol') {
        const modal = buildStatsModal(sessionId, action);
        await component.showModal(modal);
        const submit = await component.awaitModalSubmit({
          time: 2 * 60_000,
          filter: (candidate) => candidate.user.id === ownerId && candidate.customId === modal.data.custom_id,
        }).catch(() => null);
        if (!submit) return;

        state.playerName = submit.fields.getTextInputValue('player_name').trim();
        state.tag = submit.fields.getTextInputValue('tag').replace(/^#/, '').trim();
        const region = action === 'valorant'
          ? 'ap'
          : submit.fields.getStringSelectValues('region')[0] || 'tw';
        const key = buildCacheKey(action, state.playerName, state.tag, region);
        await submit.deferUpdate();
        state.result = await cachedStats(key, () => action === 'valorant'
          ? fetchValorantStats(state.playerName, state.tag)
          : fetchLolStats(state.playerName, state.tag, region));

        return submit.editReply(v2EditPayload(buildStatsReply(state.result, state.playerName, state.tag, {
          ephemeral: true,
          publishCustomId: statsId(sessionId, 'publish'),
        })));
      }

      if (action === 'publish' && state.result?.status === 'ok') {
        if (state.published) {
          return component.reply(v2Notice(
            '📜 戰報已頒布',
            '本王已將這份戰報張貼至原頻道，不會重複發布。',
            UI_COLORS.WARNING
          ));
        }
        await component.deferUpdate();
        await interaction.channel.send(buildStatsReply(state.result, state.playerName, state.tag));
        state.published = true;
        return component.editReply(v2EditPayload(buildStatsReply(state.result, state.playerName, state.tag, {
          ephemeral: true,
          publishCustomId: statsId(sessionId, 'publish'),
          published: true,
        })));
      }
    } catch (error) {
      const notice = v2Notice('🐕💥 戰報傳遞失敗', '本王暫時無法完成這次操作，請稍後重新查詢。', UI_COLORS.DANGER);
      if (component.replied || component.deferred) await component.followUp(notice).catch(() => {});
      else await component.reply(notice).catch(() => {});
    }
  });

  collector.on('end', () => {
    const expired = state.result?.status === 'ok'
      ? buildStatsReply(state.result, state.playerName, state.tag, {
          ephemeral: true,
          publishCustomId: statsId(sessionId, 'publish'),
          published: state.published,
          expired: true,
        })
      : buildStatsLauncher(sessionId, true);
    interaction.editReply(v2EditPayload(expired)).catch(() => {});
  });
}

export function buildStatsLauncher(sessionId, disabled = false) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(statsId(sessionId, 'valorant'))
      .setLabel('特戰英豪')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(statsId(sessionId, 'lol'))
      .setLabel('英雄聯盟')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled)
  );
  const panel = v2Panel(UI_COLORS.ROYAL)
    .addTextDisplayComponents(v2Text([
      '# 🐕📜 皇家戰報廳',
      '挑選戰場後填寫 Riot ID，本王會私下呈上公開賽季戰績。',
      '-# 查詢結果僅你可見；確認內容後可頒布至目前頻道一次。',
    ].join('\n')))
    .addSeparatorComponents(v2Divider())
    .addActionRowComponents(row);
  if (disabled) {
    panel.addTextDisplayComponents(v2Text('## ⌛ 查詢委託已結束\n請重新使用 `/戰績` 送出新的戰報委託。'));
  }
  return { components: [panel] };
}

export function buildStatsModal(sessionId, game) {
  const isValorant = game === 'valorant';
  const modal = new ModalBuilder()
    .setCustomId(statsId(sessionId, `submit_${game}`))
    .setTitle(isValorant ? '皇家戰報 | 特戰英豪' : '皇家戰報 | 英雄聯盟')
    .addLabelComponents(
      textLabel('玩家名稱', 'player_name', 'Riot ID 的玩家名稱，例如 Hide on bush'),
      textLabel('標籤', 'tag', '不含或包含 # 均可，例如 TW2')
    );
  if (!isValorant) {
    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel('查詢區服')
        .setDescription('未特別指定時，以台灣區作為預設。')
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId('region')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(LOL_REGIONS)
        )
    );
  }
  return modal;
}

function textLabel(label, customId, placeholder) {
  return new LabelBuilder()
    .setLabel(label)
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId(customId)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(placeholder)
        .setMaxLength(100)
        .setRequired(true)
    );
}

function statsId(sessionId, action) {
  return `stats:${sessionId}:${action}`;
}

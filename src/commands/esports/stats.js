import {
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { cachedStats, buildCacheKey } from './lib/cache.js';
import { buildStatsReply } from './lib/embed.js';
import { v2EditPayload, v2Notice } from '../../utils/componentsV2.js';
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
  const modal = buildStatsModal(sessionId);
  await interaction.showModal(modal);
  const submit = await interaction.awaitModalSubmit({
    time: 2 * 60_000,
    filter: (candidate) => candidate.user.id === ownerId && candidate.customId === modal.data.custom_id,
  }).catch(() => null);
  if (!submit) return;

  const game = submit.fields.getStringSelectValues('game')[0] || 'valorant';
  state.playerName = submit.fields.getTextInputValue('player_name').trim();
  state.tag = submit.fields.getTextInputValue('tag').replace(/^#/, '').trim();
  const region = game === 'valorant'
    ? 'ap'
    : submit.fields.getStringSelectValues('region')[0] || 'tw';
  const key = buildCacheKey(game, state.playerName, state.tag, region);
  await submit.deferReply({ flags: MessageFlags.Ephemeral });
  state.result = await cachedStats(key, () => game === 'valorant'
    ? fetchValorantStats(state.playerName, state.tag)
    : fetchLolStats(state.playerName, state.tag, region));

  await submit.editReply(v2EditPayload(buildStatsReply(state.result, state.playerName, state.tag, {
    ephemeral: true,
    publishCustomId: statsId(sessionId, 'publish'),
  })));
  if (state.result.status !== 'ok') return;

  const response = await submit.fetchReply();
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
    const expired = buildStatsReply(state.result, state.playerName, state.tag, {
      ephemeral: true,
      publishCustomId: statsId(sessionId, 'publish'),
      published: state.published,
      expired: true,
    });
    submit.editReply(v2EditPayload(expired)).catch(() => {});
  });
}

export function buildStatsModal(sessionId) {
  return new ModalBuilder()
    .setCustomId(statsId(sessionId, 'submit'))
    .setTitle('皇家戰報廳 | 查詢公開戰績')
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent('**功能說明**\n選擇 VALORANT 或 League of Legends，輸入 Riot ID 的玩家名稱與 Tag；本王會查詢公開賽季戰績、牌位、勝率與常用角色，結果可一鍵發布到目前頻道。')
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('選擇戰場')
        .setDescription('請選擇要查詢的遊戲。')
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId('game')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
              { label: '特戰英豪 (VALORANT)', value: 'valorant', default: true },
              { label: '英雄聯盟 (League of Legends)', value: 'lol' }
            )
        ),
      textLabel('玩家名稱', 'player_name', 'Riot ID 的玩家名稱，例如 Hide on bush'),
      textLabel('標籤', 'tag', '不含或包含 # 均可，例如 TW2'),
      new LabelBuilder()
        .setLabel('英雄聯盟查詢區服')
        .setDescription('僅英雄聯盟使用；特戰英豪會自動忽略此選項。')
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId('region')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(LOL_REGIONS)
        )
    );
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

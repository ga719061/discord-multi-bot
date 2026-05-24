import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { cachedStats, buildCacheKey } from './lib/cache.js';
import { buildStatsReply } from './lib/embed.js';
import { v2EditPayload } from '../../utils/componentsV2.js';
import { fetchLolStats } from './lib/providers/lol.js';
import { fetchValorantStats } from './lib/providers/valorant.js';

const LOL_REGIONS = [
  { name: '台灣 (TW)', value: 'tw' },
  { name: '韓國 (KR)', value: 'kr' },
  { name: '日本 (JP)', value: 'jp' },
  { name: '北美 (NA)', value: 'na' },
  { name: '西歐 (EUW)', value: 'euw' },
];

export const data = new SlashCommandBuilder()
  .setName('戰績')
  .setDescription('查詢特戰英豪或英雄聯盟的公開賽季戰績')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('特戰英豪')
      .setDescription('查詢 VALORANT 當前 Act 的 All Modes 公開戰績')
      .addStringOption((option) =>
        option.setName('玩家名稱').setDescription('Riot ID 的玩家名稱').setRequired(true)
      )
      .addStringOption((option) =>
        option.setName('標籤').setDescription('Riot ID 的 # 標籤，例如 TW2').setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('英雄聯盟')
      .setDescription('查詢 League of Legends 當前賽季公開戰績')
      .addStringOption((option) =>
        option.setName('玩家名稱').setDescription('Riot ID 的玩家名稱').setRequired(true)
      )
      .addStringOption((option) =>
        option.setName('標籤').setDescription('Riot ID 的 # 標籤，例如 TW2').setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('區服')
          .setDescription('OP.GG 查詢區服，預設為台灣')
          .addChoices(...LOL_REGIONS)
      )
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const playerName = interaction.options.getString('玩家名稱', true).trim();
  const tag = interaction.options.getString('標籤', true).replace(/^#/, '').trim();
  const isValorant = subcommand === '特戰英豪';
  const game = isValorant ? 'valorant' : 'lol';
  const region = isValorant ? 'ap' : interaction.options.getString('區服') || 'tw';
  const key = buildCacheKey(game, playerName, tag, region);

  await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });

  const result = await cachedStats(key, () => {
    if (isValorant) return fetchValorantStats(playerName, tag);
    return fetchLolStats(playerName, tag, region);
  });

  await interaction.editReply(v2EditPayload(buildStatsReply(result, playerName, tag)));
}

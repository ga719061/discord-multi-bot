import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { ansiBlock, COLORS } from '../../../utils/style.js';
import { embedsToV2Payload } from '../../../utils/componentsV2.js';

export function buildStatsReply(result, playerName, tag) {
  const playerId = `${playerName}#${tag}`;
  const embed = result.status === 'ok'
    ? buildSuccessEmbed(result)
    : buildFailureEmbed(result, playerId);

  const sourceButton = new ButtonBuilder()
    .setLabel(`查看完整 ${result.source} 頁面`)
    .setStyle(ButtonStyle.Link)
    .setURL(result.sourceUrl);

  return embedsToV2Payload([embed], {
    actionRows: [new ActionRowBuilder().addComponents(sourceButton)],
  });
}

function buildSuccessEmbed(result) {
  if (result.game === 'valorant') return buildValorantEmbed(result);
  return buildLolEmbed(result);
}

function buildValorantEmbed(result) {
  const stats = result.stats;
  const agentLines = formatValorantAgents(stats.topAgents);
  const recentLines = formatRecentHighlights(stats.recentHighlights);
  const weaponLines = formatValorantWeapons(stats.weapons);
  const mapLines = formatValorantMaps(stats.maps);
  const isOpgg = result.source === 'OP.GG';
  const record = stats.wins
    ? `${stats.wins} 勝 / ${value(stats.draws)} 和 / ${value(stats.losses)} 敗`
    : '網站未呈報';
  const supplementaryFields = stats.weapons || stats.maps
    ? [
        { name: '🔫 武器表現', value: weaponLines, inline: false },
        { name: '🗺️ 地圖表現', value: mapLines, inline: false },
      ]
    : [{ name: '🗺️ 近期亮點', value: recentLines, inline: false }];
  const embed = new EmbedBuilder()
    .setColor(0xFA4454)
    .setAuthor({ name: `VALORANT | ${result.source} All Modes 公開戰績總覽` })
    .setTitle(`🎯 ${stats.playerId}`)
    .setURL(result.sourceUrl)
    .setDescription(ansiBlock([
      { color: COLORS.GOLD, text: `[牌位] ${stats.rank}${stats.rr ? ` | ${stats.rr} RR` : ''}` },
      { color: COLORS.CYAN, text: `[戰績] KD ${value(stats.kd)} | ${isOpgg ? 'KDA' : 'KAD'} ${value(stats.kad)} | 勝率 ${value(stats.winRate)}` },
      { color: COLORS.WHITE, text: `[火力] ${isOpgg ? 'Score/Round' : 'ACS'} ${value(stats.acs)} | HS ${value(stats.headshot)} | ADR ${value(stats.adr)}` },
    ]))
    .addFields(
      { name: '🏆 巔峰牌位', value: value(stats.peakRank), inline: true },
      { name: '🧩 常用特務', value: value(stats.topAgent), inline: true },
      { name: '🌏 伺服器', value: value(stats.server), inline: true },
      { name: '📊 對戰樣本', value: stats.matches ? `${stats.matches} 場` : '網站未呈報', inline: true },
      { name: '🕒 資料更新', value: value(stats.updatedAt), inline: true },
      ...(isOpgg ? [{ name: '📈 勝敗紀錄', value: record, inline: true }] : []),
      {
        name: '🎯 命中與輸出',
        value: `${isOpgg ? `總 K / D / A：**${value(stats.kills)} / ${value(stats.deaths)} / ${value(stats.assists)}**` : `擊殺 / 助攻：**${value(stats.kills)} / ${value(stats.assists)}**`}\n命中分布：頭部 **${value(stats.headshot)}** ｜ 身體 **${value(stats.bodyshot)}** ｜ 腿部 **${value(stats.legshot)}**`,
        inline: false,
      },
      ...(isOpgg ? [{
        name: '⏱️ 遊玩摘要',
        value: `遊玩時間：**${value(stats.timePlayed)}** ｜ 最高單場擊殺：**${value(stats.highestKills)}**`,
        inline: false,
      }] : []),
      { name: '🧩 特務表現', value: agentLines, inline: false },
      ...supplementaryFields,
    )
    .setFooter({ text: `來源：${result.source} | 統計範圍：目前 Act · All Modes 公開資料` });

  if (result.isFallback) {
    embed.addFields({
      name: '資料備援',
      value: 'OP.GG 無可顯示的公開資料，本次改以 ValoCheck All Modes 呈現。',
      inline: false,
    });
  }

  if (stats.avatarUrl) embed.setThumbnail(stats.avatarUrl);

  return embed;
}

function buildLolEmbed(result) {
  const stats = result.stats;
  const record = stats.wins && stats.losses ? `${stats.wins} 勝 / ${stats.losses} 敗` : '網站未呈報';
  const flexText = stats.flex
    ? `${stats.flex.rank}${stats.flex.lp ? ` ${stats.flex.lp} LP` : ''}${stats.flex.winRate ? ` ｜ 勝率 ${stats.flex.winRate}` : ''}`
    : '網站未呈報';
  const embed = new EmbedBuilder()
    .setColor(0x0AC8B9)
    .setAuthor({ name: 'LEAGUE OF LEGENDS | 公開戰績總覽' })
    .setTitle(`⚔️ ${stats.playerId}`)
    .setURL(result.sourceUrl)
    .setDescription(ansiBlock([
      { color: COLORS.GOLD, text: `[單雙排] ${stats.rank}${stats.lp ? ` | ${stats.lp} LP` : ''}` },
      { color: COLORS.CYAN, text: `[勝敗] ${record} | 勝率 ${value(stats.winRate)}` },
      { color: COLORS.WHITE, text: `[KDA] ${value(stats.kda)}${stats.averageKda ? ` | ${stats.averageKda}` : ''}` },
    ]))
    .addFields(
      { name: '🎮 賽季場次', value: stats.seasonGames ? `${stats.seasonGames} 場` : '網站未呈報', inline: true },
      { name: '🌏 區服', value: stats.region, inline: true },
      { name: '🕒 資料更新', value: value(stats.updatedAt), inline: true },
      { name: '🏅 彈性積分', value: flexText, inline: false },
      { name: '🌟 常用英雄表現', value: formatLolChampions(stats.topChampions), inline: false },
    )
    .setFooter({ text: `來源：${result.source} | 統計範圍：目前賽季公開資料` });

  if (stats.avatarUrl) embed.setThumbnail(stats.avatarUrl);

  return embed;
}

function buildFailureEmbed(result, playerId) {
  const copy = {
    not_found: {
      title: '找不到公開戰績',
      color: 0x99AAB5,
      description: '可能是 Riot ID 輸入錯誤、帳號未公開，或來源網站尚未收錄資料。',
    },
    blocked: {
      title: '來源網站暫時拒絕查詢',
      color: 0xF1C40F,
      description: '公開戰績來源目前限制了自動查詢，請使用下方按鈕直接開啟網站查看。',
    },
    unavailable: {
      title: '戰績來源暫時無法連線',
      color: 0xE67E22,
      description: '來源網站可能維護中或連線逾時，稍後再查即可。',
    },
    parse_error: {
      title: '公開頁面格式已變更',
      color: 0xE67E22,
      description: '本王暫時讀不懂網站的新排版，但仍可由下方按鈕前往查看。',
    },
  };
  const state = copy[result.status] || copy.unavailable;

  return new EmbedBuilder()
    .setColor(state.color)
    .setTitle(`🐕 ${state.title}`)
    .setDescription(`**${playerId}**\n${state.description}`)
    .addFields({ name: '資料來源', value: result.source, inline: true })
    .setFooter({ text: '本功能只讀取第三方網站公開顯示的資料，不使用 API Key。' });
}

function value(content) {
  return content || '網站未呈報';
}

function formatValorantAgents(agents = []) {
  if (!agents.length) return '網站未呈報';
  return agents
    .map((agent, index) => agent.kda
      ? `**${index + 1}. ${agent.name}** ｜ ${agent.games} 場 ｜ 勝率 ${agent.winRate} ｜ KDA ${agent.kda} ｜ Avg ${agent.averageScore}`
      : `**${index + 1}. ${agent.name}** ｜ ${agent.games} 場 ｜ 勝率 ${agent.winRate} ｜ KD ${agent.kd}`)
    .join('\n');
}

function formatValorantWeapons(weapons = []) {
  if (!weapons.length) return '網站未呈報';
  return weapons
    .map((weapon, index) => `**${index + 1}. ${weapon.name}** ｜ ${weapon.kills} 擊殺 ｜ HS ${weapon.headshot}`)
    .join('\n');
}

function formatValorantMaps(maps = []) {
  if (!maps.length) return '網站未呈報';
  return maps
    .map((map, index) => `**${index + 1}. ${map.name}** ｜ ${map.record} ｜ 勝率 ${map.winRate}`)
    .join('\n');
}

function formatRecentHighlights(matches = []) {
  if (!matches.length) return '網站未呈報';
  return matches
    .map((match) => `**${match.map}** ${match.score} ｜ ${match.agent} ${match.kda} ｜ RR ${match.rrChange}`)
    .join('\n');
}

function formatLolChampions(champions = []) {
  if (!champions.length) return '網站未呈報';
  return champions
    .map((champion, index) => `**${index + 1}. ${champion.name}** ｜ ${champion.wins} 勝 ${champion.losses} 敗 ｜ 勝率 ${champion.winRate} ｜ KDA ${champion.kda}`)
    .join('\n');
}

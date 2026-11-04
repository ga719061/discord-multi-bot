import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { executePlayerControl } from './music.js';

export const data = new SlashCommandBuilder()
  .setName('播放器')
  .setDescription('🎵 查看或控制同一語音頻道的音樂播放器')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand(command => command.setName('現在播放').setDescription('開啟或前往頻道共用的播放器控制面板'))
  .addSubcommand(command => command.setName('佇列').setDescription('開啟私人待播佇列'))
  .addSubcommand(command => command.setName('暫停').setDescription('暫停目前歌曲'))
  .addSubcommand(command => command.setName('繼續').setDescription('繼續播放目前歌曲'))
  .addSubcommand(command => command.setName('下一首').setDescription('跳過目前歌曲並播放下一首'))
  .addSubcommand(command => command.setName('循環').setDescription('設定循環模式')
    .addStringOption(option => option.setName('模式').setDescription('選擇循環模式').setRequired(true)
      .addChoices({ name: '關閉', value: 'off' }, { name: '單曲', value: 'track' }, { name: '佇列', value: 'queue' })))
  .addSubcommand(command => command.setName('隨機').setDescription('隨機排列待播歌曲'))
  .addSubcommand(command => command.setName('停止').setDescription('停止播放、離開語音並清除播放器面板'));

export async function execute(interaction, services) {
  await executePlayerControl(interaction, services);
}

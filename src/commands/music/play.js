import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { executeYouTubePoint } from './music.js';

export const data = new SlashCommandBuilder()
  .setName('點播')
  .setDescription('🎵 點播 YouTube 或 Bilibili 單曲，未填連結時開啟私人輸入視窗')
  .setContexts(InteractionContextType.Guild)
  .addStringOption(option => option.setName('連結').setDescription('YouTube 或 Bilibili 單支影片連結').setMaxLength(2048));

export async function execute(interaction, services) {
  await executeYouTubePoint(interaction, services);
}

import { SlashCommandBuilder } from 'discord.js';
import { isRpgEnabled } from '../../rpg/rpgDatabase.js';
import { showHub } from '../../rpg/screens/hub.js';
import { showCreate } from '../../rpg/screens/create.js';
import { getCharacter } from '../../rpg/rpgDatabase.js';

export const data = new SlashCommandBuilder()
    .setName('rpg')
    .setDescription('🐕⚔️ 進入吉吉王國 RPG 冒險 world！')
    .setDescriptionLocalizations({ 'zh-TW': '🐕⚔️ 進入吉吉王國 RPG 冒險世界！' });

export async function execute(interaction) {
    if (!isRpgEnabled(interaction.guildId)) {
        return interaction.reply({
            content: '🐕 汪...RPG 系統目前未開啟！請管理員使用 `/setup-rpg enable` 來啟用。',
            flags: ['Ephemeral'],
        });
    }

    const char = getCharacter(interaction.guildId, interaction.user.id);
    if (!char) {
        // 首次：角色建立流程
        await showCreate(interaction, 'reply');
    } else {
        // 已有角色：主選單
        await showHub(interaction, char, 'reply');
    }
}

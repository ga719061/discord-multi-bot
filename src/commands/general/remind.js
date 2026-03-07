import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { addReminder, getUserReminders, deleteReminder } from '../../utils/database.js';
import { parseReminderTime } from '../../utils/reminderManager.js';
import { fmt, COLORS } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('remind')
    .setNameLocalizations({ 'zh-TW': '提醒' })
    .setDescription('⏰ 皇家提醒系統：讓國王為你記住重要的大事！')
    .setDescriptionLocalizations({ 'zh-TW': '⏰ 皇家提醒系統：讓國王為你記住重要的大事！' })
    .addSubcommand(sub =>
        sub.setName('set')
            .setNameLocalizations({ 'zh-TW': '設定' })
            .setDescription('設定一個新的提醒')
            .addStringOption(opt =>
                opt.setName('time')
                    .setNameLocalizations({ 'zh-TW': '時間' })
                    .setDescription('提醒時間 (如 10m, 1h, 16:00)')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('content')
                    .setNameLocalizations({ 'zh-TW': '內容' })
                    .setDescription('提醒的內容')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('list')
            .setNameLocalizations({ 'zh-TW': '清單' })
            .setDescription('查看你目前所有的提醒')
    )
    .addSubcommand(sub =>
        sub.setName('delete')
            .setNameLocalizations({ 'zh-TW': '刪除' })
            .setDescription('刪除指定的提醒')
            .addIntegerOption(opt =>
                opt.setName('id')
                    .setNameLocalizations({ 'zh-TW': '編號' })
                    .setDescription('提醒編號 (從清單查看)')
                    .setRequired(true)
            )
    );

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'set') {
        const timeStr = interaction.options.getString('time');
        const content = interaction.options.getString('content');
        
        const targetTime = parseReminderTime(timeStr);
        if (!targetTime) {
            return interaction.reply({
                content: '🐕 汪嗚！時間格式錯誤... 請使用 `10m`, `1h` 或 `16:00` 這種格式喔！',
                flags: ['Ephemeral']
            });
        }

        const timeDiff = targetTime - Date.now();
        if (timeDiff <= 0) {
            return interaction.reply({
                content: '🐕 汪！你設定的時間已經過去了耶... 本王沒辦法回到過去幫你提醒喔！',
                flags: ['Ephemeral']
            });
        }

        addReminder(interaction.guildId, interaction.channelId, interaction.user.id, content, targetTime);
        
        const dateStr = new Date(targetTime).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
        return interaction.reply({
            content: `🐕✅ 遵命！本王已記下了：\n> **內容**：${content}\n> **時間**：${dateStr}\n屆時本王會在這頻道準時汪一聲提醒你！`,
            flags: ['Ephemeral']
        });
    }

    if (subcommand === 'list') {
        const reminders = getUserReminders(interaction.user.id);
        
        if (reminders.length === 0) {
            return interaction.reply({
                content: '🐕 汪！你目前沒有任何待處理的提醒喔！真是個輕鬆自在的子民呢～',
                flags: ['Ephemeral']
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('📜 你的皇家提醒清單')
            .setDescription('以下是本王為你留意的待辦事項：')
            .setTimestamp();

        reminders.forEach(r => {
            const dateStr = new Date(r.target_time).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
            const info = [
                `${fmt(COLORS.CYAN, '🆔 編號')}: ${fmt(COLORS.BOLD, String(r.id))}`,
                `${fmt(COLORS.GOLD, '📅 時間')}: ${dateStr}`,
                `${fmt(COLORS.WHITE, '📝 內容')}: ${r.content}`
            ].join('\n');

            embed.addFields({
                name: `📌 提醒 #${r.id}`,
                value: '```ansi\n' + info + '\n```',
                inline: false
            });
        });

        return interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
    }

    if (subcommand === 'delete') {
        const id = interaction.options.getInteger('id');
        const result = deleteReminder(id, interaction.user.id);

        if (result.changes === 0) {
            return interaction.reply({
                content: `🐕 汪嗚...找不到編號為 \`${id}\` 的提醒，或者是那不屬於你。`,
                flags: ['Ephemeral']
            });
        }

        return interaction.reply({
            content: `🐕✅ 好的！本王已經把編號 \`${id}\` 的提醒從大典中抹去了！`,
            flags: ['Ephemeral']
        });
    }
}

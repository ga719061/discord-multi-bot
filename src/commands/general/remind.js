import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { addReminder, getUserReminders, deleteReminder } from '../../utils/database.js';
import { parseReminderTime } from '../../utils/reminderManager.js';
import { fmt, COLORS } from '../../utils/style.js';
import { embedsToV2Payload, v2Notice } from '../../utils/componentsV2.js';
import { UI_COLORS } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('提醒')
    .setDescription('⏰ 皇家提醒系統：讓國王為你記住重要的大事！')
    .setDescriptionLocalizations({ 'zh-TW': '⏰ 皇家提醒系統：讓國王為你記住重要的大事！' })
    .addSubcommand(sub =>
        sub.setName('設定')
            .setDescription('設定一個新的提醒')
            .addStringOption(opt =>
                opt.setName('時間')
                    .setDescription('提醒時間 (如 10m, 1h, 16:00)')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('內容')
                    .setDescription('提醒的內容')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('清單')
            .setDescription('查看你目前所有的提醒')
    )
    .addSubcommand(sub =>
        sub.setName('刪除')
            .setDescription('刪除指定的提醒')
            .addIntegerOption(opt =>
                opt.setName('編號')
                    .setDescription('提醒編號 (從清單查看)')
                    .setRequired(true)
            )
    );

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === '設定') {
        const timeStr = interaction.options.getString('時間');
        const content = interaction.options.getString('內容');
        
        const targetTime = parseReminderTime(timeStr);
        if (!targetTime) {
            return interaction.reply(v2Notice('⏰ 時間格式錯誤', '🐕 汪嗚！請使用 `10m`、`1h` 或 `16:00` 這種格式喔！', UI_COLORS.WARNING));
        }

        const timeDiff = targetTime - Date.now();
        if (timeDiff <= 0) {
            return interaction.reply(v2Notice('⏰ 時間已過', '🐕 本王沒辦法回到過去幫你提醒，請重新設定未來的時間喔！', UI_COLORS.WARNING));
        }

        addReminder(interaction.guildId, interaction.channelId, interaction.user.id, content, targetTime);
        
        const dateStr = new Date(targetTime).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
        return interaction.reply(v2Notice('⏰ 皇家提醒已登記', `🐕✅ 遵命！本王已記下了：\n> **內容**：${content}\n> **時間**：${dateStr}\n屆時本王會在這頻道準時汪一聲提醒你！`, UI_COLORS.SUCCESS));
    }

    if (subcommand === '清單') {
        const reminders = getUserReminders(interaction.user.id);
        
        if (reminders.length === 0) {
            return interaction.reply(v2Notice('📜 提醒清單空空如也', '🐕 你目前沒有任何待處理的提醒喔！真是個輕鬆自在的子民呢～', UI_COLORS.MUTED));
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

        return interaction.reply(embedsToV2Payload([embed], { ephemeral: true }));
    }

    if (subcommand === '刪除') {
        const id = interaction.options.getInteger('編號');
        const result = deleteReminder(id, interaction.user.id);

        if (result.changes === 0) {
            return interaction.reply(v2Notice('📜 找不到提醒', `🐕 汪嗚...找不到編號為 \`${id}\` 的提醒，或者是那不屬於你。`, UI_COLORS.WARNING));
        }

        return interaction.reply(v2Notice('📜 提醒已刪除', `🐕✅ 好的！本王已經把編號 \`${id}\` 的提醒從大典中抹去了！`, UI_COLORS.SUCCESS));
    }
}

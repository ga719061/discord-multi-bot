import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('摸摸')
    .setDescription('🐾 摸摸頭：試著摸摸國王，但請承擔被咬的風險')
    .setDescriptionLocalizations({ 'zh-TW': '🐾 摸摸頭：試著摸摸國王，但請承擔被咬的風險' });

const reactions = [
    { text: '🐕👑 汪～好舒服...本王允許你再摸一次！', mood: '😊', color: 0xFFD700 },
    { text: '🐕💢 汪！！你...你竟敢摸本王的頭！？\n...再摸一下啦...', mood: '😤', color: 0xFF6B6B },
    { text: '🐕✨ *搖尾巴* 嗯...本王今天心情不錯，賞你摸！', mood: '🥰', color: 0x57F287 },
    { text: '🐕💤 zzZ...本王正在午睡...你還摸？\n*翻了個身繼續睡*', mood: '😴', color: 0x99AAB5 },
    { text: '🐕👑 哼！本王才不是因為喜歡才讓你摸的！\n...只是今天特別恩准而已！汪！', mood: '😳', color: 0xFFA500 },
    { text: '🐕🎵 *開心地轉圈圈* 汪汪汪！本王最喜歡被摸了～\n...啊不對！本王是威嚴的國王！咳咳！', mood: '🤩', color: 0xFF69B4 },
    { text: '🐕👀 你的手...還挺溫暖的嘛...本王勉強接受！', mood: '☺️', color: 0xE6E6FA },
    { text: '🐕⚡ 汪！！靜電！！本王被電到了！！\n*毛全部炸起來*', mood: '⚡', color: 0xFFFF00 },
];

export async function execute(interaction) {
    const reaction = reactions[Math.floor(Math.random() * reactions.length)];

    const embed = new EmbedBuilder()
        .setColor(reaction.color)
        .setTitle(`${reaction.mood} 摸摸吉吉國王`)
        .setDescription(`${interaction.user} 摸了摸吉吉國王...\n\n${reaction.text}`)
        .setFooter({ text: '🐕 本王的心情是隨機的！汪！' });

    await interaction.reply({ embeds: [embed] });
}

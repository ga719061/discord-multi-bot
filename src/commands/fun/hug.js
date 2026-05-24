import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { embedsToV2Payload } from '../../utils/componentsV2.js';

export const data = new SlashCommandBuilder()
    .setName('抱抱')
    .setDescription('🤗 討抱抱：上前給吉吉國王一個大大的擁抱')
    .setDescriptionLocalizations({ 'zh-TW': '🤗 討抱抱：上前給吉吉國王一個大大的擁抱' })
    .addUserOption((opt) =>
        opt.setName('對象')
            .setDescription('或者...抱別人？（國王會吃醋喔）')
            .setDescriptionLocalizations({ 'zh-TW': '或者...抱別人？（國王會吃醋喔）' })
            .setRequired(false)
    );

const hugKingReactions = [
    { text: '🐕💕 汪～好溫暖...本王勉強讓你抱一下...\n*小小的身體縮在你懷裡* 嗯...不準放開。', color: 0xFF69B4 },
    { text: '🐕👑 哼！堂堂國王怎麼可以被人抱！\n...但你的懷抱好舒服...本王再待一下就好...汪。', color: 0xFFD700 },
    { text: '🐕✨ *瘋狂搖尾巴* 汪汪汪！抱抱！本王最喜歡抱抱了！！\n*在你臉上瘋狂舔*', color: 0x57F287 },
    { text: '🐕😤 你...你太大力了啦！本王是嬌小的吉娃娃欸！\n...但是不討厭就是了。汪。', color: 0xFFA500 },
    { text: '🐕💤 *在你懷裡睡著了* zzZ...汪...zzZ...\n（看起來國王睡得很香）', color: 0x99AAB5 },
    { text: '🐕🥺 汪...今天本王有點累...謝謝你的抱抱...\n*把小鼻子埋在你的衣服裡*', color: 0xE6E6FA },
];

const jealousReactions = [
    '🐕💢 什...什麼！？你不抱本王，要去抱別人！？\n本王...本王才不在乎呢！哼！*轉過頭*\n...偷偷看你們',
    '🐕😢 汪嗚...本王被拋棄了...你居然選擇別人...\n*蹲在角落用可憐的眼神看你*\n...快來道歉！',
    '🐕💢 喂！別的子民都不可以抱！只有本王可以被抱！\n這是本王的王令！！汪！！',
    '🐕😤 好啊！你去抱別人吧！本王自己舔自己就好了！\n...才怪！快回來抱本王！汪嗚！',
];

export async function execute(interaction) {
    const target = interaction.options.getUser('對象');

    if (target && target.id !== interaction.client.user.id) {
        // 抱別人 - 國王吃醋
        const jealous = jealousReactions[Math.floor(Math.random() * jealousReactions.length)];

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('🐕💔 吉吉國王吃醋了！')
            .setDescription(`${interaction.user} 抱了 ${target}...\n\n${jealous}`)
            .setFooter({ text: '🐕 本王的醋罈子打翻了！汪！' });

        await interaction.reply(embedsToV2Payload([embed]));
    } else {
        // 抱國王
        const reaction = hugKingReactions[Math.floor(Math.random() * hugKingReactions.length)];

        const embed = new EmbedBuilder()
            .setColor(reaction.color)
            .setTitle('🐕💕 抱抱吉吉國王')
            .setDescription(`${interaction.user} 把吉吉國王抱了起來...\n\n${reaction.text}`)
            .setFooter({ text: '🐕 本王的體溫 38.5°C，暖暖的喔～汪！' });

        await interaction.reply(embedsToV2Payload([embed]));
    }
}

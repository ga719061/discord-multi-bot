import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fmt, COLORS, UI_COLORS } from '../../utils/style.js';
import { embedsToV2Payload } from '../../utils/componentsV2.js';

export const data = new SlashCommandBuilder()
    .setName('餵食')
    .setDescription('🍖 進貢食物：挑選美食來餵食國王，小心別餵到有毒的東西！')
    .setDescriptionLocalizations({ 'zh-TW': '🍖 進貢食物：挑選美食來餵食國王，小心別餵到有毒的東西！' })
    .addStringOption((opt) =>
        opt.setName('食物')
            .setDescription('要餵什麼給國王？')
            .setDescriptionLocalizations({ 'zh-TW': '要餵什麼給國王？' })
            .setRequired(true)
            .addChoices(
                { name: '🥩 頂級牛排', value: 'steak' },
                { name: '🍖 雞腿', value: 'chicken' },
                { name: '🦴 骨頭', value: 'bone' },
                { name: '🍕 披薩', value: 'pizza' },
                { name: '🥦 花椰菜', value: 'broccoli' },
                { name: '🍫 巧克力', value: 'chocolate' },
                { name: '🍰 蛋糕', value: 'cake' },
                { name: '🍣 壽司', value: 'sushi' },
            )
    );

const foodReactions = {
    steak: {
        text: '🐕👑✨ 汪汪汪！！頂級牛排！！本王最愛的！！\n*瘋狂搖尾巴* 你是本王最忠實的子民！！',
        mood: '🤩', satisfaction: '★★★★★', color: UI_COLORS.ROYAL,
    },
    chicken: {
        text: '🐕👑 嗯～雞腿不錯，本王接受你的進貢！\n*優雅地啃著雞腿*',
        mood: '😋', satisfaction: '★★★★☆', color: UI_COLORS.FOOD,
    },
    bone: {
        text: '🐕🦴 經典骨頭！雖然不是什麼高級料理...\n但本王咬骨頭的時候最開心了！汪！\n*叼著骨頭跑走*',
        mood: '😆', satisfaction: '★★★☆☆', color: UI_COLORS.ROYAL_SOFT,
    },
    pizza: {
        text: '🐕🍕 噢！人類的食物！本王一直很好奇...\n*小心翼翼地咬一口* 汪！這什麼？好吃！！',
        mood: '😮', satisfaction: '★★★★☆', color: UI_COLORS.FOOD,
    },
    broccoli: {
        text: '🐕💢 你...你居然餵本王吃蔬菜！？\n本王是肉食主義的國王！！\n*把花椰菜甩到你臉上*',
        mood: '🤮', satisfaction: '☆☆☆☆☆', color: UI_COLORS.SUCCESS,
    },
    chocolate: {
        text: '🐕⚠️ 等等！本王雖然是國王但也是吉娃娃！\n巧克力對狗狗有毒啦！你是想暗殺本王嗎！？\n*警戒地後退三步*',
        mood: '😨', satisfaction: '💀危險💀', color: UI_COLORS.DANGER,
    },
    cake: {
        text: '🐕🎂 蛋糕！本王最喜歡甜食了～\n*整張臉埋進蛋糕裡* 汪...本王的臉上全是奶油...',
        mood: '🥳', satisfaction: '★★★★☆', color: UI_COLORS.FUN,
    },
    sushi: {
        text: '🐕🍣 壽司？本王可是很有品味的！\n*用小爪子夾起壽司* 嗯...這個鮭魚不錯！本王給你加分！',
        mood: '🧐', satisfaction: '★★★★☆', color: UI_COLORS.DANGER,
    },
};

export async function execute(interaction) {
    const food = interaction.options.getString('食物');
    const reaction = foodReactions[food];

    const embed = new EmbedBuilder()
        .setColor(reaction.color)
        .setTitle(`${reaction.mood} 餵食吉吉國王`)
        .setDescription(
            `${interaction.user} 拿出食物餵吉吉國王...\n\n` +
            '```ansi\n' + fmt(COLORS.CYAN, reaction.text) + '\n```'
        )
        .addFields(
            { name: '⭐ 滿意度', value: '```ansi\n' + fmt(COLORS.GOLD, reaction.satisfaction) + '\n```', inline: true }
        )
        .setFooter({ text: '🐕 本王的胃口可是很挑剔的！汪！' });

    await interaction.reply(embedsToV2Payload([embed]));
}

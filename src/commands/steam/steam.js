import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fmt, COLORS, ansiBlock } from '../../utils/style.js';
import { fetchSteamJson, getSteamFailureMessage } from '../../utils/steamDeals.js';
import { logger } from '../../utils/logger.js';
import { embedsToV2Payload, v2EditPayload, v2Notice } from '../../utils/componentsV2.js';
import { UI_COLORS } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('特價查詢')
    .setDescription('🎮 皇家採購辦公室：查詢 Steam 平台上的遊戲特價與情報')
    .addSubcommand(sub =>
        sub.setName('搜尋')
            .setDescription('🐕🔎 替國王尋找遊戲價格與情報！')
            .addStringOption(opt =>
                opt.setName('遊戲名稱')
                    .setDescription('想找什麼遊戲？')
                    .setRequired(true)
            )
    );

export async function execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === '搜尋') {
        const query = interaction.options.getString('遊戲名稱');
        await interaction.deferReply();
        await handleSearch(interaction, query);
    }
}

async function handleSearch(interaction, query) {
    try {
        const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=tchinese&cc=tw`;
        const searchData = await fetchSteamJson(searchUrl);

        if (!searchData.items || searchData.items.length === 0) {
            return interaction.editReply(v2EditPayload(v2Notice('🎮 沒有搜尋結果', '🐕❓ 汪？本王聞不到這個遊戲的味道... 你確定名字沒打錯嗎？', UI_COLORS.MUTED, { ephemeral: false })));
        }

        const game = searchData.items[0];
        const appId = game.id;

        const detailUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=tw&l=tchinese`;
        const detailData = await fetchSteamJson(detailUrl);

        if (!detailData[appId] || !detailData[appId].success) {
            return interaction.editReply(v2EditPayload(v2Notice('🎮 詳細資料不可用', '🐕📜 Steam 找到了遊戲，但暫時沒有可顯示的詳細資料。', UI_COLORS.WARNING, { ephemeral: false })));
        }

        const details = detailData[appId].data;
        const price = details.price_overview;
        const isFree = details.is_free;
        const releaseDate = details.release_date?.date;

        let statusLine = '';
        let color = 0x0099FF;

        if (isFree) {
            statusLine = fmt(COLORS.GREEN, '🆓 本王宣布：全體子民免費開玩！');
            color = 0x00FF00;
        } else if (price) {
            const finalPrice = price.final_formatted;
            const discount = price.discount_percent;
            if (discount > 0) {
                statusLine = fmt(COLORS.GOLD, `🔥 皇家大促銷：現省 ${discount}%！只要 ${finalPrice}`);
                color = 0x00FF00;
            } else {
                statusLine = fmt(COLORS.GRAY, `💰 皇家公定價：${finalPrice} (目前無特價)`);
            }
        } else {
            statusLine = fmt(COLORS.BLUE, '📅 敬請期待：尚未公布售價或為預售商品');
        }

        const infoBlock = ansiBlock([
            { color: COLORS.CYAN, text: `發行日期: ${releaseDate || '未知'}` },
            { color: COLORS.WHITE, text: `媒體評價: ${details.metacritic?.score || '暫無評分'}` },
            { color: COLORS.GOLD, text: `====================================` },
            { color: COLORS.BLUE, text: statusLine }
        ]);

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`🐕🎮 ${details.name}`)
            .setURL(`https://store.steampowered.com/app/${appId}/`)
            .setImage(details.header_image)
            .setDescription(
                `**王國評價：**\n${details.short_description || '本王無話可說。'}\n\n` +
                infoBlock
            )
            .setFooter({ text: '🛒 皇家採購手冊 | 汪！把錢錢變成喜歡的樣子吧！' });

        await interaction.editReply(v2EditPayload(embedsToV2Payload([embed])));

    } catch (error) {
        logger.warn(`[SteamSearch] 查詢失敗 guild=${interaction.guildId} code=${error.code || 'unavailable'}: ${error.message}`);
        await interaction.editReply(v2EditPayload(v2Notice('🎮 Steam 查詢失敗', getSteamFailureMessage(error), UI_COLORS.WARNING, { ephemeral: false })));
    }
}

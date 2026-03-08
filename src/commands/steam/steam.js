import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fmt, COLORS, ansiBlock } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('steam')
    .setNameLocalizations({ 'zh-TW': '特價查詢' })
    .setDescription('🎮 皇家採購辦公室：查詢 Steam 平台上的遊戲特價與情報')
    .addSubcommand(sub =>
        sub.setName('search')
            .setNameLocalizations({ 'zh-TW': '搜尋' })
            .setDescription('🐕🔎 替國王尋找遊戲價格與情報！')
            .addStringOption(opt =>
                opt.setName('game')
                    .setNameLocalizations({ 'zh-TW': '遊戲名稱' })
                    .setDescription('想找什麼遊戲？')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('sales')
            .setNameLocalizations({ 'zh-TW': '特價列表' })
            .setDescription('🐕🔥 查看當前最火熱的皇家折扣清單！')
    );

export async function execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'search') {
        const query = interaction.options.getString('game');
        await interaction.deferReply();
        await handleSearch(interaction, query);
    } else if (sub === 'sales') {
        await interaction.deferReply();
        await handleSales(interaction);
    }
}

async function handleSearch(interaction, query) {
    try {
        const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=tchinese&cc=tw`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        if (!searchData.items || searchData.items.length === 0) {
            return interaction.editReply('🐕❓ 汪？本王聞不到這個遊戲的味道... 你確定名字沒打錯嗎？');
        }

        const game = searchData.items[0];
        const appId = game.id;

        const detailUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=tw&l=tchinese`;
        const detailRes = await fetch(detailUrl);
        const detailData = await detailRes.json();

        if (!detailData[appId] || !detailData[appId].success) {
            return interaction.editReply('🐕💔 汪... Steam 好像壞掉了，本王讀不到資料！');
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

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Steam Search Error:', error);
        await interaction.editReply('🐕💥 汪！搜尋時發生錯誤，本王頭好痛...');
    }
}

async function handleSales(interaction) {
    try {
        const url = 'https://store.steampowered.com/api/featuredcategories?l=tchinese&cc=tw';
        const res = await fetch(url);
        const data = await res.json();

        const specials = data.specials?.items;
        if (!specials || specials.length === 0) {
            return interaction.editReply('🐕❓ 汪？現在好像沒什麼特別的特價活動耶...');
        }

        const top8 = specials.slice(0, 8);
        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🐕🔥 皇家採購清單：Steam 熱門特價快報！')
            .setDescription('汪汪！本王精選了最值得放入國庫的特價遊戲！')
            .setTimestamp()
            .setFooter({ text: '💸 這些都在大特價！快把錢錢交出來！汪！' });

        const list = top8.map(game => {
            const final = `$${game.final_price / 100}`;
            const discount = game.discount_percent;
            return `**[${game.name}](https://store.steampowered.com/app/${game.id})**\n` +
                   '```ansi\n' + fmt(COLORS.GOLD, `📉 -${discount}%`) + ' ➔ ' + fmt(COLORS.GREEN, `${final} TWD`) + '\n```';
        }).join('\n');

        embed.addFields({ name: '🛍️ 今日必買項目', value: list });

        if (top8.length > 0) {
            embed.setThumbnail(top8[0].large_capsule_image || top8[0].header_image);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Steam Sales Error:', error);
        await interaction.editReply('🐕💥 汪！讀取特價列表失敗，Steam 可能在維修？');
    }
}

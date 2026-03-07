import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('steam')
    .setNameLocalizations({ 'zh-TW': '特價查詢' })
    .setDescription('🎮 御用百視達：查詢 Steam 平台上的遊戲特價與評價情報')
    .setDescriptionLocalizations({ 'zh-TW': '🎮 御用百視達：查詢 Steam 平台上的遊戲特價與評價情報' })
    .addSubcommand(sub =>
        sub.setName('search')
            .setNameLocalizations({ 'zh-TW': '搜尋' })
            .setDescription('🐕🔎 幫你找遊戲價格！')
            .setDescriptionLocalizations({ 'zh-TW': '🐕🔎 幫你找遊戲價格！' })
            .addStringOption(opt =>
                opt.setName('game')
                    .setNameLocalizations({ 'zh-TW': '遊戲名稱' })
                    .setDescription('想找什麼遊戲？')
                    .setDescriptionLocalizations({ 'zh-TW': '想找什麼遊戲？' })
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('sales')
            .setNameLocalizations({ 'zh-TW': '特價列表' })
            .setDescription('🐕🔥 看看現在什麼在特價！')
            .setDescriptionLocalizations({ 'zh-TW': '🐕🔥 看看現在什麼在特價！' })
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

        const embed = new EmbedBuilder()
            .setTitle(`🐕🎮 ${details.name}`)
            .setURL(`https://store.steampowered.com/app/${appId}/`)
            .setImage(details.header_image)
            .setDescription(details.short_description || '（這遊戲太神祕了，沒有介紹... 汪！）')
            .addFields(
                { name: '📅 發行日期', value: releaseDate || '未知', inline: true },
                { name: '⭐ 評價', value: details.metacritic ? `${details.metacritic.score}` : '無', inline: true }
            )
            .setFooter({ text: '🛒 Steam 台灣區價格 | 汪！快買給本王玩！' });

        if (isFree) {
            embed.setColor(0x00FF00);
            embed.addFields({ name: '💰 價格', value: '🆓 免費開玩！白嫖最棒！汪！', inline: true });
        } else if (price) {
            const originalPrice = price.initial_formatted || `${price.initial / 100} TWD`;
            const finalPrice = price.final_formatted || `${price.final / 100} TWD`;
            const discount = price.discount_percent;

            if (discount > 0) {
                embed.setColor(0x00FF00);
                embed.addFields(
                    { name: '💰 原價', value: `~~${originalPrice}~~`, inline: true },
                    { name: '🔥 特價', value: `**${finalPrice}**`, inline: true },
                    { name: '📉 折扣', value: `**-${discount}%** OFF! 本王批准購買！`, inline: true }
                );
            } else {
                embed.setColor(0x0099FF);
                embed.addFields({ name: '💰 價格', value: finalPrice, inline: true });
                embed.setDescription(embed.data.description + '\n\n🐕😐 這個沒特價喔... 還是原價賣給盤子... 汪...');
            }
        } else {
            embed.setColor(0x0099FF);
            embed.addFields({ name: '💰 價格', value: '未公開 / 預售 / 組合包', inline: true });
        }

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

        const top10 = specials.slice(0, 10);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🐕🔥 Steam 熱門特價快報！')
            .setTimestamp()
            .setFooter({ text: '💸 這些都在大特價！快把錢錢交出來！汪！' });

        const fields = top10.map(game => {
            const original = game.original_price ? `$${game.original_price / 100}` : '???';
            const final = game.final_price ? `$${game.final_price / 100}` : '???';
            const discount = game.discount_percent;

            return `**[${game.name}](https://store.steampowered.com/app/${game.id})**\n📉 **-${discount}%** (~~${original}~~ -> **${final}** TWD)`;
        });

        embed.setDescription(`汪汪！本王精選了最火熱的折扣遊戲！\n買了記得分本王玩喔！\n\n${fields.join('\n\n')}`);

        if (top10.length > 0) {
            embed.setThumbnail(top10[0].large_capsule_image || top10[0].header_image);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Steam Sales Error:', error);
        await interaction.editReply('🐕💥 汪！讀取特價列表失敗，Steam 可能在維修？');
    }
}

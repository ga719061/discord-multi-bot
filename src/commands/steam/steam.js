import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { fmt, COLORS, ansiBlock, UI_COLORS } from '../../utils/style.js';
import { fetchSteamJson, getSteamFailureMessage } from '../../utils/steamDeals.js';
import { logger } from '../../utils/logger.js';
import { embedsToV2Payload, ephemeralV2Payload, v2Divider, v2EditPayload, v2Notice, v2Panel, v2Text } from '../../utils/componentsV2.js';

const QUERY_TIMEOUT = 10 * 60_000;

export const data = new SlashCommandBuilder()
    .setName('特價查詢')
    .setDescription('🐕🎮 開啟皇家採購簿，查詢 Steam 遊戲特價與情報');

export async function execute(interaction) {
    const sessionId = interaction.id;
    const modal = buildSteamSearchModal(sessionId);
    await interaction.showModal(modal);
    const submit = await interaction.awaitModalSubmit({
        time: 2 * 60_000,
        filter: (candidate) => candidate.user.id === interaction.user.id && candidate.customId === modal.data.custom_id,
    }).catch(() => null);
    if (!submit) return;

    const query = submit.fields.getTextInputValue('game_name').trim();
    await submit.deferReply({ flags: MessageFlags.Ephemeral });
    const candidates = await findSteamCandidates(submit, query);
    if (!candidates) return;

    const state = { result: null, published: false };
    await submit.editReply(v2EditPayload(buildSteamSelectionPayload(sessionId, query, candidates)));
    const response = await submit.fetchReply();
    const collector = response.createMessageComponentCollector({ time: QUERY_TIMEOUT });

    collector.on('collect', async (component) => {
        try {
            if (component.user.id !== interaction.user.id) {
                return component.reply(v2Notice(
                    '🐕🛒 這份採購情報不屬於你',
                    '請使用 `/特價查詢` 開啟自己的皇家採購簿。',
                    UI_COLORS.WARNING
                ));
            }
            if (component.customId === steamId(sessionId, 'select')) {
                const appId = Number(component.values[0]);
                const candidate = candidates.find((game) => game.id === appId);
                if (!candidate) {
                    return component.reply(v2Notice(
                        '🛒 採購選項已失效',
                        '這筆候選遊戲已無法辨識，請重新使用 `/特價查詢`。',
                        UI_COLORS.WARNING
                    ));
                }
                await component.deferUpdate();
                const details = await fetchSteamDetails(component, appId);
                if (!details) return;
                state.result = { appId, details };
                return component.editReply(v2EditPayload(buildSteamSearchResultPayload(appId, details, {
                    ephemeral: true,
                    publishCustomId: steamId(sessionId, 'publish'),
                })));
            }
            if (component.customId !== steamId(sessionId, 'publish')) return;
            if (!state.result) return;
            if (state.published) {
                return component.reply(v2Notice(
                    '🛒 情報已頒布',
                    '本王已將這份採購情報張貼至原頻道，不會重複發布。',
                    UI_COLORS.WARNING
                ));
            }

            await component.deferUpdate();
            await interaction.channel.send(buildSteamSearchResultPayload(state.result.appId, state.result.details));
            state.published = true;
            await component.editReply(v2EditPayload(buildSteamSearchResultPayload(state.result.appId, state.result.details, {
                ephemeral: true,
                publishCustomId: steamId(sessionId, 'publish'),
                published: true,
            })));
        } catch (error) {
            logger.warn(`[SteamSearch] 發布失敗 guild=${interaction.guildId} code=${error.code || 'unavailable'}: ${error.message}`);
            const notice = v2Notice('🐕💥 採購情報發布失敗', '本王暫時無法將情報張貼到頻道，請稍後再試。', UI_COLORS.DANGER);
            if (component.replied || component.deferred) await component.followUp(notice).catch(() => {});
            else await component.reply(notice).catch(() => {});
        }
    });

    collector.on('end', () => {
        const expired = state.result
            ? buildSteamSearchResultPayload(state.result.appId, state.result.details, {
                ephemeral: true,
                publishCustomId: steamId(sessionId, 'publish'),
                published: state.published,
                expired: true,
            })
            : buildSteamSelectionPayload(sessionId, query, candidates, true);
        submit.editReply(v2EditPayload(expired)).catch(() => {});
    });
}

export function buildSteamSearchModal(sessionId) {
    const description = new TextDisplayBuilder()
        .setContent('**功能說明**\n輸入 Steam 遊戲名稱後，本王會列出候選清單；選取遊戲即可查看台灣價格、折扣、上市日與評分，並可一鍵發布到目前頻道。');
    const input = new TextInputBuilder()
        .setCustomId('game_name')
        .setLabel('請輸入 Steam 遊戲名稱')
        .setPlaceholder('例如：Stardew Valley、Palworld、Monster Hunter')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(120)
        .setRequired(true);
    return new ModalBuilder()
        .setCustomId(steamId(sessionId, 'submit'))
        .setTitle('皇家採購簿 | Steam 搜尋')
        .addTextDisplayComponents(description)
        .addComponents(new ActionRowBuilder().addComponents(input));
}

export function buildSteamSelectionPayload(sessionId, query, candidates, disabled = false) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(steamId(sessionId, 'select'))
        .setPlaceholder('挑選正確遊戲，查看皇家採購情報')
        .setMinValues(1)
        .setMaxValues(1)
        .setDisabled(disabled)
        .addOptions(candidates.slice(0, 10).map((game) => ({
            label: truncateOption(game.name, 100),
            description: truncateOption(`Steam App ${game.id} | 選取後查看目前價格`, 100),
            value: String(game.id),
        })));
    const panel = v2Panel(UI_COLORS.STEAM)
        .addTextDisplayComponents(v2Text([
            '# 🐕🎮 皇家採購搜尋結果',
            `本王在 Steam 倉庫裡翻到了與 **${query}** 相符的遊戲，請挑選要查閱的一款。`,
            '-# 選定後會私下呈上目前價格、評價與商店入口。',
        ].join('\n')))
        .addSeparatorComponents(v2Divider())
        .addActionRowComponents(new ActionRowBuilder().addComponents(select));
    if (disabled) {
        panel.addTextDisplayComponents(v2Text('## ⌛ 採購查詢已結束\n請重新使用 `/特價查詢` 尋找遊戲。'));
    }
    return ephemeralV2Payload([panel]);
}

export function buildSteamSearchResultPayload(appId, details, options = {}) {
    const price = details.price_overview;
    const isFree = details.is_free;
    const releaseDate = details.release_date?.date;
    let statusLine = '';
    let color = UI_COLORS.STEAM;

    if (isFree) {
        statusLine = fmt(COLORS.GREEN, '🆓 本王宣布：全體子民免費開玩！');
        color = UI_COLORS.SUCCESS;
    } else if (price) {
        const finalPrice = price.final_formatted;
        const discount = price.discount_percent;
        if (discount > 0) {
            statusLine = fmt(COLORS.GOLD, `🔥 皇家大促銷：現省 ${discount}%！只要 ${finalPrice}`);
            color = UI_COLORS.SUCCESS;
        } else {
            statusLine = fmt(COLORS.GRAY, `💰 皇家公定價：${finalPrice} (目前無特價)`);
        }
    } else {
        statusLine = fmt(COLORS.BLUE, '📅 敬請期待：尚未公布售價或為預售商品');
    }

    const infoBlock = ansiBlock([
        { color: COLORS.CYAN, text: `發行日期: ${releaseDate || '未知'}` },
        { color: COLORS.WHITE, text: `媒體評價: ${details.metacritic?.score || '暫無評分'}` },
        { color: COLORS.GOLD, text: '====================================' },
        { color: COLORS.BLUE, text: statusLine },
    ]);
    const buttons = [
        new ButtonBuilder()
            .setLabel('前往 Steam 商店')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://store.steampowered.com/app/${appId}/`),
    ];
    if (options.publishCustomId) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(options.publishCustomId)
                .setLabel(options.published ? '情報已頒布' : options.expired ? '頒布期限已過' : '頒布至目前頻道')
                .setStyle(options.published ? ButtonStyle.Success : ButtonStyle.Primary)
                .setDisabled(Boolean(options.published || options.expired))
        );
    }
    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: options.ephemeral === true ? '吉吉國王皇家採購廳 | 私人情報呈報' : '吉吉國王皇家採購廳 | 公開採購情報' })
        .setTitle(`🐕🎮 ${details.name}`)
        .setURL(`https://store.steampowered.com/app/${appId}/`)
        .setImage(details.header_image)
        .setDescription(`**王國評價：**\n${details.short_description || '本王暫無評語。'}\n\n${infoBlock}`)
        .setFooter({ text: '🛒 皇家採購手冊 | 汪！把錢錢變成喜歡的樣子吧！' });

    return embedsToV2Payload([embed], {
        actionRows: [new ActionRowBuilder().addComponents(buttons)],
        ephemeral: options.ephemeral === true,
        linkTitle: false,
    });
}

async function findSteamCandidates(interaction, query) {
    try {
        const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=tchinese&cc=tw`;
        const searchData = await fetchSteamJson(searchUrl);

        if (!searchData.items || searchData.items.length === 0) {
            await interaction.editReply(v2EditPayload(v2Notice(
                '🎮 皇家採購簿查無結果',
                '🐕❓ 汪？本王聞不到這個遊戲的味道，請確認名稱後再召喚一次。',
                UI_COLORS.MUTED
            )));
            return null;
        }

        return searchData.items.slice(0, 10);
    } catch (error) {
        logger.warn(`[SteamSearch] 查詢失敗 guild=${interaction.guildId} code=${error.code || 'unavailable'}: ${error.message}`);
        await interaction.editReply(v2EditPayload(v2Notice('🎮 皇家採購查詢失敗', getSteamFailureMessage(error), UI_COLORS.WARNING)));
        return null;
    }
}

async function fetchSteamDetails(interaction, appId) {
    try {
        const detailUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=tw&l=tchinese`;
        const detailData = await fetchSteamJson(detailUrl);
        if (!detailData[appId] || !detailData[appId].success) {
            await interaction.editReply(v2EditPayload(v2Notice(
                '🎮 皇家卷宗暫不可用',
                '🐕📜 Steam 找到了遊戲，但暫時沒有可呈上的詳細資料。',
                UI_COLORS.WARNING
            )));
            return null;
        }
        return detailData[appId].data;
    } catch (error) {
        logger.warn(`[SteamSearch] 詳情查詢失敗 guild=${interaction.guildId} app=${appId} code=${error.code || 'unavailable'}: ${error.message}`);
        await interaction.editReply(v2EditPayload(v2Notice('🎮 皇家採購查詢失敗', getSteamFailureMessage(error), UI_COLORS.WARNING)));
        return null;
    }
}

function truncateOption(text, maxLength) {
    const value = String(text || '-');
    return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

function steamId(sessionId, action) {
    return `steam_search:${sessionId}:${action}`;
}

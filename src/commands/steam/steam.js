import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { ansiRows, UI_COLORS } from '../../utils/style.js';
import { fetchSteamJson, getSteamFailureMessage } from '../../utils/steamDeals.js';
import { logger } from '../../utils/logger.js';
import { ephemeralV2Payload, v2Card, v2Divider, v2EditPayload, v2Notice, v2Panel, v2Payload, v2Text } from '../../utils/componentsV2.js';

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

    const state = { result: null, publishedAppIds: new Set() };
    await submit.editReply(v2EditPayload(buildSteamSelectionPayload(sessionId, query, candidates)));
    const response = await submit.fetchReply();
    const collector = response.createMessageComponentCollector({ time: QUERY_TIMEOUT });

    collector.on('collect', async (component) => {
        try {
            if (component.user.id !== interaction.user.id) {
                return component.reply(v2Notice(
                    '🐕🛒 汪！這份皇家採購情報不屬於你',
                    '請子民自行使用 `/特價查詢` 翻閱自己的皇家採購簿！',
                    UI_COLORS.WARNING
                ));
            }
            if (component.customId === steamId(sessionId, 'select')) {
                const appId = Number(component.values[0]);
                const candidate = candidates.find((game) => game.id === appId);
                if (!candidate) {
                    return component.reply(v2Notice(
                        '🐕📜 皇家採購選項已失效',
                        '汪！這筆候選遊戲已無法辨識，請子民重新使用 `/特價查詢`。',
                        UI_COLORS.WARNING
                    ));
                }
                await component.deferUpdate();
                const details = await fetchSteamDetails(component, appId);
                if (!details) return;
                state.result = { appId, details, published: state.publishedAppIds.has(appId) };
                return component.editReply(v2EditPayload(buildSteamSearchResultPayload(appId, details, {
                    ephemeral: true,
                    publishCustomId: steamId(sessionId, 'publish'),
                    backCustomId: steamId(sessionId, 'back'),
                    requeryCustomId: steamId(sessionId, 'requery'),
                    published: state.result.published,
                })));
            }
            if (component.customId === steamId(sessionId, 'back')) {
                state.result = null;
                await component.deferUpdate();
                return component.editReply(v2EditPayload(buildSteamSelectionPayload(sessionId, query, candidates)));
            }
            if (component.customId === steamId(sessionId, 'requery')) {
                collector.stop('restart');
                return await execute(component);
            }
            if (component.customId !== steamId(sessionId, 'publish')) return;
            if (!state.result) return;
            if (state.result.published) {
                return component.reply(v2Notice(
                    '🐕👑 聖旨已頒布',
                    '汪！本王已將這份採購情報張貼至原頻道，不得重複頒布！',
                    UI_COLORS.WARNING
                ));
            }

            await component.deferUpdate();
            await interaction.channel.send(buildSteamSearchResultPayload(state.result.appId, state.result.details));
            state.result.published = true;
            state.publishedAppIds.add(state.result.appId);
            await component.editReply(v2EditPayload(buildSteamSearchResultPayload(state.result.appId, state.result.details, {
                ephemeral: true,
                publishCustomId: steamId(sessionId, 'publish'),
                backCustomId: steamId(sessionId, 'back'),
                requeryCustomId: steamId(sessionId, 'requery'),
                published: true,
            })));
        } catch (error) {
            logger.warn(`[SteamSearch] 發布失敗 guild=${interaction.guildId} code=${error.code || 'unavailable'}: ${error.message}`);
            const notice = v2Notice('🐕💥 皇家採購情報發布失敗', '汪！本王暫時無法將情報張貼到頻道，請子民稍後再試。', UI_COLORS.DANGER);
            if (component.replied || component.deferred) await component.followUp(notice).catch(() => {});
            else await component.reply(notice).catch(() => {});
        }
    });

    collector.on('end', () => {
        const expired = state.result
            ? buildSteamSearchResultPayload(state.result.appId, state.result.details, {
                ephemeral: true,
                publishCustomId: steamId(sessionId, 'publish'),
                backCustomId: steamId(sessionId, 'back'),
                requeryCustomId: steamId(sessionId, 'requery'),
                published: state.result.published,
                expired: true,
            })
            : buildSteamSelectionPayload(sessionId, query, candidates, true);
        submit.editReply(v2EditPayload(expired)).catch(() => {});
    });
}

export function buildSteamSearchModal(sessionId) {
    const description = new TextDisplayBuilder()
        .setContent('**功能說明**\n輸入 Steam 遊戲名稱後，本王會列出候選清單；子民選取遊戲即可查看台灣價格、折扣、上市日與評分，並可一鍵頒布到目前頻道。');
    const input = new TextInputBuilder()
        .setCustomId('game_name')
        .setPlaceholder('例如：Stardew Valley、Palworld、Monster Hunter')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(120)
        .setRequired(true);
    return new ModalBuilder()
        .setCustomId(steamId(sessionId, 'submit'))
        .setTitle('皇家採購簿 | Steam 搜尋')
        .addTextDisplayComponents(description)
        .addLabelComponents(
            new LabelBuilder()
                .setLabel('Steam 遊戲名稱')
                .setDescription('可輸入中文或英文名稱，送出後再從候選清單選擇。')
                .setTextInputComponent(input)
        );
}

export function buildSteamSelectionPayload(sessionId, query, candidates, disabled = false) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(steamId(sessionId, 'select'))
        .setPlaceholder('請挑選正確遊戲，查看皇家採購情報')
        .setMinValues(1)
        .setMaxValues(1)
        .setDisabled(disabled)
        .addOptions(candidates.slice(0, 25).map((game) => ({
            label: truncateOption(game.name, 100),
            description: truncateOption(`Steam App ${game.id} | 選取後覲見目前價格`, 100),
            value: String(game.id),
        })));
    const panel = v2Panel(UI_COLORS.STEAM)
        .addTextDisplayComponents(v2Text([
            '# 🐕🎮 皇家採購搜尋結果',
            '汪！本王已整理相符的遊戲，請子民挑選要查閱的一款。',
            '-# 選定後本王會私下呈上目前價格、評價與商店入口。',
        ].join('\n')))
        .addSeparatorComponents(v2Divider())
        .addTextDisplayComponents(v2Text(ansiRows([
            { label: '搜尋', value: query, tone: 'info' },
            { label: '候選', value: `${candidates.length} 款遊戲`, tone: 'success' },
        ])))
        .addSeparatorComponents(v2Divider())
        .addActionRowComponents(new ActionRowBuilder().addComponents(select));
    if (disabled) {
        panel.addTextDisplayComponents(v2Text('## ⌛ 皇家採購查詢已結束\n請子民重新使用 `/特價查詢` 尋找遊戲。'));
    }
    return ephemeralV2Payload([panel]);
}

export function buildSteamSearchResultPayload(appId, details, options = {}) {
    const price = details.price_overview;
    const isFree = details.is_free;
    const releaseDate = details.release_date?.date;
    let priceValue = '價格尚未公布';
    let discountValue = '無折扣資訊';
    let priceTone = 'warning';
    let color = UI_COLORS.STEAM;

    if (isFree) {
        priceValue = '免費遊玩';
        discountValue = '不適用';
        priceTone = 'success';
        color = UI_COLORS.SUCCESS;
    } else if (price) {
        priceValue = price.final_formatted;
        const discount = price.discount_percent;
        if (discount > 0) {
            discountValue = `-${discount}%`;
            priceTone = 'success';
            color = UI_COLORS.SUCCESS;
        } else {
            discountValue = '目前無折扣';
            priceTone = 'neutral';
        }
    }
    const buttons = [
        new ButtonBuilder()
            .setLabel('前往 Steam 商店覲見')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://store.steampowered.com/app/${appId}/`),
    ];
    if (options.publishCustomId) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(options.publishCustomId)
                .setLabel(options.published ? '聖旨已頒布' : options.expired ? '覲見期限已過' : '頒布至目前頻道')
                .setStyle(options.published ? ButtonStyle.Success : ButtonStyle.Primary)
                .setDisabled(Boolean(options.published || options.expired))
        );
    }
    if (options.backCustomId) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(options.backCustomId)
                .setLabel('返回候選清單')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(Boolean(options.expired)),
        );
    }
    if (options.requeryCustomId) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(options.requeryCustomId)
                .setLabel('重新搜尋')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(Boolean(options.expired)),
        );
    }
    const panel = v2Card({
        title: `🎮 ${details.name}`,
        description: options.ephemeral === true
            ? '**皇家採購廳 · 私人情報**'
            : '**皇家採購廳 · 公開採購情報**',
        accentColor: color,
        statusRows: [
            { label: '範圍', value: options.ephemeral === true ? '私人情報' : '公開情報', tone: 'info' },
            { label: '價格', value: priceValue, tone: priceTone },
            { label: '折扣', value: discountValue, tone: priceTone },
            { label: '評分', value: details.metacritic?.score ?? '暫無評分', tone: details.metacritic?.score == null ? 'neutral' : 'special' },
            { label: '發售', value: releaseDate || '尚未公布', tone: 'neutral' },
        ],
        fields: [
            { name: '遊戲簡介', value: details.short_description || '目前沒有遊戲簡介。' },
        ],
        images: details.header_image ? [{
            url: details.header_image,
            description: `${details.name} 的 Steam 商店封面`,
        }] : [],
        footer: '價格與評分以 Steam 商店目前顯示為準。',
        actionRows: [new ActionRowBuilder().addComponents(buttons)],
    });
    return options.ephemeral === true ? ephemeralV2Payload([panel]) : v2Payload([panel]);
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

        return searchData.items.slice(0, 25);
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
                '🐕📜 汪！Steam 倉庫找到了遊戲，但暫時沒有可呈上的詳細資料，本王稍後再看。',
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

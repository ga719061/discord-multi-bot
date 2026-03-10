import { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getCharacter, updateCharacter, addToInventory, addEquipment, getInventory, getEquipmentList, removeFromInventory } from '../rpgDatabase.js';
import { rpgEmbed, rpgButton, qualityLabel, backButton, ansiText, safeReply, getEquipFullName, formatItemName, widePad } from '../rpgHelpers.js';
import { SHOP_ITEMS, EQUIPMENT, ITEM_NAMES, QUALITY_MULTIPLIER, getItemDisplayName, SKILL_BOOKS, getSkillDef, EQUIP_SELL_PRICES, STAT_LABELS } from '../data/gameData.js';
import { fmt, COLORS, ansiBlock } from '../../utils/style.js';

const SHOP_TABS = [
    { id: 'consumables', label: '🧪 藥水店', emoji: '🧪' },
    { id: 'weapons', label: '⚔️ 武器商人', emoji: '⚔️' },
    { id: 'armors', label: '🛡️ 防具商人', emoji: '🛡️' },
    { id: 'accessories', label: '💍 飾品商人', emoji: '💍' },
    { id: 'skillbooks', label: '📖 技能書商', emoji: '📖' },
    { id: 'sell', label: '💰 出售', emoji: '💰' },
];

// 裝備售價計算：品質基礎價 (已移至 items.js)

export async function showShop(interaction, char, tab = 'consumables') {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => { });
    }
    if (!char) char = getCharacter(interaction.guildId, interaction.user.id);

    // ===== 出售分頁 =====
    if (tab === 'sell') return showSellTab(interaction, char);

    const items = SHOP_ITEMS[tab] || [];
    const tabInfo = SHOP_TABS.find(t => t.id === tab);

    const header = ansiBlock([
        { color: COLORS.GOLD + ';' + COLORS.BOLD, text: ` 🏪 【吉吉王國貿易商行】 — ${tabInfo?.label || tab} ` },
        { color: COLORS.CYAN, text: ` 在此，王國頂尖的裝備與物資皆為閣下敞開。 ` }
    ]);

    const embed = rpgEmbed('王國貿易所', header, 0x1ABC9C);

    // 財富統計 (ANSI)
    const statsText = [
        `${fmt(COLORS.WHITE, '💰 目前持金:')} ${fmt(COLORS.GOLD + ';' + COLORS.BOLD, char.gold.toLocaleString())}`,
        `${fmt(COLORS.WHITE, '✨ 冒險進度:')} ${fmt(COLORS.BLUE, '探索中...')}`
    ].join('\n');

    embed.addFields({ name: '📊 騎士帳戶', value: '```ansi\n' + statsText + '\n```', inline: false });

    // 商店物品清單
    if (items.length > 0) {
        items.forEach(i => {
            const detail = i.stats
                ? Object.entries(i.stats).map(([k, v]) => `${STAT_LABELS[k] || k.toUpperCase()}${v > 0 ? '+' : ''}${v}`).join(' ')
                : i.desc || '無描述';

            const itemText = [
                `${fmt(COLORS.WHITE, '價格:')} ${fmt(COLORS.GOLD, i.price + '💰')}`,
                `${fmt(COLORS.CYAN, '> ' + detail)}`
            ].join('\n');

            embed.addFields({
                name: `${i.emoji} ${i.name}`,
                value: '```ansi\n' + itemText + '\n```',
                inline: true
            });
        });
    } else {
        embed.setDescription('⚠️ 目前該櫃位空空如也...');
    }

    if (tab !== 'consumables') {
        embed.addFields({ name: '📜 溫馨提醒', value: '商店貨架上的裝備均為基礎品質，想要更好的裝備請前往秘境冒險！', inline: false });
    }

    embed.setFooter({ text: `🐕👑 吉吉王國騎士團 | uid:${interaction.user.id}` });

    const rows = [];
    if (items.length > 0) {
        rows.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`rpg_buy_${tab}`)
                .setPlaceholder('選擇要購買的商品...')
                .addOptions(items.map(i => ({
                    label: `${i.name} — ${i.price}💰`,
                    description: (i.desc || (i.stats ? Object.entries(i.stats).map(([k, v]) => `${STAT_LABELS[k] || k.toUpperCase()}${v > 0 ? '+' : ''}${v}`).join(' ') : '')).slice(0, 50) || ' ',
                    value: i.id,
                    emoji: i.emoji,
                })).slice(0, 25)),
        ));
    }

    const tabRows = makeTabRows(tab);
    // 把「返回」按鈕塞進最後一行的標籤列中以節省 ActionRow 數量（上限 5 行）
    tabRows[tabRows.length - 1].addComponents(rpgButton('rpg_menu', '返回主選單', 'Secondary', '🔙'));
    rows.push(...tabRows);

    await safeReply(interaction, { embeds: [embed], components: rows });
}

// ---------- 出售分頁 ----------
async function showSellTab(interaction, char) {
    const inv = getInventory(interaction.guildId, interaction.user.id);
    const eqList = getEquipmentList(interaction.guildId, interaction.user.id);

    // 可賣素材、技能書或商店消耗品
    const sellableMats = inv.filter(i => {
        if (ITEM_NAMES[i.item_id]?.sellPrice !== undefined) return true;
        if (SKILL_BOOKS[i.item_id]) return true;
        // 檢查是否是商店有賣但沒定義在 ITEM_NAMES 的物品 (雖然現在有的都補上了)
        const inShop = Object.values(SHOP_ITEMS).flat().find(si => si.id === i.item_id);
        if (inShop && inShop.price) return true;
        return false;
    });

    // 可賣裝備（未裝備的）
    const equippedIds = [
        char.head_id, char.body_id, char.hands_id, char.legs_id, char.feet_id,
        char.main_hand_id, char.off_hand_id,
        char.acc1_id, char.acc2_id, char.acc3_id, char.acc4_id
    ].filter(Boolean).map(Number);
    const sellableEquips = eqList.filter(e => !equippedIds.includes(e.id));

    const matLines = sellableMats.map(i => {
        const mat = ITEM_NAMES[i.item_id];
        if (mat) {
            const nameStr = widePad(`${mat.emoji} ${mat.name}`, 14);
            const qtyStr = widePad(`x${i.quantity}`, 6);
            return `${nameStr} ${qtyStr} — 單價 ${widePad(mat.sellPrice.toString(), 4)}💰 (共 ${mat.sellPrice * i.quantity}💰)`;
        }
        const book = SKILL_BOOKS[i.item_id];
        if (book) {
            const skill = getSkillDef(book.skillId);
            const price = EQUIP_SELL_PRICES[book.quality] || 50;
            const coloredName = formatItemName(skill ? skill.name : i.item_id, book.quality);
            const nameStr = widePad(`📖 ${skill ? skill.name : i.item_id}`, 14);
            const qtyStr = widePad(`x${i.quantity}`, 6);
            return `${nameStr} ${qtyStr} — 單價 ${widePad(price.toString(), 4)}💰 (共 ${price * i.quantity}💰)`;
        }
        return `📦 ${widePad(i.item_id, 14)} x${i.quantity}`;
    });

    const eqLines = sellableEquips.slice(0, 10).map(e => {
        const def = EQUIPMENT[e.item_id];
        const basePrice = EQUIP_SELL_PRICES[e.quality] || 30;
        const price = Math.floor(basePrice * (1 + (e.enhancement || 0) * 0.2));
        if (!def) return `📦 ${widePad(e.item_id, 14)} — ${price}💰`;
        const fullName = getEquipFullName(e, def);
        const namePart = widePad(`${def.emoji} ${fullName}${e.enhancement ? `(+${e.enhancement})` : ''}`, 20);
        return `${namePart} — ${price}💰`;
    });

    const header = ansiBlock([
        { color: COLORS.GOLD + ';' + COLORS.BOLD, text: ` 🏪 【吉吉王國貿易商行】 — 💰 出售戰利品 ` },
        { color: COLORS.CYAN, text: ` 此處為王國規模最宏大的商行，財富即是此地的唯一真理。 ` }
    ]);

    const embed = rpgEmbed('王國貿易所', header, 0x1ABC9C);

    const sellDesc = [
        `${fmt(COLORS.WHITE, '💡 選擇下方選單出售物品換取金幣。')}`,
        `${fmt(COLORS.WHITE, '⚙️')} ${fmt(COLORS.GOLD, '**一鍵販售**')}${fmt(COLORS.WHITE, '：可於下方設定過濾器後快速清空。')}`
    ].join('\n');

    embed.setDescription('```ansi\n' + sellDesc + '\n```');

    embed.addFields({
        name: '💰 財政庫存',
        value: '```ansi\n' + `${fmt(COLORS.WHITE, '持有金幣:')} ${fmt(COLORS.GOLD + ';' + COLORS.BOLD, char.gold.toLocaleString())}` + '\n```',
        inline: false
    });

    if (matLines.length > 0) {
        let matStr = matLines.join('\n');
        if (matStr.length > 1000) matStr = matStr.substring(0, 997) + '...';
        embed.addFields({ name: '📦 素材與雜物 (持有)', value: '```ansi\n' + matStr + '\n```', inline: false });
    } else {
        embed.addFields({ name: '📦 素材與雜物 (持有)', value: '```ansi\n' + fmt(COLORS.GRAY, '（沒有可賣的素材）') + '\n```', inline: false });
    }

    if (eqLines.length > 0) {
        let eqStr = eqLines.join('\n');
        if (eqStr.length > 1000) eqStr = eqStr.substring(0, 997) + '...';
        embed.addFields({ name: '⚔️ 未裝備裝備 (持有)', value: '```ansi\n' + eqStr + '\n```', inline: false });
    } else {
        embed.addFields({ name: '⚔️ 未裝備裝備 (持有)', value: '```ansi\n' + fmt(COLORS.GRAY, '（沒有可賣的裝備）') + '\n```', inline: false });
    }

    embed.setFooter({ text: `🐕👑 吉吉王國騎士團 | uid:${interaction.user.id}` });

    const rows = [];

    // 素材出售選單
    const sellOptions = [];
    for (const i of sellableMats) {
        const mat = ITEM_NAMES[i.item_id];
        if (mat && mat.sellPrice !== undefined) {
            sellOptions.push({
                label: `${mat.name} x1 — ${mat.sellPrice}💰`,
                description: `持有 ${i.quantity} 個`,
                value: `mat_${i.item_id}`,
                emoji: mat.emoji,
            });
        } else if (SKILL_BOOKS[i.item_id]) {
            const book = SKILL_BOOKS[i.item_id];
            const skill = getSkillDef(book.skillId);
            const price = EQUIP_SELL_PRICES[book.quality] || 50;
            sellOptions.push({
                label: `${skill ? skill.name : '技能'} 技能書 x1 — ${price}💰`,
                description: `持有 ${i.quantity} 單位 [${qualityLabel(book.quality)}]`,
                value: `book_${i.item_id}`,
                emoji: '📖',
            });
        } else {
            // 商店物品或其他
            const inShop = Object.values(SHOP_ITEMS).flat().find(si => si.id === i.item_id);
            const price = Math.floor((inShop?.price || 10) * 0.5);
            const name = inShop?.name || i.item_id;
            sellOptions.push({
                label: `${name} x1 — ${price}💰`,
                description: `持有 ${i.quantity} 個 (系統估價)`,
                value: `mat_${i.item_id}`,
                emoji: inShop?.emoji || '📦',
            });
        }
    }
    // 裝備出售選項 (最多顯示 25 件，避免 Discord 限制)
    const sortedEquips = sellableEquips.sort((a, b) => (b.enhancement || 0) - (a.enhancement || 0));
    for (const e of sortedEquips.slice(0, 25)) {
        const def = EQUIPMENT[e.item_id];
        if (def) {
            const fullName = getEquipFullName(e, def);
            const basePrice = EQUIP_SELL_PRICES[e.quality] || 30;
            // 每強化一級價格提升 20%
            const price = Math.floor(basePrice * (1 + (e.enhancement || 0) * 0.2));

            sellOptions.push({
                label: `${fullName}${e.enhancement ? ` (+${e.enhancement})` : ''} — ${price}💰`,
                description: `${Object.entries(def.stats).map(([k, v]) => `${STAT_LABELS[k] || k.toUpperCase()}${v > 0 ? '+' : ''}${v}`).join(' ')}`,
                value: `eq_${e.id}`,
                emoji: def.emoji,
            });
        }
    }

    if (sellOptions.length > 0) {
        rows.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('rpg_sell_item')
                .setPlaceholder('手動選擇要出售的單一物品...')
                .addOptions(sellOptions.slice(0, 25)),
        ));
    }

    const prefsStr = char.auto_sell_prefs || '[]';
    let prefs = [];
    try { prefs = JSON.parse(prefsStr); } catch (e) { }

    rows.push(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_auto_sell_prefs')
            .setPlaceholder('⚙️ 設定一鍵販售的物品類別 (可多選)...')
            .setMinValues(0)
            .setMaxValues(8) // Increased max values to accommodate new options
            .addOptions([
                { label: '怪物素材', value: 'mat', emoji: '📦', default: prefs.includes('mat') },
                { label: '技能書', value: 'book', emoji: '📖', default: prefs.includes('book') },
                { label: '強化卷軸', value: 'scroll', emoji: '📜', default: prefs.includes('scroll') },
                { label: '⬜ 普通裝備', value: 'eq_common', emoji: '⚔️', default: prefs.includes('eq_common') },
                { label: '🟩 精良裝備', value: 'eq_fine', emoji: '⚔️', default: prefs.includes('eq_fine') },
                { label: '🔵 稀有裝備', value: 'eq_rare', emoji: '⚔️', default: prefs.includes('eq_rare') },
                { label: '🟣 史詩裝備', value: 'eq_epic', emoji: '⚔️', default: prefs.includes('eq_epic') },
                { label: '🟠 傳說裝備', value: 'eq_legendary', emoji: '⚔️', default: prefs.includes('eq_legendary') },
            ]),
    ));

    const tabRows = makeTabRows('sell');
    // 把「執行一鍵販售」跟「返回主選單」按鈕一起塞進 Tab 的最後一行，避免超過 5 個 ActionRow 的限制
    tabRows[tabRows.length - 1].addComponents(
        rpgButton('rpg_sell_auto_execute', '執行一鍵販售', 'Danger', '🔥'),
        rpgButton('rpg_menu', '返回主選單', 'Secondary', '🔙')
    );
    rows.push(...tabRows);

    await safeReply(interaction, { embeds: [embed], components: rows });
}

function makeTabRows(activeTab) {
    const all = SHOP_TABS.map(t =>
        rpgButton(`rpg_shop_tab_${t.id}`, t.label, t.id === activeTab ? 'Secondary' : 'Primary', undefined)
    );
    // Discord 一行最多 5 個按鈕，件手分成兩行
    const rows = [];
    for (let i = 0; i < all.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(...all.slice(i, i + 5)));
    }
    return rows;
}

export async function handleShopAction(interaction, char) {
    try {
        if (!char) char = getCharacter(interaction.guildId, interaction.user.id);
        const id = interaction.customId;

        // 分頁切換
        if (id.startsWith('rpg_shop_tab_')) {
            const tab = id.replace('rpg_shop_tab_', '');
            return showShop(interaction, char, tab);
        }

        // 自動出售設定 (改為一鍵販售過濾器設定)
        if (id === 'rpg_auto_sell_prefs' && interaction.isStringSelectMenu()) {
            const newPrefs = interaction.values;
            updateCharacter(interaction.guildId, interaction.user.id, { auto_sell_prefs: JSON.stringify(newPrefs) });
            return safeReply(interaction,{ content: `⚙️ 過濾法規已更新。\n請啟動下方的「🔥 執行一鍵販售」按鈕來肅清閣下的行囊。`, flags: ['Ephemeral'] });
        }

        // 執行一鍵販售 (預覽與確認)
        if (id === 'rpg_sell_auto_execute') {
            const prefsStr = char.auto_sell_prefs || '[]';
            let prefs = [];
            try { prefs = JSON.parse(prefsStr); } catch (e) { }

            if (prefs.length === 0) {
                return safeReply(interaction,{ content: `🚫 尚未制定「一鍵販售」之過濾法規條件。`, flags: ['Ephemeral'] });
            }

            const inv = getInventory(interaction.guildId, interaction.user.id);
            const eqList = getEquipmentList(interaction.guildId, interaction.user.id);
            const equippedIds = [
                char.head_id, char.body_id, char.hands_id, char.legs_id, char.feet_id,
                char.main_hand_id, char.off_hand_id,
                char.acc1_id, char.acc2_id, char.acc3_id, char.acc4_id
            ].filter(Boolean).map(Number);
            const sellableEquips = eqList.filter(e => !equippedIds.includes(e.id));

            let totalGold = 0;
            let previewLines = [];
            let itemsToDelete = []; // [{type: 'mat'|'book', id: itemId, qty: Number}, {type: 'eq', id: dbId, price: Number}]

            // 分析素材
            if (prefs.includes('mat')) {
                for (const i of inv) {
                    // 排除卷軸與技能書，避免優先級衝突
                    if (i.item_id.startsWith('scroll_')) continue;
                    if (SKILL_BOOKS[i.item_id]) continue;

                    const mat = ITEM_NAMES[i.item_id];
                    let sellPrice = mat?.sellPrice;
                    let itemName = mat?.name;

                    if (sellPrice === undefined) {
                        const inShop = Object.values(SHOP_ITEMS).flat().find(si => si.id === i.item_id);
                        if (!inShop) continue; // 既不是素材也不是商店貨，略過以策安全
                        sellPrice = Math.floor(inShop.price * 0.5);
                        itemName = inShop.name;
                    }

                    const price = sellPrice * i.quantity;
                    totalGold += price;
                    const coloredName = formatItemName(itemName, 'common');
                    previewLines.push(`📦 ${coloredName} x${i.quantity} — ${price}💰`);
                    itemsToDelete.push({ type: 'mat', id: i.item_id, qty: i.quantity });
                }
            }

            // 分析強化卷軸
            if (prefs.includes('scroll')) {
                for (const i of inv) {
                    if (!i.item_id.startsWith('scroll_')) continue;
                    const scroll = ITEM_NAMES[i.item_id];
                    if (scroll && scroll.sellPrice) {
                        const price = scroll.sellPrice * i.quantity;
                        totalGold += price;
                        const coloredName = formatItemName(scroll.name, 'fine');
                        previewLines.push(`📜 ${coloredName} x${i.quantity} — ${price}💰`);
                        itemsToDelete.push({ type: 'scroll', id: i.item_id, qty: i.quantity });
                    }
                }
            }

            // 分析技能書
            if (prefs.includes('book')) {
                for (const i of inv) {
                    const book = SKILL_BOOKS[i.item_id];
                    if (book) {
                        const skill = getSkillDef(book.skillId);
                        const singlePrice = EQUIP_SELL_PRICES[book.quality] || 50;
                        const price = singlePrice * i.quantity;
                        totalGold += price;
                        const coloredName = formatItemName(skill ? skill.name : i.item_id, book.quality);
                        previewLines.push(`📖 ${coloredName} 技能書 x${i.quantity} — ${price}💰`);
                        itemsToDelete.push({ type: 'book', id: i.item_id, qty: i.quantity });
                    }
                }
            }

            // 分析裝備 (包含史詩與傳說)
            if (prefs.some(p => p.startsWith('eq_'))) {
                for (const e of sellableEquips) {
                    if (prefs.includes(`eq_${e.quality}`)) {
                        const def = EQUIPMENT[e.item_id];
                        const basePrice = EQUIP_SELL_PRICES[e.quality] || 30;
                        const price = Math.floor(basePrice * (1 + (e.enhancement || 0) * 0.2));
                        if (def) {
                            const fullName = getEquipFullName(e, def);
                            totalGold += price;
                            const coloredName = formatItemName(fullName, e.quality);
                            previewLines.push(`${def.emoji} ${coloredName}${e.enhancement ? `(+${e.enhancement})` : ''} — ${price}💰`);
                            itemsToDelete.push({ type: 'eq', id: e.id, price: price });
                        }
                    }
                }
            }

            if (previewLines.length === 0) {
                return safeReply(interaction,{ content: `📜 根據當前法規，閣下的行囊中並無可自動販售之物。`, flags: ['Ephemeral'] });
            }

            // 構建預覽清單
            let previewText = '';
            if (previewLines.length > 15) {
                previewText = previewLines.slice(0, 15).join('\n') + `\n${fmt(COLORS.GRAY, `...以及其他 ${previewLines.length - 15} 項物品`)}`;
            } else {
                previewText = previewLines.join('\n');
            }

            const ansiContent = [
                fmt(COLORS.RED + ';' + COLORS.BOLD, ` ⚠️ 【確認執行一鍵販售】 ⚠️ `),
                fmt(COLORS.GOLD, ` 請審慎核實清單，貿易契印一旦生效概不接受追回。 `),
                '',
                previewText,
                '',
                `${fmt(COLORS.WHITE, '💰 預計獲得總額:')} ${fmt(COLORS.GOLD + ';' + COLORS.BOLD, totalGold.toLocaleString())} ${fmt(COLORS.GOLD, '金幣')}`
            ].join('\n');

            const embed = rpgEmbed(null, '```ansi\n' + ansiContent + '\n```', 0xE74C3C);

            const row = new ActionRowBuilder().addComponents(
                rpgButton('rpg_shop_autosell_execute', '確認成交', 4, '🤝'),
                rpgButton('rpg_shop_tab_sell', '取消', 2, '🔙')
            );

            return safeReply(interaction, { embeds: [embed], components: [row] });
        }

        if (id === 'rpg_shop_autosell_execute') {
            const char = getCharacter(interaction.guildId, interaction.user.id);
            const inv = getInventory(interaction.guildId, interaction.user.id);
            const prefs = JSON.parse(char.auto_sell_prefs || '[]');

            let totalGold = 0;
            let soldCount = 0;

            // 賣裝備
            if (prefs.some(p => p.startsWith('eq_'))) {
                const eqList = getEquipmentList(interaction.guildId, interaction.user.id);
                const equippedIds = [
                    char.head_id, char.body_id, char.hands_id, char.legs_id, char.feet_id,
                    char.main_hand_id, char.off_hand_id,
                    char.acc1_id, char.acc2_id, char.acc3_id, char.acc4_id
                ].filter(Boolean).map(Number);

                const toSell = eqList.filter(e => !equippedIds.includes(e.id) && prefs.includes(`eq_${e.quality}`));
                if (toSell.length > 0) {
                    const { getDb } = await import('../../utils/database.js');
                    const db = getDb();
                    const deletedIds = toSell.map(e => e.id);

                    for (const e of toSell) {
                        const basePrice = EQUIP_SELL_PRICES[e.quality] || 30;
                        const finalPrice = Math.floor(basePrice * (1 + (e.enhancement || 0) * 0.2));
                        totalGold += finalPrice;
                        soldCount++;
                    }

                    const placeholders = deletedIds.map(() => '?').join(',');
                    db.prepare(`DELETE FROM rpg_equipment WHERE id IN (${placeholders})`).run(...deletedIds);
                }
            }

            // 賣素材、卷軸、技能書
            for (const i of inv) {
                let sellPrice = 0;

                if (prefs.includes('mat')) {
                    if (!i.item_id.startsWith('scroll_') && !SKILL_BOOKS[i.item_id]) {
                        const mat = ITEM_NAMES[i.item_id];
                        sellPrice = mat?.sellPrice;
                        if (sellPrice === undefined) {
                            const inShop = Object.values(SHOP_ITEMS).flat().find(si => si.id === i.item_id);
                            if (inShop && !SKILL_BOOKS[i.item_id]) sellPrice = Math.floor(inShop.price * 0.5);
                        }
                    }
                }

                if (sellPrice === 0 && prefs.includes('scroll')) {
                    if (i.item_id.startsWith('scroll_')) {
                        const scroll = ITEM_NAMES[i.item_id];
                        sellPrice = scroll?.sellPrice || 0;
                    }
                }

                if (sellPrice === 0 && prefs.includes('book')) {
                    const book = SKILL_BOOKS[i.item_id];
                    if (book) {
                        sellPrice = EQUIP_SELL_PRICES[book.quality] || 50;
                    }
                }

                if (sellPrice > 0) {
                    totalGold += sellPrice * i.quantity;
                    soldCount++;
                    removeFromInventory(interaction.guildId, interaction.user.id, i.item_id, i.quantity);
                }
            }

            if (totalGold > 0) {
                const { addGold } = await import('../rpgDatabase.js');
                addGold(interaction.guildId, interaction.user.id, totalGold);
            }

            const ansiContent = [
                fmt(COLORS.GREEN + ';' + COLORS.BOLD, ` ✅ 【一鍵販售完成】 ✅ `),
                fmt(COLORS.CYAN, ` 貿易達成，願此些財富能助閣下在遠征中旗開得勝。 `),
                '',
                fmt(COLORS.WHITE, '成功完成出售程序！'),
                `${fmt(COLORS.WHITE, '獲得金幣總計:')} ${fmt(COLORS.GOLD + ';' + COLORS.BOLD, totalGold.toLocaleString())} ${fmt(COLORS.GOLD, '💰')}`
            ].join('\n');

            const embed = rpgEmbed(null, '```ansi\n' + ansiContent + '\n```', 0x2ECC71);

            const row = new ActionRowBuilder().addComponents(
                rpgButton('rpg_shop_tab_sell', '回商店', 'Secondary', '🏪')
            );

            return safeReply(interaction, { embeds: [embed], components: [row] });
        }

        // 購買
        if (id.startsWith('rpg_buy_') && interaction.isStringSelectMenu()) {
            const tab = id.replace('rpg_buy_', '');
            const itemId = interaction.values[0];
            const items = SHOP_ITEMS[tab] || [];
            const item = items.find(i => i.id === itemId);
            if (!item) return;

            if (tab === 'consumables' || tab === 'skillbooks') {
                const modal = new ModalBuilder()
                    .setCustomId(`rpg_buyqty_${tab}_${itemId}`)
                    .setTitle(`購買 ${item.name}`);
                const qtyInput = new TextInputBuilder()
                    .setCustomId('quantity')
                    .setLabel(`購買數量 (單價 ${item.price}💰)`)
                    .setStyle(TextInputStyle.Short)
                    .setValue('1')
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
                return interaction.showModal(modal);
            }

            if (char.gold < item.price) {
                return safeReply(interaction,{ content: `🚫 金幣不足，無法達成交易。需要 ${item.price}💰，閣下僅有 ${char.gold}💰。`, flags: ['Ephemeral'] });
            }

            updateCharacter(interaction.guildId, interaction.user.id, { gold: char.gold - item.price });
            addEquipment(interaction.guildId, interaction.user.id, itemId, item.quality || 'common', char.level);

            const updated = getCharacter(interaction.guildId, interaction.user.id);
            return showShop(interaction, updated, tab);
        }

        // 處理批次購買 Modal
        if (id.startsWith('rpg_buyqty_') && interaction.isModalSubmit()) {
            const parts = id.split('_');
            const tab = parts[2];
            const itemId = parts.slice(3).join('_');

            const qtyStr = interaction.fields.getTextInputValue('quantity');
            const qty = parseInt(qtyStr, 10);
            if (isNaN(qty) || qty <= 0 || qty > 1000) {
                return safeReply(interaction,{ content: '🚫 交易量在法規之外，請重新輸入 1~1000 之數。', flags: ['Ephemeral'] });
            }

            const items = SHOP_ITEMS[tab] || [];
            const item = items.find(i => i.id === itemId);
            if (!item) return;

            const totalCost = item.price * qty;
            if (char.gold < totalCost) {
                return safeReply(interaction,{ content: `🚫 金幣不足，無法達成此規模之交易。需要 ${totalCost}💰（預計購入 ${qty} 單位）。`, flags: ['Ephemeral'] });
            }

            updateCharacter(interaction.guildId, interaction.user.id, { gold: char.gold - totalCost });
            addToInventory(interaction.guildId, interaction.user.id, itemId, qty);

            const updated = getCharacter(interaction.guildId, interaction.user.id);
            return showShop(interaction, updated, tab);
        }

        // 出售
        if (id === 'rpg_sell_item' && interaction.isStringSelectMenu()) {
            const value = interaction.values[0];

            if (value.startsWith('mat_')) {
                // 素材、消耗品或素材出售
                const itemId = value.replace('mat_', '');
                const mat = ITEM_NAMES[itemId];

                let sellPrice = mat?.sellPrice;
                if (sellPrice === undefined) {
                    const inShop = Object.values(SHOP_ITEMS).flat().find(si => si.id === itemId);
                    sellPrice = Math.floor((inShop?.price || 10) * 0.5);
                }

                const ok = removeFromInventory(interaction.guildId, interaction.user.id, itemId, 1);
                if (!ok) return safeReply(interaction,{ content: '🚫 行囊中之物不足以供交易。', flags: ['Ephemeral'] });

                const { addGold: _addGold } = await import('../rpgDatabase.js');
                _addGold(interaction.guildId, interaction.user.id, sellPrice);

                const updated = getCharacter(interaction.guildId, interaction.user.id);
                return showSellTab(interaction, updated);
            }

            if (value.startsWith('book_')) {
                // 技能書出售
                const itemId = value.replace('book_', '');
                const book = SKILL_BOOKS[itemId];
                if (!book) return;

                const ok = removeFromInventory(interaction.guildId, interaction.user.id, itemId, 1);
                if (!ok) return safeReply(interaction,{ content: '🚫 物品殘量不足。', flags: ['Ephemeral'] });

                const price = EQUIP_SELL_PRICES[book.quality] || 50;
                const { addGold } = await import('../rpgDatabase.js');
                addGold(interaction.guildId, interaction.user.id, price);

                const updated = getCharacter(interaction.guildId, interaction.user.id);
                return showSellTab(interaction, updated);
            }

            if (value.startsWith('eq_')) {
                // 裝備出售
                const eqId = parseInt(value.replace('eq_', ''));
                const { getDb } = await import('../../utils/database.js');
                const db = getDb();

                const eq = db.prepare('SELECT * FROM rpg_equipment WHERE id = ? AND guild_id = ? AND user_id = ?').get(eqId, interaction.guildId, interaction.user.id);
                if (!eq) return safeReply(interaction,{ content: '🚫 於軍械庫中找不到該項裝備。', flags: ['Ephemeral'] });
                

                // 確認沒有裝備中
                const freshChar = getCharacter(interaction.guildId, interaction.user.id);
                const equippedIds = [
                    freshChar.head_id, freshChar.body_id, freshChar.hands_id, freshChar.legs_id, freshChar.feet_id,
                    freshChar.main_hand_id, freshChar.off_hand_id,
                    freshChar.acc1_id, freshChar.acc2_id, freshChar.acc3_id, freshChar.acc4_id
                ].filter(Boolean).map(Number);
                if (equippedIds.includes(eqId)) {
                    return safeReply(interaction,{ content: '🚫 穿戴中之軍備禁止於交易市場流通，請先卸下。', flags: ['Ephemeral'] });
                }

                const basePrice = EQUIP_SELL_PRICES[eq.quality] || 30;
                const price = Math.floor(basePrice * (1 + (eq.enhancement || 0) * 0.2));
                db.prepare('DELETE FROM rpg_equipment WHERE id = ?').run(eqId);

                const { addGold } = await import('../rpgDatabase.js');
                addGold(interaction.guildId, interaction.user.id, price);

                const updated = getCharacter(interaction.guildId, interaction.user.id);
                return showSellTab(interaction, updated);
            }
        }
    } catch (e) {
        console.error('handleShopAction error:', e);
        try {
            if (interaction.replied || interaction.deferred) await safeReply(interaction, { content: `🚫 術法操作發生異常: ${e.message}`, flags: ['Ephemeral'] });
            else await safeReply(interaction,{ content: `🚫 術法操作發生異常: ${e.message}`, flags: ['Ephemeral'] });
        } catch (err) { }
    }
}

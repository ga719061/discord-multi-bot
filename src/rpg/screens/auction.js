import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } from 'discord.js';
import { rpgEmbed, rpgButton, backButton, qualityLabel, ansiText } from '../rpgHelpers.js';
import { getCharacter, getInventory, getEquipmentList, addAuction, getAuctions, getAuctionById, deleteAuction, getAuctionsBySeller, getTotalAuctionsCount, removeFromInventory, removeEquipment, addGold, deductGold, addToInventory, addEquipment, addAuctionHistory, getPersonalAuctionHistory } from '../rpgDatabase.js';
import { EQUIPMENT, SHOP_ITEMS, SKILL_BOOKS, getSkillDef, ITEM_NAMES, QUALITY_MULTIPLIER, STAT_LABELS } from '../data/gameData.js';
import { broadcastRpgEvent } from '../rpgHelpers.js';
import { fmt, COLORS } from '../../utils/style.js';

const AUCTIONS_PER_PAGE = 5;

// ---------- 拍賣場主介面 ----------
export async function showAuctionHub(interaction) {
    const embed = rpgEmbed(
        '⚖️ 吉吉王國拍賣場',
        '```ansi\n' + [
            fmt(COLORS.YELLOW, '歡迎來到吉吉王國最大的拍賣與交易聚落！'),
            '',
            fmt(COLORS.WHITE, '在此將物品變現，或尋覓他人的神兵利器。'),
            '',
            fmt(COLORS.GOLD + ';' + COLORS.BOLD, '⚖️ 設施指南：'),
            fmt(COLORS.WHITE, '1. 上架商品：自訂物品與售價。'),
            fmt(COLORS.WHITE, '2. 瀏覽市集：尋找心儀的寶物。'),
            fmt(COLORS.WHITE, '3. 我的拍賣：管理架上商品與下架。'),
            fmt(COLORS.WHITE, '4. 交易紀錄：回顧個人買賣史。'),
            '',
            fmt(COLORS.GRAY, '「汪嗚... 小心別用天價買到垃圾了喔！」')
        ].join('\n') + '\n```',
        0xF1C40F // Gold
    ).setFooter({ text: `🐕👑 吉吉王國冒險者公會 | uid:${interaction.user.id}` });

    const row = new ActionRowBuilder().addComponents(
        rpgButton('rpg_auction_browse_0', '瀏覽市集', 'Primary', '🔍'),
        rpgButton('rpg_auction_list_select', '上架商品', 'Success', '📤')
    );

    const row2 = new ActionRowBuilder().addComponents(
        rpgButton('rpg_auction_my', '我的拍賣', 'Secondary', '📋'),
        rpgButton('rpg_auction_history', '交易紀錄', 'Secondary', '📜')
    );

    const backRow = backButton();

    try {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.update({ embeds: [embed], components: [row, row2, backRow] });
        } else {
            await interaction.editReply({ embeds: [embed], components: [row, row2, backRow] });
        }
    } catch (e) { }
}

// ---------- 取得物品顯示名稱與 Emoji ----------
function getItemDisplayInfo(type, itemId, quality, enhancement) {
    let name = itemId;
    let emoji = '📦';
    let qLabel = '';
    let enhStr = '';

    if (type === 'skill_book') {
        const book = SKILL_BOOKS[itemId];
        if (book) {
            const skill = getSkillDef(book.skillId);
            name = `📕 ${skill?.name || itemId}`;
            emoji = '📕';
            qLabel = ` [${qualityLabel(quality || book.quality)}]`;
        }
    } else if (type === 'equipment') {
        const def = EQUIPMENT[itemId];
        if (def) {
            name = def.name;
            emoji = def.emoji;
            qLabel = ` [${qualityLabel(quality)}]`;
            if (enhancement > 0) enhStr = ` +${enhancement}`;
        }
    } else {
        const display = ITEM_NAMES[itemId];
        const shopDef = SHOP_ITEMS.consumables.find(s => s.id === itemId);
        name = display?.name || shopDef?.name || itemId;
        emoji = display?.emoji || shopDef?.emoji || '📦';
    }

    return { name: `${emoji} ${name}${enhStr}${qLabel}`, pureName: name, emoji };
}

// ---------- 瀏覽拍賣場 ----------
export async function showAuctionBrowse(interaction, page = 0, message = null) {
    const guildId = interaction.guildId;
    const totalAuctions = getTotalAuctionsCount(guildId);
    const totalPages = Math.max(1, Math.ceil(totalAuctions / AUCTIONS_PER_PAGE));

    // 確保頁數在合理範圍
    if (page < 0) page = 0;
    if (page >= totalPages) page = totalPages - 1;

    const offset = page * AUCTIONS_PER_PAGE;
    const auctions = getAuctions(guildId, AUCTIONS_PER_PAGE, offset);

    if (totalAuctions === 0) {
        const emptyEmbed = rpgEmbed('🔍 瀏覽拍賣場', '目前拍賣場沒有任何商品！快去上架一些吧！').setFooter({ text: `uid:${interaction.user.id}` });
        const row = new ActionRowBuilder().addComponents(rpgButton('rpg_auction_hub', '返回拍賣場', 'Secondary', '🔙'));
        const payload = { embeds: [emptyEmbed], components: [row] };
        if (!interaction.replied && !interaction.deferred) return interaction.update(payload);
        return interaction.editReply(payload);
    }

    const lines = [];
    if (message) {
        lines.push(`✅ **${message}**`);
        lines.push('');
    }
    const buyOptions = [];

    // 並行獲取所有賣家的顯示名稱，避免阻塞
    const sellerIds = [...new Set(auctions.map(a => a.seller_id))];
    const sellerNames = {};
    await Promise.all(sellerIds.map(async id => {
        const member = await interaction.guild.members.fetch(id).catch(() => null);
        sellerNames[id] = member?.displayName || id;
    }));

    for (const a of auctions) {
        const info = getItemDisplayInfo(a.item_type, a.item_id, a.quality, a.enhancement);
        const namePart = widePad(`${info.name} x${a.quantity}`, 24);
        const priceStr = a.price.toLocaleString();
        const sellerName = sellerNames[a.seller_id];

        lines.push(`${fmt(COLORS.WHITE, `ID:${a.id}`)} | ${namePart}`);
        lines.push(`  └ 💰 ${fmt(COLORS.GOLD, priceStr)} G | 賣家: ${fmt(COLORS.CYAN, sellerName)}`);
        lines.push(''); // 空行分隔

        // 如果是自己賣的就不放進購買選單 (或者放進去但後端檢查擋掉)
        // 為了 UI 清楚，我們允許顯示，但只能選別人賣的
        const isSelf = a.seller_id === interaction.user.id;
        buyOptions.push({
            label: `${info.pureName} x${a.quantity} - ${priceStr}G`,
            description: `賣家: ${sellerName}${isSelf ? ' (你自己的商品)' : ''}`,
            value: `buy_${a.id}`,
            emoji: info.emoji
        });
    }

    const embed = rpgEmbed(
        `🔍 瀏覽拍賣場 (第 ${page + 1}/${totalPages} 頁)`,
        '```ansi\n' + lines.join('\n') + '\n```',
        0x3498db // Blue
    ).setFooter({ text: `共 ${totalAuctions} 項商品 | uid:${interaction.user.id}` });

    const rows = [];

    if (buyOptions.length > 0) {
        rows.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`rpg_auction_buy_select`)
                .setPlaceholder('選擇要購買的商品...')
                .addOptions(buyOptions)
        ));
    }

    const navRow = new ActionRowBuilder();
    navRow.addComponents(rpgButton(`rpg_auction_browse_${page - 1}`, '上一頁', 'Secondary', '◀️', page === 0));
    navRow.addComponents(rpgButton('rpg_auction_hub', '返回', 'Secondary', '🔙'));
    navRow.addComponents(rpgButton(`rpg_auction_browse_${page + 1}`, '下一頁', 'Secondary', '▶️', page >= totalPages - 1));
    rows.push(navRow);

    try {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.update({ embeds: [embed], components: rows });
        } else {
            await interaction.editReply({ embeds: [embed], components: rows });
        }
    } catch (e) { }
}

// ---------- 處理購買 ----------
export async function handleAuctionBuy(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    const auctionId = parseInt(interaction.values[0].replace('buy_', ''));
    const guildId = interaction.guildId;
    const buyerId = interaction.user.id;

    const auction = getAuctionById(auctionId);

    if (!auction) {
        return interaction.reply({ content: '🐕 該商品已被買走或下架了！', flags: ['Ephemeral'] });
    }

    if (auction.seller_id === buyerId) {
        return interaction.reply({ content: '🐕 汪！你不能買自己上架的商品！若要下架請至「我的拍賣」。', flags: ['Ephemeral'] });
    }

    const buyerChar = getCharacter(guildId, buyerId);
    if (!buyerChar || buyerChar.gold < auction.price) {
        return interaction.reply({ content: `🐕 你的金幣不足！需要 **${auction.price.toLocaleString()}** 金幣。`, flags: ['Ephemeral'] });
    }

    // 執行購買邏輯
    deductGold(guildId, buyerId, auction.price);
    addGold(guildId, auction.seller_id, auction.price);

    if (auction.item_type === 'equipment') {
        // 給予裝備 (需支援 quality 和 enhancement，但 addEquipment 預設沒 enhancement，我們可能需要手動或先給基礎再 UPDATE，
        // 為了簡單起見，直接呼叫 addEquipment)
        // 注意：原 addEquipment 只吃 guild, user, item_id, quality
        const db = (await import('../rpgDatabase.js')).getDb();
        const res = db.prepare('INSERT INTO rpg_equipment (guild_id, user_id, item_id, quality, enhancement) VALUES (?, ?, ?, ?, ?)').run(guildId, buyerId, auction.item_id, auction.quality, auction.enhancement);
    } else {
        // 物品或技能書
        addToInventory(guildId, buyerId, auction.item_id, auction.quantity);
    }

    deleteAuction(auctionId);

    // 紀錄歷史
    addAuctionHistory(guildId, auction.seller_id, buyerId, auction.item_type, auction.item_id, auction.quantity, auction.quality, auction.enhancement, auction.price);

    const info = getItemDisplayInfo(auction.item_type, auction.item_id, auction.quality, auction.enhancement);

    // 廣播高價值交易 (例如超過 50,000 金幣，或者是橘色以上屬性)
    if (auction.price >= 50000 || ['epic', 'mythic', 'legendary'].includes(auction.quality)) {
        const buyerName = interaction.member.displayName;
        broadcastRpgEvent(interaction.client, guildId, {
            title: '拍賣場重量級交易！',
            description: `${fmt(COLORS.BLUE, buyerName)} 豪擲 ${fmt(COLORS.GOLD, auction.price.toLocaleString())} 金幣\n買下了稀世珍寶「${fmt(COLORS.WHITE, info.pureName + ' x' + auction.quantity)}」！`,
            color: 0x2ECC71
        }).catch(() => { });
    }

    // 重新整理瀏覽畫面
    const currentPageStr = interaction.message?.embeds?.[0]?.title?.match(/第 (\d+)/)?.[1];
    const currentPage = currentPageStr ? parseInt(currentPageStr, 10) - 1 : 0;

    await showAuctionBrowse(interaction, currentPage, `成功買下了 ${info.name} x${auction.quantity}！`);
}

// ---------- 上架商品: 選擇物品 ----------
export async function showAuctionListSelection(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    const myInv = getInventory(guildId, userId);
    const myEquip = getEquipmentList(guildId, userId);
    const myChar = getCharacter(guildId, userId);

    const equippedIds = [
        myChar.head_id, myChar.body_id, myChar.hands_id, myChar.legs_id, myChar.feet_id,
        myChar.main_hand_id, myChar.off_hand_id,
        myChar.acc1_id, myChar.acc2_id, myChar.acc3_id, myChar.acc4_id
    ].filter(Boolean).map(Number); // 防呆轉數字

    const itemOptions = [];

    // 素材 + 技能書
    for (const i of myInv) {
        if (i.quantity <= 0) continue;

        if (SKILL_BOOKS[i.item_id]) {
            const book = SKILL_BOOKS[i.item_id];
            const skill = getSkillDef(book.skillId);
            itemOptions.push({
                label: `📕 ${skill?.name || i.item_id} [${qualityLabel(book.quality)}]`,
                description: `持有 ${i.quantity} 個`,
                value: `item_${i.item_id}_${book.quality}`, // item_id_quality
                emoji: '📕',
            });
        } else {
            const display = ITEM_NAMES[i.item_id];
            const shopDef = SHOP_ITEMS.consumables.find(s => s.id === i.item_id);
            const name = display?.name || shopDef?.name || i.item_id;
            const emoji = display?.emoji || shopDef?.emoji || '📦';
            itemOptions.push({
                label: `${name} (持有 ${i.quantity})`,
                description: `一般物品`,
                value: `item_${i.item_id}_common`,
                emoji,
            });
        }
    }

    // 未裝備的裝備
    for (const e of myEquip.filter(eq => !equippedIds.includes(eq.id))) {
        const def = EQUIPMENT[e.item_id];
        if (!def) continue;
        const enhStr = e.enhancement > 0 ? ` +${e.enhancement}` : '';
        itemOptions.push({
            label: `${def.name}${enhStr} [${qualityLabel(e.quality)}]`,
            description: Object.entries(def.stats).map(([k, v]) => `${STAT_LABELS[k] || k.toUpperCase()}+${v}`).join(' '),
            value: `eq_${e.id}`, // eq_id
            emoji: def.emoji,
        });
    }

    if (itemOptions.length === 0) {
        const emptyEmbed = rpgEmbed('📤 上架商品', '你的背包裡沒有可以上架的物品！').setFooter({ text: `uid:${userId}` });
        const row = new ActionRowBuilder().addComponents(rpgButton('rpg_auction_hub', '返回', 'Secondary', '🔙'));
        return interaction.update({ embeds: [emptyEmbed], components: [row] });
    }

    const embed = rpgEmbed(
        '📤 上架商品',
        '請選擇你想放上拍賣場的物品：\n(選擇後將會跳出視窗讓你輸入價格與數量)',
        0xE67E22 // Orange
    ).setFooter({ text: `uid:${userId}` });

    const rows = [];
    rows.push(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`rpg_auction_list_prompt`) // 會觸發 Modal
            .setPlaceholder('選擇要出售的物品...')
            .addOptions(itemOptions.slice(0, 25)) // Discord 限制 25
    ));
    rows.push(new ActionRowBuilder().addComponents(rpgButton('rpg_auction_hub', '返回拍賣場', 'Secondary', '🔙')));

    try {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.update({ embeds: [embed], components: rows });
        } else {
            await interaction.editReply({ embeds: [embed], components: rows });
        }
    } catch (e) { }
}

// ---------- 彈出價格輸入 Modal ----------
export async function handleAuctionListPrompt(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    const value = interaction.values[0]; // 'item_pot_hp_common' 或 'eq_123'

    // 將 value 塞進 customId 以便提交時知道是哪個物品
    // Discord Modal CustomId 限制 100 字元，所以要簡潔
    const modal = new ModalBuilder()
        .setCustomId(`rpg_auction_modal|${value}`)
        .setTitle('設定拍賣價格與數量');

    const priceInput = new TextInputBuilder()
        .setCustomId('auction_price')
        .setLabel('售價 (金幣)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('例如：1000')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(9);

    let qtyInput = null;
    if (value.startsWith('item_')) {
        qtyInput = new TextInputBuilder()
            .setCustomId('auction_qty')
            .setLabel('數量')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('預設全上一半？(預設 1)')
            .setRequired(true)
            .setValue('1');
    }

    const firstActionRow = new ActionRowBuilder().addComponents(priceInput);
    modal.addComponents(firstActionRow);

    if (qtyInput) {
        const secondActionRow = new ActionRowBuilder().addComponents(qtyInput);
        modal.addComponents(secondActionRow);
    }

    await interaction.showModal(modal);
}

// ---------- 處理 Modal 提交 (正式上架) ----------
export async function handleAuctionSubmit(interaction) {
    if (!interaction.isModalSubmit()) return;

    const parts = interaction.customId.split('|'); // ['rpg_auction_modal', 'item_xxx_yyy']
    if (parts.length < 2) return;

    const itemData = parts[1];
    const priceStr = interaction.fields.getTextInputValue('auction_price');
    const qtyStr = interaction.fields.fields.has('auction_qty') ? interaction.fields.getTextInputValue('auction_qty') : '1';

    const price = parseInt(priceStr, 10);
    const qty = parseInt(qtyStr, 10);

    if (isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) {
        return interaction.reply({ content: '🐕 價格或數量輸入無效！', flags: ['Ephemeral'] });
    }

    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    let success = false;
    let itemNameForMsg = '';

    if (itemData.startsWith('eq_')) {
        const eqId = parseInt(itemData.replace('eq_', ''));
        const db = (await import('../rpgDatabase.js')).getDb();
        const eq = db.prepare('SELECT * FROM rpg_equipment WHERE id = ? AND user_id = ? AND guild_id = ? AND equipped = 0').get(eqId, userId, guildId);

        if (!eq) return interaction.reply({ content: '🐕 找不到該裝備或已裝備！', flags: ['Ephemeral'] });

        // 建立拍賣
        addAuction(guildId, userId, 'equipment', eq.item_id, 1, eq.quality, eq.enhancement, price);
        // 刪除裝備
        removeEquipment(eqId);

        const info = getItemDisplayInfo('equipment', eq.item_id, eq.quality, eq.enhancement);
        itemNameForMsg = info.name;
        success = true;

    } else if (itemData.startsWith('item_')) {
        // 'item_pot_hp_common'
        const itemParts = itemData.split('_');
        const quality = itemParts.pop(); // common, rare, etc.
        itemParts.shift(); // remove 'item'
        const itemId = itemParts.join('_'); // real item_id

        const inv = getInventory(guildId, userId);
        const invItem = inv.find(i => i.item_id === itemId);

        if (!invItem || invItem.quantity < qty) {
            return interaction.reply({ content: '🐕 你沒有足夠的數量上架！', flags: ['Ephemeral'] });
        }

        let type = SKILL_BOOKS[itemId] ? 'skill_book' : 'item';

        // 建立拍賣
        addAuction(guildId, userId, type, itemId, qty, quality, 0, price);
        // 減少背包數量
        removeFromInventory(guildId, userId, itemId, qty);

        const info = getItemDisplayInfo(type, itemId, quality, 0);
        itemNameForMsg = info.name;
        success = true;
    }

    if (success) {
        await interaction.reply({ content: `✅ 成功將 **${itemNameForMsg} x${qty}** 以 **${price.toLocaleString()} 金幣** 上架至拍賣場！`, flags: ['Ephemeral'] });

        // Return to Hub gracefully
        // We can't update original message easily from modal if it wasn't deferred edit, so just let user use the menu
    } else {
        await interaction.reply({ content: `❌ 上架失敗。`, flags: ['Ephemeral'] });
    }
}

// ---------- 檢視「我的拍賣」 ----------
export async function showMyAuctions(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    const myAuctions = getAuctionsBySeller(guildId, userId);

    if (myAuctions.length === 0) {
        const emptyEmbed = rpgEmbed('📋 我的拍賣', '你目前沒有任何物品在拍賣場上！').setFooter({ text: `uid:${userId}` });
        const row = new ActionRowBuilder().addComponents(rpgButton('rpg_auction_hub', '返回拍賣場', 'Secondary', '🔙'));
        return interaction.update({ embeds: [emptyEmbed], components: [row] });
    }

    const lines = [];
    const cancelOptions = [];

    for (const a of myAuctions) {
        const info = getItemDisplayInfo(a.item_type, a.item_id, a.quality, a.enhancement);
        lines.push(`**ID:${a.id}** | ${info.name} x${a.quantity} - 💰 ${a.price.toLocaleString()}G`);

        cancelOptions.push({
            label: `下架: ${info.pureName}`,
            description: `ID: ${a.id} | 價格: ${a.price}G`,
            value: `cancel_${a.id}`,
            emoji: '❌'
        });
    }

    const embed = rpgEmbed(
        '📋 我的拍賣',
        lines.join('\n'),
        0x9B59B6 // Purple
    ).setFooter({ text: `共 ${myAuctions.length} 項商品 | 提示：若要取回物品請選擇下架 | uid:${userId}` });

    const rows = [];

    if (cancelOptions.length > 0) {
        // 如果超過 25，切片
        rows.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`rpg_auction_cancel_select`)
                .setPlaceholder('選擇要下架取回的商品...')
                .addOptions(cancelOptions.slice(0, 25))
        ));
    }

    const navRow = new ActionRowBuilder().addComponents(rpgButton('rpg_auction_hub', '返回拍賣場', 'Secondary', '🔙'));
    rows.push(navRow);

    try {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.update({ embeds: [embed], components: rows });
        } else {
            await interaction.editReply({ embeds: [embed], components: rows });
        }
    } catch (e) { }
}

// ---------- 處理下架 ----------
export async function handleAuctionCancel(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    const auctionId = parseInt(interaction.values[0].replace('cancel_', ''));
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const auction = getAuctionById(auctionId);

    if (!auction) {
        return interaction.reply({ content: '🐕 找不到這項商品，可能已經被買走了！', flags: ['Ephemeral'] });
    }

    if (auction.seller_id !== userId) {
        return interaction.reply({ content: '🐕 你不能下架別人的商品！', flags: ['Ephemeral'] });
    }

    // 發還物品
    if (auction.item_type === 'equipment') {
        const db = (await import('../rpgDatabase.js')).getDb();
        db.prepare('INSERT INTO rpg_equipment (guild_id, user_id, item_id, quality, enhancement) VALUES (?, ?, ?, ?, ?)').run(guildId, userId, auction.item_id, auction.quality, auction.enhancement);
    } else {
        addToInventory(guildId, userId, auction.item_id, auction.quantity);
    }

    // 刪除紀錄
    deleteAuction(auctionId);

    interaction.reply({ content: `✅ 成功將商品下架並取回至背包！`, flags: ['Ephemeral'] });

    // 重新整理畫面
    const fakeInteraction = {
        guildId, user: interaction.user, guild: interaction.guild,
        replied: false, deferred: false,
        update: async (payload) => interaction.message.edit(payload),
        editReply: async (payload) => interaction.message.edit(payload)
    };
    await showMyAuctions(fakeInteraction);
}

// ---------- 檢視個人「交易紀錄」 ----------
export async function showAuctionHistory(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    const history = getPersonalAuctionHistory(guildId, userId, 20);

    if (history.length === 0) {
        const emptyEmbed = rpgEmbed('📜 我的交易紀錄', '你目前沒有任何拍賣場的交易紀錄！').setFooter({ text: `uid:${userId}` });
        const row = new ActionRowBuilder().addComponents(rpgButton('rpg_auction_hub', '返回拍賣場', 'Secondary', '🔙'));
        return interaction.update({ embeds: [emptyEmbed], components: [row] });
    }

    const lines = [];

    // 預取玩家名稱
    const userIdsToFetch = [...new Set(history.flatMap(h => [h.seller_id, h.buyer_id]))];
    const userNamesCache = {};
    await Promise.all(userIdsToFetch.map(async id => {
        if (id === userId) {
            userNamesCache[id] = '你';
        } else {
            const member = await interaction.guild.members.fetch(id).catch(() => null);
            userNamesCache[id] = member?.displayName || id;
        }
    }));

    for (const h of history) {
        const info = getItemDisplayInfo(h.item_type, h.item_id, h.quality, h.enhancement);
        const timeStr = `<t:${Math.floor(h.sold_at / 1000)}:R>`;
        const isSeller = h.seller_id === userId;
        const otherPartyName = isSeller ? userNamesCache[h.buyer_id] : userNamesCache[h.seller_id];

        if (isSeller) {
            lines.push(`> 📤 **[賣出]** ${timeStr}\n> ↳ 你的 **${info.name} x${h.quantity}** 被 **${otherPartyName}** 以 **${h.price.toLocaleString()}G** 買走了。`);
        } else {
            lines.push(`> 📥 **[買入]** ${timeStr}\n> ↳ 你花費 **${h.price.toLocaleString()}G** 購買了 **${otherPartyName}** 的 **${info.name} x${h.quantity}**。`);
        }
        lines.push(''); // 空行分隔
    }

    const embed = rpgEmbed(
        '📜 我的交易紀錄 (最近 20 筆)',
        lines.join('\n'),
        0x1ABC9C // Turquoise
    ).setFooter({ text: `uid:${userId}` });

    const navRow = new ActionRowBuilder().addComponents(rpgButton('rpg_auction_hub', '返回拍賣場', 'Secondary', '🔙'));

    try {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.update({ embeds: [embed], components: [navRow] });
        } else {
            await interaction.editReply({ embeds: [embed], components: [navRow] });
        }
    } catch (e) { }
}

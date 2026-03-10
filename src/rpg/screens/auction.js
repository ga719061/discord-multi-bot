import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } from 'discord.js';
import { rpgEmbed, rpgButton, backButton, qualityLabel, ansiText, widePad, safeReply } from '../rpgHelpers.js';
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
            fmt(COLORS.GRAY, '「莫要以天價購得無用之物...」')
        ].join('\n') + '\n```',
        0xF1C40F // Gold
    ).setFooter({ text: `🐕👑 吉吉王國騎士團 | uid:${interaction.user.id}` });

    const row = new ActionRowBuilder().addComponents(
        rpgButton('rpg_auction_browse_0', '瀏覽市集', 'Primary', '🔍'),
        rpgButton('rpg_auction_list_select', '上架商品', 'Success', '📤')
    );

    const row2 = new ActionRowBuilder().addComponents(
        rpgButton('rpg_auction_my', '我的拍賣', 'Secondary', '📋'),
        rpgButton('rpg_auction_history', '交易紀錄', 'Secondary', '📜')
    );

    const backRow = backButton();

    await safeReply(interaction, { embeds: [embed], components: [row, row2, backRow] });
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
            name = skill?.name || itemId;
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

    if (page < 0) page = 0;
    if (page >= totalPages) page = totalPages - 1;

    const offset = page * AUCTIONS_PER_PAGE;
    const auctions = getAuctions(guildId, AUCTIONS_PER_PAGE, offset);

    if (totalAuctions === 0) {
        const emptyEmbed = rpgEmbed('🔍 瀏覽拍賣場', '目前拍賣場沒有任何商品！').setFooter({ text: `uid:${interaction.user.id}` });
        const row = new ActionRowBuilder().addComponents(rpgButton('rpg_auction_hub', '返回', 'Secondary', '🔙'));
        return safeReply(interaction, { embeds: [emptyEmbed], components: [row] });
    }

    const sellerNames = {};
    const sellerIds = [...new Set(auctions.map(a => a.seller_id))];
    await Promise.all(sellerIds.map(async id => {
        const member = await interaction.guild.members.fetch(id).catch(() => null);
        sellerNames[id] = member?.displayName || id;
    }));

    const lines = [];
    if (message) lines.push(`✅ **${message}**\n`);
    const buyOptions = [];

    for (const a of auctions) {
        const info = getItemDisplayInfo(a.item_type, a.item_id, a.quality, a.enhancement);
        if (!info) continue; // 安全檢查
        const namePart = widePad(`${info.name} x${a.quantity}`, 24);
        const buyerName = sellerNames[a.seller_id] || '未知賣家';

        lines.push(`${fmt(COLORS.WHITE, `ID:${a.id}`)} | ${namePart}`);
        lines.push(`  └ 💰 ${fmt(COLORS.GOLD, a.price.toLocaleString())} G | 賣家: ${fmt(COLORS.CYAN, buyerName)}\n`);

        buyOptions.push({
            label: `${info.pureName || '未知'} x${a.quantity} - ${a.price}G`.slice(0, 100),
            description: `賣家: ${buyerName}`.slice(0, 100),
            value: `buy_${a.id}`,
            emoji: info.emoji || '📦'
        });
    }

    const embed = rpgEmbed(
        `🔍 瀏覽拍賣場 (第 ${page + 1}/${totalPages} 頁)`,
        '```ansi\n' + lines.join('\n') + '\n```',
        0x3498DB
    ).setFooter({ text: `共 ${totalAuctions} 項 | uid:${interaction.user.id}` });

    const rows = [];
    if (buyOptions.length > 0) {
        rows.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('rpg_auction_buy_select').setPlaceholder('挑選商品...').addOptions(buyOptions.slice(0, 25))
        ));
    }

    const nav = new ActionRowBuilder().addComponents(
        rpgButton(`rpg_auction_browse_${page - 1}`, '上一頁', 'Secondary', '◀️', page <= 0),
        rpgButton('rpg_auction_hub', '返回', 'Secondary', '🔙'),
        rpgButton(`rpg_auction_browse_${page + 1}`, '下一頁', 'Secondary', '▶️', page >= totalPages - 1)
    );
    rows.push(nav);

    await safeReply(interaction, { embeds: [embed], components: rows });
}

export async function handleAuctionBuy(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    const auctionId = parseInt(interaction.values[0].replace('buy_', ''));
    const guildId = interaction.guildId;
    const buyerId = interaction.user.id;

    const auction = getAuctionById(auctionId);
    if (!auction) return safeReply(interaction,{ content: '🚫 術法共鳴失敗，王國秘法系統發生異常。', flags: ['Ephemeral'] });
    if (auction.seller_id === buyerId) return safeReply(interaction,{ content: '🚫 閣下不能購買自己架上的物資。', flags: ['Ephemeral'] });

    const buyerChar = getCharacter(guildId, buyerId);
    if (!buyerChar || buyerChar.gold < auction.price) return safeReply(interaction,{ content: `🐕 金幣不足！`, flags: ['Ephemeral'] });

    deductGold(guildId, buyerId, auction.price);
    addGold(guildId, auction.seller_id, auction.price);

    if (auction.item_type === 'equipment') {
        const db = (await import('../rpgDatabase.js')).getDb();
        db.prepare('INSERT INTO rpg_equipment (guild_id, user_id, item_id, quality, enhancement) VALUES (?, ?, ?, ?, ?)').run(guildId, buyerId, auction.item_id, auction.quality, auction.enhancement);
    } else {
        addToInventory(guildId, buyerId, auction.item_id, auction.quantity);
    }

    deleteAuction(auctionId);
    addAuctionHistory(guildId, auction.seller_id, buyerId, auction.item_type, auction.item_id, auction.quantity, auction.quality, auction.enhancement, auction.price);

    const info = getItemDisplayInfo(auction.item_type, auction.item_id, auction.quality, auction.enhancement);
    await showAuctionBrowse(interaction, 0, `成功買下了 ${info.name}！`);
}

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
    ].filter(Boolean).map(id => Number(id));

    const options = [];
    for (const i of myInv) {
        if (i.quantity <= 0) continue;
        const display = ITEM_NAMES[i.item_id] || { name: i.item_id, emoji: '📦' };
        options.push({ label: `${display.name} (x${i.quantity})`, value: `item_${i.item_id}_common`, emoji: display.emoji });
    }

    for (const e of myEquip.filter(eq => !equippedIds.includes(eq.id))) {
        const def = EQUIPMENT[e.item_id];
        if (!def) continue;
        options.push({ label: `${def.name} [${qualityLabel(e.quality)}]`, value: `eq_${e.id}`, emoji: def.emoji });
    }

    if (options.length === 0) return safeReply(interaction, { embeds: [rpgEmbed('📤 上架', '你的背包是空的！')], components: [backButton()] });

    const menu = new StringSelectMenuBuilder().setCustomId('rpg_auction_list_prompt').setPlaceholder('選擇物品...').addOptions(options.slice(0, 25));
    await safeReply(interaction, { embeds: [rpgEmbed('📤 上架商品', '請選擇物品：')], components: [new ActionRowBuilder().addComponents(menu), backButton()] });
}

export async function handleAuctionListPrompt(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    const value = interaction.values[0];
    const modal = new ModalBuilder().setCustomId(`rpg_auction_modal|${value}`).setTitle('設定價格與數量');
    const priceInput = new TextInputBuilder().setCustomId('auction_price').setLabel('售價').setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(priceInput));
    if (value.startsWith('item_')) {
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('auction_qty').setLabel('數量').setStyle(TextInputStyle.Short).setValue('1')));
    }
    await interaction.showModal(modal);
}

export async function handleAuctionSubmit(interaction) {
    if (!interaction.isModalSubmit()) return;
    const [_, itemData] = interaction.customId.split('|');
    const price = parseInt(interaction.fields.getTextInputValue('auction_price'), 10);
    const qty = interaction.fields.fields.has('auction_qty') ? parseInt(interaction.fields.getTextInputValue('auction_qty'), 10) : 1;

    if (isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) return safeReply(interaction,{ content: '無效輸入', flags: ['Ephemeral'] });

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (itemData.startsWith('eq_')) {
        const eqId = parseInt(itemData.replace('eq_', ''));
        const db = (await import('../rpgDatabase.js')).getDb();
        const eq = db.prepare('SELECT * FROM rpg_equipment WHERE id = ? AND user_id = ?').get(eqId, userId);
        if (!eq) return safeReply(interaction,{ content: '找不到裝備', flags: ['Ephemeral'] });
        addAuction(guildId, userId, 'equipment', eq.item_id, 1, eq.quality, eq.enhancement, price);
        removeEquipment(eqId);
    } else {
        const itemId = itemData.split('_')[1];
        removeFromInventory(guildId, userId, itemId, qty);
        addAuction(guildId, userId, 'item', itemId, qty, 'common', 0, price);
    }

    await safeReply(interaction,{ content: '✅ 上架成功！', flags: ['Ephemeral'] });
}

export async function showMyAuctions(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const myAuctions = getAuctionsBySeller(guildId, userId);
    if (myAuctions.length === 0) return safeReply(interaction, { embeds: [rpgEmbed('📋 我的拍賣', '沒有上架商品。')], components: [backButton()] });

    const lines = myAuctions.map(a => `${a.id}: ${a.item_id} x${a.quantity} - ${a.price}G`);
    const menu = new StringSelectMenuBuilder().setCustomId('rpg_auction_cancel_select').setPlaceholder('下架...').addOptions(
        myAuctions.map(a => ({ label: `下架 ID:${a.id}`, value: `cancel_${a.id}` }))
    );
    await safeReply(interaction, { embeds: [rpgEmbed('📋 我的拍賣', lines.join('\n'))], components: [new ActionRowBuilder().addComponents(menu), backButton()] });
}

export async function handleAuctionCancel(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    const auctionId = parseInt(interaction.values[0].replace('cancel_', ''));
    const auction = getAuctionById(auctionId);
    if (!auction || auction.seller_id !== interaction.user.id) return safeReply(interaction,{ content: '無權限', flags: ['Ephemeral'] });

    if (auction.item_type === 'equipment') {
        const db = (await import('../rpgDatabase.js')).getDb();
        db.prepare('INSERT INTO rpg_equipment (guild_id, user_id, item_id, quality, enhancement) VALUES (?, ?, ?, ?, ?)').run(interaction.guildId, interaction.user.id, auction.item_id, auction.quality, auction.enhancement);
    } else {
        addToInventory(interaction.guildId, interaction.user.id, auction.item_id, auction.quantity);
    }
    deleteAuction(auctionId);
    await safeReply(interaction,{ content: '✅ 下架成功', flags: ['Ephemeral'] });
}

export async function showAuctionHistory(interaction) {
    const history = getPersonalAuctionHistory(interaction.guildId, interaction.user.id, 10);
    const lines = history.map(h => `${h.seller_id === interaction.user.id ? '📤 賣出' : '📥 買入'} ${h.item_id} x${h.quantity} (${h.price}G)`);
    await safeReply(interaction, { embeds: [rpgEmbed('📜 交易紀錄', lines.join('\n') || '無紀錄')], components: [backButton()] });
}

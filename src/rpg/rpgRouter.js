// ===== RPG 按鈕/選單路由分發器 =====
import { isRpgEnabled, getCharacter } from './rpgDatabase.js';
import { isOwner, notOwnerReply } from './rpgHelpers.js';
import { showHub } from './screens/hub.js';
import { handleCreate } from './screens/create.js';
import { showProfile, handleProfileAction } from './screens/profile.js';
import { showAdventure, handleAreaSelect, showAutoFarmMenu, handleAutoFarmSelect, showShrineMenu, handleSummonSelect } from './screens/adventure.js';
import { handleBattleAction } from './screens/battle.js';
import { showInventory, handleInventoryUse } from './screens/inventory.js';
import { showShop, handleShopAction } from './screens/shop.js';
import { showQuest } from './screens/quest.js';
import { showDaily } from './screens/daily.js';
import { showMercenaryHub, handleMercenaryAction, handleHireSelect } from './screens/mercenary.js';
import { showAutoConfig, handleAutoConfigSelect } from './screens/autoConfig.js';
import { showRanking } from './screens/ranking.js';
import { showTavern, handleTavernAction } from './screens/tavern.js';
import { showAuctionHub, showAuctionBrowse, handleAuctionBuy, showAuctionListSelection, handleAuctionListPrompt, handleAuctionSubmit, showMyAuctions, handleAuctionCancel, showAuctionHistory } from './screens/auction.js';
import { logger } from '../utils/logger.js';

// Per-user 操作鎖：防止快速連點造成的 race condition（裝備複製、消耗品重複使用等）
const activeInteractions = new Set();

export function registerRpgRouter(client) {
     client.on('interactionCreate', async (interaction) => {
          // 只處理按鈕、選單與彈出視窗
          if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isUserSelectMenu() && !interaction.isModalSubmit()) return;

          const id = interaction.customId;
          if (!id.startsWith('rpg_')) return;

          try {
               // 檢查 RPG 是否啟用
               if (!isRpgEnabled(interaction.guildId)) {
                    return interaction.reply({ content: '🐕 RPG 系統目前已關閉！', flags: ['Ephemeral'] });
               }

               // 取得訊息的原始使用者 (存在 embed footer 或 interaction.message)
               // 我們用 footer text 中的 userId 來驗證
               const footerText = interaction.message?.embeds?.[0]?.footer?.text || '';
               const ownerMatch = footerText.match(/uid:(\d+)/);
               const ownerId = ownerMatch ? ownerMatch[1] : null;

               // 列出不需要 Check Owner 的指令（共用的 Activity，或者具備內部權限控管的功能）
               const sharedPrefixes = [
                    'rpg_auction_buy_select',
                    'rpg_merc_hire_select',
                    'rpg_auto_skill_select',
                    'rpg_auto_farm_select',
                    'rpg_shrine_summon_select',
                    'rpg_battle_',
                    'rpg_skill_select',
                    'rpg_item_select',
                    'rpg_target_select',
                    'rpg_area_'
               ];
               const isShared = sharedPrefixes.some(p => id.startsWith(p));

               if (!isShared && ownerId && !isOwner(interaction, ownerId)) {
                    return notOwnerReply(interaction);
               }

               // 💡 早期 Defer：針對非 Modal 觸發的按鈕與選單進行 deferUpdate
               // 排除：1. Modal 提交, 2. 會彈出 Modal 的按鈕 (如購買、拍賣刊登提示、自動出售設定、商店選單等)
               const modalRelated = ['rpg_buy_', 'rpg_auction_list_prompt', 'rpg_auto_sell_prefs', 'rpg_shop_autosell_execute', 'rpg_sell_auto_execute'];
               const isModalRelated = modalRelated.some(p => id.startsWith(p)) || id === 'rpg_auction_list_select';

               if (!interaction.isModalSubmit() && !isModalRelated && !interaction.deferred && !interaction.replied) {
                    await interaction.deferUpdate().catch(() => { });
               }

               // 操作鎖：同一使用者同時只能有一個 RPG 操作
               const lockKey = `${interaction.guildId}_${interaction.user.id}`;
               if (activeInteractions.has(lockKey)) {
                    return; // 上一個操作尚未完成，靜默忽略
               }
               activeInteractions.add(lockKey);
               try {

                    const char = getCharacter(interaction.guildId, interaction.user.id);

                    // 拍賣場系統 (不需要 owner check，因為是公共大廳，內部自行處理)
                    if (id === 'rpg_auction') {
                         return await showAuctionHub(interaction);
                    }
                    if (id === 'rpg_auction_hub') {
                         return await showAuctionHub(interaction);
                    }
                    if (id.startsWith('rpg_auction_browse_')) {
                         const page = parseInt(id.replace('rpg_auction_browse_', '')) || 0;
                         return await showAuctionBrowse(interaction, page);
                    }
                    if (id === 'rpg_auction_buy_select') {
                         return await handleAuctionBuy(interaction);
                    }
                    if (id === 'rpg_auction_list_select') {
                         return await showAuctionListSelection(interaction);
                    }
                    if (id === 'rpg_auction_list_prompt') {
                         return await handleAuctionListPrompt(interaction);
                    }
                    if (id === 'rpg_auction_my') {
                         return await showMyAuctions(interaction);
                    }
                    if (id === 'rpg_auction_cancel_select') {
                         return await handleAuctionCancel(interaction);
                    }
                    if (id === 'rpg_auction_history') {
                         return await showAuctionHistory(interaction);
                    }

                    // ===== 路由分發 =====

                    // 主選單
                    if (id === 'rpg_menu') {
                         if (!char) return await handleCreate(interaction, 'update');
                         return await showHub(interaction, char, 'update');
                    }

                    // 角色建立
                    if (id.startsWith('rpg_create_')) {
                         return await handleCreate(interaction, 'update');
                    }

                    // 角色狀態
                    if (id === 'rpg_profile') {
                         return await showProfile(interaction, char);
                    }
                    if (id.startsWith('rpg_stat_') || id === 'rpg_skills' || id === 'rpg_profile_merc_toggle' || id === 'rpg_equip_skills' || id.startsWith('rpg_active_skill_set_')) {
                         return await handleProfileAction(interaction, char);
                    }

                    // 冒險
                    if (id === 'rpg_adventure') {
                         return await showAdventure(interaction, char);
                    }
                    if (id === 'rpg_auto_farm_menu') {
                         return await showAutoFarmMenu(interaction, char);
                    }
                    if (id === 'rpg_auto_farm_select') {
                         return await handleAutoFarmSelect(interaction, char);
                    }
                    if (id.startsWith('rpg_area_') || id === 'rpg_shrine_menu') {
                         return await handleAreaSelect(interaction, char);
                    }
                    if (id === 'rpg_shrine_summon_select') {
                         return await handleSummonSelect(interaction, char);
                    }

                    // 戰鬥
                    if (id.startsWith('rpg_battle_') || id.startsWith('rpg_skill_select') || id.startsWith('rpg_item_select') || id.startsWith('rpg_target_select')) {
                         return await handleBattleAction(interaction);
                    }

                    // 背包
                    if (id === 'rpg_inventory') {
                         return await showInventory(interaction, char);
                    }
                    if (id.startsWith('rpg_inv_')) {
                         return await handleInventoryUse(interaction, char);
                    }

                    // 商店
                    if (id === 'rpg_shop') {
                         return await showShop(interaction, char);
                    }
                    if (id.startsWith('rpg_shop_') || id.startsWith('rpg_buy_') || id.startsWith('rpg_buyqty_') || id.startsWith('rpg_sell_') || id === 'rpg_auto_sell_prefs') {
                         return await handleShopAction(interaction, char);
                    }

                    // 任務
                    if (id === 'rpg_quest') {
                         return await showQuest(interaction, char);
                    }

                    // 傭兵
                    if (id === 'rpg_merc') {
                         return await showMercenaryHub(interaction, char);
                    }
                    if (id.startsWith('rpg_merc_hire_select')) {
                         return await handleHireSelect(interaction);
                    }
                    if (id.startsWith('rpg_merc_')) {
                         return await handleMercenaryAction(interaction);
                    }

                    // 每日簽到
                    if (id === 'rpg_daily') {
                         return await showDaily(interaction, char);
                    }

                    // 排行榜
                    if (id === 'rpg_ranking') {
                         return await showRanking(interaction);
                    }

                    // 自動設定
                    if (id === 'rpg_auto_config') {
                         return await showAutoConfig(interaction, char);
                    }
                    if (id === 'rpg_auto_skill_select') {
                         return await handleAutoConfigSelect(interaction);
                    }

                    // 世界觀 (王國酒館)
                    if (id === 'rpg_lore') {
                         return await showTavern(interaction, char);
                    }
                    if (id.startsWith('rpg_tavern_')) {
                         return await handleTavernAction(interaction, char);
                    }

                    // ---------- Modal 提交處理 ----------
                    if (interaction.isModalSubmit()) {
                         if (id.startsWith('rpg_auction_modal')) {
                              return await handleAuctionSubmit(interaction);
                         }
                    }

               } finally {
                    activeInteractions.delete(lockKey);
               }

          } catch (error) {
               logger.error(`RPG 路由錯誤 (${id}):`, error);
               const reply = { content: '🐕 汪嗚...本王的冒險系統出了點問題！請稍後再試。', flags: ['Ephemeral'] };
               try {
                    if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
                    else await interaction.reply(reply);
               } catch (e) {
                    logger.error('RPG 回覆錯誤:', e.message);
               }
          }
     });
}

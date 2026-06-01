export const COMMAND_KNOWLEDGE = [
  { name: 'help', visibility: 'public', summary: '英文別名，開啟中文互動式指令說明。' },
  { name: '幫助', visibility: 'public', summary: '開啟互動式指令大典，瀏覽公開功能與可用入口。' },
  { name: '延遲', visibility: 'public', summary: '測試 bot 與 Discord API 的回應速度。' },
  { name: '提醒', visibility: 'public', summary: '開啟提醒彈窗，建立或管理待發送提醒。' },
  { name: '每日一汪', visibility: 'public', summary: '領取每日金句、祝福與幸運指數。' },
  { name: '餵食', visibility: 'public', summary: '選擇食物進貢給吉吉國王。' },
  { name: '占卜', visibility: 'public', summary: '讓吉吉國王替問題或今日運勢占卜。' },
  { name: '抱抱', visibility: 'public', summary: '抱抱吉吉國王，或指定其他對象互動。' },
  { name: '摸摸', visibility: 'public', summary: '摸摸吉吉國王的頭。' },
  { name: '汪汪', visibility: 'public', summary: '使用罐頭式簡易聊天互動。' },
  { name: '等級', visibility: 'public', summary: '查看自己或指定使用者的等級、XP 與爵位。' },
  { name: '排行榜', visibility: 'public', summary: '查看伺服器前十名等級排行榜。' },
  { name: '特價查詢', visibility: 'public', summary: '查詢 Steam 遊戲價格、折扣、評價與詳情。' },
  { name: '戰績', visibility: 'public', summary: '查詢 VALORANT 或 League of Legends 公開戰績。' },
  { name: '設定', visibility: 'admin', summary: 'Administrator 專用管理控制台。' },
];

export function getKnowledgeCommands(isAdmin = false) {
  return COMMAND_KNOWLEDGE.filter((command) => isAdmin || command.visibility === 'public');
}

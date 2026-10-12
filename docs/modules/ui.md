# 共用 Components V2、ANSI、公告與圖片

本文件是本模組的維護規則唯一來源。開始修改前先讀 [根 AGENTS](../../AGENTS.md) 與相關交叉連結；實際程式／測試與規則矛盾時先查明並同步修正文檔。

## 入口與資料流

- [componentsV2](../../src/utils/componentsV2.js) 共用 payload／notice／panel／edit helper，[style](../../src/utils/style.js) 提供 `ansiRows()` 與色調，[customIds](../../src/utils/customIds.js) 綁 owner／scope。
- [announcementTools](../../src/utils/announcementTools.js) 產生私人草稿／preview／發布確認，[announcementImage](../../src/utils/announcementImage.js) 排版卷軸；[imageRendering](../../src/utils/imageRendering.js) 共用下載上限、圖片與 SVG helper。
- 娛樂卡片在 [funImage](../../src/commands/fun/lib/funImage.js)，戰績卡在 [statsImage](../../src/commands/esports/lib/statsImage.js)；[assets](../../assets/) 保存正式素材。

## 不可破壞的規則

- Components V2：互動式訊息與 notices 優先看 `src/utils/componentsV2.js`，避免混用不相容 payload。

- 改互動 UI 時，先找現有 builder/helper，特別是 Components V2 payload、settings panel、announcement preview、Steam detail、reaction role。
- Components V2 單則訊息最多 40 個元件；擴充 settings panel 或 AI 草稿中心時要用 `countV2Components()` 補 regression test。
- 核心互動訊息優先使用原生 Components V2；每個主要畫面最多使用一個由 `ansiRows()` 產生的短 ANSI 摘要框，且每行必須保留文字標籤，不能只靠顏色傳意。長文、Mention、URL、Discord 時間標籤及短 notices 維持一般 Markdown；每個操作列最多一個 Primary，Danger 只留給最終高風險確認。
- 成果型圖片卡必須在圖片前提供可掃讀的文字摘要，並為 Media Gallery 圖片設定具體 description；互動與管理流程不應為了品牌效果改成純圖片。
- 公告發布必須在第一個 `await` 前從 `pendingAnnouncements` 原子 claim 草稿；發布失敗時恢復草稿，成功後不可再發布。
- AI 預覽與附件限制：由於 Discord API 限制對已發送的 Ephemeral 訊息在 Edit 時無法新增/追加檔案附件，公告預覽必須以一則全新的 Ephemeral 訊息發送（使用 `component.reply` 或其 `deferReply` + `editReply` 組合），不得直接在原有面板中以 Edit 置換方式加入圖片附件。
- 公告圖片渲染排版：公告卷軸圖片需使用 `smartWrap` 函數進行中英文混合折行排版（中文/全角權重=2，英文/半角權重=1），確保英文單字在行尾不被生硬斷開並遵循避頭尾標點規則。文字的 Y 座標必須依據提及與標題行數採用垂直流式動態累加計算，避免各元素重疊。大標題需使用 `smartWrap` 限制在 `1` 行（寬度上限 `38`），內文與標題的垂直留白間距 `bodyStart` 應採用 `+ 75`（增加 45 像素）以呈現舒適的呼吸感。正文單行字數上限 `BODY_MAX_CHARS` 為 `18`（長文本為 `21`），且左側 `X` 座標對齊至 `220`，頁尾和日期亦統一在 `220` 處對齊以保持視覺平衡與工整。
- SVG 表情符號渲染優化：為防止 `sharp` / `librsvg` 因繼承粗體樣式而使黑白 Emoji 輪廓被填滿成無細節色塊，在 SVG `<tspan>` 中必須顯式設定 `font-weight="normal"`，且 `font-size` 建議調整為 `1.3em`，並使其繼承文字的深色（不設 `fill` 屬性）以融入卷軸古典風格。為防止 XML 屬性單引號解析失敗，需在 `<style>` 中定義 `.emoji` 樣式類別，並用 `<tspan class="emoji">` 套用。
- 大檔案下載防禦：對於外部資源下載，優先使用 `fetchWithLimit(url, fetchImpl, { maxBytes })`，並設定適當的 `maxBytes` (例如公告圖片 8MB/15MB，AI 圖片 5MB)，以防無 `content-length` 的超大檔案在下載時被全部載入記憶體而導致崩潰。

## 修改影響

- 共用 helper 修改需檢查 settings、AI 草稿、Steam、reaction roles、help 與音樂；音樂附件重用／合法 SGR／封面安全詳見 [音樂](music.md)。
- AI 公告標題／授權見 [AI](ai.md)，game 資產固定 host 與鳴潮點陣底圖見 [遊戲查詢](games.md)。
- 容器字型與 fontconfig 見 [啟動與維運](runtime.md)；只改 bot SVG 無法解決容器缺字型。

## 驗證方式

- 測試入口：[Components V2 遷移](../../tests/componentsV2Migration.test.js)、[下載／渲染](../../tests/imageRendering.test.js)、[娛樂卡片](../../tests/funImage.test.js)、[戰績卡片](../../src/commands/esports/__tests__/embed.test.js)、[custom ID](../../tests/customIds.test.js)。
- UI regression 檢查 40 元件、一畫面一摘要、可讀文字標籤、每列一 Primary；實際 Discord 桌面／手機及深淺主題仍需人工驗收。測試素材放 fixture 或 assets，本機預覽放 tmp。

- 圖片或卡片排版改動：跑相關 image tests，例如 `tests/imageRendering.test.js`、`tests/funImage.test.js`、`src/commands/esports/__tests__/embed.test.js`。
- ANSI 或 Components V2 共用 helper 改動：跑 `tests/componentsV2Migration.test.js`，並確認移除 ANSI escape codes 後仍保有可讀標籤與數值。`ansiRows()` 的 `labelTone` 必須 opt-in 並保留未指定時的整行上色輸出；色調只查 `ANSI_TONES` 自有屬性，未知值／原型屬性回退 `neutral`，輸入清理雙向文字方向控制碼但保留組合 emoji 的 ZWJ。測試涵蓋分色、舊輸出相容及 ESC／反引號／方向控制碼清理，不得刪除或削弱音樂安全檢查。

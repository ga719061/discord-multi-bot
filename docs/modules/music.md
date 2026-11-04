# NAS／YouTube／Bilibili 私人點播與公開播放器

本文件是本模組的維護規則唯一來源。開始修改前先讀 [根 AGENTS](../../AGENTS.md) 與相關交叉連結；實際程式／測試與規則矛盾時先查明並同步修正文檔。

## 入口與資料流

- [music command](../../src/commands/music/music.js) 綁定私人登入／點播 modal、nonce、browser 與 runtime；[music event](../../src/events/music.js) 接收 component／語音狀態並在 stop 清理。
- [play](../../src/commands/music/play.js) 提供 `/點播`，可直接給 YouTube 單曲連結或開啟原有 modal；[player](../../src/commands/music/player.js) 提供 `/播放器` 的現在播放、佇列、暫停、繼續、下一首、循環、隨機與停止，共用 music command 的 runtime 與操作流程。`/音樂` slash 立即建立或重用公開播放器，私人回覆仍保留個人點播與 NAS 入口；`/幫助` 直接 execute 保留私人入口，NAS 仍由私人曲庫選曲。
- [musicAccess](../../src/utils/musicAccess.js) 解析 NAS／Administrator 資格並串接撤權清理；[musicAccounts](../../src/utils/musicAccounts.js) 管理 guild/user 記憶體帳號。[musicLibrary](../../src/utils/musicLibrary.js) 以點播者 cookie 讀 NAS，[musicYoutube](../../src/utils/musicYoutube.js) 執行官方 yt-dlp。
- [musicPlayback](../../src/utils/musicPlayback.js) 管理 session、佇列、FFmpeg Ogg Opus 與 voice transport；[ui](../../src/commands/music/lib/ui.js) 建立 Components V2，[panel](../../src/commands/music/lib/panel.js) 序列化 edit／附件／刪除。
- 管理中心只修改 NAS 白名單並開啟本人曲庫；不可用管理密碼取代 NAS 帳密，見 [設定與資料庫](settings-database.md)。

## 不可破壞的規則

- NAS／YouTube／Bilibili 共用 FFmpeg Ogg Opus transport 與 `@discordjs/voice`，不依賴 JavaScript Opus 編碼器。

### NAS 資格與帳號

- NAS 使用資格為 guild `nas_music_whitelist` 成員，或 Administrator＋`admin_ids` 管理員；AI 使用白名單、AI enabled、`GOOGLE_AI_KEY` 不授予或限制 NAS。`ai_settings.nas_music_whitelist` 是獨立 JSON 欄位，預設 `[]`，建表／舊資料庫遷移／解析／`ALLOWED_AI_KEYS` 須同步，不複製 AI 白名單。NAS 名單每頁十人；移除管理員名單項目仍保留其管理資格。
- `musicAccess.js` 將 NAS 使用資格與 Discord Administrator 角色分開解析；不能把 NAS 資格的布林值當作管理員角色證據。撤權先取得清理 bridge，查詢角色後重讀白名單並同步建立清理障壁。已消耗但仍等待 ACK 的 NAS 登入也必須由撤權／shutdown 標記取消，不能在清理後重新開始登入。
- NAS 登入、搜尋、點播及播放／重播須驗有效資格，異步返回後再次驗權限、account ID 與 session；隱藏 UI 不能代替授權。撤權且已無其他有效資格時立即取消本人 pending login、清帳密／views、移除本人 NAS queue/current，沿用登出接續其餘歌曲並保留 YouTube／其他人。撤權清理與重新登入依 guild/user 序列化，晚到結果不可復活或刪除新帳號；Discord 管理員資格於後續操作及播放／重播重查，不新增背景輪詢。
- `/音樂`／`/幫助` 私人音樂卡皆提供影片點播，只有 NAS 授權者顯示「私人音樂庫」，NAS 設定／帳號提示只留在授權登入卡。公開播放器移除 NAS 點歌按鈕並以影片點播為 Primary；舊公開點歌入口僅為授權且已登入者相容開啟私人曲庫，其餘開一般私人音樂卡，舊 NAS interaction 仍驗權限。管理中心總覽及 NAS 頁另提供本人私人曲庫入口，不以管理密碼代替 NAS 帳密。
- 音樂設定讀取 NAS 專用 `MUSIC_API_BASE_URL`、可選 `MUSIC_FFMPEG_PATH` 與 `MUSIC_YTDLP_PATH`；NAS 未設定或無效不阻擋 YouTube，不讀舊 ENV 帳密或 guild 白名單。每人以 owner/guild/nonce 綁定的私人 modal 登入已核准的月下樂藏帳號，Discord 無密碼遮罩，不可回填密碼或接受任意 NAS 來源 URL。帳密與 cookie 僅存記憶體，30 分鐘未使用清除（本人 NAS 正在播放／待播持續使用，YouTube 不保活 NAS 帳號）、全域最多 100 個登入、6 個登入 in-flight、每人 8 秒冷卻；shutdown 清理計時器、pending login 與帳密。登入後異步搜尋/getTrack 返回及 enqueue 前須檢查相同 account ID；登出只清除自己的 NAS queued/current、NAS 封面、舊 nonce/browser，不影響 YouTube，晚到登入不可復活。每首 NAS 播放由 guild/requestedBy 解析本人 client，不能使用其他人帳號 fallback；公開控制仍限同一一般語音頻道。月下樂藏媒體 ID 是 32 位 hex（亦接受 UUID），不能當檔案路徑。API 與 stream 使用固定 origin、拒絕 redirect，帳密、URL、NAS 路徑與上游錯誤不得出現在公開面板或 log。

### YouTube 與月下樂藏整合

- Bilibili 點播與 YouTube 共用「影片點播」入口、佇列、冷卻、來源解析與暫存播放。僅接受 `https://bilibili.com/video/BV...` 或 `https://www.bilibili.com/video/BV...`；只支援第一 P，明確指定其他分 P 或重複 `p` 的連結拒絕。抽取 BV ID 後重建固定網址，不接受短網址、其他路徑、直播或整份播放清單。metadata 須是單支音訊且 ID 為相同 BV 或對應 `_p1`，播放與重播重新解析；不使用帳號／cookies，影片限制或上游錯誤可能失敗。Bilibili 目前使用文字播放器、不載入封面；NAS 撤權／登出不得刪除其歌曲或讀取其點播者 NAS 帳號。共用既有 `MUSIC_YOUTUBE_*` 安全分類，錯誤文字不將 Bilibili 誤稱為 YouTube；測試用 mock，不以即時網路驗收。

- YouTube 點播入口位於公開播放器／私人登入卡／私人曲庫，不需 NAS 登入；只接受固定 HTTPS YouTube 網域與一般影片／Shorts／YouTube Music 單曲路徑，抽出影片 ID 後重建標準 URL，忽略清單／起播時間，不支援直播、超過 2 小時或整份播放清單。曲目以 `source: nas | youtube | bilibili` 分流，缺 source 視為 NAS，影片 ID 不可交給 NAS API；佇列只存 ID 與顯示資料，播放／重播時重新解析。Modal 綁 owner/guild/player lifecycle，提交先消耗 nonce；每人一個 in-flight、8 秒冷卻、全域兩個解析，Map 上限 100，停止／shutdown 取消待處理工作並拒絕晚到結果。yt-dlp 固定參數 `shell: false`、忽略設定，不使用 cookies／帳號／PO Token 或遠端 EJS 下載；解析與首筆音訊各 30 秒，音訊 512MB，純音訊優先 WebM、其次 M4A 沿用私有暫存，失敗保留其餘佇列等待手動下一首。停止／跳歌／錯誤／shutdown 必須等待 yt-dlp 程序樹、FFmpeg 與暫存清理，不記原始 stderr 或 URL。Docker 固定官方 `yt-dlp_linux` x86_64 `2026.08.19` 並驗 SHA256 `58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a`，standalone 含 EJS，沿用 Node.js 24，不新增 Python／Deno runtime。
- CUE 分軌由月下樂藏後端建立虛擬曲目與獨立 UUID，bot 只保留 `isCueTrack` bool／1–99 `trackNumber`，不讀來源路徑或自行解讀任意裁切時間。API 提供已裁切的單首 FLAC；CUE stream header deadline 最多 60 秒（可 stop abort），普通 stream 與 JSON 維持 8 秒。改 CUE 需在音樂庫重掃，不能只改 bot。
- NAS 曲名／專輯在月下樂藏網站與 Discord 同時亂碼時，先修正曲庫後端的 metadata 索引，不在 bot UI 猜測編碼。月下樂藏 `backend/app/metadata.py` 提供保守、可逆、冪等的標籤修復，更新 music 容器並重掃可處理 mtime／size 未變的舊索引；Discord 舊曲庫／佇列仍須重新搜尋及點播，不修改音檔、CUE 或 ID。

### 面板、封面與提示

- 音樂面板使用原生文字／Section 縮圖、三首公開預覽、十首私人分頁，標示 YouTube／Bilibili 來源；NAS 歌曲資訊與封面仍公開、內部 source 分流保留，CUE 顯示分軌號，進度約 15 秒更新且不能 seek。`src/commands/music/lib/panel.js` 序列化公開 edit；NAS 封面由 requestedBy 本人 account 以固定 ID cover API 讀取，YouTube 封面只由影片 ID 組合固定 `i.ytimg.com` 路徑，不讀 NAS 帳號。共用 2MB／總期限 5 秒，驗證 PNG/JPEG/WebP 與單張 16M 像素後轉最大 512px WebP。換歌／停止取消並以 current、generation 檢查晚到結果，NAS 另驗 account ID；NAS 登出只取消 NAS 封面。附件上傳一次後保留 ID 重用、清除 buffer。封面讀取／上傳錯誤記錄不含上游資訊的 warning 並保留文字播放器，音訊不等待封面；shutdown 關閉 presenter。不得為美化增加字型、編碼器或整張卡片渲染；封面會公開到面板頻道，NAS URL／帳密不可公開。音樂每畫面最多一個由 `ansiRows()` 產生的受控 ANSI 摘要（`labelTone: neutral`、`maxWidth: 40`），只有摘要可含 helper 產生的合法 SGR 色碼；外來 metadata 與其他文字／元件仍禁止 ESC 及控制碼，不把曲名等任意長文字放入摘要。底色、色彩與字寬依 Discord 客戶端呈現，不承諾跨客戶端完全一致或任意字型／字色；按鈕圖示須使用 `.setEmoji()` 注入，既有控制保留其 label；影片點播沿用原 customId 並使用共用標籤。
- 音樂四畫面沿用王國金色容器；公開播放器資訊順序為品牌／語音頻道、歌曲／Section 縮圖、單一 ANSI 摘要（狀態、12 格進度與時間、循環）、三首待播預覽、三列操作與提示。播放／待命用 `ROYAL`、暫停用 `ROYAL_SOFT`、連線／載入用 `INFO`、失敗用 `DANGER`、停止用 `MUTED` 且優先於錯誤；不可固定宣稱語音正常。操作列依序為暫停／繼續及下一首、影片點播／查看佇列、循環／隨機／停止；影片點播為 Primary，移除公開 NAS 點歌；維持原 customId、emoji 與 disabled 規則。ANSI 內容色調：播放／待命 `royal`、暫停 `warning`、連線／載入與進度 `info`、失敗 `danger`、循環開啟 `special`／關閉 `neutral`；停止不顯示摘要。私人曲庫採歌名及歌手／專輯／時長／CUE 的兩行項目，搜尋分頁與帳號／影片點播分列；佇列列出歌手／時長，YouTube／Bilibili 顯示來源，兩者摘要為頁碼 `info`、結果數／待播數 `royal`。NAS 授權者的登入卡分列 NAS 帳號與影片點播，一般私人音樂卡僅顯示影片點播，登入及 NAS／影片點播可用狀態摘要採正常 `success`／未登入或未設定 `warning`。美化不得改搜尋排序、單首選取、100 首上限／十首分頁、權限、封面附件重用、音訊或刷新。UI 回歸須檢查單一摘要、不重複時間／循環文字、摘要僅含 helper 合法 SGR 且其餘 payload 無 ESC、40 元件上限及每列最多五個按鈕／一個 Primary；合成資料預覽可用 Message.style，桌面／手機與深淺主題另在 Discord 驗收。
- 私人曲庫搜尋列放在結果上方，保留「搜尋曲庫」Primary；有搜尋條件時另顯示 Secondary「返回最新曲目」，分頁放在選曲下方，帳號／影片點播維持獨立列。歌曲第二行使用小字並省略 NAS 標記；下拉選單歌名加上與清單一致的跨頁編號，描述保留歌手／專輯／時長／CUE。摘要「顯示 N 首」只表示取得的曲目數，不宣稱總符合數；每次搜尋仍最多 100 首。搜尋 modal 預填經安全清理的目前關鍵字，留空與「返回最新曲目」皆重新讀取本人最新曲庫並回第一頁。查詢成功且重新驗 NAS 資格、account、browser／session 及語音後才一起更新 query／tracks／page；失敗保留原條件、結果及頁面並釋放 busy。回歸須涵蓋返回／空結果、同名專輯辨識、長選項／預填安全及異步失效／併發操作。
- 影片／NAS 私人點播成功提示顯示歌名與排隊位置，5 秒後刪除；點播失敗提示 30 秒後刪除。影片點播失敗更新原解析提示，NAS 僅刪除 follow-up ID，不能刪除私人曲庫。解析中不啟動清除計時，其他登入／曲庫／佇列與公開播放器不受影響。提示計時器最多 100 個，滿額提前清除最舊提示；shutdown 取消計時器並等待已啟動的刪除，清除失敗僅記固定安全 warning。
- 手動「停止並離開」在播放資源清理完成後刪除該 session 的公開播放器貼文；Presenter 刪除須與 edit 序列化，取消封面並拒絕後續更新，尚在發送的貼文晚到時也須刪除。Discord 10008 視為已刪除；其他刪除失敗回覆私人安全提示，不影響已完成的停止。非手動停止仍保留原有停止畫面。
- 私人曲庫與佇列訊息依 guild／session 綁定並各保留最多 100 份 FIFO；保存已回覆的 interaction 與訊息 ID，同一私人訊息的成功更新／deferUpdate 才更新清除 token。停止開始即失效並清除該 session 的全部曲庫／佇列，包含其他點播者；登入卡與有效 NAS 登入不因播放器停止而登出。私人訊息發送／更新正在進行時先等待完成再刪除，晚到搜尋／getTrack 必須重驗 session／browser 並不得重開面板或點播；shutdown 等待清除。Discord token 約 15 分鐘有效，10008／10015／50027 視為已刪除或 token 失效，其他失敗只記固定安全 warning；token 失效時，下次點擊舊私人訊息以新的 interaction 刪除。此補清除只適用含匹配 customId 的 Ephemeral 曲庫／佇列，不可刪除公開播放器、登入卡或他人有效曲庫；已開啟的 modal 不能遠端關閉，提交仍重驗 lifecycle。
- 音樂事件同時監聽單筆／批次訊息刪除；只對 guild ID、文字頻道 ID 與公開貼文 ID 全部吻合的現行 session 停止播放並清除私人曲庫／佇列，支援 partial message。舊貼文刪除、刪除其他訊息及 Presenter 自行刪除不得停止 replacement；register／stop 對稱解除監聽。語音移出／切換、連線錯誤及 bot 關機沿用相同 session 清理。
- Presenter 每個 session 只允許一個公開 REST edit 進行，期間的多次更新合併為最新狀態；成功 payload 與訊息身分相同時不重複 edit。進度、封面上傳／保留／移除、換歌及控制狀態改變仍更新，失敗不得記為成功；NAS current／queue 每位 requestedBy 的保活在去重之前執行，YouTube 不保活 NAS。回歸涵蓋更新合併、無變更暫停／待命、附件重用與移除、in-flight 刪除／shutdown、晚到曲庫發送／搜尋與 replacement 隔離。

### 播放資源與生命週期

- YouTube 下載錯誤只從 stderr 的 `ERROR:` 行擷取固定分類碼，未完成行暫存在記憶體且最多 2048 字元，程序結束即清除；不得把原文、URL 或任意上游字串放進 record、error、log。yt-dlp 固定停用色碼，分類仍須清除 ANSI 並保留同一行 `ERROR: \r[download] Got error:` 的 CR 續行（含跨 chunk）；一般錯誤摘要不得覆蓋已辨識分類，過長且未換行的錯誤行可能回退未知分類。403／驗證、429、網路／資料不完整與 signal 終止分別使用 `MUSIC_YOUTUBE_BLOCKED`、`MUSIC_YOUTUBE_RATE_LIMIT`、`MUSIC_YOUTUBE_NETWORK`、`MUSIC_YOUTUBE_PROCESS`；未知維持 `MUSIC_YOUTUBE_UNAVAILABLE`。只有非零退出或 signal 才套用分類，重試成功仍正常播放，明確取消／期限／大小限制維持原碼。這些碼描述觀察到的失敗類型，不代表已證明 IP 封鎖或主機記憶體不足；不得將非零退出或部分資料當正常曲尾。
- Provider `onFailure` 在實際子程序錯誤、stdout 錯誤或非零／signal 退出時，每個子程序最多通知一次；只保留固定的 version／metadata／audio stage、process／stdout／exit origin、數字 exitCode／已接收 bytes／HTTP status，以及白名單 signal／systemCode／stderrTags。HTTP status 與 tags 僅從錯誤／警告／下載重試行觀察，任意上游字串不進事件或日誌；固定標籤集合有容量上限，不保存原文。通知在自行清理前取快照，stop／abort／期限／大小限制引起的終止不另報下載失敗；exit 0 的暫時錯誤仍不報失敗。Runtime 的 `youtube failed` 記錄這份安全快照，不改既有 `playback failed` 格式或公開錯誤訊息；快照描述觀察到的失敗位置與徵兆，不代表每個標籤都是根因。回報 hook 的同步 throw／非同步 rejection 必須隔離並發出固定 `MUSIC_YOUTUBE_DIAGNOSTIC` warning，不含例外原文，仍傳遞原 MusicError 並完成程序清理。
- 音樂快捷指令與面板共用同一一般語音頻道驗證、YouTube in-flight／8 秒冷卻、session lifecycle 與停止清理；不得因直接傳入連結而跳過驗證或另建播放器。`/音樂` slash 在確認一般語音頻道後連線並透過共用 `ensurePanel` 發送公開控制貼文，不必等點歌；重複呼叫與並行發布只重用該 session 貼文。ACK／工具探測／連線返回後重驗 session 與語音，停止或 replacement 不得被晚到開啟復活；新連線若失去權限且尚無公開面板必須清理。公開貼文對有文字頻道查看權限者可見，操作只要求同一語音頻道，不限建立者且不需 NAS 資格；NAS 帳號操作仍只在個人入口。`/播放器` 的 ACK 私人回應；現在播放建立或重用相同公開面板並回覆連結，沿用 Presenter 自動更新與全部控制，不再產生私人唯讀快照。現在播放與私人佇列皆須驗證同一語音頻道；暫停／繼續為明確狀態操作，循環模式必填且只接受 `off`／`track`／`queue`，隨機只改待播佇列。手動停止等待音訊及已取消的 YouTube 解析工作清理，再刪除公開面板、清除該 session 私人曲庫／佇列／面板連結回覆，沿用既有失敗提示。解析等待由共用控制入口處理，不在 manager.stop 內等待 request.done，避免點播錯誤清理反向等待造成死鎖。快捷入口不新增 YouTube 文字搜尋、整份清單或音量設定。
- 音樂每 guild 一個播放器、全域最多 2 個、佇列最多 100 首；空佇列／無真人均持續待命，不設 idle／audience 自動離開計時器；手動停止或 bot 被移出／切換語音頻道時結束，連線錯誤與 shutdown 仍清理。待命 session 也占用全域名額；空佇列 idle 不做每 15 秒面板刷新，idle 仍有待播時持續刷新以保活各自帳號。停止／shutdown 必須中止 HTTP stream、FFmpeg 與語音連線。音訊以 backpressure 串流且單檔上限 512MB，JSON 上限 1MB；聽眾以 Discord 個人音量設定調整聽感，bot 固定套用 50% 音訊增益、不保留播放音量設定。Docker runtime 的 FFmpeg 必須支援 `libopus`，本機可用 `MUSIC_FFMPEG_PATH` 指定。
- 播放器允許連續缺少 50 個 20ms 封包（約 1 秒），短暫供料恢復後繼續同一首。SDK Idle 時已銷毀串流，不能以 `resource.ended`／`destroyed` 當正常曲尾證據；若目前 resource 的 `playStream.readableEnded === false`，須回報 `MUSIC_STREAM_STALLED`，保留待播歌曲且不循環重播失敗曲目。非預期 FFmpeg exit signal／非零 exit code 回報 `MUSIC_FFMPEG`；stop／skip／logout 的自行取消不得當音訊失敗。`onPlaybackError` 只記 prepare／audio stage、安全 code 與 playedSeconds，不記原始錯誤、曲目或 URL。音樂私人曲庫／登入面板不設 TTL；曲庫依 session 與 account ID 驗證，停止時清除該 session 的 browser，新開曲庫時清理已結束 session，登出清除本人 views。登入卡沿用每人每 guild 最新 nonce，nonce／browser 各保留 100 份 FIFO 上限，私人訊息追蹤上限見上段，shutdown 清除；不得把面板期限與帳號未使用 30 分鐘清除混為一談。`MUSIC_EXPIRED` 是失效 nonce／舊 session 的互動錯誤，不能據此推定音訊中斷。
- 所有 YouTube／Bilibili 格式與 NAS M4A／MP4 使用私有暫存檔（512MB、首筆音訊後整首下載 60 秒上限）。YouTube／Bilibili 必須下載完整且 yt-dlp exit 0、無 signal 才啟動 FFmpeg，避免語音 backpressure 延長上游連線、下載重試使即時供料耗盡；有限 HTTP／fragment 重試各 3 次，缺少 fragment 必須失敗，不能略過後播放缺損音訊。YouTube 整首逾時使用 `MUSIC_YOUTUBE_TIMEOUT`，明確取消仍為 `MUSIC_ABORTED`。FFmpeg 依新解析 MIME 固定白名單 demuxer（WebM 為 matroska），未知格式拒絕；MOV 另禁止外部 references。啟播需等待下載，慢速或長曲可能在載入時超時，不能宣稱上游網路已修復；失敗保留待播佇列供手動下一首。停止／換曲需等待下載程序、FFmpeg 關閉及暫存清理，容器需預留約 1GB 暫存空間。其餘 NAS 格式維持限制 protocol 的 pipe 串流。

## 修改影響

- NAS 權限變更同時檢查 musicAccess、settings、database、music command、accounts 與 playback；不能只隱藏 UI。資料欄位通用遷移規則見 [設定與資料庫](settings-database.md)。
- 音樂 code 分散於 commands、events 與 utils，修改任一處必讀本文件；help 的直接 execute 入口見 [社群功能](community.md)。
- Components V2／ANSI 共用合約見 [共用 UI／圖片](ui.md)；固定 yt-dlp 建置、runtime 字型／FFmpeg 與 Docker 降權見 [啟動與維運](runtime.md)。
- 月下樂藏後端不是本 repo：本文件記錄既有整合合約；後端修復須另行取得該專案授權與文件。

## 驗證方式

- 測試入口：[權限](../../tests/musicAccess.test.js)、[帳號](../../tests/musicAccounts.test.js)、[曲庫](../../tests/musicLibrary.test.js)、[播放](../../tests/musicPlayback.test.js)、[UI](../../tests/musicUi.test.js)、[command](../../tests/musicCommand.test.js)、[YouTube](../../tests/musicYoutube.test.js)、[來源／封面](../../tests/musicYoutubePanel.test.js)。
- 快捷指令須在 command／playback tests 覆蓋直接連結與 modal 共用冷卻、跨語音拒絕、無播放器、明確暫停／繼續、循環選擇、私人佇列及停止後晚到結果失效；另涵蓋 `/音樂` 未點歌即公開、重複／並行開啟去重、其他成員無 NAS 帳號可控制／點播、個人 NAS 入口隔離、連線中離開清理及 ACK 期間停止／replacement。公開結構由 [manifest](../../tests/commandManifest.test.js) 驗證。
- 真實轉碼驗證腳本為 [verify-music-audio](../../scripts/verify-music-audio.js)，使用 `npm run verify:music`；設定整合另見 [settingsPanel](../../tests/settingsPanel.test.js)。
- 自動測試不能證明 Discord 客戶端外觀、正式 NAS 負載或 YouTube 403 可繞過；這些需使用者在 NAS／Discord 實際驗收。

- FFmpeg stdin 的 `EPIPE`／`ERR_STREAM_PREMATURE_CLOSE` 只有在來源 `readableEnded` 且程序明確 exit 0、無 signal 時可視為正常收尾；等待 exit 結果前不得銷毀剩餘 Ogg Opus。上游 `MusicError`、未完成來源與 FFmpeg 非零／signal 仍須報錯，取消仍等待程序 close。yt-dlp 的 `bytes > 0` 不代表完整下載，不能據此放行 exit 1／141／SIGPIPE。`musicPlayback.test.js` 使用真實 voice player 驗證完整尾包，`verify:music` 另以真實 FFmpeg 注入 EOF 後 stdin 關閉並比較完整封包數。
- Discord Components V2 引用的封面可能不出現在 `Message.attachments`；上傳回應須優先從 Container → Section → Thumbnail 的 `media.attachment_id` 及 `url`／`proxy_url` 取得附件 ID 與圖片網址，再相容舊 attachments 集合。只有首次上傳使用 `attachment://檔名`；進度更新保留附件 ID 並使用 Discord CDN 網址，移除簽名 query，由 Discord 自動刷新。僅接受 Discord HTTPS attachments 路徑且網址內附件 ID 須一致。封面 regression 必須使用真正 Discord.js Message 與 MessagePayload 模擬 `attachments: []`、首次成功後刷新回報 50035，並確認多次刷新與暫停保留封面、換歌／登出／停止移除附件；不可只測傳統附檔回應。封面失敗日誌只記 download／upload stage 與固定安全代碼，不輸出上游錯誤內容。
- NAS 音樂 API、登入、播放生命週期或 UI 改動：跑 `tests/musicAccess.test.js`、`tests/musicAccounts.test.js`、`tests/musicLibrary.test.js`、`tests/musicPlayback.test.js`、`tests/musicUi.test.js`、`tests/musicCommand.test.js`；管理中心另跑 `tests/settingsPanel.test.js`。使用 mock 曲庫與 voice adapter、舊 schema temp DB，不登入真實服務或寫正式資料。音訊轉碼以合成音訊驗證，不使用實際館藏。
- YouTube provider／音樂來源分流改動另跑 `tests/musicYoutube.test.js`、command tests、`tests/musicYoutubePanel.test.js`；yt-dlp 使用 mock 子程序及本機 Node 子程序驗證完整 drain／停止等待 close，封面來源切換／NAS 登出隔離用真正 Discord.js Message／MessagePayload。首次點播及重用 connecting session 都須等待語音 ready；無播放器 modal 在提交時綁定當下的 session；失去語音權限時清理尚無面板的空 session。Manager `onStop` 在開始停止時同步取消 guild 待處理點播；停止最終通知只能取消相同 session ID 的請求，不能誤取消 replacement。測試不連真實 YouTube，另由使用者在 NAS 驗收實際播放、混排與兩個播放器負載；mock／合成音訊不能證明 YouTube 驗證或 403 可繞過。
- 播放供料 regression 使用真正 `@discordjs/voice` 與合成 Opus，僅 mock 網路 receiver；需涵蓋短暫停頓恢復、持續缺幀、正常 EOF、FFmpeg signal 終止及 skip／stop／logout 對照，不能只用 FakePlayer 的 Idle 模擬。
- SDK 的 `AudioPlayerError` 不保留原始 stream error 的 code／cause；transport 必須只保存已清理的 `MusicError` failure，由 manager 配對 `error.resource` 後取回安全原因。FFmpeg／stream 分類測試須經過真正 player 的 error 包裝，不能只監聽底層 stream。
- `npm run verify:music` 需要支援 `libopus` 的 FFmpeg，以合成 WAV、MP3、CUE 單首 FLAC、檔尾索引 M4A 及 mock YouTube WebM／M4A 實際驗證 Ogg Opus 串流與取消時等待 close／暫存清理；不讀取正式音樂、帳密或 Discord。此腳本另量測 20ms 即時發送；不能代表 NAS 播放負載，斷音排查仍須區分主執行緒延誤、空音訊緩衝與 Discord 網路問題。

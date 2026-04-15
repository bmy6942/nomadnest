# NomadNest 上線可行性評估暨開發路線圖

> **文件版本：** v1.0
> **評估日期：** 2026-04-15
> **評估團隊：** PM、招商專家、網站美術/UX、資安專家、QA、系統架構師、數位游牧專家
> **整體裁定：** ⚠️ Beta 可開放 ｜ 正式招商需完成 Phase 1 & 2

---

## 整體評分

| 面向 | 評分 | 狀態 |
|------|------|------|
| 功能完整性 | 8.5/10 | 🟢 良好 |
| 資訊安全 | 7.5/10 | 🟡 需補強 |
| UI/UX 設計 | 7.0/10 | 🟡 需優化 |
| 系統架構穩定性 | 6.5/10 | 🟠 有風險 |
| QA 測試覆蓋 | 8.0/10 | 🟢 良好 |
| 招商準備度 | 5.5/10 | 🔴 明顯不足 |
| 數位游牧產品適配 | 8.0/10 | 🟢 良好 |

---

## Phase 0 ｜ 內部強化（不需對外串接）

> 目標：在串接任何外部服務之前，先讓平台本身達到可對外展示的品質水準。
> 預估時程：4–6 週

### 0-A 安全強化（資安）

- [ ] **JWT Session Revocation 機制**
  - 目前 JWT 無法主動撤銷，改密碼後舊 token 仍有效
  - 方案：在資料庫建立 `RevokedToken` 表，logout / 改密碼時寫入，middleware 驗證時查詢
  - 優先級：🔴 P0

- [ ] **`CRON_SECRET` 強化**
  - 目前開發用 `"dev"`，上線前必須換為 32 位元以上亂數字串
  - 優先級：🔴 P0

- [ ] **In-Memory Rate Limiting → DB-backed**
  - 目前重啟伺服器後計數器歸零，多實例部署失效
  - 方案：先以 Prisma + SQLite/PostgreSQL 實作持久化 rate limit 表（待 DB 遷移完成後同步）
  - 優先級：🟠 P1

### 0-B 用戶體驗強化（UX + PM）

- [ ] **Onboarding 引導流程**
  - 新用戶註冊後直接進 Dashboard，無角色引導，體驗斷裂
  - 設計：`/onboarding` 步驟頁（選角色 → 完善資料 → 引導到第一個動作）
  - 優先級：🔴 P0

- [ ] **房東招募 Landing Page**
  - 目前缺少「為什麼要在 NomadNest 上架？」的說明頁
  - 路徑：`/for-landlords`
  - 內容：數位游牧族市場數據、房東儀表板 preview、上架流程說明、CTA
  - 優先級：🔴 P0

- [ ] **空狀態設計統一**
  - 部分頁面用 emoji 🏠，部分用 SVG，視覺不一致
  - 建立統一的 `EmptyState` 元件
  - 優先級：🟡 P2

- [ ] **手機版篩選器 UX 改版**
  - 目前篩選條件在手機版佔版面過多，體驗笨重
  - 改為底部 Sheet modal（Bottom Sheet）
  - 優先級：🟠 P1

### 0-C 產品差異化功能（數位游牧 + PM）

- [ ] **Nomad Score 游牧適合指數**
  - 整合 Wi-Fi 速度、書桌設施、噪音、自然採光為 0–10 分綜合指數
  - 展示於房源卡片與詳情頁
  - 優先級：🟠 P1

- [ ] **噪音等級評分欄位**
  - 資料庫新增 `noiseLevel` 欄位（1–5，1=極安靜，5=高噪音）
  - 上架表單新增此欄位，房源卡片顯示
  - 優先級：🟠 P1

- [ ] **附近共工空間資訊欄位**
  - 資料庫新增 `nearbyCowork` 文字欄位（名稱 + 步行距離）
  - 優先級：🟡 P2

- [ ] **入住方式（門鎖類型）欄位**
  - 資料庫新增 `checkinMethod`（數位門鎖、keybox、實體鑰匙、需見面）
  - 優先級：🟡 P2

- [ ] **體驗週方案（短租選項）**
  - 目前最短租期以月計，新增「體驗週」7 天選項
  - 優先級：🟡 P2

### 0-D 視覺設計補強（美術）

- [ ] **深色模式（Dark Mode）**
  - 全球游牧族常在夜間工作，深色模式缺失是明顯痛點
  - 技術：Tailwind `dark:` class + `next-themes` 套件
  - 優先級：🟠 P1

- [ ] **首頁「Why NomadNest」品牌差異化區塊**
  - 加入情境圖、核心價值主張（Wi-Fi 驗證、數位合約、即時訊息）
  - 優先級：🟠 P1

- [ ] **合約頁面視覺升級**
  - 目前版型過於技術導向，缺乏品牌感
  - 加入 Logo、專業排版、數位簽名視覺設計
  - 優先級：🟠 P1

- [ ] **Pricing / 商業模式頁**
  - 路徑：`/pricing`
  - 內容：免費刊登 vs 置頂加值、平台服務費說明
  - 優先級：🟠 P1

- [ ] **About Us / Brand Story 頁**
  - 路徑：`/about`
  - 內容：創辦理念、團隊、媒體聯繫方式
  - 優先級：🟡 P2

### 0-E QA 補強

- [ ] **SMTP 郵件 E2E 測試**
  - 使用 Mailhog 或 Mailtrap 建立測試 inbox，確認忘記密碼 / Email 驗證信可正確送達
  - 優先級：🔴 P0

- [ ] **手動探索性測試（Exploratory Testing）**
  - 完整走過 Happy Path：註冊 → 上架 → 申請 → 訊息 → 看房 → 合約 → 評價
  - 優先級：🔴 P0

- [ ] **合約 PDF 生成 E2E 測試**
  - 優先級：🟠 P1

- [ ] **PWA 離線模式驗證**
  - 手動確認 Service Worker offline fallback 正常運作
  - 優先級：🟡 P2

---

## Phase 1 ｜ 外部串接（對外上線前）

> 目標：建立商業閉環，讓平台能實際產生收入。
> 預估時程：3–4 週（在 Phase 0 完成後啟動）

### 1-A 資料庫遷移（架構師）

- [ ] **SQLite → PostgreSQL**
  - 建議使用 Supabase PostgreSQL（已有 Supabase Storage 帳號）
  - 步驟：更新 `DATABASE_URL`、執行 `prisma migrate deploy`、驗證所有 API 端點
  - ⚠️ 這是上線前的最高優先任務，影響所有並發寫入穩定性
  - 優先級：🔴 P0

### 1-B 金流整合（PM + 架構師）

- [ ] **第三方支付整合**
  - 台灣市場建議：綠界 ECPay（支援信用卡、超商、行動支付）
  - 國際市場備選：Stripe（外籍用戶更熟悉）
  - 功能：平台服務費（3–5%）、押金代管、自動分帳給房東
  - 優先級：🔴 P0（招商必要條件）

### 1-C 地圖串接（架構師）

- [ ] **Google Maps / Mapbox 整合**
  - 目前地圖按鈕存在但未真正串接
  - 建議使用 Mapbox（較低成本）或 Google Maps Platform
  - 功能：房源位置標記、距離計算、共工空間標示
  - 優先級：🟠 P1

### 1-D 基礎設施強化（架構師）

- [ ] **Redis 導入**
  - Rate limiting 持久化（取代 In-memory 實作）
  - Session blacklist（Token revocation）
  - 建議：Upstash Redis（Serverless，與 Vercel 相容）
  - 優先級：🟠 P1

- [ ] **Cloudflare 防護層**
  - 免費版即可提供 DDoS 防護、Bot 過濾
  - 優先級：🟠 P1

---

## Phase 2 ｜ 規模化準備

> 目標：為平台快速成長做好基礎設施準備。
> 預估時程：持續進行

- [ ] 負載測試（k6）— QA
- [ ] API 公開文件（Swagger/Redoc）— 架構師
- [ ] 多語言地址格式（英文版行政區翻譯）— 數位游牧
- [ ] 媒體/PR 聯繫頁 — 招商
- [ ] 邀請房東送優惠機制（冷啟動策略）— PM

---

## 附件：已完成的安全修正記錄

> 以下項目已在 2026-04-15 工程師會議中完成修正

| 項目 | 說明 | 狀態 |
|------|------|------|
| JWT Secret 統一化 | register / forgot-password / reset-password / verify-email 統一使用 `getJwtSecret()` | ✅ 完成 |
| `/api/auth/me` 401 修正 | 未登入時正確回傳 401 而非 200 | ✅ 完成 |
| Email 正規化順序修正 | Login rate-limit key 在正規化後建立，防止大小寫繞過 | ✅ 完成 |
| SWR 快取層 | 建立 `clientCache.ts`，消除 1-3 秒頁面切換卡頓 | ✅ 完成 |
| 骨架屏全覆蓋 | Dashboard / Favorites / Analytics / Messages / Chat 全部有骨架屏 | ✅ 完成 |
| Rules of Hooks 修正 | Dashboard `useMemo` 移至 early return 之前 | ✅ 完成 |
| 訊息系統 UI 重設計 | Western-style inbox + chat，彩色 Avatar，西式時間格式 | ✅ 完成 |
| ListingCard badge 修正 | 已驗證 badge 過大、愛心按鈕過大，已縮至正確尺寸 | ✅ 完成 |

---

## 快速決策參考

```
現在可以做什麼？
└── Phase 0（不需外部串接）
    ├── P0 立即啟動 → Onboarding + 房東 Landing Page + SMTP 測試
    ├── P1 接續 → Nomad Score + 深色模式 + 手機篩選器
    └── P2 規劃中 → About / Pricing / 附近共工空間

需要外部服務？
└── Phase 1（等 Phase 0 完成後啟動）
    ├── P0 → PostgreSQL 遷移 + 金流整合
    └── P1 → 地圖串接 + Redis + Cloudflare
```

---

*本文件由 NomadNest 跨職能團隊共同產出，應隨開發進度持續更新。*
*最後更新：2026-04-15*

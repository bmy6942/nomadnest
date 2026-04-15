# 🏡 NomadNest Taiwan — 內部測試版 v0.1.0

> 台灣第一個專為數位游牧工作者設計的中長租媒合平台

---

## ⚡ 快速啟動（5分鐘）

### 環境需求

- **Node.js 18 以上**（[下載點](https://nodejs.org/)）
- **Windows / Mac / Linux** 均可

---

### 步驟一：安裝依賴

打開終端機（Windows 用 PowerShell 或 CMD），進入本資料夾：

```bash
cd nomadnest
npm install
```

> 首次安裝約需 1～3 分鐘，需要網路連線

> ⚠️ 若之前已安裝過舊版，請先刪除 `node_modules` 資料夾再重新安裝：
> ```bash
> rd /s /q node_modules    # Windows
> npm install
> ```

---

### 步驟二：初始化資料庫 + 種子資料

```bash
npm run db:setup
```

這個指令會：
1. 自動建立 SQLite 資料庫（`prisma/dev.db`）
2. 建立所有資料表
3. 植入 **12 則測試房源** + **6 個測試帳號**

---

### 步驟三：啟動開發伺服器

```bash
npm run dev
```

打開瀏覽器前往 👉 **http://localhost:3000**

---

## 🧪 測試帳號

| 角色 | Email | 密碼 |
|------|-------|------|
| 🔑 管理員 | admin@nomadnest.tw | admin123 |
| 🏠 房東（台北/新北） | landlord1@test.com | test123 |
| 🏠 房東（台中/花蓮） | landlord2@test.com | test123 |
| 🏠 房東（高雄，未驗證） | landlord3@test.com | test123 |
| 🧳 租客 Sarah（UI設計師） | sarah@test.com | test123 |
| 🌍 租客 Thomas（外籍工程師） | thomas@test.com | test123 |

---

## 📱 功能清單（v0.1.0）

### 租客功能
- [x] 會員註冊 / 登入
- [x] 瀏覽所有房源（列表 + 地圖篩選）
- [x] 多條件篩選（城市、房型、Wi-Fi速度、月租上限、租期、外籍友善）
- [x] 房源詳情頁（工作環境、Wi-Fi徽章、設備清單、房東資訊）
- [x] 申請看房 / 租屋
- [x] 我的控制台（查看申請狀態、撤回申請）
- [x] 查看租客評價

### 房東功能
- [x] 刊登房源（三步驟引導式填寫）
- [x] Wi-Fi 速度標示
- [x] 費用包含設定（水電網路等）
- [x] 我的房源管理
- [x] 查看並審核收到的租客申請
- [x] 接受 / 婉拒申請

### 管理後台（admin@nomadnest.tw 登入後右上角選單）
- [x] 查看所有房源（全部/待審核/上架中/未通過）
- [x] 審核通過 → 上架
- [x] 退件處理
- [x] 強制下架

---

## 📋 頁面結構

| 路徑 | 說明 |
|------|------|
| `/` | 首頁（Hero + 搜尋 + 精選房源） |
| `/listings` | 房源列表（篩選器 + 搜尋） |
| `/listings/[id]` | 房源詳情頁 |
| `/auth/login` | 登入（含測試帳號快速登入） |
| `/auth/register` | 註冊 |
| `/dashboard` | 用戶控制台 |
| `/submit` | 刊登房源（三步驟表單） |
| `/admin` | 管理後台（需管理員帳號） |

---

## 🛠 常用指令

```bash
# 啟動開發伺服器
npm run dev

# 重置資料庫（清空重建）
npm run db:reset

# 用瀏覽器查看資料庫內容
npm run db:studio

# 建立正式版本
npm run build
```

---

## 📁 技術架構

| 層次 | 技術 |
|------|------|
| 前端框架 | Next.js 14（App Router）|
| 樣式 | Tailwind CSS |
| 資料庫 | SQLite（透過 Prisma ORM）|
| 認證 | JWT（httpOnly Cookie）|
| 密碼加密 | bcryptjs |
| 執行環境 | Node.js 18+ |

**資料庫檔案位置：** `prisma/dev.db`（自動建立，可用 DB Browser for SQLite 開啟查看）

---

## 🔧 常見問題

**Q: 執行 `npm run db:setup` 出錯？**
確認 Node.js 版本 ≥ 18，並確保有網路連線（Prisma 需要下載引擎）

**Q: 登入後顯示空白頁？**
重新整理頁面（Ctrl+F5），如果持續出現，執行 `npm run db:reset`

**Q: 資料庫如何重置？**
執行 `npm run db:reset` 會清空所有資料並重新植入測試資料

**Q: 如何新增管理員帳號？**
執行 `npm run db:studio` 打開 Prisma Studio，直接修改用戶的 role 欄位為 `admin`

---

## 🚀 下一版本規劃（v0.2.0）

- [ ] 圖片本機上傳功能
- [ ] Wi-Fi 速度 App 內測速工具
- [ ] 站內訊息系統（即時聊天）
- [ ] 電子合約生成與簽署
- [ ] 押金第三方託管流程
- [ ] LINE Notify 通知整合
- [ ] 房源地圖模式（Google Maps）
- [ ] 用戶評價系統完整版

---

*NomadNest Taiwan v0.1.0 Beta — 內部測試版，請勿對外發布*

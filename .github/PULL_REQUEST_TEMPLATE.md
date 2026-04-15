## 📋 PR 摘要

<!-- 用 1-3 句話說明這個 PR 做了什麼，以及為什麼需要這個改動 -->

## 🔄 改動類型

<!-- 勾選適用項目 -->

- [ ] 🐛 Bug fix（修復問題，不破壞現有功能）
- [ ] ✨ New feature（新增功能）
- [ ] ♻️ Refactor（重構，不改變功能）
- [ ] ⚡ Performance improvement（效能優化）
- [ ] 🔒 Security fix（安全性修正）
- [ ] 🌐 i18n（國際化相關）
- [ ] 📦 Dependency update（套件版本升級）
- [ ] 🔧 CI/CD（流程相關）
- [ ] 📝 Docs（文件更新）

## 📸 截圖 / 錄影（UI 變更時必填）

<!-- 貼上 Before / After 截圖或 GIF -->

| Before | After |
|--------|-------|
|        |       |

## ✅ 自我審查清單

### 程式碼品質
- [ ] 本地執行 `npm run typecheck` 通過（零 TypeScript 錯誤）
- [ ] 本地執行 `npm run lint` 通過（零 ESLint 警告/錯誤）
- [ ] 本地執行 `npm test` 通過（所有單元測試通過）
- [ ] 新功能已補充對應單元測試
- [ ] 沒有遺留 `console.log` 除錯用輸出

### 安全性
- [ ] 無敏感資料（API Key、Secret、密碼）混入程式碼
- [ ] 使用者輸入已做驗證/清理
- [ ] API endpoint 有適當的身份驗證與授權檢查
- [ ] Rate limiting 已套用（如有新 API）

### 效能
- [ ] 圖片使用 `<Image>` 元件（非 `<img>`）
- [ ] 大型套件有做 dynamic import 或 tree-shaking
- [ ] 資料庫查詢有適當的索引考量

### 國際化（如有 UI 文字變動）
- [ ] 新增文字已加入 `messages/zh-TW.json`
- [ ] 新增文字已加入 `messages/en.json`
- [ ] 使用 `useTranslations()` / `getServerTranslations()` 而非硬編碼字串

### API 變更（如有）
- [ ] Breaking change 已通知相關人員
- [ ] 有適當的錯誤處理（try/catch + 回傳正確 HTTP status）

## 📌 關聯 Issue

<!-- 關聯此 PR 解決的 issue（例如：Closes #123） -->

Closes #

## 🧪 測試方式

<!-- 說明如何測試這個 PR，讓 reviewer 可以重現 -->

1. 
2. 
3. 

## 📝 其他備注

<!-- 部署注意事項、資料庫 migration、環境變數新增等 -->

/**
 * NomadNest Taiwan — API Smoke Test (純 Node.js，不需 Playwright / 瀏覽器)
 *
 * 用途：快速驗證 dev server 核心 API 是否正常回應
 * 使用方式：
 *   node scripts/smoke-test.mjs
 *   node scripts/smoke-test.mjs --base=http://localhost:3001
 */

const BASE = process.argv.find(a => a.startsWith('--base='))?.split('=')[1]
  ?? process.env.BASE_URL
  ?? 'http://localhost:3001';

const TENANT_EMAIL    = 'sarah@test.com';
const TENANT_PASSWORD = 'test123';

let passed = 0;
let failed = 0;
const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ status: '✅', name });
    passed++;
  } catch (err) {
    results.push({ status: '❌', name, error: err.message });
    failed++;
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected)
        throw new Error(`期望 ${JSON.stringify(expected)}，實際得到 ${JSON.stringify(actual)}`);
    },
    toBeOneOf(arr) {
      if (!arr.includes(actual))
        throw new Error(`期望 [${arr.join(', ')}] 之一，實際得到 ${actual}`);
    },
    toContain(str) {
      if (!String(actual).includes(str))
        throw new Error(`期望包含 "${str}"，實際為 "${String(actual).slice(0, 100)}"`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`期望 truthy，實際得到 ${JSON.stringify(actual)}`);
    },
    toBeArray() {
      if (!Array.isArray(actual))
        throw new Error(`期望陣列，實際為 ${typeof actual}：${JSON.stringify(actual).slice(0, 80)}`);
    },
    toBeNumber() {
      if (typeof actual !== 'number')
        throw new Error(`期望 number，實際為 ${typeof actual}：${JSON.stringify(actual)}`);
    },
  };
}

/**
 * 從 Set-Cookie header 提取 name=value 部分（去除 HttpOnly、Path 等屬性）
 * Node.js fetch 在 Undici 下 set-cookie 有時會是陣列，有時是逗號分隔的單一字串
 */
function extractCookieValue(setCookieHeader) {
  if (!setCookieHeader) return '';
  // 取第一段 name=value（分號前）
  const firstPart = setCookieHeader.split(';')[0];
  return firstPart.trim();
}

// ─────────────────────────────────────────────
// 測試開始
// ─────────────────────────────────────────────
console.log(`\n🚀 NomadNest API Smoke Test`);
console.log(`   Target: ${BASE}\n`);

// ── 取得 cookie（登入）─────────────────────────
let authCookie = '';

await test('POST /api/auth/login — 正確帳密', async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TENANT_EMAIL, password: TENANT_PASSWORD }),
  });
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.success).toBe(true);
  expect(data.user.email).toBe(TENANT_EMAIL);

  // 提取 session cookie（只要 name=value 部分）
  const rawCookie = res.headers.get('set-cookie') ?? '';
  authCookie = extractCookieValue(rawCookie);
  if (!authCookie) throw new Error('登入成功但未收到 Set-Cookie header');
});

await test('POST /api/auth/login — 錯誤密碼 → 401', async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TENANT_EMAIL, password: 'wrongpassword' }),
  });
  expect(res.status).toBe(401);
});

// ── 公開 API ──────────────────────────────────
await test('GET /api/listings — 返回房源列表', async () => {
  const res = await fetch(`${BASE}/api/listings`);
  expect(res.status).toBe(200);
  const data = await res.json();
  const listings = data.listings ?? data;
  expect(listings).toBeArray();
});

await test('GET /api/listings?city=taipei — 城市篩選', async () => {
  const res = await fetch(`${BASE}/api/listings?city=taipei`);
  expect(res.status).toBe(200);
});

await test('GET /api/listings?type=套房 — 類型篩選', async () => {
  const res = await fetch(`${BASE}/api/listings?type=${encodeURIComponent('套房')}`);
  expect(res.status).toBe(200);
});

await test('GET /api/listings/[不存在 ID] — 404', async () => {
  const res = await fetch(`${BASE}/api/listings/nonexistent-id-xyz`);
  expect(res.status).toBe(404);
});

// ── Sitemap / Robots ──────────────────────────
await test('GET /sitemap.xml — 返回 XML', async () => {
  const res = await fetch(`${BASE}/sitemap.xml`);
  expect(res.status).toBe(200);
  const text = await res.text();
  expect(text).toContain('<urlset');
});

await test('GET /robots.txt — 返回 200', async () => {
  const res = await fetch(`${BASE}/robots.txt`);
  expect(res.status).toBe(200);
  const text = await res.text();
  expect(text.toLowerCase()).toContain('user-agent');
});

// ── Auth 設計說明 ─────────────────────────────
// /api/auth/me  → 未登入回 200 { user: null }（Navbar 需要），不是 401
// /api/status   → 未登入回 200 { unreadMessages:0, unreadNotifications:0 }（Navbar 輪詢），不是 401
// /api/listings/recent → 需登入（個人瀏覽記錄），回 401

await test('GET /api/auth/me 未登入 — 回 200 { user: null }', async () => {
  const res = await fetch(`${BASE}/api/auth/me`);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.user).toBe(null);
});

await test('GET /api/status 未登入 — 回 200 zeros', async () => {
  const res = await fetch(`${BASE}/api/status`);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.unreadMessages).toBe(0);
  expect(data.unreadNotifications).toBe(0);
});

// ── 受保護 API（未登入 → 401）────────────────
for (const path of [
  '/api/dashboard',
  '/api/favorites',
  '/api/notifications',
  '/api/listings/recent',
]) {
  await test(`GET ${path} 未登入 → 401`, async () => {
    const res = await fetch(`${BASE}${path}`);
    expect(res.status).toBe(401);
  });
}

// ── 受保護 API（已登入）────────────────────────
const headers = { Cookie: authCookie };

await test('GET /api/auth/me — 回 { user: { email } }', async () => {
  const res = await fetch(`${BASE}/api/auth/me`, { headers });
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.user?.email).toBe(TENANT_EMAIL);
});

await test('GET /api/dashboard — 返回 myApplications 陣列', async () => {
  const res = await fetch(`${BASE}/api/dashboard`, { headers });
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.myApplications).toBeArray();
});

await test('GET /api/favorites — 返回 { favorites: [] }', async () => {
  const res = await fetch(`${BASE}/api/favorites`, { headers });
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.favorites).toBeArray();
});

await test('GET /api/notifications — 返回 { notifications: [], unreadCount: N }', async () => {
  const res = await fetch(`${BASE}/api/notifications`, { headers });
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.notifications).toBeArray();
  expect(data.unreadCount).toBeNumber();
});

await test('GET /api/status — 返回 { unreadMessages, unreadNotifications }', async () => {
  const res = await fetch(`${BASE}/api/status`, { headers });
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.unreadMessages).toBeNumber();
  expect(data.unreadNotifications).toBeNumber();
});

await test('GET /api/listings/recent — 已登入返回 200', async () => {
  const res = await fetch(`${BASE}/api/listings/recent`, { headers });
  expect(res.status).toBeOneOf([200, 304]);
});

// ── 輸入驗證 ──────────────────────────────────
await test('POST /api/auth/login — 空 body → 400', async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  expect(res.status).toBe(400);
});

await test('POST /api/auth/login — 無效 email → 400', async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email', password: 'abc' }),
  });
  expect(res.status).toBe(400);
});

await test('POST /api/auth/login — SQL 注入嘗試 → 非 500', async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: "' OR '1'='1@x.com", password: "' OR '1'='1" }),
  });
  if (res.status === 500) throw new Error('不應回傳 500（SQL 注入防護失敗）');
});

await test('POST /api/favorites — 無 listingId → 400/422', async () => {
  const res = await fetch(`${BASE}/api/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    body: '{}',
  });
  if (![400, 422].includes(res.status))
    throw new Error(`期望 400/422，得到 ${res.status}`);
});

// ─────────────────────────────────────────────
// 輸出結果
// ─────────────────────────────────────────────
console.log('\n📋 測試結果\n' + '─'.repeat(55));
for (const r of results) {
  const errPart = r.error ? `\n       → ${r.error}` : '';
  console.log(`  ${r.status}  ${r.name}${errPart}`);
}

const total = passed + failed;
console.log('\n' + '═'.repeat(55));
console.log(`  通過 ${passed} / ${total}  |  失敗 ${failed}`);
if (failed === 0) {
  console.log('  🎉 所有測試通過！');
} else {
  console.log(`  ⚠️  有 ${failed} 個測試需要修正`);
}
console.log('═'.repeat(55) + '\n');

if (failed > 0) process.exit(1);

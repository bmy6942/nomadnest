/**
 * NomadNest Email 通知服務
 *
 * 設定方式：在 .env.local 加入以下變數
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=your@gmail.com
 *   SMTP_PASS=your-app-password   (Gmail 需要 App Password)
 *   SMTP_FROM=NomadNest <your@gmail.com>
 *
 * 若未設定 SMTP_HOST，所有通知僅印出 console.log（開發模式）。
 */

type MailOptions = {
  to: string;
  subject: string;
  html: string;
};

// ---------- 傳送工具 ----------

async function sendMail(opts: MailOptions) {
  if (!process.env.SMTP_HOST) {
    // 開發模式：印出到 console，不實際寄信
    console.log('\n📧 [Email 模擬寄送]');
    console.log(`  To:      ${opts.to}`);
    console.log(`  Subject: ${opts.subject}`);
    console.log(`  ---`);
    return;
  }

  try {
    // 動態 require，避免未安裝時整個 app crash
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'NomadNest <no-reply@nomadnest.tw>',
      ...opts,
    });
  } catch (err) {
    // 寄信失敗不影響主要業務流程
    console.error('[Email] 寄送失敗:', err);
  }
}

// ---------- 共用 HTML 外框 ----------

function layout(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:32px 40px;">
            <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">
              🏠 NomadNest Taiwan
            </div>
            <div style="color:#93c5fd;font-size:13px;margin-top:4px;">數位遊牧者的租屋平台</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
              此信件由系統自動寄出，請勿直接回覆。<br/>
              NomadNest Taiwan &bull; 讓遠端工作者找到最適合的家
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(text: string, href: string) {
  return `<a href="${href}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-top:20px;">${text}</a>`;
}

function infoBox(rows: { label: string; value: string }[]) {
  const cells = rows.map(r => `
    <tr>
      <td style="padding:8px 16px;color:#64748b;font-size:13px;width:35%;">${r.label}</td>
      <td style="padding:8px 16px;color:#1e293b;font-size:13px;font-weight:500;">${r.value}</td>
    </tr>`).join('');
  return `<table style="width:100%;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin:20px 0;">${cells}</table>`;
}

// ---------- 各情境通知 ----------

/** 租客送出申請後通知房東 */
export async function notifyLandlordNewApplication(params: {
  landlordEmail: string;
  landlordName: string;
  tenantName: string;
  listingTitle: string;
  moveInDate: string;
  duration: number;
  listingId: string;
}) {
  const body = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">您有新的租屋申請 📋</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">親愛的 ${params.landlordName}，有租客對您的房源提出申請。</p>
    ${infoBox([
      { label: '房源名稱', value: params.listingTitle },
      { label: '申請人', value: params.tenantName },
      { label: '預計入住', value: params.moveInDate },
      { label: '租期', value: `${params.duration} 個月` },
    ])}
    <p style="color:#64748b;font-size:13px;">請登入平台查看申請詳情並做出回應。</p>
    ${btn('查看申請', `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/applications`)}
  `;
  await sendMail({
    to: params.landlordEmail,
    subject: `【NomadNest】${params.tenantName} 申請了「${params.listingTitle}」`,
    html: layout('新租屋申請', body),
  });
}

/** 申請狀態更新後通知租客 */
export async function notifyTenantApplicationStatus(params: {
  tenantEmail: string;
  tenantName: string;
  listingTitle: string;
  status: string;
  landlordPhone?: string | null;
  landlordLine?: string | null;
  listingId: string;
}) {
  const statusMap: Record<string, { label: string; color: string; icon: string; msg: string }> = {
    approved: { label: '已核准', color: '#16a34a', icon: '✅', msg: '恭喜！您的申請已獲房東核准。請盡快與房東聯繫確認入住細節。' },
    rejected: { label: '未通過', color: '#dc2626', icon: '❌', msg: '很遺憾，您的申請未獲通過。您可以繼續瀏覽其他房源。' },
  };
  const s = statusMap[params.status];
  if (!s) return;

  const contactRows = [];
  if (params.status === 'approved') {
    if (params.landlordPhone) contactRows.push({ label: '房東電話', value: params.landlordPhone });
    if (params.landlordLine) contactRows.push({ label: '房東 LINE', value: params.landlordLine });
  }

  const body = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">${s.icon} 申請狀態更新</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">親愛的 ${params.tenantName}，您的申請狀態已更新。</p>
    ${infoBox([
      { label: '房源名稱', value: params.listingTitle },
      { label: '申請狀態', value: `<span style="color:${s.color};font-weight:700;">${s.label}</span>` },
      ...contactRows,
    ])}
    <p style="color:#475569;font-size:14px;">${s.msg}</p>
    ${btn('查看申請', `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/dashboard`)}
  `;
  await sendMail({
    to: params.tenantEmail,
    subject: `【NomadNest】您申請「${params.listingTitle}」的結果：${s.label}`,
    html: layout('申請結果通知', body),
  });
}

/** 租客送出申請後，寄確認信給租客本人 */
export async function notifyTenantApplicationSubmitted(params: {
  tenantEmail: string;
  tenantName: string;
  listingTitle: string;
  listingCity: string;
  moveInDate: string;
  duration: number;
  listingId: string;
}) {
  const body = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">📋 申請已送出！</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">
      親愛的 ${params.tenantName}，您的租屋申請已成功送出，請耐心等候房東回覆（通常 1～3 個工作天）。
    </p>
    ${infoBox([
      { label: '房源名稱', value: params.listingTitle },
      { label: '地點',     value: params.listingCity },
      { label: '預計入住', value: params.moveInDate },
      { label: '租期',     value: `${params.duration} 個月` },
      { label: '申請狀態', value: '<span style="color:#d97706;font-weight:700;">⏳ 待房東審核</span>' },
    ])}
    <p style="color:#475569;font-size:14px;">
      房東審核後，您將收到另一封通知信。您也可以隨時在控制台查看申請進度。
    </p>
    ${btn('查看我的申請', `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/dashboard`)}
  `;
  await sendMail({
    to: params.tenantEmail,
    subject: `【NomadNest】申請已送出：「${params.listingTitle}」`,
    html: layout('申請確認', body),
  });
}

/** 租客提交看房預約後通知房東 */
export async function notifyLandlordNewViewing(params: {
  landlordEmail: string;
  landlordName: string;
  tenantName: string;
  listingTitle: string;
  times: string[];
  notes?: string | null;
}) {
  const timeRows = params.times.map((t, i) => ({
    label: `候選時間 ${i + 1}`,
    value: new Date(t).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
  }));

  const body = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">新看房預約請求 📅</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">親愛的 ${params.landlordName}，有租客希望預約看房。</p>
    ${infoBox([
      { label: '房源', value: params.listingTitle },
      { label: '租客', value: params.tenantName },
      ...timeRows,
      ...(params.notes ? [{ label: '備註', value: params.notes }] : []),
    ])}
    <p style="color:#64748b;font-size:13px;">請登入平台選擇適合的時間並確認預約。</p>
    ${btn('確認看房時間', `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/dashboard`)}
  `;
  await sendMail({
    to: params.landlordEmail,
    subject: `【NomadNest】${params.tenantName} 想預約看「${params.listingTitle}」`,
    html: layout('新看房預約', body),
  });
}

/** 看房預約確認後通知租客 */
export async function notifyTenantViewingConfirmed(params: {
  tenantEmail: string;
  tenantName: string;
  listingTitle: string;
  confirmedTime: string;
  address: string;
  landlordPhone?: string | null;
}) {
  const timeStr = new Date(params.confirmedTime).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const body = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">✅ 看房預約已確認！</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">親愛的 ${params.tenantName}，您的看房預約已被房東確認。</p>
    ${infoBox([
      { label: '房源', value: params.listingTitle },
      { label: '看房時間', value: `<strong style="color:#16a34a;">${timeStr}</strong>` },
      { label: '地址', value: params.address },
      ...(params.landlordPhone ? [{ label: '房東電話', value: params.landlordPhone }] : []),
    ])}
    <p style="color:#64748b;font-size:13px;">如需取消或更改，請提前至少24小時通知房東。</p>
    ${btn('查看預約詳情', `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/dashboard`)}
  `;
  await sendMail({
    to: params.tenantEmail,
    subject: `【NomadNest】看房時間確認：${timeStr}`,
    html: layout('看房預約確認', body),
  });
}

/** 看房預約取消通知（通知對方） */
export async function notifyViewingCancelled(params: {
  recipientEmail: string;
  recipientName: string;
  cancellerRole: string;
  listingTitle: string;
}) {
  const cancellerLabel = params.cancellerRole === 'tenant' ? '租客' : '房東';
  const body = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">❌ 看房預約已取消</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">親愛的 ${params.recipientName}，以下看房預約已被${cancellerLabel}取消。</p>
    ${infoBox([
      { label: '房源', value: params.listingTitle },
      { label: '取消方', value: cancellerLabel },
    ])}
    ${btn('查看控制台', `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/dashboard`)}
  `;
  await sendMail({
    to: params.recipientEmail,
    subject: `【NomadNest】看房預約已取消：「${params.listingTitle}」`,
    html: layout('看房取消通知', body),
  });
}

/** 新訊息通知（對方超過30分鐘未讀） */
export async function notifyNewMessage(params: {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  listingTitle: string;
  preview: string;
  conversationId: string;
}) {
  const previewText = params.preview.length > 80
    ? params.preview.slice(0, 80) + '...'
    : params.preview;

  const body = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">💬 您有新訊息</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">親愛的 ${params.recipientName}，您有一則未讀訊息。</p>
    ${infoBox([
      { label: '發送者', value: params.senderName },
      { label: '關於', value: params.listingTitle },
      { label: '訊息預覽', value: `<em style="color:#475569;">${previewText}</em>` },
    ])}
    ${btn('查看訊息', `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/messages/${params.conversationId}`)}
  `;
  await sendMail({
    to: params.recipientEmail,
    subject: `【NomadNest】${params.senderName} 傳訊息給您：「${params.listingTitle}」`,
    html: layout('新訊息通知', body),
  });
}

/** 密碼重設連結 */
export async function sendPasswordResetEmail(params: {
  userEmail: string;
  userName: string;
  resetLink: string;
}) {
  const body = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">🔑 重設您的密碼</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">親愛的 ${params.userName}，我們收到了您的密碼重設請求。</p>
    ${infoBox([
      { label: '有效期限', value: '1 小時' },
      { label: '注意事項', value: '此連結僅可使用一次，請勿分享給他人' },
    ])}
    <p style="color:#475569;font-size:14px;">點擊下方按鈕重設密碼。若您未提出此請求，請忽略本信件，您的帳號不會有任何異動。</p>
    ${btn('重設密碼', params.resetLink)}
    <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
      若按鈕無法點擊，請複製以下連結到瀏覽器：<br/>
      <span style="color:#2563eb;word-break:break-all;">${params.resetLink}</span>
    </p>
  `;
  await sendMail({
    to: params.userEmail,
    subject: '【NomadNest】密碼重設請求',
    html: layout('密碼重設', body),
  });
}

/** 儲存搜尋 — 新符合房源通知 */
export async function notifySavedSearchMatch(params: {
  userEmail: string;
  userName: string;
  searchName: string;
  matchCount: number;
  listings: { id: string; title: string; city: string; price: number }[];
}) {
  const listingRows = params.listings.slice(0, 5).map(l => ({
    label: l.title,
    value: `${l.city} · NT$${l.price.toLocaleString()}/月`,
  }));

  const body = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">🔔 有新房源符合您的搜尋條件！</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">
      親愛的 ${params.userName}，您的儲存搜尋「${params.searchName}」有 <strong>${params.matchCount}</strong> 個新房源符合條件。
    </p>
    ${infoBox(listingRows)}
    ${params.matchCount > 5 ? `<p style="color:#94a3b8;font-size:12px;">還有 ${params.matchCount - 5} 個房源，請至平台查看。</p>` : ''}
    ${btn('立即查看', `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/listings`)}
  `;
  await sendMail({
    to: params.userEmail,
    subject: `【NomadNest】${params.searchName}：發現 ${params.matchCount} 個新房源`,
    html: layout('新房源通知', body),
  });
}

/** 新用戶 Email 驗證信 */
export async function sendEmailVerification(params: {
  userEmail: string;
  userName: string;
  verifyLink: string;
}) {
  const body = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">📬 請驗證你的 Email</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">
      嗨 ${params.userName}！感謝加入 NomadNest Taiwan。請點擊下方按鈕完成 Email 驗證，以啟用完整功能。
    </p>
    ${infoBox([
      { label: '有效期限', value: '7 天' },
      { label: '注意事項', value: '此連結僅限本人使用，請勿分享' },
    ])}
    <p style="color:#475569;font-size:14px;">驗證完成後，即可開始使用所有功能，並提升其他用戶對您的信任度。</p>
    ${btn('✅ 立即驗證 Email', params.verifyLink)}
    <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
      若按鈕無法點擊，請複製以下連結：<br/>
      <span style="color:#2563eb;word-break:break-all;">${params.verifyLink}</span>
    </p>
  `;
  await sendMail({
    to: params.userEmail,
    subject: '【NomadNest】請驗證你的 Email 地址',
    html: layout('Email 驗證', body),
  });
}

/** 身份驗證結果通知 */
export async function notifyVerificationResult(params: {
  userEmail: string;
  userName: string;
  status: 'approved' | 'rejected';
  note?: string | null;
}) {
  const isApproved = params.status === 'approved';
  const body = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">
      ${isApproved ? '✅ 身份驗證通過' : '❌ 身份驗證未通過'}
    </h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">親愛的 ${params.userName}，您的身份驗證申請結果如下。</p>
    ${infoBox([
      { label: '審核結果', value: isApproved
        ? '<span style="color:#16a34a;font-weight:700;">已驗證 ✓</span>'
        : '<span style="color:#dc2626;font-weight:700;">未通過</span>' },
      ...(params.note ? [{ label: '備註', value: params.note }] : []),
    ])}
    <p style="color:#64748b;font-size:13px;">
      ${isApproved
        ? '恭喜！您的帳號已獲得驗證徽章，信任度將大幅提升。'
        : '如有疑問，請重新上傳正確的身份文件。'}
    </p>
    ${btn('前往個人資料', `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/profile`)}
  `;
  await sendMail({
    to: params.userEmail,
    subject: `【NomadNest】身份驗證${isApproved ? '通過' : '未通過'}`,
    html: layout('身份驗證結果', body),
  });
}

/** 房東建立合約後通知租客 */
export async function notifyContractCreated(params: {
  tenantEmail: string;
  tenantName: string;
  listingTitle: string;
  contractId: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
  const body = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">📋 房東已送出租賃合約</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">
      嗨 ${params.tenantName}，房東已針對「${params.listingTitle}」建立電子租賃合約，請登入平台查閱並完成簽名。
    </p>
    ${infoBox([
      { label: '房源名稱', value: params.listingTitle },
      { label: '下一步',   value: '<span style="color:#d97706;font-weight:700;">請在合約頁面手寫簽名確認</span>' },
      { label: '有效提示', value: '雙方完成簽名後，合約即正式生效' },
    ])}
    <p style="color:#64748b;font-size:13px;">請仔細閱讀合約條款後再進行簽名。如有疑問，可在平台訊息系統與房東溝通。</p>
    ${btn('📋 查閱並簽署合約', `${baseUrl}/contracts/${params.contractId}`)}
  `;
  await sendMail({
    to: params.tenantEmail,
    subject: `【NomadNest】房東送出合約，請查閱並簽署：「${params.listingTitle}」`,
    html: layout('租賃合約待簽署', body),
  });
}

/** 合約雙方均完成簽名後通知雙方 */
export async function notifyContractCompleted(params: {
  landlordEmail: string;
  landlordName: string;
  tenantEmail: string;
  tenantName: string;
  listingTitle: string;
  contractId: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
  const makeBody = (recipientName: string) => `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">🎉 租賃合約已完成簽署！</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">
      親愛的 ${recipientName}，雙方已完成簽名，合約正式生效。
    </p>
    ${infoBox([
      { label: '房源名稱', value: params.listingTitle },
      { label: '合約狀態', value: '<span style="color:#16a34a;font-weight:700;">✅ 已完成</span>' },
      { label: '建議',     value: '請點擊下方按鈕，使用瀏覽器列印功能儲存為 PDF 副本保存備用' },
    ])}
    ${btn('🖨️ 查看合約 / 列印 PDF', `${baseUrl}/contracts/${params.contractId}`)}
  `;
  await Promise.all([
    sendMail({
      to: params.landlordEmail,
      subject: `【NomadNest】✅ 合約簽署完成：「${params.listingTitle}」`,
      html: layout('合約完成', makeBody(params.landlordName)),
    }),
    sendMail({
      to: params.tenantEmail,
      subject: `【NomadNest】✅ 合約簽署完成：「${params.listingTitle}」`,
      html: layout('合約完成', makeBody(params.tenantName)),
    }),
  ]);
}

/** 管理員封禁帳號通知 */
export async function notifyUserBanned(params: {
  userEmail: string;
  userName: string;
  reason?: string | null;
}) {
  const body = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">🚫 帳號已被暫停</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">親愛的 ${params.userName}，您的 NomadNest 帳號已被管理員暫停使用。</p>
    ${infoBox([
      { label: '帳號狀態', value: '<span style="color:#dc2626;font-weight:700;">已封禁</span>' },
      ...(params.reason ? [{ label: '原因', value: params.reason }] : []),
      { label: '申訴方式', value: '請透過 support@nomadnest.tw 聯繫客服' },
    ])}
    <p style="color:#64748b;font-size:13px;">
      在帳號暫停期間，您將無法登入或使用平台服務。如有疑問，請聯繫客服。
    </p>
  `;
  await sendMail({
    to: params.userEmail,
    subject: '【NomadNest】您的帳號已被暫停',
    html: layout('帳號暫停通知', body),
  });
}

/** 管理員解除封禁通知 */
export async function notifyUserUnbanned(params: {
  userEmail: string;
  userName: string;
}) {
  const body = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">✅ 帳號已恢復正常</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">親愛的 ${params.userName}，您的 NomadNest 帳號已由管理員解除封禁，可以正常使用。</p>
    ${infoBox([
      { label: '帳號狀態', value: '<span style="color:#16a34a;font-weight:700;">✓ 正常使用</span>' },
    ])}
    <p style="color:#64748b;font-size:13px;">感謝您的耐心等候，歡迎繼續使用 NomadNest Taiwan。</p>
    ${btn('前往登入', `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/auth/login`)}
  `;
  await sendMail({
    to: params.userEmail,
    subject: '【NomadNest】您的帳號已恢復正常',
    html: layout('帳號解禁通知', body),
  });
}

/** 租約到期提醒（寄給租客） */
export async function sendLeaseExpiryReminder(params: {
  tenantEmail: string;
  tenantName: string;
  listingTitle: string;
  listingCity: string;
  listingDistrict: string;
  moveInDate: string;
  expiryDate: string;
  daysLeft: number;
  listingId: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
  const urgencyColor = params.daysLeft <= 7 ? '#dc2626' : params.daysLeft <= 14 ? '#d97706' : '#2563eb';
  const urgencyIcon = params.daysLeft <= 7 ? '🔴' : params.daysLeft <= 14 ? '🟠' : '⚠️';

  const body = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">${urgencyIcon} 租約即將到期提醒</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">
      嗨 ${params.tenantName}，你目前居住的房源租約將在
      <strong style="color:${urgencyColor};">${params.daysLeft} 天後（${params.expiryDate}）</strong>到期，
      請提早安排續租或搬遷事宜。
    </p>

    ${infoBox([
      { label: '房源名稱', value: params.listingTitle },
      { label: '地點', value: `${params.listingCity} ${params.listingDistrict}` },
      { label: '入住日期', value: params.moveInDate },
      { label: '租約到期日', value: `<span style="color:${urgencyColor};font-weight:700;">${params.expiryDate}</span>` },
      { label: '剩餘天數', value: `<span style="color:${urgencyColor};font-weight:700;">${params.daysLeft} 天</span>` },
    ])}

    <p style="color:#64748b;font-size:14px;margin:16px 0;">
      如需續租，建議盡早與房東聯繫；若計劃搬遷，可前往房源列表尋找下一個理想住所。
    </p>

    <div style="display:flex;gap:12px;">
      ${btn('瀏覽更多房源', `${baseUrl}/listings`)}
    </div>
    <div style="margin-top:12px;text-align:center;">
      <a href="${baseUrl}/listings/${params.listingId}" style="color:#2563eb;font-size:13px;text-decoration:none;">
        查看目前房源詳情 →
      </a>
    </div>
  `;

  const subjectPrefix = params.daysLeft <= 7 ? '【緊急】' : '';
  await sendMail({
    to: params.tenantEmail,
    subject: `【NomadNest】${subjectPrefix}租約將於 ${params.daysLeft} 天後到期 — ${params.listingTitle}`,
    html: layout('租約到期提醒', body),
  });
}

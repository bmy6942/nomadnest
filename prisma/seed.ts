import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 開始植入種子資料...');

  // 清除舊資料
  await prisma.review.deleteMany();
  await prisma.application.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();

  // 建立測試帳號
  const adminPwd = await bcrypt.hash('admin123', 10);
  const pwd = await bcrypt.hash('test123', 10);

  const admin = await prisma.user.create({
    data: { name: '系統管理員', email: 'admin@nomadnest.tw', password: adminPwd, role: 'admin', verified: true, phone: '0900000000' },
  });
  const landlord1 = await prisma.user.create({
    data: { name: '陳大明', email: 'landlord1@test.com', password: pwd, role: 'landlord', verified: true, phone: '0912345678', bio: '在台北大安區有3間套房出租，歡迎游牧族！' },
  });
  const landlord2 = await prisma.user.create({
    data: { name: '林小芳', email: 'landlord2@test.com', password: pwd, role: 'landlord', verified: true, phone: '0987654321', bio: '台中西區整層公寓，安靜舒適，適合遠端工作。' },
  });
  const landlord3 = await prisma.user.create({
    data: { name: '王建國', email: 'landlord3@test.com', password: pwd, role: 'landlord', verified: false, phone: '0933111222', bio: '高雄苓雅區套房，外籍朋友歡迎！' },
  });
  const tenant1 = await prisma.user.create({
    data: { name: 'Sarah Chen', email: 'sarah@test.com', password: pwd, role: 'tenant', verified: true, phone: '0955888777', bio: '台灣人，UI設計師，目前台北游牧中 🎨' },
  });
  const tenant2 = await prisma.user.create({
    data: { name: 'Thomas Müller', email: 'thomas@test.com', password: pwd, role: 'tenant', verified: true, phone: '0977333444', bio: 'German software engineer, Taiwan Gold Card holder. Looking for 2-3 month stays.' },
  });

  // 房源資料（12則）
  const listings = [
    {
      title: '大安區高速光纖套房 — 附獨立工作桌',
      description: '位於台北大安區精華地段，步行5分鐘可達大安森林公園捷運站。房間寬敞明亮，附一張120x60cm工作桌及人體工學椅。光纖網路實測下載速度500Mbps，穩定不卡頓，遠端會議零壓力。樓下有全家便利商店及知名咖啡廳。同棟有其他游牧者入住，可互相切磋交流。',
      city: '台北市', district: '大安區', address: '大安路一段近捷運大安森林公園站',
      type: '套房', price: 22000, deposit: 2, minRent: 1, maxRent: 6,
      wifiSpeed: 500, wifiVerified: true, hasDesk: true, deskSize: '120x60cm',
      naturalLight: 5, nearCowork: 8, nearMRT: 5,
      includedFees: JSON.stringify(['網路費', '管理費']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱', '微波爐', '熱水器', '第四台']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800']),
      status: 'active', foreignOk: true, ownerId: landlord1.id,
    },
    {
      title: '信義區輕工業風整層 — 雙人可住，無限高速網路',
      description: '台北信義區精品整層公寓，兩房一廳，適合一人辦公或兩位游牧者同住分攤費用。客廳有一整面牆的白板可規劃、繪圖，靈感不斷。網路為企業級光纖，實測900Mbps，附備用4G熱點。距離象山捷運站步行7分鐘，周邊餐廳、超市齊全，生活極為便利。',
      city: '台北市', district: '信義區', address: '基隆路一段近捷運象山站',
      type: '整層公寓', price: 35000, deposit: 2, minRent: 1, maxRent: 6,
      wifiSpeed: 900, wifiVerified: true, hasDesk: true, deskSize: '180x70cm',
      naturalLight: 4, nearCowork: 5, nearMRT: 7,
      includedFees: JSON.stringify(['網路費', '管理費', '第四台']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱', '洗碗機', '烘衣機', '白板牆', '備用4G']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800']),
      status: 'active', foreignOk: true, ownerId: landlord1.id,
    },
    {
      title: '中山區日式和風雅房 — 近松山機場，適合商務游牧',
      description: '中山區精緻日式裝潢雅房，空間雖不大但設計感十足，採光佳。網路為光纖200Mbps，穩定可靠。距離松山機場10分鐘車程，對需要頻繁出差的商務游牧者極為方便。同住為日台混居環境，可練習語言交流。',
      city: '台北市', district: '中山區', address: '民生東路二段近捷運中山國中站',
      type: '雅房', price: 14000, deposit: 1, minRent: 1, maxRent: 3,
      wifiSpeed: 200, wifiVerified: true, hasDesk: true, deskSize: '90x55cm',
      naturalLight: 4, nearCowork: 12, nearMRT: 6,
      includedFees: JSON.stringify(['水費', '網路費']),
      amenities: JSON.stringify(['冷氣', '洗衣機共用', '冰箱', '廚房共用']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800']),
      status: 'active', foreignOk: true, ownerId: landlord1.id,
    },
    {
      title: '西區文青共居空間 — 5間房可選，有共用工作室',
      description: '台中西區最受歡迎的游牧者共居空間！整棟5層樓，1F為共用工作室（附印表機、白板、投影機），2～5F為獨立房間。所有房間均配備光纖網路及人體工學工作桌。定期舉辦游牧者交流活動，入住即融入社群。距離審計新村步行5分鐘。',
      city: '台中市', district: '西區', address: '向上北路近審計新村',
      type: '共居空間', price: 12000, deposit: 1, minRent: 1, maxRent: 6,
      wifiSpeed: 300, wifiVerified: true, hasDesk: true, deskSize: '100x60cm',
      naturalLight: 4, nearCowork: 0, nearMRT: 0,
      includedFees: JSON.stringify(['水費', '電費', '網路費', '管理費']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱', '共用工作室', '投影機', '白板', '自行車']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800', 'https://images.unsplash.com/photo-1527192491265-7e15c55b1ed2?w=800']),
      status: 'active', foreignOk: true, ownerId: landlord2.id,
    },
    {
      title: '北區超值套房 — 含費，近逢甲夜市，高 CP 值',
      description: '台中北區整理得相當乾淨的套房，水電網路全含，CP值極高。雖然網速不算最快，但日常遠端工作、視訊會議完全夠用。距逢甲夜市步行10分鐘，生活機能好，附近餐廳選擇多，下班生活豐富。適合預算有限的游牧新手。',
      city: '台中市', district: '北區', address: '文心路四段近逢甲商圈',
      type: '套房', price: 8500, deposit: 1, minRent: 1, maxRent: 6,
      wifiSpeed: 100, wifiVerified: true, hasDesk: true, deskSize: '80x50cm',
      naturalLight: 3, nearCowork: 20, nearMRT: 0,
      includedFees: JSON.stringify(['水費', '電費', '網路費']),
      amenities: JSON.stringify(['冷氣', '洗衣機共用', '冰箱', '熱水器']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800']),
      status: 'active', foreignOk: false, ownerId: landlord2.id,
    },
    {
      title: '苓雅區外籍友善套房 — 英文溝通，近輕軌',
      description: 'Hi foreign nomads! This is a clean and bright studio in Lingya District, Kaohsiung. Perfect for remote workers. 500Mbps fiber internet, dedicated work desk, fully furnished. Walking distance to Kaisyuan Wenhua Station (Light Rail). Landlord speaks English. All bills included. Minimum 1 month. Very welcome for foreigners!',
      city: '高雄市', district: '苓雅區', address: '光華一路近輕軌凱旋文化站',
      type: '套房', price: 13000, deposit: 1, minRent: 1, maxRent: 6,
      wifiSpeed: 500, wifiVerified: true, hasDesk: true, deskSize: '110x60cm',
      naturalLight: 5, nearCowork: 10, nearMRT: 5,
      includedFees: JSON.stringify(['水費', '電費', '網路費', '管理費']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱', '微波爐', '電磁爐']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=800']),
      status: 'active', foreignOk: true, ownerId: landlord3.id,
    },
    {
      title: '前鎮區大坪數套房 — 近高捷，適合長租',
      description: '高雄前鎮區寬敞套房，坪數大、格局方正。適合想要在高雄長期定居的游牧者。附近有家樂福、好市多，採買生活用品極方便。高捷三多商圈站步行8分鐘。網路為中華電信光纖，穩定不斷線。2個月以上優惠月租NT$11,500。',
      city: '高雄市', district: '前鎮區', address: '三多四路近捷運三多商圈站',
      type: '套房', price: 12000, deposit: 2, minRent: 1, maxRent: 12,
      wifiSpeed: 150, wifiVerified: false, hasDesk: true, deskSize: '100x55cm',
      naturalLight: 3, nearCowork: 15, nearMRT: 8,
      includedFees: JSON.stringify(['網路費']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱', '熱水器']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800']),
      status: 'active', foreignOk: false, ownerId: landlord3.id,
    },
    {
      title: '花蓮市景觀套房 — 山海第一排，放鬆工作兩相宜',
      description: '花蓮市難得一見的景觀套房！打開窗戶即見中央山脈，環境安靜舒適，適合需要放空又要維持工作效率的游牧者。光纖網路實測300Mbps，工作毫無壓力。距離花蓮火車站10分鐘車程，騎自行車便可抵達海岸線。附免費腳踏車借用。不定期有游牧者小聚活動。',
      city: '花蓮縣', district: '花蓮市', address: '中山路近花蓮火車站',
      type: '套房', price: 9000, deposit: 1, minRent: 1, maxRent: 6,
      wifiSpeed: 300, wifiVerified: true, hasDesk: true, deskSize: '100x60cm',
      naturalLight: 5, nearCowork: 15, nearMRT: 0,
      includedFees: JSON.stringify(['水費', '網路費']),
      amenities: JSON.stringify(['冷氣', '洗衣機共用', '冰箱', '景觀陽台', '免費腳踏車']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800']),
      status: 'active', foreignOk: true, ownerId: landlord2.id,
    },
    {
      title: '板橋區超高速纖維套房 — 近台北車站，通勤方便',
      description: '新北板橋區CP值極高的選擇！距離板橋車站步行5分鐘，台鐵、捷運、高鐵三鐵共構，往來台北、桃園機場極為方便，非常適合需要定期移動的游牧者。網路為企業級光纖實測600Mbps，穩定性高。',
      city: '新北市', district: '板橋區', address: '縣民大道近板橋車站',
      type: '套房', price: 16000, deposit: 2, minRent: 1, maxRent: 6,
      wifiSpeed: 600, wifiVerified: true, hasDesk: true, deskSize: '120x60cm',
      naturalLight: 3, nearCowork: 8, nearMRT: 5,
      includedFees: JSON.stringify(['網路費', '管理費']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱', '微波爐', '電梯']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800']),
      status: 'active', foreignOk: true, ownerId: landlord1.id,
    },
    {
      title: '永和區安靜住宅套房 — 適合需要安靜環境的創作者',
      description: '新北永和區住宅區的安靜套房，樓上樓下均為長住家庭，環境極為安靜，非常適合需要專注創作的工作者（作家、設計師、音樂創作）。光纖100Mbps，滿足一般遠端工作需求。附近公園多，適合散步放鬆。',
      city: '新北市', district: '永和區', address: '中正路近捷運頂溪站',
      type: '雅房', price: 10000, deposit: 1, minRent: 2, maxRent: 6,
      wifiSpeed: 100, wifiVerified: false, hasDesk: true, deskSize: '80x50cm',
      naturalLight: 3, nearCowork: 18, nearMRT: 7,
      includedFees: JSON.stringify(['水費', '網路費']),
      amenities: JSON.stringify(['冷氣', '洗衣機共用', '冰箱共用', '廚房共用']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800']),
      status: 'active', foreignOk: false, ownerId: landlord2.id,
    },
    {
      title: '東區整層 — 新裝潢待審核中',
      description: '台北東區全新裝潢整層公寓，剛完成翻新，設備全新。此刊登目前待審核。',
      city: '台北市', district: '大安區', address: '仁愛路四段',
      type: '整層公寓', price: 28000, deposit: 2, minRent: 1, maxRent: 6,
      wifiSpeed: 400, wifiVerified: false, hasDesk: true, deskSize: '120x60cm',
      naturalLight: 4, nearCowork: 10, nearMRT: 5,
      includedFees: JSON.stringify(['管理費']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱', '烘碗機']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800']),
      status: 'pending', foreignOk: true, ownerId: landlord1.id,
    },
    {
      title: '左營區捷運站旁套房（內部測試用）',
      description: '測試資料，此刊登為管理員審核用範例。',
      city: '高雄市', district: '左營區', address: '高鐵路近捷運左營站',
      type: '套房', price: 11000, deposit: 1, minRent: 1, maxRent: 3,
      wifiSpeed: 200, wifiVerified: true, hasDesk: true, deskSize: '90x55cm',
      naturalLight: 3, nearCowork: 12, nearMRT: 3,
      includedFees: JSON.stringify(['網路費']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800']),
      status: 'pending', foreignOk: false, ownerId: landlord3.id,
    },
  ];

  for (const l of listings) {
    await prisma.listing.create({ data: l });
  }

  // 建立幾筆申請紀錄
  const activeListings = await prisma.listing.findMany({ where: { status: 'active' }, take: 3 });
  if (activeListings.length >= 2) {
    await prisma.application.create({
      data: {
        listingId: activeListings[0].id, tenantId: tenant1.id,
        message: '你好！我是UI設計師，在家遠端工作，作息正常、整潔愛乾淨。預計2026年5月1日入住，租3個月，請問方便安排看房嗎？',
        moveInDate: '2026-05-01', duration: 3, status: 'pending',
      },
    });
    await prisma.application.create({
      data: {
        listingId: activeListings[1].id, tenantId: tenant2.id,
        message: "Hi! I'm Thomas, a German software engineer with Taiwan Gold Card. Looking for 2 months stay starting May 15. I'm very clean and quiet. Can we arrange a viewing?",
        moveInDate: '2026-05-15', duration: 2, status: 'approved',
      },
    });
    await prisma.application.create({
      data: {
        listingId: activeListings[0].id, tenantId: tenant2.id,
        message: "Also interested in this listing as a backup option. Please let me know if available.",
        moveInDate: '2026-06-01', duration: 1, status: 'pending',
      },
    });
  }

  // 建立評價
  if (activeListings.length >= 1) {
    await prisma.review.create({
      data: {
        listingId: activeListings[0].id, reviewerId: tenant1.id,
        rating: 5, wifiRating: 5,
        content: '非常推薦！Wi-Fi速度真的如廣告所示，遠端工作零壓力。房東很好溝通，有任何問題都秒回。環境乾淨整潔，會再租！',
      },
    });
  }

  console.log('✅ 種子資料植入完成！');
  console.log('\n📋 測試帳號：');
  console.log('  🔑 管理員  admin@nomadnest.tw  / admin123');
  console.log('  🏠 房東1   landlord1@test.com / test123');
  console.log('  🏠 房東2   landlord2@test.com / test123');
  console.log('  🏠 房東3   landlord3@test.com / test123 （未驗證）');
  console.log('  👤 租客1   sarah@test.com     / test123');
  console.log('  👤 租客2   thomas@test.com    / test123');
  console.log('\n🏡 已建立 12 則房源（10則上架、2則待審核）');
}

main().catch(console.error).finally(() => prisma.$disconnect());

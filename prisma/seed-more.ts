/**
 * prisma/seed-more.ts
 * 新增更多示範房源（不刪除現有資料）
 * 執行：npx ts-node prisma/seed-more.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 新增更多示範房源...');

  // 取得現有房東 ID（依建立時間排序）
  const landlords = await prisma.user.findMany({
    where: { role: { in: ['landlord', 'admin'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });

  if (landlords.length < 2) {
    console.error('❌ 找不到足夠的房東帳號，請先執行 prisma/seed.ts');
    return;
  }

  const l1 = landlords[0].id;
  const l2 = landlords[1].id;
  const l3 = landlords[2]?.id ?? l1;

  const newListings = [
    // ── 台北北部 ──────────────────────────────────────────────
    {
      title: '松山區新裝潢整層公寓 — 500M光纖，近南京三民站',
      description: '位於台北松山區的全新裝潢整層公寓，客廳寬敞採光佳，配備L型大書桌及雙螢幕支架。光纖網路實測500Mbps，上傳下載對稱。距南京三民捷運站步行4分鐘，附近餐廳林立，生活機能完善。適合1-2人游牧工作或短租。',
      city: '台北市', district: '松山區', address: '南京東路五段近捷運南京三民站',
      type: '整層公寓', price: 32000, deposit: 2, minRent: 1, maxRent: 6,
      wifiSpeed: 500, wifiVerified: true, hasDesk: true, deskSize: '160x70cm',
      naturalLight: 5, nearCowork: 6, nearMRT: 4,
      includedFees: JSON.stringify(['網路費', '管理費']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '烘衣機', '冰箱', '洗碗機', '雙螢幕支架', '電梯']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?w=800',
        'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=800',
      ]),
      status: 'active', foreignOk: true, lat: 25.0510, lng: 121.5660, ownerId: l1,
    },
    {
      title: '文山區安靜套房 — 近木柵動物園，山景第一排',
      description: '台北文山區寧靜住宅區套房，窗外即可欣賞翠綠山景。遠離市中心喧囂，適合需要高度專注的創作者、設計師或作家。光纖300Mbps，網速穩定。木柵動物園站步行10分鐘，或騎腳踏車沿景美溪騎行。含停車位（機車）。',
      city: '台北市', district: '文山區', address: '木柵路三段近捷運木柵站',
      type: '套房', price: 16000, deposit: 2, minRent: 1, maxRent: 12,
      wifiSpeed: 300, wifiVerified: true, hasDesk: true, deskSize: '100x60cm',
      naturalLight: 5, nearCowork: 20, nearMRT: 10,
      includedFees: JSON.stringify(['水費', '網路費', '機車停車']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱', '熱水器', '景觀陽台', '機車停車']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800',
      ]),
      status: 'active', foreignOk: false, lat: 24.9990, lng: 121.5700, ownerId: l2,
    },
    {
      title: 'NomadNest 精品套房 | 300M光纖 | 捷運3分鐘',
      description: '大安區精品套房，採用北歐極簡風格裝潢，附大型L型工作桌及人體工學椅。實測Wi-Fi下載300Mbps / 上傳250Mbps，視訊會議零延遲。距捷運大安站步行3分鐘，同棟有7-11及健身房。已有多位數位游牧者長住，可加入本棟游牧群組互相交流。',
      city: '台北市', district: '大安區', address: '台北市大安區仁愛路四段100號',
      type: '套房', price: 28000, deposit: 2, minRent: 1, maxRent: 6,
      wifiSpeed: 300, wifiVerified: true, hasDesk: true, deskSize: '140x65cm',
      naturalLight: 4, nearCowork: 5, nearMRT: 3,
      includedFees: JSON.stringify(['水費', '網路費', '第四台']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱', '人體工學椅', '健身房', '7-11']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800',
        'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=800',
      ]),
      status: 'active', foreignOk: true, lat: 25.0330, lng: 121.5325, ownerId: l1,
    },
    // ── 新北 / 桃園 ───────────────────────────────────────────
    {
      title: '新店區整層2房 — 碧潭美景，近新店市政府捷運',
      description: '新北新店區整層兩房公寓，主臥附工作區，另一房可做獨立辦公室。超大陽台可望碧潭湖景，傍晚風景絕美。光纖600Mbps，超適合視訊工作。新店市政府捷運站步行6分鐘，單車道連結碧潭，假日可放鬆騎車。',
      city: '新北市', district: '新店區', address: '北新路三段近捷運新店市政府站',
      type: '整層公寓', price: 26000, deposit: 2, minRent: 2, maxRent: 12,
      wifiSpeed: 600, wifiVerified: true, hasDesk: true, deskSize: '120x60cm',
      naturalLight: 5, nearCowork: 15, nearMRT: 6,
      includedFees: JSON.stringify(['網路費', '管理費']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱', '景觀陽台', '電梯', '停車位']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800',
        'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800',
      ]),
      status: 'active', foreignOk: true, lat: 24.9690, lng: 121.5400, ownerId: l2,
    },
    {
      title: '桃園中壢區高CP值套房 — 近台鐵中壢站，適合頻繁出差者',
      description: '桃園中壢區優質套房，距台鐵中壢站步行8分鐘，距桃園機場捷運A21站步行12分鐘，往返機場極便利！光纖200Mbps穩定可靠，工作桌大且採光好。附近超市、餐廳齊全，生活便利。適合需要頻繁進出桃園機場的游牧者。',
      city: '桃園市', district: '中壢區', address: '中正路近台鐵中壢站',
      type: '套房', price: 11000, deposit: 1, minRent: 1, maxRent: 6,
      wifiSpeed: 200, wifiVerified: true, hasDesk: true, deskSize: '100x55cm',
      naturalLight: 3, nearCowork: 10, nearMRT: 12,
      includedFees: JSON.stringify(['網路費', '管理費']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱', '熱水器', '電梯']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?w=800',
      ]),
      status: 'active', foreignOk: true, lat: 24.9540, lng: 121.2260, ownerId: l3,
    },
    {
      title: '新竹東區套房 — 科技人最愛，近竹科，超高速千兆網路',
      description: '新竹東區黃金地段套房，步行15分鐘達新竹科學園區，是在竹科上班的工程師與PM最愛！光纖實測1000Mbps（千兆），大型工作桌附顯示器支架。樓下有超商及健身房。適合長期租住，3個月以上可議價。',
      city: '新竹市', district: '東區', address: '光復路二段近新竹科學園區',
      type: '套房', price: 18000, deposit: 2, minRent: 1, maxRent: 12,
      wifiSpeed: 1000, wifiVerified: true, hasDesk: true, deskSize: '150x70cm',
      naturalLight: 4, nearCowork: 5, nearMRT: 0,
      includedFees: JSON.stringify(['網路費', '管理費']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱', '顯示器支架', '健身房', '電梯']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800',
      ]),
      status: 'active', foreignOk: true, lat: 24.7950, lng: 120.9930, ownerId: l1,
    },
    // ── 台中 ─────────────────────────────────────────────────
    {
      title: '台中南屯區精品套房 — 近勤美誠品，文青游牧首選',
      description: '台中南屯區精緻套房，步行10分鐘達勤美誠品及草悟道，週末生活豐富。採用日系極簡裝潢，空間感十足。光纖500Mbps，工作桌寬敞。定期有游牧者聚會在附近咖啡廳，入住即加入社群。',
      city: '台中市', district: '南屯區', address: '公益路二段近勤美誠品',
      type: '套房', price: 14000, deposit: 1, minRent: 1, maxRent: 6,
      wifiSpeed: 500, wifiVerified: true, hasDesk: true, deskSize: '120x60cm',
      naturalLight: 4, nearCowork: 8, nearMRT: 0,
      includedFees: JSON.stringify(['水費', '網路費', '管理費']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱', '微波爐', '電磁爐', '電梯']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800',
        'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800',
      ]),
      status: 'active', foreignOk: true, lat: 24.1480, lng: 120.6610, ownerId: l2,
    },
    {
      title: '台中東區Coliving — 彈性月租，含早餐+清潔',
      description: '台中東區首家游牧者專屬共居空間！提供7間獨立套房，共用寬敞廚房、客廳及戶外露台。含每日早餐（麵包+咖啡）、每週清潔服務、高速光纖400Mbps。每月舉辦2次游牧者交流晚餐。可彈性短租，最短1個月，非常適合剛來台中探索的游牧新手。',
      city: '台中市', district: '東區', address: '樂業路近台中火車站',
      type: '共居空間', price: 16500, deposit: 1, minRent: 1, maxRent: 3,
      wifiSpeed: 400, wifiVerified: true, hasDesk: true, deskSize: '100x55cm',
      naturalLight: 4, nearCowork: 5, nearMRT: 0,
      includedFees: JSON.stringify(['水費', '電費', '網路費', '早餐', '清潔服務']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱', '共用廚房', '露台', '早餐', '社群活動']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800',
        'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800',
      ]),
      status: 'active', foreignOk: true, lat: 24.1440, lng: 120.6900, ownerId: l3,
    },
    // ── 台南 ─────────────────────────────────────────────────
    {
      title: '台南中西區老宅改建整層 — 台式文青風，近赤崁樓',
      description: '台南中西區百年老宅改建整層公寓，保留原有紅磚外牆及木頭樑柱，搭配現代化設備，濃濃台式文青風格。光纖300Mbps，工作桌可俯瞰古老街道。步行5分鐘達赤崁樓，10分鐘達正興街，假日探索老台南美食文化。最適合尋找靈感的創意工作者！',
      city: '台南市', district: '中西區', address: '民族路二段近赤崁樓',
      type: '整層公寓', price: 18000, deposit: 1, minRent: 1, maxRent: 6,
      wifiSpeed: 300, wifiVerified: true, hasDesk: true, deskSize: '110x60cm',
      naturalLight: 4, nearCowork: 12, nearMRT: 0,
      includedFees: JSON.stringify(['水費', '網路費']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱', '廚房', '復古裝潢', '自行車']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
        'https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800',
      ]),
      status: 'active', foreignOk: true, lat: 22.9980, lng: 120.2000, ownerId: l2,
    },
    {
      title: '台南東區新成屋套房 — 含費，近成功大學商圈',
      description: '台南東區全新大樓套房，2023年落成，設備全新。水電網路全含，月租只要12000元，台南性價比最高選擇之一！步行5分鐘達成大商圈，咖啡廳、餐廳、超市一應俱全。光纖200Mbps，遠端工作沒問題。',
      city: '台南市', district: '東區', address: '長榮路一段近成功大學',
      type: '套房', price: 12000, deposit: 1, minRent: 1, maxRent: 6,
      wifiSpeed: 200, wifiVerified: true, hasDesk: true, deskSize: '90x55cm',
      naturalLight: 3, nearCowork: 8, nearMRT: 0,
      includedFees: JSON.stringify(['水費', '電費', '網路費']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱', '熱水器', '電梯']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800',
      ]),
      status: 'active', foreignOk: false, lat: 22.9960, lng: 120.2200, ownerId: l3,
    },
    // ── 高雄 ─────────────────────────────────────────────────
    {
      title: '高雄鹽埕區文創整層 — 近駁二，港都游牧最潮選擇',
      description: '高雄鹽埕區老公寓全新整層改造，工業風+現代混搭，充滿創意靈感。步行5分鐘達駁二藝術特區，港邊散步10分鐘，假日生活質感極高。光纖500Mbps，大型工作桌。同棟有設計師、插畫家、攝影師入住，自成創意社群。',
      city: '高雄市', district: '鹽埕區', address: '大勇路近駁二藝術特區',
      type: '整層公寓', price: 20000, deposit: 1, minRent: 1, maxRent: 6,
      wifiSpeed: 500, wifiVerified: true, hasDesk: true, deskSize: '140x70cm',
      naturalLight: 5, nearCowork: 8, nearMRT: 7,
      includedFees: JSON.stringify(['網路費', '管理費']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱', '工業風裝潢', '港景', '自行車']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
      ]),
      status: 'active', foreignOk: true, lat: 22.6270, lng: 120.2820, ownerId: l1,
    },
    {
      title: '高雄左營區捷運站正上方套房 — 高鐵共構，南北移動超方便',
      description: '高雄左營區捷運左營站出口步行1分鐘！高鐵左營站步行5分鐘，往返台北只要90分鐘。光纖400Mbps，工作桌寬敞。非常適合「台北高雄雙城游牧」的工作型態。含管理費、網路費，費用透明。',
      city: '高雄市', district: '左營區', address: '高鐵路近高鐵左營站',
      type: '套房', price: 15000, deposit: 1, minRent: 1, maxRent: 12,
      wifiSpeed: 400, wifiVerified: true, hasDesk: true, deskSize: '110x60cm',
      naturalLight: 3, nearCowork: 10, nearMRT: 1,
      includedFees: JSON.stringify(['網路費', '管理費']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱', '電梯', '保全系統']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1560184897-ae75f418493e?w=800',
      ]),
      status: 'active', foreignOk: true, lat: 22.6850, lng: 120.3060, ownerId: l3,
    },
    // ── 東部 / 離島 ───────────────────────────────────────────
    {
      title: '台東市海景套房 — 太平洋第一排，慢活游牧天堂',
      description: '台東市難得一見的太平洋海景套房！每天早晨在陽台喝咖啡、看日出。光纖200Mbps，工作不成問題。台東火車站步行12分鐘，可租借機車自由探索海岸山脈和小野柳。適合需要定期充電、找尋靈感的游牧者。這裡的生活步調，讓你工作效率反而更好。',
      city: '台東縣', district: '台東市', address: '中興路四段近台東森林公園',
      type: '套房', price: 10000, deposit: 1, minRent: 1, maxRent: 6,
      wifiSpeed: 200, wifiVerified: true, hasDesk: true, deskSize: '90x55cm',
      naturalLight: 5, nearCowork: 20, nearMRT: 0,
      includedFees: JSON.stringify(['水費', '網路費']),
      amenities: JSON.stringify(['冷氣', '洗衣機共用', '冰箱', '海景陽台', '機車出租', '衝浪板']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
      ]),
      status: 'active', foreignOk: true, lat: 22.7580, lng: 121.1440, ownerId: l2,
    },
    {
      title: '宜蘭羅東套房 — 溫泉鄉游牧基地，近夜市，1小時達台北',
      description: '宜蘭羅東溫泉鄉精緻套房！光纖300Mbps工作無虞，下班走路5分鐘達羅東夜市大啖美食，週末泡溫泉放鬆充電。台北開車或搭火車僅1小時，適合台北上班族周末延伸或短住。附免費腳踏車，探索蘭陽平原超自在。',
      city: '宜蘭縣', district: '羅東鎮', address: '中山路三段近羅東夜市',
      type: '套房', price: 9500, deposit: 1, minRent: 1, maxRent: 3,
      wifiSpeed: 300, wifiVerified: true, hasDesk: true, deskSize: '100x55cm',
      naturalLight: 4, nearCowork: 15, nearMRT: 0,
      includedFees: JSON.stringify(['水費', '電費', '網路費']),
      amenities: JSON.stringify(['冷氣', '洗衣機', '冰箱', '免費腳踏車', '溫泉區步行']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      ]),
      status: 'active', foreignOk: true, lat: 24.6770, lng: 121.7700, ownerId: l2,
    },
    {
      title: '嘉義市日式木屋套房 — 近阿里山起點，悠活工作兩相宜',
      description: '嘉義市改建日式木造房舍，充滿歷史感與溫度。光纖250Mbps，工作環境安靜舒適。距嘉義火車站10分鐘，是前往阿里山的最佳中繼站。附近有文化路夜市和多家特色早餐店，生活滋味豐富。',
      city: '嘉義市', district: '東區', address: '林森東路近嘉義公園',
      type: '套房', price: 8000, deposit: 1, minRent: 1, maxRent: 6,
      wifiSpeed: 250, wifiVerified: false, hasDesk: true, deskSize: '90x50cm',
      naturalLight: 4, nearCowork: 18, nearMRT: 0,
      includedFees: JSON.stringify(['水費', '網路費']),
      amenities: JSON.stringify(['冷氣', '洗衣機共用', '冰箱', '日式庭院', '腳踏車']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800',
      ]),
      status: 'active', foreignOk: true, lat: 23.4800, lng: 120.4490, ownerId: l3,
    },
  ];

  let count = 0;
  for (const listing of newListings) {
    await prisma.listing.create({ data: listing as any });
    count++;
    process.stdout.write(`\r  ✅ 已新增 ${count}/${newListings.length} 則房源`);
  }

  console.log(`\n\n🎉 完成！共新增 ${count} 則房源`);
  console.log('北部：台北松山、文山、大安、新北新店、桃園中壢、新竹東區');
  console.log('中部：台中南屯、台中東區Coliving');
  console.log('南部：台南中西、台南東區、高雄鹽埕、高雄左營');
  console.log('東部：台東、宜蘭羅東、嘉義');
}

main().catch(console.error).finally(() => prisma.$disconnect());

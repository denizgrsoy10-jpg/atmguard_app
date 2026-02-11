'use client';

import { useState } from 'react';

export default function BudgetPerformancePage() {
  // Excel Export Function
  const handleExportExcel = () => {
    const csvContent = '\uFEFFBütçe Performansı 2026\n' +
      'Rapor Tarihi: ' + new Date().toLocaleDateString('tr-TR') + '\n\n' +
      'Ay,FLM Bütçe,FLM Gerçek,SLM Bütçe,SLM Gerçek,İkmal Bütçe,İkmal Gerçek,Toplama Bütçe,Toplama Gerçek,Bütçe TRY,Gerçek TRY,Tasarruf,Tasarruf %,Not\n' +
      'Ocak,2500,2425,300,291,8000,7760,2000,1940,133300000,127500000,5800000,-4.4%,AI YOK - Geleneksel\n' +
      'Şubat,2400,2328,290,281,7800,7568,1950,1891,128500000,124300000,4200000,-3.3%,AI YOK - Geleneksel\n' +
      'Mart,2300,1955,280,238,7600,6460,1900,1615,123700000,100435000,23265000,+18.8%,AI PILOT - Motor aktif\n' +
      'Nisan,2200,1804,270,221,7400,6068,1850,1517,118900000,95388500,23511500,+19.8%,AI FULL - İyileştirme\n' +
      'Mayıs,2150,1752,265,216,7200,5868,1800,1468,116150000,92644000,23506000,+20.2%,AI FULL + KURBAN BAYRAMI (27-31 Mayıs)\n' +
      'Haziran,2100,1701,260,211,7000,5670,1750,1418,113400000,89937000,23463000,+20.7%,AI FULL - Yaz başlangıcı + okul tatili\n' +
      'Temmuz,2050,1638,255,204,6800,5440,1700,1360,110650000,86630000,24020000,+21.7%,AI + Yazlık yoğunluk başladı\n' +
      'Ağustos,2000,1580,250,198,6600,5214,1650,1303,107900000,83495000,24405000,+22.6%,AI + Yazlık PEAK - Motor optimizasyonu\n' +
      'Eylül,2050,1617,255,201,6800,5364,1700,1343,110650000,85635000,25015000,+22.6%,AI + Yazlık iniş\n' +
      'Ekim,2100,1638,260,203,7000,5460,1750,1366,113400000,86660000,26740000,+23.6%,AI + Mevsim geçiş avantajı\n' +
      'Kasım,2200,1694,270,208,7400,5698,1850,1424,118900000,89590000,29310000,+24.7%,AI + Şehir dönüşü\n' +
      'Aralık,2300,1748,280,213,7600,5776,1900,1444,123700000,92400000,31300000,+25.3%,AI + Kış optimizasyonu\n\n' +
      'ÖZET\n' +
      'Yıllık Bütçe:,₺1.600.000.000\n' +
      'Gerçekleşen (AI ile):,₺1.308.784.500\n' +
      'Tasarruf Toplamı:,₺291.215.500\n' +
      'Tasarruf Oranı:,%18.2\n' +
      'AI Öncesi (Ocak-Şubat):,%5.5 tasarruf kaybı\n' +
      'AI Sonrası (Mart-Aralık):,%22.1 ortalama tasarruf';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `butce_performansi_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Report Generation Function
  const handleGenerateReport = () => {
    const reportContent = `
BÜTÇE PERFORMANSI & TASARRUF ANALİZİ RAPORU
=========================================
Tarih: ${new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

📊 GENEL BAKIŞ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Yıllık Bütçe (2026):              ₺1.600.000.000 ($36.7M @ 43.59₺/$)
Gerçekleşen (YTD - Şubat):        ₺251.800.000 ($5.8M)
YTD Tasarruf:                     ₺14.800.000 (%5.5) 🟡
Gerçekçi Yıl Sonu Tahmini:        ₺227.200.000 (%14.2) ✓
Motor Hedefi (AI Full):           ₺291.200.000 (%18.2) 🎯

💰 FİNANSAL ETKİ ANALİZİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI Öncesi Dönem (Ocak-Şubat):
  • Ortalama Tasarruf: -₺5.0M/ay (-%3.8)
  • Geleneksel yöntem kullanıldı
  • Kış mevsimi yoğunluğu etkisi

AI Pilot (Mart):
  • Tasarruf: +₺23.3M (+%18.8) ⚡
  • İlk ay motor etkisi başarılı

AI Full (Nisan-Aralık):
  • Ortalama Tasarruf: +₺25.5M/ay (+%22.5)
  • Motor optimizasyonu tam kapasitede
  • Mevsimsel avantajlar optimize edildi

🎯 HEDEF DURUM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
%15 Tasarruf Hedefi:              ₺240.000.000
Motor Hedefi (%18.2):             ₺291.200.000
Hedef Aşım:                       +₺51.200.000 (+%21.3 daha fazla)

📈 OPERASYONEL METRİKLER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLM Optimizasyonu:                %20-25 azalma (Mart+)
SLM Optimizasyonu:                %18-22 azalma
İkmal/Toplama Kombinasyonu:       %23-26 tasarruf
Mevsimsel Optimizasyon:           En yüksek Aralık (%25.3)

🔍 KRİTİK BULGULAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. AI etkisi Mart'ta anında görüldü (+%18.8)
2. Temmuz-Ağustos yazlık PEAK döneminde maksimum verimlilik
3. Kış aylarında (Kasım-Aralık) şehir yoğunluğu avantajı
4. Mevsimsel faktörlerin motor tarafından başarıyla yönetildi

✅ ÖNERİLER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Motor performansı hedefin üzerinde (%18.2 > %15)
• Mevsimsel stratejiler etkin çalışıyor
• 2027 için hedef: %20+ tasarruf mümkün
• Incremental learning ile sürekli iyileştirme devam etmeli

Rapor Oluşturan: IronClad Engine v1.0
Sonraki Güncelleme: ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('tr-TR')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `butce_raporu_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A1628] via-[#0E2142] to-[#1A1F3A] p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-white">
            💰 Bütçe Performansı & Tasarruf Analizi / Budget Performance & Savings Analysis
          </h1>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleExportExcel}
              className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-sm font-semibold transition flex items-center gap-2"
            >
              📊 Excel İndir
            </button>
            <button 
              onClick={handleGenerateReport}
              className="px-4 py-2 rounded-lg bg-[#2E86FF] hover:bg-[#1F6FE0] text-white text-sm font-semibold transition flex items-center gap-2"
            >
              📈 Rapor Oluştur
            </button>
          </div>
        </div>
        <p className="text-[#A7B8D8] text-sm">
          2026 Yılı Operasyonel Maliyet Takibi • Hedef: %15 Tasarruf • Motor Hedefi: %18.2 / 2026 Operational Cost Tracking • Target: 15% Savings • Engine Target: 18.2%
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-[#112544] rounded-lg p-4">
          <div className="text-xs text-[#A7B8D8] mb-1">Yıllık Bütçe 2026</div>
          <div className="text-2xl font-bold text-white">₺1.6B</div>
          <div className="text-xs text-[#A7B8D8] mt-1">$36.7M (43.59₺/$)</div>
        </div>
        <div className="bg-[#112544] rounded-lg p-4">
          <div className="text-xs text-[#A7B8D8] mb-1">Gerçekleşen (YTD)</div>
          <div className="text-2xl font-bold text-white">₺251.8M</div>
          <div className="text-xs text-white/70 mt-1">Şubat sonu - AI YOK ($5.8M)</div>
        </div>
        <div className="bg-[#112544] rounded-lg p-4 ring-2 ring-[#F59E0B]/50">
          <div className="text-xs text-[#A7B8D8] mb-1">Tasarruf (YTD)</div>
          <div className="text-2xl font-bold text-[#F59E0B]">₺14.8M</div>
          <div className="text-xs text-[#F59E0B] mt-1 font-semibold">%5.5 🟡 AI öncesi ($0.3M)</div>
        </div>
        <div className="bg-[#112544] rounded-lg p-4">
          <div className="text-xs text-[#A7B8D8] mb-1">Gerçekçi Yıl Sonu</div>
          <div className="text-2xl font-bold text-[#10B981]">₺227.2M</div>
          <div className="text-xs text-[#10B981] mt-1 font-semibold">%14.2 ✓ ($5.2M) Mart pilot</div>
        </div>
        <div className="bg-[#112544] rounded-lg p-4 ring-1 ring-[#8B5CF6]/50">
          <div className="text-xs text-[#8B5CF6] mb-1">Motor Hedefi (AI)</div>
          <div className="text-2xl font-bold text-[#8B5CF6]">₺291.2M</div>
          <div className="text-xs text-[#8B5CF6] mt-1 font-semibold">%18.2 🎯 Nis+ Full AI</div>
        </div>
      </div>

      {/* Monthly Budget Table */}
      <div className="bg-[#112544] rounded-lg overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0E2142]">
              <tr className="border-b border-[#2B416B]">
                <th className="text-left p-3 text-[#A7B8D8] font-semibold sticky left-0 bg-[#0E2142] z-10">Ay</th>
                <th className="text-center p-3 text-[#A7B8D8] font-semibold">FLM Bütçe</th>
                <th className="text-center p-3 text-[#A7B8D8] font-semibold">FLM Gerçek</th>
                <th className="text-center p-3 text-[#A7B8D8] font-semibold">SLM Bütçe</th>
                <th className="text-center p-3 text-[#A7B8D8] font-semibold">SLM Gerçek</th>
                <th className="text-center p-3 text-[#A7B8D8] font-semibold">İkmal Bütçe</th>
                <th className="text-center p-3 text-[#A7B8D8] font-semibold">İkmal Gerçek</th>
                <th className="text-center p-3 text-[#A7B8D8] font-semibold">Toplama Bütçe</th>
                <th className="text-center p-3 text-[#A7B8D8] font-semibold">Toplama Gerçek</th>
                <th className="text-right p-3 text-[#A7B8D8] font-semibold">Bütçe ₺</th>
                <th className="text-right p-3 text-[#A7B8D8] font-semibold">Gerçek ₺</th>
                <th className="text-center p-3 text-[#A7B8D8] font-semibold">Tasarruf</th>
                <th className="text-center p-3 text-[#A7B8D8] font-semibold">Not / Risk Faktörü</th>
              </tr>
            </thead>
            <tbody>
              {/* OCAK 2026 - Geleneksel Yöntem */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#EF4444]/5">
                <td className="p-3 text-white font-semibold sticky left-0 bg-[#112544]">Ocak 🔴</td>
                <td className="text-center p-3 text-white">2,500</td>
                <td className="text-center p-3 text-[#EF4444] font-semibold">2,425</td>
                <td className="text-center p-3 text-white">300</td>
                <td className="text-center p-3 text-[#EF4444] font-semibold">291</td>
                <td className="text-center p-3 text-white">8,000</td>
                <td className="text-center p-3 text-[#EF4444] font-semibold">7,760</td>
                <td className="text-center p-3 text-white">2,000</td>
                <td className="text-center p-3 text-[#EF4444] font-semibold">1,940</td>
                <td className="text-right p-3 text-white">₺133.3M</td>
                <td className="text-right p-3 text-[#EF4444] font-semibold">₺127.5M</td>
                <td className="text-center p-3">
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-[#EF4444]/20 text-[#EF4444]">
                    -₺5.8M (-4.4%)
                  </span>
                </td>
                <td className="text-center p-3 text-xs text-[#EF4444]/80">❌ AI YOK - Geleneksel + Kış + ❄️ SOĞUK/KAR + 🏙️ BÜYÜK ŞEHİR YOĞUNLUK (yazlıklar durgun) + YILBAŞI SONRASI</td>
              </tr>

              {/* ŞUBAT 2026 - Geleneksel Yöntem */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#F59E0B]/5">
                <td className="p-3 text-white font-semibold sticky left-0 bg-[#112544]">Şubat 🟡</td>
                <td className="text-center p-3 text-white">2,500</td>
                <td className="text-center p-3 text-[#F59E0B] font-semibold">2,350</td>
                <td className="text-center p-3 text-white">300</td>
                <td className="text-center p-3 text-[#F59E0B] font-semibold">282</td>
                <td className="text-center p-3 text-white">8,000</td>
                <td className="text-center p-3 text-[#F59E0B] font-semibold">7,520</td>
                <td className="text-center p-3 text-white">2,000</td>
                <td className="text-center p-3 text-[#F59E0B] font-semibold">1,880</td>
                <td className="text-right p-3 text-white">₺133.3M</td>
                <td className="text-right p-3 text-[#F59E0B] font-semibold">₺124.3M</td>
                <td className="text-center p-3">
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-[#F59E0B]/20 text-[#F59E0B]">
                    -₺9.0M (-6.8%)
                  </span>
                </td>
                <td className="text-center p-3 text-xs text-[#F59E0B]/80">🔶 AI YOK - Kısa ay (28 gün) + ❄️ Kış devam + YARIYIL TATİLİ ⛷️ Kayak bölge ATM spike (Uludag/Palandoken)</td>
              </tr>

              {/* MART 2026 - Pilot Test */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#3B82F6]/5">
                <td className="p-3 text-white font-semibold sticky left-0 bg-[#112544]">Mart (Pilot) 🔵</td>
                <td className="text-center p-3 text-white">2,500</td>
                <td className="text-center p-3 text-[#3B82F6]">2,250</td>
                <td className="text-center p-3 text-white">300</td>
                <td className="text-center p-3 text-[#3B82F6]">273</td>
                <td className="text-center p-3 text-white">8,000</td>
                <td className="text-center p-3 text-[#3B82F6]">7,280</td>
                <td className="text-center p-3 text-white">2,000</td>
                <td className="text-center p-3 text-[#3B82F6]">1,820</td>
                <td className="text-right p-3 text-white">₺133.3M</td>
                <td className="text-right p-3 text-[#3B82F6]">₺120.5M</td>
                <td className="text-center p-3">
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-[#3B82F6]/20 text-[#3B82F6]">
                    -₺12.8M (-9.6%)
                  </span>
                </td>
                <td className="text-center p-3 text-xs text-[#3B82F6]/80">🔷 AI Pilot Test BAŞLADI + RAMAZAN AYI (1 Mart başlıyor) 🌙 + RAMAZAN BAYRAMI (30 Mar-1 Nis) Arefe yoğunluğu</td>
              </tr>

              {/* NİSAN 2026 - AI Başlıyor */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#10B981]/5">
                <td className="p-3 text-white font-semibold sticky left-0 bg-[#112544]">Nisan 🟢</td>
                <td className="text-center p-3 text-white">2,500</td>
                <td className="text-center p-3 text-[#10B981]">2,175</td>
                <td className="text-center p-3 text-white">300</td>
                <td className="text-center p-3 text-[#10B981]">261</td>
                <td className="text-center p-3 text-white">8,000</td>
                <td className="text-center p-3 text-[#10B981]">7,000</td>
                <td className="text-center p-3 text-white">2,000</td>
                <td className="text-center p-3 text-[#10B981]">1,740</td>
                <td className="text-right p-3 text-white">₺133.3M</td>
                <td className="text-right p-3 text-[#10B981]">₺116.8M</td>
                <td className="text-center p-3">
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-[#10B981]/20 text-[#10B981]">
                    -₺16.5M (-12.4%)
                  </span>
                </td>
                <td className="text-center p-3 text-xs text-[#10B981]/80">✅ AI TAM DEVREDE - İlk ay + RAMAZAN BAYRAMI (30 Mart-1 Nis) dönüşü + 23 NİSAN TATİL 🎉 + BAHAR</td>
              </tr>

              {/* MAYIS 2026 */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#10B981]/5">
                <td className="p-3 text-white font-semibold sticky left-0 bg-[#112544]">Mayıs 🟢</td>
                <td className="text-center p-3 text-white">2,500</td>
                <td className="text-center p-3 text-[#10B981]">2,050</td>
                <td className="text-center p-3 text-white">300</td>
                <td className="text-center p-3 text-[#10B981]">249</td>
                <td className="text-center p-3 text-white">8,000</td>
                <td className="text-center p-3 text-[#10B981]">6,640</td>
                <td className="text-center p-3 text-white">2,000</td>
                <td className="text-center p-3 text-[#10B981]">1,660</td>
                <td className="text-right p-3 text-white">₺133.3M</td>
                <td className="text-right p-3 text-[#10B981]">₺112.8M</td>
                <td className="text-center p-3">
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-[#10B981]/20 text-[#10B981]">
                    -₺20.5M (-15.4%)
                  </span>
                </td>
                <td className="text-center p-3 text-xs text-[#10B981]/80">✅ AI öğreniyor + 1 MAYIS + 19 MAYIS TATİL + 🐑 KURBAN BAYRAMI (27-31 MAYIS) AREFE MAX! 🎊 + YAZ BAŞLANGIÇ</td>
              </tr>

              {/* HAZİRAN 2026 */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#10B981]/5">
                <td className="p-3 text-white font-semibold sticky left-0 bg-[#112544]">Haziran 🟢</td>
                <td className="text-center p-3 text-white">2,500</td>
                <td className="text-center p-3 text-[#10B981]">2,000</td>
                <td className="text-center p-3 text-white">300</td>
                <td className="text-center p-3 text-[#10B981]">246</td>
                <td className="text-center p-3 text-white">8,000</td>
                <td className="text-center p-3 text-[#10B981]">6,560</td>
                <td className="text-center p-3 text-white">2,000</td>
                <td className="text-center p-3 text-[#10B981]">1,640</td>
                <td className="text-right p-3 text-white">₺133.3M</td>
                <td className="text-right p-3 text-[#10B981]">₺111.2M</td>
                <td className="text-center p-3">
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-[#10B981]/20 text-[#10B981]">
                    -₺22.1M (-16.6%)
                  </span>
                </td>
                <td className="text-center p-3 text-xs text-[#10B981]/80">✅ Bayram sonrası normale dönüş + 🏖️ OKUL TATİLİ TAM DEVREDE! Yazlık/sahil ATM spike + YAZ ZİRVESİ YAKLAŞIYOR</td>
              </tr>

              {/* TEMMUZ 2026 */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#10B981]/5">
                <td className="p-3 text-white font-semibold sticky left-0 bg-[#112544]">Temmuz 🟢</td>
                <td className="text-center p-3 text-white">2,500</td>
                <td className="text-center p-3 text-[#10B981]">1,975</td>
                <td className="text-center p-3 text-white">300</td>
                <td className="text-center p-3 text-[#10B981]">243</td>
                <td className="text-center p-3 text-white">8,000</td>
                <td className="text-center p-3 text-[#10B981]">6,480</td>
                <td className="text-center p-3 text-white">2,000</td>
                <td className="text-center p-3 text-[#10B981]">1,620</td>
                <td className="text-right p-3 text-white">₺133.3M</td>
                <td className="text-right p-3 text-[#10B981]">₺110.6M</td>
                <td className="text-center p-3">
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-[#10B981]/20 text-[#10B981]">
                    -₺22.7M (-17.0%)
                  </span>
                </td>
                <td className="text-center p-3 text-xs text-[#10B981]/80">✅ YAZ ZİRVESİ + AI peak + 🌡️ SICAK (38-42°C) + 🏖️ YAZLIK/SAHİL ATM PATLAMA (+200-400% işlem) + ⚠️ KAYIŞ ERİMESİ RİSKİ</td>
              </tr>

              {/* AĞUSTOS 2026 */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#F59E0B]/5">
                <td className="p-3 text-white font-semibold sticky left-0 bg-[#112544]">Ağustos 🟡</td>
                <td className="text-center p-3 text-white">2,500</td>
                <td className="text-center p-3 text-[#F59E0B]">2,150</td>
                <td className="text-center p-3 text-white">300</td>
                <td className="text-center p-3 text-[#F59E0B]">264</td>
                <td className="text-center p-3 text-white">8,000</td>
                <td className="text-center p-3 text-[#F59E0B]">6,880</td>
                <td className="text-center p-3 text-white">2,000</td>
                <td className="text-center p-3 text-[#F59E0B]">1,720</td>
                <td className="text-right p-3 text-white">₺133.3M</td>
                <td className="text-right p-3 text-[#F59E0B]">₺116.2M</td>
                <td className="text-center p-3">
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-[#F59E0B]/20 text-[#F59E0B]">
                    -₺17.1M (-12.8%)
                  </span>
                </td>
                <td className="text-center p-3 text-xs text-[#F59E0B]/70">🔶 30 AĞUSTOS ZAFER BAYRAMI 🏆 + 🌡️ MAX Sıcak (45°C+) + 🏝️ YAZLIK ZİRVE (Bodrum/Antalya/Çeşme) ⚠️ EYLÜL'E GEÇİŞ</td>
              </tr>

              {/* EYLÜL 2026 */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#10B981]/5">
                <td className="p-3 text-white font-semibold sticky left-0 bg-[#112544]">Eylül 🟢</td>
                <td className="text-center p-3 text-white">2,500</td>
                <td className="text-center p-3 text-[#10B981]">2,050</td>
                <td className="text-center p-3 text-white">300</td>
                <td className="text-center p-3 text-[#10B981]">249</td>
                <td className="text-center p-3 text-white">8,000</td>
                <td className="text-center p-3 text-[#10B981]">6,640</td>
                <td className="text-center p-3 text-white">2,000</td>
                <td className="text-center p-3 text-[#10B981]">1,660</td>
                <td className="text-right p-3 text-white">₺133.3M</td>
                <td className="text-right p-3 text-[#10B981]">₺112.8M</td>
                <td className="text-center p-3">
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-[#10B981]/20 text-[#10B981]">
                    -₺20.5M (-15.4%)
                  </span>
                </td>
                <td className="text-center p-3 text-xs text-[#10B981]/80">✅ Sonbahar + 🏫 OKUL AÇILDI (15 Eyl) Şehre dönüş başladı, yazlık ATM düşüş + AI mevsim geçişi optimizasyonu</td>
              </tr>

              {/* EKİM 2026 */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#10B981]/5">
                <td className="p-3 text-white font-semibold sticky left-0 bg-[#112544]">Ekim 🟢</td>
                <td className="text-center p-3 text-white">2,500</td>
                <td className="text-center p-3 text-[#10B981]">2,025</td>
                <td className="text-center p-3 text-white">300</td>
                <td className="text-center p-3 text-[#10B981]">249</td>
                <td className="text-center p-3 text-white">8,000</td>
                <td className="text-center p-3 text-[#10B981]">6,600</td>
                <td className="text-center p-3 text-white">2,000</td>
                <td className="text-center p-3 text-[#10B981]">1,650</td>
                <td className="text-right p-3 text-white">₺133.3M</td>
                <td className="text-right p-3 text-[#10B981]">₺112.0M</td>
                <td className="text-center p-3">
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-[#10B981]/20 text-[#10B981]">
                    -₺21.3M (-16.0%)
                  </span>
                </td>
                <td className="text-center p-3 text-xs text-[#10B981]/80">✅ AI full performans + 29 EKİM CUMHURİYET BAYRAMI 🇼🇷 (Köprü 5 gün olursa tatil yoğunluğu)</td>
              </tr>

              {/* KASIM 2026 */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#F59E0B]/5">
                <td className="p-3 text-white font-semibold sticky left-0 bg-[#112544]">Kasım 🟡</td>
                <td className="text-center p-3 text-white">2,500</td>
                <td className="text-center p-3 text-[#F59E0B]">2,125</td>
                <td className="text-center p-3 text-white">300</td>
                <td className="text-center p-3 text-[#F59E0B]">264</td>
                <td className="text-center p-3 text-white">8,000</td>
                <td className="text-center p-3 text-[#F59E0B]">7,000</td>
                <td className="text-center p-3 text-white">2,000</td>
                <td className="text-center p-3 text-[#F59E0B]">1,750</td>
                <td className="text-right p-3 text-white">₺133.3M</td>
                <td className="text-right p-3 text-[#F59E0B]">₺117.0M</td>
                <td className="text-center p-3">
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-[#F59E0B]/20 text-[#F59E0B]">
                    -₺16.3M (-12.2%)
                  </span>
                </td>
                <td className="text-center p-3 text-xs text-[#F59E0B]/70">🔶 Kış arızaları başlıyor + 🏙️ TAM ŞEHİR YOĞUNLUK (yazlıklar kapalı), büyük şehir ATM spike + SOĞUK</td>
              </tr>

              {/* ARALIK 2026 */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#F59E0B]/5">
                <td className="p-3 text-white font-semibold sticky left-0 bg-[#112544]">Aralık 🟡</td>
                <td className="text-center p-3 text-white">2,500</td>
                <td className="text-center p-3 text-[#F59E0B]">2,175</td>
                <td className="text-center p-3 text-white">300</td>
                <td className="text-center p-3 text-[#F59E0B]">270</td>
                <td className="text-center p-3 text-white">8,000</td>
                <td className="text-center p-3 text-[#F59E0B]">7,120</td>
                <td className="text-center p-3 text-white">2,000</td>
                <td className="text-center p-3 text-[#F59E0B]">1,780</td>
                <td className="text-right p-3 text-white">₺133.3M</td>
                <td className="text-right p-3 text-[#F59E0B]">₺118.5M</td>
                <td className="text-center p-3">
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-[#F59E0B]/20 text-[#F59E0B]">
                    -₺14.8M (-11.1%)
                  </span>
                </td>
                <td className="text-center p-3 text-xs text-[#F59E0B]/70">🔶 YILBAŞI (31 Ara) 🎄 AREFE MAX ÇEKİM + ❄️ Kar/Soğuk arıza + YILSONU MAAŞ/İKRAMIYE</td>
              </tr>

              {/* TOTAL ROW - Gerçekçi */}
              <tr className="bg-[#0E2142] font-bold">
                <td className="p-4 text-white text-base sticky left-0 bg-[#112544]">TOPLAM 2026 (Gerçekçi)</td>
                <td className="text-center p-4 text-white">30,000</td>
                <td className="text-center p-4 text-[#10B981] text-base">25,800</td>
                <td className="text-center p-4 text-white">3,600</td>
                <td className="text-center p-4 text-[#10B981] text-base">3,102</td>
                <td className="text-center p-4 text-white">96,000</td>
                <td className="text-center p-4 text-[#10B981] text-base">82,800</td>
                <td className="text-center p-4 text-white">24,000</td>
                <td className="text-center p-4 text-[#10B981] text-base">20,700</td>
                <td className="text-right p-4 text-white text-base">₺1.6B</td>
                <td className="text-right p-4 text-[#10B981] text-base">₺1.37B</td>
                <td className="text-center p-4">
                  <div className="flex flex-col gap-2">
                    <span className="px-3 py-2 rounded-lg text-sm font-bold bg-[#10B981]/30 text-[#10B981] ring-2 ring-[#10B981]/50">
                      -₺227.2M (-14.2%) ✓
                    </span>
                    <span className="text-xs text-[#F59E0B]">Q1 AI yok, Q2-Q4 AI tam</span>
                  </div>
                </td>
                <td className="text-center p-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-2xl">🎯</span>
                    <span className="text-xs text-white/60">Konservatif</span>
                  </div>
                </td>
              </tr>

              {/* MOTOR HEDEF ROW - Nisan+ Ideal */}
              <tr className="bg-[#8B5CF6]/10 font-bold border-t-2 border-[#8B5CF6]/50">
                <td className="p-4 text-[#8B5CF6] text-base sticky left-0 bg-[#112544]">MOTOR HEDEFİ (Nis+)</td>
                <td className="text-center p-4 text-white">30,000</td>
                <td className="text-center p-4 text-[#8B5CF6] text-base">24,600</td>
                <td className="text-center p-4 text-white">3,600</td>
                <td className="text-center p-4 text-[#8B5CF6] text-base">2,940</td>
                <td className="text-center p-4 text-white">96,000</td>
                <td className="text-center p-4 text-[#8B5CF6] text-base">78,720</td>
                <td className="text-center p-4 text-white">24,000</td>
                <td className="text-center p-4 text-[#8B5CF6] text-base">19,680</td>
                <td className="text-right p-4 text-white text-base">₺1.6B</td>
                <td className="text-right p-4 text-[#8B5CF6] text-base">₺1.31B</td>
                <td className="text-center p-4">
                  <div className="flex flex-col gap-2">
                    <span className="px-3 py-2 rounded-lg text-sm font-bold bg-[#8B5CF6]/30 text-[#8B5CF6] ring-2 ring-[#8B5CF6]/50">
                      -₺291.2M (-18.2%) 🚀
                    </span>
                    <span className="text-xs text-[#8B5CF6]">Ocak'tan başlasaydı</span>
                  </div>
                </td>
                <td className="text-center p-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-2xl">🧠</span>
                    <span className="text-xs text-[#8B5CF6]">Best Case</span>
                  </div>
                </td>
              </tr>
              
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights & AI Recommendations */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#10B981]/10 rounded-lg p-4 ring-1 ring-[#10B981]/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🎯</span>
            <div className="text-sm font-bold text-white">Gerçekçi Senaryo</div>
          </div>
          <div className="text-xs text-white/80 mb-2">
            %14.2 tasarruf bekleniyor (₺227M). Q1 (Oca-Şub-Mar) AI yok, manuel. Nisan'dan itibaren AI tam devrede. Mart pilot test.
          </div>
          <div className="text-xs text-[#F59E0B] font-semibold">
            ⚠️ %15 hedefin biraz altında (-0.8pp)
          </div>
        </div>

        <div className="bg-[#8B5CF6]/10 rounded-lg p-4 ring-1 ring-[#8B5CF6]/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🧠</span>
            <div className="text-sm font-bold text-white">Motor Hedefi</div>
          </div>
          <div className="text-xs text-white/80 mb-2">
            IronClad Engine %18.2 (₺291M) hedefliyor. Nisan-Aralık arası (9 ay) tam devrede. Ocak'tan başlasaydık bu rakam mümkündü. Motor asla değişmez.
          </div>
          <div className="text-xs text-[#8B5CF6] font-semibold">
            🚀 Best case - Stretch goal
          </div>
        </div>

        <div className="bg-[#F59E0B]/10 rounded-lg p-4 ring-1 ring-[#F59E0B]/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">⚠️</span>
            <div className="text-sm font-bold text-white">Geç Başlama Riski</div>
          </div>
          <div className="text-xs text-white/80 mb-2">
            Q1 manuel çalıştık (~%6 tasarruf). Nisan'dan itibaren AI devrede (~%16 ortalama). Yıllık ortalama %14.2.
          </div>
          <div className="text-xs text-[#F59E0B] font-semibold">
            📊 3 ay kaybı var, ama telafi mümkün
          </div>
        </div>
      </div>

      {/* 2026 BÜTÇE PERFORMANSI - ÖZET KART */}
      <div className="bg-[#112544] rounded-2xl p-6 ring-1 ring-[#2B416B] mt-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-lg font-bold text-white">2026 Bütçe Performansı</div>
            <div className="text-sm text-[#A7B8D8]">Detaylı maliyet analizi ve tasarruf takibi</div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-[#0E2142]/60 rounded-lg p-3">
            <div className="text-xs text-[#A7B8D8] mb-1">YTD Tasarruf</div>
            <div className="text-xl font-bold text-[#F59E0B]">₺14.8M</div>
            <div className="text-xs text-[#F59E0B]">%5.5</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-lg p-3">
            <div className="text-xs text-[#A7B8D8] mb-1">Yıl Sonu Hedef</div>
            <div className="text-xl font-bold text-[#10B981]">₺227M</div>
            <div className="text-xs text-[#10B981]">%14.2</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-lg p-3">
            <div className="text-xs text-[#A7B8D8] mb-1">Motor Hedefi</div>
            <div className="text-xl font-bold text-[#8B5CF6]">₺291M</div>
            <div className="text-xs text-[#8B5CF6]">%18.2</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-lg p-3">
            <div className="text-xs text-[#A7B8D8] mb-1">Durum</div>
            <div className="text-sm font-bold text-[#F59E0B]">AI Pilot</div>
            <div className="text-xs text-[#F59E0B]">Mart 2026</div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';

export default function BudgetPerformancePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A1628] via-[#0E2142] to-[#1A1F3A] p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-white">
            💰 Bütçe Performansı & Tasarruf Analizi
          </h1>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-sm font-semibold transition flex items-center gap-2">
              📊 Excel İndir
            </button>
            <button className="px-4 py-2 rounded-lg bg-[#2E86FF] hover:bg-[#1F6FE0] text-white text-sm font-semibold transition flex items-center gap-2">
              📈 Rapor Oluştur
            </button>
          </div>
        </div>
        <p className="text-[#A7B8D8] text-sm">
          2026 Yılı Operasyonel Maliyet Takibi • Hedef: %15 Tasarruf • Motor Hedefi: %18.2
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
                <td className="text-center p-3 text-xs text-[#EF4444]/80">❌ AI YOK - Geleneksel + Kış + 🏙️ BÜYÜK ŞEHİR YOĞUNLUK (yazlıklar durgun)</td>
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
                <td className="text-center p-3 text-xs text-[#F59E0B]/80">🔶 AI YOK - Kısa ay + Kış TATİLİ (yarıyıl) ⛷️ Kayak bölge ATM spike</td>
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
                <td className="text-center p-3 text-xs text-[#3B82F6]/80">🔷 AI Pilot Test + RAMAZAN BAYRAMI (30 Mar-2 Nis) 🌙 Arefe yoğunluğu</td>
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
                <td className="text-center p-3 text-xs text-[#10B981]/80">✅ AI TAM DEVREDE - İlk ay + Ramazan dönüşü + 23 NİSAN TATİL 🎉</td>
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
                <td className="text-center p-3 text-xs text-[#10B981]/80">✅ AI öğreniyor + 1 MAYIS + 19 MAYIS TATİLLER (Köprü olursa yo) 🎊</td>
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
                <td className="text-center p-3 text-xs text-[#10B981]/80">✅ Yaz + KURBAN BAYRAMI (6-10 Haz) 🐑 AREFE MAX + 🏖️ OKUL TATİLİ BAŞLA! Yazlık/sahil ATM spike</td>
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
                <td className="text-center p-3 text-xs text-[#10B981]/80">✅ Tatil + AI peak + 🌡️ SICAK (38-42°C) + 🏖️ YAZLIK/SAHİL ATM PATLAMA (işlem +200-400%) + ⚠️ KAYIŞ ERİMESİ RİSKİ</td>
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
                <td className="text-center p-3 text-xs text-[#F59E0B]/70">🔶 30 AĞUSTOS 🏆 + 🌡️ MAX Sıcak (45°C) + 🏝️ YAZLIK ZİRVE (Bodrum/Antalya/Çeşme) ⚠️</td>
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
                <td className="text-center p-3 text-xs text-[#10B981]/80">✅ Sonbahar + 🏫 OKUL AÇILDI (15 Eyl) Şehre dönüş başladı, yazlık ATM düşüş</td>
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
                <td className="text-center p-3 text-xs text-[#10B981]/80">✅ AI full performans + 29 EKİM CUMHURİYET BAYRAMI 🇹🇷 (Köprü 5 gün)</td>
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
                <td className="text-center p-3 text-xs text-[#F59E0B]/70">🔶 Kış arızaları + 🏙️ TAM ŞEHİR YOĞUNLUK (yazlıklar kapalı), büyük şehir ATM spike</td>
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
                <td className="text-center p-3 text-xs text-[#F59E0B]/70">🔶 YILBAŞI TATİLİ (31 Ara-1 Oca) 🎄 Arefe MAX ÇEKİM + Kar/Soğuk arıza</td>
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
    </div>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import { getPriceByKM, getSLMPrice, calculateOperationCosts, formatCurrency, formatCurrencyShort, getKMColor } from '@/utils/pricing';

// ATM Data with cost calculations
interface ATMData {
  id: string;
  name: string;
  cashCenter: string;
  zone: number;
  km: number;
  serviceDays: string;
  operations: {
    ikmal: { monthly: number; cost: number };
    flm: { monthly: number; cost: number };
    slm: { monthly: number; cost: number };
    paraToplama: { monthly: number; cost: number };
  };
  totalMonthlyCost: number;
  totalYearlyCost: number;
}

// ÖRNEK ATM DATA (Gerçek CSV'den alınan veriler)
const SAMPLE_ATM_DATA: ATMData[] = [
  {
    id: 'FA621',
    name: '06 MAMAK NOKTA AVM',
    cashCenter: 'ANKARA',
    zone: 1,
    km: 10,
    serviceDays: 'Hergün',
    operations: { ikmal: { monthly: 10, cost: 0 }, flm: { monthly: 4, cost: 0 }, slm: { monthly: 1, cost: 0 }, paraToplama: { monthly: 12, cost: 0 } },
    totalMonthlyCost: 0,
    totalYearlyCost: 0
  },
  {
    id: 'FA336',
    name: '10 EDREMIT KORFEZ HAST',
    cashCenter: 'BALIKESİR',
    zone: 3,
    km: 89,
    serviceDays: 'Salı - Perşembe',
    operations: { ikmal: { monthly: 10, cost: 0 }, flm: { monthly: 4, cost: 0 }, slm: { monthly: 1, cost: 0 }, paraToplama: { monthly: 12, cost: 0 } },
    totalMonthlyCost: 0,
    totalYearlyCost: 0
  },
  {
    id: 'FA777',
    name: '81 AKCAKOCA CINAR BORU',
    cashCenter: 'ZONGULDAK',
    zone: 3,
    km: 87,
    serviceDays: 'Pazartesi - Çarşamba - Cuma',
    operations: { ikmal: { monthly: 10, cost: 0 }, flm: { monthly: 4, cost: 0 }, slm: { monthly: 1, cost: 0 }, paraToplama: { monthly: 12, cost: 0 } },
    totalMonthlyCost: 0,
    totalYearlyCost: 0
  },
  {
    id: 'FI328',
    name: '08 HOPA MERKEZ',
    cashCenter: 'TRABZON',
    zone: 5,
    km: 170,
    serviceDays: 'Pazartesi - Salı - Perşembe - Cuma',
    operations: { ikmal: { monthly: 10, cost: 0 }, flm: { monthly: 4, cost: 0 }, slm: { monthly: 1, cost: 0 }, paraToplama: { monthly: 12, cost: 0 } },
    totalMonthlyCost: 0,
    totalYearlyCost: 0
  },
  {
    id: 'FD172',
    name: '46 ELBISTAN YUNUS EMRE MAH',
    cashCenter: 'GAZİANTEP',
    zone: 5,
    km: 213,
    serviceDays: 'Pazartesi - Çarşamba - Cuma',
    operations: { ikmal: { monthly: 10, cost: 0 }, flm: { monthly: 4, cost: 0 }, slm: { monthly: 1, cost: 0 }, paraToplama: { monthly: 12, cost: 0 } },
    totalMonthlyCost: 0,
    totalYearlyCost: 0
  },
  {
    id: 'FC818',
    name: '48 MARMARIS MERKEZ',
    cashCenter: 'MUĞLA',
    zone: 2,
    km: 60,
    serviceDays: 'Pazartesi - Perşembe',
    operations: { ikmal: { monthly: 10, cost: 0 }, flm: { monthly: 4, cost: 0 }, slm: { monthly: 1, cost: 0 }, paraToplama: { monthly: 12, cost: 0 } },
    totalMonthlyCost: 0,
    totalYearlyCost: 0
  },
  {
    id: 'FA279',
    name: '07 KEMER TEKIROVA MERKEZ',
    cashCenter: 'ANTALYA',
    zone: 2,
    km: 62,
    serviceDays: 'Salı - Perşembe',
    operations: { ikmal: { monthly: 10, cost: 0 }, flm: { monthly: 4, cost: 0 }, slm: { monthly: 1, cost: 0 }, paraToplama: { monthly: 12, cost: 0 } },
    totalMonthlyCost: 0,
    totalYearlyCost: 0
  },
  {
    id: 'FD831',
    name: '61 CAYKARA UZUNGOL',
    cashCenter: 'TRABZON',
    zone: 3,
    km: 95,
    serviceDays: 'Çarşamba',
    operations: { ikmal: { monthly: 10, cost: 0 }, flm: { monthly: 4, cost: 0 }, slm: { monthly: 1, cost: 0 }, paraToplama: { monthly: 12, cost: 0 } },
    totalMonthlyCost: 0,
    totalYearlyCost: 0
  },
  {
    id: 'FN959',
    name: '01 POZANTI MERKEZ',
    cashCenter: 'ADANA',
    zone: 3,
    km: 100,
    serviceDays: 'Salı - Perşembe',
    operations: { ikmal: { monthly: 10, cost: 0 }, flm: { monthly: 4, cost: 0 }, slm: { monthly: 1, cost: 0 }, paraToplama: { monthly: 12, cost: 0 } },
    totalMonthlyCost: 0,
    totalYearlyCost: 0
  },
  {
    id: 'FD273',
    name: '02 MERKEZ MOBIL ATM',
    cashCenter: 'ŞANLIURFA',
    zone: 4,
    km: 111,
    serviceDays: 'Pazartesi - Çarşamba - Cuma',
    operations: { ikmal: { monthly: 10, cost: 0 }, flm: { monthly: 4, cost: 0 }, slm: { monthly: 1, cost: 0 }, paraToplama: { monthly: 12, cost: 0 } },
    totalMonthlyCost: 0,
    totalYearlyCost: 0
  }
];

// Maliyet hesaplama
function calculateATMCosts(atms: ATMData[]): ATMData[] {
  return atms.map(atm => {
    const ikmalPrice = getPriceByKM(atm.km);
    const flmPrice = getPriceByKM(atm.km);
    const slmPrice = getSLMPrice(atm.km);
    const paraToplamaPrice = getPriceByKM(atm.km);

    const ikmalCost = atm.operations.ikmal.monthly * ikmalPrice;
    const flmCost = atm.operations.flm.monthly * flmPrice;
    const slmCost = atm.operations.slm.monthly * slmPrice;
    const paraToplamaCost = atm.operations.paraToplama.monthly * paraToplamaPrice;

    const totalMonthlyCost = ikmalCost + flmCost + slmCost + paraToplamaCost;

    return {
      ...atm,
      operations: {
        ikmal: { monthly: atm.operations.ikmal.monthly, cost: ikmalCost },
        flm: { monthly: atm.operations.flm.monthly, cost: flmCost },
        slm: { monthly: atm.operations.slm.monthly, cost: slmCost },
        paraToplama: { monthly: atm.operations.paraToplama.monthly, cost: paraToplamaCost }
      },
      totalMonthlyCost,
      totalYearlyCost: totalMonthlyCost * 12
    };
  });
}

export default function BudgetPerformancePage() {
  const [expandedCenters, setExpandedCenters] = useState<Set<string>>(new Set());
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [selectedATM, setSelectedATM] = useState<string | null>(null);
  const [allATMs, setAllATMs] = useState<ATMData[]>([]);
  const [loading, setLoading] = useState(true);

  // CSV'den tüm ATM'leri yükle
  React.useEffect(() => {
    async function loadCSV() {
      try {
        const response = await fetch('/api/atm-data');
        const result = await response.json();
        const csvText = result.data;
        const lines = csvText.split('\n');
        
        const atms: ATMData[] = [];
        
        // İlk 3 satır header, 3. satırdan itibaren veri
        for (let i = 3; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const parts = line.split(';');
          if (parts.length < 7) continue;
          
          const atmId = parts[0];
          const atmName = parts[1];
          const cashCenter = parts[3];
          const serviceDays = parts[4];
          const zone = parseInt(parts[5]) || 1;
          const km = parseInt(parts[6]) || 10;
          
          if (!atmId || !atmName) continue;
          
          atms.push({
            id: atmId,
            name: atmName,
            cashCenter: cashCenter,
            zone: zone,
            km: km,
            serviceDays: serviceDays,
            operations: {
              ikmal: { monthly: 10, cost: 0 },
              flm: { monthly: 4, cost: 0 },
              slm: { monthly: 1, cost: 0 },
              paraToplama: { monthly: 12, cost: 0 }
            },
            totalMonthlyCost: 0,
            totalYearlyCost: 0
          });
        }
        
        const calculated = calculateATMCosts(atms);
        setAllATMs(calculated);
        setLoading(false);
      } catch (error) {
        console.error('CSV yükleme hatası:', error);
        setLoading(false);
      }
    }
    
    loadCSV();
  }, []);

  // Nakit merkezine göre grupla
  const atmsByCashCenter = useMemo(() => {
    const grouped: Record<string, ATMData[]> = {};
    allATMs.forEach((atm: ATMData) => {
      if (!grouped[atm.cashCenter]) {
        grouped[atm.cashCenter] = [];
      }
      grouped[atm.cashCenter].push(atm);
    });
    // Her grubu KM'ye göre sırala
    Object.keys(grouped).forEach(center => {
      grouped[center].sort((a, b) => a.km - b.km);
    });
    return grouped;
  }, [allATMs]);

  // Nakit merkezi istatistikleri
  const cashCenterStats = useMemo(() => {
    return Object.entries(atmsByCashCenter).map(([centerName, atms]) => {
      const totalKm = atms.reduce((sum: number, atm: ATMData) => sum + atm.km, 0);
      const kms = atms.map((atm: ATMData) => atm.km);
      const totalMonthly = atms.reduce((sum: number, atm: ATMData) => sum + atm.totalMonthlyCost, 0);
      
      return {
        centerName,
        atmCount: atms.length,
        avgKm: totalKm / atms.length,
        minKm: Math.min(...kms),
        maxKm: Math.max(...kms),
        totalMonthly,
        totalYearly: totalMonthly * 12,
      };
    }).sort((a, b) => b.totalMonthly - a.totalMonthly); // Yüksek maliyetten düşüğe
  }, [atmsByCashCenter]);

  // Genel toplamlar
  const grandTotals = useMemo(() => {
    const totalAtms = allATMs.length;
    const totalMonthly = allATMs.reduce((sum: number, atm: ATMData) => sum + atm.totalMonthlyCost, 0);
    const totalYearly = totalMonthly * 12;
    const avgKm = totalAtms > 0 ? allATMs.reduce((sum: number, atm: ATMData) => sum + atm.km, 0) / totalAtms : 0;
    
    return { totalAtms, totalMonthly, totalYearly, avgKm };
  }, [allATMs]);

  // Accordion toggle
  const toggleCenter = (centerName: string) => {
    const newExpanded = new Set(expandedCenters);
    if (newExpanded.has(centerName)) {
      newExpanded.delete(centerName);
    } else {
      newExpanded.add(centerName);
    }
    setExpandedCenters(newExpanded);
  };

  const toggleZone = (centerName: string, zone: number) => {
    const zoneKey = `${centerName}-Z${zone}`;
    const newExpanded = new Set(expandedZones);
    if (newExpanded.has(zoneKey)) {
      newExpanded.delete(zoneKey);
    } else {
      newExpanded.add(zoneKey);
    }
    setExpandedZones(newExpanded);
  };

  // Excel Export Function
  const handleExportExcel = () => {
    const csvContent = '\uFEFFBütçe Performansı 2026\n' +
      'Rapor Tarihi: ' + new Date().toLocaleDateString('tr-TR') + '\n\n' +
      'Ay,İkmal Bütçe,İkmal Gerçek,FLM Bütçe,FLM Gerçek,SLM Bütçe,SLM Gerçek,Para Toplama Bütçe,Para Toplama Gerçek,Toplama+FLM Bütçe,Toplama+FLM Gerçek,Toplama+İkmal Bütçe,Toplama+İkmal Gerçek,Bütçe TRY,Gerçek TRY,Tasarruf,Tasarruf %,Not\n' +
      'Ocak,199,199,6944,6944,2280,2280,26491,26491,7096,7096,3324,3324,104200000,104200000,0,0.0%,AI YOK - Geleneksel\n' +
      'Şubat,197,197,7005,7005,2289,2289,26595,26595,7153,7153,3243,3243,104200000,104200000,0,0.0%,AI YOK - Geleneksel\n' +
      'Mart,195,179,7049,6478,2289,2106,26951,24795,7175,6597,3194,2938,104200000,96000000,8200000,+7.9%,AI PILOT - Motor aktif\n' +
      'Nisan,192,157,7040,5763,2291,1876,27179,22257,7189,5889,3165,2592,104200000,85300000,18900000,+18.1%,AI FULL\n' +
      'Mayıs,196,160,7109,5820,2316,1897,27343,22391,7243,5933,3245,2658,104200000,85300000,18900000,+18.1%,AI FULL\n' +
      'Haziran,199,163,7156,5858,2322,1902,27359,22408,7327,6000,3322,2721,104200000,85300000,18900000,+18.1%,AI FULL\n' +
      'Temmuz,205,168,7221,5915,2362,1935,27592,22599,7375,6041,3392,2779,104200000,85300000,18900000,+18.1%,AI FULL + YAZ\n' +
      'Ağustos,206,177,7277,6253,2380,2045,27811,23896,7432,6388,3413,2933,104200000,89500000,14700000,+14.1%,AI + YAZ PEAK\n' +
      'Eylül,207,170,7333,6003,2397,1963,28030,22945,7490,6135,3433,2811,104200000,85300000,18900000,+18.1%,AI + Sonbahar\n' +
      'Ekim,209,171,7390,6050,2415,1978,28251,23126,7547,6182,3453,2827,104200000,85300000,18900000,+18.1%,AI + Mevsim\n' +
      'Kasım,209,180,7433,6388,2428,2088,28423,24443,7591,6527,3466,2979,104200000,89500000,14700000,+14.1%,AI + Kış\n' +
      'Aralık,209,180,7449,6401,2432,2091,28489,24500,7606,6540,3466,2979,104200000,89500000,14700000,+14.1%,AI + YILBAŞI\n\n' +
      'ÖZET\n' +
      'Yıllık Bütçe:,₺1.250.000.000\n' +
      'Gerçekleşen (AI ile):,₺1.062.500.000\n' +
      'Tasarruf Toplamı:,₺187.500.000\n' +
      'Tasarruf Oranı:,%15.0\n' +
      'AI Öncesi (Ocak-Şubat):,%0.0 tasarruf\n' +
      'AI Sonrası (Mart-Aralık):,%17.1 ortalama tasarruf\n\n' +
      'YENİ KALEMLER:\n' +
      'Para Toplama+FLM Toplam Bütçe:,87224\n' +
      'Para Toplama+FLM Toplam Gerçek:,74443\n' +
      'Para Toplama+İkmal Toplam Bütçe:,40116\n' +
      'Para Toplama+İkmal Toplam Gerçek:,34239';
    
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
          <div className="text-2xl font-bold text-white">₺1.25B</div>
          <div className="text-xs text-[#A7B8D8] mt-1">$28.7M (43.59₺/$)</div>
        </div>
        <div className="bg-[#112544] rounded-lg p-4">
          <div className="text-xs text-[#A7B8D8] mb-1">Gerçekleşen (YTD)</div>
          <div className="text-2xl font-bold text-white">₺208.3M</div>
          <div className="text-xs text-white/70 mt-1">Şubat sonu - AI YOK ($4.8M)</div>
        </div>
        <div className="bg-[#112544] rounded-lg p-4 ring-2 ring-[#F59E0B]/50">
          <div className="text-xs text-[#A7B8D8] mb-1">Tasarruf (YTD)</div>
          <div className="text-2xl font-bold text-[#F59E0B]">₺0.0M</div>
          <div className="text-xs text-[#F59E0B] mt-1 font-semibold">%0.0 🟡 AI öncesi</div>
        </div>
        <div className="bg-[#112544] rounded-lg p-4">
          <div className="text-xs text-[#A7B8D8] mb-1">Gerçekçi Yıl Sonu</div>
          <div className="text-2xl font-bold text-[#10B981]">₺187.5M</div>
          <div className="text-xs text-[#10B981] mt-1 font-semibold">%15.0 ✓ ($4.3M) Mart pilot</div>
        </div>
        <div className="bg-[#112544] rounded-lg p-4 ring-1 ring-[#8B5CF6]/50">
          <div className="text-xs text-[#8B5CF6] mb-1">Motor Hedefi (AI)</div>
          <div className="text-2xl font-bold text-[#8B5CF6]">₺228.0M</div>
          <div className="text-xs text-[#8B5CF6] mt-1 font-semibold">%18.2 🎯 Nis+ Full AI</div>
        </div>
      </div>

      {/* Monthly Budget Table */}
      <div className="bg-[#112544] rounded-lg overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#0E2142]">
              <tr className="border-b border-[#2B416B]">
                <th className="text-left px-2 py-2 text-[#A7B8D8] font-semibold sticky left-0 bg-[#0E2142] z-10 min-w-[80px]">Ay</th>
                <th className="text-center px-1.5 py-2 text-[#A7B8D8] font-semibold text-[10px]">İkmal<br/>Bütçe</th>
                <th className="text-center px-1.5 py-2 text-[#A7B8D8] font-semibold text-[10px]">İkmal<br/>Gerçek</th>
                <th className="text-center px-1.5 py-2 text-[#A7B8D8] font-semibold text-[10px]">FLM<br/>Bütçe</th>
                <th className="text-center px-1.5 py-2 text-[#A7B8D8] font-semibold text-[10px]">FLM<br/>Gerçek</th>
                <th className="text-center px-1.5 py-2 text-[#A7B8D8] font-semibold text-[10px]">SLM<br/>Bütçe</th>
                <th className="text-center px-1.5 py-2 text-[#A7B8D8] font-semibold text-[10px]">SLM<br/>Gerçek</th>
                <th className="text-center px-1.5 py-2 text-[#A7B8D8] font-semibold text-[10px]">Para Top.<br/>Bütçe</th>
                <th className="text-center px-1.5 py-2 text-[#A7B8D8] font-semibold text-[10px]">Para Top.<br/>Gerçek</th>
                <th className="text-center px-1.5 py-2 text-[#A7B8D8] font-semibold text-[10px]">Top.+FLM<br/>Bütçe</th>
                <th className="text-center px-1.5 py-2 text-[#A7B8D8] font-semibold text-[10px]">Top.+FLM<br/>Gerçek</th>
                <th className="text-center px-1.5 py-2 text-[#A7B8D8] font-semibold text-[10px]">Top.+İkm.<br/>Bütçe</th>
                <th className="text-center px-1.5 py-2 text-[#A7B8D8] font-semibold text-[10px]">Top.+İkm.<br/>Gerçek</th>
                <th className="text-right px-2 py-2 text-[#A7B8D8] font-semibold text-[10px]">Bütçe ₺</th>
                <th className="text-right px-2 py-2 text-[#A7B8D8] font-semibold text-[10px]">Gerçek ₺</th>
                <th className="text-center px-2 py-2 text-[#A7B8D8] font-semibold text-[10px]">Tasarruf</th>
                <th className="text-center px-2 py-2 text-[#A7B8D8] font-semibold text-[10px] min-w-[200px]">Not / Risk Faktörü</th>
              </tr>
            </thead>
            <tbody>
              {/* OCAK 2026 - Geleneksel Yöntem */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#EF4444]/5">
                <td className="px-2 py-2 text-white font-semibold sticky left-0 bg-[#112544]">Ocak 🔴</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">199</td>
                <td className="text-center px-1.5 py-2 text-[#EF4444] font-semibold text-[11px]">199</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">6,944</td>
                <td className="text-center px-1.5 py-2 text-[#EF4444] font-semibold text-[11px]">6,944</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">2,280</td>
                <td className="text-center px-1.5 py-2 text-[#EF4444] font-semibold text-[11px]">2,280</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">26,491</td>
                <td className="text-center px-1.5 py-2 text-[#EF4444] font-semibold text-[11px]">26,491</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,096</td>
                <td className="text-center px-1.5 py-2 text-[#EF4444] font-semibold text-[11px]">7,096</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">3,324</td>
                <td className="text-center px-1.5 py-2 text-[#EF4444] font-semibold text-[11px]">3,324</td>
                <td className="text-right px-2 py-2 text-white text-[11px]">₺104.2M</td>
                <td className="text-right px-2 py-2 text-[#EF4444] font-semibold text-[11px]">₺104.2M</td>
                <td className="text-center px-2 py-2">
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EF4444]/20 text-[#EF4444]">
                    ₺0.0M (0.0%)
                  </span>
                </td>
                <td className="text-center px-2 py-2 text-[10px] text-[#EF4444]/80">❌ AI YOK - Geleneksel + Kış + ❄️ SOĞUK/KAR + 🏙️ BÜYÜK ŞEHİR YOĞUNLUK (yazlıklar durgun) + YILBAŞI SONRASI</td>
              </tr>

              {/* ŞUBAT 2026 - Geleneksel Yöntem */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#F59E0B]/5">
                <td className="px-2 py-2 text-white font-semibold sticky left-0 bg-[#112544]">Şubat 🟡</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">197</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] font-semibold text-[11px]">197</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,005</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] font-semibold text-[11px]">7,005</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">2,289</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] font-semibold text-[11px]">2,289</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">26,595</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] font-semibold text-[11px]">26,595</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,153</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] font-semibold text-[11px]">7,153</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">3,243</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] font-semibold text-[11px]">3,243</td>
                <td className="text-right px-2 py-2 text-white text-[11px]">₺104.2M</td>
                <td className="text-right px-2 py-2 text-[#F59E0B] font-semibold text-[11px]">₺104.2M</td>
                <td className="text-center px-2 py-2">
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F59E0B]/20 text-[#F59E0B]">
                    ₺0.0M (0.0%)
                  </span>
                </td>
                <td className="text-center px-2 py-2 text-[10px] text-[#F59E0B]/80">🔶 AI YOK - Kısa ay (28 gün) + ❄️ Kış devam + YARIYIL TATİLİ ⛷️ Kayak bölge ATM spike (Uludag/Palandoken)</td>
              </tr>

              {/* MART 2026 - Pilot Test */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#3B82F6]/5">
                <td className="px-2 py-2 text-white font-semibold sticky left-0 bg-[#112544]">Mart (Pilot) 🔵</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">195</td>
                <td className="text-center px-1.5 py-2 text-[#3B82F6] text-[11px]">179</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,049</td>
                <td className="text-center px-1.5 py-2 text-[#3B82F6] text-[11px]">6,478</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">2,289</td>
                <td className="text-center px-1.5 py-2 text-[#3B82F6] text-[11px]">2,106</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">26,951</td>
                <td className="text-center px-1.5 py-2 text-[#3B82F6] text-[11px]">24,795</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,175</td>
                <td className="text-center px-1.5 py-2 text-[#3B82F6] text-[11px]">6,597</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">3,194</td>
                <td className="text-center px-1.5 py-2 text-[#3B82F6] text-[11px]">2,938</td>
                <td className="text-right px-2 py-2 text-white text-[11px]">₺104.2M</td>
                <td className="text-right px-2 py-2 text-[#3B82F6] text-[11px]">₺96.0M</td>
                <td className="text-center px-2 py-2">
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#3B82F6]/20 text-[#3B82F6]">
                    -₺8.2M (-7.9%)
                  </span>
                </td>
                <td className="text-center px-2 py-2 text-[10px] text-[#3B82F6]/80">🔷 AI Pilot Test BAŞLADI + RAMAZAN AYI (1 Mart başlıyor) 🌙 + RAMAZAN BAYRAMI (30 Mar-1 Nis) Arefe yoğunluğu</td>
              </tr>

              {/* NİSAN 2026 - AI Başlıyor */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#10B981]/5">
                <td className="px-2 py-2 text-white font-semibold sticky left-0 bg-[#112544]">Nisan 🟢</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">192</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">157</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,040</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">5,763</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">2,291</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">1,876</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">27,179</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">22,257</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,189</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">5,889</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">3,165</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">2,592</td>
                <td className="text-right px-2 py-2 text-white text-[11px]">₺104.2M</td>
                <td className="text-right px-2 py-2 text-[#10B981] text-[11px]">₺85.3M</td>
                <td className="text-center px-2 py-2">
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/20 text-[#10B981]">
                    -₺18.9M (-18.1%)
                  </span>
                </td>
                <td className="text-center px-2 py-2 text-[10px] text-[#10B981]/80">✅ AI TAM DEVREDE - İlk ay + RAMAZAN BAYRAMI (30 Mart-1 Nis) dönüşü + 23 NİSAN TATİL 🎉 + BAHAR</td>
              </tr>

              {/* MAYIS 2026 */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#10B981]/5">
                <td className="px-2 py-2 text-white font-semibold sticky left-0 bg-[#112544]">Mayıs 🟢</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">196</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">160</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,109</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">5,820</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">2,316</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">1,897</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">27,343</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">22,391</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,243</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">5,933</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">3,245</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">2,658</td>
                <td className="text-right px-2 py-2 text-white text-[11px]">₺104.2M</td>
                <td className="text-right px-2 py-2 text-[#10B981] text-[11px]">₺85.3M</td>
                <td className="text-center px-2 py-2">
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/20 text-[#10B981]">
                    -₺18.9M (-18.1%)
                  </span>
                </td>
                <td className="text-center px-2 py-2 text-[10px] text-[#10B981]/80">✅ AI öğreniyor + 1 MAYIS + 19 MAYIS TATİL + 🐑 KURBAN BAYRAMI (27-31 MAYIS) AREFE MAX! 🎊 + YAZ BAŞLANGIÇ</td>
              </tr>

              {/* HAZİRAN 2026 */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#10B981]/5">
                <td className="px-2 py-2 text-white font-semibold sticky left-0 bg-[#112544]">Haziran 🟢</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">199</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">163</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,156</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">5,858</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">2,322</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">1,902</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">27,359</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">22,408</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,327</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">6,000</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">3,322</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">2,721</td>
                <td className="text-right px-2 py-2 text-white text-[11px]">₺104.2M</td>
                <td className="text-right px-2 py-2 text-[#10B981] text-[11px]">₺85.3M</td>
                <td className="text-center px-2 py-2">
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/20 text-[#10B981]">
                    -₺18.9M (-18.1%)
                  </span>
                </td>
                <td className="text-center px-2 py-2 text-[10px] text-[#10B981]/80">✅ Bayram sonrası normale dönüş + 🏖️ OKUL TATİLİ TAM DEVREDE! Yazlık/sahil ATM spike + YAZ ZİRVESİ YAKLAŞIYOR</td>
              </tr>

              {/* TEMMUZ 2026 */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#10B981]/5">
                <td className="px-2 py-2 text-white font-semibold sticky left-0 bg-[#112544]">Temmuz 🟢</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">205</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">168</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,221</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">5,915</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">2,362</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">1,935</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">27,592</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">22,599</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,375</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">6,041</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">3,392</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">2,779</td>
                <td className="text-right px-2 py-2 text-white text-[11px]">₺104.2M</td>
                <td className="text-right px-2 py-2 text-[#10B981] text-[11px]">₺85.3M</td>
                <td className="text-center px-2 py-2">
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/20 text-[#10B981]">
                    -₺18.9M (-18.1%)
                  </span>
                </td>
                <td className="text-center px-2 py-2 text-[10px] text-[#10B981]/80">✅ YAZ ZİRVESİ + AI peak + 🌡️ SICAK (38-42°C) + 🏖️ YAZLIK/SAHİL ATM PATLAMA (+200-400% işlem) + ⚠️ KAYIŞ ERİMESİ RİSKİ</td>
              </tr>

              {/* AĞUSTOS 2026 */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#F59E0B]/5">
                <td className="px-2 py-2 text-white font-semibold sticky left-0 bg-[#112544]">Ağustos 🟡</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">206</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] text-[11px]">177</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,277</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] text-[11px]">6,253</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">2,380</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] text-[11px]">2,045</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">27,811</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] text-[11px]">23,896</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,432</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] text-[11px]">6,388</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">3,413</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] text-[11px]">2,933</td>
                <td className="text-right px-2 py-2 text-white text-[11px]">₺104.2M</td>
                <td className="text-right px-2 py-2 text-[#F59E0B] text-[11px]">₺89.5M</td>
                <td className="text-center px-2 py-2">
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F59E0B]/20 text-[#F59E0B]">
                    -₺14.7M (-14.1%)
                  </span>
                </td>
                <td className="text-center px-2 py-2 text-[10px] text-[#F59E0B]/70">🔶 30 AĞUSTOS ZAFER BAYRAMI 🏆 + 🌡️ MAX Sıcak (45°C+) + 🏝️ YAZLIK ZİRVE (Bodrum/Antalya/Çeşme) ⚠️ EYLÜL'E GEÇİŞ</td>
              </tr>

              {/* EYLÜL 2026 */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#10B981]/5">
                <td className="px-2 py-2 text-white font-semibold sticky left-0 bg-[#112544]">Eylül 🟢</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">207</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">170</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,333</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">6,003</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">2,397</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">1,963</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">28,030</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">22,945</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,490</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">6,135</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">3,433</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">2,811</td>
                <td className="text-right px-2 py-2 text-white text-[11px]">₺104.2M</td>
                <td className="text-right px-2 py-2 text-[#10B981] text-[11px]">₺85.3M</td>
                <td className="text-center px-2 py-2">
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/20 text-[#10B981]">
                    -₺18.9M (-18.1%)
                  </span>
                </td>
                <td className="text-center px-2 py-2 text-[10px] text-[#10B981]/80">✅ Sonbahar + 🏫 OKUL AÇILDI (15 Eyl) Şehre dönüş başladı, yazlık ATM düşüş + AI mevsim geçişi optimizasyonu</td>
              </tr>

              {/* EKİM 2026 */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#10B981]/5">
                <td className="px-2 py-2 text-white font-semibold sticky left-0 bg-[#112544]">Ekim 🟢</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">209</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">171</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,390</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">6,050</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">2,415</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">1,978</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">28,251</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">23,126</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,547</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">6,182</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">3,453</td>
                <td className="text-center px-1.5 py-2 text-[#10B981] text-[11px]">2,827</td>
                <td className="text-right px-2 py-2 text-white text-[11px]">₺104.2M</td>
                <td className="text-right px-2 py-2 text-[#10B981] text-[11px]">₺85.3M</td>
                <td className="text-center px-2 py-2">
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/20 text-[#10B981]">
                    -₺18.9M (-18.1%)
                  </span>
                </td>
                <td className="text-center px-2 py-2 text-[10px] text-[#10B981]/80">✅ AI full performans + 29 EKİM CUMHURİYET BAYRAMI 🇹🇷 (Köprü 5 gün olursa tatil yoğunluğu)</td>
              </tr>

              {/* KASIM 2026 */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#F59E0B]/5">
                <td className="px-2 py-2 text-white font-semibold sticky left-0 bg-[#112544]">Kasım 🟡</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">209</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] text-[11px]">180</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,433</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] text-[11px]">6,388</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">2,428</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] text-[11px]">2,088</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">28,423</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] text-[11px]">24,443</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,591</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] text-[11px]">6,527</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">3,466</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] text-[11px]">2,979</td>
                <td className="text-right px-2 py-2 text-white text-[11px]">₺104.2M</td>
                <td className="text-right px-2 py-2 text-[#F59E0B] text-[11px]">₺89.5M</td>
                <td className="text-center px-2 py-2">
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F59E0B]/20 text-[#F59E0B]">
                    -₺14.7M (-14.1%)
                  </span>
                </td>
                <td className="text-center px-2 py-2 text-[10px] text-[#F59E0B]/70">🔶 Kış arızaları başlıyor + 🏙️ TAM ŞEHİR YOĞUNLUK (yazlıklar kapalı), büyük şehir ATM spike + SOĞUK</td>
              </tr>

              {/* ARALIK 2026 */}
              <tr className="border-b border-[#2B416B] hover:bg-[#0E2142]/40 bg-[#F59E0B]/5">
                <td className="px-2 py-2 text-white font-semibold sticky left-0 bg-[#112544]">Aralık 🟡</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">209</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] text-[11px]">180</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,449</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] text-[11px]">6,401</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">2,432</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] text-[11px]">2,091</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">28,489</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] text-[11px]">24,500</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">7,606</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] text-[11px]">6,540</td>
                <td className="text-center px-1.5 py-2 text-white text-[11px]">3,466</td>
                <td className="text-center px-1.5 py-2 text-[#F59E0B] text-[11px]">2,979</td>
                <td className="text-right px-2 py-2 text-white text-[11px]">₺104.2M</td>
                <td className="text-right px-2 py-2 text-[#F59E0B] text-[11px]">₺89.5M</td>
                <td className="text-center px-2 py-2">
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F59E0B]/20 text-[#F59E0B]">
                    -₺14.8M (-11.1%)
                  </span>
                </td>
                <td className="text-center px-2 py-2 text-[10px] text-[#F59E0B]/70">🔶 YILBAŞI (31 Ara) 🎄 AREFE MAX ÇEKİM + ❄️ Kar/Soğuk arıza + YILSONU MAAŞ/İKRAMIYE</td>
              </tr>

              {/* TOTAL ROW - Gerçekçi */}
              <tr className="bg-[#0E2142] font-bold">
                <td className="px-2 py-2.5 text-white text-sm sticky left-0 bg-[#112544]">TOPLAM 2026 (Gerçekçi)</td>
                <td className="text-center px-1.5 py-2.5 text-white text-xs">2,423</td>
                <td className="text-center px-1.5 py-2.5 text-[#10B981] text-xs font-bold">2,068</td>
                <td className="text-center px-1.5 py-2.5 text-white text-xs">86,406</td>
                <td className="text-center px-1.5 py-2.5 text-[#10B981] text-xs font-bold">73,745</td>
                <td className="text-center px-1.5 py-2.5 text-white text-xs">28,201</td>
                <td className="text-center px-1.5 py-2.5 text-[#10B981] text-xs font-bold">24,052</td>
                <td className="text-center px-1.5 py-2.5 text-white text-xs">330,514</td>
                <td className="text-center px-1.5 py-2.5 text-[#10B981] text-xs font-bold">281,947</td>
                <td className="text-center px-1.5 py-2.5 text-white text-xs">87,224</td>
                <td className="text-center px-1.5 py-2.5 text-[#10B981] text-xs font-bold">74,443</td>
                <td className="text-center px-1.5 py-2.5 text-white text-xs">40,116</td>
                <td className="text-center px-1.5 py-2.5 text-[#10B981] text-xs font-bold">34,239</td>
                <td className="text-right px-2 py-2.5 text-white text-xs">₺1.25B</td>
                <td className="text-right px-2 py-2.5 text-[#10B981] text-xs font-bold">₺1.06B</td>
                <td className="text-center px-2 py-2.5">
                  <div className="flex flex-col gap-1">
                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[#10B981]/30 text-[#10B981] ring-2 ring-[#10B981]/50">
                      -₺187.5M (-15.0%) ✓
                    </span>
                    <span className="text-[9px] text-[#F59E0B]">Q1 AI yok, Q2-Q4 AI tam</span>
                  </div>
                </td>
                <td className="text-center px-2 py-2.5">
                  <div className="flex flex-col gap-1">
                    <span className="text-xl">🎯</span>
                    <span className="text-[9px] text-white/60">Konservatif</span>
                  </div>
                </td>
              </tr>

              {/* MOTOR HEDEF ROW - Nisan+ Ideal */}
              <tr className="bg-[#8B5CF6]/10 font-bold border-t-2 border-[#8B5CF6]/50">
                <td className="px-2 py-2.5 text-[#8B5CF6] text-sm sticky left-0 bg-[#112544]">MOTOR HEDEFİ (Nis+)</td>
                <td className="text-center px-1.5 py-2.5 text-white text-xs">2,423</td>
                <td className="text-center px-1.5 py-2.5 text-[#8B5CF6] text-xs font-bold">1,982</td>
                <td className="text-center px-1.5 py-2.5 text-white text-xs">86,406</td>
                <td className="text-center px-1.5 py-2.5 text-[#8B5CF6] text-xs font-bold">70,684</td>
                <td className="text-center px-1.5 py-2.5 text-white text-xs">28,201</td>
                <td className="text-center px-1.5 py-2.5 text-[#8B5CF6] text-xs font-bold">23,076</td>
                <td className="text-center px-1.5 py-2.5 text-white text-xs">330,514</td>
                <td className="text-center px-1.5 py-2.5 text-[#8B5CF6] text-xs font-bold">270,541</td>
                <td className="text-center px-1.5 py-2.5 text-white text-xs">87,224</td>
                <td className="text-center px-1.5 py-2.5 text-[#8B5CF6] text-xs font-bold">71,381</td>
                <td className="text-center px-1.5 py-2.5 text-white text-xs">40,116</td>
                <td className="text-center px-1.5 py-2.5 text-[#8B5CF6] text-xs font-bold">32,815</td>
                <td className="text-right px-2 py-2.5 text-white text-xs">₺1.25B</td>
                <td className="text-right px-2 py-2.5 text-[#8B5CF6] text-xs font-bold">₺1.02B</td>
                <td className="text-center px-2 py-2.5">
                  <div className="flex flex-col gap-1">
                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[#8B5CF6]/30 text-[#8B5CF6] ring-2 ring-[#8B5CF6]/50">
                      -₺228.0M (-18.2%) 🚀
                    </span>
                    <span className="text-[9px] text-[#8B5CF6]">Ocak'tan başlasaydı</span>
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
            %15.0 tasarruf bekleniyor (₺187.5M). Q1 (Oca-Şub-Mar) AI yok, manuel. Nisan'dan itibaren AI tam devrede. Mart pilot test.
          </div>
          <div className="text-xs text-[#10B981] font-semibold">
            ✅ %15 hedefi tam tutturuldu!
          </div>
        </div>

        <div className="bg-[#8B5CF6]/10 rounded-lg p-4 ring-1 ring-[#8B5CF6]/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🧠</span>
            <div className="text-sm font-bold text-white">Motor Hedefi</div>
          </div>
          <div className="text-xs text-white/80 mb-2">
            IronClad Engine %18.2 (₺228.0M) hedefliyor. Nisan-Aralık arası (9 ay) tam devrede. Ocak'tan başlasaydık bu rakam mümkündü. Motor asla değişmez.
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
            Q1 manuel çalıştık (0% tasarruf). Nisan'dan itibaren AI devrede (~%18 ortalama). Yıllık ortalama %15.0.
          </div>
          <div className="text-xs text-[#10B981] font-semibold">
            ✅ Hedef başarıyla tutturuldu!
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
            <div className="text-xl font-bold text-[#EF4444]">₺0.0M</div>
            <div className="text-xs text-[#EF4444]">%0.0</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-lg p-3">
            <div className="text-xs text-[#A7B8D8] mb-1">Yıl Sonu Hedef</div>
            <div className="text-xl font-bold text-[#10B981]">₺187.5M</div>
            <div className="text-xs text-[#10B981]">%15.0</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-lg p-3">
            <div className="text-xs text-[#A7B8D8] mb-1">Motor Hedefi</div>
            <div className="text-xl font-bold text-[#8B5CF6]">₺228.0M</div>
            <div className="text-xs text-[#8B5CF6]">%18.2</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-lg p-3">
            <div className="text-xs text-[#A7B8D8] mb-1">Durum</div>
            <div className="text-sm font-bold text-[#F59E0B]">AI Pilot</div>
            <div className="text-xs text-[#F59E0B]">Mart 2026</div>
          </div>
        </div>
      </div>

      {/* 🚚 KM BAZLI ATM MALİYET ANALİZİ */}
      <div className="bg-gradient-to-br from-[#112544] to-[#1a3a5f] rounded-2xl p-6 ring-2 ring-[#3B82F6]/30 mt-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xl font-bold text-white flex items-center gap-2">
              <span>🚚</span>
              <span>KM Bazlı ATM Maliyet Analizi</span>
            </div>
            <div className="text-sm text-[#A7B8D8] mt-1">
              Nakit merkezinden mesafeye göre gerçek operasyon maliyetleri (Toplam {grandTotals.totalAtms} ATM)
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-[#A7B8D8]">
            <div className="text-lg">CSV yükleniyor...</div>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-[#0E2142]/60 rounded-lg p-4 backdrop-blur-sm">
                <div className="text-xs text-[#A7B8D8] mb-1">Toplam ATM</div>
                <div className="text-2xl font-bold text-white">{grandTotals.totalAtms}</div>
                <div className="text-xs text-[#3B82F6] mt-1">Tüm nakit merkezleri</div>
              </div>
              <div className="bg-[#0E2142]/60 rounded-lg p-4 backdrop-blur-sm">
                <div className="text-xs text-[#A7B8D8] mb-1">Aylık Maliyet</div>
                <div className="text-2xl font-bold text-[#F59E0B]">
                  ₺{(grandTotals.totalMonthly / 1000).toFixed(1)}K
                </div>
                <div className="text-xs text-[#F59E0B] mt-1">Gerçek fiyatlar</div>
              </div>
              <div className="bg-[#0E2142]/60 rounded-lg p-4 backdrop-blur-sm">
                <div className="text-xs text-[#A7B8D8] mb-1">Yıllık Maliyet</div>
                <div className="text-2xl font-bold text-[#10B981]">
                  ₺{(grandTotals.totalYearly / 1000000).toFixed(2)}M
                </div>
                <div className="text-xs text-[#10B981] mt-1">12 aylık projeksiyon</div>
              </div>
              <div className="bg-[#0E2142]/60 rounded-lg p-4 backdrop-blur-sm">
                <div className="text-xs text-[#A7B8D8] mb-1">Ortalama KM</div>
                <div className="text-2xl font-bold text-[#8B5CF6]">
                  {grandTotals.avgKm.toFixed(0)}
                </div>
                <div className="text-xs text-[#8B5CF6] mt-1">Nakit merkezinden</div>
              </div>
            </div>

            {/* Nakit Merkezi Accordion Listesi */}
            <div className="space-y-3">
              {cashCenterStats.map((centerStat) => {
                const isExpanded = expandedCenters.has(centerStat.centerName);
                const centerATMs = atmsByCashCenter[centerStat.centerName] || [];

                return (
                  <div key={centerStat.centerName} className="bg-[#0E2142]/40 rounded-lg overflow-hidden">
                    {/* Nakit Merkezi Header */}
                    <button
                      onClick={() => toggleCenter(centerStat.centerName)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#0E2142]/60 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-lg">{isExpanded ? '▼' : '▶'}</span>
                        <div className="text-left">
                          <div className="text-lg font-bold text-white">{centerStat.centerName}</div>
                          <div className="text-sm text-[#A7B8D8]">
                            {centerStat.atmCount} ATM • {centerStat.minKm}-{centerStat.maxKm}km • Ort: {centerStat.avgKm.toFixed(0)}km
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-sm text-[#A7B8D8]">Aylık</div>
                          <div className="text-lg font-bold text-[#F59E0B]">₺{(centerStat.totalMonthly / 1000).toFixed(1)}K</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-[#A7B8D8]">Yıllık</div>
                          <div className="text-lg font-bold text-[#10B981]">₺{(centerStat.totalYearly / 1000000).toFixed(2)}M</div>
                        </div>
                      </div>
                    </button>

                    {/* Zone Grupları (Expanded) */}
                    {isExpanded && (
                      <div className="border-t border-[#2B416B] bg-[#0A1628]/40">
                        {/* Zone bazlı gruplama */}
                        {Object.entries(
                          centerATMs.reduce((acc: Record<number, ATMData[]>, atm: ATMData) => {
                            if (!acc[atm.zone]) acc[atm.zone] = [];
                            acc[atm.zone].push(atm);
                            return acc;
                          }, {})
                        )
                        .sort(([zoneA], [zoneB]) => Number(zoneA) - Number(zoneB))
                        .map(([zone, zoneATMs]) => {
                          const zoneKey = `${centerStat.centerName}-Z${zone}`;
                          const isZoneExpanded = expandedZones.has(zoneKey);
                          const zoneTotalMonthly = zoneATMs.reduce((sum: number, atm: ATMData) => sum + atm.totalMonthlyCost, 0);
                          const zoneAvgKm = zoneATMs.reduce((sum: number, atm: ATMData) => sum + atm.km, 0) / zoneATMs.length;

                          return (
                            <div key={zoneKey} className="border-b border-[#2B416B]/30">
                              {/* Zone Header */}
                              <button
                                onClick={() => toggleZone(centerStat.centerName, Number(zone))}
                                className="w-full px-6 py-3 flex items-center justify-between hover:bg-[#0E2142]/40 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-sm">{isZoneExpanded ? '▼' : '▶'}</span>
                                  <div className="text-left">
                                    <span className="px-2 py-1 bg-[#8B5CF6]/20 text-[#8B5CF6] text-sm rounded-full font-bold">
                                      Zone {zone}
                                    </span>
                                    <span className="ml-3 text-sm text-[#A7B8D8]">
                                      {zoneATMs.length} ATM • Ort: {zoneAvgKm.toFixed(0)}km
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm text-[#F59E0B] font-bold">
                                    ₺{(zoneTotalMonthly / 1000).toFixed(1)}K /ay
                                  </div>
                                </div>
                              </button>

                              {/* Zone ATM Tablosu */}
                              {isZoneExpanded && (
                                <div className="bg-[#0E2142]/20">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
              <thead className="bg-[#0E2142]">
                <tr className="border-b border-[#2B416B]">
                  <th className="text-left px-4 py-3 text-[#A7B8D8] font-semibold">ATM ID</th>
                  <th className="text-left px-4 py-3 text-[#A7B8D8] font-semibold">ATM Adı</th>
                  <th className="text-center px-4 py-3 text-[#A7B8D8] font-semibold">🚚 KM</th>
                  <th className="text-center px-4 py-3 text-[#A7B8D8] font-semibold">Hizmet</th>
                  <th className="text-right px-4 py-3 text-[#A7B8D8] font-semibold">Aylık</th>
                  <th className="text-right px-4 py-3 text-[#A7B8D8] font-semibold">Yıllık</th>
                  <th className="text-center px-4 py-3 text-[#A7B8D8] font-semibold">Detay</th>
                </tr>
              </thead>
              <tbody>
                {zoneATMs.map((atm: ATMData, idx: number) => (
                  <>
                    <tr 
                      key={atm.id}
                      className={`border-b border-[#2B416B]/50 hover:bg-[#0E2142]/60 cursor-pointer transition-colors ${
                        idx % 2 === 0 ? 'bg-[#0E2142]/20' : ''
                      }`}
                      onClick={() => setSelectedATM(selectedATM === atm.id ? null : atm.id)}
                    >
                      <td className="px-4 py-3 text-white font-mono text-xs">{atm.id}</td>
                      <td className="px-4 py-3 text-white">{atm.name}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${
                          atm.km < 50 ? 'text-[#10B981]' : 
                          atm.km < 100 ? 'text-[#F59E0B]' : 
                          'text-[#EF4444]'
                        }`}>
                          {atm.km} km
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-[#A7B8D8] text-xs">
                        {atm.serviceDays}
                      </td>
                      <td className="px-4 py-3 text-right text-[#F59E0B] font-bold">
                        ₺{atm.totalMonthlyCost.toLocaleString('tr-TR')}
                      </td>
                      <td className="px-4 py-3 text-right text-[#10B981] font-bold">
                        ₺{atm.totalYearlyCost.toLocaleString('tr-TR')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button className="text-[#3B82F6] hover:text-[#60A5FA] transition-colors">
                          {selectedATM === atm.id ? '▲' : '▼'}
                        </button>
                      </td>
                    </tr>
                    {selectedATM === atm.id && (
                      <tr className="bg-[#0E2142]/80">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid grid-cols-4 gap-3">
                            <div className="bg-[#112544]/60 rounded-lg p-3">
                              <div className="text-xs text-[#A7B8D8] mb-1">İkmal</div>
                              <div className="text-sm text-white font-bold">
                                {atm.operations.ikmal.monthly} × ₺{getPriceByKM(atm.km).toFixed(2)}
                              </div>
                              <div className="text-xs text-[#3B82F6] mt-1">
                                = ₺{atm.operations.ikmal.cost.toLocaleString('tr-TR')} /ay
                              </div>
                            </div>
                            <div className="bg-[#112544]/60 rounded-lg p-3">
                              <div className="text-xs text-[#A7B8D8] mb-1">FLM</div>
                              <div className="text-sm text-white font-bold">
                                {atm.operations.flm.monthly} × ₺{getPriceByKM(atm.km).toFixed(2)}
                              </div>
                              <div className="text-xs text-[#F59E0B] mt-1">
                                = ₺{atm.operations.flm.cost.toLocaleString('tr-TR')} /ay
                              </div>
                            </div>
                            <div className="bg-[#112544]/60 rounded-lg p-3">
                              <div className="text-xs text-[#A7B8D8] mb-1">SLM</div>
                              <div className="text-sm text-white font-bold">
                                {atm.operations.slm.monthly} × ₺{getSLMPrice(atm.km).toFixed(2)}
                              </div>
                              <div className="text-xs text-[#8B5CF6] mt-1">
                                = ₺{atm.operations.slm.cost.toLocaleString('tr-TR')} /ay
                              </div>
                            </div>
                            <div className="bg-[#112544]/60 rounded-lg p-3">
                              <div className="text-xs text-[#A7B8D8] mb-1">Para Toplama</div>
                              <div className="text-sm text-white font-bold">
                                {atm.operations.paraToplama.monthly} × ₺{getPriceByKM(atm.km).toFixed(2)}
                              </div>
                              <div className="text-xs text-[#10B981] mt-1">
                                = ₺{atm.operations.paraToplama.cost.toLocaleString('tr-TR')} /ay
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 p-3 bg-[#3B82F6]/10 rounded-lg border border-[#3B82F6]/30">
                            <div className="text-xs text-[#A7B8D8]">
                              💡 <span className="font-semibold">Maliyet Faktörü:</span> Bu ATM {atm.cashCenter} nakit merkezinden 
                              <span className="text-[#3B82F6] font-bold"> {atm.km} km</span> uzaklıkta. 
                              KM başına maliyet Zone {atm.zone} fiyatlandırmasına göre hesaplanıyor.
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

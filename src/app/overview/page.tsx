"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import KpiRow from "@/components/KpiRow";
import OverviewBottomStrip from "@/components/OverviewBottomStrip";
import { useTranslation } from "@/hooks/useTranslation";
import atmMasterData from "@/data/atm_master.json";

type MetricInfo = {
  title: string;
  description: string;
  purpose: string;
  interpretation: string;
};

const OVERVIEW_METRIC_EXPLANATIONS: Record<string, MetricInfo> = {
  "atm_uptime": {
    title: "ATM Uptime (Çalışma Süresi)",
    description: "ATM'lerin ne kadar süre kesintisiz çalıştığının yüzdesi. Toplam çalışma süresi / Toplam süre oranı.",
    purpose: "Müşteri memnuniyeti ve servis kalitesi ana göstergesi. ATM'ler ne kadar süre kullanılabilir durumda?",
    interpretation: "%98.7 = Mükemmel seviye. %95+ hedeflenir. Düşük uptime müşteri kaybına ve şikayet artışına neden olur."
  },
  "fault_notification_time": {
    title: "Ortalama Arıza Bildirim Süresi",
    description: "Arızanın oluşmasından operasyon ekibinin sistem üzerinden bildirimine kadar geçen ortalama süre (dakika).",
    purpose: "Operasyonel farkındalık hızı. Arızalar ne kadar sürede tespit ediliyor ve bildirim yapılıyor?",
    interpretation: "18 dakika = İyi performans. 15 dakika altı ideal. Düşük süre müdahale süresini kısaltır, downtime'ı azaltır. FLM bildirimleri için kritik metrik."
  },
  "avg_response": {
    title: "Ortalama Müdahale Süresi",
    description: "Arıza bildiriminden teknisyen müdahalesine kadar geçen ortalama süre (saat cinsinden).",
    purpose: "Operasyonel hız ve verimlilik göstergesi. Ne kadar hızlı tepki veriyoruz?",
    interpretation: "2.4 saat = İyi performans. 4 saat altı ideal, üzeri gecikme riski. Düşük süre downtime'ı azaltır."
  },
  "flm_success": {
    title: "FLM Başarı Oranı",
    description: "First Level Maintenance müdahalelerinde sorunun ilk seferde çözülme oranı.",
    purpose: "Bantaş ve şube personeli müdahale kalitesi. İlk müdahalede sorun çözüldü mü, SLM'ye (uzman teknisyen) gerek kaldı mı?",
    interpretation: "%87 = Çok iyi. %80+ hedeflenir. Düşük oran yanlış tanı, personel eğitim eksikliği veya yedek parça sorununu gösterebilir."
  },
  "cost_saving": {
    title: "Aylık Tasarruf",
    description: "Proaktif bakım ve önleyici aksiyonlar sayesinde bu ay sağlanan toplam maliyet tasarrufu (USD).",
    purpose: "Projenin finansal etkisini ölçmek. Sistem kaç dolar tasarruf sağlıyor?",
    interpretation: "$47K = Mükemmel. Gereksiz SLM, yanlış part değişimi, downtime maliyetleri önlendi. Pozitif ROI göstergesi."
  },
  "preventive_maintenance": {
    title: "Önleyici Bakım Sayısı",
    description: "Bu ay gerçekleştirilen proaktif bakım müdahale sayısı. Arıza olmadan önce yapılan bakımlar.",
    purpose: "Sistemin proaktif çalışma kapasitesi. Kaç arızayı önceden tahmin edip önleyebildik?",
    interpretation: "156 = Yüksek aktivite. Sistem aktif şekilde risk tespit ediyor. Yüksek sayı modelin etkili çalıştığını gösterir."
  },
  "avg_downtime": {
    title: "Ortalama Downtime (Kesinti Süresi)",
    description: "ATM'lerin arızalı/kullanılamaz durumda kaldığı ortalama süre (saat).",
    purpose: "Müşteri deneyimi ve gelir kaybı göstergesi. ATM ne kadar süre devre dışı kalıyor?",
    interpretation: "3.2 saat = Kabul edilebilir ama iyileştirilebilir. 2 saat altı ideal. Yüksek downtime müşteri kaybı ve gelir düşüşü demek."
  },
  "sla_breach_risk": {
    title: "SLA Breach Risk (SLA İhlal Riski)",
    description: "Servis Seviyesi Anlaşması (SLA) ihlal riski taşıyan ticket'ların risk seviyesine göre dağılımı.",
    purpose: "SLA taahhütlerini karşılayamama riskini ölçmek. Hangi ticket'lar SLA sürelerini aşmak üzere?",
    interpretation: "Low/Medium/High dağılımı. High %30+ ise UYARI! Müdahale süresi yetersiz, ekip kapasitesi arttırılmalı veya önceliklendirme yapılmalı. SLA ihlali ceza ve itibar kaybına neden olur."
  },
  "atm_risk_map": {
    title: "ATM Risk Haritası",
    description: "Türkiye haritası üzerinde tüm ATM'lerin risk seviyesine göre görselleştirilmesi. Her nokta bir ATM'yi temsil eder.",
    purpose: "Coğrafi risk dağılımını görmek. Hangi bölgelerde risk yoğunlaşması var? Saha ekipleri nereye yönlendirilmeli?",
    interpretation: "Kırmızı = Yüksek risk (SLM gerekli), Sarı = Orta risk (FLM öneriliyor), Yeşil = Düşük risk (izleme). Kümelenme görülen bölgelere özel operasyonel plan yapılmalı."
  }
};



const OverviewMap = dynamic(() => import("@/components/OverviewMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-[#A7B8D8]">Loading map...</div>
    </div>
  ),
});

type ATM = {
  atm_id: string;
  atm_name?: string;
  city: string;
  district: string;
  zone?: string | number;
  latitude: number;
  longitude: number;
  active?: boolean;
  location_type?: string;
  brand?: string;
};

type Top10Item = {
  atm_id: string | number;
  atm_name: string;
  city: string;
  district: string;
  slm_prob: number;
  risk_band: "High" | "Medium" | "Low";
  expected_saving_try: number;
  reason: string;
  flm_count_48h?: number;
  flm_count_7d?: number;
  last_slm_days_ago?: number;
  repeat_issue?: boolean;
  repeat_reason?: string;
  availability?: number;
};

type ZoneItem = { zone: string; risk: number };

type Alert = {
  id: number;
  atm_id: string;
  atm_name: string;
  city: string;
  district: string;
  title: string;
  summary: string;
  severity: "High" | "Medium" | "Low";
  action: string;
  eta: string;
  status?: "pending" | "slm_opened" | "scheduled_maintenance" | "rejected";
  flm_count_48h?: number;
  flm_count_7d?: number;
  last_slm_days_ago?: number;
  last_solution?: string;
  repeat_issue?: boolean;
  decision_by?: string;
  decision_at?: string;
  availability?: number;
};

export default function OverviewPage() {
  const { t } = useTranslation();
  const [atms, setAtms] = useState<ATM[]>([]);
  const [top10, setTop10] = useState<Top10Item[]>([]);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showOutliers, setShowOutliers] = useState(false);
  const [showZones, setShowZones] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [showAiRecommendations, setShowAiRecommendations] = useState(false);
  const [showOffsiteCritical, setShowOffsiteCritical] = useState(false);
  const [showPreventiveMaintenance, setShowPreventiveMaintenance] = useState(false);
  const [selectedBands, setSelectedBands] = useState<("High" | "Medium" | "Low")[]>(
    ["High", "Medium", "Low"]
  );
  
  // AI Performance Engine - Manuel Learning
  const [aiPerformanceMode, setAiPerformanceMode] = useState<'auto' | 'manual'>('auto');
  const [manualFlmThreshold, setManualFlmThreshold] = useState('');
  const [manualSlmRisk, setManualSlmRisk] = useState('');
  const [manualLearningNote, setManualLearningNote] = useState('');
  
  // Arıza Tahminleme Performansı tarih aralığı
  const [breakdownStartDate, setBreakdownStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Son 30 gün
    return date.toISOString().split('T')[0];
  });
  const [breakdownEndDate, setBreakdownEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  // Maliyet Etkisi tarih aralığı
  const [costImpactStartDate, setCostImpactStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Son 30 gün
    return date.toISOString().split('T')[0];
  });
  const [costImpactEndDate, setCostImpactEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  // ATM Risk Haritası tarih aralığı
  const [riskMapStartDate, setRiskMapStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // Son 7 gün
    return date.toISOString().split('T')[0];
  });
  const [riskMapEndDate, setRiskMapEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  // ATM Lokasyon Filtresi (Şube/Offsite)
  const [atmLocationFilter, setAtmLocationFilter] = useState<'all' | 'branch' | 'offsite'>('all');
  
  // Performans Metrikleri tarih aralığı
  const [perfStartDate, setPerfStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Son 30 gün
    return date.toISOString().split('T')[0];
  });
  const [perfEndDate, setPerfEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  // Günlük özet detay modal
  const [showDailySummaryDetail, setShowDailySummaryDetail] = useState<'total' | 'flm' | 'slm' | 'saving' | null>(null);
  
  // Günlük özet tarih aralığı
  const [dailyStartDate, setDailyStartDate] = useState(() => {
    return new Date().toISOString().split('T')[0]; // Bugün
  });
  const [dailyEndDate, setDailyEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]; // Bugün
  });
  
  // Alert detay modal
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  
  // Active Alerts tarih aralığı
  const [alertsStartDate, setAlertsStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // Son 7 gün
    return date.toISOString().split('T')[0];
  });
  const [alertsEndDate, setAlertsEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  // Vendor Breakdown tarih aralığı
  const [vendorStartDate, setVendorStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Son 30 gün
    return date.toISOString().split('T')[0];
  });
  const [vendorEndDate, setVendorEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  // Availability Trend tarih aralığı
  const [availTrendStartDate, setAvailTrendStartDate] = useState(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1); // 1 yıl önce (2025 Ocak)
    date.setMonth(0); // Ocak
    date.setDate(1); // Ayın ilk günü
    return date.toISOString().split('T')[0];
  });
  const [availTrendEndDate, setAvailTrendEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  // Availability Trend filtreleri
  const [availTrendLocationType, setAvailTrendLocationType] = useState<'all' | 'Şube' | 'Offsite'>('all');
  const [availTrendVendor, setAvailTrendVendor] = useState<'all' | 'GRG' | 'HITACHI'>('all');
  const [availTrendRegion, setAvailTrendRegion] = useState<string>('all');
  const [availTrendCity, setAvailTrendCity] = useState<string>('all');
  const [availTrendBranch, setAvailTrendBranch] = useState<string>('all');
  const [availTrendCashCenter, setAvailTrendCashCenter] = useState<string>('all');
  
  // Availability chart tooltip
  const [chartTooltip, setChartTooltip] = useState<{ x: number; y: number; data: { month: string; genel: string; cekme: string; yatirma: string } } | null>(null);
  
  // Info modal for metrics
  const [infoModal, setInfoModal] = useState<MetricInfo | null>(null);
  
  // Tam ekran harita modal
  const [fullscreenMap, setFullscreenMap] = useState(false);
  
  // Top 10 Risky ATMs tarih aralığı
  const [top10StartDate, setTop10StartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Son 30 gün
    return date.toISOString().split('T')[0];
  });
  const [top10EndDate, setTop10EndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Top10 explicit 6-column template to avoid overlap: id, name, city, slm, risk, gain
  // Use minmax for name/city columns so truncation works reliably on narrow screens
  const top10GridTemplate = "60px 1.8fr 1.8fr 50px 50px 60px";
  
  // Exchange rate: TRY per 1 USD
  const TRY_PER_USD = 36;
  
  // Önleyici bakım için ATM listesi (SLM olasılığı %40-70 arası - henüz kritik değil ama risk var)
  const preventiveMaintenanceAtms = useMemo(() => {
    const filtered = top10.filter(r => {
      const pct = Math.round(r.slm_prob * 100);
      return pct >= 40 && pct <= 70;
    });
    // Eğer hiç yoksa top10'dan ilk 3'ü göster
    return filtered.length > 0 ? filtered : top10.slice(0, 3);
  }, [top10]);

  useEffect(() => {
    fetch("/api/atm-master", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const parsedAtms = (d.atms || []).map((a: any) => ({
          ...a,
          latitude: typeof a.latitude === 'string' 
            ? parseFloat(a.latitude.replace(',', '.')) 
            : a.latitude,
          longitude: typeof a.longitude === 'string' 
            ? parseFloat(a.longitude.replace(',', '.')) 
            : a.longitude,
        }));
        setAtms(parsedAtms);
      })
      .catch(() => setAtms([]));

    fetch("/api/overview-top10", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        // FLM ve SLM analiz verilerini ekle
        const itemsWithAnalysis = (d.items || []).map((item: Top10Item, index: number) => ({
          ...item,
          flm_count_48h: [2, 3, 1, 2, 1, 0, 2, 1, 3, 1][index] || 0,
          flm_count_7d: [5, 6, 3, 4, 2, 2, 5, 3, 7, 2][index] || 0,
          last_slm_days_ago: [25, 120, 45, 180, 30, 90, 15, 150, 95, 60][index] || 30,
          repeat_issue: ([2, 3, 1, 2, 1, 0, 2, 1, 3, 1][index] || 0) > 1,
          repeat_reason: ([2, 3, 1, 2, 1, 0, 2, 1, 3, 1][index] || 0) > 1 ? [
            "CCDM jam 48 saatte 2 kez",
            "Kart okuyucu 3 kez arıza",
            "Receipt printer sürekli",
            "Dispenser hatası tekrarlı",
            "Sensor arızası",
            "",
            "EPP reset etkisiz",
            "",
            "Network modülü sorunlu",
            ""
          ][index] : undefined
        }));
        setTop10(itemsWithAnalysis);
      })
      .catch(() => setTop10([]));

    fetch("/api/overview-zones", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setZones(d.zones || []))
      .catch(() => setZones([]));
    
    fetch("/api/command-center", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAlerts(d.alerts || []))
      .catch(() => setAlerts([]));
    
    fetch("/api/command-center", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAlerts(d.alerts || []))
      .catch(() => setAlerts([]));
  }, []);

  const center = useMemo<[number, number]>(() => {
    // Türkiye merkezi koordinatları
    return [39.0, 35.5];
  }, []);

  const top10Band = useMemo(() => {
    const m = new Map<string, "High" | "Medium" | "Low">();
    top10.forEach((t) => m.set(String(t.atm_id), t.risk_band));
    return m;
  }, [top10]);

  const top10Data = useMemo(() => {
    const m = new Map<string, { risk_band: "High" | "Medium" | "Low"; availability: number | undefined }>();
    top10.forEach((t) => m.set(String(t.atm_id), { risk_band: t.risk_band, availability: t.availability }));
    return m;
  }, [top10]);

  const filteredAtms = useMemo(() => {
    return atms.filter((a) => {
      const band = top10Band.get(String(a.atm_id)) ?? "Low";
      const bandMatch = selectedBands.includes(band);
      
      // Zone filtresi - eğer zone seçiliyse
      const zoneMatch = selectedZone ? String(a.zone) === selectedZone : true;
      
      // Lokasyon filtresi (Şube/Offsite)
      const locationMatch = atmLocationFilter === 'all' 
        ? true 
        : atmLocationFilter === 'branch'
        ? a.location_type?.toLowerCase() === 'branch' || a.location_type?.toLowerCase() === 'şube'
        : a.location_type?.toLowerCase() === 'offsite' || a.location_type?.toLowerCase() === 'off-site';
      
      return bandMatch && zoneMatch && locationMatch;
    });
  }, [atms, top10Band, selectedBands, selectedZone, atmLocationFilter]);

  const toggleBand = (band: "High" | "Medium" | "Low") => {
    setSelectedBands((prev) => {
      if (prev.includes(band)) {
        return prev.filter((b) => b !== band);
      } else {
        return [...prev, band];
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Info Modal */}
      {infoModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={() => setInfoModal(null)}
        >
          <div 
            className="bg-[#112544] rounded-2xl p-6 max-w-2xl w-full ring-2 ring-[#2E86FF] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">{infoModal.title}</h3>
              <button
                onClick={() => setInfoModal(null)}
                className="text-[#A7B8D8] hover:text-white transition text-2xl leading-none"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-[#2E86FF] font-semibold mb-1">📊 Tanım</div>
                <div className="text-[#A7B8D8] leading-relaxed">{infoModal.description}</div>
              </div>
              
              <div>
                <div className="text-[#10B981] font-semibold mb-1">🎯 Amaç</div>
                <div className="text-[#A7B8D8] leading-relaxed">{infoModal.purpose}</div>
              </div>
              
              <div>
                <div className="text-[#F2B705] font-semibold mb-1">💡 Yorumlama</div>
                <div className="text-[#A7B8D8] leading-relaxed">{infoModal.interpretation}</div>
              </div>
            </div>
            
            <button
              onClick={() => setInfoModal(null)}
              className="mt-6 w-full py-2 bg-[#2E86FF] hover:bg-[#1E5FCC] text-white rounded-lg font-semibold transition"
            >
              Anladım
            </button>
          </div>
        </div>
      )}

      <KpiRow />

      {/* AI PERFORMANCE & BREAKDOWN ENGINE */}
      <div className="bg-gradient-to-br from-[#1A2F52] via-[#112544] to-[#0E2142] rounded-2xl p-6 ring-1 ring-[#8B1874]/50 shadow-lg shadow-[#8B1874]/10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8B1874] to-[#5D1049] flex items-center justify-center shadow-lg shadow-[#8B1874]/30 relative overflow-visible">
              <span className="text-3xl">📊</span>
              <span className="absolute -top-1 -right-1 z-10">
                <span className="text-xl">⚡</span>
              </span>
              <span className="absolute -bottom-1 -left-1 z-10">
                <span className="text-sm">🎯</span>
              </span>
            </div>
            <div>
              <div className="text-xl font-bold text-white flex items-center gap-3">
                AI Performance & Breakdown Engine
                <div className="px-3 py-1 rounded-full bg-[#10B981]/20 text-[#10B981] text-xs font-semibold flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></div>
                  ON
                </div>
              </div>
              <div className="text-sm text-[#A7B8D8] mt-1">Yapay Zeka ile Arıza Tahmini ve Performans Optimizasyonu</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          {/* Tahmin Doğruluğu */}
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#8B5CF6]/30">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-[#A7B8D8]">Tahmin Doğruluğu</div>
              <div className="w-6 h-6 rounded-full bg-[#10B981]/20 flex items-center justify-center text-xs">✓</div>
            </div>
            <div className="text-3xl font-bold text-[#10B981] mb-1">91.3%</div>
            <div className="text-xs text-[#10B981]">↑ 3.2% bu ay</div>
          </div>

          {/* Çalışma Modu */}
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2E86FF]/30">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-[#A7B8D8]">Çalışma Modu</div>
              <div className="w-6 h-6 rounded-full bg-[#2E86FF]/20 flex items-center justify-center text-xs">⚡</div>
            </div>
            <select
              value={aiPerformanceMode}
              onChange={(e) => setAiPerformanceMode(e.target.value as 'auto' | 'manual')}
              className="w-full bg-[#112544] text-white text-sm font-bold px-2 py-1 rounded border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
            >
              <option value="auto">🤖 Otomatik</option>
              <option value="manual">👤 Manuel</option>
            </select>
            <div className="text-xs text-[#A7B8D8] mt-1">Sürekli Öğrenen</div>
          </div>

          {/* Son Güncelleme */}
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#F2B705]/30">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-[#A7B8D8]">Son Güncelleme</div>
              <div className="w-6 h-6 rounded-full bg-[#F2B705]/20 flex items-center justify-center text-xs">🕐</div>
            </div>
            <div className="text-lg font-bold text-[#F2B705] mb-1">2 dk önce</div>
            <div className="text-xs text-[#10B981]">Real-time</div>
          </div>

          {/* Aktif Tahmin */}
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#EF4444]/30">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-[#A7B8D8]">Aktif Tahminler</div>
              <div className="w-6 h-6 rounded-full bg-[#EF4444]/20 flex items-center justify-center text-xs">🎯</div>
            </div>
            <div className="text-3xl font-bold text-[#EF4444] mb-1">47</div>
            <div className="text-xs text-[#A7B8D8]">Son 24 saat</div>
          </div>
        </div>

        {/* Manuel Learning Input - Only shown in Manual mode */}
        {aiPerformanceMode === "manual" && (
          <div className="bg-gradient-to-r from-[#F2B705]/20 to-[#F59E0B]/10 rounded-xl p-5 ring-1 ring-[#F2B705]/50 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">⚙️</span>
              <div>
                <div className="text-sm font-semibold text-white">Manuel Bilgi Girişi - AI Öğrenme Sistemi</div>
                <div className="text-xs text-[#A7B8D8]">Yeni FLM/SLM pattern'leri ve arıza bilgilerini motora öğretin</div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-[#A7B8D8] mb-2 block">FLM Müdahale Eşiği (saat)</label>
                <input
                  type="number"
                  value={manualFlmThreshold}
                  onChange={(e) => setManualFlmThreshold(e.target.value)}
                  placeholder="2.5"
                  className="w-full px-3 py-2 bg-[#112544] text-white text-sm rounded-lg border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#F2B705]"
                />
                <div className="text-xs text-white/60 mt-1">Örn: 2.0, 2.5, 3.0 saat</div>
              </div>
              <div>
                <label className="text-xs text-[#A7B8D8] mb-2 block">SLM Risk Yüzdesi (%)</label>
                <input
                  type="number"
                  value={manualSlmRisk}
                  onChange={(e) => setManualSlmRisk(e.target.value)}
                  placeholder="75"
                  className="w-full px-3 py-2 bg-[#112544] text-white text-sm rounded-lg border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#F2B705]"
                />
                <div className="text-xs text-white/60 mt-1">Kritik risk seviyesi %70-90</div>
              </div>
              <div>
                <label className="text-xs text-[#A7B8D8] mb-2 block">Arıza Tipi/Sebep</label>
                <select
                  className="w-full px-3 py-2 bg-[#112544] text-white text-sm rounded-lg border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#F2B705]"
                >
                  <option value="">Seçiniz...</option>
                  <option value="dispenser">Dispenser Arızası</option>
                  <option value="card_reader">Kart Okuyucu</option>
                  <option value="network">Network/Bağlantı</option>
                  <option value="power">Elektrik Kesintisi</option>
                  <option value="jam">Para Sıkışması (Jam)</option>
                  <option value="sensor">Sensör Hatası</option>
                  <option value="software">Yazılım Hatası</option>
                  <option value="other">Diğer/Genel</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="text-xs text-[#A7B8D8] mb-2 block">Öğrenme Notu / Context (AI için)</label>
              <textarea
                value={manualLearningNote}
                onChange={(e) => setManualLearningNote(e.target.value)}
                placeholder="Örn: Kış mevsiminde dispenser arızaları artıyor - soğuk hava kartları sertleştiriyor. FLM eşiğini 2 saate düşür..."
                rows={3}
                className="w-full px-3 py-2 bg-[#112544] text-white text-sm rounded-lg border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#F2B705] resize-none"
              />
              <div className="text-xs text-white/60 mt-1">
                Pattern, mevsimsel faktörler, bölgesel özellikler vb. - AI bu bilgiyi işleyip gelecek tahminlerinde kullanacak
              </div>
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="text-xs text-[#A7B8D8]">
                💡 Bu bilgiler IronClad Engine tarafından analiz edilip incremental learning ile modele entegre edilecek
              </div>
              <button
                onClick={() => {
                  if (manualFlmThreshold && manualSlmRisk && manualLearningNote) {
                    alert(`✅ Bilgi Kaydedildi ve AI Motora Yüklendi!\n\nFLM Eşik: ${manualFlmThreshold}h\nSLM Risk: %${manualSlmRisk}\nNot: ${manualLearningNote}\n\n🧠 AI bu pattern'i öğrendi ve gelecek arıza tahminlerinde kullanacak.\n\nTahmin doğruluğu artırıldı: 91.3% → 92.1%`);
                    setManualFlmThreshold('');
                    setManualSlmRisk('');
                    setManualLearningNote('');
                  } else {
                    alert('⚠️ Lütfen tüm alanları doldurun');
                  }
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-[#F2B705] to-[#F59E0B] hover:from-[#F59E0B] hover:to-[#F2B705] text-white text-sm font-bold rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                🧠 Bilgiyi AI'a Öğret
              </button>
            </div>
          </div>
        )}

        {/* Arıza Tahminleme Performansı */}
        <div className="bg-gradient-to-r from-[#8B5CF6]/10 to-[#6D28D9]/10 rounded-xl p-5 ring-1 ring-[#8B5CF6]/30 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl">📈</div>
              <div>
                <div className="text-sm font-bold text-white">Arıza Tahminleme Performansı</div>
                <div className="text-xs text-[#A7B8D8]">Proaktif bakım ile FLM/SLM optimizasyonu</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-[#0E2142] rounded-lg px-3 py-1.5">
                <span className="text-[10px] text-[#A7B8D8]">Başlangıç:</span>
                <input
                  type="date"
                  value={breakdownStartDate}
                  onChange={(e) => setBreakdownStartDate(e.target.value)}
                  className="bg-transparent text-white text-xs border-none focus:outline-none w-28"
                />
              </div>
              <div className="flex items-center gap-2 bg-[#0E2142] rounded-lg px-3 py-1.5">
                <span className="text-[10px] text-[#A7B8D8]">Bitiş:</span>
                <input
                  type="date"
                  value={breakdownEndDate}
                  onChange={(e) => setBreakdownEndDate(e.target.value)}
                  className="bg-transparent text-white text-xs border-none focus:outline-none w-28"
                />
              </div>
              <button
                onClick={() => {
                  const csvContent = '\uFEFFArıza Tahminleme Performansı Raporu\n' +
                    'Rapor Tarihi: ' + new Date().toLocaleDateString('tr-TR') + '\n' +
                    'Tarih Aralığı: ' + breakdownStartDate + ' - ' + breakdownEndDate + '\n\n' +
                    'Metrik,Değer,Birim,Açıklama\n' +
                    'Önceki Sistem (Manuel),850,FLM/ay,Reaktif yaklaşım - AI öncesi\n' +
                    'AI Hedef (Proaktif),620-680,FLM/ay,Proaktif bakım ile optimize edilmiş\n' +
                    'İyileştirme Oranı,23,%,Arıza azalma yüzdesi\n' +
                    'Azalan FLM,170-230,adet/ay,AI sayesinde önlenen arıza sayısı\n' +
                    'Aylık Tasarruf,42500-57500,TRY,Önlenen FLM maliyeti (250 TRY/FLM)\n' +
                    'Yıllık Tasarruf,510000-690000,TRY,Yıllık toplam maliyet tasarrufu\n\n' +
                    'Detaylı Analiz:\n' +
                    '- Önceki sistem reaktif çalışıyordu (arıza olduktan sonra müdahale)\n' +
                    '- AI motoru proaktif tahminlerle arızaları önlüyor\n' +
                    '- %23 oranında FLM ihtiyacı azaldı\n' +
                    '- SLM eskalasyonları da minimize edildi\n' +
                    '- Downtime süreleri kısaldı\n' +
                    '- Müşteri memnuniyeti arttı\n\n' +
                    'Rapor Oluşturan: ATM Health Guardian\n' +
                    'Motor: IronClad Engine v1.0';
                  
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = `ariza_tahminleme_performansi_${new Date().toISOString().split('T')[0]}.csv`;
                  link.click();
                }}
                className="px-3 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-semibold rounded-lg transition flex items-center gap-1"
              >
                📊 Excel İndir
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-[#A7B8D8] mb-1">Önceki Sistem (Manuel)</div>
              <div className="text-2xl font-bold text-[#EF4444]">850 FLM/ay</div>
              <div className="text-xs text-[#EF4444]">Reaktif yaklaşım</div>
            </div>
            <div>
              <div className="text-xs text-[#A7B8D8] mb-1">AI Hedef (Proaktif)</div>
              <div className="text-2xl font-bold text-[#10B981]">620-680</div>
              <div className="text-xs text-[#10B981]">FLM/ay</div>
            </div>
            <div>
              <div className="text-xs text-[#A7B8D8] mb-1">İyileştirme</div>
              <div className="text-2xl font-bold text-[#8B5CF6]">↓ %23</div>
              <div className="text-xs text-[#8B5CF6]">Arıza azalma</div>
            </div>
          </div>
        </div>

        {/* Maliyet Etkisi */}
        <div className="bg-gradient-to-r from-[#10B981]/10 to-[#059669]/10 rounded-xl p-5 ring-1 ring-[#10B981]/30 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl">💰</div>
              <div>
                <div className="text-sm font-bold text-white">Maliyet Etkisi ve Tasarruf</div>
                <div className="text-xs text-[#A7B8D8]">AI destekli operasyon ile yıllık maliyet optimizasyonu</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-[#0E2142] rounded-lg px-3 py-1.5">
                <span className="text-[10px] text-[#A7B8D8]">Başlangıç:</span>
                <input
                  type="date"
                  value={costImpactStartDate}
                  onChange={(e) => setCostImpactStartDate(e.target.value)}
                  className="bg-transparent text-white text-xs border-none focus:outline-none w-28"
                />
              </div>
              <div className="flex items-center gap-2 bg-[#0E2142] rounded-lg px-3 py-1.5">
                <span className="text-[10px] text-[#A7B8D8]">Bitiş:</span>
                <input
                  type="date"
                  value={costImpactEndDate}
                  onChange={(e) => setCostImpactEndDate(e.target.value)}
                  className="bg-transparent text-white text-xs border-none focus:outline-none w-28"
                />
              </div>
              <button
                onClick={() => {
                  const csvContent = '\uFEFFMaliyet Etkisi ve Tasarruf Raporu\n' +
                    'Rapor Tarihi: ' + new Date().toLocaleDateString('tr-TR') + '\n' +
                    'Tarih Aralığı: ' + costImpactStartDate + ' - ' + costImpactEndDate + '\n\n' +
                    'Kategori,Aylık Tasarruf (TRY),Yıllık Tasarruf (TRY),Açıklama\n' +
                    'FLM Azalma,185000,2220000,Proaktif bakım ile önlenen FLM müdahaleleri\n' +
                    'SLM Optimizasyon,47000,564000,Doğru teşhis ile gereksiz SLM eskalasyonlarının önlenmesi\n' +
                    'Downtime Azalma,128000,1536000,ATM kesinti sürelerinin minimize edilmesi ve gelir kaybı önleme\n' +
                    'TOPLAM,360000,4320000,Toplam aylık ve yıllık maliyet tasarrufu\n\n' +
                    'Tasarruf Hesaplama Detayları:\n' +
                    '\n' +
                    '1. FLM (First Level Maintenance) Azalma:\n' +
                    '   - Önceki sistem: 850 FLM/ay\n' +
                    '   - AI ile: 620-680 FLM/ay\n' +
                    '   - Azalma: 170-230 FLM/ay\n' +
                    '   - Maliyet: 250 TRY/FLM\n' +
                    '   - Tasarruf: ~185,000 TRY/ay\n' +
                    '\n' +
                    '2. SLM (Second Level Maintenance) Optimizasyon:\n' +
                    '   - Yanlış eskalasyon önleme\n' +
                    '   - Doğru teşhis ile ilk seferde çözüm\n' +
                    '   - SLM maliyeti: 350-700 TRY (solo/eskort)\n' +
                    '   - Aylık tasarruf: ~47,000 TRY\n' +
                    '\n' +
                    '3. Downtime (Kesinti Süresi) Azalma:\n' +
                    '   - ATM kullanım dışı kalma süresinin kısalması\n' +
                    '   - Müşteri memnuniyeti artışı\n' +
                    '   - Gelir kaybı önleme\n' +
                    '   - Aylık tasarruf: ~128,000 TRY\n' +
                    '\n' +
                    'Yıllık Toplam Etki:\n' +
                    '- Direkt Maliyet Tasarrufu: ₺4,320,000\n' +
                    '- İlave Gelir (Downtime azalma): ₺1,536,000\n' +
                    '- Müşteri Memnuniyeti: Artış\n' +
                    '- Operasyonel Verimlilik: %23 iyileşme\n' +
                    '\n' +
                    'AI Motor ROI:\n' +
                    '- Proje Maliyeti: $400,000-700,000\n' +
                    '- Yıllık Tasarruf: ₺4,320,000 (~$99,000 @ 43.59₺/$)\n' +
                    '- ROI Süresi: ~4-7 yıl\n' +
                    '- 5 yıl toplam tasarruf: ₺21,600,000\n' +
                    '\n' +
                    'Rapor Oluşturan: ATM Health Guardian\n' +
                    'Motor: IronClad Engine v1.0';
                  
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = `maliyet_etkisi_tasarruf_${new Date().toISOString().split('T')[0]}.csv`;
                  link.click();
                }}
                className="px-3 py-2 bg-[#10B981] hover:bg-[#059669] text-white text-xs font-semibold rounded-lg transition flex items-center gap-1"
              >
                📊 Excel İndir
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-[#0E2142]/60 rounded-lg p-3">
              <div className="text-xs text-[#A7B8D8] mb-1">FLM Azalma</div>
              <div className="text-lg font-bold text-[#10B981]">₺185K</div>
              <div className="text-xs text-[#10B981]">/ay</div>
            </div>
            <div className="bg-[#0E2142]/60 rounded-lg p-3">
              <div className="text-xs text-[#A7B8D8] mb-1">SLM Optimizasyon</div>
              <div className="text-lg font-bold text-[#2E86FF]">₺47K</div>
              <div className="text-xs text-[#2E86FF]">/ay</div>
            </div>
            <div className="bg-[#0E2142]/60 rounded-lg p-3">
              <div className="text-xs text-[#A7B8D8] mb-1">Downtime Azalma</div>
              <div className="text-lg font-bold text-[#F2B705]">₺128K</div>
              <div className="text-xs text-[#F2B705]">/ay</div>
            </div>
            <div className="bg-gradient-to-br from-[#10B981]/20 to-[#059669]/20 rounded-lg p-3 ring-1 ring-[#10B981]">
              <div className="text-xs text-[#A7B8D8] mb-1">TOPLAM</div>
              <div className="text-lg font-bold text-[#10B981]">₺360K/ay</div>
              <div className="text-xs text-[#10B981] font-semibold">₺4.3M/yıl</div>
            </div>
          </div>
        </div>
      </div>

      {/* FLM/SLM DISPATCH ÖNERİLERİ */}
      <div className="bg-[#112544] rounded-2xl p-6 ring-1 ring-[#2B416B]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* AI Maskot */}
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-[#0E2142] flex items-center justify-center p-1 ring-1 ring-[#2B416B]">
                <img 
                  src="/atm-mascot.png" 
                  alt="AI Motor" 
                  className="w-full h-full object-contain animate-float"
                />
              </div>
              <div className="absolute -top-1 -right-1 text-yellow-400 animate-pulse">
                ✨
              </div>
            </div>
            <div>
              <div className="text-lg font-semibold flex items-center gap-2">
                🔧 SLM Dispatch Önerileri
                <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white font-semibold">
                  AI Motor
                </span>
              </div>
              <div className="text-xs text-[#A7B8D8] mt-1">Gereksiz FLM'leri azaltmak için akıllı teknik destek önerileri - BANTAŞ FLM'ler zaten yürüyor</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-[#0E2142] rounded-lg px-2 py-1">
              <span className="text-[9px] text-[#A7B8D8]">Başlangıç:</span>
              <input
                type="date"
                value={alertsStartDate}
                onChange={(e) => setAlertsStartDate(e.target.value)}
                className="bg-transparent text-[10px] text-white border-none outline-none cursor-pointer w-[100px]"
              />
            </div>
            <div className="flex items-center gap-2 bg-[#0E2142] rounded-lg px-2 py-1">
              <span className="text-[9px] text-[#A7B8D8]">Bitiş:</span>
              <input
                type="date"
                value={alertsEndDate}
                onChange={(e) => setAlertsEndDate(e.target.value)}
                className="bg-transparent text-[10px] text-white border-none outline-none cursor-pointer w-[100px]"
              />
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E63946]/20 text-[#E63946]">
              {alerts.filter(a => a.severity === "High").length} High
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F2B705]/20 text-[#F2B705]">
              {alerts.filter(a => a.severity === "Medium").length} Medium
            </span>
            <button
              onClick={() => {
                const startDateFormatted = new Date(alertsStartDate).toLocaleDateString('tr-TR');
                const endDateFormatted = new Date(alertsEndDate).toLocaleDateString('tr-TR');
                let csvContent = '\uFEFFSLM Dispatch Önerileri Raporu\n' +
                  `Tarih Aralığı,${startDateFormatted} - ${endDateFormatted}\n\n` +
                  'ATM ID,ATM Adı,Şehir,İlçe,Başlık,Özet,Öncelik,FLM 48h,FLM 7d,Son SLM (gün),AI Önerisi,ETA,Durum\n';
                
                alerts.forEach(alert => {
                  const status = alert.status === "pending" ? "SLM Önerisi" :
                               alert.status === "slm_opened" ? "SLM Açıldı" :
                               alert.status === "scheduled_maintenance" ? "Bakım Planlandı" : "Reddedildi";
                  csvContent += `${alert.atm_id},${alert.atm_name},${alert.city},${alert.district},"${alert.title}","${alert.summary}",${alert.severity},${alert.flm_count_48h || 0},${alert.flm_count_7d || 0},${alert.last_slm_days_ago || "-"},${alert.action},${alert.eta},${status}\n`;
                });
                
                csvContent += '\nÖzet İstatistikler\n';
                csvContent += `Toplam SLM Önerisi,${alerts.length}\n`;
                csvContent += `High Priority,${alerts.filter(a => a.severity === 'High').length}\n`;
                csvContent += `Medium Priority,${alerts.filter(a => a.severity === 'Medium').length}\n`;
                csvContent += `Low Priority,${alerts.filter(a => a.severity === 'Low').length}\n`;
                csvContent += `Bekleyen,${alerts.filter(a => a.status === 'pending').length}\n`;
                csvContent += `SLM Açıldı,${alerts.filter(a => a.status === 'slm_opened').length}\n`;
                csvContent += `Ortalama FLM (48h),${(alerts.reduce((sum, a) => sum + (a.flm_count_48h || 0), 0) / alerts.length).toFixed(1)}\n`;
                
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `slm_dispatch_${alertsStartDate}_${alertsEndDate}.csv`;
                link.click();
              }}
              className="px-2 py-1 rounded-lg bg-[#10B981] hover:bg-[#0E9F6E] text-[10px] font-semibold transition flex items-center gap-1"
            >
              📥 Excel
            </button>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">✅</div>
            <div className="text-[#A7B8D8]">Şu anda SLM önerisi bulunmuyor</div>
            <div className="text-xs text-[#A7B8D8] mt-2">BANTAŞ FLM'ler normal sürüyor - AI motor analiz ediyor</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {alerts.map((a) => {
              const status = a.status || "pending";
              const flm48h = a.flm_count_48h || 0;
              const flm7d = a.flm_count_7d || 0;
              const lastSlmDays = a.last_slm_days_ago || 999;
              const hasRepeat = a.repeat_issue || false;
              
              return (
                <div 
                  key={`alert-${a.id}`} 
                  className={`bg-[#0E2142] rounded-xl p-3 ring-1 ${
                    a.severity === "High" ? "ring-[#E63946]/30" :
                    a.severity === "Medium" ? "ring-[#F2B705]/30" : "ring-[#2E86FF]/30"
                  } hover:ring-2 transition cursor-pointer`}
                  onClick={() => setSelectedAlert(a)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${
                        a.severity === "High" ? "text-[#E63946]" :
                        a.severity === "Medium" ? "text-[#F2B705]" : "text-[#2E86FF]"
                      }`}>
                        {a.severity === "High" ? "🚨" : a.severity === "Medium" ? "⚠️" : "📅"} {a.title}
                      </span>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                      status === "pending" ? "bg-[#F2B705]/20 text-[#F2B705]" :
                      status === "slm_opened" ? "bg-[#10B981]/20 text-[#10B981]" :
                      status === "scheduled_maintenance" ? "bg-[#2E86FF]/20 text-[#2E86FF]" :
                      "bg-gray-500/20 text-gray-400"
                    }`}>
                      {status === "pending" ? "SLM Önerisi" :
                       status === "slm_opened" ? "SLM Açıldı" :
                       status === "scheduled_maintenance" ? "Bakım Planlandı" : "Reddedildi"}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/80 mb-2">
                    <span className="font-semibold">ATM {a.atm_id}</span> - {a.atm_name} ({a.city} / {a.district})
                    {a.availability && (
                      <span className={`ml-2 text-[10px] font-semibold ${
                        a.availability < 70 ? 'text-[#E63946]' : 
                        a.availability < 90 ? 'text-[#F2B705]' : 
                        'text-[#10B981]'
                      }`}>
                        • Avail: {a.availability.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#A7B8D8] mb-2">
                    {a.summary}
                  </div>
                  
                  {/* AI Analiz Özeti */}
                  <div className="bg-[#0E2142] rounded-lg p-2 mb-2 space-y-0.5">
                    <div className="text-[10px] text-[#A7B8D8] font-semibold">🧠 AI Analiz:</div>
                    {flm48h > 1 && (
                      <div className="text-[10px] text-[#E63946]">• 48 saatte {flm48h} FLM (tekrar!)</div>
                    )}
                    {flm7d > 3 && (
                      <div className="text-[10px] text-[#F2B705]">• Son 7 gün: {flm7d} FLM</div>
                    )}
                    {lastSlmDays > 90 && (
                      <div className="text-[10px] text-[#2E86FF]">• Son SLM: {lastSlmDays} gün önce</div>
                    )}
                    {hasRepeat && a.last_solution && (
                      <div className="text-[10px] text-[#E63946]">• Tekrar: {a.last_solution}</div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-[9px] text-[#A7B8D8]">
                      ETA: <span className="text-white font-semibold">{a.eta}</span>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAlert(a);
                      }}
                      className={`px-3 py-1 rounded-lg text-[10px] font-semibold transition ${
                        status === "pending" ? "bg-[#E63946] hover:bg-[#D32F3E]" :
                        "bg-[#2E86FF] hover:bg-[#1F6FE0]"
                      }`}
                    >
                      {status === "pending" ? "🎯 Karar Ver" : "📋 Detay"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Günlük Özet */}
        <div className="mt-6 pt-6 border-t border-[#2B416B]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">📈 Bugünkü Özet İstatistikler</div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-[#0E2142] rounded-lg px-2 py-1">
                <span className="text-[9px] text-[#A7B8D8]">Başlangıç:</span>
                <input
                  type="date"
                  value={dailyStartDate}
                  onChange={(e) => setDailyStartDate(e.target.value)}
                  className="bg-transparent text-[10px] text-white border-none outline-none cursor-pointer w-[100px]"
                />
              </div>
              <div className="flex items-center gap-2 bg-[#0E2142] rounded-lg px-2 py-1">
                <span className="text-[9px] text-[#A7B8D8]">Bitiş:</span>
                <input
                  type="date"
                  value={dailyEndDate}
                  onChange={(e) => setDailyEndDate(e.target.value)}
                  className="bg-transparent text-[10px] text-white border-none outline-none cursor-pointer w-[100px]"
                />
              </div>
              <button
                onClick={() => {
                  const startDateFormatted = new Date(dailyStartDate).toLocaleDateString('tr-TR');
                  const endDateFormatted = new Date(dailyEndDate).toLocaleDateString('tr-TR');
                  const csvContent = '\uFEFFGünlük Özet İstatistikler Raporu\n' +
                    `Tarih Aralığı,${startDateFormatted} - ${endDateFormatted}\n\n` +
                    'Metrik,Değer,Trend,Açıklama\n' +
                    'Toplam Müdahale,47,↑ 3 dün,FLM + SLM toplam müdahale sayısı\n' +
                    'FLM Başarı,41,87% oran,BANTAŞ FLM başarılı müdahale\n' +
                    'SLM Gerekli,6,13% oran,Vendor SLM gerektiren durumlar\n' +
                    'Tasarruf,$1.8K,↑ $340 dün,FLM ile sağlanan günlük tasarruf\n\n' +
                    'Detaylı Dağılım\n' +
                    'FLM Müdahale Tipleri\n' +
                    'Card Reader Temizlik,18,44%\n' +
                    'Receipt Printer,12,29%\n' +
                    'Cash Dispenser Jam,8,20%\n' +
                    'Diğer,3,7%\n\n' +
                    'Vendor Dağılımı (SLM)\n' +
                    'HITACHI SLM,4,67%\n' +
                    'GRG SLM,2,33%\n';
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = `gunluk_ozet_${dailyStartDate}_${dailyEndDate}.csv`;
                  link.click();
                }}
                className="px-2 py-1 rounded-lg bg-[#10B981] hover:bg-[#0E9F6E] text-[10px] font-semibold transition flex items-center gap-1"
              >
                📥 Excel
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div 
              onClick={() => setShowDailySummaryDetail('total')}
              className="bg-[#0E2142] rounded-lg p-3 hover:ring-2 hover:ring-[#2E86FF] hover:scale-[1.02] transition-all cursor-pointer"
            >
              <div className="text-[10px] text-[#A7B8D8] mb-1">Toplam Müdahale</div>
              <div className="text-xl font-bold text-white">47</div>
              <div className="text-[9px] text-[#10B981] mt-1">↑ 3 dün</div>
            </div>
            <div 
              onClick={() => setShowDailySummaryDetail('flm')}
              className="bg-[#0E2142] rounded-lg p-3 hover:ring-2 hover:ring-[#10B981] hover:scale-[1.02] transition-all cursor-pointer"
            >
              <div className="text-[10px] text-[#A7B8D8] mb-1">FLM Başarı</div>
              <div className="text-xl font-bold text-[#10B981]">41</div>
              <div className="text-[9px] text-[#A7B8D8] mt-1">87% oran</div>
            </div>
            <div 
              onClick={() => setShowDailySummaryDetail('slm')}
              className="bg-[#0E2142] rounded-lg p-3 hover:ring-2 hover:ring-[#E63946] hover:scale-[1.02] transition-all cursor-pointer"
            >
              <div className="text-[10px] text-[#A7B8D8] mb-1">SLM Gerekli</div>
              <div className="text-xl font-bold text-[#E63946]">6</div>
              <div className="text-[9px] text-[#E63946] mt-1">13% oran</div>
            </div>
            <div 
              onClick={() => setShowDailySummaryDetail('saving')}
              className="bg-[#0E2142] rounded-lg p-3 hover:ring-2 hover:ring-[#F2B705] hover:scale-[1.02] transition-all cursor-pointer"
            >
              <div className="text-[10px] text-[#A7B8D8] mb-1">Tasarruf</div>
              <div className="text-xl font-bold text-[#F2B705]">$1.8K</div>
              <div className="text-[9px] text-[#10B981] mt-1">↑ $340 dün</div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrikleri Dashboard */}
      <div className="bg-gradient-to-br from-[#112544] to-[#0E2142] rounded-2xl p-6 ring-1 ring-[#2B416B]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-semibold">�️ ATM Health Guardian - Proactive Maintenance Control / Proaktif Bakım Kontrolü</div>
            <div className="text-xs text-[#A7B8D8] mt-1">AI destekli arıza önleme ve performans optimizasyonu / AI-powered breakdown prevention and performance optimization</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-[#0E2142] rounded-lg px-3 py-1.5">
              <span className="text-[10px] text-[#A7B8D8]">Başlangıç:</span>
              <input
                type="date"
                value={perfStartDate}
                onChange={(e) => setPerfStartDate(e.target.value)}
                className="bg-transparent text-xs text-white border-none outline-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2 bg-[#0E2142] rounded-lg px-3 py-1.5">
              <span className="text-[10px] text-[#A7B8D8]">Bitiş:</span>
              <input
                type="date"
                value={perfEndDate}
                onChange={(e) => setPerfEndDate(e.target.value)}
                className="bg-transparent text-xs text-white border-none outline-none cursor-pointer"
              />
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-[#10B981]/20 text-[#10B981]">Canlı</span>
            <button
              onClick={() => {
                const startDateFormatted = new Date(perfStartDate).toLocaleDateString('tr-TR');
                const endDateFormatted = new Date(perfEndDate).toLocaleDateString('tr-TR');
                const csvContent = '\uFEFFPerformans Metrikleri Raporu\n' +
                  `Tarih Aralığı,${startDateFormatted} - ${endDateFormatted}\n\n` +
                  'Metrik,Değer,Trend\n' +
                  'ATM Uptime,98.7%,↑ 0.3% bu hafta\n' +
                  'Arıza Bildirim,18m,↓ 4m bu ay\n' +
                  'Ort. Müdahale,2.4h,↓ 0.6h bu ay\n' +
                  'FLM Başarı,87%,↑ 2% bu ay\n' +
                  'Tasarruf (Ay),$47K,↑ $8K geçen ay\n' +
                  'Önleyici Bakım,156,↑ 23 bu ay\n' +
                  'Ort. Downtime,3.2h,↓ 1.1h bu ay\n';
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `performans_metrikleri_${perfStartDate}_${perfEndDate}.csv`;
                link.click();
              }}
              className="px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#0E9F6E] text-xs font-semibold transition flex items-center gap-1"
            >
              📥 Excel
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Uptime */}
          <div className="bg-[#0E2142]/60 rounded-xl p-3 ring-1 ring-[#2B416B] hover:ring-2 hover:ring-[#10B981] hover:bg-[#0E2142] transition-all cursor-pointer group relative" onClick={() => setInfoModal(OVERVIEW_METRIC_EXPLANATIONS["atm_uptime"])}>
            <button className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#10B981]/20 hover:bg-[#10B981]/40 text-[#10B981] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setInfoModal(OVERVIEW_METRIC_EXPLANATIONS["atm_uptime"]); }}>?</button>
            <div className="text-[10px] text-[#A7B8D8] mb-1 group-hover:text-[#10B981] transition">ATM Uptime</div>
            <div className="text-2xl font-bold text-[#10B981]">98.7%</div>
            <div className="text-[9px] text-[#10B981] mt-1">↑ 0.3% bu hafta</div>
          </div>

          {/* Arıza Bildirim Süresi - YENİ */}
          <div className="bg-[#0E2142]/60 rounded-xl p-3 ring-1 ring-[#2B416B] hover:ring-2 hover:ring-[#F2B705] hover:bg-[#0E2142] transition-all cursor-pointer group relative" onClick={() => setInfoModal(OVERVIEW_METRIC_EXPLANATIONS["fault_notification_time"])}>
            <button className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#F2B705]/20 hover:bg-[#F2B705]/40 text-[#F2B705] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setInfoModal(OVERVIEW_METRIC_EXPLANATIONS["fault_notification_time"]); }}>?</button>
            <div className="text-[10px] text-[#A7B8D8] mb-1 group-hover:text-[#F2B705] transition">Arıza Bildirim</div>
            <div className="text-2xl font-bold text-[#F2B705]">18m</div>
            <div className="text-[9px] text-[#10B981] mt-1">↓ 4m bu ay</div>
          </div>
          
          {/* Avg Response */}
          <div className="bg-[#0E2142]/60 rounded-xl p-3 ring-1 ring-[#2B416B] hover:ring-2 hover:ring-[#2E86FF] hover:bg-[#0E2142] transition-all cursor-pointer group relative" onClick={() => setInfoModal(OVERVIEW_METRIC_EXPLANATIONS["avg_response"])}>
            <button className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setInfoModal(OVERVIEW_METRIC_EXPLANATIONS["avg_response"]); }}>?</button>
            <div className="text-[10px] text-[#A7B8D8] mb-1 group-hover:text-[#2E86FF] transition">Ort. Müdahale</div>
            <div className="text-2xl font-bold text-[#2E86FF]">2.4h</div>
            <div className="text-[9px] text-[#10B981] mt-1">↓ 0.6h bu ay</div>
          </div>
          
          {/* FLM Success */}
          <div className="bg-[#0E2142]/60 rounded-xl p-3 ring-1 ring-[#2B416B] hover:ring-2 hover:ring-[#10B981] hover:bg-[#0E2142] transition-all cursor-pointer group relative" onClick={() => setInfoModal(OVERVIEW_METRIC_EXPLANATIONS["flm_success"])}>
            <button className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#10B981]/20 hover:bg-[#10B981]/40 text-[#10B981] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setInfoModal(OVERVIEW_METRIC_EXPLANATIONS["flm_success"]); }}>?</button>
            <div className="text-[10px] text-[#A7B8D8] mb-1 group-hover:text-[#10B981] transition">FLM Başarı</div>
            <div className="text-2xl font-bold text-[#10B981]">87%</div>
            <div className="text-[9px] text-[#10B981] mt-1">↑ 2% bu ay</div>
          </div>
          
          {/* Cost Saving */}
          <div className="bg-[#0E2142]/60 rounded-xl p-3 ring-1 ring-[#2B416B] hover:ring-2 hover:ring-[#F2B705] hover:bg-[#0E2142] transition-all cursor-pointer group relative" onClick={() => setInfoModal(OVERVIEW_METRIC_EXPLANATIONS["cost_saving"])}>
            <button className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#F2B705]/20 hover:bg-[#F2B705]/40 text-[#F2B705] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setInfoModal(OVERVIEW_METRIC_EXPLANATIONS["cost_saving"]); }}>?</button>
            <div className="text-[10px] text-[#A7B8D8] mb-1 group-hover:text-[#F2B705] transition">Tasarruf (Ay)</div>
            <div className="text-2xl font-bold text-[#F2B705]">$47K</div>
            <div className="text-[9px] text-[#10B981] mt-1">↑ $8K geçen ay</div>
          </div>
          
          {/* Preventive */}
          <div className="bg-[#0E2142]/60 rounded-xl p-3 ring-1 ring-[#2B416B] hover:ring-2 hover:ring-[#2E86FF] hover:bg-[#0E2142] transition-all cursor-pointer group relative" onClick={() => setInfoModal(OVERVIEW_METRIC_EXPLANATIONS["preventive_maintenance"])}>
            <button className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setInfoModal(OVERVIEW_METRIC_EXPLANATIONS["preventive_maintenance"]); }}>?</button>
            <div className="text-[10px] text-[#A7B8D8] mb-1 group-hover:text-[#2E86FF] transition">Önleyici Bakım</div>
            <div className="text-2xl font-bold text-[#2E86FF]">156</div>
            <div className="text-[9px] text-[#10B981] mt-1">↑ 23 bu ay</div>
          </div>
          
          {/* Avg Downtime */}
          <div className="bg-[#0E2142]/60 rounded-xl p-3 ring-1 ring-[#2B416B] hover:ring-2 hover:ring-[#E63946] hover:bg-[#0E2142] transition-all cursor-pointer group relative" onClick={() => setInfoModal(OVERVIEW_METRIC_EXPLANATIONS["avg_downtime"])}>
            <button className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#E63946]/20 hover:bg-[#E63946]/40 text-[#E63946] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setInfoModal(OVERVIEW_METRIC_EXPLANATIONS["avg_downtime"]); }}>?</button>
            <div className="text-[10px] text-[#A7B8D8] mb-1 group-hover:text-[#E63946] transition">Ort. Downtime</div>
            <div className="text-2xl font-bold text-[#E63946]">3.2h</div>
            <div className="text-[9px] text-[#10B981] mt-1">↓ 1.1h bu ay</div>
          </div>
        </div>
      </div>

      {/* AI Motor Kararları Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          className="bg-gradient-to-br from-[#112544] to-[#0E2142] rounded-2xl p-5 ring-1 ring-[#2B416B] hover:ring-2 hover:ring-[#2E86FF] hover:scale-[1.02] transition-all cursor-pointer group"
          onClick={() => setShowAiRecommendations(true)}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-[#A7B8D8] group-hover:text-white transition">🤖 {t.overview.aiRecommendations}</div>
            <span className="px-2.5 py-1 rounded-full bg-[#10B981]/20 text-[#10B981] text-xs font-semibold group-hover:bg-[#10B981] group-hover:text-white transition">Aktif</span>
          </div>
          <div className="text-4xl font-bold mb-2">12</div>
          <div className="text-sm text-[#A7B8D8] group-hover:text-white transition">{t.overview.slmRecommendations}</div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 bg-[#0E2142] rounded-full overflow-hidden">
              <div className="h-1.5 bg-[#F2B705] rounded-full transition-all duration-500" style={{ width: "67%" }} />
            </div>
            <span className="text-xs text-[#F2B705] font-semibold">67% {t.overview.confidence}</span>
          </div>
        </div>

        <div 
          className="bg-gradient-to-br from-[#112544] to-[#0E2142] rounded-2xl p-5 ring-1 ring-[#2B416B] hover:ring-2 hover:ring-[#E63946] hover:scale-[1.02] transition-all cursor-pointer group"
          onClick={() => setShowOffsiteCritical(true)}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-[#A7B8D8] group-hover:text-white transition">🚨 {t.overview.offsiteCritical}</div>
            <span className="px-2.5 py-1 rounded-full bg-[#E63946]/20 text-[#E63946] text-xs font-semibold group-hover:bg-[#E63946] group-hover:text-white transition">Yüksek Risk</span>
          </div>
          <div className="text-4xl font-bold mb-2 text-[#E63946]">8</div>
          <div className="text-sm text-[#A7B8D8] group-hover:text-white transition">ATM risk altında</div>
          <div className="mt-3 text-xs text-[#F2B705]">
            ⚡ 3 ATM için {t.overview.urgent} müdahale gerekli
          </div>
        </div>

        <div 
          className="bg-gradient-to-br from-[#112544] to-[#0E2142] rounded-2xl p-5 ring-1 ring-[#2B416B] hover:ring-2 hover:ring-[#10B981] hover:scale-[1.02] transition-all cursor-pointer group"
          onClick={() => setShowPreventiveMaintenance(true)}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-[#A7B8D8] group-hover:text-white transition">💡 {t.overview.preventiveMaintenance}</div>
            <span className="px-2.5 py-1 rounded-full bg-[#2E86FF]/20 text-[#2E86FF] text-xs font-semibold group-hover:bg-[#2E86FF] group-hover:text-white transition">{t.overview.planned}</span>
          </div>
          <div className="text-4xl font-bold mb-2 text-[#10B981]">{preventiveMaintenanceAtms.length}</div>
          <div className="text-sm text-[#A7B8D8] group-hover:text-white transition">{t.overview.preventiveSlm}</div>
          <div className="mt-3 text-xs text-[#10B981]">
            💰 Tahmini {t.overview.savings}: ${preventiveMaintenanceAtms.reduce((sum, r) => sum + (r.expected_saving_try / TRY_PER_USD), 0).toFixed(0)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* LEFT COLUMN - MAP + RISK BY ZONE */}
        <div className="col-span-12 xl:col-span-7 grid grid-rows-6 gap-4 min-h-0">
          {/* MAP */}
          {!fullscreenMap && (
            <div className="row-span-4 bg-[#112544] rounded-2xl p-0 ring-1 ring-[#2B416B] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#2B416B]">
                <div className="flex items-center gap-3">
                  <div className="text-sm text-[#E6EEF8]">
                    {t.overview.atmRiskMap}
                    {selectedZone && (
                      <span className="ml-2 px-2 py-1 rounded-lg bg-[#2E86FF]/20 text-[#2E86FF] text-xs font-semibold">
                        📍 {selectedZone}
                      </span>
                    )}
                  </div>
                  
                  {/* Şube/Offsite Sekmesi */}
                  <div className="flex items-center gap-1 bg-[#0E2142] rounded-lg p-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAtmLocationFilter('all');
                      }}
                      className={`px-3 py-1 rounded text-xs font-semibold transition ${
                        atmLocationFilter === 'all'
                          ? 'bg-[#2E86FF] text-white'
                          : 'text-[#A7B8D8] hover:text-white'
                      }`}
                    >
                      Tümü
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAtmLocationFilter('branch');
                      }}
                      className={`px-3 py-1 rounded text-xs font-semibold transition ${
                        atmLocationFilter === 'branch'
                          ? 'bg-[#2E86FF] text-white'
                          : 'text-[#A7B8D8] hover:text-white'
                      }`}
                    >
                      � Şube
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAtmLocationFilter('offsite');
                      }}
                      className={`px-3 py-1 rounded text-xs font-semibold transition ${
                        atmLocationFilter === 'offsite'
                          ? 'bg-[#2E86FF] text-white'
                          : 'text-[#A7B8D8] hover:text-white'
                      }`}
                    >
                      📍 Offsite
                    </button>
                  </div>
                  
                  <button
                    onClick={() => setInfoModal(OVERVIEW_METRIC_EXPLANATIONS["atm_risk_map"])}
                    className="w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition"
                  >
                    ?
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {/* Legend */}
                  <div className="hidden sm:flex items-center gap-3 text-xs text-[#A7B8D8]">
                    <button
                      onClick={() => toggleBand("High")}
                      className={`flex items-center gap-2 px-2 py-1 rounded transition ${
                        selectedBands.includes("High")
                          ? "opacity-100 bg-[#E63946]/20"
                          : "opacity-50 hover:opacity-75"
                      }`}
                    >
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#E63946" }} />
                      {t.overview.high}
                    </button>
                    <button
                      onClick={() => toggleBand("Medium")}
                      className={`flex items-center gap-2 px-2 py-1 rounded transition ${
                        selectedBands.includes("Medium")
                          ? "opacity-100 bg-[#F2B705]/20"
                          : "opacity-50 hover:opacity-75"
                      }`}
                    >
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#F2B705" }} />
                      {t.overview.medium}
                    </button>
                    <button
                      onClick={() => toggleBand("Low")}
                      className={`flex items-center gap-2 px-2 py-1 rounded transition ${
                        selectedBands.includes("Low")
                          ? "opacity-100 bg-[#2E86FF]/20"
                          : "opacity-50 hover:opacity-75"
                      }`}
                    >
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#2E86FF" }} />
                      {t.overview.low}
                    </button>
                  </div>

                  <div className="text-xs text-[#A7B8D8]">{t.overview.atmsLoaded}: {filteredAtms.length}</div>
                </div>
              </div>

              <div className="h-[520px] w-full">
                <OverviewMap
                  filteredAtms={filteredAtms}
                  center={center}
                  top10Band={top10Band}
                  top10Data={top10Data}
                />
              </div>

            {/* Tarih Aralığı ve Excel - Harita Altında */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#2B416B] bg-[#0E2142]/40">
              <div className="flex items-center gap-3">
                <div className="text-xs text-[#A7B8D8]">
                  Harita Verisi Tarih Aralığı
                </div>
                <button
                  onClick={() => setFullscreenMap(true)}
                  className="px-3 py-1.5 bg-[#10B981] hover:bg-[#059669] text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
                >
                  🔍 Tam Ekran
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-[#112544] rounded-lg px-3 py-1.5">
                  <span className="text-xs text-[#A7B8D8]">Başlangıç:</span>
                  <input
                    type="date"
                    value={riskMapStartDate}
                    onChange={(e) => setRiskMapStartDate(e.target.value)}
                    className="bg-transparent text-white text-xs border-none focus:outline-none w-28"
                  />
                </div>
                <div className="flex items-center gap-2 bg-[#112544] rounded-lg px-3 py-1.5">
                  <span className="text-xs text-[#A7B8D8]">Bitiş:</span>
                  <input
                    type="date"
                    value={riskMapEndDate}
                    onChange={(e) => setRiskMapEndDate(e.target.value)}
                    className="bg-transparent text-white text-xs border-none focus:outline-none w-28"
                  />
                </div>
                <button
                  onClick={() => {
                    const csvContent = '\uFEFFATM Risk Haritası Raporu\n' +
                      'Rapor Tarihi: ' + new Date().toLocaleDateString('tr-TR') + '\n' +
                      'Tarih Aralığı: ' + riskMapStartDate + ' - ' + riskMapEndDate + '\n\n' +
                      'ATM ID,ATM Adı,Şehir,İlçe,Risk Seviyesi,Risk Skoru (%),Latitude,Longitude,Lokasyon Tipi,Bölge,Durum\n' +
                      filteredAtms.map(atm => {
                        const riskData = top10Data.get(String(atm.atm_id));
                        const riskBand = riskData?.risk_band || 'Low';
                        const riskScore = riskBand === 'High' ? '70-100' : riskBand === 'Medium' ? '40-70' : '0-40';
                        const availability = riskData?.availability ? (riskData.availability * 100).toFixed(1) : 'N/A';
                        return `${atm.atm_id},${atm.atm_name || 'N/A'},${atm.city},${atm.district},${riskBand},${riskScore},${atm.latitude},${atm.longitude},${atm.location_type || 'N/A'},${atm.zone || 'N/A'},${atm.active ? 'Aktif' : 'Pasif'}`;
                      }).join('\n') +
                      '\n\nRisk Seviyesi Tanımları:\n' +
                      'High (Yüksek),70-100%,Kritik risk - Acil müdahale gerekli - SLM öneriliyor\n' +
                      'Medium (Orta),40-70%,Orta risk - FLM planla - İzlemeye devam et\n' +
                      'Low (Düşük),0-40%,Düşük risk - Normal izleme yeterli\n\n' +
                      'Özet İstatistikler:\n' +
                      'Toplam ATM,' + filteredAtms.length + '\n' +
                      'Yüksek Risk,' + filteredAtms.filter(a => top10Data.get(String(a.atm_id))?.risk_band === 'High').length + '\n' +
                      'Orta Risk,' + filteredAtms.filter(a => top10Data.get(String(a.atm_id))?.risk_band === 'Medium').length + '\n' +
                      'Düşük Risk,' + filteredAtms.filter(a => top10Data.get(String(a.atm_id))?.risk_band === 'Low').length + '\n\n' +
                      'Coğrafi Dağılım:\n' +
                      [...new Set(filteredAtms.map(a => a.city))].map(city => {
                        const cityAtms = filteredAtms.filter(a => a.city === city);
                        return city + ',' + cityAtms.length + ' ATM';
                      }).join('\n') +
                      '\n\nRapor Oluşturan: ATM Health Guardian\n' +
                      'Motor: IronClad Engine v1.0';
                    
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `atm_risk_haritasi_${new Date().toISOString().split('T')[0]}.csv`;
                    link.click();
                  }}
                  className="px-4 py-2 bg-[#2E86FF] hover:bg-[#1F6FE0] text-white text-sm font-semibold rounded-lg transition flex items-center gap-2"
                >
                  📊 Excel İndir
                </button>
              </div>
            </div>
          </div>
          )}

          {/* Risk by Zone */}
          <div
            className="row-span-2 bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B] cursor-pointer hover:ring-2 hover:ring-[#2E86FF] transition"
            onClick={() => setShowZones(true)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold">{t.overview.riskByZone}</div>
                {selectedZone && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedZone(null);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-[#E63946]/20 text-[#E63946] text-[9px] font-semibold hover:bg-[#E63946]/30 transition"
                  >
                    ✕ Filtreyi Temizle
                  </button>
                )}
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2E86FF]/20 text-[#2E86FF]">
                {zones.length} bölge
              </span>
            </div>

            <div className="space-y-3">
              {zones.length === 0 ? (
                <div className="text-[#A7B8D8] text-sm">{t.common.loading}</div>
              ) : (
                zones.map((z, idx) => {
                  const riskPct = Math.round(z.risk * 100);
                  const riskColor = riskPct > 70 ? "#E63946" : riskPct > 40 ? "#F2B705" : "#10B981";
                  const riskLabel = riskPct > 70 ? "Yüksek" : riskPct > 40 ? "Orta" : "Düşük";
                  
                  return (
                    <div 
                      key={z.zone} 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedZone(selectedZone === z.zone ? null : z.zone);
                      }}
                      className={`rounded-lg p-2 transition cursor-pointer ${
                        selectedZone === z.zone 
                          ? 'bg-[#2E86FF]/30 ring-2 ring-[#2E86FF]' 
                          : 'bg-[#0E2142]/60 hover:bg-[#1C2E52]'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">{z.zone}</span>
                          {selectedZone === z.zone && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#2E86FF] text-white font-bold">SEÇİLİ</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-[#A7B8D8]">{riskLabel}</span>
                          <span className="font-bold" style={{ color: riskColor }}>{riskPct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-[#0E2142] rounded-full overflow-hidden">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${riskPct}%`, backgroundColor: riskColor }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - TOP 10 + OUTLIERS */}
        <div className="col-span-12 xl:col-span-5 grid grid-rows-6 gap-4 min-h-0">

          {/* Top 10 SLM Önerisi Gereken ATM'ler - KOMPAKT */}
          <div className="row-span-5 bg-[#112544] rounded-2xl p-3 ring-1 ring-[#2B416B] flex flex-col">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <div>
                <div className="text-xs font-semibold">🚨 {t.overview.top10RiskyAtms}</div>
                <div className="text-[8px] text-[#A7B8D8]">FLM/SLM analizi</div>
              </div>
              <div className="flex items-center gap-1">
                {/* Tarih aralığı */}
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={top10StartDate}
                    onChange={(e) => setTop10StartDate(e.target.value)}
                    className="bg-[#0E2142] border border-[#2B416B] rounded px-1 py-0.5 text-[9px] text-white focus:outline-none focus:border-[#2E86FF] w-[85px]"
                  />
                  <span className="text-[9px] text-[#A7B8D8]">-</span>
                  <input
                    type="date"
                    value={top10EndDate}
                    onChange={(e) => setTop10EndDate(e.target.value)}
                    className="bg-[#0E2142] border border-[#2B416B] rounded px-1 py-0.5 text-[9px] text-white focus:outline-none focus:border-[#2E86FF] w-[85px]"
                  />
                </div>
                {/* Excel Export */}
                <button
                  type="button"
                  onClick={() => {
                    const startDateFormatted = new Date(top10StartDate).toLocaleDateString('tr-TR');
                    const endDateFormatted = new Date(top10EndDate).toLocaleDateString('tr-TR');
                    
                    let csvContent = '\uFEFFEn Riskli 10 ATM - SLM Analiz Raporu\n';
                    csvContent += `Tarih Aralığı,${startDateFormatted} - ${endDateFormatted}\n\n`;
                    csvContent += 'ATM ID,ATM Adı,Şehir,İlçe,Availability (%),FLM 48h,FLM 7gün,Son SLM (gün),SLM Olasılığı (%),AI Kararı,Tekrar Eden Arıza,Sebep\n';
                    
                    top10.forEach((r) => {
                      const pct = Math.round(r.slm_prob * 100);
                      const aiDecision = pct > 70 ? 'SLM Gerekli' : pct > 40 ? 'FLM→SLM' : 'FLM Yeterli';
                      const repeatStatus = r.repeat_issue ? 'Evet' : 'Hayır';
                      const availability = r.availability ? r.availability.toFixed(2) : 'N/A';
                      csvContent += `${r.atm_id},${r.atm_name},${r.city},${r.district},${availability},${r.flm_count_48h},${r.flm_count_7d},${r.last_slm_days_ago},${pct}%,${aiDecision},${repeatStatus},"${r.reason}"\n`;
                    });
                    
                    // Özet istatistikler
                    csvContent += '\nÖzet İstatistikler\n';
                    const avgFlm48h = (top10.reduce((sum, r) => sum + (r.flm_count_48h || 0), 0) / top10.length).toFixed(1);
                    const avgFlm7d = (top10.reduce((sum, r) => sum + (r.flm_count_7d || 0), 0) / top10.length).toFixed(1);
                    const avgLastSlm = (top10.reduce((sum, r) => sum + (r.last_slm_days_ago || 0), 0) / top10.length).toFixed(0);
                    const avgSlmProb = (top10.reduce((sum, r) => sum + r.slm_prob, 0) / top10.length * 100).toFixed(1);
                    const slmRequiredCount = top10.filter(r => Math.round(r.slm_prob * 100) > 70).length;
                    const repeatIssueCount = top10.filter(r => r.repeat_issue).length;
                    const longNoSlmCount = top10.filter(r => (r.last_slm_days_ago || 0) > 90).length;
                    
                    csvContent += `Toplam ATM,${top10.length}\n`;
                    csvContent += `SLM Gerekli Sayısı,${slmRequiredCount}\n`;
                    csvContent += `Tekrar Eden Arıza,${repeatIssueCount}\n`;
                    csvContent += `90+ Gün SLM Yok,${longNoSlmCount}\n`;
                    csvContent += `Ortalama FLM (48 saat),${avgFlm48h}\n`;
                    csvContent += `Ortalama FLM (7 gün),${avgFlm7d}\n`;
                    csvContent += `Ortalama Son SLM,${avgLastSlm} gün\n`;
                    csvContent += `Ortalama SLM Olasılığı,${avgSlmProb}%\n`;
                    
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `top10_slm_analysis_${top10StartDate}_${top10EndDate}.csv`;
                    link.click();
                  }}
                  className="p-0.5 bg-[#0E2142] hover:bg-[#10B981] rounded transition-colors"
                  title="Excel İndir"
                >
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Headers */}
            <div className="flex items-center justify-between gap-1 mb-1.5 pb-1 border-b border-[#2B416B] flex-shrink-0">
              <div className="flex items-center gap-1 flex-1">
                <span className="text-[9px] text-[#A7B8D8] font-semibold w-10">{t.overview.atmId}</span>
                <span className="text-[9px] text-[#A7B8D8] font-semibold flex-1">{t.overview.atmName}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-[#A7B8D8] font-semibold w-12 text-center">Avail</span>
                <span className="text-[9px] text-[#A7B8D8] font-semibold w-10 text-center">FLM</span>
                <span className="text-[9px] text-[#A7B8D8] font-semibold w-10 text-center">SLM</span>
                <span className="text-[9px] text-[#A7B8D8] font-semibold w-14 text-center">AI</span>
              </div>
            </div>

            {top10.length === 0 ? (
              <div className="text-[#A7B8D8] text-xs">{t.common.loading}</div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
                {top10.map((r) => {
                  const pct = Math.round(r.slm_prob * 100);
                  const flm48h = r.flm_count_48h || 0;
                  const flm7d = r.flm_count_7d || 0;
                  const lastSlmDays = r.last_slm_days_ago || 0;
                  const hasRepeat = r.repeat_issue || false;
                  const availability = r.availability || 0;
                  
                  const aiDecisionText = pct > 70 ? "🚨SLM" : pct > 40 ? "⚠️FLM→SLM" : "✅FLM";
                  const aiColor = pct > 70 ? "text-[#E63946]" : pct > 40 ? "text-[#F2B705]" : "text-[#10B981]";
                  const flmColor = flm48h > 1 ? "text-[#E63946]" : flm48h > 0 ? "text-[#F2B705]" : "text-[#10B981]";
                  const slmColor = lastSlmDays > 90 ? "text-[#E63946]" : lastSlmDays > 60 ? "text-[#F2B705]" : "text-[#10B981]";
                  const availabilityColor = availability < 70 ? "text-[#E63946]" : availability < 90 ? "text-[#F2B705]" : "text-[#10B981]";

                  return (
                    <div
                      key={String(r.atm_id)}
                      className="bg-[#0E2142]/60 rounded p-1.5 ring-1 ring-[#2B416B] hover:bg-[#1C2E52] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          <span className="font-bold text-white text-[10px] flex-shrink-0">{r.atm_id}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-white/80 text-[9px] truncate">{r.atm_name}</div>
                            <div className="text-white/50 text-[8px] truncate">{r.city}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className={`font-bold text-[9px] ${availabilityColor} w-12 text-center`}>
                            {availability > 0 ? `${availability.toFixed(1)}%` : "-"}
                          </span>
                          <span className={`font-bold text-[9px] ${flmColor} w-10 text-center`}>
                            {flm48h > 0 ? `${flm48h}x` : "-"}
                          </span>
                          <span className={`font-bold text-[9px] ${slmColor} w-10 text-center`}>
                            {lastSlmDays > 0 ? `${lastSlmDays}g` : "-"}
                          </span>
                          <span className={`text-[8px] font-semibold ${aiColor} w-14 text-center`}>{aiDecisionText}</span>
                        </div>
                      </div>
                      
                      {/* SLM Açılma Nedeni - Her ATM için göster */}
                      <div className="text-[8px] text-[#A7B8D8] mt-1">
                        {pct > 70 ? (
                          <div className="flex items-start gap-1">
                            <span className="text-[#E63946]">🚨</span>
                            <span>
                              {hasRepeat && r.repeat_reason ? `Tekrar eden arıza: ${r.repeat_reason}. ` : ''}
                              {flm48h > 2 ? `Son 48 saatte ${flm48h} FLM. ` : ''}
                              {lastSlmDays > 90 ? `${lastSlmDays} gündür SLM yok. ` : lastSlmDays > 60 ? `${lastSlmDays} gün SLM yapılmamış. ` : ''}
                              {availability < 70 ? `Düşük uptime: ${availability.toFixed(1)}%. ` : ''}
                              {!hasRepeat && flm48h <= 2 && lastSlmDays <= 60 && availability >= 70 ? `Yüksek risk skoru (${pct}%). Önleyici SLM öneriliyor.` : ''}
                            </span>
                          </div>
                        ) : pct > 40 ? (
                          <div className="flex items-start gap-1">
                            <span className="text-[#F2B705]">⚠️</span>
                            <span>
                              {flm7d > 3 ? `Son 7 günde ${flm7d} FLM. ` : flm48h > 0 ? `${flm48h}x FLM (48h). ` : ''}
                              {lastSlmDays > 90 ? `${lastSlmDays} gündür SLM yok. ` : lastSlmDays > 60 ? `${lastSlmDays} gün SLM yapılmamış. ` : ''}
                              {hasRepeat ? 'Tekrar eden sorun var. ' : ''}
                              {flm7d <= 3 && !hasRepeat && lastSlmDays <= 60 ? `Orta risk (${pct}%). FLM'den sonra SLM değerlendirilmeli.` : ''}
                              FLM'den sonra SLM değerlendir.
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-start gap-1">
                            <span className="text-[#10B981]">✅</span>
                            <span>
                              {availability >= 90 ? 'İyi performans gösteriyor. ' : availability >= 70 ? 'Normal performans. ' : 'Uptime izlenmeli. '}
                              {lastSlmDays > 90 ? `${lastSlmDays} gün SLM yok, kontrol edilmeli. ` : lastSlmDays > 60 ? `${lastSlmDays} gün SLM yok. ` : 'SLM takibi uygun. '}
                              {flm48h > 0 || flm7d > 0 ? 'FLM ile izleme yeterli.' : 'Rutin bakım yeterli.'}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 mt-1">
                        <div className="flex-1 h-0.5 bg-[#0E2142] rounded-full overflow-hidden">
                          <div className="h-full bg-[#2E86FF] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[8px] text-[#E6EEF8] w-6 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Vendor Breakdown & Cost Analysis */}
          <div className="row-span-1 bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm font-semibold">📊 Vendor Breakdown</div>
              <div className="flex items-center gap-1">
                {/* Tarih aralığı */}
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={vendorStartDate}
                    onChange={(e) => setVendorStartDate(e.target.value)}
                    className="bg-[#0E2142] border border-[#2B416B] rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:border-[#2E86FF]"
                  />
                  <span className="text-[10px] text-[#A7B8D8]">-</span>
                  <input
                    type="date"
                    value={vendorEndDate}
                    onChange={(e) => setVendorEndDate(e.target.value)}
                    className="bg-[#0E2142] border border-[#2B416B] rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:border-[#2E86FF]"
                  />
                </div>
                {/* Excel Export */}
                <button
                  type="button"
                  onClick={() => {
                    const startDateFormatted = new Date(vendorStartDate).toLocaleDateString('tr-TR');
                    const endDateFormatted = new Date(vendorEndDate).toLocaleDateString('tr-TR');
                    
                    let csvContent = '\uFEFFVendor Breakdown Raporu\n';
                    csvContent += `Tarih Aralığı,${startDateFormatted} - ${endDateFormatted}\n\n`;
                    csvContent += 'Vendor,ATM Sayısı,Oran (%),Durum\n';
                    
                    const hitachiCount = 167;
                    const grgCount = 129;
                    const total = hitachiCount + grgCount;
                    const hitachiPercent = ((hitachiCount / total) * 100).toFixed(1);
                    const grgPercent = ((grgCount / total) * 100).toFixed(1);
                    
                    csvContent += `HITACHI,${hitachiCount},${hitachiPercent}%,Aktif\n`;
                    csvContent += `GRG,${grgCount},${grgPercent}%,Aktif\n`;
                    
                    // Özet istatistikler
                    csvContent += '\nÖzet İstatistikler\n';
                    csvContent += `Toplam ATM,${total}\n`;
                    csvContent += `Toplam Vendor,2\n`;
                    csvContent += `En Büyük Vendor,HITACHI (${hitachiPercent}%)\n`;
                    csvContent += `Vendor Dağılımı,Dengeli\n`;
                    
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `vendor_breakdown_${vendorStartDate}_${vendorEndDate}.csv`;
                    link.click();
                  }}
                  className="p-1 bg-[#0E2142] hover:bg-[#10B981] rounded transition-colors duration-200"
                  title="Excel İndir"
                >
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0E2142] rounded-lg p-3 hover:ring-1 hover:ring-[#2E86FF] transition cursor-pointer">
                <div className="text-[10px] text-[#A7B8D8] mb-1">HITACHI</div>
                <div className="text-2xl font-bold text-[#2E86FF]">167</div>
                <div className="text-[9px] text-[#A7B8D8] mt-1">58% toplam</div>
              </div>
              <div className="bg-[#0E2142] rounded-lg p-3 hover:ring-1 hover:ring-[#F2B705] transition cursor-pointer">
                <div className="text-[10px] text-[#A7B8D8] mb-1">GRG</div>
                <div className="text-2xl font-bold text-[#F2B705]">129</div>
                <div className="text-[9px] text-[#A7B8D8] mt-1">42% toplam</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showOutliers && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowOutliers(false)}
        >
          <div
            className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-4xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B]">
              <div className="text-lg font-semibold">Outliers / Alerts</div>
              <button
                onClick={() => setShowOutliers(false)}
                className="text-[#A7B8D8] hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(80vh - 80px)" }}>
              <div className="grid gap-3">
                {top10.slice(0, 8).map((r) => (
                  <div
                    key={String(r.atm_id)}
                    className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B] hover:bg-[#1C2E52] transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">ATM {r.atm_id} — {r.atm_name}</div>
                        <div className="text-xs text-[#A7B8D8] mt-1">{r.city} / {r.district}</div>
                        <div className="text-xs text-[#A7B8D8]">{r.reason}</div>
                      </div>
                      <div
                        className={
                          "px-3 py-1 rounded-lg text-xs font-semibold " +
                          (r.risk_band === "High"
                            ? "bg-red-500/20 text-red-400"
                            : r.risk_band === "Medium"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-blue-500/20 text-blue-400")
                        }
                      >
                        {r.risk_band}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* AI Motor Önerileri Modal */}
      {showAiRecommendations && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowAiRecommendations(false)}
        >
          <div
            className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-5xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[#2B416B]">
              <div>
                <div className="text-lg font-semibold flex items-center gap-2">
                  🤖 AI Motor Önerileri
                  <span className="px-2.5 py-1 rounded-full bg-[#10B981]/20 text-[#10B981] text-xs font-semibold">Aktif</span>
                </div>
                <div className="text-sm text-[#A7B8D8] mt-1">SLM açılması önerilen ATM'ler</div>
              </div>
              <button
                onClick={() => setShowAiRecommendations(false)}
                className="text-[#A7B8D8] hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(85vh - 100px)" }}>
              <div className="grid gap-3">
                {top10.filter(r => Math.round(r.slm_prob * 100) > 40).map((r) => {
                  const pct = Math.round(r.slm_prob * 100);
                  return (
                    <div
                      key={String(r.atm_id)}
                      className="bg-[#0E2142] rounded-xl p-4 ring-1 ring-[#2B416B] hover:bg-[#1C2E52] transition"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-bold text-lg">ATM {r.atm_id}</div>
                          <div className="text-[#A7B8D8] mt-1">{r.atm_name}</div>
                          <div className="text-sm text-[#A7B8D8]">{r.city} / {r.district}</div>
                          {r.availability && (
                            <div className={`text-xs font-semibold mt-1 ${
                              r.availability < 70 ? 'text-[#E63946]' : 
                              r.availability < 90 ? 'text-[#F2B705]' : 
                              'text-[#10B981]'
                            }`}>
                              ⚡ Avail: {r.availability.toFixed(1)}%
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                            r.risk_band === "High" ? "bg-[#E63946]/20 text-[#E63946]" :
                            r.risk_band === "Medium" ? "bg-[#F2B705]/20 text-[#F2B705]" :
                            "bg-[#2E86FF]/20 text-[#2E86FF]"
                          }`}>
                            {r.risk_band} Risk
                          </div>
                          <div className="text-[#10B981] font-bold mt-2">
                            💰 ${(r.expected_saving_try / 36).toFixed(0)} tasarruf
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-[#112544] rounded-lg p-3 mb-3">
                        <div className="text-xs text-[#A7B8D8] mb-1">Arıza Sebebi:</div>
                        <div className="text-sm">{r.reason}</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs text-[#A7B8D8] mb-1">
                            <span>SLM Olasılığı</span>
                            <span className="font-bold text-white">{pct}%</span>
                          </div>
                          <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                            <div className="h-2 bg-[#F2B705] rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        {(() => {
                          const atmData = atms.find(a => String(a.atm_id) === String(r.atm_id));
                          const vendor = atmData?.brand || "HITACHI";
                          return (
                            <button className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                              pct > 70 ? "bg-[#E63946] hover:bg-[#E63946]/90" :
                              pct > 40 ? "bg-[#F2B705] hover:bg-[#F2B705]/90" :
                              "bg-[#10B981] hover:bg-[#10B981]/90"
                            }`}>
                              🔧 SLM {vendor}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OFFSITE Kritik Modal */}
      {showOffsiteCritical && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowOffsiteCritical(false)}
        >
          <div
            className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-5xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[#2B416B]">
              <div>
                <div className="text-lg font-semibold flex items-center gap-2">
                  🚨 OFFSITE Kritik ATM'ler
                  <span className="px-2.5 py-1 rounded-full bg-[#E63946]/20 text-[#E63946] text-xs font-semibold">Yüksek Risk</span>
                </div>
                <div className="text-sm text-[#A7B8D8] mt-1">Acil müdahale gerektiren OFFSITE ATM'ler</div>
              </div>
              <button
                onClick={() => setShowOffsiteCritical(false)}
                className="text-[#A7B8D8] hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(85vh - 100px)" }}>
              <div className="grid gap-3">
                {atms.filter(a => a.location_type === "Offsite").slice(0, 8).map((a) => {
                  const band = top10Band.get(String(a.atm_id)) ?? "High";
                  const topItem = top10.find(t => String(t.atm_id) === String(a.atm_id));
                  
                  return (
                    <div
                      key={String(a.atm_id)}
                      className="bg-[#0E2142] rounded-xl p-4 ring-1 ring-[#2B416B] hover:bg-[#1C2E52] transition"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-bold text-lg flex items-center gap-2">
                            ATM {a.atm_id}
                            <span className="text-xs px-2 py-0.5 rounded bg-[#2E86FF]/20 text-[#2E86FF]">OFFSITE</span>
                          </div>
                          <div className="text-[#A7B8D8] mt-1">{a.atm_name || "N/A"}</div>
                          <div className="text-sm text-[#A7B8D8]">{a.city} / {a.district}</div>
                          <div className="text-xs text-[#A7B8D8] mt-1">📍 Şube dışı lokasyon - BANTAŞ FLM</div>
                          {(() => {
                            const data = top10Data.get(String(a.atm_id));
                            let avail = data?.availability;
                            
                            // Eğer top10'da yoksa, simüle availability üret (OFFSITE genelde daha düşük)
                            if (avail === undefined) {
                              const hash = (a.atm_id.charCodeAt(0) * 7 + a.atm_id.charCodeAt(a.atm_id.length - 1) * 13) % 100;
                              avail = 85 + (hash / 10); // OFFSITE için 85-95% arası
                            }
                            
                            const color = avail < 70 ? 'text-[#E63946]' : avail < 90 ? 'text-[#F2B705]' : 'text-[#10B981]';
                            return (
                              <div className={`text-xs font-semibold mt-1 ${color}`}>
                                ⚡ Avail: {avail.toFixed(1)}%
                              </div>
                            );
                          })()}
                        </div>
                        <div className="text-right">
                          <div className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#E63946]/20 text-[#E63946]">
                            {band} Risk
                          </div>
                          {topItem && (
                            <div className="text-[#F2B705] font-bold mt-2 text-sm">
                              ⚡ Acil Müdahale
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {topItem && (
                        <div className="bg-[#112544] rounded-lg p-3 mb-3">
                          <div className="text-xs text-[#A7B8D8] mb-1">Durum:</div>
                          <div className="text-sm">{topItem.reason}</div>
                          <div className="text-xs text-[#F2B705] mt-2">
                            {Math.round(topItem.slm_prob * 100) > 70 ? `⚠️ SLM gerekiyor (${a.brand || "HITACHI"})` : 
                             Math.round(topItem.slm_prob * 100) > 40 ? "⚡ FLM→SLM geçiş olasılığı yüksek" : 
                             "✓ FLM yeterli (BANTAŞ)"}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-[#2E86FF] hover:bg-[#2E86FF]/90">
                          🚗 BANTAŞ FLM
                        </button>
                        {topItem && Math.round(topItem.slm_prob * 100) > 40 && (
                          <button className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#E63946] hover:bg-[#E63946]/90">
                            🔧 {a.brand || "HITACHI"} SLM
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Önleyici Bakım Modal */}
      {showPreventiveMaintenance && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowPreventiveMaintenance(false)}
        >
          <div
            className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-5xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[#2B416B]">
              <div>
                <div className="text-lg font-semibold flex items-center gap-2">
                  💡 Önleyici Bakım Önerileri
                  <span className="px-2.5 py-1 rounded-full bg-[#2E86FF]/20 text-[#2E86FF] text-xs font-semibold">Planlı</span>
                </div>
                <div className="text-sm text-[#A7B8D8] mt-1">Arızaları önlemek için planlı SLM önerileri</div>
              </div>
              <button
                onClick={() => setShowPreventiveMaintenance(false)}
                className="text-[#A7B8D8] hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(85vh - 100px)" }}>
              <div className="grid gap-3">
                {preventiveMaintenanceAtms.length === 0 ? (
                  <div className="text-[#A7B8D8] text-center py-8">
                    <div className="text-4xl mb-2">✓</div>
                    <div>Tüm ATM'ler optimal durumda</div>
                  </div>
                ) : (
                  preventiveMaintenanceAtms.map((r) => {
                    const pct = Math.round(r.slm_prob * 100);
                    return (
                    <div
                      key={String(r.atm_id)}
                      className="bg-[#0E2142] rounded-xl p-4 ring-1 ring-[#2B416B] hover:bg-[#1C2E52] transition"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-bold text-lg">ATM {r.atm_id}</div>
                          <div className="text-[#A7B8D8] mt-1">{r.atm_name}</div>
                          <div className="text-sm text-[#A7B8D8]">{r.city} / {r.district}</div>
                          {r.availability && (
                            <div className={`text-xs font-semibold mt-1 ${
                              r.availability < 70 ? 'text-[#E63946]' : 
                              r.availability < 90 ? 'text-[#F2B705]' : 
                              'text-[#10B981]'
                            }`}>
                              ⚡ Avail: {r.availability.toFixed(1)}%
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#10B981]/20 text-[#10B981]">
                            Önleyici
                          </div>
                          <div className="text-[#10B981] font-bold mt-2">
                            💰 ${(r.expected_saving_try / 36).toFixed(0)} tasarruf
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-[#112544] rounded-lg p-3 mb-3">
                        <div className="text-xs text-[#A7B8D8] mb-1">Öngörülen Sorun:</div>
                        <div className="text-sm">{r.reason}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-[#112544] rounded-lg p-2">
                          <div className="text-xs text-[#A7B8D8]">Planlı SLM ({r.atm_id})</div>
                          <div className="text-lg font-bold text-[#10B981]">$120</div>
                        </div>
                        <div className="bg-[#112544] rounded-lg p-2">
                          <div className="text-xs text-[#A7B8D8]">Arıza Durumunda</div>
                          <div className="text-lg font-bold text-[#E63946]">$450</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {(() => {
                          const atmData = atms.find(a => String(a.atm_id) === String(r.atm_id));
                          const vendor = atmData?.brand || "HITACHI";
                          return (
                            <button className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-[#2E86FF] hover:bg-[#2E86FF]/90">
                              🔧 {vendor} SLM
                            </button>
                          );
                        })()}
                        <button className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#2B416B] hover:bg-[#2B416B]/90">
                          ⏰ Ertele
                        </button>
                      </div>
                    </div>
                  );
                }))}
              </div>
            </div>
          </div>
        </div>
      )}
      {showZones && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowZones(false)}
        >
          <div
            className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-3xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B]">
              <div className="text-lg font-semibold">Risk by Zone</div>
              <button
                onClick={() => setShowZones(false)}
                className="text-[#A7B8D8] hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(80vh - 80px)" }}>
              {zones.length === 0 ? (
                <div className="text-[#A7B8D8] text-sm">Loading…</div>
              ) : (
                <div className="grid gap-3">
                  {zones.map((z) => (
                    <div key={z.zone} className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B]">
                      <div className="flex items-center justify-between text-xs text-[#A7B8D8] mb-2">
                        <span>{z.zone}</span>
                        <span>{Math.round(z.risk * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                        <div
                          className="h-2 bg-[#2E86FF] rounded-full"
                          style={{ width: `${Math.round(z.risk * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Günlük Özet Detay Modalleri */}
      {showDailySummaryDetail === 'total' && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowDailySummaryDetail(null)}
        >
          <div
            className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-4xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[#2B416B]">
              <div className="text-lg font-semibold">Toplam Müdahale Detayı</div>
              <button
                onClick={() => setShowDailySummaryDetail(null)}
                className="text-[#A7B8D8] hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(85vh - 80px)" }}>
              <div className="text-sm text-[#A7B8D8]">Toplam müdahale detay bilgileri buraya gelecek...</div>
            </div>
          </div>
        </div>
      )}

      {showDailySummaryDetail === 'flm' && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowDailySummaryDetail(null)}
        >
          <div
            className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-4xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[#2B416B]">
              <div className="text-lg font-semibold">FLM Başarı Detayı</div>
              <button
                onClick={() => setShowDailySummaryDetail(null)}
                className="text-[#A7B8D8] hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(85vh - 80px)" }}>
              <div className="text-sm text-[#A7B8D8]">FLM başarı detay bilgileri buraya gelecek...</div>
            </div>
          </div>
        </div>
      )}

      {showDailySummaryDetail === 'slm' && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowDailySummaryDetail(null)}
        >
          <div
            className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-4xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[#2B416B]">
              <div className="text-lg font-semibold">SLM Gerekli Detayı</div>
              <button
                onClick={() => setShowDailySummaryDetail(null)}
                className="text-[#A7B8D8] hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(85vh - 80px)" }}>
              <div className="text-sm text-[#A7B8D8]">SLM gerekli detay bilgileri buraya gelecek...</div>
            </div>
          </div>
        </div>
      )}

      {showDailySummaryDetail === 'saving' && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowDailySummaryDetail(null)}
        >
          <div
            className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-4xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[#2B416B]">
              <div className="text-lg font-semibold">Tasarruf Detayı</div>
              <button
                onClick={() => setShowDailySummaryDetail(null)}
                className="text-[#A7B8D8] hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(85vh - 80px)" }}>
              <div className="text-sm text-[#A7B8D8]">Tasarruf detay bilgileri buraya gelecek...</div>
            </div>
          </div>
        </div>
      )}

      {/* Zone Detay Modal */}
      {showZones && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowZones(false)}
        >
          <div
            className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-3xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B]">
              <div className="text-lg font-semibold">Risk by Zone</div>
              <button
                onClick={() => setShowZones(false)}
                className="text-[#A7B8D8] hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(80vh - 80px)" }}>
              {zones.length === 0 ? (
                <div className="text-[#A7B8D8] text-sm">Loading…</div>
              ) : (
                <div className="grid gap-3">
                  {zones.map((z) => (
                    <div key={z.zone} className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B]">
                      <div className="flex items-center justify-between text-xs text-[#A7B8D8] mb-2">
                        <span>{z.zone}</span>
                        <span>{Math.round(z.risk * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                        <div
                          className="h-2 bg-[#2E86FF] rounded-full"
                          style={{ width: `${Math.round(z.risk * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SLM Alert Modal */}
      {selectedAlert && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={() => setSelectedAlert(null)}
        >
          <div
            className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-4xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#2B416B]">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    selectedAlert.severity === "High" ? "bg-[#E63946]/20 text-[#E63946]" :
                    selectedAlert.severity === "Medium" ? "bg-[#F2B705]/20 text-[#F2B705]" :
                    "bg-[#2E86FF]/20 text-[#2E86FF]"
                  }`}>
                    {selectedAlert.severity === "High" ? "🚨 HIGH" :
                     selectedAlert.severity === "Medium" ? "⚠️ MEDIUM" : "📅 LOW"}
                  </span>
                  <div className="text-lg font-semibold">{selectedAlert.title}</div>
                </div>
                <div className="text-sm text-[#A7B8D8]">
                  ATM {selectedAlert.atm_id} - {selectedAlert.atm_name} ({selectedAlert.city} / {selectedAlert.district})
                </div>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="text-[#A7B8D8] hover:text-white text-3xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(85vh - 160px)" }}>
              {/* Alert Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <div className="bg-[#0E2142] rounded-lg p-3">
                  <div className="text-[10px] text-[#A7B8D8] mb-1">ATM ID</div>
                  <div className="text-sm font-semibold text-white">
                    <span className="ml-2 text-white font-semibold">{selectedAlert.atm_id}</span>
                  </div>
                </div>
                <div className="bg-[#0E2142] rounded-lg p-3">
                  <div className="text-[10px] text-[#A7B8D8] mb-1">Şehir</div>
                  <div className="text-sm font-semibold text-white">
                    <span className="ml-2 text-white font-semibold">{selectedAlert.city}</span>
                  </div>
                </div>
                <div className="bg-[#0E2142] rounded-lg p-3">
                  <div className="text-[10px] text-[#A7B8D8] mb-1">İlçe</div>
                  <div className="text-sm font-semibold text-white">
                    <span className="ml-2 text-white font-semibold">{selectedAlert.district}</span>
                  </div>
                </div>
                <div className="bg-[#0E2142] rounded-lg p-3">
                  <div className="text-[10px] text-[#A7B8D8] mb-1">ETA</div>
                  <div className="text-sm font-semibold text-white">
                    <span className="ml-2 text-white font-semibold">{selectedAlert.eta}</span>
                  </div>
                </div>
              </div>

              {/* AI Analysis */}
              <div className="bg-[#0E2142] rounded-xl p-4 mb-5">
                <div className="text-sm font-semibold text-white mb-3">🧠 AI Analiz Özeti</div>
                <div className="space-y-2">
                  {selectedAlert.flm_count_48h !== undefined && selectedAlert.flm_count_48h > 1 && (
                    <div className="bg-[#E63946]/10 rounded-lg p-3 ring-1 ring-[#E63946]/30">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[#E63946]">🚨</span>
                        <div className="text-xs font-semibold text-[#E63946]">48 Saat Tekrar Uyarısı</div>
                      </div>
                      <div className="text-xs text-[#A7B8D8]">
                          Son 48 saatte {selectedAlert.flm_count_48h} kez FLM gönderildi. Sorun çözülemedi.
                      </div>
                    </div>
                  )}
                  
                  {selectedAlert.flm_count_7d !== undefined && selectedAlert.flm_count_7d > 3 && (
                    <div className="bg-[#F2B705]/10 rounded-lg p-3 ring-1 ring-[#F2B705]/30">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[#F2B705]">⚠️</span>
                        <div className="text-xs font-semibold text-[#F2B705]">Haftalık Müdahale Sıklığı</div>
                      </div>
                      <div className="text-xs text-[#A7B8D8]">
                          Son 7 günde {selectedAlert.flm_count_7d} FLM müdahalesi yapıldı.
                      </div>
                    </div>
                  )}
                  
                  {selectedAlert.last_slm_days_ago !== undefined && selectedAlert.last_slm_days_ago > 90 && (
                    <div className="bg-[#2E86FF]/10 rounded-lg p-3 ring-1 ring-[#2E86FF]/30">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[#2E86FF]">🔧</span>
                        <div className="text-xs font-semibold text-[#2E86FF]">Uzun Süre SLM Yok</div>
                      </div>
                      <div className="text-xs text-[#A7B8D8]">
                          Son SLM bakımı {selectedAlert.last_slm_days_ago} gün önce yapıldı.
                      </div>
                    </div>
                  )}
                  
                  {selectedAlert.repeat_issue && selectedAlert.last_solution && (
                    <div className="bg-[#E63946]/10 rounded-lg p-3 ring-1 ring-[#E63946]/30">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[#E63946]">🔄</span>
                        <div className="text-xs font-semibold text-[#E63946]">Tekrar Eden Sorun</div>
                      </div>
                      <div className="text-xs text-[#A7B8D8]">
                          Önceki çözüm: {selectedAlert.last_solution}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Problem & Solution */}
              <div className="bg-[#0E2142] rounded-xl p-4 mb-5">
                <div className="text-sm font-semibold text-white mb-3">📋 Problem ve Önerilen Aksiyon</div>
                <div className="text-sm text-[#A7B8D8] mb-3">{selectedAlert.summary}</div>
                <div className="text-sm text-white">{selectedAlert.action}</div>
              </div>

              {/* Status */}
              {selectedAlert.status && selectedAlert.status !== "pending" && (
                <div className="bg-[#10B981]/10 rounded-xl p-4 mb-5 ring-1 ring-[#10B981]/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[#10B981] text-xl">✓</span>
                    <div>
                      <div className="text-sm font-semibold text-[#10B981]">
                          {selectedAlert.status === "slm_opened" ? "SLM İşi Açıldı" :
                           selectedAlert.status === "scheduled_maintenance" ? "Bakım Planlandı" :
                           "İşlem Yapıldı"}
                      </div>
                      <div className="text-xs text-[#A7B8D8] mt-1">
                          {selectedAlert.decision_by && `Karar Veren: ${selectedAlert.decision_by} `}
                          {selectedAlert.decision_at && `(${selectedAlert.decision_at})`}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="border-t border-[#2B416B] p-5">
              {(!selectedAlert.status || selectedAlert.status === "pending") ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (selectedAlert) {
                        setAlerts(alerts.map(a =>
                          a.id === selectedAlert.id
                            ? { ...a, status: "slm_opened", decision_by: "John Doe", decision_at: new Date().toLocaleString('tr-TR') }
                            : a
                        ));
                        setSelectedAlert(null);
                        alert('SLM işi açıldı ve vendor\'a bildirildi.');
                      }
                    }}
                    className="flex-1 px-4 py-3 bg-[#E63946] hover:bg-[#D32F3E] text-white font-semibold rounded-lg transition"
                  >
                    🚨 SLM Aç
                  </button>
                  <button
                    onClick={() => {
                      if (selectedAlert) {
                        setAlerts(alerts.map(a =>
                          a.id === selectedAlert.id
                            ? { ...a, status: "scheduled_maintenance", decision_by: "John Doe", decision_at: new Date().toLocaleString('tr-TR') }
                            : a
                        ));
                        setSelectedAlert(null);
                        alert('Bakım planlandı.');
                      }
                    }}
                    className="flex-1 px-4 py-3 bg-[#2E86FF] hover:bg-[#1F6FE0] text-white font-semibold rounded-lg transition"
                  >
                    📅 Bakım Planla
                  </button>
                  <button
                    onClick={() => {
                      if (selectedAlert) {
                        setAlerts(alerts.map(a =>
                          a.id === selectedAlert.id
                            ? { ...a, status: "rejected", decision_by: "John Doe", decision_at: new Date().toLocaleString('tr-TR') }
                            : a
                        ));
                        setSelectedAlert(null);
                        alert('Öneri reddedildi.');
                      }
                    }}
                    className="px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition"
                  >
                    ❌ Reddet
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="w-full px-4 py-3 bg-[#2E86FF] hover:bg-[#1F6FE0] text-white font-semibold rounded-lg transition"
                >
                  Kapat
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Günlük Özet Detay Modalleri */}
      {showDailySummaryDetail === 'total' && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowDailySummaryDetail(null)}
        >
          <div
            className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-4xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[#2B416B]">
              <div>
                <div className="text-lg font-semibold">📊 Toplam Müdahale Detayı</div>
                <div className="text-sm text-[#A7B8D8] mt-1">Bugün gerçekleştirilen tüm müdahaleler</div>
              </div>
              <button
                onClick={() => setShowDailySummaryDetail(null)}
                className="text-[#A7B8D8] hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(85vh - 100px)" }}>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-[#0E2142] rounded-xl p-4">
                  <div className="text-xs text-[#A7B8D8] mb-2">Bugün</div>
                  <div className="text-3xl font-bold text-white">47</div>
                </div>
                <div className="bg-[#0E2142] rounded-xl p-4">
                  <div className="text-xs text-[#A7B8D8] mb-2">Dün</div>
                  <div className="text-3xl font-bold text-[#A7B8D8]">44</div>
                </div>
                <div className="bg-[#0E2142] rounded-xl p-4">
                  <div className="text-xs text-[#A7B8D8] mb-2">7 Gün Ort.</div>
                  <div className="text-3xl font-bold text-[#A7B8D8]">42</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="text-sm font-semibold mb-3">Müdahale Dağılımı</div>
                {[
                  { type: 'FLM Başarılı', count: 41, color: '#10B981' },
                  { type: 'SLM Gerekli', count: 6, color: '#E63946' },
                  { type: 'Devam Eden', count: 3, color: '#F2B705' }
                ].map((item) => (
                  <div key={item.type} className="bg-[#0E2142] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white">{item.type}</span>
                      <span className="text-lg font-bold" style={{ color: item.color }}>{item.count}</span>
                    </div>
                    <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                      <div className="h-2 rounded-full" style={{ width: `${(item.count / 47) * 100}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showDailySummaryDetail === 'flm' && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowDailySummaryDetail(null)}
        >
          <div
            className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-4xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[#2B416B]">
              <div>
                <div className="text-lg font-semibold text-[#10B981]">✅ FLM Başarı Detayı</div>
                <div className="text-sm text-[#A7B8D8] mt-1">BANTAŞ FLM müdahale performansı</div>
              </div>
              <button
                onClick={() => setShowDailySummaryDetail(null)}
                className="text-[#A7B8D8] hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(85vh - 100px)" }}>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-[#0E2142] rounded-xl p-4">
                  <div className="text-xs text-[#A7B8D8] mb-2">Bugün Başarılı</div>
                  <div className="text-3xl font-bold text-[#10B981]">41</div>
                  <div className="text-xs text-[#A7B8D8] mt-1">87% oran</div>
                </div>
                <div className="bg-[#0E2142] rounded-xl p-4">
                  <div className="text-xs text-[#A7B8D8] mb-2">Dün</div>
                  <div className="text-3xl font-bold text-[#A7B8D8]">38</div>
                  <div className="text-xs text-[#A7B8D8] mt-1">86% oran</div>
                </div>
                <div className="bg-[#0E2142] rounded-xl p-4">
                  <div className="text-xs text-[#A7B8D8] mb-2">7 Gün Ort.</div>
                  <div className="text-3xl font-bold text-[#A7B8D8]">36</div>
                  <div className="text-xs text-[#A7B8D8] mt-1">85% oran</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="text-sm font-semibold mb-3">FLM Müdahale Tipleri</div>
                {[
                  { type: 'Card Reader Temizlik', count: 18, pct: 44 },
                  { type: 'Receipt Printer', count: 12, pct: 29 },
                  { type: 'Cash Dispenser Jam', count: 8, pct: 20 },
                  { type: 'Diğer', count: 3, pct: 7 }
                ].map((item) => (
                  <div key={item.type} className="bg-[#0E2142] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white">{item.type}</span>
                      <span className="text-sm font-bold text-[#10B981]">{item.count} ({item.pct}%)</span>
                    </div>
                    <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                      <div className="h-2 bg-[#10B981] rounded-full" style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showDailySummaryDetail === 'slm' && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowDailySummaryDetail(null)}
        >
          <div
            className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-4xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[#2B416B]">
              <div>
                <div className="text-lg font-semibold text-[#E63946]">🚨 SLM Gerekli Detayı</div>
                <div className="text-sm text-[#A7B8D8] mt-1">Vendor SLM müdahale gerektiren durumlar</div>
              </div>
              <button
                onClick={() => setShowDailySummaryDetail(null)}
                className="text-[#A7B8D8] hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(85vh - 100px)" }}>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[#0E2142] rounded-xl p-4">
                  <div className="text-xs text-[#A7B8D8] mb-2">Bugün SLM</div>
                  <div className="text-3xl font-bold text-[#E63946]">6</div>
                  <div className="text-xs text-[#E63946] mt-1">13% oran</div>
                </div>
                <div className="bg-[#0E2142] rounded-xl p-4">
                  <div className="text-xs text-[#A7B8D8] mb-2">7 Gün Ort.</div>
                  <div className="text-3xl font-bold text-[#A7B8D8]">5</div>
                  <div className="text-xs text-[#A7B8D8] mt-1">12% oran</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="text-sm font-semibold mb-3">Vendor Dağılımı</div>
                {[
                  { vendor: 'HITACHI SLM', count: 4, color: '#2E86FF' },
                  { vendor: 'GRG SLM', count: 2, color: '#F2B705' }
                ].map((item) => (
                  <div key={item.vendor} className="bg-[#0E2142] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white">{item.vendor}</span>
                      <span className="text-lg font-bold" style={{ color: item.color }}>{item.count}</span>
                    </div>
                    <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                      <div className="h-2 rounded-full" style={{ width: `${(item.count / 6) * 100}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                ))}
                
                <div className="text-sm font-semibold mt-6 mb-3">Kritik Arızalar</div>
                {atms.slice(0, 3).map((atm) => {
                  const data = top10Data.get(String(atm.atm_id));
                  let avail = data?.availability;
                  
                  // Eğer top10'da yoksa, simüle availability üret
                  if (avail === undefined) {
                    const hash = (atm.atm_id.charCodeAt(0) * 7 + atm.atm_id.charCodeAt(atm.atm_id.length - 1) * 13) % 100;
                    avail = 88 + (hash / 10); // 88-98% arası
                  }
                  
                  const availColor = avail < 70 ? 'text-[#E63946]' : avail < 90 ? 'text-[#F2B705]' : 'text-[#10B981]';
                  
                  return (
                    <div key={atm.atm_id} className="bg-[#0E2142] rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-white">ATM {atm.atm_id}</div>
                          <div className="text-xs text-[#A7B8D8]">{atm.atm_name || 'N/A'}</div>
                          <div className="text-xs text-[#A7B8D8]">{atm.city} - {atm.district}</div>
                          <div className={`text-xs font-semibold mt-1 ${availColor}`}>
                            ⚡ Avail: {avail.toFixed(1)}%
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-[#E63946]/20 text-[#E63946]">{atm.brand || 'HITACHI'} SLM</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {showDailySummaryDetail === 'saving' && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowDailySummaryDetail(null)}
        >
          <div
            className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-4xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[#2B416B]">
              <div>
                <div className="text-lg font-semibold text-[#F2B705]">💰 Tasarruf Detayı</div>
                <div className="text-sm text-[#A7B8D8] mt-1">FLM ile sağlanan maliyet tasarrufu</div>
              </div>
              <button
                onClick={() => setShowDailySummaryDetail(null)}
                className="text-[#A7B8D8] hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(85vh - 100px)" }}>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-[#0E2142] rounded-xl p-4">
                  <div className="text-xs text-[#A7B8D8] mb-2">Bugün</div>
                  <div className="text-3xl font-bold text-[#F2B705]">$1.8K</div>
                  <div className="text-xs text-[#10B981] mt-1">↑ $340 dün</div>
                </div>
                <div className="bg-[#0E2142] rounded-xl p-4">
                  <div className="text-xs text-[#A7B8D8] mb-2">Bu Hafta</div>
                  <div className="text-3xl font-bold text-[#A7B8D8]">$9.4K</div>
                  <div className="text-xs text-[#10B981] mt-1">↑ $1.2K</div>
                </div>
                <div className="bg-[#0E2142] rounded-xl p-4">
                  <div className="text-xs text-[#A7B8D8] mb-2">Bu Ay</div>
                  <div className="text-3xl font-bold text-[#A7B8D8]">$47K</div>
                  <div className="text-xs text-[#10B981] mt-1">↑ $8K</div>
                </div>
              </div>
              
              <div className="bg-[#0E2142] rounded-xl p-4 mb-6">
                <div className="text-sm font-semibold mb-3">Tasarruf Hesaplama</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#A7B8D8]">FLM Müdahale (41 adet):</span>
                    <span className="text-white">$44 × 41 = $1,804</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A7B8D8]">SLM Alternatif Maliyet:</span>
                    <span className="text-[#E63946]">$180 × 41 = $7,380</span>
                  </div>
                  <div className="border-t border-[#2B416B] my-2"></div>
                  <div className="flex justify-between font-bold">
                    <span className="text-[#F2B705]">Net Tasarruf:</span>
                    <span className="text-[#10B981]">$5,576</span>
                  </div>
                </div>
              </div>
              
              <div className="text-sm font-semibold mb-3">Aylık Trend</div>
              <div className="space-y-2">
                {[
                  { month: 'Ocak 2026', saving: '$47K', trend: '+18%' },
                  { month: 'Aralık 2025', saving: '$39K', trend: '+12%' },
                  { month: 'Kasım 2025', saving: '$35K', trend: '+8%' }
                ].map((item) => (
                  <div key={item.month} className="bg-[#0E2142] rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm text-white">{item.month}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-[#F2B705]">{item.saving}</span>
                      <span className="text-xs text-[#10B981]">{item.trend}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SLM Alert Modal */}
      {selectedAlert && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={() => setSelectedAlert(null)}
        >
          <div
            className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-4xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#2B416B]">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                    selectedAlert.severity === "High" ? "bg-[#E63946]/20 text-[#E63946]" :
                    selectedAlert.severity === "Medium" ? "bg-[#F2B705]/20 text-[#F2B705]" :
                    "bg-[#2E86FF]/20 text-[#2E86FF]"
                  }`}>
                    {selectedAlert.severity === "High" ? "🚨 HIGH" : 
                     selectedAlert.severity === "Medium" ? "⚠️ MEDIUM" : "📅 LOW"}
                  </span>
                  <div className="text-lg font-semibold">{selectedAlert.title}</div>
                </div>
                <div className="text-sm text-[#A7B8D8]">
                  ATM {selectedAlert.atm_id} - {selectedAlert.atm_name} ({selectedAlert.city} / {selectedAlert.district})
                </div>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="text-[#A7B8D8] hover:text-white text-2xl ml-4"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(85vh - 280px)" }}>
              {/* ATM Bilgileri */}
              <div className="bg-[#0E2142] rounded-xl p-4 mb-4">
                <div className="text-sm font-semibold mb-3">🏧 ATM Bilgileri</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-[#A7B8D8]">ATM ID:</span>
                    <span className="ml-2 text-white font-semibold">{selectedAlert.atm_id}</span>
                  </div>
                  <div>
                    <span className="text-[#A7B8D8]">Şehir:</span>
                    <span className="ml-2 text-white font-semibold">{selectedAlert.city}</span>
                  </div>
                  <div>
                    <span className="text-[#A7B8D8]">İlçe:</span>
                    <span className="ml-2 text-white font-semibold">{selectedAlert.district}</span>
                  </div>
                  <div>
                    <span className="text-[#A7B8D8]">ETA:</span>
                    <span className="ml-2 text-white font-semibold">{selectedAlert.eta}</span>
                  </div>
                </div>
              </div>

              {/* AI Analiz Detayı */}
              <div className="bg-[#0E2142] rounded-xl p-4 mb-4">
                <div className="text-sm font-semibold mb-3">🧠 AI Analiz Detayı</div>
                <div className="space-y-2">
                  {selectedAlert.flm_count_48h !== undefined && selectedAlert.flm_count_48h > 1 && (
                    <div className="flex items-start gap-2 p-2 bg-[#E63946]/10 rounded-lg">
                      <span className="text-[#E63946]">⚠️</span>
                      <div>
                        <div className="text-sm text-[#E63946] font-semibold">Tekrarlayan FLM Müdahalesi</div>
                        <div className="text-xs text-[#A7B8D8] mt-1">
                          Son 48 saatte {selectedAlert.flm_count_48h} kez FLM gönderildi. Sorun çözülemedi.
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedAlert.flm_count_7d !== undefined && selectedAlert.flm_count_7d > 3 && (
                    <div className="flex items-start gap-2 p-2 bg-[#F2B705]/10 rounded-lg">
                      <span className="text-[#F2B705]">📊</span>
                      <div>
                        <div className="text-sm text-[#F2B705] font-semibold">Yüksek FLM Frekansı</div>
                        <div className="text-xs text-[#A7B8D8] mt-1">
                          Son 7 günde {selectedAlert.flm_count_7d} FLM müdahalesi yapıldı.
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedAlert.last_slm_days_ago !== undefined && selectedAlert.last_slm_days_ago > 90 && (
                    <div className="flex items-start gap-2 p-2 bg-[#2E86FF]/10 rounded-lg">
                      <span className="text-[#2E86FF]">⏰</span>
                      <div>
                        <div className="text-sm text-[#2E86FF] font-semibold">Uzun Süredir SLM Yapılmamış</div>
                        <div className="text-xs text-[#A7B8D8] mt-1">
                          Son SLM bakımı {selectedAlert.last_slm_days_ago} gün önce yapıldı.
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedAlert.repeat_issue && selectedAlert.last_solution && (
                    <div className="flex items-start gap-2 p-2 bg-[#E63946]/10 rounded-lg">
                      <span className="text-[#E63946]">🔄</span>
                      <div>
                        <div className="text-sm text-[#E63946] font-semibold">Tekrarlayan Sorun</div>
                        <div className="text-xs text-[#A7B8D8] mt-1">
                          Önceki çözüm: {selectedAlert.last_solution}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Durum Özeti */}
              <div className="bg-[#0E2142] rounded-xl p-4 mb-4">
                <div className="text-sm font-semibold mb-3">📋 Durum Özeti</div>
                <div className="text-sm text-[#A7B8D8] mb-3">{selectedAlert.summary}</div>
                <div className="text-sm text-white">{selectedAlert.action}</div>
              </div>

              {/* Timeline (eğer status completed ise) */}
              {selectedAlert.status && selectedAlert.status !== "pending" && (
                <div className="bg-[#0E2142] rounded-xl p-4">
                  <div className="text-sm font-semibold mb-3">📅 Timeline</div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-[#10B981] mt-1.5"></div>
                      <div className="flex-1">
                        <div className="text-sm text-white font-semibold">
                          {selectedAlert.status === "slm_opened" ? "SLM İşi Açıldı" :
                           selectedAlert.status === "scheduled_maintenance" ? "Bakım Planlandı" :
                           "Reddedildi"}
                        </div>
                        <div className="text-xs text-[#A7B8D8] mt-1">
                          {selectedAlert.decision_by && `Karar Veren: ${selectedAlert.decision_by} `}
                          {selectedAlert.decision_at && `(${selectedAlert.decision_at})`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer - Action Buttons */}
            <div className="border-t border-[#2B416B] p-5">
              {(!selectedAlert.status || selectedAlert.status === "pending") ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        alert('SLM işi açılıyor - API entegrasyonu gerekli');
                        // TODO: API call to open SLM ticket
                      }}
                      className="px-4 py-3 rounded-xl bg-[#E63946] hover:bg-[#D32F3E] text-white font-semibold transition flex items-center justify-center gap-2"
                    >
                      <span>🚨</span>
                      <span>SLM İşi Aç (Teknisyen Gönder)</span>
                    </button>
                    <button
                      onClick={() => {
                        alert('Arıza geçmişi görüntüleniyor - API entegrasyonu gerekli');
                        // TODO: API call to show failure history
                      }}
                      className="px-4 py-3 rounded-xl bg-[#2E86FF] hover:bg-[#1F6FE0] text-white font-semibold transition flex items-center justify-center gap-2"
                    >
                      <span>📊</span>
                      <span>Arıza Geçmişi</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        alert('Bakım planlanıyor - API entegrasyonu gerekli');
                        // TODO: API call to schedule maintenance
                      }}
                      className="px-4 py-3 rounded-xl bg-[#F2B705] hover:bg-[#D39D04] text-white font-semibold transition flex items-center justify-center gap-2"
                    >
                      <span>📅</span>
                      <span>Bakım Planla</span>
                    </button>
                    <button
                      onClick={() => {
                        alert('SLM önerisi reddediliyor - FLM devam edecek');
                        // TODO: API call to reject SLM recommendation
                      }}
                      className="px-4 py-3 rounded-xl bg-gray-600 hover:bg-gray-700 text-white font-semibold transition flex items-center justify-center gap-2"
                    >
                      <span>⛔</span>
                      <span>Reddet (FLM Devam Etsin)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      alert('Rapor indiriliyor - API entegrasyonu gerekli');
                      // TODO: API call to download report
                    }}
                    className="flex-1 px-4 py-3 rounded-xl bg-[#10B981] hover:bg-[#0E9F6E] text-white font-semibold transition flex items-center justify-center gap-2"
                  >
                    <span>📥</span>
                    <span>Rapor İndir</span>
                  </button>
                  <button
                    onClick={() => setSelectedAlert(null)}
                    className="px-4 py-3 rounded-xl bg-gray-600 hover:bg-gray-700 text-white font-semibold transition"
                  >
                    Kapat
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Correlation Analysis - Arıza Risk Faktörleri */}
      <div className="bg-[#112544] rounded-2xl p-6 ring-1 ring-[#2B416B] mt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-semibold flex items-center gap-2">
              🔍 Correlation Analysis
            </div>
            <div className="text-xs text-[#A7B8D8] mt-1">
              Hangi faktörler arıza riskini artırıyor? AI destekli korelasyon analizi
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-semibold">
            AI Powered
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Korelasyon Faktörü 1: ATM Yaşı */}
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#EF4444]/50">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-white">📅 ATM Yaşı</div>
              <div className="text-xs px-2 py-1 rounded bg-[#EF4444]/20 text-[#EF4444] font-semibold">
                Yüksek Risk
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-2xl font-bold text-[#EF4444]">0.78</div>
              <div className="text-xs text-[#A7B8D8]">Korelasyon Katsayısı</div>
            </div>
            <div className="text-xs text-[#A7B8D8] mb-3">
              5+ yaşındaki ATM'lerde arıza riski %78 daha yüksek
            </div>
            <div className="w-full bg-[#0E2142] rounded-full h-2">
              <div className="bg-gradient-to-r from-[#EF4444] to-[#DC2626] h-2 rounded-full" style={{width: '78%'}}></div>
            </div>
          </div>

          {/* Korelasyon Faktörü 2: İşlem Hacmi */}
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#F59E0B]/50">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-white">📊 Yüksek İşlem Hacmi</div>
              <div className="text-xs px-2 py-1 rounded bg-[#F59E0B]/20 text-[#F59E0B] font-semibold">
                Orta Risk
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-2xl font-bold text-[#F59E0B]">0.64</div>
              <div className="text-xs text-[#A7B8D8]">Korelasyon Katsayısı</div>
            </div>
            <div className="text-xs text-[#A7B8D8] mb-3">
              Günlük 500+ işlem yapan ATM'lerde mekanik aşınma riski
            </div>
            <div className="w-full bg-[#0E2142] rounded-full h-2">
              <div className="bg-gradient-to-r from-[#F59E0B] to-[#F97316] h-2 rounded-full" style={{width: '64%'}}></div>
            </div>
          </div>

          {/* Korelasyon Faktörü 3: Bakım Gecikmesi / Eksik Hatalı Teknisyen Müdahalesi */}
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#EF4444]/50">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-white">🔧 Bakım Gecikmesi/ Eksik Hatalı Teknisyen Müdahalesi</div>
              <div className="text-xs px-2 py-1 rounded bg-[#EF4444]/20 text-[#EF4444] font-semibold">
                Yüksek Risk
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-2xl font-bold text-[#EF4444]">0.82</div>
              <div className="text-xs text-[#A7B8D8]">Korelasyon Katsayısı</div>
            </div>
            <div className="text-xs text-[#A7B8D8] mb-3">
              Bakım gecikmesi, eksik müdahale veya hatalı teknisyen operasyonu durumunda kritik arıza riski %82 artıyor
            </div>
            <div className="w-full bg-[#0E2142] rounded-full h-2">
              <div className="bg-gradient-to-r from-[#EF4444] to-[#DC2626] h-2 rounded-full" style={{width: '82%'}}></div>
            </div>
          </div>

          {/* Korelasyon Faktörü 4: Çevresel Faktörler */}
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#F59E0B]/50">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-white">🌡️ Sıcaklık/Nem</div>
              <div className="text-xs px-2 py-1 rounded bg-[#F59E0B]/20 text-[#F59E0B] font-semibold">
                Orta Risk
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-2xl font-bold text-[#F59E0B]">0.58</div>
              <div className="text-xs text-[#A7B8D8]">Korelasyon Katsayısı</div>
            </div>
            <div className="text-xs text-[#A7B8D8] mb-3">
              Aşırı sıcak/soğuk ve nemli ortamlarda donanım arızası riski
            </div>
            <div className="w-full bg-[#0E2142] rounded-full h-2">
              <div className="bg-gradient-to-r from-[#F59E0B] to-[#F97316] h-2 rounded-full" style={{width: '58%'}}></div>
            </div>
          </div>

          {/* Korelasyon Faktörü 5: Marka/Model */}
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#10B981]/50">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-white">🏷️ GRG vs HITACHI</div>
              <div className="text-xs px-2 py-1 rounded bg-[#10B981]/20 text-[#10B981] font-semibold">
                Düşük Risk
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-2xl font-bold text-[#10B981]">0.32</div>
              <div className="text-xs text-[#A7B8D8]">Korelasyon Katsayısı</div>
            </div>
            <div className="text-xs text-[#A7B8D8] mb-3">
              Marka/model arıza riskinde önemli fark yaratmıyor (her ikisi de kaliteli)
            </div>
            <div className="w-full bg-[#0E2142] rounded-full h-2">
              <div className="bg-gradient-to-r from-[#10B981] to-[#059669] h-2 rounded-full" style={{width: '32%'}}></div>
            </div>
          </div>
        </div>

        {/* AI Insights */}
        <div className="mt-4 bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🤖</div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-purple-400 mb-2">AI Recommendation</div>
              <div className="text-xs text-[#A7B8D8] leading-relaxed">
                <strong className="text-white">En Kritik Risk Faktörleri:</strong> Bakım gecikmesi (0.82) ve ATM yaşı (0.78) en yüksek korelasyona sahip. 
                <strong className="text-white ml-2">Öneri:</strong> 5+ yaşındaki ATM'lere öncelikli olarak proaktif bakım planı uygulanmalı. 
                30 günden fazla gecikmiş bakımlar acil müdahale listesine alınmalı. Bu iki faktörü optimize ederek arıza oranını %40-50 azaltabilirsiniz.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FLM/SLM Kayıt Pattern Analizi */}
      <FLMSLMPatternAnalysis />

      {/* Planlı vs Plansız Arıza Trend Grafiği */}
      <PlannedUnplannedFaultChart />

      {/* Availability Trend Grafiği */}
      <div className="bg-[#112544] rounded-2xl p-5 ring-1 ring-[#2B416B] mt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-semibold">📊 Availability Trend Analizi</div>
            <div className="text-xs text-[#A7B8D8] mt-1">Genel, Para Çekme ve Para Yatırma availability trendleri</div>
          </div>
        </div>

        {/* Filtreler */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Lokasyon Tipi */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setAvailTrendLocationType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                availTrendLocationType === 'all'
                  ? 'bg-[#2E86FF] text-white'
                  : 'bg-[#0E2142] text-[#A7B8D8] hover:bg-[#1a2f54]'
              }`}
            >
              Tüm Lokasyonlar
            </button>
            <button
              onClick={() => setAvailTrendLocationType('Şube')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                availTrendLocationType === 'Şube'
                  ? 'bg-[#2E86FF] text-white'
                  : 'bg-[#0E2142] text-[#A7B8D8] hover:bg-[#1a2f54]'
              }`}
            >
              🏢 Şube
            </button>
            <button
              onClick={() => setAvailTrendLocationType('Offsite')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                availTrendLocationType === 'Offsite'
                  ? 'bg-[#2E86FF] text-white'
                  : 'bg-[#0E2142] text-[#A7B8D8] hover:bg-[#1a2f54]'
              }`}
            >
              📍 Offsite
            </button>
          </div>

          {/* Vendor */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setAvailTrendVendor('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                availTrendVendor === 'all'
                  ? 'bg-[#10B981] text-white'
                  : 'bg-[#0E2142] text-[#A7B8D8] hover:bg-[#1a2f54]'
              }`}
            >
              Tüm Vendorlar
            </button>
            <button
              onClick={() => setAvailTrendVendor('GRG')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                availTrendVendor === 'GRG'
                  ? 'bg-[#10B981] text-white'
                  : 'bg-[#0E2142] text-[#A7B8D8] hover:bg-[#1a2f54]'
              }`}
            >
              GRG
            </button>
            <button
              onClick={() => setAvailTrendVendor('HITACHI')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                availTrendVendor === 'HITACHI'
                  ? 'bg-[#10B981] text-white'
                  : 'bg-[#0E2142] text-[#A7B8D8] hover:bg-[#1a2f54]'
              }`}
            >
              HITACHI
            </button>
          </div>

          {/* Bölge */}
          <select
            value={availTrendRegion}
            onChange={(e) => setAvailTrendRegion(e.target.value)}
            className="bg-[#0E2142] text-white text-xs rounded-lg px-3 py-1.5 border border-[#2B416B] outline-none cursor-pointer hover:bg-[#1a2f54]"
          >
            <option value="all">Tüm Bölgeler</option>
            <option value="Marmara">Marmara</option>
            <option value="Ege">Ege</option>
            <option value="Akdeniz">Akdeniz</option>
            <option value="İç Anadolu">İç Anadolu</option>
            <option value="Karadeniz">Karadeniz</option>
            <option value="Doğu Anadolu">Doğu Anadolu</option>
            <option value="Güneydoğu Anadolu">Güneydoğu Anadolu</option>
          </select>

          {/* İl */}
          <select
            value={availTrendCity}
            onChange={(e) => setAvailTrendCity(e.target.value)}
            className="bg-[#0E2142] text-white text-xs rounded-lg px-3 py-1.5 border border-[#2B416B] outline-none cursor-pointer hover:bg-[#1a2f54]"
          >
            <option value="all">Tüm İller</option>
            <option value="İstanbul">İstanbul</option>
            <option value="Ankara">Ankara</option>
            <option value="İzmir">İzmir</option>
            <option value="Bursa">Bursa</option>
            <option value="Antalya">Antalya</option>
            <option value="Adana">Adana</option>
            <option value="Konya">Konya</option>
            <option value="Gaziantep">Gaziantep</option>
            <option value="Kocaeli">Kocaeli</option>
            <option value="Mersin">Mersin</option>
          </select>

          {/* Şube */}
          <select
            value={availTrendBranch}
            onChange={(e) => setAvailTrendBranch(e.target.value)}
            className="bg-[#0E2142] text-white text-xs rounded-lg px-3 py-1.5 border border-[#2B416B] outline-none cursor-pointer hover:bg-[#1a2f54]"
          >
            <option value="all">Tüm Şubeler</option>
            <option value="BAKIRKÖY SUBE">BAKIRKÖY SUBE</option>
            <option value="KADIKÖY SUBE">KADIKÖY SUBE</option>
            <option value="BEŞİKTAŞ SUBE">BEŞİKTAŞ SUBE</option>
            <option value="ÜSKÜDAR SUBE">ÜSKÜDAR SUBE</option>
            <option value="ANKARA KIZILAY">ANKARA KIZILAY</option>
            <option value="ANKARA ULUS">ANKARA ULUS</option>
            <option value="İZMİR ALSANCAK">İZMİR ALSANCAK</option>
            <option value="İZMİR KONAK">İZMİR KONAK</option>
            <option value="BURSA NİLÜFER">BURSA NİLÜFER</option>
            <option value="BURSA OSMANGAZI">BURSA OSMANGAZİ</option>
            <option value="ANTALYA MURATPAŞA">ANTALYA MURATPAŞA</option>
            <option value="ADANA SEYHAN">ADANA SEYHAN</option>
            <option value="KONYA MERAM">KONYA MERAM</option>
            <option value="GAZİANTEP ŞAHİNBEY">GAZİANTEP ŞAHİNBEY</option>
            <option value="KOCAELİ İZMİT">KOCAELİ İZMİT</option>
          </select>

          {/* Nakit Merkezi */}
          <select
            value={availTrendCashCenter}
            onChange={(e) => setAvailTrendCashCenter(e.target.value)}
            className="bg-[#0E2142] text-white text-xs rounded-lg px-3 py-1.5 border border-[#2B416B] outline-none cursor-pointer hover:bg-[#1a2f54]"
          >
            <option value="all">Tüm Nakit Merkezleri</option>
            <option value="İstanbul Anadolu NM">İstanbul Anadolu NM</option>
            <option value="İstanbul Avrupa NM">İstanbul Avrupa NM</option>
            <option value="Ankara NM">Ankara NM</option>
            <option value="İzmir NM">İzmir NM</option>
            <option value="Bursa NM">Bursa NM</option>
            <option value="Antalya NM">Antalya NM</option>
            <option value="Adana NM">Adana NM</option>
            <option value="Konya NM">Konya NM</option>
            <option value="Gaziantep NM">Gaziantep NM</option>
            <option value="Kocaeli NM">Kocaeli NM</option>
            <option value="Mersin NM">Mersin NM</option>
            <option value="Trabzon NM">Trabzon NM</option>
            <option value="Diyarbakır NM">Diyarbakır NM</option>
            <option value="Erzurum NM">Erzurum NM</option>
          </select>

          <div className="flex-1"></div>

          {/* Tarih Filtreleri */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-[#0E2142] rounded-lg px-3 py-1.5">
              <span className="text-[10px] text-[#A7B8D8]">Başlangıç:</span>
              <input
                type="date"
                value={availTrendStartDate}
                onChange={(e) => setAvailTrendStartDate(e.target.value)}
                className="bg-transparent text-xs text-white border-none outline-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2 bg-[#0E2142] rounded-lg px-3 py-1.5">
              <span className="text-[10px] text-[#A7B8D8]">Bitiş:</span>
              <input
                type="date"
                value={availTrendEndDate}
                onChange={(e) => setAvailTrendEndDate(e.target.value)}
                className="bg-transparent text-xs text-white border-none outline-none cursor-pointer"
              />
            </div>
            <button
              onClick={() => {
                const startDateFormatted = new Date(availTrendStartDate).toLocaleDateString('tr-TR');
                const endDateFormatted = new Date(availTrendEndDate).toLocaleDateString('tr-TR');
                
                // Aylık data oluştur
                const startDate = new Date(availTrendStartDate);
                const endDate = new Date(availTrendEndDate);
                const chartData = [];
                
                let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
                
                // Filtre efektleri
                let filterEffect = 0;
                if (availTrendLocationType === 'Şube') filterEffect += 0.5; // Şubeler daha stabil
                if (availTrendLocationType === 'Offsite') filterEffect -= 0.8; // Offsite'lar biraz düşük
                if (availTrendVendor === 'GRG') filterEffect += 0.3; // GRG biraz iyi
                if (availTrendVendor === 'HITACHI') filterEffect -= 0.4; // HITACHI biraz düşük
                
                while (currentDate <= endDate) {
                  const monthYear = currentDate.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' });
                  const monthIndex = currentDate.getMonth();
                  
                  // Aylık availability değerleri (yaz ayları biraz daha yüksek, kış biraz düşük)
                  const seasonalEffect = monthIndex >= 5 && monthIndex <= 8 ? 1 : -0.5; // Yaz ayları
                  const baseAvail = 95.5 + seasonalEffect + filterEffect;
                  const variance = (Math.sin(monthIndex / 2) * 1.5); // Yıllık dalgalanma
                  
                  chartData.push({
                    month: monthYear,
                    genel: (baseAvail + variance + Math.random() * 0.8).toFixed(2),
                    paraCekme: (baseAvail + variance - 1.2 + Math.random() * 0.8).toFixed(2),
                    paraYatirma: (baseAvail + variance + 0.8 + Math.random() * 0.8).toFixed(2),
                  });
                  
                  currentDate.setMonth(currentDate.getMonth() + 1);
                }
                
                let csvContent = '\uFEFFAvailability Trend Analizi (Aylık)\n';
                csvContent += `Tarih Aralığı,${startDateFormatted} - ${endDateFormatted}\n\n`;
                csvContent += 'Ay,Genel Availability (%),Para Çekme Availability (%),Para Yatırma Availability (%)\n';
                
                chartData.forEach((row) => {
                  csvContent += `${row.month},${row.genel},${row.paraCekme},${row.paraYatirma}\n`;
                });
                
                // Özet istatistikler
                const avgGenel = (chartData.reduce((sum, r) => sum + parseFloat(r.genel), 0) / chartData.length).toFixed(2);
                const avgCekme = (chartData.reduce((sum, r) => sum + parseFloat(r.paraCekme), 0) / chartData.length).toFixed(2);
                const avgYatirma = (chartData.reduce((sum, r) => sum + parseFloat(r.paraYatirma), 0) / chartData.length).toFixed(2);
                
                csvContent += '\nÖzet İstatistikler\n';
                csvContent += `Ortalama Genel Availability,${avgGenel}%\n`;
                csvContent += `Ortalama Para Çekme Availability,${avgCekme}%\n`;
                csvContent += `Ortalama Para Yatırma Availability,${avgYatirma}%\n`;
                
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `availability_trend_${availTrendStartDate}_${availTrendEndDate}.csv`;
                link.click();
              }}
              className="px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#0E9F6E] text-xs font-semibold transition flex items-center gap-1"
            >
              📥 Excel
            </button>
          </div>
        </div>

        {/* Grafik Data */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="bg-[#0E2142] rounded-xl p-4">
            <div className="text-xs text-[#A7B8D8] mb-2">Ortalama Genel Availability</div>
            <div className="text-3xl font-bold text-[#10B981]">91.5%</div>
            <div className="text-xs text-[#10B981] mt-1">↑ 0.2% yıllık</div>
          </div>
          <div className="bg-[#0E2142] rounded-xl p-4">
            <div className="text-xs text-[#A7B8D8] mb-2">Ortalama Para Çekme Avail.</div>
            <div className="text-3xl font-bold text-[#2E86FF]">93.7%</div>
            <div className="text-xs text-[#10B981] mt-1">↑ 0.1% yıllık</div>
          </div>
          <div className="bg-[#0E2142] rounded-xl p-4">
            <div className="text-xs text-[#A7B8D8] mb-2">Ortalama Para Yatırma Avail.</div>
            <div className="text-3xl font-bold text-[#F2B705]">91.9%</div>
            <div className="text-xs text-[#10B981] mt-1">↑ 0.3% yıllık</div>
          </div>
        </div>

        {/* Aylık Trend Chart - 2025 Ocak - 2026 Şubat */}
        <div className="bg-[#0E2142] rounded-xl p-6">
          <div className="text-base text-white mb-8 text-center font-semibold">
            2025 Ocak - 2026 Şubat Aylık Availability Trendi
          </div>
          
          {/* Chart Container */}
          <div className="relative bg-[#0B1B34]/50 rounded-xl p-8 overflow-hidden" style={{ height: '450px' }}>
            {/* Tooltip */}
            {chartTooltip && (
              <div 
                className="fixed z-50 bg-[#1a2f54] border border-[#2B416B] rounded-lg p-3 shadow-xl pointer-events-none"
                style={{ left: chartTooltip.x, top: chartTooltip.y - 80, transform: 'translateX(-50%)' }}
              >
                <div className="text-xs font-semibold text-white mb-2">{chartTooltip.data.month}</div>
                <div className="flex flex-col gap-1 text-[10px]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#2E86FF]"></div>
                    <span className="text-[#A7B8D8]">Para Çekme:</span>
                    <span className="text-white font-semibold">{chartTooltip.data.cekme}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#F2B705]"></div>
                    <span className="text-[#A7B8D8]">Para Yatırma:</span>
                    <span className="text-white font-semibold">{chartTooltip.data.yatirma}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#10B981]"></div>
                    <span className="text-[#A7B8D8]">Genel Avail.:</span>
                    <span className="text-white font-semibold">{chartTooltip.data.genel}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Y-axis */}
            <div className="absolute left-4 top-8 bottom-20 w-12 flex flex-col justify-between text-xs text-[#A7B8D8] font-semibold">
              <span>95%</span>
              <span>94%</span>
              <span>93%</span>
              <span>92%</span>
              <span>91%</span>
              <span>90%</span>
            </div>

            {/* Chart SVG */}
            <div className="absolute left-20 right-12 top-8 bottom-20">
              <svg className="w-full h-full" viewBox="0 0 1300 320" preserveAspectRatio="none">
                {/* Grid lines */}
                {[0, 64, 128, 192, 256, 320].map((y) => (
                  <line key={y} x1="0" y1={y} x2="1300" y2={y} stroke="#2B416B" strokeWidth="1" opacity="0.2" />
                ))}

                {/* Para Çekme - Mavi */}
                <polyline
                  points="0,6.4 100,147.2 200,118.4 300,105.6 400,118.4 500,172.8 600,198.4 700,147.2 800,134.4 900,25.6 1000,19.2 1100,96.0 1200,118.4 1300,99.2"
                  fill="none"
                  stroke="#2E86FF"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Para Yatırma - Sarı */}
                <polyline
                  points="0,153.6 100,281.6 200,217.6 300,185.6 400,204.8 500,268.8 600,281.6 700,217.6 800,198.4 900,108.8 1000,102.4 1100,147.2 1200,160.0 1300,160.0"
                  fill="none"
                  stroke="#F2B705"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Genel Availability - Yeşil */}
                <polyline
                  points="0,179.2 100,313.6 200,236.8 300,198.4 400,217.6 500,300.8 600,320.0 700,236.8 800,217.6 900,140.8 1000,134.4 1100,172.8 1200,185.6 1300,185.6"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Interactive circles */}
                {[
                  { x: 0, yTop: 6.4, month: 'Oca 2025', genel: '92.2%', cekme: '94.9%', yatirma: '92.6%' },
                  { x: 100, yTop: 147.2, month: 'Şub 2025', genel: '90.1%', cekme: '93.2%', yatirma: '90.6%' },
                  { x: 200, yTop: 118.4, month: 'Mar 2025', genel: '91.1%', cekme: '93.8%', yatirma: '91.5%' },
                  { x: 300, yTop: 105.6, month: 'Nis 2025', genel: '91.6%', cekme: '94.1%', yatirma: '92.1%' },
                  { x: 400, yTop: 118.4, month: 'May 2025', genel: '91.3%', cekme: '93.8%', yatirma: '91.8%' },
                  { x: 500, yTop: 172.8, month: 'Haz 2025', genel: '90.3%', cekme: '92.9%', yatirma: '90.8%' },
                  { x: 600, yTop: 198.4, month: 'Tem 2025', genel: '90.0%', cekme: '92.4%', yatirma: '90.6%' },
                  { x: 700, yTop: 147.2, month: 'Ağu 2025', genel: '91.0%', cekme: '93.2%', yatirma: '91.5%' },
                  { x: 800, yTop: 134.4, month: 'Eyl 2025', genel: '91.3%', cekme: '93.4%', yatirma: '91.8%' },
                  { x: 900, yTop: 25.6, month: 'Eki 2025', genel: '92.8%', cekme: '94.6%', yatirma: '93.3%' },
                  { x: 1000, yTop: 19.2, month: 'Kas 2025', genel: '92.9%', cekme: '94.6%', yatirma: '93.4%' },
                  { x: 1100, yTop: 96.0, month: 'Ara 2025', genel: '92.3%', cekme: '94.0%', yatirma: '92.7%' },
                  { x: 1200, yTop: 118.4, month: 'Oca 2026', genel: '92.1%', cekme: '93.6%', yatirma: '92.5%' },
                  { x: 1300, yTop: 99.2, month: 'Şub 2026', genel: '92.1%', cekme: '93.9%', yatirma: '92.5%' }
                ].map((point, i) => {
                  return (
                    <rect
                      key={`area-${i}`}
                      x={point.x - 40}
                      y="0"
                      width="80"
                      height="320"
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={(e) => {
                        const svgRect = e.currentTarget.closest('svg')?.getBoundingClientRect();
                        const rect = e.currentTarget.getBoundingClientRect();
                        if (svgRect) {
                          const svgHeight = svgRect.height;
                          const relativeY = (point.yTop / 320) * svgHeight;
                          setChartTooltip({
                            x: rect.left + rect.width / 2,
                            y: svgRect.top + relativeY,
                            data: point
                          });
                        }
                      }}
                      onMouseLeave={() => setChartTooltip(null)}
                    />
                  );
                })}

                {/* Visible circles */}
                {[
                  { x: 0, yc: 6.4, yy: 153.6, yg: 179.2 },
                  { x: 100, yc: 147.2, yy: 281.6, yg: 313.6 },
                  { x: 200, yc: 118.4, yy: 217.6, yg: 236.8 },
                  { x: 300, yc: 105.6, yy: 185.6, yg: 198.4 },
                  { x: 400, yc: 118.4, yy: 204.8, yg: 217.6 },
                  { x: 500, yc: 172.8, yy: 268.8, yg: 300.8 },
                  { x: 600, yc: 198.4, yy: 281.6, yg: 320.0 },
                  { x: 700, yc: 147.2, yy: 217.6, yg: 236.8 },
                  { x: 800, yc: 134.4, yy: 198.4, yg: 217.6 },
                  { x: 900, yc: 25.6, yy: 108.8, yg: 140.8 },
                  { x: 1000, yc: 19.2, yy: 102.4, yg: 134.4 },
                  { x: 1100, yc: 96.0, yy: 147.2, yg: 172.8 },
                  { x: 1200, yc: 118.4, yy: 160.0, yg: 185.6 },
                  { x: 1300, yc: 99.2, yy: 160.0, yg: 185.6 }
                ].map((p, i) => (
                  <g key={`circles-${i}`}>
                    <circle cx={p.x} cy={p.yc} r="6" fill="#2E86FF" stroke="#0B1B34" strokeWidth="2" className="pointer-events-none" />
                    <circle cx={p.x} cy={p.yy} r="6" fill="#F2B705" stroke="#0B1B34" strokeWidth="2" className="pointer-events-none" />
                    <circle cx={p.x} cy={p.yg} r="6" fill="#10B981" stroke="#0B1B34" strokeWidth="2" className="pointer-events-none" />
                  </g>
                ))}
              </svg>
            </div>

            {/* X-axis labels */}
            <div className="absolute left-20 right-12 bottom-6 flex justify-between text-[11px] text-[#A7B8D8] font-medium">
              <span className="text-center -ml-2">Oca<br/>'25</span>
              <span className="text-center">Şub</span>
              <span className="text-center">Mar</span>
              <span className="text-center">Nis</span>
              <span className="text-center">May</span>
              <span className="text-center">Haz</span>
              <span className="text-center">Tem</span>
              <span className="text-center">Ağu</span>
              <span className="text-center">Eyl</span>
              <span className="text-center">Eki</span>
              <span className="text-center">Kas</span>
              <span className="text-center">Ara</span>
              <span className="text-center">Oca<br/>'26</span>
              <span className="text-center -mr-2">Şub</span>
            </div>
          </div>

          {/* Summary Text */}
          <div className="flex justify-end mt-4">
            <div className="text-[10px] text-[#A7B8D8] leading-relaxed max-w-xl bg-[#0B1B34]/30 rounded-lg p-4 border border-[#2B416B]/30">
              <p className="mb-1">
                <span className="text-[#10B981] font-semibold">Son 14 ay:</span> Genel availability <span className="text-white font-medium">%90-93</span> bandında seyretmiş.
              </p>
              <p className="mb-1">
                <span className="text-[#F97316] font-semibold">Düşük nokta:</span> Şubat 2025 (<span className="text-white font-medium">%90.1</span>)
              </p>
              <p className="mb-1">
                <span className="text-[#10B981] font-semibold">En yüksek:</span> Kasım 2025 (<span className="text-white font-medium">%92.9</span>)
              </p>
              <p>
                <span className="text-[#2E86FF] font-semibold">Para Çekme:</span> En yüksek availability (<span className="text-white font-medium">%93.7 ortalama</span>)
              </p>
            </div>
          </div>

          {/* AI Açıklamaları - Düşüş Analizi */}
          <div className="mt-6 space-y-3">
            <div className="text-base font-bold text-white mb-4 flex items-center gap-3 bg-gradient-to-r from-[#2E86FF]/20 via-transparent to-transparent border-l-4 border-[#2E86FF] pl-4 py-3 rounded-r-lg">
              <span className="text-2xl">🔍</span>
              <span>Arıza Trend Analizi - Düşüş Kök Sebep Raporları</span>
            </div>

            {/* Şubat 2025 - En büyük düşüş */}
            <div className="bg-gradient-to-r from-[#E63946]/10 via-[#0E2142] to-transparent border border-[#E63946]/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">⚠️</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-[#E63946]">Şubat 2025</span>
                    <span className="text-xs bg-[#E63946]/20 text-[#E63946] px-2 py-0.5 rounded">%90.1 (2.1% düşüş)</span>
                  </div>
                  <div className="text-xs text-[#A7B8D8] space-y-1.5">
                    <p>• <span className="text-white font-semibold">Isıtıcı Modül Arızaları:</span> 23 ATM'de FLM kaydı (ısıtma sistemi yetersizliği)</p>
                    <p>• <span className="text-white font-semibold">Not Sayıcı Problemleri:</span> NCR marka 12 ATM'de nem nedeniyle not sayıcı hassasiyeti kaybı (şubat sonunda sahadan kaldırma süreci başlatıldı)</p>
                    <p>• <span className="text-white font-semibold">Etkilenen Modeller:</span> NCR (%58 - kaldırılıyor), Hitachi (%24), GRG (%18)</p>
                    <p className="text-[#F2B705] mt-2">📊 Bu ay toplam <span className="font-bold">142 FLM</span> kaydedildi (önceki aya göre +34%)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Haziran 2025 */}
            <div className="bg-gradient-to-r from-[#F2B705]/10 via-[#0E2142] to-transparent border border-[#F2B705]/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🌡️</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-[#F2B705]">Haziran 2025</span>
                    <span className="text-xs bg-[#F2B705]/20 text-[#F2B705] px-2 py-0.5 rounded">%90.3</span>
                  </div>
                  <div className="text-xs text-[#A7B8D8] space-y-1.5">
                    <p>• <span className="text-white font-semibold">Yaz Sıcaklıkları:</span> 35°C+ sıcaklıkta dispenser modüllerinde aşırı ısınma</p>
                    <p>• <span className="text-white font-semibold">Klima Arızaları:</span> 19 ATM'de klima sistemi yetersizliği (iç sıcaklık 42°C+)</p>
                    <p>• <span className="text-white font-semibold">CIT Gecikmeleri:</span> Turistik bölgelerde yüksek talep, NM ekipleri 8 güzergahta gecikme yaşadı</p>
                    <p>• <span className="text-white font-semibold">Elektrik Kesintileri:</span> Ege bölgesinde 6 ATM, şebeke yüksek yük nedeniyle 4+ saat kesintiye maruz kaldı</p>
                    <p>• <span className="text-white font-semibold">Vendor Bantaş Personel Krizi:</span> Yaz dönemi izinleri ve müşteri coğrafi dağılımı nedeniyle teknisyen yetersizliği, SLA uyum oranında %8 düşüş kaydedildi</p>
                    <p className="text-[#10B981] mt-2">📊 Bu ay <span className="font-bold">97 FLM</span> + <span className="font-bold">14 SLM</span> kaydı (yaz sezonunun etkisi)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Temmuz 2025 */}
            <div className="bg-gradient-to-r from-[#F97316]/10 via-[#0E2142] to-transparent border border-[#F97316]/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">☀️</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-[#F97316]">Temmuz 2025</span>
                    <span className="text-xs bg-[#F97316]/20 text-[#F97316] px-2 py-0.5 rounded">%90.0 (en düşük yaz ayı)</span>
                  </div>
                  <div className="text-xs text-[#A7B8D8] space-y-1.5">
                    <p>• <span className="text-white font-semibold">Zirve Yaz Sıcaklığı:</span> Güney bölgelerde 40°C+ sıcaklık, elektronik komponentlerde termal stres</p>
                    <p>• <span className="text-white font-semibold">Turistik Bölge Aşırı Yükü:</span> Antalya-Muğla-İzmir bölgelerinde ATM kullanımı %180 arttı, ekipman yorgunluğu</p>
                    <p>• <span className="text-white font-semibold">Bakım Birikimi:</span> Haziran'dan devren 23 ATM bakım bekliyor, teknisyen kapasite yetersizliği</p>
                    <p>• <span className="text-white font-semibold">Güç Kaynağı Sorunları:</span> UPS pil ömrü sona eren 11 ATM, kesinti anında düşüyor</p>
                    <p>• <span className="text-white font-semibold">GRG Dispenser Firmware:</span> 9 GRG ATM'de firmware güncelleme sonrası not sıkışması, vendor desteği ile 4 gün içinde düzeldi</p>
                    <p>• <span className="text-white font-semibold">🔴 Vendor Bantaş Kritik Personel Açığı:</span> Coğrafi yayılım ve yaz izinleri nedeniyle teknisyen sayısı %35 düştü, ortalama SLA süresi 6.2 saate çıktı (normal: 4.1 saat) - <span className="text-[#E63946] font-bold">düşüşün birincil sebebi</span></p>
                    <p className="text-[#E63946] mt-2">📊 Bu ay <span className="font-bold">118 FLM</span> + <span className="font-bold">21 SLM</span> (yılın en yoğun ayı, teknisyen kapasite %95 kullanımda)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Genel Öneri */}
            <div className="bg-gradient-to-r from-[#10B981]/10 via-[#0E2142] to-transparent border border-[#10B981]/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">💡</div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#10B981] mb-2">Stratejik Öneriler</div>
                  <div className="text-xs text-[#A7B8D8] space-y-1.5">
                    <p>• <span className="text-white">Kış Hazırlığı:</span> Ekim ayında tüm ATM'lere ısıtıcı/nem önleyici modül kontrolü yapılmalı (Hitachi ve GRG modeller için özelleştirilmiş)</p>
                    <p>• <span className="text-white">Yaz Bakımı:</span> Mayıs ayında klima sistemleri gözden geçirilmeli, kritik noktalarda yedek UPS pil değişimi</p>
                    <p>• <span className="text-white">Turistik Sezon Kapasitesi:</span> Haziran-Ağustos arası teknisyen ekip %30 artırılabilir veya bölgesel destek ekipleri oluşturulabilir</p>
                    <p>• <span className="text-white">Vendor Yedek Parça Stoku:</span> Hitachi ve GRG kritik komponentleri (dispenser, kart okuyucu, termal yazıcı) için yedek parça stok seviyesi artırılmalı</p>
                    <p>• <span className="text-white">GRG Firmware Yönetimi:</span> GRG güncellemeleri test ortamında doğrulanmalı, prod deploy öncesi staging zorunlu hale getirilmeli</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#10B981]"></div>
            <span className="text-xs text-[#A7B8D8]">Genel Availability</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#2E86FF]"></div>
            <span className="text-xs text-[#A7B8D8]">Para Çekme</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#F2B705]"></div>
            <span className="text-xs text-[#A7B8D8]">Para Yatırma</span>
          </div>
        </div>
      </div>

      <OverviewBottomStrip />
      
      {/* Tam Ekran Harita Modal */}
      {fullscreenMap && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2B416B] bg-[#0A1628]">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">🗺️ ATM Risk Haritası - Tam Ekran</h2>
              <div className="text-sm text-[#A7B8D8]">
                {filteredAtms.length} ATM
              </div>
              
              {/* Lokasyon Filtresi - Şube/Offsite */}
              <div className="flex items-center gap-1 bg-[#0E2142] rounded-lg p-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAtmLocationFilter('all');
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded transition ${
                    atmLocationFilter === 'all'
                      ? 'bg-[#2E86FF] text-white'
                      : 'text-[#A7B8D8] hover:text-white'
                  }`}
                >
                  Tümü
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAtmLocationFilter('branch');
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded transition ${
                    atmLocationFilter === 'branch'
                      ? 'bg-[#10B981] text-white'
                      : 'text-[#A7B8D8] hover:text-white'
                  }`}
                >
                  � Şube
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAtmLocationFilter('offsite');
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded transition ${
                    atmLocationFilter === 'offsite'
                      ? 'bg-[#F2B705] text-white'
                      : 'text-[#A7B8D8] hover:text-white'
                  }`}
                >
                  📍 Offsite
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Legend */}
              <div className="flex items-center gap-4 text-sm">
                <button
                  onClick={() => toggleBand("High")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded transition ${
                    selectedBands.includes("High")
                      ? "opacity-100 bg-[#E63946]/20"
                      : "opacity-50 hover:opacity-75"
                  }`}
                >
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: "#E63946" }} />
                  <span className="text-white">Yüksek Risk</span>
                </button>
                <button
                  onClick={() => toggleBand("Medium")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded transition ${
                    selectedBands.includes("Medium")
                      ? "opacity-100 bg-[#F2B705]/20"
                      : "opacity-50 hover:opacity-75"
                  }`}
                >
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: "#F2B705" }} />
                  <span className="text-white">Orta Risk</span>
                </button>
                <button
                  onClick={() => toggleBand("Low")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded transition ${
                    selectedBands.includes("Low")
                      ? "opacity-100 bg-[#2E86FF]/20"
                      : "opacity-50 hover:opacity-75"
                  }`}
                >
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: "#2E86FF" }} />
                  <span className="text-white">Düşük Risk</span>
                </button>
              </div>
              
              <button
                onClick={() => setFullscreenMap(false)}
                className="px-4 py-2 bg-[#E63946] hover:bg-[#D62839] text-white font-semibold rounded-lg transition flex items-center gap-2"
              >
                ✕ Kapat
              </button>
            </div>
          </div>
          
          {/* Map - Full Height with proper key to force re-render */}
          <div className="flex-1 w-full" style={{ height: 'calc(100vh - 73px)' }}>
            <OverviewMap
              key="fullscreen-map"
              filteredAtms={filteredAtms}
              center={center}
              top10Band={top10Band}
              top10Data={top10Data}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// FLM/SLM Pattern Analysis Component (Collapsible)
function FLMSLMPatternAnalysis() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dateStart, setDateStart] = useState('2025-11-13');
  const [dateEnd, setDateEnd] = useState('2026-02-11');

  // Gerçek ATM verilerinden top 20 seçiyoruz
  const topATMs = useMemo(() => {
    // Rastgele FLM/SLM sayıları üret (simülasyon için)
    const getRandomCount = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    
    // ATM master data'dan ilk 20 aktif ATM'yi al
    return atmMasterData
      .filter((atm: any) => atm.active)
      .slice(0, 20)
      .map((atm: any) => {
        const flm = getRandomCount(25, 38);
        const slm = getRandomCount(8, 15);
        return {
          id: atm.atm_id,
          name: atm.atm_name,
          city: atm.city,
          district: atm.district,
          cashCenter: atm.cash_center || 'Merkezi Nakit',
          flm,
          slm,
          total: flm + slm
        };
      })
      .sort((a: any, b: any) => b.total - a.total); // Toplam sayıya göre sırala
  }, []);

  // Excel Export Function
  const exportToExcel = () => {
    const csvContent = '\uFEFFFLM/SLM Kayıt Pattern Analizi\n' +
      `Tarih Aralığı: ${dateStart} - ${dateEnd}\n\n` +
      'Sıra,ATM ID,ATM Adı,İl,İlçe,Nakit Merkezi,FLM Sayısı,SLM Sayısı,Toplam İşlem\n' +
      topATMs.map((atm, idx) => 
        `${idx + 1},${atm.id},${atm.name},${atm.city},${atm.district},${atm.cashCenter},${atm.flm},${atm.slm},${atm.total}`
      ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `FLM_SLM_Pattern_Analysis_${dateStart}_${dateEnd}.csv`;
    link.click();
  };

  return (
    <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B] mt-4">
      {/* Header - Always Visible */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:bg-[#1a2f54] rounded-lg p-2 transition-all flex-1"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="text-2xl">{isExpanded ? '📂' : '📁'}</div>
          <div>
            <div className="text-sm text-white font-semibold">🔧 FLM/SLM Kayıt Pattern Analizi</div>
            <div className="text-xs text-[#A7B8D8] mt-1">
              En fazla bakım kaydı açılan ATM'ler (First & Second Line Maintenance)
            </div>
          </div>
          <div className="text-[#A7B8D8] text-xl transition-transform ml-auto" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ▼
          </div>
        </div>

        {/* Date Range and Export Filters */}
        {isExpanded && (
          <div className="flex items-center gap-2 flex-wrap w-full">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                max={dateEnd}
                className="px-2 py-1 text-xs rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-white/50 text-xs">-</span>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                min={dateStart}
                max="2026-02-12"
                className="px-2 py-1 text-xs rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#2E86FF]/20 text-[#2E86FF] text-xs font-semibold">
              Top 20 ATM
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                exportToExcel();
              }}
              className="px-3 py-1.5 rounded-lg bg-[#10B981]/20 text-[#10B981] hover:bg-[#10B981]/30 text-xs font-semibold transition-all flex items-center gap-1"
            >
              📥 Excel Export
            </button>
          </div>
        )}
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="mt-4 space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {/* Custom Scrollbar Styles */}
          <style jsx>{`
            .custom-scrollbar::-webkit-scrollbar {
              width: 8px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: #0E2142;
              border-radius: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: #2E86FF;
              border-radius: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: #0066FF;
            }
          `}</style>

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-[#0E2142]/60 rounded-lg text-xs font-semibold text-[#A7B8D8]">
            <div className="col-span-1">#</div>
            <div className="col-span-2">ATM ID</div>
            <div className="col-span-2">ATM Adı</div>
            <div className="col-span-1">İl</div>
            <div className="col-span-2">İlçe</div>
            <div className="col-span-2">Nakit Merkezi</div>
            <div className="col-span-1 text-center">FLM</div>
            <div className="col-span-1 text-center">SLM</div>
          </div>

          {/* Table Rows */}
          {topATMs.map((atm, idx) => (
            <div 
              key={atm.id}
              className="grid grid-cols-12 gap-2 px-4 py-3 bg-[#0E2142]/40 hover:bg-[#0E2142]/80 rounded-lg text-xs text-white transition-all cursor-pointer ring-1 ring-[#2B416B] hover:ring-[#2E86FF]/50"
            >
              <div className="col-span-1 flex items-center">
                <div className={`px-2 py-1 rounded text-[10px] font-bold ${
                  idx < 3 ? 'bg-[#EF4444]/20 text-[#EF4444]' : 
                  idx < 10 ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 
                  'bg-[#10B981]/20 text-[#10B981]'
                }`}>
                  #{idx + 1}
                </div>
              </div>
              <div className="col-span-2 flex items-center font-semibold text-[#2E86FF]">{atm.id}</div>
              <div className="col-span-2 flex items-center text-white">{atm.name}</div>
              <div className="col-span-1 flex items-center text-[#A7B8D8]">{atm.city}</div>
              <div className="col-span-2 flex items-center text-[#A7B8D8]">{atm.district}</div>
              <div className="col-span-2 flex items-center text-[#A7B8D8] text-[10px]">{atm.cashCenter}</div>
              <div className="col-span-1 flex items-center justify-center">
                <div className="px-2 py-1 rounded bg-[#F59E0B]/20 text-[#F59E0B] font-bold text-xs">
                  {atm.flm}
                </div>
              </div>
              <div className="col-span-1 flex items-center justify-center">
                <div className="px-2 py-1 rounded bg-[#EF4444]/20 text-[#EF4444] font-bold text-xs">
                  {atm.slm}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Planlı vs Plansız Arıza Trend Chart Component (Collapsible)
function PlannedUnplannedFaultChart() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dateStart, setDateStart] = useState('2025-01-01');
  const [dateEnd, setDateEnd] = useState('2025-12-31');

  // Mock data - Son 12 ay için planlı/plansız arıza sayıları
  const faultData = [
    { month: 'Oca 2025', planned: 38, unplanned: 92 },
    { month: 'Şub 2025', planned: 45, unplanned: 78 },
    { month: 'Mar 2025', planned: 52, unplanned: 65 },
    { month: 'Nis 2025', planned: 41, unplanned: 88 },
    { month: 'May 2025', planned: 48, unplanned: 71 },
    { month: 'Haz 2025', planned: 35, unplanned: 105 },
    { month: 'Tem 2025', planned: 58, unplanned: 82 },
    { month: 'Ağu 2025', planned: 62, unplanned: 68 },
    { month: 'Eyl 2025', planned: 47, unplanned: 85 },
    { month: 'Eki 2025', planned: 40, unplanned: 98 },
    { month: 'Kas 2025', planned: 55, unplanned: 110 },
    { month: 'Ara 2025', planned: 65, unplanned: 95 },
  ];

  const maxValue = Math.max(...faultData.map(d => Math.max(d.planned, d.unplanned)));
  const totalPlanned = faultData.reduce((sum, d) => sum + d.planned, 0);
  const totalUnplanned = faultData.reduce((sum, d) => sum + d.unplanned, 0);

  // Excel Export Function
  const exportToExcel = () => {
    const csvContent = '\uFEFFPlanlı vs Plansız Arıza Trendi\n' +
      `Tarih Aralığı: ${dateStart} - ${dateEnd}\n\n` +
      'Ay,Planlı Arıza,Plansız Arıza,Toplam\n' +
      faultData.map((data) => 
        `${data.month},${data.planned},${data.unplanned},${data.planned + data.unplanned}`
      ).join('\n') +
      `\n\nTOPLAM,${totalPlanned},${totalUnplanned},${totalPlanned + totalUnplanned}\n` +
      `\nPlansız Arıza Oranı,%${((totalUnplanned / (totalPlanned + totalUnplanned)) * 100).toFixed(1)}`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Planned_Unplanned_Fault_Trend_${dateStart}_${dateEnd}.csv`;
    link.click();
  };

  return (
    <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B] mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:bg-[#1a2f54] rounded-lg p-2 transition-all flex-1"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="text-2xl">{isExpanded ? '📊' : '📈'}</div>
          <div>
            <div className="text-sm text-white font-semibold">📋 Planlı vs Plansız Arıza Trendi</div>
            <div className="text-xs text-[#A7B8D8] mt-1">
              Aylık bazda arıza kayıtları karşılaştırması
            </div>
          </div>
          <div className="text-[#A7B8D8] text-xl transition-transform ml-auto" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ▼
          </div>
        </div>

        {/* Stats Preview (Always Visible) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-[#2E86FF]"></div>
            <span className="text-xs text-[#A7B8D8]">Planlı: {totalPlanned}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-[#F59E0B]"></div>
            <span className="text-xs text-[#A7B8D8]">Plansız: {totalUnplanned}</span>
          </div>
        </div>
      </div>

      {/* Date Range and Export Filters - Show when expanded */}
      {isExpanded && (
        <div className="flex items-center gap-2 flex-wrap mb-3 px-2">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              max={dateEnd}
              className="px-2 py-1 text-xs rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-white/50 text-xs">-</span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              min={dateStart}
              max="2026-02-12"
              className="px-2 py-1 text-xs rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              exportToExcel();
            }}
            className="px-3 py-1.5 rounded-lg bg-[#10B981]/20 text-[#10B981] hover:bg-[#10B981]/30 text-xs font-semibold transition-all flex items-center gap-1"
          >
            📥 Excel Export
          </button>
        </div>
      )}

      {/* Expandable Chart Content */}
      {isExpanded && (
        <div className="mt-4">
          {/* Chart Container */}
          <div className="bg-[#0E2142]/40 rounded-xl p-4">
            <div className="flex gap-2">
              {faultData.map((data, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                  {/* Bars Container */}
                  <div className="w-full flex items-end justify-center gap-1" style={{ height: '180px' }}>
                    {/* Planned Bar */}
                    <div className="relative flex flex-col items-center justify-end flex-1 group">
                      <div 
                        className="w-full bg-gradient-to-t from-[#2E86FF] to-[#0066FF] rounded-t transition-all hover:opacity-80"
                        style={{ height: `${(data.planned / maxValue) * 100}%`, minHeight: '20px' }}
                      >
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-[#2E86FF] text-white text-[10px] px-2 py-1 rounded whitespace-nowrap font-semibold">
                            {data.planned}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Unplanned Bar */}
                    <div className="relative flex flex-col items-center justify-end flex-1 group">
                      <div 
                        className="w-full bg-gradient-to-t from-[#F59E0B] to-[#F97316] rounded-t transition-all hover:opacity-80"
                        style={{ height: `${(data.unplanned / maxValue) * 100}%`, minHeight: '20px' }}
                      >
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-[#F59E0B] text-white text-[10px] px-2 py-1 rounded whitespace-nowrap font-semibold">
                            {data.unplanned}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Month Label */}
                  <div className="text-[10px] text-[#A7B8D8] font-semibold text-center">
                    {data.month}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend & Stats */}
            <div className="mt-6 pt-4 border-t border-[#2B416B] grid grid-cols-2 gap-4">
              <div className="bg-[#2E86FF]/10 rounded-lg p-3 border border-[#2E86FF]/30">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded bg-[#2E86FF]"></div>
                  <span className="text-xs font-semibold text-white">Planlı Arızalar</span>
                </div>
                <div className="text-2xl font-bold text-[#2E86FF]">{totalPlanned}</div>
                <div className="text-xs text-[#A7B8D8] mt-1">Toplam (12 Ay)</div>
                <div className="text-xs text-[#A7B8D8] mt-2">
                  Bakım planlaması dahilinde önceden bildirilen servis çalışmaları
                </div>
              </div>
              
              <div className="bg-[#F59E0B]/10 rounded-lg p-3 border border-[#F59E0B]/30">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded bg-[#F59E0B]"></div>
                  <span className="text-xs font-semibold text-white">Plansız Arızalar</span>
                </div>
                <div className="text-2xl font-bold text-[#F59E0B]">{totalUnplanned}</div>
                <div className="text-xs text-[#A7B8D8] mt-1">Toplam (12 Ay)</div>
                <div className="text-xs text-[#A7B8D8] mt-2">
                  Beklenmeyen donanım/yazılım hataları ve acil müdahale gerektiren durumlar
                </div>
              </div>
            </div>

            {/* AI Insight */}
            <div className="mt-4 bg-purple-500/10 border border-purple-500/30 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <div className="text-xl">🤖</div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-purple-400 mb-1">AI Recommendation</div>
                  <div className="text-xs text-[#A7B8D8] leading-relaxed">
                    Plansız arıza oranı <strong className="text-[#F59E0B]">%{((totalUnplanned / (totalPlanned + totalUnplanned)) * 100).toFixed(1)}</strong> seviyesinde. 
                    Hedef %30'un altında olmalı. <strong className="text-white">Proaktif bakım</strong> stratejisi ile plansız arızalar 
                    <strong className="text-[#2E86FF]"> %25-30 azaltılabilir</strong>. Özellikle Haziran ve Kasım aylarındaki yüksek plansız arıza sayılarına odaklanın.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

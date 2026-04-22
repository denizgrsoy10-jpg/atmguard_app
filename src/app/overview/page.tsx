"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import * as XLSX from 'xlsx';

const BRAIN_URL = process.env.NEXT_PUBLIC_BRAIN_URL ?? 'http://localhost:8000';
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
  zone?: string | number;
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
  zone?: string | number;
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

  // AI Toplu Yükleme (Excel/CSV/Dosya)
  const [bulkUploadDragging, setBulkUploadDragging] = useState(false);
  const [bulkUploadFile, setBulkUploadFile]         = useState<File | null>(null);
  const [bulkUploadVeriTuru, setBulkUploadVeriTuru] = useState<string>('ariza_log');
  const [bulkUploadAy, setBulkUploadAy]             = useState<string>(String(new Date().getMonth() + 1));
  const [bulkUploadYil, setBulkUploadYil]           = useState<string>(String(new Date().getFullYear()));
  const [bulkUploadStatus, setBulkUploadStatus]     = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [bulkUploadResult, setBulkUploadResult]     = useState<{
    satir_sayisi: number;
    kolonlar: string[];
    eslesen_kolonlar: string[];
    eslesme_orani: number;
    beyin?: {
      basarili?: boolean;
      ogrenilen_atm?: number;
      toplam_kayit?: number;
      ogrenme_ozeti?: {
        risk_skoru_guncellenen_atm: number;
        eta_guncellenen_atm: number;
        kronik_ariza_atm: number;
        toplam_ogrenen_atm: number;
      };
      mesaj?: string;
      uyari?: string;
    } | null;
  } | null>(null);
  const [bulkUploadHistory, setBulkUploadHistory]   = useState<{
    dosya: string;
    veri_turu: string;
    tarih: string;
    satir: number;
    eslesme: number;
    beyin_atm: number;
  }[]>([]);

  // Beyin Versiyonları / Hafıza
  const [brainSnapshots,     setBrainSnapshots]     = useState<{
    versiyon: string; tarih: string; aciklama: string; ogrenen_atm: number;
  }[]>([]);
  const [brainHafiza,        setBrainHafiza]        = useState<{
    aktif_ogrenen_atm: number; son_kayit_versiyon: string|null;
    son_kayit_tarih: string|null; son_kayit_aciklama: string;
    snapshot_sayisi: number;
  } | null>(null);
  const [brainVerLoading,    setBrainVerLoading]    = useState(false);
  const [brainRollbackVer,   setBrainRollbackVer]   = useState<string|null>(null);
  const [brainRollbackStatus, setBrainRollbackStatus] = useState<'idle'|'loading'|'success'|'error'>('idle');

  // Proaktif Tahmin Motoru
  const [proaktifOzet, setProaktifOzet] = useState<{
    aktif: boolean; model_surumu: string|null;
    proaktif_ikmal: number; proaktif_mudahale: number; proaktif_izle: number;
    toplam_proaktif: number; onlenen_acil_tahmini: number;
  } | null>(null);
  const [proaktifLoading, setProaktifLoading] = useState(false);

  // AI Performance Engine tarih aralığı
  const [aiPerfStartDate, setAiPerfStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Son 30 gün
    return date.toISOString().split('T')[0];
  });
  const [aiPerfEndDate, setAiPerfEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
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
  
  // Seçilen ATM detay modal
  const [selectedTop10Atm, setSelectedTop10Atm] = useState<Top10Item | null>(null);
  
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

  // ── Express Log Analyzer ──
  const [vendorLogSimulated, setVendorLogSimulated] = useState(false);
  const [vendorLogLoading, setVendorLogLoading] = useState(false);
  const [vendorLogTab, setVendorLogTab] = useState<'all' | 'cashin' | 'dispense' | 'errors'>('all');
  const [vendorLogPage, setVendorLogPage] = useState(0);
  const VENDOR_LOG_PAGE_SIZE = 10;
  const [brmLogData, setBrmLogData] = useState<any>(null);
  const [brmLogError, setBrmLogError] = useState<string | null>(null);
  const brmFileRef = useRef<HTMLInputElement>(null);
  const [showBrmEmailModal, setShowBrmEmailModal] = useState(false);
  const [brmEmailAddress, setBrmEmailAddress] = useState('');

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
  
  // AI Motor Önerileri: Toplam 12 öneri
  // 5 tanesi OFFSITE Kritik (acil müdahale)
  // 7 tanesi Önleyici Bakım (planlanabilir)
  
  // OFFSITE Kritik ATM'ler (AI Motor tarafından belirlenen ACİL kritik durumlar - 5 ATM)
  const offsiteCriticalAtms = useMemo(() => {
    return atms.filter(a => a.location_type === "Offsite").slice(0, 5);
  }, [atms]);
  
  // Önleyici bakım için ATM listesi (planlanabilir bakım - 7 ATM)
  const preventiveMaintenanceAtms = useMemo(() => {
    // OFFSITE olmayan veya kritik olmayan ATM'ler (SLM riski %40-70 arası)
    const nonCriticalAtms = atms
      .filter(a => {
        const isCritical = offsiteCriticalAtms.some(critical => String(critical.atm_id) === String(a.atm_id));
        return !isCritical; // Kritik olmayanları al
      })
      .slice(0, 7);
    return nonCriticalAtms;
  }, [atms, offsiteCriticalAtms]);

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

  // ── Express Log Analyzer: File Upload + Dynamic Parse ──
  const handleBrmUpload = async (file: File) => {
    setVendorLogLoading(true);
    setBrmLogError(null);
    setVendorLogSimulated(false);
    setBrmLogData(null);

    // ── Format tespiti ──────────────────────────────────────────────────────
    // 1) XFS: tab-ayrımlı 17 kolon, kolon[3]'te "YYYY-MM-DD HH:MM" timestamp
    //    Tipik dosya adı: All.txt veya idc_..._All.txt
    // 2) IDC: WFS_CMD_IDC_ komutları içeriyor VEYA dosya adı IDC ile başlıyor
    // 3) BRM: diğerleri (GRG/Hyosung nakit ünitesi logu)
    let logFormat: 'XFS' | 'IDC' | 'BRM' = 'BRM';
    try {
      const chunk = await file.slice(0, 2048).text();
      const firstDataLine = chunk.split('\n').find(l => l.trim().length > 20) || '';
      const cols = firstDataLine.split('\t');
      // XFS: 15+ sekme ayrımlı kolon + kolon[3]'te tarih + kolon[5]'te sayısal mesaj tipi
      const isXFS = cols.length >= 15
        && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(cols[3] ?? '')
        && /^\d+$/.test((cols[5] ?? '').trim());
      if (isXFS) {
        logFormat = 'XFS';
      } else if (chunk.includes('WFS_CMD_IDC_') || /^idc/i.test(file.name)) {
        logFormat = 'IDC';
      }
    } catch { /* fallback: BRM */ }

    let endpoint = '/api/brm-log';
    let fieldName = 'file';
    if (logFormat === 'XFS') { endpoint = '/api/xfs-log'; fieldName = 'log_file'; }
    else if (logFormat === 'IDC') { endpoint = '/api/idc-log'; fieldName = 'log_file'; }

    const fd = new FormData();
    fd.append(fieldName, file);
    try {
      const res = await fetch(endpoint, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Analiz başarısız');
      setBrmLogData(data);
      setVendorLogSimulated(true);
      setVendorLogTab('all');
      setVendorLogPage(0);
    } catch (e: any) {
      setBrmLogError(e.message || 'Bilinmeyen hata');
    } finally {
      setVendorLogLoading(false);
    }
  };

  // ── XFS Log — normalize (All.txt / uygulama logu) ────────────────────────
  const xfsLog = (brmLogData && brmLogData.log_type === 'XFS') ? (() => {
    const atms: any[] = [...(brmLogData.atms || [])];
    atms.sort((a: any, b: any) => (a.health_score ?? 100) - (b.health_score ?? 100));
    const worst = atms[0] ?? null;
    return {
      atms,
      worst,
      source_file:   brmLogData.source_file,
      parsed_rows:   brmLogData.parsed_rows   ?? 0,
      kritik_sayisi: brmLogData.kritik_sayisi ?? 0,
      yuksek_sayisi: brmLogData.yuksek_sayisi ?? 0,
    };
  })() : null;

  // Normalize parser output → UI shape (same field names as old BRM_DEMO_LOG)
  const brmLog = brmLogData ? (() => {
    const normNotes = (raw: Record<string,number>) => {
      const out: Record<string,number> = {};
      for (const [k,v] of Object.entries(raw)) {
        const key = k.replace(/^[no]/,'');
        if (/^\d+$/.test(key) && key !== '0') out[key] = Number(v);
      }
      return out;
    };
    const txns: Array<{ts:string;op:'cashin'|'dispense';amount:number;notes:Record<string,number>;rejected:number;ok:boolean;error?:string;errorDesc?:string}> = [];
    for (const s of (brmLogData.cashin_sessions || [])) {
      const t = s.timestamp ? String(s.timestamp).substring(11,16) : '--:--';
      txns.push({ ts:t, op:'cashin', amount:s.amount_try, notes:normNotes(s.notes||{}), rejected:s.rejected_count, ok:true });
    }
    for (const d of (brmLogData.dispense_transactions || [])) {
      const t = d.timestamp ? String(d.timestamp).substring(11,16) : '--:--';
      txns.push({ ts:t, op:'dispense', amount:d.amount_try, notes:normNotes(d.notes||{}), rejected:d.rejected_count, ok:true });
    }
    for (const e of (brmLogData.errors || [])) {
      const t = e.timestamp ? String(e.timestamp).substring(11,16) : '--:--';
      const op = String(e.command||'').includes('DISPENSE') ? 'dispense' : 'cashin';
      txns.push({ ts:t, op, amount:0, notes:{}, rejected:0, ok:false, error:e.error_code, errorDesc:e.description });
    }
    txns.sort((a,b) => a.ts.localeCompare(b.ts));
    const hourly: Array<{h:string;ci:number;di:number}> = [];
    const vols = brmLogData.hourly_volumes || {};
    for (let h = 0; h < 24; h++) {
      const v = vols[String(h)] || {cashin:0,dispense:0};
      if (v.cashin > 0 || v.dispense > 0) hourly.push({ h:String(h).padStart(2,'0'), ci:v.cashin, di:v.dispense });
    }
    return {
      atm_id:               brmLogData.atm_id,
      log_date:             brmLogData.log_date,
      source_file:          brmLogData.source_file,
      health_score:         brmLogData.health_score,
      cashin_count:         brmLogData.cashin_count,
      dispense_count:       brmLogData.dispense_count,
      error_count:          brmLogData.error_count,
      total_cashin_try:     brmLogData.total_cashin_try,
      total_dispense_try:   brmLogData.total_dispense_try,
      net_flow_try:         brmLogData.net_flow_try,
      total_rejected_notes: brmLogData.total_rejected_notes,
      transactions: txns,
      hourly,
    };
  })() : null;

  const brmFaults = brmLog ? (() => {
    const raw = brmLogData.errors || [];
    const byCode: Record<string,any[]> = {};
    for (const e of raw) { if (!byCode[e.error_code]) byCode[e.error_code]=[]; byCode[e.error_code].push(e); }
    const ts = (e:any) => e.timestamp ? String(e.timestamp).substring(11,16) : '--:--';
    type FS = 'critical'|'high'|'medium';
    const faults: Array<{id:string;severity:FS;icon:string;title:string;count:number;pattern:string;impact:string;action:string;urgency:number}> = [];
    const r = byCode['5720000']||[];
    if (r.length) faults.push({ id:'RETRACT_MOTOR', severity:'critical', icon:'⚙️', title:'Retract Motor Arızası', count:r.length, pattern:`${r.length}× 5720000 (${r.map(ts).join(', ')})`, impact:'Banknot geri alma mekanizması hata verdi. Mekanik aşınma veya yabancı cisim riski.', action:'ACİL BAKIM — Motor kontrol + temizlik gerekli', urgency:95 });
    const sh = byCode['5678022']||[];
    if (sh.length) faults.push({ id:'SHUTTER_JAM', severity:'high', icon:'🚪', title:'Shutter / Sıkışma Riski', count:sh.length, pattern:`${sh.length}× 5678022 (${sh.map(ts).join(', ')})`, impact:'Transport şeridi sıkıştı. CashIn End hatasına yol açma riski.', action:'Transport belt + shutter fiziksel inspeksiyonu', urgency:78 });
    const vl = [...(byCode['5F0000D']||[]), ...(byCode['5F00130']||[])];
    if (vl.length) faults.push({ id:'VALIDATOR', severity:'high', icon:'🔍', title:'Banknot Okuyucu Bozulma', count:vl.length, pattern:`${vl.length}× validator hatası (${vl.map(ts).join(', ')})`, impact:`${brmLog.total_rejected_notes} banknot reddedildi. Sensör kirliliği veya kalibrasyon bozulması.`, action:'Banknot okuyucu temizliği + sensor kalibrasyon kontrolü', urgency:72 });
    const cf = byCode['564FFF2']||[];
    if (cf.length) faults.push({ id:'CASHIN_END', severity:'high', icon:'❌', title:'İşlem Kesintisi (CashIn End)', count:cf.length, pattern:`${cf.length}× 564FFF2 (${cf.map(ts).join(', ')})`, impact:'Para yatırma işlemi eksik kapandı. Müşteri kaydıyla mutabakat gerekebilir.', action:'İlgili işlemler müşteri kaydıyla mutabık edilmeli', urgency:88 });
    const known = new Set(['5720000','5678022','5F0000D','5F00130','564FFF2']);
    const other = raw.filter((e:any)=>!known.has(e.error_code));
    if (other.length) faults.push({ id:'OTHER', severity:'medium', icon:'⚠️', title:'Diğer Hata Kodları', count:other.length, pattern:[...new Set(other.map((e:any)=>e.error_code))].join(', '), impact:'Bilinmeyen hata kodları. Detaylı inceleme önerilir.', action:'Teknik servis ile kontrol edilmeli', urgency:50 });
    if (brmLog.net_flow_try > 0) faults.push({ id:'CASH_OVERFLOW', severity:'medium', icon:'💰', title:'Nakit Taşma Riski', count:0, pattern:`Net akış: +₺${(brmLog.net_flow_try/1000).toFixed(0)}K`, impact:`ATM'ye ₺${(brmLog.total_cashin_try/1000).toFixed(0)}K girdi, ₺${(brmLog.total_dispense_try/1000).toFixed(0)}K çıktı.`, action:'Yakın vadede toplama operasyonu planlanmalı', urgency:55 });
    return faults;
  })() : [];

  // ── IDC Log — normalized view (kart okuyucu) ──────────────────────────────
  const idcLog = (brmLogData && brmLogData.log_type === 'IDC') ? (() => {
    const d = brmLogData;
    // health badge
    const hs = d.health_score ?? 100;
    const hsBadge = hs >= 80 ? '🟢' : hs >= 50 ? '🟡' : '🔴';
    // FLM / SLM partition from errors
    const slmErrors = (d.errors || []).filter((e: any) => e.service_type === 'SLM');
    const flmErrors = (d.errors || []).filter((e: any) => e.service_type === 'FLM');
    const topSLM = slmErrors[0];
    const verdict: 'SLM' | 'FLM' | 'OK' =
      slmErrors.length > 0 ? 'SLM' :
      flmErrors.length > 0 ? 'FLM' : 'OK';
    // session table rows (top 50)
    const sessions = (d.card_sessions || []).slice(0, 50).map((s: any) => {
      const label = s.duration_label;
      const statusBadge = s.status === 'ok' ? { text: '✓ OK', cls: 'text-[#10B981] bg-[#10B981]/10' } : { text: '✕ İptal', cls: 'text-[#EF4444] bg-[#EF4444]/10' };
      const speedBadge =
        label === 'critical'  ? { text: 'KRİTİK',  cls: 'text-[#EF4444] bg-[#EF4444]/10' } :
        label === 'very_slow' ? { text: 'ÇOK YAVIŞ', cls: 'text-[#F97316] bg-[#F97316]/10' } :
        label === 'slow'      ? { text: 'YAVIŞ',    cls: 'text-[#F2B705] bg-[#F2B705]/10' } :
                                { text: 'Normal',   cls: 'text-[#A7B8D8] bg-[#A7B8D8]/10' };
      const dur = s.duration_sec;
      const durStr = dur < 60 ? `${dur.toFixed(0)} sn` : `${Math.floor(dur/60)} dk ${Math.round(dur%60)} sn`;
      const timeStr = s.start ? String(s.start).substring(11,16) : '--:--';
      return { timeStr, durStr, statusBadge, speedBadge, chipIo: s.chip_io_count ?? 0 };
    });
    return { hs, hsBadge, verdict, slmErrors, flmErrors, topSLM, sessions, d };
  })() : null;

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
          
          {/* Tarih Aralığı ve Excel */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-[#0E2142] rounded-lg px-3 py-1.5">
              <span className="text-[10px] text-[#A7B8D8]">Başlangıç:</span>
              <input
                type="date"
                value={aiPerfStartDate}
                onChange={(e) => setAiPerfStartDate(e.target.value)}
                className="bg-transparent text-white text-xs border-none focus:outline-none w-28"
              />
            </div>
            <div className="flex items-center gap-2 bg-[#0E2142] rounded-lg px-3 py-1.5">
              <span className="text-[10px] text-[#A7B8D8]">Bitiş:</span>
              <input
                type="date"
                value={aiPerfEndDate}
                onChange={(e) => setAiPerfEndDate(e.target.value)}
                className="bg-transparent text-white text-xs border-none focus:outline-none w-28"
              />
            </div>
            <button
              onClick={() => {
                const csvContent = '\uFEFFAI Performance & Breakdown Engine Raporu\n' +
                  'Rapor Tarihi: ' + new Date().toLocaleDateString('tr-TR') + '\n' +
                  'Tarih Aralığı: ' + aiPerfStartDate + ' - ' + aiPerfEndDate + '\n\n' +
                  'Metrik,Değer,Birim,Durum\n' +
                  'Tahmin Doğruluğu,91.3,%,↑ 3.2% bu ay\n' +
                  'Çalışma Modu,Otomatik,-,Sürekli Öğrenen\n' +
                  'Son Güncelleme,2,dakika,Real-time\n' +
                  'Aktif Tahminler,47,adet,Son 24 saat\n\n' +
                  'Model Performans Detayları:\n' +
                  '\n' +
                  'Tahmin Doğruluğu: %91.3\n' +
                  '- Bu ay artış: +3.2%\n' +
                  '- Hedef: %95+\n' +
                  '- Durum: İyi, iyileştirme devam ediyor\n' +
                  '\n' +
                  'Çalışma Modu: Otomatik\n' +
                  '- Sistem: IronClad Engine v1.0\n' +
                  '- Öğrenme: Sürekli (Incremental Learning)\n' +
                  '- Güncelleme: Her 2 dakikada bir\n' +
                  '\n' +
                  'Aktif Tahminler: 47 adet\n' +
                  '- Risk Seviyesi: Yüksek 12, Orta 23, Düşük 12\n' +
                  '- Öncelikli Müdahale: 12 ATM\n' +
                  '- Beklenen FLM: 8 adet\n' +
                  '- Beklenen SLM: 4 adet\n' +
                  '\n' +
                  'Model Versiyonu: v1.13\n' +
                  'Son Güncelleme: 2 dakika önce\n' +
                  'Veri Tazeliği: Real-time\n' +
                  'Drift Kontrolü: Aktif\n' +
                  'PSI Threshold: 0.25\n' +
                  '\n' +
                  'Rapor Oluşturan: ATM Health Guardian\n' +
                  'Motor: IronClad Engine v1.0';
                
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `ai_performance_${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
              }}
              className="px-3 py-2 bg-[#8B1874] hover:bg-[#6D1460] text-white text-xs font-semibold rounded-lg transition flex items-center gap-1"
            >
              📊 Excel İndir
            </button>
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
                onClick={async () => {
                  if (!manualFlmThreshold && !manualSlmRisk && !manualLearningNote) {
                    alert('⚠️ En az bir alan doldurun');
                    return;
                  }
                  try {
                    const body: Record<string, unknown> = {};
                    if (manualFlmThreshold)  body.flm_esik_saat   = parseFloat(manualFlmThreshold);
                    if (manualSlmRisk)       body.slm_risk_yuzde  = parseFloat(manualSlmRisk);
                    if (manualLearningNote)  body.ogrenme_notu    = manualLearningNote;
                    const r = await fetch(`${BRAIN_URL}/api/v1/beyin/kural`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(body),
                    });
                    const d = await r.json();
                    if (d.basarili) {
                      alert(`✅ Beyne Kaydedildi!\n\n${d.degisiklikler.join('\n')}\n\n${d.mesaj}`);
                      setManualFlmThreshold('');
                      setManualSlmRisk('');
                      setManualLearningNote('');
                    } else {
                      alert(`⚠️ ${d.mesaj}`);
                    }
                  } catch {
                    alert(`⚠️ Beyin sunucusu bağlantısı kurulamadı (${BRAIN_URL})`);
                  }
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-[#F2B705] to-[#F59E0B] hover:from-[#F59E0B] hover:to-[#F2B705] text-white text-sm font-bold rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                🧠 Bilgiyi AI'a Öğret
              </button>
            </div>

            {/* ------- TOPLU EXCEL / DOSYA YÜKLEME ------- */}
            <div className="mt-6 border-t border-[#F2B705]/20 pt-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">📦</span>
                <div>
                  <div className="text-sm font-semibold text-white">Toplu Veri Yükleme — Excel / CSV / Dosya</div>
                  <div className="text-xs text-[#A7B8D8]">Beyin geçmiş verilerle eğitilsin: arıza logları, ikmal, para toplama, günlük bakiye</div>
                </div>
                <span className="ml-auto px-2 py-0.5 rounded-full bg-[#F2B705]/20 text-[#F2B705] text-[10px] font-bold">🔒 DAHİLİ</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Sol: Yükleme formu */}
                <div className="space-y-3">
                  {/* Veri türü + Ay/Yıl */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-3">
                      <label className="text-[10px] text-[#A7B8D8] mb-1 block">Veri Türü</label>
                      <select
                        value={bulkUploadVeriTuru}
                        onChange={(e) => setBulkUploadVeriTuru(e.target.value)}
                        className="w-full px-2 py-1.5 bg-[#112544] text-white text-xs rounded-lg border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#F2B705]"
                      >
                        <option value="ariza_log">🔴 Arıza Log Geçmişi</option>
                        <option value="ikmal">🟢 İkmal Geçmişi</option>
                        <option value="para_toplama">🟡 Para Toplama Geçmişi</option>
                        <option value="gunluk_bakiye">🔵 Günlük Bakiye / Nakit Seviyesi</option>
                        <option value="xfs_log">🖥️ XFS Uygulama Logu (All.txt)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#A7B8D8] mb-1 block">Ay</label>
                      <select
                        value={bulkUploadAy}
                        onChange={(e) => setBulkUploadAy(e.target.value)}
                        className="w-full px-2 py-1.5 bg-[#112544] text-white text-xs rounded-lg border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#F2B705]"
                      >
                        {['İoc','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'].map((m, i) => (
                          <option key={i+1} value={String(i+1)}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#A7B8D8] mb-1 block">Yıl</label>
                      <select
                        value={bulkUploadYil}
                        onChange={(e) => setBulkUploadYil(e.target.value)}
                        className="w-full px-2 py-1.5 bg-[#112544] text-white text-xs rounded-lg border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#F2B705]"
                      >
                        {[2023,2024,2025,2026].map(y => (
                          <option key={y} value={String(y)}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <div className="text-[10px] text-[#A7B8D8] leading-tight">Veri hangi döneme ait?</div>
                    </div>
                  </div>

                  {/* Drag & Drop alanı */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setBulkUploadDragging(true); }}
                    onDragLeave={() => setBulkUploadDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setBulkUploadDragging(false);
                      const f = e.dataTransfer.files[0];
                      if (f) setBulkUploadFile(f);
                    }}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                      bulkUploadDragging
                        ? 'border-[#F2B705] bg-[#F2B705]/10'
                        : bulkUploadFile
                        ? 'border-[#10B981] bg-[#10B981]/5'
                        : 'border-[#2B416B] hover:border-[#F2B705] bg-[#112544]/40'
                    }`}
                  >
                    <input
                      type="file"
                      id="bulk-upload-input"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) setBulkUploadFile(f); }}
                    />
                    <label htmlFor="bulk-upload-input" className="cursor-pointer block">
                      {bulkUploadFile ? (
                        <>
                          <div className="text-3xl mb-1">📄</div>
                          <div className="text-xs font-semibold text-[#10B981] truncate">{bulkUploadFile.name}</div>
                          <div className="text-[10px] text-[#A7B8D8] mt-0.5">
                            {(bulkUploadFile.size / 1024).toFixed(0)} KB — değiştirmek için tekrar tıkla
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-3xl mb-1">📤</div>
                          <div className="text-xs font-semibold text-white">Excel / CSV sürükle veya tıkla</div>
                          <div className="text-[10px] text-[#A7B8D8] mt-0.5">.xlsx • .xls • .csv</div>
                        </>
                      )}
                    </label>
                  </div>

                  {/* Yükle butonu */}
                  <button
                    disabled={!bulkUploadFile || bulkUploadStatus === 'uploading'}
                    onClick={async () => {
                      if (!bulkUploadFile) return;
                      setBulkUploadStatus('uploading');
                      setBulkUploadResult(null);
                      try {
                        const fd = new FormData();
                        fd.append('file', bulkUploadFile);
                        fd.append('veri_turu', bulkUploadVeriTuru);
                        fd.append('ay', bulkUploadAy);
                        fd.append('yil', bulkUploadYil);
                        const res = await fetch('/api/train-upload', { method: 'POST', body: fd });
                        if (!res.ok) throw new Error('Sunucu hatası');
                        const json = await res.json();
                        setBulkUploadResult(json);
                        setBulkUploadStatus('success');
                        setBulkUploadHistory(prev => [{
                          dosya      : bulkUploadFile.name,
                          veri_turu  : bulkUploadVeriTuru,
                          tarih      : new Date().toLocaleString('tr-TR'),
                          satir      : json.satir_sayisi,
                          eslesme    : json.eslesme_orani,
                          beyin_atm  : json.beyin?.ogrenilen_atm ?? 0,
                        }, ...prev.slice(0, 9)]);
                        setBulkUploadFile(null);
                        (document.getElementById('bulk-upload-input') as HTMLInputElement).value = '';
                      } catch {
                        setBulkUploadStatus('error');
                      }
                    }}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                      !bulkUploadFile
                        ? 'bg-[#112544] text-[#A7B8D8] cursor-not-allowed'
                        : bulkUploadStatus === 'uploading'
                        ? 'bg-[#F2B705]/60 text-white cursor-wait'
                        : 'bg-gradient-to-r from-[#F2B705] to-[#F59E0B] hover:from-[#F59E0B] hover:to-[#F2B705] text-white shadow-lg hover:shadow-xl'
                    }`}
                  >
                    {bulkUploadStatus === 'uploading' ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        Yükleniyor ve işleniyor...
                      </span>
                    ) : '🧠 AI\'a Yükle ve Eğit'}
                  </button>

                  {/* Sonuç */}
                  {bulkUploadStatus === 'success' && bulkUploadResult && (
                    <div className="bg-[#10B981]/10 rounded-xl p-3 ring-1 ring-[#10B981]/30 space-y-2">
                      {/* Dosya satırları */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm">✅</span>
                        <span className="text-xs font-semibold text-[#10B981]">
                          {bulkUploadResult.satir_sayisi} satır yüklendi
                        </span>
                        <span className="ml-auto text-xs font-bold text-[#F2B705]">
                          Kolon eşleşme: %{Math.round(bulkUploadResult.eslesme_orani * 100)}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#A7B8D8]">
                        Tanınan kolonlar: {bulkUploadResult.eslesen_kolonlar.join(', ') || '—'}
                      </div>

                      {/* Beyin öğrenme raporu */}
                      {bulkUploadResult.beyin?.basarili && bulkUploadResult.beyin.ogrenme_ozeti ? (
                        <div className="border-t border-[#10B981]/20 pt-2 mt-2">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-sm">🧠</span>
                            <span className="text-xs font-bold text-white">Beyin Öğrendi</span>
                            <span className="ml-auto text-[10px] text-[#10B981] font-bold">
                              {bulkUploadResult.beyin.ogrenme_ozeti.toplam_ogrenen_atm} ATM etkilendi
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            {bulkUploadResult.beyin.ogrenme_ozeti.risk_skoru_guncellenen_atm > 0 && (
                              <div className="bg-[#0E2142]/60 rounded-lg px-2 py-1 text-[10px] text-[#EF4444]">
                                🔴 Risk skoru güncellendi: <strong>{bulkUploadResult.beyin.ogrenme_ozeti.risk_skoru_guncellenen_atm} ATM</strong>
                              </div>
                            )}
                            {bulkUploadResult.beyin.ogrenme_ozeti.eta_guncellenen_atm > 0 && (
                              <div className="bg-[#0E2142]/60 rounded-lg px-2 py-1 text-[10px] text-[#2E86FF]">
                                ⏱️ ETA tahminleri iyileşti: <strong>{bulkUploadResult.beyin.ogrenme_ozeti.eta_guncellenen_atm} ATM</strong>
                              </div>
                            )}
                            {bulkUploadResult.beyin.ogrenme_ozeti.kronik_ariza_atm > 0 && (
                              <div className="bg-[#0E2142]/60 rounded-lg px-2 py-1 text-[10px] text-[#F2B705]">
                                ⚡ Kronik arıza tespit: <strong>{bulkUploadResult.beyin.ogrenme_ozeti.kronik_ariza_atm} ATM</strong>
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] text-[#10B981] mt-1.5 leading-relaxed">
                            Karar döngüsü güncellendi — bir sonraki ikmal/arıza kararı bu verileri kullanacak.
                          </div>
                        </div>
                      ) : bulkUploadResult.beyin?.uyari ? (
                        <div className="border-t border-[#F2B705]/20 pt-2 mt-2">
                          <div className="text-[10px] text-[#F2B705]">
                            ⚠️ {bulkUploadResult.beyin.uyari}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                  {bulkUploadStatus === 'error' && (
                    <div className="bg-[#EF4444]/10 rounded-xl p-3 ring-1 ring-[#EF4444]/30 text-xs text-[#EF4444]">
                      ⚠️ Yükleme başarısız. Dosya formatını veya sunucu bağlantısını kontrol edin.
                    </div>
                  )}
                </div>

                {/* Sağ: Yükleme geçmişi */}
                <div className="flex flex-col gap-3">
                  <div className="text-[10px] text-[#A7B8D8] font-semibold">🗓️ Yükleme Geçmişi</div>
                  {bulkUploadHistory.length === 0 ? (
                    <div className="flex items-center justify-center min-h-[120px] text-xs text-[#A7B8D8] bg-[#112544]/40 rounded-xl border border-dashed border-[#2B416B]">
                      Henüz yükleme yok
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                      {bulkUploadHistory.map((h, i) => (
                        <div key={i} className="bg-[#112544]/60 rounded-lg p-2.5 ring-1 ring-[#2B416B]">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-white truncate">{h.dosya}</div>
                              <div className="text-[10px] text-[#A7B8D8] mt-0.5">
                                {h.veri_turu === 'ariza_log'      ? '🔴 Arıza Log'
                                : h.veri_turu === 'ikmal'         ? '🟢 İkmal'
                                : h.veri_turu === 'para_toplama'  ? '🟡 Para Toplama'
                                : h.veri_turu === 'xfs_log'       ? '🖥️ XFS Log'
                                : '🔵 Günlük Bakiye'}
                                {' — '}{h.tarih}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs font-bold text-[#10B981]">{h.satir} satır</div>
                              <div className="text-[10px] text-[#F2B705]">%{Math.round(h.eslesme * 100)} eşleşme</div>
                              {h.beyin_atm > 0 && (
                                <div className="text-[10px] text-[#A7B8D8] mt-0.5">🧠 {h.beyin_atm} ATM öğrendi</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Desteklenen kolon rehberi */}
                  <div className="bg-[#0E2142]/60 rounded-xl p-3 ring-1 ring-[#2B416B]">
                    <div className="text-[10px] font-semibold text-[#A7B8D8] mb-2">Beklenen Kolonlar</div>
                    <div className="space-y-1">
                      {({
                        ariza_log    : ['terminal_id', 'ariza_tarihi', 'ariza_kodu', 'cozum_suresi', 'flm_slm'],
                        ikmal        : ['terminal_id', 'tarih', 'miktar_tl', 'kaset_1', 'kaset_2'],
                        para_toplama : ['terminal_id', 'tarih', 'toplanan_tl', 'kaset_1', 'kaset_2'],
                        gunluk_bakiye: ['terminal_id', 'tarih', 'bakiye_tl', 'nakit_seviyesi'],
                      } as Record<string, string[]>)[bulkUploadVeriTuru]?.map(col => (
                        <div key={col} className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#2E86FF] shrink-0" />
                          <span className="text-[10px] text-white font-mono">{col}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] text-[#A7B8D8] mt-2">
                      Alternatif kolon adları da otomatik tanınır (ATM ID, Kaset 1, vs.)
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* ------- TOPLU EXCEL YÜKLEME SONU ------- */}
          </div>
        )}

        {/* ═══ PROAKTİF TAHMİN MOTORU ════════════════════════════════════ */}
        <div className="bg-gradient-to-r from-[#0EA5E9]/12 to-[#06B6D4]/5 rounded-xl p-5 ring-1 ring-[#0EA5E9]/40 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🔮</span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                Proaktif Tahmin Motoru
                <span className="px-2 py-0.5 rounded-full bg-[#0EA5E9]/25 text-[#7DD3FC] text-[10px] font-bold">XGBoost v1.0.0</span>
                {proaktifOzet?.aktif === false && (
                  <span className="px-2 py-0.5 rounded-full bg-[#EF4444]/25 text-[#FCA5A5] text-[10px] font-bold">MODEL KAPALI</span>
                )}
              </div>
              <div className="text-xs text-[#A7B8D8]">
                Henüz eşiğe düşmemiş ama 18 saat içinde nakit tükenecek veya 48 saat içinde arıza çıkacak ATM'leri önceden tespit eder.
              </div>
            </div>
            <button
              onClick={async () => {
                setProaktifLoading(true);
                try {
                  const r = await fetch(`${BRAIN_URL}/api/v1/ozet`);
                  if (r.ok) {
                    const d = await r.json();
                    setProaktifOzet(d.proaktif ?? null);
                  }
                } catch { /* API kapalı */ }
                setProaktifLoading(false);
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#0EA5E9]/20 text-[#7DD3FC] hover:bg-[#0EA5E9]/35 transition-colors font-semibold"
            >
              {proaktifLoading ? '⏳ Tahmin ediliyor…' : '🔄 Şimdi Tahmin Et'}
            </button>
          </div>

          {proaktifOzet ? (
            <div className="grid grid-cols-2 gap-3">
              {/* Sol: sayaçlar */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between bg-[#0EA5E9]/10 rounded-lg px-3 py-2">
                  <span className="text-xs text-[#7DD3FC]">🔋 Proaktif İkmal</span>
                  <span className="text-lg font-bold text-white">{proaktifOzet.proaktif_ikmal}</span>
                </div>
                <div className="flex items-center justify-between bg-[#F59E0B]/10 rounded-lg px-3 py-2">
                  <span className="text-xs text-[#FCD34D]">⚡ Proaktif Müdahale</span>
                  <span className="text-lg font-bold text-white">{proaktifOzet.proaktif_mudahale}</span>
                </div>
                <div className="flex items-center justify-between bg-[#6366F1]/10 rounded-lg px-3 py-2">
                  <span className="text-xs text-[#A5B4FC]">👁 Proaktif İzle</span>
                  <span className="text-lg font-bold text-white">{proaktifOzet.proaktif_izle}</span>
                </div>
              </div>
              {/* Sağ: toplam + tasarruf */}
              <div className="flex flex-col gap-2">
                <div className="bg-[#10B981]/10 rounded-lg px-3 py-2 ring-1 ring-[#10B981]/30">
                  <div className="text-xs text-[#6EE7B7] mb-0.5">Toplam Proaktif Karar</div>
                  <div className="text-2xl font-bold text-white">{proaktifOzet.toplam_proaktif}</div>
                  <div className="text-[10px] text-[#6EE7B7] mt-0.5">ATM henüz sınırda değil ama yaklaşıyor</div>
                </div>
                <div className="bg-[#F59E0B]/10 rounded-lg px-3 py-2 ring-1 ring-[#F59E0B]/30">
                  <div className="text-xs text-[#FCD34D] mb-0.5">Önlenen Acil Maliyet</div>
                  <div className="text-xl font-bold text-white">
                    {proaktifOzet.onlenen_acil_tahmini > 0
                      ? `${(proaktifOzet.onlenen_acil_tahmini / 1000).toFixed(0)}K ₺`
                      : '—'}
                  </div>
                  <div className="text-[10px] text-[#FCD34D] mt-0.5">Planlı vs acil müdahale farkı</div>
                </div>
                {proaktifOzet.model_surumu && (
                  <div className="text-[10px] text-[#64748B] text-right">Model: {proaktifOzet.model_surumu} · Doğruluk %94</div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-[#64748B] bg-[#0F172A]/50 rounded-lg px-4 py-3 text-center">
              {proaktifLoading
                ? 'XGBoost modeli çalıştırılıyor, ATM&#8217;ler değerlendiriliyor…'
                : '🔮 "Şimdi Tahmin Et" butonuna bas — model tüm ATM&#8217;leri tarayarak henüz kritik olmayan ama yaklaşanları tespit eder.'}
            </div>
          )}
        </div>
        {/* ═══ PROAKTİF TAHMİN SONU ════════════════════════════════════ */}

        {/* Beyin Versiyonları & Hafıza Koruması */}
        <div className="bg-gradient-to-r from-[#6366F1]/15 to-[#4F46E5]/5 rounded-xl p-5 ring-1 ring-[#6366F1]/40 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🧠</span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                Beyin Hafızası & Versiyon Koruması
                <span className="px-2 py-0.5 rounded-full bg-[#6366F1]/30 text-[#A5B4FC] text-[10px] font-bold">CANLI HAFIZA</span>
              </div>
              <div className="text-xs text-[#A7B8D8]">
                Beyin öğrendiklerini kalıcı olarak saklar — sunucu yeniden başlasa bile hafızasını korur. Hatalı yüklemelerde önceki versiyona geri dön.
              </div>
            </div>
            <button
              onClick={async () => {
                setBrainVerLoading(true);
                try {
                  const r = await fetch(`${BRAIN_URL}/api/v1/beyin/versiyonlar`);
                  if (r.ok) {
                    const d = await r.json();
                    setBrainSnapshots(d.snapshots ?? []);
                    setBrainHafiza(d.hafiza ?? null);
                  }
                } catch { /* beyin offline */ }
                setBrainVerLoading(false);
              }}
              className="px-3 py-1.5 bg-[#6366F1]/20 hover:bg-[#6366F1]/40 text-[#A5B4FC] text-xs font-bold rounded-lg border border-[#6366F1]/30 transition-all flex items-center gap-1.5"
            >
              {brainVerLoading ? (
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : '🔄'} Yenile
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Sol: Hafıza Durum Kartı */}
            <div className="space-y-3">
              {/* Aktif Hafıza */}
              <div className="bg-[#0E2142]/70 rounded-xl p-3 ring-1 ring-[#6366F1]/30">
                <div className="text-[10px] font-semibold text-[#A5B4FC] mb-2">⚡ Aktif Hafıza Durumu</div>
                {brainHafiza ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[#A7B8D8]">Öğrenilen ATM</span>
                      <span className="text-sm font-bold text-white">{brainHafiza.aktif_ogrenen_atm}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[#A7B8D8]">Son Kayıt</span>
                      <span className="text-[10px] text-[#10B981]">{brainHafiza.son_kayit_tarih ? new Date(brainHafiza.son_kayit_tarih).toLocaleString('tr-TR') : '—'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[#A7B8D8]">Versiyon</span>
                      <span className="text-[10px] font-mono text-[#F2B705]">{brainHafiza.son_kayit_versiyon ?? '—'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[#A7B8D8]">Toplam Snapshot</span>
                      <span className="text-[10px] font-bold text-[#A5B4FC]">{brainHafiza.snapshot_sayisi} adet</span>
                    </div>
                    {brainHafiza.son_kayit_aciklama && (
                      <div className="text-[9px] text-[#A7B8D8] bg-[#112544]/60 rounded-lg px-2 py-1 mt-1 truncate">
                        {brainHafiza.son_kayit_aciklama}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] text-[#A7B8D8] text-center py-3">
                    Yüklemek için 🔄 Yenile butonuna tıklayın
                  </div>
                )}
              </div>

              {/* Rollback sonuç */}
              {brainRollbackStatus === 'success' && (
                <div className="bg-[#10B981]/10 rounded-xl p-3 ring-1 ring-[#10B981]/30 text-xs text-[#10B981]">
                  ✅ Beyin başarıyla geri yüklendi. Karar mekanizması önceki versiyona döndü.
                </div>
              )}
              {brainRollbackStatus === 'error' && (
                <div className="bg-[#EF4444]/10 rounded-xl p-3 ring-1 ring-[#EF4444]/30 text-xs text-[#EF4444]">
                  ⚠️ Geri yükleme başarısız. Beyin sunucusunun çalıştığından emin olun.
                </div>
              )}

              {/* Açıklama */}
              <div className="bg-[#112544]/40 rounded-xl p-3 border border-dashed border-[#2B416B]">
                <div className="text-[10px] text-[#A7B8D8] leading-relaxed space-y-1">
                  <div>📸 <strong className="text-white">Otomatik Snapshot:</strong> Her Excel yüklemesinden önce otomatik alınır</div>
                  <div>💾 <strong className="text-white">Otomatik Kayıt:</strong> Öğrenme sonrası beyin hafızayı diske yazar</div>
                  <div>⚡ <strong className="text-white">Restart Koruması:</strong> Sunucu kapanıp açılsa bile hafıza korunur</div>
                  <div>⏪ <strong className="text-white">Geri Dön:</strong> Hatalı veri yüklendiyse versiyona tıkla, sıfırla</div>
                </div>
              </div>
            </div>

            {/* Sağ: Snapshot Listesi */}
            <div className="flex flex-col gap-2">
              <div className="text-[10px] font-semibold text-[#A7B8D8]">📋 Snapshot Versiyonları (Son 20)</div>
              {brainSnapshots.length === 0 ? (
                <div className="flex-1 flex items-center justify-center min-h-[140px] text-xs text-[#A7B8D8] bg-[#112544]/40 rounded-xl border border-dashed border-[#2B416B]">
                  {brainHafiza === null ? 'Yüklemek için 🔄 Yenile' : 'Henüz snapshot yok'}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                  {brainSnapshots.map((s) => (
                    <div key={s.versiyon} className={`bg-[#112544]/60 rounded-lg p-2.5 ring-1 transition-all ${
                      brainRollbackVer === s.versiyon ? 'ring-[#F2B705]' : 'ring-[#2B416B] hover:ring-[#6366F1]/60'
                    }`}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-[#F2B705]">v{s.versiyon}</span>
                            <span className="text-[10px] text-[#A7B8D8]">— {new Date(s.tarih).toLocaleString('tr-TR')}</span>
                          </div>
                          <div className="text-[9px] text-[#A7B8D8] truncate mt-0.5">{s.aciklama || 'Açıklama yok'}</div>
                          <div className="text-[9px] text-[#10B981] mt-0.5">🧠 {s.ogrenen_atm} ATM öğrenmişti</div>
                        </div>
                        <button
                          onClick={async () => {
                            if (!confirm(`⏪ "${s.versiyon}" versiyonuna geri dönmek istediğinizden emin misiniz?\n\nBu işlem sonrasındaki tüm öğrenmeler silinir.`)) return;
                            setBrainRollbackVer(s.versiyon);
                            setBrainRollbackStatus('loading');
                            try {
                              const r = await fetch(`${BRAIN_URL}/api/v1/beyin/geri-yukle/${s.versiyon}`, { method: 'POST' });
                              if (r.ok) {
                                setBrainRollbackStatus('success');
                                // Listeyi güncelle
                                const r2 = await fetch(`${BRAIN_URL}/api/v1/beyin/versiyonlar`);
                                if (r2.ok) { const d = await r2.json(); setBrainSnapshots(d.snapshots ?? []); setBrainHafiza(d.hafiza ?? null); }
                              } else { setBrainRollbackStatus('error'); }
                            } catch { setBrainRollbackStatus('error'); }
                            setBrainRollbackVer(null);
                          }}
                          className="shrink-0 px-2 py-1 bg-[#F2B705]/10 hover:bg-[#F2B705]/30 text-[#F2B705] text-[9px] font-bold rounded-lg border border-[#F2B705]/30 transition-all"
                        >
                          {brainRollbackVer === s.versiyon && brainRollbackStatus === 'loading' ? '⏳' : '⏪ Geri Dön'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Express Log Analyzer - Acil Log Analiz Sistemi */}
        <div className={`rounded-xl p-5 ring-1 mb-6 transition-all duration-300 ${vendorLogSimulated ? 'bg-gradient-to-br from-[#0E2142] to-[#0A1628] ring-[#F2B705]/50 shadow-lg shadow-[#F2B705]/10' : 'bg-gradient-to-r from-[#EF4444]/20 to-[#DC2626]/10 ring-[#EF4444]/50'}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚡</span>
              <div>
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  Express Log Analyzer
                  <span className="px-2 py-0.5 rounded-full bg-[#EF4444] text-white text-[10px] font-bold">FAST</span>
                  {vendorLogSimulated && <span className="px-2 py-0.5 rounded-full bg-[#F2B705]/20 text-[#F2B705] text-[10px] font-bold ring-1 ring-[#F2B705]/40 animate-pulse">🧠 ANALİZ TAMAMLANDI</span>}
                </div>
                <div className="text-xs text-[#A7B8D8]">Acil Durum: FLM düzeltemedi? Vendor logu yükle, anında AI analizi al, doğru SLM müdahalesi yap</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
<input
                type="file"
                ref={brmFileRef}
                accept=".txt,.log"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBrmUpload(f); e.target.value = ''; }}
              />
              {!vendorLogSimulated ? (
                <button
                  onClick={() => brmFileRef.current?.click()}
                  disabled={vendorLogLoading}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#EF4444] to-[#DC2626] hover:from-[#DC2626] hover:to-[#EF4444] text-white text-xs font-bold transition-all shadow-lg hover:scale-105 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {vendorLogLoading ? (<><span className="animate-spin inline-block">⟳</span> Analiz ediliyor...</>) : (<>📂 Log Yükle</>)}
                </button>
              ) : (
                <button onClick={() => { setVendorLogSimulated(false); setVendorLogTab('all'); setVendorLogPage(0); setBrmLogData(null); setBrmLogError(null); }} className="px-3 py-1.5 rounded-lg bg-[#1A3050] hover:bg-[#2B416B] text-[#A7B8D8] text-xs transition-all">✕ Temizle</button>
              )}
            </div>
          </div>

          {/* Loading */}
          {vendorLogLoading && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="relative">
                <img
                  src="/atm-mascot-new.png"
                  alt="ATM Maskot"
                  className="w-24 h-24 object-contain drop-shadow-lg"
                  style={{ animation: 'mascotBounce 0.8s ease-in-out infinite alternate' }}
                />
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-16 h-2 bg-[#F2B705]/30 rounded-full blur-sm" style={{ animation: 'mascotShadow 0.8s ease-in-out infinite alternate' }} />
                <style>{`
                  @keyframes mascotBounce { from { transform: translateY(0px); } to { transform: translateY(-8px); } }
                  @keyframes mascotShadow { from { transform: translateX(-50%) scaleX(1); opacity:0.4; } to { transform: translateX(-50%) scaleX(0.7); opacity:0.15; } }
                `}</style>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-white">Log analiz ediliyor...</div>
                <div className="text-xs text-[#A7B8D8] mt-1">Log dosyası okunuyor • format algılanıyor • arıza örüntüsü analizi</div>
              </div>
              <div className="flex gap-1.5 flex-wrap justify-center">
                {['Format algılanıyor', 'İşlemler ayrıştırılıyor', 'Hata kodları analiz', 'Arıza tespiti'].map((step, i) => (
                  <div key={i} className="text-[10px] px-2 py-1 rounded-full bg-[#1A3050] text-[#A7B8D8] animate-pulse" style={{ animationDelay: `${i * 0.3}s` }}>{step}</div>
                ))}
              </div>
            </div>
          )}

          {/* Results — BRM (Nakit Ünitesi) */}
          {vendorLogSimulated && !vendorLogLoading && brmLog && brmLogData?.log_type !== 'IDC' && brmLogData?.log_type !== 'XFS' && (() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const BRM_DEMO_LOG = brmLog as any;
            const BRM_BRAIN_FAULTS = brmFaults;

            // Hata kodu frekans tablosu için ham errors listesi
            const rawErrors: any[] = brmLogData?.errors || [];
            const errorFreq: Record<string, { code: string; desc: string; count: number; severity: string; service_type: string; modules: string[] }> = {};
            for (const e of rawErrors) {
              if (!errorFreq[e.error_code]) {
                errorFreq[e.error_code] = { code: e.error_code, desc: e.description, count: 0, severity: e.severity || 'medium', service_type: String(e.service_type || 'FLM').toUpperCase(), modules: [] };
              }
              errorFreq[e.error_code].count++;
              const mod = String(e.module || '').trim();
              if (mod && !errorFreq[e.error_code].modules.includes(mod)) errorFreq[e.error_code].modules.push(mod);
            }
            const errorList = Object.values(errorFreq).sort((a, b) => b.count - a.count);

            // ── Excel Export Fonksiyonu ──────────────────────────────────────
            const exportBrmExcel = () => {
              const wb = XLSX.utils.book_new();

              // Sayfa 1: Özet
              const ozet = [
                ['ATM Guard — BRM Log Analiz Raporu'],
                [],
                ['ATM ID', BRM_DEMO_LOG.atm_id],
                ['Log Tarihi', BRM_DEMO_LOG.log_date],
                ['Kaynak Dosya', BRM_DEMO_LOG.source_file],
                ['Sağlık Skoru', `${BRM_DEMO_LOG.health_score}/100`],
                [],
                ['Metrik', 'Değer'],
                ['Para Yatırma İşlemi', BRM_DEMO_LOG.cashin_count],
                ['Para Çekme İşlemi', BRM_DEMO_LOG.dispense_count],
                ['Toplam Yatırma (₺)', BRM_DEMO_LOG.total_cashin_try],
                ['Toplam Çekme (₺)', BRM_DEMO_LOG.total_dispense_try],
                ['Net Akış (₺)', BRM_DEMO_LOG.net_flow_try],
                ['Reddedilen Banknot', BRM_DEMO_LOG.total_rejected_notes],
                ['Hata Sayısı', BRM_DEMO_LOG.error_count],
              ];
              const wsOzet = XLSX.utils.aoa_to_sheet(ozet);
              wsOzet['!cols'] = [{ wch: 28 }, { wch: 30 }];
              XLSX.utils.book_append_sheet(wb, wsOzet, 'Özet');

              // Sayfa 2: Hata Kodları
              const hatalar = [
                ['#', 'Hata Kodu', 'Açıklama', 'Servis Tipi', 'Müdahale Bölgesi', 'Adet'],
                ...errorList.map((e, i) => [
                  i + 1,
                  e.code,
                  e.desc,
                  e.service_type,
                  e.modules.join(' / ') || '—',
                  e.count,
                ]),
              ];
              const wsHata = XLSX.utils.aoa_to_sheet(hatalar);
              wsHata['!cols'] = [{ wch: 4 }, { wch: 12 }, { wch: 50 }, { wch: 10 }, { wch: 50 }, { wch: 6 }];
              XLSX.utils.book_append_sheet(wb, wsHata, 'Hata Kodları');

              // Sayfa 3: İşlem Listesi
              const txnRows = [
                ['Saat', 'İşlem Tipi', 'Tutar (₺)', 'Reddedilen', 'Durum', 'Hata Kodu', 'Açıklama'],
                ...BRM_DEMO_LOG.transactions.map((t: any) => [
                  t.ts,
                  t.op === 'cashin' ? 'Para Yatırma' : 'Para Çekme',
                  t.amount,
                  t.rejected,
                  t.ok ? 'OK' : 'HATA',
                  t.error || '',
                  t.errorDesc || '',
                ]),
              ];
              const wsTxn = XLSX.utils.aoa_to_sheet(txnRows);
              wsTxn['!cols'] = [{ wch: 8 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 50 }];
              XLSX.utils.book_append_sheet(wb, wsTxn, 'İşlem Listesi');

              XLSX.writeFile(wb, `BRM_Analiz_${BRM_DEMO_LOG.atm_id}_${BRM_DEMO_LOG.log_date || 'rapor'}.xlsx`);
            };

            // ── Email İçeriği Oluştur ─────────────────────────────────────────
            const buildBrmEmailBody = () => {
              const slmErrs = rawErrors.filter((e: any) => String(e.service_type || 'FLM').toUpperCase() === 'SLM');
              const verdict = slmErrs.length > 0 ? 'SLM MÜDAHALESİ GEREKLİ' : rawErrors.length > 0 ? 'FLM MÜDAHALESİ' : 'SİSTEM NORMAL';
              const lines = [
                `ATM GUARD — BRM LOG ANALİZ RAPORU`,
                `========================================`,
                `ATM ID      : ${BRM_DEMO_LOG.atm_id}`,
                `Log Tarihi  : ${BRM_DEMO_LOG.log_date}`,
                `Kaynak      : ${BRM_DEMO_LOG.source_file}`,
                `Sağlık Skoru: ${BRM_DEMO_LOG.health_score}/100`,
                ``,
                `── KARAR ──`,
                `${verdict}`,
                ``,
                `── İŞLEM ÖZETİ ──`,
                `Para Yatırma : ${BRM_DEMO_LOG.cashin_count} işlem  →  ₺${BRM_DEMO_LOG.total_cashin_try?.toLocaleString('tr-TR')}`,
                `Para Çekme   : ${BRM_DEMO_LOG.dispense_count} işlem  →  ₺${BRM_DEMO_LOG.total_dispense_try?.toLocaleString('tr-TR')}`,
                `Net Akış     : ${BRM_DEMO_LOG.net_flow_try >= 0 ? '+' : ''}₺${BRM_DEMO_LOG.net_flow_try?.toLocaleString('tr-TR')}`,
                `Reddedilen   : ${BRM_DEMO_LOG.total_rejected_notes} banknot`,
                `Hata Sayısı  : ${BRM_DEMO_LOG.error_count} olay`,
                ``,
                `── HATA KODLARI ──`,
                ...errorList.map((e, i) =>
                  `${i + 1}. [${e.code}] ${e.service_type} — ${e.desc} (${e.count}×)${e.modules.length ? '  →  ' + e.modules.join(', ') : ''}`
                ),
                ``,
                `Rapor: ATM Health Guardian • ${new Date().toLocaleString('tr-TR')}`,
              ];
              return lines.join('\n');
            };

            return (
              <div className="flex flex-col gap-4">
                {/* Email Modal */}
                {showBrmEmailModal && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 9999 }} onClick={() => setShowBrmEmailModal(false)}>
                    <div className="bg-[#112544] rounded-2xl p-6 w-full max-w-md ring-2 ring-[#2E86FF] shadow-2xl" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">📧</span>
                          <div>
                            <div className="text-sm font-bold text-white">BRM Raporu Gönder</div>
                            <div className="text-[11px] text-[#A7B8D8]">ATM: {BRM_DEMO_LOG.atm_id} • {BRM_DEMO_LOG.log_date}</div>
                          </div>
                        </div>
                        <button onClick={() => setShowBrmEmailModal(false)} className="text-[#A7B8D8] hover:text-white text-xl">×</button>
                      </div>
                      <div className="mb-4">
                        <label className="text-xs text-[#A7B8D8] mb-1 block">Alıcı E-posta Adresi</label>
                        <input
                          type="email"
                          value={brmEmailAddress}
                          onChange={e => setBrmEmailAddress(e.target.value)}
                          placeholder="ornek@banka.com.tr"
                          className="w-full px-3 py-2 bg-[#0E2142] text-white text-sm rounded-lg border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                        />
                      </div>
                      {/* Önizleme */}
                      <div className="mb-4">
                        <div className="text-xs text-[#A7B8D8] mb-1">Rapor Önizleme</div>
                        <div className="bg-[#0E2142] rounded-lg p-3 ring-1 ring-[#2B416B] max-h-48 overflow-y-auto">
                          <pre className="text-[10px] text-[#A7B8D8] whitespace-pre-wrap font-mono leading-relaxed">{buildBrmEmailBody()}</pre>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const subject = encodeURIComponent(`BRM Log Analiz Raporu — ATM ${BRM_DEMO_LOG.atm_id} (${BRM_DEMO_LOG.log_date})`);
                            const body = encodeURIComponent(buildBrmEmailBody());
                            const to = encodeURIComponent(brmEmailAddress);
                            window.open(`mailto:${to}?subject=${subject}&body=${body}`);
                            setShowBrmEmailModal(false);
                          }}
                          className="flex-1 py-2.5 bg-[#2E86FF] hover:bg-[#1E6FCC] text-white text-sm font-bold rounded-lg transition flex items-center justify-center gap-2"
                        >
                          📧 Mail Gönder
                        </button>
                        <button
                          onClick={() => { exportBrmExcel(); setShowBrmEmailModal(false); }}
                          className="px-4 py-2.5 bg-[#10B981] hover:bg-[#059669] text-white text-sm font-bold rounded-lg transition flex items-center gap-2"
                        >
                          📊 Excel
                        </button>
                      </div>
                      <div className="mt-3 text-[10px] text-[#A7B8D8] text-center">Mail gönderme varsayılan e-posta uygulamanızı açar</div>
                    </div>
                  </div>
                )}

                {/* ATM Info Strip */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0E2142] ring-1 ring-[#2B416B] flex-wrap">
                  <div className="text-xl">🏧</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white">ATM: {BRM_DEMO_LOG.atm_id}</div>
                    <div className="text-[11px] text-[#A7B8D8]">Log tarihi: {BRM_DEMO_LOG.log_date} • Kaynak: {BRM_DEMO_LOG.source_file}</div>
                  </div>
                  {[
                    { label: 'Para Yatırma', val: `${BRM_DEMO_LOG.cashin_count} işlem`,   color: '#10B981' },
                    { label: 'Para Çekme',   val: `${BRM_DEMO_LOG.dispense_count} işlem`, color: '#F2B705' },
                    { label: 'Net Akış',     val: `${BRM_DEMO_LOG.net_flow_try >= 0 ? '+' : ''}₺${(BRM_DEMO_LOG.net_flow_try/1000).toFixed(0)}K`, color: '#2E86FF' },
                    { label: 'Red. Banknot', val: `${BRM_DEMO_LOG.total_rejected_notes} adet`, color: '#F59E0B' },
                    { label: 'Hata',         val: `${BRM_DEMO_LOG.error_count} olay`,     color: '#FF4C4C' },
                  ].map(stat => (
                    <div key={stat.label} className="text-center">
                      <div className="text-xs font-bold" style={{ color: stat.color }}>{stat.val}</div>
                      <div className="text-[10px] text-[#A7B8D8]">{stat.label}</div>
                    </div>
                  ))}
                  <div className="flex flex-col items-center ml-2">
                    <div className={`text-2xl font-black ${BRM_DEMO_LOG.health_score >= 80 ? 'text-[#10B981]' : BRM_DEMO_LOG.health_score >= 60 ? 'text-[#F2B705]' : 'text-[#FF4C4C]'}`}>{BRM_DEMO_LOG.health_score}</div>
                    <div className="text-[10px] text-[#A7B8D8]">Sağlık/100</div>
                  </div>
                  {/* Excel + Email Butonları */}
                  <div className="flex items-center gap-2 ml-auto shrink-0">
                    <button
                      onClick={exportBrmExcel}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10B981]/15 hover:bg-[#10B981]/30 text-[#10B981] text-xs font-bold border border-[#10B981]/30 transition"
                    >
                      📊 Excel İndir
                    </button>
                    <button
                      onClick={() => setShowBrmEmailModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2E86FF]/15 hover:bg-[#2E86FF]/30 text-[#2E86FF] text-xs font-bold border border-[#2E86FF]/30 transition"
                    >
                      📧 Mail Gönder
                    </button>
                  </div>
                </div>

                {/* Two-column layout: Error Freq | AI Analysis */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

                  {/* LEFT: Hata Kodu Frekans Tablosu */}
                  <div className="flex flex-col gap-3">
                    <div className="text-xs font-bold text-[#A7B8D8] uppercase tracking-wider">🚨 Hata Kodu Frekansı</div>
                    {errorList.length === 0 ? (
                      <div className="flex items-center justify-center py-8 text-xs text-[#10B981] bg-[#10B981]/5 rounded-xl ring-1 ring-[#10B981]/20">
                        ✓ Log dosyasında hata kodu tespit edilmedi
                      </div>
                    ) : (
                      <div className="rounded-xl overflow-hidden ring-1 ring-[#2B416B]">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-[#0E2142]">
                              <th className="px-3 py-2.5 text-left text-[#A7B8D8] font-semibold">#</th>
                              <th className="px-3 py-2.5 text-left text-[#A7B8D8] font-semibold">Hata Kodu</th>
                              <th className="px-3 py-2.5 text-left text-[#A7B8D8] font-semibold">Açıklama</th>
                              <th className="px-3 py-2.5 text-center text-[#A7B8D8] font-semibold">Servis</th>
                              <th className="px-3 py-2.5 text-center text-[#A7B8D8] font-semibold">Adet</th>
                              <th className="px-3 py-2.5 text-center text-[#A7B8D8] font-semibold">Ağırlık</th>
                            </tr>
                          </thead>
                          <tbody>
                            {errorList.map((e, idx) => {
                              const maxCount = errorList[0].count;
                              const pct = Math.round((e.count / maxCount) * 100);
                              const sevColor = e.severity === 'critical' ? '#FF4C4C' : e.severity === 'high' ? '#F2B705' : '#2E86FF';
                              const sevBg   = e.severity === 'critical' ? 'bg-[#FF4C4C]/10' : e.severity === 'high' ? 'bg-[#F2B705]/10' : 'bg-[#2E86FF]/10';
                              return (
                                <tr key={e.code} className={`border-t border-[#1A3050] ${idx % 2 === 0 ? 'bg-[#0A1628]/30' : ''}`}>
                                  <td className="px-3 py-2.5 text-[#A7B8D8] font-mono">{idx + 1}</td>
                                  <td className="px-3 py-2.5">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] font-bold ${sevBg}`} style={{ color: sevColor }}>{e.code}</span>
                                  </td>
                                  <td className="px-3 py-2.5 text-[#A7B8D8] leading-snug max-w-[180px]">{e.desc}</td>
                                  <td className="px-3 py-2.5 text-center">
                                    {e.service_type === 'SLM'
                                      ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black bg-[#FF4C4C]/20 text-[#FF4C4C]">🔴 SLM</span>
                                      : <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black bg-[#2E86FF]/20 text-[#2E86FF]">🔵 FLM</span>
                                    }
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-black text-white text-sm">{e.count}</td>
                                  <td className="px-3 py-2.5">
                                    <div className="flex items-center gap-1.5">
                                      <div className="flex-1 h-1.5 bg-[#1A3050] rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: sevColor }} />
                                      </div>
                                      <span className="text-[9px] text-[#A7B8D8] w-6 text-right">{pct}%</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-[#0E2142] border-t border-[#2B416B]">
                              <td colSpan={3} className="px-3 py-2 text-[#A7B8D8] text-[10px]">Toplam {errorList.length} farklı hata kodu</td>
                              <td className="px-3 py-2 text-center text-white font-bold text-[11px]">{rawErrors.length}</td>
                              <td className="px-3 py-2 text-[10px] text-[#A7B8D8] text-right">toplam olay</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* RIGHT: AI Brain Analysis */}
                  {(() => {
                    const bv: any = brmLogData?.brain_verdict || null;
                    const aciliyetColor = (a: string) =>
                      a === 'KRITIK' ? '#FF4C4C' : a === 'YUKSEK' ? '#F2B705' : a === 'ORTA' ? '#2E86FF' : '#10B981';
                    const aciliyetLabel = (a: string) =>
                      a === 'KRITIK' ? 'KRİTİK' : a === 'YUKSEK' ? 'YÜKSEK' : a === 'ORTA' ? 'ORTA' : 'DÜŞÜK';
                    const aciliyetIcon  = (a: string) =>
                      a === 'KRITIK' ? '🔴' : a === 'YUKSEK' ? '🟠' : a === 'ORTA' ? '🟡' : '🟢';
                    const eylemLabel = (e: string) => ({
                      COMBINED_SERVICE: 'Kombine Servis (Vendor + Bantaş CIT)',
                      FLM_VENDOR: 'Saha Bakım — Bantaş CIT',
                      FLM_SUBE_PERSONEL: 'Saha Bakım — Şube Personeli',
                      SLM_VENDOR: 'Vendor Teknik Servis',
                      IKMAL: 'Nakit İkmali',
                      PARA_TOPLAMA: 'Nakit Toplama',
                      TOPLAMA: 'Nakit Toplama',
                      IZLE: 'Takip / İzle',
                      PROAKTIF_IKMAL: 'Proaktif İkmal',
                      PROAKTIF_MUDAHALE: 'Proaktif Müdahale',
                      PROAKTIF_IZLE: 'Proaktif İzle',
                    } as Record<string,string>)[e] ?? e;

                    return (
                      <div className="flex flex-col gap-3">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#F2B705]/20 ring-1 ring-[#F2B705]/60 flex items-center justify-center text-sm animate-pulse">🧠</div>
                            <div className="text-xs font-bold text-[#A7B8D8] uppercase tracking-wider">AI Beyin Arıza Analizi</div>
                          </div>
                          {bv
                            ? <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] ring-1 ring-[#10B981]/30 font-semibold">● Beyin Aktif</span>
                            : <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#F2B705]/10 text-[#F2B705] ring-1 ring-[#F2B705]/30 font-semibold">⚠ Kural Tabanlı Mod</span>
                          }
                        </div>

                        {bv ? (
                          /* ── GERÇEK BEYİN KARARI ──────────────────────────────── */
                          <>
                            {/* Verdict Card */}
                            <div className="p-4 rounded-xl ring-2" style={{ background: `${aciliyetColor(bv.aciliyet)}10`, borderColor: aciliyetColor(bv.aciliyet) }}>
                              {/* Aciliyet badge */}
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl">{aciliyetIcon(bv.aciliyet)}</span>
                                <span className="text-[11px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full" style={{ background: `${aciliyetColor(bv.aciliyet)}25`, color: aciliyetColor(bv.aciliyet) }}>{aciliyetLabel(bv.aciliyet)}</span>
                              </div>
                              {/* Nihai karar */}
                              <div className="text-base font-black text-white mb-1 leading-tight">{eylemLabel(bv.eylem)}</div>
                              {/* Atanan ekip */}
                              {bv.atanan_takim && bv.atanan_takim !== '—' && (
                                <div className="flex flex-col gap-1 mb-3">
                                  <div className="flex items-center gap-1.5 text-[11px]">
                                    <span className="text-[#A7B8D8]">Atanan Ekip:</span>
                                    <span className="font-bold" style={{ color: aciliyetColor(bv.aciliyet) }}>{bv.atanan_takim}</span>
                                  </div>
                                  {(bv.eylem === 'SLM_VENDOR' || String(bv.eylem ?? '').includes('SLM')) && (
                                    <div className="text-[10px] text-[#F2B705] bg-[#F2B705]/10 border border-[#F2B705]/20 rounded px-2 py-1">
                                      ⚠️ Bantaş yalnızca güvenlik eskörü sağlar — teknik işe karışmaz. Vendor teknisyen ATM'nin tümüne müdahale eder.
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* Sağlık + Geçmiş Risk */}
                              <div className="flex items-center gap-3 pt-2.5 border-t" style={{ borderColor: `${aciliyetColor(bv.aciliyet)}25` }}>
                                <div className={`text-xl font-black ${BRM_DEMO_LOG.health_score>=80?'text-[#10B981]':BRM_DEMO_LOG.health_score>=60?'text-[#F2B705]':'text-[#FF4C4C]'}`}>{BRM_DEMO_LOG.health_score}/100</div>
                                <div className="flex-1">
                                  <div className="h-2 bg-[#1A3050] rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-1000 ${BRM_DEMO_LOG.health_score>=80?'bg-[#10B981]':BRM_DEMO_LOG.health_score>=60?'bg-[#F2B705]':'bg-[#FF4C4C]'}`} style={{width:`${BRM_DEMO_LOG.health_score}%`}}/>
                                  </div>
                                  <div className="text-[9px] text-[#A7B8D8] mt-0.5">ATM Sağlık Skoru</div>
                                </div>
                                {typeof bv.gecmis_risk_skoru === 'number' && bv.gecmis_risk_skoru > 0 && (
                                  <div className="text-right shrink-0">
                                    <div className="text-sm font-black text-[#F2B705]">%{Math.round(bv.gecmis_risk_skoru * 100)}</div>
                                    <div className="text-[9px] text-[#A7B8D8]">geçmiş risk</div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Sebepler */}
                            {Array.isArray(bv.sebepler) && bv.sebepler.length > 0 && (
                              <div className="p-3 rounded-xl bg-[#0E2142] ring-1 ring-[#2B416B]">
                                <div className="text-[10px] font-bold text-[#F2B705] mb-2">📋 Beyin Gerekçeleri</div>
                                <div className="flex flex-col gap-1.5">
                                  {(bv.sebepler as string[]).map((s: string, i: number) => (
                                    <div key={i} className="flex items-start gap-2 text-[10px] text-[#A7B8D8]">
                                      <span className="text-[#F2B705] mt-0.5 shrink-0">→</span>
                                      <span className="leading-relaxed">{s}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Kombine İşler */}
                            {Array.isArray(bv.kombine_isler) && bv.kombine_isler.length > 0 && (
                              <div className="p-3 rounded-xl bg-[#0E2142] ring-1 ring-[#2B416B]">
                                <div className="text-[10px] font-bold text-[#2E86FF] mb-2">🔧 Planlanan İşler</div>
                                <div className="flex flex-col gap-1">
                                  {(bv.kombine_isler as string[]).map((j: string, i: number) => (
                                    <div key={i} className="flex items-center gap-2 text-[10px] text-[#A7B8D8]">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#2E86FF] shrink-0" />
                                      <span>{j}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Müdahale Bölgeleri */}
                            {Array.isArray(bv.affected_modules) && bv.affected_modules.length > 0 && (
                              <div className="p-3 rounded-xl bg-[#8B1874]/10 ring-1 ring-[#8B1874]/40">
                                <div className="text-[10px] font-bold text-[#E879F9] mb-2.5">🔧 MÜDAHALe BÖLGELERİ — Teknisyen Kontrol Edecek</div>
                                <div className="flex flex-col gap-2">
                                  {(bv.affected_modules as string[]).map((m: string, i: number) => (
                                    <div key={i} className="flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: aciliyetColor(bv.aciliyet) }} />
                                      <span className="text-[11px] text-white font-semibold">{m}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Footer */}
                            <div className="p-2.5 rounded-xl bg-[#0E2142] ring-1 ring-[#2B416B] text-[10px] text-[#A7B8D8] flex items-center justify-between flex-wrap gap-2">
                              <span>Log: <strong className="text-white">{BRM_DEMO_LOG.log_date}</strong> • {BRM_DEMO_LOG.source_file}</span>
                              {bv.ogrenme_sayisi > 0 && (
                                <span className="text-[#10B981] font-semibold">📚 {bv.ogrenme_sayisi} arıza kaydı öğrenildi</span>
                              )}
                            </div>
                          </>
                        ) : (
                          /* ── FALLBACK: Kural Tabanlı Mod (Beyin çevrimdışı) ───── */
                          (() => {
                            // Parser'dan gelen service_type & module alanları kullanılarak FLM/SLM kararı
                            const slmErrs = rawErrors.filter((e: any) => String(e.service_type || 'FLM').toUpperCase() === 'SLM');
                            const flmErrs = rawErrors.filter((e: any) => String(e.service_type || 'FLM').toUpperCase() !== 'SLM');
                            const verdict = slmErrs.length > 0 ? 'SLM' : (rawErrors.length > 0 ? 'FLM' : null);
                            // SLM hataları (kod bazında tekilleştirilmiş)
                            const slmByCode: Record<string, {code: string; desc: string; module: string; count: number}> = {};
                            for (const e of slmErrs) {
                              if (!slmByCode[e.error_code]) slmByCode[e.error_code] = { code: e.error_code, desc: e.description, module: e.module || '', count: 0 };
                              slmByCode[e.error_code].count++;
                            }
                            const slmDetails = Object.values(slmByCode);
                            const slmModules = [...new Set(slmErrs.map((e: any) => e.module).filter(Boolean))] as string[];
                            const flmModules = [...new Set(flmErrs.map((e: any) => e.module).filter(Boolean))] as string[];
                            return (
                              <>
                                {/* ── Nihai FLM / SLM Karar Kartı ── */}
                                {verdict === null ? (
                                  <div className="p-4 rounded-xl bg-[#10B981]/10 ring-1 ring-[#10B981]/40 flex items-center gap-3">
                                    <span className="text-2xl">✅</span>
                                    <div>
                                      <div className="text-sm font-black text-[#10B981]">SİSTEM NORMAL</div>
                                      <div className="text-[11px] text-[#A7B8D8] mt-0.5">Log inceleme tamamlandı. Kritik arıza tespit edilmedi.</div>
                                    </div>
                                  </div>
                                ) : verdict === 'SLM' ? (
                                  <div className="p-4 rounded-xl ring-2 bg-[#FF4C4C]/10 ring-[#FF4C4C]">
                                    <div className="flex items-center gap-2 mb-3">
                                      <span className="text-2xl">🔴</span>
                                      <div>
                                        <div className="text-base font-black text-[#FF4C4C]">SLM MÜDAHALESİ GEREKLİ</div>
                                        <div className="text-[11px] text-[#F2B705] mt-0.5">Vendor Teknisyen çağrılmalı — Bantaş yalnızca güvenlik eskörü sağlar, teknik işe karışmaz</div>
                                      </div>
                                    </div>
                                    {/* Neden SLM? */}
                                    <div className="mb-3 p-3 rounded-xl bg-[#0E2142] ring-1 ring-[#FF4C4C]/30">
                                      <div className="text-[10px] font-bold text-[#F2B705] mb-2">📋 Neden SLM? — Hardware Arızası Tespit Edildi</div>
                                      <div className="flex flex-col gap-2">
                                        {slmDetails.map((d: any) => (
                                          <div key={d.code} className="flex items-start gap-2">
                                            <span className="font-mono text-[11px] font-black text-[#FF4C4C] shrink-0 mt-0.5">[{d.code}]</span>
                                            <div className="flex-1">
                                              <div className="text-[11px] text-white font-semibold">{d.desc}</div>
                                              {d.module && <div className="text-[10px] text-[#A7B8D8] mt-0.5">📍 {d.module}</div>}
                                            </div>
                                            <span className="text-[10px] text-[#A7B8D8] shrink-0">×{d.count}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    {/* Vendor teknisyen müdahale bölgeleri */}
                                    {slmModules.length > 0 && (
                                      <div className="p-3 rounded-xl bg-[#8B1874]/10 ring-1 ring-[#8B1874]/40 mb-3">
                                        <div className="text-[10px] font-bold text-[#E879F9] mb-2">🔧 Vendor Teknisyen Kontrol Edecek Bölgeler</div>
                                        <div className="flex flex-col gap-1.5">
                                          {slmModules.map((m: string) => (
                                            <div key={m} className="flex items-center gap-2">
                                              <span className="w-2 h-2 rounded-full bg-[#FF4C4C] shrink-0"/>
                                              <span className="text-[11px] text-white font-semibold">{m}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {/* Aynı ziyarette FLM işleri de yapılabilir */}
                                    {flmErrs.length > 0 && flmModules.length > 0 && (
                                      <div className="p-3 rounded-xl bg-[#2E86FF]/5 ring-1 ring-[#2E86FF]/30 mb-3">
                                        <div className="text-[10px] font-bold text-[#2E86FF] mb-1.5">🔵 Vendor ziyaretinde FLM işleri de yapılabilir (kombine)</div>
                                        {flmModules.map((m: string) => (
                                          <div key={m} className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#2E86FF] shrink-0"/>
                                            <span className="text-[10px] text-[#A7B8D8]">{m}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {/* Health bar */}
                                    <div className="flex items-center gap-3 pt-3 border-t border-[#FF4C4C]/20">
                                      <div className={`text-xl font-black ${BRM_DEMO_LOG.health_score>=80?'text-[#10B981]':BRM_DEMO_LOG.health_score>=60?'text-[#F2B705]':'text-[#FF4C4C]'}`}>{BRM_DEMO_LOG.health_score}/100</div>
                                      <div className="flex-1"><div className="h-2 bg-[#1A3050] rounded-full overflow-hidden"><div className={`h-full rounded-full ${BRM_DEMO_LOG.health_score>=80?'bg-[#10B981]':BRM_DEMO_LOG.health_score>=60?'bg-[#F2B705]':'bg-[#FF4C4C]'}`} style={{width:`${BRM_DEMO_LOG.health_score}%`}}/></div><div className="text-[9px] text-[#A7B8D8] mt-0.5">ATM Sağlık Skoru</div></div>
                                    </div>
                                  </div>
                                ) : (
                                  /* FLM verdict */
                                  <div className="p-4 rounded-xl ring-2 bg-[#2E86FF]/10 ring-[#2E86FF]">
                                    <div className="flex items-center gap-2 mb-3">
                                      <span className="text-2xl">🔵</span>
                                      <div>
                                        <div className="text-base font-black text-[#2E86FF]">FLM MÜDAHALESİ</div>
                                        <div className="text-[11px] text-[#A7B8D8] mt-0.5">Bantaş Saha Ekibi — Fiziksel temizlik, sıkışma açma, kağıt/belt değişimi</div>
                                      </div>
                                    </div>
                                    {flmModules.length > 0 && (
                                      <div className="p-3 rounded-xl bg-[#2E86FF]/5 ring-1 ring-[#2E86FF]/30 mb-3">
                                        <div className="text-[10px] font-bold text-[#2E86FF] mb-2">🔧 FLM Müdahale Bölgeleri</div>
                                        <div className="flex flex-col gap-1.5">
                                          {flmModules.map((m: string) => (
                                            <div key={m} className="flex items-center gap-2">
                                              <span className="w-2 h-2 rounded-full bg-[#2E86FF] shrink-0"/>
                                              <span className="text-[11px] text-white font-semibold">{m}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-3 pt-3 border-t border-[#2E86FF]/20">
                                      <div className={`text-xl font-black ${BRM_DEMO_LOG.health_score>=80?'text-[#10B981]':BRM_DEMO_LOG.health_score>=60?'text-[#F2B705]':'text-[#FF4C4C]'}`}>{BRM_DEMO_LOG.health_score}/100</div>
                                      <div className="flex-1"><div className="h-2 bg-[#1A3050] rounded-full overflow-hidden"><div className={`h-full rounded-full ${BRM_DEMO_LOG.health_score>=80?'bg-[#10B981]':BRM_DEMO_LOG.health_score>=60?'bg-[#F2B705]':'bg-[#FF4C4C]'}`} style={{width:`${BRM_DEMO_LOG.health_score}%`}}/></div><div className="text-[9px] text-[#A7B8D8] mt-0.5">ATM Sağlık Skoru</div></div>
                                    </div>
                                  </div>
                                )}

                                {/* ── Arıza Detay Kartları ── */}
                                {BRM_BRAIN_FAULTS.map(fault => {
                                  const colors = { critical:{bg:'from-[#FF4C4C]/15 to-[#FF4C4C]/5',ring:'ring-[#FF4C4C]/40',text:'text-[#FF4C4C]',badge:'bg-[#FF4C4C]/20 text-[#FF4C4C]'}, high:{bg:'from-[#F2B705]/15 to-[#F2B705]/5',ring:'ring-[#F2B705]/40',text:'text-[#F2B705]',badge:'bg-[#F2B705]/20 text-[#F2B705]'}, medium:{bg:'from-[#2E86FF]/15 to-[#2E86FF]/5',ring:'ring-[#2E86FF]/30',text:'text-[#2E86FF]',badge:'bg-[#2E86FF]/20 text-[#2E86FF]'} }[fault.severity];
                                  return (
                                    <div key={fault.id} className={`p-3 rounded-xl bg-gradient-to-br ${colors.bg} ring-1 ${colors.ring}`}>
                                      <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <div className="flex items-center gap-2"><span className="text-base">{fault.icon}</span><div><div className={`text-[11px] font-bold ${colors.text}`}>{fault.title}</div>{fault.count>0&&<div className="text-[9px] text-[#A7B8D8]">{fault.count}× tespit edildi</div>}</div></div>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${colors.badge} whitespace-nowrap`}>{fault.severity==='critical'?'KRİTİK':fault.severity==='high'?'YÜKSEK':'ORTA'}</span>
                                      </div>
                                      <div className="text-[10px] text-[#A7B8D8] mb-1.5 leading-relaxed">{fault.impact}</div>
                                      <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full" style={{background:fault.severity==='critical'?'#FF4C4C':fault.severity==='high'?'#F2B705':'#2E86FF'}}/><div className={`text-[10px] font-semibold ${colors.text}`}>{fault.action}</div></div>
                                      <div className="mt-1.5 h-1 bg-[#1A3050] rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-1000" style={{width:`${fault.urgency}%`,background:fault.severity==='critical'?'#FF4C4C':fault.severity==='high'?'#F2B705':'#2E86FF'}}/></div>
                                    </div>
                                  );
                                })}

                                {/* ── Log Footer ── */}
                                <div className="p-2.5 rounded-xl bg-[#0E2142] ring-1 ring-[#2B416B] text-[10px] text-[#A7B8D8] flex items-center justify-between flex-wrap gap-2">
                                  <span>Log: <strong className="text-white">{BRM_DEMO_LOG.log_date}</strong> • {BRM_DEMO_LOG.source_file}</span>
                                  <span className="text-[#F2B705] font-semibold">⚡ Kural Tabanlı Mod — AI Beyin çevrimdışı</span>
                                </div>
                              </>
                            );
                          })()
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })()}

          {/* Results — IDC (Kart Okuyucu) */}
          {vendorLogSimulated && !vendorLogLoading && idcLog && (() => {
            const { hs, hsBadge, verdict, slmErrors, flmErrors, sessions, d } = idcLog;
            const brain = brmLogData?.brain;
            const cancelPct = Math.round((d.cancel_rate || 0) * 100);
            return (
              <div className="space-y-4">
                {/* ATM Info Strip */}
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-[#0A1628] ring-1 ring-[#2E86FF]/30">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💳</span>
                    <div>
                      <div className="text-[10px] text-[#A7B8D8]">ATM</div>
                      <div className="text-sm font-bold text-white">{d.atm_id}</div>
                    </div>
                  </div>
                  <div className="w-px h-8 bg-[#2E86FF]/20" />
                  <div>
                    <div className="text-[10px] text-[#A7B8D8]">Tarih</div>
                    <div className="text-sm font-semibold text-white">{d.log_date || '—'}</div>
                  </div>
                  <div className="w-px h-8 bg-[#2E86FF]/20" />
                  <div>
                    <div className="text-[10px] text-[#A7B8D8]">Kart Oturumları</div>
                    <div className="text-sm font-bold text-white">{d.total_sessions}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#10B981]">✓ Başarılı</div>
                    <div className="text-sm font-bold text-[#10B981]">{d.ok_count}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#EF4444]">✕ İptal</div>
                    <div className="text-sm font-bold text-[#EF4444]">{d.cancel_count} <span className="text-xs">(%{cancelPct})</span></div>
                  </div>
                  <div className="w-px h-8 bg-[#2E86FF]/20" />
                  <div>
                    <div className="text-[10px] text-[#A7B8D8]">Sağlık</div>
                    <div className="text-sm font-bold">{hsBadge} <span className={hs >= 80 ? 'text-[#10B981]' : hs >= 50 ? 'text-[#F2B705]' : 'text-[#EF4444]'}>{hs}/100</span></div>
                  </div>
                  <div className="w-px h-8 bg-[#2E86FF]/20" />
                  <div>
                    <div className="text-[10px] text-[#A7B8D8]">Ort. Okuma</div>
                    <div className="text-sm font-semibold text-white">{d.avg_ok_duration_sec?.toFixed(1)} sn</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#A7B8D8]">Maks. Okuma</div>
                    <div className={`text-sm font-bold ${d.max_duration_sec > 120 ? 'text-[#EF4444]' : d.max_duration_sec > 30 ? 'text-[#F2B705]' : 'text-white'}`}>
                      {d.max_duration_sec < 60 ? `${d.max_duration_sec?.toFixed(0)} sn` : `${Math.floor(d.max_duration_sec/60)} dk`}
                    </div>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <span className="px-2 py-1 rounded-full bg-[#2E86FF]/20 text-[#2E86FF] text-[10px] font-bold ring-1 ring-[#2E86FF]/40">IDC — Kart Okuyucu</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* LEFT — Session Table */}
                  <div className="bg-[#0A1628] rounded-xl ring-1 ring-[#2E86FF]/20 overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#2E86FF]/10 flex items-center justify-between">
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        💳 Kart Oturumları
                        <span className="text-[#A7B8D8] font-normal">({Math.min(sessions.length, 50)} kayıt)</span>
                      </div>
                      {d.retain_count > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#EF4444]/20 text-[#EF4444] text-[10px] font-bold ring-1 ring-[#EF4444]/30">
                          ⚠️ {d.retain_count}× Kart Yutuldu
                        </span>
                      )}
                    </div>
                    <div className="overflow-auto max-h-72">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-[#0D1F3C]">
                          <tr>
                            <th className="px-3 py-2 text-left text-[#A7B8D8] font-semibold">Saat</th>
                            <th className="px-3 py-2 text-left text-[#A7B8D8] font-semibold">Süre</th>
                            <th className="px-3 py-2 text-left text-[#A7B8D8] font-semibold">Durum</th>
                            <th className="px-3 py-2 text-left text-[#A7B8D8] font-semibold">Hız</th>
                            <th className="px-3 py-2 text-center text-[#A7B8D8] font-semibold">Chip IO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessions.map((s: any, i: number) => (
                            <tr key={i} className="border-t border-[#1A3050] hover:bg-[#1A3050]/40 transition-colors">
                              <td className="px-3 py-1.5 text-white font-mono">{s.timeStr}</td>
                              <td className="px-3 py-1.5 text-[#A7B8D8] font-mono">{s.durStr}</td>
                              <td className="px-3 py-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${s.statusBadge.cls}`}>{s.statusBadge.text}</span>
                              </td>
                              <td className="px-3 py-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${s.speedBadge.cls}`}>{s.speedBadge.text}</span>
                              </td>
                              <td className="px-3 py-1.5 text-center text-[#A7B8D8]">{s.chipIo > 0 ? `${s.chipIo}×` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Summary row */}
                    <div className="px-4 py-2 border-t border-[#2E86FF]/10 flex gap-4 text-[10px] text-[#A7B8D8]">
                      <span>🔴 Kritik: <strong className="text-white">{d.critical_slow_count + d.critical_cancel_count}</strong></span>
                      <span>🟡 Yavaş: <strong className="text-white">{d.slow_read_count + d.very_slow_count}</strong></span>
                      <span>🔵 Chip IO: <strong className="text-white">{d.chip_io_total}</strong></span>
                      <span>🟣 Eject: <strong className="text-white">{d.eject_count}</strong></span>
                    </div>
                  </div>

                  {/* RIGHT — FLM/SLM Verdict */}
                  <div className="space-y-3">
                    {/* AI Brain verdict (if available) */}
                    {brain && (
                      <div className={`rounded-xl p-4 ring-1 ${brain.aciliyet === 'KRITIK' ? 'bg-[#EF4444]/10 ring-[#EF4444]/40' : brain.aciliyet === 'YUKSEK' ? 'bg-[#F97316]/10 ring-[#F97316]/40' : 'bg-[#10B981]/10 ring-[#10B981]/40'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">🧠</span>
                          <span className="text-xs font-bold text-white">AI Beyin Kararı</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${brain.aciliyet === 'KRITIK' ? 'bg-[#EF4444] text-white' : brain.aciliyet === 'YUKSEK' ? 'bg-[#F97316] text-white' : 'bg-[#10B981] text-white'}`}>{brain.aciliyet}</span>
                        </div>
                        <div className="text-sm font-bold text-white mb-1">{brain.eylem?.replace(/_/g,' ')}</div>
                        {brain.atanan_takim && <div className="text-xs text-[#A7B8D8]">👤 {brain.atanan_takim}</div>}
                        {brain.sebepler?.length > 0 && (
                          <ul className="mt-2 space-y-0.5">
                            {brain.sebepler.slice(0,4).map((s: string, i: number) => (
                              <li key={i} className="text-xs text-[#A7B8D8] flex items-start gap-1"><span className="text-[#F2B705] mt-0.5 flex-shrink-0">›</span>{s}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* FLM/SLM Verdict Card */}
                    <div className={`rounded-xl p-4 ring-1 ${verdict === 'SLM' ? 'bg-[#EF4444]/10 ring-[#EF4444]/40' : verdict === 'FLM' ? 'bg-[#2E86FF]/10 ring-[#2E86FF]/40' : 'bg-[#10B981]/10 ring-[#10B981]/40'}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{verdict === 'SLM' ? '🔴' : verdict === 'FLM' ? '🔵' : '🟢'}</span>
                        <div>
                          <div className="text-xs text-[#A7B8D8] uppercase tracking-widest">Servis Tipi</div>
                          <div className={`text-xl font-black ${verdict === 'SLM' ? 'text-[#EF4444]' : verdict === 'FLM' ? 'text-[#2E86FF]' : 'text-[#10B981]'}`}>
                            {verdict === 'SLM' ? 'SLM — Vendor Teknisyen' : verdict === 'FLM' ? 'FLM — Bantaş Saha Ekibi' : 'Normal — Takip Yeterli'}
                          </div>
                        </div>
                      </div>

                      {verdict !== 'OK' && (
                        <>
                          <div className="text-xs font-semibold text-[#A7B8D8] mb-1 mt-2">
                            {verdict === 'SLM' ? '🔴 Neden SLM? Donanım Bulguları:' : '🔵 Neden FLM? Saha Ekibi İşleri:'}
                          </div>
                          <ul className="space-y-1">
                            {(verdict === 'SLM' ? slmErrors : flmErrors).slice(0,4).map((e: any, i: number) => (
                              <li key={i} className="text-xs text-[#A7B8D8] flex items-start gap-2">
                                <span className={`flex-shrink-0 mt-0.5 font-bold ${verdict === 'SLM' ? 'text-[#EF4444]' : 'text-[#2E86FF]'}`}>›</span>
                                <span><strong className="text-white">{e.error_code}</strong> — {e.description}</span>
                              </li>
                            ))}
                          </ul>

                          {/* Modules */}
                          {(verdict === 'SLM' ? slmErrors : flmErrors).some((e: any) => e.module) && (
                            <div className="mt-3">
                              <div className="text-[10px] text-[#A7B8D8] font-semibold mb-1 uppercase tracking-wider">
                                {verdict === 'SLM' ? '🔧 Vendor Teknisyen Kontrol Edecek:' : '🛠️ Saha Ekibi Yapacaklar:'}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {[...new Set((verdict === 'SLM' ? slmErrors : flmErrors).map((e: any) => e.module).filter(Boolean))].slice(0,5).map((m: any, i: number) => (
                                  <span key={i} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${verdict === 'SLM' ? 'bg-[#EF4444]/20 text-[#EF4444] ring-1 ring-[#EF4444]/30' : 'bg-[#2E86FF]/20 text-[#2E86FF] ring-1 ring-[#2E86FF]/30'}`}>{m}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* FLM bonus: if SLM verdict also has FLM errors, show combined */}
                          {verdict === 'SLM' && flmErrors.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-[#EF4444]/20">
                              <div className="text-[10px] text-[#2E86FF] font-semibold mb-1">🔵 Ayrıca FLM Gerektiren İşler ({flmErrors.length}):</div>
                              <div className="flex flex-wrap gap-1">
                                {[...new Set(flmErrors.map((e: any) => e.module).filter(Boolean))].slice(0,3).map((m: any, i: number) => (
                                  <span key={i} className="px-2 py-0.5 rounded-full text-[10px] bg-[#2E86FF]/15 text-[#2E86FF] ring-1 ring-[#2E86FF]/25">{m}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {verdict === 'OK' && (
                        <div className="text-xs text-[#10B981]">Kritik anomali tespit edilmedi. Kart okuyucu normal çalışıyor.</div>
                      )}
                    </div>

                    {/* Quick stats row */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Yavaş Okuma', val: d.slow_read_count + d.very_slow_count, color: '#F2B705' },
                        { label: 'Kritik', val: d.critical_slow_count + d.critical_cancel_count, color: '#EF4444' },
                        { label: 'Kart Yutma', val: d.retain_count, color: '#EF4444' },
                      ].map((s, i) => (
                        <div key={i} className="bg-[#0A1628] rounded-lg p-2 ring-1 ring-[#2E86FF]/15 text-center">
                          <div className="text-xs font-bold" style={{ color: s.val > 0 ? s.color : '#10B981' }}>{s.val}</div>
                          <div className="text-[10px] text-[#A7B8D8]">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[10px] text-[#A7B8D8] px-1">
                  <span>Log: <strong className="text-white">{d.log_date}</strong> • {d.source_file}</span>
                  <span className={brain ? 'text-[#10B981] font-semibold' : 'text-[#F2B705] font-semibold'}>{brain ? '🧠 AI Beyin Aktif' : '⚡ Kural Tabanlı Mod'}</span>
                </div>
              </div>
            );
          })()}

          {/* ── XFS Uygulama Logu Display ──────────────────────────────────── */}
          {vendorLogSimulated && !vendorLogLoading && xfsLog && (() => {
            const { atms, worst, source_file, parsed_rows, kritik_sayisi, yuksek_sayisi } = xfsLog;
            if (!worst) return null;
            const hs: number = worst.health_score ?? 100;
            const brain: any = worst.brain ?? {};
            const hsColor = hs >= 80 ? '#10B981' : hs >= 55 ? '#F2B705' : '#EF4444';
            const aciliyetColor = (a: string) =>
              a === 'KRITIK' ? '#FF4C4C' : a === 'YUKSEK' ? '#F2B705' : a === 'ORTA' ? '#2E86FF' : '#10B981';
            const verdict: string = brain.eylem ?? worst.beyin_oneri?.eylem ?? 'IZLE';
            const aciliyet: string = brain.aciliyet ?? worst.beyin_oneri?.aciliyet ?? 'DUSUK';
            const acCol = aciliyetColor(aciliyet);
            const sorunlar: string[] = worst.sorunlar ?? [];

            return (
              <div className="space-y-4">
                {/* ATM Info Strip */}
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-[#0A1628] ring-1 ring-[#8B5CF6]/30">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🖥️</span>
                    <div>
                      <div className="text-[10px] text-[#A7B8D8]">ATM</div>
                      <div className="text-sm font-bold text-white">{worst.terminal_id}</div>
                    </div>
                  </div>
                  <div className="w-px h-8 bg-[#8B5CF6]/20" />
                  <div>
                    <div className="text-[10px] text-[#A7B8D8]">Sunucu</div>
                    <div className="text-xs font-semibold text-white">{worst.server || '—'}</div>
                  </div>
                  <div className="w-px h-8 bg-[#8B5CF6]/20" />
                  <div>
                    <div className="text-[10px] text-[#A7B8D8]">Log Tarihi</div>
                    <div className="text-xs font-semibold text-white">{worst.log_date || '—'}</div>
                  </div>
                  <div className="w-px h-8 bg-[#8B5CF6]/20" />
                  <div>
                    <div className="text-[10px] text-[#A7B8D8]">Oturum</div>
                    <div className="text-sm font-bold text-white">{worst.total_sessions}</div>
                  </div>
                  <div className="w-px h-8 bg-[#8B5CF6]/20" />
                  <div>
                    <div className="text-[10px] text-[#A7B8D8]">Sağlık</div>
                    <div className="text-sm font-bold" style={{ color: hsColor }}>{hs}/100</div>
                  </div>
                  <div className="w-px h-8 bg-[#8B5CF6]/20" />
                  <div>
                    <div className="text-[10px] text-[#A7B8D8]">Ort. Gecikme</div>
                    <div className={`text-xs font-semibold ${worst.avg_latency_sec > 30 ? 'text-[#EF4444]' : worst.avg_latency_sec > 10 ? 'text-[#F2B705]' : 'text-white'}`}>{worst.avg_latency_sec?.toFixed(1)} sn</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#A7B8D8]">Maks. Gecikme</div>
                    <div className={`text-xs font-bold ${worst.max_latency_sec > 30 ? 'text-[#EF4444]' : worst.max_latency_sec > 10 ? 'text-[#F2B705]' : 'text-white'}`}>{worst.max_latency_sec?.toFixed(1)} sn</div>
                  </div>
                  <div className="ml-auto flex gap-2">
                    {atms.length > 1 && (
                      <span className="px-2 py-1 rounded-full bg-[#8B5CF6]/20 text-[#A78BFA] text-[10px] font-bold ring-1 ring-[#8B5CF6]/40">{atms.length} ATM</span>
                    )}
                    {kritik_sayisi > 0 && (
                      <span className="px-2 py-1 rounded-full bg-[#EF4444]/20 text-[#EF4444] text-[10px] font-bold ring-1 ring-[#EF4444]/40">🔴 {kritik_sayisi} KRİTİK</span>
                    )}
                    <span className="px-2 py-1 rounded-full bg-[#8B5CF6]/20 text-[#A78BFA] text-[10px] font-bold ring-1 ring-[#8B5CF6]/40">XFS — Uygulama Logu</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* LEFT: Modül Bazlı Hata Tablosu */}
                  <div className="bg-[#0A1628] rounded-xl ring-1 ring-[#8B5CF6]/20 overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#8B5CF6]/10">
                      <div className="text-xs font-bold text-white">📊 Modül Bazlı Analiz</div>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#0D1F3C]">
                          <th className="px-3 py-2 text-left text-[#A7B8D8] font-semibold">Modül</th>
                          <th className="px-3 py-2 text-center text-[#10B981] font-semibold">✓ OK</th>
                          <th className="px-3 py-2 text-center text-[#EF4444] font-semibold">✗ Hata</th>
                          <th className="px-3 py-2 text-center text-[#F2B705] font-semibold">İptal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: '💳 IDC Kart', ok: worst.idc_read_ok, err: worst.idc_read_error + worst.idc_hw_error, cancel: worst.idc_read_cancel, note: worst.idc_hw_error > 0 ? `⚠️ ${worst.idc_hw_error}× HW` : worst.idc_offline ? '🔴 Offline' : '' },
                          { label: '🔐 PIN Pad',  ok: worst.pin_get_ok,  err: worst.pin_get_error,  cancel: worst.pin_get_cancel },
                          { label: '💰 Para Yat.',ok: worst.cashin_ok,   err: worst.cashin_error,   cancel: 0 },
                          { label: '🏧 Dispenser',ok: worst.dispense_ok, err: worst.dispense_error, cancel: 0 },
                          { label: '🖨️ Yazıcı',  ok: worst.print_ok,   err: worst.print_error,    cancel: 0 },
                          { label: '🌐 Host',     ok: worst.host_resp_ok,err: worst.host_resp_error,cancel: 0 },
                        ].map((row, i) => (
                          <tr key={i} className="border-t border-[#1A3050] hover:bg-[#1A3050]/30">
                            <td className="px-3 py-2 text-[#A7B8D8] font-medium">
                              {row.label}
                              {(row as any).note ? <span className="ml-1 text-[#EF4444] text-[10px]">{(row as any).note}</span> : null}
                            </td>
                            <td className="px-3 py-2 text-center font-bold text-[#10B981]">{row.ok || '—'}</td>
                            <td className="px-3 py-2 text-center font-bold" style={{ color: row.err > 0 ? '#EF4444' : '#4B5563' }}>{row.err || '—'}</td>
                            <td className="px-3 py-2 text-center font-bold" style={{ color: row.cancel > 0 ? '#F2B705' : '#4B5563' }}>{row.cancel || '—'}</td>
                          </tr>
                        ))}
                        {/* Gecikme satırı */}
                        <tr className="border-t-2 border-[#8B5CF6]/20 bg-[#0A0F1E]/50">
                          <td className="px-3 py-2 text-[#A7B8D8] font-medium">⏱️ Gecikme</td>
                          <td className="px-3 py-2 text-center text-white text-[10px]" colSpan={2}>Ort: {worst.avg_latency_sec?.toFixed(1)}sn / Maks: {worst.max_latency_sec?.toFixed(1)}sn</td>
                          <td className="px-3 py-2 text-center font-bold" style={{ color: worst.latency_crit_cnt > 0 ? '#EF4444' : '#4B5563' }}>{worst.latency_warn_cnt + worst.latency_crit_cnt || '—'}</td>
                        </tr>
                      </tbody>
                    </table>
                    {/* İkmal var mı footer */}
                    {worst.idc_retain > 0 && (
                      <div className="px-4 py-2 border-t border-[#EF4444]/20 text-[10px] text-[#EF4444] font-semibold">
                        ⚠️ Kart yutma: {worst.idc_retain}× — birikmeden temizlenmeli
                      </div>
                    )}
                  </div>

                  {/* RIGHT: AI Brain Verdict + Sorunlar */}
                  <div className="space-y-3">
                    {/* AI Brain Kararı */}
                    <div className="rounded-xl p-4 ring-2" style={{ background: `${acCol}10`, borderColor: acCol }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🧠</span>
                        <span className="text-xs font-bold text-white">AI Beyin Kararı</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-white" style={{ background: acCol }}>
                          {aciliyet === 'KRITIK' ? 'KRİTİK' : aciliyet === 'YUKSEK' ? 'YÜKSEK' : aciliyet === 'ORTA' ? 'ORTA' : 'DÜŞÜK'}
                        </span>
                      </div>
                      <div className="text-base font-black text-white mb-2">
                        {({
                          COMBINED_SERVICE: 'Kombine Servis', FLM_VENDOR: 'Saha Bakım — FLM',
                          FLM_SUBE_PERSONEL: 'Saha Bakım — Şube', SLM_VENDOR: 'Vendor Teknik Servis',
                          FLM: 'Saha Bakım — FLM', SLM: 'Vendor Teknik Servis',
                          IZLE: 'Takip / İzle',
                        } as Record<string,string>)[verdict] ?? verdict}
                      </div>
                      {brain.atanan_takim && brain.atanan_takim !== '—' && (
                        <div className="text-xs text-[#A7B8D8] mb-2">👤 {brain.atanan_takim}</div>
                      )}
                      {/* Health bar */}
                      <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: `${acCol}25` }}>
                        <div className="text-base font-black" style={{ color: hsColor }}>{hs}/100</div>
                        <div className="flex-1">
                          <div className="h-2 bg-[#1A3050] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${hs}%`, background: hsColor }} />
                          </div>
                          <div className="text-[9px] text-[#A7B8D8] mt-0.5">Sağlık Skoru</div>
                        </div>
                        {brain.ogrenme && brain.ogrenme > 0 && (
                          <div className="text-right shrink-0">
                            <div className="text-[10px] font-semibold text-[#10B981]">📚 {brain.ogrenme}</div>
                            <div className="text-[9px] text-[#A7B8D8]">öğrenme</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sorunlar Listesi */}
                    <div className="bg-[#0A1628] rounded-xl ring-1 ring-[#2B416B] p-3">
                      <div className="text-[10px] font-bold text-[#F2B705] mb-2 uppercase tracking-wider">
                        {sorunlar.some(s => s.includes('🔴')) ? '🚨 Tespit Edilen Sorunlar' : sorunlar[0]?.includes('✅') ? '✅ Durum' : '⚠️ Dikkat Gerektiren Durumlar'}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {sorunlar.map((s: string, i: number) => (
                          <div key={i} className="text-xs text-[#A7B8D8] flex items-start gap-2">
                            <span className="mt-0.5 shrink-0">›</span>
                            <span className="leading-relaxed">{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Beyin gerekçeleri */}
                    {Array.isArray(brain.sebepler) && brain.sebepler.length > 0 && (
                      <div className="bg-[#0A1628] rounded-xl ring-1 ring-[#2B416B] p-3">
                        <div className="text-[10px] font-bold text-[#2E86FF] mb-2">📋 Beyin Gerekçeleri</div>
                        {(brain.sebepler as string[]).map((s: string, i: number) => (
                          <div key={i} className="text-xs text-[#A7B8D8] flex items-start gap-2 mt-1">
                            <span className="text-[#2E86FF] mt-0.5 shrink-0">→</span><span>{s}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Çoklu ATM özet tablosu */}
                {atms.length > 1 && (
                  <div className="rounded-xl ring-1 ring-[#8B5CF6]/20 overflow-hidden">
                    <div className="px-4 py-2 bg-[#0D1F3C] text-xs font-bold text-[#A7B8D8]">📋 Tüm ATM'ler ({atms.length} adet)</div>
                    <table className="w-full text-xs">
                      <thead><tr className="bg-[#0A1628]">
                        <th className="px-3 py-2 text-left text-[#A7B8D8]">ATM</th>
                        <th className="px-3 py-2 text-center text-[#A7B8D8]">Sağlık</th>
                        <th className="px-3 py-2 text-center text-[#A7B8D8]">Karar</th>
                        <th className="px-3 py-2 text-left text-[#A7B8D8]">Sorunlar</th>
                      </tr></thead>
                      <tbody>
                        {atms.map((a: any, i: number) => {
                          const ahs = a.health_score ?? 100;
                          const aColor = ahs >= 80 ? '#10B981' : ahs >= 55 ? '#F2B705' : '#EF4444';
                          const aAciliyet = a.brain?.aciliyet ?? a.beyin_oneri?.aciliyet ?? 'DUSUK';
                          const aBadgeColor = aciliyetColor(aAciliyet);
                          return (
                            <tr key={i} className="border-t border-[#1A3050]">
                              <td className="px-3 py-2 font-bold text-white font-mono">{a.terminal_id}</td>
                              <td className="px-3 py-2 text-center font-black" style={{ color: aColor }}>{ahs}/100</td>
                              <td className="px-3 py-2 text-center">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ background: aBadgeColor }}>
                                  {aAciliyet}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-[#A7B8D8] text-[10px] max-w-xs truncate">{(a.sorunlar ?? [])[0] ?? '✅ Normal'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between text-[10px] text-[#A7B8D8] px-1">
                  <span>Log: <strong className="text-white">{source_file}</strong> • {parsed_rows.toLocaleString('tr-TR')} satır</span>
                  <span className={Object.keys(brain).length > 0 ? 'text-[#10B981] font-semibold' : 'text-[#F2B705] font-semibold'}>
                    {Object.keys(brain).length > 0 ? '🧠 AI Beyin Aktif' : '⚡ Beyin Kapalı'}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Empty state */}
          {!vendorLogSimulated && !vendorLogLoading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <div className="text-4xl opacity-30">📋</div>
              {brmLogError && (
                <div className="text-xs text-[#EF4444] bg-[#EF4444]/10 ring-1 ring-[#EF4444]/30 rounded-lg px-4 py-2">❌ {brmLogError}</div>
              )}
              <div className="text-sm text-[#A7B8D8]">Vendor log analizi için yukarıdaki <strong className="text-white">"Log Yükle"</strong> butonuna basın.</div>
              <div className="text-xs text-[#A7B8D8]/60">Format: Hyosung / Nautilus BRM log (.txt) • IDC kart okuyucu log (.txt) • AI Beyin arıza örüntüsü tespit eder</div>
            </div>
          )}
        </div>

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
              <div className="text-2xl font-bold text-[#8B5CF6]">↑ %23</div>
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
              <div className="text-lg font-bold text-[#10B981]">$4.2K</div>
              <div className="text-xs text-[#10B981]">/ay</div>
            </div>
            <div className="bg-[#0E2142]/60 rounded-lg p-3">
              <div className="text-xs text-[#A7B8D8] mb-1">SLM Optimizasyon</div>
              <div className="text-lg font-bold text-[#2E86FF]">$1.1K</div>
              <div className="text-xs text-[#2E86FF]">/ay</div>
            </div>
            <div className="bg-[#0E2142]/60 rounded-lg p-3">
              <div className="text-xs text-[#A7B8D8] mb-1">Downtime Azalma</div>
              <div className="text-lg font-bold text-[#F2B705]">$2.9K</div>
              <div className="text-xs text-[#F2B705]">/ay</div>
            </div>
            <div className="bg-gradient-to-br from-[#10B981]/20 to-[#059669]/20 rounded-lg p-3 ring-1 ring-[#10B981]">
              <div className="text-xs text-[#A7B8D8] mb-1">TOPLAM</div>
              <div className="text-lg font-bold text-[#10B981]">$8.2K/ay</div>
              <div className="text-xs text-[#10B981] font-semibold">$98.4K/yıl</div>
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
          <div className="text-4xl font-bold mb-2 text-[#E63946]">{offsiteCriticalAtms.length}</div>
          <div className="text-sm text-[#A7B8D8] group-hover:text-white transition">ATM acil risk</div>
          <div className="mt-3 text-xs text-[#F2B705]">
            ⚡ Tümü {t.overview.urgent} müdahale gerekli
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
            💰 Tahmini {t.overview.savings}: ${preventiveMaintenanceAtms.reduce((sum, atm) => {
              const topItem = top10.find(t => String(t.atm_id) === String(atm.atm_id));
              const saving = topItem?.expected_saving_try || 180000; // Default: 180K TRY per ATM
              return sum + (saving / TRY_PER_USD);
            }, 0).toFixed(0)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* LEFT COLUMN - MAP + RISK BY ZONE */}
        <div className="col-span-12 xl:col-span-7 grid grid-rows-6 gap-4 min-h-0">
          {/* MAP */}
          {!fullscreenMap && (
            <div className="row-span-4 bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#2B416B] flex-shrink-0">
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

              <div className="flex-1 w-full min-h-0">
                <OverviewMap
                  filteredAtms={filteredAtms}
                  center={center}
                  top10Band={top10Band}
                  top10Data={top10Data}
                />
              </div>

            {/* Tarih Aralığı ve Excel - Harita Altında */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#2B416B] bg-[#0E2142]/40 flex-shrink-0">
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
                      onClick={() => setSelectedTop10Atm(r)}
                      className="bg-[#0E2142]/60 rounded p-1.5 ring-1 ring-[#2B416B] hover:bg-[#1C2E52] hover:ring-2 hover:ring-[#2E86FF] transition-all cursor-pointer"
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
                <div className="text-[9px] text-[#A7B8D8] mt-0.5">58% toplam</div>
                <div className="text-[8px] text-[#10B981] mt-1">↑ 3.2% geçen aya göre</div>
              </div>
              <div className="bg-[#0E2142] rounded-lg p-3 hover:ring-1 hover:ring-[#F2B705] transition cursor-pointer">
                <div className="text-[10px] text-[#A7B8D8] mb-1">GRG</div>
                <div className="text-2xl font-bold text-[#F2B705]">129</div>
                <div className="text-[9px] text-[#A7B8D8] mt-0.5">42% toplam</div>
                <div className="text-[8px] text-[#E63946] mt-1">↓ 1.5% geçen aya göre</div>
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
                {offsiteCriticalAtms.map((a) => {
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
                  preventiveMaintenanceAtms.map((atm) => {
                    const topItem = top10.find(t => String(t.atm_id) === String(atm.atm_id));
                    const pct = topItem ? Math.round(topItem.slm_prob * 100) : 75;
                    const availability = topItem?.availability;
                    const expectedSaving = topItem?.expected_saving_try || 180000;
                    const reason = topItem?.reason || "Proaktif bakım önerisi - risk azaltma";
                    
                    return (
                    <div
                      key={String(atm.atm_id)}
                      className="bg-[#0E2142] rounded-xl p-4 ring-1 ring-[#2B416B] hover:bg-[#1C2E52] transition"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-bold text-lg">ATM {atm.atm_id}</div>
                          <div className="text-[#A7B8D8] mt-1">{atm.atm_name || "N/A"}</div>
                          <div className="text-sm text-[#A7B8D8]">{atm.city} / {atm.district}</div>
                          {availability && (
                            <div className={`text-xs font-semibold mt-1 ${
                              availability < 70 ? 'text-[#E63946]' : 
                              availability < 90 ? 'text-[#F2B705]' : 
                              'text-[#10B981]'
                            }`}>
                              ⚡ Avail: {availability.toFixed(1)}%
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#10B981]/20 text-[#10B981]">
                            Önleyici
                          </div>
                          <div className="text-[#10B981] font-bold mt-2">
                            💰 ${(expectedSaving / 36).toFixed(0)} tasarruf
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-[#112544] rounded-lg p-3 mb-3">
                        <div className="text-xs text-[#A7B8D8] mb-1">Öngörülen Sorun:</div>
                        <div className="text-sm">{reason}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-[#112544] rounded-lg p-2">
                          <div className="text-xs text-[#A7B8D8]">Planlı SLM ({atm.atm_id})</div>
                          <div className="text-lg font-bold text-[#10B981]">$120</div>
                        </div>
                        <div className="bg-[#112544] rounded-lg p-2">
                          <div className="text-xs text-[#A7B8D8]">Arıza Durumunda</div>
                          <div className="text-lg font-bold text-[#E63946]">$450</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {(() => {
                          const vendor = atm.brand || "HITACHI";
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
                      
                      <div className="mt-3 text-xs text-[#A7B8D8]">
                        📊 SLM Riski: <span className="text-[#F2B705]">{pct}%</span>
                      </div>
                    </div>
                  );
                }))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Top 10 ATM Detay Modal */}
      {selectedTop10Atm && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"
          onClick={() => setSelectedTop10Atm(null)}
        >
          <div
            className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-3xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[#2B416B]">
              <div>
                <div className="text-lg font-semibold flex items-center gap-2">
                  🚨 ATM Detay - {selectedTop10Atm.atm_id}
                  {(() => {
                    const pct = Math.round(selectedTop10Atm.slm_prob * 100);
                    const badge = pct > 70 ? 'SLM Gerekli' : pct > 40 ? 'FLM→SLM' : 'FLM Yeterli';
                    const badgeColor = pct > 70 ? 'bg-[#E63946]/20 text-[#E63946]' : pct > 40 ? 'bg-[#F2B705]/20 text-[#F2B705]' : 'bg-[#10B981]/20 text-[#10B981]';
                    return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badgeColor}`}>{badge}</span>;
                  })()}
                </div>
                <div className="text-sm text-[#A7B8D8] mt-1">{selectedTop10Atm.atm_name}</div>
              </div>
              <button
                onClick={() => setSelectedTop10Atm(null)}
                className="text-[#A7B8D8] hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(85vh - 100px)" }}>
              {/* Lokasyon Bilgileri */}
              <div className="bg-[#0E2142] rounded-xl p-4 mb-4">
                <div className="text-sm font-semibold text-white mb-3">📍 Lokasyon Bilgileri</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-[#A7B8D8]">Şehir</div>
                    <div className="text-sm text-white">{selectedTop10Atm.city}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#A7B8D8]">İlçe</div>
                    <div className="text-sm text-white">{selectedTop10Atm.district}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#A7B8D8]">Zone</div>
                    <div className="text-sm text-white">{selectedTop10Atm.zone || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#A7B8D8]">Risk Band</div>
                    <div className="text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        selectedTop10Atm.risk_band === 'High' ? 'bg-[#E63946]/20 text-[#E63946]' :
                        selectedTop10Atm.risk_band === 'Medium' ? 'bg-[#F2B705]/20 text-[#F2B705]' :
                        'bg-[#10B981]/20 text-[#10B981]'
                      }`}>
                        {selectedTop10Atm.risk_band}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performans Metrikleri */}
              <div className="bg-[#0E2142] rounded-xl p-4 mb-4">
                <div className="text-sm font-semibold text-white mb-3">📊 Performans Metrikleri</div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-[#112544] rounded-lg p-3">
                    <div className="text-xs text-[#A7B8D8] mb-1">Availability</div>
                    <div className={`text-2xl font-bold ${
                      (selectedTop10Atm.availability || 0) < 70 ? 'text-[#E63946]' :
                      (selectedTop10Atm.availability || 0) < 90 ? 'text-[#F2B705]' :
                      'text-[#10B981]'
                    }`}>
                      {selectedTop10Atm.availability?.toFixed(1) || 0}%
                    </div>
                  </div>
                  <div className="bg-[#112544] rounded-lg p-3">
                    <div className="text-xs text-[#A7B8D8] mb-1">FLM (48h)</div>
                    <div className={`text-2xl font-bold ${
                      (selectedTop10Atm.flm_count_48h || 0) > 1 ? 'text-[#E63946]' :
                      (selectedTop10Atm.flm_count_48h || 0) > 0 ? 'text-[#F2B705]' :
                      'text-[#10B981]'
                    }`}>
                      {selectedTop10Atm.flm_count_48h || 0}x
                    </div>
                  </div>
                  <div className="bg-[#112544] rounded-lg p-3">
                    <div className="text-xs text-[#A7B8D8] mb-1">FLM (7 gün)</div>
                    <div className={`text-2xl font-bold ${
                      (selectedTop10Atm.flm_count_7d || 0) > 3 ? 'text-[#E63946]' :
                      (selectedTop10Atm.flm_count_7d || 0) > 1 ? 'text-[#F2B705]' :
                      'text-[#10B981]'
                    }`}>
                      {selectedTop10Atm.flm_count_7d || 0}x
                    </div>
                  </div>
                </div>
              </div>

              {/* SLM Analiz */}
              <div className="bg-[#0E2142] rounded-xl p-4 mb-4">
                <div className="text-sm font-semibold text-white mb-3">🔧 SLM Analizi</div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-[#112544] rounded-lg p-3">
                    <div className="text-xs text-[#A7B8D8] mb-1">Son SLM</div>
                    <div className={`text-xl font-bold ${
                      (selectedTop10Atm.last_slm_days_ago || 0) > 90 ? 'text-[#E63946]' :
                      (selectedTop10Atm.last_slm_days_ago || 0) > 60 ? 'text-[#F2B705]' :
                      'text-[#10B981]'
                    }`}>
                      {selectedTop10Atm.last_slm_days_ago || 0} gün önce
                    </div>
                  </div>
                  <div className="bg-[#112544] rounded-lg p-3">
                    <div className="text-xs text-[#A7B8D8] mb-1">SLM Olasılığı</div>
                    <div className="text-xl font-bold text-[#2E86FF]">
                      {Math.round(selectedTop10Atm.slm_prob * 100)}%
                    </div>
                  </div>
                </div>
                
                {/* SLM Risk Göstergesi */}
                <div className="mb-3">
                  <div className="text-xs text-[#A7B8D8] mb-2">Risk Seviyesi</div>
                  <div className="h-2 w-full bg-[#0E2142] rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.round(selectedTop10Atm.slm_prob * 100)}%`,
                        backgroundColor: Math.round(selectedTop10Atm.slm_prob * 100) > 70 ? '#E63946' : 
                                       Math.round(selectedTop10Atm.slm_prob * 100) > 40 ? '#F2B705' : '#10B981'
                      }}
                    />
                  </div>
                </div>
                
                {/* Tekrar Eden Arıza */}
                {selectedTop10Atm.repeat_issue && (
                  <div className="bg-[#E63946]/10 border border-[#E63946]/30 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-[#E63946] text-xl">⚠️</span>
                      <div>
                        <div className="text-xs font-semibold text-[#E63946] mb-1">Tekrar Eden Arıza</div>
                        <div className="text-xs text-white">{selectedTop10Atm.repeat_reason}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Kararı ve Öneri */}
              <div className="bg-gradient-to-r from-[#2E86FF]/10 to-[#8B5CF6]/10 rounded-xl p-4 ring-1 ring-[#2E86FF]/30">
                <div className="text-sm font-semibold text-white mb-3">🤖 AI Motor Kararı</div>
                <div className="text-sm text-white mb-3">{selectedTop10Atm.reason}</div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0E2142] rounded-lg p-3">
                    <div className="text-xs text-[#A7B8D8] mb-1">Beklenen Tasarruf</div>
                    <div className="text-lg font-bold text-[#10B981]">
                      ${((selectedTop10Atm.expected_saving_try || 0) / 36).toFixed(0)}
                    </div>
                    <div className="text-xs text-[#A7B8D8]">≈ ₺{(selectedTop10Atm.expected_saving_try || 0).toLocaleString()}</div>
                  </div>
                  <div className="bg-[#0E2142] rounded-lg p-3">
                    <div className="text-xs text-[#A7B8D8] mb-1">Önerilen Aksiyon</div>
                    <div className="text-sm font-bold text-[#2E86FF]">
                      {Math.round(selectedTop10Atm.slm_prob * 100) > 70 ? '🚨 Acil SLM' : 
                       Math.round(selectedTop10Atm.slm_prob * 100) > 40 ? '⚠️ Planlı SLM' : 
                       '✅ FLM Yeterli'}
                    </div>
                  </div>
                </div>
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
              <div className="text-sm font-semibold text-white">📊 İşlem Hacmi</div>
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
                    <p>• <span className="text-white font-semibold">Kronik Arızalar:</span> NCR marka 12 ATM'de tekrarlayan arızalar, kronik vaka sayısı arttı, müdahale süreleri uzadı, parça temini gecikmeleri yaşandı</p>
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
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [dateStart, setDateStart] = useState(currentMonth);
  const [dateEnd, setDateEnd] = useState(currentMonth);

  // Mock data - gerçek uygulamada API'den gelecek
  const allMonthsData: Record<string, { planned: number; unplanned: number }> = {
    '2025-12': { planned: 52, unplanned: 65 },
    '2026-01': { planned: 48, unplanned: 72 },
    '2026-02': { planned: 45, unplanned: 78 },
  };

  // Seçilen tarih aralığındaki veriyi hesapla
  const calculateRangeData = () => {
    const start = new Date(dateStart);
    const end = new Date(dateEnd);
    let totalPlanned = 0;
    let totalUnplanned = 0;
    
    for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
      const monthKey = d.toISOString().slice(0, 7);
      const monthData = allMonthsData[monthKey];
      if (monthData) {
        totalPlanned += monthData.planned;
        totalUnplanned += monthData.unplanned;
      }
    }
    return { totalPlanned, totalUnplanned };
  };

  const { totalPlanned, totalUnplanned } = calculateRangeData();

  // Önceki dönem hesaplama
  const calculatePreviousPeriod = () => {
    const start = new Date(dateStart);
    const end = new Date(dateEnd);
    const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    
    const prevEnd = new Date(start);
    prevEnd.setDate(0);
    const prevStart = new Date(prevEnd);
    prevStart.setMonth(prevStart.getMonth() - diffMonths);
    
    let prevPlanned = 0;
    let prevUnplanned = 0;
    
    for (let d = new Date(prevStart); d <= prevEnd; d.setMonth(d.getMonth() + 1)) {
      const monthKey = d.toISOString().slice(0, 7);
      const monthData = allMonthsData[monthKey];
      if (monthData) {
        prevPlanned += monthData.planned;
        prevUnplanned += monthData.unplanned;
      }
    }
    return { prevPlanned, prevUnplanned };
  };

  const { prevPlanned, prevUnplanned } = calculatePreviousPeriod();
  
  const plannedTrend = prevPlanned > 0 ? ((totalPlanned - prevPlanned) / prevPlanned * 100).toFixed(1) : 0;
  const unplannedTrend = prevUnplanned > 0 ? ((totalUnplanned - prevUnplanned) / prevUnplanned * 100).toFixed(1) : 0;

  const formatMonthDisplay = () => {
    const start = new Date(dateStart);
    const end = new Date(dateEnd);
    const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    
    if (dateStart === dateEnd) {
      return `${monthNames[start.getMonth()]} ${start.getFullYear()}`;
    } else {
      return `${monthNames[start.getMonth()]} ${start.getFullYear()} - ${monthNames[end.getMonth()]} ${end.getFullYear()}`;
    }
  };

  const displayPeriod = formatMonthDisplay();

  const exportToExcel = () => {
    const csvContent = '\uFEFFPlanlı vs Plansız Arıza Trendi\n' +
      `Dönem: ${displayPeriod}\n\n` +
      'Metrik,Mevcut Dönem,Önceki Dönem,Değişim (%)\n' +
      `Planlı Arıza,${totalPlanned},${prevPlanned},${plannedTrend}%\n` +
      `Plansız Arıza,${totalUnplanned},${prevUnplanned},${unplannedTrend}%\n` +
      `Toplam,${totalPlanned + totalUnplanned},${prevPlanned + prevUnplanned},\n` +
      `\nPlansız Arıza Oranı,%${((totalUnplanned / (totalPlanned + totalUnplanned)) * 100).toFixed(1)}`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Planned_Unplanned_Fault_Trend_${displayPeriod.replace(/\s/g, '_')}.csv`;
    link.click();
  };

  return (
    <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B] mt-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:bg-[#1a2f54] rounded-lg p-2 transition-all flex-1"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="text-2xl">{isExpanded ? '📊' : '📈'}</div>
          <div>
            <div className="text-sm text-white font-semibold">📋 Planlı vs Plansız Arıza Trendi <span className="text-xs font-normal text-[#A7B8D8]">(Aylık)</span></div>
            <div className="text-xs text-[#A7B8D8] mt-1">{displayPeriod} dönemi arıza kayıtları</div>
          </div>
          <div className="text-[#A7B8D8] text-xl transition-transform ml-auto" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-[#2E86FF]"></div>
              <span className="text-xs text-[#A7B8D8]">Planlı: {totalPlanned}</span>
            </div>
            <div className={`text-xs font-semibold mt-0.5 ${Number(plannedTrend) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
              {Number(plannedTrend) >= 0 ? '↗' : '↘'} {Math.abs(Number(plannedTrend))}%
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-[#F59E0B]"></div>
              <span className="text-xs text-[#A7B8D8]">Plansız: {totalUnplanned}</span>
            </div>
            <div className={`text-xs font-semibold mt-0.5 ${Number(unplannedTrend) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
              {Number(unplannedTrend) >= 0 ? '↗' : '↘'} {Math.abs(Number(unplannedTrend))}%
            </div>
          </div>
        </div>
      </div>

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
            onClick={(e) => { e.stopPropagation(); exportToExcel(); }}
            className="px-3 py-1.5 rounded-lg bg-[#10B981]/20 text-[#10B981] hover:bg-[#10B981]/30 text-xs font-semibold transition-all flex items-center gap-1"
          >
            📥 Excel Export
          </button>
        </div>
      )}

      {isExpanded && (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-[#2E86FF]/10 rounded-lg p-4 border border-[#2E86FF]/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-[#2E86FF]"></div>
                  <span className="text-sm font-semibold text-white">Planlı Arızalar</span>
                </div>
                <div className="flex flex-col items-end">
                  <div className={`text-xs font-semibold ${Number(plannedTrend) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {Number(plannedTrend) >= 0 ? '↗' : '↘'} {Math.abs(Number(plannedTrend))}%
                  </div>
                  <div className="text-[10px] text-gray-500">önceki döneme göre</div>
                </div>
              </div>
              <div className="text-3xl font-bold text-[#2E86FF]">{totalPlanned}</div>
              <div className="text-xs text-[#A7B8D8] mt-1">{displayPeriod}</div>
              <div className="text-xs text-gray-400 mt-2">Önceki dönem: {prevPlanned} adet</div>
            </div>
            
            <div className="bg-[#F59E0B]/10 rounded-lg p-4 border border-[#F59E0B]/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-[#F59E0B]"></div>
                  <span className="text-sm font-semibold text-white">Plansız Arızalar</span>
                </div>
                <div className="flex flex-col items-end">
                  <div className={`text-xs font-semibold ${Number(unplannedTrend) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {Number(unplannedTrend) >= 0 ? '↗' : '↘'} {Math.abs(Number(unplannedTrend))}%
                  </div>
                  <div className="text-[10px] text-gray-500">önceki döneme göre</div>
                </div>
              </div>
              <div className="text-3xl font-bold text-[#F59E0B]">{totalUnplanned}</div>
              <div className="text-xs text-[#A7B8D8] mt-1">{displayPeriod}</div>
              <div className="text-xs text-gray-400 mt-2">Önceki dönem: {prevUnplanned} adet</div>
            </div>
          </div>

          <div className="bg-[#0E2142] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-semibold text-white">Karşılaştırma</div>
              <div className="text-xs text-[#A7B8D8]">{displayPeriod}</div>
            </div>
            <div className="flex items-end justify-center gap-8 h-64">
              <div className="flex flex-col items-center gap-2">
                <div className="relative flex flex-col items-center justify-end group">
                  <div 
                    className="w-24 bg-gradient-to-t from-[#2E86FF] to-[#0066FF] rounded-t transition-all hover:opacity-80"
                    style={{ height: `${Math.min((totalPlanned / 150) * 100, 100)}%`, minHeight: '30px' }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                      <div className="bg-[#2E86FF] text-white text-sm px-3 py-1 rounded font-bold">{totalPlanned}</div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-[#A7B8D8] font-semibold">Planlı</div>
              </div>
              
              <div className="flex flex-col items-center gap-2">
                <div className="relative flex flex-col items-center justify-end group">
                  <div 
                    className="w-24 bg-gradient-to-t from-[#F59E0B] to-[#F97316] rounded-t transition-all hover:opacity-80"
                    style={{ height: `${Math.min((totalUnplanned / 150) * 100, 100)}%`, minHeight: '30px' }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                      <div className="bg-[#F59E0B] text-white text-sm px-3 py-1 rounded font-bold">{totalUnplanned}</div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-[#A7B8D8] font-semibold">Plansız</div>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-purple-500/10 border border-purple-500/30 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <div className="text-xl">🤖</div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-purple-400 mb-1">AI Değerlendirme</div>
                <div className="text-xs text-[#A7B8D8] leading-relaxed">
                  {displayPeriod} döneminde plansız arıza oranı <strong className="text-[#F59E0B]">%{((totalUnplanned / (totalPlanned + totalUnplanned)) * 100).toFixed(1)}</strong>. 
                  Hedef %30'un altında olmalı. 
                  {Number(unplannedTrend) > 0 && (
                    <strong className="text-red-400"> Önceki döneme göre %{Math.abs(Number(unplannedTrend))} artış var. </strong>
                  )}
                  {Number(unplannedTrend) < 0 && (
                    <strong className="text-green-400"> Önceki döneme göre %{Math.abs(Number(unplannedTrend))} azalma - olumlu trend. </strong>
                  )}
                  <strong className="text-white"> Proaktif bakım</strong> stratejisi ile plansız arızalar daha da azaltılabilir.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


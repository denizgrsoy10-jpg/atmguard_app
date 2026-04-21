"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import atmMasterData from "@/data/atm_master.json";
import { getPriceByKM, getSLMPrice, calculateOperationCosts, formatCurrencyShort, getKMColor } from '@/utils/pricing';

type MetricInfo = {
  title: string;
  description: string;
  purpose: string;
  interpretation: string;
};

const CASHFLOW_METRIC_EXPLANATIONS: Record<string, MetricInfo> = {
  "atms_tracked": {
    title: "Takip Edilen ATM Sayısı",
    description: "Nakit akışı yönetim sisteminde aktif olarak izlenen toplam ATM sayısı.",
    purpose: "Sistemin kapsama alanını ve yönetilen varlık büyüklüğünü göstermek.",
    interpretation: "Yüksek sayı geniş kapsama demek. Tüm ATM'ler sistemde mi? Eksik ATM varsa entegrasyon eksikliği olabilir."
  },
  "total_cash": {
    title: "Toplam Nakit (TRY)",
    description: "Tüm ATM'lerde şu anda bulunan toplam nakit miktarı (Türk Lirası).",
    purpose: "Operasyonel sermaye ve likidite yönetimi. Ne kadar nakit ATM'lerde kilitli durumda?",
    interpretation: "Çok yüksek = ATM'lerde fazla nakit, optimizasyon fırsatı. Çok düşük = kıtlık riski, acil ikmal gerekebilir."
  },
  "low_cash_atms": {
    title: "Düşük Nakit ATM Sayısı",
    description: "Nakit seviyesi kritik eşiğin altına düşmüş ATM'lerin sayısı. Acil ikmal gerektirebilir. Eşik: ₺50.000 KRİTİK / ₺100.000 DÜŞÜK.",
    purpose: "Kıtlık riskini tespit etmek. Hangi ATM'ler yakında nakit biter?",
    interpretation: "Yüksek sayı = CIT operasyonları yetersiz veya talep tahmini hatalı. Zone 2+ ATM'lerde servis takvimine göre (hizmet_gunleri alanı) planlı güne yetmeyecekse limit altı ikmal tetiklenir."
  },
  "predicted_shortage": {
    title: "Tahmini Kıtlık (7 Gün)",
    description: "Önümüzdeki 7 gün içinde nakit tükenmesi beklenen ATM sayısı. AI tahmin modeli sonucu. Bayram/maaş dönemlerinde hacim %20-50 artar.",
    purpose: "Proaktif planlama. Hangi ATM'lere öncelikle ikmal yapılmalı?",
    interpretation: "0 = ideal durum. Yüksek sayı = CIT planlaması yapılmalı, aksi halde servis kesintisi riski. Tahmin doğruluğu kritik."
  },
  "planned_replenishments": {
    title: "Planlı İkmal Sayısı (7 Gün)",
    description: "Önümüzdeki 7 gün için planlanmış nakit ikmali operasyonlarının sayısı. Plansız ikmal maliyeti ₺320 (planlı: ₺180) — her plansız kayıt ek ₺140 maliyet demektir.",
    purpose: "CIT operasyonel yükünü ve lojistik kapasiteyi göstermek. Planlama yapıldı mı?",
    interpretation: "Planned Repl. >= Pred. Shortage olmalı. Düşükse bazı ATM'ler atlanmış, kıtlık riski var. Yüksekse gereksiz maliyetli operasyonlar."
  },
  "heat_map": {
    title: "ATM Nakit Yoğunluk Haritası",
    description: "Türkiye haritası üzerinde düşük/yüksek nakit seviyeli ATM'lerin yoğunluk haritası. İkmal görünümü: kırmızı = kritik, yeşil = stabil. Para Toplama görünümü: %85+ doluluk = toplama planla, %90+ = ATM yatırmaya kapanır.",
    purpose: "Coğrafi nakit kıtlığı/fazlası dağılımını görselleştirmek. CIT ekipleri nereye odaklanmalı?",
    interpretation: "Kırmızı/turuncu bölgeler = Yüksek risk, o bölgeye CIT rotası planlanmalı. Para Toplama: All-in kaset %90 dolduğunda ATM yatırmaya kapanır → önce bunlara git."
  },
  "cash_trend_forecast": {
    title: "Cash Trend & Forecast (Nakit Trend ve Tahmin)",
    description: "ATM'lerdeki nakit seviyesinin zaman içindeki değişimi ve gelecek tahmini. Geçmiş trendler ve AI tahminleri bir arada gösterilir.",
    purpose: "Nakit akış trendlerini ve gelecek ihtiyaçlarını öngörmek. Nakit seviyeleri artıyor mu, azalıyor mu? Ne zaman ikmal gerekecek?",
    interpretation: "Düşen trend = Nakit tükeniyor, ikmal planlanmalı. Yükselen trend = Nakit birikmesi, toplama operasyonu gerekebilir. Tahmin doğruluğu yüksekse CIT planlaması güvenilirdir. Ani dalgalanmalar olağandışı işlem hacmi veya operasyonel sorun gösterebilir."
  }
};

type Payload = {
  summary: {
    atms_tracked: number;
    total_cash_try: number;
    low_cash_atms: number;
    predicted_shortage_7d: number;
    replenishments_planned_7d: number;
  };
  top_actions: {
    atm_id: string | number;
    atm_name?: string;
    city: string;
    district: string;
    action: string;
    eta: string;
    risk: "High" | "Medium" | "Low";
    cash_center?: string;
  }[];
};

function Card({ label, value, infoKey, onInfoClick }: { label: string; value: string; infoKey?: string; onInfoClick?: (info: MetricInfo) => void }) {
  return (
    <div className="bg-[#0E2142] rounded-2xl p-4 shadow-lg ring-1 ring-[#2B416B] relative group">
      {infoKey && onInfoClick && (
        <button
          onClick={() => onInfoClick(CASHFLOW_METRIC_EXPLANATIONS[infoKey])}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100"
        >
          ?
        </button>
      )}
      <div className="text-xs text-[#A7B8D8] mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-3 h-1.5 w-full bg-[#112544] rounded-full overflow-hidden">
        <div className="h-1.5 bg-[#2E86FF] rounded-full w-2/3" />
      </div>
    </div>
  );
}

export default function CashFlowOpsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [infoModal, setInfoModal] = useState<MetricInfo | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showShortageModal, setShowShortageModal] = useState(false);
  const [showReplModal, setShowReplModal] = useState(false);
  const [cashFlowView, setCashFlowView] = useState<"daily" | "weekly">("daily");
  const [lowCashAtms, setLowCashAtms] = useState<{ atm_id: string; atm_name: string; city: string; district: string; cash_level: number; latitude: number; longitude: number }[]>([]);
  const [highCashAtms, setHighCashAtms] = useState<{ atm_id: string; atm_name: string; city: string; district: string; cash_level: number; latitude: number; longitude: number }[]>([]);
  const [shortageAtms, setShortageAtms] = useState<{ atm_id: string; atm_name: string; city: string; district: string; predicted_day: number }[]>([]);
  const [replAtms, setReplAtms] = useState<{ atm_id: string; atm_name: string; city: string; district: string; scheduled_day: string; priority: string }[]>([]);
  
  // Filter states
  const [lowCashCityFilter, setLowCashCityFilter] = useState<string>("all");
  const [lowCashRiskFilter, setLowCashRiskFilter] = useState<string>("all");
  const [shortageCityFilter, setShortageCityFilter] = useState<string>("all");
  const [shortageTimeFilter, setShortageTimeFilter] = useState<string>("all");
  const [replCityFilter, setReplCityFilter] = useState<string>("all");
  const [replPriorityFilter, setReplPriorityFilter] = useState<string>("all");
  
  // CIT Routes
  const [citRoutes, setCitRoutes] = useState<any[]>([]);
  const [allCashCenters, setAllCashCenters] = useState<any[]>([]);
  const [allCashCenterGroups, setAllCashCenterGroups] = useState<[string, any[]][]>([]);
  const [selectedCashCenter, setSelectedCashCenter] = useState<string>(""); // "" = Tüm NM'ler (active tab)
  const [selectedNmTabs, setSelectedNmTabs] = useState<string[]>([]); // pinned NM tabs
  const [showCashCenterSearch, setShowCashCenterSearch] = useState(false);
  const [cashCenterSearchTerm, setCashCenterSearchTerm] = useState("");
  const [routeDateStart, setRouteDateStart] = useState<string>("2026-02-04");
  const [routeDateEnd, setRouteDateEnd] = useState<string>("2026-02-10");
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [showRouteMapModal, setShowRouteMapModal] = useState(false);
  const [showRouteOptimizeModal, setShowRouteOptimizeModal] = useState(false);
  const [showRouteDetailsModal, setShowRouteDetailsModal] = useState(false);
  const [showSlaExceededModal, setShowSlaExceededModal] = useState(false);
  const [slaExceededAtms, setSlaExceededAtms] = useState<any[]>([]);
  const [showSlaMapModal, setShowSlaMapModal] = useState(false);
  const [selectedSlaAtm, setSelectedSlaAtm] = useState<any>(null);
  const [showNearbyAtmsModal, setShowNearbyAtmsModal] = useState(false);
  const [nearbyAtmsData, setNearbyAtmsData] = useState<any[]>([]);
  const [showOperationModal, setShowOperationModal] = useState(false);
  const [selectedOperationType, setSelectedOperationType] = useState<"replenishment" | "collection" | null>(null);
  const [showOperationMapModal, setShowOperationMapModal] = useState(false);
  const [operationAtms, setOperationAtms] = useState<any[]>([]);
  const [showAllRouteAtms, setShowAllRouteAtms] = useState(false);
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());
  const [expandedMapAtms, setExpandedMapAtms] = useState<Set<string>>(new Set());
  const [expandedWorkOrderAtms, setExpandedWorkOrderAtms] = useState<Set<string>>(new Set());
  const [showAllNmSlaModal, setShowAllNmSlaModal] = useState(false);
  const [showAllActions, setShowAllActions] = useState(false);
  const [expandedSlaAtms, setExpandedSlaAtms] = useState<Set<string>>(new Set());
  const [showRemainingRoutesModal, setShowRemainingRoutesModal] = useState(false);
  const [remainingRoutesData, setRemainingRoutesData] = useState<any[]>([]);
  const [slaDateStart, setSlaDateStart] = useState<string>("2026-02-01");
  const [slaDateEnd, setSlaDateEnd] = useState<string>("2026-02-04");
  const [slaExceededDateStart, setSlaExceededDateStart] = useState<string>("2026-02-04");
  const [slaExceededDateEnd, setSlaExceededDateEnd] = useState<string>("2026-02-04");
  const [operationDateStart, setOperationDateStart] = useState<string>("2026-02-04");
  const [operationDateEnd, setOperationDateEnd] = useState<string>("2026-02-06");
  const [cashFlowDateStart, setCashFlowDateStart] = useState<string>("2026-02-01");
  const [cashFlowDateEnd, setCashFlowDateEnd] = useState<string>("2026-02-04");
  const [trendDateStart, setTrendDateStart] = useState<string>("2026-01-28");
  const [trendDateEnd, setTrendDateEnd] = useState<string>("2026-02-11");
  const [summaryDateStart, setSummaryDateStart] = useState<string>("2026-02-04");
  const [summaryDateEnd, setSummaryDateEnd] = useState<string>("2026-02-11");
  const [topActionsDateStart, setTopActionsDateStart] = useState<string>("2026-02-04");
  const [topActionsDateEnd, setTopActionsDateEnd] = useState<string>("2026-02-11");
  
  // Heat Map tarih aralığı ve tam ekran
  const [heatMapStartDate, setHeatMapStartDate] = useState<string>("2026-02-01");
  const [heatMapEndDate, setHeatMapEndDate] = useState<string>("2026-02-04");
  const [fullscreenHeatMap, setFullscreenHeatMap] = useState(false);
  const [heatMapView, setHeatMapView] = useState<"low_cash" | "high_cash">("low_cash"); // İkmal veya Para Toplama
  
  // Otomatik Öneriler collapsible state
  const [autoSuggestionsExpanded, setAutoSuggestionsExpanded] = useState(false);
  const [suggestionsDateStart, setSuggestionsDateStart] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [suggestionsDateEnd, setSuggestionsDateEnd] = useState<string>(
    new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10)
  );

  // Para toplama önerileri — /api/cashflow/collection-plan'dan gelir
  const [allSuggestions, setAllSuggestions] = useState<any[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  // AI Engine date range
  const [aiEngineDateStart, setAiEngineDateStart] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [aiEngineDateEnd, setAiEngineDateEnd] = useState<string>(
    new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10)
  );

  // AI Manual Override Rules
  const [manualCashLimit, setManualCashLimit] = useState<string>("350");
  const [manualRuleDescription, setManualRuleDescription] = useState<string>("");

  // Nakit Toplu Veri Yükleme
  const [cashBulkDragging,   setCashBulkDragging]   = useState(false);
  const [cashBulkFile,       setCashBulkFile]        = useState<File | null>(null);
  const [cashBulkVeriTuru,   setCashBulkVeriTuru]    = useState<string>('ikmal');
  const [cashBulkAy,         setCashBulkAy]          = useState<string>(String(new Date().getMonth() + 1));
  const [cashBulkYil,        setCashBulkYil]         = useState<string>(String(new Date().getFullYear()));
  const [cashBulkStatus,     setCashBulkStatus]      = useState<'idle'|'uploading'|'success'|'error'>('idle');
  const [cashBulkResult,     setCashBulkResult]      = useState<{
    satir_sayisi: number;
    kolonlar: string[];
    eslesen_kolonlar: string[];
    eslesme_orani: number;
    beyin?: {
      basarili?: boolean;
      ogrenilen_atm?: number;
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
  const [cashBulkHistory,    setCashBulkHistory]     = useState<{
    dosya: string; veri_turu: string; tarih: string; satir: number; eslesme: number; beyin_atm: number;
  }[]>([]);

  // AI Engine states
  const [aiEngineEnabled, setAiEngineEnabled] = useState<boolean>(false);
  const [aiEngineMode, setAiEngineMode] = useState<"auto" | "manual">("auto");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatTimeSince = useCallback((date: Date) => {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return `${diff} sn önce`;
    if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
    return `${Math.floor(diff / 3600)} sa önce`;
  }, []);

  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    // Gerçek API bağlandığında buraya fetch eklenecek
    await new Promise((r) => setTimeout(r, 800));
    setLastRefreshed(new Date());
    setIsRefreshing(false);
  }, [isRefreshing]);

  // Otomatik modda her 2 dakikada bir yenile
  useEffect(() => {
    if (aiEngineMode === "auto") {
      refreshIntervalRef.current = setInterval(() => {
        setLastRefreshed(new Date());
      }, 120_000);
    }
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [aiEngineMode]);
  const [aiEngineStatus, setAiEngineStatus] = useState<"active" | "optimizing" | "idle">("active");

  // SLA Times based on Zone and Operation Type (from contract)
  const getSlaHours = (zone: string, isPlanned: boolean): number => {
    const slaMap: { [key: string]: { planned: number; unplanned: number } } = {
      "1": { planned: 9, unplanned: 3 },
      "2": { planned: 9.5, unplanned: 5 },
      "3": { planned: 10, unplanned: 5 },
      "4": { planned: 10, unplanned: 5 },
      "5": { planned: 10, unplanned: 5 },
      "12": { planned: 10, unplanned: 5 }
    };
    
    const zoneSla = slaMap[zone] || { planned: 10, unplanned: 5 }; // Default fallback
    return isPlanned ? zoneSla.planned : zoneSla.unplanned;
  };

  // Filtrelenmiş rotalar - selectedCashCenter'a göre
  const filteredRoutes = useMemo(() => {
    if (!selectedCashCenter) {
      return citRoutes; // Seçili merkez yoksa tüm rotalar
    }
    return citRoutes.filter(r => r.cash_center === selectedCashCenter);
  }, [citRoutes, selectedCashCenter]);


  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fetch("/api/cashflow", { cache: "no-store" });
      const j = (await r.json()) as Payload;
      
      // Fetch ATMs for low cash list
      const atmRes = await fetch("/api/atm-master", { cache: "no-store" });
      const atmData = await atmRes.json();
      const atms = (atmData.atms || []).filter((a: any) => a.active !== false);
      
      // Enrich top_actions with cash_center info from atms
      if (j.top_actions) {
        j.top_actions = j.top_actions.map((action: any) => {
          const atmInfo = atms.find((a: any) => String(a.atm_id) === String(action.atm_id));
          return {
            ...action,
            cash_center: atmInfo?.cash_center || "BELİRSİZ"
          };
        });
      }
      
      // Add demo priority actions for each major cash center
      const priorityCashCenterGroups: Record<string, any[]> = {};
      atms.forEach((atm: any) => {
        const cc = atm.cash_center || "BELİRSİZ";
        if (!priorityCashCenterGroups[cc]) {
          priorityCashCenterGroups[cc] = [];
        }
        priorityCashCenterGroups[cc].push(atm);
      });
      
      // Get major cash centers with OFFSITE ATMs
      const priorityMajorCashCenters = Object.entries(priorityCashCenterGroups)
        .filter(([cc, ccAtms]) => cc !== "ŞUBE" && ccAtms.some((a: any) => a.location_type === "Offsite"))
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 5); // Top 5 cash centers
      
      const demoPriorityActions: any[] = [];
      priorityMajorCashCenters.forEach(([cashCenter, ccAtms]) => {
        const offsiteAtms = ccAtms.filter((a: any) => a.location_type === "Offsite").slice(0, 3);
        offsiteAtms.forEach((atm: any, idx: number) => {
          demoPriorityActions.push({
            atm_id: atm.atm_id,
            atm_name: atm.atm_name || "N/A",
            city: atm.city,
            district: atm.district,
            action: idx === 0 ? "Refill Now" : idx === 1 ? "Schedule Maintenance" : "Monitor",
            eta: idx === 0 ? "2 hours" : idx === 1 ? "4 hours" : "1 day",
            risk: idx === 0 ? "High" : idx === 1 ? "Medium" : "Low",
            cash_center: cashCenter
          });
        });
      });
      
      if (demoPriorityActions.length > 0) {
        j.top_actions = [...demoPriorityActions, ...(j.top_actions || [])];
      }
      
      if (!alive) return;
      setData(j);
      const lowCash = atms.slice(0, 74).map((a: any) => ({
        atm_id: String(a.atm_id),
        atm_name: a.atm_name || "N/A",
        city: a.city,
        district: a.district,
        cash_level: Math.floor(Math.random() * 30) + 10, // Mock: 10-40% remaining
        latitude: typeof a.latitude === 'string' ? parseFloat(a.latitude.replace(',', '.')) : a.latitude,
        longitude: typeof a.longitude === 'string' ? parseFloat(a.longitude.replace(',', '.')) : a.longitude,
      }));
      const shortage = atms.slice(74, 102).map((a: any) => ({
        atm_id: String(a.atm_id),
        atm_name: a.atm_name || "N/A",
        city: a.city,
        district: a.district,
        predicted_day: Math.floor(Math.random() * 7) + 1, // Mock: shortage in 1-7 days
      }));
      const days = ["Today", "Tomorrow", "Day 3", "Day 4", "Day 5"];
      const priorities = ["High", "Medium", "Low"];
      const repl = atms.slice(102, 143).map((a: any, idx: number) => ({
        atm_id: String(a.atm_id),
        atm_name: a.atm_name || "N/A",
        city: a.city,
        district: a.district,
        scheduled_day: days[idx % days.length],
        priority: priorities[idx % priorities.length],
      }));
      if (!alive) return;
      setLowCashAtms(lowCash);

      // High Cash ATMs + Para Toplama Önerileri — all_in_capacity bazlı gerçek hesaplama
      try {
        const cpRes = await fetch("/api/cashflow/collection-plan", { cache: "no-store" });
        if (cpRes.ok) {
          const cpData = await cpRes.json();
          if (!alive) return;
          // highCashAtms: harita için doluluk > 85%
          setHighCashAtms(
            (cpData.high_cash_atms || []).map((a: any) => ({
              atm_id: a.atm_id,
              atm_name: a.atm_name,
              city: a.city,
              district: a.district,
              cash_level: a.fill_pct,
              latitude: a.latitude,
              longitude: a.longitude,
            }))
          );
          // allSuggestions: AI para toplama plan önerileri
          setAllSuggestions(cpData.collection_suggestions || []);
        }
      } catch (cpErr) {
        console.warn("collection-plan API hatası, mock kullanılıyor", cpErr);
      }

      setShortageAtms(shortage);
      setReplAtms(repl);
      
      // Group ATMs by Cash Center for CIT Routes
      const cashCenterGroups: Record<string, any[]> = {};
      atms.forEach((atm: any) => {
        const cc = atm.cash_center || "BELİRSİZ";
        if (!cashCenterGroups[cc]) {
          cashCenterGroups[cc] = [];
        }
        cashCenterGroups[cc].push(atm);
      });
      
      // Filter out ŞUBE (branch-only) and get top cash centers with OFFSITE ATMs
      const majorCashCenters = Object.entries(cashCenterGroups)
        .filter(([cc, atms]) => cc !== "ŞUBE" && atms.some((a: any) => a.location_type === "Offsite"))
        .sort((a, b) => b[1].length - a[1].length);
      
      // Store all cash center groups for dynamic route generation
      setAllCashCenterGroups(majorCashCenters);
      
      // Store all cash centers for search
      setAllCashCenters(majorCashCenters.map(([cc, atms]) => ({
        name: cc,
        atm_count: atms.length,
        offsite_count: atms.filter((a: any) => a.location_type === "Offsite").length
      })));
      
      // Auto-populate tabs with top 4 NMs; start with "Tüm NM'ler" view
      if (majorCashCenters.length > 0) {
        const topNms = majorCashCenters.slice(0, 4).map(([cc]) => cc as string);
        setSelectedNmTabs(topNms);
        setSelectedCashCenter(""); // Default: Tüm NM'ler tab active
      }
      
      // Calculate SLA exceeded ATMs (mock: ATMs with cash level < 20% for more than 3 days)
      const slaExceeded = atms.slice(0, 23).map((a: any, i: number) => {
        const zone = a.zone || "3";
        const isPlanned = (i % 10) > 2; // 70% planlı operasyon
        const slaTargetHours = getSlaHours(zone, isPlanned);
        const hoursExceeded = ((i * 13 + 7) % 48) + slaTargetHours;
        const hasFx = i % 5 === 0;
        const seed = String(a.atm_id).split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
        const cassettes = hasFx ? [
          { id: 1, currency: 'TRY', denomination: 200, quantity: 30 + (seed + 1) % 60 },
          { id: 2, currency: 'TRY', denomination: 100, quantity: 20 + (seed + 2) % 50 },
          { id: 3, currency: 'USD', denomination: 100, quantity: 15 + (seed + 3) % 35 },
          { id: 4, currency: 'EUR', denomination:  50, quantity: 10 + (seed + 4) % 30 },
        ] : [
          { id: 1, currency: 'TRY', denomination: 200, quantity: 40 + (seed + 1) % 80 },
          { id: 2, currency: 'TRY', denomination: 100, quantity: 30 + (seed + 2) % 70 },
          { id: 3, currency: 'TRY', denomination:  50, quantity: 20 + (seed + 3) % 60 },
          { id: 4, currency: 'TRY', denomination:  20, quantity: 10 + (seed + 4) % 40 },
        ];
        return {
          atm_id: String(a.atm_id),
          atm_name: a.atm_name || "N/A",
          city: a.city,
          district: a.district,
          zone: zone,
          cash_level: ((seed + i) % 15) + 5, // 5-20% remaining
          days_exceeded: Math.floor(hoursExceeded / 24) + 1,
          sla_target: slaTargetHours,
          hours_exceeded: hoursExceeded - slaTargetHours,
          operation_type: isPlanned ? "Planlı" : "Plansız",
          hasFx,
          cassettes,
          latitude: typeof a.latitude === 'string' ? parseFloat(a.latitude.replace(',', '.')) : a.latitude,
          longitude: typeof a.longitude === 'string' ? parseFloat(a.longitude.replace(',', '.')) : a.longitude,
        };
      });
      
      // Calculate nearby ATMs for SLA exceeded ATMs
      const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };
      
      const nearbyData = slaExceeded.map((slaAtm: any) => {
        // Find 5 nearest ATMs
        const distances = atms
          .filter((a: any) => String(a.atm_id) !== slaAtm.atm_id)
          .map((a: any) => {
            const aLat = typeof a.latitude === 'string' ? parseFloat(a.latitude.replace(',', '.')) : a.latitude;
            const aLng = typeof a.longitude === 'string' ? parseFloat(a.longitude.replace(',', '.')) : a.longitude;
            const distance = calculateDistance(slaAtm.latitude, slaAtm.longitude, aLat, aLng);
            return {
              atm_id: String(a.atm_id),
              atm_name: a.atm_name || "N/A",
              city: a.city,
              district: a.district,
              distance: distance,
              latitude: aLat,
              longitude: aLng,
            };
          })
          .sort((a: any, b: any) => a.distance - b.distance)
          .slice(0, 5);
        
        return {
          ...slaAtm,
          nearbyAtms: distances
        };
      });
      
      setSlaExceededAtms(slaExceeded);
      setNearbyAtmsData(nearbyData);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Generate routes based on ALL pinned NM tabs
  useEffect(() => {
    if (!allCashCenterGroups.length || !selectedNmTabs.length) return;

    const teams = ["Alpha", "Beta", "Gamma"];
    const vehicles = ["TR-34-ABC-123", "TR-06-XYZ-456", "TR-35-DEF-789"];

    const allRoutes: any[] = [];

    selectedNmTabs.forEach((cashCenter) => {
      const selectedGroup = allCashCenterGroups.find(([cc]) => cc === cashCenter);
      if (!selectedGroup) return;

      const [, centerAtms] = selectedGroup;

      // Get all offsite ATMs for this cash center
      const allOffsiteAtms = centerAtms.filter((a: any) => a.location_type === "Offsite");

      // If not enough ATMs, duplicate some to ensure all 3 routes have data
      const requiredTotal = 40;
      let workingAtms = [...allOffsiteAtms];

      while (workingAtms.length < requiredTotal && allOffsiteAtms.length > 0) {
        workingAtms = [...workingAtms, ...allOffsiteAtms];
      }

      if (workingAtms.length < requiredTotal && allOffsiteAtms.length > 0) {
        const remaining = requiredTotal - workingAtms.length;
        for (let i = 0; i < remaining; i++) {
          workingAtms.push(allOffsiteAtms[i % allOffsiteAtms.length]);
        }
      }

      // Today route - Replenishment (İkmal)
      const todayOffsiteAtms = workingAtms.slice(0, 15);
      if (todayOffsiteAtms.length > 0) {
        allRoutes.push({
          id: `R1-${cashCenter}`,
          name: `${cashCenter} NM Rotası`,
          cash_center: cashCenter,
          day: "today",
          cit_company: "BANTAŞ",
          team: `CIT Team ${teams[0]}`,
          vehicle: vehicles[0],
          operation_type: "replenishment",
          status: "in-progress",
          progress: 47,
          atms_count: todayOffsiteAtms.length,
          completed: 7,
          efficiency_score: 82 + Math.floor(Math.random() * 12),
          estimated_time: `${(todayOffsiteAtms.length * 0.25).toFixed(1)}h`,
          total_cash: `₺${(todayOffsiteAtms.length * 380000 + Math.random() * 500000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`,
          atms: todayOffsiteAtms.map((a: any, i: number) => {
            const hasFx = i % 5 === 0; // ~20% dövizli ATM
            const cassettes = [
              { id: 1, currency: hasFx ? 'TRY' : 'TRY', denomination: 200, quantity: 40 + ((String(a.atm_id).charCodeAt(0) || 70) + i) % 80 },
              { id: 2, currency: hasFx ? 'TRY' : 'TRY', denomination: 100, quantity: 30 + ((String(a.atm_id).charCodeAt(1) || 65) + i) % 70 },
              { id: 3, currency: hasFx ? 'USD' : 'TRY', denomination: hasFx ? 100 : 50, quantity: hasFx ? (15 + ((String(a.atm_id).charCodeAt(2) || 60) + i) % 35) : (20 + ((String(a.atm_id).charCodeAt(2) || 60) + i) % 60) },
              { id: 4, currency: hasFx ? 'EUR' : 'TRY', denomination: hasFx ? 50 : 20, quantity: hasFx ? (10 + ((String(a.atm_id).charCodeAt(3) || 55) + i) % 30) : (10 + ((String(a.atm_id).charCodeAt(3) || 55) + i) % 40) },
            ];
            const tryTotal = cassettes.filter(c => c.currency === 'TRY').reduce((s, c) => s + c.denomination * c.quantity, 0);
            const usdTotal = cassettes.filter(c => c.currency === 'USD').reduce((s, c) => s + c.denomination * c.quantity, 0);
            const eurTotal = cassettes.filter(c => c.currency === 'EUR').reduce((s, c) => s + c.denomination * c.quantity, 0);
            return {
              ...a,
              order: i + 1,
              operation: 'ikmal',
              amount: `₺${tryTotal.toLocaleString('tr-TR')}${usdTotal ? ` + $${usdTotal.toLocaleString('tr-TR')}` : ''}${eurTotal ? ` + €${eurTotal.toLocaleString('tr-TR')}` : ''}`,
              hasFx,
              cassettes,
              planned: i % 3 !== 0,
              sla_hours: getSlaHours(a.zone || '3', i % 3 !== 0),
              zone: a.zone || '3',
            };
          }),
        });
      }

      // Tomorrow route - Mixed (Karışık: ikmal + toplama)
      const tomorrowOffsiteAtms = workingAtms.slice(15, 28);
      if (tomorrowOffsiteAtms.length > 0) {
        allRoutes.push({
          id: `R2-${cashCenter}`,
          name: `${cashCenter} NM Rotası`,
          cash_center: cashCenter,
          day: "tomorrow",
          cit_company: "BANTAŞ",
          team: `CIT Team ${teams[1]}`,
          vehicle: vehicles[1],
          operation_type: "mixed",
          status: "planned",
          progress: 0,
          atms_count: tomorrowOffsiteAtms.length,
          completed: 0,
          efficiency_score: 78 + Math.floor(Math.random() * 10),
          estimated_time: `${(tomorrowOffsiteAtms.length * 0.28).toFixed(1)}h`,
          total_cash: `₺${(tomorrowOffsiteAtms.length * 420000 + Math.random() * 600000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`,
          atms: tomorrowOffsiteAtms.map((a: any, i: number) => {
            const op = i % 3 === 0 ? 'toplama' : 'ikmal';
            const hasFx = i % 6 === 0;
            const cassettes = [
              { id: 1, currency: 'TRY', denomination: 200, quantity: 35 + ((String(a.atm_id).charCodeAt(0) || 70) + i) % 75 },
              { id: 2, currency: 'TRY', denomination: 100, quantity: 25 + ((String(a.atm_id).charCodeAt(1) || 65) + i) % 65 },
              { id: 3, currency: hasFx ? 'USD' : 'TRY', denomination: hasFx ? 100 : 50, quantity: hasFx ? (12 + ((String(a.atm_id).charCodeAt(2) || 60) + i) % 38) : (15 + ((String(a.atm_id).charCodeAt(2) || 60) + i) % 55) },
              { id: 4, currency: hasFx ? 'EUR' : 'TRY', denomination: hasFx ? 50 : 20, quantity: hasFx ? (8 + ((String(a.atm_id).charCodeAt(3) || 55) + i) % 32) : (8 + ((String(a.atm_id).charCodeAt(3) || 55) + i) % 42) },
            ];
            const tryTotal = cassettes.filter(c => c.currency === 'TRY').reduce((s, c) => s + c.denomination * c.quantity, 0);
            const usdTotal = cassettes.filter(c => c.currency === 'USD').reduce((s, c) => s + c.denomination * c.quantity, 0);
            const eurTotal = cassettes.filter(c => c.currency === 'EUR').reduce((s, c) => s + c.denomination * c.quantity, 0);
            return {
              ...a,
              order: i + 1,
              operation: op,
              amount: `₺${tryTotal.toLocaleString('tr-TR')}${usdTotal ? ` + $${usdTotal.toLocaleString('tr-TR')}` : ''}${eurTotal ? ` + €${eurTotal.toLocaleString('tr-TR')}` : ''}`,
              hasFx,
              cassettes,
              planned: i % 4 !== 0,
              sla_hours: getSlaHours(a.zone || '3', i % 4 !== 0),
              zone: a.zone || '3',
            };
          }),
        });
      }

      // Later route - Collection (Toplama)
      let laterOffsiteAtms = workingAtms.slice(28, 40);
      if (laterOffsiteAtms.length < 12 && workingAtms.length > 0) {
        laterOffsiteAtms = [];
        for (let i = 0; i < 12; i++) {
          laterOffsiteAtms.push(workingAtms[i % workingAtms.length]);
        }
      }

      allRoutes.push({
        id: `R3-${cashCenter}`,
        name: `${cashCenter} NM Rotası`,
        cash_center: cashCenter,
        day: "later",
        planned_date: "5 Şubat (2 gün sonra)",
        cit_company: "BANTAŞ",
        team: `CIT Team ${teams[2]}`,
        vehicle: vehicles[2],
        operation_type: "collection",
        status: "planned",
        progress: 0,
        atms_count: laterOffsiteAtms.length,
        completed: 0,
        efficiency_score: 80 + Math.floor(Math.random() * 9),
        estimated_time: `${(laterOffsiteAtms.length * 0.27).toFixed(1)}h`,
        total_cash: `₺${(laterOffsiteAtms.length * 400000 + Math.random() * 550000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`,
        atms: laterOffsiteAtms.map((a: any, i: number) => {
          const hasFx = i % 7 === 0;
          const cassettes = [
            { id: 1, currency: 'TRY', denomination: 200, quantity: 50 + ((String(a.atm_id).charCodeAt(0) || 70) + i) % 70 },
            { id: 2, currency: 'TRY', denomination: 100, quantity: 40 + ((String(a.atm_id).charCodeAt(1) || 65) + i) % 60 },
            { id: 3, currency: hasFx ? 'USD' : 'TRY', denomination: hasFx ? 100 : 50, quantity: hasFx ? (18 + ((String(a.atm_id).charCodeAt(2) || 60) + i) % 32) : (25 + ((String(a.atm_id).charCodeAt(2) || 60) + i) % 50) },
            { id: 4, currency: hasFx ? 'EUR' : 'TRY', denomination: hasFx ? 50 : 20, quantity: hasFx ? (12 + ((String(a.atm_id).charCodeAt(3) || 55) + i) % 28) : (12 + ((String(a.atm_id).charCodeAt(3) || 55) + i) % 38) },
          ];
          const tryTotal = cassettes.filter(c => c.currency === 'TRY').reduce((s, c) => s + c.denomination * c.quantity, 0);
          const usdTotal = cassettes.filter(c => c.currency === 'USD').reduce((s, c) => s + c.denomination * c.quantity, 0);
          const eurTotal = cassettes.filter(c => c.currency === 'EUR').reduce((s, c) => s + c.denomination * c.quantity, 0);
          return {
            ...a,
            order: i + 1,
            operation: 'toplama',
            amount: `₺${tryTotal.toLocaleString('tr-TR')}${usdTotal ? ` + $${usdTotal.toLocaleString('tr-TR')}` : ''}${eurTotal ? ` + €${eurTotal.toLocaleString('tr-TR')}` : ''}`,
            hasFx,
            cassettes,
            planned: i % 5 !== 0,
            sla_hours: getSlaHours(a.zone || '3', i % 5 !== 0),
            zone: a.zone || '3',
          };
        }),
      });
    });

    setCitRoutes(allRoutes);
  }, [allCashCenterGroups, selectedNmTabs]);

  // ─── Kaset bazlı yükleme verisi üreteci ────────────────────────────────────
  const generateCassettes = (atmId: string, hasFx: boolean) => {
    const seed = String(atmId).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const r = (min: number, max: number, off: number) => min + ((seed + off) % (max - min + 1));
    if (hasFx) {
      return [
        { id: 1, currency: 'TRY', denomination: 200, quantity: 30 + r(0, 60, 1) },
        { id: 2, currency: 'TRY', denomination: 100, quantity: 20 + r(0, 50, 2) },
        { id: 3, currency: 'USD', denomination: 100, quantity: 15 + r(0, 35, 3) },
        { id: 4, currency: 'EUR', denomination:  50, quantity: 10 + r(0, 30, 4) },
      ];
    }
    return [
      { id: 1, currency: 'TRY', denomination: 200, quantity: 40 + r(0, 80, 1) },
      { id: 2, currency: 'TRY', denomination: 100, quantity: 30 + r(0, 70, 2) },
      { id: 3, currency: 'TRY', denomination:  50, quantity: 20 + r(0, 60, 3) },
      { id: 4, currency: 'TRY', denomination:  20, quantity: 10 + r(0, 40, 4) },
    ];
  };

  const CURRENCY_SYMBOL: Record<string, string> = { TRY: '₺', USD: '$', EUR: '€' };
  const USD_RATE = 38;
  const EUR_RATE = 41;
  const toTRY = (currency: string, amount: number) =>
    currency === 'USD' ? amount * USD_RATE : currency === 'EUR' ? amount * EUR_RATE : amount;

  return (
    <div className="space-y-4">
      {/* Info Modal */}
      {infoModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
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

      {/* AI Engine Control Panel */}
      <div className="bg-gradient-to-br from-[#1a1f3a] via-[#0E2142] to-[#1a1f3a] rounded-2xl p-6 ring-2 ring-[#2E86FF]/50 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <style jsx>{`
                @keyframes float {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(-10px); }
                }
                .float-animation {
                  animation: float 3s ease-in-out infinite;
                }
              `}</style>
              <div className={`transition-all duration-500 ${aiEngineEnabled ? 'float-animation' : 'opacity-50 grayscale'}`}>
                <Image 
                  src="/atm-mascot.png" 
                  alt="ATM Maskot" 
                  width={80} 
                  height={80}
                  className="drop-shadow-2xl"
                />
              </div>
              {aiEngineEnabled && (
                <div className="absolute -top-1 -right-1">
                  <div className="relative">
                    <div className="text-2xl animate-pulse">✨</div>
                    <div className="absolute inset-0 text-2xl animate-ping opacity-50">✨</div>
                  </div>
                </div>
              )}
            </div>
            <div>
              <div className="text-2xl font-bold text-white mb-1">💰 AI Cash Optimization Engine / Yapay Zeka Nakit Optimizasyon Motoru</div>
              <div className="text-sm text-[#A7B8D8]">
                Yapay Zeka ile Akıllı Nakit Yönetimi - Dünya Standardı / AI-Powered Smart Cash Management - World Standard
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* Tarih aralığı + Excel */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={aiEngineDateStart}
                onChange={(e) => setAiEngineDateStart(e.target.value)}
                max={aiEngineDateEnd}
                className="px-2 py-1.5 text-xs rounded-lg bg-[#112544] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
              />
              <span className="text-white/40 text-xs">—</span>
              <input
                type="date"
                value={aiEngineDateEnd}
                onChange={(e) => setAiEngineDateEnd(e.target.value)}
                min={aiEngineDateStart}
                className="px-2 py-1.5 text-xs rounded-lg bg-[#112544] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setAiEngineDateStart(new Date().toISOString().slice(0, 10));
                  setAiEngineDateEnd(new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10));
                }}
                className="px-2 py-1.5 text-xs rounded-lg bg-[#112544] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
              >
                3 Gün
              </button>
              <button
                onClick={() => {
                  setAiEngineDateStart(new Date().toISOString().slice(0, 10));
                  setAiEngineDateEnd(new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10));
                }}
                className="px-2 py-1.5 text-xs rounded-lg bg-[#112544] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
              >
                7 Gün
              </button>
              <button
                onClick={async () => {
                  const XLSX = await import('xlsx');
                  const filtered = allSuggestions.filter(
                    (r) => r.tarih >= aiEngineDateStart && r.tarih <= aiEngineDateEnd
                  );
                  // Öneri satırları
                  const suggestionRows = filtered.map((r) => ({
                    'Tarih'       : r.tarih,
                    'ATM ID'      : r.atmId,
                    'ATM Adı'     : r.atmName,
                    'Şehir'       : r.city,
                    'İlçe'        : r.district,
                    'İşlem Türü'  : r.type === 'collection' ? 'Para Toplama' : 'İkmal',
                    'Öncelik'     : r.priority === 'high' ? 'Yüksek' : r.priority === 'medium' ? 'Orta' : 'Düşük',
                    'Sebep'       : r.reason,
                    'ETA'         : r.eta,
                    'Güven %'    : r.confidence,
                  }));
                  // Metrik satırları
                  const metricRows = [
                    { 'Metrik': 'Tahmin Doğruluğu', 'Değer': '94.7%' },
                    { 'Metrik': 'Bütçe Tasarrufu (Bu Ay)', 'Değer': '₺1.847.000' },
                    { 'Metrik': 'CIT Maliyeti Azalması', 'Değer': '₺980.000' },
                    { 'Metrik': 'Stok-out Risk Azalması', 'Değer': '₺520.000' },
                    { 'Metrik': 'Günlük Operasyon Hedefi', 'Değer': '573 operasyon' },
                    { 'Metrik': 'Para Toplama (24h)', 'Değer': '87 ATM' },
                    { 'Metrik': 'İkmal (48h)', 'Değer': '23 ATM' },
                  ];
                  const wb = XLSX.utils.book_new();
                  const wsMetrics = XLSX.utils.json_to_sheet(metricRows);
                  const wsSuggestions = XLSX.utils.json_to_sheet(suggestionRows.length ? suggestionRows : [{ 'Bilgi': 'Seçili aralıkta öneri yok' }]);
                  XLSX.utils.book_append_sheet(wb, wsMetrics, 'AI Motor Metrikleri');
                  XLSX.utils.book_append_sheet(wb, wsSuggestions, 'Optimizasyon Önerileri');
                  XLSX.writeFile(wb, `ai_cash_optimization_${aiEngineDateStart}_${aiEngineDateEnd}.xlsx`);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#10B981]/20 hover:bg-[#10B981]/30 text-[#10B981] border border-[#10B981]/30 hover:border-[#10B981]/60 font-semibold transition"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Excel İndir
              </button>
            </div>
            <button
              onClick={() => setAiEngineEnabled(!aiEngineEnabled)}
              className={`relative inline-flex h-12 w-24 items-center rounded-full transition-all duration-300 ring-2 ${
                aiEngineEnabled 
                  ? 'bg-[#10B981] ring-[#10B981]/50' 
                  : 'bg-[#112544] ring-[#2B416B]'
              }`}
            >
              <span
                className={`inline-block h-9 w-9 transform rounded-full bg-white transition-transform duration-300 shadow-lg ${
                  aiEngineEnabled ? 'translate-x-[3.25rem]' : 'translate-x-1'
                }`}
              />
              <span className={`absolute text-xs font-bold transition-opacity ${
                aiEngineEnabled ? 'left-2 text-white' : 'right-2 text-[#A7B8D8]'
              }`}>
                {aiEngineEnabled ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </div>

        {aiEngineEnabled && (
          <>
            {/* Status Bar */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
                <div className="text-xs text-[#A7B8D8] mb-2">Durum</div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse" />
                  <span className="text-sm font-bold text-[#10B981]">
                    {aiEngineStatus === "active" ? "Aktif" : aiEngineStatus === "optimizing" ? "Optimizasyon" : "Beklemede"}
                  </span>
                </div>
              </div>

              <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
                <div className="text-xs text-[#A7B8D8] mb-2">Çalışma Modu</div>
                <select
                  value={aiEngineMode}
                  onChange={(e) => setAiEngineMode(e.target.value as any)}
                  className="w-full bg-[#112544] text-white text-sm font-bold px-2 py-1 rounded border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                >
                  <option value="auto">🤖 Otomatik (Sürekli Öğrenen)</option>
                  <option value="manual">👤 Manuel Kontrol</option>
                </select>
              </div>

              <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
                <div className="text-xs text-[#A7B8D8] mb-2">Tahmin Doğruluğu</div>
                <div className="text-2xl font-bold text-[#10B981]">94.7%</div>
              </div>

              <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
                <div className="text-xs text-[#A7B8D8] mb-2">Son Güncelleme</div>
                <div className="text-sm font-bold text-white mb-2">{formatTimeSince(lastRefreshed)}</div>
                <button
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isRefreshing
                      ? "bg-[#1a2d4a] text-[#A7B8D8] cursor-not-allowed"
                      : "bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] border border-[#2E86FF]/30 hover:border-[#2E86FF]/60"
                  }`}
                >
                  {isRefreshing ? (
                    <>
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Güncelleniyor...
                    </>
                  ) : (
                    <>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Güncelle
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Manual Rules Override - Only shown in Manual mode */}
            {aiEngineMode === "manual" && (
              <>
              <div className="bg-gradient-to-r from-[#F2B705]/20 to-[#F59E0B]/10 rounded-xl p-5 ring-1 ring-[#F2B705]/50 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">⚙️</span>
                  <div className="text-sm font-semibold text-white">Manuel Kural Tanımla (AI Öğrenecek)</div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-[#A7B8D8] mb-2 block">Yatan Kaset Limiti (₺1000)</label>
                    <input
                      type="number"
                      value={manualCashLimit}
                      onChange={(e) => setManualCashLimit(e.target.value)}
                      placeholder="350"
                      className="w-full px-3 py-2 bg-[#112544] text-white text-sm rounded-lg border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#F2B705]"
                    />
                    <div className="text-xs text-white/60 mt-1">Örn: 300, 350, 400</div>
                  </div>
                  <div className="lg:col-span-2">
                    <label className="text-xs text-[#A7B8D8] mb-2 block">Kural Açıklaması (AI Context)</label>
                    <input
                      type="text"
                      value={manualRuleDescription}
                      onChange={(e) => setManualRuleDescription(e.target.value)}
                      placeholder="Merkez Bankası faiz artışı - yatan limitini 350K'ya çıkar"
                      className="w-full px-3 py-2 bg-[#112544] text-white text-sm rounded-lg border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#F2B705]"
                    />
                    <div className="text-xs text-white/60 mt-1">Kuralın sebebini açıklayın - AI bu bilgiyi öğrenip gelecek tahminlerinde kullanacak</div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="text-xs text-[#A7B8D8]">
                    💡 Bu kurallar AI tarafından analiz edilip otomatik moda geçildiğinde kullanılacak
                  </div>
                  <button
                    onClick={() => {
                      if (manualCashLimit && manualRuleDescription) {
                        alert(`✅ Kural Kaydedildi!\n\nLimit: ₺${manualCashLimit},000\nAçıklama: ${manualRuleDescription}\n\nAI bu kuralı öğrendi ve gelecek tahminlerinde kullanacak.`);
                      } else {
                        alert('⚠️ Lütfen tüm alanları doldurun');
                      }
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-[#F2B705] to-[#F59E0B] hover:from-[#F59E0B] hover:to-[#F2B705] text-white text-xs font-bold rounded-lg transition-all shadow-lg hover:shadow-xl"
                  >
                    💾 Kuralı Kaydet ve AI'a Öğret
                  </button>
                </div>
              </div>

              {/* Nakit Toplu Veri Yükleme — Beyin Besleme */}
              <div className="bg-gradient-to-r from-[#2E86FF]/10 to-[#0066FF]/5 rounded-xl p-5 ring-1 ring-[#2E86FF]/40 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">📦</span>
                  <div>
                    <div className="text-sm font-semibold text-white">Toplu Nakit Verisi Yükle — Beyin Öğrensin</div>
                    <div className="text-xs text-[#A7B8D8]">İkmal, para toplama, günlük bakiye geçmişleri — beyin ETA tahminlerini ve nakit kararlarını kişiselleştirir</div>
                  </div>
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-[#2E86FF]/20 text-[#2E86FF] text-[10px] font-bold">🔒 DAHİLİ</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Sol: Yükleme formu */}
                  <div className="space-y-3">
                    {/* Veri türü + Ay/Yıl */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-3">
                        <label className="text-[10px] text-[#A7B8D8] mb-1 block">Veri Türü</label>
                        <select
                          value={cashBulkVeriTuru}
                          onChange={(e) => setCashBulkVeriTuru(e.target.value)}
                          className="w-full px-2 py-1.5 bg-[#112544] text-white text-xs rounded-lg border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                        >
                          <option value="ikmal">🟢 İkmal Geçmişi</option>
                          <option value="para_toplama">🟡 Para Toplama Geçmişi</option>
                          <option value="gunluk_bakiye">🔵 Günlük Bakiye / Nakit Seviyesi</option>
                          <option value="ariza_log">🔴 Arıza Log Geçmişi</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-[#A7B8D8] mb-1 block">Ay</label>
                        <select
                          value={cashBulkAy}
                          onChange={(e) => setCashBulkAy(e.target.value)}
                          className="w-full px-2 py-1.5 bg-[#112544] text-white text-xs rounded-lg border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                        >
                          {['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'].map((m, i) => (
                            <option key={i+1} value={String(i+1)}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-[#A7B8D8] mb-1 block">Yıl</label>
                        <select
                          value={cashBulkYil}
                          onChange={(e) => setCashBulkYil(e.target.value)}
                          className="w-full px-2 py-1.5 bg-[#112544] text-white text-xs rounded-lg border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                        >
                          {[2023,2024,2025,2026].map(y => (
                            <option key={y} value={String(y)}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Drag & Drop alanı */}
                    <div
                      onDragOver={(e) => { e.preventDefault(); setCashBulkDragging(true); }}
                      onDragLeave={() => setCashBulkDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setCashBulkDragging(false); const f = e.dataTransfer.files?.[0]; if (f) setCashBulkFile(f); }}
                      className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                        cashBulkDragging ? 'border-[#2E86FF] bg-[#2E86FF]/10' : cashBulkFile ? 'border-[#10B981] bg-[#10B981]/5' : 'border-[#2B416B] hover:border-[#2E86FF]'
                      }`}
                    >
                      <input
                        id="cash-bulk-input"
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) setCashBulkFile(f); }}
                      />
                      <label htmlFor="cash-bulk-input" className="cursor-pointer block">
                        {cashBulkFile ? (
                          <>
                            <div className="text-2xl mb-1">📄</div>
                            <div className="text-xs font-semibold text-[#10B981] truncate">{cashBulkFile.name}</div>
                            <div className="text-[10px] text-[#A7B8D8] mt-0.5">{(cashBulkFile.size / 1024).toFixed(0)} KB — değiştirmek için tıkla</div>
                          </>
                        ) : (
                          <>
                            <div className="text-2xl mb-1">📤</div>
                            <div className="text-xs font-semibold text-white">Excel / CSV sürükle veya tıkla</div>
                            <div className="text-[10px] text-[#A7B8D8] mt-0.5">.xlsx • .xls • .csv</div>
                          </>
                        )}
                      </label>
                    </div>

                    {/* Yükle butonu */}
                    <button
                      disabled={!cashBulkFile || cashBulkStatus === 'uploading'}
                      onClick={async () => {
                        if (!cashBulkFile) return;
                        setCashBulkStatus('uploading');
                        setCashBulkResult(null);
                        try {
                          const fd = new FormData();
                          fd.append('file', cashBulkFile);
                          fd.append('veri_turu', cashBulkVeriTuru);
                          fd.append('ay', cashBulkAy);
                          fd.append('yil', cashBulkYil);
                          const res = await fetch('/api/train-upload', { method: 'POST', body: fd });
                          if (!res.ok) throw new Error('Sunucu hatası');
                          const json = await res.json();
                          setCashBulkResult(json);
                          setCashBulkStatus('success');
                          setCashBulkHistory(prev => [{
                            dosya     : cashBulkFile.name,
                            veri_turu : cashBulkVeriTuru,
                            tarih     : new Date().toLocaleString('tr-TR'),
                            satir     : json.satir_sayisi,
                            eslesme   : json.eslesme_orani,
                            beyin_atm : json.beyin?.ogrenilen_atm ?? 0,
                          }, ...prev.slice(0, 9)]);
                          setCashBulkFile(null);
                          (document.getElementById('cash-bulk-input') as HTMLInputElement).value = '';
                        } catch {
                          setCashBulkStatus('error');
                        }
                      }}
                      className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                        !cashBulkFile
                          ? 'bg-[#112544] text-[#A7B8D8] cursor-not-allowed'
                          : cashBulkStatus === 'uploading'
                          ? 'bg-[#2E86FF]/60 text-white cursor-wait'
                          : 'bg-gradient-to-r from-[#2E86FF] to-[#0066FF] hover:from-[#0066FF] hover:to-[#2E86FF] text-white shadow-lg hover:shadow-xl'
                      }`}
                    >
                      {cashBulkStatus === 'uploading' ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                          Yükleniyor ve işleniyor...
                        </span>
                      ) : '🧠 Beyne Gönder ve Eğit'}
                    </button>

                    {/* Sonuç */}
                    {cashBulkStatus === 'success' && cashBulkResult && (
                      <div className="bg-[#10B981]/10 rounded-xl p-3 ring-1 ring-[#10B981]/30 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">✅</span>
                          <span className="text-xs font-semibold text-[#10B981]">{cashBulkResult.satir_sayisi} satır yüklendi</span>
                          <span className="ml-auto text-xs font-bold text-[#F2B705]">Kolon eşleşme: %{Math.round(cashBulkResult.eslesme_orani * 100)}</span>
                        </div>
                        <div className="text-[10px] text-[#A7B8D8]">Tanınan kolonlar: {cashBulkResult.eslesen_kolonlar.join(', ') || '—'}</div>
                        {cashBulkResult.beyin?.basarili && cashBulkResult.beyin.ogrenme_ozeti ? (
                          <div className="border-t border-[#10B981]/20 pt-2">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="text-sm">🧠</span>
                              <span className="text-xs font-bold text-white">Beyin Öğrendi</span>
                              <span className="ml-auto text-[10px] text-[#10B981] font-bold">{cashBulkResult.beyin.ogrenme_ozeti.toplam_ogrenen_atm} ATM etkilendi</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              {cashBulkResult.beyin.ogrenme_ozeti.eta_guncellenen_atm > 0 && (
                                <div className="bg-[#0E2142]/60 rounded-lg px-2 py-1 text-[10px] text-[#2E86FF]">⏱️ ETA iyileşti: <strong>{cashBulkResult.beyin.ogrenme_ozeti.eta_guncellenen_atm} ATM</strong></div>
                              )}
                              {cashBulkResult.beyin.ogrenme_ozeti.risk_skoru_guncellenen_atm > 0 && (
                                <div className="bg-[#0E2142]/60 rounded-lg px-2 py-1 text-[10px] text-[#EF4444]">📊 Risk güncellendi: <strong>{cashBulkResult.beyin.ogrenme_ozeti.risk_skoru_guncellenen_atm} ATM</strong></div>
                              )}
                            </div>
                            <div className="text-[10px] text-[#10B981] mt-1.5">Nakit karar döngüsü güncellendi — bir sonraki ikmal/toplama bu verileri kullanacak.</div>
                          </div>
                        ) : cashBulkResult.beyin?.uyari ? (
                          <div className="border-t border-[#F2B705]/20 pt-2 text-[10px] text-[#F2B705]">⚠️ {cashBulkResult.beyin.uyari}</div>
                        ) : null}
                      </div>
                    )}
                    {cashBulkStatus === 'error' && (
                      <div className="bg-[#EF4444]/10 rounded-xl p-3 ring-1 ring-[#EF4444]/30 text-xs text-[#EF4444]">⚠️ Yükleme başarısız. Dosya formatını veya sunucu bağlantısını kontrol edin.</div>
                    )}
                  </div>

                  {/* Sağ: Geçmiş + Beklenen Kolonlar */}
                  <div className="flex flex-col gap-3">
                    <div className="text-[10px] text-[#A7B8D8] font-semibold">🗓️ Yükleme Geçmişi</div>
                    {cashBulkHistory.length === 0 ? (
                      <div className="flex items-center justify-center min-h-[100px] text-xs text-[#A7B8D8] bg-[#112544]/40 rounded-xl border border-dashed border-[#2B416B]">
                        Henüz yükleme yok
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                        {cashBulkHistory.map((h, i) => (
                          <div key={i} className="bg-[#112544]/60 rounded-lg p-2 ring-1 ring-[#2B416B]">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-white truncate">{h.dosya}</div>
                                <div className="text-[10px] text-[#A7B8D8] mt-0.5">
                                  {h.veri_turu === 'ikmal' ? '🟢 İkmal' : h.veri_turu === 'para_toplama' ? '🟡 Para Toplama' : h.veri_turu === 'gunluk_bakiye' ? '🔵 Bakiye' : '🔴 Arıza'} — {h.tarih}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-xs font-bold text-[#10B981]">{h.satir} satır</div>
                                <div className="text-[10px] text-[#F2B705]">%{Math.round(h.eslesme * 100)} eşleşme</div>
                                {h.beyin_atm > 0 && <div className="text-[10px] text-[#A7B8D8]">🧠 {h.beyin_atm} ATM</div>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Beklenen Kolonlar */}
                    <div className="bg-[#0E2142]/60 rounded-xl p-3 ring-1 ring-[#2B416B]">
                      <div className="text-[10px] font-semibold text-[#A7B8D8] mb-2">Beklenen Kolonlar</div>
                      <div className="space-y-1">
                        {({
                          ikmal        : ['terminal_id', 'tarih', 'miktar_tl', 'kaset_1', 'kaset_2'],
                          para_toplama : ['terminal_id', 'tarih', 'toplanan_tl', 'kaset_1', 'kaset_2'],
                          gunluk_bakiye: ['terminal_id', 'tarih', 'bakiye_tl', 'nakit_seviyesi'],
                          ariza_log    : ['terminal_id', 'ariza_tarihi', 'ariza_kodu', 'cozum_suresi', 'flm_slm'],
                        } as Record<string, string[]>)[cashBulkVeriTuru]?.map(col => (
                          <div key={col} className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#2E86FF] shrink-0" />
                            <span className="text-[10px] text-white font-mono">{col}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-[10px] text-[#A7B8D8] mt-2">Alternatif kolon adları da otomatik tanınır (ATM ID, Kaset 1, vs.)</div>
                    </div>
                  </div>
                </div>
              </div>
              </>
            )}

            {/* Key Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Daily Operations */}
              <div className="bg-gradient-to-br from-[#2E86FF]/20 to-[#0066FF]/10 rounded-xl p-5 ring-1 ring-[#2E86FF]/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold text-white">📊 Günlük Operasyon Hedefi</div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[#A7B8D8]">Önceki Sistem</span>
                      <span className="text-lg font-bold text-white/60 line-through">800</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[#10B981]">AI Hedef</span>
                      <span className="text-2xl font-bold text-[#10B981]">550-600</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-[#10B981] to-[#2E86FF] rounded-full" style={{ width: '73%' }} />
                  </div>
                  <div className="text-xs text-[#10B981] font-bold">
                    ↓ %27 azalma - Bugün: 573 operasyon önerisi
                  </div>
                </div>
              </div>

              {/* Budget Savings */}
              <div className="bg-gradient-to-br from-[#10B981]/20 to-[#059669]/10 rounded-xl p-5 ring-1 ring-[#10B981]/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold text-white">💰 Bütçe Tasarrufu</div>
                </div>
                <div className="space-y-3">
                  <div className="text-4xl font-bold text-[#10B981]">18.3%</div>
                  <div className="text-xs text-[#A7B8D8]">
                    Bu ay: <span className="text-[#10B981] font-bold">₺1,847,000</span> tasarruf
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#A7B8D8]">CIT Maliyeti</span>
                      <span className="text-[#10B981]">↓ ₺980K</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#A7B8D8]">Stok-out Riski</span>
                      <span className="text-[#10B981]">↓ ₺520K</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#A7B8D8]">Overflow Maliyeti</span>
                      <span className="text-[#10B981]">↓ ₺347K</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Smart Predictions */}
              <div className="bg-gradient-to-br from-[#F2B705]/20 to-[#F59E0B]/10 rounded-xl p-5 ring-1 ring-[#F2B705]/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold text-white">🎯 Akıllı Tahminler</div>
                </div>
                <div className="space-y-2">
                  <div className="bg-[#0E2142]/60 rounded-lg p-3">
                    <div className="text-xs text-[#A7B8D8] mb-1">Para Toplama (24h)</div>
                    <div className="text-xl font-bold text-[#F2B705]">87 ATM</div>
                    <div className="text-xs text-white/60 mt-1">Kaset doluluk tahmini: %82-94</div>
                  </div>
                  <div className="bg-[#0E2142]/60 rounded-lg p-3">
                    <div className="text-xs text-[#A7B8D8] mb-1">İkmal (48h)</div>
                    <div className="text-xl font-bold text-[#2E86FF]">23 ATM</div>
                    <div className="text-xs text-white/60 mt-1">Kritik seviye tahmini</div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Recommendations */}
            <div className="bg-[#0E2142]/40 rounded-xl p-5 ring-1 ring-[#2B416B] transition-all duration-300 hover:ring-[#2E86FF]/50">
              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => setAutoSuggestionsExpanded(!autoSuggestionsExpanded)}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="text-xl">⚡</span>
                    <span>Otomatik Öneriler (Son 2 Saat)</span>
                  </div>
                  <div className="text-xs text-[#10B981] font-bold px-2 py-1 rounded-full bg-[#10B981]/20 animate-pulse">12 yeni öneri</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E86FF] to-[#1F6FE0] flex items-center justify-center shadow-lg group-hover:shadow-[#2E86FF]/50 transition-all duration-300 group-hover:scale-110">
                    <span className={`text-white text-2xl font-bold transition-transform duration-300 ${autoSuggestionsExpanded ? 'rotate-180' : 'rotate-0'}`}>
                      {autoSuggestionsExpanded ? "−" : "+"}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className={`overflow-hidden transition-all duration-500 ease-in-out ${autoSuggestionsExpanded ? 'max-h-[1000px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>

              {/* Tarih aralığı + Excel export */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={suggestionsDateStart}
                    onChange={(e) => setSuggestionsDateStart(e.target.value)}
                    max={suggestionsDateEnd}
                    className="px-2 py-1.5 text-xs rounded-lg bg-[#112544] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                  />
                  <span className="text-white/40 text-xs">—</span>
                  <input
                    type="date"
                    value={suggestionsDateEnd}
                    onChange={(e) => setSuggestionsDateEnd(e.target.value)}
                    min={suggestionsDateStart}
                    className="px-2 py-1.5 text-xs rounded-lg bg-[#112544] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                  />
                </div>
                <button
                  onClick={() => {
                    const start = new Date().toISOString().slice(0, 10);
                    const end   = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
                    setSuggestionsDateStart(start);
                    setSuggestionsDateEnd(end);
                  }}
                  className="px-2 py-1.5 text-xs rounded-lg bg-[#112544] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
                >
                  Bugün + 2 Gün
                </button>
                <button
                  onClick={() => {
                    const start = new Date().toISOString().slice(0, 10);
                    const end   = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
                    setSuggestionsDateStart(start);
                    setSuggestionsDateEnd(end);
                  }}
                  className="px-2 py-1.5 text-xs rounded-lg bg-[#112544] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
                >
                  7 Gün
                </button>
                <button
                  onClick={async () => {
                    const XLSX = await import('xlsx');
                    const filtered = allSuggestions.filter((r) => r.tarih >= suggestionsDateStart && r.tarih <= suggestionsDateEnd);
                    const rows = filtered.map((r) => ({
                      'Tarih'        : r.tarih,
                      'ATM ID'       : r.atmId,
                      'ATM Adı'      : r.atmName,
                      'Şehir'        : r.city,
                      'İlçe'         : r.district,
                      'İşlem Türü'   : r.type === 'collection' ? 'Para Toplama' : 'İkmal',
                      'Öncelik'      : r.priority === 'high' ? 'Yüksek' : r.priority === 'medium' ? 'Orta' : 'Düşük',
                      'Sebep'        : r.reason,
                      'ETA'          : r.eta,
                      'Güven %'      : r.confidence,
                    }));
                    const ws = XLSX.utils.json_to_sheet(rows);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Öneriler');
                    XLSX.writeFile(wb, `atm_oneriler_${suggestionsDateStart}_${suggestionsDateEnd}.xlsx`);
                  }}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#10B981]/20 hover:bg-[#10B981]/30 text-[#10B981] border border-[#10B981]/30 hover:border-[#10B981]/60 font-semibold transition"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Excel İndir
                </button>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {allSuggestions
                  .filter((r) => r.tarih >= suggestionsDateStart && r.tarih <= suggestionsDateEnd)
                  .map((rec) => (
                  <div key={rec.id} className="bg-[#112544]/60 rounded-lg p-4 ring-1 ring-[#2B416B] hover:ring-[#2E86FF] transition">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`text-2xl ${rec.type === 'collection' ? '💰' : '📦'}`}>
                          {rec.type === 'collection' ? '💰' : '📦'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{rec.atmId} - {rec.atmName}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              rec.priority === 'high' ? 'bg-[#F2B705]/20 text-[#F2B705]' : 
                              rec.priority === 'medium' ? 'bg-[#2E86FF]/20 text-[#2E86FF]' : 
                              'bg-[#10B981]/20 text-[#10B981]'
                            }`}>
                              {rec.priority === 'high' ? 'Yüksek' : rec.priority === 'medium' ? 'Orta' : 'Düşük'}
                            </span>
                          </div>
                          <div className="text-xs text-[#A7B8D8] mt-1">{rec.city} / {rec.district}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-[#A7B8D8]">ETA</div>
                        <div className="text-sm font-bold text-white">{rec.eta}</div>
                      </div>
                    </div>
                    <div className="text-xs text-white/70 mb-2">{rec.reason}</div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-[#10B981]">
                        Güven: <span className="font-bold">{rec.confidence}%</span>
                      </div>
                      <button className="px-3 py-1 rounded-lg bg-[#2E86FF]/90 hover:bg-[#2E86FF] text-xs font-bold text-white transition">
                        Rotaya Ekle
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Summary KPI strip */}
      <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="text-sm font-semibold text-white">📊 Özet Göstergeler</div>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={summaryDateStart}
                onChange={(e) => setSummaryDateStart(e.target.value)}
                max={summaryDateEnd}
                className="px-2 py-1 text-xs rounded-lg bg-[#112544] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
              />
              <span className="text-white/50 text-xs">-</span>
              <input
                type="date"
                value={summaryDateEnd}
                onChange={(e) => setSummaryDateEnd(e.target.value)}
                min={summaryDateStart}
                max="2026-02-28"
                className="px-2 py-1 text-xs rounded-lg bg-[#112544] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
              />
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setSummaryDateStart("2026-02-04");
                  setSummaryDateEnd("2026-02-11");
                }}
                className="px-2 py-1 text-xs rounded bg-[#112544] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
              >
                7 Gün
              </button>
              <button
                onClick={() => {
                  setSummaryDateStart("2026-02-04");
                  setSummaryDateEnd("2026-02-18");
                }}
                className="px-2 py-1 text-xs rounded bg-[#112544] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
              >
                14 Gün
              </button>
              <button
                onClick={() => {
                  setSummaryDateStart("2026-02-04");
                  setSummaryDateEnd("2026-03-06");
                }}
                className="px-2 py-1 text-xs rounded bg-[#112544] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
              >
                30 Gün
              </button>
            </div>
            <button
              onClick={() => {
                const formatDate = (dateStr: string) => {
                  const d = new Date(dateStr);
                  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
                };
                const dateRangeLabel = `${formatDate(summaryDateStart)} - ${formatDate(summaryDateEnd)}`;
                const daysDiff = Math.floor((new Date(summaryDateEnd).getTime() - new Date(summaryDateStart).getTime()) / (1000 * 60 * 60 * 24));
                
                // Create CSV content
                let csvContent = `Özet Göstergeler Raporu\nTarih Aralığı: ${dateRangeLabel}\nRapor Süresi: ${daysDiff + 1} Gün\n\n`;
                csvContent += "Metrik,Değer\n";
                csvContent += `Toplam ATM Sayısı,${data ? data.summary.atms_tracked : 0}\n`;
                csvContent += `Toplam Nakit (₺),${data ? data.summary.total_cash_try : 0}\n`;
                csvContent += `Düşük Nakit ATM,${data ? data.summary.low_cash_atms : 0}\n`;
                csvContent += `Tahmini Kıtlık (${daysDiff + 1} Gün),${data ? data.summary.predicted_shortage_7d : 0}\n`;
                csvContent += `Planlı İkmal (${daysDiff + 1} Gün),${data ? data.summary.replenishments_planned_7d : 0}\n`;
                
                // Create and download file
                const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                const fileName = `Ozet_Gostergeler_${summaryDateStart}_${summaryDateEnd}.csv`;
                link.setAttribute("download", fileName);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="px-3 py-1 text-xs rounded-lg font-semibold bg-[#10B981] text-white hover:bg-[#10B981]/80 transition flex items-center gap-1"
            >
              <span>📊</span> Excel İndir
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
          <Card label="ATMs Tracked" value={data ? data.summary.atms_tracked.toLocaleString("tr-TR") : "…"} infoKey="atms_tracked" onInfoClick={setInfoModal} />
          <Card label="Total Cash (TRY)" value={data ? `₺${data.summary.total_cash_try.toLocaleString("tr-TR")}` : "…"} infoKey="total_cash" onInfoClick={setInfoModal} />
          <div onClick={() => setShowModal(true)} className="cursor-pointer hover:ring-2 hover:ring-[#2E86FF] transition rounded-2xl">
            <Card label="Low Cash ATMs" value={data ? data.summary.low_cash_atms.toString() : "…"} infoKey="low_cash_atms" onInfoClick={setInfoModal} />
          </div>
          <div onClick={() => setShowShortageModal(true)} className="cursor-pointer hover:ring-2 hover:ring-[#2E86FF] transition rounded-2xl">
            <Card label="Pred. Shortage (7d)" value={data ? data.summary.predicted_shortage_7d.toString() : "…"} infoKey="predicted_shortage" onInfoClick={setInfoModal} />
          </div>
          <div onClick={() => setShowReplModal(true)} className="cursor-pointer hover:ring-2 hover:ring-[#2E86FF] transition rounded-2xl">
            <Card label="Planned Repl. (7d)" value={data ? data.summary.replenishments_planned_7d.toString() : "…"} infoKey="planned_replenishments" onInfoClick={setInfoModal} />
          </div>
        </div>
      </div>

      {/* Heat Map */}
      {!fullscreenHeatMap && (
        <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="text-sm">
                {heatMapView === "low_cash" ? "🔴 Düşük Nakit ATM Isı Haritası (İkmal Gerekli)" : "🟢 Yüksek Nakit ATM Isı Haritası (Para Toplama)"}
              </div>
              <button
                onClick={() => setInfoModal(CASHFLOW_METRIC_EXPLANATIONS["heat_map"])}
                className="w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition"
              >
                ?
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div className="flex items-center gap-1 bg-[#0E2142] rounded-lg p-1">
                <button
                  onClick={() => setHeatMapView("low_cash")}
                  className={`px-3 py-1 rounded text-xs font-semibold transition ${
                    heatMapView === "low_cash"
                      ? "bg-[#EF4444] text-white"
                      : "bg-transparent text-[#A7B8D8] hover:text-white"
                  }`}
                >
                  🔴 İkmal
                </button>
                <button
                  onClick={() => setHeatMapView("high_cash")}
                  className={`px-3 py-1 rounded text-xs font-semibold transition ${
                    heatMapView === "high_cash"
                      ? "bg-[#10B981] text-white"
                      : "bg-transparent text-[#A7B8D8] hover:text-white"
                  }`}
                >
                  🟢 Para Toplama
                </button>
              </div>

              <div className="flex items-center gap-2 bg-[#0E2142] rounded-lg px-2 py-1">
                <span className="text-[10px] text-[#A7B8D8]">Başlangıç:</span>
                <input
                  type="date"
                  value={heatMapStartDate}
                  onChange={(e) => setHeatMapStartDate(e.target.value)}
                  className="bg-transparent text-white text-[10px] border-none focus:outline-none w-24"
                />
              </div>
              <div className="flex items-center gap-2 bg-[#0E2142] rounded-lg px-2 py-1">
                <span className="text-[10px] text-[#A7B8D8]">Bitiş:</span>
                <input
                  type="date"
                  value={heatMapEndDate}
                  onChange={(e) => setHeatMapEndDate(e.target.value)}
                  className="bg-transparent text-white text-[10px] border-none focus:outline-none w-24"
                />
              </div>
              <button
                onClick={() => {
                  const atmData = heatMapView === "low_cash" ? lowCashAtms : highCashAtms;
                  const viewLabel = heatMapView === "low_cash" ? "Düşük Nakit" : "Yüksek Nakit";
                  const riskLabels = heatMapView === "low_cash" 
                    ? { critical: "Kritik (< 20%)", low: "Düşük (20-30%)", normal: "Normal (> 30%)" }
                    : { critical: "Kritik (≥90%) — ATM Yatırmaya Kapandı", high: "Yüksek (85-90%) — Toplama Planla", normal: "Normal (<85%)" };
                  
                  const csvContent = '\uFEFF' + viewLabel + ' ATM Haritası Raporu\n' +
                    'Rapor Tarihi: ' + new Date().toLocaleDateString('tr-TR') + '\n' +
                    'Tarih Aralığı: ' + heatMapStartDate + ' - ' + heatMapEndDate + '\n\n' +
                    'ATM ID,ATM Adı,Şehir,İlçe,Nakit Seviyesi (%),Risk Durumu,Latitude,Longitude\n' +
                    atmData.map(atm => {
                      const riskLevel = heatMapView === "low_cash"
                        ? (atm.cash_level < 20 ? 'Kritik' : atm.cash_level < 30 ? 'Düşük' : 'Normal')
                        : (atm.cash_level > 95 ? 'Kritik' : atm.cash_level > 90 ? 'Yüksek' : 'Normal');
                      return `${atm.atm_id},${atm.atm_name},${atm.city},${atm.district},${atm.cash_level}%,${riskLevel},${atm.latitude},${atm.longitude}`;
                    }).join('\n') +
                    '\n\nRisk Seviyesi Tanımları:\n' +
                    (heatMapView === "low_cash"
                      ? 'Kritik,< 20%,Acil ikmal gerekli - CIT planlanmalı\nDüşük,20-30%,Yakın takip - İkmal planına alınmalı\nNormal,> 30%,Stabil durum - Normal izleme'
                      : 'Kritik,≥90%,ATM yatırmaya kapandı — acil para toplama\nYüksek,85-90%,All-in kaset %85+ dolu — para toplama planlanmalı\nNormal,<85%,Stabil durum') +
                    '\n\nÖzet İstatistikler:\n' +
                    'Toplam ' + viewLabel + ' ATM,' + atmData.length + '\n' +
                    (heatMapView === "low_cash"
                      ? 'Kritik Risk,' + atmData.filter(a => a.cash_level < 20).length + '\nDüşük Risk,' + atmData.filter(a => a.cash_level >= 20 && a.cash_level < 30).length + '\nNormal,' + atmData.filter(a => a.cash_level >= 30).length
                      : 'Kritik (≥90%),' + atmData.filter(a => a.cash_level >= 90).length + '\nYüksek (85-90%),' + atmData.filter(a => a.cash_level >= 85 && a.cash_level < 90).length + '\nNormal (<85%),' + atmData.filter(a => a.cash_level < 85).length) +
                    '\n\nŞehir Bazlı Dağılım:\n' +
                    [...new Set(atmData.map(a => a.city))].map(city => {
                      const cityAtms = atmData.filter(a => a.city === city);
                      return city + ',' + cityAtms.length + ' ATM';
                    }).join('\n') +
                    '\n\nRapor Oluşturan: AI Cash Optimization Engine\n' +
                    'Sistem: IronClad Cash Flow Manager';
                  
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = `${heatMapView}_heat_map_${new Date().toISOString().split('T')[0]}.csv`;
                  link.click();
                }}
                className="px-2 py-1 bg-[#2E86FF] hover:bg-[#1F6FE0] text-white text-[10px] font-semibold rounded-lg transition flex items-center gap-1"
              >
                📊 Excel
              </button>
              <button
                onClick={() => setFullscreenHeatMap(true)}
                className="px-2 py-1 bg-[#10B981] hover:bg-[#059669] text-white text-[10px] font-semibold rounded-lg transition flex items-center gap-1"
              >
                🔍 Tam Ekran
              </button>
            </div>
          </div>
          
          {/* ATM Sayısı Göstergesi */}
          <div className="mb-2 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 bg-[#0E2142] rounded-lg px-3 py-1.5">
              <span className="text-[#A7B8D8]">Toplam ATM:</span>
              <span className="text-white font-bold">
                {heatMapView === "low_cash" ? lowCashAtms.length : highCashAtms.length}
              </span>
            </div>
            {heatMapView === "low_cash" ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#EF4444] rounded-full"></div>
                  <span className="text-[#EF4444]">Kritik (&lt; 20%): {lowCashAtms.filter(a => a.cash_level < 20).length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#F59E0B] rounded-full"></div>
                  <span className="text-[#F59E0B]">Düşük (20-30%): {lowCashAtms.filter(a => a.cash_level >= 20 && a.cash_level < 30).length}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#EF4444] rounded-full"></div>
                  <span className="text-[#EF4444]">Kritik (&gt; 95%): {highCashAtms.filter(a => a.cash_level > 95).length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#F59E0B] rounded-full"></div>
                  <span className="text-[#F59E0B]">Yüksek (90-95%): {highCashAtms.filter(a => a.cash_level >= 90 && a.cash_level <= 95).length}</span>
                </div>
              </>
            )}
          </div>
          
          <div className="h-[360px] w-full rounded-xl overflow-hidden ring-1 ring-[#2B416B]">
            <HeatMapComponent 
              lowCashAtms={heatMapView === "low_cash" ? lowCashAtms : highCashAtms}
              isHighCash={heatMapView === "high_cash"}
            />
          </div>
        </div>
      )}

      {/* SLA Exceeded ATMs Alert - Moved from Operational Summary */}
      <div 
        onClick={() => setShowSlaExceededModal(true)}
        className="bg-gradient-to-r from-[#E63946]/10 to-[#8B5CF6]/10 rounded-xl p-4 ring-1 ring-[#8B5CF6]/50 cursor-pointer hover:ring-[#8B5CF6] transition mb-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">⚠️</div>
            <div>
              <div className="text-sm font-semibold text-white">SLA Süresi Aşan ATM'ler</div>
              <div className="text-xs text-white/60 mt-1">Acil müdahale gerekli - Tıklayarak detayları görüntüleyin</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-[#E63946]">
              {slaExceededAtms.length}
            </div>
            <div className="text-xs text-[#A7B8D8] mt-1">ATM</div>
          </div>
        </div>
      </div>

      {/* CIT Route Optimization */}
      <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="text-sm font-semibold">🚚 CIT Route Optimization</div>

          {/* NM Tab Bar */}
          <div className="flex items-center gap-1 flex-wrap">
            {/* Tüm NM'ler tab */}
            <button
              onClick={() => setSelectedCashCenter("")}
              className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition ring-1 flex items-center gap-1 ${
                selectedCashCenter === ""
                  ? "bg-[#2E86FF] text-white ring-[#2E86FF]"
                  : "bg-[#0E2142] text-[#A7B8D8] ring-[#2B416B] hover:ring-[#2E86FF] hover:text-white"
              }`}
            >
              🏦 Tüm NM&apos;ler
              {selectedNmTabs.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  selectedCashCenter === "" ? "bg-white/20 text-white" : "bg-[#2E86FF]/20 text-[#2E86FF]"
                }`}>
                  {selectedNmTabs.length}
                </span>
              )}
            </button>

            {/* Individual NM tabs */}
            {selectedNmTabs.map((nm) => {
              const isActive = selectedCashCenter === nm;
              const nmRoutes = citRoutes.filter(r => r.cash_center === nm);
              const completedCount = nmRoutes.filter(r => r.status === "completed" || r.progress === 100).length;
              const rate = nmRoutes.length > 0 ? Math.round(completedCount / nmRoutes.length * 100) : 0;
              return (
                <div key={nm} className="relative group/tab flex items-center">
                  <button
                    onClick={() => setSelectedCashCenter(nm)}
                    className={`pl-3 pr-8 py-1.5 text-xs rounded-lg font-semibold transition ring-1 flex items-center gap-1.5 max-w-[160px] ${
                      isActive
                        ? "bg-[#2E86FF] text-white ring-[#2E86FF]"
                        : "bg-[#0E2142] text-[#A7B8D8] ring-[#2B416B] hover:ring-[#2E86FF] hover:text-white"
                    }`}
                  >
                    <span className="truncate">{nm}</span>
                    {nmRoutes.length > 0 && (
                      <span className={`shrink-0 px-1 py-0.5 rounded text-[10px] font-bold ${
                        isActive
                          ? "bg-white/20 text-white"
                          : rate >= 80
                          ? "bg-[#10B981]/20 text-[#10B981]"
                          : "bg-[#F2B705]/20 text-[#F2B705]"
                      }`}>
                        {rate}%
                      </span>
                    )}
                  </button>
                  {/* Close button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNmTabs(prev => prev.filter(t => t !== nm));
                      if (selectedCashCenter === nm) setSelectedCashCenter("");
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover/tab:opacity-100 transition bg-black/30 hover:bg-[#E63946] text-white"
                    title="Kaldır"
                  >
                    ×
                  </button>
                </div>
              );
            })}

            {/* Add NM button */}
            <button
              onClick={() => setShowCashCenterSearch(true)}
              className="px-2.5 py-1.5 text-xs rounded-lg font-semibold bg-[#0E2142] text-[#2E86FF] ring-1 ring-[#2E86FF]/50 hover:bg-[#2E86FF]/20 transition flex items-center gap-1"
              title="NM Ekle / Çıkar"
            >
              <span className="text-sm leading-none">+</span> NM Ekle
            </button>
          </div>
        </div>

        {/* Selected NM Stats */}
        {selectedCashCenter && (() => {
          const nmRoutes = citRoutes.filter(r => r.cash_center === selectedCashCenter);
          const completedRoutes = nmRoutes.filter(r => r.status === "completed" || r.progress === 100);
          const remainingRoutes = nmRoutes.filter(r => r.status !== "completed" && r.progress !== 100);
          const completionRate = nmRoutes.length > 0 ? (completedRoutes.length / nmRoutes.length * 100) : 0;
          
          return (
            <div className="bg-gradient-to-r from-[#2E86FF]/20 to-[#10B981]/20 rounded-xl p-5 ring-1 ring-[#2E86FF]/50 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🏦</div>
                  <div>
                    <div className="text-sm text-[#A7B8D8]">Seçili Nakit Merkezi</div>
                    <div className="text-lg font-bold text-white">{selectedCashCenter}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-[#A7B8D8]">Tamamlanma</div>
                  <div className="text-3xl font-bold text-[#10B981]">{completionRate.toFixed(0)}%</div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="bg-[#0E2142]/40 rounded-lg p-3">
                  <div className="text-xs text-[#A7B8D8] mb-1">Toplam İş</div>
                  <div className="text-2xl font-bold text-white">{nmRoutes.length}</div>
                </div>
                <div className="bg-[#10B981]/10 rounded-lg p-3 ring-1 ring-[#10B981]/30">
                  <div className="text-xs text-[#10B981] mb-1">✓ Biten</div>
                  <div className="text-2xl font-bold text-[#10B981]">{completedRoutes.length}</div>
                </div>
                <div 
                  onClick={() => {
                    setRemainingRoutesData(remainingRoutes);
                    setShowRemainingRoutesModal(true);
                  }}
                  className="bg-[#F2B705]/10 rounded-lg p-3 ring-1 ring-[#F2B705]/30 cursor-pointer hover:bg-[#F2B705]/20 hover:ring-[#F2B705]/50 transition"
                >
                  <div className="text-xs text-[#F2B705] mb-1">⏳ Kalan</div>
                  <div className="text-2xl font-bold text-[#F2B705]">{remainingRoutes.length}</div>
                </div>
              </div>
              
              <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                <div 
                  className="h-2 bg-gradient-to-r from-[#10B981] to-[#2E86FF] rounded-full transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>
          );
        })()}

        {/* Executive Summary Dashboard */}
        <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B] mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm font-semibold text-white">📊 Operasyonel Özet</div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={operationDateStart}
                  onChange={(e) => setOperationDateStart(e.target.value)}
                  max={operationDateEnd}
                  className="px-2 py-1 text-xs rounded-lg bg-[#112544] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                />
                <span className="text-white/50 text-xs">-</span>
                <input
                  type="date"
                  value={operationDateEnd}
                  onChange={(e) => setOperationDateEnd(e.target.value)}
                  min={operationDateStart}
                  max="2026-02-28"
                  className="px-2 py-1 text-xs rounded-lg bg-[#112544] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setOperationDateStart("2026-02-04");
                    setOperationDateEnd("2026-02-04");
                  }}
                  className="px-2 py-1 text-xs rounded bg-[#112544] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
                >
                  Bugün
                </button>
                <button
                  onClick={() => {
                    setOperationDateStart("2026-02-01");
                    setOperationDateEnd("2026-02-04");
                  }}
                  className="px-2 py-1 text-xs rounded bg-[#112544] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
                >
                  Bu Hafta
                </button>
                <button
                  onClick={() => {
                    setOperationDateStart("2026-02-01");
                    setOperationDateEnd("2026-02-28");
                  }}
                  className="px-2 py-1 text-xs rounded bg-[#112544] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
                >
                  Bu Ay
                </button>
              </div>
              <button
                onClick={() => {
                  const formatDate = (dateStr: string) => {
                    const d = new Date(dateStr);
                    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
                  };
                  const dateRangeLabel = `${formatDate(operationDateStart)} - ${formatDate(operationDateEnd)}`;
                  const daysDiff = Math.floor((new Date(operationDateEnd).getTime() - new Date(operationDateStart).getTime()) / (1000 * 60 * 60 * 24));
                  
                  // Seçili merkeze göre filtreleme
                  const baseRoutes = selectedCashCenter ? citRoutes.filter(r => r.cash_center === selectedCashCenter) : citRoutes;
                  const dateFilteredRoutes = baseRoutes.filter(r => {
                    const routeDate = r.day === "today" ? "2026-02-04" : 
                                     r.day === "tomorrow" ? "2026-02-05" : "2026-02-06";
                    return routeDate >= operationDateStart && routeDate <= operationDateEnd;
                  });
                  
                  const replenishmentAtms = dateFilteredRoutes.reduce((sum, r) => sum + r.atms.filter((a: any) => a.operation === "ikmal").length, 0);
                  const collectionAtms = dateFilteredRoutes.reduce((sum, r) => sum + r.atms.filter((a: any) => a.operation === "toplama").length, 0);
                  const replenishmentRoutes = dateFilteredRoutes.filter(r => r.operation_type === "replenishment").length;
                  const collectionRoutes = dateFilteredRoutes.filter(r => r.operation_type === "collection").length;
                  const avgEfficiency = dateFilteredRoutes.length > 0 ? (dateFilteredRoutes.reduce((sum, r) => sum + r.efficiency_score, 0) / dateFilteredRoutes.length).toFixed(1) : "0";
                  
                  // Create CSV content
                  let csvContent = `Operasyonel Özet Raporu${selectedCashCenter ? `\nNakit Merkezi: ${selectedCashCenter}` : ''}\nTarih Aralığı: ${dateRangeLabel}\nRapor Süresi: ${daysDiff + 1} Gün\n\n`;
                  csvContent += "Metrik,Değer\n";
                  csvContent += `Aktif Rota Sayısı,${dateFilteredRoutes.length}\n`;
                  csvContent += `SLA Süresi Aşan ATM,${slaExceededAtms.length}\n`;
                  csvContent += `İkmal Operasyonu ATM,${replenishmentAtms}\n`;
                  csvContent += `İkmal Rota Sayısı,${replenishmentRoutes}\n`;
                  csvContent += `Para Toplama ATM,${collectionAtms}\n`;
                  csvContent += `Para Toplama Rota Sayısı,${collectionRoutes}\n`;
                  csvContent += `Ortalama SLA Uyum Oranı,${avgEfficiency}%\n`;
                  
                  // Create and download file
                  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement("a");
                  const url = URL.createObjectURL(blob);
                  link.setAttribute("href", url);
                  const fileName = `Operasyonel_Ozet_${operationDateStart}_${operationDateEnd}.csv`;
                  link.setAttribute("download", fileName);
                  link.style.visibility = 'hidden';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-3 py-1 text-xs rounded-lg font-semibold bg-[#10B981] text-white hover:bg-[#10B981]/80 transition flex items-center gap-1"
              >
                <span>📊</span> Excel İndir
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 mb-6">
          <div 
            onClick={() => {
              // İkmal operasyonu yapılan tüm ATM'leri topla
              const replenishmentAtmList = filteredRoutes.filter(r => {
                const routeDate = r.day === "today" ? "2026-02-04" : r.day === "tomorrow" ? "2026-02-05" : "2026-02-06";
                return routeDate >= operationDateStart && routeDate <= operationDateEnd;
              }).flatMap(r => r.atms.filter((a: any) => a.operation === "ikmal"));
              
              setOperationAtms(replenishmentAtmList);
              setSelectedOperationType("replenishment");
              setShowOperationMapModal(true);
            }}
            className="bg-[#0E2142]/60 rounded-xl p-5 ring-1 ring-[#2B416B] cursor-pointer hover:ring-[#10B981] transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-sm text-[#A7B8D8]">İkmal Operasyonu</div>
              <div className="text-2xl">💵</div>
            </div>
            <div className="text-3xl font-bold text-[#10B981] mb-1">
              {filteredRoutes.filter(r => {
                const routeDate = r.day === "today" ? "2026-02-04" : r.day === "tomorrow" ? "2026-02-05" : "2026-02-06";
                return routeDate >= operationDateStart && routeDate <= operationDateEnd;
              }).reduce((sum, r) => sum + r.atms.filter((a: any) => a.operation === "ikmal").length, 0)}
            </div>
            <div className="text-xs text-white/60">
              {filteredRoutes.filter(r => {
                const routeDate = r.day === "today" ? "2026-02-04" : r.day === "tomorrow" ? "2026-02-05" : "2026-02-06";
                return routeDate >= operationDateStart && routeDate <= operationDateEnd && r.operation_type === "replenishment";
              }).length} rota
            </div>
          </div>

          <div 
            onClick={() => {
              // Para toplama operasyonu yapılan tüm ATM'leri topla
              const collectionAtmList = filteredRoutes.filter(r => {
                const routeDate = r.day === "today" ? "2026-02-04" : r.day === "tomorrow" ? "2026-02-05" : "2026-02-06";
                return routeDate >= operationDateStart && routeDate <= operationDateEnd;
              }).flatMap(r => r.atms.filter((a: any) => a.operation === "toplama"));
              
              setOperationAtms(collectionAtmList);
              setSelectedOperationType("collection");
              setShowOperationMapModal(true);
            }}
            className="bg-[#0E2142]/60 rounded-xl p-5 ring-1 ring-[#2B416B] cursor-pointer hover:ring-[#F2B705] transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-sm text-[#A7B8D8]">Para Toplama</div>
              <div className="text-2xl">🚛</div>
            </div>
            <div className="text-3xl font-bold text-[#F2B705] mb-1">
              {filteredRoutes.filter(r => {
                const routeDate = r.day === "today" ? "2026-02-04" : r.day === "tomorrow" ? "2026-02-05" : "2026-02-06";
                return routeDate >= operationDateStart && routeDate <= operationDateEnd;
              }).reduce((sum, r) => sum + r.atms.filter((a: any) => a.operation === "toplama").length, 0)}
            </div>
            <div className="text-xs text-white/60">
              {filteredRoutes.filter(r => {
                const routeDate = r.day === "today" ? "2026-02-04" : r.day === "tomorrow" ? "2026-02-05" : "2026-02-06";
                return routeDate >= operationDateStart && routeDate <= operationDateEnd && r.operation_type === "collection";
              }).length} rota
            </div>
          </div>
        </div>

        {/* SLA Uyum Oranı - Separate full-width card */}
        <div className="bg-[#0E2142]/60 rounded-xl p-5 ring-1 ring-[#2B416B] mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">⏱️</div>
              <div>
                <div className="text-sm text-[#A7B8D8]">SLA Uyum Oranı</div>
                <div className="text-xs text-white/60 mt-1">Ortalama verimlilik puanı</div>
              </div>
            </div>
            <div className="text-4xl font-bold text-[#10B981]">
              {filteredRoutes.length > 0 ? (filteredRoutes.reduce((sum, r) => sum + r.efficiency_score, 0) / filteredRoutes.length).toFixed(0) : 0}%
            </div>
          </div>
        </div>

        {/* Operational Stats */}
        <div className="bg-[#0E2142]/60 rounded-xl p-5 ring-1 ring-[#2B416B] mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold text-white">📊 Operasyon Dağılımı</div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pie chart representation with bars */}
            <div>
              <div className="text-xs text-[#A7B8D8] mb-2">Operasyon Tipi</div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#10B981]">İkmal</span>
                    <span className="text-white font-semibold">{filteredRoutes.filter(r => r.operation_type === "replenishment").length}</span>
                  </div>
                  <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                    <div 
                      className="h-2 bg-[#10B981] rounded-full"
                      style={{ width: `${filteredRoutes.length > 0 ? (filteredRoutes.filter(r => r.operation_type === "replenishment").length / filteredRoutes.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#F2B705]">Para Toplama</span>
                    <span className="text-white font-semibold">{filteredRoutes.filter(r => r.operation_type === "collection").length}</span>
                  </div>
                  <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                    <div 
                      className="h-2 bg-[#F2B705] rounded-full"
                      style={{ width: `${filteredRoutes.length > 0 ? (filteredRoutes.filter(r => r.operation_type === "collection").length / filteredRoutes.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#2E86FF]">Karma</span>
                    <span className="text-white font-semibold">{filteredRoutes.filter(r => r.operation_type === "mixed").length}</span>
                  </div>
                  <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                    <div 
                      className="h-2 bg-[#2E86FF] rounded-full"
                      style={{ width: `${filteredRoutes.length > 0 ? (filteredRoutes.filter(r => r.operation_type === "mixed").length / filteredRoutes.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-[#A7B8D8] mb-2">Rota Durumu</div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#E63946]">Devam Ediyor</span>
                    <span className="text-white font-semibold">{filteredRoutes.filter(r => r.status === "in-progress").length}</span>
                  </div>
                  <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                    <div 
                      className="h-2 bg-[#E63946] rounded-full"
                      style={{ width: `${filteredRoutes.length > 0 ? (filteredRoutes.filter(r => r.status === "in-progress").length / filteredRoutes.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#10B981]">Planlı</span>
                    <span className="text-white font-semibold">
                      {filteredRoutes.reduce((sum, r) => sum + r.atms.filter((a: any) => a.planned).length, 0)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                    <div 
                      className="h-2 bg-[#10B981] rounded-full"
                      style={{ 
                        width: `${filteredRoutes.reduce((sum, r) => sum + r.atms.length, 0) > 0 ? (filteredRoutes.reduce((sum, r) => sum + r.atms.filter((a: any) => a.planned).length, 0) / 
                                  filteredRoutes.reduce((sum, r) => sum + r.atms.length, 0)) * 100 : 0}%` 
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#F2B705]">Plansız</span>
                    <span className="text-white font-semibold">
                      {filteredRoutes.reduce((sum, r) => sum + r.atms.filter((a: any) => !a.planned).length, 0)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                    <div 
                      className="h-2 bg-[#F2B705] rounded-full"
                      style={{ 
                        width: `${filteredRoutes.reduce((sum, r) => sum + r.atms.length, 0) > 0 ? (filteredRoutes.reduce((sum, r) => sum + r.atms.filter((a: any) => !a.planned).length, 0) / 
                                  filteredRoutes.reduce((sum, r) => sum + r.atms.length, 0)) * 100 : 0}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-[#A7B8D8] mb-2">Toplam İstatistikler</div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">Toplam ATM</span>
                  <span className="text-sm font-bold text-white">
                    {filteredRoutes.reduce((sum, r) => sum + r.atms_count, 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">Toplam Mesafe</span>
                  <span className="text-sm font-bold text-white">
                    {filteredRoutes.reduce((sum, r) => sum + parseInt(r.distance), 0).toLocaleString()} km
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">Avg. Verimlilik</span>
                  <span className="text-sm font-bold text-[#10B981]">
                    {filteredRoutes.length > 0 ? (filteredRoutes.reduce((sum, r) => sum + r.efficiency_score, 0) / filteredRoutes.length).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="text-sm font-semibold text-white">📋 Rota Detayları</div>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={routeDateStart}
                onChange={(e) => setRouteDateStart(e.target.value)}
                max={routeDateEnd}
                className="px-2 py-1 text-xs rounded-lg bg-[#112544] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
              />
              <span className="text-white/50 text-xs">-</span>
              <input
                type="date"
                value={routeDateEnd}
                onChange={(e) => setRouteDateEnd(e.target.value)}
                min={routeDateStart}
                max="2026-02-28"
                className="px-2 py-1 text-xs rounded-lg bg-[#112544] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
              />
            </div>
            <div className="flex gap-1">
              <button 
                onClick={() => {
                  setRouteDateStart("2026-02-04");
                  setRouteDateEnd("2026-02-04");
                }}
                className="px-3 py-1 text-xs rounded-lg font-semibold bg-[#0E2142] text-[#A7B8D8] hover:bg-[#2E86FF] hover:text-white transition"
              >
                Bugün
              </button>
              <button 
                onClick={() => {
                  setRouteDateStart("2026-02-04");
                  setRouteDateEnd("2026-02-06");
                }}
                className="px-3 py-1 text-xs rounded-lg font-semibold bg-[#0E2142] text-[#A7B8D8] hover:bg-[#2E86FF] hover:text-white transition"
              >
                3 Gün
              </button>
              <button 
                onClick={() => {
                  setRouteDateStart("2026-02-04");
                  setRouteDateEnd("2026-02-10");
                }}
                className="px-3 py-1 text-xs rounded-lg font-semibold bg-[#0E2142] text-[#A7B8D8] hover:bg-[#2E86FF] hover:text-white transition"
              >
                Bu Hafta
              </button>
              <button 
                onClick={() => {
                  setRouteDateStart("2026-02-04");
                  setRouteDateEnd("2026-02-28");
                }}
                className="px-3 py-1 text-xs rounded-lg font-semibold bg-[#0E2142] text-[#A7B8D8] hover:bg-[#2E86FF] hover:text-white transition"
              >
                Bu Ay
            </button>
            </div>
            <button
              onClick={() => {
                const formatDate = (dateStr: string) => {
                  const d = new Date(dateStr);
                  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
                };
                const dateRangeLabel = `${formatDate(routeDateStart)} - ${formatDate(routeDateEnd)}`;
                const daysDiff = Math.floor((new Date(routeDateEnd).getTime() - new Date(routeDateStart).getTime()) / (1000 * 60 * 60 * 24));
                
                // Seçili merkeze göre filtreleme
                const baseRoutes = selectedCashCenter ? citRoutes.filter(r => r.cash_center === selectedCashCenter) : citRoutes;
                const dateFilteredRoutes = baseRoutes.filter(r => {
                  const routeDate = r.day === "today" ? "2026-02-04" : 
                                   r.day === "tomorrow" ? "2026-02-05" : "2026-02-06";
                  return routeDate >= routeDateStart && routeDate <= routeDateEnd;
                });
                
                // Create CSV content
                let csvContent = `CIT Rota Detayları Raporu${selectedCashCenter ? `\nNakit Merkezi: ${selectedCashCenter}` : ''}\nTarih Aralığı: ${dateRangeLabel}\nRapor Süresi: ${daysDiff + 1} Gün\nToplam Rota: ${dateFilteredRoutes.length}\n\n`;
                csvContent += "Rota ID,NM Merkezi,Tarih,CIT Şirketi,Ekip,Araç,Operasyon Tipi,Durum,Toplam ATM,Tamamlanan,Verimlilik %,Tahmini Süre,Toplam Nakit\n";
                
                dateFilteredRoutes.forEach((route) => {
                  const dateLabel = route.day === "today" ? "4 Şubat" : route.day === "tomorrow" ? "5 Şubat" : route.planned_date || "6+ Şubat";
                  const statusLabel = route.status === "in-progress" ? "Devam Ediyor" : "Planlandı";
                  
                  csvContent += `${route.id},"${route.cash_center}",${dateLabel},${route.cit_company},${route.team},${route.vehicle},${route.operation_type === "replenishment" ? "İkmal" : route.operation_type === "collection" ? "Toplama" : "Karma"},${statusLabel},${route.atms_count},${route.completed},${route.efficiency_score},${route.estimated_time},"${route.total_cash}"\n`;
                });
                
                // Create and download file
                const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                const fileName = `CIT_Rota_Raporu_${routeDateStart}_${routeDateEnd}.csv`;
                link.setAttribute("download", fileName);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="px-3 py-1 text-xs rounded-lg font-semibold bg-[#10B981] text-white hover:bg-[#10B981]/80 transition flex items-center gap-1"
            >
              <span>📊</span> Excel İndir
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {filteredRoutes.filter(r => {
            const routeDate = r.day === "today" ? "2026-02-04" :
                             r.day === "tomorrow" ? "2026-02-05" : "2026-02-06";
            return routeDate >= routeDateStart && routeDate <= routeDateEnd;
          }).map((route) => {
            const isOpen = expandedRoutes.has(route.id);
            const toggleOpen = (e: React.MouseEvent) => {
              e.stopPropagation();
              setExpandedRoutes(prev => {
                const next = new Set(prev);
                isOpen ? next.delete(route.id) : next.add(route.id);
                return next;
              });
              setSelectedRoute(route);
            };
            const dateLabel = route.day === "today" ? "Bugün" : route.day === "tomorrow" ? "Yarın" : route.planned_date || "Sonraki";
            return (
              <div
                key={route.id}
                className={`bg-[#0E2142]/60 rounded-xl ring-1 transition overflow-hidden ${
                  selectedRoute?.id === route.id
                    ? "ring-2 ring-[#2E86FF]"
                    : "ring-[#2B416B] hover:ring-[#2E86FF]/60"
                }`}
              >
                {/* ── Always-visible header row ── */}
                <div
                  onClick={toggleOpen}
                  className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                    {/* Chevron */}
                    <span className={`text-[#A7B8D8] transition-transform duration-200 text-sm ${isOpen ? "rotate-90" : ""}`}>▶</span>
                    <span className="font-semibold text-sm truncate">🏦 {route.cash_center}</span>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      route.operation_type === "replenishment" ? "bg-[#10B981]/20 text-[#10B981]" :
                      route.operation_type === "collection" ? "bg-[#F2B705]/20 text-[#F2B705]" :
                      "bg-[#2E86FF]/20 text-[#2E86FF]"
                    }`}>
                      {route.operation_type === "replenishment" ? "İkmal" :
                       route.operation_type === "collection" ? "Para Toplama" : "Karma"}
                    </span>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      route.status === "in-progress" ? "bg-[#E63946]/20 text-[#E63946]" :
                      "bg-[#A7B8D8]/20 text-[#A7B8D8]"
                    }`}>
                      {route.status === "in-progress" ? "🔴 Devam" : "📅 Planlı"}
                    </span>
                    <span className="shrink-0 text-xs text-white/40">{dateLabel}</span>
                  </div>
                  {/* Compact stats */}
                  <div className="flex items-center gap-4 shrink-0 ml-2">
                    <div className="hidden sm:flex items-center gap-3 text-xs text-[#A7B8D8]">
                      <span>🚗 {route.atms_count} ATM</span>
                      <span>⏱ {route.estimated_time}</span>
                      <span className="text-[#10B981] font-bold">{route.efficiency_score}%</span>
                    </div>
                    {/* In-progress mini bar */}
                    {route.status === "in-progress" && (
                      <div className="hidden md:flex items-center gap-1">
                        <div className="w-16 h-1.5 bg-[#112544] rounded-full overflow-hidden">
                          <div
                            className="h-1.5 bg-gradient-to-r from-[#2E86FF] to-[#10B981] rounded-full"
                            style={{ width: `${route.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-[#A7B8D8]">{route.progress}%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Collapsible detail body ── */}
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-[#2B416B]/50">
                    <div className="pt-3">
                      {/* Sub-info */}
                      <div className="text-sm text-[#A7B8D8] mb-3">
                        🏢 {route.cit_company} • {route.team} • {route.vehicle}
                        {route.planned_date && <span className="ml-2 text-[#10B981]">📅 {route.planned_date}</span>}
                      </div>
                      <div className="text-xs text-white/50 mb-3">
                        📍 Bu rotadaki tüm ATM&apos;ler {route.cash_center} NM&apos;ye bağlıdır • Rota sırası CIT firmasınca belirlenir
                      </div>

                      {/* Progress bar */}
                      {route.status === "in-progress" && (
                        <div className="mb-4">
                          <div className="flex justify-between text-sm text-[#A7B8D8] mb-2">
                            <span>İlerleme: {route.completed}/{route.atms_count} ATM</span>
                            <span>{route.progress}%</span>
                          </div>
                          <div className="h-3 w-full bg-[#112544] rounded-full overflow-hidden">
                            <div
                              className="h-3 bg-gradient-to-r from-[#2E86FF] to-[#10B981] rounded-full transition-all duration-500"
                              style={{ width: `${route.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Stats grid */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-[#112544] rounded-lg p-3">
                          <div className="text-xs text-[#A7B8D8]">ATM Sayısı</div>
                          <div className="text-base font-bold mt-1">{route.atms_count}</div>
                        </div>
                        <div className="bg-[#112544] rounded-lg p-3">
                          <div className="text-xs text-[#A7B8D8]">Tahmini Süre</div>
                          <div className="text-base font-bold mt-1">{route.estimated_time}</div>
                        </div>
                        <div className="bg-[#112544] rounded-lg p-3">
                          <div className="text-xs text-[#A7B8D8]">Toplam Nakit</div>
                          <div className="text-base font-bold mt-1">{route.total_cash}</div>
                        </div>
                      </div>

                      {/* Optimization suggestions */}
                      {route.efficiency_score < 85 && (
                        <div className="bg-[#F2B705]/10 rounded-lg p-3 mb-3">
                          <div className="text-sm text-[#F2B705] font-semibold mb-1">💡 Optimizasyon Önerisi</div>
                          <div className="text-sm text-white/80">
                            {route.efficiency_score < 80
                              ? `Rota sıralaması optimize edilebilir. 3 ATM konum bazlı yeniden sıralanarak ${(85 - route.efficiency_score) * 2} dakika tasarruf edilebilir.`
                              : `2 ATM alternatif güzergaha alınarak ${(90 - route.efficiency_score)} dakika kazanç sağlanabilir.`
                            }
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedRoute(route); setShowRouteMapModal(true); }}
                          className="flex-1 px-4 py-2.5 rounded-lg bg-[#2E86FF]/20 hover:bg-[#2E86FF]/30 text-sm text-[#2E86FF] font-semibold transition ring-1 ring-[#2E86FF]/50"
                        >
                          Haritada Göster
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedRoute(route); setShowRouteOptimizeModal(true); }}
                          className="flex-1 px-4 py-2.5 rounded-lg bg-[#10B981]/20 hover:bg-[#10B981]/30 text-sm text-[#10B981] font-semibold transition ring-1 ring-[#10B981]/50"
                        >
                          İş Emri Aç
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedRoute(route); setShowRouteDetailsModal(true); }}
                          className="px-4 py-2.5 rounded-lg bg-[#0E2142] hover:bg-[#1C2E52] text-sm text-[#A7B8D8] font-semibold transition ring-1 ring-[#2B416B]"
                        >
                          İş Emirleri
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-12 gap-4">
        {/* Cash Trend Chart */}
        <div className="col-span-12 xl:col-span-7 bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="text-sm text-white font-semibold">📈 Cash Trend & Forecast</div>
              <button
                onClick={() => setInfoModal(CASHFLOW_METRIC_EXPLANATIONS["cash_trend_forecast"])}
                className="w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition"
              >
                ?
              </button>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={trendDateStart}
                  onChange={(e) => setTrendDateStart(e.target.value)}
                  max={trendDateEnd}
                  className="px-2 py-1 text-xs rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                />
                <span className="text-white/50 text-xs">-</span>
                <input
                  type="date"
                  value={trendDateEnd}
                  onChange={(e) => setTrendDateEnd(e.target.value)}
                  min={trendDateStart}
                  max="2026-02-28"
                  className="px-2 py-1 text-xs rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                />
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setTrendDateStart("2026-01-28");
                    setTrendDateEnd("2026-02-11");
                  }}
                  className="px-2 py-1 text-xs rounded bg-[#0E2142] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
                >
                  7 Gün +7
                </button>
                <button
                  onClick={() => {
                    setTrendDateStart("2026-01-21");
                    setTrendDateEnd("2026-02-18");
                  }}
                  className="px-2 py-1 text-xs rounded bg-[#0E2142] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
                >
                  14 Gün +14
                </button>
                <button
                  onClick={() => {
                    setTrendDateStart("2026-01-05");
                    setTrendDateEnd("2026-03-06");
                  }}
                  className="px-2 py-1 text-xs rounded bg-[#0E2142] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
                >
                  30 Gün +30
                </button>
              </div>
              <button
                onClick={() => {
                  const formatDate = (dateStr: string) => {
                    const d = new Date(dateStr);
                    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
                  };
                  const dateRangeLabel = `${formatDate(trendDateStart)} - ${formatDate(trendDateEnd)}`;
                  const daysDiff = Math.floor((new Date(trendDateEnd).getTime() - new Date(trendDateStart).getTime()) / (1000 * 60 * 60 * 24));
                  
                  // Mock trend data
                  const trendData = [
                    { date: "28 Ocak", actual: 2800000, forecast: null },
                    { date: "29 Ocak", actual: 2650000, forecast: null },
                    { date: "30 Ocak", actual: 2750000, forecast: null },
                    { date: "31 Ocak", actual: 2600000, forecast: null },
                    { date: "1 Şubat", actual: 2550000, forecast: null },
                    { date: "2 Şubat", actual: 2700000, forecast: null },
                    { date: "3 Şubat", actual: 2600000, forecast: null },
                    { date: "4 Şubat (Bugün)", actual: 2650000, forecast: 2650000 },
                    { date: "5 Şubat", actual: null, forecast: 2700000 },
                    { date: "6 Şubat", actual: null, forecast: 2750000 },
                    { date: "7 Şubat", actual: null, forecast: 2800000 },
                    { date: "8 Şubat", actual: null, forecast: 2850000 },
                    { date: "9 Şubat", actual: null, forecast: 2900000 },
                    { date: "10 Şubat", actual: null, forecast: 2950000 },
                    { date: "11 Şubat", actual: null, forecast: 3000000 },
                  ];
                  
                  // Create CSV content
                  let csvContent = `Nakit Trend ve Tahmin Raporu\nTarih Aralığı: ${dateRangeLabel}\nRapor Süresi: ${daysDiff + 1} Gün\n\n`;
                  csvContent += "Tarih,Gerçekleşen Nakit (₺),Tahmini Nakit (₺),Durum\n";
                  
                  trendData.forEach((item) => {
                    const actualVal = item.actual ? item.actual : "-";
                    const forecastVal = item.forecast ? item.forecast : "-";
                    const status = item.actual && !item.forecast ? "Gerçekleşti" : 
                                 item.actual && item.forecast ? "Bugün" : "Tahmin";
                    csvContent += `${item.date},${actualVal},${forecastVal},${status}\n`;
                  });
                  
                  // Create and download file
                  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement("a");
                  const url = URL.createObjectURL(blob);
                  link.setAttribute("href", url);
                  const fileName = `Nakit_Trend_Tahmin_${trendDateStart}_${trendDateEnd}.csv`;
                  link.setAttribute("download", fileName);
                  link.style.visibility = 'hidden';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-3 py-1 text-xs rounded-lg font-semibold bg-[#10B981] text-white hover:bg-[#10B981]/80 transition flex items-center gap-1"
              >
                <span>📊</span> Excel İndir
              </button>
            </div>
          </div>
          <div className="h-[340px] bg-[#0E2142] rounded-xl p-4 ring-1 ring-[#2B416B]">
            <svg width="100%" height="100%" viewBox="0 0 600 300">
              {/* Axes */}
              <line x1="40" y1="10" x2="40" y2="270" stroke="#2B416B" strokeWidth="2" />
              <line x1="40" y1="270" x2="580" y2="270" stroke="#2B416B" strokeWidth="2" />
              
              {/* Grid lines */}
              <line x1="40" y1="70" x2="580" y2="70" stroke="#2B416B" strokeDasharray="4" opacity="0.3" />
              <line x1="40" y1="130" x2="580" y2="130" stroke="#2B416B" strokeDasharray="4" opacity="0.3" />
              <line x1="40" y1="190" x2="580" y2="190" stroke="#2B416B" strokeDasharray="4" opacity="0.3" />
              
              {/* Historical Cash Level (last 7 days) */}
              <polyline
                fill="none"
                stroke="#2E86FF"
                strokeWidth="3"
                points="40,180 110,150 180,160 250,140 320,130"
              />
              
              {/* Forecast (next 7 days) */}
              <polyline
                fill="none"
                stroke="#F2B705"
                strokeWidth="3"
                strokeDasharray="6"
                points="320,130 390,120 460,110 530,100"
              />
              
              {/* Threshold line */}
              <line x1="40" y1="200" x2="580" y2="200" stroke="#E63946" strokeWidth="2" strokeDasharray="8" opacity="0.6" />
              
              {/* Labels */}
              <text x="10" y="205" fill="#E63946" fontSize="10">Low</text>
              <text x="10" y="135" fill="#A7B8D8" fontSize="10">Target</text>
              <text x="50" y="290" fill="#A7B8D8" fontSize="11">Day -7</text>
              <text x="180" y="290" fill="#A7B8D8" fontSize="11">Day -3</text>
              <text x="310" y="290" fill="#2E86FF" fontSize="11" fontWeight="bold">Today</text>
              <text x="450" y="290" fill="#F2B705" fontSize="11">Day +7</text>
              
              {/* Legend */}
              <circle cx="420" cy="30" r="4" fill="#2E86FF" />
              <text x="430" y="35" fill="#A7B8D8" fontSize="11">Actual</text>
              
              <circle cx="500" cy="30" r="4" fill="#F2B705" />
              <text x="510" y="35" fill="#A7B8D8" fontSize="11">Forecast</text>
            </svg>
          </div>
        </div>

        {/* Actions */}
        <div className="col-span-12 xl:col-span-5 bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="text-sm text-white font-semibold">⚡ Öncelikli İşlemler</div>
              {selectedCashCenter && data && (
                <div className="text-xs text-[#2E86FF] bg-[#2E86FF]/10 px-2 py-1 rounded-lg">
                  {data.top_actions.filter((a: any) => a.cash_center === selectedCashCenter).length} ATM
                </div>
              )}
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={topActionsDateStart}
                  onChange={(e) => setTopActionsDateStart(e.target.value)}
                  max={topActionsDateEnd}
                  className="px-2 py-1 text-xs rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                />
                <span className="text-white/50 text-xs">-</span>
                <input
                  type="date"
                  value={topActionsDateEnd}
                  onChange={(e) => setTopActionsDateEnd(e.target.value)}
                  min={topActionsDateStart}
                  max="2026-02-11"
                  className="px-2 py-1 text-xs rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                />
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setTopActionsDateStart("2026-02-04");
                    setTopActionsDateEnd("2026-02-04");
                  }}
                  className="px-2 py-1 text-xs rounded bg-[#0E2142] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
                >
                  Bugün
                </button>
                <button
                  onClick={() => {
                    setTopActionsDateStart("2026-01-28");
                    setTopActionsDateEnd("2026-02-04");
                  }}
                  className="px-2 py-1 text-xs rounded bg-[#0E2142] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
                >
                  7 Gün
                </button>
                <button
                  onClick={() => {
                    setTopActionsDateStart("2026-01-21");
                    setTopActionsDateEnd("2026-02-04");
                  }}
                  className="px-2 py-1 text-xs rounded bg-[#0E2142] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
                >
                  14 Gün
                </button>
              </div>
              <button
                onClick={() => {
                  const formatDate = (dateStr: string) => {
                    const d = new Date(dateStr);
                    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
                  };
                  const dateRangeLabel = `${formatDate(topActionsDateStart)} - ${formatDate(topActionsDateEnd)}`;
                  
                  let csvContent = `Öncelikli İşlemler Raporu\nTarih Aralığı: ${dateRangeLabel}\n\n`;
                  csvContent += "ATM ID,ATM Adı,Şehir,İlçe,Aksiyon,Risk Seviyesi,ETA\n";
                  
                  if (data) {
                    data.top_actions.forEach((a) => {
                      csvContent += `${a.atm_id},"${a.atm_name || "N/A"}",${a.city},${a.district},${a.action},${a.risk},${a.eta}\n`;
                    });
                  }
                  
                  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement("a");
                  const url = URL.createObjectURL(blob);
                  link.setAttribute("href", url);
                  link.setAttribute("download", `Oncelikli_Islemler_${topActionsDateStart}_${topActionsDateEnd}.csv`);
                  link.click();
                }}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#2E86FF] to-[#0066FF] hover:from-[#0066FF] hover:to-[#2E86FF] text-white text-xs font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-1.5"
              >
                📥 Excel İndir
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {!data ? (
              <div className="text-[#A7B8D8] text-sm">Loading…</div>
            ) : (() => {
              const actions = data.top_actions.filter((a: any) => !selectedCashCenter || a.cash_center === selectedCashCenter);
              const visible = showAllActions ? actions : actions.slice(0, 3);
              return (
                <>
                  {visible.map((a: any) => (
                    <div key={a.atm_id} className="bg-[#0E2142]/60 rounded-xl p-3 ring-1 ring-[#2B416B]">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">ATM {a.atm_id}</div>
                        <div className="text-xs text-[#A7B8D8]">{a.eta}</div>
                      </div>
                      <div className="text-xs text-white/80 mt-1">{a.atm_name || "N/A"}</div>
                      <div className="text-xs text-white/70 mt-1">
                        {a.city}/{a.district}
                      </div>
                      <div className="text-xs text-white/60 mt-1">
                        📍 {a.cash_center}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-sm">
                          <span className="text-white/70">Action:</span>{" "}
                          <span className="text-white font-semibold">{a.action}</span>
                        </div>
                        <div
                          className={`text-xs font-semibold ${
                            a.risk === "High" ? "text-[#F2B705]" : a.risk === "Medium" ? "text-[#2E86FF]" : "text-white/70"
                          }`}
                        >
                          {a.risk}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          alert(`Cash Task oluşturuldu!\n\nATM: ${a.atm_id}\nLokasyon: ${a.city}/${a.district}\nNakit Merkezi: ${a.cash_center}\nAksiyon: ${a.action}\nRisk: ${a.risk}\nETA: ${a.eta}`);
                        }}
                        className="mt-3 w-full px-3 py-2 rounded-xl bg-gradient-to-r from-[#2E86FF] to-[#0066FF] hover:from-[#0066FF] hover:to-[#2E86FF] text-white text-xs font-semibold shadow-lg hover:shadow-xl transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                      >
                        ✅ Create Cash Task
                      </button>
                    </div>
                  ))}
                  {actions.length > 3 && (
                    <button
                      onClick={() => setShowAllActions(!showAllActions)}
                      className="w-full py-2 rounded-xl bg-[#0E2142] ring-1 ring-[#2B416B] hover:ring-[#2E86FF] text-xs text-[#A7B8D8] hover:text-white transition flex items-center justify-center gap-2"
                    >
                      {showAllActions
                        ? <><span className="inline-block rotate-180">▼</span> Daha Az Göster</>
                        : <><span>▼</span> {actions.length - 3} işlem daha göster</>
                      }
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* CIT Kayıt Pattern Analizi - Collapsible Card */}
      <CITPatternAnalysis />

      {/* Planlı vs Plansız İkmal & Para Toplama Trend Chart */}
      <PlannedUnplannedCashOperationsChart />

      {/* Daily/Weekly Cash Flow Table */}
      <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="text-sm text-white font-semibold">💰 Nakit Giriş-Çıkış Tablosu</div>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={cashFlowDateStart}
                onChange={(e) => setCashFlowDateStart(e.target.value)}
                max={cashFlowDateEnd}
                className="px-2 py-1 text-xs rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
              />
              <span className="text-white/50 text-xs">-</span>
              <input
                type="date"
                value={cashFlowDateEnd}
                onChange={(e) => setCashFlowDateEnd(e.target.value)}
                min={cashFlowDateStart}
                max="2026-02-04"
                className="px-2 py-1 text-xs rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
              />
            </div>
            <div className="flex gap-1">
              <button 
                onClick={() => {
                  setCashFlowDateStart("2026-02-04");
                  setCashFlowDateEnd("2026-02-04");
                  setCashFlowView("daily");
                }}
                className="px-3 py-1 text-xs rounded-lg font-semibold bg-[#0E2142] text-[#A7B8D8] hover:bg-[#2E86FF] hover:text-white transition"
              >
                Bugün
              </button>
              <button 
                onClick={() => {
                  setCashFlowDateStart("2026-02-01");
                  setCashFlowDateEnd("2026-02-04");
                  setCashFlowView("daily");
                }}
                className="px-3 py-1 text-xs rounded-lg font-semibold bg-[#0E2142] text-[#A7B8D8] hover:bg-[#2E86FF] hover:text-white transition"
              >
                Bu Hafta
              </button>
              <button 
                onClick={() => {
                  setCashFlowDateStart("2026-01-01");
                  setCashFlowDateEnd("2026-02-04");
                  setCashFlowView("weekly");
                }}
                className="px-3 py-1 text-xs rounded-lg font-semibold bg-[#0E2142] text-[#A7B8D8] hover:bg-[#2E86FF] hover:text-white transition"
              >
                Bu Ay
              </button>
            </div>
            <button
              onClick={() => {
                const formatDate = (dateStr: string) => {
                  const d = new Date(dateStr);
                  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
                };
                const dateRangeLabel = `${formatDate(cashFlowDateStart)} - ${formatDate(cashFlowDateEnd)}`;
                const daysDiff = Math.floor((new Date(cashFlowDateEnd).getTime() - new Date(cashFlowDateStart).getTime()) / (1000 * 60 * 60 * 24));
                
                // Mock data for the selected date range
                const mockData = [
                  { date: "Bugün", inflow: 2450000, outflow: 1850000, transactions: 187, status: "Aktif" },
                  { date: "Dün", inflow: 3120000, outflow: 2340000, transactions: 243, status: "Tamamlandı" },
                  { date: "2 gün önce", inflow: 2890000, outflow: 2980000, transactions: 221, status: "Tamamlandı" },
                  { date: "3 gün önce", inflow: 3450000, outflow: 2100000, transactions: 256, status: "Tamamlandı" },
                ];
                
                // Create CSV content
                let csvContent = `Nakit Giriş-Çıkış Raporu\nTarih Aralığı: ${dateRangeLabel}\nRapor Süresi: ${daysDiff + 1} Gün\n\n`;
                csvContent += "Tarih,Giriş (₺),Çıkış (₺),Net (₺),İşlem Sayısı,Durum\n";
                
                mockData.forEach((item) => {
                  const net = item.inflow - item.outflow;
                  csvContent += `${item.date},${item.inflow},${item.outflow},${net},${item.transactions},${item.status}\n`;
                });
                
                // Totals
                const totalInflow = mockData.reduce((sum, item) => sum + item.inflow, 0);
                const totalOutflow = mockData.reduce((sum, item) => sum + item.outflow, 0);
                const totalNet = totalInflow - totalOutflow;
                const totalTransactions = mockData.reduce((sum, item) => sum + item.transactions, 0);
                
                csvContent += `\nTOPLAM,${totalInflow},${totalOutflow},${totalNet},${totalTransactions},-\n`;
                
                // Create and download file
                const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                const fileName = `Nakit_Giris_Cikis_${cashFlowDateStart}_${cashFlowDateEnd}.csv`;
                link.setAttribute("download", fileName);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="px-3 py-1 text-xs rounded-lg font-semibold bg-[#10B981] text-white hover:bg-[#10B981]/80 transition flex items-center gap-1"
            >
              <span>📊</span> Excel İndir
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {cashFlowView === "daily" ? (
            <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2B416B]">
                <th className="text-left py-3 px-2 text-xs text-[#A7B8D8] font-semibold">Tarih</th>
                <th className="text-right py-3 px-2 text-xs text-[#A7B8D8] font-semibold">Giriş (₺)</th>
                <th className="text-right py-3 px-2 text-xs text-[#A7B8D8] font-semibold">Çıkış (₺)</th>
                <th className="text-right py-3 px-2 text-xs text-[#A7B8D8] font-semibold">Net (₺)</th>
                <th className="text-right py-3 px-2 text-xs text-[#A7B8D8] font-semibold">İşlem</th>
                <th className="text-left py-3 px-2 text-xs text-[#A7B8D8] font-semibold">Durum</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#2B416B]/50 hover:bg-[#0E2142]/40">
                <td className="py-3 px-2 text-white">Bugün</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺2,450,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺1,850,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺600,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">187</td>
                <td className="py-3 px-2"><span className="px-2 py-1 rounded-full bg-[#10B981]/20 text-[#10B981] text-xs">Aktif</span></td>
              </tr>
              <tr className="border-b border-[#2B416B]/50 hover:bg-[#0E2142]/40">
                <td className="py-3 px-2 text-white">Dün</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺3,120,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺2,340,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺780,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">243</td>
                <td className="py-3 px-2"><span className="px-2 py-1 rounded-full bg-[#2E86FF]/20 text-[#2E86FF] text-xs">Tamamlandı</span></td>
              </tr>
              <tr className="border-b border-[#2B416B]/50 hover:bg-[#0E2142]/40">
                <td className="py-3 px-2 text-white">2 gün önce</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺2,890,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺2,980,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#E63946]">-₺90,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">221</td>
                <td className="py-3 px-2"><span className="px-2 py-1 rounded-full bg-[#2E86FF]/20 text-[#2E86FF] text-xs">Tamamlandı</span></td>
              </tr>
              <tr className="border-b border-[#2B416B]/50 hover:bg-[#0E2142]/40">
                <td className="py-3 px-2 text-white">3 gün önce</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺3,450,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺2,100,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺1,350,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">256</td>
                <td className="py-3 px-2"><span className="px-2 py-1 rounded-full bg-[#2E86FF]/20 text-[#2E86FF] text-xs">Tamamlandı</span></td>
              </tr>
              <tr className="border-b border-[#2B416B]/50 hover:bg-[#0E2142]/40">
                <td className="py-3 px-2 text-white">4 gün önce</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺2,680,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺2,450,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺230,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">198</td>
                <td className="py-3 px-2"><span className="px-2 py-1 rounded-full bg-[#2E86FF]/20 text-[#2E86FF] text-xs">Tamamlandı</span></td>
              </tr>
              <tr className="border-b border-[#2B416B]/50 hover:bg-[#0E2142]/40">
                <td className="py-3 px-2 text-white">5 gün önce</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺3,210,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺2,670,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺540,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">234</td>
                <td className="py-3 px-2"><span className="px-2 py-1 rounded-full bg-[#2E86FF]/20 text-[#2E86FF] text-xs">Tamamlandı</span></td>
              </tr>
              <tr className="hover:bg-[#0E2142]/40">
                <td className="py-3 px-2 text-white">6 gün önce</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺2,950,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺2,380,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺570,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">217</td>
                <td className="py-3 px-2"><span className="px-2 py-1 rounded-full bg-[#2E86FF]/20 text-[#2E86FF] text-xs">Tamamlandı</span></td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#2B416B]">
                <td className="py-3 px-2 font-bold text-white">7 Gün Toplam</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-bold">+₺20,750,000</td>
                <td className="text-right py-3 px-2 text-[#E63946] font-bold">-₺16,770,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981] text-base">+₺3,980,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#A7B8D8]">1,556</td>
                <td className="py-3 px-2"></td>
              </tr>
            </tfoot>
          </table>
          ) : (
            <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2B416B]">
                <th className="text-left py-3 px-2 text-xs text-[#A7B8D8] font-semibold">Hafta</th>
                <th className="text-right py-3 px-2 text-xs text-[#A7B8D8] font-semibold">Giriş (₺)</th>
                <th className="text-right py-3 px-2 text-xs text-[#A7B8D8] font-semibold">Çıkış (₺)</th>
                <th className="text-right py-3 px-2 text-xs text-[#A7B8D8] font-semibold">Net (₺)</th>
                <th className="text-right py-3 px-2 text-xs text-[#A7B8D8] font-semibold">İşlem</th>
                <th className="text-left py-3 px-2 text-xs text-[#A7B8D8] font-semibold">Ort. Günlük</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#2B416B]/50 hover:bg-[#0E2142]/40">
                <td className="py-3 px-2 text-white">Bu Hafta</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺20,750,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺16,770,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺3,980,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">1,556</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">+₺568,571</td>
              </tr>
              <tr className="border-b border-[#2B416B]/50 hover:bg-[#0E2142]/40">
                <td className="py-3 px-2 text-white">Geçen Hafta</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺22,340,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺18,920,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺3,420,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">1,687</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">+₺488,571</td>
              </tr>
              <tr className="border-b border-[#2B416B]/50 hover:bg-[#0E2142]/40">
                <td className="py-3 px-2 text-white">2 Hafta Önce</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺21,890,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺19,450,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺2,440,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">1,623</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">+₺348,571</td>
              </tr>
              <tr className="hover:bg-[#0E2142]/40">
                <td className="py-3 px-2 text-white">3 Hafta Önce</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺23,120,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺20,100,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺3,020,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">1,745</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">+₺431,429</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#2B416B]">
                <td className="py-3 px-2 font-bold text-white">4 Hafta Toplam</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-bold">+₺88,100,000</td>
                <td className="text-right py-3 px-2 text-[#E63946] font-bold">-₺75,240,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981] text-base">+₺12,860,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#A7B8D8]">6,611</td>
                <td className="text-right py-3 px-2 font-bold text-[#A7B8D8]">+₺459,286</td>
              </tr>
            </tfoot>
          </table>
          )}
        </div>
      </div>

      {/* Low Cash ATMs Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4" onClick={() => setShowModal(false)}>
          <div className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-4xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B]">
              <div className="text-lg font-semibold">Low Cash ATMs ({lowCashAtms.filter(a => {
                const cityMatch = lowCashCityFilter === "all" || a.city === lowCashCityFilter;
                const riskMatch = lowCashRiskFilter === "all" || 
                  (lowCashRiskFilter === "critical" && a.cash_level < 20) ||
                  (lowCashRiskFilter === "low" && a.cash_level >= 20 && a.cash_level < 30) ||
                  (lowCashRiskFilter === "moderate" && a.cash_level >= 30);
                return cityMatch && riskMatch;
              }).length})</div>
              <button onClick={() => setShowModal(false)} className="text-[#A7B8D8] hover:text-white text-2xl">&times;</button>
            </div>
            
            {/* Filters */}
            <div className="p-4 border-b border-[#2B416B] bg-[#0E2142]/40">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#A7B8D8] mb-1 block">Şehir</label>
                  <select 
                    value={lowCashCityFilter}
                    onChange={(e) => setLowCashCityFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#112544] text-white text-sm ring-1 ring-[#2B416B] focus:ring-[#2E86FF] outline-none"
                  >
                    <option value="all">Tümü</option>
                    {Array.from(new Set(lowCashAtms.map(a => a.city))).sort().map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#A7B8D8] mb-1 block">Risk Seviyesi</label>
                  <select 
                    value={lowCashRiskFilter}
                    onChange={(e) => setLowCashRiskFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#112544] text-white text-sm ring-1 ring-[#2B416B] focus:ring-[#2E86FF] outline-none"
                  >
                    <option value="all">Tümü</option>
                    <option value="critical">Kritik (&lt;20%)</option>
                    <option value="low">Düşük (20-30%)</option>
                    <option value="moderate">Orta (30-40%)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(80vh - 200px)" }}>
              <div className="grid gap-3">
                {lowCashAtms.filter(a => {
                  const cityMatch = lowCashCityFilter === "all" || a.city === lowCashCityFilter;
                  const riskMatch = lowCashRiskFilter === "all" || 
                    (lowCashRiskFilter === "critical" && a.cash_level < 20) ||
                    (lowCashRiskFilter === "low" && a.cash_level >= 20 && a.cash_level < 30) ||
                    (lowCashRiskFilter === "moderate" && a.cash_level >= 30);
                  return cityMatch && riskMatch;
                }).map((a) => (
                  <div key={a.atm_id} className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B] hover:bg-[#1C2E52] transition">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">ATM {a.atm_id} — {a.atm_name}</div>
                        <div className="text-xs text-[#A7B8D8] mt-1">{a.city} / {a.district}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-[#F2B705]">{a.cash_level}% remaining</div>
                        <div className="text-xs text-[#A7B8D8] mt-1">Replenish needed</div>
                      </div>
                    </div>
                    <div className="mt-2 h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                      <div className="h-2 bg-[#F2B705] rounded-full" style={{ width: `${a.cash_level}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Predicted Shortage ATMs Modal */}
      {showShortageModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4" onClick={() => setShowShortageModal(false)}>
          <div className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-4xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B]">
              <div className="text-lg font-semibold">Predicted Shortage (7 days) — {shortageAtms.filter(a => {
                const cityMatch = shortageCityFilter === "all" || a.city === shortageCityFilter;
                const timeMatch = shortageTimeFilter === "all" || 
                  (shortageTimeFilter === "urgent" && a.predicted_day <= 2) ||
                  (shortageTimeFilter === "soon" && a.predicted_day > 2 && a.predicted_day <= 5) ||
                  (shortageTimeFilter === "later" && a.predicted_day > 5);
                return cityMatch && timeMatch;
              }).length} ATMs</div>
              <button onClick={() => setShowShortageModal(false)} className="text-[#A7B8D8] hover:text-white text-2xl">&times;</button>
            </div>
            
            {/* Filters */}
            <div className="p-4 border-b border-[#2B416B] bg-[#0E2142]/40">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#A7B8D8] mb-1 block">Şehir</label>
                  <select 
                    value={shortageCityFilter}
                    onChange={(e) => setShortageCityFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#112544] text-white text-sm ring-1 ring-[#2B416B] focus:ring-[#2E86FF] outline-none"
                  >
                    <option value="all">Tümü</option>
                    {Array.from(new Set(shortageAtms.map(a => a.city))).sort().map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#A7B8D8] mb-1 block">Zaman</label>
                  <select 
                    value={shortageTimeFilter}
                    onChange={(e) => setShortageTimeFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#112544] text-white text-sm ring-1 ring-[#2B416B] focus:ring-[#2E86FF] outline-none"
                  >
                    <option value="all">Tümü</option>
                    <option value="urgent">Acil (1-2 gün)</option>
                    <option value="soon">Yakın (3-5 gün)</option>
                    <option value="later">İleri (6-7 gün)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(80vh - 200px)" }}>
              <div className="grid gap-3">
                {shortageAtms.filter(a => {
                  const cityMatch = shortageCityFilter === "all" || a.city === shortageCityFilter;
                  const timeMatch = shortageTimeFilter === "all" || 
                    (shortageTimeFilter === "urgent" && a.predicted_day <= 2) ||
                    (shortageTimeFilter === "soon" && a.predicted_day > 2 && a.predicted_day <= 5) ||
                    (shortageTimeFilter === "later" && a.predicted_day > 5);
                  return cityMatch && timeMatch;
                }).map((a) => (
                  <div key={a.atm_id} className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B] hover:bg-[#1C2E52] transition">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">ATM {a.atm_id} — {a.atm_name}</div>
                        <div className="text-xs text-[#A7B8D8] mt-1">{a.city} / {a.district}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-[#E63946]">Day {a.predicted_day}</div>
                        <div className="text-xs text-[#A7B8D8] mt-1">Predicted shortage</div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-[#112544] rounded-full overflow-hidden">
                        <div className="h-2 bg-[#E63946] rounded-full" style={{ width: `${(a.predicted_day / 7) * 100}%` }} />
                      </div>
                      <div className="text-xs text-[#A7B8D8]">in {a.predicted_day}d</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Planned Replenishments Modal */}
      {showReplModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4" onClick={() => setShowReplModal(false)}>
          <div className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-4xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B]">
              <div className="text-lg font-semibold">Planned Replenishments (7 days) — {replAtms.filter(a => {
                const cityMatch = replCityFilter === "all" || a.city === replCityFilter;
                const priorityMatch = replPriorityFilter === "all" || a.priority === replPriorityFilter;
                return cityMatch && priorityMatch;
              }).length} ATMs</div>
              <button onClick={() => setShowReplModal(false)} className="text-[#A7B8D8] hover:text-white text-2xl">&times;</button>
            </div>
            
            {/* Filters */}
            <div className="p-4 border-b border-[#2B416B] bg-[#0E2142]/40">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#A7B8D8] mb-1 block">Şehir</label>
                  <select 
                    value={replCityFilter}
                    onChange={(e) => setReplCityFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#112544] text-white text-sm ring-1 ring-[#2B416B] focus:ring-[#2E86FF] outline-none"
                  >
                    <option value="all">Tümü</option>
                    {Array.from(new Set(replAtms.map(a => a.city))).sort().map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#A7B8D8] mb-1 block">Öncelik</label>
                  <select 
                    value={replPriorityFilter}
                    onChange={(e) => setReplPriorityFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#112544] text-white text-sm ring-1 ring-[#2B416B] focus:ring-[#2E86FF] outline-none"
                  >
                    <option value="all">Tümü</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(80vh - 200px)" }}>
              <div className="grid gap-3">
                {replAtms.filter(a => {
                  const cityMatch = replCityFilter === "all" || a.city === replCityFilter;
                  const priorityMatch = replPriorityFilter === "all" || a.priority === replPriorityFilter;
                  return cityMatch && priorityMatch;
                }).map((a) => (
                  <div key={a.atm_id} className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B] hover:bg-[#1C2E52] transition">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">ATM {a.atm_id} — {a.atm_name}</div>
                        <div className="text-xs text-[#A7B8D8] mt-1">{a.city} / {a.district}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-[#2E86FF]">{a.scheduled_day}</div>
                        <div className="text-xs text-[#A7B8D8] mt-1">Scheduled</div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-xs text-[#A7B8D8]">Priority:</div>
                      <div className={
                        "text-xs font-semibold " +
                        (a.priority === "High" ? "text-[#E63946]" : a.priority === "Medium" ? "text-[#F2B705]" : "text-[#2E86FF]")
                      }>
                        {a.priority}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Center Search Modal — multi-select */}
      {showCashCenterSearch && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-2xl ring-2 ring-[#2B416B] flex flex-col" style={{ maxHeight: '90vh' }}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B] bg-[#0E2142]/60 flex-shrink-0">
              <div>
                <div className="text-lg font-semibold">🏦 Nakit Merkezi Seç</div>
                <div className="text-xs text-[#A7B8D8] mt-0.5">Sekme olarak görmek istediğiniz NM&apos;leri işaretleyin</div>
              </div>
              <button
                onClick={() => { setShowCashCenterSearch(false); setCashCenterSearchTerm(""); }}
                className="text-[#A7B8D8] hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>

            {/* Selected count badge */}
            <div className="px-4 pt-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedNmTabs.length === 0 ? (
                  <span className="text-xs text-[#A7B8D8]">Henüz seçili NM yok</span>
                ) : (
                  selectedNmTabs.map(nm => (
                    <span
                      key={nm}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#2E86FF]/20 text-[#2E86FF] ring-1 ring-[#2E86FF]/50"
                    >
                      {nm}
                      <button
                        onClick={() => {
                          setSelectedNmTabs(prev => prev.filter(t => t !== nm));
                          if (selectedCashCenter === nm) setSelectedCashCenter("");
                        }}
                        className="ml-0.5 hover:text-white"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
              {selectedNmTabs.length > 0 && (
                <button
                  onClick={() => { setSelectedNmTabs([]); setSelectedCashCenter(""); }}
                  className="text-xs text-[#E63946] hover:text-white transition shrink-0 ml-2"
                >
                  Tümünü Kaldır
                </button>
              )}
            </div>

            {/* Search input */}
            <div className="px-4 pt-3 pb-2 flex-shrink-0">
              <input
                type="text"
                placeholder="NM ara..."
                value={cashCenterSearchTerm}
                onChange={(e) => setCashCenterSearchTerm(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-[#0E2142] text-white placeholder-[#A7B8D8] border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
              />
            </div>

            {/* Cash centers list */}
            <div className="px-4 pb-2 flex-1 overflow-y-auto space-y-2">
              {allCashCenters
                .filter(cc => cc.name.toLowerCase().includes(cashCenterSearchTerm.toLowerCase()))
                .map((cc) => {
                  const isPinned = selectedNmTabs.includes(cc.name);
                  const nmRoutes = citRoutes.filter(r => r.cash_center === cc.name);
                  const completedRoutes = nmRoutes.filter(r => r.status === "completed" || r.progress === 100);
                  const remainingRoutes = nmRoutes.filter(r => r.status !== "completed" && r.progress !== 100);
                  const completionRate = nmRoutes.length > 0 ? (completedRoutes.length / nmRoutes.length * 100) : 0;

                  return (
                    <div
                      key={cc.name}
                      onClick={() => {
                        if (isPinned) {
                          setSelectedNmTabs(prev => prev.filter(t => t !== cc.name));
                          if (selectedCashCenter === cc.name) setSelectedCashCenter("");
                        } else {
                          setSelectedNmTabs(prev => [...prev, cc.name]);
                        }
                      }}
                      className={`p-4 rounded-lg transition cursor-pointer ${
                        isPinned
                          ? "bg-[#2E86FF]/20 ring-2 ring-[#2E86FF]"
                          : "bg-[#0E2142] ring-1 ring-[#2B416B] hover:ring-[#2E86FF]/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Checkbox */}
                          <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ring-2 transition ${
                            isPinned ? "bg-[#2E86FF] ring-[#2E86FF]" : "bg-[#112544] ring-[#2B416B]"
                          }`}>
                            {isPinned && <span className="text-white text-xs font-bold">✓</span>}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm truncate">{cc.name}</div>
                            <div className="text-xs text-[#A7B8D8] mt-0.5">
                              {cc.atm_count} ATM • {cc.offsite_count} Offsite
                            </div>
                          </div>
                        </div>
                        {isPinned && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#2E86FF]/30 text-[#2E86FF] shrink-0 ml-2">Sekmede</span>
                        )}
                      </div>

                      {/* Work status (only shown when routes exist) */}
                      {nmRoutes.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-[#2B416B]/50 ml-8">
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <div className="flex items-center gap-3">
                              <span className="text-[#10B981]">✓ Biten: <span className="font-semibold">{completedRoutes.length}</span></span>
                              <span className="text-[#F2B705]">⏳ Kalan: <span className="font-semibold">{remainingRoutes.length}</span></span>
                            </div>
                            <span className="font-bold text-white">{completionRate.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-[#112544] rounded-full overflow-hidden">
                            <div
                              className="h-1.5 bg-gradient-to-r from-[#10B981] to-[#2E86FF] rounded-full transition-all"
                              style={{ width: `${completionRate}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Footer confirm button */}
            <div className="p-4 border-t border-[#2B416B] bg-[#0E2142]/60 flex-shrink-0 flex items-center justify-between gap-3">
              <div className="text-xs text-[#A7B8D8]">
                {selectedNmTabs.length} NM seçili
              </div>
              <button
                onClick={() => { setShowCashCenterSearch(false); setCashCenterSearchTerm(""); }}
                className="px-6 py-2 rounded-lg bg-[#2E86FF] text-white text-sm font-semibold hover:bg-[#2E86FF]/80 transition"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SLA Exceeded Modal */}
      {showSlaExceededModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-7xl flex flex-col" style={{ maxHeight: '90vh', height: '90vh' }}>
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B] bg-[#0E2142]/60 flex-shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-lg font-semibold">⚠️ SLA Süresi Aşan ATM'ler</div>
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-[#8B5CF6]/20 text-white">
                  {slaExceededAtms.length} ATM
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={slaExceededDateStart}
                    onChange={(e) => setSlaExceededDateStart(e.target.value)}
                    max={slaExceededDateEnd}
                    className="px-2 py-1 text-xs rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                  />
                  <span className="text-white/50 text-xs">-</span>
                  <input
                    type="date"
                    value={slaExceededDateEnd}
                    onChange={(e) => setSlaExceededDateEnd(e.target.value)}
                    min={slaExceededDateStart}
                    max="2026-02-04"
                    className="px-2 py-1 text-xs rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setSlaExceededDateStart("2026-02-04");
                      setSlaExceededDateEnd("2026-02-04");
                    }}
                    className="px-2 py-1 text-xs rounded bg-[#0E2142] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
                  >
                    Bugün
                  </button>
                  <button
                    onClick={() => {
                      setSlaExceededDateStart("2026-02-01");
                      setSlaExceededDateEnd("2026-02-04");
                    }}
                    className="px-2 py-1 text-xs rounded bg-[#0E2142] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
                  >
                    Bu Hafta
                  </button>
                  <button
                    onClick={() => {
                      setSlaExceededDateStart("2026-01-01");
                      setSlaExceededDateEnd("2026-02-04");
                    }}
                    className="px-2 py-1 text-xs rounded bg-[#0E2142] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
                  >
                    Son Ay
                  </button>
                </div>
                <button
                  onClick={() => {
                    const formatDate = (dateStr: string) => {
                      const d = new Date(dateStr);
                      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
                    };
                    const dateRangeLabel = `${formatDate(slaExceededDateStart)} - ${formatDate(slaExceededDateEnd)}`;
                    const daysDiff = Math.floor((new Date(slaExceededDateEnd).getTime() - new Date(slaExceededDateStart).getTime()) / (1000 * 60 * 60 * 24));
                    
                    // Create CSV content
                    let csvContent = `SLA Süresi Aşan ATM'ler Raporu\nTarih Aralığı: ${dateRangeLabel}\nRapor Süresi: ${daysDiff + 1} Gün\n\n`;
                    csvContent += "Sıra,ATM ID,ATM Adı,İl,İlçe,Maaş Ödemeli,En Yakın ATM (km),Kritik Durum\n";
                    
                    slaExceededAtms.forEach((atm, index) => {
                      const nearbyAtm = nearbyAtmsData.find(n => n.atm_id === atm.atm_id);
                      const nearestDistance = nearbyAtm && nearbyAtm.nearbyAtms.length > 0 
                        ? nearbyAtm.nearbyAtms[0].distance.toFixed(1) 
                        : "Yok";
                      const isSalaryAtm = atm.salary_flag === "Maaş Ödemeli";
                      const isDistanceCritical = !nearbyAtm || nearbyAtm.nearbyAtms.length === 0 || 
                                                (nearbyAtm.nearbyAtms.length > 0 && nearbyAtm.nearbyAtms[0].distance > 10);
                      const isCritical = isDistanceCritical && isSalaryAtm;
                      const criticalStatus = isCritical ? "ACİL" : isSalaryAtm ? "Maaş Ödemeli" : isDistanceCritical ? "Uzak" : "Normal";
                      
                      csvContent += `${index + 1},${atm.atm_id},"${atm.atm_name}","${atm.city}","${atm.district}",${isSalaryAtm ? "Evet" : "Hayır"},${nearestDistance},${criticalStatus}\n`;
                    });
                    
                    // Create and download file
                    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement("a");
                    const url = URL.createObjectURL(blob);
                    link.setAttribute("href", url);
                    const fileName = `SLA_Asan_ATMler_${slaExceededDateStart}_${slaExceededDateEnd}.csv`;
                    link.setAttribute("download", fileName);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-3 py-1 text-xs rounded-lg font-semibold bg-[#10B981] text-white hover:bg-[#10B981]/80 transition flex items-center gap-1"
                >
                  <span>📊</span> Excel İndir
                </button>
              </div>
              <button onClick={() => { setShowSlaExceededModal(false); setSelectedSlaAtm(null); setExpandedSlaAtms(new Set()); }} className="text-[#A7B8D8] hover:text-white text-2xl">&times;</button>
            </div>
            
            <div className="flex flex-1 min-h-0">
              {/* Left side - ATM List */}
              <div className={`${selectedSlaAtm ? 'w-1/2' : 'w-full'} flex flex-col transition-all`}>
                <div className="p-4 pb-2 flex-shrink-0">
                  <div className="bg-[#8B5CF6]/10 rounded-lg p-4 ring-1 ring-[#8B5CF6]/30">
                    <div className="text-sm text-white font-semibold mb-1">🚨 Acil Müdahale Gerekli</div>
                    <div className="text-xs text-white/80">
                      Bu ATM'lerin nakit seviyeleri kritik düzeyde ve SLA hedef süresini aşmıştır. ATM'ye tıklayarak en yakın ATM'leri haritada görüntüleyebilirsiniz.
                    </div>
                  </div>
                </div>

                {/* SLA Exceeded ATMs Table */}
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <div className="space-y-2">
                  {slaExceededAtms
                    .sort((a, b) => {
                      // Calculate nearby ATM distance for sorting
                      const nearbyA = nearbyAtmsData.find(n => n.atm_id === a.atm_id);
                      const nearbyB = nearbyAtmsData.find(n => n.atm_id === b.atm_id);
                      
                      const nearbyCountA = nearbyA ? nearbyA.nearbyAtms.length : 0;
                      const nearbyCountB = nearbyB ? nearbyB.nearbyAtms.length : 0;
                      
                      // Get distance to nearest ATM (if exists)
                      const nearestDistanceA = nearbyCountA > 0 ? nearbyA.nearbyAtms[0].distance : 999999;
                      const nearestDistanceB = nearbyCountB > 0 ? nearbyB.nearbyAtms[0].distance : 999999;
                      
                      // Sort by nearest ATM distance (furthest first = most critical)
                      // ATMs with no nearby ATMs will have distance 999999 and appear first
                      return nearestDistanceB - nearestDistanceA;
                    })
                    .map((atm) => {
                    // Calculate nearby ATMs for this SLA exceeded ATM
                    const nearbyAtm = nearbyAtmsData.find(n => n.atm_id === atm.atm_id);
                    const atmWithNearby = nearbyAtm ? { ...atm, nearbyAtms: nearbyAtm.nearbyAtms } : atm;
                    const isSelected = selectedSlaAtm?.atm_id === atm.atm_id;
                    
                    // Check if this ATM is critical (no nearby ATMs or very far AND salary ATM)
                    const isSalaryAtm = atm.salary_flag === "Maaş Ödemeli";
                    const isDistanceCritical = !nearbyAtm || nearbyAtm.nearbyAtms.length === 0 || 
                                              (nearbyAtm.nearbyAtms.length > 0 && nearbyAtm.nearbyAtms[0].distance > 10);
                    const isCritical = isDistanceCritical && isSalaryAtm;
                    
                    return (
                    <div 
                      key={atm.atm_id} 
                      onClick={() => setSelectedSlaAtm(atmWithNearby)}
                      className={`bg-[#0E2142] rounded-lg p-4 ring-1 transition cursor-pointer ${
                        isSelected ? 'ring-2 ring-[#2E86FF]' : 'ring-[#8B5CF6]/50 hover:ring-[#8B5CF6]'
                      }`}
                    >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-semibold text-sm">🏧 {atm.atm_name}</div>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#8B5CF6]/20 text-white">
                            SLA Aşıldı
                          </span>
                          {nearbyAtm && nearbyAtm.nearbyAtms.length === 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 ring-1 ring-red-500/50">
                              🚨 Yakınında ATM YOK
                            </span>
                          )}
                          {nearbyAtm && nearbyAtm.nearbyAtms.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400">
                              📍 En yakın: {nearbyAtm.nearbyAtms[0].distance.toFixed(1)} km
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#A7B8D8]">
                          ID: {atm.atm_id} • {atm.city} / {atm.district}
                        </div>
                        {nearbyAtm && nearbyAtm.nearbyAtms.length === 0 && (
                          <div className="text-xs text-red-400 mt-1 font-semibold">
                            ⚠️ Yakınında alternatif ATM yok - ACİL ÖNCELİK
                          </div>
                        )}
                        {nearbyAtm && nearbyAtm.nearbyAtms.length > 0 && nearbyAtm.nearbyAtms[0].distance > 10 && (
                          <div className="text-xs text-orange-400 mt-1 font-semibold">
                            ⚠️ En yakın alternatif {nearbyAtm.nearbyAtms[0].distance.toFixed(1)} km uzakta - Yüksek Öncelik
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">{atm.cash_level}%</div>
                        <div className="text-xs text-[#A7B8D8]">Nakit Seviyesi</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="bg-[#112544] rounded-lg p-2">
                        <div className="text-xs text-[#A7B8D8]">SLA Hedef</div>
                        <div className="text-sm font-bold text-white mt-1">{atm.sla_target} saat</div>
                        <div className="text-xs text-[#A7B8D8] mt-0.5">Zone {atm.zone} - {atm.operation_type}</div>
                      </div>
                      <div className="bg-[#8B5CF6]/10 rounded-lg p-2 ring-1 ring-[#8B5CF6]/30">
                        <div className="text-xs text-white">Aşılan Süre</div>
                        <div className="text-sm font-bold text-white mt-1">{atm.hours_exceeded} saat</div>
                      </div>
                      <div className="bg-[#112544] rounded-lg p-2">
                        <div className="text-xs text-[#A7B8D8]">Gecikme</div>
                        <div className="text-sm font-bold text-white mt-1">{atm.days_exceeded} gün</div>
                      </div>
                    </div>

                    {/* Progress bar showing cash level */}
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-[#A7B8D8] mb-1">
                        <span>Nakit Durumu</span>
                        <span>Kritik Seviye</span>
                      </div>
                      <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                        <div 
                          className="h-2 bg-[#8B5CF6] rounded-full"
                          style={{ width: `${atm.cash_level}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          alert('Acil İkmal Planı oluşturuluyor...');
                        }}
                        className="flex-1 px-3 py-2 rounded-lg bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 text-xs text-white font-semibold transition ring-1 ring-[#8B5CF6]/50"
                      >
                        Acil İkmal Planla
                      </button>
                      {nearbyAtm && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSlaAtm(atmWithNearby);
                          }}
                          className="flex-1 px-3 py-2 rounded-lg bg-[#2E86FF]/20 hover:bg-[#2E86FF]/30 text-xs text-[#2E86FF] font-semibold transition ring-1 ring-[#2E86FF]/50"
                        >
                          📍 Yakın ATM&apos;leri Göster
                        </button>
                      )}
                    </div>

                    {/* Kaset Detayı - Collapsible */}
                    {(() => {
                      const cassettes: any[] = atm.cassettes || [];
                      const isKasetOpen = expandedSlaAtms.has(atm.atm_id);
                      const atmTRY = cassettes.filter((c: any) => c.currency === 'TRY').reduce((s: number, c: any) => s + c.denomination * c.quantity, 0);
                      const atmUSD = cassettes.filter((c: any) => c.currency === 'USD').reduce((s: number, c: any) => s + c.denomination * c.quantity, 0);
                      const atmEUR = cassettes.filter((c: any) => c.currency === 'EUR').reduce((s: number, c: any) => s + c.denomination * c.quantity, 0);
                      const atmTRYEquiv = atmTRY + atmUSD * USD_RATE + atmEUR * EUR_RATE;
                      if (cassettes.length === 0) return null;
                      return (
                        <div className="mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedSlaAtms(prev => {
                                const next = new Set(prev);
                                isKasetOpen ? next.delete(atm.atm_id) : next.add(atm.atm_id);
                                return next;
                              });
                            }}
                            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#112544] hover:bg-[#1C2E52] text-xs text-[#A7B8D8] hover:text-white transition ring-1 ring-[#2B416B]"
                          >
                            <span className="flex items-center gap-1.5">
                              <span className={`transition-transform duration-150 ${isKasetOpen ? 'rotate-90' : ''}`}>▶</span>
                              📦 İkmal Kaset Detayı
                              {atm.hasFx && <span className="px-1 rounded text-[10px] bg-[#F2B705]/20 text-[#F2B705] font-bold">FX</span>}
                            </span>
                            <span className="font-bold text-white">₺{atmTRYEquiv.toLocaleString('tr-TR')}{atmUSD > 0 ? ` + $${atmUSD.toLocaleString('tr-TR')}` : ''}{atmEUR > 0 ? ` + €${atmEUR.toLocaleString('tr-TR')}` : ''}</span>
                          </button>
                          {isKasetOpen && (
                            <div className="mt-1 bg-[#0A1628] rounded-lg p-2 ring-1 ring-[#2B416B]/60">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-[#A7B8D8] border-b border-[#2B416B]/60">
                                    <th className="text-left py-1 font-medium">Kaset</th>
                                    <th className="text-center py-1 font-medium">Dv.</th>
                                    <th className="text-center py-1 font-medium">Nominal</th>
                                    <th className="text-center py-1 font-medium">Adet</th>
                                    <th className="text-right py-1 font-medium">Toplam</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cassettes.map((c: any) => (
                                    <tr key={c.id} className="border-b border-[#2B416B]/30">
                                      <td className="py-1.5 text-[#A7B8D8]">#{c.id}</td>
                                      <td className="py-1.5 text-center">
                                        <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                                          c.currency === 'TRY' ? 'bg-[#10B981]/20 text-[#10B981]' :
                                          c.currency === 'USD' ? 'bg-[#2E86FF]/20 text-[#2E86FF]' :
                                          'bg-[#A7B8D8]/20 text-[#A7B8D8]'
                                        }`}>{c.currency}</span>
                                      </td>
                                      <td className="py-1.5 text-center font-semibold">{CURRENCY_SYMBOL[c.currency]}{c.denomination}</td>
                                      <td className="py-1.5 text-center">{c.quantity.toLocaleString('tr-TR')}</td>
                                      <td className="py-1.5 text-right font-bold">{CURRENCY_SYMBOL[c.currency]}{(c.denomination * c.quantity).toLocaleString('tr-TR')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t border-[#2B416B] bg-[#0E2142]/60">
                                    <td colSpan={3} className="py-1.5 text-[#A7B8D8] font-semibold">Toplam</td>
                                    <td className="py-1.5 text-center text-white font-semibold">{cassettes.reduce((s: number, c: any) => s + c.quantity, 0)}</td>
                                    <td className="py-1.5 text-right">
                                      {atmTRY > 0 && <div className="font-bold text-white">₺{atmTRY.toLocaleString('tr-TR')}</div>}
                                      {atmUSD > 0 && <div className="font-bold text-[#2E86FF]">${atmUSD.toLocaleString('tr-TR')}</div>}
                                      {atmEUR > 0 && <div className="font-bold text-[#A7B8D8]">€{atmEUR.toLocaleString('tr-TR')}</div>}
                                      {(atmUSD > 0 || atmEUR > 0) && (
                                        <div className="text-[10px] text-white/40 mt-0.5">≈ ₺{atmTRYEquiv.toLocaleString('tr-TR')}</div>
                                      )}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
                })}
                  </div>
                </div>
              </div>

              {/* Right side - Map view when ATM selected */}
              {selectedSlaAtm && selectedSlaAtm.nearbyAtms && (
                <div className="w-1/2 border-l border-[#2B416B] flex flex-col">
                  <div className="p-4 flex-1 overflow-y-auto">
                    <div className="bg-[#0E2142] rounded-xl p-4 ring-1 ring-[#8B5CF6]/50 h-full">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-semibold text-white">📍 {selectedSlaAtm.atm_name} - En Yakın ATM'ler</div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSlaAtm(null);
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg bg-[#2B416B] hover:bg-[#3C5278] text-[#A7B8D8] font-semibold transition"
                        >
                          ← Geri Dön
                        </button>
                      </div>
                      
                      <div className="h-[450px] w-full rounded-xl overflow-hidden ring-1 ring-[#2B416B] mb-3">
                        <RouteMapComponent 
                          key={selectedSlaAtm.atm_id}
                          route={{
                          cash_center: "SLA Aşan ATM",
                          atms: [
                            {
                              ...selectedSlaAtm,
                              operation: "ikmal",
                              amount: "Acil İkmal Gerekli"
                            },
                            ...selectedSlaAtm.nearbyAtms.map((nearby: any, idx: number) => ({
                              ...nearby,
                              operation: "normal",
                              amount: `${nearby.distance.toFixed(1)} km`,
                              cash_level: 50 + idx * 10 // Mock: normal cash level
                            }))
                          ]
                        }} />
                      </div>

                      {/* Nearby ATMs List */}
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-[#A7B8D8] mb-2">En Yakın ATM'ler:</div>
                        {selectedSlaAtm.nearbyAtms.map((nearby: any, idx: number) => (
                          <div key={nearby.atm_id} className="bg-[#112544] rounded-lg p-3 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#2E86FF]/20 flex items-center justify-center text-sm font-bold text-[#2E86FF] flex-shrink-0">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-white truncate">{nearby.atm_name}</div>
                              <div className="text-xs text-[#A7B8D8]">{nearby.city} / {nearby.district}</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-base font-bold text-[#2E86FF]">{nearby.distance.toFixed(1)} km</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SLA ATM Map Modal */}
      {showSlaMapModal && selectedSlaAtm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden ring-2 ring-[#E63946]/50">
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B] bg-[#0E2142]/60">
              <div className="flex items-center gap-3">
                <div className="text-lg font-semibold">📍 {selectedSlaAtm.atm_name} - SLA Aşan ATM</div>
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-[#E63946]/20 text-[#E63946]">
                  ⚠️ Acil
                </span>
              </div>
              <button onClick={() => { setShowSlaMapModal(false); setSelectedSlaAtm(null); }} className="text-[#A7B8D8] hover:text-white text-2xl">&times;</button>
            </div>
            
            <div className="p-4">
              <div className="h-[600px] w-full rounded-xl overflow-hidden ring-1 ring-[#E63946]/50">
                <RouteMapComponent route={{
                  cash_center: "SLA Aşan ATM",
                  atms: [{
                    ...selectedSlaAtm,
                    operation: "ikmal",
                    amount: "Acil İkmal Gerekli"
                  }]
                }} />
              </div>
              
              <div className="mt-4 grid grid-cols-4 gap-3">
                <div className="bg-[#0E2142] rounded-lg p-3 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8]">ATM ID</div>
                  <div className="text-sm font-bold mt-1">{selectedSlaAtm.atm_id}</div>
                </div>
                <div className="bg-[#0E2142] rounded-lg p-3 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8]">Nakit Seviyesi</div>
                  <div className="text-sm font-bold mt-1 text-[#E63946]">{selectedSlaAtm.cash_level}%</div>
                </div>
                <div className="bg-[#0E2142] rounded-lg p-3 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8]">Aşılan Süre</div>
                  <div className="text-sm font-bold mt-1 text-[#E63946]">{selectedSlaAtm.hours_exceeded}h</div>
                </div>
                <div className="bg-[#0E2142] rounded-lg p-3 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8]">Konum</div>
                  <div className="text-sm font-bold mt-1">{selectedSlaAtm.city}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nearby ATMs Modal */}
      {showNearbyAtmsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-6xl ring-2 ring-[#F2B705]/50 flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B] bg-[#0E2142]/60 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="text-lg font-semibold">📍 Yakın ATM Analizi</div>
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-[#F2B705]/20 text-[#F2B705]">
                  {nearbyAtmsData.length} ATM
                </span>
              </div>
              <button onClick={() => setShowNearbyAtmsModal(false)} className="text-[#A7B8D8] hover:text-white text-2xl">&times;</button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="mb-4 bg-[#F2B705]/10 rounded-lg p-4 ring-1 ring-[#F2B705]/30">
                <div className="text-sm text-[#F2B705] font-semibold mb-1">💰 Nakit Seviyesi Düşük ATM'ler</div>
                <div className="text-xs text-white/80">
                  Bu ATM'lerin nakit seviyeleri kritik düzeyde. Her ATM için en yakın 5 ATM ve mesafeleri listelenmektedir.
                </div>
              </div>

              {/* Low Cash ATMs with Nearby ATMs */}
              <div className="space-y-4">
                {nearbyAtmsData.map((lowAtm) => (
                  <div key={lowAtm.atm_id} className="bg-[#0E2142] rounded-xl p-4 ring-1 ring-[#F2B705]/50">
                    {/* Low Cash ATM Header */}
                    <div className="flex items-start justify-between mb-4 pb-4 border-b border-[#2B416B]">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="font-semibold text-base">🏧 {lowAtm.atm_name}</div>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F2B705]/20 text-[#F2B705]">
                            Nakit Azalıyor
                          </span>
                        </div>
                        <div className="text-xs text-[#A7B8D8]">
                          ID: {lowAtm.atm_id} • {lowAtm.city} / {lowAtm.district}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-[#F2B705]">{lowAtm.cash_level}%</div>
                        <div className="text-xs text-[#A7B8D8]">Nakit Seviyesi</div>
                      </div>
                    </div>

                    {/* Nearby ATMs List */}
                    <div>
                      <div className="text-sm font-semibold text-white mb-3">📍 En Yakın ATM'ler</div>
                      <div className="space-y-2">
                        {lowAtm.nearbyAtms.map((nearby: any, idx: number) => (
                          <div key={nearby.atm_id} className="bg-[#112544] rounded-lg p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-8 h-8 rounded-full bg-[#2E86FF]/20 flex items-center justify-center text-sm font-bold text-[#2E86FF]">
                                {idx + 1}
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-semibold text-white">{nearby.atm_name}</div>
                                <div className="text-xs text-[#A7B8D8]">
                                  ID: {nearby.atm_id} • {nearby.city} / {nearby.district}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-[#2E86FF]">{nearby.distance.toFixed(1)} km</div>
                              <div className="text-xs text-[#A7B8D8]">Mesafe</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Suggestion */}
                    <div className="mt-4 bg-[#10B981]/10 rounded-lg p-3 ring-1 ring-[#10B981]/30">
                      <div className="text-xs text-[#10B981] font-semibold mb-1">💡 Optimizasyon Önerisi</div>
                      <div className="text-xs text-white/80">
                        En yakın ATM {lowAtm.nearbyAtms[0]?.distance.toFixed(1)} km uzaklıkta. 
                        Bu ATM'lerin tek rotada toplanması {(lowAtm.nearbyAtms.reduce((sum: number, a: any) => sum + a.distance, 0) * 0.15).toFixed(0)} dakika tasarruf sağlar.
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Route Map Modal */}
      {showRouteMapModal && selectedRoute && (() => {
        // Grand totals across all ATMs in route
        const allAtms: any[] = selectedRoute.atms || [];
        let grandTRY = 0, grandUSD = 0, grandEUR = 0;
        allAtms.forEach((atm: any) => {
          (atm.cassettes || []).forEach((c: any) => {
            const val = c.denomination * c.quantity;
            if (c.currency === 'TRY') grandTRY += val;
            else if (c.currency === 'USD') grandUSD += val;
            else if (c.currency === 'EUR') grandEUR += val;
          });
        });
        const grandTRYEquiv = grandTRY + grandUSD * USD_RATE + grandEUR * EUR_RATE;

        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
            <div className="bg-[#112544] rounded-2xl w-full ring-2 ring-[#2B416B] flex flex-col" style={{ maxWidth: '1200px', maxHeight: '92vh' }}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#2B416B] bg-[#0E2142]/60 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold">📍 {selectedRoute.cash_center} NM Rotası</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    selectedRoute.operation_type === 'replenishment' ? 'bg-[#10B981]/20 text-[#10B981]' :
                    selectedRoute.operation_type === 'collection' ? 'bg-[#F2B705]/20 text-[#F2B705]' :
                    'bg-[#2E86FF]/20 text-[#2E86FF]'
                  }`}>
                    {selectedRoute.operation_type === 'replenishment' ? 'İkmal' : selectedRoute.operation_type === 'collection' ? 'Para Toplama' : 'Karma'}
                  </span>
                  <span className="text-xs text-[#A7B8D8]">{allAtms.length} ATM</span>
                </div>
                <button onClick={() => { setShowRouteMapModal(false); setExpandedMapAtms(new Set()); }} className="text-[#A7B8D8] hover:text-white text-2xl">&times;</button>
              </div>

              {/* Body: map left + ATM list right */}
              <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Map */}
                <div className="flex-1 min-w-0 p-3">
                  <div className="h-full rounded-xl overflow-hidden ring-1 ring-[#2B416B]" style={{ minHeight: '400px' }}>
                    <RouteMapComponent route={selectedRoute} />
                  </div>
                </div>

                {/* ATM Detail Panel */}
                <div className="w-[420px] flex-shrink-0 flex flex-col border-l border-[#2B416B] overflow-hidden">
                  {/* Summary strip */}
                  <div className="grid grid-cols-3 gap-2 p-3 border-b border-[#2B416B] bg-[#0E2142]/40 flex-shrink-0">
                    <div className="text-center">
                      <div className="text-xs text-[#A7B8D8]">ATM</div>
                      <div className="font-bold text-white">{allAtms.length}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-[#A7B8D8]">Süre</div>
                      <div className="font-bold text-white">{selectedRoute.estimated_time}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-[#A7B8D8]">Verimlilik</div>
                      <div className="font-bold text-[#10B981]">{selectedRoute.efficiency_score}%</div>
                    </div>
                  </div>

                  {/* ATM list */}
                  <div className="flex-1 overflow-y-auto">
                    {allAtms.map((atm: any, idx: number) => {
                      const isExpanded = expandedMapAtms.has(String(atm.atm_id) + idx);
                      const cassettes: any[] = atm.cassettes || [];
                      const atmTRY = cassettes.filter((c: any) => c.currency === 'TRY').reduce((s: number, c: any) => s + c.denomination * c.quantity, 0);
                      const atmUSD = cassettes.filter((c: any) => c.currency === 'USD').reduce((s: number, c: any) => s + c.denomination * c.quantity, 0);
                      const atmEUR = cassettes.filter((c: any) => c.currency === 'EUR').reduce((s: number, c: any) => s + c.denomination * c.quantity, 0);
                      const atmTRYEquiv = atmTRY + atmUSD * USD_RATE + atmEUR * EUR_RATE;

                      return (
                        <div key={String(atm.atm_id) + idx} className={`border-b border-[#2B416B]/40 ${
                          isExpanded ? 'bg-[#0E2142]/60' : 'hover:bg-[#0E2142]/30'
                        }`}>
                          {/* ATM row header */}
                          <div
                            className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
                            onClick={() => setExpandedMapAtms(prev => {
                              const next = new Set(prev);
                              isExpanded ? next.delete(String(atm.atm_id) + idx) : next.add(String(atm.atm_id) + idx);
                              return next;
                            })}
                          >
                            <span className={`text-xs font-bold w-5 text-center transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''} text-[#A7B8D8]`}>▶</span>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              atm.operation === 'ikmal' ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#F2B705]/20 text-[#F2B705]'
                            }`}>{idx + 1}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold truncate">{atm.atm_name || `ATM ${atm.atm_id}`}</div>
                              <div className="text-[10px] text-[#A7B8D8] truncate">{atm.city} / {atm.district}</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {atm.hasFx && <span className="text-[10px] bg-[#F2B705]/20 text-[#F2B705] px-1 rounded mr-1">FX</span>}
                              <div className="text-xs font-bold text-white">₺{atmTRYEquiv.toLocaleString('tr-TR')}</div>
                              {atmUSD > 0 && <div className="text-[10px] text-[#2E86FF]">${atmUSD.toLocaleString('tr-TR')}</div>}
                              {atmEUR > 0 && <div className="text-[10px] text-[#A7B8D8]">€{atmEUR.toLocaleString('tr-TR')}</div>}
                            </div>
                          </div>

                          {/* Cassette detail */}
                          {isExpanded && (
                            <div className="px-3 pb-3">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-[#A7B8D8] border-b border-[#2B416B]/60">
                                    <th className="text-left py-1 font-medium">Kaset</th>
                                    <th className="text-center py-1 font-medium">Para Birimi</th>
                                    <th className="text-center py-1 font-medium">Nominal</th>
                                    <th className="text-center py-1 font-medium">Adet</th>
                                    <th className="text-right py-1 font-medium">Toplam</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cassettes.map((c: any) => (
                                    <tr key={c.id} className="border-b border-[#2B416B]/30 hover:bg-[#112544]/50">
                                      <td className="py-1.5 text-[#A7B8D8]">Kaset {c.id}</td>
                                      <td className="py-1.5 text-center">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                          c.currency === 'TRY' ? 'bg-[#10B981]/20 text-[#10B981]' :
                                          c.currency === 'USD' ? 'bg-[#2E86FF]/20 text-[#2E86FF]' :
                                          'bg-[#A7B8D8]/20 text-[#A7B8D8]'
                                        }`}>{c.currency}</span>
                                      </td>
                                      <td className="py-1.5 text-center font-semibold">
                                        {CURRENCY_SYMBOL[c.currency]}{c.denomination}
                                      </td>
                                      <td className="py-1.5 text-center">{c.quantity.toLocaleString('tr-TR')}</td>
                                      <td className="py-1.5 text-right font-bold">
                                        {CURRENCY_SYMBOL[c.currency]}{(c.denomination * c.quantity).toLocaleString('tr-TR')}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t border-[#2B416B] bg-[#0E2142]/40">
                                    <td colSpan={3} className="py-1.5 text-[#A7B8D8] font-semibold">ATM Toplam</td>
                                    <td className="py-1.5 text-center text-white font-semibold">{cassettes.reduce((s: number, c: any) => s + c.quantity, 0).toLocaleString('tr-TR')}</td>
                                    <td className="py-1.5 text-right">
                                      <div className="font-bold text-white">₺{atmTRY.toLocaleString('tr-TR')}</div>
                                      {atmUSD > 0 && <div className="text-[#2E86FF] font-bold">${atmUSD.toLocaleString('tr-TR')}</div>}
                                      {atmEUR > 0 && <div className="text-[#A7B8D8] font-bold">€{atmEUR.toLocaleString('tr-TR')}</div>}
                                      {(atmUSD > 0 || atmEUR > 0) && (
                                        <div className="text-[10px] text-white/50 mt-0.5">≈ ₺{atmTRYEquiv.toLocaleString('tr-TR')}</div>
                                      )}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Grand Total Footer */}
                  <div className="flex-shrink-0 border-t border-[#2B416B] bg-[#0E2142]/80 p-3">
                    <div className="text-xs text-[#A7B8D8] font-semibold mb-2">🏦 ROTA GENEL TOPLAM</div>
                    <div className="grid grid-cols-2 gap-2">
                      {grandTRY > 0 && (
                        <div className="bg-[#10B981]/10 rounded-lg p-2 ring-1 ring-[#10B981]/30">
                          <div className="text-[10px] text-[#10B981]">TRY</div>
                          <div className="text-sm font-bold text-white">₺{grandTRY.toLocaleString('tr-TR')}</div>
                        </div>
                      )}
                      {grandUSD > 0 && (
                        <div className="bg-[#2E86FF]/10 rounded-lg p-2 ring-1 ring-[#2E86FF]/30">
                          <div className="text-[10px] text-[#2E86FF]">USD</div>
                          <div className="text-sm font-bold text-white">${grandUSD.toLocaleString('tr-TR')}</div>
                        </div>
                      )}
                      {grandEUR > 0 && (
                        <div className="bg-[#A7B8D8]/10 rounded-lg p-2 ring-1 ring-[#A7B8D8]/30">
                          <div className="text-[10px] text-[#A7B8D8]">EUR</div>
                          <div className="text-sm font-bold text-white">€{grandEUR.toLocaleString('tr-TR')}</div>
                        </div>
                      )}
                      <div className="bg-[#F2B705]/10 rounded-lg p-2 ring-1 ring-[#F2B705]/30 col-span-2">
                        <div className="text-[10px] text-[#F2B705]">TRY Karşılığı Genel Toplam</div>
                        <div className="text-base font-bold text-white">₺{grandTRYEquiv.toLocaleString('tr-TR')}</div>
                        {(grandUSD > 0 || grandEUR > 0) && (
                          <div className="text-[10px] text-white/50 mt-0.5">$1 = ₺{USD_RATE} • €1 = ₺{EUR_RATE} kur ile hesaplandı</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Route Work Order Modal (İş Emri Açma) */}
      {showRouteOptimizeModal && selectedRoute && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden ring-2 ring-[#2B416B]">
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B] bg-[#0E2142]/60">
              <div className="text-lg font-semibold">📝 {selectedRoute.cash_center} NM - İş Emri Aç</div>
              <button onClick={() => setShowRouteOptimizeModal(false)} className="text-[#A7B8D8] hover:text-white text-2xl">&times;</button>
            </div>
            
            <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(90vh - 80px)" }}>
              {/* Route Summary */}
              <div className="bg-[#0E2142] rounded-xl p-4 ring-1 ring-[#2B416B] mb-4">
                <div className="text-sm font-semibold mb-3">Rota Bilgileri</div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div><span className="text-[#A7B8D8]">Nakit Merkezi:</span> <span className="font-semibold">{selectedRoute.cash_center}</span></div>
                  <div><span className="text-[#A7B8D8]">ATM Sayısı:</span> <span className="font-semibold">{selectedRoute.atms_count}</span></div>
                  <div><span className="text-[#A7B8D8]">CIT Firması:</span> <span className="font-semibold text-[#10B981]">BANTAŞ</span></div>
                </div>
              </div>

              {/* Work Order Form */}
              <div className="bg-[#10B981]/10 rounded-xl p-4 ring-1 ring-[#10B981]/50 mb-4">
                <div className="text-sm font-semibold text-[#10B981] mb-3">🎯 Yeni İş Emri</div>
                
                <div className="space-y-4">
                  {/* Operation Type */}
                  <div>
                    <label className="text-xs text-[#A7B8D8] mb-2 block">İşlem Tipi *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="px-4 py-3 rounded-lg bg-[#10B981]/20 hover:bg-[#10B981]/30 text-sm font-semibold text-[#10B981] ring-1 ring-[#10B981]/50 transition">
                        💰 İkmal (Replenishment)
                      </button>
                      <button className="px-4 py-3 rounded-lg bg-[#112544] hover:bg-[#1C2E52] text-sm font-semibold text-[#A7B8D8] ring-1 ring-[#2B416B] transition">
                        💵 Para Toplama (Collection)
                      </button>
                    </div>
                  </div>

                  {/* Work Order Type */}
                  <div>
                    <label className="text-xs text-[#A7B8D8] mb-2 block">İş Emri Tipi *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="px-4 py-3 rounded-lg bg-[#2E86FF]/20 hover:bg-[#2E86FF]/30 text-sm font-semibold text-[#2E86FF] ring-1 ring-[#2E86FF]/50 transition">
                        📅 PLANLI
                      </button>
                      <button className="px-4 py-3 rounded-lg bg-[#112544] hover:bg-[#1C2E52] text-sm font-semibold text-[#A7B8D8] ring-1 ring-[#2B416B] transition">
                        🚨 PLANSIZ
                      </button>
                    </div>
                  </div>

                  {/* ATM Selection */}
                  <div>
                    <label className="text-xs text-[#A7B8D8] mb-2 block">ATM Seçimi * ({selectedRoute.atms_count} ATM)</label>
                    <div className="bg-[#112544] rounded-lg p-3 max-h-[200px] overflow-y-auto">
                      <div className="space-y-2">
                        {selectedRoute.atms?.slice(0, 5).map((atm: any, idx: number) => (
                          <label key={atm.atm_id} className="flex items-center gap-3 p-2 hover:bg-[#1C2E52] rounded-lg cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 rounded accent-[#10B981]" defaultChecked />
                            <div className="flex-1">
                              <div className="text-xs font-semibold">ATM {atm.atm_id}</div>
                              <div className="text-xs text-[#A7B8D8]">{atm.city} / {atm.district}</div>
                            </div>
                          </label>
                        ))}
                        {selectedRoute.atms_count > 5 && (
                          <div className="text-xs text-[#A7B8D8] text-center py-2">
                            +{selectedRoute.atms_count - 5} ATM daha...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="text-xs text-[#A7B8D8] mb-2 block">İkmal Tutarı (TRY) *</label>
                    <input 
                      type="text" 
                      placeholder="Örn: 2,500,000"
                      className="w-full px-4 py-3 rounded-lg bg-[#112544] text-white font-semibold ring-1 ring-[#2B416B] focus:ring-[#10B981] outline-none"
                    />
                  </div>

                  {/* Priority & Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#A7B8D8] mb-2 block">Öncelik</label>
                      <select className="w-full px-4 py-3 rounded-lg bg-[#112544] text-white ring-1 ring-[#2B416B] focus:ring-[#10B981] outline-none">
                        <option>Yüksek</option>
                        <option>Orta</option>
                        <option>Düşük</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-[#A7B8D8] mb-2 block">Hedef Tarih</label>
                      <input 
                        type="date" 
                        className="w-full px-4 py-3 rounded-lg bg-[#112544] text-white ring-1 ring-[#2B416B] focus:ring-[#10B981] outline-none"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-xs text-[#A7B8D8] mb-2 block">Notlar (Opsiyonel)</label>
                    <textarea 
                      rows={3}
                      placeholder="İş emri ile ilgili özel notlar..."
                      className="w-full px-4 py-3 rounded-lg bg-[#112544] text-white ring-1 ring-[#2B416B] focus:ring-[#10B981] outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* SLA Info */}
              <div className="bg-[#F2B705]/10 rounded-xl p-4 ring-1 ring-[#F2B705]/50 mb-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">⏱️</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-[#F2B705] mb-1">SLA Bilgisi</div>
                    <div className="text-xs text-white/80">
                      BANTAŞ, açılan PLANLI iş emirlerini <span className="font-semibold text-[#F2B705]">4 saat</span> içinde, 
                      PLANSIZ iş emirlerini <span className="font-semibold text-[#E63946]">2 saat</span> içinde tamamlamakla yükümlüdür.
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button className="flex-1 px-4 py-3 rounded-lg bg-[#10B981] hover:bg-[#0E9F6E] text-white font-semibold transition">
                  ✓ İş Emri Oluştur
                </button>
                <button 
                  onClick={() => setShowRouteOptimizeModal(false)}
                  className="px-4 py-3 rounded-lg bg-[#0E2142] hover:bg-[#1C2E52] text-[#A7B8D8] font-semibold transition ring-1 ring-[#2B416B]"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Route Work Orders Modal (İş Emirleri) */}
      {showRouteDetailsModal && selectedRoute && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden ring-2 ring-[#2B416B]">
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B] bg-[#0E2142]/60">
              <div className="text-lg font-semibold">📋 {selectedRoute.cash_center} NM - İş Emirleri ({selectedRoute.atms.length} ATM)</div>
              <button onClick={() => { setShowRouteDetailsModal(false); setShowAllRouteAtms(false); setExpandedWorkOrderAtms(new Set()); }} className="text-[#A7B8D8] hover:text-white text-2xl">&times;</button>
            </div>
            
            <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(90vh - 80px)" }}>
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8] mb-1">Toplam ATM</div>
                  <div className="text-2xl font-bold text-[#10B981]">{selectedRoute.atms.length}</div>
                  <div className="text-xs text-[#A7B8D8] mt-1">{selectedRoute.day === "today" ? "BUGÜN" : selectedRoute.day === "tomorrow" ? "YARIN" : "İLERİ TARİH"}</div>
                </div>
                <div className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8] mb-1">İkmal ATM</div>
                  <div className="text-2xl font-bold text-[#10B981]">{selectedRoute.atms.filter((a: any) => a.operation === "ikmal").length}</div>
                  <div className="text-xs text-[#A7B8D8] mt-1">REPLENISHMENT</div>
                </div>
                <div className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8] mb-1">Toplama ATM</div>
                  <div className="text-2xl font-bold text-[#F2B705]">{selectedRoute.atms.filter((a: any) => a.operation === "toplama").length}</div>
                  <div className="text-xs text-[#A7B8D8] mt-1">COLLECTION</div>
                </div>
                <div className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8] mb-1">Tahmini Süre</div>
                  <div className="text-2xl font-bold text-[#2E86FF]">{selectedRoute.estimated_time}</div>
                  <div className="text-xs text-[#A7B8D8] mt-1">SÜRE</div>
                </div>
              </div>

              {/* Work Orders List */}
              <div className="bg-[#0E2142] rounded-xl p-4 ring-1 ring-[#2B416B]">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold">ATM Listesi ({selectedRoute.atms.length})</div>
                </div>

                <div className="space-y-2">
                  {(showAllRouteAtms ? selectedRoute.atms : selectedRoute.atms.slice(0, 5)).map((atm: any, idx: number) => {
                    const cassettes: any[] = atm.cassettes || [];
                    const woKey = `wo-${atm.atm_id}`;
                    const isKasetOpen = expandedWorkOrderAtms.has(woKey);
                    const atmTRY = cassettes.filter((c: any) => c.currency === 'TRY').reduce((s: number, c: any) => s + c.denomination * c.quantity, 0);
                    const atmUSD = cassettes.filter((c: any) => c.currency === 'USD').reduce((s: number, c: any) => s + c.denomination * c.quantity, 0);
                    const atmEUR = cassettes.filter((c: any) => c.currency === 'EUR').reduce((s: number, c: any) => s + c.denomination * c.quantity, 0);
                    const atmTRYEquiv = atmTRY + atmUSD * USD_RATE + atmEUR * EUR_RATE;
                    return (
                    <div key={atm.atm_id} className="bg-[#112544] rounded-lg p-3 hover:bg-[#1C2E52] transition">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            atm.operation === "ikmal" ? "bg-[#10B981]/20" : "bg-[#F2B705]/20"
                          }`}>
                            <span className="text-lg">{atm.operation === "ikmal" ? "💰" : "🚛"}</span>
                          </div>
                          <div className={`text-xs font-semibold ${
                            atm.operation === "ikmal" ? "text-[#10B981]" : "text-[#F2B705]"
                          }`}>
                            #{idx + 1}
                          </div>
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <div className="font-semibold text-sm">🏧 {atm.atm_name}</div>
                              <div className="text-xs text-[#A7B8D8] mt-0.5">
                                ATM {atm.atm_id} • {atm.city} / {atm.district}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                                atm.operation === "ikmal" 
                                  ? "bg-[#10B981]/20 text-[#10B981]" 
                                  : "bg-[#F2B705]/20 text-[#F2B705]"
                              }`}>
                                {atm.operation === "ikmal" ? "İkmal" : "Toplama"}
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-3 text-xs">
                            <div>
                              <span className="text-[#A7B8D8]">Tutar:</span>
                              <span className="font-semibold ml-1">{atm.amount}</span>
                            </div>
                            <div>
                              <span className="text-[#A7B8D8]">Konum:</span>
                              <span className="font-semibold ml-1">{atm.location_type || "Offsite"}</span>
                            </div>
                            <div>
                              <span className="text-[#A7B8D8]">Sıra:</span>
                              <span className="font-semibold ml-1">{idx + 1}. Durağı</span>
                            </div>
                          </div>

                          {/* Kaset Detayı — sadece ikmal ATM'leri için */}
                          {atm.operation === "ikmal" && cassettes.length > 0 && (
                            <div className="mt-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedWorkOrderAtms(prev => {
                                    const next = new Set(prev);
                                    isKasetOpen ? next.delete(woKey) : next.add(woKey);
                                    return next;
                                  });
                                }}
                                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#0A1628] hover:bg-[#0E2142] text-xs text-[#A7B8D8] hover:text-white transition ring-1 ring-[#2B416B]/60"
                              >
                                <span className="flex items-center gap-1.5">
                                  <span className={`transition-transform duration-150 ${isKasetOpen ? 'rotate-90' : ''}`}>▶</span>
                                  📦 Kaset Detayı
                                  {atm.hasFx && <span className="px-1 rounded text-[10px] bg-[#F2B705]/20 text-[#F2B705] font-bold">FX</span>}
                                </span>
                                <span className="font-bold text-white">
                                  ₺{atmTRY.toLocaleString('tr-TR')}
                                  {atmUSD > 0 && ` + $${atmUSD.toLocaleString('tr-TR')}`}
                                  {atmEUR > 0 && ` + €${atmEUR.toLocaleString('tr-TR')}`}
                                </span>
                              </button>
                              {isKasetOpen && (
                                <div className="mt-1 bg-[#0A1628] rounded-lg p-2 ring-1 ring-[#2B416B]/40">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-[#A7B8D8] border-b border-[#2B416B]/60">
                                        <th className="text-left py-1 font-medium">Kaset</th>
                                        <th className="text-center py-1 font-medium">Dv.</th>
                                        <th className="text-center py-1 font-medium">Nominal</th>
                                        <th className="text-center py-1 font-medium">Adet</th>
                                        <th className="text-right py-1 font-medium">Toplam</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {cassettes.map((c: any) => (
                                        <tr key={c.id} className="border-b border-[#2B416B]/30">
                                          <td className="py-1.5 text-[#A7B8D8]">#{c.id}</td>
                                          <td className="py-1.5 text-center">
                                            <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                                              c.currency === 'TRY' ? 'bg-[#10B981]/20 text-[#10B981]' :
                                              c.currency === 'USD' ? 'bg-[#2E86FF]/20 text-[#2E86FF]' :
                                              'bg-[#A7B8D8]/20 text-[#A7B8D8]'
                                            }`}>{c.currency}</span>
                                          </td>
                                          <td className="py-1.5 text-center font-semibold">{CURRENCY_SYMBOL[c.currency]}{c.denomination}</td>
                                          <td className="py-1.5 text-center">{c.quantity.toLocaleString('tr-TR')}</td>
                                          <td className="py-1.5 text-right font-bold">{CURRENCY_SYMBOL[c.currency]}{(c.denomination * c.quantity).toLocaleString('tr-TR')}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t border-[#2B416B] bg-[#0E2142]/40">
                                        <td colSpan={3} className="py-1.5 text-[#A7B8D8] font-semibold text-xs">Toplam</td>
                                        <td className="py-1.5 text-center text-white font-semibold">{cassettes.reduce((s: number, c: any) => s + c.quantity, 0)}</td>
                                        <td className="py-1.5 text-right">
                                          {atmTRY > 0 && <div className="font-bold text-white">₺{atmTRY.toLocaleString('tr-TR')}</div>}
                                          {atmUSD > 0 && <div className="font-bold text-[#2E86FF]">${atmUSD.toLocaleString('tr-TR')}</div>}
                                          {atmEUR > 0 && <div className="font-bold text-[#A7B8D8]">€{atmEUR.toLocaleString('tr-TR')}</div>}
                                          {(atmUSD > 0 || atmEUR > 0) && (
                                            <div className="text-[10px] text-white/40 mt-0.5">≈ ₺{atmTRYEquiv.toLocaleString('tr-TR')}</div>
                                          )}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );})}

                  {/* Show more/less button */}
                  {selectedRoute.atms.length > 5 && (
                    <div className="text-center py-2">
                      <button 
                        onClick={() => setShowAllRouteAtms(!showAllRouteAtms)}
                        className="text-xs text-[#2E86FF] hover:text-[#5BA3FF] font-semibold"
                      >
                        {showAllRouteAtms 
                          ? "⬆ Daha az göster" 
                          : `+ ${selectedRoute.atms.length - 5} ATM daha göster`
                        }
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Operation Type Modal (Replenishment/Collection) */}
      {showOperationModal && selectedOperationType && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-[#112544] rounded-2xl w-full max-w-6xl flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B] bg-[#0E2142]/60 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="text-lg font-semibold">
                  {selectedOperationType === "replenishment" ? "💵 İkmal Operasyonları" : "🚛 Para Toplama Operasyonları"}
                </div>
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-[#2E86FF]/20 text-[#2E86FF]">
                  {citRoutes.reduce((sum, r) => {
                    if (r.operation_type !== selectedOperationType) return sum;
                    return sum + r.atms.filter((a: any) => 
                      selectedOperationType === "replenishment" ? a.operation === "ikmal" : a.operation === "toplama"
                    ).length;
                  }, 0)} ATM
                </span>
              </div>
              <button onClick={() => { setShowOperationModal(false); setSelectedOperationType(null); }} className="text-[#A7B8D8] hover:text-white text-2xl">&times;</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {citRoutes
                  .filter(r => r.operation_type === selectedOperationType)
                  .map((route) => {
                    // Filter ATMs based on selected operation type
                    const filteredAtms = route.atms.filter((atm: any) => {
                      if (selectedOperationType === "replenishment") {
                        return atm.operation === "ikmal";
                      } else if (selectedOperationType === "collection") {
                        return atm.operation === "toplama";
                      }
                      return true;
                    });
                    
                    return (
                    <div 
                      key={route.id} 
                      className="bg-[#0E2142] rounded-lg p-4 ring-1 ring-[#2B416B] hover:bg-[#1C2E52] transition"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="font-semibold text-sm">🚚 {route.id}</div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              selectedOperationType === "replenishment" 
                                ? "bg-[#10B981]/20 text-[#10B981]" 
                                : "bg-[#F2B705]/20 text-[#F2B705]"
                            }`}>
                              {selectedOperationType === "replenishment" ? "İkmal" : "Toplama"}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              route.day === "today" ? "bg-[#E63946]/20 text-[#E63946]" :
                              route.day === "tomorrow" ? "bg-[#F2B705]/20 text-[#F2B705]" :
                              "bg-[#2E86FF]/20 text-[#2E86FF]"
                            }`}>
                              {route.day === "today" ? "Bugün" : route.day === "tomorrow" ? "Yarın" : "İleri Tarih"}
                            </span>
                          </div>
                          <div className="text-xs text-[#A7B8D8]">
                            Nakit Merkezi: {route.cash_center}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-white">{filteredAtms.length}</div>
                          <div className="text-xs text-[#A7B8D8]">ATM</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="bg-[#112544] rounded-lg p-2">
                          <div className="text-xs text-[#A7B8D8]">Toplam Mesafe</div>
                          <div className="text-sm font-bold text-white mt-1">{((filteredAtms.length * 8) + Math.random() * 10).toFixed(1)} km</div>
                        </div>
                        <div className="bg-[#112544] rounded-lg p-2">
                          <div className="text-xs text-[#A7B8D8]">Tahmini Süre</div>
                          <div className="text-sm font-bold text-white mt-1">{route.estimated_time}</div>
                        </div>
                        <div className="bg-[#112544] rounded-lg p-2">
                          <div className="text-xs text-[#A7B8D8]">Durum</div>
                          <div className="text-sm font-bold text-[#2E86FF] mt-1">{route.status === "in-progress" ? "Devam Ediyor" : "Planlı"}</div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setSelectedRoute({...route, atms: filteredAtms});
                            setShowRouteMapModal(true);
                          }}
                          className="flex-1 px-3 py-2 rounded-lg bg-[#2E86FF]/20 hover:bg-[#2E86FF]/30 text-xs text-[#2E86FF] font-semibold transition ring-1 ring-[#2E86FF]/50"
                        >
                          🗺️ Haritada Göster
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedRoute({...route, atms: filteredAtms});
                            setShowRouteDetailsModal(true);
                          }}
                          className="flex-1 px-3 py-2 rounded-lg bg-[#10B981]/20 hover:bg-[#10B981]/30 text-xs text-[#10B981] font-semibold transition ring-1 ring-[#10B981]/50"
                        >
                          📋 Detaylar
                        </button>
                      </div>

                      {/* ATM List Preview */}
                      <div className="mt-3 pt-3 border-t border-[#2B416B]">
                        <div className="text-xs text-[#A7B8D8] mb-2">Rotadaki ATM'ler:</div>
                        <div className="grid grid-cols-2 gap-2">
                          {filteredAtms.slice(0, 4).map((atm: any) => (
                            <div key={atm.atm_id} className="text-xs bg-[#112544] rounded px-2 py-1">
                              🏧 {atm.atm_name}
                            </div>
                          ))}
                          {filteredAtms.length > 4 && (
                            <div className="text-xs text-[#A7B8D8] px-2 py-1">
                              +{filteredAtms.length - 4} ATM daha...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All NM SLA Compliance Modal */}
      {showAllNmSlaModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-7xl flex flex-col" style={{ maxHeight: '85vh' }}>
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B] bg-[#0E2142]/60 flex-shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-lg font-semibold">🎯 Tüm NM Merkezi SLA Uyum Skorları</div>
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-[#2E86FF]/20 text-white">
                  {allCashCenterGroups.length} NM
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={slaDateStart}
                    onChange={(e) => setSlaDateStart(e.target.value)}
                    max={slaDateEnd}
                    className="px-2 py-1 text-xs rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                  />
                  <span className="text-white/50 text-xs">-</span>
                  <input
                    type="date"
                    value={slaDateEnd}
                    onChange={(e) => setSlaDateEnd(e.target.value)}
                    min={slaDateStart}
                    max="2026-02-04"
                    className="px-2 py-1 text-xs rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                  />
                </div>
                <button
                  onClick={() => {
                    const formatDate = (dateStr: string) => {
                      const d = new Date(dateStr);
                      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
                    };
                    const dateRangeLabel = `${formatDate(slaDateStart)} - ${formatDate(slaDateEnd)}`;
                    const daysDiff = Math.floor((new Date(slaDateEnd).getTime() - new Date(slaDateStart).getTime()) / (1000 * 60 * 60 * 24));
                    const daysFromCurrent = Math.floor((new Date("2026-02-04").getTime() - new Date(slaDateEnd).getTime()) / (1000 * 60 * 60 * 24));
                    
                    const data = allCashCenterGroups
                      .map(([nm, atms]) => {
                        const baseScore = 75 + (Math.abs(nm.charCodeAt(0) * 17) % 20);
                        const rangeFactor = daysDiff > 60 ? 2 : daysDiff > 30 ? 1 : 0.5;
                        const slaScore = Math.min(99, Math.max(65, baseScore - (daysFromCurrent * 0.05) + (rangeFactor * 0.5)));
                        return { nm, atms, slaScore };
                      })
                      .sort((a, b) => b.slaScore - a.slaScore);
                    
                    // Create CSV content
                    let csvContent = `NM Merkezi SLA Uyum Raporu\nTarih Aralığı: ${dateRangeLabel}\nRapor Süresi: ${daysDiff + 1} Gün\n\n`;
                    csvContent += "Sıra,NM Merkezi,SLA Skoru (%),Toplam ATM,Offsite ATM,Durum\n";
                    
                    data.forEach(({ nm, atms, slaScore }, index) => {
                      const offsiteCount = atms.filter((a: any) => a.location_type === "Offsite").length;
                      const status = slaScore >= 90 ? "Mükemmel" : slaScore >= 70 ? "İyi" : "Düşük";
                      csvContent += `${index + 1},"${nm}",${slaScore.toFixed(1)},${atms.length},${offsiteCount},${status}\n`;
                    });
                    
                    // Create and download file
                    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement("a");
                    const url = URL.createObjectURL(blob);
                    link.setAttribute("href", url);
                    const fileName = `NM_SLA_Raporu_${slaDateStart}_${slaDateEnd}.csv`;
                    link.setAttribute("download", fileName);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-3 py-1 text-xs rounded-lg font-semibold bg-[#10B981] text-white hover:bg-[#10B981]/80 transition flex items-center gap-1"
                >
                  <span>📊</span> Excel İndir
                </button>
              </div>
              <button onClick={() => setShowAllNmSlaModal(false)} className="text-[#A7B8D8] hover:text-white text-2xl">&times;</button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {allCashCenterGroups
                  .map(([nm, atms]) => {
                    // Mock SLA compliance calculation based on NM characteristics and date range
                    const daysDiff = Math.floor((new Date(slaDateEnd).getTime() - new Date(slaDateStart).getTime()) / (1000 * 60 * 60 * 24));
                    const daysFromCurrent = Math.floor((new Date("2026-02-04").getTime() - new Date(slaDateEnd).getTime()) / (1000 * 60 * 60 * 24));
                    const baseScore = 75 + (Math.abs(nm.charCodeAt(0) * 17) % 20);
                    // Slightly lower scores for past dates, slightly varied by range length
                    const rangeFactor = daysDiff > 60 ? 2 : daysDiff > 30 ? 1 : 0.5;
                    const slaScore = Math.min(99, Math.max(65, baseScore - (daysFromCurrent * 0.05) + (rangeFactor * 0.5)));
                    return { nm, atms, slaScore };
                  })
                  .sort((a, b) => b.slaScore - a.slaScore) // En iyiden en kötüye sırala
                  .map(({ nm, atms, slaScore }) => {
                    const barColor = slaScore >= 90 ? "#10B981" : slaScore >= 70 ? "#F2B705" : "#E63946";
                    
                    return (
                      <div key={nm} className="bg-[#0E2142]/60 rounded-lg p-4 ring-1 ring-[#2B416B]">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-semibold text-white truncate max-w-[180px]" title={nm}>
                            {nm}
                          </span>
                          <span className="text-lg font-bold" style={{ color: barColor }}>
                            {slaScore}%
                          </span>
                        </div>
                        <div className="h-2.5 w-full bg-[#112544] rounded-full overflow-hidden mb-3">
                          <div 
                            className="h-2.5 rounded-full transition-all duration-500"
                            style={{ 
                              width: `${slaScore}%`,
                              backgroundColor: barColor
                            }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-xs text-white/60">
                          <span>{atms.length} ATM</span>
                          <span>{atms.filter((a: any) => a.location_type === "Offsite").length} Offsite</span>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NM SLA Compliance Table - Moved to bottom */}
      <div className="bg-[#0E2142]/60 rounded-xl p-5 ring-1 ring-[#2B416B] mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-sm font-semibold text-white">🎯 NM Merkezi SLA Uyum Skorları (En İyi 5)</div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={slaDateStart}
                onChange={(e) => setSlaDateStart(e.target.value)}
                max={slaDateEnd}
                className="px-2 py-1 text-xs rounded-lg bg-[#112544] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
              />
              <span className="text-white/50 text-xs">-</span>
              <input
                type="date"
                value={slaDateEnd}
                onChange={(e) => setSlaDateEnd(e.target.value)}
                min={slaDateStart}
                max="2026-02-04"
                className="px-2 py-1 text-xs rounded-lg bg-[#112544] text-white border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setSlaDateStart("2026-02-01");
                  setSlaDateEnd("2026-02-04");
                }}
                className="px-2 py-1 text-xs rounded bg-[#112544] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
              >
                Bu Ay
              </button>
              <button
                onClick={() => {
                  setSlaDateStart("2026-01-01");
                  setSlaDateEnd("2026-01-31");
                }}
                className="px-2 py-1 text-xs rounded bg-[#112544] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
              >
                Geçen Ay
              </button>
              <button
                onClick={() => {
                  setSlaDateStart("2025-11-01");
                  setSlaDateEnd("2026-02-04");
                }}
                className="px-2 py-1 text-xs rounded bg-[#112544] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
              >
                Son 3 Ay
              </button>
              <button
                onClick={() => {
                  setSlaDateStart("2025-08-01");
                  setSlaDateEnd("2026-02-04");
                }}
                className="px-2 py-1 text-xs rounded bg-[#112544] text-white/70 hover:text-white border border-[#2B416B] hover:border-[#2E86FF] transition"
              >
                Son 6 Ay
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-[#A7B8D8]">
              <span className="text-[#10B981]">●</span> ≥90% 
              <span className="ml-2 text-[#F2B705]">●</span> 70-89% 
              <span className="ml-2 text-[#E63946]">●</span> &lt;70%
            </div>
            <button
              onClick={() => setShowAllNmSlaModal(true)}
              className="px-3 py-1 text-xs rounded-lg font-semibold bg-[#2E86FF] text-white hover:bg-[#2E86FF]/80 transition"
            >
              Tümünü Gör ({allCashCenterGroups.length})
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {allCashCenterGroups
            .map(([nm, atms]) => {
              // Mock SLA compliance calculation based on NM characteristics and date range
              const daysDiff = Math.floor((new Date(slaDateEnd).getTime() - new Date(slaDateStart).getTime()) / (1000 * 60 * 60 * 24));
              const daysFromCurrent = Math.floor((new Date("2026-02-04").getTime() - new Date(slaDateEnd).getTime()) / (1000 * 60 * 60 * 24));
              const baseScore = 75 + (Math.abs(nm.charCodeAt(0) * 17) % 20);
              // Slightly lower scores for past dates, slightly varied by range length
              const rangeFactor = daysDiff > 60 ? 2 : daysDiff > 30 ? 1 : 0.5;
              const slaScore = Math.min(99, Math.max(65, baseScore - (daysFromCurrent * 0.05) + (rangeFactor * 0.5)));
              return { nm, atms, slaScore };
            })
            .sort((a, b) => b.slaScore - a.slaScore) // En iyiden en kötüye sırala
            .slice(0, 5) // İlk 5 (en iyi 5)
            .map(({ nm, atms, slaScore }) => {
              const barColor = slaScore >= 90 ? "#10B981" : slaScore >= 70 ? "#F2B705" : "#E63946";
              
              return (
                <div key={nm} className="bg-[#112544]/50 rounded-lg p-3 ring-1 ring-[#2B416B]/30">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-white truncate max-w-[140px]" title={nm}>
                      {nm}
                    </span>
                    <span className="text-sm font-bold" style={{ color: barColor }}>
                      {slaScore}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#0E2142] rounded-full overflow-hidden">
                    <div 
                      className="h-2 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${slaScore}%`,
                        backgroundColor: barColor
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-2 text-[10px] text-white/50">
                    <span>{atms.length} ATM</span>
                    <span>{atms.filter((a: any) => a.location_type === "Offsite").length} Offsite</span>
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>

      {/* SLA Contract Information Panel */}
      <div className="bg-gradient-to-r from-[#2E86FF]/10 to-[#8B5CF6]/10 rounded-xl p-4 ring-1 ring-[#2E86FF]/30 mb-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">📋</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-sm font-bold text-white">Sözleşme SLA Süreleri (Bölge Bazlı)</div>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#2E86FF]/20 text-white">Aktif</span>
            </div>
            <div className="text-xs text-white/80 mb-3">
              İkmal ve Para Toplama operasyonları için bölge bazında tanımlı SLA süreleri aşağıdaki gibidir:
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-[#0E2142]/60 rounded-lg p-3 ring-1 ring-[#2B416B]">
                <div className="text-xs text-[#A7B8D8] mb-1">Zone 1</div>
                <div className="text-xs font-bold text-[#10B981]">Planlı: 9 saat</div>
                <div className="text-xs font-bold text-[#F59E0B]">Plansız: 3 saat</div>
              </div>
              <div className="bg-[#0E2142]/60 rounded-lg p-3 ring-1 ring-[#2B416B]">
                <div className="text-xs text-[#A7B8D8] mb-1">Zone 2</div>
                <div className="text-xs font-bold text-[#10B981]">Planlı: 9.5 saat</div>
                <div className="text-xs font-bold text-[#F59E0B]">Plansız: 5 saat</div>
              </div>
              <div className="bg-[#0E2142]/60 rounded-lg p-3 ring-1 ring-[#2B416B]">
                <div className="text-xs text-[#A7B8D8] mb-1">Zone 3</div>
                <div className="text-xs font-bold text-[#10B981]">Planlı: 10 saat</div>
                <div className="text-xs font-bold text-[#F59E0B]">Plansız: 5 saat</div>
              </div>
              <div className="bg-[#0E2142]/60 rounded-lg p-3 ring-1 ring-[#2B416B]">
                <div className="text-xs text-[#A7B8D8] mb-1">Zone 4</div>
                <div className="text-xs font-bold text-[#10B981]">Planlı: 10 saat</div>
                <div className="text-xs font-bold text-[#F59E0B]">Plansız: 5 saat</div>
              </div>
              <div className="bg-[#0E2142]/60 rounded-lg p-3 ring-1 ring-[#2B416B]">
                <div className="text-xs text-[#A7B8D8] mb-1">Zone 5</div>
                <div className="text-xs font-bold text-[#10B981]">Planlı: 10 saat</div>
                <div className="text-xs font-bold text-[#F59E0B]">Plansız: 5 saat</div>
              </div>
              <div className="bg-[#0E2142]/60 rounded-lg p-3 ring-1 ring-[#2B416B]">
                <div className="text-xs text-[#A7B8D8] mb-1">Zone 12</div>
                <div className="text-xs font-bold text-[#10B981]">Planlı: 10 saat</div>
                <div className="text-xs font-bold text-[#F59E0B]">Plansız: 5 saat</div>
              </div>
            </div>
            <div className="text-xs text-white/60 mt-3">
              💡 Bu süreler sözleşmede belirtilen maksimum müdahale süreleridir. SLA aşımları operasyonel performans raporlarına yansır.
            </div>
          </div>
        </div>
      </div>

      {/* Operation ATMs Map Modal */}
      {showOperationMapModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden ring-2 ring-[#2B416B]">
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B] bg-[#0E2142]/60">
              <div className="text-lg font-semibold">
                📍 {operationAtms[0]?.operation === "ikmal" ? "İkmal Operasyonu" : "Para Toplama"} - ATM Haritası ({operationAtms.length} ATM)
              </div>
              <button onClick={() => setShowOperationMapModal(false)} className="text-[#A7B8D8] hover:text-white text-2xl">&times;</button>
            </div>
            
            <div className="p-4">
              <div className="h-[600px] w-full rounded-xl overflow-hidden ring-1 ring-[#2B416B]">
                <RouteMapComponent route={{
                  cash_center: operationAtms[0]?.operation === "ikmal" ? "İkmal Operasyonu" : "Para Toplama",
                  atms: operationAtms,
                  atms_count: operationAtms.length,
                  efficiency_score: 0
                }} />
              </div>
              
              <div className="mt-4 grid grid-cols-4 gap-3">
                <div className="bg-[#0E2142] rounded-lg p-3 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8]">Operasyon Tipi</div>
                  <div className="text-sm font-bold mt-1">{operationAtms[0]?.operation === "ikmal" ? "İkmal" : "Toplama"}</div>
                </div>
                <div className="bg-[#0E2142] rounded-lg p-3 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8]">ATM Sayısı</div>
                  <div className="text-sm font-bold mt-1">{operationAtms.length}</div>
                </div>
                <div className="bg-[#0E2142] rounded-lg p-3 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8]">Tarih Aralığı</div>
                  <div className="text-sm font-bold mt-1">{operationDateStart} - {operationDateEnd}</div>
                </div>
                <div className="bg-[#0E2142] rounded-lg p-3 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8]">Durum</div>
                  <div className="text-sm font-bold mt-1 text-[#10B981]">Planlandı</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Remaining Routes Modal - Kalan İşler */}
      {showRemainingRoutesModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col ring-2 ring-[#2B416B]">
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B] bg-[#0E2142]/60 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="text-lg font-semibold">⏳ Kalan İşler</div>
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-[#F2B705]/20 text-[#F2B705]">
                  {remainingRoutesData.length} Rota
                </span>
                {selectedCashCenter && (
                  <span className="px-3 py-1 rounded-full text-sm font-semibold bg-[#2E86FF]/20 text-white">
                    🏦 {selectedCashCenter}
                  </span>
                )}
              </div>
              <button onClick={() => setShowRemainingRoutesModal(false)} className="text-[#A7B8D8] hover:text-white text-2xl">&times;</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {remainingRoutesData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="text-6xl mb-4">🎉</div>
                  <div className="text-xl font-bold text-white mb-2">Tüm İşler Tamamlandı!</div>
                  <div className="text-sm text-[#A7B8D8]">Bu nakit merkezi için kalan iş bulunmamaktadır.</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {remainingRoutesData.map((route: any, index: number) => {
                    const dayLabel = route.day === "today" ? "Bugün" : route.day === "tomorrow" ? "Yarın" : "2 Gün Sonra";
                    const operationColor = route.operation_type === "replenishment" ? "#10B981" : route.operation_type === "collection" ? "#F2B705" : "#2E86FF";
                    const operationIcon = route.operation_type === "replenishment" ? "📦" : route.operation_type === "collection" ? "🚛" : "🔄";
                    const operationLabel = route.operation_type === "replenishment" ? "İkmal" : route.operation_type === "collection" ? "Toplama" : "Karma";
                    
                    return (
                      <div key={route.id} className="bg-[#0E2142]/60 rounded-xl p-5 ring-1 ring-[#2B416B] hover:ring-[#2E86FF] transition">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-start gap-3">
                            <div className="text-2xl">{operationIcon}</div>
                            <div>
                              <div className="text-sm font-bold text-white mb-1">{route.name}</div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: `${operationColor}20`, color: operationColor }}>
                                  {operationLabel}
                                </span>
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#2E86FF]/20 text-[#2E86FF]">
                                  {dayLabel}
                                </span>
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#F2B705]/20 text-[#F2B705]">
                                  {route.status === "planned" ? "Planlandı" : "Devam Ediyor"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-[#A7B8D8]">İlerleme</div>
                            <div className="text-xl font-bold" style={{ color: operationColor }}>{route.progress}%</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                          <div className="bg-[#112544] rounded-lg p-3">
                            <div className="text-xs text-[#A7B8D8]">ATM Sayısı</div>
                            <div className="text-sm font-bold mt-1">{route.atms_count}</div>
                          </div>
                          <div className="bg-[#112544] rounded-lg p-3">
                            <div className="text-xs text-[#A7B8D8]">Tamamlanan</div>
                            <div className="text-sm font-bold mt-1 text-[#10B981]">{route.completed}/{route.atms_count}</div>
                          </div>
                          <div className="bg-[#112544] rounded-lg p-3">
                            <div className="text-xs text-[#A7B8D8]">Tahmini Süre</div>
                            <div className="text-sm font-bold mt-1">{route.estimated_time}</div>
                          </div>
                          <div className="bg-[#112544] rounded-lg p-3">
                            <div className="text-xs text-[#A7B8D8]">Verimlilik</div>
                            <div className="text-sm font-bold mt-1 text-[#10B981]">{route.efficiency_score}%</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex-1">
                            <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                              <div 
                                className="h-2 rounded-full transition-all duration-500"
                                style={{ 
                                  width: `${route.progress}%`,
                                  backgroundColor: operationColor
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-[#A7B8D8]">🚐 Araç:</span>
                            <span className="text-white font-semibold">{route.vehicle}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[#A7B8D8]">👥 Ekip:</span>
                            <span className="text-white font-semibold">{route.team}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[#A7B8D8]">🏢 Firma:</span>
                            <span className="text-white font-semibold">{route.cit_company}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Tam Ekran Heat Map Modal */}
      {fullscreenHeatMap && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2B416B] bg-[#0A1628]">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">
                {heatMapView === "low_cash" ? "🔴 Düşük Nakit ATM Isı Haritası - Tam Ekran" : "🟢 Yüksek Nakit ATM Isı Haritası - Tam Ekran"}
              </h2>
              <div className="text-sm text-[#A7B8D8]">
                {heatMapView === "low_cash" ? lowCashAtms.length : highCashAtms.length} ATM
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* View Toggle */}
              <div className="flex items-center gap-1 bg-[#0E2142] rounded-lg p-1">
                <button
                  onClick={() => setHeatMapView("low_cash")}
                  className={`px-3 py-1.5 rounded text-sm font-semibold transition ${
                    heatMapView === "low_cash"
                      ? "bg-[#EF4444] text-white"
                      : "bg-transparent text-[#A7B8D8] hover:text-white"
                  }`}
                >
                  🔴 İkmal
                </button>
                <button
                  onClick={() => setHeatMapView("high_cash")}
                  className={`px-3 py-1.5 rounded text-sm font-semibold transition ${
                    heatMapView === "high_cash"
                      ? "bg-[#10B981] text-white"
                      : "bg-transparent text-[#A7B8D8] hover:text-white"
                  }`}
                >
                  🟢 Para Toplama
                </button>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-sm">
                {heatMapView === "low_cash" ? (
                  <>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#E63946]/20">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: "#E63946" }} />
                      <span className="text-white">Kritik (&lt;20%)</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#F59E0B]/20">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: "#F59E0B" }} />
                      <span className="text-white">Düşük (20-30%)</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#10B981]/20">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: "#10B981" }} />
                      <span className="text-white">Normal (&gt;30%)</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#E63946]/20">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: "#E63946" }} />
                      <span className="text-white">Kritik (≥90%) — Yatırmaya Kapandı</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#F59E0B]/20">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: "#F59E0B" }} />
                      <span className="text-white">Yüksek (85-90%) — Toplama Planla</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#10B981]/20">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: "#10B981" }} />
                      <span className="text-white">Normal (&lt;85%)</span>
                    </div>
                  </>
                )}
              </div>
              
              <button
                onClick={() => setFullscreenHeatMap(false)}
                className="px-4 py-2 bg-[#E63946] hover:bg-[#D62839] text-white font-semibold rounded-lg transition flex items-center gap-2"
              >
                ✕ Kapat
              </button>
            </div>
          </div>
          
          {/* Map - Full Height with proper key to force re-render */}
          <div className="flex-1 w-full" style={{ height: 'calc(100vh - 73px)' }}>
            <HeatMapComponent 
              key={`fullscreen-${heatMapView}`} 
              lowCashAtms={heatMapView === "low_cash" ? lowCashAtms : highCashAtms}
              isHighCash={heatMapView === "high_cash"}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Dynamically imported HeatMap component
const HeatMapComponent = dynamic(
  () => import("./HeatMap"),
  { ssr: false }
);

// Dynamically imported RouteMap component
const RouteMapComponent = dynamic(
  () => import("./RouteMap"),
  { ssr: false }
);

// CIT Pattern Analysis Component (Collapsible)
function CITPatternAnalysis() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dateStart, setDateStart] = useState('2025-11-13');
  const [dateEnd, setDateEnd] = useState('2026-02-11');

  // Gerçek ATM verilerinden top 20 seçiyoruz
  const topATMs = useMemo(() => {
    // Rastgele CIT sayıları üret (simülasyon için)
    const getRandomCount = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    
    // ATM master data'dan ilk 20 aktif ATM'yi al
    return atmMasterData
      .filter((atm: any) => atm.active)
      .slice(0, 20)
      .map((atm: any) => {
        const replenishments = getRandomCount(35, 42);
        const collections = getRandomCount(30, 40);
        return {
          id: atm.atm_id,
          name: atm.atm_name,
          city: atm.city,
          district: atm.district,
          cashCenter: atm.cash_center || 'Merkezi Nakit',
          replenishments,
          collections,
          total: replenishments + collections
        };
      })
      .sort((a: any, b: any) => b.total - a.total); // Toplam sayıya göre sırala
  }, []);

  // Excel Export Function
  const exportToExcel = () => {
    const csvContent = '\uFEFFCIT Kayıt Pattern Analizi\n' +
      `Tarih Aralığı: ${dateStart} - ${dateEnd}\n\n` +
      'Sıra,ATM ID,ATM Adı,İl,İlçe,Nakit Merkezi,İkmal Sayısı,Para Toplama Sayısı,Toplam İşlem\n' +
      topATMs.map((atm, idx) => 
        `${idx + 1},${atm.id},${atm.name},${atm.city},${atm.district},${atm.cashCenter},${atm.replenishments},${atm.collections},${atm.total}`
      ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `CIT_Pattern_Analysis_${dateStart}_${dateEnd}.csv`;
    link.click();
  };

  return (
    <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
      {/* Header - Always Visible */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:bg-[#1a2f54] rounded-lg p-2 transition-all flex-1"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="text-2xl">{isExpanded ? '📂' : '📁'}</div>
          <div>
            <div className="text-sm text-white font-semibold">🔄 CIT Kayıt Pattern Analizi</div>
            <div className="text-xs text-[#A7B8D8] mt-1">
              En fazla para toplama/ikmal yapılan ATM'ler
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
            <div className="col-span-1 text-center">İkmal</div>
            <div className="col-span-1 text-center">Toplama</div>
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
                <div className="px-2 py-1 rounded bg-[#10B981]/20 text-[#10B981] font-bold text-xs">
                  {atm.replenishments}
                </div>
              </div>
              <div className="col-span-1 flex items-center justify-center">
                <div className="px-2 py-1 rounded bg-[#F59E0B]/20 text-[#F59E0B] font-bold text-xs">
                  {atm.collections}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Planlı vs Plansız İkmal & Para Toplama Trend Chart Component (Collapsible)
function PlannedUnplannedCashOperationsChart() {
  const [isExpanded, setIsExpanded] = useState(false);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [dateStart, setDateStart] = useState(currentMonth);
  const [dateEnd, setDateEnd] = useState(currentMonth);
  const [selectedTab, setSelectedTab] = useState<'ikmal' | 'toplama'>('ikmal');

  // Mock data - gerçek uygulamada API'den gelecek
  const allMonthsData: Record<string, { plannedRepl: number; unplannedRepl: number; plannedColl: number; unplannedColl: number }> = {
    '2025-12': { plannedRepl: 62, unplannedRepl: 22, plannedColl: 55, unplannedColl: 14 },
    '2026-01': { plannedRepl: 58, unplannedRepl: 25, plannedColl: 52, unplannedColl: 18 },
    '2026-02': { plannedRepl: 64, unplannedRepl: 20, plannedColl: 58, unplannedColl: 12 },
  };

  // Seçilen tarih aralığındaki veriyi hesapla
  const calculateRangeData = () => {
    const start = new Date(dateStart);
    const end = new Date(dateEnd);
    let totalPlannedRepl = 0;
    let totalUnplannedRepl = 0;
    let totalPlannedColl = 0;
    let totalUnplannedColl = 0;
    
    for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
      const monthKey = d.toISOString().slice(0, 7);
      const monthData = allMonthsData[monthKey];
      if (monthData) {
        totalPlannedRepl += monthData.plannedRepl;
        totalUnplannedRepl += monthData.unplannedRepl;
        totalPlannedColl += monthData.plannedColl;
        totalUnplannedColl += monthData.unplannedColl;
      }
    }
    return { totalPlannedRepl, totalUnplannedRepl, totalPlannedColl, totalUnplannedColl };
  };

  const { totalPlannedRepl, totalUnplannedRepl, totalPlannedColl, totalUnplannedColl } = calculateRangeData();

  // Önceki dönem hesaplama
  const calculatePreviousPeriod = () => {
    const start = new Date(dateStart);
    const end = new Date(dateEnd);
    const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    
    const prevEnd = new Date(start);
    prevEnd.setDate(0);
    const prevStart = new Date(prevEnd);
    prevStart.setMonth(prevStart.getMonth() - diffMonths);
    
    let prevPlannedRepl = 0;
    let prevUnplannedRepl = 0;
    let prevPlannedColl = 0;
    let prevUnplannedColl = 0;
    
    for (let d = new Date(prevStart); d <= prevEnd; d.setMonth(d.getMonth() + 1)) {
      const monthKey = d.toISOString().slice(0, 7);
      const monthData = allMonthsData[monthKey];
      if (monthData) {
        prevPlannedRepl += monthData.plannedRepl;
        prevUnplannedRepl += monthData.unplannedRepl;
        prevPlannedColl += monthData.plannedColl;
        prevUnplannedColl += monthData.unplannedColl;
      }
    }
    return { prevPlannedRepl, prevUnplannedRepl, prevPlannedColl, prevUnplannedColl };
  };

  const { prevPlannedRepl, prevUnplannedRepl, prevPlannedColl, prevUnplannedColl } = calculatePreviousPeriod();
  
  // Trend hesaplamaları
  const plannedReplTrend = prevPlannedRepl > 0 ? ((totalPlannedRepl - prevPlannedRepl) / prevPlannedRepl * 100).toFixed(1) : 0;
  const unplannedReplTrend = prevUnplannedRepl > 0 ? ((totalUnplannedRepl - prevUnplannedRepl) / prevUnplannedRepl * 100).toFixed(1) : 0;
  const plannedCollTrend = prevPlannedColl > 0 ? ((totalPlannedColl - prevPlannedColl) / prevPlannedColl * 100).toFixed(1) : 0;
  const unplannedCollTrend = prevUnplannedColl > 0 ? ((totalUnplannedColl - prevUnplannedColl) / prevUnplannedColl * 100).toFixed(1) : 0;

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

  // Excel Export Function
  const exportToExcel = () => {
    const csvContent = '\uFEFFPlanlı vs Plansız İkmal & Para Toplama Trendi\n' +
      `Dönem: ${displayPeriod}\n\n` +
      'Metrik,Mevcut Dönem,Önceki Dönem,Değişim (%)\n' +
      `Planlı İkmal,${totalPlannedRepl},${prevPlannedRepl},${plannedReplTrend}%\n` +
      `Plansız İkmal,${totalUnplannedRepl},${prevUnplannedRepl},${unplannedReplTrend}%\n` +
      `Planlı Para Toplama,${totalPlannedColl},${prevPlannedColl},${plannedCollTrend}%\n` +
      `Plansız Para Toplama,${totalUnplannedColl},${prevUnplannedColl},${unplannedCollTrend}%\n` +
      `\nPlansız İkmal Oranı,%${((totalUnplannedRepl / (totalPlannedRepl + totalUnplannedRepl)) * 100).toFixed(1)}\n` +
      `Plansız Para Toplama Oranı,%${((totalUnplannedColl / (totalPlannedColl + totalUnplannedColl)) * 100).toFixed(1)}`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Planned_Unplanned_Cash_Operations_${displayPeriod.replace(/\s/g, '_')}.csv`;
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
            <div className="text-sm text-white font-semibold">💰 Planlı vs Plansız Nakit Operasyonları <span className="text-xs font-normal text-[#A7B8D8]">(Aylık)</span></div>
            <div className="text-xs text-[#A7B8D8] mt-1">{displayPeriod} dönemi operasyonları</div>
          </div>
          <div className="text-[#A7B8D8] text-xl transition-transform ml-auto" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-[#10B981]"></div>
              <span className="text-xs text-[#A7B8D8]">İkmal: {totalPlannedRepl + totalUnplannedRepl}</span>
            </div>
            <div className={`text-xs font-semibold mt-0.5 ${Number(unplannedReplTrend) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
              {Number(unplannedReplTrend) >= 0 ? '↗' : '↘'} {Math.abs(Number(unplannedReplTrend))}%
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-[#F59E0B]"></div>
              <span className="text-xs text-[#A7B8D8]">Toplama: {totalPlannedColl + totalUnplannedColl}</span>
            </div>
            <div className={`text-xs font-semibold mt-0.5 ${Number(unplannedCollTrend) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
              {Number(unplannedCollTrend) >= 0 ? '↗' : '↘'} {Math.abs(Number(unplannedCollTrend))}%
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="flex items-center gap-2 flex-wrap mb-3 px-2">
          <div className="flex items-center gap-1 mr-3">
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedTab('ikmal'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedTab === 'ikmal' ? 'bg-[#10B981] text-white' : 'bg-[#0E2142] text-[#A7B8D8] hover:bg-[#1a2f54]'
              }`}
            >
              📦 İkmal
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedTab('toplama'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedTab === 'toplama' ? 'bg-[#F59E0B] text-white' : 'bg-[#0E2142] text-[#A7B8D8] hover:bg-[#1a2f54]'
              }`}
            >
              💵 Para Toplama
            </button>
          </div>

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
              max="2026-02-18"
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
            {selectedTab === 'ikmal' ? (
              <>
                <div className="bg-[#10B981]/10 rounded-lg p-4 border border-[#10B981]/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-[#10B981]"></div>
                      <span className="text-sm font-semibold text-white">Planlı İkmal</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className={`text-xs font-semibold ${Number(plannedReplTrend) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {Number(plannedReplTrend) >= 0 ? '↗' : '↘'} {Math.abs(Number(plannedReplTrend))}%
                      </div>
                      <div className="text-[10px] text-gray-500">önceki döneme göre</div>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-[#10B981]">{totalPlannedRepl}</div>
                  <div className="text-xs text-[#A7B8D8] mt-1">{displayPeriod}</div>
                  <div className="text-xs text-gray-400 mt-2">Önceki dönem: {prevPlannedRepl} adet</div>
                </div>
                
                <div className="bg-[#EF4444]/10 rounded-lg p-4 border border-[#EF4444]/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-[#EF4444]"></div>
                      <span className="text-sm font-semibold text-white">Plansız İkmal</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className={`text-xs font-semibold ${Number(unplannedReplTrend) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {Number(unplannedReplTrend) >= 0 ? '↗' : '↘'} {Math.abs(Number(unplannedReplTrend))}%
                      </div>
                      <div className="text-[10px] text-gray-500">önceki döneme göre</div>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-[#EF4444]">{totalUnplannedRepl}</div>
                  <div className="text-xs text-[#A7B8D8] mt-1">{displayPeriod}</div>
                  <div className="text-xs text-gray-400 mt-2">Önceki dönem: {prevUnplannedRepl} adet</div>
                </div>
              </>
            ) : (
              <>
                <div className="bg-[#F59E0B]/10 rounded-lg p-4 border border-[#F59E0B]/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-[#F59E0B]"></div>
                      <span className="text-sm font-semibold text-white">Planlı Toplama</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className={`text-xs font-semibold ${Number(plannedCollTrend) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {Number(plannedCollTrend) >= 0 ? '↗' : '↘'} {Math.abs(Number(plannedCollTrend))}%
                      </div>
                      <div className="text-[10px] text-gray-500">önceki döneme göre</div>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-[#F59E0B]">{totalPlannedColl}</div>
                  <div className="text-xs text-[#A7B8D8] mt-1">{displayPeriod}</div>
                  <div className="text-xs text-gray-400 mt-2">Önceki dönem: {prevPlannedColl} adet</div>
                </div>
                
                <div className="bg-[#8B5CF6]/10 rounded-lg p-4 border border-[#8B5CF6]/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-[#8B5CF6]"></div>
                      <span className="text-sm font-semibold text-white">Plansız Toplama</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className={`text-xs font-semibold ${Number(unplannedCollTrend) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {Number(unplannedCollTrend) >= 0 ? '↗' : '↘'} {Math.abs(Number(unplannedCollTrend))}%
                      </div>
                      <div className="text-[10px] text-gray-500">önceki döneme göre</div>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-[#8B5CF6]">{totalUnplannedColl}</div>
                  <div className="text-xs text-[#A7B8D8] mt-1">{displayPeriod}</div>
                  <div className="text-xs text-gray-400 mt-2">Önceki dönem: {prevUnplannedColl} adet</div>
                </div>
              </>
            )}
          </div>

          <div className="bg-[#0E2142] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-semibold text-white">
                {selectedTab === 'ikmal' ? '📦 İkmal Karşılaştırma' : '💵 Para Toplama Karşılaştırma'}
              </div>
              <div className="text-xs text-[#A7B8D8]">{displayPeriod}</div>
            </div>
            <div className="flex items-end justify-center gap-8 h-64">
              {selectedTab === 'ikmal' ? (
                <>
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative flex flex-col items-center justify-end group">
                      <div 
                        className="w-24 bg-gradient-to-t from-[#10B981] to-[#059669] rounded-t transition-all hover:opacity-80"
                        style={{ height: `${Math.min((totalPlannedRepl / 100) * 100, 100)}%`, minHeight: '30px' }}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                          <div className="bg-[#10B981] text-white text-sm px-3 py-1 rounded font-bold">{totalPlannedRepl}</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-[#A7B8D8] font-semibold">Planlı</div>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative flex flex-col items-center justify-end group">
                      <div 
                        className="w-24 bg-gradient-to-t from-[#EF4444] to-[#DC2626] rounded-t transition-all hover:opacity-80"
                        style={{ height: `${Math.min((totalUnplannedRepl / 100) * 100, 100)}%`, minHeight: '30px' }}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                          <div className="bg-[#EF4444] text-white text-sm px-3 py-1 rounded font-bold">{totalUnplannedRepl}</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-[#A7B8D8] font-semibold">Plansız</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative flex flex-col items-center justify-end group">
                      <div 
                        className="w-24 bg-gradient-to-t from-[#F59E0B] to-[#F97316] rounded-t transition-all hover:opacity-80"
                        style={{ height: `${Math.min((totalPlannedColl / 100) * 100, 100)}%`, minHeight: '30px' }}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                          <div className="bg-[#F59E0B] text-white text-sm px-3 py-1 rounded font-bold">{totalPlannedColl}</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-[#A7B8D8] font-semibold">Planlı</div>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative flex flex-col items-center justify-end group">
                      <div 
                        className="w-24 bg-gradient-to-t from-[#8B5CF6] to-[#7C3AED] rounded-t transition-all hover:opacity-80"
                        style={{ height: `${Math.min((totalUnplannedColl / 100) * 100, 100)}%`, minHeight: '30px' }}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                          <div className="bg-[#8B5CF6] text-white text-sm px-3 py-1 rounded font-bold">{totalUnplannedColl}</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-[#A7B8D8] font-semibold">Plansız</div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 bg-purple-500/10 border border-purple-500/30 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <div className="text-xl">🤖</div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-purple-400 mb-1">AI Değerlendirme</div>
                <div className="text-xs text-[#A7B8D8] leading-relaxed">
                  {selectedTab === 'ikmal' ? (
                    <>
                      {displayPeriod} döneminde plansız ikmal oranı <strong className="text-[#EF4444]">%{((totalUnplannedRepl / (totalPlannedRepl + totalUnplannedRepl)) * 100).toFixed(1)}</strong>. 
                      <strong className="text-white"> Hedef %20'nin altında olmalı.</strong>
                      {Number(unplannedReplTrend) > 0 && (
                        <strong className="text-red-400"> Önceki döneme göre %{Math.abs(Number(unplannedReplTrend))} artış var. </strong>
                      )}
                      {Number(unplannedReplTrend) < 0 && (
                        <strong className="text-green-400"> Önceki döneme göre %{Math.abs(Number(unplannedReplTrend))} azalma - olumlu trend. </strong>
                      )}
                      <strong className="text-[#10B981]"> AI tahmin modelini optimize ederek</strong> plansız ikmalleri azaltabilir, CIT maliyetlerini düşürebilirsiniz.
                    </>
                  ) : (
                    <>
                      {displayPeriod} döneminde plansız para toplama oranı <strong className="text-[#8B5CF6]">%{((totalUnplannedColl / (totalPlannedColl + totalUnplannedColl)) * 100).toFixed(1)}</strong>. 
                      <strong className="text-white"> Hedef %20'nin altında olmalı.</strong>
                      {Number(unplannedCollTrend) > 0 && (
                        <strong className="text-red-400"> Önceki döneme göre %{Math.abs(Number(unplannedCollTrend))} artış var. </strong>
                      )}
                      {Number(unplannedCollTrend) < 0 && (
                        <strong className="text-green-400"> Önceki döneme göre %{Math.abs(Number(unplannedCollTrend))} azalma - olumlu trend. </strong>
                      )}
                      <strong className="text-[#F59E0B]"> Nakit seviye tahminlerini iyileştirerek</strong> plansız toplama operasyonlarını azaltabilir, operasyonel verimliliği artırabilirsiniz.
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useMemo } from "react";
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
    description: "Nakit seviyesi kritik eşiğin altına düşmüş ATM'lerin sayısı. Acil ikmal gerektirebilir.",
    purpose: "Kıtlık riskini tespit etmek. Hangi ATM'ler yakında nakit biter?",
    interpretation: "Yüksek sayı = CIT operasyonları yetersiz veya talep tahmini hatalı. Hızlı aksiyon gerekli, müşteri memnuniyeti riski."
  },
  "predicted_shortage": {
    title: "Tahmini Kıtlık (7 Gün)",
    description: "Önümüzdeki 7 gün içinde nakit tükenmesi beklenen ATM sayısı. AI tahmin modeli sonucu.",
    purpose: "Proaktif planlama. Hangi ATM'lere öncelikle ikmal yapılmalı?",
    interpretation: "0 = ideal durum. Yüksek sayı = CIT planlaması yapılmalı, aksi halde servis kesintisi riski. Tahmin doğruluğu kritik."
  },
  "planned_replenishments": {
    title: "Planlı İkmal Sayısı (7 Gün)",
    description: "Önümüzdeki 7 gün için planlanmış nakit ikmali operasyonlarının sayısı.",
    purpose: "CIT operasyonel yükünü ve lojistik kapasiteyi göstermek. Planlama yapıldı mı?",
    interpretation: "Planned Repl. >= Pred. Shortage olmalı. Düşükse bazı ATM'ler atlanmış, kıtlık riski var. Yüksekse gereksiz maliyetli operasyonlar."
  },
  "heat_map": {
    title: "Low Cash ATM Heat Map (Düşük Nakit Isı Haritası)",
    description: "Türkiye haritası üzerinde düşük nakit seviyeli ATM'lerin yoğunluk haritası. Kırmızı alanlar yüksek yoğunluk, yeşil alanlar düşük yoğunluk gösterir.",
    purpose: "Coğrafi nakit kıtlığı dağılımını görselleştirmek. Hangi bölgelerde nakit sıkıntısı yoğunlaşmış? CIT ekipleri nereye odaklanmalı?",
    interpretation: "Kırmızı/turuncu bölgeler = Yüksek risk, o bölgeye CIT rotası planlanmalı. Yeşil bölgeler = Stabil durum. Şehir merkezlerinde yoğunluk normaldir (yüksek işlem hacmi). Beklenmedik yerlerde yoğunluk varsa operasyonel sorun olabilir."
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
  const [selectedCashCenter, setSelectedCashCenter] = useState<string>("");
  const [showCashCenterSearch, setShowCashCenterSearch] = useState(false);
  const [cashCenterSearchTerm, setCashCenterSearchTerm] = useState("");
  const [routeDateStart, setRouteDateStart] = useState<string>("2026-02-04");
  const [routeDateEnd, setRouteDateEnd] = useState<string>("2026-02-04");
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
  const [showAllNmSlaModal, setShowAllNmSlaModal] = useState(false);
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
  
  // Otomatik Öneriler collapsible state
  const [autoSuggestionsExpanded, setAutoSuggestionsExpanded] = useState(false);

  // AI Manual Override Rules
  const [manualCashLimit, setManualCashLimit] = useState<string>("350");
  const [manualRuleDescription, setManualRuleDescription] = useState<string>("");

  // AI Engine states
  const [aiEngineEnabled, setAiEngineEnabled] = useState<boolean>(false);
  const [aiEngineMode, setAiEngineMode] = useState<"auto" | "manual">("auto");
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
      
      // Auto-select TOP 1 NM (en çok ATM'si olan)
      if (majorCashCenters.length > 0) {
        setSelectedCashCenter(majorCashCenters[0][0]);
      }
      
      // Calculate SLA exceeded ATMs (mock: ATMs with cash level < 20% for more than 3 days)
      const slaExceeded = atms.slice(0, 23).map((a: any) => {
        const zone = a.zone || "3";
        const isPlanned = Math.random() > 0.3; // 70% planlı operasyon
        const slaTargetHours = getSlaHours(zone, isPlanned);
        const hoursExceeded = Math.floor(Math.random() * 48) + slaTargetHours; // Exceeded by some hours
        
        return {
          atm_id: String(a.atm_id),
          atm_name: a.atm_name || "N/A",
          city: a.city,
          district: a.district,
          zone: zone,
          cash_level: Math.floor(Math.random() * 15) + 5, // 5-20% remaining
          days_exceeded: Math.floor(hoursExceeded / 24) + 1,
          sla_target: slaTargetHours,
          hours_exceeded: hoursExceeded - slaTargetHours,
          operation_type: isPlanned ? "Planlı" : "Plansız",
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

  // Generate routes based on selected cash center (ONLY 1 NM)
  useEffect(() => {
    if (!allCashCenterGroups.length || !selectedCashCenter) return;
    
    // Find the selected cash center group
    const selectedGroup = allCashCenterGroups.find(([cc]) => cc === selectedCashCenter);
    if (!selectedGroup) return;
    
    const [cashCenter, centerAtms] = selectedGroup;
    const teams = ["Alpha", "Beta", "Gamma"];
    const vehicles = ["TR-34-ABC-123", "TR-06-XYZ-456", "TR-35-DEF-789"];
    
    // Create 3 routes for this NM: today, tomorrow, later
    const routes = [];
    
    // Get all offsite ATMs for this cash center
    const allOffsiteAtms = centerAtms.filter((a: any) => a.location_type === "Offsite");
    
    // If not enough ATMs, duplicate some to ensure all 3 routes have data
    const minAtmsPerRoute = 8;
    const requiredTotal = 40; // Need at least 40 to cover all slices
    let workingAtms = [...allOffsiteAtms];
    
    // Duplicate ATMs multiple times if needed to ensure all routes have data
    while (workingAtms.length < requiredTotal && allOffsiteAtms.length > 0) {
      workingAtms = [...workingAtms, ...allOffsiteAtms];
    }
    
    // If still not enough, keep duplicating until we have 40
    if (workingAtms.length < requiredTotal && allOffsiteAtms.length > 0) {
      const remaining = requiredTotal - workingAtms.length;
      for (let i = 0; i < remaining; i++) {
        workingAtms.push(allOffsiteAtms[i % allOffsiteAtms.length]);
      }
    }
    
    // Today route - Replenishment (İkmal)
    const todayOffsiteAtms = workingAtms.slice(0, 15);
    if (todayOffsiteAtms.length > 0) {
      routes.push({
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
        atms: todayOffsiteAtms.map((a: any, i: number) => ({
          ...a,
          order: i + 1,
          operation: "ikmal",
          amount: `₺${(Math.random() * 400000 + 200000).toFixed(0)}`,
          planned: i % 3 !== 0, // 33% plansız, 67% planlı
          sla_hours: getSlaHours(a.zone || "3", i % 3 !== 0),
          zone: a.zone || "3"
        })),
      });
    }
    
    // Tomorrow route - Mixed (Karışık: ikmal + toplama)
    const tomorrowOffsiteAtms = workingAtms.slice(15, 28);
    if (tomorrowOffsiteAtms.length > 0) {
      routes.push({
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
        atms: tomorrowOffsiteAtms.map((a: any, i: number) => ({
          ...a,
          order: i + 1,
          operation: i % 3 === 0 ? "toplama" : "ikmal",
          amount: `₺${(Math.random() * 450000 + 250000).toFixed(0)}`,
          planned: i % 4 !== 0, // 25% plansız, 75% planlı
          sla_hours: getSlaHours(a.zone || "3", i % 4 !== 0),
          zone: a.zone || "3"
        })),
      });
    }
    
    // Later route - Collection (Toplama) - ALWAYS create this route
    // Ensure we have at least 12 ATMs for collection route
    let laterOffsiteAtms = workingAtms.slice(28, 40);
    
    // If slice is empty or too small, take from beginning and duplicate
    if (laterOffsiteAtms.length < 12 && workingAtms.length > 0) {
      laterOffsiteAtms = [];
      for (let i = 0; i < 12; i++) {
        laterOffsiteAtms.push(workingAtms[i % workingAtms.length]);
      }
    }
    
    console.log('🔍 DEBUG Collection Route:', {
      cashCenter,
      allOffsiteCount: allOffsiteAtms.length,
      workingAtmsCount: workingAtms.length,
      laterOffsiteCount: laterOffsiteAtms.length,
      laterAtmIds: laterOffsiteAtms.map(a => a.atm_id).slice(0, 5) // First 5 for brevity
    });
    
    // Always add collection route with at least 12 ATMs
    routes.push({
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
      atms: laterOffsiteAtms.map((a: any, i: number) => ({
        ...a,
        order: i + 1,
        operation: "toplama",
        amount: `₺${(Math.random() * 420000 + 230000).toFixed(0)}`,
        planned: i % 5 !== 0, // 20% plansız, 80% planlı
        sla_hours: getSlaHours(a.zone || "3", i % 5 !== 0),
        zone: a.zone || "3"
      })),
    });
      
    setCitRoutes(routes);
  }, [allCashCenterGroups, selectedCashCenter]);

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
          
          <div className="flex items-center gap-4">
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
                <div className="text-sm font-bold text-white">2 dk önce</div>
              </div>
            </div>

            {/* Manual Rules Override - Only shown in Manual mode */}
            {aiEngineMode === "manual" && (
              <div className="bg-gradient-to-r from-[#F2B705]/20 to-[#F59E0B]/10 rounded-xl p-5 ring-1 ring-[#F2B705]/50 mb-6">
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
              
              <div className={`overflow-hidden transition-all duration-500 ease-in-out ${autoSuggestionsExpanded ? 'max-h-[800px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {[
                  { id: 1, type: "collection", atmId: "FA026", atmName: "BATI ATASEHIR SUBE 2", city: "İstanbul", district: "Ataşehir", priority: "high", reason: "Kaset %89 dolu (Cuma öğleden sonra maaş yoğunluğu tahmini)", eta: "18:00", confidence: 96 },
                  { id: 2, type: "collection", atmId: "FA032", atmName: "41 DARICA EMEK", city: "Kocaeli", district: "Darıca", priority: "high", reason: "Hafta sonu + Finbor lokasyonu, %91 doluluk", eta: "16:30", confidence: 94 },
                  { id: 3, type: "collection", atmId: "FA025", atmName: "01 SARICAM H.SABANCI OSB", city: "Adana", district: "Sarıçam", priority: "medium", reason: "Organize sanayi bölgesi - Cuma akşam yoğunluk paterni", eta: "19:00", confidence: 92 },
                  { id: 4, type: "collection", atmId: "FA034", atmName: "16 BURSA FOMARA", city: "Bursa", district: "Nilüfer", priority: "high", reason: "AVM lokasyonu - Cumartesi alışveriş yoğunluğu, %87 doluluk", eta: "17:00", confidence: 93 },
                  { id: 5, type: "replenishment", atmId: "FA018", atmName: "07 ALANYA OTOGAR", city: "Antalya", district: "Alanya", priority: "medium", reason: "Pazartesi sabahı tükenmeden önleyici ikmal", eta: "Pzr 22:00", confidence: 88 },
                  { id: 6, type: "collection", atmId: "FA023", atmName: "35 KONAK KEMERALT", city: "İzmir", district: "Konak", priority: "high", reason: "Tarihi çarşı bölgesi - Hafta sonu turist yoğunluğu, %90 doluluk", eta: "15:30", confidence: 95 },
                  { id: 7, type: "replenishment", atmId: "FA006", atmName: "06 ANKARA KIZILAY", city: "Ankara", district: "Çankaya", priority: "high", reason: "Metro istasyonu - Pazartesi sabah trafiği öncesi kritik seviye", eta: "Pzr 23:00", confidence: 91 },
                  { id: 8, type: "collection", atmId: "FA024", atmName: "41 GEBZE ORGANIZE", city: "Kocaeli", district: "Gebze", priority: "medium", reason: "Sanayi bölgesi - Haftalık maaş ödemesi sonrası, %84 doluluk", eta: "19:30", confidence: 89 },
                  { id: 9, type: "replenishment", atmId: "FA019", atmName: "01 ANTALYA HAVALIMANI", city: "Antalya", district: "Serik", priority: "medium", reason: "Havalimanı - Pazar akşam uçuş yoğunluğu öncesi", eta: "Paz 20:00", confidence: 87 },
                  { id: 10, type: "collection", atmId: "FA033", atmName: "27 S.BEY KARATAS PO 2", city: "Gaziantep", district: "Şahinbey", priority: "medium", reason: "Petrol ofisi - Hafta sonu seyahat trafiği, %86 doluluk", eta: "18:30", confidence: 90 },
                  { id: 11, type: "replenishment", atmId: "FA015", atmName: "16 KADIKOY ISKELE", city: "İstanbul", district: "Kadıköy", priority: "low", reason: "Vapur iskelesi - Pazartesi sabah yolcu yoğunluğu", eta: "Pzr 21:30", confidence: 85 },
                  { id: 12, type: "collection", atmId: "FA028", atmName: "07 IZMIR ALSANCAK", city: "İzmir", district: "Konak", priority: "medium", reason: "Tren garı yakını - Hafta sonu seyahat yoğunluğu, %88 doluluk", eta: "17:30", confidence: 91 },
                ].map((rec) => (
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
              <div className="text-sm">Low Cash ATM Heat Map</div>
              <button
                onClick={() => setInfoModal(CASHFLOW_METRIC_EXPLANATIONS["heat_map"])}
                className="w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition"
              >
                ?
              </button>
            </div>
            
            <div className="flex items-center gap-2">
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
                  const csvContent = '\uFEFFDüşük Nakit ATM Haritası Raporu\n' +
                    'Rapor Tarihi: ' + new Date().toLocaleDateString('tr-TR') + '\n' +
                    'Tarih Aralığı: ' + heatMapStartDate + ' - ' + heatMapEndDate + '\n\n' +
                    'ATM ID,ATM Adı,Şehir,İlçe,Nakit Seviyesi (%),Risk Durumu,Latitude,Longitude\n' +
                    lowCashAtms.map(atm => {
                      const riskLevel = atm.cash_level < 20 ? 'Kritik' : atm.cash_level < 30 ? 'Düşük' : 'Normal';
                      return `${atm.atm_id},${atm.atm_name},${atm.city},${atm.district},${atm.cash_level}%,${riskLevel},${atm.latitude},${atm.longitude}`;
                    }).join('\n') +
                    '\n\nRisk Seviyesi Tanımları:\n' +
                    'Kritik,< 20%,Acil ikmal gerekli - CIT planlanmalı\n' +
                    'Düşük,20-30%,Yakın takip - İkmal planına alınmalı\n' +
                    'Normal,> 30%,Stabil durum - Normal izleme\n\n' +
                    'Özet İstatistikler:\n' +
                    'Toplam Düşük Nakit ATM,' + lowCashAtms.length + '\n' +
                    'Kritik Risk,' + lowCashAtms.filter(a => a.cash_level < 20).length + '\n' +
                    'Düşük Risk,' + lowCashAtms.filter(a => a.cash_level >= 20 && a.cash_level < 30).length + '\n' +
                    'Normal,' + lowCashAtms.filter(a => a.cash_level >= 30).length + '\n\n' +
                    'Şehir Bazlı Dağılım:\n' +
                    [...new Set(lowCashAtms.map(a => a.city))].map(city => {
                      const cityAtms = lowCashAtms.filter(a => a.city === city);
                      return city + ',' + cityAtms.length + ' ATM';
                    }).join('\n') +
                    '\n\nRapor Oluşturan: AI Cash Optimization Engine\n' +
                    'Sistem: IronClad Cash Flow Manager';
                  
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = `low_cash_heat_map_${new Date().toISOString().split('T')[0]}.csv`;
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
          <div className="h-[360px] w-full rounded-xl overflow-hidden ring-1 ring-[#2B416B]">
            <HeatMapComponent lowCashAtms={lowCashAtms} />
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-sm">🚚 CIT Route Optimization</div>
            <button
              onClick={() => setShowCashCenterSearch(true)}
              className="px-3 py-1 text-xs rounded-lg font-semibold bg-[#2E86FF]/20 text-[#2E86FF] hover:bg-[#2E86FF]/30 transition ring-1 ring-[#2E86FF]/50 flex items-center gap-2"
            >
              🏦 {selectedCashCenter || "NM Seç"}
              <span className="opacity-60">▼</span>
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
                  setRouteDateStart("2026-02-05");
                  setRouteDateEnd("2026-02-05");
                }}
                className="px-3 py-1 text-xs rounded-lg font-semibold bg-[#0E2142] text-[#A7B8D8] hover:bg-[#2E86FF] hover:text-white transition"
              >
                Yarın
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

        <div className="space-y-4">
          {filteredRoutes.filter(r => {
            // Map day to actual dates for filtering
            const routeDate = r.day === "today" ? "2026-02-04" : 
                             r.day === "tomorrow" ? "2026-02-05" : "2026-02-06";
            return routeDate >= routeDateStart && routeDate <= routeDateEnd;
          }).map((route) => (
            <div 
              key={route.id} 
              onClick={() => setSelectedRoute(route)}
              className={`bg-[#0E2142]/60 rounded-xl p-6 ring-1 transition cursor-pointer ${
                selectedRoute?.id === route.id 
                  ? "ring-2 ring-[#2E86FF] bg-[#2E86FF]/10" 
                  : "ring-[#2B416B] hover:ring-[#2E86FF]"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <div className="font-semibold text-base">🏦 {route.cash_center} Nakit Merkezi</div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      route.operation_type === "replenishment" ? "bg-[#10B981]/20 text-[#10B981]" :
                      route.operation_type === "collection" ? "bg-[#F2B705]/20 text-[#F2B705]" :
                      "bg-[#2E86FF]/20 text-[#2E86FF]"
                    }`}>
                      {route.operation_type === "replenishment" ? "İkmal" : 
                       route.operation_type === "collection" ? "Para Toplama" : "Karma"}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      route.status === "in-progress" ? "bg-[#E63946]/20 text-[#E63946]" :
                      route.status === "scheduled" ? "bg-[#2E86FF]/20 text-[#2E86FF]" :
                      "bg-[#A7B8D8]/20 text-[#A7B8D8]"
                    }`}>
                      {route.status === "in-progress" ? "Devam Ediyor" : 
                       route.status === "scheduled" ? "Başlıyor" : "Planlı"}
                    </span>
                  </div>
                  <div className="text-sm text-[#A7B8D8]">
                    🏢 {route.cit_company} • {route.team} • {route.vehicle}
                    {route.planned_date && <span className="ml-2 text-[#10B981]">📅 {route.planned_date}</span>}
                  </div>
                  <div className="text-sm text-white/60 mt-1">
                    📍 Bu rotadaki tüm ATM'ler {route.cash_center} NM'ye bağlıdır • Rota sırası CIT firmasınca belirlenir
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-[#10B981]">{route.efficiency_score}%</div>
                  <div className="text-sm text-[#A7B8D8]">Verimlilik</div>
                </div>
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
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-[#112544] rounded-lg p-3">
                  <div className="text-sm text-[#A7B8D8]">ATM Sayısı</div>
                  <div className="text-base font-bold mt-1">{route.atms_count}</div>
                </div>
                <div className="bg-[#112544] rounded-lg p-3">
                  <div className="text-sm text-[#A7B8D8]">Tahmini Süre</div>
                  <div className="text-base font-bold mt-1">{route.estimated_time}</div>
                </div>
                <div className="bg-[#112544] rounded-lg p-3">
                  <div className="text-sm text-[#A7B8D8]">Toplam Nakit</div>
                  <div className="text-base font-bold mt-1">{route.total_cash}</div>
                </div>
              </div>

              {/* Optimization suggestions */}
              {route.efficiency_score < 85 && (
                <div className="bg-[#F2B705]/10 rounded-lg p-3 mb-3">
                  <div className="text-sm text-[#F2B705] font-semibold mb-1.5">💡 Optimizasyon Önerisi</div>
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
                  onClick={() => { setSelectedRoute(route); setShowRouteMapModal(true); }}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[#2E86FF]/20 hover:bg-[#2E86FF]/30 text-sm text-[#2E86FF] font-semibold transition ring-1 ring-[#2E86FF]/50"
                >
                  Haritada Göster
                </button>
                <button 
                  onClick={() => { setSelectedRoute(route); setShowRouteOptimizeModal(true); }}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[#10B981]/20 hover:bg-[#10B981]/30 text-sm text-[#10B981] font-semibold transition ring-1 ring-[#10B981]/50"
                >
                  İş Emri Aç
                </button>
                <button 
                  onClick={() => { setSelectedRoute(route); setShowRouteDetailsModal(true); }}
                  className="px-4 py-2.5 rounded-lg bg-[#0E2142] hover:bg-[#1C2E52] text-sm text-[#A7B8D8] font-semibold transition ring-1 ring-[#2B416B]"
                >
                  İş Emirleri
                </button>
              </div>
            </div>
          ))}
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
            ) : (
              data.top_actions
                .filter((a: any) => !selectedCashCenter || a.cash_center === selectedCashCenter)
                .map((a: any) => (
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
              ))
            )}
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

      {/* Cash Center Search Modal */}
      {showCashCenterSearch && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-2xl ring-2 ring-[#2B416B] flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B] bg-[#0E2142]/60 flex-shrink-0">
              <div className="text-lg font-semibold">🏦 Nakit Merkezi Seç</div>
              <button onClick={() => { setShowCashCenterSearch(false); setCashCenterSearchTerm(""); }} className="text-[#A7B8D8] hover:text-white text-2xl">&times;</button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto">
              {/* Search input */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="NM ara..."
                  value={cashCenterSearchTerm}
                  onChange={(e) => setCashCenterSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-[#0E2142] text-white placeholder-[#A7B8D8] border border-[#2B416B] focus:outline-none focus:ring-2 focus:ring-[#2E86FF]"
                />
              </div>

              {/* Cash centers list */}
              <div className="space-y-2">
                {allCashCenters
                  .filter(cc => cc.name.toLowerCase().includes(cashCenterSearchTerm.toLowerCase()))
                  .map((cc) => {
                    const isSelected = selectedCashCenter === cc.name;
                    
                    // Calculate completed and remaining tasks for this NM
                    const nmRoutes = citRoutes.filter(r => r.cash_center === cc.name);
                    const completedRoutes = nmRoutes.filter(r => r.status === "completed" || r.progress === 100);
                    const remainingRoutes = nmRoutes.filter(r => r.status !== "completed" && r.progress !== 100);
                    const completionRate = nmRoutes.length > 0 ? (completedRoutes.length / nmRoutes.length * 100) : 0;
                    
                    return (
                      <div
                        key={cc.name}
                        onClick={() => {
                          setSelectedCashCenter(cc.name);
                          setShowCashCenterSearch(false);
                          setCashCenterSearchTerm("");
                        }}
                        className={`p-4 rounded-lg transition cursor-pointer ${
                          isSelected
                            ? "bg-[#2E86FF]/30 ring-2 ring-[#2E86FF]"
                            : "bg-[#0E2142] ring-1 ring-[#2B416B] hover:ring-[#2E86FF]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-semibold text-sm flex items-center gap-2">
                              {cc.name}
                              {isSelected && <span className="text-xs px-2 py-0.5 rounded-full bg-[#2E86FF]/30 text-[#2E86FF]">✓ Seçili</span>}
                            </div>
                            <div className="text-xs text-[#A7B8D8] mt-1">
                              {cc.atm_count} ATM • {cc.offsite_count} Offsite
                            </div>
                          </div>
                          {isSelected && (
                            <span className="text-[#2E86FF] text-2xl">✓</span>
                          )}
                        </div>
                        
                        {/* Work status */}
                        {nmRoutes.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-[#2B416B]/50">
                            <div className="flex items-center justify-between text-xs mb-2">
                              <div className="flex items-center gap-4">
                                <span className="text-[#10B981]">
                                  ✓ Biten: <span className="font-semibold">{completedRoutes.length}</span>
                                </span>
                                <span className="text-[#F2B705]">
                                  ⏳ Kalan: <span className="font-semibold">{remainingRoutes.length}</span>
                                </span>
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
              <button onClick={() => { setShowSlaExceededModal(false); setSelectedSlaAtm(null); }} className="text-[#A7B8D8] hover:text-white text-2xl">&times;</button>
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
                          📍 Yakın ATM'leri Göster
                        </button>
                      )}
                    </div>
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
      {showRouteMapModal && selectedRoute && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden ring-2 ring-[#2B416B]">
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B] bg-[#0E2142]/60">
              <div className="text-lg font-semibold">📍 {selectedRoute.cash_center} NM Rotası - Harita</div>
              <button onClick={() => setShowRouteMapModal(false)} className="text-[#A7B8D8] hover:text-white text-2xl">&times;</button>
            </div>
            
            <div className="p-4">
              <div className="h-[600px] w-full rounded-xl overflow-hidden ring-1 ring-[#2B416B]">
                <RouteMapComponent route={selectedRoute} />
              </div>
              
              <div className="mt-4 grid grid-cols-4 gap-3">
                <div className="bg-[#0E2142] rounded-lg p-3 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8]">Nakit Merkezi</div>
                  <div className="text-sm font-bold mt-1">{selectedRoute.cash_center}</div>
                </div>
                <div className="bg-[#0E2142] rounded-lg p-3 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8]">ATM Sayısı</div>
                  <div className="text-sm font-bold mt-1">{selectedRoute.atms_count}</div>
                </div>
                <div className="bg-[#0E2142] rounded-lg p-3 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8]">Toplam Mesafe</div>
                  <div className="text-sm font-bold mt-1">{(selectedRoute.atms_count * 8.5).toFixed(1)} km</div>
                </div>
                <div className="bg-[#0E2142] rounded-lg p-3 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8]">Verimlilik</div>
                  <div className="text-sm font-bold mt-1 text-[#10B981]">{selectedRoute.efficiency_score}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
              <button onClick={() => { setShowRouteDetailsModal(false); setShowAllRouteAtms(false); }} className="text-[#A7B8D8] hover:text-white text-2xl">&times;</button>
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
                  {(showAllRouteAtms ? selectedRoute.atms : selectedRoute.atms.slice(0, 5)).map((atm: any, idx: number) => (
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
                        </div>
                      </div>
                    </div>
                  ))}

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
              <h2 className="text-xl font-bold text-white">🗺️ Low Cash ATM Heat Map - Tam Ekran</h2>
              <div className="text-sm text-[#A7B8D8]">
                {lowCashAtms.length} ATM
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Legend */}
              <div className="flex items-center gap-4 text-sm">
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
            <HeatMapComponent key="fullscreen-heatmap" lowCashAtms={lowCashAtms} />
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
  const [dateStart, setDateStart] = useState('2025-01-01');
  const [dateEnd, setDateEnd] = useState('2025-12-31');
  const [selectedTab, setSelectedTab] = useState<'ikmal' | 'toplama'>('ikmal');

  // Mock data - Son 12 ay için planlı/plansız ikmal ve para toplama sayıları
  const operationsData = [
    { month: 'Oca 2025', plannedRepl: 42, unplannedRepl: 18, plannedColl: 35, unplannedColl: 12 },
    { month: 'Şub 2025', plannedRepl: 48, unplannedRepl: 22, plannedColl: 38, unplannedColl: 15 },
    { month: 'Mar 2025', plannedRepl: 45, unplannedRepl: 15, plannedColl: 40, unplannedColl: 10 },
    { month: 'Nis 2025', plannedRepl: 52, unplannedRepl: 28, plannedColl: 42, unplannedColl: 18 },
    { month: 'May 2025', plannedRepl: 50, unplannedRepl: 20, plannedColl: 44, unplannedColl: 14 },
    { month: 'Haz 2025', plannedRepl: 38, unplannedRepl: 32, plannedColl: 36, unplannedColl: 22 },
    { month: 'Tem 2025', plannedRepl: 55, unplannedRepl: 25, plannedColl: 48, unplannedColl: 16 },
    { month: 'Ağu 2025', plannedRepl: 58, unplannedRepl: 18, plannedColl: 50, unplannedColl: 12 },
    { month: 'Eyl 2025', plannedRepl: 46, unplannedRepl: 24, plannedColl: 41, unplannedColl: 17 },
    { month: 'Eki 2025', plannedRepl: 43, unplannedRepl: 30, plannedColl: 38, unplannedColl: 20 },
    { month: 'Kas 2025', plannedRepl: 60, unplannedRepl: 35, plannedColl: 52, unplannedColl: 25 },
    { month: 'Ara 2025', plannedRepl: 62, unplannedRepl: 22, plannedColl: 55, unplannedColl: 14 },
  ];

  const maxValueRepl = Math.max(...operationsData.map(d => Math.max(d.plannedRepl, d.unplannedRepl)));
  const maxValueColl = Math.max(...operationsData.map(d => Math.max(d.plannedColl, d.unplannedColl)));
  const totalPlannedRepl = operationsData.reduce((sum, d) => sum + d.plannedRepl, 0);
  const totalUnplannedRepl = operationsData.reduce((sum, d) => sum + d.unplannedRepl, 0);
  const totalPlannedColl = operationsData.reduce((sum, d) => sum + d.plannedColl, 0);
  const totalUnplannedColl = operationsData.reduce((sum, d) => sum + d.unplannedColl, 0);

  // Excel Export Function
  const exportToExcel = () => {
    const csvContent = '\uFEFFPlanlı vs Plansız İkmal & Para Toplama Trendi\n' +
      `Tarih Aralığı: ${dateStart} - ${dateEnd}\n\n` +
      'Ay,Planlı İkmal,Plansız İkmal,Planlı Para Toplama,Plansız Para Toplama\n' +
      operationsData.map((data) => 
        `${data.month},${data.plannedRepl},${data.unplannedRepl},${data.plannedColl},${data.unplannedColl}`
      ).join('\n') +
      `\n\nTOPLAM,${totalPlannedRepl},${totalUnplannedRepl},${totalPlannedColl},${totalUnplannedColl}\n` +
      `\nPlansız İkmal Oranı,%${((totalUnplannedRepl / (totalPlannedRepl + totalUnplannedRepl)) * 100).toFixed(1)}\n` +
      `Plansız Para Toplama Oranı,%${((totalUnplannedColl / (totalPlannedColl + totalUnplannedColl)) * 100).toFixed(1)}`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Planned_Unplanned_Cash_Operations_${dateStart}_${dateEnd}.csv`;
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
            <div className="text-sm text-white font-semibold">💰 Planlı vs Plansız Nakit Operasyonları</div>
            <div className="text-xs text-[#A7B8D8] mt-1">
              İkmal ve Para Toplama operasyonları karşılaştırması
            </div>
          </div>
          <div className="text-[#A7B8D8] text-xl transition-transform ml-auto" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ▼
          </div>
        </div>

        {/* Stats Preview (Always Visible) */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-[#10B981]"></div>
            <span className="text-xs text-[#A7B8D8]">İkmal: {totalPlannedRepl + totalUnplannedRepl}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-[#F59E0B]"></div>
            <span className="text-xs text-[#A7B8D8]">Toplama: {totalPlannedColl + totalUnplannedColl}</span>
          </div>
        </div>
      </div>

      {/* Date Range and Export Filters - Show when expanded */}
      {isExpanded && (
        <div className="flex items-center gap-2 flex-wrap mb-3 px-2">
          {/* Tab Selection */}
          <div className="flex items-center gap-1 mr-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTab('ikmal');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedTab === 'ikmal'
                  ? 'bg-[#10B981] text-white'
                  : 'bg-[#0E2142] text-[#A7B8D8] hover:bg-[#1a2f54]'
              }`}
            >
              📦 İkmal
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTab('toplama');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedTab === 'toplama'
                  ? 'bg-[#F59E0B] text-white'
                  : 'bg-[#0E2142] text-[#A7B8D8] hover:bg-[#1a2f54]'
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
          {/* Single Chart - İkmal or Para Toplama based on selectedTab */}
          <div className="bg-[#0E2142]/40 rounded-xl p-4">
            <div className="text-sm font-semibold text-white mb-3">
              {selectedTab === 'ikmal' ? '📦 İkmal Operasyonları' : '💵 Para Toplama Operasyonları'}
            </div>
            <div className="flex gap-2">
              {operationsData.map((data, idx) => {
                const maxValue = selectedTab === 'ikmal' ? maxValueRepl : maxValueColl;
                const plannedValue = selectedTab === 'ikmal' ? data.plannedRepl : data.plannedColl;
                const unplannedValue = selectedTab === 'ikmal' ? data.unplannedRepl : data.unplannedColl;
                const plannedColor = selectedTab === 'ikmal' ? { from: '#10B981', to: '#059669' } : { from: '#F59E0B', to: '#F97316' };
                const unplannedColor = selectedTab === 'ikmal' ? { from: '#EF4444', to: '#DC2626' } : { from: '#8B5CF6', to: '#7C3AED' };

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex items-end justify-center gap-1" style={{ height: '180px' }}>
                      {/* Planned Bar */}
                      <div className="relative flex flex-col items-center justify-end flex-1 group">
                        <div 
                          className="w-full rounded-t transition-all hover:opacity-80"
                          style={{ 
                            height: `${(plannedValue / maxValue) * 100}%`, 
                            minHeight: '15px',
                            background: `linear-gradient(to top, ${plannedColor.from}, ${plannedColor.to})`
                          }}
                        >
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="text-white text-[10px] px-2 py-1 rounded whitespace-nowrap font-semibold" style={{ backgroundColor: plannedColor.from }}>
                              {plannedValue}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Unplanned Bar */}
                      <div className="relative flex flex-col items-center justify-end flex-1 group">
                        <div 
                          className="w-full rounded-t transition-all hover:opacity-80"
                          style={{ 
                            height: `${(unplannedValue / maxValue) * 100}%`, 
                            minHeight: '15px',
                            background: `linear-gradient(to top, ${unplannedColor.from}, ${unplannedColor.to})`
                          }}
                        >
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="text-white text-[10px] px-2 py-1 rounded whitespace-nowrap font-semibold" style={{ backgroundColor: unplannedColor.from }}>
                              {unplannedValue}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-[10px] text-[#A7B8D8] font-semibold text-center">
                      {data.month}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend & Stats */}
            <div className="mt-6 pt-4 border-t border-[#2B416B] grid grid-cols-2 gap-4">
              {selectedTab === 'ikmal' ? (
                <>
                  <div className="bg-[#10B981]/10 rounded-lg p-3 border border-[#10B981]/30">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded bg-[#10B981]"></div>
                      <span className="text-xs font-semibold text-white">Planlı İkmal</span>
                    </div>
                    <div className="text-2xl font-bold text-[#10B981]">{totalPlannedRepl}</div>
                    <div className="text-xs text-[#A7B8D8] mt-1">Toplam (12 Ay)</div>
                  </div>
                  
                  <div className="bg-[#EF4444]/10 rounded-lg p-3 border border-[#EF4444]/30">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded bg-[#EF4444]"></div>
                      <span className="text-xs font-semibold text-white">Plansız İkmal</span>
                    </div>
                    <div className="text-2xl font-bold text-[#EF4444]">{totalUnplannedRepl}</div>
                    <div className="text-xs text-[#A7B8D8] mt-1">Toplam (12 Ay)</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-[#F59E0B]/10 rounded-lg p-3 border border-[#F59E0B]/30">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded bg-[#F59E0B]"></div>
                      <span className="text-xs font-semibold text-white">Planlı Toplama</span>
                    </div>
                    <div className="text-2xl font-bold text-[#F59E0B]">{totalPlannedColl}</div>
                    <div className="text-xs text-[#A7B8D8] mt-1">Toplam (12 Ay)</div>
                  </div>
                  
                  <div className="bg-[#8B5CF6]/10 rounded-lg p-3 border border-[#8B5CF6]/30">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded bg-[#8B5CF6]"></div>
                      <span className="text-xs font-semibold text-white">Plansız Toplama</span>
                    </div>
                    <div className="text-2xl font-bold text-[#8B5CF6]">{totalUnplannedColl}</div>
                    <div className="text-xs text-[#A7B8D8] mt-1">Toplam (12 Ay)</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* AI Insight */}
          <div className="mt-4 bg-purple-500/10 border border-purple-500/30 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <div className="text-xl">🤖</div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-purple-400 mb-1">AI Recommendation</div>
                <div className="text-xs text-[#A7B8D8] leading-relaxed">
                  {selectedTab === 'ikmal' ? (
                    <>
                      Plansız ikmal oranı <strong className="text-[#EF4444]">%{((totalUnplannedRepl / (totalPlannedRepl + totalUnplannedRepl)) * 100).toFixed(1)}</strong>. 
                      <strong className="text-white"> İdeal hedef %20'nin altında olmalı.</strong> Özellikle Haziran ve Kasım aylarında 
                      plansız ikmal sayıları artış gösteriyor. <strong className="text-[#10B981]">AI tahmin modelini optimize ederek</strong> plansız ikmalleri 
                      %30-40 azaltabilir, CIT maliyetlerini düşürebilirsiniz.
                    </>
                  ) : (
                    <>
                      Plansız para toplama oranı <strong className="text-[#8B5CF6]">%{((totalUnplannedColl / (totalPlannedColl + totalUnplannedColl)) * 100).toFixed(1)}</strong>. 
                      <strong className="text-white"> İdeal hedef %20'nin altında olmalı.</strong> Özellikle Haziran ve Kasım aylarında 
                      plansız para toplama sayıları artış gösteriyor. <strong className="text-[#F59E0B]">Nakit seviye tahminlerini iyileştirerek</strong> plansız 
                      toplama operasyonlarını %25-35 azaltabilir, operasyonel verimliliği artırabilirsiniz.
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

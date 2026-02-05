"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

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
  }[];
};

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0E2142] rounded-2xl p-4 shadow-lg ring-1 ring-[#2B416B]">
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
  const [showAllRouteAtms, setShowAllRouteAtms] = useState(false);
  const [showAllNmSlaModal, setShowAllNmSlaModal] = useState(false);
  const [slaDateStart, setSlaDateStart] = useState<string>("2026-02-01");
  const [slaDateEnd, setSlaDateEnd] = useState<string>("2026-02-04");
  const [slaExceededDateStart, setSlaExceededDateStart] = useState<string>("2026-02-04");
  const [slaExceededDateEnd, setSlaExceededDateEnd] = useState<string>("2026-02-04");
  const [operationDateStart, setOperationDateStart] = useState<string>("2026-02-04");
  const [operationDateEnd, setOperationDateEnd] = useState<string>("2026-02-04");
  const [cashFlowDateStart, setCashFlowDateStart] = useState<string>("2026-02-01");
  const [cashFlowDateEnd, setCashFlowDateEnd] = useState<string>("2026-02-04");
  const [trendDateStart, setTrendDateStart] = useState<string>("2026-01-28");
  const [trendDateEnd, setTrendDateEnd] = useState<string>("2026-02-11");
  const [summaryDateStart, setSummaryDateStart] = useState<string>("2026-02-04");
  const [summaryDateEnd, setSummaryDateEnd] = useState<string>("2026-02-11");
  const [topActionsDateStart, setTopActionsDateStart] = useState<string>("2026-02-04");
  const [topActionsDateEnd, setTopActionsDateEnd] = useState<string>("2026-02-11");

  // AI Manual Override Rules
  const [manualCashLimit, setManualCashLimit] = useState<string>("350");
  const [manualRuleDescription, setManualRuleDescription] = useState<string>("");

  // AI Engine states
  const [aiEngineEnabled, setAiEngineEnabled] = useState<boolean>(true);
  const [aiEngineMode, setAiEngineMode] = useState<"auto" | "manual">("auto");
  const [aiEngineStatus, setAiEngineStatus] = useState<"active" | "optimizing" | "idle">("active");


  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fetch("/api/cashflow", { cache: "no-store" });
      const j = (await r.json()) as Payload;
      if (!alive) return;
      setData(j);

      // Fetch ATMs for low cash list
      const atmRes = await fetch("/api/atm-master", { cache: "no-store" });
      const atmData = await atmRes.json();
      const atms = (atmData.atms || []).filter((a: any) => a.active !== false);
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
      const slaExceeded = atms.slice(0, 23).map((a: any) => ({
        atm_id: String(a.atm_id),
        atm_name: a.atm_name || "N/A",
        city: a.city,
        district: a.district,
        cash_level: Math.floor(Math.random() * 15) + 5, // 5-20% remaining
        days_exceeded: Math.floor(Math.random() * 5) + 1, // 1-5 days exceeded
        sla_target: 24, // 24 hours SLA target
        hours_exceeded: Math.floor(Math.random() * 72) + 24, // 24-96 hours exceeded
        latitude: typeof a.latitude === 'string' ? parseFloat(a.latitude.replace(',', '.')) : a.latitude,
        longitude: typeof a.longitude === 'string' ? parseFloat(a.longitude.replace(',', '.')) : a.longitude,
      }));
      
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
    
    // Today route
    const todayOffsiteAtms = centerAtms.filter((a: any) => a.location_type === "Offsite").slice(0, 15);
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
        })),
      });
    }
    
    // Tomorrow route
    const tomorrowOffsiteAtms = centerAtms.filter((a: any) => a.location_type === "Offsite").slice(15, 33);
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
        })),
      });
    }
    
    // Later route
    const laterOffsiteAtms = centerAtms.filter((a: any) => a.location_type === "Offsite").slice(33, 47);
    if (laterOffsiteAtms.length > 0) {
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
        })),
      });
    }
      
    setCitRoutes(routes);
  }, [allCashCenterGroups, selectedCashCenter]);

  return (
    <div className="space-y-4">
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
              <div className="text-2xl font-bold text-white mb-1">AI Cash Optimization Engine</div>
              <div className="text-sm text-[#A7B8D8]">
                Yapay Zeka ile Akıllı Nakit Yönetimi - Dünya Standardı
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
            <div className="bg-[#0E2142]/40 rounded-xl p-5 ring-1 ring-[#2B416B]">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-white">⚡ Otomatik Öneriler (Son 2 Saat)</div>
                <div className="text-xs text-[#10B981] font-bold">12 yeni öneri</div>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {[
                  { id: 1, type: "collection", atm: "ATM-4521", location: "Kadıköy/Moda", priority: "high", reason: "Kaset %89 dolu (Cuma öğleden sonra maaş yoğunluğu tahmini)", eta: "18:00", confidence: 96 },
                  { id: 2, type: "collection", atm: "ATM-8734", location: "Beşiktaş/Levent", priority: "high", reason: "Hafta sonu + AVM lokasyonu, %91 doluluk", eta: "16:30", confidence: 94 },
                  { id: 3, type: "collection", atm: "ATM-2198", location: "Şişli/Mecidiyeköy", priority: "medium", reason: "İş merkezi - Cuma akşam yoğunluk paterni", eta: "19:00", confidence: 92 },
                  { id: 4, type: "replenishment", atm: "ATM-6642", location: "Sarıyer/İstinye", priority: "low", reason: "Pazartesi sabahı tükenmeden önleyici ikmal", eta: "Pzr 22:00", confidence: 88 },
                ].map((rec) => (
                  <div key={rec.id} className="bg-[#112544]/60 rounded-lg p-4 ring-1 ring-[#2B416B] hover:ring-[#2E86FF] transition">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`text-2xl ${rec.type === 'collection' ? '💰' : '📦'}`}>
                          {rec.type === 'collection' ? '💰' : '📦'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{rec.atm}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              rec.priority === 'high' ? 'bg-[#F2B705]/20 text-[#F2B705]' : 
                              rec.priority === 'medium' ? 'bg-[#2E86FF]/20 text-[#2E86FF]' : 
                              'bg-[#10B981]/20 text-[#10B981]'
                            }`}>
                              {rec.priority === 'high' ? 'Yüksek' : rec.priority === 'medium' ? 'Orta' : 'Düşük'}
                            </span>
                          </div>
                          <div className="text-xs text-[#A7B8D8] mt-1">{rec.location}</div>
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
          <Card label="ATMs Tracked" value={data ? data.summary.atms_tracked.toLocaleString("tr-TR") : "…"} />
          <Card label="Total Cash (TRY)" value={data ? `₺${data.summary.total_cash_try.toLocaleString("tr-TR")}` : "…"} />
          <div onClick={() => setShowModal(true)} className="cursor-pointer hover:ring-2 hover:ring-[#2E86FF] transition rounded-2xl">
            <Card label="Low Cash ATMs" value={data ? data.summary.low_cash_atms.toString() : "…"} />
          </div>
          <div onClick={() => setShowShortageModal(true)} className="cursor-pointer hover:ring-2 hover:ring-[#2E86FF] transition rounded-2xl">
            <Card label="Pred. Shortage (7d)" value={data ? data.summary.predicted_shortage_7d.toString() : "…"} />
          </div>
          <div onClick={() => setShowReplModal(true)} className="cursor-pointer hover:ring-2 hover:ring-[#2E86FF] transition rounded-2xl">
            <Card label="Planned Repl. (7d)" value={data ? data.summary.replenishments_planned_7d.toString() : "…"} />
          </div>
        </div>
      </div>

      {/* Heat Map */}
      <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
        <div className="text-sm mb-3">Low Cash ATM Heat Map</div>
        <div className="h-[360px] w-full rounded-xl overflow-hidden ring-1 ring-[#2B416B]">
          <HeatMapComponent lowCashAtms={lowCashAtms} />
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
                <div className="bg-[#F2B705]/10 rounded-lg p-3 ring-1 ring-[#F2B705]/30">
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
                  
                  const filteredRoutes = citRoutes.filter(r => {
                    const routeDate = r.day === "today" ? "2026-02-04" : 
                                     r.day === "tomorrow" ? "2026-02-05" : "2026-02-06";
                    return routeDate >= operationDateStart && routeDate <= operationDateEnd;
                  });
                  
                  const replenishmentAtms = filteredRoutes.reduce((sum, r) => sum + r.atms.filter((a: any) => a.operation === "ikmal").length, 0);
                  const collectionAtms = filteredRoutes.reduce((sum, r) => sum + r.atms.filter((a: any) => a.operation === "toplama").length, 0);
                  const replenishmentRoutes = filteredRoutes.filter(r => r.operation_type === "replenishment").length;
                  const collectionRoutes = filteredRoutes.filter(r => r.operation_type === "collection").length;
                  const avgEfficiency = filteredRoutes.length > 0 ? (filteredRoutes.reduce((sum, r) => sum + r.efficiency_score, 0) / filteredRoutes.length).toFixed(1) : "0";
                  
                  // Create CSV content
                  let csvContent = `Operasyonel Özet Raporu\nTarih Aralığı: ${dateRangeLabel}\nRapor Süresi: ${daysDiff + 1} Gün\n\n`;
                  csvContent += "Metrik,Değer\n";
                  csvContent += `Toplam NM Sayısı,${allCashCenterGroups.length}\n`;
                  csvContent += `Aktif Rota Sayısı,${filteredRoutes.length}\n`;
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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#0E2142]/60 rounded-xl p-5 ring-1 ring-[#2B416B]">
            <div className="flex items-start justify-between mb-3">
              <div className="text-sm text-[#A7B8D8]">Toplam NM Sayısı</div>
              <div className="text-2xl">🏦</div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {allCashCenterGroups.length}
            </div>
            <div className="text-xs text-[#10B981]">
              ↗ {citRoutes.length} aktif rota
            </div>
          </div>

          <div 
            onClick={() => setShowSlaExceededModal(true)}
            className="bg-[#0E2142]/60 rounded-xl p-5 ring-1 ring-[#8B5CF6]/50 cursor-pointer hover:ring-[#8B5CF6] transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-sm text-[#A7B8D8]">SLA Süresi Aşan</div>
              <div className="text-2xl">⚠️</div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {slaExceededAtms.length}
            </div>
            <div className="text-xs text-white">
              ⏰ Acil müdahale gerekli
            </div>
          </div>

          <div 
            onClick={() => {
              setSelectedOperationType("replenishment");
              setShowOperationModal(true);
            }}
            className="bg-[#0E2142]/60 rounded-xl p-5 ring-1 ring-[#2B416B] cursor-pointer hover:ring-[#10B981] transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-sm text-[#A7B8D8]">İkmal Operasyonu</div>
              <div className="text-2xl">💵</div>
            </div>
            <div className="text-3xl font-bold text-[#10B981] mb-1">
              {citRoutes.filter(r => {
                const routeDate = r.day === "today" ? "2026-02-04" : r.day === "tomorrow" ? "2026-02-05" : "2026-02-06";
                return routeDate >= operationDateStart && routeDate <= operationDateEnd;
              }).reduce((sum, r) => sum + r.atms.filter((a: any) => a.operation === "ikmal").length, 0)}
            </div>
            <div className="text-xs text-white/60">
              {citRoutes.filter(r => {
                const routeDate = r.day === "today" ? "2026-02-04" : r.day === "tomorrow" ? "2026-02-05" : "2026-02-06";
                return routeDate >= operationDateStart && routeDate <= operationDateEnd && r.operation_type === "replenishment";
              }).length} rota
            </div>
          </div>

          <div 
            onClick={() => {
              setSelectedOperationType("collection");
              setShowOperationModal(true);
            }}
            className="bg-[#0E2142]/60 rounded-xl p-5 ring-1 ring-[#2B416B] cursor-pointer hover:ring-[#F2B705] transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-sm text-[#A7B8D8]">Para Toplama</div>
              <div className="text-2xl">🚛</div>
            </div>
            <div className="text-3xl font-bold text-[#F2B705] mb-1">
              {citRoutes.filter(r => {
                const routeDate = r.day === "today" ? "2026-02-04" : r.day === "tomorrow" ? "2026-02-05" : "2026-02-06";
                return routeDate >= operationDateStart && routeDate <= operationDateEnd;
              }).reduce((sum, r) => sum + r.atms.filter((a: any) => a.operation === "toplama").length, 0)}
            </div>
            <div className="text-xs text-white/60">
              {citRoutes.filter(r => {
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
              {(citRoutes.reduce((sum, r) => sum + r.efficiency_score, 0) / citRoutes.length).toFixed(0)}%
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
                    <span className="text-white font-semibold">{citRoutes.filter(r => r.operation_type === "replenishment").length}</span>
                  </div>
                  <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                    <div 
                      className="h-2 bg-[#10B981] rounded-full"
                      style={{ width: `${(citRoutes.filter(r => r.operation_type === "replenishment").length / citRoutes.length) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#F2B705]">Para Toplama</span>
                    <span className="text-white font-semibold">{citRoutes.filter(r => r.operation_type === "collection").length}</span>
                  </div>
                  <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                    <div 
                      className="h-2 bg-[#F2B705] rounded-full"
                      style={{ width: `${(citRoutes.filter(r => r.operation_type === "collection").length / citRoutes.length) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#2E86FF]">Karma</span>
                    <span className="text-white font-semibold">{citRoutes.filter(r => r.operation_type === "mixed").length}</span>
                  </div>
                  <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                    <div 
                      className="h-2 bg-[#2E86FF] rounded-full"
                      style={{ width: `${(citRoutes.filter(r => r.operation_type === "mixed").length / citRoutes.length) * 100}%` }}
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
                    <span className="text-white font-semibold">{citRoutes.filter(r => r.status === "in-progress").length}</span>
                  </div>
                  <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                    <div 
                      className="h-2 bg-[#E63946] rounded-full"
                      style={{ width: `${(citRoutes.filter(r => r.status === "in-progress").length / citRoutes.length) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#10B981]">Planlı</span>
                    <span className="text-white font-semibold">
                      {citRoutes.reduce((sum, r) => sum + r.atms.filter((a: any) => a.planned).length, 0)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                    <div 
                      className="h-2 bg-[#10B981] rounded-full"
                      style={{ 
                        width: `${(citRoutes.reduce((sum, r) => sum + r.atms.filter((a: any) => a.planned).length, 0) / 
                                  citRoutes.reduce((sum, r) => sum + r.atms.length, 0)) * 100}%` 
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#F2B705]">Plansız</span>
                    <span className="text-white font-semibold">
                      {citRoutes.reduce((sum, r) => sum + r.atms.filter((a: any) => !a.planned).length, 0)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                    <div 
                      className="h-2 bg-[#F2B705] rounded-full"
                      style={{ 
                        width: `${(citRoutes.reduce((sum, r) => sum + r.atms.filter((a: any) => !a.planned).length, 0) / 
                                  citRoutes.reduce((sum, r) => sum + r.atms.length, 0)) * 100}%` 
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
                    {citRoutes.reduce((sum, r) => sum + r.atms_count, 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">Toplam Mesafe</span>
                  <span className="text-sm font-bold text-white">
                    {citRoutes.reduce((sum, r) => sum + parseInt(r.distance), 0).toLocaleString()} km
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">Avg. Verimlilik</span>
                  <span className="text-sm font-bold text-[#10B981]">
                    {(citRoutes.reduce((sum, r) => sum + r.efficiency_score, 0) / citRoutes.length).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* NM SLA Compliance Table */}
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
                
                const filteredRoutes = citRoutes.filter(r => {
                  const routeDate = r.day === "today" ? "2026-02-04" : 
                                   r.day === "tomorrow" ? "2026-02-05" : "2026-02-06";
                  return routeDate >= routeDateStart && routeDate <= routeDateEnd;
                });
                
                // Create CSV content
                let csvContent = `CIT Rota Detayları Raporu\nTarih Aralığı: ${dateRangeLabel}\nRapor Süresi: ${daysDiff + 1} Gün\nToplam Rota: ${filteredRoutes.length}\n\n`;
                csvContent += "Rota ID,NM Merkezi,Tarih,CIT Şirketi,Ekip,Araç,Operasyon Tipi,Durum,Toplam ATM,Tamamlanan,Verimlilik %,Tahmini Süre,Toplam Nakit\n";
                
                filteredRoutes.forEach((route) => {
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
          {citRoutes.filter(r => {
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
            <div className="text-sm text-white font-semibold">📈 Cash Trend & Forecast</div>
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
            <div className="text-sm text-white font-semibold">⚡ Top Actions</div>
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
                  
                  let csvContent = `Top Actions Raporu\nTarih Aralığı: ${dateRangeLabel}\n\n`;
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
                  link.setAttribute("download", `Top_Actions_${topActionsDateStart}_${topActionsDateEnd}.csv`);
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
              data.top_actions.map((a) => (
                <div key={a.atm_id} className="bg-[#0E2142]/60 rounded-xl p-3 ring-1 ring-[#2B416B]">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">ATM {a.atm_id}</div>
                    <div className="text-xs text-[#A7B8D8]">{a.eta}</div>
                  </div>
                  <div className="text-xs text-white/80 mt-1">{a.atm_name || "N/A"}</div>
                  <div className="text-xs text-white/70 mt-1">
                    {a.city}/{a.district}
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
                      alert(`Cash Task oluşturuldu!\n\nATM: ${a.atm_id}\nLokasyon: ${a.city}/${a.district}\nAksiyon: ${a.action}\nRisk: ${a.risk}\nETA: ${a.eta}`);
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
                      // Calculate critical status for sorting
                      const nearbyA = nearbyAtmsData.find(n => n.atm_id === a.atm_id);
                      const nearbyB = nearbyAtmsData.find(n => n.atm_id === b.atm_id);
                      
                      const isCriticalA = !nearbyA || nearbyA.nearbyAtms.length === 0 || 
                                         (nearbyA.nearbyAtms.length > 0 && nearbyA.nearbyAtms[0].distance > 10);
                      const isCriticalB = !nearbyB || nearbyB.nearbyAtms.length === 0 || 
                                         (nearbyB.nearbyAtms.length > 0 && nearbyB.nearbyAtms[0].distance > 10);
                      
                      // Critical ATMs first
                      if (isCriticalA && !isCriticalB) return -1;
                      if (!isCriticalA && isCriticalB) return 1;
                      return 0;
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
                          {isCritical && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 ring-1 ring-red-500/50">
                              🚨 ACİL
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#A7B8D8]">
                          ID: {atm.atm_id} • {atm.city} / {atm.district}
                        </div>
                        {isCritical && (
                          <div className="text-xs text-red-400 mt-1 font-semibold">
                            ⚠️ Maaş Ödemeli + Yakınında alternatif ATM yok - ACİL ÖNCELİK
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

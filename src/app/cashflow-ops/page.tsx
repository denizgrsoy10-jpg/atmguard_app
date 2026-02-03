"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
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
  const [selectedDay, setSelectedDay] = useState<"today" | "tomorrow" | "later">("today");


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
        latitude: a.latitude,
        longitude: a.longitude,
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
      
      // Mock CIT Routes data
      const todayRoutes = [
        {
          id: "R1",
          name: "Route 1 - Istanbul Central",
          day: "today",
          cit_company: "BANTAŞ",
          team: "CIT Team Alpha",
          vehicle: "TR-34-ABC-123",
          operation_type: "replenishment",
          status: "in-progress",
          progress: 45,
          atms_count: 12,
          completed: 5,
          efficiency_score: 87,
          estimated_time: "3.5h",
          total_cash: "₺4,500,000",
          atms: atms.slice(0, 12).map((a, i) => ({
            ...a,
            order: i + 1,
            operation: "ikmal",
            amount: `₺${(Math.random() * 500000 + 200000).toFixed(0)}`,
          })),
        },
        {
          id: "R2",
          name: "Route 2 - Ankara West",
          day: "today",
          cit_company: "BANTAŞ",
          team: "CIT Team Beta",
          vehicle: "TR-06-XYZ-456",
          operation_type: "collection",
          status: "in-progress",
          progress: 67,
          atms_count: 10,
          completed: 7,
          efficiency_score: 92,
          estimated_time: "2.1h",
          total_cash: "₺3,200,000",
          atms: atms.slice(12, 22).map((a, i) => ({
            ...a,
            order: i + 1,
            operation: "toplama",
            amount: `₺${(Math.random() * 400000 + 150000).toFixed(0)}`,
          })),
        },
        {
          id: "R3",
          name: "Route 3 - Izmir Coast",
          day: "today",
          cit_company: "BANTAŞ",
          team: "CIT Team Gamma",
          vehicle: "TR-35-DEF-789",
          operation_type: "replenishment",
          status: "scheduled",
          progress: 0,
          atms_count: 15,
          completed: 0,
          efficiency_score: 85,
          estimated_time: "4.2h",
          total_cash: "₺5,800,000",
          atms: atms.slice(22, 37).map((a, i) => ({
            ...a,
            order: i + 1,
            operation: "ikmal",
            amount: `₺${(Math.random() * 500000 + 200000).toFixed(0)}`,
          })),
        },
      ];
      
      const tomorrowRoutes = [
        {
          id: "R4",
          name: "Route 4 - Bursa Industrial",
          day: "tomorrow",
          cit_company: "BANTAŞ",
          team: "CIT Team Delta",
          vehicle: "TR-16-GHI-321",
          operation_type: "mixed",
          status: "planned",
          progress: 0,
          atms_count: 18,
          completed: 0,
          efficiency_score: 78,
          estimated_time: "5.5h",
          total_cash: "₺7,200,000",
          atms: atms.slice(37, 55).map((a, i) => ({
            ...a,
            order: i + 1,
            operation: i % 3 === 0 ? "toplama" : "ikmal",
            amount: `₺${(Math.random() * 500000 + 200000).toFixed(0)}`,
          })),
        },
        {
          id: "R5",
          name: "Route 5 - Antalya Tourism",
          day: "tomorrow",
          cit_company: "BANTAŞ",
          team: "CIT Team Epsilon",
          vehicle: "TR-07-JKL-654",
          operation_type: "replenishment",
          status: "planned",
          progress: 0,
          atms_count: 14,
          completed: 0,
          efficiency_score: 82,
          estimated_time: "4.8h",
          total_cash: "₺6,100,000",
          atms: atms.slice(55, 69).map((a, i) => ({
            ...a,
            order: i + 1,
            operation: "ikmal",
            amount: `₺${(Math.random() * 500000 + 200000).toFixed(0)}`,
          })),
        },
      ];
      
      const laterRoutes = [
        {
          id: "R6",
          name: "Route 6 - Adana Central",
          day: "later",
          planned_date: "5 Şubat (2 gün sonra)",
          cit_company: "BANTAŞ",
          team: "CIT Team Zeta",
          vehicle: "TR-01-MNO-987",
          operation_type: "replenishment",
          status: "planned",
          progress: 0,
          atms_count: 16,
          completed: 0,
          efficiency_score: 88,
          estimated_time: "4.5h",
          total_cash: "₺6,800,000",
          atms: atms.slice(69, 85).map((a, i) => ({
            ...a,
            order: i + 1,
            operation: "ikmal",
            amount: `₺${(Math.random() * 500000 + 200000).toFixed(0)}`,
          })),
        },
        {
          id: "R7",
          name: "Route 7 - Konya Industrial",
          day: "later",
          planned_date: "6 Şubat (3 gün sonra)",
          cit_company: "BANTAŞ",
          team: "CIT Team Eta",
          vehicle: "TR-42-PQR-147",
          operation_type: "collection",
          status: "planned",
          progress: 0,
          atms_count: 13,
          completed: 0,
          efficiency_score: 84,
          estimated_time: "3.8h",
          total_cash: "₺4,900,000",
          atms: atms.slice(85, 98).map((a, i) => ({
            ...a,
            order: i + 1,
            operation: "toplama",
            amount: `₺${(Math.random() * 400000 + 150000).toFixed(0)}`,
          })),
        },
        {
          id: "R8",
          name: "Route 8 - Trabzon Coast",
          day: "later",
          planned_date: "7 Şubat (4 gün sonra)",
          cit_company: "BANTAŞ",
          team: "CIT Team Theta",
          vehicle: "TR-61-STU-258",
          operation_type: "mixed",
          status: "planned",
          progress: 0,
          atms_count: 11,
          completed: 0,
          efficiency_score: 79,
          estimated_time: "4.0h",
          total_cash: "₺5,200,000",
          atms: atms.slice(98, 109).map((a, i) => ({
            ...a,
            order: i + 1,
            operation: i % 2 === 0 ? "ikmal" : "toplama",
            amount: `₺${(Math.random() * 500000 + 200000).toFixed(0)}`,
          })),
        },
      ];
      
      setCitRoutes([...todayRoutes, ...tomorrowRoutes, ...laterRoutes]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Summary KPI strip */}
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
          <div className="text-sm">🚚 CIT Route Optimization</div>
          <div className="flex gap-2">
            <button 
              onClick={() => setSelectedDay("today")}
              className={`px-3 py-1 text-xs rounded-lg font-semibold transition ${
                selectedDay === "today" 
                  ? "bg-[#2E86FF] text-white" 
                  : "bg-[#0E2142] text-[#A7B8D8] hover:bg-[#1C2E52]"
              }`}
            >
              Bugün
            </button>
            <button 
              onClick={() => setSelectedDay("tomorrow")}
              className={`px-3 py-1 text-xs rounded-lg font-semibold transition ${
                selectedDay === "tomorrow" 
                  ? "bg-[#2E86FF] text-white" 
                  : "bg-[#0E2142] text-[#A7B8D8] hover:bg-[#1C2E52]"
              }`}
            >
              Yarın
            </button>
            <button 
              onClick={() => setSelectedDay("later")}
              className={`px-3 py-1 text-xs rounded-lg font-semibold transition ${
                selectedDay === "later" 
                  ? "bg-[#2E86FF] text-white" 
                  : "bg-[#0E2142] text-[#A7B8D8] hover:bg-[#1C2E52]"
              }`}
            >
              +Günler
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {citRoutes.filter(r => r.day === selectedDay).map((route) => (
            <div key={route.id} className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B] hover:ring-[#2E86FF] transition">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold text-sm">{route.name}</div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      route.operation_type === "replenishment" ? "bg-[#10B981]/20 text-[#10B981]" :
                      route.operation_type === "collection" ? "bg-[#F2B705]/20 text-[#F2B705]" :
                      "bg-[#2E86FF]/20 text-[#2E86FF]"
                    }`}>
                      {route.operation_type === "replenishment" ? "İkmal" : 
                       route.operation_type === "collection" ? "Para Toplama" : "Karma"}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      route.status === "in-progress" ? "bg-[#E63946]/20 text-[#E63946]" :
                      route.status === "scheduled" ? "bg-[#2E86FF]/20 text-[#2E86FF]" :
                      "bg-[#A7B8D8]/20 text-[#A7B8D8]"
                    }`}>
                      {route.status === "in-progress" ? "Devam Ediyor" : 
                       route.status === "scheduled" ? "Başlıyor" : "Planlı"}
                    </span>
                  </div>
                  <div className="text-xs text-[#A7B8D8] mt-1">
                    🏢 {route.cit_company} • {route.team} • {route.vehicle}
                    {route.planned_date && <span className="ml-2 text-[#10B981]">📅 {route.planned_date}</span>}
                  </div>
                  <div className="text-xs text-white/60 mt-0.5">
                    ℹ️ Rota planlaması ve sıralaması CIT firması tarafından belirlenmektedir
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[#10B981]">{route.efficiency_score}%</div>
                  <div className="text-xs text-[#A7B8D8]">Verimlilik</div>
                </div>
              </div>

              {/* Progress bar */}
              {route.status === "in-progress" && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-[#A7B8D8] mb-1">
                    <span>İlerleme: {route.completed}/{route.atms_count} ATM</span>
                    <span>{route.progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                    <div 
                      className="h-2 bg-gradient-to-r from-[#2E86FF] to-[#10B981] rounded-full transition-all duration-500"
                      style={{ width: `${route.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-[#112544] rounded-lg p-2">
                  <div className="text-xs text-[#A7B8D8]">ATM Sayısı</div>
                  <div className="text-sm font-bold mt-0.5">{route.atms_count}</div>
                </div>
                <div className="bg-[#112544] rounded-lg p-2">
                  <div className="text-xs text-[#A7B8D8]">Tahmini Süre</div>
                  <div className="text-sm font-bold mt-0.5">{route.estimated_time}</div>
                </div>
                <div className="bg-[#112544] rounded-lg p-2">
                  <div className="text-xs text-[#A7B8D8]">Toplam Nakit</div>
                  <div className="text-sm font-bold mt-0.5">{route.total_cash}</div>
                </div>
              </div>

              {/* Optimization suggestions */}
              {route.efficiency_score < 85 && (
                <div className="bg-[#F2B705]/10 rounded-lg p-2 mb-2">
                  <div className="text-xs text-[#F2B705] font-semibold mb-1">💡 Optimizasyon Önerisi</div>
                  <div className="text-xs text-white/80">
                    {route.efficiency_score < 80 
                      ? `Rota sıralaması optimize edilebilir. 3 ATM konum bazlı yeniden sıralanarak ${(85 - route.efficiency_score) * 2} dakika tasarruf edilebilir.`
                      : `2 ATM alternatif güzergaha alınarak ${(90 - route.efficiency_score)} dakika kazanç sağlanabilir.`
                    }
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button className="flex-1 px-3 py-1.5 rounded-lg bg-[#2E86FF]/20 hover:bg-[#2E86FF]/30 text-xs text-[#2E86FF] font-semibold transition ring-1 ring-[#2E86FF]/50">
                  Haritada Göster
                </button>
                <button className="flex-1 px-3 py-1.5 rounded-lg bg-[#10B981]/20 hover:bg-[#10B981]/30 text-xs text-[#10B981] font-semibold transition ring-1 ring-[#10B981]/50">
                  Optimize Et
                </button>
                <button className="px-3 py-1.5 rounded-lg bg-[#0E2142] hover:bg-[#1C2E52] text-xs text-[#A7B8D8] font-semibold transition ring-1 ring-[#2B416B]">
                  Detaylar
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
          <div className="text-sm mb-3">Cash Trend & Forecast (7 days)</div>
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
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm">Top Actions</div>
            <div className="text-xs text-[#A7B8D8]">Replenish / Rebalance</div>
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
                  <button className="mt-3 px-3 py-2 rounded-xl bg-[#2E86FF]/90 hover:bg-[#2E86FF] text-xs font-semibold">
                    Create Cash Task
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Daily/Weekly Cash Flow Table */}
      <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm">Nakit Giriş-Çıkış Tablosu</div>
          <div className="flex gap-2">
            <button 
              onClick={() => setCashFlowView("daily")}
              className={`px-3 py-1 text-xs rounded-lg font-semibold transition ${
                cashFlowView === "daily" 
                  ? "bg-[#2E86FF] text-white" 
                  : "bg-[#0E2142] text-[#A7B8D8] hover:bg-[#1C2E52]"
              }`}
            >
              Günlük
            </button>
            <button 
              onClick={() => setCashFlowView("weekly")}
              className={`px-3 py-1 text-xs rounded-lg font-semibold transition ${
                cashFlowView === "weekly" 
                  ? "bg-[#2E86FF] text-white" 
                  : "bg-[#0E2142] text-[#A7B8D8] hover:bg-[#1C2E52]"
              }`}
            >
              Haftalık
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
                <td className="py-3 px-2">Bugün</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺2,450,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺1,850,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺600,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">187</td>
                <td className="py-3 px-2"><span className="px-2 py-1 rounded-full bg-[#10B981]/20 text-[#10B981] text-xs">Aktif</span></td>
              </tr>
              <tr className="border-b border-[#2B416B]/50 hover:bg-[#0E2142]/40">
                <td className="py-3 px-2">Dün</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺3,120,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺2,340,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺780,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">243</td>
                <td className="py-3 px-2"><span className="px-2 py-1 rounded-full bg-[#2E86FF]/20 text-[#2E86FF] text-xs">Tamamlandı</span></td>
              </tr>
              <tr className="border-b border-[#2B416B]/50 hover:bg-[#0E2142]/40">
                <td className="py-3 px-2">2 gün önce</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺2,890,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺2,980,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#E63946]">-₺90,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">221</td>
                <td className="py-3 px-2"><span className="px-2 py-1 rounded-full bg-[#2E86FF]/20 text-[#2E86FF] text-xs">Tamamlandı</span></td>
              </tr>
              <tr className="border-b border-[#2B416B]/50 hover:bg-[#0E2142]/40">
                <td className="py-3 px-2">3 gün önce</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺3,450,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺2,100,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺1,350,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">256</td>
                <td className="py-3 px-2"><span className="px-2 py-1 rounded-full bg-[#2E86FF]/20 text-[#2E86FF] text-xs">Tamamlandı</span></td>
              </tr>
              <tr className="border-b border-[#2B416B]/50 hover:bg-[#0E2142]/40">
                <td className="py-3 px-2">4 gün önce</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺2,680,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺2,450,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺230,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">198</td>
                <td className="py-3 px-2"><span className="px-2 py-1 rounded-full bg-[#2E86FF]/20 text-[#2E86FF] text-xs">Tamamlandı</span></td>
              </tr>
              <tr className="border-b border-[#2B416B]/50 hover:bg-[#0E2142]/40">
                <td className="py-3 px-2">5 gün önce</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺3,210,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺2,670,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺540,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">234</td>
                <td className="py-3 px-2"><span className="px-2 py-1 rounded-full bg-[#2E86FF]/20 text-[#2E86FF] text-xs">Tamamlandı</span></td>
              </tr>
              <tr className="hover:bg-[#0E2142]/40">
                <td className="py-3 px-2">6 gün önce</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺2,950,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺2,380,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺570,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">217</td>
                <td className="py-3 px-2"><span className="px-2 py-1 rounded-full bg-[#2E86FF]/20 text-[#2E86FF] text-xs">Tamamlandı</span></td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#2B416B]">
                <td className="py-3 px-2 font-bold">7 Gün Toplam</td>
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
                <td className="py-3 px-2">Bu Hafta</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺20,750,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺16,770,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺3,980,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">1,556</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">+₺568,571</td>
              </tr>
              <tr className="border-b border-[#2B416B]/50 hover:bg-[#0E2142]/40">
                <td className="py-3 px-2">Geçen Hafta</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺22,340,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺18,920,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺3,420,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">1,687</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">+₺488,571</td>
              </tr>
              <tr className="border-b border-[#2B416B]/50 hover:bg-[#0E2142]/40">
                <td className="py-3 px-2">2 Hafta Önce</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺21,890,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺19,450,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺2,440,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">1,623</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">+₺348,571</td>
              </tr>
              <tr className="hover:bg-[#0E2142]/40">
                <td className="py-3 px-2">3 Hafta Önce</td>
                <td className="text-right py-3 px-2 text-[#10B981] font-semibold">+₺23,120,000</td>
                <td className="text-right py-3 px-2 text-[#E63946]">-₺20,100,000</td>
                <td className="text-right py-3 px-2 font-bold text-[#10B981]">+₺3,020,000</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">1,745</td>
                <td className="text-right py-3 px-2 text-[#A7B8D8]">+₺431,429</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#2B416B]">
                <td className="py-3 px-2 font-bold">4 Hafta Toplam</td>
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
    </div>
  );
}

// Dynamically imported HeatMap component
const HeatMapComponent = dynamic(
  () => import("./HeatMap"),
  { ssr: false }
);

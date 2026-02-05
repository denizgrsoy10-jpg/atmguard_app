"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import KpiRow from "@/components/KpiRow";
import OverviewBottomStrip from "@/components/OverviewBottomStrip";
import { useTranslation } from "@/hooks/useTranslation";

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
};

type ZoneItem = { zone: string; risk: number };

export default function OverviewPage() {
  const { t } = useTranslation();
  const [atms, setAtms] = useState<ATM[]>([]);
  const [top10, setTop10] = useState<Top10Item[]>([]);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [showOutliers, setShowOutliers] = useState(false);
  const [showZones, setShowZones] = useState(false);
  const [showAiRecommendations, setShowAiRecommendations] = useState(false);
  const [showOffsiteCritical, setShowOffsiteCritical] = useState(false);
  const [showPreventiveMaintenance, setShowPreventiveMaintenance] = useState(false);
  const [selectedBands, setSelectedBands] = useState<("High" | "Medium" | "Low")[]>(
    ["High", "Medium", "Low"]
  );

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
      .then((d) => setTop10(d.items || []))
      .catch(() => setTop10([]));

    fetch("/api/overview-zones", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setZones(d.zones || []))
      .catch(() => setZones([]));
  }, []);

  const center = useMemo<[number, number]>(() => {
    if (!atms.length) return [39.0, 35.0];
    const lat = typeof atms[0].latitude === 'number' ? atms[0].latitude : 39.0;
    const lng = typeof atms[0].longitude === 'number' ? atms[0].longitude : 35.0;
    return [lat, lng];
  }, [atms]);

  const top10Band = useMemo(() => {
    const m = new Map<string, "High" | "Medium" | "Low">();
    top10.forEach((t) => m.set(String(t.atm_id), t.risk_band));
    return m;
  }, [top10]);

  const filteredAtms = useMemo(() => {
    return atms.filter((a) => {
      const band = top10Band.get(String(a.atm_id)) ?? "Low";
      return selectedBands.includes(band);
    });
  }, [atms, top10Band, selectedBands]);

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
      <KpiRow />

      {/* AI Motor Kararları Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          className="bg-gradient-to-br from-[#112544] to-[#0E2142] rounded-2xl p-5 ring-1 ring-[#2B416B] hover:ring-[#2E86FF] transition cursor-pointer"
          onClick={() => setShowAiRecommendations(true)}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-[#A7B8D8]">🤖 {t.overview.aiRecommendations}</div>
            <span className="px-2.5 py-1 rounded-full bg-[#10B981]/20 text-[#10B981] text-xs font-semibold">Aktif</span>
          </div>
          <div className="text-4xl font-bold mb-2">12</div>
          <div className="text-sm text-[#A7B8D8]">{t.overview.slmRecommendations}</div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 bg-[#0E2142] rounded-full overflow-hidden">
              <div className="h-1.5 bg-[#F2B705] rounded-full" style={{ width: "67%" }} />
            </div>
            <span className="text-xs text-[#F2B705] font-semibold">67% {t.overview.confidence}</span>
          </div>
        </div>

        <div 
          className="bg-gradient-to-br from-[#112544] to-[#0E2142] rounded-2xl p-5 ring-1 ring-[#2B416B] hover:ring-[#E63946] transition cursor-pointer"
          onClick={() => setShowOffsiteCritical(true)}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-[#A7B8D8]">🚨 {t.overview.offsiteCritical}</div>
            <span className="px-2.5 py-1 rounded-full bg-[#E63946]/20 text-[#E63946] text-xs font-semibold">Yüksek Risk</span>
          </div>
          <div className="text-4xl font-bold mb-2 text-[#E63946]">8</div>
          <div className="text-sm text-[#A7B8D8]">ATM risk altında</div>
          <div className="mt-3 text-xs text-[#F2B705]">
            ⚡ 3 ATM için {t.overview.urgent} müdahale gerekli
          </div>
        </div>

        <div 
          className="bg-gradient-to-br from-[#112544] to-[#0E2142] rounded-2xl p-5 ring-1 ring-[#2B416B] hover:ring-[#10B981] transition cursor-pointer"
          onClick={() => setShowPreventiveMaintenance(true)}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-[#A7B8D8]">💡 {t.overview.preventiveMaintenance}</div>
            <span className="px-2.5 py-1 rounded-full bg-[#2E86FF]/20 text-[#2E86FF] text-xs font-semibold">{t.overview.planned}</span>
          </div>
          <div className="text-4xl font-bold mb-2 text-[#10B981]">{preventiveMaintenanceAtms.length}</div>
          <div className="text-sm text-[#A7B8D8]">{t.overview.preventiveSlm}</div>
          <div className="mt-3 text-xs text-[#10B981]">
            💰 Tahmini {t.overview.savings}: ${preventiveMaintenanceAtms.reduce((sum, r) => sum + (r.expected_saving_try / TRY_PER_USD), 0).toFixed(0)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* LEFT COLUMN - MAP + RISK BY ZONE */}
        <div className="col-span-12 xl:col-span-7 grid grid-rows-6 gap-4 min-h-0">
          {/* MAP */}
          <div className="row-span-4 bg-[#112544] rounded-2xl p-0 ring-1 ring-[#2B416B] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#2B416B]">
              <div className="text-sm text-[#E6EEF8]">{t.overview.atmRiskMap}</div>

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
              />
            </div>
          </div>

          {/* Risk by Zone */}
          <div
            className="row-span-2 bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B] cursor-pointer hover:ring-2 hover:ring-[#2E86FF] transition"
            onClick={() => setShowZones(true)}
          >
            <div className="text-sm mb-3">{t.overview.riskByZone}</div>

            <div className="space-y-3">
              {zones.length === 0 ? (
                <div className="text-[#A7B8D8] text-sm">{t.common.loading}</div>
              ) : (
                zones.map((z) => (
                  <div key={z.zone}>
                    <div className="flex justify-between text-xs text-[#A7B8D8] mb-1">
                      <span>{z.zone}</span>
                      <span>{Math.round(z.risk * 100)}%</span>
                    </div>
                    <div className="h-2 w-full bg-[#0E2142] rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-[#2E86FF] rounded-full"
                        style={{ width: `${Math.round(z.risk * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - TOP 10 + OUTLIERS */}
        <div className="col-span-12 xl:col-span-5 grid grid-rows-6 gap-4 min-h-0">

          {/* Top 10 Risky ATMs */}
          <div className="row-span-5 bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B] flex flex-col">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div className="text-sm font-semibold">{t.overview.top10RiskyAtms}</div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981]">{t.overview.aiMotor}</span>
              </div>
            </div>

            {/* Headers */}
            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[#2B416B] flex-shrink-0">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-[10px] text-[#A7B8D8] font-semibold w-12">{t.overview.atmId}</span>
                <span className="text-[10px] text-[#A7B8D8] font-semibold flex-1">{t.overview.atmName} / {t.cashflow.city}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#A7B8D8] font-semibold w-10 text-center">{t.overview.risk}</span>
                <span className="text-[10px] text-[#A7B8D8] font-semibold w-10 text-right">{t.overview.gain}</span>
                <span className="text-[10px] text-[#A7B8D8] font-semibold w-14 text-center">{t.overview.aiMotor}</span>
              </div>
            </div>

            {top10.length === 0 ? (
              <div className="text-[#A7B8D8] text-sm">{t.common.loading}</div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                {top10.map((r) => {
                  const pct = Math.round(r.slm_prob * 100);
                  const riskColor =
                    r.risk_band === "High" ? "text-[#F2B705]" :
                    r.risk_band === "Medium" ? "text-[#2E86FF]" : "text-white/70";
                  
                  const aiDecisionText = pct > 70 ? t.overview.slmRequired : pct > 40 ? t.overview.flmToSlm : t.overview.flmSufficient;
                  const aiColor = pct > 70 ? "text-[#E63946]" : pct > 40 ? "text-[#F2B705]" : "text-[#10B981]";

                  return (
                    <div
                      key={String(r.atm_id)}
                      className="bg-[#0E2142]/60 rounded-lg p-2 ring-1 ring-[#2B416B] hover:bg-[#1C2E52] transition-colors"
                      title={`${r.atm_name}\n${r.city} / ${r.district}\nReason: ${r.reason}\nSLM Prob: ${r.slm_prob.toFixed(2)}\nExpected Saving: $${(r.expected_saving_try / TRY_PER_USD).toFixed(2)}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-bold text-white text-[11px] flex-shrink-0">{r.atm_id}</span>
                          <span className="text-white/80 text-[10px] truncate">{r.atm_name}</span>
                          <span className="text-white/50 text-[9px] flex-shrink-0">({r.city})</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`font-semibold text-[9px] ${riskColor} w-10 text-center`}>{r.risk_band}</span>
                          <span className="text-[#2E86FF] font-bold text-[11px] w-10 text-right">${(r.expected_saving_try / TRY_PER_USD).toFixed(0)}</span>
                          <span className={`text-[9px] font-semibold ${aiColor} w-14 text-center`}>{aiDecisionText}</span>
                        </div>
                      </div>
                      
                      <div className="text-[#A7B8D8] text-[9px] italic mb-1 truncate">{r.reason}</div>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-[#0E2142] rounded-full overflow-hidden">
                          <div className="h-full bg-[#2E86FF] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[9px] text-[#E6EEF8] w-7 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Outliers */}
          <div className="row-span-1 bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B] flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">{t.overview.outliers}</div>
              <div className="text-xs text-[#A7B8D8]">ATM anomalileri ve uyarılar</div>
            </div>
            <button
              onClick={() => setShowOutliers(true)}
              className="px-3 py-2 rounded-xl bg-[#2E86FF]/90 hover:bg-[#2E86FF] text-xs"
            >
              {t.overview.show}
            </button>
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

      <OverviewBottomStrip />
    </div>
  );
}

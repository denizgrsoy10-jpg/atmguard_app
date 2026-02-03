"use client";

import { useEffect, useState } from "react";

type ATM = {
  atm_id: string;
  atm_name?: string;
  city: string;
  district: string;
  active?: boolean;
  location_type?: string;
  brand?: string;
};

type Alert = {
  id: string;
  atm_id: string;
  atm_name?: string;
  city: string;
  district: string;
  severity: "High" | "Medium" | "Low";
  title: string;
  summary: string;
  action: string;
  eta: string;
};

export default function CommandCenterPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [atms, setAtms] = useState<ATM[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/atm-master", { cache: "no-store" });
        const j = await r.json();
        const atmList = (j.atms || []) as ATM[];
        const activeAtms = atmList.filter((a) => a.active !== false);

        if (!alive) return;
        setAtms(activeAtms);

        const titles = ["CCDM Jam Tekrarı", "Sensor / Reset Etkisiz", "Network Timeout"] as const;
        const summaries = [
          "Son 7 günde 3 FLM + jam trendi",
          "Reset sonrası hata tekrarı",
          "Bağlantı kopmaları artıyor",
        ] as const;
        const actions = ["Dispatch SLM", "Remote Check", "Monitor"] as const;
        const etas = ["Today", "24h", "48h"] as const;
        const severities = ["High", "Medium", "Low"] as const;

        const mapped = activeAtms.slice(0, 3).map((a, idx) => ({
          id: `A-${1001 + idx}`,
          atm_id: String(a.atm_id),
          atm_name: a.atm_name || "N/A",
          city: a.city,
          district: a.district,
          severity: severities[idx % severities.length],
          title: titles[idx % titles.length],
          summary: summaries[idx % summaries.length],
          action: actions[idx % actions.length],
          eta: etas[idx % etas.length],
        }));

        if (!alive) return;
        setAlerts(mapped);
      } catch {
        if (!alive) return;
        setAlerts([]);
        setAtms([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
        <div className="text-lg font-semibold">Command Center</div>
        <div className="text-sm text-[#A7B8D8]">
          Proaktif alarmlar, aksiyonlar ve dispatch yönetimi
        </div>
      </div>

      {/* FLM/SLM DISPATCH ÖNERİLERİ */}
      <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold">FLM/SLM Dispatch Önerileri</div>
            <div className="text-xs text-[#A7B8D8] mt-1">Motor tarafından önceliklendirilmiş müdahale önerileri</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981]">Motor</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E63946]/20 text-[#E63946]">12 Urgent</span>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {/* SLM Gerekli - Urgent */}
          {atms.slice(0, 1).map((atm) => (
            <div key={`slm-urgent-1-${atm.atm_id}`} className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#E63946]/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#E63946]">🚨 SLM Gerekli</span>
                  <span className="text-[10px] text-white/60">ATM {atm.atm_id}</span>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#E63946]/20 text-[#E63946]">Urgent</span>
              </div>
              <div className="text-[11px] text-white/80 mb-2">{atm.city} - {atm.district}</div>
              <div className="text-[10px] text-[#A7B8D8] mb-2">
                <span className="font-semibold text-white">CCDM Jam:</span> 3 FLM başarısız, sürekli tekrar
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[9px] text-[#A7B8D8]">Vendor: <span className="text-white">{atm.brand || "HITACHI"}</span></div>
                <button className="px-3 py-1 rounded-lg bg-[#E63946] hover:bg-[#D32F3E] text-[10px] font-semibold transition">
                  🔧 {atm.brand || "HITACHI"} SLM
                </button>
              </div>
            </div>
          ))}

          {/* SLM Gerekli - High Risk */}
          {atms.slice(1, 2).map((atm) => (
            <div key={`slm-urgent-2-${atm.atm_id}`} className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#E63946]/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#E63946]">🚨 SLM Gerekli</span>
                  <span className="text-[10px] text-white/60">ATM {atm.atm_id}</span>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#E63946]/20 text-[#E63946]">Urgent</span>
              </div>
              <div className="text-[11px] text-white/80 mb-2">{atm.city} - {atm.district}</div>
              <div className="text-[10px] text-[#A7B8D8] mb-2">
                <span className="font-semibold text-white">Network Module:</span> Reset etkisiz, 4x tekrar
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[9px] text-[#A7B8D8]">Vendor: <span className="text-white">{atm.brand || "GRG"}</span></div>
                <button className="px-3 py-1 rounded-lg bg-[#E63946] hover:bg-[#D32F3E] text-[10px] font-semibold transition">
                  🔧 {atm.brand || "GRG"} SLM
                </button>
              </div>
            </div>
          ))}

          {/* FLM→SLM Geçiş */}
          {atms.slice(2, 3).map((atm) => (
            <div key={`flm-slm-${atm.atm_id}`} className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#F2B705]/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#F2B705]">⚠️ FLM→SLM</span>
                  <span className="text-[10px] text-white/60">ATM {atm.atm_id}</span>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#F2B705]/20 text-[#F2B705]">Medium</span>
              </div>
              <div className="text-[11px] text-white/80 mb-2">{atm.city} - {atm.district}</div>
              <div className="text-[10px] text-[#A7B8D8] mb-2">
                <span className="font-semibold text-white">Receipt Printer:</span> FLM 2x denendi, şüpheli
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[9px] text-[#A7B8D8]">Öneri: <span className="text-white">FLM dene, hazırda {atm.brand || "HITACHI"}</span></div>
                <button className="px-3 py-1 rounded-lg bg-[#F2B705] hover:bg-[#D9A005] text-[10px] font-semibold transition">
                  🚗 BANTAŞ FLM
                </button>
              </div>
            </div>
          ))}

          {/* FLM Yeterli */}
          {atms.slice(3, 4).map((atm) => (
            <div key={`flm-ok-${atm.atm_id}`} className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#10B981]/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#10B981]">✅ FLM Yeterli</span>
                  <span className="text-[10px] text-white/60">ATM {atm.atm_id}</span>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981]">Low</span>
              </div>
              <div className="text-[11px] text-white/80 mb-2">{atm.city} - {atm.district}</div>
              <div className="text-[10px] text-[#A7B8D8] mb-2">
                <span className="font-semibold text-white">Card Reader:</span> Basit temizlik gerekli
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[9px] text-[#A7B8D8]">FLM başarı: <span className="text-white">85%</span></div>
                <button className="px-3 py-1 rounded-lg bg-[#10B981] hover:bg-[#0E9F6E] text-[10px] font-semibold transition">
                  🚗 BANTAŞ FLM
                </button>
              </div>
            </div>
          ))}

          {/* Önleyici Bakım */}
          {atms.slice(4, 5).map((atm) => (
            <div key={`preventive-${atm.atm_id}`} className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2E86FF]/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#2E86FF]">🔧 Önleyici Bakım</span>
                  <span className="text-[10px] text-white/60">ATM {atm.atm_id}</span>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#2E86FF]/20 text-[#2E86FF]">Planned</span>
              </div>
              <div className="text-[11px] text-white/80 mb-2">{atm.city} - {atm.district}</div>
              <div className="text-[10px] text-[#A7B8D8] mb-2">
                <span className="font-semibold text-white">Dispenser Module:</span> 7 gün içinde arıza riski yüksek
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[9px] text-[#A7B8D8]">Vendor: <span className="text-white">{atm.brand || "HITACHI"}</span></div>
                <button className="px-3 py-1 rounded-lg bg-[#2E86FF] hover:bg-[#1F6FE0] text-[10px] font-semibold transition">
                  🔧 {atm.brand || "HITACHI"} SLM
                </button>
              </div>
            </div>
          ))}

          {/* OFFSITE Kritik */}
          {atms.filter(a => a.location_type === "Offsite").slice(0, 1).map((atm) => (
            <div key={`offsite-${atm.atm_id}`} className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#E63946]/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#E63946]">🚨 OFFSITE Kritik</span>
                  <span className="text-[10px] text-white/60">ATM {atm.atm_id}</span>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#E63946]/20 text-[#E63946]">Urgent</span>
              </div>
              <div className="text-[11px] text-white/80 mb-2">{atm.city} - {atm.district} (OFFSITE)</div>
              <div className="text-[10px] text-[#A7B8D8] mb-2">
                <span className="font-semibold text-white">Cash Dispenser:</span> BANTAŞ FLM → {atm.brand || "HITACHI"} SLM gerekebilir
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[9px] text-[#A7B8D8]">BANTAŞ: <span className="text-white">Hazır ekip</span></div>
                <button className="px-3 py-1 rounded-lg bg-[#E63946] hover:bg-[#D32F3E] text-[10px] font-semibold transition">
                  🚗 BANTAŞ FLM
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ACTIVE ALERTS */}
      <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Active Alerts</div>
          <div className="text-xs text-[#A7B8D8]">Live (mock)</div>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="text-[#A7B8D8] text-sm">Loading…</div>
          ) : alerts.length === 0 ? (
            <div className="text-[#A7B8D8] text-sm">No alerts</div>
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                className="rounded-xl bg-[#0E2142] p-3 ring-1 ring-[#2B416B] hover:bg-[#1C2E52] transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">
                      ATM {a.atm_id} — {a.atm_name}
                    </div>
                    <div className="text-xs text-[#A7B8D8] mt-1">
                      {a.city} / {a.district}
                    </div>
                    <div className="text-xs text-[#A7B8D8]">
                      {a.title}
                    </div>
                  </div>

                  <div
                    className={
                      "px-3 py-1 rounded-lg text-xs font-semibold " +
                      (a.severity === "High"
                        ? "bg-red-500/20 text-red-400"
                        : a.severity === "Medium"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-blue-500/20 text-blue-400")
                    }
                  >
                    {a.severity}
                  </div>
                </div>

                <div className="text-sm text-[#E6EEF8] mt-2">
                  {a.summary}
                </div>

                <div className="flex items-center justify-between mt-3 text-xs">
                  <div className="text-[#A7B8D8]">
                    Action:{" "}
                    <span className="text-white font-semibold">
                      {a.action}
                    </span>
                  </div>
                  <div className="text-[#A7B8D8]">
                    ETA:{" "}
                    <span className="text-white font-semibold">
                      {a.eta}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
          <div className="text-sm font-semibold mb-2">Dispatch</div>
          <div className="text-xs text-[#A7B8D8] mb-3">
            SLM / FLM aksiyon başlat
          </div>
          <button className="w-full px-3 py-2 rounded-xl bg-[#2E86FF] hover:bg-[#1F6FE0] transition text-sm">
            Create Dispatch
          </button>
        </div>

        <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
          <div className="text-sm font-semibold mb-2">Remote Ops</div>
          <div className="text-xs text-[#A7B8D8] mb-3">
            Reset / test / config
          </div>
          <button className="w-full px-3 py-2 rounded-xl bg-[#2E86FF] hover:bg-[#1F6FE0] transition text-sm">
            Run Remote Action
          </button>
        </div>

        <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
          <div className="text-sm font-semibold mb-2">Escalation</div>
          <div className="text-xs text-[#A7B8D8] mb-3">
            SLA / yönetici bildirimi
          </div>
          <button className="w-full px-3 py-2 rounded-xl bg-[#2E86FF] hover:bg-[#1F6FE0] transition text-sm">
            Escalate
          </button>
        </div>
      </div>
    </div>
  );
}

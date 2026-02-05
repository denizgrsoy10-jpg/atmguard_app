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

type Operator = {
  id: string;
  name: string;
  role: string;
  nms: string[];
  nmCenters: string[];
  atmCount: number;
  ikmal: number;
  toplama: number;
  status: string;
  coordination: string;
  avgSla: number;
  color: string;
  colorHover: string;
};

export default function CommandCenterPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [atms, setAtms] = useState<ATM[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Gerçek NM listesi (cash_center'lardan)
  const allNMs = [
    "ADANA", "AFYON", "ALANYA", "ANKARA", "ANTALYA", "AYDIN", "BALIKESİR",
    "BEYLİKDÜZÜ", "BODRUM", "BOLU", "BURSA", "ÇANAKKALE", "ÇORLU", "ÇORUM",
    "DENİZLİ", "DİYARBAKIR", "EDİRNE", "ELAZIĞ", "ERZURUM", "ESKİŞEHİR",
    "GAZİANTEP", "GİYİMKENT", "GÜNEŞLİ", "İSKENDERUN", "ISPARTA", "İZMİR",
    "İZMİT", "KAHRAMAARAŞ", "KASTAMONU", "KAYSERİ", "KONYA", "KOZYATAĞI",
    "MALATYA", "MALTEPE", "MASLAK", "MERSİN", "MUĞLA", "ORDU", "SAMSUN",
    "ŞANLIURFA", "SİVAS", "ŞUBE", "TRABZON", "ÜMRANİYE", "UŞAK", "VAN",
    "ZONGULDAK"
  ];
  
  // NM Merkezleri (ana merkezler)
  const allNMCenters = [
    "ADANA NM", "ANKARA NM", "ANTALYA NM", "BURSA NM", "DENİZLİ NM",
    "GAZİANTEP NM", "İZMİR NM", "KAYSERİ NM", "KONYA NM", "MALATYA NM",
    "SAMSUN NM", "TRABZON NM", "BEYLİKDÜZÜ NM", "GÜNEŞLİ NM", "KOZYATAĞI NM",
    "MALTEPE NM", "MASLAK NM", "ÜMRANİYE NM"
  ];
  
  const [operators, setOperators] = useState<Operator[]>([
    {
      id: "guneri",
      name: "Güneri Kerim",
      role: "Lider",
      nms: ["KOZYATAĞI", "MALTEPE", "ÜMRANİYE"],
      nmCenters: ["KOZYATAĞI NM", "MALTEPE NM"],
      atmCount: 45,
      ikmal: 8,
      toplama: 12,
      status: "active",
      coordination: "🚚 Bantaş Ekip-3 ile koordinasyon - Kadıköy bölgesi para toplama",
      avgSla: 2.3,
      color: "#2E86FF",
      colorHover: "#1F6FE0",
    },
    {
      id: "murat",
      name: "Murat",
      role: "Operatör",
      nms: ["BEYLİKDÜZÜ", "GÜNEŞLİ", "MASLAK"],
      nmCenters: ["BEYLİKDÜZÜ NM", "GÜNEŞLİ NM"],
      atmCount: 52,
      ikmal: 11,
      toplama: 15,
      status: "active",
      coordination: "⚠️ Kritik ATM takibi - Bakırköy 2 ATM SLA aşımı",
      avgSla: 2.8,
      color: "#F2B705",
      colorHover: "#F59E0B",
    },
    {
      id: "ozlem",
      name: "Özlem",
      role: "Operatör",
      nms: ["ANKARA", "ESKİŞEHİR", "KONYA"],
      nmCenters: ["ANKARA NM", "KONYA NM"],
      atmCount: 41,
      ikmal: 7,
      toplama: 10,
      status: "active",
      coordination: "🚚 Bantaş Ekip-7 yönlendirme - Kartal AVM ikmal",
      avgSla: 2.1,
      color: "#8B5CF6",
      colorHover: "#7C3AED",
    },
    {
      id: "gizem",
      name: "Gizem",
      role: "Operatör",
      nms: ["İZMİR", "AYDIN", "DENİZLİ"],
      nmCenters: ["İZMİR NM", "DENİZLİ NM"],
      atmCount: 47,
      ikmal: 6,
      toplama: 14,
      status: "active",
      coordination: "📊 Performans analizi - Beyoğlu bölge raporu",
      avgSla: 1.9,
      color: "#EC4899",
      colorHover: "#DB2777",
    },
    {
      id: "nurgul",
      name: "Nurgül",
      role: "Operatör",
      nms: ["BURSA", "BALIKESİR", "ÇANAKKALE"],
      nmCenters: ["BURSA NM"],
      atmCount: 36,
      ikmal: 4,
      toplama: 8,
      status: "active",
      coordination: "🚚 Bantaş Ekip-5 koordine - Sancaktepe rota",
      avgSla: 2.6,
      color: "#06B6D4",
      colorHover: "#0891B2",
    },
  ]);
  const [editingOperator, setEditingOperator] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"nms" | "nmCenters" | "avgSla" | null>(null);
  const [newValue, setNewValue] = useState("");

  const handleAddItem = (operatorId: string, field: "nms" | "nmCenters" | "avgSla") => {
    setEditingOperator(operatorId);
    setEditingField(field);
    if (field === "avgSla") {
      const op = operators.find(o => o.id === operatorId);
      setNewValue(op?.avgSla.toString() || "");
    } else {
      setNewValue("");
    }
  };

  const handleSaveItem = () => {
    if (!editingOperator || !editingField || !newValue.trim()) return;
    
    setOperators(prev => prev.map(op => {
      if (op.id === editingOperator) {
        if (editingField === "avgSla") {
          return {
            ...op,
            avgSla: parseFloat(newValue) || op.avgSla
          };
        }
        return {
          ...op,
          [editingField]: [...op[editingField], newValue.trim()]
        };
      }
      return op;
    }));
    
    setEditingOperator(null);
    setEditingField(null);
    setNewValue("");
  };

  const handleRemoveItem = (operatorId: string, field: "nms" | "nmCenters", value: string) => {
    setOperators(prev => prev.map(op => {
      if (op.id === operatorId) {
        return {
          ...op,
          [field]: op[field].filter(item => item !== value)
        };
      }
      return op;
    }));
  };

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

      {/* EKİP YÖNETİMİ - OPERATÖR MASASI */}
      <div className="bg-[#112544] rounded-2xl p-6 ring-1 ring-[#2B416B]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-lg font-semibold flex items-center gap-2">
              🎯 Operasyon İzleme Yönetimi
            </div>
            <div className="text-xs text-[#A7B8D8] mt-1">
              ATM izleme, ikmal/toplama yönetimi ve Bantaş koordinasyonu
            </div>
          </div>
          <button className="px-4 py-2 rounded-lg bg-[#2E86FF] hover:bg-[#1F6FE0] text-white text-sm font-semibold transition">
            + Yeni Lider
          </button>
        </div>

        {/* Operatör Kartları */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {operators.map((operator) => (
            <div key={operator.id} className={`bg-gradient-to-br from-[${operator.color}]/20 to-[${operator.colorHover}]/10 rounded-xl p-5 ring-1 ring-[${operator.color}]/50`}>
              {/* Card header with avatar and status */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold`} style={{background: `linear-gradient(to br, ${operator.color}, ${operator.colorHover})`}}>
                    {operator.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-white">{operator.name}</div>
                    <div className="text-xs text-[#A7B8D8]">{operator.role}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#10B981] rounded-full animate-pulse"></div>
                  <span className="text-xs text-[#10B981]">Aktif</span>
                </div>
              </div>

              {/* Sorumlu NM'ler section */}
              <div className="bg-[#0E2142]/60 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-[#A7B8D8]">Sorumlu NM&apos;ler</div>
                  <button 
                    onClick={() => handleAddItem(operator.id, 'nms')}
                    className="text-xs hover:opacity-80 transition" 
                    style={{color: operator.color}}
                  >
                    + Ekle
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {editingOperator === operator.id && editingField === 'nms' && (
                    <div className="flex items-center gap-1 mb-2 w-full">
                      <select
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        className="flex-1 px-2 py-1 rounded bg-[#0E2142] text-white text-xs border border-[#2B416B] focus:outline-none focus:border-[#2E86FF]"
                        autoFocus
                      >
                        <option value="">NM seçin...</option>
                        {allNMs.filter(nm => !operator.nms.includes(nm)).map(nm => (
                          <option key={nm} value={nm}>{nm}</option>
                        ))}
                      </select>
                      <button onClick={handleSaveItem} className="px-2 py-1 rounded bg-[#10B981] text-white text-xs">✓</button>
                      <button onClick={() => { setEditingOperator(null); setEditingField(null); }} className="px-2 py-1 rounded bg-[#EF4444] text-white text-xs">✕</button>
                    </div>
                  )}
                  {operator.nms.map((nm) => (
                    <span 
                      key={nm} 
                      className="px-2 py-1 rounded text-xs text-white flex items-center gap-1 group"
                      style={{backgroundColor: `${operator.color}4D`}}
                    >
                      {nm}
                      <button 
                        onClick={() => handleRemoveItem(operator.id, 'nms', nm)}
                        className="opacity-0 group-hover:opacity-100 text-white/70 hover:text-white transition"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* NM Merkezleri section */}
              <div className="bg-[#0E2142]/60 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-[#A7B8D8]">NM Merkezleri</div>
                  <button 
                    onClick={() => handleAddItem(operator.id, 'nmCenters')}
                    className="text-xs text-[#10B981] hover:text-[#059669]"
                  >
                    + Ekle
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {editingOperator === operator.id && editingField === 'nmCenters' && (
                    <div className="flex items-center gap-1 mb-2 w-full">
                      <select
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        className="flex-1 px-2 py-1 rounded bg-[#0E2142] text-white text-xs border border-[#2B416B] focus:outline-none focus:border-[#2E86FF]"
                        autoFocus
                      >
                        <option value="">NM Merkezi seçin...</option>
                        {allNMCenters.filter(center => !operator.nmCenters.includes(center)).map(center => (
                          <option key={center} value={center}>{center}</option>
                        ))}
                      </select>
                      <button onClick={handleSaveItem} className="px-2 py-1 rounded bg-[#10B981] text-white text-xs">✓</button>
                      <button onClick={() => { setEditingOperator(null); setEditingField(null); }} className="px-2 py-1 rounded bg-[#EF4444] text-white text-xs">✕</button>
                    </div>
                  )}
                  {operator.nmCenters.map((center) => (
                    <span 
                      key={center} 
                      className="px-2 py-1 rounded bg-[#10B981]/30 text-xs text-white flex items-center gap-1 group"
                    >
                      {center}
                      <button 
                        onClick={() => handleRemoveItem(operator.id, 'nmCenters', center)}
                        className="opacity-0 group-hover:opacity-100 text-white/70 hover:text-white transition"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* SLA Ortalaması */}
              <div className="bg-[#0E2142]/60 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-[#A7B8D8]">Ortalama SLA Süresi</div>
                  <button 
                    onClick={() => handleAddItem(operator.id, 'avgSla')}
                    className="text-xs text-[#F2B705] hover:text-[#F59E0B]"
                  >
                    ✏️ Düzenle
                  </button>
                </div>
                {editingOperator === operator.id && editingField === 'avgSla' ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveItem()}
                      placeholder="SLA süresi (saat)..."
                      className="flex-1 px-2 py-1 rounded bg-[#0E2142] text-white text-xs border border-[#2B416B] focus:outline-none focus:border-[#2E86FF]"
                      autoFocus
                    />
                    <button onClick={handleSaveItem} className="px-2 py-1 rounded bg-[#10B981] text-white text-xs">✓</button>
                    <button onClick={() => { setEditingOperator(null); setEditingField(null); }} className="px-2 py-1 rounded bg-[#EF4444] text-white text-xs">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-white">{operator.avgSla}</div>
                    <div className="text-xs text-[#A7B8D8]">saat</div>
                    <div className={`ml-auto px-2 py-1 rounded text-xs font-semibold ${
                      operator.avgSla <= 2.0 ? 'bg-[#10B981]/20 text-[#10B981]' :
                      operator.avgSla <= 2.5 ? 'bg-[#F2B705]/20 text-[#F2B705]' :
                      'bg-[#EF4444]/20 text-[#EF4444]'
                    }`}>
                      {operator.avgSla <= 2.0 ? '✓ İyi' : operator.avgSla <= 2.5 ? '⚠ Orta' : '✗ Yüksek'}
                    </div>
                  </div>
                )}
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-[#0E2142]/60 rounded-lg p-2 text-center">
                  <div className="text-xs text-[#A7B8D8]">ATM</div>
                  <div className="text-lg font-bold text-white">{operator.atmCount}</div>
                </div>
                <div className="bg-[#0E2142]/60 rounded-lg p-2 text-center">
                  <div className="text-xs text-[#A7B8D8]">İkmal</div>
                  <div className="text-lg font-bold text-[#2E86FF]">{operator.ikmal}</div>
                </div>
                <div className="bg-[#0E2142]/60 rounded-lg p-2 text-center">
                  <div className="text-xs text-[#A7B8D8]">Toplama</div>
                  <div className="text-lg font-bold text-[#F2B705]">{operator.toplama}</div>
                </div>
              </div>

              {/* Active coordination */}
              <div className="text-xs text-[#A7B8D8] mb-2">Aktif Koordinasyon</div>
              <div className="rounded-lg p-2 ring-1" style={{backgroundColor: `${operator.color}33`, borderColor: `${operator.color}80`}}>
                <div className="text-xs font-semibold" style={{color: operator.color}}>{operator.coordination}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Operasyon Özeti */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-6 gap-4">
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-xs text-[#A7B8D8] mb-2">Lider</div>
            <div className="text-3xl font-bold text-white">1</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-xs text-[#A7B8D8] mb-2">Operatör</div>
            <div className="text-3xl font-bold text-white">4</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-xs text-[#A7B8D8] mb-2">Aktif Masa</div>
            <div className="text-3xl font-bold text-[#10B981]">5</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-xs text-[#A7B8D8] mb-2">Toplam İkmal</div>
            <div className="text-3xl font-bold text-[#2E86FF]">41</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-xs text-[#A7B8D8] mb-2">Toplam Toplama</div>
            <div className="text-3xl font-bold text-[#F2B705]">68</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-xs text-[#A7B8D8] mb-2">Bantaş Koordinasyon</div>
            <div className="text-3xl font-bold text-[#10B981]">4</div>
          </div>
        </div>
      </div>
    </div>
  );
}

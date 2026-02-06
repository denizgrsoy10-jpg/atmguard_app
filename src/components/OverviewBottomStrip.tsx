"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type MetricInfo = {
  title: string;
  description: string;
  purpose: string;
  interpretation: string;
};

const OVERVIEW_METRIC_EXPLANATIONS: Record<string, MetricInfo> = {
  "sla_breach_risk": {
    title: "SLA Breach Risk (SLA İhlal Riski)",
    description: "Servis Seviyesi Anlaşması (SLA) ihlal riski taşıyan ticket'ların risk seviyesine göre dağılımı.",
    purpose: "SLA taahhütlerini karşılayamama riskini ölçmek. Hangi ticket'lar SLA sürelerini aşmak üzere?",
    interpretation: "Low/Medium/High dağılımı. High %30+ ise UYARI! Müdahale süresi yetersiz, ekip kapasitesi arttırılmalı veya önceliklendirme yapılmalı. SLA ihlali ceza ve itibar kaybına neden olur."
  }
};


type FailureRow = {
  day: string;
  ccdm_jam: number;
  card_reader: number;
  dispenser: number;
  comms: number;
  power: number;
};

type AgingRow = { bin: string; count: number };

type Payload = {
  failure_modes: FailureRow[];
  ticket_aging_bins: AgingRow[];
  sla_breach: { low: number; medium: number; high: number };
};

const SLA_COLORS: Record<string, string> = {
  Low: "#2E86FF",
  Medium: "#F2B705",
  High: "#E63946",
};

function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: any;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const title = label ?? payload[0]?.name ?? "";
  return (
    <div className="rounded-xl px-3 py-2 bg-[#0B1B34] ring-1 ring-[#2B416B] text-xs text-white shadow-lg">
      <div className="font-semibold text-white/90 mb-1">{String(title)}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3 text-white/80">
          <span className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: p.color ?? "#2E86FF" }}
            />
            {p.name ?? p.dataKey}
          </span>
          <span className="font-semibold text-white/90">
            {typeof p.value === "number" ? `${p.value}%` : String(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function OverviewBottomStrip() {
  const [data, setData] = useState<Payload | null>(null);
  const [infoModal, setInfoModal] = useState<MetricInfo | null>(null);
  
  // Failure Modes tarih aralığı
  const [failureStartDate, setFailureStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // Son 7 gün
    return date.toISOString().split('T')[0];
  });
  const [failureEndDate, setFailureEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  // Ticket Aging tarih aralığı
  const [ticketStartDate, setTicketStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // Son 7 gün
    return date.toISOString().split('T')[0];
  });
  const [ticketEndDate, setTicketEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  // SLA Breach Risk tarih aralığı
  const [slaStartDate, setSlaStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // Son 7 gün
    return date.toISOString().split('T')[0];
  });
  const [slaEndDate, setSlaEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fetch("/api/overview-bottom", { cache: "no-store" });
      const j = (await r.json()) as Payload;
      if (!alive) return;
      setData(j);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const pieData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Low", value: Math.round(data.sla_breach.low * 100) },
      { name: "Medium", value: Math.round(data.sla_breach.medium * 100) },
      { name: "High", value: Math.round(data.sla_breach.high * 100) },
    ];
  }, [data]);

  return (
    <div className="col-span-12 grid grid-cols-12 gap-4 mt-4">
      {/* Info Modal */}
      {infoModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
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

      {/* Failure Modes */}
      <div className="col-span-12 md:col-span-4 bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="text-sm">Failure Modes</div>
          <div className="flex items-center gap-1">
            {/* Tarih aralığı */}
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={failureStartDate}
                onChange={(e) => setFailureStartDate(e.target.value)}
                className="bg-[#0E2142] border border-[#2B416B] rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:border-[#2E86FF]"
              />
              <span className="text-[10px] text-[#A7B8D8]">-</span>
              <input
                type="date"
                value={failureEndDate}
                onChange={(e) => setFailureEndDate(e.target.value)}
                className="bg-[#0E2142] border border-[#2B416B] rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:border-[#2E86FF]"
              />
            </div>
            {/* Excel Export */}
            <button
              type="button"
              onClick={() => {
                if (!data) return;
                
                const startDateFormatted = new Date(failureStartDate).toLocaleDateString('tr-TR');
                const endDateFormatted = new Date(failureEndDate).toLocaleDateString('tr-TR');
                
                let csvContent = '\uFEFFFailure Modes Raporu\n';
                csvContent += `Tarih Aralığı,${startDateFormatted} - ${endDateFormatted}\n\n`;
                csvContent += 'Gün,CCDM Jam,Card Reader,Dispenser,Comms,Power,Toplam\n';
                
                data.failure_modes.forEach((row) => {
                  const total = row.ccdm_jam + row.card_reader + row.dispenser + row.comms + row.power;
                  csvContent += `${row.day},${row.ccdm_jam},${row.card_reader},${row.dispenser},${row.comms},${row.power},${total}\n`;
                });
                
                // Özet istatistikler
                csvContent += '\nÖzet İstatistikler\n';
                const totalCCDM = data.failure_modes.reduce((sum, row) => sum + row.ccdm_jam, 0);
                const totalCardReader = data.failure_modes.reduce((sum, row) => sum + row.card_reader, 0);
                const totalDispenser = data.failure_modes.reduce((sum, row) => sum + row.dispenser, 0);
                const totalComms = data.failure_modes.reduce((sum, row) => sum + row.comms, 0);
                const totalPower = data.failure_modes.reduce((sum, row) => sum + row.power, 0);
                const grandTotal = totalCCDM + totalCardReader + totalDispenser + totalComms + totalPower;
                
                csvContent += `Toplam CCDM Jam,${totalCCDM}\n`;
                csvContent += `Toplam Card Reader,${totalCardReader}\n`;
                csvContent += `Toplam Dispenser,${totalDispenser}\n`;
                csvContent += `Toplam Comms,${totalComms}\n`;
                csvContent += `Toplam Power,${totalPower}\n`;
                csvContent += `Genel Toplam,${grandTotal}\n`;
                
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `failure_modes_${failureStartDate}_${failureEndDate}.csv`;
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

        <div className="h-[160px] bg-[#0E2142] rounded-xl ring-1 ring-[#2B416B] p-2">
          {!data ? (
            <div className="h-full flex items-center justify-center text-[#A7B8D8] text-sm">
              Loading…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.failure_modes} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="rgba(43,65,107,0.35)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "#A7B8D8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#A7B8D8", fontSize: 10 }} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="ccdm_jam" stackId="a" fill="#2E86FF" />
                <Bar dataKey="card_reader" stackId="a" fill="#66B2FF" />
                <Bar dataKey="dispenser" stackId="a" fill="#1EB980" />
                <Bar dataKey="comms" stackId="a" fill="#F2B705" />
                <Bar dataKey="power" stackId="a" fill="#E63946" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="text-xs text-[#A7B8D8] mt-2">Son 7 gün arıza tür dağılımı (mock)</div>
      </div>

      {/* Ticket Aging */}
      <div className="col-span-12 md:col-span-4 bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="text-sm">Ticket Aging</div>
          <div className="flex items-center gap-1">
            {/* Tarih aralığı */}
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={ticketStartDate}
                onChange={(e) => setTicketStartDate(e.target.value)}
                className="bg-[#0E2142] border border-[#2B416B] rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:border-[#2E86FF]"
              />
              <span className="text-[10px] text-[#A7B8D8]">-</span>
              <input
                type="date"
                value={ticketEndDate}
                onChange={(e) => setTicketEndDate(e.target.value)}
                className="bg-[#0E2142] border border-[#2B416B] rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:border-[#2E86FF]"
              />
            </div>
            {/* Excel Export */}
            <button
              type="button"
              onClick={() => {
                if (!data) return;
                
                const startDateFormatted = new Date(ticketStartDate).toLocaleDateString('tr-TR');
                const endDateFormatted = new Date(ticketEndDate).toLocaleDateString('tr-TR');
                
                let csvContent = '\uFEFFTicket Aging Raporu\n';
                csvContent += `Tarih Aralığı,${startDateFormatted} - ${endDateFormatted}\n\n`;
                csvContent += 'Yaş Aralığı,Ticket Sayısı\n';
                
                data.ticket_aging_bins.forEach((row) => {
                  csvContent += `${row.bin},${row.count}\n`;
                });
                
                // Özet istatistikler
                csvContent += '\nÖzet İstatistikler\n';
                const totalTickets = data.ticket_aging_bins.reduce((sum, row) => sum + row.count, 0);
                const avgAge = data.ticket_aging_bins.reduce((sum, row, idx) => {
                  const midAge = idx === 0 ? 0.5 : idx === data.ticket_aging_bins.length - 1 ? 15 : (idx * 3);
                  return sum + (row.count * midAge);
                }, 0) / totalTickets;
                
                csvContent += `Toplam Açık Ticket,${totalTickets}\n`;
                csvContent += `Ortalama Yaş (gün),${avgAge.toFixed(1)}\n`;
                csvContent += `En Eski Grup,${data.ticket_aging_bins[data.ticket_aging_bins.length - 1].bin}\n`;
                csvContent += `En Eski Grup Sayısı,${data.ticket_aging_bins[data.ticket_aging_bins.length - 1].count}\n`;
                
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `ticket_aging_${ticketStartDate}_${ticketEndDate}.csv`;
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

        <div className="h-[160px] bg-[#0E2142] rounded-xl ring-1 ring-[#2B416B] p-2">
          {!data ? (
            <div className="h-full flex items-center justify-center text-[#A7B8D8] text-sm">
              Loading…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ticket_aging_bins} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="rgba(43,65,107,0.35)" vertical={false} />
                <XAxis dataKey="bin" tick={{ fill: "#A7B8D8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#A7B8D8", fontSize: 10 }} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="count" fill="#2E86FF" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="text-xs text-[#A7B8D8] mt-2">Açık ticket yaş dağılımı (mock)</div>
      </div>

      {/* SLA Breach Risk */}
      <div className="col-span-12 md:col-span-4 bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="text-sm">SLA Breach Risk</div>
            <button
              onClick={() => setInfoModal(OVERVIEW_METRIC_EXPLANATIONS["sla_breach_risk"])}
              className="w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition"
            >
              ?
            </button>
          </div>
          <div className="flex items-center gap-1">
            {/* Tarih aralığı */}
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={slaStartDate}
                onChange={(e) => setSlaStartDate(e.target.value)}
                className="bg-[#0E2142] border border-[#2B416B] rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:border-[#2E86FF]"
              />
              <span className="text-[10px] text-[#A7B8D8]">-</span>
              <input
                type="date"
                value={slaEndDate}
                onChange={(e) => setSlaEndDate(e.target.value)}
                className="bg-[#0E2142] border border-[#2B416B] rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:border-[#2E86FF]"
              />
            </div>
            {/* Excel Export */}
            <button
              type="button"
              onClick={() => {
                if (!data) return;
                
                const startDateFormatted = new Date(slaStartDate).toLocaleDateString('tr-TR');
                const endDateFormatted = new Date(slaEndDate).toLocaleDateString('tr-TR');
                
                let csvContent = '\uFEFFSLA Breach Risk Raporu\n';
                csvContent += `Tarih Aralığı,${startDateFormatted} - ${endDateFormatted}\n\n`;
                csvContent += 'Risk Seviyesi,Oran (%),Değer\n';
                
                const lowPercent = Math.round(data.sla_breach.low * 100);
                const mediumPercent = Math.round(data.sla_breach.medium * 100);
                const highPercent = Math.round(data.sla_breach.high * 100);
                
                csvContent += `Low,${lowPercent}%,${data.sla_breach.low.toFixed(3)}\n`;
                csvContent += `Medium,${mediumPercent}%,${data.sla_breach.medium.toFixed(3)}\n`;
                csvContent += `High,${highPercent}%,${data.sla_breach.high.toFixed(3)}\n`;
                
                // Özet istatistikler
                csvContent += '\nÖzet İstatistikler\n';
                csvContent += `Toplam Oran,${lowPercent + mediumPercent + highPercent}%\n`;
                csvContent += `En Yüksek Risk,${highPercent > mediumPercent ? (highPercent > lowPercent ? 'High' : 'Low') : (mediumPercent > lowPercent ? 'Medium' : 'Low')}\n`;
                csvContent += `Kritik Durum,${highPercent > 30 ? 'UYARI: Yüksek risk seviyesi!' : 'Normal'}\n`;
                
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `sla_breach_risk_${slaStartDate}_${slaEndDate}.csv`;
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

        <div className="h-[180px] bg-[#0E2142] rounded-xl ring-1 ring-[#2B416B] p-2 flex items-center justify-center">
          {!data ? (
            <div className="text-[#A7B8D8] text-sm">Loading…</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={74}
                  paddingAngle={2}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={2}
                >
                  {pieData.map((p, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        p.name === "Low"
                          ? SLA_COLORS.Low
                          : p.name === "Medium"
                          ? SLA_COLORS.Medium
                          : SLA_COLORS.High
                      }
                    />
                  ))}
                </Pie>
                <Tooltip content={<DarkTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-2 grid grid-cols-3 text-xs text-[#A7B8D8]">
          <div>Low: {data ? Math.round(data.sla_breach.low * 100) : "…"}%</div>
          <div>Med: {data ? Math.round(data.sla_breach.medium * 100) : "…"}%</div>
          <div>High: {data ? Math.round(data.sla_breach.high * 100) : "…"}%</div>
        </div>
      </div>
    </div>
  );
}

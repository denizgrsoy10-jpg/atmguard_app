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
      {/* Failure Modes */}
      <div className="col-span-12 md:col-span-4 bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
        <div className="text-sm mb-3">Failure Modes</div>

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
        <div className="text-sm mb-3">Ticket Aging</div>

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
        <div className="text-sm mb-3">SLA Breach Risk</div>

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

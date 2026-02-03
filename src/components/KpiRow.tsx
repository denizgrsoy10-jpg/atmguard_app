"use client";

import { useEffect, useMemo, useState } from "react";

type OverviewKpi = {
  total_atms: number;
  risk_score_avg: number;
  high_risk_pct: number;
  incidents_7d: number;
  uptime: number;
};

function KpiCard({
  label,
  value,
  progress,
}: {
  label: string;
  value: string;
  progress: number; // 0-100
}) {
  const p = Math.max(0, Math.min(100, progress));

  return (
    <div className="bg-[#0E2142] rounded-2xl p-4 shadow-lg ring-1 ring-[#2B416B]">
      <div className="text-xs text-[#A7B8D8] mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>

      <div className="mt-3 h-1.5 w-full bg-[#112544] rounded-full overflow-hidden">
        <div
          className="h-1.5 bg-[#2E86FF] rounded-full transition-all"
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[#0E2142]/60 rounded-2xl p-4 ring-1 ring-[#2B416B] animate-pulse">
      <div className="h-3 w-24 bg-white/10 rounded mb-3" />
      <div className="h-7 w-28 bg-white/10 rounded mb-4" />
      <div className="h-1.5 w-full bg-white/10 rounded" />
    </div>
  );
}

export default function KpiRow() {
  const [data, setData] = useState<OverviewKpi | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showIncidents, setShowIncidents] = useState(false);
  const [incidentAtms, setIncidentAtms] = useState<
    { atm_id: string; atm_name: string; city: string; district: string; severity: "High" | "Medium" | "Low" }[]
  >([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr(null);
        const r = await fetch("/api/overview", { cache: "no-store" });
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        const json = (await r.json()) as OverviewKpi;
        if (!alive) return;
        setData(json);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Unknown error");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!data) return () => {
      alive = false;
    };

    (async () => {
      try {
        const r = await fetch("/api/atm-master", { cache: "no-store" });
        const j = await r.json();
        const atms = (j.atms || []).filter((a: any) => a.active !== false);
        const count = Math.min(data.incidents_7d, atms.length);
        const severities: Array<"High" | "Medium" | "Low"> = ["High", "Medium", "Low"];
        const mapped = atms.slice(0, count).map((a: any, idx: number) => ({
          atm_id: String(a.atm_id),
          atm_name: a.atm_name || "N/A",
          city: a.city,
          district: a.district,
          severity: severities[idx % severities.length],
        }));
        if (!alive) return;
        setIncidentAtms(mapped);
      } catch {
        if (!alive) return;
        setIncidentAtms([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [data]);

  const cards = useMemo(() => {
    if (!data) return null;

    return [
      {
        label: "Total ATMs",
        value: data.total_atms.toLocaleString("tr-TR"),
        progress: 100,
      },
      {
        label: "Risk Score (avg)",
        value: data.risk_score_avg.toFixed(1),
        progress: Math.max(0, Math.min(100, data.risk_score_avg)),
      },
      {
        label: "High-Risk %",
        value: `${data.high_risk_pct.toFixed(1)}%`,
        progress: Math.max(0, Math.min(100, data.high_risk_pct)),
      },
      {
        label: "Incidents (7d)",
        value: data.incidents_7d.toString(),
        progress: Math.max(0, Math.min(100, (data.incidents_7d / 100) * 100)),
      },
      {
        label: "Uptime",
        value: `${data.uptime.toFixed(1)}%`,
        progress: Math.max(0, Math.min(100, data.uptime)),
      },
    ];
  }, [data]);

  return (
    <div className="mb-5">
      {err ? (
        <div className="mb-4 rounded-2xl p-4 bg-[#112544] ring-1 ring-red-500/40">
          <div className="text-sm font-semibold text-red-300">KPI API Error</div>
          <div className="text-xs text-[#A7B8D8] mt-1">{err}</div>
          <div className="text-xs text-[#A7B8D8] mt-2">
            Endpoint kontrol: <span className="text-white/80">/api/overview</span>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        {!data
          ? [...Array(5)].map((_, i) => <SkeletonCard key={i} />)
          : cards!.map((c) =>
              c.label === "Incidents (7d)" ? (
                <div
                  key={c.label}
                  onClick={() => setShowIncidents(true)}
                  className="cursor-pointer hover:ring-2 hover:ring-[#2E86FF] transition rounded-2xl"
                >
                  <KpiCard label={c.label} value={c.value} progress={c.progress} />
                </div>
              ) : (
                <KpiCard key={c.label} label={c.label} value={c.value} progress={c.progress} />
              )
            )}
      </div>

      {showIncidents && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowIncidents(false)}
        >
          <div
            className="bg-[#112544] rounded-2xl ring-1 ring-[#2B416B] w-full max-w-4xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B]">
              <div className="text-lg font-semibold">Incidents (7d) — {incidentAtms.length} ATMs</div>
              <button
                onClick={() => setShowIncidents(false)}
                className="text-[#A7B8D8] hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(80vh - 80px)" }}>
              <div className="grid gap-3">
                {incidentAtms.map((a) => (
                  <div
                    key={a.atm_id}
                    className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B] hover:bg-[#1C2E52] transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">ATM {a.atm_id} — {a.atm_name}</div>
                        <div className="text-xs text-[#A7B8D8] mt-1">{a.city} / {a.district}</div>
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

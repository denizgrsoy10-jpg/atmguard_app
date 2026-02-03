"use client";

import { useEffect, useMemo, useState } from "react";

type DriftRow = { feature: string; psi: number; ks: number };
type NetRoiPoint = { x: number; y: number };
type RoiStackPoint = { day: number; avoided: number; cost: number };
type PrPoint = { recall: number; precision: number };

type HealthPayload = {
  f1_30g: number;
  ks: number;
  precision_30g: number;
  recall_30g: number;
  max_drift_psi: number;
  worst_drift_feature: string;

  avoided_try_30g: number;
  cost_try_30g: number;
  roi_multiple_30g: number;

  anomaly_rate_7d: number;
  anomaly_rate_30d: number;
  sla_compliance: number;
  data_freshness_min: number;
  rows_scored_today: number;

  model_version_current: string;
  model_version_prev: string;
  model_version_note: string;

  drift: DriftRow[];
  netroi_trend: NetRoiPoint[];
  roi_stack: RoiStackPoint[];

  threshold: { current: number; recommended: number };
  pr_curve: PrPoint[];
};

function MetricCard({ label, value }: { label: string; value: string }) {
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

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
      <div className="text-sm mb-3">{title}</div>
      {children}
    </div>
  );
}

function fmtTRY(n: number) {
  return `${n.toLocaleString("tr-TR")} TL`;
}

const TRY_PER_USD = 36;

function fmtUSD(n: number) {
  return `$${(n / TRY_PER_USD).toFixed(2)}`;
}

export default function TrendHealthPage() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr(null);
        const r = await fetch("/api/health", { cache: "no-store" });
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        const j = (await r.json()) as HealthPayload;
        if (!alive) return;
        setData(j);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Unknown error");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const driftMax = useMemo(() => {
    if (!data) return 1;
    return Math.max(...data.drift.map((d) => d.psi), 1);
  }, [data]);

  const roiMax = useMemo(() => {
    if (!data) return 1;
    const maxA = Math.max(...data.roi_stack.map((p) => p.avoided), 1);
    return maxA;
  }, [data]);

  return (
    <div className="space-y-4">
      {err ? (
        <div className="rounded-2xl p-4 bg-[#112544] ring-1 ring-red-500/40">
          <div className="text-sm font-semibold text-red-300">Health API Error</div>
          <div className="text-xs text-[#A7B8D8] mt-1">{err}</div>
          <div className="text-xs text-[#A7B8D8] mt-2">
            Endpoint: <span className="text-white/80">/api/health</span>
          </div>
        </div>
      ) : null}

      {/* Motor Performans Metrikleri */}
      <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
        <div className="text-sm font-semibold mb-4">Motor Performans Metrikleri</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B]">
            <div className="text-[10px] text-[#A7B8D8] mb-1">FLM Başarı Oranı</div>
            <div className="text-xl font-bold text-[#10B981]">78%</div>
            <div className="text-[9px] text-white/60 mt-1">+5% (30g)</div>
          </div>
          
          <div className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B]">
            <div className="text-[10px] text-[#A7B8D8] mb-1">SLM Doğruluk</div>
            <div className="text-xl font-bold text-[#2E86FF]">92%</div>
            <div className="text-[9px] text-white/60 mt-1">+3% (30g)</div>
          </div>
          
          <div className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B]">
            <div className="text-[10px] text-[#A7B8D8] mb-1">Önlenen Arıza</div>
            <div className="text-xl font-bold text-[#F2B705]">143</div>
            <div className="text-[9px] text-white/60 mt-1">Son 30 gün</div>
          </div>
          
          <div className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B]">
            <div className="text-[10px] text-[#A7B8D8] mb-1">Maliyet Azaltma</div>
            <div className="text-xl font-bold text-[#10B981]">$12.4K</div>
            <div className="text-[9px] text-white/60 mt-1">FLM optimizasyon</div>
          </div>
          
          <div className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B]">
            <div className="text-[10px] text-[#A7B8D8] mb-1">Öğrenme Hızı</div>
            <div className="text-xl font-bold text-[#2E86FF]">94%</div>
            <div className="text-[9px] text-white/60 mt-1">Model güven skoru</div>
          </div>
          
          <div className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B]">
            <div className="text-[10px] text-[#A7B8D8] mb-1">Günlük İşlem</div>
            <div className="text-xl font-bold text-white">847</div>
            <div className="text-[9px] text-white/60 mt-1">Arıza tahmini</div>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-4">
        <MetricCard label="F1_30g" value={data ? data.f1_30g.toFixed(2) : "…"} />
        <MetricCard label="KS" value={data ? data.ks.toFixed(2) : "…"} />
        <MetricCard label="Precision_30g" value={data ? data.precision_30g.toFixed(2) : "…"} />
        <MetricCard label="Recall_30g" value={data ? data.recall_30g.toFixed(2) : "…"} />
        <MetricCard label="Max Drift PSI" value={data ? `${Math.round(data.max_drift_psi * 100)}%` : "…"} />
        <MetricCard label="Worst Drift Feature" value={data ? data.worst_drift_feature : "…"} />
        <MetricCard label="ROI (30g)" value={data ? `${data.roi_multiple_30g.toFixed(1)}x` : "…"} />
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-12 gap-4">
        {/* ROI Trend */}
        <div className="col-span-12 xl:col-span-5">
          <Panel title="Net ROI (30g)">
            <div className="h-[260px] bg-[#0E2142] rounded-xl ring-1 ring-[#2B416B] flex items-center justify-center">
              {!data ? (
                <div className="text-[#A7B8D8] text-sm">Loading…</div>
              ) : (
                <svg width="100%" height="100%" viewBox="0 0 520 220" className="p-4">
                  <line x1="30" y1="10" x2="30" y2="200" stroke="#2B416B" />
                  <line x1="30" y1="200" x2="500" y2="200" stroke="#2B416B" />
                  <polyline
                    fill="none"
                    stroke="#2E86FF"
                    strokeWidth="3"
                    points={data.netroi_trend
                      .map((p, idx) => {
                        const x = 30 + (idx / (data.netroi_trend.length - 1)) * 470;
                        const y = 200 - ((p.y + 200000) / 240000) * 190; // normalize
                        return `${x},${y}`;
                      })
                      .join(" ")}
                  />
                </svg>
              )}
            </div>
            {data ? (
              <div className="mt-3 grid grid-cols-3 text-xs text-[#A7B8D8]">
                <div>Avoided: <span className="text-white/80">{fmtUSD(data.avoided_try_30g)}</span></div>
                <div>Cost: <span className="text-white/80">{fmtUSD(data.cost_try_30g)}</span></div>
                <div>Net: <span className="text-white/80">{fmtUSD(data.avoided_try_30g - data.cost_try_30g)}</span></div>
              </div>
            ) : null}
          </Panel>
        </div>

        {/* Feature Drift */}
        <div className="col-span-12 xl:col-span-7">
          <Panel title="Feature Drift (PSI / KS)">
            <div className="grid grid-cols-12 gap-3">
              {!data ? (
                <div className="col-span-12 text-[#A7B8D8] text-sm">Loading…</div>
              ) : (
                data.drift.map((d) => (
                  <div
                    key={d.feature}
                    className="col-span-12 md:col-span-6 bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-[#A7B8D8]">{d.feature}</div>
                      <div className="text-xs text-white/70">KS: {d.ks.toFixed(2)}</div>
                    </div>

                    <div className="mt-2 h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-[#2E86FF] rounded-full"
                        style={{ width: `${Math.round((d.psi / driftMax) * 100)}%` }}
                        title={`PSI: ${d.psi.toFixed(2)}`}
                      />
                    </div>

                    <div className="mt-2 text-xs text-white/70">PSI: {d.psi.toFixed(2)}</div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        {/* Model Quality / Threshold / PR */}
        <div className="col-span-12 xl:col-span-7">
          <Panel title="Model Quality (PR / Threshold)">
            {!data ? (
              <div className="text-[#A7B8D8] text-sm">Loading…</div>
            ) : (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 md:col-span-6 bg-[#0E2142] rounded-xl p-4 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8] mb-2">Threshold</div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Current</span>
                    <span className="font-semibold">{data.threshold.current.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span>Recommended</span>
                    <span className="font-semibold">{data.threshold.recommended.toFixed(2)}</span>
                  </div>
                  <div className="mt-3 h-2 bg-[#112544] rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-[#2E86FF] rounded-full"
                      style={{ width: `${Math.round(data.threshold.current * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="col-span-12 md:col-span-6 bg-[#0E2142] rounded-xl p-4 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8] mb-2">PR Curve (placeholder)</div>
                  <svg width="100%" height="160" viewBox="0 0 320 160">
                    <line x1="20" y1="10" x2="20" y2="140" stroke="#2B416B" />
                    <line x1="20" y1="140" x2="300" y2="140" stroke="#2B416B" />
                    <polyline
                      fill="none"
                      stroke="#2E86FF"
                      strokeWidth="3"
                      points={data.pr_curve
                        .map((p) => {
                          const x = 20 + p.recall * 280;
                          const y = 140 - p.precision * 120;
                          return `${x},${y}`;
                        })
                        .join(" ")}
                    />
                  </svg>
                </div>
              </div>
            )}
          </Panel>
        </div>

        {/* ROI & Avoided Cost */}
        <div className="col-span-12 xl:col-span-5">
          <Panel title="ROI & Avoided Cost (30g)">
            {!data ? (
              <div className="text-[#A7B8D8] text-sm">Loading…</div>
            ) : (
              <div className="bg-[#0E2142] rounded-xl p-4 ring-1 ring-[#2B416B]">
                <div className="text-xs text-[#A7B8D8] mb-3">Avoided vs Cost (mock)</div>
                <div className="space-y-3">
                  {data.roi_stack.map((p) => (
                    <div key={p.day}>
                      <div className="flex justify-between text-xs text-[#A7B8D8] mb-1">
                        <span>Day {p.day}</span>
                        <span>Avoided: {fmtUSD(p.avoided)} | Cost: {fmtUSD(p.cost)}</span>
                      </div>
                      <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                        <div
                          className="h-2 bg-[#2E86FF] rounded-full"
                          style={{ width: `${Math.round((p.avoided / roiMax) * 100)}%` }}
                        />
                      </div>
                      <div className="mt-1 h-2 w-full bg-[#112544] rounded-full overflow-hidden opacity-70">
                        <div
                          className="h-2 bg-[#F2B705] rounded-full"
                          style={{ width: `${Math.round((p.cost / roiMax) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>

        {/* Bottom strip */}
        <div className="col-span-12 grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-3 bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-sm mb-2">Anomaly Rate</div>
            <div className="text-xs text-[#A7B8D8]">
              7d: <span className="text-white/80">{data ? `${Math.round(data.anomaly_rate_7d * 100)}%` : "…"}</span>
              {"  "} | 30d: <span className="text-white/80">{data ? `${Math.round(data.anomaly_rate_30d * 100)}%` : "…"}</span>
            </div>
          </div>

          <div className="col-span-12 md:col-span-3 bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-sm mb-2">SLA Compliance</div>
            <div className="text-xs text-[#A7B8D8]">
              {data ? `${Math.round(data.sla_compliance * 100)}%` : "…"}
            </div>
          </div>

          <div className="col-span-12 md:col-span-3 bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-sm mb-2">Model Version</div>
            <div className="text-xs text-[#A7B8D8]">
              {data ? `${data.model_version_prev} → ${data.model_version_current}` : "…"}
            </div>
            <div className="text-[11px] text-white/60 mt-1">{data?.model_version_note ?? ""}</div>
          </div>

          <div className="col-span-12 md:col-span-3 bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-sm mb-2">Data Freshness</div>
            <div className="text-xs text-[#A7B8D8]">
              Freshness: <span className="text-white/80">{data ? `${data.data_freshness_min} dk` : "…"}</span>
            </div>
            <div className="text-xs text-[#A7B8D8] mt-1">
              Rows scored: <span className="text-white/80">{data ? data.rows_scored_today.toLocaleString("tr-TR") : "…"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

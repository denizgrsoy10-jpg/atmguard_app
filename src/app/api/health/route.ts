import { NextResponse } from "next/server";
import { getBrainOzet } from "@/lib/brain";

export const dynamic = "force-dynamic";

const BRAIN_URL = process.env.BRAIN_API_URL ?? "http://localhost:8000";

type BrainSaglik = {
  durum: string;
  yuklenen_atm: number;
  aktif_ariza: number;
  bakiye_kaydi: number;
  zaman: string;
};

async function getBrainSaglik(): Promise<BrainSaglik | null> {
  try {
    const res = await fetch(`${BRAIN_URL}/api/v1/saglik`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    return (await res.json()) as BrainSaglik;
  } catch {
    return null;
  }
}

// Vitrin/placeholder taban — ML kalite metrikleri (F1/KS/PSI/PR) beyin tarafından
// ÜRETİLMEZ (model-monitoring pipeline yok); bunlar canlıda da placeholder kalır.
// Beyin ayaktaysa yalnızca gerçekten sahip olduğu sinyaller üzerine yazılır.
const MOCK = {
  f1_30g: 0.59,
  ks: 0.13,
  precision_30g: 1.0,
  recall_30g: 0.42,
  max_drift_psi: 0.4,
  worst_drift_feature: "JamEvents",

  avoided_try_30g: 1800000,
  cost_try_30g: 600000,
  roi_multiple_30g: 3.0,

  anomaly_rate_7d: 0.04,
  anomaly_rate_30d: 0.07,
  sla_compliance: 0.91,
  data_freshness_min: 12,
  rows_scored_today: 2590,

  model_version_current: "v1.13",
  model_version_prev: "v1.12",
  model_version_note: "Threshold tuned (+0.02) • Drift guardrails updated",

  drift: [
    { feature: "Temp", psi: 0.4, ks: 0.22 },
    { feature: "JamEvents", psi: 0.55, ks: 0.3 },
    { feature: "TxnCount", psi: 0.35, ks: 0.18 },
    { feature: "Humidity", psi: 0.28, ks: 0.15 },
    { feature: "CashLevel", psi: 0.22, ks: 0.1 },
    { feature: "PowerCuts", psi: 0.18, ks: 0.08 },
  ],

  netroi_trend: [
    { x: 1, y: -150000 },
    { x: 7, y: -120000 },
    { x: 14, y: -95000 },
    { x: 21, y: -80000 },
    { x: 30, y: -60000 },
  ],

  roi_stack: [
    { day: 1, avoided: 20000, cost: 8000 },
    { day: 7, avoided: 240000, cost: 90000 },
    { day: 14, avoided: 520000, cost: 170000 },
    { day: 21, avoided: 980000, cost: 320000 },
    { day: 30, avoided: 1800000, cost: 600000 },
  ],

  threshold: { current: 0.62, recommended: 0.6 },
  pr_curve: [
    { recall: 0.2, precision: 0.95 },
    { recall: 0.35, precision: 0.88 },
    { recall: 0.5, precision: 0.8 },
    { recall: 0.65, precision: 0.72 },
    { recall: 0.8, precision: 0.62 },
  ],
};

export async function GET() {
  const [saglik, ozet] = await Promise.all([getBrainSaglik(), getBrainOzet()]);

  // Beyin kapalı → tam vitrin
  if (!saglik) {
    return NextResponse.json({ ...MOCK, _source: "mock" });
  }

  // Beyin ayakta → yalnızca beynin GERÇEKTEN ürettiği sinyalleri canlıya çek
  const payload: typeof MOCK & {
    _source: string;
    _brain_yuklenen_atm: number;
    _brain_aktif_ariza: number;
    _brain_bakiye_kaydi: number;
  } = {
    ...MOCK,
    _source: "brain",
    _brain_yuklenen_atm: saglik.yuklenen_atm,
    _brain_aktif_ariza: saglik.aktif_ariza,
    _brain_bakiye_kaydi: saglik.bakiye_kaydi,
  };

  // Taranan ATM sayısı = beynin yönettiği terminal sayısı (gerçek)
  if (saglik.yuklenen_atm > 0) {
    payload.rows_scored_today = saglik.yuklenen_atm;
  }
  // Veri yeni feed'lendi → tazelik düşük (gerçek)
  payload.data_freshness_min = 0;

  // Ekonomik ROI = beynin anlık karar döngüsü çıktısı (gerçek, beslenince büyür)
  if (ozet) {
    const tasarruf = ozet.toplam_tahmini_tasarruf || 0;
    const maliyet = ozet.toplam_tahmini_maliyet || 0;
    if (tasarruf > 0 || maliyet > 0) {
      payload.avoided_try_30g = Math.round(tasarruf);
      payload.cost_try_30g = Math.round(maliyet);
      payload.roi_multiple_30g =
        maliyet > 0 ? Math.round((tasarruf / maliyet) * 10) / 10 : 0;
    }
  }

  return NextResponse.json(payload);
}

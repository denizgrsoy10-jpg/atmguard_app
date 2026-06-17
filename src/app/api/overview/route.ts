import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { getBrainOzet, getBrainKararlar, brainHasData } from "@/lib/brain";

export const dynamic = "force-dynamic";

// Vitrin (mock) değerleri — beyin beslenmemişse bunlar gösterilir
const MOCK = {
  risk_score_avg: 72.4,
  high_risk_pct: 12.8,
  incidents_7d: 58,
  uptime: 99.1,
};

function realAtmCount(): number {
  try {
    const filePath = join(process.cwd(), "src/data/atm_master.json");
    const atms = JSON.parse(readFileSync(filePath, "utf-8"));
    return atms.length || 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  const total = realAtmCount();
  const [ozet, kararlar] = await Promise.all([getBrainOzet(), getBrainKararlar()]);

  // ── CANLI: beyin beslenmişse KPI'ları gerçek kararlardan türet ──────────
  if (brainHasData(kararlar) && ozet) {
    const list = kararlar.kararlar;
    const n = list.length || 1;
    const avgRisk = list.reduce((s, k) => s + (k.ariza_riski || 0), 0) / n;
    const highCount = (ozet.kritik_atm || 0) + (ozet.yuksek_atm || 0);
    const base = ozet.toplam_atm || n;
    const incidents = list.filter(
      (k) => (k.ariza_riski || 0) > 0 || /FLM|SLM/i.test(k.eylem)
    ).length;

    return NextResponse.json({
      total_atms: total || ozet.toplam_atm,
      risk_score_avg: Math.round(avgRisk * 1000) / 10, // 0..100
      high_risk_pct: Math.round((highCount / base) * 1000) / 10,
      incidents_7d: incidents,
      uptime: MOCK.uptime, // beyin uptime üretmiyor → vitrin değeri korunur
      _source: "brain",
    });
  }

  // ── VİTRİN: beyin kapalı/boş → mock (ATM sayısı yine gerçek) ────────────
  return NextResponse.json({ total_atms: total, ...MOCK, _source: "mock" });
}

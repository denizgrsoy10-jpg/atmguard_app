import { NextResponse } from "next/server";
import atmMasterData from "@/data/atm_master.json";
import { getBrainKararlar, brainHasData } from "@/lib/brain";

export const dynamic = "force-dynamic";

type ATM = { atm_id: string; zone?: string | number };

const MOCK_ZONES = [
  { zone: "Zone-1", risk: 0.62 },
  { zone: "Zone-2", risk: 0.48 },
  { zone: "Zone-3", risk: 0.71 },
  { zone: "Zone-4", risk: 0.39 },
  { zone: "Zone-5", risk: 0.55 },
];

export async function GET() {
  // ── CANLI: beyin beslenmişse zona göre ortalama riski hesapla ───────────
  const kararlar = await getBrainKararlar();
  if (brainHasData(kararlar)) {
    const zoneOf = new Map<string, string | number>();
    for (const a of atmMasterData as ATM[]) zoneOf.set(a.atm_id, a.zone ?? "1");

    const acc = new Map<string, { sum: number; n: number }>();
    for (const k of kararlar.kararlar) {
      const z = String(zoneOf.get(k.terminal_id) ?? "?");
      const cur = acc.get(z) ?? { sum: 0, n: 0 };
      cur.sum += k.ariza_riski || 0;
      cur.n += 1;
      acc.set(z, cur);
    }

    const zones = Array.from(acc.entries())
      .map(([z, { sum, n }]) => ({
        zone: `Zone-${z}`,
        risk: Math.round((n ? sum / n : 0) * 100) / 100,
      }))
      .sort((a, b) => a.zone.localeCompare(b.zone));

    if (zones.length > 0) {
      return NextResponse.json({ zones, _source: "brain" });
    }
  }

  // ── VİTRİN: beyin kapalı/boş → mock zonlar ──────────────────────────────
  return NextResponse.json({ zones: MOCK_ZONES, _source: "mock" });
}

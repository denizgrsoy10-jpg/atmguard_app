import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import atmMasterData from "@/data/atm_master.json";
import {
  getBrainKararlar,
  brainHasData,
  aciliyetToBand,
  aciliyetWeight,
} from "@/lib/brain";

export const dynamic = "force-dynamic";

type ATM = {
  atm_id: string;
  atm_name?: string;
  city: string;
  district: string;
  zone?: string | number;
  atm_age?: string;
  latitude?: string | number;
  longitude?: string | number;
  active?: boolean;
};

type TopItem = {
  atm_id: string;
  atm_name: string;
  city: string;
  district: string;
  slm_prob: number;
  risk_band: "High" | "Medium" | "Low";
  expected_saving_try: number;
  reason: string;
  availability: number;
  riskScore: number;
};

// terminal_id → ATM master kaydı (isim/şehir zenginleştirme için)
function buildAtmIndex(): Map<string, ATM> {
  const idx = new Map<string, ATM>();
  for (const a of atmMasterData as ATM[]) idx.set(a.atm_id, a);
  return idx;
}

export async function GET() {
  // ── CANLI: beyin beslenmişse riskli ATM'leri kararlardan kur ────────────
  const kararlar = await getBrainKararlar();
  if (brainHasData(kararlar)) {
    const idx = buildAtmIndex();
    const items: TopItem[] = kararlar.kararlar
      .slice()
      .sort(
        (a, b) =>
          (b.ariza_riski || 0) - (a.ariza_riski || 0) ||
          aciliyetWeight(b.aciliyet) - aciliyetWeight(a.aciliyet) ||
          (b.tahmini_tasarruf || 0) - (a.tahmini_tasarruf || 0)
      )
      .slice(0, 10)
      .map((k) => {
        const m = idx.get(k.terminal_id);
        const risk = k.ariza_riski || 0;
        return {
          atm_id: k.terminal_id,
          atm_name: m?.atm_name || k.terminal_id,
          city: m?.city || "—",
          district: m?.district || "—",
          slm_prob: risk,
          risk_band: aciliyetToBand(k.aciliyet),
          expected_saving_try: Math.round(k.tahmini_tasarruf || 0),
          reason: k.sebepler?.[0] || k.eylem || "Beyin kararı",
          availability: Math.round((99.5 - risk * 7) * 100) / 100,
          riskScore: risk,
        };
      });

    if (items.length > 0) {
      return NextResponse.json({ items, _source: "brain" });
    }
  }

  // ── VİTRİN: beyin kapalı/boş → mevcut mock risk hesabı ──────────────────
  try {
    const filePath = join(process.cwd(), "src/data/atm_master.json");
    const fileContent = readFileSync(filePath, "utf-8");
    const atms = JSON.parse(fileContent) as ATM[];

    const withRisk = atms
      .filter((a) => a.active !== false)
      .map((a, idx) => {
        const age = parseInt(a.atm_age || "5", 10);
        const zone = parseInt(String(a.zone || "1"), 10);

        let riskScore = 0.4 + age * 0.04 + zone * 0.015;
        const hashScore = ((idx * 17 + a.atm_id.charCodeAt(0)) % 100) / 200;
        riskScore += hashScore;
        riskScore = Math.min(0.95, Math.max(0.3, riskScore));

        let riskBand: "High" | "Medium" | "Low" = "Low";
        if (riskScore >= 0.75) riskBand = "High";
        else if (riskScore >= 0.55) riskBand = "Medium";

        const baseSaving = 1000 + riskScore * 600;
        const baseAvailability = 99.5 - riskScore * 7;
        const availability = Math.round((baseAvailability + hashScore * 2) * 100) / 100;

        const reasons = [
          "Yaşlı ekipman, tamir sıklığı artmış",
          "Bölgesel anomali, drift sinyali",
          "Cash flow yönetimi optimizasyonu",
          "Uptime düşüş, network sorunları",
          "Bakım gereksinimi artışı",
        ];

        return {
          atm_id: a.atm_id,
          atm_name: a.atm_name || "N/A",
          city: a.city,
          district: a.district,
          zone: a.zone,
          slm_prob: riskScore,
          risk_band: riskBand,
          expected_saving_try: Math.round(baseSaving),
          reason: reasons[idx % reasons.length],
          availability: availability,
          riskScore,
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore);

    const cityMap = new Map<string, typeof withRisk>();
    const result: TopItem[] = [];

    for (const item of withRisk) {
      if (!cityMap.has(item.city)) cityMap.set(item.city, []);
      cityMap.get(item.city)!.push(item);
    }

    for (const [, items] of cityMap) {
      if (result.length >= 10) break;
      const take = Math.min(2, items.length, 10 - result.length);
      result.push(...items.slice(0, take));
    }

    if (result.length < 10) {
      const remaining = withRisk.filter(
        (item) => !result.some((r) => r.atm_id === item.atm_id)
      );
      result.push(...remaining.slice(0, 10 - result.length));
    }

    result.sort((a, b) => b.riskScore - a.riskScore);
    const finalItems = result.slice(0, 10) as TopItem[];

    return NextResponse.json({ items: finalItems, _source: "mock" });
  } catch (error) {
    console.error("Error fetching ATM data:", error);
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}

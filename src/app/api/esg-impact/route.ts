import { NextResponse } from "next/server";
import { getBrainOzet, getBrainKararlar, brainHasData } from "@/lib/brain";

export const dynamic = "force-dynamic";

// Vitrin varsayılanı: sahada kanıtlanmış ~%25 rota/sefer optimizasyonu
const MOCK_RATE = 0.25;

export async function GET() {
  const [ozet, kararlar] = await Promise.all([
    getBrainOzet(),
    getBrainKararlar(),
  ]);

  // ── CANLI: optimizasyon oranı = beynin gerçek kombine servis oranı ───────
  // Her kombine karar, ayrı ayrı yapılacak 2+ ziyareti tek sefere indirir →
  // gerçek sefer/rota (dolayısıyla KM/karbon) tasarrufunun motor karşılığı.
  if (ozet && brainHasData(kararlar)) {
    const toplam = kararlar.toplam_karar || kararlar.kararlar.length;
    const kombine = ozet.kombine_servis || 0;
    if (toplam > 0) {
      const hamOran = kombine / toplam;
      // Mantıklı sınırlar içinde tut (5%–40%)
      const oran = Math.min(0.4, Math.max(0.05, hamOran));
      return NextResponse.json({
        optimization_rate: Math.round(oran * 1000) / 1000,
        kombine_servis: kombine,
        toplam_karar: toplam,
        _source: "brain",
      });
    }
  }

  // ── VİTRİN: beyin kapalı/boş ─────────────────────────────────────────────
  return NextResponse.json({
    optimization_rate: MOCK_RATE,
    kombine_servis: 0,
    toplam_karar: 0,
    _source: "mock",
  });
}

import { NextResponse } from "next/server";
import { getBrainOzet, getBrainKararlar, brainHasData } from "@/lib/brain";

export const dynamic = "force-dynamic";

// Beyin kapalı/boşken gösterilecek vitrin örneği (anlık karar döngüsü)
const MOCK = {
  brain_aktif: false,
  karar_sayisi: 0,
  anlik_maliyet: 0,
  anlik_tasarruf: 0,
  tasarruf_oran: 0,
  flm: 0,
  slm: 0,
  ikmal: 0,
  toplama: 0,
  kombine: 0,
};

export async function GET() {
  const [ozet, kararlar] = await Promise.all([
    getBrainOzet(),
    getBrainKararlar(),
  ]);

  // ── CANLI: beyin beslenmişse anlık karar döngüsü özeti ───────────────────
  if (ozet && brainHasData(kararlar)) {
    const maliyet = ozet.toplam_tahmini_maliyet || 0;
    const tasarruf = ozet.toplam_tahmini_tasarruf || 0;
    const taban = maliyet + tasarruf;
    const tasarrufOran = taban > 0 ? Math.round((tasarruf / taban) * 1000) / 10 : 0;

    return NextResponse.json({
      brain_aktif: true,
      karar_sayisi: kararlar.toplam_karar || kararlar.kararlar.length,
      anlik_maliyet: Math.round(maliyet),
      anlik_tasarruf: Math.round(tasarruf),
      tasarruf_oran: tasarrufOran,
      flm: ozet.flm_gerekli || 0,
      slm: ozet.slm_gerekli || 0,
      ikmal: ozet.ikmal_gerekli || 0,
      toplama: ozet.toplama_gerekli || 0,
      kombine: ozet.kombine_servis || 0,
      _source: "brain",
    });
  }

  // ── VİTRİN: beyin kapalı/boş ─────────────────────────────────────────────
  return NextResponse.json({ ...MOCK, _source: "mock" });
}

import { NextResponse } from "next/server";
import atmMasterData from "@/data/atm_master.json";
import {
  getBrainOzet,
  getBrainKararlar,
  brainHasData,
  isSlmKarari,
  isIkmalKarari,
  type BrainKarar,
} from "@/lib/brain";

export const dynamic = "force-dynamic";

const BRAIN_URL = process.env.BRAIN_API_URL ?? "http://localhost:8000";

type AtmOverlay = {
  faultCount: number;
  atmResponseTime: number;
  slmResponseTime: number;
  depositFailureCount: number;
  withdrawalFailureCount: number;
  withdrawalNoReplenishCount: number;
  atmAvailability: number;
  locationAvailability: number;
  withdrawalAvailability: number;
  depositAvailability: number;
  atmAvailabilityDaily: number;
  locationAvailabilityDaily: number;
  atmAvailability1Month: number;
  locationAvailability1Month: number;
  atmAvailability3Months: number;
  locationAvailability3Months: number;
  atmAvailability6Months: number;
  locationAvailability6Months: number;
  brainEylem: string;
  brainAciliyet: string;
  brainSebepler: string[];
};

type BrainSaglik = {
  yuklenen_atm: number;
  aktif_ariza: number;
  bakiye_kaydi: number;
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

function overlayFromKarar(k: BrainKarar): AtmOverlay {
  const risk = k.ariza_riski || 0;
  const avail = Math.max(85, Math.min(99.9, Math.round((99.5 - risk * 7) * 10) / 10));
  const isSlm = isSlmKarari(k);
  const sebep = (k.sebepler || []).join(" ").toUpperCase();
  const ac = (k.aciliyet || "").toUpperCase();

  let atmResponseTime = 45;
  if (ac.includes("KRIT")) atmResponseTime = 28;
  else if (ac.includes("YUK")) atmResponseTime = 38;
  else if (ac.includes("ORTA")) atmResponseTime = 52;

  let slmResponseTime = isSlm ? 95 : 65;
  if (ac.includes("KRIT") && isSlm) slmResponseTime = 75;

  let faultCount =
    isSlm || k.eylem.includes("FLM") || k.eylem.includes("MUDAHALE") ? 1 : 0;
  if (ac.includes("KRIT")) faultCount = Math.max(faultCount, 2);

  let withdrawalNoReplenish = 0;
  if (isIkmalKarari(k) && k.nakit_sure_saat < 48 && k.nakit_sure_saat < 999) {
    withdrawalNoReplenish = Math.max(1, Math.round(48 - k.nakit_sure_saat));
  }

  const depositFailureCount = /YATIR|DEPOSIT|KASA/.test(sebep)
    ? Math.floor(3 + risk * 10)
    : 0;
  const withdrawalFailureCount = /CEKIM|DISPENS|VERME|JAM|KART/.test(sebep)
    ? Math.floor(2 + risk * 8)
    : 0;

  return {
    faultCount,
    atmResponseTime,
    slmResponseTime,
    depositFailureCount: depositFailureCount || (faultCount > 0 ? 1 : 0),
    withdrawalFailureCount: withdrawalFailureCount || (faultCount > 0 ? 1 : 0),
    withdrawalNoReplenishCount: withdrawalNoReplenish,
    atmAvailability: avail,
    locationAvailability: avail - 1.2,
    withdrawalAvailability: avail - 0.8,
    depositAvailability: avail - 2.5,
    atmAvailabilityDaily: avail + 0.3,
    locationAvailabilityDaily: avail - 0.5,
    atmAvailability1Month: avail - 0.8,
    locationAvailability1Month: avail - 1.5,
    atmAvailability3Months: avail - 1.2,
    locationAvailability3Months: avail - 2,
    atmAvailability6Months: avail - 1.8,
    locationAvailability6Months: avail - 2.5,
    brainEylem: k.eylem,
    brainAciliyet: k.aciliyet,
    brainSebepler: k.sebepler || [],
  };
}

export async function GET() {
  const activeCount = (atmMasterData as { active?: boolean }[]).filter(
    (a) => a.active !== false
  ).length;

  const [ozet, kararlar, saglik] = await Promise.all([
    getBrainOzet(),
    getBrainKararlar(),
    getBrainSaglik(),
  ]);

  const summary = {
    total_atms: activeCount,
    brain_tracked: saglik?.yuklenen_atm ?? 0,
    aktif_ariza: saglik?.aktif_ariza ?? 0,
    bakiye_kaydi: saglik?.bakiye_kaydi ?? 0,
    kritik_atm: ozet?.kritik_atm ?? 0,
    kombine_servis: ozet?.kombine_servis ?? 0,
    toplam_nakit_tl: ozet?.toplam_nakit_tl ?? 0,
    karar_sayisi: kararlar?.toplam_karar ?? 0,
  };

  // ── CANLI: beyin kararları → terminal bazlı overlay ───────────────────────
  if (brainHasData(kararlar)) {
    const overlay: Record<string, AtmOverlay> = {};
    for (const k of kararlar.kararlar) {
      overlay[k.terminal_id] = overlayFromKarar(k);
    }

    return NextResponse.json({
      overlay,
      summary,
      _source: "brain",
    });
  }

  // ── VİTRİN: beyin kapalı/boş ─────────────────────────────────────────────
  return NextResponse.json({
    overlay: {} as Record<string, AtmOverlay>,
    summary,
    _source: "mock",
  });
}

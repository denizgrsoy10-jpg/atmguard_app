import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import atmMasterData from "@/data/atm_master.json";
import {
  getBrainOzet,
  getBrainKararlar,
  brainHasData,
  aciliyetToBand,
  isCashKarari,
  isIkmalKarari,
  isToplamaKarari,
} from "@/lib/brain";

export const dynamic = "force-dynamic";

type ATM = {
  atm_id: string;
  atm_name?: string;
  city: string;
  district: string;
  active?: boolean;
};

const MOCK_SUMMARY = {
  atms_tracked: 2590,
  total_cash_try: 128000000,
  low_cash_atms: 74,
  predicted_shortage_7d: 28,
  replenishments_planned_7d: 41,
};

function etaFromSaat(saat: number): string {
  if (saat <= 0 || saat >= 999) return "48h";
  if (saat < 24) return "Today";
  if (saat < 48) return "Tomorrow";
  return "48h";
}

export async function GET() {
  // ── CANLI: beyin beslenmişse nakit KPI'larını kararlardan türet ─────────
  const [ozet, kararlar] = await Promise.all([getBrainOzet(), getBrainKararlar()]);

  if (brainHasData(kararlar) && ozet) {
    const idx = new Map<string, ATM>();
    for (const a of atmMasterData as ATM[]) idx.set(a.atm_id, a);

    const cashKararlar = kararlar.kararlar.filter(isCashKarari);

    // Öncelikli nakit işlemleri: en kısa nakit süresi önce
    const top_actions = cashKararlar
      .slice()
      .sort((a, b) => (a.nakit_sure_saat || 999) - (b.nakit_sure_saat || 999))
      .slice(0, 3)
      .map((k) => {
        const m = idx.get(k.terminal_id);
        const action = isIkmalKarari(k)
          ? "Replenish"
          : isToplamaKarari(k)
          ? "Rebalance"
          : "Investigate";
        return {
          atm_id: k.terminal_id,
          atm_name: m?.atm_name || k.terminal_id,
          city: m?.city || "—",
          district: m?.district || "—",
          action,
          eta: etaFromSaat(k.nakit_sure_saat),
          risk: aciliyetToBand(k.aciliyet),
        };
      });

    // Sayıları kararlardan türet → top_actions ile birebir tutarlı
    const shortage7d = kararlar.kararlar.filter(
      (k) => (k.nakit_sure_saat || 999) > 0 && (k.nakit_sure_saat || 999) < 168
    ).length;
    const ikmalSayisi = kararlar.kararlar.filter(isIkmalKarari).length;
    const dusukNakit = kararlar.kararlar.filter(
      (k) => isIkmalKarari(k) || (k.nakit_sure_saat || 999) < 48
    ).length;

    // Toplam nakit beyinden gelirse canlı, gelmezse vitrin değeri
    const toplamNakit =
      ozet.toplam_nakit_tl && ozet.toplam_nakit_tl > 0
        ? Math.round(ozet.toplam_nakit_tl)
        : MOCK_SUMMARY.total_cash_try;

    return NextResponse.json({
      summary: {
        atms_tracked: ozet.toplam_atm || kararlar.kararlar.length,
        total_cash_try: toplamNakit,
        low_cash_atms: dusukNakit,
        predicted_shortage_7d: shortage7d,
        replenishments_planned_7d: ikmalSayisi,
      },
      top_actions,
      _source: "brain",
    });
  }

  // ── VİTRİN: beyin kapalı/boş → mevcut mock ──────────────────────────────
  try {
    const filePath = join(process.cwd(), "src/data/atm_master.json");
    const fileContent = readFileSync(filePath, "utf-8");
    const atms = JSON.parse(fileContent) as ATM[];
    const activeAtms = atms.filter((a) => a.active !== false);

    const actions = ["Replenish", "Rebalance", "Investigate"] as const;
    const etas = ["Today", "Tomorrow", "48h"] as const;
    const risks = ["High", "High", "Medium"] as const;

    const top_actions = activeAtms.slice(0, 3).map((a, idx) => ({
      atm_id: a.atm_id,
      atm_name: a.atm_name || "N/A",
      city: a.city,
      district: a.district,
      action: actions[idx % actions.length],
      eta: etas[idx % etas.length],
      risk: risks[idx % risks.length],
    }));

    return NextResponse.json({ summary: MOCK_SUMMARY, top_actions, _source: "mock" });
  } catch (error) {
    console.error("Error loading ATM data:", error);
    return NextResponse.json({ summary: MOCK_SUMMARY, top_actions: [], _source: "mock" });
  }
}

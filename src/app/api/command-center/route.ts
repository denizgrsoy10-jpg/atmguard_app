import { NextResponse } from "next/server";
import atmMasterData from "@/data/atm_master.json";
import { getBrainKararlar, brainHasData, aciliyetToBand, isSlmKarari } from "@/lib/brain";

export const dynamic = "force-dynamic";

type ATM = {
  atm_id: string;
  atm_name?: string;
  city: string;
  district: string;
  active?: boolean;
};

function etaFromAciliyet(aciliyet: string): string {
  const a = (aciliyet || "").toUpperCase();
  if (a.includes("KRIT")) return "1-2 saat";
  if (a.includes("YUK")) return "2-4 saat";
  if (a.includes("ORTA")) return "4-6 saat";
  return "1 gün içinde";
}

export async function GET() {
  const idx = new Map<string, ATM>();
  for (const a of atmMasterData as ATM[]) idx.set(a.atm_id, a);

  // ── CANLI: beyin beslenmişse SLM dispatch'i gerçek kararlardan kur ──────
  const kararlar = await getBrainKararlar();
  if (brainHasData(kararlar)) {
    const slmKararlar = kararlar.kararlar.filter(isSlmKarari);

    if (slmKararlar.length > 0) {
      const alerts = slmKararlar.map((k, index) => {
        const m = idx.get(k.terminal_id);
        const risk = k.ariza_riski || 0;
        const repeat = (k.sebepler || []).some((s) => /kronik|tekrar/i.test(s));
        return {
          id: index + 1,
          atm_id: k.terminal_id,
          atm_name: m?.atm_name || `ATM ${k.terminal_id}`,
          city: m?.city || "—",
          district: m?.district || "—",
          title: k.sebepler?.[0] || "SLM Gerekli — Teknisyen Müdahalesi",
          summary: (k.sebepler || []).join(" ") || "Beyin SLM önerdi.",
          severity: aciliyetToBand(k.aciliyet),
          action: `SLM AÇ — ${k.eylem}`,
          eta: etaFromAciliyet(k.aciliyet),
          status: "pending" as const,
          flm_count_48h: 0,
          flm_count_7d: 0,
          last_slm_days_ago: undefined as number | undefined,
          repeat_issue: repeat,
          availability: Math.round((99.5 - risk * 7) * 100) / 100,
          last_solution: undefined as string | undefined,
          decision_by: undefined as string | undefined,
          decision_at: undefined as string | undefined,
        };
      });

      return NextResponse.json({
        alerts,
        ops_summary: {
          open_alerts: alerts.filter((a) => a.status === "pending").length,
          high: alerts.filter((a) => a.severity === "High").length,
          medium: alerts.filter((a) => a.severity === "Medium").length,
          low: alerts.filter((a) => a.severity === "Low").length,
          slm_opened: 0,
        },
        _source: "brain",
      });
    }
  }

  // ── VİTRİN: beyin kapalı/boş/SLM yok → mock SLM dispatch ────────────────
  const allAtms = atmMasterData as ATM[];
  const selectedAtms = allAtms
    .filter((atm) => atm.active === true)
    .sort(() => Math.random() - 0.5)
    .slice(0, 8);

  const alertTitles = [
    "48 saatte 2. CCDM Jam - SLM Gerekli",
    "Kart Okuyucu 3. Arıza - Teknisyen Gitsin",
    "Aynı Receipt Printer Hatası - SLM Aç",
    "Dispenser Tekrar Eden Hata",
    "Sensor Arıza Döngüsü - 90 Gün SLM Yok",
    "Cash Module Aşınma Belirtileri",
    "EPP Reset Etkisiz - Donanım Sorunu",
    "Bill Acceptor Değişim Zamanı",
  ];

  const alertSummaries = [
    "48 saat içinde aynı yerden 2 FLM geldi. Sorun çözülmüyor, teknisyen gitmeli.",
    "2 kez üst üste kart okuyucu arızası. FLM göndermeyin, SLM açın teknisyen baksın.",
    "Son 24 saatte SLM gitti ama tekrar arıza. Geçmiş çözüm kaydına bakın.",
    "Uzun zamandır SLM olmadı, bu ATM'e bakım yaptıralım.",
    "Aynı yerden çok FLM geliyor - parça değişimi gerekiyor.",
    "Nakit modülü aşınma gösteriyor - önleyici bakım öneriyoruz.",
    "Reset denemeleri etkisiz - donanım sorunu mevcut.",
    "Para kabul ünitesi sık arıza veriyor - teknisyen müdahalesi gerekli.",
  ];

  const severities: ("High" | "Medium" | "Low")[] = [
    "High", "High", "High", "Medium", "Medium", "Medium", "Low", "Medium",
  ];
  const actions = [
    "SLM AÇ - 2. FLM yerine teknisyen gitsin",
    "SLM AÇ - Kart okuyucu değişimi",
    "SLM AÇ - Yazıcı modülü kontrolü",
    "SLM AÇ - Dispenser bakımı",
    "SLM AÇ - Sensor/donanım değişimi",
    "SLM AÇ - Önleyici bakım",
    "SLM AÇ - EPP donanım kontrolü",
    "SLM AÇ - Bill acceptor değişimi",
  ];
  const etas = ["2-4 saat", "3-5 saat", "2-3 saat", "4-6 saat", "3-4 saat", "1 gün içinde", "2-3 saat", "4-5 saat"];
  const statuses: ("pending" | "slm_opened" | "scheduled_maintenance" | "rejected")[] = [
    "pending", "pending", "pending", "pending", "slm_opened", "pending", "pending", "scheduled_maintenance",
  ];
  const availabilities = [92.3, 91.5, 93.8, 89.2, 94.5, 96.1, 88.7, 90.4];
  const flmCounts48h = [2, 2, 1, 0, 3, 1, 2, 1];
  const flmCounts7d = [4, 5, 3, 2, 6, 2, 4, 3];
  const lastSlmDays = [15, 30, 1, 120, 95, 180, 45, 60];
  const repeatIssues = [true, true, true, false, true, false, true, false];
  const lastSolutions = [
    "BANTAŞ jam temizledi ama sorun devam ediyor",
    "Kart okuyucu temizlendi ancak arıza tekrar etti",
    "Yazıcı kağıt değişimi yapıldı fakat sorun sürekli",
    null,
    "Reset yapıldı ancak arıza tekrar ediyor",
    null,
    "EPP resetlendi ama donanım sorunu var",
    null,
  ];

  const alerts = selectedAtms.map((atm, index) => ({
    id: index + 1,
    atm_id: atm.atm_id,
    atm_name: atm.atm_name || `ATM ${atm.atm_id}`,
    city: atm.city,
    district: atm.district,
    title: alertTitles[index],
    summary: alertSummaries[index],
    severity: severities[index],
    action: actions[index],
    eta: etas[index],
    status: statuses[index],
    flm_count_48h: flmCounts48h[index],
    flm_count_7d: flmCounts7d[index],
    last_slm_days_ago: lastSlmDays[index],
    repeat_issue: repeatIssues[index],
    availability: availabilities[index],
    last_solution: repeatIssues[index] ? lastSolutions[index] : undefined,
    decision_by: statuses[index] !== "pending" ? "Operatör: Güneri K." : undefined,
    decision_at:
      statuses[index] !== "pending"
        ? new Date(Date.now() - Math.random() * 3600000).toISOString()
        : undefined,
  }));

  return NextResponse.json({
    alerts,
    ops_summary: {
      open_alerts: alerts.filter((a) => a.status === "pending").length,
      high: alerts.filter((a) => a.severity === "High").length,
      medium: alerts.filter((a) => a.severity === "Medium").length,
      low: alerts.filter((a) => a.severity === "Low").length,
      slm_opened: alerts.filter((a) => a.status === "slm_opened").length,
    },
    _source: "mock",
  });
}

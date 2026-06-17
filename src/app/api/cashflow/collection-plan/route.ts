/**
 * /api/cashflow/collection-plan
 *
 * ATM'lerin yatan banknot kasetlerinin doluluk durumuna göre
 * para toplama planı üretir.
 *
 * Mantık:
 *  1. atm_master.json'dan all_in_capacity olan ATM'leri al
 *  2. Her ATM için günlük yatırma hızını zone + lokasyon tipine göre tahmin et
 *  3. Deterministic seed ile şu anki doluluk simüle et (gerçek veri gelince burası değişir)
 *  4. days_until_full = (capacity - current) / daily_rate
 *  5. Sonuçları öncelik sırasına göre döndür
 */

import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { getBrainKararlar, brainHasData, isToplamaKarari } from "@/lib/brain";

export const dynamic = "force-dynamic";

// ── Tip Tanımları ──────────────────────────────────────────────────────────────

type ATM = {
  atm_id: string;
  atm_name?: string;
  city: string;
  district: string;
  region?: string;
  zone?: string;
  location_type?: string;
  sub_location?: string;
  latitude?: string | number;
  longitude?: string | number;
  active?: boolean;
  all_in_capacity?: number | null;
  cash_center?: string;
};

export type CollectionATM = {
  atm_id: string;
  atm_name: string;
  city: string;
  district: string;
  latitude: number;
  longitude: number;
  all_in_capacity: number;
  current_deposit_count: number; // şu anki kaset doluluk adedi
  fill_pct: number;              // doluluk yüzdesi 0-100
  daily_deposit_rate: number;    // günlük ortalama yatırılan banknot adedi
  days_until_full: number;       // kaç günde dolacak
  urgency: "critical" | "high" | "medium" | "low"; // toplama önceliği
};

export type CollectionSuggestion = {
  id: number;
  tarih: string;          // ISO date
  type: "collection";
  atmId: string;
  atmName: string;
  city: string;
  district: string;
  priority: "high" | "medium" | "low";
  reason: string;
  eta: string;
  confidence: number;
  fill_pct: number;
  all_in_capacity: number;
  current_deposit_count: number;
  daily_deposit_rate: number;
};

export type CollectionPlanResponse = {
  generated_at: string;
  _source?: "brain" | "mock";        // beyin önceliklendirdi mi?
  high_cash_atms: CollectionATM[];   // doluluk > 85% — haritada gösterilecek
  collection_suggestions: CollectionSuggestion[]; // öneri planı
  summary: {
    total_deposit_capable: number;
    critical_count: number;   // > 90%
    high_count: number;       // 85-90%
    medium_count: number;     // 70-85%
    needs_collection_today: number;
    needs_collection_tomorrow: number;
    needs_collection_d2: number;
  };
};

// ── Yardımcı Fonksiyonlar ──────────────────────────────────────────────────────

/** Deterministic pseudo-random (tekrarlanabilir, Math.random() değil) */
function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

/** ATM ID'sinden sayısal seed üret */
function atmSeed(atmId: string): number {
  return atmId.split("").reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7);
}

/**
 * Günlük tahmini yatırma hızı (banknot/gün)
 * Zone ve lokasyon tipine göre kalibre edilmiş tahminler.
 * Gerçek veri bağlandığında bu fonksiyon kaldırılır.
 */
function estimateDailyDepositRate(atm: ATM): number {
  const zone = parseInt(atm.zone || "3", 10);
  const locType = (atm.location_type || "").toLowerCase();
  const subLoc = (atm.sub_location || "").toLowerCase();

  // Baz oran — lokasyon tipine göre
  let base = 60; // banknot/gün varsayılan

  if (locType === "offsite") {
    if (subLoc.includes("avm") || subLoc.includes("alış")) base = 180;
    else if (subLoc.includes("otogar") || subLoc.includes("havali") || subLoc.includes("tren")) base = 150;
    else if (subLoc.includes("osb") || subLoc.includes("organize")) base = 100;
    else if (subLoc.includes("market") || subLoc.includes("akaryak")) base = 120;
    else base = 90;
  } else if (locType === "şube" || locType === "sube") {
    if (subLoc.includes("içi") || subLoc.includes("ici")) base = 80;
    else base = 60;
  } else if (locType === "e-gişe" || locType === "e-gise") {
    base = 70;
  } else {
    base = 65;
  }

  // Zone çarpanı: zone 1 en yoğun, zone 5 en seyrek
  const zoneMultiplier: Record<number, number> = {
    1: 1.6,
    2: 1.35,
    3: 1.1,
    4: 0.85,
    5: 0.65,
    12: 0.5,
  };
  const zm = zoneMultiplier[zone] ?? 1.0;

  return Math.round(base * zm);
}

/**
 * Şu anki doluluk miktarını simüle eder (deterministic).
 * Gerçek para toplama verisi bağlandığında bu fonksiyon yerine
 * gerçek ikmal/toplama logu okunacak.
 */
function simulateCurrentFill(atm: ATM, capacity: number, dailyRate: number): number {
  const seed = atmSeed(atm.atm_id);
  // Günlük oran yüksekse ATM daha hızlı dolar → ortalaması daha yüksek tutalım
  const avgFillDays = capacity / dailyRate; // tam dolması için gereken gün
  // Genellikle son toplama üzerinden 1 ile (avgFillDays * 0.9) gün geçmiş gibi simüle et
  const daysSinceCollection = seededRand(seed) * avgFillDays * 0.9 + 0.5;
  const current = Math.round(dailyRate * daysSinceCollection);
  return Math.min(current, capacity - 1); // asla tam dolmamış (henüz)
}

/** Doluluk yüzdesine göre öncelik */
function urgencyFromFill(fillPct: number): CollectionATM["urgency"] {
  if (fillPct >= 90) return "critical";
  if (fillPct >= 80) return "high";
  if (fillPct >= 65) return "medium";
  return "low";
}

/** Lokasyon tipi açıklaması */
function locationLabel(atm: ATM): string {
  const sub = atm.sub_location || "";
  if (sub) return sub;
  return atm.location_type || "ATM";
}

/** Tarih + N gün ekle (ISO string) */
function addDays(base: Date, n: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Ana GET Handler ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const filePath = join(process.cwd(), "src/data/atm_master.json");
    const atms: ATM[] = JSON.parse(readFileSync(filePath, "utf-8"));

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // 1. Yatan kapasitesi olan aktif ATM'leri filtrele
    const depositAtms = atms.filter(
      (a) => a.active !== false && a.all_in_capacity && a.all_in_capacity > 0
    );

    // 2. Her ATM için doluluk hesapla
    const richAtms: CollectionATM[] = depositAtms.map((atm) => {
      const capacity = atm.all_in_capacity!;
      const dailyRate = estimateDailyDepositRate(atm);
      const current = simulateCurrentFill(atm, capacity, dailyRate);
      const fillPct = Math.round((current / capacity) * 100);
      const remaining = capacity - current;
      const daysUntilFull = dailyRate > 0 ? remaining / dailyRate : 999;

      const lat =
        typeof atm.latitude === "string"
          ? parseFloat(atm.latitude.replace(",", "."))
          : (atm.latitude ?? 39.0);
      const lng =
        typeof atm.longitude === "string"
          ? parseFloat(atm.longitude.replace(",", "."))
          : (atm.longitude ?? 35.0);

      return {
        atm_id: atm.atm_id,
        atm_name: atm.atm_name || atm.atm_id,
        city: atm.city,
        district: atm.district,
        latitude: isNaN(lat) ? 39.0 : lat,
        longitude: isNaN(lng) ? 35.0 : lng,
        all_in_capacity: capacity,
        current_deposit_count: current,
        fill_pct: fillPct,
        daily_deposit_rate: dailyRate,
        days_until_full: Math.round(daysUntilFull * 10) / 10,
        urgency: urgencyFromFill(fillPct),
      };
    });

    // 3. Para toplama haritası için: doluluk > 85% olanlar
    const highCashAtms = richAtms
      .filter((a) => a.fill_pct >= 85)
      .sort((a, b) => b.fill_pct - a.fill_pct);

    // 4. Öneri üret — doluluk 70%+ olanları önceliğe al
    //    days_until_full <= 0 → bugün, <= 1 → yarın, <= 2 → öbür gün
    const candidates = richAtms
      .filter((a) => a.fill_pct >= 70)
      .sort((a, b) => a.days_until_full - b.days_until_full);

    const suggestions: CollectionSuggestion[] = candidates
      .slice(0, 50) // max 50 öneri
      .map((a, idx) => {
        let daysOffset = 0;
        if (a.days_until_full > 2) daysOffset = 2;
        else if (a.days_until_full > 1) daysOffset = 1;
        else daysOffset = 0;

        // Toplama tarihi: dolmadan en az 1 gün önce
        const collectOnDay = Math.max(0, Math.ceil(a.days_until_full) - 1);
        const collectDate = addDays(now, collectOnDay);

        const priority: "high" | "medium" | "low" =
          a.urgency === "critical" || a.urgency === "high"
            ? "high"
            : a.urgency === "medium"
            ? "medium"
            : "low";

        const confidence = Math.min(98, Math.round(70 + a.fill_pct * 0.28));

        // Neden topla — açıklama metni
        const loc = locationLabel(a as unknown as ATM);
        const reason = `Kaset %${a.fill_pct} dolu — ${loc} lokasyonu, günlük ~${a.daily_deposit_rate} adet yatırım. ${
          a.days_until_full < 1
            ? "⚠️ Bugün kapanma riski!"
            : `${Math.ceil(a.days_until_full)} günde dolacak.`
        }`;

        // ETA saati — mesai saati içinde, zone'a göre
        const etaHour = 14 + (idx % 5);
        const eta = daysOffset === 0
          ? `${etaHour}:00`
          : daysOffset === 1
          ? "Yarın " + `${etaHour}:00`
          : `+${daysOffset} gün ${etaHour}:00`;

        return {
          id: idx + 1,
          tarih: collectDate,
          type: "collection" as const,
          atmId: a.atm_id,
          atmName: a.atm_name,
          city: a.city,
          district: a.district,
          priority,
          reason,
          eta,
          confidence,
          fill_pct: a.fill_pct,
          all_in_capacity: a.all_in_capacity,
          current_deposit_count: a.current_deposit_count,
          daily_deposit_rate: a.daily_deposit_rate,
        };
      });

    // 4b. BEYİN ÖNCELİKLENDİRME — beyin "topla" dediği ATM'leri öne al + işaretle
    //     (Kaset-doluluk detayı kapasiteden gelir; beyin sadece ÖNCELİĞİ belirler.)
    let source: "brain" | "mock" = "mock";
    const kararlar = await getBrainKararlar();
    if (brainHasData(kararlar)) {
      const beyinToplamaIds = new Set(
        kararlar.kararlar.filter(isToplamaKarari).map((k) => k.terminal_id)
      );
      if (beyinToplamaIds.size > 0) {
        let etkilendi = false;
        for (const s of suggestions) {
          if (beyinToplamaIds.has(s.atmId)) {
            etkilendi = true;
            s.priority = "high";
            s.confidence = Math.max(s.confidence, 95);
            if (!s.reason.startsWith("🧠")) s.reason = `🧠 Beyin: topla — ${s.reason}`;
          }
        }
        // Beyin işaretlileri en üste taşı
        suggestions.sort((a, b) => {
          const ab = beyinToplamaIds.has(a.atmId) ? 1 : 0;
          const bb = beyinToplamaIds.has(b.atmId) ? 1 : 0;
          return bb - ab;
        });
        if (etkilendi) source = "brain";
      }
    }

    // 5. Özet istatistikler
    const summary = {
      total_deposit_capable: depositAtms.length,
      critical_count: richAtms.filter((a) => a.fill_pct >= 90).length,
      high_count: richAtms.filter((a) => a.fill_pct >= 85 && a.fill_pct < 90).length,
      medium_count: richAtms.filter((a) => a.fill_pct >= 70 && a.fill_pct < 85).length,
      needs_collection_today: suggestions.filter((s) => s.tarih === today).length,
      needs_collection_tomorrow: suggestions.filter((s) => s.tarih === addDays(now, 1)).length,
      needs_collection_d2: suggestions.filter((s) => s.tarih === addDays(now, 2)).length,
    };

    const response: CollectionPlanResponse = {
      generated_at: now.toISOString(),
      _source: source,
      high_cash_atms: highCashAtms,
      collection_suggestions: suggestions,
      summary,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("collection-plan error:", err);
    return NextResponse.json(
      { error: "Kapasite verisi yüklenemedi", detail: String(err) },
      { status: 500 }
    );
  }
}

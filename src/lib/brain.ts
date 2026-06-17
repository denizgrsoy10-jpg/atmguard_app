// ════════════════════════════════════════════════════════════════════════
//  BEYİN İSTEMCİSİ (server-side)
//  Next.js API route'larından beyin API'sine (FastAPI :8000) bağlanır.
//
//  Tasarım ilkesi — "vitrini bozma":
//    • Beyin AYAKTA ve BESLENMİŞSE  → canlı veri döner.
//    • Beyin kapalı / boş / hata     → null döner; route mock'a düşer.
//  Böylece offline demoda dashboard dolu görünür, canlıda gerçeğe döner.
// ════════════════════════════════════════════════════════════════════════

const BRAIN_URL = process.env.BRAIN_API_URL ?? "http://localhost:8000";
const TIMEOUT_MS = 2500; // beyin yavaş/kapalıysa route'u bekletme

export type BrainKarar = {
  terminal_id: string;
  zaman: string;
  eylem: string;
  aciliyet: string;
  atanan_takim: string;
  tahmini_maliyet: number;
  tahmini_tasarruf: number;
  kombine_isler: string[];
  sebepler: string[];
  ariza_riski: number;
  nakit_sure_saat: number;
  gerceklesen_eylem: string | null;
  geri_bildirim_tarihi: string | null;
};

export type BrainKararlar = {
  zaman: string;
  toplam_karar: number;
  kritik_sayisi: number;
  kararlar: BrainKarar[];
};

export type BrainOzet = {
  zaman: string;
  toplam_atm: number;
  toplam_nakit_tl?: number;     // sahadaki toplam nakit (tl_bakiye + recycle)
  izlenen_bakiye_atm?: number;  // bakiye feed'i gelen ATM sayısı
  kritik_atm: number;
  yuksek_atm: number;
  kombine_servis: number;
  flm_gerekli: number;
  slm_gerekli: number;
  ikmal_gerekli: number;
  toplama_gerekli: number;
  toplam_tahmini_maliyet: number;
  toplam_tahmini_tasarruf: number;
  proaktif?: Record<string, unknown>;
};

async function brainGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BRAIN_URL}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Beyin kapalı / timeout / ağ hatası → sessizce mock'a düş
    return null;
  }
}

export const getBrainOzet = () => brainGet<BrainOzet>("/api/v1/ozet");
export const getBrainKararlar = () => brainGet<BrainKararlar>("/api/v1/kararlar");

/** Beyin beslenmiş ve canlı mı? (en az 1 karar üretmişse) */
export function brainHasData(k: BrainKararlar | null): k is BrainKararlar {
  return !!k && Array.isArray(k.kararlar) && k.kararlar.length > 0;
}

/** aciliyet → risk band / severity */
export function aciliyetToBand(aciliyet: string): "High" | "Medium" | "Low" {
  const a = (aciliyet || "").toUpperCase();
  if (a.includes("KRIT") || a.includes("YUK")) return "High";
  if (a.includes("ORTA")) return "Medium";
  return "Low";
}

/** aciliyet → sıralama ağırlığı (yüksek = daha acil) */
export function aciliyetWeight(aciliyet: string): number {
  const a = (aciliyet || "").toUpperCase();
  if (a.includes("KRIT")) return 3;
  if (a.includes("YUK")) return 2;
  if (a.includes("ORTA")) return 1;
  return 0;
}

/** Bir kararın arıza/servis (FLM/SLM) ile ilgili olup olmadığı */
export function isArizaKarari(eylem: string): boolean {
  return /FLM|SLM|ARIZA|MUDAHALE|PROAKTIF/i.test(eylem || "");
}

/** SLM (teknisyen) gerektiren karar mı? (kombine servise gömülü SLM dahil) */
export function isSlmKarari(k: BrainKarar): boolean {
  const e = (k.eylem || "").toUpperCase();
  const t = (k.atanan_takim || "").toUpperCase();
  // Beyin SLM'i COMBINED_SERVICE içine gömebilir (kombine_isler: 'SLM + ...')
  const kombine = (k.kombine_isler || []).join(" ").toUpperCase();
  return (
    e.includes("SLM") ||
    kombine.includes("SLM") ||
    t.includes("TEKNISYEN") ||
    t.includes("VENDOR")
  );
}

// ── Nakit (cash) tarafı yardımcıları ────────────────────────────────────────

/** İkmal (replenishment) kararı mı? (kombineye gömülü dahil) */
export function isIkmalKarari(k: BrainKarar): boolean {
  const e = (k.eylem || "").toUpperCase();
  const kombine = (k.kombine_isler || []).join(" ").toUpperCase();
  return e.includes("IKMAL") || kombine.includes("IKMAL");
}

/** Para toplama (collection) kararı mı? (kombineye gömülü dahil) */
export function isToplamaKarari(k: BrainKarar): boolean {
  const e = (k.eylem || "").toUpperCase();
  const kombine = (k.kombine_isler || []).join(" ").toUpperCase();
  return e.includes("TOPLAMA") || kombine.includes("TOPLAMA");
}

/** Herhangi bir nakit (ikmal/toplama) kararı mı? */
export function isCashKarari(k: BrainKarar): boolean {
  return isIkmalKarari(k) || isToplamaKarari(k);
}

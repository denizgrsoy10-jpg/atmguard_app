import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const AI_ENGINE_DIR = join(process.cwd(), "ai_engine");
const UPLOADS_DIR   = join(AI_ENGINE_DIR, "uploads");
const LOG_FILE      = join(AI_ENGINE_DIR, "training_log.json");

export type TrainingLogEntry = {
  id: string;
  tarih: string;
  veri_turu: string;
  ay: string;
  yil: string;
  dosya_adi: string;
  satir_sayisi: number;
  kolonlar: string[];
  durum: "basarili" | "hata";
  hata_mesaji?: string;
};

function loadLog(): TrainingLogEntry[] {
  try {
    if (existsSync(LOG_FILE)) return JSON.parse(readFileSync(LOG_FILE, "utf-8"));
  } catch {}
  return [];
}

function saveLog(entries: TrainingLogEntry[]) {
  try {
    mkdirSync(AI_ENGINE_DIR, { recursive: true });
    writeFileSync(LOG_FILE, JSON.stringify(entries, null, 2), "utf-8");
  } catch {}
}

// Her veri türü için beklenen canonical kolonlar
const BEKLENEN_KOLONLAR: Record<string, string[]> = {
  ariza_log:     ["terminal_id", "tarih", "ariza_kodu", "aciklama", "durum", "sure_dk"],
  ikmal:         ["terminal_id", "tarih", "ikmal_tutar", "kaset_miktari"],
  para_toplama:  ["terminal_id", "tarih", "toplama_tutar"],
  gunluk_bakiye: ["terminal_id", "tarih", "tl_bakiye", "kaset_1", "kaset_2",
                  "kaset_3", "kaset_4", "recycle_bakiye"],
  // XFS: tab-separated metin log, kolonlar sabit (17 kolon)
  xfs_log:       ["terminal_id", "session_id", "event_zaman", "mesaj_tipi",
                  "komut", "result", "detay", "session_tipi"],
};

// Kolon alias eşleştirme — bankadan gelen farklı isimler
const ALIAS_MAP: Record<string, string> = {
  "atm id": "terminal_id", "atm_id": "terminal_id",
  "tarih": "tarih", "date": "tarih", "created_at": "tarih",
  "arıza türü": "ariza_kodu", "ariza_turu": "ariza_kodu", "fault_code": "ariza_kodu",
  "açıklama": "aciklama", "description": "aciklama",
  "tl bakiye": "tl_bakiye", "bakiye": "tl_bakiye",
  "kaset 1": "kaset_1", "kaset 2": "kaset_2", "kaset 3": "kaset_3", "kaset 4": "kaset_4",
  "kaset 5": "kaset_5", "kaset 6": "kaset_6", "kaset 7": "kaset_7", "kaset 8": "kaset_8",
  "recycle bakiye": "recycle_bakiye",
};

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const lk = key.toLowerCase().trim();
    normalized[ALIAS_MAP[lk] ?? lk] = value;
  }
  return normalized;
}

export async function POST(req: NextRequest) {
  const logEntry: Partial<TrainingLogEntry> = {
    id:    Date.now().toString(),
    tarih: new Date().toISOString(),
    durum: "basarili",
  };

  try {
    const formData    = await req.formData();
    const file        = formData.get("file")      as File   | null;
    const veri_turu   = formData.get("veri_turu") as string | null ?? "ariza_log";
    const ay          = formData.get("ay")        as string | null ?? "01";
    const yil         = formData.get("yil")       as string | null ?? "2026";

    logEntry.veri_turu = veri_turu;
    logEntry.ay        = ay;
    logEntry.yil       = yil;

    if (!file) {
      return NextResponse.json({ error: "Dosya seçilmedi" }, { status: 400 });
    }

    logEntry.dosya_adi = file.name;

    // ── XFS Log: metin dosyası (All.txt), Excel değil ─────────────────────
    if (veri_turu === "xfs_log") {
      const rawText = Buffer.from(await file.arrayBuffer()).toString("utf-8");
      const satirSayisi = rawText.split("\n").filter((l) => l.trim()).length;
      logEntry.satir_sayisi = satirSayisi;
      logEntry.kolonlar     = BEKLENEN_KOLONLAR["xfs_log"];

      // Kaydı log'a yaz
      const logArr = loadLog();
      logArr.unshift(logEntry as TrainingLogEntry);
      saveLog(logArr.slice(0, 100));

      // Raw txt dosyasını kaydet
      mkdirSync(UPLOADS_DIR, { recursive: true });
      const txtFname = `xfs_log_${yil}_${ay.padStart(2, "0")}_${Date.now()}.txt`;
      writeFileSync(join(UPLOADS_DIR, txtFname), rawText, "utf-8");

      // Beyne gönder: /api/v1/xfs-log-raw
      let beyinSonucu: Record<string, unknown> | null = null;
      try {
        const beyinRes = await fetch(`${process.env.BRAIN_API_URL ?? 'http://localhost:8000'}/api/v1/xfs-log-raw`, {
          method : "POST",
          headers: { "Content-Type": "application/json" },
          body   : JSON.stringify({ raw_log: rawText }),
          signal : AbortSignal.timeout(60_000),   // XFS dosyaları büyük olabilir
        });
        if (beyinRes.ok) {
          beyinSonucu = await beyinRes.json() as Record<string, unknown>;
        } else {
          beyinSonucu = { uyari: `Beyin yanıt vermedi (HTTP ${beyinRes.status})` };
        }
      } catch {
        beyinSonucu = {
          uyari: "Beyin servisi şu an kapalı (port 8000). " +
                 "Log kaydedildi; python3 ai_engine/api_server.py ile servisi başlatın.",
        };
      }

      return NextResponse.json({
        success          : true,
        satir_sayisi     : satirSayisi,
        kolonlar         : BEKLENEN_KOLONLAR["xfs_log"],
        eslesen_kolonlar : BEKLENEN_KOLONLAR["xfs_log"],
        beklenen_kolonlar: BEKLENEN_KOLONLAR["xfs_log"],
        eslesme_orani    : 100,
        mesaj            : `${satirSayisi.toLocaleString("tr-TR")} satır XFS logu işlendi.`,
        dosya_adi        : txtFname,
        beyin            : beyinSonucu,
      });
    }

    const buf      = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buf, { type: "buffer", cellDates: true });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows  = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw:    false,
    });

    const rows     = rawRows.map(normalizeRow);
    const kolonlar = rows.length > 0 ? Object.keys(rows[0]) : [];

    logEntry.satir_sayisi = rows.length;
    logEntry.kolonlar     = kolonlar;

    // Eşleşen canonical kolon sayısı
    const beklenen = BEKLENEN_KOLONLAR[veri_turu] ?? [];
    const eslesen  = beklenen.filter((k) => kolonlar.includes(k));

    // Kaydet
    mkdirSync(UPLOADS_DIR, { recursive: true });
    const fname = `${veri_turu}_${yil}_${ay.padStart(2, "0")}_${Date.now()}.json`;
    writeFileSync(
      join(UPLOADS_DIR, fname),
      JSON.stringify({ meta: { veri_turu, ay, yil, dosya_adi: file.name, satir_sayisi: rows.length }, data: rows }, null, 2),
      "utf-8",
    );

    // Log güncelle
    const log = loadLog();
    log.unshift(logEntry as TrainingLogEntry);
    saveLog(log.slice(0, 100));

    // ── Beyne Gönder: FastAPI /api/v1/toplu-ogret ─────────────────────────
    // Dosya kaydedildi → şimdi beyin motoruna besle
    let beyinSonucu: Record<string, unknown> | null = null;
    try {
      const beyinRes = await fetch(`${process.env.BRAIN_API_URL ?? 'http://localhost:8000'}/api/v1/toplu-ogret`, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ dosya_adi: fname }),
        signal : AbortSignal.timeout(15_000),   // 15 sn timeout
      });
      if (beyinRes.ok) {
        beyinSonucu = await beyinRes.json() as Record<string, unknown>;
      } else {
        beyinSonucu = { uyari: `Beyin yanıt vermedi (HTTP ${beyinRes.status})` };
      }
    } catch {
      // Beyin servisi kapalıysa sustur — temel yükleme başarılı sayılır
      beyinSonucu = {
        uyari: "Beyin servisi şu an kapalı (port 8000). " +
               "Veriler kaydedildi; python3 ai_engine/api_server.py ile servisi başlatın.",
      };
    }

    return NextResponse.json({
      success          : true,
      satir_sayisi     : rows.length,
      kolonlar,
      eslesen_kolonlar : eslesen,
      beklenen_kolonlar: beklenen,
      eslesme_orani    : beklenen.length > 0
                           ? Math.round((eslesen.length / beklenen.length) * 100)
                           : 100,
      mesaj: `${rows.length.toLocaleString("tr-TR")} satır işlendi, beyne gönderildi.`,
      dosya_adi        : fname,
      beyin            : beyinSonucu,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
    logEntry.durum        = "hata";
    logEntry.hata_mesaji  = msg;
    const log = loadLog();
    log.unshift(logEntry as TrainingLogEntry);
    saveLog(log.slice(0, 100));
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(loadLog());
}

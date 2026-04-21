/**
 * XFS Log — Next.js API Route
 * POST /api/xfs-log
 *
 * XFS uygulama logu (All.txt / tab-separated 17-kolon) dosyasını alır,
 * doğrudan AI brain'e gönderir ve ATM bazlı analiz sonuçlarını döner.
 */
import { NextRequest, NextResponse } from "next/server";

const BRAIN_BASE_URL = process.env.BRAIN_API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "FormData okunamadı" }, { status: 400 });
  }

  const file = formData.get("log_file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "log_file alanı eksik" }, { status: 400 });
  }

  // Dosyayı text olarak oku
  const rawText = Buffer.from(await file.arrayBuffer()).toString("utf-8");

  if (!rawText.trim()) {
    return NextResponse.json({ error: "Dosya içeriği boş" }, { status: 400 });
  }

  try {
    // Beyin'in /api/v1/xfs-log-raw endpoint'ine gönder
    // Bu endpoint XFSLogParser'ı çalıştırır + tüm ATM'leri beyne besler
    const brainRes = await fetch(`${BRAIN_BASE_URL}/api/v1/xfs-log-raw`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ raw_log: rawText }),
      signal:  AbortSignal.timeout(120_000),   // XFS dosyaları büyük olabilir
    });

    if (!brainRes.ok) {
      const errText = await brainRes.text().catch(() => "");
      return NextResponse.json(
        { error: `AI Brain yanıt vermedi (HTTP ${brainRes.status})`, detail: errText },
        { status: 502 }
      );
    }

    const data = await brainRes.json();

    return NextResponse.json({
      ...data,
      log_type:    "XFS",
      source_file: file.name,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error:  `XFS log analiz hatası: ${msg}`,
        detail: "Beyin servisi kapalı olabilir (port 8000). " +
                "python3 ai_engine/api_server.py ile başlatın.",
        log_type: "XFS",
      },
      { status: 500 }
    );
  }
}

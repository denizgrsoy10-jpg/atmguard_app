/**
 * IDC Log — Next.js API Route
 * POST /api/idc-log
 *
 * Accepts a .txt IDC log file upload, pipes it through
 * idc_log_parser.py, then asks the AI brain for an action plan.
 */
import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const TMP_DIR         = join(process.cwd(), "tmp");
const BRAIN_BASE_URL  = process.env.BRAIN_API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  // ── 1. Dosyayı al ─────────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "FormData okunamadı" }, { status: 400 });
  }

  const file = formData.get("log_file") as File | null;
  if (!file) {
    return NextResponse.json(
      { error: "log_file alanı eksik" },
      { status: 400 }
    );
  }

  // ── 2. Geçici dosya yaz ───────────────────────────────────────────────────
  if (!existsSync(TMP_DIR)) await mkdir(TMP_DIR, { recursive: true });

  const tmpPath = join(TMP_DIR, `idc_${Date.now()}_${file.name}`);
  const bytes   = await file.arrayBuffer();
  await writeFile(tmpPath, Buffer.from(bytes));

  try {
    // ── 3. Python IDC parser çalıştır ────────────────────────────────────────
    const parserScript = join(process.cwd(), "ai_engine", "idc_log_parser.py");
    let parserData: Record<string, unknown>;

    try {
      const { stdout, stderr } = await execAsync(
        `python3 "${parserScript}" --json-only "${tmpPath}"`,
        { timeout: 60_000 }
      );
      if (stderr && !stdout) {
        throw new Error(stderr);
      }
      parserData = JSON.parse(stdout);
    } catch (parseErr) {
      console.error("IDC parser hatası:", parseErr);
      return NextResponse.json(
        { error: "IDC log parse edilemedi", detail: String(parseErr) },
        { status: 422 }
      );
    }

    // ── 4. AI Brain'e gönder ─────────────────────────────────────────────────
    let brainData: Record<string, unknown> = {};

    try {
      const brainRes = await fetch(
        `${BRAIN_BASE_URL}/api/v1/idc-log-analiz`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(parserData),
          signal:  AbortSignal.timeout(30_000),
        }
      );

      if (brainRes.ok) {
        brainData = await brainRes.json();
      } else {
        console.warn("IDC brain yanıt vermedi, sadece parser verisi kullanılıyor");
      }
    } catch (brainErr) {
      console.warn("IDC brain bağlantı hatası:", brainErr);
    }

    // ── 5. Yanıtı birleştir ───────────────────────────────────────────────────
    return NextResponse.json({
      ...parserData,
      brain: Object.keys(brainData).length > 0 ? brainData : null,
    });
  } finally {
    // Geçici dosyayı temizle
    try {
      await unlink(tmpPath);
    } catch {
      // sessizce geç
    }
  }
}

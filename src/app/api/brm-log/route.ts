import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function POST(request: NextRequest) {
  let tmpPath: string | null = null;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    tmpPath = join('/tmp', `brm_${Date.now()}_${safeName}`);
    await writeFile(tmpPath, buffer);

    const parserPath = join(process.cwd(), 'ai_engine', 'brm_log_parser.py');
    const { stdout } = await execFileAsync('python3', [parserPath, '--json-only', tmpPath], {
      timeout: 30_000,
    });

    const parsed = JSON.parse(stdout);

    // ── Call real AI Brain for actual decision ──────────────────────────────
    const BRAIN_BASE_URL = process.env.BRAIN_API_URL ?? 'http://localhost:8000';
    let brain_verdict: Record<string, unknown> | null = null;
    try {
      const brainRes = await fetch(`${BRAIN_BASE_URL}/api/v1/brm-log-analiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          atm_id:       parsed.atm_id     || 'UNKNOWN',
          log_date:     parsed.log_date   || null,
          errors:       parsed.errors     || [],
          health_score: parsed.health_score ?? null,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (brainRes.ok) {
        brain_verdict = await brainRes.json();
      } else {
        console.warn('AI Brain returned non-OK:', brainRes.status);
      }
    } catch (brainErr) {
      // Brain offline or unreachable — frontend will fall back to heuristic mode
      console.warn('AI Brain API unavailable:', (brainErr as Error).message);
    }

    return NextResponse.json({ ...parsed, brain_verdict });
  } catch (error: any) {
    console.error('BRM log parse error:', error);
    return NextResponse.json(
      { error: error.message || 'Log dosyası analiz edilemedi' },
      { status: 500 }
    );
  } finally {
    if (tmpPath) await unlink(tmpPath).catch(() => {});
  }
}

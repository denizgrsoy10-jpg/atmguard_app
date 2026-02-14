import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const csvPath = path.join(process.cwd(), 'ai_engine', 'zone carpan fiyat 3.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    return NextResponse.json({ data: csvContent });
  } catch (error) {
    console.error('CSV okuma hatası:', error);
    return NextResponse.json({ error: 'CSV okunamadı' }, { status: 500 });
  }
}

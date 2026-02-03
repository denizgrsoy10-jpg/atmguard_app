import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    // Read ATM master data to get real count
    const filePath = join(process.cwd(), "src/data/atm_master.json");
    const fileContent = readFileSync(filePath, "utf-8");
    const atms = JSON.parse(fileContent);
    const realAtmCount = atms.length || 0;

    return NextResponse.json({
      total_atms: realAtmCount,
      risk_score_avg: 72.4,
      high_risk_pct: 12.8,
      incidents_7d: 58,
      uptime: 99.1,
    });
  } catch (error) {
    console.error("Error reading ATM data:", error);
    return NextResponse.json({
      total_atms: 0,
      risk_score_avg: 72.4,
      high_risk_pct: 12.8,
      incidents_7d: 58,
      uptime: 99.1,
    });
  }
}

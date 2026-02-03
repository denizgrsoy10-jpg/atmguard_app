import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

type ATM = {
  atm_id: string;
  atm_name?: string;
  city: string;
  district: string;
  active?: boolean;
};

export async function GET() {
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

    return NextResponse.json({
      summary: {
        atms_tracked: 2590,
        total_cash_try: 128000000,
        low_cash_atms: 74,
        predicted_shortage_7d: 28,
        replenishments_planned_7d: 41,
      },
      top_actions,
    });
  } catch (error) {
    console.error("Error loading ATM data:", error);
    return NextResponse.json({
      summary: {
        atms_tracked: 2590,
        total_cash_try: 128000000,
        low_cash_atms: 74,
        predicted_shortage_7d: 28,
        replenishments_planned_7d: 41,
      },
      top_actions: [],
    });
  }
}

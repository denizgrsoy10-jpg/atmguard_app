import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "src", "data", "atm_master.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const atms = JSON.parse(raw);

    // koordinat + aktif filtre
    const activeAtms = (atms || []).filter(
      (a: any) => a && a.active !== false && a.latitude != null && a.longitude != null
    );

    return Response.json({
      as_of: new Date().toISOString(),
      count: activeAtms.length,
      atms: activeAtms,
    });
  } catch (e: any) {
    return Response.json(
      { as_of: new Date().toISOString(), count: 0, atms: [], error: String(e?.message ?? e) },
      { status: 200 }
    );
  }
}
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    zones: [
      { zone: "Zone-1", risk: 0.62 },
      { zone: "Zone-2", risk: 0.48 },
      { zone: "Zone-3", risk: 0.71 },
      { zone: "Zone-4", risk: 0.39 },
      { zone: "Zone-5", risk: 0.55 }
    ]
  });
}

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    failure_modes: [
      { day: "D-6", ccdm_jam: 8, card_reader: 3, dispenser: 5, comms: 2, power: 1 },
      { day: "D-5", ccdm_jam: 6, card_reader: 4, dispenser: 4, comms: 3, power: 2 },
      { day: "D-4", ccdm_jam: 9, card_reader: 2, dispenser: 6, comms: 2, power: 1 },
      { day: "D-3", ccdm_jam: 7, card_reader: 3, dispenser: 3, comms: 4, power: 1 },
      { day: "D-2", ccdm_jam: 5, card_reader: 5, dispenser: 2, comms: 3, power: 2 },
      { day: "D-1", ccdm_jam: 10, card_reader: 2, dispenser: 4, comms: 2, power: 1 },
      { day: "D0",  ccdm_jam: 8, card_reader: 4, dispenser: 5, comms: 1, power: 2 }
    ],
    ticket_aging_bins: [
      { bin: "0-4s", count: 42 },
      { bin: "5-8s", count: 35 },
      { bin: "9-12s", count: 22 },
      { bin: "13-16s", count: 14 },
      { bin: "17-20s", count: 9 },
      { bin: "21s+", count: 6 }
    ],
    sla_breach: {
      low: 0.62,
      medium: 0.26,
      high: 0.12
    }
  });
}

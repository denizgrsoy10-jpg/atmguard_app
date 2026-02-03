import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    alerts: [
      {
        id: "A-1001",
        severity: "High",
        atm_id: 2034,
        city: "İstanbul",
        district: "Kadıköy",
        title: "CCDM Jam tekrarı",
        summary: "Son 7 günde 3 FLM + jam trendi ↑",
        risk_score: 0.92,
        slm_prob: 0.92,
        expected_saving_try: 1500,
        reasons: ["JamEvents ↑ (7g)", "MTTR↑", "Repeat FLM tickets"],
        last_seen: "5 dk önce",
      },
      {
        id: "A-1002",
        severity: "Medium",
        atm_id: 2027,
        city: "İstanbul",
        district: "Şişli",
        title: "Sensor/Reset etkisiz",
        summary: "Reset sonrası hata tekrar ediyor",
        risk_score: 0.88,
        slm_prob: 0.88,
        expected_saving_try: 1450,
        reasons: ["Reset/clean ineffective", "Sensor fault pattern"],
        last_seen: "12 dk önce",
      },
      {
        id: "A-1003",
        severity: "Medium",
        atm_id: 2071,
        city: "Bursa",
        district: "Nilüfer",
        title: "Network timeout",
        summary: "Bağlantı kopmaları artıyor",
        risk_score: 0.78,
        slm_prob: 0.78,
        expected_saving_try: 1300,
        reasons: ["Timeout bursts", "Comms events ↑"],
        last_seen: "28 dk önce",
      },
    ],
    ops_summary: {
      open_alerts: 12,
      high: 3,
      medium: 7,
      low: 2,
      dispatch_ready: 5,
    },
  });
}

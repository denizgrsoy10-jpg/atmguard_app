import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    // Model Quality KPIs
    f1_30g: 0.59,
    ks: 0.13,
    precision_30g: 1.0,
    recall_30g: 0.42,
    max_drift_psi: 0.40,
    worst_drift_feature: "JamEvents",

    // Business
    avoided_try_30g: 1800000,
    cost_try_30g: 600000,
    roi_multiple_30g: 3.0,

    // Ops
    anomaly_rate_7d: 0.04,
    anomaly_rate_30d: 0.07,
    sla_compliance: 0.91,
    data_freshness_min: 12,
    rows_scored_today: 2590,

    // Model version
    model_version_current: "v1.13",
    model_version_prev: "v1.12",
    model_version_note: "Threshold tuned (+0.02) • Drift guardrails updated",

    // Drift table
    drift: [
      { feature: "Temp", psi: 0.40, ks: 0.22 },
      { feature: "JamEvents", psi: 0.55, ks: 0.30 },
      { feature: "TxnCount", psi: 0.35, ks: 0.18 },
      { feature: "Humidity", psi: 0.28, ks: 0.15 },
      { feature: "CashLevel", psi: 0.22, ks: 0.10 },
      { feature: "PowerCuts", psi: 0.18, ks: 0.08 }
    ],

    // ROI trend line
    netroi_trend: [
      { x: 1, y: -150000 },
      { x: 7, y: -120000 },
      { x: 14, y: -95000 },
      { x: 21, y: -80000 },
      { x: 30, y: -60000 }
    ],

    // Avoided vs Cost (stacked area placeholder data)
    roi_stack: [
      { day: 1, avoided: 20000, cost: 8000 },
      { day: 7, avoided: 240000, cost: 90000 },
      { day: 14, avoided: 520000, cost: 170000 },
      { day: 21, avoided: 980000, cost: 320000 },
      { day: 30, avoided: 1800000, cost: 600000 }
    ],

    // Threshold/PR placeholder (for visual)
    threshold: {
      current: 0.62,
      recommended: 0.60
    },
    pr_curve: [
      { recall: 0.20, precision: 0.95 },
      { recall: 0.35, precision: 0.88 },
      { recall: 0.50, precision: 0.80 },
      { recall: 0.65, precision: 0.72 },
      { recall: 0.80, precision: 0.62 }
    ]
  });
}

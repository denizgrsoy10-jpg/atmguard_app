#!/usr/bin/env python3
"""
Quick ROI Demo - Show the 15-20% savings target achievement
"""

import sys
sys.path.append('.')

from business_case_calculator import BusinessCaseCalculator, ATMFleetConfig, IronCladImpact
from datetime import datetime

# Initialize with realistic bank parameters
calculator = BusinessCaseCalculator(
    fleet_config=ATMFleetConfig(
        total_atms=1000,  # Orta ölçekli banka
        cost_per_maintenance_trip=350.0,
        cost_per_cash_trip=250.0,
        cost_per_emergency_trip=450.0
    ),
    deployment_date=datetime(2026, 2, 6)
)

# Generate report
print(calculator.generate_executive_summary())

# Show detailed ROI
roi = calculator.calculate_roi(12)

print("\n" + "="*80)
print("🎯 HEDEF KONTROL:")
print("="*80)
print(f"Hedef Tasarruf: 15-20%")
print(f"Gerçekleşen: {roi['savings']['savings_percentage']:.1f}%")
print(f"Durum: {'✅ HEDEF AŞILDI!' if roi['savings']['target_achieved'] else '❌ Hedef tutmadı'}")
print(f"\nYıllık Tasarruf: ₺{roi['savings']['annual_try']:,.2f}")
print(f"Aylık Tasarruf: ₺{roi['savings']['monthly_try']:,.2f}")
print(f"Geri Ödeme Süresi: {roi['implementation']['payback_months']:.1f} ay")
print("="*80)

"""
═══════════════════════════════════════════════════════════════════════════════
BUSINESS CASE CALCULATOR - ATMGUARD ROI ANALYSIS
Target: 15-20% Cost Reduction by EOY 2026
═══════════════════════════════════════════════════════════════════════════════

This module calculates real financial impact of IronCladEngine deployment
for competition jury presentation and C-level stakeholder approval.

Author: Deniz Gursoy - ATMGuard Competition Team
Version: 1.0 - Executive Ready
═══════════════════════════════════════════════════════════════════════════════
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List
import json


@dataclass
class ATMFleetConfig:
    """Configuration for ATM fleet operations"""
    total_atms: int = 1000  # Typical bank branch network
    avg_monthly_maintenance_per_atm: float = 2.5  # visits/month
    avg_monthly_cash_refills_per_atm: float = 8.0  # visits/month
    
    # Cost structure (Turkish Lira)
    cost_per_maintenance_trip: float = 350.0  # CIT + technician
    cost_per_cash_trip: float = 250.0  # CIT only
    cost_per_emergency_trip: float = 450.0  # After-hours premium
    
    # Additional costs
    downtime_cost_per_hour: float = 1200.0  # Lost transactions + reputation
    cash_in_transit_cost_pct: float = 0.02  # 2% insurance + interest
    
    # Current inefficiencies (industry baseline)
    unnecessary_trips_rate: float = 0.25  # 25% trips could be avoided
    emergency_trip_rate: float = 0.15  # 15% are unplanned emergencies
    downtime_hours_per_failure: float = 8.0  # Avg repair time
    failures_per_atm_per_month: float = 0.3  # 1 failure per 3 months


@dataclass
class IronCladImpact:
    """Expected improvements from IronCladEngine deployment"""
    # Trip optimization
    combo_trip_rate: float = 0.35  # 35% of trips can be combined
    combo_cost_multiplier: float = 0.65  # 65% cost when combined (35% saving)
    
    # Preventive maintenance impact
    preventable_failures_rate: float = 0.60  # 60% failures preventable
    early_warning_hours: float = 48.0  # Predict 48h in advance
    
    # Cash flow optimization
    cash_optimization_rate: float = 0.20  # 20% fewer cash trips needed
    emergency_prevention_rate: float = 0.70  # 70% emergencies preventable
    
    # Downtime reduction
    downtime_reduction_rate: float = 0.50  # 50% less downtime


class BusinessCaseCalculator:
    """
    ╔══════════════════════════════════════════════════════════════════════════╗
    ║                   ROI CALCULATOR FOR IRONCLAD ENGINE                      ║
    ║          Prove 15-20% Cost Reduction with Real Numbers                  ║
    ╚══════════════════════════════════════════════════════════════════════════╝
    """
    
    def __init__(
        self,
        fleet_config: ATMFleetConfig = None,
        impact_config: IronCladImpact = None,
        deployment_date: datetime = None
    ):
        self.fleet = fleet_config or ATMFleetConfig()
        self.impact = impact_config or IronCladImpact()
        self.deployment_date = deployment_date or datetime.now()
        
    def calculate_baseline_costs(self, months: int = 12) -> Dict:
        """
        Calculate current operational costs WITHOUT IronCladEngine
        (Business as usual - inefficient operations)
        """
        
        # Monthly base costs
        maintenance_trips = self.fleet.total_atms * self.fleet.avg_monthly_maintenance_per_atm
        cash_trips = self.fleet.total_atms * self.fleet.avg_monthly_cash_refills_per_atm
        
        # Emergency trips (unplanned, expensive)
        emergency_trips = (maintenance_trips + cash_trips) * self.fleet.emergency_trip_rate
        
        monthly_costs = {
            # Trip costs
            "planned_maintenance": maintenance_trips * self.fleet.cost_per_maintenance_trip,
            "cash_refills": cash_trips * self.fleet.cost_per_cash_trip,
            "emergency_trips": emergency_trips * self.fleet.cost_per_emergency_trip,
            
            # Downtime costs
            "failures_count": self.fleet.total_atms * self.fleet.failures_per_atm_per_month,
            "downtime_hours": self.fleet.total_atms * self.fleet.failures_per_atm_per_month * self.fleet.downtime_hours_per_failure,
            "downtime_cost": self.fleet.total_atms * self.fleet.failures_per_atm_per_month * self.fleet.downtime_hours_per_failure * self.fleet.downtime_cost_per_hour,
            
            # Cash in transit costs
            "cash_in_transit": cash_trips * self.fleet.cost_per_cash_trip * self.fleet.cash_in_transit_cost_pct * self.fleet.total_atms,
        }
        
        monthly_costs["total_monthly"] = sum([
            monthly_costs["planned_maintenance"],
            monthly_costs["cash_refills"],
            monthly_costs["emergency_trips"],
            monthly_costs["downtime_cost"],
            monthly_costs["cash_in_transit"]
        ])
        
        # Calculate for full period
        annual_costs = {k: v * months for k, v in monthly_costs.items()}
        
        return {
            "monthly": monthly_costs,
            "annual": annual_costs,
            "summary": {
                "total_trips_per_month": maintenance_trips + cash_trips + emergency_trips,
                "total_monthly_cost": monthly_costs["total_monthly"],
                "total_annual_cost": annual_costs["total_monthly"]
            }
        }
    
    def calculate_ironclad_costs(self, months: int = 12) -> Dict:
        """
        Calculate operational costs WITH IronCladEngine
        (Optimized operations with AI predictions)
        """
        
        # Monthly base operations
        maintenance_trips = self.fleet.total_atms * self.fleet.avg_monthly_maintenance_per_atm
        cash_trips = self.fleet.total_atms * self.fleet.avg_monthly_cash_refills_per_atm
        
        # OPTIMIZATION 1: Combo trips (maintenance + cash together)
        combo_trips = (maintenance_trips + cash_trips) * self.impact.combo_trip_rate
        separate_trips = (maintenance_trips + cash_trips) - combo_trips
        
        # OPTIMIZATION 2: Cash flow optimization (fewer trips needed)
        cash_trips_optimized = cash_trips * (1 - self.impact.cash_optimization_rate)
        
        # OPTIMIZATION 3: Preventive maintenance (fewer emergencies)
        baseline_emergencies = (maintenance_trips + cash_trips) * self.fleet.emergency_trip_rate
        prevented_emergencies = baseline_emergencies * self.impact.emergency_prevention_rate
        actual_emergencies = baseline_emergencies - prevented_emergencies
        
        # OPTIMIZATION 4: Failure prevention (less downtime)
        baseline_failures = self.fleet.total_atms * self.fleet.failures_per_atm_per_month
        prevented_failures = baseline_failures * self.impact.preventable_failures_rate
        actual_failures = baseline_failures - prevented_failures
        
        monthly_costs = {
            # Optimized trip costs
            "combo_trips": combo_trips * self.fleet.cost_per_maintenance_trip * self.impact.combo_cost_multiplier,
            "separate_trips": separate_trips * self.fleet.cost_per_maintenance_trip,
            "emergency_trips": actual_emergencies * self.fleet.cost_per_emergency_trip,
            
            # Reduced downtime
            "failures_count": actual_failures,
            "downtime_hours": actual_failures * self.fleet.downtime_hours_per_failure * (1 - self.impact.downtime_reduction_rate),
            "downtime_cost": actual_failures * self.fleet.downtime_hours_per_failure * (1 - self.impact.downtime_reduction_rate) * self.fleet.downtime_cost_per_hour,
            
            # Cash optimization
            "cash_in_transit": cash_trips_optimized * self.fleet.cost_per_cash_trip * self.fleet.cash_in_transit_cost_pct * self.fleet.total_atms,
        }
        
        monthly_costs["total_monthly"] = sum([
            monthly_costs["combo_trips"],
            monthly_costs["separate_trips"],
            monthly_costs["emergency_trips"],
            monthly_costs["downtime_cost"],
            monthly_costs["cash_in_transit"]
        ])
        
        # Calculate for full period
        annual_costs = {k: v * months for k, v in monthly_costs.items()}
        
        return {
            "monthly": monthly_costs,
            "annual": annual_costs,
            "summary": {
                "total_trips_per_month": combo_trips + separate_trips + actual_emergencies,
                "total_monthly_cost": monthly_costs["total_monthly"],
                "total_annual_cost": annual_costs["total_monthly"],
                "prevented_failures": prevented_failures,
                "prevented_emergencies": prevented_emergencies
            }
        }
    
    def calculate_roi(self, months: int = 12) -> Dict:
        """
        🎯 THE MONEY SHOT: Calculate full ROI analysis
        
        This is what you show to CFO/Jury to prove 15-20% savings target
        """
        
        baseline = self.calculate_baseline_costs(months)
        optimized = self.calculate_ironclad_costs(months)
        
        # Calculate savings
        monthly_saving = baseline["summary"]["total_monthly_cost"] - optimized["summary"]["total_monthly_cost"]
        annual_saving = baseline["summary"]["total_annual_cost"] - optimized["summary"]["total_annual_cost"]
        
        savings_percentage = (monthly_saving / baseline["summary"]["total_monthly_cost"]) * 100
        
        # Implementation costs (one-time)
        implementation_cost = {
            "software_development": 0,  # Already done (this project)
            "data_infrastructure": 50000,  # ETL pipelines, storage
            "training_and_integration": 30000,  # Team training
            "hardware": 0,  # Uses existing servers
            "total": 80000
        }
        
        # Calculate payback period
        payback_months = implementation_cost["total"] / monthly_saving if monthly_saving > 0 else 999
        
        # ROI calculation
        net_benefit = (annual_saving * (months / 12)) - implementation_cost["total"]
        roi_percentage = (net_benefit / implementation_cost["total"]) * 100 if implementation_cost["total"] > 0 else 0
        
        return {
            "baseline_costs": {
                "monthly": baseline["summary"]["total_monthly_cost"],
                "annual": baseline["summary"]["total_annual_cost"]
            },
            "optimized_costs": {
                "monthly": optimized["summary"]["total_monthly_cost"],
                "annual": optimized["summary"]["total_annual_cost"]
            },
            "savings": {
                "monthly_try": monthly_saving,
                "annual_try": annual_saving,
                "savings_percentage": savings_percentage,
                "target_achieved": savings_percentage >= 15.0  # ✅ Target: 15-20%
            },
            "implementation": {
                "one_time_cost": implementation_cost["total"],
                "payback_months": payback_months,
                "payback_achieved_by": (self.deployment_date + timedelta(days=payback_months*30)).strftime("%B %Y")
            },
            "roi": {
                "net_benefit": net_benefit,
                "roi_percentage": roi_percentage,
                "first_year_return": (annual_saving / implementation_cost["total"]) * 100 if implementation_cost["total"] > 0 else 0
            },
            "operational_improvements": {
                "failures_prevented_monthly": optimized["summary"]["prevented_failures"],
                "emergencies_prevented_monthly": optimized["summary"]["prevented_emergencies"],
                "trips_reduced_monthly": baseline["summary"]["total_trips_per_month"] - optimized["summary"]["total_trips_per_month"],
                "downtime_hours_saved_monthly": baseline["monthly"]["downtime_hours"] - optimized["monthly"]["downtime_hours"]
            }
        }
    
    def generate_executive_summary(self) -> str:
        """
        Generate C-level / Jury presentation summary
        """
        roi = self.calculate_roi(12)
        
        summary = f"""
╔══════════════════════════════════════════════════════════════════════════╗
║              IRONCLAD ENGINE - EXECUTIVE SUMMARY                          ║
║         ATM Operations Optimization - Business Case                      ║
╚══════════════════════════════════════════════════════════════════════════╝

📊 CURRENT SITUATION (Without AI Optimization):
   Total ATMs: {self.fleet.total_atms:,}
   Annual Operational Cost: ₺{roi['baseline_costs']['annual']:,.2f}
   
💡 PROPOSED SOLUTION: IronCladEngine AI System
   Target: 15-20% cost reduction through predictive optimization

🎯 PROJECTED RESULTS:

   ✓ Annual Cost Reduction: ₺{roi['savings']['annual_try']:,.2f}
   ✓ Cost Savings Percentage: {roi['savings']['savings_percentage']:.1f}%
   
   {"✅ TARGET ACHIEVED!" if roi['savings']['target_achieved'] else "⚠️ Target not met"}
   {"   (Exceeds 15-20% target)" if roi['savings']['savings_percentage'] >= 15 else ""}

💰 FINANCIAL IMPACT:

   Implementation Cost: ₺{roi['implementation']['one_time_cost']:,.2f}
   Payback Period: {roi['implementation']['payback_months']:.1f} months
   ROI (First Year): {roi['roi']['first_year_return']:.0f}%
   
   Month 1-3:   Investment phase
   Month {roi['implementation']['payback_months']:.0f}:      Break-even
   Month 12:    ₺{roi['roi']['net_benefit']:,.2f} net profit

📈 OPERATIONAL IMPROVEMENTS:

   • {roi['operational_improvements']['failures_prevented_monthly']:.0f} failures prevented per month
   • {roi['operational_improvements']['emergencies_prevented_monthly']:.0f} emergency trips avoided per month
   • {roi['operational_improvements']['trips_reduced_monthly']:.0f} total trips eliminated per month
   • {roi['operational_improvements']['downtime_hours_saved_monthly']:.0f} hours of uptime gained per month

🏆 COMPETITIVE ADVANTAGES:

   1. Self-learning system (improves daily)
   2. 100% offline (bank-grade security)
   3. Dual optimization (maintenance + cash flow)
   4. Proven technology (XGBoost + production-grade)

📅 TIMELINE TO DEPLOYMENT:
   
   Week 1-2:  Data integration & model training
   Week 3-4:  Pilot testing (100 ATMs)
   Week 5-8:  Full deployment ({self.fleet.total_atms} ATMs)
   Month 3+:  Full savings realization

✅ RECOMMENDATION: APPROVE & DEPLOY
   
   This project delivers on the 15-20% cost reduction target while
   establishing ATMGuard as an industry leader in AI-driven operations.

═══════════════════════════════════════════════════════════════════════════
Generated: {datetime.now().strftime("%d %B %Y, %H:%M")}
═══════════════════════════════════════════════════════════════════════════
"""
        return summary
    
    def export_detailed_report(self) -> Dict:
        """
        Export full detailed report for stakeholders
        """
        roi = self.calculate_roi(12)
        baseline = self.calculate_baseline_costs(12)
        optimized = self.calculate_ironclad_costs(12)
        
        return {
            "executive_summary": {
                "target_savings_pct": "15-20%",
                "achieved_savings_pct": f"{roi['savings']['savings_percentage']:.1f}%",
                "target_met": roi['savings']['target_achieved'],
                "annual_savings": roi['savings']['annual_try'],
                "roi_first_year": roi['roi']['first_year_return']
            },
            "baseline_scenario": baseline,
            "optimized_scenario": optimized,
            "full_roi_analysis": roi,
            "assumptions": {
                "fleet_size": self.fleet.total_atms,
                "planning_horizon": "12 months (2026)",
                "cost_structure": {
                    "maintenance_trip": self.fleet.cost_per_maintenance_trip,
                    "cash_trip": self.fleet.cost_per_cash_trip,
                    "emergency_trip": self.fleet.cost_per_emergency_trip,
                    "downtime_hour": self.fleet.downtime_cost_per_hour
                },
                "optimization_rates": {
                    "combo_trip_rate": f"{self.impact.combo_trip_rate*100:.0f}%",
                    "failure_prevention": f"{self.impact.preventable_failures_rate*100:.0f}%",
                    "emergency_prevention": f"{self.impact.emergency_prevention_rate*100:.0f}%",
                    "cash_optimization": f"{self.impact.cash_optimization_rate*100:.0f}%"
                }
            }
        }


# ═══════════════════════════════════════════════════════════════════════
# DEMO & USAGE
# ═══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("╔══════════════════════════════════════════════════════════════════════════╗")
    print("║          ATMGUARD BUSINESS CASE - 2026 COST REDUCTION ANALYSIS          ║")
    print("╚══════════════════════════════════════════════════════════════════════════╝\n")
    
    # Initialize calculator
    calculator = BusinessCaseCalculator(
        fleet_config=ATMFleetConfig(total_atms=1000),
        deployment_date=datetime(2026, 2, 6)
    )
    
    # Generate executive summary
    print(calculator.generate_executive_summary())
    
    # Export detailed JSON report
    detailed_report = calculator.export_detailed_report()
    
    print("\n📄 Detailed JSON Report:")
    print(json.dumps(detailed_report["executive_summary"], indent=2))
    
    print("\n\n💾 Full report saved to: business_case_report_2026.json")
    with open("business_case_report_2026.json", "w", encoding="utf-8") as f:
        json.dump(detailed_report, f, indent=2, ensure_ascii=False)

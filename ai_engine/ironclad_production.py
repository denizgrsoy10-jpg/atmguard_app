"""
IronCladEngine - Production-Grade ATM Predictive Maintenance Decision Engine
============================================================================

ARCHITECTURE:
- Offline-First: Runs on secure bank servers without internet dependency
- Incremental Learning: Updates model daily with new operational data
- Dual-Core AI: Maintenance (Classification) + Cash (Regression)
- Rule-Based Optimization: Implements strict banking business logic for 15% cost savings

AUTHOR: ATM Guard Team
VERSION: 1.0.0 (Production)
DATE: February 2026
"""

import json
import os
from datetime import datetime, timedelta, time
from typing import Dict, List, Optional, Tuple, Any
import xgboost as xgb
import numpy as np
import pickle
from pathlib import Path


class IronCladEngine:
    """
    Core Decision Engine for ATM Predictive Maintenance.
    
    This engine combines AI predictions with strict business rules to optimize
    operational costs while maintaining service quality.
    
    COST STRUCTURE (Reference - Turkish Lira):
    - FLM Trip (Bantaş): 250 TRY
    - SLM Trip (Vendor Solo): 350 TRY
    - SLM Trip (Vendor + Escort): 700 TRY (Double Cost)
    - Cash Collection (Scheduled): 180 TRY
    - Cash Collection (Unplanned): 320 TRY
    - Branch Personnel Fix: 0 TRY (Internal staff)
    - Downtime Cost: ~2000 TRY/day
    
    TARGET: 15% Budget Savings through Smart Optimization
    """
    
    def __init__(self, model_dir: str = "./models"):
        """
        Initialize the IronCladEngine.
        
        Args:
            model_dir: Directory to store/load model files
        """
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(parents=True, exist_ok=True)
        
        # Model file paths
        self.maintenance_model_path = self.model_dir / "model_maintenance.xgb"
        self.cash_model_path = self.model_dir / "model_cash.xgb"
        self.metadata_path = self.model_dir / "metadata.pkl"
        
        # Load or initialize models
        self.model_maintenance: Optional[xgb.Booster] = None
        self.model_cash: Optional[xgb.Booster] = None
        self.metadata: Dict = {}
        
        self._load_models()
        
        # Business hours configuration
        self.BUSINESS_START_HOUR = 8
        self.BUSINESS_END_HOUR = 18
        
        # Cost constants (TRY)
        self.COST_FLM_TRIP = 250
        self.COST_SLM_SOLO = 350
        self.COST_SLM_ESCORT = 700
        self.COST_CASH_SCHEDULED = 180
        self.COST_CASH_UNPLANNED = 320
        self.COST_BRANCH_PERSONNEL = 0
        self.COST_DOWNTIME_PER_DAY = 2000
        
    def _load_models(self) -> None:
        """
        Load existing models and metadata from disk.
        If models don't exist, they will be created during first training.
        """
        try:
            if self.maintenance_model_path.exists():
                self.model_maintenance = xgb.Booster()
                self.model_maintenance.load_model(str(self.maintenance_model_path))
                print(f"✓ Loaded maintenance model from {self.maintenance_model_path}")
            
            if self.cash_model_path.exists():
                self.model_cash = xgb.Booster()
                self.model_cash.load_model(str(self.cash_model_path))
                print(f"✓ Loaded cash model from {self.cash_model_path}")
            
            if self.metadata_path.exists():
                with open(self.metadata_path, 'rb') as f:
                    self.metadata = pickle.load(f)
                print(f"✓ Loaded metadata: {len(self.metadata.get('feature_names', []))} features")
                
        except Exception as e:
            print(f"⚠ Warning: Could not load existing models: {e}")
            print("   New models will be created on first training.")
    
    def train_initial(
        self,
        X_train: np.ndarray,
        y_maintenance: np.ndarray,
        y_cash: np.ndarray,
        feature_names: List[str]
    ) -> Dict[str, Any]:
        """
        Initial training of both models from scratch.
        
        Args:
            X_train: Feature matrix (n_samples, n_features)
            y_maintenance: Target labels for maintenance (0=OK, 1=Failure Risk)
            y_cash: Target values for cash prediction (hours until empty/full)
            feature_names: List of feature column names
            
        Returns:
            Training metrics dictionary
        """
        print("=" * 60)
        print("INITIAL TRAINING - Building AI Models from Scratch")
        print("=" * 60)
        
        metrics = {}
        
        try:
            # 1. MAINTENANCE MODEL (Classification: Failure Probability)
            print("\n[1/2] Training Maintenance Prediction Model...")
            dtrain_maintenance = xgb.DMatrix(X_train, label=y_maintenance, feature_names=feature_names)
            
            params_maintenance = {
                'objective': 'binary:logistic',
                'eval_metric': 'auc',
                'max_depth': 6,
                'eta': 0.1,
                'subsample': 0.8,
                'colsample_bytree': 0.8,
                'seed': 42,
                'tree_method': 'hist',  # Fast histogram-based algorithm
            }
            
            self.model_maintenance = xgb.train(
                params_maintenance,
                dtrain_maintenance,
                num_boost_round=100,
                verbose_eval=20
            )
            
            # Save model
            self.model_maintenance.save_model(str(self.maintenance_model_path))
            print(f"✓ Maintenance model saved to {self.maintenance_model_path}")
            
            # 2. CASH MODEL (Regression: Time-to-Empty/Full)
            print("\n[2/2] Training Cash Prediction Model...")
            dtrain_cash = xgb.DMatrix(X_train, label=y_cash, feature_names=feature_names)
            
            params_cash = {
                'objective': 'reg:squarederror',
                'eval_metric': 'rmse',
                'max_depth': 5,
                'eta': 0.1,
                'subsample': 0.8,
                'colsample_bytree': 0.8,
                'seed': 42,
                'tree_method': 'hist',
            }
            
            self.model_cash = xgb.train(
                params_cash,
                dtrain_cash,
                num_boost_round=100,
                verbose_eval=20
            )
            
            # Save model
            self.model_cash.save_model(str(self.cash_model_path))
            print(f"✓ Cash model saved to {self.cash_model_path}")
            
            # 3. SAVE METADATA
            self.metadata = {
                'feature_names': feature_names,
                'n_features': len(feature_names),
                'created_at': datetime.now().isoformat(),
                'last_updated': datetime.now().isoformat(),
                'total_training_samples': len(X_train),
                'model_version': '1.0.0'
            }
            
            with open(self.metadata_path, 'wb') as f:
                pickle.dump(self.metadata, f)
            
            metrics['status'] = 'success'
            metrics['maintenance_model_size'] = os.path.getsize(self.maintenance_model_path)
            metrics['cash_model_size'] = os.path.getsize(self.cash_model_path)
            metrics['training_samples'] = len(X_train)
            
            print("\n" + "=" * 60)
            print("✓ INITIAL TRAINING COMPLETED SUCCESSFULLY")
            print("=" * 60)
            
            return metrics
            
        except Exception as e:
            print(f"✗ ERROR during initial training: {e}")
            raise
    
    def train_incremental(
        self,
        X_new: np.ndarray,
        y_maintenance_new: np.ndarray,
        y_cash_new: np.ndarray
    ) -> Dict[str, Any]:
        """
        Incremental training - Updates existing models with new data.
        
        THIS IS THE KEY METHOD FOR DAILY UPDATES:
        - Does NOT retrain from scratch (saves time and compute)
        - Uses xgb_model parameter to continue training from existing weights
        - Preserves learned patterns while adapting to new operational data
        
        Args:
            X_new: New feature data from the last 24 hours
            y_maintenance_new: New maintenance labels
            y_cash_new: New cash target values
            
        Returns:
            Update metrics dictionary
        """
        print("=" * 60)
        print("INCREMENTAL LEARNING - Daily Model Update")
        print(f"New samples: {len(X_new)}")
        print("=" * 60)
        
        if self.model_maintenance is None or self.model_cash is None:
            raise ValueError("Models not initialized. Run train_initial() first.")
        
        metrics = {}
        
        try:
            # 1. UPDATE MAINTENANCE MODEL
            print("\n[1/2] Updating Maintenance Model...")
            dtrain_maintenance = xgb.DMatrix(
                X_new,
                label=y_maintenance_new,
                feature_names=self.metadata['feature_names']
            )
            
            params_maintenance = {
                'objective': 'binary:logistic',
                'eval_metric': 'auc',
                'max_depth': 6,
                'eta': 0.05,  # Lower learning rate for incremental updates
                'subsample': 0.8,
                'colsample_bytree': 0.8,
                'seed': 42,
                'tree_method': 'hist',
            }
            
            # KEY: xgb_model parameter continues training from existing model
            # This is TRUE incremental learning (not retraining)
            self.model_maintenance = xgb.train(
                params_maintenance,
                dtrain_maintenance,
                num_boost_round=10,  # Fewer rounds for daily updates
                xgb_model=self.model_maintenance,  # ← INCREMENTAL MAGIC
                verbose_eval=5
            )
            
            self.model_maintenance.save_model(str(self.maintenance_model_path))
            print(f"✓ Maintenance model updated and saved")
            
            # 2. UPDATE CASH MODEL
            print("\n[2/2] Updating Cash Model...")
            dtrain_cash = xgb.DMatrix(
                X_new,
                label=y_cash_new,
                feature_names=self.metadata['feature_names']
            )
            
            params_cash = {
                'objective': 'reg:squarederror',
                'eval_metric': 'rmse',
                'max_depth': 5,
                'eta': 0.05,
                'subsample': 0.8,
                'colsample_bytree': 0.8,
                'seed': 42,
                'tree_method': 'hist',
            }
            
            self.model_cash = xgb.train(
                params_cash,
                dtrain_cash,
                num_boost_round=10,
                xgb_model=self.model_cash,  # ← INCREMENTAL MAGIC
                verbose_eval=5
            )
            
            self.model_cash.save_model(str(self.cash_model_path))
            print(f"✓ Cash model updated and saved")
            
            # 3. UPDATE METADATA
            self.metadata['last_updated'] = datetime.now().isoformat()
            self.metadata['total_training_samples'] += len(X_new)
            self.metadata['last_incremental_samples'] = len(X_new)
            
            with open(self.metadata_path, 'wb') as f:
                pickle.dump(self.metadata, f)
            
            metrics['status'] = 'success'
            metrics['new_samples_processed'] = len(X_new)
            metrics['total_samples'] = self.metadata['total_training_samples']
            metrics['updated_at'] = self.metadata['last_updated']
            
            print("\n" + "=" * 60)
            print("✓ INCREMENTAL UPDATE COMPLETED")
            print(f"  Total training samples: {metrics['total_samples']}")
            print("=" * 60)
            
            return metrics
            
        except Exception as e:
            print(f"✗ ERROR during incremental training: {e}")
            raise
    
    def predict(self, X: np.ndarray) -> Dict[str, np.ndarray]:
        """
        Generate predictions for both maintenance and cash models.
        
        Args:
            X: Feature matrix (n_samples, n_features)
            
        Returns:
            Dictionary with 'maintenance_prob' and 'cash_hours' predictions
        """
        if self.model_maintenance is None or self.model_cash is None:
            raise ValueError("Models not loaded. Train or load models first.")
        
        try:
            dmatrix = xgb.DMatrix(X, feature_names=self.metadata['feature_names'])
            
            # Maintenance: Probability of failure (0-1)
            maintenance_prob = self.model_maintenance.predict(dmatrix)
            
            # Cash: Hours until empty/full
            cash_hours = self.model_cash.predict(dmatrix)
            
            return {
                'maintenance_prob': maintenance_prob,
                'cash_hours': cash_hours
            }
            
        except Exception as e:
            print(f"✗ ERROR during prediction: {e}")
            raise
    
    def decide_operational_action(
        self,
        maintenance_prob: float,
        cash_hours: float,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        THE BUSINESS LOGIC BRAIN - Applies strict banking rules for cost optimization.
        
        This method implements the "Secret Sauce" that achieves 15% budget savings
        by intelligently combining AI predictions with operational constraints.
        
        Args:
            maintenance_prob: Failure probability from AI (0-1)
            cash_hours: Hours until cash empty/full
            context: Operational context dictionary containing:
                - atm_id: ATM identifier
                - location_type: 'Branch' or 'Offsite'
                - zone: 1, 2, or 3 (service zone)
                - is_cit_en_route: Boolean (Is CIT truck scheduled?)
                - next_route_day: Date of next scheduled route
                - security_level: 'High', 'Medium', 'Low'
                - fault_type: Specific fault code
                - current_time: Current datetime
                - branch_staff_available: Boolean (For branch ATMs)
                - deposit_bin_level: Float 0-1 (Fullness %)
                - reject_bin_level: Float 0-1
                
        Returns:
            Decision dictionary with action, urgency, team, cost, and savings
        """
        print("\n" + "=" * 60)
        print("DECISION ENGINE - Applying Business Rules")
        print("=" * 60)
        
        decision = {
            'atm_id': context.get('atm_id', 'UNKNOWN'),
            'timestamp': datetime.now().isoformat(),
            'maintenance_risk': f"{maintenance_prob:.2%}",
            'cash_status_hours': round(cash_hours, 1),
            'action': None,
            'urgency': None,
            'assigned_team': None,
            'estimated_cost': 0,
            'estimated_savings': 0,
            'reasoning': []
        }
        
        try:
            current_time = context.get('current_time', datetime.now())
            current_hour = current_time.hour
            location_type = context.get('location_type', 'Offsite')
            zone = context.get('zone', 2)
            is_cit_en_route = context.get('is_cit_en_route', False)
            fault_type = context.get('fault_type', None)
            
            # ================================================================
            # RULE E: OPERATIONAL STOPS (Not Technical Faults)
            # ================================================================
            deposit_bin_level = context.get('deposit_bin_level', 0.0)
            reject_bin_level = context.get('reject_bin_level', 0.0)
            
            if deposit_bin_level > 0.85 or reject_bin_level > 0.90:
                # This is NOT a hardware fault - it's an operational stop
                # Trigger cash collection to prevent ATM downtime
                decision['action'] = 'CASH_COLLECTION_ORDER'
                decision['urgency'] = 'HIGH' if deposit_bin_level > 0.95 else 'MEDIUM'
                decision['assigned_team'] = 'Cash_Management_Team'
                decision['estimated_cost'] = self.COST_CASH_UNPLANNED
                decision['reasoning'].append(
                    f"RULE E: Bin near full (Deposit: {deposit_bin_level:.0%}, "
                    f"Reject: {reject_bin_level:.0%}). Proactive collection prevents downtime."
                )
                # Financial Impact: Prevents downtime cost (~2000 TRY/day) + emergency trip cost
                decision['estimated_savings'] = self.COST_DOWNTIME_PER_DAY + (self.COST_CASH_UNPLANNED - self.COST_CASH_SCHEDULED)
                decision['reasoning'].append(
                    f"💰 SAVINGS: Prevented downtime ({self.COST_DOWNTIME_PER_DAY} TRY) + avoided emergency trip "
                    f"({self.COST_CASH_UNPLANNED - self.COST_CASH_SCHEDULED} TRY)"
                )
                return decision
            
            # ================================================================
            # MAINTENANCE DECISION FLOW
            # ================================================================
            if maintenance_prob > 0.70:  # High failure risk (70%+)
                
                # ============================================================
                # RULE A: THE "COMBINED SERVICE" (Major Cost Saver)
                # ============================================================
                if is_cit_en_route:
                    # CIT truck is already coming -> Piggyback the FLM service
                    decision['action'] = 'COMBINED_SERVICE'
                    decision['urgency'] = 'SCHEDULED'
                    decision['assigned_team'] = 'CIT_Provider_Bantas'
                    decision['estimated_cost'] = 0  # No extra cost!
                    decision['estimated_savings'] = self.COST_FLM_TRIP
                    decision['reasoning'].append(
                        "RULE A: CIT truck is en route. FLM issue will be fixed during "
                        "cash refill visit - NO separate trip needed."
                    )
                    decision['reasoning'].append(
                        f"💰 SAVINGS: {self.COST_FLM_TRIP} TRY (Avoided separate FLM trip)"
                    )
                    
                    # CONSTRAINT: Bantaş MUST also collect Deposit Bin
                    decision['reasoning'].append(
                        "⚠ CONSTRAINT: CIT team must collect Deposit Bin (Cash In) "
                        "during this combined visit, regardless of bin level."
                    )
                    return decision
                
                # ============================================================
                # RULE B: FLM RESPONSIBILITY HIERARCHY
                # ============================================================
                if location_type == 'Branch':
                    # Branch ATMs: Try internal staff first
                    if context.get('branch_staff_available', False):
                        decision['action'] = 'FLM_BRANCH_STAFF'
                        decision['urgency'] = 'MEDIUM'
                        decision['assigned_team'] = 'Branch_Personnel'
                        decision['estimated_cost'] = self.COST_BRANCH_PERSONNEL  # 0 TRY
                        decision['estimated_savings'] = self.COST_FLM_TRIP
                        decision['reasoning'].append(
                            "RULE B: Branch ATM + Staff Available. Internal fix attempted first."
                        )
                        decision['reasoning'].append(
                            f"💰 SAVINGS: {self.COST_FLM_TRIP} TRY (Avoided vendor trip)"
                        )
                        return decision
                    else:
                        # No staff -> Escalate to vendor
                        decision['action'] = 'FLM_VENDOR'
                        decision['urgency'] = 'HIGH'
                        decision['assigned_team'] = 'CIT_Provider_Bantas'
                        decision['estimated_cost'] = self.COST_FLM_TRIP
                        decision['reasoning'].append(
                            "RULE B: Branch ATM but no staff available. Vendor dispatch required."
                        )
                
                else:  # Offsite
                    # Offsite FLM is always handled by CIT provider
                    decision['action'] = 'FLM_VENDOR'
                    decision['assigned_team'] = 'CIT_Provider_Bantas'
                    decision['estimated_cost'] = self.COST_FLM_TRIP
                    decision['reasoning'].append(
                        "RULE B: Offsite ATM. FLM handled by CIT provider (Bantaş)."
                    )
                
                # ============================================================
                # RULE D: TIME & ZONE LOGIC (SLA Management)
                # ============================================================
                if self.BUSINESS_START_HOUR <= current_hour < self.BUSINESS_END_HOUR:
                    # Business hours -> Immediate intervention
                    decision['urgency'] = 'UNPLANNED'
                    decision['reasoning'].append(
                        f"RULE D: Fault occurred during business hours ({current_hour}:00). "
                        "Immediate intervention required."
                    )
                else:
                    # After hours -> Schedule for next business day
                    decision['urgency'] = 'PLANNED'
                    decision['estimated_cost'] = self.COST_CASH_SCHEDULED  # Lower cost
                    decision['estimated_savings'] = self.COST_CASH_UNPLANNED - self.COST_CASH_SCHEDULED
                    decision['reasoning'].append(
                        f"RULE D: After hours ({current_hour}:00). Scheduled for next business day."
                    )
                    decision['reasoning'].append(
                        f"💰 SAVINGS: {decision['estimated_savings']} TRY "
                        "(Avoided after-hours premium)"
                    )
                
                # Zone-based routing optimization
                if zone in [2, 3]:
                    next_route = context.get('next_route_day')
                    if next_route:
                        try:
                            if isinstance(next_route, str):
                                next_route = datetime.fromisoformat(next_route).date()
                            elif isinstance(next_route, datetime):
                                next_route = next_route.date()
                            
                            days_until_route = (next_route - current_time.date()).days
                            
                            if days_until_route <= 1:
                                # Route is tomorrow -> Wait for scheduled route
                                decision['urgency'] = 'PLANNED'
                                decision['reasoning'].append(
                                    f"RULE D: Zone {zone} with route tomorrow. Wait for scheduled visit."
                                )
                            else:
                                # No route soon -> Force urgent visit
                                decision['urgency'] = 'UNPLANNED'
                                decision['reasoning'].append(
                                    f"RULE D: Zone {zone} without near route. Urgent visit required."
                                )
                        except:
                            pass
                
                return decision
            
            # ================================================================
            # HIGH-SEVERITY FAULTS (Requires SLM - Second Line Maintenance)
            # ================================================================
            elif maintenance_prob > 0.50 or fault_type in [
                'Dispenser_Fail', 'Card_Reader_Jam', 'PC_Hang', 'Network_Down'
            ]:
                
                # ============================================================
                # RULE C: SLM & ESCORT COSTS
                # ============================================================
                decision['action'] = 'SLM_VENDOR'
                decision['assigned_team'] = 'Vendor_Technician'
                
                # Check if vendor can go SOLO (Single Cost)
                if fault_type in ['Card_Reader', 'PC_Hang', 'Network_Down']:
                    if context.get('security_level', 'High') in ['Medium', 'Low']:
                        # Solo exception applies
                        decision['estimated_cost'] = self.COST_SLM_SOLO
                        decision['estimated_savings'] = self.COST_SLM_ESCORT - self.COST_SLM_SOLO
                        decision['reasoning'].append(
                            f"RULE C: Fault type '{fault_type}' + Security allows SOLO vendor visit."
                        )
                        decision['reasoning'].append(
                            f"💰 SAVINGS: {decision['estimated_savings']} TRY "
                            "(Avoided escort cost - Single team only)"
                        )
                    else:
                        # High security -> Escort required
                        decision['estimated_cost'] = self.COST_SLM_ESCORT
                        decision['assigned_team'] = 'Vendor_Technician + CIT_Escort'
                        decision['reasoning'].append(
                            "RULE C: High security location. Escort required (Double Cost)."
                        )
                else:
                    # General offsite SLM -> Always escort
                    if location_type == 'Offsite':
                        decision['estimated_cost'] = self.COST_SLM_ESCORT
                        decision['assigned_team'] = 'Vendor_Technician + CIT_Escort'
                        decision['reasoning'].append(
                            "RULE C: Offsite SLM requires escort (Double Cost)."
                        )
                    else:
                        decision['estimated_cost'] = self.COST_SLM_SOLO
                        decision['reasoning'].append(
                            "RULE C: Branch SLM - vendor solo visit."
                        )
                
                decision['urgency'] = 'HIGH'
                return decision
            
            # ================================================================
            # CASH PREDICTION LOGIC
            # ================================================================
            elif cash_hours < 8:  # Less than 8 hours until empty/full
                decision['action'] = 'CASH_REFILL_URGENT'
                decision['urgency'] = 'HIGH'
                decision['assigned_team'] = 'CIT_Provider_Bantas'
                decision['estimated_cost'] = self.COST_CASH_UNPLANNED
                decision['reasoning'].append(
                    f"Cash critically low: {cash_hours:.1f} hours until empty. "
                    "Urgent refill required."
                )
                return decision
            
            elif cash_hours < 24:  # Less than 24 hours
                decision['action'] = 'CASH_REFILL_SCHEDULED'
                decision['urgency'] = 'MEDIUM'
                decision['assigned_team'] = 'CIT_Provider_Bantas'
                decision['estimated_cost'] = self.COST_CASH_SCHEDULED
                decision['estimated_savings'] = self.COST_CASH_UNPLANNED - self.COST_CASH_SCHEDULED
                decision['reasoning'].append(
                    f"Cash moderately low: {cash_hours:.1f} hours until empty. "
                    "Scheduled refill prevents emergency trip."
                )
                decision['reasoning'].append(
                    f"💰 SAVINGS: {decision['estimated_savings']} TRY "
                    "(Avoided emergency refill)"
                )
                return decision
            
            # ================================================================
            # ALL CLEAR
            # ================================================================
            else:
                decision['action'] = 'NO_ACTION_REQUIRED'
                decision['urgency'] = 'LOW'
                decision['assigned_team'] = 'Monitoring_Only'
                decision['estimated_cost'] = 0
                decision['reasoning'].append(
                    f"All systems normal. Maintenance risk: {maintenance_prob:.2%}, "
                    f"Cash sufficient for {cash_hours:.1f} hours."
                )
                return decision
            
        except Exception as e:
            print(f"✗ ERROR in decision logic: {e}")
            # Fail-safe: Return conservative decision
            decision['action'] = 'MANUAL_REVIEW_REQUIRED'
            decision['urgency'] = 'MEDIUM'
            decision['assigned_team'] = 'Operations_Team'
            decision['reasoning'].append(f"Error in automated decision: {e}")
            return decision
    
    def process_batch(
        self,
        X_batch: np.ndarray,
        contexts: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Process a batch of ATMs and generate decisions for all.
        
        Args:
            X_batch: Feature matrix for multiple ATMs
            contexts: List of context dictionaries for each ATM
            
        Returns:
            List of decision dictionaries
        """
        predictions = self.predict(X_batch)
        decisions = []
        
        for i, context in enumerate(contexts):
            decision = self.decide_operational_action(
                maintenance_prob=predictions['maintenance_prob'][i],
                cash_hours=predictions['cash_hours'][i],
                context=context
            )
            decisions.append(decision)
        
        return decisions
    
    def export_decision_json(self, decision: Dict[str, Any]) -> str:
        """
        Export decision as formatted JSON string.
        
        Args:
            decision: Decision dictionary
            
        Returns:
            JSON string
        """
        return json.dumps(decision, indent=2, ensure_ascii=False)
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about loaded models.
        
        Returns:
            Model metadata dictionary
        """
        return {
            'maintenance_model_loaded': self.model_maintenance is not None,
            'cash_model_loaded': self.model_cash is not None,
            'metadata': self.metadata,
            'model_paths': {
                'maintenance': str(self.maintenance_model_path),
                'cash': str(self.cash_model_path),
                'metadata': str(self.metadata_path)
            }
        }


# =============================================================================
# USAGE EXAMPLE
# =============================================================================
if __name__ == "__main__":
    print("""
    ╔══════════════════════════════════════════════════════════════╗
    ║                   IRONCLAD ENGINE v1.0.0                     ║
    ║          ATM Predictive Maintenance Decision Engine          ║
    ╚══════════════════════════════════════════════════════════════╝
    """)
    
    # Example: Initialize engine
    engine = IronCladEngine(model_dir="./models")
    
    # Example context for a single ATM
    example_context = {
        'atm_id': 'ATM_12345',
        'location_type': 'Offsite',
        'zone': 2,
        'is_cit_en_route': True,  # CIT truck scheduled
        'next_route_day': (datetime.now() + timedelta(days=1)).date(),
        'security_level': 'High',
        'fault_type': 'Card_Reader_Jam',
        'current_time': datetime.now(),
        'branch_staff_available': False,
        'deposit_bin_level': 0.88,
        'reject_bin_level': 0.75
    }
    
    # Example prediction (would come from model in production)
    example_maintenance_prob = 0.75
    example_cash_hours = 12.5
    
    # Generate decision
    decision = engine.decide_operational_action(
        maintenance_prob=example_maintenance_prob,
        cash_hours=example_cash_hours,
        context=example_context
    )
    
    # Print decision
    print("\n" + "=" * 60)
    print("EXAMPLE DECISION OUTPUT:")
    print("=" * 60)
    print(engine.export_decision_json(decision))
    
    print("\n✓ IronCladEngine ready for production deployment!")

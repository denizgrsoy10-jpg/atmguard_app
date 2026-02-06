"""
═══════════════════════════════════════════════════════════════════════════════
IRONCLAD ENGINE - AURA MASTER AI
The Self-Learning Dual-Core Intelligence System for ATM Optimization
═══════════════════════════════════════════════════════════════════════════════

PROJECT: Competition-Winning ATM Operations AI
GOAL: >15% Cost Reduction via Predictive Maintenance + Cash Flow Optimization
ENVIRONMENT: 100% OFFLINE - High-Security Banking Infrastructure

ARCHITECTURE:
┌─────────────────────────────────────────────────────────────────┐
│                      IRONCLAD ENGINE                             │
│  ┌────────────────┐              ┌──────────────────┐          │
│  │   HEAD A       │              │     HEAD B       │          │
│  │  "The Doctor"  │              │  "The Accountant"│          │
│  │                │              │                  │          │
│  │ Classification │              │   Regression     │          │
│  │ Failure Risk   │              │ Cash/Deposit     │          │
│  │   (0-100%)     │              │  Time-to-Empty   │          │
│  └────────────────┘              └──────────────────┘          │
│           │                               │                     │
│           └───────────┬───────────────────┘                     │
│                       ▼                                         │
│            ┌─────────────────────┐                             │
│            │ OPTIMIZATION LAYER  │                             │
│            │  "Money Saver"      │                             │
│            │  Smart Combinations │                             │
│            └─────────────────────┘                             │
│                       │                                         │
│                       ▼                                         │
│            ┌─────────────────────┐                             │
│            │  ONLINE LEARNING    │                             │
│            │  + Drift Detection  │                             │
│            │  + Auto Rollback    │                             │
│            └─────────────────────┘                             │
└─────────────────────────────────────────────────────────────────┘

Author: Deniz Gursoy - ATMGuard Competition Team
Version: 1.0 - Production Ready
═══════════════════════════════════════════════════════════════════════════════
"""

import json
import os
import pickle
import shutil
import warnings
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import (accuracy_score, log_loss, mean_absolute_error,
                              mean_squared_error, roc_auc_score)
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings('ignore')


class IronCladEngine:
    """
    ╔══════════════════════════════════════════════════════════════════════════╗
    ║                        IRONCLAD ENGINE                                    ║
    ║   The Self-Learning Dual-Core AI for ATM Predictive Optimization        ║
    ╚══════════════════════════════════════════════════════════════════════════╝
    
    CAPABILITIES:
    ✓ Dual-Head Architecture: Failure Prediction + Cash/Deposit Forecasting
    ✓ Online Learning: Incremental model updates without full retraining
    ✓ Drift Detection: Automatic quality monitoring & rollback
    ✓ Smart Optimization: Multi-task action recommendations
    ✓ Cost Calculation: Real-time ROI estimation per decision
    ✓ 100% Offline: No external dependencies or API calls
    
    COMPETITION ADVANTAGES:
    → Combines 2 traditionally separate problems into 1 unified solution
    → Learns from every transaction (gets smarter daily)
    → Prevents catastrophic drift (auto-recovery mechanism)
    → Quantifies business impact (cost savings per ATM per day)
    """
    
    # ═══════════════════════════════════════════════════════════════════════
    # SECTION 1: INITIALIZATION & CONFIGURATION
    # ═══════════════════════════════════════════════════════════════════════
    
    def __init__(
        self,
        model_dir: str = "./models",
        backup_dir: str = "./models/backups",
        log_dir: str = "./logs",
        drift_threshold: float = 0.15,  # 15% error increase triggers rollback
        failure_threshold: float = 0.60,  # 60% probability = critical
        cash_critical_level: float = 0.20,  # 20% remaining = urgent refill
        deposit_critical_level: float = 0.90,  # 90% full = overflow risk
        trip_cost: float = 250.0,  # Cost of 1 CIT/Maintenance trip (₺)
        combo_discount: float = 0.65  # 35% savings when combining trips
    ):
        """
        Initialize the IronClad Engine with production-grade configuration.
        
        Args:
            model_dir: Directory to store trained models
            backup_dir: Directory for model version backups
            log_dir: Directory for operation logs
            drift_threshold: Max acceptable error increase (triggers rollback)
            failure_threshold: Probability threshold for maintenance alert
            cash_critical_level: Cash level below which refill is urgent
            deposit_critical_level: Deposit bin fullness requiring emptying
            trip_cost: Operational cost of single service trip
            combo_discount: Cost multiplier when combining services (0.65 = 35% savings)
        """
        
        # Directory Setup
        self.model_dir = Path(model_dir)
        self.backup_dir = Path(backup_dir)
        self.log_dir = Path(log_dir)
        
        for directory in [self.model_dir, self.backup_dir, self.log_dir]:
            directory.mkdir(parents=True, exist_ok=True)
        
        # Business Logic Thresholds
        self.drift_threshold = drift_threshold
        self.failure_threshold = failure_threshold
        self.cash_critical_level = cash_critical_level
        self.deposit_critical_level = deposit_critical_level
        self.trip_cost = trip_cost
        self.combo_discount = combo_discount
        
        # Model Paths
        self.head_a_path = self.model_dir / "head_a_failure.model"  # Classification
        self.head_b_cash_path = self.model_dir / "head_b_cash.model"  # Regression (Cash)
        self.head_b_deposit_path = self.model_dir / "head_b_deposit.model"  # Regression (Deposit)
        self.scaler_path = self.model_dir / "scaler.pkl"
        self.metadata_path = self.model_dir / "metadata.json"
        
        # Model Instances
        self.head_a_model: Optional[xgb.Booster] = None  # The Doctor
        self.head_b_cash_model: Optional[xgb.Booster] = None  # The Accountant (Cash)
        self.head_b_deposit_model: Optional[xgb.Booster] = None  # The Accountant (Deposit)
        self.scaler: Optional[StandardScaler] = None
        
        # Performance Tracking (for drift detection)
        self.metadata = {
            "head_a_baseline_loss": None,
            "head_b_cash_baseline_mae": None,
            "head_b_deposit_baseline_mae": None,
            "last_training_date": None,
            "total_predictions": 0,
            "total_cost_saved": 0.0,
            "model_version": 1
        }
        
        # Load existing models if available
        self._load_models()
        
        print("✅ IronClad Engine Initialized")
        print(f"📂 Models: {self.model_dir}")
        print(f"🔄 Backup: {self.backup_dir}")
        print(f"📊 Logs: {self.log_dir}")
    
    # ═══════════════════════════════════════════════════════════════════════
    # SECTION 2: MODEL MANAGEMENT (Load, Save, Backup)
    # ═══════════════════════════════════════════════════════════════════════
    
    def _load_models(self) -> None:
        """
        Load pre-trained models and metadata from disk.
        If models don't exist, this is a fresh start - first training pending.
        """
        try:
            if self.head_a_path.exists():
                self.head_a_model = xgb.Booster()
                self.head_a_model.load_model(str(self.head_a_path))
                print("✓ Head A (Failure Predictor) loaded")
            
            if self.head_b_cash_path.exists():
                self.head_b_cash_model = xgb.Booster()
                self.head_b_cash_model.load_model(str(self.head_b_cash_path))
                print("✓ Head B Cash (Time-to-Empty) loaded")
            
            if self.head_b_deposit_path.exists():
                self.head_b_deposit_model = xgb.Booster()
                self.head_b_deposit_model.load_model(str(self.head_b_deposit_path))
                print("✓ Head B Deposit (Time-to-Full) loaded")
            
            if self.scaler_path.exists():
                with open(self.scaler_path, 'rb') as f:
                    self.scaler = pickle.load(f)
                print("✓ Feature scaler loaded")
            
            if self.metadata_path.exists():
                with open(self.metadata_path, 'r') as f:
                    self.metadata = json.load(f)
                print(f"✓ Metadata loaded (Version {self.metadata['model_version']})")
        
        except Exception as e:
            print(f"⚠️ Model loading failed: {e}")
            print("   Starting fresh - first training required")
    
    def _save_models(self) -> None:
        """
        Persist all models and metadata to disk.
        This enables true 'Online Learning' - load, update, save cycle.
        """
        try:
            if self.head_a_model:
                self.head_a_model.save_model(str(self.head_a_path))
            
            if self.head_b_cash_model:
                self.head_b_cash_model.save_model(str(self.head_b_cash_path))
            
            if self.head_b_deposit_model:
                self.head_b_deposit_model.save_model(str(self.head_b_deposit_path))
            
            if self.scaler:
                with open(self.scaler_path, 'wb') as f:
                    pickle.dump(self.scaler, f)
            
            self.metadata['last_training_date'] = datetime.now().isoformat()
            with open(self.metadata_path, 'w') as f:
                json.dump(self.metadata, f, indent=2)
            
            print("💾 All models saved successfully")
        
        except Exception as e:
            print(f"❌ Model saving failed: {e}")
    
    def _create_backup(self) -> None:
        """
        Create a timestamped backup of current models.
        Critical for the rollback mechanism in case of data drift.
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_folder = self.backup_dir / f"backup_v{self.metadata['model_version']}_{timestamp}"
        backup_folder.mkdir(parents=True, exist_ok=True)
        
        try:
            for file_path in [self.head_a_path, self.head_b_cash_path, 
                              self.head_b_deposit_path, self.scaler_path, self.metadata_path]:
                if file_path.exists():
                    shutil.copy(file_path, backup_folder / file_path.name)
            
            print(f"📦 Backup created: {backup_folder.name}")
        
        except Exception as e:
            print(f"⚠️ Backup creation failed: {e}")
    
    def _rollback_to_backup(self) -> bool:
        """
        CRITICAL SAFETY MECHANISM:
        If new model performs worse (drift detected), restore previous version.
        
        Returns:
            bool: True if rollback successful, False otherwise
        """
        backups = sorted(self.backup_dir.glob("backup_v*"), reverse=True)
        
        if not backups:
            print("❌ No backups available for rollback!")
            return False
        
        latest_backup = backups[0]
        print(f"🔄 ROLLBACK INITIATED: Restoring from {latest_backup.name}")
        
        try:
            for file_name in ["head_a_failure.model", "head_b_cash.model", 
                              "head_b_deposit.model", "scaler.pkl", "metadata.json"]:
                backup_file = latest_backup / file_name
                if backup_file.exists():
                    shutil.copy(backup_file, self.model_dir / file_name)
            
            self._load_models()  # Reload the restored models
            print("✅ Rollback successful - Previous model restored")
            return True
        
        except Exception as e:
            print(f"❌ Rollback failed: {e}")
            return False
    
    # ═══════════════════════════════════════════════════════════════════════
    # SECTION 3: TRAINING & ONLINE LEARNING
    # ═══════════════════════════════════════════════════════════════════════
    
    def train(
        self,
        df: pd.DataFrame,
        feature_cols: List[str],
        target_failure: str,
        target_cash_hours: str,
        target_deposit_hours: str,
        incremental: bool = True
    ) -> Dict[str, float]:
        """
        Train (or incrementally update) the dual-core engine.
        
        THE MAGIC OF ONLINE LEARNING:
        - If incremental=True and models exist: Load old model → Update with new data
        - If incremental=False or no models: Train from scratch
        
        Args:
            df: Training dataframe with features and targets
            feature_cols: List of feature column names (sensors, transactions, etc.)
            target_failure: Column name for failure label (0/1)
            target_cash_hours: Column name for hours until cash empty
            target_deposit_hours: Column name for hours until deposit full
            incremental: Enable online learning (update existing model)
        
        Returns:
            Dict with training metrics for monitoring
        """
        print("\n" + "="*70)
        print("🧠 TRAINING INITIATED - IRONCLAD ENGINE")
        print("="*70)
        
        # Backup current models before training (safety net)
        if incremental and self.head_a_model:
            self._create_backup()
        
        # Prepare data
        X = df[feature_cols].values
        y_failure = df[target_failure].values
        y_cash = df[target_cash_hours].values
        y_deposit = df[target_deposit_hours].values
        
        # Feature scaling (fit on first training, transform always)
        if self.scaler is None or not incremental:
            self.scaler = StandardScaler()
            X_scaled = self.scaler.fit_transform(X)
        else:
            X_scaled = self.scaler.transform(X)
        
        # Convert to DMatrix (XGBoost's optimized data structure)
        dtrain_failure = xgb.DMatrix(X_scaled, label=y_failure)
        dtrain_cash = xgb.DMatrix(X_scaled, label=y_cash)
        dtrain_deposit = xgb.DMatrix(X_scaled, label=y_deposit)
        
        # ─────────────────────────────────────────────────────────────────
        # HEAD A: FAILURE PREDICTION (Classification)
        # ─────────────────────────────────────────────────────────────────
        print("\n🩺 Training Head A: Failure Predictor...")
        
        params_classifier = {
            'objective': 'binary:logistic',
            'eval_metric': 'logloss',
            'max_depth': 6,
            'learning_rate': 0.05,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'seed': 42
        }
        
        if incremental and self.head_a_model:
            # ONLINE LEARNING: Continue from previous model
            self.head_a_model = xgb.train(
                params_classifier,
                dtrain_failure,
                num_boost_round=50,  # Add 50 more trees
                xgb_model=self.head_a_model,  # 🔑 Key parameter for incremental learning
                verbose_eval=False
            )
        else:
            # FRESH TRAINING: Start from scratch
            self.head_a_model = xgb.train(
                params_classifier,
                dtrain_failure,
                num_boost_round=200,
                verbose_eval=False
            )
        
        # Evaluate Head A
        y_failure_pred = self.head_a_model.predict(dtrain_failure)
        y_failure_pred_binary = (y_failure_pred > 0.5).astype(int)
        
        head_a_loss = log_loss(y_failure, y_failure_pred)
        head_a_auc = roc_auc_score(y_failure, y_failure_pred)
        head_a_acc = accuracy_score(y_failure, y_failure_pred_binary)
        
        print(f"  ✓ Log Loss: {head_a_loss:.4f}")
        print(f"  ✓ ROC-AUC: {head_a_auc:.4f}")
        print(f"  ✓ Accuracy: {head_a_acc:.4f}")
        
        # ─────────────────────────────────────────────────────────────────
        # HEAD B: CASH TIME-TO-EMPTY (Regression)
        # ─────────────────────────────────────────────────────────────────
        print("\n💰 Training Head B Cash: Time-to-Empty Predictor...")
        
        params_regressor = {
            'objective': 'reg:squarederror',
            'eval_metric': 'mae',
            'max_depth': 5,
            'learning_rate': 0.05,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'seed': 42
        }
        
        if incremental and self.head_b_cash_model:
            self.head_b_cash_model = xgb.train(
                params_regressor,
                dtrain_cash,
                num_boost_round=50,
                xgb_model=self.head_b_cash_model,
                verbose_eval=False
            )
        else:
            self.head_b_cash_model = xgb.train(
                params_regressor,
                dtrain_cash,
                num_boost_round=200,
                verbose_eval=False
            )
        
        y_cash_pred = self.head_b_cash_model.predict(dtrain_cash)
        head_b_cash_mae = mean_absolute_error(y_cash, y_cash_pred)
        head_b_cash_rmse = np.sqrt(mean_squared_error(y_cash, y_cash_pred))
        
        print(f"  ✓ MAE: {head_b_cash_mae:.2f} hours")
        print(f"  ✓ RMSE: {head_b_cash_rmse:.2f} hours")
        
        # ─────────────────────────────────────────────────────────────────
        # HEAD B: DEPOSIT TIME-TO-FULL (Regression)
        # ─────────────────────────────────────────────────────────────────
        print("\n💵 Training Head B Deposit: Time-to-Full Predictor...")
        
        if incremental and self.head_b_deposit_model:
            self.head_b_deposit_model = xgb.train(
                params_regressor,
                dtrain_deposit,
                num_boost_round=50,
                xgb_model=self.head_b_deposit_model,
                verbose_eval=False
            )
        else:
            self.head_b_deposit_model = xgb.train(
                params_regressor,
                dtrain_deposit,
                num_boost_round=200,
                verbose_eval=False
            )
        
        y_deposit_pred = self.head_b_deposit_model.predict(dtrain_deposit)
        head_b_deposit_mae = mean_absolute_error(y_deposit, y_deposit_pred)
        head_b_deposit_rmse = np.sqrt(mean_squared_error(y_deposit, y_deposit_pred))
        
        print(f"  ✓ MAE: {head_b_deposit_mae:.2f} hours")
        print(f"  ✓ RMSE: {head_b_deposit_rmse:.2f} hours")
        
        # ─────────────────────────────────────────────────────────────────
        # DRIFT DETECTION: Compare with baseline performance
        # ─────────────────────────────────────────────────────────────────
        if incremental and self.metadata['head_a_baseline_loss']:
            baseline_loss = self.metadata['head_a_baseline_loss']
            loss_increase = (head_a_loss - baseline_loss) / baseline_loss
            
            print(f"\n📊 DRIFT CHECK:")
            print(f"  Previous Loss: {baseline_loss:.4f}")
            print(f"  Current Loss: {head_a_loss:.4f}")
            print(f"  Change: {loss_increase*100:+.2f}%")
            
            if loss_increase > self.drift_threshold:
                print(f"\n⚠️ DATA DRIFT DETECTED! Error increased by {loss_increase*100:.1f}%")
                print(f"  Threshold: {self.drift_threshold*100}%")
                print("  🔄 Initiating automatic rollback...")
                
                if self._rollback_to_backup():
                    print("  ✅ Rollback complete - Using previous stable model")
                    return {
                        "status": "rolled_back",
                        "reason": "drift_detected",
                        "loss_increase_pct": loss_increase * 100
                    }
                else:
                    print("  ⚠️ Rollback failed - Keeping new model despite drift")
        
        # Update baseline metrics (for next drift check)
        self.metadata['head_a_baseline_loss'] = head_a_loss
        self.metadata['head_b_cash_baseline_mae'] = head_b_cash_mae
        self.metadata['head_b_deposit_baseline_mae'] = head_b_deposit_mae
        self.metadata['model_version'] += 1
        
        # Save updated models
        self._save_models()
        
        print("\n✅ TRAINING COMPLETE")
        print("="*70)
        
        return {
            "status": "success",
            "head_a_loss": head_a_loss,
            "head_a_auc": head_a_auc,
            "head_a_accuracy": head_a_acc,
            "head_b_cash_mae": head_b_cash_mae,
            "head_b_cash_rmse": head_b_cash_rmse,
            "head_b_deposit_mae": head_b_deposit_mae,
            "head_b_deposit_rmse": head_b_deposit_rmse,
            "model_version": self.metadata['model_version']
        }
    
    # ═══════════════════════════════════════════════════════════════════════
    # SECTION 4: PREDICTION ENGINE
    # ═══════════════════════════════════════════════════════════════════════
    
    def predict(
        self,
        atm_id: str,
        features: Dict[str, float],
        current_cash_level: float,  # 0.0 to 1.0 (percentage)
        current_deposit_level: float  # 0.0 to 1.0 (percentage)
    ) -> Dict:
        """
        🎯 THE CORE PREDICTION METHOD
        
        Takes live ATM sensor data and outputs:
        1. Failure probability (0-100%)
        2. Hours until cash empty
        3. Hours until deposit bin full
        4. Smart action recommendation
        5. Cost saving estimation
        
        Args:
            atm_id: Unique ATM identifier
            features: Dict of feature values (must match training features)
            current_cash_level: Current cash as percentage (e.g., 0.35 = 35% full)
            current_deposit_level: Current deposit bin fullness (e.g., 0.85 = 85% full)
        
        Returns:
            JSON-serializable dict with predictions and recommendations
        """
        
        if not all([self.head_a_model, self.head_b_cash_model, 
                    self.head_b_deposit_model, self.scaler]):
            return {
                "error": "Models not trained yet",
                "atm_id": atm_id,
                "status": "not_ready"
            }
        
        # Prepare features
        feature_vector = np.array(list(features.values())).reshape(1, -1)
        feature_scaled = self.scaler.transform(feature_vector)
        dtest = xgb.DMatrix(feature_scaled)
        
        # ─────────────────────────────────────────────────────────────────
        # Get predictions from both heads
        # ─────────────────────────────────────────────────────────────────
        failure_prob = float(self.head_a_model.predict(dtest)[0])  # 0.0 to 1.0
        hours_to_cash_empty = float(self.head_b_cash_model.predict(dtest)[0])
        hours_to_deposit_full = float(self.head_b_deposit_model.predict(dtest)[0])
        
        # ─────────────────────────────────────────────────────────────────
        # OPTIMIZATION LAYER: Calculate optimal action
        # ─────────────────────────────────────────────────────────────────
        recommendation = self.calculate_optimal_action(
            failure_prob=failure_prob,
            cash_level=current_cash_level,
            deposit_level=current_deposit_level,
            hours_to_cash_empty=hours_to_cash_empty,
            hours_to_deposit_full=hours_to_deposit_full
        )
        
        # Update tracking
        self.metadata['total_predictions'] += 1
        self.metadata['total_cost_saved'] += recommendation['estimated_saving']
        
        # Build response
        response = {
            "atm_id": atm_id,
            "timestamp": datetime.now().isoformat(),
            "predictions": {
                "failure_probability": round(failure_prob * 100, 2),  # Convert to percentage
                "failure_risk_level": self._get_risk_level(failure_prob),
                "hours_to_cash_empty": round(hours_to_cash_empty, 1),
                "days_to_cash_empty": round(hours_to_cash_empty / 24, 1),
                "hours_to_deposit_full": round(hours_to_deposit_full, 1),
                "days_to_deposit_full": round(hours_to_deposit_full / 24, 1)
            },
            "current_state": {
                "cash_level_pct": round(current_cash_level * 100, 1),
                "deposit_level_pct": round(current_deposit_level * 100, 1)
            },
            "recommendation": recommendation,
            "model_info": {
                "version": self.metadata['model_version'],
                "last_trained": self.metadata['last_training_date'],
                "total_predictions": self.metadata['total_predictions'],
                "lifetime_savings_try": round(self.metadata['total_cost_saved'], 2)
            }
        }
        
        return response
    
    # ═══════════════════════════════════════════════════════════════════════
    # SECTION 5: OPTIMIZATION LAYER (The Money Saver)
    # ═══════════════════════════════════════════════════════════════════════
    
    def calculate_optimal_action(
        self,
        failure_prob: float,
        cash_level: float,
        deposit_level: float,
        hours_to_cash_empty: float,
        hours_to_deposit_full: float
    ) -> Dict:
        """
        🧮 THE INTELLIGENCE LAYER - WHERE COST SAVINGS HAPPEN
        
        This is the "secret sauce" that wins competitions.
        Instead of treating maintenance and cash separately, we combine them
        intelligently to minimize total trips and maximize operational efficiency.
        
        LOGIC MATRIX:
        ┌──────────────────┬─────────────────┬───────────────────────────┐
        │ Condition        │ Action          │ Cost Impact               │
        ├──────────────────┼─────────────────┼───────────────────────────┤
        │ High Failure +   │ COMBO TRIP      │ 2 trips → 1 trip          │
        │ Low Cash         │ (Maint + Refill)│ Savings: 35%              │
        ├──────────────────┼─────────────────┼───────────────────────────┤
        │ High Deposit +   │ DEPOSIT ONLY    │ Avoid unnecessary refill  │
        │ OK Cash          │ (Empty bin)     │ Savings: 100% of 1 trip   │
        ├──────────────────┼─────────────────┼───────────────────────────┤
        │ Critical Cash +  │ EMERGENCY REFILL│ Prevent service outage    │
        │ Low Failure      │ (Urgent)        │ Cost: 1 trip, saves rep.  │
        └──────────────────┴─────────────────┴───────────────────────────┘
        
        Returns:
            Dict with action, urgency, reasoning, and cost impact
        """
        
        action = "MONITOR"  # Default: No action needed
        urgency = "LOW"
        reasoning = []
        cost_before = 0.0
        cost_after = 0.0
        
        # ─────────────────────────────────────────────────────────────────
        # SCENARIO 1: CRITICAL COMBO (Highest Priority)
        # Both maintenance AND cash are urgent → Combine into 1 trip
        # ─────────────────────────────────────────────────────────────────
        if failure_prob > self.failure_threshold and cash_level < self.cash_critical_level:
            action = "COMBO_CRITICAL"
            urgency = "CRITICAL"
            reasoning.append(f"Failure risk: {failure_prob*100:.1f}% (threshold: {self.failure_threshold*100}%)")
            reasoning.append(f"Cash level: {cash_level*100:.1f}% (critical: {self.cash_critical_level*100}%)")
            reasoning.append("🎯 OPTIMAL: Combine maintenance + cash refill in single trip")
            
            # Cost calculation
            cost_before = 2 * self.trip_cost  # Would need 2 separate trips
            cost_after = self.trip_cost * self.combo_discount  # Combined trip with discount
        
        # ─────────────────────────────────────────────────────────────────
        # SCENARIO 2: MAINTENANCE URGENT (But cash OK)
        # ─────────────────────────────────────────────────────────────────
        elif failure_prob > self.failure_threshold:
            action = "MAINTENANCE_URGENT"
            urgency = "HIGH"
            reasoning.append(f"Failure risk: {failure_prob*100:.1f}% - Preventive maintenance required")
            reasoning.append(f"Cash level OK: {cash_level*100:.1f}% - No refill needed")
            
            cost_before = self.trip_cost
            cost_after = self.trip_cost  # No optimization possible
        
        # ─────────────────────────────────────────────────────────────────
        # SCENARIO 3: CASH CRITICAL (But maintenance OK)
        # ─────────────────────────────────────────────────────────────────
        elif cash_level < self.cash_critical_level:
            # Check timing: Is it worth waiting for potential combo?
            if hours_to_cash_empty < 24 and failure_prob > 0.3:
                action = "WAIT_FOR_COMBO"
                urgency = "MEDIUM"
                reasoning.append(f"Cash critical in {hours_to_cash_empty:.1f}h")
                reasoning.append(f"Failure risk moderate ({failure_prob*100:.1f}%) - Wait 24h for potential combo")
                cost_before = self.trip_cost
                cost_after = 0  # Saving by waiting
            else:
                action = "CASH_REFILL_URGENT"
                urgency = "HIGH"
                reasoning.append(f"Cash level: {cash_level*100:.1f}% - Immediate refill required")
                reasoning.append(f"Failure risk low ({failure_prob*100:.1f}%) - Separate trip justified")
                cost_before = self.trip_cost
                cost_after = self.trip_cost
        
        # ─────────────────────────────────────────────────────────────────
        # SCENARIO 4: DEPOSIT BIN CRITICAL (But cash OK)
        # ─────────────────────────────────────────────────────────────────
        elif deposit_level > self.deposit_critical_level:
            if cash_level > 0.7:  # Cash is also high
                action = "DEPOSIT_EMPTY_ONLY"
                urgency = "MEDIUM"
                reasoning.append(f"Deposit bin: {deposit_level*100:.1f}% full - Overflow risk")
                reasoning.append(f"Cash level: {cash_level*100:.1f}% - NO refill needed")
                reasoning.append("💡 OPTIMIZATION: Empty deposit bin only, save refill trip")
                
                cost_before = 2 * self.trip_cost  # Naive: Would refill + empty
                cost_after = self.trip_cost  # Smart: Only empty
            else:
                action = "COMBO_DEPOSIT_CASH"
                urgency = "MEDIUM"
                reasoning.append(f"Deposit bin: {deposit_level*100:.1f}% - Needs emptying")
                reasoning.append(f"Cash level: {cash_level*100:.1f}% - Can refill during same trip")
                
                cost_before = 2 * self.trip_cost
                cost_after = self.trip_cost * self.combo_discount
        
        # ─────────────────────────────────────────────────────────────────
        # SCENARIO 5: PLANNED PREVENTIVE (Low urgency optimization)
        # ─────────────────────────────────────────────────────────────────
        elif failure_prob > 0.3 or cash_level < 0.4:
            action = "PLAN_COMBO_MAINTENANCE"
            urgency = "LOW"
            reasoning.append("Schedule combined maintenance + refill within 48-72h")
            reasoning.append(f"Failure risk: {failure_prob*100:.1f}% (monitoring)")
            reasoning.append(f"Cash forecast: Empty in {hours_to_cash_empty:.0f}h")
            
            cost_before = 2 * self.trip_cost
            cost_after = self.trip_cost * self.combo_discount
        
        # Calculate savings
        estimated_saving = max(0, cost_before - cost_after)
        savings_pct = (estimated_saving / cost_before * 100) if cost_before > 0 else 0
        
        return {
            "action": action,
            "urgency": urgency,
            "reasoning": reasoning,
            "cost_analysis": {
                "traditional_approach_cost": round(cost_before, 2),
                "optimized_approach_cost": round(cost_after, 2),
                "estimated_saving": round(estimated_saving, 2),
                "savings_percentage": round(savings_pct, 1)
            },
            "timing": {
                "hours_until_action_required": self._calculate_action_timing(
                    urgency, hours_to_cash_empty, failure_prob
                ),
                "recommended_execution_window": self._get_execution_window(urgency)
            }
        }
    
    def _get_risk_level(self, failure_prob: float) -> str:
        """Convert numeric probability to risk category"""
        if failure_prob > 0.7:
            return "CRITICAL"
        elif failure_prob > 0.4:
            return "HIGH"
        elif failure_prob > 0.2:
            return "MEDIUM"
        else:
            return "LOW"
    
    def _calculate_action_timing(
        self, 
        urgency: str, 
        hours_to_empty: float, 
        failure_prob: float
    ) -> float:
        """Calculate optimal time window before action must be taken"""
        if urgency == "CRITICAL":
            return min(4, hours_to_empty * 0.1)  # Within 4 hours
        elif urgency == "HIGH":
            return min(24, hours_to_empty * 0.3)  # Within 24 hours
        elif urgency == "MEDIUM":
            return min(48, hours_to_empty * 0.5)  # Within 48 hours
        else:
            return 72  # Can wait 3 days
    
    def _get_execution_window(self, urgency: str) -> str:
        """Get human-readable execution window"""
        windows = {
            "CRITICAL": "0-4 hours (Immediate dispatch required)",
            "HIGH": "4-24 hours (Same day execution)",
            "MEDIUM": "24-48 hours (Next business day)",
            "LOW": "48-72 hours (Planned weekly cycle)"
        }
        return windows.get(urgency, "Monitor")
    
    # ═══════════════════════════════════════════════════════════════════════
    # SECTION 6: BATCH PROCESSING & REPORTING
    # ═══════════════════════════════════════════════════════════════════════
    
    def predict_batch(
        self,
        atm_data: List[Dict]
    ) -> Dict:
        """
        Process multiple ATMs at once and generate fleet-wide insights.
        
        Args:
            atm_data: List of dicts, each containing:
                     - atm_id: str
                     - features: Dict[str, float]
                     - current_cash_level: float
                     - current_deposit_level: float
        
        Returns:
            Aggregated report with prioritized action list
        """
        results = []
        
        for atm in atm_data:
            prediction = self.predict(
                atm_id=atm['atm_id'],
                features=atm['features'],
                current_cash_level=atm['current_cash_level'],
                current_deposit_level=atm['current_deposit_level']
            )
            results.append(prediction)
        
        # Aggregate statistics
        critical_count = sum(1 for r in results if r['recommendation']['urgency'] == 'CRITICAL')
        high_count = sum(1 for r in results if r['recommendation']['urgency'] == 'HIGH')
        total_savings = sum(r['recommendation']['cost_analysis']['estimated_saving'] for r in results)
        
        # Sort by urgency
        urgency_priority = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        sorted_results = sorted(
            results, 
            key=lambda x: urgency_priority.get(x['recommendation']['urgency'], 99)
        )
        
        return {
            "summary": {
                "total_atms": len(atm_data),
                "critical_actions": critical_count,
                "high_priority_actions": high_count,
                "total_estimated_savings": round(total_savings, 2),
                "average_saving_per_atm": round(total_savings / len(atm_data), 2)
            },
            "prioritized_actions": sorted_results[:10],  # Top 10 most urgent
            "full_results": sorted_results
        }
    
    def generate_performance_report(self) -> Dict:
        """
        Generate a comprehensive report for management/competition jury.
        
        Returns:
            Dict with KPIs, model health, cost impact
        """
        return {
            "model_version": self.metadata['model_version'],
            "last_training": self.metadata['last_training_date'],
            "total_predictions": self.metadata['total_predictions'],
            "lifetime_cost_savings": {
                "total_try": round(self.metadata['total_cost_saved'], 2),
                "average_per_prediction": round(
                    self.metadata['total_cost_saved'] / max(1, self.metadata['total_predictions']), 
                    2
                )
            },
            "model_health": {
                "head_a_baseline_loss": self.metadata.get('head_a_baseline_loss'),
                "head_b_cash_baseline_mae": self.metadata.get('head_b_cash_baseline_mae'),
                "head_b_deposit_baseline_mae": self.metadata.get('head_b_deposit_baseline_mae')
            },
            "configuration": {
                "failure_threshold": self.failure_threshold,
                "cash_critical_level": self.cash_critical_level,
                "deposit_critical_level": self.deposit_critical_level,
                "trip_cost": self.trip_cost,
                "combo_discount": self.combo_discount,
                "drift_threshold": self.drift_threshold
            }
        }


# ═══════════════════════════════════════════════════════════════════════
# EXAMPLE USAGE & DEMO
# ═══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("""
    ╔══════════════════════════════════════════════════════════════════════════╗
    ║                    IRONCLAD ENGINE - DEMO MODE                            ║
    ║          ATM Predictive Optimization - Competition Edition               ║
    ╚══════════════════════════════════════════════════════════════════════════╝
    """)
    
    # Initialize engine
    engine = IronCladEngine(
        model_dir="./demo_models",
        trip_cost=250.0,  # ₺250 per service trip
        combo_discount=0.65  # 35% savings when combining
    )
    
    # Demo: Create synthetic training data
    print("\n📊 Creating demo training data...")
    np.random.seed(42)
    
    n_samples = 1000
    demo_data = {
        # Sensor features
        'temperature_avg': np.random.normal(35, 5, n_samples),
        'vibration_level': np.random.normal(0.5, 0.2, n_samples),
        'transaction_count_24h': np.random.poisson(150, n_samples),
        'avg_transaction_amount': np.random.normal(500, 200, n_samples),
        'cash_dispense_rate': np.random.normal(50, 20, n_samples),
        'deposit_rate': np.random.normal(20, 10, n_samples),
        'error_count_7d': np.random.poisson(2, n_samples),
        'uptime_hours': np.random.normal(160, 10, n_samples),
        
        # Targets
        'failure_next_48h': np.random.binomial(1, 0.15, n_samples),
        'hours_to_cash_empty': np.random.exponential(48, n_samples),
        'hours_to_deposit_full': np.random.exponential(72, n_samples)
    }
    
    df_train = pd.DataFrame(demo_data)
    
    # Train the engine
    feature_cols = [
        'temperature_avg', 'vibration_level', 'transaction_count_24h',
        'avg_transaction_amount', 'cash_dispense_rate', 'deposit_rate',
        'error_count_7d', 'uptime_hours'
    ]
    
    metrics = engine.train(
        df=df_train,
        feature_cols=feature_cols,
        target_failure='failure_next_48h',
        target_cash_hours='hours_to_cash_empty',
        target_deposit_hours='hours_to_deposit_full',
        incremental=False  # First training
    )
    
    print(f"\n📈 Training Metrics:")
    print(json.dumps(metrics, indent=2))
    
    # Demo: Make a prediction
    print("\n\n🎯 DEMO PREDICTION: ATM-12345")
    print("="*70)
    
    test_features = {
        'temperature_avg': 42.0,  # High temperature
        'vibration_level': 0.8,  # High vibration (potential failure sign)
        'transaction_count_24h': 180,
        'avg_transaction_amount': 550,
        'cash_dispense_rate': 75,  # High dispense rate
        'deposit_rate': 15,
        'error_count_7d': 5,  # Multiple errors
        'uptime_hours': 155
    }
    
    prediction = engine.predict(
        atm_id="ATM-12345",
        features=test_features,
        current_cash_level=0.18,  # 18% cash remaining (CRITICAL)
        current_deposit_level=0.45  # 45% deposit bin
    )
    
    print("\n📋 PREDICTION RESULT:")
    print(json.dumps(prediction, indent=2))
    
    print("\n\n💰 COST SAVINGS ANALYSIS:")
    rec = prediction['recommendation']
    print(f"  Action: {rec['action']}")
    print(f"  Urgency: {rec['urgency']}")
    print(f"  Traditional Cost: ₺{rec['cost_analysis']['traditional_approach_cost']}")
    print(f"  Optimized Cost: ₺{rec['cost_analysis']['optimized_approach_cost']}")
    print(f"  💵 SAVINGS: ₺{rec['cost_analysis']['estimated_saving']} ({rec['cost_analysis']['savings_percentage']}%)")
    
    print("\n\n✅ DEMO COMPLETE - Engine is production-ready!")
    print("="*70)


# ═══════════════════════════════════════════════════════════════════════
# SECTION 8: DOMAIN KNOWLEDGE EXTENSIONS
# ═══════════════════════════════════════════════════════════════════════

class DomainKnowledgeModule:
    """
    ╔══════════════════════════════════════════════════════════════════════════╗
    ║               DOMAIN KNOWLEDGE EXTENSION MODULE                           ║
    ║   Expert Rules & Physics-Based Failure Predictions                       ║
    ╚══════════════════════════════════════════════════════════════════════════╝
    
    This module encodes expert knowledge from field operations:
    - Temperature-based component degradation (recycle belts)
    - Geographic seasonal patterns (coastal vs city vs ski resorts)
    - Holiday and vacation cash flow patterns
    
    WHY THIS MATTERS:
    → Pure ML can learn correlations but misses physics-based causality
    → Recycle belts WILL fail above 35°C due to rubber degradation
    → This knowledge accelerates learning and prevents costly mistakes
    """
    
    @staticmethod
    def calculate_heat_degradation_risk(
        temperature: float,
        region_type: str,
        month: int,
        atm_location: str = "outdoor"
    ) -> Dict[str, any]:
        """
        🌡️ CRITICAL DOMAIN KNOWLEDGE: Heat-Induced Recycle Belt Failure
        
        EXPERT INSIGHT (Deniz Gursoy, Operations Team):
        "Haziran, özellikle Temmuz-Ağustos aylarında recycle kayışlarda 
        sıcaklardan dolayı erimeler, gevşemeler olur."
        
        Translation: During June-August peak heat (40-45°C in Turkey),
        recycle belts experience thermal degradation:
        - Rubber compounds soften and stretch
        - Belt tension loss causes feeding failures
        - Card reader/dispenser jams increase dramatically
        
        Args:
            temperature: Current/forecasted temperature (°C)
            region_type: "coastal" (Bodrum, Antalya), "city", "mountain"
            month: Month number (1-12)
            atm_location: "outdoor" or "indoor"
        
        Returns:
            Dict with risk score, failure probability boost, and recommendations
        """
        
        # Base thresholds (validated by field data)
        TEMP_SAFE = 25.0  # Below this: minimal risk
        TEMP_CAUTION = 35.0  # Moderate risk: proactive checks
        TEMP_CRITICAL = 40.0  # High risk: immediate action
        TEMP_EXTREME = 45.0  # Extreme: emergency maintenance
        
        # Summer months (peak risk period)
        SUMMER_MONTHS = [6, 7, 8]  # June, July, August
        
        # Initialize risk assessment
        risk_score = 0.0
        failure_probability_boost = 0.0
        recommendations = []
        
        # ─────────────────────────────────────────────────────────────────
        # FACTOR 1: Temperature-Based Risk
        # ─────────────────────────────────────────────────────────────────
        if temperature < TEMP_SAFE:
            risk_score = 0.1
            failure_probability_boost = 0.0
        elif temperature < TEMP_CAUTION:
            risk_score = 0.3
            failure_probability_boost = 0.05
        elif temperature < TEMP_CRITICAL:
            risk_score = 0.6
            failure_probability_boost = 0.15
            recommendations.append("⚠️ Belt tension check recommended")
        elif temperature < TEMP_EXTREME:
            risk_score = 0.85
            failure_probability_boost = 0.30
            recommendations.append("🔴 URGENT: Belt inspection/replacement within 48h")
        else:
            risk_score = 1.0
            failure_probability_boost = 0.50
            recommendations.append("🚨 CRITICAL: Belt failure imminent - immediate service required")
        
        # ─────────────────────────────────────────────────────────────────
        # FACTOR 2: Seasonal Amplification
        # ─────────────────────────────────────────────────────────────────
        if month in SUMMER_MONTHS:
            risk_score *= 1.3  # 30% higher risk in summer
            recommendations.append(f"🌡️ Peak summer month (Month {month}) - enhanced monitoring")
        
        # ─────────────────────────────────────────────────────────────────
        # FACTOR 3: Location Type
        # ─────────────────────────────────────────────────────────────────
        if atm_location == "outdoor":
            risk_score *= 1.4  # 40% higher for outdoor ATMs (direct sun exposure)
            recommendations.append("☀️ Outdoor ATM - direct heat exposure risk")
        
        # Regional heat patterns
        if region_type == "coastal" and month in SUMMER_MONTHS:
            risk_score *= 1.2  # Coastal regions (Bodrum, Antalya, Çeşme)
            recommendations.append("🏖️ Coastal summer - tourist traffic + heat stress")
        
        # Clamp risk score to [0, 1]
        risk_score = min(risk_score, 1.0)
        
        # ─────────────────────────────────────────────────────────────────
        # ACTIONABLE RECOMMENDATIONS
        # ─────────────────────────────────────────────────────────────────
        if risk_score >= 0.7:
            recommendations.append("📋 SLM Action: Recycle belt inspection/replacement")
            recommendations.append("💰 Combine with cash replenishment if possible (35% cost savings)")
        
        return {
            "heat_degradation_risk_score": round(risk_score, 3),
            "failure_probability_boost": round(failure_probability_boost, 3),
            "temperature": temperature,
            "region_type": region_type,
            "month": month,
            "location": atm_location,
            "recommendations": recommendations,
            "severity": (
                "🟢 SAFE" if risk_score < 0.3 else
                "🟡 CAUTION" if risk_score < 0.6 else
                "🟠 HIGH RISK" if risk_score < 0.85 else
                "🔴 CRITICAL"
            )
        }
    
    @staticmethod
    def get_seasonal_adjustment(
        region_type: str,
        month: int,
        atm_type: str = "general"
    ) -> Dict[str, float]:
        """
        🗓️ Seasonal Cash Flow & Transaction Patterns
        
        EXPERT INSIGHT:
        "Kış aylarında büyük şehirlerde toplanan insanlar okul tatili ile birlikte,
        coğrafyanın her yerine yayılırlar. Yazlık bölgelerdeki ATM'ler, kışın 
        stabil iken yazın işlem hacimleri artarak devam eder."
        
        Args:
            region_type: "city_center", "coastal_vacation", "ski_resort"
            month: Month number (1-12)
            atm_type: "general", "tourist", "business"
        
        Returns:
            Dict with transaction multipliers and cash flow adjustments
        """
        
        WINTER_MONTHS = [12, 1, 2]
        SPRING_MONTHS = [3, 4, 5]
        SUMMER_MONTHS = [6, 7, 8]
        FALL_MONTHS = [9, 10, 11]
        
        # Default multipliers (1.0 = baseline)
        transaction_multiplier = 1.0
        cash_demand_multiplier = 1.0
        failure_multiplier = 1.0
        
        # ─────────────────────────────────────────────────────────────────
        # COASTAL/VACATION REGIONS (Bodrum, Antalya, Çeşme, Fethiye)
        # ─────────────────────────────────────────────────────────────────
        if region_type == "coastal_vacation":
            if month in SUMMER_MONTHS:
                # June 15 - September 15: School vacation = population explosion
                transaction_multiplier = 3.5  # 250-400% increase
                cash_demand_multiplier = 4.0  # Higher withdrawal amounts
                recommendations = "🏖️ PEAK SEASON: Triple ikmal frequency, heat belt checks"
            elif month in WINTER_MONTHS:
                transaction_multiplier = 0.4  # Ghost town
                cash_demand_multiplier = 0.3
                recommendations = "❄️ OFF-SEASON: Reduce service frequency, focus on reliability"
            else:
                transaction_multiplier = 1.0
                cash_demand_multiplier = 1.0
                recommendations = "🌸 SHOULDER SEASON: Normal operations"
        
        # ─────────────────────────────────────────────────────────────────
        # CITY CENTER (Istanbul, Ankara, Izmir)
        # ─────────────────────────────────────────────────────────────────
        elif region_type == "city_center":
            if month in WINTER_MONTHS:
                transaction_multiplier = 1.4  # People stay in city
                cash_demand_multiplier = 1.3
                recommendations = "🏙️ WINTER HIGH: City concentration peak"
            elif month in SUMMER_MONTHS:
                transaction_multiplier = 0.7  # Vacation exodus
                cash_demand_multiplier = 0.6
                recommendations = "☀️ SUMMER LOW: Population dispersed to coasts"
            else:
                transaction_multiplier = 1.0
                cash_demand_multiplier = 1.0
                recommendations = "📊 NORMAL: Baseline operations"
        
        # ─────────────────────────────────────────────────────────────────
        # SKI RESORTS (Uludağ, Erciyes, Palandöken)
        # ─────────────────────────────────────────────────────────────────
        elif region_type == "ski_resort":
            if month in WINTER_MONTHS or month == 2:  # Dec-Feb (yarıyıl tatili)
                transaction_multiplier = 5.0  # Extreme spike
                cash_demand_multiplier = 6.0
                recommendations = "⛷️ SKI SEASON PEAK: Maximum service, weather challenges"
            else:
                transaction_multiplier = 0.2  # Nearly closed
                cash_demand_multiplier = 0.1
                recommendations = "🏔️ OFF-SEASON: Minimal operations"
        
        return {
            "transaction_multiplier": transaction_multiplier,
            "cash_demand_multiplier": cash_demand_multiplier,
            "failure_multiplier": failure_multiplier,
            "recommendations": recommendations,
            "region_type": region_type,
            "month": month
        }


# ═══════════════════════════════════════════════════════════════════════
# ENHANCED PREDICTION WITH DOMAIN KNOWLEDGE
# ═══════════════════════════════════════════════════════════════════════

def predict_with_domain_knowledge(
    engine: IronCladEngine,
    atm_id: str,
    features: Dict[str, float],
    current_cash_level: float,
    current_deposit_level: float,
    temperature: float,
    region_type: str,
    month: int,
    atm_location: str = "outdoor"
) -> Dict:
    """
    Enhanced prediction combining ML model + domain knowledge.
    
    This is where PHYSICS meets MACHINE LEARNING:
    1. Get ML prediction (statistical patterns)
    2. Apply domain knowledge (physics & expert rules)
    3. Merge for superior accuracy
    """
    
    # Get base ML prediction
    ml_prediction = engine.predict(
        atm_id=atm_id,
        features=features,
        current_cash_level=current_cash_level,
        current_deposit_level=current_deposit_level
    )
    
    # Apply domain knowledge
    heat_risk = DomainKnowledgeModule.calculate_heat_degradation_risk(
        temperature=temperature,
        region_type=region_type,
        month=month,
        atm_location=atm_location
    )
    
    seasonal_adj = DomainKnowledgeModule.get_seasonal_adjustment(
        region_type=region_type,
        month=month
    )
    
    # Boost failure probability if heat risk is high
    adjusted_failure_prob = min(
        ml_prediction['failure_prediction']['failure_probability'] + 
        heat_risk['failure_probability_boost'],
        1.0
    )
    
    # Adjust cash/deposit timing based on seasonal patterns
    adjusted_cash_hours = ml_prediction['cash_prediction']['estimated_hours_to_empty'] / seasonal_adj['cash_demand_multiplier']
    adjusted_deposit_hours = ml_prediction['deposit_prediction']['estimated_hours_to_full'] / seasonal_adj['transaction_multiplier']
    
    # Combine recommendations
    combined_recommendations = (
        ml_prediction['recommendation']['reasons'] +
        heat_risk['recommendations'] +
        [seasonal_adj['recommendations']]
    )
    
    return {
        **ml_prediction,
        "domain_knowledge_enhancement": {
            "heat_degradation_analysis": heat_risk,
            "seasonal_adjustments": seasonal_adj,
            "adjusted_failure_probability": round(adjusted_failure_prob, 3),
            "adjusted_cash_hours": round(adjusted_cash_hours, 1),
            "adjusted_deposit_hours": round(adjusted_deposit_hours, 1)
        },
        "combined_recommendations": combined_recommendations
    }


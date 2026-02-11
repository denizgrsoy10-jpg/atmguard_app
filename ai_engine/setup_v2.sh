#!/bin/bash

# IronClad Engine V2.0 - Quick Installation Script
# ATM Health Guardian - AI Team
# February 2026

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                                                                   ║"
echo "║         IRONCLAD ENGINE V2.0 - QUICK SETUP                       ║"
echo "║                                                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Check Python version
echo "🔍 Checking Python version..."
python3 --version

if [ $? -ne 0 ]; then
    echo "❌ Python 3 not found. Please install Python 3.10+"
    exit 1
fi

echo "✅ Python found"
echo ""

# Navigate to ai_engine directory
cd "$(dirname "$0")"
echo "📂 Working directory: $(pwd)"
echo ""

# Install dependencies
echo "📦 Installing dependencies (this may take 2-3 minutes)..."
echo "   - XGBoost (Kaggle Champion)"
echo "   - LightGBM (Microsoft Ultra-Fast)"
echo "   - CatBoost (Yandex Categorical Master)"
echo "   - Optuna (AutoML Hyperparameter Tuning)"
echo ""

pip3 install -q -r requirements.txt

if [ $? -ne 0 ]; then
    echo "❌ Installation failed. Check requirements.txt"
    exit 1
fi

echo "✅ All dependencies installed successfully!"
echo ""

# Run demo
echo "🎯 Running V2.0 Demo with synthetic data..."
echo "   (Training 3 models with Optuna optimization: ~2-5 min)"
echo ""

python3 demo_v2.py

if [ $? -eq 0 ]; then
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║                                                                   ║"
    echo "║         ✅ SETUP COMPLETE - V2.0 READY TO USE                    ║"
    echo "║                                                                   ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "📚 Next Steps:"
    echo "   1. Check README_V2.md for integration guide"
    echo "   2. Review trained models in ./models_v2_demo/"
    echo "   3. Integrate with production data pipeline"
    echo ""
else
    echo ""
    echo "⚠️  Demo failed. Check error messages above."
    exit 1
fi

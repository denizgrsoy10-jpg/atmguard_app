#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
#  ATM GUARD — TEK KOMUT KURULUM (Linux / macOS / WSL)
#
#  Banka sunucusunda program açıldıktan sonra:
#      bash setup.sh
#
#  Yapar:
#    1. Python venv oluşturur (ai_engine/.venv)
#    2. Beyin bağımlılıklarını kurar (requirements.txt)
#    3. (opsiyonel) Cash beyni ML stack'i kurar (requirements_ultra.txt)
#    4. Frontend bağımlılıklarını kurar (npm install)
#    5. .env yoksa .env.example'dan oluşturur
#    6. Preflight (hazırlık denetimi) çalıştırır
#
#  Windows için: KURULUM.md içindeki PowerShell adımlarını izleyin.
# ════════════════════════════════════════════════════════════════════════
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI="$ROOT/ai_engine"
ULTRA="${ULTRA:-0}"        # ULTRA=1 bash setup.sh → ağır ML stack de kurulur

echo "═══════════════════════════════════════════════════════════════"
echo "  ATM GUARD — KURULUM"
echo "═══════════════════════════════════════════════════════════════"

# ── 0) Python kontrol ────────────────────────────────────────────────────
if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ python3 bulunamadı. Python 3.10–3.12 kurun."
  exit 1
fi
echo "✅ $(python3 --version)"

# ── 1) venv ──────────────────────────────────────────────────────────────
if [ ! -d "$AI/.venv" ]; then
  echo "📦 venv oluşturuluyor: ai_engine/.venv"
  python3 -m venv "$AI/.venv"
fi
# shellcheck disable=SC1091
source "$AI/.venv/bin/activate"
python -m pip install --upgrade pip >/dev/null

# ── 2) Beyin bağımlılıkları ──────────────────────────────────────────────
echo "📦 Beyin bağımlılıkları kuruluyor (requirements.txt)..."
pip install -r "$AI/requirements.txt"

# ── 3) Cash beyni ML stack (opsiyonel) ───────────────────────────────────
if [ "$ULTRA" = "1" ]; then
  echo "📦 Cash beyni ML stack kuruluyor (requirements_ultra.txt)..."
  pip install -r "$AI/requirements_ultra.txt" || \
    echo "⚠️  Bazı ağır ML paketleri kurulamadı — cash beyni kısmi/kapalı çalışır (güvenli)."
else
  echo "ℹ️  Cash beyni ML stack atlandı. Tam mod için:  ULTRA=1 bash setup.sh"
fi

# ── 4) Frontend ──────────────────────────────────────────────────────────
if command -v npm >/dev/null 2>&1; then
  echo "📦 Frontend bağımlılıkları kuruluyor (npm install)..."
  (cd "$ROOT" && npm install)
else
  echo "⚠️  npm bulunamadı — frontend kurulumu atlandı (Node.js kurun)."
fi

# ── 5) .env ──────────────────────────────────────────────────────────────
if [ ! -f "$ROOT/.env" ] && [ -f "$ROOT/.env.example" ]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  echo "✅ .env oluşturuldu (.env.example'dan). Değerleri düzenleyin."
fi

# ── 6) Preflight ─────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  HAZIRLIK DENETİMİ (preflight)"
echo "═══════════════════════════════════════════════════════════════"
(cd "$AI" && python preflight_check.py) || true

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  KURULUM BİTTİ"
echo "  Beyin başlat :  cd ai_engine && source .venv/bin/activate && python api_server.py"
echo "  Frontend     :  npm run dev"
echo "═══════════════════════════════════════════════════════════════"

#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════╗
║  PREFLIGHT CHECK — "Her şey hazır mı?" denetleyici                        ║
║                                                                          ║
║  Banka sunucusunda program açıldıktan sonra TEK komutla sistemin         ║
║  çalışmaya hazır olup olmadığını kontrol eder. Hiçbir şeyi değiştirmez,  ║
║  sadece okur ve rapor verir.                                             ║
║                                                                          ║
║  KULLANIM:                                                               ║
║    cd ai_engine                                                          ║
║    python preflight_check.py                                             ║
║                                                                          ║
║  ÇIKIŞ KODU:                                                             ║
║    0 → kritik eksik yok (sistem çalışabilir)                             ║
║    1 → kritik eksik var (düzeltilmeli)                                   ║
║                                                                          ║
║  Çapraz platform: Windows / Linux / macOS (saf Python, ek bağımlılık     ║
║  gerektirmez).                                                           ║
╚══════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import importlib.util
import os
import platform
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent          # ai_engine/
ROOT = HERE.parent                              # repo kökü

# Sayaçlar
_sonuc = {"ok": 0, "warn": 0, "fail": 0}


def _yaz(durum: str, mesaj: str, detay: str = "") -> None:
    isaret = {"OK": "✅", "WARN": "⚠️ ", "FAIL": "❌"}.get(durum, "  ")
    satir = f"  {isaret} {mesaj}"
    if detay:
        satir += f"  —  {detay}"
    print(satir)
    if durum == "OK":
        _sonuc["ok"] += 1
    elif durum == "WARN":
        _sonuc["warn"] += 1
    elif durum == "FAIL":
        _sonuc["fail"] += 1


def _baslik(metin: str) -> None:
    print("\n" + "─" * 70)
    print(f"  {metin}")
    print("─" * 70)


def _dep_var(modul: str) -> bool:
    try:
        return importlib.util.find_spec(modul) is not None
    except (ImportError, ValueError):
        return False


# ───────────────────────────────────────────────────────────────────────────
# 1) Python sürümü
# ───────────────────────────────────────────────────────────────────────────

def kontrol_python() -> None:
    _baslik("1) Python Sürümü")
    v = sys.version_info
    surum = f"{v.major}.{v.minor}.{v.micro}"
    if v.major == 3 and 10 <= v.minor <= 12:
        _yaz("OK", f"Python {surum}", f"{platform.system()} {platform.machine()}")
    elif v.major == 3 and v.minor >= 13:
        _yaz("WARN", f"Python {surum}",
             "3.13+ — bazı ML kütüphaneleri (tensorflow/prophet) henüz uyumsuz olabilir; 3.10–3.12 önerilir")
    else:
        _yaz("FAIL", f"Python {surum}", "Python 3.10–3.12 gerekli")


# ───────────────────────────────────────────────────────────────────────────
# 2) Çekirdek bağımlılıklar (beyin API'sinin çalışması için ZORUNLU)
# ───────────────────────────────────────────────────────────────────────────

def kontrol_cekirdek_deps() -> None:
    _baslik("2) Çekirdek Bağımlılıklar (ZORUNLU — beyin API'si)")
    zorunlu = {
        "numpy":     "numpy",
        "fastapi":   "fastapi",
        "uvicorn":   "uvicorn",
        "pydantic":  "pydantic",
    }
    for ad, modul in zorunlu.items():
        if _dep_var(modul):
            _yaz("OK", f"{ad}")
        else:
            _yaz("FAIL", f"{ad}", "eksik → pip install -r requirements.txt")


# ───────────────────────────────────────────────────────────────────────────
# 3) SQL Feed Runner bağımlılıkları (canlı hortumlar için)
# ───────────────────────────────────────────────────────────────────────────

def kontrol_sql_deps() -> None:
    _baslik("3) SQL Feed Runner Bağımlılıkları (canlı hortumlar)")
    gerekli = {
        "sqlalchemy":  "sqlalchemy",
        "yaml":        "pyyaml",
        "requests":    "requests",
        "apscheduler": "apscheduler",
    }
    for modul, paket in gerekli.items():
        if _dep_var(modul):
            _yaz("OK", paket)
        else:
            _yaz("WARN", paket, "eksik → SQL feed runner çalışmaz (pip install)")
    # DB driver (en az biri)
    drivers = [d for d in ("oracledb", "pyodbc", "psycopg2", "sqlite3") if _dep_var(d)]
    if drivers:
        _yaz("OK", "DB driver", ", ".join(drivers))
    else:
        _yaz("WARN", "DB driver", "banka DB tipine göre kurulmalı (oracledb/pyodbc/psycopg2)")


# ───────────────────────────────────────────────────────────────────────────
# 4) Cash beyni (AI nakit tahmini) — OPSİYONEL, yoksa kural tabanlı çalışır
# ───────────────────────────────────────────────────────────────────────────

def kontrol_cash_deps() -> None:
    _baslik("4) Cash Beyni Bağımlılıkları (OPSİYONEL — yoksa kural tabanlı)")
    ml = {
        "xgboost":    "xgboost",
        "lightgbm":   "lightgbm",
        "catboost":   "catboost",
        "prophet":    "prophet",
        "tensorflow": "tensorflow",
        "optuna":     "optuna",
        "sklearn":    "scikit-learn",
        "pandas":     "pandas",
    }
    var = [p for m, p in ml.items() if _dep_var(m)]
    yok = [p for m, p in ml.items() if not _dep_var(m)]
    for m, p in ml.items():
        _yaz("OK" if _dep_var(m) else "WARN", p,
             "" if _dep_var(m) else "eksik → cash beyni kısmi/kapalı")
    if not yok:
        _yaz("OK", "Cash beyni TAM modda çalışabilir", "tüm ML kütüphaneleri mevcut")
    elif var:
        _yaz("WARN", "Cash beyni KISMİ modda", f"eksik: {', '.join(yok)} → requirements_ultra.txt")
    else:
        _yaz("WARN", "Cash beyni KAPALI", "ML yok → nakit kararları kural tabanlı (güvenli)")


# ───────────────────────────────────────────────────────────────────────────
# 5) Model ve veri dosyaları
# ───────────────────────────────────────────────────────────────────────────

def kontrol_dosyalar() -> None:
    _baslik("5) Model ve Veri Dosyaları")
    modeller = HERE / "models"
    for yol, etiket, kritik in [
        (modeller / "prophet_predictor" / "v1.0.0" / "model_maintenance.xgb", "Arıza modeli (maintenance)", False),
        (modeller / "prophet_predictor" / "v1.0.0" / "model_cash.xgb",        "Arıza modeli (cash)", False),
        (modeller / "v2",                                                     "v2 model dizini", False),
        (ROOT / "kasa_durum_raporu.json",                                     "Kasa raporu (cash beyni verisi)", False),
        (ROOT / "src" / "data" / "atm_master.json",                          "ATM master (frontend)", False),
    ]:
        if yol.exists():
            _yaz("OK", etiket, str(yol.relative_to(ROOT)))
        else:
            _yaz("WARN" if not kritik else "FAIL", etiket, f"bulunamadı: {yol}")


# ───────────────────────────────────────────────────────────────────────────
# 6) Beyin canlı yükleme testi (gerçek import + mini karar döngüsü)
# ───────────────────────────────────────────────────────────────────────────

def kontrol_beyin_calisir() -> None:
    _baslik("6) Beyin Canlı Test (import + mini karar döngüsü)")
    if not _dep_var("numpy"):
        _yaz("FAIL", "Beyin testi atlandı", "numpy yok")
        return
    try:
        sys.path.insert(0, str(HERE))
        import tempfile
        from datetime import datetime
        from atm_brain_orchestrator import ATMBrainOrchestrator

        b = ATMBrainOrchestrator(model_dir=tempfile.mkdtemp())
        b.ingest_terminal_tanim([{"terminal_id": "PF-1", "zone": 2}])
        b.ingest_ariza_feed([{
            "terminal_id": "PF-1", "tarih": datetime.now().isoformat(),
            "ariza_kodu": "PAPER_JAM", "aciklama": "x", "durum": "ACIK", "sure_dk": 30,
        }])
        b.ingest_bakiye_feed([{"terminal_id": "PF-1", "tl_bakiye": 40000,
                               "recycle_bakiye": 0, "yatan_para": 0}])
        kararlar = b.run_full_decision_cycle()
        _yaz("OK", "Karar döngüsü", f"{len(kararlar)} karar üretildi")

        v = b.hafiza_kaydet("preflight test")
        ok = (Path(b.model_dir) / "brain_memory.json").exists()
        _yaz("OK" if ok else "FAIL", "Hafıza yaz/oku", f"versiyon {v}")
    except Exception as e:
        _yaz("FAIL", "Beyin yüklenemedi", str(e))


# ───────────────────────────────────────────────────────────────────────────
# 7) Cash beyni canlı yükleme (veri + ML varsa)
# ───────────────────────────────────────────────────────────────────────────

def kontrol_cash_calisir() -> None:
    _baslik("7) Cash Beyni Canlı Test")
    if os.getenv("CASH_BRAIN_ENABLE", "1").lower() in ("0", "false", "no"):
        _yaz("WARN", "Cash beyni env ile kapalı", "CASH_BRAIN_ENABLE=0")
        return
    if not (HERE.parent / "kasa_durum_raporu.json").exists() and not os.getenv("CASH_BRAIN_DATA"):
        _yaz("WARN", "Cash beyni testi atlandı", "kasa_durum_raporu.json yok")
        return
    if not _dep_var("pandas"):
        _yaz("WARN", "Cash beyni testi atlandı", "pandas yok")
        return
    try:
        sys.path.insert(0, str(HERE))
        from atm_brain_orchestrator import ATMBrainOrchestrator
        b = ATMBrainOrchestrator(model_dir=str(HERE / "models"))
        engine = b._cash_motoru_yukle()
        if engine is not None:
            _yaz("OK", "Cash beyni yüklendi", "AI nakit tahmini aktif")
        else:
            _yaz("WARN", "Cash beyni yüklenemedi", "kural tabanlı moda düşülecek (güvenli)")
    except Exception as e:
        _yaz("WARN", "Cash beyni testi hata", f"{e} (sistem yine kural tabanlı çalışır)")


# ───────────────────────────────────────────────────────────────────────────
# 8) Ortam değişkenleri / .env
# ───────────────────────────────────────────────────────────────────────────

def kontrol_env() -> None:
    _baslik("8) Ortam Değişkenleri")
    env_dosya = ROOT / ".env"
    ornek = ROOT / ".env.example"
    if env_dosya.exists():
        _yaz("OK", ".env mevcut")
    elif ornek.exists():
        _yaz("WARN", ".env yok", "cp .env.example .env ile oluşturun")
    else:
        _yaz("WARN", ".env ve .env.example yok", "ortam değişkenleri varsayılanlarla çalışır")
    for ad, varsayilan in [
        ("BRAIN_PORT", "8000"),
        ("CASH_BRAIN_ENABLE", "1"),
        ("BANK_DB_URL", "(ayarlanmamış)"),
    ]:
        _yaz("OK", f"{ad}", os.getenv(ad, varsayilan))


# ───────────────────────────────────────────────────────────────────────────
# Ana akış
# ───────────────────────────────────────────────────────────────────────────

def main() -> int:
    print("\n" + "═" * 70)
    print("  ATM GUARD — PREFLIGHT CHECK (Hazırlık Denetimi)")
    print("═" * 70)

    kontrol_python()
    kontrol_cekirdek_deps()
    kontrol_sql_deps()
    kontrol_cash_deps()
    kontrol_dosyalar()
    kontrol_beyin_calisir()
    kontrol_cash_calisir()
    kontrol_env()

    print("\n" + "═" * 70)
    print(f"  SONUÇ:  ✅ {_sonuc['ok']} geçti   "
          f"⚠️  {_sonuc['warn']} uyarı   "
          f"❌ {_sonuc['fail']} kritik")
    print("═" * 70)
    if _sonuc["fail"] == 0:
        print("  ➤ Kritik eksik YOK. Sistem çalışabilir.")
        if _sonuc["warn"]:
            print("  ➤ Uyarılar opsiyonel/iyileştirme — engelleyici değil.")
        print()
        return 0
    print("  ➤ Kritik eksik(ler) var. Yukarıdaki ❌ satırlarını düzeltin.\n")
    return 1


if __name__ == "__main__":
    sys.exit(main())

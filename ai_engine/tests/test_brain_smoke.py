"""
╔══════════════════════════════════════════════════════════════════════════╗
║  BEYIN SMOKE TEST SETİ                                                    ║
║  Banka içine girmeden önce temel güvence — bozulma erken yakalansın.      ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  ÇALIŞTIRMA:                                                             ║
║    cd ai_engine                                                          ║
║    python -m pytest tests/ -v          (pytest varsa)                    ║
║    python tests/test_brain_smoke.py    (pytest yoksa — düz çalışır)      ║
║                                                                          ║
║  Bu testler ağır ML kütüphanesi (xgboost/torch) gerektirmez; sadece     ║
║  numpy ile orchestrator'ı kullanır.                                      ║
╚══════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import os
import sys
import tempfile
import threading
from datetime import datetime, timedelta
from pathlib import Path

# Kural tabanlı testler deterministik olsun: cash beynini varsayılan kapat.
# (Cash beyni fallback davranışı ayrı testte CASH_BRAIN_ENABLE açılarak sınanır.)
os.environ.setdefault("CASH_BRAIN_ENABLE", "0")

# ai_engine kökünü import yoluna ekle (tests/ alt dizininden çalışınca)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from atm_brain_orchestrator import ATMBrainOrchestrator, atomik_json_yaz  # noqa: E402


def _yeni_beyin() -> ATMBrainOrchestrator:
    return ATMBrainOrchestrator(model_dir=tempfile.mkdtemp())


# ───────────────────────────────────────────────────────────────────────────
# 1) Feed'ler + karar döngüsü boş/dolu veride patlamamalı
# ───────────────────────────────────────────────────────────────────────────

def test_bos_karar_dongusu_patlamaz():
    b = _yeni_beyin()
    kararlar = b.run_full_decision_cycle()
    assert isinstance(kararlar, list)


def test_feed_ve_karar_uretir():
    b = _yeni_beyin()
    b.ingest_terminal_tanim([{"terminal_id": "T-1", "zone": 2}])
    b.ingest_ariza_feed([{
        "terminal_id": "T-1", "tarih": datetime.now().isoformat(),
        "ariza_kodu": "PAPER_JAM", "aciklama": "jam", "durum": "ACIK", "sure_dk": 30,
    }])
    b.ingest_bakiye_feed([{
        "terminal_id": "T-1", "tl_bakiye": 40000,
        "recycle_bakiye": 100000, "yatan_para": 0,
    }])
    kararlar = b.run_full_decision_cycle()
    assert len(kararlar) >= 1
    assert kararlar[0].terminal_id == "T-1"


# ───────────────────────────────────────────────────────────────────────────
# 2) Hafıza round-trip — kaydet → yeni beyin → yükle
# ───────────────────────────────────────────────────────────────────────────

def test_hafiza_round_trip():
    d = tempfile.mkdtemp()
    b = ATMBrainOrchestrator(model_dir=d)
    b.ingest_gecmis_ariza([{
        "terminal_id": "T-9", "ariza_kodu": "XFS_HW", "aciklama": "hw",
        "tarih": datetime.now().isoformat(), "service_type": "SLM",
    }])
    versiyon = b.hafiza_kaydet("test round-trip")
    assert versiyon
    assert (Path(d) / "brain_memory.json").exists()

    b2 = ATMBrainOrchestrator(model_dir=d)
    sonuc = b2.hafiza_yukle()
    assert sonuc.get("durum") == "yuklendi"


# ───────────────────────────────────────────────────────────────────────────
# 3) Atomik yazım — .tmp artığı kalmamalı, dosya geçerli JSON olmalı
# ───────────────────────────────────────────────────────────────────────────

def test_atomik_yazim_temiz():
    d = Path(tempfile.mkdtemp())
    hedef = d / "ornek.json"
    atomik_json_yaz(hedef, {"a": 1, "b": [1, 2, 3]})
    assert hedef.exists()
    assert not list(d.glob("*.tmp"))
    import json
    with open(hedef, encoding="utf-8") as f:
        veri = json.load(f)
    assert veri["a"] == 1


# ───────────────────────────────────────────────────────────────────────────
# 4) Snapshot al + geri yükle
# ───────────────────────────────────────────────────────────────────────────

def test_snapshot_al_ve_geri_yukle():
    d = tempfile.mkdtemp()
    b = ATMBrainOrchestrator(model_dir=d)
    b.ingest_gecmis_ariza([{
        "terminal_id": "T-5", "ariza_kodu": "JAM", "aciklama": "x",
        "tarih": datetime.now().isoformat(), "service_type": "FLM",
    }])
    v = b.snapshot_al("test snapshot")
    assert v
    liste = b.snapshot_listesi()
    assert any(s["versiyon"] == v for s in liste)
    geri = b.snapshot_yukle(v)
    assert geri.get("durum") == "geri_yuklendi"


# ───────────────────────────────────────────────────────────────────────────
# 5) Aktif arıza yaşlandırma — eski açık arıza temizlenir
# ───────────────────────────────────────────────────────────────────────────

def test_aktif_ariza_yaslandirma():
    b = _yeni_beyin()
    eski = (datetime.now() - timedelta(days=b._AKTIF_ARIZA_MAX_GUN + 3)).isoformat()
    taze = datetime.now().isoformat()
    b.ingest_ariza_feed([{
        "terminal_id": "T-1", "tarih": eski, "ariza_kodu": "OLD",
        "aciklama": "old", "durum": "ACIK", "sure_dk": 10,
    }])
    b.ingest_ariza_feed([{
        "terminal_id": "T-1", "tarih": taze, "ariza_kodu": "NEW",
        "aciklama": "new", "durum": "ACIK", "sure_dk": 10,
    }])
    kodlar = [e.ariza_kodu for e in b._aktif_arizalar.get("T-1", [])]
    assert "OLD" not in kodlar
    assert "NEW" in kodlar


def test_tekrar_eden_ariza_guncellenir():
    b = _yeni_beyin()
    taze = datetime.now().isoformat()
    b.ingest_ariza_feed([{
        "terminal_id": "T-1", "tarih": taze, "ariza_kodu": "JAM",
        "aciklama": "ilk", "durum": "ACIK", "sure_dk": 10,
    }])
    b.ingest_ariza_feed([{
        "terminal_id": "T-1", "tarih": taze, "ariza_kodu": "JAM",
        "aciklama": "guncel", "durum": "DEVAM_EDIYOR", "sure_dk": 99,
    }])
    olaylar = [e for e in b._aktif_arizalar["T-1"] if e.ariza_kodu == "JAM"]
    assert len(olaylar) == 1
    assert olaylar[0].sure_dk == 99
    assert olaylar[0].aciklama == "guncel"


# ───────────────────────────────────────────────────────────────────────────
# 6) Eşzamanlılık — paralel feed POST'ları state'i bozmamalı / crash etmemeli
# ───────────────────────────────────────────────────────────────────────────

def test_eszamanli_feed_guvenli():
    b = _yeni_beyin()

    def besle(n: int):
        for i in range(50):
            b.ingest_ariza_feed([{
                "terminal_id": f"T-{n}", "tarih": datetime.now().isoformat(),
                "ariza_kodu": f"CODE_{i}", "aciklama": "x",
                "durum": "ACIK", "sure_dk": 5,
            }])

    threadler = [threading.Thread(target=besle, args=(n,)) for n in range(8)]
    for t in threadler:
        t.start()
    for t in threadler:
        t.join()

    # 8 ATM, her biri 50 farklı kod → crash olmadan tutarlı sayı
    assert len(b._aktif_arizalar) == 8
    for n in range(8):
        assert len(b._aktif_arizalar[f"T-{n}"]) == 50


# ───────────────────────────────────────────────────────────────────────────
# 7) Cash beyni — kapalıyken/veri yokken güvenle kural tabanlı moda düşmeli
# ───────────────────────────────────────────────────────────────────────────

def test_cash_beyni_kapali_fallback():
    # Env ile kapalı: loader None dönmeli, karar yine üretilmeli
    os.environ["CASH_BRAIN_ENABLE"] = "0"
    b = _yeni_beyin()
    assert b._cash_motoru_yukle() is None
    assert b._cash_gunluk_tuketim_tahmin("T-X") is None
    b.ingest_bakiye_feed([{"terminal_id": "T-1", "tl_bakiye": 30000,
                           "recycle_bakiye": 0, "yatan_para": 0}])
    kararlar = b.run_full_decision_cycle()
    assert isinstance(kararlar, list)


def test_cash_beyni_veri_yoksa_fallback():
    # Açık ama veri dosyası kesinlikle yok → loader None (crash yok)
    os.environ["CASH_BRAIN_ENABLE"] = "1"
    os.environ["CASH_BRAIN_DATA"] = "/tmp/__yok_kasa_durum_raporu__.json"
    try:
        b = ATMBrainOrchestrator(model_dir=tempfile.mkdtemp())
        assert b._cash_veri_yolu() is None
        assert b._cash_motoru_yukle() is None
    finally:
        os.environ["CASH_BRAIN_ENABLE"] = "0"
        os.environ.pop("CASH_BRAIN_DATA", None)


# ───────────────────────────────────────────────────────────────────────────
# pytest yoksa düz çalıştırma
# ───────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    testler = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    gecen = 0
    for fn in testler:
        try:
            fn()
            print(f"  ✅ {fn.__name__}")
            gecen += 1
        except Exception as e:
            print(f"  ❌ {fn.__name__} — {e}")
    print(f"\n{gecen}/{len(testler)} test geçti.")
    sys.exit(0 if gecen == len(testler) else 1)

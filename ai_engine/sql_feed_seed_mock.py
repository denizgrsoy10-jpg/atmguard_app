#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SQL FEED — MOCK VERİ TOHUMLAYICI
═══════════════════════════════════════════════════════════════════════════

Gerçek banka DB'si olmadan SQL Feed Runner'ı test etmek için yerel bir
SQLite veritabanı (mock_bank.db) oluşturur ve örnek veriyle doldurur.

Tablolar, ai_engine/sql/*.sql sorgularının beklediği şemayla birebir aynıdır:
  atm_terminal   ← terminal_master.sql
  ariza_kayit    ← ariza_feed.sql
  atm_bakiye     ← bakiye_feed.sql
  gunson_kayit   ← gunson_batch.sql

Arıza ve bakiye satırları "şimdi"ye yakın zaman damgalarıyla yazılır; böylece
runner'ın 20 dk'lık :since penceresi onları yakalar. Günsonu satırları bugünün
tarihiyle yazılır.

Kullanım:
  python sql_feed_seed_mock.py
  BANK_DB_URL='sqlite:///./mock_bank.db' python sql_feed_runner.py --all-once --dry-run
"""
from __future__ import annotations

import datetime as dt
import os
import sqlite3
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


def _hedef_db() -> Path:
    """BANK_DB_URL sqlite ise onu, değilse ai_engine/mock_bank.db kullan."""
    url = os.environ.get("BANK_DB_URL", "")
    if url.startswith("sqlite:///"):
        raw = url.replace("sqlite:///", "", 1)
        p = Path(raw)
        if not p.is_absolute():
            p = (Path.cwd() / p).resolve()
        return p
    return BASE_DIR / "mock_bank.db"


# ── Örnek ATM parkı (4 ATM, farklı senaryolar) ─────────────────────────────
TERMINALLER = [
    # terminal_id, atm_adi, zone, konum_tipi, sube_personel_var, nakit_merkezi
    ("T-00123", "Kadıköy Merkez Şube ATM-1", 2, "Branch",  1, "İstanbul Anadolu CIT"),
    ("T-00456", "Kozyatağı AVM Offsite",     3, "Offsite", 0, "İstanbul Anadolu CIT"),
    ("T-00789", "Ankara Kızılay Şube ATM-2", 1, "Branch",  1, "Ankara CIT"),
    ("T-00999", "İzmir Bornova Offsite",     4, "Offsite", 0, "İzmir CIT"),
]


def seed(conn: sqlite3.Connection) -> None:
    now = dt.datetime.now()
    cur = conn.cursor()

    # ── Şema ──
    cur.executescript(
        """
        DROP TABLE IF EXISTS atm_terminal;
        DROP TABLE IF EXISTS ariza_kayit;
        DROP TABLE IF EXISTS atm_bakiye;
        DROP TABLE IF EXISTS gunson_kayit;

        CREATE TABLE atm_terminal (
            terminal_id       TEXT PRIMARY KEY,
            atm_adi           TEXT,
            zone              INTEGER,
            konum_tipi        TEXT,
            sube_personel_var INTEGER,
            nakit_merkezi     TEXT
        );
        CREATE TABLE ariza_kayit (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            terminal_id TEXT,
            tarih       TEXT,
            ariza_kodu  TEXT,
            aciklama    TEXT,
            durum       TEXT,
            sure_dk     INTEGER
        );
        CREATE TABLE atm_bakiye (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            terminal_id    TEXT,
            zaman          TEXT,
            tl_bakiye      INTEGER,
            kaset_1        INTEGER,
            kaset_2        INTEGER,
            kaset_3        INTEGER,
            kaset_4        INTEGER,
            recycle_bakiye INTEGER,
            yatan_para     INTEGER
        );
        CREATE TABLE gunson_kayit (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            terminal_id       TEXT,
            tarih             TEXT,
            sifirlama_yapildi INTEGER,
            ikmal_tutar       INTEGER,
            toplama_tutar     INTEGER,
            toplam_cekim      INTEGER,
            toplam_yatirma    INTEGER
        );
        """
    )

    # ── Terminal master ──
    cur.executemany(
        "INSERT INTO atm_terminal VALUES (?,?,?,?,?,?)", TERMINALLER
    )

    # ── Arıza kayıtları (son ~10 dk içinde → :since penceresi yakalar) ──
    def iso(dakika_once: int) -> str:
        return (now - dt.timedelta(minutes=dakika_once)).isoformat(timespec="seconds")

    arizalar = [
        # FLM tipi (Bantaş çözer): kağıt/jam
        ("T-00123", iso(8),  "PAPER_JAM",        "Fiş yuvası kağıt sıkışması",        "ACIK", 12),
        # SLM tipi (teknisyen gerekli): dispenser donanım
        ("T-00456", iso(6),  "DISPENSER_FAULT",  "Para verme ünitesi arızası",        "ACIK", 40),
        # Kronik aday: kart okuyucu tekrarı
        ("T-00789", iso(5),  "CARD_READER_ERR",  "Kart okuyucu okuma hatası",          "ACIK", 25),
        ("T-00789", iso(3),  "CARD_READER_ERR",  "Kart okuyucu yine hata verdi",       "DEVAM_EDIYOR", 30),
        # Kapanan arıza (bellekten temizlenmeli)
        ("T-00999", iso(2),  "PAPER_JAM",        "Kağıt sıkışması giderildi",          "KAPALI", 9),
    ]
    cur.executemany(
        "INSERT INTO ariza_kayit (terminal_id,tarih,ariza_kodu,aciklama,durum,sure_dk) "
        "VALUES (?,?,?,?,?,?)",
        arizalar,
    )

    # ── Bakiye kayıtları (son ~10 dk) ──
    bakiyeler = [
        # terminal, zaman, tl_bakiye, k1,k2,k3,k4, recycle, yatan
        ("T-00123", iso(7),  420000, 120000, 110000, 100000, 90000, 650000, 80000),
        ("T-00456", iso(7),   55000,  15000,  12000,  16000, 12000, 220000, 30000),  # düşük nakit
        ("T-00789", iso(7),  310000,  90000,  80000,  70000, 70000, 510000, 45000),
        ("T-00999", iso(7),  180000,  45000,  45000,  45000, 45000, 980000, 210000), # recycle dolu
    ]
    cur.executemany(
        "INSERT INTO atm_bakiye (terminal_id,zaman,tl_bakiye,kaset_1,kaset_2,kaset_3,"
        "kaset_4,recycle_bakiye,yatan_para) VALUES (?,?,?,?,?,?,?,?,?)",
        bakiyeler,
    )

    # ── Günsonu (bugün) ──
    gun = now.date().isoformat()
    gunsonlar = [
        # terminal, tarih, sifirlama, ikmal, toplama, cekim, yatirma
        ("T-00123", gun, 0, 500000,      0, 185000, 45000),
        ("T-00456", gun, 0,      0,      0, 240000, 12000),
        ("T-00789", gun, 1, 400000, 150000, 160000, 50000),
        ("T-00999", gun, 0,      0, 300000,  95000, 210000),
    ]
    cur.executemany(
        "INSERT INTO gunson_kayit (terminal_id,tarih,sifirlama_yapildi,ikmal_tutar,"
        "toplama_tutar,toplam_cekim,toplam_yatirma) VALUES (?,?,?,?,?,?,?)",
        gunsonlar,
    )

    conn.commit()


def main() -> int:
    hedef = _hedef_db()
    hedef.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(hedef))
    try:
        seed(conn)
        # Özet
        cur = conn.cursor()
        sayilar = {
            t: cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
            for t in ("atm_terminal", "ariza_kayit", "atm_bakiye", "gunson_kayit")
        }
    finally:
        conn.close()

    print(f"✅ Mock DB hazır: {hedef}")
    for t, n in sayilar.items():
        print(f"   {t:<14} {n} satır")
    print("\nSonraki adım:")
    print(f"  export BANK_DB_URL='sqlite:///{hedef}'")
    print("  python sql_feed_runner.py --all-once --dry-run")
    return 0


if __name__ == "__main__":
    sys.exit(main())

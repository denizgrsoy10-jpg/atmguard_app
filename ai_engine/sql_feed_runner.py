#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SQL FEED RUNNER — Banka SQL → Beyin "canlı hortumları"
═══════════════════════════════════════════════════════════════════════════

Banka veritabanındaki SQL sorgularını çalıştırır, dönen satırları beyin
API endpoint'lerine POST eder. Tamamen banka içinde / offline çalışır.

Yapılandırma:  config/feeds.yaml
SQL sorguları: sql/*.sql
Banka DB:      BANK_DB_URL  (ortam değişkeni, .env)
Beyin adresi:  BRAIN_URL    (ortam değişkeni; yoksa config default)

Kullanım:
  python sql_feed_runner.py --list                 # feed'leri listele
  python sql_feed_runner.py --once ariza_feed      # tek feed çalıştır
  python sql_feed_runner.py --all-once             # hepsini 1 kez çalıştır
  python sql_feed_runner.py --all-once --dry-run   # POST etmeden dene (test)
  python sql_feed_runner.py --schedule             # zamanlanmış sürekli çalış

Bağımlılıklar: sqlalchemy, pyyaml, requests, apscheduler  (requirements.txt)
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# ── Yumuşak bağımlılık kontrolü (anlaşılır hata mesajı ver) ────────────────
_EKSIK: List[str] = []
try:
    import yaml
except ImportError:
    _EKSIK.append("pyyaml")
try:
    import requests
except ImportError:
    _EKSIK.append("requests")
try:
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine import Engine
except ImportError:
    _EKSIK.append("sqlalchemy")

if _EKSIK:
    sys.stderr.write(
        "❌ Eksik bağımlılık: " + ", ".join(_EKSIK) + "\n"
        "   Kurulum: pip install -r requirements.txt\n"
    )
    sys.exit(2)

BASE_DIR        = Path(__file__).resolve().parent
DEFAULT_CONFIG  = BASE_DIR / "config" / "feeds.yaml"


# ── Yardımcılar ────────────────────────────────────────────────────────────
def _log(msg: str) -> None:
    ts = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def load_config(path: Path) -> Dict[str, Any]:
    if not path.exists():
        sys.stderr.write(f"❌ Yapılandırma yok: {path}\n")
        sys.exit(2)
    with open(path, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    if not cfg.get("feeds"):
        sys.stderr.write(f"❌ {path} içinde 'feeds' tanımı yok.\n")
        sys.exit(2)
    return cfg


def resolve_brain_url(cfg: Dict[str, Any]) -> str:
    d = cfg.get("defaults", {}) or {}
    env_name = d.get("brain_url_env", "BRAIN_URL")
    return os.environ.get(env_name) or d.get("brain_url_default", "http://localhost:8000")


def make_engine() -> "Engine":
    db_url = os.environ.get("BANK_DB_URL")
    if not db_url:
        sys.stderr.write(
            "❌ BANK_DB_URL tanımlı değil.\n"
            "   Örn (test): export BANK_DB_URL='sqlite:///./mock_bank.db'\n"
            "   Gerçek banka DB'si için .env / .env.example bakın.\n"
        )
        sys.exit(2)
    # pool_pre_ping: uzun süren --schedule modunda kopan bağlantıyı toparlar
    return create_engine(db_url, pool_pre_ping=True)


def feed_by_id(cfg: Dict[str, Any], feed_id: str) -> Optional[Dict[str, Any]]:
    for f in cfg["feeds"]:
        if f.get("id") == feed_id:
            return f
    return None


def build_params(feed: Dict[str, Any], now: Optional[dt.datetime] = None) -> Dict[str, Any]:
    """Feed'in 'params' listesinde istediği standart parametreleri üretir."""
    now = now or dt.datetime.now()
    istenen = feed.get("params") or []
    lookback = feed.get("lookback_minutes") or 20
    havuz = {
        "since": (now - dt.timedelta(minutes=lookback)).isoformat(timespec="seconds"),
        "gun":   now.date().isoformat(),
        "dun":   (now.date() - dt.timedelta(days=1)).isoformat(),
        "simdi": now.isoformat(timespec="seconds"),
    }
    return {k: havuz[k] for k in istenen if k in havuz}


def strip_sql_comments(sql: str) -> str:
    """
    SQL yorumlarını temizler. SQLAlchemy text() yorum içindeki ':' işaretlerini
    (örn. '14:30:00' veya ':since' açıklaması) yanlışlıkla bind parametresi sanar.
    Bunu önlemek için /* */ blok ve -- satır yorumlarını (tırnak dışındaysa) atarız.
    """
    sql = re.sub(r"/\*.*?\*/", "", sql, flags=re.S)
    temiz_satirlar: List[str] = []
    for satir in sql.splitlines():
        in_sq = False
        kes = None
        i = 0
        while i < len(satir):
            c = satir[i]
            if c == "'":
                in_sq = not in_sq
            elif c == "-" and not in_sq and i + 1 < len(satir) and satir[i + 1] == "-":
                kes = i
                break
            i += 1
        temiz_satirlar.append(satir if kes is None else satir[:kes])
    return "\n".join(temiz_satirlar)


def read_sql(feed: Dict[str, Any]) -> str:
    sql_path = BASE_DIR / feed["sql_file"]
    if not sql_path.exists():
        raise FileNotFoundError(f"SQL dosyası yok: {sql_path}")
    return strip_sql_comments(sql_path.read_text(encoding="utf-8"))


def _coerce_bool(val: Any) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return val != 0
    if isinstance(val, str):
        return val.strip().lower() in ("1", "true", "evet", "yes", "y", "t")
    return bool(val)


def _normalize_row(row: Dict[str, Any], bool_fields: List[str]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for k, v in row.items():
        # datetime/date → ISO string (JSON serileştirilebilir olsun)
        if isinstance(v, (dt.datetime, dt.date)):
            v = v.isoformat()
        out[k] = v
    for bf in bool_fields:
        if bf in out:
            out[bf] = _coerce_bool(out[bf])
    return out


def fetch_rows(engine: "Engine", feed: Dict[str, Any]) -> List[Dict[str, Any]]:
    sql = read_sql(feed)
    params = build_params(feed)
    bool_fields = feed.get("bool_fields") or []
    with engine.connect() as conn:
        result = conn.execute(text(sql), params)
        rows = [_normalize_row(dict(r._mapping), bool_fields) for r in result]
    return rows


def post_to_brain(
    brain_url: str,
    feed: Dict[str, Any],
    rows: List[Dict[str, Any]],
    timeout: int,
    batch_size: int,
) -> bool:
    endpoint = feed["endpoint"]
    payload_key = feed["payload_key"]
    url = brain_url.rstrip("/") + endpoint

    if batch_size and batch_size > 0:
        partlar = [rows[i:i + batch_size] for i in range(0, len(rows), batch_size)] or [[]]
    else:
        partlar = [rows]

    tum_basarili = True
    for i, part in enumerate(partlar, 1):
        body = {payload_key: part}
        try:
            r = requests.post(url, json=body, timeout=timeout)
            if r.status_code == 200:
                _log(f"   ✅ {feed['id']} batch {i}/{len(partlar)} ({len(part)} satır) → {endpoint}")
            else:
                tum_basarili = False
                _log(f"   ⚠️  {feed['id']} batch {i}: HTTP {r.status_code} — {r.text[:200]}")
        except requests.exceptions.RequestException as e:
            tum_basarili = False
            _log(f"   ❌ {feed['id']} batch {i}: beyne ulaşılamadı ({e})")
    return tum_basarili


def run_feed(
    engine: "Engine",
    cfg: Dict[str, Any],
    feed: Dict[str, Any],
    brain_url: str,
    dry_run: bool,
) -> bool:
    d = cfg.get("defaults", {}) or {}
    timeout = int(d.get("timeout_sec", 30))
    batch_size = int(d.get("batch_size", 500))

    _log(f"▶ {feed['id']} — {feed.get('aciklama', '')}")
    try:
        rows = fetch_rows(engine, feed)
    except Exception as e:
        _log(f"   ❌ SQL hatası ({feed['id']}): {e}")
        return False

    _log(f"   📊 {len(rows)} satır okundu (params: {build_params(feed) or '—'})")

    if dry_run:
        ornek = rows[0] if rows else {}
        _log(f"   🧪 DRY-RUN → POST {feed['endpoint']} (payload: {feed['payload_key']})")
        if ornek:
            _log(f"      örnek satır: {json.dumps(ornek, ensure_ascii=False)[:240]}")
        return True

    if not rows:
        _log(f"   ⏭  satır yok, POST atlanıyor")
        return True

    return post_to_brain(brain_url, feed, rows, timeout, batch_size)


# ── Komut modları ──────────────────────────────────────────────────────────
def cmd_list(cfg: Dict[str, Any]) -> int:
    brain_url = resolve_brain_url(cfg)
    print(f"\nBeyin: {brain_url}")
    print(f"Banka DB: {os.environ.get('BANK_DB_URL', '(tanımsız)')}\n")
    print(f"{'ID':<18} {'ENDPOINT':<28} {'ZAMANLAMA':<22} PARAMS")
    print("─" * 90)
    for f in cfg["feeds"]:
        sch = f.get("schedule", {})
        if sch.get("type") == "interval":
            sch_str = f"her {sch.get('minutes', '?')} dk"
        elif sch.get("type") == "cron":
            sch_str = f"cron {sch.get('hour', '*'):>2}:{sch.get('minute', 0):02d}"
        else:
            sch_str = "—"
        print(f"{f['id']:<18} {f['endpoint']:<28} {sch_str:<22} {f.get('params') or '[]'}")
    print()
    return 0


def cmd_once(cfg: Dict[str, Any], feed_id: str, dry_run: bool) -> int:
    feed = feed_by_id(cfg, feed_id)
    if not feed:
        sys.stderr.write(f"❌ feed bulunamadı: {feed_id}\n")
        return 2
    engine = make_engine()
    brain_url = resolve_brain_url(cfg)
    ok = run_feed(engine, cfg, feed, brain_url, dry_run)
    return 0 if ok else 1


def cmd_all_once(cfg: Dict[str, Any], dry_run: bool) -> int:
    engine = make_engine()
    brain_url = resolve_brain_url(cfg)
    _log(f"Tüm feed'ler çalıştırılıyor (dry_run={dry_run}) → beyin: {brain_url}")
    sonuc = [run_feed(engine, cfg, f, brain_url, dry_run) for f in cfg["feeds"]]
    basarili = sum(1 for s in sonuc if s)
    _log(f"Bitti: {basarili}/{len(sonuc)} feed başarılı")
    return 0 if basarili == len(sonuc) else 1


def cmd_schedule(cfg: Dict[str, Any], dry_run: bool) -> int:
    try:
        from apscheduler.schedulers.blocking import BlockingScheduler
        from apscheduler.triggers.interval import IntervalTrigger
        from apscheduler.triggers.cron import CronTrigger
    except ImportError:
        sys.stderr.write("❌ apscheduler eksik. pip install apscheduler\n")
        return 2

    engine = make_engine()
    brain_url = resolve_brain_url(cfg)
    tz = os.environ.get("TZ", "Europe/Istanbul")
    scheduler = BlockingScheduler(timezone=tz)

    for feed in cfg["feeds"]:
        sch = feed.get("schedule", {}) or {}
        stype = sch.get("type")
        if stype == "interval":
            trig = IntervalTrigger(minutes=int(sch.get("minutes", 15)))
        elif stype == "cron":
            trig = CronTrigger(hour=int(sch.get("hour", 0)), minute=int(sch.get("minute", 0)))
        else:
            _log(f"⚠️  {feed['id']}: bilinmeyen zamanlama, atlanıyor")
            continue
        scheduler.add_job(
            run_feed,
            trigger=trig,
            args=[engine, cfg, feed, brain_url, dry_run],
            id=feed["id"],
            name=feed["id"],
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )
        _log(f"🕒 zamanlandı: {feed['id']} ({stype})")

    _log(f"Scheduler başladı (TZ={tz}, dry_run={dry_run}). Durdurmak için Ctrl+C.")
    _log("İpucu: ilk dolum için önce 'python sql_feed_runner.py --all-once' çalıştırın.")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        _log("Scheduler durduruldu.")
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(
        description="SQL Feed Runner — banka SQL'lerini beyne besler.",
    )
    p.add_argument("--config", default=str(DEFAULT_CONFIG), help="feeds.yaml yolu")
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--list", action="store_true", help="feed'leri listele")
    g.add_argument("--once", metavar="FEED_ID", help="tek feed çalıştır")
    g.add_argument("--all-once", action="store_true", help="hepsini 1 kez çalıştır")
    g.add_argument("--schedule", action="store_true", help="zamanlanmış sürekli çalış")
    p.add_argument("--dry-run", action="store_true", help="POST etmeden dene (test)")
    args = p.parse_args(argv)

    cfg = load_config(Path(args.config))

    if args.list:
        return cmd_list(cfg)
    if args.once:
        return cmd_once(cfg, args.once, args.dry_run)
    if args.all_once:
        return cmd_all_once(cfg, args.dry_run)
    if args.schedule:
        return cmd_schedule(cfg, args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""
IDC Log Parser — ATM Guard
===========================
XFS IDC (Integrated Card Reader / Motorized Card Unit) vendor log parser.

Log Formatı:
  [YYYY-MM-DD HH:MM:SS.mmm] (0xTHREAD, 0xREQ_ID) WFS_CMD_IDC_<CMD> : <STATUS>

Komutlar:
  WFS_CMD_IDC_READ_RAW_DATA  — Kart bekleme + okuma (manyetik / chip)
  WFS_CMD_IDC_CHIP_IO        — EMV chip iletişimi
  WFS_CMD_IDC_EJECT_CARD     — Kart iade (müşteriye)
  WFS_CMD_IDC_RETAIN_CARD    — Kart yutma (ciddi arıza!)
  WFS_CMD_IDC_RESET          — Kart okuyucu reset

Başarılı kart işlemi döngüsü:
  READ_RAW_DATA:Send → READ_RAW_DATA:OK
  CHIP_IO:Send/OK × N  (EMV)
  EJECT_CARD:Send → EJECT_CARD:OK

İptal:
  READ_RAW_DATA:Send → WFSCancelAsyncRequest:Send (aynı req_id) → READ_RAW_DATA:Cancel

Kullanım:
  python3 idc_log_parser.py <logfile.txt>
  python3 idc_log_parser.py --json-only <logfile.txt>
"""

import re
import json
import sys
import os
from datetime import datetime
from typing import Dict, List, Optional

# ─────────────────────────────────────────────────────────────────────────────
# 1. EŞIK DEĞERLERİ (saniye)
# ─────────────────────────────────────────────────────────────────────────────
SLOW_READ_SEC       =   30   # 30–120s → Yavaş okuma (FLM: temizlik)
VERY_SLOW_READ_SEC  =  120   # 120–600s → Çok yavaş (FLM güçlü)
CRITICAL_READ_SEC   =  600   # >600s   → Kritik (SLM: değişim)

CANCEL_USER_SEC     =   60   # ≤60s cancel → kullanıcı iptali, normal
CANCEL_SLOW_SEC     =   60   # >60s cancel → timeout/sensör sorunu (FLM)
CANCEL_CRITICAL_SEC =  600   # >600s cancel → kritik timeout (SLM)

CANCEL_RATE_WARN    = 0.30   # >%30 → uyarı (FLM)
CANCEL_RATE_CRIT    = 0.60   # >%60 → kritik (SLM)

# ─────────────────────────────────────────────────────────────────────────────
# 2. HATA KODU TABLOLARI
# ─────────────────────────────────────────────────────────────────────────────
IDC_ERROR_DESCRIPTIONS = {
    "CRITICAL_SLOW_READ":      "Kritik yavaş kart okuma (>10 dk) — sensör/mekanik arızası",
    "VERY_SLOW_READ":          "Çok yavaş kart okuma (2–10 dk) — sensör kirliliği/yıpranma",
    "SLOW_READ":               "Yavaş kart okuma (30 sn–2 dk) — manyetik kafa kirliliği",
    "CRITICAL_TIMEOUT_CANCEL": "Kritik timeout iptali (>10 dk) — kart algılanamıyor",
    "TIMEOUT_CANCEL":          "Timeout iptali (1–10 dk) — kart okuyucu tepkisiz",
    "HIGH_CANCEL_RATE":        "Çok yüksek iptal oranı (>%60) — kart okuyucu ciddi arıza",
    "MODERATE_CANCEL_RATE":    "Orta iptal oranı (%30–60) — kart okuyucu temizlik gerekli",
    "CARD_RETAINED":           "Kart yutuldu — kart mekanizması arızası",
    "IDC_RESET":               "Kart okuyucu sıfırlandı — arıza sonrası reset",
    "IDC_HARDWARE_ERROR":      "Kart okuyucu donanım hatası (WFS_ERR)",
    "CHIP_IO_FAILURE":         "EMV chip iletişim hatası — chip okuyucu sorunu",
}

# FLM = Bantaş saha ekibi (temizlik, reset, kısmi bakım)
# SLM = Vendor teknisyen (donanım değişimi, kalibrasyon)
IDC_SERVICE_TYPE = {
    "CRITICAL_SLOW_READ":      "SLM",
    "VERY_SLOW_READ":          "FLM",
    "SLOW_READ":               "FLM",
    "CRITICAL_TIMEOUT_CANCEL": "SLM",
    "TIMEOUT_CANCEL":          "FLM",
    "HIGH_CANCEL_RATE":        "SLM",
    "MODERATE_CANCEL_RATE":    "FLM",
    "CARD_RETAINED":           "SLM",
    "IDC_RESET":               "FLM",
    "IDC_HARDWARE_ERROR":      "SLM",
    "CHIP_IO_FAILURE":         "SLM",
}

IDC_MODULE_MAP = {
    "CRITICAL_SLOW_READ":      "Kart Okuyucu Ünitesi — Manyetik Kafa + Chip Sensörü",
    "VERY_SLOW_READ":          "Kart Okuyucu — Manyetik Kafa / Optik Sensör Temizliği",
    "SLOW_READ":               "Kart Okuyucu — Manyetik Kafa Temizliği",
    "CRITICAL_TIMEOUT_CANCEL": "Kart Giriş Mekanizması — Motorlu Transport + Giriş Sensörü",
    "TIMEOUT_CANCEL":          "Kart Okuyucu — Giriş Sensörü / Transport Şeridi",
    "HIGH_CANCEL_RATE":        "Kart Okuyucu Ünitesi — IDC Modülü Komple Değişim",
    "MODERATE_CANCEL_RATE":    "Kart Okuyucu — Sensör + Transport Temizliği",
    "CARD_RETAINED":           "Kart Yutma Ünitesi — Retract/Capture Mekanizması",
    "IDC_RESET":               "Kart Okuyucu — Kontrol Kartı / Firmware",
    "IDC_HARDWARE_ERROR":      "Kart Okuyucu Ünitesi — Donanım",
    "CHIP_IO_FAILURE":         "EMV Chip Okuyucu — Kontakt Birimi",
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. LOG SATIRI REGEX
# ─────────────────────────────────────────────────────────────────────────────
LINE_RE = re.compile(
    r'\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(?:\.\d+)?\]'
    r'\s*\(([^,]+),\s*([^)]+)\)'
    r'\s+(\S+)'
    r'\s*:\s*(.+)'
)


def _parse_ts(s: str) -> Optional[datetime]:
    try:
        return datetime.strptime(s.strip()[:19], "%Y-%m-%d %H:%M:%S")
    except Exception:
        return None


def _fmt_duration(sec: float) -> str:
    if sec < 60:
        return f"{sec:.0f} sn"
    return f"{int(sec // 60)} dk {int(sec % 60)} sn"


def _duration_label(sec: float) -> str:
    if sec < SLOW_READ_SEC:
        return "normal"
    elif sec < VERY_SLOW_READ_SEC:
        return "slow"
    elif sec < CRITICAL_READ_SEC:
        return "very_slow"
    else:
        return "critical"


def _make_error(code: str, ts: Optional[datetime], extra: str = "") -> dict:
    desc = IDC_ERROR_DESCRIPTIONS.get(code, code)
    if extra:
        desc = f"{desc} — {extra}"
    return {
        "timestamp":    ts.isoformat() if ts else None,
        "error_code":   code,
        "description":  desc,
        "service_type": IDC_SERVICE_TYPE.get(code, "FLM"),
        "module":       IDC_MODULE_MAP.get(code, "Kart Okuyucu Ünitesi"),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. ANA PARSER
# ─────────────────────────────────────────────────────────────────────────────
def parse_idc_log(filepath: str) -> dict:
    """
    IDC log dosyasını okuyup tam günlük analiz objesi döndürür.
    """
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    lines = content.splitlines()

    # Log tarihi — ilk tarih damgasından
    log_date = None
    for line in lines[:10]:
        m = re.search(r'\[(\d{4}-\d{2}-\d{2})', line)
        if m:
            log_date = m.group(1)
            break

    # ATM ID — dosya adından çıkarmaya çalış (IDC260221_HWATM001.txt gibi)
    atm_id = "UNKNOWN"
    basename = os.path.basename(filepath)
    id_match = re.search(r'(?:IDC|idc)[_\-\s]?([A-Z0-9]{4,})', basename)
    if id_match and not id_match.group(1).isdigit():
        atm_id = id_match.group(1)

    # ── Tracking state ────────────────────────────────────────────────────────
    pending_reads: Dict[str, datetime] = {}    # req_id → start_ts
    card_sessions: List[dict] = []
    chip_io_total    = 0
    eject_count      = 0
    retain_count     = 0
    reset_count      = 0
    chip_fail_count  = 0
    hw_error_count   = 0
    active_chip_io   = 0   # chip_io sayacı — son read'den bu yana

    hourly: Dict[int, dict] = {
        h: {"sessions": 0, "ok": 0, "cancel": 0} for h in range(24)
    }

    for line in lines:
        line = line.strip()
        if not line:
            continue

        m = LINE_RE.match(line)
        if not m:
            continue

        ts_str, thread, req_id, command, status = m.groups()
        ts      = _parse_ts(ts_str)
        req_id  = req_id.strip()
        status  = status.strip()
        command = command.strip()

        # ── WFS_ERR check (her komut için) ────────────────────────────────────
        if "WFS_ERR" in status:
            hw_error_count += 1

        # ── Kart Okuma ────────────────────────────────────────────────────────
        if command == "WFS_CMD_IDC_READ_RAW_DATA":
            if status == "Send":
                pending_reads[req_id] = ts
                active_chip_io = 0
                if ts:
                    hourly[ts.hour]["sessions"] += 1

            elif status in ("OK", "Cancel"):
                start_ts = pending_reads.pop(req_id, None)
                duration = 0.0
                if start_ts and ts:
                    duration = max(0.0, (ts - start_ts).total_seconds())

                sess_status = "ok" if status == "OK" else "cancel"
                card_sessions.append({
                    "session_id":     req_id,
                    "start":          start_ts.isoformat() if start_ts else None,
                    "end":            ts.isoformat() if ts else None,
                    "status":         sess_status,
                    "duration_sec":   round(duration, 1),
                    "chip_io_count":  0,
                    "eject_ok":       False,
                    "duration_label": _duration_label(duration),
                })
                if ts:
                    if sess_status == "ok":
                        hourly[ts.hour]["ok"] += 1
                    else:
                        hourly[ts.hour]["cancel"] += 1

        # ── Chip IO ───────────────────────────────────────────────────────────
        elif command == "WFS_CMD_IDC_CHIP_IO":
            if status == "OK":
                chip_io_total += 1
                active_chip_io += 1
                if card_sessions:
                    card_sessions[-1]["chip_io_count"] = active_chip_io
            elif status not in ("Send",):
                chip_fail_count += 1

        # ── Kart İade ─────────────────────────────────────────────────────────
        elif command == "WFS_CMD_IDC_EJECT_CARD":
            if status == "OK":
                eject_count += 1
                active_chip_io = 0
                if card_sessions:
                    card_sessions[-1]["eject_ok"] = True

        # ── Kart Yutma (ciddi arıza) ──────────────────────────────────────────
        elif command == "WFS_CMD_IDC_RETAIN_CARD":
            if status == "OK":
                retain_count += 1

        # ── Reset ─────────────────────────────────────────────────────────────
        elif command == "WFS_CMD_IDC_RESET":
            if status == "OK":
                reset_count += 1

    # ── İstatistikler ─────────────────────────────────────────────────────────
    ok_sessions      = [s for s in card_sessions if s["status"] == "ok"]
    cancel_sessions  = [s for s in card_sessions if s["status"] == "cancel"]
    ok_count         = len(ok_sessions)
    cancel_count     = len(cancel_sessions)
    total_sessions   = len(card_sessions)

    cancel_rate = cancel_count / total_sessions if total_sessions > 0 else 0.0

    slow_reads       = [s for s in ok_sessions if s["duration_label"] == "slow"]
    very_slow_reads  = [s for s in ok_sessions if s["duration_label"] == "very_slow"]
    critical_reads   = [s for s in ok_sessions if s["duration_label"] == "critical"]

    timeout_cancels  = [s for s in cancel_sessions
                        if CANCEL_SLOW_SEC < s["duration_sec"] <= CANCEL_CRITICAL_SEC]
    critical_cancels = [s for s in cancel_sessions
                        if s["duration_sec"] > CANCEL_CRITICAL_SEC]

    ok_durations = [s["duration_sec"] for s in ok_sessions]
    avg_duration = sum(ok_durations) / len(ok_durations) if ok_durations else 0.0
    max_duration = max(ok_durations) if ok_durations else 0.0

    peak_hour = max(hourly, key=lambda h: hourly[h]["sessions"])

    # ── Hata listesi ──────────────────────────────────────────────────────────
    errors: List[dict] = []

    for s in critical_reads:
        errors.append(_make_error(
            "CRITICAL_SLOW_READ",
            _parse_ts(s["start"]) if s["start"] else None,
            _fmt_duration(s["duration_sec"])
        ))
    for s in very_slow_reads:
        errors.append(_make_error(
            "VERY_SLOW_READ",
            _parse_ts(s["start"]) if s["start"] else None,
            _fmt_duration(s["duration_sec"])
        ))
    for s in slow_reads:
        errors.append(_make_error(
            "SLOW_READ",
            _parse_ts(s["start"]) if s["start"] else None,
            _fmt_duration(s["duration_sec"])
        ))
    for s in critical_cancels:
        errors.append(_make_error(
            "CRITICAL_TIMEOUT_CANCEL",
            _parse_ts(s["start"]) if s["start"] else None,
            _fmt_duration(s["duration_sec"]) + " sonra iptal"
        ))
    for s in timeout_cancels:
        errors.append(_make_error(
            "TIMEOUT_CANCEL",
            _parse_ts(s["start"]) if s["start"] else None,
            _fmt_duration(s["duration_sec"]) + " sonra iptal"
        ))

    if cancel_rate > CANCEL_RATE_CRIT:
        errors.append(_make_error("HIGH_CANCEL_RATE", None,
                                  f"%{cancel_rate*100:.0f} iptal oranı"))
    elif cancel_rate > CANCEL_RATE_WARN:
        errors.append(_make_error("MODERATE_CANCEL_RATE", None,
                                  f"%{cancel_rate*100:.0f} iptal oranı"))

    for _ in range(retain_count):
        errors.append(_make_error("CARD_RETAINED", None))
    for _ in range(reset_count):
        errors.append(_make_error("IDC_RESET", None))
    for _ in range(chip_fail_count):
        errors.append(_make_error("CHIP_IO_FAILURE", None))
    for _ in range(hw_error_count):
        errors.append(_make_error("IDC_HARDWARE_ERROR", None))

    # ── Sağlık skoru ──────────────────────────────────────────────────────────
    health_score = _idc_health_score(
        card_sessions, retain_count, reset_count,
        chip_fail_count, hw_error_count
    )

    summary = {
        "log_type":               "IDC",
        "atm_id":                 atm_id,
        "log_date":               log_date,
        "source_file":            os.path.basename(filepath),
        "health_score":           health_score,
        # Session istatistikleri
        "total_sessions":         total_sessions,
        "ok_count":               ok_count,
        "cancel_count":           cancel_count,
        "retain_count":           retain_count,
        "reset_count":            reset_count,
        # Zamanlama analizi
        "slow_read_count":        len(slow_reads),
        "very_slow_count":        len(very_slow_reads),
        "critical_slow_count":    len(critical_reads),
        "timeout_cancel_count":   len(timeout_cancels),
        "critical_cancel_count":  len(critical_cancels),
        "avg_ok_duration_sec":    round(avg_duration, 1),
        "max_duration_sec":       round(max_duration, 1),
        "cancel_rate":            round(cancel_rate, 3),
        # Aktivite
        "chip_io_total":          chip_io_total,
        "eject_count":            eject_count,
        "peak_hour":              peak_hour,
        "hourly_volumes":         {str(k): v for k, v in hourly.items()},
        # Detay listeleri
        "card_sessions":          card_sessions,
        "errors":                 errors,
    }

    return summary


def _idc_health_score(sessions, retain_count, reset_count,
                      chip_fail, hw_err) -> int:
    score = 100

    for s in sessions:
        dur = s["duration_sec"]
        if s["status"] == "ok":
            if dur > CRITICAL_READ_SEC:
                score -= 20
            elif dur > VERY_SLOW_READ_SEC:
                score -= 8
            elif dur > SLOW_READ_SEC:
                score -= 3
        elif s["status"] == "cancel":
            if dur > CANCEL_CRITICAL_SEC:
                score -= 12
            elif dur > CANCEL_SLOW_SEC:
                score -= 4

    total   = len(sessions)
    cancels = sum(1 for s in sessions if s["status"] == "cancel")
    if total > 0:
        cr = cancels / total
        if cr > CANCEL_RATE_CRIT:
            score -= 20
        elif cr > CANCEL_RATE_WARN:
            score -= 8

    score -= min(retain_count * 25, 50)
    score -= min(reset_count  * 10, 20)
    score -= min(chip_fail    *  5, 15)
    score -= min(hw_err       * 15, 30)

    return max(0, min(100, score))


# ─────────────────────────────────────────────────────────────────────────────
# 5. RAPORLAMA (terminal çıktısı)
# ─────────────────────────────────────────────────────────────────────────────
def print_report(data: dict):
    R = "\033[0m"; B = "\033[1m"; C = "\033[36m"
    G = "\033[32m"; Y = "\033[33m"; RED = "\033[31m"

    hs = data["health_score"]
    hc = G if hs >= 80 else (Y if hs >= 50 else RED)

    print(f"\n{B}{'═'*60}{R}")
    print(f"{B}{C}  ATM GUARD — IDC LOG ANALİZ RAPORU{R}")
    print(f"{B}{'═'*60}{R}")
    print(f"  ATM ID      : {B}{data['atm_id']}{R}")
    print(f"  Tarih       : {data['log_date']}")
    print(f"  Kaynak      : {data['source_file']}")
    print(f"  Sağlık      : {hc}{B}{hs}/100{R}")

    print(f"\n{B}  ── KART OKU İSTATİSTİKLERİ ──{R}")
    print(f"  Toplam Oturum : {data['total_sessions']}")
    print(f"  Başarılı      : {G}{data['ok_count']}{R}")
    print(f"  İptal         : {RED}{data['cancel_count']}{R}  (oran: %{data['cancel_rate']*100:.0f})")
    print(f"  Kart Yutma    : {data['retain_count']}")
    print(f"  Reset         : {data['reset_count']}")

    print(f"\n{B}  ── ZAMANLAMA ANALİZİ ──{R}")
    print(f"  Ort. Okuma Süresi : {data['avg_ok_duration_sec']:.1f} sn")
    print(f"  Maks. Okuma       : {data['max_duration_sec']:.1f} sn")
    print(f"  Yavaş (>30s)      : {Y}{data['slow_read_count']}{R}")
    print(f"  Çok Yavaş (>2dk)  : {Y}{data['very_slow_count']}{R}")
    print(f"  Kritik (>10dk)    : {RED}{data['critical_slow_count']}{R}")
    print(f"  Timeout İptal     : {RED}{data['timeout_cancel_count'] + data['critical_cancel_count']}{R}")
    print(f"  Chip IO Toplam    : {data['chip_io_total']}")

    if data["errors"]:
        print(f"\n{B}  ── ANOMALILER ──{R}")
        shown: Dict[str, int] = {}
        for e in data["errors"]:
            shown[e["error_code"]] = shown.get(e["error_code"], 0) + 1
        for code, cnt in shown.items():
            svc = IDC_SERVICE_TYPE.get(code, "FLM")
            svc_color = RED if svc == "SLM" else C
            print(f"  {Y}[{code}]{R} ×{cnt}  "
                  f"[{svc_color}{svc}{R}]  "
                  f"{IDC_ERROR_DESCRIPTIONS.get(code, '')}")

    print(f"\n{B}{'═'*60}{R}\n")


# ─────────────────────────────────────────────────────────────────────────────
# 6. CLI
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(
        description="XFS IDC kart okuyucu log dosyasını analiz eder"
    )
    ap.add_argument("logfile",     help="Log dosyası yolu (.txt)")
    ap.add_argument("--output",    "-o", help="JSON çıktı dosyası (opsiyonel)")
    ap.add_argument("--json-only", action="store_true",
                    help="Sadece JSON çıktısı ver (API modu)")
    args = ap.parse_args()

    if not os.path.exists(args.logfile):
        print(f"HATA: Dosya bulunamadı: {args.logfile}")
        sys.exit(1)

    data = parse_idc_log(args.logfile)

    if not args.json_only:
        print_report(data)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        if not args.json_only:
            print(f"✓ JSON kaydedildi: {args.output}")
    else:
        if args.json_only:
            print(json.dumps(data, ensure_ascii=False, indent=2))

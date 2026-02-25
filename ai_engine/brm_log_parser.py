"""
BRM Log Parser — ATM Guard
===========================
Hyosung / Nautilus BRM (Banknote Recycling Machine) vendor log parser.

Desteklenen log formatı:
  [YYYY-MM-DD HH:MM:SS.mmm] WFS_CMD_CIM_CASH_IN_END : Send/OK/ErrorCode
  [YYYY-MM-DD HH:MM:SS.mmm] CashInEnd-Sheets
  n5:0000 5:0000 n10:0000 n20:0000 n50:0000 n100:0001 n200:0011 ... NG:0000
  [YYYY-MM-DD HH:MM:SS.mmm] WFS_CMD_CDM_DISPENSE : Send/OK
  [YYYY-MM-DD HH:MM:SS.mmm] Disp-Sheets
  n5:0000 ... n100:0001 n200:0011 ... NG:0000

Kullanım:
  python brm_log_parser.py <log_dosyası.txt>
  python brm_log_parser.py <log_dosyası.txt> --output <cikti.json>
"""

import re
import json
import sys
import os
from datetime import datetime
from typing import Dict, List, Optional, Tuple


# ──────────────────────────────────────────────────────────────
# 1. BANKNOT NOMİNAL HARİTASI  (TRY)
# ──────────────────────────────────────────────────────────────
# Key: XFS note type tag  →  Value: TRY nominal değeri
DENOMINATION_MAP: Dict[str, int] = {
    # Yeni seri (n prefix)
    "n5":   5,    "n10":  10,   "n20":  20,
    "n50":  50,   "n100": 100,  "n200": 200,
    # Normal
    "5":    5,    "10":   10,   "20":   20,
    "50":   50,   "100":  100,  "200":  200,
    # Eski seri (o prefix)
    "o1":   1,    "o2":   2,
    "o5":   5,    "o10":  10,   "o20":  20,
    "o50":  50,   "o100": 100,  "o200": 200,
    "o500": 500,
    # Reddedilen (No Good) — sayılır ama değer sıfır
    "NG":   0,
}

# ──────────────────────────────────────────────────────────────
# 2. HATA KODU TABLOSU
# ──────────────────────────────────────────────────────────────
ERROR_DESCRIPTIONS = {
    "5F0000D":  "Banknot doğrulama hatası (uygunsuz/şüpheli banknot)",
    "5678022":  "Shutter / transport sıkışması (Jam)",
    "5720000":  "Retract hatası (banknot yutma motoru)",
    "564FFF2":  "CashIn End hatası (işlem tamamlanamadı)",
    "5678000":  "CIM genel transport hatası",
    "567800A":  "Double-detect / çift banknot algılama",
    "5F00130":  "Validator sensör hatası (okuma/kalibrasyon)",
}

# Servis tipi haritası — hangi ekip gitmelidir?
# FLM : Bantaş saha ekibi (fiziksel temizlik, sıkışma açma, kağıt değişimi)
# SLM : Vendor teknik servis (hardware arızası — motor, sensör, nakit modülü)
BRM_SERVICE_TYPE = {
    "5720000": "SLM",   # Retract motoru = nakit modülü hardware arızası
    "5F0000D": "SLM",   # Validator sensörü = hassas optik donanım
    "5F00130": "SLM",   # Validator ailesi
    "5678022": "FLM",   # Shutter/transport sıkışması = FLM açar
    "564FFF2": "FLM",   # CashIn End = işlem hatası, FLM reset
    "5678000": "FLM",   # Genel transport = FLM
    "567800A": "FLM",   # Double-detect = hizalama/kağıt sorunu, FLM
}

# Fiziksel müdahale bölgesi — teknisyen ATM içinde neye bakacak?
BRM_MODULE_MAP = {
    "5720000": "Retract Ünitesi — Banknot Yutma Motoru",
    "5F0000D": "Banknot Validator — Optik Okuyucu / UV Sensörü",
    "5F00130": "Banknot Validator — Kalibrasyon / İkincil Sensör",
    "5678022": "CIM Transport / Shutter — Sürücü Bandı + Perde Mekanizması",
    "564FFF2": "CashIn İşlem Modülü — End Transaction Katmanı",
    "5678000": "CIM Transport — Genel Banknot Aktarma Bandı",
    "567800A": "Çift Banknot Algılayıcı — Double-Detect Sensörü",
}


# ──────────────────────────────────────────────────────────────
# 3. YARDIMCI FONKSİYONLAR
# ──────────────────────────────────────────────────────────────

def parse_sheet_string(raw: str) -> Tuple[Dict[str, int], int, int]:
    """
    'n5:0000 5:0000 ... n100:0001 n200:0011 ... NG:0003' formatındaki
    satırı ayrıştırır.

    Returns:
        notes_by_denom  : {denomination_str: count}   (100 → 3, 200 → 14 ...)
        total_try       : toplam TRY tutarı
        rejected        : reddedilen banknot adedi
    """
    notes_by_denom: Dict[str, int] = {}
    total_try = 0
    rejected = 0

    tokens = raw.strip().split()
    for token in tokens:
        if ":" not in token:
            continue
        key, val_str = token.split(":", 1)
        key = key.strip()
        try:
            count = int(val_str.strip())
        except ValueError:
            continue

        if count == 0:
            continue

        if key == "NG":
            rejected += count
            continue

        denom = DENOMINATION_MAP.get(key)
        if denom is None:
            continue  # bilinmeyen tip — atla

        total_try += denom * count

        # denomination → count topla (aynı değer, farklı tip)
        denom_key = str(denom)
        notes_by_denom[denom_key] = notes_by_denom.get(denom_key, 0) + count

    return notes_by_denom, total_try, rejected


def extract_atm_id(lines: List[str]) -> str:
    """
    İkinci satırdan ATM ID'yi çıkarır.
    Format:  ????=HWBRMSAE410019P1   (baştaki non-ASCII karakterler = soket header)
    """
    for line in lines[:5]:
        match = re.search(r'=([A-Z0-9]+)$', line.strip())
        if match:
            return match.group(1)
        # Alternatif: sadece alfanumerik uzun string
        clean = re.sub(r'[^\x20-\x7E]', '', line).strip()
        match2 = re.search(r'=?([A-Z]{2,}[A-Z0-9]{6,})', clean)
        if match2:
            return match2.group(1)
    return "UNKNOWN"


def ts_to_datetime(ts_str: str) -> Optional[datetime]:
    """'[2026-02-23 01:23:55.487]' → datetime"""
    match = re.search(r'\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})', ts_str)
    if match:
        return datetime.strptime(match.group(1), "%Y-%m-%d %H:%M:%S")
    return None


# ──────────────────────────────────────────────────────────────
# 4. ANA PARSER
# ──────────────────────────────────────────────────────────────

def parse_brm_log(filepath: str) -> dict:
    """
    BRM log dosyasını okuyup tam günlük analiz objesi döndürür.
    """
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        raw_content = f.read()

    lines = raw_content.splitlines()

    atm_id = extract_atm_id(lines)
    log_date = None

    # İlk tarih damgasını bul
    for line in lines[:10]:
        dt = ts_to_datetime(line)
        if dt:
            log_date = dt.strftime("%Y-%m-%d")
            break

    # ─── İşlem listesi (CashIn + Dispense) ───
    cashin_sessions: List[dict] = []   # Para yatırma
    dispense_txns:   List[dict] = []   # Para çekme
    errors:          List[dict] = []   # Hatalar

    # Satırları sırayla tara
    i = 0
    while i < len(lines):
        line = lines[i]

        # ── CashInEnd-Sheets ──
        if "CashInEnd-Sheets" in line:
            # Bir sonraki satır note dizesi
            sheet_line = ""
            j = i + 1
            while j < len(lines) and not sheet_line.strip():
                sheet_line += " " + lines[j]
                j += 1

            # Timestamp için geriye bak
            ts = None
            for k in range(i, max(i - 5, 0), -1):
                dt = ts_to_datetime(lines[k])
                if dt:
                    ts = dt.isoformat()
                    break

            notes, amount, rejected = parse_sheet_string(sheet_line)
            if amount > 0 or rejected > 0:
                cashin_sessions.append({
                    "timestamp": ts,
                    "operation": "cashin",
                    "amount_try": amount,
                    "notes": notes,
                    "rejected_count": rejected,
                })
            i = j
            continue

        # ── Disp-Sheets ──
        if "Disp-Sheets" in line:
            sheet_line = ""
            j = i + 1
            while j < len(lines) and not sheet_line.strip():
                sheet_line += " " + lines[j]
                j += 1

            ts = None
            for k in range(i, max(i - 5, 0), -1):
                dt = ts_to_datetime(lines[k])
                if dt:
                    ts = dt.isoformat()
                    break

            notes, amount, rejected = parse_sheet_string(sheet_line)
            if amount > 0:
                dispense_txns.append({
                    "timestamp": ts,
                    "operation": "dispense",
                    "amount_try": amount,
                    "notes": notes,
                    "rejected_count": rejected,
                })
            i = j
            continue

        # ── ErrorCode ──
        if "ErrorCode" in line and re.search(r'ErrorCode\s+[0-9A-Fa-f]+', line):
            match = re.search(r'ErrorCode\s+([0-9A-Fa-f]+)', line)
            cmd_match = re.search(r'WFS_CMD_\S+', line)
            ts_match = ts_to_datetime(line)
            if match:
                code = match.group(1).upper()
                errors.append({
                    "timestamp": ts_match.isoformat() if ts_match else None,
                    "command": cmd_match.group(0) if cmd_match else "UNKNOWN",
                    "error_code": code,
                    "description": ERROR_DESCRIPTIONS.get(code, f"Bilinmeyen hata kodu: {code}"),
                    "service_type": BRM_SERVICE_TYPE.get(code, "FLM"),
                    "module": BRM_MODULE_MAP.get(code, f"Bilinmeyen Modül ({code})"),
                })

        i += 1

    # ─── Günlük Özet ───
    total_cashin   = sum(s["amount_try"] for s in cashin_sessions)
    total_dispense = sum(d["amount_try"] for d in dispense_txns)
    total_rejected = sum(s["rejected_count"] for s in cashin_sessions)
    total_rejected += sum(d["rejected_count"] for d in dispense_txns)

    net_flow = total_cashin - total_dispense  # pozitif = ATM'e nakit girdi

    # Saatlik dağılım (0-23)
    hourly: Dict[int, Dict[str, int]] = {h: {"cashin": 0, "dispense": 0} for h in range(24)}
    for s in cashin_sessions:
        if s["timestamp"]:
            h = datetime.fromisoformat(s["timestamp"]).hour
            hourly[h]["cashin"] += s["amount_try"]
    for d in dispense_txns:
        if d["timestamp"]:
            h = datetime.fromisoformat(d["timestamp"]).hour
            hourly[h]["dispense"] += d["amount_try"]

    # Zirve saat
    peak_hour = max(hourly, key=lambda h: hourly[h]["cashin"] + hourly[h]["dispense"])

    # Benzersiz hata kodları
    unique_errors = list({e["error_code"] for e in errors})

    summary = {
        "atm_id":            atm_id,
        "log_date":          log_date,
        "source_file":       os.path.basename(filepath),
        "cashin_count":      len(cashin_sessions),
        "dispense_count":    len(dispense_txns),
        "error_count":       len(errors),
        "total_cashin_try":  total_cashin,
        "total_dispense_try": total_dispense,
        "net_flow_try":      net_flow,
        "total_rejected_notes": total_rejected,
        "peak_hour":         peak_hour,
        "unique_error_codes": unique_errors,
        "health_score":      _health_score(len(errors), len(cashin_sessions) + len(dispense_txns), total_rejected),
        "hourly_volumes":    hourly,
        "cashin_sessions":   cashin_sessions,
        "dispense_transactions": dispense_txns,
        "errors":            errors,
    }

    return summary


def _health_score(error_count: int, total_txns: int, rejected: int) -> int:
    """
    0-100 sağlık skoru hesaplar.
    100 = mükemmel, 0 = kritik arıza
    """
    if total_txns == 0:
        return 50

    score = 100
    # Hata oranı etkisi
    error_rate = error_count / max(total_txns, 1)
    score -= min(int(error_rate * 200), 40)

    # Reddedilen banknot etkisi
    rejection_penalty = min(rejected // 5, 20)
    score -= rejection_penalty

    return max(score, 0)


# ──────────────────────────────────────────────────────────────
# 5. RAPORLAMA
# ──────────────────────────────────────────────────────────────

def print_report(data: dict):
    RESET  = "\033[0m"
    BOLD   = "\033[1m"
    CYAN   = "\033[36m"
    GREEN  = "\033[32m"
    YELLOW = "\033[33m"
    RED    = "\033[31m"

    def fmt_try(v: int) -> str:
        return f"₺{v:,.0f}"

    print(f"\n{BOLD}{'═'*60}{RESET}")
    print(f"{BOLD}{CYAN}  ATM GUARD — BRM LOG ANALİZ RAPORU{RESET}")
    print(f"{BOLD}{'═'*60}{RESET}")
    print(f"  ATM ID      : {BOLD}{data['atm_id']}{RESET}")
    print(f"  Tarih       : {data['log_date']}")
    print(f"  Kaynak      : {data['source_file']}")
    print(f"  Sağlık Skoru: ", end="")
    hs = data["health_score"]
    color = GREEN if hs >= 80 else (YELLOW if hs >= 50 else RED)
    print(f"{color}{BOLD}{hs}/100{RESET}")
    print(f"\n{BOLD}  ── İŞLEM ÖZETİ ──{RESET}")
    print(f"  Para Yatırma  : {data['cashin_count']:>4} işlem   →  {GREEN}{fmt_try(data['total_cashin_try'])}{RESET}")
    print(f"  Para Çekme    : {data['dispense_count']:>4} işlem   →  {RED}{fmt_try(data['total_dispense_try'])}{RESET}")
    print(f"  Net Akış      :          {'+' if data['net_flow_try'] >= 0 else ''}{fmt_try(data['net_flow_try'])}")
    print(f"  Reddedilen    : {data['total_rejected_notes']} banknot")
    print(f"  Hata          : {data['error_count']} adet  ({', '.join(data['unique_error_codes']) or 'yok'})")
    print(f"  Zirve Saat    : {data['peak_hour']:02d}:00")

    print(f"\n{BOLD}  ── SAATLIK DAĞILIM ──{RESET}")
    for h in range(24):
        ci = data["hourly_volumes"][str(h) if str(h) in data["hourly_volumes"] else h]["cashin"]
        di = data["hourly_volumes"][str(h) if str(h) in data["hourly_volumes"] else h]["dispense"]
        if ci == 0 and di == 0:
            continue
        bar_ci = "█" * min(ci // 5000, 20)
        bar_di = "▒" * min(di // 5000, 20)
        print(f"  {h:02d}:00  IN {GREEN}{bar_ci:<20}{RESET} {fmt_try(ci):>12}  "
              f"OUT {RED}{bar_di:<20}{RESET} {fmt_try(di):>12}")

    if data["errors"]:
        print(f"\n{BOLD}  ── HATALAR ──{RESET}")
        shown = {}
        for e in data["errors"]:
            code = e["error_code"]
            if code not in shown:
                shown[code] = 0
            shown[code] += 1
        for code, cnt in shown.items():
            desc = ERROR_DESCRIPTIONS.get(code, "Bilinmeyen")
            print(f"  {YELLOW}[{code}]{RESET} × {cnt}  →  {desc}")

    print(f"\n{BOLD}{'═'*60}{RESET}\n")


# ──────────────────────────────────────────────────────────────
# 6. CLI
# ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Hyosung/Nautilus BRM log dosyasını analiz eder"
    )
    parser.add_argument("logfile", help="Log dosyası yolu (.txt)")
    parser.add_argument("--output", "-o", help="JSON çıktı dosyası (opsiyonel)")
    parser.add_argument("--json-only", action="store_true", help="Sadece JSON çıktısı ver")
    args = parser.parse_args()

    if not os.path.exists(args.logfile):
        print(f"HATA: Dosya bulunamadı: {args.logfile}")
        sys.exit(1)

    data = parse_brm_log(args.logfile)

    if not args.json_only:
        print_report(data)

    # JSON çıktısı
    # hourly_volumes içindeki int key'leri str'e çevir (JSON uyumu)
    data["hourly_volumes"] = {str(k): v for k, v in data["hourly_volumes"].items()}

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"✓ JSON çıktısı kaydedildi: {args.output}")
    else:
        if args.json_only:
            print(json.dumps(data, ensure_ascii=False, indent=2))

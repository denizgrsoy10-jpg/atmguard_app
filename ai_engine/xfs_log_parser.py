"""
XFS Application Log Parser — ATM Guard
=======================================
Finansbank / GRG ATM uygulama logu (All.txt / XFS log) formatını okur,
ATM bazında sağlık durumunu analiz eder ve beyne beslenecek özet üretir.

Format: Tab-separated, 17 kolon
─────────────────────────────────────────────────────────────────────────
 0  log_record_id       → 2026030918022592410
 1  terminal_id         → 7851          ← ATM numarası (anahtar alan)
 2  session_id          → 8962892393
 3  log_timestamp       → 2026-03-09 10:12:13.917
 4  event_timestamp     → 2026-03-09 10:07:28.815
 5  message_type        → 21            ← 20=cmd_start, 21=cmd_end,
                                           100=state, 110=screen_state,
                                           120=fdk_input, 200=host_req,
                                           210=host_resp, 240=svc_start,
                                           250=svc_end, 270=nav,
                                           400=screen_display, 420=fdk_press
 6  command_name        → WFS_CMD_PIN_GET_DATA / ng_Idle / state_code
 7  result_code         → 0 (OK) | -4 (Canceled) | neg (Error)
 8  json_detail         → {...}  veya  NULL
 9  processed_timestamp → 2026-03-09 10:12:43.720
10  priority            → 2
11  sequence_id         → 3003206027
12  user                → FINANS\\T993310202$
13  server              → ATMPRDAPP08
14  thread_id           → 30845
15  session_type        → Card | None
16  guid                → f1ebcd80-...

Kullanım:
  python xfs_log_parser.py <log_dosyası.txt>
  python xfs_log_parser.py <log_dosyası.txt> --output sonuc.json
  python xfs_log_parser.py <log_dosyası.txt> --atm 7851
"""

from __future__ import annotations

import json
import re
import sys
import os
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple


# ─────────────────────────────────────────────────────────────────────────────
# MESAJ TİPİ HARİTASI
# ─────────────────────────────────────────────────────────────────────────────
MSG_TYPE = {
    "20":  "CMD_START",
    "21":  "CMD_END",
    "100": "STATE",
    "110": "SCREEN_STATE",
    "120": "FDK_INPUT",
    "200": "HOST_REQ",
    "210": "HOST_RESP",
    "240": "SVC_START",
    "250": "SVC_END",
    "270": "NAVIGATION",
    "400": "SCREEN_DISPLAY",
    "420": "FDK_PRESS",
}

# Hata sonuç kodları (result_code != 0 ve != -4)
RESULT_ERRORS = {
    "0":   "Success",
    "-4":  "Canceled",
    "-1":  "WFS_ERR_ALREADY_STARTED",
    "-2":  "WFS_ERR_CANCELED",
    "-5":  "WFS_ERR_TIMEOUT",
    "-10": "WFS_ERR_HARDWARE_ERROR",
    "-11": "WFS_ERR_USER_ERROR",
    "-17": "WFS_ERR_DEV_NOT_READY",
    "-22": "WFS_ERR_INVALID_COMMAND",
}

# Komut bazlı servis tipi — FLM mi SLM mi?
CMD_SERVICE_MAP = {
    "WFS_CMD_IDC_READ_RAWDATA":      "FLM",   # Kart okuyucu fiziksel sorun → FLM
    "WFS_CMD_IDC_RETAIN_CARD":       "FLM",   # Kart yutma
    "WFS_INF_IDC_STATUS":            "FLM",   # IDC durum
    "WFS_CMD_PIN_GET_DATA":          "FLM",   # PIN pad — klavye sorun
    "WFS_CMD_PIN_GET_PIN":           "FLM",   # PIN entry
    "WFS_CMD_CIM_CASH_IN_START":     "SLM",   # Cash-in modülü
    "WFS_CMD_CIM_CASH_IN":           "SLM",
    "WFS_CMD_CIM_CASH_IN_END":       "SLM",
    "WFS_CMD_CIM_RETRACT":           "SLM",
    "WFS_CMD_CDM_DISPENSE":          "SLM",   # Dispenser
    "WFS_CMD_CDM_PRESENT":           "SLM",
    "WFS_CMD_CDM_REJECT":            "SLM",
    "WFS_CMD_SIU_SET_GUIDLIGHTS":    "FLM",
    "WFS_CMD_PTR_PRINT_FORM":        "FLM",   # Yazıcı
    "WFS_CMD_PTR_RESET":             "FLM",
}

# Komut açıklamaları Türkçe
CMD_DESC_TR = {
    "WFS_CMD_IDC_READ_RAWDATA":   "Kart okuma (ham veri)",
    "WFS_CMD_IDC_RETAIN_CARD":    "Kart yutma",
    "WFS_INF_IDC_STATUS":         "Kart okuyucu durum sorgusu",
    "WFS_CMD_PIN_GET_DATA":       "PIN pad veri girişi",
    "WFS_CMD_PIN_GET_PIN":        "PIN girişi",
    "WFS_CMD_CIM_CASH_IN_START":  "Para yatırma başlat",
    "WFS_CMD_CIM_CASH_IN":        "Para yatırma",
    "WFS_CMD_CIM_CASH_IN_END":    "Para yatırma bitir",
    "WFS_CMD_CIM_RETRACT":        "Para geri al",
    "WFS_CMD_CDM_DISPENSE":       "Para çekme dağıt",
    "WFS_CMD_CDM_PRESENT":        "Para çekme sun",
    "WFS_CMD_CDM_REJECT":         "Para çekme ret",
    "WFS_CMD_PTR_PRINT_FORM":     "Fiş yazdır",
    "WFS_CMD_PTR_RESET":          "Yazıcı sıfırla",
}

# Ağır arıza göstergesi — buffer içinde bu stringler varsa HW sorun var
IDC_HW_ERROR_TOKENS = {"Hwerror", "HWERROR", "hwerror"}

# Eşikler
LATENCY_WARN_SEC    = 10.0   # log_time - event_time > 10sn → gecikmeli işleme
LATENCY_CRIT_SEC    = 30.0   # > 30sn → kritik gecikme
CANCEL_RATE_HIGH    = 0.40   # %40 üzeri iptal oranı → sorun işareti
IDLE_REPEAT_LIMIT   = 5      # Aynı session'da 5+ ng_Idle → ATM takılı


# ─────────────────────────────────────────────────────────────────────────────
# YARDIMCI FONKSİYONLAR
# ─────────────────────────────────────────────────────────────────────────────

def _parse_dt(s: str) -> Optional[datetime]:
    """Farklı timestamp formatlarını datetime'a çevirir."""
    if not s or s.strip() in ("NULL", "None", ""):
        return None
    s = s.strip()
    for fmt in (
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
    ):
        try:
            return datetime.strptime(s[:26], fmt)
        except ValueError:
            continue
    return None


def _latency_sec(log_ts: Optional[datetime], event_ts: Optional[datetime]) -> float:
    """log_timestamp - event_timestamp farkını saniye olarak döndürür."""
    if log_ts is None or event_ts is None:
        return 0.0
    diff = (log_ts - event_ts).total_seconds()
    return round(max(0.0, diff), 3)


def _has_hw_error(json_str: str) -> bool:
    """JSON detail buffer'ında IDC donanım hatası var mı?"""
    if not json_str or json_str.strip() in ("NULL", "None"):
        return False
    return any(tok in json_str for tok in IDC_HW_ERROR_TOKENS)


def _parse_json_safe(s: str) -> Optional[Dict]:
    try:
        return json.loads(s)
    except Exception:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# ANA PARSER SINIFI
# ─────────────────────────────────────────────────────────────────────────────

class XFSLogParser:
    """
    All.txt / XFS uygulama logu parser'ı.

    Tek kullanım:
        parser = XFSLogParser()
        result = parser.parse_file("All.txt")
        # ya da
        result = parser.parse_text(raw_text)
    """

    def __init__(self):
        self._reset()

    def _reset(self):
        # ATM bazlı istatistikler
        self._atm_stats: Dict[str, Dict] = defaultdict(lambda: {
            # Oturum sayaçları
            "total_rows":          0,
            "session_ids":         set(),
            "card_sessions":       0,

            # IDC (kart okuyucu)
            "idc_read_ok":         0,
            "idc_read_cancel":     0,
            "idc_read_error":      0,
            "idc_hw_error":        0,     # buffer'da Hwerror
            "idc_retain":          0,     # kart yutma
            "idc_offline":         False,

            # PIN pad
            "pin_get_ok":          0,
            "pin_get_cancel":      0,
            "pin_get_error":       0,
            "pin_entry_ok":        0,
            "pin_entry_cancel":    0,

            # Cash modülü
            "cashin_start":        0,
            "cashin_end_ok":       0,
            "cashin_end_error":    0,
            "dispense_ok":         0,
            "dispense_error":      0,

            # Yazıcı
            "print_ok":            0,
            "print_error":         0,

            # Host iletişim
            "host_req":            0,
            "host_resp_ok":        0,
            "host_resp_error":     0,

            # Idle / ekran
            "idle_count":          0,
            "screen_displays":     0,

            # Gecikme
            "latency_warn":        0,
            "latency_crit":        0,
            "max_latency_sec":     0.0,
            "total_latency_sec":   0.0,
            "latency_count":       0,

            # Zaman aralığı
            "first_event":         None,
            "last_event":          None,

            # Ham hata kayıtları (beyne beslenecek)
            "errors":              [],

            # Sunucu adı
            "server":              "",
        })

    def parse_file(self, filepath: str, atm_filter: Optional[str] = None) -> Dict:
        """Dosyayı okuyup parse eder."""
        with open(filepath, encoding="utf-8", errors="replace") as f:
            text = f.read()
        return self.parse_text(text, atm_filter=atm_filter)

    def parse_text(self, text: str, atm_filter: Optional[str] = None) -> Dict:
        """Ham metin string'ini parse eder."""
        self._reset()
        lines = text.splitlines()
        parsed = 0
        skipped = 0

        for line in lines:
            line = line.rstrip("\r\n")
            if not line.strip():
                continue
            try:
                self._parse_line(line, atm_filter)
                parsed += 1
            except Exception:
                skipped += 1

        return self._build_result(parsed, skipped)

    def _parse_line(self, line: str, atm_filter: Optional[str]):
        cols = line.split("\t")
        if len(cols) < 9:
            return

        # Kolon atamaları
        # 0:record_id, 1:terminal_id, 2:session_id, 3:log_ts, 4:event_ts,
        # 5:msg_type, 6:cmd_name, 7:result_code, 8:json_detail
        # 9:processed_ts, 10:priority, 11:seq_id, 12:user, 13:server,
        # 14:thread_id, 15:session_type, 16:guid
        terminal_id  = cols[1].strip()
        if not terminal_id:
            return
        if atm_filter and terminal_id != atm_filter:
            return

        session_id   = cols[2].strip() if len(cols) > 2 else ""
        log_ts_str   = cols[3].strip() if len(cols) > 3 else ""
        event_ts_str = cols[4].strip() if len(cols) > 4 else ""
        msg_type     = cols[5].strip() if len(cols) > 5 else ""
        cmd_name     = cols[6].strip() if len(cols) > 6 else ""
        result_str   = cols[7].strip() if len(cols) > 7 else "0"
        json_detail  = cols[8].strip() if len(cols) > 8 else ""
        server       = cols[13].strip() if len(cols) > 13 else ""
        session_type = cols[15].strip() if len(cols) > 15 else ""

        s = self._atm_stats[terminal_id]
        s["total_rows"] += 1
        if server:
            s["server"] = server

        # Oturum takibi
        if session_id:
            s["session_ids"].add(session_id)
        if session_type == "Card":
            s["card_sessions"] = len({
                sid for sid in s["session_ids"]
            })  # unique — gerçek sayım aşağıda

        # Zaman damgası
        log_ts   = _parse_dt(log_ts_str)
        event_ts = _parse_dt(event_ts_str)

        if event_ts:
            if s["first_event"] is None or event_ts < s["first_event"]:
                s["first_event"] = event_ts
            if s["last_event"] is None or event_ts > s["last_event"]:
                s["last_event"] = event_ts

        # Gecikme hesabı (msg_type 21 = komut bitti — en anlamlı gecikme ölçümü)
        if msg_type == "21" and log_ts and event_ts:
            lat = _latency_sec(log_ts, event_ts)
            if lat > 0:
                s["latency_count"]     += 1
                s["total_latency_sec"] += lat
                if lat > s["max_latency_sec"]:
                    s["max_latency_sec"] = lat
                if lat >= LATENCY_CRIT_SEC:
                    s["latency_crit"] += 1
                    self._add_error(s, terminal_id, event_ts_str, "LATENCY_CRITICAL",
                        f"Komut gecikmesi KRİTİK: {lat:.1f}sn — {cmd_name}",
                        "FLM", "Uygulama gecikmesi / CPU/ağ sorunu")
                elif lat >= LATENCY_WARN_SEC:
                    s["latency_warn"] += 1

        # ── IDC (Kart Okuyucu) ──────────────────────────────────────────────
        if "IDC" in cmd_name.upper():
            result = int(result_str) if result_str.lstrip("-").isdigit() else 0

            if "READ_RAWDATA" in cmd_name and msg_type == "21":
                hw_err = _has_hw_error(json_detail)
                if result == 0 and not hw_err:
                    s["idc_read_ok"] += 1
                elif result == -4:
                    s["idc_read_cancel"] += 1
                else:
                    s["idc_read_error"] += 1
                    self._add_error(s, terminal_id, event_ts_str,
                        f"IDC_READ_ERROR_{abs(result)}",
                        f"Kart okuma hatası: result={result}",
                        "FLM", "Kart okuyucu mekanik/optik sorun")
                if hw_err:
                    s["idc_hw_error"] += 1
                    self._add_error(s, terminal_id, event_ts_str,
                        "IDC_HW_ERROR",
                        "Kart okuyucu donanım hatası (Hwerror buffer'da)",
                        "FLM", "IDC kart okuyucu donanımı — fiziksel temizlik veya değişim")

            elif "RETAIN_CARD" in cmd_name:
                s["idc_retain"] += 1
                self._add_error(s, terminal_id, event_ts_str,
                    "IDC_RETAIN",
                    "Kart yutma işlemi gerçekleşti",
                    "FLM", "Kart okuyucu — yuttuğu kart birikmesi kontrol edilmeli")

            elif "INF_IDC_STATUS" in cmd_name and msg_type == "21":
                detail = _parse_json_safe(json_detail)
                if detail:
                    buf = detail.get("Buffer", {}) or {}
                    fw_device = (buf.get("fwDevice") or "").strip()
                    if fw_device and fw_device.lower() not in ("online", ""):
                        s["idc_offline"] = True
                        self._add_error(s, terminal_id, event_ts_str,
                            "IDC_OFFLINE",
                            f"Kart okuyucu offline: fwDevice={fw_device}",
                            "FLM", "IDC bağlantı/güç sorunu — FLM kontrol")

        # ── PIN Pad ─────────────────────────────────────────────────────────
        elif "PIN" in cmd_name.upper():
            result = int(result_str) if result_str.lstrip("-").isdigit() else 0

            if "GET_DATA" in cmd_name and msg_type == "21":
                if result == 0:
                    s["pin_get_ok"] += 1
                elif result == -4:
                    s["pin_get_cancel"] += 1
                else:
                    s["pin_get_error"] += 1
                    self._add_error(s, terminal_id, event_ts_str,
                        f"PIN_GET_ERROR_{abs(result)}",
                        f"PIN pad veri hatası: result={result}",
                        "FLM", "PIN klavye / EPP donanım sorunu")

            elif "GET_PIN" in cmd_name and msg_type == "21":
                if result == 0:
                    s["pin_entry_ok"] += 1
                elif result == -4:
                    s["pin_entry_cancel"] += 1
                else:
                    self._add_error(s, terminal_id, event_ts_str,
                        f"PIN_ENTRY_ERROR_{abs(result)}",
                        f"PIN girişi hatası: result={result}",
                        "SLM", "EPP (şifreleme modülü) donanım arızası")

        # ── Cash In (Para Yatırma) ───────────────────────────────────────────
        elif "CIM" in cmd_name.upper():
            result = int(result_str) if result_str.lstrip("-").isdigit() else 0
            if "CASH_IN_START" in cmd_name:
                s["cashin_start"] += 1
            elif "CASH_IN_END" in cmd_name and msg_type == "21":
                if result == 0:
                    s["cashin_end_ok"] += 1
                else:
                    s["cashin_end_error"] += 1
                    self._add_error(s, terminal_id, event_ts_str,
                        f"CASHIN_END_ERROR_{abs(result)}",
                        f"Para yatırma tamamlama hatası: result={result}",
                        "SLM", "Cash-in modülü / recycle mekanizması arızası")

        # ── Dispenser (Para Çekme) ───────────────────────────────────────────
        elif "CDM" in cmd_name.upper():
            result = int(result_str) if result_str.lstrip("-").isdigit() else 0
            if "DISPENSE" in cmd_name and msg_type == "21":
                if result == 0:
                    s["dispense_ok"] += 1
                else:
                    s["dispense_error"] += 1
                    self._add_error(s, terminal_id, event_ts_str,
                        f"DISPENSE_ERROR_{abs(result)}",
                        f"Para çekme hatası: result={result}",
                        "SLM", "Dispenser modülü — nakit bandı / motor arızası")

        # ── Yazıcı ──────────────────────────────────────────────────────────
        elif "PTR" in cmd_name.upper():
            result = int(result_str) if result_str.lstrip("-").isdigit() else 0
            if "PRINT" in cmd_name and msg_type == "21":
                if result == 0:
                    s["print_ok"] += 1
                else:
                    s["print_error"] += 1
                    self._add_error(s, terminal_id, event_ts_str,
                        f"PRINT_ERROR_{abs(result)}",
                        f"Yazıcı hatası: result={result}",
                        "FLM", "Fiş/kağıt yazıcı — kağıt tükenmiş veya sıkışma")

        # ── Host İletişimi ───────────────────────────────────────────────────
        elif msg_type == "200":
            s["host_req"] += 1
        elif msg_type == "210":
            detail = _parse_json_safe(json_detail)
            if detail:
                next_state = detail.get("NextState", "")
                fn_cmd = detail.get("FunctionCommand", "")
                # FunctionCommand 5 = Success, diğerleri hata kodu
                if str(fn_cmd) == "5":
                    s["host_resp_ok"] += 1
                else:
                    s["host_resp_error"] += 1
                    self._add_error(s, terminal_id, event_ts_str,
                        f"HOST_RESP_ERROR_FC{fn_cmd}",
                        f"Host yanıt hatası: FunctionCommand={fn_cmd}, NextState={next_state}",
                        "SLM", "Host/network iletişim hatası — ATMC veya banka host sorunu")

        # ── Idle / Ekran ─────────────────────────────────────────────────────
        elif msg_type == "400":
            s["screen_displays"] += 1
            if "idle" in cmd_name.lower():
                s["idle_count"] += 1

    def _add_error(self, s: Dict, terminal_id: str, timestamp: str,
                   error_code: str, description: str,
                   service_type: str, module: str):
        """Hata kaydı ekle — tekrar eden aynı kodu toplu say."""
        # Aynı hata kodu son 5 kayıtta varsa tekrar ekleme (gürültü azalt)
        recent = s["errors"][-5:]
        for r in recent:
            if r["error_code"] == error_code:
                r["count"] = r.get("count", 1) + 1
                return
        s["errors"].append({
            "terminal_id":  terminal_id,
            "timestamp":    timestamp,
            "error_code":   error_code,
            "description":  description,
            "service_type": service_type,
            "module":       module,
            "count":        1,
        })

    def _build_result(self, parsed_rows: int, skipped_rows: int) -> Dict:
        """ATM bazlı özet ve beyin için yapılandırılmış çıktı üret."""
        atm_results = []

        for terminal_id, s in self._atm_stats.items():
            # Unique session sayısı
            total_sessions = len(s["session_ids"])

            # İptal oranı (IDC odaklı)
            total_idc = s["idc_read_ok"] + s["idc_read_cancel"] + s["idc_read_error"]
            cancel_rate = (s["idc_read_cancel"] / total_idc) if total_idc > 0 else 0.0

            # PIN iptal oranı
            total_pin = s["pin_get_ok"] + s["pin_get_cancel"] + s["pin_get_error"]
            pin_cancel_rate = (s["pin_get_cancel"] / total_pin) if total_pin > 0 else 0.0

            # Ortalama gecikme
            avg_latency = (
                s["total_latency_sec"] / s["latency_count"]
                if s["latency_count"] > 0 else 0.0
            )

            # Sağlık skoru hesapla (0-100)
            health_score = self._calc_health(s, cancel_rate, avg_latency)

            # Tespit edilen sorunlar özeti
            sorunlar = self._ozetle_sorunlar(s, cancel_rate, pin_cancel_rate)

            # Beyin için öneri
            beyin_oneri = self._beyin_oneri(s, sorunlar, health_score)

            atm_results.append({
                "log_type":     "XFS",
                "terminal_id":  terminal_id,
                "server":       s["server"],
                "log_date":     s["first_event"].strftime("%Y-%m-%d") if s["first_event"] else None,
                "log_start":    s["first_event"].isoformat() if s["first_event"] else None,
                "log_end":      s["last_event"].isoformat() if s["last_event"] else None,
                "health_score": health_score,
                "total_rows":   s["total_rows"],
                "total_sessions": total_sessions,

                # IDC
                "idc_read_ok":      s["idc_read_ok"],
                "idc_read_cancel":  s["idc_read_cancel"],
                "idc_read_error":   s["idc_read_error"],
                "idc_hw_error":     s["idc_hw_error"],
                "idc_retain":       s["idc_retain"],
                "idc_offline":      s["idc_offline"],
                "idc_cancel_rate":  round(cancel_rate, 3),

                # PIN
                "pin_get_ok":       s["pin_get_ok"],
                "pin_get_cancel":   s["pin_get_cancel"],
                "pin_get_error":    s["pin_get_error"],
                "pin_cancel_rate":  round(pin_cancel_rate, 3),

                # Cash
                "cashin_ok":        s["cashin_end_ok"],
                "cashin_error":     s["cashin_end_error"],
                "dispense_ok":      s["dispense_ok"],
                "dispense_error":   s["dispense_error"],

                # Host
                "host_req":         s["host_req"],
                "host_resp_ok":     s["host_resp_ok"],
                "host_resp_error":  s["host_resp_error"],

                # Yazıcı
                "print_ok":         s["print_ok"],
                "print_error":      s["print_error"],

                # Gecikme
                "avg_latency_sec":  round(avg_latency, 2),
                "max_latency_sec":  round(s["max_latency_sec"], 2),
                "latency_warn_cnt": s["latency_warn"],
                "latency_crit_cnt": s["latency_crit"],

                # Idle
                "idle_count":       s["idle_count"],

                # Özet
                "sorunlar":         sorunlar,
                "beyin_oneri":      beyin_oneri,

                # Beyne beslenecek ham hatalar
                "errors":           s["errors"],
            })

        # ATM'leri sağlık skoruna göre sırala (en kötü önce)
        atm_results.sort(key=lambda x: x["health_score"])

        return {
            "log_type":     "XFS",
            "parsed_rows":  parsed_rows,
            "skipped_rows": skipped_rows,
            "atm_count":    len(atm_results),
            "atms":         atm_results,
        }

    def _calc_health(self, s: Dict, cancel_rate: float, avg_latency: float) -> int:
        """
        0-100 arası sağlık skoru.
        100 = mükemmel, 0 = kritik arıza.
        """
        score = 100

        # IDC sorunları
        if s["idc_offline"]:          score -= 40
        if s["idc_hw_error"] >= 5:    score -= 30
        elif s["idc_hw_error"] >= 1:  score -= 15
        if s["idc_read_error"] >= 3:  score -= 20
        elif s["idc_read_error"] >= 1:score -= 8
        if s["idc_retain"] >= 3:      score -= 15
        elif s["idc_retain"] >= 1:    score -= 5
        if cancel_rate >= 0.6:        score -= 20
        elif cancel_rate >= 0.4:      score -= 10

        # PIN sorunları
        if s["pin_get_error"] >= 3:   score -= 20
        elif s["pin_get_error"] >= 1: score -= 8

        # Cash sorunları
        if s["cashin_end_error"] >= 2:score -= 25
        elif s["cashin_end_error"] >= 1:score -= 12
        if s["dispense_error"] >= 2:  score -= 25
        elif s["dispense_error"] >= 1:score -= 12

        # Yazıcı
        if s["print_error"] >= 3:     score -= 10
        elif s["print_error"] >= 1:   score -= 4

        # Host iletişim
        if s["host_resp_error"] >= 5: score -= 20
        elif s["host_resp_error"] >= 2:score -= 10

        # Gecikme
        if s["latency_crit"] >= 3:    score -= 15
        elif s["latency_crit"] >= 1:  score -= 7
        if avg_latency >= LATENCY_CRIT_SEC: score -= 10

        return max(0, min(100, score))

    def _ozetle_sorunlar(self, s: Dict, idc_cancel_rate: float,
                         pin_cancel_rate: float) -> List[str]:
        """Tespit edilen sorunları insan okunabilir özet liste olarak döndür."""
        sorunlar = []
        if s["idc_offline"]:
            sorunlar.append("🔴 Kart okuyucu OFFLINE — derhal FLM müdahalesi")
        if s["idc_hw_error"] >= 1:
            sorunlar.append(f"🔴 Kart okuyucu donanım hatası: {s['idc_hw_error']} kez (Hwerror)")
        if s["idc_read_error"] >= 1:
            sorunlar.append(f"⚠️  Kart okuma hatası: {s['idc_read_error']} başarısız okuma")
        if s["idc_retain"] >= 1:
            sorunlar.append(f"⚠️  Kart yutma: {s['idc_retain']} kez — kart birikmesi riski")
        if idc_cancel_rate >= CANCEL_RATE_HIGH:
            sorunlar.append(f"⚠️  IDC yüksek iptal oranı: %{idc_cancel_rate*100:.0f}")
        if s["pin_get_error"] >= 1:
            sorunlar.append(f"⚠️  PIN pad hatası: {s['pin_get_error']} hata")
        if s["cashin_end_error"] >= 1:
            sorunlar.append(f"🔴 Para yatırma hatası: {s['cashin_end_error']} başarısız işlem")
        if s["dispense_error"] >= 1:
            sorunlar.append(f"🔴 Para çekme (dispenser) hatası: {s['dispense_error']} başarısız")
        if s["print_error"] >= 1:
            sorunlar.append(f"⚠️  Yazıcı hatası: {s['print_error']} kez")
        if s["host_resp_error"] >= 2:
            sorunlar.append(f"⚠️  Host iletişim hatası: {s['host_resp_error']} yanıt hatası")
        if s["latency_crit"] >= 1:
            sorunlar.append(
                f"⚠️  Kritik gecikme: {s['latency_crit']} kez > {LATENCY_CRIT_SEC}sn "
                f"(maks: {s['max_latency_sec']:.1f}sn)"
            )
        if not sorunlar:
            sorunlar.append("✅ Sorun tespit edilmedi")
        return sorunlar

    def _beyin_oneri(self, s: Dict, sorunlar: List[str], health_score: int) -> Dict:
        """Beyin için yapılandırılmış karar önerisi."""
        eylem = "IZLE"
        aciliyet = "DUSUK"
        servis = "FLM"
        sebepler = []

        # Kritik durumlar
        if s["idc_offline"] or s["dispense_error"] >= 2 or s["cashin_end_error"] >= 2:
            eylem = "SLM"
            aciliyet = "KRITIK"
            servis = "SLM"
            if s["idc_offline"]:
                sebepler.append("Kart okuyucu offline")
            if s["dispense_error"] >= 2:
                sebepler.append(f"Dispenser {s['dispense_error']} hata")
            if s["cashin_end_error"] >= 2:
                sebepler.append(f"CashIn {s['cashin_end_error']} hata")

        # Yüksek öncelik
        elif (s["idc_hw_error"] >= 3 or s["idc_read_error"] >= 3 or
              s["dispense_error"] >= 1 or s["cashin_end_error"] >= 1 or
              health_score < 50):
            eylem = "FLM"
            aciliyet = "YUKSEK"
            servis = "SLM" if (s["dispense_error"] >= 1 or s["cashin_end_error"] >= 1) else "FLM"
            sebepler = [s for s in sorunlar if "🔴" in s]

        # Orta öncelik
        elif (s["idc_hw_error"] >= 1 or s["idc_retain"] >= 2 or
              s["pin_get_error"] >= 2 or health_score < 70):
            eylem = "FLM"
            aciliyet = "ORTA"
            servis = "FLM"
            sebepler = [s for s in sorunlar if "⚠️" in s or "🔴" in s]

        return {
            "eylem":    eylem,
            "aciliyet": aciliyet,
            "servis":   servis,
            "sebepler": sebepler or sorunlar,
            "health_score": health_score,
        }


# ─────────────────────────────────────────────────────────────────────────────
# CLI KULLANIMI
# ─────────────────────────────────────────────────────────────────────────────

def main():
    import argparse
    ap = argparse.ArgumentParser(description="XFS Application Log Parser — ATM Guard")
    ap.add_argument("dosya", help="Log dosyası (All.txt)")
    ap.add_argument("--output", "-o", help="Çıktı JSON dosyası")
    ap.add_argument("--atm", help="Sadece bu ATM ID'yi analiz et")
    ap.add_argument("--pretty", action="store_true", help="Güzel formatlı JSON çıktı")
    args = ap.parse_args()

    if not os.path.exists(args.dosya):
        print(f"HATA: Dosya bulunamadı: {args.dosya}", file=sys.stderr)
        sys.exit(1)

    parser = XFSLogParser()
    result = parser.parse_file(args.dosya, atm_filter=args.atm)

    # Özet konsola yaz
    print(f"\n{'='*60}")
    print(f"  XFS LOG ANALİZ RAPORU")
    print(f"{'='*60}")
    print(f"  Okunan satır  : {result['parsed_rows']}")
    print(f"  Atlanan satır : {result['skipped_rows']}")
    print(f"  ATM sayısı    : {result['atm_count']}")
    print(f"{'='*60}")

    for atm in result["atms"]:
        print(f"\n  ATM {atm['terminal_id']} — Sağlık: {atm['health_score']}/100")
        print(f"  Sunucu: {atm['server']}  |  "
              f"Oturum: {atm['total_sessions']}  |  "
              f"Log: {atm['log_start']} → {atm['log_end']}")
        print(f"  Karar: {atm['beyin_oneri']['eylem']} ({atm['beyin_oneri']['aciliyet']})"
              f" — {atm['beyin_oneri']['servis']}")
        for sorun in atm["sorunlar"]:
            print(f"    {sorun}")

    print(f"\n{'='*60}\n")

    # JSON çıktı
    out = json.dumps(result, ensure_ascii=False,
                     indent=2 if args.pretty else None,
                     default=str)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(out)
        print(f"✅ Sonuç kaydedildi: {args.output}")
    else:
        print(out)


if __name__ == "__main__":
    main()

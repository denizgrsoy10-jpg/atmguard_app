#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════╗
║                     BANK DATA ADAPTER                                    ║
║              "Bankadan ne gelirse gelsin, biz çalışırız"                 ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  Banka hangi formatta veri gönderirse göndersin bu modül normalize eder. ║
║                                                                          ║
║  DESTEKLENEN FORMAT TİPLERİ:                                             ║
║  ─────────────────────────────────────────────────────────────────────   ║
║  1. FORMAT_A  → Bizim mevcut format (kasa_durum_raporu.json)             ║
║  2. FORMAT_B  → Banka "flat JSON" formatı                                ║
║  3. FORMAT_C  → Banka "nested/object" formatı                            ║
║  4. FORMAT_D  → CSV/Excel export formatı                                 ║
║  5. FORMAT_E  → XML/SOAP servisi çıktısı                                 ║
║  6. FORMAT_F  → Banka API REST response formatı                          ║
║                                                                          ║
║  ➤ Banka toplantısından format bilgisi geldiğinde sadece                 ║
║    FIELD_MAP_* sözlüğünü doldurun. Başka bir şey değiştirmeye            ║
║    gerek yok.                                                            ║
║                                                                          ║
║  ATM Guard Team — Şubat 2026                                             ║
║                                                                          ║
║  ✅ BANKA TOPLANTI NOTLARI (22 Şubat 2026):                              ║
║  ─────────────────────────────────────────────────────────────────────   ║
║  • ATM ID alanı  : 'terminal_id'  (onaylı)                              ║
║  • Kaset verisi  : Her kaset ayrı ayrı geliyor (onaylı)                 ║
║  • Arıza güncelleme: Her 15 dakikada bir (online/anlık)                 ║
║  • Nakit verisi  : Güncelleme sıklığı TBD (toplantıda netleşecek)       ║
╚══════════════════════════════════════════════════════════════════════════╝
"""

import json
import csv
import io
from datetime import datetime
from typing import Dict, List, Optional, Union, Any
from pathlib import Path


# ─────────────────────────────────────────────────────────────────────────────
# HEDEF ALAN ADLARI  (Bizim iç standardımız — motorlar bu alanları bekler)
# ─────────────────────────────────────────────────────────────────────────────

CANONICAL_FIELDS = {
    # Kimlik
    'ATM ID',           # Zorunlu — benzersiz ATM kodu
    'ATM Adı',          # ATM lokasyon adı
    'Zone',             # Bölge numarası

    # Nakit
    'TL Bakiye',        # Toplam TL bakiye
    'Recycle Bakiye',   # Recycle kaseti toplam

    # Kasetler (Dispenser)
    'Kaset 1', 'Kaset 2', 'Kaset 3', 'Kaset 4',
    'Kaset 5', 'Kaset 6', 'Kaset 7', 'Kaset 8',

    # Recycle kaseteleri
    'Recycle 200 TL', 'Recycle 100 TL',

    # Küpür bilgisi
    'TL Küpür',         # Örn: "200 TL 200 TL 100 TL 50 TL"
    'Döviz Küpür',
    'Tüm Küpürler',
    'Döviz',            # Örn: "USD" / "-"

    # Arıza
    'Arıza Açıklaması', # Örn: "CCDM JAM HATASI"
    'FLM Capable',      # True/False

    # Operasyon
    'Düzenli Para Toplama',  # "Var" / "Yok"

    # İşlem geçmişi (AI için)
    '1 Salı Çeken', '2 Çarşamba Çeken', '3 Perşembe Çeken', '4 Cuma Çeken',
    '5 Cumartesi Çeken', '6 Pazar Çeken', '7 Pazartesi Çeken', '8 Salı Çeken',
    '1 Salı Yatan', '2 Çarşamba Yatan', '3 Perşembe Yatan', '4 Cuma Yatan',
    '5 Cumartesi Yatan', '6 Pazar Yatan', '7 Pazartesi Yatan', '8 Salı Yatan',
}


# ─────────────────────────────────────────────────────────────────────────────
# ALAN HARİTALARI — Toplantıdan format bilgisi gelince burası doldurulur
# ─────────────────────────────────────────────────────────────────────────────

# FORMAT_A: Bizim mevcut format — normalizasyon gerekmez, passthrough
FIELD_MAP_A: Dict[str, str] = {}


# ═══════════════════════════════════════════════════════════════════════════
# FORMAT_BANK  ✅ ONAYLANMIŞ — 22 Şubat 2026 Banka Toplantısı
# ═══════════════════════════════════════════════════════════════════════════
# Bankadan onaylanan bilgiler:
#   • ATM kimliği   : 'terminal_id'
#   • Kaset verisi  : Her kaset ayrı alan (cassette_1 ... cassette_N)
#   • Arıza feed    : 15 dakikada bir güncelleniyor
#   • Kalan alanlar : Bir sonraki toplantıda netleşecek
# ───────────────────────────────────────────────────────────────────────────
FIELD_MAP_BANK: Dict[str, str] = {

    # ── KİMLİK (ONAYLANDI ✅) ──────────────────────────────────────────────
    'terminal_id':          'ATM ID',    # ✅ Banka onayladı
    'Terminal ID':          'ATM ID',    # Olası varyant (boşluklu)
    'Terminal Id':          'ATM ID',    # Olası varyant (title case)
    'TERMINAL_ID':          'ATM ID',    # Olası varyant (uppercase)

    # ── ATM ADI (netleşecek) ──────────────────────────────────────────────
    'terminal_name':        'ATM Adı',   # ? Tahmin
    'Terminal Name':        'ATM Adı',   # ? Tahmin
    'atm_name':             'ATM Adı',   # ? Tahmin
    'name':                 'ATM Adı',   # ? Tahmin
    'location_name':        'ATM Adı',   # ? Tahmin

    # ── BÖLGE (netleşecek) ────────────────────────────────────────────────
    'zone_id':              'Zone',      # ? Tahmin
    'zone':                 'Zone',      # ? Tahmin
    'region_id':            'Zone',      # ? Tahmin
    'region':               'Zone',      # ? Tahmin
    'branch_code':          'Zone',      # ? Tahmin

    # ── NAKİT BAKİYE (netleşecek) ────────────────────────────────────────
    'tl_balance':           'TL Bakiye', # ? Tahmin
    'cash_balance':         'TL Bakiye', # ? Tahmin
    'total_cash':           'TL Bakiye', # ? Tahmin
    'dispenser_balance':    'TL Bakiye', # ? Tahmin
    'available_cash':       'TL Bakiye', # ? Tahmin

    # ── RECYCLE BAKİYE (netleşecek) ──────────────────────────────────────
    'recycle_balance':      'Recycle Bakiye',  # ? Tahmin
    'recycle_total':        'Recycle Bakiye',  # ? Tahmin
    'deposit_balance':      'Recycle Bakiye',  # ? Tahmin

    # ── KASETLER (ONAYLANDI ✅ — her kaset ayrı alan) ─────────────────────
    # Bankadan her kasetin ayrı ayrı geldiği onaylandı.
    # Alan adları netleşince burası güncellenecek:
    'cassette_1':           'Kaset 1',   # ? Alan adı TBD
    'cassette_2':           'Kaset 2',   # ? Alan adı TBD
    'cassette_3':           'Kaset 3',   # ? Alan adı TBD
    'cassette_4':           'Kaset 4',   # ? Alan adı TBD
    'cassette_5':           'Kaset 5',   # ? Alan adı TBD
    'cassette_6':           'Kaset 6',   # ? Alan adı TBD
    'cassette_7':           'Kaset 7',   # ? Alan adı TBD
    'cassette_8':           'Kaset 8',   # ? Alan adı TBD
    'cassette1':            'Kaset 1',   # ? Alternatif
    'cassette2':            'Kaset 2',   # ? Alternatif
    'cassette3':            'Kaset 3',   # ? Alternatif
    'cassette4':            'Kaset 4',   # ? Alternatif
    'cassette5':            'Kaset 5',   # ? Alternatif
    'cassette6':            'Kaset 6',   # ? Alternatif
    'cassette7':            'Kaset 7',   # ? Alternatif
    'cassette8':            'Kaset 8',   # ? Alternatif
    'kaset_1':              'Kaset 1',   # ? Alternatif (Türkçe)
    'kaset_2':              'Kaset 2',   # ? Alternatif (Türkçe)
    'kaset_3':              'Kaset 3',   # ? Alternatif (Türkçe)
    'kaset_4':              'Kaset 4',   # ? Alternatif (Türkçe)
    'kaset_5':              'Kaset 5',   # ? Alternatif (Türkçe)
    'kaset_6':              'Kaset 6',   # ? Alternatif (Türkçe)
    'kaset_7':              'Kaset 7',   # ? Alternatif (Türkçe)
    'kaset_8':              'Kaset 8',   # ? Alternatif (Türkçe)

    # ── ARIZA (ONAYLANDI ✅ — 15 dk'da bir güncelleniyor) ─────────────────
    # Feed 15 dakikada bir yenileniyor.
    # Alan adı netleşince burası güncellenecek:
    'fault_description':    'Arıza Açıklaması',  # ? Alan adı TBD
    'alarm_description':    'Arıza Açıklaması',  # ? Tahmin
    'fault_code':           'Arıza Açıklaması',  # ? Tahmin
    'alarm_text':           'Arıza Açıklaması',  # ? Tahmin
    'error_description':    'Arıza Açıklaması',  # ? Tahmin
    'fault_msg':            'Arıza Açıklaması',  # ? Tahmin
    'alarm_msg':            'Arıza Açıklaması',  # ? Tahmin

    # ── DÖVİZ / KÜPÜR (netleşecek) ───────────────────────────────────────
    'currency':             'Döviz',
    'currency_type':        'Döviz',
    'denominations':        'TL Küpür',
    'cassette_types':       'TL Küpür',

    # ── İŞLEM GEÇMİŞİ (netleşecek — AI eğitimi için kritik) ─────────────
    # Banka günlük çekim/yatırım geçmişi gönderiyor mu? TBD
    'daily_withdrawal':     '1 Salı Çeken',
    'daily_deposit':        '1 Salı Yatan',
    'regular_collection':   'Düzenli Para Toplama',
}


# FORMAT_B: Banka düz JSON çıktısı (eski tahmin haritası — yedeк)
FIELD_MAP_B: Dict[str, str] = {
    'atm_code':             'ATM ID',
    'atm_name':             'ATM Adı',
    'region_id':            'Zone',
    'tl_balance':           'TL Bakiye',
    'recycle_balance':      'Recycle Bakiye',
    'cassette_1':           'Kaset 1',
    'cassette_2':           'Kaset 2',
    'cassette_3':           'Kaset 3',
    'cassette_4':           'Kaset 4',
    'fault_code':           'Arıza Açıklaması',
    'fault_description':    'Arıza Açıklaması',
    'alarm_text':           'Arıza Açıklaması',
    'currency':             'Döviz',
    'denominations':        'TL Küpür',
    'daily_withdrawal':     '1 Salı Çeken',
    'daily_deposit':        '1 Salı Yatan',
    'regular_collection':   'Düzenli Para Toplama',
}

# FORMAT_C: Banka nested/object JSON (iç içe obje)
# Örnek: { "cash": { "total": 500000, "cassettes": [...] } }
FIELD_MAP_C: Dict[str, str] = {
    # ── TOPLANTI SONRASI BURASI DOLDURULACAK ──
}

# FORMAT_D: CSV/Excel export
FIELD_MAP_D: Dict[str, str] = {
    # ── TOPLANTI SONRASI BURASI DOLDURULACAK ──
    # Örnek tahminler:
    'ATM Kodu':             'ATM ID',
    'ATM İsmi':             'ATM Adı',
    'Bölge':                'Zone',
    'Toplam TL':            'TL Bakiye',
    'Recycle Toplam':       'Recycle Bakiye',
    'Arıza':                'Arıza Açıklaması',
    'Döviz Tipi':           'Döviz',
}

# FORMAT_E: XML/SOAP
FIELD_MAP_E: Dict[str, str] = {
    # ── TOPLANTI SONRASI BURASI DOLDURULACAK ──
}

# FORMAT_F: REST API JSON (en olası format)
FIELD_MAP_F: Dict[str, str] = {
    # ── TOPLANTI SONRASI BURASI DOLDURULACAK ──
    # Örnek tahminler (modern REST API):
    'id':                   'ATM ID',
    'terminalId':           'ATM ID',
    'terminal_id':          'ATM ID',
    'terminalName':         'ATM Adı',
    'terminal_name':        'ATM Adı',
    'zoneId':               'Zone',
    'zone_id':              'Zone',
    'cashAmount':           'TL Bakiye',
    'cash_amount':          'TL Bakiye',
    'totalCash':            'TL Bakiye',
    'total_cash':           'TL Bakiye',
    'recycleAmount':        'Recycle Bakiye',
    'recycle_amount':       'Recycle Bakiye',
    'faultDescription':     'Arıza Açıklaması',
    'fault_description':    'Arıza Açıklaması',
    'errorCode':            'Arıza Açıklaması',
    'error_code':           'Arıza Açıklaması',
    'alarmDescription':     'Arıza Açıklaması',
    'alarm_description':    'Arıza Açıklaması',
    'currencyType':         'Döviz',
    'currency_type':        'Döviz',
}

ALL_FIELD_MAPS = {
    'A':    FIELD_MAP_A,
    'BANK': FIELD_MAP_BANK,   # ✅ Onaylı banka formatı — bunu kullan!
    'B':    FIELD_MAP_B,
    'C':    FIELD_MAP_C,
    'D':    FIELD_MAP_D,
    'E':    FIELD_MAP_E,
    'F':    FIELD_MAP_F,
}

# Varsayılan aktif format — toplantı sonrası güncellendi
DEFAULT_FORMAT = 'BANK'


# ─────────────────────────────────────────────────────────────────────────────
# ADAPTOR SINIFI
# ─────────────────────────────────────────────────────────────────────────────

class BankDataAdapter:
    """
    Bankadan gelen her türlü veriyi bizim iç standardına normalize eder.

    Kullanım:
        adapter = BankDataAdapter(format_type='F')  # REST API varsayımı
        normalized = adapter.normalize(raw_bank_data)
        # Artık CombinedServiceIntelligence, IronCladEngine vb. çalışır
    """

    def __init__(self, format_type: str = 'AUTO'):
        """
        Args:
            format_type: 'A', 'B', 'C', 'D', 'E', 'F', 'AUTO'
                         AUTO → otomatik tespit dener
        """
        self.format_type = format_type.upper()
        self.field_map = ALL_FIELD_MAPS.get(self.format_type, {})
        self._unknown_fields: set = set()

    # ── Tek ATM normalize ───────────────────────────────────────────────────

    def normalize(self, raw: Dict) -> Dict:
        """
        Tek bir ATM verisini normalize et.

        Args:
            raw: Bankadan gelen ham dict

        Returns:
            Bizim canonical formata normalize edilmiş dict
        """
        if self.format_type == 'AUTO':
            detected = self._auto_detect_format(raw)
            self.field_map = ALL_FIELD_MAPS.get(detected, {})

        result: Dict[str, Any] = {}

        for bank_key, value in raw.items():
            # Önce field_map'te ara
            canonical_key = self.field_map.get(bank_key)

            if canonical_key:
                # Zaten başka bir değer atandıysa, üzerine yazmayı atla
                if canonical_key not in result:
                    result[canonical_key] = self._convert_value(canonical_key, value)
            else:
                # Field map'te yoksa: canonical mi zaten?
                if bank_key in CANONICAL_FIELDS:
                    result[bank_key] = self._convert_value(bank_key, value)
                else:
                    # Bilinmeyen alan — kaydet (toplantıdan sonra map'e eklenecek)
                    self._unknown_fields.add(bank_key)
                    result[bank_key] = value  # ham olarak sakla, çöpe atma

        # Eksik zorunlu alanları default ile doldur
        result.setdefault('ATM ID', 'UNKNOWN')
        result.setdefault('TL Bakiye', 0)
        result.setdefault('Recycle Bakiye', 0)
        result.setdefault('Arıza Açıklaması', '')
        result.setdefault('Döviz', '-')
        result.setdefault('Zone', 0)

        return result

    # ── Liste normalize ─────────────────────────────────────────────────────

    def normalize_list(self, raw_list: List[Dict]) -> List[Dict]:
        """Tüm ATM listesini normalize et."""
        normalized = [self.normalize(r) for r in raw_list]

        if self._unknown_fields:
            print(f"\n⚠️  TOPLANTI NOTU — Aşağıdaki alanlar field_map'te eksik:")
            print(f"   Bunları FIELD_MAP_{self.format_type} sözlüğüne ekleyin:")
            for f in sorted(self._unknown_fields):
                print(f"   '{f}': '<bizim_alan_adı>',")

        return normalized

    # ── CSV / Excel yükleme ─────────────────────────────────────────────────

    def from_csv(self, csv_path: str, encoding: str = 'utf-8') -> List[Dict]:
        """CSV dosyasını yükle ve normalize et."""
        result = []
        with open(csv_path, 'r', encoding=encoding, errors='replace') as f:
            reader = csv.DictReader(f)
            for row in reader:
                result.append(self.normalize(dict(row)))
        print(f"✅ CSV yüklendi: {len(result)} ATM")
        return result

    # ── JSON yükleme ────────────────────────────────────────────────────────

    def from_json(self, json_path: str) -> List[Dict]:
        """JSON dosyasını yükle ve normalize et."""
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        # Hem liste hem de {"atms": [...]} wrapper destekleniyor
        if isinstance(data, list):
            raw_list = data
        elif isinstance(data, dict):
            # Muhtemel wrapper key'leri
            for key in ('atms', 'terminals', 'data', 'result', 'results', 'items'):
                if key in data:
                    raw_list = data[key]
                    break
            else:
                raw_list = [data]  # tek obje
        else:
            raise ValueError(f"Beklenmeyen JSON yapısı: {type(data)}")
        normalized = self.normalize_list(raw_list)
        print(f"✅ JSON yüklendi: {len(normalized)} ATM")
        return normalized

    # ── Otomatik format tespiti ─────────────────────────────────────────────

    def _auto_detect_format(self, raw: Dict) -> str:
        """
        Gelen verinin alanlarına bakarak hangi format olduğunu tahmin et.
        """
        keys = set(raw.keys())

        # Bizim canonical formatımız
        if 'ATM ID' in keys or 'ATM Adı' in keys:
            return 'A'

        # ✅ ONAYLANMIŞ banka formatı — terminal_id
        if any(k in keys for k in ('terminal_id', 'Terminal ID', 'Terminal Id', 'TERMINAL_ID')):
            return 'BANK'

        # REST API (camelCase)
        if any(k in keys for k in ('terminalId', 'cashAmount', 'faultDescription')):
            return 'F'

        # Flat JSON (snake_case)
        if any(k in keys for k in ('atm_code', 'tl_balance', 'fault_code')):
            return 'B'

        # CSV export (Türkçe başlıklar)
        if any(k in keys for k in ('ATM Kodu', 'Toplam TL', 'ATM İsmi')):
            return 'D'

        # Varsayılan — onaylı banka formatını dene
        return 'BANK'

    # ── Tip dönüşümleri ─────────────────────────────────────────────────────

    def _convert_value(self, canonical_key: str, value: Any) -> Any:
        """
        Belirli alanlar için tip dönüşümü yap.
        Örn: bakiye string gelebilir → int'e çevir.
        """
        NUMERIC_FIELDS = {
            'TL Bakiye', 'Recycle Bakiye',
            'Kaset 1', 'Kaset 2', 'Kaset 3', 'Kaset 4',
            'Kaset 5', 'Kaset 6', 'Kaset 7', 'Kaset 8',
            'Recycle 200 TL', 'Recycle 100 TL', 'Zone',
            '1 Salı Çeken', '2 Çarşamba Çeken', '3 Perşembe Çeken',
            '4 Cuma Çeken', '5 Cumartesi Çeken', '6 Pazar Çeken',
            '7 Pazartesi Çeken', '8 Salı Çeken',
            '1 Salı Yatan', '2 Çarşamba Yatan', '3 Perşembe Yatan',
            '4 Cuma Yatan', '5 Cumartesi Yatan', '6 Pazar Yatan',
            '7 Pazartesi Yatan', '8 Salı Yatan',
        }

        BOOL_FIELDS = {'FLM Capable'}

        if value is None:
            return 0 if canonical_key in NUMERIC_FIELDS else ''

        if canonical_key in NUMERIC_FIELDS:
            try:
                if isinstance(value, (int, float)):
                    return int(value)
                cleaned = str(value).replace(',', '').replace('.', '').replace(' ', '').replace('₺', '').replace('TL', '').strip()
                return int(cleaned) if cleaned and cleaned not in ('-', 'nan', 'None') else 0
            except (ValueError, TypeError):
                return 0

        if canonical_key in BOOL_FIELDS:
            if isinstance(value, bool):
                return value
            return str(value).lower() in ('true', '1', 'evet', 'yes', 'e')

        return value

    # ── Format güncelleme yardımcısı ────────────────────────────────────────

    def update_field_map(self, bank_field: str, canonical_field: str):
        """
        Toplantıdan döndükten sonra yeni alan eşlemesi ekle.

        Kullanım:
            adapter.update_field_map('terminalCode', 'ATM ID')
        """
        self.field_map[bank_field] = canonical_field
        # İlgili global map'e de yaz
        if self.format_type in ALL_FIELD_MAPS:
            ALL_FIELD_MAPS[self.format_type][bank_field] = canonical_field
        print(f"✅ Alan eklendi: '{bank_field}' → '{canonical_field}'")

    def print_missing_fields(self, sample: Dict):
        """
        Toplantıya hazırlık: Örnek veri üzerinden eksik alanları listele.
        Toplantıya bu listeyi götür, bankaya sor.
        """
        print("\n" + "=" * 60)
        print("📋 TOPLANTIYA HAZIRLIK — Bankadan Sorulacak Alanlar")
        print("=" * 60)
        print("\nBankadan istenen canonical alanlar için karşılık sorcağınız sorular:")
        print()

        questions = {
            'ATM ID':               'ATM/Terminal benzersiz kodu hangi alanda? (atm_id / terminalId / atm_code ...)',
            'ATM Adı':              'ATM lokasyon adı hangi alanda?',
            'Zone':                 'Bölge/Zone bilgisi hangi alanda?',
            'TL Bakiye':            'ATM toplam TL bakiyesi hangi alanda?',
            'Recycle Bakiye':       'Recycle kaseti toplam TL miktarı hangi alanda?',
            'Kaset 1':              'Dispenser kaset tutarları hangi alanlarda? (1-8 kaset)',
            'Arıza Açıklaması':     'Aktif arıza/alarm açıklaması hangi alanda?',
            'Döviz':                'ATM döviz bilgisi hangi alanda? (USD/EUR/- gibi)',
            'TL Küpür':             'ATM küpür bilgisi hangi alanda? (200 TL, 100 TL ...)',
            'Düzenli Para Toplama': 'Düzenli para toplama programı var mı bilgisi hangi alanda?',
            '1 Salı Çeken':         'Günlük çekim geçmiş verileri var mı? Hangi format? (7-8 günlük)',
            '1 Salı Yatan':         'Günlük yatırım geçmiş verileri var mı? Hangi format? (7-8 günlük)',
        }

        for field, question in questions.items():
            bank_val = sample.get(field, '⚠️ YOK')
            status = '✅' if field in sample else '❓'
            print(f"  {status} {field}")
            print(f"     → {question}")
            if field in sample:
                print(f"     → Mevcut değer: {bank_val}")
            print()

        print("=" * 60)
        print("📌 Format tipi sormayı unutmayın:")
        print("   - REST API (JSON) mi?  → Endpoint URL ve authentication?")
        print("   - Dosya transfer (SFTP) mi?  → Sıklık? (anlık / saatlik / günlük)")
        print("   - Veritabanı bağlantısı mı?  → DB tipi? (Oracle / MSSQL ...)")
        print("   - CSV/Excel export mu?  → Encoding? Tarih formatı?")
        print("=" * 60)


# ─────────────────────────────────────────────────────────────────────────────
# TEST / DEMO
# ─────────────────────────────────────────────────────────────────────────────

def demo_test():
    """Farklı format örnekleriyle adaptörü test et."""

    print("🧪 BankDataAdapter — Format Test")
    print("=" * 60)

    # Banka REST API formatı örneği (tahmin)
    sample_format_f = {
        "terminalId": "ATM-001",
        "terminalName": "MERKEZ ŞUBESİ",
        "zoneId": 3,
        "cashAmount": 450000,
        "recycleAmount": 320000,
        "cassette_1": 200000,
        "cassette_2": 150000,
        "cassette_3": 100000,
        "faultDescription": "CCDM JAM HATASI",
        "currencyType": "-",
        "denominations": "200 TL 100 TL 50 TL",
        "regular_collection": "Var"
    }

    # Banka CSV export formatı örneği (tahmin)
    sample_format_d = {
        "ATM Kodu": "ATM-002",
        "ATM İsmi": "HAVALİMANI ŞUBESİ",
        "Bölge": "1",
        "Toplam TL": "890000",
        "Recycle Toplam": "540000",
        "Arıza": "DISPENSER SENSOR FAULT",
        "Döviz Tipi": "USD"
    }

    # Test 1: FORMAT_F (REST API)
    print("\n[TEST 1] FORMAT_F — REST API")
    adapter_f = BankDataAdapter(format_type='F')
    normalized_f = adapter_f.normalize(sample_format_f)
    print(f"  ATM ID   : {normalized_f['ATM ID']}")
    print(f"  TL Bakiye: {normalized_f['TL Bakiye']:,} TL")
    print(f"  Arıza    : {normalized_f['Arıza Açıklaması']}")

    # Test 2: FORMAT_D (CSV)
    print("\n[TEST 2] FORMAT_D — CSV Export")
    adapter_d = BankDataAdapter(format_type='D')
    normalized_d = adapter_d.normalize(sample_format_d)
    print(f"  ATM ID   : {normalized_d['ATM ID']}")
    print(f"  TL Bakiye: {normalized_d['TL Bakiye']:,} TL")
    print(f"  Arıza    : {normalized_d['Arıza Açıklaması']}")

    # Test 3: AUTO detect
    print("\n[TEST 3] FORMAT_AUTO — Otomatik tespit")
    adapter_auto = BankDataAdapter(format_type='AUTO')
    normalized_auto = adapter_auto.normalize(sample_format_f)
    print(f"  ATM ID   : {normalized_auto['ATM ID']}")

    # Test 4: Bizim mevcut format ile entegrasyon testi
    print("\n[TEST 4] Combined Service Intelligence entegrasyon testi")
    try:
        from combined_service_intelligence import CombinedServiceIntelligence
        engine = CombinedServiceIntelligence()
        result = engine.analyze_atm(normalized_f)
        print(f"  ✅ Analiz başarılı!")
        print(f"  Öneri    : {result['recommendation']}")
        print(f"  Öncelik  : {result['priority']}")
    except ImportError:
        print("  ⚠️ combined_service_intelligence import edilemedi (ayrı çalıştırıyorsunuz)")

    # Toplantı hazırlık notları
    print()
    adapter_f.print_missing_fields(sample_format_f)


if __name__ == '__main__':
    demo_test()

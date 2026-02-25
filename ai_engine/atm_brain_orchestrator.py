"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  ATM BRAIN ORCHESTRATOR — Merkezi Karar Beyni                               ║
║                                                                              ║
║  Bu dosya sistemin kalbi.                                                    ║
║  Tüm hortumları alır, her iki motoru çalıştırır,                             ║
║  kombine kararlar verir, değişmez kuralları uygular.                         ║
║                                                                              ║
║  HORTUMLAR:                                                                  ║
║  ─────────────────────────────────────────────────────                       ║
║  [ARIZA]  terminal_tanim    → ATM master listesi                             ║
║  [ARIZA]  online_ariza      → 15dk'da bir güncellenen canlı arıza feed       ║
║  [ARIZA]  ariza_gecmisi     → Geçmiş arıza kayıtları (3 yıl)                ║
║  [ARIZA]  kapanmis_kayitlar → Çözülen arızalar + çözüm süreleri             ║
║  [ARIZA]  vendor_loglar     → Teknik servis logları                          ║
║  [ARIZA]  express_loglar    → Anlık express log akışı                        ║
║                                                                              ║
║  [CASH]   online_bakiye     → Anlık: tl_bakiye, kaset_1..8, recycle         ║
║  [CASH]   gunson_03_00      → Günlük: sıfırlama, toplama, ikmal             ║
║                                                                              ║
║  KOMBİNE KARARLAR (Beyinin asıl değeri):                                     ║
║  ─────────────────────────────────────────────────────                       ║
║  • FLM açık + ikmal lazım   → Tek seyahat, ikisini birden yap               ║
║  • FLM açık + yatan para    → FLM giderken parayı da al                     ║
║  • Toplama + az para + maaş → Toplarken küçük ikmal de ekle                 ║
║  • SLM + ikmal yakın        → SLM ile birleştir, rota optimize et           ║
║                                                                              ║
║  KULLANIM:                                                                   ║
║    brain = ATMBrainOrchestrator()                                            ║
║    brain.ingest_ariza_feed(ariza_data)       # 15 dakikada bir              ║
║    brain.ingest_bakiye_feed(bakiye_data)     # anlık                        ║
║    brain.ingest_gunson(gunson_data)          # her gece 03:00               ║
║    kararlar = brain.run_full_decision_cycle()                                ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, time
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path

import numpy as np

logger = logging.getLogger("atm_brain")


# ═══════════════════════════════════════════════════════════════════════════════
# BÖLÜM 1: DEĞİŞMEZ İŞ KURALLARI (HARDCODED — HİÇ DEĞİŞMEZ)
# ═══════════════════════════════════════════════════════════════════════════════

class BusinessRules:
    """
    Bankanın operasyonel kuralları — bunlar AI kararlarından bağımsız,
    her zaman uygulanır. Değiştirilmesi için onay gerekir.
    """

    # ── Servis Maliyetleri (TL) ──────────────────────────────────────────────
    MALIYET_FLM_SEYAHAT          = 250    # Bantaş FLM ziyareti
    MALIYET_SLM_SOLO             = 350    # Vendor tek başına
    MALIYET_SLM_ESKORT           = 700    # Vendor + CIT eskort (güvenlik bölge)
    MALIYET_IKMAL_PLANLI         = 180    # Planlı nakit yükleme
    MALIYET_IKMAL_ACIL           = 320    # Acil/plansız nakit yükleme
    MALIYET_TOPLAMA_PLANLI       = 150    # Planlı para toplama
    MALIYET_SUBE_PERSONEL        = 0      # Şube personeli (ücretsiz)
    MALIYET_DURUS_GUNLUK         = 2000   # ATM durduğunda günlük zarar

    # ── FLM Anahtar Kelimeler (Bantaş gider) ─────────────────────────────────
    FLM_ARIZA_KODLARI = {
        'KAĞIT', 'PAPER', 'JAM', 'SIKIŞMA', 'PRINTER', 'YAZICI',
        'RECEIPT', 'JOURNAL', 'FLM', 'CCDM', 'LIGHT', 'IŞIK',
        'DOOR', 'KABIN', 'SHUTTER', 'PERDE', 'SENSOR', 'SENSÖR',
        'CARD_READER_MINOR', 'KART_OKU_MINOR', 'VANDAL',
    }

    # ── SLM Anahtar Kelimeler (Vendor + escort gerekir) ──────────────────────
    SLM_ARIZA_KODLARI = {
        'DISPENSER', 'EPP', 'ŞIFRELEME', 'PC', 'ANA_KART', 'MAINBOARD',
        'NETWORK', 'AĞ', 'CARD_READER_MAJOR', 'XFS', 'UPS', 'GÜÇ',
        'CASH_MODULE', 'NAKIT_MODÜL', 'RECYCLER', 'CRM',
    }

    # ── Şube Personeli Yapabilir ──────────────────────────────────────────────
    SUBE_PERSONEL_KODLARI = {
        'PAPER_RELOAD', 'KAĞIT_YÜKLEMe', 'SIMPLE_RESET', 'BASIT_RESET',
        'DOOR_UNLOCK', 'KAPI_AÇ', 'RECEIPT_REFILL',
    }

    # ── Çalışma Saati Kısıtlamaları ──────────────────────────────────────────
    IS_SAATI_BASLANGIC  = 8    # 08:00
    IS_SAATI_BITIS      = 18   # 18:00
    MAX_BEKLEYIS_SAAT   = 4    # Mesai dışı — en fazla 4 saat bekle

    # ── Nakit Eşik Değerleri (TL) ─────────────────────────────────────────────
    NAKIT_KRITIK_ESIK   = 50_000    # Altına düşünce ACIL ikmal
    NAKIT_REFILL_ESIK   = 100_000   # Altına düşünce planla
    NAKIT_TOPLAMA_ESIK  = 800_000   # Üstüne çıkınca toplama
    NAKIT_ACIL_TOPLAMA  = 1_000_000 # Üstüne çıkınca ACIL toplama
    RECYCLE_DOLU_ESIK   = 0.85      # Recycle doluluk oranı (0-1)

    # ── Manuel Override Alanları (UI'dan gelen operatör kuralları) ────────────
    # Varsayılan None → kendi hesabını kullan. Set edilirse AI kararı buna göre ayarlanır.
    FLM_ESIK_SAAT: Optional[float] = None  # FLM bekleyiş eşiği (saat)
    SLM_RISK_ESIK: Optional[float] = None  # SLM tetikleme risk eşiği (0-1)

    # ── Maaş Dönemleri (bu günlerde talepler artar) ──────────────────────────
    MAAS_GUNLERI = [1, 2, 3, 14, 15, 16]  # Ayın 1-3 ve 14-16. günleri

    # ── Kombine Servis Tasarruf Oranları ─────────────────────────────────────
    # CIT zaten gidiyorsa FLM bedava bindirilir
    KOMBINE_FLM_IKMAL_TASARRUF  = MALIYET_FLM_SEYAHAT      # 250 TL
    # FLM gidiyorsa yatan parayı da alır → ayrı toplama seyahati yok
    KOMBINE_FLM_TOPLAMA_TASARRUF = MALIYET_TOPLAMA_PLANLI   # 150 TL
    # Acil yerine planlı → 140 TL fark
    KOMBINE_PLANLAMA_TASARRUF   = MALIYET_IKMAL_ACIL - MALIYET_IKMAL_PLANLI

    @classmethod
    def ariza_turu_belirle(cls, ariza_kodu: str) -> str:
        """Arıza kodundan FLM/SLM/SUBE kararı ver."""
        kod_upper = str(ariza_kodu).upper()
        for kelime in cls.SUBE_PERSONEL_KODLARI:
            if kelime in kod_upper:
                return 'SUBE'
        for kelime in cls.FLM_ARIZA_KODLARI:
            if kelime in kod_upper:
                return 'FLM'
        for kelime in cls.SLM_ARIZA_KODLARI:
            if kelime in kod_upper:
                return 'SLM'
        # Bilinmeyen kod: FLM olarak işle ama log'a yaz (güvenli taraf)
        logger.warning(f"Bilinmeyen arıza kodu: '{ariza_kodu}' → FLM varsayıldı")
        return 'FLM'

    @classmethod
    def is_mesai_saati(cls, dt: datetime = None) -> bool:
        dt = dt or datetime.now()
        return cls.IS_SAATI_BASLANGIC <= dt.hour < cls.IS_SAATI_BITIS

    @classmethod
    def is_maas_donemi(cls, dt: datetime = None) -> bool:
        dt = dt or datetime.now()
        return dt.day in cls.MAAS_GUNLERI


# ═══════════════════════════════════════════════════════════════════════════════
# BÖLÜM 2: VERİ MODELLERİ — Her hortumdan gelen veri tipi
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class ArizaEvent:
    """Online arıza feed'inden gelen tek bir arıza olayı."""
    terminal_id: str
    tarih: datetime
    ariza_kodu: str
    aciklama: str
    durum: str = 'ACIK'          # ACIK / KAPALI / DEVAM_EDIYOR
    sure_dk: int = 0             # Kaç dakikadır açık
    vendor_log: str = ''         # Vendor'dan gelen log

@dataclass
class BakiyeSnapshot:
    """Online bakiye hortumundan gelen anlık nakit durumu."""
    terminal_id: str
    zaman: datetime
    tl_bakiye: float
    kaset_1: float = 0
    kaset_2: float = 0
    kaset_3: float = 0
    kaset_4: float = 0
    kaset_5: float = 0
    kaset_6: float = 0
    kaset_7: float = 0
    kaset_8: float = 0
    recycle_bakiye: float = 0
    yatan_para: float = 0        # ATM'deki müşteri yatırımı

@dataclass
class GunsonKaydi:
    """Gece 03:00'de gelen günsonu verisi."""
    terminal_id: str
    tarih: str                   # YYYY-MM-DD
    sifirlama_yapildi: bool = False
    ikmal_tutar: float = 0
    toplama_tutar: float = 0
    toplam_cekim: float = 0
    toplam_yatirma: float = 0

@dataclass
class TerminalTanim:
    """Terminal tanım listesinden gelen ATM bilgisi."""
    terminal_id: str
    atm_adi: str = ''
    zone: int = 2
    konum_tipi: str = 'Offsite'  # Branch / Offsite
    sube_personel_var: bool = False
    guvenlik_seviyesi: str = 'Yüksek'
    nakit_merkezi: str = ''
    hizmet_gunleri: str = ''     # "Pazartesi,Çarşamba,Cuma"
    atm_modeli: str = ''

@dataclass
class BeyinKarari:
    """Beyin'in ürettiği nihai karar — tek ATM için."""
    terminal_id: str
    zaman: str
    
    # Karar
    eylem: str                   # COMBINED_SERVICE / FLM / SLM / IKMAL / TOPLAMA / IZLE
    aciliyet: str                # KRITIK / YUKSEK / ORTA / DUSUK
    atanan_takim: str
    
    # Maliyet
    tahmini_maliyet: float
    tahmini_tasarruf: float
    
    # Birleştirilen işler
    kombine_isler: List[str] = field(default_factory=list)
    
    # Sebepler
    sebepler: List[str] = field(default_factory=list)
    
    # AI skorları
    ariza_riski: float = 0.0     # 0-1
    nakit_sure_saat: float = 999.0
    
    # Öğrenme için geri bildirim
    gerceklesen_eylem: Optional[str] = None
    geri_bildirim_tarihi: Optional[str] = None

    def to_dict(self) -> Dict:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2, ensure_ascii=False)


# ═══════════════════════════════════════════════════════════════════════════════
# BÖLÜM 3: BEYIN ORCHESTRATORu — Tüm motorları birleştiren ana sınıf
# ═══════════════════════════════════════════════════════════════════════════════

class ATMBrainOrchestrator:
    """
    ╔══════════════════════════════════════════════════════════════╗
    ║  ATM BRAIN ORCHESTRATOR                                      ║
    ║  "Gördüğü her veriden öğrenen, kuralları asla esgeçmeyen"   ║
    ╚══════════════════════════════════════════════════════════════╝

    Bu sınıf sisteme bir insan gibi davranır:
    - Sol el: Arıza tarafı  → AI motoru çalıştırır
    - Sağ el: Cash tarafı   → Nakit motorunu çalıştırır
    - Beyin:  İkisini birleştirir, iş kurallarını uygular
    - Hafıza: Kararlarını kaydeder, yarın daha iyi öğrenir
    """

    def __init__(self, model_dir: str = './models'):
        self.model_dir  = Path(model_dir)
        self.rules      = BusinessRules()

        # Canlı veri bellekleri
        self._terminal_tanim : Dict[str, TerminalTanim]   = {}
        self._aktif_arizalar : Dict[str, List[ArizaEvent]] = {}
        self._son_bakiye     : Dict[str, BakiyeSnapshot]  = {}
        self._gunson_buffer  : List[GunsonKaydi]          = []

        # Karar geçmişi (geri bildirim için)
        self._karar_gecmisi  : List[BeyinKarari]          = []

        # AI motorları (lazy load — kullanılınca yüklenir)
        self._ariza_motoru   = None
        self._cash_motoru    = None
        self._combined       = None

        logger.info("ATM Brain Orchestrator başlatıldı.")

    # ──────────────────────────────────────────────────────────────────────────
    # HORTUM GİRİŞ METODLARİ — Her feed buradan gelir
    # ──────────────────────────────────────────────────────────────────────────

    def ingest_terminal_tanim(self, data: List[Dict]):
        """
        Terminal tanım listesini yükle.
        Genellikle günde bir kez güncellenir.
        
        Beklenen alanlar: terminal_id, atm_adi, zone, konum_tipi, ...
        """
        for row in data:
            tid = str(
                row.get('terminal_id') or
                row.get('atm_id') or
                row.get('ATM ID') or ''
            ).strip()
            if not tid:
                continue
            try:
                zone_val = int(str(row.get('zone', row.get('Zone', 2))).split()[0].replace(',', ''))
            except Exception:
                zone_val = 2
            konum_tipi = str(
                row.get('konum_tipi') or
                row.get('location_type') or
                'Offsite'
            )
            self._terminal_tanim[tid] = TerminalTanim(
                terminal_id        = tid,
                atm_adi            = str(row.get('atm_adi') or row.get('atm_name') or row.get('ATM Adı', '')),
                zone               = zone_val,
                konum_tipi         = konum_tipi,
                sube_personel_var  = konum_tipi in ('Şube', 'Branch', 'Şube İçi'),
                guvenlik_seviyesi  = str(row.get('guvenlik_seviyesi', 'Yüksek')),
                nakit_merkezi      = str(row.get('nakit_merkezi') or row.get('cash_center') or row.get('Nakit Merkezi', '')),
                hizmet_gunleri     = str(row.get('hizmet_gunleri') or row.get('planned_service_days') or ''),
                atm_modeli         = str(row.get('atm_modeli') or row.get('model') or row.get('model ', '')),
            )
        logger.info(f"Terminal tanım yüklendi: {len(self._terminal_tanim)} ATM")

    def ingest_ariza_feed(self, events: List[Dict]):
        """
        Online arıza raporunu al (15 dakikada bir çağrılır).
        
        Beklenen alanlar: terminal_id, tarih, ariza_kodu, aciklama, durum
        """
        yeni = 0
        for row in events:
            tid = str(row.get('terminal_id', row.get('ATM ID', ''))).strip()
            if not tid:
                continue

            try:
                tarih = datetime.fromisoformat(str(row.get('tarih', '')))
            except Exception:
                tarih = datetime.now()

            event = ArizaEvent(
                terminal_id = tid,
                tarih       = tarih,
                ariza_kodu  = str(row.get('ariza_kodu', row.get('Arıza Türü', ''))),
                aciklama    = str(row.get('aciklama', row.get('Arıza Açıklaması', ''))),
                durum       = str(row.get('durum', 'ACIK')).upper(),
                sure_dk     = int(row.get('sure_dk', 0)),
                vendor_log  = str(row.get('vendor_log', '')),
            )

            if tid not in self._aktif_arizalar:
                self._aktif_arizalar[tid] = []

            # Aynı arızayı tekrar ekleme
            mevcut_kodlar = {e.ariza_kodu for e in self._aktif_arizalar[tid]}
            if event.ariza_kodu not in mevcut_kodlar:
                self._aktif_arizalar[tid].append(event)
                yeni += 1

            # Çözülmüş arızaları temizle
            if event.durum == 'KAPALI':
                self._aktif_arizalar[tid] = [
                    e for e in self._aktif_arizalar[tid]
                    if e.ariza_kodu != event.ariza_kodu
                ]

        logger.info(f"Arıza feed alındı: {len(events)} kayıt, {yeni} yeni arıza")

    @staticmethod
    def _safe_float(val, default: float = 0.0) -> float:
        """'-', None, boş string gibi değerleri güvenle float'a çevir."""
        try:
            s = str(val).strip()
            if s in ('-', '', 'None', 'nan', 'null'):
                return default
            return float(s.replace(',', '').replace(' ', ''))
        except Exception:
            return default

    def ingest_bakiye_feed(self, snapshots: List[Dict]):
        """
        Online nakit bakiye hortumunu al.
        Anlık veya periyodik (15dk) çağrılır.
        
        Beklenen alanlar: terminal_id, tl_bakiye, kaset_1..8, recycle_bakiye
        """
        sf = self._safe_float
        for row in snapshots:
            tid = str(row.get('terminal_id', row.get('ATM ID', ''))).strip()
            if not tid:
                continue

            try:
                zaman = datetime.fromisoformat(str(row.get('zaman', datetime.now().isoformat())))
            except Exception:
                zaman = datetime.now()

            self._son_bakiye[tid] = BakiyeSnapshot(
                terminal_id    = tid,
                zaman          = zaman,
                tl_bakiye      = sf(row.get('tl_bakiye') or row.get('TL Bakiye')),
                kaset_1        = sf(row.get('kaset_1') or row.get('Kaset 1')),
                kaset_2        = sf(row.get('kaset_2') or row.get('Kaset 2')),
                kaset_3        = sf(row.get('kaset_3') or row.get('Kaset 3')),
                kaset_4        = sf(row.get('kaset_4') or row.get('Kaset 4')),
                kaset_5        = sf(row.get('kaset_5') or row.get('Kaset 5')),
                kaset_6        = sf(row.get('kaset_6') or row.get('Kaset 6')),
                kaset_7        = sf(row.get('kaset_7') or row.get('Kaset 7')),
                kaset_8        = sf(row.get('kaset_8') or row.get('Kaset 8')),
                recycle_bakiye = sf(row.get('recycle_bakiye') or row.get('Recycle Bakiye')),
                yatan_para     = sf(row.get('yatan_para') or row.get('Recycle Kasa 4: ALL-IN')),
            )

        logger.info(f"Bakiye feed alındı: {len(snapshots)} ATM güncellendi")

    def ingest_gunson(self, kayitlar: List[Dict]):
        """
        Gece 03:00'de gelen günsonu verisi.
        Modeli besler (incremental learning).
        
        Beklenen alanlar: terminal_id, tarih, sifirlama_yapildi,
                          ikmal_tutar, toplama_tutar, toplam_cekim
        """
        self._gunson_buffer = []
        for row in kayitlar:
            tid = str(row.get('terminal_id', '')).strip()
            if not tid:
                continue
            self._gunson_buffer.append(GunsonKaydi(
                terminal_id      = tid,
                tarih            = str(row.get('tarih', datetime.now().strftime('%Y-%m-%d'))),
                sifirlama_yapildi= bool(row.get('sifirlama_yapildi', False)),
                ikmal_tutar      = float(row.get('ikmal_tutar', 0)),
                toplama_tutar    = float(row.get('toplama_tutar', 0)),
                toplam_cekim     = float(row.get('toplam_cekim', 0)),
                toplam_yatirma   = float(row.get('toplam_yatirma', 0)),
            ))

        logger.info(f"Günsonu alındı: {len(self._gunson_buffer)} ATM kaydı")

        # Günsonu gelince modeli otomatik güncelle
        self._incremental_learning()

    def ingest_express_log(self, log_satiri: str, terminal_id: str):
        """
        Anlık express log satırı — tek satır gelir, hemen yorumlanır.
        
        Örnek: "2026-02-22 14:32:11 [T-00123] CCDM JAM ERROR — Kaset 2 sıkışma"
        """
        aciklama = log_satiri.strip()
        if not aciklama or not terminal_id:
            return

        # Kritik kelimeler varsa hemen arıza olayı oluştur
        kritik_kelimeler = {'ERROR', 'FAIL', 'JAM', 'HATA', 'SIKIŞMA', 'DOWN',
                            'KRITIK', 'CRITICAL', 'ALARM', 'WARNING'}
        if any(k in aciklama.upper() for k in kritik_kelimeler):
            self.ingest_ariza_feed([{
                'terminal_id': terminal_id,
                'tarih': datetime.now().isoformat(),
                'ariza_kodu': 'EXPRESS_LOG_ARIZA',
                'aciklama': aciklama,
                'durum': 'ACIK',
            }])

    # ──────────────────────────────────────────────────────────────────────────
    # ANA KARAR DÖNGÜSÜ — Tüm ATM'leri tarar, kararları üretir
    # ──────────────────────────────────────────────────────────────────────────

    def run_full_decision_cycle(
        self,
        atm_listesi: Optional[List[str]] = None,
        simdi: Optional[datetime] = None,
    ) -> List[BeyinKarari]:
        """
        ════════════════════════════════════════════════════════════
        ANA KARAR DÖNGÜSÜ
        ════════════════════════════════════════════════════════════

        Tüm ATM'leri tarar:
        1. Her ATM için arıza riskini hesapla (AI motor)
        2. Her ATM için nakit süresini hesapla (Cash motor)
        3. İkisini birleştir → Kombine karar ver
        4. İş kurallarını uygula
        5. Proaktif tahmin: henüz eşik altına düşmemiş ama düşecek ATM'ler
        6. Kararı kaydet (yarınki öğrenme için)
        """
        simdi = simdi or datetime.now()
        tum_atm_idler = atm_listesi or list(
            set(self._terminal_tanim.keys()) |
            set(self._aktif_arizalar.keys()) |
            set(self._son_bakiye.keys())
        )

        logger.info(f"Karar döngüsü başlatıldı: {len(tum_atm_idler)} ATM, {simdi}")

        kararlar: List[BeyinKarari] = []

        for tid in tum_atm_idler:
            try:
                karar = self._karar_uret(tid, simdi)
                if karar:
                    kararlar.append(karar)
                    self._karar_gecmisi.append(karar)
            except Exception as e:
                logger.error(f"Karar hatası [{tid}]: {e}")

        # ── Proaktif tahmin: IZLE kararlarını modelle filtrele ────────────────
        # Şu an "izle" denen ATM'ler arasında model yüksek risk görüyorsa
        # "PROAKTIF_IKMAL" veya "PROAKTIF_IZLE" kararı ekle
        try:
            proaktif = self._proaktif_tahmin_uret(
                tum_atm_idler=tum_atm_idler,
                mevcut_karar_idler={k.terminal_id for k in kararlar},
                simdi=simdi,
            )
            kararlar.extend(proaktif)
            if proaktif:
                logger.info(f"Proaktif tahmin: {len(proaktif)} ATM öne alındı")
        except Exception as e:
            logger.warning(f"Proaktif tahmin atlandı: {e}")

        # Karar geçmişini sınırlı tut — max 5000 kayıt (RAM koruma)
        if len(self._karar_gecmisi) > 5000:
            self._karar_gecmisi = self._karar_gecmisi[-2000:]
            logger.info("Karar geçmişi temizlendi: 5000 → 2000 kayıt")

        # Önceliğe göre sırala
        oncelik_sirasi = {'KRITIK': 0, 'YUKSEK': 1, 'ORTA': 2, 'DUSUK': 3}
        kararlar.sort(key=lambda k: oncelik_sirasi.get(k.aciliyet, 9))

        # Özet log
        kritik_sayisi   = sum(1 for k in kararlar if k.aciliyet == 'KRITIK')
        yuksek_sayisi   = sum(1 for k in kararlar if k.aciliyet == 'YUKSEK')
        kombine_sayisi  = sum(1 for k in kararlar if k.eylem == 'COMBINED_SERVICE')
        proaktif_sayisi = sum(1 for k in kararlar if k.eylem.startswith('PROAKTIF'))
        toplam_tasarruf = sum(k.tahmini_tasarruf for k in kararlar)

        logger.info(
            f"Karar özeti: {kritik_sayisi} KRİTİK, {yuksek_sayisi} YÜKSEK, "
            f"{kombine_sayisi} KOMBİNE, {proaktif_sayisi} PROAKTİF, "
            f"toplam tasarruf {toplam_tasarruf:,.0f} TL"
        )

        return kararlar

    # ──────────────────────────────────────────────────────────────────────────
    # PROAKTİF TAHMİN — Henüz eşik altına düşmemiş ama düşecek ATM'ler
    # ──────────────────────────────────────────────────────────────────────────

    # Proaktif pencereler (saat cinsinden)
    _PROAKTIF_NAKIT_SAAT   = 18.0   # 18 saat içinde kritik eşiğe ulaşacak
    _PROAKTIF_ARIZA_OLASIL = 0.65   # %65 arıza olasılığı = proaktif izle
    _PROAKTIF_ARIZA_KRITIK = 0.82   # %82 = proaktif müdahale planla

    def _proaktif_tahmin_uret(
        self,
        tum_atm_idler: List[str],
        mevcut_karar_idler: set,
        simdi: datetime,
    ) -> List[BeyinKarari]:
        """
        Reaktif kararı OLMAYAN ATM'leri modele sorar:
        - Nakit: Mevcut bakiye + öğrenilmiş tüketim hızı → kaç saatte tükenir?
          18 saat içinde kritik eşiğe düşecekse → PROAKTIF_IKMAL
        - Arıza: XGBoost maintenance modeli → arıza olasılığı nedir?
          %65+ ise → PROAKTIF_IZLE, %82+ ise → PROAKTIF_MUDAHALE

        Proaktif kararlar normal kararlarla birleşir — öncelik sırasına girer.
        """
        proaktif_kararlar: List[BeyinKarari] = []

        # XGBoost modelini lazy load et
        xgb_engine = self._xgb_motoru_yukle()

        for tid in tum_atm_idler:
            # Zaten reaktif karar almış ATM'yi tekrar değerlendirme
            if tid in mevcut_karar_idler:
                continue

            bakiye  = self._son_bakiye.get(tid)
            tanim   = self._terminal_tanim.get(tid, TerminalTanim(terminal_id=tid))
            td      = tanim.__dict__
            gunluk_tuketim  = float(td.get("gunluk_tuketim_tl") or 0.0)
            gecmis_risk     = float(td.get("gecmis_risk_skoru") or 0.0)

            sebepler: List[str] = []
            eylem    = None
            aciliyet = 'DUSUK'

            # ── A) NAKİT PROAKTİF TAHMİN ────────────────────────────────────
            if bakiye and gunluk_tuketim > 0:
                tl_bakiye = bakiye.tl_bakiye

                # Şu an eşik altında değil ama ne zaman düşecek?
                sure_saat = (tl_bakiye / gunluk_tuketim) * 24.0

                if sure_saat <= self._PROAKTIF_NAKIT_SAAT and tl_bakiye > BusinessRules.NAKIT_KRITIK_ESIK:
                    # Henüz kritik değil ama 18 saat içinde olacak
                    eylem    = 'PROAKTIF_IKMAL'
                    aciliyet = 'ORTA' if sure_saat > 12 else 'YUKSEK'
                    sebepler.append(
                        f"🔮 PROAKTİF TAHMİN: {tl_bakiye:,.0f} TL bakiye, "
                        f"tüketim {gunluk_tuketim/1000:.0f}K TL/gün → "
                        f"~{sure_saat:.1f} saatte kritik eşiğe düşer. "
                        f"Şimdi planlanırsa acil maliyet önlenir."
                    )
                    # Maaş döneminde tüketim artar — aciliyeti bir basamak yükselt
                    if BusinessRules.is_maas_donemi(simdi):
                        aciliyet = 'YUKSEK'
                        sebepler.append(
                            "Maaş dönemi — talep %20-30 artar, tahmin süre daha kısa"
                        )

            # ── B) ARIZA PROAKTİF TAHMİN (XGBoost) ─────────────────────────
            if xgb_engine is not None and bakiye is not None:
                try:
                    ariza_olasiligi = self._ariza_olasiligi_hesapla(
                        xgb_engine, tid, bakiye, gecmis_risk, simdi
                    )
                    if ariza_olasiligi >= self._PROAKTIF_ARIZA_KRITIK:
                        # Yüksek olasılık → proaktif müdahale planla
                        if eylem is None:
                            eylem    = 'PROAKTIF_MUDAHALE'
                            aciliyet = 'YUKSEK'
                        sebepler.append(
                            f"🤖 MODEL TAHMİNİ: %{ariza_olasiligi*100:.0f} arıza olasılığı "
                            f"(eşik: %{self._PROAKTIF_ARIZA_KRITIK*100:.0f}) — "
                            f"24-48 saat içinde FLM/SLM gerekebilir"
                        )
                    elif ariza_olasiligi >= self._PROAKTIF_ARIZA_OLASIL:
                        # Orta olasılık → izle bayrağı
                        if eylem is None:
                            eylem    = 'PROAKTIF_IZLE'
                            aciliyet = 'ORTA'
                        sebepler.append(
                            f"👁 MODEL İZLE: %{ariza_olasiligi*100:.0f} arıza olasılığı — "
                            f"sıradaki rutin ziyarette kontrol et"
                        )
                except Exception:
                    pass  # Model hatası kararı engellemesin

            if eylem is None:
                continue

            karar = BeyinKarari(
                terminal_id      = tid,
                zaman            = simdi.isoformat(),
                eylem            = eylem,
                aciliyet         = aciliyet,
                atanan_takim     = ('Bantaş_CIT' if 'IKMAL' in eylem
                                    else 'İzleme_Ekibi'),
                tahmini_maliyet  = (BusinessRules.MALIYET_IKMAL_PLANLI
                                    if 'IKMAL' in eylem else 0),
                tahmini_tasarruf = (BusinessRules.MALIYET_IKMAL_ACIL -
                                    BusinessRules.MALIYET_IKMAL_PLANLI
                                    if 'IKMAL' in eylem else 0),
                sebepler         = sebepler,
                ariza_riski      = gecmis_risk,
            )
            proaktif_kararlar.append(karar)
            self._karar_gecmisi.append(karar)

        return proaktif_kararlar

    def _xgb_motoru_yukle(self):
        """XGBoost motorunu lazy load et. Hata olursa None döner (proaktif atlanır)."""
        if self._ariza_motoru is not None:
            return self._ariza_motoru
        try:
            from ironclad_production import IronCladEngine
            engine = IronCladEngine(
                model_dir=str(self.model_dir / 'prophet_predictor' / 'v1.0.0')
            )
            if engine.model_maintenance is not None and engine.model_cash is not None:
                self._ariza_motoru = engine
                logger.info("XGBoost motoru yüklendi (proaktif tahmin aktif)")
            return self._ariza_motoru
        except Exception as e:
            logger.warning(f"XGBoost motor yüklenemedi (proaktif devre dışı): {e}")
            return None

    def _ariza_olasiligi_hesapla(
        self,
        xgb_engine,
        tid: str,
        bakiye,
        gecmis_risk: float,
        simdi: datetime,
    ) -> float:
        """
        XGBoost'a tek ATM için feature vektörü oluşturur ve arıza olasılığı döner.
        Öğrenilmiş geçmiş veriyi feature olarak ekler → model daha doğru tahmin eder.
        """
        import numpy as np
        tanim = self._terminal_tanim.get(tid, TerminalTanim(terminal_id=tid))
        td    = tanim.__dict__

        aktif_ariza_sayisi = len(self._aktif_arizalar.get(tid, []))
        gunluk_tuketim     = float(td.get("gunluk_tuketim_tl") or 0.0)
        ort_flm_sure       = float(td.get("ort_flm_sure_dk") or 0.0)
        gecmis_ort_ikmal   = float(td.get("gecmis_ort_ikmal") or 0.0)

        X = np.array([[
            bakiye.tl_bakiye,           # tl_bakiye
            gecmis_ort_ikmal,           # ikmal_tutar (geçmiş ortalama)
            0.0,                        # toplama_tutar
            gunluk_tuketim * 0.8,       # toplam_cekim (günlük tüketim proxy)
            1 if aktif_ariza_sayisi > 0 else 0,  # sifirlama proxy
        ]], dtype='float32')

        sonuc = xgb_engine.predict(X)
        if sonuc is None:
            return 0.0

        # gecmis_risk ile harmanla: model + tarihsel ağırlıklı ortalama
        model_olasilik = float(np.clip(sonuc['maintenance_prob'][0], 0.0, 1.0))
        harmonik = model_olasilik * 0.7 + gecmis_risk * 0.3
        return harmonik

    # ──────────────────────────────────────────────────────────────────────────
    # TEK ATM İÇİN KARAR — Asıl mantık burada
    # ──────────────────────────────────────────────────────────────────────────

    def _karar_uret(self, tid: str, simdi: datetime) -> Optional[BeyinKarari]:
        """
        Tek bir ATM için tam karar üretimi.
        
        Adımlar:
        1. ATM bilgilerini topla
        2. Arıza durumunu değerlendir
        3. Nakit durumunu değerlendir
        4. KOMBİNE servis fırsatı var mı? (en büyük tasarruf buradan)
        5. İş kurallarını uygula
        6. Karar oluştur
        """
        tanim   = self._terminal_tanim.get(tid, TerminalTanim(terminal_id=tid))
        arizalar = self._aktif_arizalar.get(tid, [])
        bakiye  = self._son_bakiye.get(tid)

        sebepler: List[str] = []
        kombine_isler: List[str] = []
        maliyet   = 0.0
        tasarruf  = 0.0

        # ── 0. ÖĞRENİLMİŞ ATM PROFİLİ — Her kararı kişiselleştir ────────────
        # Bu veriler ingest_gecmis_ariza() ve ingest_gecmis_nakit() tarafından
        # yüklenir. Canlı hortum olmadan da çalışır — tarihsel veriden öğrenilir.
        td = tanim.__dict__
        gecmis_risk    = float(td.get("gecmis_risk_skoru") or 0.0)
        kronik_kodlar  = set(td.get("kronik_arizalar") or [])
        ort_flm_sure   = td.get("ort_flm_sure_dk")    # Bu ATM için öğrenilmiş FLM süresi
        ort_slm_sure   = td.get("ort_slm_sure_dk")    # Bu ATM için öğrenilmiş SLM süresi
        gunluk_tuketim = float(td.get("gunluk_tuketim_tl") or 0.0)

        # Geçmiş risk skoru yüksekse bu ATM'yi öne al (öğrenme etkisi)
        gecmis_risk_aciliyeti = 'YOK'
        if gecmis_risk >= 0.85:
            gecmis_risk_aciliyeti = 'KRITIK'
            sebepler.append(
                f"⚠️ Geçmiş risk skoru KRİTİK: {gecmis_risk:.0%} "
                f"— tarihsel veriler yüksek arıza olasılığı gösteriyor"
            )
        elif gecmis_risk >= 0.60:
            gecmis_risk_aciliyeti = 'YUKSEK'
            sebepler.append(
                f"Geçmiş risk skoru YÜKSEK: {gecmis_risk:.0%} "
                f"— yakın izleme gerekiyor"
            )
        elif gecmis_risk >= 0.35:
            gecmis_risk_aciliyeti = 'ORTA'

        # ── 1. ARIZA DEĞERLENDİRME ────────────────────────────────────────────
        flm_gerekli      = False
        slm_gerekli      = False
        sube_yapabilir   = False
        ariza_aciliyeti  = 'YOK'

        for ariza in arizalar:
            tur = BusinessRules.ariza_turu_belirle(ariza.ariza_kodu)
            acik_sure_saat = ariza.sure_dk / 60

            # Kronik arıza tespiti: bu kod geçmişte 3+ kez tekrarladıysa → SLM'e yükselt
            # (FLM gidip gidip çözemiyorsa donanım sorunu var demektir)
            if ariza.ariza_kodu in kronik_kodlar and tur == 'FLM':
                tur = 'SLM'
                sebepler.append(
                    f"🔄 KRONİK ARIZA yükseltildi: {ariza.ariza_kodu} "
                    f"daha önce tekrarladı → SLM dispatch"
                )

            # Aciliyet eşiği: öğrenilmiş ortalama süre varsa onu kullan
            # (Bazı ATM'ler hızlı düzelir, bazıları çok uzun sürer — beyin bunu biliyor)
            flm_kritik_esik = float(ort_flm_sure * 1.5 / 60) if ort_flm_sure else 4.0
            slm_kritik_esik = float(ort_slm_sure * 1.5 / 60) if ort_slm_sure else 2.0

            if tur == 'SUBE':
                sube_yapabilir = True
                sebepler.append(
                    f"Şube personeli yapabilir: {ariza.ariza_kodu} "
                    f"({acik_sure_saat:.1f}s açık)"
                )

            elif tur == 'FLM':
                flm_gerekli = True
                ariza_aciliyeti = 'YUKSEK' if acik_sure_saat < 2 else 'ORTA'
                if acik_sure_saat > flm_kritik_esik:
                    ariza_aciliyeti = 'KRITIK'
                sebepler.append(
                    f"FLM arızası: {ariza.ariza_kodu} "
                    f"({acik_sure_saat:.1f}s açık) — Bantaş gidecek"
                )

            elif tur == 'SLM':
                slm_gerekli = True
                ariza_aciliyeti = 'YUKSEK'
                if acik_sure_saat > slm_kritik_esik:
                    ariza_aciliyeti = 'KRITIK'
                sebepler.append(
                    f"SLM arızası: {ariza.ariza_kodu} "
                    f"({acik_sure_saat:.1f}s açık) — Vendor dispatch"
                )

        # ── 2. NAKİT DEĞERLENDİRME ────────────────────────────────────────────
        ikmal_gerekli     = False
        toplama_gerekli   = False
        nakit_aciliyeti   = 'YOK'
        nakit_sure_saat   = 999.0

        if bakiye:
            tl_bakiye    = bakiye.tl_bakiye
            recycle_dol  = (bakiye.recycle_bakiye / 1_000_000) if bakiye.recycle_bakiye > 0 else 0
            yatan_var    = bakiye.yatan_para > 50_000

            # Kritik nakit düşük
            if tl_bakiye <= BusinessRules.NAKIT_KRITIK_ESIK:
                ikmal_gerekli  = True
                nakit_aciliyeti = 'KRITIK'
                # Öğrenilmiş tüketim hızı varsa gerçek süre hesapla, yoksa heuristic
                if gunluk_tuketim > 0:
                    nakit_sure_saat = (tl_bakiye / gunluk_tuketim) * 24
                else:
                    nakit_sure_saat = max(0.5, tl_bakiye / 10_000)
                sebepler.append(
                    f"KRİTİK NAKİT: {tl_bakiye:,.0f} TL "
                    f"— eşik {BusinessRules.NAKIT_KRITIK_ESIK:,} TL"
                    + (f" | Tüketim: {gunluk_tuketim/1000:.0f}K TL/gün → ~{nakit_sure_saat:.1f}s kaldı" if gunluk_tuketim > 0 else "")
                )

            elif tl_bakiye <= BusinessRules.NAKIT_REFILL_ESIK:
                ikmal_gerekli  = True
                nakit_aciliyeti = 'YUKSEK'
                if gunluk_tuketim > 0:
                    nakit_sure_saat = (tl_bakiye / gunluk_tuketim) * 24
                else:
                    nakit_sure_saat = tl_bakiye / 10_000
                sebepler.append(
                    f"Düşük nakit: {tl_bakiye:,.0f} TL — ikmal planla"
                    + (f" | ~{nakit_sure_saat:.0f}s önce tükenir" if gunluk_tuketim > 0 else "")
                )

            # Maaş döneminde eşiği %20 yükselt
            if BusinessRules.is_maas_donemi(simdi) and ikmal_gerekli:
                sebepler.append(
                    "Maaş dönemi — talep artışı bekleniyor, ikmal tutarı artırılsın"
                )

            # Toplama gerekli
            if tl_bakiye >= BusinessRules.NAKIT_ACIL_TOPLAMA:
                toplama_gerekli = True
                nakit_aciliyeti = 'KRITIK'
                sebepler.append(
                    f"DOLU NAKİT: {tl_bakiye:,.0f} TL — ACIL toplama"
                )
            elif tl_bakiye >= BusinessRules.NAKIT_TOPLAMA_ESIK:
                toplama_gerekli = True
                sebepler.append(
                    f"Yüksek nakit: {tl_bakiye:,.0f} TL — toplama planla"
                )

            # Yatan para birikmişse
            if yatan_var:
                sebepler.append(
                    f"Yatan para: {bakiye.yatan_para:,.0f} TL birikmiş — toplanmalı"
                )

            # Recycle doldu
            if recycle_dol >= BusinessRules.RECYCLE_DOLU_ESIK:
                toplama_gerekli = True
                sebepler.append(
                    f"Recycle {recycle_dol:.0%} dolu — boşaltılmalı"
                )

        # ── 3. KOMBİNE SERVİS FIRSATI (Tasarrufun kalbi) ─────────────────────
        #
        # Kural 1: FLM var + ikmal lazım
        #   → Bantaş zaten gidecek, aynı seyahatte ikmal de yapsın
        #   → Ayrı CIT seyahati gereksiz → 250 TL tasarruf
        #
        if flm_gerekli and ikmal_gerekli:
            kombine_isler.append('FLM + IKMAL')
            tasarruf += BusinessRules.KOMBINE_FLM_IKMAL_TASARRUF
            maliyet  += BusinessRules.MALIYET_FLM_SEYAHAT + BusinessRules.MALIYET_IKMAL_PLANLI
            sebepler.append(
                f"KOMBİNE [FLM+İKMAL]: Bantaş giderken ikmal de yapacak "
                f"→ {BusinessRules.KOMBINE_FLM_IKMAL_TASARRUF} TL tasarruf"
            )

        # Kural 2: FLM var + yatan para var
        #   → FLM giderken parayı da alsın
        #   → Ayrı toplama seyahati gereksiz → 150 TL tasarruf
        #
        if flm_gerekli and bakiye and bakiye.yatan_para > 50_000:
            kombine_isler.append('FLM + PARA_TOPLAMA')
            tasarruf += BusinessRules.KOMBINE_FLM_TOPLAMA_TASARRUF
            sebepler.append(
                f"KOMBİNE [FLM+TOPLAMA]: FLM gelirken yatan {bakiye.yatan_para:,.0f} TL "
                f"de alacak → {BusinessRules.KOMBINE_FLM_TOPLAMA_TASARRUF} TL tasarruf"
            )

        # Kural 3: Toplama var + nakit az + maaş dönemi
        #   → CIT zaten orada, küçük ikmal de eklensin
        #   → Fazladan seyahat yok → 180 TL tasarruf
        #
        if (toplama_gerekli and ikmal_gerekli and
                bakiye and bakiye.tl_bakiye < BusinessRules.NAKIT_REFILL_ESIK * 1.5):
            kombine_isler.append('TOPLAMA + KISMI_IKMAL')
            tasarruf += BusinessRules.MALIYET_IKMAL_PLANLI
            sebepler.append(
                "KOMBİNE [TOPLAMA+KISMI İKMAL]: CIT oradayken para toplar "
                "ve küçük ikmal de yapar → ekstra seyahat yok"
            )

        # Kural 4: SLM var + ikmal yakın
        #   → Vendor gelirken CIT de oraya yönlendirilsin
        #
        if slm_gerekli and ikmal_gerekli:
            kombine_isler.append('SLM + IKMAL_PLANLA')
            sebepler.append(
                "KOMBİNE [SLM+İKMAL]: SLM gelirken eş zamanlı ikmal planla "
                "→ ATM bir kez devre dışı kalır"
            )

        # ── 4. NİHAİ EYLEM VE MALİYET HESABI ────────────────────────────────
        if kombine_isler:
            eylem = 'COMBINED_SERVICE'
        elif slm_gerekli:
            eylem = 'SLM_VENDOR'
            # Şube mi offsite mi? → escort maliyeti
            if tanim.konum_tipi == 'Offsite' or tanim.guvenlik_seviyesi == 'Yüksek':
                maliyet  += BusinessRules.MALIYET_SLM_ESKORT
            else:
                maliyet  += BusinessRules.MALIYET_SLM_SOLO
                tasarruf += (BusinessRules.MALIYET_SLM_ESKORT - BusinessRules.MALIYET_SLM_SOLO)
                sebepler.append("Escort gerekmez — 350 TL tasarruf")
        elif flm_gerekli:
            eylem    = 'FLM_VENDOR'
            if tanim.konum_tipi == 'Branch' and tanim.sube_personel_var:
                eylem    = 'FLM_SUBE_PERSONEL'
                maliyet  = BusinessRules.MALIYET_SUBE_PERSONEL
                tasarruf = BusinessRules.MALIYET_FLM_SEYAHAT
                sebepler.append(
                    f"Şube ATM'si — personel yapacak: "
                    f"{BusinessRules.MALIYET_FLM_SEYAHAT} TL tasarruf"
                )
            else:
                maliyet += BusinessRules.MALIYET_FLM_SEYAHAT
        elif ikmal_gerekli:
            eylem    = 'IKMAL'
            maliyet += (BusinessRules.MALIYET_IKMAL_ACIL
                        if nakit_aciliyeti == 'KRITIK'
                        else BusinessRules.MALIYET_IKMAL_PLANLI)
            if nakit_aciliyeti != 'KRITIK':
                tasarruf += BusinessRules.KOMBINE_PLANLAMA_TASARRUF
        elif toplama_gerekli:
            eylem    = 'PARA_TOPLAMA'
            maliyet += BusinessRules.MALIYET_TOPLAMA_PLANLI
        elif sube_yapabilir:
            eylem    = 'SUBE_PERSONEL'
            maliyet  = 0
            tasarruf = BusinessRules.MALIYET_FLM_SEYAHAT
        else:
            eylem    = 'IZLE'

        # ── 5. ACİLİYET KARAR ────────────────────────────────────────────────
        aciliyet_sirasi = {'KRITIK': 3, 'YUKSEK': 2, 'ORTA': 1, 'DUSUK': 0, 'YOK': -1}
        # gecmis_risk_aciliyeti de dahil et — öğrenilmiş geçmiş kararı etkiler
        aciliyet = max(
            [ariza_aciliyeti, nakit_aciliyeti, gecmis_risk_aciliyeti],
            key=lambda x: aciliyet_sirasi.get(x, -1)
        )
        if aciliyet == 'YOK':
            aciliyet = 'DUSUK'

        # Mesai dışında kritik/yüksek arıza: hemen göndermek yerine 4 saat tolerans
        if not BusinessRules.is_mesai_saati(simdi) and aciliyet == 'YUKSEK' and not nakit_aciliyeti == 'KRITIK':
            sebepler.append(
                f"Mesai dışı ({simdi.hour:02d}:00) — en geç {BusinessRules.MAX_BEKLEYIS_SAAT} saat içinde müdahale"
            )

        # ── 6. TAKIM ATAMALARI ────────────────────────────────────────────────
        if eylem in ('COMBINED_SERVICE', 'FLM_VENDOR', 'IKMAL', 'PARA_TOPLAMA'):
            takim = 'Bantaş_CIT'
        elif eylem == 'SLM_VENDOR':
            takim = 'Vendor_Teknisyen'
            if tanim.konum_tipi == 'Offsite':
                takim += ' + Bantaş_Eskort'
        elif eylem == 'FLM_SUBE_PERSONEL':
            takim = 'Şube_Personeli'
        elif eylem == 'SUBE_PERSONEL':
            takim = 'Şube_Personeli'
        else:
            takim = 'İzleme_Ekibi'

        # ── 7. EYLEME GEREK YOK → None dön ──────────────────────────────────
        if eylem == 'IZLE' and not arizalar:
            return None

        karar = BeyinKarari(
            terminal_id      = tid,
            zaman            = simdi.isoformat(),
            eylem            = eylem,
            aciliyet         = aciliyet,
            atanan_takim     = takim,
            tahmini_maliyet  = maliyet,
            tahmini_tasarruf = tasarruf,
            kombine_isler    = kombine_isler,
            sebepler         = sebepler,
            ariza_riski      = gecmis_risk,   # Öğrenilmiş geçmiş risk skoru (0-1)
            nakit_sure_saat  = nakit_sure_saat,
        )

        return karar

    # ──────────────────────────────────────────────────────────────────────────
    # ÖĞRENİM — Günsonu verisiyle modeli güncelle
    # ──────────────────────────────────────────────────────────────────────────

    def _incremental_learning(self):
        """
        Günsonu verisi gelince modeli otomatik güncelle.
        Bu fonksiyon her gece 03:00'de çağrılır.
        Motor bir önceki günün verisiyle kendini eğitir.
        """
        if not self._gunson_buffer:
            return

        logger.info(f"Artımlı öğrenme başlatılıyor: {len(self._gunson_buffer)} kayıt")

        try:
            # Günsonu verisinden basit feature matrix oluştur
            rows = []
            for kayit in self._gunson_buffer:
                bakiye = self._son_bakiye.get(kayit.terminal_id)
                rows.append({
                    'tl_bakiye'         : bakiye.tl_bakiye if bakiye else 0,
                    'ikmal_tutar'       : kayit.ikmal_tutar,
                    'toplama_tutar'     : kayit.toplama_tutar,
                    'toplam_cekim'      : kayit.toplam_cekim,
                    'sifirlama'         : 1 if kayit.sifirlama_yapildi else 0,
                    'y_maintenance'     : 1 if kayit.terminal_id in self._aktif_arizalar and
                                              self._aktif_arizalar[kayit.terminal_id] else 0,
                    'y_cash'            : max(1.0, kayit.toplam_cekim / 5000) if kayit.toplam_cekim > 0 else 24,
                })

            import pandas as pd
            import numpy as np
            df_new = pd.DataFrame(rows)

            feat_cols = ['tl_bakiye', 'ikmal_tutar', 'toplama_tutar',
                         'toplam_cekim', 'sifirlama']
            X_new      = df_new[feat_cols].fillna(0).values.astype('float32')
            y_maint    = df_new['y_maintenance'].values.astype('int32')
            y_cash     = df_new['y_cash'].values.astype('float32')

            # V1 motor (ironclad_production) güncelle
            try:
                from ironclad_production import IronCladEngine
                engine = IronCladEngine(model_dir=str(self.model_dir / 'prophet_predictor/v1.0.0'))
                if engine.model_maintenance is not None:
                    engine.train_incremental(X_new, y_maint, y_cash)
                    logger.info("V1 motor günsonu verisiyle güncellendi ✓")
            except Exception as e:
                logger.warning(f"V1 incremental güncelleme atlandı: {e}")

        except Exception as e:
            logger.error(f"Artımlı öğrenme hatası: {e}")

    # ──────────────────────────────────────────────────────────────────────────
    # GERİ BİLDİRİM — Karar doğru muydu? Motor öğrensin
    # ──────────────────────────────────────────────────────────────────────────

    # ──────────────────────────────────────────────────────────────────────────
    # TOPLU GEÇMİŞ VERİ BESLEMESI — UI'dan yüklenen Excel/CSV burada işlenir
    # Bu metodlar canlı hortumlardan bağımsız çalışır; beyni geçmişle eğitir.
    # ──────────────────────────────────────────────────────────────────────────

    def ingest_gecmis_ariza(self, data: List[Dict]) -> Dict:
        """
        Toplu geçmiş arıza verisi — beyin arıza kalıplarını öğrenir.

        Beklenen alanlar: terminal_id, tarih, ariza_kodu, aciklama, durum, sure_dk

        Beyin ne öğrenir:
        ─────────────────
        • ATM bazında aylık arıza sıklığı  → risk skoru güncellenir
        • En sık arıza kodları             → tahmin önceliği değişir
        • Ortalama çözüm süreleri          → FLM/SLM ETA tahmini iyileşir
        • Tekrarlayan arızalar             → 'kronifikasyon riski' bayrağı
        • FLM/SLM oranı                   → ekip planlama kararlarını etkiler
        """
        from collections import Counter, defaultdict

        if not data:
            return {"ogrenilen_atm": 0, "toplam_ariza": 0, "mesaj": "Veri boş"}

        # ATM bazında grupla
        atm_arizalar: Dict[str, List[Dict]] = defaultdict(list)
        for row in data:
            tid = str(row.get("terminal_id") or row.get("ATM ID") or "").strip()
            if tid:
                atm_arizalar[tid].append(row)

        ogrenme_detay: Dict[str, Any] = {}
        for tid, arizalar in atm_arizalar.items():
            kodlar  = [str(r.get("ariza_kodu") or "").upper() for r in arizalar]
            sureler = [self._safe_float(r.get("sure_dk")) for r in arizalar]

            # Arıza tiplerini sınıflandır
            flm_sayisi  = sum(1 for k in kodlar if BusinessRules.ariza_turu_belirle(k) == "FLM")
            slm_sayisi  = sum(1 for k in kodlar if BusinessRules.ariza_turu_belirle(k) == "SLM")
            sube_sayisi = sum(1 for k in kodlar if BusinessRules.ariza_turu_belirle(k) == "SUBE")

            # Ortalama çözüm süresi
            gecerli_sureler = [s for s in sureler if s > 0]
            ort_sure_dk     = sum(gecerli_sureler) / len(gecerli_sureler) if gecerli_sureler else 0

            # Aylık ortalama (kaç farklı ay var?)
            aylar = {str(r.get("tarih", ""))[:7] for r in arizalar if r.get("tarih")}
            aylik_ort = len(arizalar) / max(1, len(aylar))

            # Risk skoru (0-1): 10+ arıza/ay = max risk
            risk_skoru = min(1.0, aylik_ort / 10.0)

            # Kronifikasyon: aynı kod 3+ kez varsa
            tekrar_edenler = [kod for kod, sayi in Counter(kodlar).items() if sayi >= 3]

            ogrenme_detay[tid] = {
                "toplam_ariza"     : len(arizalar),
                "flm_sayisi"       : flm_sayisi,
                "slm_sayisi"       : slm_sayisi,
                "sube_sayisi"      : sube_sayisi,
                "ort_sure_dk"      : round(ort_sure_dk, 1),
                "aylik_ort"        : round(aylik_ort, 2),
                "gecmis_risk_skoru": round(risk_skoru, 3),
                "en_sik"           : Counter(kodlar).most_common(3),
                "kronik_arizalar"  : tekrar_edenler,
            }

            # Terminal tanımına risk bilgisini kaydet (karar döngüsünde kullanılır)
            if tid in self._terminal_tanim:
                t = self._terminal_tanim[tid]
                t.__dict__["gecmis_risk_skoru"] = risk_skoru
                t.__dict__["kronik_arizalar"]   = tekrar_edenler
                t.__dict__["ort_flm_sure_dk"]   = ort_sure_dk if flm_sayisi > 0 else None
                t.__dict__["ort_slm_sure_dk"]   = ort_sure_dk if slm_sayisi > 0 else None

        toplam = sum(len(v) for v in atm_arizalar.values())
        logger.info(
            f"[ÖĞRENME] Geçmiş arıza yüklendi: {len(atm_arizalar)} ATM, "
            f"{toplam} arıza kaydı → risk skorları güncellendi"
        )
        return {
            "ogrenilen_atm"   : len(atm_arizalar),
            "toplam_ariza"    : toplam,
            "ogrenme_detay"   : ogrenme_detay,
        }

    def ingest_gecmis_nakit(self, data: List[Dict], veri_turu: str) -> Dict:
        """
        Toplu geçmiş nakit verisi — beyin nakit tüketim kalıplarını öğrenir.

        veri_turu: 'ikmal' | 'para_toplama' | 'gunluk_bakiye'

        Beyin ne öğrenir:
        ─────────────────
        • ATM bazında ortalama ikmal/toplama miktarı
        • Nakit tüketim hızı (günlük)         → ETA tahmini iyileşir
        • Min/Max bakiye eğrisi               → risk eşikleri kişiselleşir
        • İkmal sıklığı                       → planlı vs acil ayrımı iyileşir
        """
        from collections import defaultdict

        if not data:
            return {"ogrenilen_atm": 0, "toplam_kayit": 0, "mesaj": "Veri boş"}

        atm_verisi: Dict[str, List[Dict]] = defaultdict(list)
        for row in data:
            tid = str(row.get("terminal_id") or row.get("ATM ID") or "").strip()
            if tid:
                atm_verisi[tid].append(row)

        ogrenme_detay: Dict[str, Any] = {}

        for tid, kayitlar in atm_verisi.items():
            if veri_turu == "ikmal":
                tutarlar = [
                    self._safe_float(r.get("ikmal_tutar") or r.get("miktar_tl"))
                    for r in kayitlar
                ]
                ort     = sum(tutarlar) / len(tutarlar) if tutarlar else 0
                ogrenme_detay[tid] = {
                    "ikmal_sayisi": len(kayitlar),
                    "ort_ikmal_tl": round(ort, 0),
                    "toplam_tl"   : round(sum(tutarlar), 0),
                }
                # Terminale kaydet — acil ikmal eşiği kişiselleşir
                if tid in self._terminal_tanim:
                    self._terminal_tanim[tid].__dict__["gecmis_ort_ikmal"] = ort

            elif veri_turu == "para_toplama":
                tutarlar = [
                    self._safe_float(r.get("toplama_tutar") or r.get("toplanan_tl"))
                    for r in kayitlar
                ]
                ort     = sum(tutarlar) / len(tutarlar) if tutarlar else 0
                ogrenme_detay[tid] = {
                    "toplama_sayisi": len(kayitlar),
                    "ort_toplama_tl": round(ort, 0),
                    "toplam_tl"     : round(sum(tutarlar), 0),
                }
                if tid in self._terminal_tanim:
                    self._terminal_tanim[tid].__dict__["gecmis_ort_toplama"] = ort

            elif veri_turu == "gunluk_bakiye":
                bakiyeler = [
                    self._safe_float(r.get("tl_bakiye") or r.get("bakiye_tl"))
                    for r in kayitlar
                ]
                bakiyeler = [b for b in bakiyeler if b > 0]
                if bakiyeler:
                    ort_b = sum(bakiyeler) / len(bakiyeler)
                    # Günlük tüketim tahmini: min→ort arası fark / gün sayısı
                    gunluk_tuketim = max(1000.0, (max(bakiyeler) - min(bakiyeler)) / max(1, len(bakiyeler)))
                    ogrenme_detay[tid] = {
                        "kayit_sayisi"      : len(bakiyeler),
                        "ort_bakiye_tl"     : round(ort_b, 0),
                        "min_bakiye_tl"     : round(min(bakiyeler), 0),
                        "max_bakiye_tl"     : round(max(bakiyeler), 0),
                        "gunluk_tuketim_tl" : round(gunluk_tuketim, 0),
                    }
                    # Terminal'e kişisel tüketim hızını kaydet
                    if tid in self._terminal_tanim:
                        self._terminal_tanim[tid].__dict__["gunluk_tuketim_tl"] = gunluk_tuketim
                    # Mevcut bakiyeden ETA yeniden hesapla
                    if tid in self._son_bakiye and gunluk_tuketim > 0:
                        mevcut = self._son_bakiye[tid].tl_bakiye
                        eta_gun = mevcut / gunluk_tuketim
                        self._son_bakiye[tid].__dict__["ogrenilen_eta_gun"] = round(eta_gun, 1)

        toplam = sum(len(v) for v in atm_verisi.values())
        logger.info(
            f"[ÖĞRENME] Geçmiş nakit yüklendi ({veri_turu}): "
            f"{len(atm_verisi)} ATM, {toplam} kayıt → tüketim kalıpları güncellendi"
        )
        return {
            "ogrenilen_atm" : len(atm_verisi),
            "toplam_kayit"  : toplam,
            "ogrenme_detay" : ogrenme_detay,
        }

    def gecmis_ogrenme_ozeti(self) -> Dict:
        """
        Geçmiş öğrenmeden ne değişti? Karar mekanizmasına etkisi nedir?
        UI'da gösterilmek üzere özet rapor döner.
        """
        ogrenen_atmler = []
        for tid, tanim in self._terminal_tanim.items():
            d = tanim.__dict__
            if any(k in d for k in ["gecmis_risk_skoru", "gecmis_ort_ikmal",
                                     "gecmis_ort_toplama", "gunluk_tuketim_tl"]):
                ogrenen_atmler.append({
                    "terminal_id"       : tid,
                    "atm_adi"           : tanim.atm_adi,
                    "gecmis_risk_skoru" : d.get("gecmis_risk_skoru"),
                    "kronik_arizalar"   : d.get("kronik_arizalar", []),
                    "ort_ikmal_tl"      : d.get("gecmis_ort_ikmal"),
                    "ort_toplama_tl"    : d.get("gecmis_ort_toplama"),
                    "gunluk_tuketim_tl" : d.get("gunluk_tuketim_tl"),
                    "ogrenilen_eta_gun" : self._son_bakiye.get(tid, None) and
                                         self._son_bakiye[tid].__dict__.get("ogrenilen_eta_gun"),
                })
        return {
            "toplam_ogrenen_atm"  : len(ogrenen_atmler),
            "karar_mekanizmasi"   : {
                "risk_skoru_guncellendi"  : sum(1 for a in ogrenen_atmler if a["gecmis_risk_skoru"] is not None),
                "eta_guncellendi"         : sum(1 for a in ogrenen_atmler if a["ogrenilen_eta_gun"] is not None),
                "kronik_ariza_tespit"     : sum(1 for a in ogrenen_atmler if a["kronik_arizalar"]),
                "ikmal_kalip_ogrendi"     : sum(1 for a in ogrenen_atmler if a["ort_ikmal_tl"] is not None),
                "toplama_kalip_ogrendi"   : sum(1 for a in ogrenen_atmler if a["ort_toplama_tl"] is not None),
            },
            "atmler": ogrenen_atmler[:50],  # İlk 50 — fazlası gerekirse pagination
        }

    # ──────────────────────────────────────────────────────────────────────────
    # HAFIZA — Kalıcı Depolama ve Versiyonlama
    # ──────────────────────────────────────────────────────────────────────────

    _HAFIZA_DOSYASI = "brain_memory.json"
    _SNAPSHOT_DIR   = "brain_snapshots"

    def _ogrenilen_verileri_topla(self) -> Dict:
        """Tüm TerminalTanim ve BakiyeSnapshot'lardan öğrenilmiş alanları toplar."""
        ogrenilen: Dict[str, Dict] = {}
        for tid, tanim in self._terminal_tanim.items():
            d = tanim.__dict__
            satirlar = {
                k: d[k] for k in [
                    "gecmis_risk_skoru", "kronik_arizalar",
                    "ort_flm_sure_dk",   "ort_slm_sure_dk",
                    "gecmis_ort_ikmal",  "gecmis_ort_toplama",
                    "gunluk_tuketim_tl",
                ] if k in d
            }
            if tid in self._son_bakiye:
                eta = self._son_bakiye[tid].__dict__.get("ogrenilen_eta_gun")
                if eta is not None:
                    satirlar["ogrenilen_eta_gun"] = eta
            if satirlar:
                ogrenilen[tid] = satirlar
        return ogrenilen

    def _ogrenilen_verileri_uygula(self, ogrenilen: Dict) -> int:
        """Kaydedilmiş öğrenme verilerini TerminalTanim'lara yazar. Kaç ATM yüklendi döner."""
        yuklenen = 0
        for tid, alanlar in ogrenilen.items():
            if tid not in self._terminal_tanim:
                self._terminal_tanim[tid] = TerminalTanim(terminal_id=tid)
            for alan, deger in alanlar.items():
                if alan == "ogrenilen_eta_gun":
                    if tid in self._son_bakiye:
                        self._son_bakiye[tid].__dict__["ogrenilen_eta_gun"] = deger
                else:
                    self._terminal_tanim[tid].__dict__[alan] = deger
            yuklenen += 1
        return yuklenen

    def hafiza_kaydet(self, aciklama: str = "") -> str:
        """
        Beynin öğrendiklerini kalıcı olarak JSON'a yazar.
        models/brain_memory.json — uygulama yeniden başlayınca buradan yüklenir.

        Returns:
            Kaydın versiyon etiketi (zaman damgası)
        """
        self.model_dir.mkdir(parents=True, exist_ok=True)
        ogrenilen = self._ogrenilen_verileri_topla()
        versiyon  = datetime.now().strftime("%Y%m%d_%H%M%S")
        hafiza = {
            "versiyon"   : versiyon,
            "tarih"      : datetime.now().isoformat(),
            "aciklama"   : aciklama,
            "ogrenen_atm": len(ogrenilen),
            "ogrenilen"  : ogrenilen,
        }
        hafiza_path = self.model_dir / self._HAFIZA_DOSYASI
        with open(hafiza_path, "w", encoding="utf-8") as f:
            json.dump(hafiza, f, ensure_ascii=False, indent=2)
        logger.info(f"✅ Beyin hafızası kaydedildi → {len(ogrenilen)} ATM | {hafiza_path}")
        return versiyon

    def hafiza_yukle(self) -> Dict:
        """
        Daha önce kaydedilmiş hafızayı yükler.
        api_server.py startup'ında otomatik çağrılır.

        Returns:
            Yükleme durumu raporu
        """
        hafiza_path = self.model_dir / self._HAFIZA_DOSYASI
        if not hafiza_path.exists():
            logger.info("Beyin hafızası bulunamadı — temiz başlangıç.")
            return {"durum": "yok", "mesaj": "Kaydedilmiş hafıza yok, temiz başlangıç."}
        try:
            with open(hafiza_path, encoding="utf-8") as f:
                hafiza = json.load(f)
            yuklenen = self._ogrenilen_verileri_uygula(hafiza.get("ogrenilen", {}))
            logger.info(
                f"✅ Beyin hafızası yüklendi → {yuklenen} ATM "
                f"| Versiyon: {hafiza.get('versiyon')} | {hafiza.get('tarih')}"
            )
            return {
                "durum"       : "yuklendi",
                "versiyon"    : hafiza.get("versiyon"),
                "tarih"       : hafiza.get("tarih"),
                "aciklama"    : hafiza.get("aciklama", ""),
                "yuklenen_atm": yuklenen,
            }
        except Exception as e:
            logger.error(f"Hafıza yükleme hatası: {e}")
            return {"durum": "hata", "mesaj": str(e)}

    def snapshot_al(self, aciklama: str = "") -> str:
        """
        Versiyonlanmış anlık kopya alır.
        Büyük bir yükleme yapmadan ÖNCE çağrılır → hatalı öğrenmeye karşı güvenlik.
        Son 20 snapshot tutulur, eskiler otomatik silinir.

        Returns:
            Snapshot versiyon etiketi
        """
        snap_dir = self.model_dir / self._SNAPSHOT_DIR
        snap_dir.mkdir(parents=True, exist_ok=True)
        ogrenilen = self._ogrenilen_verileri_topla()
        versiyon  = datetime.now().strftime("%Y%m%d_%H%M%S")
        snap = {
            "versiyon"   : versiyon,
            "tarih"      : datetime.now().isoformat(),
            "aciklama"   : aciklama,
            "ogrenen_atm": len(ogrenilen),
            "ogrenilen"  : ogrenilen,
        }
        snap_path = snap_dir / f"snapshot_{versiyon}.json"
        with open(snap_path, "w", encoding="utf-8") as f:
            json.dump(snap, f, ensure_ascii=False, indent=2)
        # Son 20 snapshot tut, eskilerini sil
        tum_snaplar = sorted(snap_dir.glob("snapshot_*.json"))
        if len(tum_snaplar) > 20:
            for eski in tum_snaplar[:-20]:
                eski.unlink()
        logger.info(f"📸 Snapshot alındı: v{versiyon} | {len(ogrenilen)} ATM | '{aciklama}'")
        return versiyon

    def snapshot_listesi(self) -> List[Dict]:
        """
        Kayıtlı tüm snapshot'ların listesini döner (yeniden eskiye).

        Returns:
            [{versiyon, tarih, aciklama, ogrenen_atm, dosya}]
        """
        snap_dir = self.model_dir / self._SNAPSHOT_DIR
        if not snap_dir.exists():
            return []
        result = []
        for snap_file in sorted(snap_dir.glob("snapshot_*.json"), reverse=True):
            try:
                with open(snap_file, encoding="utf-8") as f:
                    snap = json.load(f)
                result.append({
                    "versiyon"   : snap.get("versiyon"),
                    "tarih"      : snap.get("tarih"),
                    "aciklama"   : snap.get("aciklama", ""),
                    "ogrenen_atm": snap.get("ogrenen_atm", 0),
                    "dosya"      : snap_file.name,
                })
            except Exception:
                pass
        return result

    def snapshot_yukle(self, versiyon: str) -> Dict:
        """
        Belirtilen snapshot versiyonuna geri döner.
        Tüm öğrenilmiş alanlar sıfırlanır, snapshot'takiler uygulanır.

        Args:
            versiyon: snapshot_al() tarafından döndürülen zaman damgası

        Returns:
            Geri yükleme raporu
        """
        snap_dir  = self.model_dir / self._SNAPSHOT_DIR
        snap_path = snap_dir / f"snapshot_{versiyon}.json"
        if not snap_path.exists():
            raise FileNotFoundError(f"Snapshot bulunamadı: {versiyon}")
        with open(snap_path, encoding="utf-8") as f:
            snap = json.load(f)
        # Tüm öğrenilmiş alanları temizle
        ogrenilen_alanlar = [
            "gecmis_risk_skoru", "kronik_arizalar",
            "ort_flm_sure_dk",   "ort_slm_sure_dk",
            "gecmis_ort_ikmal",  "gecmis_ort_toplama",
            "gunluk_tuketim_tl",
        ]
        for tid, tanim in self._terminal_tanim.items():
            for alan in ogrenilen_alanlar:
                tanim.__dict__.pop(alan, None)
            if tid in self._son_bakiye:
                self._son_bakiye[tid].__dict__.pop("ogrenilen_eta_gun", None)
        # Snapshot değerlerini uygula
        yuklenen = self._ogrenilen_verileri_uygula(snap.get("ogrenilen", {}))
        # Hafıza dosyasını da güncelle (restart sonrası bu hali korur)
        self.hafiza_kaydet(aciklama=f"Geri yükleme: snapshot v{versiyon}")
        logger.info(f"⏪ Snapshot geri yüklendi: v{versiyon} | {yuklenen} ATM")
        return {
            "durum"       : "geri_yuklendi",
            "versiyon"    : versiyon,
            "tarih"       : snap.get("tarih"),
            "aciklama"    : snap.get("aciklama", ""),
            "yuklenen_atm": yuklenen,
        }

    def hafiza_durumu(self) -> Dict:
        """Mevcut hafıza ve snapshot durumunu raporlar."""
        hafiza_path = self.model_dir / self._HAFIZA_DOSYASI
        snap_dir    = self.model_dir / self._SNAPSHOT_DIR
        aktif_ogrenilen = self._ogrenilen_verileri_topla()
        son_hafiza: Dict = {}
        if hafiza_path.exists():
            try:
                with open(hafiza_path, encoding="utf-8") as f:
                    son_hafiza = json.load(f)
            except Exception:
                pass
        return {
            "aktif_ogrenen_atm"  : len(aktif_ogrenilen),
            "son_kayit_versiyon" : son_hafiza.get("versiyon"),
            "son_kayit_tarih"    : son_hafiza.get("tarih"),
            "son_kayit_aciklama" : son_hafiza.get("aciklama", ""),
            "snapshot_sayisi"    : len(list(snap_dir.glob("snapshot_*.json"))) if snap_dir.exists() else 0,
            "hafiza_dosyasi"     : str(hafiza_path),
        }

    def geri_bildirim_ver(
        self,
        terminal_id: str,
        gerceklesen_eylem: str,
        tarih: Optional[str] = None,
    ):
        """
        Operasyon ekibi kararı kapattığında çağrılır.
        Motor "öngördüğüm doğru muydu?" öğrenir.
        
        Args:
            terminal_id      : ATM kimliği
            gerceklesen_eylem: Gerçekte ne yapıldı (FLM / SLM / IKMAL / ...)
            tarih            : İşlem tarihi (opsiyonel)
        """
        tarih = tarih or datetime.now().isoformat()
        for karar in reversed(self._karar_gecmisi):
            if karar.terminal_id == terminal_id and karar.gerceklesen_eylem is None:
                karar.gerceklesen_eylem    = gerceklesen_eylem
                karar.geri_bildirim_tarihi = tarih
                logger.info(
                    f"Geri bildirim [{terminal_id}]: "
                    f"Öngörülen={karar.eylem}, Gerçek={gerceklesen_eylem}"
                )
                break

    # ──────────────────────────────────────────────────────────────────────────
    # RAPORLAMA
    # ──────────────────────────────────────────────────────────────────────────

    def ozet_rapor(self, kararlar: List[BeyinKarari]) -> Dict:
        """Karar listesinden özet istatistikler üret (proaktif dahil)."""
        proaktif_ikmal     = [k for k in kararlar if k.eylem == 'PROAKTIF_IKMAL']
        proaktif_mudahale  = [k for k in kararlar if k.eylem == 'PROAKTIF_MUDAHALE']
        proaktif_izle      = [k for k in kararlar if k.eylem == 'PROAKTIF_IZLE']
        xgb_aktif          = self._ariza_motoru is not None
        return {
            'zaman'              : datetime.now().isoformat(),
            'toplam_atm'         : len(kararlar),
            'kritik_atm'         : sum(1 for k in kararlar if k.aciliyet == 'KRITIK'),
            'yuksek_atm'         : sum(1 for k in kararlar if k.aciliyet == 'YUKSEK'),
            'kombine_servis'     : sum(1 for k in kararlar if k.eylem == 'COMBINED_SERVICE'),
            'flm_gerekli'        : sum(1 for k in kararlar if 'FLM' in k.eylem),
            'slm_gerekli'        : sum(1 for k in kararlar if 'SLM' in k.eylem),
            'ikmal_gerekli'      : sum(1 for k in kararlar if 'IKMAL' in k.eylem),
            'toplama_gerekli'    : sum(1 for k in kararlar if 'TOPLAMA' in k.eylem),
            'toplam_tahmini_maliyet' : sum(k.tahmini_maliyet for k in kararlar),
            'toplam_tahmini_tasarruf': sum(k.tahmini_tasarruf for k in kararlar),
            # ── Proaktif tahmin özeti ──────────────────────────────────────────
            'proaktif': {
                'aktif'          : xgb_aktif,
                'model_surumu'   : 'v1.0.0' if xgb_aktif else None,
                'proaktif_ikmal' : len(proaktif_ikmal),
                'proaktif_mudahale': len(proaktif_mudahale),
                'proaktif_izle'  : len(proaktif_izle),
                'toplam_proaktif': len(proaktif_ikmal) + len(proaktif_mudahale) + len(proaktif_izle),
                'onlenen_acil_tahmini': sum(k.tahmini_tasarruf for k in proaktif_ikmal + proaktif_mudahale),
            },
        }


# ═══════════════════════════════════════════════════════════════════════════════
# HIZLI TEST — Mevcut veriyle çalıştır
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    import json, logging
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

    print("=" * 70)
    print("  ATM BRAIN ORCHESTRATOR — CANLI TEST")
    print("=" * 70)

    brain = ATMBrainOrchestrator()

    # 1. Terminal tanım listesini yükle
    with open('../src/data/atm_master.json', encoding='utf-8') as f:
        master = json.load(f)
    brain.ingest_terminal_tanim(master[:50])   # İlk 50 ATM test için
    print(f"\n✓ {len(brain._terminal_tanim)} ATM tanımı yüklendi")

    # 2. Anlık bakiye verisi (kasa_durum_raporu'ndan)
    with open('../kasa_durum_raporu.json', encoding='utf-8') as f:
        kasa = json.load(f)
    # Alanları standart isimlere uyarla
    bakiye_feed = []
    for row in kasa[:50]:
        bakiye_feed.append({
            'terminal_id'    : row.get('ATM ID', ''),
            'tl_bakiye'      : row.get('TL Bakiye', 0),
            'kaset_1'        : row.get('Kaset 1', 0),
            'kaset_2'        : row.get('Kaset 2', 0),
            'kaset_3'        : row.get('Kaset 3', 0),
            'kaset_4'        : row.get('Kaset 4', 0),
            'kaset_5'        : row.get('Kaset 5', 0),
            'kaset_6'        : row.get('Kaset 6', 0),
            'kaset_7'        : row.get('Kaset 7', 0),
            'kaset_8'        : row.get('Kaset 8', 0),
            'recycle_bakiye' : row.get('Recycle Bakiye', 0),
            'yatan_para'     : row.get('Recycle Kasa 4: ALL-IN', 0),
        })
    brain.ingest_bakiye_feed(bakiye_feed)
    print(f"✓ {len(brain._son_bakiye)} ATM bakiyesi güncellendi")

    # 3. Arıza feed — kasa'daki arızalı ATM'lerden oluştur
    ariza_ornekler = [
        row for row in kasa[:50]
        if str(row.get('Açık Arıza Kaydı Var mı?', '')).lower() == 'evet'
    ]
    ariza_feed = []
    for row in ariza_ornekler[:15]:
        ariza_feed.append({
            'terminal_id' : row.get('ATM ID', ''),
            'tarih'       : datetime.now().isoformat(),
            'ariza_kodu'  : str(row.get('Alt Yapısal Arizalar', 'BILINMIYOR')).split(',')[0].strip(),
            'aciklama'    : str(row.get('Alt Yapısal Arizalar', '')),
            'durum'       : 'ACIK',
            'sure_dk'     : 90,
        })
    brain.ingest_ariza_feed(ariza_feed)
    print(f"✓ {len(ariza_feed)} arıza olayı yüklendi")

    # 4. TAM KARAR DÖNGÜSÜ
    print("\n" + "─" * 70)
    print("  KARAR DÖNGÜSÜ ÇALIŞIYOR...")
    print("─" * 70)

    kararlar = brain.run_full_decision_cycle()

    # 5. SONUÇLAR
    print()
    for k in kararlar[:15]:
        kombine = f" [{', '.join(k.kombine_isler)}]" if k.kombine_isler else ""
        print(f"  [{k.aciliyet:7s}] {k.terminal_id:10s} → {k.eylem:20s}{kombine}")
        print(f"           Takım: {k.atanan_takim}")
        print(f"           Maliyet: {k.tahmini_maliyet:,.0f} TL  |  "
              f"Tasarruf: {k.tahmini_tasarruf:,.0f} TL")
        if k.sebepler:
            print(f"           ↳ {k.sebepler[0]}")
        print()

    # 6. ÖZET RAPOR
    ozet = brain.ozet_rapor(kararlar)
    print("=" * 70)
    print("  ÖZET RAPOR")
    print("=" * 70)
    print(f"  Toplam ATM işlendi     : {ozet['toplam_atm']}")
    print(f"  KRİTİK ATM             : {ozet['kritik_atm']}")
    print(f"  YÜKSEK öncelikli       : {ozet['yuksek_atm']}")
    print(f"  Kombine servis fırsatı : {ozet['kombine_servis']}")
    print(f"  FLM gereken            : {ozet['flm_gerekli']}")
    print(f"  SLM gereken            : {ozet['slm_gerekli']}")
    print(f"  İkmal gereken          : {ozet['ikmal_gerekli']}")
    print(f"  Para toplama gereken   : {ozet['toplama_gerekli']}")
    print(f"  Toplam tahmini maliyet : {ozet['toplam_tahmini_maliyet']:,.0f} TL")
    print(f"  Toplam tahmini tasarruf: {ozet['toplam_tahmini_tasarruf']:,.0f} TL")
    print("=" * 70)
    print("\n✅ Beyin çalışıyor. Hortumları bağla, kararlar akmaya başlasın.")

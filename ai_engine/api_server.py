"""
╔═══════════════════════════════════════════════════════════════════════════╗
║  ATM GUARD — REST API SERVER                                              ║
║  Yazılım ekibine teslim edilen entegrasyon katmanı                        ║
║                                                                           ║
║  Çalıştırmak için:                                                        ║
║    python3 api_server.py                                                  ║
║    → http://localhost:8000/docs   (Swagger — tüm endpoint'ler burада)     ║
║    → http://localhost:8000/redoc  (ReDoc)                                 ║
║                                                                           ║
║  Yazılım ekibinin yapacağı tek şey:                                       ║
║    Her feed gelince ilgili POST endpoint'i çağırmak.                      ║
║    Kararları GET /api/v1/kararlar ile okumak.                             ║
╚═══════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Kendi motorlarımız
from atm_brain_orchestrator import ATMBrainOrchestrator, BeyinKarari

# ─── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("api_server")

# ─── Uygulama ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="ATM Guard — AI Karar Motoru",
    description="""
## ATM Guard Entegrasyon API'si

Bu API, bankanın mevcut sistemlerinden gelen verileri alır,
AI motoru çalıştırır ve operasyonel kararları döner.

### Yazılım Ekibi İçin Entegrasyon Adımları

1. **Terminal listesini yükle** → `POST /api/v1/terminal-tanim`
2. **15 dk'da bir arıza feed gönder** → `POST /api/v1/ariza-feed`
3. **Anlık bakiye feed gönder** → `POST /api/v1/bakiye-feed`
4. **Her gece 03:00'de günsonu gönder** → `POST /api/v1/gunson`
5. **Kararları oku** → `GET /api/v1/kararlar`

### Veri Güvenliği
- Tüm veriler banka sunucusunda işlenir
- Dışarıya hiçbir veri çıkmaz
- API sadece iç ağda (intranet) çalışır
    """,
    version="1.0.0",
    contact={"name": "ATM Guard Team"},
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    # Prod'da banka iç IP'leri ile kısıtla
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Singleton Brain ─────────────────────────────────────────────────────────
_brain: Optional[ATMBrainOrchestrator] = None
_brain_hafiza_yuklendi: bool = False

def get_brain() -> ATMBrainOrchestrator:
    global _brain, _brain_hafiza_yuklendi
    if _brain is None:
        _brain = ATMBrainOrchestrator()
        logger.info("Brain başlatıldı")
    # İlk kez çağrıldığında kalıcı hafızayı yükle
    if not _brain_hafiza_yuklendi:
        _brain_hafiza_yuklendi = True
        sonuc = _brain.hafiza_yukle()
        if sonuc.get("durum") == "yuklendi":
            logger.info(
                f"⚡ Beyin önceki hafızasıyla uyandı — "
                f"{sonuc['yuklenen_atm']} ATM, v{sonuc['versiyon']}"
            )
    return _brain


# ═══════════════════════════════════════════════════════════════════════════
# BÖLÜM 1: REQUEST / RESPONSE MODELLERİ (Swagger'da görünür)
# ═══════════════════════════════════════════════════════════════════════════

class TerminalTanimRequest(BaseModel):
    """ATM terminal listesi. Günde bir kez gönderilir."""
    terminaller: List[Dict[str, Any]] = Field(
        ...,
        description="ATM tanım listesi. Her eleman en az terminal_id içermeli.",
        example=[{
            "terminal_id": "T-00123",
            "atm_adi": "Merkez Şube - E-Gişe 1",
            "zone": 2,
            "konum_tipi": "Branch",
            "sube_personel_var": True,
            "nakit_merkezi": "İstanbul CIT",
        }]
    )

class ArizaFeedRequest(BaseModel):
    """Online arıza feed — 15 dakikada bir gönderilir."""
    olaylar: List[Dict[str, Any]] = Field(
        ...,
        description="Arıza olay listesi",
        example=[{
            "terminal_id": "T-00123",
            "tarih": "2026-02-22T14:30:00",
            "ariza_kodu": "PAPER_JAM",
            "aciklama": "Kağıt sıkışması — fiş yuvası",
            "durum": "ACIK",
            "sure_dk": 45,
        }]
    )

class BakiyeFeedRequest(BaseModel):
    """Online bakiye feed — anlık veya 15 dk'da bir gönderilir."""
    bakiyeler: List[Dict[str, Any]] = Field(
        ...,
        description="ATM bakiye listesi",
        example=[{
            "terminal_id": "T-00123",
            "zaman": "2026-02-22T14:30:00",
            "tl_bakiye": 75000,
            "kaset_1": 20000,
            "kaset_2": 15000,
            "kaset_3": 25000,
            "kaset_4": 15000,
            "recycle_bakiye": 850000,
            "yatan_para": 120000,
        }]
    )

class GunsonRequest(BaseModel):
    """Günsonu batch — her gece 03:00'de gönderilir."""
    kayitlar: List[Dict[str, Any]] = Field(
        ...,
        description="Günsonu kayıt listesi",
        example=[{
            "terminal_id": "T-00123",
            "tarih": "2026-02-22",
            "sifirlama_yapildi": False,
            "ikmal_tutar": 500000,
            "toplama_tutar": 0,
            "toplam_cekim": 185000,
            "toplam_yatirma": 45000,
        }]
    )

class ExpressLogRequest(BaseModel):
    """Anlık express log satırı."""
    terminal_id: str = Field(..., example="T-00123")
    log_satiri: str  = Field(..., example="2026-02-22 14:32:11 CCDM JAM ERROR — Kaset 2")

class GeriBildirimRequest(BaseModel):
    """Operasyon ekibinin karar geri bildirimi."""
    terminal_id: str           = Field(..., example="T-00123")
    gerceklesen_eylem: str     = Field(..., example="FLM_VENDOR", description="FLM / SLM / IKMAL / PARA_TOPLAMA / COMBINED_SERVICE")
    tarih: Optional[str]       = Field(None, example="2026-02-22T16:00:00")

class KararlarResponse(BaseModel):
    """Tüm aktif kararların listesi."""
    zaman: str
    toplam_karar: int
    kritik_sayisi: int
    kararlar: List[Dict[str, Any]]

class ProaktifOzet(BaseModel):
    """Proaktif tahmin motoru istatistikleri."""
    aktif: bool
    model_surumu: Optional[str] = None
    proaktif_ikmal: int
    proaktif_mudahale: int
    proaktif_izle: int
    toplam_proaktif: int
    onlenen_acil_tahmini: float


class OzetResponse(BaseModel):
    """Özet istatistikler (proaktif tahmin dahil)."""
    zaman: str
    toplam_atm: int
    kritik_atm: int
    yuksek_atm: int
    kombine_servis: int
    flm_gerekli: int
    slm_gerekli: int
    ikmal_gerekli: int
    toplama_gerekli: int
    toplam_tahmini_maliyet: float
    toplam_tahmini_tasarruf: float
    proaktif: Optional[ProaktifOzet] = None


# ═══════════════════════════════════════════════════════════════════════════
# BÖLÜM 2: ENDPOINT'LER
# ═══════════════════════════════════════════════════════════════════════════

# ── Sağlık ─────────────────────────────────────────────────────────────────
@app.get("/", tags=["Sistem"], summary="API Sağlık Kontrolü")
def root():
    """API çalışıyor mu? Yazılım ekibi bunu test eder."""
    return {
        "durum": "çalışıyor",
        "versiyon": "1.0.0",
        "zaman": datetime.now().isoformat(),
        "swagger": "/docs",
    }

@app.get("/api/v1/saglik", tags=["Sistem"], summary="Detaylı Sağlık Kontrolü")
def saglik():
    """Motor durumu, yüklü ATM sayısı, son karar zamanı."""
    brain = get_brain()
    return {
        "durum": "OK",
        "yuklenen_atm": len(brain._terminal_tanim),
        "aktif_ariza": sum(len(v) for v in brain._aktif_arizalar.values()),
        "bakiye_kaydi": len(brain._son_bakiye),
        "zaman": datetime.now().isoformat(),
    }


# ── Feed Endpoint'leri ──────────────────────────────────────────────────────
@app.post(
    "/api/v1/terminal-tanim",
    tags=["Feed — Arıza Tarafı"],
    summary="ATM Terminal Listesini Yükle",
    status_code=status.HTTP_200_OK,
)
def terminal_tanim_yukle(req: TerminalTanimRequest):
    """
    ATM master listesini yükler.
    **Ne zaman çağrılır:** Günde bir kez, sabah ilk iş olarak.
    **Kim gönderir:** ATM yönetim sistemi / banka core.
    """
    brain = get_brain()
    brain.ingest_terminal_tanim(req.terminaller)
    return {
        "basarili": True,
        "yuklenen": len(req.terminaller),
        "mesaj": f"{len(req.terminaller)} terminal tanımı yüklendi",
    }

@app.post(
    "/api/v1/ariza-feed",
    tags=["Feed — Arıza Tarafı"],
    summary="Online Arıza Raporunu Gönder (15 dk'da bir)",
    status_code=status.HTTP_200_OK,
)
def ariza_feed_al(req: ArizaFeedRequest, background_tasks: BackgroundTasks):
    """
    Anlık arıza event'lerini alır.
    
    **Ne zaman çağrılır:** 15 dakikada bir (veya yeni arıza oluşunca anlık).
    **Kim gönderir:** ATM monitoring sistemi.
    
    `durum` alanı: `ACIK` / `KAPALI` / `DEVAM_EDIYOR`
    
    Kapalıya alınan arızalar bellekten otomatik temizlenir.
    """
    brain = get_brain()
    brain.ingest_ariza_feed(req.olaylar)
    return {
        "basarili": True,
        "alinan": len(req.olaylar),
        "mesaj": f"{len(req.olaylar)} arıza olayı işlendi",
    }

@app.post(
    "/api/v1/bakiye-feed",
    tags=["Feed — Cash Tarafı"],
    summary="Anlık Bakiye Verisini Gönder",
    status_code=status.HTTP_200_OK,
)
def bakiye_feed_al(req: BakiyeFeedRequest):
    """
    ATM nakit durumunu alır (tl_bakiye, kaset_1..8, recycle, yatan_para).
    
    **Ne zaman çağrılır:** 15 dk'da bir veya kaset değişince anlık.
    **Kim gönderir:** Cash management sistemi / ATM host.
    
    `-` veya boş değerler otomatik 0 kabul edilir.
    """
    brain = get_brain()
    brain.ingest_bakiye_feed(req.bakiyeler)
    return {
        "basarili": True,
        "guncellenen": len(req.bakiyeler),
        "mesaj": f"{len(req.bakiyeler)} ATM bakiyesi güncellendi",
    }

@app.post(
    "/api/v1/gunson",
    tags=["Feed — Cash Tarafı"],
    summary="Günsonu Batch Verisini Gönder (Her gece 03:00)",
    status_code=status.HTTP_200_OK,
)
def gunson_al(req: GunsonRequest, background_tasks: BackgroundTasks):
    """
    Günsonu özet verisini alır ve modeli otomatik günceller (incremental learning).
    
    **Ne zaman çağrılır:** Her gece 03:00'de otomatik.
    **Kim gönderir:** Core banking batch süreci.
    
    Bu endpoint çağrıldıktan sonra motor arka planda kendini günceller.
    """
    brain = get_brain()
    # Arka planda incremental learning
    background_tasks.add_task(brain.ingest_gunson, req.kayitlar)
    return {
        "basarili": True,
        "alinan": len(req.kayitlar),
        "mesaj": f"{len(req.kayitlar)} günsonu kaydı alındı, motor güncellenecek",
    }

@app.post(
    "/api/v1/express-log",
    tags=["Feed — Arıza Tarafı"],
    summary="Anlık Express Log Satırı Gönder",
    status_code=status.HTTP_200_OK,
)
def express_log_al(req: ExpressLogRequest):
    """
    ATM'den gelen tek satır express log.
    Kritik hata içeriyorsa otomatik arıza olayı oluşturulur.
    
    **Ne zaman çağrılır:** Log satırı oluşunca anlık (stream).
    """
    brain = get_brain()
    brain.ingest_express_log(req.log_satiri, req.terminal_id)
    return {"basarili": True, "mesaj": "Log işlendi"}


class BrmLogAnalizRequest(BaseModel):
    atm_id: str
    log_date: Optional[str]   = None
    errors:   List[Dict]      = []
    health_score: Optional[int] = None


@app.post(
    "/api/v1/brm-log-analiz",
    tags=["Feed — Arıza Tarafı"],
    summary="BRM Log Analizi — Parser çıktısını beyne besle, gerçek AI kararı al",
    status_code=status.HTTP_200_OK,
)
def brm_log_analiz(req: BrmLogAnalizRequest):
    """
    Frontend BRM log parser'ın ürettiği JSON'u alır, hataları beyne besler
    ve `ATMBrainOrchestrator`'ın gerçek kararını döner.

    Akış:
    1. Her error satırını `ingest_ariza_feed()` ile beyne yükle
    2. `run_full_decision_cycle(atm_listesi=[atm_id])` çalıştır
    3. `BeyinKarari.to_dict()` döndür
    """
    brain = get_brain()

    # ── 1) Önce bu ATM'nin önceki arızalarını temizle (taze analiz) ──────────
    if req.atm_id in brain._aktif_arizalar:
        del brain._aktif_arizalar[req.atm_id]

    # ── 2) Hata satırlarını arıza feed'ine dönüştür ──────────────────────────
    if req.errors:
        ariza_feed = []
        for e in req.errors:
            ts_raw = e.get("timestamp")
            try:
                ts = datetime.fromisoformat(str(ts_raw)).isoformat() if ts_raw else datetime.now().isoformat()
            except Exception:
                ts = datetime.now().isoformat()

            # Servis tipi: parser'dan gelen service_type alanını kullan
            # SLM → NAKIT_MODÜL keyword'ü ile beyin SLM_VENDOR kararı verir
            # FLM → SHUTTER/JAM/CCDM keyword'leri ile FLM_VENDOR kararı verir
            # Bilinmeyen → description keyword match'e bırak, fallback FLM
            hex_code = str(e.get("error_code", "UNKNOWN"))
            desc = str(e.get("description", "")).strip().upper()
            service_type = str(e.get("service_type", "FLM")).upper()

            SLM_KEYWORDS = {"NAKIT_MODÜL": "NAKIT_MODÜL", "RECYCLER": "RECYCLER", "DISPENSER": "DISPENSER"}
            FLM_KEYWORDS = {"SHUTTER": "SHUTTER", "JAM": "JAM", "CCDM": "CCDM"}

            if service_type == "SLM":
                # Nakit modülü hardware arızası → NAKIT_MODÜL keyword → beyin SLM seçer
                ariza_kodu = f"NAKIT_MODÜL {desc}"
            else:
                # Açıklamada zaten JAM/SHUTTER/CCDM gibi FLM kelimesi varsa doğrudan kullan
                ariza_kodu = desc if desc else hex_code

            ariza_feed.append({
                "terminal_id": req.atm_id,
                "tarih":       ts,
                "ariza_kodu":  ariza_kodu,
                "aciklama":    f"{hex_code}: {e.get('description', '')}",
                "durum":       "ACIK",
                "sure_dk":     max(0, int((datetime.now() - datetime.fromisoformat(ts)).total_seconds() / 60)) if ts else 0,
                "vendor_log":  f"{e.get('command', '')} [{hex_code}]",
            })
        # ATM ilk kez görülüyorsa tanım kaydı oluştur — beyin öğrenme profili başlatır
        if req.atm_id not in brain._terminal_tanim:
            brain.ingest_terminal_tanim([{"terminal_id": req.atm_id}])

        brain.ingest_ariza_feed(ariza_feed)
        ogrenme_sayisi = len(ariza_feed)
        logger.info(f"[BRM LOG ANALİZ] {ogrenme_sayisi} arıza beyne beslendi → ATM: {req.atm_id}")
    else:
        ogrenme_sayisi = 0

    # ── 4) Müdahale bölgelerini topla (benzersiz, parser'dan gelen module alanı) ──
    affected_modules: list = []
    if req.errors:
        seen_modules: set = set()
        for e in req.errors:
            m = str(e.get("module", "")).strip()
            if m and m not in seen_modules:
                seen_modules.add(m)
                affected_modules.append(m)

    # ── 5) Geçmiş risk skoru (öğrenme sonrası güncellenmiş) ─────────────────
    tanim = brain._terminal_tanim.get(req.atm_id)
    gecmis_risk_skoru = float(tanim.__dict__.get("gecmis_risk_skoru") or 0.0) if tanim else 0.0

    # ── 6) Karar döngüsünü sadece bu ATM için çalıştır ───────────────────────
    kararlar = brain.run_full_decision_cycle(atm_listesi=[req.atm_id])

    if not kararlar:
        return {
            "terminal_id":        req.atm_id,
            "eylem":              "IZLE",
            "aciliyet":           "DUSUK",
            "mesaj":              "Kritik arıza tespit edilmedi — rutin izleme yeterli",
            "sebepler":           [],
            "ariza_riski":        0.0,
            "nakit_sure_saat":    999.0,
            "atanan_takim":       "—",
            "kombine_isler":      [],
            "affected_modules":   affected_modules,
            "ogrenme_sayisi":     ogrenme_sayisi,
            "gecmis_risk_skoru":  gecmis_risk_skoru,
        }

    result = kararlar[0].to_dict()
    result["affected_modules"]  = affected_modules
    result["ogrenme_sayisi"]    = ogrenme_sayisi
    result["gecmis_risk_skoru"] = gecmis_risk_skoru
    return result


# ── Karar Endpoint'leri ─────────────────────────────────────────────────────
@app.get(
    "/api/v1/kararlar",
    tags=["Kararlar"],
    summary="Tüm Aktif Kararları Al",
    response_model=KararlarResponse,
)
def kararlar_al(
    sadece_kritik: bool = False,
    limit: int = 500,
):
    """
    Motor tüm ATM'leri tarar ve güncel kararlar listesini döner.
    
    **Filtreler:**
    - `sadece_kritik=true` → Sadece KRİTİK seviye kararlar
    - `limit` → Maksimum kaç karar dönsün (varsayılan 500)
    
    **Çıktı sırası:** KRİTİK → YÜKSEK → ORTA → DÜŞÜK
    """
    brain = get_brain()
    kararlar = brain.run_full_decision_cycle()

    if sadece_kritik:
        kararlar = [k for k in kararlar if k.aciliyet == "KRITIK"]

    kararlar = kararlar[:limit]

    return KararlarResponse(
        zaman=datetime.now().isoformat(),
        toplam_karar=len(kararlar),
        kritik_sayisi=sum(1 for k in kararlar if k.aciliyet == "KRITIK"),
        kararlar=[k.to_dict() for k in kararlar],
    )

@app.get(
    "/api/v1/karar/{terminal_id}",
    tags=["Kararlar"],
    summary="Tek ATM İçin Karar Al",
)
def tek_karar(terminal_id: str):
    """
    Belirtilen ATM için anlık karar üretir.
    
    **Kullanım:** Operatör belirli bir ATM'i sorgulamak istediğinde.
    """
    brain = get_brain()
    kararlar = brain.run_full_decision_cycle(atm_listesi=[terminal_id])
    if not kararlar:
        return {"terminal_id": terminal_id, "eylem": "IZLE", "mesaj": "Aksiyon gerektiren durum yok"}
    return kararlar[0].to_dict()

@app.get(
    "/api/v1/ozet",
    tags=["Kararlar"],
    summary="Özet İstatistik",
    response_model=OzetResponse,
)
def ozet():
    """
    Tüm sistemin anlık özeti.
    Dashboard'a, e-posta raporuna veya SMS alarmına beslenebilir.
    """
    brain = get_brain()
    kararlar = brain.run_full_decision_cycle()
    o = brain.ozet_rapor(kararlar)
    return OzetResponse(**o)

@app.post(
    "/api/v1/geri-bildirim",
    tags=["Öğrenme"],
    summary="Karar Geri Bildirimi Gönder (Motor Öğrenir)",
    status_code=status.HTTP_200_OK,
)
def geri_bildirim(req: GeriBildirimRequest):
    """
    Operasyon ekibi bir işlemi tamamladığında çağrılır.
    Motor tahmininin doğru olup olmadığını öğrenir.
    
    **Ne zaman çağrılır:** Teknisyen iş emrini kapattığında.
    **Kim gönderir:** İş emri / ticketing sistemi (JIRA, ServiceNow, vb.).
    
    Bu feed ne kadar düzenli gelirse motor o kadar iyi öğrenir.
    """
    brain = get_brain()
    brain.geri_bildirim_ver(req.terminal_id, req.gerceklesen_eylem, req.tarih)
    return {
        "basarili": True,
        "mesaj": f"{req.terminal_id} için geri bildirim kaydedildi. Motor öğrendi.",
    }


# ── Toplu Geçmiş Öğrenme (UI'dan yüklenen Excel/CSV) ─────────────────────

class TopluOgretRequest(BaseModel):
    """UI'dan yüklenen ve `ai_engine/uploads/` klasörüne kaydedilen JSON dosyası."""
    dosya_adi: str = Field(
        ...,
        description="ai_engine/uploads/ altındaki dosya adı (train-upload API tarafından oluşturulur)",
        example="ariza_log_2026_01_1234567890.json",
    )

@app.post(
    "/api/v1/toplu-ogret",
    tags=["Öğrenme"],
    summary="Geçmiş Excel/CSV Verisiyle Beyni Besle (Manuel Öğrenme)",
    status_code=status.HTTP_200_OK,
)
def toplu_ogret(req: TopluOgretRequest, background_tasks: BackgroundTasks):
    """
    UI'dan yüklenen toplu geçmiş veriyi beyne besler.

    **Akış:**
    1. Next.js `train-upload` API'si dosyayı Excel→JSON olarak kaydeder
    2. Bu endpoint kaydedilen JSON'u okur
    3. `veri_turu`'na göre doğru beyin metodunu çağırır:
       - `ariza_log`     → `ingest_gecmis_ariza()`   → risk skorları güncellenir
       - `ikmal`         → `ingest_gecmis_nakit()`   → ikmal kalıpları öğrenilir
       - `para_toplama`  → `ingest_gecmis_nakit()`   → toplama kalıpları öğrenilir
       - `gunluk_bakiye` → `ingest_gecmis_nakit()`   → ETA tahminleri iyileşir
    4. Karar döngüsü yeniden çalışır → kararlar güncellenir
    5. Öğrenme raporu döner

    **Karar Mekanizmasına Etkisi:**
    - Arıza risk skorları yükselen ATM'ler → daha sık izleme
    - Kronik arızalı ATM'ler → SLM önceliği artar
    - Kişisel tüketim hızı → ETA daha doğru
    - Geçmiş ikmal ortalaması → acil/planlı ayrımı iyileşir
    """
    brain   = get_brain()
    uploads = Path(__file__).parent / "uploads"
    dosya   = uploads / req.dosya_adi

    if not dosya.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Dosya bulunamadı: {req.dosya_adi}. "
                   f"Önce /api/train-upload ile yükleyin.",
        )

    try:
        with open(dosya, encoding="utf-8") as f:
            icerik = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"JSON okunamadı: {e}")

    meta     = icerik.get("meta", {})
    data     = icerik.get("data", [])
    veri_turu = meta.get("veri_turu", "ariza_log")

    if not data:
        return {
            "basarili"        : False,
            "mesaj"           : "Dosya boş veya veri içermiyor.",
            "ogrenilen_atm"   : 0,
            "toplam_kayit"    : 0,
        }

    # ── Öğrenmeden ÖNCE snapshot al (hatalı veri yüklenirse geri dönülebilsin) ──
    snap_aciklama = f"Öğrenme öncesi otomatik yedek — {veri_turu} | {req.dosya_adi}"
    try:
        snap_ver = brain.snapshot_al(aciklama=snap_aciklama)
        logger.info(f"📸 Otomatik snapshot alındı: v{snap_ver}")
    except Exception as snap_err:
        snap_ver = None
        logger.warning(f"Snapshot alınamadı (öğrenme devam edecek): {snap_err}")

    # ── Beyin metodunu seç ──────────────────────────────────────────────────
    if veri_turu == "ariza_log":
        ogrenme = brain.ingest_gecmis_ariza(data)
    elif veri_turu in ("ikmal", "para_toplama", "gunluk_bakiye"):
        ogrenme = brain.ingest_gecmis_nakit(data, veri_turu)
    else:
        raise HTTPException(status_code=400, detail=f"Bilinmeyen veri türü: {veri_turu}")

    # ── Arka planda karar döngüsünü yeniden çalıştır ────────────────────────
    background_tasks.add_task(_karar_dongusunu_guncelle, brain)

    # ── Öğrenme özeti ───────────────────────────────────────────────────────
    ozet = brain.gecmis_ogrenme_ozeti()

    return {
        "basarili"          : True,
        "veri_turu"         : veri_turu,
        "dosya"             : req.dosya_adi,
        "ogrenilen_atm"     : ogrenme.get("ogrenilen_atm", 0),
        "toplam_kayit"      : ogrenme.get("toplam_ariza", ogrenme.get("toplam_kayit", 0)),
        "karar_etkisi"      : ozet["karar_mekanizmasi"],
        "ogrenme_ozeti"     : {
            "risk_skoru_guncellenen_atm" : ozet["karar_mekanizmasi"]["risk_skoru_guncellendi"],
            "eta_guncellenen_atm"        : ozet["karar_mekanizmasi"]["eta_guncellendi"],
            "kronik_ariza_atm"           : ozet["karar_mekanizmasi"]["kronik_ariza_tespit"],
            "toplam_ogrenen_atm"         : ozet["toplam_ogrenen_atm"],
        },
        "onceki_snapshot"   : snap_ver,   # Hatalı öğrenme olursa bu versiyona geri dön
        "mesaj": (
            f"✅ {ogrenme.get('ogrenilen_atm', 0)} ATM öğrendi — "
            f"karar mekanizması güncellendi. "
            f"Bir sonraki karar döngüsü bu bilgileri kullanacak."
        ),
    }


def _karar_dongusunu_guncelle(brain: "ATMBrainOrchestrator"):
    """Arka planda karar döngüsünü yeniden çalıştır ve hafızayı kaydet."""
    try:
        kararlar = brain.run_full_decision_cycle()
        logger.info(f"[ÖĞRENME SONRASI] Karar döngüsü güncellendi: {len(kararlar)} karar")
        brain.hafiza_kaydet(aciklama="Otomatik kayıt — karar döngüsü sonrası")
        logger.info("✅ Beyin hafızası otomatik kaydedildi")
    except Exception as e:
        logger.error(f"Karar döngüsü güncellenemedi: {e}")


@app.get(
    "/api/v1/ogrenme-ozeti",
    tags=["Öğrenme"],
    summary="Geçmiş Öğrenmeden Ne Değişti?",
    status_code=status.HTTP_200_OK,
)
def ogrenme_ozeti():
    """
    Toplu yüklemelerden beynin ne öğrendiğini gösterir.
    Karar mekanizmasına etkisini döner.
    """
    brain = get_brain()
    return brain.gecmis_ogrenme_ozeti()


# ═══════════════════════════════════════════════════════════════════════════
# BÖLÜM 4: HAFIZA VE VERSİYONLAMA
# ═══════════════════════════════════════════════════════════════════════════


# ── Manuel Kural Öğretme ────────────────────────────────────────────────────

class ManuelKuralRequest(BaseModel):
    flm_esik_saat: Optional[float] = Field(None, description="FLM eşiği (saat). Örn: 2.5")
    slm_risk_yuzde: Optional[float] = Field(None, description="SLM tetikleme risk eşiği (%). Örn: 70")
    ogrenme_notu: Optional[str]     = Field(None, description="Serbest metin — mevsimsel, bölgesel, donanım notu")
    etkilenen_atm_idler: Optional[List[str]] = Field(
        None, description="Kural sadece bu ATM'lere uygulanır. Boş = tüm ATM'ler"
    )


@app.post(
    "/api/v1/beyin/kural",
    tags=["Öğrenme"],
    summary="Manuel Kural Öğret (FLM Eşik / SLM Risk / Serbest Not)",
    status_code=status.HTTP_200_OK,
)
def manuel_kural_ogret(req: ManuelKuralRequest):
    """
    Operasyon uzmanının UI'dan yazdığı eşikler ve notları beyne kaydet.

    - `flm_esik_saat` verilirse BusinessRules'daki FLM eşiği override edilir.
    - `slm_risk_yuzde` verilirse SLM tetikleme olasılık eşiği güncellenir.
    - `ogrenme_notu` varsa beyin hafızasına kural notu olarak yazılır.
    - `etkilenen_atm_idler` belirtilirse sadece o ATM'lerin risk profiline eklenir.
    """
    brain = get_brain()
    degisiklikler = []

    # ── 1) FLM eşiği override ───────────────────────────────────────────────
    if req.flm_esik_saat is not None and req.flm_esik_saat > 0:
        from atm_brain_orchestrator import BusinessRules
        BusinessRules.FLM_ESIK_SAAT = req.flm_esik_saat
        degisiklikler.append(f"FLM eşiği → {req.flm_esik_saat:.1f} saat")

    # ── 2) SLM risk eşiği override ──────────────────────────────────────────
    if req.slm_risk_yuzde is not None and 0 < req.slm_risk_yuzde <= 100:
        from atm_brain_orchestrator import BusinessRules
        BusinessRules.SLM_RISK_ESIK = req.slm_risk_yuzde / 100.0
        degisiklikler.append(f"SLM risk eşiği → %{req.slm_risk_yuzde:.0f}")

    # ── 3) Serbest not → etkilenen ATM'lerin risk profiline ekle ────────────
    if req.ogrenme_notu:
        atm_listesi = req.etkilenen_atm_idler or list(brain._terminal_tanim.keys())
        for tid in atm_listesi:
            if tid in brain._terminal_tanim:
                mevcut = brain._terminal_tanim[tid].__dict__.get("operator_notlari", "")
                zaman  = datetime.now().strftime("%Y-%m-%d")
                brain._terminal_tanim[tid].__dict__["operator_notlari"] = (
                    f"{mevcut}\n[{zaman}] {req.ogrenme_notu}".strip()
                )
        degisiklikler.append(
            f"Operatör notu eklendi → {len(atm_listesi)} ATM"
        )

    # ── 4) Kalıcı hafızaya kaydet ────────────────────────────────────────────
    if degisiklikler:
        aciklama = "Manuel kural: " + " | ".join(degisiklikler)
        brain.hafiza_kaydet(aciklama=aciklama)

    return {
        "basarili"     : True,
        "degisiklikler": degisiklikler,
        "mesaj"        : (
            "Kurallar beyne uygulandı ve kalıcı hafızaya kaydedildi. "
            "Bir sonraki karar döngüsünde devreye girer."
            if degisiklikler
            else "Değiştirilecek kural bulunamadı — en az bir alan doldurun."
        ),
    }


@app.get(
    "/api/v1/beyin/hafiza-durumu",
    tags=["Hafıza & Versiyonlama"],
    summary="Beyin Hafızası Durumu",
    status_code=status.HTTP_200_OK,
)
def hafiza_durumu():
    """Beynin aktif öğrenme durumunu ve son kayıt bilgisini döner."""
    brain = get_brain()
    return brain.hafiza_durumu()


@app.post(
    "/api/v1/beyin/kaydet",
    tags=["Hafıza & Versiyonlama"],
    summary="Beyin Hafızasını Manuel Kaydet",
    status_code=status.HTTP_200_OK,
)
def hafiza_kaydet(aciklama: str = ""):
    """Beynin mevcut halini manuel olarak kaydeder."""
    brain   = get_brain()
    versiyon = brain.hafiza_kaydet(aciklama=aciklama)
    return {"durum": "kaydedildi", "versiyon": versiyon, "aciklama": aciklama}


@app.get(
    "/api/v1/beyin/versiyonlar",
    tags=["Hafıza & Versiyonlama"],
    summary="Tüm Snapshot Versiyonlarını Listele",
    status_code=status.HTTP_200_OK,
)
def versiyonlar():
    """Kayıtlı tüm snapshot versiyonlarını listeler (yeniden eskiye)."""
    brain = get_brain()
    return {
        "hafiza": brain.hafiza_durumu(),
        "snapshots": brain.snapshot_listesi(),
    }


class SnapshotAlRequest(BaseModel):
    aciklama: str = ""

@app.post(
    "/api/v1/beyin/snapshot",
    tags=["Hafıza & Versiyonlama"],
    summary="Manuel Snapshot Al (Güvenlik Kopyası)",
    status_code=status.HTTP_200_OK,
)
def snapshot_al(req: SnapshotAlRequest):
    """Mevcut beyin durumunun anlık kopyasını alır. Büyük yüklemeden önce kullanın."""
    brain    = get_brain()
    versiyon = brain.snapshot_al(aciklama=req.aciklama)
    return {
        "durum"    : "snapshot_alindi",
        "versiyon" : versiyon,
        "aciklama" : req.aciklama,
    }


@app.post(
    "/api/v1/beyin/geri-yukle/{versiyon}",
    tags=["Hafıza & Versiyonlama"],
    summary="Snapshot'a Geri Dön",
    status_code=status.HTTP_200_OK,
)
def snapshot_geri_yukle(versiyon: str):
    """
    Belirtilen snapshot versiyonuna geri döner.
    Tüm sonraki öğrenmeler silinir — dikkatli kullanın.
    """
    brain = get_brain()
    try:
        sonuc = brain.snapshot_yukle(versiyon)
        return sonuc
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Snapshot bulunamadı: {versiyon}",
        )


@app.post(
    "/api/v1/demo/yukle",
    tags=["Demo & Test"],
    summary="Demo Veriyi Yükle (Gerçek JSON dosyalarından)",
    status_code=status.HTTP_200_OK,
)
def demo_yukle():
    """
    Yazılım ekibi için demo: mevcut kasa_durum_raporu.json ve atm_master.json
    dosyalarını yükler ve beyin hazır hale gelir.
    """
    brain = get_brain()

    # Terminal tanım
    try:
        master_path = Path(__file__).parent.parent / "src" / "data" / "atm_master.json"
        with open(master_path, encoding="utf-8") as f:
            master = json.load(f)
        brain.ingest_terminal_tanim(master[:100])
        terminal_sayisi = len(brain._terminal_tanim)
    except Exception as e:
        terminal_sayisi = 0
        logger.warning(f"Master yüklenemedi: {e}")

    # Bakiye
    try:
        kasa_path = Path(__file__).parent.parent / "kasa_durum_raporu.json"
        with open(kasa_path, encoding="utf-8") as f:
            kasa = json.load(f)
        bakiye_feed = []
        for row in kasa[:100]:
            bakiye_feed.append({
                "terminal_id"    : row.get("ATM ID", ""),
                "tl_bakiye"      : row.get("TL Bakiye", 0),
                "kaset_1"        : row.get("Kaset 1", 0),
                "kaset_2"        : row.get("Kaset 2", 0),
                "kaset_3"        : row.get("Kaset 3", 0),
                "kaset_4"        : row.get("Kaset 4", 0),
                "recycle_bakiye" : row.get("Recycle Bakiye", 0),
                "yatan_para"     : row.get("Recycle Kasa 4: ALL-IN", 0),
            })
        brain.ingest_bakiye_feed(bakiye_feed)
        bakiye_sayisi = len(brain._son_bakiye)
    except Exception as e:
        bakiye_sayisi = 0
        logger.warning(f"Kasa yüklenemedi: {e}")

    return {
        "basarili"      : True,
        "terminal_sayisi": terminal_sayisi,
        "bakiye_sayisi"  : bakiye_sayisi,
        "mesaj"          : "Demo veri yüklendi. /api/v1/kararlar ile kararları görün.",
        "swagger"        : "http://localhost:8000/docs",
    }

@app.get(
    "/api/v1/format-rehberi",
    tags=["Demo & Test"],
    summary="Tüm Feed Format Örnekleri",
)
def format_rehberi():
    """
    Yazılım ekibine teslim edilen format kılavuzu.
    Her feed'in beklenen JSON formatı bu endpoint'te gösterilir.
    """
    return {
        "versiyon": "1.0.0",
        "aciklama": "ATM Guard feed format örnekleri",
        "feedler": {
            "1_terminal_tanim": {
                "endpoint"    : "POST /api/v1/terminal-tanim",
                "frekans"     : "Günde 1 kez",
                "zorunlu_alanlar": ["terminal_id"],
                "ornek": {
                    "terminal_id"     : "T-00123",
                    "atm_adi"         : "Merkez Şube - E-Gişe 1",
                    "zone"            : 2,
                    "konum_tipi"      : "Branch",
                    "sube_personel_var": True,
                    "nakit_merkezi"   : "İstanbul CIT",
                    "atm_modeli"      : "NCR SelfServ 6622",
                }
            },
            "2_ariza_feed": {
                "endpoint"    : "POST /api/v1/ariza-feed",
                "frekans"     : "15 dakikada 1 (veya anlık)",
                "zorunlu_alanlar": ["terminal_id", "ariza_kodu", "durum"],
                "durum_degerleri": ["ACIK", "KAPALI", "DEVAM_EDIYOR"],
                "ornek": {
                    "terminal_id" : "T-00123",
                    "tarih"       : "2026-02-22T14:30:00",
                    "ariza_kodu"  : "PAPER_JAM",
                    "aciklama"    : "Kağıt sıkışması — fiş yuvası",
                    "durum"       : "ACIK",
                    "sure_dk"     : 45,
                }
            },
            "3_bakiye_feed": {
                "endpoint"    : "POST /api/v1/bakiye-feed",
                "frekans"     : "15 dakikada 1",
                "zorunlu_alanlar": ["terminal_id", "tl_bakiye"],
                "not"         : "'-' veya boş değerler 0 kabul edilir",
                "ornek": {
                    "terminal_id"    : "T-00123",
                    "zaman"          : "2026-02-22T14:30:00",
                    "tl_bakiye"      : 75000,
                    "kaset_1"        : 20000,
                    "kaset_2"        : 15000,
                    "kaset_3"        : 25000,
                    "kaset_4"        : 15000,
                    "kaset_5"        : 0,
                    "kaset_6"        : 0,
                    "kaset_7"        : 0,
                    "kaset_8"        : 0,
                    "recycle_bakiye" : 850000,
                    "yatan_para"     : 120000,
                }
            },
            "4_gunson": {
                "endpoint"    : "POST /api/v1/gunson",
                "frekans"     : "Her gece 03:00",
                "zorunlu_alanlar": ["terminal_id", "tarih"],
                "ornek": {
                    "terminal_id"      : "T-00123",
                    "tarih"            : "2026-02-22",
                    "sifirlama_yapildi": False,
                    "ikmal_tutar"      : 500000,
                    "toplama_tutar"    : 0,
                    "toplam_cekim"     : 185000,
                    "toplam_yatirma"   : 45000,
                }
            },
            "5_geri_bildirim": {
                "endpoint"    : "POST /api/v1/geri-bildirim",
                "frekans"     : "İş emri kapandığında",
                "aciklama"    : "Motor bu bilgiyle öğrenir, tahminler giderek iyileşir",
                "eylem_degerleri": ["FLM_VENDOR", "SLM_VENDOR", "IKMAL", "PARA_TOPLAMA", "COMBINED_SERVICE", "SUBE_PERSONEL"],
                "ornek": {
                    "terminal_id"        : "T-00123",
                    "gerceklesen_eylem"  : "FLM_VENDOR",
                    "tarih"              : "2026-02-22T16:00:00",
                }
            },
        },
        "karar_okuma": {
            "endpoint"  : "GET /api/v1/kararlar",
            "frekans"   : "İstediğiniz sıklıkta (öneri: 15 dk'da 1)",
            "filtreler" : "?sadece_kritik=true | ?limit=100",
            "karar_alanlari": {
                "terminal_id"      : "ATM kimliği",
                "eylem"            : "COMBINED_SERVICE / FLM_VENDOR / SLM_VENDOR / IKMAL / PARA_TOPLAMA",
                "aciliyet"         : "KRITIK / YUKSEK / ORTA / DUSUK",
                "atanan_takim"     : "Bantaş_CIT / Vendor_Teknisyen / Şube_Personeli",
                "tahmini_maliyet"  : "TL cinsinden tahmini maliyet",
                "tahmini_tasarruf" : "TL cinsinden tasarruf (kombine servis fırsatı)",
                "kombine_isler"    : "Birleştirilen işler listesi",
                "sebepler"         : "Kararın gerekçeleri",
            }
        }
    }


# ═══════════════════════════════════════════════════════════════════════════
# BAŞLAT
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\n" + "═" * 65)
    print("  ATM GUARD — API SERVER")
    print("═" * 65)
    print("  Swagger (tüm endpoint'ler):  http://localhost:8000/docs")
    print("  ReDoc:                        http://localhost:8000/redoc")
    print("  Format rehberi:               http://localhost:8000/api/v1/format-rehberi")
    print("  Sağlık kontrolü:              http://localhost:8000/api/v1/saglik")
    print("═" * 65)
    print("  Yazılım ekibine bu adresi ver: http://SUNUCU_IP:8000/docs")
    print("═" * 65 + "\n")
    uvicorn.run("api_server:app", host="0.0.0.0", port=8000, reload=True, log_level="info")

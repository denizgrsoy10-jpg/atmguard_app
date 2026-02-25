# ATM Guard — Yazılım Ekibi Entegrasyon Kılavuzu
**Versiyon:** 1.0.0 | **Tarih:** Şubat 2026

---

## Sizden İstediğimiz Tek Şey: 5 Endpoint'e Veri Göndermek

Sistemin tamamı hazır. AI motoru çalışıyor, kararlar üretiliyor.  
Yazılım ekibinin yapacağı tek iş: mevcut feedleri bizim API'ye yönlendirmek.

---

## Kurulum

```bash
# Banka sunucusuna kopyala ve çalıştır
cd atmguard/ai_engine
pip install -r requirements.txt
python3 api_server.py
```

API ayağa kalkar:
- **Swagger (tüm endpoint'ler):** `http://SUNUCU_IP:8000/docs`
- **Format rehberi:**             `http://SUNUCU_IP:8000/api/v1/format-rehberi`

---

## Feed Tablosu — Ne Göndereceksiniz, Ne Zaman?

| # | Endpoint | Ne Zaman | Kim Tetikler |
|---|----------|----------|--------------|
| 1 | `POST /api/v1/terminal-tanim` | Günde 1 kez, sabah | ATM yönetim sistemi |
| 2 | `POST /api/v1/ariza-feed` | 15 dk'da 1 | ATM monitoring |
| 3 | `POST /api/v1/bakiye-feed` | 15 dk'da 1 | Cash management host |
| 4 | `POST /api/v1/gunson` | Her gece 03:00 | Core banking batch |
| 5 | `POST /api/v1/geri-bildirim` | İş emri kapandığında | Ticketing sistemi |

---

## Karar Okuma — Siz de Okuyabilirsiniz

```
GET /api/v1/kararlar               → Tüm kararlar
GET /api/v1/kararlar?sadece_kritik=true  → Sadece KRİTİK
GET /api/v1/karar/T-00123          → Tek ATM
GET /api/v1/ozet                   → Dashboard özeti
```

---

## Feed 1 — Terminal Tanım

```json
POST /api/v1/terminal-tanim
{
  "terminaller": [
    {
      "terminal_id": "T-00123",
      "atm_adi": "Merkez Şube - E-Gişe 1",
      "zone": 2,
      "konum_tipi": "Branch",
      "sube_personel_var": true,
      "nakit_merkezi": "İstanbul CIT"
    }
  ]
}
```

---

## Feed 2 — Arıza Feed (15 dk)

```json
POST /api/v1/ariza-feed
{
  "olaylar": [
    {
      "terminal_id": "T-00123",
      "tarih": "2026-02-22T14:30:00",
      "ariza_kodu": "PAPER_JAM",
      "aciklama": "Kağıt sıkışması - fiş yuvası",
      "durum": "ACIK",
      "sure_dk": 45
    }
  ]
}
```

`durum` değerleri: `ACIK` / `KAPALI` / `DEVAM_EDIYOR`

---

## Feed 3 — Bakiye Feed (15 dk)

```json
POST /api/v1/bakiye-feed
{
  "bakiyeler": [
    {
      "terminal_id": "T-00123",
      "zaman": "2026-02-22T14:30:00",
      "tl_bakiye": 75000,
      "kaset_1": 20000,
      "kaset_2": 15000,
      "kaset_3": 25000,
      "kaset_4": 15000,
      "kaset_5": 0,
      "kaset_6": 0,
      "kaset_7": 0,
      "kaset_8": 0,
      "recycle_bakiye": 850000,
      "yatan_para": 120000
    }
  ]
}
```

> ⚠️ `"-"` veya boş değerler otomatik `0` kabul edilir.

---

## Feed 4 — Günsonu (Her gece 03:00)

```json
POST /api/v1/gunson
{
  "kayitlar": [
    {
      "terminal_id": "T-00123",
      "tarih": "2026-02-22",
      "sifirlama_yapildi": false,
      "ikmal_tutar": 500000,
      "toplama_tutar": 0,
      "toplam_cekim": 185000,
      "toplam_yatirma": 45000
    }
  ]
}
```

---

## Feed 5 — Geri Bildirim (İş emri kapandığında)

```json
POST /api/v1/geri-bildirim
{
  "terminal_id": "T-00123",
  "gerceklesen_eylem": "FLM_VENDOR",
  "tarih": "2026-02-22T16:00:00"
}
```

`gerceklesen_eylem` değerleri:
`FLM_VENDOR` / `SLM_VENDOR` / `IKMAL` / `PARA_TOPLAMA` / `COMBINED_SERVICE` / `SUBE_PERSONEL`

---

## Karar Çıktısı — Aldığınız JSON

```json
{
  "terminal_id": "T-00123",
  "eylem": "COMBINED_SERVICE",
  "aciliyet": "KRITIK",
  "atanan_takim": "Bantaş_CIT",
  "tahmini_maliyet": 430.0,
  "tahmini_tasarruf": 250.0,
  "kombine_isler": ["FLM + IKMAL"],
  "sebepler": [
    "FLM arızası: PAPER_JAM (1.5s açık) — Bantaş gidecek",
    "KOMBİNE [FLM+İKMAL]: Bantaş giderken ikmal de yapacak → 250 TL tasarruf"
  ]
}
```

---

## Teknik Gereksinimler

| Gereksinim | Değer |
|------------|-------|
| Python | 3.10+ |
| RAM | 4 GB (önerilir 8 GB) |
| Port | 8000 (iç ağ) |
| Dış bağlantı | **YOK** — Tüm işlem banka sunucusunda |
| Veri çıkışı | **YOK** — Veri dışarıya gitmez |

---

## Sağlık Kontrolü

```bash
curl http://SUNUCU_IP:8000/api/v1/saglik
```

```json
{
  "durum": "OK",
  "yuklenen_atm": 2771,
  "aktif_ariza": 143,
  "bakiye_kaydi": 2771
}
```

---

*Tüm teknik sorular için: ATM Guard ekibi*

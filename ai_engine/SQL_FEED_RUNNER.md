# SQL Feed Runner — Banka Entegrasyon Rehberi

Banka SQL sorgularını beyne besleyen **canlı hortum** mekanizması.
Tamamen banka içinde / offline çalışır; dışarı veri çıkmaz.

```
Banka DB ──(SQL)──> sql_feed_runner.py ──(HTTP POST)──> Beyin API (:8000)
```

---

## Bileşenler

| Dosya | Görev |
|-------|-------|
| `config/feeds.yaml` | Hangi SQL → hangi endpoint, ne sıklıkla |
| `sql/*.sql` | 4 feed sorgusu (banka kendi şemasına göre düzenler) |
| `sql_feed_runner.py` | Sorguyu çalıştırır, beyne POST eder |
| `sql_feed_seed_mock.py` | Gerçek DB olmadan test için SQLite mock üretir |

---

## Feed → Endpoint eşlemesi

| Feed | SQL | Endpoint | Sıklık |
|------|-----|----------|--------|
| `terminal_master` | `sql/terminal_master.sql` | `POST /api/v1/terminal-tanim` | Günde 1 (06:00) |
| `ariza_feed` | `sql/ariza_feed.sql` | `POST /api/v1/ariza-feed` | 15 dk |
| `bakiye_feed` | `sql/bakiye_feed.sql` | `POST /api/v1/bakiye-feed` | 15 dk |
| `gunson_batch` | `sql/gunson_batch.sql` | `POST /api/v1/gunson` | Her gece 03:00 |

---

## SQL kolon beklentileri

Runner, SQL'in **döndürdüğü kolon adlarını** doğrudan beyne gönderir. Banka kendi
tablo/kolon adlarını `AS` ile bu kanonik adlara çevirmelidir.

**terminal_master:** `terminal_id`(zorunlu), `atm_adi`, `zone`, `konum_tipi`, `sube_personel_var`(0/1), `nakit_merkezi`

**ariza_feed:** `terminal_id`(zorunlu), `tarih`(ISO), `ariza_kodu`, `aciklama`, `durum`(ACIK/KAPALI/DEVAM_EDIYOR), `sure_dk`

**bakiye_feed:** `terminal_id`(zorunlu), `zaman`(ISO), `tl_bakiye`, `kaset_1..4`, `recycle_bakiye`, `yatan_para`

**gunson_batch:** `terminal_id`(zorunlu), `tarih`, `sifirlama_yapildi`(0/1), `ikmal_tutar`, `toplama_tutar`, `toplam_cekim`, `toplam_yatirma`

### Otomatik geçilen parametreler
- `:since` → `şimdi - lookback_minutes` (varsayılan 20 dk) — arıza/bakiye penceresi
- `:gun`   → bugünün tarihi (YYYY-MM-DD) — günsonu
- `:dun`   → dünün tarihi
- `:simdi` → tam zaman damgası

> `tarih`/`zaman` kolonu string ISO değilse, SQL içinde kendi tip dönüşümünüzü
> uygulayın (Oracle `TO_CHAR`, MSSQL `CONVERT`, Postgres `to_char`).

---

## Kurulum & Çalıştırma

### 1) Bağımlılıklar
```bash
pip install -r requirements.txt
# + banka DB sürücüsü (BİRİNİ):
pip install oracledb        # Oracle
# pip install pyodbc        # MSSQL
# pip install psycopg2-binary  # Postgres
```

### 2) Bağlantı (.env)
```bash
# Oracle örneği:
export BANK_DB_URL='oracle+oracledb://USER:PASS@host:1521/?service_name=BANKDB'
export BRAIN_URL='http://localhost:8000'
```

### 3) Test (gerçek DB olmadan — SQLite mock)
```bash
python sql_feed_seed_mock.py
export BANK_DB_URL='sqlite:///./mock_bank.db'

python sql_feed_runner.py --list                 # feed'leri gör
python sql_feed_runner.py --all-once --dry-run   # POST etmeden dene
python sql_feed_runner.py --all-once             # beyin açıkken gerçek besle
```

### 4) Canlı (banka)
```bash
# sql/*.sql dosyalarını banka şemasına göre düzenleyin, sonra:
python sql_feed_runner.py --all-once     # ilk dolum (terminal + güncel pencere)
python sql_feed_runner.py --schedule     # sürekli zamanlanmış besleme
```

---

## Komut özeti

| Komut | Ne yapar |
|-------|----------|
| `--list` | Feed'leri, endpoint ve zamanlamayı listeler |
| `--once FEED_ID` | Tek feed'i 1 kez çalıştırır |
| `--all-once` | Tüm feed'leri 1 kez çalıştırır (ilk dolum) |
| `--schedule` | Zamanlanmış sürekli çalışır (servis modu) |
| `--dry-run` | Beyne POST etmeden satırları okur ve örnek gösterir |

---

## Banka teslim checklist

- [ ] `pip install -r requirements.txt` + DB sürücüsü kuruldu
- [ ] `.env` içinde `BANK_DB_URL` dolduruldu
- [ ] `sql/*.sql` banka tablo/kolon adlarıyla düzenlendi (kanonik `AS` adları korunmalı)
- [ ] `python sql_feed_runner.py --all-once --dry-run` → satırlar doğru görünüyor
- [ ] Beyin açıkken `--all-once` → endpoint'ler 200 dönüyor
- [ ] `--schedule` servis olarak kuruldu (systemd / Windows Service / Task Scheduler)

---

## Güvenli davranış

- Beyin kapalıysa: runner hata loglar, çöker değil; bir sonraki turda tekrar dener.
- Satır yoksa: POST atlanır (boş istek gönderilmez).
- `:since` penceresi **örtüşmeli** (20 dk > 15 dk periyot) — kısa kesinti olursa
  veri kaçmaz; beyin tekrarları arıza tarafında günceller, çift kayıt açmaz.
- Büyük sonuçlar `batch_size` (varsayılan 500) ile parça parça gönderilir.

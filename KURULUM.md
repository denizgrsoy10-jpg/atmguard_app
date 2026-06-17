# ATM Guard — Banka Kurulum Rehberi

Program banka ortamına (VS Code) alındıktan sonra izlenecek adımlar.
Hedef: **tek seferde bağımlılıkları kur, hazırlığı doğrula, çalıştır.**

Sistem tamamen **banka içinde / offline** çalışır; dışarı veri çıkmaz.

---

## Gereksinimler

| Bileşen | Sürüm | Not |
|---------|-------|-----|
| Python | 3.10 – 3.12 | 3.13+ bazı ML kütüphaneleriyle uyumsuz olabilir |
| Node.js | 18+ | Frontend (dashboard) için |
| DB driver | duruma göre | Oracle → `oracledb`, MSSQL → `pyodbc`, Postgres → `psycopg2` |

---

## Hızlı Kurulum

### Linux / macOS / WSL

```bash
bash setup.sh
# Cash beyni dahil tam ML stack için:
ULTRA=1 bash setup.sh
```

### Windows (PowerShell)

```powershell
# 1) Beyin sanal ortamı
cd ai_engine
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
# (opsiyonel) cash beyni tam mod:
pip install -r requirements_ultra.txt

# 2) Hazırlık denetimi
python preflight_check.py

# 3) Frontend
cd ..
npm install

# 4) Ortam değişkenleri
copy .env.example .env
# .env içindeki değerleri düzenleyin (özellikle BANK_DB_URL)
```

---

## Hazırlık Denetimi (Preflight)

Her şeyin yerinde olup olmadığını **tek komutla** kontrol eder:

```bash
cd ai_engine
python preflight_check.py
```

Çıktı:
- ✅ geçti · ⚠️ uyarı (opsiyonel) · ❌ kritik (düzeltilmeli)
- Çıkış kodu `0` → kritik eksik yok, sistem çalışabilir.

Denetlediği şeyler: Python sürümü, çekirdek bağımlılıklar, SQL feed runner
bağımlılıkları, cash beyni ML stack, model/veri dosyaları, beyin canlı testi
(mini karar döngüsü + hafıza yaz/oku), cash beyni yükleme, ortam değişkenleri.

---

## Çalıştırma

### 1) Beyin API'si (port 8000)

```bash
cd ai_engine
source .venv/bin/activate        # Windows: .\.venv\Scripts\Activate.ps1
python api_server.py
```

- Swagger: `http://SUNUCU_IP:8000/docs`
- Sağlık: `http://SUNUCU_IP:8000/api/v1/saglik`

> Prod'da `BRAIN_RELOAD=0` (varsayılan) kalmalı; worker her zaman 1 (beyin singleton).

### 2) Frontend (dashboard)

```bash
npm run dev      # geliştirme
# veya
npm run build && npm run start   # prod
```

### 3) Canlı SQL Hortumları (banka SQL'leri geldiğinde)

```bash
cd ai_engine
# Test (mock veri):
python sql_feed_seed_mock.py
export BANK_DB_URL='sqlite:///./mock_bank.db'
python sql_feed_runner.py --all-once --dry-run

# Gerçek: ai_engine/sql/*.sql dosyalarını banka SQL'leriyle değiştir
python sql_feed_runner.py --schedule
```

Detay: `ai_engine/SQL_FEED_RUNNER.md`

---

## Ortam Değişkenleri (.env)

`.env.example` dosyasını `.env` olarak kopyalayıp doldurun. Önemli olanlar:

| Değişken | Varsayılan | Açıklama |
|----------|-----------|----------|
| `BRAIN_PORT` | 8000 | Beyin API portu |
| `BRAIN_RELOAD` | 0 | Prod'da kapalı kalmalı |
| `CASH_BRAIN_ENABLE` | 1 | Cash beyni AI tahmini (0 = kapat, kural tabanlı) |
| `CASH_BRAIN_DATA` | (otomatik) | Kasa raporu yolu |
| `BANK_DB_URL` | — | Banka DB bağlantısı (SQL feed runner) |
| `NEXT_PUBLIC_BRAIN_URL` | http://localhost:8000 | Frontend → beyin |

---

## Cash Beyni Notu

- ML kütüphaneleri (`prophet`, `tensorflow`, `lightgbm`, `catboost` …) kurulu
  ve veri mevcutsa cash beyni **AI nakit tahmini** yapar.
- Kütüphane/veri eksikse veya hata olursa sistem **otomatik kural tabanlı moda**
  düşer — çökmez, karar üretmeye devam eder.
- Anlık kapatma: `CASH_BRAIN_ENABLE=0`.

---

## Doğrulama Checklist (banka teslim öncesi)

- [ ] `python preflight_check.py` → ❌ kritik yok
- [ ] `python -m pytest tests/` veya `python tests/test_brain_smoke.py` → hepsi geçti
- [ ] `python api_server.py` ayağa kalkıyor, `/api/v1/saglik` 200 dönüyor
- [ ] `npm run build` hatasız
- [ ] `.env` dolduruldu (özellikle `BANK_DB_URL`)
- [ ] (cash tam mod istenirse) `requirements_ultra.txt` kuruldu, preflight'ta cash ✅
- [ ] SQL hortumları: `sql_feed_runner.py --all-once --dry-run` geçiyor
```

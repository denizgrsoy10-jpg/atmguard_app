# 📋 BUSINESS RULES & DOMAIN KNOWLEDGE
## ATM Cash Management System - CBA Bank

**Date:** 10 Şubat 2026  
**Author:** Ultra Nirvana AI System  
**Purpose:** Bu dokümanda CBA Bank'ın ATM yönetim kuralları ve domain bilgisi yer alır

---

## 🏦 BANKA TİPİ: YATAN BANKA (DEPOSIT BANK)

**Kritik Bilgi:**
- CBA bir **"yatan banka"** (deposit bank)
- Müşteriler **daha çok para yatırıyor** (daha az çekiyor)
- **Recycle çok önemli** - ATM'ler kendi kendini besleme potansiyeli yüksek
- İkmal kadar **para toplama optimizasyonu** da kritik
- Self-sufficiency scoring gerekli

---

## 🔧 ARIZA YÖNETİMİ: FLM vs SLM

### FLM (First Line Maintenance)
```
✅ Basit arızalar
✅ Bantaş personeli TEK BAŞINA gider
✅ Kombine hizmet KOLAY (FLM + İkmal + Collection)
✅ Maliyet: 600 TL/sefer

Arıza Tipleri:
- Kağıt sıkışması (JAM)
- Yazıcı arızaları (PRINTER)
- Ekran sorunları (SCREEN)
- Kart okuyucu (CARD READER)
- Kalibrasyon (CALIBRATION)
- Altyapi sorunları (INFRASTRUCTURE)
```

### SLM (Second Line Maintenance)
```
⚠️ Ciddi arızalar
⚠️ Bantaş + VENDOR teknisyen BERABER gider
⚠️ Kombine hizmet ZORLU (koordinasyon gerekli)
⚠️ Maliyet: 1,500 TL/sefer

Arıza Tipleri:
- Motherboard (ANAKART)
- Elektronik arızalar (ELECTRONIC)
- Güvenlik sorunları (SECURITY)
- Vault/Safe arızaları
- Dispenser ciddi arıza
- Acceptor arızaları
```

### Veri Alanı
```json
{
  "Açık Arıza Kaydı Var mı?": "Evet/Hayır",
  "Arıza Türü": "ATM KABİN DEĞİŞİMİ() / ALTYAPI / ...",
  "FLM ile Recycle P.T Açılabilir": "Evet/Hayır"
}
```

---

## 💰 ATM KASA YAPISI

### Recycle Kasetler (Yatırılan Para - Biriken)
```
STANDART TL ATM'LERİNDE:
✅ Kaset 1: 200 TL (recycle)
✅ Kaset 2: 200 TL (recycle)
✅ Kaset 3: 100 TL (recycle)
✅ Kaset 4: 100 TL (recycle)

❌ 50 TL ve 20 TL RECYCLE EDİLMEZ
   (Sadece dispenser'dan verilir, geri alınmaz)

DÖVİZLİ ATM'LERDE:
❌ Genelde recycle YOK
```

### Dispenser Kasetler (Çekilen Para - Yatan)
```
STANDART TL ATM'LERİNDE:
✅ 200 TL kasetleri
✅ 100 TL kasetleri  
✅ 50 TL kasetleri
❌ 20 TL genelde YOK (çok az kullanılır)

DÖVİZLİ ATM'LERDE:
- EUR, USD, GBP vs.
- Farklı yapılandırma
```

### Veri Alanları
```json
{
  "TL Bakiye": 0,               // Toplam dispenser bakiyesi
  "Kaset 1": 0,                 // Her kaset ayrı
  "Kaset 2": 0,
  "Kaset 3": 0,
  "Kaset 4": 0,
  
  "Recycle Bakiye": 0,          // Toplam biriken para
  "Recycle 200 TL": 0,          // 200 TL birikimi
  "Recycle 100 TL": 0,          // 100 TL birikimi
  "Recycle 50 TL": "-",         // YOK
  "Recycle 20 TL": "-"          // YOK
}
```

---

## 💳 ATM TİPLERİ & KÜPÜRLER

### TL_ONLY ATM (Standart - %88)
```json
{
  "Döviz": "-",
  "Döviz Küpür": "-",
  "TL Küpür": "200 TL 200 TL 100 TL 100 TL",
  "Tüm Küpürler": "200 TL 200 TL 100 TL 100 TL",
  "Recycle": "VAR - 2x200 + 2x100"
}
```

### FOREX ATM (Döviz - %8)
```json
{
  "Döviz": "EUR USD",
  "Döviz Küpür": "50 EUR 100 EUR 20 USD",
  "TL Küpür": "-",
  "Tüm Küpürler": "50 EUR 100 EUR 20 USD",
  "Recycle": "YOK"
}
```

### MIXED ATM (Karma - %4)
```json
{
  "Döviz": "EUR",
  "Döviz Küpür": "50 EUR 100 EUR",
  "TL Küpür": "200 TL 100 TL 50 TL",
  "Tüm Küpürler": "200 TL 100 TL 50 TL 50 EUR 100 EUR",
  "Recycle": "KISITLI"
}
```

---

## 🎯 KOMBİNE HİZMET OPTİMİZASYONU

### Temel Prensipler

**1. FLM Arıza + İkmal**
```
Normal: 2 sefer (FLM 600 TL + İkmal 600 TL) = 1,200 TL
Kombine: 1 sefer (600 TL)
Tasarruf: %50 🔥
```

**2. FLM Arıza + Para Toplama**
```
Normal: 2 sefer (FLM 600 TL + Collection 600 TL) = 1,200 TL
Kombine: 1 sefer (600 TL)
Tasarruf: %50 🔥
```

**3. FLM Arıza + İkmal + Para Toplama (TRIPLE COMBO)**
```
Normal: 3 sefer (FLM + İkmal + Collection) = 1,800 TL
Kombine: 1 sefer (600 TL)
Tasarruf: %66 🔥🔥🔥
```

**4. SLM Arıza + İkmal**
```
Normal: 2 sefer (SLM 1,500 TL + İkmal 600 TL) = 2,100 TL
Kombine: 1 sefer (1,500 TL) - Koordinasyon zor
Tasarruf: %25-30 ⚠️
```

**5. Route Optimization**
```
Aynı zone'daki 3 ATM'yi tek seferde:
Normal: 3 sefer × 600 TL = 1,800 TL
Kombine: 1 sefer × 600 TL = 600 TL
Tasarruf: %66
```

---

## 📊 EŞİK DEĞERLERİ (THRESHOLDS)

### İkmal Eşikleri
```python
REFILL_THRESHOLD_MIN = 100,000 TL        # İkmal gerekli
REFILL_THRESHOLD_CRITICAL = 50,000 TL    # Kritik durum
REFILL_TARGET = 1,000,000 TL             # Hedef doluluk

# Dövizli ATM'ler için farklı:
FOREX_REFILL_MIN = 50,000 TL
FOREX_REFILL_CRITICAL = 20,000 TL
FOREX_REFILL_TARGET = 500,000 TL
```

### Para Toplama Eşikleri
```python
COLLECTION_THRESHOLD = 800,000 TL         # Para topla
COLLECTION_THRESHOLD_URGENT = 1,000,000 TL # Acele topla
```

### Zone Maliyet Çarpanları
```python
ZONE_COST_MULTIPLIERS = {
    1: 1.0,   # Merkez - yakın
    2: 1.2,   # İkinci halka
    3: 1.5,   # Üçüncü halka
    4: 2.0,   # Uzak
    5: 2.5,   # Çok uzak
}
```

---

## 🎯 TASARRUF HEDEFLERİ

### Gerçekçi Beklentiler

**Konservatif (Garantili):**
```
İlk Yıl: %15-20 tasarruf
- Gereksiz ikmal engelleme: %8
- İkmal zamanlaması: %5
- Collection optimization: %3
- Route optimization: %2
```

**Gerçekçi (Hedef):**
```
İlk Yıl: %25-30 tasarruf
- Gereksiz ikmal: %12
- İkmal zamanlaması: %8
- FLM kombine hizmet: %6
- Collection optimization: %8
- Route optimization: %5
```

**Optimistik (Mükemmel Execution):**
```
2. Yıl: %38-45 tasarruf
- Gereksiz ikmal: %15
- İkmal zamanlaması: %10
- FLM kombine hizmet: %12
- Collection optimization: %12
- Route optimization: %8
- SLM kombine hizmet: %3
```

**İyimser (Çok Zor):**
```
3. Yıl: %50+ tasarruf
- Tüm optimizasyonlar maksimum
- Mükemmel koordinasyon
- 3 yıllık historical data ile
- Seasonality mükemmel öğrenildi
```

---

## 📅 OPERASYONEL KISITLAR

### Rota Kısıtları
```
❌ Motor: "Sadece ATM FA336'ya git"
✗ Gerçek: Aynı rotada 5 ATM var, hepsine gitmek gerek
→ Tasarruf sınırlı
```

### Personel Planlaması
```
❌ Motor: "3 gün sonra git"
✗ Gerçek: Personel bugün o zone'de, 3 gün sonra değil
→ Tasarruf fırsatı kaçabilir
```

### Banka Politikaları
```
❌ Motor: "50K TL var, yeterli"
✗ Gerçek: Banka politikası min 100K diyor
→ Motor politikaya uymalı
```

### Collection Logistics
```
✅ Motor: "17 ATM'den para topla"
⚠️ Gerçek: Para toplama için özel araç, güvenlik, zaman
→ Collection tasarrufu: %5-10 realistik
```

---

## 🔄 FinCash vs Ultra Nirvana

### FinCash (Mevcut Sistem)
```python
Kural 1: Pozitif trend var → İkmal YAPMA
Kural 2: Planlı gün mü? → Plana göre ikmal
Kural 3: Bakiye < eşik → 300K TL ikmal (sabit)

Özellikler:
- 7 günlük tahmin
- Kural bazlı (3 kural)
- Sabit 300K ikmal
- Para toplama mantığı YOK
- Arıza entegrasyonu YOK
- Zone optimization YOK
```

### Ultra Nirvana (Yeni Sistem)
```python
✅ 4 AI modeli (Prophet, LSTM, XGBoost, Ensemble)
✅ 14 günlük tahmin
✅ Dinamik ikmal miktarı (ATM'ye özel)
✅ Para toplama optimizasyonu
✅ Arıza entegrasyonu (FLM/SLM)
✅ Kombine hizmet tespiti
✅ Zone-based route optimization
✅ Self-learning & online learning
✅ A/B testing built-in
✅ Seasonality detection
✅ Anomaly detection
```

---

## 📈 3 YILLIK VERİ GEREKSİNİMİ

### Mevcut Veri (8 Günlük Snapshot)
```
Yeterli mi? Başlamak için EVET
İdeal mi? HAYIR

Accuracy: %85-88 (tahmin)
Seasonality: YOK
Long-term pattern: YOK
Tasarruf garanti: %15-20
```

### 3 Yıllık Historical Data Olursa
```
✅ Seasonality öğrenilir (bayram, maaş, tatil)
✅ Yearly trend analizi
✅ Collection pattern history
✅ Geriye dönük validation
✅ Accuracy: %92-95 (kanıtlı)
✅ Tasarruf garanti: %30-40

İdeal Veri:
- 3 yıllık ikmal işlemleri (tarih, tutar, ATM)
- 3 yıllık para toplama (tarih, tutar, ATM)
- 3 yıllık sıfırlama işlemleri
- 3 yıllık arıza kayıtları (FLM/SLM)
- Günlük çekim/yatırma detayı
```

---

## 🚨 KRİTİK NOTLAR

### Motor'un Bilmesi Gereken Kurallar

1. **Recycle Sadece 200+100 TL**
   - 50 TL ve 20 TL recycle EDİLMEZ
   - Motor bunları para toplama hesabına KATMAMALI

2. **FLM ≠ SLM**
   - FLM: Tek sefer, kolay kombine
   - SLM: Vendor gerekli, koordinasyon zor
   - Tasarruf beklentileri farklı

3. **Yatan Banka Logic**
   - Collection ÇOK ÖNEMLİ
   - Self-sufficiency scoring şart
   - Deposit/Withdrawal ayrı analiz

4. **ATM Tipi Önemli**
   - TL ATM: Standart logic
   - Forex ATM: Farklı eşikler, recycle yok
   - Mixed ATM: Karma strateji

5. **Kombine Hizmet = En Büyük Tasarruf**
   - FLM + Collection: %50 tasarruf
   - FLM + İkmal + Collection: %66 tasarruf
   - Motor ÖNCE kombine fırsatlarını aramalı

6. **Gerçekçi Ol**
   - %70 tasarruf = Hayal ❌
   - %40-50 tasarruf = Mümkün ✅
   - %25-30 tasarruf = Gerçekçi hedef 🎯
   - %15-20 tasarruf = Güvenli garanti ✅

---

## 📝 VERİ ALANLARI REFERANSI

### Temel Bilgiler
```
ATM ID, ATM Adı, Zone, model
Hizmet gunleri, Nakit Merkezi, İkmal Sorumlusu
```

### Arıza Bilgileri
```
Açık Arıza Kaydı Var mı?
Arıza Türü
Alt Yapısal Arizalar
FLM ile Recycle P.T Açılabilir
```

### Dispenser (Yatan)
```
TL Bakiye
Kaset 1, Kaset 2, Kaset 3, Kaset 4, Kaset 5, Kaset 6, Kaset 7, Kaset 8
```

### Recycle (Biriken)
```
Recycle Bakiye
Recycle 200 TL
Recycle 100 TL
Recycle 50 TL (genelde yok)
Recycle 20 TL (genelde yok)
```

### Küpür Bilgileri
```
Döviz
Döviz Küpür
TL Küpür
Tüm Küpürler
```

### İşlem Geçmişi
```
İkmal Tarihi
İkmal Tutarı
İkmali Giren Kişi
Bantaş Erp İkmal Tarihi
Bantaş Erp İkmal Tutarı

Para Toplama İşlem Tipi
P.T Valör Tarihi
P.T Giren Kişi

Tüm Kaset Sıfırlama
Recycle Tüm Kaset Sıfırlama
```

### 8 Günlük Trend
```
8 Salı Çeken, 7 Pazartesi Çeken, ... 1 Salı Çeken
8 Salı Yatan, 7 Pazartesi Yatan, ... 1 Salı Yatan  
8 Salı Fark, 7 Pazartesi Fark, ... 1 Salı Fark
```

### Düzenli Hizmet
```
Düzenli Para Toplama: "Var" / "Yok"
Maaş Dönemi
```

---

## 🎯 YÖNETIM SUNUMU İÇİN

### Conservative Messaging (Güvenli)
```
"Minimum %15 tasarruf hedefliyoruz"
"FLM arıza + ikmal kombinasyonunda %50 tasarruf potansiyeli"
"İlk 3 ay pilot test ile doğrulama"
```

### Realistic Messaging (Gerçekçi)
```
"Gerçekçi hedef: %25-30 tasarruf"
"Kombine hizmet optimizasyonu ile 2x-3x verimlilik"
"Recycle intelligence ile yatan banka avantajı"
```

### Optimistic Messaging (İyimser)
```
"Potansiyel: %35-40 tasarruf"
"3 yıllık data ile %45+ mümkün"
"Best-in-class AI modelleri"
```

### ASLA SÖYLENMEYEN
```
❌ "%70 tasarruf"
❌ "Her ATM'de %50 tasarruf"
❌ "100% accuracy"
❌ "Garanti ediyoruz"
```

---

## ✅ ÖZET: MOTOR'UN BİLMESİ GEREKENLER

1. ✅ CBA yatan banka - recycle kritik
2. ✅ FLM (kolay) vs SLM (zor) arıza ayrımı
3. ✅ Recycle: SADECE 200+100 TL
4. ✅ Dispenser: 200+100+50 TL (20 YOK)
5. ✅ ATM tipleri: TL_ONLY, FOREX, MIXED
6. ✅ Kombine hizmet = en büyük tasarruf
7. ✅ Tasarruf hedefi: %25-30 gerçekçi
8. ✅ 3 yıllık data olursa: %35-40 mümkün
9. ✅ Operasyonel kısıtlar var (rota, personel)
10. ✅ Gerçekçi ol, uçma!

---

## 🔄 GÜNLÜK FEEDBACK LOOP (Production)

### Canlı Veri Akışı

**Gün Sonu Feedback:**
```
Her gün sonunda motor'a verilecek:
- O gün hangi ATM'lerde sıfırlama yapıldı
- Hangi ATM'lere ikmal yapıldı  
- Hangi ATM'lerden para toplandı
- Gerçek işlem miktarları
```

**Motor Bunları Kullanarak:**
```python
1. ACCURACY TRACKING
   - Motor bugün ne tahmin etti?
   - Gerçekte ne oldu?
   - Accuracy hesapla
   - MAE, MAPE hesapla

2. ONLINE LEARNING
   - Hataları öğren
   - Model parametrelerini güncelle
   - Adaptive improvement

3. MODEL VALIDATION
   - Hangi model daha doğru tahmin etti?
   - Prophet mi, LSTM mi, XGBoost mu?
   - Otomatik model selection iyileşir

4. ANOMALY DETECTION VALIDATION
   - Motor anomaly dedi, gerçekten anomaly miydi?
   - False positive oranı
   - Anomaly detection modelini iyileştir

5. KOMBINE HİZMET VALIDATION
   - Motor "FLM + Collection yap" dedi
   - Gerçekte yapıldı mı?
   - Tasarruf gerçekleşti mi?
   - Kombine hizmet accuracy'si
```

### Günlük Veri Formatı
```json
{
  "date": "2026-02-10",
  "operations": [
    {
      "atm_id": "FA336",
      "operations_performed": ["REFILL", "COLLECTION"],
      "refill_amount": 800000,
      "collection_amount": 650000,
      "fault_fixed": "FLM",
      "combined_service": true,
      "cost": 600,
      "notes": "Triple combo - FLM + Refill + Collection"
    },
    {
      "atm_id": "FA426",
      "operations_performed": ["RESET"],
      "reset_type": "RECYCLE_RESET",
      "reset_amount": 450000,
      "cost": 0,
      "notes": "Otomatik sıfırlama"
    }
  ],
  "summary": {
    "total_refills": 125,
    "total_collections": 47,
    "total_resets": 23,
    "combined_services": 38,
    "total_cost": 85000
  }
}
```

### Motor'un Feedback Kullanımı

**1. Tahmin vs Gerçek Karşılaştırma**
```python
# Dün motor ne dedi?
motor_prediction = {
    "FA336": {
        "predicted_refill_need": True,
        "predicted_amount": 750000,
        "predicted_collection_need": True,
        "predicted_collection": 600000
    }
}

# Bugün gerçekte ne oldu?
actual_operation = {
    "FA336": {
        "refill_done": True,
        "refill_amount": 800000,
        "collection_done": True,
        "collection_amount": 650000
    }
}

# Accuracy hesapla
refill_accuracy = 1 - abs(750000 - 800000) / 800000  # 93.75%
collection_accuracy = 1 - abs(600000 - 650000) / 650000  # 92.3%
```

**2. Self-Learning**
```python
# Motor hatalarından öğrenir
if refill_accuracy < 0.90:
    # Model parametrelerini ayarla
    # LSTM'e daha fazla ağırlık ver
    # XGBoost'un parametrelerini optimize et
    model.adjust_weights(feedback_data)
```

**3. Performance Dashboard**
```python
# 30 günlük performance tracking
dashboard = {
    "last_30_days": {
        "total_predictions": 3450,
        "correct_predictions": 3201,
        "accuracy": 0.928,
        "avg_error": 45000,  # TL
        
        "by_model": {
            "prophet": {"accuracy": 0.91, "usage": 320},
            "lstm": {"accuracy": 0.95, "usage": 1876},
            "xgboost": {"accuracy": 0.92, "usage": 1254}
        },
        
        "combined_services": {
            "predicted": 450,
            "realized": 387,
            "success_rate": 0.86,
            "savings_realized": "4.2M TL"
        }
    }
}
```

### Feedback Benefits

**Kısa Vadede (1-3 ay):**
```
✅ Accuracy tracking başlar
✅ Hataları görüp düzeltir
✅ Model selection iyileşir
✅ False positive azalır
```

**Orta Vadede (3-6 ay):**
```
✅ Adaptive learning devrede
✅ Accuracy %5-8 artar
✅ Kombine hizmet success rate artar
✅ Tasarruf optimizasyonu iyileşir
```

**Uzun Vadede (6-12 ay):**
```
✅ Seasonality tam öğrenilir
✅ ATM-specific patterns belli olur
✅ Accuracy %95+ stabil
✅ Tasarruf hedefi garanti edilir
```

### Implementation

**Motor'da Feedback Handler:**
```python
class FeedbackHandler:
    def process_daily_feedback(self, feedback_data):
        """
        Günlük feedback'i işle
        """
        # 1. Tahminleri validate et
        validation_results = self.validate_predictions(feedback_data)
        
        # 2. Accuracy hesapla
        accuracy_metrics = self.calculate_accuracy(validation_results)
        
        # 3. Model'i güncelle (online learning)
        if accuracy_metrics['overall'] < 0.90:
            self.update_models(feedback_data)
        
        # 4. Dashboard'u güncelle
        self.update_dashboard(accuracy_metrics)
        
        # 5. Raporla
        return self.generate_feedback_report(accuracy_metrics)
```

**Günlük Çalıştırma:**
```bash
# Her gün sonu (örnek: 23:00)
python3 process_daily_feedback.py --date 2026-02-10

# Output:
# ✅ 125 ATM analyzed
# ✅ Accuracy: 92.8%
# ✅ Model updated
# ✅ Dashboard refreshed
```

---

## ⚖️ ANAYASAL NAKİT YÖNETİM KURALLARI (9 Mart 2026)

> **Bu kurallar değiştirilemez operasyonel kanunlardır. AI kararları bunlara aykırı olamaz.**

---

### 💵 Küpür Politikası

#### Çekim İşlemlerinde Kullanılan Banknotlar
| Para Birimi | Kabul Edilen Küpürler |
|-------------|----------------------|
| TL | 200 TL, 100 TL |
| USD | 100 USD |
| EUR | 50 EUR |
| GBP | 50 GBP |

#### Yatırma İşlemlerinde Kabul Edilen Banknotlar
| Para Birimi | Durum | Not |
|-------------|-------|-----|
| TL | ✅ 200 TL, 100 TL, 50 TL | Standart kabul |
| USD | ✅ Tüm küpürler | Sahte/kapatılmış değilse |
| EUR | ✅ Tüm küpürler | Sahte/kapatılmış değilse |
| GBP | ❌ KAPALI | İstisnasız, yatırma kabul edilmez |

> ⚠️ USD/EUR küpürleri sahte banknot veya benzeri bir durum nedeniyle operasyonel olarak kapatılmışsa sistem bu bilgiyi dikkate almalıdır.

---

### 🏦 Para Toplama Kuralları

```
1. ATM ASLA TAMAMEN PARASIZ BIRAKILMAZ.

2. 100 TL KÜPÜR TOPLAMA:
   - Kaset hacminin %50'sine ulaşana kadar 100 TL ATM'de bırakılır.
   - %50 eşiği aşıldığında 100 TL'ler toplanır.
   - (100 TL toplama kapasitesi şimdilik %50 olarak belirlenmiştir)

3. 200 TL KÜPÜR TOPLAMA:
   - 200 TL banknotlar her zaman toplatılır.
   - Eşik aranmaz, mevcut ise toplanır.
```

---

### 💱 Dövizli ATM Para Toplama & İkmal Kuralları

```
TL KASET TAM TOPLAMA DURUMU:
   - Tüm TL kasetlerin toplanması gerekiyorsa:
     → Tüm kaset sıfırlama yapılır
     → Her TL kasete 1 küpür giriş yapılır (bakiye bırakılır)

TL KASET TAM İKMAL DURUMU:
   - Tüm TL kasetler için ikmal ihtiyacı varsa:
     → Döviz kasetleri de dahil tüm kaset olarak ikmal yapılır

Kural her iki işlem için de aynıdır (Toplama & İkmal).
```

---

### 📅 Planlı / Plansız İşlem Kuralı

```
✅ KURAL: İkmal ve Para Toplama işlemleri PLANLI GÜNLERDE yapılır.

❌ PLANSIZ KAYIT açılabilecek istisnalar:
   - Acil durum (ATM'nin parası bitmesi)
   - Arıza nedeniyle müdahale
   - Maaş ödemeli ATM'lerde para bitmesi
   - Diğer acil operasyonel gereklilikler

Dışındaki tüm işlemler MUTLAKA planlı gün kaydı ile yapılır.
```

---

### 🕌 Bayram Dönemi Operasyon Kuralları (Kurban & Ramazan Bayramı)

```
BAYRAM ÖNCESİ (3-4 gün önce):
   - Çekim hacmi önemli ölçüde artar (+%40-60 tahmini)
   - Para toplama MİNİMUM düzeyde yapılır
   - ATM ASLA parasız bırakılmaz
   - Toplama yapılacaksa en küçük miktarda tutulur

BAYRAM 1. GÜNÜ SONRASI:
   - İşlem hacimleri düşer
   - Normal operasyon kurallarına dönülür
```

---

### 📈 Politika Faizi Temelli Toplama Limiti

```
TEMEL MANTIK:
   ATM'den toplanan nakit → Merkez Bankası'na gönderilir
   → Günlük faiz geliri elde edilir

KARAR KURALI:
   Günlük faiz geliri ≥ Toplama işlemi maliyeti  → TOPLA ✅
   Günlük faiz geliri < Toplama işlemi maliyeti  → BEKLAT ❌ (Ertesi gün tekrar bak)

Bu kural politika faizi ile doğrudan bağlantılıdır.
Politika faizi değiştiğinde limit otomatik güncellenir.
```

---

### 🗺️ Zone 2 ve Üzeri ATM Kuralları

```
Zone 2+ ATM'lerin planlı günleri SINIRLIDIR.

DURUM 1 — Para Sorunu:
   Bir sonraki planlı güne kadar parası yetmeyecekse
   → Limit altında bile IKMAL yapılır

DURUM 2 — Kaset Doluluk Sorunu:
   ATM dolup arızaya düşecekse
   → Limit altında bile TOPLAMA yapılır

Temel kural: Planlı gün gelmeden sorun çıkacaksa müdahale et.
```

---

### 🗺️ Rota Optimizasyon Kuralı

```
Yan yana / yakın bölgede ATM'lere müdahale yapılacaksa:

→ O bölgedeki DİĞER ATM'ler de değerlendirilir
→ Limit altında olsa bile kayıt açılır
→ Ertesi gün aynı rotaya tekrar gidilmesinin önüne geçmek için

KARAR: "Hazır gidilmişken" mantığıyla rota optimize edilir.
       Ertesi gün aynı rotaya gidilmesi önlenecekse kayıt girilir.
```

---

### 📋 Aylık Mutabakat Sıfırlama Zorunluluğu

```
KURAL: Tüm offsite ATM'lere AYDA EN AZ 1 KERE tüm kaset sıfırlama ZORUNLUDUR.

UYGULAMA:
   Sıfırlama tarihi yaklaşan / gelen ATM'ler için:
   • Para ihtiyacı YOK ise  → Tüm kaset sıfırlama
   • Para ihtiyacı VAR ise  → Tüm kaset ikmal

⚠️ Bu işlem bakiye olarak müdahale ihtiyacı olmasa bile YAPILIR.
   Mutabakat birimi için yasal/operasyonel zorunluluktur.
```

---

### 🧾 Müşteri İtirazı Mutabakat Protokolü

```
Mutabakat birimi → Frontline üzerinden kayıt açar

SENARYO A — İtiraz tarihinden SONRA sıfırlama yapılmışsa:
   → Sıfırlama tarih ve saatini mutabakat birimine bildir
   → Frontline kaydı kapatılır ✅

SENARYO B — İtiraz tarihinden sonra sıfırlama YAPILMAMIŞSA:
   → Planlı tüm kaset sıfırlama VEYA ikmal kaydı oluştur
     (ATM işlem hacmine göre karar ver)
   → Frontline kaydı valör tarihi belirtilerek kapatılır ✅
```

---

### 🚫 Mükerrer Kayıt Engeli

```
KURAL: Bir ATM üzerinde AYNI ANDA YALNIZCA 1 AÇIK KAYIT olabilir.

YASAK kombinasyonlar:
   ❌ İkmali olan ATM'ye ayrıca para toplama kaydı
   ❌ Para toplaması olan ATM'ye ikmal kaydı
   ❌ Aynı türden 2 kayıt aynı anda açık

⚠️ MEVCUT İSTİSNA:
   Dövizli ATM'ler şu an istisnadır.
   Dövizli ikmalleri teke indirme çalışması devam etmektedir.
```

---

### 🌍 Döviz İkmal Miktar Politikası

```
STANDART: Genel olarak 1'er deste konulur.

YÜKSEK TUTARLI İKMAL yapılan lokasyonlar:
   • Sahil ATM'leri (yaz döneminde)
   • Tarihi Yarımada & Fatih bölgesi (tüm dönemlerde)
   • Hava limanları (tüm dönemlerde)
   • Yüksek çekim yapıldığı bilinen lokasyonlar
```

---

### 🤖 Otomatik Para Toplama Tetikleyicisi

```
ÇALIŞMA SAATİ: Gece 23:00 (sistem otomatik çalıştırır)

TETİKLEME KOŞULU:
   Yatırma oranı >= %80 olan ATM'lerde
   → Ertesi güne planlı PARA TOPLAMA kaydı otomatik açılır

Manuel müdahale gerektirmez. Sistem tarafından yapılır.
```

---

### 📦 All-in Kaset Doluluk Kuralı

```
%90 SINIRI → DOLU KABUL EDİLİR
   • ATM yatırmaya KAPANIR
   • Bu seviyeye yaklaşıldığında toplama planlanmalıdır

Planlama eşiği: %85 (toplama hazırlığı başla)
Kapanma eşiği:  %90 (ATM yatırmaya kapandı)
```

---

### 🔢 Model Bazlı Kaset Kapasiteleri

| Model | Recycle Kaset (adet) | Cashin Kaset (adet) |
|-------|---------------------|---------------------|
| GRG H68N(L) | 2.200 | 1.400 (Standart) / 2.000 (Yeni All-in) |
| GRG H68V(L) | 2.500 | 2.500 |
| HITACHI | 3.500 | 3.700 |

> Kapasite = Maksimum banknot adedi. Doluluk oranı hesabında bu değerler kullanılır.

---

**Bu dokümandaki bilgiler ABSOLUTE TRUTH - Her zaman hatırla!**

**Son Güncelleme:** 9 Mart 2026 (Anayasal Nakit Yönetim Kuralları eklendi)



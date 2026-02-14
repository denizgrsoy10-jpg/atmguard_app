# 🎯 Merkezi Fiyatlandırma Sistemi

## 📍 Konum
`/src/utils/pricing.ts`

## 🎨 Amaç
Tüm KM bazlı ATM operasyon maliyetlerini **tek bir yerden** yönetmek. CSV'deki gerçek fiyatlar buradan tüm sayfalara dağıtılıyor.

## 📊 Fiyat Seviyeleri (Zone Pricing)

| KM Aralığı | Fiyat (TL) | Zone | Renk Kodu |
|-----------|-----------|------|----------|
| 0-15 km | 602.00 | Z1 | 🟢 Yeşil |
| 16-30 km | 1,640.78 | Z2 | 🟢 Yeşil |
| 31-50 km | 2,142.26 | Z2 | 🟢 Yeşil |
| 51-70 km | 2,858.66 | Z2 | 🟡 Turuncu |
| 71-90 km | 3,718.34 | Z3 | 🟡 Turuncu |
| 91-110 km | 4,184.00 | Z4 | 🔴 Kırmızı |
| 111-140 km | 4,685.48 | Z4 | 🔴 Kırmızı |
| 141-170 km | 5,652.62 | Z5 | 🟣 Mor |
| 171-200 km | 6,691.40 | Z5 | 🟣 Mor |
| 200+ km | 8,231.66 | Z5+ | 🔴 Kırmızı |

### 💎 SLM Premium
**+501.58 TL** ek ücret (Second Level Maintenance için)

## 🛠️ Kullanılabilir Fonksiyonlar

### 1. `getPriceByKM(km: number): number`
Standart operasyon fiyatını döner (İkmal, FLM, Para Toplama için).

```typescript
getPriceByKM(45) // → 2142.26 TL
getPriceByKM(120) // → 4685.48 TL
```

### 2. `getSLMPrice(km: number): number`
SLM fiyatını döner (standart + 501.58 TL premium).

```typescript
getSLMPrice(45) // → 2643.84 TL (2142.26 + 501.58)
```

### 3. `calculateOperationCosts(...)`
Tüm operasyonlar için detaylı maliyet hesabı yapar.

```typescript
const costs = calculateOperationCosts(
  km: 50,
  ikmalCount: 10,  // Aylık ikmal sayısı
  flmCount: 4,     // Aylık FLM sayısı  
  slmCount: 1,     // Aylık SLM sayısı
  paraToplamaCount: 12 // Aylık para toplama
);

// Dönen:
{
  ikmal: { count: 10, unitPrice: 2142.26, total: 21422.6 },
  flm: { count: 4, unitPrice: 2142.26, total: 8569.04 },
  slm: { count: 1, unitPrice: 2643.84, total: 2643.84 },
  paraToplama: { count: 12, unitPrice: 2142.26, total: 25707.12 },
  monthly: 58342.6,
  yearly: 700111.2
}
```

### 4. `getKMColor(km: number): string`
UI için renk kodu döner.

```typescript
getKMColor(30) // → '#10B981' (yeşil)
getKMColor(80) // → '#F59E0B' (turuncu)
getKMColor(150) // → '#EF4444' (kırmızı)
```

### 5. `formatCurrency(amount: number): string`
Türkçe para formatı.

```typescript
formatCurrency(1234567) // → '1.234.567'
```

### 6. `formatCurrencyShort(amount: number): string`
Kısa format (K/M ile).

```typescript
formatCurrencyShort(45000) // → '₺45.0K'
formatCurrencyShort(1250000) // → '₺1.25M'
```

## 📦 Entegre Edilen Sayfalar

### ✅ Budget Performance (`/budget-performance`)
- Tüm ATM maliyetleri
- Nakit merkezi bazlı gruplama
- Zone bazlı accordion
- Detaylı operasyon breakdown

### ✅ Cashflow Ops (`/cashflow-ops`)
- Rota maliyet hesaplamaları
- KM bazlı optimizasyon
- Nakit toplama/ikmal maliyetleri

### ✅ Command Center (`/command-center`)
- Operatör görev maliyetleri
- SLA maliyet analizi

### ✅ Overview (`/overview`)
- Toplam maliyet KPI kartları
- Zone bazlı maliyet dağılımı

## 🔄 Fiyat Güncellemesi

**Tek yerden güncelleme:**

1. `/src/utils/pricing.ts` dosyasını aç
2. `PRICING_TIERS` array'ini güncelle
3. Tüm sayfalar otomatik yeni fiyatları kullanır! 🎉

```typescript
export const PRICING_TIERS: PricingTier[] = [
  { maxKm: 15, price: 650, label: '0-15 km', color: '#10B981' }, // ✏️ Güncelle
  // ...
];
```

## 🎯 Avantajları

1. **Tek Kaynak**: Fiyat her yerde aynı
2. **Kolay Güncelleme**: 1 dosya, tüm sistem güncellenir
3. **Tip Güvenliği**: TypeScript ile hata riski sıfır
4. **Performans**: Hesaplamalar optimize edilmiş
5. **Bakım Kolaylığı**: Kod tekrarı yok

## 🚀 Örnek Kullanım

```typescript
import { 
  getPriceByKM, 
  calculateOperationCosts, 
  formatCurrencyShort 
} from '@/utils/pricing';

// Basit fiyat
const price = getPriceByKM(75); // 3718.34 TL

// Tam maliyet hesabı
const costs = calculateOperationCosts(75);
console.log(`Aylık: ${formatCurrencyShort(costs.monthly)}`); // ₺100.2K

// Yıllık projeksiyon
console.log(`Yıllık: ${formatCurrencyShort(costs.yearly)}`); // ₺1.20M
```

## 📝 Notlar

- Tüm fiyatlar **CSV'den alınmış gerçek fiyatlar**
- Zone bazlı fiyatlandırma sistemine uyumlu
- Operasyon tiplerine göre otomatik hesaplama
- SLM premium otomatik ekleniyor
- Para formatı Türkiye standartlarına uygun

---

💡 **İpucu**: Fiyat değişikliğinde sadece `pricing.ts`'yi güncelle, tüm sistem senkronize kalır!

// Merkezi KM Bazlı Fiyatlandırma Sistemi
// Tüm sayfalarda kullanılacak tek kaynak

export interface PricingTier {
  maxKm: number;
  plannedPrice: number;      // Planlı operasyon fiyatı (önceden planlanmış)
  unplannedPrice: number;    // Plansız operasyon fiyatı (reactive, acil)
  label: string;
  color: string;
}

// KM bazlı fiyat seviyeleri (CSV'den alınan gerçek fiyatlar)
export const PRICING_TIERS: PricingTier[] = [
  { maxKm: 15, plannedPrice: 602, unplannedPrice: 0, label: '0-15 km', color: '#10B981' },      // TODO: Plansız fiyat ekle
  { maxKm: 30, plannedPrice: 1640.78, unplannedPrice: 0, label: '16-30 km', color: '#10B981' },
  { maxKm: 50, plannedPrice: 2142.26, unplannedPrice: 0, label: '31-50 km', color: '#10B981' },
  { maxKm: 70, plannedPrice: 2858.66, unplannedPrice: 0, label: '51-70 km', color: '#F59E0B' },
  { maxKm: 90, plannedPrice: 3718.34, unplannedPrice: 0, label: '71-90 km', color: '#F59E0B' },
  { maxKm: 110, plannedPrice: 4184.00, unplannedPrice: 0, label: '91-110 km', color: '#EF4444' },
  { maxKm: 140, plannedPrice: 4685.48, unplannedPrice: 0, label: '111-140 km', color: '#EF4444' },
  { maxKm: 170, plannedPrice: 5652.62, unplannedPrice: 0, label: '141-170 km', color: '#8B5CF6' },
  { maxKm: 200, plannedPrice: 6691.40, unplannedPrice: 0, label: '171-200 km', color: '#8B5CF6' },
  { maxKm: Infinity, plannedPrice: 8231.66, unplannedPrice: 0, label: '200+ km', color: '#EF4444' }
];

// SLM premium fiyat
export const SLM_PREMIUM = 501.58;

// 🧠 TASARRUF HEDEFI
export const SAVINGS_TARGET = 0.15; // %15 tasarruf hedefi

// 🌱 SÜRDÜRÜLEBİLİRLİK METRİKLERİ
export const CO2_PER_KM = 0.12;  // kg CO2 per km (ortalama servis aracı)
export const FUEL_COST_PER_KM = 8.5; // TL/km (2026 yakıt fiyatı)
export const TREE_EQUIVALENT = 21; // kg CO2 = 1 ağacın yıllık emilimi
export const CARBON_CREDIT_USD_PER_TON = 85; // $/ton CO2 (2026 karbon kredisi fiyatı)
export const LITER_PER_KM = 0.08; // litre/km (ortalama servis aracı tüketimi)

/**
 * 🌱 ESG Hesaplama Fonksiyonları
 */

export interface ESGMetrics {
  // Rota istatistikleri
  totalKmBefore: number;
  totalKmAfter: number;
  kmSaved: number;
  kmSavedPercent: number;
  
  // Karbon ayak izi
  co2Before: number;      // kg
  co2After: number;       // kg
  co2Saved: number;       // kg
  co2SavedPercent: number;
  co2SavedTons: number;   // ton
  
  // Ağaç eşdeğeri
  treesEquivalent: number;
  
  // Yakıt tasarrufu
  fuelLitersSaved: number;
  fuelCostSaved: number;  // TL
  
  // Karbon kredisi değeri
  carbonCreditValue: number; // USD
  carbonCreditValueTL: number; // TL
  
  // Operasyonel metrikler
  tripsBefore: number;
  tripsAfter: number;
  tripsSaved: number;
}

/**
 * Rota optimizasyonunun ESG etkisini hesapla
 * @param beforeKm - Optimizasyon öncesi toplam KM
 * @param afterKm - Optimizasyon sonrası toplam KM
 * @param tripsBefore - Optimizasyon öncesi sefer sayısı
 * @param tripsAfter - Optimizasyon sonrası sefer sayısı
 * @param usdToTL - USD/TL kuru (varsayılan: 32)
 */
export function calculateESGImpact(
  beforeKm: number,
  afterKm: number,
  tripsBefore: number,
  tripsAfter: number,
  usdToTL: number = 32
): ESGMetrics {
  const kmSaved = beforeKm - afterKm;
  const kmSavedPercent = (kmSaved / beforeKm) * 100;
  
  // Karbon hesabı
  const co2Before = beforeKm * CO2_PER_KM;
  const co2After = afterKm * CO2_PER_KM;
  const co2Saved = co2Before - co2After;
  const co2SavedPercent = (co2Saved / co2Before) * 100;
  const co2SavedTons = co2Saved / 1000;
  
  // Ağaç eşdeğeri
  const treesEquivalent = Math.round(co2Saved / TREE_EQUIVALENT);
  
  // Yakıt tasarrufu
  const fuelLitersSaved = kmSaved * LITER_PER_KM;
  const fuelCostSaved = kmSaved * FUEL_COST_PER_KM;
  
  // Karbon kredisi
  const carbonCreditValue = co2SavedTons * CARBON_CREDIT_USD_PER_TON;
  const carbonCreditValueTL = carbonCreditValue * usdToTL;
  
  return {
    totalKmBefore: beforeKm,
    totalKmAfter: afterKm,
    kmSaved,
    kmSavedPercent,
    co2Before,
    co2After,
    co2Saved,
    co2SavedPercent,
    co2SavedTons,
    treesEquivalent,
    fuelLitersSaved,
    fuelCostSaved,
    carbonCreditValue,
    carbonCreditValueTL,
    tripsBefore,
    tripsAfter,
    tripsSaved: tripsBefore - tripsAfter
  };
}

/**
 * Yıllık KM'den ESG metriklerini tahmin et
 * @param yearlyKm - Yıllık toplam KM
 * @param optimizationRate - Optimizasyon oranı (varsayılan: 0.25 = %25 azalma)
 */
export function estimateYearlyESG(yearlyKm: number, optimizationRate: number = 0.25): ESGMetrics {
  const afterKm = yearlyKm * (1 - optimizationRate);
  const avgKmPerTrip = 45; // Ortalama bir sefer 45 km
  const tripsBefore = Math.round(yearlyKm / avgKmPerTrip);
  const tripsAfter = Math.round(afterKm / avgKmPerTrip);
  
  return calculateESGImpact(yearlyKm, afterKm, tripsBefore, tripsAfter);
}

/**
 * KM'ye göre standart operasyon fiyatını döner
 * @param km - Mesafe (kilometre)
 * @param isPlanned - Planlı operasyon mu? (true = ucuz, false = pahalı)
 */
export function getPriceByKM(km: number, isPlanned: boolean = true): number {
  const tier = PRICING_TIERS.find(t => km <= t.maxKm);
  if (!tier) return PRICING_TIERS[PRICING_TIERS.length - 1].plannedPrice;
  
  return isPlanned ? tier.plannedPrice : (tier.unplannedPrice || tier.plannedPrice * 1.3);
}

/**
 * KM'ye göre SLM fiyatını döner (standart + premium)
 * @param km - Mesafe (kilometre)
 * @param isPlanned - Planlı operasyon mu?
 */
export function getSLMPrice(km: number, isPlanned: boolean = true): number {
  return getPriceByKM(km, isPlanned) + SLM_PREMIUM;
}

/**
 * KM'ye göre renk döner (UI için)
 */
export function getKMColor(km: number): string {
  if (km <= 50) return '#10B981'; // Yeşil
  if (km <= 100) return '#F59E0B'; // Turuncu
  return '#EF4444'; // Kırmızı
}

/**
 * KM'ye göre tier bilgisi döner
 */
export function getPricingTier(km: number): PricingTier | undefined {
  return PRICING_TIERS.find(t => km <= t.maxKm);
}

/**
 * Tüm operasyonlar için maliyet hesaplama
 */
export interface OperationCosts {
  ikmal: { count: number; unitPrice: number; total: number };
  flm: { count: number; unitPrice: number; total: number };
  slm: { count: number; unitPrice: number; total: number };
  paraToplama: { count: number; unitPrice: number; total: number };
  monthly: number;
  yearly: number;
}

export function calculateOperationCosts(
  km: number,
  ikmalCount: number = 10,
  flmCount: number = 4,
  slmCount: number = 1,
  paraToplamaCount: number = 12
): OperationCosts {
  const standardPrice = getPriceByKM(km);
  const slmPrice = getSLMPrice(km);

  const ikmalTotal = ikmalCount * standardPrice;
  const flmTotal = flmCount * standardPrice;
  const slmTotal = slmCount * slmPrice;
  const paraToplamaTotal = paraToplamaCount * standardPrice;

  const monthly = ikmalTotal + flmTotal + slmTotal + paraToplamaTotal;

  return {
    ikmal: { count: ikmalCount, unitPrice: standardPrice, total: ikmalTotal },
    flm: { count: flmCount, unitPrice: standardPrice, total: flmTotal },
    slm: { count: slmCount, unitPrice: slmPrice, total: slmTotal },
    paraToplama: { count: paraToplamaCount, unitPrice: standardPrice, total: paraToplamaTotal },
    monthly,
    yearly: monthly * 12
  };
}

/**
 * Para formatı (Türkçe)
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Kısa format (K/M)
 */
export function formatCurrencyShort(amount: number): string {
  if (amount >= 1000000) {
    return `₺${(amount / 1000000).toFixed(2)}M`;
  }
  if (amount >= 1000) {
    return `₺${(amount / 1000).toFixed(1)}K`;
  }
  return `₺${amount.toFixed(0)}`;
}

// 🧠 ===============================
// AKILLI KARAR SİSTEMİ - CANLI VERİ BAZLI
// ===============================

export interface ATMRealTimeData {
  atmId: string;
  atmName: string;
  cashCenter: string;
  km: number;
  
  // 💰 Nakit Durumu
  currentCash: number;           // Şu anki nakit (TL)
  maxCashCapacity: number;       // Maksimum kapasite (TL)
  minCashThreshold: number;      // Minimum eşik (TL) - altına düşerse kritik
  dailyWithdrawal: number;       // Günlük ortalama çekim (TL)
  
  // 📊 Operasyon Durumu
  activeOperations: string[];    // Şu an aktif operasyonlar: ['FLM', 'SLM', 'İkmal']
  lastReplenishment: Date;       // Son ikmal tarihi
  scheduledMaintenance: Date | null; // Planlı bakım tarihi
  
  // ⚠️ Risk Faktörleri
  isSalaryDay: boolean;          // Maaş günü ATM'i mi? (yüksek talep)
  isHighTraffic: boolean;        // Yoğun bölge mi?
  outOfServiceRisk: number;      // Arıza riski (0-1)
  
  // 🎯 Öncelik
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface SmartDecision {
  atmId: string;
  action: 'ikmal' | 'paraToplama' | 'FLM' | 'SLM' | 'bekle';
  urgency: 'acil' | 'bugün' | 'bu_hafta' | 'planli';
  reason: string;
  estimatedCost: number;
  canWait: boolean;
  conflictsWith: string[];       // Çakışan operasyonlar
  suggestedDate: Date;
}

/**
 * 🧠 BEYİN #1: Nakit Seviye Analizi
 * Para bitmesin, şişmesin - optimal seviyede tut
 */
export function analyzeCashLevel(atm: ATMRealTimeData): SmartDecision {
  const cashPercent = (atm.currentCash / atm.maxCashCapacity) * 100;
  const daysUntilEmpty = atm.currentCash / atm.dailyWithdrawal;
  
  // KURAL 1: Para bitme riski (< %20 veya < 2 gün)
  if (cashPercent < 20 || daysUntilEmpty < 2) {
    return {
      atmId: atm.atmId,
      action: 'ikmal',
      urgency: 'acil',
      reason: `🚨 KRİTİK: Nakit %${cashPercent.toFixed(0)} (${daysUntilEmpty.toFixed(1)} gün kaldı)`,
      estimatedCost: getPriceByKM(atm.km, false), // Plansız fiyat
      canWait: false,
      conflictsWith: checkConflicts(atm, 'ikmal'),
      suggestedDate: new Date() // Hemen
    };
  }
  
  // KURAL 2: Para şişme riski (> %90) - toplama yap
  if (cashPercent > 90) {
    return {
      atmId: atm.atmId,
      action: 'paraToplama',
      urgency: 'bugün',
      reason: `💰 ŞIŞME: Nakit %${cashPercent.toFixed(0)} - para toplama gerekli`,
      estimatedCost: getPriceByKM(atm.km, true), // Planlı yapılabilir
      canWait: false,
      conflictsWith: checkConflicts(atm, 'paraToplama'),
      suggestedDate: new Date()
    };
  }
  
  // KURAL 3: Optimal seviye (%30-70) - planlı ikmal
  if (cashPercent < 50 && daysUntilEmpty < 5) {
    const suggestedDate = new Date();
    suggestedDate.setDate(suggestedDate.getDate() + Math.floor(daysUntilEmpty - 1));
    
    return {
      atmId: atm.atmId,
      action: 'ikmal',
      urgency: 'bu_hafta',
      reason: `📅 PLANLI: ${daysUntilEmpty.toFixed(1)} gün kaldı, önceden planla`,
      estimatedCost: getPriceByKM(atm.km, true), // Planlı fiyat
      canWait: true,
      conflictsWith: checkConflicts(atm, 'ikmal'),
      suggestedDate
    };
  }
  
  // KURAL 4: Normal durum - bekle
  return {
    atmId: atm.atmId,
    action: 'bekle',
    urgency: 'planli',
    reason: `✅ NORMAL: Nakit %${cashPercent.toFixed(0)}, ${daysUntilEmpty.toFixed(1)} gün yeter`,
    estimatedCost: 0,
    canWait: true,
    conflictsWith: [],
    suggestedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 hafta sonra kontrol
  };
}

/**
 * 🧠 BEYİN #2: Operasyon Çakışma Kontrolü
 * FLM varsa para toplama gitmesin, SLM varsa ikmal ertelensin
 */
function checkConflicts(atm: ATMRealTimeData, plannedAction: string): string[] {
  const conflicts: string[] = [];
  
  // KURAL: FLM aktifse para toplama yapma (teknisyen ATM'de)
  if (atm.activeOperations.includes('FLM') && plannedAction === 'paraToplama') {
    conflicts.push('FLM aktif - teknisyen ATM başında, para toplama ertelensin');
  }
  
  // KURAL: SLM aktifse ikmal yapma (uzman teknisyen müdahale ediyor)
  if (atm.activeOperations.includes('SLM') && plannedAction === 'ikmal') {
    conflicts.push('SLM aktif - uzman teknisyen çalışıyor, ikmal sonraya alınsın');
  }
  
  // KURAL: İkmal varsa para toplama yapma (kasada çalışma var)
  if (atm.activeOperations.includes('İkmal') && plannedAction === 'paraToplama') {
    conflicts.push('İkmal devam ediyor - para toplama ikmalin bitmesini beklesin');
  }
  
  // KURAL: Planlı bakım varsa hiçbir operasyon yapma
  if (atm.scheduledMaintenance && atm.scheduledMaintenance > new Date()) {
    const daysDiff = Math.ceil((atm.scheduledMaintenance.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 2) {
      conflicts.push(`Planlı bakım ${daysDiff} gün sonra - operasyonları bakımdan sonraya al`);
    }
  }
  
  return conflicts;
}

/**
 * 🧠 BEYİN #3: Öncelik Skorlama (Risk Bazlı)
 * Hangi ATM daha acil? Maaş günü, yoğun bölge, arıza riski...
 */
export function calculatePriorityScore(atm: ATMRealTimeData): number {
  let score = 0;
  
  const cashPercent = (atm.currentCash / atm.maxCashCapacity) * 100;
  const daysUntilEmpty = atm.currentCash / atm.dailyWithdrawal;
  
  // Nakit seviyesi (0-40 puan)
  if (cashPercent < 10) score += 40;
  else if (cashPercent < 20) score += 30;
  else if (cashPercent < 30) score += 20;
  else if (cashPercent < 50) score += 10;
  
  // Gün sayısı (0-30 puan)
  if (daysUntilEmpty < 1) score += 30;
  else if (daysUntilEmpty < 2) score += 20;
  else if (daysUntilEmpty < 3) score += 10;
  
  // Maaş günü ATM (0-15 puan)
  if (atm.isSalaryDay) score += 15;
  
  // Yoğun bölge (0-10 puan)
  if (atm.isHighTraffic) score += 10;
  
  // Arıza riski (0-10 puan)
  score += atm.outOfServiceRisk * 10;
  
  return Math.min(score, 100); // Max 100
}

/**
 * 🧠 BEYİN #4: Rota Optimizasyonu (Coğrafi Gruplama)
 * Aynı bölgedeki ATM'leri tek seferde ziyaret et
 */
export function optimizeRoute(decisions: SmartDecision[], atms: ATMRealTimeData[]): {
  routes: Array<{
    cashCenter: string;
    atmIds: string[];
    totalCost: number;
    savings: number;
    date: Date;
  }>;
  totalSavings: number;
} {
  const routes: any[] = [];
  let totalSavings = 0;
  
  // Nakit merkezi bazlı grupla
  const byCashCenter: Record<string, { decisions: SmartDecision[], atms: ATMRealTimeData[] }> = {};
  
  decisions.forEach((decision, idx) => {
    const atm = atms[idx];
    if (!byCashCenter[atm.cashCenter]) {
      byCashCenter[atm.cashCenter] = { decisions: [], atms: [] };
    }
    byCashCenter[atm.cashCenter].decisions.push(decision);
    byCashCenter[atm.cashCenter].atms.push(atm);
  });
  
  // Her nakit merkezi için rota oluştur
  Object.entries(byCashCenter).forEach(([cashCenter, data]) => {
    // Aynı gün yapılacak işleri grupla
    const urgentToday = data.decisions.filter(d => d.urgency === 'acil' || d.urgency === 'bugün');
    const plannedWeek = data.decisions.filter(d => d.urgency === 'bu_hafta');
    
    if (urgentToday.length > 0) {
      const originalCost = urgentToday.reduce((sum, d) => sum + d.estimatedCost, 0);
      // Grup indirimi: 2+ ATM aynı rotada %10 indirim
      const discount = urgentToday.length >= 2 ? 0.10 : 0;
      const optimizedCost = originalCost * (1 - discount);
      const savings = originalCost - optimizedCost;
      
      routes.push({
        cashCenter,
        atmIds: urgentToday.map(d => d.atmId),
        totalCost: optimizedCost,
        savings,
        date: new Date()
      });
      
      totalSavings += savings;
    }
    
    if (plannedWeek.length > 0) {
      const originalCost = plannedWeek.reduce((sum, d) => sum + d.estimatedCost, 0);
      // Planlı işler: %15 indirim (önceden biliniyor)
      const discount = 0.15;
      const optimizedCost = originalCost * (1 - discount);
      const savings = originalCost - optimizedCost;
      
      routes.push({
        cashCenter,
        atmIds: plannedWeek.map(d => d.atmId),
        totalCost: optimizedCost,
        savings,
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 gün sonra
      });
      
      totalSavings += savings;
    }
  });
  
  return { routes, totalSavings };
}

/**
 * 🧠 MASTER BEYİN: Tüm ATM'ler için akıllı karar ver
 * Canlı veriye göre dinamik planlama
 */
export function generateSmartSchedule(atms: ATMRealTimeData[]): {
  decisions: SmartDecision[];
  routes: any[];
  totalCost: number;
  totalSavings: number;
  savingsPercent: number;
  criticalAlerts: string[];
} {
  const decisions: SmartDecision[] = [];
  const criticalAlerts: string[] = [];
  
  // Her ATM için karar ver
  atms.forEach(atm => {
    const decision = analyzeCashLevel(atm);
    const priorityScore = calculatePriorityScore(atm);
    
    // Çakışma kontrolü
    if (decision.conflictsWith.length > 0) {
      criticalAlerts.push(`⚠️ ${atm.atmId}: ${decision.conflictsWith.join(', ')}`);
      // Çakışma varsa operasyonu ertele
      decision.canWait = true;
      decision.urgency = 'planli';
    }
    
    // Kritik durum tespiti
    if (priorityScore > 70) {
      criticalAlerts.push(`🚨 ${atm.atmId}: Yüksek risk (Skor: ${priorityScore})`);
    }
    
    decisions.push(decision);
  });
  
  // Rota optimizasyonu
  const { routes, totalSavings } = optimizeRoute(decisions, atms);
  
  // Maliyet hesabı
  const originalCost = decisions.reduce((sum, d) => sum + d.estimatedCost, 0);
  const optimizedCost = originalCost - totalSavings;
  const savingsPercent = (totalSavings / originalCost) * 100;
  
  return {
    decisions,
    routes,
    totalCost: optimizedCost,
    totalSavings,
    savingsPercent,
    criticalAlerts
  };
}

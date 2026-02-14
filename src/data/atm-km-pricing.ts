// ATM KM-based pricing data extracted from CSV
// This is CRITICAL data - each ATM has distance (KM) which affects pricing

export interface ATMKMData {
  termId: string;
  name: string;
  model: string;
  cashCenter: string;
  serviceDays: string;
  zone: number;
  km: number;
  plannedPrices: {
    nakitIkmal: number; // NAKİT İKMAL
    flm: number; // FLM
    slm: number; // SLM  
    madeniIkmal: number; // MADENİ İKMAL
    paraToplama: number; // PARA TOPLAMA
    paraToplamaIkmal: number; // PARA TOPLAMA + İKMAL
    paraToplamaFlm: number; // PARA TOPLAMA + FLM
  };
}

// Sample ATMs from CSV - showing the KM-based pricing structure
// Zone 1 (10 KM) - Base price ₺602.00 for most operations
// Zone 3 (87 KM) - Price increases to ₺3,718.34 for operations
// Zone 5 (170 KM) - Price reaches ₺6,691.40 for long distance

export const ATM_KM_DATA: ATMKMData[] = [
  {
    termId: 'FA621',
    name: '06 MAMAK NOKTA AVM',
    model: 'I37DC0C',
    cashCenter: 'ANKARA',
    serviceDays: 'PAZARTESİ - SALI - ÇARŞAMBA - PERŞEMBE - CUMA - CUMARTESİ - PAZAR',
    zone: 1,
    km: 10,
    plannedPrices: {
      nakitIkmal: 602.00,
      flm: 602.00,
      slm: 1103.58,
      madeniIkmal: 602.00,
      paraToplama: 602.00,
      paraToplamaIkmal: 602.00,
      paraToplamaFlm: 602.00
    }
  },
  {
    termId: 'FA336',
    name: '10 EDREMIT KORFEZ HAST',
    model: 'H68N',
    cashCenter: 'BALIKESİR',
    serviceDays: 'SALI - PERŞEMBE',
    zone: 3,
    km: 89,
    plannedPrices: {
      nakitIkmal: 3789.98,
      flm: 3789.98,
      slm: 4291.56,
      madeniIkmal: 3789.98,
      paraToplama: 3789.98,
      paraToplamaIkmal: 3789.98,
      paraToplamaFlm: 3789.98
    }
  },
  {
    termId: 'FA777',
    name: '81 AKCAKOCA CINAR BORU',
    model: 'I37DC0C',
    cashCenter: 'ZONGULDAK',
    serviceDays: 'PAZARTESİ - ÇARŞAMBA - CUMA',
    zone: 3,
    km: 87,
    plannedPrices: {
      nakitIkmal: 3718.34,
      flm: 3718.34,
      slm: 4219.92,
      madeniIkmal: 3718.34,
      paraToplama: 3718.34,
      paraToplamaIkmal: 3718.34,
      paraToplamaFlm: 3718.34
    }
  },
  {
    termId: 'FI328',
    name: '08 HOPA MERKEZ',
    model: 'I47DC0C',
    cashCenter: 'TRABZON',
    serviceDays: 'PAZARTESİ - SALI - PERŞEMBE - CUMA',
    zone: 5,
    km: 170,
    plannedPrices: {
      nakitIkmal: 6691.40,
      flm: 6691.40,
      slm: 7192.98,
      madeniIkmal: 6691.40,
      paraToplama: 6691.40,
      paraToplamaIkmal: 6691.40,
      paraToplamaFlm: 6691.40
    }
  },
  {
    termId: 'FD172',
    name: '46 ELBISTAN YUNUS EMRE MAH',
    model: 'I37DC0C',
    cashCenter: 'GAZİANTEP',
    serviceDays: 'PAZARTESİ - ÇARŞAMBA - CUMA',
    zone: 5,
    km: 213,
    plannedPrices: {
      nakitIkmal: 8231.66,
      flm: 8231.66,
      slm: 8733.24,
      madeniIkmal: 8231.66,
      paraToplama: 8231.66,
      paraToplamaIkmal: 8231.66,
      paraToplamaFlm: 8231.66
    }
  },
  {
    termId: 'FC818',
    name: '48 MARMARIS MERKEZ',
    model: 'H68V-824',
    cashCenter: 'MUĞLA',
    serviceDays: 'PAZARTESİ - PERŞEMBE',
    zone: 2,
    km: 60,
    plannedPrices: {
      nakitIkmal: 2751.20,
      flm: 2751.20,
      slm: 3252.78,
      madeniIkmal: 2751.20,
      paraToplama: 2751.20,
      paraToplamaIkmal: 2751.20,
      paraToplamaFlm: 2751.20
    }
  },
  {
    termId: 'FA279',
    name: '07 KEMER TEKIROVA MERKEZ',
    model: 'I37DC0C',
    cashCenter: 'ANTALYA',
    serviceDays: 'SALI - PERŞEMBE',
    zone: 2,
    km: 62,
    plannedPrices: {
      nakitIkmal: 2822.84,
      flm: 2822.84,
      slm: 3324.42,
      madeniIkmal: 2822.84,
      paraToplama: 2822.84,
      paraToplamaIkmal: 2822.84,
      paraToplamaFlm: 2822.84
    }
  },
  {
    termId: 'FD273',
    name: '02 MERKEZ MOBIL ATM',
    model: 'I47DC0C',
    cashCenter: 'ŞANLIURFA',
    serviceDays: 'PAZARTESİ - ÇARŞAMBA - CUMA',
    zone: 4,
    km: 111,
    plannedPrices: {
      nakitIkmal: 4578.02,
      flm: 4578.02,
      slm: 5079.60,
      madeniIkmal: 4578.02,
      paraToplama: 4578.02,
      paraToplamaIkmal: 4578.02,
      paraToplamaFlm: 4578.02
    }
  },
  {
    termId: 'FD831',
    name: '61 CAYKARA UZUNGOL',
    model: 'I37DC0C',
    cashCenter: 'TRABZON',
    serviceDays: 'ÇARŞAMBA',
    zone: 3,
    km: 95,
    plannedPrices: {
      nakitIkmal: 4004.90,
      flm: 4004.90,
      slm: 4506.48,
      madeniIkmal: 4004.90,
      paraToplama: 4004.90,
      paraToplamaIkmal: 4004.90,
      paraToplamaFlm: 4004.90
    }
  },
  {
    termId: 'FN959',
    name: '01 POZANTI MERKEZ',
    model: 'I37DC0C',
    cashCenter: 'ADANA',
    serviceDays: 'SALI - PERŞEMBE',
    zone: 3,
    km: 100,
    plannedPrices: {
      nakitIkmal: 4184.00,
      flm: 4184.00,
      slm: 4685.58,
      madeniIkmal: 4184.00,
      paraToplama: 4184.00,
      paraToplamaIkmal: 4184.00,
      paraToplamaFlm: 4184.00
    }
  }
];

// Key insights from the CSV data:
// 1. KM is the PRIMARY FACTOR for pricing - distance from CASH CENTER (Nakit Merkezi)
// 2. Each ATM belongs to a cash center (ANKARA, BALIKESİR, TRABZON, etc.)
// 3. KM = Distance from ATM to its cash center
// 4. Same zone can have different prices based on distance
// 5. Zone 1 (10 KM from center) = ₺602.00 base
// 6. Zone 2 (60-62 KM) = ₺2,751-2,822
// 7. Zone 3 (87-100 KM) = ₺3,718-4,184
// 8. Zone 4 (111 KM) = ₺4,578
// 9. Zone 5 (170-213 KM) = ₺6,691-8,231
//
// 💡 KRITIK: Tüm KM mesafeleri NAKİT MERKEZİNDEN hesaplanır!
//    Örnek: Hopa ATM → 170 km → TRABZON Nakit Merkezi'nden
//           Elbistan ATM → 213 km → GAZİANTEP Nakit Merkezi'nden
// 
// This means the previous zone-pricing.ts is INCOMPLETE
// We need to factor in KM distance from cash center, not just zone multipliers!

export interface KMPricingTier {
  minKm: number;
  maxKm: number;
  basePrice: number;
  description: string;
}

// KM-based pricing tiers derived from CSV analysis
export const KM_PRICING_TIERS: KMPricingTier[] = [
  { minKm: 0, maxKm: 15, basePrice: 602.00, description: 'City Center (Zone 1)' },
  { minKm: 16, maxKm: 30, basePrice: 1640.78, description: 'Near Suburbs (Zone 2 Start)' },
  { minKm: 31, maxKm: 50, basePrice: 2142.26, description: 'Suburbs (Zone 2)' },
  { minKm: 51, maxKm: 70, basePrice: 2858.66, description: 'Far Suburbs (Zone 2-3)' },
  { minKm: 71, maxKm: 90, basePrice: 3718.34, description: 'Regional (Zone 3)' },
  { minKm: 91, maxKm: 110, basePrice: 4184.00, description: 'Far Regional (Zone 3-4)' },
  { minKm: 111, maxKm: 140, basePrice: 4685.48, description: 'Inter-city (Zone 4)' },
  { minKm: 141, maxKm: 170, basePrice: 5652.62, description: 'Long Distance (Zone 4-5)' },
  { minKm: 171, maxKm: 200, basePrice: 6691.40, description: 'Very Long Distance (Zone 5)' },
  { minKm: 201, maxKm: 999, basePrice: 8231.66, description: 'Extreme Distance (Zone 5+)' }
];

// Function to calculate price based on actual KM distance
export function calculatePriceByKM(km: number, operationType: string = 'standard'): number {
  // Find the appropriate tier
  const tier = KM_PRICING_TIERS.find(t => km >= t.minKm && km <= t.maxKm);
  
  if (!tier) {
    // Fallback to highest tier if KM exceeds all tiers
    return KM_PRICING_TIERS[KM_PRICING_TIERS.length - 1].basePrice;
  }
  
  // SLM operations cost more (approximately 500 TL additional)
  if (operationType === 'slm') {
    return tier.basePrice + 501.58;
  }
  
  return tier.basePrice;
}

// Function to get zone from KM (for legacy compatibility)
export function getZoneFromKM(km: number): number {
  if (km <= 15) return 1;
  if (km <= 50) return 2;
  if (km <= 110) return 3;
  if (km <= 140) return 4;
  if (km <= 200) return 5;
  return 6;
}

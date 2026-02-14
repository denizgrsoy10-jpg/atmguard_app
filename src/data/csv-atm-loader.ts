// CSV ATM Data Loader - Tüm 2770 ATM'i yükler
// CSV dosyasını direkt import etmek yerine, fetch ile yükleyeceğiz

export interface ATMRecord {
  id: string;
  name: string;
  model: string;
  cashCenter: string;
  serviceDays: string;
  zone: number;
  km: number;
  prices: {
    nakitIkmal: number;
    flm: number;
    slm: number;
    madeniIkmal: number;
    paraToplama: number;
    paraToplamaIkmal: number;
    paraToplamaFlm: number;
  };
}

// Türkçe virgülü sayıyı parse et (örn: "3.789,98 " → 3789.98)
function parsePrice(priceStr: string): number {
  const cleaned = priceStr.trim().replace('.', '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// Tüm ATM'leri CSV'den yükle
export async function loadAllATMs(): Promise<ATMRecord[]> {
  try {
    // CSV dosyasını fetch ile yükle
    const response = await fetch('/ai_engine/zone carpan fiyat 3.csv');
    const csvText = await response.text();
    
    return parseCSVData(csvText);
  } catch (error) {
    console.error('CSV yükleme hatası:', error);
    return [];
  }
}

// CSV parsing fonksiyonu (sync)
function parseCSVData(csvText: string): ATMRecord[] {
  const lines = csvText.split('\n');
  const atms: ATMRecord[] = [];

  // İlk 3 satır header (Tablo 1, boş, başlıklar)
  for (let i = 3; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(';');
    if (parts.length < 14) continue;

    const id = parts[0]?.trim();
    const name = parts[1]?.trim();
    const model = parts[2]?.trim();
    const cashCenter = parts[3]?.trim();
    const serviceDays = parts[4]?.trim();
    const zone = parseInt(parts[5]?.trim() || '0');
    const km = parseInt(parts[6]?.trim() || '0');

    // ATM ID boş veya geçersizse atla
    if (!id || !name || !cashCenter) continue;

    atms.push({
      id,
      name,
      model,
      cashCenter,
      serviceDays,
      zone,
      km,
      prices: {
        nakitIkmal: parsePrice(parts[7] || '0'),
        flm: parsePrice(parts[8] || '0'),
        slm: parsePrice(parts[9] || '0'),
        madeniIkmal: parsePrice(parts[10] || '0'),
        paraToplama: parsePrice(parts[11] || '0'),
        paraToplamaIkmal: parsePrice(parts[12] || '0'),
        paraToplamaFlm: parsePrice(parts[13] || '0'),
      },
    });
  }

  return atms;
}

// Nakit merkezlerine göre grupla
export function groupByCashCenter(atms: ATMRecord[]): Record<string, ATMRecord[]> {
  const grouped: Record<string, ATMRecord[]> = {};

  atms.forEach(atm => {
    if (!grouped[atm.cashCenter]) {
      grouped[atm.cashCenter] = [];
    }
    grouped[atm.cashCenter].push(atm);
  });

  // Her grubu KM'ye göre sırala (yakından uzağa)
  Object.keys(grouped).forEach(center => {
    grouped[center].sort((a, b) => a.km - b.km);
  });

  return grouped;
}

// Nakit merkezi istatistikleri
export interface CashCenterStats {
  centerName: string;
  atmCount: number;
  avgKm: number;
  minKm: number;
  maxKm: number;
  totalMonthly: number;
  totalYearly: number;
}

export function getCashCenterStats(atms: ATMRecord[], monthlyOperations: { ikmal: number; flm: number; slm: number; paraToplama: number }): CashCenterStats[] {
  const grouped = groupByCashCenter(atms);
  const stats: CashCenterStats[] = [];

  Object.entries(grouped).forEach(([centerName, centerAtms]) => {
    const totalKm = centerAtms.reduce((sum, atm) => sum + atm.km, 0);
    const kms = centerAtms.map(atm => atm.km);
    
    // Her ATM için aylık maliyet hesapla
    const totalMonthly = centerAtms.reduce((sum, atm) => {
      const ikmalCost = atm.prices.nakitIkmal * monthlyOperations.ikmal;
      const flmCost = atm.prices.flm * monthlyOperations.flm;
      const slmCost = atm.prices.slm * monthlyOperations.slm;
      const paraToplamaCost = atm.prices.paraToplama * monthlyOperations.paraToplama;
      return sum + ikmalCost + flmCost + slmCost + paraToplamaCost;
    }, 0);

    stats.push({
      centerName,
      atmCount: centerAtms.length,
      avgKm: totalKm / centerAtms.length,
      minKm: Math.min(...kms),
      maxKm: Math.max(...kms),
      totalMonthly,
      totalYearly: totalMonthly * 12,
    });
  });

  // Toplam maliyete göre sırala (yüksekten düşüğe)
  return stats.sort((a, b) => b.totalMonthly - a.totalMonthly);
}

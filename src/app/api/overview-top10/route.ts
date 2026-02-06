import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

type ATM = {
  atm_id: string;
  atm_name?: string;
  city: string;
  district: string;
  zone?: string | number;
  atm_age?: string;
  latitude: number;
  longitude: number;
  active?: boolean;
};

type TopItem = {
  atm_id: string;
  atm_name: string;
  city: string;
  district: string;
  slm_prob: number;
  risk_band: "High" | "Medium" | "Low";
  expected_saving_try: number;
  reason: string;
  availability: number;
  riskScore: number;
};

export async function GET() {
  try {
    // JSON dosyasını oku
    const filePath = join(process.cwd(), "src/data/atm_master.json");
    const fileContent = readFileSync(filePath, "utf-8");
    const atms = JSON.parse(fileContent) as ATM[];
    
    // Risk hesaplama
    const withRisk = atms
      .filter((a) => a.active !== false)
      .map((a, idx) => {
        // Risk hesapla: atm_age, zone ve rastgele faktöre göre
        const age = parseInt(a.atm_age || "5", 10);
        const zone = parseInt(String(a.zone || "1"), 10);
        
        // Base risk score (yaşa ve zone'a göre) + pseudo-random
        let riskScore = 0.4 + (age * 0.04) + (zone * 0.015);
        // Pseudo-random: atm_id'ye göre deterministic ama dağınık
        const hashScore = (idx * 17 + a.atm_id.charCodeAt(0)) % 100 / 200;
        riskScore += hashScore;
        riskScore = Math.min(0.95, Math.max(0.3, riskScore));
        
        // Risk band belirle
        let riskBand: "High" | "Medium" | "Low" = "Low";
        if (riskScore >= 0.75) riskBand = "High";
        else if (riskScore >= 0.55) riskBand = "Medium";
        
        // Expected saving türet
        const baseSaving = 1000 + (riskScore * 600);
        
        // Availability hesapla (risk arttıkça availability düşer)
        // Yüksek risk = düşük availability, Düşük risk = yüksek availability
        const baseAvailability = 99.5 - (riskScore * 7); // 92.5% - 99.5% arası
        const availability = Math.round((baseAvailability + (hashScore * 2)) * 100) / 100;
        
        const reasons = [
          "Yaşlı ekipman, tamir sıklığı artmış",
          "Bölgesel anomali, drift sinyali",
          "Cash flow yönetimi optimizasyonu",
          "Uptime düşüş, network sorunları",
          "Bakım gereksinimi artışı"
        ];
        
        return {
          atm_id: a.atm_id,
          atm_name: a.atm_name || "N/A",
          city: a.city,
          district: a.district,
          zone: a.zone,
          slm_prob: riskScore,
          risk_band: riskBand,
          expected_saving_try: Math.round(baseSaving),
          reason: reasons[idx % reasons.length],
          availability: availability,
          riskScore
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore);

    // Bölgelere göre dağıtmak için: farklı şehirlerden seçici olarak al
    const cityMap = new Map<string, typeof withRisk>();
    const result: TopItem[] = [];
    
    // Riskli ATM'leri şehre göre grupla
    for (const item of withRisk) {
      if (!cityMap.has(item.city)) {
        cityMap.set(item.city, []);
      }
      cityMap.get(item.city)!.push(item);
    }

    // Her şehirden en fazla 2 ATM al, toplam 10 olana kadar
    for (const [city, items] of cityMap) {
      if (result.length >= 10) break;
      const take = Math.min(2, items.length, 10 - result.length);
      result.push(...items.slice(0, take));
    }

    // Eğer 10'dan az ise, geri kalanını ekle
    if (result.length < 10) {
      const remaining = withRisk.filter((item) => !result.some((r) => r.atm_id === item.atm_id));
      result.push(...remaining.slice(0, 10 - result.length));
    }

    // Tekrar risk score'a göre sırala (en yüksek ilk)
    result.sort((a, b) => b.riskScore - a.riskScore);

    const finalItems = result.slice(0, 10) as TopItem[];

    return NextResponse.json({
      items: finalItems
    });
  } catch (error) {
    console.error("Error fetching ATM data:", error);
    return NextResponse.json({
      items: []
    }, { status: 500 });
  }
}

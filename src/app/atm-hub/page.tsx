'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import atmMasterData from '@/data/atm_master.json';

const RouteMapComponent = dynamic(() => import('../cashflow-ops/RouteMap'), { ssr: false });

interface ATMMaster {
  atm_id: string;
  atm_name: string;
  region: string;
  city: string;
  district: string;
  location_type: string;
  brand: string;
  model: string;
  atm_age: string;
  latitude: string;
  longitude: string;
  active: boolean;
}

interface ATMHubData {
  atmId: string;
  atmName: string;
  location: string;
  city: string;
  district: string;
  region: string;
  locationType: string;
  brand: string;
  model: string;
  atmAge: string;
  
  // Para Yatırma ve Çekme Arızaları
  depositFailureCount: number;          // Para yatırma arıza işlem adedi
  withdrawalFailureCount: number;       // Para çekme arıza işlem adedi
  withdrawalNoReplenishCount: number;   // İkmal yapılmadığı için kaçan çekim
  
  // Kasa ve Bakiye
  avgCashBalance: number;               // Ortalama kasa bakiyesi
  currentCashBalance: number;           // Online - Şu anki bakiye
  cassette1: number;                    // 200₺ Kaset 1 (Para Çekme)
  cassette2: number;                    // 200₺ Kaset 2 (Para Çekme)
  cassette3: number;                    // 100₺ Kaset 3 (Para Çekme)
  cassette4: number;                    // 100₺ Kaset 4 (Para Çekme)
  depositCassette: number;              // Para Yatırma Kaseti (Toplam)
  deposit200: number;                   // 200₺ banknot adedi
  deposit100: number;                   // 100₺ banknot adedi
  deposit50: number;                    // 50₺ banknot adedi
  lastBalanceUpdate: string;            // Son güncelleme zamanı
  
  // Arıza ve Müdahale
  faultCount: number;                   // Arıza adedi
  atmResponseTime: number;              // ATM müdahale süresi (dakika)
  slmResponseTime: number;              // SLM teknisyen müdahale süresi (dakika)
  
  // Availability
  atmAvailability: number;              // ATM availability (%) - Güncel
  locationAvailability: number;         // Lokasyon bazlı availability (%) - Güncel
  withdrawalAvailability: number;       // Para çekme availability
  depositAvailability: number;          // Para yatırma availability
  atmAvailabilityDaily: number;         // Günlük ATM availability
  locationAvailabilityDaily: number;    // Günlük lokasyon availability
  atmAvailability1Month: number;        // 1 aylık ATM availability
  locationAvailability1Month: number;   // 1 aylık lokasyon availability
  atmAvailability3Months: number;       // 3 aylık ATM availability
  locationAvailability3Months: number;  // 3 aylık lokasyon availability
  atmAvailability6Months: number;       // 6 aylık ATM availability
  locationAvailability6Months: number;  // 6 aylık lokasyon availability

  // Beyin overlay (canlı beslenince dolu)
  brainEylem?: string;
  brainAciliyet?: string;
  brainSebepler?: string[];
}

type HubOverlay = Partial<Pick<
  ATMHubData,
  | 'faultCount' | 'atmResponseTime' | 'slmResponseTime'
  | 'depositFailureCount' | 'withdrawalFailureCount' | 'withdrawalNoReplenishCount'
  | 'atmAvailability' | 'locationAvailability' | 'withdrawalAvailability' | 'depositAvailability'
  | 'atmAvailabilityDaily' | 'locationAvailabilityDaily'
  | 'atmAvailability1Month' | 'locationAvailability1Month'
  | 'atmAvailability3Months' | 'locationAvailability3Months'
  | 'atmAvailability6Months' | 'locationAvailability6Months'
  | 'brainEylem' | 'brainAciliyet' | 'brainSebepler'
>>;

type HubSummary = {
  total_atms: number;
  brain_tracked: number;
  aktif_ariza: number;
  bakiye_kaydi: number;
  kritik_atm: number;
  kombine_servis: number;
  toplam_nakit_tl: number;
  karar_sayisi: number;
};

// Animasyonlu sayı bileşeni
function AnimatedNumber({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const duration = 1500;
    const steps = 50;
    const increment = value / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(current);
      }
    }, duration / steps);
    
    return () => clearInterval(timer);
  }, [value]);
  
  return (
    <>
      {count.toLocaleString('tr-TR', { 
        minimumFractionDigits: decimals, 
        maximumFractionDigits: decimals 
      })}
      {suffix}
    </>
  );
}

// Metric Card Component
function MetricCard({ 
  title, 
  value, 
  icon, 
  color = 'blue',
  decimals = 0,
  suffix = '',
  trend,
  subtitle,
  trendLabel = 'geçen aya göre'
}: { 
  title: string; 
  value: number; 
  icon: string; 
  color?: string;
  decimals?: number;
  suffix?: string;
  trend?: number;
  subtitle?: string;
  trendLabel?: string;
}) {
  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/50',
    red: 'from-red-500/20 to-red-600/20 border-red-500/50',
    green: 'from-green-500/20 to-green-600/20 border-green-500/50',
    yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/50',
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/50',
    orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/50',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} border rounded-xl p-4 backdrop-blur-sm`}>
      <div className="flex items-start justify-between mb-3">
        <div className="text-2xl">{icon}</div>
        {trend !== undefined && (
          <div className="flex flex-col items-end">
            <div className={`text-xs font-semibold ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trend >= 0 ? '↗' : '↘'} {Math.abs(trend)}%
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">{trendLabel}</div>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold mb-1">
        <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
      </div>
      <div className="text-xs text-gray-300 font-medium leading-tight">{title}</div>
      {subtitle && (
        <div className="text-xs text-gray-400 mt-1 leading-tight">{subtitle}</div>
      )}
    </div>
  );
}

export default function ATMHubPage() {
  const [atmList, setAtmList] = useState<ATMHubData[]>([]);
  const [selectedATM, setSelectedATM] = useState<ATMHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hubSource, setHubSource] = useState<'brain' | 'mock'>('mock');
  const [hubSummary, setHubSummary] = useState<HubSummary | null>(null);
  
  // Filtre state'leri
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Açılır kart state'leri
  const [expandedSections, setExpandedSections] = useState({
    availability: false,
    failures: false,
    cash: false,
    onlineBalance: false,
    faults: false,
    summary: false,
  });

  // Availability periyot seçimi
  const [availabilityPeriod, setAvailabilityPeriod] = useState<'daily' | '1month' | '3months' | '6months' | 'custom'>('1month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Harita modal state'leri
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapCenterATM, setMapCenterATM] = useState<ATMHubData | null>(null);

  useEffect(() => {
    async function loadATMData() {
      setLoading(true);

      // Beyin overlay — terminal bazlı canlı metrikler
      let overlay: Record<string, HubOverlay> = {};
      try {
        const r = await fetch('/api/atm-hub', { cache: 'no-store' });
        const j = await r.json();
        overlay = j.overlay || {};
        setHubSource(j._source === 'brain' ? 'brain' : 'mock');
        setHubSummary(j.summary || null);
      } catch {
        setHubSource('mock');
        setHubSummary(null);
      }

      const activeATMs = (atmMasterData as ATMMaster[])
        .filter(atm => atm.active);

      const atmDataWithMetrics: ATMHubData[] = activeATMs.map(atm => {
        const brain = overlay[atm.atm_id];
        const availability = brain?.atmAvailability ?? (90 + Math.random() * 9);
        const isGood = availability > 95;

        const mockMetrics = {
          depositFailureCount: Math.floor(Math.random() * (isGood ? 10 : 20)) + (isGood ? 3 : 8),
          withdrawalFailureCount: Math.floor(Math.random() * (isGood ? 8 : 15)) + (isGood ? 2 : 5),
          withdrawalNoReplenishCount: Math.floor(Math.random() * (isGood ? 15 : 35)) + (isGood ? 5 : 15),
          avgCashBalance: Math.floor(Math.random() * 200000) + 150000,
          currentCashBalance: Math.floor(Math.random() * 300000) + 100000,
          cassette1: Math.floor(Math.random() * 150000) + 80000,
          cassette2: Math.floor(Math.random() * 150000) + 80000,
          cassette3: Math.floor(Math.random() * 150000) + 80000,
          cassette4: Math.floor(Math.random() * 150000) + 80000,
          ...((): { depositCassette: number; deposit200: number; deposit100: number; deposit50: number } => {
            const count200 = Math.floor(Math.random() * 600) + 300;
            const count100 = Math.floor(Math.random() * 500) + 200;
            const count50 = Math.floor(Math.random() * 300) + 100;
            const total = (count200 * 200) + (count100 * 100) + (count50 * 50);
            return { depositCassette: total, deposit200: count200, deposit100: count100, deposit50: count50 };
          })(),
          lastBalanceUpdate: new Date(Date.now() - Math.random() * 3600000).toISOString(),
          faultCount: Math.floor(Math.random() * (isGood ? 5 : 12)) + (isGood ? 1 : 3),
          atmResponseTime: Math.floor(Math.random() * (isGood ? 30 : 50)) + (isGood ? 25 : 40),
          slmResponseTime: Math.floor(Math.random() * (isGood ? 60 : 100)) + (isGood ? 60 : 90),
          atmAvailability: availability,
          locationAvailability: availability - (Math.random() * 2),
          withdrawalAvailability: availability - (Math.random() * 1),
          depositAvailability: availability - (Math.random() * 3),
          atmAvailabilityDaily: availability + (Math.random() * 2 - 1),
          locationAvailabilityDaily: availability - (Math.random() * 1.5),
          atmAvailability1Month: availability - (Math.random() * 1.5),
          locationAvailability1Month: availability - (Math.random() * 2.5),
          atmAvailability3Months: availability - (Math.random() * 2),
          locationAvailability3Months: availability - (Math.random() * 3),
          atmAvailability6Months: availability - (Math.random() * 2.5),
          locationAvailability6Months: availability - (Math.random() * 3.5),
        };

        return {
          atmId: atm.atm_id,
          atmName: atm.atm_name,
          location: `${atm.city} / ${atm.district}`,
          city: atm.city,
          district: atm.district,
          region: atm.region,
          locationType: atm.location_type,
          brand: atm.brand,
          model: atm.model,
          atmAge: atm.atm_age,
          ...mockMetrics,
          ...(brain ? {
            faultCount: brain.faultCount ?? mockMetrics.faultCount,
            atmResponseTime: brain.atmResponseTime ?? mockMetrics.atmResponseTime,
            slmResponseTime: brain.slmResponseTime ?? mockMetrics.slmResponseTime,
            depositFailureCount: brain.depositFailureCount ?? mockMetrics.depositFailureCount,
            withdrawalFailureCount: brain.withdrawalFailureCount ?? mockMetrics.withdrawalFailureCount,
            withdrawalNoReplenishCount: brain.withdrawalNoReplenishCount ?? mockMetrics.withdrawalNoReplenishCount,
            atmAvailability: brain.atmAvailability ?? mockMetrics.atmAvailability,
            locationAvailability: brain.locationAvailability ?? mockMetrics.locationAvailability,
            withdrawalAvailability: brain.withdrawalAvailability ?? mockMetrics.withdrawalAvailability,
            depositAvailability: brain.depositAvailability ?? mockMetrics.depositAvailability,
            atmAvailabilityDaily: brain.atmAvailabilityDaily ?? mockMetrics.atmAvailabilityDaily,
            locationAvailabilityDaily: brain.locationAvailabilityDaily ?? mockMetrics.locationAvailabilityDaily,
            atmAvailability1Month: brain.atmAvailability1Month ?? mockMetrics.atmAvailability1Month,
            locationAvailability1Month: brain.locationAvailability1Month ?? mockMetrics.locationAvailability1Month,
            atmAvailability3Months: brain.atmAvailability3Months ?? mockMetrics.atmAvailability3Months,
            locationAvailability3Months: brain.locationAvailability3Months ?? mockMetrics.locationAvailability3Months,
            atmAvailability6Months: brain.atmAvailability6Months ?? mockMetrics.atmAvailability6Months,
            locationAvailability6Months: brain.locationAvailability6Months ?? mockMetrics.locationAvailability6Months,
            brainEylem: brain.brainEylem,
            brainAciliyet: brain.brainAciliyet,
            brainSebepler: brain.brainSebepler,
          } : {}),
        };
      });

      setAtmList(atmDataWithMetrics);
      setSelectedATM(atmDataWithMetrics[0] ?? null);
      setLoading(false);
    }

    loadATMData();
  }, []);

  // Filtrelenmiş ve sıralanmış ATM listesi
  const filteredATMs = atmList
    .filter(atm => {
      if (selectedRegion !== 'all' && atm.region !== selectedRegion) return false;
      if (selectedCity !== 'all' && atm.city !== selectedCity) return false;
      // Arama sorgusu filtresi
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        return atm.atmName.toLowerCase().includes(query) || 
               atm.atmId.toLowerCase().includes(query) ||
               atm.district.toLowerCase().includes(query);
      }
      return true;
    })
    .sort((a, b) => {
      // Önce şehre göre sırala
      if (a.city !== b.city) return a.city.localeCompare(b.city, 'tr');
      // Sonra ilçeye göre sırala
      if (a.district !== b.district) return a.district.localeCompare(b.district, 'tr');
      // Son olarak ATM adına göre sırala
      return a.atmName.localeCompare(b.atmName, 'tr');
    });

  // Benzersiz bölgeler ve şehirler
  const regions = ['all', ...Array.from(new Set(atmList.map(a => a.region)))];
  const cities = selectedRegion === 'all' 
    ? ['all', ...Array.from(new Set(atmList.map(a => a.city)))]
    : ['all', ...Array.from(new Set(atmList.filter(a => a.region === selectedRegion).map(a => a.city)))];

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Mesafe hesaplama fonksiyonu (Haversine formula - yaklaşık km)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Dünya'nın yarıçapı km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Koordinat hesaplama (ATM master datasından gerçek koordinatları al)
  const getCoords = (atmId: string) => {
    const atmData = (atmMasterData as ATMMaster[]).find(a => a.atm_id === atmId);
    
    if (atmData && atmData.latitude && atmData.longitude) {
      // Virgül ile ayrılmış string'i parse et (Türkiye formatı)
      const lat = parseFloat(atmData.latitude.replace(',', '.'));
      const lon = parseFloat(atmData.longitude.replace(',', '.'));
      
      // Geçerli koordinat kontrolü
      if (!isNaN(lat) && !isNaN(lon) && lat >= 36 && lat <= 42 && lon >= 26 && lon <= 45) {
        return { lat, lon };
      }
    }
    
    // Fallback: Eğer koordinat bulunamazsa veya geçersizse, merkezi bir nokta döndür
    return { lat: 39.0, lon: 35.0 };
  };

  // En yakın 5 ATM'yi bul
  const getNearbyATMs = (centerAtm: ATMHubData): Array<ATMHubData & { distance: number; lat: number; lon: number }> => {
    const centerCoords = getCoords(centerAtm.atmId);
    
    return atmList
      .filter(atm => atm.atmId !== centerAtm.atmId)
      .map(atm => {
        const coords = getCoords(atm.atmId);
        const distance = calculateDistance(
          centerCoords.lat, centerCoords.lon,
          coords.lat, coords.lon
        );
        return { ...atm, distance, lat: coords.lat, lon: coords.lon };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  };

  // Harita modalını aç
  const openMapModal = (atm: ATMHubData) => {
    setMapCenterATM(atm);
    setShowMapModal(true);
  };

  // Excel export fonksiyonu
  const exportToExcel = () => {
    if (!selectedATM) return;
    
    // Kök neden analizi ve önerileri hesapla
    const isBranch = selectedATM.locationType === "Şube";
    const rootCauses: string[] = [];
    const recommendations: string[] = [];
    
    // Performans değerlendirmesi
    if (selectedATM.atmAvailability >= 95) {
      rootCauses.push('✅ PERFORMANS MÜKEMMEL SEVİYEDE');
      rootCauses.push(`ATM %${selectedATM.atmAvailability.toFixed(2)} availability ile hedefin üzerinde çalışıyor.`);
      rootCauses.push('Sorunsuz devam etmektedir. Mevcut bakım ve operasyon prosedürleri etkin çalışıyor.');
      recommendations.push('Mevcut operasyon kalitesi korunmalı, best practice olarak paylaşılmalı');
    } else {
      // Düşük availability analizi
      if (selectedATM.atmAvailability < 92) {
        rootCauses.push(`📉 DÜŞÜK AVAILABİLİTY TESPİT EDİLDİ - %${selectedATM.atmAvailability.toFixed(2)} (Hedef: %95)`);
        if (selectedATM.faultCount > 8) {
          rootCauses.push(`- Yüksek arıza sıklığı (${selectedATM.faultCount} adet) availability'yi düşürüyor.`);
        }
        if (selectedATM.withdrawalNoReplenishCount > 25) {
          rootCauses.push(`- İkmal eksikliği nedeniyle para çekme işlemleri yapılamıyor (${selectedATM.withdrawalNoReplenishCount} kayıp).`);
        }
        rootCauses.push('- Arızalara geç müdahale edilmesi servis dışı kalma süresini artırıyor.');
        recommendations.push('Öncelikli olarak arıza kaynaklarını azaltıcı önleyici bakım planlanmalı');
      }
      
      // Müdahale süreleri analizi
      if (selectedATM.atmResponseTime > 45 || selectedATM.slmResponseTime > 100) {
        if (selectedATM.atmResponseTime > 45 && isBranch) {
          rootCauses.push(`⏱️ PERSONEL MÜDAHALE SÜRESİ HEDEF ÜZERINDE - ${selectedATM.atmResponseTime} dk (Hedef: 30 dk)`);
          rootCauses.push('- Şube personeli ATM arızasına zamanında müdahale edemiyor.');
          rootCauses.push('- Şube içi iş yoğunluğu ATM\'nin önceliklendirilmesini engelliyor.');
          recommendations.push('Şube personeline ATM müdahale prosedürleri konusunda acil eğitim verilmeli ve performans hedefleri güncellenmeli');
          recommendations.push('Şube yönetimi ile ATM operasyonel performans hedefleri revize edilmeli');
        } else if (selectedATM.atmResponseTime > 45 && !isBranch) {
          rootCauses.push(`⏱️ PERSONEL MÜDAHALE SÜRESİ HEDEF ÜZERINDE - ${selectedATM.atmResponseTime} dk (Hedef: 30 dk)`);
          rootCauses.push('- Offsite lokasyonda teknik destek kapasitesi yetersiz.');
          rootCauses.push('- Bölgesel müdahale ekibinin lokasyona ulaşım süresi uzun.');
          recommendations.push('Bölgesel müdahale ekibi kapasitesi gözden geçirilmeli veya lokasyon rotası optimize edilmeli');
        }
        
        if (selectedATM.slmResponseTime > 100) {
          const hoursDelay = Math.floor(selectedATM.slmResponseTime / 60);
          const daysDelay = Math.floor(hoursDelay / 24);
          rootCauses.push(`⏱️ SLM TEKNİSYEN SÜRESİ HEDEF ÜZERINDE - ${selectedATM.slmResponseTime} dk (${hoursDelay} saat) (Hedef: 90 dk)`);
          if (daysDelay >= 1) {
            rootCauses.push(`- Arıza kaydı açıldıktan sonra teknisyen müdahalesi ${daysDelay} gün gecikmiş.`);
          }
          rootCauses.push('- Servis sağlayıcı ile SLA (Service Level Agreement) gözden geçirilmeli.');
          recommendations.push('SLM servis sağlayıcı ile SLA gözden geçirilmeli ve teknisyen müdahale süreleri iyileştirilmeli');
          recommendations.push('Teknisyen müsaitliği ve yedek parça temini süreçleri iyileştirilmeli');
        }
      }
      
      // Arıza sıklığı analizi
      if (selectedATM.faultCount > 8) {
        rootCauses.push(`⚡ YÜKSEK ARIZA SIKLIĞI - ${selectedATM.faultCount} adet (Son 30 gün)`);
        if (selectedATM.atmAge > '36') {
          rootCauses.push(`- ATM yaşı (${selectedATM.atmAge} ay) nedeniyle donanım yıpranması artıyor.`);
          rootCauses.push('- Cihaz yenileme veya kapsamlı bakım gerekli.');
        } else {
          rootCauses.push('- Kullanım yoğunluğu veya çevresel faktörler (toz, nem) arızaları tetikliyor.');
          rootCauses.push('- Önleyici bakım periyodu kısaltılmalı.');
        }
        recommendations.push('Tekrarlayan arıza tiplerinin detaylı root-cause analizi yapılmalı');
      }
      
      // İkmal sorunları
      if (selectedATM.withdrawalNoReplenishCount > 25) {
        rootCauses.push(`💰 İKMAL EKSİKLİĞİ SORUNU - ${selectedATM.withdrawalNoReplenishCount} kayıp işlem`);
        rootCauses.push('- İkmal rotası optimizasyonu yetersiz veya nakit planlama hatalı.');
        rootCauses.push('- CIT (Cash In Transit) frekansı artırılmalı ve talep tahmini iyileştirilmeli.');
        recommendations.push('İkmal frekansı artırılmalı ve talep bazlı dinamik planlama uygulanmalı');
      }
      
      // Para yatırma arızaları
      if (selectedATM.depositFailureCount > 12) {
        rootCauses.push(`📥 PARA YATIRMA ARIZALARI - ${selectedATM.depositFailureCount} adet başarısız işlem`);
        rootCauses.push('- Banknot okuma sensörleri veya depository kaseti temizlik gerektirebilir.');
        rootCauses.push('- Periyodik temizlik ve kalibrasyon yapılmalı.');
      }
      
      // Genel öneri
      if (selectedATM.atmAvailability < 85 && isBranch && rootCauses.length === 0) {
        rootCauses.push(`⚠️ PERFORMANS İYİLEŞTİRME GEREKLİ - %${selectedATM.atmAvailability.toFixed(2)} availability`);
        recommendations.push('Şube ATM\'si için detaylı performans analizi yapılmalı ve iyileştirme aksiyonları planlanmalı');
      } else if (rootCauses.length === 0) {
        rootCauses.push(`ℹ️ PERFORMANS TAKİP EDİLİYOR - %${selectedATM.atmAvailability.toFixed(2)} availability`);
        if (selectedATM.atmAvailability >= 85 && selectedATM.atmAvailability < 95) {
          rootCauses.push('Performans kabul edilebilir seviyede. Rutin bakım ve izleme devam ediyor.');
        }
      }
    }
    
    const data = [
      ['ATM DETAYLI RAPOR', ''],
      ['Rapor Tarihi', new Date().toLocaleDateString('tr-TR')],
      ['', ''],
      ['=== ATM BİLGİLERİ ===', ''],
      ['ATM ID', selectedATM.atmId],
      ['ATM Adı', selectedATM.atmName],
      ['Lokasyon Tipi', selectedATM.locationType],
      ['Lokasyon', selectedATM.location],
      ['Şehir', selectedATM.city],
      ['İlçe', selectedATM.district],
      ['Bölge', selectedATM.region],
      ['Marka', selectedATM.brand],
      ['Model', selectedATM.model],
      ['Yaş (Ay)', selectedATM.atmAge],
      ['Son Bakiye Güncelleme', selectedATM.lastBalanceUpdate],
      ['', ''],
      ['=== AVAILABİLİTY METRİKLERİ ===', ''],
      ['ATM Availability (Günlük)', `${selectedATM.atmAvailabilityDaily.toFixed(2)}%`],
      ['ATM Availability (1 Aylık)', `${selectedATM.atmAvailability1Month.toFixed(2)}%`],
      ['ATM Availability (3 Aylık)', `${selectedATM.atmAvailability3Months.toFixed(2)}%`],
      ['ATM Availability (6 Aylık)', `${selectedATM.atmAvailability6Months.toFixed(2)}%`],
      ['Lokasyon Availability (Günlük)', `${selectedATM.locationAvailabilityDaily.toFixed(2)}%`],
      ['Lokasyon Availability (1 Aylık)', `${selectedATM.locationAvailability1Month.toFixed(2)}%`],
      ['Lokasyon Availability (3 Aylık)', `${selectedATM.locationAvailability3Months.toFixed(2)}%`],
      ['Lokasyon Availability (6 Aylık)', `${selectedATM.locationAvailability6Months.toFixed(2)}%`],
      ['Para Çekme Availability', `${selectedATM.withdrawalAvailability.toFixed(2)}%`],
      ['Para Yatırma Availability', `${selectedATM.depositAvailability.toFixed(2)}%`],
      ['', ''],
      ['=== BAŞARISIZ İŞLEM ADETLERİ (GÜNLÜK) ===', ''],
      ['Para Yatırma Arızası', selectedATM.depositFailureCount],
      ['Para Çekme Arızası', selectedATM.withdrawalFailureCount],
      ['İkmal Eksikliği (İkmal Yapılmadığı İçin)', selectedATM.withdrawalNoReplenishCount],
      ['Toplam Başarısız İşlem', selectedATM.depositFailureCount + selectedATM.withdrawalFailureCount + selectedATM.withdrawalNoReplenishCount],
      ['', ''],
      ['=== KASA BAKİYELERİ ===', ''],
      ['Ortalama Kasa Bakiyesi', `₺${selectedATM.avgCashBalance.toLocaleString('tr-TR')}`],
      ['Mevcut Toplam Kasa Bakiyesi', `₺${selectedATM.currentCashBalance.toLocaleString('tr-TR')}`],
      ['', ''],
      ['Para Çekme Kasetleri', ''],
      ['Kaset 1 - 200₺', `₺${selectedATM.cassette1.toLocaleString('tr-TR')}`],
      ['Kaset 2 - 200₺', `₺${selectedATM.cassette2.toLocaleString('tr-TR')}`],
      ['Kaset 3 - 100₺', `₺${selectedATM.cassette3.toLocaleString('tr-TR')}`],
      ['Kaset 4 - 100₺', `₺${selectedATM.cassette4.toLocaleString('tr-TR')}`],
      ['Para Çekme Kasetleri Toplamı', `₺${(selectedATM.cassette1 + selectedATM.cassette2 + selectedATM.cassette3 + selectedATM.cassette4).toLocaleString('tr-TR')}`],
      ['', ''],
      ['Para Yatırma Kaseti', ''],
      ['Toplam Tutar', `₺${selectedATM.depositCassette.toLocaleString('tr-TR')}`],
      ['200₺ Banknot Adedi', selectedATM.deposit200],
      ['100₺ Banknot Adedi', selectedATM.deposit100],
      ['50₺ Banknot Adedi', selectedATM.deposit50],
      ['Toplam Banknot Adedi', selectedATM.deposit200 + selectedATM.deposit100 + selectedATM.deposit50],
      ['', ''],
      ['=== ARIZA VE MÜDAHALE DURUMLARI (AYLIK) ===', ''],
      ['Toplam Arıza Adedi (Son 30 Gün)', selectedATM.faultCount],
      ['Personel Müdahale Süresi (Ortalama)', `${selectedATM.atmResponseTime} dakika`],
      ['SLM Teknisyen Müdahale Süresi (Ortalama)', `${selectedATM.slmResponseTime} dakika`],
      ['Ortalama Toplam Müdahale Süresi', `${Math.round((selectedATM.atmResponseTime + selectedATM.slmResponseTime) / 2)} dakika`],
      ['', ''],
      ['=== PERFORMANS ÖZETİ VE ANALİZİ ===', ''],
      ['', ''],
      ['📊 GENEL PERFORMANS DURUMU', ''],
      ['Toplam Başarısız İşlem', `${selectedATM.depositFailureCount + selectedATM.withdrawalFailureCount + selectedATM.withdrawalNoReplenishCount} adet`],
      ['Ortalama Müdahale Süresi', `${Math.round((selectedATM.atmResponseTime + selectedATM.slmResponseTime) / 2)} dakika`],
      ['Availability Durumu', selectedATM.atmAvailability > 95 ? `Mükemmel (${selectedATM.atmAvailability.toFixed(2)}%)` : selectedATM.atmAvailability > 90 ? `İyi (${selectedATM.atmAvailability.toFixed(2)}%)` : `Kritik (${selectedATM.atmAvailability.toFixed(2)}%)`],
      ['Arıza Sıklığı', selectedATM.faultCount > 10 ? `Yüksek (${selectedATM.faultCount})` : selectedATM.faultCount > 5 ? `Orta (${selectedATM.faultCount})` : `Düşük (${selectedATM.faultCount})`],
      ['', ''],
      ['🔍 KÖK NEDEN ANALİZİ VE SORUN TESPİTİ', ''],
      ...rootCauses.map(rc => [rc, '']),
      ['', ''],
      ['🎯 ÖNERİLEN AKSİYONLAR', ''],
      ...recommendations.map((rec, idx) => [`${idx + 1}. ${rec}`, '']),
      ['', ''],
      ['=== PERFORMANS DEĞERLENDİRMESİ ===', ''],
      ['Availability Skoru', `${selectedATM.atmAvailability.toFixed(2)}%`],
      ['Personel Müdahale Performansı', selectedATM.atmResponseTime <= 30 ? 'Hedefin Altında (İyi) ✓' : 'Hedefin Üzerinde (Kötü) ✗'],
      ['SLM Teknisyen Performansı', selectedATM.slmResponseTime <= 90 ? 'Hedefin Altında (İyi) ✓' : 'Hedefin Üzerinde (Kötü) ✗'],
      ['', ''],
      ['=== HEDEFLER VE NOTLAR ===', ''],
      ['• Personel müdahale hedefi: 30 dakika', ''],
      ['• SLM teknisyen müdahale hedefi: 90 dakika', ''],
      ['• Availability hedefi: %95', ''],
      ['• Başarısız işlem verileri günlüktür', ''],
      ['• Arıza ve müdahale verileri aylıktır (son 30 gün)', ''],
      ['• Performans analizi ve öneriler dinamik olarak oluşturulmuştur', ''],
    ];

    const csvContent = data.map(row => row.join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ATM_Detayli_Rapor_${selectedATM.atmId}_${selectedATM.atmName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-gray-400">ATM verileri yükleniyor...</div>
        </div>
      </div>
    );
  }

  if (!selectedATM) {
    return (
      <div className="text-center text-gray-400 py-12">
        ATM seçilmedi.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/50 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="relative inline-block mb-2">
              <span className="absolute -top-6 -right-12 text-[10px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/50 px-2 py-0.5 rounded animate-pulse">
                ✨ NEW
              </span>
              <h1 className="text-4xl font-bold flex items-center gap-3 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(139,92,246,0.5)] tracking-wide" style={{ fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif", letterSpacing: '-0.02em' }}>
                <span className="text-5xl filter drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">🏦</span>
                ATM Business Hub
              </h1>
            </div>
            <p className="text-gray-300 text-sm font-medium tracking-wide">
              💼 Executive Command Center • Real-Time Intelligence Dashboard
            </p>
            {hubSource === 'brain' && hubSummary ? (
              <div className="mt-2 inline-block text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                ● CANLI · {hubSummary.brain_tracked} ATM izleniyor · {hubSummary.karar_sayisi} karar · {hubSummary.aktif_ariza} aktif arıza
              </div>
            ) : (
              <div className="mt-2 inline-block text-[10px] px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                ○ Vitrin — beyin beslenince terminal metrikleri canlanır
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-400">{selectedATM.atmName}</div>
            <div className="text-sm text-gray-400">{selectedATM.atmId} • {selectedATM.location}</div>
            {selectedATM.brainEylem && (
              <div className="text-[10px] mt-1 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 inline-block">
                🧠 {selectedATM.brainEylem} · {selectedATM.brainAciliyet}
              </div>
            )}
          </div>
        </div>

        {/* Filtreler */}
        <div className="flex gap-4 items-center border-t border-blue-500/30 pt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">🌍 Bölge:</span>
            <select
              value={selectedRegion}
              onChange={(e) => {
                setSelectedRegion(e.target.value);
                setSelectedCity('all');
              }}
              className="bg-[#112544] border border-blue-500/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {regions.map(region => (
                <option key={region} value={region}>
                  {region === 'all' ? 'Tüm Bölgeler' : region}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">🏙️ Şehir:</span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-[#112544] border border-blue-500/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {cities.map(city => (
                <option key={city} value={city}>
                  {city === 'all' ? 'Tüm Şehirler' : city}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">📅 Başlangıç:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-[#112544] border border-blue-500/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">📅 Bitiş:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-[#112544] border border-blue-500/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <button
            onClick={() => {
              // Tarih filtresi uygulandı - veri yenileme simülasyonu
              if (startDate && endDate) {
                alert(`Tarih aralığı: ${startDate} - ${endDate}\nVeriler filtrelendi!`);
              }
            }}
            disabled={!startDate || !endDate}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <span>🔍</span>
            <span>Getir</span>
          </button>

          <button
            onClick={exportToExcel}
            disabled={!selectedATM}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <span>📄</span>
            <span>Excel İndir</span>
          </button>

          <div className="ml-auto text-sm text-gray-400">
            📊 {filteredATMs.length} ATM listeleniyor
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Sol Panel - ATM Listesi */}
        <div className="col-span-1 space-y-3">
          <div className="bg-[#112544] border border-blue-500/30 rounded-xl p-4">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              📋 ATM Listesi
            </h3>
            
            {/* Arama Kutusu */}
            <div className="mb-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="ATM adı veya ID ile ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0B1B34] border border-blue-500/50 rounded-lg px-3 py-2 pl-9 text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2 text-gray-400 hover:text-white text-lg"
                  >
                    ×
                  </button>
                )}
              </div>
              {searchQuery && (
                <div className="text-xs text-gray-400 mt-1">
                  {filteredATMs.length} sonuç bulundu
                </div>
              )}
            </div>
            
            <div className="space-y-2 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredATMs.map((atm) => (
                <div key={atm.atmId} className="relative">
                  <button
                    onClick={() => setSelectedATM(atm)}
                    className={`w-full text-left p-3 rounded-lg border transition ${
                      selectedATM.atmId === atm.atmId
                        ? 'bg-blue-600/30 border-blue-500'
                        : 'bg-[#0B1B34] border-gray-700 hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{atm.atmName}</div>
                        <div className="text-xs text-gray-400">{atm.atmId}</div>
                        <div className="text-xs text-gray-500 mt-1">{atm.district}</div>
                        <div className="text-xs text-blue-400 mt-1">{atm.brand}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openMapModal(atm);
                          }}
                          className="p-1 hover:bg-blue-500/20 rounded transition"
                          title="Yakın ATM'leri göster"
                        >
                          <span className="text-base">🗺️</span>
                        </button>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          atm.atmAvailability > 97 ? 'bg-green-500' : 
                          atm.atmAvailability > 95 ? 'bg-yellow-500' : 
                          'bg-red-500'
                        } animate-pulse`}></div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Availability: <span className="text-white font-semibold">{atm.atmAvailability.toFixed(1)}%</span>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sağ Panel - ATM Detayları (Açılır Kartlar) */}
        <div className="col-span-3 space-y-4">
          
          {/* ATM Bilgileri Kartı */}
          <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/50 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              🏧 ATM Teknik Bilgileri
            </h2>
            <div className="grid grid-cols-5 gap-4">
              <div>
                <div className="text-xs text-gray-400 mb-1">ATM ID</div>
                <div className="text-sm font-bold text-blue-400">{selectedATM.atmId}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Marka</div>
                <div className="text-sm font-semibold">{selectedATM.brand}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Model</div>
                <div className="text-sm font-semibold">{selectedATM.model}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">ATM Yaşı</div>
                <div className="text-sm font-semibold text-yellow-400">{selectedATM.atmAge} yıl</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Şubedeki ATM Sayısı</div>
                <div className="text-sm font-semibold text-cyan-400">
                  {(() => {
                    // Aynı şubedeki ATM'leri bul
                    // Eğer location_type "Şube" ise, aynı district'te ve isim benzer olanları say
                    if (selectedATM.locationType === "Şube") {
                      // ATM isminden şube adını çıkar (genelde ilk 1-2 kelime + "SUBE")
                      const nameWords = selectedATM.atmName.toUpperCase().split(' ');
                      const branchKeywords = nameWords.slice(0, Math.min(2, nameWords.length));
                      
                      const sameBranchATMs = atmList.filter(a => {
                        if (a.locationType !== "Şube" || a.district !== selectedATM.district) return false;
                        const aNameUpper = a.atmName.toUpperCase();
                        // Aynı ilçede ve aynı şube anahtar kelimelerini içeriyorsa
                        return branchKeywords.every(keyword => aNameUpper.includes(keyword));
                      }).length;
                      
                      return `${sameBranchATMs} ATM`;
                    } else {
                      // Offsite ATM'ler için
                      return "1 ATM";
                    }
                  })()}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Lokasyon Tipi</div>
                <div className="text-sm font-semibold">{selectedATM.locationType}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Bölge</div>
                <div className="text-sm font-semibold">{selectedATM.region}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Şehir</div>
                <div className="text-sm font-semibold">{selectedATM.city}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">İlçe</div>
                <div className="text-sm font-semibold">{selectedATM.district}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Durum</div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-sm font-semibold text-green-400">Aktif</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Availability Section */}
          <div className="bg-[#112544] border border-blue-500/30 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('availability')}
              className="w-full p-4 flex items-center justify-between hover:bg-blue-500/10 transition"
            >
              <h2 className="text-xl font-bold flex items-center gap-2">
                📊 Availability Metrikleri
              </h2>
              <span className="text-2xl">{expandedSections.availability ? '▼' : '▶'}</span>
            </button>
            {expandedSections.availability && (
              <div className="p-6 pt-0 space-y-4">
                {/* Periyot Seçici */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setAvailabilityPeriod('daily')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                      availabilityPeriod === 'daily'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#0B1B34] text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    📊 Günlük
                  </button>
                  <button
                    onClick={() => setAvailabilityPeriod('1month')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                      availabilityPeriod === '1month'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#0B1B34] text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    📅 1 Ay
                  </button>
                  <button
                    onClick={() => setAvailabilityPeriod('3months')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                      availabilityPeriod === '3months'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#0B1B34] text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    📅 3 Ay
                  </button>
                  <button
                    onClick={() => setAvailabilityPeriod('6months')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                      availabilityPeriod === '6months'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#0B1B34] text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    📅 6 Ay
                  </button>
                  <button
                    onClick={() => setAvailabilityPeriod('custom')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                      availabilityPeriod === 'custom'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#0B1B34] text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    📆 Tarih Aralığı
                  </button>
                </div>

                {/* Tarih Aralığı Seçici */}
                {availabilityPeriod === 'custom' && (
                  <div className="bg-[#0B1B34] border border-blue-500/30 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-400 mb-2 block">Başlangıç Tarihi</label>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="w-full bg-[#112544] border border-blue-500/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-2 block">Bitiş Tarihi</label>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="w-full bg-[#112544] border border-blue-500/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                    {customStartDate && customEndDate && (
                      <div className="text-xs text-gray-400 mt-2">
                        Seçili aralık: {new Date(customStartDate).toLocaleDateString('tr-TR')} - {new Date(customEndDate).toLocaleDateString('tr-TR')}
                      </div>
                    )}
                  </div>
                )}

                {/* Metrikler */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-green-500/50 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="text-4xl">📊</div>
                        <div>
                          <div className="text-base font-semibold text-gray-300">ATM Availability</div>
                          <div className="text-xs text-gray-400">
                            {availabilityPeriod === 'daily' ? 'Bugün' : 
                             availabilityPeriod === '1month' ? 'Son 1 ay' : 
                             availabilityPeriod === '3months' ? 'Son 3 ay' : 
                             availabilityPeriod === '6months' ? 'Son 6 ay' :
                             customStartDate && customEndDate ? 'Seçili aralık' : 'Tarih seçiniz'} ortalaması
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="text-xs font-semibold text-red-400">
                          ↘ 2%
                        </div>
                        <div className="text-[10px] text-gray-500">geçen aya göre</div>
                      </div>
                    </div>
                    <div className="text-5xl font-bold text-green-400 mb-2">
                      <AnimatedNumber 
                        value={
                          availabilityPeriod === 'daily' ? selectedATM.atmAvailabilityDaily :
                          availabilityPeriod === '1month' ? selectedATM.atmAvailability1Month :
                          availabilityPeriod === '3months' ? selectedATM.atmAvailability3Months :
                          availabilityPeriod === '6months' ? selectedATM.atmAvailability6Months :
                          selectedATM.atmAvailability1Month // custom için 1 aylık göster (gerçekte API'den gelecek)
                        } 
                        decimals={1} 
                        suffix="%" 
                      />
                    </div>
                    <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-1000"
                        style={{ 
                          width: `${
                            availabilityPeriod === 'daily' ? selectedATM.atmAvailabilityDaily :
                            availabilityPeriod === '1month' ? selectedATM.atmAvailability1Month :
                            availabilityPeriod === '3months' ? selectedATM.atmAvailability3Months :
                            availabilityPeriod === '6months' ? selectedATM.atmAvailability6Months :
                            selectedATM.atmAvailability1Month
                          }%` 
                        }}
                      />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border border-blue-500/50 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="text-4xl">📍</div>
                        <div>
                          <div className="text-base font-semibold text-gray-300">Lokasyon Availability</div>
                          <div className="text-xs text-gray-400">
                            {availabilityPeriod === 'daily' ? 'Bugün' : 
                             availabilityPeriod === '1month' ? 'Son 1 ay' : 
                             availabilityPeriod === '3months' ? 'Son 3 ay' : 
                             availabilityPeriod === '6months' ? 'Son 6 ay' :
                             customStartDate && customEndDate ? 'Seçili aralık' : 'Tarih seçiniz'} ortalaması
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="text-xs font-semibold text-green-400">
                          ↗ 1%
                        </div>
                        <div className="text-[10px] text-gray-500">geçen aya göre</div>
                      </div>
                    </div>
                    <div className="text-5xl font-bold text-blue-400 mb-2">
                      <AnimatedNumber 
                        value={
                          availabilityPeriod === 'daily' ? selectedATM.locationAvailabilityDaily :
                          availabilityPeriod === '1month' ? selectedATM.locationAvailability1Month :
                          availabilityPeriod === '3months' ? selectedATM.locationAvailability3Months :
                          availabilityPeriod === '6months' ? selectedATM.locationAvailability6Months :
                          selectedATM.locationAvailability1Month
                        } 
                        decimals={1} 
                        suffix="%" 
                      />
                    </div>
                    <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-1000"
                        style={{ 
                          width: `${
                            availabilityPeriod === 'daily' ? selectedATM.locationAvailabilityDaily :
                            availabilityPeriod === '1month' ? selectedATM.locationAvailability1Month :
                            availabilityPeriod === '3months' ? selectedATM.locationAvailability3Months :
                            availabilityPeriod === '6months' ? selectedATM.locationAvailability6Months :
                            selectedATM.locationAvailability1Month
                          }%` 
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Availability Grafik */}
                <div className="bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/50 rounded-xl p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    📈 Availability Karşılaştırma
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Para Çekme Availability */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <span className="text-sm font-semibold text-gray-300">Para Çekme Availability</span>
                        </div>
                        <span className="text-lg font-bold text-green-400">
                          {selectedATM.withdrawalAvailability.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-8 bg-gray-700/50 rounded-lg overflow-hidden relative">
                        <div 
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-1000 flex items-center justify-end pr-3"
                          style={{ width: `${selectedATM.withdrawalAvailability}%` }}
                        >
                          <span className="text-xs font-bold text-white drop-shadow-lg">
                            {selectedATM.withdrawalAvailability.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Para Yatırma Availability */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                          <span className="text-sm font-semibold text-gray-300">Para Yatırma Availability</span>
                        </div>
                        <span className="text-lg font-bold text-blue-400">
                          {selectedATM.depositAvailability.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-8 bg-gray-700/50 rounded-lg overflow-hidden relative">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-1000 flex items-center justify-end pr-3"
                          style={{ width: `${selectedATM.depositAvailability}%` }}
                        >
                          <span className="text-xs font-bold text-white drop-shadow-lg">
                            {selectedATM.depositAvailability.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Genel Availability */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                          <span className="text-sm font-semibold text-gray-300">Genel Availability</span>
                        </div>
                        <span className="text-lg font-bold text-purple-400">
                          {(
                            availabilityPeriod === 'daily' ? selectedATM.atmAvailabilityDaily :
                            availabilityPeriod === '1month' ? selectedATM.atmAvailability1Month :
                            availabilityPeriod === '3months' ? selectedATM.atmAvailability3Months :
                            availabilityPeriod === '6months' ? selectedATM.atmAvailability6Months :
                            selectedATM.atmAvailability1Month
                          ).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-8 bg-gray-700/50 rounded-lg overflow-hidden relative">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-400 transition-all duration-1000 flex items-center justify-end pr-3"
                          style={{ 
                            width: `${
                              availabilityPeriod === 'daily' ? selectedATM.atmAvailabilityDaily :
                              availabilityPeriod === '1month' ? selectedATM.atmAvailability1Month :
                              availabilityPeriod === '3months' ? selectedATM.atmAvailability3Months :
                              availabilityPeriod === '6months' ? selectedATM.atmAvailability6Months :
                              selectedATM.atmAvailability1Month
                            }%` 
                          }}
                        >
                          <span className="text-xs font-bold text-white drop-shadow-lg">
                            {(
                              availabilityPeriod === 'daily' ? selectedATM.atmAvailabilityDaily :
                              availabilityPeriod === '1month' ? selectedATM.atmAvailability1Month :
                              availabilityPeriod === '3months' ? selectedATM.atmAvailability3Months :
                              availabilityPeriod === '6months' ? selectedATM.atmAvailability6Months :
                              selectedATM.atmAvailability1Month
                            ).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Özet Bilgi */}
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-400 mb-1">En Yüksek</div>
                      <div className="text-xl font-bold text-green-400">
                        {Math.max(
                          selectedATM.withdrawalAvailability,
                          selectedATM.depositAvailability,
                          availabilityPeriod === 'daily' ? selectedATM.atmAvailabilityDaily :
                          availabilityPeriod === '1month' ? selectedATM.atmAvailability1Month :
                          availabilityPeriod === '3months' ? selectedATM.atmAvailability3Months :
                          availabilityPeriod === '6months' ? selectedATM.atmAvailability6Months :
                          selectedATM.atmAvailability1Month
                        ).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Para Çekme</div>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-400 mb-1">Ortalama</div>
                      <div className="text-xl font-bold text-blue-400">
                        {(
                          (selectedATM.withdrawalAvailability + 
                           selectedATM.depositAvailability + 
                           (availabilityPeriod === 'daily' ? selectedATM.atmAvailabilityDaily :
                            availabilityPeriod === '1month' ? selectedATM.atmAvailability1Month :
                            availabilityPeriod === '3months' ? selectedATM.atmAvailability3Months :
                            availabilityPeriod === '6months' ? selectedATM.atmAvailability6Months :
                            selectedATM.atmAvailability1Month)) / 3
                        ).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Tüm İşlemler</div>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-400 mb-1">En Düşük</div>
                      <div className="text-xl font-bold text-red-400">
                        {Math.min(
                          selectedATM.withdrawalAvailability,
                          selectedATM.depositAvailability,
                          availabilityPeriod === 'daily' ? selectedATM.atmAvailabilityDaily :
                          availabilityPeriod === '1month' ? selectedATM.atmAvailability1Month :
                          availabilityPeriod === '3months' ? selectedATM.atmAvailability3Months :
                          availabilityPeriod === '6months' ? selectedATM.atmAvailability6Months :
                          selectedATM.atmAvailability1Month
                        ).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Para Yatırma</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* İşlem Kaybı Metrikleri */}
          <div className="bg-[#112544] border border-blue-500/30 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('failures')}
              className="w-full p-4 flex items-center justify-between hover:bg-blue-500/10 transition"
            >
              <h2 className="text-xl font-bold flex items-center gap-2">
                ⚠️ Başarısız İşlem Adetleri <span className="text-sm font-normal text-gray-400">(Günlük)</span>
              </h2>
              <span className="text-2xl">{expandedSections.failures ? '▼' : '▶'}</span>
            </button>
            {expandedSections.failures && (
              <div className="p-6 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard
                  title="Para Yatırma Arızası"
                  value={selectedATM.depositFailureCount}
                  icon="💵"
                  color="red"
                  subtitle="Kaçan işlem adedi"
                  trend={-15}
                  trendLabel="önceki güne göre"
                />
                <MetricCard
                  title="Para Çekme Arızası"
                  value={selectedATM.withdrawalFailureCount}
                  icon="💸"
                  color="red"
                  subtitle="Arıza nedeniyle kaçan"
                  trend={-8}
                  trendLabel="önceki güne göre"
                />
                <MetricCard
                  title="İkmal Eksikliği"
                  value={selectedATM.withdrawalNoReplenishCount}
                  icon="📉"
                  color="orange"
                  subtitle="İkmal yapılmadığı için kaçan"
                  trend={-22}
                  trendLabel="önceki güne göre"
                />
              </div>
            )}
          </div>

          {/* Online Bakiye Gözlem */}
          <div className="bg-[#112544] border border-blue-500/30 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('onlineBalance')}
              className="w-full p-4 flex items-center justify-between hover:bg-blue-500/10 transition"
            >
              <h2 className="text-xl font-bold flex items-center gap-2">
                🔴 Online Bakiye Gözlem
                <span className="text-xs bg-red-500/20 border border-red-500/50 px-2 py-0.5 rounded-full text-red-400 animate-pulse">LIVE</span>
              </h2>
              <span className="text-2xl">{expandedSections.onlineBalance ? '▼' : '▶'}</span>
            </button>
            {expandedSections.onlineBalance && (
              <div className="p-6 pt-0 space-y-4">
                {/* Toplam Bakiye */}
                <div className="bg-gradient-to-br from-emerald-500/20 to-green-600/20 border border-emerald-500/50 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-sm text-gray-300 mb-2 font-medium flex items-center gap-2">
                        💳 Anlık Toplam Bakiye
                        <span className="text-xs text-gray-400">
                          (Son güncelleme: {new Date(selectedATM.lastBalanceUpdate).toLocaleTimeString('tr-TR')})
                        </span>
                      </div>
                      <div className="text-5xl font-bold text-emerald-400">
                        ₺<AnimatedNumber value={selectedATM.currentCashBalance} decimals={0} />
                      </div>
                    </div>
                    <div className="text-7xl">💰</div>
                  </div>
                  <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-1000"
                      style={{ width: `${Math.min((selectedATM.currentCashBalance / 400000) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Kaset Detayları */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Kaset 1 - 200₺ */}
                  <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-300 font-medium">Kaset 1 - 200₺</div>
                      <div className="text-xs bg-blue-500/20 px-2 py-0.5 rounded text-blue-400">Para Çekme</div>
                    </div>
                    <div className="text-3xl font-bold text-blue-400">
                      ₺<AnimatedNumber value={selectedATM.cassette1} decimals={0} />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {Math.floor(selectedATM.cassette1 / 200)} adet banknot
                    </div>
                    <div className="mt-2 h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-1000"
                        style={{ width: `${Math.min((selectedATM.cassette1 / 230000) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Kaset 2 - 200₺ */}
                  <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-300 font-medium">Kaset 2 - 200₺</div>
                      <div className="text-xs bg-blue-500/20 px-2 py-0.5 rounded text-blue-400">Para Çekme</div>
                    </div>
                    <div className="text-3xl font-bold text-blue-400">
                      ₺<AnimatedNumber value={selectedATM.cassette2} decimals={0} />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {Math.floor(selectedATM.cassette2 / 200)} adet banknot
                    </div>
                    <div className="mt-2 h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-1000"
                        style={{ width: `${Math.min((selectedATM.cassette2 / 230000) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Kaset 3 - 100₺ */}
                  <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-300 font-medium">Kaset 3 - 100₺</div>
                      <div className="text-xs bg-purple-500/20 px-2 py-0.5 rounded text-purple-400">Para Çekme</div>
                    </div>
                    <div className="text-3xl font-bold text-purple-400">
                      ₺<AnimatedNumber value={selectedATM.cassette3} decimals={0} />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {Math.floor(selectedATM.cassette3 / 100)} adet banknot
                    </div>
                    <div className="mt-2 h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-400 transition-all duration-1000"
                        style={{ width: `${Math.min((selectedATM.cassette3 / 230000) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Kaset 4 - 100₺ */}
                  <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-300 font-medium">Kaset 4 - 100₺</div>
                      <div className="text-xs bg-purple-500/20 px-2 py-0.5 rounded text-purple-400">Para Çekme</div>
                    </div>
                    <div className="text-3xl font-bold text-purple-400">
                      ₺<AnimatedNumber value={selectedATM.cassette4} decimals={0} />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {Math.floor(selectedATM.cassette4 / 100)} adet banknot
                    </div>
                    <div className="mt-2 h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-400 transition-all duration-1000"
                        style={{ width: `${Math.min((selectedATM.cassette4 / 230000) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Para Yatırma Kaseti */}
                <div className="mt-4">
                  {(() => {
                    // 2000 banknot kapasitesi - Karışık (200₺ + 100₺ + 50₺)
                    const maxBanknoteCapacity = 2000;
                    const totalBanknotes = selectedATM.deposit200 + selectedATM.deposit100 + selectedATM.deposit50;
                    const fillPercentage = Math.min((totalBanknotes / maxBanknoteCapacity) * 100, 100);
                    
                    // Renk geçişi: 0-50% yeşil, 50-75% sarı/turuncu, 75-100% kırmızı
                    let bgGradient = 'from-emerald-500/20 to-green-600/20';
                    let borderColor = 'border-emerald-500/50';
                    let badgeBg = 'bg-emerald-500/30';
                    let badgeText = 'text-emerald-300';
                    let textColor = 'text-emerald-400';
                    let progressGradient = 'from-emerald-500 to-green-400';
                    let statusIcon = '✅';
                    let statusText = 'Normal';
                    let statusColor = 'text-emerald-400';
                    
                    if (fillPercentage >= 85) {
                      // Kritik: Kırmızı (85-100%)
                      bgGradient = 'from-red-500/30 to-rose-600/30';
                      borderColor = 'border-red-500/70';
                      badgeBg = 'bg-red-500/40';
                      badgeText = 'text-red-200';
                      textColor = 'text-red-400';
                      progressGradient = 'from-red-600 to-rose-500';
                      statusIcon = '🔴';
                      statusText = 'KRİTİK - Boşaltma Gerekli!';
                      statusColor = 'text-red-400';
                    } else if (fillPercentage >= 70) {
                      // Uyarı: Turuncu (70-85%)
                      bgGradient = 'from-orange-500/25 to-amber-600/25';
                      borderColor = 'border-orange-500/60';
                      badgeBg = 'bg-orange-500/35';
                      badgeText = 'text-orange-200';
                      textColor = 'text-orange-400';
                      progressGradient = 'from-orange-500 to-amber-400';
                      statusIcon = '⚠️';
                      statusText = 'Dolmaya Yakın';
                      statusColor = 'text-orange-400';
                    } else if (fillPercentage >= 50) {
                      // Dikkat: Sarı (50-70%)
                      bgGradient = 'from-yellow-500/20 to-amber-600/20';
                      borderColor = 'border-yellow-500/50';
                      badgeBg = 'bg-yellow-500/30';
                      badgeText = 'text-yellow-200';
                      textColor = 'text-yellow-400';
                      progressGradient = 'from-yellow-500 to-amber-400';
                      statusIcon = '⚡';
                      statusText = 'Orta Seviye';
                      statusColor = 'text-yellow-400';
                    }
                    
                    return (
                      <div className={`bg-gradient-to-br ${bgGradient} border ${borderColor} rounded-xl p-5 transition-all duration-500`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="text-base text-gray-200 font-semibold">Para Yatırma Kaseti</div>
                            <div className={`text-xs ${badgeBg} px-2 py-1 rounded ${badgeText} font-medium`}>💰 Depository</div>
                          </div>
                          <div className={`text-xs font-bold ${statusColor} flex items-center gap-1`}>
                            <span>{statusIcon}</span>
                            <span>{statusText}</span>
                          </div>
                        </div>
                        
                        {/* Toplam Tutar */}
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className={`text-4xl font-bold ${textColor}`}>
                              ₺<AnimatedNumber value={selectedATM.depositCassette} decimals={0} />
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              Toplam yatırılan tutar • {totalBanknotes} adet banknot
                            </div>
                          </div>
                          <div className="text-6xl opacity-50">💵</div>
                        </div>

                        {/* Banknot Dağılımı */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                          {/* 200₺ */}
                          <div className="bg-blue-500/20 border border-blue-500/40 rounded-lg p-3">
                            <div className="text-xs text-blue-300 mb-1 font-medium">200₺</div>
                            <div className="text-2xl font-bold text-blue-400">{selectedATM.deposit200}</div>
                            <div className="text-xs text-gray-500 mt-1">adet</div>
                            <div className="text-xs text-blue-300 mt-1 font-semibold">
                              ₺{(selectedATM.deposit200 * 200).toLocaleString('tr-TR')}
                            </div>
                          </div>

                          {/* 100₺ */}
                          <div className="bg-purple-500/20 border border-purple-500/40 rounded-lg p-3">
                            <div className="text-xs text-purple-300 mb-1 font-medium">100₺</div>
                            <div className="text-2xl font-bold text-purple-400">{selectedATM.deposit100}</div>
                            <div className="text-xs text-gray-500 mt-1">adet</div>
                            <div className="text-xs text-purple-300 mt-1 font-semibold">
                              ₺{(selectedATM.deposit100 * 100).toLocaleString('tr-TR')}
                            </div>
                          </div>

                          {/* 50₺ */}
                          <div className="bg-amber-500/20 border border-amber-500/40 rounded-lg p-3">
                            <div className="text-xs text-amber-300 mb-1 font-medium">50₺</div>
                            <div className="text-2xl font-bold text-amber-400">{selectedATM.deposit50}</div>
                            <div className="text-xs text-gray-500 mt-1">adet</div>
                            <div className="text-xs text-amber-300 mt-1 font-semibold">
                              ₺{(selectedATM.deposit50 * 50).toLocaleString('tr-TR')}
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-4 h-3 bg-gray-700/50 rounded-full overflow-hidden shadow-inner">
                          <div 
                            className={`h-full bg-gradient-to-r ${progressGradient} transition-all duration-1000 shadow-lg`}
                            style={{ width: `${fillPercentage}%` }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                          <span>0 banknot</span>
                          <span className={`font-bold ${statusColor}`}>{Math.floor(fillPercentage)}% • {totalBanknotes}/2000</span>
                          <span>2000 banknot</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Özet Bilgi */}
                <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Toplam Bakiye</div>
                      <div className="text-2xl font-bold text-cyan-400">
                        ₺{(selectedATM.cassette1 + selectedATM.cassette2 + 
                          selectedATM.cassette3 + selectedATM.cassette4 + 
                          selectedATM.depositCassette).toLocaleString('tr-TR')}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Çekme + Yatırma</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Kapasite Kullanımı</div>
                      <div className="text-2xl font-bold text-cyan-400">
                        {Math.round((selectedATM.currentCashBalance / 400000) * 100)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">İkmal Durumu</div>
                      <div className="text-lg font-bold">
                        {selectedATM.currentCashBalance < 150000 ? (
                          <span className="text-red-400">🔴 Kritik</span>
                        ) : selectedATM.currentCashBalance < 250000 ? (
                          <span className="text-yellow-400">⚠️ Düşük</span>
                        ) : (
                          <span className="text-green-400">✅ İyi</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Kasa ve Bakiye */}
          <div className="bg-[#112544] border border-blue-500/30 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('cash')}
              className="w-full p-4 flex items-center justify-between hover:bg-blue-500/10 transition"
            >
              <h2 className="text-xl font-bold flex items-center gap-2">
                💰 Ortalama Kasa Bakiyesi
              </h2>
              <span className="text-2xl">{expandedSections.cash ? '▼' : '▶'}</span>
            </button>
            {expandedSections.cash && (
              <div className="p-6 pt-0">
                <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/50 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-300 mb-2 font-medium">Ortalama Kasa Bakiyesi</div>
                      <div className="text-4xl font-bold text-green-400">
                        ₺<AnimatedNumber value={selectedATM.avgCashBalance} decimals={0} />
                      </div>
                      <div className="text-xs text-gray-400 mt-2">Son 30 gün ortalaması</div>
                    </div>
                    <div className="text-6xl">💵</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Arıza ve Müdahale Metrikleri */}
          <div className="bg-[#112544] border border-blue-500/30 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('faults')}
              className="w-full p-4 flex items-center justify-between hover:bg-blue-500/10 transition"
            >
              <h2 className="text-xl font-bold flex items-center gap-2">
                🔧 Arıza ve Müdahale Durumları
              </h2>
              <span className="text-2xl">{expandedSections.faults ? '▼' : '▶'}</span>
            </button>
            {expandedSections.faults && (
              <div className="p-6 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard
                  title="Toplam Arıza Adedi"
                  value={selectedATM.faultCount}
                  icon="⚡"
                  color="yellow"
                  subtitle="Son 30 gün"
                  trend={-12}
                />
                <MetricCard
                  title="Personel Müdahale Süresi"
                  value={selectedATM.atmResponseTime}
                  icon="⏱️"
                  color="blue"
                  decimals={0}
                  suffix=" dk"
                  subtitle="Hedef: 30 dk içinde müdahale"
                />
                <MetricCard
                  title="SLM Teknisyen Süresi"
                  value={selectedATM.slmResponseTime}
                  icon="👨‍🔧"
                  color="purple"
                  decimals={0}
                  suffix=" dk"
                  subtitle="Teknisyen müdahale süresi"
                />
              </div>
            )}
          </div>

          {/* Özet Kart */}
          <div className="bg-[#112544] border border-blue-500/30 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('summary')}
              className="w-full p-4 flex items-center justify-between hover:bg-blue-500/10 transition"
            >
              <h2 className="text-xl font-bold flex items-center gap-2">
                📋 Performans Özeti/Analizi <span className="text-sm font-normal text-gray-400">(Aylık)</span>
              </h2>
              <span className="text-2xl">{expandedSections.summary ? '▼' : '▶'}</span>
            </button>
            {expandedSections.summary && (
              <div className="p-6 pt-0 space-y-4">
                {/* Genel Durum Özeti */}
                <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    📊 Genel Performans Durumu
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="relative">
                      <div className="text-sm text-gray-400 mb-2">Toplam Başarısız İşlem</div>
                      <div className="flex items-end gap-3">
                        <div className="text-3xl font-bold text-red-400">
                          {selectedATM.depositFailureCount + selectedATM.withdrawalFailureCount + selectedATM.withdrawalNoReplenishCount} adet
                        </div>
                        <div className="flex flex-col items-end mb-1">
                          <div className="text-xs font-semibold text-green-400">
                            ↘ 18%
                          </div>
                          <div className="text-[10px] text-gray-500">geçen aya göre</div>
                        </div>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="text-sm text-gray-400 mb-2">Ortalama Müdahale Süresi</div>
                      <div className="flex items-end gap-3">
                        <div className="text-3xl font-bold text-blue-400">
                          {Math.round((selectedATM.atmResponseTime + selectedATM.slmResponseTime) / 2)} dakika
                        </div>
                        <div className="flex flex-col items-end mb-1">
                          <div className="text-xs font-semibold text-red-400">
                            ↗ 8%
                          </div>
                          <div className="text-[10px] text-gray-500">geçen aya göre</div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-2">Availability Durumu</div>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full ${
                          selectedATM.atmAvailability > 95 ? 'bg-green-500' : 
                          selectedATM.atmAvailability > 90 ? 'bg-yellow-500' : 
                          'bg-red-500'
                        } animate-pulse`}></div>
                        <span className="text-xl font-semibold">
                          {selectedATM.atmAvailability > 95 ? '✅ Mükemmel (%' + selectedATM.atmAvailability.toFixed(2) + ')' : 
                           selectedATM.atmAvailability > 90 ? '⚠️ İyi (%' + selectedATM.atmAvailability.toFixed(2) + ')' : 
                           '🔴 Kritik (%' + selectedATM.atmAvailability.toFixed(2) + ')'}
                        </span>
                        <div className="flex flex-col items-end ml-auto">
                          <div className="text-xs font-semibold text-red-400">
                            ↘ 3%
                          </div>
                          <div className="text-[10px] text-gray-500">geçen aya göre</div>
                        </div>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="text-sm text-gray-400 mb-2">Arıza Sıklığı</div>
                      <div className="flex items-center gap-3">
                        <div className="text-xl font-semibold">
                          {selectedATM.faultCount > 10 ? '🔴 Yüksek (' + selectedATM.faultCount + ')' : 
                           selectedATM.faultCount > 5 ? '⚠️ Orta (' + selectedATM.faultCount + ')' : 
                           '✅ Düşük (' + selectedATM.faultCount + ')'}
                        </div>
                        <div className="flex flex-col items-end ml-auto">
                          <div className="text-xs font-semibold text-green-400">
                            ↘ 12%
                          </div>
                          <div className="text-[10px] text-gray-500">geçen aya göre</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Kök Neden Analizi */}
                <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 border border-red-500/50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    🔍 Kök Neden Analizi ve Sorun Tespiti
                  </h3>
                  <div className="space-y-3">
                    {(() => {
                      const issues = [];
                      const isBranch = selectedATM.locationType === "Şube";
                      
                      // %95 üstü availability - sorunsuz devam ediyor
                      if (selectedATM.atmAvailability >= 95) {
                        return (
                          <div className="border border-green-500/50 bg-green-500/10 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <div className="text-3xl">✅</div>
                              <div className="flex-1">
                                <div className="font-semibold text-white mb-1">Performans Mükemmel Seviyede</div>
                                <div className="text-sm text-gray-300 mb-2">
                                  ATM %{selectedATM.atmAvailability.toFixed(2)} availability ile hedefin üzerinde çalışıyor.
                                </div>
                                <div className="text-sm bg-green-500/10 border border-green-500/30 rounded p-3">
                                  <div className="font-semibold text-green-400 mb-1.5">✨ Durum:</div>
                                  <div className="text-gray-300">
                                    Sorunsuz devam etmektedir. Mevcut bakım ve operasyon prosedürleri etkin çalışıyor.
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      // %85 altı ve Şube ATM - detaylı analiz
                      if (selectedATM.atmAvailability < 85 && isBranch) {
                        // Availability düşük mü?
                        if (selectedATM.atmAvailability < 92) {
                        let reasonTexts = [];
                        if (selectedATM.faultCount > 8) {
                          reasonTexts = [`Yüksek arıza sıklığı (${selectedATM.faultCount} adet) availability'yi düşürüyor.`];
                        } else if (selectedATM.withdrawalNoReplenishCount > 25) {
                          reasonTexts = [`İkmal eksikliği nedeniyle para çekme işlemleri yapılamıyor (${selectedATM.withdrawalNoReplenishCount} kayıp).`];
                        } else {
                          reasonTexts = ['Arızalara geç müdahale edilmesi servis dışı kalma süresini artırıyor.'];
                        }
                        
                        issues.push({
                          icon: '📉',
                          title: 'Düşük Availability Tespit Edildi',
                          description: `ATM'nin availability oranı %${selectedATM.atmAvailability.toFixed(2)} seviyesinde. Hedef %95'in altında.`,
                          reasons: reasonTexts,
                          color: 'border-red-500/50 bg-red-500/10'
                        });
                      }
                      
                      // Müdahale süreleri uzun mu?
                      if (selectedATM.atmResponseTime > 45 || selectedATM.slmResponseTime > 100) {
                        const isPersonnelDelay = selectedATM.atmResponseTime > 45;
                        const isBranch = selectedATM.locationType === "Şube";
                        
                        let reasonTexts = [];
                        if (isPersonnelDelay && isBranch) {
                          reasonTexts = [
                            'Şube personeli ATM arızasına zamanında müdahale edemiyor.',
                            'Şube içi iş yoğunluğu ATM\'nin önceliklendirilmesini engelliyor.',
                            'Şube personeline ATM müdahale prosedürleri ve önceliklendirme eğitimi verilmeli.',
                            'Şube yönetimi ile ATM operasyonel performans hedefleri revize edilmeli.'
                          ];
                        } else if (isPersonnelDelay && !isBranch) {
                          reasonTexts = [
                            'Offsite lokasyonda teknik destek kapasitesi yetersiz.',
                            'Bölgesel müdahale ekibinin lokasyona ulaşım süresi uzun.',
                            'Rota optimizasyonu ve personel dağılımı gözden geçirilmeli.'
                          ];
                        } else {
                          // SLM Teknisyen gecikmesi - daha detaylı analiz
                          const hoursDelay = Math.floor(selectedATM.slmResponseTime / 60);
                          const daysDelay = Math.floor(hoursDelay / 24);
                          
                          reasonTexts = [
                            `SLM teknisyen müdahale süresi ${selectedATM.slmResponseTime} dakika (${hoursDelay} saat) olarak ölçülmüş. Hedef 90 dakika.`,
                            daysDelay >= 1 
                              ? `Arıza kaydı açıldıktan sonra teknisyen müdahalesi ${daysDelay} gün gecikmiş. Hafta sonu veya tatil günlerine denk gelmiş olabilir.`
                              : 'Arıza kaydı ile teknisyen müdahalesi arasında gecikme yaşanıyor.',
                            'Servis sağlayıcı ile SLA (Service Level Agreement) gözden geçirilmeli.',
                            'Teknisyen müsaitliği ve yedek parça temini süreçleri iyileştirilmeli.'
                          ];
                        }
                        
                        issues.push({
                          icon: '⏱️',
                          title: 'Müdahale Süreleri Hedefin Üzerinde',
                          description: selectedATM.atmResponseTime > 45 
                            ? `Personel müdahale süresi ${selectedATM.atmResponseTime} dakika (hedef: 30 dk)`
                            : `SLM teknisyen müdahale süresi ${selectedATM.slmResponseTime} dakika (hedef: 90 dk)`,
                          reasons: reasonTexts,
                          color: 'border-orange-500/50 bg-orange-500/10'
                        });
                      }
                      
                      // Çok fazla arıza var mı?
                      if (selectedATM.faultCount > 8) {
                        let reasonTexts = [];
                        if (selectedATM.atmAge > '36') {
                          reasonTexts = ['ATM yaşı (' + selectedATM.atmAge + ' ay) nedeniyle donanım yıpranması artıyor. Cihaz yenileme veya kapsamlı bakım gerekli.'];
                        } else {
                          reasonTexts = ['Kullanım yoğunluğu veya çevresel faktörler (toz, nem) arızaları tetikliyor. Önleyici bakım periyodu kısaltılmalı.'];
                        }
                        
                        issues.push({
                          icon: '⚡',
                          title: 'Yüksek Arıza Sıklığı',
                          description: `Son dönemde ${selectedATM.faultCount} adet arıza kaydedildi. Normal aralığın üzerinde.`,
                          reasons: reasonTexts,
                          color: 'border-yellow-500/50 bg-yellow-500/10'
                        });
                      }
                      
                      // İkmal sorunları var mı?
                      if (selectedATM.withdrawalNoReplenishCount > 25) {
                        issues.push({
                          icon: '💰',
                          title: 'İkmal Eksikliği Sorunu',
                          description: `${selectedATM.withdrawalNoReplenishCount} adet para çekme işlemi ikmal yapılmadığı için gerçekleşemedi.`,
                          reasons: ['İkmal rotası optimizasyonu yetersiz veya nakit planlama hatalı. CIT (Cash In Transit) frekansı artırılmalı ve talep tahmini iyileştirilmeli.'],
                          color: 'border-purple-500/50 bg-purple-500/10'
                        });
                      }
                      
                      // Para yatırma arızaları
                      if (selectedATM.depositFailureCount > 12) {
                        issues.push({
                          icon: '📥',
                          title: 'Para Yatırma Arızaları',
                          description: `${selectedATM.depositFailureCount} adet para yatırma işlemi arıza nedeniyle başarısız.`,
                          reasons: ['Banknot okuma sensörleri veya depository kaseti temizlik gerektirebilir. Periyodik temizlik ve kalibrasyon yapılmalı.'],
                          color: 'border-cyan-500/50 bg-cyan-500/10'
                        });
                      }
                      
                      // Hiç sorun yoksa veya şube değilse
                      if (issues.length === 0) {
                        return (
                          <div className="border border-yellow-500/50 bg-yellow-500/10 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <div className="text-3xl">⚠️</div>
                              <div className="flex-1">
                                <div className="font-semibold text-white mb-1">Performans İyileştirme Gerekli</div>
                                <div className="text-sm text-gray-300 mb-2">
                                  ATM %{selectedATM.atmAvailability.toFixed(2)} availability ile hedefin altında çalışıyor.
                                </div>
                                <div className="text-sm bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                                  <div className="font-semibold text-yellow-400 mb-1.5">💡 Öneri:</div>
                                  <div className="text-gray-300">
                                    {isBranch 
                                      ? 'Şube ATM\'si için detaylı performans analizi yapılmalı ve iyileştirme aksiyonları planlanmalı.'
                                      : 'Offsite ATM için teknik destek kapasitesi ve müdahale süreleri gözden geçirilmeli.'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      return issues.map((issue, idx) => (
                        <div key={idx} className={`border ${issue.color} rounded-lg p-4`}>
                          <div className="flex items-start gap-3">
                            <div className="text-3xl">{issue.icon}</div>
                            <div className="flex-1">
                              <div className="font-semibold text-white mb-1">{issue.title}</div>
                              <div className="text-sm text-gray-300 mb-2">{issue.description}</div>
                              <div className="text-sm bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                                <div className="font-semibold text-yellow-400 mb-1.5">💡 Analiz Sonuçları:</div>
                                <div className="text-gray-300 space-y-1.5">
                                  {issue.reasons.map((reason, ridx) => (
                                    <div key={ridx} className="flex gap-2">
                                      <span className="font-semibold">{ridx + 1}.</span>
                                      <span>{reason}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ));
                    } else {
                      // %85-95 arası veya offsite ATM - basit bilgilendirme
                      return (
                        <div className="border border-blue-500/50 bg-blue-500/10 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className="text-3xl">ℹ️</div>
                            <div className="flex-1">
                              <div className="font-semibold text-white mb-1">Performans Takip Ediliyor</div>
                              <div className="text-sm text-gray-300 mb-2">
                                ATM %{selectedATM.atmAvailability.toFixed(2)} availability ile çalışıyor.
                              </div>
                              <div className="text-sm bg-blue-500/10 border border-blue-500/30 rounded p-3">
                                <div className="font-semibold text-blue-400 mb-1.5">📊 Durum:</div>
                                <div className="text-gray-300">
                                  {selectedATM.atmAvailability >= 85 && selectedATM.atmAvailability < 95
                                    ? 'Performans kabul edilebilir seviyede. Rutin bakım ve izleme devam ediyor.'
                                    : 'Detaylı performans analizi için şube ATM kategorisinde %85 altı eşiği takip ediliyor.'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    })()}
                  </div>
                </div>

                {/* Aksiyon Önerileri */}
                <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    🎯 Önerilen Aksiyonlar
                  </h3>
                  <div className="space-y-2">
                    {selectedATM.atmAvailability < 92 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-400">✓</span>
                        <span>Öncelikli olarak arıza kaynaklarını azaltıcı önleyici bakım planlanmalı</span>
                      </div>
                    )}
                    {selectedATM.faultCount > 8 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-400">✓</span>
                        <span>Tekrarlayan arıza tiplerinin detaylı root-cause analizi yapılmalı</span>
                      </div>
                    )}
                    {(selectedATM.atmResponseTime > 45 || selectedATM.slmResponseTime > 100) && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-400">✓</span>
                        <span>
                          {selectedATM.locationType === "Şube" 
                            ? selectedATM.atmResponseTime > 45
                              ? "Şube personeline ATM müdahale prosedürleri konusunda acil eğitim verilmeli ve performans hedefleri güncellenmeli"
                              : "SLM servis sağlayıcı ile SLA gözden geçirilmeli ve teknisyen müdahale süreleri iyileştirilmeli"
                            : "Bölgesel müdahale ekibi kapasitesi gözden geçirilmeli veya lokasyon rotası optimize edilmeli"
                          }
                        </span>
                      </div>
                    )}
                    {selectedATM.withdrawalNoReplenishCount > 25 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-400">✓</span>
                        <span>İkmal frekansı artırılmalı ve talep bazlı dinamik planlama uygulanmalı</span>
                      </div>
                    )}
                    {selectedATM.atmAvailability >= 95 && selectedATM.faultCount <= 5 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-400">✓</span>
                        <span>Mevcut operasyon kalitesi korunmalı, best practice olarak paylaşılmalı</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Harita Modal */}
      {showMapModal && mapCenterATM && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-6xl ring-2 ring-blue-500/50 flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between p-4 border-b border-[#2B416B] bg-[#0E2142]/60 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="text-lg font-semibold">🗺️ {mapCenterATM.atmName} - Yakın ATM'ler</div>
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-500/20 text-blue-400">
                  📍 Harita Görünümü
                </span>
              </div>
              <button onClick={() => setShowMapModal(false)} className="text-[#A7B8D8] hover:text-white text-2xl">&times;</button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="bg-[#0E2142] rounded-xl p-4 ring-1 ring-blue-500/50 h-full">
                <div className="h-[500px] w-full rounded-xl overflow-hidden ring-1 ring-[#2B416B] mb-4">
                  <RouteMapComponent 
                    key={mapCenterATM.atmId}
                    route={{
                      cash_center: "Merkez ATM",
                      atms: [
                        {
                          atm_id: mapCenterATM.atmId,
                          atm_name: mapCenterATM.atmName,
                          city: mapCenterATM.city,
                          district: mapCenterATM.district,
                          operation: "merkez",
                          amount: `${mapCenterATM.atmAvailability.toFixed(1)}%`,
                          cash_level: mapCenterATM.atmAvailability,
                          latitude: getCoords(mapCenterATM.atmId).lat,
                          longitude: getCoords(mapCenterATM.atmId).lon
                        },
                        ...getNearbyATMs(mapCenterATM).map((nearby, idx) => ({
                          atm_id: nearby.atmId,
                          atm_name: nearby.atmName,
                          city: nearby.city,
                          district: nearby.district,
                          operation: "normal",
                          amount: `${nearby.distance.toFixed(1)} km`,
                          cash_level: nearby.atmAvailability,
                          latitude: nearby.lat,
                          longitude: nearby.lon
                        }))
                      ]
                    }} 
                  />
                </div>

                {/* Nearby ATMs List */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[#A7B8D8] mb-2">🎯 En Yakın ATM'ler:</div>
                  {getNearbyATMs(mapCenterATM).map((nearby, idx) => (
                    <div 
                      key={nearby.atmId} 
                      className="bg-[#112544] rounded-lg p-3 flex items-center gap-3 hover:bg-[#1a3255] transition cursor-pointer"
                      onClick={() => {
                        setSelectedATM(nearby);
                        setShowMapModal(false);
                      }}
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-400 flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{nearby.atmName}</div>
                        <div className="text-xs text-[#A7B8D8]">{nearby.city} / {nearby.district}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-base font-bold text-cyan-400">{nearby.distance.toFixed(1)} km</div>
                        <div className={`text-xs ${
                          nearby.atmAvailability > 95 ? 'text-green-400' : 
                          nearby.atmAvailability > 90 ? 'text-yellow-400' : 
                          'text-red-400'
                        }`}>
                          {nearby.atmAvailability.toFixed(1)}%
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedATM(nearby);
                          setShowMapModal(false);
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-semibold transition"
                      >
                        Seç
                      </button>
                    </div>
                  ))}
                </div>

                {/* Info */}
                <div className="mt-4 bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <div className="text-xl">💡</div>
                    <div className="text-xs text-gray-300">
                      <div className="font-semibold mb-1">Mesafe Hesaplama</div>
                      <p>Mesafeler Haversine formülü ile kuş uçuşu olarak hesaplanmaktadır. Gerçek yol mesafeleri farklılık gösterebilir.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1a2942;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2E86FF;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4a9eff;
        }
      `}</style>
    </div>
  );
}

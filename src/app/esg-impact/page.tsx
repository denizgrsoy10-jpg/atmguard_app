'use client';
import { useEffect, useState, useRef } from 'react';
import { estimateYearlyESG, calculateESGImpact, type ESGMetrics, formatCurrency, formatCurrencyShort, getPriceByKM } from '@/utils/pricing';

// Animasyonlu sayı bileşeni
function AnimatedNumber({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const duration = 2000; // 2 saniye
    const steps = 60;
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

// Particle System Component
function ParticleSystem() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    // SSR check
    if (typeof window === 'undefined') return;
    
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Canvas boyutunu ayarla
      const setCanvasSize = () => {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      setCanvasSize();
      window.addEventListener('resize', setCanvasSize);
    
    // Parçacık sınıfı
    class Particle {
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      opacity: number;
      fadeDirection: number;
      color: string;
      type: 'firefly' | 'energy';
      
      constructor(type: 'firefly' | 'energy') {
        this.type = type;
        const canvasWidth = canvas?.width || 1920;
        const canvasHeight = canvas?.height || 1080;
        this.x = Math.random() * canvasWidth;
        
        if (type === 'firefly') {
          // Fireflies - ekranda rastgele
          this.y = Math.random() * canvasHeight;
          this.size = Math.random() * 3 + 1;
          this.speedY = (Math.random() - 0.5) * 0.5;
          this.speedX = (Math.random() - 0.5) * 0.5;
          this.opacity = Math.random();
          this.fadeDirection = Math.random() > 0.5 ? 1 : -1;
          this.color = Math.random() > 0.5 ? '#10b981' : '#34d399'; // emerald
        } else {
          // Energy particles - alttan yukarı
          this.y = canvasHeight + Math.random() * 100;
          this.size = Math.random() * 4 + 2;
          this.speedY = -(Math.random() * 1.5 + 0.5);
          this.speedX = (Math.random() - 0.5) * 0.3;
          this.opacity = Math.random() * 0.7 + 0.3;
          this.fadeDirection = 0;
          this.color = Math.random() > 0.3 ? '#22c55e' : '#84cc16'; // green/lime
        }
      }
      
      update() {
        if (!canvas) return;
        
        if (this.type === 'firefly') {
          // Firefly hareketi - yavaş süzülme
          this.x += this.speedX;
          this.y += this.speedY;
          
          // Yanıp sönme efekti
          this.opacity += this.fadeDirection * 0.01;
          if (this.opacity <= 0.1 || this.opacity >= 0.9) {
            this.fadeDirection *= -1;
          }
          
          // Ekran sınırları
          if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
          if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
        } else {
          // Energy particle - yukarı yükselme
          this.x += this.speedX;
          this.y += this.speedY;
          
          // Solma efekti
          if (this.y < -100) {
            this.y = canvas.height + Math.random() * 100;
            this.x = Math.random() * canvas.width;
            this.opacity = Math.random() * 0.7 + 0.3;
          }
        }
      }
      
      draw() {
        if (!ctx) return;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        
        // Glow efekti
        const gradient = ctx.createRadialGradient(
          this.x, this.y, 0,
          this.x, this.y, this.size * 3
        );
        gradient.addColorStop(0, `${this.color}${Math.floor(this.opacity * 255).toString(16).padStart(2, '0')}`);
        gradient.addColorStop(1, `${this.color}00`);
        
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    }
    
    // Parçacıkları oluştur
    const particles: Particle[] = [];
    
    // 30 firefly + 20 energy particle
    for (let i = 0; i < 30; i++) {
      particles.push(new Particle('firefly'));
    }
    for (let i = 0; i < 20; i++) {
      particles.push(new Particle('energy'));
    }
    
    // Animasyon döngüsü
    let animationId: number;
    
    function animate() {
      if (!ctx || !canvas) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach(particle => {
        particle.update();
        particle.draw();
      });
      
      animationId = requestAnimationFrame(animate);
    }
    
    animate();
    
    return () => {
      window.removeEventListener('resize', setCanvasSize);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
    } catch (error) {
      console.error('Particle system error:', error);
    }
  }, []);
  
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}

interface ATMData {
  id: string;
  name: string;
  cashCenter: string;
  zone: number;
  km: number;
  serviceDays: string;
  operations: {
    ikmal: { monthly: number };
    flm: { monthly: number };
    slm: { monthly: number };
    paraToplama: { monthly: number };
  };
}

type EsgBrain = {
  optimization_rate: number;
  kombine_servis: number;
  toplam_karar: number;
  _source: 'brain' | 'mock';
};

export default function ESGImpactPage() {
  const [esgData, setEsgData] = useState<ESGMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [esgBrain, setEsgBrain] = useState<EsgBrain | null>(null);

  useEffect(() => {
    async function loadATMData() {
      try {
        // Optimizasyon oranını beyinden al (kombine servis oranı) — kapalıysa vitrin
        let optimizationRate = 0.25;
        try {
          const oR = await fetch('/api/esg-impact', { cache: 'no-store' });
          const oJ = (await oR.json()) as EsgBrain;
          setEsgBrain(oJ);
          if (oJ?.optimization_rate > 0) optimizationRate = oJ.optimization_rate;
        } catch {}

        // Budget Performance ile aynı CSV'yi kullan
        const response = await fetch('/api/atm-data');
        const result = await response.json();
        const csvContent = result.data;

        // CSV parse et
        const lines = csvContent.split('\n');
        const dataLines = lines.slice(3); // İlk 3 satır header
        
        const atmList: ATMData[] = [];
        dataLines.forEach((line: string) => {
          if (!line.trim()) return;
          const parts = line.split(';');
          if (parts.length < 6) return;

          const atmId = parts[0]?.trim();
          const atmName = parts[1]?.trim();
          const cashCenter = parts[2]?.trim();
          const zone = parseInt(parts[3]) || 0;
          const km = parseFloat(parts[4]) || 0;
          const serviceDays = parts[5]?.trim();

          if (atmId && cashCenter && km > 0) {
            atmList.push({
              id: atmId,
              name: atmName,
              cashCenter,
              zone,
              km,
              serviceDays,
              operations: {
                ikmal: { monthly: 10 },
                flm: { monthly: 4 },
                slm: { monthly: 1 },
                paraToplama: { monthly: 12 }
              }
            });
          }
        });

        // Gerçek verilerden ESG hesabı (beyin kombine oranıyla)
        calculateRealESG(atmList, optimizationRate);
      } catch (error) {
        console.error('CSV yükleme hatası:', error);
        // Hata durumunda mock data kullan
        const metrics = estimateYearlyESG(250000, 0.28);
        setEsgData(metrics);
      } finally {
        setLoading(false);
      }
    }

    function calculateRealESG(atms: ATMData[], optimizationRate: number) {
      // Tüm ATM'ler için toplam yıllık KM hesapla
      let totalKmBefore = 0;
      let totalTripsBefore = 0;

      atms.forEach(atm => {
        // Her operasyon için yıllık sefer sayısı
        const ikmalTrips = atm.operations.ikmal.monthly * 12;
        const flmTrips = atm.operations.flm.monthly * 12;
        const slmTrips = atm.operations.slm.monthly * 12;
        const paraToplamaTrips = atm.operations.paraToplama.monthly * 12;
        
        const yearlyTrips = ikmalTrips + flmTrips + slmTrips + paraToplamaTrips;
        const yearlyKm = yearlyTrips * atm.km;

        totalKmBefore += yearlyKm;
        totalTripsBefore += yearlyTrips;
      });

      // Optimizasyon oranı beyinden gelir (kombine servis oranı); beyin
      // kapalıysa 0.25 vitrin değeri kullanılır.
      const totalKmAfter = totalKmBefore * (1 - optimizationRate);
      const totalTripsAfter = totalTripsBefore * (1 - optimizationRate);

      const metrics = calculateESGImpact(
        totalKmBefore,
        totalKmAfter,
        totalTripsBefore,
        totalTripsAfter
      );

      setEsgData(metrics);
    }

    loadATMData();
  }, []);

  if (!esgData || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex items-center justify-center">
        <div className="text-white text-xl">
          {loading ? '🌱 Gerçek ATM verilerinden ESG hesaplanıyor...' : 'Loading ESG metrics...'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 p-6 relative overflow-hidden">
      {/* Particle System */}
      <ParticleSystem />
      
      {/* Animasyonlu Arka Plan Öğeleri */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 2 }}>
        {/* Rüzgar Değirmeni */}
        <div className="absolute top-20 right-10 opacity-10">
          <div className="text-8xl animate-spin-slow">💨</div>
        </div>
        
        {/* Uçuşan Yapraklar - Daha fazla yaprak! */}
        <div className="absolute top-40 left-20 animate-float-slow opacity-20">
          <span className="text-6xl">🍃</span>
        </div>
        <div className="absolute top-60 right-40 animate-float-medium opacity-15">
          <span className="text-5xl">🍂</span>
        </div>
        <div className="absolute bottom-40 left-40 animate-float-fast opacity-20">
          <span className="text-6xl">🌿</span>
        </div>
        <div className="absolute top-1/3 left-1/4 animate-float-slow opacity-25" style={{ animationDelay: '1s' }}>
          <span className="text-5xl">🌱</span>
        </div>
        <div className="absolute top-1/2 right-1/4 animate-float-medium opacity-20" style={{ animationDelay: '2s' }}>
          <span className="text-6xl">🍃</span>
        </div>
        <div className="absolute bottom-1/3 left-1/3 animate-float-fast opacity-18" style={{ animationDelay: '0.5s' }}>
          <span className="text-5xl">🌿</span>
        </div>
        <div className="absolute top-1/4 right-1/2 animate-float-slow opacity-22" style={{ animationDelay: '1.5s' }}>
          <span className="text-7xl">🍂</span>
        </div>
        <div className="absolute bottom-1/4 right-1/3 animate-float-medium opacity-18" style={{ animationDelay: '0.8s' }}>
          <span className="text-4xl">🌱</span>
        </div>
        <div className="absolute top-2/3 left-1/2 animate-float-fast opacity-20" style={{ animationDelay: '1.2s' }}>
          <span className="text-6xl">🍃</span>
        </div>
        <div className="absolute top-1/4 left-10 animate-float-medium opacity-15" style={{ animationDelay: '2.5s' }}>
          <span className="text-5xl">🌿</span>
        </div>
        <div className="absolute bottom-1/2 right-20 animate-float-slow opacity-25" style={{ animationDelay: '0.3s' }}>
          <span className="text-6xl">🍂</span>
        </div>
        <div className="absolute top-1/2 left-1/6 animate-float-fast opacity-20" style={{ animationDelay: '1.8s' }}>
          <span className="text-5xl">🌱</span>
        </div>
        
        {/* Ağaçlar */}
        <div className="absolute bottom-0 left-10 opacity-10 text-9xl">🌲</div>
        <div className="absolute bottom-0 right-20 opacity-10 text-9xl">🌳</div>
        <div className="absolute bottom-0 left-1/3 opacity-8 text-8xl">🌲</div>
        <div className="absolute bottom-0 right-1/2 opacity-8 text-7xl">🌳</div>
        
        {/* Bulutlar */}
        <div className="absolute top-10 left-1/4 animate-cloud opacity-20">
          <span className="text-7xl">☁️</span>
        </div>
        <div className="absolute top-32 right-1/3 animate-cloud-slow opacity-15">
          <span className="text-6xl">☁️</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <div className="inline-block animate-bounce-slow mb-4">
            <span className="text-7xl">🌍</span>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-green-400 via-emerald-500 to-green-600 bg-clip-text text-transparent flex items-center justify-center gap-3">
            ESG & Sürdürülebilirlik Etkisi
          </h1>
          <p className="text-slate-300 text-lg">
            Akıllı rota optimizasyonu ile hem maliyet hem de karbon ayak izi azaltımı
          </p>
          {esgBrain?._source === 'brain' ? (
            <div className="inline-block text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold mt-2">
              ● CANLI · Optimizasyon oranı beyinden: %{(esgBrain.optimization_rate * 100).toFixed(0)} · {esgBrain.kombine_servis}/{esgBrain.toplam_karar} kombine servis
            </div>
          ) : (
            <div className="inline-block text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-semibold mt-2">
              ○ Vitrin · %25 örnek optimizasyon (beyin beslenince kombine oranıyla canlanır)
            </div>
          )}
          <div className="flex items-center justify-center gap-4 mt-4 text-2xl">
            <span className="animate-pulse">🌱</span>
            <span className="animate-pulse delay-100">🌿</span>
            <span className="animate-pulse delay-200">🍃</span>
          </div>
        </div>

        {/* Ana Metrikler - 3 Büyük Kart */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Karbon Tasarrufu */}
          <div className="bg-gradient-to-br from-green-500 via-green-600 to-emerald-700 rounded-2xl p-6 shadow-2xl hover:shadow-green-500/50 transition-all duration-500 hover:scale-105 cursor-pointer group">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-3xl group-hover:animate-bounce">
                🌍
              </div>
              <div>
                <div className="text-green-100 text-sm font-medium">Karbon Tasarrufu</div>
                <div className="text-white text-4xl font-bold">
                  <AnimatedNumber value={esgData.co2SavedTons} decimals={1} suffix=" ton" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-green-100">Öncesi:</span>
                <span className="text-white font-semibold">{(esgData.co2Before / 1000).toFixed(0)} ton CO₂</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-100">Sonrası:</span>
                <span className="text-white font-semibold">{(esgData.co2After / 1000).toFixed(0)} ton CO₂</span>
              </div>
              <div className="pt-2 border-t border-green-400/30">
                <div className="flex items-center justify-between">
                  <span className="text-green-100 text-sm">Azalma:</span>
                  <span className="text-white font-bold text-lg">-{esgData.co2SavedPercent.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Ağaç Eşdeğeri */}
          <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 rounded-2xl p-6 shadow-2xl hover:shadow-emerald-500/50 transition-all duration-500 hover:scale-105 cursor-pointer group relative overflow-hidden">
            {/* Arka planda büyüyen ağaç animasyonu */}
            <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
              <div className="absolute bottom-0 right-0 text-9xl group-hover:scale-110 transition-transform duration-1000">
                🌳
              </div>
            </div>
            
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-3xl group-hover:animate-pulse">
                🌲
              </div>
              <div>
                <div className="text-emerald-100 text-sm font-medium">Ağaç Eşdeğeri</div>
                <div className="text-white text-4xl font-bold">
                  <AnimatedNumber value={esgData.treesEquivalent} decimals={0} />
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-emerald-100 text-sm leading-relaxed">
                Bu tasarruf, <span className="text-white font-bold">{esgData.treesEquivalent.toLocaleString('tr-TR')}</span> adet 
                ağacın bir yıl boyunca emdiği CO₂ miktarına eşittir.
              </p>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-xs text-emerald-100 mb-1">Görsel Temsil</div>
                <div className="text-2xl leading-relaxed">
                  {Array.from({ length: Math.min(24, Math.floor(esgData.treesEquivalent / 250)) }).map((_, i) => (
                    <span key={i}>🌲</span>
                  ))}
                  {esgData.treesEquivalent > 6000 && <span className="text-white ml-2 text-sm">+{(esgData.treesEquivalent - 6000).toLocaleString('tr-TR')}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Yakıt Tasarrufu */}
          <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-700 rounded-2xl p-6 shadow-2xl hover:shadow-blue-500/50 transition-all duration-500 hover:scale-105 cursor-pointer group">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-3xl group-hover:rotate-12 transition-transform">
                ⛽
              </div>
              <div>
                <div className="text-blue-100 text-sm font-medium">Yakıt Tasarrufu</div>
                <div className="text-white text-4xl font-bold">
                  <AnimatedNumber value={esgData.fuelLitersSaved} decimals={0} suffix=" L" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-blue-100 text-xs mb-1">Yıllık Maliyet Tasarrufu</div>
                <div className="text-white text-2xl font-bold">
                  ₺{formatCurrency(esgData.fuelCostSaved)}
                </div>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-blue-400/30">
                <span className="text-blue-100">KM Azalması:</span>
                <span className="text-white font-semibold">
                  {esgData.kmSaved.toLocaleString('tr-TR')} km
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Rota Optimizasyonu Detayı */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Rota İstatistikleri */}
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700/50">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              📊 Rota Optimizasyonu
            </h3>
            <div className="space-y-4">
              <div className="bg-slate-700/30 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-300">Toplam KM (Önce)</span>
                  <span className="text-red-400 font-bold">{esgData.totalKmBefore.toLocaleString('tr-TR')}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-300">Toplam KM (Sonra)</span>
                  <span className="text-green-400 font-bold">{esgData.totalKmAfter.toLocaleString('tr-TR')}</span>
                </div>
                <div className="border-t border-slate-600 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-semibold">Tasarruf</span>
                    <span className="text-green-400 font-bold text-lg">
                      -{esgData.kmSavedPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-700/30 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-300">Sefer Sayısı (Önce)</span>
                  <span className="text-red-400 font-bold">{esgData.tripsBefore.toLocaleString('tr-TR')}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-300">Sefer Sayısı (Sonra)</span>
                  <span className="text-green-400 font-bold">{esgData.tripsAfter.toLocaleString('tr-TR')}</span>
                </div>
                <div className="border-t border-slate-600 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-semibold">Azalan Sefer</span>
                    <span className="text-green-400 font-bold text-lg">
                      {esgData.tripsSaved.toLocaleString('tr-TR')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Karbon Kredisi ve ESG Uyumluluk */}
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700/50">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              💼 ESG Değeri & Uyumluluk
            </h3>
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-xl p-4">
                <div className="text-amber-100 text-sm mb-1">Karbon Kredisi Değeri</div>
                <div className="text-white text-3xl font-bold mb-2">
                  ${esgData.carbonCreditValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                </div>
                <div className="text-amber-100 text-sm">
                  ≈ ₺{formatCurrency(esgData.carbonCreditValueTL)}
                </div>
                <div className="text-xs text-amber-200 mt-2">
                  ({esgData.co2SavedTons.toFixed(1)} ton × $85/ton)
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-slate-300 font-semibold mb-3">ESG Standartları:</div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-400 text-lg">✅</span>
                  <span className="text-slate-200">Paris İklim Anlaşması uyumlu</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-400 text-lg">✅</span>
                  <span className="text-slate-200">Net-Zero hedefine katkı</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-400 text-lg">✅</span>
                  <span className="text-slate-200">ISO 14001 çevre yönetimi</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-400 text-lg">✅</span>
                  <span className="text-slate-200">CDP Carbon Disclosure hazır</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Nasıl Çalışıyor */}
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700/50">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            🧠 Akıllı Optimizasyon Nasıl Çalışıyor?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-700/30 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">🎯</div>
              <div className="text-white font-semibold mb-1">Rota Gruplama</div>
              <div className="text-slate-300 text-sm">
                Aynı bölgedeki ATM'ler tek seferde ziyaret edilir
              </div>
            </div>
            <div className="bg-slate-700/30 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">⚡</div>
              <div className="text-white font-semibold mb-1">Çakışma Önleme</div>
              <div className="text-slate-300 text-sm">
                Gereksiz tekrar ziyaretler engellenir
              </div>
            </div>
            <div className="bg-slate-700/30 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">📅</div>
              <div className="text-white font-semibold mb-1">Planlı İşlem</div>
              <div className="text-slate-300 text-sm">
                Acil yerine planlı operasyonlar öncelikli
              </div>
            </div>
            <div className="bg-slate-700/30 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">🔄</div>
              <div className="text-white font-semibold mb-1">Sürekli İyileştirme</div>
              <div className="text-slate-300 text-sm">
                AI öğrenerek rotaları optimize eder
              </div>
            </div>
          </div>
        </div>

        {/* Yeşil Bankacılık Mesajı */}
        <div className="bg-gradient-to-r from-green-500 via-emerald-600 to-green-500 rounded-2xl p-8 text-center relative overflow-hidden group cursor-pointer hover:shadow-2xl hover:shadow-green-500/50 transition-all duration-500">
          {/* Animasyonlu arka plan efekti */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-10 left-10 animate-float-slow">🌿</div>
            <div className="absolute top-20 right-20 animate-float-medium">🍃</div>
            <div className="absolute bottom-10 left-1/3 animate-float-fast">🌱</div>
            <div className="absolute bottom-20 right-1/4 animate-pulse">💚</div>
          </div>
          
          <div className="relative z-10">
            <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-500 inline-block">
              🌍
            </div>
            <h2 className="text-4xl font-bold text-white mb-3 group-hover:scale-105 transition-transform">
              İlk Net-Zero ATM Yönetim Sistemi
            </h2>
            <p className="text-green-50 text-lg max-w-3xl mx-auto leading-relaxed">
              Hem teknik bakım hem nakit yönetimini birleştiren tek platform. 
              Maliyet tasarrufu yaparken dünyamızı da koruyoruz. 🌱
            </p>
            <div className="mt-6 flex items-center justify-center gap-8 text-sm text-green-100">
              <div className="group/item hover:scale-110 transition-transform">
                <div className="text-3xl font-bold text-white">
                  <AnimatedNumber value={esgData.co2SavedTons} decimals={0} />
                </div>
                <div>ton CO₂ azaltım</div>
              </div>
              <div className="w-px h-12 bg-green-400/30"></div>
              <div className="group/item hover:scale-110 transition-transform">
                <div className="text-3xl font-bold text-white">
                  <AnimatedNumber value={esgData.treesEquivalent} decimals={0} />
                </div>
                <div>ağaç eşdeğeri</div>
              </div>
              <div className="w-px h-12 bg-green-400/30"></div>
              <div className="group/item hover:scale-110 transition-transform">
                <div className="text-3xl font-bold text-white">
                  -<AnimatedNumber value={esgData.kmSavedPercent} decimals={0} suffix="%" />
                </div>
                <div>KM azalması</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

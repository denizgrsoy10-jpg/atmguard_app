"use client";

import { useEffect, useMemo, useState } from "react";

type DriftRow = { feature: string; psi: number; ks: number };
type NetRoiPoint = { x: number; y: number };
type RoiStackPoint = { day: number; avoided: number; cost: number };
type PrPoint = { recall: number; precision: number };

type MetricInfo = {
  title: string;
  description: string;
  purpose: string;
  interpretation: string;
};

const METRIC_EXPLANATIONS: Record<string, MetricInfo> = {
  "f1_30g": {
    title: "F1 Score (30 Gün)",
    description: "Modelin genel performansını ölçen ana metrik. Precision ve Recall'un harmonik ortalamasıdır.",
    purpose: "Model hem doğru tahmin yapıyor mu, hem de tüm vakaları yakalıyor mu? İkisinin dengesini gösterir.",
    interpretation: "1.0'a yakın olması mükemmel. 0.59 değeri modelin orta-iyi performans gösterdiğini belirtir. 0.70+ hedeflenmeli."
  },
  "ks": {
    title: "Kolmogorov-Smirnov (KS)",
    description: "Modelin başarılı ve başarısız vakaları ne kadar iyi ayırt edebildiğini ölçer.",
    purpose: "Model risk puanlamasında yüksek ve düşük riskli ATM'leri birbirinden ayırabilme gücü.",
    interpretation: "0-1 arası. 0.13 değeri düşük ayırt edebilme gücü gösterir. 0.30+ olması ideal, modelin güçlü diskriminasyon yeteneği olduğunu gösterir."
  },
  "precision_30g": {
    title: "Precision (Kesinlik - 30 Gün)",
    description: "Model 'riskli' dediği ATM'lerin gerçekten riskli olanlarının oranı.",
    purpose: "Yanlış alarm oranını minimize etmek. Gereksiz FLM ekip hareketi maliyetli.",
    interpretation: "1.0 = mükemmel, tüm tahminler doğru. Yüksek precision, kaynak israfını önler ama bazı riskleri kaçırabilir."
  },
  "recall_30g": {
    title: "Recall (Duyarlılık - 30 Gün)",
    description: "Gerçekten riskli olan ATM'lerin ne kadarını yakaladığımız.",
    purpose: "Hiçbir riskli ATM'i kaçırmamak. Downtime ve müşteri kaybını önlemek kritik.",
    interpretation: "0.42 = %42 riskli ATM'i yakalıyoruz. %58'i kaçıyoruz. 0.70+ hedeflenmeli, aksi halde kritik arızalar atlanabilir."
  },
  "max_drift_psi": {
    title: "Maximum Drift PSI (Population Stability Index)",
    description: "Veri dağılımının ne kadar değiştiğini ölçer. Model eğitildiği veri ile mevcut veri arasındaki fark.",
    purpose: "Model eskiyor mu? Veri yapısı değişti mi? Model yeniden eğitilmeli mi?",
    interpretation: "0.40 = %40 sapma, YÜKSEK UYARI! 0.25+ model performansı düşmeye başlar. Re-training gerekebilir."
  },
  "worst_drift_feature": {
    title: "En Kötü Drift Özelliği",
    description: "En çok değişiklik gösteren veri özelliği. Bu özelliğin dağılımı modelin eğitildiği dönemden çok farklı.",
    purpose: "Hangi veri kaynağı/özellik sorunlu? İş süreçlerinde değişiklik mi oldu?",
    interpretation: "JamEvents = Jam olayları beklenenden farklı dağılıyor. Operasyonel bir değişiklik mi var? Veri kalitesi kontrol edilmeli."
  },
  "roi_30g": {
    title: "ROI Multiple (30 Gün)",
    description: "Her 1 TL harcamaya karşılık kaç TL tasarruf sağlandı.",
    purpose: "Projenin iş değerini ölçmek. Yatırım geri dönüşü.",
    interpretation: "3.0x = Her 1 TL maliyete 3 TL tasarruf. Mükemmel! 2.0+ sürdürülebilir, 1.0 altı zararl."
  },
  "flm_success": {
    title: "FLM Başarı Oranı",
    description: "First Level Maintenance müdahalelerinin başarı yüzdesi. İlk müdahalede sorun çözüldü mü?",
    purpose: "Teknisyen verimliliği ve ilk müdahale kalitesi. SLM'ye ihtiyaç duymadan sorun çözüldü mü?",
    interpretation: "%78 = İyi seviye. %85+ hedeflenmeli. Düşük oran, eğitim eksikliği veya yanlış tanı gösterebilir."
  },
  "slm_accuracy": {
    title: "SLM Doğruluk",
    description: "Second Level Maintenance (uzman) müdahalelerinin doğruluk oranı.",
    purpose: "Uzman teknik ekibin tanı ve çözüm başarısı. Karmaşık sorunlarda performans.",
    interpretation: "%92 = Mükemmel. SLM ekibi son derece başarılı. %90+ sürdürülmeli."
  },
  "prevented_failures": {
    title: "Önlenen Arıza",
    description: "Proaktif bakım sayesinde önlenen toplam arıza sayısı.",
    purpose: "Sistemin kaç arızayı önceden tespit edip önlediğini gösterir. Downtime azaltma metriği.",
    interpretation: "143 adet = Son 30 günde 143 potansiyel arıza önlendi. Yüksek sayı, modelin etkili çalıştığını gösterir."
  },
  "cost_reduction": {
    title: "Maliyet Azaltma",
    description: "FLM optimizasyonu ile sağlanan toplam maliyet tasarrufu (USD).",
    purpose: "Projenin finansal etkisini ölçmek. Kaç dolar tasarruf sağlandı?",
    interpretation: "$12.4K = 12,400 dolar tasarruf. Gereksiz saha ziyaretleri, yanlış part değişimleri önlendi."
  },
  "learning_rate": {
    title: "Öğrenme Hızı / Model Güven Skoru",
    description: "Modelin yeni veriyi ne kadar hızlı öğrendiği ve tahminlerindeki güven seviyesi.",
    purpose: "Model sürekli gelişiyor mu? Adaptasyon yeteneği nasıl?",
    interpretation: "%94 = Çok yüksek güven. Model kararlı ve güvenilir tahminler yapıyor."
  },
  "daily_predictions": {
    title: "Günlük İşlem / Arıza Tahmini",
    description: "Her gün sistemin analiz ettiği ve risk puanı verdiği ATM/işlem sayısı.",
    purpose: "Sistemin kapasitesi ve aktif kullanımı. Kaç ATM'e günlük bakıyoruz?",
    interpretation: "847 = Her gün 847 ATM/işlem analiz ediliyor ve risk puanlanıyor."
  },
  "anomaly_rate": {
    title: "Anomaly Rate (Anormallik Oranı)",
    description: "Sistemin anormal/beklenmeyen davranış tespit ettiği vaka oranı.",
    purpose: "Outlier tespiti. Beklenmedik durumların frekansı. Sistem ne kadar istikrarlı?",
    interpretation: "7d: %4, 30d: %7 = Makul seviye. %10+ olursa veri kalitesi veya operasyonel sorun olabilir."
  },
  "sla_compliance": {
    title: "SLA Compliance (SLA Uyumu)",
    description: "Servis seviyesi anlaşmasına uyum oranı. Hedeflenen yanıt süresi ve çözüm süreleri tutturuldu mu?",
    purpose: "Operasyonel performans ve müşteri memnuniyeti. Sözleşme taahhütlerini karşılıyor muyuz?",
    interpretation: "%91 = İyi ama ideal değil. %95+ hedeflenmeli. %90 altı SLA ihlali riski taşır."
  },
  "data_freshness": {
    title: "Data Freshness (Veri Tazeliği)",
    description: "En son veri ne kadar süre önce sisteme geldi (dakika cinsinden).",
    purpose: "Gerçek zamanlı performans. Veri akışı sağlıklı mı? Gecikmeler var mı?",
    interpretation: "12 dk = Veri oldukça taze. 60+ dk gecikme olursa veri pipeline'ı kontrol edilmeli."
  },
  "model_version": {
    title: "Model Version (Model Versiyonu)",
    description: "Şu an production'da çalışan model versiyonu ve önceki versiyon.",
    purpose: "Model lifecycle tracking. Hangi versiyon aktif? Ne zaman güncellendi?",
    interpretation: "v1.12 → v1.13: Threshold ayarı yapıldı (+0.02), drift guardrails güncellendi."
  },
  "net_roi_panel": {
    title: "Net ROI Trend (30 Gün)",
    description: "Son 30 günün net yatırım getirisi trendi. Önlenen maliyetler (avoided) - Harcanan maliyetler (cost) = Net ROI",
    purpose: "Projenin finansal performansını zaman içinde izlemek. Kar/zarar eğilimi nereye gidiyor?",
    interpretation: "Grafik yukarı doğru yükseliyorsa pozitif ROI artıyor, projenin değeri kanıtlanıyor. Düz çizgi = sabit tasarruf. Aşağı iniş = sorun var, maliyet/fayda dengesini gözden geçir."
  },
  "feature_drift_panel": {
    title: "Feature Drift (PSI / KS)",
    description: "Her bir özelliğin (feature) veri dağılımında ne kadar değişiklik/kayma olduğunu gösterir. PSI = Population Stability Index, KS = Kolmogorov-Smirnov.",
    purpose: "Model eğitim verisi ile mevcut veri arasındaki farkları tespit etmek. Hangi değişkenler değişti? Model güvenilir mi hala?",
    interpretation: "PSI < 0.10 = Stabil, PSI 0.10-0.25 = Dikkat, PSI > 0.25 = Yüksek drift, model yeniden eğitilmeli. KS yüksek = o feature'ın dağılımı çok farklı."
  },
  "model_quality_panel": {
    title: "Model Quality (Threshold & PR Curve)",
    description: "Model kalite ayarları. Threshold = karar eşiği (bu değerin üstü 'riskli' sayılır). PR Curve = Precision-Recall dengesi görseli.",
    purpose: "Modelin karar eşiğini optimize etmek. Trade-off: Daha fazla yakalamak vs. daha az yanlış alarm.",
    interpretation: "Threshold 0.62 = Risk skoru 0.62'nin üstündeki ATM'ler 'riskli'. Düşürürsen daha fazla ATM yakalarsın ama yanlış alarm artar. PR Curve idealse sağ üst köşeye yakın."
  },
  "roi_avoided_panel": {
    title: "ROI & Avoided Cost (30 Gün)",
    description: "Gün bazında biriken 'önlenen maliyet' (avoided) ve 'harcanan maliyet' (cost) karşılaştırması.",
    purpose: "Her gün ne kadar tasarruf sağlanıyor vs. ne kadar harcama yapılıyor? Kümülatif trend nasıl?",
    interpretation: "Avoided her zaman cost'tan yüksekse → pozitif ROI. Gün 30'da 1.8M avoided vs 600K cost = 3x ROI, mükemmel performans."
  }
};

type HealthPayload = {
  f1_30g: number;
  ks: number;
  precision_30g: number;
  recall_30g: number;
  max_drift_psi: number;
  worst_drift_feature: string;

  avoided_try_30g: number;
  cost_try_30g: number;
  roi_multiple_30g: number;

  anomaly_rate_7d: number;
  anomaly_rate_30d: number;
  sla_compliance: number;
  data_freshness_min: number;
  rows_scored_today: number;

  model_version_current: string;
  model_version_prev: string;
  model_version_note: string;

  drift: DriftRow[];
  netroi_trend: NetRoiPoint[];
  roi_stack: RoiStackPoint[];

  threshold: { current: number; recommended: number };
  pr_curve: PrPoint[];
};

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0E2142] rounded-2xl p-4 shadow-lg ring-1 ring-[#2B416B]">
      <div className="text-xs text-[#A7B8D8] mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-3 h-1.5 w-full bg-[#112544] rounded-full overflow-hidden">
        <div className="h-1.5 bg-[#2E86FF] rounded-full w-2/3" />
      </div>
    </div>
  );
}

function Panel({ title, children, infoKey, onInfoClick }: { title: string; children: React.ReactNode; infoKey?: string; onInfoClick?: (info: MetricInfo) => void }) {
  return (
    <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm">{title}</div>
        {infoKey && onInfoClick && (
          <button
            onClick={() => onInfoClick(METRIC_EXPLANATIONS[infoKey])}
            className="w-6 h-6 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition"
          >
            ?
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function fmtTRY(n: number) {
  return `${n.toLocaleString("tr-TR")} TL`;
}

const TRY_PER_USD = 36;

function fmtUSD(n: number) {
  return `$${(n / TRY_PER_USD).toFixed(2)}`;
}

export default function TrendHealthPage() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState<MetricInfo | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr(null);
        const r = await fetch("/api/health", { cache: "no-store" });
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        const j = (await r.json()) as HealthPayload;
        if (!alive) return;
        setData(j);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Unknown error");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const driftMax = useMemo(() => {
    if (!data) return 1;
    return Math.max(...data.drift.map((d) => d.psi), 1);
  }, [data]);

  const roiMax = useMemo(() => {
    if (!data) return 1;
    const maxA = Math.max(...data.roi_stack.map((p) => p.avoided), 1);
    return maxA;
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Info Modal */}
      {infoModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setInfoModal(null)}
        >
          <div 
            className="bg-[#112544] rounded-2xl p-6 max-w-2xl w-full ring-2 ring-[#2E86FF] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">{infoModal.title}</h3>
              <button
                onClick={() => setInfoModal(null)}
                className="text-[#A7B8D8] hover:text-white transition text-2xl leading-none"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-[#2E86FF] font-semibold mb-1">📊 Tanım</div>
                <div className="text-[#A7B8D8] leading-relaxed">{infoModal.description}</div>
              </div>
              
              <div>
                <div className="text-[#10B981] font-semibold mb-1">🎯 Amaç</div>
                <div className="text-[#A7B8D8] leading-relaxed">{infoModal.purpose}</div>
              </div>
              
              <div>
                <div className="text-[#F2B705] font-semibold mb-1">💡 Yorumlama</div>
                <div className="text-[#A7B8D8] leading-relaxed">{infoModal.interpretation}</div>
              </div>
            </div>
            
            <button
              onClick={() => setInfoModal(null)}
              className="mt-6 w-full py-2 bg-[#2E86FF] hover:bg-[#1E5FCC] text-white rounded-lg font-semibold transition"
            >
              Anladım
            </button>
          </div>
        </div>
      )}

      {err ? (
        <div className="rounded-2xl p-4 bg-[#112544] ring-1 ring-red-500/40">
          <div className="text-sm font-semibold text-red-300">Health API Error</div>
          <div className="text-xs text-[#A7B8D8] mt-1">{err}</div>
          <div className="text-xs text-[#A7B8D8] mt-2">
            Endpoint: <span className="text-white/80">/api/health</span>
          </div>
        </div>
      ) : null}

      {/* Motor Performans Metrikleri */}
      <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
        <div className="text-sm font-semibold mb-4">⚙️ Motor Performans Metrikleri / AI Engine Performance Metrics</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B] relative group">
            <button
              onClick={() => setInfoModal(METRIC_EXPLANATIONS["flm_success"])}
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100"
            >
              ?
            </button>
            <div className="text-[10px] text-[#A7B8D8] mb-1">FLM Başarı Oranı</div>
            <div className="text-xl font-bold text-[#10B981]">78%</div>
            <div className="text-[9px] text-white/60 mt-1">+5% (30g)</div>
          </div>
          
          <div className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B] relative group">
            <button
              onClick={() => setInfoModal(METRIC_EXPLANATIONS["slm_accuracy"])}
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100"
            >
              ?
            </button>
            <div className="text-[10px] text-[#A7B8D8] mb-1">SLM Doğruluk</div>
            <div className="text-xl font-bold text-[#2E86FF]">92%</div>
            <div className="text-[9px] text-white/60 mt-1">+3% (30g)</div>
          </div>
          
          <div className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B] relative group">
            <button
              onClick={() => setInfoModal(METRIC_EXPLANATIONS["prevented_failures"])}
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100"
            >
              ?
            </button>
            <div className="text-[10px] text-[#A7B8D8] mb-1">Önlenen Arıza</div>
            <div className="text-xl font-bold text-[#F2B705]">143</div>
            <div className="text-[9px] text-white/60 mt-1">Son 30 gün</div>
          </div>
          
          <div className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B] relative group">
            <button
              onClick={() => setInfoModal(METRIC_EXPLANATIONS["cost_reduction"])}
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100"
            >
              ?
            </button>
            <div className="text-[10px] text-[#A7B8D8] mb-1">Maliyet Azaltma</div>
            <div className="text-xl font-bold text-[#10B981]">$12.4K</div>
            <div className="text-[9px] text-white/60 mt-1">FLM optimizasyon</div>
          </div>
          
          <div className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B] relative group">
            <button
              onClick={() => setInfoModal(METRIC_EXPLANATIONS["learning_rate"])}
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100"
            >
              ?
            </button>
            <div className="text-[10px] text-[#A7B8D8] mb-1">Öğrenme Hızı</div>
            <div className="text-xl font-bold text-[#2E86FF]">94%</div>
            <div className="text-[9px] text-white/60 mt-1">Model güven skoru</div>
          </div>
          
          <div className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B] relative group">
            <button
              onClick={() => setInfoModal(METRIC_EXPLANATIONS["daily_predictions"])}
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100"
            >
              ?
            </button>
            <div className="text-[10px] text-[#A7B8D8] mb-1">Günlük İşlem</div>
            <div className="text-xl font-bold text-white">847</div>
            <div className="text-[9px] text-white/60 mt-1">Arıza tahmini</div>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-4">
        <div className="bg-[#0E2142] rounded-2xl p-4 shadow-lg ring-1 ring-[#2B416B] relative group cursor-pointer" onClick={() => setInfoModal(METRIC_EXPLANATIONS["f1_30g"])}>
          <button className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100">?</button>
          <div className="text-xs text-[#A7B8D8] mb-1">F1_30g</div>
          <div className="text-2xl font-bold">{data ? data.f1_30g.toFixed(2) : "…"}</div>
          <div className="mt-3 h-1.5 w-full bg-[#112544] rounded-full overflow-hidden">
            <div className="h-1.5 bg-[#2E86FF] rounded-full w-2/3" />
          </div>
        </div>
        
        <div className="bg-[#0E2142] rounded-2xl p-4 shadow-lg ring-1 ring-[#2B416B] relative group cursor-pointer" onClick={() => setInfoModal(METRIC_EXPLANATIONS["ks"])}>
          <button className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100">?</button>
          <div className="text-xs text-[#A7B8D8] mb-1">KS</div>
          <div className="text-2xl font-bold">{data ? data.ks.toFixed(2) : "…"}</div>
          <div className="mt-3 h-1.5 w-full bg-[#112544] rounded-full overflow-hidden">
            <div className="h-1.5 bg-[#2E86FF] rounded-full w-2/3" />
          </div>
        </div>
        
        <div className="bg-[#0E2142] rounded-2xl p-4 shadow-lg ring-1 ring-[#2B416B] relative group cursor-pointer" onClick={() => setInfoModal(METRIC_EXPLANATIONS["precision_30g"])}>
          <button className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100">?</button>
          <div className="text-xs text-[#A7B8D8] mb-1">Precision_30g</div>
          <div className="text-2xl font-bold">{data ? data.precision_30g.toFixed(2) : "…"}</div>
          <div className="mt-3 h-1.5 w-full bg-[#112544] rounded-full overflow-hidden">
            <div className="h-1.5 bg-[#2E86FF] rounded-full w-2/3" />
          </div>
        </div>
        
        <div className="bg-[#0E2142] rounded-2xl p-4 shadow-lg ring-1 ring-[#2B416B] relative group cursor-pointer" onClick={() => setInfoModal(METRIC_EXPLANATIONS["recall_30g"])}>
          <button className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100">?</button>
          <div className="text-xs text-[#A7B8D8] mb-1">Recall_30g</div>
          <div className="text-2xl font-bold">{data ? data.recall_30g.toFixed(2) : "…"}</div>
          <div className="mt-3 h-1.5 w-full bg-[#112544] rounded-full overflow-hidden">
            <div className="h-1.5 bg-[#2E86FF] rounded-full w-2/3" />
          </div>
        </div>
        
        <div className="bg-[#0E2142] rounded-2xl p-4 shadow-lg ring-1 ring-[#2B416B] relative group cursor-pointer" onClick={() => setInfoModal(METRIC_EXPLANATIONS["max_drift_psi"])}>
          <button className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100">?</button>
          <div className="text-xs text-[#A7B8D8] mb-1">Max Drift PSI</div>
          <div className="text-2xl font-bold">{data ? `${Math.round(data.max_drift_psi * 100)}%` : "…"}</div>
          <div className="mt-3 h-1.5 w-full bg-[#112544] rounded-full overflow-hidden">
            <div className="h-1.5 bg-[#2E86FF] rounded-full w-2/3" />
          </div>
        </div>
        
        <div className="bg-[#0E2142] rounded-2xl p-4 shadow-lg ring-1 ring-[#2B416B] relative group cursor-pointer" onClick={() => setInfoModal(METRIC_EXPLANATIONS["worst_drift_feature"])}>
          <button className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100">?</button>
          <div className="text-xs text-[#A7B8D8] mb-1">Worst Drift Feature</div>
          <div className="text-2xl font-bold">{data ? data.worst_drift_feature : "…"}</div>
          <div className="mt-3 h-1.5 w-full bg-[#112544] rounded-full overflow-hidden">
            <div className="h-1.5 bg-[#2E86FF] rounded-full w-2/3" />
          </div>
        </div>
        
        <div className="bg-[#0E2142] rounded-2xl p-4 shadow-lg ring-1 ring-[#2B416B] relative group cursor-pointer" onClick={() => setInfoModal(METRIC_EXPLANATIONS["roi_30g"])}>
          <button className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100">?</button>
          <div className="text-xs text-[#A7B8D8] mb-1">ROI (30g)</div>
          <div className="text-2xl font-bold">{data ? `${data.roi_multiple_30g.toFixed(1)}x` : "…"}</div>
          <div className="mt-3 h-1.5 w-full bg-[#112544] rounded-full overflow-hidden">
            <div className="h-1.5 bg-[#2E86FF] rounded-full w-2/3" />
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-12 gap-4">
        {/* ROI Trend */}
        <div className="col-span-12 xl:col-span-5">
          <Panel title="Net ROI (30g)" infoKey="net_roi_panel" onInfoClick={setInfoModal}>
            <div className="h-[260px] bg-[#0E2142] rounded-xl ring-1 ring-[#2B416B] flex items-center justify-center">
              {!data ? (
                <div className="text-[#A7B8D8] text-sm">Loading…</div>
              ) : (
                <svg width="100%" height="100%" viewBox="0 0 520 220" className="p-4">
                  <line x1="30" y1="10" x2="30" y2="200" stroke="#2B416B" />
                  <line x1="30" y1="200" x2="500" y2="200" stroke="#2B416B" />
                  <polyline
                    fill="none"
                    stroke="#2E86FF"
                    strokeWidth="3"
                    points={data.netroi_trend
                      .map((p, idx) => {
                        const x = 30 + (idx / (data.netroi_trend.length - 1)) * 470;
                        const y = 200 - ((p.y + 200000) / 240000) * 190; // normalize
                        return `${x},${y}`;
                      })
                      .join(" ")}
                  />
                </svg>
              )}
            </div>
            {data ? (
              <div className="mt-3 grid grid-cols-3 text-xs text-[#A7B8D8]">
                <div>Avoided: <span className="text-white/80">{fmtUSD(data.avoided_try_30g)}</span></div>
                <div>Cost: <span className="text-white/80">{fmtUSD(data.cost_try_30g)}</span></div>
                <div>Net: <span className="text-white/80">{fmtUSD(data.avoided_try_30g - data.cost_try_30g)}</span></div>
              </div>
            ) : null}
          </Panel>
        </div>

        {/* Feature Drift */}
        <div className="col-span-12 xl:col-span-7">
          <Panel title="Feature Drift (PSI / KS)" infoKey="feature_drift_panel" onInfoClick={setInfoModal}>
            <div className="grid grid-cols-12 gap-3">
              {!data ? (
                <div className="col-span-12 text-[#A7B8D8] text-sm">Loading…</div>
              ) : (
                data.drift.map((d) => (
                  <div
                    key={d.feature}
                    className="col-span-12 md:col-span-6 bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-[#A7B8D8]">{d.feature}</div>
                      <div className="text-xs text-white/70">KS: {d.ks.toFixed(2)}</div>
                    </div>

                    <div className="mt-2 h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-[#2E86FF] rounded-full"
                        style={{ width: `${Math.round((d.psi / driftMax) * 100)}%` }}
                        title={`PSI: ${d.psi.toFixed(2)}`}
                      />
                    </div>

                    <div className="mt-2 text-xs text-white/70">PSI: {d.psi.toFixed(2)}</div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        {/* Model Quality / Threshold / PR */}
        <div className="col-span-12 xl:col-span-7">
          <Panel title="Model Quality (PR / Threshold)" infoKey="model_quality_panel" onInfoClick={setInfoModal}>
            {!data ? (
              <div className="text-[#A7B8D8] text-sm">Loading…</div>
            ) : (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 md:col-span-6 bg-[#0E2142] rounded-xl p-4 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8] mb-2">Threshold</div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Current</span>
                    <span className="font-semibold">{data.threshold.current.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span>Recommended</span>
                    <span className="font-semibold">{data.threshold.recommended.toFixed(2)}</span>
                  </div>
                  <div className="mt-3 h-2 bg-[#112544] rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-[#2E86FF] rounded-full"
                      style={{ width: `${Math.round(data.threshold.current * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="col-span-12 md:col-span-6 bg-[#0E2142] rounded-xl p-4 ring-1 ring-[#2B416B]">
                  <div className="text-xs text-[#A7B8D8] mb-2">PR Curve (placeholder)</div>
                  <svg width="100%" height="160" viewBox="0 0 320 160">
                    <line x1="20" y1="10" x2="20" y2="140" stroke="#2B416B" />
                    <line x1="20" y1="140" x2="300" y2="140" stroke="#2B416B" />
                    <polyline
                      fill="none"
                      stroke="#2E86FF"
                      strokeWidth="3"
                      points={data.pr_curve
                        .map((p) => {
                          const x = 20 + p.recall * 280;
                          const y = 140 - p.precision * 120;
                          return `${x},${y}`;
                        })
                        .join(" ")}
                    />
                  </svg>
                </div>
              </div>
            )}
          </Panel>
        </div>

        {/* ROI & Avoided Cost */}
        <div className="col-span-12 xl:col-span-5">
          <Panel title="ROI & Avoided Cost (30g)" infoKey="roi_avoided_panel" onInfoClick={setInfoModal}>
            {!data ? (
              <div className="text-[#A7B8D8] text-sm">Loading…</div>
            ) : (
              <div className="bg-[#0E2142] rounded-xl p-4 ring-1 ring-[#2B416B]">
                <div className="text-xs text-[#A7B8D8] mb-3">Avoided vs Cost (mock)</div>
                <div className="space-y-3">
                  {data.roi_stack.map((p) => (
                    <div key={p.day}>
                      <div className="flex justify-between text-xs text-[#A7B8D8] mb-1">
                        <span>Day {p.day}</span>
                        <span>Avoided: {fmtUSD(p.avoided)} | Cost: {fmtUSD(p.cost)}</span>
                      </div>
                      <div className="h-2 w-full bg-[#112544] rounded-full overflow-hidden">
                        <div
                          className="h-2 bg-[#2E86FF] rounded-full"
                          style={{ width: `${Math.round((p.avoided / roiMax) * 100)}%` }}
                        />
                      </div>
                      <div className="mt-1 h-2 w-full bg-[#112544] rounded-full overflow-hidden opacity-70">
                        <div
                          className="h-2 bg-[#F2B705] rounded-full"
                          style={{ width: `${Math.round((p.cost / roiMax) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>

        {/* Bottom strip */}
        <div className="col-span-12 grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-3 bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B] relative group cursor-pointer" onClick={() => setInfoModal(METRIC_EXPLANATIONS["anomaly_rate"])}>
            <button className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100">?</button>
            <div className="text-sm mb-2">Anomaly Rate</div>
            <div className="text-xs text-[#A7B8D8]">
              7d: <span className="text-white/80">{data ? `${Math.round(data.anomaly_rate_7d * 100)}%` : "…"}</span>
              {"  "} | 30d: <span className="text-white/80">{data ? `${Math.round(data.anomaly_rate_30d * 100)}%` : "…"}</span>
            </div>
          </div>

          <div className="col-span-12 md:col-span-3 bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B] relative group cursor-pointer" onClick={() => setInfoModal(METRIC_EXPLANATIONS["sla_compliance"])}>
            <button className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100">?</button>
            <div className="text-sm mb-2">SLA Compliance</div>
            <div className="text-xs text-[#A7B8D8]">
              {data ? `${Math.round(data.sla_compliance * 100)}%` : "…"}
            </div>
          </div>

          <div className="col-span-12 md:col-span-3 bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B] relative group cursor-pointer" onClick={() => setInfoModal(METRIC_EXPLANATIONS["model_version"])}>
            <button className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100">?</button>
            <div className="text-sm mb-2">Model Version</div>
            <div className="text-xs text-[#A7B8D8]">
              {data ? `${data.model_version_prev} → ${data.model_version_current}` : "…"}
            </div>
            <div className="text-[11px] text-white/60 mt-1">{data?.model_version_note ?? ""}</div>
          </div>

          <div className="col-span-12 md:col-span-3 bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B] relative group cursor-pointer" onClick={() => setInfoModal(METRIC_EXPLANATIONS["data_freshness"])}>
            <button className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100">?</button>
            <div className="text-sm mb-2">Data Freshness</div>
            <div className="text-xs text-[#A7B8D8]">
              Freshness: <span className="text-white/80">{data ? `${data.data_freshness_min} dk` : "…"}</span>
            </div>
            <div className="text-xs text-[#A7B8D8] mt-1">
              Rows scored: <span className="text-white/80">{data ? data.rows_scored_today.toLocaleString("tr-TR") : "…"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

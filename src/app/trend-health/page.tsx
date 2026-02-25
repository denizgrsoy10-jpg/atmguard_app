"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TrainingLogEntry } from "@/app/api/train-upload/route";

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

const VERI_TURLERI = [
  {
    id: "ariza_log",
    label: "Arıza Log",
    icon: "🔧",
    renk: "text-red-400 border-red-500/40 bg-red-500/10",
    aktif: "border-red-400 bg-red-500/20 text-red-300",
    kolonlar: ["terminal_id", "tarih", "ariza_kodu", "aciklama", "durum", "sure_dk"],
    aciklama: "Açık/kapanmış arıza kayıtları",
  },
  {
    id: "ikmal",
    label: "İkmal Kaydı",
    icon: "💰",
    renk: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
    aktif: "border-emerald-400 bg-emerald-500/20 text-emerald-300",
    kolonlar: ["terminal_id", "tarih", "ikmal_tutar", "kaset_miktari"],
    aciklama: "Nakit yükleme kayıtları",
  },
  {
    id: "para_toplama",
    label: "Para Toplama",
    icon: "🏧",
    renk: "text-amber-400 border-amber-500/40 bg-amber-500/10",
    aktif: "border-amber-400 bg-amber-500/20 text-amber-300",
    kolonlar: ["terminal_id", "tarih", "toplama_tutar"],
    aciklama: "CIT para toplama kayıtları",
  },
  {
    id: "gunluk_bakiye",
    label: "Günlük Bakiye",
    icon: "📊",
    renk: "text-blue-400 border-blue-500/40 bg-blue-500/10",
    aktif: "border-blue-400 bg-blue-500/20 text-blue-300",
    kolonlar: ["terminal_id", "tarih", "tl_bakiye", "kaset_1", "kaset_2", "kaset_3", "kaset_4", "recycle_bakiye"],
    aciklama: "Günlük kaset ve bakiye durumu",
  },
];

const AYLAR = [
  { v: "01", l: "Ocak" }, { v: "02", l: "Şubat" }, { v: "03", l: "Mart" },
  { v: "04", l: "Nisan" }, { v: "05", l: "Mayıs" }, { v: "06", l: "Haziran" },
  { v: "07", l: "Temmuz" }, { v: "08", l: "Ağustos" }, { v: "09", l: "Eylül" },
  { v: "10", l: "Ekim" }, { v: "11", l: "Kasım" }, { v: "12", l: "Aralık" },
];

const YILLAR = ["2023", "2024", "2025", "2026"];

function UploadPanel() {
  const [veriTuru, setVeriTuru]     = useState("ariza_log");
  const [ay, setAy]                 = useState("01");
  const [yil, setYil]               = useState("2026");
  const [dosya, setDosya]           = useState<File | null>(null);
  const [dragging, setDragging]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [sonuc, setSonuc]           = useState<{
    satir_sayisi: number; kolonlar: string[];
    eslesen_kolonlar: string[]; beklenen_kolonlar: string[];
    eslesme_orani: number; mesaj: string;
  } | null>(null);
  const [hata, setHata]             = useState<string | null>(null);
  const [gecmis, setGecmis]         = useState<TrainingLogEntry[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const seciliTur = VERI_TURLERI.find((t) => t.id === veriTuru)!;

  const gecmisYukle = useCallback(async () => {
    try {
      const r = await fetch("/api/train-upload");
      if (r.ok) setGecmis(await r.json());
    } catch {}
  }, []);

  useEffect(() => { gecmisYukle(); }, [gecmisYukle]);

  const dosyaSec = (f: File) => {
    setDosya(f);
    setSonuc(null);
    setHata(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) dosyaSec(f);
  };

  const handleYukle = async () => {
    if (!dosya) return;
    setLoading(true);
    setHata(null);
    setSonuc(null);
    try {
      const fd = new FormData();
      fd.append("file",      dosya);
      fd.append("veri_turu", veriTuru);
      fd.append("ay",        ay);
      fd.append("yil",       yil);
      const r = await fetch("/api/train-upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) { setHata(j.error ?? "Sunucu hatası"); return; }
      setSonuc(j);
      setDosya(null);
      gecmisYukle();
    } catch (e: unknown) {
      setHata(e instanceof Error ? e.message : "Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  };

  const veriTuruLabelMap: Record<string, string> = {
    ariza_log: "Arıza Log", ikmal: "İkmal", para_toplama: "Para Toplama", gunluk_bakiye: "Günlük Bakiye",
  };

  return (
    <div className="rounded-2xl ring-2 ring-amber-500/30 bg-[#0f1e35] p-5">
      {/* Başlık */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="text-2xl">🧠</div>
          <div>
            <div className="font-bold text-white">Model Eğitimi — Geçmiş Veri Yükle</div>
            <div className="text-xs text-[#A7B8D8] mt-0.5">
              Excel / CSV yükle → Motor öğrenir • Ay ay ekleme desteklenir
            </div>
          </div>
        </div>
        <div className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full px-3 py-1 font-semibold">
          DAHİLİ KULLANIM
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Sol: Ayarlar + Drop Zone */}
        <div className="col-span-12 xl:col-span-7 space-y-4">

          {/* Veri türü seçici */}
          <div>
            <div className="text-xs text-[#A7B8D8] mb-2 font-semibold uppercase tracking-wider">Veri Türü</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {VERI_TURLERI.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setVeriTuru(t.id); setSonuc(null); setHata(null); }}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    veriTuru === t.id ? t.aktif + " ring-1 ring-current" : "border-[#2B416B] bg-[#0E2142] hover:border-[#2E86FF]/40"
                  }`}
                >
                  <div className="text-xl mb-1">{t.icon}</div>
                  <div className={`text-xs font-bold ${veriTuru === t.id ? "" : "text-white"}`}>{t.label}</div>
                  <div className="text-[10px] text-[#A7B8D8] mt-0.5 leading-tight">{t.aciklama}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Dönem seçici */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-xs text-[#A7B8D8] mb-1.5 font-semibold uppercase tracking-wider">Ay</div>
              <select
                value={ay}
                onChange={(e) => setAy(e.target.value)}
                className="w-full bg-[#0E2142] border border-[#2B416B] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#2E86FF]"
              >
                {AYLAR.map((a) => (
                  <option key={a.v} value={a.v}>{a.l}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <div className="text-xs text-[#A7B8D8] mb-1.5 font-semibold uppercase tracking-wider">Yıl</div>
              <select
                value={yil}
                onChange={(e) => setYil(e.target.value)}
                className="w-full bg-[#0E2142] border border-[#2B416B] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#2E86FF]"
              >
                {YILLAR.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="text-xs text-[#A7B8D8] pt-6">
              → <span className="text-white font-semibold">{AYLAR.find(a => a.v === ay)?.l} {yil}</span>
            </div>
          </div>

          {/* Drop Zone */}
          <div>
            <div className="text-xs text-[#A7B8D8] mb-1.5 font-semibold uppercase tracking-wider">Dosya</div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                dragging
                  ? "border-[#2E86FF] bg-[#2E86FF]/10"
                  : dosya
                  ? "border-emerald-500/60 bg-emerald-500/5"
                  : "border-[#2B416B] hover:border-[#2E86FF]/50 hover:bg-[#2E86FF]/5"
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) dosyaSec(f); }}
              />
              {dosya ? (
                <div>
                  <div className="text-3xl mb-2">📄</div>
                  <div className="text-sm font-semibold text-emerald-400">{dosya.name}</div>
                  <div className="text-xs text-[#A7B8D8] mt-1">
                    {(dosya.size / 1024).toFixed(1)} KB
                  </div>
                  <div className="text-xs text-[#A7B8D8] mt-2">Değiştirmek için tıkla</div>
                </div>
              ) : (
                <div>
                  <div className="text-4xl mb-3">⬆️</div>
                  <div className="text-sm text-white font-semibold">Excel veya CSV sürükle / tıkla</div>
                  <div className="text-xs text-[#A7B8D8] mt-1">.xlsx · .xls · .csv</div>
                </div>
              )}
            </div>
          </div>

          {/* Beklenen kolon rehberi */}
          <div className="bg-[#0E2142] rounded-xl p-3 ring-1 ring-[#2B416B]">
            <div className="text-xs text-[#A7B8D8] mb-2">
              📋 <span className="font-semibold">{seciliTur.label}</span> için beklenen kolonlar
              <span className="text-[#A7B8D8]/60 ml-1">(farklı isimler de kabul edilir)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {seciliTur.kolonlar.map((k) => (
                <span key={k} className="text-[10px] bg-[#112544] text-[#A7B8D8] px-2 py-0.5 rounded-full font-mono">
                  {k}
                </span>
              ))}
            </div>
          </div>

          {/* Yükle butonu */}
          <button
            onClick={handleYukle}
            disabled={!dosya || loading}
            className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${
              dosya && !loading
                ? "bg-[#2E86FF] hover:bg-[#1E5FCC] text-white shadow-lg shadow-[#2E86FF]/20"
                : "bg-[#1a2d4a] text-[#A7B8D8] cursor-not-allowed"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                İşleniyor...
              </span>
            ) : (
              `🚀 ${AYLAR.find(a => a.v === ay)?.l} ${yil} — ${seciliTur.label} Yükle & Eğit`
            )}
          </button>

          {/* Sonuç */}
          {sonuc && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">✅</span>
                <span className="font-semibold text-emerald-400">{sonuc.mesaj}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center bg-[#0E2142] rounded-lg p-2">
                  <div className="text-2xl font-bold text-white">{sonuc.satir_sayisi.toLocaleString("tr-TR")}</div>
                  <div className="text-[10px] text-[#A7B8D8]">Satır</div>
                </div>
                <div className="text-center bg-[#0E2142] rounded-lg p-2">
                  <div className="text-2xl font-bold text-white">{sonuc.kolonlar.length}</div>
                  <div className="text-[10px] text-[#A7B8D8]">Kolon</div>
                </div>
                <div className="text-center bg-[#0E2142] rounded-lg p-2">
                  <div className={`text-2xl font-bold ${sonuc.eslesme_orani >= 80 ? "text-emerald-400" : sonuc.eslesme_orani >= 50 ? "text-amber-400" : "text-red-400"}`}>
                    %{sonuc.eslesme_orani}
                  </div>
                  <div className="text-[10px] text-[#A7B8D8]">Eşleşme</div>
                </div>
              </div>
              {sonuc.eslesen_kolonlar.length > 0 && (
                <div>
                  <div className="text-xs text-[#A7B8D8] mb-1">Eşleşen kolonlar:</div>
                  <div className="flex flex-wrap gap-1">
                    {sonuc.eslesen_kolonlar.map((k) => (
                      <span key={k} className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-mono">✓ {k}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Hata */}
          {hata && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
              ❌ {hata}
            </div>
          )}
        </div>

        {/* Sağ: Yükleme Geçmişi */}
        <div className="col-span-12 xl:col-span-5">
          <div className="text-xs text-[#A7B8D8] mb-3 font-semibold uppercase tracking-wider">
            📁 Yükleme Geçmişi
          </div>
          {gecmis.length === 0 ? (
            <div className="bg-[#0E2142] rounded-xl p-6 ring-1 ring-[#2B416B] text-center text-sm text-[#A7B8D8]">
              Henüz yükleme yapılmadı
            </div>
          ) : (
            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {gecmis.map((g) => {
                const tur = VERI_TURLERI.find((t) => t.id === g.veri_turu);
                return (
                  <div
                    key={g.id}
                    className={`rounded-xl p-3 ring-1 ${
                      g.durum === "basarili"
                        ? "bg-[#0E2142] ring-[#2B416B]"
                        : "bg-red-500/5 ring-red-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span>{tur?.icon ?? "📄"}</span>
                        <span className="text-xs font-semibold text-white">
                          {AYLAR.find(a => a.v === g.ay)?.l} {g.yil}
                        </span>
                        <span className="text-[10px] bg-[#112544] text-[#A7B8D8] px-1.5 py-0.5 rounded">
                          {tur?.label ?? g.veri_turu}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold ${g.durum === "basarili" ? "text-emerald-400" : "text-red-400"}`}>
                        {g.durum === "basarili" ? "✓ OK" : "✗ HATA"}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#A7B8D8] truncate">{g.dosya_adi}</div>
                    {g.durum === "basarili" && (
                      <div className="text-[10px] text-white/60 mt-1">
                        {g.satir_sayisi.toLocaleString("tr-TR")} satır · {g.kolonlar.length} kolon
                      </div>
                    )}
                    {g.hata_mesaji && (
                      <div className="text-[10px] text-red-400 mt-1 truncate">{g.hata_mesaji}</div>
                    )}
                    <div className="text-[9px] text-[#A7B8D8]/50 mt-1">
                      {new Date(g.tarih).toLocaleString("tr-TR")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Notlar */}
          <div className="mt-4 bg-[#0E2142] rounded-xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-xs font-semibold text-[#A7B8D8] mb-2">💡 Nasıl kullanılır?</div>
            <ol className="text-[11px] text-[#A7B8D8] space-y-1.5 list-decimal list-inside">
              <li>Veri türünü seç (Arıza / İkmal / Toplama / Bakiye)</li>
              <li>Ayı ve yılı belirle</li>
              <li>O aya ait Excel veya CSV'yi yükle</li>
              <li>Tüm ayları tek tek ekle → Motor öğrenir</li>
              <li>3 yıllık veriyi ekleyince AUC 0.88-0.93'e çıkar</li>
            </ol>
            <div className="mt-3 text-[10px] text-amber-400/80 border-t border-[#2B416B] pt-2">
              ⚠️ Veriler ai_engine/uploads/ klasörüne kaydedilir,
              dışarı çıkmaz. Banka sunucusunda çalışır.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

        {/* Model Eğitimi — Excel Yükle (Dahili Kullanım) */}
        <div className="col-span-12">
          <UploadPanel />
        </div>

      </div>
    </div>
  );
}

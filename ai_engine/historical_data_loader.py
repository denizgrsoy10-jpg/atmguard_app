"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  HISTORICAL DATA LOADER                                                      ║
║  3 Yıllık Geçmiş Veri → Eğitim Seti Dönüştürücü                            ║
║                                                                              ║
║  BANKA VERİSİNİ ALIR:                                                        ║
║    - ariza_log.csv      → Arıza geçmişi (tarih + ATM + kod)                 ║
║    - ikmal.csv          → İkmal geçmişi (tarih + ATM + tutar)               ║
║    - para_toplama.csv   → Toplama geçmişi (tarih + ATM + tutar)             ║
║    - gunluk_bakiye.csv  → Günlük nakit (tarih + ATM + bakiye) [opsiyonel]   ║
║                                                                              ║
║  ÜRETIR:                                                                     ║
║    - X              : ~3,000,000 satır eğitim matrisi                       ║
║    - y_maintenance  : 0/1 — önümüzdeki 7 günde arıza çıkar mı?             ║
║    - y_cash         : saat — bir sonraki iklale kaç saat var?               ║
║                                                                              ║
║  KULLANIM:                                                                   ║
║    python3 historical_data_loader.py \                                       ║
║        --ariza    ariza_log.csv \                                            ║
║        --ikmal    ikmal.csv \                                                ║
║        --toplama  para_toplama.csv \                                         ║
║        --bakiye   gunluk_bakiye.csv                                          ║
║                                                                              ║
║  Sonra:                                                                      ║
║    python3 data_pipeline.py --mode initial --data output/training_set.json  ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import json
import argparse
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple


# ═══════════════════════════════════════════════════════════════════════════════
# 1. VERİ YÜKLEYICILER — Her CSV formatı için esnek parser
# ═══════════════════════════════════════════════════════════════════════════════

# Banka hangi sütun ismini kullanırsa kullansın, bunları eşleştiriyoruz
COLUMN_ALIASES = {
    # ATM kimliği
    'atm_id':        ['terminal_id', 'atm_id', 'atm id', 'terminalid', 'atm_no',
                      'atm no', 'cihaz_id', 'cihaz id', 'makine_id'],
    # Tarih
    'tarih':         ['tarih', 'date', 'datetime', 'islem_tarihi', 'ariza_tarihi',
                      'ikmal_tarihi', 'transaction_date', 'created_at', 'kayit_tarihi'],
    # Arıza
    'ariza_kodu':    ['ariza_kodu', 'fault_code', 'error_code', 'hata_kodu',
                      'ariza_tipi', 'fault_type'],
    'ariza_aciklama':['ariza_aciklama', 'fault_description', 'aciklama',
                      'description', 'hata_aciklama'],
    # İkmal
    'ikmal_tutar':   ['ikmal_tutar', 'ikmal_tutari', 'refill_amount', 'tutar',
                      'toplam_tutar', 'total_amount', 'nakit_tutar'],
    'kaset_1':       ['kaset_1', 'kaset1', 'cassette_1', 'cassette1', 'c1'],
    'kaset_2':       ['kaset_2', 'kaset2', 'cassette_2', 'cassette2', 'c2'],
    'kaset_3':       ['kaset_3', 'kaset3', 'cassette_3', 'cassette3', 'c3'],
    'kaset_4':       ['kaset_4', 'kaset4', 'cassette_4', 'cassette4', 'c4'],
    # Bakiye
    'tl_bakiye':     ['tl_bakiye', 'tl bakiye', 'cash_balance', 'balance',
                      'bakiye', 'nakit_bakiye'],
    # Toplama
    'toplama_tutar': ['toplama_tutar', 'toplanan_tutar', 'collection_amount',
                      'para_toplama', 'collected_amount'],
}


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Sütun isimlerini standart hale getir — hangi format gelirse gelsin."""
    col_map = {}
    df_cols_lower = {c.lower().strip(): c for c in df.columns}

    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias.lower() in df_cols_lower:
                col_map[df_cols_lower[alias.lower()]] = canonical
                break

    return df.rename(columns=col_map)


def _parse_date(series: pd.Series) -> pd.Series:
    """Tarih sütununu datetime'a çevir — farklı formatları destekler."""
    return pd.to_datetime(series, errors='coerce', dayfirst=True)


def load_ariza_log(path: str) -> pd.DataFrame:
    """
    Arıza log dosyasını yükle.

    Beklenen sütunlar (herhangi isimle gelebilir, alias'larla eşleştirilir):
        atm_id | tarih | ariza_kodu | ariza_aciklama
    """
    print(f"  📋 Arıza log yükleniyor: {path}")
    df = pd.read_csv(path, encoding='utf-8-sig') if path.endswith('.csv') \
         else pd.DataFrame(json.load(open(path, encoding='utf-8')))

    df = _normalize_columns(df)

    if 'tarih' not in df.columns:
        raise ValueError(f"Arıza log'da tarih sütunu bulunamadı. Mevcut sütunlar: {df.columns.tolist()}")
    if 'atm_id' not in df.columns:
        raise ValueError(f"Arıza log'da ATM ID sütunu bulunamadı. Mevcut sütunlar: {df.columns.tolist()}")

    df['tarih'] = _parse_date(df['tarih'])
    df = df.dropna(subset=['tarih', 'atm_id'])

    print(f"    ✓ {len(df):,} arıza kaydı yüklendi")
    print(f"    ✓ Tarih aralığı: {df['tarih'].min().date()} → {df['tarih'].max().date()}")
    print(f"    ✓ Benzersiz ATM: {df['atm_id'].nunique()}")

    return df[['atm_id', 'tarih'] + [c for c in ['ariza_kodu', 'ariza_aciklama'] if c in df.columns]]


def load_ikmal(path: str) -> pd.DataFrame:
    """
    İkmal (para yükleme) dosyasını yükle.

    Beklenen sütunlar:
        atm_id | tarih | ikmal_tutar | kaset_1..4
    """
    print(f"  💰 İkmal geçmişi yükleniyor: {path}")
    df = pd.read_csv(path, encoding='utf-8-sig') if path.endswith('.csv') \
         else pd.DataFrame(json.load(open(path, encoding='utf-8')))

    df = _normalize_columns(df)
    df['tarih'] = _parse_date(df['tarih'])
    df = df.dropna(subset=['tarih', 'atm_id'])

    for col in ['ikmal_tutar', 'kaset_1', 'kaset_2', 'kaset_3', 'kaset_4']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    print(f"    ✓ {len(df):,} ikmal kaydı yüklendi")
    print(f"    ✓ Tarih aralığı: {df['tarih'].min().date()} → {df['tarih'].max().date()}")

    return df


def load_para_toplama(path: str) -> pd.DataFrame:
    """Para toplama geçmişini yükle."""
    print(f"  🏦 Para toplama geçmişi yükleniyor: {path}")
    df = pd.read_csv(path, encoding='utf-8-sig') if path.endswith('.csv') \
         else pd.DataFrame(json.load(open(path, encoding='utf-8')))

    df = _normalize_columns(df)
    df['tarih'] = _parse_date(df['tarih'])
    df = df.dropna(subset=['tarih', 'atm_id'])

    if 'toplama_tutar' in df.columns:
        df['toplama_tutar'] = pd.to_numeric(df['toplama_tutar'], errors='coerce').fillna(0)

    print(f"    ✓ {len(df):,} toplama kaydı yüklendi")

    return df


def load_gunluk_bakiye(path: str) -> pd.DataFrame:
    """
    Günlük bakiye dosyasını yükle (opsiyonel — varsa çok daha güçlü model).
    
    Bu dosya varsa bakiye tahmini çok daha iyi olur çünkü her günün
    gerçek bakiyesi elimizde olur.
    """
    print(f"  📊 Günlük bakiye yükleniyor: {path}")
    df = pd.read_csv(path, encoding='utf-8-sig') if path.endswith('.csv') \
         else pd.DataFrame(json.load(open(path, encoding='utf-8')))

    df = _normalize_columns(df)
    df['tarih'] = _parse_date(df['tarih'])
    df = df.dropna(subset=['tarih', 'atm_id'])

    for col in ['tl_bakiye', 'kaset_1', 'kaset_2', 'kaset_3', 'kaset_4']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    print(f"    ✓ {len(df):,} günlük bakiye kaydı yüklendi")
    print(f"    ✓ Tarih aralığı: {df['tarih'].min().date()} → {df['tarih'].max().date()}")

    return df


# ═══════════════════════════════════════════════════════════════════════════════
# 2. ZAMAN PENCERESİ ETİKETLEME — En kritik adım
# ═══════════════════════════════════════════════════════════════════════════════

def create_training_windows(
    df_ariza: pd.DataFrame,
    df_ikmal: pd.DataFrame,
    df_toplama: Optional[pd.DataFrame] = None,
    df_bakiye:  Optional[pd.DataFrame] = None,
    horizon_days: int = 7,        # Kaç gün öncesinden arıza tahmin edilsin?
    step_days: int = 1,           # Kaç günde bir eğitim örneği üretilsin?
    min_history_days: int = 14,   # Öznitelik hesaplamak için minimum geçmiş
) -> pd.DataFrame:
    """
    ════════════════════════════════════════════════════════════════
    MAJİK FONKSİYON — Geçmiş veriyi ML eğitim setine dönüştürür
    ════════════════════════════════════════════════════════════════

    Mantık:
        Her ATM için, her tarih T için:
        - X (öznitelikler)   = T gününden ÖNCEKI 14 günün istatistikleri
        - y_maintenance      = T + 1..7 gün içinde arıza var mı?  (0/1)
        - y_cash             = Bir sonraki iklale kaç saat kaldı?

    Örnek:
        ATM T-00123, Tarih 2023-06-01:
          X = son 14 günde ortalama ikmal tutarı, ikmal sıklığı, arıza sayısı...
          y_maintenance = 1  (çünkü 2023-06-05'te arıza kaydı var)
          y_cash = 72 saat   (çünkü 2023-06-04'te ikmal yapılmış)

    Bu yaklaşımla 3 yıl × 2771 ATM × 365 gün ≈ 3,000,000 örnek üretilir.
    """
    print("\n🔧 Zaman penceresi etiketleme başlıyor...")
    print(f"   Tahmin ufku    : {horizon_days} gün")
    print(f"   Adım büyüklüğü : {step_days} gün")

    all_atms = set(df_ariza['atm_id'].unique()) | set(df_ikmal['atm_id'].unique())
    print(f"   Toplam ATM     : {len(all_atms)}")

    # Tüm tarihleri belirle
    all_dates = pd.concat([df_ariza['tarih'], df_ikmal['tarih']]).dropna()
    date_min = all_dates.min().date()
    date_max = all_dates.max().date()
    print(f"   Tarih aralığı  : {date_min} → {date_max}")
    total_days = (date_max - date_min).days
    print(f"   Toplam gün     : {total_days}")
    est_rows = len(all_atms) * (total_days // step_days)
    print(f"   Tahmini satır  : {est_rows:,}")
    print()

    rows = []
    processed = 0

    for atm_id in all_atms:
        # Bu ATM'e ait kayıtları filtrele
        atm_ariza  = df_ariza[df_ariza['atm_id'] == atm_id].copy()
        atm_ikmal  = df_ikmal[df_ikmal['atm_id'] == atm_id].copy()
        atm_toplama= df_toplama[df_toplama['atm_id'] == atm_id].copy() if df_toplama is not None else pd.DataFrame()
        atm_bakiye = df_bakiye[df_bakiye['atm_id'] == atm_id].copy() if df_bakiye is not None else pd.DataFrame()

        # En az 1 kayıt olmayan ATM'leri atla
        if len(atm_ikmal) == 0:
            continue

        # Bu ATM için geçerli tarih aralığı
        atm_start = max(
            date_min + timedelta(days=min_history_days),
            atm_ikmal['tarih'].min().date() + timedelta(days=min_history_days)
        )
        atm_end = min(date_max - timedelta(days=horizon_days),
                      (atm_ikmal['tarih'].max() + timedelta(days=30)).date())

        current_date = atm_start
        while current_date <= atm_end:
            t = pd.Timestamp(current_date)
            t_start = t - timedelta(days=min_history_days)

            # ── ÖZNITELIKLER (X): T gününden önceki 14 günün özeti ──────────

            # İkmal öznitelikleri
            recent_ikmal = atm_ikmal[
                (atm_ikmal['tarih'] >= t_start) &
                (atm_ikmal['tarih'] < t)
            ]
            ikmal_sayisi   = len(recent_ikmal)
            ikmal_ort_tutar = float(recent_ikmal['ikmal_tutar'].mean()) if 'ikmal_tutar' in recent_ikmal.columns and ikmal_sayisi > 0 else 0.0
            son_ikmalden_gun= (t - atm_ikmal[atm_ikmal['tarih'] < t]['tarih'].max()).days \
                              if len(atm_ikmal[atm_ikmal['tarih'] < t]) > 0 else 999

            # Arıza öznitelikleri (geçmiş)
            recent_ariza = atm_ariza[
                (atm_ariza['tarih'] >= t_start) &
                (atm_ariza['tarih'] < t)
            ]
            son_14gun_ariza_sayisi = len(recent_ariza)
            son_ariza_gun = (t - atm_ariza[atm_ariza['tarih'] < t]['tarih'].max()).days \
                            if len(atm_ariza[atm_ariza['tarih'] < t]) > 0 else 999

            # Para toplama öznitelikleri
            toplama_sayisi = 0
            if len(atm_toplama) > 0:
                recent_top = atm_toplama[
                    (atm_toplama['tarih'] >= t_start) &
                    (atm_toplama['tarih'] < t)
                ]
                toplama_sayisi = len(recent_top)

            # Günlük bakiye (varsa)
            gunluk_bakiye = 0.0
            if len(atm_bakiye) > 0:
                bakiye_row = atm_bakiye[atm_bakiye['tarih'] <= t]
                if len(bakiye_row) > 0:
                    latest = bakiye_row.sort_values('tarih').iloc[-1]
                    gunluk_bakiye = float(latest.get('tl_bakiye', 0))

            # Zaman öznitelikleri
            dow = t.dayofweek   # 0=Pazartesi, 6=Pazar
            is_weekend = 1 if dow >= 5 else 0
            month = t.month

            # ── ETIKETLER (y): T'den sonraki N gün ──────────────────────────

            # y_maintenance: horizon_days içinde arıza çıkacak mı?
            future_ariza = atm_ariza[
                (atm_ariza['tarih'] >= t) &
                (atm_ariza['tarih'] < t + timedelta(days=horizon_days))
            ]
            y_maintenance = 1 if len(future_ariza) > 0 else 0

            # y_cash: bir sonraki iklale kaç saat var?
            future_ikmal = atm_ikmal[atm_ikmal['tarih'] > t]
            if len(future_ikmal) > 0:
                next_ikmal = future_ikmal['tarih'].min()
                hours_to_ikmal = (next_ikmal - t).total_seconds() / 3600
                y_cash = min(float(hours_to_ikmal), 720)  # max 30 gün
            else:
                y_cash = 720  # Gelecekte ikmal yok → modele 30 gün ver

            # ── SATIR EKLE ───────────────────────────────────────────────────
            rows.append({
                'atm_id'                  : atm_id,
                'tarih'                   : current_date.isoformat(),
                'ikmal_sayisi_14gun'      : ikmal_sayisi,
                'ikmal_ort_tutar'         : ikmal_ort_tutar,
                'son_ikmalden_gun'        : son_ikmalden_gun,
                'ariza_sayisi_14gun'      : son_14gun_ariza_sayisi,
                'son_arizadan_gun'        : son_ariza_gun,
                'toplama_sayisi_14gun'    : toplama_sayisi,
                'gunluk_bakiye'           : gunluk_bakiye,
                'day_of_week'             : dow,
                'is_weekend'              : is_weekend,
                'month'                   : month,
                'y_maintenance'           : y_maintenance,
                'y_cash'                  : y_cash,
            })

            current_date += timedelta(days=step_days)

        processed += 1
        if processed % 200 == 0:
            print(f"   [{processed}/{len(all_atms)}] ATM işlendi, {len(rows):,} satır üretildi...")

    df_result = pd.DataFrame(rows)
    print(f"\n✅ Zaman penceresi etiketleme tamamlandı")
    print(f"   Toplam eğitim satırı : {len(df_result):,}")
    print(f"   Arıza oranı          : {df_result['y_maintenance'].mean():.1%}")
    print(f"   Ort. y_cash          : {df_result['y_cash'].mean():.1f} saat")

    return df_result


# ═══════════════════════════════════════════════════════════════════════════════
# 3. ÖZNİTELİK MATRİSİ HAZIRLA — Tarihi veride ek öznitelikler
# ═══════════════════════════════════════════════════════════════════════════════

def build_historical_feature_matrix(df_windows: pd.DataFrame):
    """
    Zaman penceresinden üretilen satırları ML matrisine çevir.
    data_pipeline.build_feature_matrix() ile aynı interface.
    """
    print("\n🔧 Tarihi feature matrix oluşturuluyor...")

    feature_names = [
        'ikmal_sayisi_14gun',
        'ikmal_ort_tutar',
        'son_ikmalden_gun',
        'ariza_sayisi_14gun',
        'son_arizadan_gun',
        'toplama_sayisi_14gun',
        'gunluk_bakiye',
        'day_of_week',
        'is_weekend',
        'month',
    ]

    # Eksik sütunları 0 ile doldur
    for col in feature_names:
        if col not in df_windows.columns:
            df_windows[col] = 0

    X = df_windows[feature_names].fillna(0).values.astype('float32')
    y_maintenance = df_windows['y_maintenance'].values.astype('int32')
    y_cash = df_windows['y_cash'].values.astype('float32')

    print(f"  ✓ X shape          : {X.shape}")
    print(f"  ✓ Arıza oranı      : {y_maintenance.mean():.1%}")
    print(f"  ✓ Ort. y_cash      : {y_cash.mean():.1f} saat")
    print(f"  ✓ Öznitelik sayısı : {len(feature_names)}")

    return X, y_maintenance, y_cash, feature_names


# ═══════════════════════════════════════════════════════════════════════════════
# 4. TAMAMI ÇALIŞTIR — Yükle → Dönüştür → Eğit
# ═══════════════════════════════════════════════════════════════════════════════

def run_full_historical_training(
    ariza_path:    str,
    ikmal_path:    str,
    toplama_path:  Optional[str] = None,
    bakiye_path:   Optional[str] = None,
    horizon_days:  int = 7,
    output_dir:    str = './models/prophet_predictor/v1.0.0',
):
    """
    TEK FONKSİYONLA TAMAMI:
    1. Ham CSV dosyalarını yükle
    2. Zaman penceresi etiketleme yap
    3. Feature matrix oluştur
    4. IronCladEngine'i eğit
    5. IronCladEngineV2 (ensemble) eğit
    6. Her ikisini de kaydet

    Args:
        ariza_path    : ariza_log.csv yolu
        ikmal_path    : ikmal.csv yolu
        toplama_path  : para_toplama.csv yolu (opsiyonel)
        bakiye_path   : gunluk_bakiye.csv yolu (opsiyonel ama çok değerli!)
        horizon_days  : kaç gün öncesinden arıza tahmin edilsin (varsayılan: 7)
        output_dir    : model kayıt dizini
    """
    print("=" * 70)
    print("🚀 TAM TARİHİ VERİ EĞİTİM PIPELINE'I BAŞLIYOR")
    print("=" * 70)

    # 1. Yükle
    print("\n📂 ADIM 1: Veri yükleniyor...")
    df_ariza   = load_ariza_log(ariza_path)
    df_ikmal   = load_ikmal(ikmal_path)
    df_toplama = load_para_toplama(toplama_path) if toplama_path else None
    df_bakiye  = load_gunluk_bakiye(bakiye_path) if bakiye_path else None

    # 2. Zaman penceresi etiketleme
    print("\n⏱️  ADIM 2: Zaman penceresi etiketleme...")
    df_windows = create_training_windows(
        df_ariza=df_ariza,
        df_ikmal=df_ikmal,
        df_toplama=df_toplama,
        df_bakiye=df_bakiye,
        horizon_days=horizon_days,
    )

    # 3. Feature matrix
    print("\n🔧 ADIM 3: Feature matrix...")
    X, y_maint, y_cash, feat_names = build_historical_feature_matrix(df_windows)

    # 4. IronClad V1 eğit (XGBoost — hızlı, production)
    print("\n🤖 ADIM 4: IronClad V1 (XGBoost) eğitiliyor...")
    from ironclad_production import IronCladEngine
    engine_v1 = IronCladEngine(model_dir=output_dir)
    metrics_v1 = engine_v1.train_initial(X, y_maint, y_cash, feat_names)

    # 5. IronClad V2 eğit (Ensemble — daha güçlü)
    print("\n🏆 ADIM 5: IronClad V2 (XGBoost+LightGBM+CatBoost) eğitiliyor...")
    df_v2 = pd.DataFrame(X, columns=feat_names)
    df_v2['y_maintenance']   = y_maint
    df_v2['y_cash_hours']    = y_cash
    df_v2['y_deposit_hours'] = y_cash * 0.8

    from ironclad_engine_v2 import IronCladEngineV2
    engine_v2 = IronCladEngineV2(
        model_dir=str(Path(output_dir).parent / 'v2'),
        use_optuna=True,    # Artık gerçek veri var — Optuna açık!
        optuna_trials=50,
    )
    metrics_v2 = engine_v2.train(
        df=df_v2,
        feature_cols=feat_names,
        target_failure='y_maintenance',
        target_cash_hours='y_cash_hours',
        target_deposit_hours='y_deposit_hours',
        optimize_hyperparams=True,
    )

    # 6. Özet
    print("\n" + "=" * 70)
    print("🏁 TARİHİ EĞİTİM TAMAMLANDI")
    print("=" * 70)
    print(f"\n  Toplam eğitim örneği  : {len(X):,}")
    print(f"\n  V1 (XGBoost):")
    print(f"    Eğitim örnekleri    : {metrics_v1['training_samples']:,}")
    print(f"\n  V2 (Ensemble):")
    print(f"    Accuracy            : {metrics_v2['failure_accuracy']:.1%}")
    print(f"    AUC-ROC             : {metrics_v2['failure_auc']:.4f}")
    print(f"    Recall (arıza)      : {metrics_v2['failure_recall']:.1%}")
    print(f"    F1-Score            : {metrics_v2['failure_f1']:.4f}")
    print(f"    Nakit MAE           : {metrics_v2['cash_mae']:.1f} saat")
    print("=" * 70)
    print("\n✅ Sistem artık 3 yıllık deneyimle karar veriyor!")

    return metrics_v1, metrics_v2


# ═══════════════════════════════════════════════════════════════════════════════
# 5. DEMO — Gerçek veri gelmeden önce sentetik test
# ═══════════════════════════════════════════════════════════════════════════════

def generate_synthetic_demo(n_atms: int = 50, n_days: int = 90):
    """
    Banka verisi gelmeden önce sistemi test etmek için
    gerçekçi sentetik geçmiş veri üretir.

    SADECE TEST AMAÇLI — Gerçek veri gelince bu kullanılmaz.
    """
    print(f"\n🧪 Sentetik demo verisi üretiliyor: {n_atms} ATM × {n_days} gün...")

    import random
    random.seed(42)
    np.random.seed(42)

    atm_ids = [f"T-{i:05d}" for i in range(1, n_atms + 1)]
    base_date = datetime(2025, 1, 1)

    ariza_rows, ikmal_rows, toplama_rows = [], [], []

    for atm_id in atm_ids:
        # Her ATM için farklı karakteristikler
        ariza_freq  = random.choice([0.05, 0.10, 0.20, 0.30])   # günlük arıza olasılığı
        ikmal_freq  = random.randint(7, 21)                       # kaç günde bir ikmal
        ikmal_tutar = random.randint(200, 800) * 1000             # 200K-800K TL

        for day in range(n_days):
            tarih = base_date + timedelta(days=day)

            # Arıza kaydı
            if random.random() < ariza_freq:
                kodlar = ['CCDM_JAM', 'EPP_FAIL', 'PRINTER_ERROR', 'CARD_JAM',
                          'NETWORK_DOWN', 'DISPENSER_FAIL']
                ariza_rows.append({
                    'terminal_id': atm_id,
                    'tarih': tarih.strftime('%Y-%m-%d'),
                    'ariza_kodu': random.choice(kodlar),
                })

            # İkmal kaydı
            if day % ikmal_freq == 0:
                noise = np.random.normal(1.0, 0.15)
                ikmal_rows.append({
                    'terminal_id': atm_id,
                    'tarih': tarih.strftime('%Y-%m-%d'),
                    'ikmal_tutar': int(ikmal_tutar * noise),
                    'kaset_1': int(ikmal_tutar * noise * 0.5),
                    'kaset_2': int(ikmal_tutar * noise * 0.3),
                    'kaset_3': int(ikmal_tutar * noise * 0.2),
                })

            # Para toplama (her 14 günde bir yaklaşık)
            if day % 14 == 7:
                toplama_rows.append({
                    'terminal_id': atm_id,
                    'tarih': tarih.strftime('%Y-%m-%d'),
                    'toplama_tutar': int(ikmal_tutar * 0.6 * np.random.normal(1.0, 0.1)),
                })

    df_ariza   = pd.DataFrame(ariza_rows)
    df_ikmal   = pd.DataFrame(ikmal_rows)
    df_toplama = pd.DataFrame(toplama_rows)

    # CSV olarak kaydet
    Path('demo_data').mkdir(exist_ok=True)
    df_ariza.to_csv('demo_data/ariza_log.csv',    index=False)
    df_ikmal.to_csv('demo_data/ikmal.csv',        index=False)
    df_toplama.to_csv('demo_data/para_toplama.csv', index=False)

    print(f"  ✓ {len(df_ariza):,}  arıza kaydı  → demo_data/ariza_log.csv")
    print(f"  ✓ {len(df_ikmal):,}  ikmal kaydı  → demo_data/ikmal.csv")
    print(f"  ✓ {len(df_toplama):,}  toplama kaydı→ demo_data/para_toplama.csv")

    return 'demo_data/ariza_log.csv', 'demo_data/ikmal.csv', 'demo_data/para_toplama.csv'


# ═══════════════════════════════════════════════════════════════════════════════
# ANA AKIŞ
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='ATM Guard Historical Data Loader')
    parser.add_argument('--ariza',    default=None, help='Arıza log CSV yolu')
    parser.add_argument('--ikmal',    default=None, help='İkmal geçmiş CSV yolu')
    parser.add_argument('--toplama',  default=None, help='Para toplama CSV yolu (opsiyonel)')
    parser.add_argument('--bakiye',   default=None, help='Günlük bakiye CSV yolu (opsiyonel)')
    parser.add_argument('--horizon',  default=7,   type=int, help='Tahmin ufku (gün)')
    parser.add_argument('--demo',     action='store_true',   help='Sentetik demo veri ile test')
    args = parser.parse_args()

    if args.demo or (args.ariza is None and args.ikmal is None):
        # ──────────────────────────────────────────────────────────────────────
        # DEMO MODU — Gerçek veri gelmeden önce sistemi test et
        # Çalıştır: python3 historical_data_loader.py --demo
        # ──────────────────────────────────────────────────────────────────────
        print("\n🧪 DEMO MODU — Sentetik veri ile sistem testi")
        ariza_p, ikmal_p, toplama_p = generate_synthetic_demo(n_atms=100, n_days=365)
        run_full_historical_training(
            ariza_path=ariza_p,
            ikmal_path=ikmal_p,
            toplama_path=toplama_p,
            horizon_days=args.horizon,
        )
    else:
        # ──────────────────────────────────────────────────────────────────────
        # GERÇEK MOD — Banka CSV dosyalarını ver
        # Çalıştır:
        #   python3 historical_data_loader.py \
        #       --ariza    /path/to/ariza_log.csv \
        #       --ikmal    /path/to/ikmal.csv \
        #       --toplama  /path/to/para_toplama.csv \
        #       --bakiye   /path/to/gunluk_bakiye.csv \
        #       --horizon  7
        # ──────────────────────────────────────────────────────────────────────
        run_full_historical_training(
            ariza_path=args.ariza,
            ikmal_path=args.ikmal,
            toplama_path=args.toplama,
            bakiye_path=args.bakiye,
            horizon_days=args.horizon,
        )

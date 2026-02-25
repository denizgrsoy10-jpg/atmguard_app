"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  DATA PIPELINE — Banka Verisi → Feature Matrix → Model Eğitimi             ║
║                                                                              ║
║  KULLANIM:                                                                   ║
║                                                                              ║
║  1) İLK EĞİTİM (tüm tarihi veriyi ver):                                     ║
║     python3 data_pipeline.py --mode initial --data banka_verisi.json        ║
║                                                                              ║
║  2) GÜNLÜK GÜNCELLEME (sadece yeni günün verisini ver):                     ║
║     python3 data_pipeline.py --mode incremental --data bugun.json           ║
║                                                                              ║
║  3) TAHMİN AL:                                                               ║
║     python3 data_pipeline.py --mode predict --atm T-00123                   ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import json
import numpy as np
import pandas as pd
import argparse
from datetime import datetime
from pathlib import Path
from typing import Tuple, List, Dict, Any


# ═══════════════════════════════════════════════════════════════════════════════
# ADIM 1: VERİYİ YÜKLE VE NORMALİZE ET
# ═══════════════════════════════════════════════════════════════════════════════

def load_and_normalize(data_path: str) -> pd.DataFrame:
    """
    Ham JSON/CSV bankası verisini yükle ve normalize et.

    Desteklenen formatlar:
    - kasa_durum_raporu.json (mevcut format)
    - banka_data.json (terminal_id formatı — bank_data_adapter kullanır)
    - CSV dosyaları
    """
    path = Path(data_path)
    print(f"\n📂 Veri yükleniyor: {path}")

    # Banka formatı mı (terminal_id) yoksa mevcut format mı?
    if path.suffix == '.csv':
        df = pd.read_csv(data_path, encoding='utf-8-sig')
    else:
        with open(data_path, 'r', encoding='utf-8') as f:
            raw = json.load(f)

        # Banka formatı tespiti
        if isinstance(raw, list) and raw and 'terminal_id' in raw[0]:
            print("  → Banka formatı tespit edildi (terminal_id), adaptör kullanılıyor...")
            from bank_data_adapter import BankDataAdapter
            adapter = BankDataAdapter(format_type='BANK')
            normalized = adapter.normalize_list(raw)
            df = pd.DataFrame(normalized)
        else:
            df = pd.DataFrame(raw)

    print(f"  ✓ {len(df)} ATM yüklendi, {len(df.columns)} sütun")
    return df


# ═══════════════════════════════════════════════════════════════════════════════
# ADIM 2: FEATURE ENGINEERING — Ham Veri → ML Öznitelikleri
# ═══════════════════════════════════════════════════════════════════════════════

def build_feature_matrix(df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray, np.ndarray, List[str]]:
    """
    DataFrame'den model eğitimi için X, y_maintenance, y_cash üret.

    Döndürür:
        X              : (n_atm, n_features) — giriş öznitelikleri
        y_maintenance  : (n_atm,) — 0=Sağlıklı, 1=Arıza riski
        y_cash         : (n_atm,) — kaç saat sonra boşalacak (tahmin hedefi)
        feature_names  : öznitelik isimleri listesi
    """
    print("\n🔧 Feature matrix oluşturuluyor...")

    df = df.copy()

    # ── Sütun isimlerini temizle ──────────────────────────────────────────────
    # Hem banka formatı hem mevcut format isimleri destekleniyor
    rename_map = {
        'ATM ID': 'atm_id',
        'TL Bakiye': 'tl_bakiye',
        'Recycle Bakiye': 'recycle_bakiye',
        'Zone': 'zone',
        'Kaset 1': 'kaset_1', 'Kaset 2': 'kaset_2',
        'Kaset 3': 'kaset_3', 'Kaset 4': 'kaset_4',
        'Arıza Açıklaması': 'ariza',
        'Açık Arıza Kaydı Var mı?': 'ariza_var',
        'Arıza Türü': 'ariza_turu',
        '1 Salı Çeken': 'w1', '2 Çarşamba Çeken': 'w2',
        '3 Perşembe Çeken': 'w3', '4 Cuma Çeken': 'w4',
        '5 Cumartesi Çeken': 'w5', '6 Pazar Çeken': 'w6',
        '7 Pazartesi Çeken': 'w7', '8 Salı Çeken': 'w8',
        '1 Salı Yatan': 'd1', '2 Çarşamba Yatan': 'd2',
        '3 Perşembe Yatan': 'd3', '4 Cuma Yatan': 'd4',
        '5 Cumartesi Yatan': 'd5', '6 Pazar Yatan': 'd6',
        '7 Pazartesi Yatan': 'd7', '8 Salı Yatan': 'd8',
    }
    df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns}, inplace=True)

    # ── Numerik dönüşümler ────────────────────────────────────────────────────
    num_cols = ['tl_bakiye', 'recycle_bakiye', 'zone',
                'kaset_1', 'kaset_2', 'kaset_3', 'kaset_4',
                'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8',
                'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8']

    for col in num_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        else:
            df[col] = 0  # Sütun yoksa 0 ile doldur

    # ── Türetilmiş öznitelikler ───────────────────────────────────────────────
    withdrawal_cols = [f'w{i}' for i in range(1, 9)]
    deposit_cols    = [f'd{i}' for i in range(1, 9)]

    df['avg_withdrawal']     = df[withdrawal_cols].mean(axis=1)
    df['std_withdrawal']     = df[withdrawal_cols].std(axis=1).fillna(0)
    df['avg_deposit']        = df[deposit_cols].mean(axis=1)
    df['withdrawal_trend']   = df[['w6', 'w7', 'w8']].mean(axis=1) - df[['w1', 'w2', 'w3']].mean(axis=1)
    df['deposit_ratio']      = df['avg_deposit'] / (df['avg_withdrawal'] + 1)
    df['net_flow']           = df['avg_deposit'] - df['avg_withdrawal']
    df['volatility']         = df['std_withdrawal'] / (df['avg_withdrawal'] + 1)
    df['weekend_factor']     = df[['w5', 'w6']].mean(axis=1) / (df[['w3', 'w4', 'w7']].mean(axis=1) + 1)
    df['total_kaset']        = df[['kaset_1', 'kaset_2', 'kaset_3', 'kaset_4']].sum(axis=1)
    df['recycle_ratio']      = df['recycle_bakiye'] / (df['tl_bakiye'] + 1)
    df['cash_coverage_days'] = df['tl_bakiye'] / (df['avg_withdrawal'] + 1)

    # ── HEDEF 1: y_maintenance (Arıza riski) ─────────────────────────────────
    # Kural: "Arıza kaydı var mı?" = Evet → 1, hayır → 0
    if 'ariza_var' in df.columns:
        df['y_maintenance'] = df['ariza_var'].apply(
            lambda x: 1 if str(x).lower() in ['evet', 'yes', '1', 'true'] else 0
        )
    elif 'ariza' in df.columns:
        # Arıza açıklaması boş değilse → 1
        df['y_maintenance'] = df['ariza'].apply(
            lambda x: 0 if (pd.isna(x) or str(x).strip() in ['-', '', 'nan']) else 1
        )
    else:
        df['y_maintenance'] = 0  # Bilinmiyor → 0

    # ── HEDEF 2: y_cash (Kaç saat sonra boşalır) ─────────────────────────────
    # Formül: mevcut bakiye / günlük ortalama çekim × 24 saat
    df['y_cash'] = (df['tl_bakiye'] / (df['avg_withdrawal'] / 24 + 1)).clip(upper=720)
    # Bakiye=0 olan ATM'ler zaten boş demek — kritik (8 saat = acil müdahale eşiği)
    # Sıfır bırakmak regresyonu bozar, minimum 0.5 saat ata
    df['y_cash'] = df['y_cash'].clip(lower=0.5)
    # Not: 720 = 30 gün — makul üst sınır

    # ── Final öznitelik listesi ───────────────────────────────────────────────
    feature_names = [
        'tl_bakiye', 'recycle_bakiye', 'zone',
        'kaset_1', 'kaset_2', 'kaset_3', 'kaset_4',
        'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8',
        'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8',
        'avg_withdrawal', 'std_withdrawal', 'avg_deposit',
        'withdrawal_trend', 'deposit_ratio', 'net_flow',
        'volatility', 'weekend_factor', 'total_kaset',
        'recycle_ratio', 'cash_coverage_days',
    ]

    # Eksik sütunları 0 ile tamamla
    for col in feature_names:
        if col not in df.columns:
            df[col] = 0

    X = df[feature_names].values.astype(np.float32)
    y_maintenance = df['y_maintenance'].values.astype(np.int32)
    y_cash = df['y_cash'].values.astype(np.float32)

    print(f"  ✓ X shape     : {X.shape}")
    print(f"  ✓ Arıza oranı : {y_maintenance.mean():.1%}  ({y_maintenance.sum()} ATM arızalı)")
    print(f"  ✓ y_cash ort  : {y_cash.mean():.1f} saat ({y_cash.mean()/24:.1f} gün)")

    return X, y_maintenance, y_cash, feature_names


# ═══════════════════════════════════════════════════════════════════════════════
# ADIM 3A: İLK EĞİTİM
# ═══════════════════════════════════════════════════════════════════════════════

def run_initial_training(data_path: str):
    """
    Tüm veriyi ver → modelleri sıfırdan eğit → kaydet.
    Sadece bir kez çalıştırılır.
    """
    print("\n" + "="*70)
    print("🚀 İLK EĞİTİM BAŞLIYOR")
    print("="*70)

    df = load_and_normalize(data_path)
    X, y_maintenance, y_cash, feature_names = build_feature_matrix(df)

    from ironclad_production import IronCladEngine
    engine = IronCladEngine(model_dir='./models/prophet_predictor/v1.0.0')
    metrics = engine.train_initial(X, y_maintenance, y_cash, feature_names)

    print("\n" + "="*70)
    print("✅ EĞİTİM TAMAMLANDI")
    print(f"   Eğitim örnekleri : {metrics['training_samples']}")
    print(f"   Maintenance model: {metrics['maintenance_model_size']:,} byte")
    print(f"   Cash model       : {metrics['cash_model_size']:,} byte")
    print("="*70)

    return metrics


# ═══════════════════════════════════════════════════════════════════════════════
# ADIM 3B: GÜNLÜK ARTIRIMLI GÜNCELLEME
# ═══════════════════════════════════════════════════════════════════════════════

def run_incremental_update(data_path: str):
    """
    Sadece yeni günün verisini ver → mevcut modeli güncelle.
    Her gün otomatik çalıştırılır (ai_brain_scheduler ile).
    """
    print("\n" + "="*70)
    print("🔄 GÜNLÜK ARTIMLI GÜNCELLEME")
    print("="*70)

    df = load_and_normalize(data_path)
    X_new, y_maint_new, y_cash_new, _ = build_feature_matrix(df)

    from ironclad_production import IronCladEngine
    engine = IronCladEngine(model_dir='./models/prophet_predictor/v1.0.0')

    if engine.model_maintenance is None:
        print("⚠️  Model yok. Önce: python3 data_pipeline.py --mode initial")
        return

    metrics = engine.train_incremental(X_new, y_maint_new, y_cash_new)

    print("\n✅ GÜNCELLEME TAMAMLANDI")
    print(f"   Yeni örnek sayısı: {metrics['new_samples_processed']}")
    print(f"   Toplam öğrenilen : {metrics['total_samples']}")
    print(f"   Güncelleme zamanı: {metrics['updated_at']}")

    return metrics


# ═══════════════════════════════════════════════════════════════════════════════
# ADIM 3C: TEK ATM İÇİN TAHMİN
# ═══════════════════════════════════════════════════════════════════════════════

def run_predict(data_path: str, atm_id: str = None):
    """
    Eğitilmiş modelle tahmin al ve karar üret.
    """
    print("\n" + "="*70)
    print("🎯 TAHMİN & KARAR MOTORU")
    print("="*70)

    df = load_and_normalize(data_path)
    X, _, _, feature_names = build_feature_matrix(df)

    from ironclad_production import IronCladEngine
    engine = IronCladEngine(model_dir='./models/prophet_predictor/v1.0.0')

    if engine.model_maintenance is None:
        print("⚠️  Model yok. Önce eğitim yapın.")
        return

    preds = engine.predict(X)

    # Her ATM için karar üret
    results = []
    for i, row in df.iterrows():
        atm = str(row.get('atm_id', row.get('ATM ID', f'ATM_{i}')))
        if atm_id and atm != atm_id:
            continue

        maint_prob = float(preds['maintenance_prob'][i])
        cash_hours = float(preds['cash_hours'][i])

        context = {
            'atm_id'              : atm,
            'location_type'       : 'Offsite',
            'zone'                : int(row.get('zone', 2)),
            'is_cit_en_route'     : False,
            'fault_type'          : row.get('ariza_turu', None),
            'current_time'        : datetime.now(),
            'branch_staff_available': False,
            'deposit_bin_level'   : 0.0,
            'reject_bin_level'    : 0.0,
            'security_level'      : 'High',
        }

        decision = engine.decide_operational_action(maint_prob, cash_hours, context)
        results.append(decision)

        print(f"\n🏧 {atm}")
        print(f"   Arıza riski  : {maint_prob:.1%}")
        print(f"   Nakit süresi : {cash_hours:.1f} saat ({cash_hours/24:.1f} gün)")
        print(f"   Karar        : {decision['action']}")
        print(f"   Takım        : {decision['assigned_team']}")
        print(f"   Maliyet      : {decision['estimated_cost']} TL")
        print(f"   Tasarruf     : {decision['estimated_savings']} TL")
        if decision['reasoning']:
            print(f"   Sebep        : {decision['reasoning'][0]}")

    print(f"\n✅ Toplam karar: {len(results)} ATM işlendi")
    return results


# ═══════════════════════════════════════════════════════════════════════════════
# ANA AKIŞ
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='ATM Guard Data Pipeline')
    parser.add_argument('--mode', choices=['initial', 'incremental', 'predict'],
                        default='initial', help='Çalışma modu')
    parser.add_argument('--data', default='../kasa_durum_raporu.json',
                        help='Veri dosyası yolu (JSON veya CSV)')
    parser.add_argument('--atm', default=None,
                        help='Predict modunda tek ATM ID (boş = hepsi)')
    args = parser.parse_args()

    print(f"""
╔══════════════════════════════════════════════════════════════╗
║  ATM GUARD DATA PIPELINE                                     ║
║  Mod  : {args.mode:<52}║
║  Veri : {args.data:<52}║
╚══════════════════════════════════════════════════════════════╝""")

    if args.mode == 'initial':
        # ──────────────────────────────────────────────────────────────────────
        # SEN YAPACAKSIN:
        #   python3 data_pipeline.py --mode initial --data banka_verisi.json
        #
        # Bu çalışınca:
        #   - Tüm ATM'lerin öznitelikleri çıkarılır
        #   - Arıza labeli oluşturulur (y_maintenance)
        #   - Nakit süresi hesaplanır  (y_cash)
        #   - XGBoost modeller eğitilir
        #   - ./models/ altına kaydedilir
        # ──────────────────────────────────────────────────────────────────────
        run_initial_training(args.data)

    elif args.mode == 'incremental':
        # ──────────────────────────────────────────────────────────────────────
        # HER GECE OTOMATIK:
        #   python3 data_pipeline.py --mode incremental --data bugun.json
        #
        # Sistem yeni günün verisini öğrenir, eski bilgisini kaybetmez.
        # ──────────────────────────────────────────────────────────────────────
        run_incremental_update(args.data)

    elif args.mode == 'predict':
        # ──────────────────────────────────────────────────────────────────────
        # TAHMİN AL:
        #   python3 data_pipeline.py --mode predict --data guncel.json
        #   python3 data_pipeline.py --mode predict --data guncel.json --atm T-00123
        # ──────────────────────────────────────────────────────────────────────
        run_predict(args.data, args.atm)

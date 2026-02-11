#!/usr/bin/env python3
"""
🔧 COMBINED SERVICE INTELLIGENCE ENGINE
=======================================

FLM/SLM arıza tespiti + Para toplama + İkmal optimizasyonu
Tek seferde maximum hizmet, maximum tasarruf!

Author: Ultra Nirvana AI System
Date: 10 Şubat 2026
"""

import json
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import pandas as pd


class CombinedServiceIntelligence:
    """
    Kombine hizmet optimizasyon motoru
    
    Features:
    - FLM/SLM arıza tespiti
    - Recycle para toplama analizi
    - Dispenser ikmal analizi
    - Kombine hizmet fırsatı tespiti
    - Tasarruf hesaplama
    """
    
    def __init__(self):
        self.service_costs = {
            'FLM_ONLY': 600,           # Bantaş tek başına
            'SLM_ONLY': 1500,          # Bantaş + Vendor
            'REFILL_ONLY': 600,        # Sadece ikmal
            'COLLECTION_ONLY': 600,    # Sadece para toplama
            'COMBINED_FLM': 600,       # FLM + collection/refill (tek sefer)
            'COMBINED_SLM': 1500,      # SLM + collection/refill (tek sefer)
        }
        
        # FLM arıza tipleri (Bantaş tek başına halleder)
        self.flm_keywords = [
            'KAĞIT', 'YAZICI', 'PRINTER', 'KART', 'CARD',
            'EKRAN', 'SCREEN', 'ALTYAPI', 'INFRA',
            'KALİBRASYON', 'CALIBRATION', 'JAM'
        ]
        
        # SLM arıza tipleri (Vendor teknisyen gerekli)
        self.slm_keywords = [
            'MOTHERBOARD', 'ANAKART', 'ELEKTRONİK', 'ELECTRONIC',
            'GÜVENLİK', 'SECURITY', 'VAULT', 'SAFE',
            'DISPENSER', 'ACCEPTOR', 'CİDDİ', 'MAJOR'
        ]
        
        # Eşik değerler
        self.refill_threshold_min = 100000    # 100K TL altı ikmal gerek
        self.refill_threshold_critical = 50000 # 50K TL altı kritik
        self.collection_threshold = 800000     # 800K TL üstü para topla
        self.collection_threshold_urgent = 1000000  # 1M TL üstü acil
    
    def analyze_atm(self, atm_data: Dict) -> Dict:
        """
        ATM'yi analiz et ve kombine hizmet fırsatlarını tespit et
        
        Args:
            atm_data: ATM verisi (JSON formatında)
            
        Returns:
            Analiz sonucu ve öneriler
        """
        atm_id = atm_data.get('ATM ID', 'UNKNOWN')
        
        # 0. Küpür analizi (ATM hangi paraları kullanıyor?)
        denomination_info = self._analyze_denominations(atm_data)
        
        # 1. Arıza analizi
        fault_analysis = self._analyze_fault(atm_data)
        
        # 2. Dispenser analizi (ikmal gereksinimi)
        refill_analysis = self._analyze_refill_need(atm_data, denomination_info)
        
        # 3. Recycle analizi (para toplama gereksinimi)
        collection_analysis = self._analyze_collection_need(atm_data, denomination_info)
        
        # 4. Kombine hizmet fırsatı tespiti
        combined_service = self._detect_combined_service_opportunity(
            fault_analysis, refill_analysis, collection_analysis
        )
        
        # 5. Tasarruf hesaplama
        savings = self._calculate_savings(combined_service)
        
        return {
            'atm_id': atm_id,
            'atm_name': atm_data.get('ATM Adı', ''),
            'denomination_info': denomination_info,
            'zone': atm_data.get('Zone', 0),
            'timestamp': datetime.now().isoformat(),
            
            'fault_analysis': fault_analysis,
            'refill_analysis': refill_analysis,
            'collection_analysis': collection_analysis,
            'combined_service': combined_service,
            'savings': savings,
            
            'recommendation': self._generate_recommendation(combined_service),
            'priority': self._calculate_priority(fault_analysis, refill_analysis, collection_analysis)
        }
    denominations(self, atm_data: Dict) -> Dict:
        """
        ATM'nin küpür yapısını analiz et
        
        Returns:
            Küpür bilgileri:
            - atm_type: 'TL_ONLY', 'FOREX', 'MIXED'
            - tl_denominations: TL küpürleri listesi
            - forex_denominations: Döviz küpürleri listesi
            - has_recycle: Recycle var mı?
        """
        # Döviz bilgisi
        forex = atm_data.get('Döviz', '-')
        has_forex = forex and forex != '-' and forex.strip() != ''
        
        # TL Küpürler
        tl_kupurler = str(atm_data.get('TL Küpür', ''))
        tl_denominations = self._parse_denominations(tl_kupurler)
        
        # Döviz Küpürler
        forex_kupurler = str(atm_data.get('Döviz Küpür', ''))
        forex_denominations = self._parse_denominations(forex_kupurler)
        
        # Tüm Küpürler
        tum_kupurler = str(atm_data.get('Tüm Küpürler', ''))
        
        # ATM tipi
        if has_forex and tl_denominations:
            atm_type = 'MIXED'  # Hem TL hem döviz
        elif has_forex:
            atm_type = 'FOREX'  # Sadece döviz
        else:
            atm_type = 'TL_ONLY'  # Sadece TL (standart)
        
        # Recycle var mı? (200 TL ve 100 TL varsa genelde recycle var)
        has_recycle = '200 TL' in tum_kupurler and atm_type == 'TL_ONLY'
        
        return {, denomination_info: Dict) -> Dict:
        """
        Dispenser kasetleri analiz et - İkmal gerekiyor mu?
        
        Dispenser yapısı ATM'ye göre değişir:
        - Standart TL ATM: 200, 100, 50 TL
        - Dövizli ATM: Farklı yapılandırma
        """
        atm_type = denomination_info['atm_type']
    def _parse_denominations(self, denomination_text: str) -> List[str]:
        """
        Küpür metnini parse et
        
        Örnek: "200 TL 200 TL 100 TL 100 TL" -> ['200 TL', '100 TL']
        """
        if not denomination_text or denomination_text == '-':
            return []
        
        # Tekrar edenleri temizle, unique küpürleri al
        denominations = []
        seen = set()
        
        for part in denomination_text.split():
            # "200", "TL",  (ATM tipine göre)
        if atm_type == 'FOREX':
            # Dövizli ATM - farklı eşikler
            needs_refill = tl_balance < 50000  # Daha düşük eşik
            is_critical = tl_balance < 20000
            suggested_refill = 500000 - tl_balance if needs_refill else 0
        else:
            # TL ATM - standart eşikler
            needs_refill = tl_balance < self.refill_threshold_min
            is_critical = tl_balance < self.refill_threshold_critical
            suggested_refill = 1000000 - tl_balance if needs_refill else 0
        
        return {
            'atm_type': atm_type,
            'tl_balance': tl_balance,
            'cassettes': cassettes,
            'cassette_count': len(cassettes),
            'needs_refill': needs_refill,
            'is_critical': is_critical,
            'suggested_refill_amount': suggested_refill,
            'urgency': 'CRITICAL' if is_critical else ('HIGH' if needs_refill else 'NONE'),
            'denominations_used': denomination_info[', denomination_info: Dict) -> Dict:
        """
        Recycle kasetleri analiz et - Para toplama gerekiyor mu?
        
        Recycle yapısı ATM'ye göre değişir:
        - Standart TL ATM: 2x200 TL + 2x100 TL recycle
        - Dövizli ATM: Genelde recycle yok
        """
        atm_type = denomination_info['atm_type']
        has_recycle = denomination_info['has_recycle']
        
        recycle_balance = self._parse_amount(atm_data.get('Recycle Bakiye', 0))
        
        # Dövizli ATM'lerde genelde recycle yok
        if atm_type == 'FOREX':
            return {
                'atm_type': atm_type,
                'has_recycle': False,
                'recycle_balance': 0,
                'recycle_details': {},
                'needs_collection': False,
                'is_urgent': False,
                'has_regular_schedule': False,
                'collection_amount': 0,
                'urgency': 'NONE'
            }
        
        # Recatm_type': atm_type,
            'has_recycle': has_recycle,
            'recycle_balance': recycle_balance,
            'recycle_details': recycle_details,
            'needs_collection': needs_collection,
            'is_urgent': is_urgent,
            'has_regular_schedule': has_regular_collection,
            'collection_amount': recycle_balance if needs_collection else 0,
            'urgency': 'URGENT' if is_urgent else ('HIGH' if needs_collection else 'NONE'),
            'recycle_denominations': ['200 TL', '100 TL'] if has_recycle else []
        if is_slm:
            fault_type = 'SLM'
        elif is_flm or flm_capable:
            fault_type = 'FLM'
        else:
            # Bilinmeyen, FLM kabul et (safer)
            fault_type = 'FLM' if flm_capable else 'UNKNOWN'
        
        return {
            'has_fault': True,
            'fault_type': fault_type,
            'fault_description': fault_description,
            'flm_capable': flm_capable,
            'severity': 'HIGH' if is_slm else 'MEDIUM'
        }
    
    def _analyze_refill_need(self, atm_data: Dict) -> Dict:
        """
        Dispenser kasetleri analiz et - İkmal gerekiyor mu?
        
        Dispenser yapısı (standart Türk Lirası ATM'ler):
        - 200 TL kasetleri (çekilenler)
        - 100 TL kasetleri (çekilenler)
        - 50 TL kasetleri (çekilenler)
        - 20 TL genelde YOK
        """
        tl_balance = self._parse_amount(atm_data.get('TL Bakiye', 0))
        
        # Kaset detayları
        # Standart ATM: 4-6 kaset (200, 100, 50 TL karışımı)
        cassettes = []
        for i in range(1, 9):
            cassette_amount = self._parse_amount(atm_data.get(f'Kaset {i}', 0))
            if cassette_amount > 0 or str(atm_data.get(f'Kaset {i}', '-')) != '-':
                cassettes.append({
                    'cassette_id': i,
                    'amount': cassette_amount
                })
        
        # İkmal gereksinimi
        needs_refill = tl_balance < self.refill_threshold_min
        is_critical = tl_balance < self.refill_threshold_critical
        
        # Önerilen ikmal miktarı
        if needs_refill:
            # Hedef: 1M TL'ye tamamla
            suggested_refill = 1000000 - tl_balance
        else:
            suggested_refill = 0
        
        return {
            'tl_balance': tl_balance,
            'cassettes': cassettes,
            'cassette_count': len(cassettes),
            'needs_refill': needs_refill,
            'is_critical': is_critical,
            'suggested_refill_amount': suggested_refill,
            'urgency': 'CRITICAL' if is_critical else ('HIGH' if needs_refill else 'NONE')
        }
    
    def _analyze_collection_need(self, atm_data: Dict) -> Dict:
        """
        Recycle kasetleri analiz et - Para toplama gerekiyor mu?
        
        Recycle yapısı (standart Türk Lirası ATM'ler):
        - 2 kaset 200 TL (yatırılan 200'ler)
        - 2 kaset 100 TL (yatırılan 100'ler)
        - 50 TL ve 20 TL YOK (sadece dispenser'dan verilir)
        """
        recycle_balance = self._parse_amount(atm_data.get('Recycle Bakiye', 0))
        
        # Recycle kaset detayları
        # NOT: Sadece 200 TL ve 100 TL recycle edilir
        recycle_details = {}
        for denomination in ['200 TL', '100 TL']:
            amount = self._parse_amount(atm_data.get(f'Recycle {denomination}', 0))
            if amount > 0:
                recycle_details[denomination] = amount
        
        # Para toplama gereksinimi
        needs_collection = recycle_balance > self.collection_threshold
        is_urgent = recycle_balance > self.collection_threshold_urgent
        
        # Düzenli para toplama var mı?
        has_regular_collection = atm_data.get('Düzenli Para Toplama', '') == 'Var'
        
        return {
            'recycle_balance': recycle_balance,
            'recycle_details': recycle_details,
            'needs_collection': needs_collection,
            'is_urgent': is_urgent,
            'has_regular_schedule': has_regular_collection,
            'collection_amount': recycle_balance if needs_collection else 0,
            'urgency': 'URGENT' if is_urgent else ('HIGH' if needs_collection else 'NONE')
        }
    
    def _detect_combined_service_opportunity(
        self, 
        fault_analysis: Dict, 
        refill_analysis: Dict, 
        collection_analysis: Dict
    ) -> Dict:
        """
        Kombine hizmet fırsatı tespit et
        """
        has_fault = fault_analysis['has_fault']
        fault_type = fault_analysis.get('fault_type')
        needs_refill = refill_analysis['needs_refill']
        needs_collection = collection_analysis['needs_collection']
        
        services_needed = []
        service_type = 'NONE'
        team_required = None
        can_combine = False
        
        # Gerekli hizmetleri listele
        if has_fault:
            services_needed.append(fault_type)
        if needs_refill:
            services_needed.append('REFILL')
        if needs_collection:
            services_needed.append('COLLECTION')
        
        if len(services_needed) == 0:
            return {
                'service_type': 'NONE',
                'services_needed': [],
                'team_required': None,
                'can_combine': False,
                'combination_benefit': 0
            }
        
        # Kombine hizmet fırsatı analizi
        if has_fault and fault_type == 'FLM':
            # FLM arıza var - Bantaş tek başına
            team_required = 'Bantaş Only'
            can_combine = True
            
            if needs_refill and needs_collection:
                service_type = 'FLM_REFILL_COLLECTION'  # Triple combo!
                combination_benefit = 66  # 3 sefer → 1 sefer
            elif needs_refill:
                service_type = 'FLM_REFILL'
                combination_benefit = 50  # 2 sefer → 1 sefer
            elif needs_collection:
                service_type = 'FLM_COLLECTION'
                combination_benefit = 50  # 2 sefer → 1 sefer
            else:
                service_type = 'FLM_ONLY'
                combination_benefit = 0
        
        elif has_fault and fault_type == 'SLM':
            # SLM arıza var - Bantaş + Vendor
            team_required = 'Bantaş + Vendor'
            can_combine = True  # Ama daha zor
            
            if needs_refill and needs_collection:
                service_type = 'SLM_REFILL_COLLECTION'
                combination_benefit = 40  # Koordinasyon zor ama yine tasarruf var
            elif needs_refill:
                service_type = 'SLM_REFILL'
                combination_benefit = 25
            elif needs_collection:
                service_type = 'SLM_COLLECTION'
                combination_benefit = 30
            else:
                service_type = 'SLM_ONLY'
                combination_benefit = 0
        
        elif not has_fault:
            # Arıza yok - Sadece nakit operasyonu
            team_required = 'Bantaş Only'
            can_combine = True
            
            if needs_refill and needs_collection:
                service_type = 'REFILL_COLLECTION'
                combination_benefit = 50  # 2 sefer → 1 sefer
            elif needs_refill:
                service_type = 'REFILL_ONLY'
                combination_benefit = 0
            elif needs_collection:
                service_type = 'COLLECTION_ONLY'
                combination_benefit = 0
        
        return {
            'service_type': service_type,
            'services_needed': services_needed,
            'team_required': team_required,
            'can_combine': can_combine,
            'combination_benefit': combination_benefit,  # % tasarruf
            'service_count': len(services_needed)
        }
    
    def _calculate_savings(self, combined_service: Dict) -> Dict:
        """
        Kombine hizmetten elde edilen tasarrufu hesapla
        """
        service_type = combined_service['service_type']
        services_needed = combined_service['services_needed']
        
        if service_type == 'NONE':
            return {
                'normal_cost': 0,
                'combined_cost': 0,
                'savings_amount': 0,
                'savings_percentage': 0
            }
        
        # Normal maliyet (her hizmet ayrı sefer)
        normal_cost = 0
        for service in services_needed:
            if service in ['FLM', 'REFILL', 'COLLECTION']:
                normal_cost += 600
            elif service == 'SLM':
                normal_cost += 1500
        
        # Kombine maliyet (tek sefer)
        if 'FLM' in services_needed:
            combined_cost = 600
        elif 'SLM' in services_needed:
            combined_cost = 1500
        else:
            combined_cost = 600
        
        savings_amount = normal_cost - combined_cost
        savings_percentage = (savings_amount / normal_cost * 100) if normal_cost > 0 else 0
        
        return {
            'tl_only_atms': 0,
            'forex_atms': 0,
            'mixed_atms': 0,
            'with_recycle': 0,
            'normal_cost': normal_cost,
            'combined_cost': combined_cost,
            'savings_amount': savings_amount,
            'savings_percentage': round(savings_percentage, 1)
        }
    
    def _generate_recommendation(self, combined_service: Dict) -> str:
        """
        İnsan okunabilir öneri metni oluştur
        """
        service_type = combined_service['service_type']
        team = combined_service['team_required']
        benefit = combined_service['combination_benefit']
        
        recommATM tipi istatistikleri
            atm_type = analysis['denomination_info']['atm_type']
            if atm_type == 'TL_ONLY':
                stats['tl_only_atms'] += 1
            elif atm_type == 'FOREX':
                stats['forex_atms'] += 1
            elif atm_type == 'MIXED':
                stats['mixed_atms'] += 1
            
            if analysis['denomination_info']['has_recycle']:
                stats['with_recycle'] += 1
            
            # endations = {
            'FLM_REFILL_COLLECTION': f'🔥 TRIPLE COMBO! {team} gider, arızayı tamir et + ikmal yap + para topla. %{benefit} tasarruf!',
            'FLM_REFILL': f'⚡ DOUBLE COMBO! {team} gider, arızayı tamir et + ikmal yap. %{benefit} tasarruf!',
            'FLM_COLLECTION': f'⚡ DOUBLE COMBO! {team} gider, arızayı tamir et + para topla. %{benefit} tasarruf!',
            'SLM_REFILL_COLLECTION': f'💪 TRIPLE COMBO! {team} koordineli gider, arızayı tamir et + ikmal yap + para topla. %{benefit} tasarruf!',
            'SLM_REFILL': f'💪 DOUBLE COMBO! {team} koordineli gider, arızayı tamir et + ikmal yap. %{benefit} tasarruf!',
            'SLM_COLLECTION': f'💪 DOUBLE COMBO! {team} koordineli gider, arızayı tamir et + para topla. %{benefit} tasarruf!',
            'REFILL_COLLECTION': f'✅ DOUBLE COMBO! {team} gider, ikmal yap + para topla. %{benefit} tasarruf!',
            'FLM_ONLY': f'🔧 FLM tamir gerekli. {team} gider.',
            'SLM_ONLY': f'🔧 SLM tamir gerekli. {team} gider.',
            'REFILL_ONLY': f'💰 İkmal gerekli. {team} gider.',
            'COLLECTION_ONLY': f'💸 Para toplama gerekli. {team} gider.',
            'NONE': 'Hizmet gerekmiyor.'
        }
        
        return recommendations.get(service_type, 'Bilinmeyen servis tipi')
    
    def _calculate_priority(
        self, 
        fault_analysis: Dict, len(results)} ATM")
        print(f"\n💳 ATM Tipleri:")
        print(f"   - TL Only: {stats['tl_only_atms']} (Standart)")
        print(f"   - Forex: {stats['forex_atms']} (Döviz)")
        print(f"   - Mixed: {stats['mixed_atms']} (TL+Döviz)")
        print(f"   - Recycle'lı: {stats['with_recycle']}")
        
        refill_analysis: Dict, 
        collection_analysis: Dict
    ) -> str:
        """
        Öncelik seviyesi hesapla
        """
        # Kritik durumlar
        if refill_analysis.get('is_critical'):
            return 'CRITICAL'
        if fault_analysis.get('severity') == 'HIGH':
            return 'CRITICAL'
        if collection_analysis.get('is_urgent'):
            return 'CRITICAL'
        
        # Yüksek öncelikli
        if fault_analysis.get('has_fault'):
            return 'HIGH'
        if refill_analysis.get('needs_refill'):
            return 'HIGH'
        if collection_analysis.get('needs_collection'):
            return 'HIGH'
        
        # Orta öncelikli
        if refill_analysis.get('tl_balance', 0) < 200000:
            return 'MEDIUM'
        if collection_analysis.get('recycle_balance', 0) > 500000:
            return 'MEDIUM'
        
        return 'LOW'
    
    def _parse_amount(self, value) -> int:
        """
        Para miktarını parse et
        """
        if value is None or value == '-' or value == '':
            return 0
        
        try:
            if isinstance(value, (int, float)):
                return int(value)
            # String ise, virgül ve nokta temizle
            cleaned = str(value).replace(',', '').replace('.', '').replace(' ', '')
            return int(cleaned) if cleaned and cleaned != '-' else 0
        except:
            return 0
    
    def analyze_all_atms(self, atm_data_file: str) -> Dict:
        """
        Tüm ATM'leri analiz et ve istatistikleri döndür
        """
        print("📊 Combined Service Intelligence - Tüm ATM Analizi")
        print("=" * 60)
        
        # JSON dosyasını oku
        with open(atm_data_file, 'r', encoding='utf-8') as f:
            atm_list = json.load(f)
        
        total_atms = len(atm_list)
        results = []
        
        # İstatistikler
        stats = {
            'total_atms': total_atms,
            'with_faults': 0,
            'flm_faults': 0,
            'slm_faults': 0,
            'needs_refill': 0,
            'needs_collection': 0,
            'combined_opportunities': 0,
            'double_combos': 0,
            'triple_combos': 0,
            'total_savings_tl': 0,
            'average_savings_percentage': 0
        }
        
        # Her ATM'yi analiz et
        for atm_data in atm_list[:100]:  # İlk 100 ATM (demo)
            analysis = self.analyze_atm(atm_data)
            results.append(analysis)
            
            # İstatistikleri güncelle
            if analysis['fault_analysis']['has_fault']:
                stats['with_faults'] += 1
                if analysis['fault_analysis']['fault_type'] == 'FLM':
                    stats['flm_faults'] += 1
                elif analysis['fault_analysis']['fault_type'] == 'SLM':
                    stats['slm_faults'] += 1
            
            if analysis['refill_analysis']['needs_refill']:
                stats['needs_refill'] += 1
            
            if analysis['collection_analysis']['needs_collection']:
                stats['needs_collection'] += 1
            
            if analysis['combined_service']['can_combine'] and analysis['combined_service']['service_count'] > 1:
                stats['combined_opportunities'] += 1
                
                if analysis['combined_service']['service_count'] == 2:
                    stats['double_combos'] += 1
                elif analysis['combined_service']['service_count'] == 3:
                    stats['triple_combos'] += 1
            
            stats['total_savings_tl'] += analysis['savings']['savings_amount']
        
        stats['average_savings_percentage'] = round(
            sum(r['savings']['savings_percentage'] for r in results if r['savings']['savings_amount'] > 0) / 
            len([r for r in results if r['savings']['savings_amount'] > 0]) if results else 0,
            1
        )
        
        # Sonuçları yazdır
        print(f"\n✅ Analiz Tamamlandı: {total_atms} ATM")
        print(f"\n🔧 Arıza İstatistikleri:")
        print(f"   - Toplam arızalı: {stats['with_faults']}")
        print(f"   - FLM arıza: {stats['flm_faults']} (Bantaş tek başına)")
        print(f"   - SLM arıza: {stats['slm_faults']} (Bantaş + Vendor)")
        
        print(f"\n💰 Nakit Operasyonları:")
        print(f"   - İkmal gerekli: {stats['needs_refill']}")
        print(f"   - Para toplama gerekli: {stats['needs_collection']}")
        
        print(f"\n🔥 Kombine Hizmet Fırsatları:")
        print(f"   - Toplam fırsat: {stats['combined_opportunities']}")
        print(f"   - Double combo: {stats['double_combos']}")
        print(f"   - Triple combo: {stats['triple_combos']}")
        
        print(f"\n💎 Tasarruf:")
        print(f"   - Günlük tasarruf: {stats['total_savings_tl']:,.0f} TL")
        print(f"   - Ortalama tasarruf: %{stats['average_savings_percentage']}")
        print(f"   - Aylık tasarruf (tahmini): {stats['total_savings_tl'] * 30:,.0f} TL")
        
        # En yüksek öncelikli ATM'ler
        critical_atms = [r for r in results if r['priority'] == 'CRITICAL']
        print(f"\n⚠️  Kritik Öncelikli ATM'ler: {len(critical_atms)}")
        for atm in critical_atms[:5]:  # İlk 5'i göster
            print(f"   - {atm['atm_id']}: {atm['recommendation']}")
        
        return {
            'statistics': stats,
            'results': results,
            'critical_atms': critical_atms
        }


def main():
    """
    Demo çalıştırma
    """
    engine = CombinedServiceIntelligence()
    
    # JSON dosyasını analiz et
    data_file = '../kasa_durum_raporu.json'
    
    try:
        results = engine.analyze_all_atms(data_file)
        
        # Sonuçları kaydet
        output_file = 'combined_service_analysis.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        print(f"\n✅ Sonuçlar kaydedildi: {output_file}")
        
    except FileNotFoundError:
        print(f"❌ Veri dosyası bulunamadı: {data_file}")
        print("Lütfen kasa_durum_raporu.json dosyasının konumunu kontrol edin.")


if __name__ == '__main__':
    main()

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
from typing import Dict, List, Optional
from pathlib import Path


class CombinedServiceIntelligence:
    """Kombine hizmet optimizasyon motoru"""

    def __init__(self):
        self.service_costs = {
            'FLM_ONLY': 600, 'SLM_ONLY': 1500,
            'REFILL_ONLY': 600, 'COLLECTION_ONLY': 600,
            'COMBINED_FLM': 600, 'COMBINED_SLM': 1500,
        }
        self.flm_keywords = [
            'KAĞIT', 'YAZICI', 'PRINTER', 'KART', 'CARD',
            'EKRAN', 'SCREEN', 'ALTYAPI', 'INFRA',
            'KALİBRASYON', 'CALIBRATION', 'JAM', 'PAPER', 'RECEIPT'
        ]
        self.slm_keywords = [
            'MOTHERBOARD', 'ANAKART', 'ELEKTRONİK', 'ELECTRONIC',
            'GÜVENLİK', 'SECURITY', 'VAULT', 'SAFE',
            'DISPENSER', 'ACCEPTOR', 'CİDDİ', 'MAJOR', 'EPP', 'SENSOR'
        ]
        self.refill_threshold_min = 100000
        self.refill_threshold_critical = 50000
        self.collection_threshold = 800000
        self.collection_threshold_urgent = 1000000

    # ── ANA ANALİZ ────────────────────────────────────────────────────

    def analyze_atm(self, atm_data: Dict) -> Dict:
        atm_id = atm_data.get('ATM ID', atm_data.get('atm_id', 'UNKNOWN'))
        denomination_info = self._analyze_denominations(atm_data)
        fault_analysis = self._analyze_fault(atm_data)
        refill_analysis = self._analyze_refill_need(atm_data, denomination_info)
        collection_analysis = self._analyze_collection_need(atm_data, denomination_info)
        combined_service = self._detect_combined_service_opportunity(
            fault_analysis, refill_analysis, collection_analysis)
        savings = self._calculate_savings(combined_service)
        return {
            'atm_id': atm_id,
            'atm_name': atm_data.get('ATM Adı', atm_data.get('atm_name', '')),
            'denomination_info': denomination_info,
            'zone': atm_data.get('Zone', atm_data.get('zone', 0)),
            'timestamp': datetime.now().isoformat(),
            'fault_analysis': fault_analysis,
            'refill_analysis': refill_analysis,
            'collection_analysis': collection_analysis,
            'combined_service': combined_service,
            'savings': savings,
            'recommendation': self._generate_recommendation(combined_service),
            'priority': self._calculate_priority(fault_analysis, refill_analysis, collection_analysis)
        }

    # ── KÜPÜr ANALİZİ ─────────────────────────────────────────────────

    def _analyze_denominations(self, atm_data: Dict) -> Dict:
        forex = atm_data.get('Döviz', atm_data.get('forex', '-'))
        has_forex = bool(forex and str(forex).strip() not in ('-', '', 'nan'))
        tl_kupurler = str(atm_data.get('TL Küpür', atm_data.get('tl_denominations', '')))
        tl_denominations = self._parse_denominations(tl_kupurler)
        forex_kupurler = str(atm_data.get('Döviz Küpür', atm_data.get('forex_denominations', '')))
        forex_denominations = self._parse_denominations(forex_kupurler)
        tum_kupurler = str(atm_data.get('Tüm Küpürler', atm_data.get('all_denominations', '')))
        if has_forex and tl_denominations:
            atm_type = 'MIXED'
        elif has_forex:
            atm_type = 'FOREX'
        else:
            atm_type = 'TL_ONLY'
        has_recycle = ('200 TL' in tum_kupurler or '200' in tum_kupurler) and atm_type == 'TL_ONLY'
        return {
            'atm_type': atm_type,
            'tl_denominations': tl_denominations,
            'forex_denominations': forex_denominations,
            'has_recycle': has_recycle,
            'forex_currency': str(forex).strip() if has_forex else None
        }

    def _parse_denominations(self, denomination_text: str) -> List[str]:
        if not denomination_text or denomination_text in ('-', 'nan', 'None', ''):
            return []
        denominations, seen, parts = [], set(), denomination_text.split()
        i = 0
        while i < len(parts):
            if i + 1 < len(parts) and parts[i + 1].upper() in ('TL', 'USD', 'EUR', 'GBP'):
                token = f"{parts[i]} {parts[i+1]}"
                if token not in seen:
                    seen.add(token); denominations.append(token)
                i += 2
            else:
                token = parts[i]
                if token not in seen and token.isdigit():
                    seen.add(token); denominations.append(token)
                i += 1
        return denominations

    # ── ARIZA ANALİZİ ─────────────────────────────────────────────────

    def _analyze_fault(self, atm_data: Dict) -> Dict:
        fault_description = str(
            atm_data.get('Arıza Açıklaması',
            atm_data.get('fault_description',
            atm_data.get('error_message',
            atm_data.get('alarm_description', ''))))
        ).strip()
        has_fault = bool(fault_description and fault_description not in ('-', '', 'nan', 'None'))
        if not has_fault:
            return {'has_fault': False, 'fault_type': None, 'fault_description': '', 'flm_capable': False, 'severity': 'NONE'}
        fault_upper = fault_description.upper()
        is_slm = any(kw in fault_upper for kw in self.slm_keywords)
        is_flm = any(kw in fault_upper for kw in self.flm_keywords)
        flm_capable = atm_data.get('FLM Capable', atm_data.get('flm_capable', True))
        fault_type = 'SLM' if is_slm else 'FLM'
        return {
            'has_fault': True,
            'fault_type': fault_type,
            'fault_description': fault_description,
            'flm_capable': flm_capable,
            'severity': 'HIGH' if is_slm else 'MEDIUM'
        }

    # ── İKMAL ANALİZİ ─────────────────────────────────────────────────

    def _analyze_refill_need(self, atm_data: Dict, denomination_info: Optional[Dict] = None) -> Dict:
        tl_balance = self._parse_amount(
            atm_data.get('TL Bakiye', atm_data.get('tl_balance', atm_data.get('cash_balance', 0))))
        atm_type = denomination_info['atm_type'] if denomination_info else 'TL_ONLY'
        cassettes = []
        for i in range(1, 9):
            amt = self._parse_amount(atm_data.get(f'Kaset {i}', atm_data.get(f'cassette_{i}', atm_data.get(f'cassette{i}', None))))
            if amt > 0:
                cassettes.append({'cassette_id': i, 'amount': amt})
        if atm_type == 'FOREX':
            needs_refill = tl_balance < 50000
            is_critical = tl_balance < 20000
            suggested_refill = max(0, 500000 - tl_balance) if needs_refill else 0
        else:
            needs_refill = tl_balance < self.refill_threshold_min
            is_critical = tl_balance < self.refill_threshold_critical
            suggested_refill = max(0, 1000000 - tl_balance) if needs_refill else 0
        return {
            'atm_type': atm_type,
            'tl_balance': tl_balance,
            'cassettes': cassettes,
            'cassette_count': len(cassettes),
            'needs_refill': needs_refill,
            'is_critical': is_critical,
            'suggested_refill_amount': suggested_refill,
            'urgency': 'CRITICAL' if is_critical else ('HIGH' if needs_refill else 'NONE')
        }

    # ── PARA TOPLAMA ANALİZİ ──────────────────────────────────────────

    def _analyze_collection_need(self, atm_data: Dict, denomination_info: Optional[Dict] = None) -> Dict:
        atm_type = denomination_info['atm_type'] if denomination_info else 'TL_ONLY'
        has_recycle = denomination_info['has_recycle'] if denomination_info else False
        recycle_balance = self._parse_amount(
            atm_data.get('Recycle Bakiye', atm_data.get('recycle_balance', atm_data.get('deposit_balance', 0))))
        if atm_type == 'FOREX':
            return {
                'atm_type': atm_type, 'has_recycle': False, 'recycle_balance': 0,
                'recycle_details': {}, 'needs_collection': False, 'is_urgent': False,
                'has_regular_schedule': False, 'collection_amount': 0, 'urgency': 'NONE'
            }
        recycle_details = {}
        for denomination in ['200 TL', '100 TL']:
            for key in [f'Recycle {denomination}', f'recycle_{denomination.replace(" ", "_").lower()}']:
                amt = self._parse_amount(atm_data.get(key, 0))
                if amt > 0:
                    recycle_details[denomination] = amt; break
        needs_collection = recycle_balance > self.collection_threshold
        is_urgent = recycle_balance > self.collection_threshold_urgent
        has_regular = str(atm_data.get('Düzenli Para Toplama', atm_data.get('regular_collection', ''))).strip() in ('Var', 'var', 'YES', 'yes', '1', 'True')
        return {
            'atm_type': atm_type, 'has_recycle': has_recycle,
            'recycle_balance': recycle_balance, 'recycle_details': recycle_details,
            'needs_collection': needs_collection, 'is_urgent': is_urgent,
            'has_regular_schedule': has_regular,
            'collection_amount': recycle_balance if needs_collection else 0,
            'urgency': 'URGENT' if is_urgent else ('HIGH' if needs_collection else 'NONE'),
            'recycle_denominations': ['200 TL', '100 TL'] if has_recycle else []
        }

    # ── KOMBİNE HİZMET ────────────────────────────────────────────────

    def _detect_combined_service_opportunity(self, fault_analysis, refill_analysis, collection_analysis) -> Dict:
        has_fault = fault_analysis['has_fault']
        fault_type = fault_analysis.get('fault_type')
        needs_refill = refill_analysis['needs_refill']
        needs_collection = collection_analysis['needs_collection']
        services_needed = []
        if has_fault: services_needed.append(fault_type)
        if needs_refill: services_needed.append('REFILL')
        if needs_collection: services_needed.append('COLLECTION')
        if not services_needed:
            return {'service_type': 'NONE', 'services_needed': [], 'team_required': None, 'can_combine': False, 'combination_benefit': 0, 'service_count': 0}
        service_type = 'NONE'; team_required = None; can_combine = False; combination_benefit = 0
        if has_fault and fault_type == 'FLM':
            team_required = 'Bantaş Only'; can_combine = True
            if needs_refill and needs_collection: service_type = 'FLM_REFILL_COLLECTION'; combination_benefit = 66
            elif needs_refill: service_type = 'FLM_REFILL'; combination_benefit = 50
            elif needs_collection: service_type = 'FLM_COLLECTION'; combination_benefit = 50
            else: service_type = 'FLM_ONLY'
        elif has_fault and fault_type == 'SLM':
            team_required = 'Bantaş + Vendor'; can_combine = True
            if needs_refill and needs_collection: service_type = 'SLM_REFILL_COLLECTION'; combination_benefit = 40
            elif needs_refill: service_type = 'SLM_REFILL'; combination_benefit = 25
            elif needs_collection: service_type = 'SLM_COLLECTION'; combination_benefit = 30
            else: service_type = 'SLM_ONLY'
        else:
            team_required = 'Bantaş Only'; can_combine = True
            if needs_refill and needs_collection: service_type = 'REFILL_COLLECTION'; combination_benefit = 50
            elif needs_refill: service_type = 'REFILL_ONLY'
            elif needs_collection: service_type = 'COLLECTION_ONLY'
        return {'service_type': service_type, 'services_needed': services_needed, 'team_required': team_required, 'can_combine': can_combine, 'combination_benefit': combination_benefit, 'service_count': len(services_needed)}

    def _calculate_savings(self, combined_service: Dict) -> Dict:
        service_type = combined_service['service_type']
        services_needed = combined_service['services_needed']
        if service_type == 'NONE':
            return {'normal_cost': 0, 'combined_cost': 0, 'savings_amount': 0, 'savings_percentage': 0}
        normal_cost = sum(1500 if s == 'SLM' else 600 for s in services_needed)
        combined_cost = 1500 if 'SLM' in services_needed else 600
        savings_amount = normal_cost - combined_cost
        return {
            'normal_cost': normal_cost, 'combined_cost': combined_cost,
            'savings_amount': savings_amount,
            'savings_percentage': round((savings_amount / normal_cost * 100) if normal_cost > 0 else 0, 1)
        }

    def _generate_recommendation(self, combined_service: Dict) -> str:
        st = combined_service['service_type']
        team = combined_service.get('team_required', '?')
        b = combined_service.get('combination_benefit', 0)
        recs = {
            'FLM_REFILL_COLLECTION': f'🔥 TRIPLE COMBO! {team} gider, arızayı tamir et + ikmal yap + para topla. %{b} tasarruf!',
            'FLM_REFILL': f'⚡ DOUBLE COMBO! {team} gider, arızayı tamir et + ikmal yap. %{b} tasarruf!',
            'FLM_COLLECTION': f'⚡ DOUBLE COMBO! {team} gider, arızayı tamir et + para topla. %{b} tasarruf!',
            'SLM_REFILL_COLLECTION': f'💪 TRIPLE COMBO! {team} koordineli gider, arızayı tamir et + ikmal yap + para topla. %{b} tasarruf!',
            'SLM_REFILL': f'�� DOUBLE COMBO! {team} koordineli gider, arızayı tamir et + ikmal yap. %{b} tasarruf!',
            'SLM_COLLECTION': f'💪 DOUBLE COMBO! {team} koordineli gider, arızayı tamir et + para topla. %{b} tasarruf!',
            'REFILL_COLLECTION': f'✅ DOUBLE COMBO! {team} gider, ikmal yap + para topla. %{b} tasarruf!',
            'FLM_ONLY': f'🔧 FLM tamir gerekli. {team} gider.',
            'SLM_ONLY': f'🔧 SLM tamir gerekli. {team} gider.',
            'REFILL_ONLY': f'💰 İkmal gerekli. {team} gider.',
            'COLLECTION_ONLY': f'💸 Para toplama gerekli. {team} gider.',
            'NONE': 'Hizmet gerekmiyor.',
        }
        return recs.get(st, 'Bilinmeyen servis tipi')

    def _calculate_priority(self, fault_analysis, refill_analysis, collection_analysis) -> str:
        if refill_analysis.get('is_critical'): return 'CRITICAL'
        if fault_analysis.get('severity') == 'HIGH': return 'CRITICAL'
        if collection_analysis.get('is_urgent'): return 'CRITICAL'
        if fault_analysis.get('has_fault'): return 'HIGH'
        if refill_analysis.get('needs_refill'): return 'HIGH'
        if collection_analysis.get('needs_collection'): return 'HIGH'
        if refill_analysis.get('tl_balance', 0) < 200000: return 'MEDIUM'
        if collection_analysis.get('recycle_balance', 0) > 500000: return 'MEDIUM'
        return 'LOW'

    def _parse_amount(self, value) -> int:
        if value is None or str(value).strip() in ('-', '', 'nan', 'None'): return 0
        try:
            if isinstance(value, (int, float)): return int(value)
            cleaned = str(value).replace(',', '').replace('.', '').replace(' ', '').replace('₺', '').replace('TL', '')
            return int(cleaned) if cleaned else 0
        except (ValueError, TypeError):
            return 0

    # ── TOPLU ANALİZ ──────────────────────────────────────────────────

    def analyze_all_atms(self, atm_data_input, limit: int = None) -> Dict:
        print("📊 Combined Service Intelligence - Tüm ATM Analizi")
        print("=" * 60)
        if isinstance(atm_data_input, (str, Path)):
            with open(atm_data_input, 'r', encoding='utf-8') as f:
                atm_list = json.load(f)
        else:
            atm_list = atm_data_input
        if limit:
            atm_list = atm_list[:limit]
        total_atms = len(atm_list)
        results = []
        stats = {
            'total_atms': total_atms, 'with_faults': 0, 'flm_faults': 0, 'slm_faults': 0,
            'needs_refill': 0, 'needs_collection': 0, 'combined_opportunities': 0,
            'double_combos': 0, 'triple_combos': 0, 'total_savings_tl': 0,
            'average_savings_percentage': 0, 'tl_only_atms': 0, 'forex_atms': 0,
            'mixed_atms': 0, 'with_recycle': 0
        }
        for atm_data in atm_list:
            analysis = self.analyze_atm(atm_data)
            results.append(analysis)
            if analysis['fault_analysis']['has_fault']:
                stats['with_faults'] += 1
                ft = analysis['fault_analysis']['fault_type']
                if ft == 'FLM': stats['flm_faults'] += 1
                elif ft == 'SLM': stats['slm_faults'] += 1
            if analysis['refill_analysis']['needs_refill']: stats['needs_refill'] += 1
            if analysis['collection_analysis']['needs_collection']: stats['needs_collection'] += 1
            cs = analysis['combined_service']
            if cs['can_combine'] and cs['service_count'] > 1:
                stats['combined_opportunities'] += 1
                if cs['service_count'] == 2: stats['double_combos'] += 1
                elif cs['service_count'] >= 3: stats['triple_combos'] += 1
            stats['total_savings_tl'] += analysis['savings']['savings_amount']
            at = analysis['denomination_info']['atm_type']
            if at == 'TL_ONLY': stats['tl_only_atms'] += 1
            elif at == 'FOREX': stats['forex_atms'] += 1
            elif at == 'MIXED': stats['mixed_atms'] += 1
            if analysis['denomination_info']['has_recycle']: stats['with_recycle'] += 1
        profitable = [r for r in results if r['savings']['savings_amount'] > 0]
        stats['average_savings_percentage'] = round(
            sum(r['savings']['savings_percentage'] for r in profitable) / len(profitable) if profitable else 0, 1)
        critical_atms = [r for r in results if r['priority'] == 'CRITICAL']
        print(f"\n✅ Analiz Tamamlandı: {total_atms} ATM")
        print(f"   Arızalı: {stats['with_faults']} (FLM: {stats['flm_faults']}, SLM: {stats['slm_faults']})")
        print(f"   Kombine fırsat: {stats['combined_opportunities']} (günlük tasarruf: {stats['total_savings_tl']:,.0f} TL)")
        print(f"   Kritik: {len(critical_atms)}")
        return {'statistics': stats, 'results': results, 'critical_atms': critical_atms}


def main():
    engine = CombinedServiceIntelligence()
    try:
        results = engine.analyze_all_atms('../kasa_durum_raporu.json')
        with open('combined_service_analysis.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False, default=str)
        print("✅ Sonuçlar kaydedildi: combined_service_analysis.json")
    except FileNotFoundError as e:
        print(f"❌ {e}")

if __name__ == '__main__':
    main()

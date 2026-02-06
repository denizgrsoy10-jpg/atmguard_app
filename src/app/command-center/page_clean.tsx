"use client";

import { useEffect, useState } from "react";
import atmMasterData from "@/data/atm_master.json";

type ATM = {
  atm_id: string;
  atm_name?: string;
  city: string;
  district: string;
  active?: boolean;
  location_type?: string;
  brand?: string;
  cash_center?: string;
  address?: string;
  zone?: string;
  salary_flag?: string;
};

type Alert = {
  id: string;
  atm_id: string;
  atm_name?: string;
  city: string;
  district: string;
  severity: "High" | "Medium" | "Low";
  title: string;
  summary: string;
  action: string;
  eta: string;
};

type Operator = {
  id: string;
  name: string;
  role: string;
  nms: string[];
  nmCenters: string[];
  atmCount: number;
  ikmal: number;
  toplama: number;
  status: string;
  coordination: string;
  avgSla: number;
  color: string;
  colorHover: string;
};

type ShiftType = 'Gündüz' | 'Akşam' | 'İzin' | 'Tatil' | 'Raporlu';

type PersonnelShift = {
  operatorId: string;
  date: string;
  shift: ShiftType;
  hours: string;
  notes?: string;
};

export default function CommandCenterPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [atms, setAtms] = useState<ATM[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);
  const [shifts, setShifts] = useState<PersonnelShift[]>([]);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState<PersonnelShift | null>(null);
  const [showShiftManagementModal, setShowShiftManagementModal] = useState(false);
  const [shiftPersonnel, setShiftPersonnel] = useState<string[]>([
    'Güneri Kerim', 'Murat', 'Özlem', 'Gizem', 'Nurgül'
  ]);
  const [showAddPersonnelModal, setShowAddPersonnelModal] = useState(false);
  const [newPersonnelName, setNewPersonnelName] = useState('');
  const [editingPersonnelIndex, setEditingPersonnelIndex] = useState<number | null>(null);
  const [selectedPersonnel, setSelectedPersonnel] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedShiftType, setSelectedShiftType] = useState<ShiftType>('Gündüz');
  const [shiftDateRange, setShiftDateRange] = useState<{start: string, end: string}>({ start: '', end: '' });
  const [showBulkShiftModal, setShowBulkShiftModal] = useState(false);
  const [bulkPersonnel, setBulkPersonnel] = useState<string>('');
  const [bulkStartDate, setBulkStartDate] = useState<string>('');
  const [bulkEndDate, setBulkEndDate] = useState<string>('');
  const [bulkShiftType, setBulkShiftType] = useState<ShiftType>('Gündüz');
  const [bulkDays, setBulkDays] = useState<number[]>([1, 2, 3, 4, 5]); // Pzt-Cum default
  const [showShiftPersonnelModal, setShowShiftPersonnelModal] = useState(false);
  const [selectedShiftTypeForList, setSelectedShiftTypeForList] = useState<ShiftType | null>(null);
  const [showOnDutyModal, setShowOnDutyModal] = useState(false);
  const [onDutyAssignments, setOnDutyAssignments] = useState<{date: string, personnel: string}[]>([]);
  const [selectedOnDutyDate, setSelectedOnDutyDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedOnDutyPersonnel, setSelectedOnDutyPersonnel] = useState<string>('');
  
  // Gerçek NM listesi (cash_center'lardan)
  const allNMs = [
    "ADANA", "AFYON", "ALANYA", "ANKARA", "ANTALYA", "AYDIN", "BALIKESİR",
    "BEYLİKDÜZÜ", "BODRUM", "BOLU", "BURSA", "ÇANAKKALE", "ÇORLU", "ÇORUM",
    "DENİZLİ", "DİYARBAKIR", "EDİRNE", "ELAZIĞ", "ERZURUM", "ESKİŞEHİR",
    "GAZİANTEP", "GİYİMKENT", "GÜNEŞLİ", "İSKENDERUN", "ISPARTA", "İZMİR",
    "İZMİT", "KAHRAMAARAŞ", "KASTAMONU", "KAYSERİ", "KONYA", "KOZYATAĞI",
    "MALATYA", "MALTEPE", "MASLAK", "MERSİN", "MUĞLA", "ORDU", "SAMSUN",
    "ŞANLIURFA", "SİVAS", "ŞUBE", "TRABZON", "ÜMRANİYE", "UŞAK", "VAN",
    "ZONGULDAK"
  ];
  
  // NM Merkezleri (ana merkezler)
  const allNMCenters = [
    "ADANA NM", "ANKARA NM", "ANTALYA NM", "BURSA NM", "DENİZLİ NM",
    "GAZİANTEP NM", "İZMİR NM", "KAYSERİ NM", "KONYA NM", "MALATYA NM",
    "SAMSUN NM", "TRABZON NM", "BEYLİKDÜZÜ NM", "GÜNEŞLİ NM", "KOZYATAĞI NM",
    "MALTEPE NM", "MASLAK NM", "ÜMRANİYE NM"
  ];
  
  const [operators, setOperators] = useState<Operator[]>([
    {
      id: "guneri",
      name: "Güneri Kerim",
      role: "Lider",
      nms: ["KOZYATAĞI", "MALTEPE", "ÜMRANİYE"],
      nmCenters: ["KOZYATAĞI NM", "MALTEPE NM"],
      atmCount: 45,
      ikmal: 8,
      toplama: 12,
      status: "active",
      coordination: "🚚 Bantaş Ekip-3 ile koordinasyon - Kadıköy bölgesi para toplama",
      avgSla: 2.3,
      color: "#2E86FF",
      colorHover: "#1F6FE0",
    },
    {
      id: "murat",
      name: "Murat",
      role: "Operatör",
      nms: ["BEYLİKDÜZÜ", "GÜNEŞLİ", "MASLAK"],
      nmCenters: ["BEYLİKDÜZÜ NM", "GÜNEŞLİ NM"],
      atmCount: 52,
      ikmal: 11,
      toplama: 15,
      status: "active",
      coordination: "⚠️ Kritik ATM takibi - Bakırköy 2 ATM SLA aşımı",
      avgSla: 2.8,
      color: "#F2B705",
      colorHover: "#F59E0B",
    },
    {
      id: "ozlem",
      name: "Özlem",
      role: "Operatör",
      nms: ["ANKARA", "ESKİŞEHİR", "KONYA"],
      nmCenters: ["ANKARA NM", "KONYA NM"],
      atmCount: 41,
      ikmal: 7,
      toplama: 10,
      status: "active",
      coordination: "🚚 Bantaş Ekip-7 yönlendirme - Kartal AVM ikmal",
      avgSla: 2.1,
      color: "#8B5CF6",
      colorHover: "#7C3AED",
    },
    {
      id: "gizem",
      name: "Gizem",
      role: "Operatör",
      nms: ["İZMİR", "AYDIN", "DENİZLİ"],
      nmCenters: ["İZMİR NM", "DENİZLİ NM"],
      atmCount: 47,
      ikmal: 6,
      toplama: 14,
      status: "active",
      coordination: "📊 Performans analizi - Beyoğlu bölge raporu",
      avgSla: 1.9,
      color: "#EC4899",
      colorHover: "#DB2777",
    },
    {
      id: "nurgul",
      name: "Nurgül",
      role: "Operatör",
      nms: ["BURSA", "BALIKESİR", "ÇANAKKALE"],
      nmCenters: ["BURSA NM"],
      atmCount: 36,
      ikmal: 4,
      toplama: 8,
      status: "active",
      coordination: "🚚 Bantaş Ekip-5 koordine - Sancaktepe rota",
      avgSla: 2.6,
      color: "#06B6D4",
      colorHover: "#0891B2",
    },
  ]);
  const [editingOperator, setEditingOperator] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"nms" | "nmCenters" | "avgSla" | null>(null);
  const [newValue, setNewValue] = useState("");
  
  // Tarih aralıkları her operatör için
  const [operatorDateRanges, setOperatorDateRanges] = useState<{[key: string]: {start: string, end: string}}>({});

  const handleAddItem = (operatorId: string, field: "nms" | "nmCenters" | "avgSla") => {
    setEditingOperator(operatorId);
    setEditingField(field);
    if (field === "avgSla") {
      const op = operators.find(o => o.id === operatorId);
      setNewValue(op?.avgSla.toString() || "");
    } else {
      setNewValue("");
    }
  };

  const handleSaveItem = () => {
    if (!editingOperator || !editingField || !newValue.trim()) return;
    
    setOperators(prev => prev.map(op => {
      if (op.id === editingOperator) {
        if (editingField === "avgSla") {
          return {
            ...op,
            avgSla: parseFloat(newValue) || op.avgSla
          };
        }
        return {
          ...op,
          [editingField]: [...op[editingField], newValue.trim()]
        };
      }
      return op;
    }));
    
    setEditingOperator(null);
    setEditingField(null);
    setNewValue("");
  };

  const handleRemoveItem = (operatorId: string, field: "nms" | "nmCenters", value: string) => {
    setOperators(prev => prev.map(op => {
      if (op.id === operatorId) {
        return {
          ...op,
          [field]: op[field].filter(item => item !== value)
        };
      }
      return op;
    }));
  };

  // Vardiya Yönetimi Fonksiyonları
  const handleAddPersonnel = () => {
    if (newPersonnelName.trim()) {
      setShiftPersonnel([...shiftPersonnel, newPersonnelName.trim()]);
      setNewPersonnelName('');
      setShowAddPersonnelModal(false);
    }
  };

  const handleRemovePersonnel = (index: number) => {
    setShiftPersonnel(shiftPersonnel.filter((_, i) => i !== index));
  };

  const handleEditPersonnel = (index: number, newName: string) => {
    const updated = [...shiftPersonnel];
    updated[index] = newName;
    setShiftPersonnel(updated);
    setEditingPersonnelIndex(null);
  };

  const handleShiftClick = (personnel: string, date: string) => {
    setSelectedPersonnel(personnel);
    setSelectedDate(date);
    setShowShiftModal(true);
  };

  const handleSaveShift = () => {
    if (selectedPersonnel && selectedDate) {
      const newShift: PersonnelShift = {
        operatorId: selectedPersonnel,
        date: selectedDate,
        shift: selectedShiftType,
        hours: selectedShiftType === 'Gündüz' ? '08:00-17:00' : selectedShiftType === 'Akşam' ? '17:00-00:00' : '',
      };
      setShifts([...shifts.filter(s => !(s.operatorId === selectedPersonnel && s.date === selectedDate)), newShift]);
      setShowShiftModal(false);
      setSelectedPersonnel(null);
      setSelectedDate(null);
    }
  };

  const getShiftForPersonnelAndDate = (personnel: string, date: string): ShiftType => {
    const shift = shifts.find(s => s.operatorId === personnel && s.date === date);
    if (shift) return shift.shift;
    
    // Mock default pattern
    const dayOfWeek = new Date(date).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return 'Tatil';
    if (personnel === 'Gizem') return 'Akşam';
    return 'Gündüz';
  };

  const handleBulkSaveShift = () => {
    if (!bulkPersonnel || !bulkStartDate || !bulkEndDate) return;
    
    const start = new Date(bulkStartDate);
    const end = new Date(bulkEndDate);
    const newShifts: PersonnelShift[] = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay(); // 0=Paz, 1=Pzt, ..., 6=Cmt
      const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek; // 1=Pzt, ..., 7=Paz
      
      if (bulkDays.includes(adjustedDay)) {
        const dateStr = d.toISOString().split('T')[0];
        const newShift: PersonnelShift = {
          operatorId: bulkPersonnel,
          date: dateStr,
          shift: bulkShiftType,
          hours: bulkShiftType === 'Gündüz' ? '08:00-17:00' : bulkShiftType === 'Akşam' ? '17:00-00:00' : '',
        };
        newShifts.push(newShift);
      }
    }
    
    // Remove existing shifts for same personnel and dates, then add new ones
    setShifts(prev => {
      const filtered = prev.filter(s => {
        const shiftDate = new Date(s.date);
        return !(s.operatorId === bulkPersonnel && shiftDate >= start && shiftDate <= end);
      });
      return [...filtered, ...newShifts];
    });
    
    setShowBulkShiftModal(false);
    setBulkPersonnel('');
    setBulkStartDate('');
    setBulkEndDate('');
    setBulkDays([1, 2, 3, 4, 5]);
  };

  const handleAssignOnDuty = () => {
    if (!selectedOnDutyDate || !selectedOnDutyPersonnel) return;
    
    // Remove existing assignment for this date, then add new one
    setOnDutyAssignments(prev => {
      const filtered = prev.filter(a => a.date !== selectedOnDutyDate);
      return [...filtered, { date: selectedOnDutyDate, personnel: selectedOnDutyPersonnel }];
    });
    
    setSelectedOnDutyPersonnel('');
  };

  const getOnDutyPersonnel = (date: string): string | null => {
    const assignment = onDutyAssignments.find(a => a.date === date);
    return assignment ? assignment.personnel : null;
  };

  const handleExportOnDuty = () => {
    let csvContent = '\uFEFFNöbetçi Personel Listesi\n';
    csvContent += `Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}\n\n`;
    csvContent += 'Tarih,Personel,Durum\n';
    
    const sortedAssignments = [...onDutyAssignments].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    sortedAssignments.forEach(assignment => {
      const today = new Date().toISOString().split('T')[0];
      const isPast = assignment.date < today;
      const isToday = assignment.date === today;
      const status = isToday ? 'BUGÜN' : isPast ? 'Geçmiş' : 'Gelecek';
      
      csvContent += `${new Date(assignment.date).toLocaleDateString('tr-TR')},${assignment.personnel},${status}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `nobetci_personel_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleExportShiftSchedule = () => {
    const startDate = shiftDateRange.start || new Date().toISOString().split('T')[0];
    const endDate = shiftDateRange.end || new Date().toISOString().split('T')[0];
    
    let csvContent = '\uFEFFVardiya Takvimi\n';
    csvContent += `Dönem: ${new Date(startDate).toLocaleDateString('tr-TR')} - ${new Date(endDate).toLocaleDateString('tr-TR')}\n\n`;
    csvContent += 'Personel,Tarih,Vardiya,Saat Aralığı\n';
    
    shiftPersonnel.forEach(personnel => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const shift = getShiftForPersonnelAndDate(personnel, dateStr);
        const hours = shift === 'Gündüz' ? '08:00-17:00' : shift === 'Akşam' ? '17:00-00:00' : '-';
        csvContent += `${personnel},${new Date(dateStr).toLocaleDateString('tr-TR')},${shift},${hours}\n`;
      }
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vardiya_takvimi_${startDate}_${endDate}.csv`;
    link.click();
  };

  const handleExportOperatorHistory = (operator: Operator) => {
    const dateRange = operatorDateRanges[operator.id] || { start: '', end: '' };
    const dateStr = dateRange.start && dateRange.end 
      ? `${new Date(dateRange.start).toLocaleDateString('tr-TR')} - ${new Date(dateRange.end).toLocaleDateString('tr-TR')}`
      : 'Tüm Dönem';
    
    const csvContent = `\uFEFF${operator.name} - Bölge Aktivite Raporu\nDönem: ${dateStr}\n\n` +
      `Sorumlu NM'ler,ATM Sayısı,İkmal,Toplama,Ortalama SLA,Durum\n` +
      `"${operator.nms.join(', ')}",${operator.atmCount},${operator.ikmal},${operator.toplama},${operator.avgSla} saat,Aktif\n\n` +
      `NM Merkezleri,Koordinasyon\n` +
      `"${operator.nmCenters.join(', ')}","${operator.coordination}"`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${operator.name.replace(' ', '_')}_${dateRange.start || 'tum'}_${dateRange.end || 'donem'}.csv`;
    link.click();
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/atm-master", { cache: "no-store" });
        const j = await r.json();
        const atmList = (j.atms || []) as ATM[];
        const activeAtms = atmList.filter((a) => a.active !== false);

        if (!alive) return;
        setAtms(activeAtms);

        const titles = ["CCDM Jam Tekrarı", "Sensor / Reset Etkisiz", "Network Timeout"] as const;
        const summaries = [
          "Son 7 günde 3 FLM + jam trendi",
          "Reset sonrası hata tekrarı",
          "Bağlantı kopmaları artıyor",
        ] as const;
        const actions = ["Dispatch SLM", "Remote Check", "Monitor"] as const;
        const etas = ["Today", "24h", "48h"] as const;
        const severities = ["High", "Medium", "Low"] as const;

        const mapped = activeAtms.slice(0, 3).map((a, idx) => ({
          id: `A-${1001 + idx}`,
          atm_id: String(a.atm_id),
          atm_name: a.atm_name || "N/A",
          city: a.city,
          district: a.district,
          severity: severities[idx % severities.length],
          title: titles[idx % titles.length],
          summary: summaries[idx % summaries.length],
          action: actions[idx % actions.length],
          eta: etas[idx % etas.length],
        }));

        if (!alive) return;
        setAlerts(mapped);
      } catch {
        if (!alive) return;
        setAlerts([]);
        setAtms([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
        <div className="text-lg font-semibold">Command Center</div>
        <div className="text-sm text-[#A7B8D8]">
          Proaktif alarmlar, aksiyonlar ve dispatch yönetimi
        </div>
      </div>

      {/* GÜNLÜK DASHBOARD/İSTATİSTİKLER */}
      <div className="bg-[#112544] rounded-2xl p-6 ring-1 ring-[#2B416B]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-lg font-semibold flex items-center gap-2">
              📊 ATM Cash Management
            </div>
            <div className="text-xs text-[#A7B8D8] mt-1">
              {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full bg-[#10B981]/20 text-[#10B981]">Canlı</span>
            <span className="text-xs text-[#A7B8D8]">
              Son güncelleme: {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* İstatistik Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Bugünkü Toplam Operasyon */}
          <div className="bg-gradient-to-br from-[#2E86FF]/20 to-[#0066FF]/10 rounded-xl p-5 ring-1 ring-[#2E86FF]/50">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-[#A7B8D8]">Bugünkü Operasyon</div>
              <div className="text-2xl">🚚</div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">147</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#10B981]">↓ 23 (13.5%)</span>
              <span className="text-[#A7B8D8]">önceki güne göre</span>
            </div>
            <div className="mt-3 pt-3 border-t border-[#2B416B]">
              <div className="flex justify-between text-xs">
                <span className="text-[#A7B8D8]">İkmal:</span>
                <span className="text-white font-semibold">89</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-[#A7B8D8]">Toplama:</span>
                <span className="text-white font-semibold">58</span>
              </div>
            </div>
          </div>

          {/* SLA Uyum Yüzdesi */}
          <div className="bg-gradient-to-br from-[#10B981]/20 to-[#059669]/10 rounded-xl p-5 ring-1 ring-[#10B981]/50">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-[#A7B8D8]">SLA Uyum</div>
              <div className="text-2xl">✓</div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">96.8%</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#10B981]">↑ 1.2%</span>
              <span className="text-[#A7B8D8]">geçen haftaya göre</span>
            </div>
            <div className="mt-3 pt-3 border-t border-[#2B416B]">
              <div className="flex justify-between text-xs">
                <span className="text-[#A7B8D8]">Hedef:</span>
                <span className="text-white font-semibold">95%</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-[#A7B8D8]">SLA Aşım:</span>
                <span className="text-[#EF4444] font-semibold">5 ATM</span>
              </div>
            </div>
          </div>

          {/* Ortalama Müdahale Süresi */}
          <div className="bg-gradient-to-br from-[#F2B705]/20 to-[#F59E0B]/10 rounded-xl p-5 ring-1 ring-[#F2B705]/50">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-[#A7B8D8]">Ortalama Müdahale</div>
              <div className="text-2xl">⏱️</div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">2.3 <span className="text-lg">saat</span></div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#10B981]">↓ 0.4 saat</span>
              <span className="text-[#A7B8D8]">daha hızlı</span>
            </div>
            <div className="mt-3 pt-3 border-t border-[#2B416B]">
              <div className="flex justify-between text-xs">
                <span className="text-[#A7B8D8]">En Hızlı:</span>
                <span className="text-[#10B981] font-semibold">0.8 saat</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-[#A7B8D8]">En Yavaş:</span>
                <span className="text-[#EF4444] font-semibold">4.5 saat</span>
              </div>
            </div>
          </div>

          {/* Aktif Personel */}
          <div className="bg-gradient-to-br from-[#8B5CF6]/20 to-[#7C3AED]/10 rounded-xl p-5 ring-1 ring-[#8B5CF6]/50">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-[#A7B8D8]">Aktif Personel</div>
              <div className="text-2xl">👥</div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">5 / 5</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#10B981]">✓ Tam kadro</span>
            </div>
            <div className="mt-3 pt-3 border-t border-[#2B416B]">
              <div className="flex justify-between text-xs">
                <span className="text-[#A7B8D8]">Vardiya:</span>
                <span className="text-white font-semibold">Gündüz</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-[#A7B8D8]">Bantaş Ekip:</span>
                <span className="text-white font-semibold">8 aktif</span>
              </div>
            </div>
          </div>
        </div>

        {/* En Yoğun Bölgeler */}
        <div className="bg-[#0E2142]/60 rounded-xl p-5 ring-1 ring-[#2B416B]">
          <div className="text-sm font-semibold mb-4 flex items-center gap-2">
            🔥 En Yoğun Bölgeler (Son 24 Saat)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Top 5 Bölgeler */}
            {[
              { rank: 1, name: "KOZYATAĞI", location: "İstanbul - Anadolu", ops: 34, sla: 3, owner: "Güneri K.", color: "EF4444" },
              { rank: 2, name: "ANKARA", location: "Ankara - Merkez", ops: 28, sla: 0, owner: "Özlem", color: "F2B705" },
              { rank: 3, name: "İZMİR", location: "İzmir - Ege", ops: 25, sla: 1, owner: "Gizem", color: "F2B705" },
              { rank: 4, name: "BURSA", location: "Bursa - Marmara", ops: 21, sla: 0, owner: "Nurgül", color: "10B981" },
              { rank: 5, name: "MALTEPE", location: "İstanbul - Anadolu", ops: 18, sla: 1, owner: "Güneri K.", color: "10B981" },
            ].map((region) => (
              <div 
                key={region.rank} 
                onClick={() => {
                  setSelectedRegion(region.name);
                  setShowRegionModal(true);
                }}
                className={`bg-[#0E2142] rounded-lg p-4 ring-1 ring-[#${region.color}]/50 cursor-pointer hover:bg-[#1A2F52] transition-all`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-lg font-bold text-white">{region.rank}.</div>
                  <div className={`w-8 h-8 rounded-full bg-[#${region.color}]/20 flex items-center justify-center text-xs font-bold`} style={{backgroundColor: `#${region.color}33`, color: `#${region.color}`}}>
                    #{region.rank}
                  </div>
                </div>
                <div className="text-sm font-semibold text-white mb-1">{region.name}</div>
                <div className="text-xs text-[#A7B8D8] mb-3">{region.location}</div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#A7B8D8]">Operasyon:</span>
                    <span className="font-bold" style={{color: `#${region.color}`}}>{region.ops}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#A7B8D8]">SLA Aşım:</span>
                    <span className={`font-bold ${region.sla === 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{region.sla}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#A7B8D8]">Sorumlu:</span>
                    <span className="text-white font-semibold">{region.owner}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
          <div className="text-sm font-semibold mb-2">Dispatch</div>
          <div className="text-xs text-[#A7B8D8] mb-3">
            SLM / FLM aksiyon başlat
          </div>
          <button className="w-full px-3 py-2 rounded-xl bg-[#2E86FF] hover:bg-[#1F6FE0] transition text-sm">
            Create Dispatch
          </button>
        </div>

        <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
          <div className="text-sm font-semibold mb-2">Remote Ops</div>
          <div className="text-xs text-[#A7B8D8] mb-3">
            Reset / test / config
          </div>
          <button className="w-full px-3 py-2 rounded-xl bg-[#2E86FF] hover:bg-[#1F6FE0] transition text-sm">
            Run Remote Action
          </button>
        </div>

        <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
          <div className="text-sm font-semibold mb-2">Escalation</div>
          <div className="text-xs text-[#A7B8D8] mb-3">
            SLA / yönetici bildirimi
          </div>
          <button className="w-full px-3 py-2 rounded-xl bg-[#2E86FF] hover:bg-[#1F6FE0] transition text-sm">
            Escalate
          </button>
        </div>
      </div>

      {/* Budget Performance Quick Link */}
      <div className="bg-gradient-to-br from-[#10B981]/10 via-[#059669]/5 to-[#047857]/10 rounded-xl p-6 ring-1 ring-[#10B981]/30 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="text-2xl">💰</div>
              <div>
                <div className="text-lg font-bold text-white">2026 Bütçe Performansı</div>
                <div className="text-sm text-[#A7B8D8]">Detaylı maliyet analizi ve tasarruf takibi</div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="bg-[#0E2142]/60 rounded-lg p-3">
                <div className="text-xs text-[#A7B8D8] mb-1">YTD Tasarruf</div>
                <div className="text-xl font-bold text-[#F59E0B]">₺14.8M</div>
                <div className="text-xs text-[#F59E0B]">%5.5</div>
              </div>
              <div className="bg-[#0E2142]/60 rounded-lg p-3">
                <div className="text-xs text-[#A7B8D8] mb-1">Yıl Sonu Hedef</div>
                <div className="text-xl font-bold text-[#10B981]">₺227M</div>
                <div className="text-xs text-[#10B981]">%14.2</div>
              </div>
              <div className="bg-[#0E2142]/60 rounded-lg p-3">
                <div className="text-xs text-[#A7B8D8] mb-1">Motor Hedefi</div>
                <div className="text-xl font-bold text-[#8B5CF6]">₺291M</div>
                <div className="text-xs text-[#8B5CF6]">%18.2</div>
              </div>
              <div className="bg-[#0E2142]/60 rounded-lg p-3">
                <div className="text-xs text-[#A7B8D8] mb-1">Durum</div>
                <div className="text-sm font-bold text-[#F59E0B]">AI Pilot</div>
                <div className="text-xs text-[#F59E0B]">Mart 2026</div>
              </div>
            </div>
          </div>
          <a 
            href="/budget-performance"
            className="px-6 py-3 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg font-semibold transition flex items-center gap-2 shadow-lg shadow-[#10B981]/20"
          >
            <span>📊</span>
            Detaylı Analiz
          </a>
        </div>
      </div>
    </div>
  );
}

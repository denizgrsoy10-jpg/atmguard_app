"use client";

import { useEffect, useState, useMemo } from "react";
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
  // Performance Management ekibi için telefon metrikleri
  callsOutgoing?: number;  // Aranan (giden) çağrı
  callsIncoming?: number;  // Gelen çağrı
  callsDurationOutgoing?: number;  // Giden çağrı süresi (dakika)
  callsDurationIncoming?: number;  // Gelen çağrı süresi (dakika)
  callScore?: number;  // Çağrı performans puanı (0-100)
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
    'Güneri Kerim', 'Murat', 'Özlem', 'Gizem', 'Nurgül',
    'Ahmet Yılmaz', 'Zeynep Kara', 'Mehmet Demir'
  ]);
  const [showAddPersonnelModal, setShowAddPersonnelModal] = useState(false);
  const [addPersonnelTeam, setAddPersonnelTeam] = useState<'cash' | 'performance'>('cash'); // Hangi ekip için personel ekleniyor
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
  const [showRemoveConfirmModal, setShowRemoveConfirmModal] = useState(false);
  const [removeOperatorData, setRemoveOperatorData] = useState<{id: string, name: string, team: 'cash' | 'performance'} | null>(null);
  const [showOnDutyModal, setShowOnDutyModal] = useState(false);
  const [onDutyAssignments, setOnDutyAssignments] = useState<{date: string, personnel: string}[]>([]);
  const [selectedOnDutyDate, setSelectedOnDutyDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedOnDutyPersonnel, setSelectedOnDutyPersonnel] = useState<string>('');
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [escalationEmails, setEscalationEmails] = useState<string>('');
  const [escalationSubject, setEscalationSubject] = useState<string>('');
  const [atmLocationFilter, setAtmLocationFilter] = useState<'all' | 'branch' | 'offsite'>('all'); // Şube/Offsite filtresi
  const [cashManagementExpanded, setCashManagementExpanded] = useState(false); // Cash Management kartı collapsible
  const [performanceManagementExpanded, setPerformanceManagementExpanded] = useState(false); // Performance Management kartı collapsible
  
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
      name: "Güneri kerim Uluğbay",
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
      name: "Murat Usta",
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
      name: "Özlem Öksüz",
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
      name: "Gizem Kırma Tahmaz",
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
      name: "Nurgül Kırıcı",
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

  // ATM Performance Management Ekibi (7/24 Arıza Takip & SLM Koordinasyon)
  const [performanceTeam, setPerformanceTeam] = useState<Operator[]>([
    {
      id: "performans1",
      name: "Mustafa Erkut ADA",
      role: "Kıdemli Koordinatör",
      nms: ["KOZYATAĞI", "MALTEPE", "GÜNEŞLİ", "BEYLİKDÜZÜ"],
      nmCenters: ["KOZYATAĞI NM", "GÜNEŞLİ NM"],
      atmCount: 85,
      ikmal: 0,
      toplama: 0,
      status: "active",
      coordination: "📞 12 arıza takibi aktif - 3 SLM çağrı koordine ediliyor",
      avgSla: 1.8,
      color: "#EF4444",
      colorHover: "#DC2626",
      callsOutgoing: 47,
      callsIncoming: 23,
      callsDurationOutgoing: 285,
      callsDurationIncoming: 142,
      callScore: 92,
    },
    {
      id: "performans2",
      name: "Ozan Narin Derviş",
      role: "Saha Koordinatörü",
      nms: ["ANKARA", "ESKİŞEHİR", "KONYA", "KAYSERİ"],
      nmCenters: ["ANKARA NM", "KONYA NM"],
      atmCount: 72,
      ikmal: 0,
      toplama: 0,
      status: "active",
      coordination: "🔧 8 arıza bildirimi - 2 SLM saha çağrısı bekleniyor",
      avgSla: 2.1,
      color: "#F59E0B",
      colorHover: "#D97706",
      callsOutgoing: 38,
      callsIncoming: 19,
      callsDurationOutgoing: 231,
      callsDurationIncoming: 108,
      callScore: 85,
    },
    {
      id: "performans3",
      name: "Adem Yıldız",
      role: "Arıza Koordinatörü",
      nms: ["İZMİR", "AYDIN", "DENİZLİ", "MUĞLA"],
      nmCenters: ["İZMİR NM", "DENİZLİ NM"],
      atmCount: 68,
      ikmal: 0,
      toplama: 0,
      status: "active",
      coordination: "⚠️ 5 kritik arıza - İzmir bölge SLM talep ediliyor",
      avgSla: 1.6,
      color: "#10B981",
      colorHover: "#059669",
      callsOutgoing: 52,
      callsIncoming: 28,
      callsDurationOutgoing: 318,
      callsDurationIncoming: 164,
      callScore: 96,
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
    
    // Update operators state
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
    
    // Update performanceTeam state
    setPerformanceTeam(prev => prev.map(op => {
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
    // Update operators state
    setOperators(prev => prev.map(op => {
      if (op.id === operatorId) {
        return {
          ...op,
          [field]: op[field].filter(item => item !== value)
        };
      }
      return op;
    }));
    
    // Update performanceTeam state
    setPerformanceTeam(prev => prev.map(op => {
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
      // Shift listesine ekle
      setShiftPersonnel([...shiftPersonnel, newPersonnelName.trim()]);
      
      // Eğer performance ekibi için eklendiyse, performanceTeam'e de ekle
      if (addPersonnelTeam === 'performance') {
        const colors = ['#8B5CF6', '#EC4899', '#06B6D4', '#F59E0B'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const newOperator: Operator = {
          id: `performans${performanceTeam.length + 1}`,
          name: newPersonnelName.trim(),
          role: 'Koordinatör',
          nms: [],
          nmCenters: [],
          atmCount: 0,
          ikmal: 0,
          toplama: 0,
          status: 'active',
          coordination: '🔍 Yeni atandı - Bölge yönetimi bekleniyor',
          avgSla: 0,
          color: randomColor,
          colorHover: randomColor,
          callsOutgoing: 0,
          callsIncoming: 0,
          callsDurationOutgoing: 0,
          callsDurationIncoming: 0,
          callScore: 0,
        };
        setPerformanceTeam([...performanceTeam, newOperator]);
      }
      
      // Eğer cash management ekibi için eklendiyse, operators'a da ekle
      if (addPersonnelTeam === 'cash') {
        const colors = ['#2E86FF', '#F2B705', '#8B5CF6', '#EC4899', '#06B6D4'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const newOperator: Operator = {
          id: `operator${operators.length + 1}`,
          name: newPersonnelName.trim(),
          role: 'Operatör',
          nms: [],
          nmCenters: [],
          atmCount: 0,
          ikmal: 0,
          toplama: 0,
          status: 'active',
          coordination: '🔍 Yeni atandı - Bölge ve ikmal/toplama ataması bekleniyor',
          avgSla: 0,
          color: randomColor,
          colorHover: randomColor,
        };
        setOperators([...operators, newOperator]);
      }
      
      setNewPersonnelName('');
      setShowAddPersonnelModal(false);
    }
  };

  const handleSendEscalation = () => {
    if (!escalationEmails.trim()) {
      alert('Lütfen en az bir mail adresi girin.');
      return;
    }
    
    // Mail gönderme simülasyonu (gerçek projede API entegrasyonu yapılabilir)
    const emailList = escalationEmails.split(',').map(e => e.trim()).filter(e => e);
    const mailContent = `
Konu: ${escalationSubject}

Alıcılar: ${emailList.join(', ')}

İçerik:
${generateEscalationMailTemplate()}

✅ Mail başarıyla gönderildi!`;
    
    alert(mailContent);
    setShowEscalationModal(false);
    setEscalationEmails('');
    setEscalationSubject('');
  };

  const generateEscalationMailTemplate = () => {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const formattedTime = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    
    return `
SAYIN YÖNETİCİM,

ATM CASH MANAGEMENT COMMAND CENTER - KRİTİK DURUM ESKALASYON RAPORU

📅 Tarih: ${formattedDate}
⏰ Saat: ${formattedTime}
${selectedRegion ? `🏦 Bölge: ${selectedRegion}\n` : ''}
⚠️ KRİTİK DURUM ÖZETİ:
• Yüksek risk ATM sayısı: ${filteredAlerts.filter(a => a.severity === 'High').length} adet
• Orta risk ATM sayısı: ${filteredAlerts.filter(a => a.severity === 'Medium').length} adet
• Aktif personel sayısı: ${operators.length + performanceTeam.length} kişi
• Bekleyen ikmal: ${operators.reduce((sum, op) => sum + op.ikmal, 0)} işlem
• Bekleyen toplama: ${operators.reduce((sum, op) => sum + op.toplama, 0)} işlem

🚨 ACIL MÜDAHALE GEREKEN DURUMLAR:
${filteredAlerts.filter(a => a.severity === 'High').slice(0, 5).map((alert, idx) => 
  `${idx + 1}. ${alert.atm_id} - ${alert.title}\n   Şehir: ${alert.city} / ${alert.district}\n   Aksiyon: ${alert.action}\n   Tahmini Süre: ${alert.eta}\n`
).join('\n')}

📊 PERFORMANS METRİKLERİ:
• Ortalama SLA süresi: ${(operators.reduce((sum, op) => sum + op.avgSla, 0) / operators.length).toFixed(1)} saat
• Toplam ATM sayısı: ${filteredAtms.length} adet
• Aktif izleme: ${operators.reduce((sum, op) => sum + op.atmCount, 0)} ATM

📞 EKIP DURUMU:
Cash Management Ekibi: ${operators.length} kişi
Performance Management: ${performanceTeam.length} kişi

ℹ️ Detaylı bilgi ve canlı takip için Command Center Dashboard'ı inceleyebilirsiniz.

Saygılarımla,
ATM Cash Management Command Center
Otomatik Eskalasyon Sistemi
    `.trim();
  };

  const handleRemoveOperator = (operatorId: string, operatorName: string, team: 'cash' | 'performance') => {
    setRemoveOperatorData({ id: operatorId, name: operatorName, team });
    setShowRemoveConfirmModal(true);
  };

  const confirmRemoveOperator = () => {
    if (removeOperatorData) {
      // Shift listesinden kaldır
      setShiftPersonnel(prev => prev.filter(p => p !== removeOperatorData.name));
      
      // İlgili ekipten kaldır
      if (removeOperatorData.team === 'cash') {
        setOperators(prev => prev.filter(op => op.id !== removeOperatorData.id));
      } else {
        setPerformanceTeam(prev => prev.filter(op => op.id !== removeOperatorData.id));
      }
      
      setShowRemoveConfirmModal(false);
      setRemoveOperatorData(null);
    }
  };

  const handleEditPersonnel = (index: number, newName: string) => {
    const updated = [...shiftPersonnel];
    updated[index] = newName;
    setShiftPersonnel(updated);
    setEditingPersonnelIndex(null);
  };

  const handleRemovePersonnel = (index: number) => {
    const personnelName = shiftPersonnel[index];
    if (confirm(`"${personnelName}" kişisini vardiya listesinden çıkarmak istediğinize emin misiniz?`)) {
      const updated = shiftPersonnel.filter((_, i) => i !== index);
      setShiftPersonnel(updated);
      // İlgili vardiya kayıtlarını da temizle
      setShifts(shifts.filter(s => s.operatorId !== personnelName));
    }
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

  // Filtrelenmiş veri - selectedRegion'a göre
  const filteredAlerts = useMemo(() => {
    if (!selectedRegion) return alerts;
    // Alerts için cash_center kontrolü yapamıyoruz çünkü alert'te cash_center yok
    // Bunun yerine atm_id ile eşleştirme yapalım
    const regionAtmIds = atms
      .filter(atm => atm.cash_center === selectedRegion)
      .map(atm => String(atm.atm_id));
    return alerts.filter(alert => regionAtmIds.includes(alert.atm_id));
  }, [alerts, atms, selectedRegion]);

  const filteredAtms = useMemo(() => {
    if (!selectedRegion) return atms;
    return atms.filter(atm => atm.cash_center === selectedRegion);
  }, [atms, selectedRegion]);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
        <div className="text-lg font-semibold">🎯 Komuta Merkezi / Command Center</div>
        <div className="text-sm text-[#A7B8D8]">
          Proaktif alarmlar, aksiyonlar ve dispatch yönetimi / Proactive alerts, actions and dispatch management
        </div>
      </div>

      {/* GÜNLÜK DASHBOARD/İSTATİSTİKLER */}
      <div className="bg-[#112544] rounded-2xl p-6 ring-1 ring-[#2B416B]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-lg font-semibold flex items-center gap-2">
              � ATM Cash Management
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

        {/* En Yoğun Nakit Merkezleri */}
        <div className="bg-[#0E2142]/60 rounded-xl p-5 ring-1 ring-[#2B416B]">
          <div className="text-sm font-semibold mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              🔥 En Yoğun Nakit Merkezleri (Son 24 Saat)
              {selectedRegion && (
                <span className="text-xs px-2 py-1 rounded-full bg-[#2E86FF]/20 text-[#2E86FF]">
                  Filtrelendi: {selectedRegion}
                </span>
              )}
            </div>
            {selectedRegion && (
              <button
                onClick={() => setSelectedRegion(null)}
                className="px-3 py-1 text-xs rounded-lg font-semibold bg-[#A7B8D8]/20 text-[#A7B8D8] hover:bg-[#A7B8D8]/30 transition"
              >
                ✕ Tüm NM'leri Göster
              </button>
            )}
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
                }}
                className={`bg-[#0E2142] rounded-lg p-4 ring-1 ring-[#${region.color}]/50 cursor-pointer hover:bg-[#1A2F52] transition-all ${
                  selectedRegion === region.name ? 'ring-2 ring-[#2E86FF]' : ''
                }`}
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
      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
        <div className="bg-[#112544] rounded-2xl p-4 ring-1 ring-[#2B416B]">
          <div className="text-sm font-semibold mb-2">Escalation</div>
          <div className="text-xs text-[#A7B8D8] mb-3">
            SLA / yönetici bildirimi
          </div>
          
          <button 
            onClick={() => {
              setEscalationSubject('🚨 ATM COMMAND CENTER - Kritik Durum Eskalasyonu');
              setShowEscalationModal(true);
            }}
              className="w-full px-3 py-2 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] transition text-sm font-semibold"
            >
              📧 Yönetici Bildirimi Gönder
            </button>
        </div>
      </div>

      {/* ESCALATION MODAL */}
      {showEscalationModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowEscalationModal(false)}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-3xl overflow-hidden ring-1 ring-[#EF4444]/50" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#EF4444]/20 to-[#DC2626]/10 p-6 border-b border-[#EF4444]/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#EF4444]/20 flex items-center justify-center text-2xl">
                    📧
                  </div>
                  <div>
                    <div className="text-xl font-bold text-white">Yönetici Eskalasyon Bildirimi</div>
                    <div className="text-xs text-[#A7B8D8]">
                      Kritik durum mail bildirimi hazırla ve gönder
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowEscalationModal(false)} className="text-white/60 hover:text-white text-2xl">×</button>
              </div>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Mail Bilgileri */}
              <div className="mb-4">
                <label className="text-sm text-[#A7B8D8] mb-2 block">Alıcı Mail Adresleri (virgülle ayırın)</label>
                <input
                  type="text"
                  value={escalationEmails}
                  onChange={(e) => setEscalationEmails(e.target.value)}
                  placeholder="ornek@firma.com, yonetici@firma.com, mudur@firma.com"
                  className="w-full px-4 py-3 rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:border-[#2E86FF] text-sm"
                  autoFocus
                />
              </div>

              <div className="mb-4">
                <label className="text-sm text-[#A7B8D8] mb-2 block">Mail Konusu</label>
                <input
                  type="text"
                  value={escalationSubject}
                  onChange={(e) => setEscalationSubject(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:border-[#2E86FF] text-sm"
                />
              </div>

              {/* Mail Önizleme */}
              <div className="mb-4">
                <label className="text-sm text-[#A7B8D8] mb-2 block">Mail İçeriği Önizleme</label>
                <div className="bg-[#0E2142] rounded-lg p-4 border border-[#2B416B] max-h-96 overflow-y-auto">
                  <pre className="text-xs text-white whitespace-pre-wrap font-mono leading-relaxed">
                    {generateEscalationMailTemplate()}
                  </pre>
                </div>
              </div>

              {/* Uyarı Mesajı */}
              <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <span className="text-lg">⚠️</span>
                  <div className="text-xs text-[#F59E0B]">
                    <div className="font-semibold mb-1">Önemli Bilgilendirme:</div>
                    <div>Bu bildirim kritik durum eskalasyonudur. Lütfen doğru alıcıları kontrol edin.</div>
                  </div>
                </div>
              </div>

              {/* Butonlar */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSendEscalation}
                  className="flex-1 px-4 py-3 bg-[#EF4444] hover:bg-[#DC2626] text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
                >
                  <span>📨</span>
                  <span>Mail Gönder</span>
                </button>
                <button
                  onClick={() => {
                    setShowEscalationModal(false);
                    setEscalationEmails('');
                  }}
                  className="flex-1 px-4 py-3 bg-[#2B416B] hover:bg-[#3B517B] text-white font-semibold rounded-lg transition"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VARDİYA YÖNETİMİ MODAL */}
      {showShiftManagementModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowShiftManagementModal(false)}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden ring-1 ring-[#2B416B]" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#1E3A5F] to-[#112544] p-6 border-b border-[#2B416B]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    👥 Vardiya Yönetimi
                  </div>
                  <div className="text-sm text-[#A7B8D8]">
                    Personel mesai takvimi, aktif/pasif vardiya ve izin takibi
                  </div>
                </div>
                <button 
                  onClick={() => setShowShiftManagementModal(false)}
                  className="text-white/60 hover:text-white text-2xl w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Personel Yönetimi ve Tarih Range/Excel */}
              <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B] mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold text-white">Personel Listesi ({shiftPersonnel.length})</div>
                  <div className="flex items-center gap-3">
                    {/* Tarih Aralığı */}
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={shiftDateRange.start}
                        onChange={(e) => setShiftDateRange({...shiftDateRange, start: e.target.value})}
                        className="px-3 py-1.5 rounded-lg bg-[#112544] text-white text-xs border border-[#2B416B] focus:outline-none focus:border-[#2E86FF]"
                      />
                      <span className="text-white text-xs">-</span>
                      <input
                        type="date"
                        value={shiftDateRange.end}
                        onChange={(e) => setShiftDateRange({...shiftDateRange, end: e.target.value})}
                        className="px-3 py-1.5 rounded-lg bg-[#112544] text-white text-xs border border-[#2B416B] focus:outline-none focus:border-[#2E86FF]"
                      />
                    </div>
                    
                    {/* Excel Export */}
                    <button
                      onClick={handleExportShiftSchedule}
                      className="px-4 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-xs font-semibold transition flex items-center gap-2"
                    >
                      📊 Excel İndir
                    </button>
                    
                    {/* Toplu Vardiya Planla */}
                    <button
                      onClick={() => setShowBulkShiftModal(true)}
                      className="px-4 py-1.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-semibold transition flex items-center gap-2"
                    >
                      📅 Toplu Vardiya
                    </button>
                    
                    {/* Nöbetçi Personel */}
                    <button
                      onClick={() => setShowOnDutyModal(true)}
                      className="px-4 py-1.5 rounded-lg bg-[#F2B705] hover:bg-[#F59E0B] text-white text-xs font-semibold transition flex items-center gap-2"
                    >
                      👮 Nöbetçi
                    </button>
                    
                    {/* Personel Ekle */}
                    <button
                      onClick={() => setShowAddPersonnelModal(true)}
                      className="px-4 py-1.5 rounded-lg bg-[#2E86FF] hover:bg-[#0066FF] text-white text-xs font-semibold transition flex items-center gap-2"
                    >
                      + Personel Ekle
                    </button>
                  </div>
                </div>
                
                {/* Personel Tags */}
                <div className="flex flex-wrap gap-2">
                  {shiftPersonnel.map((personnel, idx) => (
                    <div key={idx} className="bg-[#2E86FF]/20 rounded-lg px-3 py-2 ring-1 ring-[#2E86FF]/50 flex items-center gap-2 group">
                      {editingPersonnelIndex === idx ? (
                        <input
                          type="text"
                          defaultValue={personnel}
                          autoFocus
                          onBlur={(e) => handleEditPersonnel(idx, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEditPersonnel(idx, e.currentTarget.value);
                            if (e.key === 'Escape') setEditingPersonnelIndex(null);
                          }}
                          className="bg-[#112544] text-white text-sm px-2 py-1 rounded outline-none"
                        />
                      ) : (
                        <>
                          <span className="text-sm text-white font-semibold">{personnel}</span>
                          <button
                            onClick={() => setEditingPersonnelIndex(idx)}
                            className="opacity-0 group-hover:opacity-100 text-white/70 hover:text-white transition text-xs"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleRemovePersonnel(idx)}
                            className="opacity-0 group-hover:opacity-100 text-white/70 hover:text-[#EF4444] transition text-xs"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Hafta Navigasyonu */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedWeekOffset(selectedWeekOffset - 1)}
                    className="px-3 py-2 rounded-lg bg-[#2B416B] hover:bg-[#3B517B] text-white text-sm transition"
                  >
                    ← Önceki Hafta
                  </button>
                  <span className="text-sm text-white font-semibold">
                    {(() => {
                      const today = new Date();
                      const weekStart = new Date(today);
                      weekStart.setDate(today.getDate() - today.getDay() + 1 + (selectedWeekOffset * 7));
                      const weekEnd = new Date(weekStart);
                      weekEnd.setDate(weekStart.getDate() + 6);
                      return `${weekStart.getDate()} - ${weekEnd.getDate()} ${weekEnd.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}`;
                    })()}
                  </span>
                  <button
                    onClick={() => setSelectedWeekOffset(selectedWeekOffset + 1)}
                    className="px-3 py-2 rounded-lg bg-[#2B416B] hover:bg-[#3B517B] text-white text-sm transition"
                  >
                    Sonraki Hafta →
                  </button>
                </div>
                <button
                  onClick={() => setSelectedWeekOffset(0)}
                  className="px-4 py-2 rounded-lg bg-[#2E86FF] hover:bg-[#1F6FE0] text-white text-sm font-semibold transition"
                >
                  Bu Hafta
                </button>
              </div>

              {/* Vardiya Takvimi */}
              <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B] mb-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-3 text-xs text-[#A7B8D8] font-semibold border-b border-[#2B416B]">
                    Personel
                  </th>
                  {(() => {
                    const today = new Date();
                    const weekStart = new Date(today);
                    weekStart.setDate(today.getDate() - today.getDay() + 1 + (selectedWeekOffset * 7));
                    const days = [];
                    for (let i = 0; i < 7; i++) {
                      const day = new Date(weekStart);
                      day.setDate(weekStart.getDate() + i);
                      days.push(day);
                    }
                    return days.map((day, idx) => {
                      const isToday = day.toDateString() === new Date().toDateString();
                      return (
                        <th key={idx} className={`text-center p-3 text-xs font-semibold border-b border-[#2B416B] ${isToday ? 'bg-[#2E86FF]/20 text-[#2E86FF]' : 'text-[#A7B8D8]'}`}>
                          <div>{['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'][day.getDay() === 0 ? 6 : day.getDay() - 1]}</div>
                          <div className="text-xs mt-1">{day.getDate()}/{day.getMonth() + 1}</div>
                        </th>
                      );
                    });
                  })()}
                </tr>
              </thead>
              <tbody>
                {shiftPersonnel.map((personnel, personnelIdx) => {
                  const today = new Date();
                  const weekStart = new Date(today);
                  weekStart.setDate(today.getDate() - today.getDay() + 1 + (selectedWeekOffset * 7));
                  const days = [];
                  for (let i = 0; i < 7; i++) {
                    const day = new Date(weekStart);
                    day.setDate(weekStart.getDate() + i);
                    days.push(day);
                  }

                  return (
                    <tr key={personnelIdx} className="border-b border-[#2B416B]/50 hover:bg-[#1A2F52]/30 transition">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2E86FF] to-[#0066FF] flex items-center justify-center text-xs font-bold text-white">
                            {personnel.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm text-white font-semibold">{personnel}</div>
                            <div className="text-xs text-[#A7B8D8]">Personel</div>
                          </div>
                        </div>
                      </td>
                      {days.map((day, idx) => {
                        const dateStr = day.toISOString().split('T')[0];
                        const shift = getShiftForPersonnelAndDate(personnel, dateStr);
                        const isToday = day.toDateString() === new Date().toDateString();
                        const shiftColors = {
                          'Gündüz': { bg: 'bg-[#2E86FF]/20', text: 'text-[#2E86FF]', ring: 'ring-[#2E86FF]/50', emoji: '☀️' },
                          'Akşam': { bg: 'bg-[#8B5CF6]/20', text: 'text-[#8B5CF6]', ring: 'ring-[#8B5CF6]/50', emoji: '🌆' },
                          'İzin': { bg: 'bg-[#F2B705]/20', text: 'text-[#F2B705]', ring: 'ring-[#F2B705]/50', emoji: '🏖️' },
                          'Tatil': { bg: 'bg-[#10B981]/20', text: 'text-[#10B981]', ring: 'ring-[#10B981]/50', emoji: '🎉' },
                          'Raporlu': { bg: 'bg-[#EF4444]/20', text: 'text-[#EF4444]', ring: 'ring-[#EF4444]/50', emoji: '🏥' },
                        };
                        const colors = shiftColors[shift];
                        
                        return (
                          <td key={idx} className={`p-2 text-center ${isToday ? 'bg-[#2E86FF]/10' : ''}`}>
                            <div 
                              onClick={() => handleShiftClick(personnel, dateStr)}
                              className={`${colors.bg} ${colors.text} rounded-lg p-2 ring-1 ${colors.ring} cursor-pointer hover:opacity-80 hover:scale-105 transition-all`}
                              title={`${shift} - Tıklayarak düzenle`}
                            >
                              <div className="text-lg mb-1">{colors.emoji}</div>
                              <div className="text-xs font-semibold">{shift}</div>
                              {shift === 'Gündüz' && <div className="text-[10px] mt-1 opacity-80">08:00-17:00</div>}
                              {shift === 'Akşam' && <div className="text-[10px] mt-1 opacity-80">17:00-00:00</div>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vardiya Özet İstatistikleri */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-[#2E86FF]/20 to-[#0066FF]/10 rounded-xl p-4 ring-1 ring-[#2E86FF]/50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xl">☀️</div>
              <div className="text-xs px-2 py-1 rounded-full bg-[#2E86FF]/20 text-[#2E86FF]">Aktif</div>
            </div>
            <div className="text-2xl font-bold text-white mb-1">4</div>
            <div className="text-xs text-[#A7B8D8]">Gündüz Vardiyası</div>
            <div className="text-[10px] text-[#A7B8D8] mt-1">08:00 - 17:00</div>
          </div>

          <div className="bg-gradient-to-br from-[#8B5CF6]/20 to-[#7C3AED]/10 rounded-xl p-4 ring-1 ring-[#8B5CF6]/50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xl">�</div>
              <div className="text-xs px-2 py-1 rounded-full bg-[#8B5CF6]/20 text-[#8B5CF6]">Aktif</div>
            </div>
            <div className="text-2xl font-bold text-white mb-1">1</div>
            <div className="text-xs text-[#A7B8D8]">Akşam Vardiyası</div>
            <div className="text-[10px] text-[#A7B8D8] mt-1">17:00 - 00:00</div>
          </div>

          <div className="bg-gradient-to-br from-[#F2B705]/20 to-[#F59E0B]/10 rounded-xl p-4 ring-1 ring-[#F2B705]/50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xl">🏖️</div>
              <div className="text-xs px-2 py-1 rounded-full bg-[#F2B705]/20 text-[#F2B705]">Planlı</div>
            </div>
            <div className="text-2xl font-bold text-white mb-1">1</div>
            <div className="text-xs text-[#A7B8D8]">İzinli Personel</div>
            <div className="text-[10px] text-[#A7B8D8] mt-1">Murat (Çarşamba)</div>
          </div>

          <div className="bg-gradient-to-br from-[#EF4444]/20 to-[#DC2626]/10 rounded-xl p-4 ring-1 ring-[#EF4444]/50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xl">🏥</div>
              <div className="text-xs px-2 py-1 rounded-full bg-[#EF4444]/20 text-[#EF4444]">Raporlu</div>
            </div>
            <div className="text-2xl font-bold text-white mb-1">1</div>
            <div className="text-xs text-[#A7B8D8]">Raporlu Personel</div>
            <div className="text-[10px] text-[#A7B8D8] mt-1">Nurgül (Per-Cum)</div>
          </div>

          <div className="bg-gradient-to-br from-[#10B981]/20 to-[#059669]/10 rounded-xl p-4 ring-1 ring-[#10B981]/50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xl">📊</div>
              <div className="text-xs px-2 py-1 rounded-full bg-[#10B981]/20 text-[#10B981]">Özet</div>
            </div>
            <div className="text-2xl font-bold text-white mb-1">100%</div>
            <div className="text-xs text-[#A7B8D8]">Vardiya Doluluk</div>
            <div className="text-[10px] text-[#10B981] mt-1">✓ Tam kapsama</div>
          </div>
        </div>

        {/* Yaklaşan İzinler/Raporlar */}
        <div className="mt-6 bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
          <div className="text-sm font-semibold mb-4 flex items-center gap-2">
            📅 Yaklaşan İzin & Raporlar
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-[#F2B705]/10 rounded-lg ring-1 ring-[#F2B705]/30">
              <div className="flex items-center gap-3">
                <div className="text-xl">🏖️</div>
                <div>
                  <div className="text-sm text-white font-semibold">Murat - Yıllık İzin</div>
                  <div className="text-xs text-[#A7B8D8]">10-14 Şubat 2026 (5 gün)</div>
                </div>
              </div>
              <div className="text-xs px-3 py-1 rounded-full bg-[#F2B705]/20 text-[#F2B705]">Onaylandı</div>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#EF4444]/10 rounded-lg ring-1 ring-[#EF4444]/30">
              <div className="flex items-center gap-3">
                <div className="text-xl">🏥</div>
                <div>
                  <div className="text-sm text-white font-semibold">Nurgül - Sağlık Raporu</div>
                  <div className="text-xs text-[#A7B8D8]">6-7 Şubat 2026 (2 gün)</div>
                </div>
              </div>
              <div className="text-xs px-3 py-1 rounded-full bg-[#EF4444]/20 text-[#EF4444]">Devam ediyor</div>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#8B5CF6]/10 rounded-lg ring-1 ring-[#8B5CF6]/30">
              <div className="flex items-center gap-3">
                <div className="text-xl">📅</div>
                <div>
                  <div className="text-sm text-white font-semibold">Özlem - Yıllık İzin Talebi</div>
                  <div className="text-xs text-[#A7B8D8]">20-24 Şubat 2026 (5 gün)</div>
                </div>
              </div>
              <div className="text-xs px-3 py-1 rounded-full bg-[#8B5CF6]/20 text-[#8B5CF6]">Beklemede</div>
            </div>
          </div>
        </div>

              {/* Modal Footer */}
              <div className="mt-6 flex items-center justify-between p-4 bg-[#0E2142]/60 rounded-lg ring-1 ring-[#2B416B]">
                <div className="text-xs text-[#A7B8D8]">
                  💡 Vardiya kartlarına tıklayarak düzenleme yapabilirsiniz
                </div>
                <button
                  onClick={() => setShowShiftManagementModal(false)}
                  className="px-6 py-2 bg-[#2E86FF] hover:bg-[#0066FF] text-white text-sm font-semibold rounded-lg transition-all"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PERSONEL SİLME ONAY MODAL */}
      {showRemoveConfirmModal && removeOperatorData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowRemoveConfirmModal(false)}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-md overflow-hidden ring-1 ring-[#EF4444]/50" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#EF4444]/20 to-[#DC2626]/10 p-6 border-b border-[#EF4444]/30">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#EF4444]/20 flex items-center justify-center text-2xl">
                  ⚠️
                </div>
                <div>
                  <div className="text-xl font-bold text-white">Personel Çıkar</div>
                  <div className="text-xs text-[#A7B8D8]">Bu işlem geri alınamaz</div>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <p className="text-white text-base mb-2">
                  <span className="font-bold text-[#EF4444]">{removeOperatorData.name}</span> kişisini ekipten çıkarmak istediğinize emin misiniz?
                </p>
                <div className="bg-[#0E2142]/60 rounded-lg p-3 mt-3">
                  <div className="text-xs text-[#A7B8D8] space-y-1">
                    <div>• Personel {removeOperatorData.team === 'cash' ? 'Cash Management' : 'ATM Performance'} ekibinden kaldırılacak</div>
                    <div>• Vardiya listesinden çıkarılacak</div>
                    <div>• Tüm atamalar silinecek</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={confirmRemoveOperator}
                  className="flex-1 px-4 py-3 bg-[#EF4444] hover:bg-[#DC2626] text-white font-semibold rounded-lg transition"
                >
                  Evet, Çıkar
                </button>
                <button
                  onClick={() => {
                    setShowRemoveConfirmModal(false);
                    setRemoveOperatorData(null);
                  }}
                  className="flex-1 px-4 py-3 bg-[#2B416B] hover:bg-[#3B517B] text-white font-semibold rounded-lg transition"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PERSONEL EKLE MODAL */}
      {showAddPersonnelModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddPersonnelModal(false)}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-md overflow-hidden ring-1 ring-[#2B416B]" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#1E3A5F] to-[#112544] p-6 border-b border-[#2B416B]">
              <div className="flex items-center justify-between">
                <div className="text-xl font-bold text-white">
                  ➕ Yeni Personel Ekle {addPersonnelTeam === 'performance' ? '(ATM Performance)' : '(Cash Management)'}
                </div>
                <button onClick={() => setShowAddPersonnelModal(false)} className="text-white/60 hover:text-white text-2xl">×</button>
              </div>
            </div>
            <div className="p-6">
              <label className="text-sm text-[#A7B8D8] mb-2 block">Personel Adı</label>
              <input
                type="text"
                value={newPersonnelName}
                onChange={(e) => setNewPersonnelName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPersonnel()}
                placeholder="Örn: Ahmet Yılmaz"
                className="w-full px-4 py-3 rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:border-[#2E86FF]"
                autoFocus
              />
              {addPersonnelTeam === 'performance' && (
                <div className="mt-3 text-xs text-[#A7B8D8] bg-[#0E2142]/60 rounded-lg p-3">
                  ℹ️ Yeni personel ATM Performance Management ekibine eklenecek. Bölge ve telefon metrikleri daha sonra düzenlenebilir.
                </div>
              )}
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={handleAddPersonnel}
                  className="flex-1 px-4 py-3 bg-[#2E86FF] hover:bg-[#0066FF] text-white font-semibold rounded-lg transition"
                >
                  Ekle
                </button>
                <button
                  onClick={() => setShowAddPersonnelModal(false)}
                  className="flex-1 px-4 py-3 bg-[#2B416B] hover:bg-[#3B517B] text-white font-semibold rounded-lg transition"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VARDİYA DÜZENLE MODAL */}
      {showShiftModal && selectedPersonnel && selectedDate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowShiftModal(false)}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-md overflow-hidden ring-1 ring-[#2B416B]" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#1E3A5F] to-[#112544] p-6 border-b border-[#2B416B]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-bold text-white">📅 Vardiya Düzenle</div>
                  <div className="text-sm text-[#A7B8D8] mt-1">
                    {selectedPersonnel} - {new Date(selectedDate).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
                <button onClick={() => setShowShiftModal(false)} className="text-white/60 hover:text-white text-2xl">×</button>
              </div>
            </div>
            <div className="p-6">
              <label className="text-sm text-[#A7B8D8] mb-3 block">Vardiya Tipi Seçin</label>
              <div className="grid grid-cols-2 gap-3">
                {(['Gündüz', 'Akşam', 'İzin', 'Tatil', 'Raporlu'] as ShiftType[]).map((shiftType) => {
                  const shiftIcons = {
                    'Gündüz': '☀️',
                    'Akşam': '🌆',
                    'İzin': '🏖️',
                    'Tatil': '🎉',
                    'Raporlu': '🏥',
                  };
                  const shiftColors = {
                    'Gündüz': 'from-[#2E86FF] to-[#0066FF]',
                    'Akşam': 'from-[#8B5CF6] to-[#7C3AED]',
                    'İzin': 'from-[#F2B705] to-[#F59E0B]',
                    'Tatil': 'from-[#10B981] to-[#059669]',
                    'Raporlu': 'from-[#EF4444] to-[#DC2626]',
                  };
                  return (
                    <button
                      key={shiftType}
                      onClick={() => setSelectedShiftType(shiftType)}
                      className={`p-4 rounded-lg bg-gradient-to-br ${shiftColors[shiftType]} ${selectedShiftType === shiftType ? 'ring-4 ring-white/50 scale-105' : 'opacity-60 hover:opacity-100'} transition-all`}
                    >
                      <div className="text-3xl mb-2">{shiftIcons[shiftType]}</div>
                      <div className="text-sm font-semibold text-white">{shiftType}</div>
                      {shiftType === 'Gündüz' && <div className="text-xs text-white/80 mt-1">08:00-17:00</div>}
                      {shiftType === 'Akşam' && <div className="text-xs text-white/80 mt-1">17:00-00:00</div>}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={handleSaveShift}
                  className="flex-1 px-4 py-3 bg-[#10B981] hover:bg-[#059669] text-white font-semibold rounded-lg transition"
                >
                  Kaydet
                </button>
                <button
                  onClick={() => setShowShiftModal(false)}
                  className="flex-1 px-4 py-3 bg-[#2B416B] hover:bg-[#3B517B] text-white font-semibold rounded-lg transition"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOPLU VARDİYA PLANLAMA MODAL */}
      {showBulkShiftModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowBulkShiftModal(false)}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-2xl overflow-hidden ring-1 ring-[#2B416B]" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] p-6 border-b border-[#2B416B]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-bold text-white">📅 Toplu Vardiya Planlama</div>
                  <div className="text-sm text-white/80 mt-1">
                    Belirli tarih aralığında haftalık vardiya düzeni oluşturun
                  </div>
                </div>
                <button onClick={() => setShowBulkShiftModal(false)} className="text-white/60 hover:text-white text-2xl">×</button>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Personel Seçimi */}
              <div>
                <label className="text-sm text-[#A7B8D8] mb-2 block font-semibold">👤 Personel Seçin</label>
                <select
                  value={bulkPersonnel}
                  onChange={(e) => setBulkPersonnel(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:border-[#8B5CF6]"
                >
                  <option value="">-- Personel seçin --</option>
                  {shiftPersonnel.map((personnel) => (
                    <option key={personnel} value={personnel}>{personnel}</option>
                  ))}
                </select>
              </div>

              {/* Tarih Aralığı */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-[#A7B8D8] mb-2 block font-semibold">📅 Başlangıç Tarihi</label>
                  <input
                    type="date"
                    value={bulkStartDate}
                    onChange={(e) => setBulkStartDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>
                <div>
                  <label className="text-sm text-[#A7B8D8] mb-2 block font-semibold">📅 Bitiş Tarihi</label>
                  <input
                    type="date"
                    value={bulkEndDate}
                    onChange={(e) => setBulkEndDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-[#0E2142] text-white border border-[#2B416B] focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>
              </div>

              {/* Vardiya Tipi Seçimi */}
              <div>
                <label className="text-sm text-[#A7B8D8] mb-3 block font-semibold">⏰ Vardiya Tipi</label>
                <div className="grid grid-cols-5 gap-3">
                  {(['Gündüz', 'Akşam', 'İzin', 'Tatil', 'Raporlu'] as ShiftType[]).map((shiftType) => {
                    const shiftIcons = {
                      'Gündüz': '☀️',
                      'Akşam': '🌆',
                      'İzin': '🏖️',
                      'Tatil': '🎉',
                      'Raporlu': '🏥',
                    };
                    const shiftColors = {
                      'Gündüz': 'from-[#2E86FF] to-[#0066FF]',
                      'Akşam': 'from-[#8B5CF6] to-[#7C3AED]',
                      'İzin': 'from-[#F2B705] to-[#F59E0B]',
                      'Tatil': 'from-[#10B981] to-[#059669]',
                      'Raporlu': 'from-[#EF4444] to-[#DC2626]',
                    };
                    return (
                      <button
                        key={shiftType}
                        onClick={() => setBulkShiftType(shiftType)}
                        className={`p-3 rounded-lg bg-gradient-to-br ${shiftColors[shiftType]} ${bulkShiftType === shiftType ? 'ring-4 ring-white/50 scale-105' : 'opacity-60 hover:opacity-100'} transition-all`}
                      >
                        <div className="text-2xl mb-1">{shiftIcons[shiftType]}</div>
                        <div className="text-xs font-semibold text-white">{shiftType}</div>
                        {shiftType === 'Gündüz' && <div className="text-[10px] text-white/80 mt-0.5">08:00-17:00</div>}
                        {shiftType === 'Akşam' && <div className="text-[10px] text-white/80 mt-0.5">17:00-00:00</div>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Gün Seçimi */}
              <div>
                <label className="text-sm text-[#A7B8D8] mb-3 block font-semibold">📆 Günler (Haftada hangi günler?)</label>
                <div className="grid grid-cols-7 gap-2">
                  {[
                    { day: 1, label: 'Pzt', name: 'Pazartesi' },
                    { day: 2, label: 'Sal', name: 'Salı' },
                    { day: 3, label: 'Çar', name: 'Çarşamba' },
                    { day: 4, label: 'Per', name: 'Perşembe' },
                    { day: 5, label: 'Cum', name: 'Cuma' },
                    { day: 6, label: 'Cmt', name: 'Cumartesi' },
                    { day: 7, label: 'Paz', name: 'Pazar' },
                  ].map(({ day, label, name }) => (
                    <button
                      key={day}
                      onClick={() => {
                        if (bulkDays.includes(day)) {
                          setBulkDays(bulkDays.filter(d => d !== day));
                        } else {
                          setBulkDays([...bulkDays, day].sort());
                        }
                      }}
                      className={`p-3 rounded-lg transition-all ${
                        bulkDays.includes(day)
                          ? 'bg-[#8B5CF6] ring-2 ring-[#8B5CF6]/50 scale-105'
                          : 'bg-[#0E2142] hover:bg-[#1E3A5F] ring-1 ring-[#2B416B]'
                      }`}
                      title={name}
                    >
                      <div className="text-sm font-bold text-white">{label}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-xs text-[#A7B8D8]">
                  💡 Seçili günler: {bulkDays.length === 0 ? 'Hiç gün seçilmedi' : bulkDays.length === 7 ? 'Tüm hafta' : `${bulkDays.length} gün`}
                </div>
              </div>

              {/* Kaydet/İptal Butonları */}
              <div className="flex items-center gap-3 pt-4 border-t border-[#2B416B]">
                <button
                  onClick={handleBulkSaveShift}
                  disabled={!bulkPersonnel || !bulkStartDate || !bulkEndDate || bulkDays.length === 0}
                  className="flex-1 px-4 py-3 bg-[#10B981] hover:bg-[#059669] disabled:bg-[#2B416B] disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
                >
                  💾 Kaydet ve Uygula
                </button>
                <button
                  onClick={() => {
                    setShowBulkShiftModal(false);
                    setBulkPersonnel('');
                    setBulkStartDate('');
                    setBulkEndDate('');
                    setBulkDays([1, 2, 3, 4, 5]);
                  }}
                  className="flex-1 px-4 py-3 bg-[#2B416B] hover:bg-[#3B517B] text-white font-semibold rounded-lg transition"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NÖBETÇİ PERSONEL MODAL */}
      {showOnDutyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowOnDutyModal(false)}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-4xl overflow-hidden ring-1 ring-[#2B416B]" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#F2B705] to-[#F59E0B] p-6 border-b border-[#2B416B]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-bold text-white">👮 Nöbetçi Personel Yönetimi</div>
                  <div className="text-sm text-white/80 mt-1">
                    Günlük nöbetçi personel atama ve takibi
                  </div>
                </div>
                <button onClick={() => setShowOnDutyModal(false)} className="text-white/60 hover:text-white text-2xl">×</button>
              </div>
            </div>
            <div className="p-6">
              {/* Nöbetçi Atama */}
              <div className="bg-[#0E2142]/60 rounded-xl p-5 ring-1 ring-[#2B416B] mb-6">
                <div className="text-sm font-semibold text-white mb-4">➕ Yeni Nöbetçi Ata</div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs text-[#A7B8D8] mb-2 block">📅 Tarih</label>
                    <input
                      type="date"
                      value={selectedOnDutyDate}
                      onChange={(e) => setSelectedOnDutyDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-[#112544] text-white border border-[#2B416B] focus:outline-none focus:border-[#F2B705]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#A7B8D8] mb-2 block">👤 Personel</label>
                    <select
                      value={selectedOnDutyPersonnel}
                      onChange={(e) => setSelectedOnDutyPersonnel(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-[#112544] text-white border border-[#2B416B] focus:outline-none focus:border-[#F2B705]"
                    >
                      <option value="">-- Personel seçin --</option>
                      {shiftPersonnel.map((personnel) => (
                        <option key={personnel} value={personnel}>{personnel}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleAssignOnDuty}
                  disabled={!selectedOnDutyDate || !selectedOnDutyPersonnel}
                  className="w-full px-4 py-3 bg-[#F2B705] hover:bg-[#F59E0B] disabled:bg-[#2B416B] disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
                >
                  ✓ Nöbetçi Olarak Ata
                </button>
              </div>

              {/* Nöbetçi Listesi */}
              <div className="bg-[#0E2142]/60 rounded-xl p-5 ring-1 ring-[#2B416B]">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold text-white">📋 Nöbetçi Geçmişi</div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-[#A7B8D8]">{onDutyAssignments.length} gün atanmış</div>
                    {onDutyAssignments.length > 0 && (
                      <button
                        onClick={handleExportOnDuty}
                        className="px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-xs font-semibold transition flex items-center gap-1"
                      >
                        📊 Excel İndir
                      </button>
                    )}
                  </div>
                </div>
                
                {onDutyAssignments.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">📅</div>
                    <div className="text-[#A7B8D8]">Henüz nöbetçi ataması yapılmamış</div>
                    <div className="text-xs text-[#A7B8D8] mt-2">Yukarıdan tarih ve personel seçerek nöbetçi atayabilirsiniz</div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {[...onDutyAssignments]
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .map((assignment, idx) => {
                        const today = new Date().toISOString().split('T')[0];
                        const isToday = assignment.date === today;
                        const isPast = assignment.date < today;
                        const isFuture = assignment.date > today;
                        
                        return (
                          <div 
                            key={idx}
                            className={`flex items-center justify-between p-4 rounded-lg ring-1 transition-all ${
                              isToday 
                                ? 'bg-[#F2B705]/20 ring-[#F2B705] ring-2' 
                                : isPast 
                                ? 'bg-[#2B416B]/20 ring-[#2B416B]/50 opacity-60' 
                                : 'bg-[#10B981]/10 ring-[#10B981]/30'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                                isToday ? 'bg-[#F2B705] text-white' : 
                                isPast ? 'bg-[#2B416B] text-white/60' :
                                'bg-[#10B981] text-white'
                              }`}>
                                {assignment.personnel.charAt(0)}
                              </div>
                              <div>
                                <div className="font-semibold text-white flex items-center gap-2">
                                  {assignment.personnel}
                                  {assignment.personnel === 'Güneri Kerim' && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#2E86FF]/20 text-[#2E86FF]">Lider</span>
                                  )}
                                  {isToday && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#F2B705] text-white animate-pulse">BUGÜN</span>
                                  )}
                                  {isPast && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#2B416B] text-white/70">Geçmiş</span>
                                  )}
                                  {isFuture && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#10B981] text-white">Gelecek</span>
                                  )}
                                </div>
                                <div className="text-xs text-[#A7B8D8] mt-1">
                                  {new Date(assignment.date).toLocaleDateString('tr-TR', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                  })}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setOnDutyAssignments(prev => prev.filter(a => a.date !== assignment.date));
                              }}
                              className="text-white/60 hover:text-[#EF4444] transition"
                              title="Atamayı kaldır"
                            >
                              🗑️
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="mt-6">
                <button
                  onClick={() => setShowOnDutyModal(false)}
                  className="w-full px-4 py-3 bg-[#2B416B] hover:bg-[#3B517B] text-white font-semibold rounded-lg transition"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EKİP YÖNETİMİ - OPERATÖR MASASI */}
      <div className="bg-[#112544] rounded-2xl p-6 ring-1 ring-[#2B416B] transition-all duration-300 hover:ring-[#2E86FF]/50 hover:shadow-xl hover:shadow-[#2E86FF]/10">
        <div 
          className="flex items-center justify-between cursor-pointer group"
          onClick={() => setCashManagementExpanded(!cashManagementExpanded)}
        >
          <div className="flex-1">
            <div className="text-lg font-semibold flex items-center gap-3">
              <span className="text-2xl">💵</span>
              <div className="flex flex-col">
                <span className="bg-gradient-to-r from-white to-[#2E86FF] bg-clip-text text-transparent">Cash Management İzleme Merkezi</span>
                <div className="text-xs text-[#A7B8D8] mt-1 font-normal">
                  ATM izleme, ikmal/toplama yönetimi ve Bantaş koordinasyonu
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2E86FF] to-[#1F6FE0] flex items-center justify-center shadow-lg group-hover:shadow-[#2E86FF]/50 transition-all duration-300 group-hover:scale-110 ml-auto">
                <span className={`text-white text-2xl font-bold transition-transform duration-500 ${cashManagementExpanded ? 'rotate-180' : 'rotate-0'}`}>
                  {cashManagementExpanded ? "−" : "+"}
                </span>
              </div>
            </div>
          </div>
          {cashManagementExpanded && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setAddPersonnelTeam('cash');
              setShowAddPersonnelModal(true);
            }}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#10B981] text-white text-sm font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 ml-4"
          >
            + Yeni Personel
          </button>
          )}
        </div>

        <div className={`overflow-hidden transition-all duration-700 ease-in-out ${cashManagementExpanded ? 'max-h-[10000px] opacity-100 mt-6' : 'max-h-0 opacity-0 mt-0'}`}>
        {/* Operatör Kartları */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {operators.map((operator) => {
            const today = new Date().toISOString().split('T')[0];
            const currentShift = getShiftForPersonnelAndDate(operator.name, today);
            const isActive = currentShift === 'Gündüz' || currentShift === 'Akşam';
            const statusColor = isActive ? '#10B981' : currentShift === 'İzin' ? '#F59E0B' : '#EF4444';
            const statusText = isActive ? 'Vardiya' : currentShift === 'İzin' ? 'İzin' : currentShift === 'Raporlu' ? 'Raporlu' : 'Pasif';
            
            return (
              <div 
                key={operator.id} 
                className="bg-[#0E2142] rounded-xl p-5 ring-1 relative overflow-hidden"
                style={{
                  borderColor: `${operator.color}80`,
                  boxShadow: `0 0 20px ${operator.color}20`
                }}
              >
              {/* Gradient overlay */}
              <div 
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  background: `linear-gradient(135deg, ${operator.color}20 0%, transparent 100%)`
                }}
              />
              
              {/* Silme Butonu */}
              <button
                onClick={() => handleRemoveOperator(operator.id, operator.name, 'cash')}
                className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#EF4444]/20 hover:bg-[#EF4444] text-[#EF4444] hover:text-white transition flex items-center justify-center text-sm z-10"
                title={`${operator.name} kişisini çıkar`}
              >
                ✕
              </button>
              
              {/* Card header with avatar and status */}
              <div className="flex items-center justify-between mb-3 relative z-10">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold`} style={{background: `linear-gradient(to br, ${operator.color}, ${operator.colorHover})`}}>
                    {operator.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-white">{operator.name}</div>
                    <div className="text-xs text-[#A7B8D8]">{operator.role}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isActive ? 'animate-pulse' : ''}`} style={{backgroundColor: statusColor}}></div>
                  <span className="text-xs" style={{color: statusColor}}>{statusText}</span>
                </div>
              </div>

              {/* Tarih Aralığı ve Export */}
              <div className="bg-[#0E2142]/60 rounded-lg p-2 mb-2 relative z-10">
                <div className="text-xs text-[#A7B8D8] mb-2">📊 Faaliyet Raporu</div>
                <div className="grid grid-cols-2 gap-1 mb-2">
                  <input
                    type="date"
                    value={operatorDateRanges[operator.id]?.start || ''}
                    onChange={(e) => setOperatorDateRanges(prev => ({
                      ...prev,
                      [operator.id]: { ...prev[operator.id], start: e.target.value }
                    }))}
                    className="w-full px-2 py-1 rounded bg-[#0E2142] text-white text-xs border border-[#2B416B] focus:outline-none focus:border-[#2E86FF]"
                  />
                  <input
                    type="date"
                    value={operatorDateRanges[operator.id]?.end || ''}
                    onChange={(e) => setOperatorDateRanges(prev => ({
                      ...prev,
                      [operator.id]: { ...prev[operator.id], end: e.target.value }
                    }))}
                    className="w-full px-2 py-1 rounded bg-[#0E2142] text-white text-xs border border-[#2B416B] focus:outline-none focus:border-[#2E86FF]"
                  />
                </div>
                <button
                  onClick={() => handleExportOperatorHistory(operator)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-xs font-semibold transition"
                  title="Excel'e Aktar"
                >
                  📊 Excel İndir
                </button>
              </div>

              {/* Sorumlu NM'ler section */}
              <div className="bg-[#0E2142]/60 rounded-lg p-2 mb-2 relative z-10">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-[#A7B8D8]">Sorumlu NM&apos;ler</div>
                  <button 
                    onClick={() => handleAddItem(operator.id, 'nms')}
                    className="text-xs hover:opacity-80 transition" 
                    style={{color: operator.color}}
                  >
                    +
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {editingOperator === operator.id && editingField === 'nms' && (
                    <div className="flex items-center gap-1 mb-2 w-full">
                      <select
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        className="flex-1 px-2 py-1 rounded bg-[#0E2142] text-white text-xs border border-[#2B416B] focus:outline-none focus:border-[#2E86FF]"
                        autoFocus
                      >
                        <option value="">NM seçin...</option>
                        {allNMs.filter(nm => !operator.nms.includes(nm)).map(nm => (
                          <option key={nm} value={nm}>{nm}</option>
                        ))}
                      </select>
                      <button onClick={handleSaveItem} className="px-2 py-1 rounded bg-[#10B981] text-white text-xs">✓</button>
                      <button onClick={() => { setEditingOperator(null); setEditingField(null); }} className="px-2 py-1 rounded bg-[#EF4444] text-white text-xs">✕</button>
                    </div>
                  )}
                  {operator.nms.map((nm) => (
                    <span 
                      key={nm} 
                      className="px-2 py-1 rounded text-xs text-white flex items-center gap-1 group"
                      style={{backgroundColor: `${operator.color}4D`}}
                    >
                      {nm}
                      <button 
                        onClick={() => handleRemoveItem(operator.id, 'nms', nm)}
                        className="opacity-0 group-hover:opacity-100 text-white/70 hover:text-white transition"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* NM Merkezleri section */}
              <div className="bg-[#0E2142]/60 rounded-lg p-2 mb-2 relative z-10">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-[#A7B8D8]">NM Merkezleri</div>
                  <button 
                    onClick={() => handleAddItem(operator.id, 'nmCenters')}
                    className="text-xs text-[#10B981] hover:text-[#059669]"
                  >
                    +
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {editingOperator === operator.id && editingField === 'nmCenters' && (
                    <div className="flex items-center gap-1 mb-2 w-full">
                      <select
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        className="flex-1 px-2 py-1 rounded bg-[#0E2142] text-white text-xs border border-[#2B416B] focus:outline-none focus:border-[#2E86FF]"
                        autoFocus
                      >
                        <option value="">NM Merkezi seçin...</option>
                        {allNMCenters.filter(center => !operator.nmCenters.includes(center)).map(center => (
                          <option key={center} value={center}>{center}</option>
                        ))}
                      </select>
                      <button onClick={handleSaveItem} className="px-2 py-1 rounded bg-[#10B981] text-white text-xs">✓</button>
                      <button onClick={() => { setEditingOperator(null); setEditingField(null); }} className="px-2 py-1 rounded bg-[#EF4444] text-white text-xs">✕</button>
                    </div>
                  )}
                  {operator.nmCenters.map((center) => (
                    <span 
                      key={center} 
                      className="px-2 py-1 rounded bg-[#10B981]/30 text-xs text-white flex items-center gap-1 group"
                    >
                      {center}
                      <button 
                        onClick={() => handleRemoveItem(operator.id, 'nmCenters', center)}
                        className="opacity-0 group-hover:opacity-100 text-white/70 hover:text-white transition"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* SLA Ortalaması */}
              <div className="bg-[#0E2142]/60 rounded-lg p-2 mb-2 relative z-10">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-[#A7B8D8]">Ort. SLA Süresi</div>
                  <button 
                    onClick={() => handleAddItem(operator.id, 'avgSla')}
                    className="text-xs text-[#F2B705] hover:text-[#F59E0B]"
                  >
                    ✏️
                  </button>
                </div>
                {editingOperator === operator.id && editingField === 'avgSla' ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveItem()}
                      placeholder="SLA süresi (saat)..."
                      className="flex-1 px-2 py-1 rounded bg-[#0E2142] text-white text-xs border border-[#2B416B] focus:outline-none focus:border-[#2E86FF]"
                      autoFocus
                    />
                    <button onClick={handleSaveItem} className="px-2 py-1 rounded bg-[#10B981] text-white text-xs">✓</button>
                    <button onClick={() => { setEditingOperator(null); setEditingField(null); }} className="px-2 py-1 rounded bg-[#EF4444] text-white text-xs">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-white">{operator.avgSla}</div>
                    <div className="text-xs text-[#A7B8D8]">saat</div>
                    <div className={`ml-auto px-2 py-1 rounded text-xs font-semibold ${
                      operator.avgSla <= 2.0 ? 'bg-[#10B981]/20 text-[#10B981]' :
                      operator.avgSla <= 2.5 ? 'bg-[#F2B705]/20 text-[#F2B705]' :
                      'bg-[#EF4444]/20 text-[#EF4444]'
                    }`}>
                      {operator.avgSla <= 2.0 ? '✓ İyi' : operator.avgSla <= 2.5 ? '⚠ Orta' : '✗ Yüksek'}
                    </div>
                  </div>
                )}
              </div>

              {/* Çağrı İstatistikleri */}
              {operator.callsOutgoing !== undefined && (
                <div className="bg-[#0E2142]/60 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-[#A7B8D8]">Çağrı Performansı</div>
                    <div className={`px-2 py-0.5 rounded text-xs font-bold ${
                      (operator.callScore || 0) >= 90 ? 'bg-[#10B981]/20 text-[#10B981]' :
                      (operator.callScore || 0) >= 75 ? 'bg-[#F2B705]/20 text-[#F2B705]' :
                      'bg-[#EF4444]/20 text-[#EF4444]'
                    }`}>
                      {operator.callScore || 0}/100
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-[#A7B8D8]">📞 Aranan:</div>
                      <div className="text-sm font-bold text-white">{operator.callsOutgoing}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-[#A7B8D8]">📲 Gelen:</div>
                      <div className="text-sm font-bold text-white">{operator.callsIncoming}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-[#A7B8D8]">⏱️ Giden:</div>
                      <div className="text-sm font-bold text-[#2E86FF]">{operator.callsDurationOutgoing}dk</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-[#A7B8D8]">⏱️ Geçen:</div>
                      <div className="text-sm font-bold text-[#F2B705]">{operator.callsDurationIncoming}dk</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 mb-2 relative z-10">
                <div className="bg-[#0E2142]/60 rounded-lg p-2 text-center">
                  <div className="text-xs text-[#A7B8D8]">ATM</div>
                  <div className="text-lg font-bold text-white">{operator.atmCount}</div>
                </div>
                <div className="bg-[#0E2142]/60 rounded-lg p-2 text-center">
                  <div className="text-xs text-[#A7B8D8]">İkmal</div>
                  <div className="text-lg font-bold text-[#2E86FF]">{operator.ikmal}</div>
                </div>
                <div className="bg-[#0E2142]/60 rounded-lg p-2 text-center">
                  <div className="text-xs text-[#A7B8D8]">Toplama</div>
                  <div className="text-lg font-bold text-[#F2B705]">{operator.toplama}</div>
                </div>
              </div>

              {/* Active coordination */}
              <div className="text-xs text-[#A7B8D8] mb-1 relative z-10">Aktif Koordinasyon</div>
              <div className="rounded-lg p-2 ring-1 relative z-10 text-xs" style={{backgroundColor: `${operator.color}20`, borderColor: `${operator.color}60`}}>
                <div className="font-semibold line-clamp-2" style={{color: operator.color}}>{operator.coordination}</div>
              </div>
              </div>
            );
          })}
        </div>

        {/* Operasyon Özeti */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-6 gap-4">
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-xs text-[#A7B8D8] mb-2">Lider</div>
            <div className="text-3xl font-bold text-white">{operators.filter(op => op.role === 'Lider').length}</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-xs text-[#A7B8D8] mb-2">Operatör</div>
            <div className="text-3xl font-bold text-white">{operators.filter(op => op.role === 'Operatör').length}</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-xs text-[#A7B8D8] mb-2">Aktif Masa</div>
            <div className="text-3xl font-bold text-[#10B981]">{operators.filter(op => {
              const today = new Date().toISOString().split('T')[0];
              const currentShift = getShiftForPersonnelAndDate(op.name, today);
              return currentShift === 'Gündüz' || currentShift === 'Akşam';
            }).length}</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-xs text-[#A7B8D8] mb-2">Toplam İkmal</div>
            <div className="text-3xl font-bold text-[#2E86FF]">{operators.reduce((sum, op) => sum + op.ikmal, 0)}</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-xs text-[#A7B8D8] mb-2">Toplam Toplama</div>
            <div className="text-3xl font-bold text-[#F2B705]">{operators.reduce((sum, op) => sum + op.toplama, 0)}</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-xs text-[#A7B8D8] mb-2">Bantaş Koordinasyon</div>
            <div className="text-3xl font-bold text-[#10B981]">{operators.filter(op => op.coordination.includes('Bantaş')).length}</div>
          </div>
        </div>

        {/* Bugünkü Vardiya Durumu */}
        <div className="mt-6 bg-[#0E2142]/40 rounded-xl p-4 ring-1 ring-[#2B416B]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-white">📅 Bugünkü Vardiya Durumu</div>
            <button
              onClick={() => setShowShiftManagementModal(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] transition"
            >
              Vardiya Düzenle
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {operators.map(op => {
              const today = new Date().toISOString().split('T')[0];
              const currentShift = getShiftForPersonnelAndDate(op.name, today);
              const isActive = currentShift === 'Gündüz' || currentShift === 'Akşam';
              const statusColor = isActive ? '#10B981' : currentShift === 'İzin' ? '#F59E0B' : '#EF4444';
              
              return (
                <div key={op.id} className="bg-[#0E2142]/60 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0`} style={{backgroundColor: statusColor}}></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{op.name}</div>
                      <div className="text-xs" style={{color: statusColor}}>{currentShift}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedPersonnel(op.name);
                      setSelectedDate(today);
                      setShowShiftModal(true);
                    }}
                    className="text-xs px-2 py-1 rounded bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] transition flex-shrink-0"
                  >
                    Değiştir
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        </div>
      </div>

      {/* ATM PERFORMANCE MANAGEMENT - KPI KARTLARI (Cash Management Benzeri) */}
      <div className="bg-[#112544] rounded-2xl p-6 ring-1 ring-[#2B416B] transition-all duration-300 hover:ring-[#EF4444]/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔧</span>
            <div>
              <div className="text-lg font-semibold bg-gradient-to-r from-white to-[#EF4444] bg-clip-text text-transparent">
                ATM Performance - Operasyon Özeti
              </div>
              <div className="text-xs text-[#A7B8D8] mt-1">
                Arıza takip, SLA performansı ve saha ekip durumu
              </div>
            </div>
          </div>
        </div>

        {/* KPI Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Bugünkü Arıza */}
          <div className="bg-gradient-to-br from-[#EF4444]/10 to-[#DC2626]/5 rounded-xl p-5 ring-1 ring-[#EF4444]/30 hover:ring-[#EF4444]/60 transition-all hover:scale-105">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-[#A7B8D8]">Bugünkü Arıza</div>
              <div className="text-2xl">🚨</div>
            </div>
            <div className="text-4xl font-bold text-white mb-3">32</div>
            <div className="flex items-center gap-2 text-xs mb-3">
              <span className="text-[#EF4444]">↑ 5 (18.5%)</span>
              <span className="text-[#A7B8D8]">önceki güne göre</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#A7B8D8]">Kritik:</span>
                <span className="text-[#EF4444] font-bold">8</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7B8D8]">Normal:</span>
                <span className="text-[#F59E0B] font-bold">24</span>
              </div>
            </div>
          </div>

          {/* SLA Uyum */}
          <div className="bg-gradient-to-br from-[#10B981]/10 to-[#059669]/5 rounded-xl p-5 ring-1 ring-[#10B981]/30 hover:ring-[#10B981]/60 transition-all hover:scale-105">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-[#A7B8D8]">SLA Uyum</div>
              <div className="text-2xl">✓</div>
            </div>
            <div className="text-4xl font-bold text-white mb-3">94.2%</div>
            <div className="flex items-center gap-2 text-xs mb-3">
              <span className="text-[#10B981]">↓ 1.8%</span>
              <span className="text-[#A7B8D8]">geçen haftaya göre</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#A7B8D8]">Hedef:</span>
                <span className="text-white font-bold">95%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7B8D8]">SLA Aşım:</span>
                <span className="text-[#EF4444] font-bold">3 ATM</span>
              </div>
            </div>
          </div>

          {/* Ortalama Müdahale */}
          <div className="bg-gradient-to-br from-[#F59E0B]/10 to-[#F97316]/5 rounded-xl p-5 ring-1 ring-[#F59E0B]/30 hover:ring-[#F59E0B]/60 transition-all hover:scale-105">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-[#A7B8D8]">Ortalama Müdahale</div>
              <div className="text-2xl">⚙️</div>
            </div>
            <div className="flex items-baseline gap-1 mb-3">
              <div className="text-4xl font-bold text-white">1.8</div>
              <div className="text-lg text-[#A7B8D8]">saat</div>
            </div>
            <div className="flex items-center gap-2 text-xs mb-3">
              <span className="text-[#10B981]">↓ 0.3 saat</span>
              <span className="text-[#A7B8D8]">daha hızlı</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#A7B8D8]">En Hızlı:</span>
                <span className="text-[#10B981] font-bold">0.5 saat</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7B8D8]">En Yavaş:</span>
                <span className="text-[#EF4444] font-bold">3.2 saat</span>
              </div>
            </div>
          </div>

          {/* Aktif Personel */}
          <div className="bg-gradient-to-br from-[#2E86FF]/10 to-[#1F6FE0]/5 rounded-xl p-5 ring-1 ring-[#2E86FF]/30 hover:ring-[#2E86FF]/60 transition-all hover:scale-105">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-[#A7B8D8]">Aktif Personel</div>
              <div className="text-2xl">👥</div>
            </div>
            <div className="flex items-baseline gap-1 mb-3">
              <div className="text-4xl font-bold text-white">{performanceTeam.filter(p => {
                const today = new Date().toISOString().split('T')[0];
                const shift = getShiftForPersonnelAndDate(p.name, today);
                return shift === 'Gündüz' || shift === 'Akşam';
              }).length}</div>
              <div className="text-2xl text-[#A7B8D8]">/</div>
              <div className="text-2xl text-[#A7B8D8]">{performanceTeam.length}</div>
            </div>
            <div className="flex items-center gap-2 text-xs mb-3">
              <span className="text-[#10B981]">✓ Tam kadro</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#A7B8D8]">Vardiya:</span>
                <span className="text-white font-bold">Gündüz</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7B8D8]">Saha Ekip:</span>
                <span className="text-[#2E86FF] font-bold">12 aktif</span>
              </div>
            </div>
          </div>
        </div>

        {/* Alt Bilgi Çubuğu */}
        <div className="mt-6 bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-xs text-[#A7B8D8] mb-1">Açık Arıza</div>
              <div className="text-2xl font-bold text-[#EF4444]">25</div>
            </div>
            <div>
              <div className="text-xs text-[#A7B8D8] mb-1">Kapanan Arıza (Bugün)</div>
              <div className="text-2xl font-bold text-[#10B981]">18</div>
            </div>
            <div>
              <div className="text-xs text-[#A7B8D8] mb-1">Bekleyen SLM</div>
              <div className="text-2xl font-bold text-[#F59E0B]">5</div>
            </div>
            <div>
              <div className="text-xs text-[#A7B8D8] mb-1">Ortalama Çözüm Süresi</div>
              <div className="text-2xl font-bold text-[#2E86FF]">2.3 saat</div>
            </div>
          </div>
        </div>
      </div>

      {/* En Yoğun Nakit Merkezleri - Arıza/SLM Bazlı - BAĞIMSIZ KART */}
      <div className="bg-[#112544] rounded-2xl p-6 ring-1 ring-[#2B416B] transition-all duration-300 hover:ring-[#F59E0B]/50 hover:shadow-xl hover:shadow-[#F59E0B]/10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔥</span>
            <div>
              <div className="text-lg font-semibold bg-gradient-to-r from-white to-[#F59E0B] bg-clip-text text-transparent">
                En Yoğun Nakit Merkezleri (Son 24 Saat)
              </div>
              <div className="text-xs text-[#A7B8D8] mt-1">
                Arıza ve SLM çağrı yoğunluğuna göre sıralı nakit merkezi performans analizi
              </div>
            </div>
          </div>
          
          {/* Şube/Offsite Sekmesi */}
          <div className="flex items-center gap-1 bg-[#0E2142] rounded-lg p-1">
            <button
              onClick={() => setAtmLocationFilter('all')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                atmLocationFilter === 'all'
                  ? 'bg-[#2E86FF] text-white'
                  : 'text-[#A7B8D8] hover:text-white'
              }`}
            >
              Tümü
            </button>
            <button
              onClick={() => setAtmLocationFilter('branch')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                atmLocationFilter === 'branch'
                  ? 'bg-[#2E86FF] text-white'
                  : 'text-[#A7B8D8] hover:text-white'
              }`}
            >
              � Şube
            </button>
            <button
              onClick={() => setAtmLocationFilter('offsite')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                atmLocationFilter === 'offsite'
                  ? 'bg-[#2E86FF] text-white'
                  : 'text-[#A7B8D8] hover:text-white'
              }`}
            >
              📍 Offsite
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Top 5 Bölgeler - Arıza Bazlı */}
          {[
            { rank: 1, name: "KOZYATAĞI", location: "İstanbul - Anadolu", ariza: 18, slm: 5, mudahale: "1.2h", coordinator: "Ahmet Y.", color: "EF4444" },
            { rank: 2, name: "ANKARA", location: "Ankara - Merkez", ariza: 14, slm: 3, mudahale: "1.5h", coordinator: "Zeynep K.", color: "F59E0B" },
            { rank: 3, name: "İZMİR", location: "İzmir - Ege", ariza: 12, slm: 2, mudahale: "1.8h", coordinator: "Mehmet D.", color: "F59E0B" },
            { rank: 4, name: "BURSA", location: "Bursa - Marmara", ariza: 9, slm: 1, mudahale: "1.4h", coordinator: "Ahmet Y.", color: "10B981" },
            { rank: 5, name: "MALTEPE", location: "İstanbul - Anadolu", ariza: 8, slm: 2, mudahale: "2.1h", coordinator: "Zeynep K.", color: "10B981" },
          ].map((region) => (
            <div 
              key={region.rank} 
              onClick={() => {
                setSelectedRegion(region.name);
                setShowRegionModal(true);
              }}
              className={`bg-[#0E2142] rounded-lg p-4 ring-1 ring-[#${region.color}]/50 cursor-pointer hover:bg-[#1A2F52] transition-all hover:scale-105 hover:shadow-lg`}
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
                  <span className="text-[#A7B8D8]">Arıza:</span>
                  <span className="font-bold" style={{color: `#${region.color}`}}>{region.ariza}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#A7B8D8]">SLM Çağrı:</span>
                  <span className={`font-bold ${region.slm === 0 ? 'text-[#10B981]' : region.slm <= 2 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>{region.slm}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#A7B8D8]">Müdahale:</span>
                  <span className="text-[#2E86FF] font-semibold">{region.mudahale}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#A7B8D8]">Koordinatör:</span>
                  <span className="text-white font-semibold">{region.coordinator}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ATM PERFORMANCE MANAGEMENT EKİBİ - 7/24 ARIZA & SLM KOORDİNASYONU */}
      <div className="bg-[#112544] rounded-2xl p-6 ring-1 ring-[#2B416B] transition-all duration-300 hover:ring-[#EF4444]/50 hover:shadow-xl hover:shadow-[#EF4444]/10">
        <div 
          className="flex items-center justify-between cursor-pointer group"
          onClick={() => setPerformanceManagementExpanded(!performanceManagementExpanded)}
        >
          <div className="flex-1">
            <div className="text-lg font-semibold flex items-center gap-3">
              <span className="text-2xl">🔧</span>
              <div className="flex flex-col">
                <span className="bg-gradient-to-r from-white to-[#EF4444] bg-clip-text text-transparent">ATM Performance Management (7/24)</span>
                <div className="text-xs text-[#A7B8D8] mt-1 font-normal">
                  Arıza takip, saha çağrı yönetimi, SLM koordinasyonu • Hafta içi 07:00-01:00 vardiyalı hizmet
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#EF4444] to-[#DC2626] flex items-center justify-center shadow-lg group-hover:shadow-[#EF4444]/50 transition-all duration-300 group-hover:scale-110 ml-auto">
                <span className={`text-white text-2xl font-bold transition-transform duration-500 ${performanceManagementExpanded ? 'rotate-180' : 'rotate-0'}`}>
                  {performanceManagementExpanded ? "−" : "+"}
                </span>
              </div>
            </div>
          </div>
          {performanceManagementExpanded && (
          <div className="flex items-center gap-2 ml-4">
            <div className="px-3 py-1.5 rounded-lg bg-[#EF4444]/20 text-[#EF4444] text-xs font-semibold animate-pulse">
              🔴 7/24 Aktif
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#2E86FF]/20 text-[#2E86FF] text-xs font-semibold">
              07:00-01:00
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setAddPersonnelTeam('performance');
                setShowAddPersonnelModal(true);
              }}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#10B981] text-white text-sm font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              + Yeni Personel
            </button>
          </div>
          )}
        </div>

        <div className={`overflow-hidden transition-all duration-700 ease-in-out ${performanceManagementExpanded ? 'max-h-[10000px] opacity-100 mt-6' : 'max-h-0 opacity-0 mt-0'}`}>
        {/* Performance Team Kartları */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {performanceTeam.map((operator) => {
            const today = new Date().toISOString().split('T')[0];
            const currentShift = getShiftForPersonnelAndDate(operator.name, today);
            const isActive = currentShift === 'Gündüz' || currentShift === 'Akşam';
            const statusColor = isActive ? '#10B981' : currentShift === 'İzin' ? '#F59E0B' : '#EF4444';
            const statusText = isActive ? 'Vardiya' : currentShift === 'İzin' ? 'İzin' : currentShift === 'Raporlu' ? 'Raporlu' : 'Pasif';
            
            return (
            <div 
              key={operator.id} 
              className="bg-[#0E2142] rounded-xl p-5 ring-1 relative overflow-hidden"
              style={{
                borderColor: `${operator.color}80`,
                boxShadow: `0 0 20px ${operator.color}20`
              }}
            >
              {/* Gradient overlay */}
              <div 
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  background: `linear-gradient(135deg, ${operator.color}20 0%, transparent 100%)`
                }}
              />
              
              {/* Silme Butonu */}
              <button
                onClick={() => handleRemoveOperator(operator.id, operator.name, 'performance')}
                className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#EF4444]/20 hover:bg-[#EF4444] text-[#EF4444] hover:text-white transition flex items-center justify-center text-sm z-10"
                title={`${operator.name} kişisini çıkar`}
              >
                ✕
              </button>
              
              {/* Card header with avatar and status */}
              <div className="flex items-center justify-between mb-3 relative z-10">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold`} style={{background: `linear-gradient(to br, ${operator.color}, ${operator.colorHover})`}}>
                    {operator.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-white">{operator.name}</div>
                    <div className="text-xs text-[#A7B8D8]">{operator.role}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isActive ? 'animate-pulse' : ''}`} style={{backgroundColor: statusColor}}></div>
                  <span className="text-xs" style={{color: statusColor}}>{statusText}</span>
                </div>
              </div>

              {/* Tarih Aralığı ve Export */}
              <div className="bg-[#0E2142]/60 rounded-lg p-2 mb-2 relative z-10">
                <div className="text-xs text-[#A7B8D8] mb-2">📊 Performans Raporu</div>
                <div className="grid grid-cols-2 gap-1 mb-2">
                  <input
                    type="date"
                    value={operatorDateRanges[operator.id]?.start || ''}
                    onChange={(e) => setOperatorDateRanges(prev => ({
                      ...prev,
                      [operator.id]: { ...prev[operator.id], start: e.target.value }
                    }))}
                    className="w-full px-2 py-1 rounded bg-[#0E2142] text-white text-xs border border-[#2B416B] focus:outline-none focus:border-[#2E86FF]"
                  />
                  <input
                    type="date"
                    value={operatorDateRanges[operator.id]?.end || ''}
                    onChange={(e) => setOperatorDateRanges(prev => ({
                      ...prev,
                      [operator.id]: { ...prev[operator.id], end: e.target.value }
                    }))}
                    className="w-full px-2 py-1 rounded bg-[#0E2142] text-white text-xs border border-[#2B416B] focus:outline-none focus:border-[#2E86FF]"
                  />
                </div>
                <button
                  onClick={() => handleExportOperatorHistory(operator)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-xs font-semibold transition"
                  title="Excel'e Aktar"
                >
                  📊 Excel İndir
                </button>
              </div>

              {/* Sorumlu Bölgeler */}
              <div className="bg-[#0E2142]/60 rounded-lg p-2 mb-2 relative z-10">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-[#A7B8D8]">Sorumlu Bölgeler</div>
                  <button 
                    onClick={() => handleAddItem(operator.id, 'nms')}
                    className="text-xs hover:opacity-80 transition" 
                    style={{color: operator.color}}
                  >
                    +
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {editingOperator === operator.id && editingField === 'nms' && (
                    <div className="flex items-center gap-1 mb-2 w-full">
                      <select
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        className="flex-1 px-2 py-1 rounded bg-[#0E2142] text-white text-xs border border-[#2B416B] focus:outline-none focus:border-[#2E86FF]"
                        autoFocus
                      >
                        <option value="">NM seçin...</option>
                        {allNMs.filter(nm => !operator.nms.includes(nm)).map(nm => (
                          <option key={nm} value={nm}>{nm}</option>
                        ))}
                      </select>
                      <button onClick={handleSaveItem} className="px-2 py-1 rounded bg-[#10B981] text-white text-xs">✓</button>
                      <button onClick={() => { setEditingOperator(null); setEditingField(null); }} className="px-2 py-1 rounded bg-[#EF4444] text-white text-xs">✕</button>
                    </div>
                  )}
                  {operator.nms.map((nm) => (
                    <span 
                      key={nm} 
                      className="px-2 py-1 rounded text-xs text-white flex items-center gap-1 group"
                      style={{backgroundColor: `${operator.color}4D`}}
                    >
                      {nm}
                      <button 
                        onClick={() => handleRemoveItem(operator.id, 'nms', nm)}
                        className="opacity-0 group-hover:opacity-100 text-white/70 hover:text-white transition"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* SLA Performance */}
              <div className="bg-[#0E2142]/60 rounded-lg p-2 mb-2 relative z-10">
                <div className="text-xs text-[#A7B8D8] mb-1">Ort. Müdahale</div>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-white">{operator.avgSla}</div>
                  <div className="text-xs text-[#A7B8D8]">saat</div>
                  <div className={`ml-auto px-2 py-1 rounded text-xs font-semibold ${
                    operator.avgSla <= 2.0 ? 'bg-[#10B981]/20 text-[#10B981]' :
                    operator.avgSla <= 2.5 ? 'bg-[#F2B705]/20 text-[#F2B705]' :
                    'bg-[#EF4444]/20 text-[#EF4444]'
                  }`}>
                    {operator.avgSla <= 2.0 ? '✓ Hızlı' : operator.avgSla <= 2.5 ? '⚠ Normal' : '✗ Yavaş'}
                  </div>
                </div>
              </div>

              {/* Çağrı İstatistikleri */}
              {operator.callsOutgoing !== undefined && (
                <div className="bg-[#0E2142]/60 rounded-lg p-2 mb-2 relative z-10">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-[#A7B8D8]">Çağrı Performansı</div>
                    <div className={`px-2 py-0.5 rounded text-xs font-bold ${
                      (operator.callScore || 0) >= 90 ? 'bg-[#10B981]/20 text-[#10B981]' :
                      (operator.callScore || 0) >= 75 ? 'bg-[#F2B705]/20 text-[#F2B705]' :
                      'bg-[#EF4444]/20 text-[#EF4444]'
                    }`}>
                      {operator.callScore || 0}/100
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-[#A7B8D8]">📞 Aranan:</div>
                      <div className="text-sm font-bold text-white">{operator.callsOutgoing}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-[#A7B8D8]">📲 Gelen:</div>
                      <div className="text-sm font-bold text-white">{operator.callsIncoming}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-[#A7B8D8]">⏱️ Giden:</div>
                      <div className="text-sm font-bold text-[#2E86FF]">{operator.callsDurationOutgoing}dk</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-[#A7B8D8]">⏱️ Geçen:</div>
                      <div className="text-sm font-bold text-[#F2B705]">{operator.callsDurationIncoming}dk</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Günlük İstatistikler */}
              <div className="grid grid-cols-2 gap-2 mb-2 relative z-10">
                <div className="bg-[#0E2142]/60 rounded-lg p-2 text-center">
                  <div className="text-xs text-[#A7B8D8]">ATM Sayısı</div>
                  <div className="text-lg font-bold text-white">{operator.atmCount}</div>
                </div>
                <div className="bg-[#0E2142]/60 rounded-lg p-2 text-center">
                  <div className="text-xs text-[#A7B8D8]">NM Merkezi</div>
                  <div className="text-lg font-bold text-[#2E86FF]">{operator.nmCenters.length}</div>
                </div>
              </div>

              {/* Active coordination */}
              <div className="text-xs text-[#A7B8D8] mb-1 relative z-10">Anlık Durum</div>
              <div className="rounded-lg p-2 ring-1 relative z-10 text-xs" style={{backgroundColor: `${operator.color}20`, borderColor: `${operator.color}60`}}>
                <div className="font-semibold line-clamp-2" style={{color: operator.color}}>{operator.coordination}</div>
              </div>
            </div>
            );
          })}
        </div>

        {/* Ekip Özeti */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-6 gap-4">
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-xs text-[#A7B8D8] mb-2">Toplam Personel</div>
            <div className="text-3xl font-bold text-white">{performanceTeam.length}</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-xs text-[#A7B8D8] mb-2">Aktif Arıza</div>
            <div className="text-3xl font-bold text-[#EF4444]">25</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-xs text-[#A7B8D8] mb-2">SLM Çağrı</div>
            <div className="text-3xl font-bold text-[#F59E0B]">5</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-xs text-[#A7B8D8] mb-2">Ortalama SLA</div>
            <div className="text-3xl font-bold text-[#2E86FF]">{(performanceTeam.reduce((sum, p) => sum + p.avgSla, 0) / performanceTeam.length).toFixed(1)}h</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-xs text-[#A7B8D8] mb-2">Aktif Vardiya</div>
            <div className="text-3xl font-bold text-[#10B981]">{performanceTeam.filter(p => {
              const today = new Date().toISOString().split('T')[0];
              const currentShift = getShiftForPersonnelAndDate(p.name, today);
              return currentShift === 'Gündüz' || currentShift === 'Akşam';
            }).length}</div>
          </div>
          <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
            <div className="text-xs text-[#A7B8D8] mb-2">Çağrı Skoru</div>
            <div className="text-3xl font-bold text-[#10B981]">{Math.round(performanceTeam.reduce((sum, p) => sum + (p.callScore || 0), 0) / performanceTeam.length)}</div>
          </div>
        </div>

        {/* Bugünkü Vardiya Durumu */}
        <div className="mt-6 bg-[#0E2142]/40 rounded-xl p-4 ring-1 ring-[#2B416B]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-white">📅 Bugünkü Vardiya Durumu</div>
            <button
              onClick={() => setShowShiftManagementModal(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] transition"
            >
              Vardiya Düzenle
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {performanceTeam.map(op => {
              const today = new Date().toISOString().split('T')[0];
              const currentShift = getShiftForPersonnelAndDate(op.name, today);
              const isActive = currentShift === 'Gündüz' || currentShift === 'Akşam';
              const statusColor = isActive ? '#10B981' : currentShift === 'İzin' ? '#F59E0B' : '#EF4444';
              
              return (
                <div key={op.id} className="bg-[#0E2142]/60 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0`} style={{backgroundColor: statusColor}}></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{op.name}</div>
                      <div className="text-xs" style={{color: statusColor}}>{currentShift}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedPersonnel(op.name);
                      setSelectedDate(today);
                      setShowShiftModal(true);
                    }}
                    className="text-xs px-2 py-1 rounded bg-[#2E86FF]/20 hover:bg-[#2E86FF]/40 text-[#2E86FF] transition flex-shrink-0"
                  >
                    Değiştir
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        </div>
      </div>

      {/* Escalation - Performance Team */}
      <div className="bg-[#0E2142]/60 rounded-xl p-5 ring-1 ring-[#EF4444]/50 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold mb-2 flex items-center gap-2">
              🚨 Escalation - SLA / Yönetici Bildirimi
            </div>
            <div className="text-xs text-[#A7B8D8] mb-1">
              Kritik arıza ve SLA aşımlarını yönetici ekibine bildir
            </div>
            <div className="text-xs text-white/60">
              Bildirim alacak koordinatörler: {performanceTeam.map(p => p.name).join(', ')}
            </div>
          </div>
          <button 
            onClick={() => {
              setEscalationSubject('🚨 ATM PERFORMANCE - Kritik Arıza & SLA Eskalasyonu');
              setShowEscalationModal(true);
            }}
            className="px-5 py-3 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] transition text-sm font-semibold flex items-center gap-2"
          >
            📧 Yönetici Bildirimi Gönder
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="bg-[#0E2142] rounded-lg p-3">
            <div className="text-xs text-[#A7B8D8] mb-1">Kritik Arıza</div>
            <div className="text-2xl font-bold text-[#EF4444]">8</div>
          </div>
          <div className="bg-[#0E2142] rounded-lg p-3">
            <div className="text-xs text-[#A7B8D8] mb-1">SLA Aşım</div>
            <div className="text-2xl font-bold text-[#F59E0B]">3</div>
          </div>
          <div className="bg-[#0E2142] rounded-lg p-3">
            <div className="text-xs text-[#A7B8D8] mb-1">Bekleyen SLM</div>
            <div className="text-2xl font-bold text-[#2E86FF]">5</div>
          </div>
          <div className="bg-[#0E2142] rounded-lg p-3">
            <div className="text-xs text-[#A7B8D8] mb-1">Son Bildirim</div>
            <div className="text-xs font-bold text-[#10B981]">2 saat önce</div>
          </div>
        </div>
      </div>

      {/* VARDİYA YÖNETİMİ - KOMPAKT KART */}
      <div 
        onClick={() => setShowShiftManagementModal(true)}
        className="bg-[#112544] rounded-2xl p-6 ring-1 ring-[#2B416B] cursor-pointer hover:ring-[#2E86FF]/50 hover:bg-[#1A2F52] transition-all"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-semibold flex items-center gap-2">
              👥 Vardiya Yönetimi
            </div>
            <div className="text-xs text-[#A7B8D8] mt-1">
              Personel mesai takvimi, aktif/pasif vardiya ve izin takibi
            </div>
          </div>
          <div className="text-2xl text-[#A7B8D8]">→</div>
        </div>
        
        {/* Hızlı Özet */}
        <div className="grid grid-cols-5 gap-3">
          <div 
            onClick={(e) => {
              e.stopPropagation();
              setShowShiftManagementModal(true);
            }}
            className="bg-[#2E86FF]/10 rounded-lg p-3 ring-1 ring-[#2E86FF]/30 hover:ring-[#2E86FF] transition-all cursor-pointer"
          >
            <div className="text-xs text-[#A7B8D8] mb-1">Toplam</div>
            <div className="text-2xl font-bold text-[#2E86FF]">{shiftPersonnel.length}</div>
          </div>
          <div 
            onClick={(e) => {
              e.stopPropagation();
              setSelectedShiftTypeForList('Gündüz');
              setShowShiftPersonnelModal(true);
            }}
            className="bg-[#10B981]/10 rounded-lg p-3 ring-1 ring-[#10B981]/30 hover:ring-[#10B981] hover:bg-[#10B981]/20 transition-all cursor-pointer"
          >
            <div className="text-xs text-[#A7B8D8] mb-1">Gündüz</div>
            <div className="text-2xl font-bold text-[#10B981]">
              {(() => {
                const today = new Date().toISOString().split('T')[0];
                return shiftPersonnel.filter(p => getShiftForPersonnelAndDate(p, today) === 'Gündüz').length;
              })()}
            </div>
          </div>
          <div 
            onClick={(e) => {
              e.stopPropagation();
              setSelectedShiftTypeForList('Akşam');
              setShowShiftPersonnelModal(true);
            }}
            className="bg-[#8B5CF6]/10 rounded-lg p-3 ring-1 ring-[#8B5CF6]/30 hover:ring-[#8B5CF6] hover:bg-[#8B5CF6]/20 transition-all cursor-pointer"
          >
            <div className="text-xs text-[#A7B8D8] mb-1">Akşam</div>
            <div className="text-2xl font-bold text-[#8B5CF6]">
              {(() => {
                const today = new Date().toISOString().split('T')[0];
                return shiftPersonnel.filter(p => getShiftForPersonnelAndDate(p, today) === 'Akşam').length;
              })()}
            </div>
          </div>
          <div 
            onClick={(e) => {
              e.stopPropagation();
              setSelectedShiftTypeForList('İzin');
              setShowShiftPersonnelModal(true);
            }}
            className="bg-[#F2B705]/10 rounded-lg p-3 ring-1 ring-[#F2B705]/30 hover:ring-[#F2B705] hover:bg-[#F2B705]/20 transition-all cursor-pointer"
          >
            <div className="text-xs text-[#A7B8D8] mb-1">İzin</div>
            <div className="text-2xl font-bold text-[#F2B705]">
              {(() => {
                const today = new Date().toISOString().split('T')[0];
                return shiftPersonnel.filter(p => getShiftForPersonnelAndDate(p, today) === 'İzin').length;
              })()}
            </div>
          </div>
          <div 
            onClick={(e) => {
              e.stopPropagation();
              setSelectedShiftTypeForList('Raporlu');
              setShowShiftPersonnelModal(true);
            }}
            className="bg-[#EF4444]/10 rounded-lg p-3 ring-1 ring-[#EF4444]/30 hover:ring-[#EF4444] hover:bg-[#EF4444]/20 transition-all cursor-pointer"
          >
            <div className="text-xs text-[#A7B8D8] mb-1">Raporlu</div>
            <div className="text-2xl font-bold text-[#EF4444]">
              {(() => {
                // Son 7 günde en az 1 gün raporlu olan benzersiz personel sayısı
                const today = new Date();
                const last7Days: string[] = [];
                for (let i = 0; i < 7; i++) {
                  const d = new Date(today);
                  d.setDate(d.getDate() - i);
                  last7Days.push(d.toISOString().split('T')[0]);
                }
                
                const raporluPersonnel = new Set<string>();
                shiftPersonnel.forEach(p => {
                  last7Days.forEach(date => {
                    if (getShiftForPersonnelAndDate(p, date) === 'Raporlu') {
                      raporluPersonnel.add(p);
                    }
                  });
                });
                
                return raporluPersonnel.size;
              })()}
            </div>
            <div className="text-xs text-[#A7B8D8] mt-1">Son 7 gün</div>
          </div>
        </div>
        
        <div className="mt-4 text-xs text-[#A7B8D8] flex items-center gap-2">
          <span>💡 Detaylı takvim ve izin takibi için tıklayın</span>
        </div>
      </div>

      {/* VARDİYA PERSONEL LİSTESİ MODAL */}
      {showShiftPersonnelModal && selectedShiftTypeForList && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowShiftPersonnelModal(false)}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-md overflow-hidden ring-1 ring-[#2B416B]" onClick={(e) => e.stopPropagation()}>
            <div className={`bg-gradient-to-r p-6 border-b border-[#2B416B] ${
              selectedShiftTypeForList === 'Gündüz' ? 'from-[#10B981] to-[#059669]' :
              selectedShiftTypeForList === 'Akşam' ? 'from-[#8B5CF6] to-[#7C3AED]' :
              selectedShiftTypeForList === 'İzin' ? 'from-[#F2B705] to-[#F59E0B]' :
              selectedShiftTypeForList === 'Tatil' ? 'from-[#10B981] to-[#059669]' :
              'from-[#EF4444] to-[#DC2626]'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-bold text-white flex items-center gap-2">
                    {selectedShiftTypeForList === 'Gündüz' && '☀️'}
                    {selectedShiftTypeForList === 'Akşam' && '🌆'}
                    {selectedShiftTypeForList === 'İzin' && '🏖️'}
                    {selectedShiftTypeForList === 'Tatil' && '🎉'}
                    {selectedShiftTypeForList === 'Raporlu' && '🏥'}
                    {selectedShiftTypeForList} Vardiyası
                  </div>
                  <div className="text-sm text-white/80 mt-1">
                    {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    {selectedShiftTypeForList === 'Gündüz' && ' • 08:00-17:00'}
                    {selectedShiftTypeForList === 'Akşam' && ' • 17:00-00:00'}
                  </div>
                </div>
                <button onClick={() => setShowShiftPersonnelModal(false)} className="text-white/60 hover:text-white text-2xl">×</button>
              </div>
            </div>
            <div className="p-6">
              {(() => {
                const today = new Date().toISOString().split('T')[0];
                const personnelInShift = shiftPersonnel.filter(p => getShiftForPersonnelAndDate(p, today) === selectedShiftTypeForList);
                
                if (personnelInShift.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-3">🤷‍♂️</div>
                      <div className="text-[#A7B8D8]">Bu vardiyada personel bulunmuyor</div>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-3">
                    <div className="text-sm text-[#A7B8D8] mb-3">
                      {personnelInShift.length} personel bu vardiyada
                    </div>
                    {personnelInShift.map((personnel, idx) => (
                      <div 
                        key={idx} 
                        className={`p-4 rounded-lg ring-1 transition-all ${
                          selectedShiftTypeForList === 'Gündüz' ? 'bg-[#10B981]/10 ring-[#10B981]/30' :
                          selectedShiftTypeForList === 'Akşam' ? 'bg-[#8B5CF6]/10 ring-[#8B5CF6]/30' :
                          selectedShiftTypeForList === 'İzin' ? 'bg-[#F2B705]/10 ring-[#F2B705]/30' :
                          selectedShiftTypeForList === 'Tatil' ? 'bg-[#10B981]/10 ring-[#10B981]/30' :
                          'bg-[#EF4444]/10 ring-[#EF4444]/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                              selectedShiftTypeForList === 'Gündüz' ? 'bg-[#10B981] text-white' :
                              selectedShiftTypeForList === 'Akşam' ? 'bg-[#8B5CF6] text-white' :
                              selectedShiftTypeForList === 'İzin' ? 'bg-[#F2B705] text-white' :
                              selectedShiftTypeForList === 'Tatil' ? 'bg-[#10B981] text-white' :
                              'bg-[#EF4444] text-white'
                            }`}>
                              {personnel.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-white">{personnel}</div>
                              <div className="text-xs text-[#A7B8D8]">
                                {selectedShiftTypeForList === 'Gündüz' && '08:00-17:00'}
                                {selectedShiftTypeForList === 'Akşam' && '17:00-00:00'}
                                {selectedShiftTypeForList === 'İzin' && 'Yıllık İzin'}
                                {selectedShiftTypeForList === 'Tatil' && 'Resmi Tatil'}
                                {selectedShiftTypeForList === 'Raporlu' && 'Sağlık Raporu'}
                              </div>
                            </div>
                          </div>
                          {personnel === 'Güneri Kerim' && (
                            <div className="text-xs px-2 py-1 rounded-full bg-[#2E86FF]/20 text-[#2E86FF] font-semibold">
                              Lider
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div className="mt-6">
                <button
                  onClick={() => setShowShiftPersonnelModal(false)}
                  className="w-full px-4 py-3 bg-[#2B416B] hover:bg-[#3B517B] text-white font-semibold rounded-lg transition"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BÖLGE ATM DETAY MODAL */}
      {showRegionModal && selectedRegion && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowRegionModal(false)}>
          <div className="bg-[#112544] rounded-2xl w-full max-w-6xl max-h-[85vh] overflow-hidden ring-1 ring-[#2B416B]" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#1E3A5F] to-[#112544] p-6 border-b border-[#2B416B]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white mb-2">{selectedRegion}</div>
                  <div className="text-sm text-[#A7B8D8]">
                    {(() => {
                      const regionAtms = (atmMasterData as ATM[]).filter(atm => atm.cash_center === selectedRegion);
                      return `${regionAtms.length} ATM - Son 24 Saat Aktivite`;
                    })()}
                  </div>
                </div>
                <button 
                  onClick={() => setShowRegionModal(false)}
                  className="text-white/60 hover:text-white text-2xl w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
              {/* Özet İstatistikler */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {(() => {
                  const regionAtms = (atmMasterData as ATM[]).filter(atm => atm.cash_center === selectedRegion);
                  const activeAtms = regionAtms.filter(atm => atm.active);
                  const salaryAtms = regionAtms.filter(atm => atm.salary_flag === 'Maaş');
                  const zone3Atms = regionAtms.filter(atm => atm.zone === '3');
                  
                  return (
                    <>
                      <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#2B416B]">
                        <div className="text-xs text-[#A7B8D8] mb-1">Toplam ATM</div>
                        <div className="text-2xl font-bold text-white">{regionAtms.length}</div>
                      </div>
                      <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#10B981]/50">
                        <div className="text-xs text-[#A7B8D8] mb-1">Aktif</div>
                        <div className="text-2xl font-bold text-[#10B981]">{activeAtms.length}</div>
                      </div>
                      <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#8B5CF6]/50">
                        <div className="text-xs text-[#A7B8D8] mb-1">Maaş ATM</div>
                        <div className="text-2xl font-bold text-[#8B5CF6]">{salaryAtms.length}</div>
                      </div>
                      <div className="bg-[#0E2142]/60 rounded-xl p-4 ring-1 ring-[#F2B705]/50">
                        <div className="text-xs text-[#A7B8D8] mb-1">Zone 3 (Kritik)</div>
                        <div className="text-2xl font-bold text-[#F2B705]">{zone3Atms.length}</div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* ATM Listesi */}
              <div className="space-y-3">
                {(atmMasterData as ATM[])
                  .filter(atm => atm.cash_center === selectedRegion)
                  .map((atm, idx) => {
                    // Mock operasyon verileri
                    const hasOperation = idx < 12; // İlk 12 ATM'de operasyon var
                    const operationType = idx % 3 === 0 ? 'İkmal' : 'Toplama';
                    const slaStatus = idx < 3 ? 'Aşıldı' : idx < 8 ? 'Risk' : 'İyi';
                    const lastOpTime = `${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 6)}h önce`;
                    
                    return (
                      <div 
                        key={atm.atm_id} 
                        className={`bg-[#0E2142]/60 rounded-xl p-4 ring-1 ${
                          slaStatus === 'Aşıldı' ? 'ring-[#EF4444]/50' : 
                          slaStatus === 'Risk' ? 'ring-[#F2B705]/50' : 
                          'ring-[#2B416B]'
                        } hover:bg-[#1A2F52]/60 transition-all`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          {/* Sol: ATM Bilgileri */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="text-sm font-bold text-white">{atm.atm_id}</div>
                              <div className="text-sm text-[#A7B8D8] truncate">{atm.atm_name}</div>
                              {atm.active && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981]">Aktif</span>
                              )}
                              {atm.salary_flag === 'Maaş' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#8B5CF6]/20 text-[#8B5CF6]">Maaş</span>
                              )}
                              {atm.zone === '3' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F2B705]/20 text-[#F2B705]">Zone 3</span>
                              )}
                            </div>
                            <div className="text-xs text-[#A7B8D8] mb-1">
                              📍 {atm.address || `${atm.district}, ${atm.city}`}
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-[#A7B8D8]">Marka: <span className="text-white font-semibold">{atm.brand || 'N/A'}</span></span>
                              <span className="text-[#A7B8D8]">Tip: <span className="text-white font-semibold">{atm.location_type || 'N/A'}</span></span>
                            </div>
                          </div>

                          {/* Sağ: Operasyon Durumu */}
                          {hasOperation && (
                            <div className="flex-shrink-0 text-right">
                              <div className={`text-xs font-semibold mb-2 ${
                                operationType === 'İkmal' ? 'text-[#2E86FF]' : 'text-[#F2B705]'
                              }`}>
                                {operationType === 'İkmal' ? '💵' : '💰'} {operationType}
                              </div>
                              <div className={`text-xs px-2 py-1 rounded-lg mb-1 ${
                                slaStatus === 'Aşıldı' ? 'bg-[#EF4444]/20 text-[#EF4444]' :
                                slaStatus === 'Risk' ? 'bg-[#F2B705]/20 text-[#F2B705]' :
                                'bg-[#10B981]/20 text-[#10B981]'
                              }`}>
                                SLA: {slaStatus}
                              </div>
                              <div className="text-[10px] text-[#A7B8D8]">{lastOpTime}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-[#0E2142]/60 p-4 border-t border-[#2B416B] flex items-center justify-between">
              <div className="text-xs text-[#A7B8D8]">
                💡 ATM kartlarına tıklayarak detaylı bilgilere ulaşabilirsiniz
              </div>
              <button
                onClick={() => setShowRegionModal(false)}
                className="px-4 py-2 bg-[#2E86FF] hover:bg-[#0066FF] text-white text-sm font-semibold rounded-lg transition-all"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
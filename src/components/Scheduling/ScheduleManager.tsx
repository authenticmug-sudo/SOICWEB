import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Wand2, 
  Search, 
  Filter, 
  Download, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Edit3, 
  Building2,
  Users,
  FileSpreadsheet,
  UserCheck,
  ClipboardList,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Layers,
  MapPin,
  DollarSign,
  ShieldAlert,
  CalendarDays,
  RotateCcw,
  X
} from 'lucide-react';
import { SOSchedule, Store, SOTeam, RegionArea, UserRole, AuditorPersonnel } from '../../types/stockOpname';
import { REGIONS } from '../../data/initialData';
import { getStatusBadgeClass, formatDateIndo, formatRupiah, parseSmartDate, formatDateISO } from '../../utils/formatters';
import { getDayNameIndo } from '../../utils/storeSyncUtils';
import { exportToCSV } from '../../services/storageService';
import { KorlapDashboard } from './KorlapDashboard';
import { ConfirmDeleteModal } from '../Common/ConfirmDeleteModal';
import { ToastNotification } from '../Common/ToastNotification';

interface ScheduleManagerProps {
  schedules: SOSchedule[];
  stores: Store[];
  teams: SOTeam[];
  personnel?: AuditorPersonnel[];
  currentRole?: UserRole;
  onOpenCreateModal: () => void;
  onOpenAutoGenerator: () => void;
  onOpenKorlapImageModal?: () => void;
  onOpenInputModal?: (scheduleOrId?: SOSchedule | string) => void;
  onUpdateStatus: (scheduleId: string, status: SOSchedule['status']) => void;
  onDeleteSchedule: (scheduleId: string) => void;
  onAssignPersonnel?: (schedule: SOSchedule) => void;
  onOpenGagalPindahModal?: (schedule: SOSchedule) => void;
  onConfirmScheduleFinished?: (scheduleId: string) => void;
  onApproveSchedule?: (scheduleId: string) => void;
  onRejectSchedule?: (scheduleId: string, reason?: string) => void;
  onTwoWaySync?: () => void;
}

export const ScheduleManager: React.FC<ScheduleManagerProps> = ({
  schedules,
  stores,
  teams,
  personnel = [],
  currentRole = 'ALL',
  onOpenCreateModal,
  onOpenAutoGenerator,
  onOpenKorlapImageModal,
  onOpenInputModal,
  onUpdateStatus,
  onDeleteSchedule,
  onAssignPersonnel,
  onOpenGagalPindahModal,
  onConfirmScheduleFinished,
  onApproveSchedule,
  onRejectSchedule,
  onTwoWaySync
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedGroupKorlap, setSelectedGroupKorlap] = useState<string>('ALL');
  const [tableLayoutMode, setTableLayoutMode] = useState<'SHEET_JADWAL' | 'COMPACT'>('SHEET_JADWAL');

  // Date, Month, Year Filter States
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedDay, setSelectedDay] = useState<string>('ALL');
  const [selectedSpecificDate, setSelectedSpecificDate] = useState<string>('');
  
  const [superAdminRoleMode, setSuperAdminRoleMode] = useState<'SUPERVISOR' | 'OFFICER'>('SUPERVISOR');
  const [viewMode, setViewMode] = useState<'list' | 'officer' | 'calendar' | 'approval'>(
    currentRole === 'OFFICER' ? 'officer' : 'list'
  );
  const [approvalTab, setApprovalTab] = useState<'SELESAI' | 'PINDAH' | 'GAGAL'>('SELESAI');
  const [scheduleToDelete, setScheduleToDelete] = useState<SOSchedule | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 6 Main Korlap groups from sheet JADWAL & PERSONIL
  const primaryKorlaps = useMemo(() => [
    'I WAYAN ANGGA RISTA',
    'ODI TRI ANGGARA',
    'ANGGA ARDIYANSYAH',
    'ABDUL RAHMAN',
    'I GEDE PASEK SANTIKA',
    'PUTU BISMA'
  ], []);

  // Compute available regions strictly from store master data
  const availableRegions = useMemo(() => {
    const set = new Set<string>();
    stores.forEach(s => {
      if (s.region) set.add(s.region);
      else if (s.kabupaten) set.add(s.kabupaten);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [stores]);

  // Compute available years dynamically from schedules
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    set.add('2026');
    set.add('2025');
    set.add('2027');
    schedules.forEach(s => {
      const parsed = parseSmartDate(s.scheduledDate);
      if (parsed) {
        set.add(String(parsed.getFullYear()));
      } else if (s.scheduledDate) {
        const m = s.scheduledDate.match(/\b(20\d{2})\b/);
        if (m) set.add(m[1]);
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [schedules]);

  const monthOptions = [
    { value: 'ALL', label: 'Semua Bulan' },
    { value: '01', label: '01 - Januari' },
    { value: '02', label: '02 - Februari' },
    { value: '03', label: '03 - Maret' },
    { value: '04', label: '04 - April' },
    { value: '05', label: '05 - Mei' },
    { value: '06', label: '06 - Juni' },
    { value: '07', label: '07 - Juli' },
    { value: '08', label: '08 - Agustus' },
    { value: '09', label: '09 - September' },
    { value: '10', label: '10 - Oktober' },
    { value: '11', label: '11 - November' },
    { value: '12', label: '12 - Desember' }
  ];

  const dayOptions = useMemo(() => {
    return Array.from({ length: 31 }, (_, i) => {
      const dayNum = i + 1;
      const dayVal = String(dayNum).padStart(2, '0');
      return { value: dayVal, label: `Tgl ${dayNum}` };
    });
  }, []);

  const isDateFilterActive = selectedYear !== 'ALL' || selectedMonth !== 'ALL' || selectedDay !== 'ALL' || Boolean(selectedSpecificDate);

  const handleResetDateFilters = () => {
    setSelectedYear('ALL');
    setSelectedMonth('ALL');
    setSelectedDay('ALL');
    setSelectedSpecificDate('');
  };

  const handleSetToday = () => {
    const today = new Date();
    const iso = formatDateISO(today);
    setSelectedSpecificDate(iso);
    setSelectedYear(String(today.getFullYear()));
    setSelectedMonth(String(today.getMonth() + 1).padStart(2, '0'));
    setSelectedDay(String(today.getDate()).padStart(2, '0'));
  };

  // Pending approval schedule groups
  const pendingSelesai = schedules.filter(s => s.status === 'Selesai' && (s.spvApprovalStatus === 'Menunggu Approval SPV' || !s.spvApprovalStatus));
  const pendingPindah = schedules.filter(s => (s.status === 'Pindah Toko' || s.failureOrMoveType === 'Pindah Toko') && (s.spvApprovalStatus === 'Menunggu Approval SPV' || !s.spvApprovalStatus));
  const pendingGagal = schedules.filter(s => (s.status === 'Gagal SO' || s.failureOrMoveType === 'Gagal SO') && (s.spvApprovalStatus === 'Menunggu Approval SPV' || !s.spvApprovalStatus));
  const totalPendingApprovalCount = pendingSelesai.length + pendingPindah.length + pendingGagal.length;

  // Effective role for layout rendering
  const activeRoleContext = currentRole === 'ALL' ? superAdminRoleMode : currentRole;

  // Sync viewMode if currentRole changes
  React.useEffect(() => {
    if (activeRoleContext === 'OFFICER') {
      if (viewMode === 'approval') {
        setViewMode('officer');
      }
    }
  }, [currentRole, superAdminRoleMode, activeRoleContext, viewMode]);

  // Filtered schedules
  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      const matchesSearch = 
        s.storeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.teamName && s.teamName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.teamCategory && s.teamCategory.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.groupName && s.groupName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.personilLeader && s.personilLeader.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.officerInCharge && s.officerInCharge.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.spvInCharge && s.spvInCharge.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesRegion = selectedRegion === 'ALL' || s.region === selectedRegion;
      const matchesStatus = selectedStatus === 'ALL' || s.status === selectedStatus;
      
      let matchesGroup = true;
      if (selectedGroupKorlap !== 'ALL') {
        const gName = (s.groupName || s.officerInCharge || '').toLowerCase();
        const selG = selectedGroupKorlap.toLowerCase();
        matchesGroup = gName.includes(selG) || selG.includes(gName);
      }

      // Date Filtering Logic
      let matchesDate = true;
      if (selectedSpecificDate) {
        const parsed = parseSmartDate(s.scheduledDate);
        if (parsed) {
          const iso = formatDateISO(parsed);
          matchesDate = iso === selectedSpecificDate || s.scheduledDate === selectedSpecificDate;
        } else {
          matchesDate = s.scheduledDate.includes(selectedSpecificDate);
        }
      } else if (selectedYear !== 'ALL' || selectedMonth !== 'ALL' || selectedDay !== 'ALL') {
        const parsed = parseSmartDate(s.scheduledDate);
        if (parsed) {
          const y = String(parsed.getFullYear());
          const m = String(parsed.getMonth() + 1).padStart(2, '0');
          const d = String(parsed.getDate()).padStart(2, '0');

          const matchesYear = selectedYear === 'ALL' || y === selectedYear;
          const matchesMonth = selectedMonth === 'ALL' || m === selectedMonth;
          const matchesDay = selectedDay === 'ALL' || d === selectedDay;

          matchesDate = matchesYear && matchesMonth && matchesDay;
        } else {
          let ok = true;
          if (selectedYear !== 'ALL' && !s.scheduledDate.includes(selectedYear)) ok = false;
          if (selectedMonth !== 'ALL' && !s.scheduledDate.includes(`-${selectedMonth}-`) && !s.scheduledDate.includes(`/${selectedMonth}/`)) ok = false;
          if (selectedDay !== 'ALL' && !s.scheduledDate.includes(selectedDay)) ok = false;
          matchesDate = ok;
        }
      }

      return matchesSearch && matchesRegion && matchesStatus && matchesGroup && matchesDate;
    });
  }, [schedules, searchQuery, selectedRegion, selectedStatus, selectedGroupKorlap, selectedYear, selectedMonth, selectedDay, selectedSpecificDate]);

  const getAccurateRegionForSchedule = (s: SOSchedule): string => {
    const matchingStore = stores.find(st => st.code === s.storeCode || st.id === s.storeId);
    if (matchingStore) {
      if (matchingStore.kabupaten) return matchingStore.kabupaten;
      if (matchingStore.region) return matchingStore.region;
    }
    return s.region || 'Kab. Badung';
  };

  const handleExportSchedules = () => {
    const data = filteredSchedules.map((s, idx) => ({
      'NO': idx + 1,
      'TEAM': s.teamCategory || s.teamName || 'TEAM 1',
      'GROUP': s.groupName || s.officerInCharge || 'I WAYAN ANGGA RISTA',
      'PERSONIL': s.personilLeader || (s.assignedPersonnelNames && s.assignedPersonnelNames[0]) || '',
      'HARI': s.dayName || getDayNameIndo(s.scheduledDate),
      'KODE TOKO': s.storeCode,
      'NAMA TOKO': s.storeName,
      'STOCK RP': s.stockRp || 0,
      'TGL SO': s.scheduledDate,
      'TYPE SO': s.typeSo || 'M',
      'KAS TOKO': s.kasToko || 0,
      'ZONA': s.zona || 'NON ZONA HITAM',
      'AS': s.asInitial || '',
      'STATUS': s.status,
      'WILAYAH': getAccurateRegionForSchedule(s),
      'ANGGOTA TIM': s.assignedPersonnelNames && s.assignedPersonnelNames.length > 0 ? s.assignedPersonnelNames.join('; ') : 'Belum Dialokasikan',
      'CATATAN': s.notes || ''
    }));
    exportToCSV('Penjadwalan_SO_Sheet_Jadwal.csv', data);
  };

  return (
    <div className="space-y-4">
      
      {/* Header Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-600" />
                Penjadwalan Stock Opname (SO) Harian
              </h2>
              {currentRole === 'ALL' && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-200 flex items-center gap-1">
                  👑 Super Account Mode ({superAdminRoleMode === 'SUPERVISOR' ? 'View: Supervisor' : 'View: Korlap'})
                </span>
              )}
              {currentRole === 'OFFICER' && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Portal Korlap / Officer
                </span>
              )}
              {currentRole === 'SUPERVISOR' && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Portal Supervisor
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeRoleContext === 'OFFICER' 
                ? 'Portal Eksekusi & Monitoring Lapangan Hari-H & H-1 untuk Korlap & Auditor SO'
                : 'Struktur Penjadwalan terhubung langsung dengan Sheet Jadwal & Master Toko Bali (VLOOKUP IDM)'}
            </p>
          </div>

          {/* Role Switcher for Super Account */}
          {currentRole === 'ALL' && (
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-purple-200 shadow-2xs">
              <button
                onClick={() => {
                  setSuperAdminRoleMode('SUPERVISOR');
                  setViewMode('list');
                }}
                className={`w-full sm:w-auto px-3 py-2 text-xs font-black rounded-lg transition flex items-center justify-center gap-1.5 ${
                  superAdminRoleMode === 'SUPERVISOR'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <span>👔 Portal Supervisor</span>
              </button>

              <button
                onClick={() => {
                  setSuperAdminRoleMode('OFFICER');
                  setViewMode('officer');
                }}
                className={`w-full sm:w-auto px-3 py-2 text-xs font-black rounded-lg transition flex items-center justify-center gap-1.5 ${
                  superAdminRoleMode === 'OFFICER'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <span>📱 Portal Korlap (H-1 & Hari-H)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Toolbar & Sub-Menu Navigation */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-500" />
            <input
              type="text"
              placeholder="Cari toko, IDM, personil, group korlap, zona..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 hover:border-slate-400 focus:border-indigo-500 focus:bg-white rounded-xl text-xs sm:text-sm pl-10 pr-4 py-2.5 text-slate-900 font-medium placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-700 bg-slate-200/60 w-5 h-5 rounded-full flex items-center justify-center"
              >
                ✕
              </button>
            )}
          </div>

          {/* Group Korlap, Region & Status Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Group Korlap Filter */}
            <select
              value={selectedGroupKorlap}
              onChange={(e) => setSelectedGroupKorlap(e.target.value)}
              className="bg-slate-50 border border-indigo-200 hover:border-indigo-400 text-xs sm:text-sm font-bold rounded-xl px-3 py-2 text-indigo-950 focus:outline-none focus:border-indigo-500 cursor-pointer transition"
            >
              <option value="ALL">🎯 Semua Group Korlap ({primaryKorlaps.length})</option>
              {primaryKorlaps.map(k => (
                <option key={k} value={k}>Group: {k}</option>
              ))}
            </select>

            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="bg-slate-50 border border-slate-300 hover:border-slate-400 text-xs sm:text-sm font-bold rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer transition"
            >
              <option value="ALL">📍 Semua Kabupaten ({availableRegions.length})</option>
              {availableRegions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-300 hover:border-slate-400 text-xs sm:text-sm font-bold rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer transition"
            >
              <option value="ALL">🏷️ Semua Status</option>
              <option value="Terjadwal">Terjadwal</option>
              <option value="Proses SO">Proses SO</option>
              <option value="Menunggu Rekapan">Menunggu Rekapan</option>
              <option value="Selesai">Selesai</option>
              <option value="Gagal SO">Gagal SO</option>
              <option value="Pindah Toko">Pindah Toko</option>
            </select>
          </div>

        </div>

        {/* Date, Month, Year Filter Row */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          
          {/* Left: Date Selector Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100/80 px-2.5 py-1.5 rounded-xl border border-slate-200 shrink-0">
              <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
              <span>Filter Waktu SO:</span>
            </div>

            {/* Year Selector */}
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setSelectedSpecificDate('');
              }}
              className="bg-slate-50 border border-slate-300 hover:border-slate-400 text-xs font-bold rounded-xl px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer transition"
              title="Filter Berdasarkan Tahun"
            >
              <option value="ALL">🗓️ Semua Tahun</option>
              {availableYears.map(y => (
                <option key={y} value={y}>Tahun {y}</option>
              ))}
            </select>

            {/* Month Selector */}
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedSpecificDate('');
              }}
              className="bg-slate-50 border border-slate-300 hover:border-slate-400 text-xs font-bold rounded-xl px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer transition"
              title="Filter Berdasarkan Bulan"
            >
              {monthOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            {/* Day Selector (1-31) */}
            <select
              value={selectedDay}
              onChange={(e) => {
                setSelectedDay(e.target.value);
                setSelectedSpecificDate('');
              }}
              className="bg-slate-50 border border-slate-300 hover:border-slate-400 text-xs font-bold rounded-xl px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer transition"
              title="Filter Berdasarkan Tanggal (1-31)"
            >
              <option value="ALL">📅 Semua Tanggal (1-31)</option>
              {dayOptions.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>

            {/* Specific Exact Date Picker */}
            <div className="relative flex items-center" title="Pilih Tanggal Spesifik (Kalender)">
              <input
                type="date"
                value={selectedSpecificDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedSpecificDate(val);
                  if (val) {
                    const [y, m, d] = val.split('-');
                    setSelectedYear(y || 'ALL');
                    setSelectedMonth(m || 'ALL');
                    setSelectedDay(d || 'ALL');
                  }
                }}
                className="bg-slate-50 border border-slate-300 hover:border-slate-400 text-xs font-semibold rounded-xl px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer transition"
              />
            </div>

          </div>

          {/* Right: Quick shortcuts & Reset */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleSetToday}
              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedSpecificDate('');
                setSelectedYear('2026');
                setSelectedMonth('09');
                setSelectedDay('ALL');
              }}
              className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl border border-purple-200 transition"
            >
              Sep 2026
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedSpecificDate('');
                setSelectedYear('2026');
                setSelectedMonth('08');
                setSelectedDay('ALL');
              }}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition"
            >
              Ags 2026
            </button>

            {isDateFilterActive && (
              <button
                type="button"
                onClick={handleResetDateFilters}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition flex items-center gap-1"
                title="Reset filter tanggal"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Tanggal</span>
              </button>
            )}
          </div>

        </div>

        {/* Sub-Menu Tabs Pill Box & Action Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 w-full sm:w-auto overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3.5 py-1.5 text-xs sm:text-sm rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                viewMode === 'list' 
                  ? 'bg-slate-900 text-white shadow-xs font-black' 
                  : 'text-slate-600 hover:text-slate-900 font-bold hover:bg-white/60'
              }`}
            >
              <span>📋 List Jadwal SO</span>
            </button>

            <button
              onClick={() => setViewMode('officer')}
              className={`px-3.5 py-1.5 text-xs sm:text-sm rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                viewMode === 'officer' 
                  ? 'bg-emerald-600 text-white shadow-xs font-black' 
                  : 'text-slate-700 hover:text-emerald-700 font-bold hover:bg-emerald-50'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Menu Korlap (H-1 & Hari-H)</span>
            </button>

            {activeRoleContext !== 'OFFICER' && (
              <button
                onClick={() => setViewMode('approval')}
                className={`px-3.5 py-1.5 text-xs sm:text-sm rounded-lg transition-all flex items-center gap-2 relative shrink-0 ${
                  viewMode === 'approval' 
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs font-black' 
                    : 'text-indigo-900 hover:text-indigo-700 font-extrabold hover:bg-indigo-50/80 bg-indigo-50/40 border border-indigo-200/60'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                <span>Approval SPV</span>
                {totalPendingApprovalCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-bounce shadow-xs">
                    {totalPendingApprovalCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3.5 py-1.5 text-xs sm:text-sm rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                viewMode === 'calendar' 
                  ? 'bg-rose-600 text-white shadow-xs font-black' 
                  : 'text-slate-600 hover:text-slate-900 font-bold hover:bg-white/60'
              }`}
            >
              <span>📅 Kalender</span>
            </button>
          </div>

          {/* Action Buttons: Two-Way Sync, Export, Add Schedule */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
            
            {onTwoWaySync && (
              <button
                onClick={() => {
                  onTwoWaySync();
                  setToastMessage('Sinkronisasi 2-Arah Master Toko Bali & Sheet Jadwal Berhasil!');
                }}
                className="w-full sm:w-auto px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
                title="Sinkronkan dua arah jadwal SO dengan kolom SO September di Master Toko Bali"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                <span>2-Way Sync Master</span>
              </button>
            )}

            {activeRoleContext !== 'OFFICER' && viewMode !== 'officer' && (
              <>
                {onOpenKorlapImageModal && (
                  <button
                    onClick={onOpenKorlapImageModal}
                    className="w-full sm:w-auto px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition flex items-center justify-center gap-1.5"
                    title="Buat rute toko & gambar jadwal Excel Korlap"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-200 shrink-0" />
                    <span className="truncate">Input Korlap & Image</span>
                  </button>
                )}

                <button
                  onClick={onOpenAutoGenerator}
                  className="w-full sm:w-auto px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-98 text-white rounded-xl text-xs font-black shadow-xs hover:shadow transition flex items-center justify-center gap-1.5"
                  title="Generate otomatis jadwal dari 700+ toko"
                >
                  <Wand2 className="w-4 h-4 text-purple-200 shrink-0" />
                  <span className="truncate">Auto-Schedule</span>
                </button>

                <button
                  onClick={onOpenCreateModal}
                  className="w-full sm:w-auto px-3 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-black shadow-xs hover:shadow transition flex items-center justify-center gap-1.5"
                  title="Tambah 1 jadwal audit toko manual"
                >
                  <Plus className="w-4 h-4 text-indigo-200 shrink-0" />
                  <span className="truncate">+ Tambah Jadwal</span>
                </button>
              </>
            )}

            <button
              onClick={handleExportSchedules}
              className="w-full sm:w-auto px-3 py-2 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold border border-slate-300 transition flex items-center justify-center gap-1.5 shadow-2xs"
              title="Download rekap data jadwal ke file CSV"
            >
              <Download className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="truncate">Export CSV</span>
            </button>
          </div>

        </div>

      </div>

      {/* Main Content View */}
      {viewMode === 'officer' ? (
        <KorlapDashboard
          schedules={filteredSchedules}
          stores={stores}
          personnel={personnel}
          onOpenAssignPersonnel={onAssignPersonnel || (() => {})}
          onOpenGagalPindahModal={onOpenGagalPindahModal || (() => {})}
          onOpenInputResultModal={onOpenInputModal || (() => {})}
          onConfirmScheduleFinished={onConfirmScheduleFinished || ((id) => onUpdateStatus(id, 'Selesai'))}
        />
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          
          {/* Table Header Controls: Toggle Columns View */}
          <div className="p-3 px-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-800">
                Tabel Penjadwalan ({filteredSchedules.length} Toko)
              </span>
              <span className="text-[11px] text-slate-500">
                • {selectedGroupKorlap === 'ALL' ? 'Semua Group' : `Group: ${selectedGroupKorlap}`}
              </span>
              {isDateFilterActive && (
                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200 flex items-center gap-1">
                  <CalendarDays className="w-3 h-3 text-indigo-600" />
                  <span>
                    {selectedSpecificDate 
                      ? formatDateIndo(selectedSpecificDate)
                      : `${selectedDay !== 'ALL' ? `Tgl ${parseInt(selectedDay)} ` : ''}${selectedMonth !== 'ALL' ? `${monthOptions.find(m => m.value === selectedMonth)?.label.split(' - ')[1]} ` : ''}${selectedYear !== 'ALL' ? selectedYear : ''}`
                    }
                  </span>
                  <button 
                    type="button" 
                    onClick={handleResetDateFilters}
                    className="ml-0.5 hover:text-rose-600 font-black text-[11px]"
                    title="Hapus filter tanggal"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setTableLayoutMode('SHEET_JADWAL')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  tableLayoutMode === 'SHEET_JADWAL'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📊 Format Sheet Jadwal (Lengkap)
              </button>
              <button
                type="button"
                onClick={() => setTableLayoutMode('COMPACT')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  tableLayoutMode === 'COMPACT'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📱 Format Ringkas
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {tableLayoutMode === 'SHEET_JADWAL' ? (
              /* Complete 14-Column Sheet Jadwal View */
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-black uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3 w-10 text-center">No</th>
                    <th className="py-3 px-3">Team</th>
                    <th className="py-3 px-3">Group</th>
                    <th className="py-3 px-3">Personil</th>
                    <th className="py-3 px-3">Hari</th>
                    <th className="py-3 px-3">Kode Toko</th>
                    <th className="py-3 px-3">Nama Toko</th>
                    <th className="py-3 px-3 text-right">Stock Rp</th>
                    <th className="py-3 px-3">Tgl SO</th>
                    <th className="py-3 px-3 text-center">Type SO</th>
                    <th className="py-3 px-3 text-right">Kas Toko</th>
                    <th className="py-3 px-3">Zona</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSchedules.length > 0 ? (
                    filteredSchedules.map((s, idx) => {
                      const isBlackZone = (s.zona || '').toUpperCase().includes('HITAM');
                      const assignedMembers = s.assignedPersonnelNames || [];
                      const personilLeaderText = s.personilLeader || (assignedMembers.length > 0 ? assignedMembers[0] : '-');

                      return (
                        <tr key={s.id} className={`hover:bg-slate-50/80 transition ${isBlackZone ? 'bg-rose-50/30' : ''}`}>
                          
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-500">
                            {idx + 1}
                          </td>

                          <td className="py-3 px-3 font-bold text-indigo-950 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-[11px]">
                              {s.teamCategory || s.teamName || 'TEAM 1'}
                            </span>
                          </td>

                          <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                            {s.groupName || s.officerInCharge || 'I WAYAN ANGGA RISTA'}
                          </td>

                          <td className="py-3 px-3 text-slate-800">
                            <div className="font-bold text-slate-900">{personilLeaderText}</div>
                            {assignedMembers.length > 1 && (
                              <span className="text-[10px] text-slate-500">+{assignedMembers.length - 1} personil</span>
                            )}
                          </td>

                          <td className="py-3 px-3 font-bold text-slate-700 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px]">
                              {s.dayName || getDayNameIndo(s.scheduledDate) || 'SELASA'}
                            </span>
                          </td>

                          <td className="py-3 px-3 font-mono font-black text-indigo-700 whitespace-nowrap">
                            {s.storeCode}
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{s.storeName}</div>
                            <div className="text-[10px] text-slate-500">{getAccurateRegionForSchedule(s)} {s.asInitial ? `• AS: ${s.asInitial}` : ''}</div>
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatRupiah(s.stockRp || 0)}
                          </td>

                          <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                            {s.scheduledDate}
                          </td>

                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                              {s.typeSo || 'M'}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right font-mono text-emerald-700 font-semibold whitespace-nowrap">
                            {formatRupiah(s.kasToko || 0)}
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isBlackZone 
                                ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}>
                              {s.zona || 'NON ZONA HITAM'}
                            </span>
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`px-2.5 py-1 text-[10px] rounded-full font-bold ${getStatusBadgeClass(s.status)}`}>
                              {s.status}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {onAssignPersonnel && (
                                <button
                                  onClick={() => onAssignPersonnel(s)}
                                  title="Alokasi Personil Tim"
                                  className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                                >
                                  <Users className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                onClick={() => setScheduleToDelete(s)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                title="Hapus Jadwal"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={14} className="py-12 text-center text-slate-400">
                        Tidak ditemukan jadwal SO yang sesuai filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              /* Compact Table View */
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Toko & Kode</th>
                    <th className="py-3 px-4">Wilayah</th>
                    <th className="py-3 px-4">Tanggal & Jam</th>
                    <th className="py-3 px-4">Group & Tim</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSchedules.length > 0 ? (
                    filteredSchedules.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition">
                        
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{s.storeName}</div>
                          <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-400" /> {s.storeCode}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-600 max-w-[180px] truncate">
                          <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                            {getAccurateRegionForSchedule(s)}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{formatDateIndo(s.scheduledDate)}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{s.scheduledTime} WITA</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">
                            {s.groupName || s.officerInCharge || 'I WAYAN ANGGA RISTA'}
                          </div>
                          <div className="text-[10px] text-indigo-600 font-medium">
                            {s.teamCategory || s.teamName} • Leader: {s.personilLeader || '-'}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 text-[10px] rounded-full border font-semibold ${getStatusBadgeClass(s.status)}`}>
                            {s.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            
                            {s.status === 'Terjadwal' && (
                              <button
                                onClick={() => onUpdateStatus(s.id, 'Proses SO')}
                                className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-medium transition"
                              >
                                Mulai SO
                              </button>
                            )}

                            {s.status === 'Proses SO' && (
                              <button
                                onClick={() => onUpdateStatus(s.id, 'Menunggu Rekapan')}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-medium transition"
                              >
                                Input Rekapan
                              </button>
                            )}

                            {s.status === 'Menunggu Rekapan' && (
                              <button
                                onClick={() => onUpdateStatus(s.id, 'Selesai')}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-medium transition"
                              >
                                Tandai Selesai
                              </button>
                            )}

                            <button
                              onClick={() => setScheduleToDelete(s)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                              title="Hapus Jadwal"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                          </div>
                        </td>

                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        Tidak ditemukan jadwal SO yang sesuai filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : viewMode === 'approval' ? (
        /* Approval SPV Interactive Dashboard */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Approval Header & Sub-Tabs */}
          <div className="p-4 bg-slate-900 text-white border-b border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-indigo-400" />
                  Portal Approval Supervisor (Persetujuan Selesai, Pindah & Gagal SO)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sinkronisasi real-time aktivitas Korlap & Officer Hari-H yang memerlukan verifikasi Supervisor.
                </p>
              </div>
              <div className="text-xs bg-indigo-950 border border-indigo-700/60 text-indigo-200 px-3 py-1.5 rounded-lg font-mono">
                Total Menunggu Approval: <strong className="text-white text-sm font-bold">{totalPendingApprovalCount} Toko</strong>
              </div>
            </div>

            {/* Approval Category Tabs */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800 flex-wrap">
              <button
                type="button"
                onClick={() => setApprovalTab('SELESAI')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                  approvalTab === 'SELESAI' ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span>✓ Toko Selesai SO</span>
                <span className="bg-black/30 px-1.5 py-0.2 rounded-full text-[10px]">{pendingSelesai.length}</span>
              </button>
              <button
                type="button"
                onClick={() => setApprovalTab('PINDAH')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                  approvalTab === 'PINDAH' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span>↪ Toko Pindah Jadwal</span>
                <span className="bg-black/30 px-1.5 py-0.2 rounded-full text-[10px]">{pendingPindah.length}</span>
              </button>
              <button
                type="button"
                onClick={() => setApprovalTab('GAGAL')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                  approvalTab === 'GAGAL' ? 'bg-rose-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span>⚠ Toko Gagal SO</span>
                <span className="bg-black/30 px-1.5 py-0.2 rounded-full text-[10px]">{pendingGagal.length}</span>
              </button>
            </div>
          </div>

          {/* List of Approval Items */}
          <div className="p-4 bg-slate-50 min-h-[300px]">
            {approvalTab === 'SELESAI' && (
              <div className="space-y-3">
                {pendingSelesai.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs font-medium">
                    🎉 Tidak ada pengajuan Toko Selesai SO yang menunggu approval.
                  </div>
                ) : (
                  pendingSelesai.map(item => (
                    <div key={item.id} className="p-4 bg-white rounded-xl border border-emerald-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1 max-w-lg">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">{item.storeCode}</span>
                          <h4 className="text-sm font-bold text-slate-900">{item.storeName}</h4>
                          <span className="text-[10px] font-medium text-slate-500">({item.region})</span>
                        </div>
                        <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                          <span>📅 Tanggal: <strong>{formatDateIndo(item.scheduledDate)}</strong></span>
                          <span>👤 Korlap: <strong>{item.officerInCharge || item.teamName}</strong></span>
                        </div>
                        {item.notes && <p className="text-[11px] text-slate-500 bg-slate-50 p-1.5 rounded font-mono">📝 {item.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onRejectSchedule && onRejectSchedule(item.id, 'Cek ulang fisik & rekapan')}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 font-bold text-xs rounded-lg transition"
                        >
                          ↺ Minta Audit Ulang
                        </button>
                        <button
                          type="button"
                          onClick={() => onApproveSchedule && onApproveSchedule(item.id)}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-sm"
                        >
                          ✓ Setujui Selesai SO
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {approvalTab === 'PINDAH' && (
              <div className="space-y-3">
                {pendingPindah.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs font-medium">
                    🎉 Tidak ada laporan Pindah Toko yang menunggu approval SPV.
                  </div>
                ) : (
                  pendingPindah.map(item => (
                    <div key={item.id} className="p-4 bg-white rounded-xl border border-amber-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1 max-w-lg">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">{item.storeCode}</span>
                          <h4 className="text-sm font-bold text-slate-900">{item.storeName}</h4>
                          <span className="text-[10px] font-bold bg-amber-500 text-slate-950 px-2 py-0.2 rounded-full">Pindah Toko</span>
                        </div>
                        <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                          <span>📅 Tanggal Asal: <strong>{formatDateIndo(item.scheduledDate)}</strong></span>
                          <span>👤 Korlap/Officer: <strong>{item.officerInCharge || item.teamName}</strong></span>
                        </div>
                        {item.failureOrMoveReason && (
                          <div className="text-xs text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                            <strong>Alasan Pindah:</strong> {item.failureOrMoveReason}
                            {item.replacementStoreCode && (
                              <div className="mt-1 font-bold text-amber-950">
                                ➔ Toko Pengganti: {item.replacementStoreCode} - {item.replacementStoreName}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onRejectSchedule && onRejectSchedule(item.id)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 font-bold text-xs rounded-lg transition"
                        >
                          ✕ Tolak Pindah Toko
                        </button>
                        <button
                          type="button"
                          onClick={() => onApproveSchedule && onApproveSchedule(item.id)}
                          className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition shadow-sm"
                        >
                          ✓ Setujui Pindah Toko
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {approvalTab === 'GAGAL' && (
              <div className="space-y-3">
                {pendingGagal.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs font-medium">
                    🎉 Tidak ada laporan Toko Gagal SO yang menunggu approval.
                  </div>
                ) : (
                  pendingGagal.map(item => (
                    <div key={item.id} className="p-4 bg-white rounded-xl border border-rose-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1 max-w-lg">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold bg-rose-100 text-rose-900 px-2 py-0.5 rounded">{item.storeCode}</span>
                          <h4 className="text-sm font-bold text-slate-900">{item.storeName}</h4>
                          <span className="text-[10px] font-bold bg-rose-600 text-white px-2 py-0.2 rounded-full">Gagal SO</span>
                        </div>
                        <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                          <span>📅 Tanggal: <strong>{formatDateIndo(item.scheduledDate)}</strong></span>
                          <span>👤 Korlap/Officer: <strong>{item.officerInCharge || item.teamName}</strong></span>
                        </div>
                        {item.failureOrMoveReason && (
                          <div className="text-xs text-rose-900 bg-rose-50 p-2 rounded-lg border border-rose-200">
                            <strong>Kendala / Alasan Gagal SO:</strong> {item.failureOrMoveReason}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onRejectSchedule && onRejectSchedule(item.id)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 font-bold text-xs rounded-lg transition"
                        >
                          ↺ Tolak & Buka Kembali
                        </button>
                        <button
                          type="button"
                          onClick={() => onApproveSchedule && onApproveSchedule(item.id)}
                          className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition shadow-sm"
                        >
                          ✓ Setujui Toko Gagal
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Calendar View Summary */
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-center py-8">
            <CalendarIcon className="w-12 h-12 text-indigo-500 mx-auto mb-3 opacity-80" />
            <h3 className="text-sm font-bold text-slate-800">Visualisasi Kalender Penjadwalan SO</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Menampilkan {filteredSchedules.length} jadwal terdaftar pada bulan ini dalam matriks harian.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-left">
              {['Terjadwal', 'Proses SO', 'Menunggu Rekapan', 'Selesai'].map((st) => {
                const count = filteredSchedules.filter(s => s.status === st).length;
                return (
                  <div key={st} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className={`px-2 py-0.5 text-[10px] rounded-full border ${getStatusBadgeClass(st)}`}>
                      {st}
                    </span>
                    <div className="text-xl font-bold text-slate-900 mt-2">{count} Toko</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Schedule Deletion */}
      <ConfirmDeleteModal
        isOpen={!!scheduleToDelete}
        onClose={() => setScheduleToDelete(null)}
        onConfirm={() => {
          if (scheduleToDelete) {
            onDeleteSchedule(scheduleToDelete.id);
            setToastMessage(`Jadwal SO toko ${scheduleToDelete.storeName} (${scheduleToDelete.storeCode}) berhasil dihapus!`);
            setScheduleToDelete(null);
          }
        }}
        title="Konfirmasi Hapus Penjadwalan SO"
        subtitle="Apakah Anda yakin ingin menghapus jadwal toko ini?"
        itemName={scheduleToDelete ? `${scheduleToDelete.storeCode} - ${scheduleToDelete.storeName}` : undefined}
        itemDetails={scheduleToDelete ? [
          { label: 'Tanggal SO', value: formatDateIndo(scheduleToDelete.scheduledDate) },
          { label: 'Jam Mulai', value: scheduleToDelete.scheduledTime || '08:00 WITA' },
          { label: 'Penanggung Jawab / Korlap', value: scheduleToDelete.officerInCharge || scheduleToDelete.spvInCharge || '-' },
          { label: 'Tim SO', value: scheduleToDelete.teamName || '-' },
          { label: 'Status Saat Ini', value: scheduleToDelete.status }
        ] : []}
        confirmText="Ya, Hapus"
        cancelText="Tidak, Batalkan"
        dangerBadgeText="Toko akan dihapus permanen dari jadwal SO."
      />

      {/* Success Toast Feedback */}
      {toastMessage && (
        <ToastNotification
          type="success"
          title="Sinkronisasi / Aksi Berhasil"
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}

    </div>
  );
};

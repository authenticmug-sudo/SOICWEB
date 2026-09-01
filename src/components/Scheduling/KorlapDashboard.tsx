import React, { useState, useMemo } from 'react';
import { 
  UserCheck, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Users, 
  ClipboardList, 
  Download, 
  Building2, 
  Clock, 
  FileSpreadsheet, 
  Filter, 
  Search,
  ChevronDown, 
  Sparkles,
  ShieldAlert,
  MapPin,
  DollarSign,
  Briefcase,
  Layers,
  CheckSquare,
  Navigation,
  ExternalLink,
  MessageSquare,
  LayoutGrid,
  Table as TableIcon,
  RefreshCw,
  X
} from 'lucide-react';
import { SOSchedule, Store, AuditorPersonnel, SOResult } from '../../types/stockOpname';
import { formatDateIndo, getStatusBadgeClass, formatDateISO, formatRupiah } from '../../utils/formatters';
import { getDayNameIndo } from '../../utils/storeSyncUtils';
import { exportToCSV } from '../../services/storageService';
import { BALI_KORLAP_GROUPS } from '../../data/baliData';
import { 
  getAvailableKorlapList, 
  isKorlapMatch, 
  normalizeKorlapName, 
  resolveSchedulePersonnelDisplay 
} from '../../utils/korlapUtils';

interface KorlapDashboardProps {
  schedules: SOSchedule[];
  stores: Store[];
  personnel: AuditorPersonnel[];
  results?: SOResult[];
  onOpenAssignPersonnel: (schedule: SOSchedule) => void;
  onOpenGagalPindahModal: (schedule: SOSchedule) => void;
  onOpenInputResultModal: (scheduleOrId?: SOSchedule | string) => void;
  onConfirmScheduleFinished: (scheduleId: string) => void;
}

export const KorlapDashboard: React.FC<KorlapDashboardProps> = ({
  schedules,
  stores,
  personnel,
  results = [],
  onOpenAssignPersonnel,
  onOpenGagalPindahModal,
  onOpenInputResultModal,
  onConfirmScheduleFinished
}) => {
  // Main Korlap groups from sheet JADWAL & PERSONIL
  const primaryKorlaps = useMemo(() => {
    return getAvailableKorlapList(personnel);
  }, [personnel]);

  const [selectedOfficer, setSelectedOfficer] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'HARI_H' | 'H_MINUS_1' | 'ALL_SEPTEMBER'>('HARI_H');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDateSpecific, setSelectedDateSpecific] = useState<string>('ALL');
  const [viewLayout, setViewLayout] = useState<'cards' | 'table'>('cards');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'BELUM_SO' | 'SELESAI' | 'KENDALA'>('ALL');

  // Modal State for SO Selesai Confirmation
  const [confirmingSchedule, setConfirmingSchedule] = useState<SOSchedule | null>(null);
  const [confirmInputText, setConfirmInputText] = useState<string>('');

  // Date Calculations for H-1 (Tomorrow) and Hari-H (Today)
  const now = new Date();
  const todayStr = formatDateISO(now);
  
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateISO(tomorrow);

  // Available unique dates in schedules
  const availableScheduleDates = useMemo(() => {
    const dates = new Set<string>();
    schedules.forEach(s => {
      if (s.scheduledDate) dates.add(s.scheduledDate);
    });
    return Array.from(dates).sort();
  }, [schedules]);

  // Determine which target date is being viewed based on activeTab
  const targetDateForView = activeTab === 'H_MINUS_1' 
    ? (availableScheduleDates.find(d => d >= tomorrowStr) || tomorrowStr)
    : activeTab === 'HARI_H' 
    ? todayStr 
    : selectedDateSpecific;

  // Helper to get Store details by code/id
  const getStoreDetail = (s: SOSchedule): Store | undefined => {
    return stores.find(st => st.id === s.storeId || st.code === s.storeCode);
  };

  // Filtered schedules for Korlap
  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      // 1. Filter by Officer / Group using strict Korlap matching
      if (selectedOfficer !== 'ALL') {
        const scheduleOfficer = s.officerInCharge || s.groupName || '';
        const store = getStoreDetail(s);
        const storeOfficer = store?.korlap || '';
        let matches = false;
        if (scheduleOfficer && scheduleOfficer.trim() !== '' && scheduleOfficer !== 'PETUGAS SO') {
          matches = isKorlapMatch(scheduleOfficer, selectedOfficer);
        } else if (storeOfficer) {
          matches = isKorlapMatch(storeOfficer, selectedOfficer);
        }
        if (!matches) return false;
      }

      // 2. Filter by Tab mode
      const normDate = formatDateISO(s.scheduledDate);
      if (activeTab === 'H_MINUS_1') {
        if (selectedDateSpecific !== 'ALL') {
          return normDate === selectedDateSpecific;
        }
        return normDate === targetDateForView || normDate === tomorrowStr;
      } else if (activeTab === 'HARI_H') {
        if (selectedDateSpecific !== 'ALL') {
          return normDate === selectedDateSpecific;
        }
        return normDate === todayStr;
      } else {
        if (selectedDateSpecific !== 'ALL') {
          return normDate === selectedDateSpecific;
        }
        return true;
      }
    }).filter(s => {
      // 3. Status Filter
      if (statusFilter === 'BELUM_SO') {
        return s.status === 'Terjadwal' || s.status === 'Proses SO' || s.status === 'Menunggu Rekapan';
      }
      if (statusFilter === 'SELESAI') {
        return s.status === 'Selesai';
      }
      if (statusFilter === 'KENDALA') {
        return s.status === 'Gagal SO' || s.status === 'Pindah Toko' || s.status === 'Dibatalkan';
      }
      return true;
    }).filter(s => {
      // 4. Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const store = getStoreDetail(s);
      return (
        s.storeCode.toLowerCase().includes(q) ||
        s.storeName.toLowerCase().includes(q) ||
        (s.officerInCharge && s.officerInCharge.toLowerCase().includes(q)) ||
        (s.personilLeader && s.personilLeader.toLowerCase().includes(q)) ||
        (s.zona && s.zona.toLowerCase().includes(q)) ||
        (s.notes && s.notes.toLowerCase().includes(q)) ||
        (store && store.region && store.region.toLowerCase().includes(q))
      );
    });
  }, [schedules, selectedOfficer, activeTab, targetDateForView, tomorrowStr, todayStr, selectedDateSpecific, statusFilter, searchQuery, stores]);

  // Metrics
  const totalTargetStores = filteredSchedules.length;
  const completedStores = filteredSchedules.filter(s => s.status === 'Selesai').length;
  const inProgressStores = filteredSchedules.filter(s => s.status === 'Proses SO' || s.status === 'Menunggu Rekapan' || s.status === 'Terjadwal').length;
  const failedOrMovedStores = filteredSchedules.filter(s => s.status === 'Gagal SO' || s.status === 'Pindah Toko' || s.status === 'Dibatalkan').length;

  const totalStockRp = filteredSchedules.reduce((acc, s) => {
    const store = getStoreDetail(s);
    return acc + (Number(s.stockRp) || Number(store?.saldoToko) || 0);
  }, 0);

  const totalKasToko = filteredSchedules.reduce((acc, s) => {
    const store = getStoreDetail(s);
    return acc + (Number(s.kasToko) || Number(store?.kasToko) || 0);
  }, 0);

  // Export CSV formatted for Korlap
  const handleExportCSV = () => {
    const exportData = filteredSchedules.map((s, idx) => {
      const store = getStoreDetail(s);
      const isAktiva = s.soAktiva || store?.soAktiva || 'Tidak';
      const zona = s.zona || store?.zona || (store?.isZonaHitam ? 'ZONA HITAM' : 'NON ZONA HITAM');
      const notesSPV = s.notes || store?.keterangan || '-';

      return {
        'NO': idx + 1,
        'KODE TOKO': s.storeCode,
        'NAMA TOKO': s.storeName,
        'STOCK RP': Number(s.stockRp) || Number(store?.saldoToko) || 0,
        'KAS TOKO': Number(s.kasToko) || Number(store?.kasToko) || 0,
        'TGL SO': s.scheduledDate,
        'HARI': s.dayName || getDayNameIndo(s.scheduledDate),
        'SO AKTIVA': isAktiva,
        'ZONA': zona,
        'KETERANGAN / NOTES SPV': notesSPV,
        'GROUP KORLAP': s.groupName || s.officerInCharge || '',
        'PERSONIL LEADER': s.personilLeader || (s.assignedPersonnelNames && s.assignedPersonnelNames[0]) || '',
        'STATUS': s.status
      };
    });

    exportToCSV(`Jadwal_SO_Hari_H_${activeTab}_${selectedOfficer.replace(/\s+/g, '_')}.csv`, exportData);
  };

  return (
    <div className="space-y-5">
      
      {/* Top Banner: Auto-Jadwal & Sheet Jadwal Connection */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-xl border border-indigo-500/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                Portal Operasional Korlap Mobile
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold">
                Auto Terhubung Master Toko Bali
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
              Jadwal SO Hari-H Korlap
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Tampilan operasional khusus Korlap: fokus pada <strong>Kode, Nama, Stock, Kas Toko, Tgl SO + Hari, SO Aktiva, Zona, dan Catatan SPV</strong> dengan aksi cepat mobile.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-98 text-white text-xs font-bold transition border border-white/10 flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export CSV Hari-H</span>
            </button>
          </div>
        </div>

        {/* Tab Selection: Hari-H vs H-1 vs Semua September */}
        <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-2">
          
          <button
            onClick={() => {
              setActiveTab('HARI_H');
              setSelectedDateSpecific('ALL');
            }}
            className={`p-3 rounded-xl text-left transition flex items-center justify-between border ${
              activeTab === 'HARI_H'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span className="font-bold text-xs">📍 Jadwal Hari-H (Hari Ini)</span>
              </div>
              <p className="text-[10px] opacity-80 mt-0.5">
                Target: {todayStr} ({getDayNameIndo(todayStr)})
              </p>
            </div>
            {activeTab === 'HARI_H' && (
              <span className="px-2 py-0.5 rounded-md bg-white/20 text-[10px] font-black">Aktif</span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('H_MINUS_1');
              setSelectedDateSpecific('ALL');
            }}
            className={`p-3 rounded-xl text-left transition flex items-center justify-between border ${
              activeTab === 'H_MINUS_1'
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-xs">📅 Jadwal H-1 (Persiapan Besok)</span>
              </div>
              <p className="text-[10px] opacity-80 mt-0.5">
                Target: {targetDateForView} ({getDayNameIndo(targetDateForView)})
              </p>
            </div>
            {activeTab === 'H_MINUS_1' && (
              <span className="px-2 py-0.5 rounded-md bg-white/20 text-[10px] font-black">Aktif</span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('ALL_SEPTEMBER');
              setSelectedDateSpecific('ALL');
            }}
            className={`p-3 rounded-xl text-left transition flex items-center justify-between border ${
              activeTab === 'ALL_SEPTEMBER'
                ? 'bg-purple-600 text-white border-purple-400 shadow-lg'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-purple-300" />
                <span className="font-bold text-xs">🗓️ Semua Jadwal September</span>
              </div>
              <p className="text-[10px] opacity-80 mt-0.5">
                Total {schedules.length} Toko Master Terhubung
              </p>
            </div>
            {activeTab === 'ALL_SEPTEMBER' && (
              <span className="px-2 py-0.5 rounded-md bg-white/20 text-[10px] font-black">Aktif</span>
            )}
          </button>

        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Target Toko</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl font-black text-slate-900">{totalTargetStores}</span>
            <span className="text-[10px] text-slate-500">Toko</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">SO Selesai</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl font-black text-emerald-700">{completedStores}</span>
            <span className="text-[10px] text-emerald-600">Toko</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider block">Total Stock Rp</span>
          <div className="text-xs sm:text-sm font-mono font-black text-indigo-900 truncate mt-1">
            {formatRupiah(totalStockRp)}
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">Total Kas Toko</span>
          <div className="text-xs sm:text-sm font-mono font-black text-emerald-700 truncate mt-1">
            {formatRupiah(totalKasToko)}
          </div>
        </div>
      </div>

      {/* Filter & Control Bar */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Korlap Group Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              Group Korlap:
            </span>
            <select
              value={selectedOfficer}
              onChange={(e) => setSelectedOfficer(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl px-3 py-2 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none max-w-[220px]"
            >
              <option value="ALL">Semua Korlap Bali ({primaryKorlaps.length} Group)</option>
              {primaryKorlaps.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode (F010), nama toko, zona, notes..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Layout Toggle */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setViewLayout('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                viewLayout === 'cards'
                  ? 'bg-white text-indigo-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Kartu Mobile</span>
            </button>
            <button
              type="button"
              onClick={() => setViewLayout('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                viewLayout === 'table'
                  ? 'bg-white text-indigo-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Tabel Ringkas</span>
            </button>
          </div>

        </div>

        {/* Status Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-[11px] font-bold text-slate-500 mr-1 shrink-0">Filter Status:</span>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({filteredSchedules.length})
          </button>
          <button
            onClick={() => setStatusFilter('BELUM_SO')}
            className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition ${
              statusFilter === 'BELUM_SO'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            Belum Selesai ({inProgressStores})
          </button>
          <button
            onClick={() => setStatusFilter('SELESAI')}
            className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition ${
              statusFilter === 'SELESAI'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Selesai ({completedStores})
          </button>
          {failedOrMovedStores > 0 && (
            <button
              onClick={() => setStatusFilter('KENDALA')}
              className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition ${
                statusFilter === 'KENDALA'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              Gagal/Pindah ({failedOrMovedStores})
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {filteredSchedules.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-xs space-y-2">
          <Calendar className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
          <h4 className="text-sm font-bold text-slate-800">Tidak ada jadwal SO yang sesuai</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {activeTab === 'HARI_H' 
              ? 'Tidak ada jadwal yang terdaftar untuk hari ini pada group korlap yang dipilih. Silakan cek tab Jadwal H-1 atau Rencana September.'
              : 'Coba ubah filter Korlap atau kata kunci pencarian.'}
          </p>
        </div>
      ) : viewLayout === 'cards' ? (
        
        /* ============================================================ */
        /* MOBILE-FIRST INTERACTIVE CARD VIEW                            */
        /* ============================================================ */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredSchedules.map((s, idx) => {
            const store = getStoreDetail(s);
            const isBlackZone = (s.zona || store?.zona || '').toUpperCase().includes('HITAM') || store?.isZonaHitam;
            const isAktiva = (s.soAktiva || store?.soAktiva || '').toUpperCase().includes('YA') || (s.soAktiva === 'Ya' || s.soAktiva === 'YA');
            const notesSPV = s.notes || store?.keterangan || '';
            const assignedMembers = s.assignedPersonnelNames || [];
            const personilDisplay = resolveSchedulePersonnelDisplay(s, store, personnel);
            const personilLeaderText = personilDisplay.leaderName;
            const isCompleted = s.status === 'Selesai';
            const isFailedOrMoved = s.status === 'Gagal SO' || s.status === 'Pindah Toko' || s.status === 'Dibatalkan';

            return (
              <div
                key={s.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md flex flex-col justify-between ${
                  isCompleted 
                    ? 'border-emerald-200 ring-1 ring-emerald-400/20 bg-emerald-50/10' 
                    : isFailedOrMoved 
                    ? 'border-rose-200 bg-rose-50/10' 
                    : isBlackZone 
                    ? 'border-amber-300/80 bg-amber-50/10' 
                    : 'border-slate-200 hover:border-indigo-300'
                }`}
              >
                {/* Card Top Header */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-start justify-between gap-2">
                  <div className="space-y-1 overflow-hidden flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-900 text-white font-mono font-black text-xs shadow-2xs">
                        {s.storeCode}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        isBlackZone 
                          ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {s.zona || (isBlackZone ? 'ZONA HITAM' : 'NON ZONA HITAM')}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isAktiva
                          ? 'bg-purple-100 text-purple-800 border-purple-300'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        Aktiva: {isAktiva ? 'Ya' : 'Tidak'}
                      </span>
                    </div>
                    
                    <h3 className="font-extrabold text-slate-900 text-sm leading-snug pt-0.5">
                      {s.storeName}
                    </h3>
                    
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {s.region || store?.region || 'Bali'}
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-slate-700">
                        {s.dayName || getDayNameIndo(s.scheduledDate)}, {formatDateIndo(s.scheduledDate)}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black shrink-0 ${getStatusBadgeClass(s.status)}`}>
                    {s.status}
                  </span>
                </div>

                {/* Card Body: Key Data (Stock, Kas Toko, Keterangan SPV) */}
                <div className="p-4 space-y-3 text-xs flex-1">
                  
                  {/* Financial Grid: Stock Rp and Kas Toko */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">
                        Saldo Stock Rp
                      </span>
                      <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm block">
                        {formatRupiah(Number(s.stockRp) || Number(store?.saldoToko) || 0)}
                      </span>
                    </div>
                    <div className="space-y-0.5 border-l border-slate-200 pl-2.5">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">
                        Kas Toko
                      </span>
                      <span className="font-mono font-bold text-emerald-700 text-xs sm:text-sm block">
                        {formatRupiah(Number(s.kasToko) || Number(store?.kasToko) || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Operational Group & Personnel Assigned */}
                  <div className="space-y-1 text-[11px]">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400 font-medium">Group Korlap:</span>
                      <span className="font-bold text-slate-800">{s.groupName || s.officerInCharge || 'I WAYAN ANGGA RISTA'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400 font-medium">Personil Leader:</span>
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                        👤 {personilLeaderText}
                        {assignedMembers.length > 1 && ` (+${assignedMembers.length - 1})`}
                      </span>
                    </div>
                  </div>

                  {/* Keterangan / Notes dari SPV */}
                  <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-950 space-y-0.5">
                    <div className="flex items-center gap-1 font-bold text-amber-900 text-[10px] uppercase">
                      <MessageSquare className="w-3 h-3 text-amber-700" />
                      <span>Keterangan / Notes (SPV):</span>
                    </div>
                    <p className="text-amber-900 leading-relaxed">
                      {notesSPV ? notesSPV : <span className="text-amber-600/80 italic">Tidak ada instruksi khusus dari SPV</span>}
                    </p>
                  </div>

                  {/* Coordinates & Google Maps Link if available */}
                  {store && store.latitude && store.longitude && (
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                      <span className="font-mono">
                        GPS: {store.latitude.toFixed(4)}, {store.longitude.toFixed(4)}
                      </span>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                      >
                        <Navigation className="w-2.5 h-2.5" />
                        <span>Buka Rute Maps</span>
                      </a>
                    </div>
                  )}

                </div>

                {/* Card Action Footer: 44px Touch Targets for Mobile */}
                <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                  
                  {/* 1. Alokasi Personil */}
                  <button
                    type="button"
                    onClick={() => onOpenAssignPersonnel(s)}
                    className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 active:scale-98 text-indigo-800 text-xs font-bold border border-indigo-200 flex items-center justify-center gap-1.5 transition"
                    title="Alokasi Personil Tim"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Personil</span>
                  </button>

                  {/* 2. Input Rekap SO / Hasil */}
                  <button
                    type="button"
                    onClick={() => onOpenInputResultModal(s)}
                    className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition"
                    title="Input Rekap Hasil SO"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>Rekap SO</span>
                  </button>

                  {/* 3. Pindah / Gagal SO Modal */}
                  <button
                    type="button"
                    onClick={() => onOpenGagalPindahModal(s)}
                    className="min-h-[40px] px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 active:scale-98 text-amber-800 text-xs font-bold border border-amber-200 flex items-center justify-center gap-1 transition"
                    title="Opsi Pindah Toko / Lapor Gagal SO"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span className="hidden sm:inline">Pindah/Gagal</span>
                  </button>

                  {/* 4. Konfirmasi Selesai jika belum selesai */}
                  {!isCompleted && (
                    <button
                      type="button"
                      onClick={() => setConfirmingSchedule(s)}
                      className="min-h-[40px] px-2.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 active:scale-98 text-slate-800 text-xs font-bold flex items-center justify-center transition"
                      title="Tandai Selesai Audit"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </button>
                  )}

                </div>
              </div>
            );
          })}
        </div>

      ) : (

        /* ============================================================ */
        /* DESKTOP TABLE VIEW (Formatted strictly per requirements)      */
        /* ============================================================ */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              <TableIcon className="w-4 h-4 text-indigo-600" />
              <span>Tabel Jadwal SO Hari-H Korlap ({filteredSchedules.length} Toko)</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              Fokus: Kode • Nama • Stock • Kas • Tgl+Hari • SO Aktiva • Zona • Notes SPV
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <th className="py-3 px-3 w-8 text-center">No</th>
                  <th className="py-3 px-3">Kode Toko</th>
                  <th className="py-3 px-3">Nama Toko</th>
                  <th className="py-3 px-3 text-right">Stock Rp</th>
                  <th className="py-3 px-3 text-right">Kas Toko</th>
                  <th className="py-3 px-3">Tgl SO + Hari</th>
                  <th className="py-3 px-3 text-center">SO Aktiva</th>
                  <th className="py-3 px-3">Zona</th>
                  <th className="py-3 px-3 min-w-[180px]">Keterangan / Notes (SPV)</th>
                  <th className="py-3 px-3">Personil</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Aksi Korlap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSchedules.map((s, idx) => {
                  const store = getStoreDetail(s);
                  const isBlackZone = (s.zona || store?.zona || '').toUpperCase().includes('HITAM') || store?.isZonaHitam;
                  const isAktiva = (s.soAktiva || store?.soAktiva || '').toUpperCase().includes('YA') || (s.soAktiva === 'Ya' || s.soAktiva === 'YA');
                  const notesSPV = s.notes || store?.keterangan || '-';
                  const assignedMembers = s.assignedPersonnelNames || [];
                  const personilDisplay = resolveSchedulePersonnelDisplay(s, store, personnel);
                  const personilLeaderText = personilDisplay.leaderName;

                  return (
                    <tr 
                      key={s.id}
                      className={`hover:bg-slate-50 transition ${
                        isBlackZone ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      <td className="py-3 px-3 font-mono font-black text-indigo-900 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200">
                          {s.storeCode}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-bold text-slate-900">
                        <div>{s.storeName}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{s.region || store?.region || 'Bali'}</div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatRupiah(Number(s.stockRp) || Number(store?.saldoToko) || 0)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-emerald-700 font-bold whitespace-nowrap">
                        {formatRupiah(Number(s.kasToko) || Number(store?.kasToko) || 0)}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-bold text-slate-800 block">
                          {s.dayName || getDayNameIndo(s.scheduledDate)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {s.scheduledDate}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isAktiva
                            ? 'bg-purple-100 text-purple-800 border border-purple-300'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {isAktiva ? 'Ya' : 'Tidak'}
                        </span>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isBlackZone
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {s.zona || (isBlackZone ? 'ZONA HITAM' : 'NON ZONA HITAM')}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-700 text-[11px] leading-snug">
                        {notesSPV}
                      </td>

                      <td className="py-3 px-3 text-slate-800 whitespace-nowrap">
                        <span className="font-bold text-xs flex items-center gap-1">
                          <Users className="w-3 h-3 text-indigo-600 shrink-0" />
                          {personilLeaderText}
                          {personilDisplay.assignedCount > 1 && (
                            <span className="text-[10px] text-indigo-600 font-semibold">(+{personilDisplay.assignedCount - 1})</span>
                          )}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 block mt-0.5">
                          Tim {personilDisplay.groupDisplayName}
                        </span>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${getStatusBadgeClass(s.status)}`}>
                          {s.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          
                          {/* Alokasi Personil */}
                          <button
                            onClick={() => onOpenAssignPersonnel(s)}
                            title="Alokasi Personil Tim"
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>

                          {/* Input Rekap SO */}
                          <button
                            onClick={() => onOpenInputResultModal(s)}
                            title="Input Rekap Hasil SO"
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                          >
                            <ClipboardList className="w-3.5 h-3.5" />
                          </button>

                          {/* Pindah / Gagal SO */}
                          <button
                            onClick={() => onOpenGagalPindahModal(s)}
                            title="Pindah Toko / Lapor Gagal SO"
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* Confirmation Modal for Marking Schedule Finished */}
      {confirmingSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-emerald-700">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Konfirmasi SO Selesai</h3>
                <p className="text-xs text-slate-500">
                  [{confirmingSchedule.storeCode}] {confirmingSchedule.storeName}
                </p>
              </div>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
              <p>Pastikan seluruh penghitungan fisik, scanning aktiva, dan kas toko telah direkapitulasi secara akurat bersama tim toko.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmingSchedule(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirmScheduleFinished(confirmingSchedule.id);
                  setConfirmingSchedule(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Ya, Tandai Selesai</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

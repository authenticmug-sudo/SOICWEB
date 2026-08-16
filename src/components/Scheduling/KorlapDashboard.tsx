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
  TrendingUp, 
  Clock, 
  CheckSquare, 
  FileSpreadsheet,
  Layers,
  Filter,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { SOSchedule, Store, AuditorPersonnel, SOResult } from '../../types/stockOpname';
import { formatDateIndo, getStatusBadgeClass, formatDateISO } from '../../utils/formatters';
import { exportToCSV } from '../../services/storageService';

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
  // Available Korlap officers list from personnel database - STRICTLY Officer / Korlap role
  const korlapsInDB = personnel.filter(p => p.role === 'Officer / Korlap');

  const [selectedOfficer, setSelectedOfficer] = useState<string>('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('AUTO_RELEASE'); // 'AUTO_RELEASE' | 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'ALL'

  // Modal State for SO Selesai Confirmation
  const [confirmingSchedule, setConfirmingSchedule] = useState<SOSchedule | null>(null);
  const [confirmInputText, setConfirmInputText] = useState<string>('');

  // Unique list of officer names in schedules
  const allOfficerNames = Array.from(
    new Set([
      ...korlapsInDB.map(p => p.name),
      ...schedules.map(s => s.officerInCharge).filter(Boolean).map(n => n?.split(' (')[0] || n)
    ])
  ).filter(Boolean) as string[];

  // Dates & Time calculations for auto-release (H-1 Jam 21:00 WITA / Hari-H)
  const now = new Date();
  const todayStr = formatDateISO(now);
  
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateISO(tomorrow);
  
  const currentHour = now.getHours();
  const isAfter21PM = currentHour >= 21; // 21:00 WITA

  // Helper to check if a schedule is released for Korlap
  const isScheduleAutoReleased = (schedDate: string): boolean => {
    if (!schedDate) return false;
    const normDate = formatDateISO(schedDate);
    if (normDate <= todayStr) return true; // Hari-H or past
    if (normDate === tomorrowStr && isAfter21PM) return true; // H-1 after 21:00 WITA
    return false;
  };

  // Filter schedules by officer and date range / release mode
  const filteredSchedules = schedules.filter(s => {
    // Filter by Korlap / Officer
    const matchesOfficer = selectedOfficer === 'ALL' || (s.officerInCharge && s.officerInCharge.toLowerCase().includes(selectedOfficer.toLowerCase()));
    if (!matchesOfficer) return false;

    const normDate = formatDateISO(s.scheduledDate);

    // Filter by Date Mode
    if (selectedDateFilter === 'AUTO_RELEASE') {
      return isScheduleAutoReleased(s.scheduledDate);
    } else if (selectedDateFilter === 'TODAY') {
      return normDate === todayStr;
    } else if (selectedDateFilter === 'TOMORROW') {
      return normDate === tomorrowStr;
    } else if (selectedDateFilter === 'THIS_WEEK') {
      const schedTime = new Date(normDate).getTime();
      const nowTime = new Date(todayStr).getTime();
      const diffDays = (schedTime - nowTime) / (1000 * 3600 * 24);
      return diffDays >= -1 && diffDays <= 7;
    }

    return true; // 'ALL'
  });

  // Group filtered schedules by Korlap Officer
  const groupedByKorlap = useMemo<Record<string, SOSchedule[]>>(() => {
    const map: Record<string, SOSchedule[]> = {};
    filteredSchedules.forEach(s => {
      const korlapKey = s.officerInCharge ? s.officerInCharge.split(' (')[0].trim() : 'Tanpa Korlap Terdaftar';
      if (!map[korlapKey]) map[korlapKey] = [];
      map[korlapKey].push(s);
    });
    return map;
  }, [filteredSchedules]);

  // Collapsed state per Korlap (default false = collapsed)
  const [expandedKorlaps, setExpandedKorlaps] = useState<Record<string, boolean>>({});

  const toggleKorlapExpand = (korlapKey: string) => {
    setExpandedKorlaps(prev => ({ ...prev, [korlapKey]: !prev[korlapKey] }));
  };

  const expandAllKorlaps = () => {
    const allExpanded: Record<string, boolean> = {};
    Object.keys(groupedByKorlap).forEach(k => allExpanded[k] = true);
    setExpandedKorlaps(allExpanded);
  };

  const collapseAllKorlaps = () => {
    setExpandedKorlaps({});
  };

  // Calculate Metrics
  const totalTargetStores = filteredSchedules.length;
  const completedStores = filteredSchedules.filter(s => s.status === 'Selesai').length;
  const inProgressStores = filteredSchedules.filter(s => s.status === 'Proses SO' || s.status === 'Menunggu Rekapan').length;
  const failedOrMovedStores = filteredSchedules.filter(s => s.status === 'Gagal SO' || s.status === 'Pindah Toko' || s.status === 'Dibatalkan').length;
  
  const effectiveTarget = Math.max(0, totalTargetStores - failedOrMovedStores);
  const achievementRate = effectiveTarget > 0 ? Math.round((completedStores / effectiveTarget) * 100) : 0;

  // Failed / Moved Stores List
  const failureMoveLogs = filteredSchedules.filter(
    s => s.status === 'Gagal SO' || s.status === 'Pindah Toko' || s.failureOrMoveType
  );

  // Export CSV
  const handleExportKorlapReport = () => {
    const exportData = filteredSchedules.map(s => {
      const nameUpper = (s.storeName || '').toUpperCase();
      let accurateRegion = s.region;
      if (nameUpper.includes('BADUNG') || nameUpper.includes('TUBAN') || nameUpper.includes('TN5R') || nameUpper.includes('TCUW') || nameUpper.includes('KUTA')) {
        accurateRegion = 'Kab. Badung';
      } else if (nameUpper.includes('DENPASAR') || nameUpper.includes('DPS')) {
        accurateRegion = 'Kota Denpasar';
      } else if (s.region && s.region.includes('Jabodetabek')) {
        accurateRegion = 'Kab. Badung';
      }

      return {
        'ID Schedule': s.id,
        'Korlap / Officer': s.officerInCharge || 'I GEDE PASEK SANTIKA (Officer / Korlap)',
        'Kode Toko': s.storeCode,
        'Nama Toko': s.storeName,
        'Wilayah': accurateRegion,
        'Tanggal SO': s.scheduledDate,
        'Jam': s.scheduledTime,
        'Status Execution': s.status,
        'Personil SO Ditugaskan': s.assignedPersonnelNames?.join('; ') || 'Belum Dialokasikan',
        'Jenis Kendala (Gagal/Pindah)': s.failureOrMoveType || '-',
        'Alasan / Penjelasan Korlap': s.failureOrMoveReason || s.notes || '-',
        'Toko Pengganti (Jika Pindah)': s.replacementStoreCode ? `${s.replacementStoreCode} - ${s.replacementStoreName}` : '-'
      };
    });

    exportToCSV('Laporan_Sinkronisasi_Korlap_SO.csv', exportData);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Banner & Korlap Selector */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-indigo-950 text-white p-3.5 sm:p-5 rounded-2xl shadow-lg border border-emerald-800/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-black text-[9px] sm:text-[10px] tracking-wider uppercase">
              PORTAL KORLAP / OFFICER
            </span>
            <span className="text-[11px] text-emerald-300 font-mono hidden sm:inline">
              Auto-Synced dengan SPV & Admin
            </span>
          </div>
          <h2 className="text-sm sm:text-base font-extrabold mt-1 text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
            <span>Dashboard Monitoring Korlap</span>
          </h2>
          <p className="text-[11px] sm:text-xs text-emerald-100/80 mt-0.5 line-clamp-1 sm:line-clamp-none">
            Kelola alokasi personil SO, konfirmasi SO selesai & log kejadian secara real-time.
          </p>
        </div>

        {/* Korlap Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="bg-white/10 backdrop-blur-md p-1.5 rounded-xl border border-white/20 flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 w-full">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-emerald-300 ml-1 shrink-0" />
              <select
                value={selectedOfficer}
                onChange={(e) => setSelectedOfficer(e.target.value)}
                className="bg-slate-900 border-0 text-white font-bold text-[11px] sm:text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 w-full"
              >
                <option value="ALL">Semua Korlap ({allOfficerNames.length})</option>
                {allOfficerNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <select
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="bg-slate-900 border-0 text-emerald-200 font-semibold text-[11px] sm:text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 w-full"
            >
              <option value="AUTO_RELEASE">🔓 Terbit Auto (Hari-H & H-1 21:00 WITA)</option>
              <option value="TODAY">📅 Khusus Hari Ini ({todayStr})</option>
              <option value="TOMORROW">🌙 Jadwal Besok ({tomorrowStr})</option>
              <option value="THIS_WEEK">🗓️ 7 Hari Ke Depan</option>
              <option value="ALL">📋 Semua Jadwal Sebulan</option>
            </select>
          </div>

          <button
            onClick={handleExportKorlapReport}
            className="px-3 py-1.5 sm:py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-[11px] sm:text-xs shadow-md transition flex items-center justify-center gap-1.5 shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Summary - Compact 2-column Grid on Mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
        
        <div className="bg-white p-2.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-[10px] sm:text-xs font-semibold">
            <span>Target SPV</span>
            <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 font-mono mt-0.5">
            {totalTargetStores} <span className="text-[10px] sm:text-xs font-sans text-slate-500 font-normal">Toko</span>
          </div>
          <p className="text-[9px] sm:text-[10px] text-slate-400 hidden sm:block">Jadwal resmi Supervisor</p>
        </div>

        <div className="bg-white p-2.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 text-[10px] sm:text-xs font-semibold">
            <span>SO Selesai</span>
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-emerald-700 font-mono mt-0.5">
            {completedStores} <span className="text-[10px] sm:text-xs font-sans text-slate-500 font-normal">Toko</span>
          </div>
          <p className="text-[9px] sm:text-[10px] text-emerald-600 font-medium hidden sm:block">Lengkap BA</p>
        </div>

        <div className="bg-white p-2.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 text-[10px] sm:text-xs font-semibold">
            <span>Proses Audit</span>
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-amber-700 font-mono mt-0.5">
            {inProgressStores} <span className="text-[10px] sm:text-xs font-sans text-slate-500 font-normal">Toko</span>
          </div>
          <p className="text-[9px] sm:text-[10px] text-amber-600 font-medium hidden sm:block">Berjalan / NKL</p>
        </div>

        <div className="bg-white p-2.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-rose-700 text-[10px] sm:text-xs font-semibold">
            <span>Gagal / Pindah</span>
            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-rose-700 font-mono mt-0.5">
            {failedOrMovedStores} <span className="text-[10px] sm:text-xs font-sans text-slate-500 font-normal">Toko</span>
          </div>
          <p className="text-[9px] sm:text-[10px] text-rose-600 font-medium hidden sm:block">Pindah / Batal</p>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-slate-900 text-white p-2.5 sm:p-4 rounded-xl border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-indigo-300 text-[10px] sm:text-xs font-semibold">
            <span>Capaian Target (%)</span>
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-emerald-400 font-mono mt-0.5">
            {achievementRate}%
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
            <div 
              className="bg-emerald-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, achievementRate)}%` }}
            />
          </div>
        </div>

      </div>

      {/* Main Korlap Schedule Execution Grid grouped by Korlap */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden space-y-4 p-5">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              Daftar Penjadwalan & Eksekusi Toko Korlap
            </h3>
            <p className="text-xs text-slate-500">
              Daftar terbagi per Korlap/Officer. Dihide secara default agar lebih rapi. Klik <strong className="text-emerald-700 font-extrabold">+ Buka</strong> untuk melihat toko.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={expandAllKorlaps}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Buka Semua</span>
            </button>
            <button
              onClick={collapseAllKorlaps}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition flex items-center gap-1"
            >
              <Minus className="w-3.5 h-3.5 text-slate-500" />
              <span>Tutup Semua</span>
            </button>
            <button
              onClick={onOpenInputResultModal}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition flex items-center gap-1.5"
            >
              <ClipboardList className="w-4 h-4" />
              <span>+ Input Hasil SO</span>
            </button>
          </div>
        </div>

        {/* Korlap Collapsible Groups */}
        <div className="space-y-3">
          {Object.keys(groupedByKorlap).length > 0 ? (
            (Object.entries(groupedByKorlap) as [string, SOSchedule[]][]).map(([korlapName, korlapSchedules]) => {
              const isExpanded = expandedKorlaps[korlapName] !== false;
              const completedInKorlap = korlapSchedules.filter(s => s.status === 'Selesai').length;

              return (
                <div key={korlapName} className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  
                  {/* Korlap Accordion Header */}
                  <div 
                    onClick={() => toggleKorlapExpand(korlapName)}
                    className={`p-3.5 flex items-center justify-between cursor-pointer transition select-none ${
                      isExpanded ? 'bg-slate-900 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition ${
                          isExpanded ? 'bg-emerald-500 text-slate-950' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {isExpanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-extrabold text-sm ${isExpanded ? 'text-white' : 'text-slate-900'}`}>
                            {korlapName}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            isExpanded ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          }`}>
                            {korlapSchedules.length} Toko SO
                          </span>
                        </div>
                        <p className={`text-[11px] ${isExpanded ? 'text-slate-400' : 'text-slate-500'}`}>
                          Selesai: {completedInKorlap} / {korlapSchedules.length} Toko
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                        isExpanded ? 'bg-slate-800 text-emerald-400' : 'bg-white text-slate-600 border border-slate-200'
                      }`}>
                        {isExpanded ? 'Tutup Detail (-)' : 'Buka Detail Toko (+)'}
                      </span>
                    </div>
                  </div>

                  {/* Korlap Stores Grid - Expandable */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-50/50 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {korlapSchedules.map((s) => {
                        const isCompleted = s.status === 'Selesai';
                        const isFailedOrMoved = s.status === 'Gagal SO' || s.status === 'Pindah Toko' || s.status === 'Dibatalkan';
                        const hasPersonnel = s.assignedPersonnelNames && s.assignedPersonnelNames.length > 0;

                        return (
                          <div 
                            key={s.id} 
                            className={`rounded-xl border p-4 space-y-3 transition flex flex-col justify-between ${
                              isCompleted 
                                ? 'bg-emerald-50/40 border-emerald-200' 
                                : isFailedOrMoved
                                ? 'bg-rose-50/40 border-rose-200'
                                : 'bg-white border-slate-200 hover:shadow-md'
                            }`}
                          >
                            <div className="space-y-2">
                              
                              {/* Header */}
                              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                      {s.storeCode}
                                    </span>
                                    <span className="text-[10px] font-semibold text-slate-500">{s.region}</span>
                                  </div>
                                  <h4 className="font-extrabold text-sm text-slate-900 mt-1">{s.storeName}</h4>
                                </div>

                                <span className={`px-2.5 py-0.5 text-[10px] rounded-full border font-bold ${getStatusBadgeClass(s.status)}`}>
                                  {s.status}
                                </span>
                              </div>

                              {/* Officer & Schedule Info */}
                              <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-400">Korlap In Charge:</span>
                                  <span className="font-bold text-slate-800 text-right">{s.officerInCharge || 'Unassigned'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-400">Tanggal & Jam:</span>
                                  <span className="font-mono font-bold text-slate-800">{formatDateIndo(s.scheduledDate)} ({s.scheduledTime} WIB)</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-400">Tim Audit:</span>
                                  <span className="font-semibold text-indigo-700">{s.teamName}</span>
                                </div>
                              </div>

                              {/* Assigned Personnel Badges */}
                              <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900">
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                                    List Personil Auditing ({s.assignedPersonnelNames?.length || 0}):
                                  </span>
                                  {!isFailedOrMoved && (
                                    <button
                                      onClick={() => onOpenAssignPersonnel(s)}
                                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                                    >
                                      {hasPersonnel ? 'Edit Personil' : '+ Alokasi'}
                                    </button>
                                  )}
                                </div>

                                {hasPersonnel ? (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {s.assignedPersonnelNames?.map((name, idx) => (
                                      <span 
                                        key={idx}
                                        className="px-2 py-0.5 bg-white border border-indigo-200 rounded text-[10px] text-indigo-800 font-medium"
                                      >
                                        {name}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-slate-400 italic">
                                    {isFailedOrMoved 
                                      ? 'Tidak memerlukan alokasi personil (Toko Gagal / Pindah).'
                                      : 'Belum ada personil yang dicentang. Klik "+ Alokasi" di atas.'}
                                  </p>
                                )}
                              </div>

                              {/* Trouble / Failure / Moved Explanations */}
                              {(s.failureOrMoveReason || s.notes) && (
                                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
                                  <span className="font-bold flex items-center gap-1 text-amber-800">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                    Penjelasan / Catatan Korlap:
                                  </span>
                                  <p className="italic text-amber-950 font-medium">
                                    "{s.failureOrMoveReason || s.notes}"
                                  </p>
                                  {s.replacementStoreCode && (
                                    <div className="mt-1 font-bold text-indigo-700 text-[10px]">
                                      👉 Toko Pengganti: {s.replacementStoreCode} - {s.replacementStoreName}
                                    </div>
                                  )}
                                </div>
                              )}

                            </div>

                            {/* Action Buttons for Korlap (Omit for Gagal SO / Pindah Toko) */}
                            {!isFailedOrMoved && (
                              <div className="pt-2 border-t border-slate-100 space-y-2">
                                
                                {!isCompleted && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      onClick={() => {
                                        setConfirmingSchedule(s);
                                        setConfirmInputText('');
                                      }}
                                      className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                                      title="Konfirmasi SO Selesai"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>SO Selesai</span>
                                    </button>

                                    <button
                                      onClick={() => onOpenGagalPindahModal(s)}
                                      className="py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center justify-center gap-1 cursor-pointer"
                                      title="Input Pindah Toko / Gagal SO"
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                      <span>Pindah / Gagal</span>
                                    </button>
                                  </div>
                                )}

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => onOpenInputResultModal(s)}
                                    className="w-1/2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                                    title="Input Rekapan Hasil SO & Share Format Teks WA Group"
                                  >
                                    <ClipboardList className="w-3.5 h-3.5" />
                                    <span>Hasil Rekapan SO</span>
                                  </button>

                                  <button
                                    onClick={() => onOpenAssignPersonnel(s)}
                                    className="w-1/2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Alokasikan Personil</span>
                                  </button>
                                </div>

                              </div>
                            )}

                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Belum ada jadwal toko terdaftar untuk pilihan Korlap / Filter ini.
            </div>
          )}
        </div>

      </div>

      {/* Log Table of Toko Gagal & Pindah Toko */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Log & Rekapan Toko Gagal / Pindah Toko (Sync Supervisor & Admin)
            </h3>
            <p className="text-xs text-slate-500">
              Setiap kendala yang diinput Korlap otomatis terhubung dengan dashboard umum dan Supervisor.
            </p>
          </div>
          <span className="px-3 py-1 bg-rose-50 text-rose-700 font-mono font-bold text-xs rounded-full border border-rose-200">
            {failureMoveLogs.length} Catatan Kendala
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Toko Asal</th>
                <th className="py-2.5 px-3">Tgl SO</th>
                <th className="py-2.5 px-3">Korlap In Charge</th>
                <th className="py-2.5 px-3">Status Kendala</th>
                <th className="py-2.5 px-3">Penjelasan / Alasan Korlap</th>
                <th className="py-2.5 px-3">Toko Pengganti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {failureMoveLogs.length > 0 ? (
                failureMoveLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      [{log.storeCode}] {log.storeName}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {log.scheduledDate}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {log.officerInCharge || '-'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getStatusBadgeClass(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 italic max-w-xs">
                      {log.failureOrMoveReason || log.notes || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-indigo-700 font-mono">
                      {log.replacementStoreCode ? `${log.replacementStoreCode} - ${log.replacementStoreName}` : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Belum ada kejadian Toko Gagal atau Pindah Toko.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog Modal for SO Selesai */}
      {confirmingSchedule && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            
            <div className="flex items-center gap-3 text-emerald-600 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Konfirmasi SO Selesai — Validasi Korlap</h3>
                <p className="text-xs text-slate-500">Verifikasi fisik pelaksanaan Stock Opname</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Toko:</span>
                <strong className="text-slate-900 font-bold">{confirmingSchedule.storeCode} - {confirmingSchedule.storeName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Tanggal SO:</span>
                <strong className="text-slate-800 font-mono">{formatDateIndo(confirmingSchedule.scheduledDate)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Korlap In Charge:</span>
                <strong className="text-emerald-700 font-bold">{confirmingSchedule.officerInCharge || 'Korlap'}</strong>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-700 font-medium leading-relaxed">
                Apakah benar Stock Opname pada toko <strong className="text-slate-900">{confirmingSchedule.storeName}</strong> telah selesai dilaksanakan secara lengkap & akurat?
              </p>
              
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <label className="block text-[11px] text-amber-900 font-bold">
                  Ketik kata <span className="underline decoration-2 text-rose-600 font-black px-1.5 py-0.5 bg-amber-100 rounded">"ya"</span> di bawah ini untuk konfirmasi validasi:
                </label>
                <input
                  type="text"
                  autoFocus
                  value={confirmInputText}
                  onChange={(e) => setConfirmInputText(e.target.value)}
                  placeholder="Ketik 'ya' di sini..."
                  className="w-full bg-white border border-amber-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && confirmInputText.trim().toLowerCase() === 'ya') {
                      onConfirmScheduleFinished(confirmingSchedule.id);
                      setConfirmingSchedule(null);
                      setConfirmInputText('');
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setConfirmingSchedule(null);
                  setConfirmInputText('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={confirmInputText.trim().toLowerCase() !== 'ya'}
                onClick={() => {
                  if (confirmInputText.trim().toLowerCase() === 'ya') {
                    onConfirmScheduleFinished(confirmingSchedule.id);
                    setConfirmingSchedule(null);
                    setConfirmInputText('');
                  }
                }}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold shadow-sm transition flex items-center gap-1.5 ${
                  confirmInputText.trim().toLowerCase() === 'ya'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Konfirmasi SO Selesai</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

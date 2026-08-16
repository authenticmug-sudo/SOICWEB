import React, { useState, useMemo } from 'react';
import { 
  HeartPulse, 
  CalendarOff, 
  UserCheck, 
  Users, 
  Download, 
  Search, 
  Calendar, 
  CloudCheck, 
  Cloud,
  Edit3, 
  CheckCircle2, 
  AlertCircle,
  X,
  Save,
  Filter,
  FileSpreadsheet,
  ShieldCheck,
  ExternalLink,
  Settings
} from 'lucide-react';
import { AuditorPersonnel, PersonnelStatus } from '../../types/stockOpname';
import { exportToCSV, savePersonnelToFirestore } from '../../services/storageService';
import { getCloudinaryConfig } from '../../services/cloudinaryService';
import { CloudinaryModal } from '../Settings/CloudinaryModal';

interface LeaveRecapManagerProps {
  personnel: AuditorPersonnel[];
  onUpdatePersonnel?: (updatedList: AuditorPersonnel[]) => void;
}

export function getLeaveCategory(p: AuditorPersonnel): 'Sakit' | 'Cuti' {
  // 1. Explicitly saved lastLeaveType has highest priority
  if (p.lastLeaveType === 'Sakit' || p.lastLeaveType === 'Cuti') {
    return p.lastLeaveType;
  }
  // 2. Active status if currently Sakit or Cuti
  if (p.status === 'Sakit') return 'Sakit';
  if (p.status === 'Cuti') return 'Cuti';

  // 3. Smart deduction from statusNotes
  const note = (p.statusNotes || '').toLowerCase();
  if (
    note.includes('cuti') ||
    note.includes('melahirkan') ||
    note.includes('libur') ||
    note.includes('ijin') ||
    note.includes('izin') ||
    note.includes('nikah') ||
    note.includes('keluarga') ||
    note.includes('mudik') ||
    note.includes('pulang') ||
    note.includes('tahunan') ||
    note.includes('acara')
  ) {
    return 'Cuti';
  }
  if (
    note.includes('sakit') ||
    note.includes('dokter') ||
    note.includes('demam') ||
    note.includes('rawat') ||
    note.includes('rs') ||
    note.includes('pusing') ||
    note.includes('opname') ||
    note.includes('isoman')
  ) {
    return 'Sakit';
  }

  // 4. Default fallback
  return 'Cuti';
}

export const LeaveRecapManager: React.FC<LeaveRecapManagerProps> = ({
  personnel,
  onUpdatePersonnel
}) => {
  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [startDate, setStartDate] = useState<string>('2026-08-01');
  const [endDate, setEndDate] = useState<string>('2026-08-31');
  const [statusFilter, setStatusFilter] = useState<string>('Sakit_Cuti'); // 'Sakit_Cuti', 'Sakit', 'Cuti', 'Aktif', 'ALL'
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSyncSuccessToast, setShowSyncSuccessToast] = useState<boolean>(false);
  const [lastExportedFile, setLastExportedFile] = useState<string>('');
  const [cloudinaryResult, setCloudinaryResult] = useState<{
    url?: string;
    error?: string;
    isUploading?: boolean;
  }>({});

  // Modals
  const [isCloudinaryModalOpen, setIsCloudinaryModalOpen] = useState<boolean>(false);
  const [editingPerson, setEditingPerson] = useState<AuditorPersonnel | null>(null);
  const [editStatus, setEditStatus] = useState<PersonnelStatus>('Sakit');
  const [editLeaveType, setEditLeaveType] = useState<'Sakit' | 'Cuti'>('Sakit');
  const [editStartDate, setEditStartDate] = useState<string>('');
  const [editEndDate, setEditEndDate] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Cloudinary Config state check
  const cloudinaryConfig = getCloudinaryConfig();

  // Auto-set start & end dates when month dropdown changes
  const handleMonthChange = (monthVal: string) => {
    setSelectedMonth(monthVal);
    if (monthVal === 'ALL') {
      setStartDate('2026-01-01');
      setEndDate('2026-12-31');
    } else {
      setStartDate(`${monthVal}-01`);
      // Get last day of month
      const [y, m] = monthVal.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      setEndDate(`${monthVal}-${lastDay < 10 ? '0' + lastDay : lastDay}`);
    }
  };

  // Personnel Summary Calculations
  const totalPersonnel = personnel.length;
  const sakitPersonnel = useMemo(() => personnel.filter(p => (p.status === 'Sakit' || p.status === 'Cuti' || !!p.lastLeaveType || !!p.statusStartDate || !!p.statusNotes) && getLeaveCategory(p) === 'Sakit'), [personnel]);
  const cutiPersonnel = useMemo(() => personnel.filter(p => (p.status === 'Sakit' || p.status === 'Cuti' || !!p.lastLeaveType || !!p.statusStartDate || !!p.statusNotes) && getLeaveCategory(p) === 'Cuti'), [personnel]);
  const aktifPersonnel = useMemo(() => personnel.filter(p => p.status === 'Aktif'), [personnel]);

  // Filtered List - Retains records even if personnel status is now 'Aktif'
  const filteredPersonnel = useMemo(() => {
    return personnel.filter(p => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchName = p.name.toLowerCase().includes(q);
        const matchNik = p.nik.toLowerCase().includes(q);
        const matchKorlap = (p.korlapName || '').toLowerCase().includes(q);
        const matchTeam = (p.teamName || '').toLowerCase().includes(q);
        const matchNotes = (p.statusNotes || '').toLowerCase().includes(q);
        if (!matchName && !matchNik && !matchKorlap && !matchTeam && !matchNotes) return false;
      }

      // Has Sakit/Cuti Record
      const hasLeaveRecord = p.status === 'Sakit' || p.status === 'Cuti' || !!p.lastLeaveType || !!p.statusStartDate || !!p.statusNotes;

      // Status Filter
      if (statusFilter === 'Sakit_Cuti') {
        if (!hasLeaveRecord) return false;
      } else if (statusFilter === 'Sakit') {
        if (!hasLeaveRecord || getLeaveCategory(p) !== 'Sakit') return false;
      } else if (statusFilter === 'Cuti') {
        if (!hasLeaveRecord || getLeaveCategory(p) !== 'Cuti') return false;
      } else if (statusFilter === 'Aktif') {
        if (p.status !== 'Aktif') return false;
      }

      // Date Filter (If personnel has statusStartDate / statusEndDate)
      if (startDate && endDate && (p.statusStartDate || p.statusEndDate)) {
        const pStart = p.statusStartDate || '2000-01-01';
        const pEnd = p.statusEndDate || '2099-12-31';
        if (pStart > endDate || pEnd < startDate) {
          return false;
        }
      }

      return true;
    });
  }, [personnel, searchQuery, statusFilter, startDate, endDate]);

  // Handle Export CSV with Automatic Cloudinary Sync
  const handleExportCSV = async () => {
    setIsExporting(true);
    setCloudinaryResult({ isUploading: true });
    const filename = `Rekapan_Sakit_Cuti_SDM_Periode_${startDate}_sd_${endDate}.csv`;
    
    const rows = filteredPersonnel.map(p => {
      const leaveType = getLeaveCategory(p);
      const periodStr = (p.statusStartDate && p.statusEndDate)
        ? `${p.statusStartDate} s/d ${p.statusEndDate}`
        : (p.statusStartDate ? `Mulai ${p.statusStartDate}` : `${startDate} s/d ${endDate}`);

      return {
        'NIK': p.nik,
        'Nama Personil': p.name,
        'Role / Jabatan': p.role,
        'Korlap In Charge': p.korlapName || p.name,
        'Tim SO': p.teamName || 'Tim SO',
        'Status Operational Saat Ini': p.status,
        'Kategori Rekap Izin': leaveType,
        'Tanggal Mulai (Dari Kapan)': p.statusStartDate || '-',
        'Tanggal Selesai (Sampai Kapan)': p.statusEndDate || '-',
        'Periode Izin Presensi': periodStr,
        'Catatan / Keterangan Sakit & Cuti': p.statusNotes || (leaveType === 'Sakit' ? 'Izin Sakit' : 'Izin Cuti Tahunan'),
        'No Telepon / WA': p.phone || '-',
        'Tanggal Penarikan File': new Date().toLocaleString('id-ID')
      };
    });

    setLastExportedFile(filename);

    try {
      const res = await exportToCSV(filename, rows);
      if (res?.cloudinaryUrl) {
        setCloudinaryResult({ url: res.cloudinaryUrl, isUploading: false });
      } else if (res?.error) {
        setCloudinaryResult({ error: res.error, isUploading: false });
      } else {
        setCloudinaryResult({ isUploading: false });
      }
    } catch (err: any) {
      setCloudinaryResult({ error: err?.message || 'Error sync Cloudinary', isUploading: false });
    } finally {
      setIsExporting(false);
      setShowSyncSuccessToast(true);
    }
  };

  // Edit Personnel Status
  const handleOpenEdit = (p: AuditorPersonnel) => {
    setEditingPerson(p);
    setEditStatus(p.status);
    setEditLeaveType(getLeaveCategory(p));
    const today = new Date().toISOString().split('T')[0];
    setEditStartDate(p.statusStartDate || today);
    setEditEndDate(p.statusEndDate || today);
    setEditNotes(p.statusNotes || '');
  };

  const handleSaveEdit = async () => {
    if (!editingPerson) return;
    setIsSaving(true);
    try {
      const updatedPerson: AuditorPersonnel = {
        ...editingPerson,
        status: editStatus,
        lastLeaveType: editLeaveType,
        statusStartDate: editStartDate,
        statusEndDate: editEndDate,
        statusNotes: editNotes.trim()
      };

      await savePersonnelToFirestore(updatedPerson);

      if (onUpdatePersonnel) {
        const newList = personnel.map(p => p.id === updatedPerson.id ? updatedPerson : p);
        onUpdatePersonnel(newList);
      }

      setEditingPerson(null);
    } catch (err) {
      console.error('Failed to update personnel status:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {showSyncSuccessToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-emerald-500/50 flex items-start gap-3 animate-slide-up">
          {cloudinaryResult.url ? (
            <CloudCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1 text-xs">
            <span className="font-extrabold text-emerald-300 block text-sm">
              File CSV Berhasil Diunduh!
            </span>
            <p className="text-slate-300 leading-relaxed">
              File <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300 font-mono">{lastExportedFile}</code> telah tersimpan lokal di perangkat Anda.
            </p>

            {cloudinaryResult.url ? (
              <div className="pt-1 text-emerald-300 space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Ter-Backup ke Cloudinary
                </span>
                <a
                  href={cloudinaryResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-amber-300 px-2 py-1 rounded border border-slate-700 underline font-mono break-all"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Buka Link Backup Cloudinary</span>
                </a>
              </div>
            ) : cloudinaryResult.error ? (
              <div className="pt-1.5 space-y-1.5">
                <div className="p-2 bg-amber-950/80 border border-amber-500/40 rounded-lg text-amber-200 text-[11px] leading-snug">
                  <strong className="block text-amber-300">Catatan Sync Cloudinary:</strong>
                  {cloudinaryResult.error}
                </div>
                <button
                  onClick={() => {
                    setShowSyncSuccessToast(false);
                    setIsCloudinaryModalOpen(true);
                  }}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] rounded-md flex items-center gap-1 transition"
                >
                  <Settings className="w-3 h-3" />
                  <span>Atur Cloud Name Cloudinary Sekarang</span>
                </button>
              </div>
            ) : null}
          </div>
          <button onClick={() => setShowSyncSuccessToast(false)} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg">
              <HeartPulse className="w-5 h-5 animate-pulse" />
            </span>
            <h1 className="text-xl font-black tracking-tight text-white">
              Rekapan Sakit & Cuti SDM
            </h1>
            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold rounded-full uppercase">
              Portal Admin
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Pusat pemantauan & penarikan data personil yang berhalangan hadir (Sakit & Cuti). Seluruh ekspor file CSV secara otomatis tersinkronisasi ke Cloudinary di folder <span className="text-amber-300 font-bold">SO Sistem IC BALI / csv_backups</span>.
          </p>
        </div>

        {/* Sync Info Pill & Cloudinary Status */}
        <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-xl flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-6 h-6 text-indigo-400 shrink-0" />
            <div className="text-[11px]">
              <span className="text-slate-400 block font-semibold">Status Storage Cloudinary:</span>
              {cloudinaryConfig.cloudName ? (
                <span className="font-mono font-extrabold text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active: {cloudinaryConfig.cloudName}
                </span>
              ) : (
                <span className="font-mono font-extrabold text-amber-400">
                  ⚠️ Belum Diatur (Offline)
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setIsCloudinaryModalOpen(true)}
            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-lg transition flex items-center gap-1 shrink-0"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Atur Cloudinary</span>
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-500 block tracking-wider">
            Total SDM Personil
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-black text-slate-900 font-mono">{totalPersonnel}</span>
            <Users className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-xl shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-amber-800 block tracking-wider">
            Personil Sakit (🏥)
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-black text-amber-900 font-mono">{sakitPersonnel.length}</span>
            <HeartPulse className="w-5 h-5 text-amber-600 animate-bounce" />
          </div>
        </div>

        <div className="bg-sky-50/60 border border-sky-200 p-4 rounded-xl shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-sky-800 block tracking-wider">
            Personil Cuti (🏖️)
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-black text-sky-900 font-mono">{cutiPersonnel.length}</span>
            <CalendarOff className="w-5 h-5 text-sky-600" />
          </div>
        </div>

        <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-xl shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-emerald-800 block tracking-wider">
            Personil Aktif (🟢)
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-black text-emerald-900 font-mono">{aktifPersonnel.length}</span>
            <UserCheck className="w-5 h-5 text-emerald-600" />
          </div>
        </div>
      </div>

      {/* FILTER & PERIODE PENARIKAN FILE CARD */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <h2 className="font-extrabold text-sm text-slate-900 uppercase tracking-wide">
              Periode Penarikan File & Filter SDM
            </h2>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-98"
          >
            <Download className="w-4 h-4" />
            <span>Penarikan File CSV (Sync Cloudinary)</span>
          </button>
        </div>

        {/* Filters Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Quick Month Selector */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700">Pilih Bulan Periode</label>
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500"
            >
              <option value="2026-08">Bulan Ini (Agustus 2026)</option>
              <option value="2026-07">Juli 2026</option>
              <option value="2026-06">Juni 2026</option>
              <option value="2026-05">Mei 2026</option>
              <option value="2026-04">April 2026</option>
              <option value="ALL">Semua Bulan / Tahun 2026</option>
            </select>
          </div>

          {/* Start Date */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700">Tanggal Mulai</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* End Date */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700">Tanggal Selesai</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700">Filter Status Presensi</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500"
            >
              <option value="Sakit_Cuti">Semua Riwayat Sakit & Cuti (Sakit, Cuti & Aktif Terdata)</option>
              <option value="Sakit">Hanya Status / Riwayat Sakit (🏥)</option>
              <option value="Cuti">Hanya Status / Riwayat Cuti (🏖️)</option>
              <option value="Aktif">Hanya Status Aktif Saat Ini (🟢)</option>
              <option value="ALL">Semua SDM Personil (Tanpa Filter)</option>
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="pt-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari berdasarkan nama, NIK, nama Korlap, tim SO, atau catatan izin..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* DATA TABLE REKAPAN SAKIT & CUTI */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">
              Daftar Rekapan Sakit & Cuti Personil ({filteredPersonnel.length} Data Ditampilkan)
            </span>
          </div>

          <span className="text-[11px] text-slate-500 font-medium">
            Periode Penarikan: <strong className="text-slate-900">{startDate}</strong> s/d <strong className="text-slate-900">{endDate}</strong>
          </span>
        </div>

        {filteredPersonnel.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="font-bold text-sm text-slate-800">Tidak ada data rekapan sakit / cuti</h3>
            <p className="text-xs text-slate-500">
              Tidak ditemukan data personil dengan kriteria filter terpilih untuk periode ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Nama Personil & NIK</th>
                  <th className="py-3 px-4">Role / Jabatan</th>
                  <th className="py-3 px-4">Korlap / Tim SO</th>
                  <th className="py-3 px-4 text-center">Status Operational Saat Ini</th>
                  <th className="py-3 px-4 text-center">Kategori Rekap Izin</th>
                  <th className="py-3 px-4">Periode Izin (Dari s/d Sampai Kapan)</th>
                  <th className="py-3 px-4">Catatan / Alasan Sakit & Cuti</th>
                  <th className="py-3 px-4 text-center">Aksi / Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPersonnel.map((p) => {
                  let badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                  let icon = '🟢';
                  if (p.status === 'Sakit') {
                    badgeStyle = 'bg-amber-50 text-amber-800 border-amber-300 font-black animate-pulse';
                    icon = '🏥';
                  } else if (p.status === 'Cuti') {
                    badgeStyle = 'bg-sky-50 text-sky-800 border-sky-300 font-extrabold';
                    icon = '🏖️';
                  } else if (p.status === 'Non-Aktif') {
                    badgeStyle = 'bg-rose-50 text-rose-800 border-rose-300';
                    icon = '🔴';
                  }

                  const leaveCategory = getLeaveCategory(p);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden border border-slate-300">
                            {p.photoUrl ? (
                              <img src={p.photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              p.name.charAt(0)
                            )}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-900 block">{p.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">NIK: {p.nik}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-700">{p.role}</td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800 block">{p.korlapName || p.name}</span>
                        <span className="text-[10px] text-slate-500">{p.teamName || 'Tim SO'}</span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] border inline-flex items-center gap-1 ${badgeStyle}`}>
                          <span>{icon}</span>
                          <span>{p.status}</span>
                        </span>
                        {p.status === 'Aktif' && (p.statusStartDate || p.statusEndDate) && (
                          <span className="text-[9px] text-emerald-700 font-bold block mt-0.5">
                            (Sudah Tugas Kembali)
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {leaveCategory === 'Sakit' ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 inline-flex items-center gap-1">
                            🏥 Sakit
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-200 inline-flex items-center gap-1">
                            🏖️ Cuti
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] font-extrabold text-slate-800">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>
                            {p.statusStartDate || '?'} <span className="text-slate-400 font-normal">s/d</span> {p.statusEndDate || '?'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-700 font-medium italic">
                        {p.statusNotes ? (
                          <span className="text-slate-900 not-italic font-semibold">{p.statusNotes}</span>
                        ) : leaveCategory === 'Sakit' ? (
                          <span className="text-amber-700">Izin Sakit</span>
                        ) : (
                          <span className="text-sky-700">Izin Cuti Tahunan</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg font-bold text-[11px] inline-flex items-center gap-1.5 transition"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                          <span>Edit Presensi</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT PRESENCE STATUS MODAL */}
      {editingPerson && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Update Presensi & Tanggal: {editingPerson.name}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono">NIK: {editingPerson.nik}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingPerson(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Status Presensi Saat Ini
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as PersonnelStatus)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Aktif">🟢 Aktif (Sudah Beraktivitas Normal)</option>
                  <option value="Sakit">🏥 Sakit (Sedang Berhalangan Sakit)</option>
                  <option value="Cuti">🏖️ Cuti (Sedang Izin Cuti Tahunan)</option>
                  <option value="Non-Aktif">🔴 Non-Aktif</option>
                </select>
                <p className="text-[10px] text-indigo-600 mt-1 italic font-medium">
                  💡 Personil berstatus Aktif tetap menyimpan rekapan tanggal Sakit & Cuti untuk kebutuhan tracking admin.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Kategori Izin Presensi
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditLeaveType('Sakit')}
                    className={`py-2 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                      editLeaveType === 'Sakit'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>🏥 Sakit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditLeaveType('Cuti')}
                    className={`py-2 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                      editLeaveType === 'Cuti'
                        ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>🏖️ Cuti</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tanggal Mulai (Dari)
                  </label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tanggal Selesai (Sampai)
                  </label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Catatan / Keterangan Periode Sakit/Cuti
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Contoh: Sakit Demam Tipes (Surat Dokter s/d 12 Ags 2026)..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:bg-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingPerson(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Presensi'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLOUDINARY SETTINGS MODAL */}
      <CloudinaryModal
        isOpen={isCloudinaryModalOpen}
        onClose={() => setIsCloudinaryModalOpen(false)}
      />
    </div>
  );
};

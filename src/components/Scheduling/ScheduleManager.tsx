import React, { useState } from 'react';
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
  ArrowRight
} from 'lucide-react';
import { SOSchedule, Store, SOTeam, RegionArea, UserRole, AuditorPersonnel } from '../../types/stockOpname';
import { REGIONS } from '../../data/initialData';
import { getStatusBadgeClass, formatDateIndo } from '../../utils/formatters';
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
  onRejectSchedule
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [superAdminRoleMode, setSuperAdminRoleMode] = useState<'SUPERVISOR' | 'OFFICER'>('SUPERVISOR');
  const [viewMode, setViewMode] = useState<'list' | 'officer' | 'calendar' | 'approval'>(
    currentRole === 'OFFICER' ? 'officer' : 'list'
  );
  const [approvalTab, setApprovalTab] = useState<'SELESAI' | 'PINDAH' | 'GAGAL'>('SELESAI');
  const [scheduleToDelete, setScheduleToDelete] = useState<SOSchedule | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Compute available regions strictly from store master data
  const availableRegions = React.useMemo(() => {
    const set = new Set<string>();
    stores.forEach(s => {
      if (s.region) set.add(s.region);
      else if (s.kabupaten) set.add(s.kabupaten);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [stores]);

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
  const filteredSchedules = schedules.filter(s => {
    const matchesSearch = 
      s.storeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.spvInCharge.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRegion = selectedRegion === 'ALL' || s.region === selectedRegion;
    const matchesStatus = selectedStatus === 'ALL' || s.status === selectedStatus;

    return matchesSearch && matchesRegion && matchesStatus;
  });

  const getAccurateRegionForSchedule = (s: SOSchedule): string => {
    const matchingStore = stores.find(st => st.code === s.storeCode || st.id === s.storeId);
    if (matchingStore) {
      const text = `${matchingStore.name || ''} ${matchingStore.code || ''} ${matchingStore.kabupaten || ''} ${matchingStore.city || ''}`.toUpperCase();
      if (text.includes('BADUNG') || text.includes('TUBAN') || text.includes('KUTA') || text.includes('JIMBARAN')) return 'Kab. Badung';
      if (text.includes('DENPASAR') || text.includes('RENON') || text.includes('SANUR')) return 'Kota Denpasar';
      if (text.includes('GIANYAR') || text.includes('UBUD')) return 'Kab. Gianyar';
      if (text.includes('TABANAN')) return 'Kab. Tabanan';
      if (text.includes('BULELENG')) return 'Kab. Buleleng';
      if (text.includes('KARANGASEM')) return 'Kab. Karangasem';
      if (text.includes('JEMBRANA')) return 'Kab. Jembrana';
      if (text.includes('KLUNGKUNG')) return 'Kab. Klungkung';
      if (text.includes('BANGLI')) return 'Kab. Bangli';
      if (text.includes('MATARAM')) return 'Kota Mataram & Lombok';
      if (matchingStore.region && !matchingStore.region.includes('Jabodetabek')) return matchingStore.region;
    }
    const nameUpper = (s.storeName || '').toUpperCase();
    if (nameUpper.includes('BADUNG') || nameUpper.includes('TUBAN') || nameUpper.includes('TN5R') || nameUpper.includes('TCUW') || nameUpper.includes('KUTA')) return 'Kab. Badung';
    if (nameUpper.includes('DENPASAR') || nameUpper.includes('DPS')) return 'Kota Denpasar';
    if (nameUpper.includes('GIANYAR') || nameUpper.includes('UBUD')) return 'Kab. Gianyar';
    if (nameUpper.includes('TABANAN')) return 'Kab. Tabanan';

    return s.region && !s.region.includes('Jabodetabek') ? s.region : 'Kab. Badung';
  };

  const handleExportSchedules = () => {
    const data = filteredSchedules.map(s => ({
      'ID Schedule': s.id,
      'Kode Toko': s.storeCode,
      'Nama Toko': s.storeName,
      'Wilayah': getAccurateRegionForSchedule(s),
      'Tanggal SC': s.scheduledDate,
      'Jam': s.scheduledTime,
      'Tim SO': s.teamName,
      'SPV In Charge': s.spvInCharge,
      'Korlap / Officer': s.officerInCharge || 'I GEDE PASEK SANTIKA',
      'Status': s.status,
      'Personil Alokasi Korlap': s.assignedPersonnelNames && s.assignedPersonnelNames.length > 0 ? s.assignedPersonnelNames.join('; ') : 'Belum Dialokasikan',
      'Catatan': s.notes || ''
    }));
    exportToCSV('Penjadwalan_SO.csv', data);
  };

  return (
    <div className="space-y-4">
      
      {/* Header Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-600" />
                Penjadwalan Stock Opname (SO)
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
                ? 'Portal Eksekusi & Monitoring Lapangan Hari-H untuk Korlap & Auditor SO'
                : 'Jadwal audit fisik toko terbitan Supervisor untuk tim Korlap dan Auditor Master Data Bali'}
            </p>
          </div>

          {/* Action Buttons (2-column on mobile, inline on desktop) */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
            {activeRoleContext !== 'OFFICER' && viewMode !== 'officer' && (
              <>
                {onOpenKorlapImageModal && (
                  <button
                    onClick={onOpenKorlapImageModal}
                    className="w-full sm:w-auto px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition flex items-center justify-center gap-1.5"
                    title="Buat rute toko & gambar jadwal Excel Korlap"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-200 shrink-0" />
                    <span className="truncate">Input Korlap & Image</span>
                  </button>
                )}

                <button
                  onClick={onOpenAutoGenerator}
                  className="w-full sm:w-auto px-3 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-98 text-white rounded-xl text-xs font-black shadow-xs hover:shadow transition flex items-center justify-center gap-1.5"
                  title="Generate otomatis jadwal dari 737 toko"
                >
                  <Wand2 className="w-4 h-4 text-purple-200 shrink-0" />
                  <span className="truncate">Auto-Schedule (700+)</span>
                </button>

                <button
                  onClick={onOpenCreateModal}
                  className="w-full sm:w-auto px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-black shadow-xs hover:shadow transition flex items-center justify-center gap-1.5"
                  title="Tambah 1 jadwal audit toko manual"
                >
                  <Plus className="w-4 h-4 text-indigo-200 shrink-0" />
                  <span className="truncate">+ Tambah Manual</span>
                </button>
              </>
            )}

            <button
              onClick={handleExportSchedules}
              className="w-full sm:w-auto px-3 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold border border-slate-300 transition flex items-center justify-center gap-1.5 shadow-2xs"
              title="Download rekap data jadwal ke file CSV"
            >
              <Download className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="truncate">Export CSV</span>
            </button>
          </div>
        </div>

        {/* Super Account Dedicated Mode Switcher Toggle Bar */}
        {currentRole === 'ALL' && (
          <div className="p-2.5 bg-gradient-to-r from-purple-900/10 via-indigo-900/10 to-slate-900/10 rounded-2xl border border-purple-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1">
                ⚡ Mode Switcher Super Account:
              </span>
              <span className="text-[11px] text-purple-800 hidden lg:inline">
                Pilih tampilan yang ingin Anda operasikan di bawah ini
              </span>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 bg-white p-1 rounded-xl border border-purple-200 shadow-2xs">
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
                <span>📱 Portal Korlap / Officer</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter Toolbar & Sub-Menu Navigation */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-500" />
            <input
              type="text"
              placeholder="Cari toko, kode, tim, atau officer..."
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

          {/* Region & Status Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
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
            </select>
          </div>

        </div>

        {/* Sub-Menu Tabs Pill Box */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
          
          <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 w-full sm:w-auto overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3.5 py-1.5 text-xs sm:text-sm rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                viewMode === 'list' 
                  ? 'bg-slate-900 text-white shadow-xs font-black' 
                  : 'text-slate-600 hover:text-slate-900 font-bold hover:bg-white/60'
              }`}
            >
              <span>📋 List Semua</span>
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
              <span>Jadwal Officer Hari-H</span>
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

          <div className="text-xs text-slate-500 font-medium hidden lg:block">
            Tampil <strong className="text-slate-900">{filteredSchedules.length}</strong> dari {schedules.length} Toko Terjadwal
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
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Toko & Kode</th>
                  <th className="py-3 px-4">Wilayah</th>
                  <th className="py-3 px-4">Tanggal & Jam</th>
                  <th className="py-3 px-4">Tim SO & SPV</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi SPV</th>
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
                        <div className="text-[10px] text-slate-500 font-mono">{s.scheduledTime} WIB</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 flex items-center gap-1">
                          <Users className="w-3 h-3 text-indigo-500" /> {s.teamName}
                        </div>
                        <div className="text-[10px] text-slate-500">SPV: {s.spvInCharge}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 text-[10px] rounded-full border font-semibold ${getStatusBadgeClass(s.status)}`}>
                          {s.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* Quick Status Changers */}
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
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Tidak ditemukan jadwal SO yang sesuai filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === 'approval' ? (
        /* Approval SPV Interactive Dashboard */
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
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
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
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
                  <div key={st} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
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
        title="Hapus Jadwal Stock Opname"
        subtitle="Apakah Anda yakin ingin menghapus jadwal ini?"
        itemName={scheduleToDelete ? `${scheduleToDelete.storeCode} - ${scheduleToDelete.storeName}` : undefined}
        itemDetails={scheduleToDelete ? [
          { label: 'Tanggal SO', value: formatDateIndo(scheduleToDelete.scheduledDate) },
          { label: 'Jam', value: scheduleToDelete.scheduledTime || '21:00 WITA' },
          { label: 'Penanggung Jawab', value: scheduleToDelete.officerInCharge || scheduleToDelete.spvInCharge || '-' },
          { label: 'Status', value: scheduleToDelete.status }
        ] : []}
        confirmText="Ya, Hapus Jadwal"
        dangerBadgeText="Jadwal SO ini akan dihapus permanen dari kalender & portal sync."
      />

      {/* Success Toast Feedback */}
      {toastMessage && (
        <ToastNotification
          type="success"
          title="Berhasil Dihapus"
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}

    </div>
  );
};


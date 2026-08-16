import React, { useState } from 'react';
import { 
  Users, 
  Phone, 
  MapPin, 
  Plus, 
  Search, 
  FileSpreadsheet, 
  Upload,
  Edit2, 
  Trash2, 
  X, 
  Cloud, 
  UserCheck, 
  Calendar, 
  Download, 
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Building,
  Image as ImageIcon,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Eye,
  EyeOff,
  RotateCcw,
  Lock,
  Key,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { exportToCSV, exportToExcelWithBackup, syncCollectionFromCloudinary, STORAGE_KEYS } from '../../services/storageService';
import { SOTeam, AuditorPersonnel, AuditorPersonnelRole, UserRole } from '../../types/stockOpname';
import { ConfirmDeleteModal } from '../Common/ConfirmDeleteModal';
import { ToastNotification } from '../Common/ToastNotification';
import { calculateLamaBekerja, formatDateIndo, formatDateISO } from '../../utils/formatters';
import { ImportPersonnelModal } from './ImportPersonnelModal';
import { CloudinaryModal } from '../Settings/CloudinaryModal';
import { LamaBekerjaBadge } from './LamaBekerjaBadge';

interface TeamManagerProps {
  teams: SOTeam[];
  personnel: AuditorPersonnel[];
  onAddPersonnel: (p: Omit<AuditorPersonnel, 'id'>) => void;
  onUpdatePersonnel: (p: AuditorPersonnel) => void;
  onDeletePersonnel: (id: string) => void;
  onBatchImportPersonnel?: (imported: AuditorPersonnel[], mode: 'replace' | 'merge') => void;
  currentRole?: UserRole;
}

export const TeamManager: React.FC<TeamManagerProps> = ({
  teams,
  personnel,
  onAddPersonnel,
  onUpdatePersonnel,
  onDeletePersonnel,
  onBatchImportPersonnel,
  currentRole
}) => {
  const [activeTab, setActiveTab] = useState<'personnel' | 'lineup' | 'teams'>('personnel');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedKorlap, setSelectedKorlap] = useState<string>('ALL');
  const [selectedDomisili, setSelectedDomisili] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCloudinaryModalOpen, setIsCloudinaryModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [personnelToDelete, setPersonnelToDelete] = useState<AuditorPersonnel | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [resetErrorMsg, setResetErrorMsg] = useState('');
  const [editingPersonnel, setEditingPersonnel] = useState<AuditorPersonnel | null>(null);
  const [showAdminActionTools, setShowAdminActionTools] = useState(false);
  const [isSyncingCloudinary, setIsSyncingCloudinary] = useState(false);

  const handleSyncCloudinary = async () => {
    setIsSyncingCloudinary(true);
    try {
      const syncedP = await syncCollectionFromCloudinary<AuditorPersonnel>(
        STORAGE_KEYS.PERSONNEL,
        'Master_Personil',
        'SO Sistem IC BALI/Master Personil',
        'personnel'
      );
      if (syncedP && Array.isArray(syncedP)) {
        if (onBatchImportPersonnel) {
          onBatchImportPersonnel(syncedP, 'replace');
        }
        setToastMessage(`✅ Sinkronisasi Cloudinary Berhasil! ${syncedP.length} data personil ter-update.`);
      } else {
        setToastMessage('ℹ️ Data Cloudinary personil sudah sinkron dengan data lokal.');
      }
    } catch (err: any) {
      setToastMessage(`⚠️ Sync Cloudinary: ${err?.message || err}`);
    } finally {
      setIsSyncingCloudinary(false);
    }
  };

  // Lineup Collapsing State per Korlap
  const [collapsedKorlaps, setCollapsedKorlaps] = useState<Record<string, boolean>>({});

  const toggleKorlapCollapse = (kName: string) => {
    setCollapsedKorlaps(prev => ({
      ...prev,
      [kName]: !prev[kName]
    }));
  };

  const handleCollapseAllKorlaps = () => {
    const next: Record<string, boolean> = {};
    uniqueKorlaps.forEach(k => {
      next[k] = true;
    });
    setCollapsedKorlaps(next);
  };

  const handleExpandAllKorlaps = () => {
    setCollapsedKorlaps({});
  };

  const handleConfirmResetPersonnel = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPasswordInput.trim() !== '7926') {
      setResetErrorMsg('Password PIN reset salah! Silakan periksa kembali.');
      return;
    }

    if (onBatchImportPersonnel) {
      onBatchImportPersonnel([], 'replace');
    } else {
      personnel.forEach(p => onDeletePersonnel(p.id));
    }

    setIsResetModalOpen(false);
    setResetPasswordInput('');
    setResetErrorMsg('');
    alert('Berhasil! Seluruh database personel telah di-reset / dihapus. Anda dapat mengunggah file master baru dari awal.');
  };

  // Status Date Modal State (Sakit / Cuti)
  const [statusModalPersonnel, setStatusModalPersonnel] = useState<AuditorPersonnel | null>(null);
  const [modalStatusType, setModalStatusType] = useState<'Sakit' | 'Cuti'>('Sakit');
  const [statusStartDate, setStatusStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusEndDate, setStatusEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusNotes, setStatusNotes] = useState('');

  const handleOpenStatusModal = (p: AuditorPersonnel, type: 'Sakit' | 'Cuti') => {
    setStatusModalPersonnel(p);
    setModalStatusType(type);
    const today = new Date().toISOString().split('T')[0];
    setStatusStartDate(p.statusStartDate || today);
    
    if (p.statusEndDate) {
      setStatusEndDate(p.statusEndDate);
    } else {
      const end = new Date();
      end.setDate(end.getDate() + (type === 'Sakit' ? 3 : 1));
      setStatusEndDate(end.toISOString().split('T')[0]);
    }
    setStatusNotes(p.statusNotes || '');
  };

  const handleSaveStatusModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalPersonnel) return;

    onUpdatePersonnel({
      ...statusModalPersonnel,
      status: modalStatusType,
      statusStartDate,
      statusEndDate,
      statusNotes: statusNotes.trim(),
      lastLeaveType: modalStatusType
    });

    setStatusModalPersonnel(null);
  };

  const handleQuickSetAktif = (p: AuditorPersonnel) => {
    // Keep statusStartDate, statusEndDate, statusNotes, and lastLeaveType so Admin Rekap Sakit & Cuti retains tracking data
    onUpdatePersonnel({
      ...p,
      status: 'Aktif'
    });
  };

  const handleBatchImportPersonnel = (imported: AuditorPersonnel[], mode: 'replace' | 'merge' = 'replace') => {
    if (onBatchImportPersonnel) {
      onBatchImportPersonnel(imported, mode);
    } else {
      imported.forEach(p => {
        onAddPersonnel({
          nik: p.nik,
          name: p.name,
          korlapName: p.korlapName || p.name,
          domisili: p.domisili || '',
          phone: p.phone || '',
          joinDate: p.joinDate,
          role: p.role,
          teamId: p.teamId,
          teamName: p.teamName,
          status: p.status,
          photoUrl: p.photoUrl
        });
      });
    }
  };

  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Form states
  const [nik, setNik] = useState('');
  const [name, setName] = useState('');
  const [korlapName, setKorlapName] = useState('');
  const [domisili, setDomisili] = useState('');
  const [phone, setPhone] = useState('');
  const [joinDate, setJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [role, setRole] = useState<AuditorPersonnelRole>('Anggota');
  const [teamId, setTeamId] = useState<string>('');
  const [status, setStatus] = useState<'Aktif' | 'Sakit' | 'Cuti' | 'Non-Aktif'>('Aktif');
  const [photoUrl, setPhotoUrl] = useState('');

  // Unique lists for Korlap & Domisili Filters
  const uniqueKorlaps: string[] = Array.from(
    new Set(personnel.map(p => p.korlapName || p.name).filter((x): x is string => Boolean(x)))
  );
  const uniqueDomisilis: string[] = Array.from(
    new Set(personnel.map(p => p.domisili || '').filter((x): x is string => Boolean(x)))
  );

  // Counts
  const totalPersonnelCount = personnel.length;
  const korlapCount = personnel.filter(p => p.role === 'Officer / Korlap').length;
  const koordinatorCount = personnel.filter(p => p.role === 'Koordinator').length;
  const anggotaCount = personnel.filter(p => p.role === 'Anggota').length;

  // Filter Personnel based on Master Criteria
  const filteredPersonnel = personnel.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q) ||
                        p.nik.toLowerCase().includes(q) ||
                        (p.korlapName || '').toLowerCase().includes(q) ||
                        (p.domisili || '').toLowerCase().includes(q) ||
                        p.phone.toLowerCase().includes(q);

    const matchRole = selectedRole === 'ALL' || p.role === selectedRole;
    const matchKorlap = selectedKorlap === 'ALL' || (p.korlapName || p.name) === selectedKorlap;
    const matchDomisili = selectedDomisili === 'ALL' || (p.domisili || '') === selectedDomisili;
    const matchStatus = selectedStatus === 'ALL' || p.status === selectedStatus;

    return matchSearch && matchRole && matchKorlap && matchDomisili && matchStatus;
  });

  const renderStatusBadge = (p: AuditorPersonnel) => {
    if (p.status === 'Sakit') {
      return (
        <div className="p-2 bg-amber-50 border border-amber-300 rounded-lg text-amber-950 text-[11px] space-y-0.5">
          <div className="flex items-center justify-between font-extrabold text-amber-900">
            <span className="flex items-center gap-1">🏥 Sakit</span>
            <span className="text-[9px] uppercase px-1.5 py-0.2 bg-amber-200 rounded font-bold text-amber-900">Izin Sakit</span>
          </div>
          <p className="text-[10px] font-mono text-amber-900 font-bold">
            {p.statusStartDate || '?'} s/d {p.statusEndDate || '?'}
          </p>
          {p.statusNotes && (
            <p className="text-[10px] text-amber-900 italic leading-tight">
              "{p.statusNotes}"
            </p>
          )}
        </div>
      );
    }

    if (p.status === 'Cuti') {
      return (
        <div className="p-2 bg-sky-50 border border-sky-300 rounded-lg text-sky-950 text-[11px] space-y-0.5">
          <div className="flex items-center justify-between font-extrabold text-sky-900">
            <span className="flex items-center gap-1">🏖️ Cuti</span>
            <span className="text-[9px] uppercase px-1.5 py-0.2 bg-sky-200 rounded font-bold text-sky-900">Izin Cuti</span>
          </div>
          <p className="text-[10px] font-mono text-sky-900 font-bold">
            {p.statusStartDate || '?'} s/d {p.statusEndDate || '?'}
          </p>
          {p.statusNotes && (
            <p className="text-[10px] text-sky-900 italic leading-tight">
              "{p.statusNotes}"
            </p>
          )}
        </div>
      );
    }

    if (p.status === 'Non-Aktif') {
      return (
        <span className="px-2.5 py-1 bg-slate-100 border border-slate-300 text-slate-600 font-bold text-xs rounded-lg inline-block">
          Non-Aktif
        </span>
      );
    }

    return (
      <span className="px-2.5 py-1 bg-emerald-100 border border-emerald-300 text-emerald-800 font-extrabold text-xs rounded-lg inline-flex items-center gap-1">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        Aktif
      </span>
    );
  };

  // Modal Handlers
  const openAddModal = () => {
    setEditingPersonnel(null);
    setNik(`2015${Math.floor(100000 + Math.random() * 900000)}`);
    setName('');
    setKorlapName('');
    setDomisili('');
    setPhone('');
    setJoinDate(new Date().toISOString().split('T')[0]);
    setRole('Anggota');
    setTeamId(teams[0]?.id || '');
    setStatus('Aktif');
    setPhotoUrl('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: AuditorPersonnel) => {
    setEditingPersonnel(p);
    setNik(p.nik);
    setName(p.name);
    setKorlapName(p.korlapName || p.name);
    setDomisili(p.domisili || '');
    setPhone(p.phone || '');
    setJoinDate(formatDateISO(p.joinDate));
    setRole(p.role);
    setTeamId(p.teamId || '');
    setStatus(p.status);
    setPhotoUrl(p.photoUrl || '');
    setIsModalOpen(true);
  };

  const handleSavePersonnel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !nik) return;

    const assignedTeam = teams.find(t => t.id === teamId);

    if (editingPersonnel) {
      onUpdatePersonnel({
        ...editingPersonnel,
        nik,
        name,
        korlapName: korlapName.trim() || name,
        domisili: domisili.trim(),
        phone: phone.trim(),
        joinDate,
        role,
        teamId: teamId || undefined,
        teamName: assignedTeam ? assignedTeam.name : undefined,
        status,
        photoUrl: photoUrl.trim() || undefined
      });
    } else {
      onAddPersonnel({
        nik,
        name,
        korlapName: korlapName.trim() || name,
        domisili: domisili.trim(),
        phone: phone.trim(),
        joinDate,
        role,
        teamId: teamId || undefined,
        teamName: assignedTeam ? assignedTeam.name : undefined,
        status,
        photoUrl: photoUrl.trim() || undefined
      });
    }

    setIsModalOpen(false);
  };

  // Export Personnel to Excel & CSV with strict Master Excel column order and auto Cloudinary backup
  const handleExportExcel = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const exportData = filteredPersonnel.map((p, idx) => ({
      'NO': idx + 1,
      'NIK': p.nik,
      'NAMA PERSONIL': p.name,
      'KORLAP/OFFICER': p.korlapName || p.name,
      'TANGGAL MASUK BEKERJA': p.joinDate,
      'LAMA BEKERJA': calculateLamaBekerja(p.joinDate),
      'NOMOR HP': p.phone || '',
      'DOMISILI': p.domisili || ''
    }));

    exportToExcelWithBackup('DATA_PERSONIL_SO.xlsx', 'DATA_PERSONIL_SO', exportData);
  };

  const handleExportCSV = () => {
    const exportData = filteredPersonnel.map((p, idx) => ({
      'NO': idx + 1,
      'NIK': p.nik,
      'NAMA PERSONIL': p.name,
      'KORLAP/OFFICER': p.korlapName || p.name,
      'TANGGAL MASUK BEKERJA': p.joinDate,
      'LAMA BEKERJA': calculateLamaBekerja(p.joinDate),
      'NOMOR HP': p.phone || '',
      'DOMISILI': p.domisili || ''
    }));
    exportToCSV('DATA_PERSONIL_SO.csv', exportData);
  };

  return (
    <div className="space-y-4">
      
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Tim Auditor SO & Database Personel Field
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Database {totalPersonnelCount} personel auditor lapangan, jabatan, NIK, tanggal masuk, dan performa alokasi tim
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto flex-wrap">
          <button
            onClick={() => setShowAdminActionTools(!showAdminActionTools)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Tampilkan/Sembunyikan Panel Tool Master Data & Import/Export"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
            <span>{showAdminActionTools ? 'Sembunyikan Tool Master' : 'Opsi Master & Ekspor Data'}</span>
          </button>

          {showAdminActionTools && (
            <>
              {currentRole !== 'OFFICER' && (
                <>
                  <button
                    onClick={handleSyncCloudinary}
                    disabled={isSyncingCloudinary}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                    title="Sinkronkan data Personil secara langsung dari Cloudinary"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncingCloudinary ? 'animate-spin' : ''}`} />
                    <span>{isSyncingCloudinary ? 'Sinkronisasi...' : 'Sinkron Cloudinary'}</span>
                  </button>

                  <button
                    onClick={() => setIsCloudinaryModalOpen(true)}
                    className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
                    title="Pengaturan Akses Cloud Storage Cloudinary"
                  >
                    <Cloud className="w-3.5 h-3.5 text-sky-600" />
                    <span>Setting Cloudinary</span>
                  </button>
                </>
              )}

              <button
                onClick={() => setIsResetModalOpen(true)}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
                title="Reset Seluruh Database Personel"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                <span>Reset Personel</span>
              </button>

              <button
                onClick={() => setIsImportModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                <span>Upload Excel Personel</span>
              </button>

              <button
                onClick={handleExportExcel}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-semibold transition flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Download Excel</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Export CSV Personel</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Total Personel SDM</span>
            <p className="text-base font-extrabold text-slate-900">{totalPersonnelCount} <span className="text-xs font-normal text-slate-500">orang</span></p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-indigo-200 bg-indigo-50/20 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-indigo-700 font-bold uppercase">Officer / Korlap</span>
            <p className="text-base font-extrabold text-indigo-900">{korlapCount} <span className="text-xs font-normal text-indigo-600">orang</span></p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-violet-200 bg-violet-50/20 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 text-violet-700 rounded-lg">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-violet-700 font-bold uppercase">Koordinator Field</span>
            <p className="text-base font-extrabold text-violet-900">{koordinatorCount} <span className="text-xs font-normal text-violet-600">orang</span></p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-emerald-200 bg-emerald-50/20 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-emerald-700 font-bold uppercase">Anggota Auditor</span>
            <p className="text-base font-extrabold text-emerald-900">{anggotaCount} <span className="text-xs font-normal text-emerald-600">orang</span></p>
          </div>
        </div>
      </div>

      {/* Main Tab Wrapper */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        
        {/* Navigation Tabs Header */}
        <div className="border-b border-slate-200 px-4 pt-3 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2">
          
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('personnel')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === 'personnel'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              Database Personel Auditor ({totalPersonnelCount})
            </button>

            <button
              onClick={() => setActiveTab('lineup')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === 'lineup'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Bagan Line-Up & Monitoring Korlap
            </button>

            <button
              onClick={() => setActiveTab('teams')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === 'teams'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building className="w-4 h-4" />
              Grup Tim SO & Alokasi Wilayah ({teams.length} Tim)
            </button>
          </div>

          {(activeTab === 'personnel' || activeTab === 'lineup') && (
            <div className="pb-2.5 w-full md:w-auto flex flex-col sm:flex-row items-center gap-2">
              <div className="relative w-full md:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari NIK, Nama, No HP..."
                  className="w-full bg-white border border-slate-300 rounded pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={openAddModal}
                className="w-full sm:w-auto shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Tambah Personel Baru</span>
              </button>
            </div>
          )}

        </div>

        {/* TAB 1: DATABASE PERSONEL */}
        {activeTab === 'personnel' && (
          <div className="p-4 space-y-4">
            
            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Filter Korlap */}
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] font-bold text-slate-600">Korlap:</span>
                  <select
                    value={selectedKorlap}
                    onChange={(e) => setSelectedKorlap(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">Semua Korlap</option>
                    {uniqueKorlaps.map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>

                {/* Filter Domisili */}
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] font-bold text-slate-600">Domisili:</span>
                  <select
                    value={selectedDomisili}
                    onChange={(e) => setSelectedDomisili(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">Semua Domisili</option>
                    {uniqueDomisilis.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Filter Jabatan Buttons */}
                <div className="flex items-center gap-1 ml-1">
                  <span className="text-[11px] font-bold text-slate-500 mr-1">Jabatan:</span>
                  {['ALL', 'Officer / Korlap', 'Koordinator', 'Anggota'].map(r => (
                    <button
                      key={r}
                      onClick={() => setSelectedRole(r)}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                        selectedRole === r
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {r === 'ALL' ? 'Semua' : r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter Status */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[11px] font-bold text-slate-500 mr-1">Status:</span>
                {['ALL', 'Aktif', 'Sakit', 'Cuti', 'Non-Aktif'].map(s => (
                  <button
                    key={s}
                    onClick={() => setSelectedStatus(s)}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                      selectedStatus === s
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {s === 'ALL' ? 'Semua' : s}
                  </button>
                ))}
              </div>

            </div>

            {/* Personnel Master Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                    <tr>
                      <th className="p-3 w-10 text-center">NO</th>
                      <th className="p-3">NIK</th>
                      <th className="p-3">NAMA PERSONIL</th>
                      <th className="p-3">KORLAP/OFFICER</th>
                      <th className="p-3">TANGGAL MASUK BEKERJA</th>
                      <th className="p-3">LAMA BEKERJA</th>
                      <th className="p-3">NOMOR HP</th>
                      <th className="p-3">DOMISILI</th>
                      <th className="p-3 text-center">STATUS MONITORING</th>
                      <th className="p-3 text-right">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPersonnel.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">
                          Tidak ada data personel SO yang sesuai dengan kriteria pencarian / filter.
                        </td>
                      </tr>
                    ) : (
                      filteredPersonnel.map((p, idx) => {
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/80 transition">
                            
                            {/* NO */}
                            <td className="p-3 text-center font-bold text-slate-500 text-[11px]">
                              {idx + 1}
                            </td>

                            {/* NIK */}
                            <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                              <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded-md text-slate-900">
                                {p.nik}
                              </span>
                            </td>

                            {/* NAMA PERSONIL */}
                            <td className="p-3 whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                {p.photoUrl ? (
                                  <button
                                    onClick={() => setPreviewPhotoUrl(p.photoUrl!)}
                                    className="relative group shrink-0"
                                    title="Klik untuk lihat foto Cloudinary"
                                  >
                                    <img
                                      src={p.photoUrl}
                                      alt={p.name}
                                      className="w-8 h-8 rounded-full object-cover border border-indigo-200 group-hover:scale-105 transition"
                                    />
                                    <span className="absolute -top-0.5 -right-0.5 p-0.5 bg-emerald-500 text-white rounded-full shadow-2xs">
                                      <Cloud className="w-2 h-2" />
                                    </span>
                                  </button>
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                                    {p.name.charAt(0)}
                                  </div>
                                )}
                                <div>
                                  <p className="font-bold text-slate-900">{p.name}</p>
                                  {p.role === 'Officer / Korlap' && (
                                    <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 text-[9px] font-extrabold rounded inline-block mt-0.5">
                                      Officer / Korlap
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* KORLAP/OFFICER */}
                            <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50/70 border border-indigo-200/80 rounded-lg text-indigo-900 text-xs">
                                <ShieldCheck className="w-3 h-3 text-indigo-600 shrink-0" />
                                {p.korlapName || p.name}
                              </span>
                            </td>

                            {/* TANGGAL MASUK BEKERJA */}
                            <td className="p-3 font-medium text-slate-700 whitespace-nowrap">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                {formatDateIndo(p.joinDate)}
                              </span>
                            </td>

                            {/* LAMA BEKERJA (Hitung Tanggal Hari Ini - Tanggal Masuk) */}
                            <td className="p-3 whitespace-nowrap">
                              <LamaBekerjaBadge joinDate={p.joinDate} />
                            </td>

                            {/* NOMOR HP */}
                            <td className="p-3 font-mono text-slate-700">
                              {p.phone ? (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                  {p.phone}
                                </span>
                              ) : (
                                <span className="text-slate-300 italic text-xs">-</span>
                              )}
                            </td>

                            {/* DOMISILI */}
                            <td className="p-3 font-semibold text-slate-700">
                              {p.domisili ? (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  {p.domisili}
                                </span>
                              ) : (
                                <span className="text-slate-300 italic text-xs">-</span>
                              )}
                            </td>

                            {/* STATUS MONITORING */}
                            <td className="p-3 text-center">
                              <div className="flex flex-col items-center gap-1.5">
                                {renderStatusBadge(p)}
                                <div className="flex items-center gap-1">
                                  <button
                                    title="Set Status Aktif"
                                    onClick={() => handleQuickSetAktif(p)}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition ${
                                      p.status === 'Aktif'
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    }`}
                                  >
                                    🟢
                                  </button>
                                  <button
                                    title="Set Status Sakit (dengan input tgl)"
                                    onClick={() => handleOpenStatusModal(p, 'Sakit')}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition ${
                                      p.status === 'Sakit'
                                        ? 'bg-amber-600 text-white border-amber-600'
                                        : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                    }`}
                                  >
                                    🏥
                                  </button>
                                  <button
                                    title="Set Status Cuti (dengan input tgl)"
                                    onClick={() => handleOpenStatusModal(p, 'Cuti')}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition ${
                                      p.status === 'Cuti'
                                        ? 'bg-sky-600 text-white border-sky-600'
                                        : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
                                    }`}
                                  >
                                    🏖️
                                  </button>
                                </div>
                              </div>
                            </td>

                            {/* AKSI */}
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  title="Edit Data Personil"
                                  onClick={() => openEditModal(p)}
                                  className="p-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-600 transition"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  title="Hapus Personil"
                                  onClick={() => setPersonnelToDelete(p)}
                                  className="p-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-400 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: BAGAN LINE UP & MONITORING PERSONIL PER KORLAP */}
        {activeTab === 'lineup' && (
          <div className="p-4 space-y-6 bg-slate-50/50">
            {/* Info Banner Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2 text-white">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  Bagan Organisasi Line-Up & Monitoring SDM Korlap
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Pantau ketersediaan & kehadiran tiap personel under Korlap / Officer secara real-time. Sediakan tombol lipat/buka agar tampilan mobile lebih rapi.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs flex-wrap">
                <button
                  onClick={handleCollapseAllKorlaps}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 flex items-center gap-1.5 transition"
                >
                  <EyeOff className="w-3.5 h-3.5 text-indigo-300" />
                  Sembunyikan Semua
                </button>
                <button
                  onClick={handleExpandAllKorlaps}
                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-lg shadow-2xs flex items-center gap-1.5 transition"
                >
                  <Eye className="w-3.5 h-3.5 text-white" />
                  Tampilkan Semua
                </button>

                <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />

                <span className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-bold rounded-lg flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Aktif: {personnel.filter(p => p.status === 'Aktif').length}
                </span>
                <span className="px-3 py-1.5 bg-amber-500/20 border border-amber-400/40 text-amber-200 font-bold rounded-lg flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Sakit: {personnel.filter(p => p.status === 'Sakit').length}
                </span>
                <span className="px-3 py-1.5 bg-sky-500/20 border border-sky-400/40 text-sky-200 font-bold rounded-lg flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  Cuti: {personnel.filter(p => p.status === 'Cuti').length}
                </span>
              </div>
            </div>

            {/* Group By Korlap */}
            {uniqueKorlaps.map((kName) => {
              const korlapPerson = personnel.find(p => p.name === kName || (p.role === 'Officer / Korlap' && (p.korlapName === kName || p.name === kName)));
              const korlapTeamMembers = personnel.filter(p => (p.korlapName || p.name) === kName);
              
              const totalKorlapTeam = korlapTeamMembers.length;
              const aktifCount = korlapTeamMembers.filter(p => p.status === 'Aktif').length;
              const sakitCount = korlapTeamMembers.filter(p => p.status === 'Sakit').length;
              const cutiCount = korlapTeamMembers.filter(p => p.status === 'Cuti').length;

              const isCollapsed = collapsedKorlaps[kName] ?? true;

              return (
                <div key={kName} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                  {/* Korlap Header */}
                  <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-200 gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-extrabold flex items-center justify-center text-sm shadow-sm shrink-0 overflow-hidden">
                        {korlapPerson?.photoUrl ? (
                          <img src={korlapPerson.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          kName.charAt(0)
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-slate-900 text-sm tracking-tight">{kName}</h4>
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-extrabold rounded-md border border-indigo-200">
                            OFFICER / KORLAP
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          NIK: {korlapPerson?.nik || '-'} | Tim SO: {korlapPerson?.teamName || 'Tim SO'}
                        </p>
                      </div>
                    </div>

                    {/* Korlap Stats Pills & Hide/Show Button */}
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200">
                        Total: {totalKorlapTeam} Personel
                      </span>
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 font-bold rounded-lg border border-emerald-200">
                        🟢 {aktifCount}
                      </span>
                      {sakitCount > 0 && (
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-800 font-bold rounded-lg border border-amber-200 animate-pulse">
                          🏥 {sakitCount}
                        </span>
                      )}
                      {cutiCount > 0 && (
                        <span className="px-2.5 py-1 bg-sky-50 text-sky-800 font-bold rounded-lg border border-sky-200">
                          🏖️ {cutiCount}
                        </span>
                      )}

                      {/* Hide / Show Toggle Button */}
                      <button
                        onClick={() => toggleKorlapCollapse(kName)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                          isCollapsed
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {isCollapsed ? (
                          <>
                            <Eye className="w-3.5 h-3.5 text-white" />
                            <span>Tampilkan Anggota ({totalKorlapTeam})</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                            <span>Sembunyikan</span>
                            <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>

                    </div>
                  </div>

                  {/* Lineup Bagan Tree / Organogram Grid (Collapsible) */}
                  {!isCollapsed && (
                    <div className="relative pt-2 space-y-4 animate-in fade-in">
                    
                    {/* Top Node: Korlap Officer Card */}
                    {korlapPerson && (
                      <div className="flex justify-center mb-6">
                        <div className="w-full max-w-md bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-xl p-4 shadow-md border border-indigo-700 relative group">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {korlapPerson.photoUrl ? (
                                <img src={korlapPerson.photoUrl} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-indigo-400 shrink-0" />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-indigo-500 text-white font-black flex items-center justify-center text-base border-2 border-indigo-300 shrink-0">
                                  {korlapPerson.name.charAt(0)}
                                </div>
                              )}
                              <div>
                                <span className="text-[9px] uppercase tracking-wider text-indigo-300 font-extrabold block">
                                  HEAD OF LINEUP / KORLAP
                                </span>
                                <h5 className="font-black text-sm text-white leading-tight">{korlapPerson.name}</h5>
                                <p className="text-[10px] text-indigo-200 font-mono mt-0.5">NIK: {korlapPerson.nik}</p>
                              </div>
                            </div>

                            {/* Status Badge */}
                            <div>
                              {renderStatusBadge(korlapPerson)}
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-indigo-800/80 grid grid-cols-2 gap-2 text-[11px] text-indigo-200">
                            <div>
                              <span className="text-[9px] text-indigo-400 font-bold uppercase block">Lama Bekerja</span>
                              <span className="font-bold text-white flex items-center gap-1">
                                <Clock className="w-3 h-3 text-indigo-300" />
                                {calculateLamaBekerja(korlapPerson.joinDate)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] text-indigo-400 font-bold uppercase block">Domisili & HP</span>
                              <span className="font-medium text-white truncate block">
                                {korlapPerson.phone || '-'} | {korlapPerson.domisili || '-'}
                              </span>
                            </div>
                          </div>

                          {/* Status Action Buttons */}
                          <div className="mt-3 pt-2 border-t border-indigo-800/80 flex items-center justify-between gap-1.5">
                            <span className="text-[10px] text-indigo-300 font-bold">Set Status:</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleQuickSetAktif(korlapPerson)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                                  korlapPerson.status === 'Aktif'
                                    ? 'bg-emerald-500 text-white border-emerald-400'
                                    : 'bg-indigo-950 text-emerald-300 border-indigo-700 hover:bg-emerald-950'
                                }`}
                              >
                                🟢 Aktif
                              </button>
                              <button
                                onClick={() => handleOpenStatusModal(korlapPerson, 'Sakit')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                                  korlapPerson.status === 'Sakit'
                                    ? 'bg-amber-500 text-white border-amber-400'
                                    : 'bg-indigo-950 text-amber-300 border-indigo-700 hover:bg-amber-950'
                                }`}
                              >
                                🏥 Sakit
                              </button>
                              <button
                                onClick={() => handleOpenStatusModal(korlapPerson, 'Cuti')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                                  korlapPerson.status === 'Cuti'
                                    ? 'bg-sky-500 text-white border-sky-400'
                                    : 'bg-indigo-950 text-sky-300 border-indigo-700 hover:bg-sky-950'
                                }`}
                              >
                                🏖️ Cuti
                              </button>
                            </div>
                          </div>

                        </div>
                      </div>
                    )}

                    {/* Tree Connector Line */}
                    <div className="flex justify-center -mt-3 mb-4">
                      <div className="w-0.5 h-6 bg-indigo-300" />
                    </div>

                    {/* Member Personnel Grid (Koordinator & Anggota) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                      {korlapTeamMembers
                        .filter(p => p.id !== korlapPerson?.id)
                        .map((mem) => {
                          const lamaBekerjaMem = calculateLamaBekerja(mem.joinDate);

                          return (
                            <div
                              key={mem.id}
                              className={`bg-white border rounded-xl p-3.5 shadow-2xs space-y-3 transition hover:shadow-md ${
                                mem.status === 'Sakit'
                                  ? 'border-amber-300 bg-amber-50/20'
                                  : mem.status === 'Cuti'
                                  ? 'border-sky-300 bg-sky-50/20'
                                  : 'border-slate-200 hover:border-indigo-300'
                              }`}
                            >
                              {/* Header Member */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  {mem.photoUrl ? (
                                    <img src={mem.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0" />
                                  ) : (
                                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-extrabold flex items-center justify-center text-xs shrink-0 border border-slate-200">
                                      {mem.name.charAt(0)}
                                    </div>
                                  )}
                                  <div>
                                    <h6 className="font-extrabold text-slate-900 text-xs leading-tight">{mem.name}</h6>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="font-mono text-[10px] text-slate-500">{mem.nik}</span>
                                      <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded ${
                                        mem.role === 'Koordinator'
                                          ? 'bg-violet-100 text-violet-800'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}>
                                        {mem.role}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Details & Experience */}
                              <div className="p-2 bg-slate-50 rounded-lg text-[11px] space-y-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0">Lama Bekerja:</span>
                                  <LamaBekerjaBadge joinDate={mem.joinDate} compact />
                                </div>
                                <div className="flex items-center justify-between text-slate-600">
                                  <span className="text-[10px] text-slate-400">Masuk:</span>
                                  <span className="font-medium text-slate-700">{formatDateIndo(mem.joinDate)}</span>
                                </div>
                                <div className="flex items-center justify-between text-slate-600">
                                  <span className="text-[10px] text-slate-400">No HP:</span>
                                  <span className="font-mono text-slate-800">{mem.phone || '-'}</span>
                                </div>
                                <div className="flex items-center justify-between text-slate-600">
                                  <span className="text-[10px] text-slate-400">Domisili:</span>
                                  <span className="font-semibold text-slate-800">{mem.domisili || '-'}</span>
                                </div>
                              </div>

                              {/* Status Banner */}
                              <div>
                                {renderStatusBadge(mem)}
                              </div>

                              {/* Tombol Monitoring Korlap (Aktif, Sakit, Cuti) */}
                              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                                <span className="text-[10px] font-bold text-slate-400">Monitoring:</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    title="Set Status Aktif"
                                    onClick={() => handleQuickSetAktif(mem)}
                                    className={`px-2 py-1 rounded text-[10px] font-extrabold transition border ${
                                      mem.status === 'Aktif'
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                    }`}
                                  >
                                    🟢 Aktif
                                  </button>
                                  <button
                                    title="Set Status Sakit"
                                    onClick={() => handleOpenStatusModal(mem, 'Sakit')}
                                    className={`px-2 py-1 rounded text-[10px] font-extrabold transition border ${
                                      mem.status === 'Sakit'
                                        ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                        : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                    }`}
                                  >
                                    🏥 Sakit
                                  </button>
                                  <button
                                    title="Set Status Cuti"
                                    onClick={() => handleOpenStatusModal(mem, 'Cuti')}
                                    className={`px-2 py-1 rounded text-[10px] font-extrabold transition border ${
                                      mem.status === 'Cuti'
                                        ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                                        : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-200'
                                    }`}
                                  >
                                    🏖️ Cuti
                                  </button>
                                </div>
                              </div>

                            </div>
                          );
                        })}
                    </div>

                  </div>
                )}
              </div>
            );
            })}
          </div>
        )}

        {/* TAB 2: GRUP TIM SO & ALOKASI WILAYAH */}
        {activeTab === 'teams' && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((t) => (
                <div key={t.id} className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
                  
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{t.name}</h3>
                      <span className="text-[10px] text-slate-500 font-mono">Leader: {t.leaderName}</span>
                    </div>
                    <span className="px-2 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs rounded-lg">
                      {t.avgAccuracyAchieved}% Avg Akurasi
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Total Toko Alokasi</span>
                      <p className="font-bold text-slate-900 mt-0.5">{t.activeStoresCount} Toko</p>
                    </div>

                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Rata2 Durasi SO</span>
                      <p className="font-bold text-slate-900 mt-0.5">{t.avgDurationHours} Jam / Toko</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" /> Wilayah Alokasi
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {t.assignedRegions.map(r => (
                        <span key={r} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] truncate max-w-full">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Registered Personnel in this team */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Personel Terdaftar ({personnel.filter(p => p.teamId === t.id || p.teamName === t.name).length} Personel)
                    </span>
                    <div className="space-y-1">
                      {personnel.filter(p => p.teamId === t.id || p.teamName === t.name).map(p => (
                        <div key={p.id} className="flex items-center justify-between text-[11px] p-1.5 bg-slate-50 rounded">
                          <div className="flex items-center gap-2">
                            {p.photoUrl ? (
                              <img src={p.photoUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 font-bold text-[9px] flex items-center justify-center">
                                {p.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-slate-800">{p.name}</span>
                              <span className="text-[10px] text-slate-400 ml-1">({p.role})</span>
                            </div>
                          </div>
                          <span className="font-mono text-[10px] text-slate-500">{p.phone}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* MODAL: TAMBAH / EDIT PERSONEL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-3.5 px-5 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-400" />
                {editingPersonnel ? 'Edit Data Personel Auditor' : 'Tambah Personel Auditor Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePersonnel} className="p-5 space-y-3.5 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">NIK (Nomor Induk Karyawan) *</label>
                  <input
                    type="text"
                    required
                    value={nik}
                    onChange={(e) => setNik(e.target.value)}
                    placeholder="misal: 2013217571"
                    className="w-full border border-slate-300 rounded p-2 font-mono text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jabatan *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as AuditorPersonnelRole)}
                    className="w-full border border-slate-300 rounded p-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Officer / Korlap">Officer / Korlap</option>
                    <option value="Koordinator">Koordinator</option>
                    <option value="Anggota">Anggota</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Personel *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="misal: I GEDE PASEK SANTIKA"
                  className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Korlap / Officer Penanggung Jawab *</label>
                  <input
                    type="text"
                    required
                    value={korlapName}
                    onChange={(e) => setKorlapName(e.target.value)}
                    placeholder="misal: I GEDE PASEK SANTIKA / ABDUL RAHMAN"
                    className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Domisili *</label>
                  <input
                    type="text"
                    required
                    value={domisili}
                    onChange={(e) => setDomisili(e.target.value)}
                    placeholder="misal: Denpasar / Badung / Tabanan"
                    className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nomor HP / Whatsapp *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="misal: 08123456789"
                    className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Masuk Bekerja *</label>
                  <input
                    type="date"
                    required
                    value={joinDate}
                    onChange={(e) => setJoinDate(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Realtime Calculated Lama Bekerja Banner */}
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-800">Perhitungan Otomatis Lama Bekerja</span>
                    <p className="font-extrabold text-emerald-950 text-sm">{calculateLamaBekerja(joinDate)}</p>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-semibold">
                  Formula: (Tanggal Hari Ini - Tgl Masuk)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alokasi Tim SO</label>
                  <select
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Belum Dialokasikan</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status Keanggotaan *</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500 font-semibold"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Cuti">Cuti</option>
                    <option value="Non-Aktif">Non-Aktif</option>
                  </select>
                </div>
              </div>

              {/* Cloudinary Asset Photo Input */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <label className="block font-semibold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-indigo-600" /> URL Foto Cloudinary Asset
                  </span>
                  <span className="text-[10px] text-indigo-600 font-bold">Cloud CDN Ready</span>
                </label>
                <input
                  type="text"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://res.cloudinary.com/... atau paste URL foto"
                  className="w-full bg-white border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500">
                  Foto akan ter-link secara otomatis ke Cloudinary CDN storage Anda.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs"
                >
                  Simpan Personel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPORT PERSONNEL EXCEL */}
      <ImportPersonnelModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        teams={teams}
        onImportPersonnel={handleBatchImportPersonnel}
      />

      {/* MODAL: PREVIEW FOTO CLOUDINARY */}
      {previewPhotoUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Foto Asset Cloudinary CDN</h3>
              </div>
              <button onClick={() => setPreviewPhotoUrl(null)} className="text-slate-400 hover:text-slate-800 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center p-2 min-h-64">
              <img src={previewPhotoUrl} alt="Cloudinary Asset" className="max-h-80 w-auto rounded-lg object-contain" />
            </div>

            <div className="p-2.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between text-xs">
              <span className="font-mono text-[10px] text-slate-600 truncate max-w-[280px]">{previewPhotoUrl}</span>
              <a 
                href={previewPhotoUrl} 
                target="_blank" 
                rel="noreferrer"
                className="text-indigo-600 hover:underline flex items-center gap-1 font-bold flex-shrink-0"
              >
                Buka CDN <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INPUT TANGGAL SAKIT / CUTI STATUS */}
      {statusModalPersonnel && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className={`p-4 text-white flex items-center justify-between ${
              modalStatusType === 'Sakit' ? 'bg-amber-600' : 'bg-sky-600'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{modalStatusType === 'Sakit' ? '🏥' : '🏖️'}</span>
                <h3 className="font-extrabold text-sm">
                  Input Tanggal Status {modalStatusType} Personel
                </h3>
              </div>
              <button
                onClick={() => setStatusModalPersonnel(null)}
                className="text-white/80 hover:text-white p-1 rounded transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStatusModal} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Personel Auditor:</span>
                <p className="font-extrabold text-slate-900 text-sm">{statusModalPersonnel.name}</p>
                <p className="text-[11px] font-mono text-slate-600">NIK: {statusModalPersonnel.nik} | Role: {statusModalPersonnel.role}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tanggal Mulai {modalStatusType} *
                  </label>
                  <input
                    type="date"
                    required
                    value={statusStartDate}
                    onChange={(e) => setStatusStartDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tanggal Selesai {modalStatusType} *
                  </label>
                  <input
                    type="date"
                    required
                    value={statusEndDate}
                    onChange={(e) => setStatusEndDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Keterangan / Alasan {modalStatusType} (Opsional)
                </label>
                <input
                  type="text"
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder={
                    modalStatusType === 'Sakit'
                      ? 'misal: Demam tinggi & Izin Surat Dokter RS'
                      : 'misal: Cuti Tahunan Karyawan / Acara Keluarga'
                  }
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusModalPersonnel(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-white font-extrabold rounded-xl shadow-sm transition ${
                    modalStatusType === 'Sakit'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  Simpan Status {modalStatusType}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cloudinary Config Modal */}
      <CloudinaryModal
        isOpen={isCloudinaryModalOpen}
        onClose={() => setIsCloudinaryModalOpen(false)}
      />

      {/* Reset Personnel Database Password PIN Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-rose-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-600 rounded-xl">
                  <RotateCcw className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm leading-tight">Reset Database Personel</h3>
                  <p className="text-[11px] text-rose-200">Keamanan Akses Hapus Total Data Personel</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsResetModalOpen(false);
                  setResetPasswordInput('');
                  setResetErrorMsg('');
                }}
                className="text-white/80 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmResetPersonnel} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5">
                <span className="font-extrabold text-rose-900 flex items-center gap-1.5 text-xs">
                  <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                  Konfirmasi Hapus Total ({totalPersonnelCount} Personel)
                </span>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  Semua data personel yang tersimpan di sistem akan dihapus bersih agar Anda bisa mengunggah file master baru tanpa terjadi akumulasi/penumpukan ganda.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-indigo-600" />
                  Masukan Password PIN Security *
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={resetPasswordInput}
                  onChange={(e) => {
                    setResetPasswordInput(e.target.value);
                    setResetErrorMsg('');
                  }}
                  placeholder="Masukan Password PIN (misal: 1234)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 font-mono text-sm focus:outline-none focus:border-rose-600 focus:bg-white font-extrabold tracking-widest text-center"
                />
                <span className="text-[10px] text-slate-400 mt-1 block text-center">
                  Password PIN default: <strong className="text-slate-700">1234</strong>
                </span>
              </div>

              {resetErrorMsg && (
                <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-lg text-rose-800 font-bold text-center">
                  ⚠️ {resetErrorMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetModalOpen(false);
                    setResetPasswordInput('');
                    setResetErrorMsg('');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus Total & Reset Personel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Personnel Deletion */}
      <ConfirmDeleteModal
        isOpen={!!personnelToDelete}
        onClose={() => setPersonnelToDelete(null)}
        onConfirm={() => {
          if (personnelToDelete) {
            onDeletePersonnel(personnelToDelete.id);
            setToastMessage(`Personel ${personnelToDelete.name} (${personnelToDelete.nik}) berhasil dihapus dari tim!`);
            setPersonnelToDelete(null);
          }
        }}
        title="Hapus Data Personil"
        subtitle="Apakah Anda yakin ingin menghapus personil ini?"
        itemName={personnelToDelete ? `${personnelToDelete.name} (${personnelToDelete.nik})` : undefined}
        itemDetails={personnelToDelete ? [
          { label: 'NIK / ID', value: personnelToDelete.nik },
          { label: 'Role / Jabatan', value: personnelToDelete.role },
          { label: 'No. HP / WA', value: personnelToDelete.phone || '-' },
          { label: 'Tim SO', value: personnelToDelete.teamName || '-' }
        ] : []}
        confirmText="Ya, Hapus Personil"
        dangerBadgeText="Data personil ini akan dihapus dari daftar anggota tim SO."
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

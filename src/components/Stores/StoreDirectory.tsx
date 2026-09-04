import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  Filter, 
  Plus, 
  Upload, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Edit2, 
  Trash2,
  SlidersHorizontal,
  Check,
  RotateCcw,
  Sparkles,
  MapPin,
  Calendar,
  DollarSign,
  Layers,
  X,
  Settings2,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Store, SOSchedule, SOResult, RegionArea, StoreType } from '../../types/stockOpname';
import { REGIONS } from '../../data/initialData';
import { getRiskBadgeClass, formatDateIndo, formatSmartSODate, formatZoneText } from '../../utils/formatters';
import { exportToCSV } from '../../services/storageService';
import { autoSyncStoreRegionAndKabupaten } from '../../utils/geoUtils';
import { getStoreSOApprovalStatus, isStoreZonaHitam } from '../../utils/storeSyncUtils';
import { normalizeKorlapName } from '../../utils/korlapUtils';
import { ConfirmDeleteModal } from '../Common/ConfirmDeleteModal';
import { ToastNotification } from '../Common/ToastNotification';

interface StoreDirectoryProps {
  stores: Store[];
  schedules?: SOSchedule[];
  results?: SOResult[];
  onOpenAddModal: () => void;
  onOpenImportModal: () => void;
  onSelectStore: (store: Store) => void;
  onEditStore: (store: Store) => void;
  onDeleteStore: (storeId: string) => void;
  onBulkUpdateStores?: (updatedStores: Store[]) => void;
  onResetMasterStores?: () => void;
}

export interface ColumnDef {
  id: string;
  label: string;
  category: 'Identitas' | 'Lokasi' | 'Penanggung Jawab' | 'Jadwal SO' | 'Status & Keuangan';
  defaultVisible: boolean;
}

export const ALL_STORE_COLUMNS: ColumnDef[] = [
  { id: 'code', label: 'KD TOKO', category: 'Identitas', defaultVisible: true },
  { id: 'name', label: 'NAMA TOKO', category: 'Identitas', defaultVisible: true },
  { id: 'koordinat', label: 'KOORDINAT', category: 'Lokasi', defaultVisible: false },
  { id: 'saldoToko', label: 'SALDO TOKO', category: 'Status & Keuangan', defaultVisible: true },
  { id: 'am', label: 'AM', category: 'Penanggung Jawab', defaultVisible: false },
  { id: 'as', label: 'AS', category: 'Penanggung Jawab', defaultVisible: false },
  { id: 'region', label: 'WILAYAH', category: 'Lokasi', defaultVisible: false },
  { id: 'kabupaten', label: 'KABUPATEN', category: 'Lokasi', defaultVisible: true },
  { id: 'kecamatan', label: 'KECAMATAN', category: 'Lokasi', defaultVisible: false },
  { id: 'coverage', label: 'COVERAGE', category: 'Identitas', defaultVisible: true },
  { id: 'qm', label: 'TYPE SO', category: 'Jadwal SO', defaultVisible: true },
  { id: 'tglSoMei', label: "SO MEI '26", category: 'Jadwal SO', defaultVisible: false },
  { id: 'tglSoJuni', label: "SO JUNI '26", category: 'Jadwal SO', defaultVisible: false },
  { id: 'tglSoJuli', label: "SO JULI '26", category: 'Jadwal SO', defaultVisible: false },
  { id: 'soAgustus', label: "SO AGUSTUS '26", category: 'Jadwal SO', defaultVisible: true },
  { id: 'soSeptember', label: "SO SEPTEMBER '26", category: 'Jadwal SO', defaultVisible: true },
  { id: 'statusApproveSO', label: 'SUDAH APPROVE SO', category: 'Jadwal SO', defaultVisible: true },
  { id: 'tglSoApproved', label: 'SO APPROVED (SPV)', category: 'Jadwal SO', defaultVisible: false },
  { id: 'frekuensiTidakSO', label: 'FREKUENSI TIDAK SO', category: 'Jadwal SO', defaultVisible: true },
  { id: 'keterangan', label: 'KETERANGAN', category: 'Status & Keuangan', defaultVisible: true },
  { id: 'zona', label: 'ZONA', category: 'Status & Keuangan', defaultVisible: true },
  { id: 'soAktiva', label: 'SO AKTIVA', category: 'Status & Keuangan', defaultVisible: false },
  { id: 'korlap', label: 'KORLAP/OFFICER', category: 'Penanggung Jawab', defaultVisible: true }
];

const PRESETS = [
  {
    id: 'master_bali',
    name: 'Master Toko Bali (Excel)',
    desc: 'Struktur urutan kolom persis Sheet Master Toko Bali',
    cols: ['code', 'name', 'koordinat', 'saldoToko', 'am', 'as', 'region', 'kabupaten', 'coverage', 'qm', 'tglSoMei', 'tglSoJuni', 'tglSoJuli', 'soAgustus', 'soSeptember', 'statusApproveSO', 'frekuensiTidakSO', 'keterangan', 'zona', 'soAktiva']
  },
  {
    id: 'zona_hitam',
    name: '🔴 Monitoring Zona Hitam',
    desc: 'Fokus toko high risk, frekuensi tidak SO & jadwal',
    cols: ['code', 'name', 'zona', 'frekuensiTidakSO', 'soSeptember', 'statusApproveSO', 'soAgustus', 'saldoToko', 'kabupaten', 'korlap', 'keterangan']
  },
  {
    id: 'ringkas',
    name: 'Ringkas (Default)',
    desc: 'Tampilan esensial & monitoring cepat',
    cols: ['code', 'name', 'kabupaten', 'coverage', 'qm', 'zona', 'soSeptember', 'statusApproveSO', 'soAgustus', 'frekuensiTidakSO', 'saldoToko', 'korlap']
  },
  {
    id: 'jadwal',
    name: 'Jadwal SO Mei - Sep',
    desc: 'Monitoring riwayat tanggal SO per bulan & status approval',
    cols: ['code', 'name', 'qm', 'tglSoMei', 'tglSoJuni', 'tglSoJuli', 'soAgustus', 'soSeptember', 'statusApproveSO', 'frekuensiTidakSO', 'zona', 'korlap']
  },
  {
    id: 'semua',
    name: 'Tampilkan Semua Kolom',
    desc: 'Semua atribut data master toko lengkap',
    cols: ALL_STORE_COLUMNS.map(c => c.id)
  }
];

export const StoreDirectory: React.FC<StoreDirectoryProps> = ({
  stores,
  schedules = [],
  results = [],
  onOpenAddModal,
  onOpenImportModal,
  onSelectStore,
  onEditStore,
  onDeleteStore,
  onBulkUpdateStores,
  onResetMasterStores
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [selectedQm, setSelectedQm] = useState('ALL');
  const [selectedZona, setSelectedZona] = useState('ALL');
  const [selectedStatusApprove, setSelectedStatusApprove] = useState('ALL');
  const [selectedKorlap, setSelectedKorlap] = useState('ALL');
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Helper to dynamically get assigned Korlap/Officer based on SPV approval or master data
  const getEffectiveKorlap = (s: Store): string => {
    // 1. Check if store has an approved/completed SO schedule in the current month
    const approvedSched = schedules?.find(sc => 
      (sc.storeCode === s.code || sc.storeId === s.id) &&
      (sc.status === 'Selesai' || sc.status === 'Approved' || !!s.tglSoApproved)
    );
    if (approvedSched && approvedSched.officerInCharge && approvedSched.officerInCharge !== 'Petugas SO') {
      return approvedSched.officerInCharge;
    }

    // 2. Check if store has any active schedule assigned
    const activeSched = schedules?.find(sc => sc.storeCode === s.code || sc.storeId === s.id);
    if (activeSched && activeSched.officerInCharge && activeSched.officerInCharge !== 'Petugas SO') {
      return activeSched.officerInCharge;
    }

    // 3. Store already has an SO date in August from master upload
    const hasAugustDate = (s.soAgustus && s.soAgustus !== '-' && s.soAgustus !== 'Belum SO') ||
                          (s.lastSODate && s.lastSODate.startsWith('2026-08')) ||
                          (s.tglSoApproved && s.tglSoApproved !== '-');
    if (hasAugustDate) {
      if (s.korlap && s.korlap !== '-' && s.korlap !== 'I GEDE PASEK SANTIKA') {
        return s.korlap;
      }
      return 'Petugas SO';
    }

    // 4. Stores with NO SO date in August and no schedule -> blank (-)
    return '-';
  };

  const handleSyncLocations = () => {
    const updated = stores.map(s => autoSyncStoreRegionAndKabupaten(s));
    if (onBulkUpdateStores) {
      onBulkUpdateStores(updated);
    }
    setSyncNotice(`100% Berhasil! ${updated.length} toko telah disinkronkan kolom Kabupaten & Wilayahnya secara cerdas berdasarkan koordinat GPS & kode toko.`);
    setTimeout(() => setSyncNotice(null), 6000);
  };
  
  // Column selector state
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('spv_visible_columns_store_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // fallback
      }
    }
    return ALL_STORE_COLUMNS.filter(c => c.defaultVisible).map(c => c.id);
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    localStorage.setItem('spv_visible_columns_store_v2', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Unique list of Korlap for filtering
  const korlapList = Array.from(
    new Set(stores.map(s => getEffectiveKorlap(s)).filter(Boolean))
  ).sort();

  // Unique list of Regions/Kabupaten for filtering derived from master data
  const availableRegions = Array.from(
    new Set(stores.map(s => s.region || s.kabupaten || s.city).filter(Boolean))
  ).sort();

  const filteredStores = stores.filter(s => {
    const searchLower = searchQuery.toLowerCase();
    const effKorlap = getEffectiveKorlap(s);
    const matchesSearch = 
      s.code.toLowerCase().includes(searchLower) ||
      s.name.toLowerCase().includes(searchLower) ||
      (s.city || '').toLowerCase().includes(searchLower) ||
      (s.kabupaten || '').toLowerCase().includes(searchLower) ||
      (s.kecamatan || '').toLowerCase().includes(searchLower) ||
      (s.coverage || '').toLowerCase().includes(searchLower) ||
      effKorlap.toLowerCase().includes(searchLower) ||
      (s.am || '').toLowerCase().includes(searchLower) ||
      (s.as || '').toLowerCase().includes(searchLower);

    const matchesRegion = selectedRegion === 'ALL' || s.region === selectedRegion || s.kabupaten === selectedRegion;
    
    let matchesQm = true;
    if (selectedQm === 'M_Q3') {
      const t = (s.typeSo || s.qm || '').toUpperCase();
      const hasSep = Boolean(s.soSeptember && s.soSeptember !== '-' && s.soSeptember !== '0' && s.soSeptember !== '0-Jan-00' && s.soSeptember.toLowerCase() !== 'belum so');
      matchesQm = t === 'M' || t === 'Q3' || t.startsWith('M') || t.startsWith('Q3') || hasSep;
    } else if (selectedQm === 'SEP_FILLED') {
      matchesQm = Boolean(s.soSeptember && s.soSeptember !== '-' && s.soSeptember !== '0' && s.soSeptember !== '0-Jan-00' && s.soSeptember.toLowerCase() !== 'belum so');
    } else if (selectedQm !== 'ALL') {
      const t = (s.typeSo || s.qm || '').toUpperCase();
      matchesQm = t.includes(selectedQm.toUpperCase());
    }

    const matchesKorlap = selectedKorlap === 'ALL' || effKorlap === selectedKorlap;

    const isBlackZone = isStoreZonaHitam(s);
    const matchesZona = selectedZona === 'ALL' || 
      (selectedZona === 'HITAM' ? isBlackZone : !isBlackZone);

    const storeStatusApprove = getStoreSOApprovalStatus(s, schedules, results);
    const matchesStatusApprove = selectedStatusApprove === 'ALL' || storeStatusApprove === selectedStatusApprove;

    return matchesSearch && matchesRegion && matchesQm && matchesKorlap && matchesZona && matchesStatusApprove;
  });

  const totalPages = Math.ceil(filteredStores.length / pageSize) || 1;
  const paginatedStores = filteredStores.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleColumn = (colId: string) => {
    if (visibleColumns.includes(colId)) {
      if (visibleColumns.length <= 2) return; // Prevent removing all columns
      setVisibleColumns(visibleColumns.filter(id => id !== colId));
    } else {
      setVisibleColumns([...visibleColumns, colId]);
    }
  };

  const applyPreset = (presetCols: string[]) => {
    setVisibleColumns(presetCols);
  };

  const handleExportCSV = () => {
    const data = filteredStores.map(s => ({
      'KDTK': s.code,
      'NAMA': s.name,
      'KOORDINAT': s.koordinat || (s.latitude && s.longitude ? `${s.latitude}, ${s.longitude}` : '-'),
      'SALDO TOKO': typeof s.saldoToko === 'number' ? s.saldoToko : s.saldoToko || '0',
      'AM': s.am || '-',
      'AS': s.as || '-',
      'WILAYAH': s.region || 'BALI',
      'KABUPATEN': s.kabupaten || s.city || '-',
      'COVERAGE': s.coverage || '-',
      'TYPE SO': s.qm || s.typeSo || '-',
      'SO MEI 26': formatSmartSODate(s.tglSoMei),
      'SO JUNI 26': formatSmartSODate(s.tglSoJuni),
      'SO JULI 26': formatSmartSODate(s.tglSoJuli),
      'SO AGUSTUS 26': formatSmartSODate(s.soAgustus),
      'SO SEPTEMBER 26': formatSmartSODate(s.soSeptember || s.tglSoApproved),
      'FREKUENSI TIDAK SO': s.frekuensiTidakSO ?? 0,
      'KETERANGAN': s.keterangan || '-',
      'ZONA': s.zona || (s.isZonaHitam ? 'ZONA HITAM' : 'NON ZONA HITAM'),
      'SO AKTIVA': s.soAktiva || '-'
    }));
    exportToCSV('Master_Toko_Bali_Integrated.csv', data);
  };

  const isColVisible = (colId: string) => visibleColumns.includes(colId);

  return (
    <div className="space-y-4">
      
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-600" />
              Master Data Toko Ritel ({stores.length} Toko)
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
              Integrated Store Master
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Database lengkap lokasi toko ritel, jadwal SO, penanggung jawab Korlap/Officer & koordinat peta
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          
          {/* Smart Auto-Sync Button */}
          <button
            type="button"
            onClick={handleSyncLocations}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-xs transition flex items-center gap-1.5 active:scale-95"
            title="Sinkronkan Kolom Kabupaten & Region Secara Cerdas Berdasarkan Koordinat GPS"
          >
            <Sparkles className="w-4 h-4 text-emerald-200 animate-pulse" />
            <span>Sinkron Wilayah</span>
          </button>

          {/* Select Kolom Button */}
          <button
            type="button"
            onClick={() => setIsColumnModalOpen(true)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-black shadow-xs transition flex items-center gap-1.5 active:scale-95"
            title="Sembunyikan / Tampilkan Kolom Toko Secara Cerdas"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Select Kolom ({visibleColumns.length})</span>
          </button>

          <button
            type="button"
            onClick={onOpenImportModal}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-300 transition flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span>Import Excel / CSV</span>
          </button>

          {onResetMasterStores && (
            <button
              type="button"
              onClick={() => setIsConfirmResetOpen(true)}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-300 transition flex items-center gap-1.5 active:scale-95"
              title="Kosongkan Master Toko & Bersihkan Residu Jadwal"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
              <span>Kosongkan Master</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAddModal}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Toko</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-300 transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Unduh CSV</span>
          </button>
        </div>
      </div>

      {/* Sync Banner Notice */}
      {syncNotice && (
        <div className="bg-emerald-50 border-2 border-emerald-500/80 p-3.5 rounded-xl text-emerald-900 text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{syncNotice}</span>
          </div>
          <button onClick={() => setSyncNotice(null)} className="text-emerald-700 hover:text-emerald-900 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari KD Toko, Nama, Kabupaten, Korlap..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs pl-9 pr-3 py-2 focus:outline-none focus:border-amber-500 font-medium"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          
          {/* Zona Filter */}
          <select
            value={selectedZona}
            onChange={(e) => {
              setSelectedZona(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-2.5 py-2 text-slate-700 font-bold focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">Semua Zona Toko</option>
            <option value="HITAM">🔴 Khusus Toko Zona Hitam ({stores.filter(s => isStoreZonaHitam(s)).length})</option>
            <option value="NON_HITAM">🟢 Non Zona Hitam</option>
          </select>

          <select
            value={selectedKorlap}
            onChange={(e) => {
              setSelectedKorlap(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-2.5 py-2 text-slate-700 font-semibold focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">Semua Korlap / Officer ({korlapList.length})</option>
            {korlapList.map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>

          <select
            value={selectedRegion}
            onChange={(e) => {
              setSelectedRegion(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-2.5 py-2 text-slate-700 font-semibold focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">Semua Kabupaten ({availableRegions.length})</option>
            {availableRegions.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select
            value={selectedQm}
            onChange={(e) => {
              setSelectedQm(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-2.5 py-2 text-slate-700 font-bold focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">Semua Type SO</option>
            <option value="M_Q3">⭐ Wajib SO September (Type M & Q3)</option>
            <option value="M">Type M (Monthly)</option>
            <option value="Q3">Type Q3 (Triwulan 3)</option>
            <option value="Q1">Type Q1 (Triwulan 1)</option>
            <option value="Q2">Type Q2 (Triwulan 2)</option>
            <option value="SEP_FILLED">📅 Terisi Tgl SO September</option>
          </select>

          <select
            value={selectedStatusApprove}
            onChange={(e) => {
              setSelectedStatusApprove(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-2.5 py-2 text-slate-700 font-bold focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">📋 Semua Status Approve SO</option>
            <option value="Sudah Approve">✅ Sudah Approve</option>
            <option value="Belum Terapprove">⏳ Belum Terapprove (Pending)</option>
            <option value="Belum SO">⚪ Belum SO</option>
          </select>

        </div>

      </div>

      {/* Stores Table Container */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        
        {/* Quick Column Presets Bar */}
        <div className="bg-slate-900 text-slate-300 px-4 py-2.5 flex items-center justify-between text-xs flex-wrap gap-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-amber-400" />
            <span className="font-extrabold text-white text-[11px] uppercase tracking-wider">
              Mode Tampilan ({visibleColumns.length} Kolom Aktif):
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {PRESETS.map(preset => {
              const isActive = preset.cols.length === visibleColumns.length && preset.cols.every(c => visibleColumns.includes(c));
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.cols)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 ${
                    isActive 
                      ? 'bg-amber-500 text-white shadow-xs' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {isActive && <Check className="w-3 h-3 text-white" />}
                  <span>{preset.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse min-w-full">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-extrabold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3 text-center w-12 font-mono">NO</th>
                
                {isColVisible('code') && <th className="py-3 px-3 min-w-[90px]">KD TOKO</th>}
                {isColVisible('name') && <th className="py-3 px-3 min-w-[180px]">NAMA TOKO</th>}
                {isColVisible('koordinat') && <th className="py-3 px-3 min-w-[150px]">KOORDINAT</th>}
                {isColVisible('saldoToko') && <th className="py-3 px-3 min-w-[120px] text-right">SALDO TOKO</th>}
                {isColVisible('am') && <th className="py-3 px-3 min-w-[110px]">AM</th>}
                {isColVisible('as') && <th className="py-3 px-3 min-w-[110px]">AS</th>}
                {isColVisible('region') && <th className="py-3 px-3 min-w-[90px]">WILAYAH</th>}
                {isColVisible('kabupaten') && <th className="py-3 px-3 min-w-[120px]">KABUPATEN</th>}
                {isColVisible('kecamatan') && <th className="py-3 px-3 min-w-[120px]">KECAMATAN</th>}
                {isColVisible('coverage') && <th className="py-3 px-3 text-center min-w-[90px]">COVERAGE</th>}
                {isColVisible('qm') && <th className="py-3 px-3 text-center min-w-[70px]">TYPE SO</th>}
                {isColVisible('tglSoMei') && <th className="py-3 px-3 text-center min-w-[95px]">SO MEI '26</th>}
                {isColVisible('tglSoJuni') && <th className="py-3 px-3 text-center min-w-[95px]">SO JUNI '26</th>}
                {isColVisible('tglSoJuli') && <th className="py-3 px-3 text-center min-w-[95px]">SO JULI '26</th>}
                {isColVisible('soAgustus') && <th className="py-3 px-3 text-center min-w-[95px]">SO AGT '26</th>}
                {isColVisible('soSeptember') && <th className="py-3 px-3 text-center min-w-[110px] bg-emerald-50 text-emerald-900 border-b-2 border-emerald-500">SO SEP '26 (AKTIF)</th>}
                {isColVisible('statusApproveSO') && <th className="py-3 px-3 text-center min-w-[140px] bg-indigo-50 text-indigo-950 border-b-2 border-indigo-500">STATUS APPROVE SO</th>}
                {isColVisible('frekuensiTidakSO') && <th className="py-3 px-3 text-center min-w-[100px]">FREKUENSI TDK SO</th>}
                {isColVisible('keterangan') && <th className="py-3 px-3 min-w-[120px]">KETERANGAN</th>}
                {isColVisible('zona') && <th className="py-3 px-3 min-w-[120px]">ZONA</th>}
                {isColVisible('soAktiva') && <th className="py-3 px-3 text-center min-w-[90px]">SO AKTIVA</th>}
                {isColVisible('korlap') && <th className="py-3 px-3 min-w-[120px]">KORLAP/OFFICER</th>}
                {isColVisible('tglSoApproved') && <th className="py-3 px-3 text-center min-w-[120px]">SO APPROVED</th>}
                
                <th className="py-3 px-3 text-right min-w-[100px] sticky right-0 bg-slate-100/90 shadow-2xs">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedStores.length > 0 ? (
                paginatedStores.map((s, idx) => {
                  const globalRowNo = (currentPage - 1) * pageSize + idx + 1;
                  const formattedSaldo = typeof s.saldoToko === 'number' 
                    ? `Rp ${s.saldoToko.toLocaleString('id-ID')}` 
                    : (s.saldoToko ? `Rp ${s.saldoToko}` : '-');

                  const isZonaHitam = isStoreZonaHitam(s);

                  return (
                    <tr 
                      key={s.id} 
                      className={`hover:bg-amber-50/40 transition font-medium ${
                        isZonaHitam ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      
                      {/* NO */}
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">
                        {globalRowNo}
                      </td>

                      {/* KD TOKO */}
                      {isColVisible('code') && (
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-950 bg-amber-50/20">
                          <div className="flex items-center gap-1.5">
                            {isZonaHitam && (
                              <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" title="Toko Zona Hitam (High-Risk)" />
                            )}
                            <span>{s.code}</span>
                          </div>
                        </td>
                      )}

                      {/* NAMA TOKO */}
                      {isColVisible('name') && (
                        <td className="py-2.5 px-3">
                          <span className="font-extrabold text-slate-900 block">
                            {s.name}
                          </span>
                        </td>
                      )}

                      {/* KOORDINAT */}
                      {isColVisible('koordinat') && (
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 truncate max-w-[160px]" title={s.koordinat || ''}>
                          {s.koordinat || (s.latitude && s.longitude ? `${s.latitude}, ${s.longitude}` : '-')}
                        </td>
                      )}

                      {/* SALDO TOKO */}
                      {isColVisible('saldoToko') && (
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                          {formattedSaldo}
                        </td>
                      )}

                      {/* AM */}
                      {isColVisible('am') && (
                        <td className="py-2.5 px-3 text-slate-800">
                          {s.am || '-'}
                        </td>
                      )}

                      {/* AS */}
                      {isColVisible('as') && (
                        <td className="py-2.5 px-3 text-slate-800">
                          {s.as || '-'}
                        </td>
                      )}

                      {/* WILAYAH */}
                      {isColVisible('region') && (
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {s.region || 'BALI'}
                        </td>
                      )}

                      {/* KABUPATEN */}
                      {isColVisible('kabupaten') && (
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {s.kabupaten || s.city || '-'}
                        </td>
                      )}

                      {/* KECAMATAN */}
                      {isColVisible('kecamatan') && (
                        <td className="py-2.5 px-3 text-slate-800">
                          {s.kecamatan || s.district || '-'}
                        </td>
                      )}

                      {/* COVERAGE */}
                      {isColVisible('coverage') && (
                        <td className="py-2.5 px-3 text-center">
                          {s.coverage ? (
                            <span className="px-2 py-0.5 rounded font-black text-[10px] bg-slate-100 border border-slate-300 text-slate-800">
                              {s.coverage}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono text-[11px] select-none">-</span>
                          )}
                        </td>
                      )}

                      {/* TYPE SO (Q/M) */}
                      {isColVisible('qm') && (
                        <td className="py-2.5 px-3 text-center">
                          {s.qm || s.typeSo ? (
                            <span className="px-2 py-0.5 rounded font-black text-[10px] bg-slate-100 border border-slate-300 text-slate-800">
                              {s.qm || s.typeSo}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono text-[11px] select-none">-</span>
                          )}
                        </td>
                      )}

                      {/* TGL SO MEI */}
                      {isColVisible('tglSoMei') && (
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600">
                          {formatSmartSODate(s.tglSoMei)}
                        </td>
                      )}

                      {/* TGL SO JUNI */}
                      {isColVisible('tglSoJuni') && (
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600">
                          {formatSmartSODate(s.tglSoJuni)}
                        </td>
                      )}

                      {/* TGL SO JULI */}
                      {isColVisible('tglSoJuli') && (
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600">
                          {formatSmartSODate(s.tglSoJuli)}
                        </td>
                      )}

                      {/* SO AGUSTUS */}
                      {isColVisible('soAgustus') && (
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] font-bold text-amber-900 bg-amber-50/50">
                          {formatSmartSODate(s.soAgustus)}
                        </td>
                      )}

                      {/* SO SEPTEMBER '26 (BULAN AKTIF / AUTO FILL SETELAH APPROVAL) */}
                      {isColVisible('soSeptember') && (
                        <td className="py-2.5 px-3 text-center bg-emerald-50/40">
                          {s.soSeptember || s.tglSoApproved ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-900 font-mono text-[11px] font-black inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {formatSmartSODate(s.soSeptember || s.tglSoApproved)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">-</span>
                          )}
                        </td>
                      )}

                      {/* STATUS APPROVE SO (SUDAH APPROVE / BELUM TERAPPROVE / BELUM SO) */}
                      {isColVisible('statusApproveSO') && (
                        <td className="py-2.5 px-3 text-center">
                          {(() => {
                            const status = getStoreSOApprovalStatus(s, schedules, results);
                            if (status === 'Sudah Approve') {
                              return (
                                <span className="px-2.5 py-1 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Sudah Approve
                                </span>
                              );
                            } else if (status === 'Belum Terapprove') {
                              return (
                                <span className="px-2.5 py-1 rounded-md bg-amber-100 border border-amber-300 text-amber-900 font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  Belum Terapprove
                                </span>
                              );
                            } else {
                              return (
                                <span className="px-2.5 py-0.5 rounded text-slate-500 bg-slate-100 border border-slate-200 font-medium text-[10px]">
                                  Belum SO
                                </span>
                              );
                            }
                          })()}
                        </td>
                      )}

                      {/* FREKUENSI TIDAK SO */}
                      {isColVisible('frekuensiTidakSO') && (
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded font-black text-[11px] ${
                            (s.frekuensiTidakSO ?? 0) >= 3 
                              ? 'bg-rose-100 text-rose-800 border border-rose-300 font-black' 
                              : (s.frekuensiTidakSO ?? 0) > 0
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {s.frekuensiTidakSO ?? 0}
                          </span>
                        </td>
                      )}

                      {/* KETERANGAN */}
                      {isColVisible('keterangan') && (
                        <td className="py-2.5 px-3">
                          {s.keterangan ? (
                            <span className="text-slate-800 font-bold uppercase text-[10px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {s.keterangan}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono text-[11px] select-none">-</span>
                          )}
                        </td>
                      )}

                      {/* ZONA (HITAM / NON) */}
                      {isColVisible('zona') && (
                        <td className="py-2.5 px-3">
                          {isZonaHitam ? (
                            <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-rose-600 text-rose-300 font-black text-[10px] inline-flex items-center gap-1 shadow-xs uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              ZONA HITAM
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 uppercase">
                              NON ZONA
                            </span>
                          )}
                        </td>
                      )}

                      {/* SO AKTIVA */}
                      {isColVisible('soAktiva') && (
                        <td className="py-2.5 px-3 text-center font-mono text-slate-700 text-[11px]">
                          {s.soAktiva || '-'}
                        </td>
                      )}

                      {/* KORLAP/OFFICER */}
                      {isColVisible('korlap') && (
                        <td className="py-2.5 px-3">
                          {getEffectiveKorlap(s) !== '-' ? (
                            <span className="font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg text-[11px] inline-flex items-center gap-1 shadow-2xs">
                              {getEffectiveKorlap(s)}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono text-[11px] select-none">-</span>
                          )}
                        </td>
                      )}

                      {/* TGL SO APPROVED (SPV) */}
                      {isColVisible('tglSoApproved') && (
                        <td className="py-2.5 px-3 text-center">
                          {s.tglSoApproved || s.lastSODate ? (
                            <span className="px-2 py-1 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 font-mono text-[11px] font-black inline-flex items-center gap-1 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {formatSmartSODate(s.tglSoApproved || s.lastSODate)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px] font-medium">Belum SO</span>
                          )}
                        </td>
                      )}

                      {/* AKSI */}
                      <td className="py-2.5 px-3 text-right sticky right-0 bg-white shadow-2xs">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectStore(s)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                            title="Lihat Detail Toko"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditStore(s)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded transition"
                            title="Edit Toko"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setStoreToDelete(s)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Hapus Toko"
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
                  <td colSpan={visibleColumns.length + 2} className="py-12 text-center text-slate-400 font-medium">
                    Tidak ditemukan data toko yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 gap-3">
          <div>
            Menampilkan <strong className="text-slate-900">{paginatedStores.length}</strong> dari <strong className="text-slate-900">{filteredStores.length}</strong> toko
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-slate-800">
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition shadow-2xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Select Column Modal */}
      {isColumnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 px-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-extrabold text-base">Select & Custom Kolom Master Toko</h3>
                  <p className="text-[11px] text-slate-400">Atur kolom yang ingin ditampilkan agar tabel tidak terlalu panjang</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsColumnModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar">
              
              {/* Quick Preset Selector */}
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
                  1. Mode Preset Praktis & Cerdas:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PRESETS.map(preset => {
                    const isSelected = preset.cols.length === visibleColumns.length && preset.cols.every(c => visibleColumns.includes(c));
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset.cols)}
                        className={`p-3 rounded-xl border text-left transition flex items-start justify-between gap-2 ${
                          isSelected 
                            ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20' 
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <span className="font-extrabold text-xs text-slate-900 block">{preset.name}</span>
                          <span className="text-[10px] text-slate-500">{preset.desc}</span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Individual Column Checklist by Category */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                    2. Toggle Kolom Individu ({visibleColumns.length} dipilih):
                  </label>
                  <button
                    type="button"
                    onClick={() => setVisibleColumns(ALL_STORE_COLUMNS.map(c => c.id))}
                    className="text-[11px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Pilih Semua</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {(['Identitas', 'Lokasi', 'Penanggung Jawab', 'Jadwal SO', 'Status & Keuangan'] as const).map(cat => {
                    const catCols = ALL_STORE_COLUMNS.filter(c => c.category === cat);
                    return (
                      <div key={cat} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block border-b border-slate-200/60 pb-1">
                          Kategori {cat}
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {catCols.map(col => {
                            const isChecked = visibleColumns.includes(col.id);
                            return (
                              <label
                                key={col.id}
                                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border text-xs font-bold transition select-none ${
                                  isChecked 
                                    ? 'bg-amber-50/80 border-amber-300 text-amber-950' 
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleColumn(col.id)}
                                  className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 border-slate-300"
                                />
                                <span>{col.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                Pilihan disave otomatis ke browser
              </span>
              <button
                type="button"
                onClick={() => setIsColumnModalOpen(false)}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-black shadow-sm transition active:scale-95"
              >
                Terapkan Tampilan
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Confirmation Modal for Store Deletion */}
      <ConfirmDeleteModal
        isOpen={!!storeToDelete}
        onClose={() => setStoreToDelete(null)}
        onConfirm={() => {
          if (storeToDelete) {
            onDeleteStore(storeToDelete.id);
            setToastMessage(`Toko ${storeToDelete.name} (${storeToDelete.code}) berhasil dihapus dari database!`);
            setStoreToDelete(null);
          }
        }}
        title="Hapus Master Toko"
        subtitle="Apakah Anda yakin ingin menghapus toko ini?"
        itemName={storeToDelete ? `${storeToDelete.code} - ${storeToDelete.name}` : undefined}
        itemDetails={storeToDelete ? [
          { label: 'Kabupaten/Wilayah', value: storeToDelete.region || storeToDelete.kabupaten || storeToDelete.city || '-' },
          { label: 'Zona Toko', value: storeToDelete.zona || (storeToDelete.isZonaHitam ? 'ZONA HITAM' : 'NON ZONA HITAM') },
          { label: 'Type SO', value: storeToDelete.qm || storeToDelete.typeSo || '-' },
          { label: 'Korlap Assigned', value: getEffectiveKorlap(storeToDelete) }
        ] : []}
        confirmText="Ya, Hapus Toko"
        dangerBadgeText="Data toko ini akan dihapus permanen dari database master."
      />

      {/* Confirmation Modal for Resetting Master */}
      <ConfirmDeleteModal
        isOpen={isConfirmResetOpen}
        onClose={() => setIsConfirmResetOpen(false)}
        onConfirm={() => {
          setIsConfirmResetOpen(false);
          if (onResetMasterStores) {
            onResetMasterStores();
            setToastMessage('Master Toko berhasil dikosongkan dan residu jadwal dibersihkan secara tuntas!');
          }
        }}
        title="Kosongkan Master Toko & Bersihkan Residu"
        subtitle="Apakah Anda yakin ingin mengosongkan seluruh data Master Toko?"
        itemName={`${stores.length} Toko Terdaftar`}
        itemDetails={[
          { label: 'Total Toko', value: `${stores.length} Toko` },
          { label: 'Aksi Pembersihan', value: 'Hapus master toko & bersihkan jadwal unapproved' },
          { label: 'Data Aman', value: 'Riwayat hasil audit SO yang sudah disetujui SPV tetap tersimpan aman' }
        ]}
        confirmText="Ya, Kosongkan Master"
        dangerBadgeText="Tindakan ini mengosongkan master toko dan jadwal yang belum disetujui agar Anda dapat upload master baru secara bersih."
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

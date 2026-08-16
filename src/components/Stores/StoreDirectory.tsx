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
  CheckCircle2
} from 'lucide-react';
import { Store, SOSchedule, RegionArea, StoreType } from '../../types/stockOpname';
import { REGIONS } from '../../data/initialData';
import { getRiskBadgeClass, formatDateIndo, formatSmartSODate } from '../../utils/formatters';
import { exportToCSV } from '../../services/storageService';
import { autoSyncStoreRegionAndKabupaten } from '../../utils/geoUtils';
import { ConfirmDeleteModal } from '../Common/ConfirmDeleteModal';
import { ToastNotification } from '../Common/ToastNotification';

interface StoreDirectoryProps {
  stores: Store[];
  schedules?: SOSchedule[];
  onOpenAddModal: () => void;
  onOpenImportModal: () => void;
  onSelectStore: (store: Store) => void;
  onEditStore: (store: Store) => void;
  onDeleteStore: (storeId: string) => void;
  onBulkUpdateStores?: (updatedStores: Store[]) => void;
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
  { id: 'kecamatan', label: 'KECAMATAN', category: 'Lokasi', defaultVisible: true },
  { id: 'kabupaten', label: 'KABUPATEN', category: 'Lokasi', defaultVisible: true },
  { id: 'am', label: 'AM', category: 'Penanggung Jawab', defaultVisible: false },
  { id: 'as', label: 'AS', category: 'Penanggung Jawab', defaultVisible: false },
  { id: 'korlap', label: 'KORLAP/OFFICER', category: 'Penanggung Jawab', defaultVisible: true },
  { id: 'saldoToko', label: 'SALDO TOKO', category: 'Status & Keuangan', defaultVisible: true },
  { id: 'qm', label: 'Q/M', category: 'Jadwal SO', defaultVisible: false },
  { id: 'tglSoMei', label: 'TGL SO MEI', category: 'Jadwal SO', defaultVisible: false },
  { id: 'tglSoJuni', label: 'TGL SO JUNI', category: 'Jadwal SO', defaultVisible: false },
  { id: 'tglSoJuli', label: 'TGL SO JULI', category: 'Jadwal SO', defaultVisible: false },
  { id: 'soAgustus', label: 'SO BULAN INI', category: 'Jadwal SO', defaultVisible: true },
  { id: 'tglSoApproved', label: 'SO APPROVED (SPV)', category: 'Jadwal SO', defaultVisible: true },
  { id: 'smartClassification', label: 'KRITERIA CERDAS', category: 'Identitas', defaultVisible: true },
  { id: 'keterangan', label: 'KETERANGAN', category: 'Status & Keuangan', defaultVisible: false },
  { id: 'jenisToko', label: 'JENIS TOKO', category: 'Identitas', defaultVisible: true },
  { id: 'jop', label: 'JOP', category: 'Status & Keuangan', defaultVisible: false },
  { id: 'storeType', label: 'TIPE TOKO (RITEL)', category: 'Identitas', defaultVisible: false },
  { id: 'riskLevel', label: 'LEVEL RISIKO', category: 'Status & Keuangan', defaultVisible: false },
  { id: 'totalSKUCount', label: 'TOTAL SKU', category: 'Status & Keuangan', defaultVisible: false },
  { id: 'lastAccuracyRate', label: 'AKURASI LAST SO', category: 'Status & Keuangan', defaultVisible: false }
];

const PRESETS = [
  {
    id: 'ringkas',
    name: 'Ringkas (Default)',
    desc: 'Tampilan esensial & bersih',
    cols: ['code', 'name', 'kabupaten', 'korlap', 'saldoToko', 'jenisToko']
  },
  {
    id: 'jadwal',
    name: 'Jadwal SO Mei - Agt',
    desc: 'Monitoring tanggal SO per bulan',
    cols: ['code', 'name', 'qm', 'tglSoMei', 'tglSoJuni', 'tglSoJuli', 'soAgustus', 'korlap', 'keterangan']
  },
  {
    id: 'lokasi',
    name: 'Detail Lokasi & Area',
    desc: 'Koordinat, Kecamatan, AM, AS',
    cols: ['code', 'name', 'koordinat', 'kecamatan', 'kabupaten', 'am', 'as', 'jenisToko']
  },
  {
    id: 'keuangan',
    name: 'Finansial & Stok',
    desc: 'Saldo Toko, SKU, Akurasi & Risiko',
    cols: ['code', 'name', 'saldoToko', 'jenisToko', 'totalSKUCount', 'riskLevel', 'lastAccuracyRate']
  },
  {
    id: 'semua',
    name: 'Tampilkan Semua Kolom',
    desc: 'Semua 20+ atribut data lengkap',
    cols: ALL_STORE_COLUMNS.map(c => c.id)
  }
];

export const StoreDirectory: React.FC<StoreDirectoryProps> = ({
  stores,
  schedules,
  onOpenAddModal,
  onOpenImportModal,
  onSelectStore,
  onEditStore,
  onDeleteStore,
  onBulkUpdateStores
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedRisk, setSelectedRisk] = useState('ALL');
  const [selectedKorlap, setSelectedKorlap] = useState('ALL');
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Smart Criteria Categorizer Modal state
  const [isCategorizerOpen, setIsCategorizerOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);
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

  const handleRunCategorization = () => {
    let flagshipCount = 0;
    let highVolCount = 0;
    let medVolCount = 0;
    let standardCount = 0;

    const updated = stores.map(s => {
      const saldo = typeof s.saldoToko === 'number' ? s.saldoToko : parseFloat(String(s.saldoToko || 0).replace(/[^0-9.]/g, '')) || 0;
      const jns = (s.jenisToko || s.storeType || '').toUpperCase();

      let classification = 'Standard Retail Outlet';
      if (saldo >= 500000000 || jns.includes('SUPERMARKET') || jns.includes('HYPERMARKET')) {
        classification = 'Flagship Supermarket (High Inventory)';
        flagshipCount++;
      } else if (saldo >= 200000000 || jns.includes('LARGE') || jns.includes('BIG')) {
        classification = 'High-Volume Outlet';
        highVolCount++;
      } else if (saldo >= 50000000 || jns.includes('STANDART')) {
        classification = 'Medium Volume Outlet';
        medVolCount++;
      } else {
        classification = 'Compact Outlet';
        standardCount++;
      }

      return {
        ...s,
        smartClassification: classification
      };
    });

    if (onBulkUpdateStores) {
      onBulkUpdateStores(updated);
    }

    setSyncNotice(
      `⚡ Klasifikasi Cerdas Selesai! ${updated.length} Toko berhasil dikategorikan secara otomatis: ` +
      `🏆 Flagship Supermarket (${flagshipCount}), 💎 High-Volume (${highVolCount}), 🏪 Medium Volume (${medVolCount}), 🏬 Compact (${standardCount}).`
    );
    setIsCategorizerOpen(false);
    setTimeout(() => setSyncNotice(null), 8000);
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
      effKorlap.toLowerCase().includes(searchLower) ||
      (s.am || '').toLowerCase().includes(searchLower) ||
      (s.as || '').toLowerCase().includes(searchLower);

    const matchesRegion = selectedRegion === 'ALL' || s.region === selectedRegion;
    const matchesType = selectedType === 'ALL' || s.storeType === selectedType;
    const matchesRisk = selectedRisk === 'ALL' || s.riskLevel === selectedRisk;
    const matchesKorlap = selectedKorlap === 'ALL' || effKorlap === selectedKorlap;

    return matchesSearch && matchesRegion && matchesType && matchesRisk && matchesKorlap;
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
      'KD TOKO': s.code,
      'NAMA': s.name,
      'KOORDINAT': s.koordinat || (s.latitude && s.longitude ? `${s.latitude}, ${s.longitude}` : '-'),
      'AM': s.am || '-',
      'AS': s.as || '-',
      'SALDO TOKO': typeof s.saldoToko === 'number' ? s.saldoToko : s.saldoToko || '0',
      'KECAMATAN': s.kecamatan || s.district || '-',
      'KABUPATEN': s.kabupaten || s.city || '-',
      'Q/M': s.qm || '-',
      'TGL SO MEI': formatSmartSODate(s.tglSoMei),
      'TGL SO JUNI': formatSmartSODate(s.tglSoJuni),
      'TGL SO JULI': formatSmartSODate(s.tglSoJuli),
      'SO BULAN INI (APPROVED SPV)': formatSmartSODate(s.tglSoApproved || s.soAgustus || s.lastSODate),
      'STATUS APPROVAL SO': (s.tglSoApproved || s.lastSODate) ? 'DISETUJUI SPV' : 'BELUM SO',
      'KORLAP/OFFICER': getEffectiveKorlap(s),
      'KETERANGAN': s.keterangan || '-',
      'JENIS TOKO': s.jenisToko || s.storeType,
      'KLASIFIKASI KRITERIA': s.smartClassification || 'Standard Retail',
      'JOP': s.jop !== undefined ? s.jop : '0'
    }));
    exportToCSV('Master_Toko_Bali_Approved.csv', data);
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
          
          {/* Smart AI Criteria Categorizer Button */}
          <button
            type="button"
            onClick={() => setIsCategorizerOpen(true)}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-black shadow-xs transition flex items-center gap-1.5 active:scale-95"
            title="Analisis & Klasifikasi Cerdas Kriteria Toko Berdasarkan Saldo & Tipe"
          >
            <Sparkles className="w-4 h-4 text-purple-200 animate-pulse" />
            <span>Klasifikasi Cerdas</span>
          </button>

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
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-2.5 py-2 text-slate-700 font-semibold focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">Semua Jenis / Tipe Toko</option>
            <option value="Regular Minimarket">Regular Minimarket</option>
            <option value="Flagship Supermarket">Flagship Supermarket</option>
            <option value="Express Outlet">Express Outlet</option>
            <option value="Distribution Hub Center">Distribution Hub Center</option>
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
                {isColVisible('am') && <th className="py-3 px-3 min-w-[110px]">AM</th>}
                {isColVisible('as') && <th className="py-3 px-3 min-w-[110px]">AS</th>}
                {isColVisible('saldoToko') && <th className="py-3 px-3 min-w-[120px] text-right">SALDO TOKO</th>}
                {isColVisible('kecamatan') && <th className="py-3 px-3 min-w-[120px]">KECAMATAN</th>}
                {isColVisible('kabupaten') && <th className="py-3 px-3 min-w-[120px]">KABUPATEN</th>}
                {isColVisible('qm') && <th className="py-3 px-3 text-center min-w-[60px]">Q/M</th>}
                {isColVisible('tglSoMei') && <th className="py-3 px-3 text-center min-w-[95px]">TGL SO MEI</th>}
                {isColVisible('tglSoJuni') && <th className="py-3 px-3 text-center min-w-[95px]">TGL SO JUNI</th>}
                {isColVisible('tglSoJuli') && <th className="py-3 px-3 text-center min-w-[95px]">TGL SO JULI</th>}
                {isColVisible('soAgustus') && <th className="py-3 px-3 text-center min-w-[95px]">SO AGUSTUS</th>}
                {isColVisible('korlap') && <th className="py-3 px-3 min-w-[120px]">KORLAP/OFFICER</th>}
                {isColVisible('keterangan') && <th className="py-3 px-3 min-w-[100px]">KETERANGAN</th>}
                {isColVisible('jenisToko') && <th className="py-3 px-3 min-w-[130px]">JENIS TOKO</th>}
                {isColVisible('jop') && <th className="py-3 px-3 text-center min-w-[60px]">JOP</th>}
                
                {isColVisible('storeType') && <th className="py-3 px-3 min-w-[140px]">TIPE RITEL</th>}
                {isColVisible('riskLevel') && <th className="py-3 px-3 min-w-[100px]">RISIKO</th>}
                {isColVisible('totalSKUCount') && <th className="py-3 px-3 min-w-[100px] text-right">TOTAL SKU</th>}
                {isColVisible('lastAccuracyRate') && <th className="py-3 px-3 min-w-[110px] text-right">AKURASI SO</th>}
                
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

                  return (
                    <tr key={s.id} className="hover:bg-amber-50/40 transition font-medium">
                      
                      {/* NO */}
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">
                        {globalRowNo}
                      </td>

                      {/* KD TOKO */}
                      {isColVisible('code') && (
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-950 bg-amber-50/20">
                          {s.code}
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

                      {/* SALDO TOKO */}
                      {isColVisible('saldoToko') && (
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                          {formattedSaldo}
                        </td>
                      )}

                      {/* KECAMATAN */}
                      {isColVisible('kecamatan') && (
                        <td className="py-2.5 px-3 text-slate-800">
                          {s.kecamatan || s.district || '-'}
                        </td>
                      )}

                      {/* KABUPATEN */}
                      {isColVisible('kabupaten') && (
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {s.kabupaten || s.city || '-'}
                        </td>
                      )}

                      {/* Q/M */}
                      {isColVisible('qm') && (
                        <td className="py-2.5 px-3 text-center">
                          {s.qm ? (
                            <span className="px-2 py-0.5 rounded font-black text-[10px] bg-slate-100 border border-slate-300 text-slate-800">
                              {s.qm}
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

                      {/* SO BULAN INI */}
                      {isColVisible('soAgustus') && (
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] font-bold text-amber-900 bg-amber-50/50">
                          {formatSmartSODate(s.soAgustus)}
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

                      {/* KRITERIA CERDAS */}
                      {isColVisible('smartClassification') && (
                        <td className="py-2.5 px-3">
                          {s.smartClassification ? (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              s.smartClassification.includes('Flagship')
                                ? 'bg-purple-100 border-purple-300 text-purple-900'
                                : s.smartClassification.includes('High-Volume')
                                ? 'bg-indigo-100 border-indigo-300 text-indigo-900'
                                : s.smartClassification.includes('Medium')
                                ? 'bg-blue-100 border-blue-300 text-blue-900'
                                : 'bg-slate-100 border-slate-300 text-slate-800'
                            }`}>
                              {s.smartClassification}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono text-[11px] select-none">-</span>
                          )}
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

                      {/* KETERANGAN */}
                      {isColVisible('keterangan') && (
                        <td className="py-2.5 px-3">
                          {s.keterangan ? (
                            <span className="text-emerald-800 font-extrabold uppercase text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {s.keterangan}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono text-[11px] select-none">-</span>
                          )}
                        </td>
                      )}

                      {/* JENIS TOKO */}
                      {isColVisible('jenisToko') && (
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {s.jenisToko || '-'}
                        </td>
                      )}

                      {/* JOP */}
                      {isColVisible('jop') && (
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                          {s.jop !== undefined && s.jop !== '' ? s.jop : '-'}
                        </td>
                      )}

                      {/* TIPE TOKO (RITEL) */}
                      {isColVisible('storeType') && (
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-medium text-slate-700">
                            {s.storeType}
                          </span>
                        </td>
                      )}

                      {/* LEVEL RISIKO */}
                      {isColVisible('riskLevel') && (
                        <td className="py-2.5 px-3">
                          {s.riskLevel ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskBadgeClass(s.riskLevel)}`}>
                              {s.riskLevel}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono text-[11px] select-none">-</span>
                          )}
                        </td>
                      )}

                      {/* TOTAL SKU */}
                      {isColVisible('totalSKUCount') && (
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {s.totalSKUCount !== undefined && s.totalSKUCount !== null && !isNaN(s.totalSKUCount) 
                            ? s.totalSKUCount.toLocaleString('id-ID') 
                            : '-'}
                        </td>
                      )}

                      {/* AKURASI LAST SO */}
                      {isColVisible('lastAccuracyRate') && (
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {s.lastAccuracyRate !== undefined && s.lastAccuracyRate !== null && !isNaN(s.lastAccuracyRate) 
                            ? `${s.lastAccuracyRate}%` 
                            : '-'}
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

      {/* Smart AI Criteria Categorizer Modal */}
      {isCategorizerOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-purple-600">
                <Sparkles className="w-6 h-6 text-purple-600 animate-pulse" />
                <div>
                  <h3 className="font-black text-base text-slate-900">Klasifikasi Cerdas Kriteria Toko</h3>
                  <p className="text-xs text-slate-500">Mesin Analisis Otomatis Nilai Saldo, SKU & Jenis Toko</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCategorizerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p className="leading-relaxed">
                Sistem secara cerdas membaca data master toko yang Anda unggah/impor, kemudian mengelompokkan toko secara dinamis berdasarkan parameter risiko dan finansial berikut:
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1">
                  <span className="font-extrabold text-purple-900 block">🏆 Flagship Supermarket</span>
                  <p className="text-[11px] text-purple-700">Saldo ≥ Rp 500 Juta / Supermarket</p>
                </div>

                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1">
                  <span className="font-extrabold text-indigo-900 block">💎 High-Volume Outlet</span>
                  <p className="text-[11px] text-indigo-700">Saldo Rp 200 Juta - 500 Juta</p>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                  <span className="font-extrabold text-blue-900 block">🏪 Medium Volume Outlet</span>
                  <p className="text-[11px] text-blue-700">Saldo Rp 50 Juta - 200 Juta</p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="font-extrabold text-slate-900 block">🏬 Compact Outlet</span>
                  <p className="text-[11px] text-slate-600">Saldo &lt; Rp 50 Juta / Express</p>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
                <strong className="font-bold flex items-center gap-1 text-amber-900">
                  ⚡ Penyesuaian Dinamis Master Berubah:
                </strong>
                <p className="text-[11px] leading-relaxed">
                  Apabila terdapat file master baru yang Anda upload di kemudian hari dengan perubahan kriteria/format kolom, alat ini secara otomatis mengadaptasi kriteria tanpa perlu koding ulang!
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCategorizerOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRunCategorization}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-purple-200" />
                <span>Jalankan Klasifikasi Cerdas</span>
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
          { label: 'Tipe Toko', value: storeToDelete.storeType },
          { label: 'Total SKU', value: `${storeToDelete.totalSKUCount} SKU` },
          { label: 'Korlap Assigned', value: storeToDelete.assignedOfficerName || '-' }
        ] : []}
        confirmText="Ya, Hapus Toko"
        dangerBadgeText="Data toko ini akan dihapus permanen dari database master."
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

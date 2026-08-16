import React, { useState, useEffect } from 'react';
import { Shirt, Plus, Download, Search, Cloud, Trash2, Edit3, CheckCircle2, Sparkles, Filter, Save, Layers, AlertCircle, X, Check } from 'lucide-react';
import { UniformRecord, AuditorPersonnel } from '../../types/stockOpname';
import { uploadRawJsonToCloudinary, getFormattedDateSuffix } from '../../services/cloudinaryService';
import { 
  saveUniformRecords, 
  subscribeFirestoreData,
  getDeterministicUniformId,
  deduplicateEntityList
} from '../../services/storageService';

interface UniformTrackerProps {
  personnelList?: AuditorPersonnel[];
}

const DEFAULT_UNIFORM_RECORDS: UniformRecord[] = [
  {
    id: 'unif-1',
    batchTitle: 'Stok Masuk Gudang Utama Denpasar',
    category: 'Seragam Baru',
    sizeS: 10,
    sizeM: 25,
    sizeL: 30,
    sizeXL: 20,
    sizeXXL: 10,
    sizeXXXL: 5,
    totalQty: 100,
    receivedDate: '2026-08-01',
    notes: 'Penerimaan stok seragam baru rompi & polo shirt dari pusat',
    createdAt: '2026-08-01T08:30:00Z'
  },
  {
    id: 'unif-2',
    batchTitle: 'Rekap Sisa Stok Seragam Lama Periode Lalu',
    category: 'Seragam Lama',
    sizeS: 5,
    sizeM: 15,
    sizeL: 20,
    sizeXL: 10,
    sizeXXL: 5,
    sizeXXXL: 0,
    totalQty: 55,
    receivedDate: '2025-09-15',
    notes: 'Rekapitulasi sisa seragam lama di gudang penyimpanan operasional',
    createdAt: '2025-09-15T10:00:00Z'
  }
];

export const getInitialUniformRecords = (): UniformRecord[] => {
  const local = localStorage.getItem('spv_uniform_records_v2') || localStorage.getItem('spv_uniform_records');
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.error('Error parsing uniform records:', e);
    }
  }
  return DEFAULT_UNIFORM_RECORDS;
};

export const UniformTracker: React.FC<UniformTrackerProps> = () => {
  const [records, setRecords] = useState<UniformRecord[]>(getInitialUniformRecords);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'Seragam Baru' | 'Seragam Lama'>('ALL');
  
  // Modals & Confirmation States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<UniformRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<UniformRecord | null>(null);
  
  // Notification / Backup status
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccessMsg, setBackupSuccessMsg] = useState('');
  const [formError, setFormError] = useState('');

  // Form states
  const [batchTitle, setBatchTitle] = useState('');
  const [category, setCategory] = useState<'Seragam Baru' | 'Seragam Lama'>('Seragam Baru');
  const [sizeS, setSizeS] = useState(0);
  const [sizeM, setSizeM] = useState(0);
  const [sizeL, setSizeL] = useState(0);
  const [sizeXL, setSizeXL] = useState(0);
  const [sizeXXL, setSizeXXL] = useState(0);
  const [sizeXXXL, setSizeXXXL] = useState(0);
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Subscribe to real-time updates from Firestore
  useEffect(() => {
    const unsub = subscribeFirestoreData({
      onUniforms: (firestoreData) => {
        if (Array.isArray(firestoreData)) {
          setRecords(firestoreData);
        }
      }
    });
    return () => unsub();
  }, []);

  const saveToStorageAndSync = (data: UniformRecord[]) => {
    setRecords(data);
    saveUniformRecords(data);
  };

  const handleOpenModal = (rec?: UniformRecord) => {
    setFormError('');
    if (rec) {
      setEditingRecord(rec);
      setBatchTitle(rec.batchTitle || rec.personnelName || rec.notes || '');
      setCategory(rec.category);
      setSizeS(rec.sizeS || 0);
      setSizeM(rec.sizeM || 0);
      setSizeL(rec.sizeL || 0);
      setSizeXL(rec.sizeXL || 0);
      setSizeXXL(rec.sizeXXL || 0);
      setSizeXXXL(rec.sizeXXXL || 0);
      setReceivedDate(rec.receivedDate || new Date().toISOString().split('T')[0]);
      setNotes(rec.notes || '');
    } else {
      setEditingRecord(null);
      setBatchTitle('');
      setCategory('Seragam Baru');
      setSizeS(0);
      setSizeM(0);
      setSizeL(0);
      setSizeXL(0);
      setSizeXXL(0);
      setSizeXXXL(0);
      setReceivedDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    }
    setIsModalOpen(true);
  };

  const triggerCloudinaryBackup = async (currentData: UniformRecord[]) => {
    setIsBackingUp(true);
    try {
      const backupPayload = {
        title: 'Rekapitulasi Global Stok Seragam SDM SO Bali',
        timestamp: new Date().toISOString(),
        totalRecords: currentData.length,
        records: currentData
      };
      const res = await uploadRawJsonToCloudinary(backupPayload, `Uniform_Global_Backup_${Date.now()}.json`);
      if (res && res.secure_url) {
        setBackupSuccessMsg('Data tersimpan & ter-backup ke Cloudinary CDN & Cloud Database!');
      } else {
        setBackupSuccessMsg('Data berhasil tersimpan di Cloud Database & Penyimpanan Lokal.');
      }
    } catch (err) {
      console.error('Cloudinary backup error:', err);
      setBackupSuccessMsg('Data berhasil tersimpan di Penyimpanan Lokal.');
    } finally {
      setIsBackingUp(false);
      setTimeout(() => setBackupSuccessMsg(''), 4500);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!batchTitle.trim()) {
      setFormError('Mohon isi Judul Batch / Lokasi / Keterangan Stok!');
      return;
    }

    const qtyS = Number(sizeS) || 0;
    const qtyM = Number(sizeM) || 0;
    const qtyL = Number(sizeL) || 0;
    const qtyXL = Number(sizeXL) || 0;
    const qtyXXL = Number(sizeXXL) || 0;
    const qtyXXXL = Number(sizeXXXL) || 0;

    const totalQty = qtyS + qtyM + qtyL + qtyXL + qtyXXL + qtyXXXL;
    if (totalQty <= 0) {
      setFormError('Mohon isi jumlah Qty seragam (minimal 1 Pcs)!');
      return;
    }

    let updatedList: UniformRecord[];
    if (editingRecord) {
      updatedList = records.map(r => r.id === editingRecord.id ? {
        ...r,
        batchTitle: batchTitle.trim(),
        category,
        sizeS: qtyS,
        sizeM: qtyM,
        sizeL: qtyL,
        sizeXL: qtyXL,
        sizeXXL: qtyXXL,
        sizeXXXL: qtyXXXL,
        totalQty,
        receivedDate,
        notes: notes.trim()
      } : r);
    } else {
      const deterministicId = getDeterministicUniformId({ category, batchTitle: batchTitle.trim(), receivedDate });
      const newRec: UniformRecord = {
        id: deterministicId,
        batchTitle: batchTitle.trim(),
        category,
        sizeS: qtyS,
        sizeM: qtyM,
        sizeL: qtyL,
        sizeXL: qtyXL,
        sizeXXL: qtyXXL,
        sizeXXXL: qtyXXXL,
        totalQty,
        receivedDate,
        notes: notes.trim(),
        createdAt: new Date().toISOString()
      };
      updatedList = [newRec, ...records];
    }

    const { deduplicated: cleanList } = deduplicateEntityList('uniform_records', updatedList);
    saveToStorageAndSync(cleanList);
    setIsModalOpen(false);
    setEditingRecord(null);

    // Auto backup asynchronously
    await triggerCloudinaryBackup(cleanList);
  };

  const confirmDeleteRecord = async () => {
    if (!deletingRecord) return;
    const targetId = deletingRecord.id;
    const updated = records.filter(r => r.id !== targetId);
    saveToStorageAndSync(updated);
    setDeletingRecord(null);
    setBackupSuccessMsg('Catatan stok seragam berhasil dihapus.');
    await triggerCloudinaryBackup(updated);
  };

  const handleExportCSV = () => {
    const headers = ['NO', 'KATEGORI SERAGAM', 'JUDUL BATCH / LOKASI STOK', 'SIZE S', 'SIZE M', 'SIZE L', 'SIZE XL', 'SIZE XXL', 'SIZE XXXL', 'TOTAL QTY (PCS)', 'TANGGAL PENCATATAN', 'CATATAN'];
    const rows = filteredRecords.map((r, idx) => [
      idx + 1,
      `"${r.category}"`,
      `"${(r.batchTitle || r.personnelName || 'Stok Batch').replace(/"/g, '""')}"`,
      r.sizeS,
      r.sizeM,
      r.sizeL,
      r.sizeXL,
      r.sizeXXL,
      r.sizeXXXL,
      r.totalQty,
      r.receivedDate,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rekap_Stok_Global_Seragam_SO_${getFormattedDateSuffix()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRecords = records.filter(r => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = (r.batchTitle || '').toLowerCase().includes(searchLower) ||
                          (r.personnelName || '').toLowerCase().includes(searchLower) ||
                          (r.notes || '').toLowerCase().includes(searchLower) ||
                          r.category.toLowerCase().includes(searchLower);
    const matchesCat = categoryFilter === 'ALL' || r.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  // Global Size Breakdown Calculations for Seragam Baru
  const baruRecords = records.filter(r => r.category === 'Seragam Baru');
  const totalBaru = baruRecords.reduce((acc, curr) => acc + (curr.totalQty || 0), 0);
  const baruS = baruRecords.reduce((acc, c) => acc + (c.sizeS || 0), 0);
  const baruM = baruRecords.reduce((acc, c) => acc + (c.sizeM || 0), 0);
  const baruL = baruRecords.reduce((acc, c) => acc + (c.sizeL || 0), 0);
  const baruXL = baruRecords.reduce((acc, c) => acc + (c.sizeXL || 0), 0);
  const baruXXL = baruRecords.reduce((acc, c) => acc + (c.sizeXXL || 0), 0);
  const baruXXXL = baruRecords.reduce((acc, c) => acc + (c.sizeXXXL || 0), 0);

  // Global Size Breakdown Calculations for Seragam Lama
  const lamaRecords = records.filter(r => r.category === 'Seragam Lama');
  const totalLama = lamaRecords.reduce((acc, curr) => acc + (curr.totalQty || 0), 0);
  const lamaS = lamaRecords.reduce((acc, c) => acc + (c.sizeS || 0), 0);
  const lamaM = lamaRecords.reduce((acc, c) => acc + (c.sizeM || 0), 0);
  const lamaL = lamaRecords.reduce((acc, c) => acc + (c.sizeL || 0), 0);
  const lamaXL = lamaRecords.reduce((acc, c) => acc + (c.sizeXL || 0), 0);
  const lamaXXL = lamaRecords.reduce((acc, c) => acc + (c.sizeXXL || 0), 0);
  const lamaXXXL = lamaRecords.reduce((acc, c) => acc + (c.sizeXXXL || 0), 0);

  const grandTotal = totalBaru + totalLama;

  return (
    <div className="space-y-5">
      
      {/* Header Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-800 text-[10px] font-bold uppercase tracking-wider mb-1.5">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Pendataan Stok Global Seragam SDM
          </div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Shirt className="w-5 h-5 text-amber-600" />
            Rekapitulasi Global Seragam Baru & Seragam Lama
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pendataan persediaan stok seragam secara terpusat berdasarkan kategori Seragam Baru dan Seragam Lama per ukuran (S, M, L, XL, XXL, XXXL)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-stretch md:self-auto">
          <button
            type="button"
            onClick={() => triggerCloudinaryBackup(records)}
            disabled={isBackingUp}
            className="px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Sinkronisasi Backup Manual ke Cloudinary CDN"
          >
            <Cloud className={`w-3.5 h-3.5 text-sky-600 ${isBackingUp ? 'animate-spin' : ''}`} />
            <span>{isBackingUp ? 'Memproses Backup...' : 'Backup Cloudinary'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Unduh CSV Stok</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-black transition flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Input Stok Seragam</span>
          </button>
        </div>
      </div>

      {backupSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold">{backupSuccessMsg}</span>
        </div>
      )}

      {/* Global Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: Seragam Baru */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider">
              Seragam Baru (Global)
            </span>
            <Shirt className="w-5 h-5 text-emerald-600" />
          </div>

          <div>
            <div className="text-2xl font-black text-emerald-950">
              {totalBaru} <span className="text-xs font-bold text-slate-500">Pcs</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Total persediaan seragam kondisi baru</p>
          </div>

          {/* Breakdown per size */}
          <div className="pt-2 border-t border-emerald-100 grid grid-cols-6 gap-1 text-center">
            <div className="bg-emerald-50/80 p-1 rounded">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">S</span>
              <span className="text-xs font-black text-emerald-900">{baruS}</span>
            </div>
            <div className="bg-emerald-50/80 p-1 rounded">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">M</span>
              <span className="text-xs font-black text-emerald-900">{baruM}</span>
            </div>
            <div className="bg-emerald-50/80 p-1 rounded">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">L</span>
              <span className="text-xs font-black text-emerald-900">{baruL}</span>
            </div>
            <div className="bg-emerald-50/80 p-1 rounded">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">XL</span>
              <span className="text-xs font-black text-emerald-900">{baruXL}</span>
            </div>
            <div className="bg-emerald-50/80 p-1 rounded">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">XXL</span>
              <span className="text-xs font-black text-emerald-900">{baruXXL}</span>
            </div>
            <div className="bg-emerald-50/80 p-1 rounded">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">XXXL</span>
              <span className="text-xs font-black text-emerald-900">{baruXXXL}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Seragam Lama */}
        <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-2xs space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase tracking-wider">
              Seragam Lama (Global)
            </span>
            <Layers className="w-5 h-5 text-indigo-600" />
          </div>

          <div>
            <div className="text-2xl font-black text-indigo-950">
              {totalLama} <span className="text-xs font-bold text-slate-500">Pcs</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Total persediaan seragam periode sebelumnya</p>
          </div>

          {/* Breakdown per size */}
          <div className="pt-2 border-t border-indigo-100 grid grid-cols-6 gap-1 text-center">
            <div className="bg-indigo-50/80 p-1 rounded">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">S</span>
              <span className="text-xs font-black text-indigo-900">{lamaS}</span>
            </div>
            <div className="bg-indigo-50/80 p-1 rounded">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">M</span>
              <span className="text-xs font-black text-indigo-900">{lamaM}</span>
            </div>
            <div className="bg-indigo-50/80 p-1 rounded">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">L</span>
              <span className="text-xs font-black text-indigo-900">{lamaL}</span>
            </div>
            <div className="bg-indigo-50/80 p-1 rounded">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">XL</span>
              <span className="text-xs font-black text-indigo-900">{lamaXL}</span>
            </div>
            <div className="bg-indigo-50/80 p-1 rounded">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">XXL</span>
              <span className="text-xs font-black text-indigo-900">{lamaXXL}</span>
            </div>
            <div className="bg-indigo-50/80 p-1 rounded">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">XXXL</span>
              <span className="text-xs font-black text-indigo-900">{lamaXXXL}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Grand Total */}
        <div className="bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900 p-4 rounded-2xl text-white shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 rounded bg-white/20 border border-white/30 text-white text-[10px] font-black uppercase tracking-wider">
              Total Keseluruhan Stok
            </span>
            <Shirt className="w-5 h-5 text-amber-200" />
          </div>

          <div>
            <div className="text-3xl font-black text-white">
              {grandTotal} <span className="text-sm font-normal text-amber-200">Pcs</span>
            </div>
            <p className="text-[11px] text-amber-100 mt-1">
              Gabungan stok Seragam Baru ({totalBaru} pcs) + Seragam Lama ({totalLama} pcs)
            </p>
          </div>

          <div className="pt-2 border-t border-white/20 text-[11px] text-amber-100 flex items-center justify-between font-medium">
            <span>Jumlah Catatan Batch:</span>
            <span className="font-extrabold text-white bg-white/20 px-2 py-0.5 rounded">{records.length} Batch</span>
          </div>
        </div>

      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari Batch, Lokasi Stok, Keterangan..."
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-amber-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setCategoryFilter('ALL')}
              className={`px-3 py-1 rounded-md transition ${categoryFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              Semua Kategori ({records.length})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('Seragam Baru')}
              className={`px-3 py-1 rounded-md transition ${categoryFilter === 'Seragam Baru' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'}`}
            >
              Seragam Baru
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('Seragam Lama')}
              className={`px-3 py-1 rounded-md transition ${categoryFilter === 'Seragam Lama' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600'}`}
            >
              Seragam Lama
            </button>
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">No</th>
                <th className="p-3">Kategori Seragam</th>
                <th className="p-3">Judul Batch / Lokasi Stok</th>
                <th className="p-3 text-center">S</th>
                <th className="p-3 text-center">M</th>
                <th className="p-3 text-center">L</th>
                <th className="p-3 text-center">XL</th>
                <th className="p-3 text-center">XXL</th>
                <th className="p-3 text-center">XXXL</th>
                <th className="p-3 text-center font-black text-slate-900">Total Qty</th>
                <th className="p-3">Tanggal Input</th>
                <th className="p-3">Catatan</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-400">
                    Belum ada data rekapan stok seragam yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold border ${
                        r.category === 'Seragam Baru' 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                          : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                      }`}>
                        {r.category}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="font-extrabold text-slate-900 block">
                        {r.batchTitle || r.personnelName || 'Batch Stok Seragam'}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-slate-700">{r.sizeS || '-'}</td>
                    <td className="p-3 text-center font-mono font-bold text-slate-700">{r.sizeM || '-'}</td>
                    <td className="p-3 text-center font-mono font-bold text-slate-700">{r.sizeL || '-'}</td>
                    <td className="p-3 text-center font-mono font-bold text-slate-700">{r.sizeXL || '-'}</td>
                    <td className="p-3 text-center font-mono font-bold text-slate-700">{r.sizeXXL || '-'}</td>
                    <td className="p-3 text-center font-mono font-bold text-slate-700">{r.sizeXXXL || '-'}</td>
                    <td className="p-3 text-center font-black text-amber-950 bg-amber-50/50">{r.totalQty} pcs</td>
                    <td className="p-3 font-mono text-slate-600 text-[11px]">{r.receivedDate}</td>
                    <td className="p-3 text-slate-500 max-w-xs truncate">{r.notes || '-'}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenModal(r)}
                          className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded transition flex items-center gap-1 font-bold text-[11px]"
                          title="Edit Catatan Stok"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingRecord(r)}
                          className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded transition flex items-center gap-1 font-bold text-[11px]"
                          title="Hapus Catatan Stok"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="bg-amber-600 p-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Shirt className="w-5 h-5" />
                <h3 className="font-extrabold text-base">
                  {editingRecord ? 'Edit Catatan Stok Seragam' : 'Input Rekap Stok Seragam Global'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white text-sm font-bold p-1 rounded hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
              
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-bold">{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kategori Seragam <span className="text-rose-500">*</span>:
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as 'Seragam Baru' | 'Seragam Lama')}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-extrabold text-slate-900 focus:outline-none focus:border-amber-500"
                >
                  <option value="Seragam Baru">Seragam Baru</option>
                  <option value="Seragam Lama">Seragam Lama</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Judul Batch / Lokasi / Keterangan Stok <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={batchTitle}
                  onChange={(e) => setBatchTitle(e.target.value)}
                  placeholder="misal: Stok Masuk Gudang Utama Denpasar"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-medium focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tanggal Pencatatan / Penerimaan:
                </label>
                <input
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Sizes Breakdown Input Grid */}
              <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2.5">
                <label className="block text-xs font-extrabold text-amber-950">
                  Input Qty Berdasarkan Ukuran (Pcs):
                </label>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 text-center uppercase">Size S</span>
                    <input
                      type="number"
                      min="0"
                      value={sizeS}
                      onChange={(e) => setSizeS(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-white border border-amber-300 rounded p-1.5 text-center text-xs font-extrabold focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 text-center uppercase">Size M</span>
                    <input
                      type="number"
                      min="0"
                      value={sizeM}
                      onChange={(e) => setSizeM(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-white border border-amber-300 rounded p-1.5 text-center text-xs font-extrabold focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 text-center uppercase">Size L</span>
                    <input
                      type="number"
                      min="0"
                      value={sizeL}
                      onChange={(e) => setSizeL(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-white border border-amber-300 rounded p-1.5 text-center text-xs font-extrabold focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 text-center uppercase">Size XL</span>
                    <input
                      type="number"
                      min="0"
                      value={sizeXL}
                      onChange={(e) => setSizeXL(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-white border border-amber-300 rounded p-1.5 text-center text-xs font-extrabold focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 text-center uppercase">Size XXL</span>
                    <input
                      type="number"
                      min="0"
                      value={sizeXXL}
                      onChange={(e) => setSizeXXL(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-white border border-amber-300 rounded p-1.5 text-center text-xs font-extrabold focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 text-center uppercase">Size XXXL</span>
                    <input
                      type="number"
                      min="0"
                      value={sizeXXXL}
                      onChange={(e) => setSizeXXXL(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-white border border-amber-300 rounded p-1.5 text-center text-xs font-extrabold focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs border-t border-amber-200">
                  <span className="font-bold text-amber-900">Total Qty Seragam:</span>
                  <span className="font-black text-amber-950 text-sm bg-white px-2.5 py-0.5 rounded border border-amber-300">
                    {Number(sizeS) + Number(sizeM) + Number(sizeL) + Number(sizeXL) + Number(sizeXXL) + Number(sizeXXXL)} Pcs
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Tambahan (Opsional):
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="misal: Penerimaan rompi & polo dari pengiriman batch #2"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-medium focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Save Controls */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-black shadow-sm transition flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingRecord ? 'Simpan Perubahan' : 'Simpan & Auto Backup'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deletingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Hapus Catatan Stok Seragam?</h3>
                <p className="text-xs text-slate-500 mt-0.5">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div className="font-extrabold text-slate-900">
                {deletingRecord.batchTitle || deletingRecord.personnelName || 'Batch Seragam'}
              </div>
              <div className="text-slate-600">
                Kategori: <span className="font-bold">{deletingRecord.category}</span> ({deletingRecord.totalQty} pcs)
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingRecord(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteRecord}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black shadow-sm transition flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

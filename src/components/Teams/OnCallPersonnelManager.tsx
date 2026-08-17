import React, { useState, useMemo } from 'react';
import { 
  PhoneCall, 
  UserPlus, 
  Calendar, 
  Search, 
  Filter, 
  Download, 
  Share2, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ShieldAlert, 
  Users, 
  MapPin, 
  Sparkles,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';
import { 
  OnCallPersonnelRecord, 
  AuditorPersonnel, 
  UserRole, 
  RegionArea, 
  StandbyStatus 
} from '../../types/stockOpname';
import { exportToExcelWithBackup } from '../../services/storageService';
import { SearchablePersonnelSelect } from '../Common/SearchablePersonnelSelect';

interface OnCallPersonnelManagerProps {
  onCallRecords: OnCallPersonnelRecord[];
  personnelList: AuditorPersonnel[];
  currentRole: UserRole;
  onUpdateOnCallRecords?: (records: OnCallPersonnelRecord[]) => void | Promise<void>;
  onSaveRecords?: (records: OnCallPersonnelRecord[]) => Promise<void>;
  onClose?: () => void;
}

const REGION_OPTIONS: RegionArea[] = [
  'Kota Denpasar',
  'Kab. Badung',
  'Kab. Gianyar',
  'Kab. Tabanan',
  'Kab. Buleleng',
  'Kab. Karangasem',
  'Kab. Jembrana',
  'Kab. Klungkung',
  'Kab. Bangli',
  'Kota Mataram & Lombok'
];

const SHIFT_TYPES = [
  'Full Day (08:00 - 17:00)',
  'Shift Pagi (07:00 - 15:00)',
  'Shift Siang/Sore (14:00 - 22:00)',
  'Shift Malam (21:00 - 05:00)',
  'Standby 24 Jam'
];

const STANDBY_STATUSES: StandbyStatus[] = [
  'Siap Standby',
  'On-Call Aktif',
  'Terpanggil Tugas',
  'Selesai',
  'Batal / Sakit'
];

export const OnCallPersonnelManager: React.FC<OnCallPersonnelManagerProps> = ({
  onCallRecords,
  personnelList,
  currentRole,
  onUpdateOnCallRecords,
  onSaveRecords,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [selectedKorlap, setSelectedKorlap] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Safe handler to save records
  const handleSaveRecords = async (records: OnCallPersonnelRecord[]) => {
    if (typeof onUpdateOnCallRecords === 'function') {
      await onUpdateOnCallRecords(records);
    }
    if (typeof onSaveRecords === 'function') {
      await onSaveRecords(records);
    }
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OnCallPersonnelRecord | null>(null);
  const [copiedWA, setCopiedWA] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    date: string;
    holidayName: string;
    korlapName: string;
    region: string;
    personnelId: string;
    shiftType: string;
    standbyStatus: StandbyStatus;
    assignedStoreOrArea: string;
    notes: string;
  }>({
    date: new Date().toISOString().split('T')[0],
    holidayName: 'Hari Libur / Weekend',
    korlapName: 'Angga',
    region: 'Kota Denpasar',
    personnelId: '',
    shiftType: 'Full Day (08:00 - 17:00)',
    standbyStatus: 'Siap Standby',
    assignedStoreOrArea: '',
    notes: ''
  });

  // Extract unique Korlaps
  const korlapList = useMemo(() => {
    const list = Array.from(new Set(personnelList.map(p => p.korlapName).filter(Boolean))) as string[];
    if (list.length === 0) return ['Angga', 'Pasek', 'Odi', 'Wawan', 'Gean Pratama'];
    return list;
  }, [personnelList]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return onCallRecords.filter(r => {
      if (selectedRegion !== 'ALL' && r.region !== selectedRegion) return false;
      if (selectedKorlap !== 'ALL' && r.korlapName !== selectedKorlap) return false;
      if (selectedStatus !== 'ALL' && r.standbyStatus !== selectedStatus) return false;
      if (selectedDate && r.date !== selectedDate) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = r.personnelName.toLowerCase().includes(q);
        const matchNik = (r.personnelNik || '').toLowerCase().includes(q);
        const matchStore = (r.assignedStoreOrArea || '').toLowerCase().includes(q);
        const matchNotes = (r.notes || '').toLowerCase().includes(q);
        const matchHoliday = (r.holidayName || '').toLowerCase().includes(q);
        if (!matchName && !matchNik && !matchStore && !matchNotes && !matchHoliday) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [onCallRecords, selectedRegion, selectedKorlap, selectedStatus, selectedDate, searchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = filteredRecords.length;
    const siap = filteredRecords.filter(r => r.standbyStatus === 'Siap Standby').length;
    const aktif = filteredRecords.filter(r => r.standbyStatus === 'On-Call Aktif').length;
    const terpanggil = filteredRecords.filter(r => r.standbyStatus === 'Terpanggil Tugas').length;
    const selesai = filteredRecords.filter(r => r.standbyStatus === 'Selesai').length;
    const batal = filteredRecords.filter(r => r.standbyStatus === 'Batal / Sakit').length;
    return { total, siap, aktif, terpanggil, selesai, batal };
  }, [filteredRecords]);

  // Smart Search Recommendations
  const smartSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const suggestions: Array<{
      id: string;
      title: string;
      subtitle: string;
      badge: string;
      queryFill: string;
    }> = [];

    const added = new Set<string>();

    // 1. Matches from existing on-call records
    onCallRecords.forEach(r => {
      const matchName = r.personnelName.toLowerCase().includes(q);
      const matchNik = (r.personnelNik || '').toLowerCase().includes(q);
      const matchStore = (r.assignedStoreOrArea || '').toLowerCase().includes(q);
      if (matchName || matchNik || matchStore) {
        const key = `rec_${r.personnelName}`;
        if (!added.has(key)) {
          added.add(key);
          suggestions.push({
            id: r.id,
            title: r.personnelName,
            subtitle: `NIK: ${r.personnelNik || '-'} • Korlap: ${r.korlapName} • ${r.standbyStatus}`,
            badge: 'Jadwal On-Call',
            queryFill: r.personnelName
          });
        }
      }
    });

    // 2. Matches from master personnel database
    personnelList.forEach(p => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchNik = (p.nik || '').toLowerCase().includes(q);
      const matchRole = (p.role || '').toLowerCase().includes(q);
      if (matchName || matchNik || matchRole) {
        const key = `personnel_${p.name}`;
        if (!added.has(key)) {
          added.add(key);
          suggestions.push({
            id: p.id,
            title: p.name,
            subtitle: `NIK: ${p.nik || '-'} • ${p.role || 'Auditor'} • Korlap: ${p.korlapName || '-'}`,
            badge: 'Master SDM',
            queryFill: p.name
          });
        }
      }
    });

    return suggestions.slice(0, 6);
  }, [searchQuery, onCallRecords, personnelList]);

  // Open modal create
  const handleOpenCreate = () => {
    setEditingRecord(null);
    setFormData({
      date: selectedDate || new Date().toISOString().split('T')[0],
      holidayName: 'Hari Libur / Weekend',
      korlapName: korlapList[0] || 'Angga',
      region: REGION_OPTIONS[0],
      personnelId: personnelList[0]?.id || '',
      shiftType: 'Full Day (08:00 - 17:00)',
      standbyStatus: 'Siap Standby',
      assignedStoreOrArea: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  // Open modal edit
  const handleOpenEdit = (rec: OnCallPersonnelRecord) => {
    setEditingRecord(rec);
    setFormData({
      date: rec.date,
      holidayName: rec.holidayName || '',
      korlapName: rec.korlapName,
      region: rec.region || REGION_OPTIONS[0],
      personnelId: rec.personnelId,
      shiftType: rec.shiftType || 'Full Day (08:00 - 17:00)',
      standbyStatus: rec.standbyStatus,
      assignedStoreOrArea: rec.assignedStoreOrArea || '',
      notes: rec.notes || ''
    });
    setIsModalOpen(true);
  };

  // Quick Status update
  const handleQuickStatusChange = async (recId: string, newStatus: StandbyStatus) => {
    const updated = onCallRecords.map(r => {
      if (r.id === recId) {
        return { ...r, standbyStatus: newStatus, updatedAt: new Date().toISOString() };
      }
      return r;
    });
    await handleSaveRecords(updated);
  };

  // Delete
  const handleDelete = async (recId: string) => {
    if (!window.confirm('Hapus personil ini dari daftar On-Call?')) return;
    const updated = onCallRecords.filter(r => r.id !== recId);
    await handleSaveRecords(updated);
  };

  // Submit modal form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pObj = personnelList.find(p => p.id === formData.personnelId);
    const pName = pObj ? pObj.name : 'Personil On-Call';
    const pNik = pObj?.nik || '';
    const pPhone = pObj?.phone || '';
    const pRole = pObj?.role || 'Anggota SO';

    if (editingRecord) {
      const updated = onCallRecords.map(r => {
        if (r.id === editingRecord.id) {
          return {
            ...r,
            date: formData.date,
            holidayName: formData.holidayName,
            korlapName: formData.korlapName,
            region: formData.region,
            personnelId: formData.personnelId,
            personnelName: pName,
            personnelNik: pNik,
            personnelPhone: pPhone,
            role: pRole,
            shiftType: formData.shiftType,
            standbyStatus: formData.standbyStatus,
            assignedStoreOrArea: formData.assignedStoreOrArea,
            notes: formData.notes,
            updatedAt: new Date().toISOString()
          };
        }
        return r;
      });
      await handleSaveRecords(updated);
    } else {
      const newRec: OnCallPersonnelRecord = {
        id: `oncall-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        date: formData.date,
        holidayName: formData.holidayName,
        korlapName: formData.korlapName,
        region: formData.region,
        personnelId: formData.personnelId,
        personnelName: pName,
        personnelNik: pNik,
        personnelPhone: pPhone,
        role: pRole,
        shiftType: formData.shiftType,
        standbyStatus: formData.standbyStatus,
        assignedStoreOrArea: formData.assignedStoreOrArea,
        notes: formData.notes,
        createdAt: new Date().toISOString()
      };
      await handleSaveRecords([newRec, ...onCallRecords]);
    }

    setIsModalOpen(false);
  };

  // Export Excel
  const handleExportExcel = () => {
    const exportData = filteredRecords.map((r, idx) => ({
      'No': idx + 1,
      'Tanggal On-Call': r.date,
      'Keterangan Hari Libur': r.holidayName || '-',
      'Korlap Penanggung Jawab': r.korlapName,
      'Wilayah / Area': r.region || '-',
      'NIK Personil': r.personnelNik || '-',
      'Nama Personil': r.personnelName,
      'No. HP / WA': r.personnelPhone || '-',
      'Jabatan': r.role || '-',
      'Jenis Shift': r.shiftType || '-',
      'Status Standby': r.standbyStatus,
      'Toko / Area Antisipasi': r.assignedStoreOrArea || '-',
      'Catatan': r.notes || '-'
    }));

    exportToExcelWithBackup(
      `Daftar_Personil_OnCall_${selectedDate || 'Semua_Tanggal'}.xlsx`,
      'Rekap_OnCall_Personil',
      exportData
    );
  };

  // Copy WA Format
  const handleCopyWA = () => {
    let msg = `📋 *DAFTAR PERSONIL ON-CALL & STANDBY SO IC BALI*\n`;
    if (selectedDate) msg += `📅 Tanggal: *${selectedDate}*\n`;
    if (selectedKorlap !== 'ALL') msg += `👔 Korlap: *${selectedKorlap}*\n`;
    if (selectedRegion !== 'ALL') msg += `📍 Wilayah: *${selectedRegion}*\n`;
    msg += `-----------------------------------------\n`;

    if (filteredRecords.length === 0) {
      msg += `Belum ada personil on-call terdaftar.\n`;
    } else {
      filteredRecords.forEach((r, idx) => {
        const badge = r.standbyStatus === 'Terpanggil Tugas' ? '🚨 [TERPANGGIL]' : 
                      r.standbyStatus === 'On-Call Aktif' ? '⚡ [ON-CALL]' : 
                      r.standbyStatus === 'Selesai' ? '✅ [SELESAI]' : '🟢 [SIAP STANDBY]';
        msg += `${idx + 1}. *${r.personnelName}* (${r.personnelNik || '-'}) ${badge}\n`;
        msg += `   • Shift: ${r.shiftType || 'Full Day'}\n`;
        msg += `   • Korlap/Wilayah: ${r.korlapName} / ${r.region || '-'}\n`;
        msg += `   • No. WA: ${r.personnelPhone || '-'}\n`;
        if (r.assignedStoreOrArea) msg += `   • Area/Toko: ${r.assignedStoreOrArea}\n`;
        if (r.notes) msg += `   • Catatan: ${r.notes}\n`;
        msg += `\n`;
      });
    }

    msg += `-----------------------------------------\n`;
    msg += `_Diperbarui otomatis via Portal SO IC Bali_`;

    navigator.clipboard.writeText(msg);
    setCopiedWA(true);
    setTimeout(() => setCopiedWA(false), 2500);
  };

  const getStatusBadgeClass = (status: StandbyStatus) => {
    switch (status) {
      case 'Siap Standby':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 'On-Call Aktif':
        return 'bg-blue-50 text-blue-700 border-blue-300 animate-pulse';
      case 'Terpanggil Tugas':
        return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'Selesai':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'Batal / Sakit':
        return 'bg-rose-50 text-rose-700 border-rose-300';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-emerald-950 text-white p-6 rounded-2xl border border-emerald-800/60 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 translate-x-8 -translate-y-8 pointer-events-none">
          <PhoneCall className="w-64 h-64 text-emerald-400" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <PhoneCall className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Manajemen Personil On-Call & Standby
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-emerald-200/80 max-w-2xl">
              Pengaturan kesiapan personil auditor pada hari libur, tanggal merah, atau kebutuhan cadangan darurat penugasan SO IC Wilayah Bali & Sekitarnya.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyWA}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600/40 hover:bg-emerald-600/60 text-emerald-200 border border-emerald-500/40 text-xs font-bold transition active:scale-95"
            >
              {copiedWA ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copiedWA ? 'Tersalin!' : 'Salin Format WA'}</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold transition active:scale-95"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md shadow-emerald-500/20 transition active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Tambah Personil On-Call</span>
            </button>
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 mt-6 pt-5 border-t border-emerald-800/50">
          <div className="p-2.5 bg-slate-900/60 rounded-xl border border-emerald-500/20">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Terdaftar</span>
            <p className="text-lg font-black text-white">{metrics.total}</p>
          </div>
          <div className="p-2.5 bg-emerald-950/60 rounded-xl border border-emerald-500/30">
            <span className="text-[10px] uppercase font-bold text-emerald-300">Siap Standby</span>
            <p className="text-lg font-black text-emerald-400">{metrics.siap}</p>
          </div>
          <div className="p-2.5 bg-blue-950/60 rounded-xl border border-blue-500/30">
            <span className="text-[10px] uppercase font-bold text-blue-300">On-Call Aktif</span>
            <p className="text-lg font-black text-blue-400">{metrics.aktif}</p>
          </div>
          <div className="p-2.5 bg-amber-950/60 rounded-xl border border-amber-500/30">
            <span className="text-[10px] uppercase font-bold text-amber-300">Terpanggil</span>
            <p className="text-lg font-black text-amber-400">{metrics.terpanggil}</p>
          </div>
          <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-700/50">
            <span className="text-[10px] uppercase font-bold text-slate-400">Selesai</span>
            <p className="text-lg font-black text-slate-300">{metrics.selesai}</p>
          </div>
          <div className="p-2.5 bg-rose-950/60 rounded-xl border border-rose-500/30">
            <span className="text-[10px] uppercase font-bold text-rose-300">Batal / Sakit</span>
            <p className="text-lg font-black text-rose-400">{metrics.batal}</p>
          </div>
        </div>
      </div>

      {/* Filters & Search Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        
        {/* Smart Search Bar with Autocomplete Suggestions */}
        <div className="relative flex-1 min-w-[280px]">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 transition">
            <Search className="w-4 h-4 text-emerald-600 shrink-0" />
            <input
              type="text"
              placeholder="Cari cerdas: Nama Personil, NIK, Area / Toko, Korlap, Catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              className="w-full bg-transparent border-none outline-hidden text-slate-800 placeholder-slate-400 text-xs font-medium"
            />
            {searchQuery && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchFocused(false);
                }} 
                className="text-slate-400 hover:text-slate-600 font-bold px-1"
              >
                ×
              </button>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
              <Sparkles className="w-2.5 h-2.5" />
              Smart Search
            </span>
          </div>

          {/* Smart Autocomplete Dropdown */}
          {isSearchFocused && smartSuggestions.length > 0 && (
            <div 
              className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden divide-y divide-slate-100"
              onMouseDown={(e) => e.preventDefault()} // Prevent blur before click
            >
              <div className="p-2 bg-slate-50 flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Rekomendasi Cerdas ({smartSuggestions.length})
                </span>
                <span className="text-slate-400 font-normal">Klik untuk filter</span>
              </div>
              {smartSuggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSearchQuery(item.queryFill);
                    setIsSearchFocused(false);
                  }}
                  className="w-full text-left p-2.5 hover:bg-emerald-50/60 transition flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                      <span>{item.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {item.subtitle}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                    {item.badge}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Filter Tanggal */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 border border-slate-200 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-xs text-slate-700 outline-hidden font-medium"
            />
            {selectedDate && (
              <button 
                onClick={() => setSelectedDate('')}
                className="text-[10px] text-rose-600 font-bold px-1 hover:bg-rose-50 rounded"
              >
                Reset
              </button>
            )}
          </div>

          {/* Filter Wilayah */}
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium"
          >
            <option value="ALL">Semua Wilayah</option>
            {REGION_OPTIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Filter Korlap */}
          <select
            value={selectedKorlap}
            onChange={(e) => setSelectedKorlap(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium"
          >
            <option value="ALL">Semua Korlap</option>
            {korlapList.map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>

          {/* Filter Status */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium"
          >
            <option value="ALL">Semua Status</option>
            {STANDBY_STATUSES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              Daftar Personil On-Call Terjadwal ({filteredRecords.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Realtime Auto-Sync Cloud Firestore & Cloudinary
          </span>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
              <PhoneCall className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700">Belum ada data Personil On-Call</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Silakan tambahkan personil yang dijadwalkan standby pada tanggal libur atau akhir pekan.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>Tambah Personil Sekarang</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3.5">Tanggal / Hari</th>
                  <th className="py-3 px-3.5">Personil & NIK</th>
                  <th className="py-3 px-3.5">Korlap & Wilayah</th>
                  <th className="py-3 px-3.5">Shift Operasional</th>
                  <th className="py-3 px-3.5">Status Kesiapan</th>
                  <th className="py-3 px-3.5">Toko / Area Antisipasi</th>
                  <th className="py-3 px-3.5">Catatan</th>
                  <th className="py-3 px-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition group">
                    {/* Tanggal */}
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-900 font-mono">{r.date}</div>
                      <div className="text-[10px] text-emerald-700 font-medium">{r.holidayName || 'Hari Libur'}</div>
                    </td>

                    {/* Personil */}
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{r.personnelName}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="font-mono">{r.personnelNik || '-'}</span>
                        {r.personnelPhone && (
                          <a 
                            href={`https://wa.me/${r.personnelPhone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-600 hover:underline font-mono"
                          >
                            📱 {r.personnelPhone}
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Korlap & Region */}
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-indigo-700">{r.korlapName}</div>
                      <div className="text-[10px] text-slate-500">{r.region || '-'}</div>
                    </td>

                    {/* Shift */}
                    <td className="py-3 px-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                        {r.shiftType || 'Full Day'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${getStatusBadgeClass(r.standbyStatus)}`}>
                          {r.standbyStatus}
                        </span>
                        
                        {/* Quick Action Selector */}
                        <select
                          value={r.standbyStatus}
                          onChange={(e) => handleQuickStatusChange(r.id, e.target.value as StandbyStatus)}
                          className="text-[9px] bg-white border border-slate-200 rounded px-1 py-0.5 text-slate-600 cursor-pointer"
                        >
                          {STANDBY_STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* Area Antisipasi */}
                    <td className="py-3 px-3.5">
                      <div className="text-slate-800 font-medium">
                        {r.assignedStoreOrArea || <span className="text-slate-400 italic">Standby Seluruh Area</span>}
                      </div>
                    </td>

                    {/* Notes */}
                    <td className="py-3 px-3.5">
                      <div className="text-slate-600 text-[11px] max-w-xs truncate" title={r.notes || ''}>
                        {r.notes || '-'}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(r)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Edit Data"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Personil On-Call */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <PhoneCall className="w-5 h-5" />
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  {editingRecord ? 'Edit Personil On-Call' : 'Tambah Personil On-Call Baru'}
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Tanggal */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Tanggal Standby *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-mono"
                  />
                </div>

                {/* Nama Hari Libur */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Keterangan Hari Libur
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Libur Minggu / Cuti Bersama"
                    value={formData.holidayName}
                    onChange={(e) => setFormData({ ...formData, holidayName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Korlap */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Korlap Penanggung Jawab *
                  </label>
                  <select
                    required
                    value={formData.korlapName}
                    onChange={(e) => setFormData({ ...formData, korlapName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-medium"
                  >
                    {korlapList.map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>

                {/* Wilayah */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Wilayah / Area *
                  </label>
                  <select
                    required
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-medium"
                  >
                    {REGION_OPTIONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pilih Personil (Smart Search & Recommendations) */}
              <SearchablePersonnelSelect
                personnel={personnelList}
                selectedPersonnelId={formData.personnelId}
                onSelectPersonnel={(p) => {
                  if (p) {
                    setFormData({
                      ...formData,
                      personnelId: p.id,
                      korlapName: p.korlapName || formData.korlapName
                    });
                  }
                }}
                label="Pilih Personil Auditor"
                allowCustom={false}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Jenis Shift */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Tipe Shift *
                  </label>
                  <select
                    required
                    value={formData.shiftType}
                    onChange={(e) => setFormData({ ...formData, shiftType: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-medium"
                  >
                    {SHIFT_TYPES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Status Kesiapan */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Status Standby *
                  </label>
                  <select
                    required
                    value={formData.standbyStatus}
                    onChange={(e) => setFormData({ ...formData, standbyStatus: e.target.value as StandbyStatus })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-black text-emerald-800"
                  >
                    {STANDBY_STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Toko / Area Antisipasi */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Toko / Area Antisipasi (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Toko Sunset Road, Area Kuta & Seminyak"
                  value={formData.assignedStoreOrArea}
                  onChange={(e) => setFormData({ ...formData, assignedStoreOrArea: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs"
                />
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Catatan / Keterangan Tambahan
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Membawa WDCP backup, standby HP aktif..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition active:scale-95"
                >
                  {editingRecord ? 'Simpan Perubahan' : 'Tambahkan ke Daftar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

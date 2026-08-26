import React, { useState, useMemo } from 'react';
import { 
  CheckSquare, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 
  Filter, 
  Download, 
  Copy, 
  Check, 
  Calendar, 
  Building2, 
  MapPin, 
  UserCheck, 
  Layers, 
  BarChart3, 
  Sparkles,
  ArrowUpDown,
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Shield
} from 'lucide-react';
import { Store, SOSchedule, SOResult, AuditorPersonnel } from '../../types/stockOpname';
import { exportToExcelWithBackup } from '../../services/storageService';
import { formatDateIndo, formatRupiah, getZoneBadgeClass, formatZoneText } from '../../utils/formatters';

interface ZoneStoreChecklistProps {
  stores: Store[];
  schedules: SOSchedule[];
  results: SOResult[];
  personnel?: AuditorPersonnel[];
  onOpenInputResultModal?: (scheduleOrId?: SOSchedule | string | null) => void;
  onSelectStore?: (store: Store) => void;
}

export interface ZoneChecklistItem {
  id: string;
  storeId?: string;
  storeCode: string;
  storeName: string;
  region: string;
  kabupaten?: string;
  tanggalSo: string; // ISO date or raw date string (e.g. 2026-08-17)
  tanggalSoFormatted: string;
  kriteriaZona: string; // Zona High / Zona Medium / Zona Low / custom
  isSudahSo: boolean;
  keteranganSo: 'Sudah SO' | 'Belum SO';
  officerInCharge?: string;
  teamName?: string;
  scheduleId?: string;
  resultId?: string;
  totalVarianceRp?: number;
  accuracyRate?: number;
  scheduleStatus?: string;
  storeObj?: Store;
  scheduleObj?: SOSchedule;
}

export const ZoneStoreChecklist: React.FC<ZoneStoreChecklistProps> = ({
  stores,
  schedules,
  results,
  personnel = [],
  onOpenInputResultModal,
  onSelectStore
}) => {
  // Active Filter Month (Default to September 2026 / current active month)
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedZonaFilter, setSelectedZonaFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('ALL');
  const [selectedKorlapFilter, setSelectedKorlapFilter] = useState<string>('ALL');
  const [copiedWA, setCopiedWA] = useState<boolean>(false);
  const [sortField, setSortField] = useState<'date' | 'code' | 'name' | 'zona'>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Available month periods
  const MONTH_OPTIONS = [
    { value: '2026-09', label: 'September 2026 (Bulan Aktif)' },
    { value: '2026-08', label: 'Agustus 2026' },
    { value: '2026-07', label: 'Juli 2026' },
    { value: '2026-06', label: 'Juni 2026' },
    { value: '2026-05', label: 'Mei 2026' },
    { value: 'ALL', label: 'Semua Periode Jadwal' }
  ];

  // Helper map for fast lookup
  const resultsByScheduleId = useMemo(() => {
    const map = new Map<string, SOResult>();
    results.forEach(r => {
      if (r.scheduleId) map.set(r.scheduleId, r);
      if (r.storeCode) map.set(`code_${r.storeCode}_${r.auditDate}`, r);
    });
    return map;
  }, [results]);

  const resultsByStoreCode = useMemo(() => {
    const map = new Map<string, SOResult[]>();
    results.forEach(r => {
      const code = r.storeCode || '';
      const list = map.get(code) || [];
      list.push(r);
      map.set(code, list);
    });
    return map;
  }, [results]);

  const storesByCode = useMemo(() => {
    const map = new Map<string, Store>();
    stores.forEach(s => {
      if (s.code) map.set(s.code, s);
      if (s.id) map.set(s.id, s);
    });
    return map;
  }, [stores]);

  // Build the unified Checklist List
  const checklistData = useMemo(() => {
    const items: ZoneChecklistItem[] = [];
    const processedKeys = new Set<string>();

    // 1. Process from Schedules on selected month or all
    schedules.forEach(sch => {
      const schDate = sch.scheduledDate || '';
      const schMonth = schDate.substring(0, 7); // e.g. 2026-08

      if (selectedMonth !== 'ALL' && schMonth !== selectedMonth) {
        return;
      }

      const storeObj = storesByCode.get(sch.storeCode) || storesByCode.get(sch.storeId);
      const matchedResult = resultsByScheduleId.get(sch.id) || 
        (sch.storeCode ? resultsByScheduleId.get(`code_${sch.storeCode}_${schDate}`) : undefined);

      const isCompleted = 
        sch.status === 'Selesai' || 
        sch.status === 'Menunggu Rekapan' || 
        !!sch.resultId || 
        !!matchedResult;

      // Extract Zona Criteria from Store or Schedule
      const isHitam = Boolean(
        storeObj?.isZonaHitam ||
        storeObj?.zona?.toUpperCase().includes('HITAM') ||
        storeObj?.keterangan?.toUpperCase().includes('ZONA HITAM')
      );
      const kriteriaZona = isHitam ? 'ZONA HITAM' : (storeObj?.zona || 'NON ZONA HITAM');

      const itemKey = `${sch.storeCode}_${schDate}`;
      processedKeys.add(itemKey);

      items.push({
        id: `sch_${sch.id}`,
        storeId: sch.storeId,
        storeCode: sch.storeCode || storeObj?.code || '-',
        storeName: sch.storeName || storeObj?.name || '-',
        region: storeObj?.region || sch.region || 'Kota Denpasar',
        kabupaten: storeObj?.kabupaten || storeObj?.city || sch.region,
        tanggalSo: schDate,
        tanggalSoFormatted: schDate ? formatDateIndo(schDate) : 'Belum Ditentukan',
        kriteriaZona,
        isSudahSo: isCompleted,
        keteranganSo: isCompleted ? 'Sudah SO' : 'Belum SO',
        officerInCharge: sch.officerInCharge || storeObj?.korlap || '-',
        teamName: sch.assignedTeamName || '-',
        scheduleId: sch.id,
        resultId: matchedResult?.id || sch.resultId,
        totalVarianceRp: matchedResult?.totalVarianceRp,
        accuracyRate: matchedResult?.accuracyRate,
        scheduleStatus: sch.status,
        storeObj,
        scheduleObj: sch
      });
    });

    // 2. Also incorporate Master Store items that have date inputs for the current month but not yet explicitly in schedule table
    stores.forEach(st => {
      let tglSoInput = '';
      if (selectedMonth === '2026-09' || (selectedMonth === 'ALL' && st.soSeptember)) {
        tglSoInput = st.soSeptember || '';
      } else if (selectedMonth === '2026-08' || (selectedMonth === 'ALL' && st.soAgustus)) {
        tglSoInput = st.soAgustus || '';
      } else if (selectedMonth === '2026-07' || (selectedMonth === 'ALL' && st.tglSoJuli)) {
        tglSoInput = st.tglSoJuli || '';
      } else if (selectedMonth === '2026-06' || (selectedMonth === 'ALL' && st.tglSoJuni)) {
        tglSoInput = st.tglSoJuni || '';
      } else if (selectedMonth === '2026-05' || (selectedMonth === 'ALL' && st.tglSoMei)) {
        tglSoInput = st.tglSoMei || '';
      } else if (st.tglSoApproved) {
        tglSoInput = st.tglSoApproved;
      }

      if (!tglSoInput || tglSoInput === '-' || tglSoInput === '0' || tglSoInput === '0-Jan-00' || tglSoInput.toLowerCase() === 'belum so') return;

      // Normalize date to standard ISO if written as day number e.g. "17"
      let normalizedDate = tglSoInput;
      if (/^\d{1,2}$/.test(tglSoInput.trim())) {
        const dayNum = tglSoInput.trim().padStart(2, '0');
        const mPart = selectedMonth !== 'ALL' ? selectedMonth : '2026-09';
        normalizedDate = `${mPart}-${dayNum}`;
      }

      const itemKey = `${st.code}_${normalizedDate}`;
      if (processedKeys.has(itemKey)) return; // Already included from schedule

      const storeResults = resultsByStoreCode.get(st.code) || [];
      const hasResult = storeResults.some(r => r.auditDate === normalizedDate || (selectedMonth !== 'ALL' && r.auditDate && r.auditDate.startsWith(selectedMonth)));

      const isHitam = Boolean(
        st.isZonaHitam ||
        st.zona?.toUpperCase().includes('HITAM') ||
        st.keterangan?.toUpperCase().includes('ZONA HITAM')
      );
      const kriteriaZona = isHitam ? 'ZONA HITAM' : (st.zona || 'NON ZONA HITAM');

      items.push({
        id: `store_${st.id}_${normalizedDate}`,
        storeId: st.id,
        storeCode: st.code,
        storeName: st.name,
        region: st.region || 'Kota Denpasar',
        kabupaten: st.kabupaten || st.city,
        tanggalSo: normalizedDate,
        tanggalSoFormatted: formatDateIndo(normalizedDate),
        kriteriaZona,
        isSudahSo: hasResult,
        keteranganSo: hasResult ? 'Sudah SO' : 'Belum SO',
        officerInCharge: st.korlap || '-',
        teamName: st.assignedTeamId || '-',
        scheduleStatus: hasResult ? 'Selesai' : 'Terjadwal (Master)',
        storeObj: st
      });
    });

    return items;
  }, [schedules, stores, results, selectedMonth, storesByCode, resultsByScheduleId, resultsByStoreCode]);

  // Extract unique filter lists
  const availableRegions = useMemo(() => {
    const set = new Set(checklistData.map(i => i.region).filter(Boolean));
    return Array.from(set).sort();
  }, [checklistData]);

  const availableKorlaps = useMemo(() => {
    const set = new Set(checklistData.map(i => i.officerInCharge).filter(Boolean).filter(k => k !== '-'));
    return Array.from(set).sort();
  }, [checklistData]);

  const availableZonas = useMemo(() => {
    const set = new Set(checklistData.map(i => i.kriteriaZona).filter(Boolean));
    return Array.from(set).sort();
  }, [checklistData]);

  // Filtered & Sorted Checklist
  const filteredData = useMemo(() => {
    return checklistData.filter(item => {
      // Search match
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const mCode = item.storeCode.toLowerCase().includes(q);
        const mName = item.storeName.toLowerCase().includes(q);
        const mKorlap = (item.officerInCharge || '').toLowerCase().includes(q);
        const mRegion = item.region.toLowerCase().includes(q);
        const mZona = item.kriteriaZona.toLowerCase().includes(q);
        if (!mCode && !mName && !mKorlap && !mRegion && !mZona) return false;
      }

      // Zona Filter
      if (selectedZonaFilter !== 'ALL') {
        const zUpper = item.kriteriaZona.toUpperCase();
        if (selectedZonaFilter === 'HITAM') {
          const isHitam = zUpper.includes('HITAM') && !zUpper.includes('NON');
          if (!isHitam) return false;
        } else if (selectedZonaFilter === 'NON') {
          const isNon = zUpper.includes('NON') || !zUpper.includes('HITAM');
          if (!isNon) return false;
        }
      }

      // Status Filter
      if (selectedStatusFilter === 'SUDAH' && !item.isSudahSo) return false;
      if (selectedStatusFilter === 'BELUM' && item.isSudahSo) return false;

      // Region Filter
      if (selectedRegionFilter !== 'ALL' && item.region !== selectedRegionFilter) return false;

      // Korlap Filter
      if (selectedKorlapFilter !== 'ALL' && item.officerInCharge !== selectedKorlapFilter) return false;

      return true;
    }).sort((a, b) => {
      if (sortField === 'date') {
        const timeA = new Date(a.tanggalSo || '1970-01-01').getTime();
        const timeB = new Date(b.tanggalSo || '1970-01-01').getTime();
        return sortAsc ? timeA - timeB : timeB - timeA;
      }
      if (sortField === 'code') {
        return sortAsc ? a.storeCode.localeCompare(b.storeCode) : b.storeCode.localeCompare(a.storeCode);
      }
      if (sortField === 'name') {
        return sortAsc ? a.storeName.localeCompare(b.storeName) : b.storeName.localeCompare(a.storeName);
      }
      if (sortField === 'zona') {
        return sortAsc ? a.kriteriaZona.localeCompare(b.kriteriaZona) : b.kriteriaZona.localeCompare(a.kriteriaZona);
      }
      return 0;
    });
  }, [checklistData, searchQuery, selectedZonaFilter, selectedStatusFilter, selectedRegionFilter, selectedKorlapFilter, sortField, sortAsc]);

  // Aggregate Metrics & Progress based on Master Toko specifications
  const metrics = useMemo(() => {
    const total = checklistData.length;
    const sudah = checklistData.filter(i => i.isSudahSo).length;
    const belum = total - sudah;
    const percent = total > 0 ? Math.round((sudah / total) * 100) : 0;

    // Breakdown per Master Toko Zona (ZONA HITAM vs NON ZONA HITAM)
    let zonaHitamTotal = 0;
    let zonaHitamSudah = 0;
    let nonZonaHitamTotal = 0;
    let nonZonaHitamSudah = 0;

    checklistData.forEach(item => {
      const zUpper = item.kriteriaZona.toUpperCase();
      if (zUpper.includes('HITAM') && !zUpper.includes('NON')) {
        zonaHitamTotal++;
        if (item.isSudahSo) zonaHitamSudah++;
      } else {
        nonZonaHitamTotal++;
        if (item.isSudahSo) nonZonaHitamSudah++;
      }
    });

    const zonaHitamBelum = zonaHitamTotal - zonaHitamSudah;
    const zonaHitamPercent = zonaHitamTotal > 0 ? Math.round((zonaHitamSudah / zonaHitamTotal) * 100) : 0;

    const nonZonaHitamBelum = nonZonaHitamTotal - nonZonaHitamSudah;
    const nonZonaHitamPercent = nonZonaHitamTotal > 0 ? Math.round((nonZonaHitamSudah / nonZonaHitamTotal) * 100) : 0;

    return {
      total,
      sudah,
      belum,
      percent,
      zonaHitamTotal,
      zonaHitamSudah,
      zonaHitamBelum,
      zonaHitamPercent,
      nonZonaHitamTotal,
      nonZonaHitamSudah,
      nonZonaHitamBelum,
      nonZonaHitamPercent
    };
  }, [checklistData]);

  // Handle Export to Excel
  const handleExportExcel = () => {
    const exportRows = filteredData.map((item, idx) => ({
      'No': idx + 1,
      'Kode Toko': item.storeCode,
      'Nama Toko': item.storeName,
      'Tanggal SO': item.tanggalSo,
      'Tanggal SO (Format)': item.tanggalSoFormatted,
      'Kriteria Zona': item.kriteriaZona,
      'Keterangan Status SO': item.keteranganSo,
      'Status Jadwal': item.scheduleStatus || '-',
      'Officer / Korlap PIC': item.officerInCharge || '-',
      'Wilayah / Area': item.region,
      'Kabupaten': item.kabupaten || item.region,
      'Selisih Audit (Rp)': item.totalVarianceRp !== undefined ? item.totalVarianceRp : '-'
    }));

    const monthLabel = MONTH_OPTIONS.find(m => m.value === selectedMonth)?.label || selectedMonth;
    exportToExcelWithBackup(
      `Ceklist_SO_Toko_Zona_${selectedMonth}_${Date.now()}`,
      `Ceklist Toko Zona ${selectedMonth}`,
      exportRows
    );
  };

  // Handle Copy to WhatsApp
  const handleCopyWA = () => {
    const monthLabel = MONTH_OPTIONS.find(m => m.value === selectedMonth)?.label || 'Agustus 2026';
    let msg = `*📊 REKAP CEKLIST SO TOKO ZONA - SPV IC BALI*\n`;
    msg += `📅 *Periode:* ${monthLabel}\n`;
    msg += `🕒 *Waktu Update:* ${new Date().toLocaleString('id-ID')}\n\n`;
    msg += `📈 *Ringkasan Capaian Pelaksanaan:*\n`;
    msg += `• Total Toko Terjadwal: *${metrics.total} Toko*\n`;
    msg += `• ✅ Sudah Selesai SO: *${metrics.sudah} Toko (${metrics.percent}%)*\n`;
    msg += `• ⏳ Belum Selesai SO: *${metrics.belum} Toko*\n\n`;

    msg += `🏷️ *Capaian per Kategori Zona Toko:*\n`;
    msg += `🔴 *Toko Zona Hitam:* ${metrics.zonaHitamSudah}/${metrics.zonaHitamTotal} SO (${metrics.zonaHitamPercent}%)\n`;
    msg += `🟢 *Non Zona Hitam:* ${metrics.nonZonaHitamSudah}/${metrics.nonZonaHitamTotal} SO (${metrics.nonZonaHitamPercent}%)\n\n`;

    const pendingList = filteredData.filter(i => !i.isSudahSo).slice(0, 15);
    if (pendingList.length > 0) {
      msg += `📌 *Daftar Toko Belum SO (${pendingList.length} dari ${metrics.belum}):*\n`;
      pendingList.forEach((item, idx) => {
        msg += `${idx + 1}. [${item.storeCode}] ${item.storeName} - Tgl: ${item.tanggalSoFormatted} (${item.kriteriaZona}) PIC: ${item.officerInCharge}\n`;
      });
      if (metrics.belum > 15) {
        msg += `_...dan ${metrics.belum - 15} toko lainnya._\n`;
      }
    } else {
      msg += `🎉 *Semua toko pada filter ini telah selesai dilakukan SO!*\n`;
    }

    msg += `\n_Diperbarui secara otomatis via Portal SPV SO IC Bali_`;

    navigator.clipboard.writeText(msg);
    setCopiedWA(true);
    setTimeout(() => setCopiedWA(false), 2500);
  };

  return (
    <div className="space-y-5">
      
      {/* Top Header Executive Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white p-5 sm:p-6 rounded-2xl border border-indigo-800/60 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 translate-x-6 -translate-y-6 pointer-events-none">
          <CheckSquare className="w-64 h-64 text-indigo-400" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <CheckSquare className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Ceklist SO Toko Zona
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                  Portal SPV
                </span>
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-indigo-200/80 max-w-3xl">
              Monitoring checklist pelaksanaan Stock Opname per Toko berdasarkan <strong>Tanggal SO</strong> &amp; <strong>Kriteria Zona</strong> dari inputan Master Toko bulan berjalan secara real-time.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Periode Month Selector */}
            <div className="bg-slate-800/90 border border-indigo-500/30 rounded-xl px-3 py-1.5 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent border-none text-white text-xs font-bold focus:outline-none cursor-pointer"
              >
                {MONTH_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleCopyWA}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/50 hover:bg-indigo-600/70 text-indigo-100 border border-indigo-400/30 text-xs font-bold transition active:scale-95 shadow-sm"
              title="Salin ringkasan ceklist ke format WhatsApp"
            >
              {copiedWA ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copiedWA ? 'Tersalin!' : 'Salin Format WA'}</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition active:scale-95 shadow-sm shadow-emerald-900/30"
              title="Download Ceklist Toko Zona ke Excel"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Analytics Progress Bar & KPI Cards */}
        <div className="mt-5 pt-5 border-t border-indigo-800/50 space-y-4">
          
          {/* Progress Bar */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-indigo-700/40 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-indigo-200 font-bold flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                Progress Penyelesaian SO Toko Zona:
              </span>
              <span className="font-extrabold text-emerald-400 text-sm">
                {metrics.sudah} / {metrics.total} Toko ({metrics.percent}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, metrics.percent)}%` }}
              />
            </div>
          </div>

          {/* KPI Mini-Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="p-2.5 bg-slate-900/70 rounded-xl border border-indigo-500/20">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Toko Zona</span>
              <p className="text-lg font-black text-white">{metrics.total}</p>
            </div>
            <div className="p-2.5 bg-emerald-950/60 rounded-xl border border-emerald-500/30">
              <span className="text-[10px] uppercase font-bold text-emerald-300">Sudah SO</span>
              <p className="text-lg font-black text-emerald-400">{metrics.sudah}</p>
            </div>
            <div className="p-2.5 bg-amber-950/60 rounded-xl border border-amber-500/30">
              <span className="text-[10px] uppercase font-bold text-amber-300">Belum SO</span>
              <p className="text-lg font-black text-amber-400">{metrics.belum}</p>
            </div>
            
            {/* Toko Zona Hitam KPI */}
            <div className="p-2.5 bg-rose-950/60 rounded-xl border border-rose-500/40">
              <span className="text-[10px] uppercase font-extrabold text-rose-300 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> ZONA HITAM
              </span>
              <p className="text-sm font-black text-rose-200">
                {metrics.zonaHitamSudah} / {metrics.zonaHitamTotal}
                <span className="text-[10px] font-bold text-rose-300 ml-1">
                  ({metrics.zonaHitamPercent}%)
                </span>
              </p>
            </div>

            {/* Non Zona Hitam KPI */}
            <div className="p-2.5 bg-emerald-950/50 rounded-xl border border-emerald-500/30">
              <span className="text-[10px] uppercase font-bold text-emerald-300 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> NON ZONA HITAM
              </span>
              <p className="text-sm font-black text-emerald-300">
                {metrics.nonZonaHitamSudah} / {metrics.nonZonaHitamTotal}
                <span className="text-[10px] font-bold text-emerald-200 ml-1">
                  ({metrics.nonZonaHitamPercent}%)
                </span>
              </p>
            </div>

            {/* Total Capaian */}
            <div className="p-2.5 bg-indigo-950/60 rounded-xl border border-indigo-500/30">
              <span className="text-[10px] uppercase font-bold text-indigo-300 flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5 text-indigo-400" /> % CAPAIAN TOTAL
              </span>
              <p className="text-lg font-black text-indigo-300">
                {metrics.percent}%
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        
        {/* Instant Search Bar */}
        <div className="flex flex-1 min-w-[260px] items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Cari Kode Toko, Nama Toko, Korlap PIC, Wilayah, atau Zona..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-hidden text-slate-800 placeholder-slate-400 text-xs font-medium"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 font-bold px-1">
              ×
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          
          {/* Filter Status SO */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Semua Status (Sudah & Belum)</option>
            <option value="SUDAH">✅ Sudah SO ({metrics.sudah})</option>
            <option value="BELUM">⏳ Belum SO ({metrics.belum})</option>
          </select>

          {/* Filter Kriteria Zona */}
          <select
            value={selectedZonaFilter}
            onChange={(e) => setSelectedZonaFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">Semua Kriteria Zona</option>
            <option value="HITAM">🔴 ZONA HITAM ({metrics.zonaHitamTotal})</option>
            <option value="NON">🟢 NON ZONA HITAM ({metrics.nonZonaHitamTotal})</option>
          </select>

          {/* Filter Wilayah / Kabupaten */}
          <select
            value={selectedRegionFilter}
            onChange={(e) => setSelectedRegionFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none"
          >
            <option value="ALL">Semua Wilayah ({availableRegions.length})</option>
            {availableRegions.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Filter Korlap */}
          <select
            value={selectedKorlapFilter}
            onChange={(e) => setSelectedKorlapFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none"
          >
            <option value="ALL">Semua Korlap ({availableKorlaps.length})</option>
            {availableKorlaps.map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>

          {/* Reset Filters */}
          {(selectedStatusFilter !== 'ALL' || selectedZonaFilter !== 'ALL' || selectedRegionFilter !== 'ALL' || selectedKorlapFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedStatusFilter('ALL');
                setSelectedZonaFilter('ALL');
                setSelectedRegionFilter('ALL');
                setSelectedKorlapFilter('ALL');
                setSearchQuery('');
              }}
              className="px-2.5 py-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition"
            >
              Reset Filter
            </button>
          )}

        </div>

      </div>

      {/* Ceklist Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Table Top Header */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="font-extrabold text-slate-900 text-sm">
              Daftar Ceklist Pelaksanaan Toko Zona ({filteredData.length} Toko)
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Sudah SO: <strong>{filteredData.filter(i => i.isSudahSo).length}</strong>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Belum SO: <strong>{filteredData.filter(i => !i.isSudahSo).length}</strong>
            </span>
          </div>
        </div>

        {filteredData.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
              <CheckSquare className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">Tidak ada data toko zona yang cocok</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Silakan sesuaikan filter pencarian, kriteria zona, atau pilihan periode bulan di bagian atas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-extrabold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3.5 text-center w-12">NO</th>
                  
                  {/* KODE TOKO */}
                  <th 
                    className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/60 transition"
                    onClick={() => {
                      setSortField('code');
                      setSortAsc(sortField === 'code' ? !sortAsc : true);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>KODE TOKO</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* NAMA TOKO */}
                  <th 
                    className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/60 transition min-w-[200px]"
                    onClick={() => {
                      setSortField('name');
                      setSortAsc(sortField === 'name' ? !sortAsc : true);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>NAMA TOKO</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* WILAYAH */}
                  <th className="py-3 px-3.5 min-w-[130px]">WILAYAH / AREA</th>

                  {/* TANGGAL SO */}
                  <th 
                    className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/60 transition min-w-[140px]"
                    onClick={() => {
                      setSortField('date');
                      setSortAsc(sortField === 'date' ? !sortAsc : true);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>TANGGAL SO</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* KRITERIA ZONA */}
                  <th 
                    className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/60 transition min-w-[130px]"
                    onClick={() => {
                      setSortField('zona');
                      setSortAsc(sortField === 'zona' ? !sortAsc : true);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>KRITERIA ZONA</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* KORLAP / OFFICER PIC */}
                  <th className="py-3 px-3.5 min-w-[130px]">KORLAP / PIC</th>

                  {/* KETERANGAN SUDAH SO / BELUM SO */}
                  <th className="py-3 px-3.5 text-center min-w-[140px]">KETERANGAN SO</th>

                  {/* AKSI CEPAT */}
                  <th className="py-3 px-3.5 text-right min-w-[100px] sticky right-0 bg-slate-100/90 shadow-2xs">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredData.map((item, idx) => {
                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-indigo-50/40 transition ${
                        item.isSudahSo ? 'bg-emerald-50/15' : 'bg-white'
                      }`}
                    >
                      
                      {/* NO */}
                      <td className="py-3 px-3.5 text-center font-mono text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>

                      {/* KODE TOKO */}
                      <td className="py-3 px-3.5 font-mono font-bold text-indigo-950">
                        <span className="bg-indigo-50 text-indigo-900 px-2 py-0.5 rounded-md border border-indigo-200">
                          {item.storeCode}
                        </span>
                      </td>

                      {/* NAMA TOKO */}
                      <td className="py-3 px-3.5">
                        <span className="font-extrabold text-slate-900 block">
                          {item.storeName}
                        </span>
                        {item.kabupaten && (
                          <span className="text-[10px] text-slate-500 font-normal">
                            Kab. {item.kabupaten}
                          </span>
                        )}
                      </td>

                      {/* WILAYAH / AREA */}
                      <td className="py-3 px-3.5 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.region}</span>
                        </div>
                      </td>

                      {/* TANGGAL SO */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>{item.tanggalSoFormatted}</span>
                        </div>
                      </td>

                      {/* KRITERIA ZONA */}
                      <td className="py-3 px-3.5">
                        {item.kriteriaZona.toUpperCase().includes('HITAM') && !item.kriteriaZona.toUpperCase().includes('NON') ? (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold border inline-flex items-center gap-1.5 bg-rose-100 border-rose-300 text-rose-800 shadow-2xs">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            ZONA HITAM
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold border inline-flex items-center gap-1.5 bg-emerald-100 border-emerald-300 text-emerald-800 shadow-2xs">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            NON ZONA HITAM
                          </span>
                        )}
                      </td>

                      {/* KORLAP / OFFICER PIC */}
                      <td className="py-3 px-3.5 text-slate-700 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.officerInCharge || '-'}</span>
                        </div>
                      </td>

                      {/* KETERANGAN SUDAH SO / BELUM SO */}
                      <td className="py-3 px-3.5 text-center">
                        {item.isSudahSo ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-[11px] shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Sudah SO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-black text-[11px] shadow-2xs">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Belum SO
                          </span>
                        )}
                        {item.totalVarianceRp !== undefined && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Selisih: {formatRupiah(item.totalVarianceRp)}
                          </div>
                        )}
                      </td>

                      {/* AKSI */}
                      <td className="py-3 px-3.5 text-right sticky right-0 bg-white/95 shadow-2xs">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.storeObj && onSelectStore && (
                            <button
                              type="button"
                              onClick={() => onSelectStore(item.storeObj!)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="Lihat Detail Toko"
                            >
                              <Building2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onOpenInputResultModal && (
                            <button
                              type="button"
                              onClick={() => onOpenInputResultModal(item.scheduleObj || item.scheduleId || item.storeCode)}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-200 transition"
                              title="Input / Update Rekapan Hasil SO"
                            >
                              Hasil SO
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  );
};

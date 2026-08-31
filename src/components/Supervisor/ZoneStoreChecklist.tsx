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
  Shield,
  DollarSign,
  Briefcase,
  AlertTriangle
} from 'lucide-react';
import { Store, SOSchedule, SOResult, AuditorPersonnel } from '../../types/stockOpname';
import { exportToExcelWithBackup } from '../../services/storageService';
import { formatDateIndo, formatRupiah, getZoneBadgeClass, formatZoneText, formatSmartSODate } from '../../utils/formatters';

interface ZoneStoreChecklistProps {
  stores: Store[];
  schedules: SOSchedule[];
  results: SOResult[];
  personnel?: AuditorPersonnel[];
  onOpenInputResultModal?: (scheduleOrId?: SOSchedule | string | null) => void;
  onSelectStore?: (store: Store) => void;
  onOpenRelocationModal?: (schedule: SOSchedule) => void;
}

export interface ZoneChecklistItem {
  id: string;
  storeId?: string;
  storeCode: string;
  storeName: string;
  region: string;
  kabupaten?: string;
  district?: string;
  
  // Dates
  tanggalTerjadwal: string; // From active schedule or soSeptember master
  tanggalTerjadwalFormatted: string;
  isTerjadwal: boolean;

  tanggalSoApproved?: string; // Tanggal SO aktual yang telah disetujui SPV
  tanggalSoApprovedFormatted?: string;
  isApprovedBySPV: boolean;
  
  // Status & Classification
  kriteriaZona: string; // ZONA HITAM vs NON ZONA HITAM
  isZonaHitam: boolean;
  typeSo: string;
  
  // Master Store Details
  saldoToko?: number | string;
  kasToko?: number;
  soAktiva?: string;
  am?: string;
  as?: string;
  officerInCharge?: string;
  teamName?: string;
  
  // Schedule & Result References
  scheduleId?: string;
  scheduleStatus?: string;
  spvApprovalStatus?: string;
  resultId?: string;
  totalVarianceRp?: number;
  accuracyRate?: number;
  baNumber?: string;
  notes?: string;

  storeObj?: Store;
  scheduleObj?: SOSchedule;
}

export const ZoneStoreChecklist: React.FC<ZoneStoreChecklistProps> = ({
  stores,
  schedules,
  results,
  personnel = [],
  onOpenInputResultModal,
  onSelectStore,
  onOpenRelocationModal
}) => {
  // Filters & State
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedZonaFilter, setSelectedZonaFilter] = useState<'ALL' | 'HITAM' | 'NON'>('HITAM'); // Default to Zona Hitam as requested
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'SUDAH_APPROVED' | 'MENUNGGU_APPROVAL' | 'TERJADWAL_BELUM_SO' | 'BELUM_TERJADWAL'>('ALL');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('ALL');
  const [selectedKorlapFilter, setSelectedKorlapFilter] = useState<string>('ALL');
  const [copiedWA, setCopiedWA] = useState<boolean>(false);
  const [sortField, setSortField] = useState<'date' | 'code' | 'name' | 'zona' | 'saldo'>('code');
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
      if (r.storeCode) map.set(`code_${r.storeCode}`, r);
    });
    return map;
  }, [results]);

  const schedulesByStoreCode = useMemo(() => {
    const map = new Map<string, SOSchedule>();
    schedules.forEach(s => {
      if (s.status !== 'Dibatalkan') {
        map.set(s.storeCode, s);
        if (s.storeId) map.set(s.storeId, s);
      }
    });
    return map;
  }, [schedules]);

  // Build the complete Master Store Checklist List (Guaranteed to read ALL Zona Hitam from Master Toko Bali)
  const checklistData = useMemo(() => {
    const items: ZoneChecklistItem[] = [];

    stores.forEach(st => {
      // 1. Determine if store is Zona Hitam
      const zUpper = String(st.zona || '').toUpperCase();
      const ketUpper = String(st.keterangan || '').toUpperCase();
      const isHitam = Boolean(
        st.isZonaHitam ||
        zUpper.includes('HITAM') ||
        ketUpper.includes('ZONA HITAM') ||
        st.riskLevel === 'Tinggi'
      );
      const kriteriaZona = isHitam ? 'ZONA HITAM' : (st.zona || 'NON ZONA HITAM');

      // 2. Find associated active schedule
      const matchedSchedule = schedulesByStoreCode.get(st.code) || schedulesByStoreCode.get(st.id);
      
      // 3. Find associated result
      const matchedResult = (matchedSchedule && resultsByScheduleId.get(matchedSchedule.id)) || resultsByScheduleId.get(`code_${st.code}`);

      // 4. Resolve Tanggal Terjadwal
      let schedDate = matchedSchedule?.scheduledDate || '';
      if (!schedDate) {
        if (selectedMonth === '2026-09' || selectedMonth === 'ALL') {
          schedDate = st.soSeptember || '';
        } else if (selectedMonth === '2026-08') {
          schedDate = st.soAgustus || '';
        } else if (selectedMonth === '2026-07') {
          schedDate = st.tglSoJuli || '';
        }
      }

      // Check if scheduled
      const isSchedFilled = Boolean(
        schedDate && 
        schedDate !== '-' && 
        schedDate !== '0' && 
        schedDate !== '0-Jan-00' && 
        !schedDate.toLowerCase().includes('belum')
      );

      // Normalize date if day number
      let formattedSchedDate = 'Belum Terjadwal (Blank)';
      if (isSchedFilled) {
        if (/^\d{1,2}$/.test(schedDate.trim())) {
          const day = schedDate.trim().padStart(2, '0');
          const m = selectedMonth !== 'ALL' ? selectedMonth : '2026-09';
          schedDate = `${m}-${day}`;
        }
        formattedSchedDate = formatDateIndo(schedDate);
      }

      // 5. Resolve Tanggal SO (Berdasarkan Approval SPV)
      let approvedDate = '';
      let isApproved = false;

      if (matchedSchedule?.spvApprovalStatus === 'Disetujui' || matchedSchedule?.status === 'Selesai') {
        approvedDate = matchedSchedule.scheduledDate;
        isApproved = true;
      } else if (matchedResult?.approvalStatus === 'Disetujui' || matchedResult?.baNumber) {
        approvedDate = matchedResult.auditDate || schedDate;
        isApproved = true;
      } else if (st.tglSoApproved && st.tglSoApproved !== '-' && st.tglSoApproved !== '0') {
        approvedDate = st.tglSoApproved;
        isApproved = true;
      }

      const formattedApprovedDate = approvedDate ? formatDateIndo(approvedDate) : undefined;

      // 6. Officer In Charge (Sync with Korlap / Master Personil)
      const officer = matchedSchedule?.officerInCharge || st.korlap || '-';

      items.push({
        id: `zone_${st.id}`,
        storeId: st.id,
        storeCode: st.code,
        storeName: st.name,
        region: st.region || 'Kota Denpasar',
        kabupaten: st.kabupaten || st.city || st.region,
        district: st.district || st.kecamatan,
        
        tanggalTerjadwal: isSchedFilled ? schedDate : '',
        tanggalTerjadwalFormatted: formattedSchedDate,
        isTerjadwal: isSchedFilled,

        tanggalSoApproved: approvedDate || undefined,
        tanggalSoApprovedFormatted: formattedApprovedDate,
        isApprovedBySPV: isApproved,

        kriteriaZona,
        isZonaHitam: isHitam,
        typeSo: st.typeSo || st.qm || 'M',

        saldoToko: st.saldoToko,
        kasToko: st.kasToko,
        soAktiva: st.soAktiva,
        am: st.am,
        as: st.as,
        officerInCharge: officer,
        teamName: matchedSchedule?.assignedTeamName,

        scheduleId: matchedSchedule?.id,
        scheduleStatus: matchedSchedule?.status || (isApproved ? 'Selesai' : (isSchedFilled ? 'Terjadwal (Master)' : 'Belum Terjadwal')),
        spvApprovalStatus: matchedSchedule?.spvApprovalStatus || (isApproved ? 'Disetujui' : (matchedResult ? 'Menunggu Approval SPV' : undefined)),
        resultId: matchedResult?.id,
        totalVarianceRp: matchedResult?.totalVarianceRp,
        accuracyRate: matchedResult?.accuracyRate,
        baNumber: matchedResult?.baNumber,
        notes: matchedSchedule?.notes || st.keterangan,

        storeObj: st,
        scheduleObj: matchedSchedule
      });
    });

    return items;
  }, [stores, schedules, results, selectedMonth, schedulesByStoreCode, resultsByScheduleId]);

  // Extract unique filter lists
  const availableRegions = useMemo(() => {
    const set = new Set(checklistData.map(i => i.kabupaten || i.region).filter(Boolean));
    return Array.from(set).sort();
  }, [checklistData]);

  const availableKorlaps = useMemo(() => {
    const set = new Set(checklistData.map(i => i.officerInCharge).filter(Boolean).filter(k => k !== '-'));
    return Array.from(set).sort();
  }, [checklistData]);

  // Filtered & Sorted Checklist
  const filteredData = useMemo(() => {
    return checklistData.filter(item => {
      // 1. Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const mCode = item.storeCode.toLowerCase().includes(q);
        const mName = item.storeName.toLowerCase().includes(q);
        const mKorlap = (item.officerInCharge || '').toLowerCase().includes(q);
        const mRegion = (item.region || '').toLowerCase().includes(q);
        const mKab = (item.kabupaten || '').toLowerCase().includes(q);
        const mAM = (item.am || '').toLowerCase().includes(q);
        const mAS = (item.as || '').toLowerCase().includes(q);
        if (!mCode && !mName && !mKorlap && !mRegion && !mKab && !mAM && !mAS) return false;
      }

      // 2. Zona Filter
      if (selectedZonaFilter === 'HITAM' && !item.isZonaHitam) return false;
      if (selectedZonaFilter === 'NON' && item.isZonaHitam) return false;

      // 3. Status Filter based on SPV Approval & Scheduling
      if (selectedStatusFilter === 'SUDAH_APPROVED' && !item.isApprovedBySPV) return false;
      if (selectedStatusFilter === 'MENUNGGU_APPROVAL') {
        const isPending = item.spvApprovalStatus === 'Menunggu Approval SPV' || (item.scheduleStatus === 'Menunggu Rekapan' && !item.isApprovedBySPV);
        if (!isPending) return false;
      }
      if (selectedStatusFilter === 'TERJADWAL_BELUM_SO') {
        if (!item.isTerjadwal || item.isApprovedBySPV) return false;
      }
      if (selectedStatusFilter === 'BELUM_TERJADWAL') {
        if (item.isTerjadwal || item.isApprovedBySPV) return false;
      }

      // 4. Region Filter
      if (selectedRegionFilter !== 'ALL' && item.kabupaten !== selectedRegionFilter && item.region !== selectedRegionFilter) return false;

      // 5. Korlap Filter
      if (selectedKorlapFilter !== 'ALL' && item.officerInCharge !== selectedKorlapFilter) return false;

      return true;
    }).sort((a, b) => {
      if (sortField === 'date') {
        const timeA = a.tanggalTerjadwal ? new Date(a.tanggalTerjadwal).getTime() : 0;
        const timeB = b.tanggalTerjadwal ? new Date(b.tanggalTerjadwal).getTime() : 0;
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
      if (sortField === 'saldo') {
        const numA = typeof a.saldoToko === 'number' ? a.saldoToko : 0;
        const numB = typeof b.saldoToko === 'number' ? b.saldoToko : 0;
        return sortAsc ? numA - numB : numB - numA;
      }
      return 0;
    });
  }, [checklistData, searchQuery, selectedZonaFilter, selectedStatusFilter, selectedRegionFilter, selectedKorlapFilter, sortField, sortAsc]);

  // Aggregate Metrics & Progress based on Master Toko specifications
  const metrics = useMemo(() => {
    const totalAll = checklistData.length;
    
    // Zona Hitam specific counts
    const zonaHitamItems = checklistData.filter(i => i.isZonaHitam);
    const totalZonaHitam = zonaHitamItems.length;
    const zonaHitamApproved = zonaHitamItems.filter(i => i.isApprovedBySPV).length;
    const zonaHitamTerjadwalBelumSO = zonaHitamItems.filter(i => i.isTerjadwal && !i.isApprovedBySPV).length;
    const zonaHitamBelumTerjadwal = zonaHitamItems.filter(i => !i.isTerjadwal && !i.isApprovedBySPV).length;
    const zonaHitamBelumSO = totalZonaHitam - zonaHitamApproved;
    const zonaHitamPercent = totalZonaHitam > 0 ? Math.round((zonaHitamApproved / totalZonaHitam) * 100) : 0;

    // Non Zona Hitam counts
    const nonZonaItems = checklistData.filter(i => !i.isZonaHitam);
    const totalNonZona = nonZonaItems.length;
    const nonZonaApproved = nonZonaItems.filter(i => i.isApprovedBySPV).length;
    const nonZonaPercent = totalNonZona > 0 ? Math.round((nonZonaApproved / totalNonZona) * 100) : 0;

    return {
      totalAll,
      totalZonaHitam,
      zonaHitamApproved,
      zonaHitamTerjadwalBelumSO,
      zonaHitamBelumTerjadwal,
      zonaHitamBelumSO,
      zonaHitamPercent,
      totalNonZona,
      nonZonaApproved,
      nonZonaPercent
    };
  }, [checklistData]);

  // WhatsApp Summary Copy
  const generateWASummary = () => {
    const listToReport = filteredData.slice(0, 30);
    return `*CEKLIST PELAKSANAAN TOKO ZONA HITAM (BALI)*
━━━━━━━━━━━━━━━━━━━━
📅 *Bulan:* September 2026
🛡️ *Total Toko Zona Hitam:* ${metrics.totalZonaHitam} Toko
✅ *Sudah Disetujui SPV (Selesai):* ${metrics.zonaHitamApproved} Toko (${metrics.zonaHitamPercent}% Ach)
⏳ *Terjadwal (Belum SO):* ${metrics.zonaHitamTerjadwalBelumSO} Toko
❌ *Belum Terjadwal (Blank):* ${metrics.zonaHitamBelumTerjadwal} Toko

*DETAIL CEKLIST TOKO ZONA HITAM:*
${listToReport.map((i, idx) => {
  const statusStr = i.isApprovedBySPV 
    ? `✅ SO Approved (${i.tanggalSoApprovedFormatted || '-'})` 
    : (i.isTerjadwal ? `⏳ Terjadwal (${i.tanggalTerjadwalFormatted})` : `❌ Belum Terjadwal`);
  return `${idx + 1}. [${i.storeCode}] ${i.storeName}
   • Status: ${statusStr}
   • AM/AS: ${i.am || '-'}/${i.as || '-'} | Korlap: ${i.officerInCharge}
   • Stock: ${typeof i.saldoToko === 'number' ? formatRupiah(i.saldoToko) : (i.saldoToko || '-')}`;
}).join('\n\n')}

_Data sinkron dengan Master Toko Bali & Approval SPV._`;
  };

  const handleCopyWA = () => {
    const text = generateWASummary();
    navigator.clipboard.writeText(text);
    setCopiedWA(true);
    setTimeout(() => setCopiedWA(false), 3000);
  };

  const handleExportExcel = async () => {
    const rows = filteredData.map((item, idx) => ({
      No: idx + 1,
      'Kode Toko': item.storeCode,
      'Nama Toko': item.storeName,
      'Kabupaten': item.kabupaten || item.region,
      'Kriteria Zona': item.kriteriaZona,
      'Type SO': item.typeSo,
      'AM': item.am || '',
      'AS': item.as || '',
      'Korlap / Officer': item.officerInCharge || '',
      'Saldo Toko / Stock': typeof item.saldoToko === 'number' ? item.saldoToko : (item.saldoToko || ''),
      'Kas Toko': item.kasToko || '',
      'SO Aktiva': item.soAktiva || '',
      'Tanggal Terjadwal': item.tanggalTerjadwalFormatted,
      'Tanggal SO (Disetujui SPV)': item.tanggalSoApprovedFormatted || 'Belum Ter-SO',
      'Status Approval SPV': item.isApprovedBySPV ? 'Disetujui' : (item.spvApprovalStatus || 'Belum SO'),
      'Nomor BA': item.baNumber || '',
      'Akurasi (%)': item.accuracyRate !== undefined ? `${item.accuracyRate}%` : '',
      'Total Selisih (Rp)': item.totalVarianceRp || 0,
      'Keterangan': item.notes || ''
    }));

    exportToExcelWithBackup(
      `Ceklist_Toko_Zona_Hitam_Bali_${selectedMonth}`,
      'Ceklist Toko Zona Hitam',
      rows
    );
  };

  return (
    <div className="space-y-4">
      
      {/* Top Banner & KPI Dashboard */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 border border-rose-800/50 rounded-2xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-xs">
                <ShieldAlert className="w-3.5 h-3.5" /> MASTER TOKO BALI
              </span>
              <span className="text-xs text-rose-200 font-mono font-bold">
                Sinkronisasi Master Toko Bali & Approval SPV
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-black text-white mt-1 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-rose-400" />
              Ceklist Toko Zona Hitam (Audit Prioritas)
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
              Daftar seluruh toko Zona Hitam yang dibaca langsung dari <strong>Master Toko Bali</strong>. Dilengkapi tanggal terjadwal, tanggal SO hasil persetujuan SPV, serta saldo stock & kasir.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyWA}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 shadow-xs cursor-pointer"
            >
              {copiedWA ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedWA ? 'Tersalin' : 'Format WA'}</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* KPI Mini-Cards Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mt-4 pt-4 border-t border-rose-800/40">
          
          <div className="p-3 bg-slate-900/80 rounded-xl border border-rose-500/30">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Zona Hitam</span>
            <p className="text-xl font-black text-white mt-0.5">{metrics.totalZonaHitam} Toko</p>
          </div>

          <div className="p-3 bg-emerald-950/70 rounded-xl border border-emerald-500/40">
            <span className="text-[10px] uppercase font-bold text-emerald-300 block">Sudah Disetujui SPV</span>
            <p className="text-xl font-black text-emerald-400 mt-0.5">{metrics.zonaHitamApproved} Toko</p>
            <span className="text-[10px] text-emerald-300 font-bold">{metrics.zonaHitamPercent}% Ach</span>
          </div>

          <div className="p-3 bg-amber-950/70 rounded-xl border border-amber-500/40">
            <span className="text-[10px] uppercase font-bold text-amber-300 block">Terjadwal (Belum SO)</span>
            <p className="text-xl font-black text-amber-400 mt-0.5">{metrics.zonaHitamTerjadwalBelumSO} Toko</p>
          </div>

          <div className="p-3 bg-rose-950/70 rounded-xl border border-rose-500/40">
            <span className="text-[10px] uppercase font-bold text-rose-300 block">Belum Terjadwal (Blank)</span>
            <p className="text-xl font-black text-rose-400 mt-0.5">{metrics.zonaHitamBelumTerjadwal} Toko</p>
          </div>

          <div className="p-3 bg-indigo-950/70 rounded-xl border border-indigo-500/40 col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold text-indigo-300 block">% Capaian Realisasi</span>
            <p className="text-xl font-black text-indigo-300 mt-0.5">{metrics.zonaHitamPercent}%</p>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div 
                className="bg-emerald-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${metrics.zonaHitamPercent}%` }}
              />
            </div>
          </div>

        </div>

      </div>

      {/* Filter & Search Navigation Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        
        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setSelectedStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl transition shrink-0 ${
              selectedStatusFilter === 'ALL' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Semua ({filteredData.length})
          </button>
          
          <button
            type="button"
            onClick={() => setSelectedStatusFilter('SUDAH_APPROVED')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
              selectedStatusFilter === 'SUDAH_APPROVED' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Sudah Disetujui SPV ({metrics.zonaHitamApproved})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatusFilter('TERJADWAL_BELUM_SO')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
              selectedStatusFilter === 'TERJADWAL_BELUM_SO' ? 'bg-amber-500 text-white shadow-xs' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Terjadwal Belum SO ({metrics.zonaHitamTerjadwalBelumSO})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatusFilter('BELUM_TERJADWAL')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
              selectedStatusFilter === 'BELUM_TERJADWAL' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Belum Terjadwal / Blank ({metrics.zonaHitamBelumTerjadwal})</span>
          </button>
        </div>

        {/* Search & Dropdown Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
          
          {/* Search Box */}
          <div className="sm:col-span-4 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari kode toko, nama toko, AM, AS, Korlap..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-rose-500 outline-hidden"
            />
          </div>

          {/* Kriteria Zona Switcher */}
          <div className="sm:col-span-3">
            <select
              value={selectedZonaFilter}
              onChange={(e) => setSelectedZonaFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold text-slate-800 focus:ring-2 focus:ring-rose-500"
            >
              <option value="HITAM">🔴 HANYA ZONA HITAM ({metrics.totalZonaHitam})</option>
              <option value="NON">🟢 NON ZONA HITAM ({metrics.totalNonZona})</option>
              <option value="ALL">SEMUA TOKO ({metrics.totalAll})</option>
            </select>
          </div>

          {/* Region / Kabupaten */}
          <div className="sm:col-span-3">
            <select
              value={selectedRegionFilter}
              onChange={(e) => setSelectedRegionFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-rose-500"
            >
              <option value="ALL">Semua Kabupaten ({availableRegions.length})</option>
              {availableRegions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Korlap / Officer */}
          <div className="sm:col-span-2">
            <select
              value={selectedKorlapFilter}
              onChange={(e) => setSelectedKorlapFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-rose-500"
            >
              <option value="ALL">Semua Korlap</option>
              {availableKorlaps.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

        </div>

      </div>

      {/* Main Checklist Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Table Top Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">
              Tabel Ceklist Toko Zona Hitam ({filteredData.length} Toko)
            </h3>
          </div>
          <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
            <span>Disetujui: <strong className="text-emerald-600">{filteredData.filter(i => i.isApprovedBySPV).length}</strong></span>
            <span>•</span>
            <span>Belum SO: <strong className="text-rose-600">{filteredData.filter(i => !i.isApprovedBySPV).length}</strong></span>
          </div>
        </div>

        {filteredData.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
              <CheckSquare className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">Tidak ada toko zona hitam yang cocok</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Silakan sesuaikan filter pencarian atau pilihan status di atas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 font-extrabold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3 text-center w-10">NO</th>
                  
                  {/* KODE TOKO */}
                  <th 
                    className="py-3 px-3 cursor-pointer hover:bg-slate-200/60 transition"
                    onClick={() => {
                      setSortField('code');
                      setSortAsc(sortField === 'code' ? !sortAsc : true);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>KODE</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* NAMA TOKO */}
                  <th 
                    className="py-3 px-3 cursor-pointer hover:bg-slate-200/60 transition min-w-[180px]"
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

                  <th className="py-3 px-3 min-w-[120px]">KABUPATEN</th>
                  <th className="py-3 px-3 min-w-[110px]">AM / AS</th>
                  <th className="py-3 px-3 min-w-[130px]">KORLAP / OFFICER</th>

                  {/* STOCK / SALDO */}
                  <th 
                    className="py-3 px-3 cursor-pointer hover:bg-slate-200/60 transition min-w-[120px]"
                    onClick={() => {
                      setSortField('saldo');
                      setSortAsc(sortField === 'saldo' ? !sortAsc : true);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>SALDO / STOCK</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* TANGGAL TERJADWAL */}
                  <th 
                    className="py-3 px-3 cursor-pointer hover:bg-slate-200/60 transition min-w-[130px]"
                    onClick={() => {
                      setSortField('date');
                      setSortAsc(sortField === 'date' ? !sortAsc : true);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>TGL TERJADWAL</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* TANGGAL SO (APPROVED SPV) */}
                  <th className="py-3 px-3 min-w-[150px]">TGL SO (APPROVED SPV)</th>

                  {/* STATUS & HASIL */}
                  <th className="py-3 px-3 min-w-[130px]">STATUS SO</th>

                  {/* AKSI */}
                  <th className="py-3 px-3 text-right sticky right-0 bg-slate-100/95 min-w-[90px]">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredData.map((item, idx) => {
                  return (
                    <tr 
                      key={item.id}
                      className={`hover:bg-rose-50/30 transition ${
                        item.isApprovedBySPV ? 'bg-emerald-50/20' : 'bg-white'
                      }`}
                    >
                      {/* NO */}
                      <td className="py-3 px-3 text-center font-mono text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>

                      {/* KODE */}
                      <td className="py-3 px-3 font-mono font-black text-slate-900">
                        <span className="bg-slate-100 text-slate-900 px-1.5 py-0.5 rounded border border-slate-200">
                          {item.storeCode}
                        </span>
                      </td>

                      {/* NAMA TOKO */}
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                          <span>{item.storeName}</span>
                          {item.isZonaHitam && (
                            <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.2 rounded-full shrink-0">
                              ZONA HITAM
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">Type: <strong>{item.typeSo}</strong></span>
                      </td>

                      {/* KABUPATEN */}
                      <td className="py-3 px-3 text-slate-700">
                        <div className="flex items-center gap-1 text-[11px]">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{item.kabupaten}</span>
                        </div>
                      </td>

                      {/* AM / AS */}
                      <td className="py-3 px-3 text-slate-700 text-[11px]">
                        <div>AM: <strong className="text-slate-900">{item.am || '-'}</strong></div>
                        <div>AS: <strong className="text-slate-900">{item.as || '-'}</strong></div>
                      </td>

                      {/* KORLAP */}
                      <td className="py-3 px-3 text-indigo-900 font-bold text-[11px]">
                        <div className="flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-indigo-600 shrink-0" />
                          <span>{item.officerInCharge}</span>
                        </div>
                      </td>

                      {/* SALDO / STOCK */}
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-800">
                        {typeof item.saldoToko === 'number' ? formatRupiah(item.saldoToko) : (item.saldoToko || '-')}
                      </td>

                      {/* TGL TERJADWAL */}
                      <td className="py-3 px-3 font-mono text-[11px]">
                        {item.isTerjadwal ? (
                          <span className="text-indigo-900 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {item.tanggalTerjadwalFormatted}
                          </span>
                        ) : (
                          <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            Belum Terjadwal
                          </span>
                        )}
                      </td>

                      {/* TGL SO (APPROVED SPV) */}
                      <td className="py-3 px-3 font-mono text-[11px]">
                        {item.isApprovedBySPV ? (
                          <div className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{item.tanggalSoApprovedFormatted || 'Approved'}</span>
                          </div>
                        ) : (
                          <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                            {item.isTerjadwal ? 'Menunggu Pelaksanaan' : 'Kolom Blank'}
                          </span>
                        )}
                      </td>

                      {/* STATUS SO */}
                      <td className="py-3 px-3">
                        {item.isApprovedBySPV ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Disetujui SPV
                          </span>
                        ) : item.spvApprovalStatus === 'Menunggu Approval SPV' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Review SPV
                          </span>
                        ) : item.isTerjadwal ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                            Terjadwal
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            Belum SO
                          </span>
                        )}
                      </td>

                      {/* AKSI */}
                      <td className="py-3 px-3 text-right sticky right-0 bg-white/95 shadow-2xs">
                        <div className="flex items-center justify-end gap-1">
                          {item.storeObj && onSelectStore && (
                            <button
                              type="button"
                              onClick={() => onSelectStore(item.storeObj!)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="Lihat Detail Toko"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {onOpenInputResultModal && (
                            <button
                              type="button"
                              onClick={() => onOpenInputResultModal(item.scheduleObj || item.storeCode)}
                              className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold transition shadow-xs"
                            >
                              Hasil
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

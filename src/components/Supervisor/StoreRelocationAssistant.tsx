import React, { useState, useMemo } from 'react';
import { 
  ArrowLeftRight, 
  MapPin, 
  Search, 
  Calendar, 
  Building2, 
  Clock, 
  DollarSign, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  ShieldAlert, 
  ExternalLink, 
  Copy, 
  Check, 
  Filter, 
  Navigation, 
  UserCheck, 
  Phone, 
  FileText,
  RotateCcw,
  X,
  ChevronRight,
  Info
} from 'lucide-react';
import { Store, SOSchedule, AuditorPersonnel } from '../../types/stockOpname';
import { calculateHaversineDistance } from '../../utils/geoUtils';
import { formatRupiah, formatDateIndo, formatSmartSODate, formatZoneText } from '../../utils/formatters';

interface StoreRelocationAssistantProps {
  stores: Store[];
  schedules: SOSchedule[];
  personnel?: AuditorPersonnel[];
  onApplyRelocation: (
    originalScheduleId: string,
    actionType: 'Pindah Toko' | 'Gagal SO',
    reason: string,
    replacementDetails?: {
      newStore: Store;
      newDate: string;
      newTime: string;
    }
  ) => void;
  onClose?: () => void;
}

export interface CandidateStoreRecommendation {
  store: Store;
  distanceKm: number;
  scheduleStatusType: 'BELUM_TERJADWAL' | 'TERJADWAL_LAIN' | 'SUDAH_SO' | 'HARI_INI';
  scheduledDateMaster?: string;
  activeSchedule?: SOSchedule;
  typeSo: string;
  zona: string;
  isZonaHitam: boolean;
  saldoToko: number | string;
  kasToko?: number;
  soAktiva?: string;
  am?: string;
  as?: string;
  korlap?: string;
  coordinatesAvailable: boolean;
}

export const StoreRelocationAssistant: React.FC<StoreRelocationAssistantProps> = ({
  stores,
  schedules,
  personnel = [],
  onApplyRelocation,
  onClose
}) => {
  // Step 1: Selected Source Store (Toko yang minta pindah)
  const [selectedSourceScheduleId, setSelectedSourceScheduleId] = useState<string>('');
  const [sourceSearchQuery, setSourceSearchQuery] = useState<string>('');
  const [sourceFilterDate, setSourceFilterDate] = useState<string>('ALL');
  
  // Step 2: Reason & Date Configuration
  const [reasonCategory, setReasonCategory] = useState<string>('Akses Jalan / Cuaca Ekstrem');
  const [customReason, setCustomReason] = useState<string>('');
  const [targetDateForReplacement, setTargetDateForReplacement] = useState<string>('');
  const [targetTimeForReplacement, setTargetTimeForReplacement] = useState<string>('21:00');

  // Step 3: Recommendation Filters
  const [candidateSearchQuery, setCandidateSearchQuery] = useState<string>('');
  const [filterScheduleType, setFilterScheduleType] = useState<'ALL' | 'BELUM_TERJADWAL' | 'TERJADWAL_LAIN'>('ALL');
  const [filterTypeSo, setFilterTypeSo] = useState<string>('ALL');
  const [filterZonaOnly, setFilterZonaOnly] = useState<boolean>(false);
  const [maxRadiusKm, setMaxRadiusKm] = useState<number>(35);
  const [selectedCandidateStoreId, setSelectedCandidateStoreId] = useState<string>('');
  const [copiedWA, setCopiedWA] = useState<boolean>(false);

  // Success Confirmation State
  const [swapExecuted, setSwapExecuted] = useState<{
    originalStore: Store;
    replacementStore: Store;
    date: string;
    reason: string;
  } | null>(null);

  // Active schedules eligible for relocation (scheduled or in progress)
  const eligibleSourceSchedules = useMemo(() => {
    return schedules.filter(s => s.status === 'Terjadwal' || s.status === 'Proses SO' || s.status === 'Menunggu Rekapan');
  }, [schedules]);

  // Unique dates from active schedules
  const availableScheduleDates = useMemo(() => {
    const dates = new Set<string>();
    eligibleSourceSchedules.forEach(s => {
      if (s.scheduledDate) dates.add(s.scheduledDate);
    });
    return Array.from(dates).sort();
  }, [eligibleSourceSchedules]);

  // Filtered source schedules
  const filteredSourceSchedules = useMemo(() => {
    return eligibleSourceSchedules.filter(s => {
      if (sourceFilterDate !== 'ALL' && s.scheduledDate !== sourceFilterDate) return false;
      if (sourceSearchQuery.trim()) {
        const q = sourceSearchQuery.toLowerCase();
        return (
          s.storeCode.toLowerCase().includes(q) ||
          s.storeName.toLowerCase().includes(q) ||
          s.region.toLowerCase().includes(q) ||
          (s.officerInCharge && s.officerInCharge.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [eligibleSourceSchedules, sourceFilterDate, sourceSearchQuery]);

  // Currently Selected Source Schedule & Store
  const selectedSchedule = useMemo(() => {
    return schedules.find(s => s.id === selectedSourceScheduleId) || eligibleSourceSchedules[0] || null;
  }, [schedules, selectedSourceScheduleId, eligibleSourceSchedules]);

  const selectedSourceStore = useMemo(() => {
    if (!selectedSchedule) return null;
    return stores.find(st => st.id === selectedSchedule.storeId || st.code === selectedSchedule.storeCode) || null;
  }, [selectedSchedule, stores]);

  // Auto-fill target date when selected schedule changes
  React.useEffect(() => {
    if (selectedSchedule) {
      setTargetDateForReplacement(selectedSchedule.scheduledDate || '');
      setTargetTimeForReplacement(selectedSchedule.scheduledTime || '21:00');
    }
  }, [selectedSchedule]);

  // Build candidate stores recommendations with accurate distance and schedule status
  const candidateRecommendations = useMemo<CandidateStoreRecommendation[]>(() => {
    if (!selectedSourceStore) return [];

    const sourceLat = selectedSourceStore.latitude;
    const sourceLng = selectedSourceStore.longitude;
    const currentDate = selectedSchedule?.scheduledDate || '';

    // Create lookup for schedules by store code
    const scheduleByStoreCode = new Map<string, SOSchedule>();
    schedules.forEach(sc => {
      if (sc.status !== 'Dibatalkan' && sc.status !== 'Gagal SO') {
        scheduleByStoreCode.set(sc.storeCode, sc);
      }
    });

    const list: CandidateStoreRecommendation[] = [];

    stores.forEach(st => {
      // Exclude source store itself
      if (st.id === selectedSourceStore.id || st.code === selectedSourceStore.code) return;

      // Distance calculation
      const dist = (sourceLat !== undefined && sourceLng !== undefined && st.latitude !== undefined && st.longitude !== undefined)
        ? calculateHaversineDistance(sourceLat, sourceLng, st.latitude, st.longitude)
        : 999;

      const hasCoordinates = st.latitude !== undefined && st.longitude !== undefined;

      // Determine schedule status in master & schedule table
      const activeSched = scheduleByStoreCode.get(st.code);
      let scheduleStatusType: 'BELUM_TERJADWAL' | 'TERJADWAL_LAIN' | 'SUDAH_SO' | 'HARI_INI' = 'BELUM_TERJADWAL';
      
      const masterSepDate = String(st.soSeptember || '').trim();
      const hasMasterDate = masterSepDate && masterSepDate !== '-' && masterSepDate !== '0' && masterSepDate !== '0-Jan-00' && !masterSepDate.toLowerCase().includes('belum');

      if (activeSched) {
        if (activeSched.scheduledDate === currentDate) {
          scheduleStatusType = 'HARI_INI';
        } else if (activeSched.status === 'Selesai' || activeSched.spvApprovalStatus === 'Disetujui') {
          scheduleStatusType = 'SUDAH_SO';
        } else {
          scheduleStatusType = 'TERJADWAL_LAIN';
        }
      } else if (hasMasterDate) {
        if (masterSepDate === currentDate) {
          scheduleStatusType = 'HARI_INI';
        } else {
          scheduleStatusType = 'TERJADWAL_LAIN';
        }
      } else {
        // Kolom blank di master toko bali
        scheduleStatusType = 'BELUM_TERJADWAL';
      }

      // Check Zona Hitam
      const isHitam = Boolean(
        st.isZonaHitam ||
        String(st.zona || '').toUpperCase().includes('HITAM') ||
        String(st.keterangan || '').toUpperCase().includes('ZONA HITAM') ||
        st.riskLevel === 'Tinggi'
      );

      list.push({
        store: st,
        distanceKm: dist,
        scheduleStatusType,
        scheduledDateMaster: masterSepDate || activeSched?.scheduledDate,
        activeSchedule: activeSched,
        typeSo: st.typeSo || st.qm || 'M',
        zona: isHitam ? 'ZONA HITAM' : (st.zona || 'NON ZONA HITAM'),
        isZonaHitam: isHitam,
        saldoToko: st.saldoToko || 0,
        kasToko: st.kasToko,
        soAktiva: st.soAktiva,
        am: st.am,
        as: st.as,
        korlap: st.korlap || activeSched?.officerInCharge,
        coordinatesAvailable: hasCoordinates
      });
    });

    // Sort by: 1. Belum Terjadwal (Priority), 2. Shortest Distance
    return list.sort((a, b) => {
      // Prioritize unassigned blank stores first if in same distance tier
      if (a.scheduleStatusType === 'BELUM_TERJADWAL' && b.scheduleStatusType !== 'BELUM_TERJADWAL') return -1;
      if (b.scheduleStatusType === 'BELUM_TERJADWAL' && a.scheduleStatusType !== 'BELUM_TERJADWAL') return 1;
      return a.distanceKm - b.distanceKm;
    });
  }, [selectedSourceStore, stores, schedules, selectedSchedule]);

  // Filtered Candidate Stores based on SPV criteria
  const filteredCandidates = useMemo(() => {
    return candidateRecommendations.filter(c => {
      // Exclude stores already being audited today
      if (c.scheduleStatusType === 'HARI_INI' || c.scheduleStatusType === 'SUDAH_SO') return false;

      // Filter by Schedule Status (Belum Terjadwal vs Terjadwal di Tanggal Lain)
      if (filterScheduleType === 'BELUM_TERJADWAL' && c.scheduleStatusType !== 'BELUM_TERJADWAL') return false;
      if (filterScheduleType === 'TERJADWAL_LAIN' && c.scheduleStatusType !== 'TERJADWAL_LAIN') return false;

      // Filter by Type SO
      if (filterTypeSo !== 'ALL' && c.typeSo.toUpperCase() !== filterTypeSo.toUpperCase()) return false;

      // Filter Zona Hitam Only
      if (filterZonaOnly && !c.isZonaHitam) return false;

      // Filter Radius
      if (maxRadiusKm > 0 && c.coordinatesAvailable && c.distanceKm > maxRadiusKm) return false;

      // Search Query
      if (candidateSearchQuery.trim()) {
        const q = candidateSearchQuery.toLowerCase();
        return (
          c.store.code.toLowerCase().includes(q) ||
          c.store.name.toLowerCase().includes(q) ||
          (c.store.kabupaten && c.store.kabupaten.toLowerCase().includes(q)) ||
          (c.store.region && c.store.region.toLowerCase().includes(q)) ||
          (c.korlap && c.korlap.toLowerCase().includes(q)) ||
          c.typeSo.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [candidateRecommendations, filterScheduleType, filterTypeSo, filterZonaOnly, maxRadiusKm, candidateSearchQuery]);

  // Selected replacement store object
  const selectedCandidateObj = useMemo(() => {
    return candidateRecommendations.find(c => c.store.id === selectedCandidateStoreId)?.store || null;
  }, [candidateRecommendations, selectedCandidateStoreId]);

  // Handle Action Execution
  const handleExecuteSwap = () => {
    if (!selectedSchedule || !selectedSourceStore) {
      alert('Pilih toko asal yang minta pindah.');
      return;
    }

    if (!selectedCandidateObj) {
      alert('Pilih toko pengganti dari daftar rekomendasi.');
      return;
    }

    const fullReason = customReason.trim() ? `${reasonCategory} - ${customReason.trim()}` : reasonCategory;

    onApplyRelocation(
      selectedSchedule.id,
      'Pindah Toko',
      fullReason,
      {
        newStore: selectedCandidateObj,
        newDate: targetDateForReplacement || selectedSchedule.scheduledDate,
        newTime: targetTimeForReplacement || '21:00'
      }
    );

    setSwapExecuted({
      originalStore: selectedSourceStore,
      replacementStore: selectedCandidateObj,
      date: targetDateForReplacement || selectedSchedule.scheduledDate,
      reason: fullReason
    });
  };

  // WhatsApp Message Generator for SPV
  const waTemplateText = useMemo(() => {
    if (!selectedSchedule || !selectedSourceStore || !selectedCandidateObj) return '';
    const candDetail = candidateRecommendations.find(c => c.store.id === selectedCandidateObj.id);
    const fullReason = customReason.trim() ? `${reasonCategory} - ${customReason.trim()}` : reasonCategory;

    return `*PEMBERITAHUAN PINDAH TOKO & JADWAL STOCK OPNAME (BALI)*
━━━━━━━━━━━━━━━━━━━━
📅 *Tanggal Pelaksanaan:* ${formatDateIndo(targetDateForReplacement || selectedSchedule.scheduledDate)}
⏰ *Jam Mulai:* ${targetTimeForReplacement || '21:00'} WITA
👤 *Officer / Korlap PIC:* ${selectedSchedule.officerInCharge || selectedSourceStore.korlap || 'Tim Audit'}

❌ *TOKO ASAL (DIBATALKAN/PINDAH):*
• *Kode/Nama:* [${selectedSourceStore.code}] ${selectedSourceStore.name}
• *Wilayah:* ${selectedSourceStore.kabupaten || selectedSourceStore.region}
• *Alasan Pindah:* ${fullReason}

🔄 *REKOMENDASI TOKO PENGGANTI (FIX):*
• *Kode/Nama:* [${selectedCandidateObj.code}] ${selectedCandidateObj.name}
• *Wilayah/Kec:* ${selectedCandidateObj.kabupaten || selectedCandidateObj.region} (${selectedCandidateObj.district || ''})
• *Jarak dari Toko Asal:* ${candDetail ? `${candDetail.distanceKm} km` : '-'}
• *Type SO:* ${selectedCandidateObj.typeSo || selectedCandidateObj.qm || 'M'} | *Zona:* ${selectedCandidateObj.zona || 'REGULER'}
• *Saldo Toko / Stock:* ${typeof selectedCandidateObj.saldoToko === 'number' ? formatRupiah(selectedCandidateObj.saldoToko) : (selectedCandidateObj.saldoToko || '-')}
• *Status Jadwal Awal:* ${candDetail?.scheduleStatusType === 'BELUM_TERJADWAL' ? 'Belum Terjadwal (Kolom Blank Master)' : `Terjadwal (${candDetail?.scheduledDateMaster || '-'})`}

_Master Toko Bali & Jadwal telah disinkronkan otomatis oleh SPV._`;
  }, [selectedSchedule, selectedSourceStore, selectedCandidateObj, candidateRecommendations, targetDateForReplacement, targetTimeForReplacement, reasonCategory, customReason]);

  const handleCopyWA = () => {
    if (!waTemplateText) return;
    navigator.clipboard.writeText(waTemplateText);
    setCopiedWA(true);
    setTimeout(() => setCopiedWA(false), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Header Banner - Mobile Optimized */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-indigo-700/50 shadow-md relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded border border-indigo-400/30">
                  SPV ASSISTANT
                </span>
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Rekomendasi Pintar GPS
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
                Cek Opsi Pindah Toko & Rekomendasi Pengganti
              </h2>
              <p className="text-xs text-slate-300">
                Pilih toko yang bermasalah/minta pindah, sistem akan merekomendasikan toko terdekat yang belum terjadwal (kolom blank) atau opsi swap.
              </p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="self-end sm:self-center p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Success Notification if Swap Executed */}
      {swapExecuted && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 rounded-2xl p-4 text-emerald-100 shadow-md animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <h4 className="font-extrabold text-sm text-emerald-200">
                  Perpindahan Toko Berhasil Diterapkan & Master Toko Disinkronkan!
                </h4>
                <p className="text-xs text-emerald-300 mt-0.5">
                  Toko <strong>[{swapExecuted.originalStore.code}] {swapExecuted.originalStore.name}</strong> berhasil digantikan oleh <strong>[{swapExecuted.replacementStore.code}] {swapExecuted.replacementStore.name}</strong> untuk tanggal <strong>{formatDateIndo(swapExecuted.date)}</strong>.
                </p>
              </div>
            </div>
            <button
              onClick={handleCopyWA}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
            >
              {copiedWA ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedWA ? 'Tersalin!' : 'Salin Format WA'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main 2-Column Workflow Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* LEFT COLUMN: Step 1 (Pilih Toko Asal) & Step 2 (Alasan Pindah) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* STEP 1: Pilih Toko Yang Minta Pindah */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center">1</span>
                <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">
                  Pilih Toko Yang Minta Pindah
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-500 font-mono">
                {filteredSourceSchedules.length} Toko Aktif
              </span>
            </div>

            {/* Date Quick Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={sourceFilterDate}
                onChange={(e) => setSourceFilterDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800"
              >
                <option value="ALL">Semua Tanggal Jadwal</option>
                {availableScheduleDates.map(d => (
                  <option key={d} value={d}>{formatDateIndo(d)}</option>
                ))}
              </select>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Cari kode/nama toko asal..."
                value={sourceSearchQuery}
                onChange={(e) => setSourceSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>

            {/* Source Store List Selection (Scrollable) */}
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 text-xs">
              {filteredSourceSchedules.map(sch => {
                const isSelected = (selectedSchedule?.id === sch.id);
                const stObj = stores.find(s => s.code === sch.storeCode || s.id === sch.storeId);
                const isHitam = stObj?.isZonaHitam || String(stObj?.zona || '').toUpperCase().includes('HITAM');

                return (
                  <div
                    key={sch.id}
                    onClick={() => {
                      setSelectedSourceScheduleId(sch.id);
                      setSelectedCandidateStoreId('');
                    }}
                    className={`p-2.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-400/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-rose-900 bg-rose-100/80 px-1.5 py-0.2 rounded text-[10px]">
                            {sch.storeCode}
                          </span>
                          {isHitam && (
                            <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.2 rounded-full">
                              ZONA HITAM
                            </span>
                          )}
                        </div>
                        <p className="font-extrabold text-slate-900 text-xs mt-0.5 line-clamp-1">
                          {sch.storeName}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 font-mono shrink-0">
                        {sch.scheduledDate ? sch.scheduledDate.slice(5) : '-'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5 pt-1 border-t border-slate-100">
                      <span className="truncate max-w-[130px]">{stObj?.kabupaten || sch.region}</span>
                      <span className="font-medium text-indigo-700">{sch.officerInCharge || stObj?.korlap || 'Korlap'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Store Detail Card */}
            {selectedSourceStore && (
              <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
                  <span>Detail Toko Asal Terpilih</span>
                  <span className="text-amber-400 font-mono">{selectedSourceStore.code}</span>
                </div>
                <p className="font-black text-sm text-white">{selectedSourceStore.name}</p>
                
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300 pt-1 border-t border-slate-800">
                  <div>Wilayah: <strong className="text-white">{selectedSourceStore.kabupaten || selectedSourceStore.city || selectedSourceStore.region}</strong></div>
                  <div>Type SO: <strong className="text-amber-300">{selectedSourceStore.typeSo || selectedSourceStore.qm || 'M'}</strong></div>
                  <div>Stock: <strong className="text-emerald-300">{typeof selectedSourceStore.saldoToko === 'number' ? formatRupiah(selectedSourceStore.saldoToko) : (selectedSourceStore.saldoToko || '-')}</strong></div>
                  <div>Zona: <strong className={selectedSourceStore.isZonaHitam ? 'text-rose-400' : 'text-slate-200'}>{selectedSourceStore.zona || 'NON ZONA HITAM'}</strong></div>
                  <div>AM: <strong className="text-white">{selectedSourceStore.am || '-'}</strong></div>
                  <div>AS: <strong className="text-white">{selectedSourceStore.as || '-'}</strong></div>
                  <div className="col-span-2">Korlap: <strong className="text-indigo-300">{selectedSchedule?.officerInCharge || selectedSourceStore.korlap || '-'}</strong></div>
                </div>

                {selectedSourceStore.latitude && selectedSourceStore.longitude ? (
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-slate-800 px-2 py-1 rounded">
                    <MapPin className="w-3 h-3 text-emerald-400" />
                    <span>GPS Siap: {selectedSourceStore.latitude.toFixed(4)}, {selectedSourceStore.longitude.toFixed(4)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-400 bg-slate-800 px-2 py-1 rounded">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>Koordinat belum terdaftar (Jarak menggunakan estimasi wilayah)</span>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* STEP 2: Alasan Pindah & Tanggal Pelaksanaan */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">2</span>
              <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">
                Alasan Pindah & Waktu Audit
              </h3>
            </div>

            {/* Quick Reason Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Kategori Alasan Pindah:
              </label>
              <select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800"
              >
                <option value="Akses Jalan / Cuaca Ekstrem">Akses Jalan / Cuaca Ekstrem</option>
                <option value="Toko Sedang Renovasi / Perbaikan Listrik">Toko Sedang Renovasi / Perbaikan Listrik</option>
                <option value="Kendala Jaringan / Server Toko Offline">Kendala Jaringan / Server Toko Offline</option>
                <option value="Izin Pihak Mall / Pengelola Gedung">Izin Pihak Mall / Pengelola Gedung</option>
                <option value="Personil / Kendala Jumlah Auditor">Personil / Kendala Jumlah Auditor</option>
                <option value="Permintaan Khusus Area Manager / Toko">Permintaan Khusus Area Manager / Toko</option>
                <option value="Lainnya">Lainnya (Tuliskan di bawah)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Keterangan Tambahan (Opsional):
              </label>
              <textarea
                rows={2}
                placeholder="Contoh: Toko banjir setinggi 30cm, dialihkan ke toko terdekat..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  Tanggal Pengganti:
                </label>
                <input
                  type="date"
                  value={targetDateForReplacement}
                  onChange={(e) => setTargetDateForReplacement(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  Jam Mulai SO:
                </label>
                <input
                  type="time"
                  value={targetTimeForReplacement}
                  onChange={(e) => setTargetTimeForReplacement(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-800"
                />
              </div>
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: Step 3 (Rekomendasi Toko Terdekat & Opsi Pindah) */}
        <div className="lg:col-span-8 space-y-4">
          
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
            
            {/* Step 3 Header & Filter Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">3</span>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                    <span>Rekomendasi Toko Pengganti</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[11px] font-mono px-2 py-0.5 rounded-full font-bold">
                      {filteredCandidates.length} Opsi
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Diurutkan otomatis dari <strong>Jarak GPS Terdekat</strong> & <strong>Belum Terjadwal (Kolom Blank)</strong>
                  </p>
                </div>
              </div>

              {/* Quick Status Tab Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFilterScheduleType('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    filterScheduleType === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua ({candidateRecommendations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterScheduleType('BELUM_TERJADWAL')}
                  className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                    filterScheduleType === 'BELUM_TERJADWAL' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                  <span>Belum Terjadwal ({candidateRecommendations.filter(c => c.scheduleStatusType === 'BELUM_TERJADWAL').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterScheduleType('TERJADWAL_LAIN')}
                  className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                    filterScheduleType === 'TERJADWAL_LAIN' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-300" />
                  <span>Tukar Jadwal ({candidateRecommendations.filter(c => c.scheduleStatusType === 'TERJADWAL_LAIN').length})</span>
                </button>
              </div>
            </div>

            {/* Smart Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
              
              {/* Search */}
              <div className="relative sm:col-span-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari kode toko, nama toko, kabupaten, korlap..."
                  value={candidateSearchQuery}
                  onChange={(e) => setCandidateSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              {/* Type SO Filter */}
              <div>
                <select
                  value={filterTypeSo}
                  onChange={(e) => setFilterTypeSo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">Semua Type SO</option>
                  <option value="M">Type M (Monthly)</option>
                  <option value="Q3">Type Q3 (Quarterly 3)</option>
                  <option value="Q1">Type Q1</option>
                  <option value="Q2">Type Q2</option>
                </select>
              </div>

              {/* Max Radius & Zona Toggle */}
              <div className="flex items-center gap-2">
                <select
                  value={maxRadiusKm}
                  onChange={(e) => setMaxRadiusKm(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 font-bold text-slate-800"
                >
                  <option value={10}>Radius &lt; 10 km</option>
                  <option value={20}>Radius &lt; 20 km</option>
                  <option value={35}>Radius &lt; 35 km</option>
                  <option value={60}>Radius &lt; 60 km</option>
                  <option value={0}>Semua Jarak</option>
                </select>

                <button
                  type="button"
                  onClick={() => setFilterZonaOnly(!filterZonaOnly)}
                  className={`px-2.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 border ${
                    filterZonaOnly
                      ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                  title="Filter Toko Zona Hitam Saja"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Zona Hitam</span>
                </button>
              </div>

            </div>

            {/* Candidates Card List (Scrollable, mobile responsive) */}
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {filteredCandidates.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
                  <Navigation className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">Tidak ada toko rekomendasi yang cocok</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Coba perluas radius pencarian atau ubah filter status jadwal toko.
                  </p>
                </div>
              ) : (
                filteredCandidates.map((cand) => {
                  const isSelected = (selectedCandidateStoreId === cand.store.id);
                  const isBelumTerjadwal = cand.scheduleStatusType === 'BELUM_TERJADWAL';

                  return (
                    <div
                      key={cand.store.id}
                      onClick={() => setSelectedCandidateStoreId(cand.store.id)}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer relative overflow-hidden ${
                        isSelected
                          ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/30 shadow-md'
                          : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Top Badges Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Store Code */}
                          <span className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-slate-900 text-white">
                            {cand.store.code}
                          </span>

                          {/* Schedule Status Badge */}
                          {isBelumTerjadwal ? (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              🟢 Belum Terjadwal (Kolom Blank Master)
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                              🟡 Terjadwal: {cand.scheduledDateMaster || '-'} (Opsi Tukar)
                            </span>
                          )}

                          {/* Type SO Badge */}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                            Type {cand.typeSo}
                          </span>

                          {/* Zona Hitam Badge */}
                          {cand.isZonaHitam && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-600 text-white flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" /> ZONA HITAM
                            </span>
                          )}
                        </div>

                        {/* Distance Badge */}
                        <div className="flex items-center gap-1.5 bg-slate-900 text-white px-2.5 py-1 rounded-xl font-mono text-xs font-bold">
                          <Navigation className="w-3 h-3 text-indigo-400" />
                          <span>{cand.distanceKm < 900 ? `${cand.distanceKm} km` : 'Wilayah Sama'}</span>
                        </div>
                      </div>

                      {/* Store Title & Location */}
                      <div className="mt-2">
                        <h4 className="font-extrabold text-sm text-slate-900">
                          {cand.store.name}
                        </h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Kab. {cand.store.kabupaten || cand.store.city || cand.store.region} - {cand.store.address}</span>
                        </p>
                      </div>

                      {/* Detail Metrics Row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 mt-2.5 pt-2 border-t border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Saldo Toko / Stock</span>
                          <strong className="text-slate-900 font-mono">
                            {typeof cand.saldoToko === 'number' ? formatRupiah(cand.saldoToko) : (cand.saldoToko || '-')}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">AM / AS</span>
                          <strong className="text-slate-900">{cand.am || '-'}{cand.as ? ` / ${cand.as}` : ''}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Korlap / Officer</span>
                          <strong className="text-indigo-700">{cand.korlap || 'Master Personil'}</strong>
                        </div>
                        <div className="text-right flex items-center justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCandidateStoreId(cand.store.id);
                            }}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1 cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-indigo-100 hover:text-indigo-900'
                            }`}
                          >
                            {isSelected ? <Check className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            <span>{isSelected ? 'Toko Dipilih' : 'Pilih Toko'}</span>
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Action Execution Bar */}
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                {selectedCandidateObj ? (
                  <p>
                    Toko Pengganti Terpilih: <strong className="text-indigo-700">[{selectedCandidateObj.code}] {selectedCandidateObj.name}</strong>
                  </p>
                ) : (
                  <p className="text-slate-400 italic">
                    Silakan klik salah satu toko rekomendasi di atas untuk menggantikan jadwal.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedCandidateObj && (
                  <button
                    type="button"
                    onClick={handleCopyWA}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedWA ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWA ? 'Tersalin' : 'Format WA'}</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={!selectedSchedule || !selectedCandidateObj}
                  onClick={handleExecuteSwap}
                  className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                    selectedSchedule && selectedCandidateObj
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Terapkan Pindah Toko & Sinkronisasi Master</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

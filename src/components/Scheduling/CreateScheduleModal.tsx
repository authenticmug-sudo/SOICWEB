import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Calendar, 
  Building2, 
  Users, 
  FileText, 
  UserCheck, 
  AlertTriangle, 
  Sparkles, 
  MapPin, 
  DollarSign, 
  ShieldAlert, 
  CheckCircle2, 
  Navigation, 
  Compass, 
  Route, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Filter, 
  Layers, 
  Check, 
  Search, 
  ChevronRight,
  Clock
} from 'lucide-react';
import { Store, SOTeam, SOSchedule, AuditorPersonnel } from '../../types/stockOpname';
import { formatDateISO, formatRupiah, formatSmartSODate } from '../../utils/formatters';
import { getDayNameIndo } from '../../utils/storeSyncUtils';
import { SearchableStoreSelect } from '../Common/SearchableStoreSelect';
import { BALI_KORLAP_GROUPS } from '../../data/baliData';
import { 
  calculateHaversineDistance, 
  extractKabupatenKecamatanMap, 
  normalizeKabupaten, 
  normalizeKecamatan 
} from '../../utils/geoUtils';

interface CreateScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  stores: Store[];
  teams: SOTeam[];
  existingSchedules?: SOSchedule[];
  personnel?: AuditorPersonnel[];
  onCreateSchedule: (newSchedule: Omit<SOSchedule, 'id' | 'createdAt'>) => void;
  onBatchCreateSchedules?: (newSchedules: SOSchedule[]) => void;
}

export const CreateScheduleModal: React.FC<CreateScheduleModalProps> = ({
  isOpen,
  onClose,
  stores,
  teams,
  existingSchedules = [],
  personnel = [],
  onCreateSchedule,
  onBatchCreateSchedules
}) => {
  // Modal Mode: Multi-Store Route Builder (default) vs Single Store
  const [scheduleMode, setScheduleMode] = useState<'MULTI_ROUTE' | 'SINGLE'>('MULTI_ROUTE');

  // Multi-Store Queue for the current Korlap session
  const [selectedStoreQueue, setSelectedStoreQueue] = useState<Store[]>([]);

  // Single Store Mode state
  const [selectedSingleStoreId, setSelectedSingleStoreId] = useState(stores[0]?.id || '');
  const [customAnchorStoreId, setCustomAnchorStoreId] = useState<string>('');

  // General Schedule Configuration
  const [scheduledDate, setScheduledDate] = useState(() => formatDateISO(new Date()));
  const [scheduledTime, setScheduledTime] = useState('08:00');
  const [selectedTeamCategory, setSelectedTeamCategory] = useState<string>('TEAM 1');
  const [selectedGroupKorlap, setSelectedGroupKorlap] = useState<string>('I WAYAN ANGGA RISTA');
  const [selectedPersonilLeader, setSelectedPersonilLeader] = useState<string>('');
  const [allocatedPersonnelIds, setAllocatedPersonnelIds] = useState<string[]>([]);
  const [autoSyncHariH, setAutoSyncHariH] = useState<boolean>(true);
  const [notes, setNotes] = useState('');

  // Filters for Master Toko Bali (Kabupaten & Kecamatan)
  const [filterKabupaten, setFilterKabupaten] = useState<string>('ALL');
  const [filterKecamatan, setFilterKecamatan] = useState<string>('ALL');
  const [storeSearchQuery, setStoreSearchQuery] = useState<string>('');
  const [sortStoresByDistance, setSortStoresByDistance] = useState<boolean>(true);

  // Duplicate Check confirmation
  const [pendingDuplicateCheck, setPendingDuplicateCheck] = useState<{
    stores: Store[];
    previousDateInfo: string;
    payloads: Array<Omit<SOSchedule, 'id' | 'createdAt'>>;
  } | null>(null);

  // Extract distinct Kabupaten and Kecamatan lists from stores
  const { kabupatenList, kecamatanByKabupaten } = useMemo(() => {
    return extractKabupatenKecamatanMap(stores);
  }, [stores]);

  const availableKecamatans = useMemo(() => {
    if (filterKabupaten === 'ALL') {
      const set = new Set<string>();
      (Object.values(kecamatanByKabupaten) as string[][]).forEach(list => {
        list.forEach(k => set.add(k));
      });
      return Array.from(set).sort();
    }
    return kecamatanByKabupaten[filterKabupaten] || [];
  }, [filterKabupaten, kecamatanByKabupaten]);

  // Reset Kecamatan if selected Kabupaten changes
  const handleKabupatenFilterChange = (kab: string) => {
    setFilterKabupaten(kab);
    setFilterKecamatan('ALL');
  };

  // Selected Store Object for single store mode
  const selectedSingleStore = useMemo(() => {
    return stores.find(s => s.id === selectedSingleStoreId) || stores.find(s => s.code === selectedSingleStoreId) || stores[0];
  }, [stores, selectedSingleStoreId]);

  // Stores already scheduled on the same date for the selected group
  const storesOnSameDateAndGroup = useMemo(() => {
    return existingSchedules
      .filter(s => 
        s.scheduledDate === scheduledDate &&
        s.status !== 'Dibatalkan' &&
        ((s.officerInCharge && s.officerInCharge.includes(selectedGroupKorlap)) || 
         (s.groupName && s.groupName.includes(selectedGroupKorlap)))
      )
      .map(s => {
        const matched = stores.find(st => st.id === s.storeId || st.code === s.storeCode);
        return {
          schedule: s,
          store: matched || ({
            id: s.storeId,
            code: s.storeCode,
            name: s.storeName,
            region: s.region,
            address: '-',
            city: s.region || 'Bali',
            storeType: 'Regular Minimarket' as const,
            managerName: '-',
            phone: '-'
          } as Store)
        };
      });
  }, [existingSchedules, scheduledDate, selectedGroupKorlap, stores]);

  // Active anchor store for distance calculation in single store mode
  const activeAnchorStore = useMemo<Store | null>(() => {
    if (customAnchorStoreId) {
      return stores.find(s => s.id === customAnchorStoreId || s.code === customAnchorStoreId) || null;
    }
    if (selectedStoreQueue.length > 0) {
      return selectedStoreQueue[selectedStoreQueue.length - 1];
    }
    if (storesOnSameDateAndGroup.length > 0) {
      return storesOnSameDateAndGroup[storesOnSameDateAndGroup.length - 1].store;
    }
    return null;
  }, [customAnchorStoreId, selectedStoreQueue, stores, storesOnSameDateAndGroup]);

  // Filtered Master Store List based on Kabupaten, Kecamatan, and Search Query
  const filteredMasterStores = useMemo(() => {
    const q = storeSearchQuery.toLowerCase().trim();
    const qClean = q.replace(/[^a-z0-9]/g, '');

    // Reference point for distance sorting in list
    const refStore = selectedStoreQueue.length > 0 
      ? selectedStoreQueue[selectedStoreQueue.length - 1] 
      : activeAnchorStore;

    let list = stores;

    // 1. Filter by Kabupaten
    if (filterKabupaten !== 'ALL') {
      list = list.filter(s => {
        const kab = normalizeKabupaten(s.kabupaten, s.region, s.city);
        return kab.toLowerCase() === filterKabupaten.toLowerCase();
      });
    }

    // 2. Filter by Kecamatan
    if (filterKecamatan !== 'ALL') {
      list = list.filter(s => {
        const kec = normalizeKecamatan(s.kecamatan, s.district, s.name);
        return kec.toLowerCase() === filterKecamatan.toLowerCase();
      });
    }

    // 3. Search Query scoring
    const scoredList = list.map(store => {
      let score = 100;
      let dist: number | null = null;

      if (refStore && refStore.latitude && refStore.longitude && store.latitude && store.longitude && refStore.id !== store.id) {
        dist = calculateHaversineDistance(refStore.latitude, refStore.longitude, store.latitude, store.longitude);
      } else if (refStore && (refStore.id === store.id || refStore.code === store.code)) {
        dist = 0;
      }

      if (q) {
        const code = (store.code || '').toLowerCase();
        const codeClean = code.replace(/[^a-z0-9]/g, '');
        const name = (store.name || '').toLowerCase();
        const region = (store.region || '').toLowerCase();
        const kab = (store.kabupaten || '').toLowerCase();
        const kec = (store.kecamatan || store.district || '').toLowerCase();

        if (code === q || codeClean === qClean) score += 1000;
        else if (code.startsWith(q) || codeClean.startsWith(qClean)) score += 500;
        else if (code.includes(q)) score += 200;

        if (name === q) score += 800;
        else if (name.startsWith(q)) score += 400;
        else if (name.includes(q)) score += 150;

        if (region.includes(q) || kab.includes(q) || kec.includes(q)) score += 100;
      }

      return { store, score, distance: dist };
    });

    if (q) {
      return scoredList
        .filter(item => item.score > 100)
        .sort((a, b) => {
          if (sortStoresByDistance && a.distance !== null && b.distance !== null) {
            return a.distance - b.distance;
          }
          return b.score - a.score;
        });
    }

    if (sortStoresByDistance && refStore) {
      return scoredList.sort((a, b) => {
        if (a.distance === null && b.distance === null) return a.store.name.localeCompare(b.store.name);
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }

    return scoredList.sort((a, b) => a.store.name.localeCompare(b.store.name));
  }, [stores, filterKabupaten, filterKecamatan, storeSearchQuery, selectedStoreQueue, activeAnchorStore, sortStoresByDistance]);

  // Real-Time Chain Distances Calculation for the Selected Store Queue
  const routeLegs = useMemo(() => {
    const legs: Array<{
      fromStore: Store | null;
      toStore: Store;
      distanceKm: number | null;
      cumulativeKm: number;
    }> = [];

    let totalKm = 0;

    for (let i = 0; i < selectedStoreQueue.length; i++) {
      const currentStore = selectedStoreQueue[i];
      if (i === 0) {
        legs.push({
          fromStore: null,
          toStore: currentStore,
          distanceKm: 0,
          cumulativeKm: 0
        });
      } else {
        const prevStore = selectedStoreQueue[i - 1];
        let legDist: number | null = null;

        if (prevStore.latitude && prevStore.longitude && currentStore.latitude && currentStore.longitude) {
          legDist = calculateHaversineDistance(
            prevStore.latitude,
            prevStore.longitude,
            currentStore.latitude,
            currentStore.longitude
          );
          totalKm += legDist;
        }

        legs.push({
          fromStore: prevStore,
          toStore: currentStore,
          distanceKm: legDist,
          cumulativeKm: Math.round(totalKm * 10) / 10
        });
      }
    }

    return {
      legs,
      totalDistanceKm: Math.round(totalKm * 10) / 10,
      totalStores: selectedStoreQueue.length
    };
  }, [selectedStoreQueue]);

  // List of all Korlap / Groups available
  const availableKorlaps = useMemo(() => {
    const fromPersonnel = personnel
      .filter(p => p.role === 'Officer / Korlap' || (p.korlapName && p.korlapName === p.name))
      .map(p => p.name);
    const fromHardcoded = Object.keys(BALI_KORLAP_GROUPS);
    const combined = Array.from(new Set([...fromHardcoded, ...fromPersonnel, 'I WAYAN ANGGA RISTA', 'ODI TRI ANGGARA', 'ANGGA ARDIYANSYAH', 'ABDUL RAHMAN', 'I GEDE PASEK SANTIKA', 'PUTU BISMA'])).filter(Boolean);
    return combined;
  }, [personnel]);

  // Sync Korlap group when modal opens
  useEffect(() => {
    if (availableKorlaps.length > 0 && !selectedGroupKorlap) {
      setSelectedGroupKorlap(availableKorlaps[0]);
    }
  }, [availableKorlaps, selectedGroupKorlap]);

  // Filtered personnel strictly under the selected Korlap / Group
  const membersUnderSelectedKorlap = useMemo(() => {
    if (!selectedGroupKorlap) return [];
    const cleanGroup = selectedGroupKorlap.toLowerCase();
    
    // Check in full personnel database
    const dbMembers = personnel.filter(p => {
      const pKorlap = (p.korlapName || '').toLowerCase();
      const pName = p.name.toLowerCase();
      return pKorlap.includes(cleanGroup) || cleanGroup.includes(pKorlap) || pName.includes(cleanGroup);
    });

    if (dbMembers.length > 0) return dbMembers;

    // Fallback: check BALI_KORLAP_GROUPS lookup
    const foundKey = Object.keys(BALI_KORLAP_GROUPS).find(k => k.toLowerCase().includes(cleanGroup) || cleanGroup.includes(k.toLowerCase()));
    if (foundKey && BALI_KORLAP_GROUPS[foundKey]) {
      return BALI_KORLAP_GROUPS[foundKey].map((mName, idx) => ({
        id: `PERS-DYNAMIC-${cleanGroup}-${idx}`,
        nik: `NIK-${idx + 100}`,
        name: mName,
        role: idx < 2 ? 'Koordinator' : 'Anggota',
        korlapName: selectedGroupKorlap,
        phone: '08123456789',
        domisili: 'Bali',
        status: 'Aktif' as const,
        joinDate: '2024-01-01'
      }));
    }

    return [];
  }, [selectedGroupKorlap, personnel]);

  // Update Personil Leader and default allocations when Korlap changes
  useEffect(() => {
    if (membersUnderSelectedKorlap.length > 0) {
      const firstMember = membersUnderSelectedKorlap[0];
      setSelectedPersonilLeader(firstMember.name);
      setAllocatedPersonnelIds([firstMember.id]);
    } else {
      setSelectedPersonilLeader(selectedGroupKorlap);
      setAllocatedPersonnelIds([]);
    }
  }, [selectedGroupKorlap, membersUnderSelectedKorlap]);

  if (!isOpen) return null;

  // Indonesian day name derived from selected date
  const calculatedDay = getDayNameIndo(scheduledDate) || 'SELASA';

  // Toggle auditor checkbox
  const handleToggleAuditor = (personId: string) => {
    setAllocatedPersonnelIds(prev => 
      prev.includes(personId) ? prev.filter(id => id !== personId) : [...prev, personId]
    );
  };

  const handleSelectAllAuditors = () => {
    setAllocatedPersonnelIds(membersUnderSelectedKorlap.map(p => p.id));
  };

  const handleDeselectAllAuditors = () => {
    setAllocatedPersonnelIds([]);
  };

  // Add store to multi-store route queue
  const handleAddStoreToQueue = (store: Store) => {
    if (selectedStoreQueue.some(s => s.id === store.id || s.code === store.code)) {
      return; // Already added
    }
    setSelectedStoreQueue(prev => [...prev, store]);
  };

  // Remove store from multi-store route queue
  const handleRemoveStoreFromQueue = (storeId: string) => {
    setSelectedStoreQueue(prev => prev.filter(s => s.id !== storeId && s.code !== storeId));
  };

  // Reorder store in route queue
  const handleMoveStore = (index: number, direction: 'UP' | 'DOWN') => {
    if (direction === 'UP' && index > 0) {
      setSelectedStoreQueue(prev => {
        const next = [...prev];
        const temp = next[index - 1];
        next[index - 1] = next[index];
        next[index] = temp;
        return next;
      });
    } else if (direction === 'DOWN' && index < selectedStoreQueue.length - 1) {
      setSelectedStoreQueue(prev => {
        const next = [...prev];
        const temp = next[index + 1];
        next[index + 1] = next[index];
        next[index] = temp;
        return next;
      });
    }
  };

  // Handle Save (Single or Batch Multi-Store)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const targetStoresToSchedule = scheduleMode === 'MULTI_ROUTE' 
      ? selectedStoreQueue 
      : (selectedSingleStore ? [selectedSingleStore] : []);

    if (targetStoresToSchedule.length === 0) {
      alert('Mohon pilih minimal 1 toko untuk dibuatkan jadwal SO.');
      return;
    }

    const assignedPersons = membersUnderSelectedKorlap.filter(p => allocatedPersonnelIds.includes(p.id));
    const allocatedNamesList = assignedPersons.map(p => `${p.name} (${p.role})`);
    if (selectedPersonilLeader && !allocatedNamesList.some(n => n.includes(selectedPersonilLeader))) {
      allocatedNamesList.unshift(`${selectedPersonilLeader} (Leader/Koordinator)`);
    }

    const fullNotes = notes ? `${notes} [Group: ${selectedGroupKorlap} | Leader: ${selectedPersonilLeader}]` : `Group SO: ${selectedGroupKorlap} (Leader: ${selectedPersonilLeader})`;

    // Build payload list
    const payloads: Array<Omit<SOSchedule, 'id' | 'createdAt'>> = targetStoresToSchedule.map((store, idx) => ({
      storeId: store.id,
      storeCode: store.code,
      storeName: store.name,
      region: store.region || store.kabupaten || 'Kab. Badung',
      scheduledDate,
      scheduledTime,
      teamId: `TEAM-${selectedTeamCategory.replace(/\s+/g, '-')}`,
      teamName: selectedTeamCategory,
      teamCategory: selectedTeamCategory,
      spvInCharge: 'I GEDE PASEK SANTIKA',
      officerInCharge: selectedGroupKorlap,
      groupName: selectedGroupKorlap,
      personilLeader: selectedPersonilLeader,
      dayName: calculatedDay,
      stockRp: store.saldoToko || 0,
      kasToko: store.kasToko || 0,
      typeSo: store.typeSo || store.qm || 'M',
      zona: store.zona || (store.isZonaHitam ? 'ZONA HITAM' : 'NON ZONA HITAM'),
      asInitial: store.as || '',
      status: 'Terjadwal',
      spvApprovalStatus: 'Menunggu Approval SPV',
      targetSKUCount: store.totalSKUCount || 1000,
      assignedPersonnelIds: allocatedPersonnelIds,
      assignedPersonnelNames: allocatedNamesList.length > 0 ? allocatedNamesList : [selectedPersonilLeader || selectedGroupKorlap],
      notes: targetStoresToSchedule.length > 1 ? `${fullNotes} [Rute Stop #${idx + 1}]` : fullNotes
    }));

    // Check if any of the target stores already have SO in the same month
    const targetMonth = scheduledDate.slice(0, 7); // '2026-09'
    const duplicateStores = targetStoresToSchedule.filter(store => {
      const hasExistingSchedule = existingSchedules.some(s => 
        (s.storeId === store.id || s.storeCode === store.code) && 
        s.scheduledDate.startsWith(targetMonth) &&
        s.status !== 'Dibatalkan'
      );
      const hasSeptemberMaster = targetMonth === '2026-09' && Boolean(store.soSeptember && store.soSeptember.trim() !== '' && store.soSeptember !== '-');
      return hasExistingSchedule || hasSeptemberMaster;
    });

    if (duplicateStores.length > 0) {
      const dupInfo = duplicateStores.map(st => `[${st.code}] ${st.name}`).join(', ');
      setPendingDuplicateCheck({
        stores: duplicateStores,
        previousDateInfo: `${duplicateStores.length} toko (${dupInfo}) sudah terdaftar jadwal SO pada ${targetMonth}`,
        payloads
      });
      return;
    }

    executeCreateSchedules(payloads);
  };

  const executeCreateSchedules = (payloads: Array<Omit<SOSchedule, 'id' | 'createdAt'>>) => {
    if (onBatchCreateSchedules && payloads.length > 1) {
      const fullSchedules: SOSchedule[] = payloads.map((p, idx) => ({
        ...p,
        id: `SCHED-MANUAL-${Date.now()}-${idx}`,
        createdAt: new Date().toISOString()
      }));
      onBatchCreateSchedules(fullSchedules);
    } else {
      payloads.forEach(p => onCreateSchedule(p));
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-white">Buat Penjadwalan Team SO Harian</h3>
                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 font-bold px-2 py-0.5 rounded-full border border-indigo-400/30">
                  Master Toko Bali
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Pilih Korlap, filter Kabupaten & Kecamatan, dan ketuk tombol tambah untuk membentuk rute SO otomatis dengan jarak GPS
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="bg-slate-100/90 px-6 py-2.5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setScheduleMode('MULTI_ROUTE')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition ${
                scheduleMode === 'MULTI_ROUTE'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Pilih Banyak Toko (+ Tambah Rute)</span>
              {selectedStoreQueue.length > 0 && (
                <span className="bg-white/20 text-white px-1.5 py-0.2 rounded-full text-[10px]">
                  {selectedStoreQueue.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setScheduleMode('SINGLE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                scheduleMode === 'SINGLE'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Form 1 Toko Tunggal</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-semibold hidden md:flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Auto Jarak GPS & Filter Wilayah</span>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* SECTION 1: Korlap, Tanggal, Jam & Team Selector */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 space-y-3.5 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Korlap Selector */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-indigo-300 mb-1 flex items-center justify-between">
                  <span>🎯 Kolom GROUP (Pilih Korlap):</span>
                  <span className="text-[10px] text-indigo-400">6 Korlap Utama</span>
                </label>
                <select
                  value={selectedGroupKorlap}
                  onChange={(e) => setSelectedGroupKorlap(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl text-xs p-2.5 text-white font-extrabold focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                  required
                >
                  {availableKorlaps.map(k => (
                    <option key={k} value={k}>
                      {k} (Group Korlap)
                    </option>
                  ))}
                </select>
              </div>

              {/* Tanggal SO */}
              <div>
                <label className="block text-xs font-bold text-indigo-300 mb-1">
                  📅 Tanggal SO:
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl text-xs p-2.5 text-white font-bold font-mono focus:outline-none focus:border-indigo-400"
                  required
                />
              </div>

              {/* Jam Pelaksanaan */}
              <div>
                <label className="block text-xs font-bold text-indigo-300 mb-1">
                  ⏰ Jam Pelaksanaan:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl text-xs p-2.5 text-white font-mono focus:outline-none focus:border-indigo-400"
                    required
                  />
                  <div className="px-2.5 py-2 rounded-xl bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 font-mono font-bold text-xs shrink-0">
                    {calculatedDay}
                  </div>
                </div>
              </div>
            </div>

            {/* Team Category & Personil Leader */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  👥 Kolom TEAM:
                </label>
                <select
                  value={selectedTeamCategory}
                  onChange={(e) => setSelectedTeamCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl text-xs p-2 text-white font-bold focus:outline-none focus:border-indigo-400"
                >
                  <option value="TEAM 1">TEAM 1</option>
                  <option value="TEAM 2">TEAM 2</option>
                  <option value="TEAM 3">TEAM 3</option>
                  <option value="TEAM 4">TEAM 4</option>
                  <option value="TEAM 5">TEAM 5</option>
                  <option value="TEAM GABUNG">TEAM GABUNG</option>
                  <option value="TEAM SPECIAL">TEAM SPECIAL / AKTIVA</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                  <span>👤 Personil Leader / Koordinator:</span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    {membersUnderSelectedKorlap.length} Anggota
                  </span>
                </label>
                <select
                  value={selectedPersonilLeader}
                  onChange={(e) => {
                    setSelectedPersonilLeader(e.target.value);
                    const matched = membersUnderSelectedKorlap.find(m => m.name === e.target.value);
                    if (matched && !allocatedPersonnelIds.includes(matched.id)) {
                      setAllocatedPersonnelIds(prev => [...prev, matched.id]);
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl text-xs p-2 text-white font-bold focus:outline-none focus:border-indigo-400"
                  required
                >
                  {membersUnderSelectedKorlap.map(m => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.role || 'Auditor'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: MULTI-ROUTE STORE SELECTOR (User requested "+ Tambah Toko" with Kabupaten & Kecamatan Filter) */}
          {scheduleMode === 'MULTI_ROUTE' ? (
            <div className="space-y-4">
              
              {/* Header Title for Route Queue */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Route className="w-4 h-4 text-indigo-600" />
                    <span>Daftar Toko SO Terpilih Korlap: <strong>{selectedGroupKorlap}</strong></span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Jarak antar toko dihitung otomatis secara berurutan sesuai titik koordinat GPS Master Toko.
                  </p>
                </div>

                {selectedStoreQueue.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedStoreQueue([])}
                    className="text-[11px] text-rose-600 hover:text-rose-800 font-bold px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 transition"
                  >
                    Bersihkan Rute
                  </button>
                )}
              </div>

              {/* RUTE TOKO QUEUE CONTAINER (Real-Time Chain Distance & Store Cards) */}
              <div className="bg-slate-50 rounded-2xl border-2 border-indigo-200/80 p-3.5 sm:p-4 space-y-3">
                {selectedStoreQueue.length === 0 ? (
                  <div className="py-6 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-1.5 text-slate-300 stroke-1" />
                    <p className="text-xs font-bold text-slate-600">Belum ada toko yang ditambahkan ke rute Korlap ini</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Gunakan filter Kabupaten/Kecamatan di bawah dan ketuk tombol <strong>[+ Tambah]</strong> pada toko yang akan di-SO.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {/* Summary Bar */}
                    <div className="flex items-center justify-between bg-indigo-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <span className="bg-indigo-700 px-2 py-0.5 rounded-md text-[11px] font-mono">
                          {selectedStoreQueue.length} Toko Terpilih
                        </span>
                        <span>Total Jarak Rute: <strong>{routeLegs.totalDistanceKm} km</strong></span>
                      </div>
                      <span className="text-[10px] text-indigo-200">
                        {routeLegs.totalDistanceKm <= 15 ? '✓ Rute Efisien / Berdekatan' : '⚠️ Rute Membutuhkan Estimasi Waktu Tempuh'}
                      </span>
                    </div>

                    {/* Step-by-Step Leg Chain */}
                    <div className="space-y-2">
                      {routeLegs.legs.map((leg, index) => {
                        const store = leg.toStore;
                        const isFirst = index === 0;

                        return (
                          <div key={store.id} className="relative">
                            {/* Distance indicator between previous store and current store */}
                            {!isFirst && leg.distanceKm !== null && (
                              <div className="flex items-center gap-2 my-1 px-4 text-[10px] text-indigo-700 font-bold">
                                <div className="h-4 w-0.5 bg-indigo-300 ml-3" />
                                <span className={`px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                  leg.distanceKm <= 10
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : leg.distanceKm <= 25
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-rose-50 text-rose-800 border-rose-300'
                                }`}>
                                  <Navigation className="w-2.5 h-2.5" />
                                  ➔ Jarak dari Toko #{index}: <strong>{leg.distanceKm} km</strong> (Kumulatif: {leg.cumulativeKm} km)
                                </span>
                              </div>
                            )}

                            {/* Store Card in Queue */}
                            <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs hover:border-indigo-300 transition flex items-center justify-between gap-2">
                              
                              <div className="flex items-center gap-3 overflow-hidden flex-1">
                                {/* Order Badge */}
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-900 flex items-center justify-center font-black text-xs shrink-0">
                                  #{index + 1}
                                </div>

                                {/* Store Details */}
                                <div className="truncate flex-1">
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-black text-xs shrink-0">
                                      {store.code}
                                    </span>
                                    <span className="font-extrabold text-slate-900 text-xs truncate">
                                      {store.name}
                                    </span>
                                    <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase shrink-0 ${
                                      (store.zona || '').toUpperCase().includes('HITAM') || store.isZonaHitam
                                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    }`}>
                                      {store.zona || (store.isZonaHitam ? 'ZONA HITAM' : 'NON HITAM')}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                                    <span className="flex items-center gap-0.5">
                                      <MapPin className="w-2.5 h-2.5 text-slate-400" />
                                      {store.kabupaten || store.region || store.city || 'Bali'} • Kec. {store.kecamatan || store.district || '-'}
                                    </span>
                                    <span>Saldo: <strong>{formatRupiah(store.saldoToko || 0)}</strong></span>
                                    {store.kasToko ? <span>Kas: <strong className="text-emerald-700">{formatRupiah(store.kasToko)}</strong></span> : null}
                                    {isFirst && (
                                      <span className="text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.2 rounded">
                                        📍 Titik Awal Rute
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Actions: Reorder and Remove */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleMoveStore(index, 'UP')}
                                  disabled={index === 0}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition"
                                  title="Geser ke atas"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveStore(index, 'DOWN')}
                                  disabled={index === selectedStoreQueue.length - 1}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition"
                                  title="Geser ke bawah"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStoreFromQueue(store.id)}
                                  className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition ml-1"
                                  title="Hapus dari antrian"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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

              {/* FILTER & MASTER STORE SEARCH SECTION */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Filter className="w-4 h-4 text-indigo-600" />
                    <span>Pilih Toko dari Master Toko Bali (Filter Kabupaten & Kecamatan):</span>
                  </span>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    {filteredMasterStores.length} Toko Ditemukan
                  </span>
                </div>

                {/* Filter Dropdowns */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Kabupaten Filter */}
                  <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-300 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 shrink-0">Kabupaten:</span>
                    <select
                      value={filterKabupaten}
                      onChange={(e) => handleKabupatenFilterChange(e.target.value)}
                      className="w-full bg-transparent text-slate-900 font-bold text-xs focus:outline-none cursor-pointer truncate"
                    >
                      <option value="ALL">Semua Kabupaten ({kabupatenList.length})</option>
                      {kabupatenList.map(kab => (
                        <option key={kab} value={kab}>{kab}</option>
                      ))}
                    </select>
                  </div>

                  {/* Kecamatan Filter */}
                  <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-300 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 shrink-0">Kecamatan:</span>
                    <select
                      value={filterKecamatan}
                      onChange={(e) => setFilterKecamatan(e.target.value)}
                      disabled={availableKecamatans.length === 0}
                      className="w-full bg-transparent text-slate-900 font-bold text-xs focus:outline-none cursor-pointer truncate disabled:text-slate-400"
                    >
                      <option value="ALL">
                        {filterKabupaten === 'ALL' ? 'Semua Kecamatan' : `Semua Kec. di ${filterKabupaten}`} ({availableKecamatans.length})
                      </option>
                      {availableKecamatans.map(kec => (
                        <option key={kec} value={kec}>{kec}</option>
                      ))}
                    </select>
                  </div>

                  {/* Search Input Bar */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={storeSearchQuery}
                      onChange={(e) => setStoreSearchQuery(e.target.value)}
                      placeholder="Cari kode (F010) atau nama..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl text-xs pl-8 pr-7 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-medium"
                    />
                    {storeSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setStoreSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Status & Sort Toggle */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <div className="flex items-center gap-2">
                    <span>
                      Wilayah Aktif: <strong>{filterKabupaten === 'ALL' ? 'Seluruh Bali' : filterKabupaten}</strong>
                      {filterKecamatan !== 'ALL' && ` • Kec. ${filterKecamatan}`}
                    </span>
                    {(filterKabupaten !== 'ALL' || filterKecamatan !== 'ALL' || storeSearchQuery) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFilterKabupaten('ALL');
                          setFilterKecamatan('ALL');
                          setStoreSearchQuery('');
                        }}
                        className="text-rose-600 font-bold hover:underline"
                      >
                        (Reset Filter)
                      </button>
                    )}
                  </div>

                  <label className="flex items-center gap-1 cursor-pointer select-none text-indigo-700 font-bold">
                    <input
                      type="checkbox"
                      checked={sortStoresByDistance}
                      onChange={(e) => setSortStoresByDistance(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <span>Urutkan Jarak GPS Terdekat</span>
                  </label>
                </div>

                {/* MASTER STORE SELECTION CARDS LIST */}
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50">
                  {filteredMasterStores.length === 0 ? (
                    <div className="p-6 text-center text-slate-400">
                      <Building2 className="w-6 h-6 mx-auto mb-1 text-slate-300 stroke-1" />
                      <p className="text-xs font-semibold text-slate-600">Tidak ada toko yang cocok dengan filter</p>
                      <p className="text-[11px] text-slate-400">Coba ubah filter kabupaten atau hapus kata kunci pencarian</p>
                    </div>
                  ) : (
                    filteredMasterStores.slice(0, 50).map(({ store, distance }) => {
                      const isAlreadyAdded = selectedStoreQueue.some(s => s.id === store.id || s.code === store.code);

                      return (
                        <div
                          key={store.id}
                          className={`p-2.5 px-3 flex items-center justify-between gap-2 transition ${
                            isAlreadyAdded 
                              ? 'bg-emerald-50/70 border-l-4 border-l-emerald-500' 
                              : 'hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono font-bold text-[11px] shrink-0">
                              [{store.code}]
                            </span>
                            <div className="truncate">
                              <div className="text-xs font-extrabold text-slate-900 truncate flex items-center gap-1.5">
                                <span>{store.name}</span>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                                  (store.zona || '').toUpperCase().includes('HITAM') || store.isZonaHitam
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {store.zona || (store.isZonaHitam ? 'HITAM' : 'NON HITAM')}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                                <span className="flex items-center gap-0.5">
                                  <MapPin className="w-2.5 h-2.5 text-slate-400" />
                                  {store.kabupaten || store.region || store.city || 'Bali'} • Kec. {store.kecamatan || store.district || '-'}
                                </span>
                                <span>• Saldo: {formatRupiah(store.saldoToko || 0)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right Side: Distance Badge & Add Button */}
                          <div className="flex items-center gap-2 shrink-0">
                            {distance !== null && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                                distance <= 10
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : distance <= 25
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-rose-100 text-rose-800 border-rose-300'
                              }`}>
                                <Navigation className="w-2.5 h-2.5" />
                                {distance === 0 ? 'Titik Acuan' : `+${distance} km`}
                              </span>
                            )}

                            {isAlreadyAdded ? (
                              <button
                                type="button"
                                onClick={() => handleRemoveStoreFromQueue(store.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center gap-1 shadow-2xs hover:bg-emerald-700 transition"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Ditambahkan</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddStoreToQueue(store)}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs flex items-center gap-1 shadow-xs transition"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Tambah</span>
                              </button>
                            )}
                          </div>

                        </div>
                      );
                    })
                  )}
                </div>

              </div>

            </div>
          ) : (
            /* SECTION 2 (ALTERNATIVE): SINGLE STORE FORM MODE */
            <div className="space-y-3">
              <SearchableStoreSelect
                stores={stores}
                selectedStoreId={selectedSingleStoreId}
                onSelectStore={(store) => setSelectedSingleStoreId(store.id)}
                label="Pilih Toko / IDM (Master Toko Bali)"
                required
                referenceStore={activeAnchorStore}
                referenceStoreLabel={
                  storesOnSameDateAndGroup.length > 0
                    ? `Toko Sebelumnya (${storesOnSameDateAndGroup.length} Toko Terjadwal)`
                    : 'Toko Acuan Awal'
                }
                onClearReferenceStore={customAnchorStoreId ? () => setCustomAnchorStoreId('') : undefined}
                showFilters={true}
              />

              {/* Single Store Details Preview Card */}
              {selectedSingleStore && (
                <div className="bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-xl p-3.5 border border-indigo-100 shadow-2xs space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-900 text-white font-mono font-black text-xs">
                        {selectedSingleStore.code}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">{selectedSingleStore.name}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      (selectedSingleStore.zona || '').toUpperCase().includes('HITAM') || selectedSingleStore.isZonaHitam
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}>
                      {selectedSingleStore.zona || (selectedSingleStore.isZonaHitam ? 'ZONA HITAM' : 'NON ZONA HITAM')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                    <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Stock Rp (Saldo)</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatRupiah(selectedSingleStore.saldoToko || 0)}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Kas Toko</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {formatRupiah(selectedSingleStore.kasToko || 0)}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Type SO</span>
                      <span className="font-bold text-indigo-700">
                        {selectedSingleStore.typeSo || selectedSingleStore.qm || 'Q3 / Reguler'}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">AS / AM</span>
                      <span className="font-semibold text-slate-800">
                        AS: {selectedSingleStore.as || '-'} | AM: {selectedSingleStore.am || '-'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: Personil Checkbox Allocation under Korlap */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase">
                Alokasi Anggota Tim ({allocatedPersonnelIds.length} Dipilih):
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={handleSelectAllAuditors}
                  className="text-indigo-600 font-bold hover:underline"
                >
                  Pilih Semua
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={handleDeselectAllAuditors}
                  className="text-slate-500 hover:text-slate-700"
                >
                  Batal Semua
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-2 max-h-32 overflow-y-auto space-y-1">
              {membersUnderSelectedKorlap.length === 0 ? (
                <p className="text-xs text-slate-400 italic p-2">Tidak ada personil terdaftar di bawah korlap ini.</p>
              ) : (
                membersUnderSelectedKorlap.map(p => {
                  const isChecked = allocatedPersonnelIds.includes(p.id) || selectedPersonilLeader === p.name;
                  return (
                    <label 
                      key={p.id} 
                      className={`flex items-center justify-between p-1.5 px-2 rounded-lg text-xs cursor-pointer transition ${
                        isChecked 
                          ? 'bg-indigo-50 border border-indigo-200 font-semibold text-indigo-950 shadow-2xs' 
                          : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleAuditor(p.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer shrink-0"
                        />
                        <span className="text-xs font-bold text-slate-900">{p.name}</span>
                        <span className="text-[10px] text-slate-500">({p.role || 'Anggota'})</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono bg-white px-1.5 py-0.2 rounded border border-slate-200">
                        {p.nik}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* SECTION 4: Auto Sync Banner */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-950">
            <input
              type="checkbox"
              id="autoSyncToggleModal"
              checked={autoSyncHariH}
              onChange={(e) => setAutoSyncHariH(e.target.checked)}
              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer shrink-0"
            />
            <label htmlFor="autoSyncToggleModal" className="cursor-pointer">
              <strong className="block text-emerald-950 font-bold">⚡ Terhubung Langsung ke Menu Korlap (H-1 & Hari-H)</strong>
              <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                Semua toko yang dipilih akan otomatis sinkron ke Master Toko Bali (SO September) dan otomatis terbit pada menu Korlap <strong>{selectedGroupKorlap}</strong> saat persiapan H-1 dan pelaksanaan Hari-H.
              </p>
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Keterangan Tambahan / Instruksi Khusus:
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Fokus cek item High Shrinkage, Kas Toko, dan Toko Zona Hitam..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl text-xs p-2.5 text-slate-800 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Bottom Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 text-xs font-bold border border-slate-300 transition"
            >
              Batal
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-black transition shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {scheduleMode === 'MULTI_ROUTE'
                  ? `Simpan Jadwal SO (${selectedStoreQueue.length} Toko Terpilih)`
                  : 'Simpan Jadwal SO'}
              </span>
            </button>
          </div>

        </form>

      </div>

      {/* Confirmation Modal for Repeat SO in Same Month */}
      {pendingDuplicateCheck && (
        <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 text-center">
              Konfirmasi SO Ulang / Duplikasi Jadwal
            </h3>

            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-2">
              <p>
                Ditemukan toko yang sudah memiliki jadwal SO pada bulan yang sama:
              </p>
              <div className="p-2 bg-white/80 rounded-lg border border-amber-300/60 font-mono text-[11px] max-h-24 overflow-y-auto">
                📌 {pendingDuplicateCheck.previousDateInfo}
              </div>
              <p className="font-semibold text-amber-950">
                Apakah toko-toko ini tetap akan dijadwalkan untuk SO oleh Korlap <strong>{selectedGroupKorlap}</strong>?
              </p>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPendingDuplicateCheck(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Batal / Periksa Lagi
              </button>
              <button
                type="button"
                onClick={() => {
                  executeCreateSchedules(pendingDuplicateCheck.payloads);
                  setPendingDuplicateCheck(null);
                }}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition shadow-md"
              >
                Ya, Tetap Simpan Jadwal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

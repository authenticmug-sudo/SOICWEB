import { Store, SOSchedule, SOResult } from '../types/stockOpname';
import { formatSmartSODate, formatDateISO } from './formatters';
import { normalizeKorlapName } from './korlapUtils';

/**
 * Check if a store belongs to ZONA HITAM (Black Zone)
 * Strictly adheres to reading column Zona / Keterangan Zona Hitam from Master Toko.
 * Stores marked with 'NON ZONA HITAM', 'NON HITAM', 'AMAN', '-', empty, etc. will NOT be treated as Zona Hitam.
 */
export function isStoreZonaHitam(store: Partial<Store> | any): boolean {
  if (!store) return false;

  // Extract all potential fields that might hold zona info
  const zonaStr = String(
    store.zona || 
    store.kriteriaZona || 
    store.keteranganZona || 
    store.zonaKeterangan || 
    store['ZONA-KETERANGAN ZONA HITAM'] || 
    store['ZONA - KETERANGAN ZONA HITAM'] || 
    store['KETERANGAN ZONA HITAM'] || 
    ''
  ).toUpperCase().trim();

  const ketStr = String(store.keterangan || store.notes || '').toUpperCase().trim();

  // 1. Explicit NON / BUKAN / AMAN / REGULER checks FIRST (Must NEVER be classified as Zona Hitam)
  if (
    zonaStr.includes('NON') || 
    zonaStr.includes('BUKAN') || 
    zonaStr.includes('TIDAK') || 
    zonaStr === 'AMAN' || 
    zonaStr === 'NO' || 
    zonaStr === '-' ||
    zonaStr === '0' ||
    zonaStr === 'REGULER' ||
    zonaStr === 'NORMAL' ||
    zonaStr === 'RENDAH' ||
    zonaStr === 'SEDANG' ||
    zonaStr === 'NON ZONA HITAM' ||
    zonaStr === 'NON HITAM' ||
    zonaStr === 'NON ZONA'
  ) {
    return false;
  }

  // 2. Explicit check on Keterangan field if it explicitly states NON-ZONA
  if (
    ketStr.includes('NON ZONA') || 
    ketStr.includes('NON-ZONA') || 
    ketStr.includes('BUKAN ZONA HITAM') || 
    ketStr.includes('NON HITAM') ||
    ketStr.includes('BUKAN HITAM')
  ) {
    return false;
  }

  // 3. Positive check: does Zona or Keterangan say ZONA HITAM / HITAM / BLACK ZONE / YA?
  if (
    zonaStr === 'ZONA HITAM' || 
    zonaStr === 'HITAM' || 
    zonaStr === 'BLACK' || 
    zonaStr === 'BLACK ZONE' || 
    zonaStr === 'YA' || 
    zonaStr === 'YES' ||
    zonaStr === '1' ||
    zonaStr === 'ZH' ||
    (zonaStr.includes('HITAM') && !zonaStr.includes('NON') && !zonaStr.includes('BUKAN') && !zonaStr.includes('TIDAK'))
  ) {
    return true;
  }

  if (
    ketStr === 'ZONA HITAM' || 
    ketStr === 'HITAM' || 
    ketStr === 'BLACK ZONE' ||
    (ketStr.includes('ZONA HITAM') && !ketStr.includes('NON') && !ketStr.includes('BUKAN') && !ketStr.includes('TIDAK'))
  ) {
    return true;
  }

  // 4. If explicit boolean is set, only trust it if zonaStr was not empty or explicitly indicated
  if (store.isZonaHitam === true && zonaStr !== '' && !zonaStr.includes('NON') && !zonaStr.includes('BUKAN')) {
    return true;
  }

  // Default is false (Regular / Non-Zona Hitam Store)
  return false;
}

/**
 * Get the unified SPV Approval Status for a Store
 * Values: 'Sudah Approve' | 'Belum Terapprove' | 'Belum SO'
 */
export function getStoreSOApprovalStatus(
  store: Store,
  schedules?: SOSchedule[],
  results?: SOResult[]
): 'Sudah Approve' | 'Belum SO' | 'Belum Terapprove' {
  if (!store) return 'Belum SO';

  const codeKey = (store.code || '').trim().toUpperCase();
  const idKey = (store.id || '').trim().toUpperCase();

  // 1. Highest Priority: Actual submitted audit results (Hasil SO)
  if (results && results.length > 0) {
    const matchingResults = results.filter(r => 
      (codeKey && r.storeCode && r.storeCode.trim().toUpperCase() === codeKey) || 
      (idKey && r.storeId && r.storeId.trim().toUpperCase() === idKey)
    );

    if (matchingResults.some(r => r.approvalStatus === 'Disetujui')) {
      return 'Sudah Approve';
    }

    if (matchingResults.some(r => 
      r.approvalStatus === 'Menunggu Approval SPV' || 
      r.approvalStatus === 'Perlu Audit Ulang' ||
      (!r.approvalStatus && r.id) ||
      ((r.approvalStatus as string) !== 'Disetujui' && (r.approvalStatus as string) !== 'Ditolak')
    )) {
      return 'Belum Terapprove';
    }
  }

  // 2. Second Priority: Actual Schedule Status
  if (schedules && schedules.length > 0) {
    const matchingSchedules = schedules.filter(sch => 
      (codeKey && sch.storeCode && sch.storeCode.trim().toUpperCase() === codeKey) || 
      (idKey && sch.storeId && sch.storeId.trim().toUpperCase() === idKey)
    );

    if (matchingSchedules.some(sch => sch.spvApprovalStatus === 'Disetujui')) {
      return 'Sudah Approve';
    }

    if (matchingSchedules.some(sch => 
      sch.status === 'Selesai' || 
      sch.status === 'Menunggu Rekapan' || 
      sch.spvApprovalStatus === 'Menunggu Approval SPV'
    )) {
      return 'Belum Terapprove';
    }
  }

  // 3. Third Priority: Explicit statusApproveSO property from sheet or direct store edit
  if (store.statusApproveSO) {
    const s = String(store.statusApproveSO).toLowerCase().trim();
    if (s.includes('sudah') || s.includes('approved') || s.includes('setuju')) return 'Sudah Approve';
    if (s.includes('belum terapprove') || s.includes('menunggu') || s.includes('pending') || s.includes('belum approve')) return 'Belum Terapprove';
    if (s.includes('belum so')) return 'Belum SO';
  }

  // 4. Fourth Priority: Explicit tglSoApproved date
  if (store.tglSoApproved && store.tglSoApproved !== '-' && store.tglSoApproved !== '0' && !store.tglSoApproved.toLowerCase().includes('belum')) {
    return 'Sudah Approve';
  }

  return 'Belum SO';
}

/**
 * Check if a store has been approved / completed SO in a specific month & year
 * NOTE: Scheduled stores (e.g. only having SO date in soSeptember) are NOT approved until SPV approves!
 */
export function isStoreSOApprovedInMonth(
  store: Store,
  schedules: SOSchedule[],
  results?: SOResult[],
  targetMonth: string = '09', // '01'..'12' or 'ALL'
  targetYear: string = '2026'
): boolean {
  if (!store) return false;

  // 1. Check matching schedule with SPV approval or completed status
  const hasApprovedSchedule = schedules.some(sch => {
    const isMatched = sch.storeCode === store.code || sch.storeId === store.id || sch.storeName?.toLowerCase() === store.name?.toLowerCase();
    if (!isMatched) return false;

    // Check approval status: MUST be approved by SPV or completed
    const isApproved = (sch.spvApprovalStatus as string) === 'Disetujui' || ((sch.status as string) === 'Selesai' && (sch.spvApprovalStatus as string) === 'Disetujui');
    if (!isApproved) return false;

    if (targetMonth === 'ALL') return true;

    if (sch.scheduledDate) {
      const [sYear, sMonth] = sch.scheduledDate.split('-');
      if (sMonth === targetMonth && (targetYear === 'ALL' || sYear === targetYear)) {
        return true;
      }
    }
    return false;
  });

  if (hasApprovedSchedule) return true;

  // 2. Check matching results with SPV approval
  if (results && results.length > 0) {
    const hasApprovedResult = results.some(r => {
      const isMatched = r.storeCode === store.code || r.storeId === store.id;
      if (!isMatched) return false;
      if (r.approvalStatus === 'Disetujui' || (r.approvalStatus !== 'Menunggu Approval SPV' && r.approvalStatus !== 'Ditolak' && !!r.baNumber)) {
        if (targetMonth === 'ALL') return true;
        if (r.soDate) {
          const [rYear, rMonth] = r.soDate.split('-');
          if (rMonth === targetMonth && (targetYear === 'ALL' || rYear === targetYear)) return true;
        }
      }
      return false;
    });
    if (hasApprovedResult) return true;
  }

  // 3. Check explicit statusApproveSO
  if (store.statusApproveSO) {
    const s = String(store.statusApproveSO).toLowerCase();
    if (s.includes('sudah') || s.includes('approved') || s.includes('setuju')) {
      return true;
    }
  }

  // 4. Check general tglSoApproved if explicitly set
  if (store.tglSoApproved && store.tglSoApproved !== '-' && store.tglSoApproved !== '0' && !store.tglSoApproved.toLowerCase().includes('belum')) {
    if (targetMonth === 'ALL') return true;
    if (store.tglSoApproved.includes(`-${targetMonth}-`)) return true;
    return true;
  }

  return false;
}

/**
 * Calculate FREKUENSI TIDAK SO based on historical monthly columns (Mei, Juni, Juli, Agustus, September)
 */
export function calculateStoreFrekuensiTidakSO(
  store: Store,
  currentMonth: string = '09'
): number {
  if (!store) return 0;

  const hasSO = (val?: any): boolean => {
    if (!val) return false;
    const str = String(val).trim();
    return str !== '' && str !== '-' && str !== '0' && str !== '0.0' && str !== '0-Jan-00' && str.toLowerCase() !== 'belum so';
  };

  const history = [
    hasSO(store.tglSoMei),
    hasSO(store.tglSoJuni),
    hasSO(store.tglSoJuli),
    hasSO(store.soAgustus),
    hasSO(store.soSeptember)
  ];

  // If already SO'd in current active month (September), frequency is 0
  if (currentMonth === '09' && history[4]) {
    return 0;
  }

  // Count consecutive months not SO'd leading up to active month
  let count = 0;
  const activeIdx = currentMonth === '09' ? 4 : (currentMonth === '08' ? 3 : 2);
  for (let i = activeIdx; i >= 0; i--) {
    if (!history[i]) {
      count++;
    } else {
      break;
    }
  }

  return count;
}

/**
 * Auto update store with approved schedule date in the active month
 */
export function autoSyncStoreWithApprovedSchedule(
  store: Store,
  scheduleOrDate: SOSchedule | string
): Store {
  if (!scheduleOrDate) return store;

  let dateStr = '';
  let officerName = '';

  if (typeof scheduleOrDate === 'string') {
    dateStr = scheduleOrDate;
  } else {
    dateStr = scheduleOrDate.scheduledDate || '';
    officerName = scheduleOrDate.officerInCharge || '';
  }

  if (!dateStr) return store;

  const parts = dateStr.split('-');
  const month = parts[1] || '09';
  const year = parts[0] || '2026';

  const updated: Store = { ...store };
  updated.lastSODate = dateStr;
  updated.tglSoApproved = dateStr;
  updated.statusApproveSO = 'Sudah Approve';

  if (officerName && officerName !== 'Petugas SO') {
    updated.korlap = officerName;
    updated.managerName = officerName;
  }

  // Populate month specific field
  if (month === '09') {
    updated.soSeptember = dateStr;
  } else if (month === '08') {
    updated.soAgustus = dateStr;
  } else if (month === '07') {
    updated.tglSoJuli = dateStr;
  } else if (month === '06') {
    updated.tglSoJuni = dateStr;
  } else if (month === '05') {
    updated.tglSoMei = dateStr;
  }

  // Dynamic monthly history
  if (!updated.monthlySOHistory) updated.monthlySOHistory = {};
  updated.monthlySOHistory[`${month}_${year}`] = dateStr;

  // Recalculate frekuensi tidak SO
  updated.frekuensiTidakSO = calculateStoreFrekuensiTidakSO(updated, month);

  return updated;
}

/**
 * Intelligently generate and synchronize SOSchedules from Master Store monthly date columns
 * (e.g. SO SEPTEMBER '26 or SO AGUSTUS) when a new master file is uploaded or activated.
 * Correctly handles schedule date modifications from Excel without residual ghost schedules.
 */
export function syncSchedulesFromMasterStores(
  stores: Store[], 
  existingSchedules: SOSchedule[],
  targetMonth: string = '09',
  targetYear: string = '2026',
  options?: {
    isReplaceMode?: boolean;
    results?: SOResult[];
  }
): { updatedSchedules: SOSchedule[]; newlyCreatedCount: number; updatedCount: number; removedCount: number } {
  if (!stores || stores.length === 0) {
    if (options?.isReplaceMode) {
      const approvedOnly = existingSchedules.filter(s => 
        s.spvApprovalStatus === 'Disetujui' || 
        (options?.results && options.results.some(r => r.approvalStatus === 'Disetujui' && (r.storeCode === s.storeCode || r.storeId === s.storeId)))
      );
      return { 
        updatedSchedules: approvedOnly, 
        newlyCreatedCount: 0, 
        updatedCount: 0, 
        removedCount: existingSchedules.length - approvedOnly.length 
      };
    }
    return { updatedSchedules: existingSchedules, newlyCreatedCount: 0, updatedCount: 0, removedCount: 0 };
  }

  const results = options?.results || [];
  const approvedStoreKeySet = new Set<string>();
  results.forEach(r => {
    if (r.approvalStatus === 'Disetujui') {
      if (r.storeCode) approvedStoreKeySet.add(r.storeCode.trim().toUpperCase());
      if (r.storeId) approvedStoreKeySet.add(r.storeId.trim().toUpperCase());
    }
  });

  // 1. Separate schedules into genuinely approved schedules and unapproved schedules
  const approvedSchedules: SOSchedule[] = [];
  const unapprovedMap = new Map<string, SOSchedule[]>();

  existingSchedules.forEach(sch => {
    const codeKey = sch.storeCode ? sch.storeCode.trim().toUpperCase() : '';
    const idKey = sch.storeId ? sch.storeId.trim().toUpperCase() : '';
    const isApproved = sch.spvApprovalStatus === 'Disetujui' || 
      (codeKey && approvedStoreKeySet.has(codeKey)) || 
      (idKey && approvedStoreKeySet.has(idKey));

    if (isApproved) {
      approvedSchedules.push(sch);
    } else {
      const primaryKey = codeKey || idKey;
      if (primaryKey) {
        const list = unapprovedMap.get(primaryKey) || [];
        list.push(sch);
        unapprovedMap.set(primaryKey, list);
      }
    }
  });

  let newlyCreatedCount = 0;
  let updatedCount = 0;
  let removedCount = 0;

  const processedUnapprovedSchedules: SOSchedule[] = [];
  const handledStoreKeys = new Set<string>();

  stores.forEach(st => {
    const codeKey = st.code ? st.code.trim().toUpperCase() : '';
    const idKey = st.id ? st.id.trim().toUpperCase() : '';
    const primaryKey = codeKey || idKey;
    if (!primaryKey || handledStoreKeys.has(primaryKey)) return;
    handledStoreKeys.add(primaryKey);

    // Determine target SO date for this store in target month
    let rawDateVal = '';
    if (targetMonth === '09') {
      rawDateVal = st.soSeptember || '';
    } else if (targetMonth === '08') {
      rawDateVal = st.soAgustus || '';
    } else if (targetMonth === '07') {
      rawDateVal = st.tglSoJuli || '';
    } else if (targetMonth === '06') {
      rawDateVal = st.tglSoJuni || '';
    } else if (targetMonth === '05') {
      rawDateVal = st.tglSoMei || '';
    }

    // Fallback: If empty, check other SO date fields that match targetMonth
    if (!rawDateVal || rawDateVal === '-' || rawDateVal === '0') {
      const candidates = [st.soSeptember, st.soAgustus, st.tglSoJuli, st.tglSoJuni, st.tglSoMei, st.lastSODate];
      for (const c of candidates) {
        if (c && c !== '-' && c !== '0' && c !== '0.0' && c.toLowerCase() !== 'belum so') {
          const iso = formatDateISO(c);
          if (iso && iso.slice(5, 7) === targetMonth) {
            rawDateVal = c;
            break;
          }
        }
      }
    }

    const isoDate = formatDateISO(rawDateVal);
    const hasValidDate = !!isoDate && !isoDate.startsWith('1970') && !isoDate.startsWith('1900') && isoDate.length >= 10;

    const existingUnapprovedList = (codeKey ? unapprovedMap.get(codeKey) : undefined) || 
                                  (idKey ? unapprovedMap.get(idKey) : undefined) || [];

    // If store already has a genuinely approved schedule, preserve it
    const hasApprovedSchedule = approvedSchedules.some(s => 
      (codeKey && s.storeCode?.trim().toUpperCase() === codeKey) || 
      (idKey && s.storeId?.trim().toUpperCase() === idKey)
    );

    if (!hasValidDate) {
      // Store has NO scheduled date in new master: remove any lingering unapproved schedule
      if (existingUnapprovedList.length > 0) {
        removedCount += existingUnapprovedList.length;
      }
      return;
    }

    const canonicalOfficer = st.korlap && st.korlap !== 'Petugas SO' 
      ? (normalizeKorlapName(st.korlap) || st.korlap) 
      : 'I GEDE PASEK SANTIKA';

    const isHitam = isStoreZonaHitam(st);
    const storeZona = isHitam ? 'ZONA HITAM' : 'NON ZONA HITAM';
    const storeAktiva = st.soAktiva || 'Tidak';
    const storeSaldo = typeof st.saldoToko === 'number' ? st.saldoToko : (parseFloat(String(st.saldoToko || '').replace(/[^0-9.-]/g, '')) || 0);
    const dayName = getDayNameIndo(isoDate);

    if (existingUnapprovedList.length > 0) {
      // Pick the primary existing schedule, drop any duplicates
      const targetSched = existingUnapprovedList[0];
      if (existingUnapprovedList.length > 1) {
        removedCount += (existingUnapprovedList.length - 1);
      }

      if (targetSched.scheduledDate !== isoDate) {
        updatedCount++;
      }

      const updatedSched: SOSchedule = {
        ...targetSched,
        id: `SCHED-${st.code || st.id}-${isoDate}`,
        scheduledDate: isoDate,
        dayName: dayName,
        storeId: st.id,
        storeCode: st.code,
        storeName: st.name,
        zona: storeZona,
        soAktiva: storeAktiva,
        stockRp: storeSaldo > 0 ? storeSaldo : targetSched.stockRp,
        asInitial: st.as || targetSched.asInitial,
        typeSo: st.typeSo || st.qm || targetSched.typeSo || 'M',
        officerInCharge: canonicalOfficer,
        groupName: canonicalOfficer,
        region: st.region || st.kabupaten || targetSched.region || 'Kota Denpasar',
        status: 'Terjadwal',
        spvApprovalStatus: 'Menunggu Approval SPV'
      };

      processedUnapprovedSchedules.push(updatedSched);
    } else if (!hasApprovedSchedule) {
      // Create fresh schedule
      const newSchedule: SOSchedule = {
        id: `SCHED-${st.code || st.id}-${isoDate}`,
        storeId: st.id,
        storeCode: st.code,
        storeName: st.name,
        scheduledDate: isoDate,
        scheduledTime: '08:00',
        teamId: 'TEAM-01',
        teamName: 'TEAM 1',
        teamCategory: 'TEAM 1',
        spvInCharge: 'I GEDE PASEK SANTIKA',
        officerInCharge: canonicalOfficer,
        groupName: canonicalOfficer,
        dayName: dayName,
        stockRp: storeSaldo,
        kasToko: st.kasToko || 0,
        typeSo: st.typeSo || st.qm || 'M',
        zona: storeZona,
        soAktiva: storeAktiva,
        asInitial: st.as || '',
        region: st.region || st.kabupaten || 'Kota Denpasar',
        status: 'Terjadwal',
        targetSKUCount: st.totalSKUCount || 1000,
        spvApprovalStatus: 'Menunggu Approval SPV',
        notes: `Otomatis disinkronkan dari Master Toko (Type SO: ${st.typeSo || st.qm || 'M'})`,
        createdAt: new Date().toISOString().slice(0, 10)
      };

      processedUnapprovedSchedules.push(newSchedule);
      newlyCreatedCount++;
    }
  });

  // If in merge mode (not replace mode), retain unapproved schedules of stores not mentioned in incoming list
  if (!options?.isReplaceMode) {
    unapprovedMap.forEach((schedulesList, key) => {
      if (!handledStoreKeys.has(key)) {
        processedUnapprovedSchedules.push(...schedulesList);
      }
    });
  } else {
    // In replace mode, unhandled stores are counted as removed
    unapprovedMap.forEach((schedulesList, key) => {
      if (!handledStoreKeys.has(key)) {
        removedCount += schedulesList.length;
      }
    });
  }

  // Combine approved + processed unapproved schedules, ensuring no duplicate IDs
  const seenIds = new Set<string>();
  const allFinalSchedules: SOSchedule[] = [];

  [...approvedSchedules, ...processedUnapprovedSchedules].forEach(sch => {
    if (!seenIds.has(sch.id)) {
      seenIds.add(sch.id);
      allFinalSchedules.push(sch);
    }
  });

  return { 
    updatedSchedules: allFinalSchedules, 
    newlyCreatedCount, 
    updatedCount, 
    removedCount 
  };
}

/**
 * Get Indonesian day name from date string YYYY-MM-DD
 */
export function getDayNameIndo(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const dayIndex = date.getDay(); // 0 = Minggu, 1 = Senin, ...
  const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
  return days[dayIndex] || '';
}

/**
 * Enrich schedule object with real-time Master Store data (Lookup VLOOKUP emulation)
 */
export function enrichScheduleWithMasterStore(schedule: SOSchedule, store?: Store): SOSchedule {
  if (!store) return schedule;

  const day = schedule.dayName || getDayNameIndo(schedule.scheduledDate);
  const stockRp = store.saldoToko !== undefined ? store.saldoToko : schedule.stockRp;
  const kasToko = store.kasToko !== undefined ? store.kasToko : schedule.kasToko;
  const typeSo = store.typeSo || store.qm || schedule.typeSo || 'M';
  const zona = store.zona || (store.isZonaHitam ? 'ZONA HITAM' : 'NON ZONA HITAM') || schedule.zona;
  const asInitial = store.as || schedule.asInitial || '';
  const region = store.region || store.kabupaten || schedule.region;

  const canonicalKorlap = store.korlap && store.korlap !== 'Petugas SO'
    ? normalizeKorlapName(store.korlap)
    : (schedule.officerInCharge || schedule.groupName);

  return {
    ...schedule,
    storeName: store.name || schedule.storeName,
    stockRp,
    kasToko,
    typeSo,
    zona,
    asInitial,
    region,
    dayName: day,
    officerInCharge: canonicalKorlap || schedule.officerInCharge,
    groupName: canonicalKorlap || schedule.groupName
  };
}

/**
 * Complete Two-Way Synchronization between Stores and Schedules
 */
export function twoWaySyncStoresAndSchedules(
  stores: Store[],
  schedules: SOSchedule[],
  month: string = '09',
  year: string = '2026'
): { updatedStores: Store[]; updatedSchedules: SOSchedule[]; changesCount: number } {
  let changesCount = 0;
  const storeMap = new Map<string, Store>(stores.map(s => [s.code || s.id, { ...s }]));

  // 1. Sync schedules into stores (Schedule -> Store.soSeptember)
  schedules.forEach(sched => {
    if (!sched.scheduledDate) return;
    const [sYear, sMonth] = sched.scheduledDate.split('-');
    if (sMonth === month && (year === 'ALL' || sYear === year)) {
      const matchStore = storeMap.get(sched.storeCode) || Array.from(storeMap.values()).find(s => s.id === sched.storeId || s.code === sched.storeCode);
      if (matchStore) {
        const smartDate = formatSmartSODate(sched.scheduledDate);
        if (matchStore.soSeptember !== smartDate) {
          matchStore.soSeptember = smartDate;
          changesCount++;
        }
        if (sched.spvApprovalStatus === 'Disetujui') {
          if (matchStore.statusApproveSO !== 'Sudah Approve') {
            matchStore.statusApproveSO = 'Sudah Approve';
            matchStore.tglSoApproved = sched.scheduledDate;
            changesCount++;
          }
        } else if (sched.status === 'Selesai') {
          if (matchStore.statusApproveSO !== 'Belum Terapprove' && matchStore.statusApproveSO !== 'Sudah Approve') {
            matchStore.statusApproveSO = 'Belum Terapprove';
            changesCount++;
          }
        } else if (!matchStore.statusApproveSO) {
          matchStore.statusApproveSO = 'Belum SO';
        }
        if (sched.officerInCharge && (!matchStore.korlap || matchStore.korlap === 'Petugas SO')) {
          const canonical = normalizeKorlapName(sched.officerInCharge);
          matchStore.korlap = canonical || sched.officerInCharge.split(' (')[0];
          changesCount++;
        }
      }
    }
  });

  const updatedStores = Array.from(storeMap.values());

  // 2. Sync stores into schedules (Store.soSeptember -> Schedules)
  const { updatedSchedules, newlyCreatedCount } = syncSchedulesFromMasterStores(updatedStores, schedules, month, year);
  changesCount += newlyCreatedCount;

  // 3. Enrich all schedules with latest Master Store details
  const fullyEnrichedSchedules = updatedSchedules.map(sched => {
    const st = updatedStores.find(s => s.code === sched.storeCode || s.id === sched.storeId);
    return enrichScheduleWithMasterStore(sched, st);
  });

  return {
    updatedStores,
    updatedSchedules: fullyEnrichedSchedules,
    changesCount
  };
}

/**
 * Reconcile incoming Master Stores (e.g. from a freshly uploaded or edited Excel)
 * with existing stores, schedules, and results so that any store that has ALREADY
 * been approved by SPV SO retains its "Sudah Approve" status and approval date.
 */
export function reconcileStoresWithExistingApprovals(
  incomingStores: Store[],
  existingStores: Store[] = [],
  existingSchedules: SOSchedule[] = [],
  existingResults: SOResult[] = []
): Store[] {
  const approvedMap = new Map<string, {
    statusApproveSO: 'Sudah Approve';
    tglSoApproved: string;
    lastSODate?: string;
    korlap?: string;
    spvApprover?: string;
    lastAccuracyRate?: number;
    monthlyHistory?: Record<string, string | number>;
  }>();

  // 1. Existing audit results with approved status (HIGHEST PRIORITY SOURCE OF TRUTH)
  existingResults.forEach(res => {
    if (res.approvalStatus === 'Disetujui') {
      const payload = {
        statusApproveSO: 'Sudah Approve' as const,
        tglSoApproved: res.soDate || res.approvedAt || '',
        lastSODate: res.soDate || res.approvedAt || '',
        korlap: res.spvApprover,
        spvApprover: res.spvApprover || 'Gean Pratama (SPV SO)',
        lastAccuracyRate: res.accuracyRatePercentage
      };
      if (res.storeCode) approvedMap.set(res.storeCode.trim().toUpperCase(), payload);
      if (res.storeId) approvedMap.set(res.storeId.trim().toUpperCase(), payload);
    }
  });

  // 2. Existing schedules with genuine SPV approval status ONLY
  existingSchedules.forEach(sch => {
    if (sch.spvApprovalStatus === 'Disetujui') {
      const codeKey = sch.storeCode?.trim().toUpperCase();
      const idKey = sch.storeId?.trim().toUpperCase();
      if ((codeKey && !approvedMap.has(codeKey)) || (idKey && !approvedMap.has(idKey))) {
        const payload = {
          statusApproveSO: 'Sudah Approve' as const,
          tglSoApproved: sch.scheduledDate || '',
          lastSODate: sch.scheduledDate || '',
          korlap: sch.officerInCharge,
          spvApprover: sch.spvInCharge || 'Gean Pratama (SPV SO)'
        };
        if (codeKey) approvedMap.set(codeKey, payload);
        if (idKey) approvedMap.set(idKey, payload);
      }
    }
  });

  return incomingStores.map(st => {
    const codeKey = (st.code || '').trim().toUpperCase();
    const idKey = (st.id || '').trim().toUpperCase();
    const approvedInfo = (codeKey ? approvedMap.get(codeKey) : undefined) || (idKey ? approvedMap.get(idKey) : undefined);

    // If incoming store from Excel is already explicitly marked "Sudah Approve", keep it
    if (st.statusApproveSO === 'Sudah Approve') {
      return {
        ...st,
        spvApprover: st.spvApprover || approvedInfo?.spvApprover || 'Gean Pratama (SPV SO)',
        lastAccuracyRate: st.lastAccuracyRate !== undefined ? st.lastAccuracyRate : approvedInfo?.lastAccuracyRate
      };
    }

    // If store has a genuine SPV approval record in the system, preserve the approval!
    if (approvedInfo) {
      return {
        ...st,
        statusApproveSO: 'Sudah Approve',
        tglSoApproved: st.tglSoApproved || approvedInfo.tglSoApproved,
        lastSODate: st.lastSODate || approvedInfo.lastSODate || st.tglSoApproved,
        korlap: (st.korlap && st.korlap !== 'Petugas SO') ? st.korlap : (approvedInfo.korlap || st.korlap),
        spvApprover: st.spvApprover || approvedInfo.spvApprover,
        lastAccuracyRate: st.lastAccuracyRate !== undefined ? st.lastAccuracyRate : approvedInfo.lastAccuracyRate,
        monthlySOHistory: {
          ...(st.monthlySOHistory || {}),
          ...(approvedInfo.monthlyHistory || {})
        }
      };
    }

    // Otherwise, respect incoming store's status without residue
    return {
      ...st,
      statusApproveSO: st.statusApproveSO || 'Belum SO'
    };
  });
}




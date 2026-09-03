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

  // 1. Check explicit statusApproveSO property from sheet or direct edit
  if (store.statusApproveSO) {
    const s = String(store.statusApproveSO).toLowerCase().trim();
    if (s.includes('sudah') || s.includes('approved') || s.includes('setuju')) return 'Sudah Approve';
    if (s.includes('belum terapprove') || s.includes('menunggu') || s.includes('pending') || s.includes('belum approve')) return 'Belum Terapprove';
    if (s.includes('belum so')) return 'Belum SO';
  }

  // 2. Check schedules
  if (schedules && schedules.length > 0) {
    const matchingSchedules = schedules.filter(sch => 
      sch.storeCode === store.code || sch.storeId === store.id || (sch.storeName && sch.storeName.toLowerCase() === store.name?.toLowerCase())
    );

    const hasApproved = matchingSchedules.some(sch => 
      (sch.spvApprovalStatus as string) === 'Disetujui' || ((sch.status as string) === 'Selesai' && (sch.spvApprovalStatus as string) === 'Disetujui')
    );
    if (hasApproved) return 'Sudah Approve';

    const hasPendingApproval = matchingSchedules.some(sch => 
      (sch.status as string) === 'Selesai' || (sch.status as string) === 'Menunggu Rekapan' || (sch.spvApprovalStatus as string) === 'Menunggu Approval SPV'
    );
    if (hasPendingApproval) return 'Belum Terapprove';
  }

  // 3. Check results
  if (results && results.length > 0) {
    const matchingResults = results.filter(r => r.storeCode === store.code || r.storeId === store.id);
    const hasApprovedResult = matchingResults.some(r => r.approvalStatus === 'Disetujui');
    if (hasApprovedResult) return 'Sudah Approve';

    const hasPendingResult = matchingResults.some(r => r.approvalStatus === 'Menunggu Approval SPV');
    if (hasPendingResult) return 'Belum Terapprove';
  }

  // 4. Check explicit tglSoApproved
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
 */
export function syncSchedulesFromMasterStores(
  stores: Store[], 
  existingSchedules: SOSchedule[],
  targetMonth: string = '09',
  targetYear: string = '2026'
): { updatedSchedules: SOSchedule[]; newlyCreatedCount: number } {
  if (!stores || stores.length === 0) {
    return { updatedSchedules: existingSchedules, newlyCreatedCount: 0 };
  }

  const scheduleMap = new Map<string, SOSchedule>();
  existingSchedules.forEach(sch => {
    const key = `${sch.storeCode || sch.storeId}_${sch.scheduledDate}`;
    scheduleMap.set(key, sch);
  });

  const allSchedules = [...existingSchedules];
  let newlyCreatedCount = 0;

  stores.forEach(st => {
    // Check September SO date first, then fallback to other month fields if target is different
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

    if (!rawDateVal || rawDateVal === '-' || rawDateVal === '0' || rawDateVal === '0.0' || rawDateVal.toLowerCase() === '0-jan-00' || rawDateVal.toLowerCase() === 'belum so') {
      return;
    }

    // Convert date string to standard ISO format (YYYY-MM-DD)
    const isoDate = formatDateISO(rawDateVal);
    if (!isoDate || isoDate.startsWith('1970') || isoDate.startsWith('1900')) return;

    // Check if store already has a schedule for this month/date
    const key = `${st.code || st.id}_${isoDate}`;
    const storeMonthKey = `${st.code || st.id}_${isoDate.slice(0, 7)}`;

    const existingExact = scheduleMap.get(key);
    const existingInMonth = allSchedules.find(s => 
      (s.storeCode === st.code || s.storeId === st.id) && 
      s.scheduledDate && 
      s.scheduledDate.startsWith(isoDate.slice(0, 7))
    );

    const canonicalOfficer = st.korlap && st.korlap !== 'Petugas SO' 
      ? (normalizeKorlapName(st.korlap) || st.korlap) 
      : 'I GEDE PASEK SANTIKA';

    const isHitam = isStoreZonaHitam(st);
    const storeZona = isHitam ? 'ZONA HITAM' : 'NON ZONA HITAM';
    const storeAktiva = st.soAktiva || 'Tidak';
    const storeSaldo = typeof st.saldoToko === 'number' ? st.saldoToko : (parseFloat(String(st.saldoToko || '').replace(/[^0-9.-]/g, '')) || 0);

    if (existingExact) {
      // If schedule exists, ensure date, dayName, region, officer, zona, & saldo are in sync
      existingExact.dayName = getDayNameIndo(isoDate);
      existingExact.zona = storeZona;
      existingExact.soAktiva = storeAktiva;
      if (storeSaldo > 0) existingExact.stockRp = storeSaldo;
      if (st.as) existingExact.asInitial = st.as;
      if (st.typeSo || st.qm) existingExact.typeSo = st.typeSo || st.qm || 'M';
      if (!existingExact.officerInCharge || existingExact.officerInCharge === 'Petugas SO' || st.korlap) {
        existingExact.officerInCharge = canonicalOfficer;
        existingExact.groupName = canonicalOfficer;
      }
      if (st.region) existingExact.region = st.region;
      // If store is marked as approved in master, ensure schedule is marked approved
      if (st.statusApproveSO === 'Sudah Approve' && existingExact.spvApprovalStatus !== 'Disetujui') {
        existingExact.spvApprovalStatus = 'Disetujui';
        existingExact.status = 'Selesai';
      }
    } else if (existingInMonth) {
      // If schedule exists in the same month but different date, update its scheduledDate
      // PROTECT APPROVED SCHEDULE: If schedule was already approved or completed by SPV, preserve its date and approved status!
      const isScheduleApproved = existingInMonth.spvApprovalStatus === 'Disetujui' || existingInMonth.status === 'Selesai';
      if (!isScheduleApproved) {
        existingInMonth.scheduledDate = isoDate;
        existingInMonth.dayName = getDayNameIndo(isoDate);
      }
      existingInMonth.zona = storeZona;
      existingInMonth.soAktiva = storeAktiva;
      if (storeSaldo > 0) existingInMonth.stockRp = storeSaldo;
      if (st.as) existingInMonth.asInitial = st.as;
      if (st.typeSo || st.qm) existingInMonth.typeSo = st.typeSo || st.qm || 'M';
      if (!existingInMonth.officerInCharge || existingInMonth.officerInCharge === 'Petugas SO' || st.korlap) {
        existingInMonth.officerInCharge = canonicalOfficer;
        existingInMonth.groupName = canonicalOfficer;
      }
      if (st.region) existingInMonth.region = st.region;
      if (st.statusApproveSO === 'Sudah Approve' && !isScheduleApproved) {
        existingInMonth.spvApprovalStatus = 'Disetujui';
        existingInMonth.status = 'Selesai';
      }
    } else {
      // Create new smart schedule for target month
      const dayName = getDayNameIndo(isoDate);
      const isAlreadyApproved = st.statusApproveSO === 'Sudah Approve' || (st.tglSoApproved && st.tglSoApproved !== '-');
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
        status: isAlreadyApproved ? 'Selesai' : 'Terjadwal',
        targetSKUCount: st.totalSKUCount || 1000,
        spvApprovalStatus: isAlreadyApproved ? 'Disetujui' : 'Menunggu Approval SPV',
        notes: isAlreadyApproved 
          ? `Disinkronkan dari Master Toko: Sudah Approve SPV (Type SO: ${st.typeSo || st.qm || 'M'})`
          : `Otomatis disinkronkan dari Master Toko (Type SO: ${st.typeSo || st.qm || 'M'})`,
        createdAt: new Date().toISOString().slice(0, 10)
      };

      allSchedules.push(newSchedule);
      scheduleMap.set(key, newSchedule);
      newlyCreatedCount++;
    }
  });

  return { updatedSchedules: allSchedules, newlyCreatedCount };
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
    monthlyHistory?: Record<string, string | number>;
  }>();

  // 1. Existing stores with approved status
  existingStores.forEach(st => {
    const isApproved = st.statusApproveSO === 'Sudah Approve' || (st.tglSoApproved && st.tglSoApproved !== '-' && st.tglSoApproved !== 'Belum SO');
    if (isApproved) {
      const payload = {
        statusApproveSO: 'Sudah Approve' as const,
        tglSoApproved: st.tglSoApproved || st.lastSODate || '',
        lastSODate: st.lastSODate || st.tglSoApproved,
        korlap: st.korlap,
        monthlyHistory: st.monthlySOHistory
      };
      if (st.code) approvedMap.set(st.code.trim().toLowerCase(), payload);
      if (st.id) approvedMap.set(st.id.trim().toLowerCase(), payload);
    }
  });

  // 2. Existing schedules with approved status
  existingSchedules.forEach(sch => {
    if (sch.spvApprovalStatus === 'Disetujui' || sch.status === 'Selesai') {
      const payload = {
        statusApproveSO: 'Sudah Approve' as const,
        tglSoApproved: sch.scheduledDate || '',
        lastSODate: sch.scheduledDate || '',
        korlap: sch.officerInCharge
      };
      if (sch.storeCode) approvedMap.set(sch.storeCode.trim().toLowerCase(), payload);
      if (sch.storeId) approvedMap.set(sch.storeId.trim().toLowerCase(), payload);
    }
  });

  // 3. Existing audit results with approved status
  existingResults.forEach(res => {
    if (res.approvalStatus === 'Disetujui') {
      const payload = {
        statusApproveSO: 'Sudah Approve' as const,
        tglSoApproved: res.soDate || res.approvedAt || '',
        lastSODate: res.soDate || res.approvedAt || '',
        korlap: res.spvApprover
      };
      if (res.storeCode) approvedMap.set(res.storeCode.trim().toLowerCase(), payload);
      if (res.storeId) approvedMap.set(res.storeId.trim().toLowerCase(), payload);
    }
  });

  return incomingStores.map(st => {
    const codeKey = (st.code || '').trim().toLowerCase();
    const idKey = (st.id || '').trim().toLowerCase();
    const approvedInfo = approvedMap.get(codeKey) || approvedMap.get(idKey);

    // If incoming store from Excel is already marked "Sudah Approve", keep it
    if (st.statusApproveSO === 'Sudah Approve') {
      return st;
    }

    // If store was previously approved in the web app, preserve the approval!
    if (approvedInfo) {
      return {
        ...st,
        statusApproveSO: 'Sudah Approve',
        tglSoApproved: approvedInfo.tglSoApproved || st.tglSoApproved,
        lastSODate: approvedInfo.lastSODate || st.lastSODate || approvedInfo.tglSoApproved,
        korlap: (st.korlap && st.korlap !== 'Petugas SO') ? st.korlap : (approvedInfo.korlap || st.korlap),
        monthlySOHistory: {
          ...(st.monthlySOHistory || {}),
          ...(approvedInfo.monthlyHistory || {})
        }
      };
    }

    return st;
  });
}




import { Store, SOSchedule, SOResult } from '../types/stockOpname';
import { formatSmartSODate } from './formatters';

/**
 * Check if a store belongs to ZONA HITAM (Black Zone)
 */
export function isStoreZonaHitam(store: Store): boolean {
  if (!store) return false;
  const zonaStr = String(store.zona || '').toUpperCase();
  if (zonaStr.includes('HITAM') || zonaStr === 'ZONA HITAM') return true;
  if (store.isZonaHitam === true) return true;
  if (store.riskLevel === 'Tinggi') return true;
  const ketStr = String(store.keterangan || '').toUpperCase();
  if (ketStr.includes('ZONA HITAM')) return true;
  return false;
}

/**
 * Check if a store has been approved / completed SO in a specific month & year
 */
export function isStoreSOApprovedInMonth(
  store: Store,
  schedules: SOSchedule[],
  results?: SOResult[],
  targetMonth: string = '09', // '01'..'12' or 'ALL'
  targetYear: string = '2026'
): boolean {
  if (!store) return false;

  // 1. Check matching schedule
  const hasApprovedSchedule = schedules.some(sch => {
    const isMatched = sch.storeCode === store.code || sch.storeId === store.id || sch.storeName?.toLowerCase() === store.name?.toLowerCase();
    if (!isMatched) return false;

    // Check status
    const isApprovedOrDone = sch.status === 'Selesai' || sch.spvApprovalStatus === 'Disetujui' || !!sch.assignedPersonnelNames?.length;
    if (!isApprovedOrDone) return false;

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

  // 2. Check matching results
  if (results && results.length > 0) {
    const hasApprovedResult = results.some(r => {
      const isMatched = r.storeCode === store.code || r.storeId === store.id;
      if (!isMatched) return false;
      if (r.approvalStatus === 'Disetujui' || !!r.baNumber) {
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

  // 3. Check monthly column attributes in Store
  if (targetMonth === '09' || targetMonth === 'SEPTEMBER') {
    const val = store.soSeptember;
    if (val && val !== '-' && val !== '0' && val !== '0-Jan-00' && val !== 'Belum SO') return true;
  } else if (targetMonth === '08' || targetMonth === 'AGUSTUS') {
    const val = store.soAgustus;
    if (val && val !== '-' && val !== '0' && val !== '0-Jan-00' && val !== 'Belum SO') return true;
  } else if (targetMonth === '07' || targetMonth === 'JULI') {
    const val = store.tglSoJuli;
    if (val && val !== '-' && val !== '0' && val !== '0-Jan-00' && val !== 'Belum SO') return true;
  } else if (targetMonth === '06' || targetMonth === 'JUNI') {
    const val = store.tglSoJuni;
    if (val && val !== '-' && val !== '0' && val !== '0-Jan-00' && val !== 'Belum SO') return true;
  } else if (targetMonth === '05' || targetMonth === 'MEI') {
    const val = store.tglSoMei;
    if (val && val !== '-' && val !== '0' && val !== '0-Jan-00' && val !== 'Belum SO') return true;
  }

  // 4. Check general tglSoApproved if matches target month
  if (store.tglSoApproved && store.tglSoApproved !== '-') {
    if (targetMonth === 'ALL') return true;
    if (store.tglSoApproved.includes(`-${targetMonth}-`)) return true;
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

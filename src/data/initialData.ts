import { Store, SOSchedule, SOResult, SOTeam, RegionArea, AuditorPersonnel, SOEquipment, EquipmentRepairLog } from '../types/stockOpname';
import { BALI_PERSONNEL_DATA, BALI_SCHEDULES_DATA } from './baliData';
import BALI_EQUIPMENT_RAW from './baliEquipmentData.json';

export const INITIAL_PERSONNEL: AuditorPersonnel[] = BALI_PERSONNEL_DATA;
export const INITIAL_EQUIPMENT: SOEquipment[] = BALI_EQUIPMENT_RAW as SOEquipment[];
export const INITIAL_REPAIR_LOGS: EquipmentRepairLog[] = [];

export const REGIONS: RegionArea[] = [
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

export const INITIAL_TEAMS: SOTeam[] = [];

export function generateInitialStores(): Store[] {
  const storeMap = new Map<string, Store>();
  
  BALI_SCHEDULES_DATA.forEach(s => {
    const code = (s.storeCode || '').trim().toUpperCase();
    if (code && !storeMap.has(code)) {
      const reg = (s.region || 'Kab. Badung') as RegionArea;
      const parsedDate = s.scheduledDate;
      const formattedDate = s.scheduledDate ? `${parseInt(s.scheduledDate.slice(8, 10), 10)} Sep 2026` : '-';
      
      storeMap.set(code, {
        id: s.storeId || `STORE-BALI-${code}`,
        code: s.storeCode,
        name: s.storeName,
        region: reg,
        city: s.region || 'Kab. Badung',
        kabupaten: s.region || 'Kab. Badung',
        district: s.region || 'Kab. Badung',
        kecamatan: s.region || 'Kab. Badung',
        address: `Jl. Raya ${s.storeName}`,
        korlap: s.officerInCharge || s.groupName || 'I WAYAN ANGGA RISTA',
        saldoToko: Number(s.stockRp) || 385000000,
        kasToko: Number(s.kasToko) || 5000000,
        typeSo: s.typeSo || 'M',
        qm: s.typeSo || 'M',
        coverage: 'DC',
        zona: s.zona || 'NON ZONA HITAM',
        isZonaHitam: s.zona === 'ZONA HITAM',
        soAktiva: s.soAktiva || 'Tidak',
        statusApproveSO: s.spvApprovalStatus === 'Disetujui' ? 'Sudah Approve' : 'Belum SO',
        scheduledDate: parsedDate,
        tglSo: formattedDate,
        soSeptember: formattedDate,
        frekuensiTidakSO: 0,
        jenisToko: 'STANDART NEW',
        am: 'Area Manager Bali',
        as: s.asInitial || 'AS Bali',
        keterangan: 'TOKO EKSIS',
        riskLevel: 'Rendah',
        storeType: 'Regular Minimarket',
        managerName: s.officerInCharge || s.groupName || 'I WAYAN ANGGA RISTA',
        phone: '08123456789'
      });
    }
  });

  return Array.from(storeMap.values());
}

export function generateInitialSchedules(stores: Store[]): SOSchedule[] {
  if (stores && stores.length > 0) {
    // Enrich with store coordinates/details
    return BALI_SCHEDULES_DATA.map(s => {
      const matchStore = stores.find(st => st.code === s.storeCode);
      if (matchStore) {
        return {
          ...s,
          storeId: matchStore.id,
          storeName: matchStore.name || s.storeName,
          stockRp: matchStore.saldoToko || s.stockRp,
          kasToko: matchStore.kasToko || s.kasToko,
          typeSo: matchStore.typeSo || matchStore.qm || s.typeSo,
          zona: matchStore.zona || s.zona,
          asInitial: matchStore.as || s.asInitial,
          region: matchStore.region || matchStore.kabupaten || s.region
        };
      }
      return s;
    });
  }
  return BALI_SCHEDULES_DATA;
}

export function generateInitialResults(stores: Store[], schedules: SOSchedule[]): SOResult[] {
  return [];
}



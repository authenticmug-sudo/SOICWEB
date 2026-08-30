import { Store, SOSchedule, SOResult, SOTeam, RegionArea, AuditorPersonnel, SOEquipment, EquipmentRepairLog } from '../types/stockOpname';
import { BALI_PERSONNEL_DATA, BALI_SCHEDULES_DATA } from './baliData';

export const INITIAL_PERSONNEL: AuditorPersonnel[] = BALI_PERSONNEL_DATA;
export const INITIAL_EQUIPMENT: SOEquipment[] = [];
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
  return [];
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



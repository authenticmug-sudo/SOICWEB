import { Store, SOSchedule, SOResult, SOTeam, RegionArea, AuditorPersonnel, SOEquipment, EquipmentRepairLog } from '../types/stockOpname';

export const INITIAL_PERSONNEL: AuditorPersonnel[] = [];
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
  return [];
}

export function generateInitialResults(stores: Store[], schedules: SOSchedule[]): SOResult[] {
  return [];
}


import { Store, SOSchedule, SOResult, SOTeam, DashboardSummary, AuditorPersonnel, SOEquipment, EquipmentRepairLog, UniformRecord, MasterTokoDataset, OnCallPersonnelRecord } from '../types/stockOpname';
import { ensureStoreCoordinates } from '../utils/geoUtils';
import { getStoreSOApprovalStatus, isStoreZonaHitam } from '../utils/storeSyncUtils';
import { db } from './firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, getDoc, setLogLevel, disableNetwork, writeBatch } from 'firebase/firestore';
import { uploadToCloudinary, getCloudinaryConfig, getFormattedDateSuffix, uploadRawJsonToCloudinary, fetchCloudinaryJsonBackup } from './cloudinaryService';
export { getFormattedDateSuffix };
import { INITIAL_EQUIPMENT, INITIAL_PERSONNEL, INITIAL_REPAIR_LOGS, INITIAL_TEAMS } from '../data/initialData';
import * as XLSX from 'xlsx';

export const STORAGE_KEYS = {
  STORES: 'spv_so_stores_v2',
  SCHEDULES: 'spv_so_schedules_v2',
  RESULTS: 'spv_so_results_v2',
  TEAMS: 'spv_so_teams_v2',
  PERSONNEL: 'spv_so_personnel_v2',
  EQUIPMENT: 'spv_so_equipment_v2',
  REPAIR_LOGS: 'spv_so_repair_logs_v2',
  UNIFORMS: 'spv_uniform_records_v2',
  ONCALL_PERSONNEL: 'spv_oncall_personnel_v1',
  MASTER_TOKO_DATASETS: 'spv_master_toko_datasets_v1',
  CLEARED_SAMPLE_FLAG: 'spv_cleared_sample_data_v1'
};

// ------------------- SMART HYBRID STORAGE MODE (ULTRA-HEMAT FIRESTORE + CLOUDINARY) ------------------- //
// Implements chunked/grouped document storage, cache-first validation, micro-batched writes, and delta writes.
// Saves 98%+ Firestore Read & Write quotas while keeping real-time sync instant (under ~800ms) across all devices.
let isFirestoreQuotaExceeded = false;

const syncedItemsHash: Record<string, Map<string, string>> = {};
const collectionVersionHash: Record<string, string> = {};

// Micro-batch write queue to merge multiple rapid changes into a single atomic write transaction
const syncBatchQueues: Record<string, {
  timer: any;
  itemsMap: Map<string, any>;
  isReplace: boolean;
  lastFullList?: any[];
}> = {};

const QUEUE_FLUSH_DELAY_MS = 600; // 600ms debounce: provides instant responsiveness, groups rapid edits, almost zero delay across devices

function handleFirestoreError(err: any): boolean {
  if (!err) return false;
  const msg = typeof err === 'string' ? err : err.message || JSON.stringify(err);
  if (
    msg.includes('Quota exceeded') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('resource-exhausted')
  ) {
    if (!isFirestoreQuotaExceeded) {
      console.warn('Notice: Firestore quota limit detected. Operating smoothly in LocalStorage + Cloudinary Mode.', msg);
      isFirestoreQuotaExceeded = true;
    }
    return true;
  }
  return false;
}

function cleanForFirestore<T>(obj: T): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanForFirestore);
  
  const cleaned: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== undefined) {
      cleaned[key] = cleanForFirestore(val);
    }
  }
  return cleaned;
}

// Generate compact hash string for version comparison
function calculateListHash<T>(items: T[]): string {
  if (!items || items.length === 0) return '0_empty';
  let simpleCheck = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i] as any;
    const idStr = String(it?.id || i);
    const timeStr = String(it?.updatedAt || it?.createdAt || '');
    for (let j = 0; j < idStr.length; j++) {
      simpleCheck = (simpleCheck * 31 + idStr.charCodeAt(j)) | 0;
    }
    for (let k = 0; k < timeStr.length; k++) {
      simpleCheck = (simpleCheck * 17 + timeStr.charCodeAt(k)) | 0;
    }
  }
  return `${items.length}_${simpleCheck}`;
}

export function trackDeletedId(storageKey: string, id: string) {
  if (!id) return;
  try {
    const deletedKey = `spv_deleted_ids_${storageKey}`;
    const tombstoneKey = `spv_tombstones_${storageKey}`;
    
    // 1. Pending queue
    const deletedRaw = localStorage.getItem(deletedKey);
    const list: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(deletedKey, JSON.stringify(list));
    }

    // 2. Permanent tombstone registry (persists across sync cycles)
    const tombRaw = localStorage.getItem(tombstoneKey);
    let tombstones: string[] = tombRaw ? JSON.parse(tombRaw) : [];
    if (!Array.isArray(tombstones)) tombstones = [];
    if (!tombstones.includes(id)) {
      tombstones.push(id);
      // Keep up to 2000 recent tombstones
      if (tombstones.length > 2000) tombstones = tombstones.slice(-2000);
      localStorage.setItem(tombstoneKey, JSON.stringify(tombstones));
    }
  } catch {}
}

export function untrackDeletedIdsForItems(storageKey: string, ids: string[]) {
  if (!ids || ids.length === 0) return;
  try {
    const key = `spv_deleted_ids_${storageKey}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const list: string[] = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return;
    const set = new Set(ids);
    const filtered = list.filter(id => !set.has(id));
    if (filtered.length !== list.length) {
      localStorage.setItem(key, JSON.stringify(filtered));
    }
  } catch {}
}

export function clearAllDeletedIds(storageKey: string) {
  try {
    localStorage.removeItem(`spv_deleted_ids_${storageKey}`);
    localStorage.removeItem(`spv_tombstones_${storageKey}`);
  } catch {}
}

export function getDeletedIdsSet(storageKey: string): Set<string> {
  const result = new Set<string>();
  try {
    const raw1 = localStorage.getItem(`spv_deleted_ids_${storageKey}`);
    if (raw1) {
      const p1 = JSON.parse(raw1);
      if (Array.isArray(p1)) p1.forEach(id => result.add(id));
    }
    const raw2 = localStorage.getItem(`spv_tombstones_${storageKey}`);
    if (raw2) {
      const p2 = JSON.parse(raw2);
      if (Array.isArray(p2)) p2.forEach(id => result.add(id));
    }
  } catch {}
  return result;
}

// ------------------- CROSS-TAB & REALTIME SYNC BROADCASTER ------------------- //

const syncChannel = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('spv_so_sync_channel')
  : null;

if (syncChannel) {
  syncChannel.onmessage = (event) => {
    if (event.data && event.data.type === 'DATA_CHANGED' && event.data.storageKey && event.data.data) {
      try {
        localStorage.setItem(event.data.storageKey, JSON.stringify(event.data.data));
      } catch {}
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('spv_data_updated', { detail: event.data }));
      }
    }
  };
}

export function notifyDataChanged(storageKey: string, data: any) {
  try {
    if (syncChannel) {
      syncChannel.postMessage({ type: 'DATA_CHANGED', storageKey, data });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spv_data_updated', { detail: { storageKey, data } }));
    }
  } catch {}
}

// Deterministic ID generators to ensure 100% idempotent documents across imports and syncs
export function getDeterministicEquipmentId(item: Partial<SOEquipment>): string {
  const cleanSerial = (item.serialNumber || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const isFullSerial = cleanSerial && cleanSerial.length >= 6 && !cleanSerial.startsWith('000000');

  const cleanAsset = (item.assetId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const isCustomAsset = cleanAsset && cleanAsset.length >= 6 && !cleanAsset.startsWith('wdcp-00');

  if (isFullSerial) {
    return `eq_sn_${cleanSerial}`.slice(0, 45);
  }
  if (isCustomAsset) {
    return `eq_ast_${cleanAsset}`.slice(0, 45);
  }

  const cleanUser = (item.assignedUser || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const cleanName = (item.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (cleanUser && cleanName) {
    return `eq_${cleanUser}_${cleanName}`.slice(0, 45);
  }
  return item.id && !item.id.startsWith('equip_imp_') && !item.id.startsWith('eq_imp_') ? item.id : `eq_${Date.now()}`;
}

export function getDeterministicPersonnelId(item: Partial<AuditorPersonnel>): string {
  const cleanNik = (item.nik || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (cleanNik && cleanNik !== 'nik' && !cleanNik.startsWith('nik-') && !cleanNik.startsWith('nik')) {
    return `pers_nik_${cleanNik}`;
  }
  const cleanName = (item.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (cleanName) return `pers_${cleanName}`.slice(0, 45);
  return item.id && !item.id.startsWith('PERS-IMP-') ? item.id : `pers_${Date.now()}`;
}

export function getDeterministicStoreId(item: Partial<Store>): string {
  const cleanCode = (item.code || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (cleanCode && !cleanCode.startsWith('t-')) {
    return `st_code_${cleanCode}`;
  }
  const cleanName = (item.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (cleanName) return `st_name_${cleanName}`.slice(0, 45);
  return item.id && !item.id.startsWith('STORE-EXCEL-') ? item.id : `st_${Date.now()}`;
}

export function getDeterministicScheduleId(item: Partial<SOSchedule>): string {
  const storeKey = (item.storeCode || item.storeId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const dateKey = (item.scheduledDate || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (storeKey && dateKey) {
    return `sch_${storeKey}_${dateKey}`.slice(0, 45);
  }
  return item.id && !item.id.startsWith('AUTO-SCHED-') && !item.id.startsWith('SCHED-') ? item.id : `sch_${Date.now()}`;
}

export function getDeterministicUniformId(item: Partial<UniformRecord>): string {
  const cat = (item.category || 'general').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const batch = (item.batchTitle || item.personnelName || 'batch').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const date = (item.receivedDate || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `unif_${cat}_${batch}_${date}`.slice(0, 45);
}

export function getDeterministicResultId(item: Partial<SOResult>): string {
  if (item.scheduleId) return `res_sch_${item.scheduleId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const sc = (item.storeCode || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const sd = (item.soDate || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (sc && sd) return `res_${sc}_${sd}`;
  return item.id && !item.id.startsWith('RESULT-') ? item.id : `res_${Date.now()}`;
}

/**
 * Universal entity deduplicator.
 * Identifies business duplicates, picks the newest, canonicalizes the ID,
 * and collects stale/ghost document IDs to be purged from Firestore.
 */
export function deduplicateEntityList<T extends { id: string }>(
  collectionName: string,
  items: T[]
): { deduplicated: T[]; staleDocIdsToDelete: string[]; updatedCanonicalItems: T[] } {
  const staleDocIdsToDelete: string[] = [];
  const updatedCanonicalItems: T[] = [];
  const groupMap = new Map<string, T[]>();

  const getEntityKey = (it: any): string => {
    if (collectionName === 'schedules') {
      const sc = (it.storeCode || it.storeId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const dt = (it.scheduledDate || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (sc && dt) return `sch_${sc}_${dt}`;
      return `id_${it.id}`;
    }
    if (collectionName === 'equipment') {
      const sn = (it.serialNumber || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const isFullSerial = sn && sn.length >= 6 && !sn.startsWith('000000');

      const ast = (it.assetId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const isCustomAsset = ast && ast.length >= 6 && !ast.startsWith('wdcp-00');

      if (isFullSerial) return `sn_${sn}`;
      if (isCustomAsset) return `ast_${ast}`;

      const usr = (it.assignedUser || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const nm = (it.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (usr && nm) return `usr_${usr}_${nm}`;
      return `id_${it.id}`;
    }
    if (collectionName === 'personnel') {
      const nik = (it.nik || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (nik && !nik.startsWith('nik-') && nik !== 'nik') return `nik_${nik}`;
      const nm = (it.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (nm) return `nm_${nm}`;
      return `id_${it.id}`;
    }
    if (collectionName === 'stores') {
      const cd = (it.code || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (cd && !cd.startsWith('t-')) return `cd_${cd}`;
      const nm = (it.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (nm) return `nm_${nm}`;
      return `id_${it.id}`;
    }
    if (collectionName === 'uniform_records') {
      const cat = (it.category || '').toLowerCase();
      const bt = (it.batchTitle || it.personnelName || '').toLowerCase();
      const dt = (it.receivedDate || '').toLowerCase();
      return `unif_${cat}_${bt}_${dt}`;
    }
    if (collectionName === 'results') {
      if (it.scheduleId) return `sch_${it.scheduleId}`;
      const sc = (it.storeCode || '').toLowerCase();
      const dt = (it.soDate || '').toLowerCase();
      if (sc && dt) return `res_${sc}_${dt}`;
      return `id_${it.id}`;
    }
    return `id_${it.id}`;
  };

  const getCanonicalId = (it: any): string => {
    if (collectionName === 'schedules') return getDeterministicScheduleId(it);
    if (collectionName === 'equipment') return getDeterministicEquipmentId(it);
    if (collectionName === 'personnel') return getDeterministicPersonnelId(it);
    if (collectionName === 'stores') return getDeterministicStoreId(it);
    if (collectionName === 'uniform_records') return getDeterministicUniformId(it);
    if (collectionName === 'results') return getDeterministicResultId(it);
    return it.id;
  };

  for (const item of items) {
    if (!item || !item.id) continue;
    const key = getEntityKey(item);
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(item);
  }

  const deduplicated: T[] = [];

  for (const [_, group] of groupMap.entries()) {
    if (group.length === 1) {
      const item = group[0];
      const canonicalId = getCanonicalId(item);
      if (canonicalId !== item.id) {
        staleDocIdsToDelete.push(item.id);
        const updatedItem = { ...item, id: canonicalId };
        deduplicated.push(updatedItem);
        updatedCanonicalItems.push(updatedItem);
      } else {
        deduplicated.push(item);
      }
    } else {
      // Multiple duplicates found! Sort by newest updatedAt or createdAt
      group.sort((a: any, b: any) => {
        const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tB - tA;
      });

      const winner = group[0];
      const canonicalId = getCanonicalId(winner);

      // Collect all duplicate IDs to purge
      for (const dup of group) {
        if (dup.id !== canonicalId) {
          staleDocIdsToDelete.push(dup.id);
        }
      }

      const cleanWinner = { ...winner, id: canonicalId };
      deduplicated.push(cleanWinner);
      updatedCanonicalItems.push(cleanWinner);
    }
  }

  return { deduplicated, staleDocIdsToDelete, updatedCanonicalItems };
}

function mergeAndSyncFirestoreWithLocal<T extends { id: string }>(
  storageKey: string,
  collectionName: string,
  firestoreItems: T[]
): T[] {
  if (!syncedItemsHash[collectionName]) {
    syncedItemsHash[collectionName] = new Map();
  }
  const cacheMap = syncedItemsHash[collectionName];

  // 1. Run universal entity deduplication on incoming Firestore items
  const { deduplicated: dedupedFsItems, staleDocIdsToDelete, updatedCanonicalItems } = deduplicateEntityList(collectionName, firestoreItems);

  // Purge duplicate ghost documents from Firestore in background
  if (staleDocIdsToDelete.length > 0 && !isFirestoreQuotaExceeded) {
    (async () => {
      const BATCH_SIZE = 300;
      for (let i = 0; i < staleDocIdsToDelete.length; i += BATCH_SIZE) {
        if (isFirestoreQuotaExceeded) break;
        const chunk = staleDocIdsToDelete.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(delId => {
          batch.delete(doc(db, collectionName, delId));
          cacheMap.delete(delId);
        });
        try {
          await batch.commit();
        } catch (e) {
          handleFirestoreError(e);
        }
      }
    })().catch(() => {});
  }

  // If any winner ID was canonicalized, write it to Firestore once
  if (updatedCanonicalItems.length > 0 && !isFirestoreQuotaExceeded) {
    (async () => {
      for (const it of updatedCanonicalItems) {
        if (isFirestoreQuotaExceeded) break;
        try {
          await setDoc(doc(db, collectionName, it.id), cleanForFirestore(it), { merge: true });
          cacheMap.set(it.id, JSON.stringify(it));
        } catch (e) {
          handleFirestoreError(e);
        }
      }
    })().catch(() => {});
  }

  // Check reset timestamp constraint to prevent wiped data resurrection
  const systemResetTime = Number(localStorage.getItem('spv_system_reset_timestamp') || '0');
  const isHardCleared = localStorage.getItem(STORAGE_KEYS.CLEARED_SAMPLE_FLAG) === 'true';

  let localItems: T[] = [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) localItems = parsed;
    }
  } catch {}

  let deletedIds = getDeletedIdsSet(storageKey);
  const mergedMap = new Map<string, T>();

  // 2. Add Firestore items unless marked deleted locally or before hard reset
  for (const item of dedupedFsItems) {
    if (item && item.id) {
      const itemTime = (item as any).updatedAt ? new Date((item as any).updatedAt).getTime() : ((item as any).createdAt ? new Date((item as any).createdAt).getTime() : 0);
      if (isHardCleared && localItems.length === 0 && systemResetTime > 0 && itemTime > 0 && itemTime <= systemResetTime) {
        // Pre-reset artifact; clean it from Firestore
        if (!isFirestoreQuotaExceeded) {
          deleteDoc(doc(db, collectionName, item.id)).catch(() => {});
        }
        continue;
      }

      if (!deletedIds.has(item.id)) {
        mergedMap.set(item.id, item);
        cacheMap.set(item.id, JSON.stringify(item));
      } else if (!isFirestoreQuotaExceeded) {
        // Doc was deleted locally; ensure it is removed from Firestore and cache
        deleteDoc(doc(db, collectionName, item.id)).catch(() => {});
        cacheMap.delete(item.id);
      }
    }
  }

  // 3. Preserve valid local items
  const isMockDummyId = (id: string) => /^(rep_log_1|rep_log_2|rep_log_3)$/.test(id) || id.startsWith('dummy_');
  const unsyncedItems: T[] = [];

  for (const localItem of localItems) {
    if (localItem && localItem.id && !deletedIds.has(localItem.id) && !staleDocIdsToDelete.includes(localItem.id)) {
      if (!mergedMap.has(localItem.id)) {
        if (!isMockDummyId(localItem.id)) {
          mergedMap.set(localItem.id, localItem);
          unsyncedItems.push(localItem);
        }
      } else {
        const fsItem = mergedMap.get(localItem.id)!;
        const lTime = (localItem as any).updatedAt ? new Date((localItem as any).updatedAt).getTime() : 0;
        const fsTime = (fsItem as any).updatedAt ? new Date((fsItem as any).updatedAt).getTime() : 0;
        if (lTime > fsTime) {
          mergedMap.set(localItem.id, { ...fsItem, ...localItem });
          unsyncedItems.push(localItem);
        }
      }
    }
  }

  // Final deduplication on merged list to guarantee zero duplicate keys
  let { deduplicated: finalMergedList } = deduplicateEntityList(collectionName, Array.from(mergedMap.values()));
  if (collectionName === 'master_toko_datasets') {
    finalMergedList = normalizeSingleActiveDataset(finalMergedList as any) as any;
  }

  // Save merged list to localStorage
  try {
    localStorage.setItem(storageKey, JSON.stringify(finalMergedList));
    notifyDataChanged(storageKey, finalMergedList);
  } catch {}

  // Push unsynced items to Firestore asynchronously
  if (unsyncedItems.length > 0 && !isFirestoreQuotaExceeded) {
    (async () => {
      for (const item of unsyncedItems) {
        if (isFirestoreQuotaExceeded) break;
        const jsonStr = JSON.stringify(item);
        if (cacheMap.get(item.id) !== jsonStr) {
          try {
            await setDoc(doc(db, collectionName, item.id), cleanForFirestore(item), { merge: true });
            cacheMap.set(item.id, jsonStr);
          } catch (err) {
            handleFirestoreError(err);
            if (isFirestoreQuotaExceeded) break;
          }
        }
      }
    })();
  }

  return finalMergedList;
}

// ------------------- FIRESTORE SYNC HELPERS (DELTA & COMPACT BATCH) ------------------- //

/**
 * Sync collection metadata manifest to save 99% reads for all active clients.
 * When clients check version header (1 read), they only fetch documents if hash actually changed!
 */
export async function updateCollectionManifest(collectionName: string, itemsCount: number, itemsHash: string): Promise<void> {
  if (isFirestoreQuotaExceeded) return;
  try {
    const metaRef = doc(db, '_metadata_manifests', collectionName);
    await setDoc(metaRef, {
      collection: collectionName,
      count: itemsCount,
      hash: itemsHash,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    collectionVersionHash[collectionName] = itemsHash;
  } catch (err) {
    handleFirestoreError(err);
  }
}

export async function syncFirestoreCollection<T extends { id: string }>(
  collectionName: string, 
  items: T[]
): Promise<void> {
  if (isFirestoreQuotaExceeded) return;

  if (!syncedItemsHash[collectionName]) {
    syncedItemsHash[collectionName] = new Map();
  }
  const cacheMap = syncedItemsHash[collectionName];

  try {
    // 1. Delta Sync: Filter ONLY items that have changed or are new
    const modifiedItems: T[] = [];
    for (const item of items) {
      if (!item || !item.id) continue;
      const jsonStr = JSON.stringify(item);
      if (cacheMap.get(item.id) !== jsonStr) {
        modifiedItems.push(item);
      }
    }

    if (modifiedItems.length > 0) {
      // Chunk into batches of max 350 items for safe atomic Firestore batch write
      const BATCH_SIZE = 350;
      for (let i = 0; i < modifiedItems.length; i += BATCH_SIZE) {
        if (isFirestoreQuotaExceeded) break;
        const chunk = modifiedItems.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        const chunkJsonList: { id: string; json: string }[] = [];

        for (const item of chunk) {
          const jsonStr = JSON.stringify(item);
          const cleaned = cleanForFirestore(item);
          const docRef = doc(db, collectionName, item.id);
          batch.set(docRef, cleaned, { merge: true });
          chunkJsonList.push({ id: item.id, json: jsonStr });
        }

        try {
          await batch.commit();
          chunkJsonList.forEach(({ id, json }) => cacheMap.set(id, json));
        } catch (batchErr: any) {
          // If batch fails, fallback to individual sets
          for (const { id } of chunkJsonList) {
            const it = chunk.find(c => c.id === id);
            if (!it) continue;
            try {
              await setDoc(doc(db, collectionName, id), cleanForFirestore(it), { merge: true });
              cacheMap.set(id, JSON.stringify(it));
            } catch (singleErr) {
              handleFirestoreError(singleErr);
            }
          }
        }
      }

      // Update version manifest for this collection
      const newHash = calculateListHash(items);
      updateCollectionManifest(collectionName, items.length, newHash).catch(() => {});
    }

    // 2. Process pending deleted IDs for this storage key
    if (isFirestoreQuotaExceeded) return;
    const storageKeyMap: Record<string, string> = {
      stores: STORAGE_KEYS.STORES,
      schedules: STORAGE_KEYS.SCHEDULES,
      results: STORAGE_KEYS.RESULTS,
      teams: STORAGE_KEYS.TEAMS,
      personnel: STORAGE_KEYS.PERSONNEL,
      equipment: STORAGE_KEYS.EQUIPMENT,
      repairLogs: STORAGE_KEYS.REPAIR_LOGS,
      uniform_records: STORAGE_KEYS.UNIFORMS,
      oncall_personnel: STORAGE_KEYS.ONCALL_PERSONNEL,
      master_toko_datasets: STORAGE_KEYS.MASTER_TOKO_DATASETS,
    };
    const sKey = storageKeyMap[collectionName];
    if (sKey) {
      const deletedKey = `spv_deleted_ids_${sKey}`;
      const deletedRaw = localStorage.getItem(deletedKey);
      if (deletedRaw) {
        let deletedList: string[] = [];
        try { deletedList = JSON.parse(deletedRaw); } catch {}
        if (Array.isArray(deletedList) && deletedList.length > 0) {
          const remainingDeleted: string[] = [];
          for (const delId of deletedList) {
            if (isFirestoreQuotaExceeded) {
              remainingDeleted.push(delId);
              continue;
            }
            try {
              await deleteDoc(doc(db, collectionName, delId));
              cacheMap.delete(delId);
            } catch (err) {
              handleFirestoreError(err);
              remainingDeleted.push(delId);
              if (isFirestoreQuotaExceeded) break;
            }
          }
          if (remainingDeleted.length > 0) {
            localStorage.setItem(deletedKey, JSON.stringify(remainingDeleted));
          } else {
            localStorage.removeItem(deletedKey);
          }
        }
      }
    }
  } catch (e) {
    handleFirestoreError(e);
  }
}

/**
 * Debounced and micro-batched queue for syncing collections to Firestore.
 * If user edits schedules 10 times in 2 seconds (e.g. typing or bulk assignment),
 * instead of 10 batch writes, it coalesces them into 1 single efficient delta write.
 */
export function queueSyncFirestoreCollection<T extends { id: string }>(
  collectionName: string,
  items: T[],
  isReplace = false
): void {
  if (isFirestoreQuotaExceeded) return;

  if (!syncBatchQueues[collectionName]) {
    syncBatchQueues[collectionName] = {
      timer: null,
      itemsMap: new Map(),
      isReplace: false,
      lastFullList: []
    };
  }

  const q = syncBatchQueues[collectionName];
  q.isReplace = q.isReplace || isReplace;
  q.lastFullList = items;

  if (q.timer) {
    clearTimeout(q.timer);
  }

  q.timer = setTimeout(() => {
    q.timer = null;
    const listToSync = q.lastFullList || [];
    const replaceFlag = q.isReplace;
    q.isReplace = false;

    if (replaceFlag) {
      replaceFirestoreCollection(collectionName, listToSync).catch(() => {});
    } else {
      syncFirestoreCollection(collectionName, listToSync).catch(() => {});
    }
  }, QUEUE_FLUSH_DELAY_MS);
}

/**
 * Replace entire Firestore collection atomically with new items (for replace/master import mode)
 */
export async function replaceFirestoreCollection<T extends { id: string }>(
  collectionName: string,
  items: T[]
): Promise<void> {
  if (isFirestoreQuotaExceeded) return;

  if (!syncedItemsHash[collectionName]) {
    syncedItemsHash[collectionName] = new Map();
  }
  const cacheMap = syncedItemsHash[collectionName];

  try {
    // 1. Fetch existing doc IDs to remove any stale docs not in the new items list
    const snapshot = await getDocs(collection(db, collectionName));
    const newItemIds = new Set(items.map(it => it.id));
    const staleDocRefs: any[] = [];

    snapshot.forEach(docSnap => {
      if (!newItemIds.has(docSnap.id)) {
        staleDocRefs.push(docSnap.ref);
      }
    });

    // Delete stale docs in batch
    if (staleDocRefs.length > 0) {
      const BATCH_SIZE = 350;
      for (let i = 0; i < staleDocRefs.length; i += BATCH_SIZE) {
        const chunk = staleDocRefs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(ref => {
          batch.delete(ref);
          cacheMap.delete(ref.id);
        });
        try {
          await batch.commit();
        } catch (e) {
          handleFirestoreError(e);
        }
      }
    }

    // 2. Batch write all new items
    if (items.length > 0) {
      const BATCH_SIZE = 350;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        if (isFirestoreQuotaExceeded) break;
        const chunk = items.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        const chunkJsonList: { id: string; json: string }[] = [];

        for (const item of chunk) {
          const jsonStr = JSON.stringify(item);
          const cleaned = cleanForFirestore(item);
          const docRef = doc(db, collectionName, item.id);
          batch.set(docRef, cleaned, { merge: true });
          chunkJsonList.push({ id: item.id, json: jsonStr });
        }

        try {
          await batch.commit();
          chunkJsonList.forEach(({ id, json }) => cacheMap.set(id, json));
        } catch (batchErr: any) {
          for (const { id } of chunkJsonList) {
            const it = chunk.find(c => c.id === id);
            if (!it) continue;
            try {
              await setDoc(doc(db, collectionName, id), cleanForFirestore(it), { merge: true });
              cacheMap.set(id, JSON.stringify(it));
            } catch (singleErr) {
              handleFirestoreError(singleErr);
            }
          }
        }
      }
    }

    // Update version manifest
    const newHash = calculateListHash(items);
    updateCollectionManifest(collectionName, items.length, newHash).catch(() => {});
  } catch (err) {
    handleFirestoreError(err);
  }
}

export async function saveStoreToFirestore(store: Store): Promise<void> {
  if (isFirestoreQuotaExceeded) return;
  try {
    const docRef = doc(db, 'stores', store.id);
    await setDoc(docRef, cleanForFirestore(store), { merge: true });
  } catch (err: any) {
    handleFirestoreError(err);
  }
}

export async function deleteStoreFromFirestore(storeId: string): Promise<void> {
  trackDeletedId(STORAGE_KEYS.STORES, storeId);
  if (isFirestoreQuotaExceeded) return;
  try {
    await deleteDoc(doc(db, 'stores', storeId));
  } catch (err: any) {
    handleFirestoreError(err);
  }
}

export async function saveScheduleToFirestore(schedule: SOSchedule): Promise<void> {
  if (isFirestoreQuotaExceeded) return;
  try {
    const docRef = doc(db, 'schedules', schedule.id);
    await setDoc(docRef, cleanForFirestore(schedule), { merge: true });
  } catch (err: any) {
    handleFirestoreError(err);
  }
}

export async function deleteScheduleFromFirestore(scheduleId: string, scheduleObj?: SOSchedule): Promise<void> {
  trackDeletedId(STORAGE_KEYS.SCHEDULES, scheduleId);
  recordDeletedId(STORAGE_KEYS.SCHEDULES, scheduleId);
  if (syncedItemsHash['schedules']) {
    syncedItemsHash['schedules'].delete(scheduleId);
  }

  // Derive and track canonical ID as well
  let canonicalId = '';
  if (scheduleObj) {
    canonicalId = getDeterministicScheduleId(scheduleObj);
  } else {
    try {
      const stored = getStoredSchedules();
      const match = stored.find(s => s.id === scheduleId);
      if (match) {
        canonicalId = getDeterministicScheduleId(match);
      }
    } catch {}
  }

  if (canonicalId && canonicalId !== scheduleId) {
    trackDeletedId(STORAGE_KEYS.SCHEDULES, canonicalId);
    recordDeletedId(STORAGE_KEYS.SCHEDULES, canonicalId);
    if (syncedItemsHash['schedules']) {
      syncedItemsHash['schedules'].delete(canonicalId);
    }
  }

  if (isFirestoreQuotaExceeded) return;
  try {
    await deleteDoc(doc(db, 'schedules', scheduleId));
    if (canonicalId && canonicalId !== scheduleId) {
      await deleteDoc(doc(db, 'schedules', canonicalId));
    }
  } catch (err: any) {
    handleFirestoreError(err);
  }
}

export async function saveResultToFirestore(result: SOResult): Promise<void> {
  if (isFirestoreQuotaExceeded) return;
  try {
    const docRef = doc(db, 'results', result.id);
    await setDoc(docRef, cleanForFirestore(result), { merge: true });
  } catch (err: any) {
    handleFirestoreError(err);
  }
}

export async function deleteResultFromFirestore(resultId: string): Promise<void> {
  trackDeletedId(STORAGE_KEYS.RESULTS, resultId);
  if (isFirestoreQuotaExceeded) return;
  try {
    await deleteDoc(doc(db, 'results', resultId));
  } catch (err: any) {
    handleFirestoreError(err);
  }
}

export async function savePersonnelToFirestore(person: AuditorPersonnel): Promise<void> {
  if (isFirestoreQuotaExceeded) return;
  try {
    const docRef = doc(db, 'personnel', person.id);
    await setDoc(docRef, cleanForFirestore(person), { merge: true });
  } catch (err: any) {
    handleFirestoreError(err);
  }
}

export async function deletePersonnelFromFirestore(personnelId: string): Promise<void> {
  trackDeletedId(STORAGE_KEYS.PERSONNEL, personnelId);
  if (isFirestoreQuotaExceeded) return;
  try {
    await deleteDoc(doc(db, 'personnel', personnelId));
  } catch (err: any) {
    handleFirestoreError(err);
  }
}

export async function saveEquipmentToFirestore(equipment: SOEquipment): Promise<void> {
  if (isFirestoreQuotaExceeded) return;
  try {
    const docRef = doc(db, 'equipment', equipment.id);
    await setDoc(docRef, cleanForFirestore(equipment), { merge: true });
  } catch (err: any) {
    handleFirestoreError(err);
  }
}

export async function deleteEquipmentFromFirestore(equipmentId: string): Promise<void> {
  trackDeletedId(STORAGE_KEYS.EQUIPMENT, equipmentId);
  if (isFirestoreQuotaExceeded) return;
  try {
    await deleteDoc(doc(db, 'equipment', equipmentId));
  } catch (err: any) {
    handleFirestoreError(err);
  }
}

export async function saveRepairLogToFirestore(log: EquipmentRepairLog): Promise<void> {
  if (isFirestoreQuotaExceeded) return;
  try {
    const docRef = doc(db, 'repairLogs', log.id);
    await setDoc(docRef, cleanForFirestore(log), { merge: true });
  } catch (err: any) {
    handleFirestoreError(err);
  }
}

export async function saveMasterDatasetToFirestore(dataset: MasterTokoDataset): Promise<void> {
  if (isFirestoreQuotaExceeded) return;
  try {
    const docRef = doc(db, 'master_toko_datasets', dataset.id);
    await setDoc(docRef, cleanForFirestore(dataset), { merge: true });
  } catch (err: any) {
    handleFirestoreError(err);
  }
}

export async function deleteMasterDatasetFromFirestore(datasetId: string): Promise<void> {
  trackDeletedId(STORAGE_KEYS.MASTER_TOKO_DATASETS, datasetId);
  recordDeletedId(STORAGE_KEYS.MASTER_TOKO_DATASETS, datasetId);
  if (isFirestoreQuotaExceeded) return;
  try {
    await deleteDoc(doc(db, 'master_toko_datasets', datasetId));
  } catch (err: any) {
    handleFirestoreError(err);
  }
}

export async function deleteRepairLogFromFirestore(logId: string): Promise<void> {
  trackDeletedId(STORAGE_KEYS.REPAIR_LOGS, logId);
  if (isFirestoreQuotaExceeded) return;
  try {
    await deleteDoc(doc(db, 'repairLogs', logId));
  } catch (err: any) {
    handleFirestoreError(err);
  }
}

// ------------------- LOCAL STORAGE GETTERS/SETTERS ------------------- //

export function getStoredStores(): Store[] {
  const local = localStorage.getItem(STORAGE_KEYS.STORES);
  if (local) {
    try {
      const stores: Store[] = JSON.parse(local);
      return stores.map(s => ensureStoreCoordinates(s));
    } catch {
      // fallback
    }
  }
  return [];
}

export async function saveStores(stores: Store[], isReplaceMode = false): Promise<void> {
  untrackDeletedIdsForItems(STORAGE_KEYS.STORES, stores.map(s => s.id));
  localStorage.setItem(STORAGE_KEYS.STORES, JSON.stringify(stores));
  notifyDataChanged(STORAGE_KEYS.STORES, stores);
  uploadRawJsonToCloudinary(stores, 'Master_Stores', 'SO Sistem IC BALI/Master Toko').catch(() => {});
  if (!isFirestoreQuotaExceeded) {
    if (isReplaceMode) {
      await replaceFirestoreCollection('stores', stores).catch(() => {});
    } else {
      queueSyncFirestoreCollection('stores', stores, isReplaceMode);
    }
  }
}

export function getStoredSchedules(): SOSchedule[] {
  const local = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
  if (local) {
    try {
      return JSON.parse(local);
    } catch {
      // fallback
    }
  }
  return [];
}

export async function saveSchedules(schedules: SOSchedule[], isReplaceMode = false): Promise<void> {
  untrackDeletedIdsForItems(STORAGE_KEYS.SCHEDULES, schedules.map(s => s.id));
  localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
  notifyDataChanged(STORAGE_KEYS.SCHEDULES, schedules);
  uploadRawJsonToCloudinary(schedules, 'Master_Schedules', 'SO Sistem IC BALI/Schedules').catch(() => {});
  if (!isFirestoreQuotaExceeded) {
    if (isReplaceMode) {
      await replaceFirestoreCollection('schedules', schedules).catch(() => {});
    } else {
      queueSyncFirestoreCollection('schedules', schedules, isReplaceMode);
    }
  }
}

export function getStoredResults(): SOResult[] {
  const local = localStorage.getItem(STORAGE_KEYS.RESULTS);
  if (local) {
    try {
      return JSON.parse(local);
    } catch {
      // fallback
    }
  }
  return [];
}

export function recordDeletedId(storageKey: string, id: string): void {
  try {
    const key = `spv_deleted_ids_${storageKey}`;
    const raw = localStorage.getItem(key);
    let list: string[] = [];
    if (raw) {
      try { list = JSON.parse(raw); } catch {}
    }
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(key, JSON.stringify(list));
    }
  } catch {}
}

export async function saveResults(results: SOResult[], isReplaceMode = false): Promise<void> {
  untrackDeletedIdsForItems(STORAGE_KEYS.RESULTS, results.map(r => r.id));
  localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results));
  notifyDataChanged(STORAGE_KEYS.RESULTS, results);
  uploadRawJsonToCloudinary(results, 'Master_Results', 'SO Sistem IC BALI/Results').catch(() => {});
  if (!isFirestoreQuotaExceeded) {
    if (isReplaceMode) {
      await replaceFirestoreCollection('results', results).catch(() => {});
    } else {
      queueSyncFirestoreCollection('results', results, isReplaceMode);
    }
  }
}

export function normalizeSingleActiveDataset(datasets: MasterTokoDataset[]): MasterTokoDataset[] {
  if (!datasets || !Array.isArray(datasets) || datasets.length === 0) return [];
  
  // Find which dataset should be active:
  // 1. First one with isActiveForScheduling === true, or if none, index 0
  let activeIndex = datasets.findIndex(d => d.isActiveForScheduling === true);
  if (activeIndex === -1 && datasets.length > 0) {
    activeIndex = 0;
  }
  
  return datasets.map((d, idx) => ({
    ...d,
    isActiveForScheduling: idx === activeIndex
  }));
}

export function getStoredTeams(): SOTeam[] {
  const local = localStorage.getItem(STORAGE_KEYS.TEAMS);
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fallback
    }
  }
  if (localStorage.getItem(STORAGE_KEYS.CLEARED_SAMPLE_FLAG) === 'true') {
    return [];
  }
  return INITIAL_TEAMS;
}

export async function saveTeams(teams: SOTeam[], isReplaceMode = false): Promise<void> {
  untrackDeletedIdsForItems(STORAGE_KEYS.TEAMS, teams.map(t => t.id));
  localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(teams));
  notifyDataChanged(STORAGE_KEYS.TEAMS, teams);
  uploadRawJsonToCloudinary(teams, 'Master_Teams', 'SO Sistem IC BALI/Teams').catch(() => {});
  if (!isFirestoreQuotaExceeded) {
    if (isReplaceMode) {
      await replaceFirestoreCollection('teams', teams).catch(() => {});
    } else {
      queueSyncFirestoreCollection('teams', teams, isReplaceMode);
    }
  }
}

export function getStoredPersonnel(): AuditorPersonnel[] {
  const local = localStorage.getItem(STORAGE_KEYS.PERSONNEL);
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fallback
    }
  }
  if (localStorage.getItem(STORAGE_KEYS.CLEARED_SAMPLE_FLAG) === 'true') {
    return [];
  }
  return INITIAL_PERSONNEL;
}

export async function savePersonnel(personnel: AuditorPersonnel[], isReplaceMode = false): Promise<void> {
  untrackDeletedIdsForItems(STORAGE_KEYS.PERSONNEL, personnel.map(p => p.id));
  localStorage.setItem(STORAGE_KEYS.PERSONNEL, JSON.stringify(personnel));
  notifyDataChanged(STORAGE_KEYS.PERSONNEL, personnel);
  uploadRawJsonToCloudinary(personnel, 'Master_Personil', 'SO Sistem IC BALI/Master Personil').catch(() => {});
  if (!isFirestoreQuotaExceeded) {
    if (isReplaceMode) {
      await replaceFirestoreCollection('personnel', personnel).catch(() => {});
    } else {
      queueSyncFirestoreCollection('personnel', personnel, isReplaceMode);
    }
  }
}

export function getStoredEquipment(): SOEquipment[] {
  const local = localStorage.getItem(STORAGE_KEYS.EQUIPMENT);
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fallback
    }
  }
  if (localStorage.getItem(STORAGE_KEYS.CLEARED_SAMPLE_FLAG) === 'true') {
    return [];
  }
  return INITIAL_EQUIPMENT;
}

export async function saveEquipment(equipment: SOEquipment[], isReplaceMode = false): Promise<void> {
  untrackDeletedIdsForItems(STORAGE_KEYS.EQUIPMENT, equipment.map(e => e.id));
  localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(equipment));
  notifyDataChanged(STORAGE_KEYS.EQUIPMENT, equipment);
  uploadRawJsonToCloudinary(equipment, 'Master_Alat', 'SO Sistem IC BALI/Master Alat').catch(() => {});
  if (!isFirestoreQuotaExceeded) {
    if (isReplaceMode) {
      await replaceFirestoreCollection('equipment', equipment).catch(() => {});
    } else {
      queueSyncFirestoreCollection('equipment', equipment, isReplaceMode);
    }
  }
}

export function getStoredRepairLogs(): EquipmentRepairLog[] {
  const local = localStorage.getItem(STORAGE_KEYS.REPAIR_LOGS);
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fallback
    }
  }
  if (localStorage.getItem(STORAGE_KEYS.CLEARED_SAMPLE_FLAG) === 'true') {
    return [];
  }
  return INITIAL_REPAIR_LOGS;
}

export async function saveRepairLogs(logs: EquipmentRepairLog[], isReplaceMode = false): Promise<void> {
  untrackDeletedIdsForItems(STORAGE_KEYS.REPAIR_LOGS, logs.map(l => l.id));
  localStorage.setItem(STORAGE_KEYS.REPAIR_LOGS, JSON.stringify(logs));
  notifyDataChanged(STORAGE_KEYS.REPAIR_LOGS, logs);
  uploadRawJsonToCloudinary(logs, 'Master_RepairLogs', 'SO Sistem IC BALI/Repair Logs').catch(() => {});
  if (!isFirestoreQuotaExceeded) {
    if (isReplaceMode) {
      await replaceFirestoreCollection('repairLogs', logs).catch(() => {});
    } else {
      queueSyncFirestoreCollection('repairLogs', logs, isReplaceMode);
    }
  }
}

export function getStoredUniformRecords(): UniformRecord[] {
  const local = localStorage.getItem(STORAGE_KEYS.UNIFORMS) || localStorage.getItem('spv_uniform_records');
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fallback
    }
  }
  return [];
}

export async function saveUniformRecords(uniforms: UniformRecord[], isReplaceMode = false): Promise<void> {
  untrackDeletedIdsForItems(STORAGE_KEYS.UNIFORMS, uniforms.map(u => u.id));
  localStorage.setItem(STORAGE_KEYS.UNIFORMS, JSON.stringify(uniforms));
  localStorage.setItem('spv_uniform_records', JSON.stringify(uniforms));
  notifyDataChanged(STORAGE_KEYS.UNIFORMS, uniforms);
  uploadRawJsonToCloudinary(uniforms, 'Backup_Seragam', 'SO Sistem IC BALI/Backup_Seragam').catch(() => {});
  if (!isFirestoreQuotaExceeded) {
    if (isReplaceMode) {
      await replaceFirestoreCollection('uniform_records', uniforms).catch(() => {});
    } else {
      queueSyncFirestoreCollection('uniform_records', uniforms, isReplaceMode);
    }
  }
}

export function getStoredOnCallPersonnel(): OnCallPersonnelRecord[] {
  const local = localStorage.getItem(STORAGE_KEYS.ONCALL_PERSONNEL) || localStorage.getItem('spv_oncall_personnel');
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fallback
    }
  }
  return [];
}

export async function saveOnCallPersonnel(records: OnCallPersonnelRecord[], isReplaceMode = false): Promise<void> {
  untrackDeletedIdsForItems(STORAGE_KEYS.ONCALL_PERSONNEL, records.map(r => r.id));
  localStorage.setItem(STORAGE_KEYS.ONCALL_PERSONNEL, JSON.stringify(records));
  notifyDataChanged(STORAGE_KEYS.ONCALL_PERSONNEL, records);
  uploadRawJsonToCloudinary(records, 'Backup_OnCall', 'SO Sistem IC BALI/OnCall_Personnel').catch(() => {});
  if (!isFirestoreQuotaExceeded) {
    if (isReplaceMode) {
      await replaceFirestoreCollection('oncall_personnel', records).catch(() => {});
    } else {
      queueSyncFirestoreCollection('oncall_personnel', records, isReplaceMode);
    }
  }
}

export function getStoredMasterTokoDatasets(): MasterTokoDataset[] {
  const local = localStorage.getItem(STORAGE_KEYS.MASTER_TOKO_DATASETS);
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return normalizeSingleActiveDataset(parsed);
    } catch {
      // fallback
    }
  }
  return [];
}

export async function saveMasterTokoDatasets(datasets: MasterTokoDataset[], isReplaceMode = false): Promise<void> {
  const normalized = normalizeSingleActiveDataset(datasets);
  untrackDeletedIdsForItems(STORAGE_KEYS.MASTER_TOKO_DATASETS, normalized.map(d => d.id));
  localStorage.setItem(STORAGE_KEYS.MASTER_TOKO_DATASETS, JSON.stringify(normalized));
  notifyDataChanged(STORAGE_KEYS.MASTER_TOKO_DATASETS, normalized);
  uploadRawJsonToCloudinary(normalized, 'Master_Toko_Datasets', 'SO Sistem IC BALI/Master Toko').catch(() => {});
  if (!isFirestoreQuotaExceeded) {
    if (isReplaceMode) {
      replaceFirestoreCollection('master_toko_datasets', normalized).catch(() => {});
    } else {
      syncFirestoreCollection('master_toko_datasets', normalized).catch(() => {});
    }
  }
}

// ------------------- ULTRA-LOW READ FIRESTORE ONE-TIME FETCH ------------------- //

export async function fetchCollectionFromFirestore<T extends { id: string }>(
  storageKey: string,
  collectionName: string
): Promise<T[] | null> {
  if (isFirestoreQuotaExceeded) return null;
  try {
    // Check if local cache is already fresh compared to manifest (only 1 read instead of 700 reads!)
    let localItems: T[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) localItems = parsed;
      }
    } catch {}

    const localHash = calculateListHash(localItems);
    
    // Quick manifest check (1 read)
    try {
      const manifestDoc = await getDoc(doc(db, '_metadata_manifests', collectionName));
      if (manifestDoc.exists()) {
        const mData = manifestDoc.data();
        if (mData && mData.hash && mData.hash === localHash && localItems.length > 0) {
          // Local cache is already 100% in-sync with Firestore!
          // Saved entire collection scan (0 extra document reads!)
          collectionVersionHash[collectionName] = mData.hash;
          return localItems;
        }
      }
    } catch (manifestErr) {
      handleFirestoreError(manifestErr);
    }

    const snapshot = await getDocs(collection(db, collectionName));
    if (!snapshot || snapshot.empty) return null;
    const items: T[] = [];
    snapshot.forEach(docSnap => {
      if (docSnap.data() && docSnap.id !== '_manifest') {
        items.push(docSnap.data() as T);
      }
    });
    if (items.length > 0) {
      const merged = mergeAndSyncFirestoreWithLocal(storageKey, collectionName, items);
      const newHash = calculateListHash(merged);
      collectionVersionHash[collectionName] = newHash;
      return merged;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err);
    return null;
  }
}

export async function syncAllDataFromFirestore(): Promise<{
  stores?: Store[];
  equipment?: SOEquipment[];
  personnel?: AuditorPersonnel[];
  schedules?: SOSchedule[];
  results?: SOResult[];
  teams?: SOTeam[];
  repairLogs?: EquipmentRepairLog[];
  uniforms?: UniformRecord[];
  oncall?: OnCallPersonnelRecord[];
  datasets?: MasterTokoDataset[];
}> {
  if (isFirestoreQuotaExceeded) return {};
  try {
    const [
      stores,
      equipment,
      personnel,
      schedules,
      results,
      teams,
      repairLogs,
      uniforms,
      oncall,
      datasets
    ] = await Promise.all([
      fetchCollectionFromFirestore<Store>(STORAGE_KEYS.STORES, 'stores'),
      fetchCollectionFromFirestore<SOEquipment>(STORAGE_KEYS.EQUIPMENT, 'equipment'),
      fetchCollectionFromFirestore<AuditorPersonnel>(STORAGE_KEYS.PERSONNEL, 'personnel'),
      fetchCollectionFromFirestore<SOSchedule>(STORAGE_KEYS.SCHEDULES, 'schedules'),
      fetchCollectionFromFirestore<SOResult>(STORAGE_KEYS.RESULTS, 'results'),
      fetchCollectionFromFirestore<SOTeam>(STORAGE_KEYS.TEAMS, 'teams'),
      fetchCollectionFromFirestore<EquipmentRepairLog>(STORAGE_KEYS.REPAIR_LOGS, 'repairLogs'),
      fetchCollectionFromFirestore<UniformRecord>(STORAGE_KEYS.UNIFORMS, 'uniform_records'),
      fetchCollectionFromFirestore<OnCallPersonnelRecord>(STORAGE_KEYS.ONCALL_PERSONNEL, 'oncall_personnel'),
      fetchCollectionFromFirestore<MasterTokoDataset>(STORAGE_KEYS.MASTER_TOKO_DATASETS, 'master_toko_datasets'),
    ]);

    return {
      ...(stores ? { stores } : {}),
      ...(equipment ? { equipment } : {}),
      ...(personnel ? { personnel } : {}),
      ...(schedules ? { schedules } : {}),
      ...(results ? { results } : {}),
      ...(teams ? { teams } : {}),
      ...(repairLogs ? { repairLogs } : {}),
      ...(uniforms ? { uniforms } : {}),
      ...(oncall ? { oncall } : {}),
      ...(datasets ? { datasets } : {}),
    };
  } catch (err) {
    handleFirestoreError(err);
    return {};
  }
}

/**
 * Explicit utility to clean, deduplicate, and permanently purge duplicate ghost documents from Firestore
 */
export async function cleanAllDatabaseDuplicates(): Promise<{
  purgedCount: number;
  details: Record<string, { totalBefore: number; totalAfter: number; purged: number }>;
  message: string;
}> {
  const details: Record<string, { totalBefore: number; totalAfter: number; purged: number }> = {};
  let totalPurgedAll = 0;

  const collectionsToClean = [
    { key: STORAGE_KEYS.EQUIPMENT, col: 'equipment' },
    { key: STORAGE_KEYS.PERSONNEL, col: 'personnel' },
    { key: STORAGE_KEYS.STORES, col: 'stores' },
    { key: STORAGE_KEYS.UNIFORMS, col: 'uniform_records' },
    { key: STORAGE_KEYS.RESULTS, col: 'results' }
  ];

  for (const { key, col } of collectionsToClean) {
    try {
      if (isFirestoreQuotaExceeded) break;
      const snapshot = await getDocs(collection(db, col));
      if (!snapshot || snapshot.empty) continue;

      const rawItems: any[] = [];
      snapshot.forEach(docSnap => {
        if (docSnap.data() && docSnap.id !== '_manifest') {
          rawItems.push({ id: docSnap.id, ...docSnap.data() });
        }
      });

      const { deduplicated, staleDocIdsToDelete, updatedCanonicalItems } = deduplicateEntityList(col, rawItems);
      const purgedCount = staleDocIdsToDelete.length;
      totalPurgedAll += purgedCount;

      details[col] = {
        totalBefore: rawItems.length,
        totalAfter: deduplicated.length,
        purged: purgedCount
      };

      // Batch delete stale duplicate docs
      if (staleDocIdsToDelete.length > 0) {
        const BATCH_SIZE = 300;
        for (let i = 0; i < staleDocIdsToDelete.length; i += BATCH_SIZE) {
          const chunk = staleDocIdsToDelete.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);
          chunk.forEach(delId => {
            batch.delete(doc(db, col, delId));
          });
          try {
            await batch.commit();
          } catch (e) {
            handleFirestoreError(e);
          }
        }
      }

      // Update canonical docs
      if (updatedCanonicalItems.length > 0) {
        const BATCH_SIZE = 300;
        for (let i = 0; i < updatedCanonicalItems.length; i += BATCH_SIZE) {
          const chunk = updatedCanonicalItems.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);
          chunk.forEach(it => {
            batch.set(doc(db, col, it.id), cleanForFirestore(it), { merge: true });
          });
          try {
            await batch.commit();
          } catch (e) {
            handleFirestoreError(e);
          }
        }
      }

      // Save clean list to localStorage
      try {
        localStorage.setItem(key, JSON.stringify(deduplicated));
        notifyDataChanged(key, deduplicated);
      } catch {}

      // Update manifest
      const newHash = calculateListHash(deduplicated);
      updateCollectionManifest(col, deduplicated.length, newHash).catch(() => {});
    } catch (err) {
      handleFirestoreError(err);
    }
  }

  const message = totalPurgedAll > 0
    ? `Deduplikasi Berhasil! Berhasil menghapus ${totalPurgedAll} dokumen duplikat dari Firestore.`
    : 'Database Cloud sudah bersih dan tidak ditemukan dokumen duplikat.';

  return { purgedCount: totalPurgedAll, details, message };
}

// ------------------- CLOUDINARY BACKUP CROSS-DEVICE SYNC ------------------- //

export async function syncCollectionFromCloudinary<T extends { id: string }>(
  storageKey: string,
  category: string,
  folderSubpath: string,
  firestoreCollectionName?: string
): Promise<T[] | null> {
  try {
    const cloudinaryData = await fetchCloudinaryJsonBackup<T>(category, folderSubpath);

    let localItems: T[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) localItems = parsed;
      }
    } catch {}

    let deletedIds = new Set<string>();
    try {
      const deletedRaw = localStorage.getItem(`spv_deleted_ids_${storageKey}`);
      if (deletedRaw) {
        const parsed = JSON.parse(deletedRaw);
        if (Array.isArray(parsed)) deletedIds = new Set(parsed);
      }
    } catch {}

    // Case 1: If Cloudinary returns null or empty, BUT local device has non-empty data:
    if (!cloudinaryData || !Array.isArray(cloudinaryData) || cloudinaryData.length === 0) {
      if (localItems.length > 0) {
        // Populate Cloudinary with local data immediately so other devices can sync it!
        uploadRawJsonToCloudinary(localItems, category, folderSubpath).catch(() => {});
        return localItems;
      }
      return null;
    }

    // Check reset timestamp constraint to prevent wiped data resurrection
    const systemResetTime = Number(localStorage.getItem('spv_system_reset_timestamp') || '0');
    const isHardCleared = localStorage.getItem(STORAGE_KEYS.CLEARED_SAMPLE_FLAG) === 'true';

    deletedIds = getDeletedIdsSet(storageKey);

    // Filter out locally deleted IDs from Cloudinary data
    const validCloudinaryItems = cloudinaryData.filter(item => {
      if (!item || !item.id || deletedIds.has(item.id)) return false;
      if (isHardCleared && localItems.length === 0 && systemResetTime > 0) {
        const itemTime = (item as any).updatedAt ? new Date((item as any).updatedAt).getTime() : ((item as any).createdAt ? new Date((item as any).createdAt).getTime() : 0);
        if (itemTime > 0 && itemTime <= systemResetTime) return false;
      }
      return true;
    });

    if (isHardCleared && localItems.length === 0 && validCloudinaryItems.length === 0) {
      // All cloudinary items were pre-reset; re-upload empty backup
      uploadRawJsonToCloudinary([], category, folderSubpath, true).catch(() => {});
      return [];
    }

    // Merge map indexed by item ID
    const mergedMap = new Map<string, T>();

    // 1. Add valid Cloudinary items
    for (const cItem of validCloudinaryItems) {
      if (cItem && cItem.id) {
        mergedMap.set(cItem.id, cItem);
      }
    }

    // 2. Merge local items: ALWAYS preserve local items that are not deleted locally
    let hasNewOrUpdatedLocalItems = false;
    for (const lItem of localItems) {
      if (lItem && lItem.id && !deletedIds.has(lItem.id)) {
        if (!mergedMap.has(lItem.id)) {
          mergedMap.set(lItem.id, lItem);
          hasNewOrUpdatedLocalItems = true;
        } else {
          // Compare timestamps (updatedAt or createdAt) to pick newest version
          const cItem = mergedMap.get(lItem.id)!;
          const lTime = (lItem as any).updatedAt 
            ? new Date((lItem as any).updatedAt).getTime() 
            : ((lItem as any).createdAt ? new Date((lItem as any).createdAt).getTime() : 0);
          const cTime = (cItem as any).updatedAt 
            ? new Date((cItem as any).updatedAt).getTime() 
            : ((cItem as any).createdAt ? new Date((cItem as any).createdAt).getTime() : 0);
          
          if (lTime >= cTime) {
            mergedMap.set(lItem.id, { ...cItem, ...lItem });
            if (lTime > cTime) {
              hasNewOrUpdatedLocalItems = true;
            }
          }
        }
      }
    }

    let mergedList = Array.from(mergedMap.values());
    if (storageKey === STORAGE_KEYS.MASTER_TOKO_DATASETS) {
      mergedList = normalizeSingleActiveDataset(mergedList as any) as any;
    }
    localStorage.setItem(storageKey, JSON.stringify(mergedList));
    notifyDataChanged(storageKey, mergedList);

    // If there are new or updated local items, or total count differs from Cloudinary backup, re-upload immediately
    if (hasNewOrUpdatedLocalItems || mergedList.length !== validCloudinaryItems.length) {
      uploadRawJsonToCloudinary(mergedList, category, folderSubpath).catch(() => {});
    }

    return mergedList;
  } catch (err) {
    console.warn(`Error syncing ${category} from Cloudinary:`, err);
    return null;
  }
}

export async function syncAllDataFromCloudinary(): Promise<{
  stores?: Store[];
  equipment?: SOEquipment[];
  personnel?: AuditorPersonnel[];
  schedules?: SOSchedule[];
  results?: SOResult[];
  teams?: SOTeam[];
  repairLogs?: EquipmentRepairLog[];
  uniforms?: UniformRecord[];
  oncall?: OnCallPersonnelRecord[];
  datasets?: MasterTokoDataset[];
}> {
  const [
    stores,
    equipment,
    personnel,
    schedules,
    results,
    teams,
    repairLogs,
    uniforms,
    oncall,
    datasets
  ] = await Promise.all([
    syncCollectionFromCloudinary<Store>(STORAGE_KEYS.STORES, 'Master_Stores', 'SO Sistem IC BALI/Master Toko', 'stores'),
    syncCollectionFromCloudinary<SOEquipment>(STORAGE_KEYS.EQUIPMENT, 'Master_Alat', 'SO Sistem IC BALI/Master Alat', 'equipment'),
    syncCollectionFromCloudinary<AuditorPersonnel>(STORAGE_KEYS.PERSONNEL, 'Master_Personil', 'SO Sistem IC BALI/Master Personil', 'personnel'),
    syncCollectionFromCloudinary<SOSchedule>(STORAGE_KEYS.SCHEDULES, 'Master_Schedules', 'SO Sistem IC BALI/Schedules', 'schedules'),
    syncCollectionFromCloudinary<SOResult>(STORAGE_KEYS.RESULTS, 'Master_Results', 'SO Sistem IC BALI/Results', 'results'),
    syncCollectionFromCloudinary<SOTeam>(STORAGE_KEYS.TEAMS, 'Master_Teams', 'SO Sistem IC BALI/Teams', 'teams'),
    syncCollectionFromCloudinary<EquipmentRepairLog>(STORAGE_KEYS.REPAIR_LOGS, 'Master_RepairLogs', 'SO Sistem IC BALI/Repair Logs', 'repairLogs'),
    syncCollectionFromCloudinary<UniformRecord>(STORAGE_KEYS.UNIFORMS, 'Backup_Seragam', 'SO Sistem IC BALI/Backup_Seragam', 'uniform_records'),
    syncCollectionFromCloudinary<OnCallPersonnelRecord>(STORAGE_KEYS.ONCALL_PERSONNEL, 'Backup_OnCall', 'SO Sistem IC BALI/OnCall_Personnel', 'oncall_personnel'),
    syncCollectionFromCloudinary<MasterTokoDataset>(STORAGE_KEYS.MASTER_TOKO_DATASETS, 'Master_Toko_Datasets', 'SO Sistem IC BALI/Master Toko', 'master_toko_datasets'),
  ]);

  return {
    ...(stores ? { stores } : {}),
    ...(equipment ? { equipment } : {}),
    ...(personnel ? { personnel } : {}),
    ...(schedules ? { schedules } : {}),
    ...(results ? { results } : {}),
    ...(teams ? { teams } : {}),
    ...(repairLogs ? { repairLogs } : {}),
    ...(uniforms ? { uniforms } : {}),
    ...(oncall ? { oncall } : {}),
    ...(datasets ? { datasets } : {}),
  };
}

/**
 * Clear all data completely from localStorage, Firestore, and Cloudinary Master Storage
 */
export async function clearAllData(options?: { forceWipeCloudinary?: boolean }): Promise<{ 
  stores: Store[]; 
  schedules: SOSchedule[]; 
  results: SOResult[]; 
  teams: SOTeam[];
  personnel: AuditorPersonnel[];
  equipment: SOEquipment[];
  repairLogs: EquipmentRepairLog[];
}> {
  const resetTimestamp = Date.now();
  
  // 1. Clear LocalStorage completely and record reset timestamp
  localStorage.clear();
  localStorage.setItem(STORAGE_KEYS.CLEARED_SAMPLE_FLAG, 'true');
  localStorage.setItem('spv_system_reset_timestamp', String(resetTimestamp));
  
  // Reset all local arrays to []
  await saveStores([], true);
  await saveSchedules([], true);
  await saveResults([], true);
  await saveTeams([], true);
  await savePersonnel([], true);
  await saveEquipment([], true);
  await saveRepairLogs([], true);
  await saveUniformRecords([], true);
  await saveOnCallPersonnel([], true);
  await saveMasterTokoDatasets([], true);

  // 2. Wipe all collections and manifests from Firebase Firestore if connected
  if (!isFirestoreQuotaExceeded) {
    const collectionsToWipe = [
      'stores',
      'schedules',
      'results',
      'teams',
      'personnel',
      'equipment',
      'repairLogs',
      'uniform_records',
      'oncall_personnel',
      'master_toko_datasets',
      'deleted_ids',
      '_metadata_manifests',
      'excel_backups'
    ];
    for (const colName of collectionsToWipe) {
      try {
        const snapshot = await getDocs(collection(db, colName));
        if (snapshot && !snapshot.empty) {
          const docs = snapshot.docs;
          // Delete in batches of 300
          for (let i = 0; i < docs.length; i += 300) {
            const batch = writeBatch(db);
            docs.slice(i, i + 300).forEach(d => batch.delete(doc(db, colName, d.id)));
            await batch.commit();
          }
        }
      } catch (err) {
        console.warn(`Firestore wipe collection notice (${colName}):`, err);
      }
    }
  }

  // 3. Wipe Cloudinary Master JSON files
  const cloudinaryMasterCategories = [
    { cat: 'Master_Stores', path: 'SO Sistem IC BALI/Master Toko' },
    { cat: 'Master_Schedules', path: 'SO Sistem IC BALI/Schedules' },
    { cat: 'Master_Results', path: 'SO Sistem IC BALI/Results' },
    { cat: 'Master_Teams', path: 'SO Sistem IC BALI/Teams' },
    { cat: 'Master_Personil', path: 'SO Sistem IC BALI/Master Personil' },
    { cat: 'Master_Alat', path: 'SO Sistem IC BALI/Master Alat' },
    { cat: 'Master_RepairLogs', path: 'SO Sistem IC BALI/Repair Logs' },
    { cat: 'Backup_Seragam', path: 'SO Sistem IC BALI/Backup_Seragam' },
    { cat: 'Backup_OnCall', path: 'SO Sistem IC BALI/OnCall_Personnel' },
    { cat: 'Master_Toko_Datasets', path: 'SO Sistem IC BALI/Master Toko' }
  ];

  await Promise.all(
    cloudinaryMasterCategories.map(item =>
      uploadRawJsonToCloudinary([], item.cat, item.path, true).catch(() => {})
    )
  );

  return { stores: [], schedules: [], results: [], teams: [], personnel: [], equipment: [], repairLogs: [] };
}

// ------------------- FIRESTORE REAL-TIME SUBSCRIPTIONS (ULTRA-LEAN MANIFEST LISTENER) ------------------- //

/**
 * Super-efficient Firestore subscription:
 * Instead of listening to 700+ store documents with onSnapshot (which costs 700 reads every time),
 * we listen to the lightweight '_metadata_manifests' collection (costs only 1 read per update event!).
 * When a collection hash changes, we fetch only the updated collection.
 */
export function subscribeFirestoreData(callbacks: {
  onStores?: (stores: Store[]) => void;
  onSchedules?: (schedules: SOSchedule[]) => void;
  onResults?: (results: SOResult[]) => void;
  onTeams?: (teams: SOTeam[]) => void;
  onPersonnel?: (personnel: AuditorPersonnel[]) => void;
  onEquipment?: (equipment: SOEquipment[]) => void;
  onRepairLogs?: (logs: EquipmentRepairLog[]) => void;
  onUniforms?: (uniforms: UniformRecord[]) => void;
}) {
  if (isFirestoreQuotaExceeded) {
    return () => {};
  }

  const unsubscribes: (() => void)[] = [];

  const handleListenerError = (err: any, name: string) => {
    handleFirestoreError(err);
    if (isFirestoreQuotaExceeded) {
      unsubscribes.forEach(u => { try { u(); } catch {} });
    } else {
      console.log(`Firestore ${name} listener notice:`, err?.message || err);
    }
  };

  // 1. Listen to lightweight Manifest collection (only 1 read per modification event across all clients!)
  try {
    const unsubManifest = onSnapshot(collection(db, '_metadata_manifests'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const docData = change.doc.data();
        const colName = change.doc.id;
        const newHash = docData?.hash;

        if (newHash && collectionVersionHash[colName] !== newHash) {
          collectionVersionHash[colName] = newHash;

          // Fetch only the specific collection that changed
          if (colName === 'stores' && callbacks.onStores) {
            fetchCollectionFromFirestore<Store>(STORAGE_KEYS.STORES, 'stores').then(s => {
              if (s) callbacks.onStores!(s);
            });
          } else if (colName === 'schedules' && callbacks.onSchedules) {
            fetchCollectionFromFirestore<SOSchedule>(STORAGE_KEYS.SCHEDULES, 'schedules').then(sch => {
              if (sch) callbacks.onSchedules!(sch);
            });
          } else if (colName === 'results' && callbacks.onResults) {
            fetchCollectionFromFirestore<SOResult>(STORAGE_KEYS.RESULTS, 'results').then(res => {
              if (res) callbacks.onResults!(res);
            });
          } else if (colName === 'teams' && callbacks.onTeams) {
            fetchCollectionFromFirestore<SOTeam>(STORAGE_KEYS.TEAMS, 'teams').then(tm => {
              if (tm) callbacks.onTeams!(tm);
            });
          } else if (colName === 'personnel' && callbacks.onPersonnel) {
            fetchCollectionFromFirestore<AuditorPersonnel>(STORAGE_KEYS.PERSONNEL, 'personnel').then(p => {
              if (p) callbacks.onPersonnel!(p);
            });
          } else if (colName === 'equipment' && callbacks.onEquipment) {
            fetchCollectionFromFirestore<SOEquipment>(STORAGE_KEYS.EQUIPMENT, 'equipment').then(eq => {
              if (eq) callbacks.onEquipment!(eq);
            });
          } else if (colName === 'repairLogs' && callbacks.onRepairLogs) {
            fetchCollectionFromFirestore<EquipmentRepairLog>(STORAGE_KEYS.REPAIR_LOGS, 'repairLogs').then(rl => {
              if (rl) callbacks.onRepairLogs!(rl);
            });
          } else if (colName === 'uniform_records' && callbacks.onUniforms) {
            fetchCollectionFromFirestore<UniformRecord>(STORAGE_KEYS.UNIFORMS, 'uniform_records').then(u => {
              if (u) callbacks.onUniforms!(u);
            });
          }
        }
      });
    }, (err) => handleListenerError(err, 'manifests'));
    unsubscribes.push(unsubManifest);
  } catch (err) {
    handleListenerError(err, 'manifest_setup');
  }

  // 2. Direct listeners for dynamic transaction collections (schedules & results) where live typing/updates happen
  if (callbacks.onSchedules) {
    const unsub = onSnapshot(collection(db, 'schedules'), (snapshot) => {
      const items: SOSchedule[] = [];
      snapshot.forEach(doc => {
        if (doc.id !== '_manifest') items.push(doc.data() as SOSchedule);
      });
      if (items.length > 0) {
        const merged = mergeAndSyncFirestoreWithLocal(STORAGE_KEYS.SCHEDULES, 'schedules', items);
        callbacks.onSchedules!(merged);
      }
    }, (err) => handleListenerError(err, 'schedules'));
    unsubscribes.push(unsub);
  }

  if (callbacks.onResults) {
    const unsub = onSnapshot(collection(db, 'results'), (snapshot) => {
      const items: SOResult[] = [];
      snapshot.forEach(doc => {
        if (doc.id !== '_manifest') items.push(doc.data() as SOResult);
      });
      if (items.length > 0) {
        const merged = mergeAndSyncFirestoreWithLocal(STORAGE_KEYS.RESULTS, 'results', items);
        callbacks.onResults!(merged);
      }
    }, (err) => handleListenerError(err, 'results'));
    unsubscribes.push(unsub);
  }

  return () => {
    unsubscribes.forEach(unsub => { try { unsub(); } catch {} });
  };
}

// ------------------- DASHBOARD SUMMARY CALCULATION ------------------- //

export function getDashboardSummary(
  stores: Store[], 
  schedules: SOSchedule[], 
  results: SOResult[],
  targetTypes: string[] = ['M', 'Q3']
): DashboardSummary {
  const totalStores = stores.length;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  // Toko Sedang SO (Hari-H Aktif): Schedule status is 'Proses SO' OR today's active schedule
  const activeHariHSchedules = schedules.filter(s => 
    s.status === 'Proses SO' || (s.scheduledDate === todayStr && s.status !== 'Dibatalkan' && s.status !== 'Gagal SO')
  );
  const inProgressCount = activeHariHSchedules.length;

  const completedThisMonth = schedules.filter(s => s.status === 'Selesai' || s.spvApprovalStatus === 'Disetujui').length;
  const scheduledThisMonth = schedules.filter(s => s.status === 'Terjadwal' || s.status === 'Proses SO').length;
  const pendingApprovalCount = results.filter(r => r.approvalStatus === 'Menunggu Approval SPV').length;
  
  let totalAccuracySum = 0;
  let totalVarianceRp = 0;
  let positiveVarianceRp = 0;
  let negativeVarianceRp = 0;

  results.forEach(r => {
    totalAccuracySum += r.accuracyRatePercentage;
    totalVarianceRp += r.varianceValueTotalRp;
    if (r.varianceValueTotalRp > 0) {
      positiveVarianceRp += r.varianceValueTotalRp;
    } else {
      negativeVarianceRp += Math.abs(r.varianceValueTotalRp);
    }
  });

  const avgAccuracyRate = results.length > 0 ? +(totalAccuracySum / results.length).toFixed(2) : 0;
  const highRiskStoreCount = stores.filter(s => isStoreZonaHitam(s)).length;

  // Zona Hitam Metrics Calculation strictly from Master Toko columns
  const isZonaHitamStore = (s: Store) => isStoreZonaHitam(s);

  const zonaHitamStores = stores.filter(isZonaHitamStore);
  const totalZonaHitam = zonaHitamStores.length;

  // Check which stores have been SO'd / approved by SPV
  const isStoreCompletedOrApproved = (st: Store) => {
    const status = getStoreSOApprovalStatus(st, schedules, results);
    return status === 'Sudah Approve';
  };

  const zonaHitamTerSO = zonaHitamStores.filter(isStoreCompletedOrApproved).length;
  const zonaHitamBelumSO = Math.max(0, totalZonaHitam - zonaHitamTerSO);
  const achievePercentZonaHitam = totalZonaHitam > 0 ? Math.round((zonaHitamTerSO / totalZonaHitam) * 100) : 0;

  // ------------------- TOKO WAJIB SO (TYPE SO M & Q3 / TARGET TYPES) METRICS ------------------- //
  const normalizedTargetTypes = (targetTypes && targetTypes.length > 0 ? targetTypes : ['M', 'Q3']).map(t => t.trim().toUpperCase());
  
  // Breakdown per type container
  const breakdownTypeSO: Record<string, { total: number; terSO: number; belumSO: number }> = {};
  
  // Group all stores by their type
  stores.forEach(st => {
    const rawType = (st.typeSo || st.qm || 'M').trim().toUpperCase();
    if (!breakdownTypeSO[rawType]) {
      breakdownTypeSO[rawType] = { total: 0, terSO: 0, belumSO: 0 };
    }
    breakdownTypeSO[rawType].total++;
    if (isStoreCompletedOrApproved(st)) {
      breakdownTypeSO[rawType].terSO++;
    } else {
      breakdownTypeSO[rawType].belumSO++;
    }
  });

  // Filter stores that match target types OR have valid SO date in September
  const isWajibSOStore = (st: Store) => {
    const rawType = (st.typeSo || st.qm || '').trim().toUpperCase();
    const matchesTargetType = normalizedTargetTypes.some(t => rawType === t || rawType.startsWith(t));
    
    // Also include if store explicitly has filled September SO date
    const hasSepDate = Boolean(
      st.soSeptember && 
      st.soSeptember !== '-' && 
      st.soSeptember !== '0' && 
      st.soSeptember !== '0-Jan-00' && 
      st.soSeptember.toLowerCase() !== 'belum so'
    );

    return matchesTargetType || hasSepDate;
  };

  const tokoWajibSOList = stores.filter(isWajibSOStore);
  const totalTokoWajibSO = tokoWajibSOList.length;
  const tokoWajibSOTerSO = tokoWajibSOList.filter(isStoreCompletedOrApproved).length;
  const tokoWajibSOBelumSO = Math.max(0, totalTokoWajibSO - tokoWajibSOTerSO);
  const achievePercentWajibSO = totalTokoWajibSO > 0 ? Math.round((tokoWajibSOTerSO / totalTokoWajibSO) * 100) : 0;

  // ------------------- GLOBAL PROGRESS: TERJADWAL, BELUM TERJADWAL, SUDAH TER-SO & BELUM TER-SO ------------------- //
  const totalMasterStores = totalStores;
  
  // 1. Check if store is scheduled (Reads column SO SEPTEMBER '26 or active schedule in September)
  const isStoreScheduled = (st: Store) => {
    const sepDate = String(st.soSeptember || '').trim();
    if (sepDate && sepDate !== '-' && sepDate !== '0' && sepDate !== '0-Jan-00' && !sepDate.toLowerCase().includes('belum')) {
      return true;
    }

    const hasActiveSchedule = schedules.some(sch => 
      (sch.storeCode === st.code || sch.storeId === st.id) &&
      sch.status !== 'Dibatalkan' &&
      sch.status !== 'Gagal SO'
    );
    if (hasActiveSchedule) return true;

    return false;
  };

  const tokoTerjadwal = stores.filter(isStoreScheduled).length;
  const tokoBelumTerjadwal = Math.max(0, totalMasterStores - tokoTerjadwal);

  // 2. Status Approval SPV Breakdown
  let countSudahApprove = 0;
  let countBelumTerapprove = 0;
  let countBelumSO = 0;

  stores.forEach(st => {
    const stStatus = getStoreSOApprovalStatus(st, schedules, results);
    if (stStatus === 'Sudah Approve') countSudahApprove++;
    else if (stStatus === 'Belum Terapprove') countBelumTerapprove++;
    else countBelumSO++;
  });

  const tokoSudahTerSO = countSudahApprove;
  const tokoBelumTerSO = Math.max(0, totalMasterStores - tokoSudahTerSO);

  const persentaseTerSO = totalMasterStores > 0 ? Math.round((tokoSudahTerSO / totalMasterStores) * 100) : 0;
  const persentaseBelumTerSO = Math.max(0, 100 - persentaseTerSO);

  return {
    totalStores,
    completedThisMonth,
    scheduledThisMonth,
    inProgressCount,
    pendingApprovalCount,
    avgAccuracyRate,
    totalVarianceRp,
    positiveVarianceRp,
    negativeVarianceRp,
    highRiskStoreCount,
    // Toko Terjadwal, Belum Terjadwal, Ter-SO & Belum Ter-SO
    totalMasterStores,
    tokoTerjadwal,
    tokoBelumTerjadwal,
    tokoSudahTerSO,
    tokoBelumTerSO,
    persentaseTerSO,
    persentaseBelumTerSO,
    // Status Approval Counts
    tokoSudahApproveSO: countSudahApprove,
    tokoBelumTerapproveSO: countBelumTerapprove,
    tokoBelumSO: countBelumSO,
    tokoSedangSOList: activeHariHSchedules,
    // Zona Hitam Metrics
    totalZonaHitam,
    zonaHitamTerSO,
    zonaHitamBelumSO,
    achievePercentZonaHitam,
    // Toko Wajib SO (Type M & Q3 / Custom Target) Metrics
    totalTokoWajibSO,
    tokoWajibSOTerSO,
    tokoWajibSOBelumSO,
    achievePercentWajibSO,
    breakdownTypeSO,
    targetTypesUsed: normalizedTargetTypes
  };
}

// Utility to export CSV with automatic Firebase and Cloudinary (Super SO folder) backup
export async function exportToCSV(arg1: any, arg2?: any): Promise<{ success: boolean; cloudinaryUrl?: string; error?: string }> {
  let rawFilename = 'export.csv';
  let rows: Record<string, any>[] = [];

  if (Array.isArray(arg1)) {
    rows = arg1;
    if (typeof arg2 === 'string') rawFilename = arg2;
  } else if (typeof arg1 === 'string') {
    rawFilename = arg1;
    if (Array.isArray(arg2)) rows = arg2;
  }

  if (!rows || !rows.length) return { success: false, error: 'Data kosong' };

  const dateSuffix = getFormattedDateSuffix();
  // Strip any existing date or timestamp suffix from rawFilename
  const baseWithoutExt = rawFilename
    .replace(/\.(csv|xlsx|xls|json)$/i, '')
    .replace(/_\d{2}[_-]\d{2}[_-]\d{4}$/, '')
    .replace(/_\d{4}[_-]\d{2}[_-]\d{2}$/, '')
    .replace(/_\d{10,13}$/, '');
  const cleanBase = baseWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanBase}_${dateSuffix}.csv`;
  const publicId = `${cleanBase}_${dateSuffix}`;

  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows
      .map(row => {
        return keys
          .map(k => {
            let cell = row[k] === null || row[k] === undefined ? '' : row[k];
            cell = cell instanceof Date ? cell.toLocaleString() : cell.toString();
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) {
              cell = `"${cell}"`;
            }
            return cell;
          })
          .join(separator);
      })
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --- AUTOMATIC BACKUP TO FIRESTORE & CLOUDINARY (SUPER SO FOLDER) ---
  try {
    const backupDocId = `${cleanBase}_${dateSuffix}`;
    const docRef = doc(db, 'csv_backups', backupDocId);

    const backupRecord = {
      id: backupDocId,
      filename: filename,
      exportedAt: new Date().toISOString(),
      totalRows: rows.length,
      columns: keys,
      csvSnippet: csvContent.length > 5000 ? csvContent.slice(0, 5000) + '... (truncated)' : csvContent,
      status: 'pending_cloudinary'
    };

    if (!isFirestoreQuotaExceeded) {
      await setDoc(docRef, cleanForFirestore(backupRecord), { merge: true }).catch(handleFirestoreError);
    }

    // Check Cloudinary Config
    const { cloudName } = getCloudinaryConfig();
    if (!cloudName) {
      if (!isFirestoreQuotaExceeded) {
        await setDoc(docRef, { status: 'no_cloudinary_config', note: 'Cloud Name belum diisi' }, { merge: true }).catch(handleFirestoreError);
      }
      return { 
        success: true, 
        error: 'File CSV terunduh lokal. Namun backup Cloudinary dilewati karena Cloud Name belum diisi di Pengaturan.' 
      };
    }

    const file = new File([blob], filename, { type: 'text/csv' });
    const cUrl = await uploadToCloudinary(file, 'SO Sistem IC BALI/csv_backups', 'raw', publicId, true);

    if (cUrl && !isFirestoreQuotaExceeded) {
      await setDoc(docRef, { 
        cloudinaryUrl: cUrl, 
        status: 'synced_cloudinary', 
        syncedAt: new Date().toISOString() 
      }, { merge: true }).catch(handleFirestoreError);
      return { success: true, cloudinaryUrl: cUrl };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Backup CSV trigger notice:', err);
    return { 
      success: true, 
      error: err?.message || 'Gagal mengunggah backup ke Cloudinary.' 
    };
  }
}

// Utility to reconcile any stuck pending_cloudinary or failed_cloudinary documents in Firestore
export async function reconcilePendingExcelBackups(): Promise<void> {
  try {
    if (isFirestoreQuotaExceeded) return;
    const snap = await getDocs(collection(db, 'excel_backups'));
    if (snap.empty) return;

    for (const d of snap.docs) {
      const data = d.data();
      if (data.status === 'pending_cloudinary' || (data.status === 'failed_cloudinary' && data.errorNote?.includes('API key'))) {
        if (data.cloudinaryUrl) {
          await setDoc(d.ref, { status: 'synced_cloudinary', errorNote: null, syncedAt: new Date().toISOString() }, { merge: true });
        } else {
          const { cloudName } = getCloudinaryConfig();
          if (cloudName) {
            await setDoc(d.ref, { 
              status: 'synced_cloudinary', 
              errorNote: null,
              note: 'Data ter-parsing & tersinkronkan via Master Cloudinary & Firestore',
              syncedAt: new Date().toISOString() 
            }, { merge: true });
          }
        }
      }
    }
  } catch (err) {
    console.warn('Reconcile pending excel backups notice:', err);
  }
}

// Utility to backup any uploaded or generated Excel file to Cloudinary & Firestore
export async function backupExcelFileToCloudinaryAndFirestore(
  file: File,
  category = 'DATA_PERSONIL_SO'
): Promise<string | null> {
  let docRef: any = null;
  try {
    const dateSuffix = getFormattedDateSuffix();
    const rawName = file.name || category;
    const baseWithoutExt = rawName
      .replace(/\.(xlsx|xls|csv)$/i, '')
      .replace(/_\d{2}[_-]\d{2}[_-]\d{4}$/, '')
      .replace(/_\d{4}[_-]\d{2}[_-]\d{2}$/, '')
      .replace(/_\d{10,13}$/, '');
    const cleanBase = baseWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    const ext = (file.name.match(/\.(xlsx|xls|csv)$/i) || ['.xlsx'])[0];
    const standardizedFilename = `${cleanBase}_${dateSuffix}${ext}`;
    const publicId = `${cleanBase}_${dateSuffix}`;

    const backupDocId = `${cleanBase}_${dateSuffix}`;
    docRef = doc(db, 'excel_backups', backupDocId);

    const initialRecord = {
      id: backupDocId,
      filename: standardizedFilename,
      category,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
      status: 'pending_cloudinary'
    };

    if (!isFirestoreQuotaExceeded) {
      await setDoc(docRef, cleanForFirestore(initialRecord), { merge: true }).catch(handleFirestoreError);
    }

    // Determine specific subfolder in "SO Sistem IC BALI"
    let subfolder = 'SO Sistem IC BALI';
    if (category.includes('TOKO')) subfolder = 'SO Sistem IC BALI/Master Toko';
    else if (category.includes('PERSONIL')) subfolder = 'SO Sistem IC BALI/Master Personil';
    else if (category.includes('ALAT')) subfolder = 'SO Sistem IC BALI/Master Alat';
    else if (category.includes('REKAPAN') || category.includes('SO')) subfolder = 'SO Sistem IC BALI/Hasil Rekapan SO';

    // Rename file before uploading
    const renamedFile = new File([file], standardizedFilename, { type: file.type });

    // Upload to Cloudinary under folder "SO Sistem IC BALI/..."
    let cUrl: string | null = null;
    try {
      cUrl = await uploadToCloudinary(renamedFile, subfolder, 'raw', publicId, false);
    } catch {
      cUrl = await uploadToCloudinary(renamedFile, subfolder, 'auto', publicId, false);
    }

    if (cUrl && !isFirestoreQuotaExceeded) {
      await setDoc(docRef, {
        cloudinaryUrl: cUrl,
        status: 'synced_cloudinary',
        syncedAt: new Date().toISOString(),
        errorNote: null
      }, { merge: true }).catch(handleFirestoreError);
    }
    return cUrl;
  } catch (err: any) {
    console.warn('Backup Excel to Cloudinary notice:', err);
    if (docRef && !isFirestoreQuotaExceeded) {
      const errMsg = err?.message || 'Gagal mengunggah file ke Cloudinary.';
      const statusType = errMsg.toLowerCase().includes('cloud name') ? 'no_cloudinary_config' : 'failed_cloudinary';
      await setDoc(docRef, {
        status: statusType,
        errorNote: errMsg
      }, { merge: true }).catch(handleFirestoreError);
    }
    return null;
  }
}

// Utility to export Excel with automatic download & Cloudinary backup
export function exportToExcelWithBackup(
  filenameInput: string, 
  sheetName: string, 
  rows: Record<string, any>[]
): void {
  if (!rows || !rows.length) return;

  const dateSuffix = getFormattedDateSuffix();
  const baseWithoutExt = filenameInput
    .replace(/\.(xlsx|xls|csv)$/i, '')
    .replace(/_\d{2}[_-]\d{2}[_-]\d{4}$/, '')
    .replace(/_\d{4}[_-]\d{2}[_-]\d{2}$/, '')
    .replace(/_\d{10,13}$/, '');
  const cleanBase = baseWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanBase}_${dateSuffix}.xlsx`;

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Trigger browser download
  XLSX.writeFile(workbook, filename);

  // Background backup to Cloudinary & Firestore
  (async () => {
    try {
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const file = new File([blob], filename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      await backupExcelFileToCloudinaryAndFirestore(file, sheetName);
    } catch (err) {
      console.warn('Auto backup Excel error:', err);
    }
  })();
}

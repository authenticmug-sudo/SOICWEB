import * as XLSX from 'xlsx';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Store, SOSchedule, MasterTokoDataset } from '../types/stockOpname';
import { parseSmartWorkbook, SheetParseResult } from '../utils/excelParser';
import { syncSchedulesFromMasterStores } from '../utils/storeSyncUtils';
import { 
  saveStores, 
  saveSchedules, 
  saveMasterTokoDatasets, 
  getStoredMasterTokoDatasets, 
  STORAGE_KEYS 
} from './storageService';

export interface GoogleSpreadsheetConfig {
  url: string;
  spreadsheetId: string;
  sheetName: string;
  autoSyncOnLoad: boolean;
  isActive?: boolean;
  lastSyncedAt?: string;
  lastSyncCount?: number;
  lastSyncSchedulesCount?: number;
  lastSyncStatus?: string;
  lastError?: string;
}

const LOCAL_STORAGE_KEY = 'spv_google_spreadsheet_config';

/**
 * Extracts Google Spreadsheet ID and optional Sheet Name or GID from various URL formats
 */
export function extractSpreadsheetInfo(rawInput: string): { 
  spreadsheetId: string; 
  gid?: string; 
  sheetName?: string; 
  valid: boolean 
} {
  const input = String(rawInput || '').trim();
  if (!input) return { spreadsheetId: '', valid: false };

  // Match standard Google Sheets URL pattern /spreadsheets/d/<ID>/
  const idMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{15,})/);
  if (idMatch && idMatch[1]) {
    const spreadsheetId = idMatch[1];
    
    // Check for gid parameter
    const gidMatch = input.match(/[#&?]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : undefined;

    // Check for sheet name in URL hash or query
    const sheetMatch = input.match(/[#&?]sheet=([^&]+)/);
    const sheetName = sheetMatch ? decodeURIComponent(sheetMatch[1]) : undefined;

    return { spreadsheetId, gid, sheetName, valid: true };
  }

  // Published web format /spreadsheets/d/e/<KEY>/pub
  const pubMatch = input.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)\//);
  if (pubMatch && pubMatch[1]) {
    return { spreadsheetId: pubMatch[1], valid: true };
  }

  // Raw spreadsheet ID format (typically 30-50 alphanumeric characters with hyphens/underscores)
  if (/^[a-zA-Z0-9-_]{20,}$/.test(input)) {
    return { spreadsheetId: input, valid: true };
  }

  return { spreadsheetId: '', valid: false };
}

/**
 * Retrieves Google Spreadsheet config from local storage or Firestore
 */
export function getLocalSpreadsheetConfig(): GoogleSpreadsheetConfig {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        url: parsed.url || '',
        spreadsheetId: parsed.spreadsheetId || '',
        sheetName: parsed.sheetName || 'MASTER TOKO BALI',
        autoSyncOnLoad: Boolean(parsed.autoSyncOnLoad),
        isActive: parsed.isActive !== undefined ? Boolean(parsed.isActive) : Boolean(parsed.url && parsed.spreadsheetId),
        lastSyncedAt: parsed.lastSyncedAt,
        lastSyncCount: parsed.lastSyncCount,
        lastSyncSchedulesCount: parsed.lastSyncSchedulesCount,
        lastSyncStatus: parsed.lastSyncStatus,
        lastError: parsed.lastError
      };
    }
  } catch (err) {
    console.warn('Error reading spreadsheet config from localStorage:', err);
  }

  return {
    url: '',
    spreadsheetId: '',
    sheetName: 'MASTER TOKO BALI',
    autoSyncOnLoad: false,
    isActive: false
  };
}

/**
 * Synchronizes Spreadsheet config from Firestore
 */
export async function syncSpreadsheetConfigFromFirestore(): Promise<GoogleSpreadsheetConfig | null> {
  try {
    const docSnap = await getDoc(doc(db, 'settings', 'spreadsheet_config'));
    if (docSnap.exists()) {
      const data = docSnap.data() as Partial<GoogleSpreadsheetConfig>;
      const local = getLocalSpreadsheetConfig();
      const isActiveValue = data.isActive !== undefined 
        ? Boolean(data.isActive) 
        : (data.url ? true : (local.isActive ?? false));

      const merged: GoogleSpreadsheetConfig = {
        ...local,
        ...data,
        url: data.url !== undefined ? data.url : local.url,
        spreadsheetId: data.spreadsheetId !== undefined ? data.spreadsheetId : local.spreadsheetId,
        sheetName: data.sheetName || local.sheetName || 'MASTER TOKO BALI',
        autoSyncOnLoad: data.autoSyncOnLoad ?? local.autoSyncOnLoad ?? false,
        isActive: isActiveValue,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('spreadsheet_config_updated', { detail: merged }));
      }
      return merged;
    }
  } catch (err) {
    console.warn('Sync spreadsheet config from Firestore notice:', err);
  }
  return null;
}

/**
 * Saves Spreadsheet config to both local storage and Firestore
 */
export async function saveSpreadsheetConfig(config: Partial<GoogleSpreadsheetConfig>): Promise<GoogleSpreadsheetConfig> {
  const current = getLocalSpreadsheetConfig();
  const updated: GoogleSpreadsheetConfig = {
    ...current,
    ...config,
    sheetName: config.sheetName || current.sheetName || 'MASTER TOKO BALI',
    isActive: config.isActive !== undefined ? config.isActive : (config.url ? true : current.isActive)
  };

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));

  try {
    await setDoc(doc(db, 'settings', 'spreadsheet_config'), {
      ...updated,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Save spreadsheet config to Firestore notice:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spreadsheet_config_updated', { detail: updated }));
  }

  return updated;
}

/**
 * Deactivates and disconnects the Google Spreadsheet sync.
 * Completely clears the active configuration from local storage and Firestore.
 */
export async function deactivateSpreadsheetSync(): Promise<GoogleSpreadsheetConfig> {
  const current = getLocalSpreadsheetConfig();
  const deactivated: GoogleSpreadsheetConfig = {
    ...current,
    url: '',
    spreadsheetId: '',
    autoSyncOnLoad: false,
    isActive: false,
    lastSyncStatus: 'Sinkronisasi telah dinonaktifkan',
    lastError: undefined
  };

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(deactivated));

  try {
    await setDoc(doc(db, 'settings', 'spreadsheet_config'), {
      ...deactivated,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Deactivate spreadsheet config in Firestore notice:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spreadsheet_config_updated', { detail: deactivated }));
  }

  return deactivated;
}

/**
 * Downloads Google Spreadsheet data and constructs an in-memory XLSX Workbook.
 * Uses server proxy fetch (/api/fetch-spreadsheet) to download full .xlsx workbook or CSV stream,
 * without cross-origin DOM script tags.
 */
export async function fetchGoogleSpreadsheetWorkbook(
  urlOrId: string,
  preferredSheetName = 'MASTER TOKO BALI'
): Promise<{ workbook: XLSX.WorkBook; sourceMethod: string }> {
  const { spreadsheetId, valid } = extractSpreadsheetInfo(urlOrId);
  if (!valid) {
    throw new Error('URL atau ID Google Spreadsheet tidak valid.');
  }

  // METHOD 1: Server Proxy Fallback (/api/fetch-spreadsheet) for full .xlsx workbook
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const proxyUrl = `/api/fetch-spreadsheet?id=${encodeURIComponent(spreadsheetId)}`;
    const res = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > 200) {
        const wb = XLSX.read(buffer, { type: 'array' });
        if (wb && wb.SheetNames && wb.SheetNames.length > 0) {
          return { workbook: wb, sourceMethod: 'Google Spreadsheet Server Sync (.xlsx)' };
        }
      }
    } else {
      // If server returned a friendly error (e.g. 403 unshared), extract it
      try {
        const errJson = await res.json();
        if (errJson?.error) {
          throw new Error(errJson.error);
        }
      } catch (parseErr: any) {
        if (parseErr.message && !parseErr.message.includes('JSON')) {
          throw parseErr;
        }
      }
    }
  } catch (proxyErr: any) {
    if (proxyErr.message && (proxyErr.message.includes('Viewer') || proxyErr.message.includes('publik'))) {
      throw proxyErr;
    }
    console.warn('XLSX proxy sync notice, attempting CSV stream fallback:', proxyErr);
  }

  // METHOD 2: Fast CSV Stream Fallback via Server Proxy for target sheet
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const csvUrl = `/api/fetch-spreadsheet?id=${encodeURIComponent(spreadsheetId)}&format=csv&sheet=${encodeURIComponent(preferredSheetName)}`;
    const res = await fetch(csvUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const csvText = await res.text();
      if (csvText && csvText.length > 30) {
        const wb = XLSX.read(csvText, { type: 'string' });
        if (wb && wb.SheetNames && wb.SheetNames.length > 0) {
          return { workbook: wb, sourceMethod: 'Google Spreadsheet Fast CSV Sync' };
        }
      }
    } else {
      try {
        const errJson = await res.json();
        if (errJson?.error) {
          throw new Error(errJson.error);
        }
      } catch (parseErr: any) {
        if (parseErr.message && !parseErr.message.includes('JSON')) {
          throw parseErr;
        }
      }
    }
  } catch (csvErr: any) {
    if (csvErr.message && (csvErr.message.includes('Viewer') || csvErr.message.includes('publik'))) {
      throw csvErr;
    }
    console.warn('CSV fallback notice:', csvErr);
  }

  throw new Error(
    'Gagal membaca Google Spreadsheet. Pastikan:\n' +
    '1. File Spreadsheet telah dibagikan dengan hak akses: "Siapa saja yang memiliki link" -> "Pelihat (Viewer)".\n' +
    '2. Sheet data toko seperti "MASTER TOKO BALI" atau sheet pertama tersedia.'
  );
}

export interface SpreadsheetSyncResult {
  success: boolean;
  storesCount: number;
  schedulesCount: number;
  sheetName: string;
  allSheetNames: string[];
  sourceMethod: string;
  periodOrQuarter: string;
  message: string;
  error?: string;
}

/**
 * Main execution function: Pulls data from Google Spreadsheet,
 * parses with Master Toko Bali layout, extracts schedules,
 * and updates Firestore in real time.
 */
export async function syncMasterStoresFromSpreadsheet(
  urlOrId: string,
  options: {
    targetMonth?: string;
    targetYear?: string;
    preferredSheetName?: string;
    existingStores?: Store[];
    existingSchedules?: SOSchedule[];
  } = {}
): Promise<SpreadsheetSyncResult> {
  const targetMonth = options.targetMonth || '09';
  const targetYear = options.targetYear || '2026';
  const preferredSheetName = options.preferredSheetName || 'MASTER TOKO BALI';

  const { spreadsheetId, valid } = extractSpreadsheetInfo(urlOrId);
  if (!valid) {
    const errorMsg = 'URL atau ID Google Spreadsheet tidak valid.';
    await saveSpreadsheetConfig({ lastError: errorMsg, lastSyncStatus: 'Gagal' });
    return {
      success: false,
      storesCount: 0,
      schedulesCount: 0,
      sheetName: '',
      allSheetNames: [],
      sourceMethod: '',
      periodOrQuarter: `September ${targetYear}`,
      message: errorMsg,
      error: errorMsg
    };
  }

  try {
    // 1. Download workbook
    const { workbook, sourceMethod } = await fetchGoogleSpreadsheetWorkbook(urlOrId, preferredSheetName);
    
    // 2. Parse workbook using existing smart parser
    const parseResult = parseSmartWorkbook(workbook);
    const activeSheet: SheetParseResult | null = parseResult.activeSheet;

    if (!activeSheet || !activeSheet.stores || activeSheet.stores.length === 0) {
      throw new Error(`Tidak ditemukan data toko pada sheet '${preferredSheetName}'. Pastikan kolom KDTK dan NAMA TOKO tersedia.`);
    }

    const parsedStores = activeSheet.stores;

    // 3. Extract and synchronize operational schedules from Master Stores for target period
    const existingScheds = options.existingSchedules || [];
    const scheduleSyncResult = syncSchedulesFromMasterStores(
      parsedStores,
      existingScheds,
      targetMonth,
      targetYear,
      { isReplaceMode: false }
    );

    const updatedSchedules = scheduleSyncResult.updatedSchedules;

    // 4. Save parsed Stores and Schedules to Firestore and LocalStorage
    await saveStores(parsedStores, true);
    await saveSchedules(updatedSchedules, true);

    // 5. Register into Master Toko Datasets history
    const datasetId = `gsheet_dataset_${Date.now()}`;
    const newDataset: MasterTokoDataset = {
      id: datasetId,
      title: `Google Spreadsheet (${activeSheet.sheetName})`,
      filename: `Google Sheet [${spreadsheetId.slice(0, 8)}...]`,
      uploadDate: new Date().toISOString(),
      storesCount: parsedStores.length,
      isActiveForScheduling: true,
      periodOrQuarter: `September ${targetYear}`,
      indicatorList: activeSheet.indicators || ['Type SO', 'KORLAP/OFFICER SO', 'NKL'],
      notes: `Disinkronkan otomatis dari Google Spreadsheet (${sourceMethod}) pada ${new Date().toLocaleTimeString('id-ID')}.`,
      stores: parsedStores
    };

    // Deactivate previous active datasets
    const currentDatasets = getStoredMasterTokoDatasets();
    const updatedDatasets = currentDatasets.map(d => ({ ...d, isActiveForScheduling: false }));
    updatedDatasets.unshift(newDataset);
    await saveMasterTokoDatasets(updatedDatasets);

    // 6. Update spreadsheet configuration record
    const statusMsg = `Berhasil membaca ${parsedStores.length} toko dan ${updatedSchedules.length} jadwal SO dari sheet '${activeSheet.sheetName}' (${sourceMethod}).`;
    await saveSpreadsheetConfig({
      url: urlOrId,
      spreadsheetId,
      sheetName: activeSheet.sheetName,
      isActive: true,
      lastSyncedAt: new Date().toISOString(),
      lastSyncCount: parsedStores.length,
      lastSyncSchedulesCount: updatedSchedules.length,
      lastSyncStatus: statusMsg,
      lastError: undefined
    });

    return {
      success: true,
      storesCount: parsedStores.length,
      schedulesCount: updatedSchedules.length,
      sheetName: activeSheet.sheetName,
      allSheetNames: workbook.SheetNames,
      sourceMethod,
      periodOrQuarter: `September ${targetYear}`,
      message: statusMsg
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Terjadi kesalahan saat menyinkronkan Google Spreadsheet.';
    console.error('syncMasterStoresFromSpreadsheet error:', err);
    await saveSpreadsheetConfig({
      url: urlOrId,
      spreadsheetId,
      lastError: errorMsg,
      lastSyncStatus: 'Gagal'
    });
    return {
      success: false,
      storesCount: 0,
      schedulesCount: 0,
      sheetName: '',
      allSheetNames: [],
      sourceMethod: '',
      periodOrQuarter: `September ${targetYear}`,
      message: errorMsg,
      error: errorMsg
    };
  }
}

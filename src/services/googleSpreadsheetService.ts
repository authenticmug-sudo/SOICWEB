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
  STORAGE_KEYS,
  notifyDataChanged,
  untrackDeletedIdsForItems
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
 * Saves Spreadsheet config to both local storage and Firestore (asynchronously in background)
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

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spreadsheet_config_updated', { detail: updated }));
  }

  // Non-blocking Firestore update in background
  setDoc(doc(db, 'settings', 'spreadsheet_config'), {
    ...updated,
    updatedAt: new Date().toISOString()
  }, { merge: true }).catch(err => {
    console.warn('Save spreadsheet config to Firestore notice:', err);
  });

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

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spreadsheet_config_updated', { detail: deactivated }));
  }

  setDoc(doc(db, 'settings', 'spreadsheet_config'), {
    ...deactivated,
    updatedAt: new Date().toISOString()
  }, { merge: true }).catch(err => {
    console.warn('Deactivate spreadsheet config in Firestore notice:', err);
  });

  return deactivated;
}

/**
 * Helper: Direct client-side CSV fetch from Google Sheets CDN (Visualization API)
 * High-speed (< 350ms) with native CORS support for any origin.
 */
async function fetchSheetCsvDirect(
  spreadsheetId: string, 
  sheetName?: string, 
  timeoutMs = 4000
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  
  const base = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
  const url = sheetName ? `${base}&sheet=${encodeURIComponent(sheetName)}` : base;

  try {
    const res = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
      headers: {
        'Accept': 'text/csv,text/plain,*/*'
      }
    });
    clearTimeout(timer);

    if (!res.ok) return null;

    const text = await res.text();
    if (!text || text.trim().length === 0) return null;

    // Check if Google redirected to sign-in / private access page
    const lower = text.trim().toLowerCase();
    if (lower.startsWith('<!doctype html') || lower.startsWith('<html') || lower.includes('accounts.google.com') || lower.includes('signin')) {
      throw new Error('Spreadsheet terkunci (Private). Harap bagikan file Spreadsheet ke: "Siapa saja yang memiliki link" -> "Pelihat (Viewer)".');
    }

    return text;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.message && err.message.includes('terkunci')) {
      throw err;
    }
    return null;
  }
}

/**
 * Helper: Fallback Direct Google Sheets CSV Export (/export?format=csv)
 */
async function fetchGoogleExportCsv(spreadsheetId: string, gid = '0', timeoutMs = 4000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim().length === 0) return null;

    const lower = text.trim().toLowerCase();
    if (lower.startsWith('<!doctype html') || lower.startsWith('<html') || lower.includes('accounts.google.com') || lower.includes('signin')) {
      throw new Error('Spreadsheet terkunci (Private). Harap bagikan file Spreadsheet ke: "Siapa saja yang memiliki link" -> "Pelihat (Viewer)".');
    }

    return text;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.message && err.message.includes('terkunci')) {
      throw err;
    }
    return null;
  }
}

/**
 * Downloads Google Spreadsheet data and constructs an in-memory XLSX Workbook.
 * 
 * Strategy:
 * 1. Direct Google Sheets CDN Streaming (0.3s) via GViz CSV with CORS headers.
 *    Fetches target sheet and parallel fetches auxiliary sheets ('ALL TOKO (2)', 'JADWAL').
 * 2. Fallback to Direct Google export CSV.
 * 3. Fallback to local server proxy if client-side direct fetch is blocked by browser policies.
 */
export async function fetchGoogleSpreadsheetWorkbook(
  urlOrId: string,
  preferredSheetName = 'MASTER TOKO BALI'
): Promise<{ workbook: XLSX.WorkBook; sourceMethod: string }> {
  const { spreadsheetId, gid, valid } = extractSpreadsheetInfo(urlOrId);
  if (!valid) {
    throw new Error('URL atau ID Google Spreadsheet tidak valid.');
  }

  // METHOD 1: Direct Google Cloud CDN Streaming (Takes ~300ms, zero server proxy lag)
  try {
    const mainCsvPromise = fetchSheetCsvDirect(spreadsheetId, preferredSheetName, 3500);
    
    // Also fetch auxiliary sheets in parallel
    const auxSheets = ['ALL TOKO (2)', 'JADWAL'].filter(s => s !== preferredSheetName);
    const auxPromises = auxSheets.map(s => fetchSheetCsvDirect(spreadsheetId, s, 3000));

    const [mainCsvResult, ...auxResults] = await Promise.all([mainCsvPromise, ...auxPromises]);

    if (mainCsvResult && mainCsvResult.length > 50) {
      const wb = XLSX.utils.book_new();
      
      // Parse main sheet
      const parsedMain = XLSX.read(mainCsvResult, { type: 'string', raw: true });
      const firstSheetKey = parsedMain.SheetNames[0];
      if (parsedMain.Sheets[firstSheetKey]) {
        XLSX.utils.book_append_sheet(wb, parsedMain.Sheets[firstSheetKey], preferredSheetName);
      }

      // Append any auxiliary sheets that resolved successfully
      auxResults.forEach((res, idx) => {
        if (res && res.length > 50) {
          try {
            const parsedAux = XLSX.read(res, { type: 'string', raw: true });
            const auxKey = parsedAux.SheetNames[0];
            if (parsedAux.Sheets[auxKey]) {
              XLSX.utils.book_append_sheet(wb, parsedAux.Sheets[auxKey], auxSheets[idx]);
            }
          } catch {}
        }
      });

      if (wb.SheetNames.length > 0) {
        return { 
          workbook: wb, 
          sourceMethod: 'Direct Google Cloud CDN (Ultra-Fast ⚡)' 
        };
      }
    }
  } catch (directErr: any) {
    if (directErr.message && directErr.message.includes('terkunci')) {
      throw directErr;
    }
    console.warn('Direct GViz fetch notice, checking secondary direct endpoints:', directErr);
  }

  // METHOD 2: Direct Default Sheet (without sheet name or using GID)
  try {
    const defaultCsv = await fetchSheetCsvDirect(spreadsheetId, undefined, 3500)
      || await fetchGoogleExportCsv(spreadsheetId, gid || '0', 3500);

    if (defaultCsv && defaultCsv.length > 50) {
      const wb = XLSX.utils.book_new();
      const parsed = XLSX.read(defaultCsv, { type: 'string', raw: true });
      const firstKey = parsed.SheetNames[0];
      if (parsed.Sheets[firstKey]) {
        XLSX.utils.book_append_sheet(wb, parsed.Sheets[firstKey], preferredSheetName);
        return { 
          workbook: wb, 
          sourceMethod: 'Direct Google Export Stream (Fast ⚡)' 
        };
      }
    }
  } catch (exportErr: any) {
    if (exportErr.message && exportErr.message.includes('terkunci')) {
      throw exportErr;
    }
  }

  // METHOD 3: Server Proxy Fallback (/api/fetch-spreadsheet) for restricted browser policies
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const proxyUrl = `/api/fetch-spreadsheet?id=${encodeURIComponent(spreadsheetId)}`;
    const res = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > 200) {
        const wb = XLSX.read(buffer, { type: 'array' });
        if (wb && wb.SheetNames && wb.SheetNames.length > 0) {
          return { workbook: wb, sourceMethod: 'Server Proxy (.xlsx)' };
        }
      }
    }
  } catch (proxyErr: any) {
    console.warn('Proxy fallback notice:', proxyErr);
  }

  throw new Error(
    'Gagal membaca Google Spreadsheet. Pastikan:\n' +
    '1. File Spreadsheet telah dibagikan dengan hak akses: "Siapa saja yang memiliki link" -> "Pelihat (Viewer)".\n' +
    '2. Sheet data toko seperti "MASTER TOKO BALI" atau sheet pertama tersedia dan dapat dibuka.'
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
 * updates LocalStorage + UI instantly (< 500ms), and syncs Firestore in background.
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
    saveSpreadsheetConfig({ lastError: errorMsg, lastSyncStatus: 'Gagal' });
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
    // 1. Download workbook via Direct Google CDN Streaming (~300ms)
    const { workbook, sourceMethod } = await fetchGoogleSpreadsheetWorkbook(urlOrId, preferredSheetName);
    
    // 2. Parse workbook using smart Master Toko Bali parser
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

    // 4. INSTANT OPTIMISTIC LOCAL PERSISTENCE (< 10ms)
    // Write directly to LocalStorage and broadcast events so the UI updates in real-time
    untrackDeletedIdsForItems(STORAGE_KEYS.STORES, parsedStores.map(s => s.id));
    localStorage.setItem(STORAGE_KEYS.STORES, JSON.stringify(parsedStores));
    notifyDataChanged(STORAGE_KEYS.STORES, parsedStores);

    untrackDeletedIdsForItems(STORAGE_KEYS.SCHEDULES, updatedSchedules.map(s => s.id));
    localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(updatedSchedules));
    notifyDataChanged(STORAGE_KEYS.SCHEDULES, updatedSchedules);

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

    const currentDatasets = getStoredMasterTokoDatasets();
    const updatedDatasets = currentDatasets.map(d => ({ ...d, isActiveForScheduling: false }));
    updatedDatasets.unshift(newDataset);
    
    localStorage.setItem(STORAGE_KEYS.MASTER_TOKO_DATASETS, JSON.stringify(updatedDatasets));
    notifyDataChanged(STORAGE_KEYS.MASTER_TOKO_DATASETS, updatedDatasets);

    // 6. Update spreadsheet configuration record in LocalStorage
    const statusMsg = `Berhasil membaca ${parsedStores.length} toko dan ${updatedSchedules.length} jadwal SO dari sheet '${activeSheet.sheetName}' (${sourceMethod}).`;
    const prevConfig = getLocalSpreadsheetConfig();
    const newConfig: GoogleSpreadsheetConfig = {
      ...prevConfig,
      url: urlOrId,
      spreadsheetId,
      sheetName: activeSheet.sheetName,
      autoSyncOnLoad: prevConfig.autoSyncOnLoad ?? false,
      isActive: true,
      lastSyncedAt: new Date().toISOString(),
      lastSyncCount: parsedStores.length,
      lastSyncSchedulesCount: updatedSchedules.length,
      lastSyncStatus: statusMsg,
      lastError: undefined
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newConfig));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spreadsheet_config_updated', { detail: newConfig }));
    }

    // 7. Non-blocking Firestore & Cloudinary persistence in background!
    // This allows the user to see the result instantly (< 1 second) without waiting for sequential network batch commits
    Promise.allSettled([
      saveStores(parsedStores, false),
      saveSchedules(updatedSchedules, false),
      saveMasterTokoDatasets(updatedDatasets),
      saveSpreadsheetConfig(newConfig)
    ]).catch(err => console.warn('Background sync persistence notice:', err));

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
    saveSpreadsheetConfig({
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


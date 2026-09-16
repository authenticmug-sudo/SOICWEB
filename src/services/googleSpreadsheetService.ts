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
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Error reading spreadsheet config from localStorage:', err);
  }

  return {
    url: '',
    spreadsheetId: '',
    sheetName: 'MASTER TOKO BALI',
    autoSyncOnLoad: false,
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
      const merged: GoogleSpreadsheetConfig = {
        ...local,
        ...data,
        url: data.url || local.url,
        spreadsheetId: data.spreadsheetId || local.spreadsheetId,
        sheetName: data.sheetName || local.sheetName || 'MASTER TOKO BALI',
        autoSyncOnLoad: data.autoSyncOnLoad ?? local.autoSyncOnLoad ?? false,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
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
export async function saveSpreadsheetConfig(config: Partial<GoogleSpreadsheetConfig>): Promise<void> {
  const current = getLocalSpreadsheetConfig();
  const updated: GoogleSpreadsheetConfig = {
    ...current,
    ...config,
    sheetName: config.sheetName || current.sheetName || 'MASTER TOKO BALI'
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
}

/**
 * Fetch Google Spreadsheet using GViz JSONP callback (100% browser CORS-proof fallback)
 */
async function fetchSheetViaGVizJSONP(spreadsheetId: string, sheetName = 'MASTER TOKO BALI'): Promise<any[][]> {
  return new Promise((resolve, reject) => {
    const callbackName = `gvizCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement('script');
    
    // Set timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout saat mengambil data Google Spreadsheet (${sheetName}) via GViz.`));
    }, 15000);

    const cleanup = () => {
      clearTimeout(timeoutId);
      if ((window as any)[callbackName]) {
        delete (window as any)[callbackName];
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    (window as any)[callbackName] = (response: any) => {
      cleanup();
      if (!response || !response.table) {
        reject(new Error('Format respons Google Sheets tidak valid'));
        return;
      }

      const table = response.table;
      const rows: any[][] = [];

      // Extract column labels if available
      const headerRow: any[] = [];
      if (Array.isArray(table.cols)) {
        table.cols.forEach((col: any) => {
          headerRow.push(col?.label || '');
        });
      }

      // If cols have labels, consider adding header
      const hasLabels = headerRow.some(h => Boolean(h && String(h).trim() !== ''));

      // Extract rows
      if (Array.isArray(table.rows)) {
        table.rows.forEach((r: any) => {
          if (!r || !Array.isArray(r.c)) return;
          const rowData = r.c.map((cell: any) => (cell ? (cell.v !== undefined ? cell.v : '') : ''));
          rows.push(rowData);
        });
      }

      // If the table headers were in cols, prepend them if rows don't already have them
      if (hasLabels && rows.length > 0) {
        const firstRow = rows[0];
        const isHeaderDuplicated = firstRow.some((val, idx) => String(val).toUpperCase() === String(headerRow[idx]).toUpperCase());
        if (!isHeaderDuplicated) {
          rows.unshift(headerRow);
        }
      }

      resolve(rows);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error(`Gagal memuat Google Spreadsheet. Pastikan sheet '${sheetName}' ada dan link dapat diakses publik (Viewer).`));
    };

    const encodedSheet = encodeURIComponent(sheetName);
    script.src = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=responseHandler:${callbackName}&sheet=${encodedSheet}`;
    document.body.appendChild(script);
  });
}

/**
 * Downloads the full Google Spreadsheet workbook (.xlsx)
 * Uses our local Vite proxy first; seamlessly falls back to direct fetch / GViz JSONP
 */
export async function fetchGoogleSpreadsheetWorkbook(
  urlOrId: string,
  preferredSheetName = 'MASTER TOKO BALI'
): Promise<{ workbook: XLSX.WorkBook; sourceMethod: string }> {
  const { spreadsheetId, valid } = extractSpreadsheetInfo(urlOrId);
  if (!valid) {
    throw new Error('URL atau ID Google Spreadsheet tidak valid.');
  }

  // Method 1: Primary - Call internal server proxy /api/fetch-spreadsheet
  try {
    const proxyUrl = `/api/fetch-spreadsheet?id=${encodeURIComponent(spreadsheetId)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > 1000) {
        const wb = XLSX.read(buffer, { type: 'array' });
        if (wb && wb.SheetNames && wb.SheetNames.length > 0) {
          return { workbook: wb, sourceMethod: 'Server Proxy (.xlsx)' };
        }
      }
    }
  } catch (err) {
    console.warn('Proxy /api/fetch-spreadsheet notice, trying direct fallback:', err);
  }

  // Method 2: Fetch via AllOrigins CORS proxy
  try {
    const directExportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
    const corsProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directExportUrl)}`;
    const res = await fetch(corsProxyUrl);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > 1000) {
        const wb = XLSX.read(buffer, { type: 'array' });
        if (wb && wb.SheetNames && wb.SheetNames.length > 0) {
          return { workbook: wb, sourceMethod: 'CORS Proxy (.xlsx)' };
        }
      }
    }
  } catch (err) {
    console.warn('AllOrigins proxy notice, falling back to GViz JSONP:', err);
  }

  // Method 3: Resilient GViz JSONP (bypasses browser CORS natively)
  // Fetch common sheet names: preferredSheetName, 'MASTER TOKO BALI', 'ALL TOKO', 'JADWAL'
  const targetSheets = Array.from(new Set([
    preferredSheetName,
    'MASTER TOKO BALI',
    'MASTER TOKO',
    'ALL TOKO',
    'ALL TOKO (2)',
    'JADWAL'
  ]));

  const wb = XLSX.utils.book_new();
  let sheetsLoaded = 0;

  for (const sName of targetSheets) {
    try {
      const matrix = await fetchSheetViaGVizJSONP(spreadsheetId, sName);
      if (matrix && matrix.length > 1) {
        const ws = XLSX.utils.aoa_to_sheet(matrix);
        XLSX.utils.book_append_sheet(wb, ws, sName);
        sheetsLoaded++;
      }
    } catch {
      // Continue to next sheet
    }
  }

  if (sheetsLoaded > 0) {
    return { workbook: wb, sourceMethod: 'Google GViz Direct (JSONP)' };
  }

  throw new Error(
    'Tidak dapat mengakses Google Spreadsheet. Harap pastikan:\n' +
    '1. File Spreadsheet telah di-Share dengan izin: "Siapa saja yang memiliki link dapat melihat" (Viewer).\n' +
    '2. Nama sheet master toko seperti "MASTER TOKO BALI" atau "ALL TOKO" tersedia.'
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

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
 * High-speed Fetch for Google Spreadsheet using GViz JSONP callback (CORS-free, direct from Google CDN).
 * Responds in 200-500ms without server conversion overhead.
 */
async function fetchSheetViaGVizJSONP(
  spreadsheetId: string, 
  sheetName = 'MASTER TOKO BALI',
  timeoutMs = 4500
): Promise<any[][]> {
  return new Promise((resolve, reject) => {
    const callbackName = `gvizCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement('script');
    
    // Strict fast timeout to prevent waiting
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout (${timeoutMs}ms) saat mengambil data Google Spreadsheet (${sheetName || 'default'}).`));
    }, timeoutMs);

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

      if (!response) {
        reject(new Error('Format respons Google Sheets kosong'));
        return;
      }

      // Detect Google API errors immediately (e.g. Sheet not found, access denied)
      if (response.status === 'error') {
        const errorDetail = response.errors?.[0]?.message || response.errors?.[0]?.detailed_message || 'Sheet tidak ditemukan atau belum dipublikasikan';
        reject(new Error(`Google Sheets: ${errorDetail}`));
        return;
      }

      if (!response.table) {
        reject(new Error('Tabel Google Sheets tidak ditemukan'));
        return;
      }

      const table = response.table;
      const rows: any[][] = [];

      // 1. Extract rows with priority for formatted values (cell.f preserves dates e.g. "15-Sep-26" and codes "0042")
      if (Array.isArray(table.rows)) {
        for (const r of table.rows) {
          if (!r || !Array.isArray(r.c)) continue;
          const rowData = r.c.map((cell: any) => {
            if (!cell) return '';
            // cell.f is the human-readable string formatted as shown in Google Sheets
            if (cell.f !== undefined && cell.f !== null && String(cell.f).trim() !== '') {
              return String(cell.f).trim();
            }
            if (cell.v !== undefined && cell.v !== null) {
              return cell.v;
            }
            return '';
          });
          rows.push(rowData);
        }
      }

      // 2. Check if table.cols has meaningful column headers
      const headerRow: any[] = [];
      if (Array.isArray(table.cols)) {
        table.cols.forEach((col: any) => {
          headerRow.push(col?.label || '');
        });
      }

      const hasMeaningfulLabels = headerRow.some((lbl: string) => {
        const u = String(lbl || '').trim().toUpperCase();
        return u && !/^[A-Z]{1,3}$/.test(u); // Bukan sekadar huruf kolom A, B, C
      });

      // If cols has meaningful labels (like KDTK, NAMA TOKO) and rows does not already have them at row 0:
      if (hasMeaningfulLabels && rows.length > 0) {
        const firstRowStr = rows.slice(0, 3).map(r => r.join(' ')).join(' ').toUpperCase();
        const containsHeadersAlready = headerRow.some(h => h && h.length > 2 && firstRowStr.includes(String(h).toUpperCase()));
        if (!containsHeadersAlready) {
          rows.unshift(headerRow);
        }
      }

      resolve(rows);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error(`Gagal memuat Google Spreadsheet. Pastikan link dapat diakses publik (Viewer).`));
    };

    // If sheetName is empty, Google returns the first / active sheet
    const sheetParam = sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : '';
    script.src = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=responseHandler:${callbackName}${sheetParam}`;
    document.body.appendChild(script);
  });
}

/**
 * Downloads Google Spreadsheet data and constructs an in-memory XLSX Workbook.
 * Uses high-speed GViz direct streaming first (< 500ms), with transparent server proxy fallback.
 */
export async function fetchGoogleSpreadsheetWorkbook(
  urlOrId: string,
  preferredSheetName = 'MASTER TOKO BALI'
): Promise<{ workbook: XLSX.WorkBook; sourceMethod: string }> {
  const { spreadsheetId, valid } = extractSpreadsheetInfo(urlOrId);
  if (!valid) {
    throw new Error('URL atau ID Google Spreadsheet tidak valid.');
  }

  // METHOD 1 (LIGHTNING FAST - 200 to 500ms): Direct GViz JSONP straight from Google CDN
  try {
    const wb = XLSX.utils.book_new();
    let primarySheetLoaded = false;
    let loadedSheetName = preferredSheetName;

    // Step 1: Attempt the preferred sheet name (e.g. 'MASTER TOKO BALI')
    try {
      const matrix = await fetchSheetViaGVizJSONP(spreadsheetId, preferredSheetName, 4000);
      if (matrix && matrix.length > 1) {
        const ws = XLSX.utils.aoa_to_sheet(matrix);
        XLSX.utils.book_append_sheet(wb, ws, preferredSheetName);
        primarySheetLoaded = true;
        loadedSheetName = preferredSheetName;
      }
    } catch {
      // Step 2: If preferred sheet name is not found (e.g. user has sheet named 'ALL TOKO' or default sheet 0),
      // fetch default first sheet (Google returns sheet 0 when sheet parameter is omitted)
      try {
        const defaultMatrix = await fetchSheetViaGVizJSONP(spreadsheetId, '', 3500);
        if (defaultMatrix && defaultMatrix.length > 1) {
          const ws = XLSX.utils.aoa_to_sheet(defaultMatrix);
          const fallbackName = preferredSheetName || 'MASTER TOKO';
          XLSX.utils.book_append_sheet(wb, ws, fallbackName);
          primarySheetLoaded = true;
          loadedSheetName = fallbackName;
        }
      } catch {
        // Step 3: Fast check for 'ALL TOKO'
        try {
          const allTokoMatrix = await fetchSheetViaGVizJSONP(spreadsheetId, 'ALL TOKO', 3000);
          if (allTokoMatrix && allTokoMatrix.length > 1) {
            const ws = XLSX.utils.aoa_to_sheet(allTokoMatrix);
            XLSX.utils.book_append_sheet(wb, ws, 'ALL TOKO');
            primarySheetLoaded = true;
            loadedSheetName = 'ALL TOKO';
          }
        } catch {}
      }
    }

    if (primarySheetLoaded) {
      // Step 4: Concurrently fetch auxiliary sheets for Korlap mapping (e.g. 'ALL TOKO (2)', 'JADWAL')
      // Non-blocking parallel with strict 2.5s timeout
      const auxCandidateSheets = ['ALL TOKO (2)', 'JADWAL'].filter(
        s => s.toUpperCase() !== loadedSheetName.toUpperCase()
      );

      const auxPromises = auxCandidateSheets.map(sName => 
        fetchSheetViaGVizJSONP(spreadsheetId, sName, 2500)
          .then(matrix => ({ sheetName: sName, matrix }))
          .catch(() => null)
      );

      const auxResults = await Promise.allSettled(auxPromises);
      auxResults.forEach(res => {
        if (res.status === 'fulfilled' && res.value && res.value.matrix && res.value.matrix.length > 1) {
          const ws = XLSX.utils.aoa_to_sheet(res.value.matrix);
          XLSX.utils.book_append_sheet(wb, ws, res.value.sheetName);
        }
      });

      return { workbook: wb, sourceMethod: 'Google Sheets Direct (Fast GViz)' };
    }
  } catch (gvizError) {
    console.warn('Direct GViz fetch notice, checking fallback proxy:', gvizError);
  }

  // METHOD 2: Server Proxy Fallback (/api/fetch-spreadsheet) with strict 5-second abort
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const proxyUrl = `/api/fetch-spreadsheet?id=${encodeURIComponent(spreadsheetId)}`;
    const res = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > 1000) {
        const wb = XLSX.read(buffer, { type: 'array' });
        if (wb && wb.SheetNames && wb.SheetNames.length > 0) {
          return { workbook: wb, sourceMethod: 'Server Proxy (.xlsx)' };
        }
      }
    }
  } catch (proxyErr) {
    console.warn('Server proxy fallback notice:', proxyErr);
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

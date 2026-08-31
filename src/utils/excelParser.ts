import * as XLSX from 'xlsx';
import { Store } from '../types/stockOpname';
import { parseCoordinates, autoSyncStoreRegionAndKabupaten } from './geoUtils';
import { formatSmartSODate } from './formatters';
import { normalizeKorlapName } from './korlapUtils';

export interface SheetParseResult {
  sheetName: string;
  stores: Store[];
  indicators: string[];
  rawHeaders: string[];
}

export interface WorkbookParseResult {
  allSheets: SheetParseResult[];
  activeSheet: SheetParseResult | null;
}

/**
 * Smart Excel Parser for Stock Opname Master Toko Files
 * - Handles multi-sheet workbooks
 * - Handles title rows at the top (e.g. Rows 1-6)
 * - Handles multi-level headers (e.g. Rows 7-9)
 * - Handles formula/input/type labels (e.g. Row 10)
 * - Auto-detects store code (KDTK/Kode Toko) and store name (Nama Toko/Nama)
 * - Auto-detects indicators (% NKL, Rp Penggantian NKL, Type SO, Toko Fresh, Korlap, Saldo, JOP, Tanggal Buka)
 */
export function parseSmartWorkbook(wb: XLSX.WorkBook): WorkbookParseResult {
  const sheetResults: SheetParseResult[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rawMatrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    if (!rawMatrix || rawMatrix.length === 0) continue;

    // 1. Search for header row index (scanning rows 0..30)
    let bestHeaderIdx = -1;
    let maxKeywordMatches = 0;
    const storeKeywords = ['kdtk', 'kd toko', 'kd_toko', 'kode toko', 'nama toko', 'namatoko', 'no', 'tanggal buka', 'tgl buka'];

    for (let i = 0; i < Math.min(rawMatrix.length, 30); i++) {
      const row = rawMatrix[i];
      if (!Array.isArray(row)) continue;
      
      const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
      let matches = 0;
      storeKeywords.forEach(k => {
        if (rowStr.includes(k)) matches++;
      });

      if (matches > maxKeywordMatches) {
        maxKeywordMatches = matches;
        bestHeaderIdx = i;
      }
    }

    // Fallback if keywords not explicitly found: look for a row with 3+ non-empty text cells
    if (bestHeaderIdx === -1) {
      for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
        const row = rawMatrix[i];
        if (Array.isArray(row) && row.filter(c => String(c).trim().length > 0).length >= 3) {
          bestHeaderIdx = i;
          break;
        }
      }
    }

    if (bestHeaderIdx === -1) bestHeaderIdx = 0;

    // 2. Build composite headers merging header rows around bestHeaderIdx
    const parentRow = bestHeaderIdx > 0 ? rawMatrix[bestHeaderIdx - 1] : [];
    const headerRow = rawMatrix[bestHeaderIdx] || [];
    const subRow1 = bestHeaderIdx + 1 < rawMatrix.length ? rawMatrix[bestHeaderIdx + 1] : [];

    const colKeys: string[] = [];
    let lastParent = '';

    const maxCols = Math.max(
      headerRow.length,
      Array.isArray(parentRow) ? parentRow.length : 0,
      Array.isArray(subRow1) ? subRow1.length : 0
    );

    for (let c = 0; c < maxCols; c++) {
      const pVal = parentRow[c] ? String(parentRow[c]).trim() : '';
      if (pVal && pVal !== lastParent) lastParent = pVal;

      const hVal = headerRow[c] ? String(headerRow[c]).trim() : '';
      const sVal = subRow1[c] ? String(subRow1[c]).trim() : '';

      // Skip subRow text if it's filter keywords like "input", "rumus"
      const isSubRowFormulaLabel = ['input', 'rumus'].includes(sVal.toLowerCase());

      let merged = hVal || pVal || `COL_${c}`;
      if (pVal && hVal && pVal.toLowerCase() !== hVal.toLowerCase()) {
        merged = `${pVal} ${hVal}`;
      }
      if (sVal && !isSubRowFormulaLabel && sVal !== hVal) {
        merged = `${merged} ${sVal}`;
      }

      colKeys.push(merged);
    }

    // 3. Find data start row index: skip rows containing input/rumus/subtotal/headers
    let dataStartIdx = bestHeaderIdx + 1;
    while (dataStartIdx < Math.min(rawMatrix.length, bestHeaderIdx + 6)) {
      const row = rawMatrix[dataStartIdx];
      if (Array.isArray(row)) {
        const rowText = row.map(cell => String(cell || '').toLowerCase()).join(' ');
        if (
          rowText.includes('input') || 
          rowText.includes('rumus') || 
          rowText.includes('kriteria') ||
          rowText.trim() === ''
        ) {
          dataStartIdx++;
          continue;
        }
      }
      break;
    }

    // Identify indicator tags
    const detectedInds = new Set<string>();
    colKeys.forEach(col => {
      const lower = col.toLowerCase();
      if (lower.includes('nkl')) detectedInds.add('% NKL & Rp Penggantian');
      if (lower.includes('type so') || lower.includes('status so')) detectedInds.add('Status / Type SO');
      if (lower.includes('fresh')) detectedInds.add('Toko Fresh');
      if (lower.includes('tanggal buka') || lower.includes('tgl buka')) detectedInds.add('Tanggal Buka Toko');
      if (lower.includes('perubahan') || lower.includes('turun kelas')) detectedInds.add('Perubahan Grade / Turun Kelas');
      if (lower.includes('saldo')) detectedInds.add('Saldo Toko');
      if (lower.includes('korlap')) detectedInds.add('Petugas Korlap');
    });

    if (detectedInds.size === 0) detectedInds.add('Master Data Toko General');

    // 4. Extract Store Rows
    const storesList: Store[] = [];

    // Find column index for store code & name if possible
    let codeColIdx = -1;
    let nameColIdx = -1;

    colKeys.forEach((key, colIdx) => {
      const lk = key.toLowerCase();
      if (codeColIdx === -1 && (lk.includes('kdtk') || lk.includes('kd toko') || lk.includes('kode toko'))) {
        codeColIdx = colIdx;
      }
      if (nameColIdx === -1 && (lk.includes('nama toko') || lk.includes('namatoko') || lk.includes('nama'))) {
        nameColIdx = colIdx;
      }
    });

    // Fallback if column headers didn't catch KDTK explicitly: check columns 1 and 2
    if (codeColIdx === -1) codeColIdx = 1; // Col B
    if (nameColIdx === -1) nameColIdx = 2; // Col C

    for (let r = dataStartIdx; r < rawMatrix.length; r++) {
      const row = rawMatrix[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      let rawCode = row[codeColIdx] !== undefined ? String(row[codeColIdx]).trim() : '';
      let rawName = row[nameColIdx] !== undefined ? String(row[nameColIdx]).trim() : '';

      // Check if rawCode / rawName is in another adjacent cell if empty
      if (!rawCode && !rawName) {
        for (let c = 0; c < Math.min(row.length, 6); c++) {
          const val = String(row[c] || '').trim();
          if (val && val.length >= 3 && val.length <= 6 && /^[A-Z0-9]+$/i.test(val) && val !== 'Input' && val !== 'Rumus') {
            rawCode = val;
            if (row[c + 1]) rawName = String(row[c + 1]).trim();
            break;
          }
        }
      }

      // Skip non-store rows (e.g. totals, empty lines, instructions)
      if (!rawCode && !rawName) continue;
      if (rawCode.toLowerCase().includes('total') || rawName.toLowerCase().includes('total')) continue;
      if (rawCode.toLowerCase() === 'kdtk' || rawName.toLowerCase() === 'nama toko') continue;
      if (rawCode.toLowerCase() === 'input' || rawCode.toLowerCase() === 'rumus') continue;

      const storeCode = rawCode || `TK-${Math.floor(1000 + Math.random() * 9000)}`;
      const storeName = rawName || `TOKO ${storeCode}`;

      // Build row map for remaining values
      const rowObj: Record<string, any> = {};
      colKeys.forEach((key, c) => {
        rowObj[key] = row[c];
      });

      const findVal = (possibleKeys: string[]) => {
        const rowKeys = Object.keys(rowObj);

        // 1. Exact match first (returns row value directly if column exists)
        for (const key of possibleKeys) {
          const matchedKey = rowKeys.find(k => k.trim().toLowerCase() === key.toLowerCase());
          if (matchedKey) {
            const v = rowObj[matchedKey];
            return (v !== undefined && v !== null) ? String(v).trim() : '';
          }
        }

        // 2. Word boundary regex match (avoids matching substring inside 'nama toko' or 'alamat')
        for (const key of possibleKeys) {
          const regex = new RegExp(`(?:^|[^a-zA-Z0-9])${key.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')}(?:$|[^a-zA-Z0-9])`, 'i');
          const matchedKey = rowKeys.find(k => regex.test(k.trim()));
          if (matchedKey) {
            const v = rowObj[matchedKey];
            return (v !== undefined && v !== null) ? String(v).trim() : '';
          }
        }

        return '';
      };

      const kabVal = findVal(['kabupaten', 'kota', 'kab', 'city']);
      const kecVal = findVal(['kecamatan', 'district']);
      const addressVal = findVal(['alamat', 'address', 'lokasi']);
      const amVal = findVal(['am', 'area manager']);
      const asVal = findVal(['as', 'assistant manager']);
      const region = findVal(['wilayah', 'cabang', 'region', 'area']) || 'BALI';
      const coverageVal = findVal(['coverage', 'dc/igr', 'dc / igr', 'distribusi']);
      const typeSoVal = findVal(['type so', 'status so', 'type_so', 'q/m', 'qm']);
      const korlapRaw = findVal(['korlap/officer', 'korlap / officer', 'korlap/officer so', 'korlap / officer so', 'korlap', 'officer', 'penanggung jawab', 'koordinator lapangan']);
      const korlap = normalizeKorlapName(korlapRaw) || korlapRaw;
      const jop = findVal(['jop']);
      const saldoRaw = findVal(['saldo toko agustus', 'saldo toko', 'saldo_toko', 'saldo']);
      let saldoTokoNum: number | string = saldoRaw;
      if (saldoRaw) {
        const cleaned = saldoRaw.replace(/[^0-9.-]/g, '');
        saldoTokoNum = !isNaN(Number(cleaned)) && cleaned !== '' ? Number(cleaned) : saldoRaw;
      }

      // Parse coordinates if provided
      const rawCoord = findVal(['koordinat', 'koordinat toko', 'koordinat_toko', 'lat long', 'lat/long', 'lat,long', 'gps', 'location', 'lokasi', 'coordinate', 'coordinates', 'coord', 'titik', 'posisi', 'map', 'geo']);
      const latStr = findVal(['latitude', 'lat', 'y']);
      const lngStr = findVal(['longitude', 'long', 'lng', 'lon', 'x']);

      let parsedLat: number | undefined = undefined;
      let parsedLng: number | undefined = undefined;

      if (rawCoord) {
        const parsed = parseCoordinates(rawCoord);
        if (parsed.isValid) {
          parsedLat = parsed.latitude;
          parsedLng = parsed.longitude;
        }
      }

      if ((parsedLat === undefined || parsedLng === undefined) && latStr && lngStr) {
        const parsed = parseCoordinates(`${latStr}, ${lngStr}`);
        if (parsed.isValid) {
          parsedLat = parsed.latitude;
          parsedLng = parsed.longitude;
        }
      }

      // Smart fallback: If coordinates still missing, scan all cells in this row for lat/lng pattern
      if (parsedLat === undefined || parsedLng === undefined) {
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || '').trim();
          if (!val || val.length < 5) continue;
          if (val.includes('-8.') || val.includes('-9.') || val.includes('115.') || val.includes('114.') || val.includes('116.')) {
            const parsed = parseCoordinates(val);
            if (parsed.isValid && parsed.latitude !== undefined && parsed.longitude !== undefined) {
              parsedLat = parsed.latitude;
              parsedLng = parsed.longitude;
              break;
            }
          }
        }
      }

      const skuVal = findVal(['totalsku', 'total sku', 'sku']);
      const totalSKUCount = skuVal && !isNaN(Number(skuVal.replace(/[^0-9]/g, ''))) ? Number(skuVal.replace(/[^0-9]/g, '')) : undefined;

      // Parse ZONA (ZONA HITAM vs NON ZONA HITAM)
      const zonaRaw = findVal(['zona', 'kriteria zona', 'zona toko', 'kriteria_zona', 'status zona']);
      let zonaFormatted = 'NON ZONA HITAM';
      let isZonaHitam = false;
      let riskLevel: 'Tinggi' | 'Sedang' | 'Rendah' = 'Rendah';

      if (zonaRaw) {
        const zUpper = zonaRaw.toUpperCase();
        if (zUpper.includes('HITAM') || zUpper === 'ZONA HITAM' || zUpper === 'BLACK ZONE') {
          zonaFormatted = 'ZONA HITAM';
          isZonaHitam = true;
          riskLevel = 'Tinggi';
        } else if (zUpper.includes('TINGGI') || zUpper.includes('HIGH')) {
          zonaFormatted = 'ZONA HITAM';
          isZonaHitam = true;
          riskLevel = 'Tinggi';
        } else if (zUpper.includes('SEDANG') || zUpper.includes('MEDIUM')) {
          zonaFormatted = 'NON ZONA HITAM';
          riskLevel = 'Sedang';
        } else {
          zonaFormatted = 'NON ZONA HITAM';
          riskLevel = 'Rendah';
        }
      }

      const accVal = findVal(['akurasi', 'accuracy', 'last accuracy', 'akurasi so']);
      const lastAccuracyRate = accVal && !isNaN(parseFloat(accVal.replace(/[^0-9.]/g, ''))) ? parseFloat(accVal.replace(/[^0-9.]/g, '')) : undefined;

      const jenisTokoVal = findVal(['jenis toko', 'jenis_toko', 'tipetoko', 'tipe toko', 'storetype']);
      const ketVal = findVal(['keterangan', 'notes', 'nkl', 'ket']) || 'TOKO EKSIS';
      const soAktivaVal = findVal(['so aktiva', 'so_aktiva', 'aktiva']);
      const phoneVal = findVal(['notelp', 'no telp', 'phone', 'telepon']);

      const tglSoMei = formatSmartSODate(findVal(["so mei '26", 'so mei', 'tgl so mei', 'mei']));
      const tglSoJuni = formatSmartSODate(findVal(["so juni '26", 'so juni', 'tgl so juni', 'juni']));
      const tglSoJuli = formatSmartSODate(findVal(["so juli '26", 'so juli', 'tgl so juli', 'juli']));
      const soAgustus = formatSmartSODate(findVal(["so agustus '26", 'so agustus', 'tgl so agustus', 'agustus', 'so bulan ini', 'jadwal so']));
      const soSeptember = formatSmartSODate(findVal(["so september '26", 'so september', 'tgl so september', 'september']));
      const tglSoApproved = formatSmartSODate(findVal(['tgl so approved', 'so approved', 'approved spv', 'so disetujui', 'tgl so']));

      // Parse FREKUENSI TIDAK SO
      const freqRaw = findVal(['frekuensi tidak so', 'frekuensi_tidak_so', 'freq tidak so', 'tidak so']);
      let frekuensiTidakSO = 0;
      if (freqRaw && !isNaN(Number(freqRaw))) {
        frekuensiTidakSO = Number(freqRaw);
      } else {
        // Calculate based on monthly columns
        const monthsChecked = [
          tglSoMei && tglSoMei !== '-',
          tglSoJuni && tglSoJuni !== '-',
          tglSoJuli && tglSoJuli !== '-',
          soAgustus && soAgustus !== '-',
          soSeptember && soSeptember !== '-'
        ];
        if (soSeptember && soSeptember !== '-') {
          frekuensiTidakSO = 0;
        } else {
          for (let m = 4; m >= 0; m--) {
            if (!monthsChecked[m]) frekuensiTidakSO++;
            else break;
          }
        }
      }

      const storeObj: Store = {
        id: `STORE-DATASET-${storeCode}-${r}`,
        code: storeCode,
        name: storeName,
        region: region as any,
        address: addressVal || `Jl. Raya ${storeName}`,
        city: kabVal,
        kabupaten: kabVal,
        district: kecVal,
        kecamatan: kecVal,
        latitude: parsedLat,
        longitude: parsedLng,
        koordinat: rawCoord || (parsedLat && parsedLng ? `${parsedLat}, ${parsedLng}` : undefined),
        am: amVal,
        as: asVal,
        saldoToko: saldoTokoNum,
        coverage: coverageVal || 'DC',
        typeSo: typeSoVal || 'M',
        qm: typeSoVal || 'M',
        smartClassification: findVal(['perubahan', 'kategori', 'klasifikasi', 'turun kelas']) || '',
        korlap: korlap,
        keterangan: ketVal,
        zona: zonaFormatted,
        isZonaHitam: isZonaHitam,
        soAktiva: soAktivaVal,
        frekuensiTidakSO: frekuensiTidakSO,
        jenisToko: jenisTokoVal || 'REGULER',
        jop: jop,
        tglSoMei: tglSoMei !== '-' ? tglSoMei : undefined,
        tglSoJuni: tglSoJuni !== '-' ? tglSoJuni : undefined,
        tglSoJuli: tglSoJuli !== '-' ? tglSoJuli : undefined,
        soAgustus: soAgustus !== '-' ? soAgustus : undefined,
        soSeptember: soSeptember !== '-' ? soSeptember : undefined,
        tglSoApproved: tglSoApproved !== '-' ? tglSoApproved : undefined,
        storeType: 'Regular Minimarket',
        managerName: korlap || 'Kepala Toko',
        phone: phoneVal || '08123456789',
        totalSKUCount,
        riskLevel,
        lastAccuracyRate
      };

      storesList.push(autoSyncStoreRegionAndKabupaten(storeObj));
    }

    sheetResults.push({
      sheetName,
      stores: storesList,
      indicators: Array.from(detectedInds),
      rawHeaders: colKeys
    });
  }

  // Prioritize "MASTER TOKO BALI" sheet if present!
  let masterBaliSheet = sheetResults.find(s => 
    s.sheetName.toUpperCase().includes('MASTER TOKO BALI') || 
    s.sheetName.toUpperCase().includes('MASTER TOKO') ||
    s.sheetName.toUpperCase().includes('MASTER')
  );

  // Fallback: Pick best sheet with the most parsed stores
  let bestSheet = masterBaliSheet && masterBaliSheet.stores.length > 0
    ? masterBaliSheet
    : sheetResults.reduce<SheetParseResult | null>((best, current) => {
        if (!best) return current;
        return current.stores.length > best.stores.length ? current : best;
      }, null);

  return {
    allSheets: sheetResults,
    activeSheet: bestSheet
  };
}

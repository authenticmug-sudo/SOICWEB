import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle2, Download, AlertCircle, FileText, Cloud, ExternalLink } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Store, StoreType, RiskLevel } from '../../types/stockOpname';
import { REGIONS } from '../../data/initialData';
import { 
  backupExcelFileToCloudinaryAndFirestore, 
  getFormattedDateSuffix,
  getDeterministicStoreId,
  deduplicateEntityList
} from '../../services/storageService';
import { parseCoordinates, autoSyncStoreRegionAndKabupaten } from '../../utils/geoUtils';
import { formatSmartSODate } from '../../utils/formatters';
import { isStoreZonaHitam } from '../../utils/storeSyncUtils';

interface ImportStoresModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportBulkStores: (newStores: Store[], mode?: 'replace' | 'merge') => void;
}

export const ImportStoresModal: React.FC<ImportStoresModalProps> = ({
  isOpen,
  onClose,
  onImportBulkStores
}) => {
  const [activeTab, setActiveTab] = useState<'excel' | 'paste'>('excel');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [parsedStores, setParsedStores] = useState<Store[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [workbookInstance, setWorkbookInstance] = useState<XLSX.WorkBook | null>(null);
  const [availableSheetNames, setAvailableSheetNames] = useState<string[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState<string>('');
  const [csvText, setCsvText] = useState('');
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cloudinaryUrl, setCloudinaryUrl] = useState<string | null>(null);
  const [isUploadingCloudinary, setIsUploadingCloudinary] = useState(false);

  if (!isOpen) return null;

  const handleDownloadExcelTemplate = () => {
    const templateData = [
      {
        'KD TOKO': 'TDVX',
        'NAMA': 'KEDONGANAN - BADUNG',
        'KOORDINAT': 'S8 45 27.3 E115 10 36.1',
        'AM': 'Budi Santoso',
        'AS': 'Agus Raharjo',
        'SALDO TOKO': '546,017,415',
        'KECAMATAN': 'Kedonganan',
        'KABUPATEN': 'BADUNG',
        'Q/M': 'M',
        'TGL SO MEI': '0-Jan-00',
        'TGL SO JUNI': '4-Jul-26',
        'TGL SO JULI': '1-Aug-26',
        'SO AGUSTUS': '1-Aug-26',
        'KORLAP/OFFICER': 'angga',
        'KETERANGAN': 'wajib',
        'JENIS TOKO': 'STANDART NEW',
        'JOP': 0
      },
      {
        'KD TOKO': 'TN5R',
        'NAMA': 'RAYA TUBAN - BADUNG',
        'KOORDINAT': 'S8 44 22.4 E115 10 43.1',
        'AM': 'Budi Santoso',
        'AS': 'Agus Raharjo',
        'SALDO TOKO': '357,697,562',
        'KECAMATAN': 'Tuban',
        'KABUPATEN': 'BADUNG',
        'Q/M': 'M',
        'TGL SO MEI': '9-May-26',
        'TGL SO JUNI': '23-Jul-26',
        'TGL SO JULI': '1-Aug-26',
        'SO AGUSTUS': '1-Aug-26',
        'KORLAP/OFFICER': 'angga',
        'KETERANGAN': 'wajib',
        'JENIS TOKO': 'STANDART NEW',
        'JOP': 0
      },
      {
        'KD TOKO': 'TQWG',
        'NAMA': 'PC.PC.RAYA TUKAD BADUNG_DPS',
        'KOORDINAT': '8°41\'18.55"S 115°14\'17.47"E',
        'AM': 'Budi Santoso',
        'AS': 'Agus Raharjo',
        'SALDO TOKO': '526,281,234',
        'KECAMATAN': 'Renon',
        'KABUPATEN': 'DENPASAR',
        'Q/M': 'M',
        'TGL SO MEI': '25-May-26',
        'TGL SO JUNI': '0-Jan-00',
        'TGL SO JULI': '1-Aug-26',
        'SO AGUSTUS': '1-Aug-26',
        'KORLAP/OFFICER': 'pasek',
        'KETERANGAN': 'wajib',
        'JENIS TOKO': 'STANDART NEW',
        'JOP': 0
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Master_Toko_Template');
    XLSX.writeFile(workbook, `Template_Master_Toko_${getFormattedDateSuffix()}.xlsx`);
  };

  const processRowsToStores = (rows: Record<string, any>[]): Store[] => {
    return rows.map((row, idx) => {
      // Intelligently find column keys with exact matching first, then word-boundary matching
      const getVal = (possibleKeys: string[], defaultVal: string = '') => {
        const rowKeys = Object.keys(row);
        
        // 1. Exact header match in file (returns row value directly even if empty)
        for (const key of possibleKeys) {
          const matchedKey = rowKeys.find(k => k.trim().toLowerCase() === key.toLowerCase());
          if (matchedKey) {
            const val = row[matchedKey];
            return (val !== undefined && val !== null) ? String(val).trim() : defaultVal;
          }
        }

        // 2. Word boundary match (e.g. "area manager" or whole word "am", but NEVER matching inside "nama toko" or "alamat")
        for (const key of possibleKeys) {
          const regex = new RegExp(`(?:^|[^a-zA-Z0-9])${key.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')}(?:$|[^a-zA-Z0-9])`, 'i');
          const matchedKey = rowKeys.find(k => regex.test(k.trim()));
          if (matchedKey) {
            const val = row[matchedKey];
            return (val !== undefined && val !== null) ? String(val).trim() : defaultVal;
          }
        }

        return defaultVal;
      };

      const code = getVal(['kd toko', 'kd_toko', 'kodetoko', 'kode toko', 'code', 'storecode', 'kode'], `T-${Math.floor(1000 + Math.random() * 9000)}`);
      const name = getVal(['nama', 'namatoko', 'nama toko', 'name', 'storename'], `Toko Ritel ${idx + 1}`);
      const kabupaten = getVal(['kabupaten', 'kota/kabupaten', 'kab/kota', 'nama kabupaten', 'kab', 'kota', 'city'], '');
      const kecamatan = getVal(['kecamatan', 'nama kecamatan', 'district', 'kec'], '');
      const address = getVal(['alamat', 'address', 'lokasi'], '');
      
      let regionInput = getVal(['wilayah', 'region', 'area', 'wilayah/area'], '');
      let matchedRegion: any = REGIONS.find(r => r.toLowerCase().includes(regionInput.toLowerCase()));
      if (!matchedRegion) {
        if (kabupaten.toUpperCase().includes('BADUNG') || kabupaten.toUpperCase().includes('DENPASAR') || kabupaten.toUpperCase().includes('TABANAN') || kabupaten.toUpperCase().includes('GIANYAR') || address.toUpperCase().includes('BALI')) {
          matchedRegion = 'Bali & Nusa Tenggara';
        } else {
          matchedRegion = REGIONS[0];
        }
      }

      const jenisTokoRaw = getVal(['jenis toko', 'jenis_toko', 'tipetoko', 'tipe toko', 'storetype'], '');
      let storeType: StoreType = 'Regular Minimarket';
      if (jenisTokoRaw.toLowerCase().includes('super') || jenisTokoRaw.toLowerCase().includes('flagship')) {
        storeType = 'Flagship Supermarket';
      } else if (jenisTokoRaw.toLowerCase().includes('express') || jenisTokoRaw.toLowerCase().includes('outlet')) {
        storeType = 'Express Outlet';
      } else if (jenisTokoRaw.toLowerCase().includes('hub') || jenisTokoRaw.toLowerCase().includes('distribution')) {
        storeType = 'Distribution Hub Center';
      }

      const korlap = getVal(['korlap/officer', 'korlap', 'officer', 'kepalatoko', 'kepala toko', 'manager'], '');
      const managerName = korlap;
      const phone = getVal(['notelp', 'no telp', 'phone', 'telepon'], '');
      
      const riskVal = getVal(['kriteria zona', 'kriteria_zona', 'zona', 'zona toko', 'kriteria', 'risklevel', 'risk level', 'tingkatrisiko', 'risiko'], '');
      let riskLevel: RiskLevel | undefined = undefined;
      if (riskVal) {
        const rLower = riskVal.toLowerCase();
        if (rLower.includes('tinggi') || rLower.includes('high') || rLower.includes('merah')) riskLevel = 'Tinggi';
        else if (rLower.includes('sedang') || rLower.includes('medium') || rLower.includes('kuning')) riskLevel = 'Sedang';
        else if (rLower.includes('rendah') || rLower.includes('low') || rLower.includes('hijau')) riskLevel = 'Rendah';
        else riskLevel = riskVal as RiskLevel;
      }
      
      const skuVal = getVal(['totalsku', 'total sku', 'sku'], '');
      const totalSKUCount = skuVal && !isNaN(Number(skuVal.replace(/[^0-9]/g, ''))) ? Number(skuVal.replace(/[^0-9]/g, '')) : undefined;

      const accVal = getVal(['akurasi', 'accuracy', 'last accuracy', 'akurasi so'], '');
      const lastAccuracyRate = accVal && !isNaN(parseFloat(accVal.replace(/[^0-9.]/g, ''))) ? parseFloat(accVal.replace(/[^0-9.]/g, '')) : undefined;

      // Extract Spreadsheet specific columns
      let koordinatRaw = getVal(['koordinat', 'koordinat toko', 'koordinat_toko', 'lat long', 'lat/long', 'lat,long', 'gps', 'location', 'lokasi', 'coordinate', 'coordinates', 'coord', 'titik', 'posisi', 'map', 'geo']);
      const am = getVal(['am', 'area manager'], '');
      const asVal = getVal(['as', 'assistant manager'], '');
      
      const saldoRaw = getVal(['saldo toko', 'saldo_toko', 'saldo'], '');
      let saldoTokoNum: number | string = '';
      if (saldoRaw) {
        const cleanedSaldo = saldoRaw.replace(/[^0-9.-]/g, '');
        saldoTokoNum = parseFloat(cleanedSaldo) || saldoRaw;
      }

      const qm = getVal(['q/m', 'q_m', 'qm', 'type so', 'status so', 'type_so', 'type', 'tipe'], 'M');
      const typeSo = qm;
      const tglSoMei = formatSmartSODate(getVal(['tgl so mei', 'so mei', 'mei'], ''));
      const tglSoJuni = formatSmartSODate(getVal(['tgl so juni', 'so juni', 'juni'], ''));
      const tglSoJuli = formatSmartSODate(getVal(['tgl so juli', 'so juli', 'juli'], ''));
      const soAgustus = formatSmartSODate(getVal(['so agustus', 'tgl so agustus', 'agustus', 'so bulan ini', 'jadwal so'], ''));
      let soSeptember = formatSmartSODate(getVal(["so september '26", 'so september', 'tgl so september', 'september', 'so sep', 'tgl so sep', 'so sep 26', 'so september 2026'], ''));
      const genericScheduleDate = formatSmartSODate(getVal(['tgl so', 'tanggal so', 'jadwal so', 'tgl jadwal so', 'tgl pelaksanaan so', 'jadwal'], ''));
      if ((!soSeptember || soSeptember === '-') && genericScheduleDate && genericScheduleDate !== '-') {
        soSeptember = genericScheduleDate;
      }
      
      const tglSoApprovedRaw = getVal(['tgl so approved', 'tgl approved so', 'tgl approve so', 'tanggal so approved', 'tanggal approve so', 'tgl approval spv', 'tgl approved spv', 'tgl so disetujui'], '');
      const tglSoApproved = formatSmartSODate(tglSoApprovedRaw);

      const rawStatusApprove = getVal([
        'status approve so',
        'status approval so',
        'status approval spv',
        'status approve spv',
        'approval spv',
        'approval so',
        'status approve',
        'approve so',
        'sudah approve so',
        'sudah approve',
        'status so terapprove',
        'status so approved',
        'indikator ter-so',
        'status ter-so'
      ], '');

      let statusApproveSO: 'Sudah Approve' | 'Belum SO' | 'Belum Terapprove' = 'Belum SO';
      if (rawStatusApprove) {
        const sUpper = rawStatusApprove.toUpperCase().trim();
        if (
          sUpper.includes('SUDAH APPROVE') || 
          sUpper.includes('SUDAH DISETUJUI') || 
          sUpper.includes('APPROVED SPV') || 
          sUpper.includes('DISETUJUI') || 
          sUpper === 'APPROVED' || 
          sUpper === 'TER-SO' || 
          sUpper === 'TER SO'
        ) {
          statusApproveSO = 'Sudah Approve';
        } else if (
          sUpper.includes('BELUM TERAPPROVE') || 
          sUpper.includes('MENUNGGU') || 
          sUpper.includes('PENDING') || 
          sUpper.includes('AUDIT ULANG') ||
          sUpper.includes('BELUM APPROVE') ||
          sUpper.includes('SELESAI')
        ) {
          statusApproveSO = 'Belum Terapprove';
        } else {
          statusApproveSO = 'Belum SO';
        }
      } else if (tglSoApproved && tglSoApproved !== '-' && tglSoApproved.length > 3) {
        statusApproveSO = 'Sudah Approve';
      }

      const keterangan = getVal(['keterangan', 'ket'], '');
      const jop = getVal(['jop'], '');

      // Parse ZONA / KETERANGAN ZONA HITAM
      const zonaRaw = getVal([
        'zona - keterangan zona hitam',
        'zona-keterangan zona hitam',
        'keterangan zona hitam',
        'keterangan zona',
        'zona / keterangan',
        'zona hitam',
        'kriteria zona',
        'zona toko',
        'kriteria_zona',
        'status zona',
        'kategori zona',
        'zona'
      ], '');
      let isZonaHitam = isStoreZonaHitam({ zona: zonaRaw, keterangan, riskLevel: riskVal });
      let zonaFormatted = isZonaHitam ? 'ZONA HITAM' : 'NON ZONA HITAM';
      if (isZonaHitam && !riskLevel) {
        riskLevel = 'Tinggi';
      }

      // Extract Coordinates Lat/Long with universal parser
      let latitude: number | undefined = undefined;
      let longitude: number | undefined = undefined;

      if (koordinatRaw) {
        const parsed = parseCoordinates(koordinatRaw);
        if (parsed.isValid && parsed.latitude !== undefined && parsed.longitude !== undefined) {
          latitude = parsed.latitude;
          longitude = parsed.longitude;
        }
      }

      if (latitude === undefined || longitude === undefined) {
        const latStr = getVal(['latitude', 'lat', 'y']);
        const lngStr = getVal(['longitude', 'long', 'lng', 'lon', 'x']);
        if (latStr && lngStr) {
          const parsed = parseCoordinates(`${latStr}, ${lngStr}`);
          if (parsed.isValid && parsed.latitude !== undefined && parsed.longitude !== undefined) {
            latitude = parsed.latitude;
            longitude = parsed.longitude;
          }
        }
      }

      // Smart fallback: scan all properties in row object if coordinates still missing
      if (latitude === undefined || longitude === undefined) {
        for (const key of Object.keys(row)) {
          const val = String(row[key] || '').trim();
          if (!val || val.length < 5) continue;
          if (val.includes('-8.') || val.includes('-9.') || val.includes('115.') || val.includes('114.') || val.includes('116.')) {
            const parsed = parseCoordinates(val);
            if (parsed.isValid && parsed.latitude !== undefined && parsed.longitude !== undefined) {
              latitude = parsed.latitude;
              longitude = parsed.longitude;
              if (!koordinatRaw) koordinatRaw = val;
              break;
            }
          }
        }
      }

      const deterministicId = getDeterministicStoreId({ code, name });

      const storeObj: Store = {
        id: deterministicId,
        code,
        name,
        region: matchedRegion,
        city: kabupaten,
        district: kecamatan,
        address: address || `Jl. Utama ${name}`,
        latitude,
        longitude,
        koordinat: koordinatRaw || undefined,
        am,
        as: asVal,
        saldoToko: saldoTokoNum,
        kecamatan,
        kabupaten,
        typeSo: typeSo || qm || 'M',
        qm: qm || typeSo || 'M',
        tglSoMei: tglSoMei !== '-' ? tglSoMei : undefined,
        tglSoJuni: tglSoJuni !== '-' ? tglSoJuni : undefined,
        tglSoJuli: tglSoJuli !== '-' ? tglSoJuli : undefined,
        soAgustus: soAgustus !== '-' ? soAgustus : undefined,
        soSeptember: soSeptember !== '-' ? soSeptember : undefined,
        tglSoApproved: tglSoApproved !== '-' ? tglSoApproved : undefined,
        statusApproveSO: statusApproveSO,
        zona: zonaFormatted,
        isZonaHitam: isZonaHitam,
        korlap,
        keterangan,
        jenisToko: jenisTokoRaw,
        jop,
        storeType,
        managerName,
        phone,
        riskLevel,
        totalSKUCount,
        lastAccuracyRate
      };

      return autoSyncStoreRegionAndKabupaten(storeObj);
    });
  };

  /**
   * Helper utility to intelligently parse complex Excel sheets with multi-level headers,
   * title rows at the top (rows 1-6), or merged columns.
   */
  const parseComplexSheet = (ws: XLSX.WorkSheet): Record<string, any>[] => {
    const rawMatrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    if (!rawMatrix || rawMatrix.length === 0) return [];

    // Find row index containing core store column keywords
    let headerRowIdx = -1;
    const keywords = ['kdtk', 'kd toko', 'kd_toko', 'kode toko', 'nama toko', 'namatoko', 'no', 'tanggal buka', 'kategori'];

    for (let i = 0; i < Math.min(rawMatrix.length, 25); i++) {
      const row = rawMatrix[i];
      if (Array.isArray(row)) {
        const rowStr = row.map(cell => String(cell || '').toLowerCase()).join(' ');
        if (keywords.some(k => rowStr.includes(k))) {
          headerRowIdx = i;
          break;
        }
      }
    }

    // Fallback to standard XLSX json conversion if no header keyword row found
    if (headerRowIdx === -1) {
      return XLSX.utils.sheet_to_json<Record<string, any>>(ws);
    }

    const headerRow = rawMatrix[headerRowIdx] || [];
    const parentRow = headerRowIdx > 0 ? rawMatrix[headerRowIdx - 1] : [];
    const subRow = rawMatrix[headerRowIdx + 1] || [];

    const colKeys: string[] = [];
    let currentParent = '';

    for (let col = 0; col < headerRow.length; col++) {
      const parentVal = parentRow[col] ? String(parentRow[col]).trim() : '';
      if (parentVal && parentVal !== currentParent) {
        currentParent = parentVal;
      }

      const mainVal = headerRow[col] ? String(headerRow[col]).trim() : '';
      const subVal = subRow[col] ? String(subRow[col]).trim() : '';

      let colName = mainVal || parentVal || `COL_${col}`;

      if (parentVal && mainVal && parentVal.toLowerCase() !== mainVal.toLowerCase()) {
        colName = `${parentVal} ${mainVal}`;
      }

      if (subVal && subVal !== mainVal && !subVal.toLowerCase().includes('input') && !subVal.toLowerCase().includes('rumus')) {
        colName = `${colName} ${subVal}`;
      }

      colKeys.push(colName);
    }

    // Start parsing actual data rows after header and sub-header / filter rows
    const results: Record<string, any>[] = [];
    let dataStartIdx = headerRowIdx + 1;

    while (dataStartIdx < rawMatrix.length) {
      const checkRow = rawMatrix[dataStartIdx];
      if (Array.isArray(checkRow)) {
        const rowText = checkRow.map(c => String(c || '').toLowerCase()).join(' ');
        if (rowText.includes('input') || rowText.includes('rumus') || rowText.includes('type so') || rowText.includes('status so')) {
          dataStartIdx++;
          continue;
        }
      }
      break;
    }

    for (let r = dataStartIdx; r < rawMatrix.length; r++) {
      const row = rawMatrix[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const rowObj: Record<string, any> = {};
      let hasValue = false;

      for (let c = 0; c < colKeys.length; c++) {
        const key = colKeys[c];
        const val = row[c];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          rowObj[key] = val;
          hasValue = true;
        }
      }

      if (hasValue) {
        results.push(rowObj);
      }
    }

    return results.length > 0 ? results : XLSX.utils.sheet_to_json<Record<string, any>>(ws);
  };

  const parseSheetData = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];
    const data = parseComplexSheet(ws);
    if (!data || data.length === 0) return [];
    const stores = processRowsToStores(data);
    const { deduplicated } = deduplicateEntityList('stores', stores);
    return deduplicated;
  };

  const handleSelectSheet = (sheetName: string) => {
    if (!workbookInstance) return;
    setSelectedSheetName(sheetName);
    try {
      const stores = parseSheetData(workbookInstance, sheetName);
      if (stores.length === 0) {
        setErrorMessage(`Sheet "${sheetName}" tidak memuat data toko yang valid.`);
        setParsedStores([]);
      } else {
        setErrorMessage(null);
        setParsedStores(stores);
      }
    } catch (err) {
      setErrorMessage(`Gagal membaca sheet "${sheetName}".`);
      setParsedStores([]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMessage(null);
    setCloudinaryUrl(null);
    setIsUploadingCloudinary(true);

    backupExcelFileToCloudinaryAndFirestore(file, 'MASTER_TOKO')
      .then((cUrl) => {
        setCloudinaryUrl(cUrl);
        setIsUploadingCloudinary(false);
      })
      .catch(() => {
        setIsUploadingCloudinary(false);
      });

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        setWorkbookInstance(wb);
        
        const sheets = wb.SheetNames || [];
        setAvailableSheetNames(sheets);

        if (sheets.length === 0) {
          setErrorMessage('File Excel tidak memiliki lembar kerja (sheet).');
          setParsedStores([]);
          return;
        }

        // Smart Sheet Selection: Find the most relevant sheet name
        let targetSheet = sheets.find(s => /master|toko|bali|store|cabang|data toko/i.test(s.toLowerCase()));
        
        // If not found by keyword, test each sheet to pick the one with data
        if (!targetSheet) {
          let maxCount = 0;
          let bestSheet = sheets[0];
          for (const sName of sheets) {
            try {
              const testStores = parseSheetData(wb, sName);
              if (testStores.length > maxCount) {
                maxCount = testStores.length;
                bestSheet = sName;
              }
            } catch {
              // ignore
            }
          }
          targetSheet = bestSheet;
        }

        setSelectedSheetName(targetSheet);
        const stores = parseSheetData(wb, targetSheet);

        if (!stores || stores.length === 0) {
          setErrorMessage(`Sheet "${targetSheet}" kosong atau format kolom toko tidak terdeteksi.`);
          setParsedStores([]);
          return;
        }

        setParsedStores(stores);
      } catch (err) {
        setErrorMessage('Gagal membaca file Excel. Pastikan format file adalah .xlsx atau .xls valid.');
        setParsedStores([]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleProcessImport = () => {
    let storesToImport: Store[] = [];

    if (activeTab === 'excel') {
      storesToImport = parsedStores;
    } else {
      if (!csvText.trim()) return;
      try {
        const wb = XLSX.read(csvText, { type: 'string' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
        if (data && data.length > 0) {
          storesToImport = processRowsToStores(data);
        }
      } catch (err) {
        // Fallback simple line split if XLSX string read fails
        const lines = csvText.trim().split('\n');
        const startIndex = lines[0].toLowerCase().includes('kode') ? 1 : 0;
        
        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const parts = line.includes('\t') ? line.split('\t') : line.split(',');
          if (parts.length >= 2) {
            const code = parts[0]?.trim() || `T-${Math.floor(1000 + Math.random() * 9000)}`;
            const name = parts[1]?.trim() || `Toko Import ${i}`;
            const city = parts[2]?.trim() || 'TABANAN';
            const address = parts[3]?.trim() || `Jl. Utama ${city}`;
            const coordStr = parts[4]?.trim() || '';

            let lat: number | undefined = undefined;
            let lng: number | undefined = undefined;

            if (coordStr) {
              const cParts = coordStr.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
              if (cParts.length >= 2) {
                const pLat = parseFloat(cParts[0]);
                const pLng = parseFloat(cParts[1]);
                if (!isNaN(pLat) && !isNaN(pLng)) {
                  lat = pLat;
                  lng = pLng;
                }
              }
            }

            storesToImport.push(autoSyncStoreRegionAndKabupaten({
              id: getDeterministicStoreId({ code, name }),
              code,
              name,
              region: 'Bali & Nusa Tenggara',
              city,
              address,
              latitude: lat,
              longitude: lng,
              storeType: 'Regular Minimarket',
              managerName: 'Penanggung Jawab',
              phone: '08123456789',
              riskLevel: 'Rendah',
              totalSKUCount: 5000,
              lastAccuracyRate: 98.5
            }));
          }
        }
      }
    }

    if (storesToImport.length > 0) {
      const { deduplicated: cleanStores } = deduplicateEntityList('stores', storesToImport);
      onImportBulkStores(cleanStores, importMode);
      setImportedCount(cleanStores.length);
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-3.5 px-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-sm">Upload File Excel Master Toko</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="bg-slate-100 border-b border-slate-200 px-5 flex items-center justify-between text-xs font-medium text-slate-600">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('excel')}
              className={`py-2.5 px-3 flex items-center gap-1.5 border-b-2 font-semibold transition ${
                activeTab === 'excel'
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Upload Excel (.xlsx / .xls)
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`py-2.5 px-3 flex items-center gap-1.5 border-b-2 font-semibold transition ${
                activeTab === 'paste'
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4 text-slate-500" />
              Copas Text / CSV
            </button>
          </div>

          <button
            onClick={handleDownloadExcelTemplate}
            className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            Download Template Excel
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 text-xs max-h-[70vh] overflow-y-auto">
          
          {/* Mode Import Choice Box */}
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 text-xs">
            <span className="font-bold text-amber-950 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              Pilih Mode Import Toko (Mencegah Akumulasi Ganda)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                onClick={() => setImportMode('replace')}
                className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2 transition ${
                  importMode === 'replace'
                    ? 'bg-white border-indigo-600 shadow-xs ring-1 ring-indigo-500'
                    : 'bg-amber-50/50 border-amber-200 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="importModeStores"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="mt-0.5 text-indigo-600"
                />
                <div>
                  <p className="font-bold text-indigo-950 text-xs">Ganti Total / Replace (Rekomendasi)</p>
                  <p className="text-[10px] text-slate-600 leading-tight">
                    Mengganti seluruh toko lama dengan file master baru (Tidak ada akumulasi toko ganda)
                  </p>
                </div>
              </label>

              <label
                onClick={() => setImportMode('merge')}
                className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2 transition ${
                  importMode === 'merge'
                    ? 'bg-white border-indigo-600 shadow-xs ring-1 ring-indigo-500'
                    : 'bg-amber-50/50 border-amber-200 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="importModeStores"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                  className="mt-0.5 text-indigo-600"
                />
                <div>
                  <p className="font-bold text-slate-900 text-xs">Gabung / Update (Merge)</p>
                  <p className="text-[10px] text-slate-600 leading-tight">
                    Memperbarui toko berdasarkan Kode Toko & menambah toko baru tanpa menghapus data lama
                  </p>
                </div>
              </label>
            </div>
          </div>
          
          {activeTab === 'excel' ? (
            <div className="space-y-4">
              
              {/* Dropzone */}
              <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-slate-100/80 rounded-lg p-6 text-center transition cursor-pointer relative group">
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 bg-emerald-50 rounded-full text-emerald-600 group-hover:scale-110 transition">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-xs">
                      Klik atau drag file Excel master toko di sini (.xlsx, .xls, .csv)
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Sistem akan membaca otomatis kolom: KodeToko, NamaToko, Wilayah, Kota, TipeToko, KepalaToko, NoTelp, RiskLevel, TotalSKU
                    </p>
                  </div>
                  {fileName && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded font-semibold text-xs border border-emerald-200">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      {fileName}
                    </div>
                  )}
                </div>
              </div>

              {fileName && (
                <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <Cloud className={`w-5 h-5 shrink-0 ${isUploadingCloudinary ? 'text-indigo-500 animate-pulse' : 'text-indigo-600'}`} />
                    <div>
                      <span className="font-bold text-indigo-950 block">Cloudinary Backup & Storage (Folder: Super SO/excel_backups)</span>
                      <p className="text-[11px] text-indigo-800">
                        {isUploadingCloudinary ? (
                          <span>Mengunggah file Excel Master Toko ke Cloudinary...</span>
                        ) : cloudinaryUrl ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            File Excel Master Toko ter-upload & ter-backup di Cloudinary!
                          </span>
                        ) : (
                          <span>File Excel siap di-backup ke Cloudinary & Firestore.</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {cloudinaryUrl && (
                    <a
                      href={cloudinaryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg flex items-center gap-1 shrink-0 transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Buka Cloudinary</span>
                    </a>
                  )}
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Interactive Multi-Sheet Selector */}
              {availableSheetNames.length > 0 && (
                <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Lembar Kerja Excel ({availableSheetNames.length} Sheets Ditemukan):</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      Sheet Aktif: <strong className="text-indigo-600 font-bold">{selectedSheetName}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {availableSheetNames.map((sName) => {
                      const isSelected = sName === selectedSheetName;
                      return (
                        <button
                          key={sName}
                          type="button"
                          onClick={() => handleSelectSheet(sName)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                          }`}
                        >
                          <FileSpreadsheet className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-emerald-600'}`} />
                          <span>{sName}</span>
                          {isSelected && (
                            <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.2 rounded-full">
                              {parsedStores.length} Toko
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Data Preview Table */}
              {parsedStores.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 text-xs">
                      Hasil Extract Sheet [{selectedSheetName || 'Excel'}] ({parsedStores.length} Toko Terbaca)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Siap ditambahkan ke database master
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded overflow-x-auto max-h-56">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 sticky top-0">
                        <tr>
                          <th className="p-2">Kode</th>
                          <th className="p-2">Nama Toko</th>
                          <th className="p-2">Kota / Kabupaten</th>
                          <th className="p-2">Alamat</th>
                          <th className="p-2 text-indigo-700">Koordinat GPS (Lat, Lng)</th>
                          <th className="p-2">Tipe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedStores.map((st, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2 font-mono font-semibold text-slate-800">{st.code}</td>
                            <td className="p-2 font-medium text-slate-900">{st.name}</td>
                            <td className="p-2 text-slate-600 font-semibold">{st.city}</td>
                            <td className="p-2 text-slate-600 max-w-[150px] truncate" title={st.address}>{st.address}</td>
                            <td className="p-2 font-mono text-indigo-700 font-bold bg-indigo-50/50">
                              {st.latitude && st.longitude ? `${st.latitude.toFixed(6)}, ${st.longitude.toFixed(6)}` : '-'}
                            </td>
                            <td className="p-2 text-slate-600">{st.storeType}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-2.5 bg-indigo-50/80 border border-indigo-200 rounded space-y-1">
                <p className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Format Baris CSV / Copas Text (Mendukung KOORDINAT):
                </p>
                <p className="text-indigo-900 font-mono text-[10px]">
                  KODE TOKO, NAMA TOKO, KOTA/KABUPATEN, ALAMAT, KOORDINAT
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">Paste Data CSV / Copas dari Excel:</label>
                  <button
                    onClick={() => setCsvText(`KODE TOKO, NAMA TOKO, KOTA/KABUPATEN, ALAMAT, KOORDINAT
TQ30, GATSU TABANAN, TABANAN, Jl. Gatot Subroto No.6 Banjar Anyar Kediri Tabanan, "-8.544279614924143, 115.14257568427973"
TLID, ALAS KEDATON, TABANAN, Jl. Raya Alas Kedaton No.46 Banjar Anyar Kediri Tabanan, "-8.526008423400015, 115.15055975331956"`)}
                    className="text-indigo-600 hover:underline text-[11px] font-semibold"
                  >
                    Contoh Format Tabanan Bali
                  </button>
                </div>
                <textarea
                  rows={7}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="Paste baris data toko atau sel Excel Anda di sini..."
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Cloud Storage Notice */}
          <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded text-[11px] text-indigo-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span>
                <strong>Cloud Sync Ready:</strong> Foto toko & scan Berita Acara dapat di-link ke Cloudinary CDN external di menu Pengaturan.
              </span>
            </div>
          </div>

          {importedCount !== null && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>
                Berhasil meng-import <strong>{importedCount} toko baru</strong> ke database master!
              </span>
            </div>
          )}

          {/* Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleProcessImport}
              disabled={activeTab === 'excel' ? parsedStores.length === 0 : !csvText.trim()}
              className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition shadow-xs flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Proses & Tambah Toko
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};


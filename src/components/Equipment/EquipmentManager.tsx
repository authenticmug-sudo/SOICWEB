import React, { useState, useRef } from 'react';
import { 
  Wrench, 
  Plus, 
  Search, 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  User, 
  Tag, 
  Edit2, 
  Trash2, 
  X, 
  ArrowRight,
  ShieldAlert,
  Building2,
  DollarSign,
  Download,
  Check,
  RefreshCw,
  Upload,
  FileText,
  HelpCircle,
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SOEquipment, EquipmentRepairLog, EquipmentCondition, RepairStatus } from '../../types/stockOpname';
import { 
  exportToCSV, 
  exportToExcelWithBackup, 
  syncCollectionFromCloudinary, 
  fetchCollectionFromFirestore,
  saveEquipment,
  backupExcelFileToCloudinaryAndFirestore,
  getFormattedDateSuffix,
  getDeterministicEquipmentId,
  cleanAllDatabaseDuplicates,
  deduplicateEntityList,
  STORAGE_KEYS
} from '../../services/storageService';
import { ConfirmDeleteModal } from '../Common/ConfirmDeleteModal';
import { ToastNotification } from '../Common/ToastNotification';

interface EquipmentManagerProps {
  equipmentList: SOEquipment[];
  repairLogs: EquipmentRepairLog[];
  onAddEquipment: (equip: Omit<SOEquipment, 'id'>) => void;
  onUpdateEquipment: (equip: SOEquipment) => void;
  onDeleteEquipment: (id: string) => void;
  onBatchUpdateEquipment?: (list: SOEquipment[], isReplaceMode?: boolean) => void;
  onAddRepairLog: (log: Omit<EquipmentRepairLog, 'id'>) => void;
  onUpdateRepairLog: (log: EquipmentRepairLog) => void;
  onDeleteRepairLog: (id: string) => void;
}

export const EquipmentManager: React.FC<EquipmentManagerProps> = ({
  equipmentList,
  repairLogs,
  onAddEquipment,
  onUpdateEquipment,
  onDeleteEquipment,
  onBatchUpdateEquipment,
  onAddRepairLog,
  onUpdateRepairLog,
  onDeleteRepairLog
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'repairs'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedRepairStatus, setSelectedRepairStatus] = useState<string>('ALL');

  // Modals
  const [isAddEquipModalOpen, setIsAddEquipModalOpen] = useState(false);
  const [editingEquip, setEditingEquip] = useState<SOEquipment | null>(null);

  // Upload Master Modal states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedImportData, setParsedImportData] = useState<SOEquipment[]>([]);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [importError, setImportError] = useState<string | null>(null);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isNewRepairModalOpen, setIsNewRepairModalOpen] = useState(false);
  const [selectedEquipForRepair, setSelectedEquipForRepair] = useState<SOEquipment | null>(null);

  const [isUpdateRepairStatusModalOpen, setIsUpdateRepairStatusModalOpen] = useState(false);
  const [editingRepairLog, setEditingRepairLog] = useState<EquipmentRepairLog | null>(null);

  const [equipToDelete, setEquipToDelete] = useState<SOEquipment | null>(null);
  const [repairLogToDelete, setRepairLogToDelete] = useState<EquipmentRepairLog | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; title?: string } | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success', title?: string) => {
    let defaultTitle = 'Informasi';
    if (type === 'success') defaultTitle = 'Berhasil Disimpan';
    if (type === 'error') defaultTitle = 'Gagal';
    setToast({
      message,
      type,
      title: title || defaultTitle
    });
  };

  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);

  const handleCleanDuplicates = async () => {
    setIsCleaningDuplicates(true);
    try {
      const result = await cleanAllDatabaseDuplicates();
      // Reload fresh equipment from Firestore / local storage
      const refreshed = await fetchCollectionFromFirestore<SOEquipment>(STORAGE_KEYS.EQUIPMENT, 'equipment');
      if (refreshed && refreshed.length > 0) {
        if (onBatchUpdateEquipment) {
          onBatchUpdateEquipment(refreshed, true);
        }
      }
      showToast(result.message, 'success', 'Deduplikasi Selesai');
    } catch (err: any) {
      showToast(`Gagal membersihkan duplikat: ${err?.message || err}`, 'error', 'Pembersihan Gagal');
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const handleSyncCloud = async () => {
    setIsSyncingCloud(true);
    try {
      // 1. Try Firestore first (with auto-deduplication)
      const fsData = await fetchCollectionFromFirestore<SOEquipment>(STORAGE_KEYS.EQUIPMENT, 'equipment');
      
      // 2. Also try Cloudinary backup sync
      const cldData = await syncCollectionFromCloudinary<SOEquipment>(
        STORAGE_KEYS.EQUIPMENT,
        'Master_Alat',
        'SO Sistem IC BALI/Master Alat',
        'equipment'
      );

      const resolvedData = fsData || cldData;
      if (resolvedData && Array.isArray(resolvedData) && resolvedData.length > 0) {
        if (onBatchUpdateEquipment) {
          onBatchUpdateEquipment(resolvedData, true);
        } else {
          resolvedData.forEach(item => onUpdateEquipment(item));
        }
        showToast(`Berhasil Sinkron Cloud! ${resolvedData.length} unit alat unik & terbebas dari duplikasi.`, 'success', 'Sinkronisasi Cloud Berhasil');
      } else {
        // If cloud empty but we have local data, push local data to cloud
        if (equipmentList.length > 0) {
          await saveEquipment(equipmentList);
          showToast(`Data lokal (${equipmentList.length} unit) berhasil di-push ke Cloud Database!`, 'info', 'Sinkronisasi Data Lokal');
        } else {
          showToast('Data Cloud sudah sinkron dengan data lokal.', 'info', 'Sinkronisasi Cloud');
        }
      }
    } catch (err: any) {
      showToast(`Sync Cloud: ${err?.message || err}`, 'error', 'Sinkronisasi Gagal');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Form states - Equipment
  const [equipAssetId, setEquipAssetId] = useState('');
  const [equipName, setEquipName] = useState('Scanner WDCP');
  const [equipCategory, setEquipCategory] = useState<SOEquipment['category']>('WDCP');
  const [equipAssignedUser, setEquipAssignedUser] = useState('');
  const [equipStatus, setEquipStatus] = useState<EquipmentCondition>('Baik');
  const [equipSerialNumber, setEquipSerialNumber] = useState('');
  const [equipScannerColor, setEquipScannerColor] = useState<SOEquipment['scannerColor']>('Merah');
  const [equipCanScanQr, setEquipCanScanQr] = useState<SOEquipment['canScanQr']>('Bisa');
  const [equipNotes, setEquipNotes] = useState('');

  // Form states - Repair Log
  const [repDamageDesc, setRepDamageDesc] = useState('');
  const [repReportedDate, setRepReportedDate] = useState(new Date().toISOString().split('T')[0]);
  const [repStartDate, setRepStartDate] = useState('');
  const [repCompletionDate, setRepCompletionDate] = useState('');
  const [repTechnician, setRepTechnician] = useState('');
  const [repCost, setRepCost] = useState<number | ''>('');
  const [repStatusTarget, setRepStatusTarget] = useState<RepairStatus>('Rusak Belum Perbaikan');
  const [repNotes, setRepNotes] = useState('');

  // Counts
  const totalCount = equipmentList.length;
  const okCount = equipmentList.filter(e => e.status === 'Oke' || e.status === 'Baik').length;
  const rusakCount = equipmentList.filter(e => e.status === 'Rusak').length;
  const perbaikanCount = equipmentList.filter(e => e.status === 'Perbaikan').length;

  const pendingRepairLogsCount = repairLogs.filter(r => r.repairStatus === 'Rusak Belum Perbaikan').length;
  const activeRepairLogsCount = repairLogs.filter(r => r.repairStatus === 'Sedang Perbaikan').length;
  const doneRepairLogsCount = repairLogs.filter(r => r.repairStatus === 'Selesai Perbaikan').length;

  // Filter Equipment
  const filteredEquipment = equipmentList.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        e.assetId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        e.assignedUser.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (e.serialNumber && e.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchCat = selectedCategory === 'ALL' || e.category === selectedCategory;
    const matchStatus = selectedStatus === 'ALL' || e.status === selectedStatus || (selectedStatus === 'Baik' && (e.status === 'Oke' || e.status === 'Baik'));
    return matchSearch && matchCat && matchStatus;
  });

  // Filter Repair Logs
  const filteredRepairLogs = repairLogs.filter(r => {
    const matchSearch = r.equipmentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        r.assetId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (r.technicianName && r.technicianName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchStatus = selectedRepairStatus === 'ALL' || r.repairStatus === selectedRepairStatus;
    return matchSearch && matchStatus;
  });

  // Handlers for Equipment
  const openAddEquipModal = () => {
    setEditingEquip(null);
    setEquipAssetId(`WDCP-MAC-${Math.floor(100 + Math.random() * 900)}`);
    setEquipName('Scanner WDCP');
    setEquipCategory('WDCP');
    setEquipAssignedUser('');
    setEquipStatus('Baik');
    setEquipSerialNumber('');
    setEquipScannerColor('Merah');
    setEquipCanScanQr('Bisa');
    setEquipNotes('');
    setIsAddEquipModalOpen(true);
  };

  const openEditEquipModal = (equip: SOEquipment) => {
    setEditingEquip(equip);
    setEquipAssetId(equip.assetId);
    setEquipName(equip.name || `Scanner ${equip.category || 'WDCP'}`);
    setEquipCategory(equip.category || 'WDCP');
    setEquipAssignedUser(equip.assignedUser || '');
    setEquipStatus(equip.status || 'Baik');
    setEquipSerialNumber(equip.serialNumber || '');
    setEquipScannerColor(equip.scannerColor || 'Merah');
    setEquipCanScanQr(equip.canScanQr || 'Bisa');
    setEquipNotes(equip.notes || '');
    setIsAddEquipModalOpen(true);
  };

  const handleSaveEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalUser = equipAssignedUser.trim();
    const finalCategory = equipCategory || 'WDCP';
    const finalName = equipName.trim() || `Scanner ${finalCategory}`;
    const finalSerial = equipSerialNumber.trim();
    const finalAssetId = equipAssetId.trim() || (finalSerial ? `WDCP-MAC-${finalSerial.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}` : `WDCP-MAC-${Math.floor(100 + Math.random() * 900)}`);

    if (!finalUser) {
      showToast('Mohon lengkapi Nama User penanggung jawab alat!', 'error', 'Validasi Gagal');
      return;
    }

    if (!finalSerial) {
      showToast('Mohon lengkapi Serial Number (MAC) alat!', 'error', 'Validasi Gagal');
      return;
    }

    try {
      if (editingEquip) {
        onUpdateEquipment({
          ...editingEquip,
          assetId: finalAssetId,
          name: finalName,
          category: finalCategory,
          assignedUser: finalUser,
          status: equipStatus,
          serialNumber: finalSerial,
          scannerColor: equipScannerColor,
          canScanQr: equipCanScanQr,
          notes: equipNotes.trim(),
          updatedAt: new Date().toISOString()
        });
        showToast(`Data Alat & WDCP [${finalAssetId}] untuk ${finalUser} berhasil diperbarui!`, 'success', 'Perubahan Disimpan');
      } else {
        onAddEquipment({
          assetId: finalAssetId,
          name: finalName,
          category: finalCategory,
          assignedUser: finalUser,
          status: equipStatus,
          serialNumber: finalSerial,
          scannerColor: equipScannerColor,
          canScanQr: equipCanScanQr,
          notes: equipNotes.trim(),
          updatedAt: new Date().toISOString()
        });
        showToast(`Data Alat & WDCP [${finalAssetId}] untuk ${finalUser} berhasil tersimpan ke sistem & Cloud!`, 'success', 'Berhasil Disimpan');
      }
      setIsAddEquipModalOpen(false);
    } catch (err: any) {
      showToast(`Gagal menyimpan data alat: ${err?.message || err}`, 'error', 'Gagal Tersimpan');
    }
  };

  // Handlers for Repair Logs
  const openNewRepairModal = (equip?: SOEquipment) => {
    const target = equip || equipmentList[0];
    setSelectedEquipForRepair(target || null);
    setRepDamageDesc('');
    setRepReportedDate(new Date().toISOString().split('T')[0]);
    setRepStartDate('');
    setRepCompletionDate('');
    setRepTechnician('');
    setRepCost('');
    setRepStatusTarget('Rusak Belum Perbaikan');
    setRepNotes('');
    setIsNewRepairModalOpen(true);
  };

  const handleSaveNewRepairLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipForRepair || !repDamageDesc) return;

    const newLog: Omit<EquipmentRepairLog, 'id'> = {
      equipmentId: selectedEquipForRepair.id,
      assetId: selectedEquipForRepair.assetId,
      equipmentName: selectedEquipForRepair.name,
      repairStatus: repStatusTarget,
      reportedDate: repReportedDate,
      damageDescription: repDamageDesc,
      startDate: repStartDate || undefined,
      completionDate: repCompletionDate || undefined,
      technicianName: repTechnician || undefined,
      repairCostRp: Number(repCost) || undefined,
      notes: repNotes || undefined
    };

    onAddRepairLog(newLog);

    // Update equipment status
    let newEquipStatus: EquipmentCondition = 'Rusak';
    if (repStatusTarget === 'Sedang Perbaikan') newEquipStatus = 'Perbaikan';
    if (repStatusTarget === 'Selesai Perbaikan') newEquipStatus = 'Oke';

    onUpdateEquipment({
      ...selectedEquipForRepair,
      status: newEquipStatus
    });

    showToast(`Log perbaikan untuk ${selectedEquipForRepair.name} (${selectedEquipForRepair.assetId}) berhasil dibuat!`, 'success', 'Log Disimpan');
    setIsNewRepairModalOpen(false);
  };

  const openUpdateRepairStatusModal = (log: EquipmentRepairLog) => {
    setEditingRepairLog(log);
    setRepStatusTarget(log.repairStatus);
    setRepStartDate(log.startDate || new Date().toISOString().split('T')[0]);
    setRepCompletionDate(log.completionDate || new Date().toISOString().split('T')[0]);
    setRepTechnician(log.technicianName || '');
    setRepCost(log.repairCostRp || '');
    setRepNotes(log.notes || '');
    setIsUpdateRepairStatusModalOpen(true);
  };

  const handleSaveUpdateRepairStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRepairLog) return;

    const updatedLog: EquipmentRepairLog = {
      ...editingRepairLog,
      repairStatus: repStatusTarget,
      startDate: repStartDate || editingRepairLog.startDate,
      completionDate: repStatusTarget === 'Selesai Perbaikan' ? (repCompletionDate || new Date().toISOString().split('T')[0]) : editingRepairLog.completionDate,
      technicianName: repTechnician || editingRepairLog.technicianName,
      repairCostRp: Number(repCost) || editingRepairLog.repairCostRp,
      notes: repNotes || editingRepairLog.notes
    };

    onUpdateRepairLog(updatedLog);

    // Sync status to main equipment
    const equip = equipmentList.find(e => e.id === editingRepairLog.equipmentId || e.assetId === editingRepairLog.assetId);
    if (equip) {
      let targetEquipStatus: EquipmentCondition = equip.status;
      if (repStatusTarget === 'Rusak Belum Perbaikan') targetEquipStatus = 'Rusak';
      else if (repStatusTarget === 'Sedang Perbaikan') targetEquipStatus = 'Perbaikan';
      else if (repStatusTarget === 'Selesai Perbaikan') targetEquipStatus = 'Oke';

      onUpdateEquipment({
        ...equip,
        status: targetEquipStatus
      });
    }

    showToast(`Status perbaikan [${editingRepairLog.assetId}] berhasil diperbarui menjadi "${repStatusTarget}"!`, 'success', 'Status Diperbarui');
    setIsUpdateRepairStatusModalOpen(false);
  };

  // Upload Master Alat (Excel / CSV) Handlers
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'No': 1,
        'Nama User': 'I Gede Budiarta',
        'Serial Number (MAC)': 'D4:AD:20:44:81:45',
        'Kondisi': 'Baik',
        'Warna Scanner': 'Merah',
        'Bisa Scan QR Barcode': 'Bisa',
        'Kategori': 'WDCP',
        'Catatan': 'Tombol Masih Oke dan Berfungsi semua'
      },
      {
        'No': 2,
        'Nama User': 'Ni Made Suartini',
        'Serial Number (MAC)': 'D4:AD:20:44:81:46',
        'Kondisi': 'Oke',
        'Warna Scanner': 'Kuning',
        'Bisa Scan QR Barcode': 'Bisa',
        'Kategori': 'WDCP',
        'Catatan': 'Kondisi mulus, batrei awet'
      },
      {
        'No': 3,
        'Nama User': 'I Wayan Sudiatmika',
        'Serial Number (MAC)': 'D4:AD:20:44:81:47',
        'Kondisi': 'Rusak',
        'Warna Scanner': 'Putih',
        'Bisa Scan QR Barcode': 'Tidak',
        'Kategori': 'WDCP',
        'Catatan': 'Batrei cepat lowbat & trigger scanner macet'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master_Alat');
    XLSX.writeFile(wb, `Template_Master_Pendataan_Alat_dan_WDCP_${getFormattedDateSuffix()}.xlsx`);
    showToast('Template Master Excel berhasil diunduh!', 'success', 'Download Berhasil');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportError(null);

    // Auto trigger raw backup in background
    backupExcelFileToCloudinaryAndFirestore(file, 'MASTER_ALAT').catch(() => {});

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          setImportError('File Excel/CSV kosong atau format tidak dikenali.');
          return;
        }

        // Filter out completely blank rows
        const validRows = rawJson.filter((row: any) => {
          if (!row || typeof row !== 'object') return false;
          return Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== '');
        });

        if (validRows.length === 0) {
          setImportError('File Excel/CSV tidak memiliki baris data yang valid.');
          return;
        }

        const parsed: SOEquipment[] = validRows.map((row: any, idx: number) => {
          // Normalize keys (case-insensitive & trim)
          const keys = Object.keys(row);
          const getVal = (possibleKeys: string[]) => {
            const foundKey = keys.find(k => possibleKeys.some(pk => k.toLowerCase().replace(/[^a-z0-9]/g, '') === pk.toLowerCase().replace(/[^a-z0-9]/g, '')));
            return foundKey ? String(row[foundKey]).trim() : '';
          };

          const user = getVal(['Nama User', 'Nama Petugas', 'Nama Korlap', 'Nama PIC', 'Petugas', 'Korlap', 'Auditor', 'User', 'Nama', 'PIC', 'Penanggung Jawab', 'Pengguna', 'Pemegang', 'Pemegang Alat', 'Nama Pengguna']) || `User ${idx + 1}`;
          const serial = getVal(['Serial Number (MAC)', 'Serial Number', 'MAC', 'MAC Address', 'SN', 'S/N', 'Serial', 'No Serial', 'Nomor Serial', 'MAC Scanner']) || '';
          
          let rawKondisi = getVal(['Kondisi', 'Status', 'Kondisi Alat', 'Condition', 'Status Alat', 'Kondisi WDCP']) || 'Baik';
          let kondisi: EquipmentCondition = 'Baik';
          if (rawKondisi.toLowerCase().includes('rusak')) kondisi = 'Rusak';
          else if (rawKondisi.toLowerCase().includes('perbaikan') || rawKondisi.toLowerCase().includes('servis')) kondisi = 'Perbaikan';
          else if (rawKondisi.toLowerCase().includes('oke') || rawKondisi.toLowerCase().includes('ready')) kondisi = 'Oke';
          else kondisi = 'Baik';

          let scannerColor = getVal(['Warna Scanner', 'Warna', 'Color', 'Warna Alat', 'Warna Fisik']) || 'Merah';
          if (scannerColor.toLowerCase().includes('merah')) scannerColor = 'Merah';
          else if (scannerColor.toLowerCase().includes('kuning')) scannerColor = 'Kuning';
          else if (scannerColor.toLowerCase().includes('putih')) scannerColor = 'Putih';
          else if (scannerColor.toLowerCase().includes('hitam')) scannerColor = 'Hitam';
          else if (scannerColor.toLowerCase().includes('biru')) scannerColor = 'Biru';

          let rawCanScan = getVal(['Bisa Scan QR Barcode', 'Bisa Scan QR', 'Scan QR', 'QR Barcode', 'QR', 'Can Scan QR', 'Barcode QR']) || 'Bisa';
          let canScanQr = (rawCanScan.toLowerCase().includes('tidak') || rawCanScan.toLowerCase() === 'no' || rawCanScan === '0') ? 'Tidak' : 'Bisa';

          let category = getVal(['Kategori', 'Category', 'Tipe Perangkat', 'Jenis Alat', 'Model', 'Tipe Scanner']) || 'WDCP';
          let notes = getVal(['Catatan', 'Keterangan', 'Notes', 'Deskripsi', 'Kondisi Fisik', 'Catatan Alat', 'Keterangan Tambahan']) || '';
          let assetId = getVal(['ID Asset', 'Asset ID', 'Kode Alat', 'No Asset', 'Nomor Asset']) || (serial && serial.length >= 6 ? `WDCP-${serial.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}` : `WDCP-${String(idx + 1).padStart(3, '0')}`);
          let name = getVal(['Nama Alat / WDCP', 'Nama Alat', 'Nama Perangkat', 'Device Name', 'Nama Barang']) || `Scanner ${category}`;

          const deterministicId = getDeterministicEquipmentId({ serialNumber: serial, assetId, assignedUser: user, name });

          return {
            id: deterministicId,
            assetId,
            name,
            category,
            assignedUser: user,
            status: kondisi,
            serialNumber: serial,
            scannerColor,
            canScanQr,
            notes,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        });

        // Deduplicate parsed data within the file itself
        const { deduplicated: cleanParsed } = deduplicateEntityList('equipment', parsed);
        setParsedImportData(cleanParsed);
        setImportError(null);
      } catch (err: any) {
        setImportError(`Gagal membaca file: ${err?.message || 'Pastikan file berekstensi .xlsx, .xls, atau .csv'}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExecuteImport = async () => {
    if (parsedImportData.length === 0) {
      showToast('Tidak ada data valid yang dapat diimpor.', 'error', 'Impor Gagal');
      return;
    }

    setIsProcessingImport(true);
    try {
      if (importFile) {
        await backupExcelFileToCloudinaryAndFirestore(importFile, 'MASTER_ALAT').catch(() => {});
      }

      let finalEquipmentList: SOEquipment[] = [];
      const isReplace = importMode === 'replace';

      if (isReplace) {
        finalEquipmentList = [...parsedImportData];
      } else {
        // Append / Merge mode
        const getItemKey = (e: SOEquipment) => {
          const sn = (e.serialNumber || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          const isFullSerial = sn && sn.length >= 6 && !sn.startsWith('000000');
          if (isFullSerial) return `sn_${sn}`;
          const ast = (e.assetId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          if (ast && ast.length >= 6 && !ast.startsWith('wdcp-00')) return `ast_${ast}`;
          const usr = (e.assignedUser || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          const nm = (e.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          if (usr && nm) return `usr_${usr}_${nm}`;
          return (e.id || '').toLowerCase();
        };
        const existingMap = new Map<string, SOEquipment>();
        equipmentList.forEach(e => {
          existingMap.set(getItemKey(e), e);
        });
        parsedImportData.forEach(item => {
          existingMap.set(getItemKey(item), item);
        });
        finalEquipmentList = Array.from(existingMap.values());
      }

      // Final deduplication
      const { deduplicated: cleanFinalList } = deduplicateEntityList('equipment', finalEquipmentList);

      // Persist immediately to Firestore & localStorage
      await saveEquipment(cleanFinalList, isReplace);

      if (onBatchUpdateEquipment) {
        onBatchUpdateEquipment(cleanFinalList, isReplace);
      } else {
        cleanFinalList.forEach(item => onUpdateEquipment(item));
      }

      showToast(`Berhasil mengimpor ${cleanFinalList.length} data Master Alat & WDCP! Tersimpan ke Firestore & Cloudinary (${isReplace ? 'Ganti Semua' : 'Gabungkan'}).`, 'success', 'Impor Berhasil');
      setIsImportModalOpen(false);
      setImportFile(null);
      setParsedImportData([]);
    } catch (err: any) {
      showToast(`Gagal impor: ${err?.message || err}`, 'error', 'Impor Gagal');
    } finally {
      setIsProcessingImport(false);
    }
  };

  // Export Equipment to Excel & CSV with standard tanggal_bulan_ filename
  const handleExportEquipmentExcel = () => {
    const exportData = filteredEquipment.map((e, idx) => ({
      'No': idx + 1,
      'Nama User': e.assignedUser || '-',
      'Serial Number (MAC)': e.serialNumber || '-',
      'Kondisi': e.status,
      'Warna Scanner': e.scannerColor || '-',
      'Bisa Scan QR Barcode': e.canScanQr || 'Bisa',
      'Kategori': e.category || 'WDCP',
      'Catatan': e.notes || '-'
    }));

    exportToExcelWithBackup(`Pendataan_Alat_dan_WDCP_Korlap_${getFormattedDateSuffix()}.xlsx`, 'Pendataan_Alat_dan_WDCP', exportData);
    showToast('Export Excel Master Alat berhasil diunduh!', 'success', 'Download Berhasil');
  };

  const handleExportEquipmentCSV = async () => {
    const exportData = filteredEquipment.map((e, idx) => ({
      'No': idx + 1,
      'Nama User': e.assignedUser || '-',
      'Serial Number (MAC)': e.serialNumber || '-',
      'Kondisi': e.status,
      'Warna Scanner': e.scannerColor || '-',
      'Bisa Scan QR Barcode': e.canScanQr || 'Bisa',
      'Kategori': e.category || 'WDCP',
      'Catatan': e.notes || '-'
    }));

    const result = await exportToCSV(`Pendataan_Alat_dan_WDCP_Korlap_${getFormattedDateSuffix()}.csv`, exportData);
    if (result.success) {
      showToast('Data CSV Alat & WDCP berhasil diunduh & otomatis ter-backup ke Cloudinary!', 'success', 'Export CSV Berhasil');
    } else if (result.error) {
      showToast(result.error, 'error', 'Export CSV Gagal');
    }
  };

  // Export Repair Logs to Excel & CSV
  const handleExportRepairLogsExcel = () => {
    const exportData = filteredRepairLogs.map((r, idx) => ({
      'No': idx + 1,
      'ID Asset': r.assetId,
      'Nama Alat': r.equipmentName,
      'Status Perbaikan': r.repairStatus,
      'Tgl Dilaporkan': r.reportedDate,
      'Tgl Mulai Perbaikan': r.startDate || '-',
      'Tgl Selesai Perbaikan': r.completionDate || '-',
      'Teknisi / Bengkel': r.technicianName || '-',
      'Biaya (Rp)': r.repairCostRp || 0,
      'Deskripsi Kerusakan': r.damageDescription,
      'Catatan': r.notes || '-'
    }));

    exportToExcelWithBackup(`Log_Perbaikan_Peralatan_SO_${getFormattedDateSuffix()}.xlsx`, 'Log_Perbaikan_Peralatan', exportData);
    showToast('Export Excel Log Perbaikan berhasil diunduh!', 'success', 'Download Berhasil');
  };

  const handleExportRepairLogsCSV = async () => {
    const exportData = filteredRepairLogs.map((r, idx) => ({
      'No': idx + 1,
      'ID Asset': r.assetId,
      'Nama Alat': r.equipmentName,
      'Status Perbaikan': r.repairStatus,
      'Tgl Dilaporkan': r.reportedDate,
      'Tgl Mulai Perbaikan': r.startDate || '-',
      'Tgl Selesai Perbaikan': r.completionDate || '-',
      'Teknisi / Bengkel': r.technicianName || '-',
      'Biaya (Rp)': r.repairCostRp || 0,
      'Deskripsi Kerusakan': r.damageDescription,
      'Catatan': r.notes || '-'
    }));
    const result = await exportToCSV(`Log_Perbaikan_Peralatan_SO_${getFormattedDateSuffix()}.csv`, exportData);
    if (result.success) {
      showToast('Data CSV Log Perbaikan berhasil diunduh!', 'success', 'Export CSV Berhasil');
    } else if (result.error) {
      showToast(result.error, 'error', 'Export CSV Gagal');
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-600" />
            Tracking Peralatan & Barcode Scanner SO Lapangan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoring kondisi {totalCount} unit perangkat audit (Scanner, PDA, Tablet, Printer) & log perbaikan kerusakan
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto flex-wrap md:flex-nowrap">
          {activeSubTab === 'catalog' ? (
            <>
              <button
                onClick={handleSyncCloud}
                disabled={isSyncingCloud}
                title="Tarik data terbaru dari Firestore & Cloudinary"
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50 shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                <span>{isSyncingCloud ? 'Syncing...' : 'Sinkron Cloud'}</span>
              </button>
              <button
                onClick={handleCleanDuplicates}
                disabled={isCleaningDuplicates}
                title="Hapus dan bersihkan dokumen ganda di Firestore untuk menghemat kuota harian"
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50 shadow-2xs"
              >
                <Layers className={`w-3.5 h-3.5 text-amber-600 ${isCleaningDuplicates ? 'animate-spin' : ''}`} />
                <span>{isCleaningDuplicates ? 'Membersihkan...' : 'Bersihkan Duplikat'}</span>
              </button>
              <button
                onClick={() => {
                  setImportFile(null);
                  setParsedImportData([]);
                  setImportError(null);
                  setIsImportModalOpen(true);
                }}
                title="Upload file Master Excel atau CSV untuk update masal"
                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5 text-purple-600" />
                <span>Upload Master</span>
              </button>
              <button
                onClick={handleExportEquipmentExcel}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-semibold transition flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={handleExportEquipmentCSV}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={openAddEquipModal}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Alat Baru</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleExportRepairLogsExcel}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-semibold transition flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Excel Log</span>
              </button>
              <button
                onClick={handleExportRepairLogsCSV}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>CSV Log</span>
              </button>
              <button
                onClick={() => openNewRepairModal()}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>+ Log Kerusakan Baru</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Total Alat SO</span>
            <p className="text-base font-extrabold text-slate-900">{totalCount} <span className="text-xs font-normal text-slate-500">unit</span></p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-emerald-200 bg-emerald-50/30 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-emerald-700 font-bold uppercase">Kondisi OKE / Ready</span>
            <p className="text-base font-extrabold text-emerald-800">{okCount} <span className="text-xs font-normal text-emerald-600">unit</span></p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-rose-200 bg-rose-50/30 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-rose-100 text-rose-700 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-rose-700 font-bold uppercase">Rusak Belum Perbaikan</span>
            <p className="text-base font-extrabold text-rose-800">{rusakCount} <span className="text-xs font-normal text-rose-600">unit</span></p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-amber-200 bg-amber-50/30 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 text-amber-700 rounded-lg">
            <Clock className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <span className="text-[10px] text-amber-700 font-bold uppercase">Sedang Perbaikan</span>
            <p className="text-base font-extrabold text-amber-800">{perbaikanCount} <span className="text-xs font-normal text-amber-600">unit</span></p>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 pt-3 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2">
          
          <div className="flex gap-2">
            <button
              onClick={() => setActiveSubTab('catalog')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
                activeSubTab === 'catalog'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Tag className="w-4 h-4" />
              Master Katalog Perangkat ({totalCount})
            </button>

            <button
              onClick={() => setActiveSubTab('repairs')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
                activeSubTab === 'repairs'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Sub-Menu: Log Kerusakan & Perbaikan Alat
              {(pendingRepairLogsCount + activeRepairLogsCount) > 0 && (
                <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[10px]">
                  {pendingRepairLogsCount + activeRepairLogsCount}
                </span>
              )}
            </button>
          </div>

          {/* Search bar inside sub-tab header */}
          <div className="pb-2.5 w-full md:w-64">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeSubTab === 'catalog' ? "Cari nama, ID asset, user..." : "Cari alat, teknisi..."}
                className="w-full bg-white border border-slate-300 rounded pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

        </div>

        {/* SUB TAB 1: MASTER KATALOG PERALATAN & WDCP */}
        {activeSubTab === 'catalog' && (
          <div className="p-4 space-y-4">
            
            {/* Category & Status Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                <span className="text-[11px] font-semibold text-slate-500 mr-1">Kategori:</span>
                {['ALL', 'WDCP', 'Barcode Scanner', 'Handheld PDA', 'Tablet Audit', 'Thermal Printer', 'Laser Meter', 'Aksesori & Powerbank'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {cat === 'ALL' ? 'Semua Kategori' : cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 text-xs">
                <span className="text-[11px] font-semibold text-slate-500 mr-1">Kondisi:</span>
                {['ALL', 'Baik', 'Rusak', 'Perbaikan'].map(st => (
                  <button
                    key={st}
                    onClick={() => setSelectedStatus(st)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                      selectedStatus === st
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {st === 'ALL' ? 'Semua' : st === 'Baik' ? 'Baik / Oke' : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Equipment Data Table */}
            <div className="border border-slate-200 rounded-lg overflow-x-auto shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Nama User</th>
                    <th className="p-3">Serial Number (MAC)</th>
                    <th className="p-3">Kondisi</th>
                    <th className="p-3">Warna Scanner</th>
                    <th className="p-3">Bisa Scan QR Barcode</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3">Catatan</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEquipment.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        Tidak ada pendataan Alat & WDCP yang sesuai dengan kriteria.
                      </td>
                    </tr>
                  ) : (
                    filteredEquipment.map((eq, idx) => (
                      <tr key={eq.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="p-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                            <span>{eq.assignedUser || '-'}</span>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-[11px] font-bold text-slate-800">
                          <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {eq.serialNumber || '-'}
                          </span>
                        </td>
                        <td className="p-3">
                          {(eq.status === 'Baik' || eq.status === 'Oke') && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-[11px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {eq.status}
                            </span>
                          )}
                          {eq.status === 'Rusak' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-bold text-[11px]">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Rusak
                            </span>
                          )}
                          {eq.status === 'Perbaikan' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold text-[11px]">
                              <Clock className="w-3 h-3 text-amber-600 animate-spin-slow" />
                              Perbaikan
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {eq.scannerColor === 'Merah' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded font-bold text-[10px]">
                              <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                              Merah
                            </span>
                          )}
                          {eq.scannerColor === 'Kuning' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded font-bold text-[10px]">
                              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                              Kuning
                            </span>
                          )}
                          {eq.scannerColor === 'Putih' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 rounded font-bold text-[10px]">
                              <span className="w-2 h-2 rounded-full bg-slate-300 border border-slate-400"></span>
                              Putih
                            </span>
                          )}
                          {eq.scannerColor && !['Merah', 'Kuning', 'Putih'].includes(eq.scannerColor) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded font-bold text-[10px]">
                              {eq.scannerColor}
                            </span>
                          )}
                          {!eq.scannerColor && <span className="text-slate-400">-</span>}
                        </td>
                        <td className="p-3">
                          {eq.canScanQr === 'Bisa' || !eq.canScanQr ? (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold text-[10px]">
                              Bisa
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded font-bold text-[10px]">
                              Tidak
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                            {eq.category || 'WDCP'}
                          </span>
                        </td>
                        <td className="p-3 max-w-[200px]">
                          <p className="text-slate-700 text-[11px] truncate" title={eq.notes || '-'}>
                            {eq.notes || '-'}
                          </p>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {(eq.status === 'Oke' || eq.status === 'Baik') && (
                              <button
                                title="Laporkan Kerusakan"
                                onClick={() => openNewRepairModal(eq)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[10px] font-semibold transition"
                              >
                                Laporkan Rusak
                              </button>
                            )}
                            <button
                              title="Edit Perangkat"
                              onClick={() => openEditEquipModal(eq)}
                              className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded text-[10px] font-bold transition flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              title="Hapus Perangkat"
                              onClick={() => setEquipToDelete(eq)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 rounded text-[10px] font-bold transition flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* SUB TAB 2: LOG KERUSAKAN & PERBAIKAN ALAT */}
        {activeSubTab === 'repairs' && (
          <div className="p-4 space-y-4">
            
            {/* Status Filter for Repairs */}
            <div className="flex items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Filter Log Perbaikan:</span>
                {[
                  { key: 'ALL', label: 'Semua Log' },
                  { key: 'Rusak Belum Perbaikan', label: 'Rusak Belum Perbaikan', count: pendingRepairLogsCount, color: 'bg-rose-100 text-rose-800' },
                  { key: 'Sedang Perbaikan', label: 'Sedang Perbaikan', count: activeRepairLogsCount, color: 'bg-amber-100 text-amber-800' },
                  { key: 'Selesai Perbaikan', label: 'Selesai Perbaikan', count: doneRepairLogsCount, color: 'bg-emerald-100 text-emerald-800' }
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => setSelectedRepairStatus(item.key)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition flex items-center gap-1.5 ${
                      selectedRepairStatus === item.key
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.count !== undefined && (
                      <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${item.color}`}>
                        {item.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                Sistem meng-update otomatis status alat ke OKE begitu perbaikan selesai
              </span>
            </div>

            {/* Repair Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRepairLogs.length === 0 ? (
                <div className="col-span-full p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-400 text-xs">
                  Tidak ada catatan log perbaikan yang sesuai dengan kriteria.
                </div>
              ) : (
                filteredRepairLogs.map(log => {
                  const isPending = log.repairStatus === 'Rusak Belum Perbaikan';
                  const isInProgress = log.repairStatus === 'Sedang Perbaikan';
                  const isDone = log.repairStatus === 'Selesai Perbaikan';

                  return (
                    <div 
                      key={log.id} 
                      className={`p-4 rounded-xl border shadow-2xs space-y-3 transition ${
                        isPending 
                          ? 'bg-rose-50/30 border-rose-200' 
                          : isInProgress 
                          ? 'bg-amber-50/30 border-amber-200' 
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200/80">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-slate-100 font-mono text-[10px] font-bold text-slate-700 rounded border border-slate-200">
                              {log.assetId}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">Tgl Lapor: {log.reportedDate}</span>
                          </div>
                          <h3 className="font-bold text-slate-900 text-sm mt-1">{log.equipmentName}</h3>
                        </div>

                        {/* Status Chip */}
                        {isPending && (
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[11px] rounded-full flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Rusak Belum Perbaikan
                          </span>
                        )}
                        {isInProgress && (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[11px] rounded-full flex items-center gap-1 animate-pulse">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Sedang Perbaikan
                          </span>
                        )}
                        {isDone && (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px] rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Selesai Perbaikan
                          </span>
                        )}
                      </div>

                      {/* Damage Description */}
                      <div className="p-2.5 bg-white/80 border border-slate-200 rounded-lg space-y-1 text-xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Deskripsi Kerusakan:</span>
                        <p className="text-slate-800 font-medium leading-relaxed">{log.damageDescription}</p>
                      </div>

                      {/* Timeline Dates & Details */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-slate-50 rounded border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-semibold block">Tanggal Mulai Perbaikan</span>
                          <p className={`font-bold mt-0.5 ${log.startDate ? 'text-slate-800' : 'text-slate-400 italic'}`}>
                            {log.startDate ? log.startDate : 'Belum Dimulai'}
                          </p>
                        </div>

                        <div className="p-2 bg-slate-50 rounded border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-semibold block">Tanggal Selesai Perbaikan</span>
                          <p className={`font-bold mt-0.5 ${log.completionDate ? 'text-emerald-700' : 'text-slate-400 italic'}`}>
                            {log.completionDate ? log.completionDate : 'Belum Selesai'}
                          </p>
                        </div>
                      </div>

                      {/* Technician & Cost */}
                      {(log.technicianName || log.repairCostRp) && (
                        <div className="flex items-center justify-between text-xs pt-1 text-slate-600">
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            Teknisi: <strong>{log.technicianName || '-'}</strong>
                          </span>
                          {log.repairCostRp !== undefined && log.repairCostRp !== null ? (
                            <span className="font-mono font-bold text-slate-900">
                              Rp {Number(log.repairCostRp).toLocaleString('id-ID')}
                            </span>
                          ) : null}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                        <button
                          onClick={() => openUpdateRepairStatusModal(log)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold transition flex items-center gap-1 shadow-2xs"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Update Status & Tanggal</span>
                        </button>

                        <button
                          onClick={() => setRepairLogToDelete(log)}
                          className="text-slate-400 hover:text-rose-600 text-xs font-medium transition"
                        >
                          Hapus Log
                        </button>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

      </div>

      {/* MODAL: TAMBAH / EDIT PERANGKAT ALAT (STRUKTUR SESUAI GAMBAR) */}
      {isAddEquipModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-3.5 px-5 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-400" />
                {editingEquip ? 'Edit Pendataan Alat & WDCP' : 'Tambah Pendataan Alat & WDCP Baru'}
              </h3>
              <button onClick={() => setIsAddEquipModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEquipment} className="p-5 space-y-3.5 text-xs">
              
              {/* 1. Nama User & 2. Serial Number (MAC) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama User *</label>
                  <input
                    type="text"
                    required
                    value={equipAssignedUser}
                    onChange={(e) => setEquipAssignedUser(e.target.value)}
                    placeholder="misal: I Gede Budiarta"
                    className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Serial Number (MAC) *</label>
                  <input
                    type="text"
                    required
                    value={equipSerialNumber}
                    onChange={(e) => setEquipSerialNumber(e.target.value)}
                    placeholder="misal: D4:AD:20:44:81:45"
                    className="w-full border border-slate-300 rounded p-2 font-mono text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* 3. Kondisi, 4. Warna Scanner, 5. Bisa Scan QR Barcode */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kondisi *</label>
                  <select
                    value={equipStatus}
                    onChange={(e) => setEquipStatus(e.target.value as any)}
                    className="w-full border border-slate-300 rounded p-2 text-xs font-bold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Baik">Baik</option>
                    <option value="Oke">Oke</option>
                    <option value="Rusak">Rusak</option>
                    <option value="Perbaikan">Perbaikan</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Warna Scanner *</label>
                  <select
                    value={equipScannerColor}
                    onChange={(e) => setEquipScannerColor(e.target.value as any)}
                    className="w-full border border-slate-300 rounded p-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Merah">Merah</option>
                    <option value="Kuning">Kuning</option>
                    <option value="Putih">Putih</option>
                    <option value="Hitam">Hitam</option>
                    <option value="Biru">Biru</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bisa Scan QR Barcode *</label>
                  <select
                    value={equipCanScanQr}
                    onChange={(e) => setEquipCanScanQr(e.target.value as any)}
                    className="w-full border border-slate-300 rounded p-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Bisa">Bisa</option>
                    <option value="Tidak">Tidak</option>
                  </select>
                </div>
              </div>

              {/* 6. Kategori & Nama/Tipe Alat */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori *</label>
                  <select
                    value={equipCategory}
                    onChange={(e) => {
                      const newCat = e.target.value as SOEquipment['category'];
                      setEquipCategory(newCat);
                      if (!equipName || equipName.startsWith('Scanner ')) {
                        setEquipName(`Scanner ${newCat}`);
                      }
                    }}
                    className="w-full border border-slate-300 rounded p-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="WDCP">WDCP</option>
                    <option value="Barcode Scanner">Barcode Scanner</option>
                    <option value="Handheld PDA">Handheld PDA</option>
                    <option value="Tablet Audit">Tablet Audit</option>
                    <option value="Thermal Printer">Thermal Printer</option>
                    <option value="Laser Meter">Laser Meter</option>
                    <option value="Aksesori & Powerbank">Aksesori & Powerbank</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama / Tipe Alat</label>
                  <input
                    type="text"
                    value={equipName}
                    onChange={(e) => setEquipName(e.target.value)}
                    placeholder={`misal: Scanner ${equipCategory}`}
                    className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>

              {/* 7. Catatan */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan</label>
                <textarea
                  rows={2}
                  value={equipNotes}
                  onChange={(e) => setEquipNotes(e.target.value)}
                  placeholder="misal: Tombol Masih Oke dan Berfungsi semua / Batrei cepat lowbat..."
                  className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500">Otomatis ter-sync ke Firestore & Cloudinary Backup</span>
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddEquipModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition active:scale-95 text-center"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Simpan Perangkat</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD MASTER ALAT & WDCP (EXCEL / CSV) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white p-3.5 px-5 flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Upload className="w-4 h-4 text-purple-400" />
                Upload Master Pendataan Alat & WDCP
              </h3>
              <button 
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportFile(null);
                  setParsedImportData([]);
                  setImportError(null);
                }} 
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              
              {/* Petunjuk & Download Template */}
              <div className="bg-purple-50/60 border border-purple-200 rounded-lg p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-bold text-purple-900 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                    Format File Master (.xlsx, .xls, .csv)
                  </p>
                  <p className="text-purple-700 text-[11px]">
                    Struktur kolom: <span className="font-semibold">No, Nama User, Serial Number (MAC), Kondisi, Warna Scanner, Bisa Scan QR Barcode, Kategori, Catatan</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 bg-white hover:bg-purple-100 text-purple-700 border border-purple-300 rounded font-semibold text-xs transition flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-purple-600" />
                  <span>Download Template Excel</span>
                </button>
              </div>

              {/* Upload Drop Area */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-purple-300 hover:border-purple-500 bg-purple-50/30 hover:bg-purple-50/60 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">
                    {importFile ? importFile.name : 'Klik untuk Pilih File Master Excel / CSV'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Mendukung file .xlsx, .xls, dan .csv
                  </p>
                </div>
              </div>

              {/* Error Box */}
              {importError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Preview Parsed Data */}
              {parsedImportData.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Pratinjau Data ({parsedImportData.length} baris terdeteksi):
                    </p>
                    
                    {/* Opsi Mode Impor */}
                    <div className="flex items-center gap-3 bg-slate-100 p-1 px-2 rounded-lg text-[11px] font-semibold text-slate-700">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="importMode"
                          value="replace"
                          checked={importMode === 'replace'}
                          onChange={() => setImportMode('replace')}
                          className="text-purple-600 focus:ring-purple-500"
                        />
                        <span>Ganti Semua Data Master</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="importMode"
                          value="append"
                          checked={importMode === 'append'}
                          onChange={() => setImportMode('append')}
                          className="text-purple-600 focus:ring-purple-500"
                        />
                        <span>Gabungkan (Append)</span>
                      </label>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-48">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold sticky top-0">
                        <tr>
                          <th className="p-2 w-8 text-center">No</th>
                          <th className="p-2">Nama User</th>
                          <th className="p-2">Serial Number (MAC)</th>
                          <th className="p-2">Kondisi</th>
                          <th className="p-2">Warna</th>
                          <th className="p-2">Scan QR</th>
                          <th className="p-2">Kategori</th>
                          <th className="p-2">Catatan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedImportData.slice(0, 10).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 text-center text-slate-500 font-bold">{idx + 1}</td>
                            <td className="p-2 font-semibold text-slate-900">{row.assignedUser}</td>
                            <td className="p-2 font-mono text-[10px] text-slate-700">{row.serialNumber || '-'}</td>
                            <td className="p-2">
                              <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                row.status === 'Baik' || row.status === 'Oke' 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : row.status === 'Rusak' 
                                  ? 'bg-rose-100 text-rose-800' 
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="p-2 font-medium">{row.scannerColor || '-'}</td>
                            <td className="p-2">{row.canScanQr || 'Bisa'}</td>
                            <td className="p-2 text-slate-600">{row.category || 'WDCP'}</td>
                            <td className="p-2 text-slate-500 truncate max-w-[150px]">{row.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedImportData.length > 10 && (
                    <p className="text-[11px] text-slate-400 italic text-center">
                      ... dan {parsedImportData.length - 10} data lainnya
                    </p>
                  )}
                </div>
              )}

            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
              <span className="text-[11px] text-slate-500">
                {parsedImportData.length > 0 ? `${parsedImportData.length} alat siap diimpor` : 'Silakan pilih file untuk memulai'}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportFile(null);
                    setParsedImportData([]);
                  }}
                  className="px-3.5 py-1.5 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={parsedImportData.length === 0 || isProcessingImport}
                  onClick={handleExecuteImport}
                  className="px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessingImport ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Mengimpor...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Eksekusi Impor Master</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: INPUT LOG KERUSAKAN BARU */}
      {isNewRepairModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-rose-900 text-white p-3.5 px-5 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-300" />
                Input Log Kerusakan & Perbaikan Alat Baru
              </h3>
              <button onClick={() => setIsNewRepairModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewRepairLog} className="p-5 space-y-3.5 text-xs">
              
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pilih Perangkat Alat SO *</label>
                <select
                  value={selectedEquipForRepair?.id || ''}
                  onChange={(e) => {
                    const found = equipmentList.find(eq => eq.id === e.target.value);
                    if (found) setSelectedEquipForRepair(found);
                  }}
                  className="w-full border border-slate-300 rounded p-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                >
                  {equipmentList.map(eq => (
                    <option key={eq.id} value={eq.id}>
                      [{eq.assetId}] {eq.name} - ({eq.assignedUser})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Laporan Perbaikan *</label>
                <select
                  value={repStatusTarget}
                  onChange={(e) => setRepStatusTarget(e.target.value as RepairStatus)}
                  className="w-full border border-slate-300 rounded p-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                >
                  <option value="Rusak Belum Perbaikan">Rusak Belum Perbaikan</option>
                  <option value="Sedang Perbaikan">Sedang Perbaikan (Mulai Perbaikan)</option>
                  <option value="Selesai Perbaikan">Selesai Perbaikan (Kembali OKE)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deskripsi Detail Kerusakan *</label>
                <textarea
                  rows={2}
                  required
                  value={repDamageDesc}
                  onChange={(e) => setRepDamageDesc(e.target.value)}
                  placeholder="Jelaskan kendala fisik / error barcode scanner..."
                  className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Dilaporkan *</label>
                  <input
                    type="date"
                    required
                    value={repReportedDate}
                    onChange={(e) => setRepReportedDate(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Mulai Perbaikan</label>
                  <input
                    type="date"
                    value={repStartDate}
                    onChange={(e) => setRepStartDate(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Teknisi / Tempat Perbaikan</label>
                  <input
                    type="text"
                    value={repTechnician}
                    onChange={(e) => setRepTechnician(e.target.value)}
                    placeholder="misal: Service Center Zebra Prima"
                    className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Estimasi Biaya (Rp)</label>
                  <input
                    type="number"
                    value={repCost}
                    onChange={(e) => setRepCost(e.target.value ? Number(e.target.value) : '')}
                    placeholder="0"
                    className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewRepairModalOpen(false)}
                  className="px-3.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs"
                >
                  Simpan Log Kerusakan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPDATE STATUS & TANGGAL PERBAIKAN */}
      {isUpdateRepairStatusModalOpen && editingRepairLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-indigo-900 text-white p-3.5 px-5 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-300" />
                Update Status Perbaikan Alat [{editingRepairLog.assetId}]
              </h3>
              <button onClick={() => setIsUpdateRepairStatusModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUpdateRepairStatus} className="p-5 space-y-3.5 text-xs">
              
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                <p className="font-bold text-slate-900">{editingRepairLog.equipmentName}</p>
                <p className="text-[11px] text-slate-500">Rusak: {editingRepairLog.damageDescription}</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Perbaikan Baru *</label>
                <select
                  value={repStatusTarget}
                  onChange={(e) => setRepStatusTarget(e.target.value as RepairStatus)}
                  className="w-full border border-slate-300 rounded p-2 text-xs font-bold text-indigo-900 bg-indigo-50/50 focus:outline-none focus:border-indigo-500"
                >
                  <option value="Rusak Belum Perbaikan">1. Rusak Belum Perbaikan</option>
                  <option value="Sedang Perbaikan">2. Sedang Perbaikan (Input Tgl Mulai)</option>
                  <option value="Selesai Perbaikan">3. Selesai Perbaikan (Kembali OKE)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Mulai Perbaikan</label>
                  <input
                    type="date"
                    value={repStartDate}
                    onChange={(e) => setRepStartDate(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Selesai Perbaikan</label>
                  <input
                    type="date"
                    value={repCompletionDate}
                    onChange={(e) => setRepCompletionDate(e.target.value)}
                    disabled={repStatusTarget !== 'Selesai Perbaikan'}
                    className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Teknisi / Tempat Perbaikan</label>
                  <input
                    type="text"
                    value={repTechnician}
                    onChange={(e) => setRepTechnician(e.target.value)}
                    placeholder="misal: Service Center Resmi Zebra"
                    className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Biaya Perbaikan Selesai (Rp)</label>
                  <input
                    type="number"
                    value={repCost}
                    onChange={(e) => setRepCost(e.target.value ? Number(e.target.value) : '')}
                    placeholder="0"
                    className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan Hasil Servis / Sparepart</label>
                <textarea
                  rows={2}
                  value={repNotes}
                  onChange={(e) => setRepNotes(e.target.value)}
                  placeholder="Catatan pengerjaan, garansi servis, dll..."
                  className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUpdateRepairStatusModalOpen(false)}
                  className="px-3.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs"
                >
                  Update & Sinkronkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Equipment Deletion */}
      <ConfirmDeleteModal
        isOpen={!!equipToDelete}
        onClose={() => setEquipToDelete(null)}
        onConfirm={() => {
          if (equipToDelete) {
            onDeleteEquipment(equipToDelete.id);
            showToast(`Perangkat ${equipToDelete.name} (${equipToDelete.assetId}) berhasil dihapus dari sistem!`, 'success', 'Berhasil Dihapus');
            setEquipToDelete(null);
          }
        }}
        title="Hapus Perangkat SO"
        subtitle="Apakah Anda yakin ingin menghapus perangkat ini?"
        itemName={equipToDelete ? `${equipToDelete.assetId} - ${equipToDelete.name}` : undefined}
        itemDetails={equipToDelete ? [
          { label: 'Kategori', value: equipToDelete.category },
          { label: 'Serial Number (MAC)', value: equipToDelete.serialNumber || '-' },
          { label: 'Kondisi', value: equipToDelete.status },
          { label: 'User / Penanggung Jawab', value: equipToDelete.assignedUser || '-' }
        ] : []}
        confirmText="Ya, Hapus Perangkat"
        dangerBadgeText="Data aset & perangkat ini akan dihapus dari inventaris."
      />

      {/* Confirmation Modal for Repair Log Deletion */}
      <ConfirmDeleteModal
        isOpen={!!repairLogToDelete}
        onClose={() => setRepairLogToDelete(null)}
        onConfirm={() => {
          if (repairLogToDelete) {
            onDeleteRepairLog(repairLogToDelete.id);
            showToast(`Log perbaikan untuk ${repairLogToDelete.assetId} berhasil dihapus!`, 'success', 'Berhasil Dihapus');
            setRepairLogToDelete(null);
          }
        }}
        title="Hapus Log Perbaikan"
        subtitle="Apakah Anda yakin ingin menghapus catatan log perbaikan ini?"
        itemName={repairLogToDelete ? `${repairLogToDelete.assetId} - ${repairLogToDelete.equipmentName}` : undefined}
        itemDetails={repairLogToDelete ? [
          { label: 'Tgl Lapor', value: repairLogToDelete.reportedDate },
          { label: 'Kerusakan', value: repairLogToDelete.damageDescription },
          { label: 'Status', value: repairLogToDelete.repairStatus }
        ] : []}
        confirmText="Ya, Hapus Log"
        dangerBadgeText="Catatan histori perbaikan ini akan dihapus permanen."
      />

      {/* Dynamic Toast Feedback */}
      {toast && (
        <ToastNotification
          type={toast.type}
          title={toast.title}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

    </div>
  );
};

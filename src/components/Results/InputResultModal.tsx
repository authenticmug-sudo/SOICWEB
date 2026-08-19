import React, { useState, useEffect } from 'react';
import { 
  X, 
  ClipboardCheck, 
  Plus, 
  Trash2, 
  Calculator, 
  UserCheck, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  Camera, 
  TrendingUp, 
  TrendingDown,
  Layers,
  ShieldAlert,
  FileCheck,
  Share2,
  Copy,
  Check,
  AlertTriangle,
  HelpCircle,
  RotateCcw,
  Users,
  ShieldCheck,
  Save,
  HardDrive,
  Smartphone,
  BookmarkCheck,
  Info
} from 'lucide-react';
import { 
  SOSchedule, 
  SOResult, 
  CustomNKLItem, 
  CustomBrankasItem, 
  Top5Item,
  StoreConditionCheck,
  OperationalCheck,
  CCTVCheck,
  BrankasAuditReport 
} from '../../types/stockOpname';
import { formatRupiah } from '../../utils/formatters';
import { uploadToCloudinary } from '../../services/cloudinaryService';
import { generateWAShareText, openWAShareUrl, copyToClipboard } from '../../utils/whatsappFormatter';
import { SearchableScheduleSelect } from '../Common/SearchableScheduleSelect';
import { RupiahInput } from '../Common/RupiahInput';

interface InputResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedules: SOSchedule[];
  initialScheduleId?: string | null;
  onCreateResult: (newResult: Omit<SOResult, 'id' | 'submittedAt'>) => void;
}

export const InputResultModal: React.FC<InputResultModalProps> = ({
  isOpen,
  onClose,
  schedules,
  initialScheduleId,
  onCreateResult
}) => {
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [activeTab, setActiveTab] = useState<'inventory' | 'brankas' | 'condition'>('inventory');
  
  useEffect(() => {
    if (isOpen) {
      if (initialScheduleId && schedules.some(s => s.id === initialScheduleId)) {
        setSelectedScheduleId(initialScheduleId);
      } else if (!selectedScheduleId || !schedules.some(s => s.id === selectedScheduleId)) {
        const available = schedules.filter(s => s.status !== 'Selesai');
        setSelectedScheduleId(available[0]?.id || schedules[0]?.id || '');
      }
    }
  }, [isOpen, initialScheduleId, schedules]);

  const selectedSchedule = schedules.find(s => s.id === selectedScheduleId) || schedules[0];

  const [isCopiedWA, setIsCopiedWA] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showSuccessWAScreen, setShowSuccessWAScreen] = useState(false);
  const [submittedWaText, setSubmittedWaText] = useState('');

  // Auto-draft indicator & explanation modal state
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [hasExistingDraft, setHasExistingDraft] = useState(false);
  const [draftSavedTimestamp, setDraftSavedTimestamp] = useState<string | null>(null);
  const [showDraftExplanationModal, setShowDraftExplanationModal] = useState(false);

  // Validation prompt state before saving
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [pendingMissingFields, setPendingMissingFields] = useState<string[]>([]);

  // 1. Management Personnel
  const [namaAM, setNamaAM] = useState('');
  const [namaAS, setNamaAS] = useState('');
  const [namaPimpinanShift, setNamaPimpinanShift] = useState('');

  // 2. SO Time
  const [startTime, setStartTime] = useState('22:00');
  const [endTime, setEndTime] = useState('04:30');

  // 3. Simple Overall Inventory Totals (Direct Inputs - No per-category table)
  const [systemValueTotalRp, setSystemValueTotalRp] = useState<number>(0);
  const [physicalValueTotalRp, setPhysicalValueTotalRp] = useState<number>(0);
  const [systemQtyTotal, setSystemQtyTotal] = useState<number>(0);
  const [physicalQtyTotal, setPhysicalQtyTotal] = useState<number>(0);

  // Auto Calculations for Overall Inventory
  const rawVarianceVal = physicalValueTotalRp - systemValueTotalRp;
  const totalVarianceQty = physicalQtyTotal - systemQtyTotal;
  const accuracyRate = systemValueTotalRp > 0 
    ? +((1 - Math.abs(rawVarianceVal) / systemValueTotalRp) * 100).toFixed(2)
    : 100;

  // 4. NK & NL Adjustment
  const [notaKurangNKValRp, setNotaKurangNKValRp] = useState<number>(0);
  const [notaLebihNLValRp, setNotaLebihNLValRp] = useState<number>(0);
  const [customNKLItems, setCustomNKLItems] = useState<CustomNKLItem[]>([]);

  // 5. Brankas Audit State
  const [kasTokoFinanceRp, setKasTokoFinanceRp] = useState<number>(0);
  const [fisikKasBrankasRp, setFisikKasBrankasRp] = useState<number>(0);
  const [fisikKasKasiranRp, setFisikKasKasiranRp] = useState<number>(0);

  // Target Uang Sales Breakdown by Nama Kasir (Data Tutup Shift)
  const [salesAnak1Rp, setSalesAnak1Rp] = useState<number>(0);
  const [salesAnak2Rp, setSalesAnak2Rp] = useState<number>(0);
  const [salesAnak3Rp, setSalesAnak3Rp] = useState<number>(0);
  const [salesAnak4Rp, setSalesAnak4Rp] = useState<number>(0);
  const [salesPointCoffeeRp, setSalesPointCoffeeRp] = useState<number>(0);
  const [salesKompIndukRp, setSalesKompIndukRp] = useState<number>(0);
  const [salesKemarinRp, setSalesKemarinRp] = useState<number>(0);
  const [uangSalesTutupShiftRp, setUangSalesTutupShiftRp] = useState<number>(0);

  // Fisik Uang Sales Breakdown by Nama Kasir / Shift
  const [fisikSalesKompIndukRp, setFisikSalesKompIndukRp] = useState<number>(0);
  const [fisikSalesAnak1Rp, setFisikSalesAnak1Rp] = useState<number>(0);
  const [fisikSalesAnak2Rp, setFisikSalesAnak2Rp] = useState<number>(0);
  const [fisikSalesAnak3Rp, setFisikSalesAnak3Rp] = useState<number>(0);
  const [fisikSalesAnak4Rp, setFisikSalesAnak4Rp] = useState<number>(0);
  const [fisikSalesPointCoffeeRp, setFisikSalesPointCoffeeRp] = useState<number>(0);
  const [fisikSalesKemarinRp, setFisikSalesKemarinRp] = useState<number>(0);

  // Auto-calculate total Target Sales from Kasir breakdown + Target Sales Kemarin
  useEffect(() => {
    const totalTarget = (salesAnak1Rp || 0) + (salesAnak2Rp || 0) + (salesAnak3Rp || 0) + (salesAnak4Rp || 0) + (salesPointCoffeeRp || 0) + (salesKompIndukRp || 0) + (salesKemarinRp || 0);
    setUangSalesTutupShiftRp(totalTarget);
  }, [salesAnak1Rp, salesAnak2Rp, salesAnak3Rp, salesAnak4Rp, salesPointCoffeeRp, salesKompIndukRp, salesKemarinRp]);

  const [customBrankasItems, setCustomBrankasItems] = useState<CustomBrankasItem[]>([
    { id: '1', label: 'Adanya Nota', type: 'plus', amountRp: 0 },
    { id: '2', label: 'BA Varian', type: 'plus', amountRp: 0 }
  ]);

  // 6. Top 5 Item Plus & Minus
  const [top5Plus, setTop5Plus] = useState<Top5Item[]>([
    { plu: '', description: '', valueRp: 0 },
    { plu: '', description: '', valueRp: 0 },
    { plu: '', description: '', valueRp: 0 },
    { plu: '', description: '', valueRp: 0 },
    { plu: '', description: '', valueRp: 0 }
  ]);

  const [top5Minus, setTop5Minus] = useState<Top5Item[]>([
    { plu: '', description: '', valueRp: 0 },
    { plu: '', description: '', valueRp: 0 },
    { plu: '', description: '', valueRp: 0 },
    { plu: '', description: '', valueRp: 0 },
    { plu: '', description: '', valueRp: 0 }
  ]);

  // 7. Store Condition Checks
  const [storeCondition, setStoreCondition] = useState<StoreConditionCheck>({
    gudangKolian: 'Rapi',
    gudangRak: 'Rapi',
    areaToko: 'Rapi',
    iceCreamFrozen: 'Rapi'
  });

  // 8. Operational Checks
  const [opCheck, setOpCheck] = useState<OperationalCheck>({
    bpbBelumDiproses: 'Tidak',
    returBelumDikirimDC: 'Tidak',
    cekKirimanDenganAlat: 'Ya'
  });

  const [itemTidakTerdisplayCount, setItemTidakTerdisplayCount] = useState<number>(0);

  // WDCP / PDA Hardware State
  const [wdcpTotal, setWdcpTotal] = useState<number>(0);
  const [wdcpWorking, setWdcpWorking] = useState<number>(0);
  const [wdcpBroken, setWdcpBroken] = useState<number>(0);

  // 9. CCTV Checks
  const [cctvCheck, setCctvCheck] = useState<CCTVCheck>({
    dvrStatus: 'Berfungsi',
    kameraStatus: 'Berfungsi',
    lcdStatus: 'Berfungsi'
  });

  // 10. Notes & Photo
  const [notes, setNotes] = useState('');
  const [evidencePhotoUrl, setEvidencePhotoUrl] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Format draft saved date & time
  const formatDraftDate = (timestamp: number) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' WIB';
    } catch {
      return 'Tersimpan';
    }
  };

  // RESTORE DRAFT FROM LOCALSTORAGE
  useEffect(() => {
    if (!selectedScheduleId || !isOpen) return;
    const draftKey = `so_input_draft_${selectedScheduleId}`;
    const rawDraft = localStorage.getItem(draftKey);
    if (rawDraft) {
      try {
        const parsed = JSON.parse(rawDraft);
        if (parsed && parsed.data) {
          const d = parsed.data;
          if (d.namaAM !== undefined) setNamaAM(d.namaAM);
          if (d.namaAS !== undefined) setNamaAS(d.namaAS);
          if (d.namaPimpinanShift !== undefined) setNamaPimpinanShift(d.namaPimpinanShift);
          if (d.startTime !== undefined) setStartTime(d.startTime);
          if (d.endTime !== undefined) setEndTime(d.endTime);
          if (d.systemValueTotalRp !== undefined) setSystemValueTotalRp(d.systemValueTotalRp);
          if (d.physicalValueTotalRp !== undefined) setPhysicalValueTotalRp(d.physicalValueTotalRp);
          if (d.systemQtyTotal !== undefined) setSystemQtyTotal(d.systemQtyTotal);
          if (d.physicalQtyTotal !== undefined) setPhysicalQtyTotal(d.physicalQtyTotal);
          if (d.notaKurangNKValRp !== undefined) setNotaKurangNKValRp(d.notaKurangNKValRp);
          if (d.notaLebihNLValRp !== undefined) setNotaLebihNLValRp(d.notaLebihNLValRp);
          if (d.customNKLItems) setCustomNKLItems(d.customNKLItems);
          if (d.kasTokoFinanceRp !== undefined) setKasTokoFinanceRp(d.kasTokoFinanceRp);
          if (d.fisikKasBrankasRp !== undefined) setFisikKasBrankasRp(d.fisikKasBrankasRp);
          if (d.fisikKasKasiranRp !== undefined) setFisikKasKasiranRp(d.fisikKasKasiranRp);
          if (d.salesAnak1Rp !== undefined) setSalesAnak1Rp(d.salesAnak1Rp);
          if (d.salesAnak2Rp !== undefined) setSalesAnak2Rp(d.salesAnak2Rp);
          if (d.salesAnak3Rp !== undefined) setSalesAnak3Rp(d.salesAnak3Rp);
          if (d.salesAnak4Rp !== undefined) setSalesAnak4Rp(d.salesAnak4Rp);
          if (d.salesPointCoffeeRp !== undefined) setSalesPointCoffeeRp(d.salesPointCoffeeRp);
          if (d.salesKompIndukRp !== undefined) setSalesKompIndukRp(d.salesKompIndukRp);
          if (d.salesKemarinRp !== undefined) setSalesKemarinRp(d.salesKemarinRp);
          if (d.uangSalesTutupShiftRp !== undefined) setUangSalesTutupShiftRp(d.uangSalesTutupShiftRp);
          if (d.fisikSalesKompIndukRp !== undefined) setFisikSalesKompIndukRp(d.fisikSalesKompIndukRp);
          else if (d.fisikSalesIndukRp !== undefined) setFisikSalesKompIndukRp(d.fisikSalesIndukRp);
          if (d.fisikSalesAnak1Rp !== undefined) setFisikSalesAnak1Rp(d.fisikSalesAnak1Rp);
          if (d.fisikSalesAnak2Rp !== undefined) setFisikSalesAnak2Rp(d.fisikSalesAnak2Rp);
          if (d.fisikSalesAnak3Rp !== undefined) setFisikSalesAnak3Rp(d.fisikSalesAnak3Rp);
          if (d.fisikSalesAnak4Rp !== undefined) setFisikSalesAnak4Rp(d.fisikSalesAnak4Rp);
          if (d.fisikSalesPointCoffeeRp !== undefined) setFisikSalesPointCoffeeRp(d.fisikSalesPointCoffeeRp);
          if (d.fisikSalesKemarinRp !== undefined) setFisikSalesKemarinRp(d.fisikSalesKemarinRp);
          if (d.customBrankasItems) setCustomBrankasItems(d.customBrankasItems);
          if (d.top5Plus) setTop5Plus(d.top5Plus);
          if (d.top5Minus) setTop5Minus(d.top5Minus);
          if (d.storeCondition) setStoreCondition(d.storeCondition);
          if (d.opCheck) setOpCheck(d.opCheck);
          if (d.itemTidakTerdisplayCount !== undefined) setItemTidakTerdisplayCount(d.itemTidakTerdisplayCount);
          if (d.wdcpTotal !== undefined) setWdcpTotal(d.wdcpTotal);
          if (d.wdcpWorking !== undefined) setWdcpWorking(d.wdcpWorking);
          if (d.wdcpBroken !== undefined) setWdcpBroken(d.wdcpBroken);
          if (d.cctvCheck) setCctvCheck(d.cctvCheck);
          if (d.notes !== undefined) setNotes(d.notes);
          if (d.evidencePhotoUrl) setEvidencePhotoUrl(d.evidencePhotoUrl);

          setHasRestoredDraft(true);
          setHasExistingDraft(true);
          if (parsed.timestamp) {
            setDraftSavedTimestamp(formatDraftDate(parsed.timestamp));
          }
        }
      } catch (err) {
        console.error('Failed to parse draft from localStorage', err);
      }
    } else {
      setHasRestoredDraft(false);
      setHasExistingDraft(false);
      setDraftSavedTimestamp(null);
    }
  }, [selectedScheduleId, isOpen]);

  // PERSIST AUTO-DRAFT TO LOCALSTORAGE
  useEffect(() => {
    if (!isOpen || !selectedScheduleId) return;
    const draftKey = `so_input_draft_${selectedScheduleId}`;
    const draftPayload = {
      timestamp: Date.now(),
      scheduleId: selectedScheduleId,
      storeCode: selectedSchedule?.storeCode,
      storeName: selectedSchedule?.storeName,
      data: {
        namaAM,
        namaAS,
        namaPimpinanShift,
        startTime,
        endTime,
        systemValueTotalRp,
        physicalValueTotalRp,
        systemQtyTotal,
        physicalQtyTotal,
        notaKurangNKValRp,
        notaLebihNLValRp,
        customNKLItems,
        kasTokoFinanceRp,
        fisikKasBrankasRp,
        fisikKasKasiranRp,
        salesAnak1Rp,
        salesAnak2Rp,
        salesAnak3Rp,
        salesAnak4Rp,
        salesPointCoffeeRp,
        salesKompIndukRp,
        salesKemarinRp,
        uangSalesTutupShiftRp,
        fisikSalesKompIndukRp,
        fisikSalesAnak1Rp,
        fisikSalesAnak2Rp,
        fisikSalesAnak3Rp,
        fisikSalesAnak4Rp,
        fisikSalesPointCoffeeRp,
        fisikSalesKemarinRp,
        customBrankasItems,
        top5Plus,
        top5Minus,
        storeCondition,
        opCheck,
        itemTidakTerdisplayCount,
        wdcpTotal,
        wdcpWorking,
        wdcpBroken,
        cctvCheck,
        notes,
        evidencePhotoUrl
      }
    };
    localStorage.setItem(draftKey, JSON.stringify(draftPayload));
  }, [
    isOpen,
    selectedScheduleId,
    namaAM,
    namaAS,
    namaPimpinanShift,
    startTime,
    endTime,
    systemValueTotalRp,
    physicalValueTotalRp,
    systemQtyTotal,
    physicalQtyTotal,
    notaKurangNKValRp,
    notaLebihNLValRp,
    customNKLItems,
    kasTokoFinanceRp,
    fisikKasBrankasRp,
    fisikKasKasiranRp,
    salesAnak1Rp,
    salesAnak2Rp,
    salesAnak3Rp,
    salesAnak4Rp,
    salesPointCoffeeRp,
    salesKompIndukRp,
    salesKemarinRp,
    uangSalesTutupShiftRp,
    fisikSalesKompIndukRp,
    fisikSalesAnak1Rp,
    fisikSalesAnak2Rp,
    fisikSalesAnak3Rp,
    fisikSalesAnak4Rp,
    fisikSalesPointCoffeeRp,
    fisikSalesKemarinRp,
    customBrankasItems,
    top5Plus,
    top5Minus,
    storeCondition,
    opCheck,
    itemTidakTerdisplayCount,
    wdcpTotal,
    wdcpWorking,
    wdcpBroken,
    cctvCheck,
    notes,
    evidencePhotoUrl
  ]);

  // MANUAL SAVE DRAFT HANDLER
  const handleManualSaveDraft = (showModal: boolean = true) => {
    if (!selectedSchedule) {
      alert('Mohon pilih Toko & Jadwal SO terlebih dahulu sebelum menyimpan draft.');
      return;
    }
    const draftKey = `so_input_draft_${selectedSchedule.id}`;
    const now = Date.now();
    const draftPayload = {
      timestamp: now,
      scheduleId: selectedSchedule.id,
      storeCode: selectedSchedule.storeCode,
      storeName: selectedSchedule.storeName,
      data: {
        namaAM,
        namaAS,
        namaPimpinanShift,
        startTime,
        endTime,
        systemValueTotalRp,
        physicalValueTotalRp,
        systemQtyTotal,
        physicalQtyTotal,
        notaKurangNKValRp,
        notaLebihNLValRp,
        customNKLItems,
        kasTokoFinanceRp,
        fisikKasBrankasRp,
        fisikKasKasiranRp,
        salesAnak1Rp,
        salesAnak2Rp,
        salesAnak3Rp,
        salesAnak4Rp,
        salesPointCoffeeRp,
        salesKompIndukRp,
        salesKemarinRp,
        uangSalesTutupShiftRp,
        fisikSalesKompIndukRp,
        fisikSalesAnak1Rp,
        fisikSalesAnak2Rp,
        fisikSalesAnak3Rp,
        fisikSalesAnak4Rp,
        fisikSalesPointCoffeeRp,
        fisikSalesKemarinRp,
        customBrankasItems,
        top5Plus,
        top5Minus,
        storeCondition,
        opCheck,
        itemTidakTerdisplayCount,
        wdcpTotal,
        wdcpWorking,
        wdcpBroken,
        cctvCheck,
        notes,
        evidencePhotoUrl
      }
    };
    localStorage.setItem(draftKey, JSON.stringify(draftPayload));
    const formatted = formatDraftDate(now);
    setDraftSavedTimestamp(formatted);
    setHasExistingDraft(true);
    setHasRestoredDraft(true);

    if (showModal) {
      setShowDraftExplanationModal(true);
    } else {
      triggerToast('💾 Draft tersimpan di browser perangkat ini!');
    }
  };

  // RESET / DELETE DRAFT HANDLER
  const handleClearDraft = () => {
    if (selectedScheduleId) {
      localStorage.removeItem(`so_input_draft_${selectedScheduleId}`);
    }
    setNamaAM('');
    setNamaAS('');
    setNamaPimpinanShift('');
    setSystemValueTotalRp(0);
    setPhysicalValueTotalRp(0);
    setSystemQtyTotal(0);
    setPhysicalQtyTotal(0);
    setNotaKurangNKValRp(0);
    setNotaLebihNLValRp(0);
    setCustomNKLItems([]);
    setKasTokoFinanceRp(0);
    setFisikKasBrankasRp(0);
    setFisikKasKasiranRp(0);
    setSalesAnak1Rp(0);
    setSalesAnak2Rp(0);
    setSalesAnak3Rp(0);
    setSalesAnak4Rp(0);
    setSalesPointCoffeeRp(0);
    setSalesKompIndukRp(0);
    setUangSalesTutupShiftRp(0);
    setFisikSalesKompIndukRp(0);
    setFisikSalesAnak1Rp(0);
    setFisikSalesAnak2Rp(0);
    setFisikSalesAnak3Rp(0);
    setFisikSalesAnak4Rp(0);
    setFisikSalesPointCoffeeRp(0);
    setFisikSalesKemarinRp(0);
    setCustomBrankasItems([
      { id: '1', label: 'Adanya Nota', type: 'plus', amountRp: 0 },
      { id: '2', label: 'BA Varian', type: 'plus', amountRp: 0 }
    ]);
    setTop5Plus([
      { plu: '', description: '', valueRp: 0 },
      { plu: '', description: '', valueRp: 0 },
      { plu: '', description: '', valueRp: 0 },
      { plu: '', description: '', valueRp: 0 },
      { plu: '', description: '', valueRp: 0 }
    ]);
    setTop5Minus([
      { plu: '', description: '', valueRp: 0 },
      { plu: '', description: '', valueRp: 0 },
      { plu: '', description: '', valueRp: 0 },
      { plu: '', description: '', valueRp: 0 },
      { plu: '', description: '', valueRp: 0 }
    ]);
    setItemTidakTerdisplayCount(0);
    setWdcpTotal(0);
    setWdcpWorking(0);
    setWdcpBroken(0);
    setNotes('');
    setEvidencePhotoUrl('');
    setHasRestoredDraft(false);
    setHasExistingDraft(false);
    setDraftSavedTimestamp(null);
    triggerToast('🔄 Draft pada perangkat ini berhasil dihapus.');
  };

  if (!isOpen) return null;

  // Custom Toast Trigger
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Generate WA Text
  const generateCurrentWaText = () => {
    if (!selectedSchedule) return '';
    const totalFisikKas = (fisikKasBrankasRp || 0) + (fisikKasKasiranRp || 0);
    const totalFisikSalesRp = (fisikSalesKompIndukRp || 0) + (fisikSalesAnak1Rp || 0) + (fisikSalesAnak2Rp || 0) + (fisikSalesAnak3Rp || 0) + (fisikSalesAnak4Rp || 0) + (fisikSalesPointCoffeeRp || 0) + (fisikSalesKemarinRp || 0);

    return generateWAShareText({
      storeCode: selectedSchedule.storeCode,
      storeName: selectedSchedule.storeName,
      region: selectedSchedule.region,
      soDate: selectedSchedule.scheduledDate,
      startTime,
      endTime,
      officerInCharge: selectedSchedule.officerInCharge,
      executedByTeam: selectedSchedule.teamName,
      namaAM,
      namaAS,
      namaPimpinanShift,
      notaKurangNKValRp,
      notaLebihNLValRp,
      customNKLItems,
      nettNKLValRp,
      totalSKUChecked: selectedSchedule.targetSKUCount,
      systemValueTotalRp,
      physicalValueTotalRp,
      varianceValueTotalRp: rawVarianceVal,
      accuracyRatePercentage: accuracyRate,
      top5Plus,
      top5Minus,
      kasTokoFinanceRp,
      fisikKasTotalRp: totalFisikKas,
      selisihKasTokoRp,
      uangSalesTutupShiftRp,
      salesTotalRp: totalFisikSalesRp,
      selisihSalesRp,
      nettSOBrankasRp,
      storeCondition,
      cctvCheck,
      opCheck,
      itemTidakTerdisplayCount,
      wdcpAudit: {
        totalUnits: wdcpTotal,
        workingUnits: wdcpWorking,
        brokenUnits: wdcpBroken
      },
      notes: notes || 'Input rekapan hasil SO lengkap.'
    });
  };

  // WhatsApp Copy Handler
  const handleCopyCurrentWA = async () => {
    const text = generateCurrentWaText();
    const success = await copyToClipboard(text);
    if (success) {
      setIsCopiedWA(true);
      triggerToast('✅ Format laporan WA berhasil disalin!');
      setTimeout(() => setIsCopiedWA(false), 2500);
    } else {
      triggerToast('❌ Gagal menyalin. Silahkan gunakan tombol Bagikan WA.');
    }
  };

  const handleShareCurrentWA = () => {
    const text = generateCurrentWaText();
    openWAShareUrl(text);
  };

  // Top 5 Helpers
  const updateTop5Plus = (index: number, field: keyof Top5Item, value: any) => {
    const updated = [...top5Plus];
    updated[index] = { ...updated[index], [field]: value };
    setTop5Plus(updated);
  };

  const updateTop5Minus = (index: number, field: keyof Top5Item, value: any) => {
    const updated = [...top5Minus];
    updated[index] = { ...updated[index], [field]: value };
    setTop5Minus(updated);
  };

  // NKL Adjustments Helpers
  const addCustomNKLItem = () => {
    setCustomNKLItems([
      ...customNKLItems,
      { id: String(Date.now()), label: '', type: 'minus', amountRp: 0 }
    ]);
  };

  const removeCustomNKLItem = (id: string) => {
    setCustomNKLItems(customNKLItems.filter(i => i.id !== id));
  };

  const updateCustomNKLItem = (id: string, field: keyof CustomNKLItem, value: any) => {
    setCustomNKLItems(customNKLItems.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  // Brankas Helpers
  const addCustomBrankasItem = () => {
    setCustomBrankasItems([
      ...customBrankasItems,
      { id: String(Date.now()), label: '', type: 'plus', amountRp: 0 }
    ]);
  };

  const removeCustomBrankasItem = (id: string) => {
    setCustomBrankasItems(customBrankasItems.filter(i => i.id !== id));
  };

  const updateCustomBrankasItem = (id: string, field: keyof CustomBrankasItem, value: any) => {
    setCustomBrankasItems(customBrankasItems.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  // Calculations
  const customNKLPlusTotal = customNKLItems.filter(i => i.type === 'plus').reduce((sum, i) => sum + i.amountRp, 0);
  const customNKLMinusTotal = customNKLItems.filter(i => i.type === 'minus').reduce((sum, i) => sum + i.amountRp, 0);
  const totalNL = notaLebihNLValRp + customNKLPlusTotal;
  const totalNK = notaKurangNKValRp + customNKLMinusTotal;
  const nettNKLValRp = totalNL - totalNK;

  const totalFisikKas = (fisikKasBrankasRp || 0) + (fisikKasKasiranRp || 0);
  const selisihKasTokoRp = totalFisikKas - (kasTokoFinanceRp || 0);

  // Fisik Sales breakdown sum
  const totalFisikSalesAnak = (fisikSalesAnak1Rp || 0) + (fisikSalesAnak2Rp || 0) + (fisikSalesAnak3Rp || 0) + (fisikSalesAnak4Rp || 0);
  const totalFisikSalesRp = (fisikSalesKompIndukRp || 0) + totalFisikSalesAnak + (fisikSalesPointCoffeeRp || 0) + (fisikSalesKemarinRp || 0);
  const selisihSalesRp = totalFisikSalesRp - (uangSalesTutupShiftRp || 0);

  const customBrankasPlusTotal = customBrankasItems.filter(i => i.type === 'plus').reduce((sum, i) => sum + i.amountRp, 0);
  const customBrankasMinusTotal = customBrankasItems.filter(i => i.type === 'minus').reduce((sum, i) => sum + i.amountRp, 0);
  const customBrankasNet = customBrankasPlusTotal - customBrankasMinusTotal;

  // Rumus Total Seluruh Fisik Uang + Nota/Lainnya (-) Total Seluruh Target Finance & Tutup Shift
  const totalSeluruhFisikUangRp = totalFisikKas + totalFisikSalesRp;
  const totalSeluruhTargetUangRp = (kasTokoFinanceRp || 0) + (uangSalesTutupShiftRp || 0);
  const nettSOBrankasRp = (totalSeluruhFisikUangRp + customBrankasNet) - totalSeluruhTargetUangRp;

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    try {
      const url = await uploadToCloudinary(file, 'so_evidence');
      setEvidencePhotoUrl(url);
      triggerToast('📸 Foto bukti berhasil diupload!');
    } catch (err: any) {
      alert(err.message || 'Gagal upload foto ke Cloudinary');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Check form completeness before final submission
  const validateAndProceed = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSchedule) {
      alert('Mohon pilih Toko & Jadwal SO terlebih dahulu.');
      return;
    }

    const missing: string[] = [];
    if (!namaAM.trim()) missing.push('Nama Area Manager (AM)');
    if (!namaAS.trim()) missing.push('Nama Area Supervisor (AS)');
    if (!namaPimpinanShift.trim()) missing.push('Nama Pimpinan Shift / Head Store');
    if (!notes.trim()) missing.push('Catatan / Penjelasan Selisih Korlap');

    if (missing.length > 0) {
      setPendingMissingFields(missing);
      setShowValidationModal(true);
    } else {
      executeFinalSubmit();
    }
  };

  // Execution of actual save operation
  const executeFinalSubmit = () => {
    if (!selectedSchedule) return;

    const baNumber = `BA-SO/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${Math.floor(1000 + Math.random() * 9000)}`;

    const brankasReport: BrankasAuditReport = {
      kasTokoFinanceRp,
      fisikKasBrankasRp,
      fisikKasKasiranRp,
      selisihKasTokoRp,
      uangSalesTutupShiftRp,
      salesAnak1Rp,
      salesAnak2Rp,
      salesAnak3Rp,
      salesAnak4Rp,
      salesPointCoffeeRp,
      salesKompIndukRp,
      salesKemarinRp,
      fisikSalesKompIndukRp,
      fisikSalesAnak1Rp,
      fisikSalesAnak2Rp,
      fisikSalesAnak3Rp,
      fisikSalesAnak4Rp,
      fisikSalesPointCoffeeRp,
      fisikSalesIndukRp: fisikSalesKompIndukRp || 0,
      fisikSalesAnakRp: totalFisikSalesAnak,
      fisikSalesKemarinRp,
      totalFisikSalesRp,
      selisihSalesRp,
      customBrankasItems: customBrankasItems.filter(i => i.label.trim() !== ''),
      nettSOBrankasRp
    };

    const waTextToShare = generateCurrentWaText();
    setSubmittedWaText(waTextToShare);

    onCreateResult({
      scheduleId: selectedSchedule.id,
      storeId: selectedSchedule.storeId,
      storeCode: selectedSchedule.storeCode,
      storeName: selectedSchedule.storeName,
      region: selectedSchedule.region,
      soDate: selectedSchedule.scheduledDate,
      executedByTeam: selectedSchedule.teamName,
      spvApprover: 'Gean Pratama (SPV SO)',
      assignedPersonnelNames: selectedSchedule.assignedPersonnelNames,

      namaAM,
      namaAS,
      namaPimpinanShift,

      notaKurangNKValRp,
      notaLebihNLValRp,
      customNKLItems: customNKLItems
        .filter(i => (i.label && i.label.trim() !== '') || (i.amountRp && i.amountRp > 0))
        .map(i => ({
          ...i,
          label: i.label && i.label.trim() !== '' ? i.label.trim() : (i.type === 'plus' ? 'Penyesuaian NL (Plus)' : 'Penyesuaian NK (Minus)')
        })),
      nettNKLValRp,

      storeCondition,
      opCheck,
      itemTidakTerdisplayCount,
      wdcpAudit: {
        totalUnits: wdcpTotal,
        workingUnits: wdcpWorking,
        brokenUnits: wdcpBroken
      },
      cctvCheck,

      startTime,
      endTime,

      brankasReport,

      top5Plus: top5Plus.filter(i => i.plu.trim() !== ''),
      top5Minus: top5Minus.filter(i => i.plu.trim() !== ''),

      totalSKUChecked: selectedSchedule.targetSKUCount,
      systemQtyTotal,
      physicalQtyTotal,
      varianceQtyTotal: physicalQtyTotal - systemQtyTotal,
      systemValueTotalRp,
      physicalValueTotalRp,
      varianceValueTotalRp: rawVarianceVal,
      accuracyRatePercentage: accuracyRate,
      approvalStatus: 'Menunggu Approval SPV',
      categoryBreakdown: [],
      notesAndActionPlan: notes || 'Input rekapan hasil SO lengkap.',
      baNumber,
      evidencePhotoUrl: evidencePhotoUrl || undefined
    });

    if (selectedScheduleId) {
      localStorage.removeItem(`so_input_draft_${selectedScheduleId}`);
    }

    setShowValidationModal(false);
    setShowSuccessWAScreen(true);
  };

  // ---------------- SUCCESS SCREEN FOR WA SHARE ----------------
  if (showSuccessWAScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
        <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-5 sm:p-6 space-y-4 my-auto animate-in fade-in zoom-in-95 duration-150">
          
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
              Rekapan SO Berhasil Disimpan & Tersinkron!
            </h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Laporan telah tersimpan ke sistem. Anda bisa langsung menyalin format teks di bawah untuk dikirim ke WhatsApp Group Korlap & SPV.
            </p>
          </div>

          {/* Formatted WA Message Box */}
          <div className="bg-slate-950 text-emerald-400 p-3.5 rounded-xl border border-slate-800 text-[11px] font-mono whitespace-pre-wrap max-h-56 overflow-y-auto shadow-inner leading-relaxed select-all">
            {submittedWaText}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={async () => {
                const success = await copyToClipboard(submittedWaText);
                if (success) {
                  setIsCopiedWA(true);
                  triggerToast('✅ Format WA berhasil disalin ke clipboard!');
                  setTimeout(() => setIsCopiedWA(false), 2500);
                } else {
                  triggerToast('❌ Gagal menyalin.');
                }
              }}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[44px]"
            >
              {isCopiedWA ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
              <span>{isCopiedWA ? 'Berhasil Disalin!' : 'Salin Teks WA'}</span>
            </button>

            <button
              type="button"
              onClick={() => openWAShareUrl(submittedWaText)}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm min-h-[44px]"
            >
              <Share2 className="w-4 h-4" />
              <span>Kirim Ke WA Group</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowSuccessWAScreen(false);
                onClose();
              }}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition min-h-[44px]"
            >
              Tutup Modal
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center sm:p-3 overflow-y-auto">
      {/* Toast Notification Floating Banner */}
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-60 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* DRAFT EXPLANATION & CONFIRMATION MODAL */}
      {showDraftExplanationModal && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            
            {/* Top Header */}
            <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-inner">
                  <BookmarkCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm sm:text-base leading-tight">Draft Berhasil Disimpan!</h4>
                  <p className="text-[11px] text-amber-100 font-medium">Tersimpan di memori browser perangkat ini</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDraftExplanationModal(false)}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-5 space-y-3.5 text-xs text-slate-700">
              
              {/* Store & Time Badge */}
              {selectedSchedule && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-amber-950">
                  <div>
                    <span className="text-[10px] font-bold text-amber-700 uppercase block">Toko Draft:</span>
                    <span className="font-black text-xs">[{selectedSchedule.storeCode}] {selectedSchedule.storeName}</span>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] font-bold text-amber-700 uppercase block">Waktu Simpan:</span>
                    <span className="font-bold text-xs">{draftSavedTimestamp || 'Baru Saja'}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h5 className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-indigo-600" />
                  <span>Cara Kerja & Keamanan Fitur Draft:</span>
                </h5>

                <div className="grid grid-cols-1 gap-2">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5">
                    <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg shrink-0 mt-0.5">
                      <HardDrive className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <strong className="text-slate-900 text-[11px] block">1. Tersimpan di Memori Browser HP / Laptop Anda</strong>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Seluruh angka (inventori, rincian NK/NL, brankas, kasir, kondisi toko, CCTV, dan catatan) tersimpan di penyimpanan internal browser (<em>LocalStorage</em>).
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5">
                    <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg shrink-0 mt-0.5">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <strong className="text-slate-900 text-[11px] block">2. Sangat Aman Saat Ada Urusan Mendadak di Toko</strong>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Jika di sela-sela input SO Anda harus melayani toko, menerima barang datang, atau ada urusan darurat, Anda bisa <strong>menutup form ini atau me-refresh browser dengan tenang</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5">
                    <div className="p-1.5 bg-indigo-100 text-indigo-800 rounded-lg shrink-0 mt-0.5">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <strong className="text-slate-900 text-[11px] block">3. Otomatis Terisi Kembali Kapan Saja</strong>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Saat Anda kembali membuka menu <em>Input Rekapan SO</em> dan memilih toko ini di perangkat yang sama, seluruh inputan Anda otomatis dipulihkan tanpa hilang.
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5">
                    <div className="p-1.5 bg-blue-100 text-blue-800 rounded-lg shrink-0 mt-0.5">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <strong className="text-slate-900 text-[11px] block">4. Pembersihan Otomatis Saat Kirim Rekapan SO</strong>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Setelah rekapan selesai lengkap dan Anda menekan tombol <strong>"Simpan Rekapan SO"</strong>, draft lokal akan otomatis dibersihkan dan hasil SO resmi tersinkron ke SPV.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowDraftExplanationModal(false);
                    onClose();
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[42px] cursor-pointer"
                >
                  <span>Tutup Form (Keluar Aman)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDraftExplanationModal(false)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm min-h-[42px] cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Lanjut Mengisi Form</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* VALIDATION QUESTION MODAL (If fields are missing) */}
      {showValidationModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">Beberapa Informasi Belum Diisi</h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Kami mendeteksi field berikut masih kosong:
                </p>
                <ul className="mt-2 space-y-1 text-xs text-amber-800 font-medium bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  {pendingMissingFields.map((f, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <span>•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-slate-500 mt-2">
                  Apakah Anda ingin melengkapinya terlebih dahulu atau tetap menyimpan?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowValidationModal(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition"
              >
                Lengkapi Dulu
              </button>
              <button
                type="button"
                onClick={executeFinalSubmit}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm"
              >
                Tetap Simpan Rekapan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN MODAL CONTAINER (Optimized for Mobile) */}
      <div className="bg-white w-full h-full sm:h-auto sm:max-w-3xl sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden sm:my-4 animate-in fade-in duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-3.5 px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <ClipboardCheck className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <h3 className="font-extrabold text-xs sm:text-sm">Input Rekapan Hasil Stock Opname</h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400">Toko, Selisih, Audit Brankas & CCTV Hari-H</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleManualSaveDraft(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 border border-amber-500/40 text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Simpan draft sementara ke memori browser perangkat ini"
            >
              <Save className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Buat Draft</span>
              <span className="sm:hidden">Draft</span>
            </button>

            {hasRestoredDraft && (
              <button
                type="button"
                onClick={handleClearDraft}
                className="text-slate-400 hover:text-rose-300 text-[10px] font-bold underline px-2 py-1 rounded hover:bg-rose-950/40 transition flex items-center gap-1 cursor-pointer"
                title="Reset/hapus draft inputan saat ini"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Reset Draft</span>
              </button>
            )}

            <button 
              type="button"
              onClick={onClose}
              className="text-slate-200 hover:text-white px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Tutup Modal (Draft Otomatis Tersimpan di Browser)"
            >
              <span>Tutup</span>
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Schedule Selector & Store Header */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 shrink-0 space-y-2.5">
          {hasRestoredDraft && (
            <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl p-2.5 px-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-start sm:items-center gap-2 font-medium text-[11px]">
                <HardDrive className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <strong>Draft Tersimpan di Memori Perangkat:</strong> Data sementara toko ini dimuat otomatis ({draftSavedTimestamp || 'Aktif'}). Aman jika browser di-refresh / ditutup.
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setShowDraftExplanationModal(true)}
                  className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <Info className="w-3 h-3 text-indigo-600" />
                  <span>Cara Kerja Draft</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearDraft}
                  className="text-[10px] font-bold text-rose-800 hover:text-rose-950 bg-rose-100 hover:bg-rose-200 border border-rose-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                >
                  Hapus Draft
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <SearchableScheduleSelect
              schedules={schedules}
              selectedScheduleId={selectedScheduleId}
              onSelectSchedule={(sch) => setSelectedScheduleId(sch.id)}
              label="Pilih Toko & Jadwal SO"
              required
            />

            {selectedSchedule && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-2.5 flex items-center justify-between text-indigo-950 text-xs">
                <div>
                  <span className="text-[10px] text-indigo-600 font-bold uppercase block">Toko SO</span>
                  <span className="font-black">[{selectedSchedule.storeCode}] {selectedSchedule.storeName}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-indigo-600 font-bold uppercase block">Wilayah / Tim</span>
                  <span className="font-bold">{selectedSchedule.region.split(' ')[0]} • {selectedSchedule.teamName}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="border-b border-slate-200 bg-white px-3 sm:px-6 flex items-center gap-1 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`py-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition whitespace-nowrap min-h-[42px] ${
              activeTab === 'inventory' 
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            1. Inventori & NKL
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('brankas')}
            className={`py-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition whitespace-nowrap min-h-[42px] ${
              activeTab === 'brankas' 
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            2. Audit Brankas
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('condition')}
            className={`py-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition whitespace-nowrap min-h-[42px] ${
              activeTab === 'condition' 
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            3. Kondisi Toko
          </button>
        </div>

        {/* FORM BODY */}
        <form onSubmit={validateAndProceed} className="p-3 sm:p-5 text-xs flex-1 overflow-y-auto space-y-5">
          
          {/* TAB 1: INVENTORY & NKL */}
          {activeTab === 'inventory' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              
              {/* Management Personnel Input */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2 font-extrabold text-slate-900 uppercase text-[11px] tracking-wider">
                  <UserCheck className="w-4 h-4 text-indigo-600" />
                  <span>Personil & Pimpinan Toko</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Area Manager (AM)</label>
                    <input
                      type="text"
                      placeholder="Nama AM..."
                      value={namaAM}
                      onChange={(e) => setNamaAM(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-medium focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Area Supervisor (AS)</label>
                    <input
                      type="text"
                      placeholder="Nama AS..."
                      value={namaAS}
                      onChange={(e) => setNamaAS(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-medium focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Head Store / Pimpinan Shift</label>
                    <input
                      type="text"
                      placeholder="Nama pimpinan shift..."
                      value={namaPimpinanShift}
                      onChange={(e) => setNamaPimpinanShift(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-medium focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" /> Jam Mulai SO
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" /> Jam Selesai SO
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* NK (Nota Kurang) & NL (Nota Lebih) - MOVED TO TOP */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-extrabold text-slate-900 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <span>Penyesuaian NK & NL Toko</span>
                  </div>
                  <span className="text-[11px] font-bold font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                    Nett NKL: {formatRupiah(nettNKLValRp)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-rose-700 mb-1">
                      Nota Kurang (NK) - Minus (Rp)
                    </label>
                    <RupiahInput
                      value={notaKurangNKValRp}
                      onChange={(val) => setNotaKurangNKValRp(val)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-mono font-bold text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-700 mb-1">
                      Nota Lebih (NL) - Plus (Rp)
                    </label>
                    <RupiahInput
                      value={notaLebihNLValRp}
                      onChange={(val) => setNotaLebihNLValRp(val)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-mono font-bold text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Custom NKL Items */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700">
                      Rincian Penyesuaian (+ / - Kontainer, Sarana, Selisih RPH, dll.)
                    </label>
                    <button
                      type="button"
                      onClick={addCustomNKLItem}
                      className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded-lg border border-indigo-200 flex items-center gap-1 cursor-pointer transition"
                    >
                      <Plus className="w-3 h-3" /> Tambah Penyesuaian
                    </button>
                  </div>

                  {customNKLItems.length > 0 && (
                    <div className="space-y-2.5">
                      {customNKLItems.map((item) => (
                        <div key={item.id} className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                          <div className="space-y-1.5">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <div className="flex-1">
                                <input
                                  type="text"
                                  placeholder="Ketik keterangan (cth: Selisih RPH, Kontainer, Sarana, Retur DC...)"
                                  value={item.label}
                                  onChange={(e) => updateCustomNKLItem(item.id, 'label', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  value={item.type}
                                  onChange={(e) => updateCustomNKLItem(item.id, 'type', e.target.value as 'plus' | 'minus')}
                                  className={`border rounded-lg p-2 text-xs font-bold shrink-0 focus:ring-1 focus:ring-indigo-500 ${
                                    item.type === 'plus' 
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                                      : 'bg-rose-50 text-rose-700 border-rose-300'
                                  }`}
                                >
                                  <option value="plus">Plus (+) / NL</option>
                                  <option value="minus">Minus (-) / NK</option>
                                </select>
                                <div className="flex-1 sm:w-36">
                                  <RupiahInput
                                    value={item.amountRp}
                                    onChange={(val) => updateCustomNKLItem(item.id, 'amountRp', val)}
                                    placeholder="0"
                                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-indigo-500"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeCustomNKLItem(item.id)}
                                  className="text-rose-500 hover:text-rose-700 p-2 hover:bg-rose-50 rounded-lg transition shrink-0 cursor-pointer"
                                  title="Hapus"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            {/* Quick Suggestion Tags */}
                            <div className="flex flex-wrap items-center gap-1 pt-1">
                              <span className="text-[9px] font-semibold text-slate-400">Pilihan Cepat:</span>
                              {['Selisih RPH', 'Kontainer', 'Sarana', 'Retur Pending DC', 'BA Rusak Toko', 'Adjustment Kasir'].map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => updateCustomNKLItem(item.id, 'label', tag)}
                                  className="text-[9px] bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 font-medium px-1.5 py-0.5 rounded border border-slate-200 cursor-pointer transition"
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* TOP 5 ITEM SELISIH PLUS & MINUS TERBESAR - MOVED BELOW NK/NL */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div className="flex items-center gap-2 font-extrabold text-slate-900 uppercase text-[11px] tracking-wider border-b border-slate-200 pb-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  <span>Input 5 Item Selisih Plus & Minus Terbesar</span>
                </div>

                {/* Top 5 Item Plus */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-extrabold text-[11px] uppercase">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    <span>5 Item Selisih PLUS (+) Terbesar</span>
                  </div>
                  <div className="space-y-1.5">
                    {top5Plus.map((item, idx) => (
                      <div key={`plus-${idx}`} className="grid grid-cols-12 gap-1.5 items-center">
                        <div className="col-span-1 text-center font-bold text-slate-400 text-[11px]">
                          #{idx + 1}
                        </div>
                        <div className="col-span-3">
                          <input
                            type="text"
                            placeholder="PLU Item"
                            value={item.plu}
                            onChange={(e) => updateTop5Plus(idx, 'plu', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold uppercase focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="col-span-5">
                          <input
                            type="text"
                            placeholder="Deskripsi / Nama Barang"
                            value={item.description}
                            onChange={(e) => updateTop5Plus(idx, 'description', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-medium focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="col-span-3">
                          <RupiahInput
                            value={item.valueRp}
                            onChange={(val) => updateTop5Plus(idx, 'valueRp', val)}
                            placeholder="0"
                            className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold text-emerald-700 focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top 5 Item Minus */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-1.5 text-rose-700 font-extrabold text-[11px] uppercase">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                    <span>5 Item Selisih MINUS (-) Terbesar</span>
                  </div>
                  <div className="space-y-1.5">
                    {top5Minus.map((item, idx) => (
                      <div key={`minus-${idx}`} className="grid grid-cols-12 gap-1.5 items-center">
                        <div className="col-span-1 text-center font-bold text-slate-400 text-[11px]">
                          #{idx + 1}
                        </div>
                        <div className="col-span-3">
                          <input
                            type="text"
                            placeholder="PLU Item"
                            value={item.plu}
                            onChange={(e) => updateTop5Minus(idx, 'plu', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold uppercase focus:ring-1 focus:ring-rose-500"
                          />
                        </div>
                        <div className="col-span-5">
                          <input
                            type="text"
                            placeholder="Deskripsi / Nama Barang"
                            value={item.description}
                            onChange={(e) => updateTop5Minus(idx, 'description', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-medium focus:ring-1 focus:ring-rose-500"
                          />
                        </div>
                        <div className="col-span-3">
                          <RupiahInput
                            value={item.valueRp}
                            onChange={(val) => updateTop5Minus(idx, 'valueRp', val)}
                            placeholder="0"
                            className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold text-rose-700 focus:ring-1 focus:ring-rose-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: AUDIT BRANKAS & KAS */}
          {activeTab === 'brankas' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              
              {/* Header Info Banner */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <h4 className="font-extrabold text-xs text-amber-950">Audit Brankas & Kas Toko</h4>
                    <p className="text-[10px] text-amber-800">Cek fisik kas toko & fisik uang sales vs data finance</p>
                  </div>
                </div>
                <div className="text-right bg-white p-1.5 px-2.5 rounded-lg border border-amber-300">
                  <span className="text-[9px] text-amber-700 font-bold block uppercase">Nett Brankas</span>
                  <span className={`text-xs font-black font-mono ${nettSOBrankasRp < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatRupiah(nettSOBrankasRp)}
                  </span>
                </div>
              </div>

              {/* 1. Kas Toko Audit */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-extrabold text-slate-900 text-xs">1. Audit Kas Toko</span>
                  <span className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded border ${selisihKasTokoRp < 0 ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'}`}>
                    Selisih: {formatRupiah(selisihKasTokoRp)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Kas Toko (Finance Rp)</label>
                    <RupiahInput
                      value={kasTokoFinanceRp}
                      onChange={(val) => setKasTokoFinanceRp(val)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Fisik Kas Brankas Rp</label>
                    <RupiahInput
                      value={fisikKasBrankasRp}
                      onChange={(val) => setFisikKasBrankasRp(val)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Fisik Kas Kasiran Rp</label>
                    <RupiahInput
                      value={fisikKasKasiranRp}
                      onChange={(val) => setFisikKasKasiranRp(val)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Uang Sales Audit */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-extrabold text-slate-900 text-xs">2. Audit Uang Sales (Target vs Fisik per Shift / Kasir)</span>
                  <span className={`text-[11px] font-extrabold font-mono px-2.5 py-1 rounded-md border shadow-2xs ${
                    selisihSalesRp < 0 
                      ? 'bg-rose-100 text-rose-800 border-rose-300' 
                      : selisihSalesRp > 0 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                        : 'bg-slate-100 text-slate-800 border-slate-300'
                  }`}>
                    Selisih Sales: {selisihSalesRp < 0 ? `- ${formatRupiah(Math.abs(selisihSalesRp))} (Kurang)` : selisihSalesRp > 0 ? `+ ${formatRupiah(selisihSalesRp)} (Lebih)` : 'Rp 0 (Pas)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  
                  {/* Kolom A: TARGET UANG SALES (DATA TUTUP SHIFT TOKO) */}
                  <div className="p-3 bg-white border border-indigo-100 rounded-xl space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-indigo-50 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="font-extrabold text-indigo-950 text-[11px] uppercase tracking-wider">
                          A. Target Sales (Tutup Shift)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        Total: {formatRupiah(uangSalesTutupShiftRp)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Target Komp. Induk</label>
                        <RupiahInput
                          value={salesKompIndukRp}
                          onChange={(val) => setSalesKompIndukRp(val)}
                          placeholder="0"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Target Anak 1</label>
                        <RupiahInput
                          value={salesAnak1Rp}
                          onChange={(val) => setSalesAnak1Rp(val)}
                          placeholder="0"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Target Anak 2</label>
                        <RupiahInput
                          value={salesAnak2Rp}
                          onChange={(val) => setSalesAnak2Rp(val)}
                          placeholder="0"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Target Anak 3</label>
                        <RupiahInput
                          value={salesAnak3Rp}
                          onChange={(val) => setSalesAnak3Rp(val)}
                          placeholder="0"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Target Anak 4</label>
                        <RupiahInput
                          value={salesAnak4Rp}
                          onChange={(val) => setSalesAnak4Rp(val)}
                          placeholder="0"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Target Point Coffee</label>
                        <RupiahInput
                          value={salesPointCoffeeRp}
                          onChange={(val) => setSalesPointCoffeeRp(val)}
                          placeholder="0"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Target Sales Kemarin (Opsional) */}
                    <div className="pt-2 border-t border-indigo-100">
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Target Sales Kemarin (Opsional)</label>
                      <RupiahInput
                        value={salesKemarinRp}
                        onChange={(val) => setSalesKemarinRp(val)}
                        placeholder="0"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Kolom B: FISIK UANG SALES (HITUNGAN FISIK KASIR) */}
                  <div className="p-3 bg-white border border-emerald-100 rounded-xl space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-emerald-50 pb-2">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-extrabold text-emerald-950 text-[11px] uppercase tracking-wider">
                          B. Fisik Sales (Hitungan Kasir)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Total Fisik: {formatRupiah(totalFisikSalesRp)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="flex justify-between items-center mb-0.5">
                          <label className="text-[10px] font-bold text-slate-700">Fisik Komp. Induk</label>
                          {((fisikSalesKompIndukRp || 0) - (salesKompIndukRp || 0) !== 0) && (
                            <span className={`text-[9px] font-mono font-bold ${((fisikSalesKompIndukRp || 0) - (salesKompIndukRp || 0)) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {((fisikSalesKompIndukRp || 0) - (salesKompIndukRp || 0)) < 0 ? '-' : '+'}{formatRupiah(Math.abs((fisikSalesKompIndukRp || 0) - (salesKompIndukRp || 0)))}
                            </span>
                          )}
                        </div>
                        <RupiahInput
                          value={fisikSalesKompIndukRp}
                          onChange={(val) => setFisikSalesKompIndukRp(val)}
                          placeholder="0"
                          className="w-full bg-emerald-50/40 border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-0.5">
                          <label className="text-[10px] font-bold text-slate-700">Fisik Anak 1</label>
                          {((fisikSalesAnak1Rp || 0) - (salesAnak1Rp || 0) !== 0) && (
                            <span className={`text-[9px] font-mono font-bold ${((fisikSalesAnak1Rp || 0) - (salesAnak1Rp || 0)) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {((fisikSalesAnak1Rp || 0) - (salesAnak1Rp || 0)) < 0 ? '-' : '+'}{formatRupiah(Math.abs((fisikSalesAnak1Rp || 0) - (salesAnak1Rp || 0)))}
                            </span>
                          )}
                        </div>
                        <RupiahInput
                          value={fisikSalesAnak1Rp}
                          onChange={(val) => setFisikSalesAnak1Rp(val)}
                          placeholder="0"
                          className="w-full bg-emerald-50/40 border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-0.5">
                          <label className="text-[10px] font-bold text-slate-700">Fisik Anak 2</label>
                          {((fisikSalesAnak2Rp || 0) - (salesAnak2Rp || 0) !== 0) && (
                            <span className={`text-[9px] font-mono font-bold ${((fisikSalesAnak2Rp || 0) - (salesAnak2Rp || 0)) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {((fisikSalesAnak2Rp || 0) - (salesAnak2Rp || 0)) < 0 ? '-' : '+'}{formatRupiah(Math.abs((fisikSalesAnak2Rp || 0) - (salesAnak2Rp || 0)))}
                            </span>
                          )}
                        </div>
                        <RupiahInput
                          value={fisikSalesAnak2Rp}
                          onChange={(val) => setFisikSalesAnak2Rp(val)}
                          placeholder="0"
                          className="w-full bg-emerald-50/40 border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-0.5">
                          <label className="text-[10px] font-bold text-slate-700">Fisik Anak 3</label>
                          {((fisikSalesAnak3Rp || 0) - (salesAnak3Rp || 0) !== 0) && (
                            <span className={`text-[9px] font-mono font-bold ${((fisikSalesAnak3Rp || 0) - (salesAnak3Rp || 0)) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {((fisikSalesAnak3Rp || 0) - (salesAnak3Rp || 0)) < 0 ? '-' : '+'}{formatRupiah(Math.abs((fisikSalesAnak3Rp || 0) - (salesAnak3Rp || 0)))}
                            </span>
                          )}
                        </div>
                        <RupiahInput
                          value={fisikSalesAnak3Rp}
                          onChange={(val) => setFisikSalesAnak3Rp(val)}
                          placeholder="0"
                          className="w-full bg-emerald-50/40 border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-0.5">
                          <label className="text-[10px] font-bold text-slate-700">Fisik Anak 4</label>
                          {((fisikSalesAnak4Rp || 0) - (salesAnak4Rp || 0) !== 0) && (
                            <span className={`text-[9px] font-mono font-bold ${((fisikSalesAnak4Rp || 0) - (salesAnak4Rp || 0)) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {((fisikSalesAnak4Rp || 0) - (salesAnak4Rp || 0)) < 0 ? '-' : '+'}{formatRupiah(Math.abs((fisikSalesAnak4Rp || 0) - (salesAnak4Rp || 0)))}
                            </span>
                          )}
                        </div>
                        <RupiahInput
                          value={fisikSalesAnak4Rp}
                          onChange={(val) => setFisikSalesAnak4Rp(val)}
                          placeholder="0"
                          className="w-full bg-emerald-50/40 border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-0.5">
                          <label className="text-[10px] font-bold text-slate-700">Fisik Point Coffee</label>
                          {((fisikSalesPointCoffeeRp || 0) - (salesPointCoffeeRp || 0) !== 0) && (
                            <span className={`text-[9px] font-mono font-bold ${((fisikSalesPointCoffeeRp || 0) - (salesPointCoffeeRp || 0)) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {((fisikSalesPointCoffeeRp || 0) - (salesPointCoffeeRp || 0)) < 0 ? '-' : '+'}{formatRupiah(Math.abs((fisikSalesPointCoffeeRp || 0) - (salesPointCoffeeRp || 0)))}
                            </span>
                          )}
                        </div>
                        <RupiahInput
                          value={fisikSalesPointCoffeeRp}
                          onChange={(val) => setFisikSalesPointCoffeeRp(val)}
                          placeholder="0"
                          className="w-full bg-emerald-50/40 border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Fisik Sales Kemarin (Opsional) */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex justify-between items-center mb-0.5">
                        <label className="text-[10px] font-semibold text-slate-600">Fisik Uang Sales Kemarin (Opsional)</label>
                        {((fisikSalesKemarinRp || 0) - (salesKemarinRp || 0) !== 0) && (
                          <span className={`text-[9px] font-mono font-bold ${((fisikSalesKemarinRp || 0) - (salesKemarinRp || 0)) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {((fisikSalesKemarinRp || 0) - (salesKemarinRp || 0)) < 0 ? '-' : '+'}{formatRupiah(Math.abs((fisikSalesKemarinRp || 0) - (salesKemarinRp || 0)))}
                          </span>
                        )}
                      </div>
                      <RupiahInput
                        value={fisikSalesKemarinRp}
                        onChange={(val) => setFisikSalesKemarinRp(val)}
                        placeholder="0"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                </div>

                {/* Sub-Total & Formula Breakdown Box */}
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-[11px] flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                  <div className="text-slate-600 font-medium">
                    <span>Total Fisik Sales: </span>
                    <strong className="text-slate-900 font-mono font-bold">{formatRupiah(totalFisikSalesRp)}</strong>
                    <span className="text-[10px] text-slate-400 ml-1">(Induk + Anak 1-4 + Pt Coffee + Kemarin)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">Selisih Uang Sales: </span>
                    <strong className={`font-mono font-black ${selisihSalesRp < 0 ? 'text-rose-600' : selisihSalesRp > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {selisihSalesRp < 0 ? `- ${formatRupiah(Math.abs(selisihSalesRp))}` : formatRupiah(selisihSalesRp)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* 3. Custom Brankas Items */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-extrabold text-slate-900 text-xs">3. Penyesuaian Nota / Voucher / Lainnya (Brankas)</span>
                  <button
                    type="button"
                    onClick={addCustomBrankasItem}
                    className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-lg border border-indigo-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Nota / Item
                  </button>
                </div>

                <div className="space-y-2">
                  {customBrankasItems.map((item) => (
                    <div key={item.id} className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2 shadow-2xs">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Misal: Nota Kurang/Lebih Toko, BA Varian, Kupon..."
                          value={item.label}
                          onChange={(e) => updateCustomBrankasItem(item.id, 'label', e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="w-28 shrink-0">
                          <select
                            value={item.type}
                            onChange={(e) => updateCustomBrankasItem(item.id, 'type', e.target.value as 'plus' | 'minus')}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="plus">Plus (+)</option>
                            <option value="minus">Minus (-)</option>
                          </select>
                        </div>

                        <div className="flex-1 sm:w-36">
                          <RupiahInput
                            value={item.amountRp}
                            onChange={(val) => updateCustomBrankasItem(item.id, 'amountRp', val)}
                            placeholder="0"
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeCustomBrankasItem(item.id)}
                          className="text-rose-500 hover:text-rose-700 p-2 hover:bg-rose-50 rounded-lg transition shrink-0 cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Rekapitulasi & Pembuktian Rumus SO Brankas */}
              <div className="p-3.5 bg-linear-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-extrabold text-amber-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    Kalkulasi & Pembuktian Rumus SO Brankas
                  </h5>
                  <span className={`text-xs font-mono font-black px-2.5 py-1 rounded border ${
                    nettSOBrankasRp < 0 
                      ? 'bg-rose-100 text-rose-900 border-rose-300' 
                      : nettSOBrankasRp > 0 
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                        : 'bg-slate-100 text-slate-900 border-slate-300'
                  }`}>
                    NETT SO BRANKAS: {formatRupiah(nettSOBrankasRp)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2 bg-white/90 rounded-lg border border-amber-200">
                    <span className="text-[10px] text-slate-500 block">1. Total Fisik Kas Toko</span>
                    <strong className="font-mono text-slate-900">{formatRupiah(totalFisikKas)}</strong>
                  </div>
                  <div className="p-2 bg-white/90 rounded-lg border border-amber-200">
                    <span className="text-[10px] text-slate-500 block">2. Total Fisik Uang Sales</span>
                    <strong className="font-mono text-slate-900">{formatRupiah(totalFisikSalesRp)}</strong>
                  </div>
                  <div className="p-2 bg-white/90 rounded-lg border border-amber-200">
                    <span className="text-[10px] text-slate-500 block">3. Penyesuaian Nota/BA</span>
                    <strong className={`font-mono ${customBrankasNet < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {customBrankasNet >= 0 ? `+${formatRupiah(customBrankasNet)}` : formatRupiah(customBrankasNet)}
                    </strong>
                  </div>
                  <div className="p-2 bg-white/90 rounded-lg border border-amber-200">
                    <span className="text-[10px] text-slate-500 block">4. Total Target Finance+Sales</span>
                    <strong className="font-mono text-slate-900">{formatRupiah(totalSeluruhTargetUangRp)}</strong>
                  </div>
                </div>

                <p className="text-[10px] text-amber-900/80 italic pt-1 border-t border-amber-200/60">
                  * <strong>Rumus SO Brankas:</strong> (Fisik Kas Toko + Fisik Uang Sales Kasir + Penyesuaian Nota/Lainnya) − (Kas Toko Finance + Total Target Uang Sales Tutup Shift) = <strong>{formatRupiah(nettSOBrankasRp)}</strong>
                </p>
              </div>

            </div>
          )}

          {/* TAB 3: KONDISI TOKO, CCTV & BUKTI */}
          {activeTab === 'condition' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              
              {/* Kondisi Kerapihan Toko */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                  Kondisi Kerapihan Area Toko
                </h4>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-1">Gudang Kolian</label>
                    <select
                      value={storeCondition.gudangKolian}
                      onChange={(e) => setStoreCondition({ ...storeCondition, gudangKolian: e.target.value as any })}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold"
                    >
                      <option value="Rapi">Rapi</option>
                      <option value="Tidak Rapi">Tidak Rapi</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-1">Gudang Rak</label>
                    <select
                      value={storeCondition.gudangRak}
                      onChange={(e) => setStoreCondition({ ...storeCondition, gudangRak: e.target.value as any })}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold"
                    >
                      <option value="Rapi">Rapi</option>
                      <option value="Tidak Rapi">Tidak Rapi</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-1">Area Sales</label>
                    <select
                      value={storeCondition.areaToko}
                      onChange={(e) => setStoreCondition({ ...storeCondition, areaToko: e.target.value as any })}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold"
                    >
                      <option value="Rapi">Rapi</option>
                      <option value="Tidak Rapi">Tidak Rapi</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-1">Ice Cream / Frozen</label>
                    <select
                      value={storeCondition.iceCreamFrozen}
                      onChange={(e) => setStoreCondition({ ...storeCondition, iceCreamFrozen: e.target.value as any })}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold"
                    >
                      <option value="Rapi">Rapi</option>
                      <option value="Tidak Rapi">Tidak Rapi</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Item Tidak Terdisplay (ITT) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Jumlah Item ITT (Item Tidak Terdisplay Toko)
                  </label>
                  <span className="text-[10px] font-semibold text-slate-500">Item tidak dipajang di area rak/sales</span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={itemTidakTerdisplayCount === 0 ? '' : itemTidakTerdisplayCount}
                  onChange={(e) => setItemTidakTerdisplayCount(e.target.value === '' ? 0 : Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* CCTV & Hardware Condition */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-indigo-600" />
                  Kondisi CCTV & Hardware Toko
                </h4>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-1">DVR</label>
                    <select
                      value={cctvCheck.dvrStatus}
                      onChange={(e) => setCctvCheck({ ...cctvCheck, dvrStatus: e.target.value as any })}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold"
                    >
                      <option value="Berfungsi">Berfungsi</option>
                      <option value="Tidak">Tidak</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-1">Kamera CCTV</label>
                    <select
                      value={cctvCheck.kameraStatus}
                      onChange={(e) => setCctvCheck({ ...cctvCheck, kameraStatus: e.target.value as any })}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold"
                    >
                      <option value="Berfungsi">Berfungsi</option>
                      <option value="Tidak">Tidak</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-1">Monitor LCD</label>
                    <select
                      value={cctvCheck.lcdStatus}
                      onChange={(e) => setCctvCheck({ ...cctvCheck, lcdStatus: e.target.value as any })}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold"
                    >
                      <option value="Berfungsi">Berfungsi</option>
                      <option value="Tidak">Tidak</option>
                    </select>
                  </div>
                </div>

                {/* WDCP / PDA Toko Audit */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Audit Perangkat WDCP / PDA Toko
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-1">Total Unit WDCP</label>
                      <input
                        type="number"
                        min="0"
                        value={wdcpTotal === 0 ? '' : wdcpTotal}
                        onChange={(e) => setWdcpTotal(e.target.value === '' ? 0 : Number(e.target.value))}
                        placeholder="0"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-emerald-700 mb-1">Unit Berfungsi</label>
                      <input
                        type="number"
                        min="0"
                        value={wdcpWorking === 0 ? '' : wdcpWorking}
                        onChange={(e) => setWdcpWorking(e.target.value === '' ? 0 : Number(e.target.value))}
                        placeholder="0"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-rose-700 mb-1">Unit Tidak / Rusak</label>
                      <input
                        type="number"
                        min="0"
                        value={wdcpBroken === 0 ? '' : wdcpBroken}
                        onChange={(e) => setWdcpBroken(e.target.value === '' ? 0 : Number(e.target.value))}
                        placeholder="0"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-rose-600"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Catatan & Penjelasan Selisih Korlap SO
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Penjelasan selisih fisik toko (misal: barang expired, penyesuaian promo, dll)..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white"
                />
              </div>

            </div>
          )}

          {/* SUBMIT FOOTER BUTTONS (Optimized for Mobile Touch) */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleManualSaveDraft(true)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm min-h-[44px] cursor-pointer"
                title="Simpan progress inputan saat ini ke memori browser perangkat"
              >
                <Save className="w-4 h-4 text-amber-100" />
                <span>Simpan Draft</span>
              </button>

              {activeTab === 'condition' ? (
                <button
                  type="button"
                  onClick={handleCopyCurrentWA}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
                >
                  {isCopiedWA ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-emerald-600" />}
                  <span>{isCopiedWA ? 'Tersalin!' : 'Salin Format WA'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDraftExplanationModal(true)}
                  className="hidden sm:flex text-[11px] text-amber-700 hover:text-amber-900 font-bold items-center gap-1 px-2 py-1 rounded hover:bg-amber-50 cursor-pointer"
                  title="Lihat penjelasan cara kerja draft"
                >
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  <span>Info Draft</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition min-h-[44px] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="w-2/3 sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition shadow-md min-h-[44px] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simpan Rekapan SO</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};

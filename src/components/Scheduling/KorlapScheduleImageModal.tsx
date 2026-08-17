import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Download, 
  Copy, 
  Check, 
  Calendar, 
  UserCheck, 
  MapPin, 
  Layers, 
  FileSpreadsheet, 
  ArrowRight, 
  AlertTriangle,
  Clock,
  Sparkles,
  Save,
  Share2,
  Phone
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { Store, SOSchedule, SOTeam, AuditorPersonnel } from '../../types/stockOpname';
import { calculateHaversineDistance } from '../../utils/geoUtils';
import { openWAShareUrl } from '../../utils/whatsappFormatter';

interface KorlapScheduleItem {
  id: string;
  store: Store;
  scheduledTime: string;
  isCluster: boolean;
  notes: string;
}

interface KorlapScheduleImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  stores: Store[];
  teams: SOTeam[];
  personnel?: AuditorPersonnel[];
  onAddMultipleSchedules: (newSchedules: SOSchedule[]) => void;
}

export const KorlapScheduleImageModal: React.FC<KorlapScheduleImageModalProps> = ({
  isOpen,
  onClose,
  stores,
  teams,
  personnel = [],
  onAddMultipleSchedules
}) => {
  const [scheduledDate, setScheduledDate] = useState<string>('2026-08-04');
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string>('');
  const [officerName, setOfficerName] = useState<string>('I Wayan Gede (Korlap Bali 1)');
  const [isCustomOfficer, setIsCustomOfficer] = useState<boolean>(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || '');

  // Find target selected personnel object and phone number
  const selectedPerson = personnel.find(p => p.id === selectedPersonnelId);
  const targetPhone = selectedPerson?.phone || '';

  // Auto-select first Korlap / Officer from personnel list on load
  useEffect(() => {
    if (personnel && personnel.length > 0) {
      const firstKorlap = personnel.find(p => p.role === 'Officer / Korlap' && p.status === 'Aktif') || personnel[0];
      if (firstKorlap) {
        setSelectedPersonnelId(firstKorlap.id);
        setOfficerName(`${firstKorlap.name} (${firstKorlap.role})`);
        if (firstKorlap.teamId && teams.some(t => t.id === firstKorlap.teamId)) {
          setSelectedTeamId(firstKorlap.teamId);
        }
      }
    }
  }, [personnel, teams]);

  // Handle personnel dropdown change
  const handlePersonnelSelect = (id: string) => {
    setSelectedPersonnelId(id);
    if (id === 'CUSTOM') {
      setIsCustomOfficer(true);
      setOfficerName('');
      return;
    }
    setIsCustomOfficer(false);
    const p = personnel.find(item => item.id === id);
    if (p) {
      setOfficerName(`${p.name} (${p.role})`);
      if (p.teamId && teams.some(t => t.id === p.teamId)) {
        setSelectedTeamId(p.teamId);
      }
    }
  };

  // Current list of stores for this Korlap's batch schedule
  const [items, setItems] = useState<KorlapScheduleItem[]>([]);

  // Selected store for adding
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('21:00');
  const [isCluster, setIsCluster] = useState<boolean>(true);
  const [itemNotes, setItemNotes] = useState<string>('Fokus audit kategori utama & Fresh Food');

  // UI state
  const [copiedText, setCopiedText] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [successSaved, setSuccessSaved] = useState(false);

  const excelPreviewRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Filter stores for selection dropdown
  const selectedTeam = teams.find(t => t.id === selectedTeamId) || teams[0];

  const handleAddItem = () => {
    if (!selectedStoreId) return;
    const store = stores.find(s => s.id === selectedStoreId);
    if (!store) return;

    const newItem: KorlapScheduleItem = {
      id: `ITEM-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      store,
      scheduledTime: selectedTime,
      isCluster,
      notes: itemNotes
    };

    setItems([...items, newItem]);
    setSelectedStoreId('');
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(it => it.id !== id));
  };

  // Calculate distance matrix and totals
  let totalDistanceKm = 0;
  const distanceLegs: { fromName: string; toName: string; distanceKm: number }[] = [];

  for (let i = 0; i < items.length - 1; i++) {
    const s1 = items[i].store;
    const s2 = items[i + 1].store;
    const dist = calculateHaversineDistance(s1.latitude, s1.longitude, s2.latitude, s2.longitude);
    totalDistanceKm += dist;
    distanceLegs.push({
      fromName: s1.name,
      toName: s2.name,
      distanceKm: dist
    });
  }

  // Generate Excel Image Download via html2canvas
  const handleDownloadExcelImage = async () => {
    if (!excelPreviewRef.current) return;
    setIsGeneratingImage(true);

    try {
      const origContainer = excelPreviewRef.current;

      const canvas = await html2canvas(origContainer, {
        scale: 2, // High DPI / Crisp image
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: true,
        ignoreElements: (element) => {
          return element.getAttribute('data-html2canvas-ignore') === 'true';
        },
        onclone: (clonedDoc, clonedElement) => {
          // 1. Sanitize style tags in clonedDoc to replace oklch color function with standard fallback
          const styleTags = clonedDoc.querySelectorAll('style');
          styleTags.forEach((style) => {
            if (style.textContent && style.textContent.includes('oklch')) {
              style.textContent = style.textContent.replace(/oklch\([^)]+\)/g, '#10b981');
            }
          });

          // 2. Inline computed colors on clonedElement and children to preserve exact visual design
          const origNodes = [origContainer, ...Array.from(origContainer.querySelectorAll('*'))];
          const clonedNodes = [clonedElement, ...Array.from(clonedElement.querySelectorAll('*'))];

          origNodes.forEach((origNode, i) => {
            const clonedNode = clonedNodes[i] as HTMLElement;
            if (clonedNode && origNode instanceof HTMLElement) {
              const cs = window.getComputedStyle(origNode);
              if (cs.backgroundColor) clonedNode.style.backgroundColor = cs.backgroundColor;
              if (cs.color) clonedNode.style.color = cs.color;
              if (cs.borderColor) clonedNode.style.borderColor = cs.borderColor;
              if (cs.borderTopColor) clonedNode.style.borderTopColor = cs.borderTopColor;
              if (cs.borderRightColor) clonedNode.style.borderRightColor = cs.borderRightColor;
              if (cs.borderBottomColor) clonedNode.style.borderBottomColor = cs.borderBottomColor;
              if (cs.borderLeftColor) clonedNode.style.borderLeftColor = cs.borderLeftColor;
            }
          });
        }
      });

      const imageBase64 = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      const filename = `Jadwal_SO_${officerName.replace(/[^a-zA-Z0-9]/g, '_')}_${scheduledDate}.png`;
      downloadLink.href = imageBase64;
      downloadLink.download = filename;
      downloadLink.click();
    } catch (err) {
      console.error('Failed to generate image:', err);
      alert('Gagal membuat gambar tabel. Silakan coba lagi.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Generate formatted WhatsApp text summary
  const generateWAText = () => {
    let text = `*📋 JADWAL OPERASIONAL SO KORLAP*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `👤 *Korlap / Officer:* ${officerName}\n`;
    if (targetPhone) text += `📱 *No. HP / WA:* ${targetPhone}\n`;
    text += `📅 *Tanggal SO:* ${scheduledDate}\n`;
    text += `👥 *Tim Audit:* ${selectedTeam?.name || 'Tim Standard'}\n`;
    text += `📍 *Total Toko:* ${items.length} Toko\n`;
    text += `📏 *Total Jarak Rute:* ${totalDistanceKm.toFixed(1)} km\n\n`;

    text += `*DAFTAR TOKO:* \n`;
    items.forEach((item, idx) => {
      text += `${idx + 1}. [${item.scheduledTime}] *${item.store.name}* (${item.store.code})\n`;
      text += `   📍 ${item.store.address}\n`;
      text += `   🏷️ Cluster: ${item.isCluster ? 'Ya (Berdekatan)' : 'Tidak'}\n`;
      if (item.notes) text += `   📝 Ket: ${item.notes}\n`;
      if (idx < items.length - 1) {
        const nextDist = calculateHaversineDistance(
          item.store.latitude, item.store.longitude,
          items[idx + 1].store.latitude, items[idx + 1].store.longitude
        );
        text += `   🚗 ➔ Jarak ke toko berikutnya: *${nextDist} km*\n`;
      }
      text += `\n`;
    });
    return text;
  };

  // Copy WhatsApp / Telegram Summary
  const handleCopyWhatsAppText = () => {
    const text = generateWAText();
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  // Direct WhatsApp share to Korlap phone number
  const handleShareWhatsAppDirect = () => {
    const text = generateWAText();
    openWAShareUrl(text, targetPhone);
  };

  // Save to Main Schedule State
  const handleSaveToMainSchedule = () => {
    if (items.length === 0) return;

    const newSchedules: SOSchedule[] = items.map((item, idx) => ({
      id: `SCHED-MANUAL-${Date.now()}-${idx}`,
      storeId: item.store.id,
      storeCode: item.store.code,
      storeName: item.store.name,
      region: item.store.region,
      scheduledDate,
      scheduledTime: item.scheduledTime,
      teamId: selectedTeam?.id || 'T-101',
      teamName: selectedTeam?.name || 'Tim Audit 1',
      spvInCharge: 'Gean Pratama (SPV Utama)',
      officerInCharge: officerName,
      status: 'Terjadwal',
      notes: `${item.isCluster ? '[CLUSTER] ' : ''}${item.notes}`,
      targetSKUCount: item.store.totalSKUCount,
      createdAt: new Date().toISOString().slice(0, 10)
    }));

    onAddMultipleSchedules(newSchedules);
    setSuccessSaved(true);
    setTimeout(() => {
      setSuccessSaved(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full my-8 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 px-6 py-4 text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 border border-emerald-400/30 rounded-xl">
              <FileSpreadsheet className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Input Jadwal SO Korlap & Auto Image Excel</h2>
              <p className="text-xs text-emerald-200">
                Input multiple toko per Korlap per tanggal, analisis jarak otomatis, & export gambar tabel Excel untuk WhatsApp.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">

          {/* Form Step 1: Informasi Korlap & Tanggal */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                Tanggal SO
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                Korlap / Officer Penanggung Jawab
              </label>
              <select
                value={selectedPersonnelId}
                onChange={(e) => handlePersonnelSelect(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
              >
                <optgroup label="Korlap / Officer Terdaftar">
                  {personnel
                    .filter(p => p.role === 'Officer / Korlap')
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        [{p.nik}] {p.name} ({p.role})
                      </option>
                    ))}
                </optgroup>
                <option value="CUSTOM">+ Input Nama Custom Manual</option>
              </select>

              {isCustomOfficer && (
                <input
                  type="text"
                  value={officerName}
                  onChange={(e) => setOfficerName(e.target.value)}
                  placeholder="Masukkan Nama Custom Korlap..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 mt-1.5"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                Tim Auditor SO
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
              >
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.leaderName})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Form Step 2: Tambah Toko Ke List Korlap */}
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/80 space-y-3">
            <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-700" />
              Tambah Toko Ke Rute SO Korlap
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Dropdown Toko */}
              <div className="md:col-span-5">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Pilih Toko ({stores.length} Toko Master)
                </label>
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Pilih Toko --</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name} ({s.city})
                    </option>
                  ))}
                </select>
              </div>

              {/* Jam SO */}
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Jam SO
                </label>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Status Cluster */}
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Opsi Cluster
                </label>
                <select
                  value={isCluster ? 'true' : 'false'}
                  onChange={(e) => setIsCluster(e.target.value === 'true')}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="true">Ya (Berdekatan)</option>
                  <option value="false">Tidak (Non-Cluster)</option>
                </select>
              </div>

              {/* Catatan / Keterangan */}
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Keterangan Toko
                </label>
                <input
                  type="text"
                  placeholder="Catatan khusus..."
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!selectedStoreId}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Tambahkan Toko Ini Ke List
              </button>
            </div>
          </div>

          {/* Real-time Distance Summary Banner */}
          {items.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-indigo-900 font-bold">
                <MapPin className="w-4 h-4 text-indigo-600" />
                Analisis Jarak Real-Time Rute:
                <span className="bg-white px-2.5 py-1 rounded-md border border-indigo-200 text-indigo-700 font-mono text-sm">
                  {totalDistanceKm.toFixed(1)} km
                </span>
                <span className="text-slate-500 font-normal">({items.length} Toko Terpilih)</span>
              </div>

              {distanceLegs.length > 0 && (
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-slate-600 font-semibold">Leg Jarak Transit:</span>
                  {distanceLegs.map((leg, lIdx) => (
                    <span key={lIdx} className="bg-white px-2 py-0.5 rounded border border-slate-200 font-medium text-slate-700">
                      {leg.distanceKm} km
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* EXCEL STYLED IMAGE PREVIEW CONTAINER FOR HTML2CANVAS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Tampilan Tabel Excel (Auto-Image Preview)
              </h3>
              <span className="text-[11px] text-slate-500">
                Format grid rapi seperti spreadsheet Excel, siap di-download gambar
              </span>
            </div>

            {/* DOM Element Captured by html2canvas */}
            <div 
              ref={excelPreviewRef}
              className="bg-white p-6 border-2 border-slate-300 rounded-xl shadow-sm text-slate-900 font-sans space-y-4"
              style={{ minWidth: '700px' }}
            >
              {/* Excel Header Banner */}
              <div className="border-b-2 border-emerald-800 pb-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">
                    PT RETAIL AUDIT INDONESIA • SYSTEM MANAGEMENT STOCK OPNAME
                  </div>
                  <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                    JADWAL AUDIT PHYSICAL STOCK OPNAME (SO) KORLAP
                  </h1>
                </div>
                <div className="text-right text-xs">
                  <div className="font-bold text-emerald-900 bg-emerald-100 px-3 py-1 rounded-md border border-emerald-300 inline-block">
                    {scheduledDate}
                  </div>
                </div>
              </div>

              {/* Korlap Meta Grid */}
              <div className="grid grid-cols-4 gap-2 bg-slate-100 p-3 rounded-lg border border-slate-300 text-xs font-semibold">
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase">Korlap / Officer:</span>
                  <span className="text-slate-900 font-bold">{officerName || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase">Tim SO:</span>
                  <span className="text-slate-900 font-bold">{selectedTeam?.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase">Jumlah Toko SO:</span>
                  <span className="text-emerald-700 font-bold">{items.length} Toko</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase">Est. Total Jarak:</span>
                  <span className="text-indigo-700 font-bold">{totalDistanceKm.toFixed(1)} km</span>
                </div>
              </div>

              {/* Excel-Style Table */}
              <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-emerald-800 text-white font-bold uppercase text-[11px] border border-emerald-900">
                    <th className="p-2 border border-emerald-700 w-10 text-center">No</th>
                    <th className="p-2 border border-emerald-700 w-20">Jam SO</th>
                    <th className="p-2 border border-emerald-700 w-24">Kode Toko</th>
                    <th className="p-2 border border-emerald-700">Nama Toko</th>
                    <th className="p-2 border border-emerald-700">Wilayah / Kec.</th>
                    <th className="p-2 border border-emerald-700 w-28 text-center">Cluster</th>
                    <th className="p-2 border border-emerald-700 w-28 text-center">Jarak Next</th>
                    <th className="p-2 border border-emerald-700">Keterangan</th>
                    <th className="p-2 border border-emerald-700 w-14 text-center" data-html2canvas-ignore="true">Hapus</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-slate-400 italic bg-slate-50">
                        Belum ada toko yang ditambahkan ke list rute Korlap ini.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => {
                      let nextDistanceText = '-';
                      if (idx < items.length - 1) {
                        const dist = calculateHaversineDistance(
                          item.store.latitude, item.store.longitude,
                          items[idx + 1].store.latitude, items[idx + 1].store.longitude
                        );
                        nextDistanceText = `${dist} km`;
                      }

                      return (
                        <tr 
                          key={item.id}
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}
                        >
                          <td className="p-2 border border-slate-300 text-center font-bold text-slate-700">{idx + 1}</td>
                          <td className="p-2 border border-slate-300 font-semibold text-slate-800">{item.scheduledTime}</td>
                          <td className="p-2 border border-slate-300 font-mono font-bold text-slate-900">{item.store.code}</td>
                          <td className="p-2 border border-slate-300 font-bold text-slate-900">{item.store.name}</td>
                          <td className="p-2 border border-slate-300 text-slate-600">
                            {item.store.city} ({item.store.district || 'Kota'})
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-semibold">
                            {item.isCluster ? (
                              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px]">
                                Ya (Cluster)
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]">
                                Non-Cluster
                              </span>
                            )}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-mono font-bold text-indigo-700">
                            {nextDistanceText}
                          </td>
                          <td className="p-2 border border-slate-300 text-slate-700 italic">
                            {item.notes || '-'}
                          </td>
                          <td className="p-2 border border-slate-300 text-center" data-html2canvas-ignore="true">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md transition border border-rose-200 inline-flex items-center justify-center"
                              title="Hapus toko ini dari list rute Korlap"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {items.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-200 font-bold text-slate-900 border border-slate-400 text-[11px]">
                      <td colSpan={3} className="p-2 border border-slate-300 text-right uppercase">
                        Total Audit Korlap:
                      </td>
                      <td colSpan={3} className="p-2 border border-slate-300 text-emerald-800">
                        {items.length} Toko Scheduled
                      </td>
                      <td className="p-2 border border-slate-300 text-center text-indigo-800">
                        {totalDistanceKm.toFixed(1)} km
                      </td>
                      <td className="p-2 border border-slate-300 text-slate-600">
                        Status: Siap Ditugaskan Hari-H
                      </td>
                      <td className="p-2 border border-slate-300" data-html2canvas-ignore="true"></td>
                    </tr>
                  </tfoot>
                )}
              </table>

              {/* Excel Footer Note */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-200">
                <div>Dokumen Resmi Penjadwalan SO • Dicetak Otomatis oleh System Stock Opname App</div>
                <div>Halaman 1 dari 1</div>
              </div>
            </div>
          </div>

        </div>

        {/* Action Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
          >
            Tutup
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleShareWhatsAppDirect}
              disabled={items.length === 0}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
              title={targetPhone ? `Kirim langsung ke WA ${targetPhone}` : 'Kirim via WhatsApp'}
            >
              <Share2 className="w-4 h-4 text-emerald-100" />
              Kirim WA Ke Korlap {targetPhone ? `(${targetPhone})` : ''}
            </button>

            <button
              onClick={handleCopyWhatsAppText}
              disabled={items.length === 0}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
            >
              {copiedText ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  Teks Tersalin!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Salin Teks (WhatsApp)
                </>
              )}
            </button>

            <button
              onClick={handleDownloadExcelImage}
              disabled={items.length === 0 || isGeneratingImage}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
            >
              {isGeneratingImage ? (
                <span>Membuat Gambar...</span>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Gambar Excel (PNG)
                </>
              )}
            </button>

            <button
              onClick={handleSaveToMainSchedule}
              disabled={items.length === 0 || successSaved}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
            >
              {successSaved ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  Berhasil Disimpan!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Simpan Ke Penjadwalan Utama
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

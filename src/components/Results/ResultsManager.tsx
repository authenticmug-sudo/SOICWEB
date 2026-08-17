import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  Search, 
  Download, 
  CheckCheck, 
  RotateCcw, 
  FileText, 
  Plus, 
  Building2, 
  AlertTriangle,
  Calendar,
  Cloud,
  Filter
} from 'lucide-react';
import { SOResult } from '../../types/stockOpname';
import { REGIONS } from '../../data/initialData';
import { formatRupiah, getStatusBadgeClass, formatDateIndo, parseSmartDate } from '../../utils/formatters';
import { exportToExcelWithBackup, exportToCSV } from '../../services/storageService';

interface ResultsManagerProps {
  results: SOResult[];
  onOpenInputModal: () => void;
  onSelectResultDetail: (result: SOResult) => void;
  onApproveResult: (resultId: string) => void;
  onRequestRecount: (resultId: string) => void;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const ResultsManager: React.FC<ResultsManagerProps> = ({
  results,
  onOpenInputModal,
  onSelectResultDetail,
  onApproveResult,
  onRequestRecount
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState('ALL');
  
  // Period filter state (default to current month/year or 'ALL')
  const currentYear = new Date().getFullYear();
  
  const [selectedDate, setSelectedDate] = useState<string>(''); // specific 'YYYY-MM-DD'
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL'); // 'ALL' or '1'..'12'
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));

  // Available regions computed from results data and master regions
  const availableRegions = React.useMemo(() => {
    const set = new Set<string>();
    results.forEach(r => {
      if (r.wilayah) set.add(r.wilayah);
      if (r.region) set.add(r.region);
    });
    REGIONS.forEach(r => set.add(r));
    return Array.from(set).filter(Boolean).sort();
  }, [results]);

  const filteredResults = results.filter(r => {
    const matchesSearch = 
      r.storeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.baNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.namaAM && r.namaAM.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.namaAS && r.namaAS.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRegion = selectedRegion === 'ALL' || r.region === selectedRegion;
    const matchesStatus = selectedApprovalStatus === 'ALL' || r.approvalStatus === selectedApprovalStatus;

    // Period filter
    const dt = parseSmartDate(r.soDate);
    let matchesDate = true;
    let matchesMonth = true;
    let matchesYear = true;

    if (selectedDate) {
      if (dt) {
        const formattedDt = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        matchesDate = formattedDt === selectedDate || r.soDate.includes(selectedDate);
      } else {
        matchesDate = r.soDate.includes(selectedDate);
      }
    }

    if (dt) {
      if (selectedMonth !== 'ALL') {
        matchesMonth = (dt.getMonth() + 1) === parseInt(selectedMonth, 10);
      }
      if (selectedYear !== 'ALL') {
        matchesYear = dt.getFullYear() === parseInt(selectedYear, 10);
      }
    }

    return matchesSearch && matchesRegion && matchesStatus && matchesDate && matchesMonth && matchesYear;
  });

  const getMonthLabel = () => {
    if (selectedDate) return `Tgl_${selectedDate}`;
    if (selectedMonth === 'ALL') return 'Semua_Bulan';
    return MONTH_NAMES[parseInt(selectedMonth, 10) - 1] || 'Bulan';
  };

  const handleExportCSVOrExcel = () => {
    const monthName = getMonthLabel();
    const yearName = selectedYear === 'ALL' ? currentYear : selectedYear;
    
    // Auto generated filename
    const filename = selectedDate 
      ? `Rekap_Hasil_SO_Tanggal_${selectedDate}.xlsx`
      : `Rekap_Hasil_SO_Bulan_${monthName}_Tahun_${yearName}.xlsx`;

    const data = filteredResults.map(r => {
      const b = r.brankasReport;
      const totalFisikSales = b?.totalFisikSalesRp ?? ((b?.fisikSalesKompIndukRp ?? b?.fisikSalesIndukRp ?? 0) + (b?.fisikSalesAnak1Rp ?? 0) + (b?.fisikSalesAnak2Rp ?? 0) + (b?.fisikSalesAnak3Rp ?? 0) + (b?.fisikSalesAnak4Rp ?? 0) + (b?.fisikSalesPointCoffeeRp ?? 0) + (b?.fisikSalesKemarinRp ?? 0));
      const totalFisikKas = (b?.fisikKasBrankasRp ?? 0) + (b?.fisikKasKasiranRp ?? 0);
      const totalSeluruhFisik = totalFisikKas + totalFisikSales;
      const totalTargetToko = (b?.kasTokoFinanceRp ?? 0) + (b?.uangSalesTutupShiftRp ?? 0);

      return {
        'No. BA': r.baNumber,
        'Kode Toko': r.storeCode,
        'Nama Toko': r.storeName,
        'Wilayah': r.region,
        'Tanggal SO': r.soDate,
        'Jam Mulai SO': r.startTime || '22:00',
        'Jam Selesai SO': r.endTime || '04:30',
        'Nama AM': r.namaAM || '-',
        'Nama AS': r.namaAS || '-',
        'Pimpinan Shift': r.namaPimpinanShift || '-',
        'Tim Auditor': r.executedByTeam,
        'Personil SO Ditugaskan': r.assignedPersonnelNames && r.assignedPersonnelNames.length > 0 ? r.assignedPersonnelNames.join('; ') : 'Belum Dialokasikan',
        'Qty System': r.systemQtyTotal,
        'Qty Fisik': r.physicalQtyTotal,
        'Qty Selisih': r.varianceQtyTotal,
        'Nominal System (Rp)': r.systemValueTotalRp,
        'Nominal Fisik (Rp)': r.physicalValueTotalRp,
        'Nominal Selisih (Rp)': r.varianceValueTotalRp,

        // NKL
        'Nota Kurang (NK) Rp': r.notaKurangNKValRp || 0,
        'Nota Lebih (NL) Rp': r.notaLebihNLValRp || 0,
        'Nett NKL Rp': r.nettNKLValRp || 0,

        // Brankas - Target Tutup Shift Breakdown
        'Target Sales Komp Induk Rp': b?.salesKompIndukRp || 0,
        'Target Sales Kemarin Rp': b?.salesKemarinRp || 0,
        'Target Sales Anak 1 Rp': b?.salesAnak1Rp || 0,
        'Target Sales Anak 2 Rp': b?.salesAnak2Rp || 0,
        'Target Sales Anak 3 Rp': b?.salesAnak3Rp || 0,
        'Target Sales Anak 4 Rp': b?.salesAnak4Rp || 0,
        'Target Sales Point Coffee Rp': b?.salesPointCoffeeRp || 0,
        'Total Target Sales Tutup Shift Rp': b?.uangSalesTutupShiftRp || 0,

        // Brankas - Fisik Sales Breakdown
        'Fisik Sales Komp Induk Rp': b?.fisikSalesKompIndukRp ?? b?.fisikSalesIndukRp ?? 0,
        'Fisik Sales Anak 1 Rp': b?.fisikSalesAnak1Rp || 0,
        'Fisik Sales Anak 2 Rp': b?.fisikSalesAnak2Rp || 0,
        'Fisik Sales Anak 3 Rp': b?.fisikSalesAnak3Rp || 0,
        'Fisik Sales Anak 4 Rp': b?.fisikSalesAnak4Rp || 0,
        'Fisik Sales Point Coffee Rp': b?.fisikSalesPointCoffeeRp || 0,
        'Fisik Sales Kemarin Rp': b?.fisikSalesKemarinRp || 0,
        'Total Fisik Uang Sales Rp': totalFisikSales,
        'Selisih Uang Sales Rp': b?.selisihSalesRp || 0,

        // Brankas - Kas Toko & Rumus Keseluruhan
        'Kas Toko Finance Rp': b?.kasTokoFinanceRp || 0,
        'Fisik Kas Brankas Rp': b?.fisikKasBrankasRp || 0,
        'Fisik Kas Kasiran Rp': b?.fisikKasKasiranRp || 0,
        'Total Fisik Kas Toko Rp': totalFisikKas,
        'Selisih Kas Toko Rp': b?.selisihKasTokoRp || 0,
        'Total Seluruh Fisik Uang Rp': totalSeluruhFisik,
        'Total Target Toko Finance+Sales Rp': totalTargetToko,
        'Nett SO Brankas Rp': b?.nettSOBrankasRp || 0,

        // Condition & Checks
        'Gudang Kolian': r.storeCondition?.gudangKolian || 'Rapi',
        'Gudang Rak': r.storeCondition?.gudangRak || 'Rapi',
        'Area Toko': r.storeCondition?.areaToko || 'Rapi',
        'Ice Cream / Frozen': r.storeCondition?.iceCreamFrozen || 'Rapi',
        'BPB Belum Diproses': r.opCheck?.bpbBelumDiproses || 'Tidak',
        'Returan Belum Dikirim DC': r.opCheck?.returBelumDikirimDC || 'Tidak',
        'Cek Kiriman Alat': r.opCheck?.cekKirimanDenganAlat || 'Ya',
        'Item Tidak Terdisplay': r.itemTidakTerdisplayCount || 0,
        'CCTV DVR': r.cctvCheck?.dvrStatus || 'Berfungsi',
        'CCTV Kamera': r.cctvCheck?.kameraStatus || 'Berfungsi',
        'CCTV LCD': r.cctvCheck?.lcdStatus || 'Berfungsi',

        'Status Approval': r.approvalStatus,
        'Foto Bukti Cloudinary': r.evidencePhotoUrl || '-',
        'Catatan SO': r.notesAndActionPlan
      };
    });

    // Trigger Browser Download AND Auto-Upload to Cloudinary & Firestore
    exportToExcelWithBackup(filename, `Rekap_SO_${monthName}`, data);
  };

  return (
    <div className="space-y-4">
      
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-indigo-600" />
            Rekapan Hasil & Berita Acara Stock Opname (SO)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Verifikasi fisik barang, audit brankas/kas toko, laporan NKL, & ekspor file bulanan ke Cloudinary
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenInputModal}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Input Rekapan Hasil SO
          </button>

          <button
            onClick={handleExportCSVOrExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            title="Download Excel & Auto Record ke Cloudinary"
          >
            <Cloud className="w-3.5 h-3.5" />
            Export File Rekap Bulanan (Cloudinary)
          </button>
        </div>
      </div>

      {/* Filters Toolbar & Sub-Menu */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-500" />
          <input
            type="text"
            placeholder="Cari BA, toko, AM, AS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 hover:border-slate-400 focus:border-indigo-500 focus:bg-white rounded-xl text-xs sm:text-sm pl-10 pr-4 py-2.5 text-slate-900 font-medium placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-700 bg-slate-200/60 w-5 h-5 rounded-full flex items-center justify-center"
            >
              ✕
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Specific Date Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 transition">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Tgl:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer text-xs"
              title="Filter per tanggal spesifik"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                className="text-slate-400 hover:text-slate-700 text-xs ml-0.5"
                title="Hapus filter tanggal"
              >
                ✕
              </button>
            )}
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 transition">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Bulan</option>
              {MONTH_NAMES.map((m, idx) => (
                <option key={idx} value={String(idx + 1)}>{m}</option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-slate-50 border border-slate-300 hover:border-slate-400 text-xs sm:text-sm font-bold rounded-xl px-3 py-2 text-slate-800 focus:outline-none cursor-pointer transition"
          >
            <option value="ALL">Semua Tahun</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>

          {/* Region Selector */}
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="bg-slate-50 border border-slate-300 hover:border-slate-400 text-xs sm:text-sm font-bold rounded-xl px-3 py-2 text-slate-800 focus:outline-none cursor-pointer transition"
          >
            <option value="ALL">📍 Semua Kabupaten ({availableRegions.length})</option>
            {availableRegions.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Status Approval Selector */}
          <select
            value={selectedApprovalStatus}
            onChange={(e) => setSelectedApprovalStatus(e.target.value)}
            className="bg-slate-50 border border-slate-300 hover:border-slate-400 text-xs sm:text-sm font-bold rounded-xl px-3 py-2 text-slate-800 focus:outline-none cursor-pointer transition"
          >
            <option value="ALL">🏷️ Semua Status Approval</option>
            <option value="Menunggu Approval SPV">Menunggu Approval SPV</option>
            <option value="Disetujui">Disetujui</option>
            <option value="Perlu Audit Ulang">Perlu Audit Ulang</option>
            <option value="Ditolak">Ditolak</option>
          </select>

        </div>

      </div>

      {/* Active Filter Period Notice Bar */}
      <div className="px-4 py-2 bg-indigo-50/60 border border-indigo-100 rounded-xl flex items-center justify-between text-xs text-indigo-950 font-medium">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-indigo-600" />
          <span>
            Periode Tampil: <strong className="font-extrabold">{selectedMonth === 'ALL' ? 'Semua Bulan' : MONTH_NAMES[parseInt(selectedMonth, 10) - 1]} {selectedYear === 'ALL' ? 'Semua Tahun' : selectedYear}</strong>
          </span>
        </div>
        <span className="text-[11px] font-mono font-bold text-indigo-700">
          Total {filteredResults.length} Rekapan Toko
        </span>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">No. BA & Toko</th>
                <th className="py-3 px-4">Tanggal & Tim Auditor</th>
                <th className="py-3 px-4 text-right">Selisih Barang (Rp)</th>
                <th className="py-3 px-4 text-right">Nett NKL (Rp)</th>
                <th className="py-3 px-4 text-right">Nett Brankas (Rp)</th>
                <th className="py-3 px-4">Status Approval</th>
                <th className="py-3 px-4 text-right">Aksi SPV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredResults.length > 0 ? (
                filteredResults.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    
                    <td className="py-3 px-4">
                      <div className="font-mono text-[11px] font-bold text-indigo-700">{r.baNumber}</div>
                      <div className="font-bold text-slate-900">{r.storeName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">[{r.storeCode}] - {r.region.split(' ')[0]}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{formatDateIndo(r.soDate)}</div>
                      <div className="text-[10px] text-slate-500">{r.executedByTeam}</div>
                      {(r.namaAM || r.namaAS) && (
                        <div className="text-[10px] text-slate-400">AM: {r.namaAM || '-'} • AS: {r.namaAS || '-'}</div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span className={r.varianceValueTotalRp < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                        {formatRupiah(r.varianceValueTotalRp)}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span className={(r.nettNKLValRp || 0) < 0 ? 'text-rose-600' : 'text-slate-700'}>
                        {formatRupiah(r.nettNKLValRp || 0)}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span className={(r.brankasReport?.nettSOBrankasRp || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                        {formatRupiah(r.brankasReport?.nettSOBrankasRp || 0)}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 text-[10px] rounded-full border font-semibold ${getStatusBadgeClass(r.approvalStatus)}`}>
                        {r.approvalStatus}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onSelectResultDetail(r)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[10px] font-medium transition flex items-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3 h-3" /> Detail
                        </button>

                        {r.approvalStatus === 'Menunggu Approval SPV' && (
                          <>
                            <button
                              onClick={() => onRequestRecount(r.id)}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-medium transition flex items-center gap-1 cursor-pointer"
                              title="Permintaan SO Ulang"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => onApproveResult(r.id)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Approve Laporan"
                            >
                              <CheckCheck className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Tidak ditemukan rekapan hasil SO pada periode ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

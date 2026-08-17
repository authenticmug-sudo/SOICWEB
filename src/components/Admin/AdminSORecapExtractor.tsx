import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Search, 
  Calendar, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Store as StoreIcon, 
  DollarSign, 
  Building2, 
  ShieldCheck, 
  Copy, 
  Check, 
  Eye, 
  FileText,
  Clock,
  Sparkles,
  ArrowUpDown,
  TrendingDown,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { SOResult, RegionArea, UserRole, SOSchedule, Store, AuditorPersonnel } from '../../types/stockOpname';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';
import { exportToExcelWithBackup } from '../../services/storageService';

interface AdminSORecapExtractorProps {
  results: SOResult[];
  currentRole?: UserRole;
  onViewDetailResult?: (result: SOResult) => void;
  schedules?: SOSchedule[];
  stores?: Store[];
  personnel?: AuditorPersonnel[];
}

const REGION_OPTIONS: RegionArea[] = [
  'Kota Denpasar',
  'Kab. Badung',
  'Kab. Gianyar',
  'Kab. Tabanan',
  'Kab. Buleleng',
  'Kab. Karangasem',
  'Kab. Jembrana',
  'Kab. Klungkung',
  'Kab. Bangli',
  'Kota Mataram & Lombok'
];

export const AdminSORecapExtractor: React.FC<AdminSORecapExtractorProps> = ({
  results,
  currentRole,
  onViewDetailResult
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('08');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [selectedKorlap, setSelectedKorlap] = useState<string>('ALL');
  const [selectedApproval, setSelectedApproval] = useState<string>('ALL');
  const [copiedWA, setCopiedWA] = useState(false);

  // Extract unique Korlaps & Teams from results
  const korlapList = useMemo(() => {
    const list = Array.from(new Set(results.map(r => r.officerInCharge || r.executedByTeam).filter(Boolean))) as string[];
    return list;
  }, [results]);

  // Filtered results
  const filteredResults = useMemo(() => {
    return results.filter(r => {
      // Filter Tanggal
      if (selectedDate && r.soDate !== selectedDate) return false;

      // Filter Bulan & Tahun jika tanggal tidak dipilih
      if (!selectedDate && selectedMonth !== 'ALL' && selectedYear !== 'ALL') {
        const d = new Date(r.soDate);
        if (!isNaN(d.getTime())) {
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const y = String(d.getFullYear());
          if (m !== selectedMonth || y !== selectedYear) return false;
        }
      }

      // Filter Wilayah
      if (selectedRegion !== 'ALL' && r.region !== selectedRegion) return false;

      // Filter Korlap / Tim
      if (selectedKorlap !== 'ALL' && r.officerInCharge !== selectedKorlap && r.executedByTeam !== selectedKorlap) return false;

      // Filter Status Approval
      if (selectedApproval !== 'ALL' && r.approvalStatus !== selectedApproval) return false;

      // Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchCode = r.storeCode.toLowerCase().includes(q);
        const matchName = r.storeName.toLowerCase().includes(q);
        const matchBA = (r.baNumber || '').toLowerCase().includes(q);
        const matchTeam = (r.executedByTeam || '').toLowerCase().includes(q);
        const matchKorlap = (r.officerInCharge || '').toLowerCase().includes(q);
        const matchAM = (r.namaAM || '').toLowerCase().includes(q);
        const matchAS = (r.namaAS || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchBA && !matchTeam && !matchKorlap && !matchAM && !matchAS) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.soDate).getTime() - new Date(a.soDate).getTime());
  }, [results, selectedDate, selectedMonth, selectedYear, selectedRegion, selectedKorlap, selectedApproval, searchQuery]);

  // Summary KPI Calculations
  const kpis = useMemo(() => {
    const totalToko = filteredResults.length;
    let totalSystemRp = 0;
    let totalFisikRp = 0;
    let totalVarianceRp = 0;
    let totalNKValRp = 0;
    let totalNLValRp = 0;
    let totalNettNKLValRp = 0;
    let totalSelisihBrankasRp = 0;

    filteredResults.forEach(r => {
      totalSystemRp += r.systemValueTotalRp || 0;
      totalFisikRp += r.physicalValueTotalRp || 0;
      totalVarianceRp += r.varianceValueTotalRp || 0;
      totalNKValRp += r.notaKurangNKValRp || 0;
      totalNLValRp += r.notaLebihNLValRp || 0;
      totalNettNKLValRp += r.nettNKLValRp || 0;
      totalSelisihBrankasRp += r.brankasReport?.selisihBrankasRp || r.brankasReport?.selisihSalesRp || 0;
    });

    return {
      totalToko,
      totalSystemRp,
      totalFisikRp,
      totalVarianceRp,
      totalNKValRp,
      totalNLValRp,
      totalNettNKLValRp,
      totalSelisihBrankasRp
    };
  }, [filteredResults]);

  // Handle Full Export to Excel with all granular columns (NK, NL, Brankas, Condition, etc)
  const handleExportFullExcel = () => {
    const filename = selectedDate 
      ? `Rekap_Lengkap_Hasil_SO_Tanggal_${selectedDate}.xlsx`
      : `Rekap_Lengkap_Hasil_SO_Bulan_${selectedMonth}_${selectedYear}.xlsx`;

    const data = filteredResults.map((r, idx) => {
      const b = r.brankasReport;
      const totalFisikSales = b?.totalFisikSalesRp ?? ((b?.fisikSalesKompIndukRp ?? b?.fisikSalesIndukRp ?? 0) + (b?.fisikSalesAnak1Rp ?? 0) + (b?.fisikSalesAnak2Rp ?? 0) + (b?.fisikSalesAnak3Rp ?? 0) + (b?.fisikSalesAnak4Rp ?? 0) + (b?.fisikSalesPointCoffeeRp ?? 0) + (b?.fisikSalesKemarinRp ?? 0));
      const totalFisikKas = (b?.fisikKasBrankasRp ?? 0) + (b?.fisikKasKasiranRp ?? 0);
      const totalSeluruhFisik = totalFisikKas + totalFisikSales;
      const totalTargetToko = (b?.kasTokoFinanceRp ?? 0) + (b?.uangSalesTutupShiftRp ?? 0);

      return {
        'No': idx + 1,
        'No. Berita Acara (BA)': r.baNumber,
        'Kode Toko': r.storeCode,
        'Nama Toko': r.storeName,
        'Wilayah': r.region,
        'Tanggal Pelaksanaan SO': r.soDate,
        'Jam Mulai': r.startTime || '22:00',
        'Jam Selesai': r.endTime || '04:30',
        'Korlap Penanggung Jawab': r.officerInCharge || '-',
        'Tim Auditor': r.executedByTeam,
        'Personil Ditugaskan': r.assignedPersonnelNames && r.assignedPersonnelNames.length > 0 ? r.assignedPersonnelNames.join('; ') : '-',
        'Nama AM': r.namaAM || '-',
        'Nama AS': r.namaAS || '-',
        'Pimpinan Shift Toko': r.namaPimpinanShift || '-',

        // Stock Opname Barang & Nilai Fisik vs System
        'Total Nominal System (Rp)': r.systemValueTotalRp,
        'Total Nominal Fisik (Rp)': r.physicalValueTotalRp,
        'Total Nominal Selisih (Rp)': r.varianceValueTotalRp,
        'Total Qty System': r.systemQtyTotal || 0,
        'Total Qty Fisik': r.physicalQtyTotal || 0,
        'Total Qty Selisih': r.varianceQtyTotal || 0,

        // NKL (Nota Kurang & Nota Lebih)
        'Nota Kurang (NK) Minus Rp': r.notaKurangNKValRp || 0,
        'Nota Lebih (NL) Plus Rp': r.notaLebihNLValRp || 0,
        'Nett NKL Rp': r.nettNKLValRp || 0,

        // SO Brankas - Target Sales Breakdown
        'Target Sales Komputer Induk (Rp)': b?.salesKompIndukRp || 0,
        'Target Sales Kemarin (Rp)': b?.salesKemarinRp || 0,
        'Target Sales Anak 1 (Rp)': b?.salesAnak1Rp || 0,
        'Target Sales Anak 2 (Rp)': b?.salesAnak2Rp || 0,
        'Target Sales Anak 3 (Rp)': b?.salesAnak3Rp || 0,
        'Target Sales Anak 4 (Rp)': b?.salesAnak4Rp || 0,
        'Target Sales Point Coffee (Rp)': b?.salesPointCoffeeRp || 0,
        'Total Target Sales Tutup Shift (Rp)': b?.uangSalesTutupShiftRp || 0,

        // SO Brankas - Fisik Sales Breakdown
        'Fisik Sales Komputer Induk (Rp)': b?.fisikSalesKompIndukRp ?? b?.fisikSalesIndukRp ?? 0,
        'Fisik Sales Kemarin (Rp)': b?.fisikSalesKemarinRp || 0,
        'Fisik Sales Anak 1 (Rp)': b?.fisikSalesAnak1Rp || 0,
        'Fisik Sales Anak 2 (Rp)': b?.fisikSalesAnak2Rp || 0,
        'Fisik Sales Anak 3 (Rp)': b?.fisikSalesAnak3Rp || 0,
        'Fisik Sales Anak 4 (Rp)': b?.fisikSalesAnak4Rp || 0,
        'Fisik Sales Point Coffee (Rp)': b?.fisikSalesPointCoffeeRp || 0,
        'Total Fisik Uang Sales (Rp)': totalFisikSales,
        'Selisih Uang Sales Kasir (Rp)': b?.selisihSalesRp || 0,

        // SO Brankas - Kas Toko Finance & Fisik
        'Target Kas Toko Finance (Rp)': b?.kasTokoFinanceRp || 0,
        'Fisik Kas Brankas (Rp)': b?.fisikKasBrankasRp || 0,
        'Fisik Kas Kasiran (Rp)': b?.fisikKasKasiranRp || 0,
        'Total Fisik Kas Toko (Rp)': totalFisikKas,
        'Selisih Kas Toko Finance (Rp)': b?.selisihKasTokoRp || 0,
        'Total Seluruh Fisik Uang (Rp)': totalSeluruhFisik,
        'Total Target Toko Finance+Sales (Rp)': totalTargetToko,
        'Nett SO Brankas (Rp)': b?.nettSOBrankasRp || 0,
        'Selisih Brankas Toko (Rp)': b?.selisihBrankasRp || 0,

        // Kondisi Toko & Audit Operasional
        'Gudang Kolian': r.storeCondition?.gudangKolian || 'Rapi',
        'Gudang Rak': r.storeCondition?.gudangRak || 'Rapi',
        'Area Penjualan Toko': r.storeCondition?.areaToko || 'Rapi',
        'Ice Cream / Frozen': r.storeCondition?.iceCreamFrozen || 'Rapi',
        'BPB Belum Diproses': r.opCheck?.bpbBelumDiproses || 'Tidak',
        'Returan Belum Dikirim DC': r.opCheck?.returBelumDikirimDC || 'Tidak',
        'Cek Kiriman Alat': r.opCheck?.cekKirimanDenganAlat || 'Ya',
        'Item Tidak Terdisplay': r.itemTidakTerdisplayCount || 0,
        'CCTV DVR': r.cctvCheck?.dvrStatus || 'Berfungsi',
        'CCTV Kamera': r.cctvCheck?.kameraStatus || 'Berfungsi',
        'CCTV LCD': r.cctvCheck?.lcdStatus || 'Berfungsi',

        // Status & Link Foto
        'Status Approval SPV': r.approvalStatus,
        'Foto Bukti Cloudinary': r.evidencePhotoUrl || '-',
        'Catatan Hasil SO': r.notesAndActionPlan || '-'
      };
    });

    exportToExcelWithBackup(filename, 'Rekap_SO_Lengkap', data);
  };

  // Copy WhatsApp Summary
  const handleCopyWA = () => {
    let msg = `📊 *REKAPAN HASIL STOCK OPNAME (SO) IC BALI*\n`;
    if (selectedDate) msg += `📅 Tanggal: *${formatDateIndo(selectedDate)}*\n`;
    else msg += `📅 Periode: *Bulan ${selectedMonth} / ${selectedYear}*\n`;
    if (selectedRegion !== 'ALL') msg += `📍 Wilayah: *${selectedRegion}*\n`;
    msg += `🏢 Total Toko Selesai SO: *${kpis.totalToko} Toko*\n`;
    msg += `-----------------------------------------\n`;
    msg += `💰 *TOTAL SYSTEM:* ${formatRupiah(kpis.totalSystemRp)}\n`;
    msg += `📦 *TOTAL FISIK:* ${formatRupiah(kpis.totalFisikRp)}\n`;
    msg += `⚖️ *TOTAL SELISIH FISIK:* ${formatRupiah(kpis.totalVarianceRp)}\n`;
    msg += `🔻 *TOTAL NOTA KURANG (NK):* ${formatRupiah(kpis.totalNKValRp)}\n`;
    msg += `🟢 *TOTAL NOTA LEBIH (NL):* ${formatRupiah(kpis.totalNLValRp)}\n`;
    msg += `📑 *TOTAL NETT NKL:* ${formatRupiah(kpis.totalNettNKLValRp)}\n`;
    msg += `🏦 *TOTAL SELISIH BRANKAS:* ${formatRupiah(kpis.totalSelisihBrankasRp)}\n`;
    msg += `-----------------------------------------\n`;
    msg += `_Diunduh dan direkap otomatis via Portal Admin SO IC Bali_`;

    navigator.clipboard.writeText(msg);
    setCopiedWA(true);
    setTimeout(() => setCopiedWA(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-900 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl border border-amber-800/60 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 translate-x-8 -translate-y-8 pointer-events-none">
          <FileSpreadsheet className="w-64 h-64 text-amber-400" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Penarikan & Rekapitulasi Hasil SO (Admin)
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-amber-200/80 max-w-2xl">
              Portal penarikan data komprehensif inputan hasil SO dari personil lapangan: mencakup Nota Kurang (NK), Nota Lebih (NL), SO Brankas Kasir, Selisih Nilai Fisik vs System, hingga Kondisi Toko & CCTV.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyWA}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/30 text-xs font-bold transition active:scale-95"
            >
              {copiedWA ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedWA ? 'Tersalin!' : 'Salin Rekap WA'}</span>
            </button>

            <button
              onClick={handleExportFullExcel}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 transition active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Tarik Rekap Lengkap (Excel)</span>
            </button>
          </div>
        </div>

        {/* Big KPI Metrics Dashboard */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 mt-6 pt-5 border-t border-amber-800/50">
          <div className="p-2.5 bg-slate-900/60 rounded-xl border border-amber-500/20">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Toko</span>
            <p className="text-lg font-black text-white">{kpis.totalToko} Toko</p>
          </div>

          <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-700/50">
            <span className="text-[10px] uppercase font-bold text-slate-400">Nilai System</span>
            <p className="text-xs font-bold text-slate-200 font-mono mt-0.5">{formatRupiah(kpis.totalSystemRp)}</p>
          </div>

          <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-700/50">
            <span className="text-[10px] uppercase font-bold text-slate-400">Nilai Fisik</span>
            <p className="text-xs font-bold text-slate-200 font-mono mt-0.5">{formatRupiah(kpis.totalFisikRp)}</p>
          </div>

          <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-700/50">
            <span className="text-[10px] uppercase font-bold text-slate-400">Selisih Fisik</span>
            <p className={`text-xs font-extrabold font-mono mt-0.5 ${kpis.totalVarianceRp < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {formatRupiah(kpis.totalVarianceRp)}
            </p>
          </div>

          <div className="p-2.5 bg-rose-950/60 rounded-xl border border-rose-500/30">
            <span className="text-[10px] uppercase font-bold text-rose-300">Nota Kurang (NK)</span>
            <p className="text-xs font-bold text-rose-300 font-mono mt-0.5">{formatRupiah(kpis.totalNKValRp)}</p>
          </div>

          <div className="p-2.5 bg-emerald-950/60 rounded-xl border border-emerald-500/30">
            <span className="text-[10px] uppercase font-bold text-emerald-300">Nota Lebih (NL)</span>
            <p className="text-xs font-bold text-emerald-300 font-mono mt-0.5">{formatRupiah(kpis.totalNLValRp)}</p>
          </div>

          <div className="p-2.5 bg-indigo-950/60 rounded-xl border border-indigo-500/30">
            <span className="text-[10px] uppercase font-bold text-indigo-300">Nett NKL</span>
            <p className={`text-xs font-extrabold font-mono mt-0.5 ${kpis.totalNettNKLValRp < 0 ? 'text-rose-400' : 'text-indigo-300'}`}>
              {formatRupiah(kpis.totalNettNKLValRp)}
            </p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 min-w-[240px] items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Cari Kode / Nama Toko, No. BA, AM, AS, Korlap..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-hidden text-slate-800 placeholder-slate-400 text-xs"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">×</button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Tanggal Spesifik */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 border border-slate-200 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-xs text-slate-700 outline-hidden font-medium"
            />
            {selectedDate && (
              <button 
                onClick={() => setSelectedDate('')}
                className="text-[10px] text-rose-600 font-bold px-1 hover:bg-rose-50 rounded"
              >
                Reset
              </button>
            )}
          </div>

          {/* Bulan */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium"
          >
            <option value="ALL">Semua Bulan</option>
            <option value="01">Januari</option>
            <option value="02">Februari</option>
            <option value="03">Maret</option>
            <option value="04">April</option>
            <option value="05">Mei</option>
            <option value="06">Juni</option>
            <option value="07">Juli</option>
            <option value="08">Agustus</option>
            <option value="09">September</option>
            <option value="10">Oktober</option>
            <option value="11">November</option>
            <option value="12">Desember</option>
          </select>

          {/* Wilayah */}
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium"
          >
            <option value="ALL">Semua Wilayah</option>
            {REGION_OPTIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Korlap / Tim */}
          <select
            value={selectedKorlap}
            onChange={(e) => setSelectedKorlap(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium"
          >
            <option value="ALL">Semua Korlap / Tim</option>
            {korlapList.map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Comprehensive Results Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-amber-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              Rekapitulasi Data Hasil SO ({filteredResults.length} Toko)
            </h3>
          </div>
          <button
            onClick={handleExportFullExcel}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Rekap Lengkap</span>
          </button>
        </div>

        {filteredResults.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700">Tidak ada data rekapan hasil SO</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Coba ubah filter tanggal, bulan, atau wilayah untuk melihat data inputan hasil SO personil.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3.5">Toko & BA</th>
                  <th className="py-3 px-3.5">Tanggal & Tim</th>
                  <th className="py-3 px-3.5">Nilai Fisik vs System</th>
                  <th className="py-3 px-3.5">Nota Kurang / Lebih (NKL)</th>
                  <th className="py-3 px-3.5">SO Brankas Toko</th>
                  <th className="py-3 px-3.5">Kondisi & Audit Toko</th>
                  <th className="py-3 px-3.5">Status SPV</th>
                  <th className="py-3 px-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResults.map((r) => {
                  const b = r.brankasReport;
                  const nettNKL = r.nettNKLValRp || 0;
                  const selisihBrankas = b?.selisihBrankasRp || b?.selisihSalesRp || 0;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition group">
                      {/* Toko & BA */}
                      <td className="py-3 px-3.5">
                        <div className="font-extrabold text-slate-900">
                          <span className="font-mono text-indigo-600 mr-1">[{r.storeCode}]</span>
                          <span>{r.storeName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="font-mono font-bold text-slate-600">BA: {r.baNumber}</span>
                          <span>• {r.region}</span>
                        </div>
                        {(r.namaAM || r.namaAS) && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            AM: <strong className="text-slate-700">{r.namaAM || '-'}</strong> | AS: <strong className="text-slate-700">{r.namaAS || '-'}</strong>
                          </div>
                        )}
                      </td>

                      {/* Tanggal & Tim */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-800 font-mono">{r.soDate}</div>
                        <div className="text-[10px] text-indigo-700 font-medium">{r.executedByTeam}</div>
                        {r.officerInCharge && (
                          <div className="text-[10px] text-slate-500">Korlap: {r.officerInCharge}</div>
                        )}
                      </td>

                      {/* Nilai Fisik vs System */}
                      <td className="py-3 px-3.5">
                        <div className="text-[11px] text-slate-600">
                          Sys: <span className="font-mono font-medium">{formatRupiah(r.systemValueTotalRp)}</span>
                        </div>
                        <div className="text-[11px] text-slate-600">
                          Fisik: <span className="font-mono font-medium">{formatRupiah(r.physicalValueTotalRp)}</span>
                        </div>
                        <div className={`font-mono text-xs font-black mt-0.5 ${r.varianceValueTotalRp < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          Selisih: {r.varianceValueTotalRp > 0 ? '+' : ''}{formatRupiah(r.varianceValueTotalRp)}
                        </div>
                      </td>

                      {/* NKL */}
                      <td className="py-3 px-3.5">
                        <div className="text-[10px] text-rose-600">
                          NK: <span className="font-mono font-bold">{formatRupiah(r.notaKurangNKValRp || 0)}</span>
                        </div>
                        <div className="text-[10px] text-emerald-600">
                          NL: <span className="font-mono font-bold">{formatRupiah(r.notaLebihNLValRp || 0)}</span>
                        </div>
                        <div className={`font-mono text-xs font-black mt-0.5 ${nettNKL < 0 ? 'text-rose-700' : 'text-indigo-700'}`}>
                          Nett: {formatRupiah(nettNKL)}
                        </div>
                      </td>

                      {/* SO Brankas */}
                      <td className="py-3 px-3.5">
                        {b ? (
                          <>
                            <div className="text-[10px] text-slate-600">
                              Target Kasir: <span className="font-mono">{formatRupiah(b.uangSalesTutupShiftRp || 0)}</span>
                            </div>
                            <div className="text-[10px] text-slate-600">
                              Fisik Kasir: <span className="font-mono">{formatRupiah(b.totalFisikSalesRp || 0)}</span>
                            </div>
                            <div className={`font-mono text-[11px] font-bold mt-0.5 ${selisihBrankas < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              Selisih: {formatRupiah(selisihBrankas)}
                            </div>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Belum diinput</span>
                        )}
                      </td>

                      {/* Kondisi Toko */}
                      <td className="py-3 px-3.5">
                        <div className="flex flex-wrap items-center gap-1 text-[9px]">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            Kolian: {r.storeCondition?.gudangKolian || 'Rapi'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            Rak: {r.storeCondition?.gudangRak || 'Rapi'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            Toko: {r.storeCondition?.areaToko || 'Rapi'}
                          </span>
                        </div>
                        {r.notesAndActionPlan && (
                          <div className="text-[10px] text-slate-500 truncate max-w-xs mt-1" title={r.notesAndActionPlan}>
                            📝 {r.notesAndActionPlan}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.approvalStatus === 'Disetujui' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                            : 'bg-amber-50 text-amber-700 border border-amber-300'
                        }`}>
                          {r.approvalStatus}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-right">
                        <button
                          onClick={() => onViewDetailResult(r)}
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center gap-1 ml-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detail BA</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

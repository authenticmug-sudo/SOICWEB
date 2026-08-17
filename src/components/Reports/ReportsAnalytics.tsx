import React, { useMemo } from 'react';
import { 
  BarChart3, 
  Download, 
  Printer, 
  ShieldCheck, 
  TrendingUp, 
  DollarSign, 
  Building2, 
  CheckCircle2,
  ClipboardCheck,
  Users,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  ArrowUpRight,
  HeartPulse,
  CalendarOff,
  UserCheck,
  UserX,
  Activity,
  UserMinus
} from 'lucide-react';
import { Store, SOSchedule, SOResult, DashboardSummary, AuditorPersonnel } from '../../types/stockOpname';
import { formatRupiah, formatNumber, formatDateIndo } from '../../utils/formatters';
import { exportToCSV } from '../../services/storageService';

interface ReportsAnalyticsProps {
  stores: Store[];
  schedules: SOSchedule[];
  results: SOResult[];
  summary: DashboardSummary;
  personnel?: AuditorPersonnel[];
}

export const ReportsAnalytics: React.FC<ReportsAnalyticsProps> = ({
  stores,
  schedules,
  results,
  summary,
  personnel = []
}) => {
  const [personnelFilter, setPersonnelFilter] = React.useState<string>('Sakit_Cuti');

  // Total metrics
  const totalSchedules = schedules.length;
  const totalResultsSubmitted = results.length;
  const pendingResultsCount = Math.max(0, totalSchedules - totalResultsSubmitted);
  const reportingCompletionRate = totalSchedules > 0 
    ? Math.round((totalResultsSubmitted / totalSchedules) * 100) 
    : 0;

  // Personnel Status Calculations (Auto-Sync with Portal Admin)
  const totalPersonnel = personnel.length;
  const aktifPersonnel = personnel.filter(p => p.status === 'Aktif');
  const sakitPersonnel = personnel.filter(p => p.status === 'Sakit');
  const cutiPersonnel = personnel.filter(p => p.status === 'Cuti');
  const nonAktifPersonnel = personnel.filter(p => p.status === 'Non-Aktif');

  const filteredPersonnelList = useMemo(() => {
    if (personnelFilter === 'Sakit_Cuti') {
      return personnel.filter(p => p.status === 'Sakit' || p.status === 'Cuti');
    }
    if (personnelFilter === 'Sakit') return sakitPersonnel;
    if (personnelFilter === 'Cuti') return cutiPersonnel;
    if (personnelFilter === 'Non-Aktif') return nonAktifPersonnel;
    if (personnelFilter === 'Aktif') return aktifPersonnel;
    return personnel;
  }, [personnel, personnelFilter, sakitPersonnel, cutiPersonnel, nonAktifPersonnel, aktifPersonnel]);

  // Breakdown per Korlap / Team SO
  const korlapReportingBreakdown = useMemo(() => {
    const map: Record<string, {
      korlapName: string;
      schedules: SOSchedule[];
      results: SOResult[];
    }> = {};

    schedules.forEach(s => {
      const korlapKey = s.officerInCharge ? s.officerInCharge.split(' (')[0].trim() : 'Tanpa Korlap';
      if (!map[korlapKey]) {
        map[korlapKey] = { korlapName: korlapKey, schedules: [], results: [] };
      }
      map[korlapKey].schedules.push(s);
    });

    results.forEach(r => {
      // Find matching schedule to associate Korlap
      const matchSched = schedules.find(s => s.storeCode === r.storeCode || s.id === r.scheduleId);
      const korlapKey = matchSched?.officerInCharge 
        ? matchSched.officerInCharge.split(' (')[0].trim() 
        : 'Tanpa Korlap';

      if (!map[korlapKey]) {
        map[korlapKey] = { korlapName: korlapKey, schedules: [], results: [] };
      }
      map[korlapKey].results.push(r);
    });

    return Object.values(map).map(item => {
      const totalScheduled = item.schedules.length;
      const totalSubmitted = item.results.length;
      const pct = totalScheduled > 0 ? Math.round((totalSubmitted / totalScheduled) * 100) : 0;
      
      const sumVariance = item.results.reduce((acc, curr) => acc + curr.varianceValueTotalRp, 0);
      const avgAccuracy = item.results.length > 0
        ? +(item.results.reduce((acc, curr) => acc + curr.accuracyRatePercentage, 0) / item.results.length).toFixed(2)
        : 100;

      return {
        korlapName: item.korlapName,
        totalScheduled,
        totalSubmitted,
        pct,
        sumVariance,
        avgAccuracy
      };
    });
  }, [schedules, results]);

  const handleExportFullReport = () => {
    const data = results.map(r => ({
      'No. BA': r.baNumber,
      'Kode Toko': r.storeCode,
      'Nama Toko': r.storeName,
      'Wilayah': r.region,
      'Tanggal Exec': r.soDate,
      'Tim Auditor': r.executedByTeam,
      'System Value (Rp)': r.systemValueTotalRp,
      'Physical Value (Rp)': r.physicalValueTotalRp,
      'Selisih Value (Rp)': r.varianceValueTotalRp,
      'Nett NKL (Rp)': r.nettNKLValRp || 0,
      'Selisih Brankas (Rp)': r.brankasReport?.selisihBrankasRp || 0,
      'Status Approval SPV': r.approvalStatus
    }));
    exportToCSV('Laporan_Eksekutif_SO.csv', data);
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Portal Admin Laporan & Analytics SPV Stock Opname
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Dashboard pemantauan jumlah toko SO, status rekapan tersinkronisasi dari Korlap, dan analisis selisih nasional.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintReport}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-300 transition flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            Cetak Laporan
          </button>

          <button
            onClick={handleExportFullReport}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download Laporan CSV
          </button>
        </div>
      </div>

      {/* DASHBOARD STATUS REKAPAN DILAPORKAN TEAM SO */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-indigo-900/60 pb-3">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
              REALTIME SINKRONISASI PORTAL ADMIN & KORLAP
            </span>
            <h3 className="text-lg font-extrabold text-white mt-1">
              Dashboard Jumlah Toko SO & Rekapan Pelaporan Team SO
            </h3>
          </div>
          <span className="text-xs text-slate-300 bg-white/10 px-3 py-1 rounded-full font-medium">
            Agustus 2026
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/15">
            <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Total Toko Terjadwal SO</span>
            <p className="text-3xl font-extrabold text-white mt-1 font-mono">{totalSchedules}</p>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" /> Target Toko SO Bulan Ini
            </p>
          </div>

          <div className="p-4 bg-emerald-500/15 backdrop-blur-md rounded-xl border border-emerald-500/30">
            <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">Rekapan Dilaporkan Team</span>
            <p className="text-3xl font-extrabold text-emerald-400 mt-1 font-mono">{totalResultsSubmitted}</p>
            <p className="text-[11px] text-emerald-300 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Tersinkron Ke Admin SPV
            </p>
          </div>

          <div className="p-4 bg-indigo-500/15 backdrop-blur-md rounded-xl border border-indigo-500/30">
            <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">Rasio Pelaporan Masuk</span>
            <p className="text-3xl font-extrabold text-indigo-300 mt-1 font-mono">{reportingCompletionRate}%</p>
            <p className="text-[11px] text-indigo-200 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Progress Pelaporan Team SO
            </p>
          </div>

          <div className="p-4 bg-amber-500/15 backdrop-blur-md rounded-xl border border-amber-500/30">
            <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">Sisa Toko Belum Rekap</span>
            <p className="text-3xl font-extrabold text-amber-300 mt-1 font-mono">{pendingResultsCount}</p>
            <p className="text-[11px] text-amber-200 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Menunggu Input Korlap
            </p>
          </div>

        </div>
      </div>

      {/* REKAPAN STATUS PER KORLAP / OFFICER */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Progres Laporan Rekapan SO per Korlap / Team Officer
            </h3>
            <p className="text-xs text-slate-500">
              Rincian jumlah toko dihandle, rekapan terlapor, dan progres penyelesaian SO per Korlap.
            </p>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                <th className="py-2.5 px-3">Nama Korlap / Officer</th>
                <th className="py-2.5 px-3 text-center">Target Toko SO</th>
                <th className="py-2.5 px-3 text-center">Rekapan Dilaporkan</th>
                <th className="py-2.5 px-3 text-center">Progress Laporan</th>
                <th className="py-2.5 px-3 text-right">Net Selisih (Rp)</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {korlapReportingBreakdown.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition">
                  <td className="py-2.5 px-3 font-bold text-slate-900">{item.korlapName}</td>
                  <td className="py-2.5 px-3 text-center font-mono font-semibold">{item.totalScheduled} Toko</td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700">{item.totalSubmitted} Laporan</td>
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-600 h-full" style={{ width: `${item.pct}%` }} />
                      </div>
                      <span className="font-bold text-[11px] font-mono">{item.pct}%</span>
                    </div>
                  </td>
                  <td className={`py-2.5 px-3 text-right font-mono font-bold ${item.sumVariance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatRupiah(item.sumVariance)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      item.pct === 100 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      {item.pct === 100 ? 'LENGKAP 100%' : `Dalam Proses (${item.totalSubmitted}/${item.totalScheduled})`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Report Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm space-y-6">
        
        {/* Title & Date */}
        <div className="pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">
              Internal Executive Audit Report
            </span>
            <h3 className="text-lg font-extrabold text-slate-900">
              REKAPITULASI HASIL STOCK OPNAME TAHUN 2026
            </h3>
            <p className="text-xs text-slate-500">
              Supervisor Penanggung Jawab: Gean Pratama | Wilayah: 12 Region Nasional
            </p>
          </div>

          <div className="text-right">
            <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-bold text-xs">
              Status Audit: ON TARGET
            </span>
          </div>
        </div>

        {/* Top Key Performance Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Toko Dikelola</span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{formatNumber(summary.totalStores)}</p>
            <p className="text-[11px] text-slate-500 mt-1">100% Terdaftar di System</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400">Persentase Selesai SO</span>
            <p className="text-2xl font-extrabold text-indigo-700 mt-1">
              {summary.scheduledThisMonth > 0 ? Math.round((summary.completedThisMonth / summary.scheduledThisMonth) * 100) : 100}%
            </p>
            <p className="text-[11px] text-emerald-600 mt-1">{summary.completedThisMonth} dari {summary.scheduledThisMonth} Toko Terjadwal</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Toko Selesai SO</span>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1">{summary.completedThisMonth}</p>
            <p className="text-[11px] text-slate-500 mt-1">Bulan Agustus 2026</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400">Net Selisih (Variance)</span>
            <p className={`text-2xl font-extrabold font-mono mt-1 ${summary.totalVarianceRp < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {formatRupiah(summary.totalVarianceRp)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Net Physical vs System</p>
          </div>
        </div>

        {/* Detailed Summary Table */}
        <div>
          <h4 className="font-bold text-slate-900 mb-3 text-xs uppercase tracking-wider">
            Rincian Toko Hasil Rekapan SO
          </h4>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-2.5 px-3">Kode & Toko</th>
                  <th className="py-2.5 px-3">Wilayah</th>
                  <th className="py-2.5 px-3 text-right">System Value (Rp)</th>
                  <th className="py-2.5 px-3 text-right">Physical Value (Rp)</th>
                  <th className="py-2.5 px-3 text-right">Selisih (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.slice(0, 10).map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{r.storeName} ({r.storeCode})</td>
                    <td className="py-2.5 px-3 text-slate-600">{r.region}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{formatRupiah(r.systemValueTotalRp)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{formatRupiah(r.physicalValueTotalRp)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      <span className={r.varianceValueTotalRp < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                        {formatRupiah(r.varianceValueTotalRp)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};

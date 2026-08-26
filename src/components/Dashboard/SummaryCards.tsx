import React from 'react';
import { 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  Percent, 
  FileCheck,
  ShieldAlert,
  Flame,
  Clock,
  ArrowRight
} from 'lucide-react';
import { DashboardSummary } from '../../types/stockOpname';
import { formatRupiah, formatNumber } from '../../utils/formatters';

interface SummaryCardsProps {
  summary: DashboardSummary;
  onNavigateTab: (tab: 'schedules' | 'results' | 'stores') => void;
  onFilterZonaHitam?: () => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary, onNavigateTab, onFilterZonaHitam }) => {
  const achPercent = summary.achievePercentZonaHitam ?? (summary.totalZonaHitam > 0 ? Math.round((summary.zonaHitamTerSO / summary.totalZonaHitam) * 100) : 0);

  return (
    <div className="space-y-3">
      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        
        {/* Total Toko Managed */}
        <div 
          onClick={() => onNavigateTab('stores')}
          className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <p className="text-slate-500 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
              Total Master Toko
            </p>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-1">
            {formatNumber(summary.totalStores)}
          </p>
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 mt-1.5">
            <span className="text-emerald-600 font-semibold">Wilayah BALI</span>
            <span className="font-medium text-slate-600">{summary.totalZonaHitam} Zona Hitam</span>
          </div>
        </div>

        {/* Zona Hitam Achievement Highlight Card */}
        <div 
          onClick={() => {
            if (onFilterZonaHitam) onFilterZonaHitam();
            else onNavigateTab('stores');
          }}
          className="bg-gradient-to-br from-slate-900 via-slate-800 to-rose-950 text-white p-3 sm:p-3.5 rounded-xl border border-slate-700 shadow-xs hover:border-rose-500/50 transition cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <p className="text-rose-300 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
                Zona Hitam (High-Risk)
              </p>
            </div>
            <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 group-hover:bg-rose-500 group-hover:text-white transition">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          
          <div className="mt-1 flex items-baseline justify-between relative z-10">
            <p className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {summary.totalZonaHitam} <span className="text-xs font-normal text-slate-300">Toko</span>
            </p>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              achPercent >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
              achPercent >= 50 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
              'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}>
              {achPercent}% Ach
            </span>
          </div>

          <div className="w-full bg-slate-700/60 h-1.5 mt-2 rounded-full overflow-hidden relative z-10">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                achPercent >= 80 ? 'bg-emerald-400' :
                achPercent >= 50 ? 'bg-amber-400' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, achPercent)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-300 mt-1.5 relative z-10 font-medium">
            <span className="text-emerald-400 font-bold">{summary.zonaHitamTerSO} Ter-SO</span>
            <span className="text-rose-300 font-bold">{summary.zonaHitamBelumSO} Belum SO</span>
          </div>
        </div>

        {/* Progress SO Bulan Ini */}
        <div 
          onClick={() => onNavigateTab('schedules')}
          className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <p className="text-slate-500 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
              Selesai Bulan Ini
            </p>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <p className="text-xl sm:text-2xl font-extrabold text-slate-800">
              {summary.completedThisMonth}
            </p>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500">
              Tgt {summary.scheduledThisMonth} Toko
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 mt-2 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${summary.scheduledThisMonth > 0 ? Math.min(100, Math.round((summary.completedThisMonth / summary.scheduledThisMonth) * 100)) : 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 mt-1.5">
            <span className="text-indigo-600 font-medium">{summary.inProgressCount} Sedang Proses</span>
            <span className="font-semibold text-slate-700">{summary.scheduledThisMonth > 0 ? Math.round((summary.completedThisMonth / summary.scheduledThisMonth) * 100) : 0}% Selesai</span>
          </div>
        </div>

        {/* Approval Pending & Variance */}
        <div 
          onClick={() => onNavigateTab('results')}
          className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <p className="text-slate-500 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
              Pending SPV Approval
            </p>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <p className="text-xl sm:text-2xl font-extrabold text-amber-600">
              {summary.pendingApprovalCount}
            </p>
            {summary.pendingApprovalCount > 0 ? (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                Needs Review
              </span>
            ) : (
              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                Semua Clear
              </span>
            )}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-2 truncate">
            Net Var: <strong className={summary.totalVarianceRp < 0 ? 'text-rose-600 font-mono font-bold' : 'text-emerald-600 font-mono font-bold'}>{formatRupiah(summary.totalVarianceRp)}</strong>
          </p>
        </div>

      </div>

      {/* Zona Hitam Deep-Dive Widget Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm sm:text-base text-white">
                Monitoring Pencapaian Toko Zona Hitam (Audit Prioritas)
              </h4>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-900/60 text-rose-300 px-2 py-0.5 rounded-md border border-rose-700/50">
                Wajib SO
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Target kepatuhan audit untuk toko-toko berkategori Zona Hitam berdasarkan persetujuan jadwal master & bulan berjalan.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
          <div className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block font-medium">Total Zona Hitam</span>
            <span className="text-sm font-black text-white">{summary.totalZonaHitam} Toko</span>
          </div>

          <div className="bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-800/50">
            <span className="text-[10px] text-emerald-400 block font-medium">Sudah Ter-SO (Disetujui)</span>
            <span className="text-sm font-black text-emerald-300">{summary.zonaHitamTerSO} Toko</span>
          </div>

          <div className="bg-rose-950/40 px-3 py-1.5 rounded-lg border border-rose-800/50">
            <span className="text-[10px] text-rose-400 block font-medium">Belum SO</span>
            <span className="text-sm font-black text-rose-300">{summary.zonaHitamBelumSO} Toko</span>
          </div>

          <div className="bg-indigo-950/40 px-3 py-1.5 rounded-lg border border-indigo-800/50">
            <span className="text-[10px] text-indigo-300 block font-medium">Presentase Pencapaian</span>
            <span className="text-sm font-black text-indigo-200">{achPercent}% Ach</span>
          </div>

          <button
            onClick={() => {
              if (onFilterZonaHitam) onFilterZonaHitam();
              else onNavigateTab('stores');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-xs cursor-pointer ml-auto md:ml-0"
          >
            <span>Lihat Daftar Toko</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};


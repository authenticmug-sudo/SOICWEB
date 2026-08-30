import React, { useState } from 'react';
import { 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  Percent, 
  FileCheck,
  ShieldAlert,
  Flame,
  Clock,
  ArrowRight,
  Target,
  SlidersHorizontal,
  Check,
  Layers,
  Sparkles,
  CalendarCheck2
} from 'lucide-react';
import { DashboardSummary } from '../../types/stockOpname';
import { formatRupiah, formatNumber } from '../../utils/formatters';

interface SummaryCardsProps {
  summary: DashboardSummary;
  onNavigateTab: (tab: 'schedules' | 'results' | 'stores') => void;
  onFilterZonaHitam?: () => void;
  targetSoTypes?: string[];
  onChangeTargetTypes?: (types: string[]) => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ 
  summary, 
  onNavigateTab, 
  onFilterZonaHitam,
  targetSoTypes = ['M', 'Q3'],
  onChangeTargetTypes
}) => {
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const achPercentZona = summary.achievePercentZonaHitam ?? (summary.totalZonaHitam > 0 ? Math.round((summary.zonaHitamTerSO / summary.totalZonaHitam) * 100) : 0);
  const achPercentWajib = summary.achievePercentWajibSO ?? (summary.totalTokoWajibSO > 0 ? Math.round((summary.tokoWajibSOTerSO / summary.totalTokoWajibSO) * 100) : 0);

  const ALL_POSSIBLE_TYPES = ['M', 'Q3', 'Q1', 'Q2'];

  const handleToggleType = (type: string) => {
    if (!onChangeTargetTypes) return;
    const upper = type.toUpperCase();
    if (targetSoTypes.includes(upper)) {
      if (targetSoTypes.length === 1) return; // Keep at least one
      onChangeTargetTypes(targetSoTypes.filter(t => t !== upper));
    } else {
      onChangeTargetTypes([...targetSoTypes, upper]);
    }
  };

  const handleSetPresetSeptember = () => {
    if (onChangeTargetTypes) {
      onChangeTargetTypes(['M', 'Q3']);
    }
  };

  const handleSetPresetAll = () => {
    if (onChangeTargetTypes) {
      onChangeTargetTypes(['M', 'Q1', 'Q2', 'Q3']);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Primary KPI Cards Grid (5-column responsive) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
        
        {/* 1. Total Master Toko */}
        <div 
          onClick={() => onNavigateTab('stores')}
          className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer group flex flex-col justify-between"
        >
          <div>
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
          </div>
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 mt-2 pt-1 border-t border-slate-100">
            <span className="text-emerald-600 font-semibold">Wilayah BALI</span>
            <span className="font-medium text-slate-600">{summary.totalZonaHitam} Zona Hitam</span>
          </div>
        </div>

        {/* 2. Toko Wajib SO (Type M & Q3 / Target Acuan) */}
        <div 
          onClick={() => onNavigateTab('stores')}
          className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white p-3 sm:p-3.5 rounded-xl border border-indigo-700/60 shadow-xs hover:border-indigo-500 transition cursor-pointer group relative overflow-hidden flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                <p className="text-indigo-300 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
                  Wajib SO (Type {targetSoTypes.join(' & ')})
                </p>
              </div>
              <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 group-hover:bg-indigo-600 group-hover:text-white transition">
                <Target className="w-4 h-4" />
              </div>
            </div>
            
            <div className="mt-1 flex items-baseline justify-between relative z-10">
              <p className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {summary.totalTokoWajibSO ?? 0} <span className="text-xs font-normal text-slate-300">Toko</span>
              </p>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                achPercentWajib >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                achPercentWajib >= 50 ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {achPercentWajib}% Ach
              </span>
            </div>
          </div>

          <div className="relative z-10 mt-2">
            <div className="w-full bg-slate-700/60 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  achPercentWajib >= 80 ? 'bg-emerald-400' :
                  achPercentWajib >= 50 ? 'bg-indigo-400' : 'bg-amber-400'
                }`}
                style={{ width: `${Math.min(100, achPercentWajib)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-300 mt-1.5 font-medium">
              <span className="text-emerald-400 font-bold">{summary.tokoWajibSOTerSO ?? 0} Ter-SO</span>
              <span className="text-rose-300 font-bold">{summary.tokoWajibSOBelumSO ?? 0} Belum</span>
            </div>
          </div>
        </div>

        {/* 3. Zona Hitam Achievement Highlight Card */}
        <div 
          onClick={() => {
            if (onFilterZonaHitam) onFilterZonaHitam();
            else onNavigateTab('stores');
          }}
          className="bg-gradient-to-br from-slate-900 via-slate-800 to-rose-950 text-white p-3 sm:p-3.5 rounded-xl border border-slate-700 shadow-xs hover:border-rose-500/50 transition cursor-pointer group relative overflow-hidden flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <p className="text-rose-300 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
                  Zona Hitam (Prioritas)
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
                achPercentZona >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                achPercentZona >= 50 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {achPercentZona}% Ach
              </span>
            </div>
          </div>

          <div className="relative z-10 mt-2">
            <div className="w-full bg-slate-700/60 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  achPercentZona >= 80 ? 'bg-emerald-400' :
                  achPercentZona >= 50 ? 'bg-amber-400' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, achPercentZona)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-300 mt-1.5 font-medium">
              <span className="text-emerald-400 font-bold">{summary.zonaHitamTerSO} Ter-SO</span>
              <span className="text-rose-300 font-bold">{summary.zonaHitamBelumSO} Belum SO</span>
            </div>
          </div>
        </div>

        {/* 4. Progress SO Selesai Bulan Ini */}
        <div 
          onClick={() => onNavigateTab('schedules')}
          className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <p className="text-slate-500 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
                Selesai / Terjadwal
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
          </div>

          <div className="mt-2">
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
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
        </div>

        {/* 5. Approval Pending & Variance */}
        <div 
          onClick={() => onNavigateTab('results')}
          className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer group flex flex-col justify-between col-span-2 sm:col-span-2 lg:col-span-1"
        >
          <div>
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
          </div>

          <div className="mt-2 pt-1 border-t border-slate-100">
            <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">
              Net Var: <strong className={summary.totalVarianceRp < 0 ? 'text-rose-600 font-mono font-bold' : 'text-emerald-600 font-mono font-bold'}>{formatRupiah(summary.totalVarianceRp)}</strong>
            </p>
          </div>
        </div>

      </div>

      {/* Widget Interaktif 1: Kontrol & Monitoring Pencapaian Toko Wajib SO (Type M & Q3) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-800/60 rounded-xl p-3 sm:p-4 text-white shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0 text-indigo-300">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm sm:text-base text-white">
                  Target Acuan Toko Wajib SO
                </h4>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-md border border-indigo-400/40">
                  Bulan September 2026: Type {targetSoTypes.join(' + ')}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Perhitungan otomatis jumlah toko wajib SO berdasarkan kolom <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300 font-mono">Type SO</code> dan kolom tanggal <code className="bg-slate-800 px-1 py-0.5 rounded text-emerald-300 font-mono">SO SEPTEMBER &apos;26</code>.
              </p>
            </div>
          </div>

          {/* Interactive Type Selector Chips */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-[11px] font-semibold text-slate-400">Pilih Acuan Type:</span>
            {ALL_POSSIBLE_TYPES.map(type => {
              const isSelected = targetSoTypes.includes(type);
              const countForType = summary.breakdownTypeSO?.[type]?.total ?? 0;
              const terSoCount = summary.breakdownTypeSO?.[type]?.terSO ?? 0;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleToggleType(type)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-xs'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                  title={`Klik untuk ${isSelected ? 'menonaktifkan' : 'mengaktifkan'} acuan Type ${type}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-slate-500'}`} />
                  <span>Type {type}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-700 text-slate-400'}`}>
                    {countForType} toko ({terSoCount} SO)
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleSetPresetSeptember}
              className="text-[11px] text-amber-300 hover:text-amber-200 underline font-semibold ml-1 cursor-pointer"
            >
              Reset ke Acuan September (M + Q3)
            </button>
          </div>
        </div>

        {/* Target Real-time Metrics Summary & Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
          <div className="bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-700/80">
            <span className="text-[10px] text-slate-400 block font-medium">Total Wajib SO</span>
            <span className="text-sm font-black text-white">{summary.totalTokoWajibSO ?? 0} Toko</span>
          </div>

          <div className="bg-emerald-950/50 px-3 py-1.5 rounded-lg border border-emerald-700/60">
            <span className="text-[10px] text-emerald-400 block font-medium">Sudah Ter-SO</span>
            <span className="text-sm font-black text-emerald-300">{summary.tokoWajibSOTerSO ?? 0} Toko</span>
          </div>

          <div className="bg-rose-950/50 px-3 py-1.5 rounded-lg border border-rose-700/60">
            <span className="text-[10px] text-rose-400 block font-medium">Belum SO</span>
            <span className="text-sm font-black text-rose-300">{summary.tokoWajibSOBelumSO ?? 0} Toko</span>
          </div>

          <div className="bg-indigo-950/50 px-3 py-1.5 rounded-lg border border-indigo-700/60">
            <span className="text-[10px] text-indigo-300 block font-medium">Realisasi</span>
            <span className="text-sm font-black text-indigo-200">{achPercentWajib}% Ach</span>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('stores')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-xs cursor-pointer ml-auto lg:ml-0 active:scale-95"
          >
            <span>Lihat Daftar Toko Wajib</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Widget Interaktif 2: Zona Hitam Deep-Dive Widget Banner */}
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
            <span className="text-sm font-black text-indigo-200">{achPercentZona}% Ach</span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onFilterZonaHitam) onFilterZonaHitam();
              else onNavigateTab('stores');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-xs cursor-pointer ml-auto md:ml-0 active:scale-95"
          >
            <span>Lihat Daftar Toko</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};



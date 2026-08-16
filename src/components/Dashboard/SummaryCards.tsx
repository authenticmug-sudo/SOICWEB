import React from 'react';
import { 
  Building2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Percent, 
  TrendingDown, 
  TrendingUp, 
  FileCheck
} from 'lucide-react';
import { DashboardSummary } from '../../types/stockOpname';
import { formatRupiah, formatNumber } from '../../utils/formatters';

interface SummaryCardsProps {
  summary: DashboardSummary;
  onNavigateTab: (tab: 'schedules' | 'results' | 'stores') => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary, onNavigateTab }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
      
      {/* Total Toko Managed */}
      <div 
        onClick={() => onNavigateTab('stores')}
        className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <p className="text-slate-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
            Total Stores
          </p>
          <div className="p-1 rounded bg-slate-100 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition">
            <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <p className="text-lg sm:text-2xl font-extrabold text-slate-800 mt-0.5">
          {formatNumber(summary.totalStores)}
        </p>
        <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-slate-500 mt-1">
          <span className="text-emerald-600 font-medium">12 Region</span>
          <span className="hidden sm:inline">{summary.highRiskStoreCount} High-Risk</span>
        </div>
      </div>

      {/* Progress SO Bulan Ini */}
      <div 
        onClick={() => onNavigateTab('schedules')}
        className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <p className="text-slate-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
            Selesai Bulan Ini
          </p>
          <div className="p-1 rounded bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="mt-0.5 flex items-baseline justify-between">
          <p className="text-lg sm:text-2xl font-extrabold text-slate-800">
            {summary.completedThisMonth}
          </p>
          <span className="text-[9px] sm:text-[10px] text-slate-500">
            Tgt {summary.scheduledThisMonth}
          </span>
        </div>
        <div className="w-full bg-slate-100 h-1.5 mt-1 sm:mt-2 rounded-full overflow-hidden">
          <div 
            className="bg-indigo-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${summary.scheduledThisMonth > 0 ? Math.min(100, Math.round((summary.completedThisMonth / summary.scheduledThisMonth) * 100)) : 0}%` }}
          />
        </div>
      </div>

      {/* Rata-Rata Akurasi Stok */}
      <div 
        onClick={() => onNavigateTab('results')}
        className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <p className="text-slate-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
            Avg. Accuracy
          </p>
          <div className="p-1 rounded bg-blue-50 text-indigo-600">
            <Percent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <p className="text-lg sm:text-2xl font-extrabold text-slate-800 mt-0.5">
          {summary.avgAccuracyRate}%
        </p>
        <div className="flex items-center justify-between text-[9px] sm:text-[10px] mt-1">
          <span className="text-emerald-600 font-medium">Tgt: &gt;98%</span>
          <span className="text-slate-500 hidden sm:inline">Achieved</span>
        </div>
      </div>

      {/* Approval Pending & Variance */}
      <div 
        onClick={() => onNavigateTab('results')}
        className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            Pending SPV Approval
          </p>
          <div className="p-1.5 rounded bg-amber-50 text-amber-600">
            <FileCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <p className="text-2xl font-bold text-amber-600">
            {summary.pendingApprovalCount}
          </p>
          {summary.pendingApprovalCount > 0 && (
            <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
              Needs Review
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5 truncate">
          Net Var: <strong className={summary.totalVarianceRp < 0 ? 'text-rose-600 font-mono' : 'text-emerald-600 font-mono'}>{formatRupiah(summary.totalVarianceRp)}</strong>
        </p>
      </div>

    </div>
  );
};

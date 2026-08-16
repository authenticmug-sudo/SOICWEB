import React from 'react';
import { Clock, Award, Sparkles } from 'lucide-react';
import { calculateLamaBekerja, formatDateIndo, parseSmartDate } from '../../utils/formatters';

interface LamaBekerjaBadgeProps {
  joinDate: string;
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
}

export const LamaBekerjaBadge: React.FC<LamaBekerjaBadgeProps> = ({
  joinDate,
  className = '',
  showIcon = true,
  compact = false
}) => {
  if (!joinDate) {
    return <span className="text-slate-400 italic text-xs">-</span>;
  }

  const startDate = parseSmartDate(joinDate);
  const refDate = new Date();

  if (!startDate || isNaN(startDate.getTime())) {
    return <span className="text-slate-400 italic text-xs">-</span>;
  }

  let years = refDate.getFullYear() - startDate.getFullYear();
  let months = refDate.getMonth() - startDate.getMonth();
  let days = refDate.getDate() - startDate.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthLastDay = new Date(refDate.getFullYear(), refDate.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  // Determine tenure status tier
  let tierLabel = 'Junior';
  let tierColor = 'bg-slate-100 text-slate-700 border-slate-300';
  let badgeTheme = 'from-emerald-50/90 to-teal-50/90 border-emerald-200/90 text-emerald-900';

  if (years >= 5) {
    tierLabel = 'Senior Veteran (5+ Thn)';
    tierColor = 'bg-indigo-600 text-white border-indigo-700';
    badgeTheme = 'from-emerald-50 via-teal-50 to-indigo-50/60 border-emerald-300 text-emerald-950';
  } else if (years >= 2) {
    tierLabel = 'Medior Staff (2+ Thn)';
    tierColor = 'bg-teal-600 text-white border-teal-700';
    badgeTheme = 'from-emerald-50 to-teal-50 border-emerald-200 text-emerald-900';
  } else {
    tierLabel = 'Staff Newbie';
    tierColor = 'bg-emerald-600 text-white border-emerald-700';
    badgeTheme = 'from-slate-50 to-emerald-50 border-emerald-200 text-slate-800';
  }

  const formattedJoinDate = formatDateIndo(joinDate);

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] whitespace-nowrap bg-emerald-50 border border-emerald-200 text-emerald-800 ${className}`}>
        {showIcon && <Clock className="w-3 h-3 text-emerald-600 shrink-0" />}
        <span>{years > 0 ? `${years}th ` : ''}{months > 0 ? `${months}bln ` : ''}{days}hr</span>
      </span>
    );
  }

  return (
    <div className={`group relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r ${badgeTheme} border shadow-2xs hover:shadow-md transition-all duration-200 whitespace-nowrap cursor-pointer select-none ${className}`}>
      
      {showIcon && (
        <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform">
          <Clock className="w-3.5 h-3.5 text-emerald-700 animate-pulse" />
        </span>
      )}

      {/* Structured Numbers with distinct mini-pills */}
      <div className="flex items-center gap-1 text-xs font-black tracking-tight whitespace-nowrap">
        {years > 0 && (
          <span className="inline-flex items-baseline bg-white/90 px-1.5 py-0.5 rounded-md border border-emerald-200/80 shadow-2xs text-emerald-950 font-extrabold">
            {years}
            <span className="text-[10px] text-emerald-700 font-bold ml-0.5">Thn</span>
          </span>
        )}

        {(months > 0 || years > 0) && (
          <span className="inline-flex items-baseline bg-white/90 px-1.5 py-0.5 rounded-md border border-emerald-200/80 shadow-2xs text-emerald-950 font-extrabold">
            {months}
            <span className="text-[10px] text-emerald-700 font-bold ml-0.5">Bln</span>
          </span>
        )}

        <span className="inline-flex items-baseline bg-white/90 px-1.5 py-0.5 rounded-md border border-emerald-200/80 shadow-2xs text-emerald-950 font-extrabold">
          {days}
          <span className="text-[10px] text-emerald-700 font-bold ml-0.5">Hr</span>
        </span>
      </div>

      {/* Seniority Indicator Chip */}
      {years >= 3 && (
        <span className="hidden xl:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-100/90 text-indigo-800 border border-indigo-200/80 ml-0.5">
          <Award className="w-2.5 h-2.5 text-indigo-600" />
          {years >= 5 ? 'Senior' : 'Pro'}
        </span>
      )}

      {/* Interactive Tooltip on Hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col gap-1 w-56 p-2.5 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 z-50 text-[11px] pointer-events-none animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
          <span className="font-bold text-indigo-300 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Detail Masa Kerja
          </span>
          <span className={`px-1.5 py-0.2 text-[9px] font-extrabold rounded ${tierColor}`}>
            {tierLabel}
          </span>
        </div>
        
        <div className="space-y-1 text-slate-200 text-[10px]">
          <div className="flex justify-between">
            <span className="text-slate-400">Tgl Masuk:</span>
            <span className="font-bold text-white">{formattedJoinDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Total Akumulasi:</span>
            <span className="font-bold text-emerald-400">{years} Tahun, {months} Bulan, {days} Hari</span>
          </div>
        </div>

        {/* Tooltip triangle arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
      </div>

    </div>
  );
};

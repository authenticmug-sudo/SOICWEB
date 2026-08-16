import React from 'react';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  Filter, 
  Sparkles, 
  TrendingUp, 
  Users, 
  RotateCcw,
  Building2,
  Percent
} from 'lucide-react';
import { SOSchedule, SOResult } from '../../types/stockOpname';
import { formatRupiah } from '../../utils/formatters';

interface DailyProgressTrackerWidgetProps {
  schedules: SOSchedule[];
  results: SOResult[];
  selectedDate: string; // 'ALL' or 'YYYY-MM-DD'
  onSelectDate: (dateStr: string) => void;
  selectedMonth: string;
  selectedYear: string;
}

interface DailyGroupData {
  dateStr: string; // YYYY-MM-DD
  dayLabel: string; // e.g. Selasa, 04 Agu 2026
  schedules: SOSchedule[];
  results: SOResult[];
  totalTarget: number;
  completedCount: number;
  inProgressCount: number;
  scheduledCount: number;
  avgAccuracy: number;
  totalVarianceRp: number;
  progressPercent: number;
  officers: string[];
}

export const DailyProgressTrackerWidget: React.FC<DailyProgressTrackerWidgetProps> = ({
  schedules,
  results,
  selectedDate,
  onSelectDate,
  selectedMonth,
  selectedYear
}) => {
  // Extract all unique dates from schedules & results
  const dateMap: Record<string, { schedules: SOSchedule[]; results: SOResult[] }> = {};

  schedules.forEach(s => {
    if (!s.scheduledDate) return;
    if (!dateMap[s.scheduledDate]) {
      dateMap[s.scheduledDate] = { schedules: [], results: [] };
    }
    dateMap[s.scheduledDate].schedules.push(s);
  });

  results.forEach(r => {
    if (!r.soDate) return;
    if (!dateMap[r.soDate]) {
      dateMap[r.soDate] = { schedules: [], results: [] };
    }
    dateMap[r.soDate].results.push(r);
  });

  // Convert map to sorted array of daily data
  const sortedDates = Object.keys(dateMap).sort();

  const dailyGroups: DailyGroupData[] = sortedDates.map(dateStr => {
    const groupSchedules = dateMap[dateStr].schedules;
    const groupResults = dateMap[dateStr].results;

    const totalTarget = groupSchedules.length;
    const completedCount = groupSchedules.filter(s => s.status === 'Selesai').length;
    const inProgressCount = groupSchedules.filter(s => s.status === 'Proses SO').length;
    const scheduledCount = groupSchedules.filter(s => s.status === 'Terjadwal').length;

    let accuracySum = 0;
    let totalVarianceRp = 0;
    groupResults.forEach(r => {
      accuracySum += r.accuracyRatePercentage;
      totalVarianceRp += r.varianceValueTotalRp;
    });

    const avgAccuracy = groupResults.length > 0 ? +(accuracySum / groupResults.length).toFixed(2) : 0;
    const progressPercent = totalTarget > 0 ? Math.round((completedCount / totalTarget) * 100) : 0;

    // Collect unique officer names
    const officerSet = new Set<string>();
    groupSchedules.forEach(s => {
      if (s.officerInCharge) officerSet.add(s.officerInCharge);
    });

    // Format Day Label in Indonesian
    let dayLabel = dateStr;
    try {
      const d = new Date(dateStr + 'T00:00:00');
      dayLabel = d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      // fallback
    }

    return {
      dateStr,
      dayLabel,
      schedules: groupSchedules,
      results: groupResults,
      totalTarget,
      completedCount,
      inProgressCount,
      scheduledCount,
      avgAccuracy,
      totalVarianceRp,
      progressPercent,
      officers: Array.from(officerSet)
    };
  });

  // Calculate overall statistics for the current view
  const activeGroup = selectedDate !== 'ALL' ? dailyGroups.find(g => g.dateStr === selectedDate) : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      
      {/* Header & Filter Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-600">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Monitoring Progres SO Per Tanggal
                <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded font-semibold border border-indigo-200">
                  Daily Overview
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Pilih tanggal spesifik untuk memantau detail target, penyelesaian toko, akurasi, & variansi per hari.
              </p>
            </div>
          </div>
        </div>

        {/* Date Selector & Reset */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Calendar Picker Direct Input */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700">
            <span className="text-slate-500 font-semibold text-[11px]">Pilih Tanggal:</span>
            <input
              type="date"
              value={selectedDate === 'ALL' ? '' : selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  onSelectDate(e.target.value);
                } else {
                  onSelectDate('ALL');
                }
              }}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Quick Date Reset Button */}
          {selectedDate !== 'ALL' && (
            <button
              onClick={() => onSelectDate('ALL')}
              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 border border-amber-400/40 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Tampilkan Semua Tanggal
            </button>
          )}
        </div>
      </div>

      {/* Date Quick Filter Chips Strip */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-600">
          <span>📅 Pilihan Tanggal SO Bulan Ini ({dailyGroups.length} Hari):</span>
          {selectedDate !== 'ALL' && (
            <span className="text-indigo-600 font-semibold">
              Terfilter: {activeGroup?.dayLabel || selectedDate}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <button
            onClick={() => onSelectDate('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition flex items-center gap-1.5 border ${
              selectedDate === 'ALL'
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>Semua Tanggal</span>
            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">
              {schedules.length} SO
            </span>
          </button>

          {dailyGroups.map((group) => {
            const isSelected = selectedDate === group.dateStr;
            const shortDateStr = group.dateStr.split('-').slice(1).reverse().join('/'); // e.g. 04/08

            return (
              <button
                key={group.dateStr}
                onClick={() => onSelectDate(group.dateStr)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition flex items-center gap-2 border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm font-bold'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                }`}
              >
                <span>{shortDateStr}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  isSelected ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {group.completedCount}/{group.totalTarget} Toko
                </span>
                {group.progressPercent === 100 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Date Detail Banner (If specific date is filtered) */}
      {selectedDate !== 'ALL' && activeGroup && (
        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-4 rounded-xl border border-indigo-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              DETAIL STATUS PROGRES HARI-H
            </div>
            <h3 className="text-base font-extrabold capitalize text-white">
              {activeGroup.dayLabel}
            </h3>
            <p className="text-xs text-indigo-200 mt-0.5">
              Korlap / Auditor Duty: {activeGroup.officers.join(', ') || 'Semua Korlap'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="bg-white/10 px-3 py-2 rounded-lg border border-white/10 text-center">
              <span className="block text-[10px] text-indigo-200 uppercase">Target Toko</span>
              <span className="text-base font-bold text-white">{activeGroup.totalTarget} Toko</span>
            </div>
            <div className="bg-emerald-500/20 px-3 py-2 rounded-lg border border-emerald-400/30 text-center">
              <span className="block text-[10px] text-emerald-200 uppercase">Selesai SO</span>
              <span className="text-base font-bold text-emerald-300">{activeGroup.completedCount} Toko</span>
            </div>
            <div className="bg-blue-500/20 px-3 py-2 rounded-lg border border-blue-400/30 text-center">
              <span className="block text-[10px] text-blue-200 uppercase">Terjadwal</span>
              <span className="text-base font-bold text-blue-200">{activeGroup.scheduledCount} Toko</span>
            </div>
            {activeGroup.results.length > 0 && (
              <div className="bg-amber-500/20 px-3 py-2 rounded-lg border border-amber-400/30 text-center">
                <span className="block text-[10px] text-amber-200 uppercase">Akurasi Rata-rata</span>
                <span className="text-base font-bold text-amber-300">{activeGroup.avgAccuracy}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Daily Breakdown Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
              <th className="p-3">Tanggal SO</th>
              <th className="p-3">Target & Progres Toko</th>
              <th className="p-3 text-center">Persentase Selesai</th>
              <th className="p-3">Officer / Korlap</th>
              <th className="p-3 text-center">Aksi Filter</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {dailyGroups.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                  Tidak ada jadwal SO untuk periode tanggal yang dipilih.
                </td>
              </tr>
            ) : (
              dailyGroups.map((group) => {
                const isCurrentFiltered = selectedDate === group.dateStr;

                return (
                  <tr 
                    key={group.dateStr}
                    className={`transition ${
                      isCurrentFiltered ? 'bg-indigo-50/80 font-medium' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Tanggal */}
                    <td className="p-3 font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{group.dayLabel}</span>
                      </div>
                    </td>

                    {/* Target & Progres Toko */}
                    <td className="p-3 text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{group.completedCount}</span>
                        <span className="text-slate-400">/</span>
                        <span className="font-semibold text-slate-600">{group.totalTarget} Toko</span>
                        
                        {group.inProgressCount > 0 && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-semibold">
                            {group.inProgressCount} Dalam Proses
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Progress Bar & Persentase */}
                    <td className="p-3 text-center">
                      <div className="flex items-center gap-2 justify-center max-w-[140px] mx-auto">
                        <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              group.progressPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                            }`}
                            style={{ width: `${group.progressPercent}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-800 text-[11px] w-8 text-right">
                          {group.progressPercent}%
                        </span>
                      </div>
                    </td>

                    {/* Officer / Korlap */}
                    <td className="p-3 text-slate-600 text-[11px]">
                      {group.officers.length > 0 ? (
                        <div className="truncate max-w-[180px]" title={group.officers.join(', ')}>
                          {group.officers.join(', ')}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">-</span>
                      )}
                    </td>

                    {/* Aksi Filter Button */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => onSelectDate(group.dateStr)}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 mx-auto ${
                          isCurrentFiltered
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-indigo-600 hover:bg-indigo-100'
                        }`}
                      >
                        <Filter className="w-3 h-3" />
                        {isCurrentFiltered ? 'Aktif' : 'Filter Tanggal Ini'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

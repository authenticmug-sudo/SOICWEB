import React from 'react';
import { Calendar, Users, ArrowRight, Play, CheckCircle } from 'lucide-react';
import { SOSchedule } from '../../types/stockOpname';
import { getStatusBadgeClass, formatDateIndo } from '../../utils/formatters';

interface UpcomingScheduleWidgetProps {
  schedules: SOSchedule[];
  onNavigateSchedules: () => void;
  onUpdateStatus: (scheduleId: string, newStatus: SOSchedule['status']) => void;
}

export const UpcomingScheduleWidget: React.FC<UpcomingScheduleWidgetProps> = ({
  schedules,
  onNavigateSchedules,
  onUpdateStatus
}) => {
  // Show top 6 schedules
  const recentSchedules = schedules.slice(0, 6);

  return (
    <div className="bg-white rounded border border-slate-200 shadow-xs p-3.5 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Active & Upcoming Schedules
          </h3>
        </div>
        <button
          onClick={onNavigateSchedules}
          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
        >
          View All <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <th className="py-2 px-2.5">Store ID & Name</th>
              <th className="py-2 px-2.5">Region</th>
              <th className="py-2 px-2.5">Date & Time</th>
              <th className="py-2 px-2.5">Team</th>
              <th className="py-2 px-2.5">Status</th>
              <th className="py-2 px-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recentSchedules.length > 0 ? (
              recentSchedules.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-2 px-2.5">
                    <div className="font-semibold text-slate-800 text-xs">{item.storeName}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{item.storeCode}</div>
                  </td>
                  <td className="py-2 px-2.5 text-slate-600 max-w-[140px] truncate text-xs">
                    {item.region}
                  </td>
                  <td className="py-2 px-2.5 text-slate-700 text-xs">
                    <div>{formatDateIndo(item.scheduledDate)}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{item.scheduledTime} WIB</div>
                  </td>
                  <td className="py-2 px-2.5 text-slate-600 text-xs">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span>{item.teamName}</span>
                    </div>
                  </td>
                  <td className="py-2 px-2.5">
                    <span className={`px-2 py-0.5 text-[10px] rounded font-semibold uppercase tracking-wider ${getStatusBadgeClass(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-2 px-2.5 text-right">
                    {item.status === 'Terjadwal' && (
                      <button
                        onClick={() => onUpdateStatus(item.id, 'Proses SO')}
                        className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-medium transition inline-flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" /> Start SO
                      </button>
                    )}
                    {item.status === 'Proses SO' && (
                      <button
                        onClick={() => onUpdateStatus(item.id, 'Menunggu Rekapan')}
                        className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-medium transition inline-flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" /> Field Done
                      </button>
                    )}
                    {item.status === 'Selesai' && (
                      <span className="text-[10px] text-emerald-600 font-bold">✓ Complete</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-400 text-xs">
                  No upcoming schedules
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

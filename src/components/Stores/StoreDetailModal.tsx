import React from 'react';
import { X, Building2, MapPin, Phone, User, Calendar, ShieldAlert, BarChart, History } from 'lucide-react';
import { Store, SOSchedule, SOResult } from '../../types/stockOpname';
import { formatDateIndo, getRiskBadgeClass, formatRupiah, formatZoneText } from '../../utils/formatters';

interface StoreDetailModalProps {
  store: Store | null;
  schedules: SOSchedule[];
  results: SOResult[];
  onClose: () => void;
}

export const StoreDetailModal: React.FC<StoreDetailModalProps> = ({
  store,
  schedules,
  results,
  onClose
}) => {
  if (!store) return null;

  const storeSchedules = schedules.filter(s => s.storeId === store.id || (store.code && s.storeCode === store.code));
  const storeResults = results.filter(r => r.storeId === store.id || (store.code && r.storeCode === store.code));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">{store.name}</h3>
                <span className="font-mono text-xs text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">
                  {store.code}
                </span>
              </div>
              <p className="text-xs text-slate-400">{store.region}</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-xs">
          
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Tipe Operasional</span>
              <p className="font-bold text-slate-800 mt-0.5">{store.storeType}</p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Kriteria Zona</span>
              <p className="mt-0.5">
                {store.riskLevel ? (
                  <span className={`px-2 py-0.5 rounded text-[10px] border ${getRiskBadgeClass(store.riskLevel)}`}>
                    {formatZoneText(store.riskLevel)}
                  </span>
                ) : (
                  <span className="text-slate-400 font-mono text-xs select-none">-</span>
                )}
              </p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Area / Wilayah</span>
              <p className="font-bold text-indigo-700 mt-0.5">
                {store.region || store.city || '-'}
              </p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Kepala Toko</span>
              <p className="font-medium text-slate-800 mt-0.5">{store.managerName || '-'}</p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Telepon Kontak</span>
              <p className="font-mono text-slate-700 mt-0.5">{store.phone || '-'}</p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Status Toko</span>
              <p className="font-bold text-emerald-700 text-sm mt-0.5">
                {store.status || 'Aktif Operasional'}
              </p>
            </div>
          </div>

          {/* Address */}
          <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-bold text-slate-800">Alamat Toko:</span>
              <p className="text-slate-600 mt-0.5">{store.address}, Kota {store.city}</p>
            </div>
          </div>

          {/* Past SO History */}
          <div>
            <h4 className="font-bold text-slate-900 mb-2 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-indigo-600" />
              Riwayat Audit Stock Opname (SO) Toko Ini
            </h4>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-semibold text-slate-700">
                    <th className="py-2 px-3">Tanggal SO</th>
                    <th className="py-2 px-3">Tim SO</th>
                    <th className="py-2 px-3">No. BA</th>
                    <th className="py-2 px-3 text-right">Selisih Fisik vs System</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {storeResults.length > 0 ? (
                    storeResults.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-medium text-slate-900">{formatDateIndo(r.soDate)}</td>
                        <td className="py-2 px-3 text-slate-700">{r.executedByTeam}</td>
                        <td className="py-2 px-3 font-mono text-indigo-600 font-bold">{r.baNumber}</td>
                        <td className={`py-2 px-3 text-right font-mono font-bold ${r.varianceValueTotalRp < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {r.varianceValueTotalRp > 0 ? '+' : ''}{formatRupiah(r.varianceValueTotalRp)}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800">{r.approvalStatus}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">
                        Belum ada riwayat rekapan SO terlampir untuk toko ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
            >
              Tutup
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

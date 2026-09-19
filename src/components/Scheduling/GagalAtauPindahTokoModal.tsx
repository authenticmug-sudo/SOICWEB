import React, { useState, useEffect, useMemo } from 'react';
import { X, AlertTriangle, ArrowRight, Building2, Calendar, Clock, FileText, CheckCircle2, Search, Compass, MapPin, Sparkles, Navigation } from 'lucide-react';
import { SOSchedule, Store } from '../../types/stockOpname';
import { SearchableStoreSelect } from '../Common/SearchableStoreSelect';
import { calculateHaversineDistanceBetweenStores } from '../../utils/geoUtils';
import { isStoreZonaHitam } from '../../utils/storeSyncUtils';

interface GagalAtauPindahTokoModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: SOSchedule | null;
  stores: Store[];
  onSubmitAction: (
    scheduleId: string,
    actionType: 'Gagal SO' | 'Pindah Toko',
    reason: string,
    replacementDetails?: {
      newStore: Store;
      newDate: string;
      newTime: string;
    }
  ) => void;
}

export const GagalAtauPindahTokoModal: React.FC<GagalAtauPindahTokoModalProps> = ({
  isOpen,
  onClose,
  schedule,
  stores,
  onSubmitAction
}) => {
  const [actionType, setActionType] = useState<'Gagal SO' | 'Pindah Toko'>('Pindah Toko');
  const [reason, setReason] = useState('');
  const [selectedReplacementStoreId, setSelectedReplacementStoreId] = useState('');
  const [storeSearchQuery, setStoreSearchQuery] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('21:00');

  // Find original store being audited
  const sourceStore = useMemo(() => {
    if (!schedule) return null;
    return stores.find(s => s.id === schedule.storeId || s.code === schedule.storeCode) || null;
  }, [schedule, stores]);

  // Available stores excluding the current store
  const availableStores = useMemo(() => {
    if (!schedule) return [];
    return stores.filter(s => s.id !== schedule.storeId && s.code !== schedule.storeCode);
  }, [stores, schedule]);

  // Compute nearest recommendations with Haversine GPS distance
  const nearestRecommendations = useMemo(() => {
    if (!sourceStore || availableStores.length === 0) return [];

    return availableStores
      .map(store => {
        const dist = calculateHaversineDistanceBetweenStores(sourceStore, store);
        const masterSepDate = String(store.soSeptember || '').trim();
        const isBelum = !masterSepDate || masterSepDate === '-' || masterSepDate === '0' || masterSepDate.toLowerCase().includes('belum');
        const isHitam = isStoreZonaHitam(store);

        return {
          store,
          distanceKm: dist,
          isBelumTerjadwal: isBelum,
          soSeptember: store.soSeptember,
          isZonaHitam: isHitam
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 4);
  }, [sourceStore, availableStores]);

  useEffect(() => {
    if (isOpen && schedule) {
      if (nearestRecommendations.length > 0) {
        const topCandidate = nearestRecommendations[0].store;
        setSelectedReplacementStoreId(topCandidate.id);
        setStoreSearchQuery(`[${topCandidate.code}] ${topCandidate.name}`);
      } else {
        const firstStore = availableStores[0] || stores[0];
        if (firstStore) {
          setSelectedReplacementStoreId(firstStore.id);
          setStoreSearchQuery(`[${firstStore.code}] ${firstStore.name}`);
        }
      }
      setNewDate(schedule.scheduledDate || '');
      setNewTime(schedule.scheduledTime || '21:00');
      setReason('');
      setActionType('Pindah Toko');
    }
  }, [isOpen, schedule, nearestRecommendations, availableStores, stores]);

  if (!isOpen || !schedule) return null;

  const handleSelectStore = (store: Store) => {
    setSelectedReplacementStoreId(store.id);
    setStoreSearchQuery(`[${store.code}] ${store.name}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('Mohon isi penjelasan / alasan terjadinya Toko Gagal atau Pindah Toko.');
      return;
    }

    if (actionType === 'Pindah Toko') {
      const replacementStore = stores.find(s => s.id === selectedReplacementStoreId);
      if (!replacementStore) {
        alert('Pilih toko pengganti tujuan pindah.');
        return;
      }
      onSubmitAction(schedule.id, 'Pindah Toko', reason.trim(), {
        newStore: replacementStore,
        newDate,
        newTime
      });
    } else {
      onSubmitAction(schedule.id, 'Gagal SO', reason.trim());
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-rose-700 text-white p-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-200" />
            <div>
              <h3 className="font-bold text-sm text-white">Input Kendala: Gagal SO / Pindah Toko</h3>
              <p className="text-[11px] text-amber-100 font-mono">
                {schedule.storeCode} - {schedule.storeName} ({schedule.scheduledDate})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg text-amber-100 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          {/* Action Choice */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              Pilih Jenis Kejadian Kendala:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setActionType('Pindah Toko')}
                className={`p-3 rounded-xl border font-bold text-left transition flex items-center justify-between ${
                  actionType === 'Pindah Toko'
                    ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-500/30'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div>
                  <div className="text-xs font-extrabold flex items-center gap-1.5">
                    <ArrowRight className="w-4 h-4 text-amber-600" />
                    <span>Pindah Toko</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                    Jadwal dialihkan ke toko lain pada tgl/jam sama atau baru
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActionType('Gagal SO')}
                className={`p-3 rounded-xl border font-bold text-left transition flex items-center justify-between ${
                  actionType === 'Gagal SO'
                    ? 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-500/30'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div>
                  <div className="text-xs font-extrabold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Gagal SO</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                    Audit toko tidak dapat dilaksanakan/batal tanpa pengganti
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Explanation / Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              Penjelasan / Alasan Detail (Wajib Diisi Korlap):
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Toko dalam perbaikan kelistrikan PLN, atau Toko Sudirman banjir sehingga dialihkan ke Toko Thamrin..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* If Pindah Toko: Replacement Store details */}
          {actionType === 'Pindah Toko' && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-amber-900 text-xs flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-amber-700" />
                  Data Toko Pengganti (Auto-Sync ke SPV & Dashboard General)
                </h4>
                {sourceStore && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900 flex items-center gap-1">
                    <Compass className="w-3 h-3 text-amber-800" />
                    GPS Acuan: [{sourceStore.code}] {sourceStore.name}
                  </span>
                )}
              </div>

              {/* Quick Nearest Store Recommendations Cards */}
              {nearestRecommendations.length > 0 && (
                <div className="bg-white border border-amber-200/90 rounded-xl p-3 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      Rekomendasi Toko Terdekat (Jarak GPS):
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">Klik untuk memilih langsung</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {nearestRecommendations.map((item, idx) => {
                      const isSelected = selectedReplacementStoreId === item.store.id;
                      return (
                        <button
                          key={item.store.id}
                          type="button"
                          onClick={() => handleSelectStore(item.store)}
                          className={`text-left p-2.5 rounded-lg border transition-all text-xs flex flex-col justify-between gap-1.5 ${
                            isSelected
                              ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400/40 shadow-xs'
                              : 'bg-slate-50/70 hover:bg-amber-50/40 border-slate-200 hover:border-amber-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                                  idx === 0 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  #{idx + 1} Terdekat
                                </span>
                                <span className="font-mono font-bold text-slate-900">[{item.store.code}]</span>
                              </div>
                              <div className="font-bold text-slate-800 text-[11px] line-clamp-1 mt-0.5">
                                {item.store.name}
                              </div>
                            </div>

                            <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded-md whitespace-nowrap shrink-0 flex items-center gap-0.5">
                              <MapPin className="w-3 h-3 text-indigo-600" />
                              {item.distanceKm} km
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5 border-t border-slate-100">
                            <span className="truncate max-w-[140px]">{item.store.kabupaten || item.store.city || 'Bali'}</span>
                            <span className={`font-semibold ${item.isBelumTerjadwal ? 'text-emerald-700 font-bold' : 'text-slate-600'}`}>
                              {item.isBelumTerjadwal ? '⭐ Belum Terjadwal' : `Tgl ${item.soSeptember}`}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Searchable Store Select */}
              <SearchableStoreSelect
                stores={availableStores}
                selectedStoreId={selectedReplacementStoreId}
                onSelectStore={(store) => {
                  setSelectedReplacementStoreId(store.id);
                  setStoreSearchQuery(`[${store.code}] ${store.name}`);
                }}
                referenceStore={sourceStore}
                referenceStoreLabel={sourceStore ? `Toko Asal (${sourceStore.code})` : 'Toko Asal'}
                label="Pilih / Cari Toko Tujuan Pindah (Otomatis Diurutkan Jarak Terdekat)"
                placeholder="Ketik kode toko (misal: TDVX) atau nama toko..."
                required
              />

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-700" />
                    Tanggal SO Baru:
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-700" />
                    Jam Pelaksanaan:
                  </label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit Actions */}
          <div className="pt-2 grid grid-cols-2 sm:flex sm:items-center sm:justify-between gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center justify-center"
            >
              Batal
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="truncate">Submit & Sync ke SPV</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};


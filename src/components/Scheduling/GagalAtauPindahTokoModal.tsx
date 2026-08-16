import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, ArrowRight, Building2, Calendar, Clock, FileText, CheckCircle2, Search } from 'lucide-react';
import { SOSchedule, Store } from '../../types/stockOpname';

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
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('21:00');

  useEffect(() => {
    if (isOpen && schedule) {
      const avail = stores.filter(s => s.id !== schedule.storeId && s.code !== schedule.storeCode);
      const firstStore = avail[0] || stores[0];
      if (firstStore) {
        setSelectedReplacementStoreId(firstStore.id);
        setStoreSearchQuery(`[${firstStore.code}] ${firstStore.name}`);
      } else {
        setSelectedReplacementStoreId('');
        setStoreSearchQuery('');
      }
      setNewDate(schedule.scheduledDate || '');
      setNewTime(schedule.scheduledTime || '21:00');
      setReason('');
      setActionType('Pindah Toko');
      setIsStoreDropdownOpen(false);
    }
  }, [isOpen, schedule, stores]);

  if (!isOpen || !schedule) return null;

  const availableStores = stores.filter(s => s.id !== schedule.storeId && s.code !== schedule.storeCode);

  const filteredStores = availableStores.filter(s => {
    if (!storeSearchQuery.trim()) return true;
    const q = storeSearchQuery.toLowerCase().trim();
    return (
      s.code.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      (s.region && s.region.toLowerCase().includes(q)) ||
      (s.city && s.city.toLowerCase().includes(q))
    );
  });

  const selectedStoreObj = stores.find(s => s.id === selectedReplacementStoreId);

  const handleSelectStore = (store: Store) => {
    setSelectedReplacementStoreId(store.id);
    setStoreSearchQuery(`[${store.code}] ${store.name}`);
    setIsStoreDropdownOpen(false);
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
              <h4 className="font-extrabold text-amber-900 text-xs flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-amber-700" />
                Data Toko Pengganti (Auto-Sync ke SPV & Dashboard General)
              </h4>

              {/* Store Autocomplete & Search Input */}
              <div className="relative">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Ketik Kode Toko / Nama Toko Tujuan Pindah:
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={storeSearchQuery}
                    onChange={(e) => {
                      setStoreSearchQuery(e.target.value);
                      setIsStoreDropdownOpen(true);
                    }}
                    onFocus={() => setIsStoreDropdownOpen(true)}
                    placeholder="Ketik Kode Toko (misal: TDVX) atau Nama Toko..."
                    className="w-full bg-white border border-amber-300 rounded-lg pl-9 pr-8 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                  />
                  {storeSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setStoreSearchQuery('');
                        setSelectedReplacementStoreId('');
                        setIsStoreDropdownOpen(true);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown Suggestions List */}
                {isStoreDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-amber-200 rounded-xl shadow-xl z-30 max-h-52 overflow-y-auto divide-y divide-slate-100">
                    {filteredStores.length === 0 ? (
                      <div className="p-3 text-center text-slate-500 text-xs italic">
                        Toko tidak ditemukan dengan kata kunci "{storeSearchQuery}"
                      </div>
                    ) : (
                      filteredStores.map(s => {
                        const isSelected = s.id === selectedReplacementStoreId;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleSelectStore(s)}
                            className={`w-full text-left p-2.5 px-3 hover:bg-amber-100/70 transition flex items-center justify-between group ${
                              isSelected ? 'bg-amber-100 font-bold' : ''
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-1.5 text-xs text-slate-900 font-bold">
                                <span className="bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold">
                                  {s.code}
                                </span>
                                <span>{s.name}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center gap-2">
                                <span>📍 {s.region}</span>
                                {s.totalSKUCount !== undefined && <span>• {s.totalSKUCount} SKU</span>}
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Sync Select List Fallback */}
              <div>
                <label className="block text-[10px] font-medium text-slate-600 mb-1">
                  Atau Pilih Langsung dari List Dropdown Toko:
                </label>
                <select
                  value={selectedReplacementStoreId}
                  onChange={(e) => {
                    const chosenId = e.target.value;
                    setSelectedReplacementStoreId(chosenId);
                    const matched = stores.find(s => s.id === chosenId);
                    if (matched) {
                      setStoreSearchQuery(`[${matched.code}] ${matched.name}`);
                    }
                    setIsStoreDropdownOpen(false);
                  }}
                  className="w-full bg-white border border-amber-300 rounded-lg p-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="" disabled>-- Pilih Toko Pengganti --</option>
                  {availableStores.map(s => (
                    <option key={s.id} value={s.id}>
                      [{s.code}] {s.name} - {s.region} ({s.totalSKUCount || 0} SKU)
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Store Summary Card */}
              {selectedStoreObj && (
                <div className="bg-amber-100/60 border border-amber-300 rounded-lg p-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-[10px] text-amber-800 font-bold">Toko Pengganti Terpilih:</div>
                    <div className="font-extrabold text-slate-900">
                      [{selectedStoreObj.code}] {selectedStoreObj.name}
                    </div>
                    <div className="text-[10px] text-slate-600">
                      Region: {selectedStoreObj.region} • Total SKU: {selectedStoreObj.totalSKUCount || 0}
                    </div>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 border border-emerald-300 shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Siap
                  </span>
                </div>
              )}

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
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl shadow-md transition flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Submit & Sync Ke SPV / Admin</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};


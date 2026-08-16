import React, { useState } from 'react';
import { X, Users, UserCheck, Search, Check, AlertCircle } from 'lucide-react';
import { SOSchedule, AuditorPersonnel } from '../../types/stockOpname';

interface AssignPersonnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: SOSchedule | null;
  personnel: AuditorPersonnel[];
  onSaveAssignment: (scheduleId: string, personnelIds: string[], personnelNames: string[]) => void;
}

export const AssignPersonnelModal: React.FC<AssignPersonnelModalProps> = ({
  isOpen,
  onClose,
  schedule,
  personnel,
  onSaveAssignment
}) => {
  if (!isOpen || !schedule) return null;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(schedule.assignedPersonnelIds || []);

  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Extract clean Korlap Officer name
  const officerCleanName = schedule.officerInCharge ? schedule.officerInCharge.split(' (')[0].trim() : '';

  // Default to Korlap-only smart filter if Korlap is assigned
  const [korlapOnlyFilter, setKorlapOnlyFilter] = useState<boolean>(!!officerCleanName);

  const toggleSelect = (pId: string) => {
    if (selectedIds.includes(pId)) {
      setSelectedIds(selectedIds.filter(id => id !== pId));
    } else {
      setSelectedIds([...selectedIds, pId]);
    }
  };

  const filteredPersonnel = personnel.filter(p => {
    // Smart Korlap Filter
    if (korlapOnlyFilter && officerCleanName) {
      const matchesKorlap = 
        (p.korlapName && p.korlapName.toLowerCase().includes(officerCleanName.toLowerCase())) ||
        (p.name && p.name.toLowerCase().includes(officerCleanName.toLowerCase()));
      if (!matchesKorlap && !selectedIds.includes(p.id)) {
        return false;
      }
    }

    // Role filter
    if (roleFilter !== 'ALL' && p.role !== roleFilter) {
      return false;
    }

    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.nik.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q) ||
      (p.korlapName && p.korlapName.toLowerCase().includes(q))
    );
  });

  const handleSave = () => {
    const selectedPersons = personnel.filter(p => selectedIds.includes(p.id));
    const names = selectedPersons.map(p => `${p.name} (${p.role})`);
    onSaveAssignment(schedule.id, selectedIds, names);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm text-white">Alokasi Personil SO Toko</h3>
              <p className="text-[11px] text-slate-300 font-mono">
                {schedule.storeCode} - {schedule.storeName} ({schedule.scheduledDate})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0 space-y-2">
          
          {officerCleanName && (
            <div className="flex items-center justify-between bg-indigo-50/80 p-2 rounded-xl border border-indigo-100 text-xs text-indigo-900">
              <span className="font-bold flex items-center gap-1">
                🎯 Korlap In Charge: <span className="text-indigo-700">{officerCleanName}</span>
              </span>
              <button
                type="button"
                onClick={() => setKorlapOnlyFilter(!korlapOnlyFilter)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                  korlapOnlyFilter
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                {korlapOnlyFilter ? '✓ Smart Filter Tim Korlap Ini' : 'Tampilkan Semua Personil'}
              </button>
            </div>
          )}

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari personil, NIK, atau jabatan (Koordinator/Anggota)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1">
            <button
              type="button"
              onClick={() => setRoleFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                roleFilter === 'ALL'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Semua Role
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('Auditor Utama')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                roleFilter === 'Auditor Utama'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Auditor Utama
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('Auditor Pendamping')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                roleFilter === 'Auditor Pendamping'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Auditor Pendamping
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('Officer / Korlap')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                roleFilter === 'Officer / Korlap'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Korlap / Officer
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
            <span>Terpilih: <strong className="text-emerald-700 font-bold">{selectedIds.length} personil</strong></span>
            <span className="text-[10px] text-slate-400 font-mono">Toko Target: {schedule.storeCode}</span>
          </div>
        </div>

        {/* Personnel List */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {filteredPersonnel.length > 0 ? (
            filteredPersonnel.map((p) => {
              const isSelected = selectedIds.includes(p.id);
              const isKorlap = p.role === 'Officer / Korlap';
              const isKoordinator = p.role === 'Koordinator';

              return (
                <div
                  key={p.id}
                  onClick={() => toggleSelect(p.id)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-emerald-50/80 border-emerald-300 text-slate-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition shrink-0 ${
                      isSelected
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>

                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{p.name}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
                          isKorlap
                            ? 'bg-purple-100 text-purple-800 border-purple-200'
                            : isKoordinator
                            ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {p.role}
                        </span>
                        {p.status !== 'Aktif' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 border border-amber-200 font-bold">
                            {p.status}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        NIK: {p.nik} {p.korlapName && `• Korlap: ${p.korlapName}`}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-semibold text-slate-400">
                    {isSelected ? 'Terpilih' : 'Klik utk Pilih'}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs">
              Tidak ada personil auditor yang sesuai pencarian.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1.5"
          >
            <UserCheck className="w-4 h-4" />
            <span>Simpan Personil Toko ({selectedIds.length})</span>
          </button>
        </div>

      </div>
    </div>
  );
};

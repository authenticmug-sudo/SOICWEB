import React, { useState, useEffect } from 'react';
import { X, Calendar, Building2, Users, FileText, UserCheck, AlertTriangle } from 'lucide-react';
import { Store, SOTeam, SOSchedule, AuditorPersonnel } from '../../types/stockOpname';
import { formatDateISO } from '../../utils/formatters';

interface CreateScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  stores: Store[];
  teams: SOTeam[];
  existingSchedules?: SOSchedule[];
  personnel?: AuditorPersonnel[];
  onCreateSchedule: (newSchedule: Omit<SOSchedule, 'id' | 'createdAt'>) => void;
}

export const CreateScheduleModal: React.FC<CreateScheduleModalProps> = ({
  isOpen,
  onClose,
  stores,
  teams,
  existingSchedules = [],
  personnel = [],
  onCreateSchedule
}) => {
  const [selectedStoreId, setSelectedStoreId] = useState(stores[0]?.id || '');
  const [scheduledDate, setScheduledDate] = useState(() => formatDateISO(new Date()));
  const [scheduledTime, setScheduledTime] = useState('21:00');
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id || '');
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string>('');
  const [customOfficerName, setCustomOfficerName] = useState<string>('');
  const [allocatedPersonnelIds, setAllocatedPersonnelIds] = useState<string[]>([]);
  const [autoSyncHariH, setAutoSyncHariH] = useState<boolean>(true);
  const [notes, setNotes] = useState('');

  const [filterMode, setFilterMode] = useState<'TEAM' | 'ALL' | 'ACTIVE'>('TEAM');
  const [pendingDuplicateCheck, setPendingDuplicateCheck] = useState<{
    store: Store;
    previousDateInfo: string;
    payload: Omit<SOSchedule, 'id' | 'createdAt'>;
  } | null>(null);

  // Auto-select first Korlap / Officer from personnel list if available
  useEffect(() => {
    if (stores && stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
    if (teams && teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [stores, teams, selectedStoreId, selectedTeamId]);

  useEffect(() => {
    if (personnel && personnel.length > 0) {
      const firstKorlap = personnel.find(p => p.role === 'Officer / Korlap' && p.status === 'Aktif') || personnel[0];
      if (firstKorlap && !selectedPersonnelId) {
        setSelectedPersonnelId(firstKorlap.id);
        if (firstKorlap.teamId && teams.some(t => t.id === firstKorlap.teamId)) {
          setSelectedTeamId(firstKorlap.teamId);
        }
        // Auto select team personnel
        const teamMembers = personnel.filter(p => (firstKorlap.teamId && p.teamId === firstKorlap.teamId) || p.role === 'Anggota Tim');
        const memberIds = teamMembers.map(p => p.id);
        setAllocatedPersonnelIds(memberIds.length > 0 ? memberIds : [firstKorlap.id]);
      }
    }
  }, [personnel, teams]);

  if (!isOpen) return null;

  // Selected personnel object
  const selectedPerson = personnel.find(p => p.id === selectedPersonnelId);

  // Smart filtered auditors list for allocation
  const filteredAuditors = personnel.filter(p => {
    if (filterMode === 'ACTIVE') return p.status === 'Aktif';
    if (filterMode === 'TEAM') {
      if (selectedPerson?.teamId) {
        return p.teamId === selectedPerson.teamId || p.id === selectedPerson.id;
      }
      return true; // show all if korlap has no teamId
    }
    return true; // 'ALL'
  });

  // Handle personnel/korlap change
  const handlePersonnelChange = (id: string) => {
    setSelectedPersonnelId(id);
    if (id === 'CUSTOM') {
      return;
    }
    const p = personnel.find(item => item.id === id);
    if (p) {
      if (p.teamId && teams.some(t => t.id === p.teamId)) {
        setSelectedTeamId(p.teamId);
      }
      // Filter auditors belonging to same team or default active auditors
      const members = personnel.filter(m => (p.teamId && m.teamId === p.teamId) || m.role === 'Anggota Tim').map(m => m.id);
      setAllocatedPersonnelIds(members.length > 0 ? members : [p.id]);
    }
  };

  const handleToggleAuditor = (personId: string) => {
    setAllocatedPersonnelIds(prev => 
      prev.includes(personId) ? prev.filter(id => id !== personId) : [...prev, personId]
    );
  };

  const handleSelectAllAuditors = () => {
    setAllocatedPersonnelIds(filteredAuditors.map(p => p.id));
  };

  const handleDeselectAllAuditors = () => {
    setAllocatedPersonnelIds([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const store = stores.find(s => s.id === selectedStoreId) || stores[0];

    if (!store) {
      alert('Mohon pilih Toko dari daftar master toko.');
      return;
    }

    let officerName = '';
    if (selectedPersonnelId === 'CUSTOM') {
      officerName = customOfficerName.trim() || 'Officer SO';
    } else if (selectedPerson) {
      officerName = `${selectedPerson.name} (${selectedPerson.role})`;
    } else {
      officerName = 'Korlap SO Lapangan';
    }

    const assignedPersons = personnel.filter(p => allocatedPersonnelIds.includes(p.id));
    const allocatedNamesList = assignedPersons.map(p => `${p.name} (${p.role})`);
    const allocatedNamesText = allocatedNamesList.join(', ');

    // Robust Team resolution: prioritize selected master team -> officer's team -> dynamic team from officer -> fallback
    let resolvedTeamId = selectedTeamId;
    let resolvedTeamName = 'Tim Audit SO Operasional';

    const matchedMasterTeam = teams.find(t => t.id === selectedTeamId);
    if (matchedMasterTeam) {
      resolvedTeamId = matchedMasterTeam.id;
      resolvedTeamName = matchedMasterTeam.name;
    } else if (selectedPerson?.teamName) {
      resolvedTeamId = selectedPerson.teamId || `TEAM-${selectedPerson.id}`;
      resolvedTeamName = selectedPerson.teamName;
    } else if (selectedPerson) {
      resolvedTeamId = selectedPerson.teamId || `TEAM-${selectedPerson.id}`;
      resolvedTeamName = `Tim ${selectedPerson.name.split(' ')[0]} (${selectedPerson.role})`;
    } else if (teams && teams.length > 0) {
      resolvedTeamId = teams[0].id;
      resolvedTeamName = teams[0].name;
    } else {
      resolvedTeamId = 'TEAM-DEFAULT';
      resolvedTeamName = 'Tim Audit SO Standard';
    }

    const fullNotes = notes ? `${notes} [Personil: ${allocatedNamesText || 'Belum Dialokasi'}]` : `Personil SO: ${allocatedNamesText || 'Belum Dialokasi'}`;

    const newSchedulePayload: Omit<SOSchedule, 'id' | 'createdAt'> = {
      storeId: store.id,
      storeCode: store.code,
      storeName: store.name,
      region: store.region,
      scheduledDate,
      scheduledTime,
      teamId: resolvedTeamId,
      teamName: resolvedTeamName,
      spvInCharge: 'Gean Pratama (SPV SO)',
      officerInCharge: officerName,
      status: 'Terjadwal',
      spvApprovalStatus: 'Menunggu Approval SPV',
      targetSKUCount: store.totalSKUCount,
      assignedPersonnelIds: allocatedPersonnelIds.length > 0 ? allocatedPersonnelIds : (selectedPerson ? [selectedPerson.id] : []),
      assignedPersonnelNames: allocatedNamesList.length > 0 ? allocatedNamesList : (selectedPerson ? [`${selectedPerson.name} (${selectedPerson.role})`] : []),
      notes: fullNotes
    };

    // Check if store already has SO / Schedule in the same month
    const targetMonth = scheduledDate.slice(0, 7); // e.g. '2026-08'
    const existingSameMonthSchedule = existingSchedules.find(s => 
      (s.storeId === store.id || s.storeCode === store.code) && 
      s.scheduledDate.startsWith(targetMonth) &&
      s.status !== 'Dibatalkan'
    );

    const hasAgustusMasterData = targetMonth === '2026-08' && Boolean(store.soAgustus && store.soAgustus.trim() !== '' && store.soAgustus !== '-');

    if (existingSameMonthSchedule || hasAgustusMasterData) {
      const prevDate = existingSameMonthSchedule 
        ? `${existingSameMonthSchedule.scheduledDate} (Status: ${existingSameMonthSchedule.status})` 
        : `Master Toko Kolom SO Agustus: ${store.soAgustus}`;

      setPendingDuplicateCheck({
        store,
        previousDateInfo: prevDate,
        payload: newSchedulePayload
      });
      return;
    }

    onCreateSchedule(newSchedulePayload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm">Buat Jadwal Stock Opname Manual</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Select Store */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              Pilih Toko ({stores.length} Master Toko)
            </label>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg text-xs p-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-medium"
              required
            >
              {stores.map(s => (
                <option key={s.id} value={s.id}>
                  [{s.code}] {s.name} - {s.region}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Pelaksanaan
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg text-xs p-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Jam Pelaksanaan (WIB)
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg text-xs p-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                required
              />
            </div>
          </div>

          {/* Select Officer / Korlap from Personnel Database */}
          <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 space-y-2">
            <label className="block text-xs font-bold text-indigo-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                Officer / Korlap Penanggung Jawab
              </span>
              <span className="text-[10px] text-indigo-600 font-normal">
                ({personnel.length} Personil Terdaftar)
              </span>
            </label>
            
            <select
              value={selectedPersonnelId}
              onChange={(e) => handlePersonnelChange(e.target.value)}
              className="w-full bg-white border border-indigo-200 rounded-lg text-xs p-2.5 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <optgroup label="Officer / Korlap Active">
                {personnel
                  .filter(p => p.role === 'Officer / Korlap')
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      [{p.nik}] {p.name} - {p.role} ({p.status})
                    </option>
                  ))}
              </optgroup>
              <option value="CUSTOM">+ Input Nama Custom Manual</option>
            </select>

            {selectedPersonnelId === 'CUSTOM' && (
              <input
                type="text"
                placeholder="Masukkan Nama Korlap Custom..."
                value={customOfficerName}
                onChange={(e) => setCustomOfficerName(e.target.value)}
                className="w-full bg-white border border-indigo-300 rounded-lg text-xs p-2 text-slate-800 focus:outline-none mt-1"
                required
              />
            )}

            {/* Selected Person Status Warning if Sakit / Cuti */}
            {selectedPerson && selectedPerson.status !== 'Aktif' && (
              <div className="p-2 bg-amber-100 border border-amber-300 rounded-lg text-[11px] text-amber-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Perhatian:</strong> {selectedPerson.name} sedang berstatus <strong>{selectedPerson.status}</strong> 
                  {selectedPerson.statusStartDate && ` (${selectedPerson.statusStartDate} s/d ${selectedPerson.statusEndDate || 'selesai'})`}.
                </span>
              </div>
            )}
          </div>

          {/* Select Team & Personnel Allocation Checklist */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1 text-slate-900 font-bold">
                <Users className="w-4 h-4 text-indigo-600" />
                Alokasi Personil Tim Audit (Master Personil)
              </span>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {allocatedPersonnelIds.length} Personil Terpilih
              </span>
            </label>

            {/* Tim SO Select Dropdown with Fallbacks */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">
                Pilih Tim SO Operasional:
              </label>
              <select
                value={selectedTeamId || (teams[0]?.id || 'TEAM-DEFAULT')}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg text-xs p-2 text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
              >
                {teams && teams.length > 0 ? (
                  teams.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} (Ketua: {t.leaderName})
                    </option>
                  ))
                ) : (
                  <option value="TEAM-DEFAULT">Tim Audit SO Standard (Korlap Operational)</option>
                )}
              </select>
            </div>

            {/* Smart Filter Pills */}
            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setFilterMode('TEAM')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                  filterMode === 'TEAM'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                👥 Tim Korlap ({selectedPerson?.name ? selectedPerson.name.split(' ')[0] : 'Aktif'})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                  filterMode === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                📋 Semua ({personnel.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('ACTIVE')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                  filterMode === 'ACTIVE'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ✅ Aktif Saja ({personnel.filter(p => p.status === 'Aktif').length})
              </button>
            </div>

            {/* Checklist of filtered master personnel for auditor allocation */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-44 overflow-y-auto space-y-1.5">
              <div className="flex items-center justify-between mb-1.5 border-b border-slate-200 pb-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  Pilih Personil Master ({filteredAuditors.length} Personil Tampil):
                </span>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={handleSelectAllAuditors}
                    className="text-indigo-600 font-bold hover:underline"
                  >
                    Pilih Semua
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={handleDeselectAllAuditors}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    Batal Semua
                  </button>
                </div>
              </div>
              {filteredAuditors.length === 0 ? (
                <p className="text-xs text-slate-400 italic p-2">Tidak ada personil terdaftar untuk kategori ini.</p>
              ) : (
                filteredAuditors.map(p => {
                  const isChecked = allocatedPersonnelIds.includes(p.id);
                  return (
                    <label 
                      key={p.id} 
                      className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition ${
                        isChecked 
                          ? 'bg-indigo-50 border border-indigo-200 font-semibold text-indigo-950 shadow-2xs' 
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleAuditor(p.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900">{p.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                              p.status === 'Aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {p.status}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {p.role} {p.teamName ? `• ${p.teamName}` : ''}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">NIK: {p.nik}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Auto Sync Banner for Hari-H Portal */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-900">
            <input
              type="checkbox"
              id="autoSyncToggle"
              checked={autoSyncHariH}
              onChange={(e) => setAutoSyncHariH(e.target.checked)}
              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer shrink-0"
            />
            <label htmlFor="autoSyncToggle" className="cursor-pointer">
              <strong className="block text-emerald-950 font-bold">⚡ Auto-Sinkronisasi ke Portal Korlap & Officer Hari-H</strong>
              <p className="text-[11px] text-emerald-800 mt-0.5 leading-tight">
                Jadwal ini akan otomatis terbit dan langsung muncul pada Portal Korlap/Officer di menu Jadwal SO Hari-H pada tanggal/jam tertera.
              </p>
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Catatan / Instruksi Khusus SPV
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Fokus cek item High Shrinkage & Expired Date..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg text-xs p-2.5 text-slate-800 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-sm"
            >
              Simpan Jadwal SO
            </button>
          </div>

        </form>

      </div>

      {/* Confirmation Modal for Repeat SO in Same Month */}
      {pendingDuplicateCheck && (
        <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 text-center">
              Konfirmasi SO Ulang / Lebih Dari 1x Bulan Ini
            </h3>

            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-2">
              <p>
                Toko <strong className="font-bold text-slate-900">{pendingDuplicateCheck.store.code} - {pendingDuplicateCheck.store.name}</strong> sudah memiliki riwayat / jadwal SO pada bulan yang sama.
              </p>
              <div className="p-2 bg-white/80 rounded-lg border border-amber-300/60 font-mono text-[11px]">
                📌 {pendingDuplicateCheck.previousDateInfo}
              </div>
              <p className="font-semibold text-amber-950">
                Apakah toko ini akan dilakukan SO ulang atau di-SO lebih dari satu kali dalam bulan yang sama?
              </p>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPendingDuplicateCheck(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Batal / Batalkan
              </button>
              <button
                type="button"
                onClick={() => {
                  onCreateSchedule(pendingDuplicateCheck.payload);
                  setPendingDuplicateCheck(null);
                  onClose();
                }}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition shadow-md"
              >
                Ya, Tetap Buat Jadwal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


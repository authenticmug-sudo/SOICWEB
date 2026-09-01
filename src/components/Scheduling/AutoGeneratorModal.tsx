import React, { useState } from 'react';
import { X, Wand2, Sparkles, Building2, CheckCircle2 } from 'lucide-react';
import { Store, SOTeam, SOSchedule, AuditorPersonnel } from '../../types/stockOpname';
import { REGIONS } from '../../data/initialData';
import { isStoreZonaHitam } from '../../utils/storeSyncUtils';

interface AutoGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  stores: Store[];
  teams: SOTeam[];
  personnel?: AuditorPersonnel[];
  existingSchedules: SOSchedule[];
  onBatchCreateSchedules: (schedules: SOSchedule[]) => void;
}

export const AutoGeneratorModal: React.FC<AutoGeneratorModalProps> = ({
  isOpen,
  onClose,
  stores,
  teams,
  personnel = [],
  existingSchedules,
  onBatchCreateSchedules
}) => {
  const [targetRegion, setTargetRegion] = useState<string>('ALL');
  const [prioritizeHighRisk, setPrioritizeHighRisk] = useState(true);
  const [dailyQuota, setDailyQuota] = useState<number>(10);
  const [targetMonth, setTargetMonth] = useState('2026-08');
  const [generatedCount, setGeneratedCount] = useState<number | null>(null);

  if (!isOpen) return null;

  // Unscheduled stores
  const scheduledStoreIds = new Set(existingSchedules.map(s => s.storeId));
  const candidateStores = stores.filter(s => {
    const isUnscheduled = !scheduledStoreIds.has(s.id);
    const matchesRegion = targetRegion === 'ALL' || s.region === targetRegion;
    return isUnscheduled && matchesRegion;
  });

  const handleRunGenerator = () => {
    let sortedCandidate = [...candidateStores];
    if (prioritizeHighRisk) {
      sortedCandidate.sort((a, b) => {
        const riskOrder = { Tinggi: 1, Sedang: 2, Rendah: 3 };
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      });
    }

    const newSchedules: SOSchedule[] = [];
    let currentDay = 1;
    let storesCreatedToday = 0;

    // Filter active Korlap / Officer from personnel database
    const activeKorlaps = personnel.filter(p => p.role === 'Officer / Korlap' && p.status === 'Aktif');
    const availableOfficers = activeKorlaps.length > 0 ? activeKorlaps : personnel.filter(p => p.role === 'Officer / Korlap');

    sortedCandidate.forEach((store, index) => {
      if (storesCreatedToday >= dailyQuota) {
        currentDay++;
        storesCreatedToday = 0;
      }
      const dayStr = String(Math.min(currentDay, 28)).padStart(2, '0');
      const scheduledDate = `${targetMonth}-${dayStr}`;

      const assignedTeam = teams && teams.length > 0 ? teams[index % teams.length] : null;
      const assignedOfficer = availableOfficers.length > 0 
        ? availableOfficers[index % availableOfficers.length]
        : null;
      
      const officerInCharge = assignedOfficer 
        ? `${assignedOfficer.name} (${assignedOfficer.role})`
        : 'I Wayan Gede (Korlap Bali 1)';

      const resolvedTeamId = assignedTeam?.id || (assignedOfficer?.teamId || `TEAM-AUTO-${(index % 3) + 1}`);
      const resolvedTeamName = assignedTeam?.name || (assignedOfficer ? `Tim ${assignedOfficer.name.split(' ')[0]}` : `Tim Audit SO ${(index % 3) + 1}`);

      const isHitam = isStoreZonaHitam(store);
      const storeZona = isHitam ? 'ZONA HITAM' : (store.zona || 'NON ZONA HITAM');
      const storeAktiva = store.soAktiva || 'Tidak';

      newSchedules.push({
        id: `AUTO-SCHED-${Date.now()}-${index}`,
        storeId: store.id,
        storeCode: store.code,
        storeName: store.name,
        region: store.region,
        scheduledDate,
        scheduledTime: '21:00',
        teamId: resolvedTeamId,
        teamName: resolvedTeamName,
        spvInCharge: 'Gean Pratama (SPV SO)',
        officerInCharge,
        status: 'Terjadwal',
        targetSKUCount: store.totalSKUCount,
        notes: `Auto-generated oleh Engine SPV. Prioritas Risk: ${store.riskLevel}`,
        typeSo: store.typeSo || store.qm || 'M',
        zona: storeZona,
        soAktiva: storeAktiva,
        stockRp: typeof store.saldoToko === 'number' ? store.saldoToko : Number(String(store.saldoToko || '0').replace(/[^0-9.-]/g, '')) || 0,
        createdAt: new Date().toISOString().slice(0, 10)
      });

      storesCreatedToday++;
    });

    onBatchCreateSchedules(newSchedules);
    setGeneratedCount(newSchedules.length);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-300" />
            <h3 className="font-bold text-sm">Engine Auto-Scheduling 700+ Toko</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-purple-300 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900">
            <p className="font-semibold flex items-center gap-1 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              Fitur Cerdas Supervisor:
            </p>
            Otomatis mendistribusikan ratusan toko belum terjadwal ke dalam 28 hari operasional berdasarkan kapasitas tim & tingkat risiko toko.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Target Wilayah/Area Toko
            </label>
            <select
              value={targetRegion}
              onChange={(e) => setTargetRegion(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg text-xs p-2.5 text-slate-800 focus:outline-none"
            >
              <option value="ALL">Semua Wilayah ({candidateStores.length} Toko Belum Terjadwal)</option>
              {REGIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bulan Target SO
              </label>
              <input
                type="month"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg text-xs p-2.5 text-slate-800 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kuota Maks Toko / Hari
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={dailyQuota}
                onChange={(e) => setDailyQuota(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg text-xs p-2.5 text-slate-800 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="prioritize"
              checked={prioritizeHighRisk}
              onChange={(e) => setPrioritizeHighRisk(e.target.checked)}
              className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="prioritize" className="text-xs text-slate-700 font-medium cursor-pointer">
              Prioritaskan Toko Risiko Tinggi di Minggu Pertama
            </label>
          </div>

          {generatedCount !== null ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>
                Berhasil generate <strong>{generatedCount} jadwal SO baru</strong>! Jadwal telah masuk ke sistem.
              </span>
            </div>
          ) : null}

          {/* Buttons */}
          <div className="pt-3 border-t border-slate-200 grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 text-xs font-bold border border-slate-300 transition flex items-center justify-center"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleRunGenerator}
              disabled={candidateStores.length === 0}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-98 disabled:opacity-40 text-white text-xs font-black transition shadow-sm hover:shadow flex items-center justify-center gap-1.5"
            >
              <Wand2 className="w-4 h-4 shrink-0" />
              <span className="truncate">Generate ({candidateStores.length})</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { 
  Building2, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ArrowRight, 
  Users, 
  Filter, 
  X, 
  RotateCcw,
  Search,
  FileSpreadsheet,
  ChevronRight,
  Layers,
  UserCheck
} from 'lucide-react';
import { SOSchedule, Store, AuditorPersonnel } from '../../types/stockOpname';
import { getStatusBadgeClass, formatDateIndo } from '../../utils/formatters';

interface GeneralScheduleMetricsWidgetProps {
  schedules: SOSchedule[];
  stores: Store[];
  personnel?: AuditorPersonnel[];
  selectedMonth: string;
  selectedYear: string;
}

type CategoryType = 'TERJADWAL' | 'SELESAI' | 'PINDAH' | 'GAGAL' | 'PROSES' | 'TOTAL';

export const GeneralScheduleMetricsWidget: React.FC<GeneralScheduleMetricsWidgetProps> = ({
  schedules,
  stores,
  personnel = [],
  selectedMonth,
  selectedYear
}) => {
  const [filterDate, setFilterDate] = useState<string>('ALL');
  const [filterOfficer, setFilterOfficer] = useState<string>('ALL');
  const [activeCategory, setActiveCategory] = useState<CategoryType | null>(null);
  const [modalSearchQuery, setModalSearchQuery] = useState<string>('');

  // Collect all unique Korlap / Officers
  const korlapsInPersonnel = personnel.filter(p => p.role === 'Officer / Korlap');
  const allOfficerOptions = Array.from(
    new Set([
      ...korlapsInPersonnel.map(p => p.name),
      ...schedules.map(s => s.officerInCharge).filter(Boolean).map(name => name?.split(' (')[0] || name)
    ])
  ).filter(Boolean) as string[];

  // Collect unique dates in schedules
  const allDatesInSchedules = Array.from(
    new Set(schedules.map(s => s.scheduledDate).filter(Boolean))
  ).sort() as string[];

  // Filtered schedules base
  const filteredSchedules = schedules.filter(s => {
    // Filter Date
    if (filterDate !== 'ALL' && s.scheduledDate !== filterDate) {
      return false;
    }
    // Filter Officer
    if (filterOfficer !== 'ALL') {
      const officerClean = s.officerInCharge?.split(' (')[0] || '';
      if (!officerClean.toLowerCase().includes(filterOfficer.toLowerCase())) {
        return false;
      }
    }
    return true;
  });

  // Categorized Lists
  const terjadwalList = filteredSchedules.filter(s => s.status === 'Terjadwal');
  const selesaiList = filteredSchedules.filter(s => s.status === 'Selesai');
  const pindahList = filteredSchedules.filter(s => s.status === 'Pindah Toko' || s.failureOrMoveType === 'Pindah Toko');
  const gagalList = filteredSchedules.filter(s => s.status === 'Gagal SO' || s.failureOrMoveType === 'Gagal SO' || s.status === 'Dibatalkan');
  const prosesList = filteredSchedules.filter(s => s.status === 'Proses SO' || s.status === 'Menunggu Rekapan');

  // Modal active list
  const getCategoryList = (): SOSchedule[] => {
    switch (activeCategory) {
      case 'TERJADWAL':
        return terjadwalList;
      case 'SELESAI':
        return selesaiList;
      case 'PINDAH':
        return pindahList;
      case 'GAGAL':
        return gagalList;
      case 'PROSES':
        return prosesList;
      case 'TOTAL':
        return filteredSchedules;
      default:
        return [];
    }
  };

  const currentCategoryList = getCategoryList();
  const searchFilteredList = currentCategoryList.filter(s => {
    const q = modalSearchQuery.toLowerCase();
    return (
      s.storeCode.toLowerCase().includes(q) ||
      s.storeName.toLowerCase().includes(q) ||
      s.region.toLowerCase().includes(q) ||
      (s.officerInCharge && s.officerInCharge.toLowerCase().includes(q))
    );
  });

  const getCategoryTitle = () => {
    switch (activeCategory) {
      case 'TERJADWAL':
        return { title: 'Daftar Toko Terjadwal', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' };
      case 'SELESAI':
        return { title: 'Daftar Toko Selesai SO', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
      case 'PINDAH':
        return { title: 'Daftar Toko Pindah Jadwal', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
      case 'GAGAL':
        return { title: 'Daftar Toko Gagal SO / Batal', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' };
      case 'PROSES':
        return { title: 'Daftar Toko Sedang Audit SO', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' };
      case 'TOTAL':
        return { title: 'Semua Jadwal Toko Terdaftar', color: 'text-slate-800', bg: 'bg-slate-100 border-slate-200' };
      default:
        return { title: '', color: '', bg: '' };
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      
      {/* Header & Filter Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-extrabold text-[10px] uppercase tracking-wider border border-indigo-200">
              FILTER METRIK PENJADWALAN
            </span>
            <span className="text-xs text-slate-500 font-mono font-bold">
              Bulan {selectedMonth} / {selectedYear}
            </span>
          </div>
          <h2 className="text-base font-extrabold text-slate-900 mt-1 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Rekapan Status Toko: Terjadwal, Pindah, Gagal & Realisasi
          </h2>
          <p className="text-xs text-slate-500">
            Klik pada salah satu metrik di bawah untuk membuka popup list toko secara lengkap.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
          
          {/* Tanggal Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Semua Tanggal Bulan Ini</option>
              {allDatesInSchedules.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Korlap / Officer Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            <select
              value={filterOfficer}
              onChange={(e) => setFilterOfficer(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 max-w-[180px]"
            >
              <option value="ALL">Semua Officer / Korlap</option>
              {allOfficerOptions.map(off => (
                <option key={off} value={off}>{off}</option>
              ))}
            </select>
          </div>

          {/* Reset button */}
          {(filterDate !== 'ALL' || filterOfficer !== 'ALL') && (
            <button
              onClick={() => {
                setFilterDate('ALL');
                setFilterOfficer('ALL');
              }}
              className="p-1.5 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
              title="Reset Filter"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

        </div>
      </div>

      {/* Metric Cards Grid - Interactive & Clickable */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Total Target */}
        <div 
          onClick={() => setActiveCategory('TOTAL')}
          className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between hover:shadow-md group ${
            activeCategory === 'TOTAL'
              ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/30'
              : 'bg-white border-slate-200 hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span className={activeCategory === 'TOTAL' ? 'text-slate-300' : 'text-slate-500'}>Total Target</span>
            <Building2 className={`w-4 h-4 ${activeCategory === 'TOTAL' ? 'text-indigo-400' : 'text-slate-600'}`} />
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-black font-mono ${activeCategory === 'TOTAL' ? 'text-white' : 'text-slate-900'}`}>
              {filteredSchedules.length}
            </div>
            <span className={`text-[10px] font-semibold flex items-center gap-1 mt-0.5 ${
              activeCategory === 'TOTAL' ? 'text-indigo-300' : 'text-indigo-600 group-hover:underline'
            }`}>
              Lihat Semua Toko <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Toko Terjadwal */}
        <div 
          onClick={() => setActiveCategory('TERJADWAL')}
          className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between hover:shadow-md group ${
            activeCategory === 'TERJADWAL'
              ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-500/30'
              : 'bg-indigo-50/50 border-indigo-200 hover:border-indigo-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span className={activeCategory === 'TERJADWAL' ? 'text-indigo-100' : 'text-indigo-800'}>Terjadwal</span>
            <Calendar className={`w-4 h-4 ${activeCategory === 'TERJADWAL' ? 'text-white' : 'text-indigo-600'}`} />
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-black font-mono ${activeCategory === 'TERJADWAL' ? 'text-white' : 'text-indigo-900'}`}>
              {terjadwalList.length}
            </div>
            <span className={`text-[10px] font-semibold flex items-center gap-1 mt-0.5 ${
              activeCategory === 'TERJADWAL' ? 'text-indigo-200' : 'text-indigo-700 group-hover:underline'
            }`}>
              Klik Detail List <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Toko Sedang Proses */}
        <div 
          onClick={() => setActiveCategory('PROSES')}
          className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between hover:shadow-md group ${
            activeCategory === 'PROSES'
              ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-500/30'
              : 'bg-blue-50/50 border-blue-200 hover:border-blue-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span className={activeCategory === 'PROSES' ? 'text-blue-100' : 'text-blue-800'}>Sedang SO</span>
            <Clock className={`w-4 h-4 ${activeCategory === 'PROSES' ? 'text-white' : 'text-blue-600'}`} />
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-black font-mono ${activeCategory === 'PROSES' ? 'text-white' : 'text-blue-900'}`}>
              {prosesList.length}
            </div>
            <span className={`text-[10px] font-semibold flex items-center gap-1 mt-0.5 ${
              activeCategory === 'PROSES' ? 'text-blue-200' : 'text-blue-700 group-hover:underline'
            }`}>
              Klik Detail List <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Toko Selesai */}
        <div 
          onClick={() => setActiveCategory('SELESAI')}
          className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between hover:shadow-md group ${
            activeCategory === 'SELESAI'
              ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-500/30'
              : 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span className={activeCategory === 'SELESAI' ? 'text-emerald-100' : 'text-emerald-800'}>Selesai SO</span>
            <CheckCircle2 className={`w-4 h-4 ${activeCategory === 'SELESAI' ? 'text-white' : 'text-emerald-600'}`} />
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-black font-mono ${activeCategory === 'SELESAI' ? 'text-white' : 'text-emerald-900'}`}>
              {selesaiList.length}
            </div>
            <span className={`text-[10px] font-semibold flex items-center gap-1 mt-0.5 ${
              activeCategory === 'SELESAI' ? 'text-emerald-200' : 'text-emerald-700 group-hover:underline'
            }`}>
              Klik Detail List <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Toko Pindah */}
        <div 
          onClick={() => setActiveCategory('PINDAH')}
          className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between hover:shadow-md group ${
            activeCategory === 'PINDAH'
              ? 'bg-amber-600 text-white border-amber-700 ring-2 ring-amber-500/30'
              : 'bg-amber-50/50 border-amber-200 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span className={activeCategory === 'PINDAH' ? 'text-amber-100' : 'text-amber-800'}>Toko Pindah</span>
            <ArrowRight className={`w-4 h-4 ${activeCategory === 'PINDAH' ? 'text-white' : 'text-amber-600'}`} />
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-black font-mono ${activeCategory === 'PINDAH' ? 'text-white' : 'text-amber-900'}`}>
              {pindahList.length}
            </div>
            <span className={`text-[10px] font-semibold flex items-center gap-1 mt-0.5 ${
              activeCategory === 'PINDAH' ? 'text-amber-200' : 'text-amber-700 group-hover:underline'
            }`}>
              Klik Detail List <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Toko Gagal SO */}
        <div 
          onClick={() => setActiveCategory('GAGAL')}
          className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between hover:shadow-md group ${
            activeCategory === 'GAGAL'
              ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-500/30'
              : 'bg-rose-50/50 border-rose-200 hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span className={activeCategory === 'GAGAL' ? 'text-rose-100' : 'text-rose-800'}>Toko Gagal SO</span>
            <AlertTriangle className={`w-4 h-4 ${activeCategory === 'GAGAL' ? 'text-white' : 'text-rose-600'}`} />
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-black font-mono ${activeCategory === 'GAGAL' ? 'text-white' : 'text-rose-900'}`}>
              {gagalList.length}
            </div>
            <span className={`text-[10px] font-semibold flex items-center gap-1 mt-0.5 ${
              activeCategory === 'GAGAL' ? 'text-rose-200' : 'text-rose-700 group-hover:underline'
            }`}>
              Klik Detail List <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

      </div>

      {/* Detail Store List Modal (Drill-Down when card is clicked) */}
      {activeCategory && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className={`p-4 px-6 border-b flex items-center justify-between shrink-0 ${getCategoryTitle().bg}`}>
              <div>
                <h3 className={`font-extrabold text-sm flex items-center gap-2 ${getCategoryTitle().color}`}>
                  <Layers className="w-4 h-4" />
                  {getCategoryTitle().title} ({searchFilteredList.length} Toko)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Filter Aktif: Tanggal <strong>{filterDate}</strong> | Korlap <strong>{filterOfficer}</strong>
                </p>
              </div>

              <button
                onClick={() => {
                  setActiveCategory(null);
                  setModalSearchQuery('');
                }}
                className="p-1.5 hover:bg-black/10 rounded-lg text-slate-500 hover:text-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="p-3 px-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari kode toko, nama toko, wilayah, atau korlap..."
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Total Item: <strong>{searchFilteredList.length}</strong>
              </span>
            </div>

            {/* List Table */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {searchFilteredList.length > 0 ? (
                searchFilteredList.map((s) => (
                  <div 
                    key={s.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 text-[11px]">
                            {s.storeCode}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">{s.region}</span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 mt-0.5">{s.storeName}</h4>
                      </div>

                      <span className={`px-2.5 py-0.5 text-[10px] rounded-full border font-bold ${getStatusBadgeClass(s.status)}`}>
                        {s.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 bg-slate-50/80 p-2.5 rounded-lg">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Korlap In Charge:</span>
                        <strong className="text-slate-800">{s.officerInCharge || 'Unassigned'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Tgl & Jam SO:</span>
                        <strong className="text-slate-800 font-mono">{s.scheduledDate} ({s.scheduledTime || '21:00'} WIB)</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">SPV Penanggung Jawab:</span>
                        <strong className="text-indigo-700 font-medium">{s.spvInCharge || 'Gean Pratama'}</strong>
                      </div>
                    </div>

                    {/* Personnel */}
                    {s.assignedPersonnelNames && s.assignedPersonnelNames.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                        <span className="font-bold text-indigo-900 flex items-center gap-1">
                          <Users className="w-3 h-3 text-indigo-600" />
                          Auditor:
                        </span>
                        {s.assignedPersonnelNames.map((name, idx) => (
                          <span key={idx} className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                            {name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Reason / Replacement */}
                    {(s.failureOrMoveReason || s.notes) && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 space-y-0.5">
                        <span className="font-bold text-amber-800">Catatan / Alasan Korlap:</span>
                        <p className="italic">"{s.failureOrMoveReason || s.notes}"</p>
                        {s.replacementStoreCode && (
                          <div className="font-bold text-indigo-700 text-[10px] mt-1">
                            👉 Toko Pengganti: {s.replacementStoreCode} - {s.replacementStoreName}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400">
                  Tidak ada data toko dalam kategori ini yang sesuai kata kunci pencarian.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-mono">
                System Auto-Sync Active
              </span>
              <button
                onClick={() => {
                  setActiveCategory(null);
                  setModalSearchQuery('');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition"
              >
                Tutup List
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

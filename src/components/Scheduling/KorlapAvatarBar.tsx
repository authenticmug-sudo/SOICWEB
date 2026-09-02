import React, { useMemo } from 'react';
import { Users, User, Check, Sparkles } from 'lucide-react';
import { SOSchedule, Store, AuditorPersonnel } from '../../types/stockOpname';
import { isKorlapMatch, normalizeKorlapName, getAvailableKorlapList } from '../../utils/korlapUtils';

interface KorlapAvatarBarProps {
  schedules: SOSchedule[];
  stores: Store[];
  personnel?: AuditorPersonnel[];
  selectedKorlap: string;
  onSelectKorlap: (korlap: string) => void;
  className?: string;
}

interface KorlapItem {
  id: string;
  fullName: string;
  shortName: string;
  initials: string;
  storeCount: number;
  completedCount: number;
  pendingCount: number;
  colorBg: string;
  colorBorder: string;
  colorText: string;
  colorRing: string;
}

const COLOR_PALETTES = [
  { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', ring: 'ring-indigo-500', activeBg: 'bg-indigo-600', activeText: 'text-white' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', ring: 'ring-emerald-500', activeBg: 'bg-emerald-600', activeText: 'text-white' },
  { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', ring: 'ring-purple-500', activeBg: 'bg-purple-600', activeText: 'text-white' },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', ring: 'ring-amber-500', activeBg: 'bg-amber-600', activeText: 'text-white' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', ring: 'ring-rose-500', activeBg: 'bg-rose-600', activeText: 'text-white' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-800', ring: 'ring-cyan-500', activeBg: 'bg-cyan-600', activeText: 'text-white' },
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', ring: 'ring-blue-500', activeBg: 'bg-blue-600', activeText: 'text-white' },
  { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800', ring: 'ring-teal-500', activeBg: 'bg-teal-600', activeText: 'text-white' }
];

export const KorlapAvatarBar: React.FC<KorlapAvatarBarProps> = ({
  schedules,
  stores,
  personnel = [],
  selectedKorlap,
  onSelectKorlap,
  className = ''
}) => {
  const korlapList = useMemo(() => {
    return getAvailableKorlapList(personnel);
  }, [personnel]);

  // Generate short name and initials
  const getShortNameAndInitials = (name: string): { shortName: string; initials: string } => {
    const clean = normalizeKorlapName(name);
    if (clean.includes('ANGGA RISTA') || clean.includes('WAYAN ANGGA')) {
      return { shortName: 'Angga Rista', initials: 'AR' };
    }
    if (clean.includes('ANGGA ARDI')) {
      return { shortName: 'Angga Ardi', initials: 'AA' };
    }
    if (clean.includes('ODI')) {
      return { shortName: 'Odi Tri', initials: 'OT' };
    }
    if (clean.includes('ABDUL')) {
      return { shortName: 'Abdul Rahman', initials: 'AR' };
    }
    if (clean.includes('PASEK')) {
      return { shortName: 'Pasek Santika', initials: 'PS' };
    }
    if (clean.includes('BISMA')) {
      return { shortName: 'Putu Bisma', initials: 'PB' };
    }

    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return {
        shortName: parts[0],
        initials: parts[0].slice(0, 2).toUpperCase()
      };
    }
    return {
      shortName: parts.slice(0, 2).join(' '),
      initials: (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
    };
  };

  const korlapData: KorlapItem[] = useMemo(() => {
    return korlapList.map((kName, idx) => {
      const { shortName, initials } = getShortNameAndInitials(kName);
      const palette = COLOR_PALETTES[idx % COLOR_PALETTES.length];

      // Calculate stores count for this Korlap
      let count = 0;
      let completed = 0;

      schedules.forEach(s => {
        const scheduleOfficer = s.officerInCharge || s.groupName || '';
        const store = stores.find(st => st.id === s.storeId || st.code === s.storeCode);
        const storeOfficer = store?.korlap || '';

        let matched = false;
        if (scheduleOfficer && scheduleOfficer.trim() !== '' && scheduleOfficer !== 'PETUGAS SO') {
          matched = isKorlapMatch(scheduleOfficer, kName);
        } else if (storeOfficer) {
          matched = isKorlapMatch(storeOfficer, kName);
        }

        if (matched) {
          count++;
          if (s.status === 'Selesai' || s.spvApprovalStatus === 'Disetujui SPV') {
            completed++;
          }
        }
      });

      return {
        id: kName,
        fullName: kName,
        shortName,
        initials,
        storeCount: count,
        completedCount: completed,
        pendingCount: count - completed,
        colorBg: palette.bg,
        colorBorder: palette.border,
        colorText: palette.text,
        colorRing: palette.ring
      };
    });
  }, [korlapList, schedules, stores]);

  const totalAllStores = schedules.length;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <Users className="w-3.5 h-3.5 text-indigo-600" />
          <span>Pilih Korlap SO:</span>
          {selectedKorlap !== 'ALL' && (
            <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded-md">
              Aktif: {korlapData.find(k => k.fullName === selectedKorlap)?.shortName || selectedKorlap}
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-400 font-medium">
          Geser untuk memilih avatar ➔
        </div>
      </div>

      {/* Horizontal Scrollable Carousel */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 pt-0.5 custom-scrollbar snap-x no-scrollbar">
        
        {/* 'SEMUA KORLAP' Avatar Button */}
        <button
          type="button"
          onClick={() => onSelectKorlap('ALL')}
          className={`shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-2xl border transition-all duration-200 snap-start select-none ${
            selectedKorlap === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20 scale-[1.02]'
              : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs transition-colors ${
            selectedKorlap === 'ALL'
              ? 'bg-white/20 text-white'
              : 'bg-slate-100 text-slate-800 border border-slate-200'
          }`}>
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="text-left pr-1">
            <div className={`text-xs font-black leading-tight ${selectedKorlap === 'ALL' ? 'text-white' : 'text-slate-900'}`}>
              Semua Korlap
            </div>
            <div className={`text-[10px] font-mono leading-none mt-0.5 ${selectedKorlap === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
              {totalAllStores} Toko SO
            </div>
          </div>
        </button>

        {/* Individual Korlap Avatars */}
        {korlapData.map((korlap, idx) => {
          const isSelected = isKorlapMatch(selectedKorlap, korlap.fullName);
          const palette = COLOR_PALETTES[idx % COLOR_PALETTES.length];

          return (
            <button
              key={korlap.id}
              type="button"
              onClick={() => onSelectKorlap(isSelected ? 'ALL' : korlap.fullName)}
              className={`shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-2xl border transition-all duration-200 snap-start select-none group ${
                isSelected
                  ? `${palette.activeBg} text-white border-transparent shadow-md ring-2 ${palette.ring} scale-[1.02]`
                  : `bg-white text-slate-700 border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/80 shadow-2xs`
              }`}
              title={`Klik untuk filter jadwal ${korlap.fullName}`}
            >
              {/* Avatar Circle with Initials & Badge */}
              <div className="relative">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs tracking-wider transition-transform group-hover:scale-105 ${
                  isSelected
                    ? 'bg-white/20 text-white border border-white/30'
                    : `${korlap.colorBg} ${korlap.colorText} border ${korlap.colorBorder}`
                }`}>
                  {korlap.initials}
                </div>

                {/* Micro Indicator if Korlap has active stores */}
                {korlap.storeCount > 0 && (
                  <span className={`absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-mono font-black flex items-center justify-center border shadow-xs ${
                    isSelected
                      ? 'bg-white text-slate-900 border-white'
                      : 'bg-indigo-600 text-white border-white'
                  }`}>
                    {korlap.storeCount}
                  </span>
                )}
              </div>

              {/* Korlap Name & Stats */}
              <div className="text-left pr-1">
                <div className={`text-xs font-black leading-tight truncate max-w-[110px] ${
                  isSelected ? 'text-white' : 'text-slate-900 group-hover:text-indigo-600'
                }`}>
                  {korlap.shortName}
                </div>
                <div className={`text-[10px] font-medium leading-none mt-0.5 flex items-center gap-1 ${
                  isSelected ? 'text-white/80' : 'text-slate-500'
                }`}>
                  <span>{korlap.storeCount} Toko</span>
                  {korlap.completedCount > 0 && (
                    <span className={`text-[9px] font-bold ${isSelected ? 'text-emerald-200' : 'text-emerald-600'}`}>
                      • {korlap.completedCount} Selesai
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}

      </div>
    </div>
  );
};

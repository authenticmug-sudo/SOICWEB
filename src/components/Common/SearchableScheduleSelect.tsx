import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Calendar, Check, ChevronDown, X, Sparkles, Building2, UserCheck, MapPin } from 'lucide-react';
import { SOSchedule } from '../../types/stockOpname';

interface SearchableScheduleSelectProps {
  schedules: SOSchedule[];
  selectedScheduleId: string;
  onSelectSchedule: (schedule: SOSchedule) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const SearchableScheduleSelect: React.FC<SearchableScheduleSelectProps> = ({
  schedules,
  selectedScheduleId,
  onSelectSchedule,
  placeholder = 'Ketik kode toko, nama toko, tanggal, atau nama korlap...',
  label = 'Pilih Toko & Jadwal SO',
  required = false,
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Selected schedule
  const selectedSchedule = useMemo(() => {
    return schedules.find(s => s.id === selectedScheduleId) || null;
  }, [schedules, selectedScheduleId]);

  // Filtered schedules
  const filteredSchedules = useMemo(() => {
    if (!searchQuery.trim()) {
      return schedules;
    }

    const q = searchQuery.toLowerCase().trim();
    const qClean = q.replace(/[^a-z0-9]/g, '');

    const scored = schedules.map(sch => {
      let score = 0;
      const code = (sch.storeCode || '').toLowerCase();
      const codeClean = code.replace(/[^a-z0-9]/g, '');
      const name = (sch.storeName || '').toLowerCase();
      const region = (sch.region || '').toLowerCase();
      const date = (sch.scheduledDate || '').toLowerCase();
      const officer = (sch.officerInCharge || '').toLowerCase();
      const team = (sch.teamName || '').toLowerCase();

      if (code === q || codeClean === qClean) score += 1000;
      else if (code.startsWith(q) || codeClean.startsWith(qClean)) score += 500;
      else if (code.includes(q) || codeClean.includes(qClean)) score += 200;

      if (name.includes(q)) score += 300;
      if (date.includes(q)) score += 250;
      if (officer.includes(q)) score += 200;
      if (team.includes(q)) score += 100;
      if (region.includes(q)) score += 80;

      return { sch, score };
    });

    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.sch);
  }, [schedules, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      setHighlightedIndex(0);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredSchedules.length - 1 ? prev + 1 : prev));
      scrollHighlightedIntoView(highlightedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
      scrollHighlightedIntoView(highlightedIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredSchedules[highlightedIndex]) {
        handleSelect(filteredSchedules[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const scrollHighlightedIntoView = (index: number) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-schedule-item]');
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  };

  const handleSelect = (sch: SOSchedule) => {
    onSelectSchedule(sch);
    setIsOpen(false);
    setSearchQuery('');
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim() || !text) return text;
    const regex = new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-amber-200 text-amber-950 font-bold px-0.5 rounded-xs">{part}</mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[11px] font-extrabold text-slate-800 uppercase tracking-wide mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            {label} {required && <span className="text-rose-500">*</span>}
          </span>
          <span className="text-[10px] text-slate-400 font-normal">
            ({schedules.length} Jadwal Tersedia)
          </span>
        </label>
      )}

      {/* Main Trigger Box */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        className={`w-full min-h-[44px] bg-white border rounded-xl p-2.5 sm:px-3 text-xs flex items-center justify-between gap-2 cursor-pointer transition select-none shadow-2xs ${
          disabled 
            ? 'opacity-60 cursor-not-allowed bg-slate-100 border-slate-200' 
            : isOpen 
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white' 
            : 'border-slate-300 hover:border-indigo-300'
        }`}
      >
        {selectedSchedule ? (
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <span className="shrink-0 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 font-mono font-black text-[11px] border border-indigo-200">
              [{selectedSchedule.storeCode}]
            </span>
            <div className="truncate flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900 truncate">
                {selectedSchedule.storeName}
              </span>
              <span className="text-slate-400 font-normal hidden sm:inline">•</span>
              <span className="text-indigo-700 font-bold text-[11px] hidden sm:inline">
                Tgl: {selectedSchedule.scheduledDate}
              </span>
            </div>
            {selectedSchedule.officerInCharge && (
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                <UserCheck className="w-2.5 h-2.5 text-slate-500" />
                {selectedSchedule.officerInCharge}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400">
            <Search className="w-3.5 h-3.5" />
            <span className="text-xs">{placeholder}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold border border-indigo-100 hidden sm:inline-block">
            Cari Cepat
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} />
        </div>
      </div>

      {/* Dropdown Menu & Smart Search */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Smart Search Input Bar */}
          <div className="p-2.5 bg-slate-900 text-white border-b border-slate-800 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ketik kode (F010), nama toko, tgl (2026-08), atau korlap..."
                className="w-full bg-slate-800 text-white placeholder-slate-400 text-xs rounded-xl pl-9 pr-8 py-2 border border-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="shrink-0 flex items-center gap-1 text-[10px] text-indigo-300 font-bold bg-indigo-950/80 px-2 py-1.5 rounded-lg border border-indigo-800/60">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Smart Search</span>
            </div>
          </div>

          {/* Quick Info bar */}
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              {searchQuery.trim() ? (
                <>Ditemukan <strong>{filteredSchedules.length}</strong> jadwal cocok</>
              ) : (
                <>Total <strong>{filteredSchedules.length}</strong> jadwal SO</>
              )}
            </span>
            <span className="text-[10px] text-slate-400">Gunakan ↑↓ dan Enter</span>
          </div>

          {/* Schedule List */}
          <div 
            ref={listRef}
            className="max-h-64 overflow-y-auto divide-y divide-slate-100"
          >
            {filteredSchedules.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
                <p className="text-xs font-semibold text-slate-600">Tidak ada jadwal yang cocok</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Coba cari dengan kode toko, tanggal, atau nama korlap</p>
              </div>
            ) : (
              filteredSchedules.map((sch, index) => {
                const isSelected = selectedScheduleId === sch.id;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={sch.id}
                    data-schedule-item
                    onClick={() => handleSelect(sch)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`p-2.5 px-3 flex items-center justify-between cursor-pointer transition select-none ${
                      isSelected 
                        ? 'bg-indigo-50 text-indigo-950 font-bold' 
                        : isHighlighted 
                        ? 'bg-slate-100' 
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                      <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-mono font-bold text-[11px]">
                        [{highlightMatch(sch.storeCode, searchQuery)}]
                      </span>

                      <div className="truncate">
                        <div className="text-xs text-slate-900 font-bold truncate flex items-center gap-1.5">
                          <span>{highlightMatch(sch.storeName, searchQuery)}</span>
                          <span className="text-[10px] text-indigo-600 font-bold">
                            • Tgl: {highlightMatch(sch.scheduledDate, searchQuery)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5 text-slate-400" />
                            {highlightMatch(sch.region, searchQuery)}
                          </span>
                          {sch.officerInCharge && (
                            <span className="text-slate-600 truncate font-medium">
                              • Korlap: {highlightMatch(sch.officerInCharge, searchQuery)}
                            </span>
                          )}
                          {sch.teamName && (
                            <span className="text-slate-400 truncate">
                              • {sch.teamName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                        sch.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                        sch.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                        sch.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {sch.status}
                      </span>
                      {isSelected ? (
                        <span className="p-1 rounded-full bg-indigo-600 text-white">
                          <Check className="w-3 h-3" />
                        </span>
                      ) : (
                        <span className="w-5" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

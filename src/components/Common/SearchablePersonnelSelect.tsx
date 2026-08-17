import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, UserCheck, Check, ChevronDown, X, Sparkles, AlertTriangle, User, Shield } from 'lucide-react';
import { AuditorPersonnel } from '../../types/stockOpname';

interface SearchablePersonnelSelectProps {
  personnel: AuditorPersonnel[];
  selectedPersonnelId: string;
  onSelectPersonnel: (person: AuditorPersonnel | null, isCustom?: boolean, customName?: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  roleFilter?: string; // e.g. 'Officer / Korlap' or undefined for all
  allowCustom?: boolean;
  customName?: string;
  onCustomNameChange?: (name: string) => void;
  className?: string;
  highlightStatusWarning?: boolean;
}

export const SearchablePersonnelSelect: React.FC<SearchablePersonnelSelectProps> = ({
  personnel,
  selectedPersonnelId,
  onSelectPersonnel,
  placeholder = 'Ketik NIK atau nama personil / korlap...',
  label = 'Officer / Korlap Penanggung Jawab',
  required = false,
  disabled = false,
  roleFilter,
  allowCustom = true,
  customName = '',
  onCustomNameChange,
  className = '',
  highlightStatusWarning = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isCustomSelected = selectedPersonnelId === 'CUSTOM';

  // Selected person object
  const selectedPerson = useMemo(() => {
    if (isCustomSelected) return null;
    return personnel.find(p => p.id === selectedPersonnelId) || null;
  }, [personnel, selectedPersonnelId, isCustomSelected]);

  // Base list of personnel filtered by role if specified
  const basePersonnelList = useMemo(() => {
    if (!roleFilter) return personnel;
    return personnel.filter(p => p.role === roleFilter);
  }, [personnel, roleFilter]);

  // Ranked results with smart match
  const filteredPersonnel = useMemo(() => {
    if (!searchQuery.trim()) {
      return basePersonnelList;
    }

    const q = searchQuery.toLowerCase().trim();
    const qClean = q.replace(/[^a-z0-9]/g, '');

    const scored = basePersonnelList.map(person => {
      let score = 0;
      const nik = (person.nik || '').toLowerCase();
      const nikClean = nik.replace(/[^a-z0-9]/g, '');
      const name = (person.name || '').toLowerCase();
      const role = (person.role || '').toLowerCase();
      const team = (person.teamName || '').toLowerCase();
      const status = (person.status || '').toLowerCase();
      const korlap = (person.korlapName || '').toLowerCase();

      // NIK match
      if (nik === q || nikClean === qClean) {
        score += 1000;
      } else if (nik.startsWith(q) || nikClean.startsWith(qClean)) {
        score += 600;
      } else if (nik.includes(q) || nikClean.includes(qClean)) {
        score += 300;
      }

      // Name match
      if (name === q) {
        score += 800;
      } else if (name.startsWith(q)) {
        score += 450;
      } else if (name.includes(q)) {
        score += 200;
      }

      // Multi-word name match
      const tokens = q.split(/\s+/);
      if (tokens.length > 1) {
        const allTokensMatch = tokens.every(tok => 
          name.includes(tok) || nik.includes(tok) || role.includes(tok) || team.includes(tok)
        );
        if (allTokensMatch) score += 250;
      }

      // Role, status, korlap matches
      if (role.includes(q)) score += 80;
      if (status.includes(q)) score += 70;
      if (korlap.includes(q)) score += 60;
      if (team.includes(q)) score += 60;

      return { person, score };
    });

    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.person);
  }, [basePersonnelList, searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus input when opened
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

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalOptions = filteredPersonnel.length + (allowCustom ? 1 : 0);

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < totalOptions - 1 ? prev + 1 : prev));
      scrollHighlightedIntoView(highlightedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
      scrollHighlightedIntoView(highlightedIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex < filteredPersonnel.length) {
        handleSelectPerson(filteredPersonnel[highlightedIndex]);
      } else if (allowCustom) {
        handleSelectCustom();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const scrollHighlightedIntoView = (index: number) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-personnel-item]');
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  };

  const handleSelectPerson = (person: AuditorPersonnel) => {
    onSelectPersonnel(person, false);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelectCustom = () => {
    onSelectPersonnel(null, true, customName);
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
    <div className={`space-y-1.5 ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold text-indigo-900 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            {label} {required && <span className="text-rose-500">*</span>}
          </span>
          <span className="text-[10px] text-indigo-600 font-normal">
            ({basePersonnelList.length} Personil Terdaftar)
          </span>
        </label>
      )}

      {/* Main Trigger Box */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        className={`w-full min-h-[42px] bg-white border rounded-xl p-2 sm:px-3 text-xs flex items-center justify-between gap-2 cursor-pointer transition select-none shadow-2xs ${
          disabled 
            ? 'opacity-60 cursor-not-allowed bg-slate-100 border-slate-200' 
            : isOpen 
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white' 
            : 'border-indigo-200 hover:border-indigo-400'
        }`}
      >
        {isCustomSelected ? (
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <span className="shrink-0 px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-mono font-bold text-[10px] border border-purple-200">
              CUSTOM
            </span>
            <span className="font-extrabold text-slate-900 truncate">
              {customName ? customName : '(Nama Custom Belum Diisi)'}
            </span>
          </div>
        ) : selectedPerson ? (
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            {selectedPerson.nik && (
              <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono font-bold text-[11px] border border-slate-200">
                [{selectedPerson.nik}]
              </span>
            )}
            <span className="font-extrabold text-slate-900 truncate">
              {selectedPerson.name}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
              {selectedPerson.role}
            </span>
            <span className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ${
              selectedPerson.status === 'Aktif' 
                ? 'bg-emerald-100 text-emerald-800' 
                : selectedPerson.status === 'Cuti' 
                ? 'bg-amber-100 text-amber-800' 
                : 'bg-rose-100 text-rose-800'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                selectedPerson.status === 'Aktif' ? 'bg-emerald-500' : selectedPerson.status === 'Cuti' ? 'bg-amber-500' : 'bg-rose-500'
              }`} />
              {selectedPerson.status}
            </span>
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

      {/* Custom Name Input Field when CUSTOM is selected */}
      {isCustomSelected && (
        <div className="pt-1">
          <input
            type="text"
            placeholder="Masukkan Nama Korlap Custom Manual..."
            value={customName}
            onChange={(e) => onCustomNameChange && onCustomNameChange(e.target.value)}
            className="w-full bg-white border border-indigo-300 rounded-xl text-xs p-2.5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
            autoFocus
          />
        </div>
      )}

      {/* Warning Alert if person is on leave or sick */}
      {highlightStatusWarning && selectedPerson && selectedPerson.status !== 'Aktif' && (
        <div className="p-2 bg-amber-50 border border-amber-300 rounded-xl text-[11px] text-amber-900 flex items-center gap-2 animate-in fade-in duration-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Perhatian:</strong> {selectedPerson.name} berstatus <strong>{selectedPerson.status}</strong> 
            {selectedPerson.statusStartDate && ` (${selectedPerson.statusStartDate} s/d ${selectedPerson.statusEndDate || 'selesai'})`}.
          </span>
        </div>
      )}

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
                placeholder="Ketik NIK (2012...), nama personil, atau peran..."
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
                <>Ditemukan <strong>{filteredPersonnel.length}</strong> personil cocok</>
              ) : (
                <>Total <strong>{filteredPersonnel.length}</strong> personil</>
              )}
            </span>
            <span className="text-[10px] text-slate-400">Gunakan ↑↓ dan Enter</span>
          </div>

          {/* Personnel List */}
          <div 
            ref={listRef}
            className="max-h-64 overflow-y-auto divide-y divide-slate-100"
          >
            {filteredPersonnel.length === 0 && !allowCustom ? (
              <div className="p-6 text-center text-slate-400">
                <UserCheck className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
                <p className="text-xs font-semibold text-slate-600">Tidak ada personil yang cocok</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Coba cari dengan NIK, nama lengkap, atau panggilan</p>
              </div>
            ) : (
              <>
                {filteredPersonnel.map((person, index) => {
                  const isSelected = !isCustomSelected && selectedPersonnelId === person.id;
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <div
                      key={person.id}
                      data-personnel-item
                      onClick={() => handleSelectPerson(person)}
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
                        {person.nik && (
                          <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-mono font-bold text-[11px]">
                            [{highlightMatch(person.nik, searchQuery)}]
                          </span>
                        )}

                        <div className="truncate">
                          <div className="text-xs text-slate-900 font-bold truncate flex items-center gap-1.5">
                            <span>{highlightMatch(person.name, searchQuery)}</span>
                            <span className="text-[10px] text-indigo-600 font-normal">
                              • {person.role}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            {person.teamName && (
                              <span>Tim: {person.teamName}</span>
                            )}
                            {person.korlapName && (
                              <span>• Korlap: {person.korlapName}</span>
                            )}
                            {person.phone && (
                              <span>• {person.phone}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status badge & check */}
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          person.status === 'Aktif' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : person.status === 'Cuti' 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {person.status}
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
                })}

                {/* Option for Custom Input */}
                {allowCustom && (
                  <div
                    data-personnel-item
                    onClick={handleSelectCustom}
                    onMouseEnter={() => setHighlightedIndex(filteredPersonnel.length)}
                    className={`p-3 flex items-center justify-between cursor-pointer border-t border-dashed border-indigo-200 transition ${
                      isCustomSelected || highlightedIndex === filteredPersonnel.length
                        ? 'bg-purple-50 text-purple-900 font-bold'
                        : 'bg-indigo-50/40 text-indigo-900 hover:bg-indigo-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-indigo-200 text-indigo-800 font-bold text-xs">
                        +
                      </span>
                      <div>
                        <span className="text-xs font-black">+ Input Nama Korlap / Officer Custom Manual</span>
                        <p className="text-[10px] text-slate-500">Pilih jika nama belum terdaftar di Master Personil</p>
                      </div>
                    </div>
                    {isCustomSelected && (
                      <span className="p-1 rounded-full bg-purple-600 text-white">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

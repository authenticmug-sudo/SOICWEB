import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Building2, Check, ChevronDown, X, Sparkles, MapPin, ShieldAlert, Navigation, Compass, Filter, RefreshCw } from 'lucide-react';
import { Store } from '../../types/stockOpname';
import { calculateHaversineDistance, extractKabupatenKecamatanMap, normalizeKabupaten, normalizeKecamatan } from '../../utils/geoUtils';

interface SearchableStoreSelectProps {
  stores: Store[];
  selectedStoreId: string;
  onSelectStore: (store: Store) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
  referenceStore?: Store | null;
  referenceStoreLabel?: string;
  onClearReferenceStore?: () => void;
  showFilters?: boolean;
  selectedKabupatenFilter?: string;
  selectedKecamatanFilter?: string;
  onKabupatenFilterChange?: (kab: string) => void;
  onKecamatanFilterChange?: (kec: string) => void;
}

export const SearchableStoreSelect: React.FC<SearchableStoreSelectProps> = ({
  stores,
  selectedStoreId,
  onSelectStore,
  placeholder = 'Ketik kode toko, nama toko, atau wilayah...',
  label,
  required = false,
  disabled = false,
  className = '',
  autoFocus = false,
  referenceStore = null,
  referenceStoreLabel = 'Toko Acuan',
  onClearReferenceStore,
  showFilters = true,
  selectedKabupatenFilter,
  selectedKecamatanFilter,
  onKabupatenFilterChange,
  onKecamatanFilterChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [sortByDistance, setSortByDistance] = useState(false);
  
  // Local filter states if not controlled from parent
  const [localKabupaten, setLocalKabupaten] = useState<string>('ALL');
  const [localKecamatan, setLocalKecamatan] = useState<string>('ALL');

  const activeKabupaten = selectedKabupatenFilter !== undefined ? selectedKabupatenFilter : localKabupaten;
  const activeKecamatan = selectedKecamatanFilter !== undefined ? selectedKecamatanFilter : localKecamatan;

  const handleKabupatenChange = (val: string) => {
    if (onKabupatenFilterChange) {
      onKabupatenFilterChange(val);
    } else {
      setLocalKabupaten(val);
    }
    // Reset kecamatan when kabupaten changes
    if (onKecamatanFilterChange) {
      onKecamatanFilterChange('ALL');
    } else {
      setLocalKecamatan('ALL');
    }
  };

  const handleKecamatanChange = (val: string) => {
    if (onKecamatanFilterChange) {
      onKecamatanFilterChange(val);
    } else {
      setLocalKecamatan(val);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Extract distinct Kabupaten and Kecamatan lists from stores
  const { kabupatenList, kecamatanByKabupaten } = useMemo(() => {
    return extractKabupatenKecamatanMap(stores);
  }, [stores]);

  const availableKecamatans = useMemo(() => {
    if (activeKabupaten === 'ALL') {
      const set = new Set<string>();
      (Object.values(kecamatanByKabupaten) as string[][]).forEach(list => {
        list.forEach(k => set.add(k));
      });
      return Array.from(set).sort();
    }
    return kecamatanByKabupaten[activeKabupaten] || [];
  }, [activeKabupaten, kecamatanByKabupaten]);

  // Selected store object
  const selectedStore = useMemo(() => {
    return stores.find(s => s.id === selectedStoreId) || null;
  }, [stores, selectedStoreId]);

  // Calculate distance for a store from the referenceStore
  const getStoreDistance = (store: Store): number | null => {
    if (!referenceStore || !referenceStore.latitude || !referenceStore.longitude || !store.latitude || !store.longitude) {
      return null;
    }
    if (referenceStore.id === store.id || referenceStore.code === store.code) {
      return 0;
    }
    return calculateHaversineDistance(
      referenceStore.latitude,
      referenceStore.longitude,
      store.latitude,
      store.longitude
    );
  };

  // Selected store distance from referenceStore
  const selectedStoreDistance = selectedStore ? getStoreDistance(selectedStore) : null;

  // Filtered & Ranked stores with smart search scoring, Kabupaten/Kecamatan filter & distance
  const filteredStores = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const qClean = q.replace(/[^a-z0-9]/g, '');

    // 1. Filter by Kabupaten and Kecamatan first
    let candidateStores = stores;

    if (activeKabupaten !== 'ALL') {
      candidateStores = candidateStores.filter(s => {
        const kab = normalizeKabupaten(s.kabupaten, s.region, s.city);
        return kab.toLowerCase() === activeKabupaten.toLowerCase();
      });
    }

    if (activeKecamatan !== 'ALL') {
      candidateStores = candidateStores.filter(s => {
        const kec = normalizeKecamatan(s.kecamatan, s.district, s.name);
        return kec.toLowerCase() === activeKecamatan.toLowerCase();
      });
    }

    const storeItems = candidateStores.map(store => {
      const dist = getStoreDistance(store);
      let score = 0;

      if (q) {
        const code = (store.code || '').toLowerCase();
        const codeClean = code.replace(/[^a-z0-9]/g, '');
        const name = (store.name || '').toLowerCase();
        const region = (store.region || '').toLowerCase();
        const kabupaten = (store.kabupaten || '').toLowerCase();
        const city = (store.city || '').toLowerCase();
        const kecamatan = (store.kecamatan || store.district || '').toLowerCase();
        const manager = (store.managerName || '').toLowerCase();

        // Exact code match
        if (code === q || codeClean === qClean) {
          score += 1000;
        } else if (code.startsWith(q) || codeClean.startsWith(qClean)) {
          score += 500;
        } else if (code.includes(q) || codeClean.includes(qClean)) {
          score += 200;
        }

        // Name matches
        if (name === q) {
          score += 800;
        } else if (name.startsWith(q)) {
          score += 400;
        } else if (name.includes(q)) {
          score += 150;
        }

        // Multi-word token matching in name
        const tokens = q.split(/\s+/);
        if (tokens.length > 1) {
          const allTokensMatch = tokens.every(tok => 
            name.includes(tok) || code.includes(tok) || region.includes(tok) || kabupaten.includes(tok) || kecamatan.includes(tok)
          );
          if (allTokensMatch) score += 250;
        }

        // Region, Kabupaten & Kecamatan matches
        if (region.includes(q) || kabupaten.includes(q) || city.includes(q) || kecamatan.includes(q)) {
          score += 100;
        }

        // Manager match
        if (manager.includes(q)) {
          score += 50;
        }
      } else {
        score = 100; // Base score when not searching
      }

      return { store, score, distance: dist };
    });

    if (q) {
      return storeItems
        .filter(item => item.score > 0)
        .sort((a, b) => {
          if (sortByDistance && a.distance !== null && b.distance !== null) {
            return a.distance - b.distance;
          }
          return b.score - a.score;
        })
        .map(item => ({ store: item.store, distance: item.distance }))
        .slice(0, 150);
    }

    if (sortByDistance && referenceStore) {
      return storeItems
        .sort((a, b) => {
          if (a.distance === null && b.distance === null) return 0;
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return a.distance - b.distance;
        })
        .map(item => ({ store: item.store, distance: item.distance }))
        .slice(0, 100);
    }

    // Default sorting when filter is active: alphabetical by store name or code
    return storeItems
      .sort((a, b) => a.store.name.localeCompare(b.store.name))
      .slice(0, 100)
      .map(item => ({ store: item.store, distance: item.distance }));
  }, [stores, searchQuery, referenceStore, sortByDistance, activeKabupaten, activeKecamatan]);

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
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredStores.length - 1 ? prev + 1 : prev));
      scrollHighlightedIntoView(highlightedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
      scrollHighlightedIntoView(highlightedIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredStores[highlightedIndex]) {
        handleSelect(filteredStores[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const scrollHighlightedIntoView = (index: number) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-store-item]');
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  };

  const handleSelect = (store: Store) => {
    onSelectStore(store);
    setIsOpen(false);
    setSearchQuery('');
  };

  // Helper to highlight matching text
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
        <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            {label} {required && <span className="text-rose-500">*</span>}
          </span>
          <span className="text-[10px] text-slate-400 font-normal">
            ({stores.length} Master Toko)
          </span>
        </label>
      )}

      {/* Reference Store Indicator Banner if provided */}
      {referenceStore && (
        <div className="mb-1.5 p-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <Compass className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-[11px] font-bold text-slate-700 shrink-0">{referenceStoreLabel}:</span>
            <span className="font-mono font-bold text-indigo-900 bg-white px-1.5 py-0.5 rounded border border-indigo-200 text-[11px]">
              [{referenceStore.code}]
            </span>
            <span className="font-bold text-slate-800 truncate text-[11px]">{referenceStore.name}</span>
          </div>
          {onClearReferenceStore && (
            <button
              type="button"
              onClick={onClearReferenceStore}
              className="text-[10px] text-slate-400 hover:text-slate-700 p-0.5"
              title="Hapus acuan jarak"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Main Trigger Box */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        className={`w-full min-h-[42px] bg-slate-50 border rounded-xl p-2 sm:px-3 text-xs flex items-center justify-between gap-2 cursor-pointer transition select-none shadow-2xs ${
          disabled 
            ? 'opacity-60 cursor-not-allowed bg-slate-100 border-slate-200' 
            : isOpen 
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white' 
            : 'border-slate-300 hover:border-indigo-300 hover:bg-white'
        }`}
      >
        {selectedStore ? (
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <span className="shrink-0 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-mono font-bold text-[11px] border border-indigo-200">
              [{selectedStore.code}]
            </span>
            <span className="font-extrabold text-slate-900 truncate">
              {selectedStore.name}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
              <MapPin className="w-2.5 h-2.5 text-slate-400" />
              {selectedStore.region || selectedStore.kabupaten || selectedStore.city || 'Bali'}
            </span>
            {selectedStoreDistance !== null && (
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 border ${
                selectedStoreDistance === 0
                  ? 'bg-slate-100 text-slate-700 border-slate-300'
                  : selectedStoreDistance <= 10
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : selectedStoreDistance <= 25
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-rose-100 text-rose-800 border-rose-300'
              }`}>
                <Navigation className="w-2.5 h-2.5" />
                {selectedStoreDistance === 0 ? 'Titik Awal (0 km)' : `${selectedStoreDistance} km`}
              </span>
            )}
            {selectedStore.riskLevel && (
              <span className={`hidden md:inline-block text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                selectedStore.riskLevel === 'HIGH' ? 'bg-rose-100 text-rose-700' :
                selectedStore.riskLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {selectedStore.riskLevel}
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
          {referenceStore && (
            <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200 hidden sm:inline-block">
              Auto Jarak GPS
            </span>
          )}
          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold border border-slate-200 hidden sm:inline-block">
            Cari
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
                placeholder="Ketik kode (F010), nama toko (SILIGITA), atau wilayah (BADUNG)..."
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
            {referenceStore && (
              <button
                type="button"
                onClick={() => setSortByDistance(!sortByDistance)}
                className={`shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg border transition ${
                  sortByDistance 
                    ? 'bg-emerald-500 text-white border-emerald-400' 
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="Urutkan dari jarak terdekat"
              >
                <Compass className="w-3 h-3" />
                <span>{sortByDistance ? 'Terdekat ✓' : 'Urut Jarak'}</span>
              </button>
            )}
            <div className="shrink-0 flex items-center gap-1 text-[10px] text-indigo-300 font-bold bg-indigo-950/80 px-2 py-1.5 rounded-lg border border-indigo-800/60 hidden sm:flex">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Smart Search</span>
            </div>
          </div>

          {/* Quick Filter Bar: Kabupaten & Kecamatan */}
          {showFilters && (
            <div className="p-2 bg-slate-100/90 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Kabupaten Dropdown */}
              <div className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-xl border border-slate-200 text-xs shadow-xs">
                <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="text-[10px] font-bold text-slate-500 shrink-0">Kab:</span>
                <select
                  value={activeKabupaten}
                  onChange={(e) => handleKabupatenChange(e.target.value)}
                  className="w-full bg-transparent text-slate-800 font-bold text-xs focus:outline-none cursor-pointer truncate"
                >
                  <option value="ALL">Semua Kabupaten ({kabupatenList.length})</option>
                  {kabupatenList.map(kab => (
                    <option key={kab} value={kab}>{kab}</option>
                  ))}
                </select>
              </div>

              {/* Kecamatan Dropdown */}
              <div className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-xl border border-slate-200 text-xs shadow-xs">
                <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="text-[10px] font-bold text-slate-500 shrink-0">Kec:</span>
                <select
                  value={activeKecamatan}
                  onChange={(e) => handleKecamatanChange(e.target.value)}
                  disabled={availableKecamatans.length === 0}
                  className="w-full bg-transparent text-slate-800 font-bold text-xs focus:outline-none cursor-pointer truncate disabled:text-slate-400"
                >
                  <option value="ALL">
                    {activeKabupaten === 'ALL' ? 'Semua Kecamatan' : `Semua Kec. di ${activeKabupaten}`} ({availableKecamatans.length})
                  </option>
                  {availableKecamatans.map(kec => (
                    <option key={kec} value={kec}>{kec}</option>
                  ))}
                </select>
                {(activeKabupaten !== 'ALL' || activeKecamatan !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      handleKabupatenChange('ALL');
                      handleKecamatanChange('ALL');
                    }}
                    className="text-[10px] text-rose-500 hover:text-rose-700 font-bold shrink-0 ml-1 px-1 py-0.5 rounded bg-rose-50 hover:bg-rose-100"
                    title="Reset Filter"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick Suggestion Info */}
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              {searchQuery.trim() ? (
                <>Ditemukan <strong>{filteredStores.length}</strong> toko cocok</>
              ) : (
                <>Menampilkan <strong>{filteredStores.length}</strong> toko {activeKabupaten !== 'ALL' ? `(${activeKabupaten}${activeKecamatan !== 'ALL' ? ` • ${activeKecamatan}` : ''})` : ''}</>
              )}
              {referenceStore && (
                <span className="text-indigo-600 font-semibold ml-1.5">
                  (Acuan: [{referenceStore.code}] {referenceStore.name})
                </span>
              )}
            </span>
            <span className="text-[10px] text-slate-400">Gunakan ↑↓ & Enter</span>
          </div>

          {/* Store List */}
          <div 
            ref={listRef}
            className="max-h-64 overflow-y-auto divide-y divide-slate-100"
          >
            {filteredStores.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
                <p className="text-xs font-semibold text-slate-600">Tidak ada toko yang cocok</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Coba cari dengan kode lain seperti "F...", nama cabang, atau nama kabupaten</p>
              </div>
            ) : (
              filteredStores.map(({ store, distance }, index) => {
                const isSelected = selectedStoreId === store.id;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={store.id}
                    data-store-item
                    onClick={() => handleSelect(store)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`p-2.5 px-3 flex items-center justify-between cursor-pointer transition select-none ${
                      isSelected 
                        ? 'bg-indigo-50/90 text-indigo-950 font-bold' 
                        : isHighlighted 
                        ? 'bg-slate-100/90' 
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                      {/* Code Badge */}
                      <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-mono font-bold text-[11px]">
                        [{highlightMatch(store.code, searchQuery)}]
                      </span>

                      {/* Store Name & Meta */}
                      <div className="truncate">
                        <div className="text-xs text-slate-900 font-bold truncate flex items-center gap-1.5">
                          <span>{highlightMatch(store.name, searchQuery)}</span>
                          {store.storeType && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-normal border border-slate-200">
                              {store.storeType}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5 text-slate-400" />
                            {highlightMatch(store.region || store.kabupaten || store.city || 'Bali', searchQuery)}
                          </span>
                          {store.assignedOfficerName && (
                            <span className="text-slate-400 truncate">
                              • Korlap: {store.assignedOfficerName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side: Distance Badge & Check */}
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {distance !== null && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                          distance === 0
                            ? 'bg-slate-100 text-slate-700 border-slate-300'
                            : distance <= 10
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : distance <= 25
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-rose-100 text-rose-800 border-rose-300'
                        }`}>
                          <Navigation className="w-2.5 h-2.5" />
                          {distance === 0 ? 'Acuan (0km)' : `${distance} km`}
                        </span>
                      )}
                      {store.riskLevel && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                          store.riskLevel === 'HIGH' ? 'bg-rose-100 text-rose-700' :
                          store.riskLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {store.riskLevel}
                        </span>
                      )}
                      {isSelected ? (
                        <span className="p-1 rounded-full bg-indigo-600 text-white">
                          <Check className="w-3 h-3" />
                        </span>
                      ) : (
                        <span className="w-4" />
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

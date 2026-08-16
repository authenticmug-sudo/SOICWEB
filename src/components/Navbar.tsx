import React, { useState } from 'react';
import { 
  Building2, 
  Search, 
  RotateCcw, 
  Download, 
  Bell, 
  UserCheck, 
  CalendarDays,
  ChevronDown,
  Menu,
  X,
  Filter,
  Lock,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { Store, UserRole } from '../types/stockOpname';
import { exportToCSV } from '../services/storageService';
import { ROLE_CONFIGS } from './Role/RoleAuthModal';

interface NavbarProps {
  stores: Store[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onResetData: (options?: { forceWipeCloudinary?: boolean }) => void;
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  selectedYear: string;
  setSelectedYear: (y: string) => void;
  selectedDate?: string;
  setSelectedDate?: (d: string) => void;
  pendingApprovalCount: number;
  currentRole: UserRole;
  onRoleChangeRequest: (role: UserRole) => void;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  stores,
  searchQuery,
  setSearchQuery,
  onResetData,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  selectedDate = 'ALL',
  setSelectedDate,
  pendingApprovalCount,
  currentRole,
  onRoleChangeRequest,
  isMobileMenuOpen,
  onToggleMobileMenu
}) => {
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  // Password-protected Reset State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const handleExportAllStores = () => {
    const exportData = stores.map(s => ({
      'Kode Toko': s.code,
      'Nama Toko': s.name,
      'Wilayah/Area': s.region,
      'Kota': s.city,
      'Tipe Toko': s.storeType,
      'Kepala Toko': s.managerName,
      'No Telp': s.phone,
      'Tingkat Risiko': s.riskLevel,
      'Total SKU': s.totalSKUCount,
      'Akurasi Last SO (%)': s.lastAccuracyRate || '-',
      'Tanggal SO Terakhir': s.lastSODate || '-'
    }));
    exportToCSV('Master_Data_700Toko.csv', exportData);
  };

  const handleConfirmReset = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (resetPasswordInput !== '020594') {
      setResetError('❌ Password Reset Salah! Gunakan password Super Admin: 020594');
      return;
    }

    if (resetConfirmText.trim().toLowerCase() !== 'ya') {
      setResetError('❌ Mohon ketik kata "ya" untuk mengonfirmasi penghapusan permanen!');
      return;
    }

    onResetData({ forceWipeCloudinary: true });
    setResetSuccess('✅ Semua master data di LocalStorage, Firebase, & Cloudinary BERHASIL dibersihkan hingga 0!');
    setTimeout(() => {
      setIsResetModalOpen(false);
      setResetPasswordInput('');
      setResetConfirmText('');
      setResetSuccess('');
    }, 1500);
  };

  const currentRoleConfig = ROLE_CONFIGS[currentRole];

  // Dynamic Profile Badge by Current Role
  const getRoleProfile = (role: UserRole) => {
    switch (role) {
      case 'SUPERVISOR':
        return {
          badge: 'SPV',
          title: 'Portal Supervisor',
          subtitle: 'SPV IC In Charge',
          badgeColor: 'bg-indigo-600 border-indigo-400'
        };
      case 'OFFICER':
        return {
          badge: 'KLP',
          title: 'Portal Korlap',
          subtitle: 'Korlap IC In Charge',
          badgeColor: 'bg-emerald-600 border-emerald-400'
        };
      case 'ADMIN':
        return {
          badge: 'ADM',
          title: 'Portal Admin',
          subtitle: 'Admin IC In Charge',
          badgeColor: 'bg-amber-600 border-amber-400'
        };
      default:
        return {
          badge: 'SA',
          title: 'Super Admin',
          subtitle: 'Full System Access',
          badgeColor: 'bg-slate-900 border-slate-700'
        };
    }
  };

  const roleProfile = getRoleProfile(currentRole);

  return (
    <header className="w-full max-w-full overflow-x-hidden bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs px-2 sm:px-6 select-none">
      <div className="h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-3">
      
      {/* Title & Hamburger 3-Line Menu Toggle for Mobile, Tablet & Landscape phones */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink min-w-0">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            aria-label="Toggle Mobile Menu Navigation"
            className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 hover:from-slate-800 hover:to-indigo-900 active:scale-90 text-white rounded-xl shadow-md shadow-indigo-950/20 transition-all shrink-0 border border-indigo-500/30 group"
            title="Menu Navigasi (Slide Bar)"
          >
            {isMobileMenuOpen ? (
              <X className="w-4 h-4 text-rose-400 group-hover:rotate-90 transition-transform duration-200" />
            ) : (
              <div className="relative">
                <Menu className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                {pendingApprovalCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-900 animate-pulse" />
                )}
              </div>
            )}
            <span className="text-xs font-black tracking-wide text-indigo-100 hidden xs:inline">Menu</span>
          </button>
        )}

        <div className="leading-tight shrink min-w-0">
          <h1 className="font-black text-xs sm:text-base text-slate-900 tracking-tight flex items-center gap-1.5 truncate">
            <span className="hidden sm:inline">SO IC Bali Web — Store Scheduling & Audit Portal</span>
            <span className="sm:hidden font-extrabold text-xs text-indigo-950 truncate max-w-[110px] xs:max-w-[150px]">SO IC Bali</span>
          </h1>
          <p className="text-[10px] text-slate-500 font-bold sm:flex items-center gap-1.5 hidden">
            <span>Created by <strong className="text-slate-800">Gean Pratama</strong></span>
            <span className="text-slate-300">•</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>{stores.length} Toko Ritel Bali</span>
          </p>
          <p className="text-[9px] text-slate-500 font-bold sm:hidden flex items-center gap-1 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            <span className="truncate">Gean Pratama</span>
          </p>
        </div>

        <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-100">
          <Building2 className="w-3.5 h-3.5 text-indigo-600" />
          {stores.length} Stores Database
        </span>
      </div>

      {/* Quick Search Input & Filter Actions */}
      <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
        
        {/* Mobile Search Toggle Button */}
        <button
          onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
          className="md:hidden p-1.5 sm:p-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition shrink-0"
          title="Cari Toko / Wilayah"
        >
          <Search className="w-4 h-4 text-indigo-600" />
        </button>

        {/* Desktop Search Input */}
        <div className="relative hidden md:block">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search store ID or region..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-xs border border-slate-300 rounded-xl px-3 py-1.5 pl-8 w-36 lg:w-56 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Selected Month & Year & Date Period Filters */}
        <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-50 border border-slate-300 rounded-xl px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs text-slate-700 shadow-2xs shrink-0">
          <CalendarDays className="w-3.5 h-3.5 text-indigo-600 hidden sm:inline" />
          
          {/* Specific Date Filter if selected or picker */}
          {setSelectedDate && (
            <div className="hidden lg:flex items-center gap-1 border-r border-slate-200 pr-1.5 mr-1">
              <input
                type="date"
                value={selectedDate === 'ALL' ? '' : selectedDate}
                title="Filter Tgl Spesifik"
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                  } else {
                    setSelectedDate('ALL');
                  }
                }}
                className="bg-white border border-slate-200 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-slate-800 focus:outline-none cursor-pointer"
              />
              {selectedDate !== 'ALL' && (
                <button
                  onClick={() => setSelectedDate('ALL')}
                  title="Reset Filter Tanggal"
                  className="text-[10px] bg-indigo-100 hover:bg-indigo-200 text-indigo-800 px-1 rounded font-bold"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent text-slate-900 font-extrabold focus:outline-none cursor-pointer text-[11px] sm:text-xs"
          >
            <option value="ALL">Semua</option>
            <option value="01">Jan</option>
            <option value="02">Feb</option>
            <option value="03">Mar</option>
            <option value="04">Apr</option>
            <option value="05">Mei</option>
            <option value="06">Jun</option>
            <option value="07">Jul</option>
            <option value="08">Agu</option>
            <option value="09">Sep</option>
            <option value="10">Okt</option>
            <option value="11">Nov</option>
            <option value="12">Des</option>
          </select>

          <span className="text-slate-300 font-black">/</span>

          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-transparent text-slate-900 font-extrabold focus:outline-none cursor-pointer text-[11px] sm:text-xs"
          >
            <option value="ALL">Thn</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
            <option value="2028">2028</option>
          </select>
        </div>

        {/* Role Access Selector Dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 bg-slate-900 text-white rounded-xl border border-slate-700 hover:bg-slate-800 transition text-[11px] sm:text-xs font-bold shadow-xs active:scale-95"
          >
            <span className="text-xs sm:text-sm">{currentRoleConfig.icon}</span>
            <span className="hidden sm:inline font-extrabold">{currentRoleConfig.name}</span>
            <span className="sm:hidden font-extrabold text-[10px] bg-indigo-500/30 text-indigo-200 px-1 rounded border border-indigo-400/30">
              {roleProfile.badge}
            </span>
            <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400" />
          </button>

          {isRoleDropdownOpen && (
            <div 
              className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 py-1.5 z-50 animate-in fade-in duration-150"
              onMouseLeave={() => setIsRoleDropdownOpen(false)}
            >
              <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                Pilih Portal Akses (PIN Protected)
              </div>

              {(Object.keys(ROLE_CONFIGS) as UserRole[]).map((rKey) => {
                const cfg = ROLE_CONFIGS[rKey];
                const isSelected = currentRole === rKey;
                return (
                  <button
                    key={rKey}
                    onClick={() => {
                      setIsRoleDropdownOpen(false);
                      onRoleChangeRequest(rKey);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-50 transition text-xs ${
                      isSelected ? 'bg-indigo-50/80 font-black text-indigo-700 border-l-4 border-indigo-600' : 'text-slate-700 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg p-1 bg-slate-100 rounded-lg">{cfg.icon}</span>
                      <div>
                        <p className="font-extrabold">{cfg.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">PIN Default: {cfg.defaultPin}</p>
                      </div>
                    </div>
                    {isSelected && <span className="text-indigo-600 font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending Approvals Notification */}
        <div className="relative">
          <button 
            title="Approval Pending"
            className="p-1.5 sm:p-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition shadow-2xs"
          >
            <Bell className="w-4 h-4 text-slate-700" />
            {pendingApprovalCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse shadow-xs">
                {pendingApprovalCount}
              </span>
            )}
          </button>
        </div>

        {/* Quick Export Master CSV */}
        <button
          onClick={handleExportAllStores}
          title="Export Master Data CSV"
          className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition shadow-2xs active:scale-95"
        >
          <Download className="w-3.5 h-3.5 text-indigo-600" />
          <span>Export CSV</span>
        </button>

        {/* Reset Data Master (Super Admin Only: ALL, PIN Password Protected: 020594) */}
        {currentRole === 'ALL' && (
          <button
            onClick={() => {
              setIsResetModalOpen(true);
              setResetError('');
              setResetSuccess('');
              setResetPasswordInput('');
            }}
            title="Reset Master Data (Super Admin Only)"
            className="p-1.5 sm:p-2 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-600 transition shadow-2xs active:scale-95 flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Dynamic Profile Badge by Active Role */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className={`w-8 h-8 rounded-xl ${roleProfile.badgeColor} text-white font-black text-xs flex items-center justify-center shadow-xs border`}>
            {roleProfile.badge}
          </div>
          <div className="hidden lg:block text-left leading-tight">
            <p className="text-xs font-black text-slate-800 flex items-center gap-1">
              {roleProfile.title}
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            </p>
            <p className="text-[10px] text-slate-500 font-bold">{roleProfile.subtitle}</p>
          </div>
        </div>

      </div>
      </div>

      {/* Expandable Mobile Search Bar */}
      {isMobileSearchOpen && (
        <div className="absolute top-full left-0 right-0 p-2 bg-white border-b border-slate-200 shadow-md md:hidden z-30 animate-in slide-in-from-top-2 duration-150">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3 text-slate-400" />
            <input
              type="text"
              placeholder="Cari ID Toko, Nama, atau Wilayah..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 pl-9 bg-slate-50 text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-xs text-slate-400 font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Password Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">Otorisasi Reset Master Data</h3>
                  <p className="text-xs text-slate-400 font-medium">Password Diperlukan (Security Protocol)</p>
                </div>
              </div>
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleConfirmReset} className="p-6 space-y-4">
              
              <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-950 leading-relaxed font-medium">
                  <strong>Peringatan Super Admin Reset:</strong> Tindakan ini akan menghapus SELURUH data master (toko, jadwal, personil, alat, seragam, hasil) secara permanen di <strong>LocalStorage, Firebase, dan Cloudinary Storage</strong> hingga bersih 0.
                </p>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                  1. Password Super Admin (020594):
                </label>
                <input
                  type="password"
                  placeholder="Password: 020594"
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-mono font-bold tracking-widest focus:outline-none focus:border-rose-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                  2. Ketik kata "ya" untuk konfirmasi:
                </label>
                <input
                  type="text"
                  placeholder='Ketik "ya"'
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:border-rose-500 focus:bg-white transition"
                />
              </div>

              {resetError && (
                <div className="p-3 bg-rose-100 text-rose-800 rounded-xl text-xs font-bold border border-rose-300">
                  {resetError}
                </div>
              )}

              {resetSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Hapus & Bersihkan Seluruh Data</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}
    </header>
  );
};



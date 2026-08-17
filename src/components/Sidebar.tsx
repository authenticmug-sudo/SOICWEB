import React from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  ClipboardCheck, 
  Store as StoreIcon, 
  Users, 
  Wrench,
  BarChart3, 
  SlidersHorizontal,
  PlusCircle,
  FileSpreadsheet,
  MapPin,
  ShieldCheck,
  Lock,
  ChevronRight,
  HeartPulse,
  X,
  Sparkles,
  ExternalLink,
  Shirt,
  Database,
  PhoneCall,
  CheckSquare
} from 'lucide-react';
import { UserRole } from '../types/stockOpname';
import { ROLE_CONFIGS } from './Role/RoleAuthModal';

export type ActiveTab = 
  | 'dashboard' 
  | 'schedules' 
  | 'map' 
  | 'results' 
  | 'stores' 
  | 'master_toko_files' 
  | 'checklist_toko_zona'
  | 'teams' 
  | 'oncall_personnel'
  | 'equipment' 
  | 'leave_recap' 
  | 'uniform_tracking' 
  | 'admin_rekap_so'
  | 'company_portals' 
  | 'reports' 
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentRole: UserRole;
  onRoleChangeRequest: (role: UserRole) => void;
  pendingApprovalCount: number;
  storesCount: number;
  scheduledCount: number;
  datasetsCount?: number;
  onOpenNewScheduleModal: () => void;
  onOpenNewResultModal: () => void;
  onResetData?: () => void;
  onExportMasterCSV?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentRole,
  onRoleChangeRequest,
  pendingApprovalCount,
  storesCount,
  scheduledCount,
  datasetsCount = 0,
  onOpenNewScheduleModal,
  onOpenNewResultModal,
  onResetData,
  onExportMasterCSV,
  isMobileOpen,
  onCloseMobile
}) => {
  const currentRoleConfig = ROLE_CONFIGS[currentRole];

  // Helper to check if tab is permitted under current active role
  const isTabAllowed = (tab: ActiveTab): boolean => {
    if (currentRole === 'ALL') return true;
    if (tab === 'dashboard' || tab === 'map' || tab === 'company_portals') return true; // General to everyone
    if (tab === 'settings') {
      // Only SPV and Super Admin (ALL) can access Pengaturan & Utilities
      return currentRole === 'SUPERVISOR';
    }
    if (currentRole === 'SUPERVISOR' && (tab === 'schedules' || tab === 'stores' || tab === 'master_toko_files' || tab === 'checklist_toko_zona' || tab === 'oncall_personnel' || tab === 'admin_rekap_so')) return true;
    if (currentRole === 'OFFICER' && (tab === 'schedules' || tab === 'results' || tab === 'teams' || tab === 'oncall_personnel' || tab === 'equipment')) return true;
    if (currentRole === 'ADMIN' && (tab === 'teams' || tab === 'equipment' || tab === 'leave_recap' || tab === 'uniform_tracking' || tab === 'admin_rekap_so' || tab === 'oncall_personnel' || tab === 'reports')) return true;
    return false;
  };

  const handleTabClick = (tabId: ActiveTab, requiredRole: UserRole) => {
    if (currentRole !== 'ALL' && currentRole !== requiredRole) {
      onRoleChangeRequest(requiredRole);
    }
    setActiveTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  const handleGeneralTabClick = (tabId: ActiveTab) => {
    setActiveTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarContent = (
    <div className="w-full h-full bg-slate-900 text-slate-300 flex flex-col justify-between p-3.5 sm:p-4 overflow-y-auto custom-scrollbar select-none">
      <div className="space-y-4">
        
        {/* Brand / Logo Header */}
        <div className="p-2.5 flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 rounded-xl flex items-center justify-center font-black text-white text-base shadow-md shadow-indigo-900/40 border border-indigo-400/30">
              SO
            </div>
            <div className="leading-tight">
              <span className="block font-black text-white text-sm tracking-tight flex items-center gap-1.5">
                SO IC Bali Web
                <span className="bg-indigo-500/20 text-indigo-300 text-[9px] px-1.5 py-0.2 rounded border border-indigo-400/30">v2.5</span>
              </span>
              <span className="text-[10px] text-indigo-300/90 font-bold block">Supervisor & IC Audit System</span>
              <span className="text-[9px] text-slate-400 font-medium block">Created by Gean Pratama</span>
            </div>
          </div>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl transition border border-slate-700 active:scale-95"
              title="Tutup Panel Menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Account Profile & Role Switcher Section */}
        <div className="p-3 bg-gradient-to-b from-slate-800/90 to-slate-850/90 rounded-2xl border border-slate-700/80 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1 text-slate-300">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              Portal & User Account
            </span>
            <span className="text-indigo-400 flex items-center gap-1 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/60 font-mono">
              <ShieldCheck className="w-3 h-3 text-indigo-400" />
              PIN Lock
            </span>
          </div>

          <div className="p-2 bg-slate-900/90 rounded-xl border border-slate-700/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center border border-indigo-400/40">
                GP
              </div>
              <div className="leading-tight">
                <span className="block text-xs font-black text-white">Gean Pratama</span>
                <span className="text-[10px] text-indigo-300 font-extrabold flex items-center gap-1">
                  <span>{currentRoleConfig.icon}</span>
                  <span>{currentRoleConfig.name}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Role Portal Switch Grid - Simplified */}
          <div className="pt-1">
            <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Ganti Portal Akses:</span>
              <span className="text-emerald-400 font-mono text-[9px]">
                {currentRole === 'ALL' ? 'Super Admin' : currentRole === 'SUPERVISOR' ? 'SPV' : currentRole === 'OFFICER' ? 'Korlap' : 'Admin'}
              </span>
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onRoleChangeRequest('ALL');
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`px-2.5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition border ${
                  currentRole === 'ALL'
                    ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                    : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700/80'
                }`}
              >
                <span>👑</span>
                <span>Super Admin</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onRoleChangeRequest('SUPERVISOR');
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`px-2.5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition border ${
                  currentRole === 'SUPERVISOR'
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                    : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700/80'
                }`}
              >
                <span>👔</span>
                <span>SPV</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onRoleChangeRequest('OFFICER');
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`px-2.5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition border ${
                  currentRole === 'OFFICER'
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                    : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700/80'
                }`}
              >
                <span>📱</span>
                <span>Korlap</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onRoleChangeRequest('ADMIN');
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`px-2.5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition border ${
                  currentRole === 'ADMIN'
                    ? 'bg-amber-600 text-white border-amber-400 shadow-sm'
                    : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700/80'
                }`}
              >
                <span>⚙️</span>
                <span>Admin</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Action SPV Box */}
        <div className="p-3 bg-slate-800/40 rounded-2xl border border-slate-800/80 space-y-2">
          <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center justify-between">
            <span>Aksi Cepat Menu</span>
            <span className="text-[9px] text-indigo-400 font-mono">Quick App</span>
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            <button
              onClick={() => {
                onOpenNewScheduleModal();
                if (onCloseMobile) onCloseMobile();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Buat Jadwal SO Baru</span>
            </button>

            <button
              onClick={() => {
                onOpenNewResultModal();
                if (onCloseMobile) onCloseMobile();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition active:scale-[0.98]"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Input Rekapan Hasil</span>
            </button>
          </div>
        </div>

        {/* Menu Navigation organized into 3 main role pillars + General */}
        <nav className="space-y-3.5">
          
          {/* 1. GENERAL MENUS (Publik) */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-black px-2 py-1 flex items-center gap-1.5">
              <span>🌐</span> DASHBOARD & PETA
            </div>
            <div className="space-y-1 mt-1">
              <button
                onClick={() => handleGeneralTabClick('dashboard')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-600 text-white font-black shadow-md shadow-indigo-900/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutDashboard className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-white' : 'text-indigo-400'}`} />
                  <span>Dashboard Overview</span>
                </div>
              </button>

              <button
                onClick={() => handleGeneralTabClick('map')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition ${
                  activeTab === 'map'
                    ? 'bg-emerald-600 text-white font-black shadow-md shadow-emerald-900/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <MapPin className={`w-4 h-4 ${activeTab === 'map' ? 'text-white' : 'text-emerald-400'}`} />
                  <span>Peta & Kluster Bali</span>
                </div>
                <span className="px-1.5 py-0.5 text-[9px] rounded-md bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30">
                  GIS Map
                </span>
              </button>
            </div>
          </div>

          {/* 2. SUPERVISOR PORTAL */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="text-[10px] uppercase tracking-wider text-indigo-400 font-black px-2 py-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">👔 PORTAL SUPERVISOR</span>
              {currentRole !== 'ALL' && currentRole !== 'SUPERVISOR' && (
                <Lock className="w-3.5 h-3.5 text-slate-500" />
              )}
            </div>

            <div className="space-y-1 mt-1">
              <button
                onClick={() => handleTabClick('schedules', 'SUPERVISOR')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition ${
                  activeTab === 'schedules'
                    ? 'bg-indigo-600 text-white font-black shadow-md shadow-indigo-900/30'
                    : !isTabAllowed('schedules')
                    ? 'text-slate-400 opacity-75 hover:bg-slate-800/60'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Calendar className={`w-4 h-4 ${activeTab === 'schedules' ? 'text-white' : 'text-indigo-400'}`} />
                  <span>Penjadwalan SO</span>
                </div>
                {scheduledCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[9px] rounded-md bg-indigo-500/20 text-indigo-300 font-extrabold border border-indigo-500/30">
                    {scheduledCount} SO
                  </span>
                )}
              </button>

              <button
                onClick={() => handleTabClick('master_toko_files', 'SUPERVISOR')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition ${
                  activeTab === 'master_toko_files'
                    ? 'bg-indigo-600 text-white font-black shadow-md shadow-indigo-900/30'
                    : !isTabAllowed('master_toko_files')
                    ? 'text-slate-400 opacity-75 hover:bg-slate-800/60'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Database className={`w-4 h-4 ${activeTab === 'master_toko_files' ? 'text-white' : 'text-indigo-400'}`} />
                  <span>Data Master Toko</span>
                </div>
                <span className="px-1.5 py-0.5 text-[9px] rounded-md bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                  {datasetsCount > 0 ? `${datasetsCount} File` : 'Upload'}
                </span>
              </button>

              <button
                onClick={() => handleTabClick('stores', 'SUPERVISOR')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition ${
                  activeTab === 'stores'
                    ? 'bg-indigo-600 text-white font-black shadow-md shadow-indigo-900/30'
                    : !isTabAllowed('stores')
                    ? 'text-slate-400 opacity-75 hover:bg-slate-800/60'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <StoreIcon className={`w-4 h-4 ${activeTab === 'stores' ? 'text-white' : 'text-indigo-400'}`} />
                  <span>Master Toko (700+)</span>
                </div>
                <span className="px-1.5 py-0.5 text-[9px] rounded-md bg-slate-800 text-slate-300 font-mono font-bold">
                  {storesCount}
                </span>
              </button>

              <button
                onClick={() => handleTabClick('checklist_toko_zona', 'SUPERVISOR')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition ${
                  activeTab === 'checklist_toko_zona'
                    ? 'bg-indigo-600 text-white font-black shadow-md shadow-indigo-900/30'
                    : !isTabAllowed('checklist_toko_zona')
                    ? 'text-slate-400 opacity-75 hover:bg-slate-800/60'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CheckSquare className={`w-4 h-4 ${activeTab === 'checklist_toko_zona' ? 'text-white' : 'text-emerald-400'}`} />
                  <span>Ceklist SO Toko Zona</span>
                </div>
                <span className="px-1.5 py-0.5 text-[9px] rounded-md bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30">
                  Ceklist
                </span>
              </button>
            </div>
          </div>

          {/* 3. KORLAP / OFFICER PORTAL */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-black px-2 py-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">📋 PORTAL KORLAP / OFFICER</span>
              {currentRole !== 'ALL' && currentRole !== 'OFFICER' && (
                <Lock className="w-3.5 h-3.5 text-slate-500" />
              )}
            </div>

            <div className="space-y-1 mt-1">
              <button
                onClick={() => handleTabClick('schedules', 'OFFICER')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition ${
                  activeTab === 'schedules' && currentRole === 'OFFICER'
                    ? 'bg-emerald-600 text-white font-black shadow-md shadow-emerald-900/30'
                    : !isTabAllowed('schedules')
                    ? 'text-slate-400 opacity-75 hover:bg-slate-800/60'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Calendar className={`w-4 h-4 ${activeTab === 'schedules' && currentRole === 'OFFICER' ? 'text-white' : 'text-emerald-400'}`} />
                  <span>Jadwal SO Hari-H Korlap</span>
                </div>
              </button>

              <button
                onClick={() => handleTabClick('results', 'OFFICER')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition ${
                  activeTab === 'results'
                    ? 'bg-emerald-600 text-white font-black shadow-md shadow-emerald-900/30'
                    : !isTabAllowed('results')
                    ? 'text-slate-400 opacity-75 hover:bg-slate-800/60'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ClipboardCheck className={`w-4 h-4 ${activeTab === 'results' ? 'text-white' : 'text-emerald-400'}`} />
                  <span>Input & Rekapan Hasil SO</span>
                </div>
                {pendingApprovalCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[9px] rounded-md bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30 animate-pulse">
                    {pendingApprovalCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => handleTabClick('teams', 'OFFICER')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition ${
                  activeTab === 'teams'
                    ? 'bg-emerald-600 text-white font-black shadow-md shadow-emerald-900/30'
                    : !isTabAllowed('teams')
                    ? 'text-slate-400 opacity-75 hover:bg-slate-800/60'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className={`w-4 h-4 ${activeTab === 'teams' ? 'text-white' : 'text-emerald-400'}`} />
                  <span>Data Tim SO & Personil</span>
                </div>
              </button>

              <button
                onClick={() => handleTabClick('oncall_personnel', 'OFFICER')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition ${
                  activeTab === 'oncall_personnel'
                    ? 'bg-emerald-600 text-white font-black shadow-md shadow-emerald-900/30'
                    : !isTabAllowed('oncall_personnel')
                    ? 'text-slate-400 opacity-75 hover:bg-slate-800/60'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <PhoneCall className={`w-4 h-4 ${activeTab === 'oncall_personnel' ? 'text-white' : 'text-emerald-400'}`} />
                  <span>List Personil On-Call</span>
                </div>
                <span className="px-1.5 py-0.5 text-[9px] rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  Standby
                </span>
              </button>

              <button
                onClick={() => handleTabClick('equipment', 'OFFICER')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition ${
                  activeTab === 'equipment' && currentRole === 'OFFICER'
                    ? 'bg-emerald-600 text-white font-black shadow-md shadow-emerald-900/30'
                    : !isTabAllowed('equipment')
                    ? 'text-slate-400 opacity-75 hover:bg-slate-800/60'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Wrench className={`w-4 h-4 ${activeTab === 'equipment' && currentRole === 'OFFICER' ? 'text-white' : 'text-emerald-400'}`} />
                  <span>Pendataan Alat & WDCP</span>
                </div>
                <span className="px-1.5 py-0.5 text-[9px] rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  MAC/QR
                </span>
              </button>

              <button
                onClick={() => handleTabClick('company_portals', 'OFFICER')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition ${
                  activeTab === 'company_portals'
                    ? 'bg-emerald-600 text-white font-black shadow-md shadow-emerald-900/30'
                    : !isTabAllowed('company_portals')
                    ? 'text-slate-400 opacity-75 hover:bg-slate-800/60'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ExternalLink className={`w-4 h-4 ${activeTab === 'company_portals' ? 'text-white' : 'text-emerald-400'}`} />
                  <span>Portal Penting Perusahaan</span>
                </div>
                <span className="px-1.5 py-0.5 text-[9px] rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  Links
                </span>
              </button>
            </div>
          </div>

          {/* 4. ADMIN PORTAL */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="text-[10px] uppercase tracking-wider text-amber-400 font-black px-2 py-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">⚙️ PORTAL ADMIN</span>
              {currentRole !== 'ALL' && currentRole !== 'ADMIN' && (
                <Lock className="w-3.5 h-3.5 text-slate-500" />
              )}
            </div>

            <div className="space-y-1 mt-1">
              <button
                onClick={() => handleTabClick('admin_rekap_so', 'ADMIN')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition ${
                  activeTab === 'admin_rekap_so'
                    ? 'bg-amber-600 text-white font-black shadow-md shadow-amber-900/30'
                    : !isTabAllowed('admin_rekap_so')
                    ? 'text-slate-400 opacity-75 hover:bg-slate-800/60'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'admin_rekap_so' ? 'text-white' : 'text-amber-400'}`} />
                  <span>Penarikan Rekap Hasil SO</span>
                </div>
                <span className="px-1.5 py-0.5 text-[9px] rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  NK/NL/Kasir
                </span>
              </button>

              <button
                onClick={() => handleTabClick('oncall_personnel', 'ADMIN')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition ${
                  activeTab === 'oncall_personnel'
                    ? 'bg-amber-600 text-white font-black shadow-md shadow-amber-900/30'
                    : !isTabAllowed('oncall_personnel')
                    ? 'text-slate-400 opacity-75 hover:bg-slate-800/60'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <PhoneCall className={`w-4 h-4 ${activeTab === 'oncall_personnel' ? 'text-white' : 'text-amber-400'}`} />
                  <span>List Personil On-Call</span>
                </div>
              </button>

              <button
                onClick={() => handleTabClick('equipment', 'ADMIN')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition ${
                  activeTab === 'equipment'
                    ? 'bg-amber-600 text-white font-black shadow-md shadow-amber-900/30'
                    : !isTabAllowed('equipment')
                    ? 'text-slate-400 opacity-75 hover:bg-slate-800/60'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Wrench className={`w-4 h-4 ${activeTab === 'equipment' ? 'text-white' : 'text-amber-400'}`} />
                  <span>Tracking Peralatan SO</span>
                </div>
              </button>

              <button
                onClick={() => handleTabClick('leave_recap', 'ADMIN')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition ${
                  activeTab === 'leave_recap'
                    ? 'bg-amber-600 text-white font-black shadow-md shadow-amber-900/30'
                    : !isTabAllowed('leave_recap')
                    ? 'text-slate-400 opacity-75 hover:bg-slate-800/60'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <HeartPulse className={`w-4 h-4 ${activeTab === 'leave_recap' ? 'text-white' : 'text-rose-400'}`} />
                  <span>Rekapan Sakit & Cuti SDM</span>
                </div>
              </button>

              <button
                onClick={() => handleTabClick('uniform_tracking', 'ADMIN')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition ${
                  activeTab === 'uniform_tracking'
                    ? 'bg-amber-600 text-white font-black shadow-md shadow-amber-900/30'
                    : !isTabAllowed('uniform_tracking')
                    ? 'text-slate-400 opacity-75 hover:bg-slate-800/60'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Shirt className={`w-4 h-4 ${activeTab === 'uniform_tracking' ? 'text-white' : 'text-amber-400'}`} />
                  <span>Tracking Seragam SDM</span>
                </div>
                <span className="px-1.5 py-0.5 text-[9px] rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Baru & Lama
                </span>
              </button>

              <button
                onClick={() => handleTabClick('reports', 'ADMIN')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition ${
                  activeTab === 'reports'
                    ? 'bg-amber-600 text-white font-black shadow-md shadow-amber-900/30'
                    : !isTabAllowed('reports')
                    ? 'text-slate-400 opacity-75 hover:bg-slate-800/60'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <BarChart3 className={`w-4 h-4 ${activeTab === 'reports' ? 'text-white' : 'text-amber-400'}`} />
                  <span>Laporan & Analytics</span>
                </div>
              </button>

              <button
                onClick={() => handleTabClick('settings', 'ADMIN')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition ${
                  activeTab === 'settings'
                    ? 'bg-amber-600 text-white font-black shadow-md shadow-amber-900/30'
                    : !isTabAllowed('settings')
                    ? 'text-slate-400 opacity-75 hover:bg-slate-800/60'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <SlidersHorizontal className={`w-4 h-4 ${activeTab === 'settings' ? 'text-white' : 'text-amber-400'}`} />
                  <span>Pengaturan & Utilities</span>
                </div>
              </button>
            </div>
          </div>

        </nav>
      </div>

      {/* Footer System Status Info */}
      <div className="pt-3 border-t border-slate-800 px-2 space-y-1">
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5 font-bold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            System Online
          </span>
          <span className="font-mono text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">Vercel/GitHub</span>
        </div>
        <p className="text-[10px] text-slate-400 truncate font-bold flex items-center justify-between">
          <span>Portal Status: <span className="text-white font-black">{currentRoleConfig.name}</span></span>
        </p>
        <p className="text-[9px] text-indigo-300 font-medium pt-0.5">
          Created by <span className="font-bold text-white">Gean Pratama</span>
        </p>
      </div>

    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Pinned on large desktop screens >= 1024px) */}
      <aside className="hidden lg:flex w-64 bg-slate-900 border-r border-slate-800 shrink-0 flex-col min-h-[calc(100vh-3.5rem)] sticky top-14 z-20 shadow-sm">
        {sidebarContent}
      </aside>

      {/* Mobile / Tablet / Phone Landscape Slide Bar Drawer (Interactive slide overlay) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Glassmorphism Backdrop Overlay with click-to-close */}
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
            onClick={onCloseMobile}
          />
          {/* Slide-out Drawer Panel */}
          <div className="relative w-80 max-w-[85vw] bg-slate-900 h-full shadow-2xl z-10 flex flex-col animate-in slide-in-from-left duration-300 border-r border-slate-750">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};



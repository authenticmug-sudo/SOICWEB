import React, { useState } from 'react';
import { ShieldCheck, Lock, Key, X, Check, Eye, EyeOff, Info, AlertCircle } from 'lucide-react';
import { UserRole, RoleInfo } from '../../types/stockOpname';

export const ROLE_CONFIGS: Record<UserRole, RoleInfo> = {
  ALL: {
    id: 'ALL',
    name: 'Super Admin / Semua Menu',
    badge: 'FULL ACCESS',
    icon: '🌐',
    color: 'bg-purple-600 text-purple-100 border-purple-500',
    description: 'Akses penuh tanpa batasan ke seluruh menu Supervisor, Korlap, Admin & Publik.',
    defaultPin: '7926',
  },
  SUPERVISOR: {
    id: 'SUPERVISOR',
    name: 'Menu Supervisor',
    badge: 'SUPERVISOR PORTAL',
    icon: '👔',
    color: 'bg-indigo-600 text-indigo-100 border-indigo-500',
    description: 'Khusus fitur Supervisor: Penjadwalan SO, Master 700+ Toko, Peta & Dashboard.',
    defaultPin: '7926',
  },
  OFFICER: {
    id: 'OFFICER',
    name: 'Menu Korlap / Officer',
    badge: 'OFFICER PORTAL',
    icon: '📋',
    color: 'bg-emerald-600 text-emerald-100 border-emerald-500',
    description: 'Khusus Korlap & Officer: Jadwal SO Hari-H (Nama Korlap & Toko) & Input Hasil SO.',
    defaultPin: '8888',
  },
  ADMIN: {
    id: 'ADMIN',
    name: 'Menu Admin Management',
    badge: 'ADMIN PORTAL',
    icon: '⚙️',
    color: 'bg-amber-600 text-amber-100 border-amber-500',
    description: 'Khusus Admin: Kelola Tim SO & Auditor, Tracking Peralatan SO, Laporan & Analytics.',
    defaultPin: '8989',
  },
};

interface RoleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  targetRole: UserRole;
  onSuccess: (newRole: UserRole) => void;
}

export const RoleAuthModal: React.FC<RoleAuthModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  targetRole,
  onSuccess,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Custom passwords stored in localStorage or fallback default
  const getRolePin = (role: UserRole): string => {
    const savedPins = localStorage.getItem('spv_role_pins');
    if (savedPins) {
      try {
        const parsed = JSON.parse(savedPins);
        if (parsed[role]) return parsed[role];
      } catch {}
    }
    return ROLE_CONFIGS[role].defaultPin;
  };

  if (!isOpen) return null;

  const targetConfig = ROLE_CONFIGS[targetRole];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPin = getRolePin(targetRole);

    if (pinInput.trim() === correctPin) {
      setErrorMsg('');
      onSuccess(targetRole);
      setPinInput('');
      onClose();
    } else {
      setErrorMsg(`PIN/Password otentikasi salah! Silakan periksa kembali PIN otentikasi ${targetConfig.name}.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
        
        {/* Header */}
        <div className={`p-5 text-white flex items-center justify-between ${targetConfig.color}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shadow-xs">
              {targetConfig.icon}
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-white/20">
                {targetConfig.badge}
              </span>
              <h3 className="font-bold text-base leading-tight mt-0.5">{targetConfig.name}</h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            {targetConfig.description}
          </p>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Info className="w-4 h-4 text-indigo-600" />
              <span>Proteksi Keamanan Role:</span>
            </div>
            <p className="text-slate-500 text-[11px]">
              Silakan masukkan PIN / Password untuk mengakses <strong className="text-slate-800">{targetConfig.name}</strong>.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-slate-500" />
              Masukkan Password / PIN Access:
            </label>
            <div className="relative">
              <input
                type="password"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Masukkan Password / PIN Access"
                autoFocus
                className="w-full text-sm font-mono tracking-widest px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Buka Akses Menu</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

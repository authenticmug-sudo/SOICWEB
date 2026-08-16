import React, { useState } from 'react';
import { ShieldCheck, Lock, Key, AlertCircle, Eye, EyeOff, CheckCircle2, UserCheck, Sparkles } from 'lucide-react';
import { UserRole } from '../../types/stockOpname';
import { ROLE_CONFIGS } from './RoleAuthModal';

interface InitialRoleAuthModalProps {
  isOpen: boolean;
  onSuccess: (selectedRole: UserRole) => void;
}

export const InitialRoleAuthModal: React.FC<InitialRoleAuthModalProps> = ({
  isOpen,
  onSuccess
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('SUPERVISOR');
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const currentRoleConfig = ROLE_CONFIGS[selectedRole];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPin = currentRoleConfig.defaultPin;

    if (pinInput.trim() === correctPin) {
      setErrorMsg('');
      onSuccess(selectedRole);
    } else {
      setErrorMsg(`PIN/Password otentikasi untuk ${currentRoleConfig.name} salah! Silakan periksa kembali PIN Anda.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col my-auto">
        
        {/* Header Branding */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white text-center relative space-y-2 border-b border-indigo-500/20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-extrabold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>SO IC Bali Web Verification</span>
          </div>
          <h2 className="text-xl font-black tracking-tight text-white">
            Selamat Datang di SO IC Bali Web
          </h2>
          <p className="text-xs text-slate-300 max-w-sm mx-auto">
            Silakan pilih portal akses login Anda & masukkan PIN otentikasi keamanan
          </p>
          <div className="text-[10px] text-slate-400 font-mono pt-1">
            Created by <span className="text-white font-bold">Gean Pratama</span> | Auto-refresh 30 Menit
          </div>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          
          {/* Step 1: Select Role Portal */}
          <div className="space-y-2">
            <label className="block text-xs font-black uppercase text-slate-700 tracking-wider flex items-center justify-between">
              <span>1. Pilih Portal Akses Menu:</span>
              <span className="text-[10px] text-indigo-600 font-bold">Klik opsi di bawah</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(['ALL', 'SUPERVISOR', 'OFFICER', 'ADMIN'] as UserRole[]).map((r) => {
                const config = ROLE_CONFIGS[r];
                const isSelected = selectedRole === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setSelectedRole(r);
                      setPinInput('');
                      setErrorMsg('');
                    }}
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 relative ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/80 shadow-xs ring-2 ring-indigo-500/30'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="text-xl shrink-0 mt-0.5">{config.icon}</span>
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black truncate ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>
                          {config.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 block leading-tight">
                        {r === 'ALL' ? 'Super Admin / Akses Penuh' :
                         r === 'SUPERVISOR' ? 'Portal Head Supervisor' :
                         r === 'OFFICER' ? 'Portal Korlap / Officer' :
                         'Portal Admin Management'}
                      </span>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 absolute top-2.5 right-2.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Input PIN */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="block text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
              <Key className="w-4 h-4 text-indigo-600" />
              <span>2. Masukkan PIN Otentikasi Access:</span>
            </label>

            <div className="relative">
              <input
                type="password"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setErrorMsg('');
                }}
                placeholder={`Masukkan PIN / Password Access ${currentRoleConfig.name}`}
                autoFocus
                className="w-full text-base font-mono tracking-widest px-3.5 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 shadow-inner bg-slate-50/50"
              />
            </div>

            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <span>*PIN tersimpan di cache browser perangkat selama 30 menit.</span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2 animate-in fade-in duration-100">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md transition flex items-center justify-center gap-2 min-h-[46px] active:scale-[0.99]"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>MASUK KE PORTAL SO IC BALI WEB</span>
          </button>

        </form>

      </div>
    </div>
  );
};

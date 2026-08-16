import React from 'react';
import { AlertTriangle, Trash2, X, CheckCircle2 } from 'lucide-react';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  subtitle?: string;
  itemName?: string;
  itemDetails?: { label: string; value: string }[];
  confirmText?: string;
  cancelText?: string;
  dangerBadgeText?: string;
  isLoading?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Konfirmasi Hapus Data',
  subtitle = 'Apakah Anda yakin ingin menghapus data ini dari sistem?',
  itemName,
  itemDetails,
  confirmText = 'Ya, Hapus Data',
  cancelText = 'Batal',
  dangerBadgeText = 'Tindakan ini permanen dan tidak dapat dibatalkan.',
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-rose-50 via-slate-50 to-rose-50 p-5 border-b border-rose-100 flex items-start justify-between relative">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600 border border-rose-200 shrink-0 shadow-xs">
              <Trash2 className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                {title}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Main Item Card highlight if available */}
          {itemName && (
            <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-xl text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block mb-0.5">
                Target yang akan dihapus:
              </span>
              <p className="text-sm font-extrabold text-slate-900 break-words">
                {itemName}
              </p>
            </div>
          )}

          {/* Details list if available */}
          {itemDetails && itemDetails.length > 0 && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5 text-xs text-left">
              {itemDetails.map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-medium">{d.label}:</span>
                  <span className="font-bold text-slate-800 truncate">{d.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Warning Banner */}
          <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{dangerBadgeText}</span>
          </div>
        </div>

        {/* Modal Footer / Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-xs transition active:scale-95 disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-200 transition flex items-center gap-2 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isLoading ? 'Menghapus...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

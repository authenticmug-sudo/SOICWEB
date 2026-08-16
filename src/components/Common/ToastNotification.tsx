import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastProps {
  id?: string;
  type?: 'success' | 'error' | 'info';
  title?: string;
  message: string;
  onClose: () => void;
  duration?: number;
}

export const ToastNotification: React.FC<ToastProps> = ({
  type = 'success',
  title,
  message,
  onClose,
  duration = 4000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgStyles = {
    success: 'bg-emerald-900/95 text-white border-emerald-700 shadow-emerald-950/20',
    error: 'bg-rose-900/95 text-white border-rose-700 shadow-rose-950/20',
    info: 'bg-slate-900/95 text-white border-slate-700 shadow-slate-950/20',
  }[type];

  const icon = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
  }[type];

  return (
    <div className="fixed top-16 right-4 sm:right-6 z-[10000] max-w-sm w-full animate-in slide-in-from-top-4 fade-in duration-200">
      <div className={`p-3.5 rounded-2xl border shadow-xl backdrop-blur-md flex items-start gap-3 relative ${bgStyles}`}>
        {icon}
        <div className="flex-1 pr-2">
          {title && (
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-300">
              {title}
            </h4>
          )}
          <p className="text-xs font-semibold leading-relaxed">
            {message}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

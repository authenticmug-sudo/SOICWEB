import React from 'react';

interface RupiahInputProps {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  prefix?: string;
}

/**
  * Smart Currency/Rupiah Input component that:
  * 1. Displays blank when value is 0 (or cleared) so users don't need to backspace '0'.
  * 2. Automatically formats numbers with 3-digit thousand separators (e.g., 2.000.000).
  * 3. Handles negative numbers seamlessly (-500.000).
  */
export const RupiahInput: React.FC<RupiahInputProps> = ({
  value,
  onChange,
  placeholder = '0',
  className = '',
  disabled = false,
  prefix = 'Rp '
}) => {
  // Format numeric value for display
  const getFormattedDisplay = (val: number): string => {
    if (!val || val === 0) return '';
    if (val < 0) {
      return `-${Math.abs(val).toLocaleString('id-ID')}`;
    }
    return val.toLocaleString('id-ID');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawStr = e.target.value;
    const isNegative = rawStr.includes('-');
    const cleanDigits = rawStr.replace(/[^0-9]/g, '');

    if (!cleanDigits) {
      onChange(0);
      return;
    }

    const parsed = parseInt(cleanDigits, 10);
    onChange(isNegative ? -parsed : parsed);
  };

  return (
    <div className="relative flex items-center w-full">
      {prefix && (
        <span className="absolute left-3 text-slate-400 font-mono text-xs select-none pointer-events-none font-bold">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="numeric"
        value={getFormattedDisplay(value)}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`${prefix ? 'pl-9' : 'px-3'} ${className}`}
      />
    </div>
  );
};

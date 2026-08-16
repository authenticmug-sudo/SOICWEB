import { SOResult, SOSchedule } from '../types/stockOpname';
import { formatRupiah, formatDateIndo } from './formatters';

export interface WAFORMATTERINPUT {
  storeCode: string;
  storeName: string;
  region: string;
  soDate: string;
  startTime?: string;
  endTime?: string;
  officerInCharge?: string;
  executedByTeam?: string;
  namaAM?: string;
  namaAS?: string;
  namaPimpinanShift?: string;
  // NKL & Inventory
  notaKurangNKValRp?: number;
  notaLebihNLValRp?: number;
  customNKLItems?: { label: string; type: 'plus' | 'minus'; amountRp: number }[];
  nettNKLValRp?: number;
  // System / Physical SKU values (Optional, only if input)
  totalSKUChecked?: number;
  systemValueTotalRp?: number;
  physicalValueTotalRp?: number;
  varianceValueTotalRp?: number;
  accuracyRatePercentage?: number;
  // Top 5
  top5Plus?: { plu: string; description: string; valueRp: number }[];
  top5Minus?: { plu: string; description: string; valueRp: number }[];
  // Audit Brankas & Kas
  kasTokoFinanceRp?: number;
  fisikKasTotalRp?: number;
  selisihKasTokoRp?: number;
  uangSalesTutupShiftRp?: number;
  salesTotalRp?: number;
  selisihSalesRp?: number;
  nettSOBrankasRp?: number;
  // Other details
  notes?: string;
  storeConditionSummary?: string;
  itemTidakTerdisplayCount?: number;
  wdcpAudit?: {
    totalUnits: number;
    workingUnits: number;
    brokenUnits: number;
  };
}

export function generateWAShareText(data: WAFORMATTERINPUT): string {
  let text = `📋 *REKAPAN HASIL STOCK OPNAME (SO)*\n`;
  text += `================================\n`;
  text += `🏪 *Toko:* ${data.storeName} (${data.storeCode})\n`;
  text += `📍 *Wilayah:* ${data.region}\n`;
  text += `📅 *Tanggal SO:* ${formatDateIndo(data.soDate)}\n`;
  if (data.startTime && data.endTime) {
    text += `⏰ *Jam Operasi:* ${data.startTime} - ${data.endTime} WIB\n`;
  }
  if (data.officerInCharge) {
    text += `👤 *Korlap In Charge:* ${data.officerInCharge}\n`;
  }
  if (data.executedByTeam) {
    text += `👥 *Tim Audit:* ${data.executedByTeam}\n`;
  }
  if (data.namaAM || data.namaAS || data.namaPimpinanShift) {
    text += `🏢 *Pimpinan Toko:* AM: ${data.namaAM || '-'} | AS: ${data.namaAS || '-'} | Shift: ${data.namaPimpinanShift || '-'}\n`;
  }

  // 1. REKAPITULASI INVENTORI & NKL
  text += `\n📊 *REKAPITULASI INVENTORI & NKL (NOTA KURANG LEBIH):*\n`;
  if (data.notaKurangNKValRp !== undefined || data.notaLebihNLValRp !== undefined || data.nettNKLValRp !== undefined) {
    text += `• Total Nota Kurang (NK): ${formatRupiah(data.notaKurangNKValRp || 0)}\n`;
    text += `• Total Nota Lebih (NL): ${formatRupiah(data.notaLebihNLValRp || 0)}\n`;
    if (data.customNKLItems && data.customNKLItems.length > 0) {
      data.customNKLItems.forEach(item => {
        if (item.label || item.amountRp > 0) {
          text += `• ${item.label || 'Adjustment'}: ${item.type === 'plus' ? '+' : '-'}${formatRupiah(item.amountRp)}\n`;
        }
      });
    }
    const nettNKL = data.nettNKLValRp || 0;
    const nklEmoji = nettNKL < 0 ? '🔻 (MINUS / NOTA KURANG)' : nettNKL > 0 ? '🟢 (PLUS / NOTA LEBIH)' : '✅ (NIHIL / PAS)';
    text += `• *NETT NKL:* ${formatRupiah(nettNKL)} ${nklEmoji}\n`;
  }

  // Include system/physical values ONLY if provided and > 0
  if (data.systemValueTotalRp && data.systemValueTotalRp > 0) {
    if (data.totalSKUChecked) {
      text += `• Total SKU Diperiksa: ${(data.totalSKUChecked ?? 0).toLocaleString('id-ID')} SKU\n`;
    }
    text += `• Total Value Sistem: ${formatRupiah(data.systemValueTotalRp)}\n`;
    text += `• Total Value Fisik: ${formatRupiah(data.physicalValueTotalRp || 0)}\n`;
    const variance = data.varianceValueTotalRp || 0;
    text += `• Net Variance: ${formatRupiah(variance)} ${variance < 0 ? '🔻 (MINUS)' : '🟢 (PLUS)'}\n`;
    if (data.accuracyRatePercentage !== undefined) {
      const statusEmoji = data.accuracyRatePercentage >= 98.0 ? '✅ *AMAN (AKURAT)*' : '⚠️ *PERLU PERHATIAN*';
      text += `• Akurasi Stok: *${data.accuracyRatePercentage}%* ${statusEmoji}\n`;
    }
  }

  if (data.top5Plus && data.top5Plus.some(i => i.plu)) {
    text += `\n🟢 *5 ITEM SELISIH PLUS TERBESAR:*\n`;
    data.top5Plus.filter(i => i.plu).forEach((item, idx) => {
      text += `${idx + 1}. [${item.plu}] ${item.description || 'Barang'} - ${formatRupiah(item.valueRp)}\n`;
    });
  }

  if (data.top5Minus && data.top5Minus.some(i => i.plu)) {
    text += `\n🔻 *5 ITEM SELISIH MINUS TERBESAR:*\n`;
    data.top5Minus.filter(i => i.plu).forEach((item, idx) => {
      text += `${idx + 1}. [${item.plu}] ${item.description || 'Barang'} - ${formatRupiah(item.valueRp)}\n`;
    });
  }

  // 2. AUDIT BRANKAS & KAS TOKO
  if (data.kasTokoFinanceRp !== undefined || data.uangSalesTutupShiftRp !== undefined || data.nettSOBrankasRp !== undefined) {
    text += `\n💰 *AUDIT BRANKAS & KAS TOKO:*\n`;
    if (data.kasTokoFinanceRp !== undefined) {
      text += `• Kas Finance: ${formatRupiah(data.kasTokoFinanceRp)} | Fisik Kas: ${formatRupiah(data.fisikKasTotalRp || 0)} (Selisih: ${formatRupiah(data.selisihKasTokoRp || 0)})\n`;
    }
    if (data.uangSalesTutupShiftRp !== undefined) {
      text += `• Target Sales: ${formatRupiah(data.uangSalesTutupShiftRp)} | Fisik Sales: ${formatRupiah(data.salesTotalRp || 0)} (Selisih: ${formatRupiah(data.selisihSalesRp || 0)})\n`;
    }
    if (data.nettSOBrankasRp !== undefined) {
      const brankasEmoji = data.nettSOBrankasRp < 0 ? '🔻 (MINUS)' : data.nettSOBrankasRp > 0 ? '🟢 (LEBIH)' : '✅ (PAS)';
      text += `• *NETT SO BRANKAS:* ${formatRupiah(data.nettSOBrankasRp)} ${brankasEmoji}\n`;
    }
  }

  if (data.storeConditionSummary) {
    text += `\n🏬 *KONDISI TOKO:* ${data.storeConditionSummary}\n`;
  }

  if (data.itemTidakTerdisplayCount !== undefined && data.itemTidakTerdisplayCount > 0) {
    text += `📦 *Item ITT (Tidak Terdisplay):* ${data.itemTidakTerdisplayCount} item\n`;
  }

  if (data.wdcpAudit && data.wdcpAudit.totalUnits > 0) {
    text += `📱 *Hardware WDCP/PDA Toko:* Total ${data.wdcpAudit.totalUnits} unit (${data.wdcpAudit.workingUnits} Berfungsi, ${data.wdcpAudit.brokenUnits} Tidak Berfungsi/Rusak)\n`;
  }

  if (data.notes) {
    text += `\n📝 *Catatan / Penjelasan Korlap:*\n"${data.notes}"\n`;
  }

  text += `================================\n`;
  text += `⚡ *Status:* Berhasil Tersinkronisasi Otomatis ke Portal Admin SPV Stock Opname\n`;

  return text;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Clipboard API failed, trying fallback execCommand:', err);
    }
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback copy failed:', err);
    return false;
  }
}

export function openWAShareUrl(text: string, phone?: string) {
  const encodedText = encodeURIComponent(text);
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  const url = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;
  window.open(url, '_blank');
}

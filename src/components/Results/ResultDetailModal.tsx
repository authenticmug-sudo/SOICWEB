import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  CheckCheck, 
  RotateCcw, 
  ShieldCheck, 
  Building2, 
  Calendar, 
  UserCheck, 
  Clock, 
  DollarSign, 
  Camera, 
  FileCheck, 
  Image,
  TrendingUp,
  TrendingDown,
  Layers,
  Share2,
  Copy,
  Check,
  Tv,
  Disc
} from 'lucide-react';
import { SOResult } from '../../types/stockOpname';
import { formatRupiah, formatDateIndo, getStatusBadgeClass } from '../../utils/formatters';
import { generateWAShareText, openWAShareUrl, copyToClipboard } from '../../utils/whatsappFormatter';

interface ResultDetailModalProps {
  result: SOResult | null;
  onClose: () => void;
  onApproveResult: (resultId: string) => void;
  onRequestRecount: (resultId: string) => void;
}

export const ResultDetailModal: React.FC<ResultDetailModalProps> = ({
  result,
  onClose,
  onApproveResult,
  onRequestRecount
}) => {
  const [isCopiedWA, setIsCopiedWA] = useState(false);

  if (!result) return null;

  const handlePrint = () => {
    window.print();
  };

  const getWaText = () => {
    return generateWAShareText({
      storeCode: result.storeCode,
      storeName: result.storeName,
      region: result.region,
      soDate: result.soDate,
      startTime: result.startTime,
      endTime: result.endTime,
      officerInCharge: result.officerInCharge || result.spvApprover,
      executedByTeam: result.executedByTeam,
      namaAM: result.namaAM,
      namaAS: result.namaAS,
      namaPimpinanShift: result.namaPimpinanShift,
      notaKurangNKValRp: result.notaKurangNKValRp,
      notaLebihNLValRp: result.notaLebihNLValRp,
      customNKLItems: result.customNKLItems,
      nettNKLValRp: result.nettNKLValRp,
      totalSKUChecked: result.totalSKUChecked,
      systemValueTotalRp: result.systemValueTotalRp,
      physicalValueTotalRp: result.physicalValueTotalRp,
      varianceValueTotalRp: result.varianceValueTotalRp,
      accuracyRatePercentage: result.accuracyRatePercentage,
      top5Plus: result.top5Plus,
      top5Minus: result.top5Minus,
      kasTokoFinanceRp: result.brankasReport?.kasTokoFinanceRp,
      fisikKasTotalRp: (result.brankasReport?.fisikKasBrankasRp || 0) + (result.brankasReport?.fisikKasKasiranRp || 0),
      selisihKasTokoRp: result.brankasReport?.selisihKasTokoRp,
      uangSalesTutupShiftRp: result.brankasReport?.uangSalesTutupShiftRp,
      salesTotalRp: result.brankasReport?.totalFisikSalesRp,
      selisihSalesRp: result.brankasReport?.selisihSalesRp,
      nettSOBrankasRp: result.brankasReport?.nettSOBrankasRp,
      storeCondition: result.storeCondition,
      cctvCheck: result.cctvCheck,
      opCheck: result.opCheck,
      itemTidakTerdisplayCount: result.itemTidakTerdisplayCount,
      wdcpAudit: result.wdcpAudit,
      notes: result.notes || result.notesAndActionPlan || result.brankasReport?.notes
    });
  };

  const handleCopyWA = async () => {
    const waText = getWaText();
    const success = await copyToClipboard(waText);
    if (success) {
      setIsCopiedWA(true);
      setTimeout(() => setIsCopiedWA(false), 2500);
    }
  };

  const handleShareWA = () => {
    const waText = getWaText();
    openWAShareUrl(waText);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header */}
        <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/20 px-2.5 py-0.5 rounded border border-indigo-500/30">
                {result.baNumber}
              </span>
              <span className={`px-2.5 py-0.5 text-[10px] rounded-full border ${getStatusBadgeClass(result.approvalStatus)}`}>
                {result.approvalStatus}
              </span>
            </div>
            <h3 className="font-extrabold text-base text-white mt-1">
              BERITA ACARA HASIL STOCK OPNAME (BA-SO)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyWA}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              {isCopiedWA ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopiedWA ? 'Tersalin!' : 'Salin Teks WA'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareWA}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-xs transition flex items-center gap-1.5 shadow-xs"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share WA Group</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak / PDF
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* BA Document Body */}
        <div id="printable-ba" className="p-6 max-h-[75vh] overflow-y-auto space-y-6 text-slate-800 text-xs">
          
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Kode & Nama Toko</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{result.storeName}</p>
              <span className="font-mono text-[11px] text-indigo-600 font-bold">[{result.storeCode}]</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Wilayah / Area</span>
              <p className="font-medium text-slate-800 mt-0.5">{result.region}</p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Tanggal Pelaksanaan</span>
              <p className="font-medium text-slate-800 mt-0.5">{formatDateIndo(result.soDate)}</p>
              <span className="text-[10px] text-slate-500 block font-mono">
                {result.startTime || '22:00'} - {result.endTime || '04:30'} WIB
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Tim Auditor Penanggung Jawab</span>
              <p className="font-bold text-slate-800 mt-0.5">{result.executedByTeam}</p>
              <span className="text-[10px] text-slate-500">SPV: {result.spvApprover}</span>
            </div>
          </div>

          {/* Management Personil Info */}
          {(result.namaAM || result.namaAS || result.namaPimpinanShift) && (
            <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between text-indigo-950 text-xs">
              <div className="flex items-center gap-2 font-bold">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <span>Pimpinan & Supervisory Toko:</span>
              </div>
              <div className="flex items-center gap-4 flex-wrap text-[11px]">
                {result.namaAM && <span>AM: <strong className="font-bold">{result.namaAM}</strong></span>}
                {result.namaAS && <span>AS: <strong className="font-bold">{result.namaAS}</strong></span>}
                {result.namaPimpinanShift && <span>Pimpinan Shift: <strong className="font-bold">{result.namaPimpinanShift}</strong></span>}
              </div>
            </div>
          )}

          {/* High level KPI Comparison Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
              <span className="text-[10px] font-bold text-rose-700 uppercase">Nota Kurang (NK)</span>
              <p className="text-sm font-bold text-rose-700 mt-1 font-mono">
                {formatRupiah(result.notaKurangNKValRp || 0)}
              </p>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-[10px] font-bold text-emerald-700 uppercase">Nota Lebih (NL)</span>
              <p className="text-sm font-bold text-emerald-700 mt-1 font-mono">
                {formatRupiah(result.notaLebihNLValRp || 0)}
              </p>
            </div>

            <div className={`p-3 rounded-xl border ${
              (result.nettNKLValRp || 0) < 0 ? 'bg-rose-50/80 border-rose-300' : 'bg-indigo-50 border-indigo-200'
            }`}>
              <span className="text-[10px] font-bold uppercase text-slate-700">Nett NKL (Rp)</span>
              <p className={`text-sm font-extrabold mt-1 font-mono ${
                (result.nettNKLValRp || 0) < 0 ? 'text-rose-700' : 'text-indigo-800'
              }`}>
                {formatRupiah(result.nettNKLValRp || 0)}
              </p>
            </div>

            <div className={`p-3 rounded-xl border ${
              (result.brankasReport?.selisihBrankasRp || result.brankasReport?.selisihSalesRp || 0) < 0 ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'
            }`}>
              <span className="text-[10px] font-bold text-amber-800 uppercase">Selisih Brankas</span>
              <p className={`text-sm font-extrabold mt-1 font-mono ${
                (result.brankasReport?.selisihBrankasRp || result.brankasReport?.selisihSalesRp || 0) < 0 ? 'text-rose-700' : 'text-amber-800'
              }`}>
                {formatRupiah(result.brankasReport?.selisihBrankasRp || result.brankasReport?.selisihSalesRp || 0)}
              </p>
            </div>

          </div>

          {/* NK - NL & NKL Summary Section */}
          {(result.notaKurangNKValRp !== undefined || result.notaLebihNLValRp !== undefined) && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-indigo-600" />
                  Rincian Nota Kurang (NK) & Nota Lebih (NL) Toko
                </span>
                <span className="font-bold font-mono text-xs text-indigo-700">
                  Nett NKL: {formatRupiah(result.nettNKLValRp || 0)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">Nota Kurang (NK)</span>
                  <span className="font-mono font-bold text-rose-600">{formatRupiah(result.notaKurangNKValRp || 0)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Nota Lebih (NL)</span>
                  <span className="font-mono font-bold text-emerald-600">{formatRupiah(result.notaLebihNLValRp || 0)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Penyesuaian NKL (+/-)</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {result.customNKLItems && result.customNKLItems.length > 0 
                      ? `${result.customNKLItems.length} item disesuaikan` 
                      : 'Sesuai Standar'}
                  </span>
                </div>
              </div>

              {result.customNKLItems && result.customNKLItems.length > 0 && (
                <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-2">
                  {result.customNKLItems.map((item, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">
                      {item.label}: <strong className={item.type === 'plus' ? 'text-emerald-600' : 'text-rose-600'}>
                        {item.type === 'plus' ? '+' : '-'}{formatRupiah(item.amountRp)}
                      </strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Category Breakdown Table */}
          <div>
            <h4 className="font-bold text-slate-900 mb-2 uppercase tracking-wider text-[11px] flex items-center justify-between">
              <span>Rincian Selisih per Kategori Barang</span>
              <span className="text-[10px] text-slate-400 font-normal">Auto-calculated System vs Physical</span>
            </h4>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                    <th className="py-2.5 px-3">Kategori Barang</th>
                    <th className="py-2.5 px-3 text-right">System Qty</th>
                    <th className="py-2.5 px-3 text-right">Fisik Qty</th>
                    <th className="py-2.5 px-3 text-right">Selisih Qty</th>
                    <th className="py-2.5 px-3 text-right">Selisih Nominal (Rp)</th>
                    <th className="py-2.5 px-3">Dugaan Penyebab</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.categoryBreakdown.map((cat, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-2 px-3 font-semibold text-slate-900">{cat.category}</td>
                      <td className="py-2 px-3 text-right font-mono">{(cat.systemQty ?? 0).toLocaleString('id-ID')}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{(cat.physicalQty ?? 0).toLocaleString('id-ID')}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        <span className={cat.varianceQty < 0 ? 'text-rose-600' : cat.varianceQty > 0 ? 'text-emerald-600' : 'text-slate-500'}>
                          {cat.varianceQty > 0 ? `+${cat.varianceQty}` : cat.varianceQty}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        <span className={cat.varianceValueRp < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                          {formatRupiah(cat.varianceValueRp)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 italic text-[11px] max-w-[150px] truncate">
                        {cat.mainCause || 'Pemeriksaan rutin'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top 5 Item Plus & Minus Section */}
          {((result.top5Plus && result.top5Plus.length > 0) || (result.top5Minus && result.top5Minus.length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Top 5 Plus */}
              <div className="border border-emerald-200 rounded-xl overflow-hidden">
                <div className="bg-emerald-100/70 p-2 px-3 font-bold text-emerald-900 text-[11px] flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  Top 5 Item Plus (+)
                </div>
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-emerald-50 text-emerald-800 border-b border-emerald-200 font-bold">
                      <th className="py-1.5 px-2">PLU</th>
                      <th className="py-1.5 px-2">Deskripsi</th>
                      <th className="py-1.5 px-2 text-right">Nilai Plus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100">
                    {result.top5Plus?.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-1 px-2 font-mono font-bold">{item.plu || '-'}</td>
                        <td className="py-1 px-2 truncate max-w-[120px]">{item.description || '-'}</td>
                        <td className="py-1 px-2 text-right font-mono font-bold text-emerald-600">{formatRupiah(item.valueRp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Top 5 Minus */}
              <div className="border border-rose-200 rounded-xl overflow-hidden">
                <div className="bg-rose-100/70 p-2 px-3 font-bold text-rose-900 text-[11px] flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                  Top 5 Item Minus (-)
                </div>
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-rose-50 text-rose-800 border-b border-rose-200 font-bold">
                      <th className="py-1.5 px-2">PLU</th>
                      <th className="py-1.5 px-2">Deskripsi</th>
                      <th className="py-1.5 px-2 text-right">Nilai Minus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100">
                    {result.top5Minus?.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-1 px-2 font-mono font-bold">{item.plu || '-'}</td>
                        <td className="py-1 px-2 truncate max-w-[120px]">{item.description || '-'}</td>
                        <td className="py-1 px-2 text-right font-mono font-bold text-rose-600">{formatRupiah(item.valueRp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* Laporan Audit SO Brankas & Kas Toko */}
          {result.brankasReport && (
            <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                <span className="font-extrabold text-amber-950 text-xs flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-amber-600" />
                  Laporan SO Brankas Toko (Audit Kas & Uang Sales)
                </span>
                <span className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded border ${
                  result.brankasReport.nettSOBrankasRp < 0 ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                }`}>
                  Nett SO Brankas: {formatRupiah(result.brankasReport.nettSOBrankasRp)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Kas Toko */}
                <div className="p-2.5 bg-white rounded-lg border border-amber-200 space-y-1">
                  <span className="font-bold text-amber-900 block border-b pb-1 text-[11px]">1. Kas Toko</span>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Kas Finance:</span>
                    <span className="font-mono">{formatRupiah(result.brankasReport.kasTokoFinanceRp)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fisik Brankas:</span>
                    <span className="font-mono">{formatRupiah(result.brankasReport.fisikKasBrankasRp)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fisik Kasiran:</span>
                    <span className="font-mono">{formatRupiah(result.brankasReport.fisikKasKasiranRp)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t font-bold">
                    <span>Selisih Kas Toko:</span>
                    <span className={`font-mono ${result.brankasReport.selisihKasTokoRp < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {formatRupiah(result.brankasReport.selisihKasTokoRp)}
                    </span>
                  </div>
                </div>

                {/* Uang Sales */}
                <div className="p-2.5 bg-white rounded-lg border border-amber-200 space-y-1.5">
                  <div className="flex justify-between items-center border-b pb-1">
                    <span className="font-bold text-amber-900 text-[11px]">2. Audit Uang Sales Toko</span>
                    <span className={`font-mono text-[10px] font-bold ${result.brankasReport.selisihSalesRp < 0 ? 'text-rose-600' : result.brankasReport.selisihSalesRp > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                      Selisih: {result.brankasReport.selisihSalesRp < 0 ? `- ${formatRupiah(Math.abs(result.brankasReport.selisihSalesRp))}` : formatRupiah(result.brankasReport.selisihSalesRp)}
                    </span>
                  </div>

                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between font-bold text-indigo-950 bg-indigo-50/70 p-1 rounded">
                      <span>Total Target Tutup Shift:</span>
                      <span className="font-mono">{formatRupiah(result.brankasReport.uangSalesTutupShiftRp)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 pl-1 text-[10px] text-slate-600 border-b pb-1.5">
                      {(result.brankasReport.salesKompIndukRp !== undefined || result.brankasReport.fisikSalesKompIndukRp !== undefined) && (
                        <div className="flex justify-between">
                          <span>Komp. Induk:</span>
                          <span className="font-mono">Tgt {formatRupiah(result.brankasReport.salesKompIndukRp || 0)} / Fsk {formatRupiah(result.brankasReport.fisikSalesKompIndukRp ?? result.brankasReport.fisikSalesIndukRp ?? 0)}</span>
                        </div>
                      )}
                      {(result.brankasReport.salesAnak1Rp !== undefined || result.brankasReport.fisikSalesAnak1Rp !== undefined) && (
                        <div className="flex justify-between">
                          <span>Anak 1:</span>
                          <span className="font-mono">Tgt {formatRupiah(result.brankasReport.salesAnak1Rp || 0)} / Fsk {formatRupiah(result.brankasReport.fisikSalesAnak1Rp || 0)}</span>
                        </div>
                      )}
                      {(result.brankasReport.salesAnak2Rp !== undefined || result.brankasReport.fisikSalesAnak2Rp !== undefined) && (
                        <div className="flex justify-between">
                          <span>Anak 2:</span>
                          <span className="font-mono">Tgt {formatRupiah(result.brankasReport.salesAnak2Rp || 0)} / Fsk {formatRupiah(result.brankasReport.fisikSalesAnak2Rp || 0)}</span>
                        </div>
                      )}
                      {(result.brankasReport.salesAnak3Rp !== undefined || result.brankasReport.fisikSalesAnak3Rp !== undefined) && (
                        <div className="flex justify-between">
                          <span>Anak 3:</span>
                          <span className="font-mono">Tgt {formatRupiah(result.brankasReport.salesAnak3Rp || 0)} / Fsk {formatRupiah(result.brankasReport.fisikSalesAnak3Rp || 0)}</span>
                        </div>
                      )}
                      {(result.brankasReport.salesAnak4Rp !== undefined || result.brankasReport.fisikSalesAnak4Rp !== undefined) && (
                        <div className="flex justify-between">
                          <span>Anak 4:</span>
                          <span className="font-mono">Tgt {formatRupiah(result.brankasReport.salesAnak4Rp || 0)} / Fsk {formatRupiah(result.brankasReport.fisikSalesAnak4Rp || 0)}</span>
                        </div>
                      )}
                      {(result.brankasReport.salesPointCoffeeRp !== undefined || result.brankasReport.fisikSalesPointCoffeeRp !== undefined) && (
                        <div className="flex justify-between">
                          <span>Point Coffee:</span>
                          <span className="font-mono">Tgt {formatRupiah(result.brankasReport.salesPointCoffeeRp || 0)} / Fsk {formatRupiah(result.brankasReport.fisikSalesPointCoffeeRp || 0)}</span>
                        </div>
                      )}
                      {(result.brankasReport.salesKemarinRp !== undefined || result.brankasReport.fisikSalesKemarinRp !== undefined) && (
                        <div className="flex justify-between">
                          <span>Sales Kemarin:</span>
                          <span className="font-mono">Tgt {formatRupiah(result.brankasReport.salesKemarinRp || 0)} / Fsk {formatRupiah(result.brankasReport.fisikSalesKemarinRp || 0)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between font-bold text-emerald-950 bg-emerald-50/70 p-1 rounded">
                      <span>Total Fisik Uang Sales:</span>
                      <span className="font-mono">{formatRupiah(result.brankasReport.totalFisikSalesRp || (result.brankasReport.fisikSalesIndukRp + result.brankasReport.fisikSalesAnakRp + (result.brankasReport.fisikSalesKemarinRp || 0)))}</span>
                    </div>
                  </div>
                </div>
              </div>

              {result.brankasReport.customBrankasItems && result.brankasReport.customBrankasItems.length > 0 && (
                <div className="pt-2 border-t border-amber-200 flex flex-wrap gap-2 text-xs">
                  <span className="font-bold text-amber-900 text-[11px]">Item Brankas Lainnya:</span>
                  {result.brankasReport.customBrankasItems.map((item, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-white border border-amber-300 rounded font-mono text-[10px]">
                      {item.label}: <strong className={item.type === 'plus' ? 'text-emerald-600' : 'text-rose-600'}>
                        {item.type === 'plus' ? '+' : '-'}{formatRupiah(item.amountRp)}
                      </strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Kondisi Toko, Operasional, CCTV */}
          {(result.storeCondition || result.opCheck || result.cctvCheck) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              
              {result.storeCondition && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 uppercase text-[10px] block border-b pb-1">Kondisi Kerapihan Toko</span>
                  <div className="flex justify-between"><span>Gudang Kolian:</span><strong className="font-semibold">{result.storeCondition.gudangKolian}</strong></div>
                  <div className="flex justify-between"><span>Gudang Rak:</span><strong className="font-semibold">{result.storeCondition.gudangRak}</strong></div>
                  <div className="flex justify-between"><span>Area Toko:</span><strong className="font-semibold">{result.storeCondition.areaToko}</strong></div>
                  <div className="flex justify-between"><span>Ice Cream / Frozen:</span><strong className="font-semibold">{result.storeCondition.iceCreamFrozen}</strong></div>
                </div>
              )}

              {result.opCheck && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 uppercase text-[10px] block border-b pb-1">Cek Dokumen & Display</span>
                  <div className="flex justify-between"><span>BPB Belum Diproses:</span><strong className="font-semibold">{result.opCheck.bpbBelumDiproses}</strong></div>
                  <div className="flex justify-between"><span>Retur Belum Dikirim:</span><strong className="font-semibold">{result.opCheck.returBelumDikirimDC}</strong></div>
                  <div className="flex justify-between"><span>Cek Kiriman Alat:</span><strong className="font-semibold">{result.opCheck.cekKirimanDenganAlat}</strong></div>
                  <div className="flex justify-between"><span>Tidak Terdisplay:</span><strong className="font-bold text-indigo-700">{result.itemTidakTerdisplayCount || 0} Item</strong></div>
                </div>
              )}

              {result.cctvCheck && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 uppercase text-[10px] block border-b pb-1 flex items-center gap-1">
                    <Camera className="w-3 h-3 text-indigo-600" /> Kondisi CCTV & LCD
                  </span>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 flex items-center gap-1"><Tv className="w-3 h-3 text-slate-500" /> Layar LCD:</span>
                    <strong className={`font-semibold px-2 py-0.5 rounded text-[11px] ${result.cctvCheck.lcdStatus === 'Mati' || result.cctvCheck.lcdStatus === 'Tidak' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {result.cctvCheck.lcdStatus === 'Mati' || result.cctvCheck.lcdStatus === 'Tidak' ? '🔴 Mati' : '🟢 Nyala'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 flex items-center gap-1"><Disc className="w-3 h-3 text-indigo-600" /> Merekam (Pita Kaset):</span>
                    <strong className={`font-semibold px-2 py-0.5 rounded text-[11px] ${result.cctvCheck.merekamStatus === 'Tidak' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {result.cctvCheck.merekamStatus === 'Tidak' ? '❌ Tidak' : '✅ Iya'}
                    </strong>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Evidence Photo */}
          {result.evidencePhotoUrl && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-slate-800 text-xs">Foto Bukti Audit Physical / Berita Acara (Cloudinary)</span>
              </div>
              <a 
                href={result.evidencePhotoUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-xs transition"
              >
                Lihat Foto Cloudinary
              </a>
            </div>
          )}

          {/* Notes & Action Plan */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <h5 className="font-bold text-slate-900 text-xs">Catatan & Rencana Tindak Lanjut Field:</h5>
            <p className="text-slate-700 leading-relaxed text-xs">
              {result.notesAndActionPlan || 'Tidak ada catatan tambahan.'}
            </p>
          </div>

          {/* SPV Digital Stamp & Signatures */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Disiapkan Oleh (Tim SO)</p>
              <div className="h-14 flex items-center justify-center font-bold text-slate-700 text-xs">
                {result.executedByTeam}
              </div>
              <p className="text-[10px] text-slate-500">Auditor Field Leader</p>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Diketahui Store Manager / Shift</p>
              <div className="h-14 flex items-center justify-center font-bold text-slate-700 text-xs">
                {result.namaPimpinanShift || 'Store Manager Toko'}
              </div>
              <p className="text-[10px] text-slate-500">Tanda Tangan Digital Toko</p>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Disetujui SPV SO Head</p>
              <div className="h-14 flex flex-col items-center justify-center">
                {result.approvalStatus === 'Disetujui' ? (
                  <div className="p-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    VERIFIED SPV
                  </div>
                ) : (
                  <span className="text-xs text-amber-600 font-semibold italic">Menunggu Signature</span>
                )}
              </div>
              <p className="text-[10px] text-slate-500">{result.spvApprover}</p>
            </div>
          </div>

        </div>

        {/* Footer Buttons */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition"
          >
            Tutup Preview
          </button>

          {result.approvalStatus === 'Menunggu Approval SPV' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onRequestRecount(result.id);
                  onClose();
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                Audit Ulang (Re-Count)
              </button>

              <button
                onClick={() => {
                  onApproveResult(result.id);
                  onClose();
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1.5"
              >
                <CheckCheck className="w-4 h-4" />
                Setujui Berita Acara (Approve)
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

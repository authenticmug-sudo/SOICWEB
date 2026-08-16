import React from 'react';
import { AlertOctagon, ArrowRight, CheckCheck, RotateCcw, FileText } from 'lucide-react';
import { SOResult } from '../../types/stockOpname';
import { formatRupiah, getStatusBadgeClass } from '../../utils/formatters';

interface HighVarianceAlertWidgetProps {
  results: SOResult[];
  onNavigateResults: () => void;
  onApproveResult: (resultId: string) => void;
  onRequestRecount: (resultId: string) => void;
  onSelectResultDetail: (result: SOResult) => void;
}

export const HighVarianceAlertWidget: React.FC<HighVarianceAlertWidgetProps> = ({
  results,
  onNavigateResults,
  onApproveResult,
  onRequestRecount,
  onSelectResultDetail
}) => {
  // Filter pending or high variance results
  const alertResults = results.filter(
    r => r.approvalStatus === 'Menunggu Approval SPV' || Math.abs(r.varianceValueTotalRp) > 10000000
  ).slice(0, 5);

  return (
    <div className="bg-white rounded border border-slate-200 shadow-xs p-3.5 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-rose-600" />
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Critical Alerts & Verification Pending
          </h3>
        </div>
        <button
          onClick={onNavigateResults}
          className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 transition"
        >
          All Results <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-2">
        {alertResults.length > 0 ? (
          alertResults.map((res) => (
            <div 
              key={res.id}
              className="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded border border-slate-200 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">{res.storeName}</span>
                  <span className="text-[10px] font-mono text-slate-500">({res.storeCode})</span>
                  <span className={`px-1.5 py-0.5 text-[9px] rounded font-semibold uppercase tracking-wider ${getStatusBadgeClass(res.approvalStatus)}`}>
                    {res.approvalStatus}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
                  <span>BA: <strong className="font-mono">{res.baNumber}</strong></span>
                  <span>Accuracy: <strong className={res.accuracyRatePercentage < 98 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>{res.accuracyRatePercentage}%</strong></span>
                  <span>
                    Variance: <strong className={res.varianceValueTotalRp < 0 ? 'text-rose-600 font-bold font-mono' : 'text-emerald-600 font-bold font-mono'}>
                      {formatRupiah(res.varianceValueTotalRp)}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => onSelectResultDetail(res)}
                  className="px-2 py-1 bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 rounded text-[11px] font-medium transition flex items-center gap-1"
                >
                  <FileText className="w-3 h-3 text-slate-500" />
                  Detail
                </button>

                {res.approvalStatus === 'Menunggu Approval SPV' && (
                  <>
                    <button
                      onClick={() => onRequestRecount(res.id)}
                      className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-medium transition flex items-center gap-1"
                      title="Request Recount"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Recount
                    </button>
                    <button
                      onClick={() => onApproveResult(res.id)}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition flex items-center gap-1 shadow-xs"
                      title="Approve Report"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Approve
                    </button>
                  </>
                )}
              </div>

            </div>
          ))
        ) : (
          <div className="py-4 text-center text-xs text-slate-400">
            No pending approval alerts
          </div>
        )}
      </div>
    </div>
  );
};

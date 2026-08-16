import React from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  Legend,
  CartesianGrid
} from 'recharts';
import { SOSchedule, SOResult } from '../../types/stockOpname';
import { formatRupiah } from '../../utils/formatters';

interface ChartsSectionProps {
  schedules: SOSchedule[];
  results: SOResult[];
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({ schedules, results }) => {
  // Chart 1: Status Penjadwalan Breakdown
  const statusCounts = schedules.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = [
    { name: 'Selesai SO', value: statusCounts['Selesai'] || 0, color: '#10b981' },
    { name: 'Terjadwal', value: statusCounts['Terjadwal'] || 0, color: '#3b82f6' },
    { name: 'Proses SO', value: statusCounts['Proses SO'] || 0, color: '#f59e0b' },
    { name: 'Menunggu Rekapan', value: statusCounts['Menunggu Rekapan'] || 0, color: '#8b5cf6' }
  ].filter(d => d.value > 0);

  // Chart 2: Regional Accuracy Rate
  const regionAccuracy = results.reduce((acc, r) => {
    const shortRegion = r.region.split(' ')[0]; // e.g. Jabodetabek, Jawa, Sumatera
    if (!acc[shortRegion]) {
      acc[shortRegion] = { total: 0, count: 0 };
    }
    acc[shortRegion].total += r.accuracyRatePercentage;
    acc[shortRegion].count += 1;
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  const regionBarData = (Object.entries(regionAccuracy) as [string, { total: number; count: number }][]).map(([region, data]) => ({
    region,
    accuracy: +(data.total / data.count).toFixed(2)
  }));

  // Chart 3: Selisih Nominal per Category
  const categoryVarianceMap: Record<string, { systemVal: number; physicalVal: number; varianceVal: number }> = {};
  
  results.forEach(r => {
    r.categoryBreakdown.forEach(cat => {
      if (!categoryVarianceMap[cat.category]) {
        categoryVarianceMap[cat.category] = { systemVal: 0, physicalVal: 0, varianceVal: 0 };
      }
      categoryVarianceMap[cat.category].systemVal += cat.systemValueRp;
      categoryVarianceMap[cat.category].physicalVal += cat.physicalValueRp;
      categoryVarianceMap[cat.category].varianceVal += Math.abs(cat.varianceValueRp);
    });
  });

  const categoryBarData = Object.entries(categoryVarianceMap).map(([category, data]) => ({
    category: category.split(' ')[0], // Short name
    fullName: category,
    selisihNominal: data.varianceVal
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      
      {/* Chart 1: Status Distribution */}
      <div className="bg-white p-3.5 rounded border border-slate-200 shadow-xs">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          Status Penjadwalan SO
        </h3>
        <div className="h-56 w-full flex items-center justify-center">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(val: number) => [`${val} Toko`, 'Jumlah']}
                  contentStyle={{ borderRadius: '6px', fontSize: '11px', padding: '6px 10px' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={32} 
                  formatter={(value) => <span className="text-[11px] text-slate-600 font-medium">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-slate-400">Belum ada data jadwal</p>
          )}
        </div>
      </div>

      {/* Chart 2: Akurasi per Wilayah */}
      <div className="bg-white p-3.5 rounded border border-slate-200 shadow-xs">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          Avg. Accuracy per Region (%)
        </h3>
        <div className="h-56 w-full">
          {regionBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionBarData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="region" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" />
                <YAxis domain={[90, 100]} tick={{ fontSize: 9 }} />
                <Tooltip 
                  formatter={(val: number) => [`${val}%`, 'Akurasi']}
                  contentStyle={{ borderRadius: '6px', fontSize: '11px', padding: '6px 10px' }}
                />
                <Bar dataKey="accuracy" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-slate-400 text-center pt-20">Belum ada data akurasi</p>
          )}
        </div>
      </div>

      {/* Chart 3: Selisih Nominal per Kategori */}
      <div className="bg-white p-3.5 rounded border border-slate-200 shadow-xs">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          Variance Nominal per Category (Abs)
        </h3>
        <div className="h-56 w-full">
          {categoryBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryBarData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="category" tick={{ fontSize: 9 }} interval={0} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={(val) => `Rp ${(val / 1000000).toFixed(0)}M`} />
                <Tooltip 
                  formatter={(val: number) => [formatRupiah(val), 'Total Selisih']}
                  contentStyle={{ borderRadius: '6px', fontSize: '11px', padding: '6px 10px' }}
                />
                <Bar dataKey="selisihNominal" fill="#f43f5e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-slate-400 text-center pt-20">Belum ada data selisih</p>
          )}
        </div>
      </div>

    </div>
  );
};

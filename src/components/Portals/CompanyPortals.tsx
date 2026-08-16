import React, { useState, useEffect } from 'react';
import { ExternalLink, Globe, Search, Plus, Trash2, Edit3, ShieldCheck, Building, SlidersHorizontal, Sparkles } from 'lucide-react';
import { CompanyPortalLink, UserRole } from '../../types/stockOpname';

interface CompanyPortalsProps {
  currentRole: UserRole;
  onNavigateToSettings?: () => void;
}

const DEFAULT_PORTALS: CompanyPortalLink[] = [
  {
    id: 'portal-1',
    title: 'Portal HRIS Perusahaan',
    description: 'Sistem absensi digital, pengajuan izin, slip gaji, dan data kepegawaian internal perusahaan.',
    url: 'https://hris.perusahaan.com',
    badge: 'HRIS & SDM',
    category: 'SDM & HR',
    iconName: 'Globe'
  },
  {
    id: 'portal-2',
    title: 'Pusat Operasional SO & Audit IC',
    description: 'Pusat panduan SOP Stock Opname, regulasi audit internal toko, dan pendaftaran jadwal khusus.',
    url: 'https://ic-center.perusahaan.com',
    badge: 'SO Operasional',
    category: 'Operasional SO',
    iconName: 'Building'
  },
  {
    id: 'portal-3',
    title: 'Cloud Storage Drive Dokumentasi BA',
    description: 'Penyimpanan terpusat foto bukti fisik, file pendukung, dan rekapitulasi Berita Acara (BA) SO.',
    url: 'https://drive.google.com',
    badge: 'Cloud Storage',
    category: 'Dokumentasi & Drive',
    iconName: 'ExternalLink'
  },
  {
    id: 'portal-4',
    title: 'Portal Intranet & Helpdesk IT Operasional',
    description: 'Layanan tiket pengaduan kendala perangkat keras (PDA/Scanner) dan kendala sistem jaringan toko.',
    url: 'https://helpdesk.perusahaan.com',
    badge: 'Support IT',
    category: 'General & Support',
    iconName: 'Globe'
  }
];

export const getStoredCompanyPortals = (): CompanyPortalLink[] => {
  const saved = localStorage.getItem('spv_company_portals');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {
      console.error(e);
    }
  }
  return DEFAULT_PORTALS;
};

export const CompanyPortals: React.FC<CompanyPortalsProps> = ({ currentRole, onNavigateToSettings }) => {
  const [portals, setPortals] = useState<CompanyPortalLink[]>(getStoredCompanyPortals);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  useEffect(() => {
    const handleStorage = () => {
      setPortals(getStoredCompanyPortals());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const categories = Array.from(new Set(portals.map(p => p.category || 'General')));

  const filteredPortals = portals.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.badge && p.badge.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'ALL' || (p.category || 'General') === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-5 max-w-6xl">
      
      {/* Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 rounded-2xl text-white shadow-md border border-indigo-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            Portal Penting Perusahaan & Operasional Field
          </div>
          <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
            <Building className="w-5 h-5 text-indigo-400" />
            Akses Cepat Portal Penting Perusahaan
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Kumpulan tautan web resmi, HRIS, cloud storage, dan sistem intranet perusahaan untuk mempermudah operasional Korlap, Officer & Tim SO Lapangan.
          </p>
        </div>

        {(currentRole === 'SUPERVISOR' || currentRole === 'ALL') && onNavigateToSettings && (
          <button
            onClick={onNavigateToSettings}
            className="shrink-0 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm border border-indigo-400/30"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Atur Tombol Portal (Supervisor)</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul portal, deskripsi, tag..."
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-indigo-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto custom-scrollbar pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
              selectedCategory === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Portal ({portals.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Company Portals */}
      {filteredPortals.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-2">
          <Building className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">Tidak ada portal perusahaan yang cocok</p>
          <p className="text-xs text-slate-400">Coba ubah kata kunci pencarian atau kategori filter Anda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPortals.map((portal) => (
            <div
              key={portal.id}
              className="bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-300 shadow-2xs hover:shadow-md transition-all duration-200 p-5 flex flex-col justify-between space-y-4 group relative overflow-hidden"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-lg text-[10px] font-extrabold uppercase tracking-wider">
                    {portal.badge || portal.category || 'Portal'}
                  </span>
                  <span className="p-2 bg-slate-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition">
                    <Globe className="w-4 h-4" />
                  </span>
                </div>

                <div>
                  <h3 className="font-extrabold text-slate-900 text-base group-hover:text-indigo-600 transition leading-snug">
                    {portal.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-3">
                    {portal.description}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-slate-400 truncate max-w-[160px]">
                  {portal.url}
                </span>

                <a
                  href={portal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs active:scale-[0.98]"
                >
                  <span>Buka Portal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info note */}
      <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Info Pengaturan Supervisor:</span>
          <p className="text-[11px] text-amber-800 mt-0.5">
            Supervisor dapat menambah, mengubah judul/deskripsi, atau menghapus tombol portal ini dari menu <strong className="text-amber-950">Pengaturan & Utilities</strong>.
          </p>
        </div>
      </div>

    </div>
  );
};

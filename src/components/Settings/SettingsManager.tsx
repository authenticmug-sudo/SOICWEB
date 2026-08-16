import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, RotateCcw, Download, Upload, ShieldCheck, CheckCircle2, Cloud, Globe, ExternalLink, Plus, Trash2, Edit3, Save, X } from 'lucide-react';
import { Store, SOSchedule, SOResult, SOTeam, CompanyPortalLink, UserRole } from '../../types/stockOpname';
import { getStoredCompanyPortals } from '../Portals/CompanyPortals';
import { getFormattedDateSuffix, saveCloudinaryConfig } from '../../services/cloudinaryService';
import { ConfirmDeleteModal } from '../Common/ConfirmDeleteModal';
import { ToastNotification } from '../Common/ToastNotification';

interface SettingsManagerProps {
  stores: Store[];
  schedules: SOSchedule[];
  results: SOResult[];
  teams: SOTeam[];
  currentRole?: UserRole;
  onResetData: (options?: { forceWipeCloudinary?: boolean }) => void;
  onRestoreData: (data: { stores: Store[]; schedules: SOSchedule[]; results: SOResult[]; teams: SOTeam[] }) => void;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({
  stores,
  schedules,
  results,
  teams,
  currentRole = 'ALL',
  onResetData,
  onRestoreData
}) => {
  const [jsonBackup, setJsonBackup] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState(() => localStorage.getItem('spv_cloudinary_cloud_name') || '');
  const [cloudinaryPreset, setCloudinaryPreset] = useState(() => localStorage.getItem('spv_cloudinary_preset') || '');
  const [cloudinaryApiKey, setCloudinaryApiKey] = useState(() => localStorage.getItem('spv_cloudinary_api_key') || '');
  const [cloudinaryApiSecret, setCloudinaryApiSecret] = useState(() => localStorage.getItem('spv_cloudinary_api_secret') || '');

  // Company Portal Links State
  const [portals, setPortals] = useState<CompanyPortalLink[]>(getStoredCompanyPortals);
  const [isPortalModalOpen, setIsPortalModalOpen] = useState(false);
  const [editingPortal, setEditingPortal] = useState<CompanyPortalLink | null>(null);

  // Portal Form States
  const [portalTitle, setPortalTitle] = useState('');
  const [portalDesc, setPortalDesc] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [portalBadge, setPortalBadge] = useState('');
  const [portalCategory, setPortalCategory] = useState('General');

  const savePortalsToLocalStorage = (data: CompanyPortalLink[]) => {
    setPortals(data);
    localStorage.setItem('spv_company_portals', JSON.stringify(data));
    window.dispatchEvent(new Event('storage'));
  };

  const handleOpenPortalModal = (p?: CompanyPortalLink) => {
    if (p) {
      setEditingPortal(p);
      setPortalTitle(p.title);
      setPortalDesc(p.description);
      setPortalUrl(p.url);
      setPortalBadge(p.badge || '');
      setPortalCategory(p.category || 'General');
    } else {
      setEditingPortal(null);
      setPortalTitle('');
      setPortalDesc('');
      setPortalUrl('https://');
      setPortalBadge('');
      setPortalCategory('General');
    }
    setIsPortalModalOpen(true);
  };

  const handleSavePortal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalTitle.trim() || !portalUrl.trim()) {
      alert('Mohon isi Judul Portal dan URL Tautan!');
      return;
    }

    let updated: CompanyPortalLink[];
    if (editingPortal) {
      updated = portals.map(item => item.id === editingPortal.id ? {
        ...item,
        title: portalTitle,
        description: portalDesc,
        url: portalUrl,
        badge: portalBadge || 'Portal',
        category: portalCategory || 'General'
      } : item);
    } else {
      const newP: CompanyPortalLink = {
        id: `portal-${Date.now()}`,
        title: portalTitle,
        description: portalDesc,
        url: portalUrl,
        badge: portalBadge || 'Portal Baru',
        category: portalCategory || 'General',
        createdAt: new Date().toISOString()
      };
      updated = [...portals, newP];
    }

    savePortalsToLocalStorage(updated);
    setIsPortalModalOpen(false);
    setSuccessMsg('Tombol Portal Perusahaan berhasil disimpan!');
  };

  const [portalToDelete, setPortalToDelete] = useState<CompanyPortalLink | null>(null);
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSuperAdminReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (resetPasswordInput !== '020594') {
      setResetError('❌ Password Reset Salah! Masukkan password Super Admin: 020594');
      return;
    }

    if (resetConfirmText.trim().toLowerCase() !== 'ya') {
      setResetError('❌ Mohon ketik kata "ya" untuk mengonfirmasi penghapusan permanen!');
      return;
    }

    setIsResetting(true);
    try {
      await onResetData({ forceWipeCloudinary: true });
      setResetSuccess('✅ SELURUH data master di LocalStorage, Firebase, & Cloudinary BERHASIL dibersihkan hingga 0!');
      setToastMessage('Semua master data di LocalStorage, Firebase, & Cloudinary berhasil dibersihkan!');
      setTimeout(() => {
        setIsConfirmResetOpen(false);
        setResetPasswordInput('');
        setResetConfirmText('');
        setResetSuccess('');
        setIsResetting(false);
      }, 1500);
    } catch (err: any) {
      setResetError('Gagal melakukan reset: ' + (err?.message || err));
      setIsResetting(false);
    }
  };

  const handleDeletePortal = (portal: CompanyPortalLink) => {
    setPortalToDelete(portal);
  };

  const handleSaveCloudinarySettings = () => {
    saveCloudinaryConfig(cloudinaryCloudName, cloudinaryPreset, cloudinaryApiKey, cloudinaryApiSecret);
    setSuccessMsg('Konfigurasi Cloudinary berhasil disimpan & disinkronkan ke cloud!');
  };

  const handleDownloadBackup = () => {
    const backupObj = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      stores,
      schedules,
      results,
      teams
    };
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SuperVISO_SO_Backup_${getFormattedDateSuffix()}.json`;
    a.click();
  };

  const handleRestoreJSON = () => {
    if (!jsonBackup.trim()) return;
    try {
      const parsed = JSON.parse(jsonBackup);
      if (parsed.stores && parsed.schedules && parsed.results) {
        onRestoreData({
          stores: parsed.stores,
          schedules: parsed.schedules,
          results: parsed.results,
          teams: parsed.teams || teams
        });
        setSuccessMsg('Data berhasil di-restore dari JSON!');
      } else {
        alert('Format JSON tidak valid! Pastikan memuat struktur data SuperVISO.');
      }
    } catch {
      alert('Gagal membaca JSON string. Periksa kembali format input.');
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
          Pengaturan Aplikasi & Backup Database SPV
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Kelola penyimpanan lokal (localStorage), ekspor cadangan data JSON, serta reset demo data
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm space-y-6 text-xs">
        
        {/* Profile SPV Config */}
        <div>
          <h3 className="font-bold text-slate-900 text-sm mb-3">Profil Supervisor In-Charge</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Nama SPV</span>
              <p className="font-bold text-slate-800 text-sm mt-0.5">Gean Pratama</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Jabatan Operasional</span>
              <p className="font-medium text-slate-700 mt-0.5">Supervisor Stock Opname Head (700+ Toko)</p>
            </div>
          </div>
        </div>

        {/* Firebase Cloud Firestore Integration Section */}
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Database Cloud (Firebase Firestore)
            </h3>
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Firestore Live Connected
            </span>
          </div>
          <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-lg text-xs space-y-1">
            <p className="font-bold text-emerald-900">
              Project ID: <span className="font-mono font-normal">gen-lang-client-0179058404</span>
            </p>
            <p className="text-[11px] text-emerald-800">
              Setiap toko baru yang disimpan atau di-import dari Excel, jadwal SO, dan Berita Acara (BA) akan tersinkronisasi secara real-time ke database cloud Firebase Firestore.
            </p>
          </div>
        </div>

        {/* Cloudinary Integration Section */}
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Cloud className="w-4 h-4 text-indigo-600" />
              Integrasi Cloudinary Cloud Storage
            </h3>
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
              Active Sync Ready
            </span>
          </div>
          <p className="text-slate-500 text-xs">
            Konfigurasi akun Cloudinary Anda untuk upload & hosting foto fisik toko, bukti selisih stock opname, dan scan dokumen Berita Acara (BA) secara langsung ke CDN.
          </p>

          {/* Explanation Banner */}
          <div className="bg-indigo-50/80 border border-indigo-200 p-3 rounded-lg text-xs text-indigo-950 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-indigo-900">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Mengapa Hanya Menggunakan Unsigned Upload Preset di Frontend?
            </div>
            <p className="text-[11px] text-indigo-900 leading-relaxed">
              Untuk upload foto langsung dari browser/client-side tanpa server backend, Cloudinary menggunakan <strong>Cloud Name</strong> dan <strong>Unsigned Upload Preset</strong>. Metode ini aman karena <strong>API Secret Key tidak boleh dipasang di frontend browser</strong> agar akun Cloudinary Anda tidak dapat diretas/dihapus orang lain.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                1. Cloud Name (Wajib):
              </label>
              <input
                type="text"
                value={cloudinaryCloudName}
                onChange={(e) => setCloudinaryCloudName(e.target.value)}
                placeholder="misal: demo-spv-cloud"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                2. Upload Preset - Unsigned (Wajib untuk Direct Upload):
              </label>
              <input
                type="text"
                value={cloudinaryPreset}
                onChange={(e) => setCloudinaryPreset(e.target.value)}
                placeholder="misal: spv_ba_upload_preset"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                3. API Key (Opsional / Backend Admin):
              </label>
              <input
                type="text"
                value={cloudinaryApiKey}
                onChange={(e) => setCloudinaryApiKey(e.target.value)}
                placeholder="misal: 123456789012345"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                4. API Secret Key (Opsional / Server-side Only):
              </label>
              <input
                type="password"
                value={cloudinaryApiSecret}
                onChange={(e) => setCloudinaryApiSecret(e.target.value)}
                placeholder="••••••••••••••••••••••••"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <button
            onClick={handleSaveCloudinarySettings}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
          >
            <Cloud className="w-3.5 h-3.5" />
            Simpan Kredensial Cloudinary
          </button>
        </div>
        {/* Company Portal Links Management (Supervisor) */}
        <div className="pt-4 border-t border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-600" />
                Pengaturan Tombol Portal Penting Perusahaan
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">
                Kelola tautan portal perusahaan yang muncul di portal Korlap & Officer. Tambahkan judul, deskripsi, tag badge, dan URL resmi.
              </p>
            </div>

            <button
              onClick={() => handleOpenPortalModal()}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold transition flex items-center gap-1 shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Tambah Tombol Portal</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {portals.map(p => (
              <div key={p.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 text-[9px] font-extrabold rounded">
                      {p.badge || 'Portal'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {p.category || 'General'}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs truncate">{p.title}</h4>
                  <p className="text-[11px] text-slate-500 line-clamp-2">{p.description}</p>
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-600 font-mono flex items-center gap-1 hover:underline pt-0.5">
                    <ExternalLink className="w-3 h-3" />
                    <span className="truncate">{p.url}</span>
                  </a>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleOpenPortalModal(p)}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded transition"
                    title="Edit Tombol Portal"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeletePortal(p)}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-white rounded transition"
                    title="Hapus Tombol Portal"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Add / Edit Portal Link */}
        {isPortalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
              <div className="bg-indigo-900 p-4 text-white flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  {editingPortal ? 'Edit Tombol Portal Perusahaan' : 'Tambah Tombol Portal Baru'}
                </h3>
                <button onClick={() => setIsPortalModalOpen(false)} className="text-white/80 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSavePortal} className="p-5 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Judul Portal Perusahaan <span className="text-rose-500">*</span>:
                  </label>
                  <input
                    type="text"
                    required
                    value={portalTitle}
                    onChange={(e) => setPortalTitle(e.target.value)}
                    placeholder="misal: Portal HRIS Perusahaan"
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Deskripsi / Keterangan Singkat:
                  </label>
                  <textarea
                    rows={2}
                    value={portalDesc}
                    onChange={(e) => setPortalDesc(e.target.value)}
                    placeholder="misal: Sistem absensi digital, slip gaji, dan data kepegawaian internal."
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    URL Tautan / Link Web <span className="text-rose-500">*</span>:
                  </label>
                  <input
                    type="url"
                    required
                    value={portalUrl}
                    onChange={(e) => setPortalUrl(e.target.value)}
                    placeholder="https://hris.perusahaan.com"
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Label Badge Tag:
                    </label>
                    <input
                      type="text"
                      value={portalBadge}
                      onChange={(e) => setPortalBadge(e.target.value)}
                      placeholder="HRIS & SDM"
                      className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kategori Menu:
                    </label>
                    <input
                      type="text"
                      value={portalCategory}
                      onChange={(e) => setPortalCategory(e.target.value)}
                      placeholder="SDM & HR"
                      className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPortalModalOpen(false)}
                    className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded text-xs font-bold hover:bg-slate-100"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 shadow-xs flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Tombol</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-200 space-y-3">
          <h3 className="font-bold text-slate-900 text-sm">Backup & Restore Cadangan Data</h3>
          <p className="text-slate-500">
            Unduh seluruh database 700+ toko, jadwal, dan rekapan SO sebagai file cadangan JSON, atau pulihkan data sebelumnya.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadBackup}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              Download Full Backup (JSON)
            </button>
          </div>

          <div className="mt-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Restore Data Dari JSON String:
            </label>
            <textarea
              rows={4}
              value={jsonBackup}
              onChange={(e) => setJsonBackup(e.target.value)}
              placeholder="Paste isi file JSON backup di sini..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs font-mono focus:outline-none"
            />
            <button
              onClick={handleRestoreJSON}
              className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition"
            >
              Restore Data JSON
            </button>
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Reset / Clear Data (Super Admin Only: ALL) */}
        {currentRole === 'ALL' && (
          <div className="pt-4 border-t border-rose-200 space-y-2 bg-rose-50/50 p-4 rounded-xl border">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-rose-700 text-sm flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-rose-600" />
                Reset & Bersihkan Seluruh Master Data (Super Admin Only)
              </h3>
              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-black rounded uppercase">
                Akses Super Admin Aktif
              </span>
            </div>
            <p className="text-rose-950 text-xs">
              Menghapus seluruh master data (toko, jadwal, personil, perlengkapan, seragam, hasil) secara permanen di <strong>LocalStorage, Firebase Firestore, dan Cloudinary Storage</strong> hingga 0.
            </p>
            <button
              onClick={() => {
                setResetError('');
                setResetSuccess('');
                setResetPasswordInput('');
                setResetConfirmText('');
                setIsConfirmResetOpen(true);
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Hapus & Bersihkan Seluruh Data (Super Admin)
            </button>
          </div>
        )}

      </div>

      {/* Confirmation Modal for Portal Link Deletion */}
      <ConfirmDeleteModal
        isOpen={!!portalToDelete}
        onClose={() => setPortalToDelete(null)}
        onConfirm={() => {
          if (portalToDelete) {
            const updated = portals.filter(p => p.id !== portalToDelete.id);
            savePortalsToLocalStorage(updated);
            setToastMessage(`Tombol portal "${portalToDelete.title}" berhasil dihapus!`);
            setPortalToDelete(null);
          }
        }}
        title="Hapus Tombol Portal Perusahaan"
        subtitle="Apakah Anda yakin ingin menghapus tombol portal ini?"
        itemName={portalToDelete ? portalToDelete.title : undefined}
        itemDetails={portalToDelete ? [
          { label: 'Kategori', value: portalToDelete.category || 'General' },
          { label: 'URL Tautan', value: portalToDelete.url },
          { label: 'Badge', value: portalToDelete.badge || '-' }
        ] : []}
        confirmText="Ya, Hapus Portal"
        dangerBadgeText="Tombol pintasan portal ini akan dihapus dari dashboard."
      />

      {/* Super Admin Modal for Reset All Master Data */}
      {isConfirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-rose-900 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-300" />
                <div>
                  <h3 className="font-extrabold text-sm text-white">Reset & Bersihkan Seluruh Master Data</h3>
                  <p className="text-[11px] text-rose-200">Akses Super Admin & Konfirmasi Teks Wajib</p>
                </div>
              </div>
              <button
                onClick={() => setIsConfirmResetOpen(false)}
                className="text-white/80 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSuperAdminReset} className="p-5 space-y-4 text-xs">
              
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-rose-950">
                <div className="font-bold text-rose-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-rose-600" />
                  PERINGATAN KERAS SUPER ADMIN
                </div>
                <p className="text-[11px] leading-relaxed">
                  Tindakan ini akan <strong>menghapus bersih 0</strong> seluruh data master toko, jadwal SO, personil, perlengkapan, seragam, dan hasil di <strong>LocalStorage, Firebase, dan Cloudinary Storage</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  1. Masukkan Password Super Admin (020594):
                </label>
                <input
                  type="password"
                  required
                  placeholder="Password: 020594"
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-rose-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  2. Ketik kata "ya" untuk mengonfirmasi penghapusan:
                </label>
                <input
                  type="text"
                  required
                  placeholder='Ketik "ya"'
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-rose-500 focus:bg-white"
                />
              </div>

              {resetError && (
                <div className="p-2.5 bg-rose-100 text-rose-900 rounded-lg text-xs font-bold border border-rose-300">
                  {resetError}
                </div>
              )}

              {resetSuccess && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmResetOpen(false)}
                  className="px-3.5 py-2 border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isResetting ? 'Memproses Reset...' : 'Hapus & Bersihkan Seluruh Data'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Success Toast Feedback */}
      {toastMessage && (
        <ToastNotification
          type="success"
          title="Berhasil Dihapus"
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}

    </div>
  );
};

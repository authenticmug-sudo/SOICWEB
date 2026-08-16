import React, { useState } from 'react';
import { X, Cloud, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Info } from 'lucide-react';
import { getCloudinaryConfig, saveCloudinaryConfig, testCloudinaryConnection } from '../../services/cloudinaryService';

interface CloudinaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudinaryModal: React.FC<CloudinaryModalProps> = ({ isOpen, onClose }) => {
  const current = getCloudinaryConfig();
  
  const [cloudName, setCloudName] = useState(current.cloudName);
  const [uploadPreset, setUploadPreset] = useState(current.uploadPreset);
  const [apiKey, setApiKey] = useState(current.apiKey);
  const [apiSecret, setApiSecret] = useState(current.apiSecret);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Test Connection State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    url?: string;
    error?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    // Save temporarily first
    saveCloudinaryConfig(cloudName, uploadPreset, apiKey, apiSecret);

    const res = await testCloudinaryConnection(cloudName, uploadPreset);
    setTestResult(res);
    setIsTesting(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveCloudinaryConfig(cloudName, uploadPreset, apiKey, apiSecret);
    setSuccessMsg('Kredensial & Akses Cloudinary Berhasil Disimpan!');
    setTimeout(() => {
      setSuccessMsg('');
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-xl">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm leading-tight">Pengaturan Akses Cloudinary Storage</h3>
              <p className="text-[11px] text-indigo-200">Sinkronkan Cloud ID & Upload Preset untuk Backup CSV/Excel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs overflow-y-auto">
          
          <div className="bg-indigo-50/80 border border-indigo-200 p-3 rounded-xl space-y-1">
            <span className="font-bold text-indigo-950 flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
              Upload CDN Otomatis & Backup Cloud
            </span>
            <p className="text-[11px] text-indigo-900 leading-relaxed">
              Data Cloudinary digunakan untuk mengunggah foto personel, bukti SO, serta mengamankan backup otomatis file CSV/Excel ke folder <span className="font-bold">SO Sistem IC BALI</span>.
            </p>
          </div>

          <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Cloud Name (ID Cloud) *
              </label>
              <input
                type="text"
                required
                value={cloudName}
                onChange={(e) => setCloudName(e.target.value)}
                placeholder="misal: demo-spv-cloud atau dxy12345"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-xs focus:outline-none focus:border-indigo-600 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Upload Preset (Wajib Mode "Unsigned") *
              </label>
              <input
                type="text"
                required
                value={uploadPreset}
                onChange={(e) => setUploadPreset(e.target.value)}
                placeholder="misal: ml_default atau super_so_preset"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-xs focus:outline-none focus:border-indigo-600 font-bold text-indigo-700"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Default: <code className="bg-slate-200 px-1 rounded text-slate-800">ml_default</code> (Pastikan diatur ke mode <strong>Unsigned</strong> di Cloudinary Console)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  API Key (Opsional)
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="123456789012345"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-xs focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Secret Key (Opsional)
                </label>
                <input
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-xs focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>
          </div>

          {/* Guide Tips Box */}
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1.5 text-[11px] text-amber-900">
            <span className="font-extrabold flex items-center gap-1.5 text-amber-950">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              Petunjuk Mengapa File CSV/Excel Belum Muncul di Cloudinary:
            </span>
            <ul className="list-disc pl-4 space-y-1 text-amber-800 leading-snug">
              <li>
                <strong>Upload Preset Wajib "Unsigned"</strong>: Di Cloudinary Dashboard -&gt; <em>Settings (Gerigi) -&gt; Upload -&gt; Upload presets</em>, ubah Signing Mode preset Anda dari <strong>Signed</strong> menjadi <strong>Unsigned</strong>.
              </li>
              <li>
                <strong>Kategori File "RAW"</strong>: File CSV &amp; Excel masuk kategori <strong className="font-mono">RAW</strong>. Di Cloudinary Media Library, pastikan mengubah filter dari <em>Images</em> menjadi <strong>Raw / Files</strong> atau buka folder <span className="font-bold">SO Sistem IC BALI / csv_backups</span>.
              </li>
            </ul>
          </div>

          {/* Test Connection Button & Result */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !cloudName || !uploadPreset}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Menguji Unggah File Uji Coba ke Cloudinary...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4 text-indigo-400" />
                  <span>⚡ Tes Koneksi & Unggah File Uji Coba Sekarang</span>
                </>
              )}
            </button>

            {testResult && (
              <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                testResult.success 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}>
                {testResult.success ? (
                  <div>
                    <span className="font-black text-emerald-700 flex items-center gap-1 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Koneksi Cloudinary Berhasil! (Koneksi &amp; Preset Siap Digunakan)
                    </span>
                    <p className="text-[11px] text-emerald-800 mt-1">
                      File tes berhasil diunggah ke folder <span className="font-bold font-mono">SO Sistem IC BALI/test_connection</span>.
                    </p>
                    {testResult.url && (
                      <a
                        href={testResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 underline mt-1 bg-white px-2 py-1 rounded border border-emerald-200"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Buka File Uji Coba di Cloudinary
                      </a>
                    )}
                  </div>
                ) : (
                  <div>
                    <span className="font-black text-rose-700 flex items-center gap-1 text-xs">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      Gagal Terhubung ke Cloudinary
                    </span>
                    <p className="text-[11px] text-rose-900 mt-1 font-mono bg-white p-2 rounded border border-rose-200">
                      {testResult.error}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">{successMsg}</span>
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <Cloud className="w-4 h-4" />
              Simpan Setting Cloudinary
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

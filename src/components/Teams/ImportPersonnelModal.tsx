import React, { useState } from 'react';
import { X, FileSpreadsheet, Download, Upload, CheckCircle2, AlertCircle, Users, Cloud, ExternalLink } from 'lucide-react';
import * as XLSX from 'xlsx';
import { AuditorPersonnel, AuditorPersonnelRole, SOTeam, PersonnelStatus } from '../../types/stockOpname';
import { 
  backupExcelFileToCloudinaryAndFirestore, 
  getFormattedDateSuffix,
  getDeterministicPersonnelId,
  deduplicateEntityList
} from '../../services/storageService';
import { formatDateISO } from '../../utils/formatters';

interface ImportPersonnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: SOTeam[];
  onImportPersonnel: (imported: AuditorPersonnel[], mode: 'replace' | 'merge') => void;
}

export const ImportPersonnelModal: React.FC<ImportPersonnelModalProps> = ({
  isOpen,
  onClose,
  teams,
  onImportPersonnel
}) => {
  const [activeTab, setActiveTab] = useState<'excel' | 'copas'>('excel');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [file, setFile] = useState<File | null>(null);
  const [parsedPersonnel, setParsedPersonnel] = useState<AuditorPersonnel[]>([]);
  const [csvText, setCsvText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [cloudinaryUrl, setCloudinaryUrl] = useState<string | null>(null);
  const [isUploadingToCloudinary, setIsUploadingToCloudinary] = useState(false);

  if (!isOpen) return null;

  // Download Excel Template for Personnel
  const handleDownloadTemplate = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const templateData = [
      {
        'NO': 1,
        'NIK': '2013217571',
        'NAMA PERSONIL': 'I GEDE PASEK SANTIKA',
        'KORLAP/OFFICER': 'I GEDE PASEK SANTIKA',
        'TANGGAL MASUK BEKERJA': '13-Dec-16',
        'LAMA BEKERJA': '',
        'NOMOR HP': '',
        'DOMISILI': ''
      },
      {
        'NO': 2,
        'NIK': '2015082091',
        'NAMA PERSONIL': 'AGUNG DWI SETIAWAN',
        'KORLAP/OFFICER': 'I GEDE PASEK SANTIKA',
        'TANGGAL MASUK BEKERJA': '10-Aug-18',
        'LAMA BEKERJA': '',
        'NOMOR HP': '',
        'DOMISILI': ''
      },
      {
        'NO': 3,
        'NIK': '2015458087',
        'NAMA PERSONIL': 'M LUTFILAH',
        'KORLAP/OFFICER': 'I GEDE PASEK SANTIKA',
        'TANGGAL MASUK BEKERJA': '26-May-23',
        'LAMA BEKERJA': '',
        'NOMOR HP': '',
        'DOMISILI': ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DATA_PERSONIL_SO');
    XLSX.writeFile(workbook, `DATA_PERSONIL_SO_TEMPLATE_${getFormattedDateSuffix()}.xlsx`);
  };

  const parseExcelDateString = (rawVal: any): string => {
    if (!rawVal) return new Date().toISOString().split('T')[0];
    return formatDateISO(rawVal);
  };

  const processRowsToPersonnel = (rows: Record<string, any>[]): AuditorPersonnel[] => {
    return rows.map((row, idx) => {
      const getVal = (keys: string[], defaultVal = '') => {
        const foundKey = Object.keys(row).find(k => 
          keys.includes(k.toLowerCase().trim().replace(/_/g, '').replace(/\//g, '').replace(/\s+/g, ''))
        );
        return foundKey && row[foundKey] !== undefined && row[foundKey] !== null ? String(row[foundKey]).trim() : defaultVal;
      };

      const nik = getVal(['nik', 'nikpersonel', 'nikauditor', 'id'], `NIK-${Date.now()}-${idx + 1}`);
      const name = getVal(['namapersonil', 'nama', 'namalengkap', 'name', 'auditor'], `Auditor Field ${idx + 1}`);
      const korlapName = getVal(['korlapofficer', 'korlap', 'officer', 'spv', 'korlap/officer', 'koordinator'], name);
      
      // CRITICAL FIX: Default to EMPTY STRING '' when blank in Excel (Do NOT auto-fill phone or domisili)
      const domisili = getVal(['domisili', 'kota', 'kabupaten', 'alamat'], '');
      const phone = getVal(['nomorhp', 'nohp', 'phone', 'notelp', 'hp', 'telepon'], '');
      
      let rawRole = getVal(['jabatan', 'role', 'posisi'], '');
      let role: AuditorPersonnelRole = 'Anggota';
      if (rawRole.toLowerCase().includes('korlap') || rawRole.toLowerCase().includes('officer') || rawRole.toLowerCase().includes('spv')) {
        role = 'Officer / Korlap';
      } else if (rawRole.toLowerCase().includes('koordinat')) {
        role = 'Koordinator';
      } else if (name === korlapName) {
        role = 'Officer / Korlap';
      }

      const rawDate = getVal(['tanggalmasukbekerja', 'tanggalmasuk', 'tglmasuk', 'joindate', 'tanggal'], '');
      const joinDate = parseExcelDateString(rawDate || row['TANGGAL MASUK BEKERJA'] || row['Tanggal Masuk Bekerja']);
      
      let rawStatus = getVal(['status', 'stat'], 'Aktif');
      let status: PersonnelStatus = 'Aktif';
      if (rawStatus.toLowerCase().includes('sakit')) status = 'Sakit';
      else if (rawStatus.toLowerCase().includes('cuti')) status = 'Cuti';
      else if (rawStatus.toLowerCase().includes('non') || rawStatus.toLowerCase().includes('pasif')) status = 'Non-Aktif';

      const teamNameInput = getVal(['timso', 'tim', 'team'], '');
      let matchedTeam = teams.find(t => t.name.toLowerCase().includes(teamNameInput.toLowerCase()));

      const photoUrl = getVal(['fotocloudinary', 'foto', 'photourl', 'cloudinary'], '');

      const deterministicId = getDeterministicPersonnelId({ nik, name });

      return {
        id: deterministicId,
        nik,
        name,
        korlapName,
        domisili,
        phone,
        role,
        joinDate,
        status,
        teamId: matchedTeam?.id,
        teamName: matchedTeam?.name || (teamNameInput || undefined),
        photoUrl: photoUrl || undefined
      };
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setErrorMsg('');
    setCloudinaryUrl(null);
    setIsUploadingToCloudinary(true);

    // Backup uploaded raw Excel file directly to Cloudinary (folder: Super SO/excel_backups) & Firestore
    backupExcelFileToCloudinaryAndFirestore(uploadedFile, 'DATA_PERSONIL_SO')
      .then((cUrl) => {
        setCloudinaryUrl(cUrl);
        setIsUploadingToCloudinary(false);
      })
      .catch(() => {
        setIsUploadingToCloudinary(false);
      });

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        if (data.length === 0) {
          setErrorMsg('File Excel tidak berisi data.');
          return;
        }

        const items = processRowsToPersonnel(data);
        const { deduplicated } = deduplicateEntityList('personnel', items);
        setParsedPersonnel(deduplicated);
      } catch (err: any) {
        setErrorMsg('Gagal membaca file Excel. Pastikan format file .xlsx atau .xls valid.');
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const handleProcessImport = () => {
    let listToImport: AuditorPersonnel[] = [];

    if (activeTab === 'excel') {
      listToImport = parsedPersonnel;
    } else {
      if (!csvText.trim()) return;
      try {
        const wb = XLSX.read(csvText, { type: 'string' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
        if (data && data.length > 0) {
          listToImport = processRowsToPersonnel(data);
        }
      } catch {
        // Fallback plain split
        const lines = csvText.trim().split('\n');
        const startIndex = lines[0].toLowerCase().includes('nik') ? 1 : 0;
        for (let i = startIndex; i < lines.length; i++) {
          const parts = lines[i].includes('\t') ? lines[i].split('\t') : lines[i].split(',');
          if (parts.length >= 2) {
            const nik = parts[0]?.trim() || '';
            const name = parts[1]?.trim() || `Auditor ${i}`;
            listToImport.push({
              id: getDeterministicPersonnelId({ nik, name }),
              nik,
              name,
              phone: parts[2]?.trim() || '',
              role: parts[3]?.toLowerCase().includes('korlap') ? 'Officer / Korlap' : 'Anggota',
              joinDate: new Date().toISOString().split('T')[0],
              status: 'Aktif'
            });
          }
        }
      }
    }

    if (listToImport.length === 0) {
      alert('Tidak ada data personel yang valid untuk di-import.');
      return;
    }

    const { deduplicated: cleanList } = deduplicateEntityList('personnel', listToImport);
    onImportPersonnel(cleanList, importMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Import Database Personel Auditor SO</h3>
              <p className="text-slate-400 text-xs">Upload file Excel (.xlsx) atau copas tabel data tim auditor</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Mode Import Option */}
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 text-xs">
            <span className="font-bold text-amber-950 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              Pilih Mode Import Database (Mencegah Akumulasi Ganda)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                onClick={() => setImportMode('replace')}
                className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2 transition ${
                  importMode === 'replace'
                    ? 'bg-white border-indigo-600 shadow-xs ring-1 ring-indigo-500'
                    : 'bg-amber-50/50 border-amber-200 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="mt-0.5 text-indigo-600"
                />
                <div>
                  <p className="font-bold text-indigo-950 text-xs">Ganti Total / Replace (Rekomendasi)</p>
                  <p className="text-[10px] text-slate-600 leading-tight">
                    Mengganti seluruh data lama dengan file master baru (Mencegah akumulasi ganda)
                  </p>
                </div>
              </label>

              <label
                onClick={() => setImportMode('merge')}
                className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2 transition ${
                  importMode === 'merge'
                    ? 'bg-white border-indigo-600 shadow-xs ring-1 ring-indigo-500'
                    : 'bg-amber-50/50 border-amber-200 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                  className="mt-0.5 text-indigo-600"
                />
                <div>
                  <p className="font-bold text-slate-900 text-xs">Gabung / Update (Merge)</p>
                  <p className="text-[10px] text-slate-600 leading-tight">
                    Memperbarui berdasarkan NIK & menambah personel baru tanpa menghapus data lama
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Download Template Banner */}
          <div className="bg-indigo-50/80 border border-indigo-200 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <p className="font-bold text-indigo-950">Sediakan Format Isian Tabel Excel</p>
                <p className="text-indigo-800 text-[11px]">Gunakan format kolom yang seragam (NIK, NAMA LENGKAP, NOMOR HP, JABATAN, STATUS, dll.)</p>
              </div>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shrink-0 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Template</span>
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveTab('excel')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                activeTab === 'excel' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload File Excel (.xlsx)</span>
            </button>
            <button
              onClick={() => setActiveTab('copas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                activeTab === 'copas' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Copas Tabel / CSV</span>
            </button>
          </div>

          {activeTab === 'excel' ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-6 text-center bg-slate-50 transition cursor-pointer relative">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">
                  {file ? file.name : 'Klik atau Drag & Drop file Excel Personel ke sini'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Mendukung format .xlsx dan .xls</p>
              </div>

              {file && (
                <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <Cloud className={`w-5 h-5 shrink-0 ${isUploadingToCloudinary ? 'text-indigo-500 animate-pulse' : 'text-indigo-600'}`} />
                    <div>
                      <span className="font-bold text-indigo-950 block">Cloudinary Backup & Storage (Folder: Super SO/excel_backups)</span>
                      <p className="text-[11px] text-indigo-800">
                        {isUploadingToCloudinary ? (
                          <span>Mengunggah file Excel Master ke Cloudinary...</span>
                        ) : cloudinaryUrl ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            File Excel Master ter-upload & ter-backup di Cloudinary CDN!
                          </span>
                        ) : (
                          <span>File Excel siap di-backup ke Cloudinary & Firestore.</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {cloudinaryUrl && (
                    <a
                      href={cloudinaryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg flex items-center gap-1 shrink-0 transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Buka Cloudinary</span>
                    </a>
                  )}
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {parsedPersonnel.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">Preview Data Terbaca ({parsedPersonnel.length} Personel):</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Siap Di-import
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                        <tr>
                          <th className="p-2">NIK</th>
                          <th className="p-2">Nama</th>
                          <th className="p-2">HP</th>
                          <th className="p-2">Jabatan</th>
                          <th className="p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedPersonnel.map((p, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2 font-mono font-semibold text-slate-800">{p.nik}</td>
                            <td className="p-2 font-medium text-slate-900">{p.name}</td>
                            <td className="p-2 text-slate-600">{p.phone}</td>
                            <td className="p-2 font-semibold text-indigo-600">{p.role}</td>
                            <td className="p-2 text-slate-600">{p.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">Paste Text CSV / Excel Cell:</label>
                <button
                  onClick={() => setCsvText(`NIK, NAMA LENGKAP, NOMOR HP, JABATAN
NIK-801, I Wayan Gede Audit, 08123456789, Officer / Korlap
NIK-802, I Made Suardana, 081299887766, Anggota`)}
                  className="text-indigo-600 hover:underline text-[11px] font-semibold"
                >
                  Contoh Format
                </button>
              </div>
              <textarea
                rows={6}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="Paste baris data dari Excel di sini..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 transition"
          >
            Batal
          </button>
          <button
            onClick={handleProcessImport}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Simpan & Import Database Personel</span>
          </button>
        </div>
      </div>
    </div>
  );
};

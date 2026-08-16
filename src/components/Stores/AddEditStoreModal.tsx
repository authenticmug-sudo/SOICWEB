import React, { useState, useEffect } from 'react';
import { X, Building2, MapPin, Phone, User, ShieldAlert } from 'lucide-react';
import { Store, RegionArea, StoreType } from '../../types/stockOpname';
import { REGIONS } from '../../data/initialData';
import { parseCoordinates } from '../../utils/geoUtils';

interface AddEditStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingStore: Store | null;
  onSaveStore: (store: Store) => void;
}

export const AddEditStoreModal: React.FC<AddEditStoreModalProps> = ({
  isOpen,
  onClose,
  editingStore,
  onSaveStore
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [region, setRegion] = useState<RegionArea>(REGIONS[0]);
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [storeType, setStoreType] = useState<StoreType>('Regular Minimarket');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [totalSKUCount, setTotalSKUCount] = useState<number>(5000);
  const [riskLevel, setRiskLevel] = useState<'Tinggi' | 'Sedang' | 'Rendah'>('Rendah');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [koordinatRaw, setKoordinatRaw] = useState<string>('');

  useEffect(() => {
    if (editingStore) {
      setCode(editingStore.code);
      setName(editingStore.name);
      setRegion(editingStore.region);
      setCity(editingStore.city);
      setAddress(editingStore.address);
      setStoreType(editingStore.storeType);
      setManagerName(editingStore.managerName);
      setPhone(editingStore.phone);
      setTotalSKUCount(editingStore.totalSKUCount);
      setRiskLevel(editingStore.riskLevel);
      setLatitude(editingStore.latitude ? String(editingStore.latitude) : '');
      setLongitude(editingStore.longitude ? String(editingStore.longitude) : '');
      setKoordinatRaw(editingStore.koordinat || (editingStore.latitude && editingStore.longitude ? `${editingStore.latitude}, ${editingStore.longitude}` : ''));
    } else {
      setCode(`T-${Math.floor(1000 + Math.random() * 9000)}`);
      setName('');
      setRegion(REGIONS[0]);
      setCity('');
      setAddress('');
      setStoreType('Regular Minimarket');
      setManagerName('');
      setPhone('08123456789');
      setTotalSKUCount(5000);
      setRiskLevel('Rendah');
      setLatitude('-8.6705');
      setLongitude('115.2126');
      setKoordinatRaw('S8 40 13.8 E115 12 45.4');
    }
  }, [editingStore, isOpen]);

  const handleRawCoordChange = (val: string) => {
    setKoordinatRaw(val);
    if (val.trim()) {
      const parsed = parseCoordinates(val);
      if (parsed.isValid && parsed.latitude !== undefined && parsed.longitude !== undefined) {
        setLatitude(String(parsed.latitude));
        setLongitude(String(parsed.longitude));
      }
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseCoordinates(koordinatRaw || `${latitude}, ${longitude}`);
    
    const finalLat = parsed.isValid && parsed.latitude !== undefined ? parsed.latitude : (latitude ? Number(latitude) : undefined);
    const finalLng = parsed.isValid && parsed.longitude !== undefined ? parsed.longitude : (longitude ? Number(longitude) : undefined);

    const newOrUpdatedStore: Store = {
      id: editingStore ? editingStore.id : `STORE-${Date.now()}`,
      code,
      name,
      region,
      city,
      address,
      latitude: finalLat,
      longitude: finalLng,
      koordinat: koordinatRaw || (finalLat && finalLng ? `${finalLat}, ${finalLng}` : undefined),
      storeType,
      managerName,
      phone,
      totalSKUCount,
      riskLevel,
      lastAccuracyRate: editingStore ? editingStore.lastAccuracyRate : 98.5,
      lastSODate: editingStore ? editingStore.lastSODate : undefined
    };

    onSaveStore(newOrUpdatedStore);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm">
              {editingStore ? 'Edit Data Toko' : 'Tambah Toko Baru (Master Toko)'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kode Toko
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Toko
              </label>
              <input
                type="text"
                placeholder="Contoh: Toko Express Sudirman"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Wilayah / Area Regional
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as RegionArea)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs"
              >
                {REGIONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kota / Sub-distrik
              </label>
              <input
                type="text"
                placeholder="Contoh: Jakarta Selatan"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Alamat Lengkap Toko
            </label>
            <input
              type="text"
              placeholder="Jl. Jend. Sudirman No. 123"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs"
            />
          </div>

          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  📍 Input / Copy-Paste Koordinat (DMS, Google Maps, or DD)
                </label>
                <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                  Auto-Convert
                </span>
              </div>
              <input
                type="text"
                placeholder='Contoh: S8 45 27.3 E115 10 36.1, 8°41&apos;18.55"S 115°14&apos;17.47"E, atau -8.6705, 115.2126'
                value={koordinatRaw}
                onChange={(e) => handleRawCoordChange(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Format DMS (S8° 45&apos; 27&quot; E115° 10&apos; 36&quot;) akan otomatis dikonversi ke Latitude & Longitude desimal yang presisi.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/80">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  Latitude (Auto-Calculated)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: -8.6705"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-semibold text-slate-700"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  Longitude (Auto-Calculated)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 115.2126"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-semibold text-slate-700"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipe Operasional Toko
              </label>
              <select
                value={storeType}
                onChange={(e) => setStoreType(e.target.value as StoreType)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs"
              >
                <option value="Regular Minimarket">Regular Minimarket</option>
                <option value="Flagship Supermarket">Flagship Supermarket</option>
                <option value="Express Outlet">Express Outlet</option>
                <option value="Distribution Hub Center">Distribution Hub Center</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tingkat Risiko Shrinkage
              </label>
              <select
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs"
              >
                <option value="Rendah">Rendah (Akurasi Tinggi)</option>
                <option value="Sedang">Sedang (Standar)</option>
                <option value="Tinggi">Tinggi (Perlu Frequent Audit)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Kepala Toko
              </label>
              <input
                type="text"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Total SKU Barang
              </label>
              <input
                type="number"
                value={totalSKUCount}
                onChange={(e) => setTotalSKUCount(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-mono"
                required
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-sm"
            >
              {editingStore ? 'Simpan Perubahan' : 'Tambah Toko Baru'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

/**
 * Cloudinary direct client-side upload helper using Unsigned Upload Preset
 */

import { db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  format: string;
  width?: number;
  height?: number;
}

export function getCloudinaryConfig() {
  const metaEnv = (import.meta as any).env || {};
  const cloudName = (localStorage.getItem('spv_cloudinary_cloud_name') || metaEnv.VITE_CLOUDINARY_CLOUD_NAME || '').trim();
  let uploadPreset = (localStorage.getItem('spv_cloudinary_preset') || metaEnv.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim();
  const apiKey = (localStorage.getItem('spv_cloudinary_api_key') || metaEnv.VITE_CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (localStorage.getItem('spv_cloudinary_api_secret') || metaEnv.VITE_CLOUDINARY_API_SECRET || '').trim();
  
  if (cloudName && !uploadPreset) {
    uploadPreset = 'ml_default'; // fallback default unsigned upload preset
  }

  return { cloudName, uploadPreset, apiKey, apiSecret };
}

export async function syncCloudinaryConfigToFirestore(config: { cloudName: string; uploadPreset: string; apiKey?: string; apiSecret?: string }) {
  try {
    const cn = (config.cloudName || '').trim();
    const up = (config.uploadPreset || '').trim();
    if (!cn) return;
    await setDoc(doc(db, 'settings', 'cloudinary_config'), {
      cloudName: cn,
      uploadPreset: up || 'ml_default',
      apiKey: (config.apiKey || '').trim(),
      apiSecret: (config.apiSecret || '').trim(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Sync Cloudinary config to Firestore error:', err);
  }
}

export async function syncCloudinaryConfigFromFirestore(): Promise<{ cloudName: string; uploadPreset: string; apiKey: string; apiSecret: string } | null> {
  try {
    const docSnap = await getDoc(doc(db, 'settings', 'cloudinary_config'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && data.cloudName) {
        const cn = String(data.cloudName).trim();
        const up = String(data.uploadPreset || 'ml_default').trim();
        const ak = String(data.apiKey || '').trim();
        const as = String(data.apiSecret || '').trim();
        localStorage.setItem('spv_cloudinary_cloud_name', cn);
        localStorage.setItem('spv_cloudinary_preset', up);
        localStorage.setItem('spv_cloudinary_api_key', ak);
        localStorage.setItem('spv_cloudinary_api_secret', as);
        return {
          cloudName: cn,
          uploadPreset: up,
          apiKey: ak,
          apiSecret: as
        };
      }
    }
  } catch (err) {
    console.warn('Sync Cloudinary config from Firestore notice:', err);
  }
  return null;
}

export function saveCloudinaryConfig(cloudName: string, uploadPreset: string, apiKey: string, apiSecret: string) {
  const cn = cloudName.trim();
  const up = uploadPreset.trim();
  const ak = apiKey.trim();
  const as = apiSecret.trim();

  localStorage.setItem('spv_cloudinary_cloud_name', cn);
  localStorage.setItem('spv_cloudinary_preset', up);
  localStorage.setItem('spv_cloudinary_api_key', ak);
  localStorage.setItem('spv_cloudinary_api_secret', as);

  syncCloudinaryConfigToFirestore({ cloudName: cn, uploadPreset: up, apiKey: ak, apiSecret: as }).catch(() => {});
}

export function getFormattedDateSuffix(d = new Date()): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}_${month}_${year}`;
}

export async function uploadToCloudinary(
  fileOrBase64: File | string, 
  folder = 'SO Sistem IC BALI',
  resourceType: 'image' | 'raw' | 'auto' = 'auto',
  customPublicId?: string,
  _overwrite = true
): Promise<string> {
  let { cloudName, uploadPreset } = getCloudinaryConfig();

  if (!cloudName || !uploadPreset) {
    const synced = await syncCloudinaryConfigFromFirestore();
    if (synced && synced.cloudName) {
      cloudName = synced.cloudName.trim();
      uploadPreset = (synced.uploadPreset || 'ml_default').trim();
    }
  }

  // Guarantee that all uploads are stored inside folder "SO Sistem IC BALI" on Cloudinary
  let targetFolder = folder ? folder.trim() : 'SO Sistem IC BALI';
  if (!targetFolder.startsWith('SO Sistem IC BALI')) {
    targetFolder = `SO Sistem IC BALI/${targetFolder}`;
  }

  if (!cloudName) {
    throw new Error('Cloud Name Cloudinary belum diatur. Silakan atur Cloud Name di menu Pengaturan Akses Cloudinary.');
  }

  if (!uploadPreset) {
    uploadPreset = 'ml_default';
  }

  const formData = new FormData();
  formData.append('file', fileOrBase64);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', targetFolder);

  if (customPublicId) {
    const cleanPublicId = customPublicId.replace(/[^a-zA-Z0-9_.-]/g, '_');
    formData.append('public_id', cleanPublicId);
  }

  // Determine correct endpoint: non-image files (Excel, CSV, JSON, PDF) MUST use 'raw'
  let endpointType = resourceType;
  if (endpointType === 'auto') {
    if (fileOrBase64 instanceof File) {
      const fileName = fileOrBase64.name.toLowerCase();
      if (fileOrBase64.type.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|webp|gif|svg)$/)) {
        endpointType = 'image';
      } else {
        endpointType = 'raw';
      }
    } else if (typeof fileOrBase64 === 'string') {
      if (fileOrBase64.startsWith('data:image/')) {
        endpointType = 'image';
      } else {
        endpointType = 'raw';
      }
    } else {
      endpointType = 'raw';
    }
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${endpointType}/upload`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errMsg = errorData.error?.message || `HTTP ${response.status}: Gagal mengunggah file ke Cloudinary.`;
    
    // If auto failed on raw, try raw endpoint fallback
    if (endpointType !== 'raw' && (fileOrBase64 instanceof File || typeof fileOrBase64 === 'string')) {
      try {
        const rawRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
          method: 'POST',
          body: formData
        });
        if (rawRes.ok) {
          const rawData: CloudinaryUploadResult = await rawRes.json();
          return rawData.secure_url;
        }
      } catch {}
    }

    if (errMsg.toLowerCase().includes('preset')) {
      throw new Error(`Upload Preset Error: ${errMsg}. Pastikan Upload Preset di Cloudinary diset ke mode "Unsigned".`);
    }
    throw new Error(`Cloudinary Upload Error: ${errMsg}`);
  }

  const data: CloudinaryUploadResult = await response.json();
  return data.secure_url;
}

/**
 * Upload raw JSON object to Cloudinary storage for auto backup using a single fixed file per category.
 * Each master dataset (e.g. Master_Alat, Master_Personil, Backup_Seragam) overwrites its single primary file.
 */
export async function uploadRawJsonToCloudinary(
  dataObj: any, 
  category = 'Backup_JSON',
  folderSubpath = 'SO Sistem IC BALI/Backup_JSON',
  allowEmpty = false
): Promise<{ secure_url: string }> {
  try {
    let { cloudName, uploadPreset } = getCloudinaryConfig();
    if (!cloudName || !uploadPreset) {
      const synced = await syncCloudinaryConfigFromFirestore();
      if (synced) {
        cloudName = synced.cloudName;
        uploadPreset = synced.uploadPreset;
      }
    }
    if (!cloudName || !uploadPreset) {
      // Cloudinary not configured yet, skip auto backup cleanly
      return { secure_url: '' };
    }

    const cleanCategory = category
      .replace(/\.json$/i, '')
      .replace(/_\d{4}_\d{2}_\d{2}$/, '')
      .replace(/_latest$/i, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // Safety Guard: NEVER upload empty arrays UNLESS explicitly allowed (e.g. Super Admin Reset)
    if (!allowEmpty && (!dataObj || (Array.isArray(dataObj) && dataObj.length === 0))) {
      console.warn(`[Cloudinary Sync Guard] Skipped uploading empty dataset to Cloudinary for category: ${cleanCategory}`);
      return { secure_url: '' };
    }

    // Single fixed public_id per master category with .json extension for raw files
    const singlePublicId = `${cleanCategory}.json`;
    const filename = `${cleanCategory}.json`;

    const jsonStr = JSON.stringify(dataObj || [], null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const file = new File([blob], filename, { type: 'application/json' });
    
    // Upload/Overwrite single fixed file on Cloudinary
    const url = await uploadToCloudinary(file, folderSubpath, 'raw', singlePublicId, true);
    if (url) {
      localStorage.setItem(`spv_cloudinary_latest_url_${cleanCategory}`, url);
    }

    return { secure_url: url };
  } catch (err: any) {
    console.warn('Cloudinary JSON auto-backup info:', err?.message || err);
    return { secure_url: '' };
  }
}

/**
 * Fetch raw JSON backup from Cloudinary CDN to sync data across devices
 */
export async function fetchCloudinaryJsonBackup<T = any>(
  category: string,
  folderSubpath = 'SO Sistem IC BALI/Backup_JSON'
): Promise<T[] | null> {
  try {
    let { cloudName } = getCloudinaryConfig();
    if (!cloudName) {
      const synced = await syncCloudinaryConfigFromFirestore();
      if (synced && synced.cloudName) {
        cloudName = synced.cloudName;
      }
    }

    const cleanCategory = category
      .replace(/\.json$/i, '')
      .replace(/_\d{4}_\d{2}_\d{2}$/, '')
      .replace(/_latest$/i, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    
    const urlsToTry: string[] = [];

    // 1. Try saved URL from localStorage
    const savedUrl = localStorage.getItem(`spv_cloudinary_latest_url_${cleanCategory}`);
    if (savedUrl) {
      urlsToTry.push(savedUrl.includes('?') ? `${savedUrl}&t=${Date.now()}` : `${savedUrl}?t=${Date.now()}`);
    }

    if (cloudName) {
      let targetFolder = folderSubpath ? folderSubpath.trim() : 'SO Sistem IC BALI';
      if (!targetFolder.startsWith('SO Sistem IC BALI')) {
        targetFolder = `SO Sistem IC BALI/${targetFolder}`;
      }

      const encodedFolder1 = targetFolder.split('/').map(part => encodeURIComponent(part)).join('/');
      const encodedFolder2 = targetFolder.replace(/ /g, '_');
      
      // 2. Primary fixed file URLs
      urlsToTry.push(`https://res.cloudinary.com/${cloudName}/raw/upload/${encodedFolder1}/${cleanCategory}.json?t=${Date.now()}`);
      urlsToTry.push(`https://res.cloudinary.com/${cloudName}/raw/upload/${encodedFolder1}/${cleanCategory}?t=${Date.now()}`);
      if (encodedFolder2 !== encodedFolder1) {
        urlsToTry.push(`https://res.cloudinary.com/${cloudName}/raw/upload/${encodedFolder2}/${cleanCategory}.json?t=${Date.now()}`);
        urlsToTry.push(`https://res.cloudinary.com/${cloudName}/raw/upload/${encodedFolder2}/${cleanCategory}?t=${Date.now()}`);
      }

      // 3. Legacy _latest fallback
      urlsToTry.push(`https://res.cloudinary.com/${cloudName}/raw/upload/${encodedFolder1}/${cleanCategory}_latest.json?t=${Date.now()}`);
      
      // 4. Legacy date-suffixed fallback
      urlsToTry.push(`https://res.cloudinary.com/${cloudName}/raw/upload/${encodedFolder1}/${cleanCategory}_${getFormattedDateSuffix()}.json?t=${Date.now()}`);
    }

    for (const url of urlsToTry) {
      try {
        const fetchUrl = url.includes('?') ? `${url}&v=${Math.random()}` : `${url}?v=${Math.random()}`;
        const response = await fetch(fetchUrl, { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) return data as T[];
          if (data && Array.isArray(data.records)) return data.records as T[];
          if (data && Array.isArray(data.items)) return data.items as T[];
        }
      } catch {}
    }
  } catch (err) {
    console.warn(`Fetch Cloudinary backup error for ${category}:`, err);
  }
  return null;
}

/**
 * Diagnostic test function to verify Cloudinary connection & unsigned preset permissions
 */
export async function testCloudinaryConnection(
  cloudNameInput?: string, 
  uploadPresetInput?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const current = getCloudinaryConfig();
  const cloudName = (cloudNameInput || current.cloudName).trim();
  const uploadPreset = (uploadPresetInput || current.uploadPreset).trim();

  if (!cloudName) {
    return { success: false, error: 'Cloud Name belum diisi.' };
  }
  if (!uploadPreset) {
    return { success: false, error: 'Upload Preset belum diisi.' };
  }

  try {
    const testBlob = new Blob([`Test Backup File SO Sistem IC BALI - ${new Date().toISOString()}`], { type: 'text/plain' });
    const testFile = new File([testBlob], `test_sync_${Date.now()}.txt`, { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', testFile);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', 'SO Sistem IC BALI/test_connection');

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData.error?.message || `HTTP ${response.status}: Failed to upload`;
      return { success: false, error: msg };
    }

    const data = await response.json();
    return { success: true, url: data.secure_url };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal terhubung ke Cloudinary' };
  }
}

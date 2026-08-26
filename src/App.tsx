import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  ClipboardCheck, 
  Store as StoreIcon, 
  Menu,
  Sparkles
} from 'lucide-react';
import { 
  getStoredStores, 
  saveStores, 
  getStoredSchedules, 
  saveSchedules, 
  getStoredResults, 
  saveResults, 
  getStoredTeams, 
  getStoredPersonnel,
  savePersonnel,
  getStoredEquipment,
  saveEquipment,
  getStoredRepairLogs,
  saveRepairLogs,
  getStoredMasterTokoDatasets,
  saveMasterTokoDatasets,
  getStoredOnCallPersonnel,
  saveOnCallPersonnel,
  clearAllData,
  exportToCSV,
  syncAllDataFromCloudinary,
  syncAllDataFromFirestore,
  subscribeFirestoreData,
  clearAllDeletedIds,
  recordDeletedId,
  trackDeletedId,
  getDeterministicScheduleId,
  deleteScheduleFromFirestore,
  deleteStoreFromFirestore,
  deletePersonnelFromFirestore,
  deleteEquipmentFromFirestore,
  deleteRepairLogFromFirestore,
  STORAGE_KEYS,
  getDashboardSummary,
  reconcilePendingExcelBackups
} from './services/storageService';
import { ensureStoreCoordinates, autoSyncStoreRegionAndKabupaten } from './utils/geoUtils';
import { formatSmartSODate } from './utils/formatters';
import { autoSyncStoreWithApprovedSchedule } from './utils/storeSyncUtils';
import { 
  Store, 
  SOSchedule, 
  SOResult, 
  SOTeam, 
  AuditorPersonnel, 
  SOEquipment, 
  EquipmentRepairLog, 
  UserRole, 
  MasterTokoDataset,
  OnCallPersonnelRecord 
} from './types/stockOpname';

import { Navbar } from './components/Navbar';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { RoleAuthModal } from './components/Role/RoleAuthModal';
import { InitialRoleAuthModal } from './components/Role/InitialRoleAuthModal';


import { SummaryCards } from './components/Dashboard/SummaryCards';
import { ChartsSection } from './components/Dashboard/ChartsSection';
import { UpcomingScheduleWidget } from './components/Dashboard/UpcomingScheduleWidget';
import { HighVarianceAlertWidget } from './components/Dashboard/HighVarianceAlertWidget';
import { DailyProgressTrackerWidget } from './components/Dashboard/DailyProgressTrackerWidget';
import { GeneralScheduleMetricsWidget } from './components/Dashboard/GeneralScheduleMetricsWidget';

import { ScheduleManager } from './components/Scheduling/ScheduleManager';
import { CreateScheduleModal } from './components/Scheduling/CreateScheduleModal';
import { AutoGeneratorModal } from './components/Scheduling/AutoGeneratorModal';

import { ResultsManager } from './components/Results/ResultsManager';
import { ResultDetailModal } from './components/Results/ResultDetailModal';
import { InputResultModal } from './components/Results/InputResultModal';

import { StoreDirectory } from './components/Stores/StoreDirectory';
import { MasterTokoManager } from './components/Stores/MasterTokoManager';
import { ZoneStoreChecklist } from './components/Supervisor/ZoneStoreChecklist';
import { StoreDetailModal } from './components/Stores/StoreDetailModal';
import { AddEditStoreModal } from './components/Stores/AddEditStoreModal';
import { ImportStoresModal } from './components/Stores/ImportStoresModal';
import { KorlapScheduleImageModal } from './components/Scheduling/KorlapScheduleImageModal';
import { AssignPersonnelModal } from './components/Scheduling/AssignPersonnelModal';
import { GagalAtauPindahTokoModal } from './components/Scheduling/GagalAtauPindahTokoModal';

import { TeamManager } from './components/Teams/TeamManager';
import { OnCallPersonnelManager } from './components/Teams/OnCallPersonnelManager';
import { EquipmentManager } from './components/Equipment/EquipmentManager';
import { LeaveRecapManager } from './components/Admin/LeaveRecapManager';
import { AdminSORecapExtractor } from './components/Admin/AdminSORecapExtractor';
import { CompanyPortals } from './components/Portals/CompanyPortals';
import { UniformTracker } from './components/Uniforms/UniformTracker';
import { ReportsAnalytics } from './components/Reports/ReportsAnalytics';
import { SettingsManager } from './components/Settings/SettingsManager';
import { BaliClusterMap } from './components/Map/BaliClusterMap';

import { syncCloudinaryConfigFromFirestore } from './services/cloudinaryService';

export default function App() {
  const [stores, setStores] = useState<Store[]>([]);
  const [schedules, setSchedules] = useState<SOSchedule[]>([]);
  const [results, setResults] = useState<SOResult[]>([]);
  const [teams, setTeams] = useState<SOTeam[]>([]);
  const [personnel, setPersonnel] = useState<AuditorPersonnel[]>([]);
  const [onCallRecords, setOnCallRecords] = useState<OnCallPersonnelRecord[]>([]);
  const [equipment, setEquipment] = useState<SOEquipment[]>([]);
  const [repairLogs, setRepairLogs] = useState<EquipmentRepairLog[]>([]);
  const [datasets, setDatasets] = useState<MasterTokoDataset[]>([]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [currentRole, setCurrentRole] = useState<UserRole>('ALL');
  const [isRoleAuthModalOpen, setIsRoleAuthModalOpen] = useState(false);
  const [isInitialRoleModalOpen, setIsInitialRoleModalOpen] = useState(false);
  const [targetRoleToAuth, setTargetRoleToAuth] = useState<UserRole>('SUPERVISOR');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('08'); // '01' to '12' or 'ALL'
  const [selectedYear, setSelectedYear] = useState('2026'); // '2024', '2025', '2026', '2027', '2028' or 'ALL'
  const [selectedDate, setSelectedDate] = useState('ALL'); // 'ALL' or 'YYYY-MM-DD' e.g. '2026-08-04'

  useEffect(() => {
    // Check initial role session from cache
    const savedSession = localStorage.getItem('so_ic_role_auth_session');
    if (savedSession) {
      try {
        const { role, authTime } = JSON.parse(savedSession);
        if (role && authTime && (Date.now() - authTime < 30 * 60 * 1000)) {
          setCurrentRole(role);
          setIsInitialRoleModalOpen(false);
        } else {
          setIsInitialRoleModalOpen(true);
        }
      } catch {
        setIsInitialRoleModalOpen(true);
      }
    } else {
      setIsInitialRoleModalOpen(true);
    }

    // Auto refresh timer check every 30 seconds
    const interval = setInterval(() => {
      const sess = localStorage.getItem('so_ic_role_auth_session');
      if (sess) {
        try {
          const { authTime } = JSON.parse(sess);
          if (authTime && (Date.now() - authTime >= 30 * 60 * 1000)) {
            localStorage.removeItem('so_ic_role_auth_session');
            setIsInitialRoleModalOpen(true);
          }
        } catch {}
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleInitialRoleSuccess = (selectedRole: UserRole) => {
    const sessionData = {
      role: selectedRole,
      authTime: Date.now()
    };
    localStorage.setItem('so_ic_role_auth_session', JSON.stringify(sessionData));
    setCurrentRole(selectedRole);
    setIsInitialRoleModalOpen(false);

    if (selectedRole === 'SUPERVISOR' && activeTab !== 'schedules' && activeTab !== 'stores' && activeTab !== 'map' && activeTab !== 'dashboard') {
      setActiveTab('schedules');
    } else if (selectedRole === 'OFFICER' && activeTab !== 'schedules' && activeTab !== 'results' && activeTab !== 'teams' && activeTab !== 'map' && activeTab !== 'dashboard') {
      setActiveTab('schedules');
    } else if (selectedRole === 'ADMIN' && activeTab !== 'equipment' && activeTab !== 'reports' && activeTab !== 'map' && activeTab !== 'dashboard') {
      setActiveTab('equipment');
    }
  };

  const handleRequestRoleChange = (role: UserRole) => {
    if (role === currentRole) return;
    setTargetRoleToAuth(role);
    setIsRoleAuthModalOpen(true);
  };

  const handleRoleAuthSuccess = (newRole: UserRole) => {
    const sessionData = {
      role: newRole,
      authTime: Date.now()
    };
    localStorage.setItem('so_ic_role_auth_session', JSON.stringify(sessionData));
    setCurrentRole(newRole);
    // Switch active tab appropriately if current active tab is restricted
    if (newRole === 'SUPERVISOR' && activeTab !== 'schedules' && activeTab !== 'stores' && activeTab !== 'map' && activeTab !== 'dashboard') {
      setActiveTab('schedules');
    } else if (newRole === 'OFFICER' && activeTab !== 'schedules' && activeTab !== 'results' && activeTab !== 'teams' && activeTab !== 'map' && activeTab !== 'dashboard') {
      setActiveTab('schedules');
    } else if (newRole === 'ADMIN' && activeTab !== 'equipment' && activeTab !== 'reports' && activeTab !== 'settings' && activeTab !== 'map' && activeTab !== 'dashboard') {
      setActiveTab('equipment');
    }
  };

  // Modals
  const [isCreateScheduleModalOpen, setIsCreateScheduleModalOpen] = useState(false);
  const [isAutoGeneratorModalOpen, setIsAutoGeneratorModalOpen] = useState(false);
  const [isKorlapImageModalOpen, setIsKorlapImageModalOpen] = useState(false);
  const [assignPersonnelSchedule, setAssignPersonnelSchedule] = useState<SOSchedule | null>(null);
  const [gagalPindahSchedule, setGagalPindahSchedule] = useState<SOSchedule | null>(null);
  
  const [isInputResultModalOpen, setIsInputResultModalOpen] = useState(false);
  const [inputResultScheduleId, setInputResultScheduleId] = useState<string | null>(null);
  const [selectedResultDetail, setSelectedResultDetail] = useState<SOResult | null>(null);

  const storesRef = React.useRef(stores);
  storesRef.current = stores;

  const handleOpenInputResultModal = (scheduleOrId?: SOSchedule | string | null) => {
    if (typeof scheduleOrId === 'string') {
      setInputResultScheduleId(scheduleOrId);
    } else if (scheduleOrId && typeof scheduleOrId === 'object' && 'id' in scheduleOrId) {
      setInputResultScheduleId(scheduleOrId.id);
    } else {
      setInputResultScheduleId(null);
    }
    setIsInputResultModalOpen(true);
  };

  const [isAddStoreModalOpen, setIsAddStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [selectedStoreDetail, setSelectedStoreDetail] = useState<Store | null>(null);
  const [isImportStoresModalOpen, setIsImportStoresModalOpen] = useState(false);

  // Helper to sync schedule regions and korlap/officer with updated store regions & vice versa
  const syncScheduleRegionsWithStores = (currentSchedules: SOSchedule[], currentStores: Store[]): SOSchedule[] => {
    const storeMap = new Map<string, Store>();
    currentStores.forEach(st => {
      storeMap.set(st.id, st);
      if (st.code) storeMap.set(st.code, st);
    });

    let changed = false;
    const updatedSchedules = currentSchedules.map(sch => {
      const matchedStore = storeMap.get(sch.storeId) || storeMap.get(sch.storeCode);
      if (matchedStore) {
        let accurateRegion = matchedStore.region;
        const storeText = `${matchedStore.name || ''} ${matchedStore.code || ''} ${matchedStore.kabupaten || ''} ${matchedStore.city || ''}`.toUpperCase();
        
        if (storeText.includes('BADUNG') || storeText.includes('TUBAN') || storeText.includes('KUTA') || storeText.includes('JIMBARAN')) {
          accurateRegion = 'Kab. Badung';
        } else if (storeText.includes('DENPASAR') || storeText.includes('RENON') || storeText.includes('SANUR')) {
          accurateRegion = 'Kota Denpasar';
        } else if (storeText.includes('GIANYAR') || storeText.includes('UBUD')) {
          accurateRegion = 'Kab. Gianyar';
        } else if (storeText.includes('TABANAN')) {
          accurateRegion = 'Kab. Tabanan';
        } else if (storeText.includes('BULELENG')) {
          accurateRegion = 'Kab. Buleleng';
        } else if (storeText.includes('KARANGASEM')) {
          accurateRegion = 'Kab. Karangasem';
        } else if (storeText.includes('JEMBRANA')) {
          accurateRegion = 'Kab. Jembrana';
        } else if (storeText.includes('KLUNGKUNG')) {
          accurateRegion = 'Kab. Klungkung';
        } else if (storeText.includes('BANGLI')) {
          accurateRegion = 'Kab. Bangli';
        } else if (storeText.includes('MATARAM')) {
          accurateRegion = 'Kota Mataram & Lombok';
        }

        let targetOfficer = sch.officerInCharge;
        if (!targetOfficer || targetOfficer === 'Petugas SO') {
          if (matchedStore.korlap && matchedStore.korlap !== 'Petugas SO') {
            targetOfficer = matchedStore.korlap;
          } else {
            targetOfficer = 'I GEDE PASEK SANTIKA (Officer / Korlap)';
          }
        }

        if (sch.region !== accurateRegion || sch.officerInCharge !== targetOfficer) {
          changed = true;
          return {
            ...sch,
            region: accurateRegion,
            officerInCharge: targetOfficer
          };
        }
      }
      return sch;
    });

    return changed ? updatedSchedules : currentSchedules;
  };

  // Helper to sync stores' korlap/officer with active schedule assignments
  const syncStoresWithSchedules = (currentStores: Store[], currentSchedules: SOSchedule[]): Store[] => {
    const scheduleOfficerMap = new Map<string, string>();
    currentSchedules.forEach(sch => {
      if (sch.officerInCharge && sch.officerInCharge !== 'Petugas SO') {
        scheduleOfficerMap.set(sch.storeId, sch.officerInCharge);
        if (sch.storeCode) scheduleOfficerMap.set(sch.storeCode, sch.officerInCharge);
      }
    });

    let storeChanged = false;
    const updatedStores = currentStores.map(st => {
      const assignedOfficer = scheduleOfficerMap.get(st.id) || scheduleOfficerMap.get(st.code);
      const effectiveOfficer = assignedOfficer || (st.korlap && st.korlap !== 'Petugas SO' && st.korlap !== 'angga' ? st.korlap : 'I GEDE PASEK SANTIKA');
      if (st.korlap !== effectiveOfficer) {
        storeChanged = true;
        return {
          ...st,
          korlap: effectiveOfficer,
          managerName: effectiveOfficer
        };
      }
      return st;
    });

    return storeChanged ? updatedStores : currentStores;
  };

  // Initialize data and subscribe to Firestore & Cloudinary across devices
  useEffect(() => {
    const loadedStoresRaw = getStoredStores();
    const syncedStores = loadedStoresRaw.map(s => autoSyncStoreRegionAndKabupaten(s));
    
    const loadedSchedulesRaw = getStoredSchedules();
    const syncedSchedules = syncScheduleRegionsWithStores(loadedSchedulesRaw, syncedStores);
    const fullySyncedStores = syncStoresWithSchedules(syncedStores, syncedSchedules);

    const loadedResults = getStoredResults();
    const loadedTeams = getStoredTeams();
    const loadedPersonnel = getStoredPersonnel();
    const loadedOnCallPersonnel = getStoredOnCallPersonnel();
    const loadedEquipment = getStoredEquipment();
    const loadedRepairLogs = getStoredRepairLogs();
    const loadedDatasets = getStoredMasterTokoDatasets();
    const syncedDatasets = loadedDatasets.map(ds => ({
      ...ds,
      stores: ds.stores.map(s => autoSyncStoreRegionAndKabupaten(s))
    }));

    setStores(fullySyncedStores);
    setSchedules(syncedSchedules);
    setResults(loadedResults);
    setTeams(loadedTeams);
    setPersonnel(loadedPersonnel);
    setOnCallRecords(loadedOnCallPersonnel);
    setEquipment(loadedEquipment);
    setRepairLogs(loadedRepairLogs);
    setDatasets(syncedDatasets);

    // Helper to apply multi-device Cloudinary synced data
    const handleApplyCloudinarySynced = (synced: any) => {
      if (!synced) return;
      if (synced.stores && Array.isArray(synced.stores)) {
        const syncedStores = synced.stores.map((s: Store) => autoSyncStoreRegionAndKabupaten(s));
        setStores(syncedStores);
        setSchedules(prev => syncScheduleRegionsWithStores(prev, syncedStores));
      }
      if (synced.equipment && Array.isArray(synced.equipment)) setEquipment(synced.equipment);
      if (synced.personnel && Array.isArray(synced.personnel)) setPersonnel(synced.personnel);
      if (synced.onCallPersonnel && Array.isArray(synced.onCallPersonnel)) setOnCallRecords(synced.onCallPersonnel);
      if (synced.schedules && Array.isArray(synced.schedules)) {
        setSchedules(prev => syncScheduleRegionsWithStores(synced.schedules, storesRef.current));
      }
      if (synced.results && Array.isArray(synced.results)) setResults(synced.results);
      if (synced.teams && Array.isArray(synced.teams)) setTeams(synced.teams);
      if (synced.repairLogs && Array.isArray(synced.repairLogs)) setRepairLogs(synced.repairLogs);
      if (synced.datasets && Array.isArray(synced.datasets)) setDatasets(synced.datasets);
    };

    // Smart Hybrid background sync: Prioritize Cloudinary Master JSON distribution & Firestore fallback
    const runFullCloudSync = async () => {
      // 1. First sync Cloudinary settings from Firestore so any device receives cloud credentials
      await syncCloudinaryConfigFromFirestore().catch(() => {});

      // 2. Reconcile any pending Excel backup records in Firestore
      reconcilePendingExcelBackups().catch(() => {});

      // 3. Sync from Cloudinary CDN & Firestore
      syncAllDataFromCloudinary()
        .then(handleApplyCloudinarySynced)
        .catch(err => console.warn('Cloudinary background sync notice:', err))
        .finally(() => {
          syncAllDataFromFirestore()
            .then(fsSynced => {
              if (fsSynced && Object.keys(fsSynced).length > 0) {
                handleApplyCloudinarySynced(fsSynced);
              }
            })
            .catch(() => {});
        });
    };

    // Run on initial load
    runFullCloudSync();

    // Enable real-time Firestore listeners across all portals
    const unsubFirestore = subscribeFirestoreData({
      onStores: (s) => {
        if (s && Array.isArray(s) && s.length > 0) {
          const syncedStores = s.map(st => autoSyncStoreRegionAndKabupaten(st));
          setStores(syncedStores);
          setSchedules(prev => syncScheduleRegionsWithStores(prev, syncedStores));
        }
      },
      onSchedules: (sch) => {
        if (sch && Array.isArray(sch) && sch.length > 0) {
          setSchedules(syncScheduleRegionsWithStores(sch, storesRef.current));
        }
      },
      onResults: (res) => {
        if (res && Array.isArray(res) && res.length > 0) setResults(res);
      },
      onTeams: (tm) => {
        if (tm && Array.isArray(tm) && tm.length > 0) setTeams(tm);
      },
      onPersonnel: (p) => {
        if (p && Array.isArray(p) && p.length > 0) setPersonnel(p);
      },
      onEquipment: (eq) => {
        if (eq && Array.isArray(eq) && eq.length > 0) setEquipment(eq);
      },
      onRepairLogs: (rl) => {
        if (rl && Array.isArray(rl) && rl.length > 0) setRepairLogs(rl);
      }
    });

    // Periodic sync every 12s across devices via Cloudinary Master JSON
    const syncInterval = setInterval(() => {
      runFullCloudSync();
    }, 12000);

    const handleWindowFocus = () => {
      runFullCloudSync();
    };
    window.addEventListener('focus', handleWindowFocus);

    const handleDataUpdated = (e: any) => {
      const detail = e.detail;
      if (!detail || !detail.storageKey || !detail.data) return;
      const key = detail.storageKey;
      const data = detail.data;
      if (key === STORAGE_KEYS.STORES) {
        const synced = (data as Store[]).map(s => autoSyncStoreRegionAndKabupaten(s));
        setStores(synced);
        setSchedules(prev => syncScheduleRegionsWithStores(prev, synced));
      } else if (key === STORAGE_KEYS.SCHEDULES) {
        setSchedules(syncScheduleRegionsWithStores(data as SOSchedule[], storesRef.current));
      } else if (key === STORAGE_KEYS.RESULTS) {
        setResults(data as SOResult[]);
      } else if (key === STORAGE_KEYS.TEAMS) {
        setTeams(data as SOTeam[]);
      } else if (key === STORAGE_KEYS.PERSONNEL) {
        setPersonnel(data as AuditorPersonnel[]);
      } else if (key === STORAGE_KEYS.EQUIPMENT) {
        setEquipment(data as SOEquipment[]);
      } else if (key === STORAGE_KEYS.REPAIR_LOGS) {
        setRepairLogs(data as EquipmentRepairLog[]);
      } else if (key === STORAGE_KEYS.ONCALL_PERSONNEL) {
        setOnCallRecords(data as OnCallPersonnelRecord[]);
      }
    };
    window.addEventListener('spv_data_updated', handleDataUpdated);

    return () => {
      unsubFirestore();
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('spv_data_updated', handleDataUpdated);
    };
  }, []);

  // Filter schedules and results by selectedMonth, selectedYear, and selectedDate
  const filteredSchedules = schedules.filter(s => {
    if (!s.scheduledDate) return true;
    if (selectedDate !== 'ALL') {
      return s.scheduledDate === selectedDate;
    }
    const parts = s.scheduledDate.split('-');
    if (parts.length < 2) return true;
    const sYear = parts[0];
    const sMonth = parts[1];
    const matchMonth = selectedMonth === 'ALL' || sMonth === selectedMonth;
    const matchYear = selectedYear === 'ALL' || sYear === selectedYear;
    return matchMonth && matchYear;
  });

  const filteredResults = results.filter(r => {
    if (!r.soDate) return true;
    if (selectedDate !== 'ALL') {
      return r.soDate === selectedDate;
    }
    const parts = r.soDate.split('-');
    if (parts.length < 2) return true;
    const rYear = parts[0];
    const rMonth = parts[1];
    const matchMonth = selectedMonth === 'ALL' || rMonth === selectedMonth;
    const matchYear = selectedYear === 'ALL' || rYear === selectedYear;
    return matchMonth && matchYear;
  });

  // Summary calculated dynamically based on filtered period
  const summary = getDashboardSummary(stores, filteredSchedules, filteredResults);

  // Handlers for Schedules
  const handleCreateSchedule = (newSched: Omit<SOSchedule, 'id' | 'createdAt'>) => {
    const created: SOSchedule = {
      ...newSched,
      id: `SCHED-${Date.now()}`,
      createdAt: new Date().toISOString().slice(0, 10)
    };
    const updated = [created, ...schedules];
    setSchedules(updated);
    saveSchedules(updated);
  };

  const handleBatchCreateSchedules = (newSchedules: SOSchedule[]) => {
    const updated = [...newSchedules, ...schedules];
    setSchedules(updated);
    saveSchedules(updated);
  };

  const handleUpdateScheduleStatus = (scheduleId: string, status: SOSchedule['status']) => {
    const updated = schedules.map(s => s.id === scheduleId ? { ...s, status } : s);
    setSchedules(updated);
    saveSchedules(updated);
  };

  const handleUpdateSchedule = (updatedSchedule: SOSchedule) => {
    const updated = schedules.map(s => s.id === updatedSchedule.id ? updatedSchedule : s);
    setSchedules(updated);
    saveSchedules(updated);
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    const targetSched = schedules.find(s => s.id === scheduleId);
    recordDeletedId(STORAGE_KEYS.SCHEDULES, scheduleId);
    trackDeletedId(STORAGE_KEYS.SCHEDULES, scheduleId);
    if (targetSched) {
      const canonicalId = getDeterministicScheduleId(targetSched);
      if (canonicalId) {
        recordDeletedId(STORAGE_KEYS.SCHEDULES, canonicalId);
        trackDeletedId(STORAGE_KEYS.SCHEDULES, canonicalId);
      }
    }
    deleteScheduleFromFirestore(scheduleId, targetSched).catch(() => {});
    const updated = schedules.filter(s => s.id !== scheduleId);
    setSchedules(updated);
    saveSchedules(updated, true);
  };

  const handleAssignPersonnelSave = (scheduleId: string, personnelIds: string[], personnelNames: string[]) => {
    const updated = schedules.map(s => {
      if (s.id === scheduleId) {
        return {
          ...s,
          assignedPersonnelIds: personnelIds,
          assignedPersonnelNames: personnelNames
        };
      }
      return s;
    });
    setSchedules(updated);
    saveSchedules(updated);
  };

  const handleGagalAtauPindahToko = (
    scheduleId: string,
    actionType: 'Gagal SO' | 'Pindah Toko',
    reason: string,
    replacementDetails?: { newStore: Store; newDate: string; newTime: string }
  ) => {
    const originalSched = schedules.find(s => s.id === scheduleId);
    if (!originalSched) return;

    let replacementSched: SOSchedule | null = null;
    if (actionType === 'Pindah Toko' && replacementDetails) {
      replacementSched = {
        id: `SCHED-REPLACE-${Date.now()}`,
        storeId: replacementDetails.newStore.id,
        storeCode: replacementDetails.newStore.code,
        storeName: replacementDetails.newStore.name,
        region: replacementDetails.newStore.region,
        scheduledDate: replacementDetails.newDate,
        scheduledTime: replacementDetails.newTime,
        teamId: originalSched.teamId,
        teamName: originalSched.teamName,
        spvInCharge: originalSched.spvInCharge,
        officerInCharge: originalSched.officerInCharge,
        status: 'Terjadwal',
        spvApprovalStatus: 'Menunggu Approval SPV',
        targetSKUCount: replacementDetails.newStore.totalSKUCount,
        notes: `Pengganti dari pindah toko ${originalSched.storeCode} (${originalSched.storeName}). Alasan: ${reason}`,
        createdAt: new Date().toISOString().slice(0, 10)
      };
    }

    const updated = schedules.map(s => {
      if (s.id === scheduleId) {
        return {
          ...s,
          status: actionType,
          spvApprovalStatus: 'Menunggu Approval SPV' as const,
          failureOrMoveType: actionType,
          failureOrMoveReason: reason,
          replacementStoreCode: replacementDetails?.newStore.code,
          replacementStoreName: replacementDetails?.newStore.name
        };
      }
      return s;
    });

    const finalSchedules = replacementSched ? [replacementSched, ...updated] : updated;
    setSchedules(finalSchedules);
    saveSchedules(finalSchedules);
  };

  const handleConfirmScheduleFinished = (scheduleId: string) => {
    const updated = schedules.map(s => {
      if (s.id === scheduleId) {
        return { ...s, status: 'Selesai' as const, spvApprovalStatus: 'Menunggu Approval SPV' as const };
      }
      return s;
    });
    setSchedules(updated);
    saveSchedules(updated);
  };

  const handleApproveSchedule = (scheduleId: string) => {
    const targetSched = schedules.find(s => s.id === scheduleId);
    const updated = schedules.map(s => {
      if (s.id === scheduleId) {
        return {
          ...s,
          spvApprovalStatus: 'Disetujui' as const
        };
      }
      return s;
    });
    setSchedules(updated);
    saveSchedules(updated);

    if (targetSched) {
      // 1. Update matching store master with Approved SO date & auto-fill active month column (e.g. September 2026)
      const approvedDateStr = targetSched.scheduledDate;
      const updatedStores = stores.map(st => {
        if (
          st.code === targetSched.storeCode || 
          st.id === targetSched.storeId || 
          (st.name && targetSched.storeName && st.name.toLowerCase() === targetSched.storeName.toLowerCase())
        ) {
          return autoSyncStoreWithApprovedSchedule(st, approvedDateStr);
        }
        return st;
      });
      setStores(updatedStores);
      saveStores(updatedStores);

      // 2. Update results
      const updatedResults = results.map(r => {
        if (r.scheduleId === scheduleId || r.storeCode === targetSched.storeCode) {
          return { ...r, approvalStatus: 'Disetujui' as const, approvedAt: new Date().toISOString().replace('T', ' ').slice(0, 16) };
        }
        return r;
      });
      setResults(updatedResults);
      saveResults(updatedResults);
    }
  };

  const handleRejectSchedule = (scheduleId: string, reason?: string) => {
    const updated = schedules.map(s => {
      if (s.id === scheduleId) {
        if (s.status === 'Pindah Toko' || s.status === 'Gagal SO') {
          return {
            ...s,
            status: 'Terjadwal' as const,
            spvApprovalStatus: 'Ditolak' as const,
            notes: `${s.notes || ''} [Ditolak SPV: Mohon lakukan SO sesuai jadwal]`
          };
        } else {
          return {
            ...s,
            status: 'Proses SO' as const,
            spvApprovalStatus: 'Perlu Audit Ulang' as const,
            notes: `${s.notes || ''} [Audit Ulang SPV: ${reason || 'Mohon cek ulang fisik & rekapan'}]`
          };
        }
      }
      return s;
    });
    setSchedules(updated);
    saveSchedules(updated);
  };

  // Handlers for Results
  const handleCreateResult = (newResult: Omit<SOResult, 'id' | 'submittedAt'>) => {
    const created: SOResult = {
      ...newResult,
      id: `RESULT-${Date.now()}`,
      submittedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
    };
    const updatedResults = [created, ...results];
    setResults(updatedResults);
    saveResults(updatedResults);

    // Update corresponding schedule status to 'Selesai'
    const updatedSchedules = schedules.map(s => s.id === newResult.scheduleId ? { ...s, status: 'Selesai' as const } : s);
    setSchedules(updatedSchedules);
    saveSchedules(updatedSchedules);

    // Update store's last SODate & Accuracy Rate
    const updatedStores = stores.map(st => st.id === newResult.storeId ? {
      ...st,
      lastSODate: newResult.soDate,
      lastAccuracyRate: newResult.accuracyRatePercentage
    } : st);
    setStores(updatedStores);
    saveStores(updatedStores);
  };

  const handleApproveResult = (resultId: string) => {
    const updated = results.map(r => r.id === resultId ? {
      ...r,
      approvalStatus: 'Disetujui' as const,
      approvedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
    } : r);
    setResults(updated);
    saveResults(updated);
  };

  const handleRequestRecount = (resultId: string) => {
    const updated = results.map(r => r.id === resultId ? {
      ...r,
      approvalStatus: 'Perlu Audit Ulang' as const
    } : r);
    setResults(updated);
    saveResults(updated);
  };

  // Handlers for Stores
  const handleSaveStore = (store: Store) => {
    const exists = stores.some(s => s.id === store.id);
    let updated: Store[];
    if (exists) {
      updated = stores.map(s => s.id === store.id ? store : s);
    } else {
      updated = [store, ...stores];
    }
    setStores(updated);
    saveStores(updated);
  };

  const handleImportBulkStores = (newStores: Store[], mode: 'replace' | 'merge' = 'replace') => {
    let updated: Store[];
    if (mode === 'replace') {
      clearAllDeletedIds(STORAGE_KEYS.STORES);
      updated = newStores;
    } else {
      const existingMap = new Map<string, Store>(stores.map(s => [s.code || s.id, s]));
      newStores.forEach(s => {
        existingMap.set(s.code || s.id, s);
      });
      updated = Array.from(existingMap.values());
    }
    setStores(updated);
    saveStores(updated, mode === 'replace');
  };

  const handleBulkUpdateStores = (updatedStores: Store[]) => {
    const synced = updatedStores.map(s => autoSyncStoreRegionAndKabupaten(s));
    setStores(synced);
    saveStores(synced);

    const updatedSchedules = syncScheduleRegionsWithStores(schedules, synced);
    if (updatedSchedules !== schedules) {
      setSchedules(updatedSchedules);
      saveSchedules(updatedSchedules);
    }
  };

  const handleDeleteStore = (storeId: string) => {
    recordDeletedId(STORAGE_KEYS.STORES, storeId);
    deleteStoreFromFirestore(storeId).catch(() => {});
    const updated = stores.filter(s => s.id !== storeId);
    setStores(updated);
    saveStores(updated);
  };

  // Handlers for Personnel
  const handleAddPersonnel = (newP: Omit<AuditorPersonnel, 'id'>) => {
    const nowIso = new Date().toISOString();
    const created: AuditorPersonnel = {
      ...newP,
      id: `PERS-${Date.now()}`,
      createdAt: (newP as any).createdAt || nowIso,
      updatedAt: nowIso
    } as AuditorPersonnel;
    const updated = [created, ...personnel];
    setPersonnel(updated);
    savePersonnel(updated);
  };

  const handleBatchImportPersonnel = (importedPersonnel: AuditorPersonnel[], mode: 'replace' | 'merge' = 'replace') => {
    const nowIso = new Date().toISOString();
    const stamped = importedPersonnel.map(p => ({
      ...p,
      createdAt: (p as any).createdAt || nowIso,
      updatedAt: nowIso
    }));
    let updated: AuditorPersonnel[];
    if (mode === 'replace') {
      clearAllDeletedIds(STORAGE_KEYS.PERSONNEL);
      updated = stamped;
    } else {
      const existingMap = new Map<string, AuditorPersonnel>(personnel.map(p => [p.nik || p.id, p]));
      stamped.forEach(p => {
        existingMap.set(p.nik || p.id, p);
      });
      updated = Array.from(existingMap.values());
    }
    setPersonnel(updated);
    savePersonnel(updated, mode === 'replace');
  };

  const handleUpdatePersonnel = (updatedP: AuditorPersonnel) => {
    const nowIso = new Date().toISOString();
    const stamped: AuditorPersonnel = {
      ...updatedP,
      updatedAt: nowIso
    };
    const updated = personnel.map(p => p.id === stamped.id ? stamped : p);
    setPersonnel(updated);
    savePersonnel(updated);
  };

  const handleDeletePersonnel = (id: string) => {
    recordDeletedId(STORAGE_KEYS.PERSONNEL, id);
    deletePersonnelFromFirestore(id).catch(() => {});
    const updated = personnel.filter(p => p.id !== id);
    setPersonnel(updated);
    savePersonnel(updated);
  };

  // Handlers for Equipment
  const handleAddEquipment = (newE: Omit<SOEquipment, 'id'>) => {
    const nowIso = new Date().toISOString();
    const created: SOEquipment = {
      ...newE,
      id: `EQ-${Date.now()}`,
      createdAt: (newE as any).createdAt || nowIso,
      updatedAt: nowIso
    } as SOEquipment;
    const updated = [created, ...equipment];
    setEquipment(updated);
    saveEquipment(updated);
  };

  const handleUpdateEquipment = (updatedE: SOEquipment) => {
    const nowIso = new Date().toISOString();
    const stamped: SOEquipment = {
      ...updatedE,
      updatedAt: nowIso
    };
    const updated = equipment.map(e => e.id === stamped.id ? stamped : e);
    setEquipment(updated);
    saveEquipment(updated);
  };

  const handleDeleteEquipment = (id: string) => {
    recordDeletedId(STORAGE_KEYS.EQUIPMENT, id);
    deleteEquipmentFromFirestore(id).catch(() => {});
    const updated = equipment.filter(e => e.id !== id);
    setEquipment(updated);
    saveEquipment(updated);
  };

  // Handlers for Repair Logs
  const handleAddRepairLog = (newLog: Omit<EquipmentRepairLog, 'id'>) => {
    const nowIso = new Date().toISOString();
    const created: EquipmentRepairLog = {
      ...newLog,
      id: `REP-${Date.now()}`,
      createdAt: (newLog as any).createdAt || nowIso,
      updatedAt: nowIso
    } as EquipmentRepairLog;
    const updated = [created, ...repairLogs];
    setRepairLogs(updated);
    saveRepairLogs(updated);
  };

  const handleUpdateRepairLog = (updatedLog: EquipmentRepairLog) => {
    const nowIso = new Date().toISOString();
    const stamped: EquipmentRepairLog = {
      ...updatedLog,
      updatedAt: nowIso
    } as EquipmentRepairLog;
    const updated = repairLogs.map(r => r.id === stamped.id ? stamped : r);
    setRepairLogs(updated);
    saveRepairLogs(updated);
  };

  const handleDeleteRepairLog = (id: string) => {
    recordDeletedId(STORAGE_KEYS.REPAIR_LOGS, id);
    deleteRepairLogFromFirestore(id).catch(() => {});
    const updated = repairLogs.filter(r => r.id !== id);
    setRepairLogs(updated);
    saveRepairLogs(updated);
  };

  // Export Stores CSV Handler
  const handleExportStores = () => {
    const data = stores.map(s => ({
      'KD TOKO': s.code,
      'NAMA': s.name,
      'WILAYAH/KABUPATEN': s.region || s.kabupaten || s.city,
      'KOORDINAT': s.koordinat || (s.latitude && s.longitude ? `${s.latitude}, ${s.longitude}` : '-'),
      'AM': s.am || '-',
      'AS': s.as || '-',
      'SALDO TOKO': typeof s.saldoToko === 'number' ? s.saldoToko : s.saldoToko || '0',
      'KECAMATAN': s.kecamatan || s.district || '-',
      'KORLAP/OFFICER': s.korlap || s.managerName || '-',
      'JENIS TOKO': s.jenisToko || s.storeType,
      'TGL SO MEI': formatSmartSODate(s.tglSoMei),
      'TGL SO JUNI': formatSmartSODate(s.tglSoJuni),
      'TGL SO JULI': formatSmartSODate(s.tglSoJuli),
      'SO BULAN INI (APPROVED SPV)': formatSmartSODate(s.tglSoApproved || s.soAgustus || s.lastSODate),
      'STATUS APPROVAL SO': (s.tglSoApproved || s.lastSODate) ? 'DISETUJUI SPV' : 'BELUM SO',
      'KLASIFIKASI KRITERIA': s.smartClassification || 'Toko Ritel Standard'
    }));
    exportToCSV('Master_Toko_Bali_Approved.csv', data);
  };

  // Reset / Clear Data
  const handleResetData = async (options?: { forceWipeCloudinary?: boolean }) => {
    const data = await clearAllData(options);
    setStores(data.stores);
    setSchedules(data.schedules);
    setResults(data.results);
    setTeams(data.teams);
    setPersonnel(data.personnel);
    setEquipment(data.equipment);
    setRepairLogs(data.repairLogs);
    setDatasets([]);
  };

  const handleRestoreData = (data: { stores: Store[]; schedules: SOSchedule[]; results: SOResult[]; teams: SOTeam[] }) => {
    setStores(data.stores);
    setSchedules(data.schedules);
    setResults(data.results);
    setTeams(data.teams);
    saveStores(data.stores);
    saveSchedules(data.schedules);
    saveResults(data.results);
  };

  const handleUploadDataset = (newDataset: MasterTokoDataset) => {
    let updated = [...datasets];
    if (newDataset.isActiveForScheduling || updated.length === 0) {
      updated = updated.map(d => ({ ...d, isActiveForScheduling: false }));
      newDataset.isActiveForScheduling = true;
    }
    updated = [newDataset, ...updated];
    setDatasets(updated);
    saveMasterTokoDatasets(updated);

    if (newDataset.isActiveForScheduling && newDataset.stores.length > 0) {
      const synced = newDataset.stores.map(s => autoSyncStoreRegionAndKabupaten(s));
      setStores(synced);
      saveStores(synced);
    }
  };

  const handleActivateDatasetForScheduling = (datasetId: string) => {
    const target = datasets.find(d => d.id === datasetId);
    if (!target) return;

    const updated = datasets.map(d => ({
      ...d,
      isActiveForScheduling: d.id === datasetId
    }));
    setDatasets(updated);
    saveMasterTokoDatasets(updated);

    if (target.stores.length > 0) {
      const synced = target.stores.map(s => autoSyncStoreRegionAndKabupaten(s));
      setStores(synced);
      saveStores(synced);
    }
  };

  const handleDeleteDataset = (datasetId: string) => {
    const updated = datasets.filter(d => d.id !== datasetId);
    setDatasets(updated);
    saveMasterTokoDatasets(updated);
  };

  const handleExportDataset = (dataset: MasterTokoDataset) => {
    exportToCSV(dataset.stores, `${dataset.title.replace(/\s+/g, '_')}_EXPORT.csv`);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 font-sans text-slate-800 flex flex-col antialiased selection:bg-indigo-500 selection:text-white w-full max-w-full overflow-x-hidden">
      
      {/* Top Navbar */}
      <Navbar
        stores={stores}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onResetData={handleResetData}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        pendingApprovalCount={summary.pendingApprovalCount}
        currentRole={currentRole}
        onRoleChangeRequest={handleRequestRoleChange}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      {/* Main Container Layout (Full Fluid Width) */}
      <div className="flex-1 flex flex-col lg:flex-row w-full max-w-[1920px] mx-auto overflow-x-hidden">
        
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingApprovalCount={summary.pendingApprovalCount}
          storesCount={stores.length}
          scheduledCount={schedules.filter(s => s.status === 'Terjadwal' || s.status === 'Proses SO').length}
          datasetsCount={datasets.length}
          currentRole={currentRole}
          onRoleChangeRequest={handleRequestRoleChange}
          onOpenNewScheduleModal={() => setIsCreateScheduleModalOpen(true)}
          onOpenNewResultModal={() => handleOpenInputResultModal()}
          onResetData={handleResetData}
          onExportMasterCSV={handleExportStores}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Content View Area */}
        <main className="flex-1 p-3.5 sm:p-6 pb-24 lg:pb-6 space-y-6 overflow-x-hidden">
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              
              {/* General Schedule Metrics Widget (Terjadwal, Pindah, Gagal SO with Filters & Popups) */}
              <GeneralScheduleMetricsWidget
                schedules={schedules}
                stores={stores}
                personnel={personnel}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
              />

              {/* Summary Cards */}
              <SummaryCards
                summary={summary}
                onNavigateTab={(tab) => setActiveTab(tab)}
              />

              {/* Daily SO Progress Tracker Widget */}
              <DailyProgressTrackerWidget
                schedules={schedules}
                results={results}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
              />

              {/* Recharts Analytics Section */}
              <ChartsSection
                schedules={filteredSchedules}
                results={filteredResults}
              />

              {/* Two Column Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Upcoming Schedules */}
                <UpcomingScheduleWidget
                  schedules={filteredSchedules}
                  onNavigateSchedules={() => setActiveTab('schedules')}
                  onUpdateStatus={handleUpdateScheduleStatus}
                />

                {/* High Variance / Pending Approval Alert */}
                <HighVarianceAlertWidget
                  results={filteredResults}
                  onNavigateResults={() => setActiveTab('results')}
                  onApproveResult={handleApproveResult}
                  onRequestRecount={handleRequestRecount}
                  onSelectResultDetail={(res) => setSelectedResultDetail(res)}
                />

              </div>

            </div>
          )}

          {/* TAB 2: PENJADWALAN SO */}
          {activeTab === 'schedules' && (
            <ScheduleManager
              schedules={schedules}
              stores={stores}
              teams={teams}
              personnel={personnel}
              currentRole={currentRole}
              onOpenCreateModal={() => setIsCreateScheduleModalOpen(true)}
              onOpenAutoGenerator={() => setIsAutoGeneratorModalOpen(true)}
              onOpenKorlapImageModal={() => setIsKorlapImageModalOpen(true)}
              onOpenInputModal={(schedOrId) => handleOpenInputResultModal(schedOrId)}
              onUpdateStatus={handleUpdateScheduleStatus}
              onDeleteSchedule={handleDeleteSchedule}
              onAssignPersonnel={(sched) => setAssignPersonnelSchedule(sched)}
              onOpenGagalPindahModal={(sched) => setGagalPindahSchedule(sched)}
              onConfirmScheduleFinished={handleConfirmScheduleFinished}
              onApproveSchedule={handleApproveSchedule}
              onRejectSchedule={handleRejectSchedule}
            />
          )}

          {/* TAB MAP: PETA & KLUSTER BALI */}
          {activeTab === 'map' && (
            <BaliClusterMap
              stores={stores}
              schedules={schedules}
              personnel={personnel}
              onUpdateSchedule={handleUpdateSchedule}
            />
          )}

          {/* TAB 3: REKAPAN HASIL SO */}
          {activeTab === 'results' && (
            <ResultsManager
              results={results}
              onOpenInputModal={(schedOrId) => handleOpenInputResultModal(schedOrId)}
              onSelectResultDetail={(res) => setSelectedResultDetail(res)}
              onApproveResult={handleApproveResult}
              onRequestRecount={handleRequestRecount}
            />
          )}

          {/* TAB: DATA MASTER TOKO (FILE MULTI-INDIKATOR) */}
          {activeTab === 'master_toko_files' && (
            <MasterTokoManager
              datasets={datasets}
              activeStoresCount={stores.length}
              onUploadDataset={handleUploadDataset}
              onActivateDatasetForScheduling={handleActivateDatasetForScheduling}
              onDeleteDataset={handleDeleteDataset}
              onExportDataset={handleExportDataset}
            />
          )}

          {/* TAB 4: MASTER TOKO (700+) */}
          {activeTab === 'stores' && (
            <StoreDirectory
              stores={stores}
              schedules={schedules}
              onOpenAddModal={() => {
                setEditingStore(null);
                setIsAddStoreModalOpen(true);
              }}
              onOpenImportModal={() => setIsImportStoresModalOpen(true)}
              onSelectStore={(st) => setSelectedStoreDetail(st)}
              onEditStore={(st) => {
                setEditingStore(st);
                setIsAddStoreModalOpen(true);
              }}
              onDeleteStore={handleDeleteStore}
              onBulkUpdateStores={handleBulkUpdateStores}
            />
          )}

          {/* TAB 4.5: CEKLIST SO TOKO ZONA (PORTAL SPV) */}
          {activeTab === 'checklist_toko_zona' && (
            <ZoneStoreChecklist
              stores={stores}
              schedules={schedules}
              results={results}
              personnel={personnel}
              onOpenInputResultModal={(sch) => {
                handleOpenInputResultModal(sch);
              }}
              onSelectStore={(st) => setSelectedStoreDetail(st)}
            />
          )}

          {/* TAB 5: TIM SO & AUDITOR */}
          {activeTab === 'teams' && (
            <TeamManager
              teams={teams}
              personnel={personnel}
              onAddPersonnel={handleAddPersonnel}
              onUpdatePersonnel={handleUpdatePersonnel}
              onDeletePersonnel={handleDeletePersonnel}
              onBatchImportPersonnel={handleBatchImportPersonnel}
              currentRole={currentRole}
            />
          )}

          {/* TAB 5.5: LIST PERSONIL ON-CALL */}
          {activeTab === 'oncall_personnel' && (
            <OnCallPersonnelManager
              personnelList={personnel}
              onCallRecords={onCallRecords}
              onUpdateOnCallRecords={(newRecords) => {
                setOnCallRecords(newRecords);
                saveOnCallPersonnel(newRecords, true);
              }}
              onSaveRecords={async (newRecords) => {
                setOnCallRecords(newRecords);
                await saveOnCallPersonnel(newRecords, true);
              }}
              currentRole={currentRole}
            />
          )}

          {/* TAB: PENARIKAN REKAP HASIL SO (ADMIN) */}
          {activeTab === 'admin_rekap_so' && (
            <AdminSORecapExtractor
              results={results}
              schedules={schedules}
              stores={stores}
              personnel={personnel}
              currentRole={currentRole}
              onViewDetailResult={(res) => setSelectedResultDetail(res)}
            />
          )}

          {/* TAB 6: TRACKING PERALATAN SO */}
          {activeTab === 'equipment' && (
            <EquipmentManager
              equipmentList={equipment}
              repairLogs={repairLogs}
              onAddEquipment={handleAddEquipment}
              onUpdateEquipment={handleUpdateEquipment}
              onDeleteEquipment={handleDeleteEquipment}
              onBatchUpdateEquipment={(newList, isReplaceMode) => {
                setEquipment(newList);
                saveEquipment(newList, isReplaceMode);
              }}
              onAddRepairLog={handleAddRepairLog}
              onUpdateRepairLog={handleUpdateRepairLog}
              onDeleteRepairLog={handleDeleteRepairLog}
            />
          )}

          {/* TAB 6.5: REKAPAN SAKIT & CUTI SDM */}
          {activeTab === 'leave_recap' && (
            <LeaveRecapManager
              personnel={personnel}
              onUpdatePersonnel={setPersonnel}
            />
          )}

          {/* TAB 6.8: PORTAL PENTING PERUSAHAAN */}
          {activeTab === 'company_portals' && (
            <CompanyPortals
              currentRole={currentRole}
              onNavigateToSettings={() => setActiveTab('settings')}
            />
          )}

          {/* TAB 6.9: TRACKING SERAGAM SDM */}
          {activeTab === 'uniform_tracking' && (
            <UniformTracker
              personnelList={personnel}
            />
          )}

          {/* TAB 7: LAPORAN & ANALYTICS */}
          {activeTab === 'reports' && (
            <ReportsAnalytics
              stores={stores}
              schedules={schedules}
              results={results}
              summary={summary}
              personnel={personnel}
            />
          )}

          {/* TAB 7: PENGATURAN & UTILITIES */}
          {activeTab === 'settings' && (
            <SettingsManager
              stores={stores}
              schedules={schedules}
              results={results}
              teams={teams}
              currentRole={currentRole}
              onResetData={handleResetData}
              onRestoreData={handleRestoreData}
            />
          )}

        </main>

      </div>

      {/* Mobile & Landscape Floating Interactive Quick Action Button */}
      {!isMobileMenuOpen && (
        <aside 
          aria-label="Floating Slide Bar Menu Toggle"
          className="fixed bottom-14 sm:bottom-16 left-3 sm:left-4 z-35 lg:hidden animate-in fade-in zoom-in duration-300 pointer-events-auto"
        >
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 hover:from-indigo-900 hover:to-slate-900 text-white rounded-full shadow-2xl shadow-indigo-950/60 border border-indigo-500/40 active:scale-90 hover:scale-105 transition-all duration-200 group backdrop-blur-md ring-2 ring-indigo-400/20"
            title="Buka Slide Bar Menu Navigasi"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform">
              <Menu className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-xs font-black tracking-wide text-indigo-100 pr-1 flex items-center gap-1.5">
              <span>Menu Slide Bar</span>
              {summary.pendingApprovalCount > 0 ? (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              ) : (
                <Sparkles className="w-3 h-3 text-indigo-400 group-hover:animate-spin" />
              )}
            </span>
          </button>
        </aside>
      )}

      {/* Mobile & Tablet Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 w-full max-w-full bg-slate-900 border-t border-slate-800 px-1 py-1.5 z-30 shadow-2xl grid grid-cols-5 gap-0.5 items-center select-none overflow-hidden">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl text-[10px] font-bold transition truncate ${
            activeTab === 'dashboard' ? 'text-indigo-400 bg-slate-800' : 'text-slate-400 hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" />
          <span className="truncate w-full text-center">Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('schedules')}
          className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl text-[10px] font-bold transition truncate ${
            activeTab === 'schedules' ? 'text-indigo-400 bg-slate-800' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4 mb-0.5" />
          <span className="truncate w-full text-center">Jadwal</span>
        </button>

        <button
          onClick={() => setActiveTab('results')}
          className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl text-[10px] font-bold transition relative truncate ${
            activeTab === 'results' ? 'text-emerald-400 bg-slate-800' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ClipboardCheck className="w-4 h-4 mb-0.5" />
          <span className="truncate w-full text-center">Hasil</span>
          {summary.pendingApprovalCount > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('stores')}
          className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl text-[10px] font-bold transition truncate ${
            activeTab === 'stores' ? 'text-indigo-400 bg-slate-800' : 'text-slate-400 hover:text-white'
          }`}
        >
          <StoreIcon className="w-4 h-4 mb-0.5" />
          <span className="truncate w-full text-center">Toko</span>
        </button>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="flex flex-col items-center justify-center py-1 px-1 rounded-xl text-[10px] font-bold text-slate-300 hover:text-white active:scale-95 transition truncate"
        >
          <Menu className="w-4 h-4 mb-0.5 text-indigo-400" />
          <span className="truncate w-full text-center">Slide Bar</span>
        </button>
      </nav>

      {/* ALL MODALS */}
      <CreateScheduleModal
        isOpen={isCreateScheduleModalOpen}
        onClose={() => setIsCreateScheduleModalOpen(false)}
        stores={stores}
        teams={teams}
        existingSchedules={schedules}
        personnel={personnel}
        onCreateSchedule={handleCreateSchedule}
      />

      <AutoGeneratorModal
        isOpen={isAutoGeneratorModalOpen}
        onClose={() => setIsAutoGeneratorModalOpen(false)}
        stores={stores}
        teams={teams}
        personnel={personnel}
        existingSchedules={schedules}
        onBatchCreateSchedules={handleBatchCreateSchedules}
      />

      <InputResultModal
        isOpen={isInputResultModalOpen}
        onClose={() => {
          setIsInputResultModalOpen(false);
          setInputResultScheduleId(null);
        }}
        schedules={schedules}
        initialScheduleId={inputResultScheduleId}
        onCreateResult={handleCreateResult}
      />

      <ResultDetailModal
        result={selectedResultDetail}
        onClose={() => setSelectedResultDetail(null)}
        onApproveResult={handleApproveResult}
        onRequestRecount={handleRequestRecount}
      />

      <AddEditStoreModal
        isOpen={isAddStoreModalOpen}
        onClose={() => {
          setIsAddStoreModalOpen(false);
          setEditingStore(null);
        }}
        editingStore={editingStore}
        onSaveStore={handleSaveStore}
      />

      <StoreDetailModal
        store={selectedStoreDetail}
        schedules={schedules}
        results={results}
        onClose={() => setSelectedStoreDetail(null)}
      />

      <ImportStoresModal
        isOpen={isImportStoresModalOpen}
        onClose={() => setIsImportStoresModalOpen(false)}
        onImportBulkStores={handleImportBulkStores}
      />

      <KorlapScheduleImageModal
        isOpen={isKorlapImageModalOpen}
        onClose={() => setIsKorlapImageModalOpen(false)}
        stores={stores}
        teams={teams}
        personnel={personnel}
        onAddMultipleSchedules={handleBatchCreateSchedules}
      />

      <AssignPersonnelModal
        isOpen={!!assignPersonnelSchedule}
        onClose={() => setAssignPersonnelSchedule(null)}
        schedule={assignPersonnelSchedule}
        personnel={personnel}
        onSaveAssignment={handleAssignPersonnelSave}
      />

      <GagalAtauPindahTokoModal
        isOpen={!!gagalPindahSchedule}
        onClose={() => setGagalPindahSchedule(null)}
        schedule={gagalPindahSchedule}
        stores={stores}
        onSubmitAction={handleGagalAtauPindahToko}
      />

      <RoleAuthModal
        isOpen={isRoleAuthModalOpen}
        targetRole={targetRoleToAuth}
        currentRole={currentRole}
        onClose={() => setIsRoleAuthModalOpen(false)}
        onSuccess={handleRoleAuthSuccess}
      />

      <InitialRoleAuthModal
        isOpen={isInitialRoleModalOpen}
        onSuccess={handleInitialRoleSuccess}
      />

    </div>
  );
}

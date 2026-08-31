export type RegionArea = 
  | 'Kota Denpasar'
  | 'Kab. Badung'
  | 'Kab. Gianyar'
  | 'Kab. Tabanan'
  | 'Kab. Buleleng'
  | 'Kab. Karangasem'
  | 'Kab. Jembrana'
  | 'Kab. Klungkung'
  | 'Kab. Bangli'
  | 'Kota Mataram & Lombok'
  | string;

export type StoreType = 'Flagship Supermarket' | 'Regular Minimarket' | 'Express Outlet' | 'Distribution Hub Center';

export type ScheduleStatus = 'Terjadwal' | 'Proses SO' | 'Menunggu Rekapan' | 'Selesai' | 'Dibatalkan' | 'Ditunda' | 'Gagal SO' | 'Pindah Toko';

export type ApprovalStatus = 'Menunggu Approval SPV' | 'Disetujui' | 'Perlu Audit Ulang' | 'Ditolak';

export interface CategoryVariance {
  category: string;
  systemQty: number;
  physicalQty: number;
  varianceQty: number;
  systemValueRp: number;
  physicalValueRp: number;
  varianceValueRp: number;
  mainCause?: string;
}

export type RiskLevel = 'Tinggi' | 'Sedang' | 'Rendah';

export interface Store {
  id: string;
  code: string; // KD TOKO e.g. TDVX, T-0001, F01O
  name: string; // NAMA e.g. SILIGITA - BADUNG
  region: RegionArea; // WILAYAH (e.g. BALI)
  address: string;
  city: string; // KABUPATEN or Kota
  district?: string; // KECAMATAN
  latitude?: number;
  longitude?: number;
  koordinat?: string; // Raw KOORDINAT string e.g. S8 48 05.7 E115 13 01.6
  am?: string; // AM
  as?: string; // AS
  saldoToko?: number | string; // SALDO TOKO (e.g. 346801712)
  kasToko?: number; // KAS TOKO e.g. 2500000
  kecamatan?: string; // KECAMATAN
  kabupaten?: string; // KABUPATEN
  coverage?: string; // COVERAGE: DC / IGR
  typeSo?: string; // Type SO: M / Q1 / Q2 / Q3
  qm?: string; // Q/M (M, Q2, etc.)
  tglSoMei?: string; // SO MEI '26
  tglSoJuni?: string; // SO JUNI '26
  tglSoJuli?: string; // SO JULI '26
  soAgustus?: string; // SO AGUSTUS '26
  soSeptember?: string; // SO SEPTEMBER '26
  statusApproveSO?: 'Sudah Approve' | 'Belum SO' | 'Belum Terapprove' | string; // Kolom status approve SO (Sudah Approve / Belum SO / Belum Terapprove)
  soOktober?: string; // SO OKTOBER '26
  soNovember?: string; // SO NOVEMBER '26
  soDesember?: string; // SO DESEMBER '26
  monthlySOHistory?: Record<string, string | number>; // Dynamic monthly SO history map
  frekuensiTidakSO?: number; // FREKUENSI TIDAK SO
  keterangan?: string; // KETERANGAN: TOKO EKSIS, WAJIB, dll.
  zona?: 'ZONA HITAM' | 'NON ZONA HITAM' | string; // ZONA: ZONA HITAM / NON ZONA HITAM
  isZonaHitam?: boolean;
  soAktiva?: string; // SO AKTIVA
  tglSoApproved?: string; // Tanggal SO yang disetujui SPV bulan berjalan
  smartClassification?: string; // Klasifikasi Kriteria Cerdas (Dynamic Category)
  korlap?: string; // KORLAP/OFFICER e.g. angga, pasek, odi
  jenisToko?: string; // JENIS TOKO e.g. STANDART NEW
  jop?: string | number; // JOP
  storeType: StoreType;
  managerName: string; // Kepala Toko / Korlap
  phone: string;
  assignedTeamId?: string;
  lastSODate?: string;
  lastAccuracyRate?: number; // percentage, e.g. 98.5
  totalSKUCount?: number;
  riskLevel?: RiskLevel;
}

export type AuditorPersonnelRole = 'Officer / Korlap' | 'Koordinator' | 'Anggota';

export type PersonnelStatus = 'Aktif' | 'Sakit' | 'Cuti' | 'Non-Aktif';

export interface AuditorPersonnel {
  id: string;
  nik: string;
  name: string;
  korlapName?: string; // Korlap/Officer
  phone: string;
  joinDate: string; // YYYY-MM-DD
  domisili?: string;
  role: AuditorPersonnelRole;
  teamId?: string;
  teamName?: string;
  status: PersonnelStatus;
  statusStartDate?: string; // YYYY-MM-DD for Sakit or Cuti
  statusEndDate?: string;   // YYYY-MM-DD for Sakit or Cuti
  statusNotes?: string;     // Notes/Keterangan
  lastLeaveType?: 'Sakit' | 'Cuti'; // Type of leave/sick recorded
  photoUrl?: string; // Cloudinary photo URL
  createdAt?: string;
  updatedAt?: string;
}

export type EquipmentCondition = 'Baik' | 'Oke' | 'Rusak' | 'Perbaikan';
export type RepairStatus = 'Rusak Belum Perbaikan' | 'Sedang Perbaikan' | 'Selesai Perbaikan';
export type ScannerColor = 'Merah' | 'Kuning' | 'Putih' | 'Hitam' | 'Biru' | 'Abu-abu' | string;
export type CanScanQR = 'Bisa' | 'Tidak' | string;

export interface SOEquipment {
  id: string;
  assetId: string; // e.g. EQ-SCAN-01 or WDCP-01
  name: string; // Nama Alat / WDCP
  category: 'WDCP' | 'Barcode Scanner' | 'Handheld PDA' | 'Tablet Audit' | 'Thermal Printer' | 'Laser Meter' | 'Aksesori & Powerbank' | string;
  assignedUser: string; // Nama user / Penanggung Jawab
  status: EquipmentCondition; // Baik / Oke / Rusak / Perbaikan
  serialNumber?: string; // Serial Number (MAC)
  scannerColor?: ScannerColor; // Warna scanner
  canScanQr?: CanScanQR; // Bisa scan QR Barcode: Bisa / Tidak
  photoUrl?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EquipmentRepairLog {
  id: string;
  equipmentId: string;
  assetId: string;
  equipmentName: string;
  repairStatus: RepairStatus;
  reportedDate: string; // YYYY-MM-DD
  damageDescription: string;
  startDate?: string; // YYYY-MM-DD
  completionDate?: string; // YYYY-MM-DD
  technicianName?: string;
  repairCostRp?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: 'Leader Tim SO' | 'Auditor Senior' | 'Auditor Junior' | 'Data Entry Specialist';
  phone: string;
}

export interface SOTeam {
  id: string;
  name: string; // e.g. Tim Alpha - Jabodetabek
  leaderName: string;
  members: TeamMember[];
  assignedRegions: RegionArea[];
  activeStoresCount: number;
  avgDurationHours: number;
  avgAccuracyAchieved: number;
}

export type ClusterProximityLevel = 'Optimal (<15km)' | 'Sedang (15-30km)' | 'Terlalu Jauh (>30km)';

export interface SOSchedule {
  id: string;
  storeId: string;
  storeCode: string;
  storeName: string;
  region: RegionArea;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  teamId: string;
  teamName: string;
  spvInCharge: string;
  officerInCharge?: string; // Korlap / Officer Penanggung Jawab
  groupName?: string; // GROUP (Korlap from sheet JADWAL e.g. ANGGA RISTA, ODI TRI, etc.)
  personilLeader?: string; // PERSONIL (Leader / Auditor from sheet JADWAL)
  teamCategory?: string; // TEAM (e.g. TEAM 1, TEAM 2, TEAM 3, TEAM GABUNG)
  dayName?: string; // HARI (e.g. SENIN, SELASA, RABU, KAMIS, JUMAT, SABTU, MINGGU)
  stockRp?: number | string; // STOCK RP from Master Toko
  kasToko?: number | string; // KAS TOKO from Master Toko
  typeSo?: string; // Q/M (M / Q3) from Master Toko
  zona?: string; // ZONA (ZONA HITAM / NON ZONA HITAM) from Master Toko
  asInitial?: string; // AS from Master Toko
  soAktiva?: string; // SO_AKTIVA
  status: ScheduleStatus;
  notes?: string;
  troubleNote?: string; // Kendala H-Day
  isRescheduled?: boolean;
  originalDate?: string;
  targetSKUCount: number;
  assignedPersonnelIds?: string[];
  assignedPersonnelNames?: string[];
  failureOrMoveType?: 'Gagal SO' | 'Pindah Toko';
  failureOrMoveReason?: string;
  replacementStoreCode?: string;
  replacementStoreName?: string;
  spvApprovalStatus?: ApprovalStatus;
  createdAt: string;
}

export interface StoreDistancePair {
  storeA: Store;
  storeB: Store;
  distanceKm: number;
  isFarWarning: boolean;
}

export interface OfficerClusterRoute {
  officerName: string;
  date: string;
  schedules: SOSchedule[];
  stores: Store[];
  maxDistanceKm: number;
  avgDistanceKm: number;
  totalDistanceKm: number;
  proximityLevel: ClusterProximityLevel;
  pairs: StoreDistancePair[];
}

export interface CustomNKLItem {
  id: string;
  label: string; // e.g. "Kontainer", "Sarana", "Lain-lain"
  type: 'plus' | 'minus';
  amountRp: number;
}

export interface CustomBrankasItem {
  id: string;
  label: string; // e.g. "Adanya Nota", "BA Varian", "Kupon"
  type: 'plus' | 'minus';
  amountRp: number;
}

export interface Top5Item {
  plu: string;
  description: string;
  valueRp: number;
}

export interface StoreConditionCheck {
  gudangKolian: 'Rapi' | 'Tidak Rapi';
  gudangRak: 'Rapi' | 'Tidak Rapi';
  areaToko: 'Rapi' | 'Tidak Rapi';
  iceCreamFrozen: 'Rapi' | 'Tidak Rapi';
}

export interface OperationalCheck {
  bpbBelumDiproses: 'Ya' | 'Tidak';
  returBelumDikirimDC: 'Ya' | 'Tidak';
  cekKirimanDenganAlat: 'Ya' | 'Tidak';
}

export interface CCTVCheck {
  dvrStatus: 'Berfungsi' | 'Tidak';
  kameraStatus: 'Berfungsi' | 'Tidak';
  lcdStatus: 'Berfungsi' | 'Tidak';
}

export interface BrankasAuditReport {
  // 1. Kas Toko
  kasTokoFinanceRp: number;
  fisikKasBrankasRp: number;
  fisikKasKasiranRp: number;
  selisihKasTokoRp: number; // (fisikKasBrankasRp + fisikKasKasiranRp) - kasTokoFinanceRp

  // 2. Target Uang Sales (Tutup Shift)
  uangSalesTutupShiftRp: number; // Total Target by data tutup shift
  salesAnak1Rp?: number;
  salesAnak2Rp?: number;
  salesAnak3Rp?: number;
  salesAnak4Rp?: number;
  salesPointCoffeeRp?: number;
  salesKompIndukRp?: number;
  salesKemarinRp?: number; // Target Sales Kemarin (Opsional) - Opsi A

  // 3. Fisik Uang Sales (Per Shift / Kasir)
  fisikSalesKompIndukRp?: number;
  fisikSalesAnak1Rp?: number;
  fisikSalesAnak2Rp?: number;
  fisikSalesAnak3Rp?: number;
  fisikSalesAnak4Rp?: number;
  fisikSalesPointCoffeeRp?: number;
  fisikSalesIndukRp: number; // Alias / Komp Induk
  fisikSalesAnakRp: number;  // Total of all anak
  fisikSalesKemarinRp: number; // Fisik Uang Sales Kemarin (Opsional)
  totalFisikSalesRp: number; // Total Seluruh Fisik Uang Sales (Induk + Anak 1..4 + Point Coffee + Kemarin)
  selisihSalesRp: number; // totalFisikSalesRp - uangSalesTutupShiftRp

  // 4. Custom Items (Nota, BA Varian, Kupon, dll.)
  customBrankasItems: CustomBrankasItem[];
  
  // Total Nett Hasil SO Brankas = Selisih Kas Toko + Selisih Sales + Nota & Lainnya
  nettSOBrankasRp: number;
}

export interface SOResult {
  id: string;
  scheduleId: string;
  storeId: string;
  storeCode: string;
  storeName: string;
  region: RegionArea;
  soDate: string;
  executedByTeam: string;
  spvApprover: string;

  // Management & Personnel
  namaAM?: string;
  namaAS?: string;
  namaPimpinanShift?: string;
  assignedPersonnelNames?: string[];

  // NK - NL & Custom NKL
  notaKurangNKValRp?: number;
  notaLebihNLValRp?: number;
  customNKLItems?: CustomNKLItem[];
  nettNKLValRp?: number;

  // Store Condition
  storeCondition?: StoreConditionCheck;

  // Operational Check
  opCheck?: OperationalCheck;

  // Non-displayed item count
  itemTidakTerdisplayCount?: number;

  // WDCP / PDA Hardware Audit
  wdcpAudit?: {
    totalUnits: number;
    workingUnits: number;
    brokenUnits: number;
  };

  // CCTV Check
  cctvCheck?: CCTVCheck;

  // SO Duration
  startTime?: string;
  endTime?: string;

  // Brankas Audit Report
  brankasReport?: BrankasAuditReport;

  // Top 5 Plus & Minus
  top5Plus?: Top5Item[];
  top5Minus?: Top5Item[];

  totalSKUChecked: number;
  systemQtyTotal: number;
  physicalQtyTotal: number;
  varianceQtyTotal: number; // physical - system
  
  systemValueTotalRp: number;
  physicalValueTotalRp: number;
  varianceValueTotalRp: number; // physicalValue - systemValue
  
  accuracyRatePercentage: number; // e.g. 98.4%
  approvalStatus: ApprovalStatus;
  
  categoryBreakdown: CategoryVariance[];
  notesAndActionPlan: string;
  baNumber: string; // Nomor Berita Acara, e.g. BA-SO/2026/08/0142
  submittedAt: string;
  approvedAt?: string;
  
  evidencePhotoUrl?: string;
}

export interface DashboardSummary {
  totalStores: number;
  completedThisMonth: number;
  scheduledThisMonth: number;
  inProgressCount: number;
  pendingApprovalCount: number;
  avgAccuracyRate: number;
  totalVarianceRp: number;
  positiveVarianceRp: number;
  negativeVarianceRp: number;
  highRiskStoreCount: number;
  // Toko Terjadwal, Belum Terjadwal, Ter-SO & Belum Ter-SO
  totalMasterStores: number;
  tokoTerjadwal: number;
  tokoBelumTerjadwal: number;
  tokoSudahTerSO: number;
  tokoBelumTerSO: number;
  persentaseTerSO: number;
  persentaseBelumTerSO: number;
  // Zona Hitam Metrics
  totalZonaHitam: number;
  zonaHitamTerSO: number;
  zonaHitamBelumSO: number;
  achievePercentZonaHitam: number;
  // Toko Wajib SO (Type M & Q3 / Custom Target) Metrics
  totalTokoWajibSO: number;
  tokoWajibSOTerSO: number;
  tokoWajibSOBelumSO: number;
  achievePercentWajibSO: number;
  breakdownTypeSO?: Record<string, { total: number; terSO: number; belumSO: number }>;
  targetTypesUsed?: string[];
  // Status Approval Breakdown
  tokoSudahApproveSO?: number;
  tokoBelumTerapproveSO?: number;
  tokoBelumSO?: number;
  tokoSedangSOList?: SOSchedule[];
}

export interface FilterOptions {
  searchQuery: string;
  region: string;
  storeType: string;
  status: string;
  riskLevel: string;
  dateFrom: string;
  dateTo: string;
}

export type UserRole = 'ALL' | 'SUPERVISOR' | 'OFFICER' | 'ADMIN';

export interface RoleInfo {
  id: UserRole;
  name: string;
  badge: string;
  icon: string;
  color: string;
  description: string;
  defaultPin: string;
}

export interface CompanyPortalLink {
  id: string;
  title: string;
  description: string;
  url: string;
  badge?: string;
  category?: string;
  iconName?: string;
  createdAt?: string;
}

export interface UniformRecord {
  id: string;
  batchTitle?: string;
  personnelNik?: string;
  personnelName?: string;
  korlapName?: string;
  category: 'Seragam Baru' | 'Seragam Lama';
  sizeS: number;
  sizeM: number;
  sizeL: number;
  sizeXL: number;
  sizeXXL: number;
  sizeXXXL: number;
  totalQty: number;
  receivedDate: string;
  notes?: string;
  cloudinaryBackupUrl?: string;
  createdAt: string;
}

export interface MasterTokoDataset {
  id: string;
  title: string;
  filename: string;
  uploadDate: string;
  uploadedBy?: string;
  storesCount: number;
  periodOrQuarter?: string;
  indicatorList: string[];
  isActiveForScheduling: boolean;
  notes?: string;
  stores: Store[];
  rawColumns?: string[];
}

export type StandbyStatus = 'Siap Standby' | 'On-Call Aktif' | 'Terpanggil Tugas' | 'Selesai' | 'Batal / Sakit';

export interface OnCallPersonnelRecord {
  id: string;
  date: string; // YYYY-MM-DD (e.g. tanggal libur / tanggal merah)
  holidayName?: string; // e.g. "Hari Libur Nasional / Minggu / Cuti Bersama"
  korlapName: string; // Nama Korlap penanggung jawab
  region?: RegionArea | string; // Wilayah operasional
  personnelId: string; // ID personil dari master personil aktif
  personnelName: string;
  personnelNik?: string;
  personnelPhone?: string;
  role?: string; // Leader Tim SO / Auditor Senior / Junior / Data Entry
  shiftType?: 'Full Day (08:00 - 17:00)' | 'Shift Pagi' | 'Shift Malam' | 'Standby 24 Jam' | string;
  standbyStatus: StandbyStatus;
  assignedStoreOrArea?: string; // Area / Toko antisipasi
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}




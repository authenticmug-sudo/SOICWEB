import { AuditorPersonnel, SOSchedule, Store } from '../types/stockOpname';
import { BALI_PERSONNEL_DATA } from '../data/baliData';

/**
 * Standard 6 Bali Korlap Groups (as defined in JADWAL & PERSONIL Master)
 */
export const PRIMARY_BALI_KORLAPS: string[] = [
  'I WAYAN ANGGA RISTA',
  'ODI TRI ANGGARA',
  'ANGGA ARDIYANSYAH',
  'ABDUL RAHMAN',
  'I GEDE PASEK SANTIKA',
  'PUTU BISMA'
];

/**
 * Known Aliases & Short Names mapping for Bali Korlaps
 */
interface KorlapProfile {
  canonicalName: string;
  shortName: string;
  aliases: string[];
  defaultLeader?: string;
}

export const KORLAP_PROFILES: KorlapProfile[] = [
  {
    canonicalName: 'ODI TRI ANGGARA',
    shortName: 'ODI',
    aliases: [
      'odi',
      'odi tri',
      'odi tri anggara',
      'odi anggara',
      'tim odi',
      'team odi',
      'group odi',
      'tri anggara'
    ],
    defaultLeader: 'MUHAMMAD BAGUS MAULANA'
  },
  {
    canonicalName: 'ANGGA ARDIYANSYAH',
    shortName: 'ANGGA ARDI',
    aliases: [
      'angga ardiyansyah',
      'angga ardi',
      'ardiyansyah',
      'tim angga ardiyansyah',
      'team angga ardiyansyah',
      'tim ardiyansyah',
      'group ardiyansyah'
    ],
    defaultLeader: 'RAFLI SALMAN ADITYA'
  },
  {
    canonicalName: 'I WAYAN ANGGA RISTA',
    shortName: 'ANGGA RISTA',
    aliases: [
      'i wayan angga rista',
      'i wayan angga',
      'wayan angga rista',
      'wayan angga',
      'angga rista',
      'angga',
      'tim angga',
      'team angga',
      'group angga',
      'tim wayan angga',
      'team 1',
      'tim 1'
    ],
    defaultLeader: 'YOGI SEPTA ARIF PRATAMA'
  },
  {
    canonicalName: 'ABDUL RAHMAN',
    shortName: 'ABDUL',
    aliases: [
      'abdul rahman',
      'abdul',
      'rahman',
      'tim abdul',
      'team abdul',
      'group abdul',
      'tim abdul rahman'
    ],
    defaultLeader: 'MUHAMMAD FARHAN'
  },
  {
    canonicalName: 'I GEDE PASEK SANTIKA',
    shortName: 'PASEK',
    aliases: [
      'i gede pasek santika',
      'i gede pasek',
      'gede pasek',
      'pasek santika',
      'pasek',
      'santika',
      'tim pasek',
      'team pasek',
      'group pasek'
    ],
    defaultLeader: 'M LUTFILAH'
  },
  {
    canonicalName: 'PUTU BISMA',
    shortName: 'BISMA',
    aliases: [
      'putu bisma',
      'bisma',
      'tim bisma',
      'team bisma',
      'group bisma',
      'putu'
    ],
    defaultLeader: 'GEDE ARIASA'
  }
];

/**
 * Get all available Korlap names dynamically from Master Personil
 */
export function getAvailableKorlapList(personnel?: AuditorPersonnel[]): string[] {
  const list: string[] = [];
  const set = new Set<string>();

  // 1. From Personnel Master Data
  if (personnel && personnel.length > 0) {
    personnel.forEach(p => {
      if (p.role === 'Officer / Korlap' && p.name) {
        set.add(p.name.trim().toUpperCase());
      }
      if (p.korlapName) {
        set.add(p.korlapName.trim().toUpperCase());
      }
    });
  }

  // 2. Ensure standard 6 are included in preferred order
  PRIMARY_BALI_KORLAPS.forEach(k => {
    set.add(k.toUpperCase());
    list.push(k);
  });

  // 3. Add any other discovered Korlaps
  set.forEach(k => {
    if (!list.includes(k)) {
      list.push(k);
    }
  });

  return list;
}

/**
 * Intelligently normalize any raw Korlap string (from Excel or user input)
 * to the official canonical Korlap Name from Master Personil.
 */
export function normalizeKorlapName(rawInput?: string | null): string {
  if (!rawInput) return '';
  const clean = rawInput.trim().toLowerCase();
  if (!clean || clean === '-' || clean === 'null' || clean === 'undefined' || clean === 'petugas so') {
    return '';
  }

  // Strip generic prefixes like "tim ", "team ", "group ", "korlap ", "officer "
  const stripped = clean
    .replace(/^(tim|team|group|korlap|officer)\s+/i, '')
    .replace(/\s+\((officer|korlap|spv|leader)\)$/i, '')
    .trim();

  // 1. Check exact / alias match in KORLAP_PROFILES with priority order
  // Priority: Check specific compound names first before single words!
  
  // A. Check Odi Tri Anggara specifically
  if (
    stripped === 'odi' || 
    stripped.startsWith('odi ') || 
    stripped.endsWith(' odi') ||
    stripped === 'odi tri' ||
    stripped === 'odi tri anggara' ||
    stripped === 'tri anggara'
  ) {
    return 'ODI TRI ANGGARA';
  }

  // B. Check Angga Ardiyansyah specifically
  if (
    stripped === 'ardiyansyah' ||
    stripped === 'angga ardi' ||
    stripped.includes('ardiyansyah')
  ) {
    return 'ANGGA ARDIYANSYAH';
  }

  // C. Check I Wayan Angga Rista specifically
  if (
    stripped === 'angga' ||
    stripped === 'angga rista' ||
    stripped === 'wayan angga' ||
    stripped === 'wayan angga rista' ||
    stripped === 'i wayan angga' ||
    stripped === 'i wayan angga rista' ||
    stripped === 'rista'
  ) {
    return 'I WAYAN ANGGA RISTA';
  }

  // D. Check Abdul Rahman
  if (
    stripped === 'abdul' ||
    stripped === 'abdul rahman' ||
    stripped === 'rahman'
  ) {
    return 'ABDUL RAHMAN';
  }

  // E. Check I Gede Pasek Santika
  if (
    stripped === 'pasek' ||
    stripped === 'gede pasek' ||
    stripped === 'pasek santika' ||
    stripped === 'i gede pasek' ||
    stripped === 'i gede pasek santika' ||
    stripped === 'santika'
  ) {
    return 'I GEDE PASEK SANTIKA';
  }

  // F. Check Putu Bisma
  if (
    stripped === 'bisma' ||
    stripped === 'putu bisma'
  ) {
    return 'PUTU BISMA';
  }

  // 2. Generic profile alias search
  for (const profile of KORLAP_PROFILES) {
    if (profile.aliases.includes(stripped) || profile.canonicalName.toLowerCase() === stripped) {
      return profile.canonicalName;
    }
  }

  // 3. Fallback: Return uppercase formatted
  return rawInput.trim().toUpperCase();
}

/**
 * Strict Korlap matching function to prevent false positives (like 'angga' matching 'odi tri anggara').
 * 
 * @param candidate - The schedule's officerInCharge, groupName, or store's korlap
 * @param targetKorlap - The selected Korlap filter (e.g. 'ODI TRI ANGGARA')
 */
export function isKorlapMatch(
  candidate?: string | null,
  targetKorlap?: string | null
): boolean {
  if (!targetKorlap || targetKorlap === 'ALL') return true;
  if (!candidate) return false;

  const normTarget = normalizeKorlapName(targetKorlap);
  const normCandidate = normalizeKorlapName(candidate);

  // 1. Direct canonical comparison
  if (normTarget && normCandidate) {
    if (normTarget === normCandidate) return true;
  }

  // 2. Specific alias check against the target profile
  const targetProfile = KORLAP_PROFILES.find(p => p.canonicalName === normTarget);
  if (targetProfile) {
    const rawCandClean = candidate.trim().toLowerCase().replace(/^(tim|team|group|korlap|officer)\s+/i, '').trim();
    if (targetProfile.aliases.includes(rawCandClean)) {
      return true;
    }
  }

  // 3. Strict Word-Boundary Token Matching (Never allow substring 'angga' in 'odi tri anggara')
  const candLower = candidate.toLowerCase().trim();
  const targetLower = targetKorlap.toLowerCase().trim();

  // If searching for ODI, cand must have 'odi'
  if (normTarget === 'ODI TRI ANGGARA') {
    return candLower.includes('odi');
  }

  // If searching for ANGGA ARDIYANSYAH, cand must have 'ardiyansyah' or 'ardi'
  if (normTarget === 'ANGGA ARDIYANSYAH') {
    return candLower.includes('ardiyansyah') || candLower.includes('ardi');
  }

  // If searching for I WAYAN ANGGA RISTA:
  // Must have 'angga' or 'rista' or 'wayan', but MUST NOT have 'odi' or 'ardiyansyah'
  if (normTarget === 'I WAYAN ANGGA RISTA') {
    if (candLower.includes('odi') || candLower.includes('ardiyansyah')) return false;
    return candLower.includes('angga') || candLower.includes('rista') || candLower.includes('wayan');
  }

  // If searching for ABDUL RAHMAN
  if (normTarget === 'ABDUL RAHMAN') {
    return candLower.includes('abdul') || candLower.includes('rahman');
  }

  // If searching for I GEDE PASEK SANTIKA
  if (normTarget === 'I GEDE PASEK SANTIKA') {
    return candLower.includes('pasek') || candLower.includes('santika');
  }

  // If searching for PUTU BISMA
  if (normTarget === 'PUTU BISMA') {
    return candLower.includes('bisma');
  }

  return false;
}

/**
 * Resolve display information for the Personil column:
 * Returns { leaderName, groupDisplayName, roleTag, memberCount }
 */
export function resolveSchedulePersonnelDisplay(
  schedule: SOSchedule,
  store?: Store,
  personnelList: AuditorPersonnel[] = BALI_PERSONNEL_DATA
): {
  leaderName: string;
  groupDisplayName: string;
  isCustomAssigned: boolean;
  assignedCount: number;
} {
  const assigned = schedule.assignedPersonnelNames || [];
  const assignedCount = assigned.length;
  
  // 1. Determine Official Korlap Group Name
  const rawKorlap = schedule.groupName || schedule.officerInCharge || store?.korlap || '';
  const canonicalKorlap = normalizeKorlapName(rawKorlap) || 'I WAYAN ANGGA RISTA';
  
  // Find Profile
  const profile = KORLAP_PROFILES.find(p => p.canonicalName === canonicalKorlap);
  const shortGroupName = profile ? `Tim ${profile.shortName}` : `Tim ${canonicalKorlap.split(' ')[0]}`;

  // 2. Determine Personil Leader
  let leaderName = '';

  if (assigned.length > 0) {
    leaderName = assigned[0];
    return {
      leaderName,
      groupDisplayName: canonicalKorlap,
      isCustomAssigned: true,
      assignedCount
    };
  }

  if (schedule.personilLeader && schedule.personilLeader.trim() && schedule.personilLeader.toLowerCase() !== 'tim' && schedule.personilLeader.toLowerCase() !== 'petugas so') {
    leaderName = schedule.personilLeader.trim();
  } else {
    // Lookup Coordinator in Master Personil for this Korlap
    const matchingCoordinator = personnelList.find(p => 
      p.role === 'Koordinator' && isKorlapMatch(p.korlapName, canonicalKorlap)
    );

    if (matchingCoordinator) {
      leaderName = matchingCoordinator.name;
    } else if (profile?.defaultLeader) {
      leaderName = profile.defaultLeader;
    } else {
      leaderName = canonicalKorlap;
    }
  }

  return {
    leaderName,
    groupDisplayName: canonicalKorlap,
    isCustomAssigned: false,
    assignedCount: 0
  };
}

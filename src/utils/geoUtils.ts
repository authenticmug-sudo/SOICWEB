import { Store, RegionArea, SOSchedule, OfficerClusterRoute, StoreDistancePair, ClusterProximityLevel } from '../types/stockOpname';

export interface ParsedCoordinate {
  latitude?: number;
  longitude?: number;
  isValid: boolean;
  formattedDMS?: string;
  formattedDD?: string;
}

/**
 * Universal Coordinate Parser
 * Parses Decimal Degrees (DD), Degrees Minutes Seconds (DMS), and Google Maps strings.
 * Examples handled:
 * - "S8 45 27.3 E115 10 36.1"
 * - "8°41'18.55\"S 115°14'17.47\"E"
 * - "S 8 37 55.01 E115 11 53.17"
 * - "-8.5442796, 115.1425756"
 * - "8.5442796 S, 115.1425756 E"
 */
export function parseCoordinates(rawInput: any): ParsedCoordinate {
  if (!rawInput) return { isValid: false };

  const str = String(rawInput).trim();
  if (!str) return { isValid: false };

  // 1. Google Maps URL or @lat,lng format
  const urlMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || str.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (urlMatch) {
    const lat = parseFloat(urlMatch[1]);
    const lng = parseFloat(urlMatch[2]);
    return finalizeCoordinate(lat, lng, str);
  }

  // Normalize string for regex parsing: replace degree/minute/second symbols with spaces
  const cleanStr = str
    .replace(/[°'"]/g, ' ')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  // 2. Try DMS Regex with S/N/E/W direction tags
  // Lat match: (S|N) then degrees, minutes, seconds OR degrees, minutes, seconds, (S|N)
  const dmsLatMatch = cleanStr.match(/(S|N)\s*(\d{1-[23]|\d{1,2})\s+(\d{1,2})\s+(\d{1,2}(?:\.\d+)?)/) ||
                      cleanStr.match(/(S|N)\s*(\d{1,2})\s+(\d{1,2}(?:\.\d+)?)/) ||
                      cleanStr.match(/(\d{1,2})\s+(\d{1,2})\s+(\d{1,2}(?:\.\d+)?)\s*(S|N)/) ||
                      cleanStr.match(/(\d{1,2})\s+(\d{1,2}(?:\.\d+)?)\s*(S|N)/);

  const dmsLngMatch = cleanStr.match(/(E|W)\s*(\d{1,3})\s+(\d{1,2})\s+(\d{1,2}(?:\.\d+)?)/) ||
                      cleanStr.match(/(E|W)\s*(\d{1,3})\s+(\d{1,2}(?:\.\d+)?)/) ||
                      cleanStr.match(/(\d{1,3})\s+(\d{1,2})\s+(\d{1,2}(?:\.\d+)?)\s*(E|W)/) ||
                      cleanStr.match(/(\d{1,3})\s+(\d{1,2}(?:\.\d+)?)\s*(E|W)/);

  if (dmsLatMatch && dmsLngMatch) {
    let latDir = 'S';
    let latDeg = 0, latMin = 0, latSec = 0;

    if (dmsLatMatch[1] === 'S' || dmsLatMatch[1] === 'N') {
      latDir = dmsLatMatch[1];
      latDeg = parseFloat(dmsLatMatch[2]) || 0;
      latMin = parseFloat(dmsLatMatch[3]) || 0;
      latSec = parseFloat(dmsLatMatch[4]) || 0;
    } else {
      latDeg = parseFloat(dmsLatMatch[1]) || 0;
      latMin = parseFloat(dmsLatMatch[2]) || 0;
      latSec = parseFloat(dmsLatMatch[3]) || 0;
      latDir = dmsLatMatch[4] || (str.toUpperCase().includes('S') ? 'S' : 'N');
    }

    let lngDir = 'E';
    let lngDeg = 0, lngMin = 0, lngSec = 0;

    if (dmsLngMatch[1] === 'E' || dmsLngMatch[1] === 'W') {
      lngDir = dmsLngMatch[1];
      lngDeg = parseFloat(dmsLngMatch[2]) || 0;
      lngMin = parseFloat(dmsLngMatch[3]) || 0;
      lngSec = parseFloat(dmsLngMatch[4]) || 0;
    } else {
      lngDeg = parseFloat(dmsLngMatch[1]) || 0;
      lngMin = parseFloat(dmsLngMatch[2]) || 0;
      lngSec = parseFloat(dmsLngMatch[3]) || 0;
      lngDir = dmsLngMatch[4] || (str.toUpperCase().includes('W') ? 'W' : 'E');
    }

    let lat = latDeg + (latMin / 60) + (latSec / 3600);
    if (latDir === 'S') lat = -lat;

    let lng = lngDeg + (lngMin / 60) + (lngSec / 3600);
    if (lngDir === 'W') lng = -lng;

    return finalizeCoordinate(lat, lng, str);
  }

  // 3. Fallback: Extract floating point / signed numbers
  const numberMatches = str.match(/-?\d+(?:\.\d+)?/g);
  if (numberMatches && numberMatches.length >= 2) {
    // If there are 6 or more numbers, they could be DMS without S/E tags (e.g., 8 45 27.3 115 10 36.1)
    if (numberMatches.length >= 6) {
      const d1 = Math.abs(parseFloat(numberMatches[0]));
      const m1 = parseFloat(numberMatches[1]);
      const s1 = parseFloat(numberMatches[2]);

      const d2 = Math.abs(parseFloat(numberMatches[3]));
      const m2 = parseFloat(numberMatches[4]);
      const s2 = parseFloat(numberMatches[5]);

      if (d1 < 90 && m1 < 60 && s1 < 60 && d2 < 180 && m2 < 60 && s2 < 60) {
        let lat = d1 + m1 / 60 + s1 / 3600;
        if (str.toUpperCase().includes('S') || parseFloat(numberMatches[0]) < 0) lat = -lat;

        let lng = d2 + m2 / 60 + s2 / 3600;
        if (str.toUpperCase().includes('W') || parseFloat(numberMatches[3]) < 0) lng = -lng;

        return finalizeCoordinate(lat, lng, str);
      }
    }

    let n1 = parseFloat(numberMatches[0]);
    let n2 = parseFloat(numberMatches[1]);

    if (str.toUpperCase().includes('S') && n1 > 0) n1 = -n1;
    if (str.toUpperCase().includes('W') && n2 > 0) n2 = -n2;

    return finalizeCoordinate(n1, n2, str);
  }

  return { isValid: false };
}

function finalizeCoordinate(lat: number, lng: number, originalStr?: string): ParsedCoordinate {
  if (isNaN(lat) || isNaN(lng)) return { isValid: false };

  // Sanity check for swapped lat/lng in Indonesia
  // Indonesia Latitude is ~ -11 to +6, Longitude is ~ 95 to 141
  if (Math.abs(lat) > 50 && Math.abs(lng) <= 20) {
    const temp = lat;
    lat = lng;
    lng = temp;
  }

  // Auto-correct Bali/Indonesia Southern Hemisphere if latitude was mistakenly given positive (e.g. +8 instead of -8)
  if (lat > 0 && lat < 12 && (lng > 95 && lng < 141)) {
    // In Indonesia, positive latitude <= 6 is North of equator, but Bali is South (-8.x).
    // If original string contains 'S' or location context is Bali, make it negative.
    if (originalStr && (originalStr.toUpperCase().includes('S') || originalStr.toUpperCase().includes('BALI'))) {
      lat = -lat;
    } else if (lat > 5 && lat < 10) {
      // 8.xx in Indonesia is Bali/Java (Southern hemisphere)
      lat = -lat;
    }
  }

  // Auto-correct missing digit '5' in Bali longitude (e.g., 11.52608 -> 115.52608)
  if (lat >= -9.5 && lat <= -7.5 && lng >= 11.0 && lng <= 12.0) {
    const lngStr = String(lng);
    if (lngStr.startsWith('11.')) {
      lng = parseFloat(lngStr.replace('11.', '115.'));
    } else {
      lng = lng + 104;
    }
  }

  // Ensure lat in [-90, 90] and lng in [-180, 180]
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { isValid: false };
  }

  // Sanity check: Ensure coordinates are within valid Indonesian territory (lat [-11, 6], lng [95, 141])
  // Reject non-Indonesian coordinates (e.g. Africa/Atlantic Ocean) as invalid
  if (lat < -11 || lat > 6 || lng < 95 || lng > 141) {
    return { isValid: false };
  }

  const roundedLat = Math.round(lat * 10000000) / 10000000;
  const roundedLng = Math.round(lng * 10000000) / 10000000;

  // Format to standard DMS string for display
  const absLat = Math.abs(roundedLat);
  const latD = Math.floor(absLat);
  const latM = Math.floor((absLat - latD) * 60);
  const latS = Math.round(((absLat - latD) * 60 - latM) * 60 * 10) / 10;

  const absLng = Math.abs(roundedLng);
  const lngD = Math.floor(absLng);
  const lngM = Math.floor((absLng - lngD) * 60);
  const lngS = Math.round(((absLng - lngD) * 60 - lngM) * 60 * 10) / 10;

  const formattedDMS = `${roundedLat < 0 ? 'S' : 'N'}${latD}° ${latM}' ${latS}" ${roundedLng < 0 ? 'W' : 'E'}${lngD}° ${lngM}' ${lngS}"`;
  const formattedDD = `${roundedLat}, ${roundedLng}`;

  return {
    latitude: roundedLat,
    longitude: roundedLng,
    isValid: true,
    formattedDMS,
    formattedDD
  };
}

export function getKabupatenFromCoordinates(lat: number, lng: number): string | null {
  if (lat < -9.5 || lat > -7.5 || lng < 114.0 || lng > 117.0) {
    return null;
  }

  // 1. Mataram / Lombok (East of 115.85)
  if (lng >= 115.85) {
    return 'MATARAM';
  }

  // 2. Jembrana (West Bali, West of 114.95)
  if (lng < 114.95) {
    return 'JEMBRANA';
  }

  // 3. Buleleng (North Bali: lat is NORTH of -8.28, i.e. lat > -8.28, Lng 114.85 to 115.38)
  if (lat > -8.28 && lng >= 114.85 && lng <= 115.38) {
    return 'BULELENG';
  }

  // 4. Karangasem (East Bali, Lng >= 115.48)
  if (lng >= 115.48) {
    return 'KARANGASEM';
  }

  // 5. Bangli (Central Mountainous: Lat between -8.20 and -8.48, Lng 115.28 to 115.42)
  if (lat <= -8.20 && lat >= -8.48 && lng >= 115.28 && lng <= 115.42) {
    return 'BANGLI';
  }

  // 6. Klungkung (Southeast Bali & Nusa Penida)
  if ((lat <= -8.52 && lat >= -8.65 && lng >= 115.36 && lng <= 115.48) || (lat <= -8.65 && lat >= -8.88 && lng >= 115.40 && lng <= 115.60)) {
    return 'KLUNGKUNG';
  }

  // 7. Gianyar (Central South, Lng 115.22 to 115.35, Lat between -8.38 and -8.62)
  if (lng >= 115.22 && lng <= 115.35 && lat <= -8.38 && lat >= -8.62) {
    return 'GIANYAR';
  }

  // 8. Tabanan (Central West, Lng 114.95 to 115.16)
  if (lng >= 114.95 && lng < 115.16) {
    return 'TABANAN';
  }

  // 9. Kota Denpasar (Capital region: Lat -8.60 to -8.72, Lng 115.18 to 115.26)
  if (lat <= -8.60 && lat >= -8.72 && lng >= 115.18 && lng <= 115.26) {
    return 'DENPASAR';
  }

  // 10. Badung (Default for remaining Badung corridor: Kuta, Jimbaran, Nusa Dua, Mengwi, Canggu, Abiansemal, Petang, etc.)
  return 'BADUNG';
}

/**
 * Auto-detects and synchronizes `region`, `city`, and `kabupaten` for a store
 * based on coordinates (lat, lng), store code, name, address, and text metadata.
 * PRESERVES exact user-uploaded master data and never injects fake dummy coordinates.
 */
export function autoSyncStoreRegionAndKabupaten(store: Store): Store {
  if (!store) return store;

  const updatedStore = { ...store };

  // 1. Extract & parse existing coordinates if present (Do NOT inject synthetic dummy lat/lng!)
  let lat = updatedStore.latitude;
  let lng = updatedStore.longitude;

  if (updatedStore.koordinat) {
    const parsed = parseCoordinates(updatedStore.koordinat);
    if (parsed.isValid && parsed.latitude !== undefined && parsed.longitude !== undefined) {
      lat = parsed.latitude;
      lng = parsed.longitude;
      updatedStore.latitude = lat;
      updatedStore.longitude = lng;
    }
  } else if (lat !== undefined && lng !== undefined) {
    const parsed = parseCoordinates(`${lat}, ${lng}`);
    if (parsed.isValid && parsed.latitude !== undefined && parsed.longitude !== undefined) {
      lat = parsed.latitude;
      lng = parsed.longitude;
      updatedStore.latitude = lat;
      updatedStore.longitude = lng;
      if (!updatedStore.koordinat) {
        updatedStore.koordinat = `${lat}, ${lng}`;
      }
    }
  }

  // 2. Only infer kabupaten if store.kabupaten (and store.city) is missing/empty
  const existingKab = (updatedStore.kabupaten || updatedStore.city || '').trim();
  if (!existingKab) {
    let detectedKabupaten = '';

    // Check if valid Bali/Lombok coordinates exist and derive kabupaten
    if (lat !== undefined && lng !== undefined && lat <= -7.8 && lat >= -9.2 && lng >= 114.2 && lng <= 116.8) {
      const coordKab = getKabupatenFromCoordinates(lat, lng);
      if (coordKab) {
        detectedKabupaten = coordKab;
      }
    }

    // Check address/district text if still not found
    if (!detectedKabupaten) {
      const addressText = `${updatedStore.address || ''} ${updatedStore.district || ''} ${updatedStore.kecamatan || ''}`.toLowerCase();
      if (/buleleng|singaraja|seririt|grokgak|busungbiu|sawan|sukasada|banjar|kubutambahan|tejakula/i.test(addressText)) {
        detectedKabupaten = 'BULELENG';
      } else if (/jembrana|negara|mendoyo|melaya|pekutatan|pengambengan|gilimanuk/i.test(addressText)) {
        detectedKabupaten = 'JEMBRANA';
      } else if (/gianyar|ubud|sukawati|blahbatuh|tegallalang|payangan|tampak/i.test(addressText)) {
        detectedKabupaten = 'GIANYAR';
      } else if (/tabanan|kediri|selemadeg|baturiti|marga|penebel|pupuan/i.test(addressText)) {
        detectedKabupaten = 'TABANAN';
      } else if (/klungkung|semarapura|nusa penida|banjarangkan|dawan/i.test(addressText)) {
        detectedKabupaten = 'KLUNGKUNG';
      } else if (/bangli|kintamani|susut|tembuku/i.test(addressText)) {
        detectedKabupaten = 'BANGLI';
      } else if (/karangasem|amlapura|manggis|rendang|selat|kubu|bebandem|candidasa/i.test(addressText)) {
        detectedKabupaten = 'KARANGASEM';
      } else if (/denpasar|renon|sanur|teuku umar|sesetan|pemogan|gatot subroto|ubung|sidakarya|pedungan/i.test(addressText)) {
        detectedKabupaten = 'DENPASAR';
      } else if (/mataram|lombok|cakranegara|ampenan|senggigi/i.test(addressText)) {
        detectedKabupaten = 'MATARAM';
      } else if (/badung|kuta|jimbaran|nusa dua|mengwi|canggu|abiansemal|petang|legian|seminyak|kerobokan|tuban|kedonganan|dalung/i.test(addressText)) {
        detectedKabupaten = 'BADUNG';
      }
    }

    if (detectedKabupaten) {
      const formattedKabupaten = detectedKabupaten === 'DENPASAR' || detectedKabupaten === 'MATARAM' 
        ? `KOTA ${detectedKabupaten}` 
        : `KAB. ${detectedKabupaten}`;
      updatedStore.kabupaten = formattedKabupaten;
      updatedStore.city = formattedKabupaten;
    }
  }

  return updatedStore;
}

/**
 * Ensures a Store object has clean, accurate latitude and longitude numbers.
 * Auto-parses `store.koordinat` if present and auto-corrects Bali stores
 * that were mistakenly assigned default Jakarta/Java coordinates.
 */
export function ensureStoreCoordinates(store: Store): Store {
  return autoSyncStoreRegionAndKabupaten(store);
}

/**
 * Calculates the great-circle distance between two points on the Earth
 * using the Haversine formula.
 * @returns Distance in kilometers
 */
export function calculateHaversineDistance(
  lat1?: number, 
  lon1?: number, 
  lat2?: number, 
  lon2?: number
): number {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return 0;
  }

  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

/**
 * Evaluates proximity level based on max distance between scheduled stores in a cluster.
 */
export function getProximityLevel(maxDistanceKm: number): ClusterProximityLevel {
  if (maxDistanceKm <= 15) return 'Optimal (<15km)';
  if (maxDistanceKm <= 30) return 'Sedang (15-30km)';
  return 'Terlalu Jauh (>30km)';
}

/**
 * Groups schedules by Officer & Date to evaluate geographic clustering.
 */
export function analyzeOfficerClusters(
  schedules: SOSchedule[],
  stores: Store[],
  targetDate?: string,
  targetOfficer?: string
): OfficerClusterRoute[] {
  const storeMap = new Map<string, Store>();
  stores.forEach(s => {
    storeMap.set(s.id, s);
    storeMap.set(s.code, s);
  });

  // Map key: "OFFICER|DATE"
  const groups = new Map<string, { officer: string; date: string; scheds: SOSchedule[] }>();

  schedules.forEach(sched => {
    // Only analyze valid non-cancelled schedules
    if (sched.status === 'Dibatalkan') return;

    if (targetDate && targetDate !== 'ALL' && sched.scheduledDate !== targetDate) return;
    const officer = sched.officerInCharge || sched.spvInCharge || 'Officer Korlap Bali';
    if (targetOfficer && targetOfficer !== 'ALL' && officer !== targetOfficer) return;

    const key = `${officer}|${sched.scheduledDate}`;
    if (!groups.has(key)) {
      groups.set(key, { officer, date: sched.scheduledDate, scheds: [] });
    }
    groups.get(key)!.scheds.push(sched);
  });

  const clusterRoutes: OfficerClusterRoute[] = [];

  groups.forEach(({ officer, date, scheds }) => {
    const matchedStores: Store[] = [];
    scheds.forEach(sc => {
      const st = storeMap.get(sc.storeId) || storeMap.get(sc.storeCode);
      if (st && st.latitude && st.longitude) {
        if (!matchedStores.some(existing => existing.id === st.id)) {
          matchedStores.push(st);
        }
      }
    });

    const pairs: StoreDistancePair[] = [];
    let totalDist = 0;
    let maxDist = 0;

    if (matchedStores.length >= 2) {
      for (let i = 0; i < matchedStores.length - 1; i++) {
        const storeA = matchedStores[i];
        const storeB = matchedStores[i + 1];
        const dist = calculateHaversineDistance(
          storeA.latitude, storeA.longitude,
          storeB.latitude, storeB.longitude
        );

        const isFarWarning = dist > 25;
        pairs.push({ storeA, storeB, distanceKm: dist, isFarWarning });
        totalDist += dist;
        if (dist > maxDist) maxDist = dist;
      }
    }

    const avgDist = pairs.length > 0 ? Math.round((totalDist / pairs.length) * 10) / 10 : 0;
    const proximityLevel = getProximityLevel(maxDist);

    clusterRoutes.push({
      officerName: officer,
      date,
      schedules: scheds,
      stores: matchedStores,
      maxDistanceKm: maxDist,
      avgDistanceKm: avgDist,
      totalDistanceKm: Math.round(totalDist * 10) / 10,
      proximityLevel,
      pairs
    });
  });

  // Sort by date descending
  return clusterRoutes.sort((a, b) => b.date.localeCompare(a.date));
}

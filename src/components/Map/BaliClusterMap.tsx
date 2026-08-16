import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Store, SOSchedule, AuditorPersonnel } from '../../types/stockOpname';
import { calculateHaversineDistance, analyzeOfficerClusters, ensureStoreCoordinates, autoSyncStoreRegionAndKabupaten, parseCoordinates } from '../../utils/geoUtils';
import { 
  MapPin, 
  Navigation, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  ShieldAlert, 
  RefreshCw, 
  Filter, 
  Layers, 
  Info,
  Route,
  Compass,
  Sparkles,
  Plus,
  Trash2,
  Search,
  Copy,
  Check,
  ArrowUp,
  ArrowDown,
  Zap,
  Share2,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface BaliClusterMapProps {
  stores: Store[];
  schedules: SOSchedule[];
  personnel?: AuditorPersonnel[];
  onUpdateSchedule?: (updated: SOSchedule) => void;
}

export const BaliClusterMap: React.FC<BaliClusterMapProps> = ({
  stores,
  schedules,
  personnel = [],
  onUpdateSchedule
}) => {
  const [mapContainerNode, setMapContainerNode] = useState<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const mapContainerRef = React.useCallback((node: HTMLDivElement | null) => {
    setMapContainerNode(node);
  }, []);

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>('ALL');
  const [selectedMonthPeriod, setSelectedMonthPeriod] = useState<string>('2026-08');
  const [mapColorMode, setMapColorMode] = useState<'monthlySO' | 'dailyStatus'>('monthlySO');
  const [selectedOfficer, setSelectedOfficer] = useState<string>('ALL');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('Bali & Nusa Tenggara');
  const [activeTab, setActiveTab] = useState<'map' | 'routeCalculator' | 'clusters' | 'troubles'>('map');
  const [isMapFullscreen, setIsMapFullscreen] = useState<boolean>(false);
  const [selectedKabupatenFocus, setSelectedKabupatenFocus] = useState<string>('ALL');

  // Selected Store for detail modal / reschedule
  const [rescheduleModalSchedule, setRescheduleModalSchedule] = useState<SOSchedule | null>(null);
  const [newDateInput, setNewDateInput] = useState<string>('');
  const [newOfficerInput, setNewOfficerInput] = useState<string>('');
  const [troubleNoteInput, setTroubleNoteInput] = useState<string>('');

  // ---------------- MULTI-STORE ROUTE CALCULATOR STATES ---------------- //
  const [selectedRouteStores, setSelectedRouteStores] = useState<Store[]>([]);
  const [storeSearchInput, setStoreSearchInput] = useState<string>('');
  const [copySuccessMsg, setCopySuccessMsg] = useState<string>('');

  // Detect Bali Kabupaten from store coordinates & master columns
  const detectBaliKabupaten = (store: Store): string => {
    const synced = autoSyncStoreRegionAndKabupaten(store);
    return synced.region || 'Kab. Badung';
  };

  // Auto-resize map on Fullscreen change
  useEffect(() => {
    if (mapInstanceRef.current) {
      const timer1 = setTimeout(() => {
        try { mapInstanceRef.current?.invalidateSize(); } catch {}
      }, 50);
      const timer2 = setTimeout(() => {
        try { mapInstanceRef.current?.invalidateSize(); } catch {}
      }, 250);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [isMapFullscreen]);

  // Filter and normalize store coordinates
  const storesWithCoords = stores
    .map(s => ensureStoreCoordinates(s))
    .filter(s => {
      if (!s.latitude || !s.longitude) return false;

      // Filter out invalid/out-of-bounds coordinates (e.g. Africa, Europe) to keep map strictly focused on Bali & Nusa Tenggara
      if (s.latitude < -9.8 || s.latitude > -7.0 || s.longitude < 114.0 || s.longitude > 117.5) {
        return false;
      }

      // Filter by selected kabupaten focus if active
      const kab = detectBaliKabupaten(s);
      if (selectedKabupatenFocus !== 'ALL' && kab !== selectedKabupatenFocus) {
        return false;
      }

      // Filter specifically by Bali regions dropdown
      if (selectedRegionFilter === 'Bali & Nusa Tenggara' || selectedRegionFilter === 'Wilayah Bali & Nusa Tenggara (Semua)' || selectedRegionFilter === 'ALL') {
        return true;
      }
      
      const locText = `${s.city || ''} ${s.address || ''} ${s.district || ''} ${s.name || ''} ${s.kabupaten || ''} ${s.region || ''} ${kab}`.toLowerCase();
      if (selectedRegionFilter === 'Bali Selatan') {
        return /denpasar|badung|kuta|sanur|jimbaran|nusa dua|mengwi|canggu|tuban/i.test(locText) || kab.includes('Denpasar') || kab.includes('Badung');
      }
      if (selectedRegionFilter === 'Bali Tengah & Utara') {
        return /gianyar|tabanan|ubud|buleleng|singaraja|sukawati/i.test(locText) || kab.includes('Gianyar') || kab.includes('Tabanan') || kab.includes('Buleleng');
      }
      if (selectedRegionFilter === 'Bali Timur & Barat') {
        return /karangasem|jembrana|klungkung|bangli|negara|amlapura/i.test(locText) || kab.includes('Karangasem') || kab.includes('Jembrana') || kab.includes('Klungkung') || kab.includes('Bangli');
      }
      
      return true;
    });

  // Officers list for filter dropdown
  const officersList = Array.from(
    new Set(
      schedules
        .map(s => s.officerInCharge || s.spvInCharge)
        .filter(Boolean)
    )
  );

  // Kabupaten breakdown with monthly SO stats (Sudah SO = Blue, Belum SO = Red)
  const kabupatenBreakdown = React.useMemo(() => {
    const list: Record<string, { total: number; doneSO: number; pendingSO: number; lat: number; lng: number }> = {
      'Kota Denpasar': { total: 0, doneSO: 0, pendingSO: 0, lat: -8.65, lng: 115.22 },
      'Kab. Badung': { total: 0, doneSO: 0, pendingSO: 0, lat: -8.58, lng: 115.17 },
      'Kab. Gianyar': { total: 0, doneSO: 0, pendingSO: 0, lat: -8.54, lng: 115.33 },
      'Kab. Tabanan': { total: 0, doneSO: 0, pendingSO: 0, lat: -8.54, lng: 115.12 },
      'Kab. Buleleng': { total: 0, doneSO: 0, pendingSO: 0, lat: -8.12, lng: 115.09 },
      'Kab. Karangasem': { total: 0, doneSO: 0, pendingSO: 0, lat: -8.44, lng: 115.60 },
      'Kab. Jembrana': { total: 0, doneSO: 0, pendingSO: 0, lat: -8.36, lng: 114.63 },
      'Kab. Klungkung': { total: 0, doneSO: 0, pendingSO: 0, lat: -8.53, lng: 115.40 },
      'Kab. Bangli': { total: 0, doneSO: 0, pendingSO: 0, lat: -8.45, lng: 115.35 },
    };

    storesWithCoords.forEach(st => {
      const kab = detectBaliKabupaten(st);
      if (!list[kab]) {
        list[kab] = { total: 0, doneSO: 0, pendingSO: 0, lat: st.latitude || -8.45, lng: st.longitude || 115.20 };
      }
      list[kab].total += 1;

      const isDoneInMonth = schedules.some(sc =>
        (sc.storeId === st.id || sc.storeCode === st.code) &&
        sc.scheduledDate.startsWith(selectedMonthPeriod) &&
        sc.status !== 'Batal'
      );

      if (isDoneInMonth) {
        list[kab].doneSO += 1;
      } else {
        list[kab].pendingSO += 1;
      }
    });

    return list;
  }, [storesWithCoords, schedules, selectedMonthPeriod]);

  // Cluster analysis
  const clusterAnalysis = analyzeOfficerClusters(
    schedules,
    stores,
    selectedDate !== 'ALL' ? selectedDate : undefined,
    selectedOfficer
  );

  // Trouble / Rescheduled schedules
  const troubleSchedules = schedules.filter(s => s.isRescheduled || s.status === 'Ditunda' || s.troubleNote);

  // Initialize Leaflet Map whenever active container DOM node changes
  useEffect(() => {
    if (!mapContainerNode) return;

    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.stop();
        mapInstanceRef.current.off();
        mapInstanceRef.current.remove();
      } catch (e) {
        // ignore
      }
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    }

    // Center on Bali (Lat -8.45, Lng 115.20)
    const map = L.map(mapContainerNode, {
      center: [-8.45, 115.20],
      zoom: 10,
      zoomControl: true,
      preferCanvas: true, // Smooth performance on all devices
      fadeAnimation: false,
      markerZoomAnimation: false,
      bounceAtZoomLimits: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    layerGroupRef.current = layerGroup;

    // Force map size recalculation
    const t1 = setTimeout(() => {
      if (mapInstanceRef.current === map) {
        try { map.invalidateSize(); } catch {}
      }
    }, 100);
    const t2 = setTimeout(() => {
      if (mapInstanceRef.current === map) {
        try { map.invalidateSize(); } catch {}
      }
    }, 350);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.stop();
          mapInstanceRef.current.off();
          mapInstanceRef.current.remove();
        } catch (e) {
          // ignore
        }
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, [mapContainerNode]);

  // Render Markers and Cluster Polylines on Leaflet Map
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    const bounds = L.latLngBounds([]);

    // IF ROUTE CALCULATOR TAB IS ACTIVE
    if (activeTab === 'routeCalculator') {
      if (selectedRouteStores.length > 0) {
        const latLngs: [number, number][] = [];

        selectedRouteStores.forEach((store, index) => {
          if (!store.latitude || !store.longitude) return;

          latLngs.push([store.latitude, store.longitude]);
          bounds.extend([store.latitude, store.longitude]);

          // Custom Numbered Icon
          const isFirst = index === 0;
          const isLast = index === selectedRouteStores.length - 1 && selectedRouteStores.length > 1;

          const pinBg = isFirst ? '#10b981' : isLast ? '#ef4444' : '#6366f1';

          const customIcon = L.divIcon({
            className: 'custom-route-pin',
            html: `
              <div style="
                background-color: ${pinBg};
                width: 32px;
                height: 32px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 800;
                font-size: 13px;
              ">
                ${index + 1}
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16],
          });

          const marker = L.marker([store.latitude, store.longitude], { icon: customIcon });

          const popupHtml = `
            <div style="font-family: sans-serif; padding: 4px; min-width: 200px;">
              <div style="font-size: 11px; font-weight: bold; color: #6366f1; text-transform: uppercase;">
                URUTAN RUTE #${index + 1} • KODE: ${store.code}
              </div>
              <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                ${store.name}
              </div>
              <div style="font-size: 11px; color: #475569;">
                📍 ${store.address} (${store.city})
              </div>
            </div>
          `;

          marker.bindPopup(popupHtml);
          marker.addTo(layerGroup);
        });

        // Plot route line between selected stores
        if (latLngs.length >= 2) {
          const polyline = L.polyline(latLngs, {
            color: '#6366f1',
            weight: 5,
            opacity: 0.9,
            dashArray: '8, 8',
          });

          polyline.bindTooltip(
            `<b>Rute Multi-Toko SPV Bali</b><br/>Total ${selectedRouteStores.length} Toko`,
            { sticky: true }
          );

          polyline.addTo(layerGroup);
        }

        if (bounds.isValid() && mapInstanceRef.current === map) {
          try {
            map.fitBounds(bounds, { padding: [50, 50], animate: false });
          } catch {
            // ignore
          }
        }
      } else {
        // Show all stores with coordinates as selectable pins if route stores list is empty
        storesWithCoords.forEach(store => {
          if (!store.latitude || !store.longitude) return;
          bounds.extend([store.latitude, store.longitude]);

          const customIcon = L.divIcon({
            className: 'custom-leaflet-pin',
            html: `
              <div style="
                background-color: #6366f1;
                width: 26px;
                height: 26px;
                border-radius: 50%;
                border: 2px solid white;
                box-shadow: 0 3px 8px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 10px;
              ">
                ${store.code}
              </div>
            `,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
            popupAnchor: [0, -13],
          });

          const marker = L.marker([store.latitude, store.longitude], { icon: customIcon });
          marker.bindPopup(`
            <div style="font-family: sans-serif; padding: 4px;">
              <div style="font-size: 11px; font-weight: bold; color: #6366f1;">${store.code}</div>
              <div style="font-size: 13px; font-weight: 700; color: #0f172a;">${store.name}</div>
              <div style="font-size: 11px; color: #475569;">📍 ${store.city}</div>
            </div>
          `);
          marker.addTo(layerGroup);
        });

        if (bounds.isValid() && mapInstanceRef.current === map) {
          try {
            map.fitBounds(bounds, { padding: [40, 40], animate: false });
          } catch {
            // ignore
          }
        }
      }
    } else if (activeTab === 'map') {
      // STANDARD GIS CLUSTER & ALL STORES MAP
      const activeSchedsByStore = new Map<string, SOSchedule>();
      schedules.forEach(sc => {
        if (selectedDate === 'ALL' || sc.scheduledDate === selectedDate) {
          if (selectedOfficer === 'ALL' || (sc.officerInCharge || sc.spvInCharge) === selectedOfficer) {
            activeSchedsByStore.set(sc.storeId, sc);
            if (sc.storeCode) activeSchedsByStore.set(sc.storeCode, sc);
          }
        }
      });

      const scheduledBounds = L.latLngBounds([]);

      // 1. Plot Store Pins
      storesWithCoords.forEach(store => {
        if (!store.latitude || !store.longitude) return;

        const sched = activeSchedsByStore.get(store.id) || activeSchedsByStore.get(store.code);
        const isScheduledToday = Boolean(sched);
        const storeKabupaten = detectBaliKabupaten(store);

        // Check if store has SO in selected monthly period
        const isDoneInMonth = schedules.some(sc =>
          (sc.storeId === store.id || sc.storeCode === store.code) &&
          sc.scheduledDate.startsWith(selectedMonthPeriod) &&
          sc.status !== 'Batal'
        );

        // Pin Color Logic
        let markerColor = '#94a3b8'; // Slate grey default
        let pinSize = 28;
        let pinText = '•';

        if (mapColorMode === 'monthlySO') {
          if (isDoneInMonth) {
            markerColor = '#2563eb'; // BLUE for SUDAH SO
            pinText = '✓';
            pinSize = 30;
          } else {
            markerColor = '#ef4444'; // RED for BELUM SO
            pinText = '✕';
            pinSize = 28;
          }
        } else {
          // Daily Schedule Mode
          if (isScheduledToday) {
            pinSize = 32;
            pinText = 'SO';
            if (sched?.isRescheduled || sched?.status === 'Ditunda') {
              markerColor = '#ef4444'; // Red for trouble/rescheduled
            } else if (sched?.status === 'Proses SO') {
              markerColor = '#2563eb'; // Blue for in progress
            } else if (sched?.status === 'Selesai') {
              markerColor = '#059669'; // Green for completed
            } else {
              markerColor = '#d97706'; // Amber for scheduled
            }
            scheduledBounds.extend([store.latitude, store.longitude]);
          }
        }

        const customIcon = L.divIcon({
          className: 'custom-leaflet-pin',
          html: `
            <div style="
              background-color: ${markerColor};
              width: ${pinSize}px;
              height: ${pinSize}px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 4px 12px rgba(0,0,0,0.35);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: 800;
              font-size: ${pinText.length > 1 ? '11px' : '13px'};
            ">
              ${pinText}
            </div>
          `,
          iconSize: [pinSize, pinSize],
          iconAnchor: [pinSize / 2, pinSize / 2],
          popupAnchor: [0, -pinSize / 2],
        });

        const marker = L.marker([store.latitude, store.longitude], { icon: customIcon });

        const parsedCoord = parseCoordinates(store.koordinat || `${store.latitude}, ${store.longitude}`);

        const popupHtml = `
          <div style="font-family: sans-serif; padding: 4px; min-width: 220px;">
            <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase;">
              ${store.code} • ${storeKabupaten} (${store.region})
            </div>
            <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
              ${store.name}
            </div>
            <div style="font-size: 12px; color: #475569; margin-bottom: 6px;">
              📍 ${store.address}
            </div>
            
            <div style="background-color: ${isDoneInMonth ? '#eff6ff' : '#fef2f2'}; border: 1px solid ${isDoneInMonth ? '#bfdbfe' : '#fecaca'}; padding: 6px; border-radius: 8px; margin-bottom: 8px;">
              <div style="font-size: 11px; font-weight: 800; color: ${isDoneInMonth ? '#1e40af' : '#991b1b'}; flex-items: center;">
                ${isDoneInMonth ? '🔵 SUDAH DILAKUKAN SO' : '🔴 BELUM DILAKUKAN SO'} (Periode ${selectedMonthPeriod})
              </div>
            </div>

            <div style="background-color: #f1f5f9; border: 1px solid #e2e8f0; padding: 6px; border-radius: 6px; font-size: 10px; color: #334155; margin-bottom: 8px;">
              <div><b>📍 Lat/Long:</b> ${store.latitude}, ${store.longitude}</div>
              ${parsedCoord.formattedDMS ? `<div style="margin-top: 2px;"><b>🌐 DMS:</b> ${parsedCoord.formattedDMS}</div>` : ''}
              <a href="https://www.google.com/maps?q=${store.latitude},${store.longitude}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 4px; color: #2563eb; font-weight: 600; text-decoration: underline;">
                Buka di Google Maps ↗
              </a>
            </div>

            ${sched ? `
              <div style="background-color: #f8fafc; border-left: 4px solid ${markerColor}; padding: 8px; border-radius: 6px; font-size: 11px; margin-bottom: 6px;">
                <div><strong>Status:</strong> <span style="color: ${markerColor}; font-weight: bold;">${sched.status}</span></div>
                <div><strong>Korlap/Officer:</strong> ${sched.officerInCharge || 'Penanggung Jawab'}</div>
                <div><strong>Tanggal:</strong> ${sched.scheduledDate} (${sched.scheduledTime} WIB)</div>
                <div><strong>Tim:</strong> ${sched.teamName}</div>
                ${sched.assignedPersonnelNames && sched.assignedPersonnelNames.length > 0 ? `
                  <div style="margin-top: 4px; font-size: 10px; color: #475569;">
                    <strong>Personil:</strong> ${sched.assignedPersonnelNames.join(', ')}
                  </div>
                ` : ''}
                ${sched.troubleNote ? `<div style="color: #dc2626; margin-top: 4px; font-weight: bold;">⚠️ ${sched.troubleNote}</div>` : ''}
              </div>
            ` : `
              <div style="font-size: 11px; color: #94a3b8; font-style: italic;">Tidak ada jadwal SO pada tanggal filter (${selectedDate}).</div>
            `}
          </div>
        `;

        marker.bindPopup(popupHtml);
        marker.addTo(layerGroup);
        bounds.extend([store.latitude, store.longitude]);
      });

      // 2. Plot Cluster Polylines for Officer Routes
      clusterAnalysis.forEach(cluster => {
        if (cluster.stores.length >= 2) {
          const latLngs: [number, number][] = cluster.stores
            .filter(s => s.latitude && s.longitude)
            .map(s => [s.latitude!, s.longitude!]);

          if (latLngs.length >= 2) {
            let strokeColor = '#10b981'; // Green <15km
            if (cluster.maxDistanceKm > 30) {
              strokeColor = '#ef4444'; // Red >30km warning
            } else if (cluster.maxDistanceKm > 15) {
              strokeColor = '#f59e0b'; // Amber 15-30km
            }

            const polyline = L.polyline(latLngs, {
              color: strokeColor,
              weight: 4,
              opacity: 0.8,
              dashArray: cluster.maxDistanceKm > 30 ? '8, 8' : undefined,
            });

            polyline.bindTooltip(
              `<b>Route Korlap: ${cluster.officerName}</b><br/>Max Jarak: ${cluster.maxDistanceKm} km (${cluster.proximityLevel})`,
              { sticky: true }
            );

            polyline.addTo(layerGroup);
          }
        }
      });

      // Prefer zooming into scheduled stores if available
      const targetBounds = scheduledBounds.isValid() ? scheduledBounds : bounds;

      if (targetBounds.isValid() && storesWithCoords.length > 0 && mapInstanceRef.current === map) {
        try {
          map.fitBounds(targetBounds, { padding: [50, 50], animate: false });
        } catch {
          // ignore
        }
      }
    }

    const tRender = setTimeout(() => {
      if (mapInstanceRef.current === map) {
        try { map.invalidateSize(); } catch {}
      }
    }, 150);

    return () => {
      clearTimeout(tRender);
    };
  }, [
    mapContainerNode, 
    selectedDate, 
    selectedMonthPeriod,
    mapColorMode,
    selectedKabupatenFocus,
    selectedOfficer, 
    selectedRegionFilter, 
    storesWithCoords, 
    schedules, 
    activeTab, 
    selectedRouteStores,
    clusterAnalysis
  ]);

  // ---------------- ROUTE CALCULATOR LOGIC & HELPERS ---------------- //

  const handleAddStoreToRoute = (store: Store) => {
    if (selectedRouteStores.some(s => s.id === store.id)) return;
    setSelectedRouteStores(prev => [...prev, store]);
    setStoreSearchInput('');
  };

  const handleSelectStoreBySearch = (query: string) => {
    if (!query.trim()) return;
    const searchLower = query.toLowerCase().trim();
    
    // Exact code match
    const matched = stores.find(s => 
      s.code.toLowerCase() === searchLower || 
      s.name.toLowerCase().includes(searchLower) ||
      s.city.toLowerCase().includes(searchLower)
    );

    if (matched) {
      handleAddStoreToRoute(matched);
    } else {
      alert(`Toko dengan kode/nama "${query}" tidak ditemukan.`);
    }
  };

  const handleRemoveFromRoute = (storeId: string) => {
    setSelectedRouteStores(prev => prev.filter(s => s.id !== storeId));
  };

  const handleMoveRoute = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= selectedRouteStores.length) return;

    const updated = [...selectedRouteStores];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setSelectedRouteStores(updated);
  };

  // Optimize Route Sequence (Greedy Nearest Neighbor TSP)
  const handleOptimizeRouteSequence = () => {
    if (selectedRouteStores.length <= 2) return;

    const unvisited = [...selectedRouteStores];
    const optimized: Store[] = [unvisited.shift()!]; // start with first

    while (unvisited.length > 0) {
      const current = optimized[optimized.length - 1];
      let nearestIdx = 0;
      let minDistance = Infinity;

      unvisited.forEach((st, idx) => {
        const dist = calculateHaversineDistance(
          current.latitude, current.longitude,
          st.latitude, st.longitude
        );
        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = idx;
        }
      });

      optimized.push(unvisited.splice(nearestIdx, 1)[0]);
    }

    setSelectedRouteStores(optimized);
  };

  // Calculate Leg Distances & Time
  const routeLegs: { storeA: Store; storeB: Store; distanceKm: number; estMinutes: number }[] = [];
  let totalRouteDistanceKm = 0;
  let totalRouteTimeMinutes = 0;

  for (let i = 0; i < selectedRouteStores.length - 1; i++) {
    const stA = selectedRouteStores[i];
    const stB = selectedRouteStores[i + 1];
    const dist = calculateHaversineDistance(
      stA.latitude, stA.longitude,
      stB.latitude, stB.longitude
    );
    // Estimate speed ~35 km/h in Bali roads
    const mins = Math.round((dist / 35) * 60);

    routeLegs.push({ storeA: stA, storeB: stB, distanceKm: dist, estMinutes: mins });
    totalRouteDistanceKm += dist;
    totalRouteTimeMinutes += mins;
  }

  totalRouteDistanceKm = Math.round(totalRouteDistanceKm * 10) / 10;

  const handleCopyRouteSummary = () => {
    if (selectedRouteStores.length < 2) return;

    let text = `🗺️ *PANDUAN RUTE SO SPV BALI*\n`;
    text += `---------------------------------\n`;
    text += `📍 Total Toko: ${selectedRouteStores.length} Lokasi\n`;
    text += `🚗 Total Jarak: ${totalRouteDistanceKm} km\n`;
    text += `⏱️ Estimasi Waktu Tempuh: ~${totalRouteTimeMinutes} Menit\n\n`;
    text += `*URUTAN PERJALANAN:*\n`;

    selectedRouteStores.forEach((st, idx) => {
      text += `${idx + 1}. [${st.code}] ${st.name} - ${st.city}\n`;
    });

    text += `\n*RINCIAN TRANSIT ANTA-TOKO:*\n`;
    routeLegs.forEach((leg, idx) => {
      text += `Leg ${idx + 1}: ${leg.storeA.code} ➔ ${leg.storeB.code} = ${leg.distanceKm} km (~${leg.estMinutes} menit)\n`;
    });

    navigator.clipboard.writeText(text);
    setCopySuccessMsg('Tersalin ke Clipboard!');
    setTimeout(() => setCopySuccessMsg(''), 3000);
  };

  const handleOpenRescheduleModal = (sched: SOSchedule) => {
    setRescheduleModalSchedule(sched);
    setNewDateInput(sched.scheduledDate);
    setNewOfficerInput(sched.officerInCharge || '');
    setTroubleNoteInput(sched.troubleNote || '');
  };

  const handleSaveReschedule = () => {
    if (!rescheduleModalSchedule || !onUpdateSchedule) return;

    const updated: SOSchedule = {
      ...rescheduleModalSchedule,
      scheduledDate: newDateInput,
      officerInCharge: newOfficerInput,
      troubleNote: troubleNoteInput.trim() ? troubleNoteInput : undefined,
      isRescheduled: true,
      originalDate: rescheduleModalSchedule.originalDate || rescheduleModalSchedule.scheduledDate,
      status: troubleNoteInput.trim() ? 'Ditunda' : rescheduleModalSchedule.status
    };

    onUpdateSchedule(updated);
    setRescheduleModalSchedule(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-3.5 sm:p-6 text-white shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] sm:text-xs font-semibold mb-1">
              <MapPin className="w-3 h-3 text-blue-400" />
              GIS & Tracking Kluster SO Bali
            </div>
            <h1 className="text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight">
              Peta Lokasi & Tracking Toko
            </h1>
            <p className="text-slate-300 text-[11px] sm:text-sm mt-0.5 max-w-2xl hidden sm:block">
              Monitoring kluster posisi toko per Penanggung Jawab. Ukur jarak interaktif antar lokasi & optimalkan rute perjalanan SPV Bali.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800/90 p-1 rounded-xl border border-slate-700/60 overflow-x-auto max-w-full text-[11px] shrink-0">
            <button
              onClick={() => setActiveTab('map')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 shrink-0 ${
                activeTab === 'map' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              Peta GIS
            </button>
            <button
              onClick={() => setActiveTab('routeCalculator')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 shrink-0 ${
                activeTab === 'routeCalculator' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Route className="w-3.5 h-3.5" />
              Pengukur Jarak {selectedRouteStores.length > 0 && `(${selectedRouteStores.length})`}
            </button>
            <button
              onClick={() => setActiveTab('clusters')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 shrink-0 ${
                activeTab === 'clusters' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Kluster ({clusterAnalysis.length})
            </button>
            <button
              onClick={() => setActiveTab('troubles')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 shrink-0 ${
                activeTab === 'troubles' ? 'bg-red-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Kendala ({troubleSchedules.length})
            </button>
          </div>
        </div>

        {/* Dynamic Filter Bar (Only show on GIS map & clusters tabs) */}
        {activeTab === 'map' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-700/60">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                📅 Tanggal Pelaksanaan SO
              </label>
              <input
                type="date"
                value={selectedDate === 'ALL' ? '' : selectedDate}
                onChange={(e) => setSelectedDate(e.target.value || 'ALL')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              {/* Quick Date Pills */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px]">
                <button
                  type="button"
                  onClick={() => setSelectedDate('ALL')}
                  className={`px-2 py-0.5 rounded font-bold transition ${
                    selectedDate === 'ALL'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate('2026-08-08')}
                  className={`px-2 py-0.5 rounded font-bold transition ${
                    selectedDate === '2026-08-08'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  8 Ags 2026
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate('2026-08-04')}
                  className={`px-2 py-0.5 rounded font-bold transition ${
                    selectedDate === '2026-08-04'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  4 Ags 2026
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate('2026-08-15')}
                  className={`px-2 py-0.5 rounded font-bold transition ${
                    selectedDate === '2026-08-15'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  15 Ags 2026
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                👤 Officer / Korlap SO
              </label>
              <select
                value={selectedOfficer}
                onChange={(e) => setSelectedOfficer(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Semua Korlap & Officer</option>
                {officersList.map(off => (
                  <option key={off} value={off}>{off}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                🏝️ Wilayah Operasional (Khusus Bali)
              </label>
              <select
                value={selectedRegionFilter}
                onChange={(e) => setSelectedRegionFilter(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="Bali & Nusa Tenggara">🏝️ Wilayah Bali & Nusa Tenggara (Semua)</option>
                <option value="Bali Selatan">📍 Bali Selatan (Denpasar, Badung, Kuta, Sanur)</option>
                <option value="Bali Tengah & Utara">📍 Bali Tengah & Utara (Gianyar, Tabanan, Buleleng)</option>
                <option value="Bali Timur & Barat">📍 Bali Timur & Barat (Karangasem, Klungkung, Jembrana)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ---------------- TAB 1: GIS MAP UTAMA ---------------- */}
      {activeTab === 'map' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Leaflet Map Box (3 cols in normal mode, fixed fullscreen when active) */}
            <div 
              className={
                isMapFullscreen
                  ? "fixed inset-0 z-[9999] bg-slate-900 flex flex-col h-screen w-screen p-0 m-0 overflow-hidden"
                  : "lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[480px] sm:h-[580px] lg:h-[680px] relative"
              }
            >
              {/* Top Bar for Map */}
              <div className={`px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between border-b shrink-0 ${
                isMapFullscreen ? 'bg-slate-900 text-white border-slate-800' : 'bg-slate-50 text-slate-800 border-slate-200'
              }`}>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Navigation className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isMapFullscreen ? 'text-blue-400' : 'text-blue-600'}`} />
                  <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider truncate max-w-[180px] sm:max-w-none">
                    Peta GIS Bali {isMapFullscreen && '— Fullscreen'}
                  </span>
                  <span className={`text-[10px] sm:text-xs ${isMapFullscreen ? 'text-slate-400' : 'text-slate-500'}`}>
                    ({storesWithCoords.length} Toko)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
                  {/* Monthly Period Selector */}
                  <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-lg border border-slate-300/20">
                    <span className={`text-[10px] font-bold ${isMapFullscreen ? 'text-slate-300' : 'text-slate-600'}`}>Periode SO:</span>
                    <select
                      value={selectedMonthPeriod}
                      onChange={(e) => setSelectedMonthPeriod(e.target.value)}
                      className={`bg-transparent text-xs font-bold focus:outline-none cursor-pointer ${
                        isMapFullscreen ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      <option value="2026-08" className="text-slate-900">Agustus 2026</option>
                      <option value="2026-07" className="text-slate-900">Juli 2026</option>
                      <option value="2026-09" className="text-slate-900">September 2026</option>
                      <option value="2026-10" className="text-slate-900">Oktober 2026</option>
                      <option value="2026-11" className="text-slate-900">November 2026</option>
                      <option value="2026-12" className="text-slate-900">Desember 2026</option>
                    </select>
                  </div>

                  {/* Legenda Warna Marker Status SO */}
                  <div className="flex items-center gap-2.5 bg-white/10 px-2.5 py-1 rounded-lg border border-slate-300/30">
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block ring-2 ring-white"></span>
                      <span className={`font-bold ${isMapFullscreen ? 'text-blue-300' : 'text-blue-700'}`}>🔵 Sudah SO</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block ring-2 ring-white"></span>
                      <span className={`font-bold ${isMapFullscreen ? 'text-red-300' : 'text-red-700'}`}>🔴 Belum SO</span>
                    </div>
                  </div>

                {/* Fullscreen Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsMapFullscreen(!isMapFullscreen)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition shadow-sm ${
                    isMapFullscreen 
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                  title={isMapFullscreen ? "Keluar Mode Layar Penuh" : "Buka Mode Layar Penuh (Google Maps Style)"}
                >
                  {isMapFullscreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Keluar Fullscreen</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Layar Penuh (Fullscreen)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Container for Leaflet map */}
            <div className="w-full flex-1 z-0 relative">
              <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

              {/* Floating Google-Maps Style Controller Overlay in Fullscreen Mode */}
              {isMapFullscreen && (
                <div className="absolute top-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur-md text-white p-3 rounded-2xl border border-slate-700 shadow-2xl space-y-2 max-w-xs animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
                    <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                      <Compass className="w-4 h-4 text-amber-400" />
                      Kontrol Peta Fullscreen
                    </span>
                    <button
                      onClick={() => setIsMapFullscreen(false)}
                      className="text-xs text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Filter Tanggal:</span>
                      <input
                        type="date"
                        value={selectedDate === 'ALL' ? '' : selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value || 'ALL')}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Filter Officer:</span>
                      <select
                        value={selectedOfficer}
                        onChange={(e) => setSelectedOfficer(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      >
                        <option value="ALL">Semua Officer</option>
                        {officersList.map(off => (
                          <option key={off} value={off}>{off}</option>
                        ))}
                      </select>
                    </div>

                    <div className="pt-1 flex justify-between items-center text-[11px] text-emerald-400 font-bold">
                      <span>{storesWithCoords.length} Toko Tampil</span>
                      <button
                        onClick={() => {
                          if (mapInstanceRef.current) {
                            mapInstanceRef.current.setView([-8.45, 115.20], 10);
                          }
                        }}
                        className="text-[10px] text-blue-300 underline hover:text-white"
                      >
                        Reset Pandangan Bali
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Side Panel: Kluster Active Summary (1 col) */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-blue-600" />
                Ringkasan Rute Korlap Hari Ini
              </h3>

              {clusterAnalysis.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Tidak ada kluster multiple-toko ditemukan pada tanggal & officer pilihan ini.
                </div>
              ) : (
                <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                  {clusterAnalysis.map((cluster, idx) => (
                    <div 
                      key={idx}
                      className={`p-3 rounded-xl border text-xs space-y-2 ${
                        cluster.maxDistanceKm > 30 
                          ? 'bg-red-50/50 border-red-200' 
                          : cluster.maxDistanceKm > 15 
                          ? 'bg-amber-50/50 border-amber-200' 
                          : 'bg-emerald-50/50 border-emerald-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <div className="font-bold text-slate-900">{cluster.officerName}</div>
                          <div className="text-slate-500 text-[11px]">{cluster.date} • {cluster.schedules.length} Toko SO</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          cluster.maxDistanceKm > 30 ? 'bg-red-100 text-red-800' :
                          cluster.maxDistanceKm > 15 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {cluster.proximityLevel}
                        </span>
                      </div>

                      <div className="pt-1 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-500">Maks Jarak:</span>
                          <span className="font-bold ml-1 text-slate-800">{cluster.maxDistanceKm} km</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Rata-rata:</span>
                          <span className="font-bold ml-1 text-slate-800">{cluster.avgDistanceKm} km</span>
                        </div>
                      </div>

                      {cluster.pairs.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <div className="text-[10px] font-bold text-slate-600 uppercase">Jarak Antar Toko:</div>
                          {cluster.pairs.map((p, pIdx) => (
                            <div key={pIdx} className="flex items-center justify-between text-[11px] bg-white p-1.5 rounded border border-slate-200">
                              <span className="truncate max-w-[120px] text-slate-700">{p.storeA.name.split(' ')[1] || p.storeA.name} → {p.storeB.name.split(' ')[1] || p.storeB.name}</span>
                              <span className={`font-bold ${p.isFarWarning ? 'text-red-600' : 'text-slate-700'}`}>
                                {p.distanceKm} km
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ---------------- TAB 2: MULTI-STORE INTERACTIVE ROUTE CALCULATOR ---------------- */}
      {activeTab === 'routeCalculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel: Store Selector & Route List (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Input Kode Toko Widget */}
            <div className="bg-white rounded-2xl border border-indigo-200/80 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Route className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Pilih & Input Kode Toko Multi-Route</h3>
                    <p className="text-slate-500 text-xs">Pilih 2 atau lebih kode toko untuk menghitung rute interaktif</p>
                  </div>
                </div>
              </div>

              {/* Form Input Kode Toko */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={storeSearchInput}
                    onChange={(e) => setStoreSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSelectStoreBySearch(storeSearchInput);
                    }}
                    placeholder="Ketik Kode Toko (misal TQ30, TLID, dll)..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  onClick={() => handleSelectStoreBySearch(storeSearchInput)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah</span>
                </button>
              </div>

              {/* Dropdown Quick Select from Master Stores */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Atau Pilih Langsung dari Master Toko ({stores.length} Toko):
                </label>
                <select
                  onChange={(e) => {
                    const st = stores.find(s => s.id === e.target.value);
                    if (st) handleAddStoreToRoute(st);
                  }}
                  defaultValue=""
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-indigo-500"
                >
                  <option value="" disabled>-- Pilih Toko dari Master Data --</option>
                  {stores.map(st => (
                    <option key={st.id} value={st.id}>
                      [{st.code}] {st.name} - {st.city}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Sample Route Tabanan Bali */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">Contoh Rute Cepat SPV Bali:</span>
                <button
                  onClick={() => {
                    const sampleCodes = ['TQ30', 'TLID'];
                    const matchedSample = stores.filter(s => sampleCodes.includes(s.code));
                    if (matchedSample.length > 0) {
                      setSelectedRouteStores(matchedSample);
                    } else {
                      setSelectedRouteStores(stores.slice(0, 3));
                    }
                  }}
                  className="text-indigo-600 hover:underline font-bold text-[11px] flex items-center gap-1"
                >
                  <Zap className="w-3 h-3" /> Load Toko Tabanan Bali
                </button>
              </div>
            </div>

            {/* Selected Route Sequence List */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Urutan Toko Rute SPV ({selectedRouteStores.length})</h4>
                  <p className="text-slate-500 text-xs">Atur urutan perjalanan atau klik optimalkan rute</p>
                </div>

                {selectedRouteStores.length > 2 && (
                  <button
                    onClick={handleOptimizeRouteSequence}
                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                    title="Cari urutan rute terdekat secara otomatis"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Optimalkan Rute</span>
                  </button>
                )}
              </div>

              {selectedRouteStores.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                  <Compass className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">Belum ada toko yang dipilih untuk rute.</p>
                  <p className="text-[11px] text-slate-400">Silakan masukkan kode toko di atas atau pilih dari master toko.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {selectedRouteStores.map((st, idx) => (
                    <div 
                      key={st.id} 
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 hover:border-indigo-300 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-xs truncate">
                            [{st.code}] {st.name}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            📍 {st.city} • {st.address}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleMoveRoute(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 disabled:hover:text-slate-400"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveRoute(idx, 'down')}
                          disabled={idx === selectedRouteStores.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 disabled:hover:text-slate-400"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveFromRoute(st.id)}
                          className="p-1 text-rose-400 hover:text-rose-600 ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total Distance & Travel Summary Box */}
              {selectedRouteStores.length >= 2 && (
                <div className="bg-indigo-900 text-white p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-indigo-800 pb-2">
                    <span className="text-xs font-semibold text-indigo-200">Kalkulasi Rute SPV:</span>
                    <span className="text-[10px] font-bold bg-indigo-800 px-2 py-0.5 rounded text-indigo-300">
                      Kecepatan Rata-rata ~35 km/j
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-indigo-300 uppercase font-bold">Total Jarak Tempuh</span>
                      <div className="text-xl font-extrabold text-white">{totalRouteDistanceKm} km</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-300 uppercase font-bold">Estimasi Waktu</span>
                      <div className="text-xl font-extrabold text-emerald-400">~{totalRouteTimeMinutes} Menit</div>
                    </div>
                  </div>

                  <button
                    onClick={handleCopyRouteSummary}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5"
                  >
                    {copySuccessMsg ? <Check className="w-4 h-4 text-emerald-300" /> : <Share2 className="w-4 h-4" />}
                    <span>{copySuccessMsg || 'Salin Ringkasan Rute (WhatsApp / Note)'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Interactive Map & Leg Breakdown (7 cols) */}
          <div className={isMapFullscreen ? "col-span-full" : "lg:col-span-7 space-y-4"}>
            <div className={
              isMapFullscreen
                ? "fixed inset-0 z-[9999] bg-slate-900 flex flex-col h-screen w-screen p-0 m-0 overflow-hidden"
                : "bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[520px] relative"
            }>
              <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Peta Visual Rute Multitoko ({selectedRouteStores.length} Pin Terhubung) {isMapFullscreen && '— Mode Layar Penuh'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {selectedRouteStores.length > 0 && (
                    <button
                      onClick={() => setSelectedRouteStores([])}
                      className="text-[11px] text-slate-400 hover:text-white underline font-semibold mr-2"
                    >
                      Reset Rute
                    </button>
                  )}

                  {/* Fullscreen Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setIsMapFullscreen(!isMapFullscreen)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition shadow-xs ${
                      isMapFullscreen 
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' 
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                    title={isMapFullscreen ? "Keluar Mode Layar Penuh" : "Buka Mode Layar Penuh (Google Maps Style)"}
                  >
                    {isMapFullscreen ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Keluar Fullscreen</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Layar Penuh (Fullscreen)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Leaflet Map */}
              <div className="w-full flex-1 z-0 relative">
                <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

                {/* Floating Interactive Route Control Overlay in Fullscreen Mode */}
                {isMapFullscreen && (
                  <div className="absolute top-4 left-4 z-[1000] bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl border border-slate-700 shadow-2xl space-y-3 max-w-sm max-h-[85vh] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
                      <span className="text-xs font-extrabold text-indigo-400 flex items-center gap-1.5">
                        <Compass className="w-4 h-4 text-amber-400" />
                        Kontrol Rute Fullscreen ({selectedRouteStores.length} Toko)
                      </span>
                      <button
                        onClick={() => setIsMapFullscreen(false)}
                        className="text-xs text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Quick Distance & Time Summary */}
                    {selectedRouteStores.length >= 2 && (
                      <div className="bg-indigo-950/80 border border-indigo-700/80 p-3 rounded-xl space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="bg-slate-900/80 p-2 rounded-lg">
                            <span className="text-[10px] text-indigo-300 block font-bold">TOTAL JARAK</span>
                            <span className="text-lg font-black text-white">{totalRouteDistanceKm} km</span>
                          </div>
                          <div className="bg-slate-900/80 p-2 rounded-lg">
                            <span className="text-[10px] text-indigo-300 block font-bold">ESTIMASI WAKTU</span>
                            <span className="text-lg font-black text-emerald-400">~{totalRouteTimeMinutes} mnt</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          {selectedRouteStores.length > 2 && (
                            <button
                              onClick={handleOptimizeRouteSequence}
                              className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Optimalkan</span>
                            </button>
                          )}
                          <button
                            onClick={handleCopyRouteSummary}
                            className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-1"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>{copySuccessMsg ? 'Tersalin!' : 'Salin Rute'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Stores List in Fullscreen Floating Card */}
                    <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Urutan Toko:</span>
                      {selectedRouteStores.map((st, idx) => (
                        <div key={st.id} className="p-2 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-indigo-500 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="font-bold text-white text-[11px] truncate">[{st.code}] {st.name}</div>
                              <div className="text-[10px] text-slate-400 truncate">📍 {st.city}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={() => handleMoveRoute(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleMoveRoute(idx, 'down')}
                              disabled={idx === selectedRouteStores.length - 1}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleRemoveFromRoute(st.id)}
                              className="p-1 text-rose-400 hover:text-rose-300"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Leg-by-Leg Distance Table */}
            {routeLegs.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 text-indigo-600" />
                  Rincian Jarak Leg Transit Antar Toko:
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold">
                      <tr>
                        <th className="p-2">Transit Leg</th>
                        <th className="p-2">Dari Toko A</th>
                        <th className="p-2">Ke Toko B</th>
                        <th className="p-2">Jarak (km)</th>
                        <th className="p-2">Est. Waktu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {routeLegs.map((leg, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-indigo-600">Leg #{idx + 1}</td>
                          <td className="p-2 font-medium text-slate-800">[{leg.storeA.code}] {leg.storeA.name}</td>
                          <td className="p-2 font-medium text-slate-800">[{leg.storeB.code}] {leg.storeB.name}</td>
                          <td className="p-2 font-mono font-bold text-slate-900">{leg.distanceKm} km</td>
                          <td className="p-2 font-semibold text-emerald-600">~{leg.estMinutes} menit</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- TAB 3: CLUSTER ANALYSIS MATRIX ---------------- */}
      {activeTab === 'clusters' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Analisis Efisiensi Jarak Kluster Korlap</h2>
              <p className="text-slate-500 text-xs mt-0.5">
                Menghitung rumus Haversine antara toko-toko yang dijadwalkan pada hari yang sama oleh Korlap yang sama.
              </p>
            </div>
            <div className="text-xs bg-blue-50 text-blue-700 font-semibold px-3 py-1.5 rounded-lg border border-blue-200">
              Total Kluster Aktif: {clusterAnalysis.length} Rute
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clusterAnalysis.map((cluster, idx) => (
              <div key={idx} className="border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-500">{cluster.date}</span>
                    <h3 className="font-bold text-slate-900 text-sm">{cluster.officerName}</h3>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    cluster.maxDistanceKm > 30 ? 'bg-red-100 text-red-800' :
                    cluster.maxDistanceKm > 15 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {cluster.proximityLevel}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700">Toko Terjadwal dalam Kluster:</div>
                  <div className="space-y-1.5">
                    {cluster.schedules.map(sc => (
                      <div key={sc.id} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg text-xs">
                        <div>
                          <div className="font-bold text-slate-800">{sc.storeName}</div>
                          <div className="text-[10px] text-slate-500">{sc.storeCode} • {sc.scheduledTime}</div>
                        </div>
                        <button
                          onClick={() => handleOpenRescheduleModal(sc)}
                          className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-blue-600 transition-colors"
                        >
                          Pindah
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {cluster.pairs.length > 0 && (
                  <div className="bg-slate-50 p-3 rounded-xl space-y-2 border border-slate-200/60">
                    <div className="text-[11px] font-bold text-slate-700">Matrix Jarak Transit:</div>
                    {cluster.pairs.map((p, pIdx) => (
                      <div key={pIdx} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 truncate max-w-[150px]">{p.storeA.name} ↔ {p.storeB.name}</span>
                        <span className={`font-mono font-bold ${p.isFarWarning ? 'text-red-600' : 'text-slate-800'}`}>
                          {p.distanceKm} km
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- TAB 4: KENDALA HARI H & RESCHEDULE ---------------- */}
      {activeTab === 'troubles' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Manajemen Kendala Hari-H & Re-schedule Dynamic</h2>
              <p className="text-slate-500 text-xs mt-0.5">
                Mengakomodasi perubahan jadwal mendadak akibat pemadaman listrik, kendala toko, atau penyesuaian Korlap di lapangan.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Toko & Kode</th>
                  <th className="px-4 py-3">Korlap Penanggung Jawab</th>
                  <th className="px-4 py-3">Tanggal Jadwal</th>
                  <th className="px-4 py-3">Status & Kendala</th>
                  <th className="px-4 py-3 text-right">Aksi Pindah Jadwal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.map(sc => (
                  <tr key={sc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <div className="font-bold text-slate-900">{sc.storeName}</div>
                      <div className="text-[10px] text-slate-500">{sc.storeCode} • {sc.region}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {sc.officerInCharge || sc.spvInCharge}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{sc.scheduledDate}</div>
                      {sc.originalDate && (
                        <div className="text-[10px] text-red-500 line-through">Asli: {sc.originalDate}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        sc.status === 'Ditunda' ? 'bg-red-100 text-red-800' :
                        sc.status === 'Proses SO' ? 'bg-blue-100 text-blue-800' :
                        sc.status === 'Selesai' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {sc.status}
                      </span>
                      {sc.troubleNote && (
                        <div className="text-[11px] text-red-600 mt-1 font-medium">
                          ⚠️ {sc.troubleNote}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleOpenRescheduleModal(sc)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg border border-blue-200 transition-all inline-flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Re-schedule
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleModalSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-600" />
                Dynamic Re-schedule Hari-H
              </h3>
              <button 
                onClick={() => setRescheduleModalSchedule(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1">
              <div className="font-bold text-slate-800">{rescheduleModalSchedule.storeName} ({rescheduleModalSchedule.storeCode})</div>
              <div className="text-slate-500">Jadwal Asli: {rescheduleModalSchedule.scheduledDate}</div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Baru Pelaksanaan</label>
                <input
                  type="date"
                  value={newDateInput}
                  onChange={(e) => setNewDateInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Officer / Korlap Penanggung Jawab</label>
                <select
                  value={newOfficerInput}
                  onChange={(e) => setNewOfficerInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Pilih Korlap / Officer --</option>
                  <optgroup label="Korlap / Officer Active">
                    {personnel
                      .filter(p => p.role === 'Officer / Korlap' || p.korlapName)
                      .map(p => (
                        <option key={p.id} value={`${p.name} (${p.role})`}>
                          [{p.nik}] {p.name} - {p.role} ({p.status})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Personil Lainnya">
                    {personnel
                      .filter(p => p.role !== 'Officer / Korlap' && !p.korlapName)
                      .map(p => (
                        <option key={p.id} value={`${p.name} (${p.role})`}>
                          [{p.nik}] {p.name} - {p.role} ({p.status})
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Kendala / Trouble (Hari-H)</label>
                <textarea
                  value={troubleNoteInput}
                  onChange={(e) => setTroubleNoteInput(e.target.value)}
                  placeholder="Contoh: Mati listrik toko, akses terhalang, toko tutup sementara..."
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setRescheduleModalSchedule(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                onClick={handleSaveReschedule}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

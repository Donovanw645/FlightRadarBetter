import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useFlightStore } from '../store/useFlightStore';
import { filterAircraft, getAircraftCategory, getCategoryColor, getRotation } from '../utils/aircraftUtils';
import type { MapStyle, Aircraft, AircraftCategory } from '../types';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function deadReckon(lat: number, lon: number, speedMs: number, trackDeg: number, dt: number): [number, number] {
  const dist = speedMs * dt;
  const R = 6371000;
  const trackRad = trackDeg * DEG2RAD;
  const lat1 = lat * DEG2RAD;
  const lon1 = lon * DEG2RAD;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist / R) + Math.cos(lat1) * Math.sin(dist / R) * Math.cos(trackRad));
  const lon2 = lon1 + Math.atan2(Math.sin(trackRad) * Math.sin(dist / R) * Math.cos(lat1), Math.cos(dist / R) - Math.sin(lat1) * Math.sin(lat2));
  return [lat2 * RAD2DEG, lon2 * RAD2DEG];
}

const TILE_LAYERS: Record<MapStyle, { url: string; attribution: string }> = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
  },
};

function aircraftShape(cat: AircraftCategory, color: string, stroke: string, sw: number): string {
  switch (cat) {
    case 'helicopter':
      // Top-down: tail boom → tail rotor → main rotor bar → fuselage body on top
      return `
        <rect x="11.2" y="14" width="1.6" height="8.5" rx="0.8" fill="${color}"/>
        <rect x="8.2" y="20.5" width="7.6" height="1.4" rx="0.7" fill="${color}" opacity="0.85"/>
        <rect x="1.5" y="9.5" width="21" height="2" rx="1" fill="${color}" opacity="0.7"/>
        <ellipse cx="12" cy="10" rx="3.2" ry="4.8" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>`;

    case 'drone':
      // Quadcopter X-frame with four motor discs
      return `
        <line x1="12" y1="12" x2="5.5" y2="5.5" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>
        <line x1="12" y1="12" x2="18.5" y2="5.5" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>
        <line x1="12" y1="12" x2="5.5" y2="18.5" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>
        <line x1="12" y1="12" x2="18.5" y2="18.5" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>
        <circle cx="5.5" cy="5.5" r="2.8" fill="${color}" opacity="0.85"/>
        <circle cx="18.5" cy="5.5" r="2.8" fill="${color}" opacity="0.85"/>
        <circle cx="5.5" cy="18.5" r="2.8" fill="${color}" opacity="0.85"/>
        <circle cx="18.5" cy="18.5" r="2.8" fill="${color}" opacity="0.85"/>
        <circle cx="12" cy="12" r="2.2" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>`;

    case 'military':
      // Top-down delta-wing fighter + twin tail fins
      return `
        <path d="M12 2 L20 20 L12 16.5 L4 20 Z"
          fill="${color}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
        <path d="M10.2 16.5 L8 22 L10 22.5 L12 19 L14 22.5 L16 22 L13.8 16.5 Z"
          fill="${color}" opacity="0.9"/>`;

    case 'glider':
      // Very long straight wings with pencil-thin fuselage
      return `
        <path d="M10.8 11 L1 12.5 L1 14 L10.8 13 L13.2 13 L23 14 L23 12.5 L13.2 11 Z" fill="${color}"/>
        <ellipse cx="12" cy="12" rx="1.3" ry="10" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>`;

    case 'private':
      // Small GA plane — straight wings, T-tail
      return `
        <ellipse cx="12" cy="12" rx="2" ry="9" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>
        <path d="M10 10 L1.5 13 L1.5 14.5 L10 13 L14 13 L22.5 14.5 L22.5 13 L14 10 Z" fill="${color}"/>
        <path d="M10.5 19.5 L7 22 L7.5 23 L12 21.5 L16.5 23 L17 22 L13.5 19.5 Z" fill="${color}"/>`;

    default:
      // Commercial / cargo — swept-wing airliner with horizontal stabilizer
      return `
        <ellipse cx="12" cy="12" rx="2.2" ry="10" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>
        <path d="M12 9.5 L22.5 16 L21.5 17.5 L12 13 L2.5 17.5 L1.5 16 Z" fill="${color}"/>
        <path d="M12 20 L17 23 L16.5 23.8 L12 22 L7.5 23.8 L7 23 Z" fill="${color}"/>`;
  }
}

function createAircraftIcon(
  color: string,
  rotation: number,
  selected: boolean,
  onGround: boolean,
  cat: AircraftCategory
): L.DivIcon {
  const size = selected ? 34 : onGround ? 12 : 24;

  if (onGround) {
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="5.5" fill="${color}" opacity="0.85"
        stroke="${selected ? '#fff' : 'rgba(0,0,0,0.4)'}" stroke-width="${selected ? 2 : 1}"/>
    </svg>`;
    return L.divIcon({ html: svg, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
  }

  const stroke = selected ? '#ffffff' : 'rgba(0,0,0,0.45)';
  const sw = selected ? 1.5 : 0.7;
  const shape = aircraftShape(cat, color, stroke, sw);

  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
    style="transform:rotate(${rotation}deg);transform-origin:center">${shape}</svg>`;

  return L.divIcon({ html: svg, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

export default function FlightMap() {
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const spottingCirclesRef = useRef<L.Circle[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const movDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // baseLat/baseLon are the last authoritative positions; RAF projects forward from them
  const drRef = useRef<Map<string, { baseLat: number; baseLon: number; speed: number; track: number; ts: number }>>(new Map());
  const animRef = useRef<number | null>(null);

  const {
    aircraft,
    selectedAircraft,
    setSelectedAircraft,
    mapStyle,
    filters,
    spottingAlerts,
    followAircraft,
    setUserLocation,
    setMapCenter,
  } = useFlightStore();

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [48, 11],
      zoom: 5,
      zoomControl: false,
      attributionControl: true,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;

    map.on('moveend', () => {
      if (movDebounceRef.current) clearTimeout(movDebounceRef.current);
      movDebounceRef.current = setTimeout(() => {
        const c = map.getCenter();
        setMapCenter([c.lat, c.lng]);
      }, 800);
    });

    const tile = TILE_LAYERS[mapStyle];
    tileRef.current = L.tileLayer(tile.url, { attribution: tile.attribution, maxZoom: 19 }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Map style change
  useEffect(() => {
    if (!mapRef.current) return;
    tileRef.current?.remove();
    const tile = TILE_LAYERS[mapStyle];
    tileRef.current = L.tileLayer(tile.url, { attribution: tile.attribution, maxZoom: 19 }).addTo(mapRef.current);
  }, [mapStyle]);

  // User location
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setUserLocation([pos.coords.latitude, pos.coords.longitude]);
    });
  }, []);

  // Spotting circles
  useEffect(() => {
    if (!mapRef.current) return;
    spottingCirclesRef.current.forEach((c) => c.remove());
    spottingCirclesRef.current = [];
    for (const alert of spottingAlerts) {
      if (!alert.active) continue;
      const circle = L.circle([alert.lat, alert.lng], {
        radius: alert.radius * 1000,
        color: '#f97316',
        fillColor: '#f97316',
        fillOpacity: 0.05,
        dashArray: '6 4',
        weight: 1.5,
      }).addTo(mapRef.current);
      spottingCirclesRef.current.push(circle);
    }
  }, [spottingAlerts]);

  const handleMarkerClick = useCallback(
    (ac: Aircraft) => {
      setSelectedAircraft(ac);
    },
    [setSelectedAircraft]
  );

  // Update markers + seed dead-reckoning state
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const filtered = filterAircraft(aircraft, filters);
    const filteredIds = new Set(filtered.map((a) => a.icao24));

    // Remove stale
    for (const [id, marker] of markersRef.current) {
      if (!filteredIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
        drRef.current.delete(id);
      }
    }

    const now = Date.now();
    for (const ac of filtered) {
      if (!ac.latitude || !ac.longitude) continue;
      const cat = getAircraftCategory(ac);
      const color = getCategoryColor(cat);
      const rotation = getRotation(ac);
      const isSelected = selectedAircraft?.icao24 === ac.icao24;
      const icon = createAircraftIcon(color, rotation, isSelected, ac.on_ground, cat);

      // Anchor DR state to fresh authoritative position
      drRef.current.set(ac.icao24, {
        baseLat: ac.latitude,
        baseLon: ac.longitude,
        speed: ac.velocity ?? 0,
        track: ac.true_track ?? 0,
        ts: now,
      });

      const existing = markersRef.current.get(ac.icao24);
      if (existing) {
        existing.setLatLng([ac.latitude, ac.longitude]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([ac.latitude, ac.longitude], { icon })
          .addTo(map)
          .on('click', () => handleMarkerClick(ac));
        markersRef.current.set(ac.icao24, marker);
      }
    }
  }, [aircraft, filters, selectedAircraft, handleMarkerClick]);

  // RAF dead-reckoning: project each airborne aircraft from its last anchor position
  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      for (const [id, s] of drRef.current) {
        if (s.speed < 3) continue;               // ignore near-stationary
        const dt = (now - s.ts) / 1000;
        if (dt <= 0 || dt > 90) continue;        // don't extrapolate beyond 90 s
        const [lat, lon] = deadReckon(s.baseLat, s.baseLon, s.speed, s.track, dt);
        markersRef.current.get(id)?.setLatLng([lat, lon]);
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current !== null) cancelAnimationFrame(animRef.current); };
  }, []);

  // Follow selected aircraft
  useEffect(() => {
    if (!mapRef.current || !followAircraft || !selectedAircraft?.latitude || !selectedAircraft?.longitude) return;
    mapRef.current.panTo([selectedAircraft.latitude, selectedAircraft.longitude]);
  }, [selectedAircraft, followAircraft]);

  return <div ref={containerRef} className="w-full h-full" />;
}

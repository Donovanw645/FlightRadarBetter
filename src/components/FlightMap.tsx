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
      // Round body + main rotor cross + tail boom + tail rotor
      return `
        <ellipse cx="12" cy="11" rx="3" ry="4.5" fill="${color}" opacity="0.95" stroke="${stroke}" stroke-width="${sw}"/>
        <rect x="2.5" y="10.5" width="19" height="1.5" rx="0.75" fill="${color}" opacity="0.7"/>
        <rect x="11.2" y="15.5" width="1.6" height="5.5" rx="0.8" fill="${color}" opacity="0.95"/>
        <rect x="8.5" y="20" width="7" height="1.2" rx="0.6" fill="${color}" opacity="0.7"/>`;

    case 'drone':
      // Quadcopter X frame with motors at corners
      return `
        <line x1="12" y1="12" x2="6.5" y2="6.5" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="12" y1="12" x2="17.5" y2="6.5" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="12" y1="12" x2="6.5" y2="17.5" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="12" y1="12" x2="17.5" y2="17.5" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="12" cy="12" r="2.5" fill="${color}" opacity="0.95"/>
        <circle cx="6.5" cy="6.5" r="2.2" fill="${color}" opacity="0.85"/>
        <circle cx="17.5" cy="6.5" r="2.2" fill="${color}" opacity="0.85"/>
        <circle cx="6.5" cy="17.5" r="2.2" fill="${color}" opacity="0.85"/>
        <circle cx="17.5" cy="17.5" r="2.2" fill="${color}" opacity="0.85"/>`;

    case 'military':
      // Delta/swept fighter silhouette + small tail fin
      return `
        <path d="M12 2 L14.5 11 L21 15 L12 13 L3 15 L9.5 11 Z"
          fill="${color}" opacity="0.95" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
        <path d="M12 13 L14 20.5 L12 21.5 L10 20.5 Z"
          fill="${color}" opacity="0.95" stroke="${stroke}" stroke-width="${sw}"/>`;

    case 'glider':
      // Very long straight wings — distinctive wingspan
      return `
        <path d="M12 2 L12.5 8.5 L23 11.5 L12.5 12.5 L12.5 20 L13.5 21.5 L12 22.5 L10.5 21.5 L11.5 20 L11.5 12.5 L1 11.5 L11.5 8.5 Z"
          fill="${color}" opacity="0.95" stroke="${stroke}" stroke-width="${sw}"/>`;

    case 'private':
      // Shorter wingspan than airliner, straighter wing sweep
      return `
        <path d="M12 3 L12.8 8 L20 10.5 L12.8 12 L13 19 L14.5 21 L12 22 L9.5 21 L11 19 L11.2 12 L4 10.5 L11.2 8 Z"
          fill="${color}" opacity="0.95" stroke="${stroke}" stroke-width="${sw}"/>`;

    default:
      // Commercial / cargo — classic swept-wing airliner
      return `
        <path d="M12 2 L13 8 L22 11 L13 13 L13.5 20 L15.5 22 L12 23 L8.5 22 L10.5 20 L11 13 L2 11 L11 8 Z"
          fill="${color}" opacity="0.95" stroke="${stroke}" stroke-width="${sw}"/>`;
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
  const drRef = useRef<Map<string, { lat: number; lon: number; speed: number; track: number; ts: number }>>(new Map());
  const animFrameRef = useRef<number | null>(null);

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

      // Seed / refresh DR state with authoritative position
      drRef.current.set(ac.icao24, {
        lat: ac.latitude,
        lon: ac.longitude,
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

  // Dead-reckoning animation loop
  useEffect(() => {
    const ANIM_INTERVAL = 1000;
    const loop = () => {
      const now = Date.now();
      for (const [id, state] of drRef.current) {
        if (state.speed < 5 || state.track === 0) continue;
        const dt = (now - state.ts) / 1000;
        if (dt <= 0) continue;
        const [newLat, newLon] = deadReckon(state.lat, state.lon, state.speed, state.track, dt);
        state.lat = newLat;
        state.lon = newLon;
        state.ts = now;
        const marker = markersRef.current.get(id);
        marker?.setLatLng([newLat, newLon]);
      }
      animFrameRef.current = window.setTimeout(loop, ANIM_INTERVAL);
    };
    animFrameRef.current = window.setTimeout(loop, ANIM_INTERVAL);
    return () => {
      if (animFrameRef.current !== null) clearTimeout(animFrameRef.current);
    };
  }, []);

  // Follow selected aircraft
  useEffect(() => {
    if (!mapRef.current || !followAircraft || !selectedAircraft?.latitude || !selectedAircraft?.longitude) return;
    mapRef.current.panTo([selectedAircraft.latitude, selectedAircraft.longitude]);
  }, [selectedAircraft, followAircraft]);

  return <div ref={containerRef} className="w-full h-full" />;
}

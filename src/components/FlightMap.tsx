import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useFlightStore } from '../store/useFlightStore';
import { filterAircraft, getAircraftCategory, getCategoryColor, getRotation } from '../utils/aircraftUtils';
import type { MapStyle, Aircraft } from '../types';

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

function createAircraftIcon(color: string, rotation: number, selected: boolean, onGround: boolean): L.DivIcon {
  const size = selected ? 32 : onGround ? 14 : 22;
  const svg = onGround
    ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="6" fill="${color}" opacity="0.85" stroke="${selected ? '#fff' : 'transparent'}" stroke-width="2"/>
      </svg>`
    : `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${rotation}deg)">
        <path d="M12 2L8 10H4l2 2-2 8 8-4 8 4-2-8 2-2h-4z" fill="${color}" opacity="0.9" stroke="${selected ? '#fff' : 'rgba(0,0,0,0.5)'}" stroke-width="${selected ? 1.5 : 0.8}"/>
      </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function FlightMap() {
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const spottingCirclesRef = useRef<L.Circle[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const movDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Update markers
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
      }
    }

    // Add/update
    for (const ac of filtered) {
      if (!ac.latitude || !ac.longitude) continue;
      const cat = getAircraftCategory(ac);
      const color = getCategoryColor(cat);
      const rotation = getRotation(ac);
      const isSelected = selectedAircraft?.icao24 === ac.icao24;
      const icon = createAircraftIcon(color, rotation, isSelected, ac.on_ground);

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

  // Follow selected aircraft
  useEffect(() => {
    if (!mapRef.current || !followAircraft || !selectedAircraft?.latitude || !selectedAircraft?.longitude) return;
    mapRef.current.panTo([selectedAircraft.latitude, selectedAircraft.longitude]);
  }, [selectedAircraft, followAircraft]);

  return <div ref={containerRef} className="w-full h-full" />;
}

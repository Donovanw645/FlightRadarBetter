import { useEffect, useRef } from 'react';
import axios from 'axios';
import { useFlightStore } from '../store/useFlightStore';
import type { Aircraft, AircraftInfo, JetPhoto } from '../types';
import { haversineDistance } from '../utils/aircraftUtils';

const ADSB_FI_BASE = 'https://opendata.adsb.fi/api';
const RADIUS_NM = 250;
const REFRESH_INTERVAL = 20000;
const MIN_FETCH_GAP = 8000; // don't fetch more often than this

interface AdsbFiAircraft {
  hex: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | string;
  alt_geom?: number;
  gs?: number;
  track?: number;
  baro_rate?: number;
  squawk?: string;
  category?: string;
  on_ground?: boolean;
}

interface AdsbFiResponse {
  ac: AdsbFiAircraft[];
  now: number;
  total: number;
}

function normaliseLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function mapCategory(cat?: string): number {
  if (!cat || cat.length < 2) return 0;
  if (cat === 'A7') return 7;
  if (cat === 'B6') return 14;
  if (cat === 'B1') return 9;
  if (cat[0] === 'A') return parseInt(cat[1]) || 0;
  return 0;
}

function parseAdsbFiData(data: AdsbFiResponse): Aircraft[] {
  return (data?.ac ?? []).map((ac) => {
    const onGround = ac.alt_baro === 'ground' || ac.on_ground === true;
    const altBaroFt = typeof ac.alt_baro === 'number' ? ac.alt_baro : null;
    return {
      icao24: ac.hex.toLowerCase(),
      callsign: ac.flight?.trim() || null,
      origin_country: '',
      time_position: null,
      last_contact: Math.floor(Date.now() / 1000),
      longitude: ac.lon ?? null,
      latitude: ac.lat ?? null,
      baro_altitude: altBaroFt !== null ? altBaroFt / 3.28084 : null,
      on_ground: onGround,
      velocity: ac.gs !== undefined ? ac.gs / 1.94384 : null,
      true_track: ac.track ?? null,
      vertical_rate: ac.baro_rate !== undefined ? ac.baro_rate / 196.85 : null,
      sensors: null,
      geo_altitude: ac.alt_geom !== undefined ? ac.alt_geom / 3.28084 : null,
      squawk: ac.squawk ?? null,
      spi: false,
      position_source: 0,
      category: mapCategory(ac.category),
    };
  });
}

// Rotating proxy pool — remembers which one worked last
let lastProxy = 0;

async function fetchWithProxy(targetUrl: string): Promise<AdsbFiResponse> {
  type ProxyFn = () => Promise<AdsbFiResponse>;
  const proxies: ProxyFn[] = [
    // corsproxy.io — raw URL, no encoding
    async () => {
      const r = await axios.get<AdsbFiResponse>(`https://corsproxy.io/?${targetUrl}`, { timeout: 14000 });
      return r.data;
    },
    // allorigins /get — wraps body in { contents: string }
    async () => {
      const r = await axios.get<{ contents: string }>(
        `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
        { timeout: 16000 }
      );
      return JSON.parse(r.data.contents) as AdsbFiResponse;
    },
    // codetabs proxy
    async () => {
      const r = await axios.get<AdsbFiResponse>(
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
        { timeout: 14000 }
      );
      return r.data;
    },
  ];

  // Try from last-known-good proxy, then wrap around
  for (let i = 0; i < proxies.length; i++) {
    const idx = (lastProxy + i) % proxies.length;
    try {
      const data = await proxies[idx]();
      if (Array.isArray(data?.ac)) {
        lastProxy = idx;
        return data;
      }
    } catch (e) {
      console.warn(`[PlaneTracker] proxy ${idx} failed:`, e);
    }
  }
  throw new Error('All proxies failed');
}

export function useFlightData() {
  const {
    setAircraft,
    setIsLoading,
    setLastUpdate,
    setFetchError,
    mapCenter,
    spottingAlerts,
    addTriggeredAlert,
    userLocation,
  } = useFlightStore();

  const mapCenterRef = useRef<[number, number]>(mapCenter);
  mapCenterRef.current = mapCenter;

  const isMountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const panDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchRef = useRef<number>(0);

  const fetchFlights = async () => {
    if (!isMountedRef.current) return;
    const now = Date.now();
    if (now - lastFetchRef.current < MIN_FETCH_GAP) return;
    lastFetchRef.current = now;

    try {
      setIsLoading(true);
      const [rawLat, rawLon] = mapCenterRef.current;
      const lat = Math.max(-85, Math.min(85, rawLat));
      const lon = normaliseLon(rawLon);

      const target = `${ADSB_FI_BASE}/v3/lat/${lat.toFixed(2)}/lon/${lon.toFixed(2)}/dist/${RADIUS_NM}`;
      const data = await fetchWithProxy(target);
      if (!isMountedRef.current) return;

      const aircraft = parseAdsbFiData(data);
      setAircraft(aircraft);
      setLastUpdate(new Date());
      setFetchError(null);

      if (userLocation) {
        for (const alert of spottingAlerts) {
          if (!alert.active) continue;
          for (const ac of aircraft) {
            if (!ac.latitude || !ac.longitude) continue;
            const dist = haversineDistance(alert.lat, alert.lng, ac.latitude, ac.longitude);
            if (dist <= alert.radius) {
              if (
                alert.callsign === '*' ||
                alert.callsign === '' ||
                (ac.callsign ?? '').toUpperCase().includes(alert.callsign.toUpperCase())
              ) {
                addTriggeredAlert({ ...alert, callsign: ac.callsign ?? alert.callsign });
              }
            }
          }
        }
      }
    } catch {
      if (isMountedRef.current) setFetchError('Unable to load flight data — retrying shortly');
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchFlights();
    intervalRef.current = setInterval(fetchFlights, REFRESH_INTERVAL);
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [spottingAlerts, userLocation]);

  useEffect(() => {
    if (panDebounceRef.current) clearTimeout(panDebounceRef.current);
    panDebounceRef.current = setTimeout(() => {
      if (isMountedRef.current) fetchFlights();
    }, 600);
    return () => {
      if (panDebounceRef.current) clearTimeout(panDebounceRef.current);
    };
  }, [mapCenter]);
}

// ─── Planespotters.net — CORS-enabled, returns info + photos in one call ───

interface PlanespottersResponse {
  aircraft: Array<{
    reg?: string;
    type?: string;
    icaotype?: string;
    operatorname?: string;
    operator?: string;
    country?: string;
    photos?: {
      photos?: Array<{
        large?: { src: string };
        medium?: { src: string };
        thumbnail?: { src: string };
        photographer?: string;
      }>;
    };
  }>;
}

export async function fetchAircraftInfo(icao24: string): Promise<AircraftInfo | null> {
  try {
    const res = await axios.get<PlanespottersResponse>(
      `https://api.planespotters.net/pub/aircraft/${icao24}`,
      { timeout: 8000 }
    );
    const ac = res.data?.aircraft?.[0];
    if (!ac) return null;
    return {
      icao24,
      registration: ac.reg ?? '',
      manufacturericao: '',
      manufacturername: '',
      model: ac.type ?? '',
      typecode: ac.icaotype ?? '',
      serialnumber: '',
      linenumber: '',
      icaoaircrafttype: ac.icaotype ?? '',
      operator: ac.operatorname ?? ac.operator ?? '',
      operatorcallsign: '',
      operatoricao: '',
      operatoriata: '',
      owner: '',
      categoryDescription: '',
      built: '',
      engines: '',
      country: ac.country ?? '',
      notes: '',
    };
  } catch {
    return null;
  }
}

export async function fetchJetPhoto(icao24: string): Promise<JetPhoto | null> {
  try {
    const res = await axios.get<PlanespottersResponse>(
      `https://api.planespotters.net/pub/aircraft/${icao24}`,
      { timeout: 8000 }
    );
    const photo = res.data?.aircraft?.[0]?.photos?.photos?.[0];
    if (!photo) return null;
    const imageUrl = photo.large?.src ?? photo.medium?.src ?? photo.thumbnail?.src ?? '';
    if (!imageUrl) return null;
    return { imageUrl, photographer: photo.photographer ?? 'Unknown' };
  } catch {
    return null;
  }
}

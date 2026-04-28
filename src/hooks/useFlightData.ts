import { useEffect, useRef } from 'react';
import axios from 'axios';
import { useFlightStore } from '../store/useFlightStore';
import type { Aircraft } from '../types';
import { haversineDistance } from '../utils/aircraftUtils';

const ADSB_FI_BASE = 'https://opendata.adsb.fi/api';
const RADIUS_NM = 250;
const REFRESH_INTERVAL = 15000;

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

// Normalise Leaflet longitude (can exceed ±180 when scrolling past dateline)
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

async function fetchAdsbFi(lat: number, lon: number): Promise<AdsbFiResponse> {
  const target = `${ADSB_FI_BASE}/v3/lat/${lat.toFixed(2)}/lon/${lon.toFixed(2)}/dist/${RADIUS_NM}`;

  // corsproxy.io: append raw URL (NOT encoded) after the ?
  try {
    const res = await axios.get<AdsbFiResponse>(
      `https://corsproxy.io/?${target}`,
      { timeout: 14000 }
    );
    return res.data;
  } catch (e1) {
    console.warn('[PlaneTracker] corsproxy.io failed, trying allorigins:', e1);
  }

  // allorigins /get: wraps response in { contents: string }
  try {
    const res = await axios.get<{ contents: string }>(
      `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`,
      { timeout: 18000 }
    );
    return JSON.parse(res.data.contents) as AdsbFiResponse;
  } catch (e2) {
    console.error('[PlaneTracker] both proxies failed:', e2);
    throw e2;
  }
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

  // Ref so fetchFlights always uses the latest center without restarting the interval
  const mapCenterRef = useRef<[number, number]>(mapCenter);
  mapCenterRef.current = mapCenter;

  const isMountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const panDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchFlights = async () => {
    if (!isMountedRef.current) return;
    try {
      setIsLoading(true);
      const [rawLat, rawLon] = mapCenterRef.current;
      const lat = Math.max(-85, Math.min(85, rawLat));
      const lon = normaliseLon(rawLon);

      const data = await fetchAdsbFi(lat, lon);
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

  // Main interval — only restarts when alerts/location change, NOT on every pan
  useEffect(() => {
    isMountedRef.current = true;
    fetchFlights();
    intervalRef.current = setInterval(fetchFlights, REFRESH_INTERVAL);
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [spottingAlerts, userLocation]);

  // On map pan: trigger one fresh fetch after a short settle delay
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

export async function fetchAircraftInfo(icao24: string) {
  try {
    const res = await axios.get(
      `https://opensky-network.org/api/metadata/aircraft/icao/${icao24}`,
      { timeout: 8000 }
    );
    return res.data;
  } catch {
    return null;
  }
}

export async function fetchJetPhoto(registration: string): Promise<{ imageUrl: string; photographer: string } | null> {
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.jetphotos.com/photo/keyword/${registration}`)}`;
    const res = await axios.get(proxyUrl, { timeout: 8000 });
    const html: string = res.data;
    const imgMatch = html.match(/https:\/\/cdn\.jetphotos\.com\/full\/[^"']+\.jpg/);
    const photographerMatch = html.match(/class="result__photographer"[^>]*>([^<]+)<\/a>/);
    if (imgMatch) {
      return {
        imageUrl: imgMatch[0],
        photographer: photographerMatch ? photographerMatch[1].trim() : 'Unknown',
      };
    }
    return null;
  } catch {
    return null;
  }
}

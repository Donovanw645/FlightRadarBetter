import { useEffect, useRef } from 'react';
import axios from 'axios';
import { useFlightStore } from '../store/useFlightStore';
import type { Aircraft } from '../types';
import { haversineDistance } from '../utils/aircraftUtils';

// adsb.fi open data routed through a CORS proxy (adsb.fi blocks direct browser requests)
// Docs: https://github.com/adsbfi/opendata
const ADSB_FI_BASE = 'https://opendata.adsb.fi/api';
const CORS_PROXY = 'https://corsproxy.io/?';
const RADIUS_NM = 250; // max allowed by adsb.fi
const REFRESH_INTERVAL = 15000;

interface AdsbFiAircraft {
  hex: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | string; // feet, or the string "ground"
  alt_geom?: number;          // feet
  gs?: number;                // knots
  track?: number;
  baro_rate?: number;         // feet/minute
  squawk?: string;
  category?: string;          // "A3", "B6", etc.
  on_ground?: boolean;
}

interface AdsbFiResponse {
  ac: AdsbFiAircraft[];
  now: number;
  total: number;
}

function mapCategory(cat?: string): number {
  if (!cat || cat.length < 2) return 0;
  if (cat === 'A7') return 7;   // Rotorcraft → helicopter
  if (cat === 'B6') return 14;  // UAV
  if (cat === 'B1') return 9;   // Glider
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
      // adsb.fi uses feet; our utils expect metres
      baro_altitude: altBaroFt !== null ? altBaroFt / 3.28084 : null,
      on_ground: onGround,
      // adsb.fi uses knots; our utils expect m/s
      velocity: ac.gs !== undefined ? ac.gs / 1.94384 : null,
      true_track: ac.track ?? null,
      // adsb.fi uses ft/min; our utils expect m/s
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

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const fetchFlights = async () => {
    if (!isMountedRef.current) return;
    try {
      setIsLoading(true);
      const [lat, lon] = mapCenter;
      const targetUrl = `${ADSB_FI_BASE}/v3/lat/${lat.toFixed(2)}/lon/${lon.toFixed(2)}/dist/${RADIUS_NM}`;

      // adsb.fi has no CORS headers, route through proxy
      let data: AdsbFiResponse;
      try {
        const res = await axios.get(`${CORS_PROXY}${encodeURIComponent(targetUrl)}`, { timeout: 15000 });
        data = (typeof res.data === 'string' ? JSON.parse(res.data) : res.data) as AdsbFiResponse;
      } catch {
        // Fallback: allorigins.win proxy
        const res = await axios.get(
          `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
          { timeout: 20000 }
        );
        data = (typeof res.data === 'string' ? JSON.parse(res.data) : res.data) as AdsbFiResponse;
      }

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
    } catch (err) {
      console.error('[PlaneTracker] fetch error:', err);
      if (isMountedRef.current) {
        setFetchError('Unable to load flight data — retrying shortly');
      }
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
  }, [mapCenter, spottingAlerts, userLocation]);
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

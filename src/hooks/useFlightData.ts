import { useEffect, useRef } from 'react';
import axios from 'axios';
import { useFlightStore } from '../store/useFlightStore';
import type { Aircraft } from '../types';
import { haversineDistance } from '../utils/aircraftUtils';

const OPENSKY_URL = 'https://opensky-network.org/api/states/all';
const PROXY_URL = `https://api.allorigins.win/get?url=${encodeURIComponent(OPENSKY_URL)}`;
const REFRESH_INTERVAL = 15000;

function parseOpenSkyData(data: { states: unknown[][] | null }): Aircraft[] {
  const states: unknown[][] = data?.states ?? [];
  return states.map((s) => ({
    icao24: s[0] as string,
    callsign: (s[1] as string)?.trim() || null,
    origin_country: s[2] as string,
    time_position: s[3] as number | null,
    last_contact: s[4] as number,
    longitude: s[5] as number | null,
    latitude: s[6] as number | null,
    baro_altitude: s[7] as number | null,
    on_ground: s[8] as boolean,
    velocity: s[9] as number | null,
    true_track: s[10] as number | null,
    vertical_rate: s[11] as number | null,
    sensors: s[12] as number[] | null,
    geo_altitude: s[13] as number | null,
    squawk: s[14] as string | null,
    spi: s[15] as boolean,
    position_source: s[16] as number,
    category: (s[17] as number) ?? 0,
  }));
}

export function useFlightData() {
  const {
    setAircraft,
    setIsLoading,
    setLastUpdate,
    setFetchError,
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

      let data: { states: unknown[][] | null };

      try {
        const res = await axios.get<{ states: unknown[][] | null }>(OPENSKY_URL, { timeout: 12000 });
        data = res.data;
      } catch {
        // Direct fetch failed (CORS or network); try via proxy
        const proxyRes = await axios.get<{ contents: string }>(PROXY_URL, { timeout: 15000 });
        data = JSON.parse(proxyRes.data.contents) as { states: unknown[][] | null };
      }

      if (!isMountedRef.current) return;

      const aircraft = parseOpenSkyData(data);
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
  }, [spottingAlerts, userLocation]);
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

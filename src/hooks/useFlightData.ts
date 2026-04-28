import { useEffect, useRef } from 'react';
import axios from 'axios';
import { useFlightStore } from '../store/useFlightStore';
import type { Aircraft, AircraftInfo, JetPhoto } from '../types';
import { haversineDistance } from '../utils/aircraftUtils';

const ADSB_FI_BASE = 'https://opendata.adsb.fi/api';
const RADIUS_NM = 250;
const REFRESH_INTERVAL = 10000;
const MIN_FETCH_GAP = 4000;

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
  t?: string;
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
      typeCode: ac.t ?? undefined,
    };
  });
}

function validate(data: AdsbFiResponse): AdsbFiResponse {
  if (!Array.isArray(data?.ac)) throw new Error('invalid response');
  return data;
}

async function fetchWithProxy(targetUrl: string): Promise<AdsbFiResponse> {
  // Race all three proxies simultaneously — first valid response wins
  const attempts: Promise<AdsbFiResponse>[] = [
    axios.get<AdsbFiResponse>(`https://corsproxy.io/?${targetUrl}`, { timeout: 9000 })
      .then(r => validate(r.data)),
    axios.get<{ contents: string }>(
      `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
      { timeout: 11000 }
    ).then(r => validate(JSON.parse(r.data.contents) as AdsbFiResponse)),
    axios.get<AdsbFiResponse>(
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
      { timeout: 9000 }
    ).then(r => validate(r.data)),
  ];

  // Promise.any: resolves with first success, throws AggregateError only if all fail
  return (Promise as any).any(attempts).catch(() => { throw new Error('All proxies failed'); });
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

// ─── Wikipedia stock photo fallback ───────────────────────────────────────

const TYPE_WIKI: Record<string, string> = {
  // Airbus narrowbody
  A318: 'Airbus_A318', A319: 'Airbus_A319', A320: 'Airbus_A320_family',
  A321: 'Airbus_A321', A20N: 'Airbus_A320neo_family', A21N: 'Airbus_A321neo_family',
  A19N: 'Airbus_A319neo',
  // Airbus widebody
  A300: 'Airbus_A300', A310: 'Airbus_A310', A330: 'Airbus_A330',
  A332: 'Airbus_A330', A333: 'Airbus_A330', A339: 'Airbus_A330neo',
  A340: 'Airbus_A340', A342: 'Airbus_A340', A343: 'Airbus_A340', A345: 'Airbus_A340', A346: 'Airbus_A340',
  A350: 'Airbus_A350', A35K: 'Airbus_A350', A359: 'Airbus_A350',
  A380: 'Airbus_A380', A388: 'Airbus_A380',
  // Boeing narrowbody
  B732: 'Boeing_737_Classic', B733: 'Boeing_737_Classic', B734: 'Boeing_737_Classic', B735: 'Boeing_737_Classic',
  B736: 'Boeing_737_Next_Generation', B737: 'Boeing_737_Next_Generation',
  B738: 'Boeing_737_Next_Generation', B739: 'Boeing_737_Next_Generation',
  B38M: 'Boeing_737_MAX', B39M: 'Boeing_737_MAX',
  // Boeing widebody
  B741: 'Boeing_747', B742: 'Boeing_747', B743: 'Boeing_747', B744: 'Boeing_747', B748: 'Boeing_747-8',
  B752: 'Boeing_757', B753: 'Boeing_757',
  B762: 'Boeing_767', B763: 'Boeing_767', B764: 'Boeing_767',
  B772: 'Boeing_777', B773: 'Boeing_777', B77L: 'Boeing_777', B77W: 'Boeing_777',
  B788: 'Boeing_787_Dreamliner', B789: 'Boeing_787_Dreamliner', B78X: 'Boeing_787_Dreamliner',
  // Regional jets
  E170: 'Embraer_170', E175: 'Embraer_175', E190: 'Embraer_190', E195: 'Embraer_195',
  E75L: 'Embraer_175', E7W: 'Embraer_E-Jet_E2_family',
  CRJ2: 'Bombardier_CRJ200', CRJ7: 'Bombardier_CRJ700', CRJ9: 'Bombardier_CRJ900',
  DH8D: 'Bombardier_Dash_8', AT75: 'ATR_72', AT72: 'ATR_72', AT45: 'ATR_42',
  // Turboprops / GA
  C172: 'Cessna_172', C182: 'Cessna_182', C208: 'Cessna_208_Caravan',
  BE20: 'Beechcraft_Super_King_Air', BE35: 'Beechcraft_Bonanza',
  PA28: 'Piper_Cherokee', PC12: 'Pilatus_PC-12',
  // Military fixed-wing — transports
  C130: 'Lockheed_C-130_Hercules', C17: 'Boeing_C-17_Globemaster_III',
  C5M: 'Lockheed_C-5_Galaxy', C141: 'Lockheed_C-141_Starlifter',
  C2: 'Grumman_C-2_Greyhound', C9: 'McDonnell_Douglas_C-9',
  C12: 'Beechcraft_Super_King_Air', C20: 'Gulfstream_III', C21: 'Learjet_35',
  C26: 'Fairchild_Metro', C32: 'Boeing_C-32', C37: 'Gulfstream_V', C40: 'Boeing_737',
  // Military fixed-wing — tankers & special mission
  KC135: 'Boeing_KC-135_Stratotanker', KC10: 'McDonnell_Douglas_KC-10_Extender',
  KC46: 'Boeing_KC-46_Pegasus',
  E2: 'Northrop_Grumman_E-2_Hawkeye', E3: 'Boeing_E-3_Sentry',
  E6: 'Boeing_E-6_Mercury', E8: 'Northrop_Grumman_E-8_Joint_STARS',
  EP3: 'Lockheed_EP-3_Aries', RC135: 'Boeing_RC-135',
  P3: 'Lockheed_P-3_Orion', P8: 'Boeing_P-8_Poseidon',
  // Military fixed-wing — fighters & attack
  F16: 'General_Dynamics_F-16_Fighting_Falcon', F15: 'McDonnell_Douglas_F-15_Eagle',
  F18: 'McDonnell_Douglas_F/A-18_Hornet', F35: 'Lockheed_Martin_F-35_Lightning_II',
  F22: 'Lockheed_Martin_F-22_Raptor', F14: 'Grumman_F-14_Tomcat',
  B52: 'Boeing_B-52_Stratofortress', B1B: 'Rockwell_B-1_Lancer',
  B2: 'Northrop_Grumman_B-2_Spirit', U2: 'Lockheed_U-2',
  A10: 'Fairchild_Republic_A-10_Thunderbolt_II', V22: 'Bell_Boeing_V-22_Osprey',
  // Military fixed-wing — trainers
  T38: 'Northrop_T-38_Talon', T45: 'McDonnell_Douglas_T-45_Goshawk',
  T6: 'Beechcraft_T-6_Texan_II', T1: 'Raytheon_T-1_Jayhawk',
  // Experimental / NASA X-planes
  X59: 'Lockheed_Martin_X-59_QueSST',
  X47: 'Northrop_Grumman_X-47', X48: 'Boeing_X-48',
  // Helicopters — civil
  EC35: 'Airbus_H135', EC45: 'Airbus_H145', EC30: 'Eurocopter_EC130',
  EC20: 'Eurocopter_EC120_Colibri', EC55: 'Airbus_H155',
  H135: 'Airbus_H135', H145: 'Airbus_H145', H160: 'Airbus_H160',
  AS32: 'Aerospatiale_AS332_Super_Puma', AS35: 'Eurocopter_AS350', AS65: 'Eurocopter_AS365_Dauphin',
  AW13: 'Leonardo_AW139', AW16: 'Leonardo_AW169', AW10: 'Leonardo_AW101',
  B06: 'Bell_206', B47: 'Bell_47', B212: 'Bell_212', B412: 'Bell_412',
  B429: 'Bell_429', B505: 'Bell_505', B525: 'Bell_525',
  R22: 'Robinson_R22', R44: 'Robinson_R44', R66: 'Robinson_R66',
  S61: 'Sikorsky_S-61', S76: 'Sikorsky_S-76', S92: 'Sikorsky_S-92',
  MD52: 'MD_Helicopters_MD_500', MD60: 'MD_Helicopters_MD_600',
  MI8: 'Mil_Mi-8', MI17: 'Mil_Mi-17', MI26: 'Mil_Mi-26',
  // Helicopters — military
  UH60: 'Sikorsky_UH-60_Black_Hawk', HH60: 'Sikorsky_UH-60_Black_Hawk',
  SH60: 'Sikorsky_UH-60_Black_Hawk', MH60: 'Sikorsky_UH-60_Black_Hawk',
  CH47: 'Boeing_CH-47_Chinook', MH47: 'Boeing_CH-47_Chinook',
  AH64: 'Boeing_AH-64_Apache', AH1: 'Bell_AH-1_SuperCobra',
  OH58: 'Bell_OH-58_Kiowa', UH1: 'Bell_UH-1_Iroquois',
  CH53: 'Sikorsky_CH-53_Sea_Stallion', MH53: 'Sikorsky_CH-53_Sea_Stallion',
  // Business jets
  GL5T: 'Bombardier_Global_5000', GLEX: 'Bombardier_Global_Express',
  GL7T: 'Bombardier_Global_7500',
  F900: 'Dassault_Falcon_900', F2TH: 'Dassault_Falcon_2000', F7X: 'Dassault_Falcon_7X',
  C56X: 'Cessna_Citation_X', C680: 'Cessna_Citation_Sovereign', C750: 'Cessna_Citation_X',
  LJ45: 'Learjet_45', LJ60: 'Learjet_60', LJ75: 'Learjet_75',
  GALX: 'Israel_Aerospace_Industries_Galaxy', G280: 'Gulfstream_G280',
  G550: 'Gulfstream_V', G650: 'Gulfstream_G650',
};

// When a civilian ICAO type code belongs to a military variant, use this instead
const MILITARY_TYPE_WIKI: Record<string, string> = {
  B762: 'Boeing_KC-46_Pegasus',         // KC-46A Pegasus tanker
  B763: 'Boeing_VC-25',                  // C-32A / VC-25A
  B752: 'Boeing_C-32',                   // C-32A VIP transport
  B744: 'Boeing_E-4',                    // E-4B Nightwatch
  B772: 'Boeing_E-767',                  // E-767 AWACS variant
  DC87: 'Boeing_C-17_Globemaster_III',
  L100: 'Lockheed_C-130_Hercules',       // civilian C-130 designation
  C130: 'Lockheed_C-130_Hercules',
  C17: 'Boeing_C-17_Globemaster_III',
  T38: 'Northrop_T-38_Talon',
  T45: 'McDonnell_Douglas_T-45_Goshawk',
  T6: 'Beechcraft_T-6_Texan_II',
  X59: 'Lockheed_Martin_X-59_QueSST',
};

// Guaranteed category-level fallback — ensures every airborne aircraft gets a photo
const CATEGORY_FALLBACK_WIKI: Record<string, string> = {
  commercial: 'Airbus_A320_family',
  cargo:      'Boeing_747-8',
  military:   'Lockheed_C-130_Hercules',
  private:    'Cessna_172',
  helicopter: 'Bell_206',
  glider:     'Glider_aircraft',
  drone:      'General_Atomics_MQ-9_Reaper',
};

async function fetchWikiArticle(article: string): Promise<JetPhoto | null> {
  try {
    const res = await axios.get<{ thumbnail?: { source: string }; title: string }>(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article)}`,
      { timeout: 8000 }
    );
    const src = res.data?.thumbnail?.source;
    if (!src) return null;
    return { imageUrl: src, photographer: `Wikipedia – ${res.data.title}` };
  } catch {
    return null;
  }
}

async function fetchWikiPhoto(typeCode: string): Promise<JetPhoto | null> {
  const article = TYPE_WIKI[typeCode.toUpperCase()];
  return article ? fetchWikiArticle(article) : null;
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

export async function fetchJetPhoto(icao24: string, typeCode?: string, category?: string): Promise<JetPhoto | null> {
  // 1. Planespotters — real registration photo (best match)
  try {
    const res = await axios.get<PlanespottersResponse>(
      `https://api.planespotters.net/pub/aircraft/${icao24}`,
      { timeout: 8000 }
    );
    const photo = res.data?.aircraft?.[0]?.photos?.photos?.[0];
    if (photo) {
      const imageUrl = photo.large?.src ?? photo.medium?.src ?? photo.thumbnail?.src ?? '';
      if (imageUrl) return { imageUrl, photographer: photo.photographer ?? 'Unknown' };
    }
  } catch { /* fall through */ }

  const tc = typeCode?.toUpperCase();

  // 2. Military override — civilian type codes used by military variants
  if (category === 'military' && tc) {
    const photo = await fetchWikiArticle(MILITARY_TYPE_WIKI[tc] ?? '').catch(() => null);
    if (photo) return photo;
  }

  // 3. Type-code specific Wikipedia article
  if (tc) {
    const photo = await fetchWikiPhoto(tc);
    if (photo) return photo;
  }

  // 4. Category-level fallback — guarantees a photo for every airborne aircraft
  if (category && category !== 'ground') {
    const article = CATEGORY_FALLBACK_WIKI[category];
    if (article) {
      const photo = await fetchWikiArticle(article);
      if (photo) return photo;
    }
  }

  return null;
}

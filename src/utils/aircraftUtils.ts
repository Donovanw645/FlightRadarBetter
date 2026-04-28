import type { Aircraft, AircraftCategory, FilterState } from '../types';

export const MILITARY_ICAO_RANGES: [number, number][] = [
  [0xae0000, 0xafffff], // US Military
  [0x43c000, 0x43cfff], // UK Military
  [0x3a0000, 0x3a0fff], // France Military
  [0x683000, 0x6831ff], // Germany Military
  [0x800000, 0x8001ff], // China Military
  [0x140000, 0x1400ff], // Russia Military
];

export const MILITARY_CALLSIGN_PREFIXES = [
  'RCH', 'REACH', 'JAKE', 'KNIFE', 'SPAR', 'SAM', 'AIR FORCE',
  'NAVY', 'MARINE', 'ARMY', 'COAST', 'GUARD', 'PAT', 'GTMO',
  'CNV', 'EXEC', 'BOXER', 'RAIDER', 'VAMPIRE', 'VIPER',
  'COBRA', 'HAWK', 'EAGLE', 'FALCON', 'RAPTOR', 'GHOST',
  'DARKSTAR', 'MARLIN', 'GOAT', 'RAGE', 'DOOM', 'FIST',
];

export function isMilitary(aircraft: Aircraft): boolean {
  const icaoInt = parseInt(aircraft.icao24, 16);
  for (const [min, max] of MILITARY_ICAO_RANGES) {
    if (icaoInt >= min && icaoInt <= max) return true;
  }
  if (aircraft.callsign) {
    const cs = aircraft.callsign.trim().toUpperCase();
    for (const prefix of MILITARY_CALLSIGN_PREFIXES) {
      if (cs.startsWith(prefix)) return true;
    }
  }
  return false;
}

function categoryFromTypeCode(tc: string): AircraftCategory | null {
  const t = tc.toUpperCase();
  // Airbus narrowbody / widebody (A318-A388, A20N, A21N, A19N, etc.)
  if (/^A3[0-9]/.test(t) || t === 'A20N' || t === 'A21N' || t === 'A19N' || t === 'A22N') return 'commercial';
  // Boeing narrowbody / widebody (B717, B737-B787, B38M MAX, B39M MAX)
  if (/^B7[0-9]/.test(t) || t === 'B38M' || t === 'B39M' || t === 'B3XM') return 'commercial';
  // Embraer E-jets, CRJ, ATR, Dash-8, MD-80/90
  if (/^(E[12][0-9]{2}|CRJ|DH8|AT[47]|MD[89])/.test(t)) return 'commercial';
  // Concorde / supersonic
  if (t === 'CONC' || t === 'SSC') return 'commercial';
  // Business jets (Gulfstream, Bombardier Global, Dassault Falcon, Cessna Citation, Learjet)
  if (/^(GL[0-9T]|GV|G[0-9]{3}|F[29][0-9T]|C5[0-9]{2}|C68[05]|C750|LJ[0-9]|H25|CL6)/.test(t)) return 'private';
  // Cessna piston/turboprop, Piper, Beechcraft, Cirrus, Diamond, Pilatus
  if (/^(C1[0-9]{2}|C2[0-9]{2}|C3[0-9]{2}|C4[0-9]{2}|PA[0-9]{2}|BE[0-9]{2}|SR[0-9]{2}|DA[0-9]{2}|PC[0-9]|TBM|TB[0-9]|P28|P32|P46|M20)/.test(t)) return 'private';
  // Helicopters
  if (/^(EC[0-9]|AS[0-9]|AW[0-9]|R[0-9]{2}|S[67][0-9]|B06|B21|B41|BK1|H1[0-9]|H6[05]|MD5|MD9|HU[12]|NH9|RQ|UH|SH|CH4|CH5)/.test(t)) return 'helicopter';
  // Military fixed-wing: fighters, trainers, transports, patrol, tankers, AWACS, drones, X-planes
  if (/^(F1[456]|F1[89]|F22|F35|A10|B1B|B52|B2|C130|C17A?|KC1[03]|KC46|E[2368]|E8C|U2|SR7|MQ[19]|RQ4|C5M?|C141|P8|T38|T45|T6|T1A?|X[0-9]|EP3|RC1|OV1|OA1|E45|VC[12]|C2[0-9]|C9[0-9]|C12|C20|C21|C26|C32|C37|C40)/.test(t)) return 'military';
  // Gliders
  if (/^(ASW|ASK|LS[0-9]|DG[0-9]|LAK|PIK|SZD|GR0|K8|G10[24])/.test(t)) return 'glider';
  return null;
}

export function getAircraftCategory(aircraft: Aircraft): AircraftCategory {
  if (aircraft.on_ground) return 'ground';
  if (isMilitary(aircraft)) return 'military';

  // ICAO ADS-B emitter categories (adsb.fi/readsb encoding):
  // 1=light(A1), 2=small(A2), 3=large(A3), 4=high-vortex(A4), 5=heavy(A5)
  // 6=high-perf(A6), 7=rotorcraft(A7), 9=glider(B1), 14=UAV(B6)
  const cat = aircraft.category;
  if (cat === 7) return 'helicopter';
  if (cat === 9) return 'glider';
  if (cat === 14) return 'drone';
  if (cat === 3 || cat === 4 || cat === 5) return 'commercial';
  if (cat === 6) return 'private'; // high-performance (business jets etc.)
  if (cat === 1 || cat === 2) return 'private';

  // Use ICAO type code when ADS-B category is unknown
  if (aircraft.typeCode) {
    const fromType = categoryFromTypeCode(aircraft.typeCode);
    if (fromType) return fromType;
  }

  // Speed/altitude heuristic — velocity in m/s, altitude in metres
  const vel = aircraft.velocity ?? 0;
  const alt = aircraft.baro_altitude ?? 0;
  if (vel < 30 && alt < 500) return 'helicopter';
  if (alt > 7500 || vel > 200) return 'commercial'; // 7500 m ≈ 24 600 ft, 200 m/s ≈ 389 kts
  if (vel > 100) return 'private';
  return 'private';
}

export function getRotation(aircraft: Aircraft): number {
  return aircraft.true_track ?? 0;
}

export function filterAircraft(aircraft: Aircraft[], filters: FilterState): Aircraft[] {
  return aircraft.filter((ac) => {
    if (!ac.latitude || !ac.longitude) return false;

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const callsign = (ac.callsign ?? '').toLowerCase();
      const icao = ac.icao24.toLowerCase();
      if (!callsign.includes(q) && !icao.includes(q)) return false;
    }

    if (filters.militaryOnly && !isMilitary(ac)) return false;

    const cat = getAircraftCategory(ac);
    if (!filters.categories.includes('all') && !filters.categories.includes(cat)) return false;

    if (!filters.onGroundVisible && ac.on_ground) return false;

    const alt = ac.baro_altitude ?? 0;
    if (!ac.on_ground) {
      if (alt < filters.minAltitude || alt > filters.maxAltitude) return false;
    }

    const spd = ac.velocity ?? 0;
    if (spd < filters.minSpeed || spd > filters.maxSpeed) return false;

    if (filters.countries.length > 0) {
      if (!filters.countries.includes(ac.origin_country)) return false;
    }

    return true;
  });
}

export function formatAltitude(meters: number | null): string {
  if (meters === null) return 'N/A';
  const feet = Math.round(meters * 3.28084);
  return `${feet.toLocaleString()} ft`;
}

export function formatSpeed(ms: number | null): string {
  if (ms === null) return 'N/A';
  const knots = Math.round(ms * 1.94384);
  return `${knots} kts`;
}

export function formatVerticalRate(ms: number | null): string {
  if (ms === null || ms === 0) return '→ Level';
  const fpm = Math.round(ms * 196.85);
  return ms > 0 ? `↑ +${fpm} fpm` : `↓ ${fpm} fpm`;
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getCategoryColor(cat: AircraftCategory): string {
  const colors: Record<AircraftCategory, string> = {
    all: '#facc15',
    commercial: '#facc15',
    cargo: '#facc15',
    military: '#ef4444',   // red — keep for safety awareness
    private: '#facc15',
    helicopter: '#facc15',
    glider: '#facc15',
    drone: '#facc15',
    ground: '#6b7280',     // gray — keep so ground traffic is distinct
  };
  return colors[cat];
}

export function getCategoryLabel(cat: AircraftCategory): string {
  const labels: Record<AircraftCategory, string> = {
    all: 'All',
    commercial: 'Commercial',
    cargo: 'Cargo',
    military: 'Military',
    private: 'Private / GA',
    helicopter: 'Helicopter',
    glider: 'Glider',
    drone: 'Drone / UAV',
    ground: 'On Ground',
  };
  return labels[cat];
}

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

export function getAircraftCategory(aircraft: Aircraft): AircraftCategory {
  if (aircraft.on_ground) return 'ground';
  if (isMilitary(aircraft)) return 'military';
  const cat = aircraft.category;
  if (cat === 1) return 'glider';
  if (cat === 2) return 'glider';
  if (cat === 3) return 'glider';
  if (cat === 7) return 'helicopter';
  if (cat === 14) return 'drone';
  if (cat === 17 || cat === 18 || cat === 19 || cat === 20) return 'drone';
  const vel = aircraft.velocity ?? 0;
  const alt = aircraft.baro_altitude ?? 0;
  if (vel < 50 && alt < 1000 && !aircraft.on_ground) return 'helicopter';
  if (vel > 400 || alt > 25000) return 'commercial';
  if (vel > 200) return 'commercial';
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
    all: '#60a5fa',
    commercial: '#60a5fa',
    cargo: '#f59e0b',
    military: '#ef4444',
    private: '#a78bfa',
    helicopter: '#34d399',
    glider: '#fbbf24',
    drone: '#f472b6',
    ground: '#6b7280',
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

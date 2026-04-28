export interface Aircraft {
  icao24: string;
  callsign: string | null;
  origin_country: string;
  time_position: number | null;
  last_contact: number;
  longitude: number | null;
  latitude: number | null;
  baro_altitude: number | null;
  on_ground: boolean;
  velocity: number | null;
  true_track: number | null;
  vertical_rate: number | null;
  sensors: number[] | null;
  geo_altitude: number | null;
  squawk: string | null;
  spi: boolean;
  position_source: number;
  category: number;
  typeCode?: string;
}

export interface AircraftInfo {
  icao24: string;
  registration: string;
  manufacturericao: string;
  manufacturername: string;
  model: string;
  typecode: string;
  serialnumber: string;
  linenumber: string;
  icaoaircrafttype: string;
  operator: string;
  operatorcallsign: string;
  operatoricao: string;
  operatoriata: string;
  owner: string;
  categoryDescription: string;
  built: string;
  engines: string;
  country: string;
  notes: string;
}

export type MapStyle = 'dark' | 'satellite' | 'light' | 'terrain';

export type AircraftCategory =
  | 'all'
  | 'commercial'
  | 'cargo'
  | 'military'
  | 'private'
  | 'helicopter'
  | 'glider'
  | 'drone'
  | 'ground';

export interface FilterState {
  categories: AircraftCategory[];
  minAltitude: number;
  maxAltitude: number;
  minSpeed: number;
  maxSpeed: number;
  onGroundVisible: boolean;
  countries: string[];
  searchQuery: string;
  militaryOnly: boolean;
}

export interface SpottingAlert {
  id: string;
  callsign: string;
  icao24: string;
  radius: number;
  lat: number;
  lng: number;
  active: boolean;
}

export interface JetPhoto {
  imageUrl: string;
  photographer: string;
  aircraftReg?: string;
}

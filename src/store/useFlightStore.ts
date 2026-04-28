import { create } from 'zustand';
import type { Aircraft, AircraftInfo, FilterState, MapStyle, SpottingAlert, JetPhoto } from '../types';

interface FlightStore {
  aircraft: Aircraft[];
  selectedAircraft: Aircraft | null;
  aircraftInfo: AircraftInfo | null;
  jetPhoto: JetPhoto | null;
  mapStyle: MapStyle;
  filters: FilterState;
  spottingAlerts: SpottingAlert[];
  triggeredAlerts: SpottingAlert[];
  userLocation: [number, number] | null;
  isLoading: boolean;
  lastUpdate: Date | null;
  fetchError: string | null;
  sidebarOpen: boolean;
  followAircraft: boolean;

  setAircraft: (aircraft: Aircraft[]) => void;
  setSelectedAircraft: (aircraft: Aircraft | null) => void;
  setAircraftInfo: (info: AircraftInfo | null) => void;
  setJetPhoto: (photo: JetPhoto | null) => void;
  setMapStyle: (style: MapStyle) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  addSpottingAlert: (alert: SpottingAlert) => void;
  removeSpottingAlert: (id: string) => void;
  toggleSpottingAlert: (id: string) => void;
  addTriggeredAlert: (alert: SpottingAlert) => void;
  dismissTriggeredAlert: (id: string) => void;
  setUserLocation: (loc: [number, number] | null) => void;
  setIsLoading: (loading: boolean) => void;
  setLastUpdate: (date: Date) => void;
  setFetchError: (error: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setFollowAircraft: (follow: boolean) => void;
}

export const useFlightStore = create<FlightStore>((set) => ({
  aircraft: [],
  selectedAircraft: null,
  aircraftInfo: null,
  jetPhoto: null,
  mapStyle: 'dark',
  filters: {
    categories: ['all'],
    minAltitude: 0,
    maxAltitude: 45000,
    minSpeed: 0,
    maxSpeed: 1200,
    onGroundVisible: true,
    countries: [],
    searchQuery: '',
    militaryOnly: false,
  },
  spottingAlerts: [],
  triggeredAlerts: [],
  userLocation: null,
  isLoading: false,
  lastUpdate: null,
  fetchError: null,
  sidebarOpen: false,
  followAircraft: false,

  setAircraft: (aircraft) => set({ aircraft }),
  setSelectedAircraft: (selectedAircraft) => set({ selectedAircraft, sidebarOpen: !!selectedAircraft }),
  setAircraftInfo: (aircraftInfo) => set({ aircraftInfo }),
  setJetPhoto: (jetPhoto) => set({ jetPhoto }),
  setMapStyle: (mapStyle) => set({ mapStyle }),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  addSpottingAlert: (alert) => set((state) => ({ spottingAlerts: [...state.spottingAlerts, alert] })),
  removeSpottingAlert: (id) => set((state) => ({ spottingAlerts: state.spottingAlerts.filter((a) => a.id !== id) })),
  toggleSpottingAlert: (id) =>
    set((state) => ({
      spottingAlerts: state.spottingAlerts.map((a) => (a.id === id ? { ...a, active: !a.active } : a)),
    })),
  addTriggeredAlert: (alert) =>
    set((state) => ({
      triggeredAlerts: state.triggeredAlerts.some((a) => a.id === alert.id)
        ? state.triggeredAlerts
        : [...state.triggeredAlerts, alert],
    })),
  dismissTriggeredAlert: (id) =>
    set((state) => ({ triggeredAlerts: state.triggeredAlerts.filter((a) => a.id !== id) })),
  setUserLocation: (userLocation) => set({ userLocation }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setLastUpdate: (lastUpdate) => set({ lastUpdate }),
  setFetchError: (fetchError) => set({ fetchError }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setFollowAircraft: (followAircraft) => set({ followAircraft }),
}));

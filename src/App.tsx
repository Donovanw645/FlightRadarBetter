import { useState } from 'react';
import FlightMap from './components/FlightMap';
import TopBar from './components/TopBar';
import FilterPanel from './components/FilterPanel';
import SpottingPanel from './components/SpottingPanel';
import AircraftSidebar from './components/AircraftSidebar';
import AlertToast from './components/AlertToast';
import Legend from './components/Legend';
import { useFlightData } from './hooks/useFlightData';

export default function App() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [spottingOpen, setSpottingOpen] = useState(false);

  useFlightData();

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-950">
      <div className="absolute inset-0">
        <FlightMap />
      </div>

      <TopBar
        onOpenFilters={() => { setFiltersOpen((v) => !v); setSpottingOpen(false); }}
        onOpenSpotting={() => { setSpottingOpen((v) => !v); setFiltersOpen(false); }}
      />

      {filtersOpen && <FilterPanel onClose={() => setFiltersOpen(false)} />}
      {spottingOpen && <SpottingPanel onClose={() => setSpottingOpen(false)} />}

      <AircraftSidebar />
      <AlertToast />
      <Legend />
    </div>
  );
}

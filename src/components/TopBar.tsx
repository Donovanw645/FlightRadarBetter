import { useState } from 'react';
import { Search, Plane, Radio, Settings, RefreshCw } from 'lucide-react';
import { useFlightStore } from '../store/useFlightStore';
import MapStyleToggle from './MapStyleToggle';

interface Props {
  onOpenFilters: () => void;
  onOpenSpotting: () => void;
}

export default function TopBar({ onOpenFilters, onOpenSpotting }: Props) {
  const { filters, setFilters, aircraft, isLoading, lastUpdate } = useFlightStore();
  const [showMapStyle, setShowMapStyle] = useState(false);

  return (
    <div className="absolute top-0 left-0 right-0 z-[1000] flex items-center gap-2 px-3 py-2 bg-gray-900/90 backdrop-blur border-b border-gray-700">
      {/* Brand */}
      <div className="flex items-center gap-1.5 mr-2 shrink-0">
        <Plane size={18} className="text-blue-400" />
        <span className="font-bold text-white text-sm tracking-wide hidden sm:block">FlightRadarBetter</span>
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={filters.searchQuery}
          onChange={(e) => setFilters({ searchQuery: e.target.value })}
          placeholder="Search callsign or ICAO…"
          className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Aircraft count */}
      <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400 shrink-0">
        <span className="text-white font-mono font-semibold">{aircraft.length.toLocaleString()}</span>
        <span>aircraft</span>
        {isLoading && <RefreshCw size={11} className="animate-spin text-blue-400 ml-1" />}
        {lastUpdate && (
          <span className="text-gray-500 ml-1">
            {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      <div className="flex-1" />

      {/* Actions */}
      <button
        onClick={() => setShowMapStyle((v) => !v)}
        className="relative flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg transition"
      >
        Map
        {showMapStyle && (
          <div className="absolute top-full right-0 mt-1">
            <MapStyleToggle onClose={() => setShowMapStyle(false)} />
          </div>
        )}
      </button>

      <button
        onClick={onOpenFilters}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg transition"
      >
        <Settings size={13} />
        <span className="hidden sm:block">Filters</span>
      </button>

      <button
        onClick={onOpenSpotting}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-orange-300 bg-orange-900/40 hover:bg-orange-900/60 border border-orange-700 rounded-lg transition"
      >
        <Radio size={13} />
        <span className="hidden sm:block">Spotting</span>
      </button>
    </div>
  );
}

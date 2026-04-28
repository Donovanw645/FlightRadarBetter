import { useState } from 'react';
import { Search, Plane, Radio, SlidersHorizontal, RefreshCw, Layers, AlertCircle } from 'lucide-react';
import { useFlightStore } from '../store/useFlightStore';
import MapStyleToggle from './MapStyleToggle';

interface Props {
  onOpenFilters: () => void;
  onOpenSpotting: () => void;
}

export default function TopBar({ onOpenFilters, onOpenSpotting }: Props) {
  const { filters, setFilters, aircraft, isLoading, lastUpdate, fetchError } = useFlightStore();
  const [showMapStyle, setShowMapStyle] = useState(false);

  return (
    <div className="absolute top-0 left-0 right-0 z-[1000] flex items-center gap-2 px-4 py-2.5 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800">
      {/* Brand */}
      <div className="flex items-center gap-2 shrink-0 mr-1">
        <div className="flex items-center justify-center w-7 h-7 bg-blue-600 rounded-lg shrink-0">
          <Plane size={14} className="text-white" />
        </div>
        <span className="font-semibold text-white text-sm tracking-tight hidden sm:block">Plane Tracker</span>
      </div>

      <div className="w-px h-5 bg-gray-800 shrink-0 hidden sm:block" />

      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          value={filters.searchQuery}
          onChange={(e) => setFilters({ searchQuery: e.target.value })}
          placeholder="Search callsign or ICAO…"
          className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 transition"
        />
      </div>

      {/* Status */}
      <div className="hidden sm:flex items-center gap-2 text-xs shrink-0">
        {fetchError ? (
          <div className="flex items-center gap-1.5 text-red-400">
            <AlertCircle size={12} />
            <span>Data unavailable</span>
          </div>
        ) : (
          <>
            <span>
              <span className="text-white font-semibold font-mono">{aircraft.length.toLocaleString()}</span>
              <span className="text-gray-500"> aircraft</span>
            </span>
            {lastUpdate && (
              <span className="text-gray-600">
                {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </>
        )}
        {isLoading && <RefreshCw size={11} className="animate-spin text-blue-500 shrink-0" />}
      </div>

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <button
            onClick={() => setShowMapStyle((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-300 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-lg transition"
          >
            <Layers size={13} />
            <span className="hidden sm:block">Map</span>
          </button>
          {showMapStyle && (
            <div className="absolute top-full right-0 mt-1.5">
              <MapStyleToggle onClose={() => setShowMapStyle(false)} />
            </div>
          )}
        </div>

        <button
          onClick={onOpenFilters}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-300 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-lg transition"
        >
          <SlidersHorizontal size={13} />
          <span className="hidden sm:block">Filters</span>
        </button>

        <button
          onClick={onOpenSpotting}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-orange-400 bg-orange-950/50 hover:bg-orange-950/80 border border-orange-900/60 hover:border-orange-800 rounded-lg transition"
        >
          <Radio size={13} />
          <span className="hidden sm:block">Alerts</span>
        </button>
      </div>
    </div>
  );
}

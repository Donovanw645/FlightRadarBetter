import { X, Shield, ChevronDown } from 'lucide-react';
import { useFlightStore } from '../store/useFlightStore';
import type { AircraftCategory, FilterState } from '../types';
import { getCategoryColor, getCategoryLabel } from '../utils/aircraftUtils';
import { useState } from 'react';

const CATEGORIES: AircraftCategory[] = [
  'commercial', 'cargo', 'military', 'private', 'helicopter', 'glider', 'drone', 'ground',
];

interface Props { onClose: () => void }

export default function FilterPanel({ onClose }: Props) {
  const { filters, setFilters } = useFlightStore();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const toggleCategory = (cat: AircraftCategory) => {
    const current = filters.categories;
    if (cat === 'all') {
      setFilters({ categories: ['all'] });
      return;
    }
    let next = current.filter((c) => c !== 'all');
    if (next.includes(cat)) {
      next = next.filter((c) => c !== cat);
    } else {
      next = [...next, cat];
    }
    setFilters({ categories: next.length === 0 ? ['all'] : next });
  };

  const resetFilters = () => {
    setFilters({
      categories: ['all'],
      minAltitude: 0,
      maxAltitude: 45000,
      minSpeed: 0,
      maxSpeed: 1200,
      onGroundVisible: true,
      countries: [],
      searchQuery: '',
      militaryOnly: false,
    } as FilterState);
  };

  const activeAll = filters.categories.includes('all');

  return (
    <div className="absolute top-14 left-3 z-[1001] w-72 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <span className="font-semibold text-sm">Filters</span>
        <div className="flex items-center gap-2">
          <button onClick={resetFilters} className="text-xs text-gray-400 hover:text-white transition">Reset</button>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={16} /></button>
        </div>
      </div>

      <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
        {/* Military only toggle */}
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-red-400" />
            <span className="text-sm font-medium">Military Only</span>
          </div>
          <div
            onClick={() => setFilters({ militaryOnly: !filters.militaryOnly })}
            className={`w-10 h-5 rounded-full transition relative cursor-pointer ${filters.militaryOnly ? 'bg-red-500' : 'bg-gray-600'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${filters.militaryOnly ? 'left-5' : 'left-0.5'}`} />
          </div>
        </label>

        {/* Aircraft categories */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Aircraft Type</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => toggleCategory('all')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition border ${
                activeAll ? 'bg-blue-600 border-blue-500 text-white' : 'border-gray-600 text-gray-400 hover:border-gray-400'
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => {
              const active = !activeAll && filters.categories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition border ${
                    active ? 'text-white border-transparent' : 'border-gray-600 text-gray-400 hover:border-gray-400'
                  }`}
                  style={active ? { backgroundColor: getCategoryColor(cat), borderColor: getCategoryColor(cat) } : {}}
                >
                  {getCategoryLabel(cat)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ground vehicles */}
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm">Show on-ground aircraft</span>
          <div
            onClick={() => setFilters({ onGroundVisible: !filters.onGroundVisible })}
            className={`w-10 h-5 rounded-full transition relative cursor-pointer ${filters.onGroundVisible ? 'bg-blue-500' : 'bg-gray-600'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${filters.onGroundVisible ? 'left-5' : 'left-0.5'}`} />
          </div>
        </label>

        {/* Advanced */}
        <button
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition w-full"
        >
          <ChevronDown size={13} className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          Advanced filters
        </button>

        {advancedOpen && (
          <div className="space-y-4 pt-1">
            {/* Altitude range */}
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Altitude</span>
                <span>{filters.minAltitude.toLocaleString()} – {filters.maxAltitude.toLocaleString()} m</span>
              </div>
              <input
                type="range" min={0} max={45000} step={500}
                value={filters.maxAltitude}
                onChange={(e) => setFilters({ maxAltitude: Number(e.target.value) })}
                className="w-full accent-blue-500"
              />
              <input
                type="range" min={0} max={45000} step={500}
                value={filters.minAltitude}
                onChange={(e) => setFilters({ minAltitude: Number(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>

            {/* Speed range */}
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Speed</span>
                <span>{filters.minSpeed} – {filters.maxSpeed} m/s</span>
              </div>
              <input
                type="range" min={0} max={1200} step={10}
                value={filters.maxSpeed}
                onChange={(e) => setFilters({ maxSpeed: Number(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

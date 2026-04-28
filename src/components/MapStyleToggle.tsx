import { Moon, Sun, Satellite, Mountain } from 'lucide-react';
import { useFlightStore } from '../store/useFlightStore';
import type { MapStyle } from '../types';

const STYLES: { id: MapStyle; label: string; icon: React.ReactNode }[] = [
  { id: 'dark', label: 'Dark', icon: <Moon size={13} /> },
  { id: 'light', label: 'Light', icon: <Sun size={13} /> },
  { id: 'satellite', label: 'Satellite', icon: <Satellite size={13} /> },
  { id: 'terrain', label: 'Terrain', icon: <Mountain size={13} /> },
];

export default function MapStyleToggle({ onClose }: { onClose: () => void }) {
  const { mapStyle, setMapStyle } = useFlightStore();

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5 w-36">
      {STYLES.map((s) => (
        <button
          key={s.id}
          onClick={() => { setMapStyle(s.id); onClose(); }}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
            mapStyle === s.id
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
        >
          {s.icon}
          <span>{s.label}</span>
        </button>
      ))}
    </div>
  );
}
